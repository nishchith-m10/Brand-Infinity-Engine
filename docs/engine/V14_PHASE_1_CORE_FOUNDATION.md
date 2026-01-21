# V14 OLYMPUS - Phase 1: Core Foundation

## Overview

Phase 1 establishes the foundational infrastructure that all other components depend on. This includes configuration, type definitions, event streaming, budget tracking, state management, and checkpoint management.

**Files to Create:** 12
**Estimated Complexity:** Medium
**Dependencies:** None (this is the foundation)

---

## File 1: `src/lib/engine/v14-olympus/config.ts`

### Purpose
Central configuration file containing all constants, budgets, thresholds, and settings.

### Exact Interface

```typescript
// Version Information
export const V14_VERSION = '14.0.0';
export const V14_CODENAME = 'Olympus';

// Agent Budget Configuration
export const V14_AGENT_BUDGETS = {
  zeus: {
    maxCalls: 50,
    maxTokens: 100_000,
    model: 'claude-opus-4-20250514',
    description: 'Orchestration & coordination',
  },
  hermes: {
    maxCalls: 10,
    maxTokens: 30_000,
    model: 'claude-sonnet-4-20250514',
    description: 'Intake & clarification',
  },
  athena: {
    maxCalls: 50,
    maxTokens: 200_000,
    model: 'claude-sonnet-4-20250514',
    description: 'Research & architecture',
  },
  hephaestus: {
    maxCalls: 300,
    maxTokens: 1_000_000,
    model: 'claude-sonnet-4-20250514',
    description: 'Code generation',
  },
  apollo: {
    maxCalls: 40,
    maxTokens: 150_000,
    model: 'claude-sonnet-4-20250514',
    description: 'Verification & testing',
  },
  artemis: {
    maxCalls: 15,
    maxTokens: 50_000,
    model: 'claude-sonnet-4-20250514',
    description: 'Deployment',
  },
  mnemosyne: {
    maxCalls: 20,
    maxTokens: 30_000,
    model: 'claude-3-5-haiku-20241022',
    description: 'Memory (passive service)',
  },
} as const;

// Total Budget
export const V14_TOTAL_BUDGET = {
  maxCalls: 485,
  maxTokens: 1_560_000,
  estimatedCostPerMillion: {
    input: 3.0,   // $3 per million input tokens
    output: 15.0, // $15 per million output tokens
  },
  maxEstimatedCost: 25.0, // $25 max per generation
} as const;

// Phase Definitions
export const V14_PHASES = {
  IDLE: 'idle',
  INTAKE: 'intake',
  RESEARCH: 'research',
  ARCHITECTURE: 'architecture',
  PLAN_VALIDATION: 'plan_validation',
  BUILDING: 'building',
  VERIFICATION: 'verification',
  DEPLOYMENT: 'deployment',
  COMPLETE: 'complete',
  FAILED: 'failed',
  ABORTED: 'aborted',
} as const;

// Valid Phase Transitions
export const V14_PHASE_TRANSITIONS: Record<string, string[]> = {
  idle: ['intake'],
  intake: ['research', 'failed', 'aborted'],
  research: ['architecture', 'intake', 'failed', 'aborted'], // Can go back to intake
  architecture: ['plan_validation', 'research', 'failed', 'aborted'],
  plan_validation: ['building', 'architecture', 'failed', 'aborted'], // Can go back
  building: ['verification', 'building', 'failed', 'aborted'], // Can stay in building
  verification: ['deployment', 'building', 'failed', 'aborted'], // Can go back
  deployment: ['complete', 'failed', 'aborted'],
  complete: [],
  failed: [],
  aborted: [],
};

// Complexity Tiers
export const V14_COMPLEXITY_TIERS = {
  SIMPLE: {
    scoreRange: [1, 3],
    description: 'Landing page, blog, portfolio, simple form',
    budgetMultiplier: 0.4,
    estimatedFiles: '10-30',
    examples: ['Todo app', 'Portfolio site', 'Contact form'],
  },
  MEDIUM: {
    scoreRange: [4, 6],
    description: 'Dashboard, CRM, booking system',
    budgetMultiplier: 0.7,
    estimatedFiles: '30-80',
    examples: ['Admin dashboard', 'Booking system', 'Simple CRM'],
  },
  COMPLEX: {
    scoreRange: [7, 9],
    description: 'E-commerce, marketplace, multi-user SaaS',
    budgetMultiplier: 1.0,
    estimatedFiles: '80-200',
    examples: ['E-commerce store', 'Two-sided marketplace', 'SaaS with billing'],
  },
  EPIC: {
    scoreRange: [10, 15],
    description: 'Enterprise platform, complex integrations',
    budgetMultiplier: 1.3,
    estimatedFiles: '200+',
    examples: ['Enterprise CRM', 'Healthcare platform', 'Fintech app'],
  },
} as const;

// Complexity Weight Factors (with justification)
export const V14_COMPLEXITY_WEIGHTS = {
  features: { weight: 2, reason: 'Linear complexity per feature' },
  integrations: { weight: 5, reason: 'External APIs require auth, error handling, webhooks' },
  userRoles: { weight: 3, reason: 'Each role needs different UI + permissions' },
  dataModels: { weight: 2, reason: 'CRUD + validation + relationships' },
  realtime: { weight: 4, reason: 'WebSocket state sync, connection management' },
  fileUpload: { weight: 3, reason: 'Storage, size limits, security validation' },
  payments: { weight: 5, reason: 'PCI compliance, webhooks, idempotency required' },
  auth: { weight: 4, reason: 'Security-critical: sessions, tokens, recovery' },
} as const;

// Confidence Thresholds
export const V14_CONFIDENCE_THRESHOLDS = {
  PROCEED: 0.85,           // High confidence - proceed without asking
  ASK_OPTIONAL: 0.70,      // Medium - can proceed but should offer to clarify
  ASK_REQUIRED: 0.50,      // Low - must ask user before proceeding
  REJECT: 0.30,            // Too vague - reject and request more info
} as const;

// Confidence Calculation Weights
export const V14_CONFIDENCE_WEIGHTS = {
  promptClarity: 0.25,      // How clear is the requirement?
  domainFamiliarity: 0.20,  // Do we have patterns for this domain?
  technicalCertainty: 0.25, // Are the tech choices clear?
  scopeDefinition: 0.15,    // Is scope well-defined?
  edgeCaseCoverage: 0.15,   // Are edge cases identified?
} as const;

// Context Window Management
export const V14_CONTEXT_THRESHOLDS = {
  maxTokens: 200_000,       // Claude's context window
  warningPercent: 0.70,     // 70% - start summarizing old context
  criticalPercent: 0.85,    // 85% - aggressive compression
  maxPercent: 0.95,         // 95% - block new calls until compressed
} as const;

// Recovery Strategy Priority Order
export const V14_RECOVERY_STRATEGIES = [
  'retry_with_more_context',
  'simplify_approach',
  'alternative_solution',
  'decompose_task',
  'skip_and_stub',
  'rollback_checkpoint',
  'human_escalation',
] as const;

// Checkpoint Configuration
export const V14_CHECKPOINT_CONFIG = {
  maxCheckpoints: 5,
  maxSizePerCheckpoint: 50 * 1024 * 1024, // 50MB
  storageType: 'incremental' as const,
  triggers: [
    'phase_completed',
    'major_milestone',
    'before_risky_operation',
  ],
  retentionPolicy: 'keep_latest_5' as const,
} as const;

// Error Codes
export const V14_ERROR_CODES = {
  // Prompt errors (E0xx)
  INVALID_PROMPT: 'E001',
  PROMPT_TOO_VAGUE: 'E002',
  PROMPT_TOO_COMPLEX: 'E003',

  // Agent errors (E1xx)
  AGENT_TIMEOUT: 'E100',
  AGENT_LOOP_DETECTED: 'E101',
  AGENT_BUDGET_EXCEEDED: 'E102',
  AGENT_FAILED: 'E103',
  AGENT_STUCK: 'E104',

  // Build errors (E2xx)
  BUILD_FAILED: 'E200',
  TYPE_ERROR: 'E201',
  LINT_ERROR: 'E202',
  TEST_FAILED: 'E203',
  SECURITY_VIOLATION: 'E204',

  // Deploy errors (E3xx)
  DEPLOY_FAILED: 'E300',
  ENV_MISSING: 'E301',
  DOMAIN_ERROR: 'E302',

  // LLM errors (E4xx)
  LLM_API_ERROR: 'E400',
  RATE_LIMITED: 'E401',
  CONTEXT_EXCEEDED: 'E402',

  // Knowledge errors (E5xx)
  KNOWLEDGE_WRITE_FAILED: 'E500',
  KNOWLEDGE_VERSION_CONFLICT: 'E501',
  KNOWLEDGE_NOT_FOUND: 'E502',
} as const;

// Model Configuration
export const V14_MODEL_CONFIG = {
  primary: 'claude-sonnet-4-20250514',
  orchestrator: 'claude-opus-4-20250514',
  fast: 'claude-3-5-haiku-20241022',
  embedding: 'text-embedding-3-small',
  embeddingDimensions: 1536,
} as const;

// Default Tech Stack
export const V14_DEFAULT_STACK = {
  frontend: 'nextjs' as const,
  backend: 'nextjs-api' as const,
  database: 'supabase' as const,
  auth: 'supabase-auth' as const,
  styling: 'tailwindcss' as const,
  deployment: 'vercel' as const,
} as const;

// Pattern Matching Weights
export const V14_PATTERN_WEIGHTS = {
  semanticSimilarity: 0.50,  // Embedding cosine similarity
  keywordOverlap: 0.25,      // Domain keyword matching
  structuralMatch: 0.15,     // Architecture shape matching
  complexityMatch: 0.10,     // Complexity level appropriateness
} as const;

// Research Confidence Thresholds
export const V14_RESEARCH_THRESHOLDS = {
  minSources: 3,             // Minimum sources for confidence
  qualityThreshold: 0.6,     // Minimum source quality
  consistencyThreshold: 0.7, // Source agreement threshold
  coverageThreshold: 0.6,    // Domain coverage threshold
  retryLimit: 3,             // Max research retries
} as const;
```

