/**
 * SOP Library
 * Phase 5: MVP Hardening - Standard Operating Procedures
 * 
 * Purpose:
 * - Define deterministic workflows for different content types
 * - Replace ad-hoc agent decisions with validated procedures
 * - Enable consistent, repeatable execution
 */

import { z } from 'zod';
import type { SOP, SOPStep } from './types';

// =============================================================================
// Input/Output Schemas
// =============================================================================

/**
 * Common input schema for all content generation requests
 */
const BaseInputSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  brandId: z.string().optional(),
  tone: z.string().optional().default('professional'),
  targetAudience: z.string().optional().default('general'),
  platform: z.string().optional(),
  additionalContext: z.string().optional(),
});

/**
 * Video-specific input schema
 */
const VideoInputSchema = BaseInputSchema.extend({
  duration: z.number().min(5).max(180).optional().default(30),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional().default('9:16'),
  voiceId: z.string().optional(),
  style: z.string().optional().default('cinematic'),
});

/**
 * Image-specific input schema
 */
const ImageInputSchema = BaseInputSchema.extend({
  width: z.number().min(256).max(2048).optional().default(1024),
  height: z.number().min(256).max(2048).optional().default(1024),
  style: z.string().optional().default('photorealistic'),
  count: z.number().min(1).max(4).optional().default(1),
});

/**
 * Blog-specific input schema
 */
const BlogInputSchema = BaseInputSchema.extend({
  wordCount: z.number().min(100).max(5000).optional().default(1000),
  format: z.enum(['article', 'listicle', 'how-to', 'opinion']).optional().default('article'),
  seoKeywords: z.array(z.string()).optional(),
});

/**
 * Video output schema
 */
const VideoOutputSchema = z.object({
  video_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  duration_seconds: z.number(),
  resolution: z.string(),
  script: z.string(),
  strategy_brief: z.string(),
});

/**
 * Image output schema
 */
const ImageOutputSchema = z.object({
  image_urls: z.array(z.string().url()),
  concept: z.string(),
  strategy_brief: z.string(),
});

/**
 * Blog output schema
 */
const BlogOutputSchema = z.object({
  content: z.string(),
  title: z.string(),
  meta_description: z.string(),
  word_count: z.number(),
  strategy_brief: z.string(),
});

// =============================================================================
// SOP Step Definitions
// =============================================================================

/**
 * Common strategy step - creates campaign brief
 */
const createStrategyStep = (id: string): SOPStep => ({
  id,
  name: 'Strategic Planning',
  description: 'Create comprehensive campaign strategy and brief',
  agentRole: 'strategist',
  inputMapping: {
    prompt: 'input.prompt',
    tone: 'input.tone',
    targetAudience: 'input.targetAudience',
    platform: 'input.platform',
    brandContext: 'context.brandContext',
    kbContent: 'context.kbContent',
  },
  outputKey: 'strategy_brief',
  maxRetries: 2,
  timeoutMs: 60000,
});

/**
 * Video script writing step
 */
const createVideoScriptStep = (): SOPStep => ({
  id: 'script',
  name: 'Script Writing',
  description: 'Write engaging video script based on strategy',
  agentRole: 'copywriter',
  inputMapping: {
    strategyBrief: 'steps.strategy.output',
    duration: 'input.duration',
    tone: 'input.tone',
    voiceId: 'input.voiceId',
  },
  outputKey: 'script',
  maxRetries: 2,
  timeoutMs: 45000,
});

/**
 * Video production step (n8n)
 */
const createVideoProductionStep = (): SOPStep => ({
  id: 'production',
  name: 'Video Production',
  description: 'Generate video using n8n workflow',
  agentRole: 'producer',
  inputMapping: {
    script: 'steps.script.output',
    strategyBrief: 'steps.strategy.output',
    aspectRatio: 'input.aspectRatio',
    duration: 'input.duration',
    style: 'input.style',
    voiceId: 'input.voiceId',
  },
  outputKey: 'video',
  n8nWorkflowId: 'video-production', // Webhook path, not ID
  isAsync: false, // Changed to sync after our fix
  maxRetries: 1,
  timeoutMs: 300000, // 5 minutes for video generation
});

/**
 * Image concept step
 */
const createImageConceptStep = (): SOPStep => ({
  id: 'concept',
  name: 'Visual Concept',
  description: 'Create detailed visual concept and image prompt',
  agentRole: 'copywriter',
  inputMapping: {
    strategyBrief: 'steps.strategy.output',
    style: 'input.style',
    platform: 'input.platform',
  },
  outputKey: 'concept',
  maxRetries: 2,
  timeoutMs: 30000,
});

/**
 * Image production step
 */
