# Phase 7 Pipeline API - Frontend Integration Guide

## Overview

This guide helps frontend developers integrate with the Phase 7 Request-Centric Pipeline API. All React hooks are ready to use with SWR for automatic caching and revalidation.

## Quick Start

### 1. Install Dependencies

```bash
npm install swr
```

### 2. Import Hooks

```typescript
import {
  useRequests,
  useRequest,
  useCreateRequest,
  useUpdateRequest,
  useDeleteRequest,
  useEstimate,
  useRetryRequest,
  useRequestEvents
} from '@/lib/hooks';
```

## Hooks Reference

### `useRequests` - List Content Requests

Fetch and filter content requests with automatic pagination.

**Usage:**

```typescript
import { useRequests } from '@/lib/hooks';

function RequestsList() {
  const { 
    requests, 
    isLoading, 
    error, 
    meta,
    refresh 
  } = useRequests({
    brandId: 'brand-123',
    status: 'production',  // optional filter
    type: 'video_with_vo', // optional filter
    page: 1,
    limit: 10
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {requests.map(request => (
        <RequestCard key={request.id} request={request} />
      ))}
      <Pagination 
        currentPage={meta.page} 
        totalPages={meta.pages} 
      />
    </div>
  );
}
```

**Options:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `brandId` | `string` | Yes | Brand ID to fetch requests for |
| `status` | `RequestStatus` | No | Filter by status |
| `type` | `RequestType` | No | Filter by type |
| `page` | `number` | No | Page number (default: 1) |
| `limit` | `number` | No | Items per page (default: 10) |
| `enabled` | `boolean` | No | Enable/disable fetching (default: true) |

**Returns:**

| Property | Type | Description |
|:---------|:-----|:------------|
| `requests` | `ContentRequest[]` | Array of requests |
| `meta` | `PaginationMeta` | Pagination metadata |
| `isLoading` | `boolean` | Loading state |
| `isError` | `boolean` | Error state |
| `error` | `string \| null` | Error message |
| `refresh` | `() => void` | Manually refresh data |
| `hasMore` | `boolean` | Whether more pages exist |
| `currentPage` | `number` | Current page number |
| `totalPages` | `number` | Total pages available |
| `totalCount` | `number` | Total request count |

---

### `useRequest` - Get Single Request Details

Fetch a single request with all tasks, events, and metadata.

**Usage:**

```typescript
import { useRequest } from '@/lib/hooks';

function RequestDetail({ requestId }: { requestId: string }) {
  const { 
    request, 
    tasks, 
    events,
    isLoading,
    progress,
    canCancel,
    refresh
  } = useRequest({ 
    requestId,
    refreshInterval: 5000 // Poll every 5 seconds
  });

  if (isLoading) return <div>Loading...</div>;
  if (!request) return <div>Request not found</div>;

  return (
    <div>
      <h1>{request.title}</h1>
      <ProgressBar value={progress} />
      <TaskList tasks={tasks} />
      <EventTimeline events={events} />
      {canCancel && <CancelButton onClick={() => {/* ... */}} />}
    </div>
  );
}
```

**Options:**

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `requestId` | `string \| null` | Yes | Request ID to fetch |
| `enabled` | `boolean` | No | Enable/disable fetching |
| `refreshInterval` | `number` | No | Auto-refresh interval in ms |

**Returns:**

| Property | Type | Description |
|:---------|:-----|:------------|
| `request` | `DetailedContentRequest \| undefined` | Full request object |
| `tasks` | `RequestTask[]` | Associated tasks |
| `events` | `RequestEvent[]` | Event timeline |
| `status` | `RequestStatus \| undefined` | Current status |
| `progress` | `number` | Completion percentage (0-100) |
| `isComplete` | `boolean` | Whether request is finished |
| `canCancel` | `boolean` | Whether cancel is allowed |
| `canDelete` | `boolean` | Whether delete is allowed |
| `canRetry` | `boolean` | Whether retry is available |
| `isLoading` | `boolean` | Loading state |
| `error` | `string \| null` | Error message |
| `refresh` | `() => void` | Manually refresh |

