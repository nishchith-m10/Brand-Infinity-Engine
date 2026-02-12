import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// POST /api/v1/videos/[id]/approve - Approve a video (generation job)
// =============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: jobId } = await params;

    // Update the generation job's approval status
    const { data: video, error } = await supabase
      .from('generation_jobs')
      .update({ 
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('job_id', jobId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } },
          { status: 404 }
        );
      }
      console.error('[API] Video approve error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: video,
      message: 'Video approved',
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
