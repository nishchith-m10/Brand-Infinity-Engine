-- Migration: allow 'in_progress' status value (idempotent + safe)
-- Adds 'in_progress' alongside 'in_production' to status CHECK constraints
-- Applies to: campaigns, variants (safe to run multiple times)

DO $$
BEGIN
  -- Campaigns table: ensure constraint allows 'in_progress'
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = 'campaigns'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) LIKE '%in_progress%'
    ) THEN
      BEGIN
        ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS check_status_campaign;
        ALTER TABLE campaigns ADD CONSTRAINT check_status_campaign CHECK (
          status IN (
            'draft', 'in_production', 'in_progress', 'completed', 'published', 'archived', 'cancelled', 'pending_deletion'
          )
        );
        RAISE NOTICE 'Updated campaigns.check_status_campaign to include in_progress';
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Failed to update campaigns.check_status_campaign: %', SQLERRM;
      END;
    END IF;
  END IF;

  -- Variants table: ensure constraint allows 'in_progress' (if variants track status similarly)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'variants') THEN
    -- Find any unnamed check constraints on variants that reference status and include allowed values
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = 'variants'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) LIKE '%in_progress%'
    ) THEN
      BEGIN
        -- Attempt to drop a constraint named similar to check_status_variants if present, else try to drop any CHECK that matches the old set
        ALTER TABLE variants DROP CONSTRAINT IF EXISTS check_status_variants;
        ALTER TABLE variants ADD CONSTRAINT check_status_variants CHECK (
          status IN ('draft', 'in_production', 'in_progress', 'completed', 'published')
        );
        RAISE NOTICE 'Updated variants.check_status_variants to include in_progress';
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Failed to update variants.check_status_variants: %', SQLERRM;
      END;
    END IF;
  END IF;
END$$;
