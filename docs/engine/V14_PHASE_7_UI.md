# V14 OLYMPUS - Phase 7: UI Implementation

## Overview

Phase 7 implements the complete user interface for FlowFace. This includes the generation wizard, real-time progress tracking, interactive clarification dialogs, file preview, and deployment status.

**Files to Create:** 25+
**Estimated Complexity:** High
**Dependencies:** Phases 1-6 (especially API routes)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FlowFace UI                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │
│  │   Landing Page    │  │  Generation View  │  │  Projects List  │  │
│  │   /               │  │  /generate        │  │  /projects      │  │
│  └───────────────────┘  └───────────────────┘  └─────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Generation Wizard                         │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │    │
│  │  │ Prompt  │→ │Progress │→ │Clarify  │→ │ Result  │         │    │
│  │  │  Input  │  │ Stream  │  │ Dialog  │  │  View   │         │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Components                                │    │
│  │  • EventStream (SSE consumer)                               │    │
│  │  • PhaseProgress (timeline)                                 │    │
│  │  • AgentStatus (per-agent cards)                           │    │
│  │  • FileTree (generated files)                              │    │
│  │  • CodePreview (syntax highlighting)                       │    │
│  │  • ClarificationDialog (user questions)                    │    │
│  │  • CostTracker (token/cost display)                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx                    # Landing page
│   │   └── layout.tsx                  # Marketing layout
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Dashboard layout with sidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Dashboard home
│   │   ├── generate/
│   │   │   ├── page.tsx                # Generation wizard
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Generation details
│   │   └── projects/
│   │       ├── page.tsx                # Projects list
│   │       └── [id]/
│   │           └── page.tsx            # Project details
│   └── api/
│       └── generate/
│           └── v14/
│               └── route.ts            # API endpoint (from Phase 6)
├── components/
│   ├── ui/                             # shadcn/ui components
│   ├── generation/
│   │   ├── prompt-input.tsx            # Main prompt input
│   │   ├── generation-wizard.tsx       # Wizard container
│   │   ├── phase-progress.tsx          # Phase timeline
│   │   ├── agent-status.tsx            # Agent status cards
│   │   ├── event-stream.tsx            # SSE consumer
│   │   ├── clarification-dialog.tsx    # User questions
│   │   ├── file-tree.tsx               # Generated files tree
│   │   ├── code-preview.tsx            # Code viewer
│   │   ├── cost-tracker.tsx            # Token/cost display
│   │   ├── generation-result.tsx       # Final result view
│   │   └── error-display.tsx           # Error handling
│   ├── layout/
│   │   ├── header.tsx                  # Top navigation
│   │   ├── sidebar.tsx                 # Dashboard sidebar
│   │   └── footer.tsx                  # Footer
│   └── shared/
│       ├── loading.tsx                 # Loading states
│       └── empty-state.tsx             # Empty states
├── hooks/
│   ├── use-generation.ts               # Generation state hook
│   ├── use-event-stream.ts             # SSE connection hook
│   └── use-local-storage.ts            # Persistence hook
├── lib/
│   ├── api-client.ts                   # API client
│   └── utils.ts                        # Utilities
└── types/
    └── generation.ts                   # Frontend types
```

---

## File 1: `src/types/generation.ts`

### Purpose
TypeScript types for the frontend generation state.

### Exact Implementation

```typescript
/**
 * Frontend Generation Types
 *
 * Types for generation state, events, and UI components.
 */

// Generation status
export type GenerationStatus =
  | 'idle'
  | 'connecting'
  | 'intake'
  | 'research'
  | 'architecture'
  | 'plan_validation'
  | 'building'
  | 'verification'
  | 'deployment'
  | 'completed'
  | 'failed'
  | 'aborted';

// Phase definition
export interface Phase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  completedAt?: number;
  agent?: string;
}

// Agent status
export interface AgentStatus {
  name: string;
  displayName: string;
  status: 'idle' | 'active' | 'waiting' | 'completed' | 'error';
  progress: number;
  message?: string;
  tokensUsed: number;
  callsMade: number;
  currentTool?: string;
}

// Generated file
export interface GeneratedFile {
  path: string;
  content: string;
  size: number;
  lines: number;
  language: string;
  createdAt: number;
  updatedAt?: number;
}

