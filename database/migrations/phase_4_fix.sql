-- Phase 4 Fix Migration
-- aligns existing 'campaigns' table with Section 8 specs
-- 1. Alter campaigns table
DO $$ BEGIN -- Rename campaign_id -> id if it exists
IF EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'campaigns'
        AND column_name = 'campaign_id'
) THEN
ALTER TABLE campaigns
    RENAME COLUMN campaign_id TO id;
END IF;
-- Rename created_by -> user_id if it exists
IF EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'campaigns'
        AND column_name = 'created_by'
) THEN
ALTER TABLE campaigns
    RENAME COLUMN created_by TO user_id;
END IF;
END $$;
-- Add new columns
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS stage_metadata JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS locked_by TEXT,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lock_version INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS emergency_stop BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS emergency_stop_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS emergency_stop_by UUID,
    ADD COLUMN IF NOT EXISTS emergency_stop_reason TEXT,
    ADD COLUMN IF NOT EXISTS brief_id UUID,
    ADD COLUMN IF NOT EXISTS script_id UUID,
    ADD COLUMN IF NOT EXISTS video_id UUID,
    ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS approved_by UUID,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS target_platforms TEXT [],
    ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
    -- published_at already exists
ADD COLUMN IF NOT EXISTS content_hash TEXT,
    ADD COLUMN IF NOT EXISTS error_log JSONB [] DEFAULT '{}';
-- Ensure Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_locked ON campaigns(locked_by, locked_at);
-- 2. Create remaining tables (Standard Phase 4 Init)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS cost_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id),
    workflow_execution_id TEXT NOT NULL,
    step_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    units_consumed DECIMAL(10, 4),
    cost_usd DECIMAL(10, 6) NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    purpose TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cost_campaign ON cost_ledger(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cost_provider ON cost_ledger(provider);
CREATE INDEX IF NOT EXISTS idx_cost_idempotency ON cost_ledger(idempotency_key);
CREATE TABLE IF NOT EXISTS generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id),
    script_id UUID,
    scene_id UUID,
    provider TEXT NOT NULL,
    provider_job_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    locked_by TEXT,
    locked_at TIMESTAMPTZ,
    prompt TEXT NOT NULL,
    parameters JSONB,
    submitted_at TIMESTAMPTZ,
    expected_completion TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_polled_at TIMESTAMPTZ,
    result_url TEXT,
    internal_url TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    cost_usd DECIMAL(10, 6),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_campaign ON generation_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_jobs_polling ON generation_jobs(status, last_polled_at);
CREATE TABLE IF NOT EXISTS brand_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    category TEXT CHECK (category IN ('rule', 'positive', 'negative')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS trend_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT,
    source_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    velocity_score INTEGER,
    raw_content TEXT,
    normalized_content TEXT,
    keywords TEXT [],
    embedding vector(1536),
    content_hash TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trend_hash ON trend_signals(content_hash);
CREATE INDEX IF NOT EXISTS idx_trend_timestamp ON trend_signals(timestamp);
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    response_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE TABLE IF NOT EXISTS execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id TEXT,
    execution_id TEXT,
    step_name TEXT,
    status TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
-- RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can view own campaigns'
) THEN CREATE POLICY "Users can view own campaigns" ON campaigns FOR
SELECT USING (auth.uid() = user_id);
END IF;
END $$;