### Verification
- TypeScript compiles without errors
- All constants are properly typed
- No circular dependencies

---

## File 2: `src/lib/engine/v14-olympus/types/agents.ts`

### Purpose
Define all agent-related types, interfaces, and enums.

### Exact Interface

```typescript
import { V14_AGENT_BUDGETS } from '../config';

// Agent Names (derived from config)
export type AgentName = keyof typeof V14_AGENT_BUDGETS;

// Agent Status
export type AgentStatus =
  | 'idle'       // Not started
  | 'starting'   // Initializing
  | 'active'     // Running
  | 'waiting'    // Waiting for input/dependency
  | 'paused'     // Temporarily paused
  | 'complete'   // Successfully finished
  | 'error'      // Failed with error
  | 'aborted';   // Manually aborted

// Agent State
export interface AgentState {
  name: AgentName;
  status: AgentStatus;
  currentTask?: string;
  currentPhase?: string;
  progress: number;           // 0-100
  iterationsUsed: number;
  tokensUsed: number;
  callsMade: number;
  startedAt?: number;
  completedAt?: number;
  lastActivityAt?: number;
  error?: AgentError;
  metadata?: Record<string, unknown>;
}

// Agent Error
export interface AgentError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
  suggestedAction?: string;
}

// Agent Budget
export interface AgentBudget {
  maxCalls: number;
  maxTokens: number;
  callsUsed: number;
  tokensUsed: number;
  estimatedCost: number;

  // Computed
  callsRemaining: number;
  tokensRemaining: number;
  utilizationPercent: number;
  isExhausted: boolean;
}

// Agent Context (passed to all agents)
export interface AgentContext {
  // Session info
  sessionId: string;
  projectId: string;
  projectName: string;

  // Original request
  prompt: string;
  options: GenerationOptions;

  // Current state
  currentPhase: string;

  // Interfaces
  emit: EventEmitter;
  sandbox: SandboxInterface;
  memory: MemoryInterface;
  knowledge: KnowledgeStoreInterface;
  budget: BudgetTracker;

  // Inter-agent communication
  queryAgent: (target: AgentName, query: AgentQuery) => Promise<AgentResponse>;

  // User interaction
  askUser: (question: UserQuestion) => Promise<UserResponse>;
}

// Agent Query (for inter-agent communication)
export interface AgentQuery {
  type: 'request' | 'inform' | 'clarify';
  topic: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number;
}

// Agent Response
export interface AgentResponse {
  success: boolean;
  content?: string;
  data?: unknown;
  error?: string;
}

// Agent Result (returned when agent completes)
export interface AgentResult {
  success: boolean;
  agentName: AgentName;
  phase: string;
  data?: unknown;
  files?: GeneratedFile[];
  nextTasks?: Task[];
  error?: AgentError;
  tokensUsed: number;
  callsMade: number;
  duration: number;
}

// User Question (for ask_user)
export interface UserQuestion {
  id: string;
  type: 'clarification' | 'choice' | 'confirmation' | 'freeform';
  question: string;
  context?: string;
  options?: string[];          // For choice type
  defaultValue?: string;
  required: boolean;
  timeout?: number;            // Auto-proceed after timeout
}

// User Response
export interface UserResponse {
  questionId: string;
  response: string;
  selectedOption?: number;
  timestamp: number;
  timedOut: boolean;
}

// Import these from other type files (forward declarations)
export interface GenerationOptions {
  projectId: string;
  projectName: string;
  prompt: string;
  userId?: string;
  preferredStack?: Record<string, string>;
  skipDeploy?: boolean;
  dryRun?: boolean;
  maxBudget?: number;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: FileType;
  size: number;
  description?: string;
  createdBy: AgentName;
  createdAt: number;
}

export type FileType =
  | 'page'
  | 'component'
  | 'api-route'
  | 'hook'
  | 'utility'
  | 'config'
  | 'style'
  | 'type'
  | 'test'
  | 'asset'
  | 'other';

export interface Task {
  id: string;
  name: string;
  description: string;
  agent: AgentName;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[];
  estimatedTokens: number;
  result?: TaskResult;
}

export type TaskStatus = 'pending' | 'ready' | 'running' | 'complete' | 'failed' | 'skipped';
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export interface TaskResult {
  success: boolean;
  data?: unknown;
  files?: GeneratedFile[];
  error?: string;
}

// Forward declarations for interfaces defined elsewhere
export interface EventEmitter {
  emit(event: OlympusEvent): void;
  on(type: string, handler: (event: OlympusEvent) => void): () => void;
}

export interface SandboxInterface {
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  deleteFile(path: string): Promise<boolean>;
  listFiles(pattern?: string): Promise<string[]>;
  runCommand(command: string): Promise<CommandResult>;
}

export interface MemoryInterface {
  store(entry: MemoryEntry): Promise<string>;
  search(query: string, limit?: number): Promise<MemoryEntry[]>;
}

export interface KnowledgeStoreInterface {
  write(path: string, content: string, version?: number): Promise<WriteResult>;
  read(path: string): Promise<VersionedDocument | null>;
  search(query: string): Promise<SearchResult[]>;
}

export interface BudgetTracker {
  recordUsage(agent: AgentName, tokens: number): void;
  getAgentBudget(agent: AgentName): AgentBudget;
  getTotalBudget(): TotalBudget;
  isOverBudget(): boolean;
}

// Placeholder types
export interface OlympusEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface MemoryEntry {
  id: string;
  type: string;
  content: string;
  embedding?: number[];
}

export interface WriteResult {
  success: boolean;
  version?: number;
  error?: string;
}

export interface VersionedDocument {
  path: string;
  content: string;
  version: number;
}

export interface SearchResult {
  path: string;
  content: string;
  relevance: number;
}

export interface TotalBudget {
  totalCalls: number;
  totalTokens: number;
  estimatedCost: number;
  remaining: number;
}
```

