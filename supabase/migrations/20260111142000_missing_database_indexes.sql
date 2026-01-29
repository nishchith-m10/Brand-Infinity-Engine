-- =============================================================================
-- Migration: 20260111142000_missing_database_indexes.sql
-- Description: Add missing composite indexes for frequently queried columns
-- Pillar: Phase III - Pillar 3 (Missing Database Indexes)
-- Date: 2026-01-11
-- Estimated Duration: 2 hours
-- Complexity: Low - repetitive pattern
-- =============================================================================

-- =============================================================================
-- SECTION 1: CONTENT_REQUESTS COMPOSITE INDEXES
-- =============================================================================

-- Index for filtering by status and sorting by created_at (common in Pipeline UI)
-- Use case: "Show me all requests in 'draft' status, ordered by date"
CREATE INDEX IF NOT EXISTS idx_content_requests_status_created 
    ON content_requests(status, created_at DESC);

-- Index for filtering by campaign and status (common in campaign detail views)
-- Use case: "Show me all 'production' requests for this campaign"
CREATE INDEX IF NOT EXISTS idx_content_requests_campaign_status 
    ON content_requests(campaign_id, status);

-- =============================================================================
-- SECTION 2: REQUEST_TASKS COMPOSITE INDEXES
-- =============================================================================

-- Index for filtering tasks by request and status (common in request detail views)
-- Use case: "Show me all 'failed' tasks for this request"
CREATE INDEX IF NOT EXISTS idx_request_tasks_request_status 
    ON request_tasks(request_id, status);

-- =============================================================================
-- SECTION 3: SCRIPTS COMPOSITE INDEXES
-- =============================================================================

-- Index for filtering scripts by brief and approval status
-- Use case: "Show me all 'approved' scripts for this brief"
CREATE INDEX IF NOT EXISTS idx_scripts_brief_approval 
    ON scripts(brief_id, approval_status);

-- =============================================================================
-- SECTION 4: VIDEOS COMPOSITE INDEXES
-- =============================================================================

-- Note: videos table uses 'approval_status' not 'status'
-- The idx_videos_campaign_status already exists from earlier migrations
-- Adding composite index for script_id + approval_status

-- Index for filtering videos by script and approval status
-- Use case: "Show me all 'approved' videos for this script"
CREATE INDEX IF NOT EXISTS idx_videos_script_approval 
    ON videos(script_id, approval_status);

-- =============================================================================
-- SECTION 5: VERIFICATION QUERIES
-- =============================================================================

-- List all newly created indexes
SELECT 
    tablename, 
    indexname, 
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_content_requests_status_created',
    'idx_content_requests_campaign_status',
    'idx_request_tasks_request_status',
    'idx_scripts_brief_approval',
    'idx_videos_script_approval'
  )
ORDER BY tablename, indexname;

-- Display index sizes (should be reasonable, not bloated)
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid::regclass)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexrelid::regclass::text IN (
    'idx_content_requests_status_created',
    'idx_content_requests_campaign_status',
    'idx_request_tasks_request_status',
    'idx_scripts_brief_approval',
    'idx_videos_script_approval'
  )
ORDER BY tablename, indexname;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Summary comments
COMMENT ON INDEX idx_content_requests_status_created IS 'Composite index for filtering by status and sorting by date (Pipeline UI)';
COMMENT ON INDEX idx_content_requests_campaign_status IS 'Composite index for campaign detail views filtering by status';
COMMENT ON INDEX idx_request_tasks_request_status IS 'Composite index for request detail views filtering tasks by status';
COMMENT ON INDEX idx_scripts_brief_approval IS 'Composite index for filtering scripts by brief and approval status';
COMMENT ON INDEX idx_videos_script_approval IS 'Composite index for filtering videos by script and approval status';

SELECT '✅ Pillar III-3: Missing Database Indexes - Migration Complete' AS status;
