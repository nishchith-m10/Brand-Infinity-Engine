// =============================================================================
// GET /api/v1/requests/:id - Get Request Detail
// PATCH /api/v1/requests/:id - Update Request
// DELETE /api/v1/requests/:id - Delete Request
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { taskFactory } from '@/lib/orchestrator/TaskFactory';
import {
  ContentRequestWithRelations,
  GetRequestResponse,
  UpdateRequestResponse,
  DeleteRequestResponse,
} from '@/types/pipeline';

export async function GET(request: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await (context.params as any) as { id: string };
    const requestId = params.id;

    // Fetch request with related data
    const { data: contentRequest, error: requestError } = await supabase
      .from('content_requests')
      .select(
        `
        *,
        tasks:request_tasks(*),
        events:request_events(*)
      `
      )
      .eq('id', requestId)
      .single();

    if (requestError || !contentRequest) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    // Sort tasks by sequence_order
    contentRequest.tasks =
      contentRequest.tasks?.sort((a: { sequence_order: number }, b: { sequence_order: number }) => a.sequence_order - b.sequence_order) || [];

    // Sort events by created_at descending (most recent first)
    contentRequest.events =
      contentRequest.events?.sort(
        (a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ) || [];

    // Calculate orchestrator state
    const completionPercentage = taskFactory.getCompletionPercentage(
      contentRequest.tasks || []
    );

    const allTasksComplete = taskFactory.areAllTasksComplete(contentRequest.tasks || []);

    // Find current/next task
    const currentTask = (contentRequest.tasks || []).find(
      (t: { status: string }) => t.status === 'in_progress'
    );
    
    // Determine next runnable task by request ID
    const nextTask = await taskFactory.getNextRunnableTask(contentRequest.id);

    const response: GetRequestResponse = {
      success: true,
      data: {
        ...contentRequest,
        orchestrator_state: {
          completion_percentage: completionPercentage,
          all_tasks_complete: allTasksComplete,
          current_task: currentTask ? {
            id: currentTask.id,
            name: currentTask.task_name,
            assigned_to: currentTask.assigned_to,
            started_at: currentTask.started_at,
          } : null,
          next_task: nextTask ? {
            id: nextTask.id,
            name: nextTask.task_name,
            agent_role: nextTask.agent_role,
          } : null,
          total_tasks: (contentRequest.tasks || []).length,
          completed_tasks: (contentRequest.tasks || []).filter((t: { status: string }) => t.status === 'completed').length,
          failed_tasks: (contentRequest.tasks || []).filter((t: { status: string }) => t.status === 'failed').length,
        },
      } as ContentRequestWithRelations,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in GET /api/v1/requests/:id:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// PATCH /api/v1/requests/:id - Update Request
// =============================================================================

const UpdateRequestSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  status: z.enum(['cancelled']).optional(), // Only allow cancel via PATCH
});

export async function PATCH(request: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await (context.params as any) as { id: string };
    const requestId = params.id;
    const body = await request.json();
    const validation = UpdateRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Verify request exists and user has access
    const { data: existing, error: fetchError } = await supabase
      .from('content_requests')
      .select('id, status, brand_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    // Prevent updates to terminal states
    if (existing.status === 'published' || existing.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Cannot update a completed or cancelled request' },
        { status: 400 }
      );
    }

    // Apply updates
    const { data: updated, error: updateError } = await supabase
      .from('content_requests')
      .update(updates)
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update request:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update request' },
        { status: 500 }
      );
    }

    // Log user action if status changed to cancelled
    if (updates.status === 'cancelled') {
      await supabase.from('request_events').insert({
        request_id: requestId,
        event_type: 'user_action',
        description: 'Request cancelled by user',
        metadata: { previous_status: existing.status },
        actor: `user:${user.id}`,
      });
    }

    const response: UpdateRequestResponse = {
      success: true,
      data: updated,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in PATCH /api/v1/requests/:id:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// DELETE /api/v1/requests/:id - Delete Request
// =============================================================================

export async function DELETE(request: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const params = await (context.params as any) as { id: string };
    const requestId = params.id;

    // Verify request exists
    const { data: existing, error: fetchError } = await supabase
      .from('content_requests')
      .select('id, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    // Only allow delete for intake/cancelled requests
    if (!['intake', 'cancelled'].includes(existing.status)) {
      return NextResponse.json(
        { success: false, error: 'Can only delete requests in intake or cancelled status' },
        { status: 400 }
      );
    }

    // Delete (cascades to tasks, events, provider_metadata)
    const { error: deleteError } = await supabase.from('content_requests').delete().eq('id', requestId);

    if (deleteError) {
      console.error('Failed to delete request:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete request' },
        { status: 500 }
      );
    }

    const response: DeleteRequestResponse = {
      success: true,
      message: 'Request deleted successfully',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in DELETE /api/v1/requests/:id:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
