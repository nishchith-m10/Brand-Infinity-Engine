-- =============================================================================
-- Migration: 006_create_hooks_table.sql
-- Description: Create hooks table for storing all generated hook variations
-- Pillar: Copywriter (Creative Direction)
-- =============================================================================

CREATE TABLE IF NOT EXISTS hooks (
    hook_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES scripts(script_id) ON DELETE CASCADE,
    hook_text TEXT NOT NULL,
    hook_type TEXT, -- 'question', 'statement', 'visual_shock', 'story', 'curiosity_gap'
    quality_score NUMERIC(5, 2), -- 0.00-1.00 AI-generated quality score
    variation_number INTEGER NOT NULL, -- 1-50
    selected BOOLEAN DEFAULT FALSE,
    selection_reason TEXT,
    psychological_patterns JSONB, -- {curiosity_gap, emotional_resonance, pattern_interrupt, shareability}
    generated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hooks_script_id ON hooks(script_id);
CREATE INDEX IF NOT EXISTS idx_hooks_quality_score ON hooks(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_hooks_selected ON hooks(selected);
CREATE INDEX IF NOT EXISTS idx_hooks_hook_type ON hooks(hook_type);
CREATE INDEX IF NOT EXISTS idx_hooks_variation_number ON hooks(variation_number);

-- Check constraints
ALTER TABLE hooks 
ADD CONSTRAINT check_quality_score_hook 
CHECK (quality_score >= 0 AND quality_score <= 1);

ALTER TABLE hooks 
ADD CONSTRAINT check_variation_number 
CHECK (variation_number >= 1 AND variation_number <= 100);

-- Comments for documentation
COMMENT ON TABLE hooks IS 'Stores all generated hook variations for scripts (typically 50 per script)';
COMMENT ON COLUMN hooks.quality_score IS 'AI-generated quality score based on psychological persuasion patterns';
COMMENT ON COLUMN hooks.selected IS 'Whether this hook was selected for the final script';
COMMENT ON COLUMN hooks.psychological_patterns IS 'JSON scores for different persuasion techniques';
