import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// POST /api/v1/briefs/[id]/reject - Reject a creative brief
// =============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: briefId } = await params;
    
    // Parse rejection reason from body
    let reason = 'No reason provided';
    try {
      const body = await request.json();
      reason = body.reason || reason;
    } catch {
      // Body parsing failed, use default reason
    }

    // Update the brief's approval status
    const { data: brief, error } = await supabase
      .from('creative_briefs')
      .update({ 
        approval_status: 'rejected',
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
      })
      .eq('brief_id', briefId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Brief not found' } },
          { status: 404 }
        );
      }
      console.error('[API] Brief reject error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: brief,
      message: 'Brief rejected',
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Brief reject unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
