# Phase 7 Testing & Verification Checklist

## Overview
This document provides comprehensive testing guidelines for the Phase 7 Request-Centric Pipeline API.

## Quick Start

### Run Unit Tests
```bash
# Install dependencies if needed
cd frontend
npm install

# Run all tests
npm test

# Run specific test suite
npm test -- tests/lib/pipeline/estimator.test.ts
npm test -- tests/lib/pipeline/status-machine.test.ts
npm test -- tests/lib/pipeline/task-factory.test.ts

# Run with coverage
npm test -- --coverage
```

### Run Integration Tests
```bash
# Set environment variables
export BASE_URL="http://localhost:3000"
export BRAND_ID="your-test-brand-id"
export AUTH_TOKEN="your-test-token"

# Run integration test script
./scripts/test-pipeline-api.sh
```

## Unit Test Coverage

### ✅ Estimator Tests (`tests/lib/pipeline/estimator.test.ts`)
- [x] Cost calculation for all request types
- [x] Tier-based pricing (economy < standard < premium)
- [x] Duration scaling for videos
- [x] Voiceover cost inclusion
- [x] Script generation cost
- [x] Image vs video cost comparison
- [x] Carousel slide count scaling
- [x] Edge cases (zero duration, very long videos)
- [x] Consistency (same inputs = same outputs)

**Total Test Cases: 13**

### ✅ Status Machine Tests (`tests/lib/pipeline/status-machine.test.ts`)
- [x] Valid transitions from all statuses
- [x] Invalid transition blocking
- [x] Terminal status enforcement (published, cancelled)
- [x] QA rejection flow (qa → draft)
- [x] Cancellation from any non-terminal state
- [x] Next status calculation
- [x] Stage mapping
- [x] Status labels and colors
- [x] Transition validation with error messages
- [x] Complete workflow scenarios

**Total Test Cases: 25+**

### ✅ Task Factory Tests (`tests/lib/pipeline/task-factory.test.ts`)
- [x] Task creation for all request types
- [x] Voiceover task inclusion/exclusion
- [x] Script generation based on autoScript flag
- [x] Sequential ordering
- [x] Agent role assignment
- [x] Initial status (all pending)
- [x] Retry count initialization (0)
- [x] Task dependencies
- [x] Unique task names
- [x] No duplicate sequence orders

**Total Test Cases: 15+**

## Integration Test Coverage

### ✅ API Integration Tests (`scripts/test-pipeline-api.sh`)

**Test 1: Get Estimate**
- [x] POST /api/v1/requests/estimate
- [x] Returns cost, time, breakdown
- [x] Validates estimation logic

**Test 2: Create Request**
- [x] POST /api/v1/requests
- [x] Returns request ID, status, estimates
- [x] Validates request creation

**Test 3: Get Request Detail**
- [x] GET /api/v1/requests/:id
- [x] Returns request with tasks and events
- [x] Verifies status is 'intake'

**Test 4: List Requests**
- [x] GET /api/v1/requests?brand_id=X
- [x] Returns paginated results
- [x] Includes newly created request

**Test 5: Get Events Timeline**
- [x] GET /api/v1/requests/:id/events
- [x] Returns event array
- [x] Verifies 'created' event exists

**Test 6: Update Request Title**
- [x] PATCH /api/v1/requests/:id
- [x] Updates title successfully
- [x] Returns updated request

**Test 7: Filter by Status**
- [x] GET /api/v1/requests?status=intake
- [x] Returns only matching statuses
- [x] Validates filter logic

**Test 8: Pagination**
- [x] GET /api/v1/requests?page=1&limit=2
- [x] Returns correct page meta
- [x] Validates pagination logic

**Test 9: Cancel Request**
- [x] PATCH /api/v1/requests/:id (status=cancelled)
- [x] Updates status to cancelled
- [x] Validates status transition

**Test 10: Verify Cancelled Event**
- [x] GET /api/v1/requests/:id/events
- [x] Verifies status_changed event logged
- [x] Validates event metadata

