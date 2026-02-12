'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Campaign } from './use-current-campaign';

/**
 * Knowledge Base interface
 */
export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  brand_id: string;
  campaign_id?: string;
  is_core: boolean;
  is_default: boolean;
  created_at: string;
}

/**
 * Brand Identity interface
 */
export interface BrandIdentity {
  id?: string;
  brand_name?: string;
  brand_voice?: string;
  tagline?: string;
  mission_statement?: string;
  target_audience?: string;
  tone_style?: string;
  personality_traits?: string[];
  content_pillars?: string[];
}

/**
 * Brand Asset interface (from Brand Vault)
 */
export interface BrandAsset {
  id: string;
  brand_id: string;
  knowledge_base_id?: string;
  asset_type: 'logo' | 'product' | 'guideline' | 'color' | 'font' | 'other';
  file_url: string;
  file_name: string;
  content_text?: string;
  metadata?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

/**
 * Identity mode options
 */
export type IdentityMode = 'isolated' | 'shared' | 'inherited';

/**
 * Context payload sent with each AI message
 */
export interface ContextPayload {
  campaign_id: string;
  campaign_name: string;
  kb_ids: string[];
  asset_ids: string[];
  identity_mode: IdentityMode;
  identity: BrandIdentity | null;
}

/**
 * Chat Context State
 */
interface ChatContextState {
  // Selected hierarchy
  selectedCampaign: Campaign | null;
  selectedKBs: KnowledgeBase[];
  selectedAssets: BrandAsset[];
  selectedIdentityMode: IdentityMode;
  
  // Available options (fetched based on campaign)
  availableKBs: KnowledgeBase[];
  availableAssets: BrandAsset[];
  availableIdentity: BrandIdentity | null;
  
  // Status
  isLoadingKBs: boolean;
  isLoadingAssets: boolean;
  isLoadingIdentity: boolean;
  
  // Computed
  contextReady: boolean;
  
  // Actions
  setCampaign: (campaign: Campaign) => void;
  setAvailableKBs: (kbs: KnowledgeBase[]) => void;
  setAvailableAssets: (assets: BrandAsset[]) => void;
  setAvailableIdentity: (identity: BrandIdentity | null) => void;
  toggleKB: (kb: KnowledgeBase) => void;
  toggleAsset: (asset: BrandAsset) => void;
  selectAllKBs: () => void;
  selectAllAssets: () => void;
  clearKBs: () => void;
  clearAssets: () => void;
  setIdentityMode: (mode: IdentityMode) => void;
  setLoadingKBs: (loading: boolean) => void;
  setLoadingAssets: (loading: boolean) => void;
  setLoadingIdentity: (loading: boolean) => void;
  clearContext: () => void;
  
  // Get context payload for API calls
  getContextPayload: () => ContextPayload | null;
}

/**
 * Chat Context Store
 * 
 * Manages hierarchical context selection: Campaign → KB → Identity
 * Persists campaign selection to localStorage.
 */
export const useChatContextStore = create<ChatContextState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedCampaign: null,
      selectedKBs: [],
      selectedAssets: [],
      selectedIdentityMode: 'shared',
      availableKBs: [],
      availableAssets: [],
      availableIdentity: null,
      isLoadingKBs: false,
      isLoadingAssets: false,
      isLoadingIdentity: false,
      contextReady: false,
      
      // Set campaign - resets downstream selections
      setCampaign: (campaign: Campaign) => {
        set({
          selectedCampaign: campaign,
          selectedKBs: [], // Reset KBs when campaign changes
          selectedAssets: [], // Reset assets when campaign changes
          availableKBs: [],
          availableAssets: [],
          availableIdentity: null,
          selectedIdentityMode: 'isolated', // Default to Campaign Identity when selecting a campaign
          contextReady: false,
        });
      },
      
      // Set available KBs after fetch
      setAvailableKBs: (kbs: KnowledgeBase[]) => {
        const state = get();
        set({
          availableKBs: kbs,
          // Auto-select all KBs by default
          selectedKBs: kbs,
          contextReady: state.selectedCampaign !== null,
        });
      },
      
      // Set available identity after fetch
      setAvailableIdentity: (identity: BrandIdentity | null) => {
        set({ availableIdentity: identity });
      },
      
