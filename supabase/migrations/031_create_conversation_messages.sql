-- =====================================================
-- PHASE 6 PART 2: Multi-Agent Creative Director
-- Migration 031: Conversation Messages Table
-- =====================================================
-- Purpose: Store individual messages in conversation sessions
-- Dependencies: conversation_sessions table, brands table, auth.users table
-- Security: Row Level Security enabled

-- Drop existing table if it exists (for development)
DROP TABLE IF EXISTS conversation_messages CASCADE;

-- Create conversation_messages table
CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Message content
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,

    -- Metadata for LLM calls
    tokens_used INTEGER,
    model_used VARCHAR(50),
    latency_ms INTEGER,
    provider VARCHAR(30),
    cost_usd NUMERIC(10, 6),  -- Track cost per message

    -- Action details (for assistant messages)
    action_taken VARCHAR(30),
    questions_asked JSONB,
    delegation_plan JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT check_message_role CHECK (
        role IN ('user', 'assistant', 'system')
    ),
    CONSTRAINT check_action_taken CHECK (
        action_taken IS NULL OR 
        action_taken IN ('asked_questions', 'delegated', 'responded', 'error')
    ),
    CONSTRAINT check_positive_tokens CHECK (
        tokens_used IS NULL OR tokens_used >= 0
    ),
    CONSTRAINT check_positive_latency CHECK (
        latency_ms IS NULL OR latency_ms >= 0
    ),
    CONSTRAINT check_positive_cost CHECK (
        cost_usd IS NULL OR cost_usd >= 0
    )
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Index for fetching messages in a session (most common query)
CREATE INDEX idx_messages_session_id ON conversation_messages(session_id, created_at DESC);

-- Index for finding user's messages
CREATE INDEX idx_messages_user_id ON conversation_messages(user_id);

-- Index for finding brand's messages
CREATE INDEX idx_messages_brand_id ON conversation_messages(brand_id);

-- Index for message role (to filter by user/assistant)
CREATE INDEX idx_messages_role ON conversation_messages(role);

-- Index for cost tracking queries
CREATE INDEX idx_messages_cost ON conversation_messages(cost_usd)
WHERE cost_usd IS NOT NULL;

-- Index for provider analytics
CREATE INDEX idx_messages_provider ON conversation_messages(provider)
WHERE provider IS NOT NULL;

-- Composite index for cost analysis by provider
CREATE INDEX idx_messages_provider_cost ON conversation_messages(provider, cost_usd, created_at)
WHERE cost_usd IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own messages
CREATE POLICY "Users can view their own messages"
ON conversation_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can create their own messages
CREATE POLICY "Users can create their own messages"
ON conversation_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own messages (for editing)
CREATE POLICY "Users can update their own messages"
ON conversation_messages
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
ON conversation_messages
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to automatically update session's last_activity_at when message is added
CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversation_sessions
    SET last_activity_at = NEW.created_at
    WHERE id = NEW.session_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update session activity when message is created
CREATE TRIGGER trigger_update_session_on_message
    AFTER INSERT ON conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_on_message();

-- Function to get conversation history (with limit for context window)
CREATE OR REPLACE FUNCTION get_conversation_history(
    p_session_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    role VARCHAR(20),
    content TEXT,
    created_at TIMESTAMPTZ,
    tokens_used INTEGER,
    model_used VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.role,
        m.content,
        m.created_at,
        m.tokens_used,
        m.model_used
    FROM conversation_messages m
    WHERE m.session_id = p_session_id
    AND m.user_id = auth.uid()  -- Security check
    ORDER BY m.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total cost for a session
CREATE OR REPLACE FUNCTION get_session_cost(p_session_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    total_cost NUMERIC;
BEGIN
    SELECT COALESCE(SUM(cost_usd), 0)
    INTO total_cost
    FROM conversation_messages
    WHERE session_id = p_session_id
    AND user_id = auth.uid();  -- Security check
    
    RETURN total_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get message count by role in a session
CREATE OR REPLACE FUNCTION get_session_message_stats(p_session_id UUID)
RETURNS TABLE (
    role VARCHAR(20),
    message_count BIGINT,
    total_tokens INTEGER,
    total_cost NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.role,
        COUNT(*) as message_count,
        SUM(m.tokens_used)::INTEGER as total_tokens,
        SUM(m.cost_usd) as total_cost
    FROM conversation_messages m
    WHERE m.session_id = p_session_id
    AND m.user_id = auth.uid()  -- Security check
    GROUP BY m.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VIEWS (for analytics)
-- =====================================================

-- View: Provider usage statistics (last 30 days)
CREATE OR REPLACE VIEW provider_usage_stats AS
SELECT 
    user_id,
    provider,
    COUNT(*) as request_count,
    SUM(tokens_used) as total_tokens,
    SUM(cost_usd) as total_cost,
    AVG(latency_ms) as avg_latency_ms,
    MIN(created_at) as first_use,
    MAX(created_at) as last_use
FROM conversation_messages
WHERE provider IS NOT NULL
AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id, provider;

-- View: Daily message volume
CREATE OR REPLACE VIEW daily_message_volume AS
SELECT 
    user_id,
    DATE(created_at) as date,
    COUNT(*) as message_count,
    SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
    SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
    SUM(tokens_used) as total_tokens,
    SUM(cost_usd) as total_cost
FROM conversation_messages
GROUP BY user_id, DATE(created_at);

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE conversation_messages IS 
'Stores individual messages in conversation sessions. Includes both user messages and AI assistant responses with full metadata.';

COMMENT ON COLUMN conversation_messages.role IS 
'Message role: user (from user), assistant (from AI), or system (internal)';

COMMENT ON COLUMN conversation_messages.tokens_used IS 
'Number of tokens consumed by this message (for cost tracking)';

COMMENT ON COLUMN conversation_messages.model_used IS 
'LLM model used to generate response (e.g., gpt-4o, claude-3-5-sonnet)';

COMMENT ON COLUMN conversation_messages.latency_ms IS 
'Response time in milliseconds (for performance monitoring)';

COMMENT ON COLUMN conversation_messages.provider IS 
'LLM provider used (openai, anthropic, deepseek, etc.)';

COMMENT ON COLUMN conversation_messages.cost_usd IS 
'Cost in USD for this message (based on tokens and provider pricing)';

COMMENT ON COLUMN conversation_messages.action_taken IS 
'What action the assistant took: asked_questions, delegated, responded, or error';

COMMENT ON COLUMN conversation_messages.questions_asked IS 
'Clarifying questions asked by the assistant (if action_taken = asked_questions)';

COMMENT ON COLUMN conversation_messages.delegation_plan IS 
'Task delegation plan (if action_taken = delegated)';

-- =====================================================
-- SAMPLE QUERIES (for testing)
-- =====================================================

-- Get recent messages for a session
-- SELECT role, content, created_at, tokens_used, cost_usd
-- FROM conversation_messages
-- WHERE session_id = 'your-session-id'
-- ORDER BY created_at ASC;

-- Calculate total cost for a session
-- SELECT get_session_cost('your-session-id');

-- Get conversation history
-- SELECT * FROM get_conversation_history('your-session-id', 20);

-- View provider usage stats
-- SELECT * FROM provider_usage_stats
-- WHERE user_id = auth.uid()
-- ORDER BY total_cost DESC;

-- Find most expensive messages
-- SELECT session_id, role, model_used, tokens_used, cost_usd
-- FROM conversation_messages
-- WHERE user_id = auth.uid()
-- AND cost_usd IS NOT NULL
-- ORDER BY cost_usd DESC
-- LIMIT 10;

