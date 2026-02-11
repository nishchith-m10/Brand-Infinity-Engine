# 🔄 Real-Time Data Synchronization Strategy
## Brand Infinity Engine - System Integrity & Performance Audit

> **Document Date:** December 2024  
> **Status:** Strategic Proposal  
> **Priority:** HIGH

---

## Executive Summary

This document audits the current state management and API routing architecture, identifies latency and "ghosting" issues, and proposes a robust synchronization strategy for real-time data consistency.

---

## 1. Current Architecture Audit

### 1.1 Current State Management Stack

| Component | Technology | Status |
|-----------|------------|--------|
| Data Fetching | SWR (stale-while-revalidate) | ✅ Implemented |
| Mutations | React Query (tanstack) | ✅ Partial |
| Global State | React Context | ✅ Implemented |
| Local State | useState/useReducer | ✅ Implemented |
| Caching | SWR + Redis (server) | ⚠️ Inconsistent |
| Real-time | Supabase Realtime | ✅ Enabled |

### 1.2 Current SWR Configuration

```typescript
// Current config in swr-provider.tsx
const swrConfig = {
  fetcher,
  revalidateOnFocus: false,        // ⚠️ Missing updates on tab focus
  revalidateOnReconnect: true,     // ✅ Good
  refreshInterval: 0,              // ⚠️ No auto-refresh by default
  dedupingInterval: 2000,          // ✅ Good
  errorRetryCount: 3,              // ✅ Good
  errorRetryInterval: 5000,        // ✅ Good
  shouldRetryOnError: true,        // ✅ Good
  keepPreviousData: true,          // ✅ Good for UX
};
```

### 1.3 API Routing Structure

```
/api/v1/
├── analytics/          ← No polling
├── brand-assets/       ← Needs refresh after upload
├── brand-identity/     ← Low change frequency
├── briefs/             ← CRITICAL: Needs real-time for approval flow
├── campaigns/          ← Moderate change frequency
│   └── [id]/progress/  ← CRITICAL: Progress tracking
├── conversation/       ← CRITICAL: Chat needs real-time
├── dashboard/stats/    ← Should poll
├── director/           ← Needs refresh after generation
├── publications/       ← Needs real-time for status updates
├── reviews/            ← CRITICAL: Approval workflow
├── scripts/            ← Needs refresh after approval
├── variants/           ← Needs status updates
└── videos/             ← CRITICAL: Generation status
```

---

## 2. Identified Issues

### 2.1 Latency Issues

| Page | Issue | Severity | Root Cause |
|------|-------|----------|------------|
| Dashboard | Stats stale after actions | MEDIUM | No auto-refresh |
| Videos | Status doesn't update | HIGH | No polling during generation |
| Review | Approvals don't reflect | HIGH | No invalidation after mutation |
| Brand Vault | Uploads don't show | HIGH | Cache not invalidated |
| Publishing | Schedule doesn't update | MEDIUM | No refresh after action |

### 2.2 "Ghosting" Issues (Data Visibility Gaps)

| Symptom | Page | Cause |
|---------|------|-------|
| Data appears then disappears | Dashboard | Race condition in loading states |
| Outdated counts | Analytics | No refresh trigger |
| Missing new items | Campaigns | Cache deduplication |
| Stale status badges | Videos | No polling |

### 2.3 Root Causes Analysis

```
1. NO OPTIMISTIC UPDATES
   └─ User action → wait for API → then update UI
   └─ Causes: Perceived slowness, uncertainty

2. NO CACHE INVALIDATION ON MUTATIONS
   └─ Create/Update/Delete doesn't refresh related lists
   └─ Causes: Stale data, missing items

3. NO REAL-TIME SUBSCRIPTIONS
   └─ Long-running tasks (video gen) need polling
   └─ Causes: User must manually refresh

4. INCONSISTENT REFRESH INTERVALS
   └─ Some hooks poll, most don't
   └─ Causes: Unpredictable data freshness
```

---

## 3. Proposed Synchronization Strategy

### 3.1 Three-Tier Approach

