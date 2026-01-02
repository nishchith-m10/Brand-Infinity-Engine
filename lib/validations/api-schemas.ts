/**
 * Request Validation Schemas
 * Zod schemas for validating API request payloads
 */

import { z } from 'zod';

// Campaign validation schemas
export const CampaignCreateSchema = z.object({
  campaign_name: z.string().min(1).max(200),
  brand_id: z.string().uuid(),
  budget_limit_usd: z.number().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CampaignUpdateSchema = z.object({
  campaign_name: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived', 'pending_deletion']).optional(),
  budget_limit_usd: z.number().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
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
  parameters: z.record(z.unknown()).optional(),
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
