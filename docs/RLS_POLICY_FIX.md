# RLS Policy Tightening - Complete

## Summary
Fixed Row-Level Security (RLS) policies that were incorrectly referencing a non-existent `brand_users` table. Updated to use `brands.owner_id` for proper access control.

## Problem
Original migration (003) referenced `brand_users` table which doesn't exist in the current schema:
```sql
-- ❌ INCORRECT (brand_users doesn't exist)
WHERE brand_id IN (
    SELECT brand_id FROM brand_users WHERE user_id = auth.uid()
)
```

## Solution
Updated all RLS policies to use `brands.owner_id`:
```sql
-- ✅ CORRECT (uses existing brands table)
WHERE brand_id IN (
    SELECT id FROM brands WHERE owner_id = auth.uid()
)
```

## Changes Made

### 1. Applied Live Database Fix
- **File**: `database/migrations/004_fix_rls_policies.sql` (created)
- **Applied**: ✅ Yes, to remote Supabase
- **Verified**: ✅ All policies working correctly

### 2. Updated Original Migration
- **File**: `database/migrations/003_phase7_content_requests.sql` (updated)
- **Changes**: Fixed 4 policy blocks to use brands.owner_id
- **Purpose**: Ensure future deployments use correct policies

## Verification Results

### RLS Status
| Table | RLS Enabled | Policy Count |
|:------|:------------|-------------:|
| content_requests | ✅ | 4 |
| request_tasks | ✅ | 3 |
| request_events | ✅ | 2 |
| provider_metadata | ✅ | 3 |
| **Total** | **All enabled** | **12** |

### Policy Implementation
| Table | Policy | Type | Status |
|:------|:-------|:-----|:-------|
| **content_requests** |
| | SELECT | User | ✅ Uses brands.owner_id |
| | INSERT | User | ✅ Uses brands.owner_id |
| | UPDATE | User | ✅ Uses brands.owner_id |
| | DELETE | User | ✅ Uses brands.owner_id |
| **request_tasks** |
| | SELECT | User | ✅ Uses brands.owner_id |
| | INSERT | System | ⚙️ No restriction (service role) |
| | UPDATE | System | ⚙️ No restriction (service role) |
| **request_events** |
| | SELECT | User | ✅ Uses brands.owner_id |
| | INSERT | System | ⚙️ No restriction (service role) |
| **provider_metadata** |
| | SELECT | User | ✅ Uses brands.owner_id |
| | INSERT | System | ⚙️ No restriction (service role) |
| | UPDATE | System | ⚙️ No restriction (service role) |

### Test Results
✅ **PASSED** - All RLS policies correctly configured

## Access Control Model

### Current Implementation (Single Owner)
```
User (auth.uid)
    ↓
Brands (owner_id = auth.uid)
    ↓
Content Requests (brand_id IN user's brands)
    ↓
Tasks, Events, Metadata (inherited from request)
```

**Access Rules:**
- ✅ Users can view/create/update/delete requests for brands they OWN
- ✅ Users can view tasks/events/metadata for their brand's requests
- ✅ System (service role) can insert/update tasks/events/metadata (bypasses RLS)
- ❌ Users cannot access other users' brands/requests

### Future Enhancement (Multi-User Brands)
When brand membership system is added:

```sql
-- Example future policy with brand_members support
WHERE brand_id IN (
    SELECT id FROM brands WHERE owner_id = auth.uid()
    UNION
    SELECT brand_id FROM brand_members 
    WHERE user_id = auth.uid() 
    AND status = 'active'
)
```

**Roles to implement:**
- `viewer` - SELECT only
- `editor` - SELECT, INSERT, UPDATE
- `admin` - All operations except brand deletion
- `owner` - Full access

## Security Features

### 1. Row-Level Isolation
- Users can ONLY see data for brands they own
- No cross-brand data leakage
- Enforced at database level (not just API)

### 2. Service Role Bypass
- Webhooks/n8n use service role key
- Bypasses RLS for system operations
- Used for: task updates, event logging, provider callbacks

### 3. Authentication Required
- All user policies require `auth.uid()`
- Anonymous users get no access
- Invalid tokens = no data returned

### 4. Cascading Permissions
- Brand access → Request access
- Request access → Task/Event/Metadata access
- Hierarchical security model

## Testing RLS

### Test 1: User Can Only See Own Brands
```sql
-- As authenticated user
SELECT * FROM content_requests;
-- Returns only requests for brands where owner_id = auth.uid()
```

### Test 2: Anonymous User Gets Nothing
```sql
-- Without auth token
SELECT * FROM content_requests;
-- Returns 0 rows (no auth.uid())
```

### Test 3: Service Role Sees All
```javascript
// Using service role key in API
const supabase = createClient(url, serviceRoleKey);
await supabase.from('content_requests').select('*');
// Returns ALL requests (bypasses RLS)
```

### Test 4: Cross-Brand Protection
```sql
-- User tries to access another brand's request
UPDATE content_requests 
SET title = 'Hacked' 
WHERE brand_id = 'other-brand-id';
-- Updates 0 rows (RLS blocks)
```

## Files Modified

1. **database/migrations/003_phase7_content_requests.sql**
   - Fixed 4 policy blocks
   - Now uses brands.owner_id
   
2. **database/migrations/004_fix_rls_policies.sql** (NEW)
   - Drop old policies
   - Create correct policies
   - Verification logic
   - Migration notes

## Status: ✅ COMPLETE

- [x] Identified issue (brand_users doesn't exist)
- [x] Created fix migration (004)
- [x] Applied to remote database
- [x] Verified all policies working
- [x] Updated original migration (003)
- [x] Tested RLS enforcement
- [x] Documented for future reference

## Impact

**Before:**
- ❌ Policies referenced non-existent table
- ❌ Would fail on fresh deployments
- ❌ No actual access control working

**After:**
- ✅ Policies use existing brands table
- ✅ Works on fresh deployments
- ✅ Full RLS protection active
- ✅ Ready for production use

---

**Last Updated:** January 4, 2026  
**Phase:** 7 - Task 6 Complete  
**Migration Files:** 003 (updated), 004 (new)
