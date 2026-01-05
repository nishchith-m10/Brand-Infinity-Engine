import { NextResponse } from 'next/server';

// Enable Edge Runtime for faster global response times
export const runtime = 'edge';

// Revalidate cached response every 60 seconds
export const revalidate = 60;

// Mock stats data
const mockStats = {
  totalCampaigns: 12,
  activeVideos: 45,
  totalViews: 125000,
  engagementRate: 4.2,
  contentPieces: 156,
  publishedThisWeek: 8,
};

export async function GET() {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const res = await fetch(`${backendUrl}/api/v1/dashboard/stats`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      // Return mock data if backend unavailable
      return NextResponse.json(mockStats, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      });
    }

    const data = await res.json();
    return NextResponse.json(data.data || data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);

    // Return fallback data on error
    return NextResponse.json(mockStats, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    });
  }
}

