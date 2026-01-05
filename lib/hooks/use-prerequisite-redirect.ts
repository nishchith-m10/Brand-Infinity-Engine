"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCampaignProgress } from "@/lib/hooks/use-campaign-progress";

/**
 * Hook that redirects to the appropriate page if prerequisites aren't met.
 * Use this in pages that require certain steps to be completed.
 */
export function usePrerequisiteRedirect(requiredStep: 
  | 'brandVault'
  | 'director'
  | 'review'
  | 'videos'
  | 'distribution'
  | 'publishing'
) {
  const router = useRouter();
  const { 
    canAccessDirector, 
    canAccessReview, 
    canAccessVideos, 
    canAccessDistribution, 
    canAccessPublishing,
    isLoading,
    steps 
  } = useCampaignProgress();

  useEffect(() => {
    if (isLoading) return;

    const redirectMap: Record<string, { canAccess: boolean; fallback: string }> = {
      brandVault: {
        canAccess: true, // Brand Vault is always accessible
        fallback: '/campaigns',
      },
      director: {
        canAccess: canAccessDirector,
        fallback: '/brand-vault',
      },
      review: {
        canAccess: canAccessReview,
        fallback: '/director',
      },
      videos: {
        canAccess: canAccessVideos,
        fallback: '/review',
      },
      distribution: {
        canAccess: canAccessDistribution,
        fallback: '/videos',
      },
      publishing: {
        canAccess: canAccessPublishing,
        fallback: '/distribution',
      },
    };

    const config = redirectMap[requiredStep];
    if (config && !config.canAccess) {
      router.replace(config.fallback);
    }
  }, [requiredStep, canAccessDirector, canAccessReview, canAccessVideos, canAccessDistribution, canAccessPublishing, isLoading, router, steps]);

  return { isLoading };
}
