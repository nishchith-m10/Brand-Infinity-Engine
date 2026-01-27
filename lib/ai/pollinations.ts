/**
 * Pollinations.ai Integration
 * Free AI generation (no API key required)
 * https://pollinations.ai/play
 */

export interface PollinationsImageParams {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  model?: 'flux' | 'flux-realism' | 'flux-anime' | 'flux-3d' | 'turbo';
  nologo?: boolean;
  enhance?: boolean;
}

export interface PollinationsVideoParams {
  prompt: string;
  model?: 'mochi';
  duration?: number;
  fps?: number;
}

export interface PollinationsImageResult {
  url: string;
  prompt: string;
  seed?: number;
  width: number;
  height: number;
}

export interface PollinationsVideoResult {
  url: string;
  prompt: string;
  duration: number;
}

/**
 * Generate image using Pollinations.ai (FREE)
 * No API key required - direct URL-based generation
 */
export async function generateImagePollinations(
  params: PollinationsImageParams
): Promise<PollinationsImageResult> {
  const {
    prompt,
    width = 1024,
    height = 1024,
    seed,
    model, 
    nologo = true,
    enhance = false,
  } = params;

  // Pollinations uses URL-based generation
  const encodedPrompt = encodeURIComponent(prompt);
  const queryParams = new URLSearchParams({
    width: width.toString(),
    height: height.toString(),
    nologo: nologo.toString(),
    enhance: enhance.toString(),
    ...(model && { model }), 
    ...(seed && { seed: seed.toString() }),
  });

  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${queryParams.toString()}`;

  // Verify image is accessible and valid
  try {
    // We use GET to ensure we get the content-length or the body itself
    // HEAD requests sometimes omit content-length on dynamic/cached images
    const response = await fetch(imageUrl, { 
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Pollinations image generation failed: ${response.status}`);
    }

    // ROBUSTNESS CHECK: Validate image size
    const blob = await response.blob();
    const size = blob.size;
    
    // We previously set this to 100KB, but some valid compressed images (or error placeholders)
    // might be smaller. To be safe and avoid blocking "potentially" valid content (as per user logs showing 43KB),
    // we lower the threshold to catch only truly empty/broken generations.
    if (size < 1024) { // 1KB limit - catches 0-byte or empty headers
      throw new Error(`Pollinations returned an abnormally small image (${size} bytes). This usually indicates a generation failure.`);
    }

  } catch (error) {
    throw new Error(`Failed to generate image with Pollinations: ${error}`);
  }

  return {
    url: imageUrl,
    prompt,
    seed,
    width,
    height,
  };
}

/**
 * Generate video using Pollinations.ai (FREE)
 * No API key required
 */
export async function generateVideoPollinations(
  params: PollinationsVideoParams
): Promise<PollinationsVideoResult> {
  const {
    prompt,
    model = 'mochi',
    duration = 5,
    fps = 24,
  } = params;

  const encodedPrompt = encodeURIComponent(prompt);
  const videoUrl = `https://video.pollinations.ai/video/${encodedPrompt}?model=${model}&duration=${duration}&fps=${fps}`;

  // Note: Pollinations video generation is async, URL may take time to resolve
  // For production, you'd want to poll or use webhooks
  return {
    url: videoUrl,
    prompt,
    duration,
  };
}

/**
 * Generate text-to-speech using Pollinations.ai (FREE)
 * Returns audio URL
 */
export async function generateTTSPollinations(
  text: string,
  voice: string = 'alloy'
): Promise<{ url: string; text: string }> {
  const encodedText = encodeURIComponent(text);
  const audioUrl = `https://text.pollinations.ai/${encodedText}?voice=${voice}`;

  return {
    url: audioUrl,
    text,
  };
}

/**
 * Cost calculator for Pollinations (always free)
 */
export function getPollinationsCost(): number {
  return 0; // Free tier
}

/**
 * Check if Pollinations is available (no auth required)
 */
export function isPollinationsAvailable(): boolean {
  return true; // Always available, no API key needed
}
