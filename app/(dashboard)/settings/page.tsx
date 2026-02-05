'use client';

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Key,
  Bell,
  Shield,
  Save,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useApiKeys } from '@/contexts/api-keys-context';
import { MultiKeyProviderCard } from '@/components/settings/multi-key-provider-card';
import { useToast } from '@/lib/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast-container';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('api-keys');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const { apiKeys, setSimpleKey, setUseFreeProviders, setPollinationsPreferences, saveKeys, isSaving } = useApiKeys();
  const { toasts, showToast, dismissToast } = useToast();

  // Settings state (separate from API keys)
  const [settings, setSettings] = useState({
    defaultModel: 'claude-opus-4.5',
    defaultVideoModel: 'veo3',
    defaultQuality: 'high',
    defaultBudget: 'medium',
    autoApprove: false,
    emailNotifications: true,
    webhookUrl: '',
    brandName: 'My Brand',
    brandVoice: 'Professional, friendly, innovative',
    brandColors: 'hsl(var(--blue))',
    targetAudience: 'Gen Z and Millennials',
  });

  // Multi-key providers (OpenAI, Gemini) - handled by MultiKeyProviderCard
  const multiKeyProviders = [
    { provider: 'openai' as const, name: 'OpenAI', description: 'GPT-5.2 variants, DALL-E 3 image generation, o3 reasoning' },
    { provider: 'gemini' as const, name: 'Google Gemini', description: 'Gemini 3 Flash, Gemini 3 Pro, Veo video generation' },
  ];

  // Single-key providers
  const singleKeyConfigs = [
    { key: 'anthropic', name: 'Anthropic', description: 'Claude Opus 4.5, Sonnet 4.5, Haiku 4.5', category: 'AI' },
    { key: 'deepseek', name: 'DeepSeek', description: 'DeepSeek V3.2 Speciale, V3.2, V3 - affordable coding AI', category: 'AI' },
    { key: 'kimi', name: 'Kimi (Moonshot)', description: 'Kimi K2 Thinking - 2M context window', category: 'AI' },
    { key: 'openrouter', name: 'Open Router', description: 'Access to 100+ models from all providers in one API', category: 'AI' },
    { key: 'elevenlabs', name: 'ElevenLabs', description: 'Voice synthesis for video narration', category: 'Media' },
    { key: 'runway', name: 'Runway', description: 'Runway Gen-3 video generation', category: 'Media' },
    { key: 'pika', name: 'Pika', description: 'Pika Labs video generation', category: 'Media' },
    { key: 'pollo', name: 'Pollo AI', description: 'Pollo AI video generation (Kling backend)', category: 'Media' },
    { key: 'tiktok', name: 'TikTok', description: 'For publishing to TikTok', category: 'Social' },
    { key: 'instagram', name: 'Instagram/Meta', description: 'For publishing to Instagram & Facebook', category: 'Social' },
    { key: 'youtube', name: 'YouTube', description: 'For publishing to YouTube', category: 'Social' },
    { key: 'twitter', name: 'Twitter/X', description: 'For publishing to Twitter/X', category: 'Social' },
    { key: 'linkedin', name: 'LinkedIn', description: 'For publishing to LinkedIn', category: 'Social' },
  ] as const;

  type SimpleKeyType = typeof singleKeyConfigs[number]['key'];

  const getKeyStatus = (key: SimpleKeyType): 'connected' | 'error' | 'not_configured' => {
    const value = apiKeys[key];
    if (!value) return 'not_configured';
    if (value.length > 10) return 'connected';
    return 'error';
  };

  // Load saved settings from localStorage on mount (API keys loaded by context)
  useEffect(() => {
    const savedSettings = localStorage.getItem('dashboard_settings');
    
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      // Save API keys via context
      await saveKeys();
      // Save settings to localStorage
      localStorage.setItem('dashboard_settings', JSON.stringify(settings));
      
      showToast({ type: 'success', message: 'Settings saved successfully' });
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to save settings. Please try again.' });
    }
  };

  const getBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'connected':
      case 'published':
      case 'completed':
      case 'approved':
      case 'active':
        return 'success';
      case 'scheduled':
      case 'processing':
      case 'generating':
      case 'pending':
        return 'processing';
      case 'error':
      case 'failed':
      case 'rejected':
        return 'destructive';
      case 'not_configured':
      case 'draft':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const sections = [
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Configure your Brand Infinity preferences
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Navigation */}
        <div className="w-64 shrink-0">
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                  activeSection === section.id
                  ? 'bg-lamaPurpleLight text-lamaPurple'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <section.icon className="h-5 w-5" />
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* API Keys Section */}
          {activeSection === 'api-keys' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>API Configuration</CardTitle>
                  <CardDescription>
                    Connect your API keys to enable AI generation and media synthesis.
                    OpenAI and Gemini support multiple keys for cost tracking by feature.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Multi-Key Providers Section */}
                  <div>
                    <h3 className="mb-4 text-sm font-medium text-gray-500 flex items-center gap-2">
                      Multi-Key Providers
                      <span className="text-xs text-slate-400 font-normal">(separate keys for cost tracking)</span>
                    </h3>
                    <div className="space-y-4">
                      {multiKeyProviders.map((config) => (
                        <MultiKeyProviderCard
                          key={config.provider}
                          provider={config.provider}
                          name={config.name}
                          description={config.description}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Single-Key AI Providers */}
                  <div>
                    <h3 className="mb-4 text-sm font-medium text-gray-500">Other AI Providers</h3>
                    <div className="space-y-4">
                      {singleKeyConfigs
                        .filter((config) => config.category === 'AI')
                        .map((config) => {
                          const status = getKeyStatus(config.key);
                          return (
                            <div
                              key={config.key}
                              className="flex items-start gap-4 rounded-lg border border-slate-200 p-4"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">
                                    {config.name}
                                  </span>
                                  <Badge
                                    variant={getBadgeVariant(
                                      status === 'connected'
                                        ? 'connected'
                                        : status === 'error'
                                        ? 'error'
                                        : 'not_configured'
                                    )}
                                  >
                                    {status === 'connected'
                                      ? 'Connected'
                                      : status === 'error'
                                      ? 'Error'
                                      : 'Not configured'}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">
                                  {config.description}
                                </p>
                                <div className="mt-3 flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <Input
                                      type={showKeys[config.key] ? 'text' : 'password'}
                                      placeholder="Enter API key..."
                                      value={apiKeys[config.key] || ''}
                                      onChange={(e) => setSimpleKey(config.key, e.target.value)}
                                      className="pr-10"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => toggleShowKey(config.key)}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                      {showKeys[config.key] ? (
                                        <EyeOff className="h-4 w-4" />
                                      ) : (
                                        <Eye className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                  <Button variant="outline" size="sm">
                                    Test
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Media Providers */}
                  <div>
                    <h3 className="mb-4 text-sm font-medium text-gray-500">Media APIs</h3>
                    <div className="space-y-4">
                      {singleKeyConfigs
                        .filter((config) => config.category === 'Media')
                        .map((config) => {
                          const status = getKeyStatus(config.key);
                          return (
                            <div
                              key={config.key}
                              className="flex items-start gap-4 rounded-lg border border-slate-200 p-4"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{config.name}</span>
                                  <Badge variant={getBadgeVariant(status === 'connected' ? 'connected' : 'not_configured')}>
                                    {status === 'connected' ? 'Connected' : 'Not configured'}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">{config.description}</p>
                                <div className="mt-3 flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <Input
                                      type={showKeys[config.key] ? 'text' : 'password'}
                                      placeholder="Enter API key..."
                                      value={apiKeys[config.key] || ''}
                                      onChange={(e) => setSimpleKey(config.key, e.target.value)}
                                      className="pr-10"
                                    />
                                    <button type="button" onClick={() => toggleShowKey(config.key)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                      {showKeys[config.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                  <Button variant="outline" size="sm">Test</Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Social Providers */}
                  <div>
                    <h3 className="mb-4 text-sm font-medium text-gray-500">Social APIs</h3>
                    <div className="space-y-4">
                      {singleKeyConfigs
                        .filter((config) => config.category === 'Social')
                        .map((config) => {
                          const status = getKeyStatus(config.key);
                          return (
                            <div
                              key={config.key}
                              className="flex items-start gap-4 rounded-lg border border-slate-200 p-4"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{config.name}</span>
                                  <Badge variant={getBadgeVariant(status === 'connected' ? 'connected' : 'not_configured')}>
                                    {status === 'connected' ? 'Connected' : 'Not configured'}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">{config.description}</p>
                                <div className="mt-3 flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <Input
                                      type={showKeys[config.key] ? 'text' : 'password'}
                                      placeholder="Enter API key..."
                                      value={apiKeys[config.key] || ''}
                                      onChange={(e) => setSimpleKey(config.key, e.target.value)}
                                      className="pr-10"
                                    />
                                    <button type="button" onClick={() => toggleShowKey(config.key)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                      {showKeys[config.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  </div>
                                  <Button variant="outline" size="sm">Test</Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Preferences Section */}
          {activeSection === 'preferences' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Default Settings</CardTitle>
                  <CardDescription>
                    Set default values for content generation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Select
                    label="Default AI Model"
                    options={[
                      { value: 'claude-opus-4.5', label: 'Claude Opus 4.5 (Premium - Best)' },
                      { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5 (Balanced)' },
                      { value: 'gpt-5.2-pro', label: 'GPT-5.2 Pro (Enterprise)' },
                      { value: 'gpt-5.2-thinking', label: 'GPT-5.2 Thinking (Reasoning)' },
                      { value: 'gpt-5.2-instant', label: 'GPT-5.2 Instant (Fast)' },
                      { value: 'deepseek-chat-v3.2', label: 'DeepSeek V3.2 (Affordable)' },
                      { value: 'gemini-3-flash', label: 'Gemini 3 Flash (Fast)' },
                    ]}
                    value={settings.defaultModel}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, defaultModel: e.target.value }))
                    }
                  />

                  <Select
                    label="Default Video Model"
                    options={[
                      { value: 'veo3', label: 'Veo 3 (Recommended)' },
                      { value: 'sora', label: 'Sora (OpenAI)' },
                      { value: 'seedream', label: 'Seedream 4.0' },
                      { value: 'nano_b', label: 'Nano-B (Fast & Cheap)' },
                    ]}
                    value={settings.defaultVideoModel}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, defaultVideoModel: e.target.value }))
                    }
                  />

                  <Select
                    label="Default Quality"
                    options={[
                      { value: 'draft', label: 'Draft (Fast)' },
                      { value: 'standard', label: 'Standard' },
                      { value: 'high', label: 'High (Recommended)' },
                      { value: 'premium', label: 'Premium (Slow)' },
                    ]}
                    value={settings.defaultQuality}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, defaultQuality: e.target.value }))
                    }
                  />

                  <Select
                    label="Default Budget"
                    options={[
                      { value: 'low', label: 'Low ($10-50)' },
                      { value: 'medium', label: 'Medium ($50-200)' },
                      { value: 'high', label: 'High ($200-500)' },
                      { value: 'premium', label: 'Premium ($500+)' },
                    ]}
                    value={settings.defaultBudget}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, defaultBudget: e.target.value }))
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Automation</CardTitle>
                  <CardDescription>
                    Configure automated workflows
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Free Providers Toggle */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-gray-900">Use Free Providers</p>
                      <p className="text-sm text-gray-500">
                        Enable Pollinations.ai for free image/video generation (no API key needed)
                      </p>
                    </div>
                    <button
                      onClick={() => setUseFreeProviders(!apiKeys.useFreeProviders)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        apiKeys.useFreeProviders ? 'bg-lamaPurple' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                          apiKeys.useFreeProviders ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                  {/* Pollinations Model Selection (only show when enabled) */}
                  {apiKeys.useFreeProviders && (
                    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-2">Pollinations.ai Settings</p>
                        <p className="text-xs text-gray-500 mb-4">Customize free AI generation models</p>
                      </div>
                      
                      {/* Image Model Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Image Model
                        </label>
                        <select
                          value={apiKeys.pollinationsPreferences?.imageModel || 'flux'}
                          onChange={(e) =>
                            setPollinationsPreferences({
                              imageModel: e.target.value as any,
                            })
                          }
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-lamaPurple focus:outline-none focus:ring-1 focus:ring-lamaPurple"
                        >
                          <option value="flux">Flux (Default - Balanced)</option>
                          <option value="flux-realism">Flux Realism (Photorealistic)</option>
                          <option value="flux-anime">Flux Anime (Anime Style)</option>
                          <option value="flux-3d">Flux 3D (3D Renders)</option>
                          <option value="turbo">Turbo (Fastest)</option>
                        </select>
                      </div>

                      {/* Video Model Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Video Model
                        </label>
                        <select
                          value={apiKeys.pollinationsPreferences?.videoModel || 'mochi'}
                          onChange={(e) =>
                            setPollinationsPreferences({
                              videoModel: e.target.value as any,
                            })
                          }
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-lamaPurple focus:outline-none focus:ring-1 focus:ring-lamaPurple"
                          disabled
                        >
                          <option value="mochi">Mochi (Only Available)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">More video models coming soon</p>
                      </div>

                      {/* Image Enhancement Options */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Auto-Enhance Images</p>
                            <p className="text-xs text-gray-500">Automatically improve image quality</p>
                          </div>
                          <button
                            onClick={() =>
                              setPollinationsPreferences({
                                imageEnhance: !apiKeys.pollinationsPreferences?.imageEnhance,
                              })
                            }
                            className={`relative h-5 w-9 rounded-full transition-colors ${
                              apiKeys.pollinationsPreferences?.imageEnhance
                                ? 'bg-lamaPurple'
                                : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                                apiKeys.pollinationsPreferences?.imageEnhance ? 'translate-x-4' : ''
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Remove Watermark</p>
                            <p className="text-xs text-gray-500">Hide Pollinations.ai logo</p>
                          </div>
                          <button
                            onClick={() =>
                              setPollinationsPreferences({
                                imageNoLogo: !apiKeys.pollinationsPreferences?.imageNoLogo,
                              })
                            }
                            className={`relative h-5 w-9 rounded-full transition-colors ${
                              apiKeys.pollinationsPreferences?.imageNoLogo
                                ? 'bg-lamaPurple'
                                : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                                apiKeys.pollinationsPreferences?.imageNoLogo ? 'translate-x-4' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-gray-900">Auto-approve Content</p>
                      <p className="text-sm text-gray-500">
                        Automatically approve content with high brand alignment scores
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, autoApprove: !prev.autoApprove }))
                      }
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        settings.autoApprove ? 'bg-lamaPurple' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          settings.autoApprove ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Configure how you receive updates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-gray-900">Email Notifications</p>
                      <p className="text-sm text-gray-500">
                        Receive email updates about your campaigns
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          emailNotifications: !prev.emailNotifications,
                        }))
                      }
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        settings.emailNotifications ? 'bg-lamaPurple' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          settings.emailNotifications ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <Input
                    label="Webhook URL"
                    value={settings.webhookUrl}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, webhookUrl: e.target.value }))
                    }
                    placeholder="https://your-server.com/webhook"
                    helperText="Receive real-time notifications via webhook"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Security Section */}
          {activeSection === 'security' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Manage your account security
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">API Access</p>
                        <p className="text-sm text-gray-500">
                          Manage API tokens for external access
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Generate Token
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Session Management</p>
                        <p className="text-sm text-gray-500">
                          View and manage active sessions
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        View Sessions
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-900">Delete All Data</p>
                        <p className="text-sm text-red-700">
                          Permanently delete all your data
                        </p>
                      </div>
                      <Button variant="destructive" size="sm">
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Save Button */}
          <div className="mt-8 flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="bg-lamaPurple hover:bg-lamaPurple/90 text-white">
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
