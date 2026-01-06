import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// State Machine for Video/Generation Job Status Transitions
// =============================================================================
const VALID_VIDEO_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: ['published', 'rejected'],
  published: ['archived'],
  rejected: ['processing'], // allow re-processing
  failed: ['processing'], // allow retry
  archived: []
};

function validateVideoTransition(currentStatus: string, newStatus: string): boolean {
  const allowed = VALID_VIDEO_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

// =============================================================================
// GET /api/v1/videos/[id] - Get video details
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: jobId } = await params;

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Fetch video/generation job
    const { data: video, error } = await supabase
      .from('generation_jobs')
      .select('*, campaigns!inner(user_id)')
      .eq('job_id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } },
          { status: 404 }
        );
      }
      console.error('[API] Video GET error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: video,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Video GET unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/v1/videos/[id] - Update video status (with approval checks)
// =============================================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: jobId } = await params;
    const body = await request.json();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { status: newStatus } = body;

    // Get current video
    const { data: video, error: fetchError } = await supabase
      .from('generation_jobs')
      .select('status, approval_status, approved_at, approved_by, campaigns!inner(user_id)')
      .eq('job_id', jobId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // Enforce approval before publishing
    if (newStatus === 'published') {
      if (video.approval_status !== 'approved' || !video.approved_at) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'APPROVAL_REQUIRED', 
              message: 'Video must be approved before publishing. Use /api/v1/videos/[id]/approve endpoint first.',
              details: {
                currentApprovalStatus: video.approval_status,
                requiredApprovalStatus: 'approved'
              }
            } 
          },
          { status: 403 }
        );
      }
    }

    // Validate state transitions
    if (newStatus && newStatus !== video.status) {
      if (!validateVideoTransition(video.status, newStatus)) {
        return NextResponse.json(
          { 
            success: false,
            error: { 
              code: 'INVALID_TRANSITION',
              message: `Invalid status transition: ${video.status} \u2192 ${newStatus}`,
              details: {
                currentStatus: video.status,
                requestedStatus: newStatus,
                allowedTransitions: VALID_VIDEO_TRANSITIONS[video.status] || []
              }
            } 
          },
          { status: 400 }
        );
      }
    }

    // Update video
    const allowedFields = ['status', 'metadata', 'output_url'];
    const updateData: Record<string, unknown> = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } },
        { status: 400 }
      );
    }

    const { data: updatedVideo, error } = await supabase
      .from('generation_jobs')
      .update(updateData)
      .eq('job_id', jobId)
      .select()
      .single();

    if (error) {
      console.error('[API] Video PATCH error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedVideo,
      message: 'Video updated',
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Video PATCH unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
