// =============================================================================
// PROGRESS TRACKER TESTS
// Unit tests for progress calculation and task tracking
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgressTracker } from '@/lib/orchestrator/ProgressTracker';
import type { RequestTask } from '@/lib/orchestrator/types';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            data: mockTasks,
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

let mockTasks: Partial<RequestTask>[] = [];

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
    mockTasks = [];
  });

  describe('getProgress', () => {
    it('should return empty progress when no tasks exist', async () => {
      mockTasks = [];
      const progress = await tracker.getProgress('test-request-id');

      expect(progress.percentage).toBe(0);
      expect(progress.totalTasks).toBe(0);
      expect(progress.completedTasks).toBe(0);
      expect(progress.tasks).toEqual([]);
    });

    it('should calculate progress correctly for completed tasks', async () => {
      mockTasks = [
        {
          id: '1',
          task_key: 'executive',
          task_name: 'Executive Task',
          agent_role: 'executive',
          status: 'completed',
          sequence_order: 1,
          started_at: '2026-01-09T10:00:00Z',
          completed_at: '2026-01-09T10:00:05Z',
          input_data: { estimatedDurationSeconds: 5 },
        },
        {
          id: '2',
          task_key: 'strategist',
          task_name: 'Strategist Task',
          agent_role: 'strategist',
          status: 'completed',
          sequence_order: 2,
          started_at: '2026-01-09T10:00:10Z',
          completed_at: '2026-01-09T10:00:40Z',
          input_data: { estimatedDurationSeconds: 30 },
        },
        {
          id: '3',
          task_key: 'producer',
          task_name: 'Producer Task',
          agent_role: 'producer',
          status: 'pending',
          sequence_order: 3,
          started_at: null,
          completed_at: null,
          input_data: { estimatedDurationSeconds: 180 },
        },
      ] as Partial<RequestTask>[];

      const progress = await tracker.getProgress('test-request-id');

      expect(progress.totalTasks).toBe(3);
      expect(progress.completedTasks).toBe(2);
      expect(progress.inProgressTasks).toBe(0);
      expect(progress.pendingTasks).toBe(1);
      expect(progress.failedTasks).toBe(0);

      // Weighted percentage: (5 + 30) / (5 + 30 + 180) = 35/215 ≈ 16%
      expect(progress.percentage).toBeGreaterThan(0);
      expect(progress.percentage).toBeLessThan(100);

      // Should estimate remaining time based on pending tasks
      expect(progress.estimatedSecondsRemaining).toBeGreaterThan(0);
    });

    it('should handle in-progress tasks correctly', async () => {
      mockTasks = [
        {
          id: '1',
          task_key: 'executive',
          task_name: 'Executive Task',
          agent_role: 'executive',
          status: 'completed',
          sequence_order: 1,
          started_at: '2026-01-09T10:00:00Z',
          completed_at: '2026-01-09T10:00:05Z',
          input_data: { estimatedDurationSeconds: 5 },
        },
        {
          id: '2',
          task_key: 'strategist',
          task_name: 'Strategist Task',
          agent_role: 'strategist',
          status: 'in_progress',
          sequence_order: 2,
          started_at: '2026-01-09T10:00:10Z',
          completed_at: null,
          input_data: { estimatedDurationSeconds: 30 },
        },
      ] as Partial<RequestTask>[];

      const progress = await tracker.getProgress('test-request-id');

      expect(progress.inProgressTasks).toBe(1);
      expect(progress.currentPhase).toBe('draft'); // Strategist maps to draft
      
      // In-progress tasks count as 50% complete
      expect(progress.percentage).toBeGreaterThan(0);
      expect(progress.percentage).toBeLessThan(100);
    });

    it('should track failed tasks', async () => {
      mockTasks = [
        {
          id: '1',
          task_key: 'executive',
          task_name: 'Executive Task',
          agent_role: 'executive',
          status: 'completed',
          sequence_order: 1,
          started_at: '2026-01-09T10:00:00Z',
          completed_at: '2026-01-09T10:00:05Z',
          input_data: { estimatedDurationSeconds: 5 },
        },
        {
          id: '2',
          task_key: 'strategist',
          task_name: 'Strategist Task',
          agent_role: 'strategist',
          status: 'failed',
          sequence_order: 2,
          started_at: '2026-01-09T10:00:10Z',
          completed_at: '2026-01-09T10:00:15Z',
          input_data: { estimatedDurationSeconds: 30 },
        },
      ] as Partial<RequestTask>[];

      const progress = await tracker.getProgress('test-request-id');

      expect(progress.failedTasks).toBe(1);
      expect(progress.tasks[1].status).toBe('failed');
    });

    it('should calculate actual duration for completed tasks', async () => {
      mockTasks = [
        {
          id: '1',
          task_key: 'executive',
          task_name: 'Executive Task',
          agent_role: 'executive',
          status: 'completed',
          sequence_order: 1,
          started_at: '2026-01-09T10:00:00Z',
          completed_at: '2026-01-09T10:00:10Z', // 10 seconds
          input_data: { estimatedDurationSeconds: 5 },
        },
      ] as Partial<RequestTask>[];

      const progress = await tracker.getProgress('test-request-id');

      expect(progress.tasks[0].duration_seconds).toBe(10);
      expect(progress.tasks[0].estimated_duration_seconds).toBe(5);
    });

    it('should use default durations when not specified', async () => {
      mockTasks = [
        {
          id: '1',
          task_key: 'executive',
          task_name: 'Executive Task',
          agent_role: 'executive',
          status: 'pending',
          sequence_order: 1,
          started_at: null,
          completed_at: null,
          input_data: {}, // No estimatedDurationSeconds
        },
      ] as Partial<RequestTask>[];

      const progress = await tracker.getProgress('test-request-id');

      // Executive default is 5 seconds
      expect(progress.tasks[0].estimated_duration_seconds).toBe(5);
    });

    it('should determine current phase based on in-progress task', async () => {
      const testCases = [
        { agent_role: 'executive', expectedPhase: 'intake' },
        { agent_role: 'task_planner', expectedPhase: 'intake' },
        { agent_role: 'strategist', expectedPhase: 'draft' },
        { agent_role: 'copywriter', expectedPhase: 'draft' },
        { agent_role: 'producer', expectedPhase: 'production' },
        { agent_role: 'qa', expectedPhase: 'qa' },
      ];

      for (const { agent_role, expectedPhase } of testCases) {
        mockTasks = [
          {
            id: '1',
            task_key: agent_role,
            task_name: `${agent_role} Task`,
            agent_role,
            status: 'in_progress',
            sequence_order: 1,
            started_at: '2026-01-09T10:00:00Z',
            completed_at: null,
            input_data: {},
          },
        ] as Partial<RequestTask>[];

        const progress = await tracker.getProgress('test-request-id');
        expect(progress.currentPhase).toBe(expectedPhase);
      }
    });

    it('should show 100% when all tasks are complete', async () => {
      mockTasks = [
        {
          id: '1',
          task_key: 'executive',
          task_name: 'Executive Task',
          agent_role: 'executive',
          status: 'completed',
          sequence_order: 1,
          started_at: '2026-01-09T10:00:00Z',
          completed_at: '2026-01-09T10:00:05Z',
          input_data: { estimatedDurationSeconds: 5 },
        },
        {
          id: '2',
          task_key: 'strategist',
          task_name: 'Strategist Task',
          agent_role: 'strategist',
          status: 'completed',
          sequence_order: 2,
          started_at: '2026-01-09T10:00:10Z',
          completed_at: '2026-01-09T10:00:40Z',
          input_data: { estimatedDurationSeconds: 30 },
        },
      ] as Partial<RequestTask>[];

      const progress = await tracker.getProgress('test-request-id');

      expect(progress.percentage).toBe(100);
      expect(progress.estimatedSecondsRemaining).toBeNull();
    });
  });
});
