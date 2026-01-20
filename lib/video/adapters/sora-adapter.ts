/**
 * Sora Video Generation Adapter
 * Phase 10: Video Provider Integration
 * 
 * Implements OpenAI's Sora Video API.
 * 
 * Note: This adapter assumes the standard OpenAI Async API pattern for video generation.
 * As of early 2026, Sora access implies specialized endpoints.
 * 
 * Endpoints:
 * - POST https://api.openai.com/v1/videos/generations
 * - GET https://api.openai.com/v1/videos/generations/{id}
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

// Available models
const SORA_MODELS = {
  'sora-1.0': {
    name: 'Sora 1.0',
    costPerSecond: 0.10, // Estimated (high fidelity)
    maxDuration: 60,
    description: 'Cinematic realism, exact physics',
  },
  'sora-turbo': {
    name: 'Sora Turbo',
    costPerSecond: 0.05,
    maxDuration: 10,
    description: 'Faster generation for iteration',
  },
} as const;

export type SoraModel = keyof typeof SORA_MODELS;

export interface SoraVideoRequest {
  prompt: string;
  model?: SoraModel;
  size?: '1080x1920' | '1920x1080' | '1024x1024' | string;
  duration?: number; // seconds
  quality?: 'standard' | 'hd';
  responseFormat?: 'url' | 'b64_json';
}

export interface SoraGenerationResponse {
  id: string; // Task ID
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created: number;
  output?: {
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export class SoraAdapter {
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
      // Sora typically uses the main OpenAI API key
      this.apiKeyPromise = getEffectiveProviderKey('openai', process.env.OPENAI_API_KEY, userId);
    }
  }

  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await this.apiKeyPromise;
    }
    if (!this.apiKey) {
      throw new Error(
        'OpenAI API key not configured. Please add your OpenAI key in Settings to use Sora.'
      );
    }
    return this.apiKey;
  }

  /**
   * Create a video generation task
   */
  async createTask(request: SoraVideoRequest): Promise<SoraGenerationResponse> {
    const apiKey = await this.ensureApiKey();
    const model = request.model || 'sora-1.0';

    const payload = {
      model,
      prompt: request.prompt,
      size: request.size || '1920x1080',
      quality: request.quality || 'hd',
      response_format: request.responseFormat || 'url',
      // Duration might not be directly controllable in all versions, 
      // but passing it if API supports it (or handled via prompt revision)
    };

    const response = await fetch(`${OPENAI_API_BASE}/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Sora API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Some implementations return the result immediately if fast, 
    // or an ID for polling. We assume polling pattern for video.
    return {
      id: data.id,
      status: data.status || 'pending',
      created: data.created,
    };
  }

  /**
   * Check status of a generation task
   */
  async getTaskStatus(taskId: string): Promise<SoraGenerationResponse> {
    const apiKey = await this.ensureApiKey();

    const response = await fetch(`${OPENAI_API_BASE}/videos/generations/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sora status check failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Wait for completion with polling
   */
  async waitForCompletion(
    taskId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<SoraGenerationResponse> {
    const { timeoutMs = 600000, pollIntervalMs = 5000 } = options; // 10 min timeout, 5 sec poll
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getTaskStatus(taskId);

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'failed') {
        throw new Error(`Sora generation failed: ${status.error?.message || 'Unknown error'}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Sora generation timed out after ${timeoutMs / 1000} seconds`);
  }

  /**
   * Generate video and return result
   */
  async generateVideo(request: SoraVideoRequest): Promise<{
    videoUrl: string;
    taskId: string;
    model: string;
    estimatedCost: number;
    revisedPrompt?: string;
  }> {
    const model = request.model || 'sora-1.0';
    const duration = request.duration || 10; // Default guess if not strict
    
    const task = await this.createTask(request);
    
    // Wait for completion
    const completed = await this.waitForCompletion(task.id);
    
    const modelInfo = SORA_MODELS[model];
    const estimatedCost = modelInfo ? modelInfo.costPerSecond * duration : 0;

    return {
      videoUrl: completed.output?.url || '',
      taskId: task.id,
      model,
      estimatedCost,
      revisedPrompt: completed.output?.revised_prompt,
    };
  }

  /**
   * Check if configured
   */
  isConfigured(): boolean {
    return !!this.apiKey || !!process.env.OPENAI_API_KEY;
  }

  /**
   * Get available models
   */
  static getAvailableModels(): typeof SORA_MODELS {
    return SORA_MODELS;
  }
}

/**
 * Factory function
 */
export function createSoraAdapter(apiKey?: string, userId?: string): SoraAdapter {
  return new SoraAdapter(apiKey, userId);
}

/**
 * Get adapter instance
 */
export function getSoraAdapter(apiKey?: string, userId?: string): SoraAdapter {
  return new SoraAdapter(apiKey, userId);
}

/**
 * Check if Sora is configured (uses OpenAI key)
 */
export function isSoraConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
