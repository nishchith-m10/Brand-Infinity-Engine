/**
 * Edge-compatible rate limiter using Upstash REST API
 * Uses sliding window algorithm via direct HTTP requests (no SDK)
 */

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit using Upstash REST API
 * @param identifier - Unique identifier for rate limiting (e.g., IP address, user ID)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit result with success status and metadata
 */
export async function ratelimitEdge(
  identifier: string,
  limit: number = 10,
  windowSeconds: number = 10
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[RateLimit] Missing Upstash credentials, allowing request');
    return { success: true, limit, remaining: limit, reset: Date.now() + windowSeconds * 1000 };
  }

  try {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const key = `ratelimit:${identifier}`;
    const windowStart = now - windowMs;

    // Use Upstash REST API pipeline for atomic operations
    // 1. Remove old entries outside the window
    // 2. Count current entries in window
    // 3. Add current timestamp if under limit
    // 4. Set expiry on key

    // First, get current count
    const countResponse = await fetch(`${url}/zcount/${key}/${windowStart}/${now}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!countResponse.ok) {
      throw new Error(`Upstash request failed: ${countResponse.status}`);
    }

    const countData = await countResponse.json();
    const currentCount = countData.result || 0;

    if (currentCount >= limit) {
      // Rate limit exceeded
      return {
        success: false,
        limit,
        remaining: 0,
        reset: now + windowMs,
      };
    }

    // Add current timestamp to sorted set
    await fetch(`${url}/zadd/${key}/${now}/${now}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Set expiry (2x window to be safe)
    await fetch(`${url}/expire/${key}/${windowSeconds * 2}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Clean up old entries (fire and forget)
    fetch(`${url}/zremrangebyscore/${key}/0/${windowStart}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {
      /* ignore cleanup errors */
    });

    return {
      success: true,
      limit,
      remaining: limit - currentCount - 1,
      reset: now + windowMs,
    };
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // Fail open to avoid blocking legitimate requests on errors
    return { success: true, limit, remaining: limit, reset: Date.now() + windowSeconds * 1000 };
  }
}
