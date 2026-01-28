# Phase-by-Phase Execution Plan

## Production Hardening Implementation Roadmap

**Document Version:** 1.0.0
**Created:** January 11, 2026
**Reference:** production_readiness_audit.md
**Estimated Total Effort:** 177 hours across 5 phases
**Execution Model:** Session-based with multi-agent approach per pillar

---

## Executive Summary

This document provides the complete execution roadmap for implementing all fixes and improvements identified in the Production Readiness Audit. The plan is structured as a series of phases, each containing multiple pillars. Each pillar represents a cohesive unit of work that can be executed within a single focused session.

### Execution Philosophy

The execution follows a rigorous multi-perspective approach:

1. **Planning Phase**: Analyze scope, identify all affected files, map dependencies, and document risks before any code changes.

2. **Implementation Phase**: Execute changes with explicit checkpoints, showing each modification before proceeding to the next.

3. **Self-Critique Phase**: Re-read implementation against requirements, actively search for gaps, edge cases, and pattern violations.

4. **Verification Phase**: Run tests, build checks, and validate functionality. Write tests where none exist.

5. **Sign-off Phase**: Review and approval before marking pillar complete.

### Agent Approach by Complexity

| Complexity Level | Agent Configuration                                         | Trigger Criteria                    |
| ---------------- | ----------------------------------------------------------- | ----------------------------------- |
| Low              | Single executor + verifier                                  | 1-2 files, repetitive pattern       |
| Medium           | Planner + 2 executors + verifier                            | 3-5 files, coordination needed      |
| High             | Full swarm (planner + 3 executors + coordinator + verifier) | Cross-cutting, architectural impact |

---

## Phase Overview

| Phase | Focus Area                  | Pillars | Estimated Hours | Priority      |
| ----- | --------------------------- | ------- | --------------- | ------------- |
| I     | Critical Security Hardening | 5       | 19 hours        | P0 - Blocking |
| II    | Reliability Hardening       | 3       | 12 hours        | P0 - Blocking |
| III   | Data Integrity Hardening    | 4       | 15 hours        | P1 - High     |
| IV    | API Layer Improvements      | 5       | 12 hours        | P1 - High     |
| V     | Quality and Polish          | 6       | 17 hours        | P2 - Medium   |

**Total Execution:** 23 pillars across 5 phases, 75 hours of implementation work

**Note:** The 177-hour estimate from the audit includes verification, testing, documentation, and buffer time. The 75 hours above represents pure implementation effort.

---

## Phase I: Critical Security Hardening

### Phase Overview

Phase I addresses the five critical security blockers that must be resolved before any production deployment. These issues represent immediate security vulnerabilities that could be exploited by malicious actors or cause significant financial damage through abuse.

**Phase Duration:** 19 hours
**Session Recommendation:** Complete in 1-2 sessions
**Dependencies:** None (this phase must complete first)
**Verification:** Security-focused testing, penetration testing concepts

---

### Pillar I-1: Webhook Signature Validation

**Issue Reference:** S1 from production_readiness_audit.md Section 12.1.1
**Complexity Level:** Medium
**Agent Configuration:** Planner + 2 executors + verifier
**Estimated Duration:** 2 hours

#### Problem Statement

The N8N callback endpoint at `app/api/v1/callbacks/n8n/route.ts` accepts POST requests without any authentication. Any external party who discovers or guesses the endpoint URL can submit callback payloads, potentially:

- Corrupting request state by triggering invalid status transitions
- Creating duplicate content records
- Manipulating cost tracking entries
- Causing denial of service through fake failure callbacks

#### Current State Analysis

File Location: `app/api/v1/callbacks/n8n/route.ts`

Current implementation:

- Endpoint is publicly accessible
- No header validation
- No signature verification
- Request body is parsed and processed directly
- State mutations occur based on unvalidated input

#### Target State

After implementation:

- All callback requests must include HMAC signature header
- Signature is computed from request body using shared secret
- Requests with missing or invalid signatures are rejected with 401
- N8N workflows are configured to sign outgoing requests
- Shared secret is stored as environment variable

#### Implementation Steps

**Step 1: Create Signature Verification Utility**

Create new file: `lib/security/webhook-signature.ts`

```typescript
// Utility for HMAC signature verification
// - generateSignature(payload, secret) -> string
// - verifySignature(payload, signature, secret) -> boolean
// - extractSignature(headers) -> string | null
```

Functions to implement:

- Use crypto.createHmac with SHA-256 algorithm
- Signature format: `sha256=<hex_digest>`
- Handle both string and buffer payloads
- Timing-safe comparison to prevent timing attacks

**Step 2: Update Callback Route**

Modify: `app/api/v1/callbacks/n8n/route.ts`

Changes:

- Import signature verification utility
- Extract signature from request headers (X-N8N-Signature)
- Get raw request body before JSON parsing
- Verify signature before any processing
- Return 401 Unauthorized on verification failure
- Log verification failures with request metadata for monitoring

**Step 3: Add Environment Variable**

Add to `.env.example` and `.env.local`:

```
N8N_WEBHOOK_SECRET=<generate_secure_random_string>
```

Documentation:

- Minimum 32 characters
- Cryptographically random
- Unique per deployment

**Step 4: Update N8N Workflows**

For each workflow that sends callbacks:

- Add HTTP Request node configuration for signature header
- Compute HMAC of request body
- Include signature in X-N8N-Signature header

Affected workflows:

- Copywriter_Main.json (script completion callback)
- Production_Dispatcher.json (job status callback)
- Video_Assembly.json (assembly completion callback)
- Strategist_Main.json (strategy completion callback)

**Step 5: Verification**

Verification steps:

- Unit test: Signature generation produces expected output
- Unit test: Valid signatures pass verification
- Unit test: Invalid signatures fail verification
- Unit test: Missing signatures fail verification
- Integration test: Callback with valid signature succeeds
- Integration test: Callback with invalid signature returns 401
- Integration test: Callback with missing signature returns 401

#### Files Modified

