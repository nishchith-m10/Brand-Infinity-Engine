-- Migration: Create sop_checkpoints table
-- Phase 5: MVP Hardening - Checkpointing for crash recovery
-- Run this migration in your Supabase SQL editor
DROP TABLE IF EXISTS sop_checkpoints CASCADE;
CREATE TABLE IF NOT EXISTS sop_checkpoints (
    id TEXT PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
    sop_id TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('eco', 'standard', 'infinity')),
    current_step_index INTEGER NOT NULL DEFAULT 0,
    step_outputs JSONB NOT NULL DEFAULT '{}',
    step_timings JSONB NOT NULL DEFAULT '{}',
    total_cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
    decisions JSONB NOT NULL DEFAULT '[]',
    user_input JSONB NOT NULL DEFAULT '{}',
    brand_context TEXT,
    kb_content TEXT,
    start_time BIGINT NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (
        status IN (
            'in_progress',
            'completed',
            'failed',
            'abandoned'
        )
    ),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Index for finding checkpoints by request
CREATE INDEX IF NOT EXISTS idx_sop_checkpoints_request_id ON sop_checkpoints(request_id);
-- Index for finding in-progress checkpoints
CREATE INDEX IF NOT EXISTS idx_sop_checkpoints_status ON sop_checkpoints(status);
-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sop_checkpoints_last_updated ON sop_checkpoints(last_updated);
-- RLS Policy (admin access for orchestration)
ALTER TABLE sop_checkpoints ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'sop_checkpoints'
        AND policyname = 'Service role full access'
) THEN CREATE POLICY "Service role full access" ON sop_checkpoints FOR ALL TO service_role USING (true) WITH CHECK (true);
END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'sop_checkpoints'
        AND policyname = 'Users can view own checkpoints'
) THEN CREATE POLICY "Users can view own checkpoints" ON sop_checkpoints FOR
SELECT TO authenticated USING (
        request_id IN (
            SELECT id
            FROM content_requests
            WHERE created_by = auth.uid()
        )
    );
END IF;
END $$;
COMMENT ON TABLE sop_checkpoints IS 'Phase 5: Stores SOP execution state for crash recovery and resume capability';
COMMENT ON COLUMN sop_checkpoints.step_outputs IS 'JSON object mapping step IDs to their outputs';
COMMENT ON COLUMN sop_checkpoints.decisions IS 'Array of SOPDecision objects for observability';