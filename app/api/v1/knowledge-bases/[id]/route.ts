import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================================================
// Validation Schema
// =============================================================================

const UpdateKBSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().optional(),
  color: z.string().optional(), // Accept any color format (hex, hsl, rgb)
  tags: z.array(z.string()).optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// =============================================================================
// GET /api/v1/knowledge-bases/:id - Get single knowledge base
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Knowledge base not found' } },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const { handleApiError } = await import('@/lib/api-utils');
    return handleApiError(error);
  }
}

// =============================================================================
// PUT /api/v1/knowledge-bases/:id - Update knowledge base
// =============================================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = UpdateKBSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', details: validation.error.issues } },
        { status: 400 }
      );
    }

    // Check if KB exists
    const { data: existing, error: fetchError } = await supabase
      .from('knowledge_bases')
      .select('id, is_core')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Knowledge base not found' } },
        { status: 404 }
      );
    }

    // Prevent deactivating core KB
    if (existing.is_core && validation.data.is_active === false) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot deactivate core knowledge base' } },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('knowledge_bases')
      .update(validation.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const { handleApiError } = await import('@/lib/api-utils');
    return handleApiError(error);
  }
}

// =============================================================================
// DELETE /api/v1/knowledge-bases/:id - Delete knowledge base
// =============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Check if KB exists and is not core
    const { data: existing, error: fetchError } = await supabase
      .from('knowledge_bases')
      .select('id, is_core, name')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Knowledge base not found' } },
        { status: 404 }
      );
    }

    if (existing.is_core) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete core knowledge base' } },
        { status: 403 }
      );
    }

    // Soft delete by setting is_active = false
    const { error } = await supabase
      .from('knowledge_bases')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Knowledge base "${existing.name}" deleted successfully` 
    });
  } catch (error) {
    const { handleApiError } = await import('@/lib/api-utils');
    return handleApiError(error);
  }
}
