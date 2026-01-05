# FlowFace V14 OLYMPUS: Complete Implementation Plan

## Status: PLANNING PHASE (Do NOT implement yet)

**Previous Documentation:** V13 OLYMPUS Complete at `docs/V13_OLYMPUS_COMPLETE.md`

---

# EXECUTIVE SUMMARY

This plan addresses **15 critical gaps** identified in V13 OLYMPUS and provides a **precise, phase-by-phase implementation blueprint**.

## Critical Gaps Fixed in This Plan

| # | Gap | Problem | Solution in V14 |
|---|-----|---------|-----------------|
| 1 | `analyzeChangeImpact()` undefined | No algorithm for detecting change severity | Explicit impact classification algorithm |
| 2 | `validateArchitectureCoverage()` undefined | No proof of requirement coverage | Requirement-to-implementation tracing matrix |
| 3 | Confidence calculation incomplete | Threshold checks exist, formula missing | Explicit confidence scoring with weighted factors |
| 4 | Pattern matching weights unjustified | Magic numbers (0.6/0.4) | Empirical justification + configurable weights |
| 5 | Knowledge store race conditions | No transaction isolation | Optimistic locking with version numbers |
| 6 | Event stream schema undefined | No event types defined | Complete event taxonomy with TypeScript types |
| 7 | Recovery strategy selection missing | No decision tree for 7 strategies | Priority-ordered decision algorithm |
| 8 | Resource exhaustion handling undefined | No context window management | Token budget tracking with compression triggers |
| 9 | Independent test generation undefined | How requirements → tests? | Requirement → Acceptance Criteria → Test Case pipeline |
| 10 | Complexity scoring weights unexplained | Why integrations * 5? | Complexity factor justification table |
| 11 | "All strategies fail" case undefined | No final escalation | Human escalation protocol with context package |
| 12 | Inter-agent communication undefined | No message schemas | Typed message envelopes with routing |
| 13 | Checkpoint management undefined | Storage/size limits? | Checkpoint retention policy (max 5, incremental) |
| 14 | Post-gen change classification unclear | Cosmetic vs architectural? | Explicit change taxonomy with decision tree |
| 15 | Web research validation missing | How to verify research quality? | Research confidence scoring + source triangulation |

---

# PART I: ARCHIVE STRATEGY

Before implementation, archive ALL existing code to preserve history.

## Files to Archive

```
/archive/v1-v12/
├── src/lib/engine/v9/           → Move entirely
├── src/lib/engine/v10/          → Move entirely
├── src/lib/engine/v11/          → Move entirely (keep as reference)
├── src/lib/engine/v12-aurora/   → Move entirely
├── src/lib/engine/v12-hybrid/   → Move entirely
├── src/lib/engine/v13-prometheus/ → Move entirely (incomplete)
├── docs/archive/                → Already archived
└── docs/ENGINE_V*.md            → Move to docs/archive/
```

## Files to Keep

```
/src/lib/engine/
├── core/                        → Keep (shared utilities)
├── templates/                   → Keep (base templates)
└── v14-olympus/                 → NEW (create fresh)
```

---

# PART II: V14 OLYMPUS ARCHITECTURE

## 2.1 Agent Naming (Simplified from 8 to 7)

| Agent | Role | Model | Model ID | Budget |
|-------|------|-------|----------|--------|
| **ZEUS** | Orchestrator | Opus 4.5 | `claude-opus-4-5-20251101` | 50 calls |
| **HERMES** | Intake & Clarification | Sonnet 4.5 | `claude-sonnet-4-5-20250929` | 10 calls |
| **ATHENA** | Research & Architecture | Sonnet 4.5 | `claude-sonnet-4-5-20250929` | 50 calls |
| **HEPHAESTUS** | Code Generation | Sonnet 4.5 | `claude-sonnet-4-5-20250929` | 300 calls |
| **APOLLO** | Verification & Testing | Sonnet 4.5 | `claude-sonnet-4-5-20250929` | 40 calls |
| **ARTEMIS** | Deployment | Sonnet 4.5 | `claude-sonnet-4-5-20250929` | 15 calls |
| **MNEMOSYNE** | Memory (passive) | Haiku 4.5 | `claude-haiku-4-5-20251001` | 20 calls |

**Note:** Mnemosyne is a passive memory service, not an active agent. Heracles merged into Hephaestus (builder runs its own tests).

## 2.2 Phase Flow

```
INTAKE → RESEARCH → ARCHITECTURE → PLAN_VALIDATION → BUILDING → VERIFICATION → DEPLOYMENT
   ↓         ↓            ↓              ↓              ↓           ↓            ↓
 Hermes   Athena      Athena         Zeus        Hephaestus    Apollo      Artemis
```

