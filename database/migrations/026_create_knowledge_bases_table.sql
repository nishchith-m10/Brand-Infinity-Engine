-- =============================================================================
-- Migration: 026_create_knowledge_bases_table.sql
-- Description: Multi-knowledge base system for Brand Vault (User-Customizable)
-- Phase: 6 Part I - Stage 1
-- NOTE: brand_id is NOT a FK since brands table doesn't exist - it's just a UUID
-- =============================================================================
-- Create the knowledge_bases table
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    -- No FK constraint - matches existing pattern
    -- USER-DEFINED FIELDS (Full Customization)
    name VARCHAR(100) NOT NULL,
    -- User names their KB anything
    description TEXT,
    -- Optional longer description
    icon VARCHAR(50) DEFAULT 'folder',
    -- Lucide icon name (user selects)
    color VARCHAR(7) DEFAULT '#6366F1',
    -- Hex color for UI (user selects)
    tags TEXT [] DEFAULT '{}',
    -- User-defined tags for organization
    -- SYSTEM FLAGS
    is_core BOOLEAN DEFAULT FALSE,
    -- Only ONE per brand, always included
    is_default BOOLEAN DEFAULT FALSE,
    -- Pre-selected in Creative Director
    is_active BOOLEAN DEFAULT TRUE,
    -- Soft delete
    -- METADATA (Denormalized for performance)
    asset_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    -- Estimated token count
    -- TIMESTAMPS
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);
-- Ensure only ONE core KB per brand
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_bases_core ON knowledge_bases(brand_id)
WHERE is_core = TRUE;
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_brand_id ON knowledge_bases(brand_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_active ON knowledge_bases(is_active)
WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_tags ON knowledge_bases USING GIN(tags);
-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_knowledge_bases_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_knowledge_bases_updated_at ON knowledge_bases;
CREATE TRIGGER trigger_knowledge_bases_updated_at BEFORE
UPDATE ON knowledge_bases FOR EACH ROW EXECUTE FUNCTION update_knowledge_bases_updated_at();
-- Comments
COMMENT ON TABLE knowledge_bases IS 'Container for grouping related brand assets into focused knowledge bases';
COMMENT ON COLUMN knowledge_bases.is_core IS 'If true, this KB is always included in context injection (only one per brand)';
COMMENT ON COLUMN knowledge_bases.is_default IS 'If true, this KB is pre-selected in Creative Director';
COMMENT ON COLUMN knowledge_bases.asset_count IS 'Denormalized count of assets in this KB';
COMMENT ON COLUMN knowledge_bases.tags IS 'User-defined tags for organizing and filtering KBs';