/**
 * Session Cache Layer with Redis + Postgres Fallback
 * Slice 3: Redis Integration
 */

import { getRedisClient, REDIS_KEYS, REDIS_TTL } from './client';
import {
  getSession as dbGetSession,
  getSessionMessages as dbGetMessages,
  getSessionStats as dbGetStats,
} from '@/lib/conversation/queries';
import type {
  ConversationSession,
  ConversationMessage,
  ClarifyingQuestion,
} from '@/lib/agents/types';

// ============================================================================
// SESSION CACHING
// ============================================================================

/**
 * Get session from cache or DB
 */
export async function getCachedSession(
  sessionId: string
): Promise<{ session: ConversationSession | null; error: string | null }> {
  const redis = getRedisClient();

  // Try Redis first
  if (redis) {
    try {
      const cached = await redis.get<ConversationSession>(REDIS_KEYS.SESSION(sessionId));
      if (cached) {
        return { session: cached, error: null };
      }
    } catch (error) {
      console.error('[SessionCache] Redis get failed:', error);
      // Fall through to DB
    }
  }

  // Fallback to Postgres
  const { session, error } = await dbGetSession(sessionId);
  if (error || !session) {
    return { session: null, error };
  }

  // Cache for next time
  if (redis) {
    try {
      await redis.setex(REDIS_KEYS.SESSION(sessionId), REDIS_TTL.SESSION, session);
    } catch (error) {
      console.error('[SessionCache] Redis set failed:', error);
      // Don't fail the request, just log
    }
  }

  return { session, error: null };
}

/**
 * Update session in cache
 */
export async function setCachedSession(
  sessionId: string,
  session: ConversationSession
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(REDIS_KEYS.SESSION(sessionId), REDIS_TTL.SESSION, session);
  } catch (error) {
    console.error('[SessionCache] Failed to cache session:', error);
  }
}

/**
 * Invalidate session cache
 */
export async function invalidateSessionCache(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(REDIS_KEYS.SESSION(sessionId));
  } catch (error) {
    console.error('[SessionCache] Failed to invalidate:', error);
  }
}

// ============================================================================
// MESSAGE CACHING
// ============================================================================

/**
 * Get messages from cache or DB
 */
export async function getCachedMessages(
  sessionId: string,
  limit: number = 50
): Promise<{ messages: ConversationMessage[]; error: string | null }> {
  const redis = getRedisClient();

  // Try Redis first
  if (redis) {
    try {
      const cached = await redis.get<ConversationMessage[]>(
        REDIS_KEYS.SESSION_MESSAGES(sessionId)
      );
      if (cached) {
        return { messages: cached.slice(0, limit), error: null };
      }
    } catch (error) {
      console.error('[SessionCache] Redis get messages failed:', error);
    }
  }

  // Fallback to Postgres
  const { messages, error } = await dbGetMessages(sessionId, limit);
  if (error) {
    return { messages: [], error };
  }

  // Cache for next time
  if (redis && messages.length > 0) {
    try {
      await redis.setex(
        REDIS_KEYS.SESSION_MESSAGES(sessionId),
        REDIS_TTL.MESSAGES,
        messages
      );
    } catch (error) {
      console.error('[SessionCache] Failed to cache messages:', error);
    }
  }

  return { messages, error: null };
}

/**
 * Invalidate message cache (call after adding new message)
 */
export async function invalidateMessageCache(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(REDIS_KEYS.SESSION_MESSAGES(sessionId));
  } catch (error) {
    console.error('[SessionCache] Failed to invalidate messages:', error);
  }
}

// ============================================================================
// STATISTICS CACHING
// ============================================================================

/**
 * Get stats from cache or DB
 */
