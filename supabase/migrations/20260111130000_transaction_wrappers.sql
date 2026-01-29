-- =============================================================================
-- Phase III, Pillar 1: Transaction Wrapping for Atomic Operations
-- =============================================================================
-- This migration creates database RPC functions that wrap multi-step operations
-- in transactions to prevent partial failures and data inconsistency.
--
-- Created: 2026-01-11
-- Issue: Multi-operation workflows lack transaction boundaries
-- Impact: Prevents orphaned requests, missing events, stuck budget reservations
-- =============================================================================

-- =============================================================================
-- Helper Function: Resolve Task Dependencies
-- =============================================================================
-- Maps dependency agent_roles to actual task IDs after tasks are created
CREATE OR REPLACE FUNCTION resolve_task_dependencies(
  p_request_id UUID,
  p_task_templates JSONB
) RETURNS VOID AS $$
DECLARE
  v_task RECORD;
  v_dependency_role TEXT;
  v_dependency_id UUID;
  v_dependency_ids UUID[];
BEGIN
  -- For each task, resolve its dependencies
  FOR v_task IN 
    SELECT id, agent_role, task_name
    FROM request_tasks
    WHERE request_id = p_request_id
  LOOP
    -- Get dependency roles from template
    SELECT jsonb_array_elements_text(
      (
        SELECT value->'dependencies'
        FROM jsonb_array_elements(p_task_templates) AS value
        WHERE value->>'agent_role' = v_task.agent_role
        LIMIT 1
      )
    ) INTO v_dependency_role;

    -- Find task IDs for those roles
    v_dependency_ids := ARRAY(
      SELECT rt.id
      FROM request_tasks rt
      INNER JOIN jsonb_array_elements(p_task_templates) AS template
        ON rt.agent_role = template->>'agent_role'
      WHERE rt.request_id = p_request_id
        AND rt.agent_role = ANY(
          SELECT jsonb_array_elements_text(
            (
              SELECT value->'dependencies'
              FROM jsonb_array_elements(p_task_templates) AS value
              WHERE value->>'agent_role' = v_task.agent_role
              LIMIT 1
            )
          )
        )
    );

    -- Update the task with resolved dependencies
    IF array_length(v_dependency_ids, 1) > 0 THEN
      UPDATE request_tasks
      SET depends_on = v_dependency_ids
      WHERE id = v_task.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RPC Function 1: Create Request with Tasks (Atomic)
