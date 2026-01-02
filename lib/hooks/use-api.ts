import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { AxiosError } from 'axios';
import { 
  trendsApi, 
  briefsApi, 
  brandsApi,
  scriptsApi, 
  videosApi, 
  variantsApi, 
  platformsApi,
  publisherApi,
  campaignsApi,
  analyticsApi,
  healthApi
} from '../api-client';

// =============================================================================
// Fetcher Helper with Error Handling
// =============================================================================

const apiFetcher = async <T,>(fetcher: () => Promise<{ data: { data: T } }>) => {
  try {
    const response = await fetcher();
    return response.data.data;
  } catch (error) {
    // Improve error messages for common issues
    if (error instanceof AxiosError) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Request timeout: The server took too long to respond. Please try again.`);
      }
      if (error.response?.status === 401) {
        throw new Error(`Authentication required: Please log in again.`);
      }
      if (error.response?.status === 403) {
        throw new Error(`Access denied: You don't have permission to access this resource.`);
      }
      if (error.response?.status && error.response.status >= 500) {
        throw new Error(`Server error: ${error.response.data?.error?.message || 'Please try again later.'}`);
      }
    }
    throw error;
  }
};

// SWR default configuration
export const swrConfig = {
  // Don't retry on 4xx errors (client errors)
  shouldRetryOnError: (error: Error) => {
    if (error.message.includes('Authentication required') || 
        error.message.includes('Access denied')) {
      return false;
    }
    return true;
  },
  // Retry with exponential backoff
  errorRetryCount: 3,
  errorRetryInterval: 5000, // Start with 5s delay
  // Dedupe requests within 2s window
  dedupingInterval: 2000,
  // Revalidate on focus for fresh data
  revalidateOnFocus: true,
  // Don't revalidate too frequently
  revalidateOnReconnect: true,
};

// =============================================================================
// Pillar 1: Strategist Hooks
// =============================================================================

export function useTrends(params?: { category?: string; source?: string; limit?: number }) {
  return useSWR(
    params ? ['/trends', params] : '/trends',
    () => apiFetcher(() => trendsApi.getTrends(params)),
    { refreshInterval: 300000 } // Refresh every 5 minutes
  );
}

export function useBrief(briefId: string | null) {
  return useSWR(
    briefId ? `/briefs/${briefId}` : null,
    () => apiFetcher(() => briefsApi.getBrief(briefId!))
  );
}

export function useBrands() {
  return useSWR(
    '/brands',
    () => apiFetcher(() => brandsApi.getBrands())
  );
}

// =============================================================================
// Pillar 2: Copywriter Hooks
// =============================================================================

export function useScript(scriptId: string | null) {
  return useSWR(
    scriptId ? `/scripts/${scriptId}` : null,
    () => apiFetcher(() => scriptsApi.getScript(scriptId!))
  );
}

export function useHooks(scriptId: string | null) {
  return useSWR(
    scriptId ? `/scripts/${scriptId}/hooks` : null,
    () => apiFetcher(() => scriptsApi.getHooks(scriptId!))
  );
}

// =============================================================================
// Pillar 3: Production Hooks
// =============================================================================

export function useVideo(videoId: string | null, pollWhileGenerating = false) {
  return useSWR(
    videoId ? `/videos/${videoId}` : null,
    () => apiFetcher(() => videosApi.getVideo(videoId!)),
    pollWhileGenerating ? { refreshInterval: 5000 } : undefined // Poll every 5s while generating
  );
}

export function useVideos(params?: { status?: string; limit?: number; offset?: number }) {
  return useSWR(
    ['/videos', params],
    () => apiFetcher(() => videosApi.listVideos(params))
  );
}

export function useScenes(videoId: string | null) {
  return useSWR(
    videoId ? `/videos/${videoId}/scenes` : null,
    () => apiFetcher(() => videosApi.getScenes(videoId!))
  );
}

// =============================================================================
// Pillar 4: Distribution Hooks
// =============================================================================

export function useVariants(videoId: string | null = null) {
  return useSWR(
    videoId ? `/videos/${videoId}/variants` : null,
    () => apiFetcher(() => variantsApi.getVideoVariants(videoId!))
  );
}

export function useVariant(variantId: string | null) {
  return useSWR(
    variantId ? `/variants/${variantId}` : null,
    () => apiFetcher(() => variantsApi.getVariant(variantId!))
  );
}

