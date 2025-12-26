/**
 * Rate Limiting Utilities
 * Slice 9: Production Hardening
 */

import { Ratelimit } from '@upstash/ratelimit';
import { getRedisClient } from '../redis/client';

/**
 * Rate limiters for different endpoints
 */
export const rateLimiters = {
  // Conversation start: 10 requests per minute per user
  conversationStart: () => {
    const redis = getRedisClient();
    if (!redis) return null;

    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'ratelimit:conversation:start',
    });
  },

  // Conversation continue: 30 requests per minute per user
  conversationContinue: () => {
    const redis = getRedisClient();
    if (!redis) return null;

    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: 'ratelimit:conversation:continue',
    });
  },

  // LLM calls: 100 requests per minute per user
  llmCalls: () => {
    const redis = getRedisClient();
    if (!redis) return null;

    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'ratelimit:llm',
    });
  },

  // Task execution: 20 per minute per user
  taskExecution: () => {
    const redis = getRedisClient();
    if (!redis) return null;

    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      analytics: true,
      prefix: 'ratelimit:task',
    });
  },
};

/**
 * Apply rate limit to a request
 */
export async function applyRateLimit(
  identifier: string,
  limiterType: keyof typeof rateLimiters
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const limiter = rateLimiters[limiterType]();

  if (!limiter) {
    // No rate limiting if Redis is not available
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    };
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  return {
    success,
    limit,
    remaining,
    reset,
  };
}

/**
 * Rate limit middleware for API routes
 */
export function createRateLimitMiddleware(limiterType: keyof typeof rateLimiters) {
  return async (identifier: string) => {
    const result = await applyRateLimit(identifier, limiterType);

    if (!result.success) {
      return {
        rateLimited: true,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.reset.toString(),
          'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
        },
      };
    }

    return {
      rateLimited: false,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toString(),
      },
    };
  };
}