-- =============================================================================
-- Creates a content request, its tasks, and initial event in a single transaction.
-- If any step fails, the entire operation is rolled back.
--
-- Parameters:
--   p_request_data: JSONB containing request fields (brand_id, title, etc.)
--   p_task_templates: JSONB array of task templates
--   p_user_id: UUID of the user creating the request
--
-- Returns:
--   JSONB with success flag, request data, and error message (if any)
-- =============================================================================
CREATE OR REPLACE FUNCTION create_request_with_tasks(
  p_request_data JSONB,
  p_task_templates JSONB,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_request_id UUID;
  v_request RECORD;
  v_task JSONB;
  v_task_count INT := 0;
BEGIN
  -- Validate required fields
  IF p_request_data->>'brand_id' IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'brand_id is required'
    );
  END IF;

  -- Step 1: Insert content request
  INSERT INTO content_requests (
    brand_id,
    campaign_id,
    title,
    request_type,
    status,
    prompt,
    duration_seconds,
    aspect_ratio,
    style_preset,
    shot_type,
    voice_id,
    preferred_provider,
    provider_tier,
    auto_script,
    script_text,
    selected_kb_ids,
    selected_asset_ids,
    estimated_cost,
    estimated_time_seconds,
    created_by
  ) VALUES (
    (p_request_data->>'brand_id')::UUID,
    CASE WHEN p_request_data->>'campaign_id' IS NOT NULL 
      THEN (p_request_data->>'campaign_id')::UUID 
      ELSE NULL END,
    p_request_data->>'title',
    p_request_data->>'request_type',
    COALESCE(p_request_data->>'status', 'intake'),
    p_request_data->>'prompt',
    CASE WHEN p_request_data->>'duration_seconds' IS NOT NULL 
      THEN (p_request_data->>'duration_seconds')::INT 
      ELSE NULL END,
    COALESCE(p_request_data->>'aspect_ratio', '16:9'),
    COALESCE(p_request_data->>'style_preset', 'Realistic'),
    COALESCE(p_request_data->>'shot_type', 'Medium'),
    p_request_data->>'voice_id',
    p_request_data->>'preferred_provider',
    COALESCE(p_request_data->>'provider_tier', 'standard'),
    COALESCE((p_request_data->>'auto_script')::BOOLEAN, true),
    p_request_data->>'script_text',
    COALESCE(p_request_data->'selected_kb_ids', '[]'::jsonb),
    COALESCE(p_request_data->'selected_asset_ids', '[]'::jsonb),
    CASE WHEN p_request_data->>'estimated_cost' IS NOT NULL 
      THEN (p_request_data->>'estimated_cost')::NUMERIC 
      ELSE 0 END,
    CASE WHEN p_request_data->>'estimated_time_seconds' IS NOT NULL 
      THEN (p_request_data->>'estimated_time_seconds')::INT 
      ELSE 0 END,
    p_user_id
  ) RETURNING id INTO v_request_id;

  -- Step 2: Insert tasks from templates
  FOR v_task IN SELECT * FROM jsonb_array_elements(p_task_templates)
  LOOP
    INSERT INTO request_tasks (
      request_id,
      agent_role,
      task_name,
      task_key,
      status,
      sequence_order,
      depends_on,
      input_data,
      retry_count
    ) VALUES (
      v_request_id,
      v_task->>'agent_role',
      v_task->>'name',
      lower(replace(v_task->>'name', ' ', '_')),
      'pending',
      (v_task->>'sequence_order')::INT,
      '{}', -- Will be resolved in step 3
      COALESCE(v_task->'input_data', '{}'::jsonb),
      0
    );
    
    v_task_count := v_task_count + 1;
  END LOOP;

  -- Step 3: Resolve task dependencies
  -- (Update depends_on arrays with actual task IDs)
  PERFORM resolve_task_dependencies(v_request_id, p_task_templates);

  -- Step 4: Log creation event
  INSERT INTO request_events (
    request_id,
    event_type,
    description,
    metadata,
    actor
  ) VALUES (
    v_request_id,
    'created',
    'Request created: ' || (p_request_data->>'title'),
    jsonb_build_object(
      'type', p_request_data->>'request_type',
      'provider', p_request_data->>'preferred_provider',
      'tier', p_request_data->>'provider_tier',
      'task_count', v_task_count
    ),
    'user:' || p_user_id::TEXT
  );

  -- Step 5: Return success with request data
  SELECT * INTO v_request 
  FROM content_requests 
  WHERE id = v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'data', row_to_json(v_request),
    'task_count', v_task_count
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback happens automatically
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RPC Function 2: Transition Request Status (Atomic)
-- =============================================================================
-- Atomically updates request status and logs the transition event.
-- Uses row-level lock to prevent concurrent transitions.
--
-- Parameters:
--   p_request_id: UUID of the request
--   p_from_status: Expected current status (for optimistic locking)
--   p_to_status: Target status
--   p_reason: Optional reason for transition
--   p_user_id: UUID of the user making the transition
--
-- Returns:
--   JSONB with success flag, updated request, and error message (if any)
-- =============================================================================
CREATE OR REPLACE FUNCTION transition_request_status(
  p_request_id UUID,
  p_from_status TEXT,
  p_to_status TEXT,
  p_reason TEXT,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_request RECORD;
BEGIN
  -- Step 1: Lock the request row and get current status
  SELECT status INTO v_current_status
  FROM content_requests
  WHERE id = p_request_id
  FOR UPDATE;

  -- Check if request exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  -- Step 2: Verify current status matches expected
  IF v_current_status != p_from_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Status mismatch: expected %s, found %s', p_from_status, v_current_status),
      'code', 'STATUS_MISMATCH',
      'details', jsonb_build_object(
        'expected', p_from_status,
        'actual', v_current_status
      )
    );
  END IF;

  -- Step 3: Check if already at target status
  IF v_current_status = p_to_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Already in status: %s', p_to_status),
      'code', 'ALREADY_IN_STATUS'
    );
  END IF;

  -- Step 4: Update status
  UPDATE content_requests
  SET 
    status = p_to_status,
    updated_at = NOW()
  WHERE id = p_request_id;

  -- Step 5: Log transition event
  INSERT INTO request_events (
    request_id,
    event_type,
    description,
    metadata,
    actor
  ) VALUES (
    p_request_id,
    'status_transition',
    COALESCE(
      p_reason,
      format('Transitioned from %s to %s', p_from_status, p_to_status)
    ),
    jsonb_build_object(
      'from_status', p_from_status,
      'to_status', p_to_status,
      'triggered_by', p_user_id
    ),
    'user:' || p_user_id::TEXT
  );

  -- Step 6: Return updated request
  SELECT * INTO v_request
  FROM content_requests
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'data', row_to_json(v_request),
    'previous_status', p_from_status,
    'current_status', p_to_status
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'INTERNAL_ERROR',
      'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RPC Function 3: Transition Video Status (Atomic)