---

### `useCreateRequest` - Create New Request

Create a new content request.

**Usage:**

```typescript
import { useCreateRequest } from '@/lib/hooks';

function CreateRequestForm() {
  const { createRequest, isCreating, error } = useCreateRequest();

  const handleSubmit = async (formData) => {
    try {
      const newRequest = await createRequest({
        brand_id: 'brand-123',
        title: 'My Video Request',
        type: 'video_with_vo',
        requirements: {
          prompt: 'A sunset over mountains',
          duration: 30,
          aspect_ratio: '16:9'
        },
        settings: {
          tier: 'standard',
          auto_script: true
        }
      });
      
      // Navigate to new request or show success
      router.push(`/requests/${newRequest.id}`);
    } catch (err) {
      console.error('Failed to create request:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button disabled={isCreating}>
        {isCreating ? 'Creating...' : 'Create Request'}
      </button>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </form>
  );
}
```

**Returns:**

| Property | Type | Description |
|:---------|:-----|:------------|
| `createRequest` | `(input: CreateRequestInput) => Promise<ContentRequest>` | Create function |
| `isCreating` | `boolean` | Creating state |
| `error` | `string \| null` | Error message |
| `reset` | `() => void` | Reset error state |

---

### `useUpdateRequest` - Update Request

Update request title or status.

**Usage:**

```typescript
import { useUpdateRequest, useCancelRequest } from '@/lib/hooks';

function RequestActions({ requestId }: { requestId: string }) {
  const { updateRequest, isUpdating } = useUpdateRequest();
  const { cancelRequest, isCancelling } = useCancelRequest();

  const handleRename = async (newTitle: string) => {
    await updateRequest(requestId, { title: newTitle });
  };

  const handleCancel = async () => {
    if (confirm('Cancel this request?')) {
      await cancelRequest(requestId);
    }
  };

  return (
    <div>
      <button onClick={() => handleRename('New Title')} disabled={isUpdating}>
        Rename
      </button>
      <button onClick={handleCancel} disabled={isCancelling}>
        Cancel Request
      </button>
    </div>
  );
}
```

**Returns:**

| Property | Type | Description |
|:---------|:-----|:------------|
| `updateRequest` | `(id: string, input: UpdateRequestInput) => Promise<ContentRequest>` | Update function |
| `isUpdating` | `boolean` | Updating state |
| `error` | `string \| null` | Error message |
| `reset` | `() => void` | Reset error state |

**useCancelRequest shortcut:**

```typescript
const { cancelRequest, isCancelling, error } = useCancelRequest();
await cancelRequest(requestId);
```

---

### `useDeleteRequest` - Delete Request

Delete a request (only allowed for intake or cancelled requests).

**Usage:**

```typescript
import { useDeleteRequest } from '@/lib/hooks';

function DeleteButton({ requestId }: { requestId: string }) {
  const { deleteRequest, isDeleting, error } = useDeleteRequest();

  const handleDelete = async () => {
    if (confirm('Delete this request? This cannot be undone.')) {
      try {
        await deleteRequest(requestId);
        router.push('/requests');
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  return (
    <>
      <button onClick={handleDelete} disabled={isDeleting}>
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </>
  );
}
```

---

### `useEstimate` - Get Cost Estimate

Calculate cost and time estimate before creating a request.

**Usage:**

```typescript
import { useEstimate } from '@/lib/hooks';

function EstimatePreview() {
  const { getEstimate, estimate, isEstimating } = useEstimate();

  const handleCalculate = async () => {
    await getEstimate({
      type: 'video_with_vo',
      duration: 30,
      tier: 'standard',
      hasVoiceover: true,
      autoScript: true
    });
  };

  return (
    <div>
      <button onClick={handleCalculate} disabled={isEstimating}>
        Get Estimate
      </button>
      
      {estimate && (
        <div>
          <p>Cost: ${estimate.cost.toFixed(2)}</p>
          <p>Time: {formatTime(estimate.timeSeconds)}</p>
          <div>
            <h4>Breakdown:</h4>
            {estimate.breakdown.map((item, i) => (
              <div key={i}>
                {item.component}: ${item.cost.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### `useRetryRequest` - Retry Failed Tasks

Retry all failed tasks in a request.

**Usage:**

```typescript
import { useRetryRequest } from '@/lib/hooks';