// Clarification question
export interface ClarificationQuestion {
  id: string;
  type: 'choice' | 'freeform' | 'confirmation';
  question: string;
  context?: string;
  options?: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  agent: string;
  timestamp: number;
}

// Generation event (from SSE)
export interface GenerationEvent {
  id: string;
  type: string;
  timestamp: number;
  sessionId: string;
  payload: unknown;
  metadata?: {
    agent?: string;
    phase?: string;
  };
}

// Generation result
export interface GenerationResult {
  success: boolean;
  projectId: string;
  filesCount: number;
  files: GeneratedFile[];
  tokensUsed: number;
  estimatedCost: number;
  duration: number;
  deployedUrl?: string;
  summary: string;
  warnings: string[];
  error?: string;
}

// Generation state (main state object)
export interface GenerationState {
  sessionId: string | null;
  status: GenerationStatus;
  prompt: string;
  projectName: string;

  // Progress
  phases: Phase[];
  currentPhase: string | null;
  overallProgress: number;

  // Agents
  agents: Record<string, AgentStatus>;

  // Files
  files: GeneratedFile[];
  fileCount: number;

  // Interaction
  pendingQuestion: ClarificationQuestion | null;

  // Cost tracking
  tokensUsed: number;
  estimatedCost: number;

  // Events log
  events: GenerationEvent[];

  // Result
  result: GenerationResult | null;
  error: string | null;

  // Timestamps
  startedAt: number | null;
  completedAt: number | null;
}

// Initial state
export const initialGenerationState: GenerationState = {
  sessionId: null,
  status: 'idle',
  prompt: '',
  projectName: '',
  phases: [
    { id: 'intake', name: 'Intake', description: 'Analyzing your prompt', status: 'pending' },
    { id: 'research', name: 'Research', description: 'Researching domain & competitors', status: 'pending' },
    { id: 'architecture', name: 'Architecture', description: 'Designing system architecture', status: 'pending' },
    { id: 'plan_validation', name: 'Validation', description: 'Validating plan coverage', status: 'pending' },
    { id: 'building', name: 'Building', description: 'Generating code files', status: 'pending' },
    { id: 'verification', name: 'Verification', description: 'Running tests & checks', status: 'pending' },
    { id: 'deployment', name: 'Deployment', description: 'Deploying to Vercel', status: 'pending' },
  ],
  currentPhase: null,
  overallProgress: 0,
  agents: {
    hermes: { name: 'hermes', displayName: 'Hermes', status: 'idle', progress: 0, tokensUsed: 0, callsMade: 0 },
    athena: { name: 'athena', displayName: 'Athena', status: 'idle', progress: 0, tokensUsed: 0, callsMade: 0 },
    hephaestus: { name: 'hephaestus', displayName: 'Hephaestus', status: 'idle', progress: 0, tokensUsed: 0, callsMade: 0 },
    apollo: { name: 'apollo', displayName: 'Apollo', status: 'idle', progress: 0, tokensUsed: 0, callsMade: 0 },
    artemis: { name: 'artemis', displayName: 'Artemis', status: 'idle', progress: 0, tokensUsed: 0, callsMade: 0 },
  },
  files: [],
  fileCount: 0,
  pendingQuestion: null,
  tokensUsed: 0,
  estimatedCost: 0,
  events: [],
  result: null,
  error: null,
  startedAt: null,
  completedAt: null,
};

// Event types
export const EVENT_TYPES = {
  // Connection
  CONNECTION_ESTABLISHED: 'connection:established',

  // Generation lifecycle
  GENERATION_STARTED: 'generation:started',
  GENERATION_COMPLETED: 'generation:completed',
  GENERATION_FAILED: 'generation:failed',
  GENERATION_RESULT: 'generation:result',

  // Phases
  PHASE_STARTED: 'phase:started',
  PHASE_COMPLETED: 'phase:completed',

  // Agents
  AGENT_STARTED: 'agent:started',
  AGENT_PROGRESS: 'agent:progress',
  AGENT_COMPLETED: 'agent:completed',
  AGENT_ERROR: 'agent:error',
  AGENT_THINKING: 'agent:thinking',
  AGENT_TOOL_CALL: 'agent:tool_call',
  AGENT_TOOL_RESULT: 'agent:tool_result',

  // Files
  FILE_CREATED: 'file:created',
  FILE_UPDATED: 'file:updated',
  FILE_DELETED: 'file:deleted',

  // User interaction
  USER_INPUT_REQUIRED: 'user:input_required',
  USER_INPUT_RECEIVED: 'user:input_received',

  // Recovery
  STUCK_DETECTED: 'recovery:stuck_detected',
  STRATEGY_APPLIED: 'recovery:strategy_applied',

  // Knowledge
  KNOWLEDGE_WRITTEN: 'knowledge:written',
  KNOWLEDGE_UPDATED: 'knowledge:updated',
} as const;
```

---

## File 2: `src/hooks/use-generation.ts`

### Purpose
Main hook for managing generation state. Consumes SSE events and updates UI.

### Exact Implementation

```typescript
/**
 * useGeneration Hook
 *
 * Manages generation state and SSE connection.
 * Provides all state and actions needed for the generation UI.
 */

