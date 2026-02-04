# V14 OLYMPUS - Phase 4: Recovery System

## Overview

Phase 4 implements a comprehensive recovery system that detects stuck states and applies prioritized recovery strategies. This is critical for autonomous operation - the system must be able to recover from errors without human intervention whenever possible.

**Files to Create:** 9
**Estimated Complexity:** High
**Dependencies:** Phase 1 (types, events, config), Phase 2 (knowledge), Phase 3 (agents)

---

## Architecture Overview

```
                    ┌─────────────────────────┐
                    │     Orchestrator        │
                    │   (detects stuck)       │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │    Stuck Detector       │
                    │  (analyzes indicators)  │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │   Strategy Selector     │
                    │  (picks best strategy)  │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ Retry   │ │Simplify │ │ Alt.    │ │Decompose│ │ Human   │
   │ w/ctx   │ │Approach │ │Solution │ │  Task   │ │Escalate │
   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

---

## File Structure

```
src/lib/engine/v14-olympus/recovery/
├── index.ts                    # Module exports
├── stuck-detector.ts           # Detect when agents are stuck
├── strategy-selector.ts        # Choose which strategy to apply
├── recovery-context.ts         # Context passed to strategies
├── recovery-history.ts         # Track recovery attempts
└── strategies/
    ├── index.ts                # Strategy exports
    ├── base-strategy.ts        # Abstract base class
    ├── retry-with-context.ts   # Strategy 1: Add more context
    ├── simplify-approach.ts    # Strategy 2: Reduce complexity
    ├── alternative-solution.ts # Strategy 3: Try different approach
    ├── decompose-task.ts       # Strategy 4: Break into subtasks
    ├── skip-and-stub.ts        # Strategy 5: Stub and continue
    ├── rollback.ts             # Strategy 6: Restore checkpoint
    └── human-escalation.ts     # Strategy 7: Ask human (final)
```

---

## File 1: `src/lib/engine/v14-olympus/recovery/index.ts`

### Purpose
Central export file for the recovery module.

### Exact Implementation

```typescript
/**
 * V14 OLYMPUS Recovery System
 *
 * Provides stuck detection and automated recovery strategies.
 */

// Core exports
export { StuckDetector, type StuckIndicators, type StuckDetectorConfig } from './stuck-detector';
export { StrategySelector, type StrategySelectionResult } from './strategy-selector';
export { RecoveryContext, type RecoveryContextConfig } from './recovery-context';
export { RecoveryHistory, type RecoveryAttempt } from './recovery-history';

// Strategy exports
export {
  BaseStrategy,
  type Strategy,
  type StrategyConfig,
  type StrategyResult,
} from './strategies/base-strategy';

export { RetryWithContextStrategy } from './strategies/retry-with-context';
export { SimplifyApproachStrategy } from './strategies/simplify-approach';
export { AlternativeSolutionStrategy } from './strategies/alternative-solution';
export { DecomposeTaskStrategy } from './strategies/decompose-task';
export { SkipAndStubStrategy } from './strategies/skip-and-stub';
export { RollbackStrategy } from './strategies/rollback';
export { HumanEscalationStrategy } from './strategies/human-escalation';

// Strategy names (for type safety)
export const STRATEGY_NAMES = [
  'retry_with_context',
  'simplify_approach',
  'alternative_solution',
  'decompose_task',
  'skip_and_stub',
  'rollback',
  'human_escalation',
] as const;

export type StrategyName = typeof STRATEGY_NAMES[number];

// Default strategy priority order
export const DEFAULT_STRATEGY_PRIORITY: StrategyName[] = [
  'retry_with_context',
  'simplify_approach',
  'alternative_solution',
  'decompose_task',
  'skip_and_stub',
  'rollback',
  'human_escalation',
];
```

---

## File 2: `src/lib/engine/v14-olympus/recovery/stuck-detector.ts`

### Purpose
Detects when an agent or the overall generation process is stuck. Uses multiple indicators to determine if intervention is needed.

### Exact Implementation

```typescript
/**
 * Stuck Detector
 *
 * Monitors agent execution and detects stuck states based on multiple indicators:
 * - Repeated errors (same error appearing multiple times)
 * - No progress (iterations without file changes)
 * - Circular attempts (same approach tried repeatedly)
 * - Resource exhaustion (context window usage too high)
 * - Timeout exceeded (task running too long)
 */

import { AgentHistory, Iteration, Attempt, ContextState } from '../types';

// Stuck state indicators
export interface StuckIndicators {
  /** Same error message appeared 3+ times */
  repeatedErrors: boolean;

  /** 5+ iterations with no new files or meaningful changes */
  noProgress: boolean;

  /** Same approach pattern tried 50%+ of attempts */
  circularAttempts: boolean;

  /** Context window usage > 90% */
  resourceExhausted: boolean;

  /** Task running longer than timeout threshold */
  timeoutExceeded: boolean;

  /** Severity score 0-1 (higher = more stuck) */
  severity: number;

  /** Primary reason for being stuck */
  primaryReason: string | null;

  /** Detailed analysis */
  analysis: StuckAnalysis;
}

export interface StuckAnalysis {
  /** Number of repeated error occurrences */
  errorCount: number;

  /** Most common error message */
  mostCommonError: string | null;

  /** Iterations since last progress */
  iterationsSinceProgress: number;

  /** Most common approach pattern */
  mostCommonApproach: string | null;

  /** Approach repetition percentage */
  approachRepetitionRate: number;

  /** Current context window usage (0-1) */
  contextUtilization: number;

  /** Time elapsed in milliseconds */
  elapsedMs: number;

  /** Suggested recovery strategies */
  suggestedStrategies: string[];
}

// Configuration for stuck detection thresholds
export interface StuckDetectorConfig {
  /** How many times the same error must occur (default: 3) */
  errorThreshold: number;

  /** How many iterations without progress (default: 5) */
  progressThreshold: number;

  /** What percentage of circular attempts triggers stuck (default: 0.5) */
  circularThreshold: number;

  /** Context window usage threshold (default: 0.9) */
  resourceThreshold: number;

  /** Timeout in milliseconds (default: 600000 = 10 min) */
  timeoutMs: number;

  /** Minimum iterations before checking for stuck (default: 3) */
  minIterationsBeforeCheck: number;
}

// Default configuration
const DEFAULT_CONFIG: StuckDetectorConfig = {
  errorThreshold: 3,
  progressThreshold: 5,
  circularThreshold: 0.5,
  resourceThreshold: 0.9,
  timeoutMs: 600000, // 10 minutes
  minIterationsBeforeCheck: 3,
};

export class StuckDetector {
  private config: StuckDetectorConfig;

