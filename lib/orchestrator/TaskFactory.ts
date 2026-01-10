// =============================================================================
// TASK FACTORY
// Creates request_tasks based on request type and manages task dependencies
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  RequestType,
  AgentRole,
  TaskTemplate,
  TaskTemplateMap,
  RequestTaskInsert,
  ContentRequest,
  RequestTask,
  TaskStatus,
} from './types';

/**
 * Task templates define what tasks are created for each request type.
 * 
 * Each task has:
 * - agent_role: Which agent handles this task
 * - name: Human-readable task name
 * - sequence_order: Execution order (lower = earlier)
 * - dependencies: Agent roles that must complete first
 * - estimatedDurationSeconds: For progress estimation
 * - retryable: Whether this task can be retried on failure
 */
const TASK_TEMPLATES: TaskTemplateMap = {
  video_with_vo: [
    {
      name: 'Intent Parsing & Validation',
      agent_role: 'executive',
      description: 'Parse user intent and validate request parameters',
      sequence_order: 1,
      dependencies: [],
      estimatedDurationSeconds: 5,
      retryable: true,
    },
    {
      name: 'Task Planning',
      agent_role: 'task_planner',
      description: 'Create detailed execution plan with scene breakdown',
      sequence_order: 2,
      dependencies: ['executive'],
      estimatedDurationSeconds: 10,
      retryable: true,
    },
    {
      name: 'Creative Strategy Generation',
      agent_role: 'strategist',
      description: 'Develop creative strategy and visual direction',
      sequence_order: 3,
      dependencies: ['task_planner'],
      estimatedDurationSeconds: 30,
      retryable: true,
    },
    {
      name: 'Script Writing',
      agent_role: 'copywriter',
      description: 'Generate or validate video script with voiceover',
      sequence_order: 4,
      dependencies: ['strategist'],
      estimatedDurationSeconds: 45,
      retryable: true,
    },
    {
      name: 'Video Generation',
      agent_role: 'producer',
      description: 'Dispatch video generation to provider (async)',
      sequence_order: 5,
      dependencies: ['copywriter'],
      estimatedDurationSeconds: 180, // 3 minutes average
      retryable: true,
    },
    {
      name: 'Quality Assurance Review',
      agent_role: 'qa',
      description: 'Review output quality and brand compliance',
      sequence_order: 6,
      dependencies: ['producer'],
      estimatedDurationSeconds: 10,
      retryable: false,
    },
  ],

  video_no_vo: [
    {
      name: 'Intent Parsing & Validation',
      agent_role: 'executive',
      description: 'Parse user intent and validate request parameters',
      sequence_order: 1,
      dependencies: [],
      estimatedDurationSeconds: 5,
      retryable: true,
    },
    {
      name: 'Task Planning',
      agent_role: 'task_planner',
      description: 'Create detailed execution plan with scene breakdown',
      sequence_order: 2,
      dependencies: ['executive'],
      estimatedDurationSeconds: 10,
      retryable: true,
    },
    {
      name: 'Visual Strategy Generation',
      agent_role: 'strategist',
      description: 'Develop visual strategy without voiceover',
      sequence_order: 3,
      dependencies: ['task_planner'],
      estimatedDurationSeconds: 25,
      retryable: true,
    },
    // Note: No copywriter for video_no_vo - goes straight to producer
    {
      name: 'Video Generation',
      agent_role: 'producer',
      description: 'Dispatch video generation to provider (async)',
      sequence_order: 4,
      dependencies: ['strategist'],
      estimatedDurationSeconds: 180,
      retryable: true,
    },
    {
      name: 'Quality Assurance Review',
      agent_role: 'qa',
      description: 'Review output quality and brand compliance',
      sequence_order: 5,
      dependencies: ['producer'],
      estimatedDurationSeconds: 10,
      retryable: false,
    },
  ],

  image: [
    {
      name: 'Intent Parsing & Validation',
      agent_role: 'executive',
      description: 'Parse user intent and validate request parameters',
      sequence_order: 1,
      dependencies: [],
      estimatedDurationSeconds: 5,
      retryable: true,
    },
    {
      name: 'Visual Concept Generation',
      agent_role: 'strategist',
      description: 'Develop visual concept and composition strategy',
      sequence_order: 2,
      dependencies: ['executive'],
      estimatedDurationSeconds: 20,
      retryable: true,
    },
    {
      name: 'Image Generation',
      agent_role: 'producer',
      description: 'Dispatch image generation to provider (async)',
      sequence_order: 3,
      dependencies: ['strategist'],
      estimatedDurationSeconds: 30, // Images are faster than videos
      retryable: true,
    },
    {
      name: 'Quality Assurance Review',
      agent_role: 'qa',
      description: 'Review output quality and brand compliance',
      sequence_order: 4,
      dependencies: ['producer'],
      estimatedDurationSeconds: 5,
      retryable: false,
    },
  ],
};

