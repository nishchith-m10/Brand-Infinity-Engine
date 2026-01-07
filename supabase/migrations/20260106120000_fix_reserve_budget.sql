-- Migration: Fix reserve_budget function to avoid ambiguous column references
CREATE OR REPLACE FUNCTION reserve_budget(
  p_campaign_id UUID,
  p_amount DECIMAL
) RETURNS TABLE(
  id UUID,
  budget_limit_usd DECIMAL,
  budget_used DECIMAL,
  budget_reserved DECIMAL,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  UPDATE campaigns
  SET budget_reserved = campaigns.budget_reserved + p_amount
  WHERE campaigns.id = p_campaign_id
    AND (campaigns.budget_used + campaigns.budget_reserved + p_amount) <= campaigns.budget_limit_usd
    AND campaigns.deleted_at IS NULL
    AND campaigns.status NOT IN ('archived', 'pending_deletion', 'cancelled')
  RETURNING
    campaigns.id,
    campaigns.budget_limit_usd,
    campaigns.budget_used,
    campaigns.budget_reserved,
    campaigns.status;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reserve_budget IS 'Atomically reserves budget for an operation. Returns NULL if insufficient budget or campaign not eligible.';
