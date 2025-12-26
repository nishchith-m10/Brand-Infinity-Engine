import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/campaigns/[id]/progress
 * 
 * Returns the completion status of all workflow steps for a campaign.
 * Used by the frontend to determine which pages are accessible.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Not authenticated' 
          } 
        },
        { status: 401 }
      );
    }

    // Get campaign to access its brand_id and verify ownership
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('brand_id, user_id, metadata')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'NOT_FOUND', 
            message: 'Campaign not found' 
          } 
        },
        { status: 404 }
      );
    }
    
    // Verify ownership (allow if user_id is null for legacy campaigns, or if it matches)
    if (campaign.user_id && campaign.user_id !== user.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'FORBIDDEN', 
            message: 'Access denied to this campaign' 
          } 
        },
        { status: 403 }
      );
    }

    // Check brand identity from brands table
    const { data: brandData } = await supabase
      .from('brands')
      .select('name, brand_voice, target_audience')
      .eq('id', campaign.brand_id)
      .single();
    
    const hasBrandIdentity = !!(
      brandData?.name ||
      brandData?.brand_voice ||
      brandData?.target_audience
    );

    // Check brand assets using the campaign's brand_id (NOT campaignId)
    const { count: assetCount } = await supabase
      .from('brand_knowledge_base')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', campaign.brand_id)
      .eq('is_active', true);

    const hasBrandAssets = (assetCount || 0) > 0;

    // Check content generated (briefs exist)
    const { count: briefCount } = await supabase
      .from('creative_briefs')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    const hasContent = (briefCount || 0) > 0;

    // Check content approved
    const { count: approvedCount } = await supabase
      .from('creative_briefs')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('approval_status', 'approved');

    const hasApprovedContent = (approvedCount || 0) > 0;

    // Check videos ready
    const { count: videoCount } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'completed');

    const hasVideos = (videoCount || 0) > 0;

    // Check variants created
    const { count: variantCount } = await supabase
      .from('variants')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    const hasVariants = (variantCount || 0) > 0;

    // Build steps object
    const steps = {
      brandIdentity: hasBrandIdentity,
      brandAssets: hasBrandAssets,
      contentGenerated: hasContent,
      contentApproved: hasApprovedContent,
      videosReady: hasVideos,
      variantsCreated: hasVariants,
    };

    // Calculate current step (1-indexed)
    let currentStep = 1;
    if (hasBrandIdentity && hasBrandAssets) currentStep = 3; // Ready for Creative Director
    if (hasContent) currentStep = 4; // Ready for Review
    if (hasApprovedContent) currentStep = 5; // Ready for Videos
    if (hasVideos) currentStep = 6; // Ready for Distribution
    if (hasVariants) currentStep = 7; // Ready for Publishing

    // Calculate completion percentage
    const completedSteps = Object.values(steps).filter(Boolean).length;
    const completionPercent = Math.round((completedSteps / 6) * 100);

    return NextResponse.json({
      success: true,
      data: {
        campaignId,
        steps,
        currentStep,
        completionPercent,
      },
    });
  } catch (error) {
    console.error('Error fetching campaign progress:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'PROGRESS_ERROR', 
          message: 'Failed to fetch campaign progress' 
        } 
      },
      { status: 500 }
    );
  }
}
