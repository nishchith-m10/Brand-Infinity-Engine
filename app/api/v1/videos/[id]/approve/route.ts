import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

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

    // Prefer to perform approval update using the service role client to avoid
    // restrictive RLS update rules. Fall back to the RLS client if service role is
    // not configured or the admin update fails.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let video = null;
    if (supabaseUrl && serviceRoleKey) {
      const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey);
      const { data: adminData, error: adminError } = await adminClient
        .from('generation_jobs')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id
        })
        .eq('id', jobId)
        .eq('status', 'completed')
        .select()
        .single();

      if (adminError) {
        // If admin update returns PGRST116 (no rows) handle by checking current state
        if (adminError.code === 'PGRST116') {
          const { data: currentRow, error: fetchErr } = await adminClient
            .from('generation_jobs')
            .select('id,approval_status,approved_at,approved_by,status')
            .eq('id', jobId)
            .single();

          if (fetchErr) {
            console.error('[API] Video approve error (admin):', adminError);
            return NextResponse.json(
              { success: false, error: { code: 'DB_ERROR', message: fetchErr.message } },
              { status: 500 }
            );
          }

          if (currentRow.approval_status === 'approved') {
            return NextResponse.json({ success: true, data: currentRow, message: 'Video already approved by another process' });
          }

          return NextResponse.json(
            { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to approve video. Status may have changed.' } },
            { status: 409 }
          );
        }

        console.error('[API] Video approve error (admin):', adminError);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: adminError.message } },
          { status: 500 }
        );
      }

      video = adminData;
    } else {
      // No admin client available; use RLS client and the same defensive logic
      const { data: rlsData, error: rlsError } = await supabase
        .from('generation_jobs')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id
        })
        .eq('id', jobId)
        .eq('status', 'completed')
        .select()
        .single();

      if (rlsError) {
        if (rlsError.code === 'PGRST116') {
          const { data: currentRow, error: fetchErr } = await supabase
            .from('generation_jobs')
            .select('id,approval_status,approved_at,approved_by,status')
            .eq('id', jobId)
            .single();

          if (fetchErr) {
            console.error('[API] Video approve error:', rlsError);
            return NextResponse.json(
              { success: false, error: { code: 'DB_ERROR', message: fetchErr.message } },
              { status: 500 }
            );
          }

          if (currentRow.approval_status === 'approved') {
            return NextResponse.json({ success: true, data: currentRow, message: 'Video already approved by another process' });
          }

          return NextResponse.json(
            { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to approve video. Status may have changed.' } },
            { status: 409 }
          );
        }

        console.error('[API] Video approve error:', rlsError);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: rlsError.message } },
          { status: 500 }
        );
      }

      video = rlsData;
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
