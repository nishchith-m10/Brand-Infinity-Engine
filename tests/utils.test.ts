/**
 * Utility Tests
 * 
 * Basic tests for the engineering hardening utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Sentry before importing modules that use it
vi.mock('@sentry/node', () => ({
  default: {
    captureMessage: vi.fn(),
    captureException: vi.fn(),
  },
}));

// =============================================================================
// Retry Utility Tests
// =============================================================================

describe('retryWithBackoff', () => {
  it('should return result on first successful attempt', async () => {
    const { retryWithBackoff } = await import('../utils/retry');
    
    const mockFn = vi.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(mockFn, { maxRetries: 3 });
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed eventually', async () => {
    const { retryWithBackoff } = await import('../utils/retry');
    
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');
    
    const result = await retryWithBackoff(mockFn, { 
      maxRetries: 3, 
      initialDelayMs: 10 
    });
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries exhausted', async () => {
    const { retryWithBackoff } = await import('../utils/retry');
    
    const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'));
    
    await expect(
      retryWithBackoff(mockFn, { maxRetries: 2, initialDelayMs: 10 })
    ).rejects.toThrow('Always fails');
    
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

// =============================================================================
// Cost Calculator Tests
// =============================================================================

describe('calculateCost', () => {
  it('should calculate GPT-4o cost correctly', async () => {
    const { calculateCost } = await import('../utils/cost_tracker');
    
    const cost = calculateCost('gpt-4o', 1000, 500);
    // Input: 1000 tokens * $0.0025/1K = $0.0025
    // Output: 500 tokens * $0.01/1K = $0.005
    // Total: $0.0075
    expect(cost).toBeCloseTo(0.0075, 4);
  });

  it('should return fixed price for video models', async () => {
    const { calculateCost } = await import('../utils/cost_tracker');
    
    const cost = calculateCost('veo3', 0, 0);
    expect(cost).toBe(0.40);
  });

  it('should calculate cost for all OpenAI text models', async () => {
    const { calculateCost } = await import('../utils/cost_tracker');

    expect(calculateCost('gpt-4o', 1000, 500)).toBeCloseTo(0.0075, 4);
    expect(calculateCost('gpt-4o-mini', 1000, 500)).toBeCloseTo(0.45 / 1000, 4);
    expect(calculateCost('gpt-4-turbo', 1000, 500)).toBeCloseTo(0.025, 4);
    expect(calculateCost('gpt-3.5-turbo', 1000, 500)).toBeCloseTo(0.00125, 4);
  });

  it('should calculate cost for embedding models', async () => {
    const { calculateCost } = await import('../utils/cost_tracker');

    expect(calculateCost('text-embedding-3-small', 10000, 0)).toBeCloseTo(0.0002, 4);
    expect(calculateCost('text-embedding-3-large', 10000, 0)).toBeCloseTo(0.0013, 4);
  });

  it('should calculate cost for audio models', async () => {
    const { calculateCost } = await import('../utils/cost_tracker');

    expect(calculateCost('whisper-1', 60000, 0)).toBeCloseTo(0.36, 2); // 60K tokens ~= 60 min
    expect(calculateCost('tts-1', 1000, 0)).toBe(0.015);
    expect(calculateCost('tts-1-hd', 1000, 0)).toBe(0.03);
    // Elevenlabs: 1000 tokens * $0.00024 input cost = $0.24
    expect(calculateCost('elevenlabs', 1000, 0)).toBeCloseTo((1000 / 1000) * 0.00024, 4);
  });

  it('should calculate cost for all video models', async () => {
    const { calculateCost } = await import('../utils/cost_tracker');

    expect(calculateCost('sora', 0, 0)).toBe(0.50);
    expect(calculateCost('seedream', 0, 0)).toBe(0.30);
    expect(calculateCost('nano_b', 0, 0)).toBe(0.25);
  });

  it('should calculate cost for image models', async () => {
    const { calculateCost } = await import('../utils/cost_tracker');

    expect(calculateCost('dall-e-3', 0, 0)).toBe(0.04);
    expect(calculateCost('dall-e-3-hd', 0, 0)).toBe(0.08);
  });

  it('should handle zero tokens', async () => {
    const { calculateCost } = await import('../utils/cost_tracker');

    const cost = calculateCost('gpt-4o', 0, 0);
    expect(cost).toBe(0);
  });

  it('should handle very large token counts', async () => {
    const { calculateCost } = await import('../utils/cost_tracker');

    const cost = calculateCost('gpt-4o', 1000000, 500000);
    expect(cost).toBeCloseTo(7.5, 2); // $2.5 + $5 = $7.5
  });

  it('should ignore tokens for fixed-price models', async () => {
    const { calculateCost } = await import('../utils/cost_tracker');

    // Tokens should be ignored for video models
    expect(calculateCost('veo3', 1000, 1000)).toBe(0.40);
    expect(calculateCost('veo3', 0, 0)).toBe(0.40);
  });

  it('should return 0 for unknown models', async () => {
    const { calculateCost } = await import('../utils/cost_tracker');
    
    const cost = calculateCost('unknown-model', 1000, 1000);
    expect(cost).toBe(0);
  });
});

// =============================================================================
// Idempotency Key Generation Tests
// =============================================================================

describe('generateIdempotencyKey', () => {
  it('should generate consistent keys for same input', async () => {
    const { generateIdempotencyKey } = await import('../utils/idempotency');
    
    const data = { userId: 'test', action: 'create' };
    const key1 = generateIdempotencyKey(data);
    const key2 = generateIdempotencyKey(data);
    
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^idempotency:[a-f0-9]{64}$/);
  });

  it('should generate different keys for different input', async () => {
    const { generateIdempotencyKey } = await import('../utils/idempotency');
    
    const key1 = generateIdempotencyKey({ userId: 'test1' });
    const key2 = generateIdempotencyKey({ userId: 'test2' });
    
    expect(key1).not.toBe(key2);
  });
});

// =============================================================================
// Rate Limit Presets Tests
// =============================================================================

describe('RATE_LIMIT_PRESETS', () => {
  it('should have correct standard preset values', async () => {
    const { RATE_LIMIT_PRESETS } = await import('../utils/rate_limiter');
    
    expect(RATE_LIMIT_PRESETS.standard).toEqual({
      maxRequests: 100,
      windowSecs: 60,
    });
  });

  it('should have correct strict preset values', async () => {
    const { RATE_LIMIT_PRESETS } = await import('../utils/rate_limiter');
    
    expect(RATE_LIMIT_PRESETS.strict).toEqual({
      maxRequests: 10,
      windowSecs: 60,
    });
  });
});
