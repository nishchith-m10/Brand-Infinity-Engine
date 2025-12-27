/**
 * PHASE 6 PART 2: Multi-Agent Creative Director
 * Core Agent Type Definitions
 */

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentType = 
  | "executive" 
  | "strategist" 
  | "copywriter" 
  | "producer" 
  | "verifier";

export type AgentTier = "premium" | "budget";

// ============================================================================
// CONVERSATION TYPES
// ============================================================================

export type ConversationState = 
  | "initial"
  | "gathering"     // Asking clarifying questions
  | "clarifying"    // Processing answers
  | "planning"      // Creating task plan
  | "confirming"    // Showing plan to user
  | "processing"    // Executing tasks
  | "verifying"     // Quality checks
  | "delivered"     // Complete
  | "cancelled";    // User cancelled

export interface ConversationSession {
  id: string;
  brand_id: string;
  user_id: string;
  state: ConversationState;
  
  // Collected information
  parsed_intent: Partial<ParsedIntent>;
  answered_questions: Record<string, any>;
  pending_questions: ClarifyingQuestion[];
  
  // Context
  selected_kb_ids: string[];
  
  // Task tracking
  active_task_plan_id: string | null;
  
  // Timestamps
  created_at: string;
  last_activity_at: string;
  completed_at: string | null;
}

export interface ConversationMessage {
  id: string;
  session_id: string;
  brand_id: string;
  user_id: string;
  
  role: "user" | "assistant" | "system";
  content: string;
  
  // Metadata
  tokens_used?: number;
  model_used?: string;
  latency_ms?: number;
  
  // For assistant messages
  action_taken?: "asked_questions" | "delegated" | "responded";
  questions_asked?: ClarifyingQuestion[];
  delegation_plan?: DelegationPlan;
  
  created_at: string;
}

// ============================================================================
// INTENT & QUESTION TYPES
// ============================================================================

export interface ParsedIntent {
  // Core parameters
  content_type?: "video" | "image" | "carousel" | "story";
  platform?: "tiktok" | "instagram_reels" | "youtube_shorts" | "facebook" | "linkedin";
  product?: string;
  
  // Optional parameters
  target_audience?: string;
  key_message?: string;
  tone?: "energetic" | "professional" | "casual" | "humorous" | "inspirational";
  duration?: number;
  call_to_action?: string;
  
  // Metadata
  confidence?: number;
  raw_message?: string;
}

export interface ClarifyingQuestion {
  id: string;
  field: string;  // Maps to ParsedIntent field
  question: string;
  type: "choice" | "text" | "confirm" | "number";
  options?: string[];
  required: boolean;
  default_value?: any;
  help_text?: string;
}

export interface QuestionAnswer {
  question_id: string;
  field: string;
  value: any;
  timestamp: string;
}

export type ExecutiveAction =
  | {
      type: 'ask_questions';
      questions: ClarifyingQuestion[];
      parsedIntent: Partial<ParsedIntent>;
    }
  | {
      type: 'create_plan';
      parsedIntent: Partial<ParsedIntent>;
    };

// ============================================================================
// TASK & DELEGATION TYPES
// ============================================================================

export interface TaskPlan {
  id: string;
  session_id: string;
  brand_id: string;
  
  tasks: Task[];
  estimated_duration_seconds: number;
  estimated_cost_usd: number;
  
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  started_at: string | null;
  completed_at: string | null;
  
  // Results
  outputs?: Record<string, any>;
  errors?: TaskError[];
  
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  type: "preparation" | "strategy" | "copy" | "production" | "verification";
  name: string;
  manager: AgentType;
  dependencies: string[];  // Task IDs
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  parallel_group?: number;  // Tasks with same group can run in parallel
  
  // Execution metadata
  started_at?: string;
  completed_at?: string;
  retry_count?: number;
  error?: TaskError;
  estimated_duration?: number; // In seconds
  priority?: number;
}

