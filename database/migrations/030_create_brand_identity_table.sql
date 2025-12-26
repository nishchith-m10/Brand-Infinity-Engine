-- =============================================================================
-- Migration: Create brand_identity table
-- Description: Create the brand_identity table for campaign-specific identities
-- Run this BEFORE 031_add_campaign_id_to_brand_identity.sql
-- =============================================================================
-- Create brand_identity table
CREATE TABLE IF NOT EXISTS brand_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    campaign_id UUID NULL,
    -- Identity fields
    brand_name VARCHAR(255),
    brand_voice TEXT,
    tagline TEXT,
    mission_statement TEXT,
    target_audience TEXT,
    brand_personality TEXT,
    tone_style VARCHAR(50),
    communication_style VARCHAR(50),
    personality_traits TEXT [],
    content_pillars TEXT [],
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    accent_color VARCHAR(7),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_brand_identity_brand_id ON brand_identity(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_identity_campaign_id ON brand_identity(campaign_id)
WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brand_identity_brand_campaign ON brand_identity(brand_id, campaign_id);
-- Unique constraint: one identity per brand (when campaign_id is null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_identity_unique_brand ON brand_identity(brand_id)
WHERE campaign_id IS NULL;
-- Unique constraint: one identity per campaign
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_identity_unique_campaign ON brand_identity(campaign_id)
WHERE campaign_id IS NOT NULL;
-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_brand_identity_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_brand_identity_updated_at ON brand_identity;
CREATE TRIGGER trigger_brand_identity_updated_at BEFORE
UPDATE ON brand_identity FOR EACH ROW EXECUTE FUNCTION update_brand_identity_updated_at();
-- Verification
SELECT column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'brand_identity'
ORDER BY ordinal_position;
SELECT 'brand_identity table created successfully! ✓' AS status;