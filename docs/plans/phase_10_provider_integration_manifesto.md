# Phase 10: Provider Integration Manifesto

## Complete Provider Wiring Implementation Roadmap

**Document Version:** 1.0.0  
**Created:** January 18, 2026  
**Reference:** Settings API Audit + Creative Director Form Analysis  
**Estimated Total Effort:** 95-120 hours across 5 pillars  
**Execution Model:** Complexity-based multi-agent approach with mandatory sequential thinking

---

## Executive Summary

This document provides the complete implementation roadmap for wiring ALL UI provider options to working backend implementations. Every dropdown option, settings field, and provider selector in Brand Infinity Engine must route to functional code.

### The Problem

The settings page and Creative Director form display provider options that appear functional but are not connected to backend implementations:

- 24 providers shown in UI with no or incomplete backend code
- Users can enter API keys that are never retrieved or used
- Dropdown selections route to stubs or throw "not implemented" errors
- This creates a misleading product experience and breaks user trust

### The Solution

Implement working adapters for every UI-visible provider with:

- Proper API integration using official SDKs or REST APIs
- User key retrieval via `getEffectiveProviderKey()` from the Settings page
- Consistent error handling and response formats
- Proper routing from UI selection to correct adapter
- Verified end-to-end functionality

---

## Execution Philosophy

### Core Principles

1. **No Hallucination Policy**: Every implementation must reference official API documentation. No guessing endpoints, parameters, or response formats.

2. **Sequential Thinking Mandatory**: Use the `mcp_sequential-thinking_sequentialthinking` tool at the start of every pillar and sub-task to plan, reason, and verify approach.

3. **Verify Before Proceed**: Each provider integration must be tested with real API calls before marking complete. Mock-only implementations are not acceptable.

4. **Pattern Consistency**: Follow the existing adapter patterns in `lib/llm/adapters/` and `lib/video/adapters/` for structure, error handling, and exports.

5. **User Key Priority**: All adapters MUST use `getEffectiveProviderKey()` to check for user-provided keys before falling back to environment variables.

---

## Complexity Levels and Agent Configuration

### 🟢 EASY Complexity

**Criteria:**

- 1-2 files to modify
- Pattern already exists (replicate existing adapter)
- No external API research needed
- Simple REST API with clear documentation
- No OAuth or complex auth flows

**Agent Configuration:**
| Role | Count | Responsibility |
|------|-------|----------------|
| Executor | 1 | Implement the changes |
| Verifier | 1 | Run tests, verify build, check functionality |

**Sequential Thinking Usage:**

- Single thought chain at start to confirm approach
- Verification thought chain to check against requirements

**Tools Required:**

- `view_file` for pattern reference
- `grep_search` for existing implementations
- `write_to_file` / `replace_file_content` for changes
- `run_command` for testing

**Estimated Duration:** 1-2 hours per provider

**Example Tasks:**

- Wiring Pollo adapter to use `getEffectiveProviderKey()`
- Adding provider type to existing enum

---

### 🟡 MEDIUM Complexity

**Criteria:**

- 3-5 files to modify
- New adapter file creation required
- API documentation review needed
- Simple API key authentication
- Standard REST API patterns

**Agent Configuration:**
| Role | Count | Responsibility |
|------|-------|----------------|
| Planner | 1 | Analyze requirements, design approach, identify risks |
| Executor | 2 | Parallel implementation of adapter + route wiring |
| Verifier | 1 | Integration testing, error scenario validation |

**Sequential Thinking Usage:**

- Planning phase: 3-5 thoughts to design adapter interface
- Implementation phase: 1-2 thoughts per file
- Verification phase: 2-3 thoughts to validate edge cases

**Tools Required:**

- `mcp_brave-search_brave_web_search` for API documentation
- `read_url_content` for official docs
- All tools from EASY level

**Estimated Duration:** 3-4 hours per provider

**Example Tasks:**

- ElevenLabs TTS integration
- Stable Diffusion API integration
- Kimi/Moonshot LLM adapter

---

### 🟠 HARD Complexity

**Criteria:**

- 6-10 files to modify
- OAuth or complex authentication flows
- Multiple API endpoints per provider
- Webhook/callback handling required
- Rate limiting and retry logic needed

**Agent Configuration:**
| Role | Count | Responsibility |
|------|-------|----------------|
| Planner | 1 | Architecture design, auth flow mapping, risk assessment |
| Coordinator | 1 | Sequence execution, manage dependencies between tasks |
| Executor | 3 | Auth module, API adapter, route/callback handlers |
| Verifier | 1 | Full integration testing, security review |

**Sequential Thinking Usage:**

- Planning phase: 5-8 thoughts for complete architecture
- Each executor: 3-4 thoughts per component
- Coordinator: 2-3 thoughts for dependency management
- Verification: 4-5 thoughts for comprehensive testing

