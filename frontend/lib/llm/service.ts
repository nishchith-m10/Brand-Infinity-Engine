/**
 * Multi-Provider LLM Service
 * Slice 4: LLM Provider Abstraction
 */

import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMCostCalculation,
} from './types';
import { PROVIDER_CONFIGS } from '@/lib/agents/config';

// Provider adapters
import { OpenAIAdapter } from './adapters/openai';
import { AnthropicAdapter } from './adapters/anthropic';
import { DeepSeekAdapter } from './adapters/deepseek';
import { GeminiAdapter } from './adapters/gemini';

/**
 * LLM Service - Routes requests to appropriate provider
 */
export class LLMService {
  private adapters: Map<LLMProvider, {  generateCompletion(request: LLMRequest): Promise<LLMResponse> }>;

  constructor() {
    this.adapters = new Map();
    
    // Initialize adapters
    this.adapters.set('openai', new OpenAIAdapter());
    this.adapters.set('anthropic', new AnthropicAdapter());
    this.adapters.set('deepseek', new DeepSeekAdapter());
    this.adapters.set('gemini', new GeminiAdapter());
  }

  /**
   * Generate completion with specified model
   */
  async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Get provider from model
      const provider = this.getProviderFromModel(request.model || '');
      if (!provider) {
        throw new Error(`Unsupported model: ${request.model}`);
      }

      // Get adapter
      const adapter = this.adapters.get(provider);
      if (!adapter) {
        throw new Error(`Provider ${provider} not initialized`);
      }

      // Generate completion
      const response = await adapter.generateCompletion(request);
      
      // Calculate cost
      const cost = this.calculateCost(
        provider,
        request.model || '',
        { input: response.usage.inputTokens, output: response.usage.outputTokens }
      );

      // Add metadata
      const latency = Date.now() - startTime;
      
