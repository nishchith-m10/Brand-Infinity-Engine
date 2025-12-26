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
    console.log('[useOpenRouterModels] Effect triggered. API Key length:', apiKey?.length);
    
    // Only fetch if we have an API key
    if (!apiKey || apiKey.length < 10) {
      console.log('[useOpenRouterModels] No valid API key, skipping fetch');
      setModels([]);
      return;
    }

    const fetchModels = async () => {
      console.log('[useOpenRouterModels] Starting fetch...');
      setIsLoading(true);
      setError(null);
      try {
        const url = `/api/v1/models?provider=openrouter&apiKey=${encodeURIComponent(apiKey)}`;
        console.log('[useOpenRouterModels] Fetching from:', url.substring(0, 50) + '...');
        
        const response = await fetch(url);
        
        console.log('[useOpenRouterModels] Response status:', response.status);
        
        if (!response.ok) {
          throw new Error('Failed to fetch OpenRouter models');
        }

        const data = await response.json();
        console.log('[useOpenRouterModels] Response data:', data);
        
        if (data.success) {
          console.log('[useOpenRouterModels] Models fetched:', data.models?.length || 0);
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
