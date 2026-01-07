-- Migration: Create user_provider_keys table for encrypted per-user API keys
-- Purpose: Store encrypted provider API keys (OpenAI, Anthropic, etc.) per user
-- Security: Server-side encryption with SUPABASE_PROVIDER_KEYS_SECRET

BEGIN;

-- Create user_provider_keys table
CREATE TABLE IF NOT EXISTS user_provider_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'deepseek', 'elevenlabs', 'midjourney', 'other')),
  encrypted_key text NOT NULL,
  key_version int NOT NULL DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, provider)
);

-- Index for faster lookups
CREATE INDEX idx_user_provider_keys_user_id ON user_provider_keys(user_id);
CREATE INDEX idx_user_provider_keys_provider ON user_provider_keys(provider);

-- RLS: Enable row-level security
ALTER TABLE user_provider_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view/manage their own keys
CREATE POLICY "Users can view own provider keys"
  ON user_provider_keys
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own provider keys"
  ON user_provider_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own provider keys"
  ON user_provider_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own provider keys"
  ON user_provider_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all keys (for admin/rotation operations)
CREATE POLICY "Service role full access"
  ON user_provider_keys
  FOR ALL
  USING (auth.role() = 'service_role');

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_provider_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_provider_keys_updated_at
  BEFORE UPDATE ON user_provider_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_user_provider_keys_updated_at();

COMMIT;
