/**
 * Rate Limiting Helpers for Expensive API Routes
 * Provides per-user rate limiting for costly operations
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Initialize Redis client
const redis = Redis.fromEnv();

// Different rate limiters for different cost levels
export const rateLimiters = {
  // For expensive operations like DALL-E image generation
  imageGeneration: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
    analytics: true,
    prefix: 'ratelimit:image-gen',
  }),

  // For GPT-4 streaming (director chat and conversation stream)
  directorChat: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
    analytics: true,
    prefix: 'ratelimit:director-chat',
  }),

  // For conversation continue (less expensive than streaming)
  conversationContinue: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
    analytics: true,
    prefix: 'ratelimit:conversation-continue',
  }),

  // For n8n workflow triggers
  pipelineGeneration: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
    analytics: true,
    prefix: 'ratelimit:pipeline-gen',
  }),

  // For video generation (most expensive operation)
  videoGeneration: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '5 m'), // 5 requests per 5 minutes
    analytics: true,
    prefix: 'ratelimit:video-gen',
  }),

  // For video assembly (uses FFmpeg resources)
  videoAssembly: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '5 m'), // 10 requests per 5 minutes
    analytics: true,
    prefix: 'ratelimit:video-assembly',
  }),

  // For brief generation (uses LLM)
  briefGeneration: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
    analytics: true,
    prefix: 'ratelimit:brief-gen',
  }),

  // For script generation (uses LLM)
  scriptGeneration: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
    analytics: true,
    prefix: 'ratelimit:script-gen',
  }),
};

/**
 * Check rate limit and return appropriate response if exceeded
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<NextResponse | null> {
  // Check for emergency bypass
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    console.warn('[RateLimit] ⚠️ Rate limiting disabled via RATE_LIMIT_DISABLED flag');
    return null;
  }

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. Try again in ${Math.ceil((reset - Date.now()) / 1000)} seconds.`,
            limit,
            remaining,
            reset: new Date(reset).toISOString(),
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      );
    }

    return null; // Rate limit not exceeded
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // On rate limiter failure, allow request to proceed (fail open)
    return null;
  }
}
