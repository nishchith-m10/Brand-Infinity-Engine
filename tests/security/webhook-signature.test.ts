/**
 * Webhook Signature Utility Tests
 * 
 * Tests for HMAC-SHA256 signature generation and verification.
 */

import {
  generateSignature,
  verifySignature,
  extractSignatureFromHeaders,
  validateWebhookSignature,
  SIGNATURE_HEADER,
} from '@/lib/security/webhook-signature';

// Mock environment variables
const originalEnv = process.env;

describe('Webhook Signature Utilities', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('generateSignature', () => {
    it('should generate consistent signatures for the same input', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-secret-key';
      
      const sig1 = generateSignature(payload, secret);
      const sig2 = generateSignature(payload, secret);
      
      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const secret = 'test-secret-key';
      
      const sig1 = generateSignature('payload1', secret);
      const sig2 = generateSignature('payload2', secret);
      
      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = '{"test": "data"}';
      
      const sig1 = generateSignature(payload, 'secret1');
      const sig2 = generateSignature(payload, 'secret2');
      
      expect(sig1).not.toBe(sig2);
    });

    it('should return a hex string of 64 characters (SHA256)', () => {
      const signature = generateSignature('test', 'secret');
      
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('verifySignature', () => {
    const secret = 'test-secret-key';
    const payload = '{"requestId":"123","status":"success"}';

    it('should return true for valid signatures', () => {
      const signature = generateSignature(payload, secret);
      
      expect(verifySignature(payload, signature, secret)).toBe(true);
    });

    it('should return false for invalid signatures', () => {
      expect(verifySignature(payload, 'invalid-signature', secret)).toBe(false);
    });

    it('should return false for wrong secret', () => {
      const signature = generateSignature(payload, secret);
      
      expect(verifySignature(payload, signature, 'wrong-secret')).toBe(false);
    });

    it('should return false for tampered payload', () => {
      const signature = generateSignature(payload, secret);
      const tamperedPayload = '{"requestId":"456","status":"success"}';
      
      expect(verifySignature(tamperedPayload, signature, secret)).toBe(false);
    });

    it('should return false for signatures of different length', () => {
      expect(verifySignature(payload, 'short', secret)).toBe(false);
    });
  });

  describe('extractSignatureFromHeaders', () => {
    it('should extract signature from Headers object', () => {
      const headers = new Headers();
      headers.set(SIGNATURE_HEADER, 'test-signature');
      
      expect(extractSignatureFromHeaders(headers)).toBe('test-signature');
    });

    it('should return null for missing signature in Headers', () => {
      const headers = new Headers();
      
      expect(extractSignatureFromHeaders(headers)).toBeNull();
    });

    it('should extract signature from plain object', () => {
      const headers = { [SIGNATURE_HEADER]: 'test-signature' };
      
      expect(extractSignatureFromHeaders(headers)).toBe('test-signature');
    });

    it('should extract first signature from array value', () => {
      const headers = { [SIGNATURE_HEADER]: ['sig1', 'sig2'] };
      
      expect(extractSignatureFromHeaders(headers)).toBe('sig1');
    });

    it('should return null for empty array', () => {
      const headers = { [SIGNATURE_HEADER]: [] };
      
      expect(extractSignatureFromHeaders(headers)).toBeNull();
    });

    it('should return null for undefined value', () => {
      const headers = { 'other-header': 'value' };
      
      expect(extractSignatureFromHeaders(headers)).toBeNull();
    });
  });

  describe('validateWebhookSignature', () => {
    const secret = 'test-webhook-secret';
    const payload = '{"test":"data"}';

    beforeEach(() => {
      process.env.N8N_WEBHOOK_SECRET = secret;
      process.env.N8N_SIGNATURE_BYPASS = 'false';
    });

    it('should return valid for correct signature', () => {
      const signature = generateSignature(payload, secret);
      const headers = new Headers();
      headers.set(SIGNATURE_HEADER, signature);
      
      const result = validateWebhookSignature(payload, headers);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return MISSING_SECRET when secret not configured', () => {
      delete process.env.N8N_WEBHOOK_SECRET;
      const headers = new Headers();
      headers.set(SIGNATURE_HEADER, 'some-signature');
      
      const result = validateWebhookSignature(payload, headers);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('MISSING_SECRET');
    });

    it('should return MISSING_SIGNATURE when header not present', () => {
      const headers = new Headers();
      
      const result = validateWebhookSignature(payload, headers);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('MISSING_SIGNATURE');
    });

    it('should return INVALID_SIGNATURE for wrong signature', () => {
      const headers = new Headers();
      headers.set(SIGNATURE_HEADER, 'wrong-signature');
      
      const result = validateWebhookSignature(payload, headers);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_SIGNATURE');
    });

    it('should bypass validation when N8N_SIGNATURE_BYPASS is true', () => {
      process.env.N8N_SIGNATURE_BYPASS = 'true';
      const headers = new Headers();
      // No signature provided
      
      const result = validateWebhookSignature(payload, headers);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBe('BYPASSED');
    });

    it('should bypass validation when N8N_SIGNATURE_BYPASS is 1', () => {
      process.env.N8N_SIGNATURE_BYPASS = '1';
      const headers = new Headers();
      
      const result = validateWebhookSignature(payload, headers);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBe('BYPASSED');
    });
  });
});
