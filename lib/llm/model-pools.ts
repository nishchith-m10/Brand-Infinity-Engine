/**
 * Model Pools for Intelligent Routing
 * Phase 5: MVP Hardening - Dynamic Model Selection
 * 
 * Purpose:
 * - Define pools of models for different performance tiers
 * - Enable intelligent model selection based on task characteristics
 * - Support Eco/Infinity tier preferences
 */

import type { PerformanceTier, ModelPool, ModelConfig, ModelSelectionStrategy } from '@/lib/sops/types';

// =============================================================================
// Model Definitions
// =============================================================================

/**
 * All available models with their configurations
 * Updated January 2026 to match frontend curated list
 */
export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  // =========== OpenAI (2026) ===========
  'gpt-5.2-pro': {
    id: 'gpt-5.2-pro',
    provider: 'openai',
    displayName: 'GPT-5.2 Pro',
    strengths: ['deep-reasoning', 'complex-analysis', 'nuanced', 'creative-mastery', 'coding'],
    costPerMillion: { input: 15.00, output: 60.00 },
    contextWindow: 256000,
    isReasoning: true,
  },
  'gpt-5.2-thinking': {
    id: 'gpt-5.2-thinking',
    provider: 'openai',
    displayName: 'GPT-5.2 Thinking',
    strengths: ['deep-reasoning', 'logic', 'math', 'complex-analysis'],
    costPerMillion: { input: 10.00, output: 40.00 },
    contextWindow: 256000,
    isReasoning: true,
  },
  'gpt-5.2-instant': {
    id: 'gpt-5.2-instant',
    provider: 'openai',
    displayName: 'GPT-5.2 Instant',
    strengths: ['fast', 'general', 'cost-effective'],
    costPerMillion: { input: 1.00, output: 4.00 },
    contextWindow: 128000,
  },
  'o3': {
    id: 'o3',
    provider: 'openai',
    displayName: 'OpenAI o3',
    strengths: ['deep-reasoning', 'logic', 'math', 'complex-analysis', 'coding'],
    costPerMillion: { input: 20.00, output: 80.00 },
    contextWindow: 256000,
    isReasoning: true,
  },
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    strengths: ['general', 'coding', 'analysis', 'creative'],
    costPerMillion: { input: 2.50, output: 10.00 },
    contextWindow: 128000,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    strengths: ['general', 'fast', 'cost-effective'],
    costPerMillion: { input: 0.15, output: 0.60 },
    contextWindow: 128000,
  },

  // =========== Anthropic (2026) ===========
  'claude-opus-4.5': {
    id: 'claude-opus-4.5',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.5',
    strengths: ['deep-reasoning', 'complex-analysis', 'nuanced', 'creative-mastery', 'coding'],
    costPerMillion: { input: 15.00, output: 75.00 },
    contextWindow: 500000,
    isReasoning: true,
  },
  'claude-sonnet-4.5': {
    id: 'claude-sonnet-4.5',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.5',
    strengths: ['creative-writing', 'analysis', 'nuanced', 'coding'],
    costPerMillion: { input: 3.00, output: 15.00 },
    contextWindow: 300000,
  },
  'claude-haiku-4.5': {
    id: 'claude-haiku-4.5',
    provider: 'anthropic',
    displayName: 'Claude Haiku 4.5',
    strengths: ['fast', 'cost-effective', 'general'],
    costPerMillion: { input: 0.80, output: 4.00 },
    contextWindow: 200000,
  },
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    strengths: ['creative-writing', 'analysis', 'nuanced', 'coding'],
    costPerMillion: { input: 3.00, output: 15.00 },
    contextWindow: 200000,
  },

  // =========== Google Gemini (2026) ===========
  'gemini-3-flash': {
    id: 'gemini-3-flash',
    provider: 'gemini',
    displayName: 'Gemini 3 Flash',
    strengths: ['fast', 'cost-effective', 'multimodal'],
    costPerMillion: { input: 0.00, output: 0.00 }, // Free tier
    contextWindow: 2000000,
  },
  'gemini-3-pro': {
    id: 'gemini-3-pro',
    provider: 'gemini',
    displayName: 'Gemini 3 Pro',
    strengths: ['deep-reasoning', 'long-context', 'multimodal', 'analysis'],
    costPerMillion: { input: 2.00, output: 8.00 },
    contextWindow: 4000000,
    isReasoning: true,
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    provider: 'gemini',
    displayName: 'Gemini 2.5 Pro',
    strengths: ['long-context', 'multimodal', 'analysis'],
    costPerMillion: { input: 1.25, output: 5.00 },
    contextWindow: 2000000,
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    displayName: 'Gemini 2.0 Flash',
    strengths: ['fast', 'cost-effective', 'multimodal'],
    costPerMillion: { input: 0.00, output: 0.00 }, // Free tier
    contextWindow: 1000000,
  },

  // =========== DeepSeek (2026) ===========
  'deepseek-chat-v3.2': {
    id: 'deepseek-chat-v3.2',
    provider: 'deepseek',
    displayName: 'DeepSeek V3.2 Speciale',
    strengths: ['coding', 'general', 'cost-effective', 'reasoning'],
    costPerMillion: { input: 0.14, output: 0.28 },
    contextWindow: 128000,
  },
  'deepseek-v3': {
    id: 'deepseek-v3',
    provider: 'deepseek',
    displayName: 'DeepSeek V3',
    strengths: ['coding', 'general', 'cost-effective'],
    costPerMillion: { input: 0.14, output: 0.28 },
    contextWindow: 64000,
  },

  // =========== Kimi (2026) ===========
  'kimi-k2-thinking': {
    id: 'kimi-k2-thinking',
    provider: 'kimi',
    displayName: 'Kimi K2 Thinking',
    strengths: ['deep-reasoning', 'long-context', 'chinese', 'logic'],
    costPerMillion: { input: 2.00, output: 4.00 },
    contextWindow: 256000,
    isReasoning: true,
  },
  'kimi-k2-chat': {
    id: 'kimi-k2-chat',
    provider: 'kimi',
    displayName: 'Kimi K2 Chat',
    strengths: ['long-context', 'chinese', 'general', 'cost-effective'],
    costPerMillion: { input: 1.00, output: 2.00 },
    contextWindow: 256000,
  },

  // =========== OpenRouter (Fallback/Free) ===========
  'xiaomi/mimo-v2-flash:free': {
    id: 'xiaomi/mimo-v2-flash:free',
    provider: 'openrouter',
    displayName: 'Xiaomi MiMo Flash (Free)',
    strengths: ['free', 'fast', 'basic'],
    costPerMillion: { input: 0.00, output: 0.00 },
    contextWindow: 32000,
  },
};

