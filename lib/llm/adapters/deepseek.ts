/**
 * DeepSeek Adapter
 * Slice 4: Multi-Provider LLM
 */

import { BaseLLMAdapter } from './base';
import type { LLMRequest, LLMResponse } from '../types';
import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

export class DeepSeekAdapter extends BaseLLMAdapter {
  private apiKey: string | null;
  private baseURL: string;
  private apiKeyPromise: Promise<string | null>;

  constructor(apiKey?: string) {
    super();
    this.baseURL = 'https://api.deepseek.com/v1';
    
    // If API key provided directly, use it
    if (apiKey) {
      this.apiKey = apiKey;
      this.apiKeyPromise = Promise.resolve(apiKey);
    } else {
      // Otherwise, fetch user key from database (async)
      this.apiKey = null;
      this.apiKeyPromise = getEffectiveProviderKey('deepseek', process.env.DEEPSEEK_API_KEY);
    }
  }

  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await this.apiKeyPromise;
    }
    if (!this.apiKey) {
      throw new Error('DeepSeek API key not configured. Please add your DeepSeek key in Settings.');
    }
    return this.apiKey;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = await this.ensureApiKey();

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: this.formatMessages(request.messages),
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'DeepSeek API request failed');
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
        provider: 'deepseek',
      };
    } catch (error) {
      this.handleError(error, 'DeepSeek');
    }
  }
}

