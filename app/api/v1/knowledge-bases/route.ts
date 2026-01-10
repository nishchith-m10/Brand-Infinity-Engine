import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================================================
// Validation Schemas
// =============================================================================

const CreateKBSchema = z.object({
  brand_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().default('folder'),
  color: z.string().default('#6366F1'), // Accept any color format (hex, hsl, rgb)
  tags: z.array(z.string()).default([]),
  is_default: z.boolean().default(false),
});

// =============================================================================
// GET /api/v1/knowledge-bases - List knowledge bases
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const brandId = searchParams.get('brand_id');
    const campaignId = searchParams.get('campaign_id');
    const tag = searchParams.get('tag');
    const includeInactive = searchParams.get('include_inactive') === 'true';

    if (!brandId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'brand_id is required' } },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('knowledge_bases')
      .select('*')
      .eq('brand_id', brandId)
      .order('is_core', { ascending: false })
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    // Filter by campaign if provided
    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    // Filter by active status
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    // Filter by tag
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        count: data?.length || 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const { handleApiError } = await import('@/lib/api-utils');
    return handleApiError(error);
  }
}

// =============================================================================
// POST /api/v1/knowledge-bases - Create knowledge base
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = CreateKBSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', details: validation.error.issues } },
        { status: 400 }
      );
    }

    // Use provided brand_id or default to user.id
    const brandId = validation.data.brand_id || user.id;

    // Check if this brand already has a core KB (if trying to create one)
    if (body.is_core) {
      const { data: existingCore } = await supabase
        .from('knowledge_bases')
        .select('id')
        .eq('brand_id', brandId)
        .eq('is_core', true)
        .single();

      if (existingCore) {
        return NextResponse.json(
          { success: false, error: { code: 'CONFLICT', message: 'Brand already has a core knowledge base' } },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase
      .from('knowledge_bases')
      .insert({
        ...validation.data,
        brand_id: brandId,
        campaign_id: body.campaign_id || null, // Campaign ID if provided
        is_core: false, // Users cannot create core KBs via API
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    const { handleApiError } = await import('@/lib/api-utils');
    return handleApiError(error);
  }
}
