'use client';

import { useState, useEffect } from 'react';
import { FolderOpen, Plus, ChevronDown, Check, Loader2 } from 'lucide-react';
import { useCurrentCampaign, Campaign } from '@/lib/hooks/use-current-campaign';
import { useCampaigns } from '@/lib/hooks/use-api';
import { useRouter } from 'next/navigation';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * Campaign Selector
 * 
 * Dropdown in the header that allows switching between campaigns.
 * Shows currently selected campaign and allows creating new ones.
 */
export function CampaignSelector() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const { campaign, campaignId, setCampaign, hasCampaign } = useCurrentCampaign();
  const { data: campaignsData, isLoading } = useCampaigns();
  
  // Handle nested response structure: could be direct array or { data: campaigns }
  const campaigns: Campaign[] = Array.isArray(campaignsData) 
    ? campaignsData 
    : (campaignsData as unknown as { data?: Campaign[] })?.data || [];
  
  // Filter to only show active campaigns
  const activeCampaigns = campaigns;
  
  // Auto-select first campaign if none selected and campaigns exist
  useEffect(() => {
    if (!hasCampaign && activeCampaigns.length > 0) {
      setCampaign(activeCampaigns[0] as Campaign);
    }
  }, [activeCampaigns, hasCampaign, setCampaign]);
  
  // Hydrate campaign data if only ID is persisted
  useEffect(() => {
    if (campaignId && !campaign && activeCampaigns.length > 0) {
      const found = activeCampaigns.find((c: Campaign) => c.id === campaignId);
      if (found) {
        setCampaign(found as Campaign);
      }
    }
  }, [campaignId, campaign, activeCampaigns, setCampaign]);
  
  const handleSelect = (selected: Campaign) => {
    setIsSwitching(true);
    setCampaign(selected);
    setIsOpen(false);
    
    // Clear switching state after a short delay to show visual feedback
    setTimeout(() => setIsSwitching(false), 800);
  };
  
  const handleCreateNew = () => {
    setIsOpen(false);
    router.push('/campaigns?create=true');
  };
  
  // Display name
  const displayName = campaign?.campaign_name || 'Select Campaign';
  
  return (
    <div className="relative">
      {/* Trigger Button */}
      <Tooltip 
        content={campaign ? `Current campaign: ${campaign.campaign_name}` : 'Select a campaign to get started'}
        position="bottom"
      >
      <button
        onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-card border border-slate-200 dark:border-border hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-muted transition-colors min-w-[180px] max-w-[260px] shadow-sm"
        disabled={isSwitching}
      >
        {isSwitching ? (
          <Loader2 className="h-4 w-4 text-indigo-500 shrink-0 animate-spin" />
        ) : (
          <FolderOpen className="h-4 w-4 text-slate-800 dark:text-slate-300 shrink-0" />
        )}
        <span className="text-sm font-medium text-slate-800 dark:text-slate-300 truncate flex-1 text-left">
          {isSwitching ? 'Switching...' : (isLoading ? 'Loading...' : displayName)}
        </span>
        <ChevronDown 
            className={`h-4 w-4 text-slate-800 dark:text-slate-300 shrink-0 transition-transform ml-auto ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      </Tooltip>
      
      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Menu */}
          <div className="absolute top-full left-0 mt-1 w-full min-w-[250px] bg-white dark:bg-card rounded-lg shadow-lg border border-slate-200 dark:border-border z-50 py-1 max-h-[300px] overflow-y-auto">
            {activeCampaigns.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                No campaigns yet
              </div>
            ) : (
              activeCampaigns.map((camp: Campaign) => (
                <button
                  key={camp.id}
                  onClick={() => handleSelect(camp as Campaign)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-muted transition-colors text-slate-800 dark:text-slate-300"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    camp.status === 'active' ? 'bg-green-500' : 
                    camp.status === 'paused' ? 'bg-yellow-500' : 
                    camp.status === 'completed' ? 'bg-blue-500' : 
                    'bg-slate-300'
                  }`} />
                  <span className="text-sm text-slate-800 dark:text-slate-300 truncate flex-1 text-left">
                    {camp.campaign_name}
                  </span>
                  {camp.id === campaignId && (
                    <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                  )}
                </button>
              ))
            )}
            
            {/* Divider */}
            <div className="border-t border-slate-100 my-1" />
            
            {/* Create New */}
            <button
              onClick={handleCreateNew}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors text-indigo-600 dark:text-indigo-400"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Create New Campaign</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
