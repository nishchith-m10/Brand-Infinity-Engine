// =============================================================================
// REQUEST ORCHESTRATOR
// The central controller for request processing
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
import { metricsCollector } from './MetricsCollector';
import { logger } from '@/lib/monitoring/logger';

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
  private processingLocks: Map<string, boolean> = new Map();

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

    // Check if already processing this request (prevent concurrent runs)
    if (this.processingLocks.get(requestId)) {
      console.log(`[Orchestrator] Request ${requestId} is already being processed, skipping concurrent run`);
      return {
        success: true,
        requestId,
        finalStatus: 'intake' as RequestStatus,
      };
    }

    // Acquire lock
    this.processingLocks.set(requestId, true);

    try {
      let currentRequest: ContentRequest | null = null;
      let iterations = 0;
      const MAX_ITERATIONS = 10; // Prevent infinite loops

      while (iterations < MAX_ITERATIONS) {
        iterations++;
        
        // 1. Load/Reload the request
        currentRequest = await this.loadRequest(requestId);
        if (!currentRequest) {
          throw new OrchestratorError(
            `Request not found: ${requestId}`,
            'REQUEST_NOT_FOUND',
            requestId
          );
        }

        const statusBefore = currentRequest.status;

        // 2. Check if already terminal
        if (stateMachine.isTerminalStatus(statusBefore as RequestStatus)) {
          console.log(`[Orchestrator] Request ${requestId} reached terminal status: ${statusBefore}`);
          break;
        }

        // 3. Dispatch to appropriate handler based on current status
        // Handler returns true if it performed an action (like starting a task)
        await this.dispatchToHandler(currentRequest);

        // 4. Check if we should auto-advance to next status
        await this.checkAndAdvanceStatus(currentRequest);

        // 5. Reload and check if status changed
        const reloadedRequest = await this.loadRequest(requestId);
        const statusAfter = reloadedRequest?.status;

        // If status didn't change and no task was started, we're likely waiting for async or human
        // For now, we'll look at task status too
        const tasks = await this.getTasksForRequest(requestId);
        const inProgressTask = tasks.find(t => t.status === 'in_progress');
        
        if (statusBefore === statusAfter && !inProgressTask) {
          // If a task is ready but wasn't started, continue. If not, break and wait for callback.
          const nextTask = await taskFactory.getNextRunnableTask(requestId);
          if (!nextTask) {
            console.log(`[Orchestrator] No more immediate actions for request ${requestId}, waiting...`);
            break;
          }
        } else if (inProgressTask) {
            // If some task is in progress (especially if it's long-running or async),
            // current loop cycle should probably end and wait for its completion.
            console.log(`[Orchestrator] Task ${inProgressTask.task_name} in progress, finishing current run`);
            break;
        }

        console.log(`[Orchestrator] Loop iteration ${iterations} complete for ${requestId}. Status: ${statusBefore} -> ${statusAfter}`);
      }

      const finalRequest = await this.loadRequest(requestId);
      return {
        success: true,
        requestId,
        finalStatus: finalRequest?.status as RequestStatus,
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
    } finally {
      // Release lock
      this.processingLocks.delete(requestId);
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
   * Create a new content request and persist to DB
   */
  async createRequest(userId: string, organizationId: string, inputData: Record<string, any>): Promise<string> {
    const supabase = createAdminClient();

    const id = `${organizationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const payload = {
      id,
      user_id: userId,
      organization_id: organizationId,
      status: 'intake',
      request_type: inputData.request_type || inputData.requestType || 'unknown',
      input_data: inputData,
      created_at: now,
    };

    await supabase.from('content_requests').insert(payload);

    return id;
  }

  /**
   * Retry a specific failed task.
   * 
   * @param taskId - The task ID to retry
   * @returns Promise resolving when retry is initiated
   */
  async retryTask(taskId: string): Promise<void> {
    console.log(`[Orchestrator] Retrying task: ${taskId}`);
    const supabase = createAdminClient();

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
    const supabase = createAdminClient();

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
    const supabase = createAdminClient();

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
    // Use admin client for orchestration to bypass RLS and ensure we can access the request
    const supabase = createAdminClient();

    console.log(`[Orchestrator] Loading request from DB: ${requestId}`);

    const { data, error } = await supabase
      .from('content_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) {
      console.error('[Orchestrator] loadRequest error:', error);
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
    const createdTasks = await taskFactory.createTasksForRequest(request);

    console.log(`[Orchestrator] Created ${createdTasks.length} tasks for request ${request.id}`);
    
    // 2. Start the first ready task
    const started = await this.startNextReadyTask(request);
    
    if (started) {
      console.log(`[Orchestrator] First task started for request ${request.id}`);
    } else {
      console.warn(`[Orchestrator] No runnable tasks found for request ${request.id}`);
    }
  }

  /**
   * Handle DRAFT status: Run strategist and copywriter.
   * 
   * Note: Actual agent execution will be handled in Sprint 8.3
   * For now, we just check task completion and advance.
   */
  private async handleDraft(request: ContentRequest): Promise<void> {
    console.log(`[Orchestrator] Handling DRAFT for request: ${request.id}`);

    // 1. Check if all draft tasks are complete
    const tasks = await this.getTasksForRequest(request.id);

    // Log task snapshot for debugging auto-advance behavior
    console.log(`[Orchestrator] Draft tasks for ${request.id}:`, tasks.map(t => ({ id: t.id, role: t.agent_role, status: t.status })));

    const draftTasks = tasks.filter((t) => ['strategist', 'copywriter', 'task_planner'].includes(t.agent_role));
    const draftTasksComplete = draftTasks.length > 0 && draftTasks.every((t) => t.status === 'completed' || t.status === 'skipped');

    if (draftTasksComplete) {
      await this.transitionStatus(request, 'production');
      return;
    }

    // 2. If not complete, try to start the next task
    // Check if any draft task is already in progress
    const inProgressTask = tasks.find(t => t.status === 'in_progress');
    if (!inProgressTask) {
      await this.startNextReadyTask(request);
    } else {
      console.log(`[Orchestrator] Draft task ${inProgressTask.task_name} already in progress`);
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
    } else if (producerTask.status === 'pending') {
      // Start the producer task
      await this.startNextReadyTask(request);
    }
  }

  /**
   * Handle QA status: Run QA agent to review the produced content.
   */
  private async handleQA(request: ContentRequest): Promise<void> {
    console.log(`[Orchestrator] Handling QA for request: ${request.id}`);

    // Get the QA task
    const tasks = await this.getTasksForRequest(request.id);
    const qaTask = tasks.find((t) => t.agent_role === 'qa');

    if (!qaTask) {
      // No QA task exists - auto-publish (legacy behavior)
      console.log(`[Orchestrator] No QA task found, auto-publishing request: ${request.id}`);
      await this.transitionStatus(request, 'published');
      return;
    }

    if (qaTask.status === 'in_progress') {
      // Still waiting for QA to complete
      console.log(`[Orchestrator] QA task in progress, waiting for completion`);
      return;
    } else if (qaTask.status === 'completed') {
      // QA done - advance to published
      await this.transitionStatus(request, 'published');
    } else if (qaTask.status === 'pending') {
      // Start the QA task
      await this.startNextReadyTask(request);
    } else if (qaTask.status === 'skipped') {
      // QA was skipped (e.g., auto-approve enabled) - advance to published
      await this.transitionStatus(request, 'published');
    }
  }

  /**
   * Transition request to a new status.
   */
  private async transitionStatus(
    request: ContentRequest,
    toStatus: RequestStatus
  ): Promise<void> {
    const supabase = createAdminClient();
    const fromStatus = request.status as RequestStatus;

    // Validate transition
    const tasks = await this.getTasksForRequest(request.id);
    const validation = stateMachine.validateTransition(fromStatus, toStatus, tasks);

    if (!validation.success) {
      // Emit monitoring metric and log invalid transition attempt for observability and audit trail
      try {
        metricsCollector.incrementInvalidTransition();
      } catch (e) {
        console.warn('[Orchestrator] Failed to increment invalid transition metric', e);
      }

      logger.warn('Orchestrator', `Invalid transition attempted: ${fromStatus} → ${toStatus}`, { reason: validation.error });

      await eventLogger.logEvent({
        request_id: request.id,
        event_type: 'system_action',
        description: `Invalid transition attempted: ${fromStatus} → ${toStatus}`,
        metadata: {
          reason: validation.error,
          blocking: validation.error,
        },
        actor: 'system:orchestrator',
      });

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
    } else {
      // Log blocked auto-advance for troubleshooting
      await eventLogger.logEvent({
        request_id: request.id,
        event_type: 'system_action',
        description: `Auto-advance blocked: ${canAdvance.reason}`,
        metadata: {
          reason: canAdvance.reason,
        },
        actor: 'system:orchestrator',
      });
    }
  }

  /**
   * Get all tasks for a request.
   */
  private async getTasksForRequest(requestId: string): Promise<RequestTask[]> {
    // Use admin client for orchestration so we bypass RLS and always see tasks
    const supabase = createAdminClient();

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
   * Helper to start the next available task for a request.
   */
  private async startNextReadyTask(request: ContentRequest): Promise<boolean> {
    const nextTask = await taskFactory.getNextRunnableTask(request.id);
    
    if (nextTask) {
      console.log(`[Orchestrator] Starting next task: ${nextTask.task_name} (${nextTask.agent_role})`);
      
      // Import AgentRunner dynamically to avoid circular deps
      const { agentRunner } = await import('./AgentRunner');
      
      // Run the task (this will mark it in_progress and execute the agent)
      await agentRunner.runTask(request, nextTask);
      return true;
    }
    
    return false;
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
