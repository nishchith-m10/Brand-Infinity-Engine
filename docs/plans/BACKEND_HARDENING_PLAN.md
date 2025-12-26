# Backend Hardening & Frontend Enhancement Plan

## Priority Order

| Priority | Area                | Impact                  |
| :------- | :------------------ | :---------------------- |
| **P0**   | Backend Resilience  | Critical for production |
| **P1**   | API Layer Hardening | User-facing stability   |
| **P2**   | File Uploads & n8n  | Feature completion      |
| **P3**   | Observability       | Debugging & monitoring  |
| **P4**   | Testing             | Quality assurance       |
| **P5**   | Frontend Structure  | Code quality & UX       |

---

## P0: Backend Resilience

### 1. Wire Circuit Breaker to API Routes

**Current:** `utils/circuit_breaker.ts` exists but NOT wired
**Action:** Wrap external API calls (OpenAI, Veo, n8n)

**Files to modify:**

- `/api/v1/images/route.ts` - DALL-E calls
- `/api/v1/director/route.ts` - GPT-4 calls
- `/api/v1/brand-assets/route.ts` - embedding generation
- `/api/v1/campaigns/[id]/trigger/route.ts` - n8n webhook

---

### 2. Rate Limiter Wiring

**Current:** `utils/rate_limiter.ts` exists but NOT applied
**Action:** Add middleware wrapper

**Apply strict limits to:**

- `/api/v1/images` - 10/min (AI cost)
- `/api/v1/director` - 20/min
- `/api/v1/campaigns/[id]/trigger` - 5/min

---

### 3. Retry Logic with Exponential Backoff

**Action:** Create `lib/retry.ts` for transient failures

---

## P1: API Layer Hardening

### 1. Centralized Error Handler

**Action:** Create `lib/api-error.ts` with typed errors

```typescript
export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500
  ) {}
}
```

---

### 2. Request Validation Middleware

**Action:** Extract Zod validation to reusable wrapper

---

### 3. Response Standardization

**Action:** Enforce consistent response shape across all endpoints

---

## P2: File Uploads & Real-time n8n Status

### 1. Complete File Upload to Supabase Storage

**Current:** Brand Vault upload shows placeholder toast
**Action:** Implement actual upload

```typescript
// In brand-vault/page.tsx handleUpload
const { data, error } = await supabase.storage
  .from("brand-assets")
  .upload(`${brandId}/${file.name}`, file);

// Then create brand_knowledge_base record with embedding
```

**Steps:**

1. Create `brand-assets` bucket in Supabase Storage
2. Update `/api/v1/brand-assets` POST to handle file URLs
3. Update `brand-vault/page.tsx` with real upload logic
4. Generate embedding after upload

---

### 2. Real-time n8n Workflow Status

**Current:** No real-time updates from n8n
**Action:** Implement Server-Sent Events (SSE)

```typescript
// /api/v1/campaigns/[id]/status/route.ts
export async function GET(req, { params }) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Poll n8n execution status
      // Send updates via SSE
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

**Frontend:**

```typescript
// In campaigns/[id]/page.tsx
useEffect(() => {
  const eventSource = new EventSource(`/api/v1/campaigns/${id}/status`);
  eventSource.onmessage = (e) => setStatus(JSON.parse(e.data));
}, []);
```

---

## P3: Observability

### 1. Structured Logging

**Action:** Create `lib/logger.ts` with levels and metadata

---

### 2. Request ID Propagation

**Action:** Add `x-request-id` header to all requests

---

### 3. Cost Tracking Dashboard Widget

**Current:** `cost_ledger` table exists, no UI
**Action:** Add dashboard widget

```typescript
// GET /api/v1/costs/summary
{
  today: { total: 12.45, breakdown: { openai: 8.20, veo: 4.25 } },
  thisWeek: 87.30,
  thisMonth: 234.50
}
```

**Widget displays:**

- Today's spend
- Service breakdown pie chart
- Weekly trend line

---

### 4. Enhanced Health Check

**Action:** Deep check all dependencies

```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "up", "latency": 45 },
    "redis": { "status": "up", "latency": 12 },
    "n8n": { "status": "up" },
    "openai": { "status": "up" }
  }
}
```

---

## P4: E2E Testing

### 1. Setup Playwright

```bash
npm install -D @playwright/test
npx playwright install
```

---

### 2. Critical Path Tests

**Create `tests/e2e/`:**

| Test                  | What it validates              |
| :-------------------- | :----------------------------- |
| `auth.spec.ts`        | Login → passcode → dashboard   |
| `campaign.spec.ts`    | Create → trigger → status      |
| `review.spec.ts`      | Approve/reject flow            |
| `brand-vault.spec.ts` | Upload asset → appears in list |

---

### 3. Example Test

```typescript
// tests/e2e/campaign.spec.ts
import { test, expect } from "@playwright/test";

