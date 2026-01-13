# Business Logic Enforcement - Quick Reference

## Campaign State Transitions

### Valid Transitions
```
draft → in_progress | cancelled | archived
in_progress → completed | failed | cancelled | archived  
completed → archived
failed → in_progress | archived
cancelled → archived
archived → pending_deletion
pending_deletion → archived
```

### API Usage
```typescript
// ✅ Valid
PUT /api/v1/campaigns/{id}
{ "status": "in_progress" } // from draft

// ❌ Invalid (returns 400)
PUT /api/v1/campaigns/{id}
{ "status": "completed" } // from draft
```

---

## Budget Enforcement

### Database Functions

#### Reserve Budget (Atomic)
```sql
SELECT * FROM reserve_budget(
  '<campaign-uuid>'::UUID,
  0.04  -- amount to reserve
);

-- Returns campaign data if successful
-- Returns NULL if insufficient budget
```

#### Update Actual Cost
```sql
SELECT update_actual_cost(
  '<campaign-uuid>'::UUID,
  0.04,  -- reserved amount
  0.042  -- actual cost
);
```

#### Refund Budget
```sql
SELECT refund_budget(
  '<campaign-uuid>'::UUID,
  0.04  -- amount to refund
);
```

### API Implementation Pattern
```typescript
// 1. Reserve budget
const { data: reservation } = await supabase.rpc('reserve_budget', {
  p_campaign_id: campaignId,
  p_amount: estimatedCost
});

if (!reservation || reservation.length === 0) {
  return NextResponse.json(
    { error: { code: 'INSUFFICIENT_BUDGET', message: '...' }},
    { status: 402 }
  );
}

try {
  // 2. Perform operation
  const result = await performOperation();
  
  // 3. Update actual cost
  await supabase.rpc('update_actual_cost', {
    p_campaign_id: campaignId,
    p_reserved: estimatedCost,
    p_actual: result.actualCost
  });
} catch (error) {
  // 4. Refund on error
  await supabase.rpc('refund_budget', {
    p_campaign_id: campaignId,
    p_amount: estimatedCost
  });
  throw error;
}
```

---

## Video Approval Workflow

### State Transitions
```
pending → processing | failed
processing → completed | failed
completed → published | rejected
published → archived
rejected → processing
failed → processing
```

### Approval Flow
```typescript
// 1. Video completes
PATCH /api/v1/videos/{id}
{ "status": "completed" }

// 2. Approve video (required before publishing)
POST /api/v1/videos/{id}/approve
// Sets: approval_status = "approved", approved_at, approved_by

// 3. Now can publish
PATCH /api/v1/videos/{id}
{ "status": "published" } // ✅ Allowed
```

### Without Approval
```typescript
// ❌ This will fail with 403
PATCH /api/v1/videos/{id}
{ "status": "published" }

// Response:
{
  "error": {
    "code": "APPROVAL_REQUIRED",
    "message": "Video must be approved before publishing..."
  }
}
```

### Rejection Flow
```typescript
// Reject video with reason
POST /api/v1/videos/{id}/reject
{
  "reason": "Quality issues - regenerate with better prompts"
}

// Sets: 
// - approval_status = "rejected"
// - status = "rejected"
// - rejection_reason
// - rejected_at, rejected_by

// Can reprocess
PATCH /api/v1/videos/{id}
{ "status": "processing" } // ✅ Allowed from rejected state
```

---

## Error Codes

### Campaign API
- `INVALID_TRANSITION` (400) - Invalid state transition attempted
- `FORBIDDEN` (403) - Cannot modify archived/deleted campaigns
- `VALIDATION_ERROR` (400) - Invalid fields in request

### Images API
- `INSUFFICIENT_BUDGET` (402) - Not enough budget for operation
- `GENERATION_FAILED` (500) - Image generation error

### Videos API
- `APPROVAL_REQUIRED` (403) - Must approve before publishing
- `INVALID_STATUS` (400) - Cannot approve/reject non-completed videos
- `ALREADY_APPROVED` (400) - Video already approved
- `INVALID_TRANSITION` (400) - Invalid state transition

