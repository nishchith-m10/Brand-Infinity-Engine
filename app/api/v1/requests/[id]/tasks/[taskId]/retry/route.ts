// =============================================================================
// TASK RETRY API
// POST /api/v1/requests/[id]/tasks/[taskId]/retry
// =============================================================================
// Purpose: Manually retry failed tasks (especially strategist tasks with model errors)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { agentRunner } from '@/lib/orchestrator/AgentRunner';
import { eventLogger } from '@/lib/orchestrator/EventLogger';

/**
 * POST /api/v1/requests/[id]/tasks/[taskId]/retry
 * 
 * Retries a failed task by resetting its status and re-executing the agent.
 * 
 * Request body: None (or optional { force: true } to retry non-failed tasks)
 * 
 * Response:
 * ```
 * {
 *   "success": true,
 *   "task_id": "...",
 *   "status": "in_progress",
 *   "message": "Task retry initiated"
 * }
 * ```
 * 
 * Usage:
 * ```
 * const response = await fetch(`/api/v1/requests/${requestId}/tasks/${taskId}/retry`, {
 *   method: 'POST'
 * });
 * const result = await response.json();
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id: requestId, taskId } = await params;

  // Parse request body
  let force = false;
  try {
    const body = await request.json();
    force = body.force === true;
  } catch {
    // No body or invalid JSON - ignore
  }

  console.log(`[Task Retry API] Retry request for task ${taskId} (force: ${force})`);

  // Verify user authentication
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify request exists and user owns it
  const { data: contentRequest, error: requestError } = await supabase
    .from('content_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (requestError || !contentRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (contentRequest.user_id !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Fetch the task
  const { data: task, error: taskError } = await supabase
    .from('request_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('request_id', requestId)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Check if task is retryable
  if (task.status !== 'failed' && !force) {
    return NextResponse.json(
      {
        error: 'Task is not in failed status',
        current_status: task.status,
        hint: 'Only failed tasks can be retried. Pass { "force": true } to override.',
      },
      { status: 400 }
    );
  }

  // Check retry limit (max 3 retries by default)
  const retryCount = task.retry_count ?? 0;
  const maxRetries = task.max_retries ?? 3;
  if (retryCount >= maxRetries && !force) {
    return NextResponse.json(
      {
        error: 'Max retries exceeded',
        retry_count: retryCount,
        max_retries: maxRetries,
        hint: 'Pass { "force": true } to retry anyway.',
      },
      { status: 400 }
    );
  }

  try {
    // Reset task to pending and increment retry_count
    const { error: updateError } = await supabase
      .from('request_tasks')
      .update({
        status: 'pending',
        error_message: null,
        retry_count: retryCount + 1,
        completed_at: null, // Clear completion timestamp
      })
      .eq('id', taskId)
      .eq('request_id', requestId); // make sure we update the task for this request only

    if (updateError) {
      console.error('[Task Retry API] Failed to reset task:', updateError);
      return NextResponse.json(
        { error: 'Failed to reset task status', details: updateError.message },
        { status: 500 }
      );
    }

    // Log retry event
    await eventLogger.logEvent({
      request_id: requestId,
      task_id: taskId,
      event_type: 'task_retried',
      description: `Task retry initiated by user (attempt ${retryCount + 1}/${maxRetries})`,
      metadata: {
        previous_status: task.status,
        previous_error: task.error_message,
        force,
        actor: 'api',
      },
      actor: 'user',
    });

    // Re-execute the task via AgentRunner (async)
    (async () => {
      try {
        // Refetch task with updated status
        const { data: updatedTask } = await supabase
          .from('request_tasks')
          .select('*')
          .eq('id', taskId)
          .eq('request_id', requestId)
          .single();

        if (updatedTask) {
          await agentRunner.runTask(contentRequest as any, updatedTask as any);
        }
      } catch (err) {
        console.error('[Task Retry API] Error re-executing task:', err);
      }
    })();

    return NextResponse.json({
      success: true,
      task_id: taskId,
      status: 'pending',
      retry_count: retryCount + 1,
      max_retries: maxRetries,
      message: 'Task retry initiated. Check progress API for updates.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Task Retry API] Unexpected error:', error);

    return NextResponse.json(
      { error: 'Failed to retry task', details: message },
      { status: 500 }
    );
  }
}