---

## File 3: `src/lib/engine/v14-olympus/types/events.ts`

### Purpose
Define the complete event taxonomy for inter-component communication.

### Exact Interface

```typescript
// Event Type Enum
export enum EventType {
  // Lifecycle Events
  GENERATION_STARTED = 'generation:started',
  GENERATION_PROGRESS = 'generation:progress',
  GENERATION_COMPLETED = 'generation:completed',
  GENERATION_FAILED = 'generation:failed',
  GENERATION_ABORTED = 'generation:aborted',

  // Phase Events
  PHASE_STARTED = 'phase:started',
  PHASE_PROGRESS = 'phase:progress',
  PHASE_COMPLETED = 'phase:completed',
  PHASE_FAILED = 'phase:failed',
  PHASE_TRANSITION = 'phase:transition',

  // Agent Events
  AGENT_STARTED = 'agent:started',
  AGENT_PROGRESS = 'agent:progress',
  AGENT_THINKING = 'agent:thinking',
  AGENT_TOOL_CALL = 'agent:tool_call',
  AGENT_TOOL_RESULT = 'agent:tool_result',
  AGENT_COMPLETED = 'agent:completed',
  AGENT_ERROR = 'agent:error',
  AGENT_WAITING = 'agent:waiting',

  // Knowledge Events
  KNOWLEDGE_WRITTEN = 'knowledge:written',
  KNOWLEDGE_UPDATED = 'knowledge:updated',
  KNOWLEDGE_DELETED = 'knowledge:deleted',
  KNOWLEDGE_CONFLICT = 'knowledge:conflict',

  // File Events
  FILE_CREATED = 'file:created',
  FILE_UPDATED = 'file:updated',
  FILE_DELETED = 'file:deleted',
  FILE_ERROR = 'file:error',

  // Build Events
  BUILD_STARTED = 'build:started',
  BUILD_PROGRESS = 'build:progress',
  BUILD_COMPLETED = 'build:completed',
  BUILD_FAILED = 'build:failed',

  // Test Events
  TEST_STARTED = 'test:started',
  TEST_PASSED = 'test:passed',
  TEST_FAILED = 'test:failed',
  TEST_COMPLETED = 'test:completed',

  // User Interaction Events
  USER_INPUT_REQUIRED = 'user:input_required',
  USER_INPUT_RECEIVED = 'user:input_received',
  USER_INPUT_TIMEOUT = 'user:input_timeout',

  // Recovery Events
  STUCK_DETECTED = 'recovery:stuck_detected',
  STRATEGY_SELECTED = 'recovery:strategy_selected',
  STRATEGY_APPLIED = 'recovery:strategy_applied',
  RECOVERY_SUCCESS = 'recovery:success',
  RECOVERY_FAILED = 'recovery:failed',

  // Checkpoint Events
  CHECKPOINT_CREATED = 'checkpoint:created',
  CHECKPOINT_RESTORED = 'checkpoint:restored',
  CHECKPOINT_DELETED = 'checkpoint:deleted',

  // Budget Events
  BUDGET_WARNING = 'budget:warning',
  BUDGET_CRITICAL = 'budget:critical',
  BUDGET_EXCEEDED = 'budget:exceeded',

  // Deploy Events
  DEPLOY_STARTED = 'deploy:started',
  DEPLOY_PROGRESS = 'deploy:progress',
  DEPLOY_COMPLETED = 'deploy:completed',
  DEPLOY_FAILED = 'deploy:failed',

  // System Events
  SYSTEM_ERROR = 'system:error',
  SYSTEM_WARNING = 'system:warning',
  SYSTEM_INFO = 'system:info',
}

// Base Event Interface
export interface OlympusEvent<T = unknown> {
  id: string;
  type: EventType;
  timestamp: number;
  sessionId: string;
  payload: T;
  metadata?: EventMetadata;
}

// Event Metadata
export interface EventMetadata {
  agent?: string;
  phase?: string;
  correlationId?: string;
  parentEventId?: string;
  tags?: string[];
}

// Specific Event Payloads

export interface GenerationStartedPayload {
  projectId: string;
  projectName: string;
  prompt: string;
  options: Record<string, unknown>;
}

export interface GenerationProgressPayload {
  phase: string;
  progress: number;
  message: string;
  filesGenerated: number;
}

export interface GenerationCompletedPayload {
  projectId: string;
  filesGenerated: number;
  tokensUsed: number;
  estimatedCost: number;
  duration: number;
  deployedUrl?: string;
}

export interface GenerationFailedPayload {
  error: string;
  code: string;
  phase: string;
  recoverable: boolean;
}

export interface PhaseTransitionPayload {
  from: string;
  to: string;
  reason: string;
}

export interface AgentProgressPayload {
  agent: string;
  task: string;
  progress: number;
  message: string;
  tokensUsed: number;
}

export interface AgentToolCallPayload {
  agent: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface AgentToolResultPayload {
  agent: string;
  tool: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

export interface FileCreatedPayload {
  path: string;
  type: string;
  size: number;
  createdBy: string;
}

export interface UserInputRequiredPayload {
  questionId: string;
  type: 'clarification' | 'choice' | 'confirmation' | 'freeform';
  question: string;
  context?: string;
  options?: string[];
  timeout?: number;
  reason: string;
}

export interface StuckDetectedPayload {
  indicators: {
    repeatedErrors: boolean;
    noProgress: boolean;
    circularAttempts: boolean;
    resourceExhausted: boolean;
    timeoutExceeded: boolean;
  };
  currentTask: string;
  agent: string;
  errorHistory: string[];
}

export interface StrategyAppliedPayload {
  strategy: string;
  attempt: number;
  success: boolean;
  result?: string;
}

export interface CheckpointCreatedPayload {
  checkpointId: string;
  phase: string;
  filesCount: number;
  sizeBytes: number;
  trigger: string;
}

export interface BudgetWarningPayload {
  type: 'warning' | 'critical' | 'exceeded';
  agent?: string;
  tokensUsed: number;
  tokensLimit: number;
  utilizationPercent: number;
}

export interface DeployCompletedPayload {
  url: string;
  previewUrl: string;
  buildTime: number;
  deployTime: number;
}

// Event Factory Function Type
export type CreateEvent = <T>(
  type: EventType,
  payload: T,
  metadata?: EventMetadata
) => OlympusEvent<T>;

// Event Handler Type
export type EventHandler<T = unknown> = (event: OlympusEvent<T>) => void | Promise<void>;

// Event Subscription
export interface EventSubscription {
  id: string;
  type: EventType | '*';
  handler: EventHandler;
  once: boolean;
}
```

