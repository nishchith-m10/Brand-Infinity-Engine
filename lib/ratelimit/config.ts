/**
 * Rate Limit Configuration
 * 
 * Centralized configuration for rate limiting on high-cost API routes.
 * Limits are based on operation cost and typical usage patterns.
 */

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Human-readable description */
  description?: string;
}

/**
 * Rate limit configurations for protected routes.
 * Keys should match the route identifier used in middleware.
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // LLM Streaming - expensive real-time operations
  'conversation/stream': {
    limit: 20,
    window: 60,
    description: 'LLM streaming operations',
  },

  // LLM Continuation - slightly less expensive than stream
  'conversation/continue': {
    limit: 30,
    window: 60,
    description: 'LLM conversation continuation',
  },

  // Image Generation - ~$0.04 per image with DALL-E
  'images': {
    limit: 10,
    window: 60,
    description: 'Image generation (DALL-E/Nano-B)',
  },

  // Creative Director Chat - LLM-powered
  'director': {
    limit: 30,
    window: 60,
    description: 'Creative director chat',
  },

  // Director Launch - Full production pipeline (very expensive)
  'director/launch': {
    limit: 3,
    window: 300,
    description: 'Production pipeline launch',
  },

  // Variant Generation - LLM-powered
  'variants': {
    limit: 10,
    window: 60,
    description: 'Variant generation',
  },

  // Content Requests - Triggers workflows
  'requests': {
    limit: 10,
    window: 60,
    description: 'Content request creation',
  },

  // Campaign Trigger - Starts full campaign execution
  'campaigns/trigger': {
    limit: 5,
    window: 300,
    description: 'Campaign trigger',
  },
};

/**
 * Get rate limit configuration for a route
 * @param routeKey - Route identifier
 * @returns Rate limit config or default if not found
 */
export function getRateLimitConfig(routeKey: string): RateLimitConfig {
  return RATE_LIMITS[routeKey] ?? { limit: 60, window: 60 };
}

/**
 * Check if rate limiting is globally disabled
 * @returns True if rate limiting should be bypassed
 */
export function isRateLimitDisabled(): boolean {
  return process.env.RATE_LIMIT_DISABLED === 'true';
}