/**
 * TaskFactory class manages task creation and lifecycle queries.
 * 
 * Responsibilities:
 * - Create tasks from templates based on request type
 * - Build input_data for each task
 * - Manage task dependencies
 * - Query task status and readiness
 * - Calculate estimates
 */
export class TaskFactory {
  /**
   * Get the task templates for a given request type.
   * 
   * @param requestType - The content request type
   * @returns Array of task templates
   * @throws Error if request type is unknown
   */
  getTemplatesForRequestType(requestType: RequestType): TaskTemplate[] {
    const templates = TASK_TEMPLATES[requestType];
    if (!templates) {
      throw new Error(`Unknown request type: ${requestType}`);
    }
    return templates;
  }

  /**
   * Create all tasks for a request and insert them into the database.
   * 
   * Steps:
   * 1. Get templates for request type
   * 2. Build task records with input_data
   * 3. Insert all tasks
   * 4. Update depends_on with actual task IDs
   * 5. Return created tasks
   * 
   * @param request - The content request
   * @returns Promise resolving to created task records
   */
  async createTasksForRequest(request: ContentRequest): Promise<RequestTask[]> {
    const supabase = createAdminClient();

    // If tasks already exist for this request, return them (idempotent)
    const { data: existingTasks } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', request.id)
      .order('sequence_order', { ascending: true });

    if (existingTasks && existingTasks.length > 0) {
      // Tasks already created (possibly due to concurrent orchestrator runs) - return them
      return existingTasks as RequestTask[];
    }

    const templates = this.getTemplatesForRequestType(request.request_type as RequestType);

    // Build the task records
    const taskRecords: RequestTaskInsert[] = templates.map((template) => ({
      request_id: request.id,
      agent_role: template.agent_role,
      task_name: template.name,
      task_key: template.name.toLowerCase().replace(/\s+/g, '_'),
      status: 'pending',
      sequence_order: template.sequence_order,
      depends_on: [], // Will be updated after insert
      input_data: this.buildInitialInputData(request, template),
      retry_count: 0,
      created_at: new Date().toISOString(),
    }));

    // Insert all tasks with retry/refetch on duplicate key error (race condition)
    let insertedTasks: RequestTask[] | null = null;
    let insertError: Error | null = null;
    
    try {
      const { data, error } = await supabase
        .from('request_tasks')
        .insert(taskRecords)
        .select();

      if (error) {
        insertError = error as unknown as Error;
      } else {
        insertedTasks = data as RequestTask[];
      }
    } catch (err) {
      insertError = err as Error;
    }

    // Handle duplicate key constraint violation (23505)
    if (insertError) {
      const errorCode = (insertError as any)?.code;
      const errorMessage = (insertError as any)?.message || String(insertError);

      // PostgreSQL unique_violation error code
      if (errorCode === '23505' || errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
        console.log(`[TaskFactory] Duplicate key detected for request ${request.id}, refetching existing tasks`);
        
        // Another process created tasks concurrently - refetch them
        const { data: refetchedTasks, error: refetchError } = await supabase
          .from('request_tasks')
          .select('*')
          .eq('request_id', request.id)
          .order('sequence_order', { ascending: true });

        if (refetchError || !refetchedTasks || refetchedTasks.length === 0) {
          throw new Error(`Failed to refetch tasks after duplicate key error: ${refetchError?.message}`);
        }

        return refetchedTasks as RequestTask[];
      }

      // Other error - throw
      throw new Error(`Failed to create tasks: ${errorMessage}`);
    }

    if (!insertedTasks || insertedTasks.length === 0) {
      throw new Error('Failed to create tasks: No tasks returned from insert');
    }

    // Build task ID lookup by agent role
    const taskIdsByRole: Record<string, string> = {};
    for (const task of insertedTasks) {
      taskIdsByRole[task.agent_role] = task.id;
    }

    // Update each task's depends_on field with actual task IDs
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const task = insertedTasks[i];

      if (template.dependencies && template.dependencies.length > 0) {
        const dependsOnIds = template.dependencies
          .map((role: string) => taskIdsByRole[role])
          .filter(Boolean);

        const { error: updateError } = await supabase
          .from('request_tasks')
          .update({ depends_on: dependsOnIds })
          .eq('id', task.id);

        if (updateError) {
          console.error(`Failed to update depends_on for task ${task.id}:`, updateError);
        }
      }
    }

