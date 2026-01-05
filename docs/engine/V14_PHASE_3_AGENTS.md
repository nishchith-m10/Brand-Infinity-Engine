# V14 OLYMPUS - Phase 3: Agent Implementation

## Overview

Phase 3 implements all 6 active agents (Hermes, Athena, Hephaestus, Apollo, Artemis) plus the Zeus orchestrator. Each agent extends a common base class and has specific tools and responsibilities.

**Files to Create:** 8 (base + 6 agents + orchestrator)
**Estimated Complexity:** Very High
**Dependencies:** Phase 1 (types, events, config), Phase 2 (knowledge, memory)

---

## Agent Architecture Overview

```
                    ┌─────────────┐
                    │    ZEUS     │
                    │ Orchestrator│
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌─────▼─────┐       ┌────▼────┐
   │ HERMES  │       │  ATHENA   │       │HEPHAESTUS│
   │ Intake  │──────▶│ Research  │──────▶│ Builder  │
   └─────────┘       └───────────┘       └────┬─────┘
                                              │
                           ┌──────────────────┤
                           │                  │
                      ┌────▼────┐        ┌────▼────┐
                      │ APOLLO  │        │ ARTEMIS │
                      │ Review  │        │ Deploy  │
                      └─────────┘        └─────────┘
```

---

## File 1: `src/lib/engine/v14-olympus/agents/base-agent.ts`

### Purpose
Abstract base class that all agents extend. Provides shared functionality for LLM calls, tool execution, knowledge access, and event emission.

### Exact Interface

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuid } from 'uuid';
import {
  AgentName,
  AgentContext,
  AgentState,
  AgentResult,
  AgentError,
  Tool,
  ToolResult,
} from '../types';
import {
  V14_AGENT_BUDGETS,
  V14_CONFIDENCE_WEIGHTS,
  V14_CONFIDENCE_THRESHOLDS,
  V14_MODEL_CONFIG,
} from '../config';
import { EventType } from '../types/events';

// Tool Definition for Claude
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Message Types
export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

