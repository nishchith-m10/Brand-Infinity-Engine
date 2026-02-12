/**
 * Fetch with Retry Utility
 * 
 * Wraps fetch with:
 * - Exponential backoff retry logic
 * - Rate limit (429) handling with Retry-After header
 * - Server error (5xx) retry
 * - Abort signal support for cancellation
 * - Idempotency key header support
 */

interface FetchWithRetryOptions extends RequestInit {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelay?: number;
  /** Idempotency key for safe retries */
  idempotencyKey?: string;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry on transient failures
 * 
 * @param url - URL to fetch
 * @param options - Fetch options plus retry configuration
 * @returns Response if successful
 * @throws Error after all retries exhausted
 * 
 * @example
 * const response = await fetchWithRetry('/api/chat', {
 *   method: 'POST',
 *   body: JSON.stringify({ message: 'Hello' }),
 *   maxRetries: 3,
 *   idempotencyKey: 'msg-123',
 * });
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { 
    maxRetries = 3, 
    baseDelay = 1000,
    idempotencyKey,
    ...fetchOptions 
  } = options;

  // Add idempotency key header if provided
  const headers = new Headers(fetchOptions.headers);
  if (idempotencyKey) {
    headers.set('x-idempotency-key', idempotencyKey);
  }

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { 
        ...fetchOptions, 
        headers 
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter 
          ? parseInt(retryAfter, 10) * 1000 
          : baseDelay * Math.pow(2, attempt);
        
        console.log(`[FetchRetry] Rate limited (429), waiting ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(waitTime);
        continue;
      }

      // Handle server errors (5xx) - retry with backoff
      if (response.status >= 500) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[FetchRetry] Server error (${response.status}), waiting ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }

      // Success or client error (don't retry 4xx except 429)
      return response;

    } catch (error) {
      lastError = error as Error;

      // Don't retry intentional cancellation
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[FetchRetry] Request aborted');
        throw error;
      }

      // Network error - retry with backoff
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[FetchRetry] Network error, waiting ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, 
          error instanceof Error ? error.message : 'Unknown');
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  console.error(`[FetchRetry] All ${maxRetries} attempts failed`);
  throw lastError;
}

/**
 * Generate a unique idempotency key
 * 
 * @param prefix - Prefix for the key (e.g., 'msg', 'action')
 * @returns Unique key string
 */
export function generateIdempotencyKey(prefix: string = 'req'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Check if an error is a network error that should be retried
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  // Abort is not retryable
  if (error.name === 'AbortError') return false;
  
  // Network errors are retryable
  if (error.message.includes('network') || 
      error.message.includes('fetch') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT')) {
    return true;
  }
  
  return false;
}
