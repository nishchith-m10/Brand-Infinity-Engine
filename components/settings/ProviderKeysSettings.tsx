'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Eye, EyeOff, Check, X } from 'lucide-react';

interface ProviderKey {
  id: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

const PROVIDER_OPTIONS = [
  // LLM Providers
  { value: 'openai', label: 'OpenAI', category: 'LLM Providers' },
  { value: 'anthropic', label: 'Anthropic', category: 'LLM Providers' },
  { value: 'deepseek', label: 'DeepSeek', category: 'LLM Providers' },
  { value: 'gemini', label: 'Google Gemini', category: 'LLM Providers' },
  { value: 'openrouter', label: 'OpenRouter', category: 'LLM Providers' },
  // Voice Providers
  { value: 'elevenlabs', label: 'ElevenLabs', category: 'Voice Providers' },
  // Image Providers
  { value: 'midjourney', label: 'Midjourney', category: 'Image Providers' },
  { value: 'dalle', label: 'DALL-E', category: 'Image Providers' },
  // Video Providers
  { value: 'runway', label: 'Runway', category: 'Video Providers' },
  { value: 'pika', label: 'Pika', category: 'Video Providers' },
  { value: 'pollo', label: 'Pollo AI', category: 'Video Providers' },
  { value: 'kling', label: 'Kling', category: 'Video Providers' },
  // Social Platforms
  { value: 'instagram', label: 'Instagram', category: 'Social Platforms' },
  { value: 'tiktok', label: 'TikTok', category: 'Social Platforms' },
  { value: 'youtube', label: 'YouTube', category: 'Social Platforms' },
  { value: 'linkedin', label: 'LinkedIn', category: 'Social Platforms' },
  // Other
  { value: 'other', label: 'Other', category: 'Other' },
];

export function ProviderKeysSettings() {
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState('openai');
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      setLoading(true);
      const res = await fetch('/api/user/provider-keys');
      const json = await res.json();
      
      if (!json.success) {
        setError(json.error || 'Failed to load keys');
        return;
      }
      
      setKeys(json.data || []);
    } catch (err) {
      setError('Failed to load provider keys');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddKey() {
    if (!newKey.trim()) {
      setError('Key cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const res = await fetch('/api/user/provider-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newProvider,
          key: newKey,
        }),
      });

      const json = await res.json();
      
      if (!json.success) {
        setError(json.error || 'Failed to save key');
        return;
      }

      setSuccess(`${newProvider} key saved successfully`);
      setNewKey('');
      setShowAddForm(false);
      await loadKeys();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save provider key');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKey(id: string, provider: string) {
    if (!confirm(`Delete ${provider} key?`)) return;

    try {
      const res = await fetch(`/api/user/provider-keys/${id}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      
      if (!json.success) {
        setError(json.error || 'Failed to delete key');
        return;
      }

      setSuccess(`${provider} key deleted`);
      await loadKeys();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to delete provider key');
      console.error(err);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Provider API Keys</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Securely store your API keys for AI providers. Keys are encrypted server-side.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
          <X className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md">
          <Check className="h-4 w-4" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading keys...</div>
      ) : (
        <div className="space-y-3">
          {keys.length === 0 && !showAddForm && (
            <div className="text-sm text-muted-foreground">
              No provider keys configured. Add one to get started.
            </div>
          )}

          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 border rounded-md"
            >
              <div className="flex-1">
                <div className="font-medium capitalize">{key.provider}</div>
                <div className="text-xs text-muted-foreground">
                  Added {new Date(key.created_at).toLocaleDateString()}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteKey(key.id, key.provider)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}

          {showAddForm && (
            <div className="border rounded-md p-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <select
                  id="provider"
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  {/* Group providers by category */}
                  {Object.entries(
                    PROVIDER_OPTIONS.reduce((acc, opt) => {
                      if (!acc[opt.category]) acc[opt.category] = [];
                      acc[opt.category].push(opt);
                      return acc;
                    }, {} as Record<string, typeof PROVIDER_OPTIONS>)
                  ).map(([category, options]) => (
                    <optgroup key={category} label={category}>
                      {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showKey ? 'text' : 'password'}
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddKey} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Key'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewKey('');
                    setError(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!showAddForm && (
            <Button
              variant="outline"
              onClick={() => setShowAddForm(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Provider Key
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
