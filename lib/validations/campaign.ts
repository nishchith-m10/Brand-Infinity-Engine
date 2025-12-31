import { z } from 'zod';

export const CreateCampaignSchema = z.object({
  campaign_name: z.string().min(1, 'Campaign name is required').max(100),
  brand_id: z.string().uuid('Invalid Brand ID'),
  budget_tier: z.enum(['low', 'medium', 'high', 'premium']).optional().default('medium'),
  campaign_objective: z.string().optional(),
  target_demographic: z.string().optional(),
  auto_start: z.boolean().optional().default(false),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
