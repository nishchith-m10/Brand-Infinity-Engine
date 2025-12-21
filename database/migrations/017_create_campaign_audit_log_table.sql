-- =============================================================================
-- Migration: 017_create_campaign_audit_log_table.sql
-- Description: Create campaign audit log for tracking all state changes
-- Pillar: Campaign Manager (State & Ledger)
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaign_audit_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'created', 'approved', 'rejected', 'published', 'archived'
    actor UUID, -- User ID who performed the action
    previous_state JSONB,
    new_state JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_campaign_id ON campaign_audit_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON campaign_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON campaign_audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON campaign_audit_log(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE campaign_audit_log IS 'Complete audit trail of all campaign state changes';
COMMENT ON COLUMN campaign_audit_log.action IS 'Type of action performed on the campaign';
COMMENT ON COLUMN campaign_audit_log.actor IS 'User ID who performed the action';
COMMENT ON COLUMN campaign_audit_log.previous_state IS 'JSON snapshot of state before the action';
COMMENT ON COLUMN campaign_audit_log.new_state IS 'JSON snapshot of state after the action';
