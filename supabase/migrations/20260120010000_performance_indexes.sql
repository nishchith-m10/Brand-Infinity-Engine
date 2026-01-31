-- Migration: Missing Database Indexes
-- Phase III-3: Performance indexes for frequently queried columns
-- From phase_execution_plan.md

-- Performance indexes for content_requests
CREATE INDEX IF NOT EXISTS idx_content_requests_status_created 
  ON content_requests(status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_requests_campaign_status 
  ON content_requests(campaign_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_requests_brand_status 
  ON content_requests(brand_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_requests_user_status
  ON content_requests(user_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Performance indexes for request_tasks
CREATE INDEX IF NOT EXISTS idx_request_tasks_request_status 
  ON request_tasks(request_id, status);

CREATE INDEX IF NOT EXISTS idx_request_tasks_agent_status 
  ON request_tasks(agent_role, status)
  WHERE status != 'completed';

CREATE INDEX IF NOT EXISTS idx_request_tasks_status_sequence 
  ON request_tasks(status, sequence_order)
  WHERE status IN ('pending', 'in_progress');

-- Performance indexes for scripts
CREATE INDEX IF NOT EXISTS idx_scripts_brief_approval 
  ON scripts(brief_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_scripts_status_created 
  ON scripts(status, created_at DESC);

-- Performance indexes for videos
CREATE INDEX IF NOT EXISTS idx_videos_script_status 
  ON videos(script_id, status);

CREATE INDEX IF NOT EXISTS idx_videos_status_created 
  ON videos(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_videos_user_status
  ON videos(user_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Performance indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_user_active 
  ON campaigns(user_id, status)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_campaigns_brand_status
  ON campaigns(brand_id, status)
  WHERE deleted_at IS NULL;

-- Performance indexes for provider_metadata (job tracking)
CREATE INDEX IF NOT EXISTS idx_provider_metadata_request_task 
  ON provider_metadata(request_id, task_id);

CREATE INDEX IF NOT EXISTS idx_provider_metadata_provider_job 
  ON provider_metadata(provider, provider_job_id)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_provider_metadata_status_created 
  ON provider_metadata(status, created_at DESC)
  WHERE status != 'completed';

-- Performance indexes for cost_ledger (budget queries)
CREATE INDEX IF NOT EXISTS idx_cost_ledger_campaign_created 
  ON cost_ledger(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cost_ledger_request_operation 
  ON cost_ledger(request_id, operation_type);

CREATE INDEX IF NOT EXISTS idx_cost_ledger_user_month
  ON cost_ledger(user_id, DATE_TRUNC('month', created_at));

-- Performance indexes for request_events (audit trail)
CREATE INDEX IF NOT EXISTS idx_request_events_request_created 
  ON request_events(request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_events_type_created 
  ON request_events(event_type, created_at DESC);

-- Performance indexes for brand_knowledge_base (KB queries)
CREATE INDEX IF NOT EXISTS idx_brand_kb_brand_deleted 
  ON brand_knowledge_base(brand_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_brand_kb_knowledge_base 
  ON brand_knowledge_base(knowledge_base_id)
  WHERE deleted_at IS NULL;

-- Add BRIN index for timestamp columns on large tables (time-series optimization)
CREATE INDEX IF NOT EXISTS idx_request_events_created_brin 
  ON request_events USING BRIN (created_at)
  WITH (pages_per_range = 128);

CREATE INDEX IF NOT EXISTS idx_cost_ledger_created_brin 
  ON cost_ledger USING BRIN (created_at)
  WITH (pages_per_range = 128);

-- Add comments for documentation
COMMENT ON INDEX idx_content_requests_status_created IS 'Optimizes dashboard queries filtering by status and sorting by creation date';
COMMENT ON INDEX idx_content_requests_campaign_status IS 'Optimizes campaign detail page showing all requests';
COMMENT ON INDEX idx_request_tasks_request_status IS 'Optimizes task queries for request orchestration';
COMMENT ON INDEX idx_scripts_brief_approval IS 'Optimizes script approval workflow queries';
COMMENT ON INDEX idx_videos_script_status IS 'Optimizes video production pipeline queries';
COMMENT ON INDEX idx_provider_metadata_provider_job IS 'Optimizes polling for external provider job status';
COMMENT ON INDEX idx_cost_ledger_campaign_created IS 'Optimizes budget tracking and reporting queries';
COMMENT ON INDEX idx_request_events_request_created IS 'Optimizes audit trail and timeline queries';

-- Analyze tables to update query planner statistics
ANALYZE content_requests;
ANALYZE request_tasks;
ANALYZE scripts;
ANALYZE videos;
ANALYZE campaigns;
ANALYZE provider_metadata;
ANALYZE cost_ledger;
ANALYZE request_events;
ANALYZE brand_knowledge_base;
