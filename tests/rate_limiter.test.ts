/**
 * Rate Limiter Tests
 * 
 * Tests for Redis-based sliding window rate limiting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import { RateLimiter, RATE_LIMIT_PRESETS } from '../utils/rate_limiter';

describe('RateLimiter', () => {
  let redis: InstanceType<typeof RedisMock>;
  let limiter: RateLimiter;

  beforeEach(() => {
    redis = new RedisMock();
  });

  afterEach(async () => {
    await redis.flushall();
    await redis.quit();
  });

  // ===========================================================================
  // Basic Rate Limiting Tests
  // ===========================================================================

  describe('check - basic functionality', () => {
    it('should allow requests under the limit', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 5, windowSecs: 60 });

      const result = await limiter.check('user123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('should track multiple requests from same identifier', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 3, windowSecs: 60 });

      const result1 = await limiter.check('user123');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = await limiter.check('user123');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = await limiter.check('user123');
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it('should block requests exceeding the limit', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 2, windowSecs: 60 });

      await limiter.check('user123');
      await limiter.check('user123');

      const result = await limiter.check('user123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSecs).toBeGreaterThan(0);
    });

    it('should isolate limits per identifier', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 2, windowSecs: 60 });

      await limiter.check('user1');
      await limiter.check('user1');

      const user1Result = await limiter.check('user1');
      expect(user1Result.allowed).toBe(false);

      // User2 should still have full quota
      const user2Result = await limiter.check('user2');
      expect(user2Result.allowed).toBe(true);
      expect(user2Result.remaining).toBe(1);
    });
  });

  // ===========================================================================
  // Preset Configuration Tests
  // ===========================================================================

  describe('RATE_LIMIT_PRESETS', () => {
    it('should have correct standard preset', () => {
      expect(RATE_LIMIT_PRESETS.standard).toEqual({
        maxRequests: 100,
        windowSecs: 60,
      });
    });

    it('should have correct strict preset', () => {
      expect(RATE_LIMIT_PRESETS.strict).toEqual({
        maxRequests: 10,
        windowSecs: 60,
      });
    });

    it('should have correct lenient preset', () => {
      expect(RATE_LIMIT_PRESETS.lenient).toEqual({
        maxRequests: 500,
        windowSecs: 60,
      });
    });

    it('should have correct burst preset', () => {
      expect(RATE_LIMIT_PRESETS.burst).toEqual({
        maxRequests: 20,
        windowSecs: 10,
      });
    });

    it('should have correct daily preset', () => {
      expect(RATE_LIMIT_PRESETS.daily).toEqual({
        maxRequests: 1000,
        windowSecs: 86400,
      });
    });
  });

  describe('preset usage', () => {
    it('should work with standard preset', async () => {
      limiter = new RateLimiter(redis as any, RATE_LIMIT_PRESETS.standard);

      const result = await limiter.check('user123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('should work with strict preset', async () => {
      limiter = new RateLimiter(redis as any, RATE_LIMIT_PRESETS.strict);

      const result = await limiter.check('user123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });

  // ===========================================================================
  // Sliding Window Tests
  // ===========================================================================

  describe('sliding window algorithm', () => {
    it('should remove expired entries from window', async () => {
      // Use a 1-second window for testing
      limiter = new RateLimiter(redis as any, { maxRequests: 2, windowSecs: 1 });

      await limiter.check('user123');
      await limiter.check('user123');

      // Should be blocked
      let result = await limiter.check('user123');
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be allowed again
      result = await limiter.check('user123');
      expect(result.allowed).toBe(true);
    });

    it('should calculate correct retry-after time', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 1, windowSecs: 60 });

      await limiter.check('user123');
      const result = await limiter.check('user123');

      expect(result.allowed).toBe(false);
      expect(result.retryAfterSecs).toBeGreaterThan(0);
      expect(result.retryAfterSecs).toBeLessThanOrEqual(60);
    });
  });

  // ===========================================================================
  // Reset Tests
  // ===========================================================================

  describe('reset', () => {
    it('should clear rate limit for identifier', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 2, windowSecs: 60 });

      await limiter.check('user123');
      await limiter.check('user123');

      let result = await limiter.check('user123');
      expect(result.allowed).toBe(false);

      // Reset
      await limiter.reset('user123');

      result = await limiter.check('user123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should only reset specific identifier', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 1, windowSecs: 60 });

      await limiter.check('user1');
      await limiter.check('user2');

      await limiter.reset('user1');

      const user1Result = await limiter.check('user1');
      expect(user1Result.allowed).toBe(true);

      const user2Result = await limiter.check('user2');
      expect(user2Result.allowed).toBe(false);
    });
  });

  // ===========================================================================
  // Usage Tracking Tests
  // ===========================================================================

  describe('getUsage', () => {
    it('should return current usage for identifier', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 5, windowSecs: 60 });

      await limiter.check('user123');
      await limiter.check('user123');

      const usage = await limiter.getUsage('user123');

      expect(usage.used).toBe(2);
      expect(usage.limit).toBe(5);
      expect(usage.remaining).toBe(3);
    });

    it('should return zero usage for new identifier', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 10, windowSecs: 60 });

      const usage = await limiter.getUsage('new-user');

      expect(usage.used).toBe(0);
      expect(usage.limit).toBe(10);
      expect(usage.remaining).toBe(10);
    });

    it('should reflect expired entries', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 5, windowSecs: 1 });

      await limiter.check('user123');
      await limiter.check('user123');

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const usage = await limiter.getUsage('user123');
      expect(usage.used).toBe(0);
      expect(usage.remaining).toBe(5);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('redis failure handling', () => {
    it('should fail open when redis is unavailable', async () => {
      // Create limiter with broken redis
      const brokenRedis = new RedisMock();
      await brokenRedis.quit(); // Disconnect redis

      limiter = new RateLimiter(brokenRedis as any, { maxRequests: 1, windowSecs: 60 });

      // Should still allow requests (fail-open)
      const result = await limiter.check('user123');
      expect(result.allowed).toBe(true);
    });
  });

  // ===========================================================================
  // Custom Key Prefix Tests
  // ===========================================================================

  describe('custom key prefix', () => {
    it('should use custom key prefix', async () => {
      limiter = new RateLimiter(redis as any, {
        maxRequests: 5,
        windowSecs: 60,
        keyPrefix: 'custom-prefix',
      });

      await limiter.check('user123');

      // Check that key exists with custom prefix
      const keys = await redis.keys('custom-prefix:*');
      expect(keys.length).toBeGreaterThan(0);
      expect(keys[0]).toContain('custom-prefix');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle very short time windows', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 2, windowSecs: 1 });

      const result1 = await limiter.check('user123');
      const result2 = await limiter.check('user123');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it('should handle very large limits', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 10000, windowSecs: 60 });

      const result = await limiter.check('user123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9999);
    });

    it('should handle concurrent requests', async () => {
      limiter = new RateLimiter(redis as any, { maxRequests: 10, windowSecs: 60 });

      const promises = Array.from({ length: 5 }, () => limiter.check('user123'));
      const results = await Promise.all(promises);

      const allowed = results.filter(r => r.allowed).length;
      expect(allowed).toBe(5);
    });
  });
});
