/**
 * Standard Operating Procedure (SOP) Types
 * Phase 5: MVP Hardening - SOP-Driven Intelligence
 * 
 * Purpose:
 * - Define deterministic workflows for content generation
 * - Replace ad-hoc agent decisions with validated procedures
 * - Enable consistent, repeatable, and debuggable execution
 */

import { z } from 'zod';

// =============================================================================
// Performance Tiers
// =============================================================================

/**
 * Performance tier determines which model pool is used
 * - eco: Cost-optimized, blacklists expensive models (O1/Opus/R1)
 * - standard: Balanced quality and cost (Sonnet/GPT-4o)
 * - infinity: Maximum intelligence, unconstrained (O1/Opus/R1)
 */
export type PerformanceTier = 'eco' | 'standard' | 'infinity';

// =============================================================================
// Model Pool Configuration
// =============================================================================

/**
 * Selection strategy for picking a model from the pool
 */
export type ModelSelectionStrategy = 
  | 'first-available'  // Use first model with available API key
  | 'random'           // Random selection for load distribution
  | 'best-for-task'    // AI-selected based on task characteristics
  | 'cheapest'         // Lowest cost per token
  | 'fastest';         // Lowest latency

/**
 * A pool of models that can be used for a specific tier/purpose
 */
export interface ModelPool {
  id: string;
  name: string;
  description: string;
  models: ModelConfig[];
  selectionStrategy: ModelSelectionStrategy;
}

/**
 * Individual model configuration within a pool
 */
export interface ModelConfig {
  id: string;                          // e.g., 'claude-3-5-sonnet-20241022'
  provider: string;                    // e.g., 'anthropic', 'openai'
  displayName: string;                 // e.g., 'Claude 3.5 Sonnet'
  strengths: string[];                 // e.g., ['creative-writing', 'code']
  costPerMillion: { input: number; output: number };
  contextWindow: number;
  isReasoning?: boolean;               // True for O1, R1, Opus-class
}

// =============================================================================
// SOP Step Definition
// =============================================================================

/**
 * Agent roles that can execute SOP steps
 */
export type AgentRole = 
  | 'executive'    // Plans and selects SOP
  | 'strategist'   // Creates strategy briefs
  | 'copywriter'   // Writes scripts and copy
  | 'producer'     // Triggers n8n workflows for media generation
  | 'reviewer'     // Quality checks outputs
  | 'broadcaster'; // Publishes to platforms

/**
 * A single step within an SOP
 */
export interface SOPStep {
  id: string;
  name: string;
  description: string;
  agentRole: AgentRole;
  
  // Data flow
  inputMapping: Record<string, string>;  // { localKey: 'previousStep.outputKey' }
  outputKey: string;                      // Where to store this step's output
  
  // Configuration
  modelPoolOverride?: string;             // Override default pool for this step
  maxRetries?: number;                    // Step-level retry limit
  timeoutMs?: number;                     // Step-level timeout
  
  // Validation
  outputSchema?: z.ZodSchema;             // Zod schema to validate output
  validator?: (output: unknown) => boolean; // Custom validation function
  
  // Conditional execution
  condition?: (context: SOPExecutionContext) => boolean;
  
  // For n8n steps
  n8nWorkflowId?: string;                 // If this step triggers n8n
  isAsync?: boolean;                      // True if step is async (waits for callback)
}

// =============================================================================
// SOP Definition
// =============================================================================

/**
 * Complete SOP definition
 */
export interface SOP {
  id: string;                             // e.g., 'VIDEO_PRO_V1'
  name: string;                           // e.g., 'Professional Video Production'
  description: string;
  version: string;                        // Semantic versioning
  
  // Steps
  steps: SOPStep[];
  
  // I/O Schemas
  inputSchema: z.ZodSchema;               // Validate request inputs
  outputSchema: z.ZodSchema;              // Validate final output
  
  // Configuration
  recommendedTier: PerformanceTier;
  estimatedDurationMs: number;
  estimatedCostUsd: { min: number; max: number };
  
  // Metadata
  tags: string[];                         // e.g., ['video', 'social-media']
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// SOP Execution Context
// =============================================================================

/**
 * Runtime context passed through SOP execution
 */
export interface SOPExecutionContext {
  requestId: string;
  userId: string;
  brandId?: string;
  
  // Selected configuration
  sop: SOP;
  tier: PerformanceTier;
  
  // Execution state
  currentStepIndex: number;
  stepOutputs: Record<string, unknown>;   // { stepId: output }
  
  // Input data
  userInput: Record<string, unknown>;
  brandContext?: string;
  kbContent?: string;
  
  // Tracking
  startTime: number;
  stepTimings: Record<string, number>;    // { stepId: durationMs }
  totalCostUsd: number;
  
  // Decision logging
  decisions: SOPDecision[];
}

/**
 * A logged decision made during SOP execution
 */
export interface SOPDecision {
  timestamp: string;
  stepId: string;
  decisionType: 'model-selection' | 'sop-selection' | 'retry' | 'skip' | 'error-recovery';
  reasoning: string;
  selectedOption: string;
  alternatives: string[];
  confidence: number;                     // 0-1
}

// =============================================================================
// SOP Selection Result
// =============================================================================

/**
 * Result from Executive Agent's SOP selection
 */
export interface SOPSelectionResult {
  sop: SOP;
  tier: PerformanceTier;
  reasoning: string;
  confidence: number;
  parameterizedInputs: Record<string, unknown>;
}

// =============================================================================
// SOP Execution Result
// =============================================================================

/**
 * Final result of SOP execution
 */
export interface SOPExecutionResult {
  success: boolean;
  sopId: string;
  
  // Output
  output?: Record<string, unknown>;
  
  // Error info (if failed)
  error?: {
    code: string;
    message: string;
    failedStep?: string;
    retriable: boolean;
  };
  
  // Metrics
  totalDurationMs: number;
  totalCostUsd: number;
  stepsCompleted: number;
  stepsTotal: number;
  
  // Debugging
  context: SOPExecutionContext;
}
