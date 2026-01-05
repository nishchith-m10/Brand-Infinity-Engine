// =============================================================================
// RETRY MANAGER
// Manages retry logic with exponential backoff
// =============================================================================

import {
  RetryStrategy,
  DEFAULT_RETRY_STRATEGY,
  RetryContext,
} from './types';

/**
 * RetryManager class handles retry logic for failed tasks.
 * 
 * Features:
 * - Exponential backoff with configurable multiplier
 * - Max retry limits
 * - Delay capping to prevent excessive waits
 * - Retry eligibility checks
 * - Context tracking
 */
export class RetryManager {
  private strategy: RetryStrategy;

  constructor(strategy: Partial<RetryStrategy> = {}) {
    this.strategy = { ...DEFAULT_RETRY_STRATEGY, ...strategy };
  }

  /**
   * Check if a task should be retried.
   * 
   * @param currentAttempt - Current attempt number (0-indexed)
   * @param isRetriable - Whether the error is retriable
   * @returns true if should retry
   */
  shouldRetry(currentAttempt: number, isRetriable: boolean): boolean {
    if (!isRetriable) {
      return false;
    }

    return currentAttempt < this.strategy.maxRetries;
  }

  /**
   * Calculate the delay before the next retry.
   * 
   * Uses exponential backoff: delay = baseDelay * (multiplier ^ attempt)
   * Capped at maxDelay.
   * 
   * @param attempt - Current attempt number (0-indexed)
   * @returns Delay in milliseconds
   */
  calculateDelay(attempt: number): number {
    const delay = this.strategy.baseDelayMs * Math.pow(
      this.strategy.backoffMultiplier,
      attempt
    );

    return Math.min(delay, this.strategy.maxDelayMs);
  }

  /**
   * Get the next retry time.
   * 
   * @param attempt - Current attempt number
   * @returns Date object representing next retry time
   */
  getNextRetryTime(attempt: number): Date {
    const delay = this.calculateDelay(attempt);
    return new Date(Date.now() + delay);
  }

  /**
   * Create a retry context for tracking.
   * 
   * @param taskId - The task ID
   * @param requestId - The request ID
   * @param currentAttempt - Current attempt number
   * @param lastError - Last error message
   * @returns RetryContext object
   */
  createRetryContext(
    taskId: string,
    requestId: string,
    currentAttempt: number,
    lastError: string
  ): RetryContext {
    return {
      taskId,
      requestId,
      currentAttempt,
      lastError,
      nextRetryAt: this.getNextRetryTime(currentAttempt),
    };
  }

  /**
   * Check if enough time has passed for a retry.
   * 
   * @param context - The retry context
   * @returns true if ready to retry
   */
  isReadyToRetry(context: RetryContext): boolean {
    return new Date() >= context.nextRetryAt;
  }

  /**
   * Calculate total backoff time for a given number of retries.
   * 
   * @param attempts - Number of attempts
   * @returns Total delay in milliseconds
   */
  calculateTotalBackoff(attempts: number): number {
    let total = 0;
    for (let i = 0; i < attempts; i++) {
      total += this.calculateDelay(i);
    }
    return total;
  }

  /**
   * Get retry strategy configuration.
   */
  getStrategy(): RetryStrategy {
    return { ...this.strategy };
  }

  /**
   * Update retry strategy.
   */
  updateStrategy(strategy: Partial<RetryStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
  }

  /**
   * Get human-readable retry delay description.
   * 
   * @param attempt - Current attempt number
   * @returns Human-readable string (e.g., "5 seconds", "2 minutes")
   */
  getDelayDescription(attempt: number): string {
    const delayMs = this.calculateDelay(attempt);
    const seconds = Math.floor(delayMs / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      if (remainingSeconds > 0) {
        return `${minutes}m ${remainingSeconds}s`;
      }
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }

    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }

  /**
   * Calculate jitter to randomize retry delays and prevent thundering herd.
   * 
   * @param delay - Base delay
   * @param jitterFactor - Jitter factor (0-1, default 0.1 = ±10%)
   * @returns Delay with jitter applied
   */
  applyJitter(delay: number, jitterFactor: number = 0.1): number {
    const jitter = delay * jitterFactor;
    const randomJitter = (Math.random() * 2 - 1) * jitter; // -jitter to +jitter
    return Math.max(0, Math.floor(delay + randomJitter));
  }

  /**
   * Calculate retry delay with jitter.
   * 
   * @param attempt - Current attempt number
   * @param jitterFactor - Jitter factor
   * @returns Delay with jitter in milliseconds
   */
  calculateDelayWithJitter(attempt: number, jitterFactor: number = 0.1): number {
    const baseDelay = this.calculateDelay(attempt);
    return this.applyJitter(baseDelay, jitterFactor);
  }

  /**
   * Check if a retry count has exceeded the limit.
   * 
   * @param retryCount - Current retry count
   * @returns true if exceeded
   */
  hasExceededMaxRetries(retryCount: number): boolean {
    return retryCount >= this.strategy.maxRetries;
  }

  /**
   * Get the maximum number of retries allowed.
   */
  getMaxRetries(): number {
    return this.strategy.maxRetries;
  }

  /**
   * Get remaining retries for a given attempt.
   * 
   * @param currentAttempt - Current attempt number
   * @returns Number of remaining retries
   */
  getRemainingRetries(currentAttempt: number): number {
    return Math.max(0, this.strategy.maxRetries - currentAttempt);
  }

  /**
   * Create a retry schedule showing all retry times.
   * 
   * @param startTime - Starting time (default: now)
   * @returns Array of retry times
   */
  createRetrySchedule(startTime: Date = new Date()): Date[] {
    const schedule: Date[] = [];
    let currentTime = startTime.getTime();

    for (let i = 0; i < this.strategy.maxRetries; i++) {
      const delay = this.calculateDelay(i);
      currentTime += delay;
      schedule.push(new Date(currentTime));
    }

    return schedule;
  }

  /**
   * Format retry attempt info for logging.
   * 
   * @param attempt - Current attempt number
   * @param taskName - Task name
   * @returns Formatted string
   */
  formatRetryLog(attempt: number, taskName: string): string {
    const remaining = this.getRemainingRetries(attempt);
    const delay = this.getDelayDescription(attempt);
    
    return `Retrying "${taskName}" (attempt ${attempt + 1}/${this.strategy.maxRetries}, next retry in ${delay}, ${remaining} retries remaining)`;
  }
}

// Export singleton instance with default strategy
export const retryManager = new RetryManager();

// Export factory for custom strategy
export function createRetryManager(strategy: Partial<RetryStrategy>): RetryManager {
  return new RetryManager(strategy);
}

// Export class for testing
export default RetryManager;
