-- =============================================================================
-- Migration: 015_create_assets_table.sql
-- Description: Create assets table for centralized asset registry
-- Pillar: Campaign Manager (State & Ledger)
-- =============================================================================

CREATE TABLE IF NOT EXISTS assets (
    asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID REFERENCES variants(variant_id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL, -- 'brief', 'script', 'video', 'audio', 'thumbnail'
    asset_url TEXT,
    asset_metadata JSONB,
    file_size_bytes BIGINT,
    mime_type TEXT,
    storage_tier TEXT DEFAULT 'hot', -- 'hot', 'warm', 'cold'
    created_at TIMESTAMP DEFAULT NOW(),
    archived_at TIMESTAMP,
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assets_variant_id ON assets(variant_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_storage_tier ON assets(storage_tier);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at DESC);

-- Check constraints
ALTER TABLE assets 
ADD CONSTRAINT check_asset_type 
CHECK (asset_type IN ('brief', 'script', 'video', 'audio', 'thumbnail', 'formatted_video'));

ALTER TABLE assets 
ADD CONSTRAINT check_storage_tier 
CHECK (storage_tier IN ('hot', 'warm', 'cold'));

ALTER TABLE assets 
ADD CONSTRAINT check_file_size_positive 
CHECK (file_size_bytes >= 0);

-- Comments for documentation
COMMENT ON TABLE assets IS 'Centralized registry of all campaign assets';
COMMENT ON COLUMN assets.storage_tier IS 'Storage tier: hot (<30 days), warm (30-90 days), cold (>90 days)';
COMMENT ON COLUMN assets.asset_metadata IS 'JSON metadata specific to the asset type';
