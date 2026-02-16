-- =============================================================================
-- Migration: secure_data_isolation.sql
-- Description: Enable RLS and enforce strict owner-based access policies
-- =============================================================================
-- 1. BRANDS TABLE (Root of ownership)
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
-- Drop potential conflicting policies
DROP POLICY IF EXISTS "Users can view own brands" ON brands;
DROP POLICY IF EXISTS "Users can insert own brands" ON brands;
DROP POLICY IF EXISTS "Users can update own brands" ON brands;
DROP POLICY IF EXISTS "Users can delete own brands" ON brands;
DROP POLICY IF EXISTS "Allow authenticated users to view brands" ON brands;
CREATE POLICY "Users can view own brands" ON brands FOR
SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own brands" ON brands FOR
INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own brands" ON brands FOR
UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own brands" ON brands FOR DELETE USING (owner_id = auth.uid());
-- 2. CAMPAIGNS TABLE
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
-- Drop potential conflicting policies
DROP POLICY IF EXISTS "Users can view own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow authenticated users to view campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow authenticated users to insert campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow authenticated users to update campaigns" ON campaigns;
DROP POLICY IF EXISTS "Allow authenticated users to delete campaigns" ON campaigns;
DROP POLICY IF EXISTS "Service role full access campaigns" ON campaigns;
-- Service role has full access (for n8n workflows)
CREATE POLICY "Service role full access campaigns" ON campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
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
DROP POLICY IF EXISTS "Allow authenticated users to view briefs" ON creative_briefs;
CREATE POLICY "Users can view own briefs" ON creative_briefs FOR
SELECT USING (
        brand_id IN (
            SELECT id
            FROM brands
            WHERE owner_id = auth.uid()
        )
    );