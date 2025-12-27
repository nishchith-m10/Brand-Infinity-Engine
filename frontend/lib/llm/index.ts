/**
 * LLM Module Exports
 * Slice 4: Multi-Provider LLM Service
 */

// Service
export { getLLMService, LLMService } from './service';

// Types
export type {
  LLMProvider,
  LLMModel,
  LLMRequest,
  LLMResponse,
  LLMMessage,
  LLMCostCalculation,
} from './types';

// Adapters (for testing/advanced usage)
export { OpenAIAdapter } from './adapters/openai';
export { AnthropicAdapter } from './adapters/anthropic';
export { DeepSeekAdapter } from './adapters/deepseek';
export { GeminiAdapter } from './adapters/gemini';

