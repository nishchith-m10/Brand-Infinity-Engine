'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useCurrentCampaign } from './use-current-campaign';
import { validateUnlockKey, extractUnlockKey, getStoredUnlockKey } from '@/lib/unlock-key';

/**
 * Campaign Progress Steps
 */
export interface CampaignProgress {
  campaignId: string;
  steps: {
    brandIdentity: boolean;     // Has name, voice, audience configured
    brandAssets: boolean;       // Has at least 1 active asset
    contentGenerated: boolean;  // Has at least 1 brief/script
    contentApproved: boolean;   // Has at least 1 approved item
    videosReady: boolean;       // Has at least 1 completed video
    variantsCreated: boolean;   // Has at least 1 variant
  };
  currentStep: number;          // 1-7
  completionPercent: number;    // 0-100
}

/**
 * Hook to track campaign progress and determine page access
 * 
 * Usage:
 * ```tsx
 * const { canAccessDirector, canAccessVideos } = useCampaignProgress();
 * 
 * if (!canAccessDirector) {
 *   return <LockedState ... />;
 * }
 * ```
 */
export function useCampaignProgress() {
  const { campaignId, hasCampaign } = useCurrentCampaign();
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  // Check for unlock key on mount - from query param or localStorage
  useEffect(() => {
    const checkUnlock = async () => {
      console.log('[Progress] Checking for unlock key...');
      
      // First check if there's a query parameter
      const urlKey = new URLSearchParams(window.location.search).get('unlock_key');
      console.log('[Progress] URL key:', urlKey ? '✓ Found' : '✗ Not found');
      
      let unlockKey = urlKey;
      
      // If URL has unlock_key, extract (which also saves to localStorage)
      if (urlKey) {
        unlockKey = extractUnlockKey(
          new URLSearchParams(window.location.search),
          new Headers()
        );
        console.log('[Progress] Extracted and storing key:', unlockKey ? '✓' : '✗');
      } else {
        // Otherwise check localStorage
        unlockKey = getStoredUnlockKey();
        console.log('[Progress] Checking localStorage:', unlockKey ? '✓ Found' : '✗ Not found');
      }
      
      if (unlockKey) {
        console.log('[Progress] Validating unlock key...');
        const isValid = await validateUnlockKey(unlockKey);
        console.log('[Progress] Validation result:', isValid);
        setIsUnlocked(isValid);
        if (isValid) {
          console.log('🔓 Master unlock key validated - all workflows unlocked for testing');
        }
      } else {
        console.log('[Progress] No unlock key found anywhere');
      }
    };
    
    checkUnlock();
  }, []);
  
  const { data, error, isLoading, mutate } = useSWR<CampaignProgress>(
    hasCampaign ? `/api/v1/campaigns/${campaignId}/progress` : null,
    {
      refreshInterval: 30000, // Refresh every 30s
      revalidateOnFocus: true,
    }
  );
  
  // Default steps when no data
  const defaultSteps = {
    brandIdentity: false,
    brandAssets: false,
    contentGenerated: false,
    contentApproved: false,
    videosReady: false,
    variantsCreated: false,
  };
  
  const steps = data?.steps || defaultSteps;
  
  // If unlock key is valid, unlock ALL workflows (3-7) for testing
  // This includes brand prerequisites so Creative Director is accessible
  const unlockedSteps = isUnlocked ? {
    brandIdentity: true,       // Unlock Creative Director prerequisite
    brandAssets: true,         // Unlock Creative Director prerequisite
    contentGenerated: true,    // Step 4 - Review
    contentApproved: true,     // Step 5 - Videos
    videosReady: true,         // Step 6 - Distribution
    variantsCreated: true,     // Step 7 - Publishing
  } : steps;
  
  return {
    // Raw data
    progress: data,
    steps: unlockedSteps,
    currentStep: data?.currentStep || 1,
    completionPercent: data?.completionPercent || 0,
    isUnlocked, // Expose unlock status for UI indicators
    
    // Loading states
    isLoading,
    error,
    refetch: mutate,
    
    // Access permissions - cascading prerequisites
    canAccessCampaigns: true, // Always accessible
    canAccessBrandVault: hasCampaign,
    canAccessDirector: hasCampaign && unlockedSteps.brandIdentity && unlockedSteps.brandAssets,
    canAccessReview: hasCampaign && unlockedSteps.contentGenerated,
    canAccessVideos: hasCampaign && unlockedSteps.contentApproved,
    canAccessDistribution: hasCampaign && unlockedSteps.videosReady,
    canAccessPublishing: hasCampaign && unlockedSteps.variantsCreated,
    
    // Helper to get next required action
    getNextAction: (): { step: string; href: string; message: string } => {
      if (!hasCampaign) {
        return { 
          step: 'Campaign', 
          href: '/campaigns', 
          message: 'Create your first campaign to get started' 
        };
      }
      if (!steps.brandIdentity) {
        return { 
          step: 'Brand Identity', 
          href: '/brand-vault', 
          message: 'Configure your brand identity' 
        };
      }
      if (!steps.brandAssets) {
        return { 
          step: 'Brand Assets', 
          href: '/brand-vault', 
          message: 'Upload at least one brand asset' 
        };
      }
      if (!steps.contentGenerated) {
        return { 
          step: 'Creative Director', 
          href: '/director', 
          message: 'Generate your first content' 
        };
      }
      if (!steps.contentApproved) {
        return { 
          step: 'Content Review', 
          href: '/review', 
          message: 'Approve your generated content' 
        };
      }
      if (!steps.videosReady) {
        return { 
          step: 'Videos', 
          href: '/videos', 
          message: 'Wait for video generation to complete' 
        };
      }
      if (!steps.variantsCreated) {
        return { 
          step: 'Distribution', 
          href: '/distribution', 
          message: 'Create platform variants' 
        };
      }
      return { 
        step: 'Publishing', 
        href: '/publishing', 
        message: 'Publish your content' 
      };
    },
  };
}

/**
 * Step definitions for UI display
 */
export const WORKFLOW_STEPS = [
  { number: 1, name: 'Campaigns', href: '/campaigns', icon: 'Megaphone' },
  { number: 2, name: 'Brand Vault', href: '/brand-vault', icon: 'Archive' },
  { number: 3, name: 'Creative Director', href: '/director', icon: 'Wand2' },
  { number: 4, name: 'Content Review', href: '/review', icon: 'FileText' },
  { number: 5, name: 'Videos', href: '/videos', icon: 'Video' },
  { number: 6, name: 'Distribution', href: '/distribution', icon: 'Share2' },
  { number: 7, name: 'Publishing', href: '/publishing', icon: 'Radio' },
] as const;
