/**
 * OpenRouter Adapter
 * Slice 4: Multi-Provider LLM
 */

import { BaseLLMAdapter } from './base';
import type { LLMRequest, LLMResponse } from '../types';

export class OpenRouterAdapter extends BaseLLMAdapter {
  private defaultApiKey: string;
  private baseURL: string;

  constructor() {
    super();
    this.defaultApiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseURL = 'https://openrouter.ai/api/v1';
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = request.apiKey || this.defaultApiKey;
    
    console.log("[OpenRouter] generateCompletion called:", {
      hasRequestApiKey: !!request.apiKey,
      hasDefaultApiKey: !!this.defaultApiKey,
      usingKey: apiKey ? apiKey.substring(0, 10) + '...' : 'NONE',
      model: request.model,
      provider: request.provider,
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
}
