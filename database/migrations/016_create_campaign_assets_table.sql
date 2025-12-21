-- =============================================================================
-- Migration: 016_create_campaign_assets_table.sql
-- Description: Create table for storing campaign assets (images, videos, documents)
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaign_assets (
    asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID,
    asset_type TEXT NOT NULL, -- 'image', 'video', 'audio', 'document'
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_url TEXT NOT NULL, -- Public URL or S3 path
    thumbnail_url TEXT, -- For images and videos
    duration_seconds INTEGER, -- For video/audio assets
    dimensions JSONB, -- {width, height} for images/videos
    metadata JSONB, -- Additional asset metadata
    tags TEXT[], -- Searchable tags
    uploaded_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_assets_campaign_id ON campaign_assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_asset_type ON campaign_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_created_at ON campaign_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_tags ON campaign_assets USING GIN(tags);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_campaign_assets_updated_at
    BEFORE UPDATE ON campaign_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check constraints
ALTER TABLE campaign_assets 
ADD CONSTRAINT check_asset_type 
CHECK (asset_type IN ('image', 'video', 'audio', 'document'));

ALTER TABLE campaign_assets 
ADD CONSTRAINT check_file_size_positive 
CHECK (file_size_bytes > 0);

-- Comments for documentation
COMMENT ON TABLE campaign_assets IS 'Stores uploaded assets for campaigns (images, videos, etc.)';
COMMENT ON COLUMN campaign_assets.storage_url IS 'Public URL or cloud storage path to the asset';
COMMENT ON COLUMN campaign_assets.thumbnail_url IS 'Preview thumbnail for images and videos';
COMMENT ON COLUMN campaign_assets.dimensions IS 'JSON with width and height for visual assets';