// LLM Response
export interface LLMResponse {
  content: ContentBlock[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Confidence Factors
export interface ConfidenceFactors {
  promptClarity: number;       // 0-1: How clear is the requirement?
  domainFamiliarity: number;   // 0-1: Do we have patterns for this?
  technicalCertainty: number;  // 0-1: Are tech choices clear?
  scopeDefinition: number;     // 0-1: Is scope well-defined?
  edgeCaseCoverage: number;    // 0-1: Are edge cases identified?
}

export abstract class BaseAgent {
  // Agent identity
  protected abstract readonly name: AgentName;
  protected abstract readonly description: string;

  // Configuration
  protected model: string;
  protected maxCalls: number;
  protected maxTokens: number;

  // State
  protected context: AgentContext;
  protected state: AgentState;
  protected callsMade: number = 0;
  protected tokensUsed: number = 0;
  protected startTime: number = 0;

  // Anthropic client
  protected client: Anthropic;

  constructor(context: AgentContext, apiKey: string) {
    this.context = context;
    this.client = new Anthropic({ apiKey });

    // Set budget from config
    const budget = V14_AGENT_BUDGETS[this.name];
    this.model = budget.model;
    this.maxCalls = budget.maxCalls;
    this.maxTokens = budget.maxTokens;

    // Initialize state
    this.state = {
      name: this.name,
      status: 'idle',
      progress: 0,
      iterationsUsed: 0,
      tokensUsed: 0,
      callsMade: 0,
    };
  }

  // Abstract methods that each agent must implement
  abstract getSystemPrompt(): string;
  abstract getTools(): ToolDefinition[];
  abstract run(): Promise<AgentResult>;

  // Get current state
  getState(): AgentState {
    return { ...this.state };
  }

  // Main LLM call method
  protected async callLLM(messages: Message[]): Promise<LLMResponse> {
    // Check budget
    if (this.callsMade >= this.maxCalls) {
      throw this.createError('AGENT_BUDGET_EXCEEDED', `Max calls (${this.maxCalls}) exceeded`);
    }

    // Emit thinking event
    this.emit(EventType.AGENT_THINKING, {
      agent: this.name,
      message: 'Processing...',
    });

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        system: this.getSystemPrompt(),
        tools: this.getTools(),
        messages: messages as Anthropic.MessageParam[],
      });

      // Track usage
      this.callsMade++;
      this.tokensUsed += response.usage.input_tokens + response.usage.output_tokens;

      // Record in budget tracker
      this.context.budget.recordUsage(
        this.name,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      // Update state
      this.state.callsMade = this.callsMade;
      this.state.tokensUsed = this.tokensUsed;

      return {
        content: response.content as ContentBlock[],
        stopReason: response.stop_reason as LLMResponse['stopReason'],
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown LLM error';
      throw this.createError('LLM_API_ERROR', message);
    }
  }

  // Execute a tool
  protected async executeTool(name: string, args: unknown): Promise<ToolResult> {
    // Emit tool call event
    this.emit(EventType.AGENT_TOOL_CALL, {
      agent: this.name,
      tool: name,
      args,
    });

    const startTime = Date.now();
    let result: ToolResult;

    try {
      result = await this.handleToolCall(name, args);
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }

    // Emit tool result event
    this.emit(EventType.AGENT_TOOL_RESULT, {
      agent: this.name,
      tool: name,
      success: result.success,
      duration: Date.now() - startTime,
      error: result.error,
    });

    return result;
  }

  // Tool handler - override in subclasses for specific tools
  protected async handleToolCall(name: string, args: unknown): Promise<ToolResult> {
    // Common tools available to all agents
    switch (name) {
      case 'read_knowledge':
        return this.toolReadKnowledge(args as { path: string });

      case 'write_knowledge':
        return this.toolWriteKnowledge(args as { path: string; content: string; version?: number });

      case 'search_knowledge':
        return this.toolSearchKnowledge(args as { query: string; limit?: number });

      case 'emit_progress':
        return this.toolEmitProgress(args as { progress: number; message: string });

      default:
        return {
          success: false,
          error: `Unknown tool: ${name}`,
        };
    }
  }

  // Common tool implementations

  protected async toolReadKnowledge(args: { path: string }): Promise<ToolResult> {
    const doc = await this.context.knowledge.read(args.path);
    if (!doc) {
      return { success: false, error: `Document not found: ${args.path}` };
    }
    return { success: true, data: doc.content };
  }

  protected async toolWriteKnowledge(args: {
    path: string;
    content: string;
    version?: number;
  }): Promise<ToolResult> {
    const result = await this.context.knowledge.write(args.path, args.content, args.version);
    if (!result.success) {
      return { success: false, error: result.error?.message };
    }
    return { success: true, data: { version: result.version } };
  }

  protected async toolSearchKnowledge(args: {
    query: string;
    limit?: number;
  }): Promise<ToolResult> {
    const results = await this.context.knowledge.search(args.query, { limit: args.limit ?? 5 });
    return {
      success: true,
      data: results.map(r => ({ path: r.path, snippet: r.snippet, relevance: r.relevance })),
    };
  }

  protected async toolEmitProgress(args: {
    progress: number;
    message: string;
  }): Promise<ToolResult> {
    this.state.progress = args.progress;
    this.emit(EventType.AGENT_PROGRESS, {
      agent: this.name,
      progress: args.progress,
      message: args.message,
      tokensUsed: this.tokensUsed,
    });
    return { success: true };
  }

  // Calculate confidence score
  protected calculateConfidence(factors: Partial<ConfidenceFactors>): number {
    const weights = V14_CONFIDENCE_WEIGHTS;
    let score = 0;
    let totalWeight = 0;

    for (const [factor, weight] of Object.entries(weights)) {
      const value = factors[factor as keyof ConfidenceFactors] ?? 0.5;
      score += value * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? score / totalWeight : 0.5;
  }

  // Determine if should ask user based on confidence
  protected shouldAskUser(confidence: number): boolean {
    return confidence < V14_CONFIDENCE_THRESHOLDS.ASK_REQUIRED;
  }

  // Ask user a question
  protected async askUser(question: string, options?: string[]): Promise<string> {
    const questionId = uuid();

    this.emit(EventType.USER_INPUT_REQUIRED, {
      questionId,
      type: options ? 'choice' : 'freeform',
      question,
      options,
      agent: this.name,
      reason: 'Clarification needed',
    });

    // Wait for response
    const response = await this.context.askUser({
      id: questionId,
      type: options ? 'choice' : 'freeform',
      question,
      options,
      required: true,
    });

    this.emit(EventType.USER_INPUT_RECEIVED, {
      questionId,
      response: response.response,
    });

    return response.response;
  }

  // Emit an event
  protected emit(type: EventType, payload: unknown): void {
    this.context.emit.emit({
      id: uuid(),
      type,
      timestamp: Date.now(),
      sessionId: this.context.sessionId,
      payload,
      metadata: {
        agent: this.name,
        phase: this.context.currentPhase,
      },
    });
  }

  // Create an error
  protected createError(code: string, message: string, recoverable: boolean = true): AgentError {
    return {
      code,
      message,
      recoverable,
    };
  }

  // Create the result
  protected createResult(
    success: boolean,
    data?: unknown,
    error?: AgentError
  ): AgentResult {
    return {
      success,
      agentName: this.name,
      phase: this.context.currentPhase,
      data,
      error,
      tokensUsed: this.tokensUsed,
      callsMade: this.callsMade,
      duration: Date.now() - this.startTime,
    };
  }

  // Start the agent
  protected start(): void {
    this.startTime = Date.now();
    this.state.status = 'active';
    this.state.startedAt = this.startTime;

    this.emit(EventType.AGENT_STARTED, {
      agent: this.name,
      phase: this.context.currentPhase,
    });
  }

  // Complete the agent
  protected complete(success: boolean): void {
    this.state.status = success ? 'complete' : 'error';
    this.state.completedAt = Date.now();

    this.emit(success ? EventType.AGENT_COMPLETED : EventType.AGENT_ERROR, {
      agent: this.name,
      success,
      duration: Date.now() - this.startTime,
      tokensUsed: this.tokensUsed,
      callsMade: this.callsMade,
    });
  }

  // Run the agentic loop (tool calling)
  protected async runAgentLoop(initialMessages: Message[]): Promise<{
    messages: Message[];
    finalResponse: string;
  }> {
    const messages = [...initialMessages];
    let iterations = 0;
    const maxIterations = 50;

    while (iterations < maxIterations) {
      iterations++;
      this.state.iterationsUsed = iterations;

      const response = await this.callLLM(messages);

      // Process response
      const assistantContent: ContentBlock[] = [];
      const toolResults: ContentBlock[] = [];
      let textResponse = '';

      for (const block of response.content) {
        if (block.type === 'text') {
          textResponse += block.text ?? '';
          assistantContent.push(block);
        } else if (block.type === 'tool_use') {
          assistantContent.push(block);

          // Execute tool
          const result = await this.executeTool(block.name!, block.input);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result.data ?? result.error),
            is_error: !result.success,
          });
        }
      }

      // Add assistant response to messages
      messages.push({
        role: 'assistant',
        content: assistantContent,
      });

      // If there were tool calls, add results and continue
      if (toolResults.length > 0) {
        messages.push({
          role: 'user',
          content: toolResults,
        });
        continue;
      }

      // No tool calls means we're done
      if (response.stopReason === 'end_turn') {
        return { messages, finalResponse: textResponse };
      }
    }

