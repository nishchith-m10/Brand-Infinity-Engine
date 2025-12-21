-- =============================================================================
-- Migration: 007_create_scene_segments_table.sql
-- Description: Create scene segments table for individual script scenes
-- Pillar: Copywriter (Creative Direction)
-- =============================================================================

CREATE TABLE IF NOT EXISTS scene_segments (
    scene_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES scripts(script_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL, -- Order in the script (1, 2, 3, ...)
    duration_seconds INTEGER NOT NULL,
    visual_prompt TEXT NOT NULL, -- Dense cinematic prompt for video generation
    voiceover_text TEXT NOT NULL,
    visual_cues JSONB NOT NULL, -- {style, color_palette, camera_movement, lighting}
    audio_cues JSONB, -- {music_style, sfx, voice_tone}
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scene_segments_script_id ON scene_segments(script_id);
CREATE INDEX IF NOT EXISTS idx_scene_segments_sequence ON scene_segments(script_id, sequence);

-- Unique constraint: one sequence number per script
CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_segments_unique_sequence 
ON scene_segments(script_id, sequence);

-- Check constraints
ALTER TABLE scene_segments 
ADD CONSTRAINT check_duration_seconds 
CHECK (duration_seconds >= 1 AND duration_seconds <= 10);

ALTER TABLE scene_segments 
ADD CONSTRAINT check_sequence_positive 
CHECK (sequence > 0);

-- Comments for documentation
COMMENT ON TABLE scene_segments IS 'Stores individual scene segments for each script';
COMMENT ON COLUMN scene_segments.sequence IS 'Scene order in the script (1-based index)';
COMMENT ON COLUMN scene_segments.visual_prompt IS 'Dense cinematic prompt for AI video generation';
COMMENT ON COLUMN scene_segments.visual_cues IS 'JSON with style, colors, camera, lighting directives';
COMMENT ON COLUMN scene_segments.audio_cues IS 'JSON with music, SFX, and voice tone specifications';