export async function getCachedStats(
  sessionId: string
): Promise<{
  stats: Array<{
    role: string;
    message_count: number;
    total_tokens: number;
    total_cost: number;
  }>;
  error: string | null;
}> {
  const redis = getRedisClient();

  // Try Redis first
  if (redis) {
    try {
      const cached = await redis.get(REDIS_KEYS.SESSION_STATS(sessionId));
      if (cached) {
        return { stats: cached as any, error: null };
      }
    } catch (error) {
      console.error('[SessionCache] Redis get stats failed:', error);
    }
  }

  // Fallback to Postgres
  const { stats, error } = await dbGetStats(sessionId);
  if (error) {
    return { stats: [], error };
  }

  // Cache with shorter TTL (stats change frequently)
  if (redis && stats.length > 0) {
    try {
      await redis.setex(
        REDIS_KEYS.SESSION_STATS(sessionId),
        REDIS_TTL.STATS,
        stats
      );
    } catch (error) {
      console.error('[SessionCache] Failed to cache stats:', error);
    }
  }

  return { stats, error: null };
}

/**
 * Invalidate stats cache (call after adding new message)
 */
export async function invalidateStatsCache(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(REDIS_KEYS.SESSION_STATS(sessionId));
  } catch (error) {
    console.error('[SessionCache] Failed to invalidate stats:', error);
  }
}

// ============================================================================
// PENDING QUESTIONS CACHING
// ============================================================================

/**
 * Get pending questions from cache
 */
export async function getCachedQuestions(
  sessionId: string
): Promise<ClarifyingQuestion[]> {
  const redis = getRedisClient();
  if (!redis) return [];

  try {
    const cached = await redis.get<ClarifyingQuestion[]>(
      REDIS_KEYS.PENDING_QUESTIONS(sessionId)
    );
    return cached || [];
  } catch (error) {
    console.error('[SessionCache] Failed to get questions:', error);
    return [];
  }
}

/**
 * Set pending questions in cache
 */
export async function setCachedQuestions(
  sessionId: string,
  questions: ClarifyingQuestion[]
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(
      REDIS_KEYS.PENDING_QUESTIONS(sessionId),
      REDIS_TTL.QUESTIONS,
      questions
    );
  } catch (error) {
    console.error('[SessionCache] Failed to cache questions:', error);
  }
}

/**
 * Clear pending questions from cache
 */
export async function clearCachedQuestions(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(REDIS_KEYS.PENDING_QUESTIONS(sessionId));
  } catch (error) {
    console.error('[SessionCache] Failed to clear questions:', error);
  }
}

// ============================================================================
// TASK PLAN CACHING
// ============================================================================

/**
 * Get task plan from cache
 */
export async function getCachedTaskPlan(sessionId: string): Promise<any | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    return await redis.get(REDIS_KEYS.TASK_PLAN(sessionId));
  } catch (error) {
    console.error('[SessionCache] Failed to get task plan:', error);
    return null;
  }
}

/**
 * Set task plan in cache
 */
export async function setCachedTaskPlan(
  sessionId: string,
  plan: any
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(REDIS_KEYS.TASK_PLAN(sessionId), REDIS_TTL.TASK_PLAN, plan);
  } catch (error) {
    console.error('[SessionCache] Failed to cache task plan:', error);
  }
}

/**
 * Clear task plan from cache
 */
export async function clearCachedTaskPlan(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(REDIS_KEYS.TASK_PLAN(sessionId));
  } catch (error) {
    console.error('[SessionCache] Failed to clear task plan:', error);
  }
}

// ============================================================================
// BULK INVALIDATION
// ============================================================================

/**
 * Invalidate all cache for a session (call on session update)
 */
export async function invalidateSessionCaches(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(
      REDIS_KEYS.SESSION(sessionId),
      REDIS_KEYS.SESSION_MESSAGES(sessionId),
      REDIS_KEYS.SESSION_STATS(sessionId),
      REDIS_KEYS.PENDING_QUESTIONS(sessionId),
      REDIS_KEYS.TASK_PLAN(sessionId)
    );
  } catch (error) {
    console.error('[SessionCache] Failed to invalidate all caches:', error);
  }
}

