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

  // For GPT-4 streaming (director chat)
  directorChat: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 requests per minute
    analytics: true,
    prefix: 'ratelimit:director-chat',
  }),

  // For n8n workflow triggers
  pipelineGeneration: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
    analytics: true,
    prefix: 'ratelimit:pipeline-gen',
  }),
};

/**
 * Check rate limit and return appropriate response if exceeded
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<NextResponse | null> {
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
