/**
 * Anthropic (Claude) Adapter
 * Slice 4: Multi-Provider LLM
 */

import { BaseLLMAdapter } from './base';
import type { LLMRequest, LLMResponse } from '../types';

export class AnthropicAdapter extends BaseLLMAdapter {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    super();
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.baseURL = 'https://api.anthropic.com/v1';
    
    if (!this.apiKey) {
      console.warn('[Anthropic] API key not configured');
    }
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    try {
      // Separate system message from user/assistant messages
      const systemMessage = request.messages.find(m => m.role === 'system');
      const messages = request.messages.filter(m => m.role !== 'system');

      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
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
        tokensUsed: {
          input: data.usage?.input_tokens || 0,
          output: data.usage?.output_tokens || 0,
        },
        finishReason: data.stop_reason,
        model: data.model,
        provider: 'anthropic',
      };
    } catch (error) {
      this.handleError(error, 'Anthropic');
    }
  }
}