    // Refetch tasks with updated depends_on
    const { data: finalTasks, error: fetchError } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', request.id)
      .order('sequence_order', { ascending: true });

    if (fetchError || !finalTasks) {
      throw new Error(`Failed to fetch created tasks: ${fetchError?.message}`);
    }

    return finalTasks as RequestTask[];
  }

  /**
   * Build initial input data for a task based on request data.
   * 
   * @param request - The content request
   * @param template - The task template
   * @returns Input data object for the task
   */
  private buildInitialInputData(
    request: ContentRequest,
    template: TaskTemplate
  ): Record<string, unknown> {
    const baseInput = {
      request_id: request.id,
      request_type: request.request_type,
      brand_id: request.brand_id,
      campaign_id: request.campaign_id,
      prompt: request.prompt,
      selected_kb_ids: request.selected_kb_ids,
    };

    // Add role-specific input data
    switch (template.agent_role) {
      case 'executive':
        return {
          ...baseInput,
          duration_seconds: request.duration_seconds,
          aspect_ratio: request.aspect_ratio,
          style_preset: request.style_preset,
        };

      case 'task_planner':
        return {
          ...baseInput,
          duration_seconds: request.duration_seconds,
          aspect_ratio: request.aspect_ratio,
        };

      case 'strategist':
        return {
          ...baseInput,
          duration_seconds: request.duration_seconds,
          style_preset: request.style_preset,
          aspect_ratio: request.aspect_ratio,
        };

      case 'copywriter':
        return {
          ...baseInput,
          duration_seconds: request.duration_seconds,
          voice_id: request.voice_id,
          auto_script: request.auto_script,
          script_text: request.script_text,
        };

      case 'producer':
        return {
          ...baseInput,
          duration_seconds: request.duration_seconds,
          aspect_ratio: request.aspect_ratio,
          shot_type: request.shot_type,
          preferred_provider: request.preferred_provider,
          provider_tier: request.provider_tier,
        };

      case 'qa':
        return {
          ...baseInput,
          output_url: null, // Will be filled by producer
        };

      default:
        return baseInput;
    }
  }

  /**
   * Get the next task that is ready to execute (all dependencies complete).
   * 
   * @param requestId - The request ID
   * @returns Promise resolving to the next runnable task or null
   */
  async getNextRunnableTask(requestId: string): Promise<RequestTask | null> {
    const supabase = createAdminClient();

    // Get all tasks for this request
    const { data: tasks, error } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', requestId)
      .order('sequence_order', { ascending: true });

    if (error || !tasks) {
      throw new Error(`Failed to fetch tasks: ${error?.message}`);
    }

    // Find the first pending task whose dependencies are all complete
    for (const task of tasks) {
      if (task.status !== 'pending') {
        continue;
      }

      const dependsOn = (task.depends_on as string[]) || [];
      
      // If no dependencies, task is ready
      if (dependsOn.length === 0) {
        return task as RequestTask;
      }

      // Check if all dependencies are complete
      const allDepsComplete = dependsOn.every((depId) => {
        const depTask = tasks.find((t: RequestTask) => t.id === depId);
        return depTask && depTask.status === 'completed';
      });

      if (allDepsComplete) {
        return task as RequestTask;
      }
    }

    return null;
  }

  /**
   * Check if all tasks for a request are complete.
   * 
   * @param requestId - The request ID
   * @returns Promise resolving to true if all tasks complete
   */
  async areAllTasksComplete(requestId: string): Promise<boolean> {
    const supabase = createAdminClient();

    const { data: tasks, error } = await supabase
      .from('request_tasks')
      .select('status')
      .eq('request_id', requestId);

    if (error || !tasks) {
      throw new Error(`Failed to fetch tasks: ${error?.message}`);
    }

    return (tasks as unknown as RequestTask[]).every((t: RequestTask) => t.status === 'completed' || t.status === 'skipped');
  }

  /**
   * Check if any tasks for a request have failed.
   * 
   * @param requestId - The request ID
   * @returns Promise resolving to true if any task failed
   */
  async hasFailedTasks(requestId: string): Promise<boolean> {
    const supabase = createAdminClient();

    const { data: tasks, error } = await supabase
      .from('request_tasks')
      .select('status')
      .eq('request_id', requestId)
      .eq('status', 'failed');

    if (error) {
      throw new Error(`Failed to fetch tasks: ${error?.message}`);
    }

    return (tasks?.length || 0) > 0;
  }

  /**
   * Get tasks grouped by status for a request.
   * 
   * @param requestId - The request ID
   * @returns Promise resolving to status summary
   */
  async getTaskStatusSummary(requestId: string): Promise<Record<TaskStatus, number>> {
    const supabase = createAdminClient();

    const { data: tasks, error } = await supabase
      .from('request_tasks')
      .select('status')
      .eq('request_id', requestId);

    if (error || !tasks) {
      throw new Error(`Failed to fetch tasks: ${error?.message}`);
    }

    const summary: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    };

    for (const task of tasks) {
      summary[task.status] = (summary[task.status] || 0) + 1;
    }

    return summary as Record<TaskStatus, number>;
  }

  /**
   * Get all tasks for a request with full details.
   * 
   * @param requestId - The request ID
   * @returns Promise resolving to array of tasks
   */
  async getTasksForRequest(requestId: string): Promise<RequestTask[]> {
    const supabase = createAdminClient();

    const { data: tasks, error } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', requestId)
      .order('sequence_order', { ascending: true });

    if (error || !tasks) {
      throw new Error(`Failed to fetch tasks: ${error?.message}`);
    }

    return tasks as RequestTask[];
  }

  /**
   * Calculate total estimated time for a request type.
   * 
   * @param requestType - The request type
   * @returns Total estimated duration in seconds
   */
  getEstimatedTotalDuration(requestType: RequestType): number {
    const templates = TASK_TEMPLATES[requestType];
    if (!templates) return 0;

    return templates.reduce((sum: number, t: any) => sum + t.estimatedDurationSeconds, 0);
  }

  /**
   * Get estimated duration for a specific task by agent role.
   * 
   * @param requestType - The request type
   * @param agentRole - The agent role
   * @returns Estimated duration in seconds or 0 if not found
   */
  getEstimatedDurationForTask(requestType: RequestType, agentRole: AgentRole): number {
    const templates = TASK_TEMPLATES[requestType];
    if (!templates) return 0;

    const template = templates.find((t: any) => t.agent_role === agentRole);
    return template?.estimatedDurationSeconds || 0;
  }

  /**
   * Calculate completion percentage for a request based on tasks.
   * 
   * @param requestId - The request ID
   * @returns Promise resolving to completion percentage (0-100)
   */
  async getCompletionPercentage(requestId: string): Promise<number> {
    const summary = await this.getTaskStatusSummary(requestId);
    const total = Object.values(summary).reduce((sum, count) => sum + count, 0);
    
    if (total === 0) return 0;

    const completed = summary.completed + summary.skipped;
    return Math.round((completed / total) * 100);
  }

  /**
   * Get the current task (in_progress) for a request.
   * 
   * @param requestId - The request ID
   * @returns Promise resolving to current task or null
   */
  async getCurrentTask(requestId: string): Promise<RequestTask | null> {
    const supabase = createAdminClient();

    const { data: tasks, error } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', requestId)
      .eq('status', 'in_progress')
      .order('sequence_order', { ascending: true })
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch current task: ${error?.message}`);
    }

    return tasks && tasks.length > 0 ? (tasks[0] as RequestTask) : null;
  }
}

// Export singleton instance
export const taskFactory = new TaskFactory();

// Export class for testing
export default TaskFactory;
