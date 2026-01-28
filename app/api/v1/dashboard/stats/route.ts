import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCacheHeaders, CACHE_DURATIONS } from '@/lib/performance/query-optimization';

// Enable response caching for dashboard stats (60 seconds)
export const revalidate = CACHE_DURATIONS.DASHBOARD_STATS;

// Statuses that should NOT be counted in "Total Campaigns" on dashboard
const EXCLUDED_STATUSES = ['archived', 'pending_deletion'];

// =============================================================================
// GET /api/v1/dashboard/stats - Dashboard metrics
// =============================================================================
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get first of current month for cost calculation
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Parallel queries for dashboard metrics
    // Defense-in-Depth: Explicitly filter by user_id even if RLS exists
    const [
      campaignsResult,
      videosResult,
      costResult,
      publishedResult,
      recentCampaignsResult,
    ] = await Promise.all([
      // Campaign counts by status (exclude archived/deleted)
      supabase
        .from('campaigns')
        .select('status')
        .eq('user_id', user.id) // Explicit User Filter
        .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`),

      // Video generation job counts by status
      supabase
        .from('generation_jobs')
        .select('status')
        .eq('user_id', user.id), // Explicit User Filter

      // Total cost this month
      supabase
        .from('cost_ledger')
        .select('cost_usd')
        .eq('user_id', user.id) // Explicit User Filter
        .gte('created_at', firstOfMonth),

      // Published content count
      supabase
        .from('platform_posts')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id) // Explicit User Filter
        .eq('status', 'published'),

      // Recent campaigns for activity feed (exclude archived/deleted)
      supabase
        .from('campaigns')
        .select('campaign_id, campaign_name, status, created_at, updated_at')
        .eq('user_id', user.id) // Explicit User Filter
        .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
        .order('updated_at', { ascending: false })
        .limit(5),
    ]);

    // Group campaigns by status
    const campaignsByStatus: Record<string, number> = {};
    (campaignsResult.data || []).forEach((c: { status: string }) => {
      campaignsByStatus[c.status] = (campaignsByStatus[c.status] || 0) + 1;
    });

    // Group videos by status
    const videosByStatus: Record<string, number> = {};
    (videosResult.data || []).forEach((v: { status: string }) => {
      videosByStatus[v.status] = (videosByStatus[v.status] || 0) + 1;
    });

    // Calculate total cost
    const totalCost = (costResult.data || []).reduce(
      (sum: number, row: { cost_usd: string }) => sum + parseFloat(row.cost_usd || '0'),
      0
    );

    // Count active campaigns (explicit whitelist)
    // Only count truly active or paused campaigns. Ignore draft, completed, archived, etc.
    const activeCampaigns = Object.entries(campaignsByStatus)
      .filter(([status]) => ['active', 'paused'].includes(status))
      .reduce((sum, [, count]) => sum + count, 0);

    const response = NextResponse.json({
      success: true,
      data: {
        campaigns: {
          total: campaignsResult.data?.length || 0, // Now excludes archived/deleted
          active: activeCampaigns,
          by_status: campaignsByStatus,
        },
        videos: {
          total: videosResult.data?.length || 0,
          completed: videosByStatus['completed'] || 0,
          processing: videosByStatus['processing'] || 0,
          by_status: videosByStatus,
        },
        cost: {
          this_month_usd: totalCost.toFixed(2),
        },
        publications: {
          total_published: publishedResult.count || 0,
        },
        recent_activity: recentCampaignsResult.data || [],
      },
      meta: { 
        timestamp: new Date().toISOString(),
        cached_until: new Date(Date.now() + CACHE_DURATIONS.DASHBOARD_STATS * 1000).toISOString(),
      },
    });

    // Add cache headers for client-side caching
    const cacheHeaders = getCacheHeaders(CACHE_DURATIONS.DASHBOARD_STATS, {
      staleWhileRevalidate: 120, // Allow stale data for 2 minutes while revalidating
      private: true, // User-specific data
    });

    Object.entries(cacheHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('[API] Dashboard stats error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

