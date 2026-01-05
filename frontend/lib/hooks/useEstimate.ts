// =============================================================================
// useEstimate Hook - Get cost and time estimate
// =============================================================================

import { useState } from 'react';
import { EstimateInput } from '@/lib/pipeline/estimator';
import { CostEstimate } from '@/types/pipeline';

interface UseEstimateResult {
  getEstimate: (input: EstimateInput) => Promise<CostEstimate>;
  estimate: CostEstimate | null;
  isEstimating: boolean;
  error: string | null;
  reset: () => void;
}

export function useEstimate(): UseEstimateResult {
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getEstimate = async (input: EstimateInput): Promise<CostEstimate> => {
    setIsEstimating(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/requests/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get estimate');
      }

      setEstimate(result.data);
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsEstimating(false);
    }
  };

  const reset = () => {
    setEstimate(null);
    setError(null);
  };

  return {
    getEstimate,
    estimate,
    isEstimating,
    error,
    reset
  };
}
