# V14 OLYMPUS - Phase 8: Testing Strategy

## Overview

Phase 8 defines the comprehensive testing strategy for V14 OLYMPUS. This includes unit tests, integration tests, end-to-end tests, and test infrastructure for continuous validation.

**Test Files to Create:** 40+
**Estimated Complexity:** High
**Dependencies:** All previous phases

---

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Testing Pyramid                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                           ┌─────────┐                               │
│                           │  E2E    │  ← Few, slow, high confidence │
│                          ┌┴─────────┴┐                              │
│                          │Integration │  ← Medium coverage          │
│                         ┌┴───────────┴┐                             │
│                         │  Unit Tests  │ ← Many, fast, specific     │
│                        └───────────────┘                            │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                         Test Categories                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Unit Tests (~60%)        Integration Tests (~30%)    E2E Tests (~10%)
│  ├── Core modules         ├── Agent coordination     ├── Full generation
│  ├── Individual agents    ├── Knowledge + Agents     ├── UI flows
│  ├── Tools                ├── Recovery + Agents      ├── Error scenarios
│  ├── Knowledge store      ├── API endpoints          └── Edge cases
│  ├── Recovery strategies  └── SSE streaming                         │
│  └── Verification layers                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Test File Structure

```
src/lib/engine/v14-olympus/__tests__/
├── unit/
│   ├── core/
│   │   ├── event-stream.test.ts
│   │   ├── budget-tracker.test.ts
│   │   ├── state-machine.test.ts
│   │   └── checkpoint-manager.test.ts
│   ├── agents/
│   │   ├── base-agent.test.ts
│   │   ├── hermes.test.ts
│   │   ├── athena.test.ts
│   │   ├── hephaestus.test.ts
│   │   ├── apollo.test.ts
│   │   └── artemis.test.ts
│   ├── knowledge/
│   │   ├── store.test.ts
│   │   ├── indexer.test.ts
│   │   └── schema.test.ts
│   ├── recovery/
│   │   ├── stuck-detector.test.ts
│   │   ├── strategy-selector.test.ts
│   │   └── strategies/
│   │       ├── retry-with-context.test.ts
│   │       ├── simplify-approach.test.ts
│   │       ├── alternative-solution.test.ts
│   │       ├── decompose-task.test.ts
│   │       ├── skip-and-stub.test.ts
│   │       ├── rollback.test.ts
│   │       └── human-escalation.test.ts
│   ├── verification/
│   │   ├── static-analyzer.test.ts
│   │   ├── type-checker.test.ts
│   │   ├── test-generator.test.ts
│   │   ├── security-scanner.test.ts
│   │   └── coverage-tracker.test.ts
│   ├── tools/
│   │   ├── executor.test.ts
│   │   ├── file-tools.test.ts
│   │   ├── command-tools.test.ts
│   │   └── web-tools.test.ts
│   └── sandbox/
│       └── memory-sandbox.test.ts
├── integration/
│   ├── agent-coordination.test.ts
│   ├── knowledge-flow.test.ts
│   ├── recovery-flow.test.ts
│   ├── verification-pipeline.test.ts
│   └── api-endpoints.test.ts
├── e2e/
│   ├── simple-app-generation.test.ts
│   ├── complex-app-generation.test.ts
│   ├── user-interaction.test.ts
│   ├── error-recovery.test.ts
│   └── ui-flows.test.ts
├── fixtures/
│   ├── prompts/
│   │   ├── simple-todo.json
│   │   ├── e-commerce.json
│   │   └── dashboard.json
│   ├── requirements/
│   │   ├── sample-requirements.json
│   │   └── complex-requirements.json
│   └── responses/
│       ├── claude-responses.json
│       └── user-responses.json
├── mocks/
│   ├── anthropic-client.ts
│   ├── knowledge-store.ts
│   ├── sandbox.ts
│   └── event-stream.ts
└── utils/
    ├── test-helpers.ts
    ├── test-factories.ts
    └── assertions.ts
```

---

## Test Configuration

### `jest.config.ts`

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    'src/lib/engine/v14-olympus/**/*.ts',
    '!src/lib/engine/v14-olympus/**/*.d.ts',
    '!src/lib/engine/v14-olympus/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testTimeout: 30000,
  maxWorkers: '50%',
};