| File                                     | Action | Lines Changed |
| ---------------------------------------- | ------ | ------------- |
| lib/security/webhook-signature.ts        | Create | ~60 lines     |
| app/api/v1/callbacks/n8n/route.ts        | Modify | ~30 lines     |
| .env.example                             | Modify | +1 line       |
| tests/security/webhook-signature.test.ts | Create | ~100 lines    |

#### Rollback Plan

If issues arise:

1. Set environment variable `N8N_SIGNATURE_BYPASS=true` to temporarily disable verification
2. Revert callback route changes
3. Investigate root cause
4. Re-implement with fixes

#### Success Criteria

- [ ] All callback requests without valid signature return 401
- [ ] All callback requests with valid signature process normally
- [ ] No regression in callback processing functionality
- [ ] Tests pass with 100% coverage on new code
- [ ] N8N workflows successfully send signed callbacks

---

### Pillar I-2: Rate Limiting on High-Cost Routes

**Issue Reference:** S2 from production_readiness_audit.md Section 12.1.1
**Complexity Level:** Low (repetitive pattern)
**Agent Configuration:** Single executor + verifier
**Estimated Duration:** 3 hours

#### Problem Statement

Eight high-cost API endpoints that invoke LLM operations or media generation are not protected by rate limiting. This allows:

- Malicious users to incur significant API costs through rapid requests
- Accidental abuse through buggy client code or retry loops
- Denial of service by exhausting rate limits on upstream providers
- Financial damage from uncontrolled spending

#### Current State Analysis

The existing rate limiting implementation at `lib/ratelimit-edge.ts` uses Upstash Redis and provides:

- Sliding window algorithm
- Configurable limits per identifier
- Fail-open behavior on Redis errors

Currently applied to:

- `/api/auth/login` (5 requests per 30 seconds)
- `/api/verify-passcode` (5 requests per 60 seconds)

Not applied to:

- `/api/v1/conversation/stream`
- `/api/v1/conversation/[id]/continue`
- `/api/v1/images`
- `/api/v1/videos/generate`
- `/api/v1/videos/assemble`
- `/api/v1/briefs/generate`
- `/api/v1/director`
- `/api/v1/scripts/generate`

#### Target State

After implementation:

- All high-cost routes protected with appropriate limits
- Limits based on operation cost and typical usage patterns
- Per-user rate limiting using authenticated user ID
- Fallback to IP-based limiting for edge cases
- Consistent error response format for rate limit exceeded

#### Rate Limit Configuration

| Route                              | Limit | Window | Identifier | Rationale                          |
| ---------------------------------- | ----- | ------ | ---------- | ---------------------------------- |
| /api/v1/conversation/stream        | 20    | 60s    | user_id    | Stream operations are expensive    |
| /api/v1/conversation/[id]/continue | 30    | 60s    | user_id    | Less expensive than stream         |
| /api/v1/images                     | 10    | 60s    | user_id    | Image generation costs ~$0.04 each |
| /api/v1/videos/generate            | 5     | 300s   | user_id    | Video generation is most expensive |
| /api/v1/videos/assemble            | 10    | 300s   | user_id    | Assembly uses FFmpeg resources     |
| /api/v1/briefs/generate            | 20    | 60s    | user_id    | Brief generation uses LLM          |
| /api/v1/director                   | 30    | 60s    | user_id    | Creative director chat             |
| /api/v1/scripts/generate           | 10    | 60s    | user_id    | Script generation uses LLM         |

#### Implementation Steps

**Step 1: Create Rate Limit Configuration**

Create new file: `lib/ratelimit/config.ts`

```typescript
// Centralized rate limit configuration
// - Define limits for each protected route
// - Export configuration object for route handlers
// - Include helper for limit lookup by route pattern
```

**Step 2: Create Rate Limit Middleware Helper**

Create new file: `lib/ratelimit/middleware.ts`

```typescript
// Reusable rate limiting middleware
// - Accept route configuration
// - Extract user ID from session or fall back to IP
// - Apply rate limit check
// - Return standardized error response on limit exceeded
// - Include rate limit headers in response (X-RateLimit-*)
```

**Step 3: Apply to Each Route**

For each of the eight routes:

- Import rate limit middleware
- Apply at start of handler function
- Early return on rate limit exceeded
- Log rate limit violations for monitoring

Pattern to apply:

```typescript
export async function POST(request: Request) {
  const rateLimitResult = await checkRateLimit(request, "conversation/stream");
  if (!rateLimitResult.success) {
    return rateLimitResponse(rateLimitResult);
  }
  // ... existing handler logic
}
```

**Step 4: Add Rate Limit Headers**

All responses should include:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when window resets

**Step 5: Verification**

Verification steps:

- Unit test: Rate limit configuration is valid
- Integration test: Requests within limit succeed
- Integration test: Requests exceeding limit return 429
- Integration test: Rate limit headers are present
- Integration test: Limit resets after window expires
- Load test: Concurrent requests properly limited

#### Files Modified

| File                                           | Action | Lines Changed |
| ---------------------------------------------- | ------ | ------------- |
| lib/ratelimit/config.ts                        | Create | ~50 lines     |
| lib/ratelimit/middleware.ts                    | Create | ~80 lines     |
| app/api/v1/conversation/stream/route.ts        | Modify | +10 lines     |
| app/api/v1/conversation/[id]/continue/route.ts | Modify | +10 lines     |
| app/api/v1/images/route.ts                     | Modify | +10 lines     |
| app/api/v1/videos/generate/route.ts            | Modify | +10 lines     |
| app/api/v1/videos/assemble/route.ts            | Modify | +10 lines     |
| app/api/v1/briefs/generate/route.ts            | Modify | +10 lines     |
| app/api/v1/director/route.ts                   | Modify | +10 lines     |
| app/api/v1/scripts/generate/route.ts           | Modify | +10 lines     |
| tests/ratelimit/middleware.test.ts             | Create | ~150 lines    |

#### Rollback Plan

If issues arise:

1. Set environment variable `RATE_LIMIT_DISABLED=true`
2. Middleware checks this flag and bypasses limiting
3. Investigate and fix configuration issues
4. Re-enable rate limiting

#### Success Criteria