export function usePlatforms() {
  return useSWR(
    '/platforms',
    () => apiFetcher(() => platformsApi.getPlatforms()),
    { revalidateOnFocus: false } // Platforms rarely change
  );
}

// =============================================================================
// Pillar 5: Publisher Hooks
// =============================================================================

export function useScheduledPosts(params?: { status?: string; limit?: number; offset?: number }) {
  return useSWR(
    ['/scheduled-posts', params],
    () => apiFetcher(() => publisherApi.getScheduledPosts(params)),
    { refreshInterval: 10000 } // Refresh every 10 seconds
  );
}

export function usePublication(publicationId: string | null) {
  return useSWR(
    publicationId ? `/publications/${publicationId}` : null,
    () => apiFetcher(() => publisherApi.getPublication(publicationId!))
  );
}

// =============================================================================
// Campaigns (Aggregate) Hooks
// =============================================================================

export function useCampaigns(params?: { status?: string; limit?: number; offset?: number }) {
  return useSWR(
    ['/campaigns', params],
    () => apiFetcher(() => campaignsApi.list(params)),
    {
      ...swrConfig,
      // Campaigns can be slow, give it more time
      errorRetryInterval: 10000, // 10s between retries
      // Cache for 30s to avoid repeated slow queries
      dedupingInterval: 30000,
    }
  );
}

export function useCampaign(campaignId: string | null) {
  return useSWR(
    campaignId ? `/campaigns/${campaignId}` : null,
    () => apiFetcher(() => campaignsApi.get(campaignId!)),
    swrConfig
  );
}

// =============================================================================
// Analytics Hooks
// =============================================================================

export function useAnalyticsOverview(params?: { startDate?: string; endDate?: string }) {
  return useSWR(
    ['/analytics/overview', params],
    () => apiFetcher(() => analyticsApi.getOverview(params)),
    { refreshInterval: 60000 } // Refresh every minute
  );
}

export function useCampaignAnalytics(campaignId: string | null) {
  return useSWR(
    campaignId ? `/campaigns/${campaignId}/analytics` : null,
    () => apiFetcher(() => analyticsApi.getCampaignAnalytics(campaignId!)),
    { refreshInterval: 60000 }
  );
}

export function useTopContent(params?: { limit?: number; metric?: string }) {
  return useSWR(
    ['/analytics/top-content', params],
    () => apiFetcher(() => analyticsApi.getTopContent(params))
  );
}

// =============================================================================
// Health Check Hook
// =============================================================================

export function useHealth() {
  return useSWR(
    '/health',
    () => apiFetcher(() => healthApi.check()),
    { refreshInterval: 30000 } // Check every 30 seconds
  );
}

// =============================================================================
// V1 API Hooks (Connected to backend)
// =============================================================================

// Simple fetch wrapper for v1 endpoints
const v1Fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('API request failed');
  const data = await response.json();
  return data.data;
};

export function useDashboardStats() {
  return useSWR(
    '/api/v1/dashboard/stats',
    v1Fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );
}

export function useV1Campaigns(params?: { status?: string; limit?: number; offset?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  
  const url = `/api/v1/campaigns${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  
  return useSWR(url, v1Fetcher);
}

export function useV1Campaign(campaignId: string | null) {
  return useSWR(
    campaignId ? `/api/v1/campaigns/${campaignId}` : null,
    v1Fetcher,
    {
      // Poll faster when campaign is processing
      refreshInterval: (data) => {
        const processingStates = ['strategizing', 'writing', 'producing', 'publishing'];
        if (data && processingStates.includes(data.status)) {
          return 2000; // Poll every 2 seconds during processing
        }
        return 10000; // Slow poll when stable
      },
    }
  );
}

export function useTriggerWorkflow() {
  return useSWRMutation(
    '/api/v1/campaigns/trigger',
    async (_key, { arg }: { arg: { campaignId: string; action: string; data?: Record<string, unknown> } }) => {
      const response = await fetch(`/api/v1/campaigns/${arg.campaignId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: arg.action, ...arg.data }),
      });
      if (!response.ok) throw new Error('Failed to trigger workflow');
      return response.json();
    }
  );
}

export function useSystemHealth() {
  return useSWR(
    '/api/v1/health',
    v1Fetcher,
    { refreshInterval: 30000 }
  );
}

