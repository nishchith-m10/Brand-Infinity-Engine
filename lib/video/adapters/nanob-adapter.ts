/**
 * Nano-B Video Generation Adapter
 * Phase 10: Video Provider Integration
 * 
 * Provides video generation using Nano-B's fast video API.
 * Nano-B is known for fast, low-cost video generation.
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const NANOB_BASE_URL = process.env.NANOB_API_URL || 'https://api.nanob.ai';

// Available models
const NANOB_MODELS = {
  'nanob-fast': {
    name: 'Nano-B Fast',
    costPerSecond: 0.05,
    maxDuration: 10,
    description: 'Fast generation, good for previews',
  },
  'nanob-standard': {
    name: 'Nano-B Standard',
    costPerSecond: 0.10,
    maxDuration: 15,
    description: 'Balanced speed and quality',
  },
  'nanob-hq': {
    name: 'Nano-B HQ',
    costPerSecond: 0.20,
    maxDuration: 10,
    description: 'High quality output',
  },
} as const;

export type NanoBModel = keyof typeof NANOB_MODELS;

export interface NanoBVideoRequest {
  prompt: string;
  model?: NanoBModel;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  imageUrl?: string;
  style?: string;
}

export interface NanoBVideoResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

export interface NanoBTaskStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  video_url?: string;
  error?: string;
}

export class NanoBVideoAdapter {
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
      this.apiKeyPromise = getEffectiveProviderKey('nanob', process.env.NANOB_API_KEY, userId);
    }
  }

  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await this.apiKeyPromise;
    }
    if (!this.apiKey) {
      throw new Error(
        'Nano-B API key not configured. Please add your Nano-B key in Settings or set NANOB_API_KEY environment variable.'
      );
    }
    return this.apiKey;
  }

  /**
   * Create a new video generation task
   */
  async createTask(request: NanoBVideoRequest): Promise<NanoBVideoResponse> {
    const apiKey = await this.ensureApiKey();
    const model = request.model || 'nanob-standard';

    const payload: Record<string, unknown> = {
      prompt: request.prompt,
      model,
      duration: request.duration || 5,
      aspect_ratio: request.aspectRatio || '16:9',
    };

    if (request.imageUrl) {
      payload.init_image = request.imageUrl;
    }

    if (request.style) {
      payload.style = request.style;
    }

    const response = await fetch(`${NANOB_BASE_URL}/v1/video/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Nano-B API error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
        
        if (response.status === 402) {
          errorMessage = 'Nano-B: Insufficient credits. Please add credits to your account.';
        } else if (response.status === 429) {
          errorMessage = 'Nano-B: Rate limit exceeded. Please try again later.';
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
  async getTaskStatus(taskId: string): Promise<NanoBTaskStatus> {
    const apiKey = await this.ensureApiKey();

    const response = await fetch(`${NANOB_BASE_URL}/v1/video/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Nano-B API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Wait for task completion with polling
   */
  async waitForCompletion(
    taskId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<NanoBTaskStatus> {
    const { timeoutMs = 180000, pollIntervalMs = 3000 } = options; // 3 min timeout, 3 sec poll (faster)
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
  async generateVideo(request: NanoBVideoRequest): Promise<{
    videoUrl: string;
    taskId: string;
    model: string;
    estimatedCost: number;
  }> {
    const model = request.model || 'nanob-standard';
    const duration = request.duration || 5;
    
    const task = await this.createTask(request);
    const completed = await this.waitForCompletion(task.taskId);
    
    const modelInfo = NANOB_MODELS[model];
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
    return !!this.apiKey || !!process.env.NANOB_API_KEY;
  }

  /**
   * Get available models
   */
  static getAvailableModels(): typeof NANOB_MODELS {
    return NANOB_MODELS;
  }

  /**
   * Estimate cost
   */
  static estimateCost(model: NanoBModel = 'nanob-standard', durationSeconds: number = 5): number {
    const modelInfo = NANOB_MODELS[model];
    return modelInfo ? modelInfo.costPerSecond * durationSeconds : 0;
  }
}

/**
 * Factory function
 */
export function createNanoBVideoAdapter(apiKey?: string, userId?: string): NanoBVideoAdapter {
  return new NanoBVideoAdapter(apiKey, userId);
}

/**
 * Get adapter instance
 */
export function getNanoBVideoAdapter(apiKey?: string, userId?: string): NanoBVideoAdapter {
  return new NanoBVideoAdapter(apiKey, userId);
}

/**
 * Check if configured
 */
export function isNanoBVideoConfigured(): boolean {
  return !!process.env.NANOB_API_KEY;
}
