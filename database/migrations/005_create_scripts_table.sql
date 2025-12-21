-- =============================================================================
-- Migration: 005_create_scripts_table.sql
-- Description: Create scripts table for storing generated marketing scripts
-- Pillar: Copywriter (Creative Direction)
-- =============================================================================

CREATE TABLE IF NOT EXISTS scripts (
    script_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id UUID REFERENCES creative_briefs(brief_id) ON DELETE CASCADE,
    hook JSONB NOT NULL, -- {text, hook_type, quality_score, variations_generated, selected_rationale}
    scenes JSONB NOT NULL, -- Array of scene objects
    voiceover_full_text TEXT NOT NULL,
    total_duration_seconds INTEGER NOT NULL,
    variant_tag TEXT, -- 'humorous', 'serious', 'emotional', 'educational'
    brand_compliance_score NUMERIC(5, 2), -- 0.00-1.00
    approval_status TEXT DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scripts_brief_id ON scripts(brief_id);
CREATE INDEX IF NOT EXISTS idx_scripts_approval_status ON scripts(approval_status);
CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON scripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scripts_brand_compliance ON scripts(brand_compliance_score DESC);
CREATE INDEX IF NOT EXISTS idx_scripts_variant_tag ON scripts(variant_tag);
CREATE INDEX IF NOT EXISTS idx_scripts_version ON scripts(version);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_scripts_updated_at
    BEFORE UPDATE ON scripts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Check constraints
ALTER TABLE scripts 
ADD CONSTRAINT check_brand_compliance_score 
CHECK (brand_compliance_score >= 0 AND brand_compliance_score <= 1);

ALTER TABLE scripts 
ADD CONSTRAINT check_approval_status_script
CHECK (approval_status IN ('pending', 'approved', 'rejected', 'revision_requested'));

ALTER TABLE scripts 
ADD CONSTRAINT check_total_duration 
CHECK (total_duration_seconds >= 15 AND total_duration_seconds <= 60);

-- Comments for documentation
COMMENT ON TABLE scripts IS 'Stores generated marketing scripts from the Copywriter pillar';
COMMENT ON COLUMN scripts.hook IS 'JSON object containing the hook, type, quality score, and selection rationale';
COMMENT ON COLUMN scripts.scenes IS 'Array of scene objects with visual prompts, voiceover, and cues';
COMMENT ON COLUMN scripts.brand_compliance_score IS 'Brand guideline compliance score (0.00-1.00)';
