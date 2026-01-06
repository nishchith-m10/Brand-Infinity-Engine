import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// POST /api/v1/videos/[id]/approve - Approve a video (generation job)
// Only completed videos can be approved
// =============================================================================
export async function POST(
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

    // Get current video status
    const { data: existingVideo, error: fetchError } = await supabase
      .from('generation_jobs')
      .select('status, approval_status, campaigns!inner(user_id)')
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

    // Only approve completed videos
    if (existingVideo.status !== 'completed') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_STATUS', 
            message: 'Only completed videos can be approved',
            details: {
              currentStatus: existingVideo.status,
              requiredStatus: 'completed'
            }
          } 
        },
        { status: 400 }
      );
    }

    // Check if already approved
    if (existingVideo.approval_status === 'approved') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'ALREADY_APPROVED', 
            message: 'Video is already approved' 
          } 
        },
        { status: 400 }
      );
    }

    // Update the generation job's approval status
    const { data: video, error } = await supabase
      .from('generation_jobs')
      .update({ 
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id
      })
      .eq('job_id', jobId)
      .eq('status', 'completed') // Double-check status in update query
      .select()
      .single();

    if (error) {
      console.error('[API] Video approve error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    if (!video) {
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to approve video. Status may have changed.' } },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: video,
      message: 'Video approved successfully. You can now publish it.',
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Video approve unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
