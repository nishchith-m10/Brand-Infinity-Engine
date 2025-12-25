import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// GET /api/v1/campaigns/[id] - Get single campaign with related data
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: campaignId } = await params;

    // Fetch campaign with related data
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        creative_briefs (*),
        scripts (*),
        generation_jobs (*)
      `)
      .eq('campaign_id', campaignId)
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
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
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
    const supabase = createAdminClient();
    const { id: campaignId } = await params;
    const body = await request.json();

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

    // Update campaign
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('campaign_id', campaignId)
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
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
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
// DELETE /api/v1/campaigns/[id] - Archive campaign (soft delete)
// =============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id: campaignId } = await params;

    // Soft delete by updating status to 'archived'
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({ status: 'archived' })
      .eq('campaign_id', campaignId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
          { status: 404 }
        );
      }
      console.error('[API] Campaign DELETE error:', error);
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
