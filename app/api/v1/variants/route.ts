import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CreateVariantSchema } from '@/lib/validations/api-schemas';
import { validationErrorResponse, errorResponse } from '@/lib/api/response';
import { ErrorCodes } from '@/lib/api/error-codes';

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
      return errorResponse(ErrorCodes.DATABASE_ERROR, error.message);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Variants GET unexpected error:', error);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error');
  }
}

// =============================================================================
// POST /api/v1/variants - Generate variants for platforms
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = CreateVariantSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const { video_id, platforms } = validation.data;
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
      return errorResponse(ErrorCodes.DATABASE_ERROR, error.message);
    }

    return NextResponse.json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Variants POST unexpected error:', error);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error');
  }
}