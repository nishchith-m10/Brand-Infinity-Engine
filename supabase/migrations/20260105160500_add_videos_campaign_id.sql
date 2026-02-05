-- =============================================================================
-- Migration: 20260105160500_add_videos_campaign_id.sql
-- Description: Add nullable campaign_id to videos and safe FK/index if possible
-- Created: 2026-01-05
-- =============================================================================

-- Add campaign_id column (nullable, non-destructive)
ALTER TABLE videos ADD COLUMN IF NOT EXISTS campaign_id UUID;

-- Add index if column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'videos' AND column_name = 'campaign_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_videos_campaign_id ON videos(campaign_id);
    END IF;
END $$;

-- Add foreign key constraint only if it is safe (no orphaned values)
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'videos' AND column_name = 'campaign_id'
    ) THEN
        SELECT COUNT(*) INTO orphan_count
        FROM videos v
        WHERE v.campaign_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id = v.campaign_id);

        IF orphan_count = 0 THEN
            ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_campaign_id_fkey;
            ALTER TABLE videos
            ADD CONSTRAINT videos_campaign_id_fkey
            FOREIGN KEY (campaign_id)
            REFERENCES campaigns(id)
            ON DELETE CASCADE;
        ELSE
            RAISE NOTICE 'Skipping adding FK constraint: % orphaned videos.campaign_id values found', orphan_count;
        END IF;
    END IF;
END $$;

-- Add comment documenting purpose
COMMENT ON COLUMN videos.campaign_id IS 'Optional link to owning campaign (nullable for legacy records)';

SELECT '✓ Add videos.campaign_id migration executed (non-destructive checks applied)' AS status;