  constructor(config: Partial<StuckDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Detect if agent is stuck based on history
   */
  detect(history: AgentHistory): StuckIndicators {
    // Don't check if not enough iterations
    if (history.iterations.length < this.config.minIterationsBeforeCheck) {
      return this.createNotStuckIndicators();
    }

    // Check each indicator
    const repeatedErrors = this.hasRepeatedErrors(history.errors);
    const noProgress = this.hasNoProgress(history.iterations);
    const circularAttempts = this.isCircular(history.attempts);
    const resourceExhausted = this.isResourceExhausted(history.contextState);
    const timeoutExceeded = this.isTimedOut(history.startTime);

    // Calculate severity (0-1)
    const severity = this.calculateSeverity({
      repeatedErrors,
      noProgress,
      circularAttempts,
      resourceExhausted,
      timeoutExceeded,
    });

    // Determine primary reason
    const primaryReason = this.determinePrimaryReason({
      repeatedErrors,
      noProgress,
      circularAttempts,
      resourceExhausted,
      timeoutExceeded,
    });

    // Build detailed analysis
    const analysis = this.buildAnalysis(history, {
      repeatedErrors,
      noProgress,
      circularAttempts,
      resourceExhausted,
      timeoutExceeded,
    });

    return {
      repeatedErrors,
      noProgress,
      circularAttempts,
      resourceExhausted,
      timeoutExceeded,
      severity,
      primaryReason,
      analysis,
    };
  }

  /**
   * Check if any indicator is true (simple stuck check)
   */
  isStuck(indicators: StuckIndicators): boolean {
    return (
      indicators.repeatedErrors ||
      indicators.noProgress ||
      indicators.circularAttempts ||
      indicators.resourceExhausted ||
      indicators.timeoutExceeded
    );
  }

  /**
   * Check for repeated errors
   */
  hasRepeatedErrors(errors: string[]): boolean {
    if (errors.length < this.config.errorThreshold) {
      return false;
    }

    // Count error frequencies
    const errorCounts = new Map<string, number>();

    for (const error of errors) {
      // Normalize error message (remove line numbers, timestamps, etc.)
      const normalized = this.normalizeError(error);
      const count = errorCounts.get(normalized) || 0;
      errorCounts.set(normalized, count + 1);
    }

    // Check if any error exceeds threshold
    for (const count of errorCounts.values()) {
      if (count >= this.config.errorThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for no progress
   */
  hasNoProgress(iterations: Iteration[]): boolean {
    if (iterations.length < this.config.progressThreshold) {
      return false;
    }

    // Check last N iterations
    const recentIterations = iterations.slice(-this.config.progressThreshold);

    for (const iteration of recentIterations) {
      // Any of these counts as progress
      if (
        iteration.filesCreated > 0 ||
        iteration.filesModified > 0 ||
        iteration.testsRan > 0 ||
        iteration.buildSucceeded ||
        iteration.significantOutput
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check for circular attempts
   */
  isCircular(attempts: Attempt[]): boolean {
    if (attempts.length < 4) {
      return false;
    }

    // Group attempts by approach pattern
    const approachCounts = new Map<string, number>();

    for (const attempt of attempts) {
      const pattern = this.extractApproachPattern(attempt);
      const count = approachCounts.get(pattern) || 0;
      approachCounts.set(pattern, count + 1);
    }

    // Check if any approach exceeds threshold
    for (const count of approachCounts.values()) {
      if (count / attempts.length >= this.config.circularThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for resource exhaustion
   */
  isResourceExhausted(context: ContextState): boolean {
    if (!context) return false;
    return context.utilizationPercent >= this.config.resourceThreshold;
  }

  /**
   * Check for timeout
   */
  isTimedOut(startTime: number): boolean {
    if (!startTime) return false;
    return Date.now() - startTime >= this.config.timeoutMs;
  }

  /**
   * Calculate severity score (0-1)
   */
  private calculateSeverity(indicators: {
    repeatedErrors: boolean;
    noProgress: boolean;
    circularAttempts: boolean;
    resourceExhausted: boolean;
    timeoutExceeded: boolean;
  }): number {
    // Weights for each indicator
    const weights = {
      repeatedErrors: 0.25,
      noProgress: 0.25,
      circularAttempts: 0.20,
      resourceExhausted: 0.15,
      timeoutExceeded: 0.15,
    };

    let severity = 0;

    if (indicators.repeatedErrors) severity += weights.repeatedErrors;
    if (indicators.noProgress) severity += weights.noProgress;
    if (indicators.circularAttempts) severity += weights.circularAttempts;
    if (indicators.resourceExhausted) severity += weights.resourceExhausted;
    if (indicators.timeoutExceeded) severity += weights.timeoutExceeded;

    return severity;
  }

  /**
   * Determine the primary reason for being stuck
   */
  private determinePrimaryReason(indicators: {
    repeatedErrors: boolean;
    noProgress: boolean;
    circularAttempts: boolean;
    resourceExhausted: boolean;
    timeoutExceeded: boolean;
  }): string | null {
    // Priority order for primary reason
    if (indicators.resourceExhausted) {
      return 'Context window exhausted - cannot process more information';
    }
    if (indicators.repeatedErrors) {
      return 'Same error occurring repeatedly - likely a fundamental issue';
    }
    if (indicators.circularAttempts) {
      return 'Trying same approach repeatedly - need different strategy';
    }
    if (indicators.noProgress) {
      return 'No meaningful progress - task may be too complex';
    }
    if (indicators.timeoutExceeded) {
      return 'Timeout exceeded - task taking too long';
    }

    return null;
  }

  /**
   * Build detailed analysis
   */
  private buildAnalysis(
    history: AgentHistory,
    indicators: {
      repeatedErrors: boolean;
      noProgress: boolean;
      circularAttempts: boolean;
      resourceExhausted: boolean;
      timeoutExceeded: boolean;
    }
  ): StuckAnalysis {
    // Count errors
    const errorCounts = new Map<string, number>();
    for (const error of history.errors) {
      const normalized = this.normalizeError(error);
      errorCounts.set(normalized, (errorCounts.get(normalized) || 0) + 1);
    }

    // Find most common error
    let mostCommonError: string | null = null;
    let maxErrorCount = 0;
    for (const [error, count] of errorCounts) {
      if (count > maxErrorCount) {
        maxErrorCount = count;
        mostCommonError = error;
      }
    }

    // Count iterations since progress
    let iterationsSinceProgress = 0;
    for (let i = history.iterations.length - 1; i >= 0; i--) {
      const iter = history.iterations[i];
      if (iter.filesCreated > 0 || iter.filesModified > 0 || iter.buildSucceeded) {
        break;
      }
      iterationsSinceProgress++;
    }

    // Count approach patterns
    const approachCounts = new Map<string, number>();
    for (const attempt of history.attempts) {
      const pattern = this.extractApproachPattern(attempt);
      approachCounts.set(pattern, (approachCounts.get(pattern) || 0) + 1);
    }

    // Find most common approach
    let mostCommonApproach: string | null = null;
    let maxApproachCount = 0;
    for (const [approach, count] of approachCounts) {
      if (count > maxApproachCount) {
        maxApproachCount = count;
        mostCommonApproach = approach;
      }
    }

    // Calculate approach repetition rate
    const approachRepetitionRate = history.attempts.length > 0
      ? maxApproachCount / history.attempts.length
      : 0;

    // Suggest strategies based on indicators
    const suggestedStrategies = this.suggestStrategies(indicators);

    return {
      errorCount: maxErrorCount,
      mostCommonError,
      iterationsSinceProgress,
      mostCommonApproach,
      approachRepetitionRate,
      contextUtilization: history.contextState?.utilizationPercent || 0,
      elapsedMs: history.startTime ? Date.now() - history.startTime : 0,
      suggestedStrategies,
    };
  }

  /**
   * Suggest strategies based on indicators
   */
  private suggestStrategies(indicators: {
    repeatedErrors: boolean;
    noProgress: boolean;
    circularAttempts: boolean;
    resourceExhausted: boolean;
    timeoutExceeded: boolean;
  }): string[] {
    const strategies: string[] = [];

    if (indicators.repeatedErrors) {
      strategies.push('retry_with_context');
      strategies.push('alternative_solution');
    }

    if (indicators.noProgress) {
      strategies.push('simplify_approach');
      strategies.push('decompose_task');
    }

    if (indicators.circularAttempts) {
      strategies.push('alternative_solution');
      strategies.push('simplify_approach');
    }

    if (indicators.resourceExhausted) {
      strategies.push('rollback');
      strategies.push('decompose_task');
    }

    if (indicators.timeoutExceeded) {
      strategies.push('skip_and_stub');
      strategies.push('decompose_task');
    }

    return [...new Set(strategies)]; // Remove duplicates
  }

  /**
   * Normalize error message for comparison
   */
  private normalizeError(error: string): string {
    return error
      .replace(/line \d+/gi, 'line N')
      .replace(/column \d+/gi, 'column N')
      .replace(/at \d+:\d+/g, 'at N:N')
      .replace(/\d{13,}/g, 'TIMESTAMP')
      .replace(/".+\.tsx?"/g, '"FILE"')
      .trim()
      .toLowerCase();
  }

  /**
   * Extract approach pattern from attempt
   */
  private extractApproachPattern(attempt: Attempt): string {
    // Create a normalized pattern based on:
    // - Tools used
    // - Files targeted
    // - General approach category

    const tools = attempt.toolsUsed?.sort().join(',') || 'none';
    const fileTypes = attempt.filesTargeted
      ?.map(f => f.split('.').pop())
      .sort()
      .join(',') || 'none';
    const approach = attempt.approachCategory || 'unknown';

    return `${approach}:${tools}:${fileTypes}`;
  }

  /**
   * Create indicators for not stuck state
   */
  private createNotStuckIndicators(): StuckIndicators {
    return {
      repeatedErrors: false,
      noProgress: false,
      circularAttempts: false,
      resourceExhausted: false,
      timeoutExceeded: false,
      severity: 0,
      primaryReason: null,
      analysis: {
        errorCount: 0,
        mostCommonError: null,
        iterationsSinceProgress: 0,
        mostCommonApproach: null,
        approachRepetitionRate: 0,
        contextUtilization: 0,
        elapsedMs: 0,
        suggestedStrategies: [],
      },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StuckDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): StuckDetectorConfig {
    return { ...this.config };
  }
}
```

---

## File 3: `src/lib/engine/v14-olympus/recovery/recovery-context.ts`

### Purpose
Provides the context that recovery strategies need to operate. Contains references to all relevant state and services.

### Exact Implementation

```typescript
/**
 * Recovery Context
 *
 * Provides all the context that recovery strategies need to make decisions
 * and apply corrections.
 */

import { Task, Checkpoint, AgentName } from '../types';
import { StuckIndicators } from './stuck-detector';
import { RecoveryHistory, RecoveryAttempt } from './recovery-history';
import { EventStream } from '../core/event-stream';
import { KnowledgeStore } from '../knowledge/store';
import { MemorySandbox } from '../sandbox/memory-sandbox';
import { CheckpointManager } from '../core/checkpoint-manager';
import { EventType } from '../types/events';

export interface RecoveryContextConfig {
  sessionId: string;
  currentTask: Task;
  currentAgent: AgentName;
  stuckIndicators: StuckIndicators;
  eventStream: EventStream;
  knowledge: KnowledgeStore;
  sandbox: MemorySandbox;
  checkpoints: CheckpointManager;
  askUser: (question: UserQuestion) => Promise<UserResponse>;
}

export interface UserQuestion {
  id: string;
  type: 'choice' | 'freeform' | 'confirmation';
  question: string;
  context?: string;
  options?: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  timeout?: number;
}

export interface UserResponse {
  questionId: string;
  response: string;
  selectedOptionId?: string;
  timedOut: boolean;
  timestamp: number;
}

export class RecoveryContext {
  readonly sessionId: string;
  readonly currentTask: Task;
  readonly currentAgent: AgentName;
  readonly stuckIndicators: StuckIndicators;

  private eventStream: EventStream;
  private knowledge: KnowledgeStore;
  private sandbox: MemorySandbox;
  private checkpoints: CheckpointManager;
  private askUserFn: (question: UserQuestion) => Promise<UserResponse>;

  private recoveryHistory: RecoveryHistory;

  constructor(config: RecoveryContextConfig) {
    this.sessionId = config.sessionId;
    this.currentTask = config.currentTask;
    this.currentAgent = config.currentAgent;
    this.stuckIndicators = config.stuckIndicators;
    this.eventStream = config.eventStream;
    this.knowledge = config.knowledge;
    this.sandbox = config.sandbox;
    this.checkpoints = config.checkpoints;
    this.askUserFn = config.askUser;

    this.recoveryHistory = new RecoveryHistory();
  }

  // ========================================
  // Event Emission
  // ========================================

  /**
   * Emit a recovery-related event
   */
  emit(type: EventType, payload: unknown): void {
    this.eventStream.emit({
      id: crypto.randomUUID(),
      type,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      payload,
      metadata: {
        context: 'recovery',
        task: this.currentTask.id,
        agent: this.currentAgent,
      },
    });
  }

  // ========================================
  // Knowledge Store Access
  // ========================================

  /**
   * Read from knowledge store
   */
  async readKnowledge(path: string): Promise<string | null> {
    const doc = await this.knowledge.read(path);
    return doc?.content ?? null;
  }

  /**
   * Write to knowledge store
   */
  async writeKnowledge(path: string, content: string): Promise<boolean> {
    const result = await this.knowledge.write(path, content);
    return result.success;
  }

  /**
   * List knowledge documents
   */
  async listKnowledgePaths(): Promise<string[]> {
    return this.knowledge.listPaths();
  }

  /**
   * Get requirements document
   */
  async getRequirements(): Promise<unknown | null> {
    const content = await this.readKnowledge('/requirements/main.json');
    if (!content) return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Get architecture document
   */
  async getArchitecture(): Promise<unknown | null> {
    const content = await this.readKnowledge('/architecture/main.json');
    if (!content) return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Get plan document
   */
  async getPlan(): Promise<unknown | null> {
    const content = await this.readKnowledge('/plan/main.json');
    if (!content) return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  // ========================================
  // Sandbox Access
  // ========================================

  /**
   * List all files in sandbox
   */
  async listFiles(pattern?: string): Promise<string[]> {
    return this.sandbox.listFiles(pattern);
  }

  /**
   * Read a file from sandbox
   */
  async readFile(path: string): Promise<string | null> {
    try {
      return await this.sandbox.readFile(path);
    } catch {
      return null;
    }
  }

  /**
   * Write a file to sandbox
   */
  async writeFile(path: string, content: string): Promise<void> {
    await this.sandbox.writeFile(path, content);
  }

  /**
   * Delete a file from sandbox
   */
  async deleteFile(path: string): Promise<boolean> {
    return this.sandbox.deleteFile(path);
  }

  /**
   * Get file count
   */
  getFileCount(): number {
    return this.sandbox.getFileCount();
  }

  /**
   * Get all files as map
   */
  getFiles(): Map<string, string> {
    return this.sandbox.getFiles();
  }

  // ========================================
  // Checkpoint Management
  // ========================================

  /**
   * Get available checkpoints
   */
  async getCheckpoints(): Promise<Checkpoint[]> {
    return this.checkpoints.list();
  }

  /**
   * Restore from checkpoint
   */
  async restoreCheckpoint(checkpointId: string): Promise<boolean> {
    return this.checkpoints.restore(checkpointId);
  }

  /**
   * Get latest checkpoint
   */
  async getLatestCheckpoint(): Promise<Checkpoint | null> {
    const checkpoints = await this.checkpoints.list();
    return checkpoints[0] ?? null;
  }

  // ========================================
  // User Interaction
  // ========================================

  /**
   * Ask user a question
   */
  async askUser(question: Omit<UserQuestion, 'id'>): Promise<UserResponse> {
    const fullQuestion: UserQuestion = {
      ...question,
      id: crypto.randomUUID(),
    };

    this.emit(EventType.USER_INPUT_REQUIRED, {
      questionId: fullQuestion.id,
      question: fullQuestion.question,
      type: fullQuestion.type,
      options: fullQuestion.options,
      reason: 'Recovery strategy requires user input',
    });

    const response = await this.askUserFn(fullQuestion);

    this.emit(EventType.USER_INPUT_RECEIVED, {
      questionId: fullQuestion.id,
      response: response.response,
      timedOut: response.timedOut,
    });

    return response;
  }

  /**
   * Ask user for confirmation
   */
  async confirmWithUser(message: string, context?: string): Promise<boolean> {
    const response = await this.askUser({
      type: 'confirmation',
      question: message,
      context,
      options: [
        { id: 'yes', label: 'Yes', description: 'Proceed with this action' },
        { id: 'no', label: 'No', description: 'Do not proceed' },
      ],
    });

    return response.selectedOptionId === 'yes' && !response.timedOut;
  }

  /**
   * Present choices to user
   */
  async askUserChoice(
    question: string,
    options: Array<{ id: string; label: string; description?: string }>
  ): Promise<string | null> {
    const response = await this.askUser({
      type: 'choice',
      question,
      options,
    });

    if (response.timedOut) return null;
    return response.selectedOptionId ?? null;
  }

  // ========================================
  // Recovery History
  // ========================================

  /**
   * Record a recovery attempt
   */
  recordAttempt(attempt: Omit<RecoveryAttempt, 'timestamp'>): void {
    this.recoveryHistory.record({
      ...attempt,
      timestamp: Date.now(),
    });
  }

  /**
   * Get all recovery attempts
   */
  getAttempts(): RecoveryAttempt[] {
    return this.recoveryHistory.getAll();
  }

  /**
   * Get attempts for a specific strategy
   */
  getAttemptsForStrategy(strategy: string): RecoveryAttempt[] {
    return this.recoveryHistory.getForStrategy(strategy);
  }

  /**
   * Check if strategy has been tried
   */
  hasTriedStrategy(strategy: string): boolean {
    return this.recoveryHistory.hasTried(strategy);
  }

  /**
   * Get count of attempts for strategy
   */
  getAttemptCount(strategy: string): number {
    return this.recoveryHistory.getCount(strategy);
  }

  /**
   * Get set of all tried strategy names
   */
  getTriedStrategies(): Set<string> {
    return this.recoveryHistory.getTriedStrategies();
  }

  // ========================================
  // Context Summarization
  // ========================================

  /**
   * Create a summary of current state for human review
   */
  async createSummary(): Promise<RecoverySummary> {
    const files = await this.listFiles();
    const knowledgePaths = await this.listKnowledgePaths();
    const checkpoints = await this.getCheckpoints();

    return {
      sessionId: this.sessionId,
      task: {
        id: this.currentTask.id,
        description: this.currentTask.description,
        status: this.currentTask.status,
      },
      agent: this.currentAgent,
      stuckIndicators: this.stuckIndicators,
      recoveryAttempts: this.getAttempts(),
      filesGenerated: files.length,
      filesList: files.slice(0, 20), // First 20 files
      knowledgeDocuments: knowledgePaths,
      availableCheckpoints: checkpoints.length,
      timestamp: Date.now(),
    };
  }
}

export interface RecoverySummary {
  sessionId: string;
  task: {
    id: string;
    description: string;
    status: string;
  };
  agent: AgentName;
  stuckIndicators: StuckIndicators;
  recoveryAttempts: RecoveryAttempt[];
  filesGenerated: number;
  filesList: string[];
  knowledgeDocuments: string[];
  availableCheckpoints: number;
  timestamp: number;
}
```

---

## File 4: `src/lib/engine/v14-olympus/recovery/recovery-history.ts`

### Purpose
Tracks all recovery attempts during a generation session. Used to prevent retrying the same strategy too many times and to provide context for escalation.

### Exact Implementation

```typescript
/**
 * Recovery History
 *
 * Tracks all recovery attempts during a generation session.
 * Used to:
 * 1. Prevent retrying the same strategy too many times
 * 2. Provide context for human escalation
 * 3. Learn from recovery patterns
 */

export interface RecoveryAttempt {
  /** Unique attempt ID */
  id: string;

  /** Strategy name that was applied */
  strategy: string;

  /** Timestamp when attempt was made */
  timestamp: number;

  /** Whether the attempt succeeded */
  success: boolean;

  /** The action taken by the strategy */
  action: 'continue' | 'restart_task' | 'skip_task' | 'abort' | 'ask_user' | 'rollback';

  /** Reason for the attempt */
  reason: string;

  /** Details about what was tried */
  details?: string;

  /** Any error that occurred */
  error?: string;

  /** Duration of the attempt in ms */
  duration?: number;

  /** State before the attempt (for rollback) */
  stateBefore?: {
    fileCount: number;
    lastCheckpoint?: string;
    contextUsage?: number;
  };

  /** State after the attempt */
  stateAfter?: {
    fileCount: number;
    newCheckpoint?: string;
    contextUsage?: number;
  };
}

export class RecoveryHistory {
  private attempts: RecoveryAttempt[] = [];
  private strategyAttempts: Map<string, RecoveryAttempt[]> = new Map();

  /**
   * Record a new recovery attempt
   */
  record(attempt: RecoveryAttempt): void {
    // Generate ID if not provided
    if (!attempt.id) {
      attempt.id = crypto.randomUUID();
    }

    this.attempts.push(attempt);

    // Track by strategy
    const strategyList = this.strategyAttempts.get(attempt.strategy) || [];
    strategyList.push(attempt);
    this.strategyAttempts.set(attempt.strategy, strategyList);
  }

  /**
   * Get all attempts
   */
  getAll(): RecoveryAttempt[] {
    return [...this.attempts];
  }

  /**
   * Get attempts for a specific strategy
   */
  getForStrategy(strategy: string): RecoveryAttempt[] {
    return [...(this.strategyAttempts.get(strategy) || [])];
  }

  /**
   * Check if a strategy has been tried
   */
  hasTried(strategy: string): boolean {
    return this.strategyAttempts.has(strategy) &&
           (this.strategyAttempts.get(strategy)?.length ?? 0) > 0;
  }

  /**
   * Get count of attempts for a strategy
   */
  getCount(strategy: string): number {
    return this.strategyAttempts.get(strategy)?.length ?? 0;
  }

  /**
   * Get set of all tried strategy names
   */
  getTriedStrategies(): Set<string> {
    return new Set(this.strategyAttempts.keys());
  }

  /**
   * Get the last attempt
   */
  getLastAttempt(): RecoveryAttempt | null {
    return this.attempts[this.attempts.length - 1] ?? null;
  }

  /**
   * Get the last successful attempt
   */
  getLastSuccessfulAttempt(): RecoveryAttempt | null {
    for (let i = this.attempts.length - 1; i >= 0; i--) {
      if (this.attempts[i].success) {
        return this.attempts[i];
      }
    }
    return null;
  }

  /**
   * Get success rate for a strategy
   */
  getSuccessRate(strategy: string): number {
    const attempts = this.strategyAttempts.get(strategy);
    if (!attempts || attempts.length === 0) return 0;

    const successful = attempts.filter(a => a.success).length;
    return successful / attempts.length;
  }

  /**
   * Get overall success rate
   */
  getOverallSuccessRate(): number {
    if (this.attempts.length === 0) return 0;

    const successful = this.attempts.filter(a => a.success).length;
    return successful / this.attempts.length;
  }

  /**
   * Check if we should stop trying (too many failures)
   */
  shouldStopTrying(maxTotalAttempts: number = 10): boolean {
    return this.attempts.length >= maxTotalAttempts;
  }

  /**
   * Get total duration of all recovery attempts
   */
  getTotalRecoveryTime(): number {
    return this.attempts.reduce((sum, a) => sum + (a.duration ?? 0), 0);
  }

  /**
   * Clear history
   */
  clear(): void {
    this.attempts = [];
    this.strategyAttempts.clear();
  }

  /**
   * Export as JSON for persistence or analysis
   */
  toJSON(): string {
    return JSON.stringify({
      attempts: this.attempts,
      summary: {
        totalAttempts: this.attempts.length,
        successfulAttempts: this.attempts.filter(a => a.success).length,
        strategiesTried: [...this.strategyAttempts.keys()],
        totalRecoveryTime: this.getTotalRecoveryTime(),
      },
    }, null, 2);
  }

  /**
   * Import from JSON
   */
  static fromJSON(json: string): RecoveryHistory {
    const data = JSON.parse(json);
    const history = new RecoveryHistory();

    for (const attempt of data.attempts) {
      history.record(attempt);
    }

    return history;
  }
}
```

---

## File 5: `src/lib/engine/v14-olympus/recovery/strategy-selector.ts`

### Purpose
Selects the most appropriate recovery strategy based on stuck indicators and previous attempts. Uses a priority-based approach with applicability checks.

### Exact Implementation

```typescript
/**
 * Strategy Selector
 *
 * Selects the most appropriate recovery strategy based on:
 * 1. Stuck indicators (what kind of stuck state we're in)
 * 2. Previous attempts (don't retry exhausted strategies)
 * 3. Strategy applicability (some strategies only work in certain conditions)
 *
 * Priority Order:
 * 1. retry_with_context    - First, maybe just needs more info
 * 2. simplify_approach     - Maybe task is too complex
 * 3. alternative_solution  - Try different approach
 * 4. decompose_task        - Break into smaller pieces
 * 5. skip_and_stub         - Stub it, move on
 * 6. rollback              - Go back to known good state
 * 7. human_escalation      - Last resort
 */

import {
  Strategy,
  StrategyResult,
  BaseStrategy,
} from './strategies/base-strategy';
import { RetryWithContextStrategy } from './strategies/retry-with-context';
import { SimplifyApproachStrategy } from './strategies/simplify-approach';
import { AlternativeSolutionStrategy } from './strategies/alternative-solution';
import { DecomposeTaskStrategy } from './strategies/decompose-task';
import { SkipAndStubStrategy } from './strategies/skip-and-stub';
import { RollbackStrategy } from './strategies/rollback';
import { HumanEscalationStrategy } from './strategies/human-escalation';
import { StuckIndicators } from './stuck-detector';
import { RecoveryContext } from './recovery-context';
import { StrategyName, DEFAULT_STRATEGY_PRIORITY } from './index';
import { EventType } from '../types/events';

export interface StrategySelectionResult {
  /** Selected strategy (null if none applicable) */
  strategy: Strategy | null;

  /** Name of selected strategy */
  strategyName: StrategyName | null;

  /** Why this strategy was selected */
  reason: string;

  /** Strategies that were considered but rejected */
  rejected: Array<{
    name: StrategyName;
    reason: string;
  }>;

  /** Whether all strategies have been exhausted */
  allExhausted: boolean;
}

export interface StrategySelectorConfig {
  /** Priority order for strategies (default: DEFAULT_STRATEGY_PRIORITY) */
  priority?: StrategyName[];

  /** Max attempts per strategy (default: 2) */
  maxAttemptsPerStrategy?: number;

  /** Whether to allow human escalation (default: true) */
  allowHumanEscalation?: boolean;
}

export class StrategySelector {
  private strategies: Map<StrategyName, Strategy>;
  private priority: StrategyName[];
  private maxAttemptsPerStrategy: number;
  private allowHumanEscalation: boolean;

  constructor(config: StrategySelectorConfig = {}) {
    this.priority = config.priority ?? DEFAULT_STRATEGY_PRIORITY;
    this.maxAttemptsPerStrategy = config.maxAttemptsPerStrategy ?? 2;
    this.allowHumanEscalation = config.allowHumanEscalation ?? true;

    // Initialize all strategies
    this.strategies = new Map([
      ['retry_with_context', new RetryWithContextStrategy()],
      ['simplify_approach', new SimplifyApproachStrategy()],
      ['alternative_solution', new AlternativeSolutionStrategy()],
      ['decompose_task', new DecomposeTaskStrategy()],
      ['skip_and_stub', new SkipAndStubStrategy()],
      ['rollback', new RollbackStrategy()],
      ['human_escalation', new HumanEscalationStrategy()],
    ]);
  }

  /**
   * Select the best strategy for the current stuck state
   */
  select(
    stuck: StuckIndicators,
    context: RecoveryContext
  ): StrategySelectionResult {
    const rejected: Array<{ name: StrategyName; reason: string }> = [];
    const triedStrategies = context.getTriedStrategies();

    // Try each strategy in priority order
    for (const strategyName of this.priority) {
      // Skip human escalation if not allowed
      if (strategyName === 'human_escalation' && !this.allowHumanEscalation) {
        rejected.push({
          name: strategyName,
          reason: 'Human escalation is disabled',
        });
        continue;
      }

      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        rejected.push({
          name: strategyName,
          reason: 'Strategy not found',
        });
        continue;
      }

      // Check if we've exhausted attempts for this strategy
      const attemptCount = context.getAttemptCount(strategyName);
      if (attemptCount >= this.maxAttemptsPerStrategy) {
        rejected.push({
          name: strategyName,
          reason: `Max attempts (${this.maxAttemptsPerStrategy}) exceeded`,
        });
        continue;
      }

      // Check if strategy is applicable
      const applicability = strategy.isApplicable(stuck, context);
      if (!applicability.applicable) {
        rejected.push({
          name: strategyName,
          reason: applicability.reason || 'Not applicable for current stuck state',
        });
        continue;
      }

      // This strategy is applicable!
      return {
        strategy,
        strategyName,
        reason: applicability.reason || 'Strategy is applicable',
        rejected,
        allExhausted: false,
      };
    }

    // All strategies exhausted
    return {
      strategy: null,
      strategyName: null,
      reason: 'All recovery strategies have been exhausted',
      rejected,
      allExhausted: true,
    };
  }

  /**
   * Apply a strategy and record the result
   */
  async apply(
    strategy: Strategy,
    context: RecoveryContext
  ): Promise<StrategyResult> {
    const strategyName = strategy.name;
    const startTime = Date.now();

    // Emit event
    context.emit(EventType.STRATEGY_APPLIED, {
      strategy: strategyName,
      reason: context.stuckIndicators.primaryReason,
    });

    try {
      // Apply the strategy
      const result = await strategy.apply(context);

      // Record the attempt
      context.recordAttempt({
        id: crypto.randomUUID(),
        strategy: strategyName,
        timestamp: Date.now(),
        success: result.success,
        action: result.action,
        reason: result.message,
        details: result.details,
        duration: Date.now() - startTime,
        stateAfter: {
          fileCount: context.getFileCount(),
        },
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failed attempt
      context.recordAttempt({
        id: crypto.randomUUID(),
        strategy: strategyName,
        timestamp: Date.now(),
        success: false,
        action: 'continue',
        reason: 'Strategy threw an error',
        error: errorMessage,
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        action: 'continue',
        message: `Strategy failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Run the full recovery flow until success or exhaustion
   */
  async recover(context: RecoveryContext): Promise<StrategyResult> {
    const maxTotalAttempts = this.priority.length * this.maxAttemptsPerStrategy;
    let attemptCount = 0;

    while (attemptCount < maxTotalAttempts) {
      attemptCount++;

      // Select next strategy
      const selection = this.select(context.stuckIndicators, context);

      // All exhausted
      if (selection.allExhausted || !selection.strategy) {
        // Force human escalation if we haven't tried it
        if (this.allowHumanEscalation && !context.hasTriedStrategy('human_escalation')) {
          const humanStrategy = this.strategies.get('human_escalation')!;
          return this.apply(humanStrategy, context);
        }

        return {
          success: false,
          action: 'abort',
          message: 'All recovery strategies exhausted',
          details: `Tried ${attemptCount} recovery attempts`,
        };
      }

      // Apply selected strategy
      const result = await this.apply(selection.strategy, context);

      // If successful or needs user action, return
      if (result.success || result.action === 'ask_user' || result.action === 'abort') {
        return result;
      }

      // Continue to next strategy
    }

    return {
      success: false,
      action: 'abort',
      message: 'Max recovery attempts exceeded',
    };
  }

  /**
   * Get strategy by name
   */
  getStrategy(name: StrategyName): Strategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Register a custom strategy
   */
  registerStrategy(name: StrategyName, strategy: Strategy): void {
    this.strategies.set(name, strategy);
  }

  /**
   * Update priority order
   */
  setPriority(priority: StrategyName[]): void {
    this.priority = priority;
  }
}
```

---

## File 6: `src/lib/engine/v14-olympus/recovery/strategies/base-strategy.ts`

### Purpose
Abstract base class for all recovery strategies. Defines the common interface and helper methods.

### Exact Implementation

```typescript
/**
 * Base Strategy
 *
 * Abstract base class for all recovery strategies.
 * Each strategy must implement:
 * - isApplicable(): Check if strategy can be applied
 * - apply(): Execute the recovery strategy
 */

import { StuckIndicators } from '../stuck-detector';
import { RecoveryContext } from '../recovery-context';
import { StrategyName } from '../index';

export interface ApplicabilityResult {
  /** Whether the strategy is applicable */
  applicable: boolean;

  /** Reason for the result */
  reason?: string;

  /** Confidence that this strategy will work (0-1) */
  confidence?: number;
}

export interface StrategyResult {
  /** Whether the strategy succeeded */
  success: boolean;

  /** What action should be taken next */
  action: 'continue' | 'restart_task' | 'skip_task' | 'abort' | 'ask_user' | 'rollback';

  /** Human-readable message about what happened */
  message: string;

  /** Additional details */
  details?: string;

  /** Data to pass to the next step */
  data?: unknown;
}

export interface StrategyConfig {
  /** Maximum attempts for this strategy (default: 2) */
  maxAttempts: number;

  /** Strategy-specific configuration */
  options?: Record<string, unknown>;
}

export interface Strategy {
  /** Strategy name (must match StrategyName type) */
  readonly name: StrategyName;

  /** Human-readable description */
  readonly description: string;

  /** Maximum attempts allowed */
  readonly maxAttempts: number;

  /** Check if strategy is applicable to current stuck state */
  isApplicable(stuck: StuckIndicators, context: RecoveryContext): ApplicabilityResult;

  /** Apply the strategy */
  apply(context: RecoveryContext): Promise<StrategyResult>;
}

export abstract class BaseStrategy implements Strategy {
  abstract readonly name: StrategyName;
  abstract readonly description: string;
  readonly maxAttempts: number;

  constructor(config: Partial<StrategyConfig> = {}) {
    this.maxAttempts = config.maxAttempts ?? 2;
  }

  /**
   * Check if strategy is applicable (must be implemented by subclasses)
   */
  abstract isApplicable(stuck: StuckIndicators, context: RecoveryContext): ApplicabilityResult;

  /**
   * Apply the strategy (must be implemented by subclasses)
   */
  abstract apply(context: RecoveryContext): Promise<StrategyResult>;

  /**
   * Helper: Create a successful result
   */
  protected success(
    action: StrategyResult['action'],
    message: string,
    data?: unknown
  ): StrategyResult {
    return {
      success: true,
      action,
      message,
      data,
    };
  }

  /**
   * Helper: Create a failed result
   */
  protected failure(
    action: StrategyResult['action'],
    message: string,
    details?: string
  ): StrategyResult {
    return {
      success: false,
      action,
      message,
      details,
    };
  }

  /**
   * Helper: Check if any stuck indicator is true
   */
  protected isAnyIndicatorTrue(stuck: StuckIndicators): boolean {
    return (
      stuck.repeatedErrors ||
      stuck.noProgress ||
      stuck.circularAttempts ||
      stuck.resourceExhausted ||
      stuck.timeoutExceeded
    );
  }

  /**
   * Helper: Get the most severe indicator
   */
  protected getMostSevereIndicator(stuck: StuckIndicators): string {
    // Severity order: resourceExhausted > repeatedErrors > circularAttempts > noProgress > timeoutExceeded
    if (stuck.resourceExhausted) return 'resourceExhausted';
    if (stuck.repeatedErrors) return 'repeatedErrors';
    if (stuck.circularAttempts) return 'circularAttempts';
    if (stuck.noProgress) return 'noProgress';
    if (stuck.timeoutExceeded) return 'timeoutExceeded';
    return 'none';
  }
}
```

---

## File 7: `src/lib/engine/v14-olympus/recovery/strategies/retry-with-context.ts`

### Purpose
First recovery strategy - adds more context from the knowledge store and retries. Often fixes issues caused by incomplete information.

### Exact Implementation

```typescript
/**
 * Retry With Context Strategy
 *
 * Priority: 1 (first to try)
 *
 * This strategy:
 * 1. Gathers additional context from knowledge store
 * 2. Identifies what information might be missing
 * 3. Adds relevant context to the task
 * 4. Signals to retry with enriched context
 *
 * Best for:
 * - Repeated errors (might need more context about error handling)
 * - No progress (might need more examples or patterns)
 */

import { BaseStrategy, ApplicabilityResult, StrategyResult } from './base-strategy';
import { StuckIndicators } from '../stuck-detector';
import { RecoveryContext } from '../recovery-context';
import { StrategyName } from '../index';

export class RetryWithContextStrategy extends BaseStrategy {
  readonly name: StrategyName = 'retry_with_context';
  readonly description = 'Add more context from knowledge store and retry';

  isApplicable(stuck: StuckIndicators, context: RecoveryContext): ApplicabilityResult {
    // Applicable when:
    // 1. Has repeated errors (might need error handling context)
    // 2. Has no progress (might need more examples)
    // 3. Not too many attempts already

    const attemptCount = context.getAttemptCount(this.name);
    if (attemptCount >= this.maxAttempts) {
      return {
        applicable: false,
        reason: 'Max attempts for this strategy reached',
      };
    }

    // Most applicable for repeated errors or no progress
    if (stuck.repeatedErrors || stuck.noProgress) {
      return {
        applicable: true,
        reason: stuck.repeatedErrors
          ? 'Repeated errors suggest missing context about how to handle this scenario'
          : 'No progress suggests the agent needs more information',
        confidence: 0.7,
      };
    }

    // Less applicable but still can try for other cases
    if (stuck.circularAttempts) {
      return {
        applicable: true,
        reason: 'Circular attempts might benefit from different context perspective',
        confidence: 0.4,
      };
    }

    // Not applicable for resource exhaustion (would make it worse)
    if (stuck.resourceExhausted) {
      return {
        applicable: false,
        reason: 'Adding more context would worsen resource exhaustion',
      };
    }

    // Generic applicability
    return {
      applicable: true,
      reason: 'Default first strategy to try',
      confidence: 0.5,
    };
  }

  async apply(context: RecoveryContext): Promise<StrategyResult> {
    // Step 1: Gather relevant context
    const additionalContext = await this.gatherContext(context);

    if (!additionalContext.found) {
      return this.failure(
        'continue',
        'Could not find additional relevant context',
        additionalContext.reason
      );
    }

    // Step 2: Write enriched context to knowledge store
    await context.writeKnowledge(
      '/recovery/enriched-context.json',
      JSON.stringify({
        timestamp: Date.now(),
        task: context.currentTask.id,
        additionalContext: additionalContext.content,
        sources: additionalContext.sources,
      }, null, 2)
    );

    // Step 3: Signal to retry with enriched context
    return this.success(
      'continue',
      'Added enriched context - agent should retry with additional information',
      {
        contextPath: '/recovery/enriched-context.json',
        contextSummary: additionalContext.summary,
        sourcesUsed: additionalContext.sources.length,
      }
    );
  }

  /**
   * Gather additional context based on stuck state
   */
  private async gatherContext(context: RecoveryContext): Promise<{
    found: boolean;
    reason?: string;
    content?: string;
    summary?: string;
    sources: string[];
  }> {
    const sources: string[] = [];
    const contextParts: string[] = [];

    // Get error context
    const analysis = context.stuckIndicators.analysis;

    if (analysis.mostCommonError) {
      // Look for similar error handling patterns
      const errorContext = await this.findErrorContext(context, analysis.mostCommonError);
      if (errorContext) {
        contextParts.push(`## Error Handling Context\n${errorContext}`);
        sources.push('error-patterns');
      }
    }

    // Get architecture context
    const architecture = await context.getArchitecture();
    if (architecture) {
      contextParts.push(`## Architecture Reference\n${JSON.stringify(architecture, null, 2).slice(0, 2000)}`);
      sources.push('architecture');
    }

    // Get related requirements
    const requirements = await context.getRequirements();
    if (requirements) {
      const taskReqs = this.findRelatedRequirements(requirements, context.currentTask);
      if (taskReqs) {
        contextParts.push(`## Related Requirements\n${taskReqs}`);
        sources.push('requirements');
      }
    }

    // Get existing files for reference
    const files = await context.listFiles();
    const relevantFiles = files.filter(f => this.isFileRelevant(f, context.currentTask));
    if (relevantFiles.length > 0) {
      const fileContents = await Promise.all(
        relevantFiles.slice(0, 3).map(async f => {
          const content = await context.readFile(f);
          return `### ${f}\n\`\`\`\n${content?.slice(0, 1000)}\n\`\`\``;
        })
      );
      contextParts.push(`## Relevant Existing Files\n${fileContents.join('\n\n')}`);
      sources.push('existing-files');
    }

    if (contextParts.length === 0) {
      return {
        found: false,
        reason: 'No additional relevant context found in knowledge store',
        sources: [],
      };
    }

    return {
      found: true,
      content: contextParts.join('\n\n---\n\n'),
      summary: `Found ${sources.length} sources of additional context: ${sources.join(', ')}`,
      sources,
    };
  }

  /**
   * Find context related to a specific error
   */
  private async findErrorContext(
    context: RecoveryContext,
    error: string
  ): Promise<string | null> {
    // Common error patterns and their contexts
    const errorPatterns: Array<{ pattern: RegExp; context: string }> = [
      {
        pattern: /type.*is not assignable/i,
        context: 'Ensure types are properly imported and match the expected interfaces.',
      },
      {
        pattern: /cannot find module/i,
        context: 'Check import paths and ensure the module is installed/created.',
      },
      {
        pattern: /property.*does not exist/i,
        context: 'Verify the property name and type definition. Check for typos.',
      },
      {
        pattern: /unexpected token/i,
        context: 'Check for syntax errors. Common issues: missing commas, brackets, or semicolons.',
      },
      {
        pattern: /is not a function/i,
        context: 'Ensure the value is actually a function and properly imported.',
      },
    ];

    for (const { pattern, context: ctx } of errorPatterns) {
      if (pattern.test(error)) {
        return ctx;
      }
    }

    return null;
  }

  /**
   * Find requirements related to current task
   */
  private findRelatedRequirements(requirements: unknown, task: { id: string; description: string }): string | null {
    if (!requirements || typeof requirements !== 'object') return null;

    const req = requirements as Record<string, unknown>;
    const allReqs = [
      ...(Array.isArray(req.explicit) ? req.explicit : []),
      ...(Array.isArray(req.implicit) ? req.implicit : []),
    ];

    // Find requirements that might be related to this task
    const related = allReqs.filter((r: unknown) => {
      if (!r || typeof r !== 'object') return false;
      const reqObj = r as Record<string, string>;
      const desc = task.description.toLowerCase();
      return (
        reqObj.description?.toLowerCase().includes(desc.slice(0, 20)) ||
        reqObj.id === task.id
      );
    });

    if (related.length === 0) return null;

    return related.map((r: unknown) => {
      const reqObj = r as Record<string, string>;
      return `- ${reqObj.id}: ${reqObj.description}`;
    }).join('\n');
  }

  /**
   * Check if a file is relevant to current task
   */
  private isFileRelevant(filePath: string, task: { id: string; description: string }): boolean {
    const taskWords = task.description.toLowerCase().split(/\s+/);
    const fileName = filePath.toLowerCase();

    // Check if any task word appears in file name
    return taskWords.some(word =>
      word.length > 3 && fileName.includes(word)
    );
  }
}
```

---

## File 8: `src/lib/engine/v14-olympus/recovery/strategies/simplify-approach.ts`

### Purpose
Simplifies the current approach by removing optional features or reducing scope.

### Exact Implementation

```typescript
/**
 * Simplify Approach Strategy
 *
 * Priority: 2
 *
 * This strategy:
 * 1. Analyzes the current task complexity
 * 2. Identifies optional/nice-to-have features
 * 3. Creates a simplified version of the task
 * 4. Updates the plan with reduced scope
 *
 * Best for:
 * - Circular attempts (same approach failing repeatedly)
 * - Repeated errors on complex tasks
 */

import { BaseStrategy, ApplicabilityResult, StrategyResult } from './base-strategy';
import { StuckIndicators } from '../stuck-detector';
import { RecoveryContext } from '../recovery-context';
import { StrategyName } from '../index';

export class SimplifyApproachStrategy extends BaseStrategy {
  readonly name: StrategyName = 'simplify_approach';
  readonly description = 'Simplify the current task by removing optional features';

  isApplicable(stuck: StuckIndicators, context: RecoveryContext): ApplicabilityResult {
    const attemptCount = context.getAttemptCount(this.name);
    if (attemptCount >= this.maxAttempts) {
      return {
        applicable: false,
        reason: 'Max attempts for this strategy reached',
      };
    }

    // Most applicable for circular attempts or repeated errors
    if (stuck.circularAttempts) {
      return {
        applicable: true,
        reason: 'Circular attempts suggest the task is too complex for current approach',
        confidence: 0.75,
      };
    }

    if (stuck.repeatedErrors && context.getAttemptCount('retry_with_context') > 0) {
      return {
        applicable: true,
        reason: 'Repeated errors after context addition suggests need for simplification',
        confidence: 0.65,
      };
    }

    if (stuck.noProgress) {
      return {
        applicable: true,
        reason: 'No progress suggests task may be too ambitious',
        confidence: 0.6,
      };
    }

    return {
      applicable: false,
      reason: 'Current stuck state does not suggest simplification would help',
    };
  }

  async apply(context: RecoveryContext): Promise<StrategyResult> {
    // Step 1: Analyze task complexity
    const task = context.currentTask;
    const plan = await context.getPlan();

    if (!plan) {
      return this.failure(
        'continue',
        'Cannot simplify - plan not found',
      );
    }

    // Step 2: Identify what can be simplified
    const simplifications = this.identifySimplifications(task, plan);

    if (simplifications.length === 0) {
      return this.failure(
        'continue',
        'Task is already at minimum complexity - cannot simplify further',
      );
    }

    // Step 3: Create simplified task description
    const simplifiedTask = this.createSimplifiedTask(task, simplifications);

    // Step 4: Record simplifications for later completion
    await context.writeKnowledge(
      '/recovery/deferred-features.json',
      JSON.stringify({
        timestamp: Date.now(),
        originalTask: task,
        simplifiedTask,
        deferredFeatures: simplifications.map(s => s.feature),
        reason: 'Simplified due to stuck state',
      }, null, 2)
    );

    // Step 5: Update the current task
    await context.writeKnowledge(
      `/plan/tasks/${task.id}-simplified.json`,
      JSON.stringify(simplifiedTask, null, 2)
    );

    return this.success(
      'restart_task',
      `Simplified task by removing ${simplifications.length} optional features`,
      {
        originalDescription: task.description,
        simplifiedDescription: simplifiedTask.description,
        deferredFeatures: simplifications.map(s => s.feature),
      }
    );
  }

  /**
   * Identify what can be simplified from a task
   */
  private identifySimplifications(
    task: { id: string; description: string; features?: string[] },
    plan: unknown
  ): Array<{ feature: string; reason: string; priority: 'optional' | 'nice-to-have' }> {
    const simplifications: Array<{
      feature: string;
      reason: string;
      priority: 'optional' | 'nice-to-have';
    }> = [];

    // Keywords that indicate optional features
    const optionalKeywords = [
      'optionally', 'if possible', 'nice to have', 'bonus',
      'advanced', 'extra', 'additional', 'enhanced',
    ];

    const description = task.description.toLowerCase();

    // Check for optional keywords
    for (const keyword of optionalKeywords) {
      if (description.includes(keyword)) {
        // Extract the feature mentioned with this keyword
        const match = description.match(new RegExp(`${keyword}[,:]?\\s*([^.]+)`));
        if (match) {
          simplifications.push({
            feature: match[1].trim(),
            reason: `Marked as "${keyword}" in description`,
            priority: 'optional',
          });
        }
      }
    }

    // Check for common simplifiable patterns
    const simplifiablePatterns = [
      { pattern: /animations?|transitions?/i, feature: 'animations', reason: 'Animations are cosmetic' },
      { pattern: /dark mode|theme/i, feature: 'theming', reason: 'Theming can be added later' },
      { pattern: /export|import|csv|pdf/i, feature: 'export functionality', reason: 'Export is secondary' },
      { pattern: /notifications?|alerts?/i, feature: 'notifications', reason: 'Can use simple alerts first' },
      { pattern: /realtime|websocket|live/i, feature: 'realtime updates', reason: 'Can start with polling' },
      { pattern: /search|filter.*advanced/i, feature: 'advanced search', reason: 'Can start with basic search' },
    ];

    for (const { pattern, feature, reason } of simplifiablePatterns) {
      if (pattern.test(description)) {
        simplifications.push({
          feature,
          reason,
          priority: 'nice-to-have',
        });
      }
    }

    // If task has explicit features list
    if (task.features) {
      const coreFeatures = task.features.slice(0, 2);
      const extraFeatures = task.features.slice(2);

      for (const feature of extraFeatures) {
        simplifications.push({
          feature,
          reason: 'Non-core feature that can be deferred',
          priority: 'nice-to-have',
        });
      }
    }

    return simplifications;
  }

  /**
   * Create a simplified version of the task
   */
  private createSimplifiedTask(
    originalTask: { id: string; description: string; [key: string]: unknown },
    simplifications: Array<{ feature: string; reason: string }>
  ): { id: string; description: string; simplified: true; [key: string]: unknown } {
    let simplifiedDescription = originalTask.description;

    // Remove mentions of simplified features
    for (const { feature } of simplifications) {
      // Try to remove the feature mention
      const patterns = [
        new RegExp(`\\s*,?\\s*${feature}`, 'gi'),
        new RegExp(`\\s*with\\s+${feature}`, 'gi'),
        new RegExp(`\\s*including\\s+${feature}`, 'gi'),
        new RegExp(`\\s*and\\s+${feature}`, 'gi'),
      ];

      for (const pattern of patterns) {
        simplifiedDescription = simplifiedDescription.replace(pattern, '');
      }
    }

    // Add simplification note
    simplifiedDescription = simplifiedDescription.trim() +
      ' (SIMPLIFIED: Focus on core functionality only)';

    return {
      ...originalTask,
      id: `${originalTask.id}-simplified`,
      description: simplifiedDescription,
      simplified: true,
      originalTaskId: originalTask.id,
      removedFeatures: simplifications.map(s => s.feature),
    };
  }
}
```

---

## File 9: `src/lib/engine/v14-olympus/recovery/strategies/human-escalation.ts`

### Purpose
The final fallback strategy - packages all context and asks a human for guidance.

### Exact Implementation

```typescript
/**
 * Human Escalation Strategy
 *
 * Priority: 7 (LAST RESORT)
 *
 * This strategy:
 * 1. Packages all relevant context
 * 2. Presents clear options to the user
 * 3. Waits for human decision
 * 4. Applies the human's guidance
 *
 * This is the FINAL fallback when all automated strategies fail.
 */

import { BaseStrategy, ApplicabilityResult, StrategyResult } from './base-strategy';
import { StuckIndicators } from '../stuck-detector';
import { RecoveryContext, RecoverySummary } from '../recovery-context';
import { StrategyName } from '../index';
import { EventType } from '../../types/events';

export interface EscalationPackage {
  /** Summary of current state */
  summary: RecoverySummary;

  /** What we were trying to do */
  task: {
    id: string;
    description: string;
    status: string;
  };

  /** What went wrong */
  problemDescription: string;

  /** What we tried */
  recoveryAttempts: Array<{
    strategy: string;
    success: boolean;
    message: string;
  }>;

  /** Current progress */
  progress: {
    filesGenerated: number;
    filesExpected?: number;
    percentComplete?: number;
  };

  /** Suggested options for user */
  options: Array<{
    id: string;
    label: string;
    description: string;
    recommended?: boolean;
  }>;

  /** Timestamp */
  timestamp: number;
}

export interface HumanDecision {
  /** Selected option ID */
  optionId: string;

  /** Additional guidance (if provided) */
  guidance?: string;

  /** Modified requirements (if simplify option) */
  modifiedRequirements?: string;
}

export class HumanEscalationStrategy extends BaseStrategy {
  readonly name: StrategyName = 'human_escalation';
  readonly description = 'Ask a human for guidance (last resort)';
  readonly maxAttempts = 1; // Only ask human once

  isApplicable(stuck: StuckIndicators, context: RecoveryContext): ApplicabilityResult {
    // Always applicable as last resort, but only once
    const attemptCount = context.getAttemptCount(this.name);
    if (attemptCount >= this.maxAttempts) {
      return {
        applicable: false,
        reason: 'Human has already been consulted',
      };
    }

    // More confident if we've tried other strategies
    const triedStrategies = context.getTriedStrategies();
    const confidence = Math.min(0.9, 0.3 + triedStrategies.size * 0.1);

    return {
      applicable: true,
      reason: 'Last resort - all automated strategies exhausted',
      confidence,
    };
  }

  async apply(context: RecoveryContext): Promise<StrategyResult> {
    // Step 1: Create comprehensive escalation package
    const escalationPackage = await this.createEscalationPackage(context);

    // Step 2: Save escalation package for reference
    await context.writeKnowledge(
      '/recovery/escalation-package.json',
      JSON.stringify(escalationPackage, null, 2)
    );

    // Step 3: Emit escalation event
    context.emit(EventType.USER_INPUT_REQUIRED, {
      reason: 'RECOVERY_EXHAUSTED',
      urgency: 'high',
      package: escalationPackage,
    });

    // Step 4: Present options to user
    const decision = await this.askUserForDecision(context, escalationPackage);

    if (!decision) {
      return this.failure(
        'abort',
        'User did not respond to escalation request',
      );
    }

    // Step 5: Apply user's decision
    return this.applyDecision(context, decision);
  }

  /**
   * Create a comprehensive escalation package
   */
  private async createEscalationPackage(context: RecoveryContext): Promise<EscalationPackage> {
    const summary = await context.createSummary();
    const files = await context.listFiles();

    // Build problem description
    const stuck = context.stuckIndicators;
    let problemDescription = stuck.primaryReason || 'Unknown issue';

    if (stuck.analysis.mostCommonError) {
      problemDescription += `\n\nMost common error: ${stuck.analysis.mostCommonError}`;
    }

    // Get recovery attempts
    const attempts = context.getAttempts();

    // Build options
    const options = this.buildOptions(stuck, attempts);

    return {
      summary,
      task: summary.task,
      problemDescription,
      recoveryAttempts: attempts.map(a => ({
        strategy: a.strategy,
        success: a.success,
        message: a.reason,
      })),
      progress: {
        filesGenerated: files.length,
      },
      options,
      timestamp: Date.now(),
    };
  }

  /**
   * Build options for user
   */
  private buildOptions(
    stuck: StuckIndicators,
    attempts: Array<{ strategy: string; success: boolean }>
  ): EscalationPackage['options'] {
    const options: EscalationPackage['options'] = [];

    // Option 1: Simplify (usually recommended)
    options.push({
      id: 'simplify',
      label: 'Simplify Requirements',
      description: 'Reduce the scope of what needs to be built. You can provide simplified requirements.',
      recommended: stuck.circularAttempts || stuck.noProgress,
    });

    // Option 2: Provide guidance
    options.push({
      id: 'guidance',
      label: 'Provide Specific Guidance',
      description: 'Tell the system exactly how to proceed. Useful if you know the solution.',
      recommended: stuck.repeatedErrors,
    });

    // Option 3: Skip this task
    options.push({
      id: 'skip',
      label: 'Skip This Task',
      description: 'Skip this task and continue with the rest. The feature will be stubbed.',
      recommended: false,
    });

    // Option 4: Rollback and retry
    options.push({
      id: 'rollback',
      label: 'Rollback and Try Again',
      description: 'Go back to the last checkpoint and try again from there.',
      recommended: false,
    });

    // Option 5: Abort
    options.push({
      id: 'abort',
      label: 'Abort Generation',
      description: 'Stop the generation process. Files created so far will be preserved.',
      recommended: false,
    });

    return options;
  }

  /**
   * Ask user for their decision
   */
  private async askUserForDecision(
    context: RecoveryContext,
    pkg: EscalationPackage
  ): Promise<HumanDecision | null> {
    // Build the question with full context
    const question = this.buildQuestion(pkg);

    // Ask user to choose an option
    const optionResponse = await context.askUser({
      type: 'choice',
      question: question.main,
      context: question.context,
      options: pkg.options.map(o => ({
        id: o.id,
        label: o.recommended ? `${o.label} (Recommended)` : o.label,
        description: o.description,
      })),
      timeout: 300000, // 5 minute timeout
    });

    if (optionResponse.timedOut || !optionResponse.selectedOptionId) {
      return null;
    }

    const decision: HumanDecision = {
      optionId: optionResponse.selectedOptionId,
    };

    // If user chose simplify or guidance, ask for details
    if (optionResponse.selectedOptionId === 'simplify') {
      const detailResponse = await context.askUser({
        type: 'freeform',
        question: 'Please describe the simplified requirements:',
        context: `Current task: ${pkg.task.description}`,
        timeout: 300000,
      });

      if (!detailResponse.timedOut) {
        decision.modifiedRequirements = detailResponse.response;
      }
    } else if (optionResponse.selectedOptionId === 'guidance') {
      const guidanceResponse = await context.askUser({
        type: 'freeform',
        question: 'Please provide your guidance:',
        context: `Problem: ${pkg.problemDescription}`,
        timeout: 300000,
      });

      if (!guidanceResponse.timedOut) {
        decision.guidance = guidanceResponse.response;
      }
    }

    return decision;
  }

  /**
   * Build the question for the user
   */
  private buildQuestion(pkg: EscalationPackage): { main: string; context: string } {
    const attemptSummary = pkg.recoveryAttempts.length > 0
      ? `We've tried ${pkg.recoveryAttempts.length} recovery strategies but couldn't resolve the issue.`
      : 'Automated recovery could not resolve the issue.';

    return {
      main: `The generation process is stuck and needs your help. ${attemptSummary}\n\nHow would you like to proceed?`,
      context: [
        `Task: ${pkg.task.description}`,
        `Problem: ${pkg.problemDescription}`,
        `Files generated so far: ${pkg.progress.filesGenerated}`,
      ].join('\n'),
    };
  }

  /**
   * Apply the user's decision
   */
  private async applyDecision(
    context: RecoveryContext,
    decision: HumanDecision
  ): Promise<StrategyResult> {
    switch (decision.optionId) {
      case 'simplify':
        if (decision.modifiedRequirements) {
          // Update requirements with simplified version
          await context.writeKnowledge(
            '/requirements/simplified.json',
            JSON.stringify({
              timestamp: Date.now(),
              originalTask: context.currentTask.id,
              simplifiedRequirements: decision.modifiedRequirements,
              source: 'human_escalation',
            }, null, 2)
          );
        }
        return this.success(
          'restart_task',
          'User provided simplified requirements - restarting task',
          { modifiedRequirements: decision.modifiedRequirements }
        );

      case 'guidance':
        if (decision.guidance) {
          await context.writeKnowledge(
            '/recovery/human-guidance.json',
            JSON.stringify({
              timestamp: Date.now(),
              task: context.currentTask.id,
              guidance: decision.guidance,
            }, null, 2)
          );
        }
        return this.success(
          'continue',
          'User provided guidance - continuing with instructions',
          { guidance: decision.guidance }
        );

      case 'skip':
        return this.success(
          'skip_task',
          'User chose to skip this task',
        );

      case 'rollback':
        return this.success(
          'rollback',
          'User requested rollback to last checkpoint',
        );

      case 'abort':
        return this.success(
          'abort',
          'User chose to abort generation',
        );

      default:
        return this.failure(
          'continue',
          `Unknown decision option: ${decision.optionId}`,
        );
    }
  }
}
```

---

## Additional Strategy Files (Abbreviated)

The remaining strategies follow the same pattern. Here are their key interfaces:

### `alternative-solution.ts`
```typescript
export class AlternativeSolutionStrategy extends BaseStrategy {
  readonly name: StrategyName = 'alternative_solution';
  readonly description = 'Try a completely different approach to achieve the same goal';

  // Applicable when: circularAttempts or repeatedErrors after simplify
  // Action: Generate alternative implementation approach
  // Returns: restart_task with new approach
}
```

### `decompose-task.ts`
```typescript
export class DecomposeTaskStrategy extends BaseStrategy {
  readonly name: StrategyName = 'decompose_task';
  readonly description = 'Break the task into smaller, more manageable subtasks';

  // Applicable when: noProgress or resourceExhausted
  // Action: Split task into 2-4 smaller subtasks
  // Returns: restart_task with first subtask, others queued
}
```

### `skip-and-stub.ts`
```typescript
export class SkipAndStubStrategy extends BaseStrategy {
  readonly name: StrategyName = 'skip_and_stub';
  readonly description = 'Create a stub implementation and continue with other tasks';

  // Applicable when: Non-critical task, all above strategies failed
  // Action: Generate stub code with TODO comments
  // Returns: skip_task
}
```

### `rollback.ts`
```typescript
export class RollbackStrategy extends BaseStrategy {
  readonly name: StrategyName = 'rollback';
  readonly description = 'Restore from the last known good checkpoint';

  // Applicable when: resourceExhausted or many errors
  // Action: Restore checkpoint, clear problematic state
  // Returns: rollback with checkpoint ID
}
```

---

## Integration with Orchestrator

The recovery system integrates with the orchestrator as follows:

```typescript
// In orchestrator.ts

import { StuckDetector, StrategySelector, RecoveryContext } from '../recovery';

class Orchestrator {
  private stuckDetector: StuckDetector;
  private strategySelector: StrategySelector;

  constructor(config: OrchestratorConfig) {
    // ... existing setup ...

    this.stuckDetector = new StuckDetector();
    this.strategySelector = new StrategySelector();
  }

  private async checkForStuck(agent: BaseAgent): Promise<void> {
    const history = agent.getHistory();
    const indicators = this.stuckDetector.detect(history);

    if (this.stuckDetector.isStuck(indicators)) {
      await this.handleStuck(agent, indicators);
    }
  }

  private async handleStuck(
    agent: BaseAgent,
    indicators: StuckIndicators
  ): Promise<void> {
    this.emit(EventType.STUCK_DETECTED, {
      agent: agent.name,
      indicators,
    });

    const context = new RecoveryContext({
      sessionId: this.sessionId,
      currentTask: agent.getCurrentTask(),
      currentAgent: agent.name,
      stuckIndicators: indicators,
      eventStream: this.eventStream,
      knowledge: this.knowledge,
      sandbox: this.sandbox,
      checkpoints: this.checkpoints,
      askUser: this.askUser.bind(this),
    });

    const result = await this.strategySelector.recover(context);

    // Handle result based on action
    switch (result.action) {
      case 'continue':
        // Retry with enriched context
        break;
      case 'restart_task':
        // Restart current task
        break;
      case 'skip_task':
        // Skip and move to next task
        break;
      case 'rollback':
        // Restore checkpoint
        break;
      case 'abort':
        // Stop generation
        throw new Error('Generation aborted: ' + result.message);
    }
  }
}
```

---

## Testing Strategy for Phase 4

### Unit Tests

```typescript
// stuck-detector.test.ts
describe('StuckDetector', () => {
  it('should detect repeated errors');
  it('should detect no progress');
  it('should detect circular attempts');
  it('should detect resource exhaustion');
  it('should detect timeout');
  it('should calculate severity correctly');
  it('should suggest appropriate strategies');
});

// strategy-selector.test.ts
describe('StrategySelector', () => {
  it('should select first applicable strategy');
  it('should skip exhausted strategies');
  it('should return human escalation when all else fails');
  it('should track attempts correctly');
});

// Individual strategy tests
describe('RetryWithContextStrategy', () => {
  it('should gather relevant context');
  it('should be applicable for repeated errors');
  it('should not be applicable when context exhausted');
});
```

### Integration Tests

```typescript
describe('Recovery Flow', () => {
  it('should recover from repeated error with context');
  it('should simplify when context fails');
  it('should escalate to human when all strategies fail');
  it('should respect user decisions');
});
```

---

## Verification Checklist

After Phase 4 implementation:

- [ ] StuckDetector correctly identifies all 5 stuck indicators
- [ ] StrategySelector follows priority order
- [ ] Each strategy has proper applicability checks
- [ ] Human escalation packages all necessary context
- [ ] Recovery context provides all necessary services
- [ ] Recovery history tracks all attempts
- [ ] Integration with orchestrator works correctly
- [ ] All unit tests pass
- [ ] Integration tests pass

---

## Next Phase

Once Phase 4 is complete and verified, proceed to **Phase 5: Verification Engine**.
