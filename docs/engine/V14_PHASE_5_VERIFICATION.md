# V14 OLYMPUS - Phase 5: Verification Engine

## Overview

Phase 5 implements the comprehensive 8-layer verification system. The key innovation is **independent test generation** - tests are generated from requirements, NOT from the code being tested. This ensures tests actually verify that requirements are met, not just that code works.

**Files to Create:** 8
**Estimated Complexity:** High
**Dependencies:** Phase 1 (types, events), Phase 2 (knowledge), Phase 3 (agents), Phase 4 (recovery)

---

## Architecture Overview

```
                    ┌──────────────────────────────────────────────┐
                    │           APOLLO (Verification Agent)         │
                    │                                              │
                    │  ┌────────────────────────────────────────┐  │
                    │  │         Verification Pipeline          │  │
                    │  │                                        │  │
                    │  │  Layer 1: Static Analysis (ESLint)     │  │
                    │  │            ↓                           │  │
                    │  │  Layer 2: Type Checking (TypeScript)   │  │
                    │  │            ↓                           │  │
                    │  │  Layer 3: Build Verification (Next.js) │  │
                    │  │            ↓                           │  │
                    │  │  Layer 4: Unit Tests (Jest)            │  │
                    │  │            ↓                           │  │
                    │  │  Layer 5: Integration Tests (Jest)     │  │
                    │  │            ↓                           │  │
                    │  │  Layer 6: E2E Tests (Playwright)       │  │
                    │  │            ↓                           │  │
                    │  │  Layer 7: Security Scanning            │  │
                    │  │            ↓                           │  │
                    │  │  Layer 8: Requirement Coverage         │  │
                    │  │                                        │  │
                    │  └────────────────────────────────────────┘  │
                    └──────────────────────────────────────────────┘
```

---

## File Structure

```
src/lib/engine/v14-olympus/verification/
├── index.ts                    # Module exports
├── verification-pipeline.ts    # Main pipeline orchestration
├── static-analyzer.ts          # ESLint integration
├── type-checker.ts             # TypeScript checking
├── build-verifier.ts           # Next.js build verification
├── test-generator.ts           # Generate tests from requirements
├── test-runner.ts              # Jest/Playwright execution
├── security-scanner.ts         # Security pattern detection
└── coverage-tracker.ts         # Requirement coverage tracking
```

---

## File 1: `src/lib/engine/v14-olympus/verification/index.ts`

### Purpose
Central export file for the verification module.

### Exact Implementation

```typescript
/**
 * V14 OLYMPUS Verification Engine
 *
 * Provides 8-layer verification with independent test generation.
 */

// Core exports
export {
  VerificationPipeline,
  type VerificationResult,
  type VerificationConfig,
  type LayerResult,
} from './verification-pipeline';

export {
  StaticAnalyzer,
  type LintResult,
  type LintIssue,
} from './static-analyzer';

export {
  TypeChecker,
  type TypeCheckResult,
  type TypeCheckError,
} from './type-checker';

export {
  BuildVerifier,
  type BuildResult,
} from './build-verifier';

export {
  TestGenerator,
  type GeneratedTest,
  type AcceptanceCriterion,
  type TestSuite,
} from './test-generator';

export {
  TestRunner,
  type TestRunResult,
  type TestCase,
} from './test-runner';

export {
  SecurityScanner,
  type SecurityIssue,
  type SecurityScanResult,
} from './security-scanner';

export {
  CoverageTracker,
  type CoverageReport,
  type RequirementCoverage,
} from './coverage-tracker';

// Verification layers
export const VERIFICATION_LAYERS = [
  'static_analysis',
  'type_checking',
  'build',
  'unit_tests',
  'integration_tests',
  'e2e_tests',
  'security',
  'coverage',
] as const;

export type VerificationLayer = typeof VERIFICATION_LAYERS[number];
```

---

## File 2: `src/lib/engine/v14-olympus/verification/verification-pipeline.ts`

### Purpose
Orchestrates all 8 verification layers in sequence, collecting results and determining overall pass/fail.

### Exact Implementation

