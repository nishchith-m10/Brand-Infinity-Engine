# 🚀 Cursor Handoff: Phase 6 Part 2 Implementation

> **Context**: You are being handed off this Next.js + Supabase project to implement Phase 6 Part 2 (Multi-Agent Creative Director). This project has extensive history that you have zero context about. This document gives you everything you need to know.

---

## 📋 QUICK START FOR CURSOR

**Your Mission**: Implement Phase 6 Part 2 - Multi-Agent Creative Director Architecture based on the comprehensive manifesto at [`docs/plans/PHASE_6_PART_II_AGENT_ARCHITECTURE_MANIFESTO.md`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/docs/plans/PHASE_6_PART_II_AGENT_ARCHITECTURE_MANIFESTO.md).

**Start Here**:

1. Read this entire handoff document
2. Review [`PHASE_6_PART_II_AGENT_ARCHITECTURE_MANIFESTO.md`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/docs/plans/PHASE_6_PART_II_AGENT_ARCHITECTURE_MANIFESTO.md) (2,832 lines of L10-grade specs)
3. Check [`PHASE_6_PART_I_MULTI_KB_MANIFESTO.md`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/docs/plans/PHASE_6_PART_I_MULTI_KB_MANIFESTO.md) to understand the multi-KB foundation
4. Begin implementation following the manifesto's sequence

---

## 🏗️ PROJECT OVERVIEW

### What is the Brand Infinity Engine?

A **Next.js 15 + Supabase** marketing automation platform that generates branded content for social media. Think: "User says 'Create TikTok about our protein powder' → AI agent asks clarifying questions → produces script, voiceover, video via n8n workflows."

**Tech Stack**:

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes (serverless)
- **Database**: Supabase (PostgreSQL with RLS)
- **Orchestration**: n8n workflows (hosted on DigitalOcean)
- **AI**: OpenAI (currently), expanding to multi-provider in Phase 6 Part 2
- **Storage**: Supabase Storage for brand assets

**Architecture Philosophy**: "L10 Engineering" - production-grade, anti-fragile, enterprise-ready from day one.

---

## 📍 CURRENT STATE (What's Been Completed)

### ✅ Phase 1-3: Foundation

- Next.js app with authentication (Supabase Auth)
- Dashboard UI with Analytics, Campaigns, Distribution, Brand Vault pages
- Supabase database with RLS policies
- n8n integration webhooks

### ✅ Phase 4: The Spine (Orchestration Core)

- 8 sub-workflows in n8n for common operations:
  - `Log_Cost_Event`, `Acquire_Lock`, `Cost_Validator`, etc.
- Main workflows for TikTok, Instagram, LinkedIn content generation
- Cost tracking and idempotency built into every workflow
- Located in: [`brand-infinity-workflows/`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/brand-infinity-workflows/)

### ✅ Phase 6 Part 1: Multi-Knowledge Base Architecture

**Status**: COMPLETE ✅

**What Was Built**:

1. **Database Schema**:
   - `knowledge_bases` table - user-created content collections
   - `knowledge_base_assets` - many-to-many linking table
   - `campaign_knowledge_bases` - campaign-specific KBs
   - Migrations: [`supabase/migrations/026-029`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/supabase/migrations/)

2. **Backend APIs**:
   - `GET/POST /api/v1/knowledge-bases` - CRUD for KBs
   - `GET/PATCH/DELETE /api/v1/knowledge-bases/[id]` - Individual KB ops
   - `GET/PATCH /api/v1/brand-assets` - Asset management with KB filtering
   - `POST /api/v1/brand-assets/upload` - File upload to Supabase Storage

3. **Frontend UI**:
   - Brand Vault page with 3 tabs: Assets, Identity, Knowledge Bases
   - KB selector dropdown for filtering assets
   - Upload files directly to specific KBs
   - [`frontend/app/(dashboard)/brand-vault/page.tsx`](<file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/frontend/app/(dashboard)/brand-vault/page.tsx>)

**Key Design Decision**: **One KB per campaign** - campaigns select which KB to use for context. The Creative Director will load assets from the selected KB.

