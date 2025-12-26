-- =============================================================================
-- Migration: Add campaign_id to brand_identity table
-- Description: Enable campaign-specific brand identities with sharing options
-- =============================================================================
-- Step 1: Add campaign_id column (nullable for brand-level identities)
ALTER TABLE brand_identity
ADD COLUMN IF NOT EXISTS campaign_id UUID;
-- Step 2: Add foreign key constraint to campaigns table
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_brand_identity_campaign_id'
        AND table_name = 'brand_identity'
) THEN
ALTER TABLE brand_identity
ADD CONSTRAINT fk_brand_identity_campaign_id FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
END IF;
END $$;
-- Step 3: Create index on campaign_id for performance
CREATE INDEX IF NOT EXISTS idx_brand_identity_campaign_id ON brand_identity(campaign_id)
WHERE campaign_id IS NOT NULL;
-- Step 4: Create composite index for brand_id + campaign_id queries
CREATE INDEX IF NOT EXISTS idx_brand_identity_brand_campaign ON brand_identity(brand_id, campaign_id);
-- Step 5: Add identity_mode to campaigns table
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'campaigns'
        AND column_name = 'identity_mode'
) THEN
ALTER TABLE campaigns
ADD COLUMN identity_mode VARCHAR(20) DEFAULT 'shared' CHECK (
        identity_mode IN ('isolated', 'shared', 'inherited')
    );
END IF;
END $$;
-- Step 6: Add parent_campaign_id for inherited mode
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'campaigns'
        AND column_name = 'parent_campaign_id'
) THEN
ALTER TABLE campaigns
ADD COLUMN parent_campaign_id UUID;
-- Add FK constraint if it doesn't exist
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_campaigns_parent_campaign'
        AND table_name = 'campaigns'
) THEN
ALTER TABLE campaigns
ADD CONSTRAINT fk_campaigns_parent_campaign FOREIGN KEY (parent_campaign_id) REFERENCES campaigns(id) ON DELETE
SET NULL;
END IF;
END IF;
END $$;
-- Verification
SELECT column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'brand_identity'
    AND column_name IN ('campaign_id', 'brand_id')
ORDER BY column_name;
SELECT column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'campaigns'
    AND column_name IN ('identity_mode', 'parent_campaign_id')
ORDER BY column_name;
SELECT 'Migration completed successfully! ✓' AS status;