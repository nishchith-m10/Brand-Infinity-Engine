-- =============================================================================
-- Progress Tracking & Timestamp Automation
-- Migration: 20260109000000_progress_tracking_timestamps.sql
-- =============================================================================
-- Purpose: Ensure request_tasks timestamps are automatically managed via triggers
-- for better progress tracking and realtime updates

-- =============================================================================
-- FUNCTION: Auto-update timestamps on task status changes
-- =============================================================================

CREATE OR REPLACE FUNCTION update_task_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Set started_at when task moves to in_progress (only if not already set)
    IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
        IF NEW.started_at IS NULL THEN
            NEW.started_at = NOW();
        END IF;
    END IF;
    
    -- Set completed_at when task reaches terminal status
    IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
        NEW.completed_at = NOW();
    END IF;
    
    -- Clear completed_at if task is retried (moved back from failed to pending/in_progress)
    IF OLD.status = 'failed' AND NEW.status IN ('pending', 'in_progress') THEN
        NEW.completed_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGER: Apply timestamp logic on request_tasks updates
-- =============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_task_timestamps ON request_tasks;

-- Create trigger
CREATE TRIGGER trigger_update_task_timestamps
    BEFORE UPDATE ON request_tasks
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_task_timestamps();

-- =============================================================================
-- INDEXES: Optimize progress queries
-- =============================================================================

-- Composite index for progress queries (status + timestamps)
CREATE INDEX IF NOT EXISTS idx_request_tasks_progress 
    ON request_tasks(request_id, status, started_at, completed_at);

-- Index for realtime filtering (in_progress tasks)
CREATE INDEX IF NOT EXISTS idx_request_tasks_in_progress 
    ON request_tasks(request_id) 
    WHERE status = 'in_progress';

-- Index for completed tasks by completion time
CREATE INDEX IF NOT EXISTS idx_request_tasks_completed_at 
    ON request_tasks(completed_at DESC) 
    WHERE completed_at IS NOT NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION update_task_timestamps() IS 
'Automatically manages started_at and completed_at timestamps on request_tasks based on status changes. Handles retries by clearing completed_at when tasks move from failed to pending/in_progress.';

COMMENT ON TRIGGER trigger_update_task_timestamps ON request_tasks IS
'Ensures task timestamps are atomically updated when status changes, providing accurate progress tracking for realtime UI updates.';

-- =============================================================================
-- VERIFICATION QUERY (run manually to test)
-- =============================================================================

-- Test query to verify trigger works:
-- UPDATE request_tasks SET status = 'in_progress' WHERE id = 'some-task-id';
-- SELECT id, status, started_at, completed_at FROM request_tasks WHERE id = 'some-task-id';