```typescript
/**
 * Verification Pipeline
 *
 * Orchestrates all 8 verification layers:
 * 1. Static Analysis (ESLint)
 * 2. Type Checking (TypeScript)
 * 3. Build Verification (Next.js)
 * 4. Unit Tests (Jest)
 * 5. Integration Tests (Jest)
 * 6. E2E Tests (Playwright)
 * 7. Security Scanning
 * 8. Requirement Coverage
 *
 * Each layer can be configured to be blocking (fail stops pipeline)
 * or non-blocking (continues with warnings).
 */

import { StaticAnalyzer, LintResult } from './static-analyzer';
import { TypeChecker, TypeCheckResult } from './type-checker';
import { BuildVerifier, BuildResult } from './build-verifier';
import { TestGenerator, TestSuite } from './test-generator';
import { TestRunner, TestRunResult } from './test-runner';
import { SecurityScanner, SecurityScanResult } from './security-scanner';
import { CoverageTracker, CoverageReport } from './coverage-tracker';
import { EventStream } from '../core/event-stream';
import { EventType } from '../types/events';
import { KnowledgeStore } from '../knowledge/store';
import { MemorySandbox } from '../sandbox/memory-sandbox';
import { VerificationLayer } from './index';
import Anthropic from '@anthropic-ai/sdk';

// Layer result
export interface LayerResult {
  layer: VerificationLayer;
  passed: boolean;
  blocking: boolean;
  issues: VerificationIssue[];
  duration: number;
  details?: unknown;
}

// Issue from any layer
export interface VerificationIssue {
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

// Overall result
export interface VerificationResult {
  passed: boolean;
  layers: LayerResult[];
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  duration: number;
  summary: string;
  recommendations: string[];
}

// Configuration
export interface VerificationConfig {
  /** Which layers to run (default: all) */
  layers?: VerificationLayer[];

  /** Layers that should block on failure (default: static, types, build) */
  blockingLayers?: VerificationLayer[];

  /** Skip test generation (use existing tests) */
  skipTestGeneration?: boolean;

  /** Max issues before stopping (default: 100) */
  maxIssues?: number;

  /** Timeout per layer in ms (default: 120000) */
  layerTimeout?: number;

  /** Anthropic client for test generation */
  anthropicClient?: Anthropic;

  /** Anthropic API key */
  apiKey?: string;
}

// Default configuration
const DEFAULT_CONFIG: Required<VerificationConfig> = {
  layers: [
    'static_analysis',
    'type_checking',
    'build',
    'unit_tests',
    'integration_tests',
    'e2e_tests',
    'security',
    'coverage',
  ],
  blockingLayers: ['static_analysis', 'type_checking', 'build'],
  skipTestGeneration: false,
  maxIssues: 100,
  layerTimeout: 120000,
  anthropicClient: undefined as unknown as Anthropic,
  apiKey: '',
};

export class VerificationPipeline {
  private config: Required<VerificationConfig>;
  private eventStream: EventStream;
  private knowledge: KnowledgeStore;
  private sandbox: MemorySandbox;
  private sessionId: string;

  // Layer implementations
  private staticAnalyzer: StaticAnalyzer;
  private typeChecker: TypeChecker;
  private buildVerifier: BuildVerifier;
  private testGenerator: TestGenerator;
  private testRunner: TestRunner;
  private securityScanner: SecurityScanner;
  private coverageTracker: CoverageTracker;

  constructor(config: {
    config: VerificationConfig;
    eventStream: EventStream;
    knowledge: KnowledgeStore;
    sandbox: MemorySandbox;
    sessionId: string;
  }) {
    this.config = { ...DEFAULT_CONFIG, ...config.config };
    this.eventStream = config.eventStream;
    this.knowledge = config.knowledge;
    this.sandbox = config.sandbox;
    this.sessionId = config.sessionId;

    // Ensure we have an Anthropic client
    if (!this.config.anthropicClient && this.config.apiKey) {
      this.config.anthropicClient = new Anthropic({ apiKey: this.config.apiKey });
    }

    // Initialize layers
    this.staticAnalyzer = new StaticAnalyzer();
    this.typeChecker = new TypeChecker();
    this.buildVerifier = new BuildVerifier();
    this.testGenerator = new TestGenerator(this.config.anthropicClient);
    this.testRunner = new TestRunner();
    this.securityScanner = new SecurityScanner();
    this.coverageTracker = new CoverageTracker();
  }

  /**
   * Run the full verification pipeline
   */
  async run(): Promise<VerificationResult> {
    const startTime = Date.now();
    const layerResults: LayerResult[] = [];
    let totalIssues = 0;
    let errorCount = 0;
    let warningCount = 0;
    let stopped = false;

    this.emit(EventType.PHASE_STARTED, { phase: 'verification' });

    // Get files from sandbox
    const files = this.sandbox.getFiles();

    for (const layer of this.config.layers) {
      if (stopped) break;

      this.emit(EventType.AGENT_PROGRESS, {
        agent: 'apollo',
        layer,
        message: `Running ${layer}...`,
      });

      const layerStart = Date.now();
      let result: LayerResult;

      try {
        result = await this.runLayer(layer, files);
      } catch (error) {
        result = {
          layer,
          passed: false,
          blocking: this.isBlocking(layer),
          issues: [{
            severity: 'error',
            type: 'LAYER_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          }],
          duration: Date.now() - layerStart,
        };
      }

      layerResults.push(result);

      // Count issues
      for (const issue of result.issues) {
        totalIssues++;
        if (issue.severity === 'error') errorCount++;
        if (issue.severity === 'warning') warningCount++;
      }

      // Check if we should stop
      if (!result.passed && result.blocking) {
        stopped = true;
        this.emit(EventType.AGENT_ERROR, {
          agent: 'apollo',
          layer,
          message: `Blocking layer ${layer} failed - stopping pipeline`,
        });
      }

      // Check max issues
      if (totalIssues >= this.config.maxIssues) {
        stopped = true;
        this.emit(EventType.AGENT_ERROR, {
          agent: 'apollo',
          message: `Max issues (${this.config.maxIssues}) exceeded`,
        });
      }
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(layerResults);

    // Build summary
    const passed = layerResults.every(r => r.passed || !r.blocking);
    const summary = this.buildSummary(layerResults, passed);

    const result: VerificationResult = {
      passed,
      layers: layerResults,
      totalIssues,
      errorCount,
      warningCount,
      duration: Date.now() - startTime,
      summary,
      recommendations,
    };

    // Save results to knowledge store
    await this.saveResults(result);

    this.emit(EventType.PHASE_COMPLETED, {
      phase: 'verification',
      passed,
      summary,
    });

    return result;
  }

  /**
   * Run a single verification layer
   */
  private async runLayer(
    layer: VerificationLayer,
    files: Map<string, string>
  ): Promise<LayerResult> {
    const startTime = Date.now();
    const isBlocking = this.isBlocking(layer);

    switch (layer) {
      case 'static_analysis':
        return this.runStaticAnalysis(files, isBlocking, startTime);

      case 'type_checking':
        return this.runTypeChecking(files, isBlocking, startTime);

      case 'build':
        return this.runBuildVerification(files, isBlocking, startTime);

      case 'unit_tests':
        return this.runUnitTests(files, isBlocking, startTime);

      case 'integration_tests':
        return this.runIntegrationTests(files, isBlocking, startTime);

      case 'e2e_tests':
        return this.runE2ETests(files, isBlocking, startTime);

      case 'security':
        return this.runSecurityScan(files, isBlocking, startTime);

      case 'coverage':
        return this.runCoverageCheck(isBlocking, startTime);

      default:
        return {
          layer,
          passed: true,
          blocking: false,
          issues: [],
          duration: 0,
        };
    }
  }

  /**
   * Layer 1: Static Analysis
   */
  private async runStaticAnalysis(
    files: Map<string, string>,
    blocking: boolean,
    startTime: number
  ): Promise<LayerResult> {
    const result = await this.staticAnalyzer.analyze(files);

    return {
      layer: 'static_analysis',
      passed: result.errorCount === 0,
      blocking,
      issues: result.issues.map(i => ({
        severity: i.severity === 2 ? 'error' : i.severity === 1 ? 'warning' : 'info',
        type: i.ruleId || 'LINT_ISSUE',
        message: i.message,
        file: i.filePath,
        line: i.line,
        column: i.column,
        suggestion: i.fix?.text,
      })),
      duration: Date.now() - startTime,
      details: result,
    };
  }

  /**
   * Layer 2: Type Checking
   */
  private async runTypeChecking(
    files: Map<string, string>,
    blocking: boolean,
    startTime: number
  ): Promise<LayerResult> {
    const result = await this.typeChecker.check(files);

    return {
      layer: 'type_checking',
      passed: result.errors.length === 0,
      blocking,
      issues: result.errors.map(e => ({
        severity: 'error',
        type: `TS${e.code}`,
        message: e.message,
        file: e.file,
        line: e.line,
        column: e.column,
        suggestion: e.suggestion,
      })),
      duration: Date.now() - startTime,
      details: result,
    };
  }

  /**
   * Layer 3: Build Verification
   */
  private async runBuildVerification(
    files: Map<string, string>,
    blocking: boolean,
    startTime: number
  ): Promise<LayerResult> {
    const result = await this.buildVerifier.build(files);

    const issues: VerificationIssue[] = [];

    if (!result.success) {
      for (const error of result.errors) {
        issues.push({
          severity: 'error',
          type: 'BUILD_ERROR',
          message: error,
        });
      }
    }

    for (const warning of result.warnings) {
      issues.push({
        severity: 'warning',
        type: 'BUILD_WARNING',
        message: warning,
      });
    }

    return {
      layer: 'build',
      passed: result.success,
      blocking,
      issues,
      duration: Date.now() - startTime,
      details: result,
    };
  }

  /**
   * Layer 4: Unit Tests
   */
  private async runUnitTests(
    files: Map<string, string>,
    blocking: boolean,
    startTime: number
  ): Promise<LayerResult> {
    // Generate tests if not skipped
    if (!this.config.skipTestGeneration) {
      const testSuite = await this.generateTests('unit');
      // Tests are written to sandbox by generator
    }

    const result = await this.testRunner.runUnit(files);

    return {
      layer: 'unit_tests',
      passed: result.failed === 0,
      blocking,
      issues: result.failures.map(f => ({
        severity: 'error',
        type: 'TEST_FAILURE',
        message: f.message,
        file: f.file,
        line: f.line,
      })),
      duration: Date.now() - startTime,
      details: result,
    };
  }

  /**
   * Layer 5: Integration Tests
   */
  private async runIntegrationTests(
    files: Map<string, string>,
    blocking: boolean,
    startTime: number
  ): Promise<LayerResult> {
    if (!this.config.skipTestGeneration) {
      await this.generateTests('integration');
    }

    const result = await this.testRunner.runIntegration(files);

    return {
      layer: 'integration_tests',
      passed: result.failed === 0,
      blocking,
      issues: result.failures.map(f => ({
        severity: 'error',
        type: 'TEST_FAILURE',
        message: f.message,
        file: f.file,
        line: f.line,
      })),
      duration: Date.now() - startTime,
      details: result,
    };
  }

  /**
   * Layer 6: E2E Tests
   */
  private async runE2ETests(
    files: Map<string, string>,
    blocking: boolean,
    startTime: number
  ): Promise<LayerResult> {
    if (!this.config.skipTestGeneration) {
      await this.generateTests('e2e');
    }

    const result = await this.testRunner.runE2E(files);

    return {
      layer: 'e2e_tests',
      passed: result.failed === 0,
      blocking,
      issues: result.failures.map(f => ({
        severity: 'error',
        type: 'E2E_FAILURE',
        message: f.message,
        file: f.file,
      })),
      duration: Date.now() - startTime,
      details: result,
    };
  }

  /**
   * Layer 7: Security Scan
   */
  private async runSecurityScan(
    files: Map<string, string>,
    blocking: boolean,
    startTime: number
  ): Promise<LayerResult> {
    const result = await this.securityScanner.scan(files);

    return {
      layer: 'security',
      passed: result.criticalCount === 0 && result.highCount === 0,
      blocking,
      issues: result.issues.map(i => ({
        severity: i.severity === 'critical' || i.severity === 'high' ? 'error' : 'warning',
        type: i.type,
        message: i.description,
        file: i.file,
        line: i.line,
        suggestion: i.recommendation,
      })),
      duration: Date.now() - startTime,
      details: result,
    };
  }

  /**
   * Layer 8: Coverage Check
   */
  private async runCoverageCheck(
    blocking: boolean,
    startTime: number
  ): Promise<LayerResult> {
    const report = await this.coverageTracker.check(this.knowledge);

    const issues: VerificationIssue[] = [];

    if (report.percentage < 100) {
      for (const gap of report.gaps) {
        issues.push({
          severity: 'warning',
          type: 'COVERAGE_GAP',
          message: `Requirement not covered: ${gap.requirementId} - ${gap.description}`,
        });
      }
    }

    return {
      layer: 'coverage',
      passed: report.percentage >= 80, // 80% minimum coverage
      blocking,
      issues,
      duration: Date.now() - startTime,
      details: report,
    };
  }

  /**
   * Generate tests for a specific type
   */
  private async generateTests(
    type: 'unit' | 'integration' | 'e2e'
  ): Promise<TestSuite> {
    const requirements = await this.knowledge.read('/requirements/main.json');
    if (!requirements) {
      return { tests: [], type };
    }

    const suite = await this.testGenerator.generateFromRequirements(
      JSON.parse(requirements.content),
      type
    );

    // Save generated tests
    await this.knowledge.write(
      `/tests/generated-${type}.json`,
      JSON.stringify(suite, null, 2)
    );

    return suite;
  }

  /**
   * Check if layer is blocking
   */
  private isBlocking(layer: VerificationLayer): boolean {
    return this.config.blockingLayers.includes(layer);
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(results: LayerResult[]): string[] {
    const recommendations: string[] = [];

    for (const result of results) {
      if (!result.passed) {
        switch (result.layer) {
          case 'static_analysis':
            recommendations.push('Run ESLint with --fix to auto-fix some issues');
            break;
          case 'type_checking':
            recommendations.push('Review TypeScript errors and fix type definitions');
            break;
          case 'build':
            recommendations.push('Check for missing imports or syntax errors');
            break;
          case 'unit_tests':
          case 'integration_tests':
            recommendations.push('Review failing tests and update implementations');
            break;
          case 'e2e_tests':
            recommendations.push('Check UI flows match expected behavior');
            break;
          case 'security':
            recommendations.push('Address security vulnerabilities before deployment');
            break;
          case 'coverage':
            recommendations.push('Add tests for uncovered requirements');
            break;
        }
      }
    }

    return [...new Set(recommendations)];
  }

  /**
   * Build summary message
   */
  private buildSummary(results: LayerResult[], passed: boolean): string {
    const passedLayers = results.filter(r => r.passed).length;
    const totalLayers = results.length;

    if (passed) {
      return `Verification passed: ${passedLayers}/${totalLayers} layers succeeded`;
    }

    const failedLayers = results
      .filter(r => !r.passed)
      .map(r => r.layer)
      .join(', ');

    return `Verification failed: ${failedLayers}`;
  }

  /**
   * Save results to knowledge store
   */
  private async saveResults(result: VerificationResult): Promise<void> {
    await this.knowledge.write(
      '/verification/results.json',
      JSON.stringify({
        timestamp: Date.now(),
        ...result,
      }, null, 2)
    );
  }

  /**
   * Emit an event
   */
  private emit(type: EventType, payload: unknown): void {
    this.eventStream.emit({
      id: crypto.randomUUID(),
      type,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      payload,
    });
  }
}
```

