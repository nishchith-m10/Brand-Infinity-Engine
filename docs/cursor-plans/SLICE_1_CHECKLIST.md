# SLICE 1: Database Foundation

**Status**: 🔄 IN PROGRESS  
**Duration**: 4-6 hours  
**Started**: [Current Date]

---

## Objectives

Create the database foundation for conversation management:
- ✅ conversation_sessions table
- ✅ conversation_messages table
- ✅ Row Level Security policies
- ⏳ Manual testing in Supabase
- ⏳ Verification of all features

---

## Deliverables Checklist

### 1. Migration Files ✅

- [x] `supabase/migrations/030_create_conversation_sessions.sql` (220 lines)
  - [x] Table definition with all columns
  - [x] State constraint (9 valid states)
  - [x] 5 indexes for performance
  - [x] RLS policies (SELECT, INSERT, UPDATE, DELETE)
  - [x] Helper functions (complete, cancel)
  - [x] Triggers (auto-update last_activity_at)
  - [x] Documentation comments

- [x] `supabase/migrations/031_create_conversation_messages.sql` (360 lines)
  - [x] Table definition with all columns
  - [x] Role constraint (user, assistant, system)
  - [x] Action constraint
  - [x] Positive value constraints
  - [x] 7 indexes for performance
  - [x] RLS policies (SELECT, INSERT, UPDATE, DELETE)
  - [x] Helper functions (get history, calculate cost)
  - [x] Triggers (auto-update session activity)
  - [x] Analytical views (provider stats, daily volume)
  - [x] Documentation comments

- [x] `supabase/migrations/032_test_conversation_tables.sql` (260 lines)
  - [x] Verification queries
  - [x] Test data examples
  - [x] Performance test queries
  - [x] Cleanup scripts
  - [x] Success criteria checklist

### 2. Database Schema ⏳

#### conversation_sessions Table
- [ ] Verify table created in Supabase
- [ ] All columns present and correct types
- [ ] Default values working
- [ ] Check constraints enforced
- [ ] Foreign keys to brands and users working

#### conversation_messages Table
- [ ] Verify table created in Supabase
- [ ] All columns present and correct types
- [ ] Default values working
- [ ] Check constraints enforced
- [ ] Foreign keys working (session, brand, user)

### 3. Indexes ⏳

#### conversation_sessions Indexes
- [ ] idx_sessions_user_id (user lookups)
- [ ] idx_sessions_brand_id (brand lookups)
- [ ] idx_sessions_active (active sessions)
- [ ] idx_sessions_last_activity (recent activity)
- [ ] idx_sessions_user_active (composite)

#### conversation_messages Indexes
- [ ] idx_messages_session_id (fetch messages)
- [ ] idx_messages_user_id (user messages)
- [ ] idx_messages_brand_id (brand messages)
- [ ] idx_messages_role (filter by role)
- [ ] idx_messages_cost (cost tracking)
- [ ] idx_messages_provider (provider analytics)
- [ ] idx_messages_provider_cost (composite)

### 4. Row Level Security ⏳

#### conversation_sessions RLS
- [ ] RLS enabled on table
- [ ] Policy: SELECT (users can view own)
- [ ] Policy: INSERT (users can create own)
- [ ] Policy: UPDATE (users can update own)
- [ ] Policy: DELETE (users can delete own)
- [ ] Verify unauthorized access blocked

#### conversation_messages RLS
- [ ] RLS enabled on table
- [ ] Policy: SELECT (users can view own)
- [ ] Policy: INSERT (users can create own)
- [ ] Policy: UPDATE (users can update own)
- [ ] Policy: DELETE (users can delete own)
- [ ] Verify unauthorized access blocked

### 5. Functions ⏳

#### Session Functions
- [ ] update_session_activity() - auto-update timestamp
- [ ] complete_conversation_session() - mark as delivered
- [ ] cancel_conversation_session() - mark as cancelled

#### Message Functions
- [ ] update_session_on_message() - update session activity
- [ ] get_conversation_history() - fetch recent messages
- [ ] get_session_cost() - calculate total cost
- [ ] get_session_message_stats() - aggregate stats

### 6. Triggers ⏳

