
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      total_views: 5420,
      total_likes: 1200,
      total_comments: 150,
      total_shares: 40,
      engagement_rate: 3.8,
      top_performing_platform: 'tiktok',
      daily_stats: [],
    },
  });
}
