-- Create embeddings table for RAG/pgvector
CREATE TABLE IF NOT EXISTS embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id text NOT NULL,
  content_type text NOT NULL,
  user_id text,
  embedding vector(1536), -- adjust dimension to your embedding model
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_unique_content ON embeddings(content_id, content_type);

-- Example HNSW index (requires pgvector hnsw extension support)
-- CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw ON embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Example RPC function (requires permission / supabase enable):
-- Create a PL/pgSQL function `match_embeddings(query_embedding vector, match_threshold float, match_count int, filter_content_type text)`
-- that returns content_id and similarity. Implementation depends on your pgvector version.

-- Note: After creating table and loading embeddings, consider creating a dedicated index with `hnsw` or `ivfflat` depending on scale.