- [ ] trigger_update_session_activity (on session update)
- [ ] trigger_update_session_on_message (on message insert)
- [ ] Verify triggers fire correctly

### 7. Views ⏳

- [ ] provider_usage_stats - provider analytics
- [ ] daily_message_volume - daily aggregates
- [ ] Views return data correctly

---

## Manual Testing Steps

### Step 1: Run Migrations

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Run migration 030:
   ```sql
   -- Copy contents of 030_create_conversation_sessions.sql
   -- Paste and execute
   ```
4. Run migration 031:
   ```sql
   -- Copy contents of 031_create_conversation_messages.sql
   -- Paste and execute
   ```

### Step 2: Verify Tables Created

Run from migration 032:
```sql
-- Verify tables exist
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('conversation_sessions', 'conversation_messages');

-- Should return 2 rows
```

**Expected Output**:
```
conversation_sessions | BASE TABLE
conversation_messages | BASE TABLE
```

### Step 3: Test Session Creation

```sql
-- Get your user ID
SELECT auth.uid();

-- Get your brand ID (replace with actual brand)
SELECT id FROM brands LIMIT 1;

-- Create test session
INSERT INTO conversation_sessions (
    brand_id,
    user_id,
    state,
    parsed_intent
) VALUES (
    'YOUR_BRAND_ID'::UUID,  -- Replace
    auth.uid(),
    'initial',
    '{"content_type": "video", "platform": "tiktok"}'::jsonb
)
RETURNING *;
```

**Expected**: Session created with generated ID

### Step 4: Test Message Creation

```sql
-- Create user message (replace SESSION_ID and BRAND_ID)
INSERT INTO conversation_messages (
    session_id,
    brand_id,
    user_id,
    role,
    content
) VALUES (
    'YOUR_SESSION_ID'::UUID,  -- Replace
    'YOUR_BRAND_ID'::UUID,    -- Replace
    auth.uid(),
    'user',
    'Make a TikTok video about our protein powder'
)
RETURNING *;
```

**Expected**: Message created, session.last_activity_at updated

### Step 5: Test Assistant Message

```sql
-- Create assistant message with metadata
INSERT INTO conversation_messages (
    session_id,
    brand_id,
    user_id,
    role,
    content,
    tokens_used,
    model_used,
    provider,
    cost_usd,
    latency_ms,
    action_taken,
    questions_asked
) VALUES (
    'YOUR_SESSION_ID'::UUID,
    'YOUR_BRAND_ID'::UUID,
    auth.uid(),
    'assistant',
    'Great! A few quick questions...',
    150,
    'gpt-4o',
    'openai',
    0.0008,
    850,
    'asked_questions',
    '[{"id": "q1", "question": "Which platform?", "type": "choice"}]'::jsonb
)
RETURNING *;
```

**Expected**: Assistant message created with all metadata

### Step 6: Test Functions

```sql
-- Get conversation history
SELECT * FROM get_conversation_history('YOUR_SESSION_ID'::UUID, 10);

-- Get session cost
SELECT get_session_cost('YOUR_SESSION_ID'::UUID);
-- Should return 0.0008

-- Get message stats
SELECT * FROM get_session_message_stats('YOUR_SESSION_ID'::UUID);
-- Should show 1 user message, 1 assistant message
```

### Step 7: Test Session Completion

```sql
-- Complete the session
SELECT complete_conversation_session('YOUR_SESSION_ID'::UUID);

-- Verify state changed
SELECT state, completed_at 
FROM conversation_sessions 
WHERE id = 'YOUR_SESSION_ID'::UUID;
-- Should show state = 'delivered' and completed_at timestamp
```

### Step 8: Test RLS Security

```sql
-- Try to access another user's data (should return 0 rows)
SELECT * FROM conversation_sessions 
WHERE user_id != auth.uid();

-- Should return empty result
```

### Step 9: Test Views

```sql
-- Check provider usage stats
SELECT * FROM provider_usage_stats
WHERE user_id = auth.uid();

-- Check daily message volume
SELECT * FROM daily_message_volume
WHERE user_id = auth.uid()
ORDER BY date DESC
LIMIT 7;
```

