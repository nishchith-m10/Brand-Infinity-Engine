/**
 * Anthropic (Claude) Adapter
 * Slice 4: Multi-Provider LLM
 */

import { BaseLLMAdapter } from './base';
import type { LLMRequest, LLMResponse } from '../types';
import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

export class AnthropicAdapter extends BaseLLMAdapter {
  private baseURL: string;
  private directApiKey?: string;

  constructor(apiKey?: string) {
    super();
    this.baseURL = 'https://api.anthropic.com/v1';
    this.directApiKey = apiKey;
  }

  /**
   * Fetch API key with optional userId for background jobs
   */
  private async fetchApiKey(userId?: string): Promise<string> {
    if (this.directApiKey) {
      return this.directApiKey;
    }
    const apiKey = await getEffectiveProviderKey('anthropic', process.env.ANTHROPIC_API_KEY, userId);
    if (!apiKey) {
      throw new Error('Anthropic API key not configured. Please add your Anthropic key in Settings.');
    }
    return apiKey;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = request.apiKey || await this.fetchApiKey(request.userId);

    try {
      // Separate system message from user/assistant messages
      const systemMessage = request.messages.find(m => m.role === 'system');
      const messages = request.messages.filter(m => m.role !== 'system');

      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: request.model,
          messages: messages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content,
          })),
          system: systemMessage?.content,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens || 4096,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Anthropic API request failed');
      }

      const data = await response.json();
      
      return {
        content: data.content[0].text,
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
          totalCost: 0,
        },
        finish_reason: data.stop_reason,
        model: data.model,
        provider: 'anthropic',
      };
    } catch (error) {
      this.handleError(error, 'Anthropic');
    }
  }
}

