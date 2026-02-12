/**
 * Request Validation Schemas
 * Zod schemas for validating API request payloads
 */

import { z } from 'zod';

// =============================================================================
// Reusable Validators
// =============================================================================

export const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });
export const urlSchema = z.string().url({ message: 'Must be a valid URL' }).max(2048);
export const positiveNumberSchema = z.number().positive({ message: 'Must be a positive number' });

// =============================================================================
// Campaign validation schemas
// =============================================================================

export const CampaignCreateSchema = z.object({
  campaign_name: z.string().min(1, 'Campaign name is required').max(255),
  brand_id: uuidSchema,
  budget_tier: z.enum(['low', 'medium', 'high', 'premium']).default('medium'),
  budget_limit_usd: z.number().min(0).max(10000).optional(),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const CampaignUpdateSchema = z.object({
  campaign_name: z.string().min(1).max(255).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived', 'pending_deletion']).optional(),
  budget_limit_usd: z.number().min(0).max(10000).optional(),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided for update'
});

// Director chat validation
export const DirectorChatSchema = z.object({
  session_id: z.string().uuid(),
  message: z.string().min(1).max(10000),
  provider: z.string().optional(),
  model_id: z.string().optional(),
  openrouter_api_key: z.string().optional(),
  system_prompt: z.string().max(5000).optional(),
  context: z.object({
    campaign_id: z.string().uuid().optional(),
    campaign_name: z.string().optional(),
    kb_ids: z.array(z.string().uuid()).optional(),
    identity: z.object({
      brand_name: z.string().optional(),
      brand_voice: z.string().optional(),
      tagline: z.string().optional(),
      target_audience: z.string().optional(),
      tone_style: z.string().optional(),
    }).nullable().optional(),
  }).optional(),
});

// Image generation validation
export const ImageGenerationSchema = z.object({
  prompt: z.string().min(1).max(4000),
  model: z.enum(['dalle-3', 'nanob']).default('dalle-3'),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']).default('1024x1024'),
  quality: z.enum(['standard', 'hd']).default('standard'),
  style: z.enum(['vivid', 'natural']).optional(),
  campaign_id: z.string().uuid().optional(),
  brand_id: z.string().uuid().optional(),
  use_brand_context: z.boolean().default(true),
});

// Pipeline generation validation
export const PipelineGenerationSchema = z.object({
  campaign_id: z.string().uuid(),
  workflow_type: z.enum(['brief', 'script', 'video', 'full_pipeline']),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

// Helper function to validate and return errors
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// =============================================================================
// Brand Identity Schemas
// =============================================================================

export const SaveBrandIdentitySchema = z.object({
  campaign_id: uuidSchema.optional(),
  brand_name: z.string().min(1).max(255).optional(),
  brand_voice: z.string().min(10).max(5000).optional(),
  tagline: z.string().max(500).optional(),
  mission_statement: z.string().max(2000).optional(),
  target_audience: z.string().max(1000).optional(),
  tone_style: z.enum(['professional', 'casual', 'friendly', 'authoritative', 'playful', 'empathetic']).optional(),
  personality_traits: z.array(z.string().max(100)).max(10).optional(),
  content_pillars: z.array(z.string().max(200)).max(5).optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional(),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional(),
}).refine(data => {
  const hasData = Object.entries(data).some(([key, value]) => key !== 'campaign_id' && value !== undefined);
  return hasData;
}, {
  message: 'At least one identity field must be provided'
});

// =============================================================================
// Retry Schemas
// =============================================================================

export const RetryRequestSchema = z.object({
  task_ids: z.array(uuidSchema).min(1).max(50).optional(),
  force: z.boolean().default(false),
});

export const RetryTaskSchema = z.object({
  force: z.boolean().default(false),
  reason: z.string().max(500).optional(),
});

// =============================================================================
// Conversation Schemas
// =============================================================================

export const StartConversationSchema = z.object({
  brand_id: uuidSchema,
  campaign_id: uuidSchema.optional(),
  initial_message: z.string().min(1, 'Initial message required').max(10000),
  context: z.object({
    kb_ids: z.array(uuidSchema).optional(),
    identity_mode: z.enum(['isolated', 'shared', 'inherited']).optional(),
  }).optional(),
});

export const ContinueConversationSchema = z.object({
  message: z.string().min(1).max(10000),
  answers: z.record(z.string(), z.unknown()).optional(),
  provider: z.string().optional(),
  model_id: z.string().optional(),
});

// =============================================================================
// Knowledge Base Schemas
// =============================================================================

export const CreateKnowledgeBaseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional(),
  brand_id: uuidSchema,
  campaign_id: uuidSchema.optional(),
  type: z.enum(['text', 'url', 'file']).default('text'),
  content: z.string().max(100000).optional(),
}).refine(data => {
  if (data.type === 'text') {
    return data.content && data.content.length > 0;
  }
  return true;
}, {
  message: 'Content is required for text knowledge bases',
  path: ['content'],
});

export const UpdateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  content: z.string().max(100000).optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided for update'
});

