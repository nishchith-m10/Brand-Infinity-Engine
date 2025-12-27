-- ============================================================================
-- PHASE 6 PART 2: Quality Verifications
-- Track quality checks performed by the Verifier agent
-- ============================================================================

CREATE TABLE IF NOT EXISTS quality_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    task_plan_id UUID REFERENCES task_plans(id) ON DELETE CASCADE,
    subtask_id TEXT REFERENCES subtasks(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Content being verified
    content_type TEXT NOT NULL,
    content TEXT NOT NULL,
    
    -- Verification results
    passed BOOLEAN NOT NULL,
    score INTEGER CHECK (score BETWEEN 0 AND 100),
    
    -- Issues found
    issues JSONB DEFAULT '[]'::jsonb,
    
    -- Quality checklist
    checklist JSONB DEFAULT '{}'::jsonb,
    
    -- Suggestions & fixes
    suggestions JSONB DEFAULT '[]'::jsonb,
    auto_fixed BOOLEAN DEFAULT FALSE,
    fixed_content TEXT,
    
    -- Agent metadata
    model_used TEXT,
    verifier_version TEXT DEFAULT '1.0',
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- User actions
    user_approved BOOLEAN,
    user_rejected BOOLEAN,
    user_feedback TEXT,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_quality_verifications_session ON quality_verifications(session_id);
CREATE INDEX idx_quality_verifications_plan ON quality_verifications(task_plan_id);
CREATE INDEX idx_quality_verifications_brand ON quality_verifications(brand_id);
CREATE INDEX idx_quality_verifications_user ON quality_verifications(user_id);
CREATE INDEX idx_quality_verifications_passed ON quality_verifications(passed);
CREATE INDEX idx_quality_verifications_score ON quality_verifications(score DESC);
CREATE INDEX idx_quality_verifications_created ON quality_verifications(created_at DESC);
CREATE INDEX idx_quality_verifications_content_type ON quality_verifications(content_type);

-- GIN index for issues JSONB queries
CREATE INDEX idx_quality_verifications_issues ON quality_verifications USING GIN (issues);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE quality_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quality verifications"
ON quality_verifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own quality verifications"
ON quality_verifications FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own quality verifications"
ON quality_verifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own quality verifications"
ON quality_verifications FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get quality stats for a session
CREATE OR REPLACE FUNCTION get_session_quality_stats(p_session_id UUID)
RETURNS TABLE (
    total_verifications INTEGER,
    passed_count INTEGER,
    failed_count INTEGER,
    average_score NUMERIC,
    critical_issues INTEGER,
    major_issues INTEGER,
    minor_issues INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE passed = TRUE)::INTEGER,
        COUNT(*) FILTER (WHERE passed = FALSE)::INTEGER,
        ROUND(AVG(score), 2),
        (
            SELECT COUNT(*)::INTEGER
            FROM quality_verifications qv,
            LATERAL jsonb_array_elements(qv.issues) AS issue
            WHERE qv.session_id = p_session_id
            AND issue->>'severity' = 'critical'
        ),
        (
            SELECT COUNT(*)::INTEGER
            FROM quality_verifications qv,
            LATERAL jsonb_array_elements(qv.issues) AS issue
            WHERE qv.session_id = p_session_id
            AND issue->>'severity' = 'major'
        ),
        (
            SELECT COUNT(*)::INTEGER
            FROM quality_verifications qv,
            LATERAL jsonb_array_elements(qv.issues) AS issue
            WHERE qv.session_id = p_session_id
            AND issue->>'severity' = 'minor'
        )
    FROM quality_verifications
    WHERE session_id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get common quality issues
CREATE OR REPLACE FUNCTION get_common_quality_issues(
    p_brand_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    category TEXT,
    severity TEXT,
    occurrence_count BIGINT,
    example_description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        issue->>'category' AS category,
        issue->>'severity' AS severity,
        COUNT(*) AS occurrence_count,
        (array_agg(issue->>'description'))[1] AS example_description
    FROM quality_verifications qv,
    LATERAL jsonb_array_elements(qv.issues) AS issue
    WHERE qv.brand_id = p_brand_id
    AND qv.created_at > NOW() - INTERVAL '30 days'
    GROUP BY issue->>'category', issue->>'severity'
    ORDER BY COUNT(*) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update subtask status when verification completes
CREATE OR REPLACE FUNCTION update_subtask_on_verification()
RETURNS TRIGGER AS $$
BEGIN
    -- If verification passed, mark subtask as completed
    IF NEW.passed = TRUE AND NEW.subtask_id IS NOT NULL THEN
        UPDATE subtasks
        SET 
            status = 'completed',
            result = jsonb_build_object(
                'content', NEW.content,
                'quality_score', NEW.score,
                'verified_at', NEW.verified_at
            ),
            completed_at = NOW()
        WHERE id = NEW.subtask_id
        AND status = 'in_progress';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_subtask_on_verification
AFTER INSERT ON quality_verifications
FOR EACH ROW
EXECUTE FUNCTION update_subtask_on_verification();

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Quality trends over time
CREATE OR REPLACE VIEW quality_trends AS
SELECT 
    brand_id,
    user_id,
    DATE_TRUNC('day', created_at) AS date,
    content_type,
    COUNT(*) AS total_verifications,
    COUNT(*) FILTER (WHERE passed = TRUE) AS passed_count,
    ROUND(AVG(score), 2) AS avg_score,
    COUNT(*) FILTER (WHERE user_approved = TRUE) AS user_approved_count,
    COUNT(*) FILTER (WHERE user_rejected = TRUE) AS user_rejected_count
FROM quality_verifications
GROUP BY brand_id, user_id, DATE_TRUNC('day', created_at), content_type;

-- Issue categories breakdown
CREATE OR REPLACE VIEW quality_issues_breakdown AS
SELECT 
    brand_id,
    issue->>'category' AS category,
    issue->>'severity' AS severity,
    COUNT(*) AS issue_count,
    COUNT(DISTINCT session_id) AS affected_sessions
FROM quality_verifications,
LATERAL jsonb_array_elements(issues) AS issue
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY brand_id, issue->>'category', issue->>'severity';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE quality_verifications IS 'Quality checks performed by Verifier agent on generated content';
COMMENT ON FUNCTION get_session_quality_stats IS 'Get quality statistics for a conversation session';
COMMENT ON FUNCTION get_common_quality_issues IS 'Get most common quality issues for a brand';
COMMENT ON FUNCTION update_subtask_on_verification IS 'Auto-complete subtasks when verification passes';

