-- Phase 4 Fix Migration V2
-- Aligns 'campaigns', 'cost_ledger', 'generation_jobs' with Section 8 specs
-- ==========================================
-- 1. CAMPAIGNS FIX
-- ==========================================
DO $$ BEGIN -- Rename campaign_id -> id
IF EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'campaigns'
        AND column_name = 'campaign_id'
) THEN
ALTER TABLE campaigns
    RENAME COLUMN campaign_id TO id;
END IF;
-- Rename created_by -> user_id
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
    ADD COLUMN IF NOT EXISTS content_hash TEXT,
    ADD COLUMN IF NOT EXISTS error_log JSONB [] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_locked ON campaigns(locked_by, locked_at);
-- ==========================================
-- 2. COST LIBARY FIX
-- ==========================================
DO $$ BEGIN -- Rename ledger_entry_id -> id
IF EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'cost_ledger'
        AND column_name = 'ledger_entry_id'
) THEN
ALTER TABLE cost_ledger
    RENAME COLUMN ledger_entry_id TO id;
END IF;
-- Rename service_provider -> provider
IF EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'cost_ledger'
        AND column_name = 'service_provider'
) THEN
ALTER TABLE cost_ledger
    RENAME COLUMN service_provider TO provider;
END IF;
-- Rename amount_usd -> cost_usd
IF EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'cost_ledger'
        AND column_name = 'amount_usd'
) THEN
ALTER TABLE cost_ledger
    RENAME COLUMN amount_usd TO cost_usd;
END IF;
END $$;
ALTER TABLE cost_ledger -- Add missing columns
ADD COLUMN IF NOT EXISTS workflow_execution_id TEXT DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS step_name TEXT DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS tokens_in INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tokens_out INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS units_consumed DECIMAL(10, 4),
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS purpose TEXT;
-- Handle Idempotency Unique Constraint (safely)
DO $$ BEGIN -- Update null idempotency keys if any to avoid uniqueness violation
IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'cost_ledger'
        AND column_name = 'idempotency_key'
) THEN
UPDATE cost_ledger
SET idempotency_key = 'legacy_' || id::text
WHERE idempotency_key IS NULL;
END IF;
END $$;
-- Now enforce unique
ALTER TABLE cost_ledger
ADD CONSTRAINT cost_ledger_idempotency_key_key UNIQUE (idempotency_key);
ALTER TABLE cost_ledger
ALTER COLUMN idempotency_key
SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cost_campaign ON cost_ledger(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cost_provider ON cost_ledger(provider);
CREATE INDEX IF NOT EXISTS idx_cost_idempotency ON cost_ledger(idempotency_key);
-- ==========================================
-- 3. GENERATION JOBS FIX
-- ==========================================
DO $$ BEGIN -- Rename job_id -> id
IF EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'generation_jobs'
        AND column_name = 'job_id'
) THEN
ALTER TABLE generation_jobs
    RENAME COLUMN job_id TO id;
END IF;
-- Rename job_api_id -> provider_job_id
IF EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'generation_jobs'
        AND column_name = 'job_api_id'
) THEN
ALTER TABLE generation_jobs
    RENAME COLUMN job_api_id TO provider_job_id;
END IF;
-- Rename started_at -> submitted_at
IF EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'generation_jobs'
        AND column_name = 'started_at'
) THEN
ALTER TABLE generation_jobs
    RENAME COLUMN started_at TO submitted_at;
END IF;
END $$;
ALTER TABLE generation_jobs
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id),
    ADD COLUMN IF NOT EXISTS script_id UUID,
    ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS locked_by TEXT,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expected_completion TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS internal_url TEXT;
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_campaign ON generation_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_jobs_polling ON generation_jobs(status, last_polled_at);
-- ==========================================
-- 4. CREATE NEW TABLES (From Init)
-- ==========================================
CREATE EXTENSION IF NOT EXISTS vector;
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
-- ==========================================
-- 5. RLS
-- ==========================================
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