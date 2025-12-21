'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Share2,
  Check,
  ChevronRight,
  Monitor,
  Smartphone,
  Square,
  Video,
  Download,
  Eye,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { variantsApi, type Variant } from '@/lib/api-client';
import { formatDate, getPlatformColor } from '@/lib/utils';

// Available platforms configuration
const PLATFORMS = [
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    aspectRatio: '9:16',
    maxDuration: 180,
    description: 'Vertical short-form video',
  },
  {
    id: 'instagram_reels',
    name: 'Instagram Reels',
    icon: '📸',
    aspectRatio: '9:16',
    maxDuration: 90,
    description: 'Vertical video up to 90s',
  },
  {
    id: 'instagram_feed',
    name: 'Instagram Feed',
    icon: '📷',
    aspectRatio: '1:1',
    maxDuration: 60,
    description: 'Square video for feed',
  },
  {
    id: 'youtube_shorts',
    name: 'YouTube Shorts',
    icon: '📺',
    aspectRatio: '9:16',
    maxDuration: 60,
    description: 'Vertical video up to 60s',
  },
  {
    id: 'youtube_feed',
    name: 'YouTube',
    icon: '▶️',
    aspectRatio: '16:9',
    maxDuration: 600,
    description: 'Horizontal long-form video',
  },
  {
    id: 'facebook_feed',
    name: 'Facebook',
    icon: '👤',
    aspectRatio: '16:9',
    maxDuration: 240,
    description: 'Feed video any aspect',
  },
  {
    id: 'linkedin_feed',
    name: 'LinkedIn',
    icon: '💼',
    aspectRatio: '16:9',
    maxDuration: 600,
    description: 'Professional video content',
  },
  {
    id: 'twitter_feed',
    name: 'X (Twitter)',
    icon: '🐦',
    aspectRatio: '16:9',
    maxDuration: 140,
    description: 'Short video for timeline',
  },
];

// Mock data
const mockVideos = [
  {
    video_id: 'video_001',
    name: 'Summer Product Launch',
    duration_seconds: 30,
    created_at: new Date().toISOString(),
  },
];

const mockVariants: Variant[] = [
  {
    variant_id: 'var_001',
    video_id: 'video_001',
    platform: 'tiktok',
    aspect_ratio: '9:16',
    duration_seconds: 30,
    caption: 'The future is here 🚀 #tech #innovation #lifestyle',
    hashtags: ['tech', 'innovation', 'lifestyle', 'gadgets'],
    status: 'ready',
    created_at: new Date().toISOString(),
  },
  {
    variant_id: 'var_002',
    video_id: 'video_001',
    platform: 'instagram_reels',
    aspect_ratio: '9:16',
    duration_seconds: 30,
    caption: 'Game changer alert! 🎯 Link in bio',
    hashtags: ['instagood', 'tech', 'reels', 'trending'],
    status: 'ready',
    created_at: new Date().toISOString(),
  },
  {
    variant_id: 'var_003',
    video_id: 'video_001',
    platform: 'youtube_shorts',
    aspect_ratio: '9:16',
    duration_seconds: 30,
    caption: 'You NEED to see this! #shorts',
    hashtags: ['shorts', 'tech', 'gadgets'],
    status: 'ready',
    created_at: new Date().toISOString(),
  },
  {
    variant_id: 'var_004',
    video_id: 'video_001',
    platform: 'instagram_feed',
    aspect_ratio: '1:1',
    duration_seconds: 30,
    caption: 'Innovation meets design. Tap to explore.',
    hashtags: ['design', 'innovation', 'style'],
    status: 'pending',
    created_at: new Date().toISOString(),
  },
];

