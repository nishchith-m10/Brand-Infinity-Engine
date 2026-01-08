/**
 * n8n Callback Handler Integration Tests
 *
 * Tests the callback API route with:
 * - HMAC signature validation
 * - Idempotency checks (Redis cache)
 * - Transaction atomicity (task + metadata updates)
 * - Success and error callback handling
 * - Metrics recording
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/v1/callbacks/n8n/route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// Mock dependencies
const mockRpc = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: mockSelect,
    })),
    rpc: mockRpc,
  })),
}));

const mockEventLogger = {
  logTaskCompleted: vi.fn(),
  logTaskFailed: vi.fn(),
  logProviderCallback: vi.fn(),
};

vi.mock('@/lib/orchestrator/EventLogger', () => ({
  eventLogger: mockEventLogger,
}));

const mockRequestOrchestrator = {
  resumeRequest: vi.fn(),
};

vi.mock('@/lib/orchestrator/RequestOrchestrator', () => ({
  requestOrchestrator: mockRequestOrchestrator,
}));

const mockGetIdempotencyResponse = vi.fn();
const mockSetIdempotencyResponse = vi.fn();

vi.mock('@/lib/redis/session-cache', () => ({
  getIdempotencyResponse: mockGetIdempotencyResponse,
  setIdempotencyResponse: mockSetIdempotencyResponse,
}));

const mockRecordSuccess = vi.fn();

vi.mock('@/utils/metrics', () => ({
  recordSuccess: mockRecordSuccess,
}));

describe('n8n Callback Handler Integration Tests', () => {
  const WEBHOOK_SECRET = 'test-webhook-secret-12345';
  const REQUEST_ID = 'request-123';
  const TASK_ID = 'task-456';
  const EXECUTION_ID = 'exec-789';
  const WORKFLOW_ID = 'workflow-abc';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIdempotencyResponse.mockResolvedValue(null);
    mockSetIdempotencyResponse.mockResolvedValue(undefined);
    mockRpc.mockResolvedValue({ data: null, error: null });

    // Set webhook secret
    process.env.N8N_WEBHOOK_SECRET = WEBHOOK_SECRET;

    // Mock task query response
    mockSingle.mockResolvedValue({
      data: {
        id: TASK_ID,
        status: 'in_progress',
        task_name: 'image_generation',
        assigned_to: 'producer',
        request: {
          id: REQUEST_ID,
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    delete process.env.N8N_WEBHOOK_SECRET;
    delete process.env.N8N_SIGNATURE_BYPASS;
  });

  /**
   * Helper function to create HMAC signature
   */
  function createSignature(body: string): string {
    return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  }

  /**
   * Helper function to create mock NextRequest
   */
  function createMockRequest(payload: any, signature?: string): NextRequest {
    const body = JSON.stringify(payload);
    const headers = new Headers({
      'content-type': 'application/json',
    });

    if (signature) {
      headers.set('x-n8n-signature', signature);
    }

    return {
      text: async () => body,
      headers,
    } as any;
  }

  describe('HMAC Signature Validation', () => {
    it('should accept valid HMAC signature', async () => {
      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        workflowId: WORKFLOW_ID,
        status: 'success',
        result: { output_url: 'https://cdn.test/image.png' },
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid HMAC signature', async () => {
      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        status: 'success',
      };

      const request = createMockRequest(payload, 'invalid-signature');

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid webhook signature');
    });

    it('should reject missing signature header', async () => {
      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        status: 'success',
      };

      const request = createMockRequest(payload); // No signature

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Missing webhook signature');
    });

    it('should allow bypass in dev mode (N8N_SIGNATURE_BYPASS=true)', async () => {
      process.env.N8N_SIGNATURE_BYPASS = 'true';

      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        status: 'success',
      };

      const request = createMockRequest(payload, 'any-signature');

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Idempotency (Redis Cache)', () => {
    it('should return cached response for duplicate callback', async () => {
      const cachedResponse = {
        success: true,
        message: 'Task completed successfully',
        taskId: TASK_ID,
      };

      mockGetIdempotencyResponse.mockResolvedValueOnce(cachedResponse);

      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        status: 'success',
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cached).toBe(true);
      expect(data.message).toBe('Task completed successfully');

      // Verify transaction was NOT called (using cached response)
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('should cache response after first successful callback', async () => {
      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        workflowId: WORKFLOW_ID,
        status: 'success',
        result: { output_url: 'https://cdn.test/image.png' },
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      await POST(request);

      // Verify response was cached
      expect(mockSetIdempotencyResponse).toHaveBeenCalledWith(
        `n8n_callback:${EXECUTION_ID}`,
        expect.objectContaining({
          success: true,
          message: 'Task completed successfully',
        }),
        86400 // 24h TTL
      );
    });
  });

  describe('Success Callback with Transaction', () => {
    it('should call process_n8n_callback RPC function', async () => {
      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        workflowId: WORKFLOW_ID,
        status: 'success',
        result: {
          output_url: 'https://cdn.test/image.png',
          metadata: { width: 1024, height: 768 },
        },
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify RPC function was called with correct parameters
      expect(mockRpc).toHaveBeenCalledWith('process_n8n_callback', {
        p_task_id: TASK_ID,
        p_execution_id: EXECUTION_ID,
        p_workflow_id: WORKFLOW_ID,
        p_output_url: 'https://cdn.test/image.png',
        p_output_data: payload.result,
      });
    });

    it('should log completion events', async () => {
      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        workflowId: WORKFLOW_ID,
        status: 'success',
        result: { output_url: 'https://cdn.test/image.png' },
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      await POST(request);

      expect(mockEventLogger.logTaskCompleted).toHaveBeenCalledWith(
        REQUEST_ID,
        TASK_ID,
        'image_generation',
        'producer',
        expect.any(String),
        0
      );

      expect(mockEventLogger.logProviderCallback).toHaveBeenCalledWith(
        REQUEST_ID,
        TASK_ID,
        'n8n',
        EXECUTION_ID,
        'completed',
        'https://cdn.test/image.png'
      );
    });

    it('should resume request orchestrator', async () => {
      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        status: 'success',
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      await POST(request);

      expect(mockRequestOrchestrator.resumeRequest).toHaveBeenCalledWith(REQUEST_ID);
    });

    it('should record success metrics', async () => {
      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        status: 'success',
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      await POST(request);

      expect(mockRecordSuccess).toHaveBeenCalledWith(
        'n8n-callback',
        expect.any(Number),
        expect.objectContaining({
          execution_id: EXECUTION_ID,
          task_id: TASK_ID,
          status: 'success',
        })
      );
    });
  });

  describe('Error Callback with Transaction', () => {
    it('should call process_n8n_callback_error RPC function', async () => {
      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        workflowId: WORKFLOW_ID,
        status: 'error',
        error: {
          code: 'WORKFLOW_EXECUTION_FAILED',
          message: 'Failed to generate image',
          details: { step: 'image_generation', reason: 'timeout' },
        },
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify error RPC function was called
      expect(mockRpc).toHaveBeenCalledWith('process_n8n_callback_error', {
        p_task_id: TASK_ID,
        p_execution_id: EXECUTION_ID,
        p_workflow_id: WORKFLOW_ID,
        p_error_message: 'WORKFLOW_EXECUTION_FAILED: Failed to generate image',
        p_error_details: payload.error.details,
      });
    });

    it('should log failure events', async () => {
      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        status: 'error',
        error: {
          code: 'TIMEOUT',
          message: 'Workflow timeout',
        },
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      await POST(request);

      expect(mockEventLogger.logTaskFailed).toHaveBeenCalledWith(
        REQUEST_ID,
        TASK_ID,
        'image_generation',
        'producer',
        'TIMEOUT',
        'Workflow timeout',
        true // retriable
      );
    });
  });

  describe('Request Validation', () => {
    it('should reject missing required fields', async () => {
      const payload = {
        requestId: REQUEST_ID,
        // Missing taskId and status
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject if task not found', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Task not found' },
      });

      const payload = {
        requestId: REQUEST_ID,
        taskId: 'non-existent-task',
        executionId: EXECUTION_ID,
        status: 'success',
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Task not found');
    });

    it('should skip processing if task already completed', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: TASK_ID,
          status: 'completed', // Already completed
          task_name: 'image_generation',
          assigned_to: 'producer',
        },
        error: null,
      });

      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        status: 'success',
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('already completed');

      // Verify transaction was NOT called
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('Transaction Error Handling', () => {
    it('should handle transaction failure gracefully', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Transaction failed: constraint violation' },
      });

      const payload = {
        requestId: REQUEST_ID,
        taskId: TASK_ID,
        executionId: EXECUTION_ID,
        status: 'success',
      };

      const body = JSON.stringify(payload);
      const signature = createSignature(body);
      const request = createMockRequest(payload, signature);

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toContain('Transaction failed');
    });
  });

  describe('Health Check Endpoint', () => {
    it('should respond to GET with status information', async () => {
      // Import GET handler
      const { GET } = await import('@/app/api/v1/callbacks/n8n/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.endpoint).toBe('/api/v1/callbacks/n8n');
      expect(data.methods).toContain('POST');
    });
  });
});
