-- =============================================================================
-- Migration: 029_rls_knowledge_bases.sql
-- Description: Row Level Security policies for KB tables
-- Phase: 6 Part I - Stage 1
-- =============================================================================
-- Enable RLS on knowledge_bases
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their KBs" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can insert KBs" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can update their KBs" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can delete their KBs" ON knowledge_bases;
DROP POLICY IF EXISTS "Service role full access to KBs" ON knowledge_bases;
-- Service role has full access (for API routes)
CREATE POLICY "Service role full access to KBs" ON knowledge_bases FOR ALL USING (auth.role() = 'service_role');
-- SELECT: Users can view all KBs (since we don't have ownership without brands table)
CREATE POLICY "Users can view their KBs" ON knowledge_bases FOR
SELECT USING (true);
-- Allow all authenticated users to view KBs
-- INSERT: Authenticated users can create KBs
CREATE POLICY "Users can insert KBs" ON knowledge_bases FOR
INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- UPDATE: Users can update KBs they created
CREATE POLICY "Users can update their KBs" ON knowledge_bases FOR
UPDATE USING (
        created_by = auth.uid()
        OR auth.role() = 'service_role'
    );
-- DELETE: Users can delete non-core KBs they created
CREATE POLICY "Users can delete their KBs" ON knowledge_bases FOR DELETE USING (
    (
        created_by = auth.uid()
        OR auth.role() = 'service_role'
    )
    AND is_core = FALSE
);
-- RLS for campaign_knowledge_bases (only if it exists)
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'campaign_knowledge_bases'
) THEN -- Enable RLS
ALTER TABLE campaign_knowledge_bases ENABLE ROW LEVEL SECURITY;
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view campaign KBs" ON campaign_knowledge_bases;
DROP POLICY IF EXISTS "Users can manage campaign KBs" ON campaign_knowledge_bases;
DROP POLICY IF EXISTS "Service role full access to campaign KBs" ON campaign_knowledge_bases;
-- Service role has full access
EXECUTE 'CREATE POLICY "Service role full access to campaign KBs" ON campaign_knowledge_bases FOR ALL USING (auth.role() = ''service_role'')';
-- All authenticated users can view/manage (simplified since no brands table)
EXECUTE 'CREATE POLICY "Users can view campaign KBs" ON campaign_knowledge_bases FOR SELECT USING (true)';
EXECUTE 'CREATE POLICY "Users can manage campaign KBs" ON campaign_knowledge_bases FOR ALL USING (auth.uid() IS NOT NULL)';
RAISE NOTICE 'RLS policies created for campaign_knowledge_bases';
ELSE RAISE NOTICE 'Skipping campaign_knowledge_bases RLS - table does not exist';
END IF;
END $$;
-- Comments
COMMENT ON POLICY "Service role full access to KBs" ON knowledge_bases IS 'Allows API routes to manage KBs via service role';
COMMENT ON POLICY "Users can delete their KBs" ON knowledge_bases IS 'Allow users to delete non-core KBs they created';