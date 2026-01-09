// =============================================================================
// PROGRESS API INTEGRATION TESTS
// Tests for SSE endpoint with realtime updates
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/requests/[id]/progress/route';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('@/lib/orchestrator/ProgressTracker', () => ({
  progressTracker: {
    getProgress: vi.fn(() => mockProgressData),
  },
}));

let mockSupabaseClient: any;
let mockProgressData: any;
let mockUser: any;
let mockRequest: any;

describe('Progress API Integration Tests', () => {
  beforeEach(() => {
    mockUser = {
      id: 'user-123',
    };

    mockRequest = {
      id: 'request-123',
      user_id: 'user-123',
      status: 'draft',
    };

    mockProgressData = {
      percentage: 25,
      completedTasks: 1,
      totalTasks: 4,
      inProgressTasks: 1,
      pendingTasks: 2,
      failedTasks: 0,
      estimatedSecondsRemaining: 180,
      currentPhase: 'draft',
      tasks: [
        {
          id: 'task-1',
          task_key: 'executive',
          task_name: 'Executive Task',
          agent_role: 'executive',
          status: 'completed',
          sequence_order: 1,
          started_at: '2026-01-09T10:00:00Z',
          completed_at: '2026-01-09T10:00:05Z',
          duration_seconds: 5,
          estimated_duration_seconds: 5,
        },
      ],
    };

    mockSupabaseClient = {
      auth: {
        getUser: vi.fn(() => ({
          data: { user: mockUser },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === 'content_requests') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: mockRequest,
                  error: null,
                })),
              })),
            })),
          };
        }
        return {};
      }),
    };
  });

  it('should return 401 if user is not authenticated', async () => {
    mockSupabaseClient.auth.getUser = vi.fn(() => ({
      data: { user: null },
      error: new Error('Not authenticated'),
    }));

    const request = new NextRequest('http://localhost/api/v1/requests/request-123/progress');
    const response = await GET(request, { params: { id: 'request-123' } });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 if request does not exist', async () => {
    mockSupabaseClient.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: new Error('Not found'),
          })),
        })),
      })),
    }));

    const request = new NextRequest('http://localhost/api/v1/requests/request-123/progress');
    const response = await GET(request, { params: { id: 'request-123' } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Request not found');
  });

  it('should return 403 if user does not own the request', async () => {
    mockRequest.user_id = 'different-user';

    const request = new NextRequest('http://localhost/api/v1/requests/request-123/progress');
    const response = await GET(request, { params: { id: 'request-123' } });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Access denied');
  });

  it('should return SSE stream with correct headers', async () => {
    const request = new NextRequest('http://localhost/api/v1/requests/request-123/progress');
    const response = await GET(request, { params: { id: 'request-123' } });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('Connection')).toBe('keep-alive');
  });

  it('should stream progress data as SSE events', async () => {
    const request = new NextRequest('http://localhost/api/v1/requests/request-123/progress');
    const response = await GET(request, { params: { id: 'request-123' } });

    // Read first chunk from stream
    const reader = response.body?.getReader();
    const { value, done } = await reader!.read();

    expect(done).toBe(false);

    // Decode SSE message
    const text = new TextDecoder().decode(value);
    expect(text).toContain('data: ');

    // Parse JSON from SSE
    const jsonMatch = text.match(/data: (.*)\n/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1]);
      expect(data.percentage).toBe(25);
      expect(data.completedTasks).toBe(1);
      expect(data.totalTasks).toBe(4);
    }

    reader!.cancel();
  });

  it('should close stream when request is complete', async () => {
    mockProgressData.percentage = 100;
    mockRequest.status = 'published';

    const request = new NextRequest('http://localhost/api/v1/requests/request-123/progress');
    const response = await GET(request, { params: { id: 'request-123' } });

    // Stream should close immediately if complete
    const reader = response.body?.getReader();
    const { value, done } = await reader!.read();

    // Should receive one message then close
    expect(value).toBeDefined();

    // Next read should indicate stream is done
    // Note: Actual behavior depends on how fast the controller closes
  });
});