---

## File 4: `src/lib/engine/v14-olympus/types/knowledge.ts`

### Purpose
Define types for the knowledge store system with versioning and concurrency control.

### Exact Interface

```typescript
import { AgentName } from './agents';

// Knowledge Document with Versioning
export interface VersionedDocument {
  path: string;
  content: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  createdBy: AgentName;
  updatedBy: AgentName;
  contentHash: string;           // SHA-256 of content
  metadata?: DocumentMetadata;
}

// Document Metadata
export interface DocumentMetadata {
  title?: string;
  description?: string;
  category: DocumentCategory;
  tags?: string[];
  relatedDocs?: string[];
  embedding?: number[];          // Vector embedding for search
  embeddingModel?: string;
}

// Document Categories
export type DocumentCategory =
  | 'requirements'
  | 'research'
  | 'architecture'
  | 'plan'
  | 'progress'
  | 'verification'
  | 'deployment'
  | 'error'
  | 'checkpoint'
  | 'metadata';

// Write Operation Result
export interface WriteResult {
  success: boolean;
  path: string;
  version: number;
  previousVersion?: number;
  error?: WriteError;
}

// Write Error Types
export interface WriteError {
  code: 'VERSION_CONFLICT' | 'INVALID_PATH' | 'CONTENT_TOO_LARGE' | 'PERMISSION_DENIED';
  message: string;
  currentVersion?: number;
  expectedVersion?: number;
}

// Read Options
export interface ReadOptions {
  version?: number;              // Read specific version
  includeHistory?: boolean;      // Include version history
  includeEmbedding?: boolean;    // Include vector embedding
}

// Search Result
export interface KnowledgeSearchResult {
  path: string;
  content: string;
  snippet: string;               // Relevant snippet
  relevance: number;             // 0-1 similarity score
  category: DocumentCategory;
  version: number;
  highlights?: string[];         // Highlighted matching terms
}

// Search Options
export interface SearchOptions {
  category?: DocumentCategory;
  minRelevance?: number;
  limit?: number;
  offset?: number;
  includeContent?: boolean;
  semantic?: boolean;            // Use embedding-based search
}

// Document Schema Definitions (what each document type should contain)

export interface RequirementsDocument {
  version: string;
  explicit: Requirement[];
  implicit: Requirement[];
  ambiguities: Ambiguity[];
  constraints: Constraint[];
  clarifications: Clarification[];
}

export interface Requirement {
  id: string;
  description: string;
  type: 'functional' | 'non-functional' | 'constraint';
  priority: 'must' | 'should' | 'could' | 'wont';
  source: 'explicit' | 'implicit' | 'inferred';
  status: 'pending' | 'covered' | 'partial' | 'blocked';
}

export interface Ambiguity {
  id: string;
  description: string;
  possibleInterpretations: string[];
  resolvedAs?: string;
  resolvedBy?: 'user' | 'inference';
}

export interface Constraint {
  type: 'tech' | 'budget' | 'time' | 'scope' | 'compliance';
  description: string;
  value?: string;
}

export interface Clarification {
  questionId: string;
  question: string;
  answer: string;
  timestamp: number;
}

export interface ResearchDocument {
  domain: string;
  sources: ResearchSource[];
  businessRules: string[];
  competitors: Competitor[];
  edgeCases: EdgeCase[];
  technicalRequirements: string[];
  confidence: ResearchConfidence;
}

export interface ResearchSource {
  url: string;
  title: string;
  type: 'documentation' | 'article' | 'competitor' | 'forum' | 'official';
  relevance: number;
  extractedInfo: string;
}

export interface Competitor {
  name: string;
  url?: string;
  features: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface EdgeCase {
  id: string;
  category: string;
  description: string;
  scenario: string;
  expectedBehavior: string;
  covered: boolean;
}

export interface ResearchConfidence {
  sourceCount: number;
  sourceQuality: number;
  consistency: number;
  coverage: number;
  overallScore: number;
}

export interface ArchitectureDocument {
  overview: string;
  stack: StackDecision[];
  fileStructure: FileStructureNode[];
  dataModels: DataModel[];
  apiEndpoints: APIEndpoint[];
  components: ComponentSpec[];
  integrations: Integration[];
}

export interface StackDecision {
  category: string;
  choice: string;
  reason: string;
  alternatives: string[];
}

export interface FileStructureNode {
  path: string;
  type: 'file' | 'directory';
  purpose: string;
  children?: FileStructureNode[];
}

export interface DataModel {
  name: string;
  description: string;
  fields: DataField[];
  relationships: DataRelationship[];
}

export interface DataField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  validation?: string;
}

export interface DataRelationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  target: string;
  field: string;
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: boolean;
  requestBody?: string;
  responseBody?: string;
}

export interface ComponentSpec {
  name: string;
  path: string;
  type: 'page' | 'component' | 'layout';
  props?: Record<string, string>;
  description: string;
}

export interface Integration {
  name: string;
  type: string;
  config: Record<string, string>;
  envVars: string[];
}

export interface PlanDocument {
  phases: PlanPhase[];
  tasks: PlanTask[];
  dependencies: TaskDependency[];
  estimatedTokens: number;
  estimatedFiles: number;
  coverageMatrix: CoverageEntry[];
}

export interface PlanPhase {
  id: string;
  name: string;
  description: string;
  tasks: string[];
  order: number;
}

export interface PlanTask {
  id: string;
  name: string;
  description: string;
  agent: AgentName;
  priority: 'critical' | 'high' | 'normal' | 'low';
  estimatedTokens: number;
  files: string[];
  coversRequirements: string[];
}

export interface TaskDependency {
  taskId: string;
  dependsOn: string[];
}

export interface CoverageEntry {
  requirementId: string;
  coveredBy: string[];     // Task IDs
  status: 'fully' | 'partially' | 'not_covered';
}

// Knowledge Store Interface
export interface KnowledgeStoreInterface {
  // Write with optimistic locking
  write(path: string, content: string, expectedVersion?: number): Promise<WriteResult>;

  // Read operations
  read(path: string, options?: ReadOptions): Promise<VersionedDocument | null>;
  readAll(prefix: string): Promise<VersionedDocument[]>;
  exists(path: string): Promise<boolean>;

  // Search operations
  search(query: string, options?: SearchOptions): Promise<KnowledgeSearchResult[]>;

  // Delete
  delete(path: string): Promise<boolean>;

  // Utility
  listPaths(prefix?: string): Promise<string[]>;
  getVersion(path: string): Promise<number | null>;

  // Subscriptions
  subscribe(path: string, callback: (doc: VersionedDocument) => void): () => void;
}

// Knowledge Store Event Types
export type KnowledgeEvent =
  | { type: 'written'; path: string; version: number }
  | { type: 'updated'; path: string; version: number; previousVersion: number }
  | { type: 'deleted'; path: string }
  | { type: 'conflict'; path: string; currentVersion: number; attemptedVersion: number };
```

