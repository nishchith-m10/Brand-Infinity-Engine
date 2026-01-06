-- =============================================================================
-- Budget Enforcement with Atomic Operations
-- Prevents race conditions in concurrent budget allocation
-- =============================================================================

-- Add budget tracking columns to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS budget_used DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_reserved DECIMAL(10,2) DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_budget ON campaigns(id, budget_used, budget_reserved, budget_limit_usd);

-- =============================================================================
-- reserve_budget: Atomically reserve budget for an operation
-- Returns campaign data if reservation succeeds, NULL if insufficient budget
-- =============================================================================
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
  -- Atomic update with budget check
  RETURN QUERY
  UPDATE campaigns
  SET budget_reserved = budget_reserved + p_amount
  WHERE campaigns.id = p_campaign_id
    AND (budget_used + budget_reserved + p_amount) <= budget_limit_usd
    AND deleted_at IS NULL
    AND status NOT IN ('archived', 'pending_deletion', 'cancelled')
  RETURNING 
    campaigns.id, 
    campaigns.budget_limit_usd, 
    campaigns.budget_used, 
    campaigns.budget_reserved,
    campaigns.status;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- update_actual_cost: Convert reserved budget to actual cost
-- Called after operation completes successfully
-- =============================================================================
CREATE OR REPLACE FUNCTION update_actual_cost(
  p_campaign_id UUID,
  p_reserved DECIMAL,
  p_actual DECIMAL
) RETURNS VOID AS $$
BEGIN
  UPDATE campaigns
  SET 
    budget_reserved = budget_reserved - p_reserved,
    budget_used = budget_used + p_actual
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- refund_budget: Release reserved budget (operation failed)
-- =============================================================================
CREATE OR REPLACE FUNCTION refund_budget(
  p_campaign_id UUID,
  p_amount DECIMAL
) RETURNS VOID AS $$
BEGIN
  UPDATE campaigns
  SET budget_reserved = budget_reserved - p_amount
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- get_available_budget: Check available budget without reservation
-- =============================================================================
CREATE OR REPLACE FUNCTION get_available_budget(
  p_campaign_id UUID
) RETURNS DECIMAL AS $$
DECLARE
  v_available DECIMAL;
BEGIN
  SELECT (budget_limit_usd - budget_used - budget_reserved)
  INTO v_available
  FROM campaigns
  WHERE id = p_campaign_id;
  
  RETURN COALESCE(v_available, 0);
END;
$$ LANGUAGE plpgsql;

-- Add helpful comment
COMMENT ON FUNCTION reserve_budget IS 'Atomically reserves budget for an operation. Returns NULL if insufficient budget or campaign not eligible.';
COMMENT ON FUNCTION update_actual_cost IS 'Converts reserved budget to actual cost after operation completes.';
COMMENT ON FUNCTION refund_budget IS 'Releases reserved budget if operation fails.';
COMMENT ON FUNCTION get_available_budget IS 'Returns available budget without making a reservation.';
