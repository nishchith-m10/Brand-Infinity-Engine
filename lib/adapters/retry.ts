/**
 * Retry Utility with Exponential Backoff
 *
 * Implements retry logic with exponential backoff for handling transient failures.
 * Used for HTTP requests to n8n and other external services.
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of attempts (including initial attempt) */
  maxAttempts: number;
  /** Initial delay in milliseconds before first retry */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (caps exponential growth) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff (typically 2) */
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 * - 3 total attempts (1 initial + 2 retries)
 * - Delays: 1s → 2s
 * - Max delay capped at 30s
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration
 * @param shouldRetry - Optional predicate to determine if error is retryable (default: retry all errors)
 * @returns Promise resolving to function result
 * @throws Last error if all retry attempts fail
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => fetch('https://api.example.com/data'),
 *   { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000, backoffMultiplier: 2 },
 *   (error) => error.message.includes('timeout') || error.message.includes('5')
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  shouldRetry: (error: Error) => boolean = () => true
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if this is the last attempt or error is non-retryable
      if (attempt === config.maxAttempts - 1 || !shouldRetry(lastError)) {
        throw lastError;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelayMs
      );

      // Log retry attempt (useful for debugging)
      console.log(
        `[Retry] Attempt ${attempt + 1}/${config.maxAttempts} failed: ${lastError.message}. ` +
        `Retrying in ${delay}ms...`
      );

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // TypeScript guard: this should never be reached, but satisfies type checker
  throw lastError!;
}

/**
 * Determine if an HTTP error is retryable
 *
 * Retryable errors:
 * - Network timeouts
 * - Server errors (5xx)
 * - Rate limits (429)
 * - Network connection errors
 *
 * Non-retryable errors:
 * - Client errors (4xx except 429)
 * - Authentication errors (401, 403)
 * - Not found (404)
 *
 * @param error - Error to check
 * @returns true if error should be retried
 */
export function isRetryableHttpError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network/timeout errors
  if (
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('enetunreach') ||
    message.includes('fetch failed')
  ) {
    return true;
  }

  // HTTP status codes
  // 5xx: Server errors (always retry)
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return true;
  }

  // 429: Rate limit (retry with backoff)
  if (message.includes('429')) {
    return true;
  }

  // 408: Request Timeout
  if (message.includes('408')) {
    return true;
  }

  // Don't retry 4xx errors (client errors)
  if (
    message.includes('400') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('404')
  ) {
    return false;
  }

  // Default: don't retry unknown errors
  return false;
}

/**
 * Create a retry config from environment variables
 *
 * Environment variables:
 * - N8N_RETRY_ATTEMPTS: Max attempts (default: 3)
 * - N8N_RETRY_BASE_DELAY_MS: Base delay (default: 1000)
 * - N8N_RETRY_MAX_DELAY_MS: Max delay (default: 30000)
 *
 * @returns RetryConfig from environment or defaults
 */
export function getRetryConfigFromEnv(): RetryConfig {
  return {
    maxAttempts: parseInt(process.env.N8N_RETRY_ATTEMPTS || '3', 10),
    baseDelayMs: parseInt(process.env.N8N_RETRY_BASE_DELAY_MS || '1000', 10),
    maxDelayMs: parseInt(process.env.N8N_RETRY_MAX_DELAY_MS || '30000', 10),
    backoffMultiplier: 2,
  };
}
