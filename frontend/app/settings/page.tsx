'use client';

import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Key,
  Bell,
  Palette,
  Shield,
  Database,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('api-keys');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openai: '',
    anthropic: '',
    elevenlabs: '',
    sora: '',
    veo: '',
    tiktok: '',
    instagram: '',
    youtube: '',
  });

  // Settings state
  const [settings, setSettings] = useState({
    defaultModel: 'gpt-4o-mini',
    defaultVideoModel: 'veo3',
    defaultQuality: 'high',
    defaultBudget: 'medium',
    autoApprove: false,
    emailNotifications: true,
    webhookUrl: '',
    brandName: 'My Brand',
    brandVoice: 'Professional, friendly, innovative',
    brandColors: '#3B82F6',
    targetAudience: 'Gen Z and Millennials',
  });

  const apiKeyConfigs: { key: keyof typeof apiKeys; name: string; description: string; category: string }[] = [
    { key: 'openai', name: 'OpenAI', description: 'For GPT models and script generation', category: 'AI' },
    { key: 'anthropic', name: 'Anthropic', description: 'For Claude models', category: 'AI' },
    { key: 'elevenlabs', name: 'ElevenLabs', description: 'For voice synthesis', category: 'AI' },
    { key: 'sora', name: 'OpenAI Sora', description: 'For video generation', category: 'Video' },
    { key: 'veo', name: 'Google Veo', description: 'For video generation', category: 'Video' },
    { key: 'tiktok', name: 'TikTok', description: 'For publishing to TikTok', category: 'Social' },
    { key: 'instagram', name: 'Instagram/Meta', description: 'For publishing to Instagram & Facebook', category: 'Social' },
    { key: 'youtube', name: 'YouTube', description: 'For publishing to YouTube', category: 'Social' },
  ];

  const getKeyStatus = (key: string): 'connected' | 'error' | 'not_configured' => {
    if (!apiKeys[key]) return 'not_configured';
    if (apiKeys[key].length > 10) return 'connected';
    return 'error';
  };

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const sections = [
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'brand', label: 'Brand Settings', icon: Palette },
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
          Configure your Brand Infinity Engine preferences
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-50 text-blue-700'
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
                    Connect your API keys to enable AI generation and social media publishing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {['AI', 'Video', 'Social'].map((category) => (
                    <div key={category}>
                      <h3 className="mb-4 text-sm font-medium text-gray-500">{category} APIs</h3>
                      <div className="space-y-4">
                        {apiKeyConfigs
                          .filter((config) => config.category === category)
                          .map((config) => {
                            const status = getKeyStatus(config.key);
                            return (
                              <div
                                key={config.key}
                                className="flex items-start gap-4 rounded-lg border border-gray-200 p-4"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">
                                      {config.name}
                                    </span>
                                    <Badge
                                      variant="status"
                                      status={
                                        status === 'connected'
                                          ? 'approved'
                                          : status === 'error'
                                          ? 'rejected'
                                          : 'pending'
                                      }
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
                                        value={apiKeys[config.key]}
                                        onChange={(e) =>
                                          setApiKeys((prev) => ({
                                            ...prev,
                                            [config.key]: e.target.value,
                                          }))
                                        }
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
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Brand Settings Section */}
          {activeSection === 'brand' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Brand Identity</CardTitle>
                  <CardDescription>
                    Configure your brand settings for consistent content generation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Input
                    label="Brand Name"
                    value={settings.brandName}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, brandName: e.target.value }))
                    }
                    placeholder="Your brand name"
                  />

                  <Textarea
                    label="Brand Voice"
                    value={settings.brandVoice}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, brandVoice: e.target.value }))
                    }
                    placeholder="Describe your brand voice and tone..."
                    helperText="This helps AI generate content that matches your brand personality"
                  />

                  <Input
                    label="Target Audience"
                    value={settings.targetAudience}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, targetAudience: e.target.value }))
                    }
                    placeholder="e.g., Gen Z, millennials, professionals"
                  />

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Brand Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={settings.brandColors}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, brandColors: e.target.value }))
                        }
                        className="h-10 w-20 cursor-pointer rounded border border-gray-300"
                      />
                      <Input
                        value={settings.brandColors}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, brandColors: e.target.value }))
                        }
                        placeholder="#3B82F6"
                        className="w-32"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Brand Guidelines</CardTitle>
                  <CardDescription>
                    Upload or configure your brand guidelines for RAG-powered content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                    <Database className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm font-medium text-gray-900">
                      Upload Brand Guidelines
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      PDF, DOCX, or TXT files up to 10MB
                    </p>
                    <Button variant="outline" className="mt-4">
                      Choose Files
                    </Button>
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
                      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Affordable)' },
                      { value: 'gpt-4o', label: 'GPT-4o (High Quality)' },
                      { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
                      { value: 'claude-3-opus', label: 'Claude 3 Opus (Premium)' },
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
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
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
                        settings.autoApprove ? 'bg-blue-600' : 'bg-gray-200'
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
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
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
                        settings.emailNotifications ? 'bg-blue-600' : 'bg-gray-200'
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
                  <div className="rounded-lg border border-gray-200 p-4">
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

                  <div className="rounded-lg border border-gray-200 p-4">
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
                      <Button variant="danger" size="sm">
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
            <Button onClick={handleSave} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
