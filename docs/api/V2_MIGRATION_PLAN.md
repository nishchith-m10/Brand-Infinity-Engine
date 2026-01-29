# API v1 to v2 Migration Planning Guide

**Status**: 📋 Planning  
**Target Release**: TBD (H2 2026)  
**Minimum Deprecation Period**: 180 days  
**Migration Complexity**: Medium-High

---

## 1. Executive Summary

This document outlines the planned breaking changes for API v2 and provides a migration strategy for clients currently using v1. The v2 API will modernize the data model, improve consistency, and add new capabilities while learning from v1 usage patterns.

**Key Changes**:
- Simplified resource naming conventions
- Consistent pagination across all endpoints
- Improved budget/cost model with multi-currency support
- Enhanced webhook event system
- GraphQL alternative endpoint (optional)
- Streamlined approval workflows

---

## 2. Proposed Breaking Changes

### 2.1 Resource Naming Standardization

**Change**: Pluralize all resource names consistently

| v1 Endpoint | v2 Endpoint | Notes |
|-------------|-------------|-------|
| `/brand-identity` | `/brands/{id}/identity` | Nested under brand resource |
| `/brand-assets` | `/brands/{id}/assets` | Nested under brand resource |
| `/knowledge-bases` | `/knowledge-base-entries` | Singular resource name |
| `/scripts/[id]/hooks` | `/scripts/{id}/production-hooks` | More descriptive |

**Impact**: Medium - Requires URL updates in all clients

### 2.2 Pagination Model

**Change**: Cursor-based pagination for all list endpoints

**v1 (Offset-based)**:
```typescript
GET /api/v1/campaigns?limit=20&offset=40

Response:
{
  data: [...],
  meta: { count: 150, limit: 20, offset: 40 }
}
```

**v2 (Cursor-based)**:
```typescript
GET /api/v2/campaigns?limit=20&cursor=eyJ0aW1lc3RhbXAiOi...

Response:
{
  data: [...],
  pagination: {
    next_cursor: "eyJpZCI6MTIzfQ...",
    has_more: true,
    limit: 20
  }
}
```

**Benefits**:
- No missing records when data changes during pagination
- Better performance on large datasets
- Prevents "page drift" issues

**Impact**: High - All list endpoint clients need updates

### 2.3 Budget and Cost Model

**Change**: Multi-currency support with structured budget object

**v1**:
```typescript
{
  budget_tier: "premium",  // Simple enum
  estimated_cost: 150.50   // Just a number
}
```

**v2**:
```typescript
{
  budget: {
    tier: "premium",
    currency: "USD",
    allocated: { amount: 500.00, currency: "USD" },
    spent: { amount: 150.50, currency: "USD" },
    remaining: { amount: 349.50, currency: "USD" }
  },
  cost_breakdown: {
    text_generation: { amount: 25.00, currency: "USD" },
    image_generation: { amount: 50.00, currency: "USD" },
    video_generation: { amount: 75.50, currency: "USD" }
  }
}
```

**Benefits**:
- Multi-currency support
- Transparent cost breakdown
- Better budget tracking

**Impact**: High - Requires schema updates and display logic changes

### 2.4 Webhook Event Model

**Change**: Unified webhook event structure with event types

**v1 (N8N-specific)**:
```typescript
POST /api/v1/callbacks/n8n
{
  request_id: "...",
  task_id: "...",
  status: "completed",
  output: { ... }
}
```

**v2 (Generic webhook events)**:
```typescript
POST /api/v2/webhooks/events
{
  event_id: "evt_...",
  event_type: "request.task.completed",
  event_version: "2.0",
  timestamp: "2026-01-11T21:30:00Z",
  data: {
    request_id: "...",
    task_id: "...",
    status: "completed",
    output: { ... }
  },
  metadata: {
    source: "n8n",
    idempotency_key: "..."
  }
}
```

**Benefits**:
- Support for multiple webhook providers
- Event versioning for backward compatibility
- Idempotency built-in
- Standardized event types

**Impact**: High - Requires webhook endpoint updates

### 2.5 Timestamp Format Standardization

**Change**: Always use millisecond precision for timestamps

**v1 (Inconsistent)**:
```typescript
{
  created_at: "2026-01-11T21:30:00Z",      // Second precision
  updated_at: "2026-01-11T21:30:00.123Z"   // Millisecond precision
}
```

**v2 (Consistent)**:
```typescript
{
  created_at: "2026-01-11T21:30:00.000Z",  // Always milliseconds
  updated_at: "2026-01-11T21:30:00.123Z"
}
```

**Impact**: Low - Most clients handle this automatically

### 2.6 Error Response Enhancements

**Change**: Add machine-readable error categories

**v1**:
```typescript
{
  error: {
    code: "DATABASE_ERROR",
    message: "..."
  }
}
```

**v2**:
```typescript
{
  error: {
    code: "DATABASE_ERROR",
    category: "server_error",     // New: client_error, server_error, network_error
    message: "...",
    retry_after: 30,               // New: Seconds to wait before retry
    is_retryable: false,           // New: Whether client should retry
    documentation_url: "https://..." // New: Link to error docs
  }
}
```

