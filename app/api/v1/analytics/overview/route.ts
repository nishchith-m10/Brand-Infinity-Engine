
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      total_views: 15420,
      total_likes: 3200,
      total_comments: 450,
      total_shares: 120,
      engagement_rate: 4.5,
      top_performing_platform: 'instagram',
      daily_stats: [],
    },
  });
}