    throw this.createError('AGENT_LOOP_DETECTED', `Max iterations (${maxIterations}) exceeded`);
  }
}

// Tool result interface
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

---

## File 2: `src/lib/engine/v14-olympus/agents/hermes.ts`

### Purpose
Hermes is the intake agent responsible for parsing user prompts, extracting requirements, identifying ambiguities, and asking clarifying questions.

### Responsibilities
1. Parse user prompt
2. Extract explicit requirements
3. Infer implicit requirements
4. Identify ambiguities
5. Ask clarifying questions if confidence < 0.7
6. Write requirements document to knowledge store

### Exact Interface

```typescript
import { BaseAgent, ToolDefinition, Message, ToolResult } from './base-agent';
import { AgentResult, AgentContext } from '../types';
import { RequirementsDocument } from '../knowledge/schema';

export class HermesAgent extends BaseAgent {
  protected readonly name = 'hermes' as const;
  protected readonly description = 'Intake & clarification agent';

  constructor(context: AgentContext, apiKey: string) {
    super(context, apiKey);
  }

  getSystemPrompt(): string {
    return `You are Hermes, the intake agent for the Olympus app generation system.

Your role is to:
1. Parse user prompts and extract clear requirements
2. Identify both explicit requirements (stated) and implicit requirements (inferred)
3. Detect any ambiguities that could lead to incorrect implementations
4. Ask clarifying questions when confidence is low
5. Write a comprehensive requirements document

## Output Format

You must produce a structured requirements document with:
- Explicit requirements: Things the user directly stated
- Implicit requirements: Things reasonably inferred (e.g., "e-commerce" implies cart, checkout)
- Ambiguities: Unclear aspects that need clarification
- Constraints: Technical, budget, time, or scope constraints

## Confidence Assessment

Rate your confidence (0-1) based on:
- Prompt clarity: Is the request clear and specific?
- Scope definition: Is the scope well-bounded?
- Technical certainty: Are tech requirements clear?

If confidence < 0.7, use the ask_user tool to clarify.

## Important Rules
- NEVER make assumptions about ambiguous requirements
- ALWAYS ask before assuming
- Extract maximum information from the prompt
- Consider edge cases and error scenarios
- Think about authentication, authorization, data models

