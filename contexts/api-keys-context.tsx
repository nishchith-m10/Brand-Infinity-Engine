'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// Types for multi-key support
export interface ApiKeyEntry {
  key: string;
  name: string; // Custom name for the key
  useCase: 'default' | 'imageGen' | 'videoGen' | 'scriptWriting' | 'creativeDirector';
}

export interface ProviderKeys {
  [keyId: string]: ApiKeyEntry;
}

export interface PollinationsPreferences {
  imageModel: 'flux' | 'flux-realism' | 'flux-anime' | 'flux-3d' | 'turbo';
  videoModel: 'mochi';
  imageEnhance: boolean;
  imageNoLogo: boolean;
}

export interface ApiKeysState {
  // Multi-key providers (OpenAI, Gemini)
  openai: ProviderKeys;
  gemini: ProviderKeys;
  // Single-key providers - AI
  anthropic: string;
  deepseek: string;
  kimi: string;
  openrouter: string;
  // Single-key providers - Voice
  elevenlabs: string;
  // Single-key providers - Video
  runway: string;
  pika: string;
  pollo: string;
  // Single-key providers - Social
  tiktok: string;
  instagram: string;
  youtube: string;
  linkedin: string;
  twitter: string;
  // Free provider settings
  useFreeProviders: boolean;
  pollinationsPreferences: PollinationsPreferences;
}

interface ApiKeysContextType {
  apiKeys: ApiKeysState;
  // Multi-key operations
  addKey: (provider: 'openai' | 'gemini', entry: ApiKeyEntry) => void;
  updateKey: (provider: 'openai' | 'gemini', keyId: string, entry: Partial<ApiKeyEntry>) => void;
  removeKey: (provider: 'openai' | 'gemini', keyId: string) => void;
  // Single-key operations
  setSimpleKey: (provider: keyof Omit<ApiKeysState, 'openai' | 'gemini'>, value: string) => void;
  // Get key for use case (with fallback to default)
  getKeyForUseCase: (provider: 'openai' | 'gemini', useCase: ApiKeyEntry['useCase']) => string | null;
  // Get all keys for a multi-key provider
  getProviderKeys: (provider: 'openai' | 'gemini') => ApiKeyEntry[];
  // Check if provider has any keys configured
  hasProviderKey: (provider: string) => boolean;
  // Free providers toggle
  setUseFreeProviders: (value: boolean) => void;
  // Pollinations preferences
  setPollinationsPreferences: (prefs: Partial<PollinationsPreferences>) => void;
  // Save all changes
  saveKeys: () => Promise<void>;
  isSaving: boolean;
}

const defaultState: ApiKeysState = {
  openai: {},
  gemini: {},
  anthropic: '',
  deepseek: '',
  kimi: '',
  openrouter: '',
  elevenlabs: '',
  runway: '',
  pika: '',
  pollo: '',
  tiktok: '',
  instagram: '',
  youtube: '',
  linkedin: '',
  twitter: '',
  useFreeProviders: true, // Default to using free providers
  pollinationsPreferences: {
    imageModel: 'flux',
    videoModel: 'mochi',
    imageEnhance: false,
    imageNoLogo: true,
  },
};

const ApiKeysContext = createContext<ApiKeysContextType | null>(null);

const STORAGE_KEY = 'dashboard_api_keys_v2';

