/**
 * Cleanup Stale Budget Reservations
 * Phase II, Pillar 2: Budget Race Condition Fix
 * 
 * This edge function runs periodically to clean up budget reservations
 * that have been stuck in "reserved" state for too long (>2 hours).
 * 
 * Stale reservations can occur when:
 * - Request creation succeeds but orchestrator fails to process
 * - Task execution starts but never completes or fails
 * - System crashes mid-operation
 * 
 * Schedule: Run every hour via Supabase Cron or external scheduler
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

interface CleanupResult {
  success: boolean;
  staleReservationsFound: number;
  budgetReleased: number;
  errors: string[];
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[CleanupJob] Starting stale budget reservations cleanup');

    // 1. Find campaigns with reserved budget > 0 that haven't been updated in 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: staleCampaigns, error: queryError } = await supabase
      .from('campaigns')
      .select('id, budget_reserved, updated_at')
      .gt('budget_reserved', 0)
      .lt('updated_at', twoHoursAgo);

    if (queryError) {
      throw new Error(`Failed to query stale campaigns: ${queryError.message}`);
    }

    if (!staleCampaigns || staleCampaigns.length === 0) {
      console.log('[CleanupJob] No stale reservations found');
      return new Response(
        JSON.stringify({
          success: true,
          staleReservationsFound: 0,
          budgetReleased: 0,
          errors: [],
        } as CleanupResult),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`[CleanupJob] Found ${staleCampaigns.length} campaigns with stale reservations`);

    // 2. For each campaign, check if there are in-progress requests
    //    If no in-progress requests, release the reserved budget
    const errors: string[] = [];
    let totalReleased = 0;
    let campaignsProcessed = 0;

    for (const campaign of staleCampaigns) {
      try {
        // Check for in-progress requests
        const { data: inProgressRequests, error: requestError } = await supabase
          .from('content_requests')
          .select('id, status')
          .eq('campaign_id', campaign.id)
          .in('status', ['intake', 'draft', 'production', 'qa']);

        if (requestError) {
          errors.push(`Campaign ${campaign.id}: Failed to check requests - ${requestError.message}`);
          continue;
        }

        // If there are active requests, skip this campaign (reservation is legitimate)
        if (inProgressRequests && inProgressRequests.length > 0) {
          console.log(`[CleanupJob] Campaign ${campaign.id} has ${inProgressRequests.length} active requests, skipping`);
          continue;
        }

        // No active requests - release the reserved budget
        console.log(`[CleanupJob] Releasing ${campaign.budget_reserved} from campaign ${campaign.id}`);

        const { error: updateError } = await supabase
          .from('campaigns')
          .update({ budget_reserved: 0, updated_at: new Date().toISOString() })
          .eq('id', campaign.id);

        if (updateError) {
          errors.push(`Campaign ${campaign.id}: Failed to release budget - ${updateError.message}`);
          continue;
        }

        totalReleased += campaign.budget_reserved;
        campaignsProcessed++;

        // Log the cleanup action
        await supabase.from('request_events').insert({
          request_id: campaign.id, // Using campaign ID as placeholder
          event_type: 'system_action',
          description: 'Stale budget reservation released by cleanup job',
          metadata: {
            amount_released: campaign.budget_reserved,
            reason: 'No active requests found',
            last_updated: campaign.updated_at,
          },
          actor: 'system:cleanup_job',
        });

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Campaign ${campaign.id}: Unexpected error - ${message}`);
      }
    }

    console.log(`[CleanupJob] Processed ${campaignsProcessed} campaigns, released $${totalReleased.toFixed(2)}`);

    const result: CleanupResult = {
      success: true,
      staleReservationsFound: staleCampaigns.length,
      budgetReleased: totalReleased,
      errors,
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[CleanupJob] Fatal error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({
        success: false,
        staleReservationsFound: 0,
        budgetReleased: 0,
        errors: [errorMessage],
      } as CleanupResult),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
