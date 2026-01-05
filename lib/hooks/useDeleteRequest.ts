// =============================================================================
// useDeleteRequest Hook - Delete request
// =============================================================================

import { useState } from 'react';
import { mutate } from 'swr';

interface UseDeleteRequestResult {
  deleteRequest: (requestId: string) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
  reset: () => void;
}

export function useDeleteRequest(): UseDeleteRequestResult {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteRequest = async (requestId: string): Promise<void> => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/requests/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete request');
      }

      // Invalidate the specific request
      mutate(`/api/v1/requests/${requestId}`, undefined, false);
      
      // Revalidate all requests lists
      mutate((key) => 
        typeof key === 'string' && 
        key.startsWith('/api/v1/requests?')
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  const reset = () => {
    setError(null);
  };

  return {
    deleteRequest,
    isDeleting,
    error,
    reset
  };
}
