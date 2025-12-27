/**
 * Vision-Enabled Chat Utilities
 * 
 * Helpers for creating chat messages that include images
 * Compatible with OpenAI GPT-4o (vision), GPT-4-vision-preview, and similar models
 */

import type { BrandContext } from './rag';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<TextContent | ImageContent>;
};

export type TextContent = {
  type: 'text';
  text: string;
};

export type ImageContent = {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
};

/**
 * Create a chat message with brand images included
 * 
 * @example
 * const message = createVisionMessage(
 *   "Create a campaign using our brand colors",
 *   brandContext
 * );
 */
export function createVisionMessage(
  userPrompt: string,
  brandContext: BrandContext | null,
  options: {
    /** Image detail level - affects token cost */
    imageDetail?: 'auto' | 'low' | 'high';
    /** Max images to include (to control costs) */
    maxImages?: number;
  } = {}
): ChatMessage {
  const { imageDetail = 'auto', maxImages = 5 } = options;

  // If no images available, return simple text message
  if (!brandContext?.image_urls || brandContext.image_urls.length === 0) {
    return {
      role: 'user',
      content: userPrompt,
    };
  }

  // Build content array with text + images
  const content: Array<TextContent | ImageContent> = [
    { type: 'text', text: userPrompt },
  ];

  // Add images (limited by maxImages)
  const imagesToInclude = brandContext.image_urls.slice(0, maxImages);
  for (const img of imagesToInclude) {
    content.push({
      type: 'image_url',
      image_url: {
        url: img.url,
        detail: imageDetail,
      },
    });
  }

  return {
    role: 'user',
    content,
  };
}

/**
 * Build a system prompt that references available brand assets
 */
export function buildSystemPromptWithAssets(
  basePrompt: string,
  brandContext: BrandContext | null
): string {
  if (!brandContext) return basePrompt;

  const assetInfo: string[] = [];

  if (brandContext.image_urls?.length) {
    assetInfo.push(
      `\n\nYou have access to ${brandContext.image_urls.length} brand image(s):`
    );
    for (const img of brandContext.image_urls) {
      assetInfo.push(`- ${img.file_name} (${img.type})`);
    }
    assetInfo.push(
      '\nAnalyze these images and incorporate visual elements into your response.'
    );
  }

  if (brandContext.brand_voice) {
    assetInfo.push(`\n\nBrand Voice: ${brandContext.brand_voice}`);
  }

  if (brandContext.primary_colors?.length) {
    assetInfo.push(
      `\nBrand Colors: ${brandContext.primary_colors.join(', ')}`
    );
  }

  if (brandContext.assets?.length) {
    assetInfo.push(`\n\nBrand Guidelines Summary:`);
    for (const asset of brandContext.assets) {
      if (asset.asset_type === 'guideline' && asset.content) {
        assetInfo.push(
          `\n${asset.file_name}:\n${asset.content.substring(0, 300)}...`
        );
      }
    }
  }

  return basePrompt + assetInfo.join('');
}

/**
 * Estimate token cost for vision API calls
 * 
 * Based on OpenAI pricing:
 * - Text: ~$0.01/1K tokens (GPT-4o)
 * - Images (low detail): 85 tokens
 * - Images (high detail): 170 tokens + (tiles * 85)
 */
export function estimateVisionTokens(
  textLength: number,
  imageCount: number,
  imageDetail: 'auto' | 'low' | 'high' = 'auto'
): number {
  // Rough estimate: 4 chars per token for text
  const textTokens = Math.ceil(textLength / 4);

  // Image tokens depend on detail level
  let imageTokens = 0;
  if (imageDetail === 'low') {
    imageTokens = imageCount * 85;
  } else if (imageDetail === 'high') {
    // High detail: base 85 + (tiles * 85)
    // Average 4 tiles per image
    imageTokens = imageCount * (85 + 4 * 85);
  } else {
    // Auto: assume medium complexity (3 tiles avg)
    imageTokens = imageCount * (85 + 3 * 85);
  }

  return textTokens + imageTokens;
}

/**
 * Check if a model supports vision
 */
export function supportsVision(modelId: string): boolean {
  const visionModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-vision-preview',
    'gpt-4-turbo',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
    'gemini-pro-vision',
  ];

  return visionModels.some((vm) => modelId.includes(vm));
}
