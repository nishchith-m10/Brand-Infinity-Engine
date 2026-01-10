import OpenAI from 'openai';
import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

async function getOpenAI(): Promise<OpenAI> {
  const apiKey = await getEffectiveProviderKey('openai', process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({ apiKey });
}

export interface ImageGenerationParams {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}

export interface ImageGenerationResult {
  url: string;
  revised_prompt: string;
  model: 'dall-e-3';
  generation_time_ms: number;
}

/**
 * Generate an image using DALL-E 3
 * Cost: ~$0.04 (standard) or ~$0.08 (HD) per image
 *
 * Dev/test behavior:
 * - If IMAGE_GEN_MODE=mock (and NODE_ENV !== 'production'), the function will
 *   return simulated responses or simulated errors based on
 *   IMAGE_GEN_SIMULATE_ERROR and IMAGE_GEN_SIMULATE_DELAY_MS.
 * - This is intended for local testing only; using mock in production will
 *   throw an error to prevent accidental use.
 */
export async function generateImageDallE(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const startTime = Date.now();

  const mode = process.env.IMAGE_GEN_MODE || 'openai';
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Safety: do not allow mock mode in production
  if (mode === 'mock' && nodeEnv === 'production') {
    throw new Error('IMAGE_GEN_MODE=mock is not allowed in production');
  }

  // Dev/test mock path
  if (mode === 'mock') {
    const simulateError = (process.env.IMAGE_GEN_SIMULATE_ERROR || 'none').toLowerCase();
    const delayMs = Number(process.env.IMAGE_GEN_SIMULATE_DELAY_MS || 0);

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    // Simulate errors for testing budget/refund and failure handling
    if (simulateError === 'billing') {
      const err: any = new Error('Billing hard limit has been reached (simulated)');
      // mimic provider-style error code for easier handling in logs/tests
      err.code = 'billing_hard_limit_reached';
      err.status = 403;
      throw err;
    }

    if (simulateError === 'provider') {
      const err: any = new Error('Provider error (simulated)');
      err.status = 500;
      throw err;
    }

    // Success: return a deterministic mock image result
    const generationTime = Date.now() - startTime;
    return {
      url: 'https://example.com/mock-image.png',
      revised_prompt: params.prompt,
      model: 'dall-e-3',
      generation_time_ms: generationTime,
    };
  }

  // Real provider path
  const openai = await getOpenAI();
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: params.prompt,
    n: 1,
    size: params.size || '1024x1024',
    quality: params.quality || 'standard',
    style: params.style || 'vivid',
  });

  const generationTime = Date.now() - startTime;
  const imageData = response.data?.[0];

  if (!imageData?.url) {
    throw new Error('No image URL returned from DALL-E');
  }

  return {
    url: imageData.url,
    revised_prompt: imageData.revised_prompt || params.prompt,
    model: 'dall-e-3',
    generation_time_ms: generationTime,
  };
}

/**
 * Get cost estimate for DALL-E 3 generation
 */
export function getDallECost(quality: 'standard' | 'hd', size: string): number {
  if (quality === 'hd') {
    return size === '1024x1024' ? 0.08 : 0.12;
  }
  return size === '1024x1024' ? 0.04 : 0.08;
}
