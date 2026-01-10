 /**
 * Edge-compatible encryption for provider keys
 * Uses Web Crypto API instead of libsodium for Edge Runtime compatibility
 */

const KEY_ENCODING = 'base64';

/**
 * Get encryption secret from environment (Edge-compatible)
 */
async function getEncryptionSecret(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_PROVIDER_KEYS_SECRET;
  
  if (!secret) {
    throw new Error('SUPABASE_PROVIDER_KEYS_SECRET not configured');
  }

  // Derive key from secret using Web Crypto API
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('brand-infinity-keys'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt API key using Web Crypto API
 */
export async function encryptProviderKey(plaintext: string): Promise<string> {
  const key = await getEncryptionSecret();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );

  // Combine IV and ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Return as base64
  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypt API key using Web Crypto API
 */
export async function decryptProviderKey(encrypted: string): Promise<string> {
  const key = await getEncryptionSecret();
  const combined = Buffer.from(encrypted, 'base64');
  
  // Extract IV and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Check if encryption is properly configured
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env.SUPABASE_PROVIDER_KEYS_SECRET;
}
