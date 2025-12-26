import { NextResponse } from 'next/server';

/**
 * GET /api/v1/models/available
 * Fetches available models from all configured AI providers
 */

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  pricingTier?: string;
  category?: string;
}

interface ProviderModels {
  provider: string;
  icon: string;
  models: ModelInfo[];
}

// Cache for 1 hour
let cachedModels: ProviderModels[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function GET() {
  try {
    const now = Date.now();
    
    // Return cached data if still valid
    if (cachedModels && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({ success: true, data: cachedModels, cached: true });
    }

    const providers: ProviderModels[] = [];

    // ========================================================================
    // CURATED MODEL LIST - December 2025 (Always available, no API keys needed)
    // ========================================================================

    // OpenAI Models
    providers.push({
      provider: 'openai',
      icon: '',
      models: [
        { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', provider: 'openai', pricingTier: '$$$$', category: 'openai' },
        { id: 'gpt-5.2-thinking', name: 'GPT-5.2 Thinking', provider: 'openai', pricingTier: '$$$', category: 'openai' },
        { id: 'gpt-5.2-instant', name: 'GPT-5.2 Instant', provider: 'openai', pricingTier: '$$', category: 'openai' },
        { id: 'o3', name: 'o3', provider: 'openai', pricingTier: '$$$$', category: 'openai' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', pricingTier: '$$$', category: 'openai' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', pricingTier: '$', category: 'openai' },
      ],
    });

    // Anthropic Models  
    providers.push({
      provider: 'anthropic',
      icon: '',
      models: [
        { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'anthropic', pricingTier: '$$$$', category: 'anthropic' },
        { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'anthropic', pricingTier: '$$$', category: 'anthropic' },
        { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'anthropic', pricingTier: '$$', category: 'anthropic' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', pricingTier: '$$$', category: 'anthropic' },
      ],
    });

    // Google Gemini Models
    providers.push({
      provider: 'gemini',
      icon: '',
      models: [
        { id: 'gemini-3-flash', name: 'Gemini 3 Flash', provider: 'gemini', pricingTier: '$$', category: 'google' },
        { id: 'gemini-3-pro', name: 'Gemini 3 Pro', provider: 'gemini', pricingTier: '$$$', category: 'google' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', pricingTier: '$$$', category: 'google' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', pricingTier: '$$', category: 'google' },
      ],
    });

    // DeepSeek Models
    providers.push({
      provider: 'deepseek',
      icon: '',
      models: [
        { id: 'deepseek-v3.2-speciale', name: 'DeepSeek V3.2 Speciale', provider: 'deepseek', pricingTier: '$', category: 'deepseek' },
        { id: 'deepseek-chat-v3.2', name: 'DeepSeek V3.2', provider: 'deepseek', pricingTier: '$', category: 'deepseek' },
        { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek', pricingTier: '$', category: 'deepseek' },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'deepseek', pricingTier: '$', category: 'deepseek' },
      ],
    });

    // Kimi Models
    providers.push({
      provider: 'kimi',
      icon: '',
      models: [
        { id: 'kimi-k2-thinking', name: 'Kimi K2 Thinking', provider: 'kimi', contextWindow: 2000000, pricingTier: '$$', category: 'kimi' },
        { id: 'kimi-k2', name: 'Kimi K2', provider: 'kimi', contextWindow: 2000000, pricingTier: '$$', category: 'kimi' },
      ],
    });

    // ========================================================================
    // OpenRouter - Always visible (opens modal when clicked)
    // ========================================================================
    let openrouterModels: ModelInfo[] = [];
    
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          openrouterModels = data.data.map((m: { id: string; name: string; context_length?: number; pricing?: { prompt?: string } }) => ({
            id: m.id,
            name: m.name,
            provider: 'openrouter',
            contextWindow: m.context_length,
            pricingTier: getPricingTier(m.pricing),
            category: getCategoryFromModelId(m.id),
          }));
        }
      } catch (error) {
        console.error('Failed to fetch OpenRouter models:', error);
      }
    }
    
    // Always add OpenRouter (even with empty models - opens modal)
    providers.push({
      provider: 'openrouter',
      icon: '',
      models: openrouterModels,
    });

    // Cache the results
    cachedModels = providers;
    cacheTimestamp = now;

    return NextResponse.json({ success: true, data: providers, cached: false });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

// Helper to determine pricing tier from OpenRouter pricing object
function getPricingTier(pricing: { prompt?: string } | undefined): string {
  if (!pricing?.prompt) return '$$';
  
  const promptCost = parseFloat(pricing.prompt);
  if (promptCost < 0.0001) return '$';
  if (promptCost < 0.001) return '$$';
  if (promptCost < 0.01) return '$$$';
  return '$$$$';
}

// Helper to categorize OpenRouter models
function getCategoryFromModelId(modelId: string): string {
  const id = modelId.toLowerCase();
  
  if (id.includes('gpt') || id.includes('openai')) return 'openai';
  if (id.includes('claude') || id.includes('anthropic')) return 'anthropic';
  if (id.includes('llama') || id.includes('meta')) return 'meta';
  if (id.includes('gemini') || id.includes('palm') || id.includes('google')) return 'google';
  if (id.includes('mistral')) return 'mistral';
  if (id.includes('deepseek')) return 'deepseek';
  
  return 'other';
}

