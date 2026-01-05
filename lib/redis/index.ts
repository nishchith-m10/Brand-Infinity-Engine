/**
 * Redis Module Exports
 * Slice 3: Redis Integration
 */

// Client
export { getRedisClient, isRedisAvailable, REDIS_KEYS, REDIS_TTL } from './client';

// Session Cache
export {
  getCachedSession,
  setCachedSession,
  invalidateSessionCache,
  getCachedMessages,
  invalidateMessageCache,
  getCachedStats,
  invalidateStatsCache,
  getCachedQuestions,
  setCachedQuestions,
  clearCachedQuestions,
  getCachedTaskPlan,
  setCachedTaskPlan,
  clearCachedTaskPlan,
  invalidateSessionCaches,
} from './session-cache';

