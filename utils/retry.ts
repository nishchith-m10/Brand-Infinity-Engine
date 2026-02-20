import { retryWithBackoff as libRetry, RetryOptions as LibRetryOptions } from '../lib/utils/retry';

export async function retryWithBackoff(fn: () => Promise<any>, options: { maxRetries?: number; initialDelayMs?: number } = {}) {
  const libOptions: LibRetryOptions = {
    maxAttempts: options.maxRetries ?? 3,
    baseDelay: options.initialDelayMs ?? 1000,
  };
  return libRetry(fn, 'tests.retry', libOptions);
}
