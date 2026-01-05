// =============================================================================
// COST ESTIMATOR - Phase 7
// Calculate estimated cost and time for content requests
// =============================================================================

import { RequestType, ProviderTier } from '@/types/pipeline';

export interface EstimateParams {
  type: RequestType;
  duration?: number;
  provider?: string;
  tier: ProviderTier;
  hasVoiceover: boolean;
  autoScript: boolean;
}

// Alias for backwards compatibility
export type EstimateInput = EstimateParams;

export interface CostEstimate {
  cost: number;
  timeSeconds: number;
  breakdown: {
    strategy: number;
    script: number;
    video: number;
    voice: number;
    qa: number;
  };
}

// Base costs by provider tier (in USD)
const PROVIDER_TIER_COSTS = {
  economy: {
    video_per_second: 0.05,
    voice_per_second: 0.01,
    strategy: 0.10,
    script: 0.15,
    qa: 0.05,
  },
  standard: {
    video_per_second: 0.10,
    voice_per_second: 0.02,
    strategy: 0.20,
    script: 0.25,
    qa: 0.10,
  },
  premium: {
    video_per_second: 0.20,
    voice_per_second: 0.04,
    strategy: 0.40,
    script: 0.50,
    qa: 0.20,
  },
};

// Base time estimates (in seconds)
const TIME_ESTIMATES = {
  strategy: 30,        // 30 seconds for strategy/research
  script: 45,          // 45 seconds for script generation
  video_per_second: 2, // 2 seconds of processing per 1 second of video
  voice_per_second: 1, // 1 second of processing per 1 second of voice
  qa: 15,              // 15 seconds for QA review
};

/**
 * Calculate cost and time estimate for a content request
 */
export function calculateEstimate(params: EstimateParams): CostEstimate {
  const tierCosts = PROVIDER_TIER_COSTS[params.tier];
  const duration = params.duration || 30; // Default 30 seconds

  // Calculate costs
  const strategyCost = params.autoScript ? tierCosts.strategy : 0;
  const scriptCost = params.autoScript ? tierCosts.script : 0;
  
  let videoCost = 0;
  if (params.type === 'video_with_vo' || params.type === 'video_no_vo') {
    videoCost = duration * tierCosts.video_per_second;
  } else if (params.type === 'image') {
    videoCost = tierCosts.video_per_second * 5; // Fixed cost for image
  }

  const voiceCost = params.hasVoiceover ? duration * tierCosts.voice_per_second : 0;
  const qaCost = tierCosts.qa;

  const totalCost = strategyCost + scriptCost + videoCost + voiceCost + qaCost;

  // Calculate time
  const strategyTime = params.autoScript ? TIME_ESTIMATES.strategy : 0;
  const scriptTime = params.autoScript ? TIME_ESTIMATES.script : 0;
  
  let videoTime = 0;
  if (params.type === 'video_with_vo' || params.type === 'video_no_vo') {
    videoTime = duration * TIME_ESTIMATES.video_per_second;
  } else if (params.type === 'image') {
    videoTime = TIME_ESTIMATES.video_per_second * 5;
  }

  const voiceTime = params.hasVoiceover ? duration * TIME_ESTIMATES.voice_per_second : 0;
  const qaTime = TIME_ESTIMATES.qa;

  const totalTime = strategyTime + scriptTime + videoTime + voiceTime + qaTime;

  return {
    cost: parseFloat(totalCost.toFixed(4)),
    timeSeconds: Math.round(totalTime),
    breakdown: {
      strategy: parseFloat(strategyCost.toFixed(4)),
      script: parseFloat(scriptCost.toFixed(4)),
      video: parseFloat(videoCost.toFixed(4)),
      voice: parseFloat(voiceCost.toFixed(4)),
      qa: parseFloat(qaCost.toFixed(4)),
    },
  };
}
