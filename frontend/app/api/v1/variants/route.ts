import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// GET /api/v1/variants - Get platform variants for distribution
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const videoId = searchParams.get('video_id');
    const platform = searchParams.get('platform');

    let query = supabase
      .from('platform_variants')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (videoId) {
      query = query.eq('video_id', videoId);
    }
    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[API] Variants GET error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Variants GET unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/v1/variants - Generate variants for platforms
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { video_id, platforms } = body;

    if (!video_id || !platforms || !Array.isArray(platforms)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'video_id and platforms[] required' } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Create variant records for each platform
    const variants = platforms.map(platform => ({
      video_id,
      platform,
      status: 'pending',
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('platform_variants')
      .insert(variants)
      .select();

    if (error) {
      console.error('[API] Variants POST error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Variants POST unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
