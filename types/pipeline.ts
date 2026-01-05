// =============================================================================
// PIPELINE TYPES - Phase 7
// TypeScript types matching the Phase 7 database schema
// =============================================================================

// =============================================================================
// ENUMS (matching database types)
// =============================================================================

export type RequestType = 
  | 'video_with_vo'    // Video with voiceover
  | 'video_no_vo'      // Video without voiceover (music only)
  | 'image';           // Static image

export type RequestStatus = 
  | 'intake'           // Just submitted, validating
  | 'draft'            // Strategy/scripting in progress
  | 'production'       // Media generation in progress
  | 'qa'               // Quality review
  | 'approval'         // Awaiting stakeholder approval
  | 'published'        // Successfully completed
  | 'cancelled';       // User cancelled or system timeout

export type TaskStatus = 
  | 'pending'          // Not started
  | 'in_progress'      // Currently executing
  | 'completed'        // Successfully finished
  | 'failed'           // Error occurred
  | 'skipped';         // Skipped due to dependency failure

export type AgentRole = 
  | 'executive'        // Executive/Orchestrator
  | 'task_planner'     // Task Planner
  | 'strategist'       // Strategist
  | 'copywriter'       // Copywriter
  | 'producer'         // Producer
  | 'qa';              // Quality Assurance

export type EventType = 
  | 'created'
  | 'status_change'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'agent_log'
  | 'provider_dispatched'
  | 'provider_completed'
  | 'provider_failed'
  | 'user_action'
  | 'system_error'
  | 'retry_initiated';

export type ProviderTier = 'economy' | 'standard' | 'premium';

export type ProviderStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export type StylePreset = 'Realistic' | 'Animated' | 'Cinematic' | '3D' | 'Sketch';

export type ShotType = 'Close-up' | 'Wide' | 'Medium' | 'POV' | 'Aerial';

// =============================================================================
// DATABASE TABLE INTERFACES
// =============================================================================

/**
 * ContentRequest - Main request table
 * Represents a single content generation request in the pipeline
 */
export interface ContentRequest {
  // Primary Key
  id: string;
  
  // Foreign Keys
  brand_id: string;
  campaign_id: string | null;
  
  // Core Fields
  title: string;
  request_type: RequestType;
  status: RequestStatus;
  
  // Creative Requirements
  prompt: string;
  duration_seconds: number | null;
  aspect_ratio: string;
  style_preset: string;
  shot_type: string;
  voice_id: string | null;
  
  // Provider Settings
  preferred_provider: string | null;
  provider_tier: ProviderTier;
  
  // Script Settings
  auto_script: boolean;
  script_text: string | null;
  
  // Knowledge Base Selection
  selected_kb_ids: string[];
  
  // Cost & Time Estimates
  estimated_cost: number | null;
  estimated_time_seconds: number | null;
  actual_cost: number;
  
  // Outputs
  thumbnail_url: string | null;
  output_url: string | null;
  
  // Metadata
  metadata: Record<string, unknown>;
  
  // Audit Fields
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * RequestTask - Individual agent task
 * Represents a single task executed by an AI agent
 */
export interface RequestTask {
  // Primary Key
  id: string;
  
  // Foreign Key
  request_id: string;
  
  // Task Definition
  agent_role: AgentRole;
  task_name: string;
  task_key: string;
  status: TaskStatus;
  
  // Execution Order
  sequence_order: number;
  depends_on: string[];
  
  // Input/Output
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  output_url: string | null;
  
  // Error Handling
  error_message: string | null;
  error_code: string | null;
  retry_count: number;
  max_retries: number;
  
  // Timing
  started_at: string | null;
  completed_at: string | null;
  timeout_seconds: number;
  
  // Audit
  created_at: string;
}

/**
 * RequestEvent - Event log entry
 * Immutable audit log for request lifecycle events
 */
export interface RequestEvent {
  // Primary Key
  id: string;
  
  // Foreign Keys
  request_id: string;
  task_id: string | null;
  
  // Event Details
  event_type: EventType;
  description: string;
  metadata: Record<string, unknown>;
  
  // Actor
  actor: string | null;
  
  // Timestamp
  created_at: string;
}

/**
 * ProviderMetadata - External provider tracking
 * Tracks calls to external AI providers (Runway, Pika, etc.)
 */
export interface ProviderMetadata {
  // Primary Key
  id: string;
  
  // Foreign Key
  request_task_id: string;
  
  // Provider Info
  provider_name: string;
  external_job_id: string | null;
  
  // Request/Response
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  
  // Status
  provider_status: ProviderStatus;
  
  // Cost Tracking
  cost_incurred: number | null;
  cost_currency: string;
  
  // Timing
  dispatched_at: string;
  completed_at: string | null;
  
  // Audit
  created_at: string;
}

// =============================================================================
// EXTENDED INTERFACES (with relations)
// =============================================================================

/**
 * ContentRequestWithRelations
 * Full request with all related tasks and events
 */
export interface ContentRequestWithRelations extends ContentRequest {
  tasks: RequestTask[];
  events: RequestEvent[];
}

/**
 * DetailedContentRequest - Alias for ContentRequestWithRelations
 * Used by hooks for backwards compatibility
 */
export type DetailedContentRequest = ContentRequestWithRelations;

/**
 * RequestTaskWithMetadata
 * Task with provider metadata included
 */
export interface RequestTaskWithMetadata extends RequestTask {
  provider_metadata?: ProviderMetadata;
}

// =============================================================================
// API INPUT TYPES
// =============================================================================

/**
 * CreateRequestInput
 * Input for POST /api/v1/requests
 */
export interface CreateRequestInput {
  brand_id: string;
  campaign_id?: string;
  title: string;
  type: RequestType;
  