---

## 🎯 PHASE 6 PART 2: YOUR TASK

### What You're Building

A **conversational, multi-agent AI Creative Director** that:

1. User types: "Create a TikTok about our new protein powder"
2. Executive Agent asks clarifying questions (KB to use, product variant, key message)
3. Strategist Agent creates task plan
4. Specialist Agents (Copywriter, Producer) execute tasks
5. Verifier Agent checks quality
6. System triggers n8n workflows for actual content generation

### The 5-Agent Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  EXECUTIVE AGENT (Tier 1) - GPT-4o                         │
│  Orchestrates everything, asks questions, makes decisions   │
└────────────────┬────────────────────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
┌─────▼─────────┐    ┌─────▼─────────┐
│  STRATEGIST   │    │   VERIFIER    │
│   (Tier 2)    │    │   (Tier 2)    │
│  GPT-4o-mini  │    │  GPT-4o-mini  │
│  Task planner │    │ Quality check │
└───────┬───────┘    └───────────────┘
        │
    ┌───┴───┐
    │       │
┌───▼───┐ ┌─▼─────┐
│WRITER │ │PRODUCER│
│Tier 3 │ │ Tier 3 │
└───────┘ └────────┘
```

### The Conversation Flow

**Session State Machine**:

```
gathering → clarifying → planning → processing → verifying → delivered
```

**User Experience**:

- Chat interface at `/creative-director`
- Conversational, not form-based
- Agent asks questions, user answers with buttons or text
- Real-time status updates as tasks execute

### Database Requirements

**New Tables Needed** (defined in manifesto Section 4):

1. **conversation_sessions** - track user conversations
2. **conversation_messages** - chat history
3. **clarifying_questions** - store agent questions
4. **task_plans** - strategic breakdown of requests
5. **task_executions** - track individual task runs
6. **agent_errors** - capture failures for debugging

**New Columns on Existing Tables**:

- `campaigns.knowledge_base_id` - link campaign to KB
- `campaigns.creative_director_session_id` - link to conversation

All schemas are in **Section 4** of the manifesto.

### API Routes to Build

**Primary Endpoints** (Section 5):

1. **POST /api/v1/director** - Start new conversation
   - Creates session, sends initial greeting
   - Returns session_id and first message

2. **POST /api/v1/director/message** - Continue conversation
   - Processes user response
   - Routes to appropriate agent
   - Returns next message/question or triggers execution

3. **GET /api/v1/director/sessions** - List user's sessions

4. **GET /api/v1/director/sessions/[id]** - Get session details

5. **GET /api/v1/director/task-plans/[id]** - Get task plan details

6. **POST /api/v1/director/task-plans/[id]/execute** - Trigger execution

### Frontend Components to Build

**New Page** (Section 13):

- `/app/(dashboard)/creative-director/page.tsx` - Main chat interface

**Components** (Section 13.2-13.3):

- `DirectorChat.tsx` - Main conversation UI
- `MessageBubble.tsx` - Chat message display
- `QuestionsForm.tsx` - Render clarifying questions
- `PlanPreview.tsx` - Show task plan before execution
- `TaskStatusCard.tsx` - Real-time execution status
- `KBSelector.tsx` - Select knowledge base for session

### NEW: Multi-Provider LLM Selection 🆕

**Critical Addition** (Section 14.3 - JUST ADDED):

Allow users to choose their AI provider for cost/quality optimization:

**Supported Providers**:

- OpenAI (GPT-4o) - Default, $5/1M tokens
- Anthropic (Claude 3.5 Sonnet) - Creative writing, $3/1M
- DeepSeek (V3) - Ultra-cheap, $0.27/1M (20x cheaper!)
- Gemini (2.0 Flash) - Fast/multimodal, $0.075/1M
- Kimi (K2) - Long context (128k+), $0.20/1M
- OpenRouter - Access to 100+ models

**What to Build**:

1. **Backend**: Unified LLM service that abstracts provider differences
   - `lib/llm/unified-service.ts` - Single interface for all providers
   - `lib/llm/credentials.ts` - Encrypted API key storage

2. **Database**:
   - `user_llm_providers` table - store encrypted API keys per user
   - `users.default_llm_provider` - user's preferred provider

3. **Frontend**:
   - Provider selector in chat UI (compact dropdown)
   - Settings page: `/settings/ai-providers`
   - Cost comparison dashboard

4. **API Updates**:
   - Director API accepts `provider` parameter
   - Falls back to user's default if not specified
   - Logs cost per provider for analytics

**See Section 14.3** for complete implementation details including:

- Provider configuration
- Cost calculation
- Error handling
- Security (encrypted keys)
- UI mockups

---

## 📂 KEY FILES TO UNDERSTAND

### Documentation (READ FIRST)

1. [`PHASE_6_PART_II_AGENT_ARCHITECTURE_MANIFESTO.md`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/docs/plans/PHASE_6_PART_II_AGENT_ARCHITECTURE_MANIFESTO.md) - **YOUR BIBLE** (2,832 lines)
2. [`PHASE_6_PART_I_MULTI_KB_MANIFESTO.md`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/docs/plans/PHASE_6_PART_I_MULTI_KB_MANIFESTO.md) - Prerequisite knowledge
3. [`PHASE_4_IMPLEMENTATION_MANIFESTO.md`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/docs/plans/PHASE_4_IMPLEMENTATION_MANIFESTO.md) - How n8n workflows work

### Existing Code to Reference

1. **Supabase Setup**: [`lib/supabase/server.ts`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/frontend/lib/supabase/server.ts) - How to auth users
2. **API Pattern**: [`app/api/v1/brand-assets/route.ts`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/frontend/app/api/v1/brand-assets/route.ts) - Example of good API structure
3. **Chat UI Reference**: [`app/(dashboard)/campaigns/page.tsx`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/frontend/app/api/v1/campaigns/route.ts) - Similar state management pattern
4. **Types**: [`app/(dashboard)/brand-vault/types.ts`](<file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/frontend/app/(dashboard)/brand-vault/types.ts>) - Example of type organization

### n8n Workflows (Do NOT Modify)

- Location: [`brand-infinity-workflows/`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/brand-infinity-workflows/)
- **You DO NOT need to edit these**
- Your backend will **trigger** them via webhook
- Webhook URL: `process.env.N8N_WEBHOOK_URL` (from `.env.local`)

---

## 🔧 ENVIRONMENT SETUP

### What's Already Configured

**Frontend** ([`.env.local`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/frontend/.env.local)):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vciscdagwhdpstaviakz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG... # (full key in file)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... # For API routes
N8N_WEBHOOK_URL=https://n8n-deployment-hlnal.ondigitalocean.app/webhook
UPSTASH_REDIS_REST_URL=https://unified-flamingo-41027.upstash.io
UPSTASH_REDIS_REST_TOKEN=AaBD... # For caching
```

