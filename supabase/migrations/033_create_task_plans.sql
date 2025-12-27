-- ============================================================================
-- PHASE 6 PART 2: Task Plans & Subtasks
-- Tables for storing agent task decomposition and execution tracking
-- ============================================================================

-- Create task_plans table
CREATE TABLE IF NOT EXISTS task_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Plan metadata
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    complexity TEXT CHECK (complexity IN ('simple', 'moderate', 'complex')),
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_completion TIMESTAMPTZ,
    
    -- Tasks stored as JSONB array
    tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Results
    results JSONB DEFAULT '{}'::jsonb,
    error_log JSONB DEFAULT '[]'::jsonb
);

-- Create subtasks table (denormalized for easier querying)
CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY, -- task_1, task_2, etc.
    plan_id UUID NOT NULL REFERENCES task_plans(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    
    -- Task details
    type TEXT NOT NULL CHECK (type IN ('strategy', 'copywriting', 'production', 'verification')),
    description TEXT NOT NULL,
    agent TEXT NOT NULL CHECK (agent IN ('strategist', 'copywriter', 'producer', 'verifier')),
    
    -- Status & dependencies
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
    dependencies JSONB DEFAULT '[]'::jsonb, -- Array of task IDs
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    
    -- Execution
    estimated_duration INTEGER, -- minutes
    actual_duration INTEGER, -- minutes
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Results
    result JSONB,
    error TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Task Plans
CREATE INDEX idx_task_plans_session ON task_plans(session_id);
CREATE INDEX idx_task_plans_brand ON task_plans(brand_id);
CREATE INDEX idx_task_plans_user ON task_plans(user_id);
CREATE INDEX idx_task_plans_status ON task_plans(status);
CREATE INDEX idx_task_plans_created ON task_plans(created_at DESC);

-- Subtasks
CREATE INDEX idx_subtasks_plan ON subtasks(plan_id);
CREATE INDEX idx_subtasks_session ON subtasks(session_id);
CREATE INDEX idx_subtasks_status ON subtasks(status);
CREATE INDEX idx_subtasks_agent ON subtasks(agent);
CREATE INDEX idx_subtasks_type ON subtasks(type);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE task_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

-- Task Plans: Users can only see their own plans
CREATE POLICY "Users can view own task plans"
ON task_plans FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own task plans"
ON task_plans FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own task plans"
ON task_plans FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own task plans"
ON task_plans FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Subtasks: Users can only see subtasks from their plans
CREATE POLICY "Users can view own subtasks"
ON subtasks FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM task_plans
        WHERE task_plans.id = subtasks.plan_id
        AND task_plans.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create own subtasks"
ON subtasks FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM task_plans
        WHERE task_plans.id = subtasks.plan_id
        AND task_plans.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update own subtasks"
ON subtasks FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM task_plans
        WHERE task_plans.id = subtasks.plan_id
        AND task_plans.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete own subtasks"
ON subtasks FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM task_plans
        WHERE task_plans.id = subtasks.plan_id
        AND task_plans.user_id = auth.uid()
    )
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get active tasks for a plan (no pending dependencies)
CREATE OR REPLACE FUNCTION get_executable_tasks(p_plan_id UUID)
RETURNS TABLE (
    task_id TEXT,
    agent TEXT,
    description TEXT,
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        st.id,
        st.agent,
        st.description,
        st.priority
    FROM subtasks st
    WHERE st.plan_id = p_plan_id
    AND st.status = 'pending'
    AND NOT EXISTS (
        -- Check if any dependencies are not completed
        SELECT 1
        FROM jsonb_array_elements_text(st.dependencies) AS dep
        WHERE NOT EXISTS (
            SELECT 1 FROM subtasks
            WHERE id = dep
            AND status = 'completed'
        )
    )
    ORDER BY st.priority DESC, st.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update plan status based on subtask statuses
CREATE OR REPLACE FUNCTION update_plan_status()
RETURNS TRIGGER AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
    v_failed INTEGER;
    v_in_progress INTEGER;
    v_new_status TEXT;
BEGIN
    -- Count subtasks
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'failed'),
        COUNT(*) FILTER (WHERE status = 'in_progress')
    INTO v_total, v_completed, v_failed, v_in_progress
    FROM subtasks
    WHERE plan_id = NEW.plan_id;

    -- Determine new status
    IF v_failed > 0 THEN
        v_new_status := 'failed';
    ELSIF v_completed = v_total THEN
        v_new_status := 'completed';
    ELSIF v_in_progress > 0 THEN
        v_new_status := 'in_progress';
    ELSE
        v_new_status := 'pending';
    END IF;

    -- Update plan
    UPDATE task_plans
    SET 
        status = v_new_status,
        started_at = CASE WHEN started_at IS NULL AND v_new_status = 'in_progress' THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN v_new_status IN ('completed', 'failed') THEN NOW() ELSE completed_at END
    WHERE id = NEW.plan_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update plan status
