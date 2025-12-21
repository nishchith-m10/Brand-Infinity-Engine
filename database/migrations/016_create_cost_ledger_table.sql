-- =============================================================================
-- Migration: 016_create_cost_ledger_table.sql
-- Description: Create cost ledger table for detailed cost tracking
-- Pillar: Campaign Manager (State & Ledger)
-- =============================================================================

CREATE TABLE IF NOT EXISTS cost_ledger (
    ledger_entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    variant_id UUID REFERENCES variants(variant_id) ON DELETE SET NULL,
    pillar TEXT NOT NULL, -- 'strategist', 'copywriter', 'production', 'broadcaster'
    cost_type TEXT NOT NULL, -- 'api_cost', 'storage_cost', 'processing_cost'
    amount_usd NUMERIC(10, 2) NOT NULL,
    description TEXT,
    service_provider TEXT, -- 'openai', 'sora', 'elevenlabs', 'aws_s3', etc.
    api_call_details JSONB, -- {model, tokens, duration, etc.}
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cost_ledger_campaign_id ON cost_ledger(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_variant_id ON cost_ledger(variant_id);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_pillar ON cost_ledger(pillar);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_cost_type ON cost_ledger(cost_type);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_created_at ON cost_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_ledger_amount ON cost_ledger(amount_usd DESC);

-- Check constraints
ALTER TABLE cost_ledger 
ADD CONSTRAINT check_pillar 
CHECK (pillar IN ('strategist', 'copywriter', 'production', 'broadcaster', 'storage'));

ALTER TABLE cost_ledger 
ADD CONSTRAINT check_cost_type 
CHECK (cost_type IN ('api_cost', 'storage_cost', 'processing_cost', 'platform_fee'));

ALTER TABLE cost_ledger 
ADD CONSTRAINT check_amount_positive 
CHECK (amount_usd >= 0);

-- Function to update campaign cost
CREATE OR REPLACE FUNCTION update_campaign_cost()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE campaigns 
    SET current_cost_usd = (
        SELECT COALESCE(SUM(amount_usd), 0) 
        FROM cost_ledger 
        WHERE campaign_id = NEW.campaign_id
    )
    WHERE campaign_id = NEW.campaign_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update campaign cost
CREATE TRIGGER update_campaign_cost_trigger
    AFTER INSERT ON cost_ledger
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_cost();

-- Comments for documentation
COMMENT ON TABLE cost_ledger IS 'Detailed cost tracking for all campaign expenses';
COMMENT ON COLUMN cost_ledger.pillar IS 'Which pipeline pillar incurred this cost';
COMMENT ON COLUMN cost_ledger.cost_type IS 'Type of cost: API, storage, or processing';
COMMENT ON COLUMN cost_ledger.service_provider IS 'External service that charged this cost';
