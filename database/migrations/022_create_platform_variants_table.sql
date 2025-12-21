-- =============================================================================
-- Migration: 022_create_platform_variants_table.sql
-- Description: Create platform_variants table for multi-platform distribution
-- Pillar: Distribution (Pillar 4)
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'tiktok', 'instagram_reels', 'youtube_shorts', etc.
    platform_name TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL, -- '9:16', '16:9', '1:1', '4:5'
    resolution TEXT NOT NULL, -- '1080x1920', '1920x1080', etc.
    duration_seconds INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    caption_enabled BOOLEAN DEFAULT TRUE,
    branding_enabled BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'ready',
    processing_details JSONB, -- Transcoding metadata, conversion info
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_variants_video_id ON platform_variants(video_id);
CREATE INDEX IF NOT EXISTS idx_platform_variants_platform ON platform_variants(platform);
CREATE INDEX IF NOT EXISTS idx_platform_variants_status ON platform_variants(status);
CREATE INDEX IF NOT EXISTS idx_platform_variants_created_at ON platform_variants(created_at);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_platform_variants_updated_at
    BEFORE UPDATE ON platform_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check constraints
ALTER TABLE platform_variants 
ADD CONSTRAINT check_status_platform_variant 
CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'archived'));

ALTER TABLE platform_variants 
ADD CONSTRAINT check_platform_variant 
CHECK (platform IN (
    'tiktok', 'instagram_reels', 'instagram_feed', 
    'youtube_shorts', 'youtube_feed', 
    'facebook_feed', 'linkedin_feed', 'twitter_feed'
));

-- Comments for documentation
COMMENT ON TABLE platform_variants IS 'Stores platform-specific video variants for distribution';
COMMENT ON COLUMN platform_variants.platform IS 'Target platform key (tiktok, instagram_reels, etc.)';
COMMENT ON COLUMN platform_variants.aspect_ratio IS 'Video aspect ratio optimized for platform';
COMMENT ON COLUMN platform_variants.processing_details IS 'Transcoding metadata and conversion information';