export function useV1Videos(params?: { status?: string; campaign_id?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.campaign_id) searchParams.set('campaign_id', params.campaign_id);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  
  const url = `/api/v1/videos${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return useSWR(url, v1Fetcher, { refreshInterval: 10000 });
}

export function useV1Briefs(params?: { campaign_id?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.campaign_id) searchParams.set('campaign_id', params.campaign_id);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  
  const url = `/api/v1/briefs${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return useSWR(url, v1Fetcher);
}

export function useV1Scripts(params?: { campaign_id?: string; brief_id?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.campaign_id) searchParams.set('campaign_id', params.campaign_id);
  if (params?.brief_id) searchParams.set('brief_id', params.brief_id);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  
  const url = `/api/v1/scripts${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return useSWR(url, v1Fetcher);
}

export function useV1Publications(params?: { status?: string; platform?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.platform) searchParams.set('platform', params.platform);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  
  const url = `/api/v1/publications${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return useSWR(url, v1Fetcher, { refreshInterval: 15000 });
}

// =============================================================================
// Mutation Hooks (for POST/PUT/DELETE operations)
// =============================================================================

export function useCreateBrief() {
  return useSWRMutation(
    '/briefs',
    async (_key, { arg }: { arg: { campaignId: string; data: Record<string, unknown> } }) => {
      const response = await briefsApi.createBrief(arg.campaignId, arg.data as unknown as import('../api-client').BriefRequest);
      return response.data.data;
    }
  );
}

export function useGenerateScript() {
  return useSWRMutation(
    '/scripts',
    async (_key, { arg }: { arg: { briefId: string; data?: Record<string, unknown> } }) => {
      const response = await scriptsApi.generateScript(arg.briefId, arg.data);
      return response.data.data;
    }
  );
}

export function useGenerateVideo() {
  return useSWRMutation(
    '/videos',
    async (_key, { arg }: { arg: { scriptId: string; data?: Record<string, unknown> } }) => {
      const response = await videosApi.generateVideo(arg.scriptId, arg.data);
      return response.data.data;
    }
  );
}

export function useGenerateVariants() {
  return useSWRMutation(
    '/variants',
    async (_key, { arg }: { arg: { videoId: string; data?: Record<string, unknown> } }) => {
      const response = await variantsApi.generateVariants(arg.videoId, arg.data);
      return response.data.data;
    }
  );
}

export function useSchedulePost() {
  return useSWRMutation(
    '/schedule',
    async (_key, { arg }: { arg: { variantId: string; data: Record<string, unknown> } }) => {
      const response = await publisherApi.schedulePost(arg.variantId, arg.data as unknown as import('../api-client').ScheduleRequest);
      return response.data.data;
    }
  );
}

export function usePublishNow() {
  return useSWRMutation(
    '/publish',
    async (_key, { arg }: { arg: { variantId: string; data?: Record<string, unknown> } }) => {
      const response = await publisherApi.publishNow(arg.variantId, arg.data);
      return response.data.data;
    }
  );
}

export function useCreateCampaign() {
  return useSWRMutation(
    '/campaigns',
    async (_key, { arg }: { arg: { name: string; brand_id: string } }) => {
      const response = await campaignsApi.create(arg);
      return response.data.data;
    }
  );
}

export function useUpdateCampaign() {
  return useSWRMutation(
    '/campaigns/update',
    async (_key, { arg }: { arg: { campaignId: string; data: Record<string, unknown> } }) => {
      const response = await campaignsApi.update(arg.campaignId, arg.data);
      return response.data.data;
    }
  );
}

// =============================================================================
// V1 API Hooks - Reviews, Analytics, Variants
// =============================================================================

export function useV1Reviews(params?: { type?: 'brief' | 'script' | 'video' }) {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  
  const url = `/api/v1/reviews${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return useSWR(url, v1Fetcher, { refreshInterval: 30000 });
}

export function useV1Analytics(params?: { range?: '7d' | '30d' | '90d' | 'year' }) {
  const searchParams = new URLSearchParams();
  if (params?.range) searchParams.set('range', params.range);
  
  const url = `/api/v1/analytics${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return useSWR(url, v1Fetcher);
}

export function useV1Variants(params?: { video_id?: string; platform?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.video_id) searchParams.set('video_id', params.video_id);
  if (params?.platform) searchParams.set('platform', params.platform);
  
  const url = `/api/v1/variants${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  return useSWR(url, v1Fetcher);
}

