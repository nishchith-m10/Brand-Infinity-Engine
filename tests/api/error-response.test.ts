/**
 * Tests for standardized API response utilities
 */

import { describe, it, expect } from 'vitest';
import { ZodError, z } from 'zod';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  authenticationErrorResponse,
  authorizationErrorResponse,
  notFoundErrorResponse,
  rateLimitErrorResponse,
  serverErrorResponse,
  isErrorResponse,
  isSuccessResponse,
  type ErrorResponse,
  type SuccessResponse,
} from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/error-codes';

describe('API Response Utilities', () => {
  describe('successResponse', () => {
    it('should create a valid success response', async () => {
      const data = { id: '123', name: 'Test' };
      const response = successResponse(data);
      
      expect(response.status).toBe(200);
      
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual(data);
      expect(json.requestId).toBeDefined();
      expect(json.timestamp).toBeDefined();
    });

    it('should include custom request ID when provided', async () => {
      const data = { value: 42 };
      const requestId = 'custom-id-123';
      const response = successResponse(data, requestId);
      
      const json = await response.json();
      expect(json.requestId).toBe(requestId);
    });

    it('should be identified by type guard', async () => {
      const response = successResponse({ test: true });
      const json = await response.json();
      
      expect(isSuccessResponse(json)).toBe(true);
      expect(isErrorResponse(json)).toBe(false);
    });
  });

  describe('errorResponse', () => {
    it('should create a valid error response', async () => {
      const response = errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Validation failed',
        400
      );
      
      expect(response.status).toBe(400);
      
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(json.error.message).toBe('Validation failed');
      expect(json.error.requestId).toBeDefined();
      expect(json.error.timestamp).toBeDefined();
    });

    it('should include details when provided', async () => {
      const details = { field: 'email', issue: 'Invalid format' };
      const response = errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Validation failed',
        400,
        details
      );
      
      const json = await response.json();
      expect(json.error.details).toEqual(details);
    });

    it('should default status code from error code mapping', async () => {
      const response = errorResponse(
        ErrorCodes.UNAUTHENTICATED,
        'Not authenticated'
      );
      
      expect(response.status).toBe(401);
    });

    it('should be identified by type guard', async () => {
      const response = errorResponse(ErrorCodes.INTERNAL_ERROR, 'Error', 500);
      const json = await response.json();
      
      expect(isErrorResponse(json)).toBe(true);
      expect(isSuccessResponse(json)).toBe(false);
    });
  });

  describe('validationErrorResponse', () => {
    it('should format Zod errors correctly', async () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(0),
      });
      
      try {
        schema.parse({ email: 'invalid', age: -1 });
      } catch (error) {
        if (error instanceof ZodError) {
          const response = validationErrorResponse(error);
          
          expect(response.status).toBe(400);
          
          const json = await response.json();
          expect(json.success).toBe(false);
          expect(json.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
          expect(json.error.message).toBe('Validation failed');
          expect(Array.isArray(json.error.details)).toBe(true);
        }
      }
    });

    it('should handle custom validation errors', async () => {
      const errors = {
        email: ['Email is required', 'Email must be valid'],
        password: ['Password is too short'],
      };
      
      const response = validationErrorResponse(errors);
      
      const json = await response.json();
      expect(json.error.details).toEqual(errors);
    });
  });

  describe('authenticationErrorResponse', () => {
    it('should create an authentication error', async () => {
      const response = authenticationErrorResponse();
      
      expect(response.status).toBe(401);
      
      const json = await response.json();
      expect(json.error.code).toBe(ErrorCodes.UNAUTHENTICATED);
      expect(json.error.message).toBe('Authentication required');
    });

    it('should support custom messages', async () => {
      const message = 'Invalid credentials';
      const response = authenticationErrorResponse(message);
      
      const json = await response.json();
      expect(json.error.message).toBe(message);
    });
  });

  describe('authorizationErrorResponse', () => {
    it('should create an authorization error', async () => {
      const response = authorizationErrorResponse();
      
      expect(response.status).toBe(403);
      
      const json = await response.json();
      expect(json.error.code).toBe(ErrorCodes.UNAUTHORIZED);
      expect(json.error.message).toBe('Insufficient permissions');
    });
  });

  describe('notFoundErrorResponse', () => {
    it('should create a not found error', async () => {
      const response = notFoundErrorResponse('Campaign');
      
      expect(response.status).toBe(404);
      
      const json = await response.json();
      expect(json.error.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(json.error.message).toBe('Campaign not found');
    });
  });

  describe('rateLimitErrorResponse', () => {
    it('should create a rate limit error', async () => {
      const retryAfter = 60;
      const response = rateLimitErrorResponse(retryAfter);
      
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');
      
      const json = await response.json();
      expect(json.error.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED);
      expect(json.error.details).toEqual({ retryAfter });
    });

    it('should work without retry-after value', async () => {
      const response = rateLimitErrorResponse();
      
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeNull();
    });
  });

  describe('serverErrorResponse', () => {
    it('should handle Error instances', async () => {
      const error = new Error('Database connection failed');
      const response = serverErrorResponse(error);
      
      expect(response.status).toBe(500);
      
      const json = await response.json();
      expect(json.error.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(json.error.message).toBe('Database connection failed');
    });

    it('should handle unknown errors', async () => {
      const error = 'Something went wrong';
      const response = serverErrorResponse(error);
      
      const json = await response.json();
      expect(json.error.message).toBe('An unexpected error occurred');
    });

    it('should sanitize stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Test error');
      const response = serverErrorResponse(error);
      
      const json = await response.json();
      expect(json.error.details).toBeUndefined();
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Security - Sanitization', () => {
    it('should sanitize sensitive fields in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const details = {
        userId: '123',
        password: 'secret123',
        token: 'abc-token',
        apiKey: 'key-123',
        publicData: 'visible',
      };
      
      const response = errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Test',
        400,
        details
      );
      
      const json = await response.json();
      const sanitized = json.error.details as Record<string, unknown>;
      
      expect(sanitized.password).toBeUndefined();
      expect(sanitized.token).toBeUndefined();
      expect(sanitized.apiKey).toBeUndefined();
      expect(sanitized.publicData).toBe('visible');
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Consistency', () => {
    it('should have consistent envelope structure across all response types', async () => {
      const successResp = await successResponse({ test: true }).json();
      const errorResp = await errorResponse(ErrorCodes.INTERNAL_ERROR, 'Error', 500).json();
      
      // Success responses have success: true, data
      expect(successResp).toHaveProperty('success', true);
      expect(successResp).toHaveProperty('data');
      expect(successResp).toHaveProperty('requestId');
      expect(successResp).toHaveProperty('timestamp');
      
      // Error responses have success: false, error
      expect(errorResp).toHaveProperty('success', false);
      expect(errorResp).toHaveProperty('error');
      expect(errorResp.error).toHaveProperty('code');
      expect(errorResp.error).toHaveProperty('message');
      expect(errorResp.error).toHaveProperty('requestId');
      expect(errorResp.error).toHaveProperty('timestamp');
    });
  });
});
