/**
 * Pollo AI Video Generation Adapter
 * Provides access to multiple video AI models (Kling, Veo, Sora, etc.) via Pollo AI API
 */

export interface PolloVideoRequest {
  text_prompt: string;
  model?: string;
  duration?: 5 | 10;
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  image_url?: string; // For image-to-video
}

export interface PolloVideoResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'succeed' | 'failed';
  video_url?: string;
  error?: string;
}

export interface PolloTaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'succeed' | 'failed';
  progress?: number;
  video_url?: string;
  error_message?: string;
}

// Available models via Pollo AI (as of Jan 2026)
export const POLLO_MODELS = {
  'pollo-v2-0': { name: 'Pollo 2.0', credits: 10 },
  'kling-v1-0': { name: 'Kling 1.0', credits: 10 },
  'kling-v1-5': { name: 'Kling 1.5', credits: 10 },
  'kling-v1-6': { name: 'Kling 1.6', credits: 10 },
  'kling-v2-0': { name: 'Kling 2.0', credits: 15 },
  'kling-v2-5-turbo': { name: 'Kling 2.5 Turbo', credits: 12 },
  'veo-3': { name: 'Google Veo 3', credits: 20 },
  'veo-3-fast': { name: 'Google Veo 3 Fast', credits: 15 },
  'luma': { name: 'Luma AI', credits: 10 },
  'pika': { name: 'Pika AI', credits: 10 },
  'hailuo': { name: 'Hailuo AI', credits: 10 },
} as const;

export type PolloModel = keyof typeof POLLO_MODELS;

export class PolloAdapter {
  private apiKey: string;
  private baseUrl = 'https://api.pollo.ai/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.POLLO_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[PolloAdapter] No API key configured. Set POLLO_API_KEY env var.');
    }
  }

  /**
   * Create a new video generation task
   */
  async createTask(request: PolloVideoRequest): Promise<PolloVideoResponse> {
    const response = await fetch(`${this.baseUrl}/task/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.apiKey,
      },
      body: JSON.stringify({
        params: {
          text_prompt: request.text_prompt,
          model: request.model || 'kling-v1-6',
          duration: request.duration || 5,
          aspect_ratio: request.aspect_ratio || '16:9',
          ...(request.image_url && { image_url: request.image_url }),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pollo API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Check status of a video generation task
   */
  async getTaskStatus(taskId: string): Promise<PolloTaskStatus> {
    const response = await fetch(`${this.baseUrl}/task/status?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pollo API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Wait for task completion with polling
   */
  async waitForCompletion(
    taskId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<PolloTaskStatus> {
    const { timeoutMs = 300000, pollIntervalMs = 5000 } = options; // 5 min timeout, 5 sec poll
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getTaskStatus(taskId);

      if (status.status === 'succeed') {
        return status;
      }

      if (status.status === 'failed') {
        throw new Error(`Video generation failed: ${status.error_message || 'Unknown error'}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Video generation timed out after ${timeoutMs / 1000} seconds`);
  }

  /**
   * Check if adapter is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get estimated cost for a generation
   */
  estimateCost(model: PolloModel, durationSeconds: number): number {
    const modelInfo = POLLO_MODELS[model];
    if (!modelInfo) return 0;

    // Pollo uses 10 credits per 5-10 second video typically
    // Credits cost ~$0.01 each on Pro plan
    const clips = Math.ceil(durationSeconds / 10);
    return clips * modelInfo.credits * 0.01;
  }
}

// Singleton instance
let polloAdapter: PolloAdapter | null = null;

export function getPolloAdapter(apiKey?: string): PolloAdapter {
  if (!polloAdapter) {
    polloAdapter = new PolloAdapter(apiKey);
  }
  return polloAdapter;
}
