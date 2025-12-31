/**
 * Video Generation Service
 * Unified interface for multiple video generation providers
 */

import { PolloAdapter, getPolloAdapter, PolloVideoRequest, POLLO_MODELS, type PolloModel } from './adapters/pollo-adapter';

export type VideoProvider = 'pollo' | 'runway' | 'pika' | 'kling' | 'sora';

export interface VideoGenerationRequest {
  prompt: string;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  provider?: VideoProvider;
  model?: string;
  imageUrl?: string; // For image-to-video
}

export interface VideoGenerationJob {
  jobId: string;
  provider: VideoProvider;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  estimatedCost: number;
  createdAt: string;
}

export class VideoService {
  private polloAdapter: PolloAdapter;

  constructor() {
    this.polloAdapter = getPolloAdapter();
  }

  /**
   * Generate video using specified provider
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationJob> {
    const provider = request.provider || 'pollo'; // Default to Pollo for cost savings

    switch (provider) {
      case 'pollo':
        return this.generateWithPollo(request);
      case 'runway':
        return this.generateWithRunway(request);
      case 'pika':
      case 'kling':
      case 'sora':
        // These can be accessed via Pollo or direct APIs
        // For now, route through Pollo
        return this.generateWithPollo({
          ...request,
          model: this.mapProviderToPolloModel(provider),
        });
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Generate video via Pollo AI
   */
  private async generateWithPollo(request: VideoGenerationRequest): Promise<VideoGenerationJob> {
    if (!this.polloAdapter.isConfigured()) {
      throw new Error('Pollo API key not configured. Set POLLO_API_KEY env var.');
    }

    const polloRequest: PolloVideoRequest = {
      text_prompt: request.prompt,
      model: request.model || 'kling-v1-6',
      duration: (request.duration || 5) >= 10 ? 10 : 5,
      aspect_ratio: request.aspectRatio || '16:9',
      image_url: request.imageUrl,
    };

    const response = await this.polloAdapter.createTask(polloRequest);

    return {
      jobId: response.task_id,
      provider: 'pollo',
      status: 'pending',
      estimatedCost: this.polloAdapter.estimateCost(
        (polloRequest.model || 'kling-v1-6') as PolloModel,
        request.duration || 5
      ),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate video via Runway API (placeholder)
   */
  private async generateWithRunway(request: VideoGenerationRequest): Promise<VideoGenerationJob> {
    // TODO: Implement direct Runway API integration
    // For now, route through Pollo if Pollo is configured
    if (this.polloAdapter.isConfigured()) {
      console.log('[VideoService] Routing Runway request through Pollo');
      return this.generateWithPollo(request);
    }

    throw new Error('Direct Runway API not yet implemented. Configure POLLO_API_KEY for video generation.');
  }

  /**
   * Check status of a video generation job
   */
  async checkJobStatus(jobId: string, provider: VideoProvider): Promise<VideoGenerationJob> {
    if (provider === 'pollo') {
      const status = await this.polloAdapter.getTaskStatus(jobId);
      return {
        jobId: status.task_id,
        provider: 'pollo',
        status: status.status === 'succeed' ? 'completed' : status.status,
        videoUrl: status.video_url,
        error: status.error_message,
        estimatedCost: 0,
        createdAt: new Date().toISOString(),
      };
    }

    throw new Error(`Status check not implemented for provider: ${provider}`);
  }

  /**
   * Map provider name to Pollo model ID
   */
  private mapProviderToPolloModel(provider: VideoProvider): string {
    const mapping: Record<VideoProvider, string> = {
      pollo: 'pollo-v2-0',
      runway: 'pollo-v2-0', // Use Pollo's native model as proxy
      pika: 'pika',
      kling: 'kling-v1-6',
      sora: 'pollo-v2-0', // Sora not directly available, use Pollo's best
    };
    return mapping[provider] || 'kling-v1-6';
  }

  /**
   * Get available providers with their status
   */
  getAvailableProviders(): { provider: VideoProvider; available: boolean; reason?: string }[] {
    return [
      {
        provider: 'pollo',
        available: this.polloAdapter.isConfigured(),
        reason: this.polloAdapter.isConfigured() ? undefined : 'POLLO_API_KEY not set',
      },
      {
        provider: 'runway',
        available: !!process.env.RUNWAY_API_KEY || this.polloAdapter.isConfigured(),
        reason: !process.env.RUNWAY_API_KEY && !this.polloAdapter.isConfigured() 
          ? 'RUNWAY_API_KEY or POLLO_API_KEY not set' 
          : undefined,
      },
      {
        provider: 'pika',
        available: this.polloAdapter.isConfigured(),
        reason: this.polloAdapter.isConfigured() ? undefined : 'POLLO_API_KEY not set',
      },
      {
        provider: 'kling',
        available: this.polloAdapter.isConfigured(),
        reason: this.polloAdapter.isConfigured() ? undefined : 'POLLO_API_KEY not set',
      },
      {
        provider: 'sora',
        available: false,
        reason: 'Sora API in limited preview',
      },
    ];
  }

  /**
   * Estimate cost for video generation
   */
  estimateCost(provider: VideoProvider, durationSeconds: number): number {
    if (provider === 'pollo' || this.polloAdapter.isConfigured()) {
      return this.polloAdapter.estimateCost('kling-v1-6', durationSeconds);
    }

    // Direct Runway pricing: $0.05/second for Gen4 Turbo
    if (provider === 'runway') {
      return durationSeconds * 0.05;
    }

    return 0;
  }
}

// Singleton instance
let videoService: VideoService | null = null;

export function getVideoService(): VideoService {
  if (!videoService) {
    videoService = new VideoService();
  }
  return videoService;
}
