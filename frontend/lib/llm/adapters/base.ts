/**
 * Base LLM Adapter Interface
 * Slice 4: Multi-Provider LLM
 */

import type { LLMRequest, LLMResponse } from '../types';

/**
 * Base adapter that all providers must implement
 */
export abstract class BaseLLMAdapter {
  abstract generateCompletion(request: LLMRequest): Promise<LLMResponse>;
  
  /**
   * Format messages for provider-specific API
   */
  protected formatMessages(messages: LLMRequest['messages']): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Handle errors consistently
   */
  protected handleError(error: any, provider: string): never {
    console.error(`[${provider}] API Error:`, error);
    throw new Error(`${provider} API failed: ${error.message || 'Unknown error'}`);
  }

  /**
   * Count tokens (rough estimate)
   */
  protected estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

