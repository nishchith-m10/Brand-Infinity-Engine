/**
 * useStreamingResponse Hook
 * 
 * Handles SSE streaming from the conversation/stream endpoint.
 * Returns accumulated content and streaming state.
 */

import { useState, useCallback, useRef } from 'react';

interface StreamingOptions {
  sessionId: string;
  message: string;
  provider?: string;
  modelId?: string;
  apiKey?: string;
  systemPrompt?: string;
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

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              if (json.content) {
                accumulated += json.content;
                setState(prev => ({ ...prev, content: accumulated }));
                onChunk?.(json.content);
              }
              if (json.error) {
                throw new Error(json.error);
              }
            } catch (e) {
              // Skip malformed chunks
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
