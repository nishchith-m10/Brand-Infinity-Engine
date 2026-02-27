// =============================================================================
// ORCHESTRATOR TYPES
// All TypeScript types and interfaces for the Phase 8 Orchestrator system
// =============================================================================

import type {
  ContentRequest as PipelineContentRequest,
  RequestTask as PipelineRequestTask,
  RequestEvent as PipelineRequestEvent,
  ProviderMetadata as PipelineProviderMetadata,
  RequestType,
  RequestStatus,
  TaskStatus,
  AgentRole,
  EventType
} from '@/types/pipeline';

// Re-export pipeline types for backwards compatibility
export type ContentRequest = PipelineContentRequest;
export type RequestTask = PipelineRequestTask;
export type RequestEvent = PipelineRequestEvent;
export type ProviderMetadata = PipelineProviderMetadata;

// Re-export enums
export type { RequestType, RequestStatus, TaskStatus, AgentRole, EventType };

// Insert types - same as Row types for now
export type ContentRequestInsert = Partial<ContentRequest> & Pick<ContentRequest, 'brand_id' | 'title' | 'request_type'>;
export type RequestTaskInsert = Partial<RequestTask> & Pick<RequestTask, 'request_id' | 'agent_role' | 'task_name'>;
export type RequestEventInsert = Partial<RequestEvent> & Pick<RequestEvent, 'request_id' | 'event_type'>;
export type ProviderMetadataInsert = Partial<ProviderMetadata> & Pick<ProviderMetadata, 'request_task_id' | 'provider_name'>;

// =============================================================================
// ORCHESTRATOR CONFIGURATION
// =============================================================================

export interface OrchestratorConfig {
  /**
   * Maximum number of concurrent tasks to process
   */
  maxConcurrentTasks: number;

  /**
   * Maximum number of retries for a failed task
   */
  maxTaskRetries: number;

  /**
   * Delay between retries (exponential backoff base)
   */
  retryDelayMs: number;

  /**
   * Maximum time to wait for a task (timeout)
   */
  taskTimeoutMs: number;

  /**
   * Whether to use mock mode for testing
   */
  mockMode: boolean;

  /**
   * n8n base URL
   */
  n8nBaseUrl: string;

  /**
   * Webhook callback base URL (for n8n to call back)
   */
  callbackBaseUrl: string;
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  maxConcurrentTasks: 3,
  maxTaskRetries: 3,
  retryDelayMs: 5000,
  taskTimeoutMs: 600000, // 10 minutes
  mockMode: false,
  n8nBaseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
  callbackBaseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
};

// =============================================================================
// STATE MACHINE TYPES
// =============================================================================

export type StatusTransition = {
  from: RequestStatus;
  to: RequestStatus;
  condition?: (request: ContentRequest) => boolean;
};

export type StatusTransitionMap = Record<RequestStatus, RequestStatus[]>;

export interface StatusTransitionResult {
  success: boolean;
  newStatus?: RequestStatus;
  error?: string;
}

export interface StatusStage {
  status: RequestStatus;
  stage: 'planning' | 'execution' | 'review' | 'complete';
  requiredTasks: AgentRole[];
}

// =============================================================================
// TASK TEMPLATE TYPES
// =============================================================================

export interface TaskTemplate {
  name: string;
  agent_role: AgentRole;
  description: string;
  sequence_order: number;
  dependencies?: string[]; // Task names that must complete first
  estimatedDurationSeconds: number;
  retryable: boolean;
  input_requirements?: string[];
}

export type TaskTemplateMap = Record<RequestType, TaskTemplate[]>;

// =============================================================================
// AGENT EXECUTION TYPES
// =============================================================================

export interface AgentExecutionParams {
  request: ContentRequest;
  task: RequestTask;
  completedTasks?: RequestTask[];
}

export interface AgentExecutionResult {
  success: boolean;
  output?: unknown;
  output_data?: Record<string, unknown>;
  output_url?: string;
  isAsync?: boolean;
  error?: {
    code: string;
    message: string;
    retriable?: boolean;
    details?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  duration_ms?: number;
}

export interface AgentAdapter {
  /**
   * Execute the agent for a given task
   */
  execute(params: AgentExecutionParams): Promise<AgentExecutionResult>;

  /**
   * Get the agent role this adapter handles
   */
  getAgentRole(): AgentRole;

  /**
   * Estimate duration for this agent's work
   */
  estimateDuration(params: AgentExecutionParams): number;

