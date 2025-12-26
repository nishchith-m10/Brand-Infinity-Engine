-- =============================================================================
-- Migration: 027_evolve_brand_knowledge_base.sql
-- Description: Add knowledge_base_id to brand_knowledge_base table
-- Phase: 6 Part I - Stage 1
-- IMPORTANT: Run 026_create_knowledge_bases_table.sql first!
-- =============================================================================
-- Step 1: Add new column for KB relationship
ALTER TABLE brand_knowledge_base
ADD COLUMN IF NOT EXISTS knowledge_base_id UUID;
-- Step 2: Add content_text column for text-based guidelines
ALTER TABLE brand_knowledge_base
ADD COLUMN IF NOT EXISTS content_text TEXT;
-- Step 3: Create default "Core Brand Identity" KBs for existing brands
-- This ensures backward compatibility
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
-- Step 4: Link existing assets to their brand's core KB
UPDATE brand_knowledge_base bkb
SET knowledge_base_id = kb.id
FROM knowledge_bases kb
WHERE bkb.brand_id = kb.brand_id
    AND kb.is_core = TRUE
    AND bkb.knowledge_base_id IS NULL;
-- Step 5: Add FK constraint to knowledge_bases
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
-- Step 6: Create index on knowledge_base_id for performance
CREATE INDEX IF NOT EXISTS idx_brand_kb_knowledge_base_id ON brand_knowledge_base(knowledge_base_id);
-- Step 7: Create NEW vector search function that filters by KB IDs
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
-- Step 8: Create trigger to update KB asset count
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
-- Step 9: Update asset counts for existing KBs
UPDATE knowledge_bases kb
SET asset_count = (
        SELECT COUNT(*)
        FROM brand_knowledge_base bkb
        WHERE bkb.knowledge_base_id = kb.id
    );
-- Comments
COMMENT ON COLUMN brand_knowledge_base.knowledge_base_id IS 'References the parent knowledge base';
COMMENT ON COLUMN brand_knowledge_base.content_text IS 'Text content for text-based guidelines (alternative to file)';
COMMENT ON FUNCTION match_kb_assets IS 'Vector search filtered by knowledge base IDs';