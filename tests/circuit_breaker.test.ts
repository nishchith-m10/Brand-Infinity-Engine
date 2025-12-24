/**
 * Circuit Breaker Tests
 * 
 * Tests for circuit breaker state machine, failure thresholds, and recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import { CircuitBreaker, CircuitState } from '../utils/circuit_breaker';

// Mock Sentry
vi.mock('@sentry/node', () => ({
  default: {
    captureMessage: vi.fn(),
    captureException: vi.fn(),
  },
}));

describe('CircuitBreaker', () => {
  let redis: InstanceType<typeof RedisMock>;
  let breaker: CircuitBreaker;

  beforeEach(() => {
    redis = new RedisMock();
    breaker = new CircuitBreaker('test-service', redis as any, {
      threshold: 3,
      resetTimeout: 1000, // 1 second for faster tests
      failureWindow: 5000,
    });
  });

  afterEach(async () => {
    await redis.flushall();
    await redis.quit();
  });

  // ===========================================================================
  // State Management Tests
  // ===========================================================================

  describe('getState', () => {
    it('should default to CLOSED state', async () => {
      const state = await breaker.getState();
      expect(state).toBe('CLOSED');
    });

    it('should return correct state after setting', async () => {
      await (breaker as any).setState('OPEN');
      const state = await breaker.getState();
      expect(state).toBe('OPEN');
    });
  });

  // ===========================================================================
  // Success Path Tests
  // ===========================================================================

  describe('execute - success', () => {
    it('should execute function successfully when circuit is CLOSED', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const result = await breaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(await breaker.getState()).toBe('CLOSED');
    });

    it('should allow multiple successful executions', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      await breaker.execute(mockFn);
      await breaker.execute(mockFn);
      await breaker.execute(mockFn);
      
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(await breaker.getState()).toBe('CLOSED');
    });
  });

  // ===========================================================================
  // Failure Threshold Tests
  // ===========================================================================

  describe('execute - failure threshold', () => {
    it('should open circuit after threshold failures', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Service down'));

      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockFn)).rejects.toThrow('Service down');
      }

      expect(await breaker.getState()).toBe('OPEN');
    });

    it('should reject immediately when circuit is OPEN', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Service down'));

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockFn)).rejects.toThrow('Service down');
      }

      // Reset mock to track new calls
      mockFn.mockClear();

      // Next call should fail fast
      await expect(breaker.execute(mockFn)).rejects.toThrow('Circuit breaker test-service is OPEN');
      
      // Function should not have been called
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should not open circuit below threshold', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Intermittent error'));

      // Fail 2 times (below threshold of 3)
      await expect(breaker.execute(mockFn)).rejects.toThrow('Intermittent error');
      await expect(breaker.execute(mockFn)).rejects.toThrow('Intermittent error');

      expect(await breaker.getState()).toBe('CLOSED');
    });
  });

  // ===========================================================================
  // Half-Open State Tests
  // ===========================================================================

  describe('execute - half-open state', () => {
    it('should transition to HALF_OPEN after reset timeout', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Service down'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockFn)).rejects.toThrow();
      }

      expect(await breaker.getState()).toBe('OPEN');

      // Wait for reset timeout (1 second)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Mock successful call
      mockFn.mockResolvedValueOnce('recovered');

      // Should transition to HALF_OPEN and succeed
      const result = await breaker.execute(mockFn);
      expect(result).toBe('recovered');
      
      // Should be back to CLOSED after success in HALF_OPEN
      expect(await breaker.getState()).toBe('CLOSED');
    });

    it('should reopen circuit if HALF_OPEN attempt fails', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Still down'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockFn)).rejects.toThrow();
      }

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Fail in HALF_OPEN state
      await expect(breaker.execute(mockFn)).rejects.toThrow('Still down');

      // Circuit should still be tracking failures
      const status = await breaker.getStatus();
      expect(status.failures).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Reset Tests
  // ===========================================================================

  describe('reset', () => {
    it('should clear all circuit breaker state', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Error'));

      // Generate some failures
      for (let i = 0; i < 2; i++) {
        await expect(breaker.execute(mockFn)).rejects.toThrow();
      }

      const statusBefore = await breaker.getStatus();
      expect(statusBefore.failures).toBeGreaterThan(0);

      // Reset
      await breaker.reset();

      const statusAfter = await breaker.getStatus();
      expect(statusAfter.state).toBe('CLOSED');
      expect(statusAfter.failures).toBe(0);
      expect(statusAfter.lastFailure).toBeNull();
    });
  });

  // ===========================================================================
  // Status Tests
  // ===========================================================================

  describe('getStatus', () => {
    it('should return complete status information', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Generate a failure
      await expect(breaker.execute(mockFn)).rejects.toThrow();

      const status = await breaker.getStatus();
      
      expect(status).toMatchObject({
        name: 'test-service',
        state: 'CLOSED',
        failures: 1,
      });
      expect(status.lastFailure).toBeInstanceOf(Date);
    });

    it('should show OPEN state in status', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Error'));

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockFn)).rejects.toThrow();
      }

      const status = await breaker.getStatus();
      expect(status.state).toBe('OPEN');
      expect(status.failures).toBe(3);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle function that throws non-Error objects', async () => {
      const mockFn = vi.fn().mockRejectedValue('string error');

      await expect(breaker.execute(mockFn)).rejects.toBeTruthy();
      
      const status = await breaker.getStatus();
      expect(status.failures).toBe(1);
    });

    it('should handle concurrent executions', async () => {
      const mockFn = vi.fn()
        .mockResolvedValueOnce('result1')
        .mockResolvedValueOnce('result2')
        .mockResolvedValueOnce('result3');

      const results = await Promise.all([
        breaker.execute(mockFn),
        breaker.execute(mockFn),
        breaker.execute(mockFn),
      ]);

      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(await breaker.getState()).toBe('CLOSED');
    });
  });
});
