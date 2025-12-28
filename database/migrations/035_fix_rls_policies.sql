-- =============================================================================
-- Migration: 035_fix_rls_policies.sql
-- Description: Fix RLS policies to enforce proper user/brand isolation
-- Phase: V1 Production Readiness
-- Date: 2025-12-27
-- =============================================================================
-- This migration replaces permissive USING(true) policies with proper
-- user-based isolation. Users can only see/modify their own data.
-- Service role retains full access for n8n workflows.
--
-- SCHEMA NOTES (phase_4_init.sql version):
-- - campaigns: has id, user_id, brand_id
-- - creative_briefs: has brief_id, brand_id (NO campaign_id, NO user_id)
-- - scripts: has script_id, brief_id (links to creative_briefs)
-- - hooks: has hook_id, script_id
-- - videos: has video_id, script_id
-- - variants: has variant_id, campaign_id, brief_id, script_id, video_id
-- - publications: has publication_id, campaign_id
-- - generation_jobs: has id, campaign_id (phase_4 version)
-- - cost_ledger: has id, campaign_id
-- - assets: has asset_id, variant_id
-- =============================================================================

-- ============================================================
-- CAMPAIGNS TABLE - Core tenant isolation (uses user_id)
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to view campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow authenticated users to insert campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow authenticated users to update campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow authenticated users to delete campaigns" ON campaigns;
DROP POLICY IF EXISTS "Service role full access campaigns" ON campaigns;

-- Service role has full access (for n8n workflows)
CREATE POLICY "Service role full access campaigns" ON campaigns
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can only view their own campaigns (via user_id)
CREATE POLICY "Users view own campaigns" ON campaigns
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Users can only insert campaigns with their user_id
CREATE POLICY "Users insert own campaigns" ON campaigns
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can only update their own campaigns
CREATE POLICY "Users update own campaigns" ON campaigns
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can only delete their own campaigns
CREATE POLICY "Users delete own campaigns" ON campaigns
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- ============================================================
-- CREATIVE_BRIEFS TABLE - Linked via brand_id (indirect through variants)
-- NOTE: creative_briefs has brand_id, not campaign_id
-- Access is through variants table which links to campaigns
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to view creative_briefs" ON creative_briefs;
DROP POLICY IF EXISTS "Allow authenticated users to insert creative_briefs" ON creative_briefs;
DROP POLICY IF EXISTS "Allow authenticated users to update creative_briefs" ON creative_briefs;
DROP POLICY IF EXISTS "Service role full access creative_briefs" ON creative_briefs;

CREATE POLICY "Service role full access creative_briefs" ON creative_briefs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can view briefs linked to their campaigns via variants
CREATE POLICY "Users view own briefs" ON creative_briefs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM variants v
            JOIN campaigns c ON c.id = v.campaign_id
            WHERE v.brief_id = creative_briefs.brief_id 
            AND c.user_id = auth.uid()
        )
    );

-- Users can insert briefs (linked later via variants)
CREATE POLICY "Users insert briefs" ON creative_briefs
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users update own briefs" ON creative_briefs
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM variants v
            JOIN campaigns c ON c.id = v.campaign_id
            WHERE v.brief_id = creative_briefs.brief_id 
            AND c.user_id = auth.uid()
        )
    );

-- ============================================================
-- SCRIPTS TABLE - Linked via brief_id -> variants -> campaigns
-- NOTE: scripts has brief_id (FK to creative_briefs)
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to view scripts" ON scripts;
DROP POLICY IF EXISTS "Allow authenticated users to insert scripts" ON scripts;
DROP POLICY IF EXISTS "Allow authenticated users to update scripts" ON scripts;
DROP POLICY IF EXISTS "Service role full access scripts" ON scripts;

CREATE POLICY "Service role full access scripts" ON scripts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view own scripts" ON scripts
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM variants v
            JOIN campaigns c ON c.id = v.campaign_id
            WHERE v.script_id = scripts.script_id 
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users insert scripts" ON scripts
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users update own scripts" ON scripts
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM variants v
            JOIN campaigns c ON c.id = v.campaign_id
            WHERE v.script_id = scripts.script_id 
            AND c.user_id = auth.uid()
        )
    );

-- ============================================================
-- HOOKS TABLE - Linked via script_id -> variants -> campaigns
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to view hooks" ON hooks;
DROP POLICY IF EXISTS "Allow authenticated users to insert hooks" ON hooks;
DROP POLICY IF EXISTS "Allow authenticated users to update hooks" ON hooks;
DROP POLICY IF EXISTS "Service role full access hooks" ON hooks;

