import useSWR, { SWRConfiguration } from 'swr';
import useSWRMutation from 'swr/mutation';

// ============================================
// Custom SWR Hooks for common data fetching
// ============================================

// Generic hook for GET requests
export function useData<T>(
  key: string | null,
  options?: SWRConfiguration
) {
  return useSWR<T>(key, options);
}

// Dashboard data
export function useDashboardStats() {
  return useSWR('/api/dashboard/stats', {
    refreshInterval: 30000, // Refresh every 30 seconds
  });
}

export function useDashboardActivity() {
  return useSWR('/api/dashboard/activity', {
    refreshInterval: 60000, // Refresh every minute
  });
}

// Campaigns
export function useCampaigns() {
  return useSWR('/api/campaigns');
}

export function useCampaign(id: string | null) {
  return useSWR(id ? `/api/campaigns/${id}` : null);
}

// Videos
export function useVideos() {
  return useSWR('/api/videos');
}

export function useVideo(id: string | null) {
  return useSWR(id ? `/api/videos/${id}` : null);
}

// Analytics
export function useAnalytics(period: string = '7d') {
  return useSWR(`/api/analytics?period=${period}`, {
    refreshInterval: 60000 * 5, // Refresh every 5 minutes
  });
}

// Settings
export function useSettings() {
  return useSWR('/api/settings', {
    revalidateOnFocus: true, // Always fresh settings
  });
}

// ============================================
// Mutation hooks for POST/PUT/DELETE
// ============================================

async function postFetcher(url: string, { arg }: { arg: unknown }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}

async function putFetcher(url: string, { arg }: { arg: unknown }) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}

async function deleteFetcher(url: string) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

// Campaign mutations
export function useCreateCampaign() {
  return useSWRMutation('/api/campaigns', postFetcher);
}

export function useUpdateCampaign(id: string) {
  return useSWRMutation(`/api/campaigns/${id}`, putFetcher);
}

export function useDeleteCampaign(id: string) {
  return useSWRMutation(`/api/campaigns/${id}`, deleteFetcher);
}

// Video mutations
export function useCreateVideo() {
  return useSWRMutation('/api/videos', postFetcher);
}

export function useUpdateVideo(id: string) {
  return useSWRMutation(`/api/videos/${id}`, putFetcher);
}

// Settings mutation
export function useUpdateSettings() {
  return useSWRMutation('/api/settings', putFetcher);
}
