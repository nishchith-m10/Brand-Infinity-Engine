/**
 * Task Timeout Monitor
 * 
 * Detects and handles tasks stuck in 'in_progress' state beyond configured timeouts.
 * Automatically marks timed-out tasks as failed and logs appropriate events.
 * 
 * Timeout Configuration:
 * - AI tasks (strategist, copywriter): 30 minutes
 * - n8n tasks (producer): 2 hours
 * - System tasks (executive, task_planner, qa): 5 minutes
 */

import { createClient } from '@/lib/supabase/server';
import { eventLogger } from './EventLogger';
import type { RequestTask } from './types';

/**
 * Timeout configuration per agent role (in milliseconds)
 */
const TIMEOUT_CONFIG = {
  executive: 5 * 60 * 1000,        // 5 minutes
  task_planner: 5 * 60 * 1000,     // 5 minutes
  strategist: 30 * 60 * 1000,      // 30 minutes
  copywriter: 30 * 60 * 1000,      // 30 minutes
  producer: 2 * 60 * 60 * 1000,    // 2 hours
  qa: 5 * 60 * 1000,               // 5 minutes
} as const;

/**
 * Default timeout for unknown agent types
 */
const DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export class TaskTimeoutMonitor {
  /**
   * Check for timed-out tasks and mark them as failed.
   * 
   * @returns Array of task IDs that were timed out
   */
  async checkTimeouts(): Promise<string[]> {
    const supabase = await createClient();
    const timedOutTaskIds: string[] = [];

    try {
      // Get all tasks currently in progress
      const { data: inProgressTasks, error } = await supabase
        .from('request_tasks')
        .select('*')
        .eq('status', 'in_progress')
        .not('started_at', 'is', null);

      if (error) {
        console.error('[TaskTimeoutMonitor] Failed to fetch in-progress tasks:', error);
        return timedOutTaskIds;
      }

      if (!inProgressTasks || inProgressTasks.length === 0) {
        return timedOutTaskIds;
      }

      const now = Date.now();

      // Check each task for timeout
      for (const task of inProgressTasks as RequestTask[]) {
        if (!task.started_at) continue;

        const startedAt = new Date(task.started_at).getTime();
        const elapsed = now - startedAt;
        const timeout = this.getTimeoutForAgent(task.assigned_to);

        if (elapsed > timeout) {
          console.warn(`[TaskTimeoutMonitor] Task ${task.id} timed out:`, {
            task_name: task.task_name,
            assigned_to: task.assigned_to,
            started_at: task.started_at,
            elapsed_ms: elapsed,
            timeout_ms: timeout,
          });

          // Mark task as failed
          await this.failTimedOutTask(task, elapsed);
          timedOutTaskIds.push(task.id);
        }
      }

      if (timedOutTaskIds.length > 0) {
        console.log(`[TaskTimeoutMonitor] Marked ${timedOutTaskIds.length} tasks as timed out`);
      }

      return timedOutTaskIds;
    } catch (error) {
      console.error('[TaskTimeoutMonitor] Error checking timeouts:', error);
      return timedOutTaskIds;
    }
  }

  /**
   * Get timeout duration for a specific agent role.
   * 
   * @param agentRole - The agent role
   * @returns Timeout in milliseconds
   */
  private getTimeoutForAgent(agentRole: string): number {
    return TIMEOUT_CONFIG[agentRole as keyof typeof TIMEOUT_CONFIG] || DEFAULT_TIMEOUT;
  }

  /**
   * Mark a timed-out task as failed.
   * 
   * @param task - The task that timed out
   * @param elapsedMs - How long the task was running
   */
  private async failTimedOutTask(task: RequestTask, elapsedMs: number): Promise<void> {
    const supabase = await createClient();

    const timeoutMinutes = Math.floor(elapsedMs / 60000);
    const errorMessage = `Task timed out after ${timeoutMinutes} minutes`;

    // Update task status
    await supabase
      .from('request_tasks')
      .update({
        status: 'failed',
        error_message: `TIMEOUT: ${errorMessage}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', task.id);

    // Log timeout event
    await eventLogger.logTaskFailed(
      task.request_id,
      task.id,
      task.task_name,
      task.assigned_to,
      'TASK_TIMEOUT',
      errorMessage,
      false // Timeouts are generally not retriable
    );

    // Log additional timeout metadata
    await eventLogger.logEvent({
      request_id: task.request_id,
      event_type: 'error',
      description: `Task timed out: ${task.task_name}`,
      metadata: {
        task_id: task.id,
        agent_role: task.assigned_to,
        started_at: task.started_at,
        elapsed_ms: elapsedMs,
        timeout_ms: this.getTimeoutForAgent(task.assigned_to),
        timeout_minutes: timeoutMinutes,
      },
      task_id: task.id,
      actor: 'system:timeout_monitor',
    });
  }

  /**
   * Get timeout configuration for display/debugging.
   * 
   * @returns Timeout config with human-readable durations
   */
  getTimeoutConfig(): Record<string, string> {
    const config: Record<string, string> = {};
    
    for (const [role, ms] of Object.entries(TIMEOUT_CONFIG)) {
      const minutes = ms / 60000;
      const hours = minutes / 60;
      
      if (hours >= 1) {
        config[role] = `${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        config[role] = `${minutes} minute${minutes > 1 ? 's' : ''}`;
      }
    }
    
    return config;
  }

  /**
   * Check if a task is approaching timeout (>80% of timeout duration).
   * 
   * @param task - The task to check
   * @returns True if task is approaching timeout
   */
  isApproachingTimeout(task: RequestTask): boolean {
    if (!task.started_at || task.status !== 'in_progress') {
      return false;
    }

    const startedAt = new Date(task.started_at).getTime();
    const elapsed = Date.now() - startedAt;
    const timeout = this.getTimeoutForAgent(task.assigned_to);

    return elapsed > (timeout * 0.8);
  }
}

/**
 * Singleton instance
 */
export const taskTimeoutMonitor = new TaskTimeoutMonitor();

/**
 * Export class for testing
 */
export default TaskTimeoutMonitor;
