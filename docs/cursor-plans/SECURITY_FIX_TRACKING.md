# SECURITY FIX TRACKING CHECKLIST

Use this checklist to track progress on security fixes.
Mark items as complete by changing `[ ]` to `[x]`.

---

## 🔴 CRITICAL PRIORITY (Do These First)

### Issue #1: Passcode Authentication Bypass
- [ ] Remove all console.log statements from verify-passcode route
- [ ] Install bcryptjs: `npm install bcryptjs`
- [ ] Generate hashed passcode
- [ ] Add DASHBOARD_PASSCODE_HASH to environment variables
- [ ] Implement bcrypt comparison in verify-passcode route
- [ ] Add rate limiting (5 attempts per 15 minutes)
- [ ] Test: Try brute forcing passcode → should rate limit
- [ ] Test: Verify correct passcode works
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #2: Admin Client Bypasses RLS
- [ ] Replace createAdminClient() in `/api/v1/campaigns/[id]/route.ts` GET method
- [ ] Replace createAdminClient() in `/api/v1/campaigns/[id]/route.ts` PUT method
- [ ] Replace createAdminClient() in `/api/v1/campaigns/[id]/route.ts` DELETE method
- [ ] Replace createAdminClient() in `/api/v1/campaigns/[id]/route.ts` PATCH method
- [ ] Replace createAdminClient() in `/api/v1/campaigns/[id]/trigger/route.ts`
- [ ] Audit all other files using createAdminClient() (use grep)
- [ ] Add authentication checks to all affected routes
- [ ] Test: User A cannot access User B's campaigns
- [ ] Test: Unauthenticated requests return 401
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #3: CORS Wildcard Vulnerability
- [ ] Fix CORS in `/api/v1/conversation/start/route.ts`
- [ ] Fix CORS in `/api/v1/conversation/[id]/route.ts`
- [ ] Add NEXT_PUBLIC_APP_URL to environment variables
- [ ] Create allowedOrigins whitelist
- [ ] Test: Requests from allowed origins work
- [ ] Test: Requests from random origins are blocked
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #4: SQL Injection Risk in Brand Assets Upload
- [ ] Add UUID validation for brandId in upload route
- [ ] Add Zod schema for input validation
- [ ] Sanitize filename more aggressively
- [ ] Test: Invalid brandId is rejected
- [ ] Test: Malicious filename is sanitized
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #5: Missing Authentication on Brand Assets Routes
- [ ] Add auth check to GET `/api/v1/brand-assets`
- [ ] Add auth check to DELETE `/api/v1/brand-assets`
- [ ] Add auth check to PATCH `/api/v1/brand-assets`
- [ ] Add ownership verification for brandId
- [ ] Test: Unauthenticated requests return 401
- [ ] Test: User cannot access another user's brand assets
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

## 🟠 HIGH PRIORITY

### Issue #6: Error Messages Leak Schema
- [ ] Review all error messages in brand-assets upload route
- [ ] Replace detailed errors with generic messages
- [ ] Keep detailed logging server-side only
- [ ] Test: Client receives generic errors
- [ ] Test: Server logs contain full details
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #7: N8N Webhook URL Not Validated
- [ ] Add startup validation for N8N_WEBHOOK_URL
- [ ] Enforce HTTPS in production
- [ ] Remove localhost fallback
- [ ] Test: Missing N8N_WEBHOOK_URL throws error on startup
- [ ] Test: HTTP URL in production throws error
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #8: OpenAI API Key Not Validated
- [ ] Add startup validation for OPENAI_API_KEY
- [ ] Remove lazy initialization pattern
- [ ] Test: Missing OPENAI_API_KEY throws error on startup
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #9: Missing Input Validation in Campaign Trigger
- [ ] Create Zod schemas for all action payloads
- [ ] Validate generate_brief payload
- [ ] Validate generate_script payload
- [ ] Validate generate_video payload
- [ ] Validate publish payload
- [ ] Validate approve/reject payload
- [ ] Test: Invalid payloads are rejected
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #10: Brand Identity Missing Ownership Validation
- [ ] Fix GET method to filter by owner_id
- [ ] Fix PUT method to filter by owner_id
- [ ] Test: User only sees their own brand
- [ ] Test: User cannot update another user's brand
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

## 🟡 MEDIUM PRIORITY

### Issue #11: Missing Rate Limiting on Expensive Operations
- [ ] Add per-operation rate limiter for file uploads
- [ ] Add per-operation rate limiter for OpenAI calls
- [ ] Add per-operation rate limiter for N8N triggers
- [ ] Configure Redis rate limit keys
- [ ] Test: Rate limits trigger correctly
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #12: Missing Soft Delete for Conversations
- [ ] Add deleted_at column to conversation_sessions
- [ ] Update queries to filter out deleted sessions
- [ ] Create restore functionality
- [ ] Test: Deleted sessions don't appear
- [ ] Test: Restore works correctly
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #13: Missing File Type Validation
- [ ] Define allowed MIME types
- [ ] Add file size limit (10MB)
- [ ] Validate file.type against whitelist
- [ ] Sanitize filename aggressively
- [ ] Test: Invalid file types rejected
- [ ] Test: Oversized files rejected
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #14: Redis Keys Not Scoped by User
- [ ] Update CacheKeys to include userId parameter
- [ ] Update all cache get/set calls to include userId
- [ ] Test: User A's cache doesn't leak to User B
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #15: No CSRF Protection
- [ ] Research Next.js CSRF protection options
- [ ] Implement CSRF token validation
- [ ] Add CSRF tokens to forms
- [ ] Test: CSRF attacks are blocked
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

