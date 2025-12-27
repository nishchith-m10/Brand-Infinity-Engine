'use client';

import { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronUp, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useApiKeys, ApiKeyEntry, USE_CASE_LABELS } from '@/contexts/api-keys-context';

interface MultiKeyProviderCardProps {
  provider: 'openai' | 'gemini';
  name: string;
  description: string;
}

export function MultiKeyProviderCard({ provider, name, description }: MultiKeyProviderCardProps) {
  const { apiKeys, addKey, updateKey, removeKey } = useApiKeys();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const providerKeys = Object.entries(apiKeys[provider]);
  const hasKeys = providerKeys.some(([, entry]) => entry.key.length > 0);

  const toggleShowKey = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const startEditingName = (keyId: string, currentName: string) => {
    setEditingName(keyId);
    setTempName(currentName);
  };

  const saveEditingName = (keyId: string) => {
    updateKey(provider, keyId, { name: tempName });
    setEditingName(null);
  };

  const cancelEditingName = () => {
    setEditingName(null);
    setTempName('');
  };

  const handleAddKey = (useCase: ApiKeyEntry['useCase']) => {
    addKey(provider, {
      key: '',
      name: USE_CASE_LABELS[useCase],
      useCase,
    });
  };

  // Get available use cases (not already added)
  const existingUseCases = providerKeys.map(([, entry]) => entry.useCase);
  const availableUseCases = (Object.keys(USE_CASE_LABELS) as ApiKeyEntry['useCase'][])
    .filter(uc => !existingUseCases.includes(uc));

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{name}</span>
              <Badge variant={hasKeys ? 'success' : 'secondary'}>
                {hasKeys ? `${providerKeys.filter(([, e]) => e.key).length} key(s)` : 'Not configured'}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Multi-key support</span>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-slate-200">
          {/* Existing Keys */}
          {providerKeys.map(([keyId, entry]) => (
            <div key={keyId} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="flex-1 space-y-2">
                {/* Key Name - Editable */}
                <div className="flex items-center gap-2">
                  {editingName === keyId ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="h-7 text-sm w-40"
                        autoFocus
                      />
                      <button onClick={() => saveEditingName(keyId)} className="text-green-600 hover:text-green-700">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={cancelEditingName} className="text-red-600 hover:text-red-700">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-slate-700">{entry.name}</span>
                      <button 
                        onClick={() => startEditingName(keyId, entry.name)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                  <Badge variant="default" className="text-xs">
                    {USE_CASE_LABELS[entry.useCase]}
                  </Badge>
                </div>
                
                {/* Key Input */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKeys[keyId] ? 'text' : 'password'}
                      placeholder="Enter API key..."
                      value={entry.key}
                      onChange={(e) => updateKey(provider, keyId, { key: e.target.value })}
                      className="pr-10 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey(keyId)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKeys[keyId] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeKey(provider, keyId)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {/* Add New Key */}
          {availableUseCases.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <Select
                options={[
                  { value: '', label: '+ Add key for use case...' },
                  ...availableUseCases.map(uc => ({
                    value: uc,
                    label: USE_CASE_LABELS[uc],
                  })),
                ]}
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddKey(e.target.value as ApiKeyEntry['useCase']);
                  }
                }}
                className="text-sm"
              />
            </div>
          )}

          {/* Empty state */}
          {providerKeys.length === 0 && (
            <div className="text-center py-4 text-sm text-slate-500">
              No keys configured. Add a key to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