// =============================================================================
// Brand Assets Schemas
// =============================================================================

export const CreateBrandAssetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  type: z.enum(['image', 'video', 'audio', 'document', 'other']),
  url: urlSchema,
  brand_id: uuidSchema,
  file_size: positiveNumberSchema.max(524288000).optional(), // Max 500MB
  mime_type: z.string().max(100).optional(),
  width: positiveNumberSchema.optional(),
  height: positiveNumberSchema.optional(),
});

export const UpdateBrandAssetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided for update'
});

// =============================================================================
// Approval/Rejection Schemas
// =============================================================================

export const ApproveResourceSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const RejectResourceSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
  notes: z.string().max(2000).optional(),
});

// =============================================================================
// Workflow Trigger Schemas
// =============================================================================

export const TriggerWorkflowSchema = z.object({
  stage: z.enum(['brief', 'script', 'video', 'publish']),
  force: z.boolean().default(false),
  config: z.object({
    provider: z.string().optional(),
    tier: z.enum(['economy', 'standard', 'premium']).optional(),
  }).optional(),
});

// =============================================================================
// Trend Refresh Schema
// =============================================================================

export const RefreshTrendsSchema = z.object({
  platforms: z.array(z.enum(['youtube', 'tiktok', 'instagram', 'twitter', 'linkedin'])).min(1).max(5).optional(),
  region: z.string().max(10).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// =============================================================================
// Orchestrator Process Schema
// =============================================================================

export const ProcessOrchestrationSchema = z.object({
  request_id: uuidSchema,
  action: z.enum(['start', 'pause', 'resume', 'cancel']),
  force: z.boolean().default(false),
  reason: z.string().max(500).optional(),
}).refine(data => {
  if (['pause', 'resume', 'cancel'].includes(data.action)) {
    return data.reason && data.reason.length > 0;
  }
  return true;
}, {
  message: 'Reason is required for pause/resume/cancel actions',
  path: ['reason'],
});

// =============================================================================
// Platform Variant Schemas
// =============================================================================

export const PlatformEnum = z.enum([
  'youtube',
  'tiktok',
  'instagram',
  'twitter',
  'linkedin',
  'facebook',
]);

export const CreateVariantSchema = z.object({
  video_id: uuidSchema,
  platforms: z.array(PlatformEnum).min(1, 'At least one platform is required').max(10),
});

// =============================================================================
// Platform Publication Schemas
// =============================================================================

export const CreatePublicationSchema = z.object({
  variant_id: uuidSchema,
  scheduled_time: z.string().datetime({ message: 'Invalid ISO 8601 datetime format' }).refine(
    (val) => {
      const date = new Date(val);
      const now = new Date();
      // Scheduled time must be at least 5 minutes in the future
      return date.getTime() > now.getTime() + (5 * 60 * 1000);
    },
    { message: 'Scheduled time must be at least 5 minutes in the future' }
  ),
  platform: PlatformEnum.optional(),
  caption: z.string().max(5000).optional(),
  hashtags: z.array(z.string().max(100)).max(30).optional(),
}).refine(data => {
  // If hashtags provided, ensure they start with #
  if (data.hashtags && data.hashtags.length > 0) {
    return data.hashtags.every(tag => tag.startsWith('#'));
  }
  return true;
}, {
  message: 'All hashtags must start with #',
  path: ['hashtags'],
});
