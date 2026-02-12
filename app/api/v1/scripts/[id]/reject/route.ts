import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// POST /api/v1/scripts/[id]/reject - Reject a script
// =============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: scriptId } = await params;
    
    // Parse rejection reason from body
    let reason = 'No reason provided';
    try {
      const body = await request.json();
      reason = body.reason || reason;
    } catch {
      // Body parsing failed, use default reason
    }

    // Update the script's approval status
    const { data: script, error } = await supabase
      .from('scripts')
      .update({ 
        approval_status: 'rejected',
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
      })
      .eq('script_id', scriptId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Script not found' } },
          { status: 404 }
        );
      }
      console.error('[API] Script reject error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: script,
      message: 'Script rejected',
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Script reject unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
