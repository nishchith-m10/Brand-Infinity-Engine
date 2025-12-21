-- =============================================================================
-- Migration: 014_create_variants_table.sql
-- Description: Create variants table for A/B testing support
-- Pillar: Campaign Manager (State & Ledger)
-- =============================================================================

CREATE TABLE IF NOT EXISTS variants (
    variant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    variant_type TEXT NOT NULL, -- 'humorous', 'serious', 'emotional', 'educational'
    brief_id UUID REFERENCES creative_briefs(brief_id),
    script_id UUID REFERENCES scripts(script_id),
    video_id UUID REFERENCES videos(video_id),
    status TEXT DEFAULT 'draft',
    performance_metrics JSONB, -- {total_views, total_likes, total_shares, total_comments, avg_engagement_rate}
    winner BOOLEAN DEFAULT FALSE, -- Mark winning variant after A/B test
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_variants_campaign_id ON variants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_variants_variant_type ON variants(variant_type);
CREATE INDEX IF NOT EXISTS idx_variants_status ON variants(status);
CREATE INDEX IF NOT EXISTS idx_variants_brief_id ON variants(brief_id);
CREATE INDEX IF NOT EXISTS idx_variants_script_id ON variants(script_id);
CREATE INDEX IF NOT EXISTS idx_variants_video_id ON variants(video_id);
CREATE INDEX IF NOT EXISTS idx_variants_winner ON variants(winner);
CREATE INDEX IF NOT EXISTS idx_variants_performance ON variants USING gin(performance_metrics);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_variants_updated_at
    BEFORE UPDATE ON variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check constraints
ALTER TABLE variants 
ADD CONSTRAINT check_status_variant 
CHECK (status IN ('draft', 'in_production', 'completed', 'published'));

-- Comments for documentation
COMMENT ON TABLE variants IS 'Stores campaign variants for A/B testing';
COMMENT ON COLUMN variants.variant_type IS 'Type of variant: humorous, serious, emotional, educational';
COMMENT ON COLUMN variants.performance_metrics IS 'Aggregated performance data from all platforms';
COMMENT ON COLUMN variants.winner IS 'Mark the winning variant after statistical analysis';
