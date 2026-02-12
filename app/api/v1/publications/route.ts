import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// GET /api/v1/publications - List platform posts
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const searchParams = request.nextUrl.searchParams;

    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('platform_posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[API] Publications GET error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: { count: count || 0, limit, offset, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Publications GET unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/v1/publications - Schedule a post
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    // Validate required fields
    if (!body.variant_id || !body.scheduled_time) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'variant_id and scheduled_time are required' } },
        { status: 400 }
      );
    }

    // Verify variant exists
    const { data: variant, error: variantError } = await supabase
      .from('platform_variants')
      .select('*')
      .eq('variant_id', body.variant_id)
      .single();

    if (variantError && variantError.code !== 'PGRST116') {
      console.error('[API] Publications POST - variant check error:', variantError);
    }

    // Create the scheduled post
    const { data: post, error } = await supabase
      .from('platform_posts')
      .insert({
        variant_id: body.variant_id,
        platform: body.platform || variant?.platform || 'unknown',
        status: 'scheduled',
        scheduled_time: body.scheduled_time,
        caption: body.caption || '',
        hashtags: body.hashtags || [],
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Publications POST error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: post,
      message: 'Post scheduled',
      meta: { timestamp: new Date().toISOString() },
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Publications POST unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