export interface TaskError {
  task_id: string;
  error_code: string;
  error_message: string;
  stack_trace?: string;
  timestamp: string;
  retry_attempted: boolean;
}

export interface DelegationPlan {
  strategy_task?: StrategyTask;
  copy_task?: CopyTask;
  production_task?: ProductionTask;
  parallel: boolean;
}

export interface StrategyTask {
  objective: string;
  target_audience: string;
  platform_specs: any;
}

export interface CopyTask {
  brief: any;
  style: string;
  length_constraints: any;
}

export interface ProductionTask {
  script: any;
  assets: string[];
  platform: string;
}

// ============================================================================
// BRAND CONTEXT TYPES
// ============================================================================

export interface BrandContext {
  brand_id: string;
  
  // Identity
  brand_name: string;
  brand_voice?: string;
  primary_colors?: string[];
  logo_url?: string;
  
  // Knowledge bases loaded
  loaded_kbs: string[];
  loaded_kb_names?: string[];
  
  // Assets
  matched_assets: BrandAsset[];
  
  // Products
  products?: Product[];
  
  // Constraints
  negative_constraints?: string[];
  required_elements?: string[];
}

export interface BrandAsset {
  id: string;
  name: string;
  type: "image" | "video" | "document" | "logo" | "font";
  url: string;
  metadata?: Record<string, any>;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  key_features?: string[];
  target_audience?: string;
}

// ============================================================================
// QUALITY VERIFICATION TYPES
// ============================================================================

export interface QualityVerification {
  id: string;
  task_plan_id: string;
  content_type: string;
  content_id?: string;
  
  // Results
  passed: boolean;
  overall_score: number;  // 0-10
  checks: VerificationChecks;
  recommendations: string[];
  
  // Approval path
  can_auto_approve: boolean;
  human_review_required: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  review_decision?: "approved" | "rejected" | "needs_revision";
  review_notes?: string;
  
  created_at: string;
}

export interface VerificationChecks {
  brand_alignment: CheckResult;
  platform_compliance: CheckResult;
  content_quality: CheckResult;
  negative_constraints: CheckResult;
}

export interface CheckResult {
  passed: boolean;
  score?: number;  // 0-10
  issues: string[];
  violations?: string[];
}

// ============================================================================
// RESPONSE TYPES (API → Frontend)
// ============================================================================

export interface AgentResponse {
  type: "questions" | "delegation" | "message" | "error";
  content: string;
  
  // If type === "questions"
  questions?: ClarifyingQuestion[];
  
  // If type === "delegation"
  plan_preview?: TaskPlanPreview;
  
  // If type === "error"
  error?: {
    code: string;
    message: string;
    retry_possible: boolean;
  };
}

export interface TaskPlanPreview {
  tasks: string[];  // Task names
  estimated_time: string;  // "5-8 minutes"
  estimated_cost: string;  // "$0.50"
  breakdown?: {
    strategy: boolean;
    copywriting: boolean;
    production: boolean;
    verification: boolean;
  };
}

// ============================================================================
// EXECUTION RESULT TYPES
// ============================================================================

export interface ExecutionResult {
  success: boolean;
  partial: boolean;  // Some tasks succeeded, some failed
  
  results: Record<string, any>;  // task_id → output
  failed_tasks: {
    id: string;
    name: string;
    error: string;
  }[];
  
  duration_seconds: number;
  total_cost_usd: number;
}

// ============================================================================
// PLATFORM SPECS
// ============================================================================

export interface PlatformSpecs {
  platform: string;
  video_duration: {
    min: number;
    max: number;
    optimal: number;
  };
  aspect_ratios: string[];
  max_file_size_mb: number;
  audio_required: boolean;
  caption_limits?: number;
  hashtag_recommendations?: number;
  best_practices?: string[];
}

// ============================================================================
// EXTRACTED INFO (from user messages)
// ============================================================================

export interface ExtractedInfo {
  field: string;
  value: any;
  confidence: number;  // 0-1
  source: "explicit" | "inferred" | "knowledge_base";
}

