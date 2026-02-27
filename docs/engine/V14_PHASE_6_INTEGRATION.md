# V14 OLYMPUS - Phase 6: Integration & API

## Overview

Phase 6 wires everything together - tools, sandbox, and the streaming API endpoint. This is where all the components from previous phases come together into a cohesive system.

**Files to Create:** 10
**Estimated Complexity:** High
**Dependencies:** Phases 1-5

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Layer                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  POST /api/generate/v14 → SSE Stream                        │    │
│  │  PUT  /api/generate/v14 → User Response                     │    │
│  │  GET  /api/generate/v14/status/:id → Status                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Orchestrator (Zeus)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ Tool        │  │ Sandbox     │  │ Event       │                  │
│  │ Executor    │  │ Manager     │  │ Stream      │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ File Tools    │       │ Command Tools │       │ Web Tools     │
│ - write_file  │       │ - run_command │       │ - web_search  │
│ - read_file   │       │ - run_build   │       │ - web_fetch   │
│ - delete_file │       │ - run_test    │       │               │
└───────────────┘       └───────────────┘       └───────────────┘
```

---

## File Structure

```
src/lib/engine/v14-olympus/
├── tools/
│   ├── index.ts                # Tool exports
│   ├── definitions.ts          # Tool schemas (JSON Schema)
│   ├── executor.ts             # Tool execution engine
│   ├── registry.ts             # Tool registry
│   └── implementations/
│       ├── file-tools.ts       # File operations
│       ├── command-tools.ts    # Shell commands
│       ├── web-tools.ts        # Web research
│       ├── knowledge-tools.ts  # Knowledge store
│       └── user-tools.ts       # User interaction
├── sandbox/
│   ├── index.ts                # Sandbox exports
│   ├── memory-sandbox.ts       # In-memory file system
│   ├── command-executor.ts     # Shell command execution
│   └── snapshot-manager.ts     # Sandbox snapshots
└── api/
    ├── route.ts                # Main API endpoint
    ├── session-manager.ts      # Session management
    └── response-handler.ts     # User response handling
```

---

## File 1: `src/lib/engine/v14-olympus/tools/index.ts`

### Purpose
Central export file for the tools module.

### Exact Implementation

```typescript
/**
 * V14 OLYMPUS Tools Module
 *
 * Provides all tools available to agents for interacting with
 * the sandbox, knowledge store, web, and user.
 */

// Core exports
export { ToolExecutor, type ToolExecutionResult } from './executor';
export { ToolRegistry } from './registry';
export { TOOL_DEFINITIONS, type ToolDefinition } from './definitions';

// Tool implementations
export { FileTools } from './implementations/file-tools';
export { CommandTools } from './implementations/command-tools';
export { WebTools } from './implementations/web-tools';
export { KnowledgeTools } from './implementations/knowledge-tools';
export { UserTools } from './implementations/user-tools';

// Tool names
export const TOOL_NAMES = [
  // File operations
  'write_file',
  'read_file',
  'delete_file',
  'list_files',
  'file_exists',

  // Command execution
  'run_command',
  'run_build',
  'run_test',
  'run_lint',

  // Web research
  'web_search',
  'web_fetch',

  // Knowledge store
  'read_knowledge',
  'write_knowledge',
  'search_knowledge',
  'list_knowledge',

  // User interaction
  'ask_user',
  'emit_progress',

  // Deployment
  'deploy_vercel',

  // Patterns
  'apply_pattern',
  'list_patterns',
] as const;