CREATE TRIGGER trigger_update_plan_status
AFTER UPDATE OF status ON subtasks
FOR EACH ROW
EXECUTE FUNCTION update_plan_status();

-- Get plan progress
CREATE OR REPLACE FUNCTION get_plan_progress(p_plan_id UUID)
RETURNS TABLE (
    total_tasks INTEGER,
    completed_tasks INTEGER,
    failed_tasks INTEGER,
    in_progress_tasks INTEGER,
    progress_percentage INTEGER,
    estimated_remaining_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'in_progress')::INTEGER,
        ROUND((COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / NULLIF(COUNT(*), 0)) * 100)::INTEGER,
        COALESCE(SUM(estimated_duration) FILTER (WHERE status IN ('pending', 'in_progress')), 0)::INTEGER
    FROM subtasks
    WHERE plan_id = p_plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Task execution analytics
CREATE OR REPLACE VIEW task_execution_stats AS
SELECT 
    tp.brand_id,
    tp.user_id,
    DATE_TRUNC('day', tp.created_at) AS date,
    COUNT(tp.id) AS total_plans,
    COUNT(*) FILTER (WHERE tp.status = 'completed') AS completed_plans,
    COUNT(*) FILTER (WHERE tp.status = 'failed') AS failed_plans,
    AVG(EXTRACT(EPOCH FROM (tp.completed_at - tp.created_at)) / 60) FILTER (WHERE tp.completed_at IS NOT NULL) AS avg_completion_minutes,
    COUNT(st.id) AS total_tasks,
    COUNT(*) FILTER (WHERE st.status = 'completed') AS completed_tasks,
    AVG(st.actual_duration) FILTER (WHERE st.actual_duration IS NOT NULL) AS avg_task_duration
FROM task_plans tp
LEFT JOIN subtasks st ON st.plan_id = tp.id
GROUP BY tp.brand_id, tp.user_id, DATE_TRUNC('day', tp.created_at);

-- Agent workload distribution
CREATE OR REPLACE VIEW agent_workload AS
SELECT 
    agent,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_tasks,
    AVG(actual_duration) FILTER (WHERE actual_duration IS NOT NULL) AS avg_duration_minutes,
    SUM(actual_duration) FILTER (WHERE actual_duration IS NOT NULL) AS total_duration_minutes
FROM subtasks
GROUP BY agent;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE task_plans IS 'Task execution plans for multi-agent content generation';
COMMENT ON TABLE subtasks IS 'Individual tasks within a plan, executed by specific agents';
COMMENT ON FUNCTION get_executable_tasks IS 'Returns tasks ready to execute (dependencies met)';
COMMENT ON FUNCTION update_plan_status IS 'Auto-updates plan status when subtask status changes';
COMMENT ON FUNCTION get_plan_progress IS 'Calculate plan progress and estimated remaining time';

