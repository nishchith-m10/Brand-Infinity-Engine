    // =============================================================================
// TASK FACTORY - Phase 7
// Creates initial tasks for content requests
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { RequestType, TaskDefinition } from '@/types/pipeline';

/**
 * Create initial tasks for a new request
 */
export async function createInitialTasks(
  supabase: SupabaseClient,
  requestId: string,
  requestType: RequestType
): Promise<TaskDefinition[]> {
  
  const tasks: TaskDefinition[] = [];

  // INTAKE Phase tasks (common to all request types)
  tasks.push({
    agent_role: 'strategist',
    task_name: 'Research & Strategy',
    task_key: 'intake_strategy',
    sequence_order: 1,
    depends_on: [],
    timeout_seconds: 120,
  });

  // DRAFT Phase tasks
  if (requestType === 'video_with_vo' || requestType === 'video_no_vo') {
    tasks.push({
      agent_role: 'copywriter',
      task_name: 'Script Generation',
      task_key: 'draft_script',
      sequence_order: 2,
      depends_on: [],
      timeout_seconds: 180,
    });
  }

  // PRODUCTION Phase tasks
  if (requestType === 'video_with_vo' || requestType === 'video_no_vo') {
    tasks.push({
      agent_role: 'producer',
      task_name: 'Video Generation',
      task_key: 'production_video',
      sequence_order: 3,
      depends_on: [],
      timeout_seconds: 600,
    });

    if (requestType === 'video_with_vo') {
      tasks.push({
        agent_role: 'producer',
        task_name: 'Voiceover Generation',
        task_key: 'production_voice',
        sequence_order: 4,
        depends_on: [],
        timeout_seconds: 300,
      });
    }
  } else if (requestType === 'image') {
    tasks.push({
      agent_role: 'producer',
      task_name: 'Image Generation',
      task_key: 'production_image',
      sequence_order: 3,
      depends_on: [],
      timeout_seconds: 300,
    });
  }

  // QA Phase task (common to all)
  tasks.push({
    agent_role: 'qa',
    task_name: 'Quality Review',
    task_key: 'qa_review',
    sequence_order: 10,
    depends_on: [],
    timeout_seconds: 60,
  });

  // Insert all tasks
  const { data: insertedTasks, error } = await supabase
    .from('request_tasks')
    .insert(
      tasks.map((task) => ({
        request_id: requestId,
        agent_role: task.agent_role,
        task_name: task.task_name,
        task_key: task.task_key,
        sequence_order: task.sequence_order,
        depends_on: task.depends_on,
        status: 'pending',
        timeout_seconds: task.timeout_seconds || 300,
        input_data: task.input_data || null,
      }))
    )
    .select();

  if (error) {
    console.error('Failed to create tasks:', error);
    throw new Error('Failed to create initial tasks');
  }

  return insertedTasks || [];
}