// =============================================================================
// Pool Definitions
// =============================================================================

/**
 * FAST POOL: Quick responses, cost-effective
 * Best for: Simple tasks, high volume, real-time responses
 * Updated January 2026
 */
export const FAST_POOL: ModelPool = {
  id: 'fast',
  name: 'Fast Pool',
  description: 'Quick, cost-effective models for simple tasks',
  selectionStrategy: 'first-available',
  models: [
    AVAILABLE_MODELS['claude-haiku-4.5'],
    AVAILABLE_MODELS['gemini-3-flash'],
    AVAILABLE_MODELS['gpt-4o-mini'],
    AVAILABLE_MODELS['gpt-5.2-instant'],
    AVAILABLE_MODELS['deepseek-chat-v3.2'],
    AVAILABLE_MODELS['xiaomi/mimo-v2-flash:free'],
  ],
};

/**
 * STANDARD POOL: Balanced quality and cost
 * Best for: Core content generation, everyday tasks
 * Updated January 2026
 */
export const STANDARD_POOL: ModelPool = {
  id: 'standard',
  name: 'Standard Pool',
  description: 'Balanced models for quality content generation',
  selectionStrategy: 'best-for-task',
  models: [
    AVAILABLE_MODELS['claude-sonnet-4.5'],
    AVAILABLE_MODELS['gpt-4o'],
    AVAILABLE_MODELS['gemini-2.5-pro'],
    AVAILABLE_MODELS['kimi-k2-chat'],
    AVAILABLE_MODELS['deepseek-v3'],
  ],
};

