-- =============================================================================
-- Migration: 004_fix_rls_policies.sql
-- Description: Fix RLS policies to use brands.owner_id (not brand_users)
-- Phase: 7 - RLS Tightening
-- Date: 2026-01-04
-- =============================================================================

-- Drop existing incorrect RLS policies that reference non-existent brand_users table
DROP POLICY IF EXISTS content_requests_select_policy ON content_requests;
DROP POLICY IF EXISTS content_requests_insert_policy ON content_requests;
DROP POLICY IF EXISTS content_requests_update_policy ON content_requests;
DROP POLICY IF EXISTS content_requests_delete_policy ON content_requests;
DROP POLICY IF EXISTS request_tasks_select_policy ON request_tasks;
DROP POLICY IF EXISTS request_events_select_policy ON request_events;
DROP POLICY IF EXISTS provider_metadata_select_policy ON provider_metadata;

-- =============================================================================
-- CONTENT_REQUESTS POLICIES
-- =============================================================================

-- Users can view requests for brands they own
CREATE POLICY content_requests_select_policy ON content_requests
    FOR SELECT
    USING (
        brand_id IN (
            SELECT id FROM brands WHERE owner_id = auth.uid()
        )
    );

-- Users can create requests for brands they own
CREATE POLICY content_requests_insert_policy ON content_requests
    FOR INSERT
    WITH CHECK (
        brand_id IN (
            SELECT id FROM brands WHERE owner_id = auth.uid()
        )
    );

-- Users can update requests for brands they own
CREATE POLICY content_requests_update_policy ON content_requests
    FOR UPDATE
    USING (
        brand_id IN (
            SELECT id FROM brands WHERE owner_id = auth.uid()
        )
    );

-- Users can delete requests for brands they own
-- Note: Business logic in API restricts to intake/cancelled only
CREATE POLICY content_requests_delete_policy ON content_requests
    FOR DELETE
    USING (
        brand_id IN (
            SELECT id FROM brands WHERE owner_id = auth.uid()
        )
    );

-- =============================================================================
-- REQUEST_TASKS POLICIES
-- =============================================================================

-- Users can view tasks for requests in their brands
CREATE POLICY request_tasks_select_policy ON request_tasks
    FOR SELECT
    USING (
        request_id IN (
            SELECT id FROM content_requests
            WHERE brand_id IN (
                SELECT id FROM brands WHERE owner_id = auth.uid()
            )
        )
    );

-- System/agents can insert tasks (service role bypasses RLS)
-- No restrictive policy needed for INSERT - will be done by service role

-- System/agents can update tasks (service role bypasses RLS)
-- No restrictive policy needed for UPDATE - will be done by service role

-- =============================================================================
-- REQUEST_EVENTS POLICIES
-- =============================================================================

-- Users can view events for requests in their brands
CREATE POLICY request_events_select_policy ON request_events
    FOR SELECT
    USING (
        request_id IN (
            SELECT id FROM content_requests
            WHERE brand_id IN (
                SELECT id FROM brands WHERE owner_id = auth.uid()
            )
        )
    );

-- System/agents can insert events (service role bypasses RLS)
-- No restrictive policy needed for INSERT - will be done by service role

-- =============================================================================
-- PROVIDER_METADATA POLICIES
-- =============================================================================

-- Users can view provider metadata for tasks in their brands
CREATE POLICY provider_metadata_select_policy ON provider_metadata
    FOR SELECT
    USING (
        request_task_id IN (
            SELECT id FROM request_tasks
            WHERE request_id IN (
                SELECT id FROM content_requests
                WHERE brand_id IN (
                    SELECT id FROM brands WHERE owner_id = auth.uid()
                )
            )
        )
    );

-- System/agents can insert/update provider metadata (service role bypasses RLS)
-- No restrictive policy needed for INSERT/UPDATE - will be done by service role

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify all policies are created
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename IN ('content_requests', 'request_tasks', 'request_events', 'provider_metadata')
    AND policyname LIKE '%_policy';
    
    IF policy_count < 7 THEN
        RAISE EXCEPTION 'Expected at least 7 RLS policies, found %', policy_count;
    END IF;
    
    RAISE NOTICE 'RLS policies verified: % policies active', policy_count;
END $$;

-- =============================================================================
-- NOTES
-- =============================================================================

/*
IMPORTANT: These policies assume single-user brand ownership via brands.owner_id

Future enhancements when brand_members table is added:
1. Create brand_members table with (brand_id, user_id, role, status)
2. Update SELECT policies to include:
   WHERE brand_id IN (
       SELECT id FROM brands WHERE owner_id = auth.uid()
       UNION
       SELECT brand_id FROM brand_members 
       WHERE user_id = auth.uid() AND status = 'active'
   )
3. Update INSERT/UPDATE/DELETE policies to check roles:
   - Viewers: SELECT only
   - Editors: SELECT, INSERT, UPDATE
   - Admins: All operations including DELETE

For now, only brand owners have full access to their requests.
Service role (used by webhooks/n8n) bypasses ALL RLS policies.
*/

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
