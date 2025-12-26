-- =============================================================================
-- URGENT FIX: Brand Assets Upload Migration
-- =============================================================================
-- This migration adds knowledge base support to the brand_knowledge_base table
-- Run this in Supabase SQL Editor to fix the 500 error on asset uploads
-- =============================================================================
-- STEP 1: Create knowledge_bases table if it doesn't exist
-- =============================================================================
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    -- USER-DEFINED FIELDS (Full Customization)
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'folder',
    color VARCHAR(7) DEFAULT '#6366F1',
    tags TEXT [] DEFAULT '{}',
    -- SYSTEM FLAGS
    is_core BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    -- METADATA (Denormalized for performance)
    asset_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
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
-- =============================================================================
-- STEP 2: Add missing columns to brand_knowledge_base table
-- =============================================================================
-- Ensure the table exists first
CREATE TABLE IF NOT EXISTS brand_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add all potentially missing columns
DO $$ BEGIN -- Add file_url if missing
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'brand_knowledge_base'
        AND column_name = 'file_url'
) THEN
ALTER TABLE brand_knowledge_base
ADD COLUMN file_url TEXT;
END IF;
-- Add file_name if missing
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'brand_knowledge_base'
        AND column_name = 'file_name'
) THEN
ALTER TABLE brand_knowledge_base
ADD COLUMN file_name TEXT;
END IF;
-- Add metadata if missing
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'brand_knowledge_base'
        AND column_name = 'metadata'
) THEN
ALTER TABLE brand_knowledge_base
ADD COLUMN metadata JSONB DEFAULT '{}';
END IF;
-- Add is_active if missing
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'brand_knowledge_base'
        AND column_name = 'is_active'
) THEN
ALTER TABLE brand_knowledge_base
ADD COLUMN is_active BOOLEAN DEFAULT true;
END IF;
-- Add asset_type if missing
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'brand_knowledge_base'
        AND column_name = 'asset_type'
) THEN
ALTER TABLE brand_knowledge_base
ADD COLUMN asset_type TEXT DEFAULT 'other';
END IF;
-- Add embedding if missing (for vector search)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'brand_knowledge_base'
        AND column_name = 'embedding'
) THEN
ALTER TABLE brand_knowledge_base
ADD COLUMN embedding VECTOR(1536);
END IF;
-- Add knowledge_base_id if missing (Knowledge Base support)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'brand_knowledge_base'
        AND column_name = 'knowledge_base_id'
) THEN
ALTER TABLE brand_knowledge_base
ADD COLUMN knowledge_base_id UUID;
END IF;
-- Add content_text if missing (for text-based guidelines)
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'brand_knowledge_base'
        AND column_name = 'content_text'
) THEN
ALTER TABLE brand_knowledge_base
ADD COLUMN IF NOT EXISTS knowledge_base_id UUID;
-- Add content_text column for text-based guidelines
ALTER TABLE brand_knowledge_base
ADD COLUMN IF NOT EXISTS content_text TEXT;
-- =============================================================================
-- STEP 3: Create default "Core Brand Identity" KBs for existing brands
-- =============================================================================
-- DISABLED: User prefers to manually create Knowledge Bases
-- INSERT INTO knowledge_bases (
--         brand_id,
--         name,
--         description,
--         icon,
--         color,
--         is_core,
--         is_default
--     )
-- SELECT DISTINCT bkb.brand_id,
--     'Core Brand Identity',
--     'Default knowledge base containing core brand assets',
--     'shield',
--     '#6366F1',
--     TRUE,
--     TRUE
-- FROM brand_knowledge_base bkb
-- WHERE bkb.brand_id IS NOT NULL ON CONFLICT DO NOTHING;
-- =============================================================================
-- STEP 4: Link existing assets to their brand's core KB
-- =============================================================================
UPDATE brand_knowledge_base bkb
SET knowledge_base_id = kb.id
FROM knowledge_bases kb
WHERE bkb.brand_id = kb.brand_id
    AND kb.is_core = TRUE
    AND bkb.knowledge_base_id IS NULL;