### Issue #16: Knowledge Base Access Not Validated
- [ ] Add ownership check in GET `/api/v1/knowledge-bases/[id]`
- [ ] Verify RLS policies on knowledge_bases table
- [ ] Test: User cannot access another user's KB
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

## 🟢 LOW PRIORITY / CODE QUALITY

### Issue #17: Inconsistent Error Handling
- [ ] Audit all routes for error handling
- [ ] Standardize on handleApiError() utility
- [ ] Update routes to use consistent error format
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### Issue #18: Missing Input Sanitization
- [ ] Install DOMPurify or similar
- [ ] Sanitize campaign names before storage
- [ ] Sanitize brand descriptions before storage
- [ ] Sanitize all user-generated text fields
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### Issue #19: No Request Size Limits
- [ ] Add body size limit in Next.js config
- [ ] Test: Large payloads are rejected
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### Issue #20: Conversation History Not Paginated
- [ ] Add offset parameter to getSessionMessages
- [ ] Implement cursor-based pagination
- [ ] Update API to support pagination params
- [ ] Test: Long conversations can be fully retrieved
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### Issue #21: No Webhook Signature Verification
- [ ] Add HMAC signature to N8N webhook payloads
- [ ] Implement signature verification for callbacks
- [ ] Test: Invalid signatures are rejected
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### Issue #22: Cost Tracking Precision Issues
- [ ] Update cost_usd column to NUMERIC(10, 8)
- [ ] Run migration on database
- [ ] Test: Small costs are tracked accurately
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### Issue #23: Environment Variables Not Documented
- [x] Create .env.example file
- [ ] Document all required variables
- [ ] Add comments explaining each variable
- [ ] Update README with environment setup instructions

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### Issue #24: No Security Event Logging
- [ ] Install logging library (Winston/Pino)
- [ ] Add logging for failed login attempts
- [ ] Add logging for unauthorized access attempts
- [ ] Add logging for sensitive operations
- [ ] Set up log aggregation (optional)
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### Issue #25: Service Role Key Exposure Risk
- [ ] Rename admin.ts to admin.server.ts
- [ ] Add runtime check for window !== undefined
- [ ] Test: Error thrown if used client-side
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### Issue #26: Progress API Logic Bug
- [ ] Fix brand_id vs campaign_id confusion
- [ ] Fetch campaign first, then use its brand_id
- [ ] Test: Progress shows correct asset count
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

## HARDENING TASKS

### H1: Content Security Policy
- [ ] Define CSP directives
- [ ] Add CSP headers to next.config.ts
- [ ] Test: No CSP violations in development
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### H2: Request ID Tracing
- [ ] Add request ID middleware
- [ ] Include request ID in all log messages
- [ ] Return request ID in error responses
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### H3: API Versioning Cleanup
- [ ] Audit all /api/* routes
- [ ] Move to /api/v1/* consistently
- [ ] Update frontend API calls
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### H4: Health Check Endpoint Security
- [ ] Review health check endpoint
- [ ] Remove internal service names/versions
- [ ] Add authentication for detailed health info
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### H5: Database Connection Pooling
- [ ] Research Supabase connection pooling
- [ ] Configure connection pool settings
- [ ] Test under load
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

## DATABASE TASKS

### RLS Policy Verification
- [ ] Run RLS verification script
- [ ] Fix campaigns table RLS (if missing)
- [ ] Fix brands table RLS (if missing)
- [ ] Fix brand_knowledge_base table RLS (if missing)
- [ ] Fix knowledge_bases table RLS (if missing)
- [ ] Test: RLS prevents unauthorized access
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

## N8N INTEGRATION HARDENING

### N8N Reliability Improvements
- [ ] Add retry logic with exponential backoff
- [ ] Implement circuit breaker pattern
- [ ] Add webhook signature verification
- [ ] Add rate limiting for N8N calls
- [ ] Test: Failed N8N calls retry correctly
- [ ] Test: Circuit breaker opens after failures
- [ ] Deploy to production

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

## TESTING & DEPLOYMENT

### Final Testing Before Production
- [ ] Run all unit tests
- [ ] Run integration tests
- [ ] Perform manual security testing
- [ ] Test with multiple user accounts
- [ ] Test rate limiting
- [ ] Test file upload edge cases
- [ ] Load testing
- [ ] Security scan (OWASP ZAP or similar)

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________

---

### Production Deployment Checklist
- [ ] Update all environment variables
- [ ] Run database migrations
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Smoke test critical paths
- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Set up alerts for security events

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
**Assigned to:** _____________
**Completed:** _____/_____/_____

---

## SUMMARY

**Total Issues:** 26 security vulnerabilities + 5 hardening tasks + database & N8N improvements
**Critical:** 5 issues
**High:** 5 issues
**Medium:** 6 issues
**Low:** 10 issues

**Estimated Total Time:** 3-4 weeks for complete remediation

---

## NOTES & BLOCKERS

_Use this space to track any blockers, questions, or important notes:_

1. 

2. 

3. 

---

**Last Updated:** _____/_____/_____
**Updated By:** _____________

