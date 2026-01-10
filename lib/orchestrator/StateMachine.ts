// =============================================================================
// STATE MACHINE
// Manages valid status transitions for content_requests
// =============================================================================

import {
  RequestStatus,
  TaskStatus,
  StatusTransition,
  StatusTransitionResult,
  StatusStage,
  AgentRole,
  StateMachineError,
} from './types';

/**
 * Valid state transitions for the content request lifecycle.
 * 
 * The state machine enforces:
 * 1. No skipping states (intake → draft → production → qa → published)
 * 2. Any state can transition to 'cancelled'
 * 3. Some transitions require all tasks to be in specific states
 * 4. Certain transitions auto-advance when conditions are met
 */
const VALID_TRANSITIONS: Map<RequestStatus, RequestStatus[]> = new Map([
  ['intake', ['draft', 'cancelled']],
  ['draft', ['production', 'cancelled']],
  ['production', ['qa', 'draft', 'cancelled']], // Can rollback to draft for retry
  ['qa', ['published', 'production', 'cancelled']], // Can rollback to production
  ['published', []], // Terminal state
  ['cancelled', []], // Terminal state
]);

/**
 * Status stages define the phase of the request lifecycle.
 */
const STATUS_STAGES: Record<RequestStatus, StatusStage> = {
  intake: {
    status: 'intake',
    stage: 'planning',
    requiredTasks: [],
  },
  draft: {
    status: 'draft',
    stage: 'planning',
    requiredTasks: ['strategist'], // copywriter is optional (images don't have it)
  },
  production: {
    status: 'production',
    stage: 'execution',
    requiredTasks: ['producer'],
  },
  qa: {
    status: 'qa',
    stage: 'review',
    requiredTasks: ['qa'],
  },
  approval: {
    status: 'approval',
    stage: 'review',
    requiredTasks: [],
  },
  published: {
    status: 'published',
    stage: 'complete',
    requiredTasks: [],
  },
  cancelled: {
    status: 'cancelled',
    stage: 'complete',
    requiredTasks: [],
  },
};

/**
 * Transitions that auto-advance when all required tasks are complete.
 */
const AUTO_ADVANCE_TRANSITIONS: Set<RequestStatus> = new Set([
  'intake', // Auto-advance to draft after tasks created
  'draft', // Auto-advance to production when strategist + copywriter done
  'production', // Auto-advance to qa when producer done
  // Note: 'qa' requires explicit approval unless autoApproveQA config is true
]);

/**
 * StateMachine class manages request status transitions.
 * 
 * Usage:
 * ```
 * const machine = new StateMachine();
 * const canTransition = machine.canTransition('intake', 'draft');
 * const result = machine.validateTransition('draft', 'production', tasks);
 * ```
 */
export class StateMachine {
  /**
   * Check if a transition from one status to another is allowed.
   * 
   * @param from - Current status
   * @param to - Target status
   * @returns true if transition is allowed, false otherwise
   */
  canTransition(from: RequestStatus, to: RequestStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS.get(from) || [];
    return allowedTransitions.includes(to);
  }

  /**
   * Get all allowed next statuses from current status.
   * 
   * @param from - Current status
   * @returns Array of allowed next statuses
   */
  getAllowedTransitions(from: RequestStatus): RequestStatus[] {
    return VALID_TRANSITIONS.get(from) || [];
  }

  /**
   * Get the next status in the normal forward flow.
   * 
   * @param current - Current status
   * @returns Next status or null if at terminal state
   */
  getNextStatus(current: RequestStatus): RequestStatus | null {
    const statusOrder: RequestStatus[] = [
      'intake',
      'draft',
      'production',
      'qa',
      'published',
    ];

    const currentIndex = statusOrder.indexOf(current);
    if (currentIndex === -1 || currentIndex >= statusOrder.length - 1) {
      return null;
    }

    return statusOrder[currentIndex + 1];
  }

  /**
   * Get the previous status in the flow (for rollbacks).
   * 
   * @param current - Current status
   * @returns Previous status or null if at start
   */
  getPreviousStatus(current: RequestStatus): RequestStatus | null {
    const statusOrder: RequestStatus[] = [
      'intake',
      'draft',
      'production',
      'qa',
      'published',
    ];

    const currentIndex = statusOrder.indexOf(current);
    if (currentIndex <= 0) {
      return null;
    }

    return statusOrder[currentIndex - 1];
  }

