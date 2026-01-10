// =============================================================================
// PROGRESS TRACKER
// Calculate progress percentages and estimated completion times for requests
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import type { RequestTask, TaskStatus } from './types';

/**
 * Progress calculation result
 */
export interface ProgressInfo {
  percentage: number;                    // 0-100
  completedTasks: number;
  totalTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  failedTasks: number;
  estimatedSecondsRemaining: number | null;
  currentPhase: string;                  // 'intake', 'draft', 'production', 'qa'
  tasks: TaskProgressInfo[];
}

/**
 * Individual task progress
 */
export interface TaskProgressInfo {
  id: string;
  task_key: string;
  task_name: string;
  agent_role: string;
  status: TaskStatus;
  sequence_order: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;       // Actual duration if completed
  estimated_duration_seconds: number;    // From task template
}

/**
 * ProgressTracker calculates realtime progress for content requests.
 * 
 * Usage:
 * ```
 * const tracker = new ProgressTracker();
 * const progress = await tracker.getProgress(requestId);
 * console.log(`${progress.percentage}% complete`);
 * ```
 */
export class ProgressTracker {
  /**
   * Get current progress for a request.
   * 
   * @param requestId - Content request ID
   * @returns Progress information including percentage and task details
   */
  async getProgress(requestId: string): Promise<ProgressInfo> {
    const supabase = await createClient();

    // Fetch all tasks for this request
    const { data: tasks, error } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', requestId)
      .order('sequence_order', { ascending: true });

    if (error || !tasks || tasks.length === 0) {
      return this.emptyProgress();
    }

    // Count tasks by status
    const completedTasks = tasks.filter((t: { status: string }) => t.status === 'completed').length;
    const inProgressTasks = tasks.filter((t: { status: string }) => t.status === 'in_progress').length;
    const pendingTasks = tasks.filter((t: { status: string }) => t.status === 'pending').length;
    const failedTasks = tasks.filter((t: { status: string }) => t.status === 'failed').length;
    const totalTasks = tasks.length;

    // Calculate weighted percentage based on estimated duration
    const { percentage, estimatedSecondsRemaining } = this.calculateWeightedProgress(
      tasks as RequestTask[]
    );

    // Determine current phase based on tasks
    const currentPhase = this.determineCurrentPhase(tasks as RequestTask[]);

    // Build task progress details
    const taskProgress = tasks.map((task: RequestTask) => this.buildTaskProgress(task as RequestTask));

    return {
      percentage,
      completedTasks,
      totalTasks,
      inProgressTasks,
      pendingTasks,
      failedTasks,
      estimatedSecondsRemaining,
      currentPhase,
      tasks: taskProgress,
    };
  }

  /**
   * Calculate weighted progress based on task durations.
   * 
   * Gives more accurate progress than simple task count because
   * some tasks (e.g., video generation) take much longer than others.
   */
  private calculateWeightedProgress(tasks: RequestTask[]): {
    percentage: number;
    estimatedSecondsRemaining: number | null;
  } {
    // Get estimated duration from task metadata or use defaults
    const taskWeights = tasks.map((task) => {
      const metadata = task.input_data as Record<string, unknown> | undefined;
      const estimatedSeconds =
        typeof metadata?.estimatedDurationSeconds === 'number'
          ? metadata.estimatedDurationSeconds
          : this.getDefaultDuration(task.agent_role);

      return {
        id: task.id,
        status: task.status,
        estimatedSeconds,
        actualSeconds: this.calculateActualDuration(task),
      };
    });

    // Calculate total weight
    const totalWeight = taskWeights.reduce((sum, t) => sum + t.estimatedSeconds, 0);

    // Calculate completed weight
    const completedWeight = taskWeights
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + t.estimatedSeconds, 0);

    // Calculate in-progress weight (assume 50% complete)
    const inProgressWeight = taskWeights
      .filter((t) => t.status === 'in_progress')
      .reduce((sum, t) => sum + t.estimatedSeconds * 0.5, 0);

    // Percentage
    const percentage =
      totalWeight > 0 ? Math.round(((completedWeight + inProgressWeight) / totalWeight) * 100) : 0;

    // Estimate remaining time
    const remainingWeight = taskWeights
      .filter((t) => t.status === 'pending' || t.status === 'in_progress')
      .reduce((sum, t) => {
        if (t.status === 'in_progress') {
          return sum + t.estimatedSeconds * 0.5; // 50% remaining
        }
        return sum + t.estimatedSeconds;
      }, 0);

    const estimatedSecondsRemaining = remainingWeight > 0 ? Math.round(remainingWeight) : null;

    return { percentage, estimatedSecondsRemaining };
  }

  /**
   * Calculate actual duration for a completed or in-progress task.
   */
  private calculateActualDuration(task: RequestTask): number | null {
    if (!task.started_at) return null;

    const startTime = new Date(task.started_at).getTime();
    const endTime = task.completed_at ? new Date(task.completed_at).getTime() : Date.now();

    return Math.round((endTime - startTime) / 1000);
  }

  /**
   * Get default estimated duration for an agent role.
   */
  private getDefaultDuration(agentRole: string): number {
    const defaults: Record<string, number> = {
      executive: 5,
      task_planner: 10,
      strategist: 30,
      copywriter: 45,
      producer: 180, // 3 minutes for image/video generation
      qa: 20,
    };

    return defaults[agentRole] || 30;
  }

  /**
   * Determine current workflow phase based on task progress.
   */
  private determineCurrentPhase(tasks: RequestTask[]): string {
    const inProgressTask = tasks.find((t) => t.status === 'in_progress');
    if (inProgressTask) {
      return this.mapAgentRoleToPhase(inProgressTask.agent_role);
    }

    const lastCompletedTask = tasks
      .filter((t) => t.status === 'completed')
      .sort((a, b) => b.sequence_order - a.sequence_order)[0];

    if (lastCompletedTask) {
      return this.mapAgentRoleToPhase(lastCompletedTask.agent_role);
    }

    return 'intake';
  }

  /**
   * Map agent role to workflow phase.
   */
  private mapAgentRoleToPhase(agentRole: string): string {
    const mapping: Record<string, string> = {
      executive: 'intake',
      task_planner: 'intake',
      strategist: 'draft',
      copywriter: 'draft',
      producer: 'production',
      qa: 'qa',
    };

    return mapping[agentRole] || 'intake';
  }

  /**
   * Build progress info for a single task.
   */
  private buildTaskProgress(task: RequestTask): TaskProgressInfo {
    const metadata = task.input_data as Record<string, unknown> | undefined;
    const estimatedDurationSeconds =
      typeof metadata?.estimatedDurationSeconds === 'number'
        ? metadata.estimatedDurationSeconds
        : this.getDefaultDuration(task.agent_role);

    return {
      id: task.id,
      task_key: task.task_key,
      task_name: task.task_name,
      agent_role: task.agent_role,
      status: task.status,
      sequence_order: task.sequence_order,
      started_at: task.started_at,
      completed_at: task.completed_at,
      duration_seconds: this.calculateActualDuration(task),
      estimated_duration_seconds: estimatedDurationSeconds,
    };
  }

  /**
   * Return empty progress state.
   */
  private emptyProgress(): ProgressInfo {
    return {
      percentage: 0,
      completedTasks: 0,
      totalTasks: 0,
      inProgressTasks: 0,
      pendingTasks: 0,
      failedTasks: 0,
      estimatedSecondsRemaining: null,
      currentPhase: 'intake',
      tasks: [],
    };
  }
}

// Export singleton instance
export const progressTracker = new ProgressTracker();

// Export class for testing
export default ProgressTracker;
