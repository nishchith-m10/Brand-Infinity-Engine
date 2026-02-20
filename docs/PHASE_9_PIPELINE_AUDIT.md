# PHASE 9: PIPELINE INTEGRATION AUDIT

## Complete Provider & Feature Verification Plan

**Document Classification:** L10 SYSTEMS ARCHITECTURE  
**Version:** 1.0.0  
**Status:** PROPOSED FOR APPROVAL  
**Prerequisite:** Phase 8 (Orchestrator Wiring)  
**Target:** Verify all provider integrations, API key configurations, and feature completeness across the entire Creative Director pipeline.

---

## TABLE OF CONTENTS

1. [Executive Summary](#section-1-executive-summary)
2. [Provider Integration Audit](#section-2-provider-integration-audit)
3. [Settings Page API Key Validation](#section-3-settings-page-api-key-validation)
4. [Brand Assets Feature Gap](#section-4-brand-assets-feature-gap)
5. [Campaign Selector Bug](#section-5-campaign-selector-bug)
6. [Implementation Roadmap](#section-6-implementation-roadmap)
7. [Verification Plan](#section-7-verification-plan)

---

# SECTION 1: EXECUTIVE SUMMARY

## 1.1 Scope of Audit

This document audits the following areas of the Brand Infinity Engine:

| Area                  | Current State                                | Required State                               |
| :-------------------- | :------------------------------------------- | :------------------------------------------- |
| **Video Providers**   | Unknown if Veo3/Runway/Pika/Sora2/Pollo work | All configured providers must generate video |
| **Voice Providers**   | ElevenLabs integration exists                | Verify actual generation works               |
| **Image Providers**   | Pollinations works (just fixed)              | Verify Stable Diffusion, Banana Pro, etc.    |
| **API Key Settings**  | Placeholders exist                           | All inputs must persist and be used          |
| **Brand Assets**      | Brand Vault exists                           | Assets must be selectable in request form    |
| **Campaign Selector** | Shows 3 campaigns                            | Must only show active campaigns              |
| **BGM Integration**   | Unknown                                      | Verify background music support              |

## 1.2 Priority Classification

| Priority          | Items                                           |
| :---------------- | :---------------------------------------------- |
| **P0 - Critical** | Brand Assets selection, Campaign selector bug   |
| **P1 - High**     | Video provider verification, API key validation |
| **P2 - Medium**   | Voice/Image provider verification               |
| **P3 - Low**      | BGM integration, social media posting           |

---

# SECTION 2: PROVIDER INTEGRATION AUDIT

## 2.1 Video Generation Providers

### 2.1.1 Current Provider Matrix

| Provider     | Configured In               | API Key Setting | n8n Workflow          | Direct API | Status          |
| :----------- | :-------------------------- | :-------------- | :-------------------- | :--------- | :-------------- |
| **Veo 3**    | Unknown                     | Missing         | Unknown               | No         | 🔴 NOT VERIFIED |
| **Runway**   | `N8N_MASTER_CREDENTIALS.md` | Missing         | Production_Dispatcher | No         | 🔴 NOT VERIFIED |
| **Pika**     | `N8N_MASTER_CREDENTIALS.md` | Missing         | Production_Dispatcher | No         | 🔴 NOT VERIFIED |
| **Sora 2**   | Unknown                     | Missing         | Unknown               | No         | 🔴 NOT VERIFIED |
| **Pollo AI** | Conversation mention        | Missing         | Unknown               | No         | 🔴 NOT VERIFIED |

### 2.1.2 Video with Voice Over Flow

```
Request (video_with_vo)
    │
    ├── Strategist → Brief
    ├── Copywriter → Script
    ├── Producer → Dispatch to n8n
    │       │
    │       ├── ElevenLabs (Voice)
    │       └── Video Provider (Runway/Pika/etc)
    │               │
    │               └── Composite with BGM?
    │
    └── QA → Review
```

**Questions to Answer:**

1. Does n8n `Production_Dispatcher` actually call Runway/Pika/Pollo?
2. Is ElevenLabs integrated into the voice-over flow?
3. Is BGM (background music) supported?

### 2.1.3 Video without Voice Over Flow

Same as above, but skips ElevenLabs step.

### 2.1.4 Investigation Tasks

- [ ] Audit `brand-infinity-workflows/main-workflows/Production_Dispatcher.json`
- [ ] Find where provider selection logic lives
- [ ] Verify API key injection from Settings
- [ ] Test each provider with real API keys

---

## 2.2 Voice Generation Providers

### 2.2.1 ElevenLabs

| Aspect               | Current State      | Required                 |
| :------------------- | :----------------- | :----------------------- |
| API Integration      | Exists in codebase | Verify it works          |
| Settings Placeholder | Exists             | Must persist and be used |
| n8n Integration      | Unknown            | Must be wired            |

### 2.2.2 Investigation Tasks

- [ ] Find ElevenLabs integration code
- [ ] Trace API key usage from settings to provider call
- [ ] Test voice generation with real API key

---

## 2.3 Image Generation Providers

### 2.3.1 Provider Matrix

| Provider                 | Integration              | API Key Setting | Direct/n8n | Status          |
| :----------------------- | :----------------------- | :-------------- | :--------- | :-------------- |
| **Pollinations (Flux)**  | `lib/ai/pollinations.ts` | None needed     | Direct     | ✅ WORKING      |
| **Pollinations (Turbo)** | `lib/ai/pollinations.ts` | None needed     | Direct     | ✅ WORKING      |
| **Stable Diffusion**     | Unknown                  | Unknown         | Unknown    | 🔴 NOT VERIFIED |
| **Nano Banana Pro**      | Unknown                  | Missing         | Unknown    | 🔴 NOT VERIFIED |

### 2.3.2 Investigation Tasks

- [ ] Find Stable Diffusion integration code (if exists)
- [ ] Find Nano Banana Pro integration (if exists)
- [ ] Verify model selection works in request form
- [ ] Test each provider

---

# SECTION 3: SETTINGS PAGE API KEY VALIDATION

## 3.1 Current Settings Page Inventory

The settings page at `/settings/account` or `/settings` contains API key inputs for:

### 3.1.1 AI Providers

| Provider             | Placeholder Exists | Key Persisted | Key Used   | Status          |
| :------------------- | :----------------- | :------------ | :--------- | :-------------- |
| **OpenRouter**       | ✅ Yes             | ✅ Yes        | ✅ Yes     | ✅ WORKING      |
| **Gemini**           | ✅ Yes             | ❓ Unknown    | ❓ Unknown | 🔴 NOT VERIFIED |
| **OpenAI**           | ✅ Yes             | ❓ Unknown    | ❓ Unknown | 🔴 NOT VERIFIED |
| **DeepSeek**         | ✅ Yes             | ❓ Unknown    | ❓ Unknown | 🔴 NOT VERIFIED |
| **Claude/Anthropic** | ✅ Yes             | ❓ Unknown    | ❓ Unknown | 🔴 NOT VERIFIED |
| **Camey**            | ✅ Yes             | ❓ Unknown    | ❓ Unknown | 🔴 NOT VERIFIED |
| **ElevenLabs**       | ✅ Yes             | ❓ Unknown    | ❓ Unknown | 🔴 NOT VERIFIED |

### 3.1.2 Video Providers (MISSING)

| Provider   | Placeholder Exists | Key Persisted | Key Used | Status     |
| :--------- | :----------------- | :------------ | :------- | :--------- |
| **Runway** | ❌ No              | ❌ No         | ❌ No    | 🔴 MISSING |
| **Pika**   | ❌ No              | ❌ No         | ❌ No    | 🔴 MISSING |
| **Pollo**  | ❌ No              | ❌ No         | ❌ No    | 🔴 MISSING |

### 3.1.3 Social Media Platforms

| Platform      | Placeholder Exists | Key Persisted | Key Used   | Status          |
| :------------ | :----------------- | :------------ | :--------- | :-------------- |
| **YouTube**   | ✅ Yes             | ❓ Unknown    | ❓ Unknown | 🔴 NOT VERIFIED |
| **TikTok**    | ✅ Yes             | ❓ Unknown    | ❓ Unknown | 🔴 NOT VERIFIED |
| **Instagram** | ✅ Yes             | ❓ Unknown    | ❓ Unknown | 🔴 NOT VERIFIED |
| **Twitter/X** | ❌ No              | ❓ Unknown    | ❓ Unknown | 🔴 NOT VERIFIED |
| **LinkedIn**  | ❌ No              | ❓ Unknown    | ❓ Unknown | 🔴 NOT VERIFIED |

## 3.2 Investigation Tasks

- [ ] Audit Settings page component (`app/(dashboard)/settings/`)
- [ ] Trace API key save flow to database
- [ ] Trace API key retrieval and injection into provider calls
- [ ] Add missing video provider placeholders
- [ ] Test each provider with real keys

---

# SECTION 4: BRAND ASSETS FEATURE GAP

## 4.1 Problem Statement

> "In the Script and Context page, there is no option to select brand assets (reference images from Brand Vault). I can choose campaign, knowledge base, and brand identity, but NOT brand assets."

## 4.2 Current State

```
Request Form (Script & Context)
    │
    ├── Campaign Selector ✅
    ├── Knowledge Base Selector ✅
    ├── Brand Identity Selector ✅
    │
    └── Brand Assets Selector ❌ MISSING
```

## 4.3 Required Implementation

### 4.3.1 Database Schema (Existing)

The `brand_assets` table already exists:

```sql
CREATE TABLE brand_assets (
  id UUID PRIMARY KEY,
  brand_id UUID REFERENCES brands(id),
  asset_type TEXT, -- 'logo', 'image', 'video', 'font', etc.
  file_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

### 4.3.2 UI Changes Required

1. Add "Brand Assets" selector to `RequestForm.tsx`
2. Fetch assets from `/api/v1/brand-assets`
3. Display thumbnails for image/logo assets
4. Allow multi-select
5. Include selected asset IDs in request payload

### 4.3.3 Pipeline Changes Required

1. Pass `brand_asset_ids` to Strategist agent
2. Strategist fetches asset URLs and includes in prompt
3. Image generation receives reference images for style matching

## 4.4 Files to Modify

| File                                  | Change                    |
| :------------------------------------ | :------------------------ |
| `components/pipeline/RequestForm.tsx` | Add Brand Assets selector |
| `app/api/v1/requests/route.ts`        | Accept `brand_asset_ids`  |
| `lib/adapters/StrategistAdapter.ts`   | Fetch and include assets  |
| `lib/adapters/ProducerAdapter.ts`     | Pass assets to image gen  |

---

# SECTION 5: CAMPAIGN SELECTOR BUG

## 5.1 Problem Statement

> "In the Script and Context Campaign selector, I see 3 campaigns but only 1 is active. 2 were deleted but still appear."

## 5.2 Root Cause Hypothesis

1. **Hardcoded campaigns** - Campaign list may be hardcoded in the component
2. **Missing soft-delete filter** - Campaigns have `deleted_at` column but query doesn't filter
3. **Stale cache** - React Query or SWR caching old data

## 5.3 Investigation Tasks

- [ ] Audit `RequestForm.tsx` campaign selector
- [ ] Check if campaigns are hardcoded
- [ ] Check API route for soft-delete filter
- [ ] Verify database has `deleted_at` column and uses it

## 5.4 Files to Audit

| File                                  | What to Check            |
| :------------------------------------ | :----------------------- |
| `components/pipeline/RequestForm.tsx` | Campaign fetch logic     |
| `app/api/v1/campaigns/route.ts`       | Query filter for deleted |
| `hooks/useCampaigns.ts` or similar    | Client-side caching      |

---

# SECTION 6: IMPLEMENTATION ROADMAP

## 6.1 Phase 9A: Critical Fixes (P0)

| Task                                      | Effort | Owner |
| :---------------------------------------- | :----- | :---- |
| Fix Campaign Selector to exclude deleted  | 1hr    | Agent |
| Add Brand Assets selector to request form | 4hr    | Agent |
| Wire Brand Assets to Strategist/Producer  | 2hr    | Agent |

## 6.2 Phase 9B: Provider Verification (P1)

| Task                             | Effort | Owner |
| :------------------------------- | :----- | :---- |
| Audit n8n Production_Dispatcher  | 2hr    | Agent |
| Add missing API key placeholders | 2hr    | Agent |
| Test Runway integration          | 1hr    | User  |
| Test Pika integration            | 1hr    | User  |
| Test Pollo integration           | 1hr    | User  |
| Test ElevenLabs integration      | 1hr    | User  |

## 6.3 Phase 9C: Settings Validation (P1)

| Task                                   | Effort | Owner |
| :------------------------------------- | :----- | :---- |
| Trace API key save → use flow          | 2hr    | Agent |
| Add validation tests for each provider | 4hr    | Agent |
| Document provider key requirements     | 1hr    | Agent |

## 6.4 Phase 9D: Image Provider Expansion (P2)

| Task                                   | Effort | Owner |
| :------------------------------------- | :----- | :---- |
| Implement Stable Diffusion integration | 4hr    | Agent |
| Implement Nano Banana Pro              | 4hr    | Agent |
| Add model selection to request form    | 2hr    | Agent |

---

# SECTION 7: VERIFICATION PLAN

## 7.1 End-to-End Test Cases

### 7.1.1 Image Generation (Complete Flow)

```
1. Create request with type: 'image'
2. Select campaign (verify only active shown)
3. Select brand assets (verify UI works)
4. Submit request
5. Verify Strategist runs
6. Verify Producer generates image
7. Verify image displays in Pipeline Board
```

### 7.1.2 Video with Voice Over (Complete Flow)

```
1. Create request with type: 'video_with_vo'
2. Select campaign and brand assets
3. Submit request
4. Verify Strategist → Copywriter → Producer chain
5. Verify ElevenLabs voice generated (if key configured)
6. Verify video generated (if provider key configured)
7. Verify voice and video composited
8. Verify output in Pipeline Board
```

### 7.1.3 Video without Voice Over (Complete Flow)

```
1. Create request with type: 'video_no_vo'
2. Submit and verify flow skips voice generation
3. Verify video output
```

### 7.1.4 API Key Validation

```
For each provider:
1. Save API key in Settings
2. Create request using that provider
3. Verify provider receives correct key
4. Verify generation succeeds
```

## 7.2 Success Criteria

| Criteria                                     | Metric                         |
| :------------------------------------------- | :----------------------------- |
| Campaign selector shows only active          | 1 campaign, not 3              |
| Brand assets can be selected                 | UI picker functional           |
| Image generation works with Pollinations     | Already verified               |
| Image generation works with Stable Diffusion | Returns valid image            |
| Video generation works with Runway           | Returns valid video            |
| Voice generation works with ElevenLabs       | Returns valid audio            |
| All API keys persist and are used            | DB storage traced to API calls |

---

# APPENDIX A: FILE INVENTORY

## A.1 Core Request Flow

| File                                      | Purpose               |
| :---------------------------------------- | :-------------------- |
| `components/pipeline/RequestForm.tsx`     | Request creation form |
| `app/api/v1/requests/route.ts`            | Request API endpoint  |
| `lib/orchestrator/RequestOrchestrator.ts` | Main orchestration    |
| `lib/adapters/*.ts`                       | Agent adapters        |

## A.2 Provider Integrations

| File                        | Purpose                |
| :-------------------------- | :--------------------- |
| `lib/ai/pollinations.ts`    | Pollinations image gen |
| `lib/ai/openai.ts`          | OpenAI                 |
| `lib/ai/elevenlabs.ts`      | ElevenLabs voice       |
| `brand-infinity-workflows/` | n8n workflows          |

## A.3 Settings

| File                          | Purpose         |
| :---------------------------- | :-------------- |
| `app/(dashboard)/settings/`   | Settings pages  |
| `app/api/user/provider-keys/` | API key storage |

---

**END OF DOCUMENT**
