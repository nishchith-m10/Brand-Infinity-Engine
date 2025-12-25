import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { n8nClient, N8N_WEBHOOKS } from '@/lib/n8n/client';

// =============================================================================
// GET /api/v1/campaigns - List campaigns
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const brandId = searchParams.get('brand_id');

    // Build query
    let query = supabase
      .from('campaigns')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (brandId) {
      query = query.eq('brand_id', brandId);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[API] Campaigns GET error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        count: count || 0,
        limit,
        offset,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Campaigns GET unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/v1/campaigns - Create campaign
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    // Basic validation
    if (!body.campaign_name || !body.brand_id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'campaign_name and brand_id are required' } },
        { status: 400 }
      );
    }

    // Determine budget limit based on tier
    const budgetLimits: Record<string, number> = {
      low: 50,
      medium: 150,
      high: 500,
      premium: 2000,
    };
    const budgetTier = body.budget_tier || 'medium';
    const budgetLimit = budgetLimits[budgetTier] || 150;

    // Create campaign record
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        campaign_name: body.campaign_name,
        brand_id: body.brand_id,
        status: 'draft',
        budget_limit_usd: budgetLimit,
        current_cost_usd: 0,
        metadata: {
          target_demographic: body.target_demographic,
          campaign_objective: body.campaign_objective,
          budget_tier: budgetTier,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Campaigns POST error:', error);
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    // Optionally trigger n8n workflow to start strategizing
    let workflowTriggered = false;
    if (body.auto_start) {
      const result = await n8nClient.triggerWorkflow(N8N_WEBHOOKS.STRATEGIST_CAMPAIGN, {
        campaign_id: campaign.campaign_id,
        brand_id: campaign.brand_id,
        campaign_name: campaign.campaign_name,
        ...body,
      });
      workflowTriggered = result.success;

      // Update status if workflow triggered
      if (workflowTriggered) {
        await supabase
          .from('campaigns')
          .update({ status: 'strategizing' })
          .eq('campaign_id', campaign.campaign_id);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: campaign,
        message: workflowTriggered
          ? 'Campaign created and workflow started'
          : 'Campaign created',
        meta: {
          workflow_triggered: workflowTriggered,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Campaigns POST unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
