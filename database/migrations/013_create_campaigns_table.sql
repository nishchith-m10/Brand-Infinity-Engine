-- =============================================================================
-- Migration: 013_create_campaigns_table.sql
-- Description: Create campaigns table for managing campaign state
-- Pillar: Campaign Manager (State & Ledger)
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name TEXT NOT NULL,
    brand_id UUID NOT NULL,
    status TEXT DEFAULT 'draft', -- 'draft', 'in_production', 'completed', 'published', 'archived'
    budget_limit_usd NUMERIC(10, 2),
    current_cost_usd NUMERIC(10, 2) DEFAULT 0,
    budget_alert_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    completed_at TIMESTAMP,
    published_at TIMESTAMP,
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_id ON campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_budget ON campaigns(current_cost_usd DESC);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check constraints
ALTER TABLE campaigns 
ADD CONSTRAINT check_status_campaign 
CHECK (status IN ('draft', 'in_production', 'completed', 'published', 'archived', 'cancelled'));

ALTER TABLE campaigns 
ADD CONSTRAINT check_budget_positive 
CHECK (budget_limit_usd >= 0 AND current_cost_usd >= 0);

-- Comments for documentation
COMMENT ON TABLE campaigns IS 'Master table for campaign lifecycle management';
COMMENT ON COLUMN campaigns.status IS 'Current campaign status in the pipeline';
COMMENT ON COLUMN campaigns.current_cost_usd IS 'Running total of costs across all pillars';
COMMENT ON COLUMN campaigns.budget_limit_usd IS 'Maximum budget allowed for this campaign';