const createImageProductionStep = (): SOPStep => ({
  id: 'production',
  name: 'Image Generation',
  description: 'Generate images using n8n workflow',
  agentRole: 'producer',
  inputMapping: {
    concept: 'steps.concept.output',
    width: 'input.width',
    height: 'input.height',
    count: 'input.count',
    style: 'input.style',
  },
  outputKey: 'images',
  n8nWorkflowId: 'image-production',
  isAsync: false,
  maxRetries: 2,
  timeoutMs: 120000,
});

/**
 * Blog content writing step
 */
const createBlogWritingStep = (): SOPStep => ({
  id: 'writing',
  name: 'Content Writing',
  description: 'Write comprehensive blog content',
  agentRole: 'copywriter',
  inputMapping: {
    strategyBrief: 'steps.strategy.output',
    format: 'input.format',
    wordCount: 'input.wordCount',
    seoKeywords: 'input.seoKeywords',
  },
  outputKey: 'content',
  maxRetries: 2,
  timeoutMs: 90000,
});

// =============================================================================
// SOP Definitions
// =============================================================================

/**
 * VIDEO_PRO_V1: Professional Video Production
 * 
 * Flow: Strategy -> Script -> Production
 * 
 * Use case: Social media videos, promotional content, educational videos
 */
export const VIDEO_PRO_V1: SOP = {
  id: 'VIDEO_PRO_V1',
  name: 'Professional Video Production',
  description: 'Complete video production pipeline from strategy to final video',
  version: '1.0.0',
  
  steps: [
    createStrategyStep('strategy'),
    createVideoScriptStep(),
    createVideoProductionStep(),
  ],
  
  inputSchema: VideoInputSchema,
  outputSchema: VideoOutputSchema,
  
  recommendedTier: 'standard',
  estimatedDurationMs: 180000, // 3 minutes
  estimatedCostUsd: { min: 0.05, max: 0.50 },
  
  tags: ['video', 'social-media', 'marketing'],
  createdAt: '2026-01-17T00:00:00Z',
  updatedAt: '2026-01-17T00:00:00Z',
};

/**
 * IMAGE_GEN_V1: Image Generation
 * 
 * Flow: Strategy -> Concept -> Production
 * 
 * Use case: Social media images, thumbnails, promotional graphics
 */
export const IMAGE_GEN_V1: SOP = {
  id: 'IMAGE_GEN_V1',
  name: 'Image Generation',
  description: 'Complete image generation pipeline from strategy to rendered images',
  version: '1.0.0',
  
  steps: [
    createStrategyStep('strategy'),
    createImageConceptStep(),
    createImageProductionStep(),
  ],
  
  inputSchema: ImageInputSchema,
  outputSchema: ImageOutputSchema,
  
  recommendedTier: 'eco',
  estimatedDurationMs: 60000, // 1 minute
  estimatedCostUsd: { min: 0.01, max: 0.10 },
  
  tags: ['image', 'graphics', 'social-media'],
  createdAt: '2026-01-17T00:00:00Z',
  updatedAt: '2026-01-17T00:00:00Z',
};

/**
 * BLOG_POST_V1: Blog Post Generation
 * 
 * Flow: Strategy -> Writing
 * 
 * Use case: Blog articles, thought leadership, SEO content
 */
export const BLOG_POST_V1: SOP = {
  id: 'BLOG_POST_V1',
  name: 'Blog Post Generation',
  description: 'Complete blog post creation from strategy to polished content',
  version: '1.0.0',
  
  steps: [
    createStrategyStep('strategy'),
    createBlogWritingStep(),
  ],
  
  inputSchema: BlogInputSchema,
  outputSchema: BlogOutputSchema,
  
  recommendedTier: 'standard',
  estimatedDurationMs: 90000, // 1.5 minutes
  estimatedCostUsd: { min: 0.02, max: 0.20 },
  
  tags: ['blog', 'content', 'seo'],
  createdAt: '2026-01-17T00:00:00Z',
  updatedAt: '2026-01-17T00:00:00Z',
};

// =============================================================================
// SOP Registry
// =============================================================================

/**
 * Registry of all available SOPs
 */
export const SOP_REGISTRY: Record<string, SOP> = {
  VIDEO_PRO_V1,
  IMAGE_GEN_V1,
  BLOG_POST_V1,
};

/**
 * Get SOP by ID
 */
export function getSOP(id: string): SOP | undefined {
  return SOP_REGISTRY[id];
}

/**
 * Get all SOPs
 */
export function getAllSOPs(): SOP[] {
  return Object.values(SOP_REGISTRY);
}

/**
 * Find SOPs matching criteria
 */
export function findSOPs(criteria: {
  tags?: string[];
  recommendedTier?: string;
}): SOP[] {
  return getAllSOPs().filter(sop => {
    if (criteria.tags && !criteria.tags.some(tag => sop.tags.includes(tag))) {
      return false;
    }
    if (criteria.recommendedTier && sop.recommendedTier !== criteria.recommendedTier) {
      return false;
    }
    return true;
  });
}
