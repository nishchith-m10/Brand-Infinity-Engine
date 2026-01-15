/**
 * Integration Tests for Conversation Stream API
 * 
 * Tests the streaming conversation endpoint which is a high-cost operation
 * that requires rate limiting, authentication, and proper error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as StreamConversation } from '@/app/api/v1/conversation/stream/route';
import { POST as ContinueConversation } from '@/app/api/v1/conversation/[id]/continue/route';
import { 
  TestDatabase, 
  TestFixtures, 
  APITestHelper, 
  TEST_CONFIG,
  MockN8NClient 
} from '../../utils/test-helpers';
import '../../utils/test-setup';

describe('Conversation Stream API Integration Tests', () => {
  let testDb: TestDatabase;
  let testUser: any;
  let testSession: any;
  let mockN8N: MockN8NClient;

  beforeEach(async () => {
    testDb = new TestDatabase();
    await testDb.cleanup();

    // Create test user and session
    const { user, session } = await testDb.createTestUser();
    testUser = user;
    testSession = session;

    // Set up test data
    const client = await testDb.getAdminClient();
    
    // Create brand with identity
    const brand = TestFixtures.createBrand({ 
      user_id: testUser.id,
      brand_voice: 'Professional yet approachable',
      tone_style: 'Conversational',
      target_audience: 'Business professionals',
    });
    await client.from('brands').insert(brand);
    
    // Create campaign
    const campaign = TestFixtures.createCampaign({
      budget_limit: 500.00,
      budget_spent: 100.00, // Some budget already used
    });
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

    // Initialize mock N8N client
    mockN8N = MockN8NClient.getInstance();
    mockN8N.reset();
  });

  afterEach(async () => {
    await testDb.cleanup();
    mockN8N.reset();
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/conversation/stream', () => {
    it('should handle streaming conversation request successfully', async () => {
      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Create a video advertisement for our new product launch',
        provider: 'openai',
        model_id: 'gpt-4',
        context: {
          campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
          campaign_name: 'Test Campaign',
          identity: {
            brand_name: 'Test Brand',
            brand_voice: 'Professional yet approachable',
            tagline: 'Innovation meets excellence',
            target_audience: 'Business professionals',
            tone_style: 'Conversational'
          }
        }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        conversationData
      );

      const response = await StreamConversation(request);

      // Stream endpoint should return 200 even for streaming responses
      expect(response.status).toBe(200);
      
      // Check that it's a streaming response
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('connection')).toBe('keep-alive');
    });

    it('should enforce rate limiting on streaming requests', async () => {
      // Mock rate limiter to simulate limit exceeded
      vi.doMock('@/lib/utils/rate-limit-helpers', () => ({
        checkRateLimit: vi.fn().mockResolvedValue({
          success: false,
          limit: 20,
          remaining: 0,
          reset: Date.now() + 60000,
          retryAfter: 60
        })
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Rate limited message',
        provider: 'openai',
        model_id: 'gpt-4',
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        conversationData
      );

      const response = await StreamConversation(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(429);
      APITestHelper.assertErrorResponse(result, 'RATE_LIMIT_EXCEEDED');
      
      // Should include rate limit headers
      expect(response.headers.get('x-ratelimit-limit')).toBeTruthy();
      expect(response.headers.get('x-ratelimit-remaining')).toBeTruthy();
      expect(response.headers.get('retry-after')).toBeTruthy();
    });

    it('should enforce budget limits before processing', async () => {
      // Mock budget reservation to fail due to insufficient funds
      vi.doMock('@/lib/budget/reservation', () => ({
        reserveBudget: vi.fn().mockResolvedValue({
          success: false,
          error: 'Insufficient budget',
          available: 50.00,
          required: 75.00
        }),
        ESTIMATED_COSTS: {
          CONVERSATION_STREAM: 2.00
        }
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Expensive operation that should be blocked',
        provider: 'openai',
        model_id: 'gpt-4',
        context: {
          campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
        }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        conversationData
      );

      const response = await StreamConversation(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(402); // Payment Required
      APITestHelper.assertErrorResponse(result, 'INSUFFICIENT_BUDGET');
      expect(result.error.details).toHaveProperty('available');
      expect(result.error.details).toHaveProperty('required');
    });

    it('should require authentication', async () => {
      // Mock unauthenticated user
      vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated' }
          })
        }
      });

      const request = APITestHelper.createUnauthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        {
          session_id: `session_${Date.now()}`,
          message: 'Unauthenticated message'
        }
      );

      const response = await StreamConversation(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(401);
      APITestHelper.assertErrorResponse(result, 'UNAUTHENTICATED');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing session_id and message
        provider: 'openai',
        model_id: 'gpt-4'
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        invalidData
      );

      const response = await StreamConversation(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(400);
      APITestHelper.assertErrorResponse(result, 'VALIDATION_ERROR');
      expect(result.error.details).toHaveProperty('errors');
    });

    it('should handle LLM service failures gracefully', async () => {
      // Mock LLM service to throw error
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockRejectedValue(new Error('LLM service unavailable'))
        })
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'This will fail',
        provider: 'openai',
        model_id: 'gpt-4'
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        conversationData
      );

      const response = await StreamConversation(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(500);
      APITestHelper.assertErrorResponse(result, 'LLM_ERROR');
    });

    it('should include brand context in LLM requests', async () => {
      const mockLLMService = {
        streamCompletion: vi.fn().mockResolvedValue({
          async *[Symbol.asyncIterator]() {
            yield 'Mocked streaming response based on brand context';
          }
        })
      };

      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue(mockLLMService)
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Create content that matches our brand voice',
        provider: 'openai',
        model_id: 'gpt-4',
        context: {
          campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
          identity: {
            brand_name: 'Test Brand',
            brand_voice: 'Professional yet approachable',
            tone_style: 'Conversational'
          }
        }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        conversationData
      );

      await StreamConversation(request);

      // Verify LLM service was called with brand context
      expect(mockLLMService.streamCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          system_prompt: expect.stringContaining('Test Brand'),
          context: expect.objectContaining({
            brand_voice: 'Professional yet approachable'
          })
        })
      );
    });

    it('should log conversation events for audit trail', async () => {
      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Track this conversation',
        provider: 'openai',
        model_id: 'gpt-4',
        context: {
          campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID
        }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        conversationData
      );

      await StreamConversation(request);

      // Verify conversation event was logged
      const client = await testDb.getAdminClient();
      const { data: events } = await client
        .from('conversation_events')
        .select('*')
        .eq('session_id', conversationData.session_id)
        .eq('event_type', 'message_sent');

      expect(events?.length).toBeGreaterThan(0);
      const event = events?.[0];
      expect(event.event_data.message).toBe(conversationData.message);
      expect(event.event_data.provider).toBe(conversationData.provider);
      expect(event.event_data.model_id).toBe(conversationData.model_id);
    });
  });

  describe('POST /api/v1/conversation/[id]/continue', () => {
    let conversationId: string;

    beforeEach(async () => {
      // Create an existing conversation
      conversationId = `conv_${Date.now()}`;
      const client = await testDb.getAdminClient();
      
      await client.from('conversations').insert({
        id: conversationId,
        user_id: testUser.id,
        campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
        status: 'active',
        context: {
          brand_name: 'Test Brand',
          campaign_name: 'Test Campaign'
        },
        created_at: new Date().toISOString()
      });

      // Add some conversation history
      await client.from('conversation_messages').insert([
        {
          conversation_id: conversationId,
          role: 'user',
          content: 'Previous message from user',
          created_at: new Date(Date.now() - 60000).toISOString()
        },
        {
          conversation_id: conversationId,
          role: 'assistant',
          content: 'Previous response from assistant',
          created_at: new Date(Date.now() - 30000).toISOString()
        }
      ]);
    });

    it('should continue existing conversation successfully', async () => {
      const continueData = {
        message: 'Continue our discussion about the video concept',
        provider: 'openai',
        model_id: 'gpt-4'
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        `/api/v1/conversation/${conversationId}/continue`,
        continueData
      );

      const mockParams = { params: { id: conversationId } };
      const response = await ContinueConversation(request, mockParams);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
    });

    it('should include conversation history in context', async () => {
      const mockLLMService = {
        streamCompletion: vi.fn().mockResolvedValue({
          async *[Symbol.asyncIterator]() {
            yield 'Response with conversation history context';
          }
        })
      };

      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue(mockLLMService)
      }));

      const continueData = {
        message: 'What did we discuss about branding?',
        provider: 'openai',
        model_id: 'gpt-4'
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        `/api/v1/conversation/${conversationId}/continue`,
        continueData
      );

      const mockParams = { params: { id: conversationId } };
      await ContinueConversation(request, mockParams);

      // Verify LLM service was called with conversation history
      expect(mockLLMService.streamCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Previous message from user'
            }),
            expect.objectContaining({
              role: 'assistant',
              content: 'Previous response from assistant'
            })
          ])
        })
      );
    });

    it('should return 404 for non-existent conversation', async () => {
      const nonExistentId = 'conv_non_existent';
      const continueData = {
        message: 'Continue non-existent conversation',
        provider: 'openai',
        model_id: 'gpt-4'
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        `/api/v1/conversation/${nonExistentId}/continue`,
        continueData
      );

      const mockParams = { params: { id: nonExistentId } };
      const response = await ContinueConversation(request, mockParams);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(404);
      APITestHelper.assertErrorResponse(result, 'CONVERSATION_NOT_FOUND');
    });

    it('should enforce ownership of conversations', async () => {
      // Create conversation owned by different user
      const otherUserId = 'other-user-id';
      const otherConversationId = `conv_other_${Date.now()}`;
      
      const client = await testDb.getAdminClient();
      await client.from('conversations').insert({
        id: otherConversationId,
        user_id: otherUserId,
        campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
        status: 'active',
        context: {},
        created_at: new Date().toISOString()
      });

      const continueData = {
        message: 'Try to access other user\'s conversation',
        provider: 'openai',
        model_id: 'gpt-4'
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        `/api/v1/conversation/${otherConversationId}/continue`,
        continueData
      );

      const mockParams = { params: { id: otherConversationId } };
      const response = await ContinueConversation(request, mockParams);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(403);
      APITestHelper.assertErrorResponse(result, 'UNAUTHORIZED');
    });
  });

  describe('Cost tracking and budget enforcement', () => {
    it('should track costs for successful streaming requests', async () => {
      // Mock successful budget operations
      vi.doMock('@/lib/budget/reservation', () => ({
        reserveBudget: vi.fn().mockResolvedValue({
          success: true,
          reservationId: 'res_123'
        }),
        commitBudget: vi.fn().mockResolvedValue({
          success: true
        }),
        ESTIMATED_COSTS: {
          CONVERSATION_STREAM: 2.00
        }
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Generate content with cost tracking',
        provider: 'openai',
        model_id: 'gpt-4',
        context: {
          campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID
        }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        conversationData
      );

      await StreamConversation(request);

      // Verify cost was tracked
      const client = await testDb.getAdminClient();
      const { data: costEntries } = await client
        .from('cost_ledger')
        .select('*')
        .eq('campaign_id', TEST_CONFIG.TEST_CAMPAIGN_ID)
        .eq('operation_type', 'conversation_stream');

      expect(costEntries?.length).toBeGreaterThan(0);
      const costEntry = costEntries?.[0];
      expect(costEntry.cost_usd).toBeGreaterThan(0);
      expect(costEntry.provider).toBe('openai');
      expect(costEntry.model_id).toBe('gpt-4');
    });

    it('should handle budget reservation failures gracefully', async () => {
      // Mock budget reservation failure
      vi.doMock('@/lib/budget/reservation', () => ({
        reserveBudget: vi.fn().mockResolvedValue({
          success: false,
          error: 'Campaign budget exhausted',
          available: 0.00,
          required: 2.00
        })
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'This should be blocked by budget',
        provider: 'openai',
        model_id: 'gpt-4',
        context: {
          campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID
        }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        conversationData
      );

      const response = await StreamConversation(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(402);
      APITestHelper.assertErrorResponse(result, 'INSUFFICIENT_BUDGET');
      
      // Verify no cost was tracked
      const client = await testDb.getAdminClient();
      const { data: costEntries } = await client
        .from('cost_ledger')
        .select('*')
        .eq('campaign_id', TEST_CONFIG.TEST_CAMPAIGN_ID);
        
      expect(costEntries?.length).toBe(0);
    });
  });
});