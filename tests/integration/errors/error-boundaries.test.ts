/**
 * Error Boundary Integration Tests
 * 
 * Tests error handling across system boundaries including external service
 * failures, database errors, network issues, and graceful degradation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as CreateRequest } from '@/app/api/v1/requests/route';
import { POST as StreamConversation } from '@/app/api/v1/conversation/stream/route';
import { POST as CallbackHandler } from '@/app/api/v1/callbacks/n8n/route';
import { requestOrchestrator } from '@/lib/orchestrator/RequestOrchestrator';
import { 
  TestDatabase, 
  TestFixtures, 
  APITestHelper, 
  TEST_CONFIG,
  MockN8NClient 
} from '../../utils/test-helpers';
import '../../utils/test-setup';

describe('Error Boundary Integration Tests', () => {
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
    
    // Create brand and campaign
    const brand = TestFixtures.createBrand({ user_id: testUser.id });
    await client.from('brands').insert(brand);
    
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

    mockN8N = MockN8NClient.getInstance();
    mockN8N.reset();
  });

  afterEach(async () => {
    await testDb.cleanup();
    mockN8N.reset();
    vi.restoreAllMocks();
  });

  describe('Database Error Handling', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database connection failure
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockImplementation(() => {
          throw new Error('Connection to database failed');
        }),
        rpc: vi.fn()
      };

      vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue(mockSupabase);

      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        title: 'DB Connection Failure Test',
        type: 'video_with_vo',
        requirements: { prompt: 'Test database failure' }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(500);
      APITestHelper.assertErrorResponse(result, 'DATABASE_ERROR');
      expect(result.error.message).toContain('Database operation failed');
      expect(result.error.details).toHaveProperty('retryable', true);
    });

    it('should handle database timeout errors', async () => {
      // Mock database timeout
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              return new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Query timeout')), 100);
              });
            })
          })
        })),
        rpc: vi.fn()
      };

      vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue(mockSupabase);

      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        title: 'DB Timeout Test',
        type: 'image',
        requirements: { prompt: 'Test timeout' }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(500);
      APITestHelper.assertErrorResponse(result, 'DATABASE_ERROR');
      expect(result.error.details).toHaveProperty('timeout', true);
    });

    it('should handle constraint violation errors', async () => {
      // Mock foreign key constraint violation
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table) => {
          if (table === 'brands') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: TestFixtures.createBrand({ user_id: testUser.id }),
                    error: null
                  })
                })
              })
            };
          }
          if (table === 'content_requests') {
            return {
              insert: vi.fn().mockResolvedValue({
                data: null,
                error: {
                  code: '23503',
                  message: 'insert or update on table "content_requests" violates foreign key constraint',
                  details: 'Key (campaign_id)=(non-existent) is not present in table "campaigns".'
                }
              })
            };
          }
          return { select: vi.fn(), insert: vi.fn() };
        }),
        rpc: vi.fn()
      };

      vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue(mockSupabase);

      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        campaign_id: 'non-existent-campaign',
        title: 'Constraint Violation Test',
        type: 'video_with_vo',
        requirements: { prompt: 'Test constraint violation' }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(400);
      APITestHelper.assertErrorResponse(result, 'VALIDATION_ERROR');
      expect(result.error.message).toContain('Invalid campaign reference');
    });

    it('should handle transaction rollback scenarios', async () => {
      // Mock transaction that fails partway through
      let insertCount = 0;
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table) => {
          if (table === 'brands') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: TestFixtures.createBrand({ user_id: testUser.id }),
                    error: null
                  })
                })
              })
            };
          }
          if (table === 'content_requests') {
            return {
              insert: vi.fn().mockImplementation(() => {
                insertCount++;
                if (insertCount === 1) {
                  // First insert succeeds
                  return Promise.resolve({
                    data: [{ id: 'created-request-id' }],
                    error: null
                  });
                } else {
                  // Subsequent operations in transaction fail
                  throw new Error('Transaction failed - rolling back');
                }
              })
            };
          }
          if (table === 'request_tasks') {
            return {
              insert: vi.fn().mockImplementation(() => {
                throw new Error('Task creation failed');
              })
            };
          }
          return { select: vi.fn(), insert: vi.fn() };
        }),
        rpc: vi.fn()
      };

      vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue(mockSupabase);

      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
        title: 'Transaction Rollback Test',
        type: 'video_with_vo',
        requirements: { prompt: 'Test transaction failure' }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(500);
      APITestHelper.assertErrorResponse(result, 'DATABASE_ERROR');
      
      // Verify no partial data remains
      const client = await testDb.getAdminClient();
      const { data: requests } = await client
        .from('content_requests')
        .select('*')
        .eq('title', 'Transaction Rollback Test');
        
      expect(requests?.length || 0).toBe(0);
    });
  });

  describe('External Service Error Handling', () => {
    it('should handle LLM service failures with circuit breaker', async () => {
      let failureCount = 0;
      
      // Mock LLM service that fails multiple times
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockImplementation(async () => {
            failureCount++;
            if (failureCount <= 3) {
              throw new Error(`LLM service unavailable (attempt ${failureCount})`);
            }
            // Return success after 3 failures
            return {
              async *[Symbol.asyncIterator]() {
                yield 'Service recovered successfully';
              }
            };
          })
        })
      }));

      // Mock circuit breaker behavior
      let circuitOpen = false;
      vi.doMock('@/lib/orchestrator/CircuitBreaker', () => ({
        circuitBreakers: {
          openai: {
            canMakeRequest: vi.fn().mockImplementation(() => !circuitOpen),
            recordFailure: vi.fn().mockImplementation(() => {
              if (failureCount >= 3) circuitOpen = true;
            }),
            recordSuccess: vi.fn().mockImplementation(() => {
              circuitOpen = false;
            })
          }
        }
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Test LLM failure handling',
        provider: 'openai',
        model_id: 'gpt-4'
      };

      // First few requests should fail
      for (let i = 1; i <= 3; i++) {
        const request = APITestHelper.createAuthenticatedRequest(
          'POST',
          '/api/v1/conversation/stream',
          conversationData
        );

        const response = await StreamConversation(request);
        const result = await APITestHelper.parseResponse(response);

        expect(response.status).toBe(500);
        APITestHelper.assertErrorResponse(result, 'LLM_ERROR');
      }

      // Circuit should be open now
      expect(circuitOpen).toBe(true);

      // Next request should be rejected by circuit breaker
      const circuitBreakerRequest = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        conversationData
      );

      const circuitResponse = await StreamConversation(circuitBreakerRequest);
      const circuitResult = await APITestHelper.parseResponse(circuitResponse);

      expect(circuitResponse.status).toBe(503);
      APITestHelper.assertErrorResponse(circuitResult, 'SERVICE_UNAVAILABLE');
      expect(circuitResult.error.message).toContain('circuit breaker');
    });

    it('should handle N8N webhook failures with retries', async () => {
      let attemptCount = 0;
      
      // Mock N8N client that fails first few times
      mockN8N.triggerContentGeneration = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error(`N8N webhook failed (attempt ${attemptCount})`);
        }
        return {
          execution_id: `exec_success_${Date.now()}`,
          webhook_url: 'https://n8n.example.com/webhook/success'
        };
      });

      // Create request and trigger N8N workflow
      const requestData = {
        brand_name: 'Test Brand',
        creative_brief: 'Test N8N failure handling',
        request_type: 'video_with_vo',
      };

      const requestId = await requestOrchestrator.createRequest(
        testUser.id,
        TEST_CONFIG.TEST_ORG_ID,
        requestData
      );

      // Process request - should retry N8N failures
      await requestOrchestrator.processRequest(requestId);

      // Should have attempted N8N trigger multiple times
      expect(attemptCount).toBe(3); // Failed twice, succeeded on third attempt
      
      // Verify request eventually succeeded
      const client = await testDb.getAdminClient();
      const { data: request } = await client
        .from('content_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      expect(['draft', 'production'].includes(request.status)).toBe(true);
    });

    it('should handle third-party API rate limiting', async () => {
      // Mock rate-limited LLM service
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockRejectedValue(
            Object.assign(new Error('Rate limit exceeded'), {
              status: 429,
              headers: {
                'retry-after': '60',
                'x-ratelimit-remaining': '0'
              }
            })
          )
        })
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Test rate limiting',
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

      expect(response.status).toBe(429);
      APITestHelper.assertErrorResponse(result, 'EXTERNAL_RATE_LIMIT');
      expect(result.error.details).toHaveProperty('retryAfter', 60);
      expect(result.error.details).toHaveProperty('provider', 'openai');
    });

    it('should handle service authentication failures', async () => {
      // Mock authentication failure from external service
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockRejectedValue(
            Object.assign(new Error('Invalid API key'), {
              status: 401,
              code: 'invalid_api_key'
            })
          )
        })
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Test auth failure',
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
      APITestHelper.assertErrorResponse(result, 'EXTERNAL_AUTH_ERROR');
      expect(result.error.message).toContain('Authentication failed with external service');
      expect(result.error.details).toHaveProperty('provider', 'openai');
      expect(result.error.details).toHaveProperty('retryable', false);
    });
  });

  describe('Network and Connectivity Errors', () => {
    it('should handle network timeouts gracefully', async () => {
      // Mock network timeout
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockImplementation(() => {
            return new Promise((_, reject) => {
              setTimeout(() => {
                reject(Object.assign(new Error('Network timeout'), {
                  code: 'TIMEOUT',
                  timeout: true
                }));
              }, 100);
            });
          })
        })
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Test network timeout',
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

      expect(response.status).toBe(504);
      APITestHelper.assertErrorResponse(result, 'NETWORK_TIMEOUT');
      expect(result.error.details).toHaveProperty('timeout', true);
      expect(result.error.details).toHaveProperty('retryable', true);
    });

    it('should handle DNS resolution failures', async () => {
      // Mock DNS failure
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockRejectedValue(
            Object.assign(new Error('getaddrinfo ENOTFOUND api.openai.com'), {
              code: 'ENOTFOUND',
              hostname: 'api.openai.com'
            })
          )
        })
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Test DNS failure',
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

      expect(response.status).toBe(502);
      APITestHelper.assertErrorResponse(result, 'NETWORK_ERROR');
      expect(result.error.message).toContain('Network connectivity issue');
      expect(result.error.details).toHaveProperty('hostname', 'api.openai.com');
    });

    it('should handle SSL/TLS certificate errors', async () => {
      // Mock certificate error
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockRejectedValue(
            Object.assign(new Error('certificate verify failed'), {
              code: 'CERT_UNTRUSTED'
            })
          )
        })
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Test SSL failure',
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

      expect(response.status).toBe(502);
      APITestHelper.assertErrorResponse(result, 'TLS_ERROR');
      expect(result.error.message).toContain('TLS/SSL verification failed');
      expect(result.error.details).toHaveProperty('retryable', false);
    });
  });

  describe('Resource Exhaustion Errors', () => {
    it('should handle memory exhaustion gracefully', async () => {
      // Mock out-of-memory condition
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockRejectedValue(
            new Error('JavaScript heap out of memory')
          )
        })
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Very large prompt that consumes excessive memory '.repeat(1000),
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

      expect(response.status).toBe(507);
      APITestHelper.assertErrorResponse(result, 'RESOURCE_EXHAUSTED');
      expect(result.error.message).toContain('Insufficient system resources');
    });

    it('should handle disk space exhaustion', async () => {
      // Mock disk space error
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockImplementation(() => ({
          insert: vi.fn().mockRejectedValue(
            new Error('No space left on device')
          )
        })),
        rpc: vi.fn()
      };

      vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue(mockSupabase);

      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        title: 'Disk Space Test',
        type: 'video_with_vo',
        requirements: { prompt: 'Test disk space' }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(507);
      APITestHelper.assertErrorResponse(result, 'STORAGE_EXHAUSTED');
      expect(result.error.message).toContain('Storage capacity exceeded');
    });
  });

  describe('Validation and Input Errors', () => {
    it('should handle malformed JSON gracefully', async () => {
      // Create request with malformed JSON body
      const malformedRequest = new Request('http://localhost:3000/api/v1/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testSession.access_token}`
        },
        body: '{ invalid json structure "missing quotes": value }'
      });

      const response = await CreateRequest(malformedRequest);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(400);
      APITestHelper.assertErrorResponse(result, 'INVALID_JSON');
      expect(result.error.message).toContain('Invalid JSON format');
    });

    it('should handle oversized request bodies', async () => {
      const oversizedData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        title: 'Oversized Request',
        type: 'video_with_vo',
        requirements: {
          prompt: 'A'.repeat(10000000) // 10MB of data
        }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        oversizedData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(413);
      APITestHelper.assertErrorResponse(result, 'REQUEST_TOO_LARGE');
      expect(result.error.message).toContain('Request size exceeds limit');
    });
  });

  describe('Callback Error Handling', () => {
    it('should handle malformed callback signatures', async () => {
      const callbackData = {
        executionId: 'exec_malformed_sig',
        requestId: 'test-request-id',
        taskId: 'test-task-id',
        status: 'completed',
        result: { test: 'data' }
      };

      const request = APITestHelper.createUnauthenticatedRequest(
        'POST',
        '/api/v1/callbacks/n8n',
        callbackData,
        {
          'x-n8n-signature': 'invalid_signature_format'
        }
      );

      // Mock signature verification failure
      vi.doMock('@/lib/security/webhook-signature', () => ({
        verifySignature: vi.fn().mockReturnValue(false)
      }));

      const response = await CallbackHandler(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(401);
      APITestHelper.assertErrorResponse(result, 'INVALID_SIGNATURE');
      expect(result.error.message).toContain('Invalid webhook signature');
    });

    it('should handle callbacks for non-existent requests', async () => {
      const callbackData = {
        executionId: 'exec_nonexistent',
        requestId: 'non-existent-request-id',
        taskId: 'non-existent-task-id',
        status: 'completed',
        result: { test: 'data' }
      };

      const request = APITestHelper.createUnauthenticatedRequest(
        'POST',
        '/api/v1/callbacks/n8n',
        callbackData,
        {
          'x-n8n-signature': 'sha256=valid_signature'
        }
      );

      // Mock valid signature but non-existent request
      vi.doMock('@/lib/security/webhook-signature', () => ({
        verifySignature: vi.fn().mockReturnValue(true)
      }));

      const response = await CallbackHandler(request);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(404);
      APITestHelper.assertErrorResponse(result, 'REQUEST_NOT_FOUND');
      expect(result.error.message).toContain('Request or task not found');
    });

    it('should handle corrupted callback data gracefully', async () => {
      // Create valid request and task first
      const client = await testDb.getAdminClient();
      const request_data = TestFixtures.createContentRequest();
      await client.from('content_requests').insert(request_data);
      
      const tasks = TestFixtures.createRequestTasks(request_data.id);
      await client.from('request_tasks').insert(tasks);

      const callbackData = {
        executionId: 'exec_corrupted',
        requestId: request_data.id,
        taskId: tasks[0].id,
        status: 'completed',
        result: {
          // Corrupted/malformed result data
          circular_ref: null
        }
      };
      
      // Add circular reference
      callbackData.result.circular_ref = callbackData.result;

      const callbackRequest = APITestHelper.createUnauthenticatedRequest(
        'POST',
        '/api/v1/callbacks/n8n',
        callbackData,
        {
          'x-n8n-signature': 'sha256=valid_signature'
        }
      );

      vi.doMock('@/lib/security/webhook-signature', () => ({
        verifySignature: vi.fn().mockReturnValue(true)
      }));

      const response = await CallbackHandler(callbackRequest);
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(400);
      APITestHelper.assertErrorResponse(result, 'INVALID_CALLBACK_DATA');
      expect(result.error.message).toContain('Invalid callback data format');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from transient failures automatically', async () => {
      let failureCount = 0;
      const maxFailures = 2;
      
      // Mock service that fails transiently then recovers
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockImplementation(async () => {
            failureCount++;
            if (failureCount <= maxFailures) {
              throw new Error(`Transient failure ${failureCount}`);
            }
            return {
              async *[Symbol.asyncIterator]() {
                yield 'Service recovered and working';
              }
            };
          })
        })
      }));

      const conversationData = {
        session_id: `session_${Date.now()}`,
        message: 'Test recovery from transient failures',
        provider: 'openai',
        model_id: 'gpt-4'
      };

      // Enable retry logic
      vi.doMock('@/lib/utils/retry', () => ({
        withRetry: vi.fn().mockImplementation(async (fn, maxRetries = 3) => {
          let attempts = 0;
          while (attempts < maxRetries) {
            try {
              attempts++;
              return await fn();
            } catch (error) {
              if (attempts === maxRetries) throw error;
              await new Promise(resolve => setTimeout(resolve, 100 * attempts));
            }
          }
        })
      }));

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/conversation/stream',
        conversationData
      );

      const response = await StreamConversation(request);
      
      // Should eventually succeed after retries
      expect(response.status).toBe(200);
      expect(failureCount).toBe(maxFailures + 1); // Failed twice, succeeded on third attempt
    });

    it('should implement graceful degradation for non-critical features', async () => {
      // Mock analytics service failure (non-critical)
      vi.doMock('@/lib/analytics', () => ({
        trackEvent: vi.fn().mockRejectedValue(new Error('Analytics service down'))
      }));

      // Mock core functionality still working
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: testUser },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table) => {
          if (table === 'brands') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: TestFixtures.createBrand({ user_id: testUser.id }),
                    error: null
                  })
                })
              })
            };
          }
          if (table === 'content_requests') {
            return {
              insert: vi.fn().mockResolvedValue({
                data: [{ id: 'graceful-degradation-test' }],
                error: null
              })
            };
          }
          return { select: vi.fn(), insert: vi.fn() };
        }),
        rpc: vi.fn().mockResolvedValue({
          data: { estimated_cost: 25.00 },
          error: null
        })
      };

      vi.mocked(await import('@/lib/supabase/server')).createClient = vi.fn().mockResolvedValue(mockSupabase);

      const requestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
        title: 'Graceful Degradation Test',
        type: 'video_with_vo',
        requirements: { prompt: 'Test graceful degradation' }
      };

      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        requestData
      );

      const response = await CreateRequest(request);
      const result = await APITestHelper.parseResponse(response);

      // Core functionality should work despite analytics failure
      expect(response.status).toBe(200);
      APITestHelper.assertSuccessResponse(result);
      
      // Should include warning about degraded features
      expect(result.data).toHaveProperty('warnings');
      expect(result.data.warnings).toContain('Analytics tracking temporarily unavailable');
    });

    it('should maintain data consistency during partial failures', async () => {
      // Mock scenario where external logging fails but core operation succeeds
      let logFailure = false;
      vi.doMock('@/lib/monitoring/logger', () => ({
        logger: {
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn().mockImplementation(() => {
            if (logFailure) throw new Error('Logging service unavailable');
          })
        }
      }));

      const client = await testDb.getAdminClient();
      
      // Create request
      const requestData = TestFixtures.createContentRequest();
      await client.from('content_requests').insert(requestData);

      // Enable log failure
      logFailure = true;

      // Process request - logging should fail but data should remain consistent
      await requestOrchestrator.processRequest(requestData.id);

      // Verify request was processed correctly despite logging failure
      const { data: processedRequest } = await client
        .from('content_requests')
        .select('*')
        .eq('id', requestData.id)
        .single();

      expect(processedRequest).toBeTruthy();
      expect(['intake', 'draft'].includes(processedRequest.status)).toBe(true);

      // Verify tasks were created
      const { data: tasks } = await client
        .from('request_tasks')
        .select('*')
        .eq('request_id', requestData.id);

      expect(tasks.length).toBeGreaterThan(0);
    });
  });
});