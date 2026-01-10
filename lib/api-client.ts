import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Augment axios types to include metadata for request timing
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
    _retry?: number;
  }
}

// Use relative URL so Next.js rewrites can proxy to backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // Increased to 60s for slow queries
  // Enable retry for timeout errors
  validateStatus: (status) => status < 500, // Don't throw on 4xx errors
});

// Request interceptor for auth and debugging
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const startTime = Date.now();
    config.metadata = { startTime };

    // Add auth header from cookies if running in browser
    if (typeof window !== 'undefined') {
      try {
        // Get session from Next.js API route instead of direct Supabase call
        // This avoids client-side auth issues
        const sessionResp = await fetch('/api/auth/session', {
          credentials: 'include',
        });
        if (sessionResp.ok) {
          const sessionData = await sessionResp.json();
          if (sessionData.session?.access_token) {
            config.headers.Authorization = `Bearer ${sessionData.session.access_token}`;
          }
        }
      } catch (error) {
        // Silent fail - let the API endpoint handle missing auth
        if (process.env.NODE_ENV === 'development') {
          console.warn('[API] Failed to fetch session:', error);
        }
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and retries
apiClient.interceptors.response.use(
  (response) => {
    // Log request duration in development
    if (process.env.NODE_ENV === 'development' && response.config.metadata?.startTime) {
      const duration = Date.now() - response.config.metadata.startTime;
      if (duration > 5000) {
        console.warn(`[API Slow Response] ${response.config.method?.toUpperCase()} ${response.config.url} took ${duration}ms`);
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retry?: number };
    
    // Calculate request duration
    const duration = config?.metadata?.startTime 
      ? Date.now() - config.metadata.startTime 
      : 0;

    if (process.env.NODE_ENV === 'development') {
      const errorDetails = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        url: config?.url,
        method: config?.method,
        duration: `${duration}ms`,
      };
      console.error('[API Error Detail]:', JSON.stringify(errorDetails, null, 2));
    }

    // Retry logic for timeout errors (ECONNABORTED) - max 2 retries
    if (error.code === 'ECONNABORTED' && config && !config._retry) {
      config._retry = 1;
      console.warn(`[API Retry] Retrying ${config.method?.toUpperCase()} ${config.url} after timeout (attempt 1/2)`);
      
      // Increase timeout for retry
      config.timeout = 90000; // 90s for retry
      return apiClient.request(config);
    }

    // Second retry for persistent timeouts
    if (error.code === 'ECONNABORTED' && config?._retry === 1) {
      config._retry = 2;
      console.warn(`[API Retry] Final retry ${config.method?.toUpperCase()} ${config.url} after timeout (attempt 2/2)`);
      
      // Further increase timeout
      config.timeout = 120000; // 120s for final retry
      return apiClient.request(config);
    }

    return Promise.reject(error);
  }
);

// =============================================================================
// Type Definitions
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    count?: number;
    [key: string]: unknown;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Trend types
export interface Trend {
  id: string;
  name: string;
  category: string;
  source: string;
  engagement_score: number;
  hashtags: string[];
  created_at: string;
}

// Brief types
export interface Brief {
  brief_id: string;
  campaign_id: string;
  brand_id: string;
  product_category: string;
  target_demographic: string;
  campaign_objective: string;
  budget_tier: string;
  creative_concept: string;
  key_messages: string[];
  visual_style: string;
  brand_alignment_score: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface BriefRequest {
  product_category: string;
  target_demographic: string;
  campaign_objective: string;
  budget_tier: 'low' | 'medium' | 'high' | 'premium';
  brand_id: string;
  trends?: string[];
  additional_context?: string;
}

// Script types
export interface Script {
  script_id: string;
  brief_id: string;
  full_script: string;
  hook_variations_count: number;
  scene_segments: SceneSegment[];
  brand_compliance_score: number;
  created_at: string;
}

export interface SceneSegment {
  scene_number: number;
  visual_direction: string;
  dialogue: string;
  duration_seconds: number;
  camera_movement: string;
}

export interface Hook {
  id: string;
  script_id: string;
  hook_text: string;
  hook_type: string;
  psychological_trigger: string;
  effectiveness_score: number;
  rank: number;
}

export interface ScriptRequest {
  hookCount?: number;
  variantTag?: 'aggressive' | 'balanced' | 'soft';
  targetDuration?: number;
}

// Video types
export interface Video {
  video_id: string;
  script_id: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  model_used: string;
  scenes_count: number;
  total_duration_seconds: number;
  total_cost_usd: number;
  quality_score: number;
  output_url?: string;
  created_at: string;
}

export interface Scene {
  id: string;
  video_id: string;
  scene_number: number;
  prompt: string;
  duration_seconds: number;
  model_used: string;
  cost_usd: number;
  status: string;
  output_url?: string;
}

export interface VideoRequest {
  quality?: 'draft' | 'standard' | 'high' | 'premium';
  budget?: 'low' | 'medium' | 'high';
  priority?: 'speed' | 'balanced' | 'quality';
}

// Variant types
export interface Variant {
  variant_id: string;
  video_id: string;
  platform: string;
  aspect_ratio: string;
  duration_seconds: number;
  caption: string;
  hashtags: string[];
  status: 'pending' | 'ready' | 'published';
  output_url?: string;
  created_at: string;
}

export interface VariantRequest {
  platforms?: string[];
  includeCaption?: boolean;
  includeBranding?: boolean;
  customizations?: Record<string, unknown>;
}

// Publication types
export interface Publication {
  publication_id: string;
  variant_id: string;
  platform: string;
  status: 'pending' | 'scheduled' | 'published' | 'failed';
  scheduled_time?: string;
  published_at?: string;
  platform_post_id?: string;
  engagement?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
}

export interface ScheduleRequest {
  scheduledTime: string;
  caption?: string;
  hashtags?: string[];
  customMetadata?: Record<string, unknown>;
}

export interface PublishRequest {
  caption?: string;
  hashtags?: string[];
  customMetadata?: Record<string, unknown>;
}

// Platform types
export interface Platform {
  id: string;
  name: string;
  aspect_ratio: string;
  max_duration: number;
  min_duration: number;
  supported_formats: string[];
}

// Campaign types (aggregate)
export interface Campaign {
  id: string;
  campaign_name: string;
  brand_id: string;
  status: 'draft' | 'active' | 'completed' | 'paused';
  brief?: Brief;
  script?: Script;
  video?: Video;
  variants?: Variant[];
  publications?: Publication[];
  created_at: string;
  updated_at: string;
}

// Analytics types
export interface AnalyticsData {
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  engagement_rate: number;
  top_performing_platform: string;
  daily_stats: DailyStat[];
}

export interface DailyStat {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

// =============================================================================
// API Functions - Pillar 1: Strategist
// =============================================================================

export const trendsApi = {
  getTrends: (params?: { category?: string; source?: string; limit?: number }) =>
    apiClient.get<ApiResponse<Trend[]>>('/trends', { params }),
  
  refreshTrends: (data?: { platforms?: string[]; category?: string }) =>
    apiClient.post<ApiResponse<Trend[]>>('/trends/refresh', data),
  
  analyzeTrend: (trendId: string) =>
    apiClient.get<ApiResponse<{ virality_score: number; peak_time: string }>>(`/trends/${trendId}/virality`),
};

export const briefsApi = {
  createBrief: (campaignId: string, data: BriefRequest) =>
    apiClient.post<ApiResponse<Brief>>(`/campaigns/${campaignId}/briefs`, data),
  
  getBrief: (briefId: string) =>
    apiClient.get<ApiResponse<Brief>>(`/briefs/${briefId}`),
  
  validateBrief: (briefId: string) =>
    apiClient.post<ApiResponse<{ valid: boolean; issues: string[]; score: number }>>(`/briefs/${briefId}/validate`),
  
  approveBrief: (briefId: string) =>
    apiClient.patch<ApiResponse<Brief>>(`/briefs/${briefId}`, { approval_status: 'approved' }),
  
  rejectBrief: (briefId: string, reason: string) =>
    apiClient.patch<ApiResponse<Brief>>(`/briefs/${briefId}`, { approval_status: 'rejected', rejection_reason: reason }),
};

export const brandsApi = {
  getBrands: () =>
    apiClient.get<ApiResponse<{ id: string; name: string }[]>>('/brands'),
  
  queryGuidelines: (brandId: string, context: string) =>
    apiClient.post<ApiResponse<{ guidelines: string[]; relevance_scores: number[] }>>(`/brands/${brandId}/query`, { context }),
  
  checkAlignment: (brandId: string, content: string) =>
    apiClient.post<ApiResponse<{ alignment_score: number; suggestions: string[] }>>(`/brands/${brandId}/alignment`, { content }),
};

// =============================================================================
// API Functions - Pillar 2: Copywriter
// =============================================================================

export const scriptsApi = {
  generateScript: (briefId: string, data?: ScriptRequest) =>
    apiClient.post<ApiResponse<Script>>(`/briefs/${briefId}/scripts`, data || {}),
  
  getScript: (scriptId: string) =>
    apiClient.get<ApiResponse<Script>>(`/scripts/${scriptId}`),
  
  getHooks: (scriptId: string) =>
    apiClient.get<ApiResponse<{ hooks: Hook[] }>>(`/scripts/${scriptId}/hooks`),
  
  updateScript: (scriptId: string, data: Partial<Script>) =>
    apiClient.patch<ApiResponse<Script>>(`/scripts/${scriptId}`, data),
};

// =============================================================================
// API Functions - Pillar 3: Production
// =============================================================================

export const videosApi = {
  generateVideo: (scriptId: string, data?: VideoRequest) =>
    apiClient.post<ApiResponse<Video>>(`/scripts/${scriptId}/videos`, data || {}),
  
  getVideo: (videoId: string) =>
    apiClient.get<ApiResponse<Video>>(`/videos/${videoId}`),
  
  getScenes: (videoId: string) =>
    apiClient.get<ApiResponse<{ scenes: Scene[] }>>(`/videos/${videoId}/scenes`),
  
  listVideos: (params?: { status?: string; limit?: number; offset?: number }) =>
    apiClient.get<ApiResponse<Video[]>>('/videos', { params }),
  
  regenerateScene: (videoId: string, sceneNumber: number) =>
    apiClient.post<ApiResponse<Scene>>(`/videos/${videoId}/scenes/${sceneNumber}/regenerate`),
};

// =============================================================================
// API Functions - Pillar 4: Distribution
// =============================================================================

export const variantsApi = {
  generateVariants: (videoId: string, data?: VariantRequest) =>
    apiClient.post<ApiResponse<{ variants: Variant[]; variants_count: number }>>(`/videos/${videoId}/variants`, data || {}),
  
  getVariant: (variantId: string) =>
    apiClient.get<ApiResponse<Variant>>(`/variants/${variantId}`),
  
  getVideoVariants: (videoId: string) =>
    apiClient.get<ApiResponse<{ variants: Variant[] }>>(`/videos/${videoId}/variants`),
  
  updateVariant: (variantId: string, data: Partial<Variant>) =>
    apiClient.patch<ApiResponse<Variant>>(`/variants/${variantId}`, data),
};

export const platformsApi = {
  getPlatforms: () =>
    apiClient.get<ApiResponse<{ platforms: Platform[] }>>('/platforms'),
  
  getPlatformConfigs: () =>
    apiClient.get<ApiResponse<Record<string, Platform>>>('/platform-configs'),
};

// =============================================================================
// API Functions - Pillar 5: Publisher
// =============================================================================

export const publisherApi = {
  schedulePost: (variantId: string, data: ScheduleRequest) =>
    apiClient.post<ApiResponse<Publication>>(`/variants/${variantId}/schedule`, data),
  
  publishNow: (variantId: string, data?: PublishRequest) =>
    apiClient.post<ApiResponse<Publication>>(`/variants/${variantId}/publish`, data || {}),
  
  getPublication: (publicationId: string) =>
    apiClient.get<ApiResponse<Publication>>(`/publications/${publicationId}`),
  
  getScheduledPosts: (params?: { status?: string; limit?: number; offset?: number }) =>
    apiClient.get<ApiResponse<Publication[]>>('/scheduled-posts', { params }),
  
  cancelScheduledPost: (scheduleId: string) =>
    apiClient.delete<ApiResponse<{ cancelled: boolean }>>(`/scheduled-posts/${scheduleId}`),
  
  getPublicationsByPlatform: (platform: string) =>
    apiClient.get<ApiResponse<Publication[]>>('/publications', { params: { platform } }),
};

// =============================================================================
// API Functions - Health & System
// =============================================================================

export const healthApi = {
  check: () =>
    apiClient.get<ApiResponse<{ status: string; services: Record<string, boolean>; version: string }>>('/health'),
};

// =============================================================================
// API Functions - Campaigns (Aggregate)
// =============================================================================

export const campaignsApi = {
  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    apiClient.get<ApiResponse<Campaign[]>>('/campaigns', { params }),
  
  get: (campaignId: string) =>
    apiClient.get<ApiResponse<Campaign>>(`/campaigns/${campaignId}`),
  
  create: (data: { name: string; brand_id: string }) =>
    apiClient.post<ApiResponse<Campaign>>('/campaigns', data),
  
  update: (campaignId: string, data: Partial<Campaign>) =>
    apiClient.patch<ApiResponse<Campaign>>(`/campaigns/${campaignId}`, data),
  
  delete: (campaignId: string) =>
    apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/campaigns/${campaignId}`),
};

// =============================================================================
// API Functions - Analytics
// =============================================================================

export const analyticsApi = {
  getOverview: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<AnalyticsData>>('/analytics/overview', { params }),
  
  getByPlatform: (platform: string, params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<AnalyticsData>>(`/analytics/platforms/${platform}`, { params }),
  
  getCampaignAnalytics: (campaignId: string) =>
    apiClient.get<ApiResponse<AnalyticsData>>(`/campaigns/${campaignId}/analytics`),
  
  getTopContent: (params?: { limit?: number; metric?: string }) =>
    apiClient.get<ApiResponse<{ content: (Video & { engagement: AnalyticsData })[] }>>('/analytics/top-content', { params }),
};

// =============================================================================
// API Functions - Assets
// =============================================================================

export interface AssetUploadRequest {
  file: File;
  assetType: 'image' | 'video' | 'audio' | 'document';
  tags?: string[];
}

export interface Asset {
  asset_id: string;
  campaign_id?: string;
  asset_type: 'image' | 'video' | 'audio' | 'document';
  filename: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  storage_url: string;
  thumbnail_url?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export const assetsApi = {
  uploadAsset: async (campaignId: string, data: AssetUploadRequest) => {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('assetType', data.assetType);
    if (data.tags) {
      formData.append('tags', data.tags.join(','));
    }
    
    return apiClient.post<ApiResponse<Asset>>(
      `/campaigns/${campaignId}/assets`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  },
  
  listAssets: (campaignId: string, params?: { assetType?: string }) =>
    apiClient.get<ApiResponse<{ assets: Asset[] }>>(`/campaigns/${campaignId}/assets`, { params }),
  
  deleteAsset: (campaignId: string, assetId: string) =>
    apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/campaigns/${campaignId}/assets/${assetId}`),
};
