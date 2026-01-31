/**
 * Rate Limit Middleware
 * 
 * Reusable rate limiting middleware for high-cost API routes.
 * Uses the existing Upstash Redis-based rate limiter.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ratelimitEdge } from '@/lib/ratelimit-edge';
import { getRateLimitConfig, isRateLimitDisabled } from './config';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Extract the user identifier for rate limiting.
 * Attempts to get user ID from session, falls back to IP.
 * 
 * @param request - The incoming request
 * @returns User identifier string
 */
export function extractIdentifier(request: NextRequest): string {
  // Try to get user ID from authorization header or cookie
  // For now, we primarily use IP since session extraction requires async context
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  
  return ip;
}

/**
 * Check rate limit for a route
 * 
 * @param request - The incoming request
 * @param routeKey - Route identifier for config lookup
 * @returns Rate limit result
 */
export async function checkRateLimit(
  request: NextRequest,
  routeKey: string
): Promise<RateLimitResult> {
  // Check if rate limiting is disabled globally
  if (isRateLimitDisabled()) {
    console.warn(`[RateLimit] ⚠️ Rate limiting disabled for ${routeKey}`);
    return { success: true, limit: 999, remaining: 999, reset: Date.now() + 60000 };
  }

  const config = getRateLimitConfig(routeKey);
  const identifier = extractIdentifier(request);
  const key = `${routeKey}:${identifier}`;

  const result = await ratelimitEdge(key, config.limit, config.window);

  if (!result.success) {
    console.warn(`[RateLimit] Rate limit exceeded for ${routeKey}`, {
      identifier,
      limit: result.limit,
      remaining: result.remaining,
    });
  }

  return result;
}

/**
 * Create rate limit headers for the response
 * 
 * @param result - Rate limit check result
 * @returns Headers to add to the response
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(Math.floor(result.reset / 1000)),
  };
}

/**
 * Create a 429 Too Many Requests response
 * 
 * @param result - Rate limit check result
 * @param routeKey - Route identifier for error message
 * @returns NextResponse with 429 status
 */
export function rateLimitResponse(
  result: RateLimitResult,
  routeKey: string
): NextResponse {
  const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please retry after ${retryAfter} seconds.`,
        retryAfter,
      },
    },
    {
      status: 429,
      headers: {
        ...createRateLimitHeaders(result),
        'Retry-After': String(retryAfter),
      },
    }
  );
}

/**
 * Add rate limit headers to an existing response
 * 
 * @param response - The response to add headers to
 * @param result - Rate limit check result
 * @returns Response with rate limit headers
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  const headers = createRateLimitHeaders(result);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
