import { useState, useEffect } from 'react';

interface Model {
  id: string;
  name: string;
  provider: string;
  pricing?: any;
  context_length?: number;
}

/**
 * Hook to fetch available models from OpenRouter once API key is configured
 */
export function useOpenRouterModels(apiKey: string | undefined) {
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if we have an API key
    if (!apiKey || apiKey.length < 10) {
      setModels([]);
      return;
    }

    const fetchModels = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/v1/models?provider=openrouter&apiKey=${encodeURIComponent(apiKey)}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch OpenRouter models');
        }

        const data = await response.json();
        if (data.success) {
          setModels(data.models || []);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err: any) {
        console.error('[useOpenRouterModels] Error:', err);
        setError(err.message);
        setModels([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, [apiKey]);

  return { models, isLoading, error };
}