**Tools Required:**

- `mcp_puppeteer_*` for OAuth flow testing
- All tools from MEDIUM level
- Database migration tools for token storage

**Estimated Duration:** 6-8 hours per provider

**Example Tasks:**

- YouTube API with OAuth
- Instagram/Meta Graph API
- LinkedIn OAuth integration

---

### 🔴 COMPLEX (Expert) Complexity

**Criteria:**

- 10+ files to modify
- Multiple external services interaction
- Async job polling with webhook callbacks
- File upload/download handling
- Complex state machine for job lifecycle
- Storage integration for generated assets

**Agent Configuration:**
| Role | Count | Responsibility |
|------|-------|----------------|
| Planner | 1 | Full system design, API flow diagrams, state machine design |
| Coordinator | 2 | One for API side, one for callback/webhook side |
| Executor | 4 | Job creation, status polling, callback handling, storage |
| Verifier | 1 | End-to-end testing with real API calls |
| QA Agent | 1 | Edge case exploration, error injection testing |

**Sequential Thinking Usage:**

- Planning phase: 8-12 thoughts for complete system design
- Each executor: 5-6 thoughts with verification checkpoints
- Coordinators: 4-5 thoughts for state management
- Verifiers: 6-8 thoughts for comprehensive test scenarios
- QA: 5-6 thoughts for failure mode analysis

**Tools Required:**

- All previous level tools
- `mcp_n8n_*` for workflow integration
- Database tools for job state persistence
- Storage service integration

**Estimated Duration:** 10-15 hours per provider

**Example Tasks:**

- Sora 2 video generation (async job with polling)
- Veo 3 direct Gemini API integration
- Full social publishing with scheduling

---

## Phase Overview

| Pillar | Focus Area                 | Providers | Complexity Mix                      | Estimated Hours |
| ------ | -------------------------- | --------- | ----------------------------------- | --------------- |
| I      | LLM Provider Completion    | 1         | Medium                              | 4 hours         |
| II     | Video Provider Integration | 7         | 1 Easy, 2 Medium, 2 Hard, 2 Complex | 45 hours        |
| III    | Image Provider Completion  | 1         | Medium                              | 4 hours         |
| IV     | Voice/TTS Integration      | 1         | Medium                              | 4 hours         |
| V      | Social Publishing APIs     | 5         | All Hard/Complex                    | 40 hours        |

**Total Estimated Effort:** 97 hours of implementation
**Buffer for unexpected issues:** +20% = 116 hours total

---

## Pillar I: LLM Provider Completion

### Pillar Overview

Complete the LLM adapter set by implementing the one missing provider shown in the Settings API section.

**Pillar Duration:** 4 hours  
**Dependencies:** None (can start immediately)  
**Verification:** Chat completion test with real API key

---

### Task I-1: Kimi/Moonshot LLM Adapter

**Complexity Level:** 🟡 MEDIUM  
**Agent Configuration:** Planner + 2 Executors + Verifier  
**Estimated Duration:** 4 hours

#### Problem Statement

The Settings page shows "Kimi (Moonshot)" with description "Kimi K2 Thinking - 2M context window" but there is no corresponding adapter in `lib/llm/adapters/`. Users can enter an API key that is never used.

#### Current State Analysis

**UI Location:** Settings → API Keys → Other AI Providers → Kimi (Moonshot)  
**Settings Key:** `kimi`  
**Backend Code:** ❌ Does not exist  
**Provider URL:** https://platform.moonshot.cn/  
**API Style:** OpenAI-compatible REST API

#### Target State

After implementation:

- New file: `lib/llm/adapters/kimi.ts`
- Adapter follows same pattern as `openai.ts` and `deepseek.ts`
- Uses `getEffectiveProviderKey('kimi', process.env.KIMI_API_KEY)` for key retrieval
- Integrated into `lib/llm/service.ts` for model selection
- Model selector can route to Kimi when selected

#### Implementation Steps

**Step 1: Research Kimi/Moonshot API (Sequential Thinking Required)**

Before writing code, use sequential thinking to:

1. Read official Moonshot API documentation
2. Identify endpoint URLs, authentication method, request/response format
3. Compare with OpenAI pattern for compatibility
4. Document any unique parameters or behaviors

```typescript
// Expected findings to document:
// - Base URL: https://api.moonshot.cn/v1
// - Auth: Bearer token in Authorization header
// - Format: OpenAI-compatible (messages array, model string)
// - Models: moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k
```

**Step 2: Create Kimi Adapter**

Create new file: `lib/llm/adapters/kimi.ts`