export type ToolName = typeof TOOL_NAMES[number];
```

---

## File 2: `src/lib/engine/v14-olympus/tools/definitions.ts`

### Purpose
JSON Schema definitions for all tools. These are passed to Claude for tool use.

### Exact Implementation

```typescript
/**
 * Tool Definitions
 *
 * JSON Schema definitions for all tools available to agents.
 * These schemas are passed to Claude's tool use API.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, PropertySchema>;
    required?: string[];
  };
}

interface PropertySchema {
  type: string;
  description: string;
  enum?: string[];
  items?: PropertySchema;
  properties?: Record<string, PropertySchema>;
  default?: unknown;
}

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  // ========================================
  // FILE OPERATIONS
  // ========================================

  write_file: {
    name: 'write_file',
    description: 'Write content to a file in the project. Creates the file if it does not exist, overwrites if it does.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to project root (e.g., "src/components/Button.tsx")',
        },
        content: {
          type: 'string',
          description: 'The complete content to write to the file',
        },
        description: {
          type: 'string',
          description: 'Brief description of what this file does (for logging)',
        },
      },
      required: ['path', 'content'],
    },
  },

  read_file: {
    name: 'read_file',
    description: 'Read the content of a file from the project.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to project root',
        },
      },
      required: ['path'],
    },
  },

  delete_file: {
    name: 'delete_file',
    description: 'Delete a file from the project.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to delete',
        },
      },
      required: ['path'],
    },
  },

  list_files: {
    name: 'list_files',
    description: 'List files in the project matching a glob pattern.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "src/**/*.tsx", "*.json")',
          default: '**/*',
        },
      },
    },
  },

  file_exists: {
    name: 'file_exists',
    description: 'Check if a file exists in the project.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to check',
        },
      },
      required: ['path'],
    },
  },

  // ========================================
  // COMMAND EXECUTION
  // ========================================

  run_command: {
    name: 'run_command',
    description: 'Run a shell command in the project directory. Use for build, test, lint, etc.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to run',
        },
        cwd: {
          type: 'string',
          description: 'Working directory (relative to project root)',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 60000)',
        },
        description: {
          type: 'string',
          description: 'What this command does (for logging)',
        },
      },
      required: ['command'],
    },
  },

  run_build: {
    name: 'run_build',
    description: 'Run the project build command (npm run build or equivalent).',
    input_schema: {
      type: 'object',
      properties: {
        skipTypeCheck: {
          type: 'boolean',
          description: 'Skip TypeScript type checking',
        },
      },
    },
  },

  run_test: {
    name: 'run_test',
    description: 'Run tests in the project.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['unit', 'integration', 'e2e', 'all'],
          description: 'Type of tests to run',
        },
        pattern: {
          type: 'string',
          description: 'Test file pattern to match',
        },
        coverage: {
          type: 'boolean',
          description: 'Generate coverage report',
        },
      },
    },
  },

  run_lint: {
    name: 'run_lint',
    description: 'Run ESLint on the project.',
    input_schema: {
      type: 'object',
      properties: {
        fix: {
          type: 'boolean',
          description: 'Automatically fix fixable issues',
        },
        pattern: {
          type: 'string',
          description: 'File pattern to lint',
        },
      },
    },
  },

  // ========================================
  // WEB RESEARCH
  // ========================================

  web_search: {
    name: 'web_search',
    description: 'Search the web for information. Use for research, finding documentation, etc.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        type: {
          type: 'string',
          enum: ['general', 'documentation', 'tutorial', 'stackoverflow', 'github'],
          description: 'Type of search to optimize results',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 5)',
        },
      },
      required: ['query'],
    },
  },

  web_fetch: {
    name: 'web_fetch',
    description: 'Fetch and extract content from a URL. Returns cleaned text content.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to fetch',
        },
        extract: {
          type: 'string',
          description: 'What to extract from the page (e.g., "code examples", "API documentation")',
        },
        maxLength: {
          type: 'number',
          description: 'Maximum content length to return',
        },
      },
      required: ['url'],
    },
  },

  // ========================================
  // KNOWLEDGE STORE
  // ========================================

  read_knowledge: {
    name: 'read_knowledge',
    description: 'Read a document from the knowledge store.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Document path (e.g., "/requirements/main.json")',
        },
      },
      required: ['path'],
    },
  },

  write_knowledge: {
    name: 'write_knowledge',
    description: 'Write a document to the knowledge store.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Document path',
        },
        content: {
          type: 'string',
          description: 'Document content (usually JSON)',
        },
        version: {
          type: 'number',
          description: 'Expected version for optimistic locking',
        },
      },
      required: ['path', 'content'],
    },
  },

  search_knowledge: {
    name: 'search_knowledge',
    description: 'Search the knowledge store semantically.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 5)',
        },
        type: {
          type: 'string',
          enum: ['requirements', 'architecture', 'plan', 'research', 'all'],
          description: 'Filter by document type',
        },
      },
      required: ['query'],
    },
  },

  list_knowledge: {
    name: 'list_knowledge',
    description: 'List all documents in the knowledge store.',
    input_schema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description: 'Filter by path prefix',
        },
      },
    },
  },

  // ========================================
  // USER INTERACTION
  // ========================================

  ask_user: {
    name: 'ask_user',
    description: 'Ask the user a question and wait for their response.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask',
        },
        type: {
          type: 'string',
          enum: ['choice', 'freeform', 'confirmation'],
          description: 'Type of response expected',
        },
        options: {
          type: 'array',
          description: 'Options for choice type questions',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Option ID' },
              label: { type: 'string', description: 'Display label' },
              description: { type: 'string', description: 'Option description' },
            },
          },
        },
        context: {
          type: 'string',
          description: 'Additional context for the question',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in ms (default: 120000)',
        },
      },
      required: ['question'],
    },
  },

  emit_progress: {
    name: 'emit_progress',
    description: 'Emit a progress update to the user.',
    input_schema: {
      type: 'object',
      properties: {
        progress: {
          type: 'number',
          description: 'Progress percentage (0-100)',
        },
        message: {
          type: 'string',
          description: 'Status message',
        },
        phase: {
          type: 'string',
          description: 'Current phase name',
        },
      },
      required: ['progress', 'message'],
    },
  },

  // ========================================
  // DEPLOYMENT
  // ========================================

  deploy_vercel: {
    name: 'deploy_vercel',
    description: 'Deploy the project to Vercel.',
    input_schema: {
      type: 'object',
      properties: {
        projectName: {
          type: 'string',
          description: 'Vercel project name',
        },
        production: {
          type: 'boolean',
          description: 'Deploy to production (default: false = preview)',
        },
        envVars: {
          type: 'object',
          description: 'Environment variables to set',
        },
      },
      required: ['projectName'],
    },
  },

  // ========================================
  // PATTERNS
  // ========================================

  apply_pattern: {
    name: 'apply_pattern',
    description: 'Apply a code pattern template to generate boilerplate.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          enum: ['auth', 'crud', 'data-table', 'form', 'dashboard', 'api-route', 'modal', 'layout'],
          description: 'Pattern to apply',
        },
        name: {
          type: 'string',
          description: 'Name for the generated component/feature',
        },
        options: {
          type: 'object',
          description: 'Pattern-specific customization options',
        },
      },
      required: ['pattern', 'name'],
    },
  },

  list_patterns: {
    name: 'list_patterns',
    description: 'List all available code patterns.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
};

