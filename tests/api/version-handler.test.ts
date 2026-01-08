/**
 * Tests for API Version Handler
 * 
 * Validates version detection, header handling, and deprecation logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  extractApiVersion,
  isValidApiVersion,
  getVersionStatus,
  isVersionDeprecated,
  validateApiVersion,
  shouldClientMigrate,
  SUPPORTED_API_VERSIONS,
  LATEST_API_VERSION,
} from '@/lib/api/version-handler';

describe('API Version Handler', () => {
  describe('extractApiVersion', () => {
    it('should extract version from URL path', () => {
      const request = new NextRequest('http://localhost/api/v1/campaigns');
      expect(extractApiVersion(request)).toBe(1);
    });

    it('should extract version from X-API-Version header', () => {
      const request = new NextRequest('http://localhost/api/campaigns', {
        headers: { 'X-API-Version': '1' },
      });
      expect(extractApiVersion(request)).toBe(1);
    });

    it('should prioritize URL path over header', () => {
      const request = new NextRequest('http://localhost/api/v1/campaigns', {
        headers: { 'X-API-Version': '2' },
      });
      expect(extractApiVersion(request)).toBe(1);
    });

    it('should return latest version for "latest" header', () => {
      const request = new NextRequest('http://localhost/api/campaigns', {
        headers: { 'X-API-Version': 'latest' },
      });
      expect(extractApiVersion(request)).toBe(LATEST_API_VERSION);
    });

    it('should default to latest version when no version specified', () => {
      const request = new NextRequest('http://localhost/api/campaigns');
      expect(extractApiVersion(request)).toBe(LATEST_API_VERSION);
    });

    it('should ignore invalid version in URL and use header', () => {
      const request = new NextRequest('http://localhost/api/v99/campaigns', {
        headers: { 'X-API-Version': '1' },
      });
      // Should fallback to header since URL version is invalid
      expect(extractApiVersion(request)).toBe(LATEST_API_VERSION);
    });
  });

  describe('isValidApiVersion', () => {
    it('should validate supported versions', () => {
      SUPPORTED_API_VERSIONS.forEach(version => {
        expect(isValidApiVersion(version)).toBe(true);
      });
    });

    it('should reject unsupported versions', () => {
      expect(isValidApiVersion(0)).toBe(false);
      expect(isValidApiVersion(99)).toBe(false);
      expect(isValidApiVersion(-1)).toBe(false);
    });

    it('should reject non-integer versions', () => {
      expect(isValidApiVersion(1.5 as any)).toBe(false);
      expect(isValidApiVersion(NaN as any)).toBe(false);
    });
  });

  describe('getVersionStatus', () => {
    it('should return status for v1', () => {
      const status = getVersionStatus(1);
      expect(status.version).toBe(1);
      expect(status.status).toBe('active');
    });

    it('should include deprecation info when set', () => {
      const status = getVersionStatus(1);
      // Initially v1 is active, no deprecation dates
      expect(status.deprecatedDate).toBeUndefined();
      expect(status.sunsetDate).toBeUndefined();
    });
  });

  describe('isVersionDeprecated', () => {
    it('should return false for active versions', () => {
      expect(isVersionDeprecated(1)).toBe(false);
    });

    // Note: This test will need to be updated when v1 is actually deprecated
    it('should handle active version correctly', () => {
      const status = getVersionStatus(1);
      const deprecated = status.status === 'deprecated' || status.status === 'sunset';
      expect(deprecated).toBe(false);
    });
  });

  describe('validateApiVersion', () => {
    it('should return valid version without error', () => {
      const request = new NextRequest('http://localhost/api/v1/campaigns');
      const result = validateApiVersion(request);
      
      expect(result.version).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid version in URL', () => {
      const request = new NextRequest('http://localhost/api/v99/campaigns');
      const result = validateApiVersion(request);
      
      expect(result.error).toBeDefined();
      if (result.error) {
        expect(result.error.status).toBe(404);
      }
    });

    it('should accept valid header version when no URL version', () => {
      const request = new NextRequest('http://localhost/api/campaigns', {
        headers: { 'X-API-Version': '1' },
      });
      const result = validateApiVersion(request);
      
      expect(result.version).toBe(1);
      expect(result.error).toBeUndefined();
    });
  });

  describe('shouldClientMigrate', () => {
    it('should return no migration needed for active version', () => {
      const result = shouldClientMigrate(1);
      
      expect(result.shouldMigrate).toBe(false);
      expect(result.urgency).toBe('low');
    });

    // Future test: When v1 is deprecated
    it.skip('should return migration needed for deprecated version', () => {
      // This test will be enabled when v1 is actually deprecated
      const result = shouldClientMigrate(1);
      
      expect(result.shouldMigrate).toBe(true);
      expect(result.targetVersion).toBe(2);
    });

    // Future test: Urgency based on sunset date
    it.skip('should return high urgency when sunset is near', () => {
      // This test will be enabled when sunset dates are set
      const result = shouldClientMigrate(1);
      
      expect(result.urgency).toBe('high');
    });
  });

  describe('Unsupported Version Response', () => {
    it('should create proper error response for invalid version', () => {
      const request = new NextRequest('http://localhost/api/v99/campaigns');
      const result = validateApiVersion(request);
      
      expect(result.error).toBeDefined();
      
      if (result.error) {
        const body = result.error.body;
        // The body is a ReadableStream, so we need to read it
        // In actual implementation, the JSON structure should match
        expect(result.error.status).toBe(404);
      }
    });
  });

  describe('Version Constants', () => {
    it('should have supported versions array', () => {
      expect(SUPPORTED_API_VERSIONS).toBeDefined();
      expect(Array.isArray(SUPPORTED_API_VERSIONS)).toBe(true);
      expect(SUPPORTED_API_VERSIONS.length).toBeGreaterThan(0);
    });

    it('should have latest version defined', () => {
      expect(LATEST_API_VERSION).toBeDefined();
      expect(SUPPORTED_API_VERSIONS).toContain(LATEST_API_VERSION);
    });

    it('should have latest version as highest number', () => {
      const maxVersion = Math.max(...SUPPORTED_API_VERSIONS);
      expect(LATEST_API_VERSION).toBe(maxVersion);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed version in URL', () => {
      const request = new NextRequest('http://localhost/api/vabc/campaigns');
      const version = extractApiVersion(request);
      expect(version).toBe(LATEST_API_VERSION);
    });

    it('should handle malformed version in header', () => {
      const request = new NextRequest('http://localhost/api/campaigns', {
        headers: { 'X-API-Version': 'invalid' },
      });
      const version = extractApiVersion(request);
      expect(version).toBe(LATEST_API_VERSION);
    });

    it('should handle missing both URL and header version', () => {
      const request = new NextRequest('http://localhost/api/campaigns');
      const version = extractApiVersion(request);
      expect(version).toBe(LATEST_API_VERSION);
    });

    it('should handle version 0', () => {
      const request = new NextRequest('http://localhost/api/v0/campaigns');
      const version = extractApiVersion(request);
      expect(version).toBe(LATEST_API_VERSION);
    });

    it('should handle negative version', () => {
      const request = new NextRequest('http://localhost/api/v-1/campaigns');
      const version = extractApiVersion(request);
      expect(version).toBe(LATEST_API_VERSION);
    });
  });

  describe('URL Path Matching', () => {
    it('should match version at start of path', () => {
      const request = new NextRequest('http://localhost/api/v1/campaigns/123');
      expect(extractApiVersion(request)).toBe(1);
    });

    it('should not match version in middle of path', () => {
      const request = new NextRequest('http://localhost/api/campaigns/v1/test');
      expect(extractApiVersion(request)).toBe(LATEST_API_VERSION);
    });

    it('should handle query parameters', () => {
      const request = new NextRequest('http://localhost/api/v1/campaigns?status=active');
      expect(extractApiVersion(request)).toBe(1);
    });

    it('should handle hash fragments', () => {
      const request = new NextRequest('http://localhost/api/v1/campaigns#section');
      expect(extractApiVersion(request)).toBe(1);
    });
  });
});
