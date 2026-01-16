/**
 * Scheduled Cleanup Job for Stale Budget Reservations
 * Phase II-2: Budget Race Condition Fix
 * 
 * This edge function is triggered hourly to clean up budget reservations
 * that are older than 1 hour and still in 'reserved' status.
 * 
 * Schedule: Every hour via Supabase cron
 * Purpose: Prevent budget leaks from failed/abandoned operations
 */

// @ts-ignore - Deno standard library import for Supabase Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - ESM import for Supabase Edge Function runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify this is a scheduled/cron invocation or has valid auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader && !req.headers.get('x-supabase-cron')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with service role
    // Prefer process.env (local) else try Deno runtime env. Use globals to avoid TypeScript Deno name errors.
    const supabaseUrl = (typeof process !== 'undefined' && process.env.SUPABASE_URL) || (globalThis as any).Deno?.env?.get('SUPABASE_URL') || '';
    const supabaseServiceKey = (typeof process !== 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) || (globalThis as any).Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the cleanup function
    const { data, error } = await supabase.rpc('cleanup_stale_budget_reservations');

    if (error) {
      console.error('Cleanup RPC error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Cleanup completed:', data);

    return new Response(
      JSON.stringify({
        success: true,
        cleaned_count: data.cleaned_count,
        cleaned_at: data.cleaned_at,
        message: `Successfully cleaned ${data.cleaned_count} stale budget reservations`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