  requirements: {
    prompt: string;
    duration?: number;
    aspect_ratio?: AspectRatio;
    style_preset?: StylePreset;
    shot_type?: ShotType;
    voice_id?: string;
  };
  
  settings?: {
    provider?: string;
    tier?: ProviderTier;
    auto_script?: boolean;
    script_text?: string;
    selected_kb_ids?: string[];
  };
}

/**
 * UpdateRequestInput
 * Input for PATCH /api/v1/requests/:id
 */
export interface UpdateRequestInput {
  title?: string;
  status?: 'cancelled'; // Only allow manual cancellation
}

/**
 * ListRequestsParams
 * Query params for GET /api/v1/requests
 */
export interface ListRequestsParams {
  brand_id: string;
  campaign_id?: string;
  status?: RequestStatus;
  page?: number;
  limit?: number;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * CreateRequestResponse
 * Response from POST /api/v1/requests
 */
export interface CreateRequestResponse {
  success: boolean;
  data: {
    id: string;
    status: RequestStatus;
    title: string;
    request_type: RequestType;
    estimated_cost: number;
    estimated_time_seconds: number;
    created_at: string;
  };
  error?: string;
}

/**
 * GetRequestResponse
 * Response from GET /api/v1/requests/:id
 */
export interface GetRequestResponse {
  success: boolean;
  data: ContentRequestWithRelations;
  error?: string;
}

/**
 * ListRequestsResponse
 * Response from GET /api/v1/requests
 */
export interface ListRequestsResponse {
  success: boolean;
  data: ContentRequest[];
  meta: {
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
  };
  error?: string;
}

/**
 * UpdateRequestResponse
 * Response from PATCH /api/v1/requests/:id
 */
export interface UpdateRequestResponse {
  success: boolean;
  data: ContentRequest;
  error?: string;
}

/**
 * DeleteRequestResponse
 * Response from DELETE /api/v1/requests/:id
 */
export interface DeleteRequestResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * RetryRequestResponse
 * Response from POST /api/v1/requests/:id/retry
 */
export interface RetryRequestResponse {
  success: boolean;
  message: string;
  retried_tasks: string[];
  error?: string;
}

/**
 * GetEventsResponse
 * Response from GET /api/v1/requests/:id/events
 */
export interface GetEventsResponse {
  success: boolean;
  data: RequestEvent[];
  error?: string;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * TaskDefinition
 * Template for creating tasks
 */
export interface TaskDefinition {
  agent_role: AgentRole;
  task_name: string;
  task_key: string;
  sequence_order: number;
  depends_on: string[];
  input_data?: Record<string, unknown>;
  timeout_seconds?: number;
}

/**
 * CostEstimate
 * Cost breakdown for a request
 */
export interface CostEstimate {
  strategy_cost: number;
  script_cost: number;
  video_cost: number;
  voice_cost: number;
  total_cost: number;
  provider_breakdown: Record<string, number>;
}

/**
 * TimeEstimate
 * Time breakdown for a request
 */
export interface TimeEstimate {
  strategy_time: number;
  script_time: number;
  video_time: number;
  voice_time: number;
  qa_time: number;
  total_time: number;
}

/**
 * PipelineMetrics
 * Aggregated metrics for dashboard
 */
export interface PipelineMetrics {
  total_requests: number;
  by_status: Record<RequestStatus, number>;
  by_type: Record<RequestType, number>;
  average_completion_time: number;
  average_cost: number;
  success_rate: number;
}

/**
 * TaskProgress
 * Progress tracking for a request
 */
export interface TaskProgress {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  in_progress_tasks: number;
  pending_tasks: number;
  progress_percentage: number;
  current_phase: RequestStatus;
  estimated_completion: string | null;
}

// =============================================================================
// WEBHOOK TYPES
// =============================================================================

/**
 * ProviderCallbackPayload
 * Webhook payload from external providers
 */
export interface ProviderCallbackPayload {
  provider: string;
  job_id: string;
  status: 'completed' | 'failed';
  output_url?: string;
  error_message?: string;
  cost?: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// FORM TYPES (for Pipeline UI)
// =============================================================================

/**
 * RequestFormData
 * Form state for creating a new request
 */
export interface RequestFormData {
  title: string;
  type: RequestType;
  prompt: string;
  
  // Optional fields
  duration_seconds?: number;
  aspect_ratio: AspectRatio;
  style_preset: StylePreset;
  shot_type: ShotType;
  voice_id?: string;
  
  // Settings
  preferred_provider?: string;
  provider_tier: ProviderTier;
  auto_script: boolean;
  script_text?: string;
  selected_kb_ids: string[];
}

/**
 * RequestFormErrors
 * Validation errors for the form
 */
export interface RequestFormErrors {
  title?: string;
  type?: string;
  prompt?: string;
  duration_seconds?: string;
  script_text?: string;
}
