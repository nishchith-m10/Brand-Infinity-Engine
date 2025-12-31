'use client';

/**
 * Chat Context Selector
 * 
 * Hierarchical context selection UI for the AI Chat Interface.
 * Enforces: Campaign → KB → Identity selection order.
 */

import { useEffect, useCallback, useState } from 'react';
import { 
  FolderOpen, 
  Database, 
  User, 
  ChevronDown, 
  Check, 
  Loader2,
  X,
  Settings2
} from 'lucide-react';
import { useChatContext, IdentityMode, KnowledgeBase } from '@/lib/hooks/use-chat-context';
import { useCampaigns } from '@/lib/hooks/use-api';
import { Campaign } from '@/lib/hooks/use-current-campaign';
import { useAuth } from '@/lib/auth/auth-provider';

interface ChatContextSelectorProps {
  compact?: boolean;
}

export function ChatContextSelector({ compact = false }: ChatContextSelectorProps) {
  const { user } = useAuth();
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  
  const {
    campaign,
    selectedKBs,
    availableKBs,
    identityMode,
    isLoadingKBs,
    isLoadingIdentity,
    contextReady,
    setCampaign,
    setAvailableKBs,
    setAvailableIdentity,
    toggleKB,
    selectAllKBs,
    clearKBs,
    setIdentityMode,
    setLoadingKBs,
    setLoadingIdentity,
  } = useChatContext();
  
  // Fetch campaigns
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns();
  const campaigns = (Array.isArray(campaignsData) 
    ? campaignsData 
    : (campaignsData as unknown as Record<string, unknown>)?.data || []) as Campaign[];
  
  const activeCampaigns = campaigns;
  
  // Fetch KBs when campaign changes - use campaign.brand_id for correct KB lookup
  const fetchKBs = useCallback(async () => {
    if (!campaign) return;
    const brandId = campaign.brand_id || '';
    
    setLoadingKBs(true);
    try {
      const res = await fetch(
        `/api/v1/knowledge-bases?brand_id=${brandId}&campaign_id=${campaign.id}`
      );
      const { data, success } = await res.json();
      if (success) {
        setAvailableKBs(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch KBs:', err);
    } finally {
      setLoadingKBs(false);
    }
  }, [campaign, setAvailableKBs, setLoadingKBs]);
  
  // Fetch identity when campaign changes
  const fetchIdentity = useCallback(async () => {
    if (!campaign) return;
    
    setLoadingIdentity(true);
    try {
      const res = await fetch(
        `/api/v1/brand-identity?campaign_id=${campaign.id}`
      );
      const { data, success } = await res.json();
      if (success) {
        setAvailableIdentity(data || null);
      }
    } catch (err) {
      console.error('Failed to fetch identity:', err);
    } finally {
      setLoadingIdentity(false);
    }
  }, [campaign, setAvailableIdentity, setLoadingIdentity]);
  
  // Trigger fetches when campaign changes
  useEffect(() => {
    if (campaign) {
      const timer = setTimeout(() => {
        fetchKBs();
        fetchIdentity();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [campaign, fetchKBs, fetchIdentity]);
  
  const handleCampaignSelect = (c: Campaign) => {
    setCampaign(c);
    setCampaignOpen(false);
  };
  
  const handleKBToggle = (kb: KnowledgeBase) => {
    toggleKB(kb);
  };
  
  const handleIdentitySelect = (mode: IdentityMode) => {
    setIdentityMode(mode);
    setIdentityOpen(false);
  };
  
  const identityLabels: Record<IdentityMode, string> = {
    isolated: 'Campaign Identity',
    shared: 'Brand Default',
    inherited: 'Inherited',
  };
  
  // Compact mode for smaller screens
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setCampaignOpen(!campaignOpen)}
          className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded text-slate-700 hover:bg-slate-200 transition-colors"
        >
          <FolderOpen className="h-3 w-3" />
          <span className="truncate max-w-[100px]">
            {campaign?.campaign_name || 'Select'}
          </span>
        </button>
        
        {contextReady && (
          <>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">
              {selectedKBs.length} KB{selectedKBs.length !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
    );
  }
  
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {/* Campaign Selector - Primary */}
      <div className="relative">
        <button
          onClick={() => setCampaignOpen(!campaignOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-medium ${
            campaign 
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' 
              : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
          }`}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="truncate max-w-[160px]">
            {campaignsLoading ? 'Loading...' : (campaign?.campaign_name || 'Select Campaign')}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${campaignOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {campaignOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setCampaignOpen(false)} />
            <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1 max-h-[280px] overflow-y-auto">
              {activeCampaigns.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-slate-500">
                  No campaigns available
                </div>
              ) : (
                activeCampaigns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleCampaignSelect(c)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      c.status === 'active' ? 'bg-green-500' : 
                      c.status === 'paused' ? 'bg-yellow-500' : 
                      'bg-slate-300'
                    }`} />
                    <span className="text-sm text-slate-700 truncate flex-1 text-left">
                      {c.campaign_name}
                    </span>
                    {c.id === campaign?.id && (
                      <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
      
      {/* KB Selector - Secondary (only visible when campaign selected) */}
      {campaign && (
        <div className="relative">
          <button
            onClick={() => setKbOpen(!kbOpen)}
            disabled={isLoadingKBs}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all text-xs font-medium text-slate-600 disabled:opacity-50"
          >
            {isLoadingKBs ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Database className="h-3.5 w-3.5" />
            )}
            <span>
              {selectedKBs.length}/{availableKBs.length} KBs
            </span>
            <ChevronDown className={`h-3 w-3 transition-transform ${kbOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {kbOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setKbOpen(false)} />
              <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1 max-h-[280px] overflow-y-auto">
                {/* Quick actions */}
                <div className="px-3 py-2 border-b border-slate-100 flex gap-2">
                  <button
                    onClick={selectAllKBs}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={clearKBs}
                    className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Clear
                  </button>
                </div>
                
                {availableKBs.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-slate-500">
                    No knowledge bases in this campaign
                  </div>
                ) : (
                  availableKBs.map((kb) => {
                    const isSelected = selectedKBs.some(k => k.id === kb.id);
                    return (
                      <button
                        key={kb.id}
                        onClick={() => handleKBToggle(kb)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected 
                            ? 'bg-indigo-600 border-indigo-600' 
                            : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-sm text-slate-700 truncate">{kb.name}</div>
                          {kb.description && (
                            <div className="text-xs text-slate-400 truncate">{kb.description}</div>
                          )}
                        </div>
                        {kb.is_core && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                            Core
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Identity Selector - Tertiary */}
      {campaign && (
        <div className="relative">
          <button
            onClick={() => setIdentityOpen(!identityOpen)}
            disabled={isLoadingIdentity}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all text-xs font-medium text-slate-600 disabled:opacity-50"
          >
            {isLoadingIdentity ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
            <span>{identityLabels[identityMode]}</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${identityOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {identityOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIdentityOpen(false)} />
              <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
                {(['isolated', 'shared', 'inherited'] as IdentityMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleIdentitySelect(mode)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                      identityMode === mode 
                        ? 'border-indigo-600 bg-indigo-600' 
                        : 'border-slate-300'
                    }`} />
                    <span className="text-sm text-slate-700">{identityLabels[mode]}</span>
                    {mode === identityMode && (
                      <Check className="h-4 w-4 text-indigo-600 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Context Status Indicator */}
      {contextReady && (
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span>Context Ready</span>
        </div>
      )}
    </div>
  );
}
