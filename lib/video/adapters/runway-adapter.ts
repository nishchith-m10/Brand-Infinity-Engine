/**
 * Runway Video Generation Adapter
 * Phase 10: Video Provider Integration
 * 
 * Provides video generation using Runway's Gen-3/Gen-4 API.
 * https://docs.runwayml.com/
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const RUNWAY_BASE_URL = 'https://api.runwayml.com/v1';

// Available models
const RUNWAY_MODELS = {
  'gen3a-turbo': {
    name: 'Gen-3 Alpha Turbo',
    costPerSecond: 0.05,
    maxDuration: 10,
    description: 'Fast generation, good quality',
  },
  'gen3a': {
    name: 'Gen-3 Alpha',
    costPerSecond: 0.10,
    maxDuration: 10,
    description: 'Highest quality, slower',
  },
  'gen4-turbo': {
    name: 'Gen-4 Turbo',
    costPerSecond: 0.05,
    maxDuration: 10,
    description: 'Latest model, balanced speed/quality',
  },
} as const;

export type RunwayModel = keyof typeof RUNWAY_MODELS;

export interface RunwayVideoRequest {
  prompt: string;
  model?: RunwayModel;
  duration?: 5 | 10;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  imageUrl?: string;  // For image-to-video
  seed?: number;
}

export interface RunwayVideoResponse {
  taskId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  videoUrl?: string;
  error?: string;
}

export interface RunwayTaskStatus {
  id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  progress?: number;
  output?: {
    video_url: string;
  };
  error?: string;
}

export class RunwayAdapter {
  private apiKey: string | null;
  private apiKeyPromise: Promise<string | null>;
  private userId?: string;

  constructor(apiKey?: string, userId?: string) {
    this.userId = userId;
    
    if (apiKey) {
      this.apiKey = apiKey;
      this.apiKeyPromise = Promise.resolve(apiKey);
    } else {
      this.apiKey = null;
      this.apiKeyPromise = getEffectiveProviderKey('runway', process.env.RUNWAY_API_KEY, userId);
    }
  }

  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await this.apiKeyPromise;
    }
    if (!this.apiKey) {
      throw new Error(
        'Runway API key not configured. Please add your Runway key in Settings or set RUNWAY_API_KEY environment variable.'
      );
    }
    return this.apiKey;
  }

  /**
   * Create a new video generation task
   */
  async createTask(request: RunwayVideoRequest): Promise<RunwayVideoResponse> {
    const apiKey = await this.ensureApiKey();
    const model = request.model || 'gen3a-turbo';

    const payload: Record<string, unknown> = {
      text_prompt: request.prompt,
      model,
      duration: request.duration || 5,
      ratio: request.aspectRatio || '16:9',
    };

    if (request.imageUrl) {
      payload.init_image = request.imageUrl;
    }

    if (request.seed !== undefined) {
      payload.seed = request.seed;
    }

    const response = await fetch(`${RUNWAY_BASE_URL}/image_to_video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Runway API error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
        
        if (response.status === 402) {
          errorMessage = 'Runway: Insufficient credits. Please add credits to your account.';
        } else if (response.status === 429) {
          errorMessage = 'Runway: Rate limit exceeded. Please try again later.';
        }
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();

    return {
      taskId: data.id,
      status: 'pending',
    };
  }

  /**
   * Check status of a video generation task
   */
  async getTaskStatus(taskId: string): Promise<RunwayTaskStatus> {
    const apiKey = await this.ensureApiKey();

    const response = await fetch(`${RUNWAY_BASE_URL}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Runway API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Wait for task completion with polling
   */
  async waitForCompletion(
    taskId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<RunwayTaskStatus> {
    const { timeoutMs = 300000, pollIntervalMs = 5000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getTaskStatus(taskId);

      if (status.status === 'succeeded') {
        return status;
      }

      if (status.status === 'failed') {
        throw new Error(`Video generation failed: ${status.error || 'Unknown error'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Video generation timed out after ${timeoutMs / 1000} seconds`);
  }

  /**
   * Generate video and wait for completion
   */
  async generateVideo(request: RunwayVideoRequest): Promise<{
    videoUrl: string;
    taskId: string;
    model: string;
    estimatedCost: number;
  }> {
    const model = request.model || 'gen3a-turbo';
    const duration = request.duration || 5;
    
    const task = await this.createTask(request);
    const completed = await this.waitForCompletion(task.taskId);
    
    const modelInfo = RUNWAY_MODELS[model];
    const estimatedCost = modelInfo ? modelInfo.costPerSecond * duration : 0;

    return {
      videoUrl: completed.output?.video_url || '',
      taskId: task.taskId,
      model,
      estimatedCost,
    };
  }

  /**
   * Check if configured (sync check for UI)
   */
  isConfigured(): boolean {
    return !!this.apiKey || !!process.env.RUNWAY_API_KEY;
  }

  /**
   * Get available models
   */
  static getAvailableModels(): typeof RUNWAY_MODELS {
    return RUNWAY_MODELS;
  }

  /**
   * Estimate cost
   */
  static estimateCost(model: RunwayModel = 'gen3a-turbo', durationSeconds: number = 5): number {
    const modelInfo = RUNWAY_MODELS[model];
    return modelInfo ? modelInfo.costPerSecond * durationSeconds : 0;
  }
}

/**
 * Factory function
 */
export function createRunwayAdapter(apiKey?: string, userId?: string): RunwayAdapter {
  return new RunwayAdapter(apiKey, userId);
}

/**
 * Get adapter instance
 */
export function getRunwayAdapter(apiKey?: string, userId?: string): RunwayAdapter {
  return new RunwayAdapter(apiKey, userId);
}

/**
 * Check if Runway is configured
 */
export function isRunwayConfigured(): boolean {
  return !!process.env.RUNWAY_API_KEY;
}