```typescript
/**
 * Kimi (Moonshot) LLM Adapter
 * OpenAI-compatible API with extended context windows
 */

import { getEffectiveProviderKey } from "@/lib/providers/get-user-key";
import {
  LLMAdapter,
  LLMRequest,
  LLMResponse,
  LLMStreamHandler,
} from "../types";

const KIMI_BASE_URL = "https://api.moonshot.cn/v1";

const KIMI_MODELS = {
  "moonshot-v1-8k": {
    contextWindow: 8192,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.002,
  },
  "moonshot-v1-32k": {
    contextWindow: 32768,
    costPer1kInput: 0.002,
    costPer1kOutput: 0.004,
  },
  "moonshot-v1-128k": {
    contextWindow: 131072,
    costPer1kInput: 0.006,
    costPer1kOutput: 0.012,
  },
  "kimi-k2-thinking": {
    contextWindow: 2097152,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.02,
  },
} as const;

export type KimiModel = keyof typeof KIMI_MODELS;

export class KimiAdapter implements LLMAdapter {
  private apiKeyPromise: Promise<string | null>;

  constructor(userId?: string) {
    this.apiKeyPromise = getEffectiveProviderKey(
      "kimi",
      process.env.KIMI_API_KEY,
      userId,
    );
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = await this.apiKeyPromise;
    if (!apiKey) {
      throw new Error(
        "Kimi API key not configured. Add your key in Settings or set KIMI_API_KEY.",
      );
    }

    const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || "moonshot-v1-32k",
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      cost: this.calculateCost(
        data.model,
        data.usage.prompt_tokens,
        data.usage.completion_tokens,
      ),
    };
  }

  async streamChat(
    request: LLMRequest,
    handler: LLMStreamHandler,
  ): Promise<void> {
    const apiKey = await this.apiKeyPromise;
    if (!apiKey) {
      throw new Error("Kimi API key not configured.");
    }

    const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || "moonshot-v1-32k",
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi API error: ${response.status} - ${error}`);
    }

    // Handle SSE stream (same pattern as OpenAI)
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No response body");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk
        .split("\n")
        .filter((line) => line.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          handler.onComplete?.();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            handler.onToken(content);
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    handler.onComplete?.();
  }

  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const modelInfo = KIMI_MODELS[model as KimiModel];
    if (!modelInfo) return 0;

    return (
      (inputTokens / 1000) * modelInfo.costPer1kInput +
      (outputTokens / 1000) * modelInfo.costPer1kOutput
    );
  }

  isConfigured(): boolean {
    // Check synchronously using env var (async key check happens in methods)
    return !!process.env.KIMI_API_KEY;
  }

  getAvailableModels(): string[] {
    return Object.keys(KIMI_MODELS);
  }
}

export function createKimiAdapter(userId?: string): KimiAdapter {
  return new KimiAdapter(userId);
}
```

**Step 3: Register in LLM Service**

Modify: `lib/llm/service.ts`

Add Kimi to the provider registry:

```typescript
import { createKimiAdapter } from './adapters/kimi';

// In getAdapter function:
case 'kimi':
case 'moonshot':
  return createKimiAdapter(userId);
```

**Step 4: Add to Model Pools**

Modify: `lib/llm/model-pools.ts`

Add Kimi models to available pools:

```typescript
{
  id: 'moonshot-v1-128k',
  provider: 'kimi',
  contextWindow: 131072,
  capabilities: ['large-context', 'reasoning'],
  costTier: 'medium',
},
{
  id: 'kimi-k2-thinking',
  provider: 'kimi',
  contextWindow: 2097152, // 2M tokens!
  capabilities: ['ultra-context', 'deep-reasoning'],
  costTier: 'premium',
},
```

**Step 5: Update Provider Type**

Modify: `lib/providers/get-user-key.ts`

Add 'kimi' to ProviderType:

```typescript
export type ProviderType =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "elevenlabs"
  | "midjourney"
  | "pollo"
  | "openrouter"
  | "kimi"
  | "other";