```
┌─────────────────────────────────────────────────────────────┐
│                    TIER 1: OPTIMISTIC UI                     │
│  Immediate UI feedback before API confirmation               │
│  → Instant perceived performance                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              TIER 2: SMART CACHE INVALIDATION               │
│  Automatic cache refresh after mutations                     │
│  → Data consistency after actions                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│             TIER 3: REAL-TIME SUBSCRIPTIONS                 │
│  Supabase Realtime for live updates                         │
│  → Multi-user sync, live status updates                     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Implementation Plan

#### Phase 1: Enhanced SWR Configuration (Week 1)

```typescript
// Proposed: Enhanced SWR config
const swrConfig = {
  fetcher,
  revalidateOnFocus: true,         // ✅ Refresh when user returns
  revalidateOnReconnect: true,
  refreshInterval: 0,               // Keep default, set per-hook
  dedupingInterval: 2000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  shouldRetryOnError: true,
  keepPreviousData: true,
  
  // NEW: Global mutation broadcast
  onSuccess: (data, key) => {
    console.log(`[SWR] Success: ${key}`);
  },
  onError: (error, key) => {
    console.error(`[SWR] Error: ${key}`, error);
  },
};
```

#### Phase 2: Optimistic Updates (Week 1-2)

```typescript
// Example: Optimistic approval
const handleApprove = async (item: ReviewItem) => {
  // 1. Optimistic update - instant UI feedback
  mutate(
    '/api/v1/reviews',
    (current: ReviewItem[]) => 
      current?.map(i => 
        i.id === item.id ? { ...i, status: 'approved' } : i
      ),
    false // Don't revalidate yet
  );
  
  try {
    // 2. Actual API call
    await fetch(`/api/v1/${item.type}s/${item.id}/approve`, {
      method: 'POST'
    });
    
    // 3. Revalidate to confirm server state
    mutate('/api/v1/reviews');
    
  } catch (error) {
    // 4. Rollback on error
    mutate('/api/v1/reviews'); // Refresh from server
    showToast({ type: 'error', message: 'Approval failed' });
  }
};
```

#### Phase 3: Smart Cache Invalidation (Week 2)

```typescript
// Create a cache invalidation helper
export const invalidateRelated = (key: string) => {
  const relationships: Record<string, string[]> = {
    // When campaigns change, refresh these
    '/api/v1/campaigns': [
      '/api/v1/dashboard/stats',
      '/api/v1/analytics',
    ],
    // When briefs change
    '/api/v1/briefs': [
      '/api/v1/reviews',
      '/api/v1/campaigns',
    ],
    // When videos change
    '/api/v1/videos': [
      '/api/v1/reviews',
      '/api/v1/dashboard/stats',
    ],
    // When assets change
    '/api/v1/brand-assets': [
      '/api/v1/knowledge-bases',
      `/api/v1/campaigns/${campaignId}/progress`,
    ],
  };
  
  const relatedKeys = relationships[key] || [];
  relatedKeys.forEach(relatedKey => {
    mutate(relatedKey);
  });
};
```

#### Phase 4: Real-Time Subscriptions (Week 3-4)

```typescript
// Supabase Realtime Integration
import { createClient } from '@/lib/supabase/client';

