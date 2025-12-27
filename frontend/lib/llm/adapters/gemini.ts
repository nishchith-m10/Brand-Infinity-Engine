/**
 * Google Gemini Adapter
 * Slice 4: Multi-Provider LLM
 */

import { BaseLLMAdapter } from './base';
import type { LLMRequest, LLMResponse } from '../types';

export class GeminiAdapter extends BaseLLMAdapter {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    super();
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
    
    if (!this.apiKey) {
      console.warn('[Gemini] API key not configured');
    }
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    try {
      // Convert messages to Gemini format
      const contents = this.formatGeminiMessages(request.messages);

      const response = await fetch(
        `${this.baseURL}/models/${request.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: request.temperature ?? 0.7,
              maxOutputTokens: request.maxTokens,
              responseMimeType: request.responseFormat === 'json' 
                ? 'application/json' 
                : 'text/plain',
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Gemini API request failed');
      }

      const data = await response.json();
      const candidate = data.candidates[0];
      
      return {
        content: candidate.content.parts[0].text,
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount || 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: (data.usageMetadata?.promptTokenCount || 0) + (data.usageMetadata?.candidatesTokenCount || 0),
          totalCost: 0,
        },
        finish_reason: candidate.finishReason,
        model: request.model || 'gemini-pro',
        provider: 'gemini',
      };
    } catch (error) {
      this.handleError(error, 'Gemini');
    }
  }

  /**
   * Format messages for Gemini API (different structure)
   */
  private formatGeminiMessages(messages: LLMRequest['messages']): any[] {
    return messages
      .filter(m => m.role !== 'system') // Gemini doesn't support system messages
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));
  }
}