```

**Step 6: Verification (Sequential Thinking Required)**

Use sequential thinking to verify:

1. Build passes with new adapter
2. TypeScript types are correct
3. Test with real Kimi API key (if available) or mock
4. Verify key retrieval from Settings works
5. Check model selection routes correctly

#### Files Modified

| File                          | Action | Lines Changed     |
| ----------------------------- | ------ | ----------------- |
| lib/llm/adapters/kimi.ts      | Create | ~150 lines        |
| lib/llm/service.ts            | Modify | +5 lines          |
| lib/llm/model-pools.ts        | Modify | +15 lines         |
| lib/providers/get-user-key.ts | Modify | +1 line           |
| lib/llm/adapters/index.ts     | Modify | +2 lines (export) |

#### Rollback Plan

If issues arise:

1. Remove kimi.ts adapter file
2. Revert changes to service.ts and model-pools.ts
3. Provider type can remain (harmless)

#### Success Criteria

- [ ] `lib/llm/adapters/kimi.ts` exists and exports KimiAdapter
- [ ] TypeScript build passes
- [ ] Kimi API key from Settings is retrieved via getEffectiveProviderKey
- [ ] Chat completion works with valid API key
- [ ] Model switching between Kimi models works
- [ ] Streaming responses work correctly
- [ ] Cost calculation is accurate

---

## Pillar II: Video Provider Integration

### Pillar Overview

Wire all video providers shown in the Creative Director form and Settings preferences to working backend implementations. This is the largest pillar with mixed complexity levels.

**Pillar Duration:** 45 hours  
**Dependencies:** None (can run parallel with Pillar I)  
**Verification:** Actual video generation with each provider

---

### Task II-1: Wire Pollo to User Keys

**Complexity Level:** 🟢 EASY  
**Agent Configuration:** Single Executor + Verifier  
**Estimated Duration:** 1 hour

#### Problem Statement

The Pollo adapter exists (`lib/video/adapters/pollo-adapter.ts`) but uses `process.env.POLLO_API_KEY` directly instead of `getEffectiveProviderKey()`. Users who enter their Pollo key in Settings have it ignored.

#### Current State

```typescript
// lib/video/adapters/pollo-adapter.ts line 51
this.apiKey = apiKey || process.env.POLLO_API_KEY || "";
```

This bypasses the user key system entirely.

#### Target State

```typescript
// Should use:
import { getEffectiveProviderKey } from "@/lib/providers/get-user-key";

// In constructor or before API calls:
const effectiveKey = await getEffectiveProviderKey(
  "pollo",
  process.env.POLLO_API_KEY,
  userId,
);
```

#### Implementation Steps

**Step 1: Update Pollo Adapter Constructor**

The adapter is instantiated synchronously but key retrieval is async. Two options:

Option A: Lazy key loading (preferred)

```typescript
export class PolloAdapter {
  private apiKeyPromise: Promise<string | null>;

  constructor(apiKey?: string, userId?: string) {
    if (apiKey) {
      this.apiKeyPromise = Promise.resolve(apiKey);
    } else {
      this.apiKeyPromise = getEffectiveProviderKey(
        "pollo",
        process.env.POLLO_API_KEY,
        userId,
      );
    }
  }

  private async getApiKey(): Promise<string> {
    const key = await this.apiKeyPromise;
    if (!key) {
      throw new Error(
        "Pollo API key not configured. Add your key in Settings.",
      );
    }
    return key;
  }

  async createTask(request: PolloVideoRequest): Promise<PolloVideoResponse> {
    const apiKey = await this.getApiKey();
    // ... rest of implementation using apiKey
  }
}
```

**Step 2: Add 'pollo' to ProviderType if not present**

Check `lib/providers/get-user-key.ts` - 'pollo' should already be there.

**Step 3: Update VideoService to pass userId**

Modify `lib/video/service.ts` to pass userId when creating adapter:

```typescript
private async generateWithPollo(request: VideoGenerationRequest, userId?: string): Promise<VideoGenerationJob> {
  this.polloAdapter = getPolloAdapter(undefined, userId);
  // ...
}
```

**Step 4: Verification**

- Enter Pollo API key in Settings page
- Trigger video generation with Pollo provider
- Verify the user key is retrieved (check console logs)
- Confirm video generation works

#### Files Modified

| File                                | Action | Lines Changed |
| ----------------------------------- | ------ | ------------- |
| lib/video/adapters/pollo-adapter.ts | Modify | ~30 lines     |
| lib/video/service.ts                | Modify | ~10 lines     |

#### Success Criteria

- [ ] Pollo adapter uses getEffectiveProviderKey
- [ ] User key from Settings is used when present
- [ ] Falls back to env var when no user key
- [ ] Video generation works with user-provided key

---

### Task II-2: Sora 2 Video Integration

**Complexity Level:** 🔴 COMPLEX  
**Agent Configuration:** Planner + 2 Coordinators + 4 Executors + Verifier + QA  
**Estimated Duration:** 12 hours

#### Problem Statement

The Creative Director form lists "Sora 2" as a video provider option. The current code shows:

```typescript
// lib/video/service.ts line 216-218
provider: 'sora',
available: false,
reason: 'Sora API in limited preview',
```

Sora 2 has since become available via OpenAI API. Integration is required.

#### Current State Analysis

- UI shows "Sora 2" as selectable option
- Backend returns "not available" for Sora
- Routes to Pollo as fallback (incorrect behavior)
- No actual Sora API integration exists

#### Target State

- New adapter: `lib/video/adapters/sora-adapter.ts`
- Async job creation with job ID
- Status polling for job completion
- Video URL retrieval on completion
- Proper error handling for all states
- Integration with generation_jobs table for persistence

#### API Research Required (Sequential Thinking)\*\*

Before implementation, research and document:

1. OpenAI Sora API endpoint URLs
2. Authentication method (likely same as ChatGPT API)
3. Request format (prompt, duration, resolution, aspect ratio)
4. Response format (job ID, status, video URL)
5. Polling interval recommendations
6. Rate limits and quotas
7. Pricing per generation

#### Implementation Steps

**Step 1: Create Sora Adapter**

Create new file: `lib/video/adapters/sora-adapter.ts`

Structure:

```typescript
export interface SoraVideoRequest {
  prompt: string;
  duration?: 5 | 10 | 15 | 20;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  resolution?: '720p' | '1080p';
  style?: 'natural' | 'vivid';
}