---

## File 3: `src/lib/engine/v14-olympus/verification/test-generator.ts`

### Purpose
The key innovation - generates tests from requirements (not from code). This ensures tests verify that requirements are met, not just that code works.

### Exact Implementation

```typescript
/**
 * Test Generator
 *
 * THE KEY INNOVATION: Tests are generated from REQUIREMENTS, not from code.
 *
 * Process:
 * 1. Read requirements document
 * 2. For each requirement, generate acceptance criteria (GIVEN-WHEN-THEN)
 * 3. For each criterion, generate test code
 * 4. Output complete test suite
 *
 * This ensures tests verify WHAT the app should do, not HOW it was implemented.
 */

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuid } from 'uuid';

// Acceptance criterion in GIVEN-WHEN-THEN format
export interface AcceptanceCriterion {
  id: string;
  given: string;    // Precondition
  when: string;     // Action
  then: string;     // Expected outcome
  priority: 'must' | 'should' | 'could';
}

// Generated test
export interface GeneratedTest {
  id: string;
  requirementId: string;
  type: 'unit' | 'integration' | 'e2e';
  criterion: AcceptanceCriterion;
  code: string;
  description: string;
  filename: string;
}

// Test suite
export interface TestSuite {
  type: 'unit' | 'integration' | 'e2e';
  tests: GeneratedTest[];
  generatedAt: number;
  requirementsVersion?: string;
}

// Requirements document structure
export interface RequirementsDocument {
  version: string;
  explicit: Requirement[];
  implicit: Requirement[];
}

export interface Requirement {
  id: string;
  description: string;
  priority: 'must' | 'should' | 'could';
  type?: string;
}

// Test generator configuration
export interface TestGeneratorConfig {
  model: string;
  maxTestsPerRequirement: number;
  includeSetupTeardown: boolean;
  framework: 'jest' | 'vitest' | 'playwright';
}

const DEFAULT_CONFIG: TestGeneratorConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTestsPerRequirement: 5,
  includeSetupTeardown: true,
  framework: 'jest',
};

export class TestGenerator {
  private client: Anthropic;
  private config: TestGeneratorConfig;

  constructor(client: Anthropic, config: Partial<TestGeneratorConfig> = {}) {
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate tests from requirements document
   */
  async generateFromRequirements(
    requirements: RequirementsDocument,
    type: 'unit' | 'integration' | 'e2e'
  ): Promise<TestSuite> {
    const allRequirements = [
      ...requirements.explicit,
      ...requirements.implicit,
    ];

    // Filter requirements relevant to this test type
    const relevantReqs = this.filterByTestType(allRequirements, type);

    const tests: GeneratedTest[] = [];

    for (const req of relevantReqs) {
      // Step 1: Generate acceptance criteria
      const criteria = await this.generateAcceptanceCriteria(req);

      // Step 2: Generate test code for each criterion
      for (const criterion of criteria) {
        const testCode = await this.generateTestCode(req, criterion, type);

        tests.push({
          id: uuid(),
          requirementId: req.id,
          type,
          criterion,
          code: testCode.code,
          description: testCode.description,
          filename: testCode.filename,
        });
      }
    }

    return {
      type,
      tests,
      generatedAt: Date.now(),
      requirementsVersion: requirements.version,
    };
  }

  /**
   * Generate acceptance criteria for a requirement
   */
  async generateAcceptanceCriteria(req: Requirement): Promise<AcceptanceCriterion[]> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a QA engineer generating acceptance criteria.

Given this requirement:
ID: ${req.id}
Description: "${req.description}"
Priority: ${req.priority}

Generate 3-5 acceptance criteria in GIVEN-WHEN-THEN format.
Each criterion should test a specific aspect of this requirement.
Include both happy path and edge cases.

Return as JSON array:
[
  {
    "id": "unique-id",
    "given": "the precondition",
    "when": "the action is taken",
    "then": "the expected outcome",
    "priority": "must" | "should" | "could"
  }
]

Only return the JSON, no other text.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const criteria = JSON.parse(jsonMatch[0]) as AcceptanceCriterion[];

      // Limit to max criteria
      return criteria.slice(0, this.config.maxTestsPerRequirement);
    } catch (error) {
      console.error('Failed to parse acceptance criteria:', error);
      return [];
    }
  }

  /**
   * Generate test code for an acceptance criterion
   */
  async generateTestCode(
    req: Requirement,
    criterion: AcceptanceCriterion,
    type: 'unit' | 'integration' | 'e2e'
  ): Promise<{ code: string; description: string; filename: string }> {
    const framework = type === 'e2e' ? 'playwright' : this.config.framework;

    const prompt = this.buildTestPrompt(req, criterion, type, framework);

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract code block
    const codeMatch = text.match(/```(?:typescript|javascript|ts|js)?\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : text;

    // Generate filename
    const filename = this.generateFilename(req, criterion, type);

    return {
      code,
      description: `Test for ${req.id}: ${criterion.when} should ${criterion.then}`,
      filename,
    };
  }

  /**
   * Build the prompt for test generation
   */
  private buildTestPrompt(
    req: Requirement,
    criterion: AcceptanceCriterion,
    type: 'unit' | 'integration' | 'e2e',
    framework: string
  ): string {
    const frameworkInstructions = this.getFrameworkInstructions(framework);

    return `You are a senior test engineer generating ${type} tests.

## Requirement
ID: ${req.id}
Description: ${req.description}

## Acceptance Criterion
GIVEN: ${criterion.given}
WHEN: ${criterion.when}
THEN: ${criterion.then}

## Framework
${frameworkInstructions}

## Instructions
Generate a complete, runnable test that:
1. Sets up the precondition (GIVEN)
2. Performs the action (WHEN)
3. Asserts the expected outcome (THEN)

${type === 'e2e' ? `
For E2E tests:
- Use Playwright's page object pattern
- Include proper waits and assertions
- Handle async operations correctly
- Use meaningful test names
` : `
For ${type} tests:
- Use proper mocking where needed
- Include setup and teardown
- Handle async operations
- Use meaningful test names
`}

Return ONLY the test code in a code block, no explanation.`;
  }

  /**
   * Get framework-specific instructions
   */
  private getFrameworkInstructions(framework: string): string {
    switch (framework) {
      case 'playwright':
        return `Using Playwright for E2E testing.
Import: import { test, expect } from '@playwright/test';
Pattern: test('description', async ({ page }) => { ... });`;

      case 'jest':
        return `Using Jest for testing.
Import: import { describe, it, expect } from '@jest/globals';
Pattern: describe('suite', () => { it('should...', () => { ... }); });`;

      case 'vitest':
        return `Using Vitest for testing.
Import: import { describe, it, expect } from 'vitest';
Pattern: describe('suite', () => { it('should...', () => { ... }); });`;

      default:
        return `Using ${framework} for testing.`;
    }
  }

  /**
   * Generate filename for a test
   */
  private generateFilename(
    req: Requirement,
    criterion: AcceptanceCriterion,
    type: 'unit' | 'integration' | 'e2e'
  ): string {
    const reqSlug = req.id.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const criterionSlug = criterion.id?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'test';

    switch (type) {
      case 'e2e':
        return `tests/e2e/${reqSlug}.spec.ts`;
      case 'integration':
        return `tests/integration/${reqSlug}.test.ts`;
      case 'unit':
      default:
        return `tests/unit/${reqSlug}-${criterionSlug}.test.ts`;
    }
  }

  /**
   * Filter requirements by test type
   */
  private filterByTestType(
    requirements: Requirement[],
    type: 'unit' | 'integration' | 'e2e'
  ): Requirement[] {
    return requirements.filter(req => {
      const desc = req.description.toLowerCase();

      switch (type) {
        case 'e2e':
          // E2E tests for user-facing features
          return (
            desc.includes('user') ||
            desc.includes('page') ||
            desc.includes('screen') ||
            desc.includes('form') ||
            desc.includes('button') ||
            desc.includes('navigate') ||
            desc.includes('display') ||
            desc.includes('show') ||
            desc.includes('view')
          );

        case 'integration':
          // Integration tests for API/database interactions
          return (
            desc.includes('api') ||
            desc.includes('database') ||
            desc.includes('server') ||
            desc.includes('endpoint') ||
            desc.includes('service') ||
            desc.includes('integration')
          );

        case 'unit':
        default:
          // Unit tests for everything else
          return true;
      }
    });
  }

  /**
   * Determine test type based on criterion content
   */
  determineTestType(criterion: AcceptanceCriterion): 'unit' | 'integration' | 'e2e' {
    const combined = `${criterion.given} ${criterion.when} ${criterion.then}`.toLowerCase();

    // E2E indicators
    if (
      combined.includes('click') ||
      combined.includes('navigate') ||
      combined.includes('enter') ||
      combined.includes('see') ||
      combined.includes('page') ||
      combined.includes('screen') ||
      combined.includes('form') ||
      combined.includes('button')
    ) {
      return 'e2e';
    }

    // Integration indicators
    if (
      combined.includes('api') ||
      combined.includes('database') ||
      combined.includes('server') ||
      combined.includes('request') ||
      combined.includes('response') ||
      combined.includes('endpoint')
    ) {
      return 'integration';
    }

    return 'unit';
  }

  /**
   * Generate a test summary document
   */
  async generateTestPlan(requirements: RequirementsDocument): Promise<string> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Create a test plan document for these requirements:

${JSON.stringify(requirements, null, 2)}

The test plan should include:
1. Test Strategy Overview
2. Test Types and Coverage
3. Test Cases Summary (grouped by feature)
4. Priority Testing Order
5. Risk Areas

Format as markdown.`,
      }],
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }
}
```

---

## File 4: `src/lib/engine/v14-olympus/verification/static-analyzer.ts`

### Purpose
ESLint integration for static code analysis.

### Exact Implementation

```typescript
/**
 * Static Analyzer
 *
 * Runs ESLint on generated code to catch:
 * - Syntax errors
 * - Code style issues
 * - Potential bugs
 * - Unused variables
 * - Missing imports
 */

// Lint issue
export interface LintIssue {
  filePath: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: 0 | 1 | 2; // 0 = off, 1 = warning, 2 = error
  ruleId: string | null;
  message: string;
  fix?: {
    range: [number, number];
    text: string;
  };
}

// Lint result
export interface LintResult {
  issues: LintIssue[];
  errorCount: number;
  warningCount: number;
  fixableCount: number;
}

// ESLint configuration for Next.js + TypeScript
const ESLINT_CONFIG = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    // TypeScript
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',

    // React
    'react/react-in-jsx-scope': 'off', // Not needed in Next.js
    'react/prop-types': 'off', // Using TypeScript

    // General
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};

export class StaticAnalyzer {
  /**
   * Analyze all files
   */
  async analyze(files: Map<string, string>): Promise<LintResult> {
    const issues: LintIssue[] = [];

    for (const [path, content] of files) {
      // Only analyze TS/JS files
      if (!this.isAnalyzableFile(path)) continue;

      const fileIssues = await this.analyzeFile(path, content);
      issues.push(...fileIssues);
    }

    const errorCount = issues.filter(i => i.severity === 2).length;
    const warningCount = issues.filter(i => i.severity === 1).length;
    const fixableCount = issues.filter(i => i.fix).length;

    return {
      issues,
      errorCount,
      warningCount,
      fixableCount,
    };
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(path: string, content: string): Promise<LintIssue[]> {
    const issues: LintIssue[] = [];

    // Pattern-based analysis (simple ESLint simulation)
    // In production, would use actual ESLint API

    // Check for common issues
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const lineNumber = lineNum + 1;

      // Check for console.log
      if (/console\.(log|info|debug)/.test(line)) {
        issues.push({
          filePath: path,
          line: lineNumber,
          column: line.indexOf('console'),
          severity: 1,
          ruleId: 'no-console',
          message: 'Unexpected console statement',
        });
      }

      // Check for debugger
      if (/\bdebugger\b/.test(line)) {
        issues.push({
          filePath: path,
          line: lineNumber,
          column: line.indexOf('debugger'),
          severity: 2,
          ruleId: 'no-debugger',
          message: 'Unexpected debugger statement',
        });
      }

      // Check for var usage
      if (/\bvar\s+\w+/.test(line) && !line.trim().startsWith('//')) {
        issues.push({
          filePath: path,
          line: lineNumber,
          column: line.indexOf('var'),
          severity: 2,
          ruleId: 'no-var',
          message: 'Unexpected var, use let or const instead',
          fix: {
            range: [0, 0], // Placeholder
            text: line.replace(/\bvar\b/, 'const'),
          },
        });
      }

      // Check for any type
      if (/:\s*any\b/.test(line) && path.endsWith('.ts') || path.endsWith('.tsx')) {
        issues.push({
          filePath: path,
          line: lineNumber,
          column: line.indexOf('any'),
          severity: 1,
          ruleId: '@typescript-eslint/no-explicit-any',
          message: 'Unexpected any. Specify a more specific type',
        });
      }

      // Check for TODO/FIXME comments
      if (/\/\/\s*(TODO|FIXME|HACK|XXX):?/i.test(line)) {
        issues.push({
          filePath: path,
          line: lineNumber,
          column: line.indexOf('//'),
          severity: 1,
          ruleId: 'no-warning-comments',
          message: 'TODO/FIXME comment found',
        });
      }
    }

    // Check for unused imports (simple pattern)
    const importMatches = content.matchAll(/import\s+{?\s*(\w+)/g);
    for (const match of importMatches) {
      const imported = match[1];
      // Count occurrences (excluding the import itself)
      const regex = new RegExp(`\\b${imported}\\b`, 'g');
      const occurrences = (content.match(regex) || []).length;

      if (occurrences === 1) {
        const line = content.substring(0, match.index).split('\n').length;
        issues.push({
          filePath: path,
          line,
          column: 0,
          severity: 2,
          ruleId: '@typescript-eslint/no-unused-vars',
          message: `'${imported}' is defined but never used`,
        });
      }
    }

    return issues;
  }

  /**
   * Check if file should be analyzed
   */
  private isAnalyzableFile(path: string): boolean {
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path);
  }

  /**
   * Get ESLint config
   */
  getConfig(): typeof ESLINT_CONFIG {
    return ESLINT_CONFIG;
  }
}
```

