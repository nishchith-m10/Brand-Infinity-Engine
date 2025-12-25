# PHASE 5 IMPLEMENTATION MANIFESTO

## Brand Infinity Engine: Full-Stack Integration & Dashboard Activation

**Document Classification:** L10 SYSTEMS ARCHITECTURE  
**Version:** 1.0.0  
**Status:** PROPOSED FOR APPROVAL  
**Target:** Complete Frontend ↔ Backend ↔ n8n Integration

---

## TABLE OF CONTENTS

1. [Executive Summary & Mission Criticality](#section-1-executive-summary--mission-criticality)
2. [The Integration Architecture](#section-2-the-integration-architecture)
3. [Pillar A: Supabase Integration Layer](#section-3-pillar-a-supabase-integration-layer)
4. [Pillar B: n8n Webhook Gateway](#section-4-pillar-b-n8n-webhook-gateway)
5. [Pillar C: API Routes Implementation](#section-5-pillar-c-api-routes-implementation)
6. [Pillar D: Dashboard Page Activation](#section-6-pillar-d-dashboard-page-activation)
7. [Pillar E: Real-Time State Management](#section-7-pillar-e-real-time-state-management)
8. [API Contract Definitions](#section-8-api-contract-definitions)
9. [Error Handling & Fallback Protocols](#section-9-error-handling--fallback-protocols)
10. [Security Implementation](#section-10-security-implementation)
11. [Testing & Verification](#section-11-testing--verification)
12. [Implementation Roadmap](#section-12-implementation-roadmap)

---

# SECTION 1: EXECUTIVE SUMMARY & MISSION CRITICALITY

## 1.1 The "Complete Circuit" Philosophy

Phase 4 built the **nervous system** (n8n workflows). Phase 5 connects the **sensory organs** (frontend) to the **muscles** (backend/database). Without this connection, the nervous system cannot receive input or produce output.

### The Current State Problem

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │  X  │   Backend   │  X  │    n8n      │
│  (Next.js)  │     │  (API/DB)   │     │ (Workflows) │
└─────────────┘     └─────────────┘     └─────────────┘
     STATIC              STUB              READY
```

- Frontend displays static data
- API routes are minimal stubs
- n8n workflows are fully configured but not triggered

### The Target State (Phase 5 Complete)

```
┌─────────────┐ ──► ┌─────────────┐ ──► ┌─────────────┐
│  Frontend   │     │   Backend   │     │    n8n      │
│  (Next.js)  │ ◄── │  (API/DB)   │ ◄── │ (Workflows) │
└─────────────┘     └─────────────┘     └─────────────┘
   FUNCTIONAL       INTEGRATED          TRIGGERED
```

- Frontend displays real data from Supabase
- API routes handle CRUD and trigger n8n webhooks
- n8n workflows execute on user actions

---

## 1.2 The L10 Interface Contract (Phase 5 Specific)

### Contract 1: One-Way Data Flow

```
User Action → Frontend → API Route → Supabase/n8n → Response → Frontend Update
```

The frontend NEVER writes directly to Supabase for workflow-related data. All mutations go through API routes that can enforce validation, logging, and n8n triggering.

### Contract 2: Optimistic UI with Server Confirmation

The frontend may show optimistic updates for user experience, but must reconcile with server state within 5 seconds. SWR's revalidation handles this automatically.

### Contract 3: n8n as the Single Source of Business Logic

API routes are thin wrappers. They:

- Validate input
- Write initial records to Supabase
- Trigger n8n webhooks
- Return acknowledgment

All complex business logic lives in n8n workflows.

### Contract 4: Webhook-First Architecture

Every user action that spawns a workflow triggers an n8n webhook. Webhooks are fire-and-forget from the API perspective. Status updates come via polling or webhooks.

### Contract 5: Progressive Enhancement

The dashboard must function (read-only mode) even if n8n is unavailable. Workflow triggers gracefully degrade with user notification.

---

## 1.3 Success Metrics

| Metric                           | Target  | Measurement                               |
| :------------------------------- | :------ | :---------------------------------------- |
| Dashboard Load Time              | < 2s    | Lighthouse First Contentful Paint         |
| API Response Time (non-workflow) | < 200ms | P95 latency                               |
| Workflow Trigger Time            | < 500ms | Time from click to webhook acknowledgment |
| Data Consistency                 | 100%    | No stale data after 5 second revalidation |
| Error Rate                       | < 1%    | API error responses / total requests      |

---

# SECTION 2: THE INTEGRATION ARCHITECTURE

## 2.1 System Component Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js)                         │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Dashboard  │  │  Campaigns  │  │   Videos    │  │  Analytics  │  │
│  │    Page     │  │    Page     │  │    Page     │  │    Page     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │                │         │
│         ▼                ▼                ▼                ▼         │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    SWR Hooks (lib/hooks/use-api.ts)             │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                  │                                   │
│                                  ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                  API Client (lib/api-client.ts)                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        API ROUTES (app/api/)                         │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  /campaigns │  │   /videos   │  │   /briefs   │  │  /analytics │  │
│  │             │  │             │  │             │  │             │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │                │         │
│         ▼                ▼                ▼                ▼         │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              Supabase Server Client (@supabase/ssr)             │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                    │                              │                  │
│                    ▼                              ▼                  │
│  ┌────────────────────────────┐    ┌────────────────────────────┐   │
│  │      Supabase Database     │    │    n8n Webhook Gateway     │   │
│  │       (Read/Write)         │    │   (Workflow Triggers)      │   │
│  └────────────────────────────┘    └────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

## 2.2 Technology Stack

| Layer            | Technology               | Purpose                              |
| :--------------- | :----------------------- | :----------------------------------- |
| Frontend         | Next.js 14+ (App Router) | SSR, Server Components, API Routes   |
| State Management | SWR                      | Data fetching, caching, revalidation |
| Database Client  | @supabase/ssr            | Server-side Supabase access          |
| HTTP Client      | Axios                    | External API calls (n8n webhooks)    |
| Validation       | Zod                      | Request/Response validation          |
| Auth             | Supabase Auth            | User authentication                  |
| Environment      | Next.js env vars         | Configuration management             |

## 2.3 Directory Structure (New/Modified Files)

```
frontend/
├── app/
│   ├── api/
│   │   └── v1/                          [NEW] Versioned API namespace
│   │       ├── campaigns/
│   │       │   ├── route.ts             [NEW] GET/POST campaigns
│   │       │   └── [id]/
│   │       │       ├── route.ts         [NEW] GET/PUT/DELETE single campaign
│   │       │       └── trigger/
│   │       │           └── route.ts     [NEW] POST trigger workflow stage
│   │       ├── briefs/
│   │       │   └── route.ts             [NEW] GET/POST briefs
│   │       ├── scripts/
│   │       │   └── route.ts             [NEW] GET/POST scripts
│   │       ├── videos/
│   │       │   └── route.ts             [NEW] GET/POST videos
│   │       ├── publications/
│   │       │   └── route.ts             [NEW] GET/POST publications
│   │       ├── dashboard/
│   │       │   └── stats/
│   │       │       └── route.ts         [NEW] GET dashboard metrics
│   │       └── health/
│   │           └── route.ts             [NEW] GET system health
│   └── (dashboard)/
│       ├── page.tsx                     [MODIFY] Connect to real data
│       ├── campaigns/
│       │   ├── page.tsx                 [MODIFY] Connect to API
│       │   └── [id]/
│       │       └── page.tsx             [MODIFY] Connect to API
│       ├── videos/
│       │   └── page.tsx                 [MODIFY] Connect to API
│       └── distribution/
│           └── page.tsx                 [MODIFY] Connect to API
├── lib/
│   ├── supabase/
│   │   ├── client.ts                    [NEW] Browser client
│   │   ├── server.ts                    [NEW] Server client factory
│   │   └── types.ts                     [NEW] Database types
│   ├── n8n/
│   │   ├── client.ts                    [NEW] n8n webhook client
│   │   └── types.ts                     [NEW] Webhook payload types
│   └── hooks/
│       └── use-api.ts                   [MODIFY] Update to use real endpoints
```

---

# SECTION 3: PILLAR A - SUPABASE INTEGRATION LAYER

**Mandate:** Establish secure, type-safe database access from Next.js API routes.

---

## 3.1 Sub-System: Supabase Server Client

### Concept

Server-side Supabase client that:

- Runs in API routes (Node.js runtime)
- Uses service role key for full database access
- Does NOT expose credentials to browser

### Implementation: `lib/supabase/server.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { Database } from "./types";

// Server-side Supabase client (API routes only)
export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

### Security Rules

| Rule                         | Implementation                                               |
| :--------------------------- | :----------------------------------------------------------- |
| Service key NEVER in browser | Only import in API routes, never in components               |
| Row Level Security bypass    | Service key bypasses RLS - API routes enforce access control |
| Connection pooling           | Supabase handles pooling via Supavisor                       |

---

## 3.2 Sub-System: Type-Safe Database Access

### Concept

Generate TypeScript types from Supabase schema to prevent runtime type errors.

### Implementation: Generate Types

```bash
# Run from project root
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > frontend/lib/supabase/types.ts
```

### Usage in API Routes

```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data });
}
```

---

## 3.3 Sub-System: Query Patterns

### Standard CRUD Patterns

| Operation   | Supabase Method                   | HTTP Method |
| :---------- | :-------------------------------- | :---------- |
| List        | `.select()`                       | GET         |
| Create      | `.insert()`                       | POST        |
| Read Single | `.select().eq('id', id).single()` | GET         |
| Update      | `.update().eq('id', id)`          | PUT/PATCH   |
| Delete      | `.delete().eq('id', id)`          | DELETE      |

### Join Patterns (Related Data)

```typescript
// Campaign with related briefs, scripts, videos
const { data } = await supabase
  .from("campaigns")
  .select(
    `
    *,
    creative_briefs (*),
    scripts (*),
    videos (*)
  `
  )
  .eq("campaign_id", campaignId)
  .single();
```

### Pagination Pattern

```typescript
// Paginated list with count
const { data, count, error } = await supabase
  .from("campaigns")
  .select("*", { count: "exact" })
  .range(offset, offset + limit - 1)
  .order("created_at", { ascending: false });
```

---

# SECTION 4: PILLAR B - N8N WEBHOOK GATEWAY

**Mandate:** Establish reliable, secure communication between API routes and n8n workflows.

---

## 4.1 Sub-System: n8n Client

### Concept

Centralized client for triggering n8n webhooks with:

- Consistent error handling
- Request/response logging
- Timeout management
- Retry logic

### Implementation: `lib/n8n/client.ts`

```typescript
import axios, { AxiosInstance } from "axios";

const N8N_WEBHOOK_BASE =
  process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook";

class N8nClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: N8N_WEBHOOK_BASE,
      timeout: 30000, // 30 second timeout
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async triggerWorkflow(
    webhookPath: string,
    payload: Record<string, unknown>
  ): Promise<{
    success: boolean;
    workflowExecutionId?: string;
    error?: string;
  }> {
    try {
      const response = await this.client.post(webhookPath, payload);
      return {
        success: true,
        workflowExecutionId: response.data?.executionId,
      };
    } catch (error) {
      console.error(`n8n webhook error (${webhookPath}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const n8nClient = new N8nClient();
```

---

## 4.2 Sub-System: Webhook Mapping

### Webhook Endpoints (n8n → Frontend Actions)

| Frontend Action | Webhook Path           | n8n Workflow          | Payload Schema        |
| :-------------- | :--------------------- | :-------------------- | :-------------------- |
| Create Campaign | `/strategist/campaign` | Strategist_Main       | CampaignCreatePayload |
| Generate Brief  | `/strategist/brief`    | Strategist_Main       | BriefGeneratePayload  |
| Generate Script | `/copywriter/script`   | Copywriter_Main       | ScriptGeneratePayload |
| Dispatch Video  | `/production/dispatch` | Production_Dispatcher | VideoDispatchPayload  |
| Publish Video   | `/broadcaster/publish` | Broadcaster_Main      | PublishPayload        |
| Handle Approval | `/approval/handle`     | Approval_Handler      | ApprovalPayload       |

### Payload Schemas

```typescript
// lib/n8n/types.ts

export interface CampaignCreatePayload {
  campaign_id: string;
  brand_id: string;
  campaign_name: string;
  target_demographic: string;
  campaign_objective: string;
  budget_tier: "low" | "medium" | "high" | "premium";
  user_id: string;
}

export interface ScriptGeneratePayload {
  campaign_id: string;
  brief_id: string;
  hook_count: number;
  variant_tag: "aggressive" | "balanced" | "soft";
  target_duration: number;
}

export interface VideoDispatchPayload {
  campaign_id: string;
  script_id: string;
  quality: "draft" | "standard" | "high" | "premium";
  priority: "speed" | "balanced" | "quality";
}

export interface PublishPayload {
  campaign_id: string;
  video_id: string;
  platforms: string[];
  scheduled_time?: string;
}
```

---

## 4.3 Sub-System: Fire-and-Forget with Status Tracking

### Concept

API routes trigger webhooks asynchronously. The workflow updates campaign status in the database. Frontend polls for status updates via SWR.

### Pattern

```typescript
// 1. API Route triggers webhook
const result = await n8nClient.triggerWorkflow("/production/dispatch", {
  campaign_id: campaignId,
  script_id: scriptId,
  quality: "standard",
});

// 2. Return immediately with acknowledgment
return Response.json({
  success: true,
  message: "Video generation started",
  campaign_id: campaignId,
});

// 3. n8n workflow runs asynchronously
// 4. Workflow updates campaign.status in Supabase
// 5. Frontend SWR hook revalidates and shows new status
```

---

# SECTION 5: PILLAR C - API ROUTES IMPLEMENTATION

**Mandate:** Create RESTful API endpoints that bridge frontend to backend/n8n.

---

## 5.1 API Route: Campaigns

### `app/api/v1/campaigns/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { n8nClient } from "@/lib/n8n/client";
import { z } from "zod";

// Validation schema
const CreateCampaignSchema = z.object({
  campaign_name: z.string().min(1).max(100),
  brand_id: z.string().uuid(),
  target_demographic: z.string().optional(),
  campaign_objective: z.string().optional(),
  budget_tier: z.enum(["low", "medium", "high", "premium"]).default("medium"),
});

// GET /api/v1/campaigns
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const searchParams = request.nextUrl.searchParams;

  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = supabase
    .from("campaigns")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data,
    meta: { count, limit, offset },
  });
}

// POST /api/v1/campaigns
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();

  const body = await request.json();
  const validation = CreateCampaignSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.errors },
      { status: 400 }
    );
  }

  const campaignData = validation.data;

  // 1. Create campaign record in Supabase
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      campaign_name: campaignData.campaign_name,
      brand_id: campaignData.brand_id,
      status: "draft",
      budget_limit_usd: getBudgetLimit(campaignData.budget_tier),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2. Trigger Strategist workflow (optional auto-start)
  if (body.auto_start) {
    await n8nClient.triggerWorkflow("/strategist/campaign", {
      campaign_id: campaign.campaign_id,
      brand_id: campaign.brand_id,
      ...campaignData,
    });
  }

  return NextResponse.json(
    {
      success: true,
      data: campaign,
      message: body.auto_start
        ? "Campaign created and workflow started"
        : "Campaign created",
    },
    { status: 201 }
  );
}

function getBudgetLimit(tier: string): number {
  const budgets = { low: 50, medium: 150, high: 500, premium: 2000 };
  return budgets[tier as keyof typeof budgets] || 150;
}
```

---

## 5.2 API Route: Campaign Trigger

### `app/api/v1/campaigns/[id]/trigger/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { n8nClient } from "@/lib/n8n/client";

// POST /api/v1/campaigns/[id]/trigger
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const campaignId = params.id;
  const body = await request.json();
  const { action } = body;

  // Get current campaign state
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("campaign_id", campaignId)
    .single();

  if (error || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Determine which workflow to trigger based on action
  const workflowMap: Record<
    string,
    { path: string; payload: Record<string, unknown> }
  > = {
    generate_brief: {
      path: "/strategist/brief",
      payload: { campaign_id: campaignId, brand_id: campaign.brand_id },
    },
    generate_script: {
      path: "/copywriter/script",
      payload: { campaign_id: campaignId, brief_id: body.brief_id },
    },
    generate_video: {
      path: "/production/dispatch",
      payload: {
        campaign_id: campaignId,
        script_id: body.script_id,
        quality: body.quality || "standard",
      },
    },
    publish: {
      path: "/broadcaster/publish",
      payload: {
        campaign_id: campaignId,
        video_id: body.video_id,
        platforms: body.platforms,
      },
    },
  };

  const workflow = workflowMap[action];
  if (!workflow) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Trigger n8n workflow
  const result = await n8nClient.triggerWorkflow(
    workflow.path,
    workflow.payload
  );

  if (!result.success) {
    return NextResponse.json(
      { error: "Failed to trigger workflow", details: result.error },
      { status: 500 }
    );
  }

  // Update campaign status to indicate workflow triggered
  await supabase
    .from("campaigns")
    .update({ status: getNewStatus(action) })
    .eq("campaign_id", campaignId);

  return NextResponse.json({
    success: true,
    message: `${action} workflow triggered`,
    execution_id: result.workflowExecutionId,
  });
}

function getNewStatus(action: string): string {
  const statusMap: Record<string, string> = {
    generate_brief: "strategizing",
    generate_script: "writing",
    generate_video: "producing",
    publish: "publishing",
  };
  return statusMap[action] || "processing";
}
```

---

## 5.3 API Route: Dashboard Stats

### `app/api/v1/dashboard/stats/route.ts`

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /api/v1/dashboard/stats
export async function GET() {
  const supabase = createSupabaseServerClient();

  // Parallel queries for dashboard metrics
  const [campaignsResult, videosResult, costResult, publishedResult] =
    await Promise.all([
      // Total campaigns by status
      supabase.from("campaigns").select("status", { count: "exact" }),

      // Video generation stats
      supabase.from("generation_jobs").select("status", { count: "exact" }),

      // Total cost this month
      supabase
        .from("cost_ledger")
        .select("cost_usd")
        .gte("created_at", getFirstOfMonth()),

      // Published content count
      supabase
        .from("platform_posts")
        .select("*", { count: "exact" })
        .eq("status", "published"),
    ]);

  // Calculate metrics
  const totalCost =
    costResult.data?.reduce(
      (sum, row) => sum + parseFloat(row.cost_usd || "0"),
      0
    ) || 0;

  return NextResponse.json({
    success: true,
    data: {
      campaigns: {
        total: campaignsResult.count || 0,
        by_status: groupByStatus(campaignsResult.data || []),
      },
      videos: {
        total: videosResult.count || 0,
        by_status: groupByStatus(videosResult.data || []),
      },
      cost: {
        this_month_usd: totalCost.toFixed(2),
      },
      publications: {
        total_published: publishedResult.count || 0,
      },
    },
  });
}

function getFirstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function groupByStatus(data: { status: string }[]): Record<string, number> {
  return data.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}
```

---

# SECTION 6: PILLAR D - DASHBOARD PAGE ACTIVATION

**Mandate:** Connect dashboard UI components to real API data.

---

## 6.1 Page Updates Required

| Page                                   | Current State  | Target State                             |
| :------------------------------------- | :------------- | :--------------------------------------- |
| `/(dashboard)/page.tsx`                | Static metrics | Real-time from `/api/v1/dashboard/stats` |
| `/(dashboard)/campaigns/page.tsx`      | Hardcoded list | Live from `/api/v1/campaigns`            |
| `/(dashboard)/campaigns/[id]/page.tsx` | Static details | Live from `/api/v1/campaigns/[id]`       |
| `/(dashboard)/videos/page.tsx`         | Hardcoded      | Live from `/api/v1/videos`               |
| `/(dashboard)/distribution/page.tsx`   | Static         | Live from `/api/v1/publications`         |
| `/(dashboard)/analytics/page.tsx`      | Static         | Live from `/api/v1/analytics/overview`   |

---

## 6.2 Hook Integration Pattern

### Example: Campaign List Page

```tsx
// app/(dashboard)/campaigns/page.tsx
"use client";

import { useCampaigns, useCreateCampaign } from "@/lib/hooks/use-api";

export default function CampaignsPage() {
  const { data: campaigns, isLoading, error } = useCampaigns();
  const { trigger: createCampaign, isMutating } = useCreateCampaign();

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;

  return (
    <div>
      <CampaignHeader onCreateNew={createCampaign} />
      <CampaignGrid campaigns={campaigns?.data || []} />
    </div>
  );
}
```

---

## 6.3 Workflow Status Display

### Status Badge Component

```tsx
// components/ui/campaign-status-badge.tsx
const statusConfig = {
  draft: { color: "gray", label: "Draft" },
  strategizing: { color: "blue", label: "Strategizing...", animate: true },
  writing: { color: "purple", label: "Writing Script...", animate: true },
  producing: { color: "orange", label: "Generating Video...", animate: true },
  ready: { color: "green", label: "Ready" },
  publishing: { color: "cyan", label: "Publishing...", animate: true },
  published: { color: "emerald", label: "Published" },
  failed: { color: "red", label: "Failed" },
};

export function CampaignStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { color: "gray", label: status };

  return (
    <Badge color={config.color} animate={config.animate}>
      {config.label}
    </Badge>
  );
}
```

---

# SECTION 7: PILLAR E - REAL-TIME STATE MANAGEMENT

**Mandate:** Keep frontend synchronized with backend state changes.

---

## 7.1 SWR Configuration

### Global SWR Config

```tsx
// app/providers.tsx
import { SWRConfig } from "swr";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        refreshInterval: 5000, // Revalidate every 5 seconds
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        errorRetryCount: 3,
        onError: (error) => {
          console.error("SWR Error:", error);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
```

---

## 7.2 Polling During Workflow Execution

### Hook with Conditional Polling

```typescript
// lib/hooks/use-api.ts

export function useCampaign(campaignId: string | null) {
  return useSWR(
    campaignId ? `/api/v1/campaigns/${campaignId}` : null,
    fetcher,
    {
      // Poll faster when campaign is in a processing state
      refreshInterval: (data) => {
        const processingStates = [
          "strategizing",
          "writing",
          "producing",
          "publishing",
        ];
        if (data && processingStates.includes(data.status)) {
          return 2000; // Poll every 2 seconds during processing
        }
        return 10000; // Slow poll when stable
      },
    }
  );
}
```

---

# SECTION 8: API CONTRACT DEFINITIONS

## 8.1 Standard Response Format

```typescript
// Success Response
{
  "success": true,
  "data": T,
  "meta": {
    "timestamp": "ISO8601",
    "count"?: number,
    "limit"?: number,
    "offset"?: number
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details"?: any
  }
}
```

## 8.2 Full API Endpoint Specification

| Method | Endpoint                        | Description       | Request Body          | Response                  |
| :----- | :------------------------------ | :---------------- | :-------------------- | :------------------------ |
| GET    | `/api/v1/campaigns`             | List campaigns    | -                     | Campaign[]                |
| POST   | `/api/v1/campaigns`             | Create campaign   | CreateCampaignDTO     | Campaign                  |
| GET    | `/api/v1/campaigns/:id`         | Get campaign      | -                     | Campaign with relations   |
| PUT    | `/api/v1/campaigns/:id`         | Update campaign   | UpdateCampaignDTO     | Campaign                  |
| DELETE | `/api/v1/campaigns/:id`         | Archive campaign  | -                     | { success: true }         |
| POST   | `/api/v1/campaigns/:id/trigger` | Trigger workflow  | { action, ...params } | { success, execution_id } |
| GET    | `/api/v1/briefs`                | List briefs       | -                     | Brief[]                   |
| POST   | `/api/v1/briefs`                | Generate brief    | GenerateBriefDTO      | Brief                     |
| GET    | `/api/v1/scripts`               | List scripts      | -                     | Script[]                  |
| POST   | `/api/v1/scripts`               | Generate script   | GenerateScriptDTO     | Script                    |
| GET    | `/api/v1/videos`                | List videos       | -                     | Video[]                   |
| POST   | `/api/v1/videos`                | Generate video    | GenerateVideoDTO      | Video                     |
| GET    | `/api/v1/publications`          | List publications | -                     | Publication[]             |
| POST   | `/api/v1/publications`          | Publish video     | PublishDTO            | Publication               |
| GET    | `/api/v1/dashboard/stats`       | Dashboard metrics | -                     | DashboardStats            |
| GET    | `/api/v1/health`                | System health     | -                     | HealthStatus              |

---

# SECTION 9: ERROR HANDLING & FALLBACK PROTOCOLS

## 9.1 Error Handling Matrix

| Error Type       | HTTP Status | Frontend Behavior            | User Message                              |
| :--------------- | :---------- | :--------------------------- | :---------------------------------------- |
| Validation Error | 400         | Show field errors            | "Please fix the highlighted fields"       |
| Not Found        | 404         | Redirect or show empty state | "Campaign not found"                      |
| Auth Error       | 401         | Redirect to login            | "Please sign in again"                    |
| n8n Unavailable  | 503         | Disable workflow buttons     | "Workflow system unavailable"             |
| Database Error   | 500         | Show retry button            | "Something went wrong. Please try again." |
| Rate Limit       | 429         | Show cooldown timer          | "Too many requests. Please wait."         |

## 9.2 Graceful Degradation

```typescript
// API route with fallback
export async function GET() {
  try {
    // Primary: Real-time data
    const { data } = await supabase.from("campaigns").select("*");
    return NextResponse.json({ data, source: "live" });
  } catch (error) {
    // Fallback: Cached data
    const cached = await redis.get("campaigns:cache");
    if (cached) {
      return NextResponse.json({ data: JSON.parse(cached), source: "cache" });
    }
    // Last resort: Empty state
    return NextResponse.json({
      data: [],
      source: "fallback",
      error: "Database unavailable",
    });
  }
}
```

---

# SECTION 10: SECURITY IMPLEMENTATION

## 10.1 Security Requirements

| Requirement              | Implementation                          |
| :----------------------- | :-------------------------------------- |
| API Authentication       | Supabase Auth (JWT in cookies/headers)  |
| Input Validation         | Zod schemas on all endpoints            |
| SQL Injection Prevention | Supabase client (parameterized queries) |
| n8n Webhook Auth         | Shared secret in headers                |
| Rate Limiting            | Redis-based per-user limits             |
| CORS                     | Next.js config (same-origin)            |

## 10.2 n8n Webhook Authentication

```typescript
// lib/n8n/client.ts
const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;

async triggerWorkflow(path: string, payload: unknown) {
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return this.client.post(path, payload, {
    headers: {
      'x-webhook-signature': signature,
    },
  });
}
```

---

# SECTION 11: TESTING & VERIFICATION

## 11.1 Test Categories

| Category          | Tool                   | Coverage Target     |
| :---------------- | :--------------------- | :------------------ |
| Unit Tests        | Jest                   | API route handlers  |
| Integration Tests | Jest + Supabase        | Database operations |
| E2E Tests         | Playwright             | Full user flows     |
| API Tests         | Postman/Thunder Client | All endpoints       |

## 11.2 Manual Verification Checklist

- [ ] Dashboard loads with real campaign count
- [ ] Create campaign → appears in list
- [ ] Trigger "Generate Brief" → status changes to "strategizing"
- [ ] Workflow completes → status updates automatically (via SWR polling)
- [ ] Error states display correctly when n8n is unavailable
- [ ] Pagination works on campaigns list
- [ ] Search/filter functionality works

---

# SECTION 12: IMPLEMENTATION ROADMAP

## 12.1 Phase 5 Implementation Order

| Step | Task                                       | Est. Time | Dependencies |
| :--- | :----------------------------------------- | :-------- | :----------- |
| 1    | Set up Supabase server client              | 1 hour    | -            |
| 2    | Generate TypeScript types from Supabase    | 30 min    | Step 1       |
| 3    | Create n8n webhook client                  | 1 hour    | -            |
| 4    | Implement `/api/v1/campaigns` CRUD         | 2 hours   | Steps 1-2    |
| 5    | Implement `/api/v1/campaigns/[id]/trigger` | 1 hour    | Steps 3-4    |
| 6    | Implement `/api/v1/dashboard/stats`        | 1 hour    | Steps 1-2    |
| 7    | Connect Dashboard page to real data        | 2 hours   | Step 6       |
| 8    | Connect Campaigns page to real data        | 2 hours   | Steps 4-5    |
| 9    | Implement remaining API routes             | 3 hours   | Steps 1-3    |
| 10   | Connect remaining pages                    | 3 hours   | Step 9       |
| 11   | Add error handling & loading states        | 2 hours   | Steps 7-10   |
| 12   | Testing & verification                     | 2 hours   | Step 11      |

**Total Estimated Time:** 18-20 hours

## 12.2 Environment Variables Required

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# n8n
N8N_WEBHOOK_URL=http://localhost:5678/webhook
N8N_WEBHOOK_SECRET=your-shared-secret

# Optional
NEXT_PUBLIC_ENABLE_WORKFLOW_TRIGGERS=true
```

---

## 12.3 Dependencies to Install

```bash
npm install @supabase/supabase-js @supabase/ssr axios zod
```

---

# APPENDIX: PHASE 6 PREVIEW

**Original Phase 5 (Intelligence & Analytics) is now Phase 6.**

Phase 6 will add:

- Predictive engagement modeling
- Real-time analytics dashboards
- A/B testing framework
- Trend forecasting
- ROI tracking

This will be tackled AFTER Phase 5 (Frontend Integration) is complete and the dashboard is fully functional.

---

**End of Phase 5 Implementation Manifesto**
