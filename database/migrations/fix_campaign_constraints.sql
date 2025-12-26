-- =============================================================================
-- Migration: fix_campaign_constraints.sql
-- Description: Update check constraints to allow 'active' and 'paused' statuses
-- =============================================================================
-- 1. Drop the existing constraint
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS check_status_campaign;
-- 2. Add the updated constraint with all supported statuses
ALTER TABLE campaigns
ADD CONSTRAINT check_status_campaign CHECK (
        status IN (
            'draft',
            'active',
            'paused',
            'completed',
            'archived',
            'published',
            'cancelled',
            'failed',
            'in_production' -- Legacy support
        )
    );
-- 3. Verify (Optional, prints comments)
COMMENT ON COLUMN campaigns.status IS 'Current campaign status: draft, active, paused, completed, etc.';