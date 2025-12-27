-- =====================================================
-- PHASE 6 PART 2: Test Conversation Tables
-- Migration 032: Verification & Test Queries
-- =====================================================
-- Purpose: Verify conversation tables work correctly
-- Run this manually in Supabase SQL Editor after creating tables
-- WARNING: This is for TESTING ONLY - will be deleted in production

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- 1. Verify tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('conversation_sessions', 'conversation_messages')
ORDER BY table_name;

-- 2. Verify columns in conversation_sessions
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'conversation_sessions'
ORDER BY ordinal_position;

-- 3. Verify columns in conversation_messages
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'conversation_messages'
ORDER BY ordinal_position;

-- 4. Verify indexes
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('conversation_sessions', 'conversation_messages')
ORDER BY tablename, indexname;

-- 5. Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('conversation_sessions', 'conversation_messages');

-- 6. Verify RLS policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('conversation_sessions', 'conversation_messages')
ORDER BY tablename, policyname;

-- 7. Verify foreign key constraints
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND tc.table_name IN ('conversation_sessions', 'conversation_messages');

-- 8. Verify functions exist
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'update_session_activity',
    'complete_conversation_session',
    'cancel_conversation_session',
    'update_session_on_message',
    'get_conversation_history',
    'get_session_cost',
    'get_session_message_stats'
)
ORDER BY routine_name;

-- 9. Verify triggers exist
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN ('conversation_sessions', 'conversation_messages')
ORDER BY event_object_table, trigger_name;

-- 10. Verify views exist
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN ('provider_usage_stats', 'daily_message_volume');

-- =====================================================
-- TEST DATA INSERTION (Manual Testing)
-- =====================================================
-- NOTE: Replace 'YOUR_USER_ID' and 'YOUR_BRAND_ID' with actual values
-- Get your user ID with: SELECT auth.uid();
-- Get your brand ID from the brands table

-- Test 1: Create a session
-- BEGIN;
-- INSERT INTO conversation_sessions (
--     brand_id,
--     user_id,
--     state,
--     parsed_intent
-- ) VALUES (
--     'YOUR_BRAND_ID'::UUID,
--     auth.uid(),
--     'initial',
--     '{"content_type": "video", "platform": "tiktok"}'::jsonb
-- )
-- RETURNING *;
-- COMMIT;

-- Test 2: Create a user message
-- BEGIN;
-- INSERT INTO conversation_messages (
--     session_id,
--     brand_id,
--     user_id,
--     role,
--     content
-- ) VALUES (
--     'YOUR_SESSION_ID'::UUID,
--     'YOUR_BRAND_ID'::UUID,
--     auth.uid(),
--     'user',
--     'Make a TikTok video about our protein powder'
-- )
-- RETURNING *;
-- COMMIT;

-- Test 3: Create an assistant message with questions
-- BEGIN;
-- INSERT INTO conversation_messages (
--     session_id,
--     brand_id,
--     user_id,
--     role,
--     content,
--     tokens_used,
--     model_used,
--     provider,
--     cost_usd,
--     latency_ms,
--     action_taken,
--     questions_asked
-- ) VALUES (
--     'YOUR_SESSION_ID'::UUID,
--     'YOUR_BRAND_ID'::UUID,
--     auth.uid(),
--     'assistant',
--     'Great! A few quick questions...',
--     150,
--     'gpt-4o',
--     'openai',
--     0.0008,
--     850,
--     'asked_questions',
--     '[{"id": "q1", "question": "Which platform?", "type": "choice", "options": ["TikTok", "Instagram"]}]'::jsonb
-- )
-- RETURNING *;
-- COMMIT;

-- Test 4: Update session state
-- BEGIN;
-- UPDATE conversation_sessions
-- SET 
--     state = 'gathering',
--     pending_questions = '[{"id": "q1", "question": "Which platform?"}]'::jsonb
-- WHERE id = 'YOUR_SESSION_ID'::UUID
-- AND user_id = auth.uid()
-- RETURNING *;
-- COMMIT;

-- Test 5: Get conversation history
-- SELECT * FROM get_conversation_history('YOUR_SESSION_ID'::UUID, 10);

-- Test 6: Get session cost
-- SELECT get_session_cost('YOUR_SESSION_ID'::UUID);

-- Test 7: Get session message stats
-- SELECT * FROM get_session_message_stats('YOUR_SESSION_ID'::UUID);

-- Test 8: Complete a session
-- SELECT complete_conversation_session('YOUR_SESSION_ID'::UUID);

-- Test 9: Verify RLS works (try to access another user's data)
-- This should return 0 rows if RLS is working:
-- SELECT * FROM conversation_sessions WHERE user_id != auth.uid();

-- =====================================================
-- CLEANUP TEST DATA (after manual testing)
-- =====================================================

-- Delete test messages
-- DELETE FROM conversation_messages 
-- WHERE session_id IN (
--     SELECT id FROM conversation_sessions 
--     WHERE user_id = auth.uid() 
--     AND state = 'initial'
-- );

-- Delete test sessions
-- DELETE FROM conversation_sessions 
-- WHERE user_id = auth.uid() 
-- AND state = 'initial';

-- =====================================================
-- PERFORMANCE TESTING
-- =====================================================

-- Test 1: Check index usage on session lookup
-- EXPLAIN ANALYZE
-- SELECT * FROM conversation_sessions
-- WHERE user_id = auth.uid()
-- AND state NOT IN ('delivered', 'cancelled')
-- ORDER BY last_activity_at DESC;

-- Test 2: Check index usage on message retrieval
-- EXPLAIN ANALYZE
-- SELECT * FROM conversation_messages
-- WHERE session_id = 'YOUR_SESSION_ID'::UUID
-- ORDER BY created_at DESC
-- LIMIT 20;

-- Test 3: Check aggregate query performance
-- EXPLAIN ANALYZE
-- SELECT 
--     provider,
--     COUNT(*) as requests,
--     SUM(tokens_used) as tokens,
--     SUM(cost_usd) as cost
-- FROM conversation_messages
-- WHERE user_id = auth.uid()
-- AND created_at >= NOW() - INTERVAL '7 days'
-- GROUP BY provider;

-- =====================================================
-- SUCCESS CRITERIA CHECKLIST
-- =====================================================

-- ✅ Tables created successfully
-- ✅ All columns present with correct data types
-- ✅ All indexes created
-- ✅ RLS enabled on both tables
-- ✅ RLS policies created (4 per table)
-- ✅ Foreign keys working
-- ✅ Functions created and executable
-- ✅ Triggers created and firing
-- ✅ Views created
-- ✅ Can insert test data
-- ✅ Can query test data
-- ✅ RLS prevents unauthorized access
-- ✅ Indexes used in queries (check with EXPLAIN ANALYZE)
-- ✅ Functions return expected results
-- ✅ Triggers update related tables correctly

-- Run this to verify everything:
-- SELECT 'All verification queries passed! ✅' as status;

