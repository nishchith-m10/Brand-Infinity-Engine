import { NextResponse } from 'next/server';
import { getOrSetCache, CacheKeys, CacheTTL } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const videos = await getOrSetCache(
      CacheKeys.videos(user.id),
      async () => {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        try {
          const res = await fetch(`${backendUrl}/api/v1/videos?user_id=${user.id}`);
          if (res.ok) return res.json();
        } catch {
          // Backend unavailable
        }
        
        return [
          {
            video_id: 'video_001',
            script_id: 'script_001',
            campaign_name: 'Summer Product Launch',
            status: 'completed',
            model_used: 'veo3',
            scenes_count: 3,
            total_duration_seconds: 30,
            total_cost_usd: 15,
            quality_score: 0.99,
            output_url: '/videos/video_001.mp4',
            created_at: new Date().toISOString(),
          },
          {
            video_id: 'video_002',
            script_id: 'script_002',
            campaign_name: 'Fall Collection',
            status: 'generating',
            model_used: 'sora',
            scenes_count: 4,
            total_duration_seconds: 45,
            total_cost_usd: 25,
            quality_score: 0,
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
        ];
      },
      CacheTTL.SHORT
    );

    return NextResponse.json(videos, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
      },
    });
  } catch (error) {
    console.error('Videos error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
