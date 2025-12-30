/**
 * ProducerAdapter Unit Tests
 *
 * Tests for n8n production integration including:
 * - HTTP timeout configuration
 * - Retry logic with exponential backoff
 * - Feature flag (N8N_ENABLED)
 * - Circuit breaker integration
 * - Provider metadata persistence
 * - Metrics tracking
 * - Error sanitization
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProducerAdapter } from '@/lib/adapters/ProducerAdapter';
import type { AgentExecutionParams } from '@/lib/orchestrator/types';

// Mock dependencies
vi.mock('@/lib/orchestrator/CircuitBreaker', () => ({
  circuitBreakers: {
    n8n: {
      execute: vi.fn((fn) => fn()),
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

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { campaign_id: 'test-campaign', prompt: 'test prompt' }, error: null }),
    })),
  })),
}));

vi.mock('@/utils/metrics', () => ({
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

// Mock global fetch
global.fetch = vi.fn();

describe('ProducerAdapter', () => {
  let adapter: ProducerAdapter;
  let mockParams: AgentExecutionParams;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment variables
    process.env.N8N_ENABLED = 'true';
    process.env.N8N_REQUEST_TIMEOUT_MS = '5000';
    process.env.N8N_RETRY_ATTEMPTS = '3';

    adapter = new ProducerAdapter({
      baseUrl: 'https://n8n.test',
      apiKey: 'test-api-key',
      workflows: {
        video_production: 'video-workflow-id',
        image_generation: 'image-workflow-id',
        voiceover_synthesis: 'voiceover-workflow-id',
      },
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HTTP Timeout Configuration', () => {
    it('should use default timeout of 30s if not configured', () => {
      delete process.env.N8N_REQUEST_TIMEOUT_MS;
      const defaultAdapter = new ProducerAdapter();
      expect((defaultAdapter as any).config.timeout).toBe(30000);
    });

    it('should use custom timeout from environment', () => {
      process.env.N8N_REQUEST_TIMEOUT_MS = '15000';
      const customAdapter = new ProducerAdapter();
      expect((customAdapter as any).config.timeout).toBe(15000);
    });

    it('should use timeout from constructor config', () => {
      const customAdapter = new ProducerAdapter({ timeout: 10000 } as any);
      expect((customAdapter as any).config.timeout).toBe(10000);
    });

    it('should abort request on timeout', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';

      (global.fetch as any).mockRejectedValueOnce(abortError);

      const result = await adapter.execute(mockParams);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });
  });

  describe('Retry Logic', () => {
    it('should use default retry attempts of 3 if not configured', () => {
      delete process.env.N8N_RETRY_ATTEMPTS;
      const defaultAdapter = new ProducerAdapter();
      expect((defaultAdapter as any).config.retryAttempts).toBe(3);
    });

    it('should retry on 5xx errors', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('n8n dispatch failed: 500'))
        .mockRejectedValueOnce(new Error('n8n dispatch failed: 503'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ executionId: 'exec-123', status: 'pending' }),
        });

      const result = await adapter.execute(mockParams);

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should not retry on 4xx errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      });

      const result = await adapter.execute(mockParams);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
    });
  });

  describe('Feature Flag (N8N_ENABLED)', () => {
    it('should return error when N8N_ENABLED=true and no workflow configured', async () => {
      const noWorkflowAdapter = new ProducerAdapter({
        workflows: {} as any,
      });

      const result = await noWorkflowAdapter.execute(mockParams);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('WORKFLOW_NOT_CONFIGURED');
    });

    it('should execute mock dispatch when N8N_ENABLED=false', async () => {
      process.env.N8N_ENABLED = 'false';
      const noWorkflowAdapter = new ProducerAdapter({
        workflows: {} as any,
      });

      const result = await noWorkflowAdapter.execute(mockParams);

      expect(result.success).toBe(true);
      expect(result.output?.workflow_id).toBe('mock');
    });
  });

  describe('Provider Metadata Persistence', () => {
    it('should persist metadata after successful dispatch', async () => {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const mockSupabase = createAdminClient();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ executionId: 'exec-789', status: 'pending' }),
      });

      await adapter.execute(mockParams);

      expect(mockSupabase.from).toHaveBeenCalledWith('provider_metadata');
      const upsertCall = (mockSupabase.from as any).mock.results[0].value.upsert;
      expect(upsertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          request_task_id: 'task-456',
          provider_name: 'n8n',
          external_job_id: 'exec-789',
          provider_status: 'pending',
        }),
        expect.objectContaining({
          onConflict: 'provider_name,external_job_id',
        })
      );
    });
  });

  describe('Metrics Tracking', () => {
    it('should record success metrics on successful dispatch', async () => {
      const { recordSuccess } = await import('@/utils/metrics');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ executionId: 'exec-123', status: 'pending' }),
      });

      await adapter.execute(mockParams);

      expect(recordSuccess).toHaveBeenCalledWith(
        'n8n-dispatch',
        expect.any(Number),
        expect.objectContaining({
          execution_id: 'exec-123',
          task_type: 'image_generation',
        })
      );
    });

    it('should record failure metrics on dispatch error', async () => {
      const { recordFailure } = await import('@/utils/metrics');

      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await adapter.execute(mockParams);

      expect(recordFailure).toHaveBeenCalledWith(
        'n8n-dispatch',
        expect.any(Number),
        expect.stringContaining('error'),
        expect.any(Object)
      );
    });
  });

  describe('Error Sanitization', () => {
    it('should sanitize API keys from error messages', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid api_key=sk-123456789 provided',
      });

      const result = await adapter.execute(mockParams);

      expect(result.error?.message).not.toContain('sk-123456789');
      expect(result.error?.message).toContain('***REDACTED***');
    });
  });

  describe('Workflow Selection', () => {
    it('should select video workflow for video tasks', async () => {
      mockParams.task.task_name = 'video_generation';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ executionId: 'exec-123', status: 'pending' }),
      });

      await adapter.execute(mockParams);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('video-workflow-id'),
        expect.any(Object)
      );
    });

    it('should select image workflow for image tasks', async () => {
      mockParams.task.task_name = 'image_generation';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ executionId: 'exec-123', status: 'pending' }),
      });

      await adapter.execute(mockParams);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('image-workflow-id'),
        expect.any(Object)
      );
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should execute dispatch through circuit breaker', async () => {
      const { circuitBreakers } = await import('@/lib/orchestrator/CircuitBreaker');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ executionId: 'exec-123', status: 'pending' }),
      });

      await adapter.execute(mockParams);

      expect(circuitBreakers.n8n.execute).toHaveBeenCalled();
    });
  });
});