Current prompt: "${this.context.prompt}"
Project name: "${this.context.projectName}"`;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'ask_user',
        description: 'Ask the user a clarifying question',
        input_schema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question to ask',
            },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional multiple choice options',
            },
            context: {
              type: 'string',
              description: 'Why this clarification is needed',
            },
          },
          required: ['question'],
        },
      },
      {
        name: 'write_requirements',
        description: 'Write the requirements document',
        input_schema: {
          type: 'object',
          properties: {
            requirements: {
              type: 'object',
              description: 'The structured requirements document',
              properties: {
                explicit: { type: 'array' },
                implicit: { type: 'array' },
                ambiguities: { type: 'array' },
                constraints: { type: 'array' },
                confidence: { type: 'number' },
              },
            },
          },
          required: ['requirements'],
        },
      },
      {
        name: 'read_knowledge',
        description: 'Read from knowledge store',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to read' },
          },
          required: ['path'],
        },
      },
      {
        name: 'emit_progress',
        description: 'Emit progress update',
        input_schema: {
          type: 'object',
          properties: {
            progress: { type: 'number', description: 'Progress 0-100' },
            message: { type: 'string', description: 'Status message' },
          },
          required: ['progress', 'message'],
        },
      },
    ];
  }

  protected async handleToolCall(name: string, args: unknown): Promise<ToolResult> {
    switch (name) {
      case 'ask_user':
        return this.toolAskUser(args as {
          question: string;
          options?: string[];
          context?: string;
        });

      case 'write_requirements':
        return this.toolWriteRequirements(args as { requirements: unknown });

      default:
        return super.handleToolCall(name, args);
    }
  }

  private async toolAskUser(args: {
    question: string;
    options?: string[];
    context?: string;
  }): Promise<ToolResult> {
    try {
      const response = await this.askUser(args.question, args.options);
      return { success: true, data: { answer: response } };
    } catch (error) {
      return { success: false, error: 'Failed to get user response' };
    }
  }

  private async toolWriteRequirements(args: { requirements: unknown }): Promise<ToolResult> {
    const doc = {
      version: '1.0',
      type: 'requirements',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'hermes',
      updatedBy: 'hermes',
      prompt: this.context.prompt,
      ...args.requirements,
    };

    const result = await this.context.knowledge.write(
      '/requirements/main.json',
      JSON.stringify(doc, null, 2)
    );

    if (!result.success) {
      return { success: false, error: result.error?.message };
    }

    return { success: true, data: { path: '/requirements/main.json', version: result.version } };
  }

  async run(): Promise<AgentResult> {
    this.start();

    try {
      const initialMessage: Message = {
        role: 'user',
        content: `Analyze this prompt and create a comprehensive requirements document:

"${this.context.prompt}"

Project Name: ${this.context.projectName}

1. First, emit_progress at 10% with "Analyzing prompt..."
2. Extract all explicit requirements (things directly stated)
3. Infer implicit requirements (things reasonably expected)
4. Identify any ambiguities that need clarification
5. If confidence < 0.7, use ask_user to clarify before proceeding
6. Once clear, use write_requirements to save the document
7. Emit progress at 100% when complete`,
      };

      const { finalResponse } = await this.runAgentLoop([initialMessage]);

      this.complete(true);

      return this.createResult(true, {
        message: 'Requirements extracted successfully',
        response: finalResponse,
      });
    } catch (error) {
      const agentError = this.createError(
        'AGENT_FAILED',
        error instanceof Error ? error.message : 'Hermes failed',
        true
      );

      this.complete(false);

      return this.createResult(false, undefined, agentError);
    }
  }
}
```

---

## File 3: `src/lib/engine/v14-olympus/agents/athena.ts`

### Purpose
Athena is the research and architecture agent. She researches any domain dynamically, designs the architecture, and creates a validated plan.

### Responsibilities
1. Research domain (competitors, business rules, edge cases)
2. Research technical requirements
3. Design architecture (file structure, data models, APIs)
4. Create implementation plan
5. Validate plan covers 100% of requirements

### Key Tools
- `web_search`: Search the web for information
- `web_fetch`: Fetch and parse a specific URL
- `write_architecture`: Write architecture document
- `write_plan`: Write implementation plan
- `validate_coverage`: Verify all requirements are covered

### Exact Interface (Abbreviated)

```typescript
import { BaseAgent, ToolDefinition, Message, ToolResult } from './base-agent';
import { AgentResult } from '../types';
import { V14_RESEARCH_THRESHOLDS } from '../config';

export class AthenaAgent extends BaseAgent {
  protected readonly name = 'athena' as const;
  protected readonly description = 'Research & architecture agent';

  getSystemPrompt(): string {
    return `You are Athena, the research and architecture agent for Olympus.

