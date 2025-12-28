'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Loader2, Brain } from 'lucide-react';
import { OpenRouterModal } from './openrouter-modal';
import { useApiKeys } from '@/contexts/api-keys-context';

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

interface ProviderSelectorProps {
  value: string; // provider:modelId format (e.g., "openai:gpt-4o" or "openrouter:anthropic/claude-3.5-sonnet")
  onChange: (value: string) => void;
  className?: string;
}

const PROVIDER_DISPLAY: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  kimi: 'Kimi',
  openrouter: 'Open Router',
};

export function ProviderSelector({ value, onChange, className = '' }: ProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openRouterModalOpen, setOpenRouterModalOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderModels[]>([]);
  const [loading, setLoading] = useState(true);
  const { apiKeys } = useApiKeys();

  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        // Pass OpenRouter API key if configured
        const params = new URLSearchParams();
        if (apiKeys.openrouter) {
          params.set('openrouter_key', apiKeys.openrouter);
        }
        
        const url = `/api/v1/models/available${params.toString() ? '?' + params.toString() : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          setProviders(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [apiKeys.openrouter]); // Re-fetch when OpenRouter key changes

  // Parse current selection
  const [currentProvider, currentModelId] = value.split(':');
  const currentProviderData = providers.find(p => p.provider === currentProvider);
  const currentModel = currentProviderData?.models.find(m => m.id === currentModelId);

  // Get display name for current selection
  const getDisplayName = () => {
    if (!currentProvider) return 'Select Model...';
    
    const providerName = PROVIDER_DISPLAY[currentProvider];
    if (!providerName) return 'Select Model...';

    if (currentModel) {
      return currentModel.name;
    }

    return providerName;
  };

  // Handle provider selection
  const handleProviderSelect = (provider: string) => {
    if (provider === 'openrouter') {
      setIsOpen(false);
      setOpenRouterModalOpen(true);
      return;
    }

    // Select first model from provider
    const providerData = providers.find(p => p.provider === provider);
    if (providerData && providerData.models.length > 0) {
      onChange(`${provider}:${providerData.models[0].id}`);
    }
    setIsOpen(false);
  };

  // Handle OpenRouter model selection
  const handleOpenRouterSelect = (modelId: string) => {
    onChange(`openrouter:${modelId}`);
    setOpenRouterModalOpen(false);
  };

  const openRouterModels = providers.find(p => p.provider === 'openrouter')?.models || [];

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">Loading...</span>
      </div>
    );
  }

  return (
    <>
      <div className={`relative ${className}`}>
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg hover:border-slate-400 transition-colors min-w-[200px] justify-between"
        >
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-800 truncate">
              {getDisplayName()}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu */}
            <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
              {providers.map((providerData) => {
                const info = PROVIDER_DISPLAY[providerData.provider as keyof typeof PROVIDER_DISPLAY];
                if (!info) return null;

                return (
                  <div key={providerData.provider} className="border-b border-slate-100 last:border-0">
                    {/* Provider Header */}
                    <button
                      onClick={() => handleProviderSelect(providerData.provider)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-slate-800">
                          {info}
                        </span>
                        {providerData.provider === 'openrouter' && (
                          <span className="text-xs text-slate-500">
                            {providerData.models.length}+ models
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Show models for non-OpenRouter providers */}
                    {providerData.provider !== 'openrouter' && (
                      <div className="px-4 pb-2">
                        {providerData.models.slice(0, 3).map((model) => (
                          <button
                            key={model.id}
                            onClick={() => onChange(`${providerData.provider}:${model.id}`)}
                            className={`w-full px-3 py-2 text-left rounded text-xs hover:bg-slate-50 transition-colors ${
                              value === `${providerData.provider}:${model.id}`
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {model.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* OpenRouter Modal */}
      <OpenRouterModal
        isOpen={openRouterModalOpen}
        onClose={() => setOpenRouterModalOpen(false)}
        models={openRouterModels}
        selectedModel={currentModelId}
        onSelect={handleOpenRouterSelect}
      />
    </>
  );
}

