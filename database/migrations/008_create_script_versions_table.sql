-- =============================================================================
-- Migration: 008_create_script_versions_table.sql
-- Description: Create script versions table for version control and audit trail
-- Pillar: Copywriter (Creative Direction)
-- =============================================================================

CREATE TABLE IF NOT EXISTS script_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES scripts(script_id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    script_data JSONB NOT NULL, -- Complete snapshot of the script at this version
    change_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    is_production BOOLEAN DEFAULT FALSE, -- Mark approved versions
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_script_versions_script_id ON script_versions(script_id);
CREATE INDEX IF NOT EXISTS idx_script_versions_version_number ON script_versions(script_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_script_versions_is_production ON script_versions(is_production);
CREATE INDEX IF NOT EXISTS idx_script_versions_created_at ON script_versions(created_at DESC);

-- Unique constraint: one version number per script
CREATE UNIQUE INDEX IF NOT EXISTS idx_script_versions_unique 
ON script_versions(script_id, version_number);

-- Check constraints
ALTER TABLE script_versions 
ADD CONSTRAINT check_version_number_positive 
CHECK (version_number > 0);

-- Comments for documentation
COMMENT ON TABLE script_versions IS 'Stores complete version history of scripts for audit and rollback';
COMMENT ON COLUMN script_versions.script_data IS 'Complete JSON snapshot of the script at this version';
COMMENT ON COLUMN script_versions.is_production IS 'Whether this version is approved and in use';
COMMENT ON COLUMN script_versions.change_summary IS 'Human-readable summary of changes in this version';