test("can create and trigger campaign", async ({ page }) => {
  await page.goto("/campaigns");
  await page.click('[data-testid="create-campaign"]');
  await page.fill("#campaign-name", "Test Campaign");
  await page.click('[data-testid="submit"]');
  await expect(page.locator(".toast-success")).toBeVisible();
});
```

---

### 4. CI Integration

```yaml
# .github/workflows/e2e.yml
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npx playwright test
```

---

## P5: Frontend Structure Cleanup

### 1. Remove Duplicate Components

- Delete `components/Menu.tsx` (sidebar.tsx is used)

---

### 2. Split API Client

**Current:** 489-line `api-client.ts`
**Action:** Split by domain

```
lib/api/
├── client.ts       (axios config)
├── campaigns.ts
├── videos.ts
├── reviews.ts
└── index.ts
```

---

### 3. UI Consistency

- Standardize card padding (p-4 vs p-6)
- Consistent button sizes
- Remove inline styles

---

## Implementation Checklist

### P0: Backend Resilience

- [ ] Wire circuit breaker to `/api/v1/images`
- [ ] Wire circuit breaker to `/api/v1/director`
- [ ] Wire rate limiter to expensive endpoints
- [ ] Add retry logic wrapper

### P1: API Layer

- [ ] Create centralized error handler
- [ ] Extract validation middleware
- [ ] Standardize response format

### P2: Features

- [ ] Complete Supabase Storage file upload
- [ ] Implement SSE for n8n status
- [ ] Add n8n status indicator to campaign detail

### P3: Observability

- [ ] Create structured logger
- [ ] Add request ID tracking
- [ ] Build cost dashboard widget
- [ ] Enhance health check endpoint

### P4: Testing

- [ ] Setup Playwright
- [ ] Write auth flow test
- [ ] Write campaign flow test
- [ ] Write review flow test
- [ ] Add CI workflow

### P5: Frontend

- [ ] Delete Menu.tsx
- [ ] Split api-client.ts
- [ ] UI consistency pass

---

## Files Summary

### New Files

| File                                    | Purpose                     |
| :-------------------------------------- | :-------------------------- |
| `lib/circuit-breaker.ts`                | Frontend-compatible breaker |
| `lib/retry.ts`                          | Retry with backoff          |
| `lib/api-error.ts`                      | Typed errors                |
| `lib/logger.ts`                         | Structured logging          |
| `lib/middleware/rate-limit.ts`          | Rate limit wrapper          |
| `api/v1/campaigns/[id]/status/route.ts` | SSE endpoint                |
| `api/v1/costs/summary/route.ts`         | Cost aggregation            |
| `tests/e2e/*.spec.ts`                   | Playwright tests            |
| `playwright.config.ts`                  | Playwright config           |

### Modify

| File                      | Changes          |
| :------------------------ | :--------------- |
| All `/api/v1/*/route.ts`  | Add wrappers     |
| `brand-vault/page.tsx`    | Real file upload |
| `campaigns/[id]/page.tsx` | SSE status       |
| `dashboard/page.tsx`      | Cost widget      |

### Delete

| File                  | Reason                   |
| :-------------------- | :----------------------- |
| `components/Menu.tsx` | Duplicate of sidebar.tsx |
