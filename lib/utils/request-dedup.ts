/**
 * Request Deduplication Utility
 * 
 * Prevents duplicate concurrent requests for the same resource.
 * If a request is already in-flight, returns the existing promise
 * instead of starting a new request.
 * 
 * Use cases:
 * - Prevent double-submit on rapid button clicks
 * - Avoid redundant API calls from multiple components
 */

// Store of pending requests by key
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Execute a function with deduplication
 * 
 * If a request with the same key is already in progress,
 * returns the existing promise instead of starting a new one.
 * 
 * @param key - Unique identifier for this request
 * @param fn - Async function to execute
 * @returns Promise with the result
 * 
 * @example
 * // Prevent double-submit
 * const sendMessage = (msg: string) => {
 *   const key = `send-${sessionId}-${msg.slice(0, 50)}`;
 *   return dedup(key, () => fetch('/api/send', { body: msg }));
 * };
 */
export async function dedup<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // Check if this request is already in flight
  if (pendingRequests.has(key)) {
    console.log(`[Dedup] Returning existing request for key: ${key.slice(0, 50)}...`);
    return pendingRequests.get(key) as Promise<T>;
  }

  // Execute the function and track the promise
  const promise = fn()
    .finally(() => {
      // Clean up when complete (success or failure)
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  console.log(`[Dedup] New request started for key: ${key.slice(0, 50)}...`);

  return promise;
}

/**
 * Generate a dedup key for conversation messages
 * 
 * @param sessionId - Current session ID
 * @param message - Message content
 * @returns Unique key for this message
 */
export function createMessageDedupKey(sessionId: string, message: string): string {
  // Use first 50 chars of message to avoid very long keys
  const truncatedMessage = message.slice(0, 50).replace(/\s+/g, '_');
  return `msg:${sessionId}:${truncatedMessage}`;
}

/**
 * Check if a request is currently pending
 * 
 * @param key - Request key to check
 * @returns true if request is in flight
 */
export function isPending(key: string): boolean {
  return pendingRequests.has(key);
}

/**
 * Get count of pending requests (for debugging)
 */
export function getPendingCount(): number {
  return pendingRequests.size;
}

/**
 * Clear all pending requests (for testing/reset)
 */
export function clearAllPending(): void {
  pendingRequests.clear();
  console.log('[Dedup] Cleared all pending requests');
}
