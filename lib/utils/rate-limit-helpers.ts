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

/**
 * Phase 3: Graceful rate limit handling for new requests when user has active generations
 * 
 * Instead of blocking, returns a user-friendly response suggesting to wait
 * for active generations to complete.
 */
export interface GracefulRateLimitResult {
  allowed: boolean;
  activeCount?: number;
  remainingCapacity?: number;
  waitTimeSeconds?: number;
  userMessage?: string;
}

/**
 * Check if a new generation can be started without interrupting active ones
 * Uses Redis to track active request count per user
 */
export async function checkGracefulRateLimit(
  userId: string,
  limiterType: keyof typeof rateLimiters = 'pipelineGeneration'
): Promise<GracefulRateLimitResult> {
  const limiter = rateLimiters[limiterType];
  
  try {
    // Check rate limit status without consuming
    const { success, limit, remaining, reset } = await limiter.limit(userId);
    
    if (success) {
      return {
        allowed: true,
        remainingCapacity: remaining,
      };
    }

    // Rate limited - provide graceful response
    const waitTimeSeconds = Math.ceil((reset - Date.now()) / 1000);
    
    return {
      allowed: false,
      waitTimeSeconds,
      userMessage: generateUserFriendlyMessage(limiterType, waitTimeSeconds),
    };
  } catch (error) {
    console.error('[RateLimit] Graceful check failed:', error);
    // Fail open
    return { allowed: true };
  }
}

/**
 * Generate user-friendly message based on rate limit type
 */
function generateUserFriendlyMessage(limiterType: string, waitSeconds: number): string {
  const messages: Record<string, string> = {
    videoGeneration: `Video generation is limited to prevent overloading. Please wait ${waitSeconds}s or let your current videos finish processing.`,
    imageGeneration: `Image generation has reached its limit. Please wait ${waitSeconds}s before creating more images.`,
    pipelineGeneration: `You have too many active content requests. Please wait ${waitSeconds}s or let current requests complete.`,
    directorChat: `Chat rate limit reached. Please wait ${waitSeconds}s before sending more messages.`,
    default: `Service is temporarily busy. Please try again in ${waitSeconds}s.`,
  };

  return messages[limiterType] || messages.default;
}

/**
 * Track active request for a user (increment)
 */
export async function trackActiveRequest(userId: string): Promise<number> {
  try {
    const key = `active_requests:${userId}`;
    const count = await redis.incr(key);
    // Auto-expire after 1 hour (safety valve)
    await redis.expire(key, 3600);
    return count;
  } catch (error) {
    console.error('[RateLimit] Failed to track active request:', error);
    return 0;
  }
}

/**
 * Release active request for a user (decrement)
 */
export async function releaseActiveRequest(userId: string): Promise<number> {
  try {
    const key = `active_requests:${userId}`;
    const count = await redis.decr(key);
    // Don't go below 0
    if (count < 0) {
      await redis.set(key, 0);
      return 0;
    }
    return count;
  } catch (error) {
    console.error('[RateLimit] Failed to release active request:', error);
    return 0;
  }
}

/**
 * Get current active request count for a user
 */
export async function getActiveRequestCount(userId: string): Promise<number> {
  try {
    const key = `active_requests:${userId}`;
    const count = await redis.get<number>(key);
    return count || 0;
  } catch (error) {
    console.error('[RateLimit] Failed to get active request count:', error);
    return 0;
  }
}

/**
 * Check if user has capacity for new requests
 */
export async function hasRequestCapacity(
  userId: string,
  maxConcurrent: number = 3
): Promise<{ hasCapacity: boolean; currentCount: number; maxAllowed: number }> {
  const currentCount = await getActiveRequestCount(userId);
  return {
    hasCapacity: currentCount < maxConcurrent,
    currentCount,
    maxAllowed: maxConcurrent,
  };
}

