/**
 * Migration 041: n8n Callback Transaction Wrapper
 *
 * Purpose:
 * - Create atomic transaction function for processing n8n callbacks
 * - Update request_tasks and provider_metadata in a single transaction
 * - Prevent partial updates if either operation fails
 * - Leverage unique constraint from migration 040 for idempotency
 *
 * Usage:
 * SELECT process_n8n_callback(
 *   p_task_id := 'uuid-here',
 *   p_execution_id := 'n8n-execution-id',
 *   p_workflow_id := 'workflow-id',
 *   p_output_url := 'https://...',
 *   p_output_data := '{"result": "data"}'::jsonb
 * );
 */

CREATE OR REPLACE FUNCTION process_n8n_callback(
  p_task_id UUID,
  p_execution_id TEXT,
  p_workflow_id TEXT,
  p_output_url TEXT DEFAULT NULL,
  p_output_data JSONB DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
  -- Update task status atomically
  UPDATE request_tasks
  SET
    status = 'completed',
    output_data = p_output_data,
    output_url = p_output_url,
    completed_at = NOW()
  WHERE id = p_task_id;

  -- Check if task update affected any rows
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;

  -- Upsert provider metadata idempotently
  -- This uses the unique constraint (provider_name, external_job_id) from migration 040
  INSERT INTO provider_metadata (
    request_task_id,
    provider_name,
    external_job_id,
    response_payload,
    provider_status,
    completed_at,
    created_at
  ) VALUES (
    p_task_id,
    'n8n',
    p_execution_id,
    jsonb_build_object(
      'workflow_id', p_workflow_id,
      'execution_id', p_execution_id,
      'output_url', p_output_url,
      'result', p_output_data
    ),
    'completed',
    NOW(),
    NOW()
  )
  ON CONFLICT (provider_name, external_job_id)
  DO UPDATE SET
    response_payload = EXCLUDED.response_payload,
    provider_status = EXCLUDED.provider_status,
    completed_at = EXCLUDED.completed_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_n8n_callback IS
  'Atomically updates request_tasks and provider_metadata for n8n callbacks. ' ||
  'Uses unique constraint on (provider_name, external_job_id) for idempotency.';

-- Create a companion function for error callbacks
CREATE OR REPLACE FUNCTION process_n8n_callback_error(
  p_task_id UUID,
  p_execution_id TEXT,
  p_workflow_id TEXT,
  p_error_message TEXT,
  p_error_details JSONB DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
  -- Update task status to failed
  UPDATE request_tasks
  SET
    status = 'failed',
    error_message = p_error_message,
    output_data = jsonb_build_object(
      'error', p_error_message,
      'details', p_error_details
    ),
    completed_at = NOW()
  WHERE id = p_task_id;

  -- Check if task update affected any rows
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;

  -- Upsert provider metadata for error
  INSERT INTO provider_metadata (
    request_task_id,
    provider_name,
    external_job_id,
    response_payload,
    provider_status,
    completed_at,
    created_at
  ) VALUES (
    p_task_id,
    'n8n',
    p_execution_id,
    jsonb_build_object(
      'workflow_id', p_workflow_id,
      'execution_id', p_execution_id,
      'error', p_error_message,
      'error_details', p_error_details
    ),
    'failed',
    NOW(),
    NOW()
  )
  ON CONFLICT (provider_name, external_job_id)
  DO UPDATE SET
    response_payload = EXCLUDED.response_payload,
    provider_status = EXCLUDED.provider_status,
    completed_at = EXCLUDED.completed_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_n8n_callback_error IS
  'Atomically updates request_tasks and provider_metadata for failed n8n callbacks. ' ||
  'Marks task as failed and stores error details.';
