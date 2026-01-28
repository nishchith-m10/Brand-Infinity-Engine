/**
 * End-to-End Workflow Integration Tests
 * 
 * Tests complete request orchestration flows from creation through
 * completion, including N8N integration, state transitions, and callbacks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requestOrchestrator } from '@/lib/orchestrator/RequestOrchestrator';
import { POST as CallbackHandler } from '@/app/api/v1/callbacks/n8n/route';
import { 
  TestDatabase, 
  TestFixtures, 
  APITestHelper, 
  TEST_CONFIG,
  MockN8NClient 
} from '../../utils/test-helpers';
import '../../utils/test-setup';

describe('End-to-End Workflow Integration Tests', () => {
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
    
    // Create brand with complete setup
    const brand = TestFixtures.createBrand({ 
      user_id: testUser.id,
      brand_voice: 'Professional and innovative',
      tone_style: 'Authoritative',
      target_audience: 'Tech professionals',
    });
    await client.from('brands').insert(brand);
    
    // Create campaign with sufficient budget
    const campaign = TestFixtures.createCampaign({
      budget_limit: 1000.00,
      budget_spent: 100.00,
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

    // Mock budget operations
    vi.doMock('@/lib/budget/reservation', () => ({
      reserveBudget: vi.fn().mockResolvedValue({
        success: true,
        reservationId: 'res_123',
        amount: 50.00
      }),
      commitBudget: vi.fn().mockResolvedValue({
        success: true
      }),
      releaseBudget: vi.fn().mockResolvedValue({
        success: true
      }),
      ESTIMATED_COSTS: {
        VIDEO_WITH_VO: 50.00,
        VIDEO_NO_VO: 30.00,
        IMAGE: 10.00,
        SCRIPT_GENERATION: 5.00,
        STRATEGIST: 3.00,
        COPYWRITER: 8.00
      }
    }));
  });

  afterEach(async () => {
    await testDb.cleanup();
    mockN8N.reset();
    vi.restoreAllMocks();
  });

  describe('Complete Video with Voiceover Workflow', () => {
    it('should process video request through entire lifecycle', async () => {
      // Step 1: Create request
      const requestData = {
        brand_name: 'Test Brand',
        product_name: 'Test Product',
        creative_brief: 'Create a promotional video for our new product',
        request_type: 'video_with_vo',
        target_platform: 'youtube',
        requirements: {
          duration: 30,
          aspect_ratio: '16:9',
          style_preset: 'Cinematic',
          voice_id: 'professional-voice'
        }
      };

      const requestId = await requestOrchestrator.createRequest(
        testUser.id,
        TEST_CONFIG.TEST_ORG_ID,
        requestData
      );

      expect(requestId).toBeDefined();
      expect(requestId).toContain(TEST_CONFIG.TEST_ORG_ID);

      // Verify initial state
      const client = await testDb.getAdminClient();
      let { data: request } = await client
        .from('content_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      expect(request.status).toBe('intake');

      // Step 2: Process request through orchestrator
      await requestOrchestrator.processRequest(requestId);

      // Should have created tasks
      const { data: tasks } = await client
        .from('request_tasks')
        .select('*')
        .eq('request_id', requestId)
        .order('sequence_order');

      expect(tasks.length).toBeGreaterThan(0);
      
      // Should have executive task first
      const executiveTask = tasks.find(t => t.agent_role === 'executive');
      expect(executiveTask).toBeTruthy();
      expect(executiveTask.sequence_order).toBe(1);

      // Should have strategist task
      const strategistTask = tasks.find(t => t.agent_role === 'strategist');
      expect(strategistTask).toBeTruthy();

      // Should have copywriter task
      const copywriterTask = tasks.find(t => t.agent_role === 'copywriter');
      expect(copywriterTask).toBeTruthy();

      // Should have producer task
      const producerTask = tasks.find(t => t.agent_role === 'producer');
      expect(producerTask).toBeTruthy();

      // Step 3: Simulate task execution and callbacks
      await testDb.getAdminClient().from('request_tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', executiveTask.id);

      await requestOrchestrator.processRequest(requestId);

      // Should transition to draft status after executive completion
      ({ data: request } = await client
        .from('content_requests')
        .select('*')
        .eq('id', requestId)
        .single());

      expect(['draft', 'production'].includes(request.status)).toBe(true);

      // Step 4: Simulate N8N callback for script generation
      const scriptCallback = {
        executionId: 'exec_123',
        requestId: requestId,
        taskId: copywriterTask.id,
        status: 'completed',
        result: {
          script_text: 'Generated script content for video',
          duration: 30,
          word_count: 75
        },
        metadata: {
          cost_usd: 8.00,
          provider: 'openai',
          model_id: 'gpt-4'
        }
      };

      const callbackRequest = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/callbacks/n8n',
        scriptCallback,
        {
          'x-n8n-signature': 'sha256=valid_signature_hash'
        }
      );

      // Mock signature verification
      vi.doMock('@/lib/security/webhook-signature', () => ({
        verifySignature: vi.fn().mockReturnValue(true)
      }));

      const callbackResponse = await CallbackHandler(callbackRequest);
      expect(callbackResponse.status).toBe(200);

      // Verify task was marked complete
      const { data: updatedTask } = await client
        .from('request_tasks')
        .select('*')
        .eq('id', copywriterTask.id)
        .single();

      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.result).toBeTruthy();

      // Step 5: Continue workflow execution
      await requestOrchestrator.processRequest(requestId);

      // Should eventually reach production status
      ({ data: request } = await client
        .from('content_requests')
        .select('*')
        .eq('id', requestId)
        .single());

      expect(['production', 'qa', 'published'].includes(request.status)).toBe(true);

      // Verify N8N workflows were triggered
      expect(mockN8N.triggerCalls.length).toBeGreaterThan(0);
      
      const videoProductionCall = mockN8N.triggerCalls.find(
        call => call.method === 'triggerVideoProduction'
      );
      expect(videoProductionCall).toBeTruthy();
      expect(videoProductionCall.params).toHaveProperty('script_text');
      expect(videoProductionCall.params).toHaveProperty('voice_id');
    });

    it('should handle failures and retries in workflow', async () => {
      // Create request
      const requestData = {
        brand_name: 'Test Brand',
        creative_brief: 'Test failure handling',
        request_type: 'video_with_vo',
      };

      const requestId = await requestOrchestrator.createRequest(
        testUser.id,
        TEST_CONFIG.TEST_ORG_ID,
        requestData
      );

      await requestOrchestrator.processRequest(requestId);

      const client = await testDb.getAdminClient();
      const { data: tasks } = await client
        .from('request_tasks')
        .select('*')
        .eq('request_id', requestId);

      const copywriterTask = tasks.find(t => t.agent_role === 'copywriter');

      // Step 1: Simulate task failure
      const failureCallback = {
        executionId: 'exec_fail_123',
        requestId: requestId,
        taskId: copywriterTask.id,
        status: 'failed',
        error: {
          code: 'LLM_ERROR',
          message: 'LLM service temporarily unavailable',
          retryable: true
        }
      };

      const callbackRequest = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/callbacks/n8n',
        failureCallback,
        {
          'x-n8n-signature': 'sha256=valid_signature_hash'
        }
      );

      vi.doMock('@/lib/security/webhook-signature', () => ({
        verifySignature: vi.fn().mockReturnValue(true)
      }));

      await CallbackHandler(callbackRequest);

      // Verify task was marked as failed
      const { data: failedTask } = await client
        .from('request_tasks')
        .select('*')
        .eq('id', copywriterTask.id)
        .single();

      expect(failedTask.status).toBe('failed');
      expect(failedTask.retry_count).toBe(1);

      // Step 2: Retry the failed task
      await requestOrchestrator.retryTask(copywriterTask.id);

      // Verify task was reset for retry
      const { data: retriedTask } = await client
        .from('request_tasks')
        .select('*')
        .eq('id', copywriterTask.id)
        .single();

      expect(['pending', 'running'].includes(retriedTask.status)).toBe(true);
      expect(retriedTask.retry_count).toBe(1);

      // Step 3: Simulate successful retry
      const successCallback = {
        executionId: 'exec_retry_123',
        requestId: requestId,
        taskId: copywriterTask.id,
        status: 'completed',
        result: {
          script_text: 'Successfully generated script on retry',
          duration: 30
        }
      };

      const retryCallbackRequest = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/callbacks/n8n',
        successCallback,
        {
          'x-n8n-signature': 'sha256=valid_signature_hash'
        }
      );

      await CallbackHandler(retryCallbackRequest);

      // Verify task completed successfully
      const { data: completedTask } = await client
        .from('request_tasks')
        .select('*')
        .eq('id', copywriterTask.id)
        .single();

      expect(completedTask.status).toBe('completed');
      expect(completedTask.result).toBeTruthy();
      expect(completedTask.retry_count).toBe(1);
    });

    it('should enforce maximum retries and dead letter queue', async () => {
      // Create request and get to failed state
      const requestData = {
        brand_name: 'Test Brand',
        creative_brief: 'Test max retries',
        request_type: 'video_with_vo',
      };

      const requestId = await requestOrchestrator.createRequest(
        testUser.id,
        TEST_CONFIG.TEST_ORG_ID,
        requestData
      );

      await requestOrchestrator.processRequest(requestId);

      const client = await testDb.getAdminClient();
      const { data: tasks } = await client
        .from('request_tasks')
        .select('*')
        .eq('request_id', requestId);

      const copywriterTask = tasks.find(t => t.agent_role === 'copywriter');

      // Simulate maximum retries (3 failures)
      for (let i = 1; i <= 3; i++) {
        const failureCallback = {
          executionId: `exec_fail_${i}`,
          requestId: requestId,
          taskId: copywriterTask.id,
          status: 'failed',
          error: {
            code: 'LLM_ERROR',
            message: `Failure attempt ${i}`,
            retryable: true
          }
        };

        const callbackRequest = APITestHelper.createAuthenticatedRequest(
          'POST',
          '/api/v1/callbacks/n8n',
          failureCallback,
          {
            'x-n8n-signature': 'sha256=valid_signature_hash'
          }
        );

        vi.doMock('@/lib/security/webhook-signature', () => ({
          verifySignature: vi.fn().mockReturnValue(true)
        }));

        await CallbackHandler(callbackRequest);

        if (i < 3) {
          // Trigger retry
          await requestOrchestrator.retryTask(copywriterTask.id);
        }
      }

      // After 3 failures, task should be permanently failed
      const { data: maxRetriedTask } = await client
        .from('request_tasks')
        .select('*')
        .eq('id', copywriterTask.id)
        .single();

      expect(maxRetriedTask.status).toBe('failed');
      expect(maxRetriedTask.retry_count).toBe(3);

      // Should be added to dead letter queue
      const { data: dlqEntries } = await client
        .from('dead_letter_queue')
        .select('*')
        .eq('task_id', copywriterTask.id);

      expect(dlqEntries.length).toBe(1);
      expect(dlqEntries[0].reason).toContain('Maximum retries exceeded');

      // Request should be marked as failed
      const { data: failedRequest } = await client
        .from('content_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      expect(failedRequest.status).toBe('failed');
    });
  });

  describe('Image Generation Workflow', () => {
    it('should process image request successfully', async () => {
      const requestData = {
        brand_name: 'Test Brand',
        creative_brief: 'Create a product image',
        request_type: 'image',
        requirements: {
          aspect_ratio: '1:1',
          style_preset: 'Realistic',
          prompt: 'High-quality product photo with professional lighting'
        }
      };

      const requestId = await requestOrchestrator.createRequest(
        testUser.id,
        TEST_CONFIG.TEST_ORG_ID,
        requestData
      );

      await requestOrchestrator.processRequest(requestId);

      // Verify simplified task structure for images
      const client = await testDb.getAdminClient();
      const { data: tasks } = await client
        .from('request_tasks')
        .select('*')
        .eq('request_id', requestId)
        .order('sequence_order');

      // Image requests should have fewer tasks (no voiceover, etc.)
      expect(tasks.length).toBeLessThan(5);
      
      // Should not have voiceover-related tasks
      const voiceoverTask = tasks.find(t => 
        t.task_name.toLowerCase().includes('voiceover') ||
        t.task_name.toLowerCase().includes('voice')
      );
      expect(voiceoverTask).toBeFalsy();

      // Should have image generation task
      const imageTask = tasks.find(t => 
        t.agent_role === 'producer' && 
        t.task_name.toLowerCase().includes('image')
      );
      expect(imageTask).toBeTruthy();

      // Simulate successful image generation
      const imageCallback = {
        executionId: 'exec_image_123',
        requestId: requestId,
        taskId: imageTask.id,
        status: 'completed',
        result: {
          image_url: 'https://example.com/generated-image.jpg',
          dimensions: { width: 1024, height: 1024 },
          style: 'Realistic'
        },
        metadata: {
          cost_usd: 10.00,
          provider: 'openai',
          model_id: 'dall-e-3'
        }
      };

      const callbackRequest = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/callbacks/n8n',
        imageCallback,
        {
          'x-n8n-signature': 'sha256=valid_signature_hash'
        }
      );

      vi.doMock('@/lib/security/webhook-signature', () => ({
        verifySignature: vi.fn().mockReturnValue(true)
      }));

      const response = await CallbackHandler(callbackRequest);
      expect(response.status).toBe(200);

      // Continue processing
      await requestOrchestrator.processRequest(requestId);

      // Verify final state
      const { data: finalRequest } = await client
        .from('content_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      expect(['qa', 'published'].includes(finalRequest.status)).toBe(true);
    });
  });

  describe('Callback Idempotency', () => {
    it('should handle duplicate callbacks idempotently', async () => {
      // Create and process request
      const requestData = {
        brand_name: 'Test Brand',
        creative_brief: 'Test idempotency',
        request_type: 'video_with_vo',
      };

      const requestId = await requestOrchestrator.createRequest(
        testUser.id,
        TEST_CONFIG.TEST_ORG_ID,
        requestData
      );

      await requestOrchestrator.processRequest(requestId);

      const client = await testDb.getAdminClient();
      const { data: tasks } = await client
        .from('request_tasks')
        .select('*')
        .eq('request_id', requestId);

      const copywriterTask = tasks.find(t => t.agent_role === 'copywriter');

      // Create callback data
      const callbackData = {
        executionId: 'exec_idempotent_123',
        requestId: requestId,
        taskId: copywriterTask.id,
        status: 'completed',
        result: {
          script_text: 'Idempotent script result',
        }
      };

      const callbackRequest = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/callbacks/n8n',
        callbackData,
        {
          'x-n8n-signature': 'sha256=valid_signature_hash'
        }
      );

      vi.doMock('@/lib/security/webhook-signature', () => ({
        verifySignature: vi.fn().mockReturnValue(true)
      }));

      // First callback
      const response1 = await CallbackHandler(callbackRequest);
      expect(response1.status).toBe(200);

      // Verify task completed
      let { data: task } = await client
        .from('request_tasks')
        .select('*')
        .eq('id', copywriterTask.id)
        .single();

      expect(task.status).toBe('completed');
      const firstCompletedAt = task.completed_at;

      // Second callback (duplicate)
      const response2 = await CallbackHandler(callbackRequest);
      expect(response2.status).toBe(200);

      // Verify task state didn't change
      ({ data: task } = await client
        .from('request_tasks')
        .select('*')
        .eq('id', copywriterTask.id)
        .single());

      expect(task.status).toBe('completed');
      expect(task.completed_at).toBe(firstCompletedAt); // Should not have changed

      // Verify idempotency key was stored
      const { data: idempotencyKeys } = await client
        .from('idempotency_keys')
        .select('*')
        .eq('key', `n8n_callback:exec_idempotent_123`);

      expect(idempotencyKeys.length).toBe(1);
    });
  });

  describe('State Machine Enforcement', () => {
    it('should enforce valid state transitions in workflow', async () => {
      // Create request
      const requestData = {
        brand_name: 'Test Brand',
        creative_brief: 'Test state transitions',
        request_type: 'video_with_vo',
      };

      const requestId = await requestOrchestrator.createRequest(
        testUser.id,
        TEST_CONFIG.TEST_ORG_ID,
        requestData
      );

      const client = await testDb.getAdminClient();

      // Try invalid transition (intake -> published)
      try {
        await client
          .from('content_requests')
          .update({ status: 'published' })
          .eq('id', requestId);
        
        await requestOrchestrator.processRequest(requestId);
        
        // Should not reach here - transition should be rejected
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('Invalid transition');
      }

      // Verify request is still in intake
      const { data: request } = await client
        .from('content_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      expect(request.status).toBe('intake');

      // Valid progression should work
      await requestOrchestrator.processRequest(requestId);
      
      // Should progress to draft or remain in intake with tasks
      const { data: updatedRequest } = await client
        .from('content_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      expect(['intake', 'draft'].includes(updatedRequest.status)).toBe(true);
    });
  });

  describe('Budget Integration', () => {
    it('should reserve and commit budget throughout workflow', async () => {
      let reserveCalls = [];
      let commitCalls = [];
      let releaseCalls = [];

      // Mock budget operations with tracking
      vi.doMock('@/lib/budget/reservation', () => ({
        reserveBudget: vi.fn().mockImplementation(async (params) => {
          reserveCalls.push(params);
          return { success: true, reservationId: `res_${Date.now()}` };
        }),
        commitBudget: vi.fn().mockImplementation(async (params) => {
          commitCalls.push(params);
          return { success: true };
        }),
        releaseBudget: vi.fn().mockImplementation(async (params) => {
          releaseCalls.push(params);
          return { success: true };
        }),
        ESTIMATED_COSTS: {
          VIDEO_WITH_VO: 50.00,
          SCRIPT_GENERATION: 8.00
        }
      }));

      // Create and process request
      const requestData = {
        brand_name: 'Test Brand',
        creative_brief: 'Test budget integration',
        request_type: 'video_with_vo',
      };

      const requestId = await requestOrchestrator.createRequest(
        testUser.id,
        TEST_CONFIG.TEST_ORG_ID,
        requestData
      );

      await requestOrchestrator.processRequest(requestId);

      // Should have reserved budget for the request
      expect(reserveCalls.length).toBeGreaterThan(0);
      expect(reserveCalls[0]).toHaveProperty('campaignId', TEST_CONFIG.TEST_CAMPAIGN_ID);
      expect(reserveCalls[0]).toHaveProperty('amount');

      // Simulate successful task completion
      const client = await testDb.getAdminClient();
      const { data: tasks } = await client
        .from('request_tasks')
        .select('*')
        .eq('request_id', requestId);

      const copywriterTask = tasks.find(t => t.agent_role === 'copywriter');

      const callbackData = {
        executionId: 'exec_budget_123',
        requestId: requestId,
        taskId: copywriterTask.id,
        status: 'completed',
        result: { script_text: 'Budget test script' },
        metadata: { cost_usd: 8.00 }
      };

      const callbackRequest = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/callbacks/n8n',
        callbackData,
        {
          'x-n8n-signature': 'sha256=valid_signature_hash'
        }
      );

      vi.doMock('@/lib/security/webhook-signature', () => ({
        verifySignature: vi.fn().mockReturnValue(true)
      }));

      await CallbackHandler(callbackRequest);

      // Should have committed budget for completed task
      expect(commitCalls.length).toBeGreaterThan(0);
      expect(commitCalls[0]).toHaveProperty('actualCost', 8.00);
    });

    it('should release budget on workflow cancellation', async () => {
      let releaseCalls = [];

      vi.doMock('@/lib/budget/reservation', () => ({
        reserveBudget: vi.fn().mockResolvedValue({
          success: true,
          reservationId: 'res_cancel_123'
        }),
        releaseBudget: vi.fn().mockImplementation(async (params) => {
          releaseCalls.push(params);
          return { success: true };
        }),
        ESTIMATED_COSTS: { VIDEO_WITH_VO: 50.00 }
      }));

      // Create request
      const requestData = {
        brand_name: 'Test Brand',
        creative_brief: 'Test budget release',
        request_type: 'video_with_vo',
      };

      const requestId = await requestOrchestrator.createRequest(
        testUser.id,
        TEST_CONFIG.TEST_ORG_ID,
        requestData
      );

      await requestOrchestrator.processRequest(requestId);

      // Cancel request
      await requestOrchestrator.cancelRequest(
        requestId,
        'User cancelled',
        testUser.id
      );

      // Should have released reserved budget
      expect(releaseCalls.length).toBeGreaterThan(0);
      expect(releaseCalls[0]).toHaveProperty('reservationId');
    });
  });
});