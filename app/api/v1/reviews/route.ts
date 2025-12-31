import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// GET /api/v1/reviews - Get pending items for review (briefs, scripts, videos)
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'brief', 'script', 'video', or null for all

    const results: { briefs: unknown[]; scripts: unknown[]; videos: unknown[] } = {
      briefs: [],
      scripts: [],
      videos: [],
    };

    // Fetch pending briefs
    if (!type || type === 'brief') {
      const { data: briefs } = await supabase
        .from('creative_briefs')
        .select(`
          *,
          campaigns:campaign_id (campaign_name)
        `)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
      
      results.briefs = briefs || [];
    }

    // Fetch scripts that need review (no approval_status, but we can check brand_compliance_score)
    if (!type || type === 'script') {
      const { data: scripts } = await supabase
        .from('scripts')
        .select(`
          *,
          briefs:brief_id (campaign_id)
        `)
        .order('created_at', { ascending: false })
        .limit(20);
      
      results.scripts = scripts || [];
    }

    // Fetch completed videos for review
    if (!type || type === 'video') {
      const { data: videos } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);
      
      results.videos = videos || [];
    }

    return NextResponse.json({
      success: true,
      data: results,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Reviews GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
