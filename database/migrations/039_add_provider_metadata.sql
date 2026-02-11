-- Migration: Add provider_metadata column to generation_jobs
-- Purpose: Store provider-specific metadata for video generation jobs
-- Date: 2026-01-03
-- Add provider_metadata column to store Pollo AI task_id, model, credits, etc.
ALTER TABLE generation_jobs
ADD COLUMN IF NOT EXISTS provider_metadata JSONB DEFAULT '{}';
-- Add index for querying by provider
CREATE INDEX IF NOT EXISTS idx_generation_jobs_provider ON generation_jobs(provider);
-- Add index for querying by status
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status);
-- Comment on new column
COMMENT ON COLUMN generation_jobs.provider_metadata IS 'Provider-specific metadata. For Pollo AI: {model, credits_used, aspect_ratio}. For Runway: {mode, credits}';