-- =============================================================================
-- Atomically updates video/generation job status and logs the event.
-- Similar to request transition but for generation_jobs table.
--
-- Note: video_events table doesn't exist yet, so logging is commented out.
-- Uncomment when table is created.
-- =============================================================================
CREATE OR REPLACE FUNCTION transition_video_status(
  p_video_id UUID,
  p_from_status TEXT,
  p_to_status TEXT,
  p_reason TEXT,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_video RECORD;
BEGIN
  -- Step 1: Lock the video row and get current status
  SELECT status INTO v_current_status
  FROM generation_jobs
  WHERE id = p_video_id
  FOR UPDATE;

  -- Check if video exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Video not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  -- Step 2: Verify current status matches expected
  IF v_current_status != p_from_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Status mismatch: expected %s, found %s', p_from_status, v_current_status),
      'code', 'STATUS_MISMATCH',
      'details', jsonb_build_object(
        'expected', p_from_status,
        'actual', v_current_status
      )
    );
  END IF;

  -- Step 3: Check if already at target status
  IF v_current_status = p_to_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Already in status: %s', p_to_status),
      'code', 'ALREADY_IN_STATUS'
    );
  END IF;

  -- Step 4: Update status
  UPDATE generation_jobs
  SET 
    status = p_to_status,
    updated_at = NOW()
  WHERE id = p_video_id;

  -- Step 5: Log transition event (if video_events table exists)
  -- TODO: Uncomment when video_events table is created
  /*
  INSERT INTO video_events (
    video_id,
    event_type,
    description,
    metadata,
    actor
  ) VALUES (
    p_video_id,
    'status_transition',
    COALESCE(
      p_reason,
      format('Transitioned from %s to %s', p_from_status, p_to_status)
    ),
    jsonb_build_object(
      'from_status', p_from_status,
      'to_status', p_to_status,
      'triggered_by', p_user_id
    ),
    'user:' || p_user_id::TEXT
  );
  */

  -- Step 6: Return updated video
  SELECT * INTO v_video
  FROM generation_jobs
  WHERE id = p_video_id;

  RETURN jsonb_build_object(
    'success', true,
    'data', row_to_json(v_video),
    'previous_status', p_from_status,
    'current_status', p_to_status
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'INTERNAL_ERROR',
      'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Grant Execute Permissions
-- =============================================================================
-- Allow authenticated users to call these functions via Supabase RPC

GRANT EXECUTE ON FUNCTION create_request_with_tasks(JSONB, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION transition_request_status(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION transition_video_status(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_task_dependencies(UUID, JSONB) TO authenticated;

-- =============================================================================
-- Migration Complete
-- =============================================================================
-- These RPC functions provide atomic transaction wrappers for multi-step operations.
-- They ensure that either all steps succeed or all are rolled back, preventing
-- partial failures and data inconsistency.
--
-- Usage examples:
--
-- 1. Create request with tasks:
--    SELECT create_request_with_tasks(
--      '{"brand_id": "...", "title": "My Request", ...}'::jsonb,
--      '[{"agent_role": "executive", "name": "...", ...}, ...]'::jsonb,
--      'user-id'::uuid
--    );
--
-- 2. Transition request status:
--    SELECT transition_request_status(
--      'request-id'::uuid,
--      'intake',
--      'draft',
--      'Moving to draft after review',
--      'user-id'::uuid
--    );
--
-- 3. Transition video status:
--    SELECT transition_video_status(
--      'video-id'::uuid,
--      'processing',
--      'completed',
--      'Video generation completed',
--      'user-id'::uuid
--    );
-- =============================================================================
