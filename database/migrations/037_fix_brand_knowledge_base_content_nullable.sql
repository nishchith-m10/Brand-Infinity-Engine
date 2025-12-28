-- Migration: 037_fix_brand_knowledge_base_content_nullable.sql
-- Description: Make content column nullable to support file-based assets
-- Date: 2025-12-27

-- Make content nullable since brand_knowledge_base is being used for both text content and file assets
ALTER TABLE brand_knowledge_base
ALTER COLUMN content DROP NOT NULL;

-- Add comment to clarify usage
COMMENT ON COLUMN brand_knowledge_base.content IS 'Text content for text-based knowledge. NULL for file-based assets (use file_url instead).';
