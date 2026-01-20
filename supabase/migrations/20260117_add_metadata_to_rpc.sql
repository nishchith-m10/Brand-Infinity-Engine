-- Migration: Add metadata column to create_request_with_tasks RPC function
-- This fixes the issue where llm_model selection was not being persisted
CREATE OR REPLACE FUNCTION create_request_with_tasks(
        p_request_data JSONB,
        p_task_templates JSONB,
        p_user_id UUID
    ) RETURNS JSONB AS $$
DECLARE v_request_id UUID;
v_request RECORD;
v_task JSONB;
v_task_count INT := 0;
BEGIN -- Validate required fields
IF p_request_data->>'brand_id' IS NULL THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'brand_id is required'
);
END IF;
-- Step 1: Insert content request (WITH metadata)
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
        created_by,
        metadata -- Added: stores llm_model and other provider-specific options
    )
VALUES (
        (p_request_data->>'brand_id')::UUID,
        CASE
            WHEN p_request_data->>'campaign_id' IS NOT NULL THEN (p_request_data->>'campaign_id')::UUID
            ELSE NULL
        END,
        p_request_data->>'title',
        p_request_data->>'request_type',
        COALESCE(p_request_data->>'status', 'intake'),
        p_request_data->>'prompt',
        CASE
            WHEN p_request_data->>'duration_seconds' IS NOT NULL THEN (p_request_data->>'duration_seconds')::INT
            ELSE NULL
        END,
        COALESCE(p_request_data->>'aspect_ratio', '16:9'),
        COALESCE(p_request_data->>'style_preset', 'Realistic'),
        COALESCE(p_request_data->>'shot_type', 'Medium'),
        p_request_data->>'voice_id',
        p_request_data->>'preferred_provider',
        COALESCE(p_request_data->>'provider_tier', 'standard'),
        COALESCE((p_request_data->>'auto_script')::BOOLEAN, true),
        p_request_data->>'script_text',
        COALESCE(p_request_data->'selected_kb_ids', '[]'::jsonb),
        COALESCE(
            p_request_data->'selected_asset_ids',
            '[]'::jsonb
        ),
        CASE
            WHEN p_request_data->>'estimated_cost' IS NOT NULL THEN (p_request_data->>'estimated_cost')::NUMERIC
            ELSE 0
        END,
        CASE
            WHEN p_request_data->>'estimated_time_seconds' IS NOT NULL THEN (p_request_data->>'estimated_time_seconds')::INT
            ELSE 0
        END,
        p_user_id,
        COALESCE(p_request_data->'metadata', '{}'::jsonb) -- Added: metadata field
    )
RETURNING id INTO v_request_id;
-- Step 2: Insert tasks from templates
FOR v_task IN
SELECT *
FROM jsonb_array_elements(p_task_templates) LOOP
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
    )
VALUES (
        v_request_id,
        v_task->>'agent_role',
        v_task->>'name',
        lower(replace(v_task->>'name', ' ', '_')),
        'pending',
        (v_task->>'sequence_order')::INT,
        '{}',
        COALESCE(v_task->'input_data', '{}'::jsonb),
        0
    );
v_task_count := v_task_count + 1;
END LOOP;
-- Step 3: Resolve task dependencies
UPDATE request_tasks rt
SET depends_on = (
        SELECT COALESCE(jsonb_agg(dep_task.id), '[]'::jsonb)
        FROM jsonb_array_elements_text(
                (
                    SELECT t->'dependencies'
                    FROM jsonb_array_elements(p_task_templates) AS t
                    WHERE t->>'name' = rt.task_name
                )
            ) AS dep_name
            JOIN request_tasks dep_task ON dep_task.task_name = dep_name.value
            AND dep_task.request_id = v_request_id
    )
WHERE request_id = v_request_id;
-- Step 4: Log creation event
INSERT INTO request_events (
        request_id,
        event_type,
        actor,
        description,
        metadata
    )
VALUES (
        v_request_id,
        'created',
        'user:' || p_user_id::TEXT,
        'Request created: ' || (p_request_data->>'title'),
        jsonb_build_object(
            'type',
            p_request_data->>'request_type',
            'tier',
            COALESCE(p_request_data->>'provider_tier', 'standard'),
            'provider',
            p_request_data->>'preferred_provider',
            'task_count',
            v_task_count
        )
    );
-- Step 5: Get created request
SELECT * INTO v_request
FROM content_requests
WHERE id = v_request_id;
-- Return success with request data
RETURN jsonb_build_object(
    'success',
    true,
    'data',
    row_to_json(v_request)::jsonb,
    'task_count',
    v_task_count
);
EXCEPTION
WHEN OTHERS THEN -- Return error details
RETURN jsonb_build_object(
    'success',
    false,
    'error',
    SQLERRM,
    'code',
    'TRANSACTION_FAILED',
    'details',
    jsonb_build_object(
        'sqlstate',
        SQLSTATE,
        'message',
        SQLERRM
    )
);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_request_with_tasks(JSONB, JSONB, UUID) TO authenticated;