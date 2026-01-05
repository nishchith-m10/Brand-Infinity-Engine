// =============================================================================
// useRetryRequest Hook - Retry failed tasks
// =============================================================================

import { useState } from 'react';
import { mutate } from 'swr';

interface RetryResult {
  retriedCount: number;
  message: string;
}

interface UseRetryRequestResult {
  retryRequest: (requestId: string) => Promise<RetryResult>;
  isRetrying: boolean;
  error: string | null;
  reset: () => void;
}

export function useRetryRequest(): UseRetryRequestResult {
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retryRequest = async (requestId: string): Promise<RetryResult> => {
    setIsRetrying(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/requests/${requestId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to retry request');
      }

      // Revalidate the request to show updated tasks
      mutate(`/api/v1/requests/${requestId}`);

      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsRetrying(false);
    }
  };

  const reset = () => {
    setError(null);
  };

  return {
    retryRequest,
    isRetrying,
    error,
    reset
  };
}
