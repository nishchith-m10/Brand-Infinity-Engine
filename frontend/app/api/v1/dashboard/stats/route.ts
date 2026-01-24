import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Statuses that should NOT be counted in "Total Campaigns" on dashboard
const EXCLUDED_STATUSES = ['archived', 'pending_deletion'];

// =============================================================================
// GET /api/v1/dashboard/stats - Dashboard metrics
// =============================================================================
export async function GET() {
  try {
    const supabase = await createClient();

    // Get first of current month for cost calculation
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Parallel queries for dashboard metrics
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
        .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`),

      // Video generation job counts by status
      supabase
        .from('generation_jobs')
        .select('status'),

      // Total cost this month
      supabase
        .from('cost_ledger')
        .select('cost_usd')
        .gte('created_at', firstOfMonth),

      // Published content count
      supabase
        .from('platform_posts')
        .select('*', { count: 'exact' })
        .eq('status', 'published'),

      // Recent campaigns for activity feed (exclude archived/deleted)
      supabase
        .from('campaigns')
        .select('campaign_id, campaign_name, status, created_at, updated_at')
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

    // Count active campaigns (not draft or completed)
    const activeCampaigns = Object.entries(campaignsByStatus)
      .filter(([status]) => !['draft', 'completed'].includes(status))
      .reduce((sum, [, count]) => sum + count, 0);

    return NextResponse.json({
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
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Dashboard stats error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

