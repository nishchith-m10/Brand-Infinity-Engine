import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// GET /api/v1/campaigns/[id] - Get single campaign with related data
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: campaignId } = await params;

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // RLS will automatically filter results to user's accessible campaigns
    let { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        creative_briefs (*),
        scripts (*),
        generation_jobs (*)
      `)
      .eq('id', campaignId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
          { status: 404 }
        );
      }
      console.error('[API] Campaign GET error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } },
        { status: 500 }
      );
    }

    // If no campaign found, user doesn't have access (RLS filtered it out)
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: campaign,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Campaign GET unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/v1/campaigns/[id] - Update campaign
// =============================================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: campaignId } = await params;
    const body = await request.json();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // First, check if campaign exists and user has access (RLS will filter)
    const { data: existing, error: fetchError } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Block updates on archived or pending_deletion campaigns
    if (existing.status === 'archived' || existing.status === 'pending_deletion') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify archived or deleted campaigns. Restore first to make changes.' } },
        { status: 403 }
      );
    }

    // Build update object (only allow certain fields)
    const allowedFields = ['campaign_name', 'status', 'budget_limit_usd', 'metadata'];
    const updateData: Record<string, unknown> = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } },
        { status: 400 }
      );
    }

    // Update with RLS enforcement
    let { data: campaign, error } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
          { status: 404 }
        );
      }
      console.error('[API] Campaign PUT error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: campaign,
      message: 'Campaign updated',
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Campaign PUT unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/v1/campaigns/[id] - Archive or schedule permanent deletion
// - If campaign is active/draft/etc → Archive it (soft delete)
// - If campaign is already archived → Schedule permanent deletion (7-day grace)
// =============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: campaignId } = await params;

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // First, fetch the current campaign to check its status (RLS will filter)
    const { data: existing, error: fetchError } = await supabase
      .from('campaigns')
      .select('status, deleted_at')
      .eq('id', campaignId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // If already has deleted_at set, it's pending permanent deletion
    if (existing.deleted_at) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_PENDING', message: 'Campaign is already scheduled for permanent deletion' } },
        { status: 400 }
      );
    }

    // If archived, schedule for permanent deletion (7-day grace period)
    if (existing.status === 'archived') {
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 7);
      
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .update({ 
          deleted_at: deletionDate.toISOString(),
          status: 'pending_deletion'
        })
        .eq('id', campaignId)
        .select()
        .single();

      if (error) {
        console.error('[API] Campaign DELETE (schedule) error:', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: campaign,
        message: 'Campaign scheduled for permanent deletion',
        meta: { 
          timestamp: new Date().toISOString(),
          permanent_deletion_date: deletionDate.toISOString(),
          can_restore_until: deletionDate.toISOString(),
        },
      });
    }

    // Otherwise, archive the campaign (soft delete)
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({ status: 'archived' })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) {
      console.error('[API] Campaign DELETE (archive) error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: campaign,
      message: 'Campaign archived',
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Campaign DELETE unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/v1/campaigns/[id] - Restore campaign from pending deletion
// =============================================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: campaignId } = await params;
    const body = await request.json();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Handle restore action
    if (body.action === 'restore') {
      // Check if campaign is pending deletion (RLS will filter)
      const { data: existing, error: fetchError } = await supabase
        .from('campaigns')
        .select('status, deleted_at')
        .eq('id', campaignId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
            { status: 404 }
          );
        }
        throw fetchError;
      }

      if (!existing.deleted_at && existing.status !== 'pending_deletion' && existing.status !== 'archived') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATE', message: 'Campaign is not archived or pending deletion' } },
          { status: 400 }
        );
      }

      // Determine new status based on current status
      // If pending_deletion -> restore to archived
      // If archived -> restore to draft (unarchive)
      const newStatus = existing.status === 'pending_deletion' ? 'archived' : 'draft';
      const successMessage = existing.status === 'pending_deletion' 
        ? 'Campaign restored from deletion queue' 
        : 'Campaign unarchived to draft';

      // Restore action
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .update({ 
          status: newStatus,
          deleted_at: null 
        })
        .eq('id', campaignId)
        .select()
        .single();

      if (error) {
        console.error('[API] Campaign PATCH (restore) error:', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: error.message } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: campaign,
        message: successMessage,
        meta: { timestamp: new Date().toISOString() },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Unknown action. Supported: restore' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Campaign PATCH unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
