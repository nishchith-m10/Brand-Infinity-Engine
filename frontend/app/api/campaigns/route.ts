import { NextResponse, NextRequest } from 'next/server';
import { getOrSetCache, CacheKeys, CacheTTL } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';

// Enable Edge Runtime for faster response
export const runtime = 'edge';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaigns = await getOrSetCache(
      CacheKeys.campaigns(user.id),
      async () => {
        // Fetch from backend or return mock data
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        try {
          const res = await fetch(`${backendUrl}/api/v1/campaigns?user_id=${user.id}`);
          if (res.ok) return res.json();
        } catch {
          // Backend unavailable, return mock
        }
        
        return [
          {
            id: 'camp_demo_001',
            name: 'Summer Product Launch',
            status: 'video',
            brief_id: 'brief_001',
            script_id: 'script_001',
            video_id: 'video_001',
            created_at: new Date().toISOString(),
            brand_id: 'brand_001',
          },
          {
            id: 'camp_demo_002',
            name: 'Fall Collection',
            status: 'script',
            brief_id: 'brief_002',
            created_at: new Date(Date.now() - 86400000).toISOString(),
            brand_id: 'brand_001',
          },
        ];
      },
      CacheTTL.MEDIUM
    );

    return NextResponse.json(campaigns, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('Campaigns error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Create campaign via backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const res = await fetch(`${backendUrl}/api/v1/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, user_id: user.id }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    // Invalidate cache
    const { invalidateCache } = await import('@/lib/redis');
    await invalidateCache(CacheKeys.campaigns(user.id));

    return NextResponse.json(await res.json());
  } catch (error) {
    console.error('Create campaign error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
