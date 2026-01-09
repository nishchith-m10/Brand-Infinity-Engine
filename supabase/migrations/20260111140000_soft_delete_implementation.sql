-- =============================================================================
-- Migration: 20260111140000_soft_delete_implementation.sql
-- Description: Phase III, Pillar 2 - Implement soft delete for data recovery
-- Created: 2026-01-11
-- Reference: docs/plans/phase_execution_plan.md Section Pillar III-2
-- 
-- IMPLEMENTATION:
--   1. Add deleted_at columns to major tables (where missing)
--   2. Update RLS policies to filter deleted records
--   3. Create helper functions for soft delete operations
--   4. Add indexes for soft delete queries
--   5. Create undelete capability for recovery
-- 
-- TABLES AFFECTED:
--   - content_requests (NEW)
--   - request_tasks (NEW)
--   - request_events (NEW)
--   - scripts (NEW)
--   - creative_briefs (NEW)
--   - user_provider_keys (NEW)
--   - conversation_sessions (NEW)
--   - conversation_messages (NEW)
--   - campaigns (ALREADY HAS - update policies)
--   - videos (ALREADY HAS - update policies)
--   - knowledge_bases (ALREADY HAS - update policies)
--   - brand_knowledge_base (ALREADY HAS - update policies)
-- =============================================================================

-- =============================================================================
-- SECTION 1: ADD DELETED_AT COLUMNS
-- =============================================================================

-- Add deleted_at to content_requests
ALTER TABLE content_requests 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN content_requests.deleted_at 
IS 'Timestamp when request was soft-deleted (NULL = active). Soft deletes allow data recovery.';

-- Add deleted_at to request_tasks
ALTER TABLE request_tasks 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN request_tasks.deleted_at 
IS 'Timestamp when task was soft-deleted (NULL = active)';

-- Add deleted_at to request_events
ALTER TABLE request_events 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN request_events.deleted_at 
IS 'Timestamp when event was soft-deleted (NULL = active)';

-- Add deleted_at to scripts
ALTER TABLE scripts 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN scripts.deleted_at 
IS 'Timestamp when script was soft-deleted (NULL = active)';

-- Add deleted_at to creative_briefs
ALTER TABLE creative_briefs 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN creative_briefs.deleted_at 
IS 'Timestamp when brief was soft-deleted (NULL = active)';

-- Add deleted_at to user_provider_keys
ALTER TABLE user_provider_keys 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN user_provider_keys.deleted_at 
IS 'Timestamp when provider key was soft-deleted (NULL = active)';

-- Add deleted_at to conversation_sessions
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN conversation_sessions.deleted_at 
IS 'Timestamp when session was soft-deleted (NULL = active)';

-- Add deleted_at to conversation_messages
ALTER TABLE conversation_messages 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN conversation_messages.deleted_at 
IS 'Timestamp when message was soft-deleted (NULL = active)';

-- =============================================================================
-- SECTION 2: CREATE SOFT DELETE HELPER FUNCTIONS
-- =============================================================================