export function ApiKeysProvider({ children }: { children: ReactNode }) {
  const [apiKeys, setApiKeys] = useState<ApiKeysState>(defaultState);
  const [isSaving, setIsSaving] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure pollinationsPreferences exists (for backward compatibility)
        if (!parsed.pollinationsPreferences) {
          parsed.pollinationsPreferences = defaultState.pollinationsPreferences;
        }
        setApiKeys({ ...defaultState, ...parsed });
      } catch (e) {
        console.error('Failed to load API keys:', e);
      }
    }
    
    // Migration from old format
    const oldSaved = localStorage.getItem('dashboard_api_keys');
    if (oldSaved && !saved) {
      try {
        const oldParsed = JSON.parse(oldSaved);
        // Migrate old single keys to new format
        const migrated: ApiKeysState = { ...defaultState };
        
        // Migrate multi-key providers
        if (oldParsed.openai) {
          migrated.openai = {
            'default': { key: oldParsed.openai, name: 'Default', useCase: 'default' }
          };
        }
        if (oldParsed.gemini) {
          migrated.gemini = {
            'default': { key: oldParsed.gemini, name: 'Default', useCase: 'default' }
          };
        }
        
        // Copy single-key providers
        ['anthropic', 'deepseek', 'kimi', 'openrouter', 'elevenlabs', 'tiktok', 'instagram', 'youtube'].forEach(p => {
          const provider = p as keyof Omit<ApiKeysState, 'openai' | 'gemini' | 'useFreeProviders'>;
          if (oldParsed[p]) {
            migrated[provider] = oldParsed[p];
          }
        });
        
        setApiKeys(migrated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch (e) {
        console.error('Failed to migrate old API keys:', e);
      }
    }
  }, []);

  // Generate unique ID for new keys
  const generateKeyId = () => `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addKey = useCallback((provider: 'openai' | 'gemini', entry: ApiKeyEntry) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [generateKeyId()]: entry,
      },
    }));
  }, []);

  const updateKey = useCallback((provider: 'openai' | 'gemini', keyId: string, entry: Partial<ApiKeyEntry>) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [keyId]: { ...prev[provider][keyId], ...entry },
      },
    }));
  }, []);

  const removeKey = useCallback((provider: 'openai' | 'gemini', keyId: string) => {
    setApiKeys(prev => {
      const { [keyId]: _, ...rest } = prev[provider];
      return { ...prev, [provider]: rest };
    });
  }, []);

  const setSimpleKey = useCallback((provider: keyof Omit<ApiKeysState, 'openai' | 'gemini'>, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
  }, []);

  const getKeyForUseCase = useCallback((provider: 'openai' | 'gemini', useCase: ApiKeyEntry['useCase']): string | null => {
    const providerKeys = apiKeys[provider];
    const entries = Object.values(providerKeys);
    
    // First try to find exact match for use case
    const exactMatch = entries.find(e => e.useCase === useCase);
    if (exactMatch?.key) return exactMatch.key;
    
    // Fallback to default
    const defaultKey = entries.find(e => e.useCase === 'default');
    return defaultKey?.key || null;
  }, [apiKeys]);

  const getProviderKeys = useCallback((provider: 'openai' | 'gemini'): ApiKeyEntry[] => {
    return Object.values(apiKeys[provider]);
  }, [apiKeys]);

  const hasProviderKey = useCallback((provider: string): boolean => {
    if (provider === 'openai' || provider === 'gemini') {
      return Object.values(apiKeys[provider]).some(e => e.key.length > 0);
    }
    const simpleProvider = provider as keyof Omit<ApiKeysState, 'openai' | 'gemini' | 'useFreeProviders'>;
    return !!apiKeys[simpleProvider];
  }, [apiKeys]);

  const setUseFreeProviders = useCallback((value: boolean) => {
    setApiKeys(prev => ({ ...prev, useFreeProviders: value }));
  }, []);

  const setPollinationsPreferences = useCallback((prefs: Partial<PollinationsPreferences>) => {
    setApiKeys(prev => ({
      ...prev,
      pollinationsPreferences: { ...prev.pollinationsPreferences, ...prefs },
    }));
  }, []);

  const saveKeys = useCallback(async () => {
    setIsSaving(true);
    try {
      // Save each provider key to backend database
      const savePromises = Object.entries(apiKeys).map(async ([provider, value]) => {
        if (typeof value === 'string' && value.trim()) {
          // Single key provider (e.g., anthropic, elevenlabs)
          return fetch('/api/user/provider-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, key: value }),
          });
        } else if (Array.isArray(value) && value.length > 0) {
          // Multi-key provider (e.g., openai, gemini) - save each key
          return Promise.all(
            value.map((key, index) => {
              if (key.trim()) {
                return fetch('/api/user/provider-keys', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    provider: `${provider}_${index + 1}`, 
                    key 
                  }),
                });
              }
              return Promise.resolve();
            })
          );
        }
        return Promise.resolve();
      });

      await Promise.all(savePromises);
      
      // Also save to localStorage for quick access
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apiKeys));
    } catch (error) {
      console.error('Failed to save API keys:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [apiKeys]);

  return (
    <ApiKeysContext.Provider value={{
      apiKeys,
      addKey,
      updateKey,
      removeKey,
      setSimpleKey,
      getKeyForUseCase,
      getProviderKeys,
      hasProviderKey,
      setUseFreeProviders,
      setPollinationsPreferences,
      saveKeys,
      isSaving,
    }}>
      {children}
    </ApiKeysContext.Provider>
  );
}

export function useApiKeys() {
  const context = useContext(ApiKeysContext);
  if (!context) {
    throw new Error('useApiKeys must be used within an ApiKeysProvider');
  }
  return context;
}

// Use case display names
export const USE_CASE_LABELS: Record<ApiKeyEntry['useCase'], string> = {
  default: 'Default (Fallback)',
  imageGen: 'Image Generation',
  videoGen: 'Video Generation',
  scriptWriting: 'Script Writing',
  creativeDirector: 'Creative Director',
};
