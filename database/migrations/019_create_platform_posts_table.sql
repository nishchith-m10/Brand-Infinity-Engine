-- =============================================================================
-- Migration: 019_create_platform_posts_table.sql
-- Description: Create platform posts table for individual platform publications
-- Pillar: Broadcaster (Distribution & Formatting)
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_posts (
    post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id UUID REFERENCES publications(publication_id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'instagram', 'tiktok', 'youtube', 'linkedin'
    formatted_video_url TEXT NOT NULL,
    platform_post_id TEXT, -- External platform post ID
    caption TEXT,
    hashtags TEXT[],
    aspect_ratio TEXT, -- '9:16', '16:9', '1:1'
    duration_seconds INTEGER,
    thumbnail_url TEXT,
    publication_status TEXT DEFAULT 'scheduled',
    scheduled_time TIMESTAMP,
    published_at TIMESTAMP,
    engagement_metrics JSONB, -- {views, likes, shares, comments, engagement_rate}
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_posts_publication_id ON platform_posts(publication_id);
CREATE INDEX IF NOT EXISTS idx_platform_posts_platform ON platform_posts(platform);
CREATE INDEX IF NOT EXISTS idx_platform_posts_status ON platform_posts(publication_status);
CREATE INDEX IF NOT EXISTS idx_platform_posts_platform_post_id ON platform_posts(platform_post_id);
CREATE INDEX IF NOT EXISTS idx_platform_posts_published_at ON platform_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_posts_engagement ON platform_posts USING gin(engagement_metrics);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_platform_posts_updated_at
    BEFORE UPDATE ON platform_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check constraints
ALTER TABLE platform_posts 
ADD CONSTRAINT check_platform 
CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'linkedin', 'facebook', 'twitter'));

ALTER TABLE platform_posts 
ADD CONSTRAINT check_publication_status_post 
CHECK (publication_status IN ('scheduled', 'publishing', 'published', 'failed'));

ALTER TABLE platform_posts 
ADD CONSTRAINT check_aspect_ratio 
CHECK (aspect_ratio IN ('9:16', '16:9', '1:1', '4:5'));

-- Comments for documentation
COMMENT ON TABLE platform_posts IS 'Individual platform posts for distributed campaigns';
COMMENT ON COLUMN platform_posts.platform_post_id IS 'External platform-specific post identifier';
COMMENT ON COLUMN platform_posts.engagement_metrics IS 'Platform-specific engagement data (views, likes, etc.)';
COMMENT ON COLUMN platform_posts.formatted_video_url IS 'Platform-optimized video URL';
