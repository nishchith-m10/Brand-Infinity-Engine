'use client';

/**
 * Request Form Component
 * 
 * Exact recreation of the pipeline UI mockup form.
 * Matches pipeline_ui_react_skeleton.html styling and functionality.
 */

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ProviderSelector } from '@/components/director/provider-selector';
import { ChatContextSelector } from '@/components/director/ChatContextSelector';
import { Button } from '@/components/ui/button';

interface RequestFormProps {
  onSubmit: () => void;
}

const PROVIDERS = {
  'video-with-vo': ['Pollo', 'Sora 2', 'Runway', 'Veo 3', 'Pika'],
  'video-no-vo': ['Pollo', 'Sora 2', 'Runway', 'Veo 3', 'Pika'],
  image: ['NanoBanna Pro', 'Stable Diffusion'],
};

const VOICE_OPTIONS = ['ElevenLabs - Calm', 'ElevenLabs - Energetic', 'ElevenLabs - Professional'];
const ASPECT_RATIOS = ['16:9 (Landscape)', '9:16 (Portrait)', '1:1 (Square)', '4:5 (Social)'];
const STYLES = ['Realistic', 'Animated', 'Cinematic', '3D', 'Sketch'];
const SHOT_TYPES = ['Close-up', 'Wide', 'Medium', 'POV', 'Aerial'];

