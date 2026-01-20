/**
 * Kimi (Moonshot) LLM Adapter
 * Phase 10: Provider Integration
 * 
 * OpenAI-compatible API with extended context windows up to 2M tokens.
 * https://platform.moonshot.cn/
 */

import { BaseLLMAdapter } from './base';
import type { LLMRequest, LLMResponse } from '../types';
import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const KIMI_BASE_URL = 'https://api.moonshot.cn/v1';

// Available models and their specifications
const KIMI_MODELS = {
  'moonshot-v1-8k': { 
    contextWindow: 8192, 
    costPer1kInput: 0.00072,  // ¥0.012 per 1k tokens ≈ $0.00072
    costPer1kOutput: 0.00072,
    description: 'Fast responses, 8K context'
  },
  'moonshot-v1-32k': { 
    contextWindow: 32768, 
    costPer1kInput: 0.00144,  // ¥0.024 per 1k tokens
    costPer1kOutput: 0.00144,
    description: 'Balanced, 32K context'
  },
  'moonshot-v1-128k': { 
    contextWindow: 131072, 
    costPer1kInput: 0.0036,   // ¥0.060 per 1k tokens
    costPer1kOutput: 0.0036,
    description: 'Large context, 128K'
  },
  'kimi-k2': { 
    contextWindow: 2097152,   // 2M tokens!
    costPer1kInput: 0.006,
    costPer1kOutput: 0.012,
    description: 'Ultra-long context, 2M tokens, advanced reasoning'
  },
} as const;

export type KimiModel = keyof typeof KIMI_MODELS;

export class KimiAdapter extends BaseLLMAdapter {
  private apiKey: string | null;
  private baseURL: string;
  private apiKeyPromise: Promise<string | null>;
  private userId?: string;

  constructor(apiKey?: string, userId?: string) {
    super();
    this.baseURL = KIMI_BASE_URL;
    this.userId = userId;
    
    // If API key provided directly, use it
    if (apiKey) {
      this.apiKey = apiKey;
      this.apiKeyPromise = Promise.resolve(apiKey);
    } else {
      // Otherwise, fetch user key from database (async)
      this.apiKey = null;
      this.apiKeyPromise = getEffectiveProviderKey('kimi', process.env.KIMI_API_KEY, userId);
    }
  }

  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await this.apiKeyPromise;
    }
    if (!this.apiKey) {
      throw new Error(
        'Kimi (Moonshot) API key not configured. Please add your Kimi key in Settings or set KIMI_API_KEY environment variable.'
      );
    }
    return this.apiKey;
  }

  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = await this.ensureApiKey();
    const model = request.model || 'moonshot-v1-32k';

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: this.formatMessages(request.messages),
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Calculate cost based on model
      const modelInfo = KIMI_MODELS[model as KimiModel];
      const inputCost = modelInfo 
        ? (data.usage?.prompt_tokens || 0) / 1000 * modelInfo.costPer1kInput 
        : 0;
      const outputCost = modelInfo 
        ? (data.usage?.completion_tokens || 0) / 1000 * modelInfo.costPer1kOutput 
        : 0;
      
      return {
        content: data.choices[0].message.content,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          totalTokens: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
          totalCost: inputCost + outputCost,
        },
        finish_reason: data.choices[0].finish_reason,
        model: data.model,
        provider: 'kimi',
      };
    } catch (error) {
      this.handleError(error, 'Kimi');
    }
  }

  /**
   * Get available models for this provider
   */
  static getAvailableModels(): string[] {
    return Object.keys(KIMI_MODELS);
  }

  /**
   * Get model info for cost estimation
   */
  static getModelInfo(model: string): typeof KIMI_MODELS[KimiModel] | undefined {
    return KIMI_MODELS[model as KimiModel];
  }

  /**
   * Check if configured (sync check for UI)
   */
  isConfigured(): boolean {
    return !!process.env.KIMI_API_KEY || !!this.apiKey;
  }
}

/**
 * Factory function to create Kimi adapter
 */
export function createKimiAdapter(apiKey?: string, userId?: string): KimiAdapter {
  return new KimiAdapter(apiKey, userId);
}