      return {
        ...response,
        costUsd: cost,
        latencyMs: latency,
      };
    } catch (error) {
      console.error('[LLMService] Generation failed:', error);
      throw error;
    }
  }

  /**
   * Get provider from model string
   */
  private getProviderFromModel(model: string): LLMProvider | null {
    if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('chatgpt')) return 'openai';
    if (model.startsWith('claude-')) return 'anthropic';
    if (model.startsWith('deepseek-')) return 'deepseek';
    if (model.startsWith('gemini-')) return 'gemini';
    if (model.startsWith('llama-')) return 'openrouter';
    if (model.startsWith('qwen')) return 'kimi';
    if (model.startsWith('grok-')) return 'openrouter';
    if (model.startsWith('mistral') || model.startsWith('pixtral')) return 'openrouter';
    if (model.startsWith('moonshot-')) return 'kimi';
    if (model.startsWith('fara-')) return 'openrouter';
    return null;
  }

  /**
   * Calculate cost based on provider, model, and tokens
   * Updated: December 2025 pricing
   */
  private calculateCost(
    provider: LLMProvider,
    model: string,
    tokens: { input: number; output: number }
  ): number {
    // Cost per 1M tokens (input / output) - December 2025 latest models
    const costMap: Record<string, { input: number; output: number }> = {
      // OpenAI (Latest Dec 2025 - GPT-5.2 released Dec 11)
      'gpt-5.2': { input: 5.00, output: 20.00 },
      'gpt-5.2-instant': { input: 3.00, output: 12.00 },
      'gpt-5.2-thinking': { input: 20.00, output: 80.00 },
      'gpt-5.2-pro': { input: 30.00, output: 120.00 },
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-2024-11-20': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'o1': { input: 15.00, output: 60.00 },
      'o1-2024-12-17': { input: 15.00, output: 60.00 },
      'o1-mini': { input: 3.00, output: 12.00 },
      'chatgpt-4o-latest': { input: 5.00, output: 15.00 },
      
      // Anthropic (Latest Dec 2025 - Claude 4.5)
      'claude-4.5-sonnet': { input: 3.00, output: 15.00 },
      'claude-4.5-opus': { input: 15.00, output: 75.00 },
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
      'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
      'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
      
      // DeepSeek (Latest Dec 2025 - V3.2 & V3.2 Speciale released Dec 8)
      'deepseek-v3.2': { input: 0.27, output: 1.10 },
      'deepseek-v3.2-speciale': { input: 0.55, output: 2.19 },
      'deepseek-v3': { input: 0.27, output: 1.10 },
      'deepseek-chat': { input: 0.14, output: 0.28 },
      'deepseek-reasoner': { input: 0.55, output: 2.19 },
      'deepseek-coder': { input: 0.14, output: 0.28 },
      
      // Google Gemini (Latest Dec 2025 - Gemini 3 released Nov 18)
      'gemini-3-pro': { input: 2.00, output: 8.00 },
      'gemini-3-pro-deepthink': { input: 5.00, output: 20.00 },
      'gemini-3-flash': { input: 0.10, output: 0.40 },
      'gemini-2.0-flash-exp': { input: 0.00, output: 0.00 },
      'gemini-2.0-flash-thinking-exp': { input: 0.00, output: 0.00 },
      'gemini-exp-1206': { input: 0.00, output: 0.00 },
      'gemini-2.0-pro-exp': { input: 0.00, output: 0.00 },
      'gemini-1.5-pro': { input: 1.25, output: 5.00 },
      'gemini-1.5-flash': { input: 0.075, output: 0.30 },
      'gemini-1.5-flash-8b': { input: 0.0375, output: 0.15 },
      
      // Meta Llama (Latest Dec 2025 - Llama 4 released April 2025)
      'llama-4-scout': { input: 1.50, output: 1.50 },
      'llama-4-maverick': { input: 2.00, output: 2.00 },
      'llama-3.3-70b-instruct': { input: 0.60, output: 0.60 },
      'llama-3.1-405b-instruct': { input: 3.00, output: 3.00 },
      'llama-3.1-70b-instruct': { input: 0.60, output: 0.60 },
      'llama-3.1-8b-instruct': { input: 0.20, output: 0.20 },
      
      // Alibaba Qwen (Latest Dec 2025 - Qwen3 released April 28)
      'qwen3-235b': { input: 1.50, output: 1.50 },
      'qwen3-32b': { input: 0.40, output: 0.40 },
      'qwen3-14b': { input: 0.25, output: 0.25 },
      'qwen3-7b': { input: 0.15, output: 0.15 },
      'qwen-2.5-max': { input: 1.00, output: 1.00 },
      'qwen-2.5-72b-instruct': { input: 0.40, output: 0.40 },
      'qwen-2.5-coder-32b': { input: 0.25, output: 0.25 },
      
      // xAI Grok (Latest Dec 2025 - Grok 3 released Feb 2025)
      'grok-3': { input: 3.00, output: 12.00 },
      'grok-3-mini': { input: 1.00, output: 4.00 },
      'grok-2-1212': { input: 2.00, output: 10.00 },
      'grok-2-vision-1212': { input: 2.00, output: 10.00 },
      'grok-beta': { input: 5.00, output: 15.00 },
      
      // Mistral AI (Latest Dec 2025)
      'mistral-large-2411': { input: 2.00, output: 6.00 },
      'mistral-small-2409': { input: 0.20, output: 0.60 },
      'pixtral-large-2411': { input: 2.00, output: 6.00 },
      
      // Kimi (Moonshot AI)
      'moonshot-v1-128k': { input: 2.00, output: 2.00 },
      'moonshot-v1-32k': { input: 1.00, output: 1.00 },
      
      // Microsoft Fara (Latest Dec 2025 - released late 2025)
      'fara-7b': { input: 0.10, output: 0.10 },
    };

    const costs = costMap[model];
    if (!costs) {
      console.warn(`[LLMService] No cost data for model: ${model}`);
      return 0;
    }

    // Calculate cost (tokens / 1M * price)
    const inputCost = (tokens.input / 1000000) * costs.input;
    const outputCost = (tokens.output / 1000000) * costs.output;
    
    return inputCost + outputCost;
  }

  /**
   * Select best model for agent and tier
   */
  selectModel(agentRole: string, tier: 'premium' | 'budget'): string {
    // Use the primary provider's model for the given tier
    const primaryProvider = 'openai'; // Default provider since this.provider is undefined
    const providerConfig = PROVIDER_CONFIGS[primaryProvider];
    
    if (!providerConfig || !providerConfig.models) {
      // Fallback to OpenAI models
      return tier === 'premium' ? 'gpt-4o' : 'gpt-4o-mini';
    }

    return tier === 'premium' ? providerConfig.models.premium : providerConfig.models.budget;
  }

  /**
   * Estimate cost for a request before calling
   */
  estimateCost(
    model: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): LLMCostCalculation {
    const provider = this.getProviderFromModel(model);
    if (!provider) {
      return { inputCost: 0, outputCost: 0, totalCost: 0 };
    }

    const cost = this.calculateCost(provider, model, {
      input: estimatedInputTokens,
      output: estimatedOutputTokens,
    });

    return {
      inputCost: (estimatedInputTokens / 1000000) * cost,
      outputCost: (estimatedOutputTokens / 1000000) * cost,
      totalCost: cost,
    };
  }

  /**
   * Check if provider is available (API key configured)
   */
  isProviderAvailable(provider: LLMProvider): boolean {
    const envVars: Record<LLMProvider, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      gemini: 'GEMINI_API_KEY',
      kimi: 'KIMI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
    };

    const envVar = envVars[provider];
    return !!process.env[envVar];
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): LLMProvider[] {
    const providers: LLMProvider[] = [
      'openai',
      'anthropic',
      'deepseek',
      'gemini',
      'kimi',
      'openrouter',
    ];

    return providers.filter(p => this.isProviderAvailable(p));
  }
}

// Singleton instance
let llmService: LLMService | null = null;

/**
 * Get LLM service instance
 */
export function getLLMService(): LLMService {
  if (!llmService) {
    llmService = new LLMService();
  }
  return llmService;
}

