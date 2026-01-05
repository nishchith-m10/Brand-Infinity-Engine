/**
 * Integration Tests for Content Request Orchestrator
 * 
 * Tests the full end-to-end flow:
 * 1. Request intake and initialization
 * 2. Task planning and creation
 * 3. Agent dispatching (executive, strategist, copywriter, producer)
 * 4. n8n workflow integration
 * 5. Callback handling and task completion
 * 6. Error handling and retries
 * 7. Dead letter queue and timeouts
 * 8. Circuit breaker protection
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import RequestOrchestrator from '../RequestOrchestrator';
import { ExecutiveAgentAdapter } from '@/lib/adapters/ExecutiveAgentAdapter';
import { StrategistAgentAdapter } from '@/lib/adapters/StrategistAgentAdapter';
import { CopywriterAgentAdapter } from '@/lib/adapters/CopywriterAgentAdapter';
import { ProducerAdapter } from '@/lib/adapters/ProducerAdapter';
import { metricsCollector } from '../MetricsCollector';
import { deadLetterQueue } from '../DeadLetterQueue';
import { taskTimeoutMonitor } from '../TaskTimeoutMonitor';
import { circuitBreakers } from '../CircuitBreaker';
import type { ContentRequest } from '../types';

// Test configuration
const TEST_USER_ID = 'test-user-orchestrator-integration';
const TEST_ORG_ID = 'test-org-orchestrator-integration';

describe('RequestOrchestrator Integration Tests', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let orchestrator: RequestOrchestrator;
  let testRequestId: string;

  beforeAll(async () => {
    supabase = await createClient();
    
    // Initialize orchestrator with real adapters
    orchestrator = new RequestOrchestrator(
      new ExecutiveAgentAdapter(),
      new StrategistAgentAdapter(),
      new CopywriterAgentAdapter(),
      new ProducerAdapter()
    );

    // Clean up any existing test data
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(() => {
    // Reset circuit breakers
    circuitBreakers.n8n.reset();
    circuitBreakers.openai.reset();
  });

  async function cleanup() {
    // Delete test requests and related data
    await supabase
      .from('request_tasks')
      .delete()
      .like('request_id', `${TEST_ORG_ID}%`);

    await supabase
      .from('request_events')
      .delete()
      .like('request_id', `${TEST_ORG_ID}%`);

    await supabase
      .from('content_requests')
      .delete()
      .like('id', `${TEST_ORG_ID}%`);
  }

  describe('End-to-End Request Flow', () => {
    it('should create and initialize a new content request', async () => {
      const inputData = {
        brand_name: 'Test Brand',
        product_name: 'Test Product',
        creative_brief: 'Create engaging social media content',
        request_type: 'social_media_post',
        target_platform: 'instagram',
      };

      const requestId = await orchestrator.createRequest(
        TEST_USER_ID,
        TEST_ORG_ID,
        inputData
      );

      expect(requestId).toBeDefined();
      expect(requestId).toContain(TEST_ORG_ID);
      testRequestId = requestId;

      // Verify request was created
      const { data: request } = await supabase
        .from('content_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      expect(request).toBeDefined();
      expect(request.status).toBe('intake');
      expect(request.user_id).toBe(TEST_USER_ID);
      expect(request.organization_id).toBe(TEST_ORG_ID);
    });

    it('should run executive agent and plan tasks', async () => {
      // Mock executive agent response
      const mockExecutiveOutput = {
        is_approved: true,
        quality_score: 85,
        required_revisions: [],
        task_plan: [
          {
            task_name: 'research_content_strategy',
            assigned_to: 'strategist',
            dependencies: [],
            estimated_duration_minutes: 5,
          },
          {
            task_name: 'write_copy',
            assigned_to: 'copywriter',
            dependencies: ['research_content_strategy'],
            estimated_duration_minutes: 10,
          },
          {
            task_name: 'produce_assets',
            assigned_to: 'producer',
            dependencies: ['write_copy'],
            estimated_duration_minutes: 15,
          },
        ],
      };

      // Start request processing
      await orchestrator.processRequest(testRequestId);

      // Wait for executive agent to complete
      await waitForTaskCompletion(testRequestId, 'executive_intake');

      // Verify tasks were created
      const { data: tasks } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('request_id', testRequestId)
        .order('created_at', { ascending: true });

      expect(tasks).toBeDefined();
      expect(tasks.length).toBeGreaterThan(0);

      // Verify executive task completed
      const executiveTask = tasks.find(t => t.task_name === 'executive_intake');
      expect(executiveTask).toBeDefined();
      expect(executiveTask?.status).toBe('completed');
    });

    it('should process strategist agent task', async () => {
      // Wait for strategist task to be dispatched
      await waitForTaskStatus(testRequestId, 'research_content_strategy', 'dispatched');

      // Simulate n8n callback
      const { data: task } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('request_id', testRequestId)
        .eq('task_name', 'research_content_strategy')
        .single();

      const mockStrategistOutput = {
        content_strategy: {
          tone: 'professional',
          key_messages: ['Message 1', 'Message 2'],
          target_audience: 'Young professionals',
        },
        research_notes: 'Comprehensive research completed',
      };

      await orchestrator.handleCallback(
        task.id,
        'completed',
        mockStrategistOutput
      );

      // Verify task completed
      const { data: updatedTask } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('id', task.id)
        .single();

      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.output_data).toEqual(mockStrategistOutput);
    });

    it('should process copywriter agent task', async () => {
      // Wait for copywriter task to be dispatched
      await waitForTaskStatus(testRequestId, 'write_copy', 'dispatched');

      // Simulate n8n callback
      const { data: task } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('request_id', testRequestId)
        .eq('task_name', 'write_copy')
        .single();

      const mockCopywriterOutput = {
        final_copy: 'Engaging social media copy here...',
        revision_count: 0,
        word_count: 50,
      };

      await orchestrator.handleCallback(
        task.id,
        'completed',
        mockCopywriterOutput
      );

      // Verify task completed
      const { data: updatedTask } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('id', task.id)
        .single();

      expect(updatedTask.status).toBe('completed');
    });

    it('should process producer agent task and complete request', async () => {
      // Wait for producer task to be dispatched
      await waitForTaskStatus(testRequestId, 'produce_assets', 'dispatched');

      // Simulate n8n callback
      const { data: task } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('request_id', testRequestId)
        .eq('task_name', 'produce_assets')
        .single();

      const mockProducerOutput = {
        asset_urls: ['https://example.com/asset1.mp4'],
        production_notes: 'Video successfully generated',
      };

      await orchestrator.handleCallback(
        task.id,
        'completed',
        mockProducerOutput
      );

      // Wait for request to complete
      await waitForRequestStatus(testRequestId, 'published');

      // Verify request completed
      const { data: request } = await supabase
        .from('content_requests')
        .select('*')
        .eq('id', testRequestId)
        .single();

      expect(request.status).toBe('published');
      expect(request.completed_at).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should retry failed tasks up to max attempts', async () => {
      const inputData = {
        brand_name: 'Test Brand Retry',
        creative_brief: 'Test retry logic',
        request_type: 'blog_post',
      };

      const requestId = await orchestrator.createRequest(
        TEST_USER_ID,
        TEST_ORG_ID,
        inputData
      );

      // Start processing
      await orchestrator.processRequest(requestId);

      // Wait for first task
      const { data: task } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('request_id', requestId)
        .eq('task_name', 'executive_intake')
        .single();

      // Simulate failures
      for (let i = 0; i < 2; i++) {
        await orchestrator.handleCallback(task.id, 'failed', {
          error: `Test failure ${i + 1}`,
        });

        // Wait for retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Verify retry count
      const { data: events } = await supabase
        .from('request_events')
        .select('*')
        .eq('task_id', task.id)
        .eq('event_type', 'retry')
        .order('created_at', { ascending: true });

      expect(events.length).toBeGreaterThan(0);
    });

    it('should send task to DLQ after max retries', async () => {
      const inputData = {
        brand_name: 'Test Brand DLQ',
        creative_brief: 'Test DLQ logic',
        request_type: 'email_campaign',
      };

      const requestId = await orchestrator.createRequest(
        TEST_USER_ID,
        TEST_ORG_ID,
        inputData
      );

      await orchestrator.processRequest(requestId);

      const { data: task } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('request_id', requestId)
        .eq('task_name', 'executive_intake')
        .single();

      // Fail 4 times (1 initial + 3 retries)
      for (let i = 0; i < 4; i++) {
        await orchestrator.handleCallback(task.id, 'failed', {
          error: 'Permanent failure',
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Verify DLQ entry
      const dlqEntries = await deadLetterQueue.getDLQEntries({
        task_id: task.id,
      });

      expect(dlqEntries.length).toBeGreaterThan(0);
    });
  });

  describe('Timeout Detection', () => {
    it('should detect and fail timed-out tasks', async () => {
      const inputData = {
        brand_name: 'Test Brand Timeout',
        creative_brief: 'Test timeout logic',
        request_type: 'video_script',
      };

      const requestId = await orchestrator.createRequest(
        TEST_USER_ID,
        TEST_ORG_ID,
        inputData
      );

      await orchestrator.processRequest(requestId);

      const { data: task } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('request_id', requestId)
        .eq('task_name', 'executive_intake')
        .single();

      // Manually set started_at to past timeout
      const pastTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await supabase
        .from('request_tasks')
        .update({ 
          status: 'in_progress',
          started_at: pastTime,
        })
        .eq('id', task.id);

      // Run timeout check
      await taskTimeoutMonitor.checkTimeouts();

      // Verify task was failed
      const { data: updatedTask } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('id', task.id)
        .single();

      expect(updatedTask.status).toBe('failed');

      // Verify timeout event logged
      const { data: events } = await supabase
        .from('request_events')
        .select('*')
        .eq('task_id', task.id)
        .eq('event_type', 'error')
        .like('description', '%timeout%');

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after consecutive failures', async () => {
      // Simulate n8n failures
      const adapter = new ProducerAdapter();

      for (let i = 0; i < 6; i++) {
        try {
          // This will fail and increment circuit breaker
          await adapter.dispatch('test-task-id', {});
        } catch (error) {
          // Expected to fail
        }
      }

      // Verify circuit is open
      const stats = circuitBreakers.n8n.getStats();
      expect(stats.state).toBe('OPEN');
    });

    it('should fail fast when circuit is open', async () => {
      // Open the circuit
      for (let i = 0; i < 6; i++) {
        try {
          await new ProducerAdapter().dispatch('test-id', {});
        } catch {}
      }

      // Attempt another dispatch
      const adapter = new ProducerAdapter();
      
      await expect(
        adapter.dispatch('test-task-id', {})
      ).rejects.toThrow('n8n service is currently unavailable');
    });
  });

  describe('Metrics Collection', () => {
    it('should collect task performance metrics', async () => {
      const metrics = await metricsCollector.getTaskMetrics();
      
      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should collect request metrics', async () => {
      const metrics = await metricsCollector.getRequestMetrics();
      
      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should collect agent metrics', async () => {
      const metrics = await metricsCollector.getAgentMetrics();
      
      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should report system health', async () => {
      const health = await metricsCollector.getSystemHealth();
      
      expect(health).toBeDefined();
      expect(health.uptime_seconds).toBeGreaterThan(0);
      expect(health.total_requests_processed).toBeGreaterThanOrEqual(0);
    });
  });
});

/**
 * Helper function to wait for task completion.
 */
async function waitForTaskCompletion(
  requestId: string,
  taskName: string,
  timeout = 30000
): Promise<void> {
  const supabase = await createClient();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const { data: task } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', requestId)
      .eq('task_name', taskName)
      .single();

    if (task && task.status === 'completed') {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Task ${taskName} did not complete within ${timeout}ms`);
}

/**
 * Helper function to wait for specific task status.
 */
async function waitForTaskStatus(
  requestId: string,
  taskName: string,
  status: string,
  timeout = 30000
): Promise<void> {
  const supabase = await createClient();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const { data: task } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', requestId)
      .eq('task_name', taskName)
      .single();

    if (task && task.status === status) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(
    `Task ${taskName} did not reach status ${status} within ${timeout}ms`
  );
}

/**
 * Helper function to wait for request status.
 */
async function waitForRequestStatus(
  requestId: string,
  status: string,
  timeout = 60000
): Promise<void> {
  const supabase = await createClient();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const { data: request } = await supabase
      .from('content_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (request && request.status === status) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(
    `Request ${requestId} did not reach status ${status} within ${timeout}ms`
  );
}
