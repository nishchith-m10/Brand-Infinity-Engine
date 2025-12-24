import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
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
// Fetcher Helper
// =============================================================================

const apiFetcher = async <T,>(fetcher: () => Promise<{ data: { data: T } }>) => {
  const response = await fetcher();
  return response.data.data;
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
    () => apiFetcher(() => campaignsApi.list(params))
  );
}

export function useCampaign(campaignId: string | null) {
  return useSWR(
    campaignId ? `/campaigns/${campaignId}` : null,
    () => apiFetcher(() => campaignsApi.get(campaignId!))
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
