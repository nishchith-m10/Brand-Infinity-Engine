/**
 * Client-side helper to send image generation requests with user Pollinations preferences
 * Automatically includes user's customized model settings from context
 */

import type { PollinationsPreferences } from '@/contexts/api-keys-context';

export interface GenerateImageRequest {
  prompt: string;
  model?: 'dalle-3' | 'nanob' | 'pollinations';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  campaign_id?: string;
  // Auto-populated from user preferences if model='pollinations'
  pollinations?: {
    imageModel?: 'flux' | 'flux-realism' | 'flux-anime' | 'flux-3d' | 'turbo';
    enhance?: boolean;
    nologo?: boolean;
  };
}

export interface GenerateImageResponse {
  success: boolean;
  url?: string;
  cost?: number;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Generate an image with automatic Pollinations preference injection
 * @param request - Image generation parameters
 * @param userPreferences - User's Pollinations preferences (from context)
 */
export async function generateImage(
  request: GenerateImageRequest,
  userPreferences?: PollinationsPreferences
): Promise<GenerateImageResponse> {
  // Auto-inject Pollinations preferences if using free provider
  if (request.model === 'pollinations' && userPreferences && !request.pollinations) {
    request.pollinations = {
      imageModel: userPreferences.imageModel,
      enhance: userPreferences.imageEnhance,
      nologo: userPreferences.imageNoLogo,
    };
  }

  const response = await fetch('/api/v1/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  return response.json();
}

/**
 * React hook example usage:
 * 
 * ```tsx
 * import { useApiKeys } from '@/contexts/api-keys-context';
 * import { generateImage } from '@/lib/client/image-client';
 * 
 * function MyComponent() {
 *   const { apiKeys } = useApiKeys();
 *   
 *   const handleGenerate = async () => {
 *     const result = await generateImage(
 *       {
 *         prompt: "A beautiful sunset",
 *         model: "pollinations", // Will use user's custom settings
 *       },
 *       apiKeys.pollinationsPreferences // Auto-injected
 *     );
 *     
 *     if (result.success) {
 *       console.log('Image URL:', result.url);
 *       console.log('Cost:', result.cost); // $0.00
 *     }
 *   };
 *   
 *   return <button onClick={handleGenerate}>Generate Image</button>;
 * }
 * ```
 */