**Impact**: Low - Additive, clients can ignore new fields

### 2.7 Approval Workflow Simplification

**Change**: Single unified approval endpoint

**v1 (Multiple endpoints)**:
```typescript
POST /api/v1/briefs/{id}/approve
POST /api/v1/scripts/{id}/approve
POST /api/v1/videos/{id}/approve
```

**v2 (Unified)**:
```typescript
POST /api/v2/approvals
{
  resource_type: "brief" | "script" | "video",
  resource_id: "...",
  action: "approve" | "reject" | "request_changes",
  notes: "...",
  changes_requested: { ... }  // Only if action is request_changes
}
```

**Benefits**:
- Consistent approval logic
- Support for "request changes" action
- Easier to track approval history

**Impact**: Medium - Requires client logic updates

---

## 3. Non-Breaking Additions (Safe to Add)

### 3.1 GraphQL Alternative

Offer GraphQL endpoint alongside REST:
```
POST /api/v2/graphql
```

Clients can opt-in to use GraphQL while REST v2 remains fully supported.

### 3.2 Batch Operations

Add batch endpoints for common operations:
```typescript
POST /api/v2/batch/publications/create
{
  items: [
    { variant_id: "...", scheduled_time: "..." },
    { variant_id: "...", scheduled_time: "..." }
  ]
}
```

### 3.3 Field Selection (Partial Responses)

Support `fields` query parameter to reduce payload size:
```
GET /api/v2/campaigns?fields=id,name,status
```

### 3.4 Expanded Filters

Add more filter options to list endpoints:
```
GET /api/v2/campaigns?created_after=2026-01-01&status_in=draft,active
```

---

## 4. Migration Timeline

### 4.1 Proposed Schedule

| Milestone | Target Date | Activities |
|-----------|-------------|------------|
| **Planning Complete** | Q1 2026 | Finalize v2 design, gather feedback |
| **Alpha Release** | Q2 2026 | Internal testing, API contract draft |
| **Beta Release** | Q3 2026 | Early access for select clients, feedback iteration |
| **v2 GA** | Q4 2026 | Public release, v1 enters deprecated status |
| **v1 Deprecation Notice** | Q4 2026 | 180-day countdown begins |
| **v1 Sunset** | Q2 2027 | v1 retired, returns HTTP 410 |

### 4.2 Parallel Operation

**Duration**: Q4 2026 - Q2 2027 (180 days minimum)

During this period:
- Both v1 and v2 active simultaneously
- Shared database ensures consistency
- Changes in v1 visible in v2 and vice versa
- Gradual client migration with monitoring

---

## 5. Migration Strategy

### 5.1 Phase 1: Preparation (Q2-Q3 2026)

**Client Actions**:
1. Review v2 API contract and migration guide
2. Set up test environment with v2 beta access
3. Create migration checklist for your integration
4. Identify breaking changes affecting your use case
5. Plan internal migration timeline

**Platform Actions**:
1. Publish comprehensive v2 API documentation
2. Provide sandbox environment with v2 beta
3. Offer migration workshops and office hours
4. Create code samples and SDKs for v2

### 5.2 Phase 2: Testing (Q3 2026)

**Client Actions**:
1. Update SDK or HTTP client to support v2
2. Update request/response schemas
3. Write integration tests for v2 endpoints
4. Test error handling and edge cases
5. Performance test with production-like load

**Platform Actions**:
1. Monitor beta usage and collect feedback
2. Fix reported issues and improve documentation
3. Provide migration assistance on request
4. Publish migration success stories

### 5.3 Phase 3: Migration (Q4 2026 - Q1 2027)

**Client Actions**:
1. Deploy v2 integration to staging
2. Run parallel testing (v1 and v2 side-by-side)
3. Gradual rollout to production (canary deployment)
4. Monitor metrics and error rates
5. Complete migration to v2, deprecate v1 client code

**Platform Actions**:
1. Monitor v1 vs v2 traffic distribution
2. Provide migration support via dedicated channels
3. Send deprecation reminders (T+90, T+150)
4. Track client migration progress

### 5.4 Phase 4: Cleanup (Q2 2027)

**Client Actions**:
1. Remove v1 client code and dependencies
2. Update documentation to reference v2 only
3. Archive v1 integration tests

**Platform Actions**:
1. Retire v1 endpoints (return HTTP 410)
2. Remove v1 code from codebase
3. Publish post-migration report
4. Begin planning for v3 (if needed)

---

## 6. Code Migration Examples

### 6.1 Campaign Creation

**v1**:
```typescript
const response = await fetch('/api/v1/campaigns', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Summer Sale',
    budget_tier: 'premium',
    brand_id: 'brand-uuid'
  })
});

const { success, data } = await response.json();
```

**v2**:
```typescript
const response = await fetch('/api/v2/campaigns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Version': '2'  // Optional, can also use /api/v2/
  },
  body: JSON.stringify({
    name: 'Summer Sale',
    budget: {
      tier: 'premium',
      currency: 'USD',
      allocated: { amount: 500, currency: 'USD' }
    },
    brand_id: 'brand-uuid'
  })
});

const { success, data } = await response.json();
```

