import { NextResponse } from 'next/server';
import { getOrSetCache, CacheKeys, CacheTTL } from '@/lib/redis';

// Enable Edge Runtime
export const runtime = 'edge';

export async function GET() {
  try {
    const activity = await getOrSetCache(
      CacheKeys.dashboardActivity,
      async () => {
        // Fetch from backend or return mock data
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        const res = await fetch(`${backendUrl}/api/v1/dashboard/activity`, {
          next: { revalidate: 60 },
        });
        
        if (!res.ok) {
          // Return mock activity data
          return [
            {
              id: '1',
              type: 'video_completed',
              title: 'Video "Summer Launch" completed',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: '2',
              type: 'campaign_created',
              title: 'New campaign "Fall Collection" created',
              timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: '3',
              type: 'content_published',
              title: 'Content published to Instagram',
              timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: '4',
              type: 'pending_review',
              title: 'Video generation pending review',
              timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            },
          ];
        }
        
        const data = await res.json();
        return data.data || data;
      },
      CacheTTL.SHORT // Cache for 30 seconds
    );

    return NextResponse.json(activity, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
      },
    });
  } catch (error) {
    console.error('Dashboard activity error:', error);
    return NextResponse.json([], {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
