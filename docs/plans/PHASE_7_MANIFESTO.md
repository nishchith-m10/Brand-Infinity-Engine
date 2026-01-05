# PHASE 7 IMPLEMENTATION MANIFESTO

## Database & API Foundation for Pipeline UI

**Document Classification:** L10 SYSTEMS ARCHITECTURE  
**Version:** 1.0.0  
**Status:** PROPOSED FOR APPROVAL  
**Prerequisite:** Phase 6 Part II (Agent Architecture)  
**Target:** Establish persistent request-centric data layer and RESTful API surface to power the new Pipeline UI, replacing ephemeral chat-based workflows.

---

## TABLE OF CONTENTS

1. [Executive Summary](#section-1-executive-summary)
2. [Problem Analysis](#section-2-problem-analysis)
3. [Architectural Overview](#section-3-architectural-overview)
4. [Database Schema Design](#section-4-database-schema-design)
5. [API Specifications](#section-5-api-specifications)
6. [Status Transition State Machine](#section-6-status-transition-state-machine)
7. [Cost & Time Estimation Engine](#section-7-cost-and-time-estimation-engine)
8. [RLS Policies & Security](#section-8-rls-policies-and-security)
9. [Error Handling & Edge Cases](#section-9-error-handling-and-edge-cases)
10. [Frontend Integration Points](#section-10-frontend-integration-points)
11. [Migration Strategy](#section-11-migration-strategy)
12. [Implementation Roadmap](#section-12-implementation-roadmap)
13. [Verification Plan](#section-13-verification-plan)

---

# SECTION 1: EXECUTIVE SUMMARY

## 1.1 The Problem

The current system is **Chat-Centric**. Every content generation request flows through a conversation:

| Current Limitation | Impact | User Experience |
| :--- | :--- | :--- |
| Ephemeral Sessions | Requests live in `conversation_messages`; hard to query/filter | Cannot see "all videos in production" at a glance |
| No Persistent State | Status is inferred from chat history, not a first-class field | UI must parse messages to determine progress |
| Provider Blindness | External job IDs (Runway, Pika) buried in JSONB blobs | Cannot correlate failures to specific provider calls |
| No Audit Trail | No dedicated event log for status changes | Debugging requires log file archaeology |
| Session Coupling | Agents require a `conversationId` to function | Cannot trigger generation from a simple form POST |

## 1.2 The Vision

> **"The Request ID is the new Session ID. Every piece of content is a first-class database record with a queryable status, traceable tasks, and an immutable audit log."**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REQUEST-CENTRIC ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User submits form (Pipeline UI)                                            │
│                │                                                            │
│                ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      content_requests                               │   │
│  │  id: req_abc123                                                     │   │
│  │  status: 'intake' → 'draft' → 'production' → 'qa' → 'published'    │   │
│  │  title: "Summer Campaign Video"                                     │   │
│  │  type: 'video_with_vo'                                              │   │
│  │  provider: 'runway'                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                │                                                            │
│                ├──────────────────────────────────────┐                    │
│                ▼                                      ▼                    │
│  ┌─────────────────────────────┐      ┌─────────────────────────────┐     │
│  │       request_tasks         │      │      request_events         │     │
│  │  ┌───────────────────────┐  │      │  ┌───────────────────────┐  │     │
│  │  │ agent: 'executive'    │  │      │  │ type: 'created'       │  │     │
│  │  │ status: 'completed'   │  │      │  │ ts: 2026-01-04 12:00  │  │     │
│  │  └───────────────────────┘  │      │  └───────────────────────┘  │     │
│  │  ┌───────────────────────┐  │      │  ┌───────────────────────┐  │     │
│  │  │ agent: 'copywriter'   │  │      │  │ type: 'status_change' │  │     │
│  │  │ status: 'in_progress' │  │      │  │ data: intake→draft    │  │     │
│  │  └───────────────────────┘  │      │  └───────────────────────┘  │     │
│  │  ┌───────────────────────┐  │      │  ┌───────────────────────┐  │     │
│  │  │ agent: 'producer'     │  │      │  │ type: 'agent_log'     │  │     │
│  │  │ status: 'pending'     │  │      │  │ data: "Script done"   │  │     │
│  │  │ provider_job_id: ...  │  │      │  └───────────────────────┘  │     │
│  │  └───────────────────────┘  │      └─────────────────────────────┘     │
│  └─────────────────────────────┘                                           │
│                │                                                            │
│                ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      provider_metadata                              │   │
│  │  request_task_id: task_xyz                                          │   │
│  │  provider_name: 'runway'                                            │   │
│  │  external_job_id: 'run_12345'                                       │   │
│  │  request_payload: { ... }                                           │   │
│  │  response_payload: { ... }                                          │   │
│  │  cost_incurred: 0.45                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.3 Scope of Phase 7

This phase focuses **exclusively** on the data layer and API. It does NOT include:
- Orchestrator logic (Phase 8)
- n8n workflow modifications (Phase 8)
- Frontend React components (separate ticket)

| In Scope | Out of Scope |
| :--- | :--- |
| `content_requests` table | Orchestrator wiring |
| `request_tasks` table | n8n Production Dispatcher changes |
| `request_events` table | Frontend Pipeline Board component |
| `provider_metadata` table | Agent execution logic |
| RESTful API endpoints | Real-time subscriptions (Supabase Realtime) |
| RLS Policies | Provider API integrations |
| Cost estimation logic | |

## 1.4 Key Design Decisions

| Decision | Choice | Rationale |
| :--- | :--- | :--- |
| Request ID Format | UUID (Supabase default) | Consistent with existing schema |
| Status Storage | ENUM column on `content_requests` | Fast filtering, type-safe, indexed |
| Task Tracking | Separate `request_tasks` table | Normalize agent work, enable parallel tasks |
| Event Sourcing | Append-only `request_events` table | Immutable audit trail, enables replay |
| Provider Tracking | Separate `provider_metadata` table | Isolate external API concerns |
| API Style | RESTful with JSON:API-inspired responses | Familiar, tooling support |
| Pagination | Cursor-based for lists | Scales better than offset pagination |

## 1.5 Success Criteria

1. A user can POST a request via `/api/v1/requests` and receive a `request_id`.
2. The request appears in the database with status `intake`.
3. An event is automatically logged to `request_events` with type `created`.
4. The request can be fetched via GET `/api/v1/requests/:id` with all related tasks and events.
5. Status transitions are enforced (cannot skip from `intake` to `published`).
6. RLS ensures users only see requests for their brands.
7. Cost estimates are returned on request creation.

---

# SECTION 2: PROBLEM ANALYSIS

## 2.1 Current System Architecture

### 2.1.1 Existing Database Tables (Relevant)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CURRENT SCHEMA (RELEVANT TABLES)                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  conversation_sessions                    conversation_messages              │
│  ├── id (UUID)                           ├── id (UUID)                       │
│  ├── brand_id (UUID FK)                  ├── session_id (UUID FK)            │
│  ├── state (ENUM)                        ├── role ('user'|'assistant')       │
│  │   'initial' | 'gathering'             ├── content (TEXT)                  │
│  │   'clarifying' | 'planning'           ├── message_type (ENUM)             │
│  │   'confirming' | 'processing'         │   'text' | 'clarifying_question'  │
│  │   'verifying' | 'delivered'           │   'task_plan' | 'generation'      │
│  │   'cancelled'                         ├── metadata (JSONB)                │
│  ├── campaign_id (UUID FK)               ├── token_count (INT)               │
│  ├── selected_kb_ids (UUID[])            ├── cost (DECIMAL)                  │
│  ├── current_intent (JSONB)              └── created_at                      │
│  ├── pending_questions (JSONB)                                               │
│  └── created_at                                                              │
│                                                                              │
│  task_plans                               generation_jobs                    │
│  ├── id (UUID)                           ├── id (UUID)                       │
│  ├── conversation_id (UUID FK)           ├── campaign_id (UUID FK)           │
│  ├── intent (JSONB)                      ├── type ('video'|'image')          │
│  ├── subtasks (JSONB[])                  ├── status (TEXT)                   │
│  ├── status (ENUM)                       ├── provider (TEXT)                 │
│  │   'pending' | 'in_progress'           ├── output_url (TEXT)               │
│  │   'completed' | 'failed'              ├── error (TEXT)                    │
│  └── created_at                          └── created_at                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.1.2 Current Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CURRENT FLOW (CHAT-BASED)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User opens Chat Interface                                               │
│     │                                                                       │
│     ▼                                                                       │
│  2. Frontend calls POST /api/v1/conversation/start                          │
│     → Creates conversation_sessions row                                     │
│     → Returns session_id                                                    │
│     │                                                                       │
│     ▼                                                                       │
│  3. User types: "Make me a video about protein powder"                      │
│     │                                                                       │
│     ▼                                                                       │
│  4. Frontend calls POST /api/v1/conversation/stream                         │
│     → Executive Agent parses intent                                         │
│     → May ask clarifying questions (stored in conversation_messages)        │
│     → Creates task_plan row                                                 │
│     → SSE streams response                                                  │
│     │                                                                       │
│     ▼                                                                       │
│  5. User confirms task plan                                                 │
│     │                                                                       │
│     ▼                                                                       │
│  6. AgentOrchestrator.executePlan()                                         │
│     → Runs agents sequentially                                              │
│     → Triggers n8n via n8nClient.triggerWorkflow()                          │
│     → Status updates via SSE                                                │
│     │                                                                       │
│     ▼                                                                       │
│  7. n8n completes → Result stored in generation_jobs                        │
│     │                                                                       │
│     ▼                                                                       │
│  8. User sees result in chat                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1.3 Problems with Current Flow

| Problem | Technical Details | Business Impact |
| :--- | :--- | :--- |
| **Session Dependency** | Agents require `conversationId` parameter; `AgentOrchestrator.executePlan()` expects a session context | Cannot trigger generation from a simple form; requires full chat initialization |
| **No Pipeline View** | Status lives in `conversation_sessions.state` which is session-level, not request-level | Cannot show "5 requests in production, 3 in QA" dashboard |
| **No Request List** | No table with one row per content request | Cannot implement Kanban board with request cards |
| **Provider Job Tracking** | External job IDs stored in `generation_jobs.metadata` (JSONB blob) | Hard to query "all Runway jobs that failed this week" |
| **No Audit Trail** | Status changes not logged; must infer from message timestamps | Cannot answer "when did this move to production?" |
| **Cost Attribution** | Costs stored on `conversation_messages` | Cannot aggregate cost per content piece |

## 2.2 Affected Components

### 2.2.1 Database Layer

| Current Table | Problem | Phase 7 Solution |
| :--- | :--- | :--- |
| `conversation_sessions` | Session ≠ Request; one session can have multiple requests | Create `content_requests` as first-class entity |
| `task_plans` | Linked to conversation, not request | Create `request_tasks` linked to `content_requests` |
| `generation_jobs` | Generic; doesn't track per-agent work | `request_tasks` tracks each agent's contribution |
| (none) | No event log | Create `request_events` |
| (none) | No provider tracking | Create `provider_metadata` |

### 2.2.2 API Layer

| Current Endpoint | Problem | Phase 7 Solution |
| :--- | :--- | :--- |
| `POST /api/v1/conversation/start` | Creates session, not request | Create `POST /api/v1/requests` |
| `POST /api/v1/conversation/stream` | Streaming chat, not REST | Create `GET /api/v1/requests/:id` |
| `GET /api/v1/conversation/[id]` | Returns messages, not structured request | Return structured request with tasks/events |
| (none) | No request list endpoint | Create `GET /api/v1/requests` with filtering |
| (none) | No request update endpoint | Create `PATCH /api/v1/requests/:id` |

### 2.2.3 Frontend Layer (Informational - Not Implemented in Phase 7)

| Current Component | Problem | Future Solution |
| :--- | :--- | :--- |
| `ChatInterface.tsx` | Chat-based, not form-based | Replace with Pipeline UI (separate ticket) |
| `TaskPlanPreview.tsx` | Shows plan in chat context | Embed in Request Detail Modal |
| (none) | No Kanban board | Implement Pipeline Board |

## 2.3 Code Archaeology

### 2.3.1 Current Director API Route

File: `frontend/app/api/v1/director/route.ts`

```typescript
// Current implementation (simplified)
export async function POST(request: NextRequest) {
  const { prompt, brandId, campaignId, selectedKBIds } = await request.json();
  
  // 1. Get brand context via RAG
  const context = await getBrandContext(brandId, selectedKBIds);
  
  // 2. Parse intent with GPT
  const parsed = await parseIntent(prompt, context);
  
  // 3. Create campaign record
  const campaign = await supabase
    .from('campaigns')
    .insert({
      brand_id: brandId,
      name: parsed.campaignName,
      status: 'strategizing'
    });
  
  // 4. Trigger n8n workflow
  await n8nClient.triggerWorkflow('/strategist/campaign', {
    campaignId: campaign.id,
    intent: parsed
  });
  
  return NextResponse.json({ campaignId: campaign.id });
}
```

**Issues:**
1. Creates a `campaign`, not a `request` (campaigns are higher-level containers)
2. No `request_id` returned for tracking
3. No task breakdown stored
4. No event logged

### 2.3.2 Current Agent Orchestrator

File: `frontend/lib/ai/agents/orchestrator.ts`

```typescript
// Current implementation (simplified)
class AgentOrchestrator {
  async executePlan(params: {
    plan: TaskPlan;
    intent: ParsedIntent;
    conversationId?: string;  // ← Problem: Requires conversation
    brandContext?: string;
    campaignId?: string;
  }) {
    // Persist plan to task_plans table
    await this.persistPlan(params.plan, params.conversationId);
    
    for (const subtask of params.plan.subtasks) {
      // Execute each subtask
      const result = await this.executeSubtask(subtask);
      
      // Update plan status
      await this.updatePlanStatus(params.plan.id, subtask.id, result);
    }
  }
}
```

**Issues:**
1. `conversationId` is optional but deeply integrated
2. Writes to `task_plans`, not `request_tasks`
3. No provider job tracking
4. No event emission

### 2.3.3 Current n8n Client

File: `frontend/lib/n8n/client.ts`

```typescript
// Current implementation
class N8NClient {
  async triggerWorkflow(path: string, data: object) {
    const response = await fetch(`${this.baseUrl}/webhook${path}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  }
  
  async triggerVideoProduction(params: {
    campaignId: string;
    scenes: Scene[];
    provider: string;
  }) {
    return this.triggerWorkflow('/production/video', params);
  }
}
```

**Issues:**
1. No `request_task_id` passed to n8n
2. No callback URL for completion notification
3. Response not stored in `provider_metadata`

## 2.4 Data Flow Comparison

### 2.4.1 Current Flow (Chat-Based)

```
User Message → conversation_messages → Executive Agent → task_plans → 
  AgentOrchestrator → n8n → generation_jobs → SSE to Chat
```

### 2.4.2 Target Flow (Request-Based)

```
Form Submit → content_requests → API creates request_tasks → 
  (Phase 8) Orchestrator → request_tasks updated → 
  n8n with callback → provider_metadata → request_events logged →
  Pipeline UI fetches via GET /api/v1/requests/:id
```

<!-- CHUNK_1_END -->

---

# SECTION 3: ARCHITECTURAL OVERVIEW

## 3.1 New Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           NEW SCHEMA (PHASE 7)                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐         ┌─────────────────────────────────────────────┐    │
│  │   brands    │         │              content_requests               │    │
│  ├─────────────┤    1:N  ├─────────────────────────────────────────────┤    │
│  │ id (PK)     │◄────────│ brand_id (FK)                               │    │
│  │ name        │         │ id (PK)                                     │    │
│  │ ...         │         │ campaign_id (FK) ──────────────────────┐    │    │
│  └─────────────┘         │ title                                  │    │    │
│                          │ request_type (ENUM)                    │    │    │
│  ┌─────────────┐         │   'video_with_vo' | 'video_no_vo'      │    │    │
│  │  campaigns  │         │   | 'image'                            │    │    │
│  ├─────────────┤    N:1  │ status (ENUM)                          │    │    │
│  │ id (PK)     │◄────────│   'intake' | 'draft' | 'production'    │    │    │
│  │ brand_id    │         │   | 'qa' | 'published' | 'cancelled'   │    │    │
│  │ name        │         │ prompt (TEXT)                          │    │    │
│  │ ...         │         │ duration_seconds (INT)                 │    │    │
│  └─────────────┘         │ aspect_ratio (TEXT)                    │    │    │
│                          │ style_preset (TEXT)                    │    │    │
│                          │ shot_type (TEXT)                       │    │    │
│                          │ voice_id (TEXT)                        │    │    │
│                          │ preferred_provider (TEXT)              │    │    │
│                          │ provider_tier (TEXT)                   │    │    │
│                          │ auto_script (BOOL)                     │    │    │
│                          │ script_text (TEXT)                     │    │    │
│                          │ selected_kb_ids (UUID[])               │    │    │
│                          │ estimated_cost (DECIMAL)               │    │    │
│                          │ estimated_time_seconds (INT)           │    │    │
│                          │ actual_cost (DECIMAL)                  │    │    │
│                          │ thumbnail_url (TEXT)                   │    │    │
│                          │ output_url (TEXT)                      │    │    │
│                          │ created_by (FK → auth.users)           │    │    │
│                          │ created_at (TIMESTAMPTZ)               │    │    │
│                          │ updated_at (TIMESTAMPTZ)               │    │    │
│                          └─────────────────────────────────────────────┘    │
│                                      │                                       │
│                    ┌─────────────────┼─────────────────┐                    │
│                    │                 │                 │                    │
│                    ▼                 ▼                 ▼                    │
│  ┌─────────────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │     request_tasks       │  │ request_events  │  │ provider_metadata   │ │
│  ├─────────────────────────┤  ├─────────────────┤  ├─────────────────────┤ │
│  │ id (PK)                 │  │ id (PK)         │  │ id (PK)             │ │
│  │ request_id (FK)         │  │ request_id (FK) │  │ request_task_id(FK) │ │
│  │ agent_role (ENUM)       │  │ event_type      │  │ provider_name       │ │
│  │   'executive'           │  │   'created'     │  │ external_job_id     │ │
│  │   'task_planner'        │  │   'status_chg'  │  │ request_payload     │ │
│  │   'strategist'          │  │   'task_start'  │  │ response_payload    │ │
│  │   'copywriter'          │  │   'task_done'   │  │ cost_incurred       │ │
│  │   'producer'            │  │   'error'       │  │ created_at          │ │
│  │   'qa'                  │  │   'agent_log'   │  └─────────────────────┘ │
│  │ task_name (TEXT)        │  │ description     │                          │
│  │ status (ENUM)           │  │ metadata(JSONB) │                          │
│  │   'pending'             │  │ actor (TEXT)    │                          │
│  │   'in_progress'         │  │ created_at      │                          │
│  │   'completed'           │  └─────────────────┘                          │
│  │   'failed'              │                                               │
│  │   'skipped'             │                                               │
│  │ sequence_order (INT)    │                                               │
│  │ depends_on (UUID[])     │                                               │
│  │ input_data (JSONB)      │                                               │
│  │ output_data (JSONB)     │                                               │
│  │ output_url (TEXT)       │                                               │
│  │ error_message (TEXT)    │                                               │
│  │ retry_count (INT)       │                                               │
│  │ started_at (TIMESTAMPTZ)│                                               │
│  │ completed_at            │                                               │
│  │ created_at              │                                               │
│  └─────────────────────────┘                                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REQUEST LIFECYCLE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐               │
│  │   INTAKE    │────►│    DRAFT    │────►│   PRODUCTION    │               │
│  │             │     │             │     │                 │               │
│  │ • Validate  │     │ • Strategy  │     │ • Video Gen     │               │
│  │ • Plan tasks│     │ • Script    │     │ • Image Gen     │               │
│  │ • Estimate  │     │ • Storyboard│     │ • Voice Gen     │               │
│  └─────────────┘     └─────────────┘     └─────────────────┘               │
│                                                   │                         │
│                                                   ▼                         │
│                           ┌─────────────┐     ┌─────────────┐              │
│                           │  PUBLISHED  │◄────│     QA      │              │
│                           │             │     │             │              │
│                           │ • Delivered │     │ • Review    │              │
│                           │ • Analytics │     │ • Approve   │              │
│                           └─────────────┘     └─────────────┘              │
│                                                                             │
│  TERMINAL STATES:                                                           │
│  • PUBLISHED - Successfully completed                                       │
│  • CANCELLED - User cancelled or system timeout                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3.3 Task Execution Order

For a typical `video_with_vo` request, tasks are created and executed in this order:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TASK EXECUTION SEQUENCE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Sequence 1 (Parallel OK):                                                  │
│  ┌────────────────────┐  ┌────────────────────┐                            │
│  │  01_orchestration  │  │   02_planning      │                            │
│  │  agent: executive  │  │   agent: planner   │                            │
│  │  "Parse request"   │  │   "Create tasks"   │                            │
│  └────────────────────┘  └────────────────────┘                            │
│             │                      │                                        │
│             └──────────┬───────────┘                                        │
│                        ▼                                                    │
│  Sequence 2:                                                                │
│  ┌────────────────────┐                                                    │
│  │   03_strategy      │                                                    │
│  │  agent: strategist │                                                    │
│  │  "Creative brief"  │                                                    │
│  └────────────────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  Sequence 3:                                                                │
│  ┌────────────────────┐                                                    │
│  │   04_scripting     │                                                    │
│  │  agent: copywriter │                                                    │
│  │  "Generate script" │                                                    │
│  └────────────────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  Sequence 4 (Parallel OK - multiple scenes):                                │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐   │
│  │   05_video_gen     │  │   06_voice_gen     │  │   07_music_gen     │   │
│  │  agent: producer   │  │  agent: producer   │  │  agent: producer   │   │
│  │  "Render video"    │  │  "Generate VO"     │  │  "Select music"    │   │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘   │
│             │                      │                      │                │
│             └──────────────────────┼──────────────────────┘                │
│                                    ▼                                        │
│  Sequence 5:                                                                │
│  ┌────────────────────┐                                                    │
│  │   08_composition   │                                                    │
│  │  agent: producer   │                                                    │
│  │  "Compose final"   │                                                    │
│  └────────────────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  Sequence 6:                                                                │
│  ┌────────────────────┐                                                    │
│  │   09_qa_review     │                                                    │
│  │  agent: qa         │                                                    │
│  │  "Quality check"   │                                                    │
│  └────────────────────┘                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# SECTION 4: DATABASE SCHEMA DESIGN

## 4.1 Migration File

**File:** `supabase/migrations/033_create_content_requests.sql`

```sql
-- =============================================================================
-- Migration: 033_create_content_requests.sql
-- Description: Create request-centric schema for Pipeline UI
-- Phase: 7
-- Author: System
-- Date: 2026-01-04
-- =============================================================================

-- =============================================================================
-- SECTION A: CUSTOM TYPES
-- =============================================================================

-- Request type enum (matches UI form options)
DO $$ BEGIN
    CREATE TYPE request_type AS ENUM (
        'video_with_vo',    -- Video with voiceover
        'video_no_vo',      -- Video without voiceover (music only)
        'image'             -- Static image
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Request status enum (matches Pipeline UI columns)
DO $$ BEGIN
    CREATE TYPE request_status AS ENUM (
        'intake',           -- Just submitted, validating
        'draft',            -- Strategy/scripting in progress
        'production',       -- Media generation in progress
        'qa',               -- Quality review (manual or auto)
        'published',        -- Successfully completed
        'cancelled'         -- User cancelled or system timeout
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Task status enum
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'pending',          -- Not started
        'in_progress',      -- Currently executing
        'completed',        -- Successfully finished
        'failed',           -- Error occurred
        'skipped'           -- Skipped due to dependency failure
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Agent role enum (matches the 5 agents in system)
DO $$ BEGIN
    CREATE TYPE agent_role AS ENUM (
        'executive',        -- Executive/Orchestrator
        'task_planner',     -- Task Planner
        'strategist',       -- Strategist
        'copywriter',       -- Copywriter
        'producer',         -- Producer
        'qa'                -- Quality Assurance
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Event type enum
DO $$ BEGIN
    CREATE TYPE event_type AS ENUM (
        'created',              -- Request created
        'status_change',        -- Request status changed
        'task_started',         -- Agent task started
        'task_completed',       -- Agent task completed
        'task_failed',          -- Agent task failed
        'agent_log',            -- Intermediate agent log message
        'provider_dispatched',  -- Sent to external provider
        'provider_completed',   -- External provider finished
        'provider_failed',      -- External provider error
        'user_action',          -- User took an action (approve, reject)
        'system_error',         -- System-level error
        'retry_initiated'       -- Retry was triggered
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- SECTION B: CONTENT_REQUESTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_requests (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Keys
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    
    -- Core Fields
    title TEXT NOT NULL,
    request_type request_type NOT NULL,
    status request_status NOT NULL DEFAULT 'intake',
    
    -- Creative Requirements
    prompt TEXT NOT NULL,
    duration_seconds INTEGER,                   -- For video types
    aspect_ratio TEXT DEFAULT '16:9',           -- '16:9', '9:16', '1:1', '4:5'
    style_preset TEXT DEFAULT 'Realistic',      -- 'Realistic', 'Animated', 'Cinematic', '3D', 'Sketch'
    shot_type TEXT DEFAULT 'Medium',            -- 'Close-up', 'Wide', 'Medium', 'POV', 'Aerial'
    voice_id TEXT,                              -- ElevenLabs voice ID (for video_with_vo)
    
    -- Provider Settings
    preferred_provider TEXT,                    -- 'pollo', 'runway', 'sora', 'veo3', 'pika', etc.
    provider_tier TEXT DEFAULT 'standard',      -- 'economy', 'standard', 'premium'
    
    -- Script Settings
    auto_script BOOLEAN DEFAULT true,           -- Let AI generate script
    script_text TEXT,                           -- User-provided script (if auto_script = false)
    
    -- Knowledge Base Selection (from Phase 6)
    selected_kb_ids UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Cost & Time Estimates (set on creation)
    estimated_cost DECIMAL(10, 4),
    estimated_time_seconds INTEGER,
    
    -- Actuals (updated during/after processing)
    actual_cost DECIMAL(10, 4) DEFAULT 0,
    
    -- Outputs
    thumbnail_url TEXT,                         -- Preview thumbnail
    output_url TEXT,                            -- Final output URL
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,         -- Extensible metadata
    
    -- Audit Fields
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_content_requests_brand_id 
    ON content_requests(brand_id);

CREATE INDEX IF NOT EXISTS idx_content_requests_campaign_id 
    ON content_requests(campaign_id);

CREATE INDEX IF NOT EXISTS idx_content_requests_status 
    ON content_requests(status);

CREATE INDEX IF NOT EXISTS idx_content_requests_created_by 
    ON content_requests(created_by);

CREATE INDEX IF NOT EXISTS idx_content_requests_created_at 
    ON content_requests(created_at DESC);

-- Composite index for Pipeline UI (filter by brand + status)
CREATE INDEX IF NOT EXISTS idx_content_requests_brand_status 
    ON content_requests(brand_id, status);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_content_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_content_requests_updated_at ON content_requests;
CREATE TRIGGER trigger_content_requests_updated_at
    BEFORE UPDATE ON content_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_content_requests_updated_at();

-- Comments
COMMENT ON TABLE content_requests IS 'Primary table for content generation requests in Pipeline UI';
COMMENT ON COLUMN content_requests.status IS 'Pipeline stage: intake → draft → production → qa → published';
COMMENT ON COLUMN content_requests.provider_tier IS 'Cost tier affecting provider selection: economy, standard, premium';
COMMENT ON COLUMN content_requests.selected_kb_ids IS 'Knowledge bases to include in context (from Phase 6 Multi-KB)';

-- =============================================================================
-- SECTION C: REQUEST_TASKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS request_tasks (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    request_id UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
    
    -- Task Definition
    agent_role agent_role NOT NULL,
    task_name TEXT NOT NULL,                    -- Human-readable name
    task_key TEXT NOT NULL,                     -- Machine key: '01_orchestration', '02_planning', etc.
    status task_status NOT NULL DEFAULT 'pending',
    
    -- Execution Order
    sequence_order INTEGER NOT NULL DEFAULT 0,  -- Lower = earlier
    depends_on UUID[] DEFAULT ARRAY[]::UUID[], -- Task IDs this depends on
    
    -- Input/Output
    input_data JSONB,                           -- Input parameters for this task
    output_data JSONB,                          -- Structured output from agent
    output_url TEXT,                            -- URL if task produces an asset
    
    -- Error Handling
    error_message TEXT,
    error_code TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    timeout_seconds INTEGER DEFAULT 300,        -- 5 minute default timeout
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_request_tasks_request_id 
    ON request_tasks(request_id);

CREATE INDEX IF NOT EXISTS idx_request_tasks_status 
    ON request_tasks(status);

CREATE INDEX IF NOT EXISTS idx_request_tasks_agent_role 
    ON request_tasks(agent_role);

CREATE INDEX IF NOT EXISTS idx_request_tasks_sequence 
    ON request_tasks(request_id, sequence_order);

-- Unique constraint on task_key per request
CREATE UNIQUE INDEX IF NOT EXISTS idx_request_tasks_unique_key 
    ON request_tasks(request_id, task_key);

-- Comments
COMMENT ON TABLE request_tasks IS 'Individual agent tasks for a content request';
COMMENT ON COLUMN request_tasks.sequence_order IS 'Execution order; lower numbers run first';
COMMENT ON COLUMN request_tasks.depends_on IS 'Array of task IDs that must complete before this task';

-- =============================================================================
-- SECTION D: REQUEST_EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS request_events (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Key
    request_id UUID NOT NULL REFERENCES content_requests(id) ON DELETE CASCADE,
    
    -- Optional: Link to specific task
    task_id UUID REFERENCES request_tasks(id) ON DELETE SET NULL,
    
    -- Event Details
    event_type event_type NOT NULL,
    description TEXT NOT NULL,                  -- Human-readable description
    
    -- Structured Data
    metadata JSONB DEFAULT '{}'::jsonb,         -- Event-specific data
    
    -- Actor (who/what caused this event)
    actor TEXT,                                 -- 'user:uuid', 'agent:strategist', 'system', 'n8n'
    
    -- Immutable timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_request_events_request_id 
    ON request_events(request_id);

CREATE INDEX IF NOT EXISTS idx_request_events_task_id 
    ON request_events(task_id);

CREATE INDEX IF NOT EXISTS idx_request_events_type 
    ON request_events(event_type);

CREATE INDEX IF NOT EXISTS idx_request_events_created_at 
    ON request_events(created_at DESC);

-- Composite for timeline queries
CREATE INDEX IF NOT EXISTS idx_request_events_request_timeline 
    ON request_events(request_id, created_at DESC);

-- Comments
COMMENT ON TABLE request_events IS 'Immutable audit log for request lifecycle events';
COMMENT ON COLUMN request_events.actor IS 'Who caused this event: user:uuid, agent:role, system, n8n';

-- =============================================================================
-- SECTION E: PROVIDER_METADATA TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS provider_metadata (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Key (to specific task, not request directly)
    request_task_id UUID NOT NULL REFERENCES request_tasks(id) ON DELETE CASCADE,
    
    -- Provider Info
    provider_name TEXT NOT NULL,                -- 'runway', 'pika', 'elevenlabs', 'openai', etc.
    external_job_id TEXT,                       -- Job ID returned by provider
    
    -- Request/Response
    request_payload JSONB,                      -- What we sent to the provider
    response_payload JSONB,                     -- What the provider returned
    
    -- Status
    provider_status TEXT DEFAULT 'pending',     -- 'pending', 'processing', 'completed', 'failed'
    
    -- Cost Tracking
    cost_incurred DECIMAL(10, 4),               -- Actual cost from provider
    cost_currency TEXT DEFAULT 'USD',
    
    -- Timing
    dispatched_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provider_metadata_task_id 
    ON provider_metadata(request_task_id);

CREATE INDEX IF NOT EXISTS idx_provider_metadata_provider 
    ON provider_metadata(provider_name);

CREATE INDEX IF NOT EXISTS idx_provider_metadata_external_job 
    ON provider_metadata(external_job_id);

CREATE INDEX IF NOT EXISTS idx_provider_metadata_status 
    ON provider_metadata(provider_status);

-- Comments
COMMENT ON TABLE provider_metadata IS 'Tracks external provider API calls for each task';
COMMENT ON COLUMN provider_metadata.external_job_id IS 'Job ID from provider (e.g., Runway generation ID)';

-- =============================================================================
-- SECTION F: HELPER FUNCTIONS
-- =============================================================================

-- Function to log events automatically
CREATE OR REPLACE FUNCTION log_request_event(
    p_request_id UUID,
    p_event_type event_type,
    p_description TEXT,
    p_task_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_actor TEXT DEFAULT 'system'
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO request_events (request_id, task_id, event_type, description, metadata, actor)
    VALUES (p_request_id, p_task_id, p_event_type, p_description, p_metadata, p_actor)
    RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get next executable tasks
CREATE OR REPLACE FUNCTION get_executable_tasks(p_request_id UUID)
RETURNS TABLE (
    task_id UUID,
    task_key TEXT,
    agent_role agent_role
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rt.id,
        rt.task_key,
        rt.agent_role
    FROM request_tasks rt
    WHERE rt.request_id = p_request_id
      AND rt.status = 'pending'
      AND NOT EXISTS (
          -- Check if any dependency is not completed
          SELECT 1
          FROM unnest(rt.depends_on) AS dep_id
          JOIN request_tasks dep ON dep.id = dep_id
          WHERE dep.status != 'completed'
      )
    ORDER BY rt.sequence_order;
END;
$$ LANGUAGE plpgsql;

-- Function to check if all tasks are complete
CREATE OR REPLACE FUNCTION are_all_tasks_complete(p_request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_pending_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_pending_count
    FROM request_tasks
    WHERE request_id = p_request_id
      AND status NOT IN ('completed', 'skipped');
    
    RETURN v_pending_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total cost for a request
CREATE OR REPLACE FUNCTION calculate_request_cost(p_request_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_total DECIMAL;
BEGIN
    SELECT COALESCE(SUM(pm.cost_incurred), 0)
    INTO v_total
    FROM provider_metadata pm
    JOIN request_tasks rt ON rt.id = pm.request_task_id
    WHERE rt.request_id = p_request_id;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION G: TRIGGER FOR AUTO-LOGGING STATUS CHANGES
-- =============================================================================

CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM log_request_event(
            NEW.id,
            'status_change',
            'Status changed from ' || OLD.status::TEXT || ' to ' || NEW.status::TEXT,
            NULL,
            jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
            'system'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_status_change ON content_requests;
CREATE TRIGGER trigger_log_status_change
    AFTER UPDATE ON content_requests
    FOR EACH ROW
    EXECUTE FUNCTION log_status_change();

-- =============================================================================
-- SECTION H: TRIGGER FOR AUTO-LOGGING TASK STATUS CHANGES
-- =============================================================================

CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'in_progress' THEN
            PERFORM log_request_event(
                NEW.request_id,
                'task_started',
                'Task started: ' || NEW.task_name,
                NEW.id,
                jsonb_build_object('agent', NEW.agent_role, 'task_key', NEW.task_key),
                'agent:' || NEW.agent_role::TEXT
            );
        ELSIF NEW.status = 'completed' THEN
            PERFORM log_request_event(
                NEW.request_id,
                'task_completed',
                'Task completed: ' || NEW.task_name,
                NEW.id,
                jsonb_build_object('agent', NEW.agent_role, 'task_key', NEW.task_key),
                'agent:' || NEW.agent_role::TEXT
            );
        ELSIF NEW.status = 'failed' THEN
            PERFORM log_request_event(
                NEW.request_id,
                'task_failed',
                'Task failed: ' || NEW.task_name || ' - ' || COALESCE(NEW.error_message, 'Unknown error'),
                NEW.id,
                jsonb_build_object('agent', NEW.agent_role, 'error', NEW.error_message),
                'agent:' || NEW.agent_role::TEXT
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_task_status_change ON request_tasks;
CREATE TRIGGER trigger_log_task_status_change
    AFTER UPDATE ON request_tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_status_change();

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
```

## 4.2 TypeScript Types

**File:** `frontend/types/pipeline.ts`

```typescript
// =============================================================================
// Pipeline Types for Phase 7
// =============================================================================

// Enums matching database
export type RequestType = 'video_with_vo' | 'video_no_vo' | 'image';

export type RequestStatus = 
  | 'intake' 
  | 'draft' 
  | 'production' 
  | 'qa' 
  | 'published' 
  | 'cancelled';

export type TaskStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'skipped';

export type AgentRole = 
  | 'executive' 
  | 'task_planner' 
  | 'strategist' 
  | 'copywriter' 
  | 'producer' 
  | 'qa';

export type EventType = 
  | 'created'
  | 'status_change'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'agent_log'
  | 'provider_dispatched'
  | 'provider_completed'
  | 'provider_failed'
  | 'user_action'
  | 'system_error'
  | 'retry_initiated';

// Main Request Interface
export interface ContentRequest {
  id: string;
  brand_id: string;
  campaign_id: string | null;
  
  // Core
  title: string;
  request_type: RequestType;
  status: RequestStatus;
  
  // Creative Requirements
  prompt: string;
  duration_seconds: number | null;
  aspect_ratio: string;
  style_preset: string;
  shot_type: string;
  voice_id: string | null;
  
  // Provider Settings
  preferred_provider: string | null;
  provider_tier: 'economy' | 'standard' | 'premium';
  
  // Script
  auto_script: boolean;
  script_text: string | null;
  
  // Knowledge Bases
  selected_kb_ids: string[];
  
  // Estimates
  estimated_cost: number | null;
  estimated_time_seconds: number | null;
  actual_cost: number;
  
  // Outputs
  thumbnail_url: string | null;
  output_url: string | null;
  
  // Metadata
  metadata: Record<string, unknown>;
  
  // Audit
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Task Interface
export interface RequestTask {
  id: string;
  request_id: string;
  
  agent_role: AgentRole;
  task_name: string;
  task_key: string;
  status: TaskStatus;
  
  sequence_order: number;
  depends_on: string[];
  
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  output_url: string | null;
  
  error_message: string | null;
  error_code: string | null;
  retry_count: number;
  max_retries: number;
  
  started_at: string | null;
  completed_at: string | null;
  timeout_seconds: number;
  
  created_at: string;
}

// Event Interface
export interface RequestEvent {
  id: string;
  request_id: string;
  task_id: string | null;
  
  event_type: EventType;
  description: string;
  metadata: Record<string, unknown>;
  actor: string | null;
  
  created_at: string;
}

// Provider Metadata Interface
export interface ProviderMetadata {
  id: string;
  request_task_id: string;
  
  provider_name: string;
  external_job_id: string | null;
  
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  
  provider_status: 'pending' | 'processing' | 'completed' | 'failed';
  
  cost_incurred: number | null;
  cost_currency: string;
  
  dispatched_at: string;
  completed_at: string | null;
  
  created_at: string;
}

// API Response Types
export interface ContentRequestWithRelations extends ContentRequest {
  tasks: RequestTask[];
  events: RequestEvent[];
}

export interface CreateRequestInput {
  brand_id: string;
  campaign_id?: string;
  title: string;
  type: RequestType;
  
  requirements: {
    prompt: string;
    duration?: number;
    aspect_ratio?: string;
    style_preset?: string;
    shot_type?: string;
    voice_id?: string;
  };
  
  settings: {
    provider?: string;
    tier?: 'economy' | 'standard' | 'premium';
    auto_script?: boolean;
    script_text?: string;
    selected_kb_ids?: string[];
  };
}

export interface CreateRequestResponse {
  success: boolean;
  data: {
    id: string;
    status: RequestStatus;
    estimated_cost: number;
    estimated_time_seconds: number;
    created_at: string;
  };
}

export interface ListRequestsParams {
  brand_id: string;
  campaign_id?: string;
  status?: RequestStatus;
  page?: number;
  limit?: number;
}

export interface ListRequestsResponse {
  success: boolean;
  data: ContentRequest[];
  meta: {
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
  };
}
```

<!-- CHUNK_2_END -->

---

# SECTION 5: API SPECIFICATIONS

## 5.1 Endpoint Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| POST | `/api/v1/requests` | Create a new content request | Yes |
| GET | `/api/v1/requests` | List requests with filtering | Yes |
| GET | `/api/v1/requests/:id` | Get request with tasks and events | Yes |
| PATCH | `/api/v1/requests/:id` | Update request (limited fields) | Yes |
| DELETE | `/api/v1/requests/:id` | Cancel/delete a request | Yes |
| POST | `/api/v1/requests/:id/retry` | Retry failed tasks | Yes |
| GET | `/api/v1/requests/:id/events` | Get event timeline | Yes |
| POST | `/api/v1/webhooks/provider-callback` | Receive provider completions | API Key |

## 5.2 Detailed Endpoint Specifications

### 5.2.1 POST /api/v1/requests

**Purpose:** Create a new content request from the Pipeline UI form.

**File:** `frontend/app/api/v1/requests/route.ts`

```typescript
// =============================================================================
// POST /api/v1/requests - Create Content Request
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { calculateEstimate } from '@/lib/pipeline/estimator';
import { createInitialTasks } from '@/lib/pipeline/task-factory';
import { 
  CreateRequestInput, 
  CreateRequestResponse,
  RequestStatus,
  ContentRequest 
} from '@/types/pipeline';

// Validation Schema
const CreateRequestSchema = z.object({
  brand_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  type: z.enum(['video_with_vo', 'video_no_vo', 'image']),
  
  requirements: z.object({
    prompt: z.string().min(10).max(5000),
    duration: z.number().int().min(5).max(300).optional(),
    aspect_ratio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional().default('16:9'),
    style_preset: z.enum(['Realistic', 'Animated', 'Cinematic', '3D', 'Sketch']).optional().default('Realistic'),
    shot_type: z.enum(['Close-up', 'Wide', 'Medium', 'POV', 'Aerial']).optional().default('Medium'),
    voice_id: z.string().optional()
  }),
  
  settings: z.object({
    provider: z.string().optional(),
    tier: z.enum(['economy', 'standard', 'premium']).optional().default('standard'),
    auto_script: z.boolean().optional().default(true),
    script_text: z.string().max(10000).optional(),
    selected_kb_ids: z.array(z.string().uuid()).optional().default([])
  }).optional().default({})
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // 2. Parse and validate input
    const body = await request.json();
    const validation = CreateRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed', 
          details: validation.error.flatten() 
        },
        { status: 400 }
      );
    }
    
    const input = validation.data;
    
    // 3. Verify user has access to brand
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name')
      .eq('id', input.brand_id)
      .single();
    
    if (brandError || !brand) {
      return NextResponse.json(
        { success: false, error: 'Brand not found or access denied' },
        { status: 403 }
      );
    }
    
    // 4. Calculate cost and time estimates
    const estimate = calculateEstimate({
      type: input.type,
      duration: input.requirements.duration,
      provider: input.settings?.provider,
      tier: input.settings?.tier || 'standard',
      hasVoiceover: input.type === 'video_with_vo',
      autoScript: input.settings?.auto_script ?? true
    });
    
    // 5. Create the request record
    const { data: contentRequest, error: insertError } = await supabase
      .from('content_requests')
      .insert({
        brand_id: input.brand_id,
        campaign_id: input.campaign_id || null,
        title: input.title,
        request_type: input.type,
        status: 'intake' as RequestStatus,
        
        // Creative requirements
        prompt: input.requirements.prompt,
        duration_seconds: input.requirements.duration || null,
        aspect_ratio: input.requirements.aspect_ratio,
        style_preset: input.requirements.style_preset,
        shot_type: input.requirements.shot_type,
        voice_id: input.requirements.voice_id || null,
        
        // Provider settings
        preferred_provider: input.settings?.provider || null,
        provider_tier: input.settings?.tier || 'standard',
        
        // Script settings
        auto_script: input.settings?.auto_script ?? true,
        script_text: input.settings?.script_text || null,
        
        // Knowledge bases
        selected_kb_ids: input.settings?.selected_kb_ids || [],
        
        // Estimates
        estimated_cost: estimate.cost,
        estimated_time_seconds: estimate.timeSeconds,
        
        // Audit
        created_by: user.id
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Failed to create request:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to create request' },
        { status: 500 }
      );
    }
    
    // 6. Create initial tasks for this request
    const tasks = await createInitialTasks(supabase, contentRequest.id, input.type);
    
    // 7. Log the creation event (handled by trigger, but we add extra metadata)
    await supabase.from('request_events').insert({
      request_id: contentRequest.id,
      event_type: 'created',
      description: `Request created: ${input.title}`,
      metadata: {
        type: input.type,
        provider: input.settings?.provider,
        tier: input.settings?.tier,
        task_count: tasks.length
      },
      actor: `user:${user.id}`
    });
    
    // 8. Return success response
    const response: CreateRequestResponse = {
      success: true,
      data: {
        id: contentRequest.id,
        status: contentRequest.status,
        estimated_cost: estimate.cost,
        estimated_time_seconds: estimate.timeSeconds,
        created_at: contentRequest.created_at
      }
    };
    
    return NextResponse.json(response, { status: 201 });
    
  } catch (error) {
    console.error('Unexpected error in POST /api/v1/requests:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/v1/requests - List Requests
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brand_id');
    const campaignId = searchParams.get('campaign_id');
    const status = searchParams.get('status') as RequestStatus | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    
    if (!brandId) {
      return NextResponse.json(
        { success: false, error: 'brand_id is required' },
        { status: 400 }
      );
    }
    
    // Build query
    let query = supabase
      .from('content_requests')
      .select('*', { count: 'exact' })
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });
    
    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    
    const { data: requests, error: queryError, count } = await query;
    
    if (queryError) {
      console.error('Failed to list requests:', queryError);
      return NextResponse.json(
        { success: false, error: 'Failed to list requests' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: requests,
      meta: {
        total: count || 0,
        page,
        limit,
        has_more: (count || 0) > offset + limit
      }
    });
    
  } catch (error) {
    console.error('Unexpected error in GET /api/v1/requests:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 5.2.2 GET /api/v1/requests/:id

**Purpose:** Get a single request with all related tasks and events.

**File:** `frontend/app/api/v1/requests/[id]/route.ts`

```typescript
// =============================================================================
// GET /api/v1/requests/:id - Get Request Detail
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContentRequestWithRelations } from '@/types/pipeline';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const requestId = params.id;
    
    // Fetch request with related data
    const { data: contentRequest, error: requestError } = await supabase
      .from('content_requests')
      .select(`
        *,
        tasks:request_tasks(*),
        events:request_events(*)
      `)
      .eq('id', requestId)
      .single();
    
    if (requestError || !contentRequest) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }
    
    // Sort tasks by sequence_order
    contentRequest.tasks = contentRequest.tasks?.sort(
      (a: any, b: any) => a.sequence_order - b.sequence_order
    ) || [];
    
    // Sort events by created_at descending (most recent first)
    contentRequest.events = contentRequest.events?.sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) || [];
    
    return NextResponse.json({
      success: true,
      data: contentRequest as ContentRequestWithRelations
    });
    
  } catch (error) {
    console.error('Unexpected error in GET /api/v1/requests/:id:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/v1/requests/:id - Update Request
// =============================================================================

import { z } from 'zod';

const UpdateRequestSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  status: z.enum(['cancelled']).optional(), // Only allow cancel via PATCH
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const requestId = params.id;
    const body = await request.json();
    const validation = UpdateRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    const updates = validation.data;
    
    // Verify request exists and user has access
    const { data: existing, error: fetchError } = await supabase
      .from('content_requests')
      .select('id, status, brand_id')
      .eq('id', requestId)
      .single();
    
    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }
    
    // Prevent updates to terminal states
    if (existing.status === 'published' || existing.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Cannot update a completed or cancelled request' },
        { status: 400 }
      );
    }
    
    // Apply updates
    const { data: updated, error: updateError } = await supabase
      .from('content_requests')
      .update(updates)
      .eq('id', requestId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Failed to update request:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update request' },
        { status: 500 }
      );
    }
    
    // Log user action if status changed to cancelled
    if (updates.status === 'cancelled') {
      await supabase.from('request_events').insert({
        request_id: requestId,
        event_type: 'user_action',
        description: 'Request cancelled by user',
        metadata: { previous_status: existing.status },
        actor: `user:${user.id}`
      });
    }
    
    return NextResponse.json({
      success: true,
      data: updated
    });
    
  } catch (error) {
    console.error('Unexpected error in PATCH /api/v1/requests/:id:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/v1/requests/:id - Delete Request
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const requestId = params.id;
    
    // Verify request exists
    const { data: existing, error: fetchError } = await supabase
      .from('content_requests')
      .select('id, status')
      .eq('id', requestId)
      .single();
    
    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }
    
    // Only allow delete for intake/cancelled requests
    if (!['intake', 'cancelled'].includes(existing.status)) {
      return NextResponse.json(
        { success: false, error: 'Can only delete requests in intake or cancelled status' },
        { status: 400 }
      );
    }
    
    // Delete (cascades to tasks, events, provider_metadata)
    const { error: deleteError } = await supabase
      .from('content_requests')
      .delete()
      .eq('id', requestId);
    
    if (deleteError) {
      console.error('Failed to delete request:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete request' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: { deleted: true }
    });
    
  } catch (error) {
    console.error('Unexpected error in DELETE /api/v1/requests/:id:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 5.2.3 POST /api/v1/requests/:id/retry

**Purpose:** Retry failed tasks for a request.

**File:** `frontend/app/api/v1/requests/[id]/retry/route.ts`

```typescript
// =============================================================================
// POST /api/v1/requests/:id/retry - Retry Failed Tasks
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const requestId = params.id;
    
    // Verify request exists
    const { data: contentRequest, error: fetchError } = await supabase
      .from('content_requests')
      .select('id, status')
      .eq('id', requestId)
      .single();
    
    if (fetchError || !contentRequest) {
      return NextResponse.json(
        { success: false, error: 'Request not found' },
        { status: 404 }
      );
    }
    
    // Find failed tasks that haven't exceeded max retries
    const { data: failedTasks, error: tasksError } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', requestId)
      .eq('status', 'failed')
      .lt('retry_count', 3); // max_retries default
    
    if (tasksError || !failedTasks?.length) {
      return NextResponse.json(
        { success: false, error: 'No retryable failed tasks found' },
        { status: 400 }
      );
    }
    
    // Reset failed tasks to pending
    const taskIds = failedTasks.map(t => t.id);
    const { error: updateError } = await supabase
      .from('request_tasks')
      .update({
        status: 'pending',
        error_message: null,
        error_code: null,
        started_at: null,
        completed_at: null,
        retry_count: supabase.rpc('increment', { x: 1 }) // Increment retry count
      })
      .in('id', taskIds);
    
    if (updateError) {
      console.error('Failed to reset tasks:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to reset tasks for retry' },
        { status: 500 }
      );
    }
    
    // Log retry event
    await supabase.from('request_events').insert({
      request_id: requestId,
      event_type: 'retry_initiated',
      description: `Retry initiated for ${failedTasks.length} failed task(s)`,
      metadata: { task_ids: taskIds },
      actor: `user:${user.id}`
    });
    
    // If request was in a terminal-ish state, move it back
    if (['cancelled'].includes(contentRequest.status)) {
      // Don't retry cancelled requests
      return NextResponse.json(
        { success: false, error: 'Cannot retry cancelled requests' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        retried_tasks: taskIds.length,
        task_ids: taskIds
      }
    });
    
  } catch (error) {
    console.error('Unexpected error in POST /api/v1/requests/:id/retry:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 5.2.4 POST /api/v1/webhooks/provider-callback

**Purpose:** Receive completion notifications from n8n/providers.

**File:** `frontend/app/api/v1/webhooks/provider-callback/route.ts`

```typescript
// =============================================================================
// POST /api/v1/webhooks/provider-callback - Provider Completion Webhook
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/admin'; // Use admin client for webhooks
import { z } from 'zod';

// Webhook payload schema
const ProviderCallbackSchema = z.object({
  request_task_id: z.string().uuid(),
  provider_name: z.string(),
  status: z.enum(['completed', 'failed']),
  external_job_id: z.string().optional(),
  output_url: z.string().url().optional(),
  error_message: z.string().optional(),
  cost_incurred: z.number().optional(),
  response_payload: z.record(z.unknown()).optional()
});

export async function POST(request: NextRequest) {
  try {
    // 1. Verify webhook authentication
    const authHeader = request.headers.get('x-webhook-secret');
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET;
    
    if (!expectedSecret || authHeader !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // 2. Parse and validate payload
    const body = await request.json();
    const validation = ProviderCallbackSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload', details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    const payload = validation.data;
    
    // 3. Use admin client (bypasses RLS for webhook)
    const supabase = createClient();
    
    // 4. Find the task
    const { data: task, error: taskError } = await supabase
      .from('request_tasks')
      .select('*, request:content_requests(*)')
      .eq('id', payload.request_task_id)
      .single();
    
    if (taskError || !task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }
    
    // 5. Update provider_metadata
    await supabase.from('provider_metadata').insert({
      request_task_id: payload.request_task_id,
      provider_name: payload.provider_name,
      external_job_id: payload.external_job_id || null,
      response_payload: payload.response_payload || null,
      provider_status: payload.status,
      cost_incurred: payload.cost_incurred || null,
      completed_at: new Date().toISOString()
    });
    
    // 6. Update the task
    const taskUpdate: Record<string, unknown> = {
      status: payload.status === 'completed' ? 'completed' : 'failed',
      completed_at: new Date().toISOString()
    };
    
    if (payload.status === 'completed' && payload.output_url) {
      taskUpdate.output_url = payload.output_url;
    }
    
    if (payload.status === 'failed' && payload.error_message) {
      taskUpdate.error_message = payload.error_message;
    }
    
    await supabase
      .from('request_tasks')
      .update(taskUpdate)
      .eq('id', payload.request_task_id);
    
    // 7. Log event
    const eventType = payload.status === 'completed' ? 'provider_completed' : 'provider_failed';
    await supabase.from('request_events').insert({
      request_id: task.request_id,
      task_id: payload.request_task_id,
      event_type: eventType,
      description: payload.status === 'completed' 
        ? `Provider ${payload.provider_name} completed successfully`
        : `Provider ${payload.provider_name} failed: ${payload.error_message || 'Unknown error'}`,
      metadata: {
        provider: payload.provider_name,
        external_job_id: payload.external_job_id,
        cost: payload.cost_incurred
      },
      actor: 'n8n'
    });
    
    // 8. Check if we need to advance the request status
    const { data: allTasks } = await supabase
      .from('request_tasks')
      .select('status, agent_role')
      .eq('request_id', task.request_id);
    
    if (allTasks) {
      const allComplete = allTasks.every(t => t.status === 'completed' || t.status === 'skipped');
      const anyFailed = allTasks.some(t => t.status === 'failed');
      
      if (allComplete && !anyFailed) {
        // Move to next stage or published
        const currentStatus = task.request.status;
        let nextStatus = currentStatus;
        
        if (currentStatus === 'production') {
          nextStatus = 'qa';
        } else if (currentStatus === 'qa') {
          nextStatus = 'published';
        }
        
        if (nextStatus !== currentStatus) {
          await supabase
            .from('content_requests')
            .update({ status: nextStatus })
            .eq('id', task.request_id);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      data: { processed: true }
    });
    
  } catch (error) {
    console.error('Unexpected error in provider callback:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

# SECTION 6: STATUS TRANSITION STATE MACHINE

## 6.1 Valid Transitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STATUS TRANSITION STATE MACHINE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          ┌──────────────┐                                   │
│                          │   INTAKE     │                                   │
│                          └──────┬───────┘                                   │
│                                 │                                           │
│                    ┌────────────┼────────────┐                             │
│                    │            │            │                             │
│                    ▼            ▼            ▼                             │
│            ┌───────────┐  ┌───────────┐  ┌───────────┐                     │
│            │   DRAFT   │  │ CANCELLED │  │ (error)   │                     │
│            └─────┬─────┘  └───────────┘  └───────────┘                     │
│                  │                                                          │
│                  ▼                                                          │
│            ┌───────────┐                                                   │
│            │PRODUCTION │                                                   │
│            └─────┬─────┘                                                   │
│                  │                                                          │
│                  ▼                                                          │
│            ┌───────────┐                                                   │
│            │    QA     │                                                   │
│            └─────┬─────┘                                                   │
│                  │                                                          │
│                  ▼                                                          │
│            ┌───────────┐                                                   │
│            │ PUBLISHED │                                                   │
│            └───────────┘                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6.2 Transition Rules

| From | To | Trigger | Who Can Trigger |
| :--- | :--- | :--- | :--- |
| `intake` | `draft` | All intake tasks complete | System (Orchestrator) |
| `intake` | `cancelled` | User cancels | User |
| `draft` | `production` | All draft tasks complete | System (Orchestrator) |
| `draft` | `cancelled` | User cancels | User |
| `production` | `qa` | All production tasks complete | System (Orchestrator) / n8n callback |
| `production` | `cancelled` | User cancels | User |
| `qa` | `published` | QA approved (auto or manual) | System / User |
| `qa` | `draft` | QA rejected (needs revision) | User |
| `qa` | `cancelled` | User cancels | User |

## 6.3 Transition Enforcement Function

```typescript
// lib/pipeline/status-machine.ts

import { RequestStatus } from '@/types/pipeline';

const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  intake: ['draft', 'cancelled'],
  draft: ['production', 'cancelled'],
  production: ['qa', 'cancelled'],
  qa: ['published', 'draft', 'cancelled'], // Can go back to draft for revisions
  published: [], // Terminal state
  cancelled: []  // Terminal state
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStatus(current: RequestStatus): RequestStatus | null {
  const next = VALID_TRANSITIONS[current];
  // Return first non-cancelled option
  return next?.find(s => s !== 'cancelled') ?? null;
}

export function isTerminalStatus(status: RequestStatus): boolean {
  return status === 'published' || status === 'cancelled';
}

export function getStageForStatus(status: RequestStatus): 'planning' | 'creating' | 'reviewing' | 'done' {
  switch (status) {
    case 'intake':
    case 'draft':
      return 'planning';
    case 'production':
      return 'creating';
    case 'qa':
      return 'reviewing';
    case 'published':
    case 'cancelled':
      return 'done';
  }
}
```

## 6.4 Database Constraint for Transitions

```sql
-- Add to migration file

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Only check if status is changing
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Define valid transitions
    IF (OLD.status = 'intake' AND NEW.status IN ('draft', 'cancelled')) OR
       (OLD.status = 'draft' AND NEW.status IN ('production', 'cancelled')) OR
       (OLD.status = 'production' AND NEW.status IN ('qa', 'cancelled')) OR
       (OLD.status = 'qa' AND NEW.status IN ('published', 'draft', 'cancelled'))
    THEN
        RETURN NEW;
    END IF;
    
    -- Terminal states cannot transition
    IF OLD.status IN ('published', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot transition from terminal status: %', OLD.status;
    END IF;
    
    -- Invalid transition
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_status_transition ON content_requests;
CREATE TRIGGER trigger_validate_status_transition
    BEFORE UPDATE ON content_requests
    FOR EACH ROW
    EXECUTE FUNCTION validate_status_transition();
```

<!-- CHUNK_3_END -->

---

# SECTION 7: COST AND TIME ESTIMATION ENGINE

## 7.1 The Problem

Users need to know **before** they submit:
1. How much will this cost?
2. How long will it take?

This drives the "Estimate" button in the Request Form UI.

## 7.2 Cost Model

### 7.2.1 Provider Pricing Matrix

| Provider | Type | Base Cost | Per-Second Cost | Tier Multiplier |
| :--- | :--- | :--- | :--- | :--- |
| **Pollo** | Video | $0.10 | $0.02/sec | Economy: 1.0x, Standard: 1.0x |
| **Runway** | Video | $0.25 | $0.05/sec | Standard: 1.0x, Premium: 1.2x |
| **Sora 2** | Video | $0.50 | $0.08/sec | Premium only: 1.0x |
| **Veo 3** | Video | $0.40 | $0.06/sec | Premium only: 1.0x |
| **Pika** | Video | $0.15 | $0.03/sec | Economy: 1.0x, Standard: 1.0x |
| **NanoBanna Pro** | Image | $0.05 | N/A | All tiers: 1.0x |
| **Stable Diffusion** | Image | $0.02 | N/A | Economy only: 1.0x |
| **ElevenLabs** | Voice | $0.001/char | N/A | All tiers: 1.0x |
| **OpenAI GPT-4o** | Script | ~$0.02/req | N/A | N/A |

### 7.2.2 Additional Costs

| Component | Cost | Notes |
| :--- | :--- | :--- |
| Script Generation (auto) | $0.02 | GPT-4o-mini for script |
| Strategy Brief | $0.01 | GPT-4o-mini |
| QA Check | $0.005 | GPT-4o-mini |
| Thumbnail Generation | $0.02 | Stable Diffusion |

## 7.3 Estimation Implementation

**File:** `frontend/lib/pipeline/estimator.ts`

```typescript
// =============================================================================
// Cost & Time Estimation Engine
// =============================================================================

export interface EstimateInput {
  type: 'video_with_vo' | 'video_no_vo' | 'image';
  duration?: number;           // Seconds (for video)
  provider?: string;           // Preferred provider
  tier: 'economy' | 'standard' | 'premium';
  hasVoiceover: boolean;
  autoScript: boolean;
  scriptLength?: number;       // Characters (if known)
}

export interface EstimateOutput {
  cost: number;                // Total estimated cost in USD
  timeSeconds: number;         // Total estimated time in seconds
  breakdown: CostBreakdown[];
  confidence: 'high' | 'medium' | 'low';
}

export interface CostBreakdown {
  component: string;
  cost: number;
  time: number;
  notes?: string;
}

// Provider pricing configuration
const PROVIDER_PRICING: Record<string, {
  baseCost: number;
  perSecondCost: number;
  baseTime: number;
  perSecondTime: number;
  tiers: ('economy' | 'standard' | 'premium')[];
}> = {
  pollo: {
    baseCost: 0.10,
    perSecondCost: 0.02,
    baseTime: 30,       // 30 seconds base processing
    perSecondTime: 2,   // 2 seconds processing per second of video
    tiers: ['economy', 'standard']
  },
  runway: {
    baseCost: 0.25,
    perSecondCost: 0.05,
    baseTime: 45,
    perSecondTime: 3,
    tiers: ['standard', 'premium']
  },
  sora: {
    baseCost: 0.50,
    perSecondCost: 0.08,
    baseTime: 60,
    perSecondTime: 4,
    tiers: ['premium']
  },
  veo3: {
    baseCost: 0.40,
    perSecondCost: 0.06,
    baseTime: 50,
    perSecondTime: 3,
    tiers: ['premium']
  },
  pika: {
    baseCost: 0.15,
    perSecondCost: 0.03,
    baseTime: 35,
    perSecondTime: 2,
    tiers: ['economy', 'standard']
  },
  nanobanna: {
    baseCost: 0.05,
    perSecondCost: 0,
    baseTime: 10,
    perSecondTime: 0,
    tiers: ['economy', 'standard', 'premium']
  },
  stable_diffusion: {
    baseCost: 0.02,
    perSecondCost: 0,
    baseTime: 5,
    perSecondTime: 0,
    tiers: ['economy']
  }
};

// Additional component costs
const ADDITIONAL_COSTS = {
  scriptGeneration: { cost: 0.02, time: 15 },
  strategyBrief: { cost: 0.01, time: 10 },
  qaCheck: { cost: 0.005, time: 5 },
  thumbnailGeneration: { cost: 0.02, time: 8 },
  voiceoverGeneration: { costPerChar: 0.001, timePerChar: 0.01 }
};

// Default provider selection by tier and type
const DEFAULT_PROVIDERS: Record<string, Record<string, string>> = {
  video_with_vo: {
    economy: 'pollo',
    standard: 'runway',
    premium: 'sora'
  },
  video_no_vo: {
    economy: 'pollo',
    standard: 'runway',
    premium: 'sora'
  },
  image: {
    economy: 'stable_diffusion',
    standard: 'nanobanna',
    premium: 'nanobanna'
  }
};

export function calculateEstimate(input: EstimateInput): EstimateOutput {
  const breakdown: CostBreakdown[] = [];
  let totalCost = 0;
  let totalTime = 0;
  let confidence: 'high' | 'medium' | 'low' = 'high';
  
  // 1. Determine provider
  const provider = input.provider || DEFAULT_PROVIDERS[input.type]?.[input.tier] || 'pollo';
  const pricing = PROVIDER_PRICING[provider];
  
  if (!pricing) {
    confidence = 'low';
    // Use fallback estimates
    return {
      cost: input.type === 'image' ? 0.10 : 0.50,
      timeSeconds: input.type === 'image' ? 15 : 120,
      breakdown: [{ component: 'Unknown provider estimate', cost: 0.50, time: 120 }],
      confidence: 'low'
    };
  }
  
  // 2. Calculate media generation cost
  const duration = input.duration || 30; // Default 30 seconds for video
  const mediaCost = pricing.baseCost + (pricing.perSecondCost * duration);
  const mediaTime = pricing.baseTime + (pricing.perSecondTime * duration);
  
  breakdown.push({
    component: `${provider} generation`,
    cost: mediaCost,
    time: mediaTime,
    notes: input.type === 'image' ? 'Single image' : `${duration}s video`
  });
  totalCost += mediaCost;
  totalTime += mediaTime;
  
  // 3. Add script generation cost (if auto)
  if (input.autoScript && input.type !== 'image') {
    breakdown.push({
      component: 'Script generation (AI)',
      cost: ADDITIONAL_COSTS.scriptGeneration.cost,
      time: ADDITIONAL_COSTS.scriptGeneration.time
    });
    totalCost += ADDITIONAL_COSTS.scriptGeneration.cost;
    totalTime += ADDITIONAL_COSTS.scriptGeneration.time;
  }
  
  // 4. Add voiceover cost (if applicable)
  if (input.hasVoiceover) {
    // Estimate script length based on duration (avg 150 words/min, 5 chars/word)
    const estimatedChars = input.scriptLength || (duration / 60) * 150 * 5;
    const voCost = estimatedChars * ADDITIONAL_COSTS.voiceoverGeneration.costPerChar;
    const voTime = estimatedChars * ADDITIONAL_COSTS.voiceoverGeneration.timePerChar;
    
    breakdown.push({
      component: 'Voiceover (ElevenLabs)',
      cost: voCost,
      time: voTime,
      notes: `~${Math.round(estimatedChars)} characters`
    });
    totalCost += voCost;
    totalTime += voTime;
    
    // Voiceover length is harder to estimate
    if (!input.scriptLength) {
      confidence = 'medium';
    }
  }
  
  // 5. Add strategy brief cost
  breakdown.push({
    component: 'Strategy brief',
    cost: ADDITIONAL_COSTS.strategyBrief.cost,
    time: ADDITIONAL_COSTS.strategyBrief.time
  });
  totalCost += ADDITIONAL_COSTS.strategyBrief.cost;
  totalTime += ADDITIONAL_COSTS.strategyBrief.time;
  
  // 6. Add QA check cost
  breakdown.push({
    component: 'Quality check',
    cost: ADDITIONAL_COSTS.qaCheck.cost,
    time: ADDITIONAL_COSTS.qaCheck.time
  });
  totalCost += ADDITIONAL_COSTS.qaCheck.cost;
  totalTime += ADDITIONAL_COSTS.qaCheck.time;
  
  // 7. Add thumbnail for videos
  if (input.type !== 'image') {
    breakdown.push({
      component: 'Thumbnail',
      cost: ADDITIONAL_COSTS.thumbnailGeneration.cost,
      time: ADDITIONAL_COSTS.thumbnailGeneration.time
    });
    totalCost += ADDITIONAL_COSTS.thumbnailGeneration.cost;
    totalTime += ADDITIONAL_COSTS.thumbnailGeneration.time;
  }
  
  return {
    cost: Math.round(totalCost * 100) / 100, // Round to 2 decimal places
    timeSeconds: Math.round(totalTime),
    breakdown,
    confidence
  };
}

// Helper to format cost for display
export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

// Helper to format time for display
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}
```

## 7.4 API Integration

The estimation is called during request creation:

```typescript
// In POST /api/v1/requests

const estimate = calculateEstimate({
  type: input.type,
  duration: input.requirements.duration,
  provider: input.settings?.provider,
  tier: input.settings?.tier || 'standard',
  hasVoiceover: input.type === 'video_with_vo',
  autoScript: input.settings?.auto_script ?? true
});

// Store on request
estimated_cost: estimate.cost,
estimated_time_seconds: estimate.timeSeconds,
```

## 7.5 Preview Endpoint

**File:** `frontend/app/api/v1/requests/estimate/route.ts`

```typescript
// =============================================================================
// POST /api/v1/requests/estimate - Preview Cost/Time
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { calculateEstimate, EstimateInput } from '@/lib/pipeline/estimator';
import { z } from 'zod';

const EstimateSchema = z.object({
  type: z.enum(['video_with_vo', 'video_no_vo', 'image']),
  duration: z.number().int().min(5).max(300).optional(),
  provider: z.string().optional(),
  tier: z.enum(['economy', 'standard', 'premium']).default('standard'),
  auto_script: z.boolean().default(true),
  script_length: z.number().int().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = EstimateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    const input = validation.data;
    
    const estimate = calculateEstimate({
      type: input.type,
      duration: input.duration,
      provider: input.provider,
      tier: input.tier,
      hasVoiceover: input.type === 'video_with_vo',
      autoScript: input.auto_script,
      scriptLength: input.script_length
    });
    
    return NextResponse.json({
      success: true,
      data: estimate
    });
    
  } catch (error) {
    console.error('Estimation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate estimate' },
      { status: 500 }
    );
  }
}
```

---

# SECTION 8: RLS POLICIES AND SECURITY

## 8.1 Security Model

All tables use Row Level Security (RLS) to ensure:
1. Users can only see requests for brands they have access to
2. Users can only modify their own requests
3. Webhooks use admin/service role to bypass RLS

## 8.2 RLS Policies

**File:** `supabase/migrations/034_rls_pipeline_tables.sql`

```sql
-- =============================================================================
-- Migration: 034_rls_pipeline_tables.sql
-- Description: Row Level Security for Pipeline tables
-- Phase: 7
-- =============================================================================

-- =============================================================================
-- SECTION A: ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_metadata ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION B: CONTENT_REQUESTS POLICIES
-- =============================================================================

-- Users can view requests for brands they have access to
CREATE POLICY "Users can view their brand requests"
ON content_requests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM brands b
        WHERE b.id = content_requests.brand_id
        AND (
            b.owner_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM brand_members bm
                WHERE bm.brand_id = b.id
                AND bm.user_id = auth.uid()
                AND bm.status = 'active'
            )
        )
    )
);

-- Users can insert requests for brands they have access to
CREATE POLICY "Users can create requests for their brands"
ON content_requests FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM brands b
        WHERE b.id = content_requests.brand_id
        AND (
            b.owner_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM brand_members bm
                WHERE bm.brand_id = b.id
                AND bm.user_id = auth.uid()
                AND bm.status = 'active'
                AND bm.role IN ('admin', 'editor')
            )
        )
    )
);

-- Users can update their own requests
CREATE POLICY "Users can update their brand requests"
ON content_requests FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM brands b
        WHERE b.id = content_requests.brand_id
        AND (
            b.owner_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM brand_members bm
                WHERE bm.brand_id = b.id
                AND bm.user_id = auth.uid()
                AND bm.status = 'active'
                AND bm.role IN ('admin', 'editor')
            )
        )
    )
);

-- Users can delete requests they created (intake/cancelled only - enforced in API)
CREATE POLICY "Users can delete their requests"
ON content_requests FOR DELETE
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM brands b
        WHERE b.id = content_requests.brand_id
        AND b.owner_id = auth.uid()
    )
);

-- =============================================================================
-- SECTION C: REQUEST_TASKS POLICIES
-- =============================================================================

-- Users can view tasks for their requests
CREATE POLICY "Users can view their request tasks"
ON request_tasks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM content_requests cr
        JOIN brands b ON b.id = cr.brand_id
        WHERE cr.id = request_tasks.request_id
        AND (
            b.owner_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM brand_members bm
                WHERE bm.brand_id = b.id
                AND bm.user_id = auth.uid()
            )
        )
    )
);

-- Only service role can insert/update tasks (done by system)
-- No explicit INSERT/UPDATE policies for regular users

-- =============================================================================
-- SECTION D: REQUEST_EVENTS POLICIES
-- =============================================================================

-- Users can view events for their requests
CREATE POLICY "Users can view their request events"
ON request_events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM content_requests cr
        JOIN brands b ON b.id = cr.brand_id
        WHERE cr.id = request_events.request_id
        AND (
            b.owner_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM brand_members bm
                WHERE bm.brand_id = b.id
                AND bm.user_id = auth.uid()
            )
        )
    )
);

-- Users can insert events (for user actions like cancel)
CREATE POLICY "Users can log events for their requests"
ON request_events FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM content_requests cr
        JOIN brands b ON b.id = cr.brand_id
        WHERE cr.id = request_events.request_id
        AND (
            b.owner_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM brand_members bm
                WHERE bm.brand_id = b.id
                AND bm.user_id = auth.uid()
            )
        )
    )
);

-- Events are immutable - no UPDATE or DELETE policies

-- =============================================================================
-- SECTION E: PROVIDER_METADATA POLICIES
-- =============================================================================

-- Users can view provider metadata for their requests
CREATE POLICY "Users can view their provider metadata"
ON provider_metadata FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM request_tasks rt
        JOIN content_requests cr ON cr.id = rt.request_id
        JOIN brands b ON b.id = cr.brand_id
        WHERE rt.id = provider_metadata.request_task_id
        AND (
            b.owner_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM brand_members bm
                WHERE bm.brand_id = b.id
                AND bm.user_id = auth.uid()
            )
        )
    )
);

-- Only service role can insert/update provider metadata

-- =============================================================================
-- SECTION F: SERVICE ROLE BYPASS
-- =============================================================================

-- Note: Service role automatically bypasses RLS in Supabase.
-- The webhook endpoints use createClient() from @supabase/supabase-js with
-- the service_role key, which has full access.
-- This is used for:
-- 1. Provider callbacks (POST /api/v1/webhooks/provider-callback)
-- 2. Orchestrator task updates
-- 3. n8n integrations

-- =============================================================================
-- END OF RLS POLICIES
-- =============================================================================
```

## 8.3 Admin Client for Webhooks

**File:** `frontend/lib/supabase/admin.ts`

```typescript
// =============================================================================
// Supabase Admin Client (Service Role)
// Used for webhooks and system operations that bypass RLS
// =============================================================================

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for admin client');
  }
  
  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
```

## 8.4 Webhook Authentication

Webhooks use a shared secret for authentication:

```typescript
// Webhook secret verification
const authHeader = request.headers.get('x-webhook-secret');
const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

if (!expectedSecret || authHeader !== expectedSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Environment variable required:
```bash
# .env.local
N8N_WEBHOOK_SECRET=your-secure-random-string-here
```

---

# SECTION 9: ERROR HANDLING AND EDGE CASES

## 9.1 Error Categories

| Category | Examples | Handling Strategy |
| :--- | :--- | :--- |
| **Validation Errors** | Invalid input, missing fields | Return 400 with details |
| **Auth Errors** | No token, expired token | Return 401 |
| **Permission Errors** | No access to brand | Return 403 |
| **Not Found** | Invalid request ID | Return 404 |
| **Business Logic** | Invalid transition, max retries | Return 400 with reason |
| **Provider Errors** | Runway API failure | Mark task failed, allow retry |
| **System Errors** | Database down | Return 500, log for monitoring |

## 9.2 Error Response Format

All errors follow a consistent format:

```typescript
interface ErrorResponse {
  success: false;
  error: string;           // Human-readable message
  code?: string;           // Machine-readable code
  details?: unknown;       // Additional context (validation errors, etc.)
}

// Example responses:

// 400 Bad Request
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "fieldErrors": {
      "prompt": ["Must be at least 10 characters"]
    }
  }
}

// 403 Forbidden
{
  "success": false,
  "error": "You do not have access to this brand",
  "code": "ACCESS_DENIED"
}

// 404 Not Found
{
  "success": false,
  "error": "Request not found",
  "code": "NOT_FOUND"
}

// 500 Internal Server Error
{
  "success": false,
  "error": "An unexpected error occurred",
  "code": "INTERNAL_ERROR"
}
```

## 9.3 Edge Cases

### 9.3.1 Concurrent Status Updates

**Problem:** Two processes try to update the same request's status simultaneously.

**Solution:** Use optimistic locking with `updated_at` check:

```typescript
// Check version before update
const { data: current } = await supabase
  .from('content_requests')
  .select('status, updated_at')
  .eq('id', requestId)
  .single();

// Update with version check
const { error } = await supabase
  .from('content_requests')
  .update({ status: newStatus })
  .eq('id', requestId)
  .eq('updated_at', current.updated_at); // Optimistic lock

if (error) {
  // Retry or fail
}
```

### 9.3.2 Task Dependency Cycles

**Problem:** Tasks could theoretically form a dependency cycle (A depends on B, B depends on A).

**Solution:** Validate dependencies on task creation:

```typescript
function detectCycle(tasks: RequestTask[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(taskId: string): boolean {
    visited.add(taskId);
    recursionStack.add(taskId);
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return false;
    
    for (const depId of task.depends_on) {
      if (!visited.has(depId)) {
        if (dfs(depId)) return true;
      } else if (recursionStack.has(depId)) {
        return true; // Cycle detected
      }
    }
    
    recursionStack.delete(taskId);
    return false;
  }
  
  for (const task of tasks) {
    if (!visited.has(task.id)) {
      if (dfs(task.id)) return true;
    }
  }
  
  return false;
}
```

### 9.3.3 Provider Timeout

**Problem:** External provider (Runway, Pika) never responds.

**Solution:** Implement timeout detection:

```sql
-- Function to detect stale tasks
CREATE OR REPLACE FUNCTION get_stale_tasks()
RETURNS TABLE (task_id UUID, request_id UUID, started_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT rt.id, rt.request_id, rt.started_at
    FROM request_tasks rt
    WHERE rt.status = 'in_progress'
      AND rt.started_at < NOW() - (rt.timeout_seconds || ' seconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql;
```

Cron job or scheduled function to handle stale tasks:

```typescript
// Scheduled every 5 minutes
async function handleStaleTasks() {
  const { data: staleTasks } = await supabase.rpc('get_stale_tasks');
  
  for (const task of staleTasks || []) {
    await supabase
      .from('request_tasks')
      .update({
        status: 'failed',
        error_message: 'Task timed out',
        error_code: 'TIMEOUT',
        completed_at: new Date().toISOString()
      })
      .eq('id', task.task_id);
    
    await supabase.from('request_events').insert({
      request_id: task.request_id,
      task_id: task.task_id,
      event_type: 'task_failed',
      description: 'Task timed out after waiting for provider response',
      actor: 'system'
    });
  }
}
```

### 9.3.4 Duplicate Webhook Calls

**Problem:** n8n might call the callback webhook multiple times (retry on network issues).

**Solution:** Idempotency based on `external_job_id`:

```typescript
// Check if we already processed this callback
const { data: existing } = await supabase
  .from('provider_metadata')
  .select('id')
  .eq('request_task_id', payload.request_task_id)
  .eq('external_job_id', payload.external_job_id)
  .eq('provider_status', payload.status)
  .single();

if (existing) {
  // Already processed, return success without re-processing
  return NextResponse.json({ success: true, data: { duplicate: true } });
}
```

### 9.3.5 Request Stuck in Status

**Problem:** All tasks complete but request status doesn't advance.

**Solution:** Trigger to auto-advance status:

```sql
-- Trigger to auto-advance request status when all tasks complete
CREATE OR REPLACE FUNCTION auto_advance_request_status()
RETURNS TRIGGER AS $$
DECLARE
    v_request_id UUID;
    v_current_status request_status;
    v_all_complete BOOLEAN;
    v_any_failed BOOLEAN;
    v_next_status request_status;
BEGIN
    v_request_id := NEW.request_id;
    
    -- Only proceed if task just completed
    IF NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;
    
    -- Get current request status
    SELECT status INTO v_current_status
    FROM content_requests
    WHERE id = v_request_id;
    
    -- Check if all tasks are complete
    SELECT 
        bool_and(status IN ('completed', 'skipped')),
        bool_or(status = 'failed')
    INTO v_all_complete, v_any_failed
    FROM request_tasks
    WHERE request_id = v_request_id;
    
    -- If all complete and none failed, advance status
    IF v_all_complete AND NOT v_any_failed THEN
        v_next_status := CASE v_current_status
            WHEN 'intake' THEN 'draft'
            WHEN 'draft' THEN 'production'
            WHEN 'production' THEN 'qa'
            WHEN 'qa' THEN 'published'
            ELSE v_current_status
        END;
        
        IF v_next_status != v_current_status THEN
            UPDATE content_requests
            SET status = v_next_status
            WHERE id = v_request_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_advance_request ON request_tasks;
CREATE TRIGGER trigger_auto_advance_request
    AFTER UPDATE OF status ON request_tasks
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION auto_advance_request_status();
```

<!-- CHUNK_4_END -->

---

# SECTION 10: FRONTEND INTEGRATION POINTS

## 10.1 Overview

This section documents how the Pipeline UI (built separately) will integrate with the Phase 7 API.

> **Note:** The actual React components are out of scope for Phase 7. This section provides the **contract** for frontend developers.

## 10.2 Data Fetching Hooks

### 10.2.1 useRequests Hook

```typescript
// frontend/hooks/useRequests.ts

import useSWR from 'swr';
import { ListRequestsResponse, RequestStatus } from '@/types/pipeline';

interface UseRequestsParams {
  brandId: string;
  campaignId?: string;
  status?: RequestStatus;
  page?: number;
  limit?: number;
}

export function useRequests(params: UseRequestsParams) {
  const searchParams = new URLSearchParams();
  searchParams.set('brand_id', params.brandId);
  if (params.campaignId) searchParams.set('campaign_id', params.campaignId);
  if (params.status) searchParams.set('status', params.status);
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  
  const { data, error, mutate, isLoading } = useSWR<ListRequestsResponse>(
    `/api/v1/requests?${searchParams.toString()}`,
    fetcher
  );
  
  return {
    requests: data?.data || [],
    meta: data?.meta,
    isLoading,
    isError: !!error,
    mutate
  };
}
```

### 10.2.2 useRequest Hook

```typescript
// frontend/hooks/useRequest.ts

import useSWR from 'swr';
import { ContentRequestWithRelations } from '@/types/pipeline';

export function useRequest(requestId: string | null) {
  const { data, error, mutate, isLoading } = useSWR<{ data: ContentRequestWithRelations }>(
    requestId ? `/api/v1/requests/${requestId}` : null,
    fetcher,
    {
      refreshInterval: 5000 // Poll every 5 seconds for updates
    }
  );
  
  return {
    request: data?.data,
    isLoading,
    isError: !!error,
    mutate
  };
}
```

### 10.2.3 useCreateRequest Hook

```typescript
// frontend/hooks/useCreateRequest.ts

import { useState } from 'react';
import { CreateRequestInput, CreateRequestResponse } from '@/types/pipeline';

export function useCreateRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const createRequest = async (input: CreateRequestInput): Promise<CreateRequestResponse | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to create request');
        return null;
      }
      
      return data;
    } catch (err) {
      setError('Network error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  return { createRequest, isLoading, error };
}
```

## 10.3 Component Integration Map

| UI Component | API Endpoint | Hook | Notes |
| :--- | :--- | :--- | :--- |
| Request Form | POST /api/v1/requests | useCreateRequest | Submit form data |
| Estimate Display | POST /api/v1/requests/estimate | useEstimate | Live cost preview |
| Pipeline Board | GET /api/v1/requests | useRequests | Filter by status |
| Request Card | GET /api/v1/requests/:id | useRequest | Show in modal |
| Agent Timeline | GET /api/v1/requests/:id | useRequest | tasks + events |
| Retry Button | POST /api/v1/requests/:id/retry | useRetryRequest | Trigger retry |
| Cancel Button | PATCH /api/v1/requests/:id | useUpdateRequest | Set status=cancelled |

## 10.4 Pipeline Board Data Structure

The Pipeline Board groups requests by status. Here's how to transform the API response:

```typescript
// Transform flat list into columns
function groupByStatus(requests: ContentRequest[]): Record<RequestStatus, ContentRequest[]> {
  const columns: Record<RequestStatus, ContentRequest[]> = {
    intake: [],
    draft: [],
    production: [],
    qa: [],
    published: [],
    cancelled: []
  };
  
  for (const request of requests) {
    columns[request.status].push(request);
  }
  
  return columns;
}

// Usage in Pipeline Board
const { requests } = useRequests({ brandId });
const columns = groupByStatus(requests);

// Render columns
<div className="board">
  {(['intake', 'draft', 'production', 'qa', 'published'] as const).map(status => (
    <Column key={status} status={status} requests={columns[status]} />
  ))}
</div>
```

## 10.5 Real-Time Updates

For real-time updates, we recommend:

1. **Polling (Simple):** Use SWR's `refreshInterval` (every 5 seconds)
2. **Supabase Realtime (Advanced):** Subscribe to `content_requests` changes

```typescript
// Supabase Realtime subscription (future enhancement)
useEffect(() => {
  const channel = supabase
    .channel('requests')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'content_requests', filter: `brand_id=eq.${brandId}` },
      (payload) => {
        mutate(); // Refresh the list
      }
    )
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}, [brandId, mutate]);
```

## 10.6 Form Submission Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FORM SUBMISSION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User fills form                                                         │
│     │                                                                       │
│     ▼                                                                       │
│  2. User clicks "Get Estimate"                                              │
│     → POST /api/v1/requests/estimate                                        │
│     → Display cost and time                                                 │
│     │                                                                       │
│     ▼                                                                       │
│  3. User clicks "Submit Request"                                            │
│     → POST /api/v1/requests                                                 │
│     → Show loading state                                                    │
│     │                                                                       │
│     ▼                                                                       │
│  4. Response received                                                       │
│     → On success: Show toast, redirect to detail view, refresh board        │
│     → On error: Show error message, keep form data                          │
│     │                                                                       │
│     ▼                                                                       │
│  5. Request appears in Pipeline Board under "Intake"                        │
│     → Card shows title, type, time ago                                      │
│     │                                                                       │
│     ▼                                                                       │
│  6. User can click card to open detail modal                                │
│     → GET /api/v1/requests/:id                                              │
│     → Shows Agent Timeline with tasks and events                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# SECTION 11: MIGRATION STRATEGY

## 11.1 Overview

This migration is **additive**. We are creating new tables without modifying existing ones.
The existing chat-based flow will continue to work until Phase 8 wires the new tables to the orchestrator.

## 11.2 Migration Steps

### Step 1: Create New Tables (Phase 7)

Run the migration:
```bash
cd /path/to/project
supabase migration new 033_create_content_requests
# Copy SQL from Section 4 into the migration file
supabase db push
```

### Step 2: Generate TypeScript Types

```bash
supabase gen types typescript --local > frontend/types/supabase.ts
```

### Step 3: Deploy API Endpoints

Create the following files:
```
frontend/app/api/v1/
├── requests/
│   ├── route.ts              # GET (list), POST (create)
│   ├── estimate/
│   │   └── route.ts          # POST (preview)
│   └── [id]/
│       ├── route.ts          # GET, PATCH, DELETE
│       └── retry/
│           └── route.ts      # POST
└── webhooks/
    └── provider-callback/
        └── route.ts          # POST
```

### Step 4: Add RLS Policies

Run the RLS migration:
```bash
supabase migration new 034_rls_pipeline_tables
# Copy SQL from Section 8 into the migration file
supabase db push
```

### Step 5: Create Helper Libraries

```
frontend/lib/pipeline/
├── estimator.ts              # Cost/time estimation
├── status-machine.ts         # Status transition logic
└── task-factory.ts           # Initial task creation
```

### Step 6: Configure Webhook Secret

Add to `.env.local`:
```bash
N8N_WEBHOOK_SECRET=generate-a-secure-random-string
```

## 11.3 Rollback Plan

Since this is additive:
1. Remove API routes
2. Drop tables via reverse migration:

```sql
-- Rollback migration
DROP TABLE IF EXISTS provider_metadata;
DROP TABLE IF EXISTS request_events;
DROP TABLE IF EXISTS request_tasks;
DROP TABLE IF EXISTS content_requests;

DROP TYPE IF EXISTS event_type;
DROP TYPE IF EXISTS agent_role;
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS request_status;
DROP TYPE IF EXISTS request_type;
```

## 11.4 Data Migration (None Required)

No existing data needs migration. The new tables start empty.
Existing `conversation_sessions`, `task_plans`, and `generation_jobs` remain untouched.

---

# SECTION 12: IMPLEMENTATION ROADMAP

## 12.1 Timeline

| Day | Task | Output |
| :--- | :--- | :--- |
| Day 1 | Database Migration | Tables created, types generated |
| Day 2 | API: Create & List | POST /requests, GET /requests working |
| Day 3 | API: Detail & Update | GET /requests/:id, PATCH working |
| Day 4 | Estimator & Retry | Estimate endpoint, retry endpoint |
| Day 5 | Webhook & RLS | Provider callback, security policies |
| Day 6 | Testing & Docs | All tests pass, API documented |

## 12.2 Task Breakdown

### 12.2.1 Day 1: Database Migration

- [ ] Create migration file `033_create_content_requests.sql`
- [ ] Add all ENUMs (request_type, request_status, task_status, agent_role, event_type)
- [ ] Create `content_requests` table with all columns
- [ ] Create `request_tasks` table with all columns
- [ ] Create `request_events` table with all columns
- [ ] Create `provider_metadata` table with all columns
- [ ] Add indexes for common queries
- [ ] Add helper functions (log_request_event, get_executable_tasks, etc.)
- [ ] Add triggers for auto-logging
- [ ] Run migration locally
- [ ] Generate TypeScript types

### 12.2.2 Day 2: API - Create & List

- [ ] Create `frontend/types/pipeline.ts` with all interfaces
- [ ] Create `frontend/app/api/v1/requests/route.ts`
- [ ] Implement POST handler with validation
- [ ] Implement GET handler with pagination and filtering
- [ ] Create `frontend/lib/pipeline/task-factory.ts`
- [ ] Implement `createInitialTasks()` function
- [ ] Test with Postman/curl

### 12.2.3 Day 3: API - Detail & Update

- [ ] Create `frontend/app/api/v1/requests/[id]/route.ts`
- [ ] Implement GET handler with relations
- [ ] Implement PATCH handler with validation
- [ ] Implement DELETE handler with restrictions
- [ ] Create `frontend/lib/pipeline/status-machine.ts`
- [ ] Add status transition validation
- [ ] Test all endpoints

### 12.2.4 Day 4: Estimator & Retry

- [ ] Create `frontend/lib/pipeline/estimator.ts`
- [ ] Implement cost calculation logic
- [ ] Implement time estimation logic
- [ ] Create `frontend/app/api/v1/requests/estimate/route.ts`
- [ ] Create `frontend/app/api/v1/requests/[id]/retry/route.ts`
- [ ] Test estimation accuracy
- [ ] Test retry flow

### 12.2.5 Day 5: Webhook & RLS

- [ ] Create `frontend/lib/supabase/admin.ts`
- [ ] Create `frontend/app/api/v1/webhooks/provider-callback/route.ts`
- [ ] Implement idempotency check
- [ ] Implement status advancement logic
- [ ] Create migration file `034_rls_pipeline_tables.sql`
- [ ] Add all RLS policies
- [ ] Test RLS with different users
- [ ] Add N8N_WEBHOOK_SECRET to environment

### 12.2.6 Day 6: Testing & Documentation

- [ ] Write test script `scripts/test-pipeline-api.sh`
- [ ] Test full CRUD cycle
- [ ] Test error cases
- [ ] Test RLS policies
- [ ] Update API documentation
- [ ] Create Postman collection
- [ ] Update README with new endpoints

## 12.3 Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          IMPLEMENTATION DEPENDENCIES                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Day 1: Database ──────────┬─────────────────────────────────────────────── │
│                            │                                                │
│                            ▼                                                │
│  Day 2: Create/List ───────┬─────────────────────────────────────────────── │
│                            │                                                │
│                            ▼                                                │
│  Day 3: Detail/Update ─────┬─────────────────────────────────────────────── │
│                            │                                                │
│               ┌────────────┴────────────┐                                  │
│               │                         │                                  │
│               ▼                         ▼                                  │
│  Day 4: Estimator/Retry    Day 5: Webhook/RLS                              │
│               │                         │                                  │
│               └────────────┬────────────┘                                  │
│                            │                                                │
│                            ▼                                                │
│  Day 6: Testing & Docs                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# SECTION 13: VERIFICATION PLAN

## 13.1 Unit Tests

### 13.1.1 Estimator Tests

```typescript
// tests/lib/pipeline/estimator.test.ts

import { calculateEstimate } from '@/lib/pipeline/estimator';

describe('calculateEstimate', () => {
  it('should calculate cost for video_with_vo', () => {
    const estimate = calculateEstimate({
      type: 'video_with_vo',
      duration: 30,
      tier: 'standard',
      hasVoiceover: true,
      autoScript: true
    });
    
    expect(estimate.cost).toBeGreaterThan(0);
    expect(estimate.timeSeconds).toBeGreaterThan(0);
    expect(estimate.breakdown.length).toBeGreaterThan(0);
  });
  
  it('should calculate lower cost for economy tier', () => {
    const economy = calculateEstimate({
      type: 'video_no_vo',
      duration: 30,
      tier: 'economy',
      hasVoiceover: false,
      autoScript: true
    });
    
    const premium = calculateEstimate({
      type: 'video_no_vo',
      duration: 30,
      tier: 'premium',
      hasVoiceover: false,
      autoScript: true
    });
    
    expect(economy.cost).toBeLessThan(premium.cost);
  });
  
  it('should calculate image cost correctly', () => {
    const estimate = calculateEstimate({
      type: 'image',
      tier: 'standard',
      hasVoiceover: false,
      autoScript: false
    });
    
    expect(estimate.cost).toBeLessThan(0.50); // Images are cheaper
    expect(estimate.breakdown).toContainEqual(
      expect.objectContaining({ component: expect.stringContaining('generation') })
    );
  });
});
```

### 13.1.2 Status Machine Tests

```typescript
// tests/lib/pipeline/status-machine.test.ts

import { canTransition, isTerminalStatus } from '@/lib/pipeline/status-machine';

describe('canTransition', () => {
  it('should allow intake -> draft', () => {
    expect(canTransition('intake', 'draft')).toBe(true);
  });
  
  it('should allow intake -> cancelled', () => {
    expect(canTransition('intake', 'cancelled')).toBe(true);
  });
  
  it('should NOT allow intake -> published', () => {
    expect(canTransition('intake', 'published')).toBe(false);
  });
  
  it('should NOT allow published -> anything', () => {
    expect(canTransition('published', 'draft')).toBe(false);
    expect(canTransition('published', 'intake')).toBe(false);
  });
});

describe('isTerminalStatus', () => {
  it('should return true for published', () => {
    expect(isTerminalStatus('published')).toBe(true);
  });
  
  it('should return true for cancelled', () => {
    expect(isTerminalStatus('cancelled')).toBe(true);
  });
  
  it('should return false for production', () => {
    expect(isTerminalStatus('production')).toBe(false);
  });
});
```

## 13.2 Integration Tests

### 13.2.1 API Integration Test Script

**File:** `scripts/test-pipeline-api.sh`

```bash
#!/bin/bash

# =============================================================================
# Pipeline API Integration Tests
# =============================================================================

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
BRAND_ID="${BRAND_ID:-YOUR_TEST_BRAND_ID}"
AUTH_TOKEN="${AUTH_TOKEN:-YOUR_TEST_TOKEN}"

echo "🧪 Testing Pipeline API at $BASE_URL"
echo ""

# Helper function for API calls
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  if [ -z "$data" ]; then
    curl -s -X "$method" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      "$BASE_URL$endpoint"
  else
    curl -s -X "$method" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$endpoint"
  fi
}

# Test 1: Create Request
echo "📝 Test 1: Create Request"
CREATE_RESPONSE=$(api_call POST "/api/v1/requests" '{
  "brand_id": "'$BRAND_ID'",
  "title": "Test Video Request",
  "type": "video_with_vo",
  "requirements": {
    "prompt": "A beautiful sunset over the ocean with calming music",
    "duration": 30,
    "aspect_ratio": "16:9"
  },
  "settings": {
    "tier": "standard",
    "auto_script": true
  }
}')

REQUEST_ID=$(echo $CREATE_RESPONSE | jq -r '.data.id')

if [ "$REQUEST_ID" != "null" ] && [ -n "$REQUEST_ID" ]; then
  echo "✅ Created request: $REQUEST_ID"
else
  echo "❌ Failed to create request"
  echo $CREATE_RESPONSE
  exit 1
fi

# Test 2: Get Request Detail
echo ""
echo "📋 Test 2: Get Request Detail"
DETAIL_RESPONSE=$(api_call GET "/api/v1/requests/$REQUEST_ID")

STATUS=$(echo $DETAIL_RESPONSE | jq -r '.data.status')
TASK_COUNT=$(echo $DETAIL_RESPONSE | jq -r '.data.tasks | length')

if [ "$STATUS" == "intake" ]; then
  echo "✅ Request status is 'intake'"
else
  echo "❌ Unexpected status: $STATUS"
fi

echo "📊 Task count: $TASK_COUNT"

# Test 3: List Requests
echo ""
echo "📃 Test 3: List Requests"
LIST_RESPONSE=$(api_call GET "/api/v1/requests?brand_id=$BRAND_ID")

TOTAL=$(echo $LIST_RESPONSE | jq -r '.meta.total')
echo "✅ Total requests: $TOTAL"

# Test 4: Get Estimate
echo ""
echo "💰 Test 4: Get Estimate"
ESTIMATE_RESPONSE=$(api_call POST "/api/v1/requests/estimate" '{
  "type": "video_with_vo",
  "duration": 60,
  "tier": "premium"
}')

COST=$(echo $ESTIMATE_RESPONSE | jq -r '.data.cost')
TIME=$(echo $ESTIMATE_RESPONSE | jq -r '.data.timeSeconds')
echo "✅ Estimated cost: \$$COST"
echo "✅ Estimated time: ${TIME}s"

# Test 5: Update Request (Cancel)
echo ""
echo "🚫 Test 5: Cancel Request"
CANCEL_RESPONSE=$(api_call PATCH "/api/v1/requests/$REQUEST_ID" '{
  "status": "cancelled"
}')

NEW_STATUS=$(echo $CANCEL_RESPONSE | jq -r '.data.status')
if [ "$NEW_STATUS" == "cancelled" ]; then
  echo "✅ Request cancelled successfully"
else
  echo "❌ Failed to cancel: $NEW_STATUS"
fi

# Test 6: Delete Request
echo ""
echo "🗑️ Test 6: Delete Request"
DELETE_RESPONSE=$(api_call DELETE "/api/v1/requests/$REQUEST_ID")

DELETED=$(echo $DELETE_RESPONSE | jq -r '.data.deleted')
if [ "$DELETED" == "true" ]; then
  echo "✅ Request deleted successfully"
else
  echo "❌ Failed to delete"
fi

echo ""
echo "🎉 All tests passed!"
```

## 13.3 Manual Testing Checklist

### 13.3.1 Create Request

- [ ] POST to `/api/v1/requests` with valid body returns 201
- [ ] Response includes `id`, `status`, `estimated_cost`, `estimated_time_seconds`
- [ ] Request appears in `content_requests` table
- [ ] Initial tasks are created in `request_tasks` table
- [ ] Created event is logged in `request_events` table
- [ ] Request status is `intake`

### 13.3.2 List Requests

- [ ] GET `/api/v1/requests?brand_id=X` returns requests for that brand
- [ ] Pagination works (page, limit params)
- [ ] Status filter works (`?status=production`)
- [ ] Requests from other brands are NOT returned (RLS)

### 13.3.3 Get Request Detail

- [ ] GET `/api/v1/requests/:id` returns request with tasks and events
- [ ] Tasks are sorted by sequence_order
- [ ] Events are sorted by created_at DESC
- [ ] Returns 404 for invalid ID
- [ ] Returns 403 for request from another brand (RLS)

### 13.3.4 Update Request

- [ ] PATCH `/api/v1/requests/:id` with title updates title
- [ ] PATCH with `status: cancelled` cancels the request
- [ ] Cannot update published or cancelled requests (400)
- [ ] Cannot skip statuses (intake -> published)
- [ ] Status change is logged in events

### 13.3.5 Delete Request

- [ ] DELETE `/api/v1/requests/:id` deletes intake requests
- [ ] DELETE deletes cancelled requests
- [ ] Cannot delete production/qa/published requests (400)
- [ ] Cascade deletes tasks, events, provider_metadata

### 13.3.6 Estimate

- [ ] POST `/api/v1/requests/estimate` returns cost and time
- [ ] Economy tier is cheaper than premium
- [ ] Video is more expensive than image
- [ ] Breakdown includes all components

### 13.3.7 Retry

- [ ] POST `/api/v1/requests/:id/retry` resets failed tasks to pending
- [ ] Retry count is incremented
- [ ] Tasks at max retries are not reset
- [ ] Retry event is logged

### 13.3.8 Provider Callback

- [ ] POST `/api/v1/webhooks/provider-callback` updates task status
- [ ] Requires x-webhook-secret header
- [ ] Creates provider_metadata record
- [ ] Logs provider_completed or provider_failed event
- [ ] Auto-advances request status when all tasks complete

## 13.4 Performance Tests

- [ ] List 1000 requests returns in < 500ms
- [ ] Create request completes in < 200ms
- [ ] Get detail with 50 tasks/events returns in < 300ms
- [ ] Indexes are used (check EXPLAIN ANALYZE)

## 13.5 Security Tests

- [ ] Unauthenticated requests return 401
- [ ] User cannot access other brand's requests (RLS)
- [ ] Webhook requires valid secret
- [ ] Cannot inject SQL via input fields (parameterized queries)
- [ ] Rate limiting is in place (future)

---

# APPENDIX A: FILE MANIFEST

| File Path | Purpose |
| :--- | :--- |
| `supabase/migrations/033_create_content_requests.sql` | Database schema |
| `supabase/migrations/034_rls_pipeline_tables.sql` | Row-level security |
| `frontend/types/pipeline.ts` | TypeScript interfaces |
| `frontend/lib/pipeline/estimator.ts` | Cost/time estimation |
| `frontend/lib/pipeline/status-machine.ts` | Status transitions |
| `frontend/lib/pipeline/task-factory.ts` | Task creation |
| `frontend/lib/supabase/admin.ts` | Service role client |
| `frontend/app/api/v1/requests/route.ts` | List & Create |
| `frontend/app/api/v1/requests/[id]/route.ts` | Detail, Update, Delete |
| `frontend/app/api/v1/requests/[id]/retry/route.ts` | Retry endpoint |
| `frontend/app/api/v1/requests/estimate/route.ts` | Estimation endpoint |
| `frontend/app/api/v1/webhooks/provider-callback/route.ts` | Provider webhook |
| `scripts/test-pipeline-api.sh` | Integration tests |

---

# APPENDIX B: ENVIRONMENT VARIABLES

| Variable | Required | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for webhooks |
| `N8N_WEBHOOK_SECRET` | Yes | Shared secret for n8n callbacks |

---

**END OF PHASE 7 MANIFESTO**

---

*Document Statistics:*
- Total Sections: 13
- Total Lines: ~1000
- Tables: 25+
- Code Blocks: 40+
- Diagrams: 8