---

## Testing

### Test State Transitions
```bash
# Test invalid campaign transition
curl -X PUT http://localhost:3000/api/v1/campaigns/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "completed"}'
# Expect: 400 with INVALID_TRANSITION

# Test valid campaign transition
curl -X PUT http://localhost:3000/api/v1/campaigns/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "in_progress"}'
# Expect: 200 success
```

### Test Budget Enforcement
```bash
# Create campaign with $0.10 budget
# Launch 5 concurrent image requests (each $0.04)
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/v1/images/generate \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"campaign_id\": \"$CAMPAIGN_ID\",
      \"prompt\": \"test $i\",
      \"model\": \"dalle-3\"
    }" &
done
wait

# Expected: 2 succeed (200), 3 fail (402)
```

### Test Approval Workflow
```bash
# Try to publish without approval
curl -X PATCH http://localhost:3000/api/v1/videos/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "published"}'
# Expect: 403 with APPROVAL_REQUIRED

# Approve video
curl -X POST http://localhost:3000/api/v1/videos/{id}/approve \
  -H "Authorization: Bearer $TOKEN"
# Expect: 200 success

# Now publish
curl -X PATCH http://localhost:3000/api/v1/videos/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status": "published"}'
# Expect: 200 success
```

---

## Common Patterns

### Add State Machine to New Resource
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  initial_state: ['next_state_1', 'next_state_2'],
  next_state_1: ['final_state'],
  // ...
};

function validateTransition(current: string, next: string): boolean {
  return (VALID_TRANSITIONS[current] || []).includes(next);
}

// In API handler
if (newStatus && !validateTransition(current.status, newStatus)) {
  return NextResponse.json(
    { 
      error: { 
        code: 'INVALID_TRANSITION',
        message: `Invalid transition: ${current.status} → ${newStatus}`,
        details: {
          allowedTransitions: VALID_TRANSITIONS[current.status]
        }
      }
    },
    { status: 400 }
  );
}
```

### Add Budget Tracking to Operation
```typescript
// 1. Estimate cost
const estimatedCost = calculateCost(params);

// 2. Reserve budget
const { data: reservation } = await supabase.rpc('reserve_budget', {
  p_campaign_id: campaignId,
  p_amount: estimatedCost
});

if (!reservation?.length) {
  return HTTP 402; // Insufficient budget
}

// 3. Perform operation with try/catch
try {
  const result = await performOperation();
  
  // 4. Update actual cost
  await supabase.rpc('update_actual_cost', {
    p_campaign_id: campaignId,
    p_reserved: estimatedCost,
    p_actual: result.actualCost
  });
} catch (error) {
  // 5. Refund on error
  await supabase.rpc('refund_budget', {
    p_campaign_id: campaignId,
    p_amount: estimatedCost
  });
  throw error;
}
```

---

## Debugging

### Check Budget State
```sql
SELECT 
  campaign_name,
  budget_limit_usd,
  budget_used,
  budget_reserved,
  (budget_limit_usd - budget_used - budget_reserved) as available
FROM campaigns
WHERE id = '<campaign-uuid>';
```

### Check Video Approval Status
```sql
SELECT 
  job_id,
  status,
  approval_status,
  approved_at,
  approved_by,
  rejected_at,
  rejection_reason
FROM generation_jobs
WHERE job_id = '<video-uuid>';
```

### Check State Transition History (if events table exists)
```sql
SELECT 
  created_at,
  entity_type,
  entity_id,
  event_type,
  old_value,
  new_value,
  user_id
FROM audit_events
WHERE entity_id = '<resource-uuid>'
  AND event_type = 'status_change'
ORDER BY created_at DESC;
```

---

## Migration Status

Check if budget functions exist:
```sql
\df reserve_budget
\df update_actual_cost
\df refund_budget
\df get_available_budget
```

Check if columns exist:
```sql
\d campaigns
-- Should show: budget_used, budget_reserved
```

Apply migration if missing:
```bash
cd Brand-Infinity-Engine
supabase migration up
```
