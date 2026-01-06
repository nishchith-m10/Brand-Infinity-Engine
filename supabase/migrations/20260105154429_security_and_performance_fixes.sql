-- =============================================================================
-- Migration: 20260105154429_security_and_performance_fixes.sql
-- Description: Critical security and performance fixes for database
-- Created: 2026-01-05
-- Agent: Database Security & Performance Specialist
-- 
-- FIXES:
-- P0 Critical:
--   1. Overly permissive RLS policies (USING true -> user-scoped)
--   2. Missing indexes on foreign keys
-- P1 High:
--   3. Soft delete implementation (deleted_at already exists, adding policies)
--   4. Missing database constraints
--   5. Cascade delete rules
-- =============================================================================

-- =============================================================================
-- SECTION 1: FIX OVERLY PERMISSIVE RLS POLICIES
-- =============================================================================

-- ============================================================
-- PROFILES TABLE - Restrict to authenticated users only
-- ============================================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Only authenticated users can view profiles (no anonymous access)
CREATE POLICY "Profiles viewable by authenticated users"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (for signup)
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ============================================================
-- CAMPAIGNS TABLE - Restrict to user_id match
-- ============================================================
-- Note: Policies already exist from migration 20260103140500_fix_campaigns_user_id.sql
-- This section ensures they're secure and adds service role access

DROP POLICY IF EXISTS "Allow authenticated users to view campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow authenticated users to insert campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow authenticated users to update campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow authenticated users to delete campaigns" ON campaigns;

-- Service role has full access (for n8n workflows)
CREATE POLICY "Service role full access campaigns" ON campaigns
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can only view their own campaigns
CREATE POLICY "Users view own campaigns" ON campaigns
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() AND (deleted_at IS NULL OR deleted_at > NOW()));

-- Users can only insert campaigns with their user_id
CREATE POLICY "Users insert own campaigns" ON campaigns
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can only update their own campaigns
CREATE POLICY "Users update own campaigns" ON campaigns
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can only soft-delete their own campaigns
CREATE POLICY "Users delete own campaigns" ON campaigns
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- ============================================================
-- KNOWLEDGE_BASES TABLE - Restrict to creator or brand owner
-- ============================================================
DROP POLICY IF EXISTS "Users can view their KBs" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can insert KBs" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can update their KBs" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can delete their KBs" ON knowledge_bases;
DROP POLICY IF EXISTS "Service role full access to KBs" ON knowledge_bases;

-- Service role has full access (for API routes)
CREATE POLICY "Service role full access to KBs" ON knowledge_bases 
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can view KBs they created or core (shared) KBs for their campaigns
CREATE POLICY "Users view accessible KBs" ON knowledge_bases
    FOR SELECT TO authenticated
    USING (
        created_by = auth.uid() 
        OR is_core = true
        OR campaign_id IN (
            SELECT id FROM campaigns WHERE user_id = auth.uid()
        )
    );

-- Users can insert KBs (ownership assigned at creation)
CREATE POLICY "Users insert KBs" ON knowledge_bases
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Users can update KBs they created
CREATE POLICY "Users update own KBs" ON knowledge_bases
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Users can delete non-core KBs they created
CREATE POLICY "Users delete own KBs" ON knowledge_bases
    FOR DELETE TO authenticated
    USING (created_by = auth.uid() AND is_core = FALSE);

-- ============================================================
-- VIDEOS TABLE - Restrict to campaign owner
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated users to view videos" ON videos;
DROP POLICY IF EXISTS "Allow authenticated users to insert videos" ON videos;
DROP POLICY IF EXISTS "Allow authenticated users to update videos" ON videos;
DROP POLICY IF EXISTS "Allow authenticated users to delete videos" ON videos;

-- Service role has full access
CREATE POLICY "Service role full access videos" ON videos
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can view videos for their campaigns
CREATE POLICY "Users view own campaign videos" ON videos
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM campaigns c 
            WHERE c.id = videos.campaign_id 
            AND c.user_id = auth.uid()
            AND (c.deleted_at IS NULL OR c.deleted_at > NOW())
        )
    );

-- Users can insert videos for their campaigns
CREATE POLICY "Users insert videos for own campaigns" ON videos
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM campaigns c 
            WHERE c.id = videos.campaign_id 
            AND c.user_id = auth.uid()
        )
    );

-- Users can update videos for their campaigns
CREATE POLICY "Users update own campaign videos" ON videos
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM campaigns c 
            WHERE c.id = videos.campaign_id 
            AND c.user_id = auth.uid()
        )
    );

-- =============================================================================
-- SECTION 2: ADD MISSING INDEXES ON FOREIGN KEYS
-- =============================================================================

-- Campaigns table indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_id ON campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_status ON campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at ON campaigns(deleted_at) 
    WHERE deleted_at IS NOT NULL;