-- =============================================================================
-- STEP 5: Add FK constraint to knowledge_bases
-- =============================================================================
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_knowledge_base_id'
        AND table_name = 'brand_knowledge_base'
) THEN
ALTER TABLE brand_knowledge_base
ADD CONSTRAINT fk_knowledge_base_id FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE;
END IF;
END $$;
-- =============================================================================
-- STEP 6: Create index on knowledge_base_id for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_brand_kb_knowledge_base_id ON brand_knowledge_base(knowledge_base_id);
-- =============================================================================
-- STEP 7: Create vector search function that filters by KB IDs
-- =============================================================================
CREATE OR REPLACE FUNCTION match_kb_assets(
        query_embedding VECTOR(1536),
        match_threshold FLOAT,
        match_count INT,
        p_kb_ids UUID [] -- Array of KB IDs to search within
    ) RETURNS TABLE (
        id UUID,
        knowledge_base_id UUID,
        asset_type TEXT,
        file_name TEXT,
        file_url TEXT,
        content_text TEXT,
        metadata JSONB,
        similarity FLOAT
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT bkb.id,
    bkb.knowledge_base_id,
    bkb.asset_type,
    bkb.file_name,
    bkb.file_url,
    bkb.content_text,
    bkb.metadata,
    1 - (bkb.embedding <=> query_embedding) AS similarity
FROM brand_knowledge_base bkb
WHERE bkb.knowledge_base_id = ANY(p_kb_ids)
    AND bkb.is_active = true
    AND bkb.embedding IS NOT NULL
    AND 1 - (bkb.embedding <=> query_embedding) > match_threshold
ORDER BY bkb.embedding <=> query_embedding
LIMIT match_count;
END;
$$;
-- =============================================================================
-- STEP 8: Create trigger to update KB asset count
-- =============================================================================
CREATE OR REPLACE FUNCTION update_kb_asset_count() RETURNS TRIGGER AS $$ BEGIN IF TG_OP = 'INSERT'
    AND NEW.knowledge_base_id IS NOT NULL THEN
UPDATE knowledge_bases
SET asset_count = asset_count + 1
WHERE id = NEW.knowledge_base_id;
ELSIF TG_OP = 'DELETE'
AND OLD.knowledge_base_id IS NOT NULL THEN
UPDATE knowledge_bases
SET asset_count = asset_count - 1
WHERE id = OLD.knowledge_base_id;
ELSIF TG_OP = 'UPDATE' THEN IF OLD.knowledge_base_id IS DISTINCT
FROM NEW.knowledge_base_id THEN IF OLD.knowledge_base_id IS NOT NULL THEN
UPDATE knowledge_bases
SET asset_count = asset_count - 1
WHERE id = OLD.knowledge_base_id;
END IF;
IF NEW.knowledge_base_id IS NOT NULL THEN
UPDATE knowledge_bases
SET asset_count = asset_count + 1
WHERE id = NEW.knowledge_base_id;
END IF;
END IF;
END IF;
RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_update_kb_asset_count ON brand_knowledge_base;
CREATE TRIGGER trigger_update_kb_asset_count
AFTER
INSERT
    OR DELETE
    OR
UPDATE OF knowledge_base_id ON brand_knowledge_base FOR EACH ROW EXECUTE FUNCTION update_kb_asset_count();
-- =============================================================================
-- STEP 9: Update asset counts for existing KBs
-- =============================================================================
UPDATE knowledge_bases kb
SET asset_count = (
        SELECT COUNT(*)
        FROM brand_knowledge_base bkb
        WHERE bkb.knowledge_base_id = kb.id
    );
-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these to verify the migration worked:
-- 1. Check if knowledge_bases table exists and has data
-- SELECT * FROM knowledge_bases ORDER BY created_at DESC LIMIT 5;
-- 2. Check if knowledge_base_id column was added
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'brand_knowledge_base' AND column_name = 'knowledge_base_id';
-- 3. Check if existing assets are linked to KBs
-- SELECT 
--     bkb.id, 
--     bkb.file_name, 
--     bkb.knowledge_base_id,
--     kb.name as kb_name
-- FROM brand_knowledge_base bkb
-- LEFT JOIN knowledge_bases kb ON bkb.knowledge_base_id = kb.id
-- LIMIT 10;
SELECT 'Migration completed successfully! ✓' AS status;