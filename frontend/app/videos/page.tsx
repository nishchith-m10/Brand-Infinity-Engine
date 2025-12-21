'use client';

import { useState } from 'react';
import {
  Video,
  Play,
  Download,
  RefreshCw,
  Clock,
  DollarSign,
  Star,
  Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { type Video as VideoType, type Scene } from '@/lib/api-client';
import { formatDate, formatCurrency } from '@/lib/utils';

// Mock data - in production this would come from API
const mockVideos: (VideoType & { campaign_name?: string })[] = [
  {
    video_id: 'video_001',
    script_id: 'script_001',
    campaign_name: 'Summer Product Launch',
    status: 'completed',
    model_used: 'veo3',
    scenes_count: 3,
    total_duration_seconds: 30,
    total_cost_usd: 15,
    quality_score: 0.99,
    output_url: '/videos/video_001.mp4',
    created_at: new Date().toISOString(),
  },
  {
    video_id: 'video_002',
    script_id: 'script_002',
    campaign_name: 'Fall Collection',
    status: 'generating',
    model_used: 'sora',
    scenes_count: 4,
    total_duration_seconds: 45,
    total_cost_usd: 25,
    quality_score: 0,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    video_id: 'video_003',
    script_id: 'script_003',
    campaign_name: 'Holiday Special',
    status: 'pending',
    model_used: 'nano_b',
    scenes_count: 2,
    total_duration_seconds: 15,
    total_cost_usd: 5,
    quality_score: 0,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockScenes: Scene[] = [
  {
    id: 'scene_001',
    video_id: 'video_001',
    scene_number: 1,
    prompt: 'Close-up of product revealing with dramatic lighting, cinematic quality',
    duration_seconds: 5,
    model_used: 'veo3',
    cost_usd: 5,
    status: 'completed',
    output_url: '/scenes/scene_001.mp4',
  },
  {
    id: 'scene_002',
    video_id: 'video_001',
    scene_number: 2,
    prompt: 'Product being used in various lifestyle scenarios, dynamic transitions',
    duration_seconds: 15,
    model_used: 'veo3',
    cost_usd: 5,
    status: 'completed',
    output_url: '/scenes/scene_002.mp4',
  },
  {
    id: 'scene_003',
    video_id: 'video_001',
    scene_number: 3,
    prompt: 'Features showcase with kinetic typography, modern design',
    duration_seconds: 10,
    model_used: 'veo3',
    cost_usd: 5,
    status: 'completed',
    output_url: '/scenes/scene_003.mp4',
  },
];

type ExtendedVideo = VideoType & { campaign_name?: string };

export default function VideosPage() {
  const [selectedVideo, setSelectedVideo] = useState<ExtendedVideo | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  // In production, use real API
  const videos = mockVideos;
  const isLoading = false;

  const getModelBadge = (model: string) => {
    const models: Record<string, { color: string; label: string }> = {
      sora: { color: 'bg-purple-100 text-purple-800', label: 'Sora' },
      veo3: { color: 'bg-blue-100 text-blue-800', label: 'Veo 3' },
      seedream: { color: 'bg-green-100 text-green-800', label: 'Seedream' },
      nano_b: { color: 'bg-orange-100 text-orange-800', label: 'Nano-B' },
    };
    const config = models[model] || { color: 'bg-gray-100 text-gray-800', label: model };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getStatusProgress = (status: string) => {
    switch (status) {
      case 'completed':
        return 100;
      case 'generating':
        return 60;
      case 'pending':
        return 10;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Videos</h1>
        <p className="mt-2 text-sm text-gray-600">
          View and manage your generated videos
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <Video className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{videos.length}</p>
                <p className="text-sm text-gray-500">Total Videos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {videos.reduce((acc, v) => acc + v.total_duration_seconds, 0)}s
                </p>
                <p className="text-sm text-gray-500">Total Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-2">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatCurrency(videos.reduce((acc, v) => acc + v.total_cost_usd, 0))}
                </p>
                <p className="text-sm text-gray-500">Total Cost</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-2">
                <Star className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {(videos.filter((v) => v.quality_score > 0).reduce((acc, v) => acc + v.quality_score, 0) / 
                    videos.filter((v) => v.quality_score > 0).length * 100 || 0).toFixed(0)}%
                </p>
                <p className="text-sm text-gray-500">Avg Quality</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Videos Grid */}
      {isLoading ? (
        <Loading fullScreen text="Loading videos..." />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={<Video className="h-8 w-8" />}
          title="No videos yet"
          description="Generate your first video from a script to see it here"
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <Card
              key={video.video_id}
              hover
              onClick={() => {
                setSelectedVideo(video);
                setShowDetailModal(true);
              }}
            >
              {/* Video Thumbnail */}
              <div className="relative aspect-video bg-gray-900">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full bg-white/20 p-4 backdrop-blur-sm">
                    {video.status === 'completed' ? (
                      <Play className="h-8 w-8 text-white" />
                    ) : video.status === 'generating' ? (
                      <RefreshCw className="h-8 w-8 animate-spin text-white" />
                    ) : (
                      <Clock className="h-8 w-8 text-white" />
                    )}
                  </div>
                </div>
                
                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                  {video.total_duration_seconds}s
                </div>
                
                {/* Status badge */}
                <div className="absolute left-2 top-2">
                  <Badge variant="status" status={video.status}>
                    {video.status}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {video.campaign_name || `Video ${video.video_id.slice(-4)}`}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formatDate(video.created_at)}
                    </p>
                  </div>
                  {getModelBadge(video.model_used)}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{video.scenes_count}</p>
                    <p className="text-xs text-gray-500">Scenes</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{formatCurrency(video.total_cost_usd)}</p>
                    <p className="text-xs text-gray-500">Cost</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {video.quality_score > 0 ? `${(video.quality_score * 100).toFixed(0)}%` : '-'}
                    </p>
                    <p className="text-xs text-gray-500">Quality</p>
                  </div>
                </div>

                {/* Progress bar for generating videos */}
                {video.status === 'generating' && (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full animate-pulse rounded-full bg-blue-600"
                        style={{ width: `${getStatusProgress(video.status)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Generating scenes...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Video Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedVideo(null);
          setActiveSceneIndex(0);
        }}
        title={selectedVideo?.campaign_name || 'Video Details'}
        size="xl"
      >
        {selectedVideo && (
          <div className="space-y-6">
            {/* Video Player */}
            <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-900">
              <div className="absolute inset-0 flex items-center justify-center">
                {selectedVideo.status === 'completed' ? (
                  <div className="text-center">
                    <Play className="mx-auto h-16 w-16 text-white/80" />
                    <p className="mt-2 text-sm text-white/60">Video Preview</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <RefreshCw className="mx-auto h-16 w-16 animate-spin text-white/80" />
                    <p className="mt-2 text-sm text-white/60">
                      {selectedVideo.status === 'generating' ? 'Generating...' : 'Pending'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Video Info */}
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <Film className="mx-auto h-5 w-5 text-gray-400" />
                <p className="mt-1 text-lg font-bold">{selectedVideo.scenes_count}</p>
                <p className="text-xs text-gray-500">Scenes</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <Clock className="mx-auto h-5 w-5 text-gray-400" />
                <p className="mt-1 text-lg font-bold">{selectedVideo.total_duration_seconds}s</p>
                <p className="text-xs text-gray-500">Duration</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <DollarSign className="mx-auto h-5 w-5 text-gray-400" />
                <p className="mt-1 text-lg font-bold">{formatCurrency(selectedVideo.total_cost_usd)}</p>
                <p className="text-xs text-gray-500">Cost</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <Star className="mx-auto h-5 w-5 text-gray-400" />
                <p className="mt-1 text-lg font-bold">
                  {selectedVideo.quality_score > 0 ? `${(selectedVideo.quality_score * 100).toFixed(0)}%` : '-'}
                </p>
                <p className="text-xs text-gray-500">Quality</p>
              </div>
            </div>

            {/* Scenes */}
            <div>
              <h4 className="mb-3 font-medium text-gray-900">Scenes</h4>
              <div className="space-y-3">
                {mockScenes.map((scene, index) => (
                  <div
                    key={scene.id}
                    className={`flex items-start gap-4 rounded-lg border p-3 transition-colors ${
                      activeSceneIndex === index
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setActiveSceneIndex(index)}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium">
                      {scene.scene_number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">{scene.prompt}</p>
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                        <span>{scene.duration_seconds}s</span>
                        <span>{getModelBadge(scene.model_used)}</span>
                        <span>{formatCurrency(scene.cost_usd)}</span>
                        <Badge variant="status" status={scene.status} className="ml-auto">
                          {scene.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </Button>
              {selectedVideo.status === 'completed' && (
                <>
                  <Button
                    variant="outline"
                    leftIcon={<Download className="h-4 w-4" />}
                  >
                    Download
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDetailModal(false);
                      window.location.href = '/distribution';
                    }}
                  >
                    Create Variants
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
