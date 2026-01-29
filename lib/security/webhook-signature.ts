/**
 * Webhook Signature Utilities
 * 
 * Provides HMAC-SHA256 signature generation and verification for securing
 * webhook callbacks from n8n and other external services.
 * 
 * Security features:
 * - HMAC-SHA256 for strong signature generation
 * - Timing-safe comparison to prevent timing attacks
 * - Support for emergency bypass via environment variable
 */

import crypto from 'crypto';

/**
 * Header name for the webhook signature
 */
export const SIGNATURE_HEADER = 'x-n8n-signature';

/**
 * Environment variable for the webhook secret
 */
export const SECRET_ENV_VAR = 'N8N_WEBHOOK_SECRET';

/**
 * Environment variable for emergency bypass
 */
export const BYPASS_ENV_VAR = 'N8N_SIGNATURE_BYPASS';

/**
 * Generate an HMAC-SHA256 signature for the given payload
 * 
 * @param payload - The raw request body as a string
 * @param secret - The shared secret key
 * @returns The hex-encoded signature
 */
export function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify an HMAC-SHA256 signature using timing-safe comparison
 * 
 * @param payload - The raw request body as a string
 * @param signature - The signature to verify
 * @param secret - The shared secret key
 * @returns True if the signature is valid, false otherwise
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateSignature(payload, secret);
  
  // Ensure both buffers are the same length for timing-safe comparison
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

/**
 * Extract the signature from request headers
 * 
 * @param headers - The request headers object or Headers instance
 * @returns The signature string or null if not present
 */
export function extractSignatureFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined>
): string | null {
  if (headers instanceof Headers) {
    return headers.get(SIGNATURE_HEADER);
  }
  
  const value = headers[SIGNATURE_HEADER];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return null;
}

/**
 * Check if signature bypass is enabled (EMERGENCY USE ONLY)
 * 
 * @returns True if bypass is enabled
 */
export function isSignatureBypassEnabled(): boolean {
  const bypass = process.env[BYPASS_ENV_VAR];
  return bypass === 'true' || bypass === '1';
}

/**
 * Get the webhook secret from environment
 * 
 * @returns The secret or null if not configured
 */
export function getWebhookSecret(): string | null {
  return process.env[SECRET_ENV_VAR] || null;
}

export interface SignatureValidationResult {
  valid: boolean;
  error?: 'MISSING_SECRET' | 'MISSING_SIGNATURE' | 'INVALID_SIGNATURE' | 'BYPASSED';
}

/**
 * Validate a webhook request signature
 * 
 * This is the main entry point for signature validation.
 * It handles all edge cases including bypass mode and missing configuration.
 * 
 * @param rawBody - The raw request body as a string
 * @param headers - The request headers
 * @returns Validation result with error code if invalid
 */
export function validateWebhookSignature(
  rawBody: string,
  headers: Headers | Record<string, string | string[] | undefined>
): SignatureValidationResult {
  // Check for emergency bypass
  if (isSignatureBypassEnabled()) {
    console.warn('[Webhook Security] ⚠️ SIGNATURE BYPASS ENABLED - This should only be used in emergencies!');
    return { valid: true, error: 'BYPASSED' };
  }
  
  // Get the secret
  const secret = getWebhookSecret();
  if (!secret) {
    return { valid: false, error: 'MISSING_SECRET' };
  }
  
  // Extract signature from headers
  const signature = extractSignatureFromHeaders(headers);
  if (!signature) {
    return { valid: false, error: 'MISSING_SIGNATURE' };
  }
  
  // Verify the signature
  if (!verifySignature(rawBody, signature, secret)) {
    return { valid: false, error: 'INVALID_SIGNATURE' };
  }
  
  return { valid: true };
}