/**
 * GENIUS POOL: Maximum intelligence, unconstrained reasoning
 * Best for: Complex reasoning, strategic planning, critical decisions
 * Updated January 2026
 */
export const GENIUS_POOL: ModelPool = {
  id: 'genius',
  name: 'Genius Pool',
  description: 'Maximum intelligence for complex reasoning tasks',
  selectionStrategy: 'best-for-task',
  models: [
    AVAILABLE_MODELS['o3'],
    AVAILABLE_MODELS['gpt-5.2-pro'],
    AVAILABLE_MODELS['claude-opus-4.5'],
    AVAILABLE_MODELS['gemini-3-pro'],
    AVAILABLE_MODELS['gpt-5.2-thinking'],
    AVAILABLE_MODELS['kimi-k2-thinking'],
    AVAILABLE_MODELS['claude-sonnet-4.5'], // Fallback
  ],
};

/**
 * Map performance tiers to pools
 */
export const TIER_TO_POOL: Record<PerformanceTier, ModelPool> = {
  eco: FAST_POOL,
  standard: STANDARD_POOL,
  infinity: GENIUS_POOL,
};

// =============================================================================
// Blacklists for Eco Tier
// =============================================================================

/**
 * Models blacklisted in Eco tier (too expensive)
 * Updated January 2026
 */
export const ECO_BLACKLIST = new Set([
  'o3',
  'gpt-5.2-pro',
  'gpt-5.2-thinking',
  'claude-opus-4.5',
  'gemini-3-pro',
  'kimi-k2-thinking',
]);

// =============================================================================
// Model Selection Logic
// =============================================================================

export interface ModelSelectionContext {
  tier: PerformanceTier;
  taskType?: string;        // e.g., 'creative-writing', 'coding', 'reasoning'
  preferredProvider?: string;
  availableProviders: string[]; // Providers with valid API keys
}

/**
 * Select the best model from a pool based on context
 */
export function selectModelFromPool(context: ModelSelectionContext): ModelConfig | null {
  const pool = TIER_TO_POOL[context.tier];
  if (!pool) {
    console.error(`[ModelPools] Unknown tier: ${context.tier}`);
    return null;
  }

  // Filter by available providers
  let candidates = pool.models.filter(m => 
    context.availableProviders.includes(m.provider)
  );

  // Apply Eco blacklist
  if (context.tier === 'eco') {
    candidates = candidates.filter(m => !ECO_BLACKLIST.has(m.id));
  }

  if (candidates.length === 0) {
    console.warn(`[ModelPools] No available models for tier: ${context.tier}`);
    return null;
  }

  // Selection strategy
  switch (pool.selectionStrategy) {
    case 'first-available':
      return candidates[0];

    case 'cheapest':
      return candidates.reduce((min, m) => 
        (m.costPerMillion.input + m.costPerMillion.output) < 
        (min.costPerMillion.input + min.costPerMillion.output) ? m : min
      );

    case 'best-for-task':
      if (context.taskType) {
        // Find model with matching strength
        const specialized = candidates.find(m => 
          m.strengths.includes(context.taskType!)
        );
        if (specialized) return specialized;
      }
      // Fall back to first available
      return candidates[0];

    case 'random':
      return candidates[Math.floor(Math.random() * candidates.length)];

    default:
      return candidates[0];
  }
}

/**
 * Get the default model for a tier (ignores availability checks)
 */
export function getDefaultModelForTier(tier: PerformanceTier): string {
  switch (tier) {
    case 'eco':
      return 'gemini-2.0-flash-exp';
    case 'standard':
      return 'claude-3-5-sonnet-20241022';
    case 'infinity':
      return 'o1';
  }
}

/**
 * Check if a model is available for a tier
 */
export function isModelAllowedForTier(modelId: string, tier: PerformanceTier): boolean {
  if (tier === 'eco') {
    return !ECO_BLACKLIST.has(modelId);
  }
  // Standard and Infinity allow all models
  return true;
}
