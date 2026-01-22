// =============================================================================
// POST /api/v1/requests/:id/retry - Retry Failed Tasks
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RetryRequestResponse } from '@/types/pipeline';

export async function POST(request: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Normalize params (support both Promise and plain object)
    const params = await (context.params as any) as { id: string };
    const requestId = params.id;

    // Verify request exists
    const { data: contentRequest, error: fetchError } = await supabase
      .from('content_requests')
      .select('id, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !contentRequest) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    // Don't retry cancelled requests
    if (contentRequest.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Cannot retry cancelled requests' },
        { status: 400 }
      );
    }

    // Find failed tasks that haven't exceeded max retries
    const { data: failedTasks, error: tasksError } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', requestId)
      .eq('status', 'failed');

    if (tasksError) {
      console.error('Failed to fetch tasks:', tasksError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }

    if (!failedTasks?.length) {
      return NextResponse.json(
        { success: false, error: 'No failed tasks found' },
        { status: 400 }
      );
    }

    // Filter tasks that can be retried
    const retriableTasks = failedTasks.filter((t) => t.retry_count < t.max_retries);

    if (!retriableTasks.length) {
      return NextResponse.json(
        { success: false, error: 'No retryable tasks found (all exceeded max retries)' },
        { status: 400 }
      );
    }

    // Reset failed tasks to pending and increment retry count
    const taskIds = retriableTasks.map((t) => t.id);

    for (const task of retriableTasks) {
      await supabase
        .from('request_tasks')
        .update({
          status: 'pending',
          error_message: null,
          error_code: null,
          started_at: null,
          completed_at: null,
          retry_count: task.retry_count + 1,
        })
        .eq('id', task.id);
    }

    // Log retry event
    await supabase.from('request_events').insert({
      request_id: requestId,
      event_type: 'retry_initiated',
      description: `Retry initiated for ${retriableTasks.length} failed task(s)`,
      metadata: { task_ids: taskIds, task_names: retriableTasks.map((t) => t.task_name) },
      actor: `user:${user.id}`,
    });

    const response: RetryRequestResponse = {
      success: true,
      message: `Retrying ${retriableTasks.length} task(s)`,
      retried_tasks: taskIds,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in POST /api/v1/requests/:id/retry:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
