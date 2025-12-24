-- =============================================
-- Performance Optimization Migration (safe)
-- Adds indexes for commonly queried columns, but only if columns exist
-- This avoids errors when your schema differs between projects/environments
-- =============================================

-- Helper: Use DO blocks that check information_schema before creating indexes

-- Campaigns table indexes
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
  ELSE
    RAISE NOTICE 'Skipping idx_campaigns_user_id: campaigns.user_id not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
  ELSE
    RAISE NOTICE 'Skipping idx_campaigns_status: campaigns.status not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
  ELSE
    RAISE NOTICE 'Skipping idx_campaigns_created_at: campaigns.created_at not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'user_id'
  ) AND EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_campaigns_user_status ON campaigns(user_id, status);
  ELSE
    RAISE NOTICE 'Skipping idx_campaigns_user_status: required columns not found on campaigns';
  END IF;
END
$$;

-- Videos table indexes
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'campaign_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_videos_campaign_id ON videos(campaign_id);
  ELSE
    RAISE NOTICE 'Skipping idx_videos_campaign_id: videos.campaign_id not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
  ELSE
    RAISE NOTICE 'Skipping idx_videos_status: videos.status not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
  ELSE
    RAISE NOTICE 'Skipping idx_videos_created_at: videos.created_at not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
  ELSE
    RAISE NOTICE 'Skipping idx_videos_user_id: videos.user_id not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'model_used'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_videos_model_used ON videos(model_used);
  ELSE
    RAISE NOTICE 'Skipping idx_videos_model_used: videos.model_used not found';
  END IF;
END
$$;

-- Scripts table indexes
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scripts' AND column_name = 'campaign_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_scripts_campaign_id ON scripts(campaign_id);
  ELSE
    RAISE NOTICE 'Skipping idx_scripts_campaign_id: scripts.campaign_id not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scripts' AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON scripts(created_at DESC);
  ELSE
    RAISE NOTICE 'Skipping idx_scripts_created_at: scripts.created_at not found';
  END IF;
END
$$;

-- Briefs table indexes
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'briefs' AND column_name = 'campaign_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_briefs_campaign_id ON briefs(campaign_id);
  ELSE
    RAISE NOTICE 'Skipping idx_briefs_campaign_id: briefs.campaign_id not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'briefs' AND column_name = 'brand_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_briefs_brand_id ON briefs(brand_id);
  ELSE
    RAISE NOTICE 'Skipping idx_briefs_brand_id: briefs.brand_id not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'briefs' AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_briefs_created_at ON briefs(created_at DESC);
  ELSE
    RAISE NOTICE 'Skipping idx_briefs_created_at: briefs.created_at not found';
  END IF;
END
$$;

-- Brands table indexes
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_brands_user_id ON brands(user_id);
  ELSE
    RAISE NOTICE 'Skipping idx_brands_user_id: brands.user_id not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_brands_created_at ON brands(created_at DESC);
  ELSE
    RAISE NOTICE 'Skipping idx_brands_created_at: brands.created_at not found';
  END IF;
END
$$;

-- Activity/Audit log indexes (if exists)
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_log' AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_log(user_id);
  ELSE
    RAISE NOTICE 'Skipping idx_activity_user_id: activity_log.user_id not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_log' AND column_name = 'activity_type'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(activity_type);
  ELSE
    RAISE NOTICE 'Skipping idx_activity_type: activity_log.activity_type not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'activity_log' AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at DESC);
  ELSE
    RAISE NOTICE 'Skipping idx_activity_created_at: activity_log.created_at not found';
  END IF;
END
$$;

-- Analytics data indexes (if exists)
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics' AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
  ELSE
    RAISE NOTICE 'Skipping idx_analytics_user_id: analytics.user_id not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics' AND column_name = 'platform'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_platform ON analytics(platform);
  ELSE
    RAISE NOTICE 'Skipping idx_analytics_platform: analytics.platform not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics' AND column_name = 'date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date DESC);
  ELSE
    RAISE NOTICE 'Skipping idx_analytics_date: analytics.date not found';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics' AND column_name = 'video_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_video_id ON analytics(video_id);
  ELSE
    RAISE NOTICE 'Skipping idx_analytics_video_id: analytics.video_id not found';
  END IF;
END
$$;

-- Composite indexes for common query patterns
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'user_id'
  ) AND EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'campaign_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_videos_user_campaign ON videos(user_id, campaign_id);
  ELSE
    RAISE NOTICE 'Skipping idx_videos_user_campaign: required columns not found on videos';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics' AND column_name = 'user_id'
  ) AND EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics' AND column_name = 'date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON analytics(user_id, date DESC);
  ELSE
    RAISE NOTICE 'Skipping idx_analytics_user_date: required columns not found on analytics';
  END IF;
END
$$;

-- =============================================
-- pgvector Performance (if using embeddings)
-- =============================================

-- Create HNSW index for faster similarity searches
-- Note: Replace 'embeddings' and 'embedding' with actual table/column names
-- DO $$
-- BEGIN
--   IF EXISTS(
--     SELECT 1 FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'embeddings' AND column_name = 'embedding'
--   ) THEN
--     EXECUTE 'CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw ON embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
--   ELSE
--     RAISE NOTICE 'Skipping idx_embeddings_hnsw: embeddings.embedding not found';
--   END IF;
-- END
-- $$;

-- Or IVFFlat for memory efficiency
-- CREATE INDEX IF NOT EXISTS idx_embeddings_ivfflat ON embeddings 
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- =============================================
-- Table statistics for query planner
-- =============================================

-- Analyze tables for better query plans (guarded)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaigns') THEN
    EXECUTE 'ANALYZE campaigns';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='videos') THEN
    EXECUTE 'ANALYZE videos';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='scripts') THEN
    EXECUTE 'ANALYZE scripts';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='briefs') THEN
    EXECUTE 'ANALYZE briefs';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='brands') THEN
    EXECUTE 'ANALYZE brands';
  END IF;
END
$$;
-- ANALYZE activity_log;
-- ANALYZE analytics;
