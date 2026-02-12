// =============================================================================
// useCreateRequest Hook - Create new content request
// =============================================================================

import { useState } from 'react';
import { CreateRequestInput, ContentRequest } from '@/types/pipeline';
import { mutate } from 'swr';

interface UseCreateRequestResult {
  createRequest: (input: CreateRequestInput) => Promise<ContentRequest>;
  isCreating: boolean;
  error: string | null;
  reset: () => void;
}

export function useCreateRequest(): UseCreateRequestResult {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRequest = async (input: CreateRequestInput): Promise<ContentRequest> => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create request');
      }

      // Revalidate the requests list for this brand
      mutate((key) => 
        typeof key === 'string' && 
        key.startsWith('/api/v1/requests?') && 
        key.includes(`brand_id=${input.brand_id}`)
      );

      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  const reset = () => {
    setError(null);
  };

  return {
    createRequest,
    isCreating,
    error,
    reset
  };
}
