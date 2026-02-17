-- =============================================================================
-- Migration: secure_data_isolation.sql
-- Description: Enable RLS and enforce strict owner-based access policies
-- =============================================================================
-- 1. BRANDS TABLE (Root of ownership)
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own brands" ON brands;
DROP POLICY IF EXISTS "Users can insert own brands" ON brands;
DROP POLICY IF EXISTS "Users can update own brands" ON brands;
DROP POLICY IF EXISTS "Users can delete own brands" ON brands;
CREATE POLICY "Users can view own brands" ON brands FOR
SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own brands" ON brands FOR
INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own brands" ON brands FOR
UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own brands" ON brands FOR DELETE USING (owner_id = auth.uid());
-- 2. CAMPAIGNS TABLE
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON campaigns;
-- Allow access if user_id matches OR if they own the linked brand
CREATE POLICY "Users can view own campaigns" ON campaigns FOR
SELECT USING (
        user_id = auth.uid()
        OR brand_id IN (
            SELECT id
            FROM brands
            WHERE owner_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert own campaigns" ON campaigns FOR
INSERT WITH CHECK (
        user_id = auth.uid()
        OR brand_id IN (
            SELECT id
            FROM brands
            WHERE owner_id = auth.uid()
        )
    );
CREATE POLICY "Users can update own campaigns" ON campaigns FOR
UPDATE USING (
        user_id = auth.uid()
        OR brand_id IN (
            SELECT id
            FROM brands
            WHERE owner_id = auth.uid()
        )
    );
CREATE POLICY "Users can delete own campaigns" ON campaigns FOR DELETE USING (
    user_id = auth.uid()
    OR brand_id IN (
        SELECT id
        FROM brands
        WHERE owner_id = auth.uid()
    )
);
-- 3. CREATIVE BRIEFS (Linked via brand_id)
ALTER TABLE creative_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own briefs" ON creative_briefs;
CREATE POLICY "Users can view own briefs" ON creative_briefs FOR
SELECT USING (
        brand_id IN (
            SELECT id
            FROM brands
            WHERE owner_id = auth.uid()
        )
    );
-- 4. VIDEOS (Linked deep via script -> brief -> brand)
-- Simplifying for performance: Check via script_id exists
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own videos" ON videos;
CREATE POLICY "Users can view own videos" ON videos FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM scripts s
                JOIN creative_briefs cb ON s.brief_id = cb.brief_id
                JOIN brands b ON cb.brand_id = b.id
            WHERE s.script_id = videos.script_id
                AND b.owner_id = auth.uid()
        )
    );