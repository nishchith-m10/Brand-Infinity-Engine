# PHASE 6 PART I IMPLEMENTATION MANIFESTO

## Multi-Knowledge Base Architecture

**Document Classification:** L10 SYSTEMS ARCHITECTURE  
**Version:** 1.0.0  
**Status:** PROPOSED FOR APPROVAL  
**Prerequisite For:** Phase 6 Part II (Agent Architecture)  
**Target:** Transform single Brand Vault into multi-KB system with selective context injection

---

## TABLE OF CONTENTS

1. [Executive Summary](#section-1-executive-summary)
2. [Problem Analysis](#section-2-problem-analysis)
3. [Architectural Overview](#section-3-architectural-overview)
4. [Database Schema Design](#section-4-database-schema-design)
5. [API Specifications](#section-5-api-specifications)
6. [n8n Workflow Updates](#section-6-n8n-workflow-updates)
7. [Frontend Implementation](#section-7-frontend-implementation)
8. [RAG System Enhancements](#section-8-rag-system-enhancements)
9. [Migration Strategy](#section-9-migration-strategy)
10. [Implementation Roadmap](#section-10-implementation-roadmap)
11. [Verification Plan](#section-11-verification-plan)

---

# SECTION 1: EXECUTIVE SUMMARY

## 1.1 The Problem

The current Brand Vault is a **monolithic knowledge container**. Every piece of brand information—product specs, competitor research, brand voice, historical campaigns—lives in one undifferentiated pool.

| Issue                | Current State                               | Impact                                    |
| :------------------- | :------------------------------------------ | :---------------------------------------- |
| Context Pollution    | All brand assets flood every prompt         | LLM confusion, lower output quality       |
| No Selective Loading | Cannot choose which context to inject       | Irrelevant information dilutes prompts    |
| Single KB Per Brand  | One knowledge base per brand                | Cannot compartmentalize knowledge domains |
| Campaign Coupling    | Assets are brand-scoped, not campaign-aware | Cannot have campaign-specific context     |

## 1.2 The Hypothesis

> **"Multiple focused knowledge bases produce higher quality AI outputs than one large general knowledge base."**

Just as a human expert activates relevant mental compartments for different tasks, our AI should be able to selectively load context based on:

- The specific task at hand
- User selection in the Prompt Builder
- Default "Core" context that always applies

## 1.3 The Solution

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MULTI-KNOWLEDGE BASE SYSTEM                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Brand: "My Company"                                                │
│  ├── 📚 KB: "Core Brand Identity"    [DEFAULT - Always Loaded]     │
│  │   ├── Logo, Colors, Fonts                                       │
│  │   ├── Brand Voice Guidelines                                    │
│  │   └── Target Audience Definition                                │
│  │                                                                  │
│  ├── 📦 KB: "Product Catalog"        [User Selectable]             │
│  │   ├── Product Specs (JSON/PDF)                                  │
│  │   ├── Product Images                                            │
│  │   └── Pricing Information                                       │
│  │                                                                  │
│  ├── 🔍 KB: "Competitor Intelligence" [User Selectable]            │
│  │   ├── Competitor Ads                                            │
│  │   ├── Market Positioning Docs                                   │
│  │   └── Differentiation Points                                    │
│  │                                                                  │
│  └── 📅 KB: "Summer Campaign 2024"   [Campaign-Specific]           │
│      ├── Campaign Brief                                            │
│      ├── Approved Creative Examples                                │
│      └── Performance Data                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 1.4 Key Design Decisions

| Decision             | Choice                            | Rationale                                           |
| :------------------- | :-------------------------------- | :-------------------------------------------------- |
| KB Names             | **Fully user-defined**            | Maximum flexibility - users create any KB they want |
| KB Customization     | Name, description, icon, color    | Rich personalization for organization               |
| KB Scope             | Brand-level, not campaign-level   | KBs can be reused across campaigns                  |
| Campaign Association | Optional junction table           | Campaigns can "pin" specific KBs for quick access   |
| Core KB              | One per brand, auto-included      | Ensures core identity is never forgotten            |
| Default Selection    | User marks which KBs are defaults | Pre-selected in Creative Director                   |
| Tagging              | User-defined tags per KB          | Cross-cutting organization                          |

---

# SECTION 2: PROBLEM ANALYSIS

## 2.1 Current System Architecture

### Existing Database Tables

```
brands
├── id (UUID)
├── name
├── brand_voice
├── brand_colors
├── target_audience
└── metadata (JSONB)

brand_knowledge_base        ← Current: Assets directly linked to brand
├── id (UUID)
├── brand_id (UUID FK)      ← Single parent: brand
├── asset_type
├── file_url
├── file_name
├── metadata
├── embedding (VECTOR)
└── is_active
```

### Current RAG Flow

```
User Prompt → Embed → Vector Search ALL brand assets → Inject ALL matches
                              ↑
                   No filtering by category or purpose
```

### Pain Points

1. **No Asset Categorization Beyond Type**: We know it's a "logo" or "guideline", but not "for Product X" vs "for Product Y"

2. **No Selective Context**: When generating a product ad, competitor research floods the context unnecessarily

3. **No Campaign Memory**: Previous campaign learnings can't be isolated and reused selectively

4. **Token Waste**: Larger context = higher cost + potential quality degradation

## 2.2 Affected Components

| Component                      | Current Behavior          | Required Change                |
| :----------------------------- | :------------------------ | :----------------------------- |
| `brand_knowledge_base` table   | Direct brand linkage      | Indirect via `knowledge_bases` |
| `brand-vault/page.tsx`         | Single KB view            | Multi-KB management UI         |
| `lib/ai/rag.ts`                | Searches all brand assets | Searches selected KBs only     |
| `Get_Brand_Context.json` (n8n) | Fetches all brand context | Accepts KB selection           |
| `director/page.tsx`            | No KB selection           | KB multi-select UI             |
| `/api/v1/director/parse`       | No KB filtering           | Accepts KB IDs                 |

---

# SECTION 3: ARCHITECTURAL OVERVIEW

## 3.1 New Entity Relationship Diagram

```
┌──────────────┐
│    brands    │
├──────────────┤
│ id (PK)      │
│ name         │
│ ...          │
└──────────────┘
       │
       │ 1:N
       ▼
┌──────────────────────┐
│   knowledge_bases    │  ← NEW TABLE
├──────────────────────┤
│ id (PK)              │
│ brand_id (FK)        │───────────────────────────────┐
│ name (user-defined)  │                               │
│ description          │                               │
│ icon                 │  ← User selects (Lucide)      │
│ color                │  ← User selects (hex)         │
│ tags[]               │  ← User-defined tags          │
│ is_core              │  ← One per brand (always on)  │
│ is_default           │  ← Pre-selected in Director   │
│ is_active            │                               │
│ created_at           │                               │
│ updated_at           │                               │
└──────────────────────┘                               │
       │                                               │
       │ 1:N                                           │
       ▼                                               │
┌───────────────────────┐                              │
│ knowledge_base_assets │  ← RENAMED/EVOLVED          │
├───────────────────────┤                              │
│ id (PK)               │                              │
│ knowledge_base_id (FK)│ ← Changed from brand_id     │
│ asset_type            │                              │
│ file_url              │                              │
│ file_name             │                              │
│ content_text          │  ← NEW: For text guidelines │
│ metadata              │                              │
│ embedding (VECTOR)    │                              │
│ is_active             │                              │
│ created_at            │                              │
│ updated_at            │                              │
└───────────────────────┘                              │
                                                       │
┌────────────────────────────────────────────────────┐ │
│           campaign_knowledge_bases                 │ │
├────────────────────────────────────────────────────┤ │
│ campaign_id (FK) ─────────────────────────┐        │ │
│ knowledge_base_id (FK) ───────────────────┼────────┼─┘
│ is_pinned (BOOL)      ← Quick access flag │        │
│ created_at                                │        │
│                                           ▼        │
│                                    ┌─────────────┐ │
│                                    │  campaigns  │ │
│                                    └─────────────┘ │
└────────────────────────────────────────────────────┘
```

## 3.2 KB Customization Model

> **Design Philosophy: No fixed types. Users define their own knowledge bases with full customization.**

| Customization | Description                 | Example Values                                   |
| :------------ | :-------------------------- | :----------------------------------------------- |
| `name`        | User-defined name           | "Holiday 2025", "Q1 Marketing", "Influencer Kit" |
| `description` | Optional longer description | "All assets for our Q1 product launch"           |
| `icon`        | Lucide icon name            | `package`, `calendar`, `users`, `target`         |
| `color`       | Hex color for UI            | `#6366F1`, `#10B981`, `#F59E0B`                  |
| `tags`        | Array of user-defined tags  | `["seasonal", "2025", "priority"]`               |

### System Flags

| Flag         | Purpose                           | Behavior                                       |
| :----------- | :-------------------------------- | :--------------------------------------------- |
| `is_core`    | Marks the core brand identity KB  | Only ONE per brand, always included in context |
| `is_default` | Pre-selected in Creative Director | Multiple allowed, user preference              |

### Example User-Created KBs

```
Brand: "My Company"
├── 🛡️ Core Brand Identity        [is_core=true, always included]
├── 📦 Product Catalog             [is_default=true]
├── 🎄 Holiday 2025 Campaign       tags: [seasonal, 2025]
├── 🤝 Influencer Partnerships     tags: [partnerships]
├── 📊 Competitor Analysis
├── 🎨 Brand Guidelines V2         tags: [guidelines]
└── 📈 Q1 Marketing                tags: [q1, 2025, marketing]
```

## 3.3 Context Injection Logic

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CONTEXT INJECTION LOGIC                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Request from Creative Director/Prompt Builder:                     │
│  {                                                                  │
│    prompt: "Create a product video...",                             │
│    brand_id: "uuid",                                                │
│    selected_kb_ids: ["kb-product", "kb-campaign-summer"]            │
│  }                                                                  │
│                                                                     │
│  ────────────────────────────────────────────────────────────────── │
│                                                                     │
│  Step 1: Always load DEFAULT KB for brand                           │
│          SELECT * FROM knowledge_bases WHERE brand_id = ? AND is_default = true │
│                                                                     │
│  Step 2: Load user-selected KBs                                     │
│          SELECT * FROM knowledge_bases WHERE id IN (selected_kb_ids)│
│                                                                     │
│  Step 3: Merge KB IDs                                               │
│          final_kb_ids = [default_kb.id, ...selected_kb_ids]         │
│                                                                     │
│  Step 4: Vector search ONLY within merged KBs                       │
│          SELECT * FROM knowledge_base_assets                        │
│          WHERE knowledge_base_id IN (final_kb_ids)                  │
│          ORDER BY embedding <=> prompt_embedding                    │
│          LIMIT 10                                                   │
│                                                                     │
│  Step 5: Assemble context + inject into LLM prompt                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# SECTION 4: DATABASE SCHEMA DESIGN

## 4.1 New Tables

### 4.1.1 `knowledge_bases` Table

```sql
-- =============================================================================
-- Migration: 026_create_knowledge_bases_table.sql
-- Description: Multi-knowledge base system for Brand Vault (User-Customizable)
-- Phase: 6 Part I
-- =============================================================================

CREATE TABLE IF NOT EXISTS knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,

    -- USER-DEFINED FIELDS (Full Customization)
    name VARCHAR(100) NOT NULL,           -- User names their KB anything
    description TEXT,                      -- Optional longer description
    icon VARCHAR(50) DEFAULT 'folder',     -- Lucide icon name (user selects)
    color VARCHAR(7) DEFAULT '#6366F1',    -- Hex color for UI (user selects)
    tags TEXT[] DEFAULT '{}',              -- User-defined tags for organization

    -- SYSTEM FLAGS
    is_core BOOLEAN DEFAULT FALSE,         -- Only ONE per brand, always included
    is_default BOOLEAN DEFAULT FALSE,      -- Pre-selected in Creative Director
    is_active BOOLEAN DEFAULT TRUE,        -- Soft delete

    -- METADATA (Denormalized for performance)
    asset_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,        -- Estimated token count

    -- TIMESTAMPS
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Ensure only ONE core KB per brand
CREATE UNIQUE INDEX idx_knowledge_bases_core
ON knowledge_bases(brand_id)
WHERE is_core = TRUE;

-- Performance indexes
CREATE INDEX idx_knowledge_bases_brand_id ON knowledge_bases(brand_id);
CREATE INDEX idx_knowledge_bases_active ON knowledge_bases(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_knowledge_bases_tags ON knowledge_bases USING GIN(tags);


-- Trigger for updated_at
CREATE TRIGGER update_knowledge_bases_updated_at
    BEFORE UPDATE ON knowledge_bases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE knowledge_bases IS 'Container for grouping related brand assets into focused knowledge bases';
COMMENT ON COLUMN knowledge_bases.is_default IS 'If true, this KB is always included in context injection';
COMMENT ON COLUMN knowledge_bases.asset_count IS 'Denormalized count of assets in this KB';
```

### 4.1.2 Modify `brand_knowledge_base` → `knowledge_base_assets`

```sql
-- =============================================================================
-- Migration: 027_evolve_brand_knowledge_base.sql
-- Description: Evolve brand_knowledge_base to knowledge_base_assets
-- Phase: 6 Part I
-- =============================================================================

-- Step 1: Add new column for KB relationship
ALTER TABLE brand_knowledge_base
ADD COLUMN IF NOT EXISTS knowledge_base_id UUID;

-- Step 2: Create default KBs for existing brands
INSERT INTO knowledge_bases (brand_id, name, description, kb_type, is_default)
SELECT DISTINCT
    bkb.brand_id,
    'Core Brand Identity',
    'Default knowledge base containing core brand assets',
    'core',
    TRUE
FROM brand_knowledge_base bkb
WHERE bkb.brand_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 3: Link existing assets to their brand's default KB
UPDATE brand_knowledge_base bkb
SET knowledge_base_id = kb.id
FROM knowledge_bases kb
WHERE bkb.brand_id = kb.brand_id
  AND kb.is_default = TRUE
  AND bkb.knowledge_base_id IS NULL;

-- Step 4: Add FK constraint (after data migrated)
ALTER TABLE brand_knowledge_base
ADD CONSTRAINT fk_knowledge_base_id
FOREIGN KEY (knowledge_base_id)
REFERENCES knowledge_bases(id) ON DELETE CASCADE;

-- Step 5: Add content_text column for text-based guidelines
ALTER TABLE brand_knowledge_base
ADD COLUMN IF NOT EXISTS content_text TEXT;

-- Step 6: Rename table (optional - can keep original name for backwards compat)
-- ALTER TABLE brand_knowledge_base RENAME TO knowledge_base_assets;

-- Step 7: Update vector search function
CREATE OR REPLACE FUNCTION match_kb_assets(
    query_embedding VECTOR(1536),
    match_threshold FLOAT,
    match_count INT,
    p_kb_ids UUID[]  -- Changed from single brand_id to array of KB IDs
)
RETURNS TABLE (
    id UUID,
    knowledge_base_id UUID,
    asset_type TEXT,
    file_name TEXT,
    file_url TEXT,
    content_text TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        bkb.id,
        bkb.knowledge_base_id,
        bkb.asset_type,
        bkb.file_name,
        bkb.file_url,
        bkb.content_text,
        bkb.metadata,
        1 - (bkb.embedding <=> query_embedding) AS similarity
    FROM brand_knowledge_base bkb
    WHERE bkb.knowledge_base_id = ANY(p_kb_ids)
        AND bkb.is_active = true
        AND bkb.embedding IS NOT NULL
        AND 1 - (bkb.embedding <=> query_embedding) > match_threshold
    ORDER BY bkb.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Step 8: Create trigger to update KB asset count
CREATE OR REPLACE FUNCTION update_kb_asset_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE knowledge_bases
        SET asset_count = asset_count + 1
        WHERE id = NEW.knowledge_base_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE knowledge_bases
        SET asset_count = asset_count - 1
        WHERE id = OLD.knowledge_base_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.knowledge_base_id != NEW.knowledge_base_id THEN
        UPDATE knowledge_bases
        SET asset_count = asset_count - 1
        WHERE id = OLD.knowledge_base_id;
        UPDATE knowledge_bases
        SET asset_count = asset_count + 1
        WHERE id = NEW.knowledge_base_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_kb_asset_count
    AFTER INSERT OR DELETE OR UPDATE OF knowledge_base_id
    ON brand_knowledge_base
    FOR EACH ROW
    EXECUTE FUNCTION update_kb_asset_count();
```

### 4.1.3 `campaign_knowledge_bases` Junction Table

```sql
-- =============================================================================
-- Migration: 028_create_campaign_knowledge_bases.sql
-- Description: Junction table for campaign-KB associations
-- Phase: 6 Part I
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaign_knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,

    -- Flags
    is_pinned BOOLEAN DEFAULT FALSE,  -- Show in quick-access for this campaign

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: one record per campaign-KB pair
    CONSTRAINT unique_campaign_kb UNIQUE(campaign_id, knowledge_base_id)
);

-- Indexes
CREATE INDEX idx_campaign_kbs_campaign ON campaign_knowledge_bases(campaign_id);
CREATE INDEX idx_campaign_kbs_kb ON campaign_knowledge_bases(knowledge_base_id);

-- Comment
COMMENT ON TABLE campaign_knowledge_bases IS 'Associates campaigns with knowledge bases for quick access and defaults';
```

## 4.2 RLS Policies

```sql
-- =============================================================================
-- Migration: 029_rls_knowledge_bases.sql
-- Description: Row Level Security for KB tables
-- Phase: 6 Part I
-- =============================================================================

ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

-- Users can view KBs they have access to via their brands
CREATE POLICY "Users can view their brand KBs"
ON knowledge_bases FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM brands b
        WHERE b.id = knowledge_bases.brand_id
        AND b.owner_id = auth.uid()
    )
);

-- Users can modify their brand's KBs
CREATE POLICY "Users can manage their brand KBs"
ON knowledge_bases FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM brands b
        WHERE b.id = knowledge_bases.brand_id
        AND b.owner_id = auth.uid()
    )
);
```

---

# SECTION 5: API SPECIFICATIONS

## 5.1 New Endpoints

### 5.1.1 Knowledge Bases CRUD

#### GET /api/v1/knowledge-bases

List all knowledge bases for a brand.

```typescript
// Request
GET /api/v1/knowledge-bases?brand_id=uuid

// Response
{
  "success": true,
  "data": [
    {
      "id": "kb-uuid-1",
      "name": "Core Brand Identity",
      "description": "Essential brand voice and visual identity",
      "icon": "shield",
      "color": "#6366F1",
      "tags": ["branding", "identity"],
      "is_core": true,
      "is_default": true,
      "is_active": true,
      "asset_count": 12,
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "kb-uuid-2",
      "name": "Holiday 2025 Campaign",
      "description": "All assets for our holiday promotion",
      "icon": "calendar",
      "color": "#10B981",
      "tags": ["seasonal", "2025", "promotion"],
      "is_core": false,
      "is_default": true,
      "is_active": true,
      "asset_count": 45,
      "created_at": "2024-01-15T00:00:00Z"
    },
    {
      "id": "kb-uuid-3",
      "name": "Influencer Partnerships",
      "description": "Assets for influencer collaborations",
      "icon": "users",
      "color": "#F59E0B",
      "tags": ["partnerships", "social"],
      "is_core": false,
      "is_default": false,
      "is_active": true,
      "asset_count": 8,
      "created_at": "2024-02-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/v1/knowledge-bases

Create a new knowledge base (fully user-defined).

```typescript
// Request - User defines everything
{
  "brand_id": "uuid",
  "name": "Q1 Marketing Assets",          // User-defined name
  "description": "All Q1 2025 marketing materials",
  "icon": "trending-up",                   // User selects from Lucide icons
  "color": "#8B5CF6",                      // User picks color
  "tags": ["q1", "2025", "marketing"],     // User-defined tags
  "is_default": true                       // User decides if pre-selected
}

// Response
{
  "success": true,
  "data": {
    "id": "new-kb-uuid",
    "name": "Q1 Marketing Assets",
    "is_core": false,  // Only system can create core KB during brand setup
    ...
  }
}
```

#### PUT /api/v1/knowledge-bases/:id

Update a knowledge base (users can change any customization).

```typescript
// Request - Any field can be updated
{
  "name": "Q1 Marketing Assets - Updated",
  "description": "Updated description",
  "icon": "rocket",
  "color": "#EC4899",
  "tags": ["q1", "2025", "marketing", "priority"],
  "is_default": false
}
```

#### DELETE /api/v1/knowledge-bases/:id

Delete a knowledge base. Assets are cascade deleted.

### 5.1.2 Update Brand Assets API

#### POST /api/v1/brand-assets

Modified to require `knowledge_base_id`.

```typescript
// Request (Updated)
{
  "knowledge_base_id": "kb-uuid",  // NEW: Required
  "asset_type": "product",
  "file": FormData,
  // OR
  "content_text": "Brand voice guidelines text...",  // NEW: For text content
  "generate_embedding": true
}
```

#### GET /api/v1/brand-assets

Modified to filter by KB.

```typescript
// Request
GET /api/v1/brand-assets?knowledge_base_id=uuid

// OR get all for a brand across KBs
GET /api/v1/brand-assets?brand_id=uuid
```

### 5.1.3 Update Director API

#### POST /api/v1/director/parse

Modified to accept KB selection.

```typescript
// Request (Updated)
{
  "prompt": "Create a product video...",
  "brand_id": "uuid",
  "selected_kb_ids": ["kb-uuid-1", "kb-uuid-2"]  // NEW: Optional, defaults to [default_kb]
}

// Response
{
  "success": true,
  "data": {
    "platform": "instagram",
    "content_type": "video",
    ...
    "brand_context": {
      "loaded_kbs": ["Core Brand Identity", "Product Catalog"],
      "matched_assets": [...],
      "total_tokens_used": 2500
    }
  }
}
```

## 5.2 API Implementation Files

### 5.2.1 `/api/v1/knowledge-bases/route.ts`

```typescript
// NEW FILE
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Fully user-customizable KB schema - no fixed types!
const CreateKBSchema = z.object({
  brand_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().default("folder"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#6366F1"),
  tags: z.array(z.string()).default([]),
  is_default: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const brandId = request.nextUrl.searchParams.get("brand_id");
  const tag = request.nextUrl.searchParams.get("tag"); // Optional filter by tag

  let query = supabase
    .from("knowledge_bases")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("is_core", { ascending: false }) // Core KB first
    .order("is_default", { ascending: false }) // Then defaults
    .order("created_at", { ascending: true });

  // Optional: filter by tag
  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const validation = CreateKBSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues },
      { status: 400 }
    );
  }

  // Note: is_core is always false for user-created KBs
  // Core KB is only created during brand setup
  const { data, error } = await supabase
    .from("knowledge_bases")
    .insert({
      ...validation.data,
      is_core: false, // Users cannot create core KBs
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
```

---

# SECTION 6: N8N WORKFLOW UPDATES

## 6.1 Affected Workflows

| Workflow                 | Current Behavior         | Required Change                   |
| :----------------------- | :----------------------- | :-------------------------------- |
| `Get_Brand_Context.json` | Fetches all brand assets | Accept KB IDs, filter accordingly |
| `Strategist_Main.json`   | Calls Get_Brand_Context  | Pass selected KB IDs              |
| `Copywriter_Main.json`   | Uses brand context       | Receive filtered context          |

## 6.2 Updated `Get_Brand_Context.json`

### Input Schema Change

```javascript
// Before
{
  "brand_id": "uuid",
  "query_context": "string"
}

// After
{
  "brand_id": "uuid",
  "query_context": "string",
  "knowledge_base_ids": ["kb-uuid-1", "kb-uuid-2"]  // NEW
}
```

### Code Node Update: `Prepare Query`

```javascript
// Updated Prepare Query node
const input = $input.all()[0].json;

if (!input.brand_id) throw new Error("brand_id is required");

// Handle KB IDs - if none provided, will fetch default
const kbIds = input.knowledge_base_ids || [];

const config = {
  brand_id: input.brand_id,
  query_context: input.query_context || "",
  knowledge_base_ids: kbIds,
  limit: input.limit || 10,
  similarity_threshold: input.similarity_threshold || 0.7,
  cache_ttl_minutes: input.cache_ttl_minutes || 60,
};

// Cache key now includes KB selection
const kbHash = kbIds.length > 0 ? kbIds.sort().join("-") : "default";
const cacheKey = `kb_context:${config.brand_id}:${kbHash}:${Buffer.from(config.query_context).toString("base64").substring(0, 32)}`;

return [
  {
    json: {
      ...config,
      cache_key: cacheKey,
    },
  },
];
```

### New Query: `Get Default KB If Needed`

```sql
-- If no KB IDs provided, get default KB for brand
SELECT id
FROM knowledge_bases
WHERE brand_id = '{{ $json.brand_id }}'
  AND is_default = true
  AND is_active = true
```

### Updated `Get Knowledge Base` Query

```sql
-- Multi-KB aware query
SELECT
  kba.id,
  kba.asset_type,
  kba.file_name,
  kba.file_url,
  kba.content_text,
  kba.metadata,
  kb.name as kb_name
FROM brand_knowledge_base kba
JOIN knowledge_bases kb ON kb.id = kba.knowledge_base_id
WHERE kba.knowledge_base_id = ANY(ARRAY[{{ $json.final_kb_ids }}]::uuid[])
  AND kba.is_active = true
ORDER BY kba.created_at DESC
LIMIT {{ $json.limit }}
```

## 6.3 Workflow Data Flow

```
┌─────────────────┐
│ Webhook Input   │
│ (with kb_ids)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Check KB IDs    │────►│ Get Default KB  │ (if empty)
│ Provided?       │     │ for Brand       │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────┐
         │ Merge KB IDs    │
         │ [default + sel] │
         └────────┬────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
┌─────────────────┐ ┌─────────────────┐
│ Vector Search   │ │ Get KB Assets   │
│ in Selected KBs │ │ (non-embedded)  │
└────────┬────────┘ └────────┬────────┘
         │                   │
         └───────────┬───────┘
                     ▼
         ┌─────────────────┐
         │ Assemble        │
         │ Brand Context   │
         └─────────────────┘
```

---

# SECTION 7: FRONTEND IMPLEMENTATION

## 7.1 Brand Vault UI Redesign

### 7.1.1 Page Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  Brand Vault                                      [+ New KB]        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Knowledge Bases                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │ 🛡️ Core    │  │ 📦 Products │  │ 👁️ Competitors│               │
│  │ Identity   │  │             │  │              │                 │
│  │ 12 assets  │  │ 45 assets   │  │ 8 assets     │                │
│  │ [DEFAULT]  │  │             │  │              │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Selected KB: Core Identity                    [⚙️] [🗑️]           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [Assets] [+ Upload]                                         │   │
│  │                                                             │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐               │   │
│  │  │  [Logo]   │  │ [Colors]  │  │  [Voice]  │               │   │
│  │  │ logo.svg  │  │ palette   │  │ guidelines│               │   │
│  │  │  Active ✓ │  │ Active ✓  │  │ Active ✓  │               │   │
│  │  └───────────┘  └───────────┘  └───────────┘               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.1.2 New Components

| Component             | Purpose                                 |
| :-------------------- | :-------------------------------------- |
| `KnowledgeBaseCard`   | Card showing KB name, type, asset count |
| `KnowledgeBaseList`   | Horizontal/grid list of KB cards        |
| `KnowledgeBaseDetail` | Expanded view with assets               |
| `CreateKBModal`       | Form to create new KB                   |
| `KBAssetGrid`         | Grid of assets within a KB              |
| `KBSelector`          | Multi-select dropdown for KB selection  |

### 7.1.3 State Management

```typescript
// New Zustand store: use-knowledge-bases.ts
interface KnowledgeBasesStore {
  // State
  knowledgeBases: KnowledgeBase[];
  selectedKBId: string | null;
  selectedKBIds: string[]; // For multi-select in prompt builder

  // Actions
  fetchKnowledgeBases: (brandId: string) => Promise<void>;
  createKnowledgeBase: (data: CreateKBData) => Promise<KnowledgeBase>;
  updateKnowledgeBase: (
    id: string,
    data: Partial<KnowledgeBase>
  ) => Promise<void>;
  deleteKnowledgeBase: (id: string) => Promise<void>;

  // Selection
  setSelectedKB: (id: string) => void;
  toggleKBSelection: (id: string) => void; // For multi-select
  clearKBSelection: () => void;
}
```

## 7.2 Creative Director KB Selector

### 7.2.1 UI Component

```
┌─────────────────────────────────────────────────────────────────────┐
│  Creative Director                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ "Create a product video showcasing our new protein powder"  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Knowledge Context:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🛡️ Core Identity (always included)                         │   │
│  │                                                             │   │
│  │ Select additional knowledge bases:                          │   │
│  │ ☑️ 📦 Product Catalog                                       │   │
│  │ ☐ 👁️ Competitor Intel                                       │   │
│  │ ☐ 📅 Summer Campaign                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─── Parsed Intent ───                                              │
│  [...]                                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2.2 Component: `KBSelector`

```tsx
// components/KBSelector.tsx
interface KBSelectorProps {
  brandId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function KBSelector({
  brandId,
  selectedIds,
  onChange,
}: KBSelectorProps) {
  const { knowledgeBases, fetchKnowledgeBases } = useKnowledgeBases();

  useEffect(() => {
    fetchKnowledgeBases(brandId);
  }, [brandId]);

  const defaultKB = knowledgeBases.find((kb) => kb.is_default);
  const selectableKBs = knowledgeBases.filter((kb) => !kb.is_default);

  return (
    <div className="space-y-3">
      {/* Default KB - always shown */}
      {defaultKB && (
        <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg">
          <Shield className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-800">
            {defaultKB.name}
          </span>
          <span className="text-xs text-indigo-500 ml-auto">
            Always included
          </span>
        </div>
      )}

      {/* Selectable KBs */}
      <div className="space-y-2">
        <span className="text-xs text-slate-500">
          Select additional knowledge bases:
        </span>
        {selectableKBs.map((kb) => (
          <label
            key={kb.id}
            className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(kb.id)}
              onChange={() => {
                if (selectedIds.includes(kb.id)) {
                  onChange(selectedIds.filter((id) => id !== kb.id));
                } else {
                  onChange([...selectedIds, kb.id]);
                }
              }}
              className="rounded border-slate-300 text-indigo-600"
            />
            <KBIcon type={kb.kb_type} color={kb.color} />
            <span className="text-sm">{kb.name}</span>
            <span className="text-xs text-slate-400 ml-auto">
              {kb.asset_count} assets
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

---

# SECTION 8: RAG SYSTEM ENHANCEMENTS

## 8.1 Updated `lib/ai/rag.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface BrandContext {
  loaded_kbs: string[];
  matched_assets: MatchedAsset[];
  brand_voice?: string;
  primary_colors?: string[];
  product_images?: string[];
  logo_url?: string;
  total_tokens_used?: number;
}

interface MatchedAsset {
  id: string;
  kb_name: string;
  asset_type: string;
  file_name: string;
  file_url?: string;
  content_text?: string;
  similarity: number;
}

interface GetBrandContextParams {
  prompt: string;
  brandId: string;
  selectedKBIds?: string[]; // NEW: Optional KB filter
  limit?: number;
  threshold?: number;
}

/**
 * Get brand context via RAG with multi-KB support
 */
export async function getBrandContext({
  prompt,
  brandId,
  selectedKBIds = [],
  limit = 10,
  threshold = 0.7,
}: GetBrandContextParams): Promise<BrandContext> {
  try {
    const supabase = await createClient();

    // Step 1: Get default KB for brand
    const { data: defaultKB } = await supabase
      .from("knowledge_bases")
      .select("id, name")
      .eq("brand_id", brandId)
      .eq("is_default", true)
      .single();

    // Step 2: Merge KB IDs (default + selected)
    const finalKBIds = defaultKB
      ? [defaultKB.id, ...selectedKBIds.filter((id) => id !== defaultKB.id)]
      : selectedKBIds;

    if (finalKBIds.length === 0) {
      console.warn("No knowledge bases found for brand:", brandId);
      return { loaded_kbs: [], matched_assets: [] };
    }

    // Step 3: Get KB names for response
    const { data: kbs } = await supabase
      .from("knowledge_bases")
      .select("id, name")
      .in("id", finalKBIds);

    const kbNames = kbs?.map((kb) => kb.name) || [];

    // Step 4: Embed the user's prompt
    const embedding = await getOpenAI().embeddings.create({
      model: "text-embedding-ada-002",
      input: prompt,
    });
    const promptEmbedding = embedding.data[0].embedding;

    // Step 5: Vector search within selected KBs
    const { data: matches, error } = await supabase.rpc("match_kb_assets", {
      query_embedding: promptEmbedding,
      match_threshold: threshold,
      match_count: limit,
      p_kb_ids: finalKBIds,
    });

    if (error) {
      console.error("RAG search error:", error);
      return { loaded_kbs: kbNames, matched_assets: [] };
    }

    // Step 6: Extract and structure context
    const matchedAssets: MatchedAsset[] =
      matches?.map((m: any) => ({
        id: m.id,
        kb_name:
          kbs?.find((kb) => kb.id === m.knowledge_base_id)?.name || "Unknown",
        asset_type: m.asset_type,
        file_name: m.file_name,
        file_url: m.file_url,
        content_text: m.content_text,
        similarity: m.similarity,
      })) || [];

    return {
      loaded_kbs: kbNames,
      matched_assets: matchedAssets,
      brand_voice: matches?.find((m: any) => m.asset_type === "guideline")
        ?.content_text,
      primary_colors: matches?.find((m: any) => m.asset_type === "color")
        ?.metadata?.colors,
      product_images: matches
        ?.filter((m: any) => m.asset_type === "product")
        .map((m: any) => m.file_url),
      logo_url: matches?.find((m: any) => m.asset_type === "logo")?.file_url,
    };
  } catch (error) {
    console.error("RAG error:", error);
    return { loaded_kbs: [], matched_assets: [] };
  }
}
```

## 8.2 Context Token Estimation

To help users understand context consumption:

```typescript
// lib/ai/tokens.ts
import { encode } from "gpt-tokenizer";

export function estimateTokens(context: BrandContext): number {
  let totalTokens = 0;

  // Count tokens from matched assets
  for (const asset of context.matched_assets) {
    if (asset.content_text) {
      totalTokens += encode(asset.content_text).length;
    }
    if (asset.file_name) {
      totalTokens += encode(asset.file_name).length;
    }
  }

  // Add buffer for metadata
  if (context.brand_voice) {
    totalTokens += encode(context.brand_voice).length;
  }

  return totalTokens;
}
```

---

# SECTION 9: MIGRATION STRATEGY

## 9.1 Migration Order

```
Step 1: Create knowledge_bases table
             │
             ▼
Step 2: Create default KBs for existing brands
             │
             ▼
Step 3: Add knowledge_base_id to brand_knowledge_base
             │
             ▼
Step 4: Migrate existing assets to default KBs
             │
             ▼
Step 5: Add FK constraint
             │
             ▼
Step 6: Update match function to support multi-KB
             │
             ▼
Step 7: Deploy API changes
             │
             ▼
Step 8: Deploy frontend changes
             │
             ▼
Step 9: Update n8n workflows
```

## 9.2 Rollback Plan

In case of issues:

```sql
-- Rollback: Remove KB relationship, keep brand_id
ALTER TABLE brand_knowledge_base DROP CONSTRAINT IF EXISTS fk_knowledge_base_id;
ALTER TABLE brand_knowledge_base DROP COLUMN IF EXISTS knowledge_base_id;

-- Original function restored
CREATE OR REPLACE FUNCTION match_brand_assets(...) -- original version
```

## 9.3 Zero-Downtime Strategy

1. **Additive changes first**: Add new columns/tables without breaking existing queries
2. **Dual-write period**: Update both old and new structures during transition
3. **Read from new**: Switch reads to new structure
4. **Clean up old**: Remove old structure after validation

---

# SECTION 10: IMPLEMENTATION ROADMAP

## 10.1 Task Breakdown

| Task                              | Files         | Est. Time | Priority |
| :-------------------------------- | :------------ | :-------- | :------- |
| **Database**                      |               |           |          |
| Create `knowledge_bases` table    | `026_*.sql`   | 30 min    | P0       |
| Evolve `brand_knowledge_base`     | `027_*.sql`   | 45 min    | P0       |
| Create `campaign_knowledge_bases` | `028_*.sql`   | 15 min    | P1       |
| Add RLS policies                  | `029_*.sql`   | 15 min    | P0       |
| Update `match_kb_assets` function | `027_*.sql`   | 30 min    | P0       |
| **API**                           |               |           |          |
| Create `/api/v1/knowledge-bases`  | `route.ts`    | 2 hours   | P0       |
| Update `/api/v1/brand-assets`     | `route.ts`    | 1 hour    | P0       |
| Update `/api/v1/director/parse`   | `route.ts`    | 1 hour    | P0       |
| **RAG System**                    |               |           |          |
| Update `lib/ai/rag.ts`            | `rag.ts`      | 2 hours   | P0       |
| Add token estimation              | `tokens.ts`   | 30 min    | P1       |
| **Frontend**                      |               |           |          |
| Create `use-knowledge-bases.ts`   | Zustand store | 1 hour    | P0       |
| Create `KnowledgeBaseCard`        | Component     | 1 hour    | P0       |
| Create `KBSelector`               | Component     | 1.5 hours | P0       |
| Update `/brand-vault/page.tsx`    | Page          | 3 hours   | P0       |
| Update `/director/page.tsx`       | Page          | 1 hour    | P0       |
| **n8n Workflows**                 |               |           |          |
| Update `Get_Brand_Context.json`   | Workflow      | 2 hours   | P0       |
| Update `Strategist_Main.json`     | Workflow      | 1 hour    | P1       |
| **Testing**                       |               |           |          |
| API tests                         | Tests         | 2 hours   | P0       |
| E2E tests                         | Tests         | 2 hours   | P1       |

**Total Estimated Time:** 22-26 hours

## 10.2 Dependency Graph

```
Database Migrations
       │
       ├──► API: /knowledge-bases
       │           │
       │           ├──► Frontend: KnowledgeBaseCard
       │           │
       │           └──► Frontend: use-knowledge-bases.ts
       │                       │
       │                       └──► Frontend: /brand-vault
       │
       ├──► RAG: lib/ai/rag.ts
       │           │
       │           └──► API: /director/parse
       │                       │
       │                       └──► Frontend: /director + KBSelector
       │
       └──► n8n: Get_Brand_Context.json
                       │
                       └──► n8n: Strategist_Main.json
```

---

# SECTION 11: VERIFICATION PLAN

## 11.1 Unit Tests

### API Tests

```typescript
describe('/api/v1/knowledge-bases', () => {
  it('creates a new KB', async () => { ... });
  it('lists KBs for a brand', async () => { ... });
  it('ensures only one default KB per brand', async () => { ... });
  it('cascades delete to assets', async () => { ... });
});

describe('getBrandContext (multi-KB)', () => {
  it('always includes default KB', async () => { ... });
  it('filters to selected KBs only', async () => { ... });
  it('returns empty when no KBs exist', async () => { ... });
});
```

### Database Tests

```sql
-- Test: Default KB uniqueness
BEGIN;
  INSERT INTO knowledge_bases (brand_id, name, is_default) VALUES ('brand-1', 'KB1', true);
  -- This should fail:
  INSERT INTO knowledge_bases (brand_id, name, is_default) VALUES ('brand-1', 'KB2', true);
ROLLBACK;
```

## 11.2 Manual Testing Checklist

### Brand Vault

- [ ] Create new KB → appears in list
- [ ] Upload asset to specific KB → asset linked correctly
- [ ] Delete KB → assets cascade deleted
- [ ] Toggle KB active/inactive
- [ ] View assets grouped by KB

### Creative Director

- [ ] KB selector shows default + available KBs
- [ ] Default KB auto-selected and locked
- [ ] Select additional KBs → reflected in parsed context
- [ ] Generated content uses correct KB context

### n8n Workflows

- [ ] Get_Brand_Context accepts KB IDs
- [ ] Context includes only selected KB assets
- [ ] Cache works with KB-aware key

## 11.3 Performance Targets

| Operation                | Target  | Measurement       |
| :----------------------- | :------ | :---------------- |
| List KBs                 | < 200ms | API response      |
| Vector search (multi-KB) | < 500ms | RAG query         |
| Context assembly         | < 100ms | Processing time   |
| KB creation UI           | < 300ms | Perceived latency |

---

# SECTION 12: FUTURE CONSIDERATIONS

## 12.1 Not In Scope (For Part II)

- KB sharing across brands (tenant isolation maintained)
- Parallel KB processing (one context at a time)
- KB versioning/history
- Auto-categorization of assets into KBs

## 12.2 Agent Architecture Integration (Part II Preview)

Part II will build on this foundation:

```
                 ┌─────────────────┐
                 │ EXECUTIVE AGENT │
                 │ (Part II)       │
                 └────────┬────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │ STRATEGIST│   │ COPYWRITER│   │ PRODUCER  │
    │  MANAGER  │   │  MANAGER  │   │  MANAGER  │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │
          └───────────────┼───────────────┘
                          │
                          ▼
          ┌─────────────────────────────┐
          │  MULTI-KB CONTEXT SYSTEM    │ ← Part I (This Document)
          │  getBrandContext({          │
          │    selectedKBIds: [...]     │
          │  })                         │
          └─────────────────────────────┘
```

---

**End of Phase 6 Part I Implementation Manifesto**

---

## APPROVAL

| Role             | Name | Date | Signature |
| :--------------- | :--- | :--- | :-------- |
| Engineering Lead |      |      |           |
| Product Owner    |      |      |           |
