-- Create task_plans table for tracking task execution progress
-- Bug Fix 3.3: Missing task_plans DB table
CREATE TABLE IF NOT EXISTS task_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversation_sessions(id),
    campaign_id UUID REFERENCES campaigns(id),
    -- Plan metadata
    name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'running',
            'completed',
            'failed',
            'cancelled'
        )
    ),
    -- Progress tracking
    progress_percentage INTEGER DEFAULT 0,
    current_task_id TEXT,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    -- Results
    tasks JSONB DEFAULT '[]'::jsonb,
    results JSONB DEFAULT '[]'::jsonb,
    errors JSONB DEFAULT '[]'::jsonb,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
-- Enable RLS
ALTER TABLE task_plans ENABLE ROW LEVEL SECURITY;
-- RLS Policies
CREATE POLICY "Users can view own task plans" ON task_plans FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task plans" ON task_plans FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task plans" ON task_plans FOR
UPDATE USING (auth.uid() = user_id);
-- Indexes for performance
CREATE INDEX idx_task_plans_user_id ON task_plans(user_id);
CREATE INDEX idx_task_plans_status ON task_plans(status);
CREATE INDEX idx_task_plans_conversation ON task_plans(conversation_id);