export default function DistributionPage() {
  const [selectedVideo] = useState<string | null>(mockVideos[0]?.video_id);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showVariantDetail, setShowVariantDetail] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [customCaption, setCustomCaption] = useState('');

  // Get variants for selected video
  const variants = mockVariants.filter((v) => v.video_id === selectedVideo);

  // Generate variants mutation
  const generateMutation = useMutation({
    mutationFn: async (data: { videoId: string; platforms: string[] }) => {
      const response = await variantsApi.generateVariants(data.videoId, {
        platforms: data.platforms,
        includeCaption: true,
        includeBranding: true,
      });
      return response.data;
    },
    onSuccess: () => {
      setShowGenerateModal(false);
      setSelectedPlatforms([]);
    },
  });

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const getAspectRatioIcon = (ratio: string) => {
    switch (ratio) {
      case '9:16':
        return <Smartphone className="h-4 w-4" />;
      case '16:9':
        return <Monitor className="h-4 w-4" />;
      case '1:1':
        return <Square className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getPlatformConfig = (platformId: string) => {
    return PLATFORMS.find((p) => p.id === platformId);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Distribution</h1>
          <p className="mt-2 text-sm text-gray-600">
            Create platform-specific variants of your videos
          </p>
        </div>
        <Button
          onClick={() => setShowGenerateModal(true)}
          leftIcon={<Sparkles className="h-4 w-4" />}
          disabled={!selectedVideo}
        >
          Generate Variants
        </Button>
      </div>

      {/* Source Video Selection */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Source Video</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="aspect-video w-48 rounded-lg bg-gray-900">
              <div className="flex h-full items-center justify-center">
                <Video className="h-8 w-8 text-white/60" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">
                {mockVideos.find((v) => v.video_id === selectedVideo)?.name}
              </h3>
              <p className="text-sm text-gray-500">
                {mockVideos.find((v) => v.video_id === selectedVideo)?.duration_seconds}s • 
                Created {formatDate(mockVideos.find((v) => v.video_id === selectedVideo)?.created_at || '')}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="status" status="completed">Ready</Badge>
                <span className="text-xs text-gray-400">
                  {variants.length} variants created
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variants Grid */}
      {variants.length === 0 ? (
        <EmptyState
          icon={<Share2 className="h-8 w-8" />}
          title="No variants yet"
          description="Generate platform-specific variants to distribute your content"
          action={{
            label: 'Generate Variants',
            onClick: () => setShowGenerateModal(true),
          }}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {variants.map((variant) => {
            const platform = getPlatformConfig(variant.platform);
            return (
              <Card
                key={variant.variant_id}
                hover
                onClick={() => {
                  setSelectedVariant(variant);
                  setCustomCaption(variant.caption);
                  setShowVariantDetail(true);
                }}
              >
                {/* Preview */}
                <div
                  className={`relative ${
                    variant.aspect_ratio === '9:16'
                      ? 'aspect-[9/16]'
                      : variant.aspect_ratio === '1:1'
                      ? 'aspect-square'
                      : 'aspect-video'
                  } bg-gray-900`}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Video className="h-8 w-8 text-white/40" />
                  </div>
                  
                  {/* Platform badge */}
                  <div className="absolute left-2 top-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getPlatformColor(variant.platform)}`}>
                      {platform?.icon} {platform?.name}
                    </span>
                  </div>
                  
                  {/* Duration */}
                  <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                    {variant.duration_seconds}s
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {getAspectRatioIcon(variant.aspect_ratio)}
                      <span>{variant.aspect_ratio}</span>
                    </div>
                    <Badge variant="status" status={variant.status}>
                      {variant.status}
                    </Badge>
                  </div>
                  
                  <p className="line-clamp-2 text-sm text-gray-600">
                    {variant.caption}
                  </p>
                  
                  {variant.hashtags && variant.hashtags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {variant.hashtags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs text-blue-600">
                          #{tag}
                        </span>
                      ))}
                      {variant.hashtags.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{variant.hashtags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Generate Variants Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => {
          setShowGenerateModal(false);
          setSelectedPlatforms([]);
        }}
        title="Generate Platform Variants"
        description="Select platforms to create optimized variants for"
        size="lg"
      >
        <div className="space-y-4">
          {/* Platform Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {PLATFORMS.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform.id);
              const alreadyExists = variants.some((v) => v.platform === platform.id);
              
              return (
                <button
                  key={platform.id}
                  onClick={() => !alreadyExists && togglePlatform(platform.id)}
                  disabled={alreadyExists}
                  className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : alreadyExists
                      ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl">
                    {platform.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{platform.name}</span>
                      {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                      {alreadyExists && (
                        <Badge variant="status" status="completed" className="text-xs">
                          Created
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{platform.description}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        {getAspectRatioIcon(platform.aspectRatio)}
                        {platform.aspectRatio}
                      </span>
                      <span>Max {platform.maxDuration}s</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Summary */}
          {selectedPlatforms.length > 0 && (
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>{selectedPlatforms.length}</strong> platform{selectedPlatforms.length > 1 ? 's' : ''} selected
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedPlatforms.map((id) => {
                  const platform = getPlatformConfig(id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs"
                    >
                      {platform?.icon} {platform?.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedVideo &&
                generateMutation.mutate({
                  videoId: selectedVideo,
                  platforms: selectedPlatforms,
                })
              }
              disabled={selectedPlatforms.length === 0}
              isLoading={generateMutation.isPending}
            >
              Generate {selectedPlatforms.length > 0 && `(${selectedPlatforms.length})`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Variant Detail Modal */}
      <Modal
        isOpen={showVariantDetail}
        onClose={() => {
          setShowVariantDetail(false);
          setSelectedVariant(null);
        }}
        title="Variant Details"
        size="lg"
      >
        {selectedVariant && (
          <div className="space-y-6">
            {/* Preview */}
            <div className="flex gap-6">
              <div
                className={`relative flex-shrink-0 ${
                  selectedVariant.aspect_ratio === '9:16'
                    ? 'aspect-[9/16] w-40'
                    : selectedVariant.aspect_ratio === '1:1'
                    ? 'aspect-square w-40'
                    : 'aspect-video w-64'
                } overflow-hidden rounded-lg bg-gray-900`}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Video className="h-10 w-10 text-white/40" />
                </div>
              </div>
              
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium ${getPlatformColor(selectedVariant.platform)}`}>
                    {getPlatformConfig(selectedVariant.platform)?.icon}{' '}
                    {getPlatformConfig(selectedVariant.platform)?.name}
                  </span>
                  <Badge variant="status" status={selectedVariant.status}>
                    {selectedVariant.status}
                  </Badge>
                </div>
                
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Aspect Ratio</dt>
                    <dd className="text-gray-900">{selectedVariant.aspect_ratio}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Duration</dt>
                    <dd className="text-gray-900">{selectedVariant.duration_seconds}s</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Created</dt>
                    <dd className="text-gray-900">{formatDate(selectedVariant.created_at)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Caption Editor */}
            <div>
              <Textarea
                label="Caption"
                value={customCaption}
                onChange={(e) => setCustomCaption(e.target.value)}
                rows={3}
              />
              {selectedVariant.hashtags && selectedVariant.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedVariant.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" leftIcon={<Eye className="h-4 w-4" />}>
                Preview
              </Button>
              <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
                Download
              </Button>
              <Button
                onClick={() => {
                  setShowVariantDetail(false);
                  window.location.href = '/publishing';
                }}
                leftIcon={<ChevronRight className="h-4 w-4" />}
              >
                Schedule Post
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
