// =============================================================================
// useRequestEvents Hook - Get event timeline for a request
// =============================================================================

import useSWR from 'swr';
import { RequestEvent } from '@/types/pipeline';

interface UseRequestEventsOptions {
  requestId: string | null;
  enabled?: boolean;
  refreshInterval?: number;
}

export function useRequestEvents(options: UseRequestEventsOptions) {
  const { requestId, enabled = true, refreshInterval } = options;

  const endpoint = requestId ? `/api/v1/requests/${requestId}/events` : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: RequestEvent[] }>(
    enabled && endpoint ? endpoint : null,
    async (url: string) => {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch events');
      }

      return response.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval,
      dedupingInterval: 3000
    }
  );

  return {
    events: data?.data || [],
    isLoading,
    isError: !!error,
    error: error?.message,
    mutate,
    refresh: () => mutate(),
    
    // Helper methods
    getEventsByType: (eventType: RequestEvent['event_type']) => 
      data?.data?.filter(e => e.event_type === eventType) || [],
    
    getLatestEvent: () => 
      data?.data?.[0] || null,
    
    hasEventType: (eventType: RequestEvent['event_type']) =>
      data?.data?.some(e => e.event_type === eventType) || false
  };
}
