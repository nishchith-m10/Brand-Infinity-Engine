import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { z } from 'zod';

// Initialize OpenAI client (lazy load)
let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('[OpenAI] OPENAI_API_KEY environment variable is required');
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const CreateAssetSchema = z.object({
  brand_id: z.string().uuid(),
  knowledge_base_id: z.string().uuid().optional(), // NEW: Associate with KB
  asset_type: z.enum(['logo', 'product', 'guideline', 'color', 'font', 'other']),
  file_url: z.string().url(),
  file_name: z.string(),
  content_text: z.string().optional(), // NEW: For text-based content
  metadata: z.record(z.string(), z.unknown()).optional(),
  generate_embedding: z.boolean().default(true),
});

/**
 * GET /api/v1/brand-assets
 * List brand assets with optional filtering
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }
  
  const searchParams = request.nextUrl.searchParams;
  const brandId = searchParams.get('brand_id');
  const knowledgeBaseId = searchParams.get('knowledge_base_id');
  const assetType = searchParams.get('asset_type');
  const activeOnly = searchParams.get('active') !== 'false';

  // Verify user owns the brand if brandId is provided
  // Skip check if brandId equals user.id (single-tenant fallback mode)
  if (brandId && brandId !== user.id) {
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('owner_id', user.id)
      .single();
      
    if (!brand) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }
  }

  let query = supabase
    .from('brand_knowledge_base')
    .select('*')
    .order('created_at', { ascending: false });

  if (brandId) {
    query = query.eq('brand_id', brandId);
  }

  if (knowledgeBaseId) {
    query = query.eq('knowledge_base_id', knowledgeBaseId);
  }

  if (assetType) {
    query = query.eq('asset_type', assetType);
  }

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}

/**
 * POST /api/v1/brand-assets
 * Create a new brand asset with optional embedding generation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = CreateAssetSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const params = validation.data;
    const supabase = await createClient();

    // Generate embedding for text-based assets (guidelines, descriptions)
    let embedding = null;
    if (params.generate_embedding && params.asset_type === 'guideline') {
      try {
        // For guidelines, we'd extract text from the document
        // For now, use the file name + metadata as the embedding source
        const textToEmbed = `${params.file_name} ${JSON.stringify(params.metadata || {})}`;
        const embeddingResponse = await getOpenAI().embeddings.create({
          model: 'text-embedding-ada-002',
          input: textToEmbed,
        });
        embedding = embeddingResponse.data[0].embedding;
      } catch (err) {
        console.error('Embedding generation failed:', err);
      }
    }

    const insertData: {
      brand_id: string;
      knowledge_base_id: string | null;
      asset_type: string;
      file_url: string;
      file_name: string;
      content_text: string | null;
      metadata: Record<string, unknown>;
      is_active: boolean;
      embedding?: number[];
    } = {
      brand_id: params.brand_id,
      knowledge_base_id: params.knowledge_base_id || null,
      asset_type: params.asset_type,
      file_url: params.file_url,
      file_name: params.file_name,
      content_text: params.content_text || null,
      metadata: (params.metadata as Record<string, unknown>) || {},
      is_active: true,
    };

    if (embedding) {
      insertData.embedding = embedding;
    }

    const { data: asset, error } = await supabase
      .from('brand_knowledge_base')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (error) {
    console.error('Brand asset creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create asset' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/brand-assets?id=uuid
 * Delete a brand asset
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  
  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }
  
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Asset ID required' } },
      { status: 400 }
    );
  }

  // Check if user owns the asset's brand
  const { data: asset } = await supabase
    .from('brand_knowledge_base')
    .select('brand_id')
    .eq('id', id)
    .single();

  if (!asset) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } },
      { status: 404 }
    );
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('id', asset.brand_id)
    .eq('owner_id', user.id)
    .single();

  if (!brand) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from('brand_knowledge_base')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/v1/brand-assets?id=uuid
 * Toggle asset active status or update metadata
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  
  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }
  
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Asset ID required' } },
      { status: 400 }
    );
  }

  // Check if user owns the asset's brand
  const { data: asset } = await supabase
    .from('brand_knowledge_base')
    .select('brand_id')
    .eq('id', id)
    .single();

  if (!asset) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } },
      { status: 404 }
    );
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('id', asset.brand_id)
    .eq('owner_id', user.id)
    .single();

  if (!brand) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    );
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.is_active === 'boolean') {
    updates.is_active = body.is_active;
  }

  if (body.metadata) {
    updates.metadata = body.metadata;
  }

  // Don't set updated_at - column doesn't exist in brand_knowledge_base table

  const { data, error } = await supabase
    .from('brand_knowledge_base')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