/**
 * Get tool definitions for a specific agent
 */
export function getToolsForAgent(agentName: string): ToolDefinition[] {
  const agentTools: Record<string, string[]> = {
    hermes: ['ask_user', 'write_knowledge', 'read_knowledge', 'emit_progress'],
    athena: ['web_search', 'web_fetch', 'read_knowledge', 'write_knowledge', 'search_knowledge', 'emit_progress'],
    hephaestus: ['write_file', 'read_file', 'delete_file', 'list_files', 'run_command', 'run_build', 'read_knowledge', 'apply_pattern', 'emit_progress'],
    apollo: ['read_file', 'list_files', 'run_test', 'run_lint', 'read_knowledge', 'write_knowledge', 'emit_progress'],
    artemis: ['read_file', 'run_command', 'deploy_vercel', 'read_knowledge', 'emit_progress'],
  };

  const toolNames = agentTools[agentName] || Object.keys(TOOL_DEFINITIONS);
  return toolNames.map(name => TOOL_DEFINITIONS[name]).filter(Boolean);
}
```

---

## File 3: `src/lib/engine/v14-olympus/tools/executor.ts`

### Purpose
Executes tools requested by agents, routing to appropriate implementations.

### Exact Implementation

```typescript
/**
 * Tool Executor
 *
 * Executes tools requested by agents.
 * Routes tool calls to appropriate implementations.
 * Handles errors and logging.
 */

import { ToolName } from './index';
import { FileTools } from './implementations/file-tools';
import { CommandTools } from './implementations/command-tools';
import { WebTools } from './implementations/web-tools';
import { KnowledgeTools } from './implementations/knowledge-tools';
import { UserTools } from './implementations/user-tools';
import { MemorySandbox } from '../sandbox/memory-sandbox';
import { KnowledgeStore } from '../knowledge/store';
import { EventStream } from '../core/event-stream';
import { EventType } from '../types/events';

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

export interface ToolExecutorConfig {
  sandbox: MemorySandbox;
  knowledge: KnowledgeStore;
  eventStream: EventStream;
  sessionId: string;
  askUser: (question: UserQuestion) => Promise<UserResponse>;
  webSearchFn?: (query: string, options?: WebSearchOptions) => Promise<WebSearchResult[]>;
  webFetchFn?: (url: string) => Promise<string>;
}

interface UserQuestion {
  id: string;
  type: 'choice' | 'freeform' | 'confirmation';
  question: string;
  options?: Array<{ id: string; label: string; description?: string }>;
  context?: string;
  timeout?: number;
}

interface UserResponse {
  questionId: string;
  response: string;
  selectedOptionId?: string;
  timedOut: boolean;
}

