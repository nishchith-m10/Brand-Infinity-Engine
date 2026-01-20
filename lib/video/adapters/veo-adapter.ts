/**
 * Veo 3 Video Generation Adapter
 * Phase 10: Video Provider Integration
 * 
 * Implements Google's Veo (Gemini Video) API for high-quality video generation.
 * Uses the Gemini API infrastructure with async operation pattern.
 * 
 * Prerequisites:
 * - Google AI API key (GEMINI_API_KEY)
 * - Veo API access enabled in Google AI Studio
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Available models
const VEO_MODELS = {
  'veo-2': {
    name: 'Veo 2',
    costPerSecond: 0.08,
    maxDuration: 8,
    description: 'Second generation, photorealistic',
  },
  'veo-3': {
    name: 'Veo 3',
    costPerSecond: 0.12,
    maxDuration: 16,
    description: 'Latest, native audio support, cinematic quality',
  },
  'veo-3-fast': {
    name: 'Veo 3 Fast',
    costPerSecond: 0.06,
    maxDuration: 10,
    description: 'Optimized for speed',
  },
} as const;

export type VeoModel = keyof typeof VEO_MODELS;

export interface VeoVideoRequest {
  prompt: string;
  model?: VeoModel;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  duration?: number;
  negativePrompt?: string;
  seed?: number;
  generateAudio?: boolean; // Veo 3 native audio
}

export interface VeoOperationResponse {
  name: string; // Operation ID
  done: boolean;
  metadata?: {
    createTime: string;
    updateTime: string;
  };
  response?: {
    generatedVideos: Array<{
      video: {
        uri?: string;
        bytesBase64Encoded?: string;
      };
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

export class VeoAdapter {
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
      // Veo uses Gemini API key
      this.apiKeyPromise = getEffectiveProviderKey('veo', process.env.GEMINI_API_KEY, userId);
    }
  }

  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await this.apiKeyPromise;
    }
    if (!this.apiKey) {
      throw new Error(
        'Gemini API key not configured. Please add your Gemini key in Settings to use Veo.'
      );
    }
    return this.apiKey;
  }

  /**
   * Start video generation (returns operation for polling)
   */
  async createOperation(request: VeoVideoRequest): Promise<string> {
    const apiKey = await this.ensureApiKey();
    const model = request.model || 'veo-3';

    const payload: Record<string, unknown> = {
      instances: [
        {
          prompt: request.prompt,
        },
      ],
      parameters: {
        aspectRatio: request.aspectRatio || '16:9',
        personGeneration: 'allow_adult', // Default for brand content
      },
    };

    if (request.negativePrompt) {
      (payload.instances as Array<Record<string, unknown>>)[0].negativePrompt = request.negativePrompt;
    }

    if (request.seed !== undefined) {
      (payload.parameters as Record<string, unknown>).seed = request.seed;
    }

    if (request.generateAudio && model === 'veo-3') {
      (payload.parameters as Record<string, unknown>).includeRaiReason = true;
      (payload.parameters as Record<string, unknown>).generateAudio = true;
    }

    const response = await fetch(
      `${GEMINI_API_BASE}/models/${model}:predictLongRunning?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Veo API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.name; // Operation ID
  }

  /**
   * Check operation status
   */
  async getOperationStatus(operationName: string): Promise<VeoOperationResponse> {
    const apiKey = await this.ensureApiKey();

    const response = await fetch(
      `${GEMINI_API_BASE}/${operationName}?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Veo status check failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Wait for operation completion with polling
   */
  async waitForCompletion(
    operationName: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<VeoOperationResponse> {
    const { timeoutMs = 600000, pollIntervalMs = 5000 } = options; // 10 min timeout, 5 sec poll
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getOperationStatus(operationName);

      if (status.done) {
        if (status.error) {
          throw new Error(`Veo generation failed: ${status.error.message}`);
        }
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Veo generation timed out after ${timeoutMs / 1000} seconds`);
  }

  /**
   * Generate video and return result
   */
  async generateVideo(request: VeoVideoRequest): Promise<{
    videoUrl: string;
    operationId: string;
    model: string;
    estimatedCost: number;
  }> {
    const model = request.model || 'veo-3';
    const duration = request.duration || 5;
    
    const operationName = await this.createOperation(request);
    const completed = await this.waitForCompletion(operationName);
    
    const videoUri = completed.response?.generatedVideos?.[0]?.video?.uri || '';
    
    const modelInfo = VEO_MODELS[model];
    const estimatedCost = modelInfo ? modelInfo.costPerSecond * duration : 0;

    return {
      videoUrl: videoUri,
      operationId: operationName,
      model,
      estimatedCost,
    };
  }

  /**
   * Check if configured
   */
  isConfigured(): boolean {
    return !!this.apiKey || !!process.env.GEMINI_API_KEY;
  }

  /**
   * Get available models
   */
  static getAvailableModels(): typeof VEO_MODELS {
    return VEO_MODELS;
  }

  /**
   * Estimate cost
   */
  static estimateCost(model: VeoModel = 'veo-3', durationSeconds: number = 5): number {
    const modelInfo = VEO_MODELS[model];
    return modelInfo ? modelInfo.costPerSecond * durationSeconds : 0;
  }
}

/**
 * Factory function
 */
export function createVeoAdapter(apiKey?: string, userId?: string): VeoAdapter {
  return new VeoAdapter(apiKey, userId);
}

/**
 * Get adapter instance
 */
export function getVeoAdapter(apiKey?: string, userId?: string): VeoAdapter {
  return new VeoAdapter(apiKey, userId);
}

/**
 * Check if Veo is configured (uses Gemini key)
 */
export function isVeoConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
