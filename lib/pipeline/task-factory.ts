    // =============================================================================
// TASK FACTORY - Phase 7
// Creates initial tasks for content requests
// =============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { RequestType, TaskDefinition } from '@/types/pipeline';

/**
 * Create initial tasks for a new request
 */
// Backwards-compatible createInitialTasks
// - If called with an options object (type + flags), returns an immediate array of tasks for tests/preview
// - If called with a Supabase client, persists to DB and returns the inserted rows (existing behavior)
export function createInitialTasks(
  supabaseOrOptions: SupabaseClient | { type: string; autoScript?: boolean; hasVoiceover?: boolean; slideCount?: number },
  requestId?: string,
  requestType?: RequestType
): any[] | Promise<any[]> {
  // If caller provided an options object (used by tests), generate tasks synchronously
  if (supabaseOrOptions && typeof supabaseOrOptions === 'object' && 'type' in (supabaseOrOptions as any)) {
    const opts = supabaseOrOptions as { type: string; autoScript?: boolean; hasVoiceover?: boolean; slideCount?: number };
    const tasks: any[] = [];
    let seq = 1;

    const pushTask = (task: { name: string; agent_role: string; depends_on?: string[] }) => {
      tasks.push({
        name: task.name,
        agent_role: task.agent_role,
        status: 'pending',
        sequence_order: seq++,
        dependencies: task.depends_on || [],
        retry_count: 0,
      });
    };

    // Video variants
    if (opts.type === 'video_with_vo' || opts.type === 'video_no_vo') {
      if (opts.autoScript) pushTask({ name: 'generate_script', agent_role: 'script_writer' });
      if (opts.type === 'video_with_vo' && opts.hasVoiceover) pushTask({ name: 'generate_voiceover', agent_role: 'voice_generator' });
      pushTask({ name: 'generate_video', agent_role: 'video_generator' });
      pushTask({ name: 'compose_final', agent_role: 'composer', depends_on: tasks.length ? [tasks[tasks.length - 1].name] : [] });
    }

    // Image
    if (opts.type === 'image') {
      pushTask({ name: 'generate_image', agent_role: 'image_generator' });
      pushTask({ name: 'compose_final', agent_role: 'composer', depends_on: [tasks[tasks.length - 1]?.name] });
    }

    // Text
    if (opts.type === 'text') {
      pushTask({ name: 'generate_text', agent_role: 'text_generator' });
    }

    // Carousel
    if (opts.type === 'carousel') {
      const slides = opts.slideCount || 5;
      for (let i = 1; i <= slides; i++) {
        pushTask({ name: `generate_carousel_slide_${i}`, agent_role: 'composer' });
      }
      pushTask({ name: 'compose_final', agent_role: 'composer' });
    }

    // QA reviewer at end for all multi-step requests
    const shouldAddQA = ['video_with_vo', 'video_no_vo', 'image', 'carousel'].includes(opts.type);
    if (shouldAddQA) {
      pushTask({ name: 'qa_review', agent_role: 'qa_reviewer', depends_on: [tasks[tasks.length - 1].name] });
    }

    // Fix up dependencies: ensure compose_final depends on earlier tasks (if not set above)
    tasks.forEach((t, idx) => {
      if (!t.dependencies) {
        t.dependencies = idx === 0 ? [] : [tasks[idx - 1].name];
      }
    });

    return tasks;
  }

  // Otherwise, assume legacy DB persistence signature: (supabase, requestId, requestType)
  const supabase = supabaseOrOptions as SupabaseClient;
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

  // Insert all tasks into DB
  return (async () => {
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
  })();
}