- [ ] All eight routes protected with rate limiting
- [ ] Rate limit headers present in all responses
- [ ] Requests exceeding limit return 429 with retry information
- [ ] User ID-based limiting works for authenticated requests
- [ ] IP-based fallback works for edge cases
- [ ] No regression in normal request flow

---

### Pillar I-3: RLS Policy Fixes

**Issue Reference:** S3 from production_readiness_audit.md Section 12.1.1
**Complexity Level:** High (schema + migration + testing)
**Agent Configuration:** Full swarm (planner + 3 executors + coordinator + verifier)
**Estimated Duration:** 6 hours

#### Problem Statement

Three database tables have overly permissive Row Level Security policies that allow cross-tenant data access:

1. **analytics_events**: Any authenticated user can read all analytics events from all users
2. **platform_configs**: Any authenticated user can access all platform configurations
3. **media_library**: Policy uses `true` predicate, allowing unrestricted access

This violates the multi-tenant isolation requirements and exposes user data across tenant boundaries.

#### Current State Analysis

**analytics_events Table:**

Current policy:

```sql
CREATE POLICY "Users can view analytics" ON analytics_events
FOR SELECT USING (auth.role() = 'authenticated');
```

Problem: No ownership check, all authenticated users see all events.

**platform_configs Table:**

Current policy:

```sql
CREATE POLICY "Users can access configs" ON platform_configs
FOR ALL USING (auth.role() = 'authenticated');
```

Problem: No ownership or organization check.

**media_library Table:**

Current policy:

```sql
CREATE POLICY "Allow all access" ON media_library
FOR ALL USING (true);
```

Problem: Completely open access, no authentication required.

#### Target State

After implementation:

**analytics_events:**

- Add `brand_id` column (foreign key to brands)
- Policy filters by brand ownership chain
- Users only see events for their own brands

**platform_configs:**

- Add `user_id` column (foreign key to auth.users)
- Policy filters by user ownership
- Users only see their own configurations

**media_library:**

- Verify `owner_id` column exists
- Policy filters by owner_id match
- Users only see their own media

#### Implementation Steps

**Step 1: Analyze Current Schema**

Before migration:

- Review current table structures
- Identify existing data that needs backfill
- Document foreign key relationships
- Plan data migration strategy

**Step 2: Create Migration for analytics_events**

Migration file: `database/migrations/[timestamp]_fix_analytics_events_rls.sql`

```sql
-- Add brand_id column
ALTER TABLE analytics_events
ADD COLUMN brand_id UUID REFERENCES brands(id);

-- Backfill brand_id from related data
UPDATE analytics_events ae
SET brand_id = (
  SELECT cr.brand_id
  FROM content_requests cr
  WHERE cr.id = ae.request_id
);

-- Create index for performance
CREATE INDEX idx_analytics_events_brand_id ON analytics_events(brand_id);

-- Drop old policy
DROP POLICY IF EXISTS "Users can view analytics" ON analytics_events;

-- Create new ownership-based policy
CREATE POLICY "Users can view own brand analytics" ON analytics_events
FOR SELECT USING (
  brand_id IN (
    SELECT id FROM brands WHERE user_id = auth.uid()
  )
);

-- Create insert policy
CREATE POLICY "System can insert analytics" ON analytics_events
FOR INSERT WITH CHECK (true);
```

**Step 3: Create Migration for platform_configs**

Migration file: `database/migrations/[timestamp]_fix_platform_configs_rls.sql`

```sql
-- Add user_id column if not exists
ALTER TABLE platform_configs
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Backfill user_id (assume configs belong to creator)
UPDATE platform_configs
SET user_id = auth.uid()
WHERE user_id IS NULL;

-- Create index for performance
CREATE INDEX idx_platform_configs_user_id ON platform_configs(user_id);

-- Drop old policy
DROP POLICY IF EXISTS "Users can access configs" ON platform_configs;

-- Create ownership-based policies
CREATE POLICY "Users can view own configs" ON platform_configs
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own configs" ON platform_configs
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own configs" ON platform_configs
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own configs" ON platform_configs
FOR DELETE USING (user_id = auth.uid());
```

**Step 4: Create Migration for media_library**

Migration file: `database/migrations/[timestamp]_fix_media_library_rls.sql`

```sql
-- Verify owner_id column exists
-- If not, add it
ALTER TABLE media_library
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- Backfill owner_id from existing data
UPDATE media_library ml
SET owner_id = (
  SELECT b.user_id
  FROM brands b
  WHERE b.id = ml.brand_id
)
WHERE owner_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_media_library_owner_id ON media_library(owner_id);

-- Drop permissive policy
DROP POLICY IF EXISTS "Allow all access" ON media_library;

-- Create ownership-based policies
CREATE POLICY "Users can view own media" ON media_library
FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own media" ON media_library
FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own media" ON media_library
FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own media" ON media_library
FOR DELETE USING (owner_id = auth.uid());
```

**Step 5: Update Application Code**

Ensure application code sets ownership columns on insert:

- analytics_events: Include brand_id in event logging
- platform_configs: Include user_id from session
- media_library: Include owner_id from session

**Step 6: Verification**

Verification steps:

- Create test user A and test user B
- User A creates analytics events, configs, and media
- Verify User A can access own data
- Verify User B cannot access User A's data
- Verify new records properly set ownership columns
- Verify existing backfilled data is correctly attributed
- Performance test: Queries with RLS should be performant

#### Files Modified

| File                                                   | Action | Lines Changed           |
| ------------------------------------------------------ | ------ | ----------------------- |
| database/migrations/[ts]\_fix_analytics_events_rls.sql | Create | ~40 lines               |
| database/migrations/[ts]\_fix_platform_configs_rls.sql | Create | ~40 lines               |
| database/migrations/[ts]\_fix_media_library_rls.sql    | Create | ~40 lines               |
| lib/supabase/queries/analytics.ts                      | Modify | +5 lines (add brand_id) |
| lib/supabase/queries/platform-configs.ts               | Modify | +5 lines (add user_id)  |
| lib/supabase/queries/media-library.ts                  | Modify | +5 lines (add owner_id) |
| tests/rls/tenant-isolation.test.ts                     | Create | ~200 lines              |

