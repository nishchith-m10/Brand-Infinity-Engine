import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/brand-identity
 * Fetch brand identity for the current user's brand or campaign
 * Supports campaign isolation with flexible sharing modes
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const campaignId = searchParams.get('campaign_id');

    // If campaign_id is provided, check campaign's identity_mode
    if (campaignId) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, identity_mode, parent_campaign_id')
        .eq('id', campaignId)
        .single();

      if (campaign) {
        // ISOLATED MODE: Campaign has its own identity
        if (campaign.identity_mode === 'isolated') {
          const { data: campaignIdentity } = await supabase
            .from('brand_identity')
            .select('*')
            .eq('campaign_id', campaignId)
            .single();

          if (campaignIdentity) {
            return NextResponse.json({
              success: true,
              data: campaignIdentity,
              meta: { source: 'campaign', mode: 'isolated' },
            });
          }
        }

        // INHERITED MODE: Use identity from parent campaign
        if (campaign.identity_mode === 'inherited' && campaign.parent_campaign_id) {
          const { data: parentIdentity } = await supabase
            .from('brand_identity')
            .select('*')
            .eq('campaign_id', campaign.parent_campaign_id)
            .single();

          if (parentIdentity) {
            return NextResponse.json({
              success: true,
              data: parentIdentity,
              meta: { source: 'parent_campaign', mode: 'inherited' },
            });
          }
        }

        // SHARED MODE (or fallback): Use brand-level identity
        // Falls through to brand-level query below
      }
    }

    // Get brand-level identity (for shared mode or no campaign)
    const { data: brandIdentity } = await supabase
      .from('brand_identity')
      .select('*')
      .eq('brand_id', user.id)
      .is('campaign_id', null)
      .single();

    if (brandIdentity) {
      return NextResponse.json({
        success: true,
        data: brandIdentity,
        meta: { source: 'brand', mode: 'shared' },
      });
    }

    // No identity found - return empty default
    return NextResponse.json({
      success: true,
      data: null,
      meta: { source: 'none', mode: 'default' },
    });
  } catch (error: any) {
    console.error('[API] Brand identity GET error:', error.message);
    return NextResponse.json({
      success: true,
      data: null,
      meta: { source: 'error', mode: 'default' },
    });
  }
}

/**
 * PUT /api/v1/brand-identity
 * Save/update brand identity for brand or campaign
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { campaign_id, ...identityData } = body;

    // Check if we're saving campaign-specific or brand-level identity
    if (campaign_id) {
      // Campaign-specific identity - check if it exists
      const { data: existing } = await supabase
        .from('brand_identity')
        .select('id')
        .eq('campaign_id', campaign_id)
        .single();

      if (existing) {
        // Update existing campaign identity
        const { data, error } = await supabase
          .from('brand_identity')
          .update({
            ...identityData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data,
          message: 'Campaign identity updated',
        });
      } else {
        // Create new campaign identity
        const { data, error } = await supabase
          .from('brand_identity')
          .insert({
            ...identityData,
            brand_id: user.id,
            campaign_id,
          })
         .select()
          .single();

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data,
          message: 'Campaign identity created',
        });
      }
    } else {
      // Brand-level identity
      const { data: existing } = await supabase
        .from('brand_identity')
        .select('id')
        .eq('brand_id', user.id)
        .is('campaign_id', null)
        .single();

      if (existing) {
        // Update existing brand identity
        const { data, error } = await supabase
          .from('brand_identity')
          .update({
            ...identityData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data,
          message: 'Brand identity updated',
        });
      } else {
        // Create new brand identity
        const { data, error } = await supabase
          .from('brand_identity')
          .insert({
            ...identityData,
            brand_id: user.id,
            campaign_id: null,
          })
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data,
          message: 'Brand identity created',
        });
      }
    }
  } catch (error) {
    console.error('[API] Brand identity PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save brand identity' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/brand-identity
 * Alias for PUT method for backward compatibility
 */
export async function POST(request: NextRequest) {
  return PUT(request);
}
