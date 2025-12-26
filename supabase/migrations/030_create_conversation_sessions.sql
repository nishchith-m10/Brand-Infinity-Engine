-- =====================================================
-- PHASE 6 PART 2: Multi-Agent Creative Director
-- Migration 030: Conversation Sessions Table
-- =====================================================
-- Purpose: Store conversation sessions between users and the Creative Director
-- Dependencies: brands table, auth.users table
-- Security: Row Level Security enabled

-- Drop existing table if it exists (for development)
DROP TABLE IF EXISTS conversation_sessions CASCADE;

-- Create conversation_sessions table
CREATE TABLE conversation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Conversation state
    state VARCHAR(20) NOT NULL DEFAULT 'initial',

    -- Collected data during conversation
    parsed_intent JSONB DEFAULT '{}'::jsonb,
    answered_questions JSONB DEFAULT '{}'::jsonb,
    pending_questions JSONB DEFAULT '[]'::jsonb,

    -- Context
    selected_kb_ids UUID[] DEFAULT ARRAY[]::UUID[],

    -- Task tracking
    active_task_plan_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT check_session_state CHECK (
        state IN (
            'initial',
            'gathering',
            'clarifying',
            'planning',
            'confirming',
            'processing',
            'verifying',
            'delivered',
            'cancelled'
        )
    )
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Index for finding user's sessions
CREATE INDEX idx_sessions_user_id ON conversation_sessions(user_id);

-- Index for finding brand's sessions
CREATE INDEX idx_sessions_brand_id ON conversation_sessions(brand_id);

-- Index for finding active sessions (not delivered/cancelled)
CREATE INDEX idx_sessions_active ON conversation_sessions(state) 
WHERE state NOT IN ('delivered', 'cancelled');

-- Index for recent activity
CREATE INDEX idx_sessions_last_activity ON conversation_sessions(last_activity_at DESC);

-- Composite index for user's active sessions
CREATE INDEX idx_sessions_user_active ON conversation_sessions(user_id, state)
WHERE state NOT IN ('delivered', 'cancelled');

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
ON conversation_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can create their own sessions
CREATE POLICY "Users can create their own sessions"
ON conversation_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
ON conversation_sessions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own sessions
CREATE POLICY "Users can delete their own sessions"
ON conversation_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update last_activity_at timestamp
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update last_activity_at on any update
CREATE TRIGGER trigger_update_session_activity
    BEFORE UPDATE ON conversation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();

-- Function to mark session as completed
CREATE OR REPLACE FUNCTION complete_conversation_session(session_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_sessions
    SET 
        state = 'delivered',
        completed_at = NOW(),
        last_activity_at = NOW()
    WHERE id = session_id
    AND user_id = auth.uid();  -- Security check
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel a session
CREATE OR REPLACE FUNCTION cancel_conversation_session(session_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE conversation_sessions
    SET 
        state = 'cancelled',
        last_activity_at = NOW()
    WHERE id = session_id
    AND user_id = auth.uid();  -- Security check
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE conversation_sessions IS 
'Stores conversation sessions between users and the Creative Director AI. Each session represents one creative request with multiple back-and-forth messages.';

COMMENT ON COLUMN conversation_sessions.state IS 
'Current state of the conversation: initial, gathering, clarifying, planning, confirming, processing, verifying, delivered, cancelled';

COMMENT ON COLUMN conversation_sessions.parsed_intent IS 
'Extracted information from user messages (platform, content_type, product, etc.)';

COMMENT ON COLUMN conversation_sessions.answered_questions IS 
'Answers provided by user to clarifying questions (keyed by question_id)';

COMMENT ON COLUMN conversation_sessions.pending_questions IS 
'Questions waiting for user response (array of question objects)';

COMMENT ON COLUMN conversation_sessions.selected_kb_ids IS 
'Knowledge Base IDs selected for this session context';

COMMENT ON COLUMN conversation_sessions.active_task_plan_id IS 
'Reference to the task plan being executed (if any)';

-- =====================================================
-- SAMPLE QUERIES (for testing)
-- =====================================================

-- Find active sessions for current user
-- SELECT * FROM conversation_sessions 
-- WHERE user_id = auth.uid() 
-- AND state NOT IN ('delivered', 'cancelled')
-- ORDER BY last_activity_at DESC;

-- Get session with parsed intent
-- SELECT id, state, parsed_intent->>'platform' as platform, 
--        parsed_intent->>'content_type' as content_type
-- FROM conversation_sessions
-- WHERE user_id = auth.uid();

-- Count sessions by state
-- SELECT state, COUNT(*) 
-- FROM conversation_sessions 
-- WHERE user_id = auth.uid()
-- GROUP BY state;

