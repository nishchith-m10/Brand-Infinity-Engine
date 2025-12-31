/**
 * Unlock Key System
 * 
 * This module manages the master unlock key that allows bypassing workflow locks for testing.
 * The key is validated against the environment variable (MASTER_UNLOCK_KEY).
 * 
 * Usage:
 * - Pass `?unlock_key=YOUR_KEY` as a query parameter
 * - The key is validated against MASTER_UNLOCK_KEY environment variable
 * 
 * Note: This is a client-side validation for development/testing only.
 * In production, consider moving validation to an API endpoint with proper auth.
 */

export const UNLOCK_KEY_ENV = process.env.NEXT_PUBLIC_MASTER_UNLOCK_KEY || '';

/**
 * Validates the provided unlock key against the master key
 * @param providedKey - The key provided by the user
 * @returns true if the key is valid, false otherwise
 */
export async function validateUnlockKey(providedKey: string | null | undefined): Promise<boolean> {
  if (!providedKey) {
    console.log('[Unlock] No key provided');
    return false;
  }

  // Validate against environment variable
  if (UNLOCK_KEY_ENV) {
    const isValid = providedKey === UNLOCK_KEY_ENV;
    console.log(`[Unlock] Comparing keys:`, {
      provided: providedKey.substring(0, 8) + '...',
      expected: UNLOCK_KEY_ENV.substring(0, 8) + '...',
      match: isValid
    });
    if (isValid) {
      console.log('✓ Master unlock key validated - workflows unlocked!');
    } else {
      console.log('✗ Unlock key does not match');
    }
    return isValid;
  }

  // No unlock key configured
  console.log('[Unlock] NEXT_PUBLIC_MASTER_UNLOCK_KEY not set in environment');
  return false;
}

/**
 * Extracts the unlock key from multiple sources:
 * 1. Query parameter (?unlock_key=...)
 * 2. LocalStorage (persists across pages)
 * 3. Header (for API calls)
 */
export function extractUnlockKey(
  searchParams?: URLSearchParams,
  headers?: Headers
): string | null {
  // Check query parameter first (highest priority - for setting)
  if (searchParams?.has('unlock_key')) {
    const key = searchParams.get('unlock_key');
    if (key && typeof window !== 'undefined') {
      // Store in localStorage for persistence
      localStorage.setItem('__unlock_key', key);
      console.log('✓ Unlock key saved to session');
    }
    return key;
  }

  // Check localStorage (persists across pages in same browser)
  if (typeof window !== 'undefined') {
    const storedKey = localStorage.getItem('__unlock_key');
    if (storedKey) {
      return storedKey;
    }
  }

  // Check header (for API calls)
  if (headers?.has('x-unlock-key')) {
    return headers.get('x-unlock-key');
  }

  return null;
}

/**
 * Clears the stored unlock key from localStorage
 */
export function clearUnlockKey(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('__unlock_key');
    console.log('✓ Unlock key cleared');
  }
}

/**
 * Gets the current unlock key from localStorage (if any)
 */
export function getStoredUnlockKey(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('__unlock_key');
  }
  return null;
}