-- Soft delete function for any table
CREATE OR REPLACE FUNCTION soft_delete(
  p_table_name TEXT,
  p_id_column TEXT,
  p_id_value TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_query TEXT;
  v_result BOOLEAN;
BEGIN
  -- Validate table has deleted_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = p_table_name 
    AND column_name = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'Table % does not have deleted_at column', p_table_name;
  END IF;

  -- Build and execute soft delete query
  v_query := format(
    'UPDATE %I SET deleted_at = NOW() WHERE %I = %L AND deleted_at IS NULL RETURNING TRUE',
    p_table_name,
    p_id_column,
    p_id_value
  );
  
  EXECUTE v_query INTO v_result;
  
  RETURN COALESCE(v_result, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION soft_delete IS 'Generic soft delete function - sets deleted_at to NOW()';

-- Undelete function for data recovery
CREATE OR REPLACE FUNCTION undelete(
  p_table_name TEXT,
  p_id_column TEXT,
  p_id_value TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_query TEXT;
  v_result BOOLEAN;
BEGIN
  -- Validate table has deleted_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = p_table_name 
    AND column_name = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'Table % does not have deleted_at column', p_table_name;
  END IF;

  -- Build and execute undelete query
  v_query := format(
    'UPDATE %I SET deleted_at = NULL WHERE %I = %L AND deleted_at IS NOT NULL RETURNING TRUE',
    p_table_name,
    p_id_column,
    p_id_value
  );
  
  EXECUTE v_query INTO v_result;
  
  RETURN COALESCE(v_result, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION undelete IS 'Generic undelete function - clears deleted_at for recovery';

-- Permanently delete old soft-deleted records (cleanup job)
CREATE OR REPLACE FUNCTION hard_delete_old_soft_deleted(
  p_table_name TEXT,
  p_days_old INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
  v_query TEXT;
  v_deleted_count INTEGER;
BEGIN
  -- Validate table has deleted_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = p_table_name 
    AND column_name = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'Table % does not have deleted_at column', p_table_name;
  END IF;

  -- Build and execute hard delete query
  v_query := format(
    'DELETE FROM %I WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL ''%s days''',
    p_table_name,
    p_days_old
  );
  
  EXECUTE v_query;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION hard_delete_old_soft_deleted IS 'Permanently delete soft-deleted records older than X days';

-- =============================================================================
-- SECTION 3: CREATE INDEXES FOR SOFT DELETE QUERIES
-- =============================================================================

-- Index for content_requests soft delete queries
CREATE INDEX IF NOT EXISTS idx_content_requests_deleted_at 
ON content_requests(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Index for request_tasks soft delete queries
CREATE INDEX IF NOT EXISTS idx_request_tasks_deleted_at 
ON request_tasks(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Index for request_events soft delete queries
CREATE INDEX IF NOT EXISTS idx_request_events_deleted_at 
ON request_events(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Index for scripts soft delete queries
CREATE INDEX IF NOT EXISTS idx_scripts_deleted_at 
ON scripts(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Index for creative_briefs soft delete queries
CREATE INDEX IF NOT EXISTS idx_creative_briefs_deleted_at 
ON creative_briefs(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Index for user_provider_keys soft delete queries
CREATE INDEX IF NOT EXISTS idx_user_provider_keys_deleted_at 
ON user_provider_keys(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Index for conversation_sessions soft delete queries
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_deleted_at 
ON conversation_sessions(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- Index for conversation_messages soft delete queries
CREATE INDEX IF NOT EXISTS idx_conversation_messages_deleted_at 
ON conversation_messages(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- =============================================================================
-- SECTION 4: UPDATE RLS POLICIES TO FILTER DELETED RECORDS
-- =============================================================================

-- ============================================================
-- CONTENT_REQUESTS - Update existing policies
-- ============================================================

-- Drop and recreate SELECT policy to exclude deleted records
DROP POLICY IF EXISTS content_requests_select_policy ON content_requests;
CREATE POLICY content_requests_select_policy ON content_requests
    FOR SELECT
    USING (
        deleted_at IS NULL AND
        brand_id IN (
            SELECT id FROM brands WHERE owner_id = auth.uid()
        )
    );

-- ============================================================
-- REQUEST_TASKS - Update existing policies
-- ============================================================

-- Drop and recreate SELECT policy to exclude deleted records
DROP POLICY IF EXISTS request_tasks_select_policy ON request_tasks;
CREATE POLICY request_tasks_select_policy ON request_tasks
    FOR SELECT
    USING (
        deleted_at IS NULL AND
        request_id IN (
            SELECT id FROM content_requests
            WHERE brand_id IN (
                SELECT id FROM brands WHERE owner_id = auth.uid()
            )
            AND deleted_at IS NULL
        )
    );

-- ============================================================
-- REQUEST_EVENTS - Update existing policies
-- ============================================================

-- Drop and recreate SELECT policy to exclude deleted records
DROP POLICY IF EXISTS request_events_select_policy ON request_events;
CREATE POLICY request_events_select_policy ON request_events
    FOR SELECT
    USING (
        deleted_at IS NULL AND
        request_id IN (
            SELECT id FROM content_requests
            WHERE brand_id IN (
                SELECT id FROM brands WHERE owner_id = auth.uid()
            )
            AND deleted_at IS NULL
        )
    );

-- ============================================================
-- SCRIPTS - Update existing policies
-- ============================================================

-- Drop and recreate SELECT policy to exclude deleted records
DROP POLICY IF EXISTS "Users view own scripts" ON scripts;
CREATE POLICY "Users view own scripts" ON scripts
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL AND
        EXISTS (
            SELECT 1 FROM variants v
            JOIN campaigns c ON c.id = v.campaign_id
            WHERE v.script_id = scripts.script_id 
            AND c.user_id = auth.uid()
            AND (c.deleted_at IS NULL OR c.deleted_at > NOW())
        )
    );

-- ============================================================
-- CREATIVE_BRIEFS - Update existing policies
-- ============================================================

-- Drop and recreate SELECT policy to exclude deleted records
DROP POLICY IF EXISTS "Users view own briefs" ON creative_briefs;
CREATE POLICY "Users view own briefs" ON creative_briefs
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL AND
        EXISTS (
            SELECT 1 FROM variants v
            JOIN campaigns c ON c.id = v.campaign_id
            WHERE v.brief_id = creative_briefs.brief_id 
            AND c.user_id = auth.uid()
            AND (c.deleted_at IS NULL OR c.deleted_at > NOW())
        )
    );

-- ============================================================
-- USER_PROVIDER_KEYS - Update existing policies
-- ============================================================

-- Drop and recreate SELECT policy to exclude deleted records
DROP POLICY IF EXISTS "Users can view own provider keys" ON user_provider_keys;
CREATE POLICY "Users can view own provider keys" ON user_provider_keys
    FOR SELECT TO authenticated
    USING (deleted_at IS NULL AND user_id = auth.uid());

-- Update UPDATE policy
DROP POLICY IF EXISTS "Users can update own provider keys" ON user_provider_keys;
CREATE POLICY "Users can update own provider keys" ON user_provider_keys
    FOR UPDATE TO authenticated
    USING (deleted_at IS NULL AND user_id = auth.uid())
    WITH CHECK (deleted_at IS NULL AND user_id = auth.uid());

-- ============================================================
-- CONVERSATION_SESSIONS - Update existing policies
-- ============================================================

-- Drop and recreate SELECT policy to exclude deleted records
DO $$
BEGIN
    -- Check if table exists before dropping policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_sessions') THEN
        DROP POLICY IF EXISTS "Users view own sessions" ON conversation_sessions;
        CREATE POLICY "Users view own sessions" ON conversation_sessions
            FOR SELECT TO authenticated
            USING (deleted_at IS NULL AND user_id = auth.uid());
        
        -- Update INSERT policy to prevent inserting deleted records
        DROP POLICY IF EXISTS "Users insert own sessions" ON conversation_sessions;
        CREATE POLICY "Users insert own sessions" ON conversation_sessions
            FOR INSERT TO authenticated
            WITH CHECK (user_id = auth.uid() AND deleted_at IS NULL);
    END IF;
END $$;

-- ============================================================
-- CONVERSATION_MESSAGES - Update existing policies
-- ============================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_messages') THEN
        DROP POLICY IF EXISTS "Users view own messages" ON conversation_messages;
        CREATE POLICY "Users view own messages" ON conversation_messages
            FOR SELECT TO authenticated
            USING (
                deleted_at IS NULL AND
                session_id IN (
                    SELECT id FROM conversation_sessions 
                    WHERE user_id = auth.uid() 
                    AND deleted_at IS NULL
                )
            );
    END IF;
END $$;

-- =============================================================================
-- SECTION 5: CREATE SOFT DELETE VIEWS (OPTIONAL - FOR ADMIN ACCESS)
-- =============================================================================

-- View to see all soft-deleted content_requests (admin only)
CREATE OR REPLACE VIEW soft_deleted_content_requests AS
SELECT 
    id,
    brand_id,
    campaign_id,
    title,
    status,
    deleted_at,
    created_at,
    created_by
FROM content_requests
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

COMMENT ON VIEW soft_deleted_content_requests 
IS 'Admin view of soft-deleted content requests for recovery purposes';

-- View to see all soft-deleted records across tables
CREATE OR REPLACE VIEW soft_deleted_summary AS
SELECT 
    'content_requests' AS table_name,
    COUNT(*) AS deleted_count,
    MIN(deleted_at) AS oldest_deletion,
    MAX(deleted_at) AS newest_deletion
FROM content_requests WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 
    'request_tasks',
    COUNT(*),
    MIN(deleted_at),
    MAX(deleted_at)
FROM request_tasks WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 
    'scripts',
    COUNT(*),
    MIN(deleted_at),
    MAX(deleted_at)
FROM scripts WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 
    'creative_briefs',
    COUNT(*),
    MIN(deleted_at),
    MAX(deleted_at)
FROM creative_briefs WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 
    'campaigns',
    COUNT(*),
    MIN(deleted_at),
    MAX(deleted_at)
FROM campaigns WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 
    'videos',
    COUNT(*),
    MIN(deleted_at),
    MAX(deleted_at)
FROM videos WHERE deleted_at IS NOT NULL;

COMMENT ON VIEW soft_deleted_summary 
IS 'Summary of soft-deleted records across all tables';

-- =============================================================================
-- SECTION 6: VERIFICATION QUERIES
-- =============================================================================

DO $$
DECLARE
    deleted_at_count INTEGER;
    index_count INTEGER;
    function_count INTEGER;
BEGIN
    -- Verify deleted_at columns added
    SELECT COUNT(*) INTO deleted_at_count
    FROM information_schema.columns
    WHERE column_name = 'deleted_at'
    AND table_name IN (
        'content_requests', 'request_tasks', 'request_events',
        'scripts', 'creative_briefs', 'user_provider_keys',
        'conversation_sessions', 'conversation_messages',
        'campaigns', 'videos', 'knowledge_bases', 'brand_knowledge_base'
    );
    
    RAISE NOTICE 'Tables with deleted_at column: %', deleted_at_count;
    
    -- Verify indexes created
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE indexname LIKE '%_deleted_at';
    
    RAISE NOTICE 'Soft delete indexes created: %', index_count;
    
    -- Verify helper functions created
    SELECT COUNT(*) INTO function_count
    FROM pg_proc
    WHERE proname IN ('soft_delete', 'undelete', 'hard_delete_old_soft_deleted');
    
    RAISE NOTICE 'Soft delete helper functions: %', function_count;
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

SELECT 
    '✓ Soft Delete Implementation Complete!' AS status,
    'Added deleted_at columns, updated RLS policies, created helper functions' AS summary,
    NOW() AS completed_at;