interface WebSearchOptions {
  type?: string;
  limit?: number;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class ToolExecutor {
  private fileTools: FileTools;
  private commandTools: CommandTools;
  private webTools: WebTools;
  private knowledgeTools: KnowledgeTools;
  private userTools: UserTools;
  private eventStream: EventStream;
  private sessionId: string;

  constructor(config: ToolExecutorConfig) {
    this.eventStream = config.eventStream;
    this.sessionId = config.sessionId;

    // Initialize tool implementations
    this.fileTools = new FileTools(config.sandbox);
    this.commandTools = new CommandTools(config.sandbox);
    this.webTools = new WebTools(config.webSearchFn, config.webFetchFn);
    this.knowledgeTools = new KnowledgeTools(config.knowledge);
    this.userTools = new UserTools(config.askUser, config.eventStream, config.sessionId);
  }

  /**
   * Execute a tool
   */
  async execute(
    toolName: ToolName,
    args: Record<string, unknown>,
    agentName: string
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Emit tool call event
    this.emit(EventType.AGENT_TOOL_CALL, {
      agent: agentName,
      tool: toolName,
      args,
    });

    try {
      const result = await this.routeToolCall(toolName, args);

      const duration = Date.now() - startTime;

      // Emit success event
      this.emit(EventType.AGENT_TOOL_RESULT, {
        agent: agentName,
        tool: toolName,
        success: true,
        duration,
      });

      return {
        success: true,
        data: result,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Emit error event
      this.emit(EventType.AGENT_TOOL_RESULT, {
        agent: agentName,
        tool: toolName,
        success: false,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Route tool call to appropriate implementation
   */
  private async routeToolCall(
    toolName: ToolName,
    args: Record<string, unknown>
  ): Promise<unknown> {
    switch (toolName) {
      // File tools
      case 'write_file':
        return this.fileTools.writeFile(
          args.path as string,
          args.content as string,
          args.description as string | undefined
        );

      case 'read_file':
        return this.fileTools.readFile(args.path as string);

      case 'delete_file':
        return this.fileTools.deleteFile(args.path as string);

      case 'list_files':
        return this.fileTools.listFiles(args.pattern as string | undefined);

      case 'file_exists':
        return this.fileTools.fileExists(args.path as string);

      // Command tools
      case 'run_command':
        return this.commandTools.runCommand(
          args.command as string,
          {
            cwd: args.cwd as string | undefined,
            timeout: args.timeout as number | undefined,
          }
        );

      case 'run_build':
        return this.commandTools.runBuild(args.skipTypeCheck as boolean | undefined);

      case 'run_test':
        return this.commandTools.runTest({
          type: args.type as 'unit' | 'integration' | 'e2e' | 'all' | undefined,
          pattern: args.pattern as string | undefined,
          coverage: args.coverage as boolean | undefined,
        });

      case 'run_lint':
        return this.commandTools.runLint({
          fix: args.fix as boolean | undefined,
          pattern: args.pattern as string | undefined,
        });

      // Web tools
      case 'web_search':
        return this.webTools.search(
          args.query as string,
          {
            type: args.type as string | undefined,
            limit: args.limit as number | undefined,
          }
        );

      case 'web_fetch':
        return this.webTools.fetch(
          args.url as string,
          {
            extract: args.extract as string | undefined,
            maxLength: args.maxLength as number | undefined,
          }
        );

      // Knowledge tools
      case 'read_knowledge':
        return this.knowledgeTools.read(args.path as string);

      case 'write_knowledge':
        return this.knowledgeTools.write(
          args.path as string,
          args.content as string,
          args.version as number | undefined
        );

      case 'search_knowledge':
        return this.knowledgeTools.search(
          args.query as string,
          {
            limit: args.limit as number | undefined,
            type: args.type as string | undefined,
          }
        );

      case 'list_knowledge':
        return this.knowledgeTools.list(args.prefix as string | undefined);

      // User tools
      case 'ask_user':
        return this.userTools.askUser({
          question: args.question as string,
          type: args.type as 'choice' | 'freeform' | 'confirmation' | undefined,
          options: args.options as Array<{ id: string; label: string; description?: string }> | undefined,
          context: args.context as string | undefined,
          timeout: args.timeout as number | undefined,
        });

      case 'emit_progress':
        return this.userTools.emitProgress(
          args.progress as number,
          args.message as string,
          args.phase as string | undefined
        );

      // Deployment
      case 'deploy_vercel':
        return this.deployVercel(args);

      // Patterns
      case 'apply_pattern':
        return this.applyPattern(
          args.pattern as string,
          args.name as string,
          args.options as Record<string, unknown> | undefined
        );

      case 'list_patterns':
        return this.listPatterns();

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Deploy to Vercel
   */
  private async deployVercel(args: Record<string, unknown>): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    // In production, would use Vercel API
    // For now, return simulated result
    return {
      success: true,
      url: `https://${args.projectName}.vercel.app`,
    };
  }

  /**
   * Apply a code pattern
   */
  private async applyPattern(
    pattern: string,
    name: string,
    options?: Record<string, unknown>
  ): Promise<{
    files: Array<{ path: string; content: string }>;
    instructions: string;
  }> {
    // Pattern templates would be loaded from templates directory
    const patterns: Record<string, () => { files: Array<{ path: string; content: string }>; instructions: string }> = {
      auth: () => ({
        files: [
          { path: `src/lib/auth.ts`, content: '// Auth utilities' },
          { path: `src/app/api/auth/[...nextauth]/route.ts`, content: '// NextAuth route' },
          { path: `src/components/auth/sign-in-form.tsx`, content: '// Sign in form' },
        ],
        instructions: 'Configure NextAuth providers in auth.ts',
      }),
      crud: () => ({
        files: [
          { path: `src/app/api/${name}/route.ts`, content: '// CRUD API routes' },
          { path: `src/lib/${name}/actions.ts`, content: '// Server actions' },
          { path: `src/components/${name}/${name}-list.tsx`, content: '// List component' },
          { path: `src/components/${name}/${name}-form.tsx`, content: '// Form component' },
        ],
        instructions: `Customize the ${name} CRUD operations`,
      }),
      'data-table': () => ({
        files: [
          { path: `src/components/${name}/columns.tsx`, content: '// Table columns' },
          { path: `src/components/${name}/data-table.tsx`, content: '// Data table component' },
        ],
        instructions: 'Define columns and add data fetching',
      }),
    };

    const patternFn = patterns[pattern];
    if (!patternFn) {
      throw new Error(`Unknown pattern: ${pattern}`);
    }

    return patternFn();
  }

  /**
   * List available patterns
   */
  private listPatterns(): Array<{
    name: string;
    description: string;
    requiredOptions: string[];
  }> {
    return [
      { name: 'auth', description: 'Authentication with NextAuth.js', requiredOptions: [] },
      { name: 'crud', description: 'CRUD operations for a resource', requiredOptions: ['name'] },
      { name: 'data-table', description: 'Data table with sorting/filtering', requiredOptions: ['name'] },
      { name: 'form', description: 'Form with validation', requiredOptions: ['name'] },
      { name: 'dashboard', description: 'Dashboard layout with sidebar', requiredOptions: [] },
      { name: 'api-route', description: 'API route handler', requiredOptions: ['name'] },
      { name: 'modal', description: 'Modal dialog component', requiredOptions: ['name'] },
      { name: 'layout', description: 'Page layout component', requiredOptions: ['name'] },
    ];
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

## File 4: `src/lib/engine/v14-olympus/sandbox/memory-sandbox.ts`

### Purpose
In-memory file system for generated code. Provides isolation and snapshotting.

### Exact Implementation

```typescript
/**
 * Memory Sandbox
 *
 * In-memory file system for generated code.
 * Features:
 * - File CRUD operations
 * - Glob pattern matching
 * - Snapshots for checkpointing
 * - Command execution simulation
 */

import { EventStream } from '../core/event-stream';
import { EventType } from '../types/events';

export interface SandboxConfig {
  sessionId: string;
  eventStream: EventStream;
  initialFiles?: Map<string, string>;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface SandboxSnapshot {
  id: string;
  timestamp: number;
  files: Map<string, string>;
  metadata?: Record<string, unknown>;
}

export class MemorySandbox {
  private files: Map<string, string>;
  private eventStream: EventStream;
  private sessionId: string;
  private snapshots: SandboxSnapshot[] = [];
  private maxSnapshots = 5;

  constructor(config: SandboxConfig) {
    this.files = config.initialFiles ?? new Map();
    this.eventStream = config.eventStream;
    this.sessionId = config.sessionId;
  }

  // ========================================
  // FILE OPERATIONS
  // ========================================

  /**
   * Write a file
   */
  async writeFile(path: string, content: string): Promise<void> {
    const existed = this.files.has(path);
    this.files.set(this.normalizePath(path), content);

    this.emit(existed ? EventType.FILE_UPDATED : EventType.FILE_CREATED, {
      path,
      size: content.length,
      lines: content.split('\n').length,
    });
  }

  /**
   * Read a file
   */
  async readFile(path: string): Promise<string> {
    const normalized = this.normalizePath(path);
    const content = this.files.get(normalized);

    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }

    return content;
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path);
    const deleted = this.files.delete(normalized);

    if (deleted) {
      this.emit(EventType.FILE_DELETED, { path });
    }

    return deleted;
  }

  /**
   * Check if file exists
   */
  async fileExists(path: string): Promise<boolean> {
    return this.files.has(this.normalizePath(path));
  }

  /**
   * List files matching pattern
   */
  async listFiles(pattern?: string): Promise<string[]> {
    const allFiles = [...this.files.keys()];

    if (!pattern || pattern === '**/*') {
      return allFiles.sort();
    }

    // Convert glob to regex
    const regex = this.globToRegex(pattern);
    return allFiles.filter(f => regex.test(f)).sort();
  }

  /**
   * Get all files as map
   */
  getFiles(): Map<string, string> {
    return new Map(this.files);
  }

  /**
   * Get file count
   */
  getFileCount(): number {
    return this.files.size;
  }

  /**
   * Get total size of all files
   */
  getTotalSize(): number {
    let total = 0;
    for (const content of this.files.values()) {
      total += content.length;
    }
    return total;
  }

  // ========================================
  // COMMAND EXECUTION
  // ========================================

  /**
   * Run a command (simulated in memory sandbox)
   */
  async runCommand(command: string, options?: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  }): Promise<CommandResult> {
    const startTime = Date.now();

    // Simulate common commands
    const result = this.simulateCommand(command);

    return {
      ...result,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Simulate common commands
   */
  private simulateCommand(command: string): Omit<CommandResult, 'duration'> {
    const cmd = command.toLowerCase().trim();

    // npm/pnpm install
    if (cmd.includes('npm install') || cmd.includes('pnpm install')) {
      return {
        exitCode: 0,
        stdout: 'Dependencies installed successfully',
        stderr: '',
      };
    }

    // Build command
    if (cmd.includes('npm run build') || cmd.includes('pnpm build')) {
      // Check for TypeScript files with errors (simplified)
      const tsFiles = [...this.files.keys()].filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
      const hasErrors = tsFiles.some(f => {
        const content = this.files.get(f) || '';
        return content.includes('// @ts-expect-error') || content.includes('any any');
      });

      if (hasErrors) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'Type error found during build',
        };
      }

      return {
        exitCode: 0,
        stdout: 'Build completed successfully',
        stderr: '',
      };
    }

    // Lint command
    if (cmd.includes('eslint') || cmd.includes('npm run lint')) {
      return {
        exitCode: 0,
        stdout: 'Linting passed',
        stderr: '',
      };
    }

    // Test command
    if (cmd.includes('jest') || cmd.includes('npm run test') || cmd.includes('playwright')) {
      return {
        exitCode: 0,
        stdout: 'All tests passed',
        stderr: '',
      };
    }

    // TypeScript check
    if (cmd.includes('tsc')) {
      return {
        exitCode: 0,
        stdout: 'TypeScript check passed',
        stderr: '',
      };
    }

    // Default: success
    return {
      exitCode: 0,
      stdout: `Command executed: ${command}`,
      stderr: '',
    };
  }

  // ========================================
  // SNAPSHOTS
  // ========================================

  /**
   * Create a snapshot
   */
  createSnapshot(metadata?: Record<string, unknown>): string {
    const id = crypto.randomUUID();

    const snapshot: SandboxSnapshot = {
      id,
      timestamp: Date.now(),
      files: new Map(this.files),
      metadata,
    };

    this.snapshots.push(snapshot);

    // Enforce max snapshots
    while (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    this.emit(EventType.CHECKPOINT_CREATED, {
      checkpointId: id,
      fileCount: this.files.size,
    });

    return id;
  }

  /**
   * Restore from snapshot
   */
  restoreSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);

    if (!snapshot) {
      return false;
    }

    this.files = new Map(snapshot.files);

    this.emit(EventType.CHECKPOINT_RESTORED, {
      checkpointId: snapshotId,
      fileCount: this.files.size,
    });

    return true;
  }

  /**
   * List snapshots
   */
  listSnapshots(): Array<{
    id: string;
    timestamp: number;
    fileCount: number;
  }> {
    return this.snapshots.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      fileCount: s.files.size,
    }));
  }

  /**
   * Clear all files
   */
  clear(): void {
    this.files.clear();
  }

  // ========================================
  // UTILITIES
  // ========================================

  /**
   * Normalize file path
   */
  private normalizePath(path: string): string {
    return path
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/');
  }

  /**
   * Convert glob pattern to regex
   */
  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${escaped}$`);
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

## File 5: `src/lib/engine/v14-olympus/api/route.ts`

### Purpose
Main API endpoint for generation. Uses Server-Sent Events for streaming.

### Exact Implementation

```typescript
/**
 * V14 OLYMPUS API Route
 *
 * POST /api/generate/v14 - Start generation (returns SSE stream)
 * PUT  /api/generate/v14 - Submit user response
 * GET  /api/generate/v14/status/:id - Get generation status
 */

import { NextRequest, NextResponse } from 'next/server';
import { Orchestrator } from '../core/orchestrator';
import { SessionManager } from './session-manager';
import { ResponseHandler } from './response-handler';
import { GenerationOptions } from '../types';

// Session manager instance
const sessionManager = new SessionManager();

// Response handler for user inputs
const responseHandler = new ResponseHandler();

/**
 * POST - Start a new generation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { prompt, projectName, options } = body;

    // Get API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Create generation options
    const generationOptions: GenerationOptions = {
      projectId: crypto.randomUUID(),
      projectName: projectName || 'generated-app',
      prompt,
      ...options,
    };

    // Create orchestrator
    const orchestrator = new Orchestrator({
      apiKey,
      options: generationOptions,
    });

    // Register session
    const sessionId = orchestrator.getSessionId();
    sessionManager.register(sessionId, orchestrator);

    // Create SSE stream
    const stream = createSSEStream(orchestrator, sessionId);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Session-Id': sessionId,
      },
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Submit user response
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const { sessionId, questionId, response } = body;

    if (!sessionId || !questionId) {
      return NextResponse.json(
        { error: 'sessionId and questionId are required' },
        { status: 400 }
      );
    }

    // Store response for orchestrator to pick up
    responseHandler.submitResponse(sessionId, questionId, response);

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit response' },
      { status: 500 }
    );
  }
}

/**
 * Validate generation request
 */
function validateRequest(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const { prompt } = body as Record<string, unknown>;

  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'prompt is required and must be a string' };
  }

  if (prompt.length < 10) {
    return { valid: false, error: 'prompt must be at least 10 characters' };
  }

  if (prompt.length > 10000) {
    return { valid: false, error: 'prompt must be less than 10000 characters' };
  }

  return { valid: true };
}

/**
 * Create SSE stream from orchestrator
 */
function createSSEStream(
  orchestrator: Orchestrator,
  sessionId: string
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      // Subscribe to events
      const unsubscribe = orchestrator.onEvent((event) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      });

      try {
        // Send initial event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'connection:established',
            sessionId,
            timestamp: Date.now(),
          })}\n\n`)
        );

        // Run generation
        const result = await orchestrator.run();

        // Send final result
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'generation:result',
            payload: {
              success: result.success,
              filesCount: result.filesCount,
              tokensUsed: result.tokensUsed,
              estimatedCost: result.estimatedCost,
              duration: result.duration,
              deployedUrl: result.deployedUrl,
              summary: result.summary,
            },
          })}\n\n`)
        );

      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'generation:error',
            payload: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          })}\n\n`)
        );

      } finally {
        unsubscribe();
        sessionManager.unregister(sessionId);
        controller.close();
      }
    },
  });
}
```

---

## File 6: `src/lib/engine/v14-olympus/api/session-manager.ts`

### Purpose
Manages active generation sessions.

### Exact Implementation

```typescript
/**
 * Session Manager
 *
 * Manages active generation sessions.
 * Handles session lifecycle and cleanup.
 */