Your role is to:
1. Research the domain thoroughly (ANY domain - you have no limits)
2. Understand business rules, competitors, edge cases
3. Design a complete architecture
4. Create an implementation plan that covers 100% of requirements

## Research Process
1. Search for domain information
2. Find competitors and analyze their features
3. Identify standard business rules
4. Discover edge cases to handle
5. Rate research confidence (need ${V14_RESEARCH_THRESHOLDS.minSources}+ sources)

## Architecture Design
1. Define tech stack decisions with rationale
2. Create file structure
3. Design data models
4. Specify API endpoints
5. List integrations needed

## Plan Validation
Before completing, verify EVERY requirement has a task assigned.
Use the validate_coverage tool to prove 100% coverage.

Current requirements are at: /requirements/main.json`;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'web_search',
        description: 'Search the web for information',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            type: {
              type: 'string',
              enum: ['general', 'documentation', 'competitor', 'best_practices'],
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'web_fetch',
        description: 'Fetch and parse a URL',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to fetch' },
            extract: { type: 'string', description: 'What to extract from the page' },
          },
          required: ['url'],
        },
      },
      {
        name: 'write_architecture',
        description: 'Write the architecture document',
        input_schema: {
          type: 'object',
          properties: {
            architecture: {
              type: 'object',
              description: 'Complete architecture specification',
            },
          },
          required: ['architecture'],
        },
      },
      {
        name: 'write_plan',
        description: 'Write the implementation plan',
        input_schema: {
          type: 'object',
          properties: {
            plan: {
              type: 'object',
              description: 'Implementation plan with tasks',
            },
          },
          required: ['plan'],
        },
      },
      {
        name: 'validate_coverage',
        description: 'Validate that plan covers all requirements',
        input_schema: {
          type: 'object',
          properties: {
            planPath: { type: 'string' },
            requirementsPath: { type: 'string' },
          },
          required: ['planPath', 'requirementsPath'],
        },
      },
      {
        name: 'read_knowledge',
        description: 'Read from knowledge store',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
          },
          required: ['path'],
        },
      },
      {
        name: 'emit_progress',
        description: 'Emit progress update',
        input_schema: {
          type: 'object',
          properties: {
            progress: { type: 'number' },
            message: { type: 'string' },
          },
          required: ['progress', 'message'],
        },
      },
    ];
  }

  // Implementation continues with research confidence tracking,
  // competitor analysis, and coverage validation...

  async run(): Promise<AgentResult> {
    this.start();

    try {
      // Read requirements first
      const reqDoc = await this.context.knowledge.read('/requirements/main.json');
      if (!reqDoc) {
        throw this.createError('KNOWLEDGE_NOT_FOUND', 'Requirements not found');
      }

      const requirements = JSON.parse(reqDoc.content);

      // Run research and architecture loop
      const { finalResponse } = await this.runAgentLoop([{
        role: 'user',
        content: `Research and design architecture for this project.

Requirements:
${JSON.stringify(requirements, null, 2)}

Steps:
1. Emit progress at 5% - "Starting research..."
2. Use web_search to research the domain (at least 3 searches)
3. Emit progress at 30% - "Research complete, designing architecture..."
4. Design comprehensive architecture (file structure, data models, APIs)
5. Use write_architecture to save it to /architecture/main.json
6. Emit progress at 60% - "Creating implementation plan..."
7. Create implementation plan with tasks for EVERY requirement
8. Use write_plan to save to /plan/main.json
9. Use validate_coverage to verify 100% requirement coverage
10. Emit progress at 100% when complete

If coverage < 100%, add more tasks until all requirements are covered.`,
      }]);

      this.complete(true);

      return this.createResult(true, {
        message: 'Architecture and plan created',
        response: finalResponse,
      });
    } catch (error) {
      const agentError = this.createError(
        'AGENT_FAILED',
        error instanceof Error ? error.message : 'Athena failed'
      );
      this.complete(false);
      return this.createResult(false, undefined, agentError);
    }
  }
}
```

---

## File 4: `src/lib/engine/v14-olympus/agents/hephaestus.ts`

### Purpose
Hephaestus is the builder agent. He generates code files based on the architecture and plan, running incremental builds and fixing errors.

### Responsibilities
1. Read architecture and plan
2. Generate code files in order
3. Run incremental builds to catch errors early
4. Fix any build/type errors immediately
5. Apply patterns from pattern library when available

