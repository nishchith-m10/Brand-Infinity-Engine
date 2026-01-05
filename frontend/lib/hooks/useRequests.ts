// =============================================================================
// useRequests Hook - List and filter content requests
// =============================================================================

import useSWR from 'swr';
import { ListRequestsParams, ListRequestsResponse } from '@/types/pipeline';

interface UseRequestsOptions extends Omit<ListRequestsParams, 'brand_id'> {
  brandId: string;
  enabled?: boolean;
  type?: string;
}

export function useRequests(options: UseRequestsOptions) {
  const {
    brandId,
    status,
    type,
    page = 1,
    limit = 10,
    enabled = true
  } = options;

  // Build query string
  const params = new URLSearchParams({
    brand_id: brandId,
    page: page.toString(),
    limit: limit.toString()
  });

  if (status) params.append('status', status);
  if (type) params.append('type', type);

  const endpoint = `/api/v1/requests?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<ListRequestsResponse>(
    enabled ? endpoint : null,
    async (url: string) => {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch requests');
      }

      return response.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000
    }
  );

  return {
    requests: data?.data || [],
    meta: data?.meta,
    isLoading,
    isError: !!error,
    error: error?.message,
    mutate,
    // Helper methods
    refresh: () => mutate(),
    hasMore: data?.meta?.has_more || false,
    currentPage: data?.meta?.page || 1,
    totalPages: data?.meta ? Math.ceil(data.meta.total / data.meta.limit) : 1,
    totalCount: data?.meta?.total || 0
  };
}

// Hook for infinite scroll / pagination
export function useRequestsPaginated(options: UseRequestsOptions) {
  const result = useRequests(options);

  const loadMore = () => {
    if (result.hasMore && !result.isLoading) {
      // Return next page options for caller to use
      return { ...options, page: (options.page || 1) + 1 };
    }
    return options;
  };

  return {
    ...result,
    loadMore,
    canLoadMore: result.hasMore && !result.isLoading
  };
}
