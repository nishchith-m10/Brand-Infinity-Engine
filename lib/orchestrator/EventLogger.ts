// =============================================================================
// EVENT LOGGER
// Logs all orchestrator events to request_events table
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import {
  EventType,
  RequestEventInsert,
  RequestStatus,
  TaskStatus,
  EventLogParams,
} from './types';

/**
 * EventLogger class manages logging events to the request_events table.
 * 
 * Responsibilities:
 * - Log all lifecycle events for requests and tasks
 * - Provide structured event logging with metadata
 * - Support event queries and history retrieval
 * - Never throw errors (logging should not break orchestration)
 * 
 * Event Types:
 * - created: Request created
 * - status_change: Request status transition
 * - task_started: Task execution began
 * - task_completed: Task finished successfully
 * - task_failed: Task failed with error
 * - agent_log: Agent intermediate message
 * - provider_callback: Provider webhook callback
 * - retry: Task retry attempted
 * - cancelled: Request cancelled
 * - error: Unexpected error occurred
 */
export class EventLogger {
  /**
   * Log a generic event to request_events.
   * 
   * @param params - Event log parameters
   */
  async logEvent(params: EventLogParams): Promise<void> {
    const supabase = await createClient();

    const event: RequestEventInsert = {
      request_id: params.request_id,
      event_type: params.event_type,
      description: params.description,
      metadata: params.metadata || {},
      task_id: params.task_id || null,
      actor: params.actor || 'system:orchestrator',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('request_events').insert(event);

    if (error) {
      console.error('[EventLogger] Failed to log event:', error);
      // Don't throw - event logging should not break the orchestration flow
    }
  }

  /**
   * Log request creation event.
   * 
   * @param requestId - The request ID
   * @param createdBy - User ID who created the request
   * @param requestType - Type of content request
   */
  async logCreated(
    requestId: string,
    createdBy: string,
    requestType: string
  ): Promise<void> {
    await this.logEvent({
      request_id: requestId,
      event_type: 'created',
      description: 'Request created',
      metadata: {
        created_by: createdBy,
        request_type: requestType,
      },
      actor: createdBy,
    });
  }

  /**
   * Log status change event.
   * 
   * @param requestId - The request ID
   * @param fromStatus - Previous status
   * @param toStatus - New status
   * @param reason - Optional reason for transition
   */
  async logStatusChange(
    requestId: string,
    fromStatus: RequestStatus,
    toStatus: RequestStatus,
    reason?: string
  ): Promise<void> {
    await this.logEvent({
      request_id: requestId,
      event_type: 'status_change',
      description: `Status changed: ${fromStatus} → ${toStatus}`,
      metadata: {
        from_status: fromStatus,
        to_status: toStatus,
        reason: reason,
      },
    });
  }

  /**
   * Log task started event.
   * 
   * @param requestId - The request ID
   * @param taskId - The task ID
   * @param taskName - Human-readable task name
   * @param agentRole - Agent role handling the task
   */
  async logTaskStarted(
    requestId: string,
    taskId: string,
    taskName: string,
    agentRole: string
  ): Promise<void> {
    await this.logEvent({
      request_id: requestId,
      event_type: 'task_started',
      description: `Task started: ${taskName}`,
      metadata: {
        task_id: taskId,
        task_name: taskName,
        agent_role: agentRole,
      },
      task_id: taskId,
      actor: `agent:${agentRole}`,
    });
  }

  /**
   * Log task completion event.
   * 
   * @param requestId - The request ID
   * @param taskId - The task ID
   * @param taskName - Human-readable task name
   * @param agentRole - Agent role that completed the task
   * @param outputSummary - Optional summary of task output
   * @param durationMs - Task execution duration in milliseconds
   */
  async logTaskCompleted(
    requestId: string,
    taskId: string,
    taskName: string,
    agentRole: string,
    outputSummary?: string,
    durationMs?: number
  ): Promise<void> {
    await this.logEvent({
      request_id: requestId,
      event_type: 'task_completed',
      description: `Task completed: ${taskName}`,
      metadata: {
        task_id: taskId,
        task_name: taskName,
        agent_role: agentRole,
        output_summary: outputSummary,
        duration_ms: durationMs,
      },
      task_id: taskId,
      actor: `agent:${agentRole}`,
    });
  }

  /**
   * Log task failure event.
   * 
   * @param requestId - The request ID
   * @param taskId - The task ID
   * @param taskName - Human-readable task name
   * @param agentRole - Agent role that failed
   * @param errorCode - Error code
   * @param errorMessage - Error description
   * @param retriable - Whether the task can be retried
   */
  async logTaskFailed(
    requestId: string,
    taskId: string,
    taskName: string,
    agentRole: string,
    errorCode: string,
    errorMessage: string,
    retriable: boolean
  ): Promise<void> {
    await this.logEvent({
      request_id: requestId,
      event_type: 'task_failed',
      description: `Task failed: ${taskName} - ${errorMessage}`,
      metadata: {
        task_id: taskId,
        task_name: taskName,
        agent_role: agentRole,
        error_code: errorCode,
        error_message: errorMessage,
        retriable: retriable,
      },
      task_id: taskId,
      actor: `agent:${agentRole}`,
    });
  }

  /**
   * Log agent intermediate message (for debugging/monitoring).
   * 
   * @param requestId - The request ID
   * @param taskId - The task ID
   * @param agentRole - Agent role
   * @param message - Log message
   * @param data - Optional additional data
   */
  async logAgentMessage(
    requestId: string,
    taskId: string,
    agentRole: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await this.logEvent({
      request_id: requestId,
      event_type: 'agent_log',
      description: message,
      metadata: {
        task_id: taskId,
        agent_role: agentRole,
        data: data,
      },
      task_id: taskId,
      actor: `agent:${agentRole}`,
    });
  }

  /**
   * Log provider callback event.
   * 
   * @param requestId - The request ID
   * @param taskId - The task ID
   * @param providerName - Name of the provider (e.g., 'runway', 'sora')
   * @param externalJobId - Provider's job ID
   * @param status - Callback status
   * @param outputUrl - Optional output URL
   * @param errorMessage - Optional error message if failed
   * @param cost - Optional cost incurred
   */
  async logProviderCallback(
    requestId: string,
    taskId: string,
    providerName: string,
    externalJobId: string,
    status: 'completed' | 'failed',
    outputUrl?: string,
    errorMessage?: string,
    cost?: number
  ): Promise<void> {
    await this.logEvent({
      request_id: requestId,
      event_type: 'provider_completed',
      description: `Provider callback: ${providerName} - ${status}`,
      metadata: {
        task_id: taskId,
        provider_name: providerName,
        external_job_id: externalJobId,
        status: status,
        output_url: outputUrl,
        error_message: errorMessage,
        cost_incurred: cost,
      },
      task_id: taskId,
      actor: `provider:${providerName}`,
    });
  }

  /**
   * Log retry event.
   * 
   * @param requestId - The request ID
   * @param taskId - The task ID
   * @param taskName - Human-readable task name
   * @param retryCount - Current retry attempt number
   * @param reason - Reason for retry
   */
  async logRetry(
    requestId: string,
    taskId: string,
    taskName: string,
    retryCount: number,
    reason: string
  ): Promise<void> {
    await this.logEvent({
      request_id: requestId,
      event_type: 'retry_initiated',
      description: `Retrying task: ${taskName} (attempt ${retryCount})`,
      metadata: {
        task_id: taskId,
        task_name: taskName,
        retry_count: retryCount,
        reason: reason,
      },
      task_id: taskId,
    });
  }

  /**
   * Log cancellation event.
   * 
   * @param requestId - The request ID
   * @param reason - Reason for cancellation
   * @param cancelledBy - User or system that cancelled
   */
  async logCancelled(
    requestId: string,
    reason: string,
    cancelledBy: string
  ): Promise<void> {
    await this.logEvent({
      request_id: requestId,
      event_type: 'user_action',
      description: `Request cancelled: ${reason}`,
      metadata: {
        reason: reason,
      },
      actor: cancelledBy,
    });
  }

  /**
   * Log error event (for unexpected errors).
   * 
   * @param requestId - The request ID
   * @param errorCode - Error code
   * @param errorMessage - Error description
   * @param stack - Optional stack trace
   * @param taskId - Optional task ID if error is task-specific
   */
  async logError(
    requestId: string,
    errorCode: string,
    errorMessage: string,
    stack?: string,
    taskId?: string
  ): Promise<void> {
    await this.logEvent({
      request_id: requestId,
      event_type: 'system_error',
      description: `Error: ${errorCode} - ${errorMessage}`,
      metadata: {
        error_code: errorCode,
        error_message: errorMessage,
        stack: stack,
      },
      task_id: taskId,
    });
  }

  /**
   * Log budget warning event.
   * 
   * @param requestId - The request ID
   * @param budgetCap - Budget cap amount
   * @param currentSpend - Current spend amount
   */
  async logBudgetWarning(
    requestId: string,
    budgetCap: number,
    currentSpend: number
  ): Promise<void> {
    await this.logEvent({
      request_id: requestId,
      event_type: 'user_action',
      description: `Budget warning: $${currentSpend.toFixed(2)} of $${budgetCap.toFixed(2)} spent`,
      metadata: {
        budget_cap: budgetCap,
        current_spend: currentSpend,
        percentage: Math.round((currentSpend / budgetCap) * 100),
      },
    });
  }

  /**
   * Get event history for a request.
   * 
   * @param requestId - The request ID
   * @param limit - Maximum number of events to return
   * @param eventType - Optional filter by event type
   * @returns Promise resolving to array of events
   */
  async getEventHistory(
    requestId: string,
    limit: number = 100,
    eventType?: EventType
  ): Promise<RequestEventInsert[]> {
    const supabase = await createClient();

    let query = supabase
      .from('request_events')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    return (data || []) as RequestEventInsert[];
  }

  /**
   * Get the most recent event for a request.
   * 
   * @param requestId - The request ID
   * @returns Promise resolving to the latest event or null
   */
  async getLatestEvent(requestId: string): Promise<RequestEventInsert | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('request_events')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch latest event: ${error.message}`);
    }

    return data && data.length > 0 ? (data[0] as RequestEventInsert) : null;
  }

  /**
   * Get events for a specific task.
   * 
   * @param requestId - The request ID
   * @param taskId - The task ID
   * @returns Promise resolving to array of task events
   */
  async getTaskEvents(requestId: string, taskId: string): Promise<RequestEventInsert[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('request_events')
      .select('*')
      .eq('request_id', requestId)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch task events: ${error.message}`);
    }

    return (data || []) as RequestEventInsert[];
  }

  /**
   * Count events by type for a request.
   * 
   * @param requestId - The request ID
   * @returns Promise resolving to event counts by type
   */
  async getEventCounts(requestId: string): Promise<Record<EventType, number>> {
    const events = await this.getEventHistory(requestId, 1000);

    const counts: Record<string, number> = {
      created: 0,
      status_change: 0,
      task_started: 0,
      task_completed: 0,
      task_failed: 0,
      agent_log: 0,
      provider_callback: 0,
      retry: 0,
      cancelled: 0,
      error: 0,
    };

    for (const event of events) {
      counts[event.event_type] = (counts[event.event_type] || 0) + 1;
    }

    return counts as Record<EventType, number>;
  }

  /**
   * Check if a request has any error events.
   * 
   * @param requestId - The request ID
   * @returns Promise resolving to true if errors exist
   */
  async hasErrors(requestId: string): Promise<boolean> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('request_events')
      .select('id')
      .eq('request_id', requestId)
      .eq('event_type', 'error')
      .limit(1);

    if (error) {
      console.error('[EventLogger] Failed to check for errors:', error);
      return false;
    }

    return (data?.length || 0) > 0;
  }
}

// Export singleton instance
export const eventLogger = new EventLogger();

// Export class for testing
export default EventLogger;
