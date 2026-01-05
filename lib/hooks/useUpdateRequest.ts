// =============================================================================
// useUpdateRequest Hook - Update existing request
// =============================================================================

import { useState } from 'react';
import { ContentRequest, UpdateRequestInput } from '@/types/pipeline';
import { mutate } from 'swr';

interface UseUpdateRequestResult {
  updateRequest: (requestId: string, input: UpdateRequestInput) => Promise<ContentRequest>;
  isUpdating: boolean;
  error: string | null;
  reset: () => void;
}

export function useUpdateRequest(): UseUpdateRequestResult {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRequest = async (
    requestId: string,
    input: UpdateRequestInput
  ): Promise<ContentRequest> => {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update request');
      }

      // Revalidate the specific request
      mutate(`/api/v1/requests/${requestId}`);
      
      // Revalidate all requests lists that might contain this request
      mutate((key) => 
        typeof key === 'string' && 
        key.startsWith('/api/v1/requests?')
      );

      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  const reset = () => {
    setError(null);
  };

  return {
    updateRequest,
    isUpdating,
    error,
    reset
  };
}

// Specialized hook for cancelling requests
export function useCancelRequest() {
  const { updateRequest, isUpdating, error, reset } = useUpdateRequest();

  const cancelRequest = async (requestId: string): Promise<ContentRequest> => {
    return updateRequest(requestId, { status: 'cancelled' });
  };

  return {
    cancelRequest,
    isCancelling: isUpdating,
    error,
    reset
  };
}
