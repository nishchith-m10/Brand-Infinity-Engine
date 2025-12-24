import { Redis } from '@upstash/redis';

// Initialize Upstash Redis client
// Get your credentials from https://console.upstash.com/
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache helper with TTL (time-to-live in seconds)
export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  // Try to get from cache
  const cached = await redis.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache with TTL
  await redis.set(key, data, { ex: ttlSeconds });

  return data;
}

// Invalidate cache by key
export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key);
}

// Invalidate multiple keys by pattern (use with caution)
export async function invalidateCachePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Cache keys enum for consistency
export const CacheKeys = {
  // Dashboard
  dashboardStats: 'dashboard:stats',
  dashboardActivity: 'dashboard:activity',
  
  // Campaigns
  campaigns: (userId: string) => `campaigns:${userId}`,
  campaign: (id: string) => `campaign:${id}`,
  
  // Videos
  videos: (userId: string) => `videos:${userId}`,
  video: (id: string) => `video:${id}`,
  
  // Analytics
  analytics: (userId: string, period: string) => `analytics:${userId}:${period}`,
  
  // Settings
  settings: (userId: string) => `settings:${userId}`,
} as const;

// TTL presets (in seconds)
export const CacheTTL = {
  SHORT: 30,        // 30 seconds - for rapidly changing data
  MEDIUM: 60 * 5,   // 5 minutes - for moderately changing data
  LONG: 60 * 30,    // 30 minutes - for slowly changing data
  HOUR: 60 * 60,    // 1 hour
  DAY: 60 * 60 * 24 // 24 hours - for static data
} as const;