#### Rollback Plan

If issues arise:

1. Apply rollback migrations to restore permissive policies
2. Keep new columns but with permissive policies
3. Investigate data access patterns
4. Re-implement policies with corrections

Rollback migration template:

```sql
-- Restore permissive policy temporarily
CREATE POLICY "Temporary permissive" ON [table]
FOR ALL USING (auth.role() = 'authenticated');
```

#### Success Criteria

- [ ] All three tables have ownership-based RLS policies
- [ ] Cross-tenant data access is prevented
- [ ] Existing data is properly backfilled with ownership
- [ ] New records automatically get ownership set
- [ ] Query performance is acceptable with RLS
- [ ] No regression in application functionality

---

### Pillar I-4: Silent API Failure Fixes

**Issue Reference:** S4 from production_readiness_audit.md Section 12.1.1
**Complexity Level:** Medium
**Agent Configuration:** Planner + 2 executors + verifier
**Estimated Duration:** 4 hours

#### Problem Statement

Seven API endpoints return HTTP 200 success status even when operations fail. This causes:

- User confusion when operations appear successful but didn't complete
- Data inconsistency from partial operations
- Debugging difficulty when failures aren't surfaced
- Silent data corruption in error scenarios

#### Affected Endpoints

1. **app/api/v1/images/route.ts**: Returns 200 with null URL on OpenAI failures
2. **app/api/v1/videos/[id]/route.ts**: Returns 200 with stale data on database errors
3. **app/api/v1/campaigns/route.ts**: Returns 200 on validation edge cases
4. **app/api/v1/director/route.ts**: Swallows LLM errors and returns partial data
5. **app/api/v1/scripts/generate/route.ts**: Silent failure on generation errors
6. **app/api/v1/callbacks/n8n/route.ts**: Returns 200 on processing failures
7. **app/api/v1/analytics/route.ts**: Fails silently to avoid blocking

#### Target State

After implementation:

- All endpoints return appropriate HTTP status codes
- Error responses include actionable error information
- Consistent error response envelope across all routes
- Client-side can reliably distinguish success from failure
- Logging captures all error scenarios for monitoring

#### Standard Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string; // Machine-readable error code
    message: string; // Human-readable message
    details?: unknown; // Additional context (validation errors, etc.)
    requestId?: string; // Correlation ID for debugging
  };
}

interface SuccessResponse<T> {
  success: true;
  data: T;
}
```

#### Implementation Steps

**Step 1: Create Error Response Utility**

Create new file: `lib/api/response.ts`

```typescript
// Standard response helpers
// - successResponse<T>(data: T) -> NextResponse
// - errorResponse(code, message, status, details?) -> NextResponse
// - validationErrorResponse(errors) -> NextResponse
// - serverErrorResponse(error) -> NextResponse
```

Include:

- Automatic request ID generation
- Stack trace capture in development
- Sanitized error output in production
- Proper HTTP status code mapping

**Step 2: Create Error Code Catalog**

Create new file: `lib/api/error-codes.ts`

```typescript
// Centralized error codes
export const ErrorCodes = {
  // Validation errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_PARAMETER: "INVALID_PARAMETER",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Authentication errors (401)
  UNAUTHENTICATED: "UNAUTHENTICATED",
  INVALID_TOKEN: "INVALID_TOKEN",

  // Authorization errors (403)
  UNAUTHORIZED: "UNAUTHORIZED",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

  // Not found errors (404)
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

  // Conflict errors (409)
  CONFLICT: "CONFLICT",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",

  // Rate limit errors (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server errors (500)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  LLM_ERROR: "LLM_ERROR",
  GENERATION_FAILED: "GENERATION_FAILED",
} as const;
```

**Step 3: Fix Each Affected Endpoint**

For each of the seven endpoints:

**app/api/v1/images/route.ts:**

```typescript
// Before: Return 200 with null URL
// After: Return 500 with LLM_ERROR code if generation fails
if (!imageUrl) {
  return errorResponse(
    ErrorCodes.GENERATION_FAILED,
    "Image generation failed",
    500,
    { provider: "openai", model: "dall-e-3" }
  );
}
```

**app/api/v1/videos/[id]/route.ts:**

```typescript
// Before: Return 200 with stale data
// After: Return 500 with DATABASE_ERROR code
if (dbError) {
  return errorResponse(
    ErrorCodes.DATABASE_ERROR,
    "Failed to retrieve video data",
    500
  );
}
```

**app/api/v1/campaigns/route.ts:**

```typescript
// Before: Return 200 on validation edge cases
// After: Return 400 with specific validation errors
if (!isValid) {
  return validationErrorResponse(validationErrors);
}
```

**app/api/v1/director/route.ts:**

```typescript
// Before: Swallow LLM errors
// After: Return 500 with LLM_ERROR code
if (llmError) {
  return errorResponse(ErrorCodes.LLM_ERROR, "AI processing failed", 500, {
    provider,
    model,
    errorType: llmError.type,
  });
}
```

**app/api/v1/scripts/generate/route.ts:**

```typescript
// Before: Silent failure
// After: Return 500 with GENERATION_FAILED code
if (!script) {
  return errorResponse(
    ErrorCodes.GENERATION_FAILED,
    "Script generation failed",
    500
  );
}
```

**app/api/v1/callbacks/n8n/route.ts:**

```typescript
// Before: Return 200 on processing failures
// After: Return 500 with INTERNAL_ERROR code
// Note: N8N will retry on non-2xx responses
if (processingError) {
  return errorResponse(
    ErrorCodes.INTERNAL_ERROR,
    "Callback processing failed",
    500
  );
}
```

**app/api/v1/analytics/route.ts:**

```typescript
// Before: Fail silently
// After: Log error but still return 200 with partial flag
// Analytics are non-critical, but indicate partial data
return successResponse({
  ...data,
  partial: hasErrors,
  errors: hasErrors ? ["Some metrics unavailable"] : undefined,
});
```

**Step 4: Update Error Logging**

Ensure all error paths:

- Log error with stack trace
- Include request context (route, method, user)
- Include error classification
- Integrate with Sentry for production tracking

**Step 5: Verification**

Verification steps:

- Unit test: Error response format matches specification
- Integration test: Each endpoint returns correct status on error
- Integration test: Error responses include required fields
- Integration test: Success responses unchanged
- Client test: Frontend properly handles error responses

#### Files Modified

| File                                 | Action | Lines Changed |
| ------------------------------------ | ------ | ------------- |
| lib/api/response.ts                  | Create | ~100 lines    |
| lib/api/error-codes.ts               | Create | ~50 lines     |
| app/api/v1/images/route.ts           | Modify | +20 lines     |
| app/api/v1/videos/[id]/route.ts      | Modify | +15 lines     |
| app/api/v1/campaigns/route.ts        | Modify | +15 lines     |
| app/api/v1/director/route.ts         | Modify | +20 lines     |
| app/api/v1/scripts/generate/route.ts | Modify | +15 lines     |
| app/api/v1/callbacks/n8n/route.ts    | Modify | +15 lines     |
| app/api/v1/analytics/route.ts        | Modify | +10 lines     |
| tests/api/error-response.test.ts     | Create | ~150 lines    |

#### Rollback Plan

If issues arise:

- New response utilities are additive, not replacing
- Individual routes can be reverted independently
- Error codes file has no runtime impact if unused

#### Success Criteria

- [ ] All seven endpoints return appropriate HTTP status codes
- [ ] Error responses follow standardized envelope format
- [ ] Error codes are consistent and documented
- [ ] Client-side error handling works correctly
- [ ] No regression in success path behavior
- [ ] Error logging captures all failure scenarios

---

### Pillar I-5: Callback Idempotency

**Issue Reference:** S5 from production_readiness_audit.md Section 12.1.1
**Complexity Level:** Medium
**Agent Configuration:** Planner + 2 executors + verifier
**Estimated Duration:** 4 hours

#### Problem Statement

N8N webhook callbacks are not idempotent. If N8N retries a callback (network issues, timeout, etc.), the duplicate delivery is processed again, causing:

- Duplicate cost ledger entries
- Incorrect request state from double transitions
- Duplicate content records
- Data corruption from non-idempotent operations

#### Current State Analysis

The callback endpoint processes every incoming request regardless of whether it has been seen before. N8N may retry callbacks on:

- Network timeout
- Connection reset
- 5xx response from server
- N8N worker restart

#### Target State

After implementation:

- Every callback includes unique execution ID
- First processing of ID succeeds and stores result
- Subsequent processing of same ID returns cached result
- Idempotency keys expire after reasonable period
- Cleanup job removes old keys periodically

#### Implementation Steps

**Step 1: Create Idempotency Key Table**

Migration file: `database/migrations/[timestamp]_create_idempotency_keys.sql`

```sql
CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  response JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for key lookup
CREATE INDEX idx_idempotency_keys_key ON idempotency_keys(key);

