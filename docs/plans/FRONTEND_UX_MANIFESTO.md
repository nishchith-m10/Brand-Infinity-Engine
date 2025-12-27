# FRONTEND UX FLOW MANIFESTO

## Brand Infinity Engine: Guided Workflow & Step-Gating System

**Document Classification:** L10 SYSTEMS ARCHITECTURE  
**Version:** 1.0.0  
**Status:** PROPOSED FOR APPROVAL  
**Target:** Campaign-Centric UX with Mandatory Prerequisite Flow

---

## TABLE OF CONTENTS

1. [Executive Summary & Design Philosophy](#section-1-executive-summary--design-philosophy)
2. [The Guided Workflow Architecture](#section-2-the-guided-workflow-architecture)
3. [Pillar A: Campaign-Centric Data Model](#section-3-pillar-a-campaign-centric-data-model)
4. [Pillar B: Prerequisite Gating System](#section-4-pillar-b-prerequisite-gating-system)
5. [Pillar C: Empty State & Onboarding](#section-5-pillar-c-empty-state--onboarding)
6. [Pillar D: Sidebar Reorganization](#section-6-pillar-d-sidebar-reorganization)
7. [Pillar E: Global Campaign Context](#section-7-pillar-e-global-campaign-context)
8. [UX Contracts & Design Principles](#section-8-ux-contracts--design-principles)
9. [Page-by-Page Implementation](#section-9-page-by-page-implementation)
10. [Implementation Roadmap](#section-10-implementation-roadmap)

---

# SECTION 1: EXECUTIVE SUMMARY & DESIGN PHILOSOPHY

## 1.1 The "Guided Journey" Philosophy

The current dashboard is a **blank canvas with no direction**. Users land on a dashboard showing demo data with no understanding of what to do first. This manifesto introduces a **systematic, guided workflow** where each step unlocks the next.

### The Current State Problem

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CURRENT STATE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   User lands on Dashboard → Sees random pages → Gets confused      │
│                                                                     │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│   │Dashboard │   │ Videos   │   │ Creative │   │ Publish  │        │
│   │  (demo)  │   │ (empty)  │   │ Director │   │ (broken) │        │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘        │
│        ↑              ↑              ↑              ↑               │
│        └──────────────┴──────────────┴──────────────┘               │
│                    NO ORDER, NO GUIDANCE                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Problems:**

- No campaign exists → AI has no context
- Brand Vault empty → AI hallucinates brand voice
- User clicks "Publish" → Nothing to publish
- User clicks "Videos" → Nothing generated yet

### The Target State (Manifesto Complete)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          TARGET STATE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   User lands → Onboarding → Guided Flow → Success                  │
│                                                                     │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│   │ Campaign │──►│  Brand   │──►│ Creative │──►│  Review  │        │
│   │ (create) │   │  Vault   │   │ Director │   │ (approve)│        │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘        │
│                                                       │             │
│                                                       ▼             │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐                       │
│   │  Publish │◄──│  Distro  │◄──│  Videos  │                       │
│   │ (final)  │   │ (variants)│   │ (watch)  │                       │
│   └──────────┘   └──────────┘   └──────────┘                       │
│                                                                     │
│           SEQUENTIAL FLOW WITH PREREQUISITE GATES                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1.2 The L10 UX Contract (Manifesto Specific)

### Contract 1: Campaign-First Requirement

```
RULE: No content generation can occur without an active campaign.
```

A campaign is the **atomic unit of work**. All AI generation, all content, all publishing happens under a campaign. This is non-negotiable.

### Contract 2: Prerequisite Gating

```
RULE: Each step requires prior steps to be complete before access.
```

| Step              | Prerequisite                               |
| :---------------- | :----------------------------------------- |
| Brand Vault       | ≥1 campaign exists                         |
| Creative Director | Campaign selected + Brand Vault configured |
| Content Review    | Content generated                          |
| Videos            | Content approved                           |
| Distribution      | ≥1 video ready                             |
| Publishing        | ≥1 variant created                         |

### Contract 3: Empty State = Action State

```
RULE: Every empty state must guide the user to the NEXT action.
```

Never show "No data" without a button to fix it. Empty states are opportunities for onboarding, not dead ends.

### Contract 4: Context Persistence

```
RULE: The selected campaign persists across all pages until changed.
```

When a user selects "Summer Launch Campaign", every page shows data for that campaign. The selector is always visible in the header.

### Contract 5: Progressive Disclosure

```
RULE: Don't overwhelm. Show only what's relevant to the current step.
```

If a user hasn't created any campaigns, don't show them Video settings. Each stage reveals the next stage's existence only when relevant.

---

## 1.3 Success Metrics

| Metric                  | Target       | Measurement                             |
| :---------------------- | :----------- | :-------------------------------------- |
| First Campaign Creation | < 60 seconds | Time from login to campaign created     |
| Onboarding Completion   | > 80%        | Users who complete all 3 setup steps    |
| Drop-off Rate           | < 20%        | Users who leave before first generation |
| Error Rate              | 0%           | Users attempting locked features        |
| User Satisfaction       | > 4.5/5      | Post-workflow survey                    |

---

# SECTION 2: THE GUIDED WORKFLOW ARCHITECTURE

## 2.1 The 7-Step Content Production Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THE CONTENT PRODUCTION PIPELINE                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  STEP 1          STEP 2          STEP 3          STEP 4            │
│  ┌──────┐        ┌──────┐        ┌──────┐        ┌──────┐          │
│  │CREATE│   ──►  │SETUP │   ──►  │PROMPT│   ──►  │REVIEW│          │
│  │CAMP. │        │BRAND │        │  AI  │        │CONTENT│          │
│  └──────┘        └──────┘        └──────┘        └──────┘          │
│                                                                     │
│  Campaigns       Brand Vault    Creative Dir    Content Review      │
│  page            page           page            page                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  STEP 5          STEP 6          STEP 7                            │
│  ┌──────┐        ┌──────┐        ┌──────┐                          │
│  │WATCH │   ──►  │CREATE│   ──►  │PUBLISH│                          │
│  │VIDEOS│        │VARIANT│        │ LIVE │                          │
│  └──────┘        └──────┘        └──────┘                          │
│                                                                     │
│  Videos          Distribution    Publishing                         │
│  page            page            page                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 2.2 Step Definitions

### Step 1: Create Campaign

**Page:** `/campaigns`  
**Action:** User creates a new campaign (project)  
**Output:** Campaign record in database  
**Gate:** None - always accessible

A campaign represents a content production effort. Examples:

- "Summer Product Launch"
- "Q4 Holiday Campaign"
- "App Feature Announcement"

### Step 2: Setup Brand Vault

**Page:** `/brand-vault`  
**Action:** User configures brand identity + uploads assets  
**Output:** Brand voice, colors, audience defined; logos uploaded  
**Gate:** ≥1 campaign must exist

The Brand Vault has two sub-tabs:

- **Identity:** Brand name, voice, colors, target audience
- **Assets:** Logos, product images, guidelines (PDFs)

Without Brand Vault setup, AI cannot generate brand-aligned content.

### Step 3: Prompt AI (Creative Director)

**Page:** `/director`  
**Action:** User prompts AI to generate content  
**Output:** Briefs, scripts, images generated  
**Gate:** Campaign selected AND Brand Vault configured

The Creative Director is where AI magic happens:

- User types natural language prompt
- AI parses intent → generates creative brief
- Brief auto-generates scripts
- Scripts can include image generation

### Step 4: Review Content

**Page:** `/review`  
**Action:** User approves/rejects/edits generated content  
**Output:** Approved briefs and scripts  
**Gate:** Content exists for current campaign

The Review page shows:

- Briefs awaiting approval
- Scripts awaiting approval
- Side-by-side view for videos
- Inline editing capability
- Batch approve/reject

### Step 5: Watch Videos

**Page:** `/videos`  
**Action:** User views generated videos  
**Output:** Videos ready for distribution  
**Gate:** ≥1 approved content item

Videos are generated after:

- Script is approved
- n8n triggers video generation workflow
- Video model (Veo/Sora) produces output

### Step 6: Create Variants

**Page:** `/distribution`  
**Action:** User creates platform-specific variants  
**Output:** Variants ready for publishing  
**Gate:** ≥1 video ready

Distribution involves:

- Selecting platforms (TikTok, Instagram, YouTube)
- Creating aspect ratio variants
- Adding captions/hashtags

### Step 7: Publish

**Page:** `/publishing`  
**Action:** User schedules/publishes to platforms  
**Output:** Content live on social media  
**Gate:** ≥1 variant exists

Publishing is the final step:

- Schedule posts for optimal times
- Publish immediately
- Track posting status

---

## 2.3 The Prerequisite State Machine

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PREREQUISITE STATE MACHINE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  State: NO_CAMPAIGNS                                                │
│  ├── Accessible: Dashboard, Campaigns, Settings                    │
│  ├── Locked: Brand Vault, Creative Director, Review, Videos, etc.  │
│  └── Action: Create first campaign                                 │
│                                                                     │
│  State: CAMPAIGN_EXISTS                                             │
│  ├── Accessible: + Brand Vault                                     │
│  ├── Locked: Creative Director, Review, Videos, etc.               │
│  └── Action: Configure Brand Vault                                 │
│                                                                     │
│  State: BRAND_CONFIGURED                                            │
│  ├── Accessible: + Creative Director                               │
│  ├── Locked: Review, Videos, etc.                                  │
│  └── Action: Generate content via Creative Director                │
│                                                                     │
│  State: CONTENT_GENERATED                                           │
│  ├── Accessible: + Content Review                                  │
│  ├── Locked: Videos, Distribution, Publishing                      │
│  └── Action: Approve content                                       │
│                                                                     │
│  State: CONTENT_APPROVED                                            │
│  ├── Accessible: + Videos                                          │
│  ├── Locked: Distribution, Publishing                              │
│  └── Action: Wait for video generation / View videos               │
│                                                                     │
│  State: VIDEOS_READY                                                │
│  ├── Accessible: + Distribution                                    │
│  ├── Locked: Publishing                                            │
│  └── Action: Create variants                                       │
│                                                                     │
│  State: VARIANTS_CREATED                                            │
│  ├── Accessible: + Publishing                                      │
│  ├── Locked: None                                                  │
│  └── Action: Publish to platforms                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# SECTION 3: PILLAR A - CAMPAIGN-CENTRIC DATA MODEL

**Mandate:** Every piece of content belongs to exactly one campaign.

---

## 3.1 Sub-System: Campaign as Root Entity

### Concept

Campaigns are projects. All data hierarchies flow from campaigns:

```
Campaign
├── Brand Settings (for this campaign)
├── Creative Briefs
│   └── Scripts
│       └── Videos
│           └── Variants
│               └── Publications
└── Analytics (for this campaign's content)
```

### Implementation: Campaign Context Hook

**File:** `lib/hooks/use-current-campaign.ts`

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CampaignStore {
  currentCampaignId: string | null;
  currentCampaign: Campaign | null;
  setCampaign: (campaign: Campaign) => void;
  clearCampaign: () => void;
}

export const useCampaignStore = create<CampaignStore>()(
  persist(
    (set) => ({
      currentCampaignId: null,
      currentCampaign: null,
      setCampaign: (campaign) =>
        set({
          currentCampaignId: campaign.id,
          currentCampaign: campaign,
        }),
      clearCampaign: () =>
        set({
          currentCampaignId: null,
          currentCampaign: null,
        }),
    }),
    { name: "campaign-store" }
  )
);
```

### Usage in Components

```typescript
// Any page needing campaign context
const { currentCampaign, currentCampaignId } = useCampaignStore();

// Fetch data scoped to campaign
const { data } = useSWR(
  currentCampaignId ? `/api/v1/campaigns/${currentCampaignId}/briefs` : null
);
```

---

## 3.2 Sub-System: Global Campaign Selector

### Concept

A dropdown in the header that allows switching between campaigns. This selector persists across page navigation.

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  Brand Infinity    │  📁 Summer Launch Campaign ▼  │   🔔   👤     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     ┌─────────────────────┐
                     │ Summer Launch Camp. │ ✓
                     │ Q4 Holiday Campaign │
                     │ App Feature Update  │
                     │ ────────────────────│
                     │ + Create New        │
                     └─────────────────────┘
```

### Implementation: CampaignSelector Component

**File:** `components/CampaignSelector.tsx`

```typescript
"use client";

import { useCampaignStore } from "@/lib/hooks/use-current-campaign";
import { useCampaigns } from "@/lib/hooks/use-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { FolderOpen, Plus } from "lucide-react";

export function CampaignSelector() {
  const { currentCampaign, setCampaign } = useCampaignStore();
  const { data: campaigns } = useCampaigns();

  return (
    <Select
      value={currentCampaign?.id}
      onValueChange={(id) => {
        const selected = campaigns?.find((c) => c.id === id);
        if (selected) setCampaign(selected);
      }}
    >
      <SelectTrigger className="w-[250px]">
        <FolderOpen className="h-4 w-4 mr-2" />
        {currentCampaign?.name || "Select Campaign"}
      </SelectTrigger>
      <SelectContent>
        {campaigns?.map((camp) => (
          <SelectItem key={camp.id} value={camp.id}>
            {camp.name}
          </SelectItem>
        ))}
        <SelectItem value="new" className="text-indigo-600">
          <Plus className="h-4 w-4 mr-2 inline" />
          Create New Campaign
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
```

---

# SECTION 4: PILLAR B - PREREQUISITE GATING SYSTEM

**Mandate:** Each step checks prerequisites and blocks access if not met.

---

## 4.1 Sub-System: Campaign Progress API

### Concept

An API endpoint that returns the completion status of all steps for a campaign.

### Implementation: Progress Endpoint

**File:** `app/api/v1/campaigns/[id]/progress/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const campaignId = params.id;

  // Check brand identity
  const { data: brandIdentity } = await supabase
    .from("brands")
    .select("name, voice, colors, target_audience")
    .eq("campaign_id", campaignId)
    .single();

  const hasBrandIdentity = !!(brandIdentity?.name && brandIdentity?.voice);

  // Check brand assets
  const { count: assetCount } = await supabase
    .from("brand_knowledge_base")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", campaignId)
    .eq("is_active", true);

  const hasBrandAssets = (assetCount || 0) > 0;

  // Check content generated
  const { count: briefCount } = await supabase
    .from("creative_briefs")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const hasContent = (briefCount || 0) > 0;

  // Check content approved
  const { count: approvedCount } = await supabase
    .from("creative_briefs")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("approval_status", "approved");

  const hasApprovedContent = (approvedCount || 0) > 0;

  // Check videos ready
  const { count: videoCount } = await supabase
    .from("videos")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "completed");

  const hasVideos = (videoCount || 0) > 0;

  // Check variants created
  const { count: variantCount } = await supabase
    .from("variants")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const hasVariants = (variantCount || 0) > 0;

  // Calculate current step
  let currentStep = 1;
  if (hasBrandIdentity && hasBrandAssets) currentStep = 2;
  if (hasContent) currentStep = 3;
  if (hasApprovedContent) currentStep = 4;
  if (hasVideos) currentStep = 5;
  if (hasVariants) currentStep = 6;

  const steps = {
    brandIdentity: hasBrandIdentity,
    brandAssets: hasBrandAssets,
    contentGenerated: hasContent,
    contentApproved: hasApprovedContent,
    videosReady: hasVideos,
    variantsCreated: hasVariants,
  };

  const completedSteps = Object.values(steps).filter(Boolean).length;
  const completionPercent = Math.round((completedSteps / 6) * 100);

  return NextResponse.json({
    campaignId,
    steps,
    currentStep,
    completionPercent,
  });
}
```

---

## 4.2 Sub-System: Progress Hook

**File:** `lib/hooks/use-campaign-progress.ts`

```typescript
import useSWR from "swr";
import { useCampaignStore } from "./use-current-campaign";

interface CampaignProgress {
  campaignId: string;
  steps: {
    brandIdentity: boolean;
    brandAssets: boolean;
    contentGenerated: boolean;
    contentApproved: boolean;
    videosReady: boolean;
    variantsCreated: boolean;
  };
  currentStep: number;
  completionPercent: number;
}

export function useCampaignProgress() {
  const { currentCampaignId } = useCampaignStore();

  const { data, error, isLoading } = useSWR<CampaignProgress>(
    currentCampaignId ? `/api/v1/campaigns/${currentCampaignId}/progress` : null
  );

  return {
    progress: data,
    isLoading,
    error,

    // Convenience accessors
    canAccessBrandVault: !!currentCampaignId,
    canAccessDirector: data?.steps.brandIdentity && data?.steps.brandAssets,
    canAccessReview: data?.steps.contentGenerated,
    canAccessVideos: data?.steps.contentApproved,
    canAccessDistribution: data?.steps.videosReady,
    canAccessPublishing: data?.steps.variantsCreated,
  };
}
```

---

## 4.3 Sub-System: Locked State Component

**File:** `components/LockedState.tsx`

```typescript
"use client";

import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface LockedStateProps {
  title: string;
  description: string;
  steps: { label: string; completed: boolean }[];
  nextAction: { label: string; href: string };
}

export function LockedState({
  title,
  description,
  steps,
  nextAction,
}: LockedStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="bg-slate-50 rounded-2xl p-8 max-w-md text-center">
        <div className="bg-slate-200 rounded-full p-4 w-16 h-16 mx-auto mb-6">
          <Lock className="h-8 w-8 text-slate-500" />
        </div>

        <h2 className="text-xl font-semibold text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-500 mb-6">{description}</p>

        <div className="text-left bg-white rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-slate-600 mb-3">
            Complete these steps first:
          </p>
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              {step.completed ? (
                <span className="text-green-500">✓</span>
              ) : (
                <span className="text-slate-300">○</span>
              )}
              <span
                className={step.completed ? "text-slate-400" : "text-slate-700"}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <Link href={nextAction.href}>
          <Button className="w-full">
            {nextAction.label}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

---

# SECTION 5: PILLAR C - EMPTY STATE & ONBOARDING

**Mandate:** Every empty state guides the user to the next action.

---

## 5.1 Sub-System: Dashboard Onboarding

### First-Time User Experience

When a user has no campaigns, the dashboard shows an onboarding wizard instead of empty stats.

### Implementation: EmptyDashboard Component

```typescript
// In (dashboard)/page.tsx

export default function DashboardPage() {
  const { data: campaigns } = useCampaigns();

  if (campaigns?.length === 0) {
    return <OnboardingWizard />;
  }

  return <DashboardWithStats />;
}
```

### OnboardingWizard Visual

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│     🚀 Welcome to Brand Infinity Engine                            │
│                                                                     │
│     Create AI-powered video content in 7 simple steps.             │
│                                                                     │
│     ┌─────────────────────────────────────────────────────────┐    │
│     │                                                         │    │
│     │   ① Create Campaign                                    │    │
│     │   └─ Set up your first content project                 │    │
│     │                                                         │    │
│     │   ② Configure Brand Vault                              │    │
│     │   └─ Add your brand identity and assets                │    │
│     │                                                         │    │
│     │   ③ Use Creative Director                              │    │
│     │   └─ Tell AI what content to generate                  │    │
│     │                                                         │    │
│     │   ④ Review & Approve                                   │    │
│     │   └─ Refine the generated scripts                      │    │
│     │                                                         │    │
│     │   ⑤ Watch Videos                                       │    │
│     │   └─ See your AI-generated videos                      │    │
│     │                                                         │    │
│     │   ⑥ Distribute                                         │    │
│     │   └─ Create platform variants                          │    │
│     │                                                         │    │
│     │   ⑦ Publish                                            │    │
│     │   └─ Go live on social platforms                       │    │
│     │                                                         │    │
│     └─────────────────────────────────────────────────────────┘    │
│                                                                     │
│              [ + Create Your First Campaign ]                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5.2 Sub-System: Brand Vault Setup Checklist

When Brand Vault is incomplete, show a checklist instead of empty grid.

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏛️ Brand Vault                                                     │
│                                                                     │
│  Complete your brand setup to unlock AI content generation         │
│                                                                     │
│  ┌─────────────────────────┐   ┌─────────────────────────┐         │
│  │  🎨 IDENTITY            │   │  📁 ASSETS              │         │
│  │                         │   │                         │         │
│  │  ✓ Brand Name           │   │  ○ Upload logo          │         │
│  │  ○ Brand Voice          │   │  ○ Upload product image │         │
│  │  ✓ Primary Color        │   │  ○ Add brand guidelines │         │
│  │  ○ Target Audience      │   │                         │         │
│  │                         │   │                         │         │
│  │  [Complete Identity →]  │   │  [Upload Assets →]      │         │
│  └─────────────────────────┘   └─────────────────────────┘         │
│                                                                     │
│  Progress: ██████░░░░ 40%                                           │
│                                                                     │
│  💡 Why does this matter?                                           │
│  AI uses your brand voice and assets to generate content that      │
│  matches your brand identity. Without this, AI will guess.         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# SECTION 6: PILLAR D - SIDEBAR REORGANIZATION

**Mandate:** Sidebar order reflects the workflow sequence.

---

## 6.1 Current vs Proposed Sidebar

### Current (Unordered)

```
Dashboard
Creative Director
Brand Vault
Campaigns
Content Review
Videos
Distribution
Publishing
Analytics
Settings
```

### Proposed (Workflow Order)

```
Dashboard
─────────────────
WORKFLOW
  ① Campaigns         [Always accessible]
  ② Brand Vault       [Needs campaign]
  ③ Creative Director [Needs brand setup]
  ④ Content Review    [Needs content]
  ⑤ Videos            [Needs approval]
  ⑥ Distribution      [Needs videos]
  ⑦ Publishing        [Needs variants]
─────────────────
INSIGHTS
  Analytics
─────────────────
SYSTEM
  Settings
```

---

## 6.2 Visual Indicators

| Icon | Meaning                            |
| :--- | :--------------------------------- |
| 🔒   | Locked (prerequisites not met)     |
| ⚪   | Available (can access)             |
| 🟢   | Active (current page)              |
| ✅   | Complete (step finished)           |
| 🔴   | Requires attention (items pending) |

### Example Sidebar States

**New User (no campaigns):**

```
Dashboard        🟢
─────────────────
WORKFLOW
  Campaigns      ⚪ ← Start here
  Brand Vault    🔒
  Creative Dir   🔒
  Review         🔒
  Videos         🔒
  Distribution   🔒
  Publishing     🔒
```

**After Brand Setup:**

```
Dashboard        ⚪
─────────────────
WORKFLOW
  Campaigns      ✅
  Brand Vault    ✅
  Creative Dir   🟢 ← You are here
  Review         🔒
  Videos         🔒
  Distribution   🔒
  Publishing     🔒
```

**After Content Generated:**

```
Dashboard        ⚪
─────────────────
WORKFLOW
  Campaigns      ✅
  Brand Vault    ✅
  Creative Dir   ✅
  Review         🔴 3 items ← Attention needed
  Videos         🔒
  Distribution   🔒
  Publishing     🔒
```

---

# SECTION 7: PILLAR E - GLOBAL CAMPAIGN CONTEXT

**Mandate:** All pages operate under the context of the selected campaign.

---

## 7.1 Campaign Context Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CAMPAIGN CONTEXT FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    HEADER (Global)                          │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  Campaign: [Summer Launch ▼]                         │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  ZUSTAND STORE                              │   │
│  │  currentCampaignId: "camp_abc123"                           │   │
│  │  currentCampaign: { id, name, status, ... }                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  ALL PAGE COMPONENTS                        │   │
│  │                                                             │   │
│  │  BrandVault    → Filters to campaign's brand settings       │   │
│  │  Director      → Generates content for this campaign        │   │
│  │  Review        → Shows this campaign's pending content      │   │
│  │  Videos        → Shows this campaign's videos               │   │
│  │  Distribution  → Shows this campaign's variants             │   │
│  │  Publishing    → Shows this campaign's publications         │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# SECTION 8: UX CONTRACTS & DESIGN PRINCIPLES

## 8.1 Page Behavior Matrix

| Page              | No Campaign Selected         | Campaign Selected, Prerequisites NOT Met | Prerequisites Met    |
| :---------------- | :--------------------------- | :--------------------------------------- | :------------------- |
| Dashboard         | Show onboarding wizard       | Show campaign overview                   | Show full stats      |
| Campaigns         | Show "Create first campaign" | N/A                                      | Show campaign list   |
| Brand Vault       | Redirect to Campaigns        | Show setup checklist                     | Show full UI         |
| Creative Director | Redirect to Campaigns        | Show LockedState                         | Show prompt UI       |
| Content Review    | Redirect to Director         | Show "Nothing to review"                 | Show review queue    |
| Videos            | Redirect to Review           | Show "No videos yet"                     | Show video grid      |
| Distribution      | Redirect to Videos           | Show "Create videos first"               | Show variant creator |
| Publishing        | Redirect to Distribution     | Show "Prepare content"                   | Show publish queue   |

## 8.2 Error Prevention

| Scenario                             | Prevention                               |
| :----------------------------------- | :--------------------------------------- |
| User clicks locked item              | Show locked toast, don't navigate        |
| User manually enters locked URL      | Redirect to correct step                 |
| User tries to delete active campaign | Confirm with warning about data loss     |
| User leaves Brand Vault incomplete   | Show warning banner on Creative Director |

---

# SECTION 9: PAGE-BY-PAGE IMPLEMENTATION

## 9.1 Files to Create

| File                                      | Purpose                            |
| :---------------------------------------- | :--------------------------------- |
| `lib/hooks/use-current-campaign.ts`       | Zustand store for campaign context |
| `lib/hooks/use-campaign-progress.ts`      | Progress tracking hook             |
| `components/CampaignSelector.tsx`         | Header dropdown                    |
| `components/LockedState.tsx`              | Reusable locked page UI            |
| `components/OnboardingWizard.tsx`         | First-time user experience         |
| `components/ProgressBar.tsx`              | Step progress indicator            |
| `api/v1/campaigns/[id]/progress/route.ts` | Progress API endpoint              |

## 9.2 Files to Modify

| File                                | Changes                                              |
| :---------------------------------- | :--------------------------------------------------- |
| `components/sidebar.tsx`            | Reorder items, add step numbers, add lock indicators |
| `components/Navbar.tsx`             | Add CampaignSelector                                 |
| `(dashboard)/page.tsx`              | Add onboarding wizard for empty state                |
| `(dashboard)/brand-vault/page.tsx`  | Add setup checklist mode                             |
| `(dashboard)/director/page.tsx`     | Add prerequisite check                               |
| `(dashboard)/review/page.tsx`       | Add prerequisite check                               |
| `(dashboard)/videos/page.tsx`       | Add prerequisite check                               |
| `(dashboard)/distribution/page.tsx` | Add prerequisite check                               |
| `(dashboard)/publishing/page.tsx`   | Add prerequisite check                               |

---

# SECTION 10: IMPLEMENTATION ROADMAP

## 10.1 Phase Breakdown

### Phase 1: Foundation (Day 1-2)

- [ ] Create Zustand store for campaign context
- [ ] Create progress API endpoint
- [ ] Create progress hook
- [ ] Add CampaignSelector to Navbar

### Phase 2: Sidebar (Day 2)

- [ ] Reorganize sidebar order
- [ ] Add step numbers
- [ ] Add lock/unlock indicators
- [ ] Connect to progress hook

### Phase 3: Gating (Day 3)

- [ ] Create LockedState component
- [ ] Add prerequisite checks to each page
- [ ] Implement redirect logic for manual URL access

### Phase 4: Empty States (Day 4)

- [ ] Create OnboardingWizard for Dashboard
- [ ] Create setup checklist for Brand Vault
- [ ] Create "nothing yet" states for other pages

### Phase 5: Polish (Day 5)

- [ ] Add progress bar to pages
- [ ] Add tooltips explaining locked items
- [ ] Test full flow end-to-end
- [ ] Fix any edge cases

---

## 10.2 Verification Checklist

- [ ] New user sees onboarding wizard
- [ ] Cannot access Creative Director before Brand Vault setup
- [ ] Cannot access Videos before content approval
- [ ] Campaign selector persists across navigation
- [ ] Locked pages show helpful messages
- [ ] Sidebar indicators update in real-time
- [ ] Manual URL access redirects correctly
