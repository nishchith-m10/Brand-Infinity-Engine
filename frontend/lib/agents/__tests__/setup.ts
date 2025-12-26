/**
 * PHASE 6 PART 2: Test Setup
 * Configuration for agent tests
 */

// Mock environment variables
process.env.OPENAI_API_KEY = "sk-test-mock-key";
process.env.ANTHROPIC_API_KEY = "sk-ant-test-mock-key";
process.env.LLM_KEY_ENCRYPTION_SECRET = "test-encryption-key-32-chars!!";

// Mock Supabase client
export const mockSupabase = {
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
      }),
      in: () => Promise.resolve({ data: [], error: null }),
    }),
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: {}, error: null }),
      }),
    }),
    update: () => ({
      eq: () => Promise.resolve({ data: {}, error: null }),
    }),
    upsert: () => Promise.resolve({ data: {}, error: null }),
  }),
};

// Mock Redis client
export const mockRedis = {
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve("OK")),
  setex: jest.fn(() => Promise.resolve("OK")),
  del: jest.fn(() => Promise.resolve(1)),
};

// Test utilities
export const testHelpers = {
  /**
   * Wait for async operations to complete
   */
  async waitForAsync(ms: number = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Mock successful LLM response
   */
  mockLLMSuccess: (content: string) => ({
    content,
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      totalCost: 0.001,
    },
    provider: "openai" as const,
    model: "gpt-4o-mini",
  }),

  /**
   * Mock LLM error
   */
  mockLLMError: (code: string, message: string) => ({
    code,
    message,
    provider: "openai" as const,
    retryable: code === "rate_limit" || code === "timeout",
  }),
};

// Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid UUID`
          : `Expected ${received} to be a valid UUID`,
    };
  },

  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be within range ${min}-${max}`
          : `Expected ${received} to be within range ${min}-${max}`,
    };
  },
});

// TypeScript declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeWithinRange(min: number, max: number): R;
    }
  }
}

