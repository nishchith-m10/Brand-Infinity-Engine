-- Migration: Expand provider types for user_provider_keys
-- Purpose: Add video providers (runway, pika, kling, pollo, sora) and social platforms (instagram, tiktok, youtube, linkedin)
-- Note: The CHECK constraint must be updated to allow new provider values
BEGIN;
-- Drop existing constraint
ALTER TABLE user_provider_keys DROP CONSTRAINT IF EXISTS user_provider_keys_provider_check;
-- Add updated constraint with all provider types
ALTER TABLE user_provider_keys
ADD CONSTRAINT user_provider_keys_provider_check CHECK (
        provider IN (
            -- LLM Providers
            'openai',
            'anthropic',
            'deepseek',
            'gemini',
            'openrouter',
            'kimi',
            -- Voice Providers
            'elevenlabs',
            -- Image Providers
            'midjourney',
            'dalle',
            -- Video Providers
            'runway',
            'pika',
            'pollo',
            'kling',
            'sora',
            -- Social Platforms
            'instagram',
            'tiktok',
            'youtube',
            'linkedin',
            -- Catch-all
            'other'
        )
    );
COMMIT;