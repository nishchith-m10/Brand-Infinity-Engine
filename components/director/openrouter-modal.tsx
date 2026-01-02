'use client';

import { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/modal';
import { Search, Check } from 'lucide-react';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  pricingTier?: string;
  category?: string;
}

interface OpenRouterModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: ModelInfo[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
}

const POPULAR_MODELS = [
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4-turbo',
  'openai/gpt-4o',
  'google/gemini-pro-1.5',
  'meta-llama/llama-3-70b-instruct',
  'anthropic/claude-3-opus',
  'openai/gpt-3.5-turbo',
  'mistralai/mixtral-8x7b-instruct',
  'google/gemini-flash-1.5',
  'anthropic/claude-3-haiku',
];

const CATEGORIES = [
  { id: 'popular', name: 'Popular' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'meta', name: 'Meta (Llama)' },
  { id: 'google', name: 'Google' },
  { id: 'mistral', name: 'Mistral' },
  { id: 'free', name: 'Free' },
  { id: 'other', name: 'Open Source' },
  { id: 'all', name: 'All Models' },
];

export function OpenRouterModal({
  isOpen,
  onClose,
  models,
  selectedModel,
  onSelect,
}: OpenRouterModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('popular');

  // Filter models based on search and category
  const filteredModels = useMemo(() => {
    let filtered = models;

    // Filter by category
    if (selectedCategory === 'popular') {
      filtered = filtered.filter(m => POPULAR_MODELS.includes(m.id));
    } else if (selectedCategory === 'free') {
      filtered = filtered.filter(m => 
        m.pricingTier === 'Free' || 
        m.id.includes(':free') || 
        m.name.toLowerCase().includes('free')
      );
    } else if (selectedCategory !== 'all') {
      filtered = filtered.filter(m => m.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [models, searchQuery, selectedCategory]);

  const handleSelect = (modelId: string) => {
    onSelect(modelId);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Open Router - Select Model"
      description="Choose from 100+ AI models"
      size="lg"
    >
      <div className="flex flex-col gap-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Model List */}
        <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
          {filteredModels.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p className="text-sm">No models found</p>
              <p className="text-xs mt-1">Try adjusting your search or category</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model.id)}
                  className={`w-full px-4 py-4 text-left hover:bg-slate-50 transition-colors flex items-center justify-between ${
                    selectedModel === model.id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm text-slate-800">
                      {model.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {model.id}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {model.contextWindow && (
                      <span className="text-xs text-slate-500">
                        {(model.contextWindow / 1000).toFixed(0)}k ctx
                      </span>
                    )}
                    {model.pricingTier && (
                      <span className="text-xs font-medium text-slate-600">
                        {model.pricingTier}
                      </span>
                    )}
                    {selectedModel === model.id && (
                      <Check className="h-4 w-4 text-indigo-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Showing {filteredModels.length} of {models.length} models
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}