export interface SoraJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  videoUrl?: string;
  error?: string;
}

export class SoraAdapter {
  private apiKeyPromise: Promise<string | null>;

  constructor(userId?: string) {
    this.apiKeyPromise = getEffectiveProviderKey('openai', process.env.OPENAI_API_KEY, userId);
  }

  async createVideoJob(request: SoraVideoRequest): Promise<{ jobId: string }> { ... }
  async getJobStatus(jobId: string): Promise<SoraJobStatus> { ... }
  async waitForCompletion(jobId: string, timeoutMs?: number): Promise<SoraJobStatus> { ... }
}
```

**Step 2: Update VideoService**

Add Sora to the switch statement:

```typescript
case 'sora':
  return this.generateWithSora(request, userId);
```

Implement generateWithSora method with job creation and status tracking.

**Step 3: Database Integration**

Update generation_jobs table interaction to track Sora jobs:

- Store job ID from Sora API
- Update status from polling
- Store video URL on completion

**Step 4: Webhook Alternative (Optional)**

If Sora supports webhooks, implement callback endpoint:

- `app/api/v1/callbacks/sora/route.ts`
- Handle job completion notifications

**Step 5: Verification**

- Test job creation with real API key
- Test status polling returns expected states
- Test video URL retrieval on completion
- Test error handling for failed jobs
- Test timeout handling for long jobs

#### Files Modified

| File                               | Action | Lines Changed         |
| ---------------------------------- | ------ | --------------------- |
| lib/video/adapters/sora-adapter.ts | Create | ~200 lines            |
| lib/video/service.ts               | Modify | +50 lines             |
| lib/video/adapters/index.ts        | Modify | +2 lines              |
| app/api/v1/callbacks/sora/route.ts | Create | ~100 lines (optional) |
| tests/video/sora-adapter.test.ts   | Create | ~200 lines            |

#### Success Criteria

- [ ] Sora adapter created with full job lifecycle support
- [ ] Job creation returns valid job ID
- [ ] Status polling works correctly
- [ ] Video URL retrieved on completion
- [ ] Error states handled gracefully
- [ ] Timeout handling implemented
- [ ] Integration with generation_jobs table works

---

### Task II-3: Veo 3 Direct Gemini API Integration

**Complexity Level:** 🔴 COMPLEX  
**Agent Configuration:** Planner + 2 Coordinators + 4 Executors + Verifier + QA  
**Estimated Duration:** 12 hours

#### Problem Statement

Veo 3 is currently only accessible via the Pollo API. Users may want to use their own Google Cloud/Gemini API key directly for potentially lower costs or different quotas.

The Settings page shows "Google Gemini" with description "Veo video generation" but the Gemini adapter only handles text models.

#### Current State

- Gemini LLM adapter exists: `lib/llm/adapters/gemini.ts` (text only)
- Veo 3 works via Pollo adapter (indirect)
- No direct Gemini video API integration

#### Target State

- New adapter: `lib/video/adapters/gemini-veo-adapter.ts`
- Uses Google AI Gemini API for video generation
- Retrieves key via `getEffectiveProviderKey('gemini', ...)`
- Supports Veo 3 and Veo 3 Fast models

#### Implementation Steps

Similar structure to Sora adapter but for Google's Gemini video API.

**Key differences:**

- Uses Google AI SDK or REST API
- May require different authentication (Google Cloud project vs API key)
- Different request/response format

**Step 1: Research Gemini Video API**

Document:

1. Endpoint: Likely `generativelanguage.googleapis.com` or Vertex AI
2. Authentication: API key or OAuth2 service account
3. Request format for video generation
4. Job/operation polling pattern
5. Video output format and download

**Step 2-5:** [Similar to Sora - Create adapter, update service, test]

#### Files Modified

| File                                     | Action | Lines Changed |
| ---------------------------------------- | ------ | ------------- |
| lib/video/adapters/gemini-veo-adapter.ts | Create | ~200 lines    |
| lib/video/service.ts                     | Modify | +50 lines     |

#### Success Criteria

- [ ] Direct Gemini video API integration works
- [ ] Uses user's Gemini API key from Settings
- [ ] Veo 3 and Veo 3 Fast models supported
- [ ] Full job lifecycle (create, poll, complete)

---

### Task II-4: Runway Direct API Integration

**Complexity Level:** 🟠 HARD  
**Agent Configuration:** Planner + Coordinator + 3 Executors + Verifier  
**Estimated Duration:** 6 hours

#### Problem Statement

Currently Runway routes to Pollo as fallback:

```typescript
// lib/video/service.ts line 116-124
private async generateWithRunway(request: VideoGenerationRequest): Promise<VideoGenerationJob> {
  // TODO: Implement direct Runway API integration
  // For now, route through Pollo if Pollo is configured
  if (this.polloAdapter.isConfigured()) {
    console.log('[VideoService] Routing Runway request through Pollo');
    return this.generateWithPollo(request);
  }
  throw new Error('Direct Runway API not yet implemented.');
}
```

#### Target State

- New adapter: `lib/video/adapters/runway-adapter.ts`
- Direct integration with Runway Gen-3 API
- Proper job management and polling
- Uses user Runway API key from Settings

#### Implementation Steps

[Similar structure - research API, create adapter, integrate]

---

### Task II-5: Pika Direct API Integration

**Complexity Level:** 🟡 MEDIUM  
**Agent Configuration:** Planner + 2 Executors + Verifier  
**Estimated Duration:** 4 hours

#### Problem Statement

Pika currently routes through Pollo. Need direct API integration.

---

### Task II-6: Seedream 4.0 Integration

**Complexity Level:** 🟡 MEDIUM  
**Agent Configuration:** Planner + 2 Executors + Verifier  
**Estimated Duration:** 4 hours

#### Problem Statement

Settings Preferences shows "Seedream 4.0" as video model option but no integration exists.

#### Current State

Only cost calculation exists:

```typescript
// utils/cost_tracker.ts line 34
case 'seedream':
```

No actual API adapter.

---

### Task II-7: Nano-B Video Integration

**Complexity Level:** 🟡 MEDIUM  
**Agent Configuration:** Planner + 2 Executors + Verifier  
**Estimated Duration:** 4 hours

#### Problem Statement

Settings Preferences shows "Nano-B (Fast & Cheap)" as video model option. Only image generation exists in `lib/ai/nanob.ts`, no video.

---

## Pillar III: Image Provider Completion

### Pillar Overview

Complete the image generation provider set.

**Pillar Duration:** 4 hours  
**Dependencies:** None

---

### Task III-1: Stable Diffusion Integration

**Complexity Level:** 🟡 MEDIUM  
**Agent Configuration:** Planner + 2 Executors + Verifier  
**Estimated Duration:** 4 hours

#### Problem Statement

Creative Director form lists "Stable Diffusion" as image provider option but no backend code exists.

#### Target State

- New adapter: `lib/ai/stable-diffusion.ts`
- Integration with Stability AI API or self-hosted
- Uses user API key from Settings

#### Implementation Steps

**Step 1: Research Stability AI API**

Document:

1. Endpoint: `https://api.stability.ai/`
2. Authentication: API key in header
3. Models: SDXL, SD3, etc.
4. Request format for text-to-image
5. Response format (base64 or URL)

