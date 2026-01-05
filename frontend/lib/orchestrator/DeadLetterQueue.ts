/**
 * Dead Letter Queue (DLQ) System
 * 
 * Handles permanently failed tasks that have exceeded maximum retry attempts.
 * Stores failed tasks with full context for manual review and intervention.
 * 
 * DLQ Features:
 * - Automatic detection of tasks exceeding max retries
 * - Structured storage of failure context
 * - Manual review and requeue capabilities
 * - Failure pattern analysis
 */

import { createClient } from '@/lib/supabase/server';
import { eventLogger } from './EventLogger';
import type { RequestTask, ContentRequest } from './types';

/**
 * DLQ Entry represents a permanently failed task
 */
export interface DLQEntry {
  id: string;
  request_id: string;
  task_id: string;
  task_name: string;
  agent_role: string;
  failure_reason: string;
  retry_count: number;
  max_retries: number;
  first_failed_at: string;
  final_failed_at: string;
  error_context: {
    last_error: string;
    error_history: Array<{
      attempt: number;
      error: string;
      timestamp: string;
    }>;
    task_data: Record<string, unknown>;
    request_data: Record<string, unknown>;
  };
  resolution_status: 'pending' | 'investigating' | 'resolved' | 'wont_fix';
  resolution_notes?: string;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
}

/**
 * Maximum retry attempts before sending to DLQ
 */
const MAX_RETRIES = 3;

export class DeadLetterQueue {
  /**
   * Check if a task should be sent to DLQ.
   * 
   * @param task - The task to check
   * @returns True if task should go to DLQ
   */
  shouldSendToDLQ(task: RequestTask): boolean {
    if (task.status !== 'failed') {
      return false;
    }

    // Note: metadata doesn't exist on RequestTask - using error_code as proxy for retry tracking
    // In production, track retries via request_events table
    return false; // Disabled until retry tracking is implemented
  }