## 2.3 Directory Structure

```
src/lib/engine/v14-olympus/
├── index.ts                      # Main export
├── config.ts                     # Configuration constants
├── types/
│   ├── index.ts                  # Re-exports
│   ├── agents.ts                 # Agent types
│   ├── tasks.ts                  # Task/DAG types
│   ├── knowledge.ts              # Knowledge store types
│   ├── events.ts                 # Event stream types
│   ├── messages.ts               # Inter-agent message types
│   └── generation.ts             # Generation options/result types
├── core/
│   ├── orchestrator.ts           # Zeus implementation
│   ├── event-stream.ts           # Event bus
│   ├── state-machine.ts          # Phase transitions
│   ├── budget-tracker.ts         # Token/cost tracking
│   └── checkpoint-manager.ts     # Checkpoint/rollback
├── agents/
│   ├── base-agent.ts             # Abstract base class
│   ├── hermes.ts                 # Intake agent
│   ├── athena.ts                 # Research agent
│   ├── hephaestus.ts             # Builder agent
│   ├── apollo.ts                 # Verification agent
│   └── artemis.ts                # Deployment agent
├── knowledge/
│   ├── store.ts                  # Knowledge store implementation
│   ├── indexer.ts                # Semantic indexing
│   └── schema.ts                 # Document schemas
├── memory/
│   ├── interface.ts              # Memory interface
│   ├── embeddings.ts             # Embedding generation
│   └── retrieval.ts              # Semantic retrieval
├── verification/
│   ├── static-analyzer.ts        # ESLint integration
│   ├── type-checker.ts           # TypeScript checking
│   ├── test-generator.ts         # Independent test generation
│   ├── test-runner.ts            # Jest/Playwright runner
│   └── security-scanner.ts       # Security checks
├── recovery/
│   ├── stuck-detector.ts         # Detect stuck states
│   ├── strategy-selector.ts      # Choose recovery strategy
│   └── strategies/               # Individual strategies
│       ├── retry-with-context.ts
│       ├── simplify-approach.ts
│       ├── alternative-solution.ts
│       ├── decompose-task.ts
│       ├── skip-and-stub.ts
│       ├── rollback.ts
│       └── human-escalation.ts
├── sandbox/
│   ├── memory-sandbox.ts         # In-memory file system
│   └── command-executor.ts       # Shell command execution
├── tools/
│   ├── definitions.ts            # Tool schemas
│   ├── executor.ts               # Tool execution
│   └── registry.ts               # Tool registry
├── prompts/
│   ├── hermes-system.ts
│   ├── athena-research.ts
│   ├── athena-architecture.ts
│   ├── hephaestus-builder.ts
│   ├── apollo-reviewer.ts
│   └── artemis-deployer.ts
└── api/
    └── route.ts                  # SSE streaming endpoint
```

---

# PART III: IMPLEMENTATION PHASES

## PHASE 1: Core Foundation (Files: 12)

**Goal:** Establish the foundational infrastructure that all other components depend on.

### Step 1.1: Configuration
**File:** `src/lib/engine/v14-olympus/config.ts`

```typescript
// Contents:
// - V14_VERSION, V14_CODENAME
// - V14_AGENT_BUDGETS (7 agents with token limits)
// - V14_PHASES enum
// - V14_MODEL_CONFIG (primary: claude-sonnet-4-5-20250929, haiku: claude-haiku-4-5-20251001, opus: claude-opus-4-5-20251101)
// - V14_COMPLEXITY_TIERS (Simple/Medium/Complex/Epic)
// - V14_CONFIDENCE_THRESHOLDS (explicit values with justification)
// - V14_ERROR_CODES
// - V14_RECOVERY_STRATEGY_PRIORITY (ordered list)
```

**Verification:** TypeScript compiles without errors.

### Step 1.2: Type Definitions
**Files:** `src/lib/engine/v14-olympus/types/*.ts` (6 files)

```typescript
// agents.ts - Agent names, status, state interfaces
// tasks.ts - Task, TaskGraph, TaskResult
// knowledge.ts - KnowledgeStore, KnowledgeDocument
// events.ts - EventType enum, Event interfaces (CRITICAL - addresses Gap #6)
// messages.ts - InterAgentMessage, MessageEnvelope (CRITICAL - addresses Gap #12)
// generation.ts - GenerationOptions, GenerationResult
```