**Step 2: Create Adapter**

```typescript
// lib/ai/stable-diffusion.ts
import { getEffectiveProviderKey } from "@/lib/providers/get-user-key";

export interface StableDiffusionParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  model?: "sdxl" | "sd3" | "sd3-turbo";
}

export async function generateImageStableDiffusion(
  params: StableDiffusionParams,
  userId?: string,
): Promise<{ url: string; model: string }> {
  const apiKey = await getEffectiveProviderKey(
    "stablediffusion",
    process.env.STABILITY_API_KEY,
    userId,
  );
  if (!apiKey) {
    throw new Error("Stable Diffusion API key not configured.");
  }

  // Implementation...
}
```

**Step 3: Add to Provider Type**

Add 'stablediffusion' to ProviderType in `lib/providers/get-user-key.ts`

**Step 4: Update Image Generation Service**

Wire into image generation flow to route when selected.

#### Files Modified

| File                          | Action | Lines Changed |
| ----------------------------- | ------ | ------------- |
| lib/ai/stable-diffusion.ts    | Create | ~100 lines    |
| lib/providers/get-user-key.ts | Modify | +1 line       |
| lib/image-processor.ts        | Modify | +20 lines     |

#### Success Criteria

- [ ] Stable Diffusion adapter created
- [ ] User API key from Settings works
- [ ] Image generation produces valid results
- [ ] Multiple models supported (SDXL, SD3)

---

## Pillar IV: Voice/TTS Integration

### Pillar Overview

Implement ElevenLabs TTS integration for professional voiceover generation.

**Pillar Duration:** 4 hours  
**Dependencies:** None

---

### Task IV-1: ElevenLabs TTS Integration

**Complexity Level:** 🟡 MEDIUM  
**Agent Configuration:** Planner + 2 Executors + Verifier  
**Estimated Duration:** 4 hours

#### Problem Statement

Creative Director form shows three ElevenLabs voice options:

- ElevenLabs - Calm
- ElevenLabs - Energetic
- ElevenLabs - Professional

Settings shows ElevenLabs API key field. But no backend code exists.

#### Current State

- Settings key: `elevenlabs`
- Backend code: ❌ Does not exist
- Only Pollinations TTS works currently

#### Target State

- New file: `lib/ai/elevenlabs.ts`
- Support for multiple voices (mapped to ElevenLabs voice IDs)
- Streaming audio capability
- Returns audio file URL or base64

#### Implementation Steps

**Step 1: Research ElevenLabs API**

Document:

1. Endpoint: `https://api.elevenlabs.io/v1/`
2. Authentication: `xi-api-key` header
3. Voices endpoint to list available voices
4. Text-to-speech endpoint
5. Audio format options (mp3, wav, etc.)
6. Streaming capability

**Step 2: Create ElevenLabs Adapter**

```typescript
// lib/ai/elevenlabs.ts
import { getEffectiveProviderKey } from "@/lib/providers/get-user-key";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

// Map our voice names to ElevenLabs voice IDs
const VOICE_MAP = {
  calm: "EXAVITQu4vr4xnSDxMaL", // Example - need real IDs
  energetic: "TX3LPaxmHKxFdv7VOQHJ",
  professional: "CwhRBWXzGAHq8TQ4Fs17",
} as const;

export type ElevenLabsVoice = keyof typeof VOICE_MAP;

export interface ElevenLabsTTSParams {
  text: string;
  voice: ElevenLabsVoice;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

export interface ElevenLabsTTSResult {
  audioUrl: string;
  audioBase64?: string;
  duration?: number;
  voice: string;
}

export async function generateSpeechElevenLabs(
  params: ElevenLabsTTSParams,
  userId?: string,
): Promise<ElevenLabsTTSResult> {
  const apiKey = await getEffectiveProviderKey(
    "elevenlabs",
    process.env.ELEVENLABS_API_KEY,
    userId,
  );

  if (!apiKey) {
    throw new Error(
      "ElevenLabs API key not configured. Add your key in Settings.",
    );
  }

  const voiceId = VOICE_MAP[params.voice];

  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: params.text,
        model_id: params.modelId || "eleven_multilingual_v2",
        voice_settings: {
          stability: params.stability ?? 0.5,
          similarity_boost: params.similarityBoost ?? 0.75,
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  // Response is audio binary
  const audioBuffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString("base64");

  // TODO: Upload to storage and return URL
  // For now, return base64
  return {
    audioUrl: `data:audio/mpeg;base64,${audioBase64}`,
    audioBase64,
    voice: params.voice,
  };
}

export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}
```

**Step 3: Add to Provider Type**

'elevenlabs' should already be in ProviderType. Verify.

**Step 4: Create Voice Selection Routing**

Update the voice selection in RequestForm to route correctly:

```typescript
// When voice is "ElevenLabs - Calm", use elevenlabs provider
// When voice is "Pollinations - Alloy (Free)", use pollinations provider
```

**Step 5: Verification**

- Enter ElevenLabs API key in Settings
- Select ElevenLabs voice in Creative Director
- Generate voiceover
- Verify audio is produced

#### Files Modified

| File                                | Action | Lines Changed       |
| ----------------------------------- | ------ | ------------------- |
| lib/ai/elevenlabs.ts                | Create | ~120 lines          |
| lib/ai/index.ts                     | Modify | +2 lines (export)   |
| components/pipeline/RequestForm.tsx | Modify | +10 lines (routing) |

#### Success Criteria

- [ ] ElevenLabs adapter created
- [ ] All three voices mapped (Calm, Energetic, Professional)
- [ ] User API key from Settings works
- [ ] Audio generation produces valid files
- [ ] Integration with video assembly works

---

## Pillar V: Social Publishing APIs

### Pillar Overview

Implement all social media publishing integrations shown in Settings. These all require OAuth flows and platform-specific APIs.

**Pillar Duration:** 40 hours  
**Dependencies:** User authentication system  
**Note:** These are all HARD or COMPLEX due to OAuth requirements

---

### Task V-1: TikTok Publishing API

**Complexity Level:** 🟠 HARD  
**Agent Configuration:** Planner + Coordinator + 3 Executors + Verifier  
**Estimated Duration:** 8 hours

#### Problem Statement

Settings shows TikTok API key field. Need OAuth flow and video publishing integration.

#### Implementation Overview

1. TikTok for Developers app registration
2. OAuth 2.0 flow implementation
3. Token storage in database
4. Video upload API integration
5. Publish/schedule functionality

[Detailed steps similar to previous tasks]

---

### Task V-2: Instagram/Meta Publishing API

**Complexity Level:** 🟠 HARD  
**Agent Configuration:** Planner + Coordinator + 3 Executors + Verifier  
**Estimated Duration:** 8 hours

