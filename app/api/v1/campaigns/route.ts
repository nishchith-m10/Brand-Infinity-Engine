import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { n8nClient, N8N_WEBHOOKS } from '@/lib/n8n/client';

// =============================================================================
// GET /api/v1/campaigns - List campaigns
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(); // Use RLS-enabled client
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
       return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const brandId = searchParams.get('brand_id');

    // Build query - RLS will automatically filter by user's access rights
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
       throw error;
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
    // Dynamic import to avoid circular dep issues
    const { handleApiError } = await import('@/lib/api-utils');
    return handleApiError(error);
  }
}

// =============================================================================
// POST /api/v1/campaigns - Create campaign
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(); // Use RLS-enabled client
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
       return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate request body using Zod
    const { CreateCampaignSchema } = await import('@/lib/validations/campaign');
    const validatedData = CreateCampaignSchema.parse(body);

    // Determine budget limit based on tier
    // Use simple logic or validated logic
    const budgetLimits: Record<string, number> = {
      low: 50,
      medium: 150,
      high: 500,
      premium: 2000,
    };
    const budgetTier = validatedData.budget_tier || 'medium';
    const budgetLimit = budgetLimits[budgetTier] || 150;

    // Create campaign record
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        campaign_name: validatedData.campaign_name,
        brand_id: validatedData.brand_id,
        user_id: user.id, // Required for RLS policy
        status: 'draft',
        budget_limit_usd: budgetLimit,
        current_cost_usd: 0,
        metadata: {
          target_demographic: validatedData.target_demographic,
          campaign_objective: validatedData.campaign_objective,
          budget_tier: budgetTier,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('[Campaign Create] Supabase error:', JSON.stringify(error, null, 2));
      throw error;
    }

    // Optionally trigger n8n workflow to start strategizing
    let workflowTriggered = false;
    if (validatedData.auto_start) {
      const result = await n8nClient.triggerWorkflow(N8N_WEBHOOKS.STRATEGIST_CAMPAIGN, {
        campaign_id: campaign.campaign_id,
        ...validatedData,
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
    // Dynamic import to avoid circular dep issues if any, though not expected here
    const { handleApiError } = await import('@/lib/api-utils');
    return handleApiError(error);
  }
}