'use client';

import { useCallback, useReducer, useRef } from 'react';
import {
  GenerationState,
  GenerationEvent,
  GenerationStatus,
  ClarificationQuestion,
  GeneratedFile,
  initialGenerationState,
  EVENT_TYPES,
} from '@/types/generation';

// Actions
type Action =
  | { type: 'START_GENERATION'; prompt: string; projectName: string }
  | { type: 'SET_SESSION_ID'; sessionId: string }
  | { type: 'SET_STATUS'; status: GenerationStatus }
  | { type: 'UPDATE_PHASE'; phaseId: string; update: Partial<GenerationState['phases'][0]> }
  | { type: 'UPDATE_AGENT'; agentName: string; update: Partial<GenerationState['agents'][string]> }
  | { type: 'ADD_FILE'; file: GeneratedFile }
  | { type: 'UPDATE_FILE'; path: string; update: Partial<GeneratedFile> }
  | { type: 'SET_QUESTION'; question: ClarificationQuestion | null }
  | { type: 'UPDATE_COST'; tokensUsed: number; estimatedCost: number }
  | { type: 'ADD_EVENT'; event: GenerationEvent }
  | { type: 'SET_RESULT'; result: GenerationState['result'] }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' };

// Reducer
function generationReducer(state: GenerationState, action: Action): GenerationState {
  switch (action.type) {
    case 'START_GENERATION':
      return {
        ...initialGenerationState,
        status: 'connecting',
        prompt: action.prompt,
        projectName: action.projectName,
        startedAt: Date.now(),
      };

    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.sessionId };

    case 'SET_STATUS':
      return {
        ...state,
        status: action.status,
        completedAt: ['completed', 'failed', 'aborted'].includes(action.status)
          ? Date.now()
          : state.completedAt,
      };

    case 'UPDATE_PHASE':
      return {
        ...state,
        phases: state.phases.map(p =>
          p.id === action.phaseId ? { ...p, ...action.update } : p
        ),
        currentPhase: action.update.status === 'active' ? action.phaseId : state.currentPhase,
      };

    case 'UPDATE_AGENT':
      return {
        ...state,
        agents: {
          ...state.agents,
          [action.agentName]: {
            ...state.agents[action.agentName],
            ...action.update,
          },
        },
      };

    case 'ADD_FILE':
      return {
        ...state,
        files: [...state.files, action.file],
        fileCount: state.fileCount + 1,
      };

    case 'UPDATE_FILE':
      return {
        ...state,
        files: state.files.map(f =>
          f.path === action.path ? { ...f, ...action.update } : f
        ),
      };

    case 'SET_QUESTION':
      return { ...state, pendingQuestion: action.question };

    case 'UPDATE_COST':
      return {
        ...state,
        tokensUsed: action.tokensUsed,
        estimatedCost: action.estimatedCost,
      };

    case 'ADD_EVENT':
      return {
        ...state,
        events: [...state.events.slice(-99), action.event], // Keep last 100
      };

    case 'SET_RESULT':
      return { ...state, result: action.result };

    case 'SET_ERROR':
      return { ...state, error: action.error, status: 'failed' };

    case 'RESET':
      return initialGenerationState;

    default:
      return state;
  }
}

