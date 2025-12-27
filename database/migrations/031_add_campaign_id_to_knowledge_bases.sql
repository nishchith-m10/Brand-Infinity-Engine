-- =============================================================================
-- Migration: Add campaign_id to knowledge_bases table
-- Description: Isolate knowledge bases per campaign
-- =============================================================================
-- Step 1: Add campaign_id column (nullable for backward compatibility)
ALTER TABLE knowledge_bases
ADD COLUMN IF NOT EXISTS campaign_id UUID;
-- Step 2: Add foreign key constraint to campaigns table
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_knowledge_bases_campaign_id'
        AND table_name = 'knowledge_bases'
) THEN
ALTER TABLE knowledge_bases
ADD CONSTRAINT fk_knowledge_bases_campaign_id FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
END IF;
END $$;
-- Step 3: Create index on campaign_id for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_campaign_id ON knowledge_bases(campaign_id)
WHERE campaign_id IS NOT NULL;
-- Step 4: Create composite index for brand_id + campaign_id queries
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_brand_campaign ON knowledge_bases(brand_id, campaign_id);
-- Verification
SELECT column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'knowledge_bases'
    AND column_name = 'campaign_id';
SELECT 'Migration completed successfully! ✓' AS status;