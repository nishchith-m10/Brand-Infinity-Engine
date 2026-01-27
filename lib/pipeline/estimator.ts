// =============================================================================
// COST ESTIMATOR - Phase 7
// Calculate estimated cost and time for content requests
// =============================================================================

import { RequestType, ProviderTier } from '@/types/pipeline';

export interface EstimateParams {
  type: RequestType | 'text' | 'carousel';
  duration?: number;
  provider?: string;
  tier: ProviderTier;
  hasVoiceover: boolean;
  autoScript: boolean;
  slideCount?: number;
}

// Alias for backwards compatibility
export type EstimateInput = EstimateParams;

export interface CostEstimate {
  cost: number;
  timeSeconds: number;
  breakdown: Array<{ component: string; cost: number }>;
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

  // Adjust QA cost for text requests (text does not incur the same QA overhead)
  const qaCostAdjusted = params.type === 'text' ? 0 : qaCost;
  const totalCost = strategyCost + scriptCost + videoCost + voiceCost + qaCostAdjusted;

  // Calculate time
  const strategyTime = params.autoScript ? TIME_ESTIMATES.strategy : 0;
  const scriptTime = params.autoScript ? TIME_ESTIMATES.script : 0;
  
  let videoTime = 0;
  if (params.type === 'video_with_vo' || params.type === 'video_no_vo') {
    videoTime = duration * TIME_ESTIMATES.video_per_second;
  } else if (params.type === 'image') {
    videoTime = TIME_ESTIMATES.video_per_second * 5;
  } else if (params.type === 'carousel') {
    const slides = params.slideCount ?? 5;
    videoTime = slides * 2; // quick per-slide processing time
  } else if (params.type === 'text') {
    videoTime = 5; // tiny processing time
  }

  const voiceTime = params.hasVoiceover ? duration * TIME_ESTIMATES.voice_per_second : 0;
  // For text we don't include QA cost (text is quick)
  const qaTime = params.type === 'text' ? 0 : TIME_ESTIMATES.qa;

  const totalTime = strategyTime + scriptTime + videoTime + voiceTime + qaTime;

  // Build breakdown as an array of components (tests expect array)
  const breakdown: Array<{ component: string; cost: number }> = [];
  if (strategyCost > 0) breakdown.push({ component: 'strategy', cost: parseFloat(strategyCost.toFixed(4)) });
  if (scriptCost > 0) breakdown.push({ component: 'script generation', cost: parseFloat(scriptCost.toFixed(4)) });

  // Additional non-video components (image, carousel, text)
  let extraCost = 0;
  if (params.type === 'image') {
    breakdown.push({ component: 'image generation', cost: parseFloat(videoCost.toFixed(4)) });
    extraCost = videoCost;
  } else if (params.type === 'carousel') {
    const slides = params.slideCount ?? 5;
    const slideCost = (tierCosts.video_per_second || 0) * 1 * slides * 0.1;
    breakdown.push({ component: 'carousel generation', cost: parseFloat(slideCost.toFixed(4)) });
    extraCost = slideCost;
  } else if (params.type === 'text') {
    const textCost = 0.05; // minimal fixed cost for text
    breakdown.push({ component: 'text generation', cost: parseFloat(textCost.toFixed(4)) });
    extraCost = textCost;
  } else {
    // video types
    breakdown.push({ component: 'video generation', cost: parseFloat(videoCost.toFixed(4)) });
    extraCost = videoCost;
  }

  if (params.hasVoiceover && voiceCost > 0) breakdown.push({ component: 'voiceover', cost: parseFloat(voiceCost.toFixed(4)) });

  if (qaCostAdjusted > 0) breakdown.push({ component: 'qa', cost: parseFloat(qaCostAdjusted.toFixed(4)) });

  const finalCost = totalCost + (extraCost - videoCost); // ensure extraCost is included (videoCost is part of totalCost for video types)

  return {
    cost: parseFloat(finalCost.toFixed(4)),
    timeSeconds: Math.round(totalTime),
    breakdown,
  };
}
