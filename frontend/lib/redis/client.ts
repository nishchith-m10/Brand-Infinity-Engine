/**
 * Redis Client for Session Caching
 * Slice 3: Redis Integration
 */

import { Redis } from '@upstash/redis';

// Singleton Redis client
let redis: Redis | null = null;

/**
 * Get Redis client instance
 */
export function getRedisClient(): Redis | null {
  // Skip Redis if not configured (graceful degradation)
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('[Redis] Not configured - falling back to Postgres only');
    return null;
  }

  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redis;
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.ping();
    return true;
  } catch (error) {
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}

/**
 * Redis key prefixes
 */
export const REDIS_KEYS = {
  SESSION: (sessionId: string) => `session:${sessionId}`,
  SESSION_MESSAGES: (sessionId: string) => `messages:${sessionId}`,
  SESSION_STATS: (sessionId: string) => `stats:${sessionId}`,
  ACTIVE_SESSIONS: (userId: string) => `active:${userId}`,
  PENDING_QUESTIONS: (sessionId: string) => `questions:${sessionId}`,
  TASK_PLAN: (sessionId: string) => `plan:${sessionId}`,
} as const;

/**
 * Default TTL values (in seconds)
 */
export const REDIS_TTL = {
  SESSION: 3600, // 1 hour
  MESSAGES: 3600, // 1 hour
  STATS: 300, // 5 minutes
  ACTIVE_SESSIONS: 3600, // 1 hour
  QUESTIONS: 1800, // 30 minutes
  TASK_PLAN: 3600, // 1 hour
} as const;

