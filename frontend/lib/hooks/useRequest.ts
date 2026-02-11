// =============================================================================
// useRequest Hook - Get single request with details
// =============================================================================

import useSWR from 'swr';
import { DetailedContentRequest, RequestTask } from '@/types/pipeline';

interface UseRequestOptions {
  requestId: string | null;
  enabled?: boolean;
  refreshInterval?: number;
}

export function useRequest(options: UseRequestOptions) {
  const { requestId, enabled = true, refreshInterval } = options;

  const endpoint = requestId ? `/api/v1/requests/${requestId}` : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: DetailedContentRequest }>(
    enabled && endpoint ? endpoint : null,
    async (url: string) => {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch request');
      }

      return response.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval,
      dedupingInterval: 2000
    }
  );

  return {
    request: data?.data,
    tasks: data?.data?.tasks || [],
    events: data?.data?.events || [],
    isLoading,
    isError: !!error,
    error: error?.message,
    mutate,
    refresh: () => mutate(),
    
    // Computed properties
    status: data?.data?.status,
    progress: calculateProgress(data?.data),
    isComplete: data?.data?.status === 'published' || data?.data?.status === 'cancelled',
    canCancel: data?.data?.status && !['published', 'cancelled'].includes(data?.data.status),
    canDelete: data?.data?.status === 'intake' || data?.data?.status === 'cancelled',
    canRetry: data?.data?.tasks?.some((t: RequestTask) => t.status === 'failed') || false
  };
}

// Calculate overall progress percentage
function calculateProgress(request?: DetailedContentRequest): number {
  if (!request?.tasks || request.tasks.length === 0) return 0;

  const completedTasks = request.tasks.filter(
    (t: RequestTask) => t.status === 'completed' || t.status === 'skipped'
  ).length;

  return Math.round((completedTasks / request.tasks.length) * 100);
}
