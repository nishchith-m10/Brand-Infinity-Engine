/**
 * n8n Webhook Payload Types
 * 
 * These types define the expected payload structure for each n8n webhook.
 * Must match the webhook input expectations in the n8n workflows.
 */

export interface CampaignCreatePayload {
  campaign_id: string;
  brand_id: string;
  campaign_name: string;
  target_demographic?: string;
  campaign_objective?: string;
  budget_tier: 'low' | 'medium' | 'high' | 'premium';
  user_id?: string;
}

export interface BriefGeneratePayload {
  campaign_id: string;
  brand_id: string;
  product_category?: string;
  target_demographic?: string;
  campaign_objective?: string;
  additional_context?: string;
}

export interface ScriptGeneratePayload {
  campaign_id: string;
  brief_id: string;
  hook_count?: number;
  variant_tag?: 'aggressive' | 'balanced' | 'soft';
  target_duration?: number;
}

export interface VideoDispatchPayload {
  campaign_id: string;
  script_id: string;
  quality?: 'draft' | 'standard' | 'high' | 'premium';
  priority?: 'speed' | 'balanced' | 'quality';
}

export interface PublishPayload {
  campaign_id: string;
  video_id: string;
  variant_id?: string;
  platforms: string[];
  scheduled_time?: string;
  caption?: string;
  hashtags?: string[];
}

export interface ApprovalPayload {
  campaign_id: string;
  entity_type: 'brief' | 'script' | 'video';
  entity_id: string;
  action: 'approve' | 'reject';
  feedback?: string;
}

export interface DownloadPayload {
  job_id: string;
  campaign_id: string;
  result_url: string;
  provider: string;
}

// Workflow trigger action types
export type WorkflowAction = 
  | 'generate_brief'
  | 'generate_script'
  | 'generate_video'
  | 'publish'
  | 'approve'
  | 'reject';
