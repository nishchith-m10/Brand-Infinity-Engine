-- Migration: replace campaigns.check_status_campaign to include 'in_progress' if missing
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def
  FROM pg_constraint
  WHERE conrelid = 'campaigns'::regclass AND conname = 'check_status_campaign';

  IF def IS NOT NULL THEN
    IF def NOT LIKE '%in_progress%' THEN
      BEGIN
        ALTER TABLE campaigns DROP CONSTRAINT check_status_campaign;
        ALTER TABLE campaigns ADD CONSTRAINT check_status_campaign CHECK (
          status IN (
            'draft', 'in_production', 'in_progress', 'active', 'paused', 'completed', 'published', 'archived', 'cancelled', 'failed', 'pending_deletion', 'strategizing', 'writing', 'producing'
          )
        );
        RAISE NOTICE 'Replaced check_status_campaign to include in_progress';
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Failed to replace check_status_campaign: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'check_status_campaign already includes in_progress; no action';
    END IF;
  ELSE
    RAISE NOTICE 'check_status_campaign not present; skipping';
  END IF;
END$$;