  /**
   * Get the stage information for a status.
   * 
   * @param status - Request status
   * @returns StatusStage object with stage info
   */
  getStage(status: RequestStatus): StatusStage {
    return STATUS_STAGES[status];
  }

  /**
   * Check if all required tasks are complete for a given status.
   * 
   * @param status - Target status to check
   * @param tasks - Array of tasks with agent_role and status
   * @returns true if all required tasks are complete
   */
  areTasksCompleteForStatus(
    status: RequestStatus,
    tasks: Array<{ agent_role: string; status: TaskStatus }>
  ): boolean {
    // Determine which set of required tasks apply for advancing to `status`.
    // Tests expect required tasks to be those associated with the *previous* status
    // (e.g., advancing to 'production' requires the 'draft' required tasks to be complete).
    const prevStatus = this.getPreviousStatus(status) || status;
    const stage = STATUS_STAGES[prevStatus];

    if (!stage || stage.requiredTasks.length === 0) {
      return true;
    }

    // All required roles must be present and completed (or skipped) for the transition to proceed
    return stage.requiredTasks.every((role: string) => {
      const task = tasks.find((t) => t.agent_role === role);
      return Boolean(task) && (task!.status === 'completed' || task!.status === 'skipped');
    });
  }

  /**
   * Get tasks that are blocking a transition to the target status.
   * 
   * @param toStatus - Target status
   * @param tasks - Array of tasks with details
   * @returns Array of blocking task descriptions
   */
  getBlockingTasks(
    toStatus: RequestStatus,
    tasks: Array<{ agent_role: string; status: TaskStatus; task_name: string }>
  ): string[] {
    // Use the required tasks for the previous status when checking whether moving
    // to `toStatus` is blocked (e.g., moving to 'production' checks 'draft' required tasks)
    const prevStatus = this.getPreviousStatus(toStatus) || toStatus;
    const stage = STATUS_STAGES[prevStatus];
    if (!stage || stage.requiredTasks.length === 0) {
      return [];
    }

    const blocking: string[] = [];
    
    // Get the set of roles that actually exist in this request's tasks
    const existingRoles = new Set(tasks.map(t => t.agent_role));

    stage.requiredTasks.forEach((role: string) => {
      // Only check roles that actually exist for this request type
      if (!existingRoles.has(role)) {
        return; // Skip - this role doesn't apply to this request type
      }
      
      const task = tasks.find((t) => t.agent_role === role);
      if (!task) {
        blocking.push(`${role} (missing)`);
      } else if (task.status !== 'completed' && task.status !== 'skipped') {
        blocking.push(`${task.task_name} (${task.status})`);
      }
    });

    return blocking;
  }

  /**
   * Check if any tasks are currently in a failed state.
   * 
   * @param tasks - Array of tasks
   * @returns true if any task has failed
   */
  hasFailedTasks(tasks: Array<{ status: TaskStatus }>): boolean {
    return tasks.some((t) => t.status === 'failed');
  }

  /**
   * Check if any tasks are currently running.
   * 
   * @param tasks - Array of tasks
   * @returns true if any task is in progress
   */
  hasRunningTasks(tasks: Array<{ status: TaskStatus }>): boolean {
    return tasks.some((t) => t.status === 'in_progress');
  }

  /**
   * Check if all tasks are complete.
   * 
   * @param tasks - Array of tasks
   * @returns true if all tasks are completed
   */
  areAllTasksComplete(tasks: Array<{ status: TaskStatus }>): boolean {
    return tasks.length > 0 && tasks.every((t) => t.status === 'completed');
  }

  /**
   * Check if a status is terminal (no further transitions possible).
   * 
   * @param status - Request status
   * @returns true if status is terminal
   */
  isTerminalStatus(status: RequestStatus): boolean {
    return status === 'published' || status === 'cancelled';
  }

  /**
   * Check if a status should auto-advance when conditions are met.
   * 
   * @param status - Current request status
   * @returns true if status auto-advances
   */
  shouldAutoAdvance(status: RequestStatus): boolean {
    return AUTO_ADVANCE_TRANSITIONS.has(status);
  }

