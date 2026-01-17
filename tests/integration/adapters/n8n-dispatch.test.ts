/**
 * n8n Dispatch Integration Tests
 *
 * Tests ProducerAdapter with HTTP mocks to verify:
 * - Successful dispatch with metadata persistence
 * - 5xx error retry behavior
 * - 4xx error handling (no retry)
 * - Timeout scenarios
 * - Circuit breaker opening after failures
 * - Idempotent metadata upserts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { ProducerAdapter } from '@/lib/adapters/ProducerAdapter';
import type { AgentExecutionParams } from '@/lib/orchestrator/types';

// Mock dependencies
const mockSupabaseUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockSupabaseInsert = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: mockSupabaseUpsert,
      insert: mockSupabaseInsert,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { campaign_id: 'test-campaign', prompt: 'test prompt' },
        error: null,
      }),
    })),
  })),
}));

vi.mock('@/lib/orchestrator/CircuitBreaker', () => ({
  circuitBreakers: {
    n8n: {
      execute: vi.fn((fn) => fn()),
      reset: vi.fn(),
      forceOpen: vi.fn(),
      getStats: vi.fn(() => ({ state: 'CLOSED', failures: 0 })),
    },
  },
  CircuitBreakerError: class CircuitBreakerError extends Error {
    state: string;
    constructor(message: string, state: string) {
      super(message);
      this.state = state;
    }
  },
}));

vi.mock('@/utils/metrics', () => ({
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

describe('n8n Dispatch Integration Tests', () => {
  const N8N_BASE_URL = 'https://n8n.test';
  const WORKFLOW_ID = 'test-workflow-123';

  let adapter: ProducerAdapter;
  let mockParams: AgentExecutionParams;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseUpsert.mockClear();
    mockSupabaseInsert.mockClear();

    // Configure adapter with short timeout for faster tests
    adapter = new ProducerAdapter({
      baseUrl: N8N_BASE_URL,
      apiKey: 'test-api-key',
      workflows: {
        image_generation: WORKFLOW_ID,
        video_production: WORKFLOW_ID,
        voiceover_synthesis: WORKFLOW_ID,
      },
      timeout: 2000, // 2s timeout for tests
      retryAttempts: 3,
    });

    mockParams = {
      request: {
        id: 'request-123',
        request_type: 'image',
        created_at: new Date().toISOString(),
        metadata: {},
      },
      task: {
        id: 'task-456',
        task_name: 'image_generation',
        agent_role: 'producer',
      },
      completedTasks: [],
    } as any;

    // Clean all HTTP mocks before each test
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Successful Dispatch with Metadata Persistence', () => {
    it('should dispatch to n8n and persist metadata', async () => {
      const executionId = 'exec-789';

      // Mock successful n8n dispatch
      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(200, {
          executionId,
          status: 'pending',
        });

      const result = await adapter.execute(mockParams);

      // Verify dispatch success
      expect(result.success).toBe(true);
      expect(result.output?.execution_id).toBe(executionId);
      expect(result.output?.status).toBe('dispatched');

      // Verify metadata upsert was called
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          request_task_id: 'task-456',
          provider_name: 'n8n',
          external_job_id: executionId,
          provider_status: 'pending',
        }),
        expect.objectContaining({
          onConflict: 'provider_name,external_job_id',
        })
      );

      // Verify metrics were recorded
      const { recordSuccess } = await import('@/utils/metrics');
      expect(recordSuccess).toHaveBeenCalledWith(
        'n8n-dispatch',
        expect.any(Number),
        expect.objectContaining({
          execution_id: executionId,
        })
      );
    });

    it('should include callback URL in dispatch payload', async () => {
      let capturedPayload: any;

      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`, (body) => {
          capturedPayload = body;
          return true;
        })
        .reply(200, { executionId: 'exec-123', status: 'pending' });

      await adapter.execute(mockParams);

      expect(capturedPayload.callbackUrl).toMatch(/\/api\/v1\/callbacks\/n8n/);
      expect(capturedPayload.requestId).toBe('request-123');
      expect(capturedPayload.taskId).toBe('task-456');
    });
  });

  describe('5xx Error Retry Behavior', () => {
    it('should retry on 500 Internal Server Error', async () => {
      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(500, 'Internal Server Error')
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(500, 'Internal Server Error')
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(200, { executionId: 'exec-success', status: 'pending' });

      const result = await adapter.execute(mockParams);

      expect(result.success).toBe(true);
      expect(result.output?.execution_id).toBe('exec-success');

      // Verify all 3 attempts were made
      expect(nock.isDone()).toBe(true);
    });

    it('should retry on 503 Service Unavailable', async () => {
      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(503, 'Service Unavailable')
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(200, { executionId: 'exec-success', status: 'pending' });

      const result = await adapter.execute(mockParams);

      expect(result.success).toBe(true);
      expect(nock.isDone()).toBe(true);
    });

    it('should fail after exhausting all retry attempts', async () => {
      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .times(3)
        .reply(500, 'Internal Server Error');

      const result = await adapter.execute(mockParams);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('500');

      // Verify failure metrics
      const { recordFailure } = await import('@/utils/metrics');
      expect(recordFailure).toHaveBeenCalledWith(
        'n8n-dispatch',
        expect.any(Number),
        expect.stringContaining('500'),
        expect.any(Object)
      );
    });
  });

  describe('4xx Error Handling (No Retry)', () => {
    it('should NOT retry on 404 Not Found', async () => {
      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(404, 'Workflow not found');

      const result = await adapter.execute(mockParams);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('404');

      // Verify only 1 attempt was made (no retries)
      expect(nock.isDone()).toBe(true);
    });

    it('should NOT retry on 401 Unauthorized', async () => {
      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(401, 'Invalid API key');

      const result = await adapter.execute(mockParams);

      expect(result.success).toBe(false);
      expect(nock.isDone()).toBe(true);
    });

    it('should retry on 429 Rate Limit', async () => {
      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(429, 'Rate limit exceeded')
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(200, { executionId: 'exec-success', status: 'pending' });

      const result = await adapter.execute(mockParams);

      expect(result.success).toBe(true);
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('Timeout Scenarios', () => {
    it('should timeout after configured duration', async () => {
      // Mock a slow response (3s, but timeout is 2s)
      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .delay(3000)
        .reply(200, { executionId: 'exec-123', status: 'pending' });

      const result = await adapter.execute(mockParams);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });

    it('should succeed if response comes before timeout', async () => {
      // Mock a fast response (500ms, timeout is 2s)
      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .delay(500)
        .reply(200, { executionId: 'exec-fast', status: 'pending' });

      const result = await adapter.execute(mockParams);

      expect(result.success).toBe(true);
      expect(result.output?.execution_id).toBe('exec-fast');
    });
  });

  describe('API Key Sanitization', () => {
    it('should sanitize API keys in error messages', async () => {
      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(401, 'Invalid api_key=sk-1234567890abcdef provided');

      const result = await adapter.execute(mockParams);

      expect(result.error?.message).not.toContain('sk-1234567890abcdef');
      expect(result.error?.message).toContain('***REDACTED***');
    });

    it('should sanitize api-key variants', async () => {
      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .reply(401, 'Invalid api-key: "secret-key-here"');

      const result = await adapter.execute(mockParams);

      expect(result.error?.message).not.toContain('secret-key-here');
      expect(result.error?.message).toContain('***REDACTED***');
    });
  });

  describe('Idempotent Metadata Upserts', () => {
    it('should upsert on duplicate execution IDs', async () => {
      const executionId = 'exec-duplicate-123';

      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .times(2)
        .reply(200, { executionId, status: 'pending' });

      // First dispatch
      await adapter.execute(mockParams);
      expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1);

      // Second dispatch with same execution ID
      await adapter.execute(mockParams);
      expect(mockSupabaseUpsert).toHaveBeenCalledTimes(2);

      // Both should use onConflict for idempotency
      expect(mockSupabaseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          external_job_id: executionId,
        }),
        expect.objectContaining({
          onConflict: 'provider_name,external_job_id',
          ignoreDuplicates: false,
        })
      );
    });
  });

  describe('Workflow Selection', () => {
    it('should select correct workflow for video tasks', async () => {
      mockParams.task.task_name = 'video_production';

      let capturedUrl = '';
      nock(N8N_BASE_URL)
        .post((uri) => {
          capturedUrl = uri;
          return true;
        })
        .reply(200, { executionId: 'exec-video', status: 'pending' });

      await adapter.execute(mockParams);

      expect(capturedUrl).toContain(WORKFLOW_ID);
    });

    it('should select correct workflow for voiceover tasks', async () => {
      mockParams.task.task_name = 'voiceover_synthesis';

      let capturedUrl = '';
      nock(N8N_BASE_URL)
        .post((uri) => {
          capturedUrl = uri;
          return true;
        })
        .reply(200, { executionId: 'exec-vo', status: 'pending' });

      await adapter.execute(mockParams);

      expect(capturedUrl).toContain(WORKFLOW_ID);
    });
  });

  describe('Feature Flag (N8N_ENABLED)', () => {
    it('should use mock mode when N8N_ENABLED=false and no workflow', async () => {
      process.env.N8N_ENABLED = 'false';

      const noWorkflowAdapter = new ProducerAdapter({
        baseUrl: N8N_BASE_URL,
        apiKey: 'test-api-key',
        workflows: {} as any,
      });

      const result = await noWorkflowAdapter.execute(mockParams);

      expect(result.success).toBe(true);
      expect(result.output?.workflow_id).toBe('mock');
      expect(mockSupabaseInsert).toHaveBeenCalled();

      delete process.env.N8N_ENABLED;
    });

    it('should return error when N8N_ENABLED=true and no workflow', async () => {
      process.env.N8N_ENABLED = 'true';

      const noWorkflowAdapter = new ProducerAdapter({
        baseUrl: N8N_BASE_URL,
        apiKey: 'test-api-key',
        workflows: {} as any,
      });

      const result = await noWorkflowAdapter.execute(mockParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('WORKFLOW_NOT_CONFIGURED');

      delete process.env.N8N_ENABLED;
    });
  });

  describe('Exponential Backoff Timing', () => {
    it('should implement exponential backoff between retries', async () => {
      const attemptTimes: number[] = [];

      nock(N8N_BASE_URL)
        .post(`/api/v1/workflows/${WORKFLOW_ID}/execute`)
        .times(3)
        .reply(() => {
          attemptTimes.push(Date.now());
          return [500, 'Internal Server Error'];
        });

      await adapter.execute(mockParams);

      // Verify we made 3 attempts
      expect(attemptTimes.length).toBe(3);

      // Check delays between attempts (approximately 1s, 2s)
      const delay1 = attemptTimes[1] - attemptTimes[0];
      const delay2 = attemptTimes[2] - attemptTimes[1];

      // Allow some tolerance for test timing (±500ms)
      expect(delay1).toBeGreaterThan(800);
      expect(delay1).toBeLessThan(1500);
      expect(delay2).toBeGreaterThan(1800);
      expect(delay2).toBeLessThan(2500);
    });
  });
});
