/**
 * PHASE 6 PART 2: Multi-Provider LLM Types
 * Unified interface for multiple LLM providers
 */

import { AgentType } from "../agents/types";

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export type LLMProvider = 
  | "openai" 
  | "anthropic" 
  | "deepseek" 
  | "gemini" 
  | "kimi" 
  | "openrouter";

export interface ProviderConfig {
  id: LLMProvider;
  name: string;
  models: {
    premium: string;
    budget: string;
  };
  pricing: {
    input_per_1m: number;   // USD per 1M input tokens
    output_per_1m: number;  // USD per 1M output tokens
  };
  capabilities: {
    function_calling: boolean;
    json_mode: boolean;
    vision: boolean;
    streaming: boolean;
  };
  context_window: number;
  icon: string;
  description: string;
  speed_tier: "ultra_fast" | "fast" | "medium" | "slow";
  cost_tier: "$" | "$$" | "$$$" | "$$$$";
}

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

export interface ModelConfig {
  provider: LLMProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  responseFormat?: "text" | "json";
  tools?: LLMTool[];
}

export interface AgentModelConfig {
  agent: AgentType;
  provider: LLMProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  tier: "premium" | "budget";
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface LLMRequest {
  userId: string;
  agentType: AgentType;
  messages: LLMMessage[];
  
  // Optional overrides
  provider?: LLMProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
  tools?: LLMTool[];
  stream?: boolean;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;  // For function calls
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  content: string;
  usage: TokenUsage;
  provider: LLMProvider;
  model: string;
  finish_reason?: "stop" | "length" | "function_call" | "content_filter";
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;  // USD
}

// ============================================================================
// TOOL/FUNCTION CALLING
// ============================================================================

export interface LLMTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
}

// ============================================================================
// CREDENTIALS
// ============================================================================

export interface ProviderCredentials {
  provider: LLMProvider;
  apiKey: string;
  endpoint?: string;  // For self-hosted or OpenRouter
  selectedModel?: string;  // For OpenRouter
  organizationId?: string;  // For OpenAI
}

export interface UserLLMProvider {
  id: string;
  user_id: string;
  provider: LLMProvider;
  encrypted_api_key: string;
  selected_model?: string;
  endpoint?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

export interface UserLLMPreferences {
  default_provider: LLMProvider;
  agent_models?: Partial<Record<AgentType, {
    provider: LLMProvider;
    model: string;
  }>>;
  budget_mode?: boolean;  // Force all agents to budget tier
  max_cost_per_request?: number;  // USD limit
}

export interface UserAgentModel {
  id: string;
  user_id: string;
  agent_type: AgentType;
  provider: LLMProvider;
  model: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// COST TRACKING
// ============================================================================

export interface ProviderUsageStats {
  provider: LLMProvider;
  requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  avg_cost_per_request: number;
  period_start: string;
  period_end: string;
}

export interface AgentCostBreakdown {
  agent: AgentType;
  provider: LLMProvider;
  model: string;
  calls: number;
  tokens: number;
  cost: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface LLMError {
  code: LLMErrorCode;
  message: string;
  provider: LLMProvider;
  retryable: boolean;
  retry_after?: number;  // seconds
  original_error?: any;
}

export type LLMErrorCode = 
  | "rate_limit"
  | "invalid_api_key"
  | "insufficient_quota"
  | "model_not_found"
  | "timeout"
  | "network_error"
  | "invalid_request"
  | "content_filter"
  | "server_error"
  | "unknown";

// ============================================================================
// STREAMING
// ============================================================================

export interface StreamChunk {
  content: string;
  is_final: boolean;
  usage?: Partial<TokenUsage>;
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

export type PresetMode = "draft" | "standard" | "premium";

export interface PresetConfig {
  mode: PresetMode;
  description: string;
  estimated_cost: string;
  agent_configs: Record<AgentType, {
    provider: LLMProvider;
    model: string;
  }>;
}