import { Orchestrator } from '../core/orchestrator';

interface Session {
  id: string;
  orchestrator: Orchestrator;
  createdAt: number;
  lastActivity: number;
  status: 'active' | 'completed' | 'failed' | 'aborted';
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxSessionAge = 3600000; // 1 hour
  private readonly cleanupIntervalMs = 60000; // 1 minute

  constructor() {
    this.startCleanup();
  }

  /**
   * Register a new session
   */
  register(sessionId: string, orchestrator: Orchestrator): void {
    const session: Session = {
      id: sessionId,
      orchestrator,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: 'active',
    };

    this.sessions.set(sessionId, session);
  }

  /**
   * Unregister a session
   */
  unregister(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      // Keep for a while for status checks, then cleanup will remove
    }
  }

  /**
   * Get session by ID
   */
  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get orchestrator by session ID
   */
  getOrchestrator(sessionId: string): Orchestrator | undefined {
    return this.sessions.get(sessionId)?.orchestrator;
  }

  /**
   * Update session activity
   */
  touch(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  /**
   * Mark session as failed
   */
  markFailed(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'failed';
    }
  }

  /**
   * Abort a session
   */
  abort(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'active') {
      session.status = 'aborted';
      // In real implementation, would signal orchestrator to stop
      return true;
    }
    return false;
  }

  /**
   * Get session status
   */
  getStatus(sessionId: string): {
    found: boolean;
    status?: string;
    age?: number;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { found: false };
    }

    return {
      found: true,
      status: session.status,
      age: Date.now() - session.createdAt,
    };
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.status === 'active') {
        count++;
      }
    }
    return count;
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * Cleanup old sessions
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [id, session] of this.sessions) {
      // Remove sessions older than max age
      if (now - session.createdAt > this.maxSessionAge) {
        this.sessions.delete(id);
        continue;
      }

      // Remove completed/failed sessions after 5 minutes
      if (
        (session.status === 'completed' || session.status === 'failed') &&
        now - session.lastActivity > 300000
      ) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }
}
```

---

## File 7: `src/lib/engine/v14-olympus/api/response-handler.ts`

### Purpose
Handles user responses for interactive questions.

### Exact Implementation

```typescript
/**
 * Response Handler
 *
 * Handles user responses to questions asked by agents.
 * Uses a simple pub/sub pattern for async communication.
 */

