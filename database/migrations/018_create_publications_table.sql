-- =============================================================================
-- Migration: 018_create_publications_table.sql
-- Description: Create publications table for tracking distribution packages
-- Pillar: Broadcaster (Distribution & Formatting)
-- =============================================================================

CREATE TABLE IF NOT EXISTS publications (
    publication_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    variant_id UUID REFERENCES variants(variant_id) ON DELETE CASCADE,
    publication_status TEXT DEFAULT 'scheduled', -- 'scheduled', 'publishing', 'published', 'failed'
    total_platforms INTEGER DEFAULT 0,
    successful_platforms INTEGER DEFAULT 0,
    failed_platforms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_publications_campaign_id ON publications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_publications_variant_id ON publications(variant_id);
CREATE INDEX IF NOT EXISTS idx_publications_status ON publications(publication_status);
CREATE INDEX IF NOT EXISTS idx_publications_created_at ON publications(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_publications_updated_at
    BEFORE UPDATE ON publications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check constraints
ALTER TABLE publications 
ADD CONSTRAINT check_publication_status 
CHECK (publication_status IN ('scheduled', 'publishing', 'published', 'failed', 'cancelled'));

-- Comments for documentation
COMMENT ON TABLE publications IS 'Tracks multi-platform publication packages';
COMMENT ON COLUMN publications.total_platforms IS 'Number of platforms targeted for this publication';
COMMENT ON COLUMN publications.successful_platforms IS 'Number of platforms successfully published to';
COMMENT ON COLUMN publications.failed_platforms IS 'Number of platforms that failed to publish';