**Database**: Supabase project already provisioned

- URL: https://vciscdagwhdpstaviakz.supabase.co
- Run migrations: Place SQL in `supabase/migrations/` (numbered sequentially)

**What You Need to Add**:

- `OPENAI_API_KEY` - For default LLM provider
- Optionally: `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, etc. for multi-provider support

### Running the App

```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:3001
```

---

## 🚨 CRITICAL CONSTRAINTS

### 1. **DO NOT Break Existing Features**

- Brand Vault, Campaigns, Analytics, Distribution pages are working
- Do NOT modify their code unless manifesto explicitly requires it
- All changes should be additive

### 2. **Follow the Manifesto Religiously**

- Section numbers correspond to implementation order
- Database schema (Section 4) must be created FIRST
- API routes (Section 5-11) come NEXT
- Frontend (Section 13) comes LAST
- Code examples in manifesto are production-ready - use them

### 3. **Security & RLS**

- ALL database tables need Row Level Security policies
- Users can only access their own data
- API routes must use `createClient()` from `lib/supabase/server.ts`
- Never use `createAdminClient()` unless manifesto specifies

### 4. **Error Handling**

- Every API route returns structured errors:
  ```typescript
  { success: false, error: { code: 'ERROR_CODE', message: 'User-friendly message' } }
  ```
- See Section 15 for error categories and retry logic

### 5. **Cost Logging**

- Every LLM call must log cost to Supabase
- Track tokens, cost, provider, model
- See Section 14 for cost optimization strategies

---

## 📝 IMPLEMENTATION SEQUENCE

### Week 1: Database & Backend Core

1. **Day 1-2**: Create all 6 tables from Section 4
   - Run migrations in Supabase
   - Add RLS policies
   - Test with SQL queries

2. **Day 3-4**: Build Executive Agent API
   - `POST /api/v1/director` - Start conversation
   - `POST /api/v1/director/message` - Continue conversation
   - Implement state machine (Section 6.1)

3. **Day 5**: Build Agent Manager Classes
   - `ExecutiveManager` (Section 7)
   - `StrategistManager` (Section 8)
   - `VerifierManager` (Section 11)

### Week 2: Specialist Agents & Frontend

4. **Day 6-7**: Specialist Agents
   - `CopywriterManager` (Section 9)
   - `ProducerManager` (Section 10)
   - n8n webhook integration

5. **Day 8-9**: Frontend Chat Interface
   - Create `/creative-director` page
   - `DirectorChat` component
   - `MessageBubble` with question rendering
   - Real-time status updates

6. **Day 10**: Multi-Provider LLM System (NEW)
   - Unified LLM service
   - Provider selector UI
   - Encrypted credential storage
   - Settings page for API keys

### Week 3: Testing & Polish

7. **Day 11-12**: Integration Testing
   - End-to-end conversation flows
   - Test all providers
   - Verify n8n webhooks fire correctly

8. **Day 13-14**: Error Handling & Edge Cases
   - Retry logic for LLM failures
   - Partial plan execution recovery
   - User-friendly error messages

9. **Day 15**: Documentation & Handoff
   - Update README with Creative Director usage
   - Create user guide
   - Prepare for production deployment

---

## 🎨 UI/UX GUIDELINES

### Design System (Already Established)

- **Colors**: Lama theme (indigo primary, slate neutrals)
- **Components**: shadcn/ui components (already installed)
- **Icons**: Lucide React (already in use)
- **Animation**: Framer Motion (already installed)

### Chat Interface Requirements

- Clean, modern design like ChatGPT
- User messages on right (indigo background)
- Agent messages on left (slate background)
- Clarifying questions as interactive buttons
- Task plan preview before execution
- Real-time status indicators during processing

**See Section 13** for complete UI mockups.

---

## 🧪 TESTING CHECKLIST

Before marking Phase 6 Part 2 complete:

- [ ] Can start a new conversation
- [ ] Executive agent asks relevant clarifying questions
- [ ] Questions render as clickable options
- [ ] Can answer with text or buttons
- [ ] Strategist creates realistic task plan
- [ ] Task plan shown for user approval
- [ ] "Execute" triggers n8n workflows
- [ ] Task status updates in real-time
- [ ] Verifier runs quality checks
- [ ] Session marked as "delivered" on success
- [ ] Error handling graceful for LLM failures
- [ ] Multi-provider selection works for all 6 providers
- [ ] Cost tracking accurate per provider
- [ ] RLS policies prevent data leakage
- [ ] Mobile responsive

---

## 💡 TIPS FOR SUCCESS

### 1. Start Small, Iterate

Don't try to build everything at once. **Minimum Viable Flow**:

1. User sends message → Executive stores it
2. Executive asks ONE question → User clicks button
3. Strategist creates simple 1-task plan → Show to user
4. Execute → Call ONE n8n workflow → Mark done

Then expand from there.

### 2. Use the Code Examples

The manifesto has 500+ lines of TypeScript. **Don't reinvent**. Copy, adapt, test.

### 3. Test in Supabase SQL Editor First

Before writing API routes, test queries directly:

```sql
-- Example: Get active sessions for user
SELECT * FROM conversation_sessions
WHERE user_id = 'your-user-id'
AND state != 'delivered';
```

### 4. Log Everything During Development

```typescript
console.log("[Executive Agent] Processing message:", message);
console.log("[Strategist] Generated plan:", plan);
```

Remove before production.

### 5. Ask Clarifying Questions

If the manifesto is unclear, check:

- Section 16: FAQ
- Section 17: Diagrams
- Phase 6 Part 1 manifesto for KB context

---

## 📞 HANDOFF NOTES FROM PREVIOUS AI

### Recent Fixes (Last Session)

- ✅ Fixed 429 infinite loop in Brand Vault (useEffect dependencies)
- ✅ Created `brands` table (was missing)
- ✅ Fixed 405 error on brand identity save
- ✅ Brand Vault fully functional now

### Known Issues

- None critical. All Phase 1-6.1 features working.
- Real-time sync not yet implemented (Phase 6.2 responsibility)

### Code Quality Standards

- **L10 Engineering**: Production-grade from day one
- Type everything (no `any`)
- Error handling on every API call
- RLS on every table
- User-friendly error messages
- Cost logging on every LLM call

---

## 🚀 YOUR FIRST STEPS

1. **Read the Manifesto** - [`PHASE_6_PART_II_AGENT_ARCHITECTURE_MANIFESTO.md`](file:///Users/nishchith.g.m/Desktop/UpShot_project/Brand-Infinity-Engine/docs/plans/PHASE_6_PART_II_AGENT_ARCHITECTURE_MANIFESTO.md)
2. **Create Migration 030** - All 6 tables from Section 4
3. **Test Database** - Run queries to verify schema
4. **Build Executive API** - Start with `/api/v1/director` (POST)
5. **Test Conversation** - Use Postman/cURL to start a session
6. **Frontend Shell** - Create `/creative-director/page.tsx` with basic layout
7. **Iterate** - Follow the implementation sequence above

---

## 📚 ADDITIONAL CONTEXT

### Why "Creative Director"?

The agent hierarchy mimics a real creative agency:

- **Creative Director** (Executive) - oversees everything, makes final decisions
- **Strategist** - breaks down requests into tasks
- **Copywriter** - writes scripts, hooks, CTAs
- **Producer** - coordinates technical execution (video, audio)
- **Quality Assurance** (Verifier) - checks the output

### Why Multi-Provider LLM?

- **Cost**: DeepSeek is 20x cheaper than GPT-4o for similar quality
- **Quality**: Claude excels at creative writing
- **Resilience**: If OpenAI is down, switch to Anthropic
- **Future-proof**: New models emerge constantly

### Why Knowledge Bases?

Instead of uploading assets per-campaign, users create reusable KBs:

- "Core Brand Identity" - logos, colors, voice
- "Product Catalog" - all products
- "Campaign: Holiday 2025" - seasonal assets

The Creative Director loads the selected KB as context.

---

## ✅ SUCCESS CRITERIA

Phase 6 Part 2 is complete when:

1. **Functional Conversation**: User can have a full conversation from "Create content" → Task execution → Delivered
2. **Multi-Provider Support**: User can select any of 6 LLM providers and it works
3. **Quality Output**: Generated content matches user's brand voice (from KB)
4. **Cost Efficient**: Using GPT-4o-mini for routine agents, GPT-4o only for Executive
5. **Production Ready**: Error handling, retry logic, RLS, logging all in place
6. **Documented**: User can understand how to use Creative Director without reading code

---

## 🎯 GOOD LUCK!

You have everything you need:

- ✅ 2,832 lines of L10-grade specs
- ✅ Working foundation (DB, Auth, n8n)
- ✅ Code examples for every component
- ✅ Clear implementation sequence

**The manifesto is your source of truth.** When in doubt, re-read it.

If you need to reference the full conversation history, it's in Cursor's context. But the manifesto should answer 95% of your questions.

**Start with Section 4 (Database Schema) and work sequentially through the manifesto.**

🚀 **Let's build something amazing!**

---

_Handoff created: 2025-12-26_  
_From: Gemini Pro (Google AI Studio)_  
_To: Cursor AI (Claude/GPT-4)_  
_Project: Brand Infinity Engine - Phase 6 Part 2_