export default function RequestForm({ onSubmit }: RequestFormProps) {
  const [title, setTitle] = useState('Launch product reel');
  const [campaign, setCampaign] = useState('campaign_1');
  const [type, setType] = useState<'video-with-vo' | 'video-no-vo' | 'image'>('video-with-vo');
  const [duration, setDuration] = useState(30);
  const [provider, setProvider] = useState('');
  const [autoScript, setAutoScript] = useState(true);
  const [scriptText, setScriptText] = useState('');
  const [prompt, setPrompt] = useState('30s product demo, upbeat, Gen Z tone, show logo at the end...');
  const [budget, setBudget] = useState('');
  const [estimate, setEstimate] = useState<{cost: string; time: number; error?: string} | null>(null);
  const [voice, setVoice] = useState('ElevenLabs - Calm');
  const [aspectRatio, setAspectRatio] = useState('16:9 (Landscape)');
  const [style, setStyle] = useState('Realistic');
  const [shotType, setShotType] = useState('Medium');
  const [selectedModel, setSelectedModel] = useState('openai:gpt-4o-mini');
  const [estimating, setEstimating] = useState(false);
  
  // Accordion state
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    creative: false,
    script: false,
    ai: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleEstimate = async () => {
    if (!provider) {
      setEstimate({ cost: '0.00', time: 0, error: 'Please select a provider' });
      return;
    }

    setEstimating(true);
    try {
      const response = await fetch('/api/v1/requests/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: type.replace('-', '_'),
          duration: type === 'image' ? undefined : duration,
          provider,
          tier: 'standard',
          hasVoiceover: type === 'video-with-vo',
          autoScript,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setEstimate({
          cost: result.data.estimated_cost.toFixed(2),
          time: Math.ceil(result.data.estimated_time_seconds / 60),
        });
      } else {
        setEstimate({ cost: '0.00', time: 0, error: 'Failed to get estimate' });
      }
    } catch (error) {
      setEstimate({ cost: '0.00', time: 0, error: 'Failed to get estimate' });
    } finally {
      setEstimating(false);
    }
  };

  const handleSubmit = async () => {
    if (!provider) {
      alert('Please select a provider');
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert('Please sign in to create requests');
      return;
    }

    // Get user's first brand (or use from context/selector in future)
    const { data: brands } = await supabase
      .from('brands')
      .select('id')
      .limit(1)
      .single();

    if (!brands) {
      alert('No brand found. Please create a brand first.');
      return;
    }

    // Create request via API
    const response = await fetch('/api/v1/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_id: brands.id,
        campaign_id: campaign !== 'campaign_1' ? campaign : undefined,
        title: title || 'Untitled Request',
        type: type.replace('-', '_'),
        requirements: {
          prompt,
          duration: type === 'image' ? undefined : duration,
          aspect_ratio: aspectRatio.split(' ')[0],
          style_preset: style,
          shot_type: shotType,
          voice_id: type === 'video-with-vo' ? voice : undefined,
        },
        settings: {
          provider,
          tier: 'standard',
          auto_script: autoScript,
          script_text: !autoScript ? scriptText : undefined,
          selected_kb_ids: [],
        },
      }),
    });

    if (response.ok) {
      setEstimate(null);
      onSubmit();
    } else {
      const error = await response.json();
      alert(`Failed to create request: ${error.error || 'Unknown error'}`);
    }
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900">Create Request</h2>
        <p className="text-xs text-gray-500">New creative asset</p>
      </div>

      {/* Scrollable Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {/* Basic Info Section */}
        <div>
          <button
            type="button"
            onClick={() => toggleSection('basic')}
            className="w-full flex items-center justify-between py-1.5 text-left"
          >
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Basic Info</span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${expandedSections.basic ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.basic && (
            <div className="space-y-2 mt-1.5">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Launch product reel"
                  className="w-full h-8 px-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
                />
              </div>

              {/* Campaign & Content Type */}
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Campaign</label>
                  <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className="w-full h-8 px-2.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring focus:ring-indigo-100">
                    <option value="campaign_1">Campaign 1</option>
                    <option value="campaign_2">Campaign 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Content Type</label>
                  <select value={type} onChange={(e) => { setType(e.target.value as any); setProvider(''); }} className="w-full h-8 px-2.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring focus:ring-indigo-100">
                    <option value="video-with-vo">Video with Voiceover</option>
                    <option value="video-no-vo">Video without Voiceover</option>
                    <option value="image">Image</option>
                  </select>
                </div>
              </div>

              {/* Provider */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Provider</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full h-8 px-2.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring focus:ring-indigo-100">
                  <option value="">Select provider...</option>
                  {PROVIDERS[type]?.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Creative Settings Section */}
        <div className="border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => toggleSection('creative')}
            className="w-full flex items-center justify-between py-1.5 text-left"
          >
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Creative Settings</span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${expandedSections.creative ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.creative && (
            <div className="space-y-3 mt-2">
              {/* Duration & Aspect Ratio */}
              <div className="grid grid-cols-2 gap-1.5">
                {type !== 'image' && (
                  <div>
                    <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Duration (s)</label>
                    <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full h-8 px-2.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring focus:ring-indigo-100" />
                  </div>
                )}
                <div className={type === 'image' ? 'col-span-2' : ''}>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Aspect Ratio</label>
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full h-8 px-2.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring focus:ring-indigo-100">
                    {ASPECT_RATIOS.map(ar => <option key={ar} value={ar}>{ar}</option>)}
                  </select>
                </div>
              </div>

              {/* Style & Shot Type */}
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Style</label>
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full h-8 px-2.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring focus:ring-indigo-100">
                    {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Shot Type</label>
                  <select value={shotType} onChange={(e) => setShotType(e.target.value)} className="w-full h-8 px-2.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring focus:ring-indigo-100">
                    {SHOT_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>

              {/* Voice */}
              {type === 'video-with-vo' && (
                <div>
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Voice</label>
                  <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full h-8 px-2.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring focus:ring-indigo-100">
                    {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Script & Context Section */}
        <div className="border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => toggleSection('script')}
            className="w-full flex items-center justify-between py-1.5 text-left"
          >
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Script & Context</span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${expandedSections.script ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.script && (
            <div className="space-y-3 mt-2">
              {/* Auto-generate script */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={autoScript} onChange={(e) => setAutoScript(e.target.checked)} className="accent-indigo-600" />
                  <label className="text-xs text-gray-900 font-medium">Auto-generate script</label>
                </div>
                {!autoScript && (
                  <textarea
                    rows={3}
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder="Paste your custom script here..."
                    className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring focus:ring-indigo-100"
                  />
                )}
              </div>

              {/* Context Selector */}
              <div>
                <ChatContextSelector />
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Prompt (Creative Brief)</label>
                <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring focus:ring-indigo-100" />
              </div>
            </div>
          )}
        </div>

        {/* AI & Budget Section */}
        <div className="border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => toggleSection('ai')}
            className="w-full flex items-center justify-between py-1.5 text-left"
          >
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">AI & Budget</span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${expandedSections.ai ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.ai && (
            <div className="space-y-3 mt-2">
              {/* LLM Model Selector */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">AI Model</label>
                <ProviderSelector value={selectedModel} onChange={setSelectedModel} />
              </div>

              {/* Budget */}
              <div>
                <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Budget Cap (USD)</label>
                <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g., 5.00" className="w-full h-8 px-2.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:border-indigo-600 focus:ring focus:ring-indigo-100" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Footer with Actions */}
      <div className="border-t border-gray-200 p-6 bg-white">
        <div className="flex gap-1.5 mb-3">
          <Button
            onClick={handleEstimate}
            disabled={estimating}
            variant="outline"
            className="flex-1 h-9 px-3 text-xs font-semibold"
          >
            {estimating ? 'Calculating...' : 'Estimate'}
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="default"
            className="flex-1 h-9 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <span>+</span> Create & Queue
          </Button>
        </div>

        {/* Estimate Display */}
        {estimate && (
          <div className={`p-2.5 rounded-lg text-xs ${estimate.error ? 'bg-red-50 border border-red-200 text-red-900' : 'bg-yellow-50 border border-yellow-200 text-yellow-900'}`}>
            {estimate.error ? (
              <strong>{estimate.error}</strong>
            ) : (
              <span><strong>Estimate:</strong> ${estimate.cost} · ~{estimate.time} min</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
