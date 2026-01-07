/**
 * Helper to get a decrypted provider key for the authenticated user
 * Used when making AI provider API calls with user-supplied keys
 */

import { createClient } from '@/lib/supabase/server';
import { decryptProviderKey } from '@/lib/encryption/provider-keys';

export type ProviderType = 'openai' | 'anthropic' | 'deepseek' | 'elevenlabs' | 'midjourney' | 'other';

/**
 * Get decrypted provider key for the authenticated user
 * Returns null if no key is configured
 * Throws if decryption fails
 */
export async function getUserProviderKey(
  provider: ProviderType
): Promise<string | null> {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized: no authenticated user');
  }

  const { data, error } = await supabase
    .from('user_provider_keys')
    .select('encrypted_key')
    .eq('user_id', user.id)
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
 */
export async function getEffectiveProviderKey(
  provider: ProviderType,
  globalEnvKey?: string
): Promise<string | null> {
  try {
    const userKey = await getUserProviderKey(provider);
    if (userKey) return userKey;
  } catch (err) {
    console.warn(`Failed to retrieve user key for ${provider}:`, err);
  }

  return globalEnvKey || null;
}
