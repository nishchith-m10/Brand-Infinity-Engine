/**
 * Seedream Video Generation Adapter
 * Phase 10: Video Provider Integration
 * 
 * Provides video generation using ByteDance's Seedream 4.0 API.
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const SEEDREAM_BASE_URL = process.env.SEEDREAM_API_URL || 'https://api.seedream.ai/v1';

// Available models
const SEEDREAM_MODELS = {
  'seedream-3.0': {
    name: 'Seedream 3.0',
    costPerSecond: 0.20,
    maxDuration: 10,
    description: 'Previous generation, stable',
  },
  'seedream-4.0': {
    name: 'Seedream 4.0',
    costPerSecond: 0.30,
    maxDuration: 15,
    description: 'Latest model, best quality',
  },
  'seedream-4.0-turbo': {
    name: 'Seedream 4.0 Turbo',
    costPerSecond: 0.15,
    maxDuration: 10,
    description: 'Fast generation, good quality',
  },
} as const;

export type SeedreamModel = keyof typeof SEEDREAM_MODELS;

export interface SeedreamVideoRequest {
  prompt: string;
  model?: SeedreamModel;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  imageUrl?: string;
  negativePrompt?: string;
  seed?: number;
}

export interface SeedreamVideoResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

export interface SeedreamTaskStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  video_url?: string;
  error?: string;
}

export class SeedreamAdapter {
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
      this.apiKeyPromise = getEffectiveProviderKey('seedream', process.env.SEEDREAM_API_KEY, userId);
    }
  }

  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await this.apiKeyPromise;
    }
    if (!this.apiKey) {
      throw new Error(
        'Seedream API key not configured. Please add your Seedream key in Settings or set SEEDREAM_API_KEY environment variable.'
      );
    }
    return this.apiKey;
  }

  /**
   * Create a new video generation task
   */
  async createTask(request: SeedreamVideoRequest): Promise<SeedreamVideoResponse> {
    const apiKey = await this.ensureApiKey();
    const model = request.model || 'seedream-4.0';

    const payload: Record<string, unknown> = {
      prompt: request.prompt,
      model,
      duration: request.duration || 5,
      aspect_ratio: request.aspectRatio || '16:9',
    };

    if (request.imageUrl) {
      payload.init_image = request.imageUrl;
    }

    if (request.negativePrompt) {
      payload.negative_prompt = request.negativePrompt;
    }

    if (request.seed !== undefined) {
      payload.seed = request.seed;
    }

    const response = await fetch(`${SEEDREAM_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Seedream API error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
        
        if (response.status === 402) {
          errorMessage = 'Seedream: Insufficient credits. Please add credits to your account.';
        } else if (response.status === 429) {
          errorMessage = 'Seedream: Rate limit exceeded. Please try again later.';
        }
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();

    return {
      taskId: data.id || data.task_id,
      status: 'pending',
    };
  }

  /**
   * Check status of a video generation task
   */
  async getTaskStatus(taskId: string): Promise<SeedreamTaskStatus> {
    const apiKey = await this.ensureApiKey();

    const response = await fetch(`${SEEDREAM_BASE_URL}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Seedream API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Wait for task completion with polling
   */
  async waitForCompletion(
    taskId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<SeedreamTaskStatus> {
    const { timeoutMs = 300000, pollIntervalMs = 5000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getTaskStatus(taskId);

      if (status.status === 'completed') {
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
  async generateVideo(request: SeedreamVideoRequest): Promise<{
    videoUrl: string;
    taskId: string;
    model: string;
    estimatedCost: number;
  }> {
    const model = request.model || 'seedream-4.0';
    const duration = request.duration || 5;
    
    const task = await this.createTask(request);
    const completed = await this.waitForCompletion(task.taskId);
    
    const modelInfo = SEEDREAM_MODELS[model];
    const estimatedCost = modelInfo ? modelInfo.costPerSecond * duration : 0;

    return {
      videoUrl: completed.video_url || '',
      taskId: task.taskId,
      model,
      estimatedCost,
    };
  }

  /**
   * Check if configured
   */
  isConfigured(): boolean {
    return !!this.apiKey || !!process.env.SEEDREAM_API_KEY;
  }

  /**
   * Get available models
   */
  static getAvailableModels(): typeof SEEDREAM_MODELS {
    return SEEDREAM_MODELS;
  }

  /**
   * Estimate cost
   */
  static estimateCost(model: SeedreamModel = 'seedream-4.0', durationSeconds: number = 5): number {
    const modelInfo = SEEDREAM_MODELS[model];
    return modelInfo ? modelInfo.costPerSecond * durationSeconds : 0;
  }
}

/**
 * Factory function
 */
export function createSeedreamAdapter(apiKey?: string, userId?: string): SeedreamAdapter {
  return new SeedreamAdapter(apiKey, userId);
}

/**
 * Get adapter instance
 */
export function getSeedreamAdapter(apiKey?: string, userId?: string): SeedreamAdapter {
  return new SeedreamAdapter(apiKey, userId);
}

/**
 * Check if configured
 */
export function isSeedreamConfigured(): boolean {
  return !!process.env.SEEDREAM_API_KEY;
}