function RetryButton({ requestId }: { requestId: string }) {
  const { retryRequest, isRetrying, error } = useRetryRequest();

  const handleRetry = async () => {
    try {
      const result = await retryRequest(requestId);
      alert(`Retried ${result.retriedCount} tasks`);
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  return (
    <button onClick={handleRetry} disabled={isRetrying}>
      {isRetrying ? 'Retrying...' : 'Retry Failed Tasks'}
    </button>
  );
}
```

---

### `useRequestEvents` - Get Event Timeline

Fetch event timeline for a request.

**Usage:**

```typescript
import { useRequestEvents } from '@/lib/hooks';

function EventTimeline({ requestId }: { requestId: string }) {
  const { events, isLoading, getEventsByType } = useRequestEvents({
    requestId,
    refreshInterval: 10000 // Poll every 10 seconds
  });

  const statusChanges = getEventsByType('status_changed');

  return (
    <div>
      <h3>Timeline</h3>
      {events.map(event => (
        <EventItem key={event.id} event={event} />
      ))}
    </div>
  );
}
```

---

## Type Definitions

### Request Types

```typescript
type RequestType = 
  | 'video_with_vo' 
  | 'video_no_vo' 
  | 'image' 
  | 'text' 
  | 'carousel';

type RequestStatus = 
  | 'intake' 
  | 'draft' 
  | 'production' 
  | 'qa' 
  | 'published' 
  | 'cancelled';

type TaskStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'skipped';
```

### Input Types

```typescript
interface CreateRequestInput {
  brand_id: string;
  title: string;
  type: RequestType;
  requirements: {
    prompt: string;
    duration?: number;
    aspect_ratio?: string;
    style?: string;
    [key: string]: unknown;
  };
  settings?: {
    tier?: 'economy' | 'standard' | 'premium';
    auto_script?: boolean;
    auto_publish?: boolean;
    provider?: string;
  };
}

interface UpdateRequestInput {
  title?: string;
  status?: RequestStatus;
}
```

---

## Common Patterns

### Pattern 1: Request Dashboard

```typescript
function RequestDashboard({ brandId }: { brandId: string }) {
  const [statusFilter, setStatusFilter] = useState<RequestStatus | undefined>();
  
  const { requests, isLoading, totalCount } = useRequests({
    brandId,
    status: statusFilter,
    limit: 20
  });

  return (
    <div>
      <StatusTabs value={statusFilter} onChange={setStatusFilter} />
      <RequestGrid requests={requests} />
      <p>{totalCount} total requests</p>
    </div>
  );
}
```

### Pattern 2: Create Request Wizard

```typescript
function CreateRequestWizard() {
  const [formData, setFormData] = useState({...});
  const { getEstimate, estimate } = useEstimate();
  const { createRequest, isCreating } = useCreateRequest();

  // Step 1: Get estimate
  const handlePreview = async () => {
    await getEstimate({
      type: formData.type,
      duration: formData.duration,
      tier: formData.tier,
      hasVoiceover: formData.hasVoiceover,
      autoScript: formData.autoScript
    });
  };

  // Step 2: Create request
  const handleCreate = async () => {
    const request = await createRequest(formData);
    router.push(`/requests/${request.id}`);
  };

  return (
    <Wizard>
      <Step1 data={formData} onChange={setFormData} />
      <Step2 estimate={estimate} onPreview={handlePreview} />
      <Step3 onConfirm={handleCreate} isLoading={isCreating} />
    </Wizard>
  );
}
```

### Pattern 3: Real-time Request Monitoring

```typescript
function RequestMonitor({ requestId }: { requestId: string }) {
  const { request, tasks, progress, refresh } = useRequest({
    requestId,
    refreshInterval: 3000 // Auto-refresh every 3 seconds
  });

  const { events } = useRequestEvents({
    requestId,
    refreshInterval: 5000
  });

  return (
    <div>
      <StatusBadge status={request?.status} />
      <ProgressBar value={progress} />
      <TaskList tasks={tasks} />
      <EventTimeline events={events} />
    </div>
  );
}
```

---

## Error Handling

All hooks return consistent error objects:

```typescript
const { error } = useRequests({ brandId: 'test' });

if (error) {
  // error is a string message
  console.error('Error:', error);
}
```

**Common error scenarios:**

- **401 Unauthorized**: User not authenticated
- **403 Forbidden**: No access to this brand
- **404 Not Found**: Request doesn't exist
- **400 Bad Request**: Invalid input (check validation)
- **500 Server Error**: Something went wrong server-side

---

## Best Practices

### 1. Use Optimistic Updates

```typescript
const { updateRequest } = useUpdateRequest();
const { mutate } = useRequest({ requestId });

const handleUpdate = async (newTitle: string) => {
  // Optimistically update UI
  mutate(
    (current) => current ? { ...current, data: { ...current.data, title: newTitle } } : current,
    false
  );
  
  // Then perform actual update
  await updateRequest(requestId, { title: newTitle });
};
```

### 2. Debounce Expensive Operations

```typescript
import { useDebouncedCallback } from 'use-debounce';

const { getEstimate } = useEstimate();

const debouncedEstimate = useDebouncedCallback(
  async (input) => {
    await getEstimate(input);
  },
  500 // Wait 500ms after last change
);
```

### 3. Conditional Fetching

```typescript
const { requests } = useRequests({
  brandId,
  enabled: !!brandId // Only fetch when brandId exists
});
```

### 4. Pagination State

```typescript
const [page, setPage] = useState(1);

const { requests, hasMore } = useRequests({
  brandId,
  page,
  limit: 10
});

const loadMore = () => {
  if (hasMore) setPage(p => p + 1);
};
```

---

## Testing

### Mock Hook Responses

```typescript
// In tests
jest.mock('@/lib/hooks', () => ({
  useRequests: jest.fn(() => ({
    requests: mockRequests,
    isLoading: false,
    error: null
  }))
}));
```

### Test Utilities

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useRequests } from '@/lib/hooks';

it('should fetch requests', async () => {
  const { result } = renderHook(() => 
    useRequests({ brandId: 'test' })
  );

  await waitFor(() => {
    expect(result.current.requests.length).toBeGreaterThan(0);
  });
});
```

---

## API Endpoints Reference

| Method | Endpoint | Hook | Description |
|:-------|:---------|:-----|:------------|
| `GET` | `/api/v1/requests` | `useRequests` | List requests |
| `POST` | `/api/v1/requests` | `useCreateRequest` | Create request |
| `GET` | `/api/v1/requests/:id` | `useRequest` | Get request detail |
| `PATCH` | `/api/v1/requests/:id` | `useUpdateRequest` | Update request |
| `DELETE` | `/api/v1/requests/:id` | `useDeleteRequest` | Delete request |
| `POST` | `/api/v1/requests/estimate` | `useEstimate` | Get estimate |
| `POST` | `/api/v1/requests/:id/retry` | `useRetryRequest` | Retry failed tasks |
| `GET` | `/api/v1/requests/:id/events` | `useRequestEvents` | Get event timeline |

---

## Support

For questions or issues:
- Check API documentation: `/docs/API_DOCUMENTATION.md`
- Review type definitions: `/frontend/types/pipeline.ts`
- Run tests: `npm test`
- Integration test: `./scripts/test-pipeline-api.sh`

**Last Updated**: January 4, 2026  
**Phase**: 7 - Request-Centric Pipeline API  
**Status**: Complete
