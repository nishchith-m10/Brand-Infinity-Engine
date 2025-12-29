/**
 * Database Transaction Wrappers
 * Phase III, Pillar 1: Transaction Wrapping
 * 
 * TypeScript wrappers for PostgreSQL RPC functions that provide atomic
 * multi-step operations with automatic rollback on failure.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ContentRequest, RequestTask } from '@/types/pipeline';

// =============================================================================
// Response Type Definitions
// =============================================================================

export interface TransactionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface CreateRequestResult extends TransactionResult<ContentRequest> {
  task_count?: number;
}

export interface TransitionResult extends TransactionResult<ContentRequest> {
  previous_status?: string;
  current_status?: string;
}

// =============================================================================
// Input Validation Schemas
// =============================================================================

const RequestDataSchema = z.object({
  // Optional ID allows callers to provide a pre-generated UUID for correlating
  // related operations (e.g., budget reservations) prior to creation.
  id: z.string().uuid().optional(),
  brand_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  request_type: z.enum(['video_with_vo', 'video_no_vo', 'image']),
  status: z.string().optional().default('intake'),
  
  // Creative requirements
  prompt: z.string().min(10).max(5000),
  duration_seconds: z.number().int().positive().optional(),
  aspect_ratio: z.string().optional(),
  style_preset: z.string().optional(),
  shot_type: z.string().optional(),
  voice_id: z.string().optional(),
  
  // Provider settings
  preferred_provider: z.string().optional(),
  provider_tier: z.enum(['economy', 'standard', 'premium']).optional(),
  
  // Script settings
  auto_script: z.boolean().optional(),
  script_text: z.string().optional(),
  
  // References
  selected_kb_ids: z.array(z.string().uuid()).optional(),
  selected_asset_ids: z.array(z.string().uuid()).optional(),
  
  // Estimates
  estimated_cost: z.number().nonnegative().optional(),
  estimated_time_seconds: z.number().int().positive().optional(),
});

const TaskTemplateSchema = z.object({
  agent_role: z.string(),
  name: z.string(),
  description: z.string().optional(),
  sequence_order: z.number().int(),
  dependencies: z.array(z.string()).optional().default([]),
  input_data: z.record(z.string(), z.unknown()).optional().default({}),
  estimatedDurationSeconds: z.number().optional(),
  retryable: z.boolean().optional().default(true),
});

// =============================================================================
// RPC Function Wrappers
// =============================================================================

/**
 * Atomically create a content request with its tasks and initial event.
 * 
 * This wraps the `create_request_with_tasks` PostgreSQL function which
 * executes all operations in a single transaction:
 * 1. INSERT content request
 * 2. INSERT request tasks (bulk)
 * 3. UPDATE task dependencies
 * 4. INSERT creation event
 * 
 * If any step fails, the entire operation is rolled back.
 * 
 * @param supabase - Supabase client (authenticated)
 * @param requestData - Request fields (brand_id, title, prompt, etc.)
 * @param taskTemplates - Array of task templates to create
 * @param userId - ID of the user creating the request
 * @returns Promise resolving to transaction result
 * 
 * @example
 * ```typescript
 * const result = await createRequestAtomic(supabase, {
 *   brand_id: '123',
 *   title: 'My Video',
 *   request_type: 'video_with_vo',
 *   prompt: 'Create a product demo',
 *   estimated_cost: 5.0
 * }, taskTemplates, userId);
 * 
 * if (result.success) {
 *   console.log('Request created:', result.data.id);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 * ```
 */
