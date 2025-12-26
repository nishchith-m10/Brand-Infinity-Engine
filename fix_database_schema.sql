-- Run this SQL in your Supabase SQL Editor to fix the schema issues
-- 1. Fix for Campaign Deletion Error (500)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
-- 2. Fix for Review System (Briefs, Scripts, Videos)
-- Ensure approval columns exist for 'creative_briefs'
ALTER TABLE creative_briefs
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE creative_briefs
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE creative_briefs
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE creative_briefs
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
-- Ensure approval columns exist for 'scripts'
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
-- Ensure approval columns exist for 'generation_jobs' (Videos)
ALTER TABLE generation_jobs
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE generation_jobs
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE generation_jobs
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE generation_jobs
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;