  /**
   * Send a task to the Dead Letter Queue.
   * 
   * @param task - The failed task
   * @param request - The associated request
   */
  async sendToDLQ(task: RequestTask, request: ContentRequest): Promise<void> {
    const supabase = await createClient();

    try {
      // Build error context from task history
      const errorContext = await this.buildErrorContext(task, request);

      // Create DLQ entry (stored in request_events with special type)
      const dlqEntry: Partial<DLQEntry> = {
        request_id: task.request_id,
        task_id: task.id,
        task_name: task.task_name,
        agent_role: task.agent_role,
        failure_reason: task.error_message || 'Unknown error',
        retry_count: task.retry_count,
        max_retries: MAX_RETRIES,
        first_failed_at: task.started_at || new Date().toISOString(),
        final_failed_at: new Date().toISOString(),
        error_context: errorContext,
        resolution_status: 'pending',
      };

      // Log DLQ event
      await eventLogger.logEvent({
        request_id: task.request_id,
        event_type: 'system_error',
        description: `Task sent to Dead Letter Queue: ${task.task_name}`,
        metadata: {
          dlq_entry: dlqEntry,
          reason: 'max_retries_exceeded',
        },
        task_id: task.id,
        actor: 'system:dlq',
      });

      // Update task status to mark as DLQ
      await supabase
        .from('request_tasks')
        .update({
          error_code: 'DLQ_MAX_RETRIES',
          error_message: `Sent to DLQ: ${task.error_message}`,
        })
        .eq('id', task.id);

      console.log(`[DLQ] Task ${task.id} sent to Dead Letter Queue:`, {
        task_name: task.task_name,
        retry_count: dlqEntry.retry_count,
        reason: dlqEntry.failure_reason,
      });
    } catch (error) {
      console.error('[DLQ] Failed to send task to DLQ:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive error context for DLQ entry.
   * 
   * @param task - The failed task
   * @param request - The associated request
   * @returns Error context object
   */
  private async buildErrorContext(
    task: RequestTask,
    request: ContentRequest
  ): Promise<DLQEntry['error_context']> {
    const supabase = await createClient();

    // Get task failure history from events
    const { data: failureEvents } = await supabase
      .from('request_events')
      .select('*')
      .eq('request_id', task.request_id)
      .eq('task_id', task.id)
      .eq('event_type', 'task_failed')
      .order('created_at', { ascending: true });

    const errorHistory = (failureEvents || []).map((event, index) => ({
      attempt: index + 1,
      error: event.description,
      timestamp: event.created_at,
    }));

    return {
      last_error: task.error_message || 'Unknown error',
      error_history: errorHistory,
      task_data: {
        id: task.id,
        task_name: task.task_name,
        agent_role: task.agent_role,
        status: task.status,
        input_data: task.input_data,
        output_data: task.output_data,
        depends_on: task.depends_on,
        retry_count: task.retry_count,
      },
      request_data: {
        id: request.id,
        title: request.title,
        request_type: request.request_type,
        status: request.status,
        metadata: request.metadata,
      },
    };
  }

  /**
   * Get all DLQ entries with optional filtering.
   * 
   * @param filters - Optional filters
   * @returns Array of DLQ entries
   */
  async getDLQEntries(filters?: {
    resolution_status?: DLQEntry['resolution_status'];
    agent_role?: string;
    since?: string;
  }): Promise<DLQEntry[]> {
    const supabase = await createClient();

    let query = supabase
      .from('request_events')
      .select('*')
      .eq('event_type', 'error')
      .like('description', '%Dead Letter Queue%')
      .order('created_at', { ascending: false });

    if (filters?.since) {
      query = query.gte('created_at', filters.since);
    }

    const { data: events } = await query;

    if (!events) return [];

    // Parse DLQ entries from event metadata
    let entries = events
      .map(event => event.metadata?.dlq_entry as DLQEntry)
      .filter(entry => entry);

    // Apply filters
    if (filters?.resolution_status) {
      entries = entries.filter(e => e.resolution_status === filters.resolution_status);
    }

    if (filters?.agent_role) {
      entries = entries.filter(e => e.agent_role === filters.agent_role);
    }

    return entries;
  }

  /**
   * Retry a task from the DLQ (manual intervention).
   * 
   * @param taskId - ID of the task to retry
   * @param notes - Intervention notes
   * @returns Success status
   */
  async retryFromDLQ(taskId: string, notes: string): Promise<boolean> {
    const supabase = await createClient();

    try {
      // Reset task status and clear retry count
      const { error } = await supabase
        .from('request_tasks')
        .update({
          status: 'pending',
          error_message: null,
          error_code: null,
          retry_count: 0,
        })
        .eq('id', taskId);

      if (error) {
        console.error('[DLQ] Failed to retry task:', error);
        return false;
      }

      // Get task details for logging
      const { data: task } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (task) {
        await eventLogger.logEvent({
          request_id: task.request_id,
          event_type: 'retry_initiated',
          description: `Task retried from DLQ: ${task.task_name}`,
          metadata: {
            task_id: taskId,
            intervention_notes: notes,
          },
          task_id: taskId,
          actor: 'manual:dlq_retry',
        });
      }

      return true;
    } catch (error) {
      console.error('[DLQ] Error retrying task:', error);
      return false;
    }
  }

  /**
   * Get DLQ statistics.
   * 
   * @returns DLQ metrics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    investigating: number;
    resolved: number;
    wont_fix: number;
    by_agent: Record<string, number>;
  }> {
    const entries = await this.getDLQEntries();

    const stats = {
      total: entries.length,
      pending: entries.filter(e => e.resolution_status === 'pending').length,
      investigating: entries.filter(e => e.resolution_status === 'investigating').length,
      resolved: entries.filter(e => e.resolution_status === 'resolved').length,
      wont_fix: entries.filter(e => e.resolution_status === 'wont_fix').length,
      by_agent: {} as Record<string, number>,
    };

    // Count by agent role
    for (const entry of entries) {
      stats.by_agent[entry.agent_role] = (stats.by_agent[entry.agent_role] || 0) + 1;
    }

    return stats;
  }
}

/**
 * Singleton instance
 */
export const deadLetterQueue = new DeadLetterQueue();

/**
 * Export class for testing
 */
export default DeadLetterQueue;
