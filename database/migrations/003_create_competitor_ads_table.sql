-- =============================================================================
-- Migration: 003_create_competitor_ads_table.sql
-- Description: Create competitor ads table for analyzing competitor content
-- Pillar: Strategist (Market Intelligence)
-- =============================================================================

CREATE TABLE IF NOT EXISTS competitor_ads (
    ad_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_name TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'instagram', 'tiktok', 'youtube', 'facebook', etc.
    ad_url TEXT,
    media_url TEXT, -- URL to the actual ad media (image/video)
    ad_type TEXT, -- 'video', 'image', 'carousel', 'story'
    caption TEXT,
    hashtags TEXT[],
    engagement_metrics JSONB, -- {views, likes, shares, comments, engagement_rate}
    detected_at TIMESTAMP DEFAULT NOW(),
    analyzed_at TIMESTAMP,
    patterns JSONB, -- Extracted patterns: hooks, visual_style, call_to_action, etc.
    quality_score NUMERIC(5, 2), -- 0-100 quality rating
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_competitor_ads_competitor ON competitor_ads(competitor_name);
CREATE INDEX IF NOT EXISTS idx_competitor_ads_platform ON competitor_ads(platform);
CREATE INDEX IF NOT EXISTS idx_competitor_ads_detected_at ON competitor_ads(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_ads_quality_score ON competitor_ads(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_ads_is_archived ON competitor_ads(is_archived);
CREATE INDEX IF NOT EXISTS idx_competitor_ads_engagement ON competitor_ads USING gin(engagement_metrics);
CREATE INDEX IF NOT EXISTS idx_competitor_ads_patterns ON competitor_ads USING gin(patterns);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_competitor_ads_updated_at
    BEFORE UPDATE ON competitor_ads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE competitor_ads IS 'Stores competitor ad data for pattern analysis and trend detection';
COMMENT ON COLUMN competitor_ads.engagement_metrics IS 'JSON object with engagement data (views, likes, shares, etc.)';
COMMENT ON COLUMN competitor_ads.patterns IS 'Extracted patterns and insights from the ad';
COMMENT ON COLUMN competitor_ads.quality_score IS 'Algorithmic quality score (0-100) based on engagement and patterns';