// Hook
export function useGeneration() {
  const [state, dispatch] = useReducer(generationReducer, initialGenerationState);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Start generation
   */
  const startGeneration = useCallback(async (prompt: string, projectName: string) => {
    // Reset state
    dispatch({ type: 'START_GENERATION', prompt, projectName });

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      // Start generation via POST
      const response = await fetch('/api/generate/v14', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, projectName }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start generation');
      }

      // Get session ID from header
      const sessionId = response.headers.get('X-Session-Id');
      if (sessionId) {
        dispatch({ type: 'SET_SESSION_ID', sessionId });
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // Process stream
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data) as GenerationEvent;
              handleEvent(event);
            } catch {
              console.error('Failed to parse event:', data);
            }
          }
        }
      }

    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        dispatch({ type: 'SET_ERROR', error: error.message });
      }
    }
  }, []);

  /**
   * Handle SSE event
   */
  const handleEvent = useCallback((event: GenerationEvent) => {
    dispatch({ type: 'ADD_EVENT', event });

    switch (event.type) {
      case EVENT_TYPES.CONNECTION_ESTABLISHED:
        dispatch({ type: 'SET_STATUS', status: 'intake' });
        break;

      case EVENT_TYPES.PHASE_STARTED:
        const phasePayload = event.payload as { phase: string };
        dispatch({
          type: 'UPDATE_PHASE',
          phaseId: phasePayload.phase,
          update: { status: 'active', startedAt: event.timestamp },
        });
        dispatch({ type: 'SET_STATUS', status: phasePayload.phase as GenerationStatus });
        break;

      case EVENT_TYPES.PHASE_COMPLETED:
        const completedPhase = event.payload as { phase: string };
        dispatch({
          type: 'UPDATE_PHASE',
          phaseId: completedPhase.phase,
          update: { status: 'completed', completedAt: event.timestamp },
        });
        break;

      case EVENT_TYPES.AGENT_STARTED:
        const agentStart = event.payload as { agent: string };
        dispatch({
          type: 'UPDATE_AGENT',
          agentName: agentStart.agent,
          update: { status: 'active' },
        });
        break;

      case EVENT_TYPES.AGENT_PROGRESS:
        const agentProgress = event.payload as {
          agent: string;
          progress: number;
          message?: string;
          tokensUsed?: number;
        };
        dispatch({
          type: 'UPDATE_AGENT',
          agentName: agentProgress.agent,
          update: {
            progress: agentProgress.progress,
            message: agentProgress.message,
            tokensUsed: agentProgress.tokensUsed || 0,
          },
        });
        break;

      case EVENT_TYPES.AGENT_COMPLETED:
        const agentComplete = event.payload as { agent: string; tokensUsed: number };
        dispatch({
          type: 'UPDATE_AGENT',
          agentName: agentComplete.agent,
          update: { status: 'completed', tokensUsed: agentComplete.tokensUsed },
        });
        break;

      case EVENT_TYPES.AGENT_TOOL_CALL:
        const toolCall = event.payload as { agent: string; tool: string };
        dispatch({
          type: 'UPDATE_AGENT',
          agentName: toolCall.agent,
          update: { currentTool: toolCall.tool },
        });
        break;

      case EVENT_TYPES.FILE_CREATED:
        const fileCreated = event.payload as { path: string; size: number; lines?: number };
        dispatch({
          type: 'ADD_FILE',
          file: {
            path: fileCreated.path,
            content: '',
            size: fileCreated.size,
            lines: fileCreated.lines || 0,
            language: getLanguageFromPath(fileCreated.path),
            createdAt: event.timestamp,
          },
        });
        break;

      case EVENT_TYPES.USER_INPUT_REQUIRED:
        const question = event.payload as ClarificationQuestion;
        dispatch({ type: 'SET_QUESTION', question });
        break;

      case EVENT_TYPES.USER_INPUT_RECEIVED:
        dispatch({ type: 'SET_QUESTION', question: null });
        break;

      case EVENT_TYPES.GENERATION_COMPLETED:
        dispatch({ type: 'SET_STATUS', status: 'completed' });
        break;

      case EVENT_TYPES.GENERATION_FAILED:
        const failPayload = event.payload as { error: string };
        dispatch({ type: 'SET_ERROR', error: failPayload.error });
        break;

      case EVENT_TYPES.GENERATION_RESULT:
        const result = event.payload as GenerationState['result'];
        dispatch({ type: 'SET_RESULT', result });
        break;
    }
  }, []);

  /**
   * Submit answer to clarification question
   */
  const submitAnswer = useCallback(async (
    questionId: string,
    response: string,
    selectedOptionId?: string
  ) => {
    if (!state.sessionId) return;

    await fetch('/api/generate/v14', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        questionId,
        response: { response, selectedOptionId },
      }),
    });
  }, [state.sessionId]);

  /**
   * Abort generation
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    dispatch({ type: 'SET_STATUS', status: 'aborted' });
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    startGeneration,
    submitAnswer,
    abort,
    reset,
  };
}

// Helper
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return langMap[ext || ''] || 'text';
}
```

---

## File 3: `src/components/generation/generation-wizard.tsx`

### Purpose
Main container component for the generation flow.

### Exact Implementation

```typescript
/**
 * Generation Wizard
 *
 * Main container for the app generation flow.
 * Handles prompt input, progress tracking, and result display.
 */

