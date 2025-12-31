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
  selectedIdentityMode: IdentityMode;
  
  // Available options (fetched based on campaign)
  availableKBs: KnowledgeBase[];
  availableIdentity: BrandIdentity | null;
  
  // Status
  isLoadingKBs: boolean;
  isLoadingIdentity: boolean;
  
  // Computed
  contextReady: boolean;
  
  // Actions
  setCampaign: (campaign: Campaign) => void;
  setAvailableKBs: (kbs: KnowledgeBase[]) => void;
  setAvailableIdentity: (identity: BrandIdentity | null) => void;
  toggleKB: (kb: KnowledgeBase) => void;
  selectAllKBs: () => void;
  clearKBs: () => void;
  setIdentityMode: (mode: IdentityMode) => void;
  setLoadingKBs: (loading: boolean) => void;
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
      selectedIdentityMode: 'shared',
      availableKBs: [],
      availableIdentity: null,
      isLoadingKBs: false,
      isLoadingIdentity: false,
      contextReady: false,
      
      // Set campaign - resets downstream selections
      setCampaign: (campaign: Campaign) => {
        set({
          selectedCampaign: campaign,
          selectedKBs: [], // Reset KBs when campaign changes
          availableKBs: [],
          availableIdentity: null,
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
      
      // Set identity mode
      setIdentityMode: (mode: IdentityMode) => {
        set({ selectedIdentityMode: mode });
      },
      
      // Loading states
      setLoadingKBs: (loading: boolean) => {
        set({ isLoadingKBs: loading });
      },
      
      setLoadingIdentity: (loading: boolean) => {
        set({ isLoadingIdentity: loading });
      },
      
      // Clear all context
      clearContext: () => {
        set({
          selectedCampaign: null,
          selectedKBs: [],
          selectedIdentityMode: 'shared',
          availableKBs: [],
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
    availableKBs: store.availableKBs,
    identityMode: store.selectedIdentityMode,
    identity: store.availableIdentity,
    
    // Status
    isLoadingKBs: store.isLoadingKBs,
    isLoadingIdentity: store.isLoadingIdentity,
    contextReady: store.contextReady,
    
    // Actions
    setCampaign: store.setCampaign,
    setAvailableKBs: store.setAvailableKBs,
    setAvailableIdentity: store.setAvailableIdentity,
    toggleKB: store.toggleKB,
    selectAllKBs: store.selectAllKBs,
    clearKBs: store.clearKBs,
    setIdentityMode: store.setIdentityMode,
    setLoadingKBs: store.setLoadingKBs,
    setLoadingIdentity: store.setLoadingIdentity,
    clearContext: store.clearContext,
    getContextPayload: store.getContextPayload,
  };
}