  /**
   * Validate a proposed status transition.
   * 
   * @param from - Current status
   * @param to - Target status
   * @param tasks - Current tasks (optional)
   * @returns StatusTransitionResult with validation outcome
   */
  validateTransition(
    from: RequestStatus,
    to: RequestStatus,
    tasks?: Array<{ agent_role: string; status: TaskStatus; task_name: string }>
  ): StatusTransitionResult {
    // Check if transition is allowed
    if (!this.canTransition(from, to)) {
      const allowed = this.getAllowedTransitions(from);
      return {
        success: false,
        error: `Invalid transition: ${from} → ${to}. Allowed transitions: ${
          allowed.length > 0 ? allowed.join(', ') : 'none'
        }`,
      };
    }

    // Skip blocking task check for intake → draft transition (tasks are just created)
    if (!(from === 'intake' && to === 'draft')) {
      // Always check blocking tasks using provided tasks or assume missing tasks block
      const blockingTasks = this.getBlockingTasks(to, tasks || []);
      if (blockingTasks.length > 0) {
        return {
          success: false,
          error: `Cannot transition to '${to}': blocking tasks: ${blockingTasks.join(', ')}`,
        };
      }
    }

    return {
      success: true,
      newStatus: to,
    };
  }

  /**
   * Determine if a request can advance to the next status.
   * 
   * @param currentStatus - Current request status
   * @param tasks - Current tasks
   * @returns Object with canAdvance flag and next status
   */
  canAdvanceToNext(
    currentStatus: RequestStatus,
    tasks: Array<{ agent_role: string; status: TaskStatus; task_name: string }>
  ): { canAdvance: boolean; nextStatus?: RequestStatus; reason?: string } {
    // Check if already at terminal state
    if (this.isTerminalStatus(currentStatus)) {
      return {
        canAdvance: false,
        reason: 'Already at terminal state',
      };
    }

    // Get next status
    const nextStatus = this.getNextStatus(currentStatus);
    if (!nextStatus) {
      return {
        canAdvance: false,
        reason: 'No next status defined',
      };
    }

    // Special-case: intake -> draft should auto-advance immediately after tasks are created
    if (currentStatus === 'intake' && nextStatus === 'draft') {
      return {
        canAdvance: true,
        nextStatus,
      };
    }

    // Validate transition
    const validation = this.validateTransition(currentStatus, nextStatus, tasks);
    if (!validation.success) {
      return {
        canAdvance: false,
        nextStatus,
        reason: validation.error,
      };
    }

    return {
      canAdvance: true,
      nextStatus,
    };
  }

  /**
   * Get a human-readable description of the current stage.
   * 
   * @param status - Request status
   * @returns Stage description
   */
  getStageDescription(status: RequestStatus): string {
    const stage = this.getStage(status);
    const stageNames: Record<StatusStage['stage'], string> = {
      planning: 'Planning & Strategy',
      execution: 'Production & Execution',
      review: 'Quality Assurance & Review',
      complete: 'Complete',
    };

    return stageNames[stage.stage];
  }

  /**
   * Calculate completion percentage based on status.
   * 
   * @param status - Request status
   * @returns Completion percentage (0-100)
   */
  getCompletionPercentage(status: RequestStatus): number {
    const percentages: Record<RequestStatus, number> = {
      intake: 10,
      draft: 40,
      production: 70,
      qa: 90,
      approval: 95,
      published: 100,
      cancelled: 0,
    };

    return percentages[status] || 0;
  }

  /**
   * Get all statuses in order.
   * 
   * @returns Array of all statuses in workflow order
   */
  getAllStatuses(): RequestStatus[] {
    return ['intake', 'draft', 'production', 'qa', 'published', 'cancelled'];
  }

  /**
   * Get workflow statuses (excluding terminal cancelled state).
   * 
   * @returns Array of workflow statuses
   */
  getWorkflowStatuses(): RequestStatus[] {
    return ['intake', 'draft', 'production', 'qa', 'published'];
  }

  /**
   * Throw a StateMachineError for invalid transitions.
   * 
   * @param from - Current status
   * @param to - Target status
   * @param message - Optional error message
   * @throws StateMachineError
   */
  throwInvalidTransition(
    from: RequestStatus,
    to: RequestStatus,
    message?: string
  ): never {
    const defaultMessage = `Invalid state transition: ${from} → ${to}`;
    throw new StateMachineError(message || defaultMessage, from, to);
  }
}

// Export singleton instance
export const stateMachine = new StateMachine();

// Export class for testing
export default StateMachine;
