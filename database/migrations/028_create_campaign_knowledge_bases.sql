-- =============================================================================
-- Migration: 028_create_campaign_knowledge_bases.sql
-- Description: Junction table for campaign-KB associations
-- Phase: 6 Part I - Stage 1
-- NOTE: This migration is OPTIONAL - only run if you have campaigns
-- =============================================================================
-- Check if campaigns table exists and create junction table
DO $$ BEGIN -- Only create if campaigns table exists
IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'campaigns'
) THEN -- Create junction table for campaigns to knowledge bases
CREATE TABLE IF NOT EXISTS campaign_knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    -- Flags
    is_pinned BOOLEAN DEFAULT FALSE,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique constraint
    CONSTRAINT unique_campaign_kb UNIQUE(campaign_id, knowledge_base_id)
);
-- Try to add FK to campaigns - may fail if column name differs
BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_campaign_kb_campaign'
        AND table_name = 'campaign_knowledge_bases'
) THEN -- Try campaign_id first (our schema)
IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'campaigns'
        AND column_name = 'campaign_id'
) THEN
ALTER TABLE campaign_knowledge_bases
ADD CONSTRAINT fk_campaign_kb_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE;
-- Try id if campaign_id doesn't exist
ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'campaigns'
        AND column_name = 'id'
) THEN
ALTER TABLE campaign_knowledge_bases
ADD CONSTRAINT fk_campaign_kb_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
END IF;
END IF;
EXCEPTION
WHEN OTHERS THEN RAISE NOTICE 'Could not add FK constraint to campaigns: %',
SQLERRM;
END;
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaign_kbs_campaign ON campaign_knowledge_bases(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_kbs_kb ON campaign_knowledge_bases(knowledge_base_id);
RAISE NOTICE 'campaign_knowledge_bases table created successfully';
ELSE RAISE NOTICE 'Skipping campaign_knowledge_bases - campaigns table does not exist';
END IF;
END $$;
-- Comment (only if table exists)
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'campaign_knowledge_bases'
) THEN COMMENT ON TABLE campaign_knowledge_bases IS 'Associates campaigns with knowledge bases for quick access';
END IF;
END $$;