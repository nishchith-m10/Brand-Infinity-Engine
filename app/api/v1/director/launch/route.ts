import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBrandContext } from '@/lib/ai/rag';
import { n8nClient } from '@/lib/n8n/client';
import { z } from 'zod';
import { logger } from '@/lib/monitoring/logger';

const LaunchCampaignSchema = z.object({
  parsed_intent: z.object({
    platform: z.string(),
    duration_seconds: z.number().optional(),
    campaign_theme: z.string().optional(),
    tone: z.string().optional(),
    content_type: z.enum(['video', 'image']),
    target_audience: z.string().optional(),
    product: z.string().optional(),
  }),
  brand_id: z.string().uuid().optional(),
  confirmed: z.boolean(),
});

/**
 * POST /api/v1/director/launch
 * Launch a campaign from confirmed parsed intent
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = LaunchCampaignSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false,
          error: { 
            code: 'VALIDATION_ERROR',
            message: 'Validation failed', 
            details: validation.error.issues 
          }
        },
        { status: 400 }
      );
    }

    const { parsed_intent, brand_id, confirmed } = validation.data;

    if (!confirmed) {
      return NextResponse.json({ 
        success: false,
        error: { code: 'CONFIRMATION_REQUIRED', message: 'Confirmation required' } 
      }, { status: 400 });
    }

    // Get brand context for enriched prompt
    let brandContext = null;
    if (brand_id) {
      brandContext = await getBrandContext(
        `${parsed_intent.campaign_theme || ''} ${parsed_intent.product || ''}`,
        brand_id
      );
    }

    // Create campaign in database
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        campaign_name: parsed_intent.campaign_theme || 'New Campaign',
        brand_id: brand_id || null,
        status: parsed_intent.content_type === 'image' ? 'generating_image' : 'strategizing',
        metadata: {
          platform: parsed_intent.platform,
          duration_seconds: parsed_intent.duration_seconds,
          tone: parsed_intent.tone,
          content_type: parsed_intent.content_type,
          target_audience: parsed_intent.target_audience,
          product: parsed_intent.product,
          brand_context: brandContext,
        },
      })
      .select()
      .single();

    if (error) {
      logger.error('DirectorLaunch', 'Campaign creation failed', error);
      return NextResponse.json({ 
        success: false,
        error: { code: 'DB_ERROR', message: error.message } 
      }, { status: 500 });
    }

    // For video content, trigger n8n Strategist workflow
    if (parsed_intent.content_type === 'video') {
      await n8nClient.triggerWorkflow('/strategist/campaign', {
        campaign_id: campaign.campaign_id,
        brand_id: brand_id,
        brand_context: brandContext,
      });
    }
    
    logger.info('DirectorLaunch', 'Campaign launched successfully', { 
      userId: user.id,
      campaignId: campaign.campaign_id,
      contentType: parsed_intent.content_type 
    });

    return NextResponse.json({
      success: true,
      data: {
        campaign_id: campaign.campaign_id,
        status: campaign.status,
        content_type: parsed_intent.content_type,
        brand_context: brandContext,
        next_action: parsed_intent.content_type === 'image' 
          ? 'Call /api/v1/images/generate with campaign_id'
          : 'Strategist workflow triggered',
      },
    });
  } catch (error) {
    logger.error('DirectorLaunch', 'Director launch error', error);
    return NextResponse.json(
      { 
        success: false,
        error: { 
          code: 'LAUNCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to launch campaign' 
        }
      },
      { status: 500 }
    );
  }
}
