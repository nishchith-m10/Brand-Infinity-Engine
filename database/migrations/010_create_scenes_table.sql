-- =============================================================================
-- Migration: 010_create_scenes_table.sql
-- Description: Create scenes table for individual generated video clips
-- Pillar: Production House (Visual Synthesis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS scenes (
    scene_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(video_id) ON DELETE CASCADE,
    script_scene_id UUID REFERENCES scene_segments(scene_id),
    sequence INTEGER NOT NULL,
    clip_url TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    model_used TEXT NOT NULL, -- 'sora', 'veo3', 'seedream', 'nano_b'
    generation_job_id TEXT, -- External API job ID
    cost_usd NUMERIC(10, 2),
    quality_score NUMERIC(5, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scenes_video_id ON scenes(video_id);
CREATE INDEX IF NOT EXISTS idx_scenes_script_scene_id ON scenes(script_scene_id);
CREATE INDEX IF NOT EXISTS idx_scenes_sequence ON scenes(video_id, sequence);
CREATE INDEX IF NOT EXISTS idx_scenes_model_used ON scenes(model_used);
CREATE INDEX IF NOT EXISTS idx_scenes_cost ON scenes(cost_usd DESC);
CREATE INDEX IF NOT EXISTS idx_scenes_quality_score ON scenes(quality_score DESC);

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_scenes_unique_sequence 
ON scenes(video_id, sequence);

-- Check constraints
ALTER TABLE scenes 
ADD CONSTRAINT check_model_used 
CHECK (model_used IN ('sora', 'veo3', 'seedream', 'nano_b'));

ALTER TABLE scenes 
ADD CONSTRAINT check_cost_positive 
CHECK (cost_usd >= 0);

ALTER TABLE scenes 
ADD CONSTRAINT check_quality_score_scene 
CHECK (quality_score >= 0 AND quality_score <= 1);

ALTER TABLE scenes 
ADD CONSTRAINT check_sequence_positive_scene 
CHECK (sequence > 0);

-- Comments for documentation
COMMENT ON TABLE scenes IS 'Stores individual generated video clips (scenes) from video generation models';
COMMENT ON COLUMN scenes.model_used IS 'AI model used to generate this scene (sora, veo3, seedream, nano_b)';
COMMENT ON COLUMN scenes.generation_job_id IS 'External API job ID for tracking and polling';
COMMENT ON COLUMN scenes.cost_usd IS 'Cost in USD to generate this specific scene';