-- Index for cleanup job
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys(expires_at);

-- RLS: System access only (no user access needed)
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON idempotency_keys
FOR ALL USING (auth.role() = 'service_role');
```

**Step 2: Create Idempotency Middleware**

Create new file: `lib/api/idempotency.ts`

```typescript
interface IdempotencyConfig {
  keyExtractor: (request: Request) => string;
  ttlSeconds: number;
}

// Check for existing idempotency key
export async function checkIdempotency(
  key: string
): Promise<{ exists: boolean; response?: unknown }> {
  const existing = await supabase
    .from("idempotency_keys")
    .select("response")
    .eq("key", key)
    .single();

  if (existing.data) {
    return { exists: true, response: existing.data.response };
  }
  return { exists: false };
}

// Store idempotency result
export async function storeIdempotencyResult(
  key: string,
  response: unknown,
  ttlSeconds: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await supabase.from("idempotency_keys").upsert({
    key,
    response,
    expires_at: expiresAt.toISOString(),
  });
}

// Wrap handler with idempotency check
export function withIdempotency(
  config: IdempotencyConfig,
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    const key = config.keyExtractor(request);

    const { exists, response } = await checkIdempotency(key);
    if (exists) {
      return NextResponse.json(response);
    }

    const result = await handler(request);
    const resultData = await result.json();

    await storeIdempotencyResult(key, resultData, config.ttlSeconds);

    return NextResponse.json(resultData);
  };
}
```

**Step 3: Update Callback Route**

Modify: `app/api/v1/callbacks/n8n/route.ts`

```typescript
import { withIdempotency } from "@/lib/api/idempotency";

const callbackHandler = async (request: Request) => {
  // Existing handler logic
};

