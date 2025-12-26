'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Campaign interface matching database schema
 */
export interface Campaign {
  id: string;
  campaign_name: string;
  brand_id?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

/**
 * Campaign Store State
 */
interface CampaignStore {
  // State
  currentCampaignId: string | null;
  currentCampaign: Campaign | null;
  
  // Actions
  setCampaign: (campaign: Campaign) => void;
  clearCampaign: () => void;
  updateCampaign: (updates: Partial<Campaign>) => void;
}

/**
 * Global Campaign Context Store
 * 
 * Persisted to localStorage so campaign selection survives page refresh.
 * All pages read from this store to scope data to the selected campaign.
 */
export const useCampaignStore = create<CampaignStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentCampaignId: null,
      currentCampaign: null,
      
      // Set the current campaign
      setCampaign: (campaign: Campaign) => set({ 
        currentCampaignId: campaign.id,
        currentCampaign: campaign 
      }),
      
      // Clear campaign selection
      clearCampaign: () => set({ 
        currentCampaignId: null, 
        currentCampaign: null 
      }),
      
      // Update current campaign (e.g., after edit)
      updateCampaign: (updates: Partial<Campaign>) => {
        const current = get().currentCampaign;
        if (current) {
          set({ currentCampaign: { ...current, ...updates } });
        }
      },
    }),
    { 
      name: 'bie-campaign-store',
      // Only persist IDs, refetch full data on hydration
      partialize: (state) => ({ 
        currentCampaignId: state.currentCampaignId 
      }),
    }
  )
);

/**
 * Hook to get current campaign with null safety
 */
export function useCurrentCampaign() {
  const { currentCampaign, currentCampaignId, setCampaign, clearCampaign } = useCampaignStore();
  
  return {
    campaign: currentCampaign,
    campaignId: currentCampaignId,
    hasCampaign: !!currentCampaignId,
    setCampaign,
    clearCampaign,
  };
}
