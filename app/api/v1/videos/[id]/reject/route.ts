import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// POST /api/v1/videos/[id]/reject - Reject a video (generation job)
// Only completed videos can be rejected
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
    
    // Parse rejection reason from body
    let reason = 'No reason provided';
    try {
      const body = await request.json();
      reason = body.reason || reason;
    } catch {
      // Body parsing failed, use default reason
    }

    // Get current video status
    const { data: existingVideo, error: fetchError } = await supabase
      .from('generation_jobs')
      .select('status, approval_status, campaigns!inner(user_id)')
      .eq('id', jobId)
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

    // Only reject completed videos
    if (existingVideo.status !== 'completed') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_STATUS', 
            message: 'Only completed videos can be rejected',
            details: {
              currentStatus: existingVideo.status,
              requiredStatus: 'completed'
            }
          } 
        },
        { status: 400 }
      );
    }

    // Update the generation job's approval status
    const { data: video, error } = await supabase
      .from('generation_jobs')
      .update({ 
        approval_status: 'rejected',
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
        rejected_by: user.id,
        status: 'rejected' // Update status to rejected as well
      })
      .eq('id', jobId)
      .eq('status', 'completed') // Double-check status in update query
      .select()
      .single();

    if (error) {
      console.error('[API] Video reject error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    if (!video) {
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to reject video. Status may have changed.' } },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: video,
      message: 'Video rejected. It can be reprocessed if needed.',
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Video reject unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
