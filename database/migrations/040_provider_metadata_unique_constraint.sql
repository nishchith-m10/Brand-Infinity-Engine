/**
 * Migration 040: Provider Metadata Unique Constraint
 *
 * Purpose:
 * - Add unique constraint on provider_metadata to prevent duplicate entries
 * - Ensures each provider's external job ID is only stored once
 * - Prevents duplicate callbacks from creating multiple metadata records
 *
 * Impact:
 * - Makes provider_metadata.upsert() operations idempotent
 * - Protects against race conditions in callback handlers
 * - Enables safe retry logic without data duplication
 */

-- Create unique index on provider_metadata for external job IDs
-- This prevents the same provider job from being inserted multiple times
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_metadata_unique_job_id
  ON provider_metadata(provider_name, external_job_id)
  WHERE external_job_id IS NOT NULL;

COMMENT ON INDEX idx_provider_metadata_unique_job_id IS
  'Ensures each provider job ID is only stored once, preventing duplicate callbacks. ' ||
  'Enables idempotent upsert operations for n8n and other external providers.';

-- Add comment to provider_metadata table documenting the constraint
COMMENT ON TABLE provider_metadata IS
  'Stores metadata from external providers (n8n, Pollinations, etc). ' ||
  'UNIQUE constraint on (provider_name, external_job_id) ensures idempotent operations.';
