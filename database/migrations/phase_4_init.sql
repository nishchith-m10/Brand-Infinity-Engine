-- Phase 4 Init Migration
-- Enforces Schema Specifications from Section 8 of Phase 4 Manifesto
-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS vector;
-- 2. Core Tables from Section 8.1
-- campaigns (Update or Create)
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    -- Assumes users table exists
    brand_id UUID NOT NULL,
    -- Assumes brands table exists
    status TEXT NOT NULL DEFAULT 'idea',
    stage_metadata JSONB DEFAULT '{}',
    locked_by TEXT,
    locked_at TIMESTAMPTZ,
    lock_version INTEGER DEFAULT 0,
    emergency_stop BOOLEAN DEFAULT FALSE,
    emergency_stop_at TIMESTAMPTZ,
    emergency_stop_by UUID,
    emergency_stop_reason TEXT,
    brief_id UUID,
    script_id UUID,
    video_id UUID,
    requires_approval BOOLEAN DEFAULT TRUE,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    target_platforms TEXT [],
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    content_hash TEXT,
    error_log JSONB [] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Ensure indexes from Section 8.1
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_locked ON campaigns(locked_by, locked_at);
-- cost_ledger (Section 8.1)
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
-- generation_jobs (Section 8.1)
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
-- 3. Implied Tables (From Usage Contexts)
-- brand_knowledge_base (Section 3.2)
CREATE TABLE IF NOT EXISTS brand_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    -- Assumes brands table exists
    content TEXT NOT NULL,
    embedding vector(1536),
    -- Standard OpenAI embedding size
    category TEXT CHECK (category IN ('rule', 'positive', 'negative')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);
-- trend_signals (Section 3.1 & UTI)
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
    -- Deduplication
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trend_hash ON trend_signals(content_hash);
CREATE INDEX IF NOT EXISTS idx_trend_timestamp ON trend_signals(timestamp);
-- idempotency_keys (Dimension 3)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    response_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);
-- execution_logs (Audit Trail)
CREATE TABLE IF NOT EXISTS execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id TEXT,
    execution_id TEXT,
    step_name TEXT,
    status TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
-- 4. Enable RLS (Dimension 1)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
-- Grant access to authenticated users (and service role implicitly has access)
-- Note: 'anon' and 'authenticated' roles need specific policies.
-- For server-side n8n (Service Role), it bypasses RLS.
-- We add a basic policy for authenticated users to view their own data if needed.
CREATE POLICY "Users can view own campaigns" ON campaigns FOR
SELECT USING (auth.uid() = user_id);
-- (Policies can be refined later, Service Role is key for n8n)