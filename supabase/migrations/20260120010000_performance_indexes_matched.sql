-- Migration: Performance Indexes (Matched to existing schema)
-- Purpose: Provide a non-destructive, conditional set of index creations that match the existing
-- schema and naming patterns. This migration is NOT applied automatically by default — it is
-- generated for review and to be applied only after explicit approval.

BEGIN;

-- Only create an index if the underlying columns exist and the index name doesn't already exist.

-- content_requests: status + created_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='content_requests' AND column_name='status')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='content_requests' AND indexname='idx_content_requests_status_created') THEN
    EXECUTE 'CREATE INDEX idx_content_requests_status_created ON public.content_requests(status, created_at DESC)';
  END IF;
END
$$;

-- request_tasks: request_id + status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='request_tasks' AND column_name='request_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='request_tasks' AND column_name='status')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='request_tasks' AND indexname='idx_request_tasks_request_status') THEN
    EXECUTE 'CREATE INDEX idx_request_tasks_request_status ON public.request_tasks(request_id, status)';
  END IF;
END
$$;

-- scripts: brief_id + approval_status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='scripts' AND column_name='brief_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='scripts' AND column_name='approval_status')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='scripts' AND indexname='idx_scripts_brief_approval') THEN
    EXECUTE 'CREATE INDEX idx_scripts_brief_approval ON public.scripts(brief_id, approval_status)';
  END IF;
END
$$;

-- videos: script_id + approval_status (or status) and campaign_id if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videos' AND column_name='script_id')
     AND (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videos' AND column_name='approval_status') OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videos' AND column_name='status'))
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='videos' AND indexname='idx_videos_script_status_or_approval') THEN
    -- Use approval_status if present else status
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videos' AND column_name='approval_status') THEN
      EXECUTE 'CREATE INDEX idx_videos_script_status_or_approval ON public.videos(script_id, approval_status)';
    ELSE
      EXECUTE 'CREATE INDEX idx_videos_script_status_or_approval ON public.videos(script_id, status)';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videos' AND column_name='campaign_id')
     AND (EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videos' AND column_name='approval_status') OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videos' AND column_name='status'))
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='videos' AND indexname='idx_videos_campaign_status_or_approval') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videos' AND column_name='approval_status') THEN
      EXECUTE 'CREATE INDEX idx_videos_campaign_status_or_approval ON public.videos(campaign_id, approval_status, created_at DESC)';
    ELSE
      EXECUTE 'CREATE INDEX idx_videos_campaign_status_or_approval ON public.videos(campaign_id, status, created_at DESC)';
    END IF;
  END IF;
END
$$;

-- provider_metadata: request_task_id, external_job_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='provider_metadata' AND column_name='request_task_id')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='provider_metadata' AND indexname='idx_provider_metadata_request_task') THEN
    EXECUTE 'CREATE INDEX idx_provider_metadata_request_task ON public.provider_metadata(request_task_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='provider_metadata' AND column_name='external_job_id')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='provider_metadata' AND indexname='idx_provider_metadata_external_job') THEN
    EXECUTE 'CREATE INDEX idx_provider_metadata_external_job ON public.provider_metadata(external_job_id)';
  END IF;
END
$$;

-- budget_reservations: safe to create if table exists (but likely already present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='budget_reservations') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='budget_reservations' AND indexname='idx_budget_reservations_campaign_status') THEN
      EXECUTE 'CREATE INDEX idx_budget_reservations_campaign_status ON public.budget_reservations(campaign_id, status) WHERE status = ''reserved''';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='budget_reservations' AND indexname='idx_budget_reservations_request') THEN
      EXECUTE 'CREATE INDEX idx_budget_reservations_request ON public.budget_reservations(request_id)';
    END IF;
  END IF;
END
$$;

COMMIT;

-- NOTE: This migration file is provided for review. Do NOT apply it until you confirm.
-- It is conservative and checks for column and index existence before creating indexes.