# Brand Infinity Engine - Complete System Architecture

> A comprehensive walkthrough of the entire pipeline from frontend to backend, including all agents, n8n workflows, database, and infrastructure.

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [System Layers](#system-layers)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend API Routes](#backend-api-routes)
5. [Agent System](#agent-system)
6. [LLM Service Layer](#llm-service-layer)
7. [n8n Workflow Engine](#n8n-workflow-engine)
8. [Database Schema](#database-schema)
9. [Data Flow Diagrams](#data-flow-diagrams)
10. [End-to-End User Journeys](#end-to-end-user-journeys)

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BRAND INFINITY ENGINE                               │
│                         AI-Powered Marketing Content System                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│   │   Frontend   │    │   Backend    │    │    n8n       │    │   Database   │  │
│   │   (Next.js)  │───▶│  (API Routes)│───▶│  (Workflows) │───▶│  (Supabase)  │  │
│   └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘  │
│          │                   │                   │                   │          │
│          ▼                   ▼                   ▼                   ▼          │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│   │  React UI    │    │   Agents     │    │  Automation  │    │   Postgres   │  │
│   │  Components  │    │  (7 Types)   │    │  (20 Flows)  │    │   + Redis    │  │
│   └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## System Layers

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: PRESENTATION                                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Browser ─────▶ Next.js App Router ─────▶ React Components                     │
│                                                                                  │
│   Pages:                                                                         │
│   • /director      → Creative Director (Chat UI)                                │
│   • /brand-vault   → Asset & Knowledge Management                               │
│   • /campaigns     → Campaign Management                                        │
│   • /analytics     → Performance Dashboard                                      │
│   • /videos        → Video Library                                              │
│   • /publishing    → Social Media Publishing                                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: API GATEWAY                                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   /api/v1/                                                                       │
│   ├── conversation/    → Chat session management                                │
│   ├── campaigns/       → CRUD campaigns                                         │
│   ├── brands/          → Brand profiles                                         │
│   ├── brand-assets/    → File uploads/downloads                                 │
│   ├── brand-identity/  → Brand voice & style                                    │
│   ├── knowledge-bases/ → RAG knowledge stores                                   │
│   ├── videos/          → Video generation & assembly                            │
│   ├── scripts/         → Script generation                                      │
│   ├── briefs/          → Creative briefs                                        │
│   ├── tasks/           → Task plan management                                   │
│   ├── models/          → LLM model listing                                      │
│   └── health/          → System health checks                                   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: INTELLIGENCE                                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         AGENT ORCHESTRA                                  │   │
│   ├─────────────────────────────────────────────────────────────────────────┤   │
│   │                                                                          │   │
│   │   EXECUTIVE AGENT (Entry Point)                                         │   │
│   │   ├── Parse Intent                                                      │   │
│   │   ├── Ask Clarifying Questions                                          │   │
│   │   └── Delegate to Orchestrator                                          │   │
│   │                    │                                                     │   │
│   │                    ▼                                                     │   │
│   │   ORCHESTRATOR (Coordinator)                                             │   │
│   │   ├── Task Planner → Creates execution plan                             │   │
│   │   └── Executes tasks via:                                               │   │
│   │       ├── STRATEGIST → Market analysis, positioning                     │   │
│   │       ├── COPYWRITER → Scripts, hooks, CTAs                             │   │
│   │       ├── PRODUCER   → Video assembly, media generation                 │   │
│   │       └── VERIFIER   → Quality checks, compliance                       │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 4: LLM SERVICE                                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌────────────────────────────────────────────────────────────────────────┐    │
│   │                      MULTI-PROVIDER LLM SERVICE                         │    │
│   ├────────────────────────────────────────────────────────────────────────┤    │
│   │                                                                         │    │
│   │   Providers:                                                            │    │
│   │   ├── OpenAI      → GPT-4, GPT-4o                                      │    │
│   │   ├── Anthropic   → Claude 3.5 Sonnet, Claude 3 Opus                   │    │
│   │   ├── OpenRouter  → 100+ models (free & paid)                          │    │
│   │   ├── DeepSeek    → DeepSeek Coder, DeepSeek Chat                      │    │
│   │   └── Gemini      → Gemini Pro, Gemini Ultra                           │    │
│   │                                                                         │    │
│   │   Features:                                                             │    │
│   │   • Streaming completions (SSE)                                        │    │
│   │   • Cost calculation per request                                       │    │
│   │   • Automatic model selection by tier (premium/budget)                 │    │
│   │   • Provider availability checks                                       │    │
│   │                                                                         │    │
│   └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 5: AUTOMATION                                                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         n8n WORKFLOW ENGINE                              │   │
│   ├─────────────────────────────────────────────────────────────────────────┤   │
│   │                                                                          │   │
│   │   MAIN WORKFLOWS (12):                                                   │   │
│   │   ├── Strategist_Main.json      → Brand strategy generation            │   │
│   │   ├── Copywriter_Main.json      → Script/copy writing                  │   │
│   │   ├── Broadcaster_Main.json     → Multi-platform publishing            │   │
│   │   ├── Production_Dispatcher.json → Job queue management                │   │
│   │   ├── Production_Poller.json    → Poll external services               │   │
│   │   ├── Production_Downloader.json → Asset downloading                   │   │
│   │   ├── Video_Assembly.json       → FFmpeg video concatenation           │   │
│   │   ├── Campaign_Verifier.json    → QA and compliance                    │   │
│   │   ├── Approval_Handler.json     → Human-in-the-loop                    │   │
│   │   ├── Performance_Monitor.json  → Analytics collection                 │   │
│   │   ├── Circuit_Breaker_Monitor.json → Error rate monitoring             │   │
│   │   └── Zombie_Reaper.json        → Stale job cleanup                    │   │
│   │                                                                          │   │
│   │   SUB-WORKFLOWS (8):                                                     │   │
│   │   ├── Get_Brand_Context.json    → Fetch brand knowledge                │   │
│   │   ├── Acquire_Lock.json         → Distributed locking                  │   │
│   │   ├── Release_Lock.json         → Lock release                         │   │
│   │   ├── Check_Circuit_Breaker.json → Health checks                       │   │
│   │   ├── Validate_Schema.json      → Input validation                     │   │
│   │   ├── Refresh_Platform_Token.json → OAuth refresh                      │   │
│   │   ├── Send_Alert.json           → Slack/email notifications            │   │
│   │   └── Sub_Log_Cost_Event.json   → Cost tracking                        │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 6: DATA                                                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────────────────┐    ┌──────────────────────────┐                  │
│   │       SUPABASE           │    │         REDIS            │                  │
│   ├──────────────────────────┤    ├──────────────────────────┤                  │
│   │ • Postgres Database      │    │ • Session Cache          │                  │
│   │ • Row Level Security     │    │ • Message Cache          │                  │
│   │ • Real-time Subscriptions│    │ • Task Plan Cache        │                  │
│   │ • Auth (JWT)             │    │ • Rate Limiting          │                  │
│   │ • Storage (S3-compat)    │    │ • Idempotency Keys       │                  │
│   └──────────────────────────┘    └──────────────────────────┘                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Directory Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── director/             # Creative Director page
│   │   ├── brand-vault/          # Brand asset management
│   │   ├── campaigns/            # Campaign CRUD
│   │   ├── analytics/            # Performance metrics
│   │   ├── videos/               # Video library
│   │   └── settings/             # User preferences
│   ├── api/v1/                   # API route handlers
│   └── (auth)/                   # Auth pages (login, signup)
│
├── components/                   # React components
│   ├── director/                 # Chat interface components
│   │   ├── chat-interface.tsx    # Main chat UI
│   │   ├── ChatContextSelector.tsx # Campaign/KB selection
│   │   ├── message-bubble.tsx    # Chat messages
│   │   └── plan-preview.tsx      # Task plan display
│   ├── brand-vault/              # Asset management UI
│   └── ui/                       # Shadcn/UI components
│
└── lib/                          # Core libraries
    ├── agents/                   # Agent implementations
    ├── llm/                      # LLM service & adapters
    ├── hooks/                    # React hooks
    ├── supabase/                 # Database client
    ├── redis/                    # Caching layer
    ├── n8n/                      # Workflow triggers
    └── conversation/             # Chat session queries
```

### Key Frontend Hooks

```
hooks/
├── use-chat-context.ts      # Zustand store for chat state
├── use-streaming-response.ts # SSE streaming handler
├── use-api.ts               # SWR data fetching
├── use-current-campaign.ts  # Active campaign state
├── use-connection-status.ts # Backend health
├── use-api-keys.ts          # API key management
└── use-progress.ts          # Multi-step progress UI
```

---

## Backend API Routes

### Complete Route Map

```
/api/v1/
│
├── conversation/
│   ├── start/          POST    → Start new conversation session
│   ├── stream/         POST    → SSE streaming responses
│   └── [id]/
│       ├── continue    POST    → Continue conversation
│       └── route.ts    GET     → Get session with messages
│
├── campaigns/
│   ├── route.ts        GET/POST → List/Create campaigns
│   └── [id]/
│       ├── route.ts    GET/PATCH/DELETE → CRUD
│       ├── assets/     GET     → Campaign-linked assets
│       └── analytics/  GET     → Campaign metrics
│
├── brands/
│   └── route.ts        GET     → User's brands
│
├── brand-assets/
│   ├── route.ts        GET     → List assets
│   └── upload/         POST    → Upload new asset
│
├── brand-identity/
│   └── route.ts        GET/POST → Brand voice settings
│
├── knowledge-bases/
│   ├── route.ts        GET/POST → List/Create KBs
│   └── [id]/           PATCH/DELETE → Update/Delete
│
├── videos/
│   ├── route.ts        GET/POST → Video CRUD
│   ├── [id]/           GET/PATCH/DELETE
│   ├── generate/       POST    → Trigger video generation
│   ├── assemble/       POST    → Concatenate clips
│   └── status/[id]     GET     → Generation status
│
├── scripts/
│   ├── route.ts        GET/POST
│   └── generate/       POST    → Generate script
│
├── briefs/
│   ├── route.ts        GET/POST → Creative briefs
│   └── generate/       POST    → AI-generate brief
│
├── tasks/
│   ├── route.ts        GET     → List task plans
│   └── [id]/           GET/PATCH → Task details
│
├── models/
│   └── route.ts        GET     → Available LLM models
│
└── health/
    └── route.ts        GET     → System health check
```

---

## Agent System

### Agent Hierarchy

```
                    ┌─────────────────────────┐
                    │    EXECUTIVE AGENT      │
                    │   (Intent Parser)       │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │     ORCHESTRATOR        │
                    │   (Task Coordinator)    │
                    └───────────┬─────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   TASK PLANNER  │   │   MANAGER       │   │    VERIFIER     │
│ (Plan Creator)  │   │   AGENTS        │   │  (QA Agent)     │
└─────────────────┘   └────────┬────────┘   └─────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   STRATEGIST    │   │   COPYWRITER    │   │    PRODUCER     │
│ (Market Intel)  │   │ (Scripts/Copy)  │   │ (Video/Media)   │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

### Agent Details

#### 1. Executive Agent (`executive.ts`)

```
Location: frontend/lib/agents/executive.ts

Purpose: Entry point for all user interactions

Methods:
├── processMessage()       → Parse user intent, decide action
├── parseIntent()          → LLM call to extract structured intent
├── identifyMissingInfo()  → Check what info is needed
├── processAnswers()       → Handle clarifying question responses
├── generateConfirmationSummary() → Human-readable plan summary
├── explainPlan()          → Describe what will be created
└── createTaskPlan()       → Delegate to TaskPlanner

Outputs:
├── ask_questions  → Need more info from user
├── confirm_plan   → Ready for user confirmation
└── create_plan    → Execute the plan
```

#### 2. Orchestrator (`orchestrator.ts`)

```
Location: frontend/lib/agents/orchestrator.ts

Purpose: Coordinate task execution across all agents

Methods:
├── persistPlan()         → Save plan to Supabase
├── resumePlan()          → Continue interrupted plan
├── getInProgressPlans()  → Fetch active plans
├── executePlan()         → Run full task pipeline
├── executeTask()         → Run single task with agent
├── getProgress()         → Calculate completion %
└── estimateRemainingTime()

Task Execution Flow:
1. Create task plan via TaskPlanner
2. Execute tasks in dependency order
3. Parallel execution where possible
4. Persist results after each task
5. Handle errors with retry logic
```

#### 3. Task Planner (`task-planner.ts`)

```
Location: frontend/lib/agents/task-planner.ts

Purpose: Convert intent into executable task sequence

Creates TaskPlan with:
├── tasks[]              → Ordered list of tasks
├── estimated_duration   → Time estimate
├── estimated_cost       → Token cost estimate
└── dependencies         → Task dependency graph

Task Types:
├── preparation  → Gather context, research
├── strategy     → Market positioning, audience
├── copy         → Scripts, hooks, CTAs
├── production   → Media generation, assembly
└── verification → QA, compliance checks
```

#### 4. Manager Agents

```
Location: frontend/lib/agents/managers/

┌─────────────────────────────────────────────────────────────────┐
│ STRATEGIST (strategist.ts)                                      │
├─────────────────────────────────────────────────────────────────┤
│ • Analyze market positioning                                    │
│ • Define target audience personas                               │
│ • Competitive analysis                                          │
│ • Content strategy recommendations                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ COPYWRITER (copywriter.ts)                                      │
├─────────────────────────────────────────────────────────────────┤
│ • Generate video scripts                                        │
│ • Write hooks and CTAs                                          │
│ • Create captions and copy                                      │
│ • Adapt content per platform                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PRODUCER (producer.ts)                                          │
├─────────────────────────────────────────────────────────────────┤
│ • Trigger video generation APIs                                 │
│ • Manage asset assembly                                         │
│ • Handle media downloads                                        │
│ • Coordinate with n8n workflows                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 5. Verifier (`verifier.ts`)

```
Location: frontend/lib/agents/verifier.ts

Purpose: Quality assurance and compliance

Checks:
├── Brand guideline compliance
├── Content quality scoring
├── Platform requirements (dimensions, length)
├── Prohibited content detection
└── Final approval recommendations
```

---

## LLM Service Layer

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       LLM SERVICE                                │
│                    (Singleton Pattern)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   getLLMService() ──▶ LLMService Instance                       │
│                              │                                   │
│                              ▼                                   │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                    ADAPTER MAP                            │  │
│   ├──────────────────────────────────────────────────────────┤  │
│   │                                                           │  │
│   │   'openai'     ──▶ OpenAIAdapter                         │  │
│   │   'anthropic'  ──▶ AnthropicAdapter                      │  │
│   │   'openrouter' ──▶ OpenRouterAdapter                     │  │
│   │   'deepseek'   ──▶ DeepSeekAdapter                       │  │
│   │   'gemini'     ──▶ GeminiAdapter                         │  │
│   │                                                           │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│   Methods:                                                       │
│   ├── generateCompletion(request) → LLMResponse                 │
│   ├── streamCompletion(request)   → AsyncGenerator<string>     │
│   ├── getProviderFromModel(model) → Provider name              │
│   ├── calculateCost(provider, model, tokens) → USD             │
│   ├── selectModel(agentRole, tier) → Best model string         │
│   ├── estimateCost(model, tokens) → Cost estimate              │
│   ├── isProviderAvailable(provider) → boolean                  │
│   └── getAvailableProviders() → Provider[]                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Model Selection by Tier

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIER-BASED MODEL SELECTION                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   PREMIUM TIER (High quality, higher cost):                     │
│   ├── Executive    → anthropic/claude-3-5-sonnet               │
│   ├── Strategist   → anthropic/claude-3-5-sonnet               │
│   ├── Copywriter   → openai/gpt-4o                             │
│   ├── Producer     → anthropic/claude-3-5-sonnet               │
│   └── Verifier     → anthropic/claude-3-opus                   │
│                                                                  │
│   BUDGET TIER (Fast, lower cost):                               │
│   ├── Executive    → openrouter/meta-llama-3.1-8b              │
│   ├── Strategist   → openrouter/mixtral-8x7b                   │
│   ├── Copywriter   → openrouter/meta-llama-3.1-8b              │
│   ├── Producer     → openrouter/mistral-7b                     │
│   └── Verifier     → openrouter/mixtral-8x7b                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## n8n Workflow Engine

### Main Workflows

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN WORKFLOWS (12)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Strategist_Main.json                                         │
│    └── Generates brand strategy, audience analysis              │
│                                                                  │
│ 2. Copywriter_Main.json                                         │
│    └── Writes scripts, hooks, captions                          │
│                                                                  │
│ 3. Production_Dispatcher.json                                   │
│    └── Queues video generation jobs                             │
│                                                                  │
│ 4. Production_Poller.json                                       │
│    └── Polls external APIs for job completion                   │
│                                                                  │
│ 5. Production_Downloader.json                                   │
│    └── Downloads completed assets to storage                    │
│                                                                  │
│ 6. Video_Assembly.json                                          │
│    └── FFmpeg concatenation of video clips                      │
│                                                                  │
│ 7. Broadcaster_Main.json                                        │
│    └── Posts content to social platforms                        │
│                                                                  │
│ 8. Campaign_Verifier.json                                       │
│    └── QA checks before publishing                              │
│                                                                  │
│ 9. Approval_Handler.json                                        │
│    └── Human approval workflow                                  │
│                                                                  │
│ 10. Performance_Monitor.json                                    │
│     └── Collects engagement metrics                             │
│                                                                  │
│ 11. Circuit_Breaker_Monitor.json                                │
│     └── Monitors error rates, pauses on failure                 │
│                                                                  │
│ 12. Zombie_Reaper.json                                          │
│     └── Cleans up stale jobs                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sub-Workflows (Reusable)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUB-WORKFLOWS (8)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Get_Brand_Context.json                                       │
│    └── Fetches brand knowledge from Supabase                    │
│                                                                  │
│ 2. Acquire_Lock.json / Release_Lock.json                        │
│    └── Distributed locking for concurrent jobs                  │
│                                                                  │
│ 3. Check_Circuit_Breaker.json                                   │
│    └── Health check before workflow execution                   │
│                                                                  │
│ 4. Validate_Schema.json                                         │
│    └── JSON schema validation                                   │
│                                                                  │
│ 5. Refresh_Platform_Token.json                                  │
│    └── OAuth token refresh for social platforms                 │
│                                                                  │
│ 6. Send_Alert.json                                              │
│    └── Slack/email notifications                                │
│                                                                  │
│ 7. Sub_Log_Cost_Event.json                                      │
│    └── Cost tracking per operation                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### n8n Integration Flow

```
Frontend Request
      │
      ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  API Route      │────▶│  n8n Trigger    │────▶│  n8n Workflow   │
│  (/api/v1/...)  │     │  (Webhook URL)  │     │  (Execution)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │     WORKFLOW EXECUTION       │
         ├──────────────────────────────┤
         │ 1. Get_Brand_Context         │
         │ 2. Check_Circuit_Breaker     │
         │ 3. Acquire_Lock              │
         │ 4. <Main Logic>              │
         │ 5. Log_Cost_Event            │
         │ 6. Release_Lock              │
         │ 7. Return Result             │
         └──────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │     SUPABASE UPDATE          │
         │  (results, status, assets)   │
         └──────────────────────────────┘
```

---

## Database Schema

### Core Tables (47 migrations)

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE SCHEMA                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │     brands      │    │    campaigns    │                     │
│  ├─────────────────┤    ├─────────────────┤                     │
│  │ id              │◄───│ brand_id        │                     │
│  │ user_id         │    │ user_id         │                     │
│  │ name            │    │ campaign_name   │                     │
│  │ created_at      │    │ status          │                     │
│  └─────────────────┘    │ budget_limit    │                     │
│                         │ metadata        │                     │
│                         └────────┬────────┘                     │
│                                  │                               │
│          ┌───────────────────────┼───────────────────────┐      │
│          │                       │                       │       │
│          ▼                       ▼                       ▼       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  │ knowledge_bases │    │ brand_identity  │    │  brand_assets   │
│  ├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│  │ id              │    │ id              │    │ id              │
│  │ campaign_id     │    │ campaign_id     │    │ brand_id        │
│  │ name            │    │ brand_voice     │    │ file_url        │
│  │ content         │    │ target_audience │    │ asset_type      │
│  │ is_core         │    │ tone_style      │    │ metadata        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   CONVERSATION TABLES                        │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │                                                              │ │
│  │  conversation_sessions          conversation_messages        │ │
│  │  ├── id                         ├── id                       │ │
│  │  ├── brand_id                   ├── session_id              │ │
│  │  ├── user_id                    ├── role (user/assistant)   │ │
│  │  ├── state                      ├── content                 │ │
│  │  ├── parsed_intent              ├── tokens_used             │ │
│  │  ├── pending_questions          ├── model_used              │ │
│  │  └── selected_kb_ids            ├── cost_usd                │ │
│  │                                 └── created_at              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     TASK TABLES                              │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │                                                              │ │
│  │  task_plans                                                  │ │
│  │  ├── id                                                      │ │
│  │  ├── user_id                                                 │ │
│  │  ├── conversation_id                                         │ │
│  │  ├── campaign_id                                             │ │
│  │  ├── status (pending/running/completed/failed)              │ │
│  │  ├── progress_percentage                                     │ │
│  │  ├── tasks (JSONB)                                          │ │
│  │  ├── results (JSONB)                                        │ │
│  │  └── errors (JSONB)                                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   CONTENT TABLES                             │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │                                                              │ │
│  │  creative_briefs    scripts         videos                   │ │
│  │  ├── id             ├── id          ├── id                   │ │
│  │  ├── campaign_id    ├── brief_id    ├── script_id            │ │
│  │  ├── content        ├── content     ├── video_url            │ │
│  │  ├── status         ├── hooks[]     ├── thumbnail_url        │ │
│  │  └── metadata       ├── scenes[]    ├── duration             │ │
│  │                     └── metadata    ├── status               │ │
│  │                                     └── metadata             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 PUBLISHING TABLES                            │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │                                                              │ │
│  │  publications       platform_posts     scheduled_posts       │ │
│  │  ├── id             ├── id             ├── id                │ │
│  │  ├── campaign_id    ├── publication_id ├── publication_id    │ │
│  │  ├── content_id     ├── platform       ├── scheduled_for     │ │
│  │  ├── status         ├── post_url       ├── status            │ │
│  │  └── published_at   ├── engagement     └── executed_at       │ │
│  │                     └── created_at                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Row Level Security (RLS)

```
All tables have RLS enabled with policies:
• SELECT: auth.uid() = user_id
• INSERT: auth.uid() = user_id
• UPDATE: auth.uid() = user_id
• DELETE: auth.uid() = user_id

This ensures complete data isolation between users.
```

---

## Data Flow Diagrams

### 1. User Sends Message (Chat Flow)

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User    │     │  ChatUI      │     │  API Route   │     │  Executive   │
│  Types   │────▶│  Component   │────▶│  /start      │────▶│  Agent       │
└──────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                   │
                 ┌─────────────────────────────────────────────────┘
                 │
                 ▼
     ┌─────────────────────────────┐
     │     EXECUTIVE PROCESSING    │
     ├─────────────────────────────┤
     │ 1. parseIntent(message)     │───▶ LLM Call
     │ 2. identifyMissingInfo()    │
     │ 3. Return action type:      │
     │    • ask_questions          │
     │    • confirm_plan           │
     │    • create_plan            │
     └──────────────┬──────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐
│ Questions?    │       │ Ready?        │
│ Show to user  │       │ Create Plan   │
└───────────────┘       └───────┬───────┘
                                │
                                ▼
                 ┌──────────────────────────┐
                 │     ORCHESTRATOR         │
                 ├──────────────────────────┤
                 │ 1. TaskPlanner creates   │
                 │    execution plan        │
                 │ 2. Execute tasks via     │
                 │    manager agents        │
                 │ 3. Persist to Supabase   │
                 └──────────────────────────┘
```

### 2. Video Generation Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │     │  /api/v1/   │     │    n8n      │     │  External   │
│  Request    │────▶│  generate   │────▶│  Workflow   │────▶│  Video API  │
└─────────────┘     └─────────────┘     └──────┬──────┘     └──────┬──────┘
                                               │                    │
                                               │                    │
                    ┌──────────────────────────┘                    │
                    │                                               │
                    ▼                                               │
     ┌──────────────────────────┐                                  │
     │  Production_Dispatcher   │                                  │
     ├──────────────────────────┤                                  │
     │ 1. Create job record     │                                  │
     │ 2. Queue to external API │──────────────────────────────────┘
     │ 3. Return job_id         │
     └──────────────────────────┘
                    │
                    ▼
     ┌──────────────────────────┐
     │  Production_Poller       │
     ├──────────────────────────┤
     │ (Runs every 30 seconds)  │
     │ 1. Check job status      │
     │ 2. If complete → trigger │
     │    Production_Downloader │
     └──────────────────────────┘
                    │
                    ▼
     ┌──────────────────────────┐
     │  Production_Downloader   │
     ├──────────────────────────┤
     │ 1. Download video file   │
     │ 2. Upload to Supabase    │
     │    Storage               │
     │ 3. Update videos table   │
     └──────────────────────────┘
                    │
                    ▼
     ┌──────────────────────────┐
     │  Frontend notified via   │
     │  real-time subscription  │
     └──────────────────────────┘
```

### 3. Content Publishing Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User clicks    │     │ /api/v1/        │     │ Broadcaster_    │
│  "Publish"      │────▶│ publications    │────▶│ Main.json       │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │    BROADCASTER WORKFLOW      │
         ├──────────────────────────────┤
         │ 1. Get_Brand_Context         │
         │ 2. Refresh_Platform_Token    │
         │ 3. For each platform:        │
         │    ├── Adapt content format  │
         │    ├── POST to platform API  │
         │    └── Store platform_post   │
         │ 4. Update publication status │
         │ 5. Send_Alert (Slack)        │
         └──────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │  PLATFORM APIS               │
         ├──────────────────────────────┤
         │ • Instagram Graph API        │
         │ • TikTok Creator API         │
         │ • YouTube Data API           │
         │ • Facebook Pages API         │
         │ • LinkedIn Marketing API     │
         └──────────────────────────────┘
```

---

## End-to-End User Journeys

### Journey 1: "Create a Product Launch Video"

```
STEP 1: USER INPUT
─────────────────────────────────────────────────────────────────────
User: "Create a product launch video for our new skincare line"

Frontend:
├── ChatInterface captures message
├── Calls POST /api/v1/conversation/start
└── Passes brand context (campaign, KBs, identity)

STEP 2: INTENT PARSING
─────────────────────────────────────────────────────────────────────
ExecutiveAgent.parseIntent():
├── LLM call to extract intent
├── Returns ParsedIntent {
│     content_type: "video",
│     platform: null,         ← Missing!
│     product: "skincare line",
│     target_audience: null,  ← Missing!
│     tone: null              ← Missing from brand identity? Skip
│   }
└── identifyMissingInfo() → ["platform", "target_audience"]

Response to user: "I'd like to understand your needs better:
1. Which platform is this for?
2. Who is your target audience?"

STEP 3: USER ANSWERS
─────────────────────────────────────────────────────────────────────
User: "Instagram Reels, targeting Gen Z women interested in skincare"

ExecutiveAgent.processAnswers():
├── Merge answers into ParsedIntent
├── identifyMissingInfo() → [] (all filled!)
└── Return { type: 'confirm_plan', summary: "..." }

Response: "I'll create an Instagram Reel for Gen Z women..."

STEP 4: PLAN CREATION
─────────────────────────────────────────────────────────────────────
User: "Yes, proceed"

Orchestrator.executePlan():
├── TaskPlanner.createPlan() builds:
│   [1] Strategy Task    → Strategist Agent
│   [2] Script Task      → Copywriter Agent
│   [3] Production Task  → Producer Agent
│   [4] Verify Task      → Verifier Agent
└── Execute in sequence

STEP 5: TASK EXECUTION
─────────────────────────────────────────────────────────────────────
Task 1: Strategist
├── Analyzes brand knowledge base
├── Researches Gen Z skincare trends
└── Returns positioning strategy

Task 2: Copywriter
├── Uses strategy + brand voice
├── Writes 30-second Reel script
├── Generates hooks, CTAs
└── Returns complete script

Task 3: Producer
├── Triggers n8n Production_Dispatcher
├── n8n calls external video API
├── Production_Poller waits for completion
├── Production_Downloader saves to storage
└── Returns video URL

Task 4: Verifier
├── Checks brand guideline compliance
├── Validates video specs
└── Approves for publishing

STEP 6: DELIVERY
─────────────────────────────────────────────────────────────────────
Frontend receives:
├── video_url → Display preview
├── script → Show text
├── approval_status → Enable publish button
└── User can publish or request revisions
```

---

_Document generated from codebase analysis on 2026-01-03_
