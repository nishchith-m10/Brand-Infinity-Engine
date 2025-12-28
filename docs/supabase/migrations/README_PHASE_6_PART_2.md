# Phase 6 Part 2: Database Migrations

## Overview

This directory contains database migrations for the **Multi-Agent Creative Director** system (Phase 6 Part 2).

## Migration Files

### 030_create_conversation_sessions.sql
**Purpose**: Core conversation session tracking

**Creates**:
- `conversation_sessions` table
- 5 performance indexes
- 4 RLS policies
- Helper functions (complete/cancel session)
- Auto-update triggers

**Dependencies**: `brands` table, `auth.users` table

---

### 031_create_conversation_messages.sql
**Purpose**: Individual message storage with cost tracking

**Creates**:
- `conversation_messages` table
- 7 performance indexes
- 4 RLS policies
- Helper functions (history, cost calculation, stats)
- Session update triggers
- 2 analytical views

**Dependencies**: `conversation_sessions`, `brands`, `auth.users`

---

### 032_test_conversation_tables.sql
**Purpose**: Verification and testing queries

**Contains**:
- Table/column verification queries
- Index verification
- RLS policy checks
- Manual test data examples
- Performance test queries
- Cleanup scripts

**Usage**: Run manually in Supabase SQL Editor for validation

---

## Running Migrations

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

3. **Run Migration 030**
   ```sql
   -- Copy entire contents of 030_create_conversation_sessions.sql
   -- Paste into SQL Editor
   -- Click "Run" (or Cmd/Ctrl + Enter)
   ```

4. **Run Migration 031**
   ```sql
   -- Copy entire contents of 031_create_conversation_messages.sql
   -- Paste into SQL Editor
   -- Click "Run"
   ```

5. **Verify with Migration 032**
   ```sql
   -- Run verification queries from 032_test_conversation_tables.sql
   -- Check that all tables, indexes, and policies exist
   ```

---

### Option 2: Supabase CLI

```bash
# Navigate to project root
cd /path/to/Brand-Infinity-Engine

# Run migrations
supabase db push

# Or run individually
supabase db execute --file supabase/migrations/030_create_conversation_sessions.sql
supabase db execute --file supabase/migrations/031_create_conversation_messages.sql
```

---

### Option 3: psql (Direct Connection)

```bash
# Connect to Supabase database
psql "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres"

# Run migrations
\i supabase/migrations/030_create_conversation_sessions.sql
\i supabase/migrations/031_create_conversation_messages.sql

# Verify
\dt conversation_*
```

---

## Verification Checklist

After running migrations, verify:

### 1. Tables Exist

```sql
SELECT table_name 
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('conversation_sessions', 'conversation_messages');
```

**Expected**: 2 rows

---

### 2. RLS Enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('conversation_sessions', 'conversation_messages');
```

**Expected**: Both show `rowsecurity = true`

---

### 3. Policies Created

```sql
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('conversation_sessions', 'conversation_messages')
GROUP BY tablename;
```

**Expected**:
- conversation_sessions: 4 policies
- conversation_messages: 4 policies

---

### 4. Functions Created

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%conversation%'
OR routine_name LIKE '%session%'
ORDER BY routine_name;
```

**Expected**: 7 functions

---

### 5. Indexes Created

```sql
SELECT tablename, COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('conversation_sessions', 'conversation_messages')
GROUP BY tablename;
```

**Expected**:
- conversation_sessions: 6 indexes (including primary key)
- conversation_messages: 8 indexes (including primary key)

---

## Testing

### Quick Test: Create a Session

```sql
-- 1. Get your user ID
SELECT auth.uid() as my_user_id;

-- 2. Get a brand ID (or create one)
SELECT id FROM brands LIMIT 1;

-- 3. Create test session
INSERT INTO conversation_sessions (
    brand_id,
    user_id,
    state
) VALUES (
    'YOUR_BRAND_ID'::UUID,  -- Replace
    auth.uid(),
    'initial'
)
RETURNING *;

-- 4. Verify it was created
SELECT * FROM conversation_sessions
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;
```

### Quick Test: Create a Message

```sql
-- Create message (replace SESSION_ID and BRAND_ID)
INSERT INTO conversation_messages (
    session_id,
    brand_id,
    user_id,
    role,
    content,
    provider,
    model_used,
    tokens_used,
    cost_usd
) VALUES (
    'YOUR_SESSION_ID'::UUID,
    'YOUR_BRAND_ID'::UUID,
    auth.uid(),
    'user',
    'Test message',
    'openai',
    'gpt-4o-mini',
    50,
    0.0001
)
RETURNING *;

-- Verify it was created
SELECT * FROM conversation_messages
WHERE session_id = 'YOUR_SESSION_ID'::UUID
ORDER BY created_at DESC;
```

### Test RLS Security

