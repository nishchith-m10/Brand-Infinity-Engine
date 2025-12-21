-- =============================================================================
-- Migration: 001_create_trends_table.sql
-- Description: Create trends table for tracking trending topics and content
-- Pillar: Strategist (Market Intelligence)
-- =============================================================================

CREATE TABLE IF NOT EXISTS trends (
    trend_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    source TEXT NOT NULL, -- 'tiktok', 'instagram', 'twitter', 'news', etc.
    detected_at TIMESTAMP DEFAULT NOW(),
    engagement_score NUMERIC(10, 2), -- Normalized score 0-100
    category TEXT, -- 'product', 'lifestyle', 'technology', etc.
    metadata JSONB, -- Additional trend data (hashtags, mentions, etc.)
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trends_detected_at ON trends(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_trends_source ON trends(source);
CREATE INDEX IF NOT EXISTS idx_trends_category ON trends(category);
CREATE INDEX IF NOT EXISTS idx_trends_engagement_score ON trends(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_trends_is_active ON trends(is_active);
CREATE INDEX IF NOT EXISTS idx_trends_metadata ON trends USING gin(metadata);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_trends_updated_at
    BEFORE UPDATE ON trends
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE trends IS 'Stores trending topics and content patterns from various sources';
COMMENT ON COLUMN trends.trend_id IS 'Unique identifier for the trend';
COMMENT ON COLUMN trends.topic IS 'The trending topic or keyword';
COMMENT ON COLUMN trends.source IS 'Source platform where trend was detected';
COMMENT ON COLUMN trends.engagement_score IS 'Normalized engagement score (0-100)';
COMMENT ON COLUMN trends.metadata IS 'Additional JSON data about the trend';
