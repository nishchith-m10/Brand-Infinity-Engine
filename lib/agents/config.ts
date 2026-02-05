/**
 * PHASE 6 PART 2: Agent Configuration
 * Model assignments, temperature settings, token limits
 */

import { AgentType } from "./types";
import { LLMProvider, ProviderConfig, PresetConfig } from "../llm/types";

// ============================================================================
// DEFAULT MODEL CONFIGURATION PER AGENT
// ============================================================================

export const DEFAULT_AGENT_TIERS: Record<AgentType, "premium" | "budget"> = {
  executive: "premium",    // Needs high intelligence for orchestration
  strategist: "budget",    // Structured output, less creativity needed
  copywriter: "budget",    // Can upgrade to premium for better creative
  producer: "budget",      // Coordination only, not creation
  verifier: "budget",      // Rule-based checks, consistent verdicts
};

export const AGENT_TEMPERATURES: Record<AgentType, number> = {
  executive: 0.7,   // Balanced reasoning
  strategist: 0.5,  // More deterministic
  copywriter: 0.8,  // Higher creativity
  producer: 0.3,    // Low creativity (coordination)
  verifier: 0.2,    // Consistent verdicts
};

export const AGENT_MAX_TOKENS: Record<AgentType, number> = {
  executive: 4000,   // Needs room for conversation
  strategist: 3000,  // Structured briefs
  copywriter: 4000,  // Scripts can be long
  producer: 2000,    // JSON payloads
  verifier: 2000,    // Pass/fail checks
};

// ============================================================================
// PROVIDER CONFIGURATIONS
// ============================================================================

export const PROVIDER_CONFIGS: Record<LLMProvider, ProviderConfig> = {
  openai: {
    id: "openai",
    name: "OpenAI GPT-5.2",
    models: {
      premium: "gpt-4o",
      budget: "gpt-4o-mini",
    },
    pricing: {
      input_per_1m: 3.0,
      output_per_1m: 12.0,
    },
    capabilities: {
      function_calling: true,
      json_mode: true,
      vision: true,
      streaming: true,
    },
    context_window: 128000,
    icon: "⚡",
    description: "Latest GPT-5.2 - Enhanced reasoning (Dec 2025)",
    speed_tier: "fast",
    cost_tier: "$$$$",
  },
  
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude 4.5",
    models: {
      premium: "claude-4.5-sonnet",
      budget: "claude-3-5-haiku-20241022",
    },
    pricing: {
      input_per_1m: 3.0,
      output_per_1m: 15.0,
    },
    capabilities: {
      function_calling: true,
      json_mode: false,
      vision: true,
      streaming: true,
    },
    context_window: 200000,
    icon: "🎨",
    description: "Latest Claude 4.5 - Best for creative content",
    speed_tier: "fast",
    cost_tier: "$$$$",
  },
  
  deepseek: {
    id: "deepseek",
    name: "DeepSeek V3.2",
    models: {
      premium: "deepseek-v3.2-speciale",
      budget: "deepseek-v3.2",
    },
    pricing: {
      input_per_1m: 0.1,
      output_per_1m: 0.2,
    },
    capabilities: {
      function_calling: true,
      json_mode: true,
      vision: false,
      streaming: true,
    },
    context_window: 64000,
    icon: "💰",
    description: "Ultra-low cost with competitive quality",
    speed_tier: "medium",
    cost_tier: "$",
  },
  
  gemini: {
    id: "gemini",
    name: "Google Gemini 3",
    models: {
      premium: "gemini-3-pro",
      budget: "gemini-3-flash",
    },
    pricing: {
      input_per_1m: 2.0,
      output_per_1m: 8.0,
    },
    capabilities: {
      function_calling: true,
      json_mode: true,
      vision: true,
      streaming: true,
    },
    context_window: 1000000,
    icon: "⚡",
    description: "Latest Gemini 3 - Multimodal (Nov 2025)",
    speed_tier: "ultra_fast",
    cost_tier: "$$",
  },
  
  kimi: {
    id: "kimi",
    name: "Kimi K2",
    models: {
      premium: "kimi-k2",
      budget: "kimi-k2",
    },
    pricing: {
      input_per_1m: 0.20,
      output_per_1m: 0.60,
    },
    capabilities: {
      function_calling: true,
      json_mode: true,
      vision: false,
      streaming: true,
    },
    context_window: 200000,
    icon: "📚",
    description: "Massive 200k+ context for document-heavy work",
    speed_tier: "fast",
    cost_tier: "$$",
  },
  
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    models: {
      premium: "openai/gpt-4o",
      budget: "openai/gpt-4o-mini",
    },
    pricing: {
      input_per_1m: 5.0,  // Varies by model
      output_per_1m: 15.0,
    },
    capabilities: {
      function_calling: true,
      json_mode: true,
      vision: true,
      streaming: true,
    },
    context_window: 128000,
    icon: "🔀",
    description: "Access to 100+ models from one API",
    speed_tier: "fast",
    cost_tier: "$$",
  },
};

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