#### Implementation Overview

1. Meta Developer app registration
2. Facebook Graph API OAuth flow
3. Instagram Content Publishing API
4. Media container creation and publishing

---

### Task V-3: YouTube Publishing API

**Complexity Level:** 🔴 COMPLEX  
**Agent Configuration:** Full swarm  
**Estimated Duration:** 10 hours

#### Implementation Overview

1. Google Cloud project setup
2. YouTube Data API v3 OAuth
3. Video upload (resumable uploads for large files)
4. Video metadata setting
5. Publish scheduling
6. Thumbnail upload

---

### Task V-4: Twitter/X Publishing API

**Complexity Level:** 🟠 HARD  
**Agent Configuration:** Planner + Coordinator + 3 Executors + Verifier  
**Estimated Duration:** 6 hours

#### Implementation Overview

1. Twitter Developer Portal app registration
2. OAuth 2.0 with PKCE
3. Media upload API v1.1
4. Tweet creation API v2

---

### Task V-5: LinkedIn Publishing API

**Complexity Level:** 🟠 HARD  
**Agent Configuration:** Planner + Coordinator + 3 Executors + Verifier  
**Estimated Duration:** 8 hours

#### Implementation Overview

1. LinkedIn Developer app registration
2. OAuth 2.0 flow with 3-legged auth
3. Video upload API
4. Share creation

---

## Verification Checklist

### Per-Provider Verification

For EACH provider integration, verify:

- [ ] Adapter file created with correct structure
- [ ] TypeScript types are correct (no any)
- [ ] Uses `getEffectiveProviderKey()` for user keys
- [ ] Falls back to environment variable correctly
- [ ] Error messages are clear and actionable
- [ ] Build passes with no type errors
- [ ] Unit tests created (minimum 80% coverage)
- [ ] Integration test with real API (if key available)
- [ ] Console logs for debugging are appropriate
- [ ] Documentation updated if needed

### End-to-End Verification

After ALL pillars complete:

- [ ] Every Settings API key field saves and retrieves correctly
- [ ] Every Creative Director dropdown routes to working backend
- [ ] Every Preferences option is honored
- [ ] Mixed provider workflows work (e.g., Claude script + Veo video + ElevenLabs voice)
- [ ] No "not implemented" errors in production
- [ ] All costs are tracked correctly
- [ ] Analytics capture provider usage

---

## Sequential Thinking Checkpoints

### Mandatory Sequential Thinking Points

Use `mcp_sequential-thinking_sequentialthinking` at these points:

1. **Start of each Task**: Plan approach, identify risks
2. **API Research Phase**: Document findings before coding
3. **After creating adapter**: Verify interface matches requirements
4. **Before testing**: Design test cases
5. **After testing**: Analyze results, identify gaps
6. **On any error**: Root cause analysis before fixing

### Example Usage

```typescript
// At start of Task II-2 (Sora 2):
(await mcp_sequential) -
  thinking_sequentialthinking({
    thought:
      "Starting Sora 2 integration. Need to: 1) Research OpenAI Sora API docs, 2) Understand job creation flow, 3) Implement adapter following existing pattern, 4) Test with real API. Key risk: API may still be in limited preview - need to verify access.",
    thoughtNumber: 1,
    totalThoughts: 10,
    nextThoughtNeeded: true,
  });
```

---

## Appendix: Provider API Reference Links

| Provider       | Documentation URL                                   | Notes                         |
| -------------- | --------------------------------------------------- | ----------------------------- |
| Kimi/Moonshot  | https://platform.moonshot.cn/docs/                  | Chinese, may need translation |
| Sora           | https://platform.openai.com (video section)         | May require waitlist          |
| Gemini Video   | https://cloud.google.com/vertex-ai/docs             | Vertex AI or AI Studio        |
| Runway         | https://docs.runwayml.com/                          | Gen-3 API                     |
| Pika           | https://pika.art/developers                         | Check for API availability    |
| Seedream       | TBD                                                 | Research needed               |
| Stability AI   | https://platform.stability.ai/docs                  | For Stable Diffusion          |
| ElevenLabs     | https://docs.elevenlabs.io/                         | Well documented               |
| TikTok         | https://developers.tiktok.com/                      | Content Posting API           |
| Meta/Instagram | https://developers.facebook.com/docs/instagram-api/ | Graph API                     |
| YouTube        | https://developers.google.com/youtube/v3            | Data API v3                   |
| Twitter/X      | https://developer.twitter.com/en/docs               | API v2                        |
| LinkedIn       | https://learn.microsoft.com/en-us/linkedin/         | Marketing API                 |

---

## Document History

| Version | Date       | Changes          |
| ------- | ---------- | ---------------- |
| 1.0.0   | 2026-01-18 | Initial creation |

---

**END OF PHASE 10 MANIFESTO**
