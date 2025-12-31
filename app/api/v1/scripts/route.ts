import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// GET /api/v1/scripts - List scripts
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const searchParams = request.nextUrl.searchParams;

    const campaignId = searchParams.get('campaign_id');
    const briefId = searchParams.get('brief_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('scripts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }
    if (briefId) {
      query = query.eq('brief_id', briefId);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[API] Scripts GET error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: { count: count || 0, limit, offset, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Scripts GET unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
