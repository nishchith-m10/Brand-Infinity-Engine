-- =============================================================================
-- Migration: 004_create_creative_briefs_table.sql
-- Description: Create creative briefs table for storing generated campaign briefs
-- Pillar: Strategist (Market Intelligence)
-- =============================================================================

CREATE TABLE IF NOT EXISTS creative_briefs (
    brief_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    campaign_request JSONB NOT NULL, -- Original request from client
    creative_brief JSONB NOT NULL, -- Generated brief with all fields
    brand_alignment_score NUMERIC(5, 2), -- 0.00-1.00 similarity score
    approval_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'revision_requested'
    approved_by UUID,
    approved_at TIMESTAMP,
    rejected_reason TEXT,
    revision_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    variant_tags TEXT[], -- ['humorous', 'serious', 'emotional']
    metadata JSONB -- Additional tracking data
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_creative_briefs_brand_id ON creative_briefs(brand_id);
CREATE INDEX IF NOT EXISTS idx_creative_briefs_approval_status ON creative_briefs(approval_status);
CREATE INDEX IF NOT EXISTS idx_creative_briefs_created_at ON creative_briefs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creative_briefs_brand_score ON creative_briefs(brand_alignment_score DESC);
CREATE INDEX IF NOT EXISTS idx_creative_briefs_variant_tags ON creative_briefs USING gin(variant_tags);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_creative_briefs_updated_at
    BEFORE UPDATE ON creative_briefs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check constraint for brand alignment score
ALTER TABLE creative_briefs 
ADD CONSTRAINT check_brand_alignment_score 
CHECK (brand_alignment_score >= 0 AND brand_alignment_score <= 1);

-- Check constraint for approval status
ALTER TABLE creative_briefs 
ADD CONSTRAINT check_approval_status 
CHECK (approval_status IN ('pending', 'approved', 'rejected', 'revision_requested'));

-- Comments for documentation
COMMENT ON TABLE creative_briefs IS 'Stores generated creative briefs from the Strategist pillar';
COMMENT ON COLUMN creative_briefs.brand_alignment_score IS 'RAG similarity score for brand guideline alignment (0.00-1.00)';
COMMENT ON COLUMN creative_briefs.creative_brief IS 'Full generated brief JSON with target audience, core message, trends, etc.';
COMMENT ON COLUMN creative_briefs.variant_tags IS 'Array of variant types suggested for A/B testing';
