-- =============================================================================
-- Migration: 011_create_generation_jobs_table.sql
-- Description: Create generation jobs table for tracking async video generation
-- Pillar: Production House (Visual Synthesis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS generation_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES scenes(scene_id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    job_api_id TEXT, -- External API job ID
    status TEXT DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
    prompt TEXT NOT NULL,
    parameters JSONB, -- Model-specific parameters
    result_url TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cost_usd NUMERIC(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_generation_jobs_scene_id ON generation_jobs(scene_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_model_name ON generation_jobs(model_name);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at ON generation_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_api_id ON generation_jobs(job_api_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_generation_jobs_updated_at
    BEFORE UPDATE ON generation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check constraints
ALTER TABLE generation_jobs 
ADD CONSTRAINT check_status_generation 
CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'));

ALTER TABLE generation_jobs 
ADD CONSTRAINT check_retry_count 
CHECK (retry_count >= 0 AND retry_count <= max_retries);

-- Comments for documentation
COMMENT ON TABLE generation_jobs IS 'Tracks async video generation jobs for webhook polling';
COMMENT ON COLUMN generation_jobs.job_api_id IS 'External API job ID for polling generation status';
COMMENT ON COLUMN generation_jobs.status IS 'Current job status: queued, processing, completed, failed';
COMMENT ON COLUMN generation_jobs.retry_count IS 'Number of retry attempts made for this job';
