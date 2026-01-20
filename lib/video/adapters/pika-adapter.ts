/**
 * Pika Video Generation Adapter
 * Phase 10: Video Provider Integration
 * 
 * Provides video generation using Pika's API.
 * https://pika.art/
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const PIKA_BASE_URL = 'https://api.pika.art/v1';

// Available models
const PIKA_MODELS = {
  'pika-1.0': {
    name: 'Pika 1.0',
    costPerGeneration: 0.05,
    maxDuration: 4,
    description: 'Original Pika model',
  },
  'pika-1.5': {
    name: 'Pika 1.5',
    costPerGeneration: 0.08,
    maxDuration: 5,
    description: 'Enhanced quality and motion',
  },
  'pika-2.0': {
    name: 'Pika 2.0',
    costPerGeneration: 0.10,
    maxDuration: 5,
    description: 'Latest model with best quality',
  },
} as const;

export type PikaModel = keyof typeof PIKA_MODELS;

export interface PikaVideoRequest {
  prompt: string;
  model?: PikaModel;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  imageUrl?: string;  // For image-to-video
  negativePrompt?: string;
  seed?: number;
}

export interface PikaVideoResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

export interface PikaTaskStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  video_url?: string;
  error?: string;
}

export class PikaAdapter {
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
      this.apiKeyPromise = getEffectiveProviderKey('pika', process.env.PIKA_API_KEY, userId);
    }
  }

  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await this.apiKeyPromise;
    }
    if (!this.apiKey) {
      throw new Error(
        'Pika API key not configured. Please add your Pika key in Settings or set PIKA_API_KEY environment variable.'
      );
    }
    return this.apiKey;
  }

  /**
   * Create a new video generation task
   */
  async createTask(request: PikaVideoRequest): Promise<PikaVideoResponse> {
    const apiKey = await this.ensureApiKey();
    const model = request.model || 'pika-1.5';

    const payload: Record<string, unknown> = {
      prompt: request.prompt,
      model,
      aspect_ratio: request.aspectRatio || '16:9',
    };

    if (request.imageUrl) {
      payload.image = request.imageUrl;
    }

    if (request.negativePrompt) {
      payload.negative_prompt = request.negativePrompt;
    }

    if (request.seed !== undefined) {
      payload.seed = request.seed;
    }

    const response = await fetch(`${PIKA_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Pika API error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
        
        if (response.status === 402) {
          errorMessage = 'Pika: Insufficient credits. Please add credits to your account.';
        } else if (response.status === 429) {
          errorMessage = 'Pika: Rate limit exceeded. Please try again later.';
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
  async getTaskStatus(taskId: string): Promise<PikaTaskStatus> {
    const apiKey = await this.ensureApiKey();

    const response = await fetch(`${PIKA_BASE_URL}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pika API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Wait for task completion with polling
   */
  async waitForCompletion(
    taskId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<PikaTaskStatus> {
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
  async generateVideo(request: PikaVideoRequest): Promise<{
    videoUrl: string;
    taskId: string;
    model: string;
    estimatedCost: number;
  }> {
    const model = request.model || 'pika-1.5';
    
    const task = await this.createTask(request);
    const completed = await this.waitForCompletion(task.taskId);
    
    const modelInfo = PIKA_MODELS[model];
    const estimatedCost = modelInfo ? modelInfo.costPerGeneration : 0;

    return {
      videoUrl: completed.video_url || '',
      taskId: task.taskId,
      model,
      estimatedCost,
    };
  }

  /**
   * Check if configured (sync check for UI)
   */
  isConfigured(): boolean {
    return !!this.apiKey || !!process.env.PIKA_API_KEY;
  }

  /**
   * Get available models
   */
  static getAvailableModels(): typeof PIKA_MODELS {
    return PIKA_MODELS;
  }

  /**
   * Estimate cost
   */
  static estimateCost(model: PikaModel = 'pika-1.5', count: number = 1): number {
    const modelInfo = PIKA_MODELS[model];
    return modelInfo ? modelInfo.costPerGeneration * count : 0;
  }
}

/**
 * Factory function
 */
export function createPikaAdapter(apiKey?: string, userId?: string): PikaAdapter {
  return new PikaAdapter(apiKey, userId);
}

/**
 * Get adapter instance
 */
export function getPikaAdapter(apiKey?: string, userId?: string): PikaAdapter {
  return new PikaAdapter(apiKey, userId);
}

/**
 * Check if Pika is configured
 */
export function isPikaConfigured(): boolean {
  return !!process.env.PIKA_API_KEY;
}