export const POST = withIdempotency(
  {
    keyExtractor: (req) => {
      const body = req.json();
      // Use N8N execution ID as idempotency key
      return `n8n_callback:${body.executionId}`;
    },
    ttlSeconds: 86400, // 24 hours
  },
  callbackHandler
);
```

**Step 4: Update N8N Workflows**

Ensure all N8N callbacks include execution ID:

```json
{
  "executionId": "{{ $execution.id }}",
  "requestId": "{{ $json.requestId }}",
  "status": "{{ $json.status }}",
  "result": "{{ $json.result }}"
}
```

**Step 5: Create Cleanup Job**

Create scheduled job to remove expired keys:

Option A: Supabase Edge Function (scheduled)

```typescript
// supabase/functions/cleanup-idempotency-keys/index.ts
Deno.serve(async () => {
  await supabase
    .from("idempotency_keys")
    .delete()
    .lt("expires_at", new Date().toISOString());

  return new Response("Cleanup complete");
});
```

Option B: N8N scheduled workflow

```json
{
  "schedule": "0 * * * *", // Every hour
  "action": "DELETE FROM idempotency_keys WHERE expires_at < NOW()"
}
```

**Step 6: Verification**

Verification steps:

- Unit test: Idempotency key generation is consistent
- Unit test: Duplicate keys return cached response
- Unit test: Expired keys are cleaned up
- Integration test: First callback processes normally
- Integration test: Duplicate callback returns cached result
- Integration test: Callback after key expiry processes as new
- Load test: Concurrent duplicate callbacks handled correctly

#### Files Modified

| File                                                  | Action | Lines Changed |
| ----------------------------------------------------- | ------ | ------------- |
| database/migrations/[ts]\_create_idempotency_keys.sql | Create | ~30 lines     |
| lib/api/idempotency.ts                                | Create | ~80 lines     |
| app/api/v1/callbacks/n8n/route.ts                     | Modify | +20 lines     |
| supabase/functions/cleanup-idempotency-keys/index.ts  | Create | ~20 lines     |
| tests/api/idempotency.test.ts                         | Create | ~150 lines    |

#### Rollback Plan

If issues arise:

1. Remove idempotency wrapper from callback route
2. Table remains but is unused
3. Investigate issues
4. Re-implement with fixes

#### Success Criteria

- [ ] Duplicate callbacks return cached response
- [ ] First callback processes and stores result
- [ ] Expired keys are cleaned up automatically
- [ ] No race conditions on concurrent duplicates
- [ ] N8N retry behavior works correctly
- [ ] No regression in callback processing

---

## Phase II: Reliability Hardening

### Phase Overview

Phase II addresses stability blockers that could cause data corruption, lost operations, or system instability under load. These issues may not be immediately exploitable like security issues but will cause problems at scale.

**Phase Duration:** 12 hours
**Session Recommendation:** Complete in 1 session
**Dependencies:** Phase I complete (especially I-5 for callback handling)
**Verification:** Load testing, failure injection

---

### Pillar II-1: N8N Client Retry Logic

**Issue Reference:** R1 from production_readiness_audit.md Section 12.1.2
**Complexity Level:** Medium
**Agent Configuration:** Planner + 2 executors + verifier
**Estimated Duration:** 3 hours

#### Problem Statement

The N8N client at `lib/orchestrator/clients/N8NClient.ts` does not implement retry logic for network failures. If a transient network issue occurs when triggering a workflow:

- The workflow is never triggered
- The request remains in pending state indefinitely
- User sees no error or indication of failure
- Manual intervention required to recover

#### Target State

After implementation:

- Network failures trigger automatic retry with exponential backoff
- Maximum 3 retry attempts before failure
- Retry delays: 1s, 2s, 4s (exponential backoff)
- Circuit breaker integration to prevent hammering failed service
- Failed requests logged with context for debugging

#### Implementation Steps

**Step 1: Create Retry Wrapper**

Enhance `lib/orchestrator/clients/N8NClient.ts`:

```typescript
private async executeWithRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  const maxRetries = 3;
  const baseDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!this.isRetryableError(error)) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw new N8NClientError(
          `N8N operation failed after ${maxRetries} attempts: ${context}`,
          error
        );
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await this.sleep(delay);
    }
  }
}

private isRetryableError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    // Retry on network errors and 5xx responses
    return !error.response || error.response.status >= 500;
  }
  return false;
}
```

**Step 2: Apply to All N8N Operations**

Wrap all external calls:

- triggerWorkflow()
- getExecutionStatus()
- cancelExecution()

**Step 3: Add Circuit Breaker Integration**

```typescript
private circuitBreaker = circuitBreakerManager.get('n8n');

async triggerWorkflow(workflowId: string, data: unknown) {
  return this.circuitBreaker.execute(() =>
    this.executeWithRetry(
      () => this.httpClient.post(`/webhook/${workflowId}`, data),
      `triggerWorkflow:${workflowId}`
    )
  );
}
```

**Step 4: Verification**

- Unit test: Retry on network timeout
- Unit test: No retry on 4xx errors
- Unit test: Retry on 5xx errors
- Unit test: Maximum retries respected
- Integration test: Circuit breaker opens on repeated failures

#### Files Modified

| File                                  | Action        | Lines Changed |
| ------------------------------------- | ------------- | ------------- |
| lib/orchestrator/clients/N8NClient.ts | Modify        | +80 lines     |
| tests/orchestrator/n8n-client.test.ts | Modify/Create | +100 lines    |

#### Success Criteria

- [ ] Transient failures are automatically retried
- [ ] Permanent failures are surfaced appropriately
- [ ] Circuit breaker prevents cascade failures
- [ ] Retry delays follow exponential backoff
- [ ] All retries are logged for debugging

---

### Pillar II-2: Budget Race Condition Fix

**Issue Reference:** R2 from production_readiness_audit.md Section 12.1.2
**Complexity Level:** High
**Agent Configuration:** Full swarm
**Estimated Duration:** 5 hours

#### Problem Statement

Multiple concurrent content generation requests for the same campaign may exceed budget limits due to race conditions:

1. Request A checks budget: $50 remaining, $20 cost = OK
2. Request B checks budget: $50 remaining, $40 cost = OK
3. Both requests proceed simultaneously
4. Actual spend: $60, exceeding $50 limit

#### Target State

After implementation:

- Budget is reserved atomically before operation starts
- Failed operations release reserved budget
- Concurrent requests see accurate available budget
- Budget enforcement is pre-operation, not post-facto

#### Implementation Steps

**Step 1: Add Budget Reservation Table**

```sql
CREATE TABLE budget_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  request_id UUID NOT NULL REFERENCES content_requests(id),
  amount_usd NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_budget_reservations_campaign ON budget_reservations(campaign_id, status);