      // Toggle a single KB
      toggleKB: (kb: KnowledgeBase) => {
        const state = get();
        const isSelected = state.selectedKBs.some(k => k.id === kb.id);
        
        if (isSelected) {
          set({
            selectedKBs: state.selectedKBs.filter(k => k.id !== kb.id),
          });
        } else {
          set({
            selectedKBs: [...state.selectedKBs, kb],
          });
        }
      },
      
      // Select all available KBs
      selectAllKBs: () => {
        set({ selectedKBs: get().availableKBs });
      },
      
      // Clear all KB selections
      clearKBs: () => {
        set({ selectedKBs: [] });
      },
      
      // Set available assets after fetch
      setAvailableAssets: (assets: BrandAsset[]) => {
        set({
          availableAssets: assets,
          // Don't auto-select assets - let user choose
          selectedAssets: [],
        });
      },
      
      // Toggle a single asset
      toggleAsset: (asset: BrandAsset) => {
        const state = get();
        const isSelected = state.selectedAssets.some(a => a.id === asset.id);
        
        if (isSelected) {
          set({
            selectedAssets: state.selectedAssets.filter(a => a.id !== asset.id),
          });
        } else {
          set({
            selectedAssets: [...state.selectedAssets, asset],
          });
        }
      },
      
      // Select all available assets
      selectAllAssets: () => {
        set({ selectedAssets: get().availableAssets });
      },
      
      // Clear all asset selections
      clearAssets: () => {
        set({ selectedAssets: [] });
      },
      
      // Set identity mode
      setIdentityMode: (mode: IdentityMode) => {
        set({ selectedIdentityMode: mode });
      },
      
      // Loading states
      setLoadingKBs: (loading: boolean) => {
        set({ isLoadingKBs: loading });
      },
      
      setLoadingAssets: (loading: boolean) => {
        set({ isLoadingAssets: loading });
      },
      
      setLoadingIdentity: (loading: boolean) => {
        set({ isLoadingIdentity: loading });
      },
      
      // Clear all context
      clearContext: () => {
        set({
          selectedCampaign: null,
          selectedKBs: [],
          selectedAssets: [],
          selectedIdentityMode: 'shared',
          availableKBs: [],
          availableAssets: [],
          availableIdentity: null,
          contextReady: false,
        });
      },
      
      // Get context payload for API calls
      getContextPayload: (): ContextPayload | null => {
        const state = get();
        if (!state.selectedCampaign) return null;
        
        return {
          campaign_id: state.selectedCampaign.id,
          campaign_name: state.selectedCampaign.campaign_name,
          kb_ids: state.selectedKBs.map(kb => kb.id),
          asset_ids: state.selectedAssets.map(a => a.id),
          identity_mode: state.selectedIdentityMode,
          identity: state.availableIdentity,
        };
      },
    }),
    {
      name: 'bie-chat-context-store',
      // Only persist campaign ID, refetch rest on hydration
      partialize: (state) => ({
        selectedCampaign: state.selectedCampaign,
        selectedIdentityMode: state.selectedIdentityMode,
      }),
    }
  )
);

/**
 * Hook to use chat context with data fetching
 */
export function useChatContext() {
  const store = useChatContextStore();
  
  return {
    // State
    campaign: store.selectedCampaign,
    campaignId: store.selectedCampaign?.id || null,
    selectedKBs: store.selectedKBs,
    selectedAssets: store.selectedAssets,
    availableKBs: store.availableKBs,
    availableAssets: store.availableAssets,
    identityMode: store.selectedIdentityMode,
    identity: store.availableIdentity,
    availableIdentity: store.availableIdentity,
    
    // Status
    isLoadingKBs: store.isLoadingKBs,
    isLoadingAssets: store.isLoadingAssets,
    isLoadingIdentity: store.isLoadingIdentity,
    contextReady: store.contextReady,
    
    // Actions
    setCampaign: store.setCampaign,
    setAvailableKBs: store.setAvailableKBs,
    setAvailableAssets: store.setAvailableAssets,
    setAvailableIdentity: store.setAvailableIdentity,
    toggleKB: store.toggleKB,
    toggleAsset: store.toggleAsset,
    selectAllKBs: store.selectAllKBs,
    selectAllAssets: store.selectAllAssets,
    clearKBs: store.clearKBs,
    clearAssets: store.clearAssets,
    setIdentityMode: store.setIdentityMode,
    setLoadingKBs: store.setLoadingKBs,
    setLoadingAssets: store.setLoadingAssets,
    setLoadingIdentity: store.setLoadingIdentity,
    clearContext: store.clearContext,
    getContextPayload: store.getContextPayload,
  };
}
