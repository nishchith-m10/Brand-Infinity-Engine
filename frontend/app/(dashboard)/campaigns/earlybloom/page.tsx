'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Play, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SceneEditor } from '@/components/ui/scene-editor';

// EarlyBloom Investor Teaser Template
const EARLYBLOOM_TEMPLATE = {
  campaignId: 'earlybloom_investor_teaser',
  name: 'EarlyBloom Studio - 15s Investor Teaser',
  totalDuration: 15,
  scenes: [
    {
      id: 'scene_1',
      sequence: 1,
      duration_seconds: 2.8,
      visual_prompt: 'Cinematic Dolly-in. Start focal point: Full Login Page. End focal point: "Sign In" button at 1.2x scale. High-tech modern interface with smooth depth of field transition.',
      voiceover_text: 'EarlyBloom Studio transforms how educators create content.',
      camera_movement: 'Dolly-in with focal point shift',
      text_overlay: 'AI-Powered Earlybloom Studio',
      asset_id: 'cms_00_Earlybloom_Studio_login.png',
    },
    {
      id: 'scene_2',
      sequence: 2,
      duration_seconds: 2.1,
      visual_prompt: '2.1-second linear horizontal pan. Start: Left sidebar. End: "Review Content" card on far right. Smooth tracking shot maintaining focus.',
      voiceover_text: 'AI generates complete lessons in minutes.',
      camera_movement: 'Linear horizontal pan left to right',
      text_overlay: 'Lessons in Minutes',
      asset_id: 'cms_02_dashboard.png.png',
    },
    {
      id: 'scene_3',
      sequence: 3,
      duration_seconds: 2.85,
      visual_prompt: 'Snap-zoom out from the "Activity Type" dropdown to full interface view. 0.2s high-speed light-leak wipe transition to storybook generator. Kinetic typography with pulse effect.',
      voiceover_text: 'Convert anything into interactive learning.',
      camera_movement: 'Snap-zoom out with light-leak transition',
      text_overlay: 'Convert Anything',
      asset_id: 'cms_04_create_activity_AI_generator.png',
    },
    {
      id: 'scene_4',
      sequence: 4,
      duration_seconds: 2.15,
      visual_prompt: '2nd-stage camera slide. Slow vertical scroll down to reveal "Theme Lens" and "Learning Objectives." Subtle 15% opacity digital scan-line overlay for high-tech feel.',
      voiceover_text: 'Instant preview.',
      camera_movement: 'Vertical slide with scan-line overlay',
      text_overlay: 'Instant Preview',
      asset_id: 'cms_21_create_AI_generator_storybook.png',
    },
    {
      id: 'scene_5',
      sequence: 5,
      duration_seconds: 2.85,
      visual_prompt: 'Subtle 5-degree orbital camera rotation around the central "Image Preview" box. Clean composition with right-aligned text overlay.',
      voiceover_text: 'Data-driven insights for personalized learning.',
      camera_movement: '5-degree orbital rotation',
      text_overlay: 'Data-Driven Learning',
      asset_id: 'cms_09_preview..png',
    },
    {
      id: 'scene_6',
      sequence: 6,
      duration_seconds: 1.15,
      visual_prompt: 'Targeted zoom-in on the "AI Activity Generator" progress bar and "AI Service Limits" cards. Floating glass-morphism panel overlay.',
      voiceover_text: 'EarlyBloom Studio...',
      camera_movement: 'Targeted zoom-in on analytics',
      text_overlay: 'Data-Driven Learning',
      asset_id: 'cms_16_activity_analytics.png',
    },
    {
      id: 'scene_7',
      sequence: 7,
      duration_seconds: 1.0,
      visual_prompt: 'Full-frame fade to #1E3A8A to #7C3AED linear gradient. "EarlyBloom CMS" logo center-aligned, scaling from 0.9x to 1.1x with elegant animation.',
      voiceover_text: '...built for the future of education.',
      camera_movement: 'Logo scale animation with gradient fade',
      text_overlay: 'EarlyBloom CMS',
      asset_id: undefined,
    },
  ],
};

interface SceneSpec {
  id: string;
  sequence: number;
  duration_seconds: number;
  visual_prompt: string;
  voiceover_text: string;
  asset_id?: string;
  camera_movement?: string;
  text_overlay?: string;
}

export default function EarlyBloomCampaign() {
  const [scenes, setScenes] = useState<SceneSpec[]>(EARLYBLOOM_TEMPLATE.scenes);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');

  // Generate video mutation
  const generateVideoMutation = useMutation({
    mutationFn: async () => {
      // In production, this would call the actual video generation API
      // For now, simulate the process
      setGenerationStatus('generating');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setGenerationStatus('completed');
      return { video_id: 'video_earlybloom_001', status: 'completed' };
    },
  });

  const handleGenerate = () => {
    generateVideoMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {EARLYBLOOM_TEMPLATE.name}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              High-impact 15-second investor teaser with 7 precision-timed scenes
            </p>
          </div>
          <Button onClick={handleGenerate} size="lg" disabled={generationStatus === 'generating'}>
            {generationStatus === 'generating' ? (
              <>
                <Zap className="mr-2 h-5 w-5 animate-pulse" />
                Generating...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Generate Video
              </>
            )}
          </Button>
        </div>

        {/* Campaign Info */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Duration</p>
                <div className="mt-1 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-lamaSky" />
                  <p className="text-2xl font-semibold text-gray-900">
                    {EARLYBLOOM_TEMPLATE.totalDuration}s
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Scenes</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {scenes.length}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Video Model</p>
                <Badge variant="default" className="mt-1">
                  Veo 3
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generation Status */}
        {generationStatus !== 'idle' && (
          <Card className={`
            ${generationStatus === 'generating' ? 'border-lamaSky bg-lamaSkyLight' : ''}
            ${generationStatus === 'completed' ? 'border-green-500 bg-green-50' : ''}
            ${generationStatus === 'error' ? 'border-red-500 bg-red-50' : ''}
          `}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                {generationStatus === 'generating' && (
                  <>
                    <Zap className="h-6 w-6 animate-pulse text-lamaSky" />
                    <div>
                      <p className="font-medium text-slate-800">Generating Video...</p>
                      <p className="text-sm text-lamaSky">
                        Processing {scenes.length} scenes with Veo 3 model
                      </p>
                    </div>
                  </>
                )}
                {generationStatus === 'completed' && (
                  <>
                    <Play className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">Video Generated Successfully!</p>
                      <p className="text-sm text-green-700">
                        Ready for review and distribution
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scene Editor */}
        <SceneEditor
          campaignId={EARLYBLOOM_TEMPLATE.campaignId}
          scenes={scenes}
          onScenesChange={setScenes}
        />

        {/* Technical Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Technical Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Motion Blur:</strong> Set to 0.1 to maintain UI text crispness during fast pans</p>
              <p><strong>Interpolation:</strong> Linear motion paths only (no smooth easing that causes blurring)</p>
              <p><strong>Audio:</strong> High-energy syncopated tech-house beat with kick drum hits at scene transitions</p>
              <p><strong>Subtitles:</strong> Burn-in bold sans-serif subtitles at bottom-center (Y-offset: 85%)</p>
              <p><strong>Export:</strong> MP4, 1080p, 16:9 aspect ratio, 60fps</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
