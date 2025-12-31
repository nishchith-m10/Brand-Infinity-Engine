/**
 * useStreamingResponse Hook
 * 
 * Handles SSE streaming from the conversation/stream endpoint.
 * Returns accumulated content and streaming state.
 */

import { useState, useCallback, useRef } from 'react';

interface ContextPayload {
  campaign_id?: string;
  campaign_name?: string;
  kb_ids?: string[];
  identity?: {
    brand_name?: string;
    brand_voice?: string;
    tagline?: string;
    target_audience?: string;
    tone_style?: string;
  } | null;
}

interface StreamingOptions {
  sessionId: string;
  message: string;
  provider?: string;
  modelId?: string;
  apiKey?: string;
  systemPrompt?: string;
  context?: ContextPayload; // Added for brand context support
  onChunk?: (chunk: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
}

interface StreamingState {
  isStreaming: boolean;
  content: string;
  error: string | null;
}

export function useStreamingResponse() {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    content: '',
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (options: StreamingOptions) => {
    const {
      sessionId,
      message,
      provider,
      modelId,
      apiKey,
      systemPrompt,
      context,
      onChunk,
      onComplete,
      onError,
    } = options;

    // Cancel any existing stream
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setState({ isStreaming: true, content: '', error: null });

    try {
      const response = await fetch('/api/v1/conversation/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message,
          provider,
          model_id: modelId,
          openrouter_api_key: apiKey,
          system_prompt: systemPrompt,
          context, // Forward brand context to streaming endpoint
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        
        // Generic pattern to strip ANY model echo (client-side safety net)
        // Matches: "provider/model-name 0" format
        const modelEchoPattern = /^[a-z0-9-]+\/[a-z0-9.-]+\s*\d*\s*/gi;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              if (json.content) {
                // Sanitize content on client side as safety net
                const cleanContent = json.content.replace(modelEchoPattern, '');
                if (cleanContent.length > 0) {
                  accumulated += cleanContent;
                  setState(prev => ({ ...prev, content: accumulated }));
                  onChunk?.(cleanContent);
                }
              }
              if (json.error) {
                throw new Error(json.error);
              }
            } catch (e) {
              // Log malformed chunks for debugging (Bug 1.3 fix)
              console.warn('[StreamHook] Malformed chunk, skipping:', trimmed.slice(0, 100), e);
            }
          }
        }
      }

      setState(prev => ({ ...prev, isStreaming: false }));
      onComplete?.(accumulated);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Intentional cancellation
        setState(prev => ({ ...prev, isStreaming: false }));
        return;
      }
      
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      setState(prev => ({ ...prev, isStreaming: false, error: errorObj.message }));
      onError?.(errorObj);
    }
  }, []);

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  const resetContent = useCallback(() => {
    setState({ isStreaming: false, content: '', error: null });
  }, []);

  return {
    ...state,
    startStream,
    cancelStream,
    resetContent,
  };
}
