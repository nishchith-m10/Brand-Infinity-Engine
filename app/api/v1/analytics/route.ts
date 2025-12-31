import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// GET /api/v1/analytics - Get analytics data
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('range') || '7d';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // 7d
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Fetch aggregated stats from platform_posts
    const { data: posts } = await supabase
      .from('platform_posts')
      .select('platform, engagement_metrics, status, created_at')
      .gte('created_at', startDate.toISOString());

    // Calculate overview stats
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    const platformStats: Record<string, { views: number; likes: number; comments: number; shares: number; posts: number }> = {};

    (posts || []).forEach(post => {
      const metrics = post.engagement_metrics || {};
      const views = metrics.views || 0;
      const likes = metrics.likes || 0;
      const comments = metrics.comments || 0;
      const shares = metrics.shares || 0;

      totalViews += views;
      totalLikes += likes;
      totalComments += comments;
      totalShares += shares;

      // Aggregate by platform
      if (!platformStats[post.platform]) {
        platformStats[post.platform] = { views: 0, likes: 0, comments: 0, shares: 0, posts: 0 };
      }
      platformStats[post.platform].views += views;
      platformStats[post.platform].likes += likes;
      platformStats[post.platform].comments += comments;
      platformStats[post.platform].shares += shares;
      platformStats[post.platform].posts += 1;
    });

    // Calculate engagement rate
    const engagementRate = totalViews > 0 
      ? ((totalLikes + totalComments + totalShares) / totalViews * 100)
      : 0;

    const overview = {
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      engagementRate: Math.round(engagementRate * 10) / 10,
      viewsChange: 0, // Would need historical data to calculate
      likesChange: 0,
      commentsChange: 0,
      sharesChange: 0,
    };

    // Convert platform stats to array
    const platformStatsArray = Object.entries(platformStats).map(([platform, stats]) => ({
      platform,
      ...stats,
      engagementRate: stats.views > 0 
        ? Math.round((stats.likes + stats.comments + stats.shares) / stats.views * 1000) / 10
        : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        overview,
        platformStats: platformStatsArray,
        dailyStats: [], // Would need daily aggregation
      },
      meta: { timeRange, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Analytics GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