### Step 10: Cleanup Test Data

```sql
-- Delete test messages
DELETE FROM conversation_messages 
WHERE session_id = 'YOUR_SESSION_ID'::UUID;

-- Delete test session
DELETE FROM conversation_sessions 
WHERE id = 'YOUR_SESSION_ID'::UUID;
```

---

## Performance Testing

### Check Index Usage

```sql
-- Test session lookup performance
EXPLAIN ANALYZE
SELECT * FROM conversation_sessions
WHERE user_id = auth.uid()
AND state NOT IN ('delivered', 'cancelled')
ORDER BY last_activity_at DESC;

-- Should use idx_sessions_user_active
```

**Expected**: Index scan, not sequential scan

### Check Message Query Performance

```sql
EXPLAIN ANALYZE
SELECT * FROM conversation_messages
WHERE session_id = 'YOUR_SESSION_ID'::UUID
ORDER BY created_at DESC
LIMIT 20;

-- Should use idx_messages_session_id
```

**Expected**: Index scan on session_id

---

## Success Criteria

All must pass before proceeding to Slice 2:

- [ ] **Tables Created**: Both tables exist in Supabase
- [ ] **Columns Valid**: All columns present with correct types
- [ ] **Constraints Work**: State/role constraints enforced
- [ ] **Foreign Keys Work**: References to brands/users valid
- [ ] **Indexes Created**: All 12 indexes present
- [ ] **RLS Enabled**: Both tables have RLS on
- [ ] **RLS Policies Work**: 8 policies (4 per table) enforced
- [ ] **Functions Work**: All 7 functions executable
- [ ] **Triggers Fire**: Both triggers update correctly
- [ ] **Views Return Data**: Both views queryable
- [ ] **Can Insert Data**: Test session/messages created
- [ ] **Can Query Data**: Test data retrieved correctly
- [ ] **RLS Blocks Unauthorized**: Other users' data hidden
- [ ] **Performance Good**: Indexes used in queries

---

## Troubleshooting

### "Table already exists" Error
```sql
-- Drop and recreate
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS conversation_sessions CASCADE;
-- Then rerun migrations
```

### "Foreign key constraint failed"
```sql
-- Verify brands table exists
SELECT COUNT(*) FROM brands;
-- If empty, create a test brand first
```

### "RLS policy prevents action"
```sql
-- Check you're authenticated
SELECT auth.uid();
-- Should return a UUID, not null
```

### "Function does not exist"
```sql
-- List functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public';
-- Verify function names match
```

---

## Key Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Migration files | 3 | 3 | ✅ |
| Tables created | 2 | ⏳ | ⏳ |
| Indexes created | 12 | ⏳ | ⏳ |
| RLS policies | 8 | ⏳ | ⏳ |
| Functions | 7 | ⏳ | ⏳ |
| Triggers | 2 | ⏳ | ⏳ |
| Views | 2 | ⏳ | ⏳ |
| Test queries pass | 10/10 | ⏳ | ⏳ |

---

## Next Steps → Slice 2

**Slice 2: Session Management API** (4-6 hours)

### Objectives
- Create POST /api/v1/conversation/start
- Create GET /api/v1/conversation/[id]
- Test API with curl/Postman
- No agent logic yet (hardcoded responses)

### Prerequisites
- [x] Slice 0 complete
- [ ] Slice 1 complete and verified
- [ ] Database tables tested and working

---

## Notes

### Design Decisions
- Using JSONB for flexible data (parsed_intent, questions)
- Separate tables for sessions and messages (normalized)
- Triggers auto-update timestamps (DRY principle)
- Views for analytics (pre-computed for performance)

### Time Tracking
- **Estimated**: 4-6 hours
- **Actual**: TBD
- **Breakdown**:
  - Migration creation: 2 hours ✅
  - Manual testing: TBD
  - Verification: TBD

---

## Sign-Off

**Slice 1 Status**: ⏳ **READY FOR TESTING**

Migration files created. Ready for manual execution in Supabase.

**Next Action**: Run migrations in Supabase SQL Editor and verify all tests pass.

**Date**: [Current Date]  
**Implementer**: AI Assistant (Claude)

