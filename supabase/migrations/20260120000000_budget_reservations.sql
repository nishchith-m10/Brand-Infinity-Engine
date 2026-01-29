-- Migration: Budget Reservations Table
-- Purpose: Prevent budget race conditions by atomically reserving budget before operations
-- Phase: II-2 from phase_execution_plan.md

-- Create budget_reservations table
CREATE TABLE IF NOT EXISTS budget_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  request_id UUID REFERENCES content_requests(id) ON DELETE SET NULL,
  amount_usd NUMERIC(10, 2) NOT NULL CHECK (amount_usd >= 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'converted', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_budget_reservations_campaign_status 
  ON budget_reservations(campaign_id, status) 
  WHERE status = 'reserved';

CREATE INDEX IF NOT EXISTS idx_budget_reservations_request 
  ON budget_reservations(request_id);

CREATE INDEX IF NOT EXISTS idx_budget_reservations_created 
  ON budget_reservations(created_at) 
  WHERE status = 'reserved';

-- Create atomic budget reservation function
CREATE OR REPLACE FUNCTION reserve_campaign_budget(
  p_campaign_id UUID,
  p_request_id UUID,
  p_amount NUMERIC
) RETURNS JSON AS $$
DECLARE
  v_limit NUMERIC;
  v_spent NUMERIC;
  v_reserved NUMERIC;
  v_available NUMERIC;
  v_reservation_id UUID;
BEGIN
  -- Lock the campaign row to prevent concurrent modifications
  SELECT budget_limit INTO v_limit
  FROM campaigns
  WHERE id = p_campaign_id
    AND deleted_at IS NULL
  FOR UPDATE;

  -- Return error if campaign not found or deleted
  IF v_limit IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Campaign not found or deleted',
      'error_code', 'CAMPAIGN_NOT_FOUND'
    );
  END IF;

  -- Calculate current actual spend from cost_ledger
  SELECT COALESCE(SUM(cost_usd), 0) INTO v_spent
  FROM cost_ledger
  WHERE campaign_id = p_campaign_id;

  -- Calculate pending budget reservations (not yet converted or released)
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_reserved
  FROM budget_reservations
  WHERE campaign_id = p_campaign_id
    AND status = 'reserved';

  -- Calculate available budget
  v_available := v_limit - v_spent - v_reserved;

  -- Check if requested amount can be reserved
  IF v_available >= p_amount THEN
    -- Create reservation
    INSERT INTO budget_reservations (campaign_id, request_id, amount_usd, status)
    VALUES (p_campaign_id, p_request_id, p_amount, 'reserved')
    RETURNING id INTO v_reservation_id;

    RETURN json_build_object(
      'success', true,
      'reservation_id', v_reservation_id,
      'reserved_amount', p_amount,
      'available_before', v_available,
      'available_after', v_available - p_amount,
      'total_limit', v_limit,
      'total_spent', v_spent,
      'total_reserved', v_reserved + p_amount
    );
  ELSE
    -- Insufficient budget
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient budget',
      'error_code', 'BUDGET_EXCEEDED',
      'requested', p_amount,
      'available', v_available,
      'total_limit', v_limit,
      'total_spent', v_spent,
      'total_reserved', v_reserved
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to convert reservation to actual cost
CREATE OR REPLACE FUNCTION convert_budget_reservation(
  p_reservation_id UUID,
  p_actual_cost NUMERIC
) RETURNS JSON AS $$
DECLARE
  v_reservation budget_reservations%ROWTYPE;
  v_campaign_id UUID;
BEGIN
  -- Get and lock reservation
  SELECT * INTO v_reservation
  FROM budget_reservations
  WHERE id = p_reservation_id
    AND status = 'reserved'
  FOR UPDATE;

  -- Return error if reservation not found or already processed
  IF v_reservation.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Reservation not found or already processed',
      'error_code', 'INVALID_RESERVATION'
    );
  END IF;

  -- Mark reservation as converted
  UPDATE budget_reservations
  SET status = 'converted',
      resolved_at = NOW(),
      metadata = jsonb_build_object('actual_cost', p_actual_cost)
  WHERE id = p_reservation_id;

  -- Log actual cost to cost_ledger
  INSERT INTO cost_ledger (
    campaign_id,
    request_id,
    operation_type,
    cost_usd,
    metadata
  ) VALUES (
    v_reservation.campaign_id,
    v_reservation.request_id,
    'content_generation',
    p_actual_cost,
    jsonb_build_object(
      'reservation_id', p_reservation_id,
      'reserved_amount', v_reservation.amount_usd
    )
  );

  RETURN json_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'reserved_amount', v_reservation.amount_usd,
    'actual_cost', p_actual_cost,
    'difference', v_reservation.amount_usd - p_actual_cost
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to release reservation (operation failed or cancelled)
CREATE OR REPLACE FUNCTION release_budget_reservation(
  p_reservation_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_reservation budget_reservations%ROWTYPE;
BEGIN
  -- Get and lock reservation
  SELECT * INTO v_reservation
  FROM budget_reservations
  WHERE id = p_reservation_id
    AND status = 'reserved'
  FOR UPDATE;

  -- Return error if reservation not found or already processed
  IF v_reservation.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Reservation not found or already processed',
      'error_code', 'INVALID_RESERVATION'
    );
  END IF;

  -- Mark reservation as released
  UPDATE budget_reservations
  SET status = 'released',
      resolved_at = NOW(),
      metadata = CASE 
        WHEN p_reason IS NOT NULL 
        THEN jsonb_build_object('release_reason', p_reason)
        ELSE metadata
      END
  WHERE id = p_reservation_id;

  RETURN json_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'released_amount', v_reservation.amount_usd,
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql;

-- Create cleanup function for stale reservations (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_stale_budget_reservations()
RETURNS JSON AS $$
DECLARE
  v_stale_count INTEGER;
BEGIN
  -- Release reservations older than 1 hour that are still in 'reserved' status
  WITH released AS (
    UPDATE budget_reservations
    SET status = 'released',
        resolved_at = NOW(),
        metadata = metadata || jsonb_build_object('release_reason', 'auto_cleanup_stale')
    WHERE status = 'reserved'
      AND created_at < NOW() - INTERVAL '1 hour'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_stale_count FROM released;

  RETURN json_build_object(
    'success', true,
    'cleaned_count', v_stale_count,
    'cleaned_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies
ALTER TABLE budget_reservations ENABLE ROW LEVEL SECURITY;

-- Users can only see reservations for their own campaigns
CREATE POLICY budget_reservations_select_policy ON budget_reservations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = budget_reservations.campaign_id
        AND campaigns.user_id = auth.uid()
        AND (campaigns.deleted_at IS NULL OR campaigns.deleted_at > NOW())
    )
  );

-- Only system/service role can insert/update reservations
CREATE POLICY budget_reservations_insert_policy ON budget_reservations
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY budget_reservations_update_policy ON budget_reservations
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE budget_reservations IS 'Atomic budget reservations to prevent race conditions when multiple operations attempt to use budget simultaneously';
COMMENT ON FUNCTION reserve_campaign_budget IS 'Atomically reserve budget for a campaign operation. Returns success=false if insufficient budget available.';
COMMENT ON FUNCTION convert_budget_reservation IS 'Convert a budget reservation to actual cost after operation completes successfully';
COMMENT ON FUNCTION release_budget_reservation IS 'Release a budget reservation when operation fails or is cancelled';
COMMENT ON FUNCTION cleanup_stale_budget_reservations IS 'Cleanup function to release reservations older than 1 hour (should be run periodically)';