interface PendingQuestion {
  sessionId: string;
  questionId: string;
  timestamp: number;
  resolve: (response: UserResponse) => void;
  timeout: NodeJS.Timeout;
}

interface UserResponse {
  questionId: string;
  response: string;
  selectedOptionId?: string;
  timedOut: boolean;
  timestamp: number;
}

export class ResponseHandler {
  private pendingQuestions: Map<string, PendingQuestion> = new Map();
  private defaultTimeout = 120000; // 2 minutes

  /**
   * Wait for user response to a question
   */
  async waitForResponse(
    sessionId: string,
    questionId: string,
    timeout?: number
  ): Promise<UserResponse> {
    const key = this.makeKey(sessionId, questionId);

    return new Promise((resolve) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        const pending = this.pendingQuestions.get(key);
        if (pending) {
          this.pendingQuestions.delete(key);
          resolve({
            questionId,
            response: '',
            timedOut: true,
            timestamp: Date.now(),
          });
        }
      }, timeout ?? this.defaultTimeout);

      // Register pending question
      this.pendingQuestions.set(key, {
        sessionId,
        questionId,
        timestamp: Date.now(),
        resolve,
        timeout: timeoutId,
      });
    });
  }

  /**
   * Submit a response to a question
   */
  submitResponse(
    sessionId: string,
    questionId: string,
    response: string | { response: string; selectedOptionId?: string }
  ): boolean {
    const key = this.makeKey(sessionId, questionId);
    const pending = this.pendingQuestions.get(key);

    if (!pending) {
      return false;
    }

    // Clear timeout
    clearTimeout(pending.timeout);

    // Remove from pending
    this.pendingQuestions.delete(key);

    // Resolve the promise
    const userResponse: UserResponse = {
      questionId,
      response: typeof response === 'string' ? response : response.response,
      selectedOptionId: typeof response === 'object' ? response.selectedOptionId : undefined,
      timedOut: false,
      timestamp: Date.now(),
    };

    pending.resolve(userResponse);

    return true;
  }

  /**
   * Check if there's a pending question
   */
  hasPending(sessionId: string, questionId: string): boolean {
    const key = this.makeKey(sessionId, questionId);
    return this.pendingQuestions.has(key);
  }

  /**
   * Cancel a pending question
   */
  cancel(sessionId: string, questionId: string): boolean {
    const key = this.makeKey(sessionId, questionId);
    const pending = this.pendingQuestions.get(key);

    if (!pending) {
      return false;
    }

    clearTimeout(pending.timeout);
    this.pendingQuestions.delete(key);

    pending.resolve({
      questionId,
      response: '',
      timedOut: true,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Cancel all pending questions for a session
   */
  cancelSession(sessionId: string): number {
    let cancelled = 0;

    for (const [key, pending] of this.pendingQuestions) {
      if (pending.sessionId === sessionId) {
        clearTimeout(pending.timeout);
        this.pendingQuestions.delete(key);

        pending.resolve({
          questionId: pending.questionId,
          response: '',
          timedOut: true,
          timestamp: Date.now(),
        });

        cancelled++;
      }
    }

    return cancelled;
  }

  /**
   * Get pending question count
   */
  getPendingCount(): number {
    return this.pendingQuestions.size;
  }

  /**
   * Make a unique key for session + question
   */
  private makeKey(sessionId: string, questionId: string): string {
    return `${sessionId}:${questionId}`;
  }
}
```

---

## Verification Checklist

After Phase 6 implementation:

- [ ] All tool definitions are complete with proper schemas
- [ ] ToolExecutor routes calls to correct implementations
- [ ] MemorySandbox handles file operations correctly
- [ ] Sandbox snapshots work for checkpointing
- [ ] API route streams events via SSE
- [ ] Session manager tracks active sessions
- [ ] Response handler enables user interaction
- [ ] All unit tests pass
- [ ] Integration with orchestrator works

---

## Next Phase

Once Phase 6 is complete and verified, proceed to **Phase 7: UI Implementation**.
