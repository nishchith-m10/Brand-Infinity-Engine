/**
 * Encryption utilities for user provider keys
 * Uses libsodium secretbox for authenticated encryption (XSalsa20-Poly1305)
 */

import sodium from 'libsodium-wrappers';

const KEY_ENCODING = 'base64';

/**
 * Get encryption secret from environment
 * Throws if not available or invalid length
 */
async function getEncryptionSecret(): Promise<Uint8Array> {
  await sodium.ready;

  const secret = process.env.SUPABASE_PROVIDER_KEYS_SECRET;
  
  if (!secret) {
    throw new Error('SUPABASE_PROVIDER_KEYS_SECRET not configured');
  }

  // Decode base64 secret
  const keyBytes = Buffer.from(secret, 'base64');
  
  if (keyBytes.length !== sodium.crypto_secretbox_KEYBYTES) {
    throw new Error(
      `Invalid encryption key length: expected ${sodium.crypto_secretbox_KEYBYTES} bytes, got ${keyBytes.length}`
    );
  }

  return new Uint8Array(keyBytes);
}

/**
 * Encrypt a plaintext provider key
 * Returns base64-encoded nonce:ciphertext
 */
export async function encryptProviderKey(plainKey: string): Promise<string> {
  await sodium.ready;
  
  const secret = await getEncryptionSecret();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const plainBytes = new TextEncoder().encode(plainKey);
  
  const ciphertext = sodium.crypto_secretbox_easy(plainBytes, nonce, secret);
  
  // Format: base64(nonce):base64(ciphertext)
  const nonceB64 = Buffer.from(nonce).toString(KEY_ENCODING);
  const cipherB64 = Buffer.from(ciphertext).toString(KEY_ENCODING);
  
  return `${nonceB64}:${cipherB64}`;
}

/**
 * Decrypt an encrypted provider key
 * Expects base64-encoded nonce:ciphertext format
 */
export async function decryptProviderKey(encryptedKey: string): Promise<string> {
  await sodium.ready;
  
  const secret = await getEncryptionSecret();
  const [nonceB64, cipherB64] = encryptedKey.split(':');
  
  if (!nonceB64 || !cipherB64) {
    throw new Error('Invalid encrypted key format: expected nonce:ciphertext');
  }

  try {
    const nonce = new Uint8Array(Buffer.from(nonceB64, KEY_ENCODING));
    const ciphertext = new Uint8Array(Buffer.from(cipherB64, KEY_ENCODING));
    
    const plainBytes = sodium.crypto_secretbox_open_easy(ciphertext, nonce, secret);
    
    if (!plainBytes) {
      throw new Error('Decryption failed: invalid ciphertext or key');
    }
    
    return new TextDecoder().decode(plainBytes);
  } catch (err) {
    throw new Error(`Decryption failed: ${(err as Error).message}`);
  }
}

/**
 * Generate a new encryption secret (for rotation or initial setup)
 * Returns base64-encoded key suitable for SUPABASE_PROVIDER_KEYS_SECRET
 */
export async function generateEncryptionSecret(): Promise<string> {
  await sodium.ready;
  const key = sodium.crypto_secretbox_keygen();
  return Buffer.from(key).toString('base64');
}

/**
 * Validate that encryption/decryption works (health check)
 */
export async function validateEncryption(): Promise<boolean> {
  try {
    const testPlain = 'test-key-validation';
    const encrypted = await encryptProviderKey(testPlain);
    const decrypted = await decryptProviderKey(encrypted);
    return decrypted === testPlain;
  } catch {
    return false;
  }
}
