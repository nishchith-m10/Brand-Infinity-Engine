import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// POST /api/v1/briefs/[id]/approve - Approve a creative brief
// =============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: briefId } = await params;

    // Update the brief's approval status
    const { data: brief, error } = await supabase
      .from('creative_briefs')
      .update({ 
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
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
      console.error('[API] Brief approve error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: brief,
      message: 'Brief approved',
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Brief approve unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
