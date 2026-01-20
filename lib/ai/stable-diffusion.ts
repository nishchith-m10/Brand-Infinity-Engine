/**
 * Stable Diffusion / Stability AI Image Generation Adapter
 * Phase 10: Image Provider Integration
 * 
 * Provides image generation using Stability AI's API (SD3, SD3-Turbo, SDXL).
 * https://platform.stability.ai/docs/api-reference
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const STABILITY_BASE_URL = 'https://api.stability.ai';

// Available models and their specifications
const STABILITY_MODELS = {
  'sd3': {
    name: 'Stable Diffusion 3',
    endpoint: '/v2beta/stable-image/generate/sd3',
    costPerImage: 0.065,  // ~$0.065 per image
    description: 'Highest quality, best for complex prompts',
  },
  'sd3-turbo': {
    name: 'SD3 Turbo',
    endpoint: '/v2beta/stable-image/generate/sd3',
    costPerImage: 0.04,   // ~$0.04 per image
    description: 'Fast generation, good quality',
  },
  'core': {
    name: 'Stable Image Core (SDXL)',
    endpoint: '/v2beta/stable-image/generate/core',
    costPerImage: 0.03,   // ~$0.03 per image
    description: 'SDXL-based, balanced speed and quality',
  },
  'ultra': {
    name: 'Stable Image Ultra',
    endpoint: '/v2beta/stable-image/generate/ultra',
    costPerImage: 0.08,   // ~$0.08 per image
    description: 'Premium quality, cinematic results',
  },
} as const;

export type StabilityModel = keyof typeof STABILITY_MODELS;

export interface StabilityImageParams {
  prompt: string;
  negativePrompt?: string;
  model?: StabilityModel;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '21:9' | '9:21' | '4:3' | '3:4' | '5:4' | '4:5';
  seed?: number;
  outputFormat?: 'png' | 'jpeg' | 'webp';
  stylePreset?: string;  // e.g., 'photographic', 'anime', 'digital-art', 'cinematic'
}

export interface StabilityImageResult {
  imageBase64: string;
  imageUrl?: string;  // If we upload to storage
  contentType: string;
  model: string;
  seed: number;
  estimatedCost: number;
  generationTimeMs: number;
}

export class StabilityAdapter {
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
      this.apiKeyPromise = getEffectiveProviderKey('stability', process.env.STABILITY_API_KEY, userId);
    }
  }

  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await this.apiKeyPromise;
    }
    if (!this.apiKey) {
      throw new Error(
        'Stability AI API key not configured. Please add your key in Settings or set STABILITY_API_KEY environment variable.'
      );
    }
    return this.apiKey;
  }

  /**
   * Generate an image using Stable Diffusion
   */
  async generateImage(params: StabilityImageParams): Promise<StabilityImageResult> {
    const apiKey = await this.ensureApiKey();
    const startTime = Date.now();
    
    const model = params.model || 'core';
    const modelInfo = STABILITY_MODELS[model];
    
    if (!modelInfo) {
      throw new Error(`Unknown Stability AI model: ${model}`);
    }

    // Build form data for multipart request
    const formData = new FormData();
    formData.append('prompt', params.prompt);
    
    if (params.negativePrompt) {
      formData.append('negative_prompt', params.negativePrompt);
    }
    
    // For SD3/SD3-Turbo, specify the model variant
    if (model === 'sd3' || model === 'sd3-turbo') {
      formData.append('model', model);
    }
    
    formData.append('aspect_ratio', params.aspectRatio || '1:1');
    formData.append('output_format', params.outputFormat || 'png');
    
    if (params.seed !== undefined) {
      formData.append('seed', params.seed.toString());
    }
    
    if (params.stylePreset) {
      formData.append('style_preset', params.stylePreset);
    }

    const response = await fetch(`${STABILITY_BASE_URL}${modelInfo.endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Stability AI error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
        
        // Handle specific error codes
        if (response.status === 402) {
          errorMessage = 'Stability AI: Insufficient credits. Please add credits to your account.';
        } else if (response.status === 403) {
          errorMessage = 'Stability AI: Content moderation triggered. Please adjust your prompt.';
        }
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const generationTime = Date.now() - startTime;
    
    // Response contains base64 image
    const imageBase64 = data.image;
    const seed = data.seed || 0;
    
    const outputFormat = params.outputFormat || 'png';
    const contentType = outputFormat === 'jpeg' ? 'image/jpeg' : 
                        outputFormat === 'webp' ? 'image/webp' : 'image/png';

    return {
      imageBase64,
      contentType,
      model,
      seed,
      estimatedCost: modelInfo.costPerImage,
      generationTimeMs: generationTime,
    };
  }

  /**
   * Generate image and return as data URL for easy embedding
   */
  async generateImageDataUrl(params: StabilityImageParams): Promise<string> {
    const result = await this.generateImage(params);
    return `data:${result.contentType};base64,${result.imageBase64}`;
  }

  /**
   * Check available balance/credits
   */
  async getBalance(): Promise<{ credits: number }> {
    const apiKey = await this.ensureApiKey();
    
    const response = await fetch(`${STABILITY_BASE_URL}/v1/user/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Check if configured (sync check for UI)
   */
  isConfigured(): boolean {
    return !!this.apiKey || !!process.env.STABILITY_API_KEY;
  }

  /**
   * Get available models
   */
  static getAvailableModels(): typeof STABILITY_MODELS {
    return STABILITY_MODELS;
  }

  /**
   * Estimate cost for generation
   */
  static estimateCost(model: StabilityModel = 'core', count: number = 1): number {
    const modelInfo = STABILITY_MODELS[model];
    return modelInfo ? modelInfo.costPerImage * count : 0;
  }
}

/**
 * Factory function to create Stability adapter
 */
export function createStabilityAdapter(apiKey?: string, userId?: string): StabilityAdapter {
  return new StabilityAdapter(apiKey, userId);
}

/**
 * Convenience function for simple image generation
 */
export async function generateImageStableDiffusion(
  prompt: string,
  model: StabilityModel = 'core',
  userId?: string
): Promise<StabilityImageResult> {
  const adapter = createStabilityAdapter(undefined, userId);
  return adapter.generateImage({ prompt, model });
}

/**
 * Check if Stability AI is configured
 */
export function isStabilityConfigured(): boolean {
  return !!process.env.STABILITY_API_KEY;
}
