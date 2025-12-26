import OpenAI from 'openai';

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
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
 */
export async function generateImageDallE(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const startTime = Date.now();

  const response = await getOpenAI().images.generate({
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
