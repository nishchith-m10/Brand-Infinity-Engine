/**
 * OpenAI Adapter
 * Slice 4: Multi-Provider LLM
 */

import { BaseLLMAdapter } from './base';
import type { LLMRequest, LLMResponse } from '../types';
import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

export class OpenAIAdapter extends BaseLLMAdapter {
  private baseURL: string;
  private directApiKey?: string;

  constructor(apiKey?: string) {
    super();
    this.baseURL = 'https://api.openai.com/v1';
    this.directApiKey = apiKey;
  }

  /**
   * Fetch API key with optional userId for background jobs
   */
  private async fetchApiKey(userId?: string): Promise<string> {
    if (this.directApiKey) {
      return this.directApiKey;
    }
    const apiKey = await getEffectiveProviderKey('openai', process.env.OPENAI_API_KEY, userId);
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please add your OpenAI key in Settings.');
    }
    return apiKey;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = request.apiKey || await this.fetchApiKey(request.userId);

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
          response_format: request.responseFormat === 'json' 
            ? { type: 'json_object' } 
            : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API request failed');
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
        provider: 'openai',
      };
    } catch (error) {
      this.handleError(error, 'OpenAI');
    }
  }
}

