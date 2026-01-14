-- =============================================================================
-- Setup Cron Job for Budget Cleanup
-- Phase II, Pillar 2: Budget Race Condition Fix
-- 
-- Creates a scheduled job to clean up stale budget reservations every hour.
-- Requires pg_cron extension (available in Supabase).
-- =============================================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to clean up stale reservations
-- Runs every hour at :00
SELECT cron.schedule(
  'cleanup-stale-budget-reservations',
  '0 * * * *', -- Every hour on the hour
  $$
  -- Find and clean campaigns with stale reservations (>2 hours old)
  UPDATE campaigns
  SET budget_reserved = 0,
      updated_at = NOW()
  WHERE budget_reserved > 0
    AND updated_at < NOW() - INTERVAL '2 hours'
    AND NOT EXISTS (
      -- Only clean if no active requests
      SELECT 1 FROM content_requests
      WHERE campaign_id = campaigns.id
        AND status IN ('intake', 'draft', 'production', 'qa')
    );
  $$
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'cleanup-stale-budget-reservations';

COMMENT ON EXTENSION pg_cron IS 'Scheduled job execution for database maintenance tasks';

