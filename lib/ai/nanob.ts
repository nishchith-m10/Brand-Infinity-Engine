/**
 * Nano B API Client
 * Fast, low-cost image generation
 * Adjust endpoint and params based on actual API documentation
 */

const NANOB_API_URL = process.env.NANOB_API_URL || 'https://api.nanob.ai';
const NANOB_API_KEY = process.env.NANOB_API_KEY;

export interface NanoBGenerationParams {
  prompt: string;
  aspect_ratio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  style?: string;
}

export interface NanoBGenerationResult {
  url: string;
  model: 'nanob';
  generation_time_ms: number;
}

/**
 * Generate an image using Nano B
 * Cost: Lower than DALL-E, faster generation
 */
export async function generateImageNanoB(
  params: NanoBGenerationParams
): Promise<NanoBGenerationResult> {
  if (!NANOB_API_KEY) {
    throw new Error('NANOB_API_KEY is not configured');
  }

  const startTime = Date.now();

  const response = await fetch(`${NANOB_API_URL}/v1/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NANOB_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: params.prompt,
      aspect_ratio: params.aspect_ratio || '1:1',
      style: params.style,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Nano B API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const generationTime = Date.now() - startTime;

  return {
    url: data.image_url || data.url,
    model: 'nanob',
    generation_time_ms: generationTime,
  };
}

/**
 * Check if Nano B is configured
 */
export function isNanoBConfigured(): boolean {
  return !!NANOB_API_KEY;
}
