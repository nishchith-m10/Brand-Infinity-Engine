-- =============================================================================
-- Migration: 036_create_task_plans_table.sql
-- Description: Task plan persistence for resumable agent workflows
-- Phase: V1 Production Readiness
-- Date: 2025-12-27
-- =============================================================================
-- Stores task plans so users can resume work after page refresh/close
-- =============================================================================

-- Drop existing table if partially created
DROP TABLE IF EXISTS task_plans CASCADE;

-- Task Plans table - stores the overall plan
CREATE TABLE task_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    campaign_id UUID, -- Optional link to campaign (no FK for schema flexibility)
    conversation_id UUID, -- Link to chat conversation if applicable
    
    -- Plan metadata
    intent_type VARCHAR(50) NOT NULL, -- 'create_campaign', 'generate_script', etc.
    intent_raw TEXT, -- Original user message
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    
    -- Plan data (JSON)
    plan_data JSONB NOT NULL DEFAULT '{}', -- Full TaskPlan object
    context_data JSONB DEFAULT '{}', -- Brand context, previous results, etc.
    
    -- Progress tracking
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    current_task_id VARCHAR(100),
    progress_percentage INTEGER DEFAULT 0,
    
    -- Results
    results JSONB DEFAULT '[]',
    errors JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by user and status
CREATE INDEX idx_task_plans_user_status ON task_plans(user_id, status);
CREATE INDEX idx_task_plans_campaign ON task_plans(campaign_id);
CREATE INDEX idx_task_plans_conversation ON task_plans(conversation_id);
CREATE INDEX idx_task_plans_updated ON task_plans(updated_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_task_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_plans_updated_at ON task_plans;
CREATE TRIGGER task_plans_updated_at
    BEFORE UPDATE ON task_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_task_plans_updated_at();

-- Enable RLS
ALTER TABLE task_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see/manage their own task plans
CREATE POLICY "Service role full access task_plans" ON task_plans
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users view own task_plans" ON task_plans
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users insert own task_plans" ON task_plans
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own task_plans" ON task_plans
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own task_plans" ON task_plans
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Enable realtime for task plans (progress updates)
ALTER PUBLICATION supabase_realtime ADD TABLE task_plans;

-- Comments
COMMENT ON TABLE task_plans IS 'Persisted task plans for resumable agent workflows';
COMMENT ON COLUMN task_plans.plan_data IS 'Full TaskPlan JSON including all tasks and their statuses';
COMMENT ON COLUMN task_plans.context_data IS 'Additional context like brand guidelines, previous results';
