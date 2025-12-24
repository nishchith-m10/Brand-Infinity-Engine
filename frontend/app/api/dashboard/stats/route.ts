import { NextResponse } from 'next/server';
import { CacheKeys, CacheTTL, getOrSetCache } from '@/lib/redis';

// Enable Edge Runtime for faster global response times
export const runtime = 'edge';

// Revalidate cached response every 60 seconds
export const revalidate = 60;

export async function GET() {
  try {
    // Get stats from Redis cache or fetch fresh
    const stats = await getOrSetCache(
      CacheKeys.dashboardStats,
      async () => {
        // Fetch from your backend API
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        const res = await fetch(`${backendUrl}/api/v1/dashboard/stats`, {
          next: { revalidate: 60 },
        });
        
        if (!res.ok) {
          // Return mock data if backend unavailable
          return {
            totalCampaigns: 12,
            activeVideos: 45,
            totalViews: 125000,
            engagementRate: 4.2,
            contentPieces: 156,
            publishedThisWeek: 8,
          };
        }
        
        const data = await res.json();
        return data.data || data;
      },
      CacheTTL.MEDIUM // Cache for 5 minutes
    );

    // Return with cache headers for CDN/edge caching
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    // Return fallback data on error
    return NextResponse.json(
      {
        totalCampaigns: 0,
        activeVideos: 0,
        totalViews: 0,
        engagementRate: 0,
        contentPieces: 0,
        publishedThisWeek: 0,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
