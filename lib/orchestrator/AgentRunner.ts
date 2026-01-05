// =============================================================================
// AGENT RUNNER
// Executes agents and manages task lifecycle
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import {
  ContentRequest,
  RequestTask,
  AgentRole,
  AgentExecutionParams,
  AgentExecutionResult,
  TaskExecutionResult,
} from './types';
import { eventLogger } from './EventLogger';
import { createStrategistAdapter } from '../adapters/StrategistAdapter';
import { createCopywriterAdapter } from '../adapters/CopywriterAdapter';
import { createProducerAdapter } from '../adapters/ProducerAdapter';

/**
 * AgentRunner class manages task execution.
 * 
 * Responsibilities:
 * - Execute tasks through appropriate agents
 * - Manage task status transitions
 * - Collect outputs from previous tasks
 * - Update database with results
 * - Handle synchronous and asynchronous execution
 * 
 * Note: Actual agent adapters will be implemented in Sprint 8.3
 * For now, this provides the execution framework.
 */
export class AgentRunner {
  /**
   * Run an agent for a specific task.
   * 
   * @param request - The content request
   * @param task - The task to execute
   * @returns Promise resolving to execution result
   */
  async runTask(
    request: ContentRequest,
    task: RequestTask
  ): Promise<TaskExecutionResult> {
    const agentRole = task.agent_role as AgentRole;

    console.log(`[AgentRunner] Running task ${task.id} (${agentRole})`);

    // Mark task as in_progress
    await this.updateTaskStatus(task.id, 'in_progress');
    
    await eventLogger.logTaskStarted(
      request.id,
      task.id,
      task.task_name,
      agentRole
    );

    const startTime = Date.now();

    try {
      // Build execution params
      const params = await this.buildExecutionParams(request, task);

      // Execute the agent (will be implemented in Sprint 8.3)
      const result = await this.executeAgent(params);

      const durationMs = Date.now() - startTime;

      // Update task based on result
      if (result.success) {
        if (result.isAsync) {
          // Task will be completed via callback - keep in_progress
          const supabase = await createClient();
          await supabase
            .from('request_tasks')
            .update({
              output_data: result.output_data,
            })
            .eq('id', task.id);

          await eventLogger.logAgentMessage(
            request.id,
            task.id,
            agentRole,
            'Agent dispatched async task, waiting for callback',
            { provider_job_id: result.output_data?.provider_job_id }
          );

          return {
            taskId: task.id,
            success: true,
            status: 'in_progress',
          };
        } else {
          // Task completed synchronously
          await this.completeTask(task.id, result);
          
          await eventLogger.logTaskCompleted(
            request.id,
            task.id,
            task.task_name,
            agentRole,
            this.summarizeOutput(result.output_data),
            durationMs
          );

          return {
            taskId: task.id,
            success: true,
            status: 'completed',
            output_data: result.output_data,
          };
        }
      } else {
        // Task failed
        await this.failTask(task.id, result.error!);
        
        await eventLogger.logTaskFailed(
          request.id,
          task.id,
          task.task_name,
          agentRole,
          result.error!.code,
          result.error!.message,
          result.error!.retriable ?? true
        );

        return {
          taskId: task.id,
          success: false,
          status: 'failed',
          error: result.error!.message,
          retriable: result.error!.retriable,
        };
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      await this.failTask(task.id, {
        code: 'AGENT_EXCEPTION',
        message,
        retriable: true,
      });

      await eventLogger.logTaskFailed(
        request.id,
        task.id,
        task.task_name,
        agentRole,
        'AGENT_EXCEPTION',
        message,
        true
      );

      return {
        taskId: task.id,
        success: false,
        status: 'failed',
        error: message,
        retriable: true,
      };
    }
  }

  /**
   * Build execution parameters for an agent.
   * 
   * @param request - The content request
   * @param task - The task to execute
   * @returns Promise resolving to execution params
   */
  private async buildExecutionParams(
    request: ContentRequest,
    task: RequestTask
  ): Promise<AgentExecutionParams> {
    const supabase = await createClient();

    // Get completed dependencies
    const completedTasks: RequestTask[] = [];
    
    if (task.depends_on && Array.isArray(task.depends_on) && task.depends_on.length > 0) {
      const { data: dependencyTasks } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('request_id', request.id)
        .in('id', task.depends_on as string[])
        .eq('status', 'completed');

      if (dependencyTasks) {
        completedTasks.push(...dependencyTasks as RequestTask[]);
      }
    }

    return {
      request,
      task,
      completedTasks,
    };
  }

  /**
   * Execute the agent for a task.
   * 
   * Uses agent adapters to execute strategist, copywriter, and producer tasks.
   * System tasks (executive, task_planner, qa) are handled internally.
   * 
   * @param params - Execution parameters
   * @returns Promise resolving to execution result
   */
  private async executeAgent(
    params: AgentExecutionParams
  ): Promise<AgentExecutionResult> {
    const agentRole = params.task.agent_role as AgentRole;

    // Handle system tasks
    if (['executive', 'task_planner'].includes(agentRole)) {
      return this.handleSystemTask(params);
    }

    if (agentRole === 'qa') {
      return this.handleQATask(params);
    }

    // Determine tier from request metadata (budget or premium)
    const metadata = params.request.metadata as Record<string, unknown> | undefined;
    const tier = (metadata?.tier === 'premium' ? 'premium' : 'budget') as 'premium' | 'budget';

    // Execute through adapters
    try {
      let adapterResult: AgentExecutionResult;

      switch (agentRole) {
        case 'strategist': {
          const adapter = createStrategistAdapter(tier);
          adapterResult = await adapter.execute(params);
          break;
        }

        case 'copywriter': {
          const adapter = createCopywriterAdapter(tier);
          adapterResult = await adapter.execute(params);
          break;
        }

        case 'producer': {
          const adapter = createProducerAdapter();
          adapterResult = await adapter.execute(params);
          break;
        }

        default:
          return {
            success: false,
            error: {
              code: 'UNSUPPORTED_AGENT',
              message: `Agent role '${agentRole}' is not supported`,
              retriable: false,
            },
          };
      }

      // Convert adapter result to AgentExecutionResult format
      if (adapterResult.success) {
        // Check if this is an async n8n dispatch
        const output = adapterResult.output as Record<string, unknown> | undefined;
        const isAsync = agentRole === 'producer' && output?.type === 'n8n_dispatch';

        return {
          success: true,
          output_data: output || {},
          isAsync,
        };
      } else {
        return {
          success: false,
          error: {
            code: adapterResult.error?.code || 'AGENT_EXECUTION_FAILED',
            message: adapterResult.error?.message || 'Agent execution failed',
            retriable: true,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AGENT_ADAPTER_EXCEPTION',
          message: error instanceof Error ? error.message : String(error),
          retriable: true,
        },
      };
    }
  }

  /**
   * Handle system tasks (executive, task_planner) that are auto-completed.
   */
  private async handleSystemTask(
    params: AgentExecutionParams
  ): Promise<AgentExecutionResult> {
    // System tasks are validation/planning that happens in the orchestrator
    return {
      success: true,
      output_data: {
        handled_by: 'system',
        task_name: params.task.task_name,
        completed_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Handle QA task (auto-approve for now).
   */
  private async handleQATask(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: AgentExecutionParams
  ): Promise<AgentExecutionResult> {
    // For now, auto-approve QA
    // Real QA implementation will be added later
    return {
      success: true,
      output_data: {
        approved: true,
        auto_approved: true,
        approved_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Update task status.
   */
  private async updateTaskStatus(
    taskId: string,
    status: string,
    additionalData?: Partial<RequestTask>
  ): Promise<void> {
    const supabase = await createClient();

    const updates: Record<string, unknown> = {
      status,
      ...additionalData,
    };

    if (status === 'in_progress') {
      updates.started_at = new Date().toISOString();
    }

    await supabase
      .from('request_tasks')
      .update(updates)
      .eq('id', taskId);
  }

  /**
   * Mark task as completed.
   */
  private async completeTask(
    taskId: string,
    result: AgentExecutionResult
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('request_tasks')
      .update({
        status: 'completed',
        output_data: result.output_data,
        output_url: result.output_url,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);
  }

  /**
   * Mark task as failed.
   */
  private async failTask(
    taskId: string,
    error: { code: string; message: string; retriable?: boolean }
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('request_tasks')
      .update({
        status: 'failed',
        error_message: `${error.code}: ${error.message}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);
  }

  /**
   * Create a short summary of output data for logging.
   */
  private summarizeOutput(output?: Record<string, unknown>): string {
    if (!output) return 'No output';

    const keys = Object.keys(output);
    if (keys.length === 0) return 'Empty output';

    // Get first few keys and values
    const summary = keys.slice(0, 3).map(key => {
      const value = output[key];
      if (typeof value === 'string') {
        return `${key}: "${value.substring(0, 30)}${value.length > 30 ? '...' : ''}"`;
      }
      return `${key}: ${typeof value}`;
    }).join(', ');

    return keys.length > 3 ? `${summary}, ...` : summary;
  }

  /**
   * Check if an agent role is supported.
   * 
   * @param agentRole - The agent role to check
   * @returns true if supported
   */
  isAgentSupported(agentRole: AgentRole): boolean {
    // All roles are supported (some are placeholders for now)
    const supportedRoles: AgentRole[] = [
      'executive',
      'task_planner',
      'strategist',
      'copywriter',
      'producer',
      'qa',
    ];

    return supportedRoles.includes(agentRole);
  }

  /**
   * Get estimated duration for an agent role.
   * 
   * @param agentRole - The agent role
   * @returns Estimated duration in seconds
   */
  getEstimatedDuration(agentRole: AgentRole): number {
    const durations: Record<AgentRole, number> = {
      executive: 5,
      task_planner: 10,
      strategist: 30,
      copywriter: 45,
      producer: 180,
      qa: 10,
    };

    return durations[agentRole] || 60;
  }
}

// Export singleton instance
export const agentRunner = new AgentRunner();

// Export class for testing
export default AgentRunner;
