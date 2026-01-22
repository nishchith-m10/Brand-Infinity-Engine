-- =============================================================================
-- Migration: fix_campaigns_user_id.sql
-- Description: Add missing user_id column to campaigns table
-- Fixes: Critical schema mismatch identified in audit
-- =============================================================================
-- Add user_id column if it doesn't exist
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
-- Update RLS policy to include user_id check
-- Drop existing policies first if needed
DROP POLICY IF EXISTS "Users can view own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON campaigns;
-- Create new RLS policies with user_id
CREATE POLICY "Users can view own campaigns" ON campaigns FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own campaigns" ON campaigns FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON campaigns FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON campaigns FOR DELETE USING (auth.uid() = user_id);
-- Comment for documentation
COMMENT ON COLUMN campaigns.user_id IS 'Owner user ID for RLS policy enforcement';