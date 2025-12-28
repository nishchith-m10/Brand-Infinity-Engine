/**
 * Agent Error Classes
 * Slice 9: Production Hardening
 */

export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class LLMError extends AgentError {
  constructor(message: string, provider: string, retryable = true) {
    super(message, 'LLM_ERROR', retryable, { provider });
    this.name = 'LLMError';
  }
}

export class RateLimitError extends AgentError {
  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT', true, { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends AgentError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', false, { field });
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends AgentError {
  constructor(message: string, retryable = true) {
    super(message, 'DATABASE_ERROR', retryable);
    this.name = 'DatabaseError';
  }
}

export class CacheError extends AgentError {
  constructor(message: string) {
    super(message, 'CACHE_ERROR', true);
    this.name = 'CacheError';
  }
}

export class TimeoutError extends AgentError {
  constructor(message: string, timeout: number) {
    super(message, 'TIMEOUT', true, { timeout });
    this.name = 'TimeoutError';
  }
}

/**
 * Error handler with logging and recovery
 */
export function handleAgentError(error: unknown, context: string): AgentError {
  console.error(`[${context}]`, error);

  if (error instanceof AgentError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for known error patterns
    if (error.message.includes('rate limit')) {
      return new RateLimitError(error.message);
    }
    if (error.message.includes('timeout')) {
      return new TimeoutError(error.message, 30000);
    }
    if (error.message.includes('database') || error.message.includes('connection')) {
      return new DatabaseError(error.message);
    }

    return new AgentError(error.message, 'UNKNOWN_ERROR', true);
  }

  return new AgentError('An unknown error occurred', 'UNKNOWN_ERROR', true);
}

/**
 * Check if error should trigger retry
 */
export function shouldRetry(error: AgentError, attemptNumber: number, maxAttempts: number): boolean {
  if (attemptNumber >= maxAttempts) return false;
  return error.retryable;
}

/**
 * Calculate retry delay with exponential backoff
 */
export function getRetryDelay(attemptNumber: number, baseDelay: number = 1000): number {
  const exponential = Math.pow(2, attemptNumber) * baseDelay;
  const jitter = Math.random() * baseDelay;
  return Math.min(exponential + jitter, 30000); // Max 30s
}