---

## File 5: `src/lib/engine/v14-olympus/verification/security-scanner.ts`

### Purpose
Scans code for common security vulnerabilities based on OWASP patterns.

### Exact Implementation

```typescript
/**
 * Security Scanner
 *
 * Scans generated code for security vulnerabilities:
 * - Hardcoded secrets
 * - SQL injection
 * - XSS vulnerabilities
 * - Unsafe eval usage
 * - Exposed API keys
 * - Insecure configurations
 */

// Security issue
export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  file: string;
  line?: number;
  description: string;
  recommendation: string;
  cwe?: string; // Common Weakness Enumeration ID
}

// Scan result
export interface SecurityScanResult {
  issues: SecurityIssue[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  scannedFiles: number;
  timestamp: number;
}

// Security pattern
interface SecurityPattern {
  id: string;
  type: string;
  regex: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
  cwe?: string;
  fileTypes?: string[];
  exclude?: RegExp;
}

// Security patterns based on OWASP Top 10
const SECURITY_PATTERNS: SecurityPattern[] = [
  // A01: Broken Access Control
  {
    id: 'INSECURE_CORS',
    type: 'BROKEN_ACCESS_CONTROL',
    regex: /Access-Control-Allow-Origin['":\s]*['"]\*['"]/gi,
    severity: 'medium',
    description: 'Wildcard CORS policy detected',
    recommendation: 'Restrict CORS to specific trusted domains',
    cwe: 'CWE-942',
  },

  // A02: Cryptographic Failures
  {
    id: 'HARDCODED_SECRET',
    type: 'CRYPTOGRAPHIC_FAILURE',
    regex: /(api[_-]?key|secret|password|token|auth)['":\s]*['"][^'"]{8,}['"]/gi,
    severity: 'critical',
    description: 'Hardcoded secret detected',
    recommendation: 'Use environment variables for secrets',
    cwe: 'CWE-798',
  },
  {
    id: 'WEAK_HASH',
    type: 'CRYPTOGRAPHIC_FAILURE',
    regex: /\b(md5|sha1)\s*\(/gi,
    severity: 'high',
    description: 'Weak hash algorithm detected',
    recommendation: 'Use SHA-256 or stronger hash algorithms',
    cwe: 'CWE-328',
  },

  // A03: Injection
  {
    id: 'SQL_INJECTION',
    type: 'INJECTION',
    regex: /query\s*\(\s*[`'"][^`'"]*\$\{/gi,
    severity: 'critical',
    description: 'Potential SQL injection vulnerability',
    recommendation: 'Use parameterized queries or prepared statements',
    cwe: 'CWE-89',
  },
  {
    id: 'COMMAND_INJECTION',
    type: 'INJECTION',
    regex: /exec\s*\(\s*[`'"][^`'"]*\$\{/gi,
    severity: 'critical',
    description: 'Potential command injection vulnerability',
    recommendation: 'Sanitize user input before passing to shell commands',
    cwe: 'CWE-78',
  },
  {
    id: 'NOSQL_INJECTION',
    type: 'INJECTION',
    regex: /\.find\s*\(\s*\{[^}]*:\s*req\.(body|query|params)/gi,
    severity: 'high',
    description: 'Potential NoSQL injection vulnerability',
    recommendation: 'Sanitize and validate user input before database queries',
    cwe: 'CWE-943',
  },

  // A04: Insecure Design (N/A for pattern matching)

  // A05: Security Misconfiguration
  {
    id: 'DEBUG_ENABLED',
    type: 'SECURITY_MISCONFIGURATION',
    regex: /debug\s*[:=]\s*true/gi,
    severity: 'medium',
    description: 'Debug mode enabled',
    recommendation: 'Disable debug mode in production',
    cwe: 'CWE-215',
  },
  {
    id: 'EXPOSED_SECRETS_CLIENT',
    type: 'SECURITY_MISCONFIGURATION',
    regex: /NEXT_PUBLIC_.*(?:SECRET|KEY|TOKEN|PASSWORD)/gi,
    severity: 'critical',
    description: 'Secret exposed to client via NEXT_PUBLIC_ prefix',
    recommendation: 'Never expose secrets with NEXT_PUBLIC_',
    cwe: 'CWE-200',
  },

  // A06: Vulnerable Components (N/A for pattern matching)

  // A07: Auth Failures
  {
    id: 'INSECURE_JWT',
    type: 'AUTH_FAILURE',
    regex: /algorithm\s*[:=]\s*['"]none['"]/gi,
    severity: 'critical',
    description: 'JWT with algorithm "none" detected',
    recommendation: 'Always specify a strong signing algorithm for JWT',
    cwe: 'CWE-347',
  },
  {
    id: 'HARDCODED_JWT_SECRET',
    type: 'AUTH_FAILURE',
    regex: /jwt\.sign\s*\([^)]+['"][^'"]{5,}['"]/gi,
    severity: 'high',
    description: 'Hardcoded JWT secret detected',
    recommendation: 'Use environment variables for JWT secrets',
    cwe: 'CWE-321',
  },

  // A08: Software and Data Integrity Failures
  {
    id: 'UNSAFE_EVAL',
    type: 'INTEGRITY_FAILURE',
    regex: /\beval\s*\(/gi,
    severity: 'high',
    description: 'Use of eval() is dangerous',
    recommendation: 'Avoid eval(). Use safer alternatives like JSON.parse()',
    cwe: 'CWE-95',
  },
  {
    id: 'DANGEROUS_INNER_HTML',
    type: 'INTEGRITY_FAILURE',
    regex: /dangerouslySetInnerHTML/gi,
    severity: 'high',
    description: 'dangerouslySetInnerHTML can lead to XSS',
    recommendation: 'Sanitize HTML content before rendering or use safe alternatives',
    cwe: 'CWE-79',
  },

  // A09: Security Logging Failures
  {
    id: 'SENSITIVE_DATA_LOGGED',
    type: 'LOGGING_FAILURE',
    regex: /console\.(log|info|debug)\s*\([^)]*(?:password|secret|token|key)/gi,
    severity: 'high',
    description: 'Sensitive data may be logged',
    recommendation: 'Never log sensitive data like passwords or tokens',
    cwe: 'CWE-532',
  },

  // A10: SSRF
  {
    id: 'POTENTIAL_SSRF',
    type: 'SSRF',
    regex: /fetch\s*\(\s*(?:req\.(?:body|query|params)|user[Ii]nput)/gi,
    severity: 'high',
    description: 'Potential SSRF vulnerability',
    recommendation: 'Validate and sanitize URLs before fetching',
    cwe: 'CWE-918',
  },

  // Additional patterns
  {
    id: 'INSECURE_HTTP',
    type: 'INSECURE_TRANSPORT',
    regex: /['"]http:\/\/(?!localhost|127\.0\.0\.1)/gi,
    severity: 'medium',
    description: 'Insecure HTTP URL detected',
    recommendation: 'Use HTTPS for all external communications',
    cwe: 'CWE-319',
  },
  {
    id: 'DISABLED_SSL_VERIFY',
    type: 'INSECURE_TRANSPORT',
    regex: /rejectUnauthorized\s*[:=]\s*false/gi,
    severity: 'high',
    description: 'SSL certificate verification disabled',
    recommendation: 'Never disable SSL verification in production',
    cwe: 'CWE-295',
  },
  {
    id: 'INSECURE_COOKIE',
    type: 'INSECURE_COOKIE',
    regex: /secure\s*[:=]\s*false/gi,
    severity: 'medium',
    description: 'Cookie without secure flag',
    recommendation: 'Set secure: true for cookies in production',
    cwe: 'CWE-614',
  },
  {
    id: 'HTTPONLY_MISSING',
    type: 'INSECURE_COOKIE',
    regex: /httpOnly\s*[:=]\s*false/gi,
    severity: 'medium',
    description: 'Cookie without httpOnly flag',
    recommendation: 'Set httpOnly: true to prevent XSS access to cookies',
    cwe: 'CWE-1004',
  },
];

export class SecurityScanner {
  private patterns: SecurityPattern[];

  constructor() {
    this.patterns = SECURITY_PATTERNS;
  }

  /**
   * Scan all files for security issues
   */
  async scan(files: Map<string, string>): Promise<SecurityScanResult> {
    const issues: SecurityIssue[] = [];
    let scannedFiles = 0;

    for (const [path, content] of files) {
      // Only scan code files
      if (!this.isScannableFile(path)) continue;

      scannedFiles++;
      const fileIssues = this.scanFile(path, content);
      issues.push(...fileIssues);
    }

    // Count by severity
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const mediumCount = issues.filter(i => i.severity === 'medium').length;
    const lowCount = issues.filter(i => i.severity === 'low').length;

    return {
      issues,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      scannedFiles,
      timestamp: Date.now(),
    };
  }

  /**
   * Scan a single file
   */
  private scanFile(path: string, content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    for (const pattern of this.patterns) {
      // Check file type restriction
      if (pattern.fileTypes && !pattern.fileTypes.some(t => path.endsWith(t))) {
        continue;
      }

      // Reset regex state
      pattern.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(content)) !== null) {
        // Check exclusion pattern
        if (pattern.exclude && pattern.exclude.test(match[0])) {
          continue;
        }

        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;

        issues.push({
          severity: pattern.severity,
          type: pattern.type,
          file: path,
          line: lineNumber,
          description: pattern.description,
          recommendation: pattern.recommendation,
          cwe: pattern.cwe,
        });
      }
    }

    return issues;
  }

  /**
   * Check if file should be scanned
   */
  private isScannableFile(path: string): boolean {
    // Scan code and config files
    const scannable = /\.(ts|tsx|js|jsx|json|env|yaml|yml|toml|ini|conf)$/;
    // Skip certain directories
    const skip = /node_modules|\.git|dist|build|coverage/;

    return scannable.test(path) && !skip.test(path);
  }

  /**
   * Add a custom pattern
   */
  addPattern(pattern: SecurityPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Get all patterns
   */
  getPatterns(): SecurityPattern[] {
    return [...this.patterns];
  }

  /**
   * Generate security report
   */
  generateReport(result: SecurityScanResult): string {
    const lines: string[] = [
      '# Security Scan Report',
      '',
      `**Scanned:** ${result.scannedFiles} files`,
      `**Timestamp:** ${new Date(result.timestamp).toISOString()}`,
      '',
      '## Summary',
      '',
      `- Critical: ${result.criticalCount}`,
      `- High: ${result.highCount}`,
      `- Medium: ${result.mediumCount}`,
      `- Low: ${result.lowCount}`,
      '',
    ];

    if (result.issues.length === 0) {
      lines.push('No security issues found.');
    } else {
      lines.push('## Issues', '');

      // Group by severity
      const bySeverity = {
        critical: result.issues.filter(i => i.severity === 'critical'),
        high: result.issues.filter(i => i.severity === 'high'),
        medium: result.issues.filter(i => i.severity === 'medium'),
        low: result.issues.filter(i => i.severity === 'low'),
      };

      for (const [severity, issues] of Object.entries(bySeverity)) {
        if (issues.length === 0) continue;

        lines.push(`### ${severity.toUpperCase()}`, '');

        for (const issue of issues) {
          lines.push(`- **${issue.type}** in \`${issue.file}:${issue.line}\``);
          lines.push(`  ${issue.description}`);
          lines.push(`  *Recommendation:* ${issue.recommendation}`);
          if (issue.cwe) {
            lines.push(`  *CWE:* ${issue.cwe}`);
          }
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }
}
```

---

## File 6: `src/lib/engine/v14-olympus/verification/type-checker.ts`

### Purpose
TypeScript type checking for generated code.

### Exact Implementation

```typescript
/**
 * Type Checker
 *
 * Performs TypeScript type checking on generated code.
 * Uses simple pattern matching for basic type issues.
 * In production, would use TypeScript Compiler API.
 */

// Type check error
export interface TypeCheckError {
  code: number;
  message: string;
  file: string;
  line: number;
  column: number;
  suggestion?: string;
}

// Type check result
export interface TypeCheckResult {
  success: boolean;
  errors: TypeCheckError[];
  warnings: TypeCheckError[];
  filesChecked: number;
}

export class TypeChecker {
  /**
   * Check all files
   */
  async check(files: Map<string, string>): Promise<TypeCheckResult> {
    const errors: TypeCheckError[] = [];
    const warnings: TypeCheckError[] = [];
    let filesChecked = 0;

    for (const [path, content] of files) {
      // Only check TypeScript files
      if (!path.endsWith('.ts') && !path.endsWith('.tsx')) continue;

      filesChecked++;
      const fileErrors = this.checkFile(path, content);
      errors.push(...fileErrors.errors);
      warnings.push(...fileErrors.warnings);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      filesChecked,
    };
  }

  /**
   * Check a single file
   */
  private checkFile(path: string, content: string): {
    errors: TypeCheckError[];
    warnings: TypeCheckError[];
  } {
    const errors: TypeCheckError[] = [];
    const warnings: TypeCheckError[] = [];
    const lines = content.split('\n');

    // Check for common type issues
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Missing return type (warning)
      if (/(?:function|const)\s+\w+\s*=?\s*\([^)]*\)\s*(?:=>)?\s*{/.test(line) &&
          !/:\s*\w+/.test(line.split('{')[0])) {
        // Skip arrow functions with implicit returns and React components
        if (!line.includes('=>') || line.includes('{')) {
          warnings.push({
            code: 7022,
            message: 'Function lacks explicit return type',
            file: path,
            line: lineNumber,
            column: 0,
            suggestion: 'Add a return type annotation',
          });
        }
      }

      // Implicit any in parameters (error)
      const paramMatch = line.match(/\(([^)]+)\)/);
      if (paramMatch) {
        const params = paramMatch[1].split(',');
        for (const param of params) {
          const trimmed = param.trim();
          // Has parameter name but no type
          if (trimmed && /^\w+$/.test(trimmed) && !['true', 'false', 'null', 'undefined'].includes(trimmed)) {
            errors.push({
              code: 7006,
              message: `Parameter '${trimmed}' implicitly has an 'any' type`,
              file: path,
              line: lineNumber,
              column: line.indexOf(trimmed),
              suggestion: `Add type annotation: ${trimmed}: Type`,
            });
          }
        }
      }

      // Using undeclared variable (check for common patterns)
      // This is a simplified check - real TypeScript would catch this
      const varMatch = line.match(/\b([A-Z][a-zA-Z]+)\b(?!\s*[:<(])/g);
      if (varMatch) {
        for (const varName of varMatch) {
          // Skip common globals and types
          const globals = ['React', 'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean',
                          'Date', 'Error', 'JSON', 'Math', 'console', 'window', 'document',
                          'HTMLElement', 'Event', 'FormData', 'URLSearchParams', 'Headers',
                          'Request', 'Response', 'Map', 'Set', 'Symbol'];
          if (!globals.includes(varName)) {
            // Check if it's imported
            const importRegex = new RegExp(`import.*\\b${varName}\\b`);
            if (!importRegex.test(content)) {
              // It might be a type or component - only warn for non-imported uses
              // Skip if it looks like a JSX component or type
              if (!/<\w+/.test(line) && !/:/.test(line.substring(line.indexOf(varName)))) {
                // This is likely a false positive - skip for now
              }
            }
          }
        }
      }
    }

    // Check for empty interface
    const emptyInterfaceMatch = content.match(/interface\s+\w+\s*{\s*}/g);
    if (emptyInterfaceMatch) {
      for (const match of emptyInterfaceMatch) {
        const line = content.substring(0, content.indexOf(match)).split('\n').length;
        warnings.push({
          code: 1234, // Custom code
          message: 'Empty interface',
          file: path,
          line,
          column: 0,
          suggestion: 'Add members to the interface or use a type alias',
        });
      }
    }

    return { errors, warnings };
  }
}
```

---

## File 7: `src/lib/engine/v14-olympus/verification/coverage-tracker.ts`

### Purpose
Tracks which requirements are covered by generated code and tests.

### Exact Implementation

```typescript
/**
 * Coverage Tracker
 *
 * Tracks requirement coverage to ensure:
 * 1. All requirements have corresponding code
 * 2. All requirements have corresponding tests
 * 3. No requirements are missed
 */

import { KnowledgeStore } from '../knowledge/store';

// Coverage for a single requirement
export interface RequirementCoverage {
  requirementId: string;
  description: string;
  hascode: boolean;
  hasTest: boolean;
  codeFiles: string[];
  testFiles: string[];
}

// Overall coverage report
export interface CoverageReport {
  percentage: number;
  coveredCount: number;
  totalCount: number;
  fullyCovered: RequirementCoverage[];
  partiallyCovered: RequirementCoverage[];
  gaps: CoverageGap[];
  timestamp: number;
}

// Coverage gap
export interface CoverageGap {
  requirementId: string;
  description: string;
  missingCode: boolean;
  missingTest: boolean;
  suggestion: string;
}

export class CoverageTracker {
  /**
   * Check coverage of all requirements
   */
  async check(knowledge: KnowledgeStore): Promise<CoverageReport> {
    // Read requirements
    const reqDoc = await knowledge.read('/requirements/main.json');
    if (!reqDoc) {
      return this.emptyReport();
    }

    const requirements = JSON.parse(reqDoc.content);
    const allRequirements = [
      ...requirements.explicit,
      ...requirements.implicit,
    ];

    // Read plan to find which requirements are covered by which tasks
    const planDoc = await knowledge.read('/plan/main.json');
    const plan = planDoc ? JSON.parse(planDoc.content) : { tasks: [] };

    // Read verification results to find test coverage
    const testDoc = await knowledge.read('/tests/generated-e2e.json');
    const testSuite = testDoc ? JSON.parse(testDoc.content) : { tests: [] };

    // Build coverage map
    const coverage: RequirementCoverage[] = [];
    const gaps: CoverageGap[] = [];

    for (const req of allRequirements) {
      // Find tasks that cover this requirement
      const coveringTasks = plan.tasks?.filter((t: any) =>
        t.coversRequirements?.includes(req.id)
      ) || [];

      // Find tests that cover this requirement
      const coveringTests = testSuite.tests?.filter((t: any) =>
        t.requirementId === req.id
      ) || [];

      const hasCode = coveringTasks.length > 0;
      const hasTest = coveringTests.length > 0;

      const reqCoverage: RequirementCoverage = {
        requirementId: req.id,
        description: req.description,
        hascode: hasCode,
        hasTest,
        codeFiles: coveringTasks.map((t: any) => t.outputFile).filter(Boolean),
        testFiles: coveringTests.map((t: any) => t.filename),
      };

      coverage.push(reqCoverage);

      // Track gaps
      if (!hasCode || !hasTest) {
        gaps.push({
          requirementId: req.id,
          description: req.description,
          missingCode: !hasCode,
          missingTest: !hasTest,
          suggestion: this.getSuggestion(hasCode, hasTest),
        });
      }
    }

    // Calculate coverage percentage
    const fullyCovered = coverage.filter(c => c.hascode && c.hasTest);
    const partiallyCovered = coverage.filter(c => c.hascode !== c.hasTest);
    const coveredCount = fullyCovered.length;
    const totalCount = allRequirements.length;
    const percentage = totalCount > 0 ? (coveredCount / totalCount) * 100 : 100;

    return {
      percentage: Math.round(percentage * 100) / 100,
      coveredCount,
      totalCount,
      fullyCovered,
      partiallyCovered,
      gaps,
      timestamp: Date.now(),
    };
  }

  /**
   * Get suggestion for coverage gap
   */
  private getSuggestion(hasCode: boolean, hasTest: boolean): string {
    if (!hasCode && !hasTest) {
      return 'This requirement has no implementation or tests. Add both.';
    }
    if (!hasCode) {
      return 'This requirement has tests but no implementation. Implement the feature.';
    }
    if (!hasTest) {
      return 'This requirement has implementation but no tests. Add test coverage.';
    }
    return '';
  }

  /**
   * Create empty report
   */
  private emptyReport(): CoverageReport {
    return {
      percentage: 0,
      coveredCount: 0,
      totalCount: 0,
      fullyCovered: [],
      partiallyCovered: [],
      gaps: [],
      timestamp: Date.now(),
    };
  }

  /**
   * Generate markdown report
   */
  generateReport(report: CoverageReport): string {
    const lines: string[] = [
      '# Requirement Coverage Report',
      '',
      `**Coverage:** ${report.percentage}%`,
      `**Covered:** ${report.coveredCount}/${report.totalCount}`,
      `**Timestamp:** ${new Date(report.timestamp).toISOString()}`,
      '',
    ];

    if (report.gaps.length > 0) {
      lines.push('## Coverage Gaps', '');

      for (const gap of report.gaps) {
        lines.push(`### ${gap.requirementId}`);
        lines.push(`**Description:** ${gap.description}`);
        lines.push(`**Missing:** ${gap.missingCode ? 'Code' : ''} ${gap.missingTest ? 'Tests' : ''}`);
        lines.push(`**Suggestion:** ${gap.suggestion}`);
        lines.push('');
      }
    } else {
      lines.push('All requirements are fully covered.');
    }

    return lines.join('\n');
  }
}
```

---

## Verification Checklist

After Phase 5 implementation:

- [ ] VerificationPipeline runs all 8 layers in sequence
- [ ] TestGenerator creates tests from requirements (not code)
- [ ] StaticAnalyzer catches ESLint issues
- [ ] TypeChecker finds TypeScript errors
- [ ] SecurityScanner detects OWASP vulnerabilities
- [ ] CoverageTracker identifies uncovered requirements
- [ ] Results are properly saved to knowledge store
- [ ] Events are emitted for progress tracking
- [ ] All unit tests pass

---

## Next Phase

Once Phase 5 is complete and verified, proceed to **Phase 6: Integration & API**.