```sql
-- Try to access another user's data (should return empty)
SELECT * FROM conversation_sessions 
WHERE user_id != auth.uid();

-- Expected: 0 rows
```

---

## Schema Diagram

```
┌─────────────────────────────────────────────┐
│  conversation_sessions                      │
├─────────────────────────────────────────────┤
│  id (UUID, PK)                              │
│  brand_id (UUID, FK → brands)               │
│  user_id (UUID, FK → auth.users)            │
│  state (VARCHAR)                            │
│  parsed_intent (JSONB)                      │
│  answered_questions (JSONB)                 │
│  pending_questions (JSONB)                  │
│  selected_kb_ids (UUID[])                   │
│  active_task_plan_id (UUID)                 │
│  created_at (TIMESTAMPTZ)                   │
│  last_activity_at (TIMESTAMPTZ)             │
│  completed_at (TIMESTAMPTZ)                 │
└─────────────────┬───────────────────────────┘
                  │
                  │ 1:N
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  conversation_messages                      │
├─────────────────────────────────────────────┤
│  id (UUID, PK)                              │
│  session_id (UUID, FK → sessions)           │
│  brand_id (UUID, FK → brands)               │
│  user_id (UUID, FK → auth.users)            │
│  role (VARCHAR)                             │
│  content (TEXT)                             │
│  tokens_used (INTEGER)                      │
│  model_used (VARCHAR)                       │
│  provider (VARCHAR)                         │
│  cost_usd (NUMERIC)                         │
│  latency_ms (INTEGER)                       │
│  action_taken (VARCHAR)                     │
│  questions_asked (JSONB)                    │
│  delegation_plan (JSONB)                    │
│  created_at (TIMESTAMPTZ)                   │
└─────────────────────────────────────────────┘
```

---

## Rollback

If you need to undo these migrations:

```sql
-- Drop in reverse order (messages first due to foreign key)
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS conversation_sessions CASCADE;

-- Drop views
DROP VIEW IF EXISTS provider_usage_stats;
DROP VIEW IF EXISTS daily_message_volume;

-- Drop functions
DROP FUNCTION IF EXISTS update_session_activity();
DROP FUNCTION IF EXISTS complete_conversation_session(UUID);
DROP FUNCTION IF EXISTS cancel_conversation_session(UUID);
DROP FUNCTION IF EXISTS update_session_on_message();
DROP FUNCTION IF EXISTS get_conversation_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_session_cost(UUID);
DROP FUNCTION IF EXISTS get_session_message_stats(UUID);
```

---

## Troubleshooting

### "relation does not exist"
- Ensure brands table exists first
- Check that you're running migrations in order (030 before 031)

### "permission denied"
- Ensure you have database admin access
- Check that you're authenticated (SELECT auth.uid() should return a UUID)

### "constraint violation"
- Ensure foreign key references exist (brands, users)
- Check that UUIDs are valid

### "function already exists"
- Drop existing functions first with `DROP FUNCTION IF EXISTS ...`
- Or use `CREATE OR REPLACE FUNCTION`

---

## Performance Notes

### Indexes
- All frequently queried columns are indexed
- Composite indexes for common query patterns
- Partial indexes for filtered queries (e.g., active sessions only)

### Expected Query Performance
- Session lookup by user: < 1ms (indexed)
- Message retrieval for session: < 5ms (indexed + limit)
- Cost aggregation: < 10ms (indexed on cost_usd)

### Monitoring
```sql
-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND tablename IN ('conversation_sessions', 'conversation_messages')
ORDER BY idx_scan DESC;
```

---

## Data Retention

Consider implementing data retention policies:

```sql
-- Example: Delete sessions older than 90 days
DELETE FROM conversation_sessions
WHERE completed_at < NOW() - INTERVAL '90 days'
AND state IN ('delivered', 'cancelled');

-- Note: Messages will be cascade deleted due to FK
```

---

## Security Notes

### RLS Policies
- All tables use RLS to enforce user-level access control
- Users can only see/modify their own data
- `auth.uid()` is used to identify current user

### API Keys
- Never store API keys in these tables
- Use `user_llm_providers` table (separate migration) for credentials
- Keys are encrypted at rest

### Cost Tracking
- Cost data is visible only to the owning user
- Aggregate views respect RLS policies

---

## Support

For issues or questions:
1. Check [SLICE_1_CHECKLIST.md](../../SLICE_1_CHECKLIST.md)
2. Review [Phase 6 Part 2 Manifesto](../../docs/plans/PHASE_6_PART_II_AGENT_ARCHITECTURE_MANIFESTO.md)
3. Run verification queries from migration 032

---

**Migration Version**: 030-032  
**Phase**: 6.2 (Part 2)  
**Feature**: Multi-Agent Creative Director  
**Status**: Ready for deployment

