-- User Preferences Table for Smart Question Skipping
-- Part of Creative Director Enhancement Phase 3
-- Create the user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    default_platform TEXT,
    default_tone TEXT,
    default_content_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure one preference set per user per brand
    CONSTRAINT user_preferences_user_brand_unique UNIQUE (user_id, brand_id)
);
-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_brand_id ON user_preferences(brand_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_lookup ON user_preferences(user_id, brand_id);
-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
-- Policy: Users can only read/write their own preferences
CREATE POLICY "Users can view own preferences" ON user_preferences FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own preferences" ON user_preferences FOR DELETE USING (auth.uid() = user_id);
-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_user_preferences_updated_at BEFORE
UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_user_preferences_updated_at();
-- Comment for documentation
COMMENT ON TABLE user_preferences IS 'Stores user default preferences per brand for smart question skipping in Creative Director';