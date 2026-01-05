/**
 * Retry Utility with Exponential Backoff
 * Slice 9: Production Hardening
 */

import { shouldRetry, getRetryDelay, handleAgentError, type AgentError } from '../errors/agent-errors';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (error: AgentError, attempt: number) => void;
  shouldRetryFn?: (error: AgentError, attempt: number) => boolean;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  context: string,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    onRetry,
    shouldRetryFn = shouldRetry,
  } = options;

  let lastError: AgentError | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = handleAgentError(error, context);

      const isLastAttempt = attempt === maxAttempts - 1;
      const shouldAttemptRetry = shouldRetryFn(lastError, attempt, maxAttempts);

      if (isLastAttempt || !shouldAttemptRetry) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(getRetryDelay(attempt, baseDelay), maxDelay);

      // Notify retry callback
      onRetry?.(lastError, attempt + 1);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        const timeoutError = handleAgentError(
          new Error(`Operation timed out after ${timeoutMs}ms`),
          context
        );
        reject(timeoutError);
      }, timeoutMs)
    ),
  ]);
}

/**
 * Circuit breaker pattern
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime > this.timeout;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'closed';
  }
}