```

**Step 2: Create Atomic Budget Operations**

Create database function for atomic reservation:

```sql
CREATE OR REPLACE FUNCTION reserve_campaign_budget(
  p_campaign_id UUID,
  p_request_id UUID,
  p_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_limit NUMERIC;
  v_spent NUMERIC;
  v_reserved NUMERIC;
  v_available NUMERIC;
BEGIN
  -- Lock the campaign row
  SELECT budget_limit INTO v_limit
  FROM campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  -- Calculate current spend
  SELECT COALESCE(SUM(cost_usd), 0) INTO v_spent
  FROM cost_ledger
  WHERE campaign_id = p_campaign_id;

  -- Calculate pending reservations
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_reserved
  FROM budget_reservations
  WHERE campaign_id = p_campaign_id
  AND status = 'reserved';

  v_available := v_limit - v_spent - v_reserved;

  IF v_available >= p_amount THEN
    INSERT INTO budget_reservations (campaign_id, request_id, amount_usd)
    VALUES (p_campaign_id, p_request_id, p_amount);
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**Step 3: Update Request Processing**

Before starting generation:

1. Calculate estimated cost
2. Attempt budget reservation
3. If reservation fails, reject request with budget exceeded error
4. On success, proceed with operation
5. On completion, convert reservation to actual cost

**Step 4: Handle Reservation Cleanup**

- Successful completion: Mark reservation as 'converted', log actual cost
- Failed operation: Mark reservation as 'released'
- Timeout: Scheduled job releases stale reservations (>1 hour)

#### Files Modified

| File                                              | Action | Lines Changed |
| ------------------------------------------------- | ------ | ------------- |
| database/migrations/[ts]\_budget_reservations.sql | Create | ~50 lines     |
| lib/budget/reservation.ts                         | Create | ~100 lines    |
| lib/orchestrator/RequestOrchestrator.ts           | Modify | +30 lines     |
| tests/budget/reservation.test.ts                  | Create | ~150 lines    |

#### Success Criteria

- [ ] Concurrent requests cannot exceed budget
- [ ] Rejected requests receive budget exceeded error
- [ ] Failed operations release reservations
- [ ] Timeout cleanup prevents stuck reservations
- [ ] Budget calculations are accurate

---

### Pillar II-3: State Machine Enforcement

**Issue Reference:** R3 from production_readiness_audit.md Section 12.1.2
**Complexity Level:** Medium
**Agent Configuration:** Planner + 2 executors + verifier
**Estimated Duration:** 4 hours

**Status:** ✅ COMPLETE

#### Problem Statement

API endpoints allow direct status updates via PATCH requests, bypassing the state machine. This enables:

- Invalid state transitions (e.g., pending → completed, skipping production)
- Audit trail gaps when transitions don't go through proper channels
- Business logic bypass when preconditions aren't checked

#### Target State

After implementation:

- All status changes must go through StateMachine.transition()
- PATCH endpoints only update non-status fields

#### Verification

- [x] Unit tests (requests & videos) pass: `tests/integration/state-machine-enforcement.test.ts`
- [x] End-to-end workflow test covering transitions passes: `tests/integration/workflows/end-to-end.test.ts`
- [x] Audit events recorded to `request_events` for transitions

#### Implementation Notes

- API transition endpoints enforce allowed transitions (see `app/api/v1/videos/[id]/transition/route.ts` and `app/api/v1/requests/[id]/transition/route.ts`)
- Transition functions are implemented atomically using DB transactions in `lib/database/transactions.ts` and verified by integration tests
- Tests and CI artifacts: test output recorded in `test-results.json` (state machine tests are passing)
- Dedicated transition endpoints for status changes
- Invalid transitions return 400 with explanation

#### Implementation Steps

**Step 1: Audit Current PATCH Endpoints**

Identify all endpoints that accept status in body:

- `/api/v1/requests/[id]` - PATCH
- `/api/v1/campaigns/[id]` - PATCH
- `/api/v1/videos/[id]` - PATCH

**Step 2: Remove Status from Updateable Fields**

```typescript
// Before
const updateSchema = z.object({
  title: z.string().optional(),
  status: z.enum(["pending", "draft", "production"]).optional(),
  // ...
});

// After
const updateSchema = z.object({
  title: z.string().optional(),
  // status removed - not updateable via PATCH
});
```

**Step 3: Create Status Transition Endpoints**

New endpoint: `/api/v1/requests/[id]/transition`

```typescript
export async function POST(request: Request) {
  const { targetStatus, reason } = await request.json();

  const request = await loadRequest(id);
  const result = stateMachine.transition(request.status, targetStatus);

  if (!result.valid) {
    return errorResponse(
      ErrorCodes.INVALID_TRANSITION,
      `Cannot transition from ${request.status} to ${targetStatus}`,
      400,
      { allowedTransitions: result.allowedTransitions }
    );
  }

  await updateRequestStatus(id, targetStatus, reason);
  return successResponse({ status: targetStatus });
}
```

**Step 4: Update Frontend**

Ensure UI uses transition endpoints, not PATCH with status.

#### Files Modified

| File                                         | Action | Lines Changed             |
| -------------------------------------------- | ------ | ------------------------- |
| app/api/v1/requests/[id]/route.ts            | Modify | -10 lines (remove status) |
| app/api/v1/requests/[id]/transition/route.ts | Create | ~60 lines                 |
| app/api/v1/campaigns/[id]/route.ts           | Modify | -10 lines                 |
| tests/state-machine/enforcement.test.ts      | Create | ~100 lines                |

#### Success Criteria

- [ ] PATCH endpoints reject status updates
- [ ] Transition endpoints enforce state machine
- [ ] Invalid transitions return helpful errors
- [ ] All status changes logged with transitions
- [ ] Frontend uses proper transition APIs

---

## Phase III: Data Integrity Hardening

### Phase Overview

Phase III addresses data consistency issues that could cause corruption or loss of data.

**Phase Duration:** 15 hours
**Dependencies:** Phase II complete
**Pillars:** 4 (Transaction wrapping, Soft delete, Indexes, Validation)

---

### Pillar III-1: Transaction Wrapping

**Complexity Level:** High
**Estimated Duration:** 4 hours

Multi-operation workflows need explicit transaction wrapping. Currently, if a request creation succeeds but task creation fails, the request exists without tasks.

**Implementation:**

- Create Supabase RPC functions for atomic operations
- Wrap request creation + task creation in transaction
- Wrap status transition + event logging in transaction
- Handle transaction rollback on any failure

---

### Pillar III-2: Soft Delete Implementation

**Complexity Level:** Medium
**Estimated Duration:** 5 hours

Replace hard deletes with soft deletes for data recovery capability.

**Implementation:**

- Add `deleted_at` column to major tables
- Update all delete operations to set timestamp instead
- Add filter to exclude deleted records in queries
- Create undelete capability for admin recovery
- Update RLS policies to filter deleted records

---

### Pillar III-3: Missing Database Indexes

**Complexity Level:** Low
**Estimated Duration:** 2 hours

Add indexes for frequently queried columns.

**Indexes to add:**

- content_requests(status, created_at)
- content_requests(campaign_id, status)
- request_tasks(request_id, status)
- scripts(brief_id, approval_status)
- videos(script_id, status)

---

### Pillar III-4: Validation Coverage Expansion

**Complexity Level:** Medium
**Estimated Duration:** 4 hours

Add comprehensive Zod validation to 15 routes with partial coverage.

**Implementation:**

- Audit each route for validation gaps
- Create complete schemas
- Add transform/refine for business rules
- Standardize error response format

---

## Phase IV: API Layer Improvements

### Phase Overview

Phase IV addresses API quality issues that affect developer experience and system maintainability.

**Phase Duration:** 12 hours
**Dependencies:** Phase III complete
**Pillars:** 5 (Error standardization, Debug routes, CORS, Documentation, Versioning)

---

### Pillar IV-1: Error Response Standardization

**Complexity Level:** Medium
**Estimated Duration:** 3 hours

Apply consistent error envelope to all 73 routes.

_Note: Partially addressed in I-4, this pillar completes coverage._

---

### Pillar IV-2: Debug Route Protection

**Complexity Level:** Low
**Estimated Duration:** 1 hour

Disable debug routes in production environment.

**Implementation:**

- Add environment check to debug route handlers
- Return 404 in production
- Log access attempts for security monitoring

---

### Pillar IV-3: CORS Configuration Standardization

**Complexity Level:** Low
**Estimated Duration:** 2 hours

Implement consistent CORS across all routes.

**Implementation:**

- Create centralized CORS configuration
- Define allowed origins per environment
- Apply to all API routes consistently
- Include preflight handling

---

### Pillar IV-4: API Documentation Generation

**Complexity Level:** Medium
**Estimated Duration:** 4 hours

Generate OpenAPI specification from route handlers.

**Implementation:**

- Add JSDoc annotations to routes
- Configure documentation generator
- Create Swagger UI page
- Include in development server

---

### Pillar IV-5: API Versioning Strategy

**Complexity Level:** Low
**Estimated Duration:** 2 hours

Document versioning strategy for future evolution.

**Implementation:**

- Document v1 API contract
- Define deprecation timeline policy
- Create version header handling
- Plan v2 migration path

---

## Phase V: Quality and Polish

### Phase Overview

Phase V addresses UI/UX issues and code quality improvements.

**Phase Duration:** 17 hours
**Dependencies:** Phase IV complete
**Pillars:** 6 (Loading states, Design tokens, Accessibility, Testing, Documentation, Performance)

---

### Pillar V-1: Complete Loading States

**Complexity Level:** Low
**Estimated Duration:** 3 hours

Add loading indicators to all async operations.

---

### Pillar V-2: Design Token Standardization

**Complexity Level:** Low
**Estimated Duration:** 2 hours

Replace hardcoded colors with design system tokens.

---

### Pillar V-3: Accessibility Enhancements

**Complexity Level:** Medium
**Estimated Duration:** 4 hours

Add ARIA attributes and keyboard navigation support.

---

### Pillar V-4: Test Coverage Expansion

**Complexity Level:** High
**Estimated Duration:** 4 hours

Add critical path integration tests.

---

### Pillar V-5: Documentation Updates

**Complexity Level:** Low
**Estimated Duration:** 2 hours

Update README and deployment documentation.

---

### Pillar V-6: Performance Optimization

**Complexity Level:** Medium
**Estimated Duration:** 2 hours

Implement identified performance improvements.

---

## Appendix A: Session Handoff Template

When starting a new session, provide this context:

```markdown
## Session Context

**Phase:** [I/II/III/IV/V]
**Pillar:** [Pillar number and name]
**Reference:** docs/plans/phase_execution_plan.md Section [X.X]

**Status of prior pillars:**

- [x] Pillar I-1: Webhook Signature Validation (completed)
- [x] Pillar I-2: Rate Limiting (completed)
- [ ] Pillar I-3: RLS Policy Fixes (current)

**Files modified in prior pillars this phase:**

- lib/security/webhook-signature.ts (created)
- app/api/v1/callbacks/n8n/route.ts (modified)
- lib/ratelimit/middleware.ts (created)

**Relevant environment changes:**

- N8N_WEBHOOK_SECRET added to .env

**Begin execution of current pillar.**
```

---

## Appendix B: Verification Checklist by Phase

### Phase I Verification

- [ ] Callback requests without signature return 401
- [ ] Rate limited routes return 429 when exceeded
- [ ] Cross-tenant data access prevented
- [ ] Error responses include proper status codes
- [ ] Duplicate callbacks return cached response

### Phase II Verification

- [ ] N8N failures retry automatically
- [ ] Budget cannot be exceeded by concurrent requests
- [ ] Invalid status transitions rejected

### Phase III Verification

- [ ] Multi-operation workflows are atomic
- [ ] Deleted records are recoverable
- [ ] Query performance improved with indexes
- [ ] All inputs validated

### Phase IV Verification

- [ ] All errors follow standard format
- [ ] Debug routes disabled in production
- [ ] CORS properly restricts origins
- [ ] API documentation accessible

### Phase V Verification

- [ ] No UI without loading feedback
- [ ] Design tokens used consistently
- [ ] Keyboard navigation works
- [ ] Critical paths have test coverage

---

## Appendix C: Risk Assessment

| Risk                           | Mitigation                | Contingency                         |
| ------------------------------ | ------------------------- | ----------------------------------- |
| Migration breaks existing data | Test on staging first     | Rollback migration + restore backup |
| Rate limiting too aggressive   | Start with lenient limits | Adjust limits without code deploy   |
| RLS blocks legitimate access   | Test all access patterns  | Temporary permissive policy         |
| Circuit breaker flapping       | Tune thresholds           | Disable circuit breaker via flag    |
| Idempotency key collision      | Use UUID format           | Increase key entropy                |

---

**End of Phase Execution Plan**

Document Version: 1.0.0
Generated: January 11, 2026
Total Phases: 5
Total Pillars: 23
Estimated Implementation Hours: 75
Estimated Total Hours (with verification): 177