  /**
   * Check if this agent can handle async work (requires callback)
   */
  isAsync(): boolean;
}

// =============================================================================
// N8N INTEGRATION TYPES
// =============================================================================

export interface N8NDispatchParams {
  request_task_id: string;
  request_id: string;
  workflow_name: string;
  input_data: Record<string, unknown>;
  callback_url: string;
  provider?: string;
  tier?: string;
}

export interface N8NDispatchResult {
  success: boolean;
  external_job_id?: string;
  error?: string;
  dispatch_time: string;
}

export interface N8NCallbackPayload {
  request_task_id: string;
  status: 'completed' | 'failed';
  output_url?: string;
  error_message?: string;
  provider_name?: string;
  external_job_id?: string;
  cost_incurred?: number;
  response_payload?: Record<string, unknown>;
}

// =============================================================================
// EVENT LOGGING TYPES
// =============================================================================

export interface EventLogParams {
  request_id: string;
  event_type: EventType;
  description: string;
  metadata?: Record<string, unknown>;
  task_id?: string;
  actor?: string;
}

export interface EventQueryResult {
  events: RequestEvent[];
  total: number;
}

// =============================================================================
// RETRY LOGIC TYPES
// =============================================================================

export interface RetryStrategy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxRetries: 3,
  baseDelayMs: 5000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
};

export interface RetryContext {
  taskId: string;
  requestId: string;
  currentAttempt: number;
  lastError: string;
  nextRetryAt: Date;
}

// =============================================================================
// ORCHESTRATOR OPERATION TYPES
// =============================================================================

export interface ProcessRequestResult {
  success: boolean;
  requestId: string;
  finalStatus?: RequestStatus;
  tasksCompleted?: number;
  tasksFailed?: number;
  error?: string;
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  status: TaskStatus;
  output_data?: Record<string, unknown>;
  error?: string;
  retriable?: boolean;
}

// =============================================================================
// DETAILED REQUEST WITH RELATIONS
// =============================================================================

export interface DetailedRequest extends ContentRequest {
  tasks: RequestTask[];
  events: RequestEvent[];
  latest_event?: RequestEvent;
  completion_percentage?: number;
}

// =============================================================================
// PROVIDER TYPES
// =============================================================================

export type VideoProvider = 'runway' | 'pika' | 'pollo' | 'veo3' | 'sora' | 'mock';
export type ImageProvider = 'nanobanna' | 'stable_diffusion' | 'dalle' | 'mock';
export type VoiceProvider = 'elevenlabs' | 'openai_tts' | 'mock';

export interface ProviderConfig {
  name: string;
  type: 'video' | 'image' | 'voice';
  enabled: boolean;
  tier: 'economy' | 'standard' | 'premium';
  costPerSecond?: number;
  baseCost?: number;
  maxDurationSeconds?: number;
  apiEndpoint?: string;
}

// =============================================================================
// TASK DEPENDENCY TYPES
// =============================================================================

export interface TaskDependency {
  taskId: string;
  dependsOn: string[]; // Array of task IDs this depends on
  status: 'blocked' | 'ready' | 'running' | 'complete';
}

export interface DependencyGraph {
  nodes: Map<string, RequestTask>;
  edges: Map<string, string[]>; // taskId -> dependencyIds
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export class OrchestratorError extends Error {
  constructor(
    message: string,
    public code: string,
    public requestId?: string,
    public taskId?: string,
    public retriable: boolean = false
  ) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

export class TaskExecutionError extends Error {
  constructor(
    message: string,
    public taskId: string,
    public agentRole: AgentRole,
    public retriable: boolean = true
  ) {
    super(message);
    this.name = 'TaskExecutionError';
  }
}

export class StateMachineError extends Error {
  constructor(
    message: string,
    public from: RequestStatus,
    public to: RequestStatus
  ) {
    super(message);
    this.name = 'StateMachineError';
  }
}

// =============================================================================
// WEBHOOK VALIDATION TYPES
// =============================================================================

export interface WebhookSignature {
  signature: string;
  timestamp: number;
  payload: string;
}

export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
  payload?: N8NCallbackPayload;
}

// =============================================================================
// QUEUE TYPES
// =============================================================================

export interface QueueJob {
  id: string;
  type: 'process_request' | 'retry_task' | 'resume_request';
  data: {
    request_id?: string;
    task_id?: string;
  };
  priority?: number;
  attempts: number;
  created_at: Date;
  scheduled_for?: Date;
}

export interface DeadLetterQueueEntry {
  id: string;
  original_job: QueueJob;
  final_error: string;
  attempts: number;
  failed_at: Date;
}

// =============================================================================
// METRICS & MONITORING TYPES
// =============================================================================

export interface OrchestratorMetrics {
  requests_processed: number;
  requests_succeeded: number;
  requests_failed: number;
  tasks_executed: number;
  tasks_succeeded: number;
  tasks_failed: number;
  average_request_duration_ms: number;
  average_task_duration_ms: number;
  current_queue_size: number;
  dlq_size: number;
}

export interface TaskMetrics {
  taskId: string;
  agentRole: AgentRole;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  retries: number;
  cost?: number;
}

// =============================================================================
// STAGE HANDLER TYPES
// =============================================================================

export interface StageHandler {
  /**
   * Handle a request in a specific stage
   */
  handle(request: ContentRequest): Promise<void>;

  /**
   * Check if the stage is complete and can advance
   */
  canAdvance(request: ContentRequest): Promise<boolean>;

  /**
   * Get the next status after this stage completes
   */
  getNextStatus(): RequestStatus;
}

// All types and classes are already exported inline above
// No need for duplicate export statements