export function useRealtimeVideos(campaignId: string) {
  const { data, mutate } = useV1Videos({ campaign_id: campaignId });
  
  useEffect(() => {
    const supabase = createClient();
    
    const subscription = supabase
      .channel('videos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos',
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          console.log('[Realtime] Video change:', payload);
          mutate(); // Refresh from API
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [campaignId, mutate]);
  
  return { data, mutate };
}
```

### 3.3 Per-Page Configuration

| Page | Strategy | Refresh Interval | Real-time |
|------|----------|------------------|-----------|
| Dashboard | Poll + Invalidate | 30s | Optional |
| Campaigns | On-demand + Invalidate | None | No |
| Brand Vault | Invalidate on upload | None | No |
| Creative Director | Invalidate on generate | None | No |
| Content Review | Optimistic + Invalidate | 15s | ✅ Yes |
| Videos | Poll during generation | 5s (active) | ✅ Yes |
| Distribution | Invalidate on action | None | No |
| Publishing | Invalidate + Poll | 30s | Optional |
| Analytics | Poll | 60s | No |
| Settings | On-demand | None | No |

---

## 4. Implementation Priority

### 4.1 Immediate Actions (This Week)

```typescript
// 1. Update SWR config for better defaults
revalidateOnFocus: true

// 2. Add polling to critical hooks
useV1Videos({ refreshInterval: 10000 }) // Already done
useV1Publications({ refreshInterval: 15000 }) // Already done

// 3. Add manual refresh buttons where missing
<Button onClick={() => mutate()}>
  <RefreshCw /> Refresh
</Button>
```

### 4.2 Short-Term Actions (Next 2 Weeks)

1. **Implement optimistic updates** for:
   - Approval/rejection flows
   - Asset uploads
   - Campaign creation

2. **Add cache invalidation** after:
   - All POST/PUT/DELETE operations
   - File uploads
   - Status changes

3. **Create global mutation broadcaster**:
   - Central place to manage related cache invalidations
   - Logging for debugging

### 4.3 Medium-Term Actions (Next Month)

1. **Enable Supabase Realtime** for:
   - Video generation status
   - Review approval notifications
   - Multi-user collaboration

2. **Build notification system**:
   - Toast notifications for background updates
   - Badge indicators for new items

3. **Implement background sync**:
   - Service worker for offline support
   - Queue mutations when offline

---

## 5. Monitoring & Debugging

### 5.1 Add SWR DevTools

```typescript
// Install: npm install @swr/devtools

import { SWRDevTools } from '@swr/devtools';

function App() {
  return (
    <SWRConfig value={swrConfig}>
      <SWRDevTools />
      {children}
    </SWRConfig>
  );
}
```

### 5.2 Logging Strategy

```typescript
// Add to fetcher for debugging
const fetcher = async (url: string) => {
  const start = Date.now();
  console.log(`[SWR] Fetching: ${url}`);
  
  try {
    const data = await fetch(url).then(r => r.json());
    console.log(`[SWR] Success: ${url} (${Date.now() - start}ms)`);
    return data;
  } catch (error) {
    console.error(`[SWR] Error: ${url}`, error);
    throw error;
  }
};
```

### 5.3 Metrics to Track

| Metric | Target | Current |
|--------|--------|---------|
| Avg API response time | <200ms | Unknown |
| Cache hit rate | >70% | Unknown |
| Revalidation frequency | Optimal | Too low |
| Error rate | <1% | Unknown |
| Time to first data | <500ms | Unknown |

---

## 6. Quick Wins (Implement Today)

### 6.1 Enable Focus Revalidation

```typescript
// In swr-provider.tsx
revalidateOnFocus: true  // Change from false
```

### 6.2 Add Refresh to Dashboard

```typescript
// In dashboard/page.tsx
const { data, mutate, isValidating } = useDashboardStats();

<Button onClick={() => mutate()} disabled={isValidating}>
  <RefreshCw className={isValidating ? 'animate-spin' : ''} />
</Button>
```

### 6.3 Invalidate After Mutations

```typescript
// After any successful mutation
import { mutate } from 'swr';

const handleCreate = async () => {
  await createCampaign(data);
  
  // Invalidate related caches
  mutate('/api/v1/campaigns');
  mutate('/api/v1/dashboard/stats');
};
```

---

## Conclusion

The current architecture has solid foundations but lacks:
1. **Optimistic updates** for perceived performance
2. **Cache invalidation** for data consistency
3. **Real-time subscriptions** for live updates

Implementing the proposed three-tier strategy will eliminate latency and ghosting issues while maintaining the existing SWR-based architecture.

**Estimated Implementation Time:** 2-4 weeks  
**Risk Level:** Low (incremental improvements)  
**Expected Improvement:** 50-70% reduction in perceived latency

---

*This strategy should be reviewed after implementation and adjusted based on actual performance metrics.*

