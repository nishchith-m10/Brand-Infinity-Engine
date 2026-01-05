import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// GET /api/v1/publications/[id] - Get single publication
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: publicationId } = await params;

    const { data: post, error } = await supabase
      .from('platform_posts')
      .select('*')
      .eq('publication_id', publicationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Publication not found' } },
          { status: 404 }
        );
      }
      console.error('[API] Publication GET error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: post,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Publication GET unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/v1/publications/[id] - Cancel a scheduled post
// =============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: publicationId } = await params;

    // First check if the post exists and is cancellable
    const { data: existing, error: fetchError } = await supabase
      .from('platform_posts')
      .select('status')
      .eq('publication_id', publicationId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Publication not found' } },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // Only allow cancellation of scheduled posts
    if (existing.status !== 'scheduled') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: `Cannot cancel post with status: ${existing.status}` } },
        { status: 400 }
      );
    }

    // Update to cancelled (soft delete) or delete entirely
    const { error } = await supabase
      .from('platform_posts')
      .update({ status: 'cancelled' })
      .eq('publication_id', publicationId);

    if (error) {
      console.error('[API] Publication DELETE error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Post cancelled',
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Publication DELETE unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/v1/publications/[id] - Update schedule time
// =============================================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: publicationId } = await params;
    const body = await request.json();

    // Build update object
    const updateData: Record<string, unknown> = {};
    
    if (body.scheduled_time) {
      updateData.scheduled_time = body.scheduled_time;
    }
    if (body.caption !== undefined) {
      updateData.caption = body.caption;
    }
    if (body.hashtags !== undefined) {
      updateData.hashtags = body.hashtags;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } },
        { status: 400 }
      );
    }

    const { data: post, error } = await supabase
      .from('platform_posts')
      .update(updateData)
      .eq('publication_id', publicationId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Publication not found' } },
          { status: 404 }
        );
      }
      console.error('[API] Publication PATCH error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: post,
      message: 'Publication updated',
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Publication PATCH unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