---

## Files 5-6: `src/lib/engine/v14-olympus/types/tasks.ts` and `generation.ts`

Similar detailed specifications for task DAG and generation types.

---

## File 7: `src/lib/engine/v14-olympus/types/index.ts`

### Purpose
Barrel export for all types.

```typescript
export * from './agents';
export * from './events';
export * from './knowledge';
export * from './tasks';
export * from './generation';
export * from './messages';
```

---

## File 8: `src/lib/engine/v14-olympus/core/event-stream.ts`

### Purpose
Event bus for real-time communication between components.

### Key Features
- Typed event emission
- Multiple subscriber support
- Event history (last 1000 events)
- SSE serialization for client streaming
- Async event handling

### Interface

```typescript
export class EventStream {
  // Emit an event to all subscribers
  emit<T>(type: EventType, payload: T, metadata?: EventMetadata): void;

  // Subscribe to specific event type
  on<T>(type: EventType, handler: EventHandler<T>): Unsubscribe;

  // Subscribe to all events
  onAny(handler: EventHandler): Unsubscribe;

  // One-time subscription
  once<T>(type: EventType, handler: EventHandler<T>): Unsubscribe;

  // Get event history
  getHistory(limit?: number, filter?: EventType): OlympusEvent[];

  // Clear history
  clearHistory(): void;

  // Serialize for SSE
  toSSE(event: OlympusEvent): string;

  // Wait for specific event
  waitFor<T>(type: EventType, timeout?: number): Promise<OlympusEvent<T>>;
}
```