### Key Tools
- `write_file`: Write a file to the sandbox
- `read_file`: Read a file from the sandbox
- `run_command`: Run shell commands (build, lint)
- `apply_pattern`: Apply a pattern template
- `fix_error`: Analyze and fix an error

### Interface Structure

```typescript
export class HephaestusAgent extends BaseAgent {
  protected readonly name = 'hephaestus' as const;
  protected readonly description = 'Code generation agent';

  getSystemPrompt(): string {
    return `You are Hephaestus, the master builder for Olympus.

Your role is to:
1. Generate high-quality, production-ready code
2. Follow the architecture specification exactly
3. Implement every task in the plan
4. Run builds frequently to catch errors early
5. Fix any errors immediately before continuing

## Code Quality Standards
- Use TypeScript with strict mode
- Follow Next.js 14+ best practices
- Use Tailwind CSS for styling
- Use shadcn/ui components
- Write clean, documented code
- Handle errors properly
- Consider security best practices

## Build Process
After every 3-5 files, run a build to check for errors.
If errors occur, fix them immediately using fix_error.

## File Structure
Follow the architecture document at /architecture/main.json exactly.
Generate files in the order specified in /plan/main.json.

## Pattern Library
When implementing common patterns (auth, data tables, forms),
use apply_pattern to get a template, then customize it.`;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'write_file',
        description: 'Write a file to the project',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to project root' },
            content: { type: 'string', description: 'File content' },
            description: { type: 'string', description: 'What this file does' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'read_file',
        description: 'Read a file from the project',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
          },
          required: ['path'],
        },
      },
      {
        name: 'run_command',
        description: 'Run a shell command (build, lint, etc)',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to run' },
            description: { type: 'string', description: 'What this command does' },
          },
          required: ['command'],
        },
      },
      {
        name: 'apply_pattern',
        description: 'Apply a pattern template',
        input_schema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              enum: ['auth', 'data-table', 'form', 'dashboard', 'api-route', 'crud'],
            },
            customization: { type: 'object', description: 'Customization parameters' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'fix_error',
        description: 'Analyze and fix a build/type error',
        input_schema: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'The error message' },
            file: { type: 'string', description: 'The file with the error' },
          },
          required: ['error'],
        },
      },
      {
        name: 'read_knowledge',
        description: 'Read from knowledge store',
        input_schema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
      {
        name: 'emit_progress',
        description: 'Emit progress update',
        input_schema: {
          type: 'object',
          properties: {
            progress: { type: 'number' },
            message: { type: 'string' },
          },
          required: ['progress', 'message'],
        },
      },
    ];
  }

  // Implementation with iterative building,
  // error detection, and pattern application...
}
```

---

## File 5: `src/lib/engine/v14-olympus/agents/apollo.ts`

### Purpose
Apollo is the verification agent. He runs static analysis, type checking, generates tests from requirements (not code), and verifies deployment readiness.

### Responsibilities
1. Run ESLint (static analysis)
2. Run TypeScript type checker
3. Generate tests from requirements (independent of code)
4. Run tests with Playwright/Jest
5. Security scanning
6. Verify requirement coverage

---

## File 6: `src/lib/engine/v14-olympus/agents/artemis.ts`

### Purpose
Artemis is the deployment agent. She handles production builds, environment configuration, Vercel deployment, and smoke testing.

### Responsibilities
1. Prepare production build
2. Configure environment variables
3. Deploy to Vercel
4. Verify deployment success
5. Run smoke tests on live URL

---

## File 7: `src/lib/engine/v14-olympus/core/orchestrator.ts`

### Purpose
Zeus orchestrator manages the entire generation lifecycle, coordinating agents, handling phase transitions, and managing recovery.

### Exact Interface

