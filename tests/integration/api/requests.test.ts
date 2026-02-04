/**
 * Integration Tests for Content Request API Routes
 * 
 * Tests the complete flow of content request creation, management,
 * and processing including authentication, validation, and database operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as CreateRequest, GET as ListRequests } from '@/app/api/v1/requests/route';
import { GET as GetRequest, PATCH as UpdateRequest } from '@/app/api/v1/requests/[id]/route';
import { POST as TransitionRequest } from '@/app/api/v1/requests/[id]/transition/route';
import { 
  TestDatabase, 
  TestFixtures, 
  APITestHelper, 
  TEST_CONFIG 
} from '../utils/test-helpers';
import '../utils/test-setup';

describe('Content Request API Integration Tests', () => {
  let testDb: TestDatabase;
  let testUser: any;
  let testSession: any;

  beforeEach(async () => {
    testDb = new TestDatabase();
    await testDb.cleanup();

    // Create test user and session
    const { user, session } = await testDb.createTestUser();
    testUser = user;
    testSession = session;

    // Set up test data
    const client = await testDb.getAdminClient();
    
    // Create brand
    const brand = TestFixtures.createBrand({ user_id: testUser.id });
    await client.from('brands').insert(brand);
    
    // Create campaign
    const campaign = TestFixtures.createCampaign();
    await client.from('campaigns').insert(campaign);

    // Mock authentication
    vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: testUser },
          error: null
        })
      },
      from: client.from.bind(client),
      rpc: client.rpc.bind(client)
    });
  });

  afterEach(async () => {
    await testDb.cleanup();
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/requests', () => {
    it('should create a new content request with valid data', async () => {
      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
        title: 'Test Video Request',
        type: 'video_with_vo',
        requirements: {
          prompt: 'Create a promotional video for our new product launch',
          duration: 30,
          aspect_ratio: '16:9',
          style_preset: 'Cinematic',
          shot_type: 'Medium',
          voice_id: 'test-voice-id'
        },
        settings: {
          provider: 'openai',
          tier: 'standard',
          auto_script: true,
          selected_kb_ids: [],
          selected_asset_ids: []
        }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      APITestHelper.assertSuccessResponse(result.data, ['id', 'status', 'estimate']);
      
      // Verify request was created in database
      const client = await testDb.getAdminClient();
      const { data: createdRequest } = await client
        .from('content_requests')
        .select('*')
        .eq('id', result.data.data.id)
        .single();

      expect(createdRequest).toBeTruthy();
      expect(createdRequest.title).toBe(requestData.title);
      expect(createdRequest.status).toBe('intake');
      expect(createdRequest.brand_id).toBe(requestData.brand_id);
    });

    it('should reject request with missing required fields', async () => {
      const invalidData = {
        // Missing brand_id
        title: 'Test Video Request',
        type: 'video_with_vo',
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        invalidData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(400);
      APITestHelper.assertErrorResponse(result.data, 'VALIDATION_ERROR');
    });

    it('should enforce rate limiting', async () => {
      // Mock rate limiter to return failure
      const mockRateLimit = vi.fn().mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 60000
      });

      vi.doMock('@/lib/utils/rate-limit-helpers', () => ({
        checkRateLimit: mockRateLimit
      }));

      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        title: 'Rate Limited Request',
        type: 'video_with_vo',
        requirements: { prompt: 'Test' },
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(429);
      APITestHelper.assertErrorResponse(result.data, 'RATE_LIMIT_EXCEEDED');
    });

    it('should reject unauthenticated requests', async () => {
      const request = APITestHelper.createUnauthenticatedRequest(
        'POST',
        '/api/v1/requests',
        { title: 'Unauthenticated Request' }
      );

      // Mock unauthenticated response
      vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated' }
          })
        }
      });

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(401);
      APITestHelper.assertErrorResponse(result.data, 'UNAUTHENTICATED');
    });

    it('should create request with free provider without budget reservation', async () => {
      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
        title: 'Free Provider Test',
        type: 'image',
        requirements: {
          prompt: 'Create a test image using Pollinations',
          aspect_ratio: '1:1',
          style_preset: 'Realistic',
        },
        settings: {
          provider: 'pollinations', // Free provider
          tier: 'standard',
          auto_script: false,
        }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      // Should succeed with 201 status
      expect(result.status).toBe(201);
      APITestHelper.assertSuccessResponse(result.data, ['id', 'status']);
      
      // Cost should be zero
      expect(result.data.data.estimated_cost).toBe(0);
      
      // Verify request was created without budget reservation
      const client = await testDb.getAdminClient();
      const { data: createdRequest } = await client
        .from('content_requests')
        .select('*')
        .eq('id', result.data.data.id)
        .single();

      expect(createdRequest).toBeTruthy();
      expect(createdRequest.estimated_cost).toBe(0);
    });

    it('should create request with zero budget campaign when using free provider', async () => {
      // Create a campaign with zero budget
      const client = await testDb.getAdminClient();
      const zeroBudgetCampaign = TestFixtures.createCampaign({ budget_limit: 0 });
      await client.from('campaigns').insert(zeroBudgetCampaign);

      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        campaign_id: zeroBudgetCampaign.id,
        title: 'Zero Budget Free Provider Test',
        type: 'image',
        requirements: {
          prompt: 'Test with zero budget campaign',
          aspect_ratio: '16:9',
        },
        settings: {
          provider: 'pollinations',
          tier: 'standard',
        }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      // Should succeed even with zero budget campaign since provider is free
      expect(result.status).toBe(201);
      expect(result.data.data.estimated_cost).toBe(0);
    });
  });

  describe('GET /api/v1/requests', () => {
    beforeEach(async () => {
      // Create test requests
      const client = await testDb.getAdminClient();
      const requests = [
        TestFixtures.createContentRequest({ title: 'Request 1', status: 'intake' }),
        TestFixtures.createContentRequest({ title: 'Request 2', status: 'draft' }),
        TestFixtures.createContentRequest({ title: 'Request 3', status: 'production' }),
      ];

      await client.from('content_requests').insert(requests);
    });

    it('should list user\'s content requests', async () => {
      const request = APITestHelper.createAuthenticatedRequest(
        'GET',
        '/api/v1/requests'
      );

      const response = await ListRequests(request);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      APITestHelper.assertSuccessResponse(result.data, ['requests', 'meta']);
      
      expect(Array.isArray(result.data.data.requests)).toBe(true);
      expect(result.data.data.requests.length).toBeGreaterThan(0);
      expect(result.data.data.meta).toHaveProperty('count');
      expect(result.data.data.meta).toHaveProperty('limit');
    });

    it('should filter requests by status', async () => {
      const request = APITestHelper.createAuthenticatedRequest(
        'GET',
        '/api/v1/requests?status=draft'
      );

      const response = await ListRequests(request);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      result.data.data.requests.forEach((req: any) => {
        expect(req.status).toBe('draft');
      });
    });

    it('should support pagination', async () => {
      const request = APITestHelper.createAuthenticatedRequest(
        'GET',
        '/api/v1/requests?limit=1&offset=0'
      );

      const response = await ListRequests(request);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      expect(result.data.data.requests.length).toBe(1);
      expect(result.data.data.meta.limit).toBe(1);
      expect(result.data.data.meta.offset).toBe(0);
    });
  });

  describe('GET /api/v1/requests/[id]', () => {
    let testRequestId: string;

    beforeEach(async () => {
      const client = await testDb.getAdminClient();
      const request = TestFixtures.createContentRequest();
      await client.from('content_requests').insert(request);
      testRequestId = request.id;
    });

    it('should retrieve a specific content request', async () => {
      const request = APITestHelper.createAuthenticatedRequest(
        'GET',
        `/api/v1/requests/${testRequestId}`
      );

      // Mock the route parameters
      const mockParams = { params: { id: testRequestId } };
      const response = await GetRequest(request, mockParams);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      APITestHelper.assertSuccessResponse(result.data);
      expect(result.data.data.id).toBe(testRequestId);
      expect(result.data.data).toHaveProperty('title');
      expect(result.data.data).toHaveProperty('status');
      expect(result.data.data).toHaveProperty('requirements');
    });

    it('should return 404 for non-existent request', async () => {
      const nonExistentId = 'non-existent-id';
      const request = APITestHelper.createAuthenticatedRequest(
        'GET',
        `/api/v1/requests/${nonExistentId}`
      );

      const mockParams = { params: { id: nonExistentId } };
      const response = await GetRequest(request, mockParams);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(404);
      APITestHelper.assertErrorResponse(result.data, 'NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/requests/[id]', () => {
    let testRequestId: string;

    beforeEach(async () => {
      const client = await testDb.getAdminClient();
      const request = TestFixtures.createContentRequest();
      await client.from('content_requests').insert(request);
      testRequestId = request.id;
    });

    it('should update non-status fields', async () => {
      const updateData = {
        title: 'Updated Title',
        requirements: {
          prompt: 'Updated prompt for video generation',
          duration: 45,
        }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'PATCH',
        `/api/v1/requests/${testRequestId}`,
        updateData
      );

      const mockParams = { params: { id: testRequestId } };
      const response = await UpdateRequest(request, mockParams);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      APITestHelper.assertSuccessResponse(result.data);
      expect(result.data.data.title).toBe(updateData.title);
      expect(result.data.data.requirements.prompt).toBe(updateData.requirements.prompt);
    });

    it('should reject status updates via PATCH', async () => {
      const updateData = {
        title: 'Updated Title',
        status: 'draft' // This should be rejected
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'PATCH',
        `/api/v1/requests/${testRequestId}`,
        updateData
      );

      const mockParams = { params: { id: testRequestId } };
      const response = await UpdateRequest(request, mockParams);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(400);
      APITestHelper.assertErrorResponse(result.data, 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/requests/[id]/transition', () => {
    let testRequestId: string;

    beforeEach(async () => {
      const client = await testDb.getAdminClient();
      const request = TestFixtures.createContentRequest({ status: 'intake' });
      await client.from('content_requests').insert(request);
      testRequestId = request.id;
    });

    it('should allow valid status transitions', async () => {
      const transitionData = {
        targetStatus: 'draft',
        reason: 'Moving to draft phase'
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        `/api/v1/requests/${testRequestId}/transition`,
        transitionData
      );

      const mockParams = { params: { id: testRequestId } };
      const response = await TransitionRequest(request, mockParams);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(200);
      APITestHelper.assertSuccessResponse(result.data);
      expect(result.data.data.status).toBe('draft');
      
      // Verify database update
      const client = await testDb.getAdminClient();
      const { data: updatedRequest } = await client
        .from('content_requests')
        .select('status')
        .eq('id', testRequestId)
        .single();
      
      expect(updatedRequest.status).toBe('draft');
    });

    it('should reject invalid status transitions', async () => {
      const transitionData = {
        targetStatus: 'published', // Invalid transition from intake
        reason: 'Trying invalid transition'
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        `/api/v1/requests/${testRequestId}/transition`,
        transitionData
      );

      const mockParams = { params: { id: testRequestId } };
      const response = await TransitionRequest(request, mockParams);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(400);
      APITestHelper.assertErrorResponse(result.data, 'INVALID_TRANSITION');
      expect(result.data.error.details).toHaveProperty('allowedTransitions');
    });

    it('should log transition events', async () => {
      const transitionData = {
        targetStatus: 'draft',
        reason: 'Moving to draft phase'
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        `/api/v1/requests/${testRequestId}/transition`,
        transitionData
      );

      const mockParams = { params: { id: testRequestId } };
      await TransitionRequest(request, mockParams);
      
      // Verify event was logged
      const client = await testDb.getAdminClient();
      const { data: events } = await client
        .from('request_events')
        .select('*')
        .eq('request_id', testRequestId)
        .eq('event_type', 'status_transition');
      
      expect(events?.length).toBeGreaterThan(0);
      const event = events?.[0];
      expect(event.event_data.from_status).toBe('intake');
      expect(event.event_data.to_status).toBe('draft');
      expect(event.event_data.reason).toBe(transitionData.reason);
    });
  });

  describe('Cross-cutting concerns', () => {
    it('should handle concurrent requests without race conditions', async () => {
      // Create multiple concurrent requests to the same endpoint
      const promises = Array.from({ length: 5 }, (_, i) => {
        const requestData = {
          brand_id: TEST_CONFIG.TEST_BRAND_ID,
          campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
          title: `Concurrent Request ${i}`,
          type: 'video_with_vo',
          requirements: {
            prompt: `Concurrent test prompt ${i}`,
          }
        };

        const request = APITestHelper.createAuthenticatedRequest(
          'POST',
          '/api/v1/requests',
          requestData
        );

        return CreateRequest(request);
      });

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      for (const response of responses) {
        const result = await APITestHelper.parseResponse(response);
        expect(result.status).toBe(200);
        APITestHelper.assertSuccessResponse(result.data);
      }

      // Verify all requests were created with unique IDs
      const ids = new Set();
      for (const response of responses) {
        const result = await APITestHelper.parseResponse(response);
        expect(ids.has(result.data.data.id)).toBe(false);
        ids.add(result.data.data.id);
      }
    });

    it('should handle database connection failures gracefully', async () => {
      // Mock database failure
      const client = await testDb.getAdminClient();
      const originalFrom = client.from;
      client.from = vi.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        title: 'DB Failure Test',
        type: 'video_with_vo',
        requirements: { prompt: 'Test' },
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(result.status).toBe(500);
      APITestHelper.assertErrorResponse(result.data, 'DATABASE_ERROR');

      // Restore original function
      client.from = originalFrom;
    });

    it('should include proper CORS headers', async () => {
      const request = APITestHelper.createAuthenticatedRequest(
        'GET',
        '/api/v1/requests'
      );

      const response = await ListRequests(request);
      const result = await APITestHelper.parseResponse(response);

      // Should include CORS headers
      expect(result.headers).toHaveProperty('access-control-allow-origin');
      expect(result.headers).toHaveProperty('access-control-allow-methods');
      expect(result.headers).toHaveProperty('access-control-allow-headers');
    });
  });
});