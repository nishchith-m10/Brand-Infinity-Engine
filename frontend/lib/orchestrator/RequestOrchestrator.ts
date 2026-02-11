// =============================================================================
// REQUEST ORCHESTRATOR
// The central controller for request processing
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import {
  ContentRequest,
  RequestStatus,
  RequestTask,
  OrchestratorConfig,
  DEFAULT_ORCHESTRATOR_CONFIG,
  ProcessRequestResult,
  OrchestratorError,
} from './types';
import { stateMachine } from './StateMachine';
import { taskFactory } from './TaskFactory';
import { eventLogger } from './EventLogger';

/**
 * RequestOrchestrator class manages the request lifecycle.
 * 
 * Responsibilities:
 * - Process requests through status transitions
 * - Coordinate agent execution
 * - Handle async callbacks
 * - Manage retries and error handling
 * - Auto-advance through stages
 * 
 * Flow:
 * 1. processRequest(requestId) - Entry point
 * 2. Load request from DB
 * 3. Dispatch to status handler (intake/draft/production/qa)
 * 4. Status handler executes tasks
 * 5. Check if can auto-advance to next status
 * 6. Repeat until terminal state
 */
export class RequestOrchestrator {
  private config: OrchestratorConfig;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  /**
   * Main entry point: Process a request from its current state.
   * This is called when a new request is created or when resuming processing.
   * 
   * @param requestId - The request ID to process
   * @returns Promise resolving to processing result
   */
  async processRequest(requestId: string): Promise<ProcessRequestResult> {
    console.log(`[Orchestrator] Processing request: ${requestId}`);

    try {
      // 1. Load the request
      const request = await this.loadRequest(requestId);
      if (!request) {
        throw new OrchestratorError(
          `Request not found: ${requestId}`,
          'REQUEST_NOT_FOUND',
          requestId
        );
      }

      // 2. Check if already terminal
      if (stateMachine.isTerminalStatus(request.status as RequestStatus)) {
        console.log(`[Orchestrator] Request ${requestId} is in terminal status: ${request.status}`);
        return {
          success: true,
          requestId,
          finalStatus: request.status as RequestStatus,
        };
      }

      // 3. Dispatch to appropriate handler based on current status
      await this.dispatchToHandler(request);

      // 4. Check if we should auto-advance to next status
      await this.checkAndAdvanceStatus(request);

      // 5. Get final status
      const updatedRequest = await this.loadRequest(requestId);
      
      return {
        success: true,
        requestId,
        finalStatus: updatedRequest?.status as RequestStatus,
      };

    } catch (error) {
      console.error(`[Orchestrator] Error processing request ${requestId}:`, error);
      
      await eventLogger.logError(
        requestId,
        'ORCHESTRATOR_ERROR',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : undefined
      );

      return {
        success: false,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Resume a request that was paused (e.g., after async task completion).
   * 
   * @param requestId - The request ID to resume
   * @returns Promise resolving to processing result
   */
  async resumeRequest(requestId: string): Promise<ProcessRequestResult> {
    console.log(`[Orchestrator] Resuming request: ${requestId}`);
    return await this.processRequest(requestId);
  }

  /**
   * Retry a specific failed task.
   * 
   * @param taskId - The task ID to retry
   * @returns Promise resolving when retry is initiated
   */
  async retryTask(taskId: string): Promise<void> {
    console.log(`[Orchestrator] Retrying task: ${taskId}`);
    const supabase = await createClient();

    // Load the task
    const { data: task, error } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status !== 'failed') {
      throw new Error(`Task ${taskId} is not in failed state (current: ${task.status})`);
    }

    // Check retry count
    const retryCount = (task.retry_count || 0) + 1;
    if (retryCount > this.config.maxTaskRetries) {
      throw new Error(`Task ${taskId} has exceeded max retries (${this.config.maxTaskRetries})`);
    }

    // Log retry
    await eventLogger.logRetry(
      task.request_id,
      taskId,
      task.task_name,
      retryCount,
      'Manual retry requested'
    );

    // Reset task to pending
    await supabase
      .from('request_tasks')
      .update({
        status: 'pending',
        retry_count: retryCount,
        error_message: null,
        started_at: null,
        completed_at: null,
      })
      .eq('id', taskId);

    // Resume the request
    await this.resumeRequest(task.request_id);
  }

  /**
   * Cancel a request.
   * 
   * @param requestId - The request ID to cancel
   * @param reason - Reason for cancellation
   * @param cancelledBy - User or system that cancelled
   * @returns Promise resolving when cancelled
   */
  async cancelRequest(requestId: string, reason: string, cancelledBy: string): Promise<void> {
    console.log(`[Orchestrator] Cancelling request: ${requestId}`);
    const supabase = await createClient();

    const request = await this.loadRequest(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    if (stateMachine.isTerminalStatus(request.status as RequestStatus)) {
      throw new Error(`Cannot cancel request in terminal status: ${request.status}`);
    }

    // Transition to cancelled
    await this.transitionStatus(request, 'cancelled');

    // Mark all pending/in_progress tasks as skipped
    await supabase
      .from('request_tasks')
      .update({ status: 'skipped' })
      .eq('request_id', requestId)
      .in('status', ['pending', 'in_progress']);

    // Log cancellation
    await eventLogger.logCancelled(requestId, reason, cancelledBy);
  }

  /**
   * Handle a callback from n8n or provider.
   * 
   * @param taskId - The task ID that completed
   * @param status - Completion status
   * @param outputUrl - Optional output URL
   * @param errorMessage - Optional error message
   * @param providerData - Optional provider metadata
   * @returns Promise resolving when callback is processed
   */
  async handleCallback(
    taskId: string,
    status: 'completed' | 'failed',
    outputUrl?: string,
    errorMessage?: string,
    providerData?: Record<string, unknown>
  ): Promise<void> {
    console.log(`[Orchestrator] Handling callback for task: ${taskId}`);
    const supabase = await createClient();

    // Load the task
    const { data: task, error } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Update task status
    const updates: Partial<RequestTask> = {
      status,
      completed_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updates.output_url = outputUrl;
      updates.output_data = {
        ...(task.output_data as Record<string, unknown> || {}),
        ...providerData,
      };
    } else {
      updates.error_message = errorMessage;
    }

    await supabase
      .from('request_tasks')
      .update(updates)
      .eq('id', taskId);

    // Store provider metadata
    if (providerData?.provider_name && providerData?.external_job_id) {
      await supabase
        .from('provider_metadata')
        .insert({
          request_task_id: taskId,
          provider_name: providerData.provider_name as string,
          external_job_id: providerData.external_job_id as string,
          response_payload: providerData,
          cost_incurred: (providerData.cost_incurred as number) || null,
          created_at: new Date().toISOString(),
        });
    }

    // Log the callback
    await eventLogger.logProviderCallback(
      task.request_id,
      taskId,
      (providerData?.provider_name as string) || 'unknown',
      (providerData?.external_job_id as string) || 'unknown',
      status,
      outputUrl,
      errorMessage,
      providerData?.cost_incurred as number
    );

    // Resume the request to check for next tasks
    await this.resumeRequest(task.request_id);
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Load a request from the database.
   */
  private async loadRequest(requestId: string): Promise<ContentRequest | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('content_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to load request: ${error.message}`);
    }

    return data as ContentRequest;
  }

  /**
   * Dispatch to the appropriate handler based on request status.
   */
  private async dispatchToHandler(request: ContentRequest): Promise<void> {
    const status = request.status as RequestStatus;

    switch (status) {
      case 'intake':
        await this.handleIntake(request);
        break;
      case 'draft':
        await this.handleDraft(request);
        break;
      case 'production':
        await this.handleProduction(request);
        break;
      case 'qa':
        await this.handleQA(request);
        break;
      case 'published':
      case 'cancelled':
        // Terminal states - nothing to do
        break;
      default:
        throw new Error(`Unknown status: ${status}`);
    }
  }

  /**
   * Handle INTAKE status: Validate and create tasks.
   */
  private async handleIntake(request: ContentRequest): Promise<void> {
    console.log(`[Orchestrator] Handling INTAKE for request: ${request.id}`);

    // 1. Create tasks for this request type
    await taskFactory.createTasksForRequest(request);

    // 2. Transition to draft
    await this.transitionStatus(request, 'draft');

    // 3. Continue processing (will now run draft handler)
    await this.processRequest(request.id);
  }

  /**
   * Handle DRAFT status: Run strategist and copywriter.
   * 
   * Note: Actual agent execution will be handled in Sprint 8.3
   * For now, we just check task completion and advance.
   */
  private async handleDraft(request: ContentRequest): Promise<void> {
    console.log(`[Orchestrator] Handling DRAFT for request: ${request.id}`);

    // Check if all draft tasks are complete
    const tasks = await this.getTasksForRequest(request.id);
    const draftTasksComplete = tasks
      .filter((t) => ['strategist', 'copywriter'].includes(t.agent_role))
      .every((t) => t.status === 'completed' || t.status === 'skipped');

    if (draftTasksComplete) {
      await this.transitionStatus(request, 'production');
      await this.processRequest(request.id);
    }
  }

  /**
   * Handle PRODUCTION status: Run producer (triggers n8n).
   * 
   * Note: Actual n8n dispatch will be handled in Sprint 8.4
   * For now, we just check task completion and advance.
   */
  private async handleProduction(request: ContentRequest): Promise<void> {
    console.log(`[Orchestrator] Handling PRODUCTION for request: ${request.id}`);

    // Get the producer task
    const tasks = await this.getTasksForRequest(request.id);
    const producerTask = tasks.find((t) => t.agent_role === 'producer');

    if (!producerTask) {
      throw new Error('Producer task not found');
    }

    if (producerTask.status === 'in_progress') {
      // Still waiting for callback
      console.log(`[Orchestrator] Producer task in progress, waiting for callback`);
      return;
    } else if (producerTask.status === 'completed') {
      // Producer done - advance to QA
      await this.transitionStatus(request, 'qa');
      await this.processRequest(request.id);
    }
  }

  /**
   * Handle QA status: Run QA agent or auto-approve.
   */
  private async handleQA(request: ContentRequest): Promise<void> {
    console.log(`[Orchestrator] Handling QA for request: ${request.id}`);
    const supabase = await createClient();

    // Auto-approve QA (default behavior) - skip QA and publish
    console.log(`[Orchestrator] Auto-approving QA for request: ${request.id}`);

    // Mark QA task as skipped
    await supabase
      .from('request_tasks')
      .update({ status: 'skipped' })
      .eq('request_id', request.id)
      .eq('agent_role', 'qa');

    await this.transitionStatus(request, 'published');
  }

  /**
   * Transition request to a new status.
   */
  private async transitionStatus(
    request: ContentRequest,
    toStatus: RequestStatus
  ): Promise<void> {
    const supabase = await createClient();
    const fromStatus = request.status as RequestStatus;

    // Validate transition
    const tasks = await this.getTasksForRequest(request.id);
    const validation = stateMachine.validateTransition(fromStatus, toStatus, tasks);

    if (!validation.success) {
      throw new OrchestratorError(
        validation.error || 'Invalid transition',
        'INVALID_TRANSITION',
        request.id
      );
    }

    // Update database
    const { error } = await supabase
      .from('content_requests')
      .update({
        status: toStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (error) {
      throw new Error(`Failed to update status: ${error.message}`);
    }

    // Log the transition
    await eventLogger.logStatusChange(request.id, fromStatus, toStatus);

    console.log(`[Orchestrator] Request ${request.id}: ${fromStatus} → ${toStatus}`);
  }

  /**
   * Check if we can auto-advance to the next status.
   */
  private async checkAndAdvanceStatus(request: ContentRequest): Promise<void> {
    const currentStatus = request.status as RequestStatus;

    // Check if status should auto-advance
    if (!stateMachine.shouldAutoAdvance(currentStatus)) {
      return;
    }

    const tasks = await this.getTasksForRequest(request.id);
    const canAdvance = stateMachine.canAdvanceToNext(currentStatus, tasks);

    if (canAdvance.canAdvance && canAdvance.nextStatus) {
      await this.transitionStatus(request, canAdvance.nextStatus);
      await this.processRequest(request.id);
    }
  }

  /**
   * Get all tasks for a request.
   */
  private async getTasksForRequest(requestId: string): Promise<RequestTask[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', requestId)
      .order('sequence_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch tasks: ${error.message}`);
    }

    return (data || []) as RequestTask[];
  }

  /**
   * Get orchestrator configuration.
   */
  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  /**
   * Update orchestrator configuration.
   */
  updateConfig(config: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance with default config
export const requestOrchestrator = new RequestOrchestrator();

// Export factory for custom configuration
export function createOrchestrator(config: Partial<OrchestratorConfig>): RequestOrchestrator {
  return new RequestOrchestrator(config);
}

// Export class for testing
export default RequestOrchestrator;