'use client';

import { useState } from 'react';
import { useGeneration } from '@/hooks/use-generation';
import { PromptInput } from './prompt-input';
import { PhaseProgress } from './phase-progress';
import { AgentStatus } from './agent-status';
import { ClarificationDialog } from './clarification-dialog';
import { FileTree } from './file-tree';
import { GenerationResult } from './generation-result';
import { CostTracker } from './cost-tracker';
import { ErrorDisplay } from './error-display';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function GenerationWizard() {
  const { state, startGeneration, submitAnswer, abort, reset } = useGeneration();
  const [activeTab, setActiveTab] = useState<'progress' | 'files' | 'logs'>('progress');

  const isGenerating = !['idle', 'completed', 'failed', 'aborted'].includes(state.status);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Generate App</h1>
          <p className="text-muted-foreground">
            Describe your app and let AI build it for you
          </p>
        </div>

        {isGenerating && (
          <Button variant="destructive" onClick={abort}>
            Stop Generation
          </Button>
        )}

        {(state.status === 'completed' || state.status === 'failed' || state.status === 'aborted') && (
          <Button onClick={reset}>
            Start New
          </Button>
        )}
      </div>

      {/* Prompt Input (shown when idle) */}
      {state.status === 'idle' && (
        <PromptInput onSubmit={startGeneration} />
      )}

      {/* Generation Progress */}
      {state.status !== 'idle' && (
        <>
          {/* Cost Tracker */}
          <CostTracker
            tokensUsed={state.tokensUsed}
            estimatedCost={state.estimatedCost}
            duration={state.startedAt ? Date.now() - state.startedAt : 0}
          />

          {/* Phase Progress */}
          <PhaseProgress phases={state.phases} currentPhase={state.currentPhase} />

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Agents and Details */}
            <div className="lg:col-span-2">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList>
                  <TabsTrigger value="progress">Progress</TabsTrigger>
                  <TabsTrigger value="files">
                    Files ({state.fileCount})
                  </TabsTrigger>
                  <TabsTrigger value="logs">
                    Logs ({state.events.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="progress" className="space-y-4">
                  {/* Agent Status Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.values(state.agents).map((agent) => (
                      <AgentStatus key={agent.name} agent={agent} />
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="files">
                  <Card>
                    <CardHeader>
                      <CardTitle>Generated Files</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FileTree files={state.files} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="logs">
                  <Card>
                    <CardHeader>
                      <CardTitle>Event Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-96 overflow-y-auto font-mono text-sm space-y-1">
                        {state.events.map((event) => (
                          <div
                            key={event.id}
                            className="flex items-start gap-2 text-muted-foreground"
                          >
                            <span className="text-xs">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="text-primary">{event.type}</span>
                            {event.metadata?.agent && (
                              <span className="text-orange-500">
                                [{event.metadata.agent}]
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right: Summary */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Generation Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div className="font-medium capitalize">{state.status}</div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Project Name</div>
                    <div className="font-medium">{state.projectName || 'Unnamed'}</div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Files Generated</div>
                    <div className="font-medium">{state.fileCount}</div>
                  </div>

                  {state.startedAt && (
                    <div>
                      <div className="text-sm text-muted-foreground">Duration</div>
                      <div className="font-medium">
                        {formatDuration(
                          (state.completedAt || Date.now()) - state.startedAt
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Prompt Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Prompt</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-6">
                    {state.prompt}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Clarification Dialog */}
      {state.pendingQuestion && (
        <ClarificationDialog
          question={state.pendingQuestion}
          onSubmit={submitAnswer}
        />
      )}

      {/* Error Display */}
      {state.error && (
        <ErrorDisplay error={state.error} onRetry={reset} />
      )}

      {/* Result Display */}
      {state.result && state.status === 'completed' && (
        <GenerationResult result={state.result} />
      )}
    </div>
  );
}

// Helper
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}
```

---

## File 4: `src/components/generation/prompt-input.tsx`

### Purpose
Main prompt input component with examples and project name.

### Exact Implementation

```typescript
/**
 * Prompt Input
 *
 * Input form for the generation prompt.
 * Includes examples and project name field.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface PromptInputProps {
  onSubmit: (prompt: string, projectName: string) => void;
}

const EXAMPLES = [
  {
    title: 'E-commerce Store',
    prompt: 'Build an e-commerce store for selling handmade jewelry with product catalog, shopping cart, checkout with Stripe, user accounts, and order tracking.',
  },
  {
    title: 'Project Manager',
    prompt: 'Create a project management app with kanban boards, task assignments, due dates, team collaboration, and progress tracking dashboard.',
  },
  {
    title: 'Blog Platform',
    prompt: 'Build a blog platform with markdown editor, categories, tags, comments, user authentication, and an admin dashboard for content management.',
  },
  {
    title: 'Booking System',
    prompt: 'Create a booking system for a hair salon with service selection, available time slots, appointment scheduling, customer management, and email reminders.',
  },
];

export function PromptInput({ onSubmit }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(prompt.trim(), projectName.trim() || 'my-app');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExampleClick = (example: typeof EXAMPLES[0]) => {
    setPrompt(example.prompt);
    setProjectName(example.title.toLowerCase().replace(/\s+/g, '-'));
  };

  return (
    <div className="space-y-6">
      {/* Main Input Card */}
      <Card>
        <CardHeader>
          <CardTitle>Describe Your App</CardTitle>
          <CardDescription>
            Be specific about features, user types, and any integrations you need.
            The more detail you provide, the better the result.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              placeholder="my-awesome-app"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">App Description</Label>
            <Textarea
              id="prompt"
              placeholder="Describe the app you want to build..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <div className="text-xs text-muted-foreground text-right">
              {prompt.length} / 10,000 characters
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? 'Starting...' : 'Generate App'}
          </Button>
        </CardContent>
      </Card>

      {/* Examples */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Example Prompts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXAMPLES.map((example, i) => (
            <Card
              key={i}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleExampleClick(example)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{example.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {example.prompt}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## File 5: `src/components/generation/phase-progress.tsx`

### Purpose
Visual timeline of generation phases.

### Exact Implementation

```typescript
/**
 * Phase Progress
 *
 * Visual timeline showing progress through generation phases.
 */

'use client';

import { Phase } from '@/types/generation';
import { cn } from '@/lib/utils';
import { CheckCircle, Circle, Loader2, XCircle } from 'lucide-react';

interface PhaseProgressProps {
  phases: Phase[];
  currentPhase: string | null;
}

export function PhaseProgress({ phases, currentPhase }: PhaseProgressProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center justify-between min-w-[600px] px-4">
        {phases.map((phase, index) => (
          <div key={phase.id} className="flex items-center">
            {/* Phase Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2',
                  phase.status === 'completed' && 'bg-green-500 border-green-500 text-white',
                  phase.status === 'active' && 'bg-blue-500 border-blue-500 text-white',
                  phase.status === 'failed' && 'bg-red-500 border-red-500 text-white',
                  phase.status === 'pending' && 'bg-background border-muted-foreground/30',
                  phase.status === 'skipped' && 'bg-muted border-muted-foreground/30'
                )}
              >
                {phase.status === 'completed' && <CheckCircle className="w-5 h-5" />}
                {phase.status === 'active' && <Loader2 className="w-5 h-5 animate-spin" />}
                {phase.status === 'failed' && <XCircle className="w-5 h-5" />}
                {phase.status === 'pending' && <Circle className="w-5 h-5" />}
                {phase.status === 'skipped' && <Circle className="w-5 h-5" />}
              </div>

              {/* Phase Label */}
              <div className="mt-2 text-center">
                <div
                  className={cn(
                    'text-sm font-medium',
                    phase.status === 'active' && 'text-blue-500',
                    phase.status === 'completed' && 'text-green-500',
                    phase.status === 'failed' && 'text-red-500'
                  )}
                >
                  {phase.name}
                </div>
                <div className="text-xs text-muted-foreground max-w-[100px]">
                  {phase.description}
                </div>
              </div>
            </div>

            {/* Connector Line */}
            {index < phases.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-12 mx-2',
                  phases[index + 1].status !== 'pending' || phase.status === 'completed'
                    ? 'bg-green-500'
                    : 'bg-muted-foreground/30'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## File 6: `src/components/generation/clarification-dialog.tsx`

### Purpose
Dialog for answering clarification questions from agents.

### Exact Implementation

```typescript
/**
 * Clarification Dialog
 *
 * Modal dialog for answering questions from agents.
 */

'use client';

import { useState } from 'react';
import { ClarificationQuestion } from '@/types/generation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface ClarificationDialogProps {
  question: ClarificationQuestion;
  onSubmit: (questionId: string, response: string, selectedOptionId?: string) => void;
}

export function ClarificationDialog({ question, onSubmit }: ClarificationDialogProps) {
  const [response, setResponse] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const answer = question.type === 'choice' ? selectedOption || '' : response;
    await onSubmit(question.id, answer, selectedOption || undefined);

    setIsSubmitting(false);
    setResponse('');
    setSelectedOption(null);
  };

  const isValid = question.type === 'choice'
    ? !!selectedOption
    : response.trim().length > 0;

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Clarification Needed</DialogTitle>
          <DialogDescription>
            {question.agent && (
              <span className="text-orange-500 font-medium">
                {question.agent.charAt(0).toUpperCase() + question.agent.slice(1)}
              </span>
            )}{' '}
            needs your input to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Question */}
          <div className="text-base">{question.question}</div>

          {/* Context */}
          {question.context && (
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              {question.context}
            </div>
          )}

          {/* Choice Options */}
          {question.type === 'choice' && question.options && (
            <RadioGroup
              value={selectedOption || ''}
              onValueChange={setSelectedOption}
            >
              {question.options.map((option) => (
                <div
                  key={option.id}
                  className="flex items-start space-x-3 p-3 rounded-md border hover:bg-muted cursor-pointer"
                  onClick={() => setSelectedOption(option.id)}
                >
                  <RadioGroupItem value={option.id} id={option.id} />
                  <div className="space-y-1">
                    <Label htmlFor={option.id} className="cursor-pointer">
                      {option.label}
                    </Label>
                    {option.description && (
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </RadioGroup>
          )}

          {/* Freeform Input */}
          {question.type === 'freeform' && (
            <Textarea
              placeholder="Type your response..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={4}
            />
          )}

          {/* Confirmation */}
          {question.type === 'confirmation' && (
            <div className="flex gap-4">
              <Button
                variant={selectedOption === 'yes' ? 'default' : 'outline'}
                onClick={() => setSelectedOption('yes')}
                className="flex-1"
              >
                Yes
              </Button>
              <Button
                variant={selectedOption === 'no' ? 'default' : 'outline'}
                onClick={() => setSelectedOption('no')}
                className="flex-1"
              >
                No
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Additional UI Components (Summary)

### `agent-status.tsx`
Card showing individual agent status, progress bar, current tool, and token usage.

### `file-tree.tsx`
Tree view of generated files with folder structure and file type icons.

### `code-preview.tsx`
Syntax-highlighted code viewer using a library like Prism or highlight.js.

### `cost-tracker.tsx`
Real-time display of tokens used, estimated cost, and generation duration.

### `generation-result.tsx`
Final result view with download button, deployment URL, and summary statistics.

### `error-display.tsx`
Error message display with retry option and troubleshooting suggestions.

---

## Page Implementations

### `src/app/(dashboard)/generate/page.tsx`

```typescript
import { GenerationWizard } from '@/components/generation/generation-wizard';

export default function GeneratePage() {
  return <GenerationWizard />;
}
```

### `src/app/(dashboard)/layout.tsx`

```typescript
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## Verification Checklist

After Phase 7 implementation:

- [ ] Landing page renders correctly
- [ ] Generation wizard handles all states
- [ ] SSE stream connection works
- [ ] Events update UI in real-time
- [ ] Clarification dialog shows and submits
- [ ] Phase progress updates correctly
- [ ] Agent status cards update
- [ ] File tree shows generated files
- [ ] Cost tracker updates in real-time
- [ ] Result view shows all information
- [ ] Error handling works properly
- [ ] Responsive design on mobile
- [ ] All components are accessible

---

## Next Phase

Once Phase 7 is complete and verified, proceed to **Phase 8: Testing Strategy**.