---

## File 9: `src/lib/engine/v14-olympus/core/budget-tracker.ts`

### Purpose
Track token usage, costs, and context window utilization per agent and total.

### Key Features
- Per-agent token tracking
- Cost estimation (input/output tokens)
- Context window monitoring
- Threshold warnings at 70%, 85%, 95%
- Auto-compression triggers

### Interface

```typescript
export class BudgetTracker {
  constructor(config: BudgetConfig);

  // Record usage
  recordUsage(agent: AgentName, inputTokens: number, outputTokens: number): void;

  // Get agent budget
  getAgentBudget(agent: AgentName): AgentBudget;

  // Get total budget
  getTotalBudget(): TotalBudget;

  // Check status
  isAgentOverBudget(agent: AgentName): boolean;
  isTotalOverBudget(): boolean;

  // Context window
  getContextUtilization(): ContextState;
  shouldCompress(): boolean;

  // Warnings
  getWarnings(): BudgetWarning[];

  // Reset
  reset(): void;
}

interface ContextState {
  currentTokens: number;
  maxTokens: number;
  utilizationPercent: number;
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
}

interface BudgetWarning {
  type: 'agent_warning' | 'agent_critical' | 'total_warning' | 'context_warning';
  agent?: AgentName;
  message: string;
  utilizationPercent: number;
  timestamp: number;
}
```

