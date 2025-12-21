-- =============================================================================
-- Migration: 009_create_videos_table.sql
-- Description: Create videos table for storing generated video assets
-- Pillar: Production House (Visual Synthesis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS videos (
    video_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES scripts(script_id) ON DELETE CASCADE,
    master_mp4_url TEXT NOT NULL,
    master_duration_seconds INTEGER NOT NULL,
    quality_score NUMERIC(5, 2), -- 0.00-1.00 AI-generated quality score
    total_cost_usd NUMERIC(10, 2),
    approval_status TEXT DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_script_id ON videos(script_id);
CREATE INDEX IF NOT EXISTS idx_videos_approval_status ON videos(approval_status);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_quality_score ON videos(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_videos_total_cost ON videos(total_cost_usd DESC);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check constraints
ALTER TABLE videos 
ADD CONSTRAINT check_quality_score_video 
CHECK (quality_score >= 0 AND quality_score <= 1);

ALTER TABLE videos 
ADD CONSTRAINT check_approval_status_video 
CHECK (approval_status IN ('pending', 'approved', 'rejected', 'regeneration_requested'));

ALTER TABLE videos 
ADD CONSTRAINT check_total_cost_positive 
CHECK (total_cost_usd >= 0);

-- Comments for documentation
COMMENT ON TABLE videos IS 'Stores generated video assets from the Production House pillar';
COMMENT ON COLUMN videos.master_mp4_url IS 'S3/Drive URL to the final assembled video file';
COMMENT ON COLUMN videos.quality_score IS 'AI-generated quality assessment score (0.00-1.00)';
COMMENT ON COLUMN videos.total_cost_usd IS 'Total cost in USD for generating this video (all scenes combined)';
