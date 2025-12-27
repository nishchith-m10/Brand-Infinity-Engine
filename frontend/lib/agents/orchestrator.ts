/**
 * Agent Orchestrator - Coordinate all agents
 * Slice 6: Task Planning & Delegation
 */

import type { ParsedIntent, TaskPlan, Task } from './types';
import { createTaskPlanner } from './task-planner';
import { createStrategistAgent } from './managers/strategist';
import { createCopywriterAgent } from './managers/copywriter';
import { createProducerAgent } from './managers/producer';
import { createVerifierAgent } from './verifier';

export class AgentOrchestrator {
  private taskPlanner = createTaskPlanner('premium');
  private strategist = createStrategistAgent('budget');
  private copywriter = createCopywriterAgent('budget');
  private producer = createProducerAgent('budget');
  private verifier = createVerifierAgent('budget');

  /**
   * Execute entire task plan
   */
  async executePlan(params: {
    plan: TaskPlan;
    intent: ParsedIntent;
    brandContext?: string;
  }): Promise<{ success: boolean; results: any[]; errors: string[] }> {
    const results: any[] = [];
    const errors: string[] = [];

    // Execute tasks in dependency order
    while (true) {
      const nextTasks = this.taskPlanner.getNextTasks(params.plan);
      
      if (nextTasks.length === 0) {
        // Check if all tasks are complete
        const allComplete = params.plan.tasks.every(t => 
          t.status === 'completed' || t.status === 'failed'
        );
        
        if (allComplete) break;
        
        // No tasks ready but not all complete = dependency deadlock
        errors.push('Dependency deadlock detected');
        break;
      }

      // Execute next batch of tasks
      const taskResults = await Promise.all(
        nextTasks.map(task => this.executeTask(task, params.intent, params.brandContext, results))
      );

      // Update plan with results
      for (let i = 0; i < nextTasks.length; i++) {
        const task = nextTasks[i];
        const result = taskResults[i];

        if (result.success) {
          params.plan = this.taskPlanner.updateTaskStatus(
            params.plan,
            task.id,
            'completed',
            result.result
          );
          results.push(result.result);
        } else {
          params.plan = this.taskPlanner.updateTaskStatus(
            params.plan,
            task.id,
            'failed'
          );
          errors.push(`Task ${task.id} failed: ${result.error}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
    };
  }

  /**
   * Execute single task with appropriate agent
   */
  private async executeTask(
    task: Task,
    intent: ParsedIntent,
    brandContext?: string,
    previousResults?: any[]
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // Update task status to running
      task.status = 'running';

      // Route to appropriate agent
      switch (task.manager) {
        case 'strategist':
          return await this.strategist.executeTask({
            task,
            intent,
            brandContext,
          });

        case 'copywriter': {
          // Pass strategic brief if available
          const strategicBrief = previousResults?.find(r => r.type === 'strategic_brief')?.content;
          return await this.copywriter.executeTask({
            task,
            intent,
            strategicBrief,
            brandContext,
          });
        }

        case 'producer': {
          return await this.producer.executeTask({
            task,
            intent,
            previousResults,
            brandContext,
          });
        }

        default:
          return {
            success: false,
            error: `Unknown agent: ${task.manager}`,
          };
      }
    } catch (error) {
      console.error('[Orchestrator] Task execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get task execution progress
   */
  getProgress(plan: TaskPlan): {
    percentage: number;
    completed: number;
    total: number;
    current: string[];
  } {
    const completed = plan.tasks.filter(t => t.status === 'completed').length;
    const total = plan.tasks.length;
    const current = plan.tasks
      .filter(t => t.status === 'running')
      .map(t => t.name);

    return {
      percentage: Math.round((completed / total) * 100),
      completed,
      total,
      current,
    };
  }

  /**
   * Estimate remaining time
   */
  estimateRemainingTime(plan: TaskPlan): number {
    const remainingTasks = plan.tasks.filter(
      t => t.status === 'pending' || t.status === 'running'
    );

    return remainingTasks.reduce((sum, task) => sum + (task.estimated_duration || 0), 0);
  }
}

/**
 * Create orchestrator instance
 */
export function createOrchestrator(): AgentOrchestrator {
  return new AgentOrchestrator();
}