---

## File 10: `src/lib/engine/v14-olympus/core/state-machine.ts`

### Purpose
Manage phase transitions with validation and history.

### Key Features
- Valid transition enforcement
- Transition guards
- History tracking
- Rollback support

### Interface

```typescript
export class StateMachine {
  constructor(initialState: Phase, transitions: TransitionMap);

  // Get current phase
  getCurrentPhase(): Phase;

  // Attempt transition
  transition(to: Phase, reason?: string): TransitionResult;

  // Check if transition is valid
  canTransition(to: Phase): boolean;

  // Get valid next states
  getValidTransitions(): Phase[];

  // History
  getHistory(): TransitionRecord[];

  // Rollback to previous phase
  rollback(): boolean;

  // Events
  onTransition(callback: TransitionCallback): Unsubscribe;
}

interface TransitionResult {
  success: boolean;
  from: Phase;
  to: Phase;
  error?: string;
}

interface TransitionRecord {
  from: Phase;
  to: Phase;
  reason?: string;
  timestamp: number;
}
```

---

## File 11: `src/lib/engine/v14-olympus/core/checkpoint-manager.ts`

### Purpose
Create, store, and restore checkpoints for recovery.

### Key Features
- Incremental checkpoint storage
- Size limits (50MB per checkpoint)
- Retention policy (keep latest 5)
- Phase-based triggers
- Full state restoration