**Test 11: Delete Request**
- [x] DELETE /api/v1/requests/:id
- [x] Returns deleted=true
- [x] Validates deletion

**Test 12: Verify Deletion**
- [x] GET /api/v1/requests/:id (should fail)
- [x] Returns 404 NOT_FOUND
- [x] Confirms cascade deletion

**Total Integration Tests: 12**

## Manual Testing Checklist

### Create Request Flow
- [ ] POST to `/api/v1/requests` with valid body returns 201
- [ ] Response includes `id`, `status`, `estimated_cost`, `estimated_time_seconds`
- [ ] Request appears in `content_requests` table
- [ ] Initial tasks are created in `request_tasks` table
- [ ] 'created' event is logged in `request_events` table
- [ ] Request status is `intake`
- [ ] All tasks have status `pending`
- [ ] Task sequence_order is correct
- [ ] Estimated cost matches estimator calculation

### List Requests Flow
- [ ] GET `/api/v1/requests?brand_id=X` returns requests for that brand only
- [ ] Pagination works (`page`, `limit` params)
- [ ] Status filter works (`?status=production`)
- [ ] Type filter works (`?type=video_with_vo`)
- [ ] Results are ordered by created_at DESC
- [ ] Requests from other brands are NOT returned (RLS)
- [ ] Meta includes total, page, limit, pages

### Get Request Detail Flow
- [ ] GET `/api/v1/requests/:id` returns request with relations
- [ ] Tasks are included and sorted by sequence_order
- [ ] Events are included and sorted by created_at DESC
- [ ] Provider metadata is included if exists
- [ ] Returns 404 for invalid ID
- [ ] Returns 403 for request from another brand (RLS)

### Update Request Flow
- [ ] PATCH `/api/v1/requests/:id` with title updates title
- [ ] PATCH with `status: cancelled` cancels the request
- [ ] Cannot update published requests (400)
- [ ] Cannot update cancelled requests (400)
- [ ] Cannot skip statuses (intake → published returns 400)
- [ ] Status change is logged in events with metadata
- [ ] 'updated' event is logged for title changes

### Delete Request Flow
- [ ] DELETE `/api/v1/requests/:id` deletes intake requests
- [ ] DELETE deletes cancelled requests
- [ ] Cannot delete draft/production/qa/published requests (400)
- [ ] Cascade deletes tasks (verify in request_tasks table)
- [ ] Cascade deletes events (verify in request_events table)
- [ ] Cascade deletes provider_metadata

### Estimate Flow
- [ ] POST `/api/v1/requests/estimate` returns cost and time
- [ ] Economy tier is cheaper than premium
- [ ] Video with VO is more expensive than without
- [ ] Longer duration increases cost
- [ ] Breakdown includes all relevant components
- [ ] Total cost matches sum of breakdown

### Retry Flow
- [ ] POST `/api/v1/requests/:id/retry` resets failed tasks to pending
- [ ] Retry count is incremented on failed tasks
- [ ] Tasks at max retries (3) are not reset
- [ ] Retry event is logged with metadata
- [ ] Returns count of tasks retried

### Status Transitions (Database Triggers)
- [ ] intake → draft (allowed)
- [ ] draft → production (allowed)
- [ ] production → qa (allowed)
- [ ] qa → published (allowed)
- [ ] qa → draft (allowed - QA rejection)
- [ ] Any → cancelled (allowed except terminal)
- [ ] published → anything (blocked)
- [ ] cancelled → anything (blocked)
- [ ] intake → published (blocked - skip validation)

### Auto-Advancement
- [ ] When all tasks in 'intake' complete → auto-advance to 'draft'
- [ ] When all tasks in 'draft' complete → auto-advance to 'production'
- [ ] When all tasks in 'production' complete → auto-advance to 'qa'
- [ ] When all tasks in 'qa' complete → auto-advance to 'published'
- [ ] Auto-advance does NOT happen if any task failed
- [ ] Auto-advance logs 'auto_advanced' event