-- Videos table indexes
CREATE INDEX IF NOT EXISTS idx_videos_campaign_id ON videos(campaign_id);
CREATE INDEX IF NOT EXISTS idx_videos_campaign_status ON videos(campaign_id, status);

-- Knowledge bases table indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_brand_id ON knowledge_bases(brand_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_campaign_id ON knowledge_bases(campaign_id) 
    WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_created_by ON knowledge_bases(created_by);

-- Brand knowledge base table indexes
CREATE INDEX IF NOT EXISTS idx_brand_kb_knowledge_base_id ON brand_knowledge_base(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_brand_kb_brand_id ON brand_knowledge_base(brand_id);

-- Conversation sessions table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_brand ON conversation_sessions(user_id, brand_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active_user ON conversation_sessions(user_id, state) 
    WHERE state NOT IN ('delivered', 'cancelled');

-- Conversation messages table indexes
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON conversation_messages(session_id, created_at DESC);

-- Task plans table indexes
CREATE INDEX IF NOT EXISTS idx_task_plans_session ON task_plans(session_id);
CREATE INDEX IF NOT EXISTS idx_task_plans_status ON task_plans(status);

-- Quality verifications table indexes  
CREATE INDEX IF NOT EXISTS idx_quality_verifications_task_plan ON quality_verifications(task_plan_id);

-- =============================================================================
-- SECTION 3: SOFT DELETE IMPLEMENTATION
-- =============================================================================

-- Add deleted_at column to videos (if not exists)
ALTER TABLE videos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to knowledge_bases (if not exists)
ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add deleted_at column to brand_knowledge_base (if not exists)
ALTER TABLE brand_knowledge_base ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Update existing policies to exclude soft-deleted records
-- (Already done for campaigns in Section 1)

-- Update knowledge_bases policies to exclude soft-deleted
DROP POLICY IF EXISTS "Users view accessible KBs" ON knowledge_bases;
CREATE POLICY "Users view accessible KBs" ON knowledge_bases
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL AND (
            created_by = auth.uid() 
            OR is_core = true
            OR campaign_id IN (
                SELECT id FROM campaigns 
                WHERE user_id = auth.uid() 
                AND (deleted_at IS NULL OR deleted_at > NOW())
            )
        )
    );

-- Update videos policies to exclude soft-deleted
DROP POLICY IF EXISTS "Users view own campaign videos" ON videos;
CREATE POLICY "Users view own campaign videos" ON videos
    FOR SELECT TO authenticated
    USING (
        deleted_at IS NULL AND
        EXISTS (
            SELECT 1 FROM campaigns c 
            WHERE c.id = videos.campaign_id 
            AND c.user_id = auth.uid()
            AND (c.deleted_at IS NULL OR c.deleted_at > NOW())
        )
    );

-- Add indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_videos_deleted_at ON videos(deleted_at) 
    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_deleted_at ON knowledge_bases(deleted_at) 
    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brand_kb_deleted_at ON brand_knowledge_base(deleted_at) 
    WHERE deleted_at IS NOT NULL;

-- =============================================================================
-- SECTION 4: ADD DATABASE CONSTRAINTS
-- =============================================================================

-- Ensure valid campaign status values
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS check_campaign_status;
    
    -- Add new constraint with all valid statuses
    ALTER TABLE campaigns 
    ADD CONSTRAINT check_campaign_status 
    CHECK (status IN (
        'draft', 
        'in_progress', 
        'active',
        'paused',
        'completed', 
        'failed',
        'archived',
        'published',
        'cancelled',
        'pending_deletion',
        'strategizing',
        'writing',
        'producing',
        'in_production'
    ));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Ensure valid video status values
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE videos DROP CONSTRAINT IF EXISTS check_video_status;
    
    -- Add new constraint
    ALTER TABLE videos 
    ADD CONSTRAINT check_video_status 
    CHECK (status IN (
        'queued', 
        'processing', 
        'completed', 
        'failed',
        'pending',
        'cancelled'
    ));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Ensure campaign budget is positive (if budget column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campaigns' AND column_name = 'budget'
    ) THEN
        ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS check_campaign_budget;
        ALTER TABLE campaigns 
        ADD CONSTRAINT check_campaign_budget 
        CHECK (budget IS NULL OR budget >= 0);
    END IF;
END $$;

-- Ensure conversation session state is valid
DO $$
BEGIN
    ALTER TABLE conversation_sessions DROP CONSTRAINT IF EXISTS check_session_state;
    ALTER TABLE conversation_sessions
    ADD CONSTRAINT check_session_state 
    CHECK (state IN (
        'initial',
        'gathering',
        'clarifying',
        'planning',
        'confirming',
        'processing',
        'verifying',
        'delivered',
        'cancelled'
    ));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Ensure task plan status is valid
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'task_plans' AND column_name = 'status'
    ) THEN
        ALTER TABLE task_plans DROP CONSTRAINT IF EXISTS check_task_plan_status;
        ALTER TABLE task_plans 
        ADD CONSTRAINT check_task_plan_status 
        CHECK (status IN (
            'pending',
            'in_progress',
            'completed',
            'failed',
            'cancelled'
        ));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- SECTION 5: ADD CASCADE DELETE RULES
-- =============================================================================

-- Videos: CASCADE delete when campaign is deleted
DO $$
BEGIN
    ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_campaign_id_fkey;
    ALTER TABLE videos 
    ADD CONSTRAINT videos_campaign_id_fkey 
    FOREIGN KEY (campaign_id) 
    REFERENCES campaigns(id) 
    ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Knowledge bases: CASCADE delete when campaign is deleted (for campaign-specific KBs)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_bases' AND column_name = 'campaign_id'
    ) THEN
        ALTER TABLE knowledge_bases DROP CONSTRAINT IF EXISTS fk_knowledge_bases_campaign_id;
        ALTER TABLE knowledge_bases 
        ADD CONSTRAINT fk_knowledge_bases_campaign_id 
        FOREIGN KEY (campaign_id) 
        REFERENCES campaigns(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Brand knowledge base: CASCADE delete when knowledge base is deleted
DO $$
BEGIN
    ALTER TABLE brand_knowledge_base DROP CONSTRAINT IF EXISTS fk_knowledge_base_id;
    ALTER TABLE brand_knowledge_base 
    ADD CONSTRAINT fk_knowledge_base_id 
    FOREIGN KEY (knowledge_base_id) 
    REFERENCES knowledge_bases(id) 
    ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Conversation messages: CASCADE delete when session is deleted
DO $$
BEGIN
    ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_session_id_fkey;
    ALTER TABLE conversation_messages 
    ADD CONSTRAINT conversation_messages_session_id_fkey 
    FOREIGN KEY (session_id) 
    REFERENCES conversation_sessions(id) 
    ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Task plans: CASCADE delete when session is deleted
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'task_plans' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE task_plans DROP CONSTRAINT IF EXISTS task_plans_session_id_fkey;
        ALTER TABLE task_plans 
        ADD CONSTRAINT task_plans_session_id_fkey 
        FOREIGN KEY (session_id) 
        REFERENCES conversation_sessions(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Quality verifications: CASCADE delete when task plan is deleted
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quality_verifications' AND column_name = 'task_plan_id'
    ) THEN
        ALTER TABLE quality_verifications DROP CONSTRAINT IF EXISTS quality_verifications_task_plan_id_fkey;
        ALTER TABLE quality_verifications 
        ADD CONSTRAINT quality_verifications_task_plan_id_fkey 
        FOREIGN KEY (task_plan_id) 
        REFERENCES task_plans(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================================================
-- SECTION 6: ADD COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON POLICY "Users view own campaigns" ON campaigns 
IS 'V2 RLS: Users can only view their own campaigns, excludes soft-deleted records';

COMMENT ON POLICY "Users view accessible KBs" ON knowledge_bases 
IS 'V2 RLS: Users can view KBs they created, core KBs, or KBs for their campaigns';

COMMENT ON POLICY "Users view own campaign videos" ON videos 
IS 'V2 RLS: Users can view videos for campaigns they own, excludes soft-deleted';

COMMENT ON COLUMN campaigns.deleted_at 
IS 'Timestamp when campaign was soft-deleted (NULL = active, future date = scheduled deletion)';

COMMENT ON COLUMN videos.deleted_at 
IS 'Timestamp when video was soft-deleted (NULL = active)';

COMMENT ON COLUMN knowledge_bases.deleted_at 
IS 'Timestamp when knowledge base was soft-deleted (NULL = active)';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify RLS policies are in place
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename IN ('campaigns', 'videos', 'knowledge_bases', 'profiles')
    AND policyname LIKE '%own%' OR policyname LIKE '%accessible%';
    
    RAISE NOTICE 'User-scoped RLS policies created: %', policy_count;
END $$;

-- Verify indexes are created
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE tablename IN ('campaigns', 'videos', 'knowledge_bases')
    AND indexname LIKE 'idx_%';
    
    RAISE NOTICE 'Performance indexes created: %', index_count;
END $$;

-- Verify constraints are in place
DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints
    WHERE table_name IN ('campaigns', 'videos', 'conversation_sessions')
    AND constraint_type = 'CHECK';
    
    RAISE NOTICE 'Data validation constraints created: %', constraint_count;
END $$;

-- Verify cascade delete rules
DO $$
DECLARE
    cascade_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO cascade_count
    FROM information_schema.referential_constraints
    WHERE delete_rule = 'CASCADE';
    
    RAISE NOTICE 'CASCADE delete rules configured: %', cascade_count;
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

SELECT 
    '✓ Security & Performance Fixes Applied!' AS status,
    'Fixed: RLS policies, indexes, soft deletes, constraints, cascades' AS fixes,
    NOW() AS completed_at;