### Interface

```typescript
export class CheckpointManager {
  constructor(config: CheckpointConfig);

  // Create checkpoint
  create(trigger: CheckpointTrigger): Promise<Checkpoint>;

  // Restore from checkpoint
  restore(checkpointId: string): Promise<RestoreResult>;

  // List checkpoints
  list(): Checkpoint[];

  // Get specific checkpoint
  get(checkpointId: string): Checkpoint | null;

  // Delete checkpoint
  delete(checkpointId: string): boolean;

  // Cleanup old checkpoints
  cleanup(): number;  // Returns number deleted

  // Get total size
  getTotalSize(): number;
}

interface Checkpoint {
  id: string;
  phase: Phase;
  createdAt: number;
  trigger: CheckpointTrigger;
  sizeBytes: number;
  filesCount: number;
  knowledgeSnapshot: string[];   // Paths
  sandboxSnapshot: string[];     // Paths
}

interface RestoreResult {
  success: boolean;
  checkpoint: Checkpoint;
  error?: string;
  restoredFiles: number;
}

type CheckpointTrigger =
  | 'phase_completed'
  | 'major_milestone'
  | 'before_risky_operation'
  | 'manual';
```

---

## File 12: `src/lib/engine/v14-olympus/index.ts`

### Purpose
Main entry point and exports.

```typescript
// Re-export types
export * from './types';

// Re-export config
export * from './config';

// Export core classes
export { EventStream } from './core/event-stream';
export { BudgetTracker } from './core/budget-tracker';
export { StateMachine } from './core/state-machine';
export { CheckpointManager } from './core/checkpoint-manager';

// Version info
export const VERSION = '14.0.0';
export const CODENAME = 'Olympus';
```

---

## Verification Checklist

After Phase 1 implementation:

- [ ] `pnpm tsc --noEmit` passes with no errors
- [ ] All types are properly exported from index
- [ ] No circular dependencies
- [ ] EventStream can emit and receive events
- [ ] BudgetTracker correctly tracks tokens per agent
- [ ] StateMachine enforces valid transitions only
- [ ] CheckpointManager can create and restore checkpoints
- [ ] All interfaces match the specification exactly

---

## Dependencies

Phase 1 has no external dependencies beyond:
- TypeScript standard library
- uuid (for ID generation)
- crypto (for hashing)

---

## Next Phase

Once Phase 1 is complete and verified, proceed to **Phase 2: Knowledge & Memory**.
