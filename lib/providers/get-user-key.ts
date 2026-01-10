/**
 * Helper to get a decrypted provider key for the authenticated user
 * Used when making AI provider API calls with user-supplied keys
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
// Use edge-compatible encryption (works in both Node.js and Edge Runtime)
import { decryptProviderKey } from '@/lib/encryption/provider-keys-edge';

export type ProviderType = 'openai' | 'anthropic' | 'deepseek' | 'elevenlabs' | 'midjourney' | 'pollo' | 'runway' | 'pika' | 'openrouter' | 'gemini' | 'other';

/**
 * Get decrypted provider key for a specific user
 * 
 * @param provider - The provider type (openai, anthropic, etc.)
 * @param userId - Optional explicit user ID (for server-side background jobs)
 *                 If not provided, uses authenticated user from session
 * @returns Decrypted API key or null if no key configured
 * @throws Error if user not found or decryption fails
 */
export async function getUserProviderKey(
  provider: ProviderType,
  userId?: string
): Promise<string | null> {
  let targetUserId: string;

  if (userId) {
    // Explicit userId provided (server-side background job)
    targetUserId = userId;
    console.log(`[getUserProviderKey] Using explicit userId for ${provider}: ${userId}`);
  } else {
    // Interactive session - get from auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized: no authenticated user');
    }
    targetUserId = user.id;
  }

  // Use admin client to fetch user keys (RLS bypass for background jobs)
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('user_provider_keys')
    .select('encrypted_key')
    .eq('user_id', targetUserId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch provider key: ${error.message}`);
  }

  if (!data) {
    return null; // No key configured for this provider
  }

  // Decrypt and return
  return await decryptProviderKey(data.encrypted_key);
}

/**
 * Get the effective API key for a provider
 * Prefers user-supplied key; falls back to global env var
 * Throws error if REQUIRE_USER_PROVIDER_KEYS=true and no key exists
 * Returns null if USE_FREE_PROVIDERS=true (signals use free tier)
 * 
 * @param provider - The provider type
 * @param globalEnvKey - Optional global/service-level key to fall back to
 * @param userId - Optional explicit user ID (for server-side background jobs)
 */
export async function getEffectiveProviderKey(
  provider: ProviderType,
  globalEnvKey?: string,
  userId?: string
): Promise<string | null> {
  try {
    const userKey = await getUserProviderKey(provider, userId);
    if (userKey) {
      if (userId) {
        console.log(`[getEffectiveProviderKey] Using user key for ${provider} (userId: ${userId})`);
      }
      return userKey;
    }
  } catch (err) {
    console.warn(`Failed to retrieve user key for ${provider}:`, err);
  }

  // Enforce BYOK-only mode when the flag is set
  if (process.env.REQUIRE_USER_PROVIDER_KEYS === 'true') {
    // Allow fallback to free providers if enabled
    if (process.env.USE_FREE_PROVIDERS === 'true') {
      console.log(`[getEffectiveProviderKey] No user key for ${provider}, falling back to free providers`);
      return null; // Signal to use free tier (pollinations)
    }
    throw new Error(
      `Provider ${provider} requires a user-supplied key (REQUIRE_USER_PROVIDER_KEYS=true). Please add the key in Settings.`
    );
  }

  return globalEnvKey || null;
}
