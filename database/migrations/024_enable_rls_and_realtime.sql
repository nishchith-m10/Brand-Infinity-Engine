-- Migration: Enable Row Level Security and Realtime
-- Description: Enable RLS policies and real-time subscriptions for all tables
-- Date: 2025-12-20

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ============================================================

-- Strategist Pillar Tables
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_briefs ENABLE ROW LEVEL SECURITY;

-- Copywriter Pillar Tables
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_versions ENABLE ROW LEVEL SECURITY;

-- Production Pillar Tables
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_assets ENABLE ROW LEVEL SECURITY;

-- Campaign Manager Pillar Tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_audit_log ENABLE ROW LEVEL SECURITY;

-- Broadcaster Pillar Tables
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_variants ENABLE ROW LEVEL SECURITY;

-- Assets Table
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CREATE RLS POLICIES FOR AUTHENTICATED USERS
-- ============================================================

-- Policy: Allow authenticated users to SELECT from all tables
CREATE POLICY "Allow authenticated users to view trends" ON trends FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view brand_guidelines" ON brand_guidelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view competitor_ads" ON competitor_ads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view creative_briefs" ON creative_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view scripts" ON scripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view hooks" ON hooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view scene_segments" ON scene_segments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view script_versions" ON script_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view videos" ON videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view scenes" ON scenes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view generation_jobs" ON generation_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view audio_assets" ON audio_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view campaigns" ON campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view variants" ON variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view campaign_assets" ON campaign_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view cost_ledger" ON cost_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view campaign_audit_log" ON campaign_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view publications" ON publications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view platform_posts" ON platform_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view engagement_metrics" ON engagement_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view scheduled_posts" ON scheduled_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view platform_variants" ON platform_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view assets" ON assets FOR SELECT TO authenticated USING (true);

-- Policy: Allow authenticated users to INSERT into all tables
CREATE POLICY "Allow authenticated users to insert trends" ON trends FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert brand_guidelines" ON brand_guidelines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert competitor_ads" ON competitor_ads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert creative_briefs" ON creative_briefs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert scripts" ON scripts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert hooks" ON hooks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert scene_segments" ON scene_segments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert script_versions" ON script_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert videos" ON videos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert scenes" ON scenes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert generation_jobs" ON generation_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert audio_assets" ON audio_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert campaigns" ON campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert variants" ON variants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert campaign_assets" ON campaign_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert cost_ledger" ON cost_ledger FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert campaign_audit_log" ON campaign_audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert publications" ON publications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert platform_posts" ON platform_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert engagement_metrics" ON engagement_metrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert scheduled_posts" ON scheduled_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert platform_variants" ON platform_variants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to insert assets" ON assets FOR INSERT TO authenticated WITH CHECK (true);

-- Policy: Allow authenticated users to UPDATE all tables
CREATE POLICY "Allow authenticated users to update trends" ON trends FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update brand_guidelines" ON brand_guidelines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update competitor_ads" ON competitor_ads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update creative_briefs" ON creative_briefs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update scripts" ON scripts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update hooks" ON hooks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update scene_segments" ON scene_segments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update script_versions" ON script_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update videos" ON videos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update scenes" ON scenes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update generation_jobs" ON generation_jobs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update audio_assets" ON audio_assets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update campaigns" ON campaigns FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update variants" ON variants FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update campaign_assets" ON campaign_assets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update cost_ledger" ON cost_ledger FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update campaign_audit_log" ON campaign_audit_log FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update publications" ON publications FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update platform_posts" ON platform_posts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update engagement_metrics" ON engagement_metrics FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update scheduled_posts" ON scheduled_posts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update platform_variants" ON platform_variants FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update assets" ON assets FOR UPDATE TO authenticated USING (true);

-- Policy: Allow authenticated users to DELETE from all tables
CREATE POLICY "Allow authenticated users to delete trends" ON trends FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete brand_guidelines" ON brand_guidelines FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete competitor_ads" ON competitor_ads FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete creative_briefs" ON creative_briefs FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete scripts" ON scripts FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete hooks" ON hooks FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete scene_segments" ON scene_segments FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete script_versions" ON script_versions FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete videos" ON videos FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete scenes" ON scenes FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete generation_jobs" ON generation_jobs FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete audio_assets" ON audio_assets FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete campaigns" ON campaigns FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete variants" ON variants FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete campaign_assets" ON campaign_assets FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete cost_ledger" ON cost_ledger FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete campaign_audit_log" ON campaign_audit_log FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete publications" ON publications FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete platform_posts" ON platform_posts FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete engagement_metrics" ON engagement_metrics FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete scheduled_posts" ON scheduled_posts FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete platform_variants" ON platform_variants FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete assets" ON assets FOR DELETE TO authenticated USING (true);

-- ============================================================
-- ENABLE REALTIME FOR CRITICAL TABLES
-- ============================================================

-- Enable realtime for tables that need live updates in the frontend
ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE videos;
ALTER PUBLICATION supabase_realtime ADD TABLE generation_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE engagement_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE platform_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE publications;
ALTER PUBLICATION supabase_realtime ADD TABLE creative_briefs;
ALTER PUBLICATION supabase_realtime ADD TABLE scripts;
ALTER PUBLICATION supabase_realtime ADD TABLE cost_ledger;
ALTER PUBLICATION supabase_realtime ADD TABLE campaign_audit_log;

-- Note: These tables are enabled for realtime because they represent
-- data that changes frequently and users need to see updates immediately:
-- - campaigns: Status changes, new campaigns
-- - videos: Generation progress, completion status
-- - generation_jobs: Job progress tracking
-- - engagement_metrics: Live social media metrics
-- - platform_posts: Publication status
-- - publications: Publishing progress
-- - creative_briefs: Brief generation status
-- - scripts: Script generation status
-- - cost_ledger: Real-time cost tracking
-- - campaign_audit_log: Live activity log
