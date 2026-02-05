-- =============================================================================
-- Migration: 003_phase7_content_requests.sql
-- Description: Create request-centric schema for Pipeline UI
-- Phase: 7
-- Author: System
-- Date: 2026-01-04
-- =============================================================================

-- =============================================================================
-- SECTION A: CUSTOM TYPES
-- =============================================================================

-- Request type enum (matches UI form options)
DO $$ BEGIN
    CREATE TYPE request_type AS ENUM (
        'video_with_vo',    -- Video with voiceover
        'video_no_vo',      -- Video without voiceover (music only)
        'image'             -- Static image
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Request status enum (matches Pipeline UI columns)
DO $$ BEGIN
    CREATE TYPE request_status AS ENUM (
        'intake',           -- Just submitted, validating
        'draft',            -- Strategy/scripting in progress
        'production',       -- Media generation in progress
        'qa',               -- Quality review (manual or auto)
        'published',        -- Successfully completed
        'cancelled'         -- User cancelled or system timeout
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Task status enum
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'pending',          -- Not started
        'in_progress',      -- Currently executing
        'completed',        -- Successfully finished
        'failed',           -- Error occurred
        'skipped'           -- Skipped due to dependency failure
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Agent role enum (matches the 5 agents in system)
DO $$ BEGIN
    CREATE TYPE agent_role AS ENUM (
        'executive',        -- Executive/Orchestrator
        'task_planner',     -- Task Planner
        'strategist',       -- Strategist
        'copywriter',       -- Copywriter
        'producer',         -- Producer
        'qa'                -- Quality Assurance
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Event type enum
DO $$ BEGIN
    CREATE TYPE event_type AS ENUM (
        'created',              -- Request created
        'status_change',        -- Request status changed
        'task_started',         -- Agent task started
        'task_completed',       -- Agent task completed
        'task_failed',          -- Agent task failed
        'agent_log',            -- Intermediate agent log message
        'provider_dispatched',  -- Sent to external provider
        'provider_completed',   -- External provider finished
        'provider_failed',      -- External provider error
        'user_action',          -- User took an action (approve, reject)
        'system_error',         -- System-level error
        'retry_initiated'       -- Retry was triggered
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- SECTION B: CONTENT_REQUESTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_requests (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Keys
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    
    -- Core Fields
    title TEXT NOT NULL,
    request_type request_type NOT NULL,
    status request_status NOT NULL DEFAULT 'intake',
    
    -- Creative Requirements
    prompt TEXT NOT NULL,
    duration_seconds INTEGER,                   -- For video types
    aspect_ratio TEXT DEFAULT '16:9',           -- '16:9', '9:16', '1:1', '4:5'
    style_preset TEXT DEFAULT 'Realistic',      -- 'Realistic', 'Animated', 'Cinematic', '3D', 'Sketch'
    shot_type TEXT DEFAULT 'Medium',            -- 'Close-up', 'Wide', 'Medium', 'POV', 'Aerial'
    voice_id TEXT,                              -- ElevenLabs voice ID (for video_with_vo)
    
    -- Provider Settings
    preferred_provider TEXT,                    -- 'pollo', 'runway', 'sora', 'veo3', 'pika', etc.
    provider_tier TEXT DEFAULT 'standard',      -- 'economy', 'standard', 'premium'
    
    -- Script Settings
    auto_script BOOLEAN DEFAULT true,           -- Let AI generate script
    script_text TEXT,                           -- User-provided script (if auto_script = false)
    
    -- Knowledge Base Selection (from Phase 6)
    selected_kb_ids UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Cost & Time Estimates (set on creation)
    estimated_cost DECIMAL(10, 4),
    estimated_time_seconds INTEGER,
    
    -- Actuals (updated during/after processing)
    actual_cost DECIMAL(10, 4) DEFAULT 0,
    
    -- Outputs
    thumbnail_url TEXT,                         -- Preview thumbnail
    output_url TEXT,                            -- Final output URL
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,         -- Extensible metadata
    
    -- Audit Fields
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_content_requests_brand_id 
    ON content_requests(brand_id);

CREATE INDEX IF NOT EXISTS idx_content_requests_campaign_id 
    ON content_requests(campaign_id);

CREATE INDEX IF NOT EXISTS idx_content_requests_status 
    ON content_requests(status);

CREATE INDEX IF NOT EXISTS idx_content_requests_created_by 
    ON content_requests(created_by);

CREATE INDEX IF NOT EXISTS idx_content_requests_created_at 
    ON content_requests(created_at DESC);

-- Composite index for Pipeline UI (filter by brand + status)
CREATE INDEX IF NOT EXISTS idx_content_requests_brand_status 
    ON content_requests(brand_id, status);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_content_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_content_requests_updated_at ON content_requests;
CREATE TRIGGER trigger_content_requests_updated_at
    BEFORE UPDATE ON content_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_content_requests_updated_at();

-- Comments
COMMENT ON TABLE content_requests IS 'Primary table for content generation requests in Pipeline UI';
COMMENT ON COLUMN content_requests.status IS 'Pipeline stage: intake → draft → production → qa → published';
COMMENT ON COLUMN content_requests.provider_tier IS 'Cost tier affecting provider selection: economy, standard, premium';
COMMENT ON COLUMN content_requests.selected_kb_ids IS 'Knowledge bases to include in context (from Phase 6 Multi-KB)';

-- =============================================================================
-- SECTION C: REQUEST_TASKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS request_tasks (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    request_id UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
    
    -- Task Definition
    agent_role agent_role NOT NULL,
    task_name TEXT NOT NULL,                    -- Human-readable name
    task_key TEXT NOT NULL,                     -- Machine key: '01_orchestration', '02_planning', etc.
    status task_status NOT NULL DEFAULT 'pending',
    
    -- Execution Order
    sequence_order INTEGER NOT NULL DEFAULT 0,  -- Lower = earlier
    depends_on UUID[] DEFAULT ARRAY[]::UUID[], -- Task IDs this depends on
    
    -- Input/Output
    input_data JSONB,                           -- Input parameters for this task
    output_data JSONB,                          -- Structured output from agent
    output_url TEXT,                            -- URL if task produces an asset
    
    -- Error Handling
    error_message TEXT,
    error_code TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    timeout_seconds INTEGER DEFAULT 300,        -- 5 minute default timeout
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_request_tasks_request_id 
    ON request_tasks(request_id);

CREATE INDEX IF NOT EXISTS idx_request_tasks_status 
    ON request_tasks(status);

CREATE INDEX IF NOT EXISTS idx_request_tasks_agent_role 
    ON request_tasks(agent_role);

CREATE INDEX IF NOT EXISTS idx_request_tasks_sequence 
    ON request_tasks(request_id, sequence_order);

-- Unique constraint on task_key per request
CREATE UNIQUE INDEX IF NOT EXISTS idx_request_tasks_unique_key 
    ON request_tasks(request_id, task_key);

-- Comments
COMMENT ON TABLE request_tasks IS 'Individual agent tasks for a content request';
COMMENT ON COLUMN request_tasks.sequence_order IS 'Execution order; lower numbers run first';
COMMENT ON COLUMN request_tasks.depends_on IS 'Array of task IDs that must complete before this task';

-- =============================================================================
-- SECTION D: REQUEST_EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS request_events (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    request_id UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
    
    -- Optional: Link to specific task
    task_id UUID REFERENCES request_tasks(id) ON DELETE SET NULL,
    
    -- Event Details
    event_type event_type NOT NULL,
    description TEXT NOT NULL,                  -- Human-readable description
    
    -- Structured Data
    metadata JSONB DEFAULT '{}'::jsonb,         -- Event-specific data
    
    -- Actor (who/what caused this event)
    actor TEXT,                                 -- 'user:uuid', 'agent:strategist', 'system', 'n8n'
    
    -- Immutable timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_request_events_request_id 
    ON request_events(request_id);

CREATE INDEX IF NOT EXISTS idx_request_events_task_id 
    ON request_events(task_id);

CREATE INDEX IF NOT EXISTS idx_request_events_type 
    ON request_events(event_type);

CREATE INDEX IF NOT EXISTS idx_request_events_created_at 
    ON request_events(created_at DESC);

-- Composite for timeline queries
CREATE INDEX IF NOT EXISTS idx_request_events_request_timeline 
    ON request_events(request_id, created_at DESC);

-- Comments
COMMENT ON TABLE request_events IS 'Immutable audit log for request lifecycle events';
COMMENT ON COLUMN request_events.actor IS 'Who caused this event: user:uuid, agent:role, system, n8n';

-- =============================================================================
-- SECTION E: PROVIDER_METADATA TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS provider_metadata (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Key (to specific task, not request directly)
    request_task_id UUID NOT NULL REFERENCES request_tasks(id) ON DELETE CASCADE,
    
    -- Provider Info
    provider_name TEXT NOT NULL,                -- 'runway', 'pika', 'elevenlabs', 'openai', etc.
    external_job_id TEXT,                       -- Job ID returned by provider
    
    -- Request/Response
    request_payload JSONB,                      -- What we sent to the provider
    response_payload JSONB,                     -- What the provider returned
    
    -- Status
    provider_status TEXT DEFAULT 'pending',     -- 'pending', 'processing', 'completed', 'failed'
    
    -- Cost Tracking
    cost_incurred DECIMAL(10, 4),               -- Actual cost from provider
    cost_currency TEXT DEFAULT 'USD',
    
    -- Timing
    dispatched_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provider_metadata_task_id 
    ON provider_metadata(request_task_id);

CREATE INDEX IF NOT EXISTS idx_provider_metadata_provider 
    ON provider_metadata(provider_name);

CREATE INDEX IF NOT EXISTS idx_provider_metadata_job_id 
    ON provider_metadata(external_job_id);

-- Comments
COMMENT ON TABLE provider_metadata IS 'Metadata for external provider API calls';
COMMENT ON COLUMN provider_metadata.external_job_id IS 'Job ID from external provider (e.g., Runway generation ID)';

-- =============================================================================
-- SECTION F: ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_metadata ENABLE ROW LEVEL SECURITY;

-- Policies for content_requests
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

-- Users can delete requests for brands they own (enforced in API: intake/cancelled only)
CREATE POLICY content_requests_delete_policy ON content_requests
    FOR DELETE
    USING (
        brand_id IN (
            SELECT id FROM brands WHERE owner_id = auth.uid()
        )
    );

-- Policies for request_tasks
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

-- System/agents can insert tasks (no user restriction needed for system operations)
CREATE POLICY request_tasks_insert_policy ON request_tasks
    FOR INSERT
    WITH CHECK (true);

-- System/agents can update tasks
CREATE POLICY request_tasks_update_policy ON request_tasks
    FOR UPDATE
    USING (true);

-- Policies for request_events
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

-- System/agents can insert events
CREATE POLICY request_events_insert_policy ON request_events
    FOR INSERT
    WITH CHECK (true);

-- Policies for provider_metadata
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

-- System/agents can insert provider metadata
CREATE POLICY provider_metadata_insert_policy ON provider_metadata
    FOR INSERT
    WITH CHECK (true);

-- System/agents can update provider metadata
CREATE POLICY provider_metadata_update_policy ON provider_metadata
    FOR UPDATE
    USING (true);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
