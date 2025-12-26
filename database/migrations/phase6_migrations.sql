-- Phase 6 Database Migrations (Fixed for Existing Table)
-- Run in Supabase SQL Editor
-- ============================================
-- STEP 1: Enable pgvector extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;
-- ============================================
-- STEP 2: Create or update brand_knowledge_base table
-- ============================================
-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS brand_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID,
    file_url TEXT,
    file_name TEXT,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add missing columns if table already exists
DO $$ BEGIN -- Add asset_type if missing
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'brand_knowledge_base'
        AND column_name = 'asset_type'
) THEN
ALTER TABLE brand_knowledge_base
ADD COLUMN asset_type TEXT DEFAULT 'other';
END IF;
-- Add embedding if missing
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'brand_knowledge_base'
        AND column_name = 'embedding'
) THEN
ALTER TABLE brand_knowledge_base
ADD COLUMN embedding VECTOR(1536);
END IF;
-- Add is_active if missing
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'brand_knowledge_base'
        AND column_name = 'is_active'
) THEN
ALTER TABLE brand_knowledge_base
ADD COLUMN is_active BOOLEAN DEFAULT true;
END IF;
END $$;
-- Add constraint (only if column exists now)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.check_constraints
    WHERE constraint_name = 'brand_knowledge_base_asset_type_check'
) THEN
ALTER TABLE brand_knowledge_base
ADD CONSTRAINT brand_knowledge_base_asset_type_check CHECK (
        asset_type IN (
            'logo',
            'product',
            'guideline',
            'color',
            'font',
            'other'
        )
    );
END IF;
EXCEPTION
WHEN OTHERS THEN -- Constraint might already exist
NULL;
END $$;
-- Create indexes
CREATE INDEX IF NOT EXISTS idx_brand_kb_brand_id ON brand_knowledge_base(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_kb_active ON brand_knowledge_base(is_active);
-- ============================================
-- STEP 3: Add job_type to production/generation jobs
-- ============================================
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'production_jobs'
) THEN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'production_jobs'
        AND column_name = 'job_type'
) THEN
ALTER TABLE production_jobs
ADD COLUMN job_type TEXT DEFAULT 'video';
END IF;
END IF;
IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'generation_jobs'
) THEN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'generation_jobs'
        AND column_name = 'job_type'
) THEN
ALTER TABLE generation_jobs
ADD COLUMN job_type TEXT DEFAULT 'video';
END IF;
END IF;
END $$;
-- ============================================
-- STEP 4: Add feedback columns
-- ============================================
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'creative_briefs'
) THEN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'creative_briefs'
        AND column_name = 'rejection_feedback'
) THEN
ALTER TABLE creative_briefs
ADD COLUMN rejection_feedback TEXT;
END IF;
END IF;
IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'scripts'
) THEN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'scripts'
        AND column_name = 'rejection_feedback'
) THEN
ALTER TABLE scripts
ADD COLUMN rejection_feedback TEXT;
END IF;
END IF;
IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'generation_jobs'
) THEN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'generation_jobs'
        AND column_name = 'rejection_feedback'
) THEN
ALTER TABLE generation_jobs
ADD COLUMN rejection_feedback TEXT;
END IF;
END IF;
END $$;
-- ============================================
-- STEP 5: Create match_brand_assets function
-- ============================================
CREATE OR REPLACE FUNCTION match_brand_assets(
        query_embedding VECTOR(1536),
        match_threshold FLOAT,
        match_count INT,
        p_brand_id UUID
    ) RETURNS TABLE (
        id UUID,
        asset_type TEXT,
        file_name TEXT,
        file_url TEXT,
        metadata JSONB,
        similarity FLOAT
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT bkb.id,
    bkb.asset_type,
    bkb.file_name,
    bkb.file_url,
    bkb.metadata,
    1 - (bkb.embedding <=> query_embedding) AS similarity
FROM brand_knowledge_base bkb
WHERE bkb.brand_id = p_brand_id
    AND bkb.is_active = true
    AND bkb.embedding IS NOT NULL
    AND 1 - (bkb.embedding <=> query_embedding) > match_threshold
ORDER BY bkb.embedding <=> query_embedding
LIMIT match_count;
END;
$$;
-- ============================================
-- VERIFY
-- ============================================
SELECT 'Phase 6 migrations complete!' AS status;