### 6.2 Pagination

**v1**:
```typescript
async function getAllCampaigns() {
  let offset = 0;
  const limit = 20;
  const allCampaigns = [];
  
  while (true) {
    const response = await fetch(
      `/api/v1/campaigns?limit=${limit}&offset=${offset}`
    );
    const { data, meta } = await response.json();
    
    allCampaigns.push(...data);
    
    if (offset + limit >= meta.count) break;
    offset += limit;
  }
  
  return allCampaigns;
}
```

**v2**:
```typescript
async function getAllCampaigns() {
  let cursor = null;
  const limit = 20;
  const allCampaigns = [];
  
  while (true) {
    const url = cursor
      ? `/api/v2/campaigns?limit=${limit}&cursor=${cursor}`
      : `/api/v2/campaigns?limit=${limit}`;
      
    const response = await fetch(url);
    const { data, pagination } = await response.json();
    
    allCampaigns.push(...data);
    
    if (!pagination.has_more) break;
    cursor = pagination.next_cursor;
  }
  
  return allCampaigns;
}
```

### 6.3 Approvals

**v1**:
```typescript
await fetch(`/api/v1/scripts/${scriptId}/approve`, {
  method: 'POST',
  body: JSON.stringify({ notes: 'Looks good!' })
});
```

**v2**:
```typescript
await fetch('/api/v2/approvals', {
  method: 'POST',
  body: JSON.stringify({
    resource_type: 'script',
    resource_id: scriptId,
    action: 'approve',
    notes: 'Looks good!'
  })
});
```

---

## 7. Testing Recommendations

### 7.1 Unit Tests

Update test suites to cover:
- [ ] Request body schema changes
- [ ] Response envelope parsing
- [ ] Error handling for new error structure
- [ ] Pagination logic (cursor vs offset)

### 7.2 Integration Tests

Test end-to-end workflows:
- [ ] Campaign creation → brief → script → video → publish
- [ ] Approval workflows with all actions
- [ ] Webhook event handling
- [ ] Error scenarios and retries

### 7.3 Load Tests

Verify performance under load:
- [ ] Compare v1 vs v2 response times
- [ ] Test cursor pagination with large datasets
- [ ] Concurrent request handling
- [ ] Rate limiting behavior

---

## 8. Rollback Plan

If critical issues discovered after v2 release:

1. **Immediate**: Hotfix deployment if possible
2. **Communication**: Announce issue via status page
3. **Extension**: Extend v1 support period by 90 days
4. **Fix**: Address v2 issues in patch release
5. **Resume**: Resume deprecation timeline once stable

---

## 9. Support During Migration

### 9.1 Resources Available

- **Documentation**: `/docs/api/v2/` (coming Q2 2026)
- **Migration Guide**: This document
- **Code Samples**: GitHub repository with examples
- **SDKs**: Updated client libraries for v2
- **Support Channel**: GitHub Discussions or email

### 9.2 Office Hours

Scheduled migration assistance sessions:
- **Frequency**: Weekly during beta period
- **Duration**: 1 hour
- **Format**: Live Q&A, screen sharing for debugging

---

## 10. Success Metrics

Track migration success by:
- **v2 Adoption**: Percentage of traffic on v2
- **Error Rate**: Compare v1 vs v2 error rates
- **Client Satisfaction**: Survey clients about migration experience
- **Support Load**: Number of migration-related support tickets
- **Timeline**: On-time completion of migration phases

**Target**: 95% of traffic on v2 by v1 sunset date

---

## 11. Feedback and Iteration

**Beta Feedback Process**:
1. Submit feedback via GitHub Issues with label `v2-beta`
2. Weekly review of feedback by API team
3. Breaking change proposals evaluated within 48 hours
4. Non-breaking improvements prioritized in backlog

**Feedback Deadline**: 30 days before v2 GA release

---

## 12. Long-Term API Evolution

### 12.1 Lessons Learned from v1

**What Worked**:
- Consistent response envelopes
- Clear error codes
- Session-based authentication
- Nested resource structure

**Improvement Areas**:
- Pagination for large datasets
- Multi-currency support
- Webhook standardization
- Batch operations

### 12.2 Future Considerations (v3+)

Potential future enhancements (not v2):
- Real-time subscriptions (WebSockets)
- Advanced query language (like GraphQL filters)
- API usage analytics dashboard
- Automatic retry with exponential backoff
- Client SDK auto-generation

---

## 13. Document Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-01-11 | Initial draft | GitHub Copilot |

---

## 14. Next Steps

1. **Q1 2026**: Gather stakeholder feedback on proposed changes
2. **Q2 2026**: Finalize v2 specification and begin implementation
3. **Q3 2026**: Beta release and client testing
4. **Q4 2026**: GA release and deprecation notice for v1

---

**Document Status**: 📋 Draft  
**Stakeholder Review**: Pending  
**Target Finalization**: Q1 2026  
**Last Updated**: January 11, 2026