export const PRESET_CONFIGS: Record<string, PresetConfig> = {
  draft: {
    mode: "draft",
    description: "20x cheaper, good quality - perfect for testing and high-volume",
    estimated_cost: "$0.002/request",
    agent_configs: {
      executive: { provider: "deepseek", model: "deepseek-chat" },
      strategist: { provider: "deepseek", model: "deepseek-chat" },
      copywriter: { provider: "deepseek", model: "deepseek-chat" },
      producer: { provider: "deepseek", model: "deepseek-chat" },
      verifier: { provider: "gemini", model: "gemini-2.0-flash-exp" },
    },
  },
  
  standard: {
    mode: "standard",
    description: "Balanced cost & quality - recommended for most campaigns",
    estimated_cost: "$0.03-0.08/request",
    agent_configs: {
      executive: { provider: "openai", model: "gpt-4o" },
      strategist: { provider: "openai", model: "gpt-4o-mini" },
      copywriter: { provider: "openai", model: "gpt-4o-mini" },
      producer: { provider: "openai", model: "gpt-4o-mini" },
      verifier: { provider: "openai", model: "gpt-4o-mini" },
    },
  },
  
  premium: {
    mode: "premium",
    description: "Best creative quality - for high-stakes campaigns",
    estimated_cost: "$0.08-0.15/request",
    agent_configs: {
      executive: { provider: "openai", model: "gpt-4o" },
      strategist: { provider: "openai", model: "gpt-4o" },
      copywriter: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
      producer: { provider: "openai", model: "gpt-4o-mini" },
      verifier: { provider: "openai", model: "gpt-4o-mini" },
    },
  },
};

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

export const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: ["rate_limit", "timeout", "server_error", "network_error"],
};

// ============================================================================
// SESSION CONFIGURATION
// ============================================================================

export const SESSION_CONFIG = {
  ttlSeconds: 1800,  // 30 minutes
  maxMessages: 50,
  maxIdleMinutes: 30,
};

// ============================================================================
// QUALITY THRESHOLDS
// ============================================================================

export const QUALITY_THRESHOLDS = {
  minPassScore: 7.0,           // Minimum to pass verification
  autoApproveScore: 8.5,       // Can auto-approve without review
  humanReviewScore: 6.0,       // Below this, requires human review
  failureScore: 5.0,           // Below this, automatic rejection
};

// ============================================================================
// COST LIMITS
// ============================================================================

export const COST_LIMITS = {
  default_max_per_request: 1.0,      // $1 USD max per request
  warning_threshold: 0.5,            // Warn user if approaching limit
  executive_max_per_call: 0.1,       // Executive shouldn't exceed this
  manager_max_per_call: 0.05,        // Manager agents shouldn't exceed this
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get model name for an agent based on provider and tier
 */
export function getModelForAgent(
  agent: AgentType,
  provider: LLMProvider
): string {
  const tier = DEFAULT_AGENT_TIERS[agent];
  return PROVIDER_CONFIGS[provider].models[tier];
}

/**
 * Calculate estimated cost for a request
 */
export function estimateRequestCost(
  provider: LLMProvider,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PROVIDER_CONFIGS[provider].pricing;
  return (
    (inputTokens * pricing.input_per_1m) / 1_000_000 +
    (outputTokens * pricing.output_per_1m) / 1_000_000
  );
}

/**
 * Get preset configuration by mode
 */
export function getPresetConfig(mode: string): PresetConfig {
  return PRESET_CONFIGS[mode] || PRESET_CONFIGS.standard;
}

/**
 * Check if a provider supports a capability
 */
export function supportsCapability(
  provider: LLMProvider,
  capability: keyof ProviderConfig["capabilities"]
): boolean {
  return PROVIDER_CONFIGS[provider].capabilities[capability];
}

