# Database Security Quick Reference

## 🔒 RLS Policy Patterns (Secure)

### ✅ CORRECT - User-Scoped Policies

```sql
-- Pattern 1: Direct user_id check
CREATE POLICY "Users view own campaigns" ON campaigns
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Pattern 2: Via JOIN to campaigns
CREATE POLICY "Users view own videos" ON videos
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM campaigns c 
        WHERE c.id = videos.campaign_id 
        AND c.user_id = auth.uid()
    )
);

-- Pattern 3: Creator or shared resource
CREATE POLICY "Users view accessible KBs" ON knowledge_bases
FOR SELECT TO authenticated
USING (
    created_by = auth.uid() 
    OR is_core = true
);
```

### ❌ INCORRECT - Overly Permissive

```sql
-- NEVER DO THIS:
CREATE POLICY "Anyone can view" ON campaigns
FOR SELECT TO authenticated
USING (true);  -- ❌ SECURITY BREACH!
```

---

## 📊 Required Indexes Checklist

Every table should have indexes on:
- ✅ Foreign keys (campaign_id, user_id, brand_id)
- ✅ Common WHERE clauses (status, deleted_at)
- ✅ JOIN columns
- ✅ ORDER BY columns (created_at DESC)

```sql
-- Standard FK index pattern
CREATE INDEX idx_[table]_[column] ON [table]([column]);

-- Composite index pattern
CREATE INDEX idx_[table]_[col1]_[col2] ON [table]([col1], [col2]);

-- Partial index pattern (for soft deletes)
CREATE INDEX idx_[table]_deleted_at ON [table](deleted_at) 
WHERE deleted_at IS NOT NULL;
```

---

## 🗑️ Soft Delete Pattern

### Adding Soft Delete to a Table

```sql
-- 1. Add column
ALTER TABLE [table] ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Add index
CREATE INDEX idx_[table]_deleted_at ON [table](deleted_at) 
WHERE deleted_at IS NOT NULL;

-- 3. Update RLS policies
CREATE POLICY "Users view active records" ON [table]
FOR SELECT TO authenticated
USING (
    deleted_at IS NULL 
    AND user_id = auth.uid()
);
```

### Using Soft Delete in Code

```typescript
// Soft delete
await supabase
  .from('campaigns')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', campaignId);

// Restore
await supabase
  .from('campaigns')
  .update({ deleted_at: null })
  .eq('id', campaignId);

// Hard delete (use sparingly)
await supabase
  .from('campaigns')
  .delete()
  .eq('id', campaignId);
```

---

## ✅ Data Validation Constraints

### Status Constraints

```sql
-- Campaign status
ALTER TABLE campaigns 
ADD CONSTRAINT check_campaign_status 
CHECK (status IN ('draft', 'active', 'completed', 'failed'));

-- Video status
ALTER TABLE videos 
ADD CONSTRAINT check_video_status 
CHECK (status IN ('queued', 'processing', 'completed', 'failed'));
```

### Value Constraints

```sql
-- Positive numbers
ALTER TABLE campaigns 
ADD CONSTRAINT check_campaign_budget 
CHECK (budget IS NULL OR budget >= 0);

-- Required fields
ALTER TABLE profiles
ADD CONSTRAINT check_email_not_empty
CHECK (email IS NOT NULL AND email != '');
```

---

## 🔗 Cascade Delete Pattern

```sql
-- Standard CASCADE delete
ALTER TABLE [child_table] 
ADD CONSTRAINT [child_table]_[fk_column]_fkey 
FOREIGN KEY ([fk_column]) 
REFERENCES [parent_table](id) 
ON DELETE CASCADE;

-- Example: Delete campaign deletes all videos
ALTER TABLE videos 
ADD CONSTRAINT videos_campaign_id_fkey 
FOREIGN KEY (campaign_id) 
REFERENCES campaigns(id) 
ON DELETE CASCADE;
```

---

## 🧪 Testing RLS Policies

### Test User Isolation

```sql
-- Create test users
INSERT INTO auth.users (id, email) VALUES
  ('user1-uuid', 'user1@test.com'),
  ('user2-uuid', 'user2@test.com');

-- Create test data
INSERT INTO campaigns (id, user_id, name) VALUES
  ('campaign1-uuid', 'user1-uuid', 'Campaign 1'),
  ('campaign2-uuid', 'user2-uuid', 'Campaign 2');

-- Test: User 1 should only see Campaign 1
SET LOCAL "request.jwt.claim.sub" = 'user1-uuid';
SELECT * FROM campaigns;  -- Should return only Campaign 1
```

### Verify Policies

```sql
-- List all RLS policies
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'campaigns';

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

---

## 🚀 Performance Monitoring

### Check Index Usage

```sql
-- Find missing indexes
SELECT 
  schemaname, tablename, 
  attname, null_frac, avg_width, n_distinct
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND attname NOT IN (
    SELECT indexname FROM pg_indexes
  );

-- Check index hit ratio (should be > 99%)
SELECT 
  sum(idx_blks_hit) / nullif(sum(idx_blks_hit + idx_blks_read), 0) AS index_hit_ratio
FROM pg_statio_user_indexes;
```

### Slow Query Detection

```sql
-- Enable slow query logging
ALTER DATABASE postgres SET log_min_duration_statement = 1000; -- 1 second

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 📋 Pre-Deployment Checklist

Before deploying a new table:

- [ ] RLS enabled (`ALTER TABLE [table] ENABLE ROW LEVEL SECURITY`)
- [ ] SELECT policy with user isolation
- [ ] INSERT policy with user_id check
- [ ] UPDATE policy with user_id check
- [ ] DELETE policy (if needed)
- [ ] Service role policy for n8n
- [ ] Indexes on all foreign keys
- [ ] Indexes on status/state columns
- [ ] Soft delete column + index (if needed)
- [ ] Status CHECK constraint
- [ ] CASCADE delete rules
- [ ] Column comments for documentation

---

## 🔧 Common Fixes

### Fix Missing Index

```sql
CREATE INDEX CONCURRENTLY idx_[table]_[column] 
ON [table]([column]);
```

### Fix Overly Permissive Policy

```sql
DROP POLICY "Old insecure policy" ON [table];
CREATE POLICY "New secure policy" ON [table]
FOR SELECT TO authenticated
USING (user_id = auth.uid());
```

### Fix Missing Cascade

```sql
ALTER TABLE [child_table] 
DROP CONSTRAINT IF EXISTS [child_table]_[fk]_fkey;

ALTER TABLE [child_table] 
ADD CONSTRAINT [child_table]_[fk]_fkey 
FOREIGN KEY ([fk]) 
REFERENCES [parent_table](id) 
ON DELETE CASCADE;
```

---

## 📚 Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Index Guide](https://www.postgresql.org/docs/current/indexes.html)
- [CASCADE Delete Best Practices](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)

---

**Last Updated:** January 5, 2026  
**Migration:** `20260105154429_security_and_performance_fixes.sql`
