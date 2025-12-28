/**
 * Agent Orchestrator - Coordinate all agents
 * Slice 6: Task Planning & Delegation
 * V1 Update: Added Supabase persistence for task plans
 */

import type { ParsedIntent, TaskPlan, Task } from './types';
import { createTaskPlanner } from './task-planner';
import { createStrategistAgent } from './managers/strategist';
import { createCopywriterAgent } from './managers/copywriter';
import { createProducerAgent } from './managers/producer';
import { createVerifierAgent } from './verifier';
import { createClient } from '@/lib/supabase/client';

// Supabase task plan record type
interface TaskPlanRecord {
  id: string;
  user_id: string;
  campaign_id?: string;
  conversation_id?: string;
  intent_type: string;
  intent_raw?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  plan_data: TaskPlan;
  context_data: Record<string, unknown>;
  total_tasks: number;
  completed_tasks: number;
  current_task_id?: string;
  progress_percentage: number;
  results: unknown[];
  errors: string[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
}

export class AgentOrchestrator {
  private taskPlanner = createTaskPlanner('premium');
  private strategist = createStrategistAgent('budget');
  private copywriter = createCopywriterAgent('budget');
  private producer = createProducerAgent('budget');
  private verifier = createVerifierAgent('budget');
  private supabase = createClient();

  // Current persisted plan ID
  private currentPlanId: string | null = null;

  /**
   * Save task plan to Supabase
   */
  private async persistPlan(params: {
    plan: TaskPlan;
    intent: ParsedIntent;
    results: unknown[];
    errors: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    brandContext?: string;
    campaignId?: string;
    conversationId?: string;
  }): Promise<void> {
    const { data: user } = await this.supabase.auth.getUser();
    if (!user?.user?.id) {
      console.warn('[Orchestrator] No authenticated user, skipping persistence');
      return;
    }

    const completedTasks = params.plan.tasks.filter(t => t.status === 'completed').length;
    const totalTasks = params.plan.tasks.length;
    const currentTask = params.plan.tasks.find(t => t.status === 'running');

    const record = {
      user_id: user.user.id,
      campaign_id: params.campaignId || null,
      conversation_id: params.conversationId || null,
      intent_type: params.intent.content_type || 'unknown',
      intent_raw: params.intent.raw_message || null,
      status: params.status,
      plan_data: params.plan,
      context_data: { brandContext: params.brandContext },
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      current_task_id: currentTask?.id || null,
      progress_percentage: Math.round((completedTasks / totalTasks) * 100),
      results: params.results,
      errors: params.errors,
      started_at: params.status === 'running' ? new Date().toISOString() : undefined,
      completed_at: ['completed', 'failed'].includes(params.status) ? new Date().toISOString() : undefined,
    };

    try {
      if (this.currentPlanId) {
        // Update existing plan
        await this.supabase
          .from('task_plans')
          .update(record)
          .eq('id', this.currentPlanId);
      } else {
        // Insert new plan
        const { data, error } = await this.supabase
          .from('task_plans')
          .insert(record)
          .select('id')
          .single();

        if (error) throw error;
        this.currentPlanId = data.id;
      }
    } catch (error) {
      console.error('[Orchestrator] Failed to persist plan:', error);
    }
  }

  /**
   * Resume an in-progress task plan
   */
  async resumePlan(planId: string): Promise<{
    plan: TaskPlan;
    intent: ParsedIntent;
    brandContext?: string;
    results: unknown[];
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from('task_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error || !data) return null;

      this.currentPlanId = planId;
      
      return {
        plan: data.plan_data as TaskPlan,
        intent: {
          primaryIntent: data.intent_type,
          rawInput: data.intent_raw,
        } as ParsedIntent,
        brandContext: data.context_data?.brandContext,
        results: data.results || [],
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to resume plan:', error);
      return null;
    }
  }

  /**
   * Get all in-progress plans for the current user
   */
  async getInProgressPlans(): Promise<TaskPlanRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('task_plans')
        .select('*')
        .in('status', ['pending', 'running'])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Orchestrator] Failed to get in-progress plans:', error);
      return [];
    }
  }

  /**
   * Execute entire task plan with persistence
   */
  async executePlan(params: {
    plan: TaskPlan;
    intent: ParsedIntent;
    brandContext?: string;
    campaignId?: string;
    conversationId?: string;
  }): Promise<{ success: boolean; results: unknown[]; errors: string[]; planId?: string }> {
    const results: unknown[] = [];
    const errors: string[] = [];

    // Persist initial plan state
    await this.persistPlan({
      plan: params.plan,
      intent: params.intent,
      results,
      errors,
      status: 'running',
      brandContext: params.brandContext,
      campaignId: params.campaignId,
      conversationId: params.conversationId,
    });

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

      // Persist after each batch (enables resume on failure)
      await this.persistPlan({
        plan: params.plan,
        intent: params.intent,
        results,
        errors,
        status: 'running',
        brandContext: params.brandContext,
        campaignId: params.campaignId,
        conversationId: params.conversationId,
      });
    }

    // Persist final state
    const finalStatus = errors.length === 0 ? 'completed' : 'failed';
    await this.persistPlan({
      plan: params.plan,
      intent: params.intent,
      results,
      errors,
      status: finalStatus,
      brandContext: params.brandContext,
      campaignId: params.campaignId,
      conversationId: params.conversationId,
    });

    return {
      success: errors.length === 0,
      results,
      errors,
      planId: this.currentPlanId || undefined,
    };
  }

  /**
   * Execute single task with appropriate agent
   */
  private async executeTask(
    task: Task,
    intent: ParsedIntent,
    brandContext?: string,
    previousResults?: unknown[]
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
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

          return await this.copywriter.executeTask({
            task,
            intent,
            strategicBrief: (previousResults?.find(r => (r as { type?: string })?.type === 'strategic_brief') as { content?: string } | undefined)?.content,
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