**Event Types (Gap #6 Fix):**
```typescript
export enum EventType {
  // Lifecycle
  GENERATION_STARTED = 'generation:started',
  GENERATION_COMPLETED = 'generation:completed',
  GENERATION_FAILED = 'generation:failed',

  // Phase transitions
  PHASE_STARTED = 'phase:started',
  PHASE_COMPLETED = 'phase:completed',

  // Agent events
  AGENT_STARTED = 'agent:started',
  AGENT_PROGRESS = 'agent:progress',
  AGENT_COMPLETED = 'agent:completed',
  AGENT_ERROR = 'agent:error',

  // Knowledge events
  KNOWLEDGE_WRITTEN = 'knowledge:written',
  KNOWLEDGE_UPDATED = 'knowledge:updated',

  // File events
  FILE_CREATED = 'file:created',
  FILE_UPDATED = 'file:updated',

  // User interaction
  USER_INPUT_REQUIRED = 'user:input_required',
  USER_INPUT_RECEIVED = 'user:input_received',

  // Recovery
  STUCK_DETECTED = 'recovery:stuck_detected',
  STRATEGY_APPLIED = 'recovery:strategy_applied',

  // Checkpoints
  CHECKPOINT_CREATED = 'checkpoint:created',
  CHECKPOINT_RESTORED = 'checkpoint:restored',
}
```

**Verification:** All types export correctly, no circular dependencies.

### Step 1.3: Event Stream
**File:** `src/lib/engine/v14-olympus/core/event-stream.ts`

```typescript
// Implementation:
// - EventEmitter with typed events
// - Subscriber registration/unregistration
// - Event history (last 1000 events)
// - SSE serialization
```

**Verification:** Unit test for event emission and subscription.

### Step 1.4: Budget Tracker
**File:** `src/lib/engine/v14-olympus/core/budget-tracker.ts`

```typescript
// Implementation:
// - Per-agent token tracking
// - Cost estimation ($3/million input, $15/million output)
// - Budget exhaustion warnings at 80%, 90%, 95%
// - Context window tracking (Gap #8 Fix)
```

**Context Window Management (Gap #8 Fix):**
```typescript
interface ContextState {
  currentTokens: number;
  maxTokens: number;  // 200,000 for Claude
  utilizationPercent: number;

  // Thresholds
  warningThreshold: 0.7;   // 70% - start summarizing old context
  criticalThreshold: 0.85; // 85% - aggressive compression
  maxThreshold: 0.95;      // 95% - refuse new tasks until compressed
}

// When hitting thresholds:
// 1. Warning (70%): Summarize completed task contexts
// 2. Critical (85%): Compress knowledge store reads to summaries
// 3. Max (95%): Block new agent calls, force compression
```

**Verification:** Unit tests for budget tracking and threshold triggers.

### Step 1.5: State Machine
**File:** `src/lib/engine/v14-olympus/core/state-machine.ts`

```typescript
// Implementation:
// - Phase transitions with guards
// - Invalid transition rejection
// - Transition history
// - Rollback support
```

**Verification:** Unit test for valid/invalid transitions.

### Step 1.6: Checkpoint Manager
**File:** `src/lib/engine/v14-olympus/core/checkpoint-manager.ts`

**Checkpoint Policy (Gap #13 Fix):**
```typescript
interface CheckpointPolicy {
  maxCheckpoints: 5;           // Keep max 5 checkpoints
  checkpointTriggers: [
    'phase_completed',         // After each phase
    'major_milestone',         // After 50+ files generated
    'before_risky_operation',  // Before deploy, before major refactor
  ];

  // Storage strategy
  storageType: 'incremental';  // Only store diffs from previous
  maxCheckpointSize: '50MB';   // Per checkpoint

  // Retention
  retentionPolicy: 'keep_latest_5';
  autoCleanup: true;
}
```

**Verification:** Create/restore checkpoint test.

---

## PHASE 2: Knowledge & Memory (Files: 6)

**Goal:** Implement the knowledge store with proper concurrency handling.

### Step 2.1: Knowledge Store Schema
**File:** `src/lib/engine/v14-olympus/knowledge/schema.ts`

```typescript
// Document types for each knowledge category:
// - RequirementsDocument
// - ResearchDocument
// - ArchitectureDocument
// - PlanDocument
// - BuildLogDocument
// - VerificationDocument
```

### Step 2.2: Knowledge Store Implementation
**File:** `src/lib/engine/v14-olympus/knowledge/store.ts`

**Concurrency Handling (Gap #5 Fix):**
```typescript
interface VersionedDocument {
  path: string;
  content: string;
  version: number;          // Incremented on each write
  lastModifiedBy: AgentName;
  lastModifiedAt: number;
}

class KnowledgeStore {
  // Optimistic locking for writes
  async write(path: string, content: string, expectedVersion?: number): Promise<WriteResult> {
    const current = await this.read(path);

    if (expectedVersion !== undefined && current?.version !== expectedVersion) {
      return {
        success: false,
        error: 'VERSION_CONFLICT',
        currentVersion: current?.version,
        expectedVersion,
      };
    }

    // Write with incremented version
    const newVersion = (current?.version ?? 0) + 1;
    await this.storage.set(path, {
      content,
      version: newVersion,
      lastModifiedBy: this.currentAgent,
      lastModifiedAt: Date.now(),
    });

    return { success: true, version: newVersion };
  }

  // Read with version info
  async read(path: string): Promise<VersionedDocument | null>;

  // Watch for changes
  subscribe(path: string, callback: (doc: VersionedDocument) => void): Unsubscribe;
}
```

**Verification:** Concurrent write test with version conflicts.

### Step 2.3: Semantic Indexer
**File:** `src/lib/engine/v14-olympus/knowledge/indexer.ts`

```typescript
// Implementation:
// - Embedding generation with OpenAI text-embedding-3-small
// - In-memory vector store for search
// - Index update on document write
// - Relevance scoring with cosine similarity
```

### Step 2.4: Memory Interface
**File:** `src/lib/engine/v14-olympus/memory/interface.ts`

```typescript
// Mnemosyne's domain:
// - Store patterns from successful generations
// - Store error patterns to avoid
// - Cross-project learning (anonymized)
```

### Step 2.5: Embeddings Service
**File:** `src/lib/engine/v14-olympus/memory/embeddings.ts`

```typescript
// OpenAI embeddings with caching
// Batch embedding for efficiency
// 1536-dimensional vectors
```

### Step 2.6: Retrieval Service
**File:** `src/lib/engine/v14-olympus/memory/retrieval.ts`

```typescript
// Semantic search across memory
// Relevance threshold: 0.7
// Max results: 10
```

**Verification:** Search accuracy test with known documents.

---

## PHASE 3: Agent Implementation (Files: 7)

**Goal:** Implement all 6 active agents with proper tool access.

### Step 3.1: Base Agent
**File:** `src/lib/engine/v14-olympus/agents/base-agent.ts`

```typescript
abstract class BaseAgent {
  // Core properties
  protected name: AgentName;
  protected model: string;
  protected budget: AgentBudget;
  protected context: AgentContext;

  // Abstract methods
  abstract getSystemPrompt(): string;
  abstract getTools(): Tool[];
  abstract run(): Promise<AgentResult>;

  // Shared methods
  protected async callLLM(messages: Message[]): Promise<LLMResponse>;
  protected async useTool(name: string, args: unknown): Promise<ToolResult>;
  protected async writeKnowledge(path: string, content: string): Promise<void>;
  protected async readKnowledge(path: string): Promise<string | null>;
  protected async emit(event: Event): Promise<void>;

  // Confidence calculation (Gap #3 Fix)
  protected calculateConfidence(factors: ConfidenceFactors): number {
    const weights = {
      promptClarity: 0.25,      // How clear is the requirement?
      domainFamiliarity: 0.20,  // Do we have patterns for this?
      technicalCertainty: 0.25, // Are the tech choices clear?
      scopeDefinition: 0.15,    // Is scope well-defined?
      edgeCaseCoverage: 0.15,   // Are edge cases identified?
    };

    let score = 0;
    for (const [factor, weight] of Object.entries(weights)) {
      score += (factors[factor] ?? 0.5) * weight;
    }

    return score;
  }
}
```

### Step 3.2: Hermes (Intake)
**File:** `src/lib/engine/v14-olympus/agents/hermes.ts`

```typescript
// Responsibilities:
// 1. Parse user prompt
// 2. Extract explicit requirements
// 3. Identify implicit requirements
// 4. Detect ambiguities
// 5. Ask clarifying questions if confidence < 0.7
// 6. Write to /knowledge/requirements/

// Tools: ask_user, write_knowledge

// Output: RequirementsDocument with:
// - Explicit requirements (user stated)
// - Implicit requirements (inferred)
// - Ambiguities (need clarification)
// - Constraints (tech, budget, timeline)
```

### Step 3.3: Athena (Research & Architecture)
**File:** `src/lib/engine/v14-olympus/agents/athena.ts`

```typescript
// Responsibilities:
// 1. Research domain (any domain dynamically)
// 2. Research competitors
// 3. Identify edge cases
// 4. Design architecture
// 5. Create file structure
// 6. Design database schema
// 7. Define API contracts

// Tools: web_search, web_fetch, write_knowledge, read_knowledge

// Research Confidence Scoring (Gap #15 Fix):
interface ResearchConfidence {
  sourceCount: number;        // How many sources found?
  sourceQuality: number;      // Are sources authoritative?
  consistency: number;        // Do sources agree?
  coverage: number;           // How much of the domain is covered?

  // Calculation
  score: (sourceCount >= 3 ? 0.3 : sourceCount * 0.1)
       + (sourceQuality * 0.3)
       + (consistency * 0.2)
       + (coverage * 0.2);

  // If score < 0.6, do more research
  // If score < 0.4 after 3 attempts, flag for human review
}
```

### Step 3.4: Hephaestus (Builder)
**File:** `src/lib/engine/v14-olympus/agents/hephaestus.ts`

```typescript
// Responsibilities:
// 1. Generate code files based on architecture
// 2. Apply patterns from pattern library
// 3. Run incremental builds
// 4. Fix build errors
// 5. Run unit tests as it builds

// Tools: write_file, read_file, run_command, read_knowledge, apply_pattern

// Pattern Matching Weights (Gap #4 Fix):
const PATTERN_WEIGHTS = {
  semanticSimilarity: 0.50,  // Embedding cosine similarity
  keywordOverlap: 0.25,      // Keyword matching
  structuralMatch: 0.15,     // Does the feature shape match pattern?
  complexityMatch: 0.10,     // Is complexity level appropriate?

  // Justification:
  // - Semantic similarity is most important (natural language understanding)
  // - Keywords catch domain-specific terms
  // - Structure ensures architectural fit
  // - Complexity prevents over/under-engineering
};
```

### Step 3.5: Apollo (Verification)
**File:** `src/lib/engine/v14-olympus/agents/apollo.ts`

```typescript
// Responsibilities:
// 1. Static analysis (ESLint)
// 2. Type checking (TypeScript)
// 3. Security scanning (basic patterns)
// 4. Generate independent tests from requirements
// 5. Run E2E tests with Playwright
// 6. Verify requirement coverage

// Tools: run_command, read_file, read_knowledge, write_file

// Independent Test Generation (Gap #9 Fix):
async generateTestsFromRequirements(): Promise<TestSuite> {
  const requirements = await this.readKnowledge('requirements/requirements.md');
  const tests: TestCase[] = [];

  for (const requirement of requirements.items) {
    // Step 1: Requirement → Acceptance Criteria
    const criteria = await this.llm.complete(`
      Given this requirement: "${requirement.description}"

      Generate 3-5 acceptance criteria that would prove this requirement is met.
      Format:
      - GIVEN: [precondition]
      - WHEN: [action]
      - THEN: [expected outcome]
    `);

    // Step 2: Acceptance Criteria → Test Cases
    for (const criterion of criteria) {
      const testCode = await this.llm.complete(`
        Generate a Playwright E2E test for this acceptance criterion:
        ${criterion}

        The test should:
        1. Set up the precondition (GIVEN)
        2. Perform the action (WHEN)
        3. Assert the expected outcome (THEN)
      `);

      tests.push({
        requirementId: requirement.id,
        criterion: criterion,
        code: testCode,
        type: 'e2e',
      });
    }
  }

  return { tests };
}
```

### Step 3.6: Artemis (Deployment)
**File:** `src/lib/engine/v14-olympus/agents/artemis.ts`

```typescript
// Responsibilities:
// 1. Prepare production build
// 2. Configure environment variables
// 3. Deploy to Vercel
// 4. Verify deployment
// 5. Run smoke tests on deployed URL

// Tools: run_command, write_file, deploy_vercel, read_knowledge
```

### Step 3.7: Zeus (Orchestrator)
**File:** `src/lib/engine/v14-olympus/core/orchestrator.ts`

```typescript
// Responsibilities:
// 1. Manage phase transitions
// 2. Coordinate agent execution
// 3. Handle conflicts between agents
// 4. Manage checkpoints
// 5. Detect and recover from stuck states

// Plan Validation (Gap #2 Fix):
async validatePlanCoverage(requirements: Requirement[], plan: Plan): Promise<CoverageReport> {
  const coverage: Map<string, PlanItem[]> = new Map();

  for (const requirement of requirements) {
    const matchingItems = plan.items.filter(item =>
      this.doesItemCoverRequirement(item, requirement)
    );

    coverage.set(requirement.id, matchingItems);
  }

  // Calculate coverage
  const covered = [...coverage.values()].filter(items => items.length > 0).length;
  const total = requirements.length;
  const percentage = (covered / total) * 100;

  // Identify gaps
  const gaps = requirements.filter(req =>
    (coverage.get(req.id) ?? []).length === 0
  );

  return {
    percentage,
    covered,
    total,
    gaps,
    isComplete: gaps.length === 0,
  };
}

// If gaps.length > 0, send back to Athena for re-planning
```

**Verification:** Each agent has unit tests for core functionality.

---

## PHASE 4: Recovery System (Files: 8)

**Goal:** Implement robust stuck detection and recovery.

### Step 4.1: Stuck Detector
**File:** `src/lib/engine/v14-olympus/recovery/stuck-detector.ts`

```typescript
interface StuckIndicators {
  repeatedErrors: boolean;      // Same error 3+ times
  noProgress: boolean;          // 5 iterations, no file changes
  circularAttempts: boolean;    // Same approach tried 50%+ times
  resourceExhausted: boolean;   // Context window > 90%
  timeoutExceeded: boolean;     // Task running > 10 minutes
}

function detectStuck(history: AgentHistory): StuckIndicators;
```

### Step 4.2: Strategy Selector
**File:** `src/lib/engine/v14-olympus/recovery/strategy-selector.ts`

**Strategy Selection Algorithm (Gap #7 Fix):**
```typescript
// Priority order (try in sequence):
const STRATEGY_PRIORITY = [
  'retry_with_more_context',    // First: Maybe it needs more info
  'simplify_approach',          // Second: Maybe it's too complex
  'alternative_solution',       // Third: Try different approach
  'decompose_task',             // Fourth: Break into smaller pieces
  'skip_and_stub',              // Fifth: Stub it, continue
  'rollback_checkpoint',        // Sixth: Go back to last good state
  'human_escalation',           // Last resort: Ask human
];

function selectStrategy(stuck: StuckIndicators, history: RecoveryHistory): Strategy {
  const triedStrategies = history.getTriedStrategies();

  for (const strategyName of STRATEGY_PRIORITY) {
    const strategy = strategies[strategyName];

    // Skip if already tried this strategy for this stuck state
    if (triedStrategies.has(strategyName)) continue;

    // Check if strategy is applicable
    if (strategy.isApplicable(stuck)) {
      return strategy;
    }
  }

  // All strategies exhausted (Gap #11 Fix)
  return strategies.human_escalation;
}
```

### Step 4.3-4.9: Individual Strategies
**Files:** `src/lib/engine/v14-olympus/recovery/strategies/*.ts`

Each strategy has:
- `isApplicable(stuck: StuckIndicators): boolean`
- `apply(context: RecoveryContext): Promise<RecoveryResult>`
- `maxAttempts: number`

**Human Escalation Strategy (Gap #11 Fix):**
```typescript
class HumanEscalationStrategy implements Strategy {
  async apply(context: RecoveryContext): Promise<RecoveryResult> {
    // Package context for human review
    const escalationPackage = {
      // What we were trying to do
      task: context.currentTask,
      requirement: context.relatedRequirement,

      // What went wrong
      stuckIndicators: context.stuckIndicators,
      errorHistory: context.recentErrors,

      // What we tried
      strategiesAttempted: context.recoveryHistory,

      // Current state
      filesGenerated: context.sandbox.listFiles(),
      knowledgeState: await this.summarizeKnowledge(),

      // Suggested options for human
      suggestedActions: [
        'Simplify the requirement',
        'Provide more specific guidance',
        'Skip this feature',
        'Abort generation',
      ],
    };

    // Emit event for UI to show
    await this.emit({
      type: EventType.USER_INPUT_REQUIRED,
      payload: {
        reason: 'RECOVERY_EXHAUSTED',
        package: escalationPackage,
      },
    });

    // Wait for human response
    const response = await this.waitForUserInput();

    return this.applyHumanDecision(response);
  }
}
```

---

## PHASE 5: Verification Engine (Files: 5)

**Goal:** Implement 8-layer verification system.

### Step 5.1: Static Analyzer
**File:** `src/lib/engine/v14-olympus/verification/static-analyzer.ts`

```typescript
// ESLint integration
// Run on all generated .ts/.tsx files
// Parse results, categorize by severity
```

### Step 5.2: Type Checker
**File:** `src/lib/engine/v14-olympus/verification/type-checker.ts`

```typescript
// TypeScript compiler API
// Check all files for type errors
// Report with line numbers and suggestions
```

### Step 5.3: Test Generator
**File:** `src/lib/engine/v14-olympus/verification/test-generator.ts`

```typescript
// Generate tests from requirements (not from code)
// Use acceptance criteria as test basis
// Playwright for E2E, Jest for unit
```

### Step 5.4: Test Runner
**File:** `src/lib/engine/v14-olympus/verification/test-runner.ts`

```typescript
// Jest test execution
// Playwright E2E execution
// Coverage reporting
```

### Step 5.5: Security Scanner
**File:** `src/lib/engine/v14-olympus/verification/security-scanner.ts`

```typescript
// Pattern-based security checks:
// - Hardcoded secrets
// - SQL injection patterns
// - XSS vulnerabilities
// - Unsafe eval usage
// - Exposed API keys
```

---

## PHASE 6: Integration & API (Files: 4)

**Goal:** Wire everything together and expose via API.

### Step 6.1: Tool Definitions
**File:** `src/lib/engine/v14-olympus/tools/definitions.ts`

```typescript
// All tools available to agents:
// - write_file, read_file, delete_file, list_files
// - run_command
// - web_search, web_fetch
// - write_knowledge, read_knowledge, search_knowledge
// - ask_user
// - deploy_vercel
// - apply_pattern
```

### Step 6.2: Tool Executor
**File:** `src/lib/engine/v14-olympus/tools/executor.ts`

```typescript
// Execute tools in sandbox
// Handle errors gracefully
// Log all tool calls
```

### Step 6.3: Sandbox
**File:** `src/lib/engine/v14-olympus/sandbox/memory-sandbox.ts`

```typescript
// In-memory file system
// Command execution (build, test, lint)
// File watching
// Snapshot/restore
```

### Step 6.4: API Route
**File:** `src/app/api/generate/v14/route.ts`

```typescript
// SSE streaming endpoint
// Initialize orchestrator
// Stream events to client
// Handle user responses
```

---

## PHASE 7: Change Impact Analysis (Addressing Gap #1 & #14)

**File:** `src/lib/engine/v14-olympus/core/change-analyzer.ts`

**Change Classification Taxonomy (Gap #14 Fix):**
```typescript
type ChangeCategory = 'COSMETIC' | 'FEATURE' | 'ARCHITECTURAL' | 'BREAKING';

interface ChangeClassification {
  category: ChangeCategory;
  confidence: number;
  affectedFiles: string[];
  affectedSystems: string[];  // 'database' | 'api' | 'auth' | 'ui'
  requiresReplan: boolean;
  requiresRebuild: boolean;
}

function classifyChange(change: ChangeRequest): ChangeClassification {
  const indicators = {
    // COSMETIC indicators (just styling/text)
    touchesOnlyStyles: checkStylesOnly(change),
    touchesOnlyText: checkTextOnly(change),
    noLogicChanges: !containsLogicKeywords(change),

    // FEATURE indicators (adds new capability)
    addsNewEndpoint: containsEndpointKeywords(change),
    addsNewComponent: containsComponentKeywords(change),
    addsNewField: containsFieldKeywords(change),

    // ARCHITECTURAL indicators (changes structure)
    changesDatabase: containsDatabaseKeywords(change),
    changesAuth: containsAuthKeywords(change),
    changesRouting: containsRoutingKeywords(change),

    // BREAKING indicators (breaks existing)
    removesExisting: containsRemovalKeywords(change),
    changesContracts: containsContractKeywords(change),
  };

  // Decision tree
  if (indicators.touchesOnlyStyles || indicators.touchesOnlyText) {
    return { category: 'COSMETIC', requiresReplan: false, requiresRebuild: false };
  }

  if (indicators.changesDatabase || indicators.changesAuth) {
    return { category: 'ARCHITECTURAL', requiresReplan: true, requiresRebuild: true };
  }

  if (indicators.removesExisting || indicators.changesContracts) {
    return { category: 'BREAKING', requiresReplan: true, requiresRebuild: true };
  }

  if (indicators.addsNewEndpoint || indicators.addsNewComponent) {
    return { category: 'FEATURE', requiresReplan: false, requiresRebuild: true };
  }

  // Default to FEATURE (safer)
  return { category: 'FEATURE', requiresReplan: false, requiresRebuild: true };
}
```

**Impact Analysis Algorithm (Gap #1 Fix):**
```typescript
async function analyzeChangeImpact(change: ChangeRequest): Promise<ImpactAnalysis> {
  const classification = classifyChange(change);

  // Find affected files by tracing dependencies
  const affectedFiles = await traceDependencies(
    classification.affectedFiles,
    await this.sandbox.getFiles()
  );

  // Estimate effort
  const effort = estimateEffort(classification, affectedFiles.length);

  return {
    classification,
    affectedFiles,
    effort,

    // Recommended action
    action: classification.requiresReplan
      ? 'REPLAN_FROM_ARCHITECTURE'
      : classification.requiresRebuild
        ? 'REBUILD_AFFECTED_FILES'
        : 'APPLY_DIRECTLY',
  };
}
```

---

## PHASE 8: Complexity Scoring (Addressing Gap #10)

**File:** `src/lib/engine/v14-olympus/core/complexity-scorer.ts`

**Weight Justification:**
```typescript
const COMPLEXITY_WEIGHTS = {
  features: 2,        // Each feature adds moderate complexity
  integrations: 5,    // Third-party integrations are HARD (auth, payment, etc.)
  userRoles: 3,       // Permissions multiply complexity
  dataModels: 2,      // Each model adds DB + API + UI work
  realtime: 4,        // WebSocket/subscription features are complex
  fileUpload: 3,      // File handling needs special attention
  payments: 5,        // Money = must be perfect = high weight
  auth: 4,            // Security-critical = high weight
};

// Justification Table:
// | Factor        | Weight | Reasoning                                    |
// |---------------|--------|----------------------------------------------|
// | features      | 2      | Linear complexity per feature                |
// | integrations  | 5      | External APIs = docs, auth, error handling   |
// | userRoles     | 3      | Each role = different UI + permissions       |
// | dataModels    | 2      | CRUD + validation + relationships            |
// | realtime      | 4      | State sync, connection management            |
// | fileUpload    | 3      | Storage, size limits, security               |
// | payments      | 5      | Compliance, testing, webhooks, idempotency   |
// | auth          | 4      | Security, sessions, tokens, recovery flows   |
```

---

# PART IV: TESTING STRATEGY

## Unit Tests

Each module has corresponding tests in `__tests__/`:
- `config.test.ts`
- `event-stream.test.ts`
- `budget-tracker.test.ts`
- `knowledge-store.test.ts`
- `base-agent.test.ts`
- `hermes.test.ts`
- `athena.test.ts`
- `hephaestus.test.ts`
- `apollo.test.ts`
- `artemis.test.ts`
- `orchestrator.test.ts`
- `stuck-detector.test.ts`
- `strategy-selector.test.ts`

## Integration Tests

- `full-generation.test.ts` - End-to-end generation of simple app
- `recovery-flow.test.ts` - Stuck detection and recovery
- `user-interaction.test.ts` - Ask user flow

## E2E Tests

- Generate a todo app and verify it works
- Generate a dashboard and verify it works
- Generate with intentional ambiguity and verify clarification

---

# PART V: SUCCESS CRITERIA

## Per-Phase Completion Criteria

| Phase | Complete When |
|-------|---------------|
| 1 | All types compile, event stream works, budget tracking works |
| 2 | Knowledge store read/write works, concurrent write test passes |
| 3 | Each agent can complete a simple task in isolation |
| 4 | Stuck detection correctly identifies stuck states |
| 5 | Verification catches intentional errors in test code |
| 6 | Full generation of simple app succeeds |
| 7 | Change impact correctly classifies sample changes |
| 8 | Complexity scoring matches manual assessment |

## Final Success Metrics

| Metric | Target |
|--------|--------|
| Simple app generation | 99%+ success |
| Medium app generation | 95%+ success |
| Complex app generation | 85%+ success |
| Build passes | 100% |
| Type checks pass | 100% |
| E2E tests pass | 95%+ |

---

# PART VI: IMPLEMENTATION ORDER

```
Week 1: Phase 1 (Core Foundation)
        - config.ts
        - types/*.ts
        - event-stream.ts
        - budget-tracker.ts
        - state-machine.ts
        - checkpoint-manager.ts

Week 2: Phase 2 (Knowledge & Memory)
        - knowledge/schema.ts
        - knowledge/store.ts
        - knowledge/indexer.ts
        - memory/interface.ts
        - memory/embeddings.ts
        - memory/retrieval.ts

Week 3: Phase 3 (Agents - Part 1)
        - agents/base-agent.ts
        - agents/hermes.ts
        - agents/athena.ts

Week 4: Phase 3 (Agents - Part 2)
        - agents/hephaestus.ts
        - agents/apollo.ts
        - agents/artemis.ts
        - core/orchestrator.ts

Week 5: Phase 4 (Recovery)
        - recovery/stuck-detector.ts
        - recovery/strategy-selector.ts
        - recovery/strategies/*.ts

Week 6: Phase 5 (Verification)
        - verification/static-analyzer.ts
        - verification/type-checker.ts
        - verification/test-generator.ts
        - verification/test-runner.ts
        - verification/security-scanner.ts

Week 7: Phase 6 (Integration)
        - tools/definitions.ts
        - tools/executor.ts
        - sandbox/memory-sandbox.ts
        - api/route.ts

Week 8: Phase 7 & 8 + Testing
        - change-analyzer.ts
        - complexity-scorer.ts
        - All unit tests
        - Integration tests
        - E2E tests
```

---

# SUMMARY

This plan provides:

1. **15 critical gaps fixed** with explicit algorithms
2. **Precise file-by-file implementation order**
3. **Complete type definitions** for all interfaces
4. **Decision algorithms** where V13 had "magic"
5. **Testing strategy** for each component
6. **Success criteria** that are measurable

**Ready for implementation once user approves.**
