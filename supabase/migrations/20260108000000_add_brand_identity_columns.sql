-- Add missing columns to brand_identity table
-- These fields are used in the Brand Vault UI

ALTER TABLE brand_identity 
ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
ADD COLUMN IF NOT EXISTS audience_age_range VARCHAR(100),
ADD COLUMN IF NOT EXISTS audience_pain_points TEXT,
ADD COLUMN IF NOT EXISTS key_messages TEXT,
ADD COLUMN IF NOT EXISTS avoid_topics TEXT,
ADD COLUMN IF NOT EXISTS competitors TEXT,
ADD COLUMN IF NOT EXISTS unique_value TEXT;

-- Add comment to document the table
COMMENT ON TABLE brand_identity IS 'Stores brand identity information including voice, personality, visual identity, and content strategy';

-- Add column comments for clarity
COMMENT ON COLUMN brand_identity.industry IS 'Industry or business category (e.g., Technology, Healthcare, Education)';
COMMENT ON COLUMN brand_identity.audience_age_range IS 'Target audience age range (e.g., 25-55 years)';
COMMENT ON COLUMN brand_identity.audience_pain_points IS 'Key pain points and challenges of the target audience';
COMMENT ON COLUMN brand_identity.key_messages IS 'Core messages to communicate consistently';
COMMENT ON COLUMN brand_identity.avoid_topics IS 'Topics and themes to avoid in content';
COMMENT ON COLUMN brand_identity.competitors IS 'List of competitors and competitive landscape';
COMMENT ON COLUMN brand_identity.unique_value IS 'Unique value proposition that differentiates from competitors';
