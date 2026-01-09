/**
 * OpenRouter Adapter
 * Slice 4: Multi-Provider LLM
 */

import { BaseLLMAdapter } from './base';
import type { LLMRequest, LLMResponse } from '../types';
import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

export class OpenRouterAdapter extends BaseLLMAdapter {
  private baseURL: string;

  constructor() {
    super();
    this.baseURL = 'https://openrouter.ai/api/v1';
  }

  /**
   * Fetch API key with optional userId for background jobs
   */
  private async fetchApiKey(userId?: string): Promise<string> {
    const apiKey = await getEffectiveProviderKey(
      'openrouter' as any,
      process.env.OPENROUTER_API_KEY,
      userId
    );
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured. Please add your OpenRouter key in Settings.');
    }
    return apiKey;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    // Use request API key if provided, otherwise fetch user's key from DB (with userId support)
    const apiKey = request.apiKey || await this.fetchApiKey(request.userId);
    
    console.log("[OpenRouter] generateCompletion called:", {
      hasRequestApiKey: !!request.apiKey,
      userId: request.userId,
      usingKey: apiKey ? apiKey.substring(0, 10) + '...' : 'NONE',
      model: request.model,
      provider: request.provider,
    });

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://brand-infinity.com',
          'X-Title': 'Brand Infinity Engine',
        },
        body: JSON.stringify({
          model: request.model,
          messages: this.formatMessages(request.messages),
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          response_format: request.responseFormat === 'json' 
            ? { type: 'json_object' } 
            : undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        console.error("[OpenRouter] API Error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorBody,
        });

        const errorMessage = errorBody.error?.message || errorBody.message || `OpenRouter API failed with status ${response.status}`;

        // If the error indicates an invalid model id, attempt to fetch available models and retry with a fallback
        if (response.status === 400 && /not a valid model id/i.test(errorMessage)) {
          console.warn('[OpenRouter] Model ID invalid, attempting fallback models');

          // Fetch OpenRouter models and pick a suitable fallback
          try {
            const modelsResp = await fetch(`${this.baseURL}/models`, {
              headers: { 'Authorization': `Bearer ${apiKey}` },
            });

            if (modelsResp.ok) {
              const modelsJson = await modelsResp.json();
              const availableIds: string[] = (modelsJson.data || []).map((m: any) => m.id);

              // Prefer exact Xiaomi free id first, then variants, then Gemini/OpenAI via OpenRouter
              const preferOrder = ['xiaomi/mimo-v2-flash:free', 'mimo-v2-flash', 'mimo-v2', 'mimo', 'mimoflash', 'gemini-flash', 'gemini', 'google/gemini-flash-1.5-8b', 'openai/gpt-3.5-turbo'];

              const fallback = availableIds.find((id: string) => preferOrder.some((p) => id.toLowerCase().includes(p))) || availableIds[0];

              if (fallback) {
                console.log('[OpenRouter] Retrying with fallback model:', fallback);

                // Retry once with fallback
                const retryResp = await fetch(`${this.baseURL}/chat/completions`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://brand-infinity.com',
                    'X-Title': 'Brand Infinity Engine',
                  },
                  body: JSON.stringify({
                    model: fallback,
                    messages: this.formatMessages(request.messages),
                    temperature: request.temperature ?? 0.7,
                    max_tokens: request.maxTokens,
                    response_format: request.responseFormat === 'json' 
                      ? { type: 'json_object' } 
                      : undefined,
                  }),
                });

                if (retryResp.ok) {
                  const data = await retryResp.json();
                  return {
                    content: data.choices[0].message.content,
                    usage: {
                      inputTokens: data.usage?.prompt_tokens || 0,
                      outputTokens: data.usage?.completion_tokens || 0,
                      totalTokens: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
                      totalCost: 0,
                    },
                    finish_reason: data.choices[0].finish_reason,
                    model: data.model,
                    provider: 'openrouter',
                  };
                } else {
                  const rb = await retryResp.json().catch(() => ({}));
                  console.error('[OpenRouter] Retry with fallback model failed:', retryResp.status, rb);
                }
              }
            } else {
              console.warn('[OpenRouter] Failed to fetch models for fallback');
            }
          } catch (err) {
            console.warn('[OpenRouter] Error while attempting fallback:', err);
          }
        }

        throw new Error(`OpenRouter API failed: ${errorMessage}`);
      }

      const data = await response.json();
      
      return {
        content: data.choices[0].message.content,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          totalTokens: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
          totalCost: 0,
        },
        finish_reason: data.choices[0].finish_reason,
        model: data.model,
        provider: 'openrouter',
      };
    } catch (error: any) {
      console.error("[OpenRouter] Exception:", error?.message || error);
      throw error; // Re-throw to let the caller handle it
    }
  }

  /**
   * Stream completion with SSE for real-time response display
   * Yields content chunks as they arrive
   */
  async *streamCompletion(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    // Use request API key if provided, otherwise fetch user's key from DB
    const apiKey = request.apiKey || await this.fetchApiKey(request.userId);
    
    console.log("[OpenRouter] streamCompletion called:", {
      hasRequestApiKey: !!request.apiKey,
      userId: request.userId,
      model: request.model,
    });
    
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://brand-infinity.com',
          'X-Title': 'Brand Infinity Engine',
        },
        body: JSON.stringify({
          model: request.model,
          messages: this.formatMessages(request.messages),
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          stream: true, // Enable streaming
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        console.error("[OpenRouter] Stream API Error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorBody,
        });
        throw new Error(`OpenRouter API failed: ${errorBody.error?.message || response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          
          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // Skip malformed JSON chunks
              console.warn('[OpenRouter] Skipping malformed chunk:', trimmed.slice(0, 50));
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim() && buffer.trim().startsWith('data: ')) {
        try {
          const json = JSON.parse(buffer.trim().slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch (e) {
          // Ignore
        }
      }

    } catch (error: any) {
      console.error("[OpenRouter] Stream Exception:", error?.message || error);
      throw error;
    }
  }
}
