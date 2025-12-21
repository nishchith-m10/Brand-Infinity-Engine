-- =============================================================================
-- Migration: 012_create_audio_assets_table.sql
-- Description: Create audio assets table for TTS, music, and SFX
-- Pillar: Production House (Visual Synthesis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audio_assets (
    audio_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(video_id) ON DELETE CASCADE,
    voiceover_url TEXT,
    background_music_url TEXT,
    sfx_urls TEXT[], -- Array of sound effect URLs
    synced_audio_url TEXT, -- Final mixed and synced audio
    voiceover_provider TEXT, -- 'elevenlabs', 'openai_tts', etc.
    voice_id TEXT,
    music_style TEXT,
    total_duration_seconds INTEGER,
    cost_usd NUMERIC(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audio_assets_video_id ON audio_assets(video_id);
CREATE INDEX IF NOT EXISTS idx_audio_assets_voiceover_provider ON audio_assets(voiceover_provider);
CREATE INDEX IF NOT EXISTS idx_audio_assets_created_at ON audio_assets(created_at DESC);

-- Check constraints
ALTER TABLE audio_assets 
ADD CONSTRAINT check_cost_positive_audio 
CHECK (cost_usd >= 0);

-- Comments for documentation
COMMENT ON TABLE audio_assets IS 'Stores all audio components for videos (voiceover, music, SFX)';
COMMENT ON COLUMN audio_assets.voiceover_url IS 'URL to generated TTS voiceover file';
COMMENT ON COLUMN audio_assets.background_music_url IS 'URL to background music track';
COMMENT ON COLUMN audio_assets.sfx_urls IS 'Array of URLs to sound effect files';
COMMENT ON COLUMN audio_assets.synced_audio_url IS 'URL to final mixed and synced audio file';
