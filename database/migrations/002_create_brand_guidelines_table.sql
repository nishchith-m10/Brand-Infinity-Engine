-- =============================================================================
-- Migration: 002_create_brand_guidelines_table.sql
-- Description: Create brand guidelines table for storing brand voice, style, and restrictions
-- Pillar: Strategist (Market Intelligence)
-- =============================================================================

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS brand_guidelines (
    guideline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL,
    content TEXT NOT NULL, -- The actual guideline text
    category TEXT NOT NULL, -- 'tone', 'visual_style', 'restrictions', 'voice', 'color_palette'
    embedding VECTOR(1536), -- OpenAI embedding dimension (ada-002)
    priority INTEGER DEFAULT 1, -- Higher priority guidelines checked first
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    metadata JSONB -- Additional structured data
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_brand_id ON brand_guidelines(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_category ON brand_guidelines(category);
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_is_active ON brand_guidelines(is_active);
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_priority ON brand_guidelines(priority DESC);

-- Vector similarity search index (HNSW - Hierarchical Navigable Small World)
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_embedding ON brand_guidelines 
USING hnsw (embedding vector_cosine_ops);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_brand_guidelines_updated_at
    BEFORE UPDATE ON brand_guidelines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE brand_guidelines IS 'Stores brand guidelines with vector embeddings for RAG retrieval';
COMMENT ON COLUMN brand_guidelines.embedding IS 'Vector embedding for semantic similarity search';
COMMENT ON COLUMN brand_guidelines.category IS 'Type of guideline: tone, visual_style, restrictions, etc.';
COMMENT ON COLUMN brand_guidelines.priority IS 'Priority for guideline enforcement (higher = more important)';
