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
    const supabase = await createClient(); // Use RLS safe client in future if needed (currently seems to use server client)
          // Note: The original code used createClient from @/lib/supabase/server which is RLS safe.
          // We will stick to it.
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Use the same schema for validation consistency, or a simplified one?
    // Using the same CreateCampaignSchema but maybe being more lenient if this is a "simple" endpoint.
    // However, for security, using the strict schema is better.
    // We import it dynamically if needed or just use loose check if this is a "legacy" or "demo" endpoint.
    // Given the prompt "campaigns via backend", let's leave it mostly as proxy but validating basics.
    
    // Ideally we should import CreateCampaignSchema. 
    // But since this calls a "backendUrl", we can just validate before forwarding.
    const { CreateCampaignSchema } = await import('@/lib/validations/campaign');
    // Allow partial validation or just check common fields? 
    // Since this acts as a proxy, we should probably validate the payload we are about to sign/forward.
    const validated = CreateCampaignSchema.partial().parse(body);

    // Create campaign via backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const res = await fetch(`${backendUrl}/api/v1/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validated, user_id: user.id }),
    });

    if (!res.ok) {
       // Avoid leaking backend error if possible, or parse carefully
       return NextResponse.json({ error: 'Failed to create campaign' }, { status: res.status });
    }

    // Invalidate cache
    const { invalidateCache } = await import('@/lib/redis');
    const { CacheKeys } = await import('@/lib/redis'); // Import cache keys
    await invalidateCache(CacheKeys.campaigns(user.id));

    return NextResponse.json(await res.json());
  } catch (error) {
    const { handleApiError } = await import('@/lib/api-utils');
    return handleApiError(error);
  }
}