export default config;
```

### `jest.setup.ts`

```typescript
import { TextEncoder, TextDecoder } from 'util';

// Polyfills
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;
global.crypto = {
  randomUUID: () => Math.random().toString(36).substring(2),
} as Crypto;

// Global test timeout
jest.setTimeout(30000);

// Mock console in tests (optional)
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});
```

---

## Unit Tests

### File 1: `__tests__/unit/core/event-stream.test.ts`

```typescript
/**
 * EventStream Unit Tests
 */

import { EventStream } from '../../../core/event-stream';
import { EventType } from '../../../types/events';

describe('EventStream', () => {
  let eventStream: EventStream;

  beforeEach(() => {
    eventStream = new EventStream();
  });

  describe('emit', () => {
    it('should emit events to subscribers', () => {
      const handler = jest.fn();
      eventStream.on(EventType.GENERATION_STARTED, handler);

      const event = {
        id: 'test-1',
        type: EventType.GENERATION_STARTED,
        timestamp: Date.now(),
        sessionId: 'session-1',
        payload: { projectId: 'proj-1' },
      };

      eventStream.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should support multiple subscribers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventStream.on(EventType.PHASE_STARTED, handler1);
      eventStream.on(EventType.PHASE_STARTED, handler2);

      const event = {
        id: 'test-2',
        type: EventType.PHASE_STARTED,
        timestamp: Date.now(),
        sessionId: 'session-1',
        payload: { phase: 'intake' },
      };

      eventStream.emit(event);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should only emit to matching event type handlers', () => {
      const phaseHandler = jest.fn();
      const agentHandler = jest.fn();

      eventStream.on(EventType.PHASE_STARTED, phaseHandler);
      eventStream.on(EventType.AGENT_STARTED, agentHandler);

      eventStream.emit({
        id: 'test-3',
        type: EventType.PHASE_STARTED,
        timestamp: Date.now(),
        sessionId: 'session-1',
        payload: {},
      });

      expect(phaseHandler).toHaveBeenCalled();
      expect(agentHandler).not.toHaveBeenCalled();
    });
  });

  describe('onAny', () => {
    it('should receive all events', () => {
      const handler = jest.fn();
      eventStream.onAny(handler);

      eventStream.emit({
        id: 'test-4',
        type: EventType.PHASE_STARTED,
        timestamp: Date.now(),
        sessionId: 'session-1',
        payload: {},
      });

      eventStream.emit({
        id: 'test-5',
        type: EventType.AGENT_STARTED,
        timestamp: Date.now(),
        sessionId: 'session-1',
        payload: {},
      });

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribe', () => {
    it('should stop receiving events after unsubscribe', () => {
      const handler = jest.fn();
      const unsubscribe = eventStream.on(EventType.FILE_CREATED, handler);

      eventStream.emit({
        id: 'test-6',
        type: EventType.FILE_CREATED,
        timestamp: Date.now(),
        sessionId: 'session-1',
        payload: { path: 'test.ts' },
      });

      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      eventStream.emit({
        id: 'test-7',
        type: EventType.FILE_CREATED,
        timestamp: Date.now(),
        sessionId: 'session-1',
        payload: { path: 'test2.ts' },
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('getHistory', () => {
    it('should keep event history', () => {
      for (let i = 0; i < 10; i++) {
        eventStream.emit({
          id: `test-${i}`,
          type: EventType.AGENT_PROGRESS,
          timestamp: Date.now(),
          sessionId: 'session-1',
          payload: { progress: i * 10 },
        });
      }

      const history = eventStream.getHistory();
      expect(history).toHaveLength(10);
    });

    it('should limit history size', () => {
      for (let i = 0; i < 1500; i++) {
        eventStream.emit({
          id: `test-${i}`,
          type: EventType.AGENT_PROGRESS,
          timestamp: Date.now(),
          sessionId: 'session-1',
          payload: {},
        });
      }

      const history = eventStream.getHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });
});
```

---

### File 2: `__tests__/unit/recovery/stuck-detector.test.ts`

```typescript
/**
 * StuckDetector Unit Tests
 */

import { StuckDetector, StuckDetectorConfig } from '../../../recovery/stuck-detector';
import { AgentHistory, Iteration, Attempt } from '../../../types';

describe('StuckDetector', () => {
  let detector: StuckDetector;

  beforeEach(() => {
    detector = new StuckDetector();
  });

  describe('hasRepeatedErrors', () => {
    it('should return false when no errors', () => {
      expect(detector.hasRepeatedErrors([])).toBe(false);
    });

    it('should return false when errors are unique', () => {
      const errors = [
        'Error 1',
        'Error 2',
        'Error 3',
      ];
      expect(detector.hasRepeatedErrors(errors)).toBe(false);
    });

    it('should return true when same error appears 3+ times', () => {
      const errors = [
        'Type error in file.ts',
        'Type error in file.ts',
        'Type error in file.ts',
      ];
      expect(detector.hasRepeatedErrors(errors)).toBe(true);
    });

    it('should normalize errors before comparison', () => {
      const errors = [
        'Error at line 10, column 5',
        'Error at line 20, column 10',
        'Error at line 30, column 15',
      ];
      // These should be normalized to the same error
      expect(detector.hasRepeatedErrors(errors)).toBe(true);
    });
  });

  describe('hasNoProgress', () => {
    it('should return false when recent progress exists', () => {
      const iterations: Iteration[] = [
        { filesCreated: 0, filesModified: 0, testsRan: 0, buildSucceeded: false, significantOutput: false },
        { filesCreated: 1, filesModified: 0, testsRan: 0, buildSucceeded: false, significantOutput: false },
        { filesCreated: 0, filesModified: 0, testsRan: 0, buildSucceeded: false, significantOutput: false },
      ];
      expect(detector.hasNoProgress(iterations)).toBe(false);
    });

    it('should return true when no progress in last 5 iterations', () => {
      const iterations: Iteration[] = Array(6).fill({
        filesCreated: 0,
        filesModified: 0,
        testsRan: 0,
        buildSucceeded: false,
        significantOutput: false,
      });
      expect(detector.hasNoProgress(iterations)).toBe(true);
    });

    it('should count build success as progress', () => {
      const iterations: Iteration[] = [
        { filesCreated: 0, filesModified: 0, testsRan: 0, buildSucceeded: true, significantOutput: false },
        ...Array(4).fill({
          filesCreated: 0,
          filesModified: 0,
          testsRan: 0,
          buildSucceeded: false,
          significantOutput: false,
        }),
      ];
      expect(detector.hasNoProgress(iterations)).toBe(false);
    });
  });

  describe('isCircular', () => {
    it('should return false with few attempts', () => {
      const attempts: Attempt[] = [
        { toolsUsed: ['write_file'], filesTargeted: ['a.ts'], approachCategory: 'generate' },
      ];
      expect(detector.isCircular(attempts)).toBe(false);
    });

    it('should return true when same approach used 50%+ of time', () => {
      const attempts: Attempt[] = Array(8).fill({
        toolsUsed: ['write_file'],
        filesTargeted: ['component.tsx'],
        approachCategory: 'generate',
      });
      expect(detector.isCircular(attempts)).toBe(true);
    });

    it('should return false with diverse approaches', () => {
      const attempts: Attempt[] = [
        { toolsUsed: ['write_file'], filesTargeted: ['a.ts'], approachCategory: 'generate' },
        { toolsUsed: ['run_build'], filesTargeted: [], approachCategory: 'build' },
        { toolsUsed: ['read_file'], filesTargeted: ['b.ts'], approachCategory: 'analyze' },
        { toolsUsed: ['web_search'], filesTargeted: [], approachCategory: 'research' },
      ];
      expect(detector.isCircular(attempts)).toBe(false);
    });
  });

  describe('isResourceExhausted', () => {
    it('should return false when context under threshold', () => {
      expect(detector.isResourceExhausted({ utilizationPercent: 0.5 })).toBe(false);
    });

    it('should return true when context above 90%', () => {
      expect(detector.isResourceExhausted({ utilizationPercent: 0.95 })).toBe(true);
    });
  });

  describe('isTimedOut', () => {
    it('should return false when within timeout', () => {
      const startTime = Date.now() - 60000; // 1 minute ago
      expect(detector.isTimedOut(startTime)).toBe(false);
    });

    it('should return true when exceeded timeout', () => {
      const startTime = Date.now() - 700000; // 11+ minutes ago
      expect(detector.isTimedOut(startTime)).toBe(true);
    });
  });

  describe('detect', () => {
    it('should detect stuck state correctly', () => {
      const history: AgentHistory = {
        errors: ['Same error', 'Same error', 'Same error'],
        iterations: Array(6).fill({
          filesCreated: 0,
          filesModified: 0,
          testsRan: 0,
          buildSucceeded: false,
          significantOutput: false,
        }),
        attempts: [],
        contextState: { utilizationPercent: 0.5 },
        startTime: Date.now() - 60000,
      };

      const result = detector.detect(history);

      expect(result.repeatedErrors).toBe(true);
      expect(result.noProgress).toBe(true);
      expect(result.severity).toBeGreaterThan(0.4);
    });

    it('should not detect stuck when making progress', () => {
      const history: AgentHistory = {
        errors: [],
        iterations: [
          { filesCreated: 2, filesModified: 0, testsRan: 0, buildSucceeded: true, significantOutput: true },
        ],
        attempts: [],
        contextState: { utilizationPercent: 0.3 },
        startTime: Date.now() - 60000,
      };

      const result = detector.detect(history);

      expect(detector.isStuck(result)).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should respect custom configuration', () => {
      const customConfig: Partial<StuckDetectorConfig> = {
        errorThreshold: 5,
        progressThreshold: 10,
        timeoutMs: 300000,
      };

      const customDetector = new StuckDetector(customConfig);

      // With higher threshold, 3 errors shouldn't trigger
      const errors = ['Error', 'Error', 'Error'];
      expect(customDetector.hasRepeatedErrors(errors)).toBe(false);

      // With 5 threshold, 5 errors should trigger
      const moreErrors = ['Error', 'Error', 'Error', 'Error', 'Error'];
      expect(customDetector.hasRepeatedErrors(moreErrors)).toBe(true);
    });
  });
});
```

---

### File 3: `__tests__/unit/knowledge/store.test.ts`

```typescript
/**
 * KnowledgeStore Unit Tests
 */

import { KnowledgeStore } from '../../../knowledge/store';
import { EventStream } from '../../../core/event-stream';

describe('KnowledgeStore', () => {
  let store: KnowledgeStore;
  let eventStream: EventStream;

  beforeEach(() => {
    eventStream = new EventStream();
    store = new KnowledgeStore({
      sessionId: 'test-session',
      eventStream,
    });
  });

  describe('write and read', () => {
    it('should write and read documents', async () => {
      const content = JSON.stringify({ test: 'data' });
      const result = await store.write('/test/doc.json', content);

      expect(result.success).toBe(true);
      expect(result.version).toBe(1);

      const doc = await store.read('/test/doc.json');
      expect(doc).not.toBeNull();
      expect(doc?.content).toBe(content);
    });

    it('should increment version on update', async () => {
      await store.write('/test/doc.json', 'v1');
      const v1Result = await store.read('/test/doc.json');

      await store.write('/test/doc.json', 'v2');
      const v2Result = await store.read('/test/doc.json');

      expect(v1Result?.version).toBe(1);
      expect(v2Result?.version).toBe(2);
    });

    it('should return null for non-existent documents', async () => {
      const doc = await store.read('/nonexistent/path');
      expect(doc).toBeNull();
    });
  });

  describe('optimistic locking', () => {
    it('should succeed with correct version', async () => {
      await store.write('/test/doc.json', 'initial');

      const result = await store.write('/test/doc.json', 'updated', 1);

      expect(result.success).toBe(true);
      expect(result.version).toBe(2);
    });

    it('should fail with incorrect version', async () => {
      await store.write('/test/doc.json', 'initial'); // version 1

      const result = await store.write('/test/doc.json', 'updated', 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe('VERSION_CONFLICT');
    });

    it('should handle concurrent writes correctly', async () => {
      await store.write('/test/doc.json', 'initial');

      // Simulate two concurrent updates
      const update1 = store.write('/test/doc.json', 'update1', 1);
      const update2 = store.write('/test/doc.json', 'update2', 1);

      const [result1, result2] = await Promise.all([update1, update2]);

      // One should succeed, one should fail
      const successes = [result1.success, result2.success].filter(Boolean);
      expect(successes.length).toBe(1);
    });
  });

  describe('list', () => {
    it('should list all documents', async () => {
      await store.write('/requirements/main.json', '{}');
      await store.write('/architecture/main.json', '{}');
      await store.write('/plan/main.json', '{}');

      const paths = await store.listPaths();

      expect(paths).toHaveLength(3);
      expect(paths).toContain('/requirements/main.json');
      expect(paths).toContain('/architecture/main.json');
      expect(paths).toContain('/plan/main.json');
    });

    it('should filter by prefix', async () => {
      await store.write('/requirements/main.json', '{}');
      await store.write('/requirements/implicit.json', '{}');
      await store.write('/architecture/main.json', '{}');

      const paths = await store.listPaths('/requirements');

      expect(paths).toHaveLength(2);
      expect(paths.every(p => p.startsWith('/requirements'))).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete documents', async () => {
      await store.write('/test/doc.json', 'content');

      const deleted = await store.delete('/test/doc.json');
      expect(deleted).toBe(true);

      const doc = await store.read('/test/doc.json');
      expect(doc).toBeNull();
    });

    it('should return false for non-existent documents', async () => {
      const deleted = await store.delete('/nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('events', () => {
    it('should emit events on write', async () => {
      const handler = jest.fn();
      eventStream.onAny(handler);

      await store.write('/test/doc.json', 'content');

      expect(handler).toHaveBeenCalled();
    });
  });
});
```

---

### File 4: `__tests__/unit/verification/security-scanner.test.ts`

```typescript
/**
 * SecurityScanner Unit Tests
 */

import { SecurityScanner } from '../../../verification/security-scanner';

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;

  beforeEach(() => {
    scanner = new SecurityScanner();
  });

  describe('hardcoded secrets', () => {
    it('should detect hardcoded API keys', async () => {
      const files = new Map([
        ['src/config.ts', `
          const API_KEY = "sk_live_abc123def456";
          export { API_KEY };
        `],
      ]);

      const result = await scanner.scan(files);

      expect(result.criticalCount).toBeGreaterThan(0);
      expect(result.issues.some(i => i.type === 'CRYPTOGRAPHIC_FAILURE')).toBe(true);
    });

    it('should detect hardcoded passwords', async () => {
      const files = new Map([
        ['src/db.ts', `
          const password = "super_secret_password123";
        `],
      ]);

      const result = await scanner.scan(files);

      expect(result.issues.some(i =>
        i.description.toLowerCase().includes('secret')
      )).toBe(true);
    });
  });

  describe('SQL injection', () => {
    it('should detect SQL injection vulnerabilities', async () => {
      const files = new Map([
        ['src/api/users.ts', `
          const user = await db.query(\`SELECT * FROM users WHERE id = \${userId}\`);
        `],
      ]);

      const result = await scanner.scan(files);

      expect(result.issues.some(i => i.type === 'INJECTION')).toBe(true);
    });
  });

  describe('XSS', () => {
    it('should detect dangerouslySetInnerHTML', async () => {
      const files = new Map([
        ['src/components/Content.tsx', `
          export function Content({ html }) {
            return <div dangerouslySetInnerHTML={{ __html: html }} />;
          }
        `],
      ]);

      const result = await scanner.scan(files);

      expect(result.issues.some(i => i.type === 'INTEGRITY_FAILURE')).toBe(true);
    });
  });

  describe('unsafe eval', () => {
    it('should detect eval usage', async () => {
      const files = new Map([
        ['src/utils.ts', `
          const result = eval(userInput);
        `],
      ]);

      const result = await scanner.scan(files);

      expect(result.issues.some(i =>
        i.description.toLowerCase().includes('eval')
      )).toBe(true);
    });
  });

  describe('exposed secrets in client', () => {
    it('should detect NEXT_PUBLIC_ secrets', async () => {
      const files = new Map([
        ['src/config.ts', `
          export const key = process.env.NEXT_PUBLIC_SECRET_KEY;
        `],
      ]);

      const result = await scanner.scan(files);

      expect(result.criticalCount).toBeGreaterThan(0);
    });
  });

  describe('scan summary', () => {
    it('should count issues by severity', async () => {
      const files = new Map([
        ['src/bad-code.ts', `
          const API_KEY = "abc123";
          eval(code);
          console.log(password);
        `],
      ]);

      const result = await scanner.scan(files);

      expect(result.criticalCount + result.highCount + result.mediumCount + result.lowCount)
        .toBe(result.issues.length);
    });

    it('should return empty for clean code', async () => {
      const files = new Map([
        ['src/clean.ts', `
          const apiKey = process.env.API_KEY;
          const data = JSON.parse(input);
        `],
      ]);

      const result = await scanner.scan(files);

      expect(result.criticalCount).toBe(0);
    });
  });
});
```

---

## Integration Tests

### File: `__tests__/integration/agent-coordination.test.ts`

```typescript
/**
 * Agent Coordination Integration Tests
 */

import { Orchestrator } from '../../core/orchestrator';
import { createMockAnthropicClient } from '../mocks/anthropic-client';

describe('Agent Coordination', () => {
  let orchestrator: Orchestrator;
  let mockClient: ReturnType<typeof createMockAnthropicClient>;

  beforeEach(() => {
    mockClient = createMockAnthropicClient();
    orchestrator = new Orchestrator({
      apiKey: 'test-key',
      options: {
        projectId: 'test-project',
        projectName: 'test-app',
        prompt: 'Build a todo app',
      },
    });
  });

  it('should run agents in correct order', async () => {
    const agentOrder: string[] = [];

    orchestrator.onEvent((event) => {
      if (event.type === 'agent:started') {
        agentOrder.push((event.payload as { agent: string }).agent);
      }
    });

    await orchestrator.run();

    expect(agentOrder[0]).toBe('hermes');
    expect(agentOrder).toContain('athena');
    expect(agentOrder).toContain('hephaestus');
  });

  it('should pass knowledge between agents', async () => {
    const knowledgeWrites: string[] = [];

    orchestrator.onEvent((event) => {
      if (event.type === 'knowledge:written') {
        knowledgeWrites.push((event.payload as { path: string }).path);
      }
    });

    await orchestrator.run();

    // Hermes writes requirements
    expect(knowledgeWrites).toContain('/requirements/main.json');

    // Athena writes architecture
    expect(knowledgeWrites).toContain('/architecture/main.json');
  });

  it('should handle agent failure gracefully', async () => {
    // Configure mock to fail on a specific agent
    mockClient.failOnAgent('hephaestus');

    const result = await orchestrator.run();

    // Should still complete with recovery
    expect(result.success || result.warnings.length > 0).toBe(true);
  });
});
```

---

### File: `__tests__/integration/recovery-flow.test.ts`

```typescript
/**
 * Recovery Flow Integration Tests
 */

import { RecoveryContext } from '../../recovery/recovery-context';
import { StrategySelector } from '../../recovery/strategy-selector';
import { StuckDetector } from '../../recovery/stuck-detector';
import { createMockRecoveryContext } from '../mocks/recovery-context';

describe('Recovery Flow', () => {
  let context: RecoveryContext;
  let selector: StrategySelector;
  let detector: StuckDetector;

  beforeEach(() => {
    context = createMockRecoveryContext();
    selector = new StrategySelector();
    detector = new StuckDetector();
  });

  it('should detect stuck and recover with context', async () => {
    // Simulate stuck state with repeated errors
    const stuckIndicators = detector.detect({
      errors: ['Error X', 'Error X', 'Error X'],
      iterations: [],
      attempts: [],
      contextState: { utilizationPercent: 0.3 },
      startTime: Date.now() - 60000,
    });

    expect(detector.isStuck(stuckIndicators)).toBe(true);

    // Select strategy
    const selection = selector.select(stuckIndicators, context);
    expect(selection.strategyName).toBe('retry_with_context');

    // Apply strategy
    const result = await selector.apply(selection.strategy!, context);
    expect(result.action).toBe('continue');
  });

  it('should escalate to human when all strategies fail', async () => {
    // Mark all strategies as tried
    for (let i = 0; i < 6; i++) {
      context.recordAttempt({
        id: `attempt-${i}`,
        strategy: ['retry_with_context', 'simplify_approach', 'alternative_solution',
                   'decompose_task', 'skip_and_stub', 'rollback'][i],
        timestamp: Date.now(),
        success: false,
        action: 'continue',
        reason: 'Test failure',
      });
    }

    const stuckIndicators = detector.detect({
      errors: ['Error'],
      iterations: [],
      attempts: [],
      contextState: { utilizationPercent: 0.5 },
      startTime: Date.now(),
    });

    const selection = selector.select(stuckIndicators, context);

    expect(selection.strategyName).toBe('human_escalation');
  });

  it('should respect strategy priority order', async () => {
    const triedStrategies: string[] = [];

    // Simulate trying strategies in order
    for (let i = 0; i < 5; i++) {
      const stuckIndicators = detector.detect({
        errors: Array(3).fill('Error'),
        iterations: Array(6).fill({
          filesCreated: 0, filesModified: 0, testsRan: 0,
          buildSucceeded: false, significantOutput: false,
        }),
        attempts: [],
        contextState: { utilizationPercent: 0.5 },
        startTime: Date.now(),
      });

      const selection = selector.select(stuckIndicators, context);
      if (selection.strategyName) {
        triedStrategies.push(selection.strategyName);

        // Record attempt
        context.recordAttempt({
          id: `attempt-${i}`,
          strategy: selection.strategyName,
          timestamp: Date.now(),
          success: false,
          action: 'continue',
          reason: 'Test',
        });
      }
    }

    // Verify order matches priority
    expect(triedStrategies[0]).toBe('retry_with_context');
    expect(triedStrategies[1]).toBe('simplify_approach');
  });
});
```

---

## E2E Tests

### File: `__tests__/e2e/simple-app-generation.test.ts`

```typescript
/**
 * Simple App Generation E2E Tests
 *
 * Tests full generation flow for a simple todo app.
 */

import { Orchestrator } from '../../core/orchestrator';
import { createTestEnvironment, cleanupTestEnvironment } from '../utils/test-helpers';

describe('Simple App Generation E2E', () => {
  let env: ReturnType<typeof createTestEnvironment>;

  beforeAll(async () => {
    env = createTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment(env);
  });

  it('should generate a todo app successfully', async () => {
    const orchestrator = new Orchestrator({
      apiKey: env.apiKey,
      options: {
        projectId: 'e2e-todo',
        projectName: 'todo-app',
        prompt: 'Build a simple todo app with add, complete, and delete functionality.',
      },
    });

    const events: any[] = [];
    orchestrator.onEvent((event) => events.push(event));

    const result = await orchestrator.run();

    // Assertions
    expect(result.success).toBe(true);
    expect(result.filesCount).toBeGreaterThan(5);

    // Check required files exist
    const files = result.files;
    expect(files.has('src/app/page.tsx')).toBe(true);
    expect(files.has('src/components/todo-list.tsx')).toBe(true);

    // Check phases completed
    const phaseEvents = events.filter(e => e.type === 'phase:completed');
    expect(phaseEvents.length).toBeGreaterThanOrEqual(5);
  }, 300000); // 5 minute timeout

  it('should generate working TypeScript code', async () => {
    const orchestrator = new Orchestrator({
      apiKey: env.apiKey,
      options: {
        projectId: 'e2e-typecheck',
        projectName: 'typed-app',
        prompt: 'Build a counter component with TypeScript types.',
      },
    });

    const result = await orchestrator.run();

    expect(result.success).toBe(true);

    // Verification should have passed
    const verificationEvents = result.events?.filter(
      e => e.type === 'phase:completed' && e.payload?.phase === 'verification'
    );
    expect(verificationEvents?.length).toBeGreaterThan(0);
  }, 300000);
});
```

---

### File: `__tests__/e2e/user-interaction.test.ts`

```typescript
/**
 * User Interaction E2E Tests
 *
 * Tests clarification questions and user responses.
 */

import { Orchestrator } from '../../core/orchestrator';
import { createTestEnvironment } from '../utils/test-helpers';

describe('User Interaction E2E', () => {
  let env: ReturnType<typeof createTestEnvironment>;

  beforeAll(async () => {
    env = createTestEnvironment();
  });

  it('should ask clarification for ambiguous prompts', async () => {
    const orchestrator = new Orchestrator({
      apiKey: env.apiKey,
      options: {
        projectId: 'e2e-clarify',
        projectName: 'ambiguous-app',
        prompt: 'Build an app',  // Very vague
      },
    });

    const questions: any[] = [];

    orchestrator.onEvent((event) => {
      if (event.type === 'user:input_required') {
        questions.push(event.payload);

        // Simulate user response
        orchestrator.submitUserResponse(
          event.payload.questionId,
          'Build a todo app with authentication'
        );
      }
    });

    const result = await orchestrator.run();

    expect(questions.length).toBeGreaterThan(0);
    expect(result.success).toBe(true);
  }, 300000);

  it('should handle user timeout gracefully', async () => {
    const orchestrator = new Orchestrator({
      apiKey: env.apiKey,
      options: {
        projectId: 'e2e-timeout',
        projectName: 'timeout-app',
        prompt: 'Build an e-commerce store',
        clarificationTimeout: 5000,  // 5 second timeout
      },
    });

    // Don't respond to questions

    const result = await orchestrator.run();

    // Should either complete with assumptions or show appropriate error
    expect(result).toBeDefined();
  }, 60000);
});
```

---

## Test Mocks

### File: `__tests__/mocks/anthropic-client.ts`

```typescript
/**
 * Anthropic Client Mock
 */

import { SAMPLE_RESPONSES } from '../fixtures/responses/claude-responses';

export interface MockAnthropicClient {
  messages: {
    create: jest.Mock;
  };
  failOnAgent: (agentName: string) => void;
}

export function createMockAnthropicClient(): MockAnthropicClient {
  let failingAgent: string | null = null;

  const mock: MockAnthropicClient = {
    messages: {
      create: jest.fn(async (params: any) => {
        // Check if we should fail
        if (failingAgent && params.system?.includes(failingAgent)) {
          throw new Error(`Simulated failure for ${failingAgent}`);
        }

        // Return appropriate mock response based on context
        const systemPrompt = params.system || '';

        if (systemPrompt.includes('Hermes')) {
          return {
            content: [{ type: 'text', text: SAMPLE_RESPONSES.hermes }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 100, output_tokens: 200 },
          };
        }

        if (systemPrompt.includes('Athena')) {
          return {
            content: [{ type: 'text', text: SAMPLE_RESPONSES.athena }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 150, output_tokens: 300 },
          };
        }

        // Default response
        return {
          content: [{ type: 'text', text: 'Default mock response' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 50, output_tokens: 100 },
        };
      }),
    },
    failOnAgent: (agentName: string) => {
      failingAgent = agentName;
    },
  };

  return mock;
}
```

---

## Test Utilities

### File: `__tests__/utils/test-helpers.ts`

```typescript
/**
 * Test Helpers
 */

export function createTestEnvironment() {
  return {
    apiKey: process.env.TEST_ANTHROPIC_API_KEY || 'test-key',
    sessionId: `test-${Date.now()}`,
  };
}

export async function cleanupTestEnvironment(env: any) {
  // Cleanup logic
}

export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createMockEventStream() {
  const events: any[] = [];
  const handlers: Map<string, Set<Function>> = new Map();

  return {
    emit: (event: any) => {
      events.push(event);
      const typeHandlers = handlers.get(event.type) || new Set();
      typeHandlers.forEach(h => h(event));
    },
    on: (type: string, handler: Function) => {
      if (!handlers.has(type)) {
        handlers.set(type, new Set());
      }
      handlers.get(type)!.add(handler);
      return () => handlers.get(type)!.delete(handler);
    },
    getEvents: () => [...events],
    clear: () => events.length = 0,
  };
}
```

---

## CI/CD Integration

### `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test:unit

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run integration tests
        run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          TEST_ANTHROPIC_API_KEY: ${{ secrets.TEST_ANTHROPIC_API_KEY }}
```

---

## Test Commands (package.json)

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern='unit'",
    "test:integration": "jest --testPathPattern='integration'",
    "test:e2e": "jest --testPathPattern='e2e' --runInBand",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

---

## Verification Checklist

After Phase 8 implementation:

- [ ] Jest configured correctly
- [ ] All unit tests passing (60+ tests)
- [ ] All integration tests passing (15+ tests)
- [ ] E2E tests passing with mock/real API
- [ ] Code coverage > 80%
- [ ] CI/CD pipeline runs tests
- [ ] Test fixtures are comprehensive
- [ ] Mocks are reliable
- [ ] Tests are deterministic

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Unit test count | 60+ |
| Integration test count | 15+ |
| E2E test count | 5+ |
| Code coverage | > 80% |
| Test execution time | < 5 min (unit) |
| Flaky test rate | < 1% |

---

## Summary

Phase 8 provides comprehensive testing coverage:

1. **Unit Tests**: Cover all individual modules in isolation
2. **Integration Tests**: Verify components work together
3. **E2E Tests**: Validate full generation flows
4. **CI/CD**: Automated testing on every push

This ensures V14 OLYMPUS is reliable, maintainable, and production-ready.
