-- Run this SQL in Supabase Dashboard > SQL Editor
-- This expands the user_provider_keys CHECK constraint to include new providers
ALTER TABLE user_provider_keys DROP CONSTRAINT IF EXISTS user_provider_keys_provider_check;
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
-- Verify the constraint was updated
SELECT conname,
    pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'user_provider_keys'::regclass
    AND contype = 'c';