export async function createRequestAtomic(
  supabase: SupabaseClient,
  requestData: z.infer<typeof RequestDataSchema>,
  taskTemplates: z.infer<typeof TaskTemplateSchema>[],
  userId: string
): Promise<CreateRequestResult> {
  try {
    // Validate inputs
    const validatedRequest = RequestDataSchema.parse(requestData);
    const validatedTemplates = z.array(TaskTemplateSchema).parse(taskTemplates);

    // Call RPC function
    const { data, error } = await supabase.rpc('create_request_with_tasks', {
      p_request_data: validatedRequest as unknown as Record<string, unknown>,
      p_task_templates: validatedTemplates as unknown as Record<string, unknown>[],
      p_user_id: userId,
    });

    if (error) {
      console.error('[TransactionWrapper] RPC call failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to create request',
        code: 'RPC_ERROR',
        details: { hint: error.hint, details: error.details },
      };
    }

    // Parse response
    const result = data as CreateRequestResult;
    
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: result.data as ContentRequest,
      task_count: result.task_count,
    };
  } catch (error) {
    console.error('[TransactionWrapper] Unexpected error:', error);
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: { issues: error.issues },
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Atomically transition a request status and log the event.
 * 
 * This wraps the `transition_request_status` PostgreSQL function which:
 * 1. Locks the request row (FOR UPDATE)
 * 2. Verifies current status matches expected
 * 3. Updates status
 * 4. Logs transition event
 * 
 * Uses optimistic locking to prevent concurrent transitions.
 * 
 * @param supabase - Supabase client (authenticated)
 * @param requestId - ID of the request to transition
 * @param fromStatus - Expected current status
 * @param toStatus - Target status
 * @param reason - Optional reason for transition
 * @param userId - ID of the user making the transition
 * @returns Promise resolving to transition result
 * 
 * @example
 * ```typescript
 * const result = await transitionRequestAtomic(
 *   supabase,
 *   'req-123',
 *   'intake',
 *   'draft',
 *   'Moving to draft after validation',
 *   userId
 * );
 * 
 * if (!result.success && result.code === 'STATUS_MISMATCH') {
 *   console.log('Status changed by another process');
 * }
 * ```
 */
export async function transitionRequestAtomic(
  supabase: SupabaseClient,
  requestId: string,
  fromStatus: string,
  toStatus: string,
  reason: string | null,
  userId: string
): Promise<TransitionResult> {
  try {
    // Call RPC function
    const { data, error } = await supabase.rpc('transition_request_status', {
      p_request_id: requestId,
      p_from_status: fromStatus,
      p_to_status: toStatus,
      p_reason: reason,
      p_user_id: userId,
    });

    if (error) {
      console.error('[TransactionWrapper] Status transition failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to transition status',
        code: 'RPC_ERROR',
        details: { hint: error.hint, details: error.details },
      };
    }

    // Parse response
    const result = data as TransitionResult;
    
    return result;
  } catch (error) {
    console.error('[TransactionWrapper] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Atomically transition a video status and log the event.
 * 
 * Similar to transitionRequestAtomic but for generation_jobs table.
 * 
 * @param supabase - Supabase client (authenticated)
 * @param videoId - ID of the video to transition
 * @param fromStatus - Expected current status
 * @param toStatus - Target status
 * @param reason - Optional reason for transition
 * @param userId - ID of the user making the transition
 * @returns Promise resolving to transition result
 */
export async function transitionVideoAtomic(
  supabase: SupabaseClient,
  videoId: string,
  fromStatus: string,
  toStatus: string,
  reason: string | null,
  userId: string
): Promise<TransitionResult> {
  try {
    // Call RPC function
    const { data, error } = await supabase.rpc('transition_video_status', {
      p_video_id: videoId,
      p_from_status: fromStatus,
      p_to_status: toStatus,
      p_reason: reason,
      p_user_id: userId,
    });

    if (error) {
      console.error('[TransactionWrapper] Video transition failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to transition video status',
        code: 'RPC_ERROR',
        details: { hint: error.hint, details: error.details },
      };
    }

    // Parse response
    const result = data as TransitionResult;
    
    return result;
  } catch (error) {
    console.error('[TransactionWrapper] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build task templates from request type.
 * This is a helper to convert TaskFactory templates to RPC format.
 * 
 * @param requestType - Type of request (video_with_vo, video_no_vo, image)
 * @param templates - Task templates from TaskFactory
 * @returns Array of task templates in RPC format
 */
export function buildTaskTemplates(
  requestType: string,
  templates: Array<{
    name: string;
    agent_role: string;
    description?: string;
    sequence_order: number;
    dependencies: string[];
    estimatedDurationSeconds?: number;
    retryable?: boolean;
  }>
): z.infer<typeof TaskTemplateSchema>[] {
  return templates.map((template) => ({
    agent_role: template.agent_role,
    name: template.name,
    description: template.description,
    sequence_order: template.sequence_order,
    dependencies: template.dependencies || [],
    input_data: {},
    estimatedDurationSeconds: template.estimatedDurationSeconds,
    retryable: template.retryable ?? true,
  }));
}

/**
 * Check if an error is a known transaction error code.
 * Useful for error handling and user messaging.
 * 
 * @param result - Transaction result
 * @param code - Error code to check for
 * @returns True if result is error with matching code
 */
export function isTransactionError(
  result: TransactionResult,
  code: string
): boolean {
  return !result.success && result.code === code;
}