### Events Logging
- [ ] Request creation logs 'created' event
- [ ] Title update logs 'updated' event with metadata
- [ ] Status change logs 'status_changed' event with old/new status
- [ ] Task completion triggers provider_completed event
- [ ] Task failure triggers provider_failed event
- [ ] Retry action logs 'retried' event

## Performance Testing

### Baseline Metrics
- [ ] List 100 requests returns in < 500ms
- [ ] List 1000 requests returns in < 800ms
- [ ] Create request completes in < 200ms
- [ ] Get detail with 50 tasks/events returns in < 300ms
- [ ] Get detail with 100 tasks/events returns in < 500ms

### Database Performance
```sql
-- Check if indexes are being used
EXPLAIN ANALYZE 
SELECT * FROM content_requests 
WHERE brand_id = 'test-brand-id' 
ORDER BY created_at DESC 
LIMIT 10;

-- Should use: brand_id_created_at_idx
```

- [ ] All queries use appropriate indexes
- [ ] No sequential scans on large tables
- [ ] Query execution time < 50ms for indexed queries

## Security Testing

### Authentication
- [ ] Unauthenticated requests return 401
- [ ] Invalid token returns 401
- [ ] Expired token returns 401

### Row-Level Security (RLS)
- [ ] User can only see their brand's requests
- [ ] User cannot update other brand's requests
- [ ] User cannot delete other brand's requests
- [ ] Service role can bypass RLS for webhooks

### Input Validation
- [ ] Invalid request_type returns 400
- [ ] Missing required fields returns 400
- [ ] Invalid UUID format returns 400
- [ ] SQL injection attempts are blocked
- [ ] XSS attempts are sanitized

### Webhook Security
- [ ] Provider webhook requires x-webhook-secret header
- [ ] Invalid secret returns 401
- [ ] Webhook validates idempotency key

## Database Verification

### Schema Verification
```sql
-- Verify all tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%request%';

-- Expected: content_requests, request_tasks, request_events, provider_metadata
```

- [ ] All 4 tables created
- [ ] All 5 custom types created (request_type, request_status, task_status, agent_role, event_type)
- [ ] All indexes created
- [ ] All triggers created
- [ ] All RLS policies enabled

### Data Integrity
- [ ] Foreign key constraints enforced
- [ ] Cascade deletes work correctly
- [ ] Status transitions validated by trigger
- [ ] Auto-advancement trigger works
- [ ] Event logging trigger works

## Test Results Summary

| Test Suite | Total | Passed | Failed | Coverage |
|:-----------|------:|-------:|-------:|---------:|
| Unit Tests | 53+ | - | - | - |
| Integration Tests | 12 | - | - | - |
| Manual Tests | 80+ | - | - | - |
| **Total** | **145+** | **-** | **-** | **-** |

## Known Issues / Limitations

1. **RLS Policies**: Currently simplified to `auth.uid()` checks. Need to enhance when `brand_users` table exists.
2. **Rate Limiting**: Not yet implemented. Should add for production.
3. **Webhook Retry**: Provider callback doesn't have retry mechanism yet.
4. **Task Dependencies**: Not fully enforced in execution order yet.

## Next Steps

1. [ ] Run all unit tests and verify 100% pass
2. [ ] Run integration test script with real Supabase instance
3. [ ] Complete manual testing checklist
4. [ ] Fix any failing tests or bugs found
5. [ ] Document test coverage metrics
6. [ ] Create Postman collection for API testing
7. [ ] Set up CI/CD pipeline for automated testing

## Resources

- **Unit Tests**: `tests/lib/pipeline/*.test.ts`
- **Integration Script**: `scripts/test-pipeline-api.sh`
- **API Documentation**: `docs/API_DOCUMENTATION.md`
- **Database Schema**: `database/migrations/003_phase7_content_requests.sql`
- **Type Definitions**: `frontend/types/pipeline.ts`

---

**Last Updated**: January 4, 2026  
**Phase**: 7 - Request-Centric Pipeline API  
**Status**: Testing & Verification
