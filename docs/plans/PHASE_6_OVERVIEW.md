# PHASE 6 IMPLEMENTATION MANIFESTO

## Brand Infinity Engine: Creative Director, Brand Vault & Image Generation

**Document Classification:** L10 SYSTEMS ARCHITECTURE  
**Version:** 1.0.0  
**Status:** PROPOSED FOR APPROVAL  
**Target:** Full Creative Control, Knowledge Base, and Image Production

---

## TABLE OF CONTENTS

1. [Executive Summary](#section-1-executive-summary)
2. [Architectural Overview](#section-2-architectural-overview)
3. [Pillar A: Creative Director Interface](#section-3-pillar-a-creative-director-interface)
4. [Pillar B: Brand Vault (Knowledge Base)](#section-4-pillar-b-brand-vault)
5. [Pillar C: Image Generation Core](#section-5-pillar-c-image-generation-core)
6. [Pillar D: Enhanced Review System](#section-6-pillar-d-enhanced-review-system)
7. [Database Schema Updates](#section-7-database-schema-updates)
8. [API Specifications](#section-8-api-specifications)
9. [Implementation Roadmap](#section-9-implementation-roadmap)
10. [Verification Plan](#section-10-verification-plan)

---

# SECTION 1: EXECUTIVE SUMMARY

## 1.1 The Problem

Phase 5 connected the wires. But the **control panel is missing**.

| Gap                  | Current State                               | Impact                               |
| :------------------- | :------------------------------------------ | :----------------------------------- |
| No Creative Director | Form-based campaign creation (name, budget) | Can't steer AI with natural language |
| No Brand Vault       | Placeholder file input in Settings          | Can't train AI on brand assets       |
| No Image Generation  | Only video production pipelines             | Can't create static ads/thumbnails   |
| Limited Review       | Basic approve/reject                        | No inline editing or regeneration    |

## 1.2 The Solution

Phase 6 adds the **missing organs** to the engine:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 6 CAPABILITIES                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Creative   │  │   Brand     │  │   Image     │             │
│  │  Director   │  │   Vault     │  │   Gen API   │             │
│  │   /director │  │ /brand-vault│  │ /api/images │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              ENHANCED REVIEW PAGE (/review)              │  │
│  │   • Side-by-side previews  • Inline editing             │  │
│  │   • Regenerate button      • Batch approve              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 1.3 Design Philosophy

> **"The frontend is the source of truth for customization."**

This is a single-client, white-label tool. Every page should offer maximum interactivity:

- Click-to-edit fields (no modal forms for simple changes)
- Client-side state for preferences
- Rich component props for per-client tweaking
- Minimal API round-trips

## 1.4 Hybrid Architecture Decision

| Capability           | Implementation       | Rationale                          |
| :------------------- | :------------------- | :--------------------------------- |
| **Image Generation** | Backend (API Routes) | Synchronous API calls, simple flow |
| **Video Generation** | n8n (existing)       | Async polling, already built       |

Both must achieve **< 500ms trigger latency** (time from click to acknowledgment).

---

# SECTION 2: ARCHITECTURAL OVERVIEW

## 2.1 New Directory Structure

```
frontend/
├── app/
│   ├── (dashboard)/
│   │   ├── director/              [NEW] Creative Director page
│   │   │   └── page.tsx
│   │   ├── brand-vault/           [NEW] Knowledge Base page
│   │   │   └── page.tsx
│   │   └── review/
│   │       └── page.tsx           [MODIFY] Enhanced review
│   └── api/
│       └── v1/
│           ├── images/            [NEW] Image generation
│           │   └── route.ts
│           ├── brand-assets/      [NEW] Brand knowledge CRUD
│           │   └── route.ts
│           └── director/          [NEW] Prompt processing
│               └── route.ts
└── lib/
    └── ai/
        ├── dalle.ts               [NEW] DALL-E 3 client
        └── nanob.ts               [NEW] Nano B client
```

## 2.2 Technology Additions

| Component | Technology        | Purpose                       |
| :-------- | :---------------- | :---------------------------- |
| Image AI  | OpenAI DALL-E 3   | High-quality image generation |
| Image AI  | Nano B API        | Fast/cheap image generation   |
| Storage   | Supabase Storage  | Brand asset uploads           |
| Editor    | TipTap or Lexical | Rich text editing in Review   |

---

# SECTION 3: PILLAR A - CREATIVE DIRECTOR INTERFACE

## 3.1 Concept

A **prompt-based command center** where users type natural language instructions instead of filling forms.

### User Flow

```
1. User types: "Create a product image for our protein powder, clean aesthetic"
   OR "Generate a 15s Instagram story for Summer Sale, energetic tone"
2. System queries Brand Vault (vector search) for relevant brand context
3. System parses intent → extracts: content_type (image/video), platform, tone, etc.
4. Frontend shows parsed parameters (editable) + matched brand assets
5. User confirms → triggers Image API or Strategist workflow
```

### Content Type Support

| Content Type | Trigger                                         | Backend              |
| :----------- | :---------------------------------------------- | :------------------- |
| **Image**    | "Create an image...", "Generate a thumbnail..." | API Route (sync)     |
| **Video**    | "Create a video...", "Generate a 30s..."        | n8n Workflow (async) |

## 3.2 Page Design: `/director`

### Components

| Component         | Description                                          |
| :---------------- | :--------------------------------------------------- |
| `PromptInput`     | Large textarea with "Generate" button                |
| `ParsedIntent`    | Editable card showing extracted parameters           |
| `QuickActions`    | Preset buttons: "Instagram Story", "TikTok Ad", etc. |
| `ActiveCampaigns` | Live status of in-progress campaigns                 |

### UI Mockup Reference

```
┌─────────────────────────────────────────────────────────────┐
│  🎬 Creative Director                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "Generate a 30s YouTube short about our new         │   │
│  │  protein powder, targeting fitness enthusiasts..."  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                              [✨ Generate] │
│                                                             │
│  Quick Actions:                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ IG Story│ │TikTok Ad│ │YT Short │ │Thumbnail│          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Parsed Intent:                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Platform: [YouTube Shorts ▼]  Type: [🎬 Video ▼]    │   │
│  │ Duration: [30s]  Tone: [Energetic ▼]                 │   │
│  │ Target: [Fitness enthusiasts]                        │   │
│  │ Product: [Protein Powder]                            │   │
│  │                                                      │   │
│  │ ─── Brand Context (from Vault) ───────────────────── │   │
│  │ ✓ Logo: logo.svg     ✓ Colors: #3B82F6, #10B981     │   │
│  │ ✓ Voice: "Professional yet approachable"            │   │
│  │                                      [🚀 Launch]     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 3.3 API: `/api/v1/director`

### POST /api/v1/director/parse

Parses natural language into structured campaign parameters.

```typescript
// Request
{
  "prompt": "Create a 15s Instagram story for Summer Sale, energetic tone"
}

// Response
{
  "success": true,
  "data": {
    "platform": "instagram_stories",
    "duration_seconds": 15,
    "campaign_theme": "Summer Sale",
    "tone": "energetic",
    "content_type": "video", // or "image"
    "confidence": 0.92,
    "brand_context": {
      "matched_assets": ["logo.svg", "brand_colors.json"],
      "brand_voice": "Professional yet approachable",
      "primary_colors": ["#3B82F6", "#10B981"]
    }
  }
}
```

> **RAG Integration:** The `/parse` endpoint performs vector search on `brand_knowledge_base.embedding` to retrieve relevant brand assets and inject them as context.

### POST /api/v1/director/launch

Creates campaign and triggers workflow.

```typescript
// Request
{
  "parsed_intent": { /* from /parse */ },
  "confirmed": true
}

// Response
{
  "success": true,
  "campaign_id": "uuid",
  "status": "strategizing"
}
```

## 3.4 RAG Integration: Brand Context Injection

### Concept

Every prompt passed to the Creative Director triggers a **vector search** against the Brand Vault. This ensures all generated content (images AND videos) is informed by:

- Brand guidelines
- Color palettes
- Product images
- Tone of voice documents

> **Cost Analysis:** OpenAI embedding costs ~$0.0001/1K tokens. A typical prompt (~50 tokens) = **$0.000005**. Compare to DALL-E 3 HD at $0.08/image. **1 image = 16,000 RAG queries.** The embedding cost is negligible and worth it for quality.

### Architecture Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User Prompt    │ ──► │  Embed Prompt   │ ──► │  Vector Search  │
│  "Create an     │     │  (OpenAI Ada)   │     │  (Supabase)     │
│   image..."     │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  brand_knowledge_base (Vector Search)                           │
├─────────────────────────────────────────────────────────────────┤
│  SELECT * FROM brand_knowledge_base                             │
│  ORDER BY embedding <=> $prompt_embedding                       │
│  LIMIT 5;                                                       │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Enriched Prompt                                                │
│  ─────────────────────────────────────────────────────────────  │
│  "Create a product image for protein powder.                   │
│   BRAND CONTEXT:                                                │
│   - Use colors #3B82F6 and #10B981                             │
│   - Voice: Professional yet approachable                       │
│   - Reference product: hero_shot.png"                          │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation: `lib/ai/rag.ts`

```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getBrandContext(prompt: string, brandId: string) {
  // 1. Embed the user's prompt
  const embedding = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: prompt,
  });
  const promptEmbedding = embedding.data[0].embedding;

  // 2. Vector search against brand_knowledge_base
  const supabase = createSupabaseServerClient();
  const { data: matches } = await supabase.rpc("match_brand_assets", {
    query_embedding: promptEmbedding,
    match_threshold: 0.7,
    match_count: 5,
    p_brand_id: brandId,
  });

  // 3. Extract relevant context
  return {
    matched_assets: matches?.map((m: any) => m.file_name) || [],
    brand_voice: matches?.find((m: any) => m.asset_type === "guideline")
      ?.metadata?.voice,
    primary_colors: matches?.find((m: any) => m.asset_type === "color")
      ?.metadata?.colors,
    product_images: matches
      ?.filter((m: any) => m.asset_type === "product")
      .map((m: any) => m.file_url),
  };
}
```

### Supabase Function: `match_brand_assets`

```sql
-- Create the vector matching function
CREATE OR REPLACE FUNCTION match_brand_assets(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  p_brand_id UUID
)
RETURNS TABLE (
  id UUID,
  asset_type TEXT,
  file_name TEXT,
  file_url TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bkb.id,
    bkb.asset_type,
    bkb.file_name,
    bkb.file_url,
    bkb.metadata,
    1 - (bkb.embedding <=> query_embedding) AS similarity
  FROM brand_knowledge_base bkb
  WHERE bkb.brand_id = p_brand_id
    AND bkb.is_active = true
    AND 1 - (bkb.embedding <=> query_embedding) > match_threshold
  ORDER BY bkb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

# SECTION 4: PILLAR B - BRAND VAULT

## 4.1 Concept

A **visual knowledge base** where users upload brand assets that the AI can reference.

### Asset Types

| Type             | Extensions | AI Usage                   |
| :--------------- | :--------- | :------------------------- |
| Brand Guidelines | PDF, DOCX  | RAG context for tone/voice |
| Logos            | PNG, SVG   | Image generation overlays  |
| Product Shots    | PNG, JPG   | Video scene backgrounds    |
| Color Palettes   | JSON, CSS  | Brand color extraction     |
| Font Files       | TTF, WOFF  | Video text rendering       |

## 4.2 Page Design: `/brand-vault`

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🏛️ Brand Vault                          [+ Upload Assets] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Categories:  [All] [Logos] [Products] [Guidelines]         │
│                                                             │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │  [Logo]   │  │ [Product] │  │   [PDF]   │               │
│  │ logo.svg  │  │ hero.png  │  │ brand.pdf │               │
│  │  Active ✓ │  │ Active ✓  │  │ Processing│               │
│  └───────────┘  └───────────┘  └───────────┘               │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Brand Summary (AI-Generated):                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "Your brand voice is professional yet approachable. │   │
│  │  Primary colors: #3B82F6, #10B981. Target audience: │   │
│  │  Health-conscious millennials..."      [Edit] [Regen]│   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 4.3 Database: `brand_knowledge_base` Table

Already exists. Verify columns:

```sql
-- Expected schema
CREATE TABLE brand_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(brand_id),
  asset_type TEXT NOT NULL, -- 'logo', 'product', 'guideline', 'color', 'font'
  file_url TEXT,
  file_name TEXT,
  metadata JSONB,
  embedding VECTOR(1536), -- For RAG
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 4.4 API: `/api/v1/brand-assets`

| Method | Endpoint                   | Description                  |
| :----- | :------------------------- | :--------------------------- |
| GET    | `/api/v1/brand-assets`     | List all brand assets        |
| POST   | `/api/v1/brand-assets`     | Upload new asset (multipart) |
| DELETE | `/api/v1/brand-assets/:id` | Remove asset                 |
| PATCH  | `/api/v1/brand-assets/:id` | Toggle active/inactive       |

---

# SECTION 5: PILLAR C - IMAGE GENERATION CORE

## 5.1 Architecture

Image generation uses **Backend API Routes** (not n8n) for low latency.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │ ──► │  API Route  │ ──► │  DALL-E 3   │
│  (Request)  │     │ /api/images │     │  or Nano B  │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           ▼                   │
                    ┌─────────────┐           │
                    │   Supabase  │ ◄─────────┘
                    │   Storage   │  (Store result)
                    └─────────────┘
```

## 5.2 API: `/api/v1/images`

### POST /api/v1/images/generate

```typescript
// Request
{
  "prompt": "Professional product shot of protein powder on marble surface",
  "model": "dalle-3", // or "nanob"
  "size": "1024x1024",
  "quality": "hd", // DALL-E only
  "campaign_id": "uuid", // optional, for tracking
  "brand_id": "uuid" // optional, for brand context
}

// Response (sync - waits for generation)
{
  "success": true,
  "data": {
    "image_id": "uuid",
    "url": "https://supabase.storage/...",
    "model": "dalle-3",
    "generation_time_ms": 4500,
    "cost_usd": 0.08
  }
}
```

## 5.3 AI Client: `lib/ai/dalle.ts`

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateImage(params: {
  prompt: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
}) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: params.prompt,
    n: 1,
    size: params.size || "1024x1024",
    quality: params.quality || "standard",
  });

  return {
    url: response.data[0].url,
    revised_prompt: response.data[0].revised_prompt,
  };
}
```

## 5.4 AI Client: `lib/ai/nanob.ts`

```typescript
// Nano B API (adjust based on actual API docs)
const NANOB_API_URL = process.env.NANOB_API_URL;
const NANOB_API_KEY = process.env.NANOB_API_KEY;

export async function generateImageNanoB(params: {
  prompt: string;
  aspect_ratio?: "1:1" | "16:9" | "9:16";
}) {
  const response = await fetch(`${NANOB_API_URL}/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NANOB_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: params.prompt,
      aspect_ratio: params.aspect_ratio || "1:1",
    }),
  });

  const data = await response.json();
  return {
    url: data.image_url,
    generation_time_ms: data.processing_time,
  };
}
```

## 5.5 Database: Update `production_jobs`

Add `job_type` column to distinguish image vs video jobs:

```sql
-- Migration
ALTER TABLE production_jobs
ADD COLUMN job_type TEXT DEFAULT 'video'
CHECK (job_type IN ('video', 'image'));

-- Index for filtering
CREATE INDEX idx_production_jobs_type ON production_jobs(job_type);
```

---

# SECTION 6: PILLAR D - ENHANCED REVIEW SYSTEM

## 6.1 Current Limitations

The `/review` page currently:

- Shows basic cards for briefs/scripts/videos
- Has simple Approve/Reject buttons
- No inline editing
- No side-by-side comparison
- No regeneration trigger

## 6.2 Enhanced Features

| Feature               | Description                                |
| :-------------------- | :----------------------------------------- |
| **Side-by-Side View** | Script on left, video preview on right     |
| **Inline Editing**    | Click any text field to edit in place      |
| **Regenerate Button** | "Not quite right? Regenerate" per item     |
| **Batch Actions**     | Select multiple items, approve/reject all  |
| **Diff View**         | Show changes between iterations            |
| **Feedback Notes**    | Add rejection reason that feeds back to AI |

## 6.3 Updated UI

```
┌─────────────────────────────────────────────────────────────┐
│  📋 Review Queue                    [Approve All] [Reject] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [☐] Campaign: Summer Sale Promo         🔄 Regen    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                     │   │
│  │  ┌───────────────┐   ┌───────────────────────────┐ │   │
│  │  │               │   │ Script:                   │ │   │
│  │  │  [Video       │   │ ─────────────────────────  │ │   │
│  │  │   Preview]    │   │ "Start with energy!       │ │   │
│  │  │               │   │  Show the product..."     │ │   │
│  │  │   ▶ Play      │   │           [✏️ Edit]       │ │   │
│  │  └───────────────┘   └───────────────────────────┘ │   │
│  │                                                     │   │
│  │  [✅ Approve]  [❌ Reject]  [💬 Add Feedback]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [☐] Campaign: Q4 Product Launch       🔄 Regen     │   │
│  │ ...                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 6.4 API Updates for Review

### PATCH /api/v1/reviews/:id

```typescript
// Request - Inline edit
{
  "action": "edit",
  "field": "script_content",
  "new_value": "Updated script text..."
}

// Request - Reject with feedback
{
  "action": "reject",
  "feedback": "The tone is too aggressive, make it friendlier"
}

// Request - Regenerate
{
  "action": "regenerate",
  "feedback": "Keep the structure but use different visuals"
}
```

---

# SECTION 7: DATABASE SCHEMA UPDATES

## 7.1 Migrations Required

### Migration 1: Add job_type to production_jobs

```sql
-- 001_add_job_type.sql
ALTER TABLE production_jobs
ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'video'
CHECK (job_type IN ('video', 'image'));
```

### Migration 2: Add feedback column to review tables

```sql
-- 002_add_review_feedback.sql
ALTER TABLE creative_briefs ADD COLUMN IF NOT EXISTS rejection_feedback TEXT;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS rejection_feedback TEXT;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS rejection_feedback TEXT;
```

### Migration 3: Verify brand_knowledge_base

```sql
-- 003_verify_brand_kb.sql
-- Check if table exists and has required columns
-- Add if missing
```

---

# SECTION 8: API SPECIFICATIONS

## 8.1 New Endpoints Summary

| Method | Endpoint                   | Description                        |
| :----- | :------------------------- | :--------------------------------- |
| POST   | `/api/v1/director/parse`   | Parse natural language prompt      |
| POST   | `/api/v1/director/launch`  | Launch campaign from parsed intent |
| GET    | `/api/v1/brand-assets`     | List brand assets                  |
| POST   | `/api/v1/brand-assets`     | Upload brand asset                 |
| DELETE | `/api/v1/brand-assets/:id` | Delete brand asset                 |
| POST   | `/api/v1/images/generate`  | Generate image (sync)              |
| PATCH  | `/api/v1/reviews/:id`      | Edit/reject/regenerate review item |

## 8.2 Environment Variables

```bash
# Phase 6 additions to .env.local

# Image Generation
OPENAI_API_KEY=sk-...           # For DALL-E 3
NANOB_API_URL=https://api.nanob.ai
NANOB_API_KEY=nb_...

# Feature Flags
FEATURE_IMAGE_GENERATION=true
FEATURE_CREATIVE_DIRECTOR=true
```

---

# SECTION 9: IMPLEMENTATION ROADMAP

## 9.1 Phase 6 Implementation Order

| Step | Task                                     | Est. Time | Priority |
| :--- | :--------------------------------------- | :-------- | :------- |
| 1    | Database migrations (job_type, feedback) | 30 min    | P0       |
| 2    | Create `/api/v1/images/generate` route   | 2 hours   | P0       |
| 3    | Create `lib/ai/dalle.ts` client          | 1 hour    | P0       |
| 4    | Create `lib/ai/nanob.ts` client          | 1 hour    | P1       |
| 5    | Create `/brand-vault` page               | 3 hours   | P0       |
| 6    | Create `/api/v1/brand-assets` CRUD       | 2 hours   | P0       |
| 7    | Create `/director` page                  | 4 hours   | P0       |
| 8    | Create `/api/v1/director/parse`          | 2 hours   | P0       |
| 9    | Enhance `/review` page                   | 4 hours   | P0       |
| 10   | Add inline editing to all pages          | 3 hours   | P1       |
| 11   | Testing & verification                   | 2 hours   | P0       |

**Total Estimated Time:** 24-28 hours

## 9.2 Dependency Order

```
Database Migrations
       │
       ├──► Image API ──► Brand Vault Page
       │
       └──► Director API ──► Director Page
                   │
                   └──► Enhanced Review Page
```

---

# SECTION 10: VERIFICATION PLAN

## 10.1 Manual Testing Checklist

### Creative Director

- [ ] Type prompt → parsed intent displays correctly
- [ ] Edit parsed fields → changes persist
- [ ] Launch campaign → workflow triggers
- [ ] Quick action buttons work

### Brand Vault

- [ ] Upload logo file → appears in grid
- [ ] Upload PDF → processing indicator shows
- [ ] Toggle asset active/inactive
- [ ] Delete asset works

### Image Generation

- [ ] Generate with DALL-E 3 → image displays
- [ ] Generate with Nano B → image displays
- [ ] Image stored in Supabase Storage
- [ ] Cost tracked in cost_ledger

### Enhanced Review

- [ ] Side-by-side view displays
- [ ] Inline edit script → saves
- [ ] Reject with feedback → feedback stored
- [ ] Regenerate → new job created
- [ ] Batch approve works

## 10.2 Performance Targets

| Action                    | Target Latency | Measurement            |
| :------------------------ | :------------- | :--------------------- |
| Parse prompt              | < 1s           | API response time      |
| Image generation (DALL-E) | < 30s          | Total time to display  |
| Image generation (Nano B) | < 10s          | Total time to display  |
| Inline edit save          | < 200ms        | API response time      |
| Review page load          | < 2s           | First contentful paint |

---

**End of Phase 6 Implementation Manifesto**
