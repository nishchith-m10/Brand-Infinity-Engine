import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Validate Redis environment variables
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('[Redis] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables are required');
}

// Create a new ratelimiter, that will be reused across requests
// General API rate limit: 10 requests per 10 seconds per IP
export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
  prefix: '@upstash/ratelimit',
});
