-- =============================================================================
-- Migration: 021_create_engagement_metrics_table.sql
-- Description: Create engagement metrics table for time-series performance tracking
-- Pillar: Broadcaster (Distribution & Formatting)
-- =============================================================================

CREATE TABLE IF NOT EXISTS engagement_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_post_id UUID REFERENCES platform_posts(post_id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL, -- 'views', 'likes', 'shares', 'comments', 'conversions', 'click_through'
    value INTEGER DEFAULT 0,
    recorded_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_post_id ON engagement_metrics(platform_post_id);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_type ON engagement_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_recorded_at ON engagement_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_composite ON engagement_metrics(platform_post_id, metric_type, recorded_at DESC);

-- Check constraints
ALTER TABLE engagement_metrics 
ADD CONSTRAINT check_metric_type 
CHECK (metric_type IN ('views', 'likes', 'shares', 'comments', 'saves', 'conversions', 'click_through', 'reach', 'impressions'));

ALTER TABLE engagement_metrics 
ADD CONSTRAINT check_value_non_negative 
CHECK (value >= 0);

-- Function to calculate engagement rate
CREATE OR REPLACE FUNCTION calculate_engagement_rate(post_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    total_engagement NUMERIC;
    total_views NUMERIC;
BEGIN
    SELECT COALESCE(SUM(value), 0) INTO total_engagement
    FROM engagement_metrics
    WHERE platform_post_id = post_id 
    AND metric_type IN ('likes', 'shares', 'comments');
    
    SELECT COALESCE(SUM(value), 1) INTO total_views
    FROM engagement_metrics
    WHERE platform_post_id = post_id 
    AND metric_type = 'views';
    
    RETURN ROUND((total_engagement::NUMERIC / total_views::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE engagement_metrics IS 'Time-series engagement metrics for platform posts';
COMMENT ON COLUMN engagement_metrics.metric_type IS 'Type of engagement metric being tracked';
COMMENT ON COLUMN engagement_metrics.value IS 'Metric value at the time of recording';
COMMENT ON COLUMN engagement_metrics.recorded_at IS 'Timestamp when this metric was recorded';

-- View for aggregated platform performance
CREATE OR REPLACE VIEW platform_performance_summary AS
SELECT 
    pp.platform,
    COUNT(DISTINCT pp.post_id) as total_posts,
    SUM(CASE WHEN em.metric_type = 'views' THEN em.value ELSE 0 END) as total_views,
    SUM(CASE WHEN em.metric_type = 'likes' THEN em.value ELSE 0 END) as total_likes,
    SUM(CASE WHEN em.metric_type = 'shares' THEN em.value ELSE 0 END) as total_shares,
    SUM(CASE WHEN em.metric_type = 'comments' THEN em.value ELSE 0 END) as total_comments,
    ROUND(AVG(calculate_engagement_rate(pp.post_id)), 2) as avg_engagement_rate
FROM platform_posts pp
LEFT JOIN engagement_metrics em ON pp.post_id = em.platform_post_id
WHERE pp.publication_status = 'published'
GROUP BY pp.platform;

COMMENT ON VIEW platform_performance_summary IS 'Aggregated performance metrics per platform';
