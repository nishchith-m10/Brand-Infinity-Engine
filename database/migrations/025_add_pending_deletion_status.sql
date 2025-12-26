-- =============================================================================
-- Migration: add_pending_deletion_status.sql
-- Description: Add 'pending_deletion' to allowed campaign statuses
-- Created: 2025-12-26
-- =============================================================================
-- Drop the existing constraint
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS check_status_campaign;
-- Add the updated constraint with 'pending_deletion' status
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
            'pending_deletion',
            -- Added for soft delete with grace period
            'in_production',
            -- Legacy support
            'strategizing',
            -- Workflow statuses
            'writing',
            'producing'
        )
    );
-- Add deleted_at column if it doesn't exist (for tracking deletion grace period)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
-- Create index on deleted_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at ON campaigns(deleted_at)
WHERE deleted_at IS NOT NULL;
-- Update comments
COMMENT ON COLUMN campaigns.status IS 'Current campaign status: draft, active, paused, completed, archived, pending_deletion, etc.';
COMMENT ON COLUMN campaigns.deleted_at IS 'Timestamp when campaign is scheduled for permanent deletion (NULL = not deleted)';