```typescript
import { v4 as uuid } from 'uuid';
import {
  AgentName,
  AgentContext,
  AgentResult,
  GenerationOptions,
  GenerationResult,
} from '../types';
import { EventStream } from './event-stream';
import { BudgetTracker } from './budget-tracker';
import { StateMachine } from './state-machine';
import { CheckpointManager } from './checkpoint-manager';
import { KnowledgeStore } from '../knowledge/store';
import { MemorySandbox } from '../sandbox/memory-sandbox';
import { V14_PHASES, V14_PHASE_TRANSITIONS } from '../config';
import { EventType } from '../types/events';

// Agent imports
import { HermesAgent } from '../agents/hermes';
import { AthenaAgent } from '../agents/athena';
import { HephaestusAgent } from '../agents/hephaestus';
import { ApolloAgent } from '../agents/apollo';
import { ArtemisAgent } from '../agents/artemis';

export interface OrchestratorConfig {
  apiKey: string;
  options: GenerationOptions;
}

export class Orchestrator {
  private sessionId: string;
  private options: GenerationOptions;
  private apiKey: string;

  // Core systems
  private eventStream: EventStream;
  private budget: BudgetTracker;
  private stateMachine: StateMachine;
  private checkpoints: CheckpointManager;
  private knowledge: KnowledgeStore;
  private sandbox: MemorySandbox;

  // Agents (created on demand)
  private agents: Map<AgentName, BaseAgent>;

  constructor(config: OrchestratorConfig) {
    this.sessionId = uuid();
    this.options = config.options;
    this.apiKey = config.apiKey;
    this.agents = new Map();

    // Initialize core systems
    this.eventStream = new EventStream();
    this.budget = new BudgetTracker({
      sessionId: this.sessionId,
      eventStream: this.eventStream,
    });
    this.stateMachine = new StateMachine(
      V14_PHASES.IDLE,
      V14_PHASE_TRANSITIONS
    );
    this.checkpoints = new CheckpointManager({
      sessionId: this.sessionId,
      eventStream: this.eventStream,
    });
    this.knowledge = new KnowledgeStore({
      sessionId: this.sessionId,
      eventStream: this.eventStream,
    });
    this.sandbox = new MemorySandbox({
      sessionId: this.sessionId,
      eventStream: this.eventStream,
    });
  }

  // Subscribe to events (for SSE streaming)
  onEvent(handler: (event: OlympusEvent) => void): () => void {
    return this.eventStream.onAny(handler);
  }

  // Main orchestration method
  async run(): Promise<GenerationResult> {
    const startTime = Date.now();

    this.emit(EventType.GENERATION_STARTED, {
      projectId: this.options.projectId,
      projectName: this.options.projectName,
      prompt: this.options.prompt,
    });

    try {
      // Phase 1: Intake
      await this.runPhase('intake', async () => {
        const hermes = this.getAgent('hermes');
        const result = await hermes.run();
        if (!result.success) throw new Error(result.error?.message);
      });

      // Phase 2: Research
      await this.runPhase('research', async () => {
        const athena = this.getAgent('athena');
        const result = await athena.run();
        if (!result.success) throw new Error(result.error?.message);
      });

      // Phase 3: Plan Validation
      await this.runPhase('plan_validation', async () => {
        const coverage = await this.validatePlanCoverage();
        if (!coverage.isComplete) {
          // Go back to architecture
          this.stateMachine.transition('architecture', 'Incomplete coverage');
          // Re-run Athena
          const athena = this.getAgent('athena');
          await athena.run();
          // Re-validate
          const retry = await this.validatePlanCoverage();
          if (!retry.isComplete) {
            throw new Error(`Plan only covers ${retry.percentage}% of requirements`);
          }
        }
      });

      // Phase 4: Building
      await this.runPhase('building', async () => {
        const hephaestus = this.getAgent('hephaestus');
        const result = await hephaestus.run();
        if (!result.success) throw new Error(result.error?.message);
      });

      // Phase 5: Verification
      await this.runPhase('verification', async () => {
        const apollo = this.getAgent('apollo');
        const result = await apollo.run();
        if (!result.success) {
          // Go back to building to fix
          this.stateMachine.transition('building', 'Verification failed');
          // Run targeted fixes
          await this.runFixLoop(result.data as { errors: string[] });
        }
      });

      // Phase 6: Deployment (if not skipped)
      let deployedUrl: string | undefined;
      if (!this.options.skipDeploy) {
        await this.runPhase('deployment', async () => {
          const artemis = this.getAgent('artemis');
          const result = await artemis.run();
          if (!result.success) throw new Error(result.error?.message);
          deployedUrl = (result.data as { url: string }).url;
        });
      }

      // Complete
      this.stateMachine.transition('complete', 'Success');

      const result: GenerationResult = {
        success: true,
        projectId: this.options.projectId,
        files: this.sandbox.getFiles(),
        filesCount: this.sandbox.getFileCount(),
        tokensUsed: this.budget.getTotalBudget().totalTokens,
        estimatedCost: this.budget.getTotalBudget().estimatedCost,
        duration: Date.now() - startTime,
        deployedUrl,
        summary: 'Generation completed successfully',
        warnings: [],
      };

      this.emit(EventType.GENERATION_COMPLETED, result);

      return result;

    } catch (error) {
      this.stateMachine.transition('failed', error instanceof Error ? error.message : 'Unknown error');

      this.emit(EventType.GENERATION_FAILED, {
        error: error instanceof Error ? error.message : 'Unknown error',
        phase: this.stateMachine.getCurrentPhase(),
      });

      return {
        success: false,
        projectId: this.options.projectId,
        files: this.sandbox.getFiles(),
        filesCount: this.sandbox.getFileCount(),
        tokensUsed: this.budget.getTotalBudget().totalTokens,
        estimatedCost: this.budget.getTotalBudget().estimatedCost,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Generation failed',
        warnings: [],
      };
    }
  }

  private async runPhase(phase: string, fn: () => Promise<void>): Promise<void> {
    this.stateMachine.transition(phase as any, `Starting ${phase}`);

    this.emit(EventType.PHASE_STARTED, { phase });

    await fn();

    // Create checkpoint after phase
    await this.checkpoints.create('phase_completed');

    this.emit(EventType.PHASE_COMPLETED, { phase });
  }

  private getAgent(name: AgentName): BaseAgent {
    if (!this.agents.has(name)) {
      const context = this.createAgentContext();

      switch (name) {
        case 'hermes':
          this.agents.set(name, new HermesAgent(context, this.apiKey));
          break;
        case 'athena':
          this.agents.set(name, new AthenaAgent(context, this.apiKey));
          break;
        case 'hephaestus':
          this.agents.set(name, new HephaestusAgent(context, this.apiKey));
          break;
        case 'apollo':
          this.agents.set(name, new ApolloAgent(context, this.apiKey));
          break;
        case 'artemis':
          this.agents.set(name, new ArtemisAgent(context, this.apiKey));
          break;
        default:
          throw new Error(`Unknown agent: ${name}`);
      }
    }

    return this.agents.get(name)!;
  }

  private createAgentContext(): AgentContext {
    return {
      sessionId: this.sessionId,
      projectId: this.options.projectId,
      projectName: this.options.projectName,
      prompt: this.options.prompt,
      options: this.options,
      currentPhase: this.stateMachine.getCurrentPhase(),
      emit: this.eventStream,
      sandbox: this.sandbox,
      memory: null!, // Injected later
      knowledge: this.knowledge,
      budget: this.budget,
      queryAgent: this.queryAgent.bind(this),
      askUser: this.askUser.bind(this),
    };
  }

  private async validatePlanCoverage(): Promise<{
    isComplete: boolean;
    percentage: number;
    gaps: string[];
  }> {
    const reqDoc = await this.knowledge.read('/requirements/main.json');
    const planDoc = await this.knowledge.read('/plan/main.json');

    if (!reqDoc || !planDoc) {
      return { isComplete: false, percentage: 0, gaps: ['Documents not found'] };
    }

    const requirements = JSON.parse(reqDoc.content);
    const plan = JSON.parse(planDoc.content);

    // Check coverage
    const allReqs = [...requirements.explicit, ...requirements.implicit];
    const coveredReqs = new Set<string>();

    for (const task of plan.tasks) {
      for (const reqId of task.coversRequirements || []) {
        coveredReqs.add(reqId);
      }
    }

    const gaps = allReqs
      .filter((r: any) => !coveredReqs.has(r.id))
      .map((r: any) => r.id);

    const percentage = allReqs.length > 0
      ? (coveredReqs.size / allReqs.length) * 100
      : 100;

    return {
      isComplete: gaps.length === 0,
      percentage: Math.round(percentage),
      gaps,
    };
  }

  private async queryAgent(target: AgentName, query: any): Promise<any> {
    // Inter-agent communication
    // For now, just return empty - implement based on needs
    return { success: true, content: '' };
  }

  private async askUser(question: any): Promise<any> {
    // This would be implemented with actual user interaction
    // For now, return a placeholder
    return new Promise((resolve) => {
      // In real implementation, this would wait for user input
      setTimeout(() => {
        resolve({ response: '', timedOut: true });
      }, 30000);
    });
  }

  private async runFixLoop(errors: { errors: string[] }): Promise<void> {
    // Targeted fix loop for verification failures
    const hephaestus = this.getAgent('hephaestus');
    // Re-run with specific fix instructions
  }

  private emit(type: EventType, payload: unknown): void {
    this.eventStream.emit({
      id: uuid(),
      type,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      payload,
    });
  }
}
```

---

## Verification Checklist

After Phase 3 implementation:

- [ ] BaseAgent can make LLM calls and execute tools
- [ ] Hermes can parse prompts and extract requirements
- [ ] Athena can research domains and create architecture
- [ ] Hephaestus can generate code files
- [ ] Apollo can run verification
- [ ] Artemis can deploy to Vercel
- [ ] Orchestrator coordinates all agents correctly
- [ ] Phase transitions work properly
- [ ] Events are emitted for all major actions

---

## Next Phase

Once Phase 3 is complete and verified, proceed to **Phase 4: Recovery System**.
