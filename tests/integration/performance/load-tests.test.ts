/**
 * Performance and Load Integration Tests
 * 
 * Tests system behavior under load, concurrent operations, and stress conditions.
 * Validates performance characteristics and resource usage patterns.
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

describe('Performance and Load Integration Tests', () => {
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
    
    // Create brand and campaign with adequate budget
    const brand = TestFixtures.createBrand({ user_id: testUser.id });
    await client.from('brands').insert(brand);
    
    const campaign = TestFixtures.createCampaign({
      budget_limit: 10000.00, // High budget for load testing
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

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests efficiently', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();
      
      // Create multiple concurrent requests
      const requests = Array.from({ length: concurrentRequests }, (_, index) => ({
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
        title: `Concurrent Request ${index + 1}`,
        type: 'image',
        requirements: { 
          prompt: `Test concurrent processing ${index + 1}`,
          style: 'professional'
        }
      }));

      // Mock fast N8N responses
      mockN8N.triggerContentGeneration = vi.fn().mockImplementation(async () => ({
        execution_id: `exec_concurrent_${Date.now()}_${Math.random()}`,
        webhook_url: 'https://n8n.example.com/webhook/concurrent'
      }));

      const promises = requests.map(async (requestData) => {
        const request = APITestHelper.createAuthenticatedRequest(
          'POST',
          '/api/v1/requests',
          requestData
        );
        
        const response = await CreateRequest(request);
        const result = await APITestHelper.parseResponse(response);
        
        return {
          status: response.status,
          data: result,
          requestTitle: requestData.title
        };
      });

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // All requests should succeed
      results.forEach((result) => {
        expect(result.status).toBe(200);
        APITestHelper.assertSuccessResponse(result.data);
        expect(result.data.data).toHaveProperty('id');
      });

      // Performance assertions
      expect(totalDuration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockN8N.triggerContentGeneration).toHaveBeenCalledTimes(concurrentRequests);

      // Verify all requests were created in database
      const client = await testDb.getAdminClient();
      const { data: createdRequests } = await client
        .from('content_requests')
        .select('*')
        .like('title', 'Concurrent Request %');

      expect(createdRequests?.length).toBe(concurrentRequests);

      console.log(`Concurrent requests performance: ${concurrentRequests} requests in ${totalDuration}ms (${(totalDuration / concurrentRequests).toFixed(2)}ms avg per request)`);
    }, 10000); // Extend timeout for load test

    it('should maintain performance under conversation load', async () => {
      const conversationCount = 5;
      const messagesPerConversation = 4;
      const startTime = Date.now();

      // Mock LLM service with simulated processing time
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockImplementation(async function* (prompt: string) {
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const responses = [
              'This is a test response to your message.',
              'I understand your request and here is my reply.',
              'Thank you for the conversation, here is my response.',
              'Processing your message and providing a detailed answer.'
            ];
            
            for (const chunk of responses[Math.floor(Math.random() * responses.length)].split(' ')) {
              yield chunk + ' ';
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          })
        })
      }));

      const conversationPromises = Array.from({ length: conversationCount }, async (_, convIndex) => {
        const sessionId = `load_test_session_${convIndex}`;
        const messagePromises = [];

        for (let msgIndex = 0; msgIndex < messagesPerConversation; msgIndex++) {
          const conversationData = {
            session_id: sessionId,
            message: `Load test message ${msgIndex + 1} from conversation ${convIndex + 1}`,
            provider: 'openai',
            model_id: 'gpt-4'
          };

          const messagePromise = (async () => {
            const request = APITestHelper.createAuthenticatedRequest(
              'POST',
              '/api/v1/conversation/stream',
              conversationData
            );

            const startTime = Date.now();
            const response = await StreamConversation(request);
            const duration = Date.now() - startTime;

            return {
              status: response.status,
              duration,
              conversationIndex: convIndex,
              messageIndex: msgIndex
            };
          })();

          messagePromises.push(messagePromise);

          // Stagger messages slightly to simulate realistic usage
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        return Promise.all(messagePromises);
      });

      const allResults = await Promise.all(conversationPromises);
      const flatResults = allResults.flat();
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // All messages should succeed
      flatResults.forEach((result) => {
        expect(result.status).toBe(200);
      });

      // Performance metrics
      const avgResponseTime = flatResults.reduce((sum, r) => sum + r.duration, 0) / flatResults.length;
      const maxResponseTime = Math.max(...flatResults.map(r => r.duration));
      const minResponseTime = Math.min(...flatResults.map(r => r.duration));

      expect(avgResponseTime).toBeLessThan(2000); // Average under 2 seconds
      expect(maxResponseTime).toBeLessThan(5000); // Max under 5 seconds

      console.log(`Conversation load test: ${flatResults.length} messages across ${conversationCount} conversations`);
      console.log(`Total time: ${totalDuration}ms, Avg response: ${avgResponseTime.toFixed(2)}ms, Min: ${minResponseTime}ms, Max: ${maxResponseTime}ms`);
    }, 15000); // Extended timeout for conversation load test

    it('should handle high-frequency callback processing', async () => {
      const callbackCount = 20;
      const client = await testDb.getAdminClient();

      // Create test requests and tasks for callbacks
      const testData = [];
      for (let i = 0; i < callbackCount; i++) {
        const requestData = TestFixtures.createContentRequest({
          title: `Callback Load Test ${i + 1}`
        });
        await client.from('content_requests').insert(requestData);
        
        const tasks = TestFixtures.createRequestTasks(requestData.id);
        await client.from('request_tasks').insert(tasks);
        
        testData.push({
          requestId: requestData.id,
          taskId: tasks[0].id
        });
      }

      // Mock signature verification
      vi.doMock('@/lib/security/webhook-signature', () => ({
        verifySignature: vi.fn().mockReturnValue(true)
      }));

      const startTime = Date.now();
      
      // Create concurrent callbacks
      const callbackPromises = testData.map(async ({ requestId, taskId }, index) => {
        const callbackData = {
          executionId: `exec_load_${index}`,
          requestId,
          taskId,
          status: 'completed',
          result: {
            output_url: `https://example.com/output/${index}.jpg`,
            metadata: { processing_time: 120 + (index * 10) }
          }
        };

        const request = APITestHelper.createUnauthenticatedRequest(
          'POST',
          '/api/v1/callbacks/n8n',
          callbackData,
          {
            'x-n8n-signature': 'sha256=valid_signature'
          }
        );

        const callbackStart = Date.now();
        const response = await CallbackHandler(request);
        const duration = Date.now() - callbackStart;

        return {
          status: response.status,
          duration,
          index
        };
      });

      const results = await Promise.all(callbackPromises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // All callbacks should succeed
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });

      // Performance assertions
      const avgCallbackTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgCallbackTime).toBeLessThan(500); // Average callback processing under 500ms
      expect(totalDuration).toBeLessThan(3000); // All callbacks processed within 3 seconds

      // Verify all callbacks were processed
      const { data: updatedTasks } = await client
        .from('request_tasks')
        .select('*')
        .eq('status', 'completed');

      expect(updatedTasks?.length).toBeGreaterThanOrEqual(callbackCount);

      console.log(`Callback load test: ${callbackCount} callbacks in ${totalDuration}ms (${avgCallbackTime.toFixed(2)}ms avg)`);
    }, 10000);
  });

  describe('Memory and Resource Management', () => {
    it('should maintain stable memory usage during sustained operations', async () => {
      const iterationCount = 50;
      const memorySnapshots = [];
      
      // Monitor memory usage across multiple operations
      for (let i = 0; i < iterationCount; i++) {
        // Capture memory before operation
        const memBefore = process.memoryUsage();
        
        const requestData = {
          brand_id: TEST_CONFIG.TEST_BRAND_ID,
          campaign_id: TEST_CONFIG.TEST_CAMPAIGN_ID,
          title: `Memory Test ${i + 1}`,
          type: 'image',
          requirements: { 
            prompt: `Memory stability test iteration ${i + 1}` 
          }
        };

        const request = APITestHelper.createAuthenticatedRequest(
          'POST',
          '/api/v1/requests',
          requestData
        );

        await CreateRequest(request);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Capture memory after operation
        const memAfter = process.memoryUsage();
        
        memorySnapshots.push({
          iteration: i,
          heapUsed: memAfter.heapUsed,
          heapDelta: memAfter.heapUsed - memBefore.heapUsed,
          external: memAfter.external,
          rss: memAfter.rss
        });

        // Brief pause to allow cleanup
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Analyze memory pattern
      const heapGrowth = memorySnapshots[memorySnapshots.length - 1].heapUsed - memorySnapshots[0].heapUsed;
      const avgHeapDelta = memorySnapshots.reduce((sum, snap) => sum + snap.heapDelta, 0) / memorySnapshots.length;
      
      // Memory growth should be reasonable (less than 50MB total)
      expect(heapGrowth).toBeLessThan(50 * 1024 * 1024);
      
      // Average per-operation memory delta should be small
      expect(Math.abs(avgHeapDelta)).toBeLessThan(1024 * 1024); // Less than 1MB average

      console.log(`Memory test: ${iterationCount} operations, heap growth: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB, avg delta: ${(avgHeapDelta / 1024).toFixed(2)}KB`);
    }, 20000);

    it('should handle large payload processing efficiently', async () => {
      const largeCampaign = TestFixtures.createCampaign({
        budget_limit: 50000.00,
        requirements: {
          brand_guidelines: 'A'.repeat(10000), // 10KB brand guidelines
          campaign_objectives: 'B'.repeat(5000), // 5KB objectives
          target_audience: 'C'.repeat(3000), // 3KB audience description
          creative_direction: 'D'.repeat(7000), // 7KB creative direction
          technical_specifications: {
            video_resolution: '4K',
            duration_range: '30-60 seconds',
            formats: ['mp4', 'mov', 'webm'],
            quality_settings: 'E'.repeat(2000) // 2KB quality specs
          }
        }
      });

      const client = await testDb.getAdminClient();
      const { data: createdCampaign } = await client
        .from('campaigns')
        .insert(largeCampaign)
        .select()
        .single();

      const largeRequestData = {
        brand_id: TEST_CONFIG.TEST_BRAND_ID,
        campaign_id: createdCampaign.id,
        title: 'Large Payload Processing Test',
        type: 'video_with_vo',
        requirements: {
          detailed_prompt: 'F'.repeat(15000), // 15KB detailed prompt
          reference_materials: Array.from({ length: 10 }, (_, i) => ({
            type: 'image',
            url: `https://example.com/ref${i}.jpg`,
            description: 'G'.repeat(1000) // 1KB per description
          })),
          creative_specifications: {
            visual_style: 'H'.repeat(5000), // 5KB visual style
            audio_requirements: 'I'.repeat(3000), // 3KB audio requirements
            text_overlays: Array.from({ length: 20 }, (_, i) => ({
              text: `Overlay ${i + 1}: ${'J'.repeat(200)}`, // 200B per overlay
              timing: i * 2,
              style: 'bold'
            }))
          }
        }
      };

      const startTime = Date.now();
      const request = APITestHelper.createAuthenticatedRequest(
        'POST',
        '/api/v1/requests',
        largeRequestData
      );

      const response = await CreateRequest(request);
      const processingTime = Date.now() - startTime;
      const result = await APITestHelper.parseResponse(response);

      expect(response.status).toBe(200);
      APITestHelper.assertSuccessResponse(result);
      
      // Processing large payloads should complete within reasonable time
      expect(processingTime).toBeLessThan(3000); // Under 3 seconds

      console.log(`Large payload test: ~50KB payload processed in ${processingTime}ms`);
    });

    it('should handle connection pool stress efficiently', async () => {
      const concurrentConnections = 15;
      const operationsPerConnection = 3;
      
      const connectionPromises = Array.from({ length: concurrentConnections }, async (_, connIndex) => {
        const operationPromises = [];
        
        for (let opIndex = 0; opIndex < operationsPerConnection; opIndex++) {
          const operationPromise = (async () => {
            const client = await testDb.getAdminClient();
            
            // Simulate database-heavy operations
            const queries = [
              () => client.from('brands').select('*').limit(10),
              () => client.from('campaigns').select('*').limit(10),
              () => client.from('content_requests').select('*').limit(10),
              () => client.from('request_tasks').select('*').limit(10)
            ];

            const results = [];
            for (const query of queries) {
              const startTime = Date.now();
              const result = await query();
              const queryTime = Date.now() - startTime;
              results.push({ queryTime, error: result.error });
            }

            return {
              connectionIndex: connIndex,
              operationIndex: opIndex,
              queryResults: results
            };
          })();
          
          operationPromises.push(operationPromise);
        }

        return Promise.all(operationPromises);
      });

      const startTime = Date.now();
      const allResults = await Promise.all(connectionPromises);
      const totalTime = Date.now() - startTime;

      const flatResults = allResults.flat();
      
      // All operations should succeed
      flatResults.forEach((result) => {
        result.queryResults.forEach((queryResult) => {
          expect(queryResult.error).toBeNull();
          expect(queryResult.queryTime).toBeLessThan(1000); // Each query under 1 second
        });
      });

      const totalOperations = concurrentConnections * operationsPerConnection * 4; // 4 queries per operation
      const avgOperationTime = totalTime / totalOperations;

      expect(avgOperationTime).toBeLessThan(200); // Average operation under 200ms

      console.log(`Connection pool test: ${totalOperations} operations across ${concurrentConnections} connections in ${totalTime}ms (${avgOperationTime.toFixed(2)}ms avg)`);
    }, 15000);
  });

  describe('Rate Limiting Performance', () => {
    it('should efficiently enforce rate limits without performance degradation', async () => {
      const requestCount = 30; // Exceed typical rate limits
      const rateLimitWindow = 60; // 60 second window
      const maxRequests = 10; // Max requests per window

      // Mock rate limiter
      let requestTimestamps: number[] = [];
      vi.doMock('@/lib/middleware/rate-limiter', () => ({
        checkRateLimit: vi.fn().mockImplementation((userId: string) => {
          const now = Date.now();
          const windowStart = now - (rateLimitWindow * 1000);
          
          // Clean old requests
          requestTimestamps = requestTimestamps.filter(timestamp => timestamp > windowStart);
          
          if (requestTimestamps.length >= maxRequests) {
            return {
              allowed: false,
              remaining: 0,
              resetTime: windowStart + (rateLimitWindow * 1000)
            };
          }
          
          requestTimestamps.push(now);
          return {
            allowed: true,
            remaining: maxRequests - requestTimestamps.length,
            resetTime: windowStart + (rateLimitWindow * 1000)
          };
        })
      }));

      const results = [];
      const startTime = Date.now();

      for (let i = 0; i < requestCount; i++) {
        const requestData = {
          brand_id: TEST_CONFIG.TEST_BRAND_ID,
          title: `Rate Limit Test ${i + 1}`,
          type: 'image',
          requirements: { prompt: `Rate limit test ${i + 1}` }
        };

        const request = APITestHelper.createAuthenticatedRequest(
          'POST',
          '/api/v1/requests',
          requestData
        );

        const requestStart = Date.now();
        const response = await CreateRequest(request);
        const requestTime = Date.now() - requestStart;

        results.push({
          index: i,
          status: response.status,
          processingTime: requestTime
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const totalTime = Date.now() - startTime;

      // First 10 requests should succeed
      const successfulRequests = results.filter(r => r.status === 200);
      const rateLimitedRequests = results.filter(r => r.status === 429);

      expect(successfulRequests.length).toBe(maxRequests);
      expect(rateLimitedRequests.length).toBe(requestCount - maxRequests);

      // Rate limiting should not significantly impact processing time
      const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
      expect(avgProcessingTime).toBeLessThan(500); // Rate limiting overhead should be minimal

      console.log(`Rate limiting test: ${requestCount} requests, ${successfulRequests.length} allowed, ${rateLimitedRequests.length} rate-limited`);
      console.log(`Total time: ${totalTime}ms, avg processing: ${avgProcessingTime.toFixed(2)}ms`);
    });

    it('should handle rate limit edge cases efficiently', async () => {
      // Test rapid burst followed by steady requests
      const burstSize = 15;
      const steadySize = 10;
      
      // Mock rate limiter with sliding window
      let requestLog: { timestamp: number; userId: string }[] = [];
      const windowSize = 60000; // 1 minute
      const maxRequestsPerWindow = 12;

      vi.doMock('@/lib/middleware/rate-limiter', () => ({
        checkRateLimit: vi.fn().mockImplementation((userId: string) => {
          const now = Date.now();
          const windowStart = now - windowSize;
          
          // Clean old entries
          requestLog = requestLog.filter(entry => entry.timestamp > windowStart);
          
          const userRequests = requestLog.filter(entry => entry.userId === userId);
          
          if (userRequests.length >= maxRequestsPerWindow) {
            return { allowed: false, remaining: 0 };
          }
          
          requestLog.push({ timestamp: now, userId });
          return { 
            allowed: true, 
            remaining: maxRequestsPerWindow - userRequests.length - 1 
          };
        })
      }));

      // Phase 1: Rapid burst
      const burstPromises = Array.from({ length: burstSize }, async (_, i) => {
        const requestData = {
          brand_id: TEST_CONFIG.TEST_BRAND_ID,
          title: `Burst Request ${i + 1}`,
          type: 'image',
          requirements: { prompt: `Burst test ${i + 1}` }
        };

        const request = APITestHelper.createAuthenticatedRequest(
          'POST',
          '/api/v1/requests',
          requestData
        );

        const startTime = Date.now();
        const response = await CreateRequest(request);
        const duration = Date.now() - startTime;

        return { phase: 'burst', index: i, status: response.status, duration };
      });

      const burstResults = await Promise.all(burstPromises);

      // Wait a bit then do steady requests
      await new Promise(resolve => setTimeout(resolve, 100));

      // Phase 2: Steady requests
      const steadyResults = [];
      for (let i = 0; i < steadySize; i++) {
        const requestData = {
          brand_id: TEST_CONFIG.TEST_BRAND_ID,
          title: `Steady Request ${i + 1}`,
          type: 'image',
          requirements: { prompt: `Steady test ${i + 1}` }
        };

        const request = APITestHelper.createAuthenticatedRequest(
          'POST',
          '/api/v1/requests',
          requestData
        );

        const startTime = Date.now();
        const response = await CreateRequest(request);
        const duration = Date.now() - startTime;

        steadyResults.push({ phase: 'steady', index: i, status: response.status, duration });

        await new Promise(resolve => setTimeout(resolve, 200)); // Steady pace
      }

      // Analyze results
      const allResults = [...burstResults, ...steadyResults];
      const successCount = allResults.filter(r => r.status === 200).length;
      const rateLimitedCount = allResults.filter(r => r.status === 429).length;

      // Should allow approximately maxRequestsPerWindow requests
      expect(successCount).toBeLessThanOrEqual(maxRequestsPerWindow + 2); // Small tolerance
      expect(rateLimitedCount).toBeGreaterThan(0);

      // Performance should remain consistent even under rate limiting
      const avgDuration = allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length;
      expect(avgDuration).toBeLessThan(300);

      console.log(`Rate limit edge case test: ${allResults.length} total requests, ${successCount} allowed, ${rateLimitedCount} rate-limited, ${avgDuration.toFixed(2)}ms avg`);
    });
  });

  describe('Scaling and Throughput Tests', () => {
    it('should maintain throughput under sustained mixed workload', async () => {
      const testDuration = 5000; // 5 seconds
      const startTime = Date.now();
      const results = [];
      let requestCounter = 0;

      // Simulate mixed workload
      const workloadTypes = [
        { weight: 0.4, type: 'simple', operation: 'image' },
        { weight: 0.3, type: 'medium', operation: 'video_with_vo' },
        { weight: 0.2, type: 'conversation', operation: 'chat' },
        { weight: 0.1, type: 'complex', operation: 'video_with_vo' }
      ];

      // Mock different processing times for different operations
      vi.doMock('@/lib/llm', () => ({
        getLLMService: vi.fn().mockReturnValue({
          streamCompletion: vi.fn().mockImplementation(async function* () {
            await new Promise(resolve => setTimeout(resolve, 50)); // Fast chat response
            yield 'Chat response for load test';
          })
        })
      }));

      const processWorkload = async () => {
        while (Date.now() - startTime < testDuration) {
          const random = Math.random();
          let cumulativeWeight = 0;
          let selectedWorkload = workloadTypes[0];

          for (const workload of workloadTypes) {
            cumulativeWeight += workload.weight;
            if (random <= cumulativeWeight) {
              selectedWorkload = workload;
              break;
            }
          }

          requestCounter++;
          const operationStart = Date.now();

          try {
            if (selectedWorkload.operation === 'chat') {
              const conversationData = {
                session_id: `load_session_${requestCounter}`,
                message: `Load test message ${requestCounter}`,
                provider: 'openai',
                model_id: 'gpt-4'
              };

              const request = APITestHelper.createAuthenticatedRequest(
                'POST',
                '/api/v1/conversation/stream',
                conversationData
              );

              const response = await StreamConversation(request);
              results.push({
                type: selectedWorkload.type,
                operation: selectedWorkload.operation,
                status: response.status,
                duration: Date.now() - operationStart,
                timestamp: Date.now()
              });
            } else {
              const requestData = {
                brand_id: TEST_CONFIG.TEST_BRAND_ID,
                title: `Mixed Load ${requestCounter}`,
                type: selectedWorkload.operation,
                requirements: { 
                  prompt: `${selectedWorkload.type} complexity test ${requestCounter}` 
                }
              };

              const request = APITestHelper.createAuthenticatedRequest(
                'POST',
                '/api/v1/requests',
                requestData
              );

              const response = await CreateRequest(request);
              results.push({
                type: selectedWorkload.type,
                operation: selectedWorkload.operation,
                status: response.status,
                duration: Date.now() - operationStart,
                timestamp: Date.now()
              });
            }
          } catch (error) {
            results.push({
              type: selectedWorkload.type,
              operation: selectedWorkload.operation,
              status: 500,
              duration: Date.now() - operationStart,
              timestamp: Date.now(),
              error: error.message
            });
          }

          // Brief pause to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      };

      // Run mixed workload
      await processWorkload();
      
      const totalDuration = Date.now() - startTime;
      const throughput = results.length / (totalDuration / 1000); // requests per second

      // Analyze results by type
      const typeStats = workloadTypes.reduce((acc, workload) => {
        const typeResults = results.filter(r => r.type === workload.type);
        acc[workload.type] = {
          count: typeResults.length,
          successRate: typeResults.filter(r => r.status === 200).length / typeResults.length,
          avgDuration: typeResults.reduce((sum, r) => sum + r.duration, 0) / typeResults.length
        };
        return acc;
      }, {});

      // Performance assertions
      expect(throughput).toBeGreaterThan(0.5); // At least 0.5 requests per second
      expect(results.filter(r => r.status === 200).length / results.length).toBeGreaterThan(0.8); // 80% success rate

      console.log(`Mixed workload test: ${results.length} operations in ${totalDuration}ms (${throughput.toFixed(2)} ops/sec)`);
      console.log('Type breakdown:', typeStats);
    }, 10000);
  });
});