CREATE POLICY "Service role full access hooks" ON hooks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view own hooks" ON hooks
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM scripts s
            JOIN variants v ON v.script_id = s.script_id
            JOIN campaigns c ON c.id = v.campaign_id
            WHERE s.script_id = hooks.script_id 
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users insert hooks" ON hooks
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- ============================================================
-- VIDEOS TABLE - Linked via script_id -> variants -> campaigns
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to view videos" ON videos;
DROP POLICY IF EXISTS "Allow authenticated users to insert videos" ON videos;
DROP POLICY IF EXISTS "Allow authenticated users to update videos" ON videos;
DROP POLICY IF EXISTS "Service role full access videos" ON videos;

CREATE POLICY "Service role full access videos" ON videos
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view own videos" ON videos
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM variants v
            JOIN campaigns c ON c.id = v.campaign_id
            WHERE v.video_id = videos.video_id 
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users insert videos" ON videos
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users update own videos" ON videos
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM variants v
            JOIN campaigns c ON c.id = v.campaign_id
            WHERE v.video_id = videos.video_id 
            AND c.user_id = auth.uid()
        )
    );

-- ============================================================
-- VARIANTS TABLE - Directly linked to campaigns
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to view variants" ON variants;
DROP POLICY IF EXISTS "Allow authenticated users to insert variants" ON variants;
DROP POLICY IF EXISTS "Allow authenticated users to update variants" ON variants;
DROP POLICY IF EXISTS "Service role full access variants" ON variants;

CREATE POLICY "Service role full access variants" ON variants
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view own variants" ON variants
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM campaigns c 
            WHERE c.id = variants.campaign_id 
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users insert own variants" ON variants
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM campaigns c 
            WHERE c.id = campaign_id 
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users update own variants" ON variants
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM campaigns c 
            WHERE c.id = variants.campaign_id 
            AND c.user_id = auth.uid()
        )
    );

-- ============================================================
-- PUBLICATIONS TABLE - Linked to campaigns
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to view publications" ON publications;
DROP POLICY IF EXISTS "Allow authenticated users to insert publications" ON publications;
DROP POLICY IF EXISTS "Allow authenticated users to update publications" ON publications;
DROP POLICY IF EXISTS "Service role full access publications" ON publications;

CREATE POLICY "Service role full access publications" ON publications
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view own publications" ON publications
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM campaigns c 
            WHERE c.id = publications.campaign_id 
            AND c.user_id = auth.uid()
        )
    );

-- ============================================================
-- GENERATION_JOBS TABLE - Linked to campaigns (phase_4 version)
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to view generation_jobs" ON generation_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to insert generation_jobs" ON generation_jobs;
DROP POLICY IF EXISTS "Allow authenticated users to update generation_jobs" ON generation_jobs;
DROP POLICY IF EXISTS "Service role full access generation_jobs" ON generation_jobs;

CREATE POLICY "Service role full access generation_jobs" ON generation_jobs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can view generation jobs for their campaigns
CREATE POLICY "Users view own generation_jobs" ON generation_jobs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM campaigns c 
            WHERE c.id = generation_jobs.campaign_id 
            AND c.user_id = auth.uid()
        )
    );

-- ============================================================
-- COST_LEDGER TABLE - Linked to campaigns
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to view cost_ledger" ON cost_ledger;
DROP POLICY IF EXISTS "Allow authenticated users to insert cost_ledger" ON cost_ledger;
DROP POLICY IF EXISTS "Service role full access cost_ledger" ON cost_ledger;

CREATE POLICY "Service role full access cost_ledger" ON cost_ledger
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can only view cost entries for their campaigns
CREATE POLICY "Users view own cost_ledger" ON cost_ledger
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM campaigns c 
            WHERE c.id = cost_ledger.campaign_id 
            AND c.user_id = auth.uid()
        )
    );

-- ============================================================
-- KNOWLEDGE_BASES TABLE - Fix existing policy
-- ============================================================
DROP POLICY IF EXISTS "Users can view their KBs" ON knowledge_bases;

-- Users can view their own KBs or core (shared) KBs
CREATE POLICY "Users view own KBs" ON knowledge_bases
    FOR SELECT TO authenticated
    USING (
        created_by = auth.uid() 
        OR is_core = true
    );

-- ============================================================
-- ASSETS TABLE - Linked via variant_id -> campaigns
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to view assets" ON assets;
DROP POLICY IF EXISTS "Allow authenticated users to insert assets" ON assets;
DROP POLICY IF EXISTS "Allow authenticated users to update assets" ON assets;
DROP POLICY IF EXISTS "Service role full access assets" ON assets;

CREATE POLICY "Service role full access assets" ON assets
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Assets linked through variants -> campaigns
CREATE POLICY "Users view own assets" ON assets
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM variants v
            JOIN campaigns c ON c.id = v.campaign_id
            WHERE v.variant_id = assets.variant_id
            AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users insert assets" ON assets
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON POLICY "Users view own campaigns" ON campaigns IS 'V1 RLS: Users can only view their own campaigns (via user_id)';
COMMENT ON POLICY "Service role full access campaigns" ON campaigns IS 'V1 RLS: n8n workflows have full access via service role';
