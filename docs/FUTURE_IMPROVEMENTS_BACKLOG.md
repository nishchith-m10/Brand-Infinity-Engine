# Brand Infinity Engine - Future Improvements Backlog

> **Purpose**: This file logs improvements that are intentionally deferred. AI assistants should check this file when working on the project to understand what's been planned for the future.

---

## 🔴 HIGH PRIORITY (Next Phase)

### Concurrent Request Processing

- **Current State**: Orchestrator processes 1 request at a time
- **Desired State**: Redis-based queue with configurable concurrency (e.g., 3-5 parallel)
- **Why Deferred**: Focus on core functionality first; scaling comes later
- **Implementation Notes**:
  - Use Bull or BullMQ for Redis-based job queue
  - Add `CONCURRENT_REQUESTS_LIMIT` env variable
  - Implement fair scheduling per user/brand
- **Related Files**:
  - `lib/orchestrator/RequestOrchestrator.ts`
  - `lib/redis/` (existing Redis integration)

---

## 🟡 MEDIUM PRIORITY

### PII Filtering for Brand Assets

- **Current State**: No filtering - assets sent directly to external APIs
- **Desired State**: Scan and optionally redact PII before external calls
- **Why Deferred**: Low risk currently; brand assets usually don't contain personal data
- **What is PII**: Personally Identifiable Information - names, addresses, SSNs, phone numbers, emails, faces in photos
- **Implementation Notes**:
  - Use Azure AI Content Safety or AWS Macie
  - Or lightweight regex-based scanner for text
  - Add opt-in flag per brand: `enable_pii_scanning`
- **Related Files**:
  - `lib/image-processor.ts`
  - `app/api/v1/brand-assets/upload/route.ts`

### Admin Dashboard for Request Management

- **Current State**: No visibility into stuck/failed requests
- **Desired State**: Admin UI to view all requests, retry failed, cancel stuck
- **Why Deferred**: Can be managed via Supabase dashboard temporarily
- **Implementation Notes**:
  - Create `/admin/requests` page (protected route)
  - Add admin role check middleware
  - Display request state machine visualization

---

## 🟢 LOW PRIORITY

### Real-time Progress Updates

- **Current State**: UI polls `/requests/[id]/progress` periodically
- **Desired State**: WebSocket or SSE for instant updates
- **Why Deferred**: Polling works fine for MVP
- **Implementation Notes**:
  - Use Supabase Realtime subscriptions
  - Or add Server-Sent Events endpoint

---

## 📅 Date Logged: 2026-01-16
