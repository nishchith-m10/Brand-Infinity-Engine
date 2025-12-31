import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { n8nClient, N8N_WEBHOOKS } from '@/lib/n8n/client';
import type { WorkflowAction } from '@/lib/n8n/types';

// Status mapping for each action
const ACTION_STATUS_MAP: Record<WorkflowAction, string> = {
  generate_brief: 'strategizing',
  generate_script: 'writing',
  generate_video: 'producing',
  publish: 'publishing',
  approve: 'approved',
  reject: 'rejected',
};

// Webhook mapping for each action
const ACTION_WEBHOOK_MAP: Record<string, string> = {
  generate_brief: N8N_WEBHOOKS.STRATEGIST_BRIEF,
  generate_script: N8N_WEBHOOKS.COPYWRITER_SCRIPT,
  generate_video: N8N_WEBHOOKS.PRODUCTION_DISPATCH,
  publish: N8N_WEBHOOKS.BROADCASTER_PUBLISH,
  approve: N8N_WEBHOOKS.APPROVAL_HANDLE,
  reject: N8N_WEBHOOKS.APPROVAL_HANDLE,
};

// =============================================================================
// POST /api/v1/campaigns/[id]/trigger - Trigger workflow stage
// =============================================================================
export async function POST(
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

    const action = body.action as WorkflowAction;

    // Validate action
    if (!action || !ACTION_WEBHOOK_MAP[action]) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid action. Valid actions: ${Object.keys(ACTION_WEBHOOK_MAP).join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Get current campaign state (RLS will filter by user access)
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('campaign_id', campaignId)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
        { status: 404 }
      );
    }

    // Build payload based on action
    const basePayload = {
      campaign_id: campaignId,
      brand_id: campaign.brand_id,
    };

    let payload: Record<string, unknown> = basePayload;

    switch (action) {
      case 'generate_brief':
        payload = {
          ...basePayload,
          product_category: body.product_category,
          target_demographic: body.target_demographic,
          campaign_objective: body.campaign_objective,
        };
        break;
      case 'generate_script':
        payload = {
          ...basePayload,
          brief_id: body.brief_id,
          hook_count: body.hook_count || 3,
          variant_tag: body.variant_tag || 'balanced',
          target_duration: body.target_duration || 30,
        };
        break;
      case 'generate_video':
        payload = {
          ...basePayload,
          script_id: body.script_id,
          quality: body.quality || 'standard',
          priority: body.priority || 'balanced',
        };
        break;
      case 'publish':
        payload = {
          ...basePayload,
          video_id: body.video_id,
          variant_id: body.variant_id,
          platforms: body.platforms || ['tiktok'],
          scheduled_time: body.scheduled_time,
        };
        break;
      case 'approve':
      case 'reject':
        payload = {
          ...basePayload,
          entity_type: body.entity_type,
          entity_id: body.entity_id,
          action,
          feedback: body.feedback,
        };
        break;
    }

    // Trigger n8n workflow
    const webhookPath = ACTION_WEBHOOK_MAP[action];
    const result = await n8nClient.triggerWorkflow(webhookPath, payload);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WORKFLOW_ERROR',
            message: 'Failed to trigger workflow',
            details: result.error,
          },
        },
        { status: 503 }
      );
    }

    // Update campaign status
    const newStatus = ACTION_STATUS_MAP[action];
    if (newStatus) {
      await supabase
        .from('campaigns')
        .update({ status: newStatus })
        .eq('campaign_id', campaignId);
    }

    return NextResponse.json({
      success: true,
      message: `${action} workflow triggered`,
      data: {
        campaign_id: campaignId,
        action,
        new_status: newStatus,
        execution_id: result.execution_id,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[API] Campaign trigger unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
