-- =============================================================================
-- Migration: 020_create_scheduled_posts_table.sql
-- Description: Create scheduled posts table for managing post scheduling
-- Pillar: Broadcaster (Distribution & Formatting)
-- =============================================================================

CREATE TABLE IF NOT EXISTS scheduled_posts (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_post_id UUID REFERENCES platform_posts(post_id) ON DELETE CASCADE,
    scheduled_time TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'published', 'cancelled', 'failed'
    published_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform_post_id ON scheduled_posts(platform_post_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_time ON scheduled_posts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_scheduled_posts_updated_at
    BEFORE UPDATE ON scheduled_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check constraints
ALTER TABLE scheduled_posts 
ADD CONSTRAINT check_status_scheduled 
CHECK (status IN ('pending', 'published', 'cancelled', 'failed'));

ALTER TABLE scheduled_posts 
ADD CONSTRAINT check_scheduled_time_future 
CHECK (scheduled_time > created_at);

-- Comments for documentation
COMMENT ON TABLE scheduled_posts IS 'Manages scheduled publication times for platform posts';
COMMENT ON COLUMN scheduled_posts.scheduled_time IS 'When the post should be published';
COMMENT ON COLUMN scheduled_posts.status IS 'Scheduling status: pending, published, cancelled, failed';
