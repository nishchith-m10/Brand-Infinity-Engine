# Request Data Flow Documentation

## Overview
This document traces how user input (script, prompt, context) flows from the RequestForm through to actual content generation.

## ✅ Fixed Issues

### 1. Campaign Dropdown Now Shows Real Campaigns
**Before:** Hardcoded "Campaign 1" and "Campaign 2"  
**After:** Dynamically fetches and displays actual campaigns from database (e.g., "Early Bloom")

**Changes Made:**
- Added `useCampaigns()` hook to [RequestForm.tsx](../components/pipeline/RequestForm.tsx)
- Replaced hardcoded options with dynamic campaign mapping
- Added loading state handling

```typescript
// Now fetches real campaigns
const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns();
const campaigns = Array.isArray(campaignsData) ? campaignsData : campaignsData?.data || [];
const activeCampaigns = campaigns.filter(c => !c.deleted_at && !['archived', 'pending_deletion'].includes(c.status));

// Dropdown now shows real campaign names
{activeCampaigns.map(c => (
  <option key={c.id} value={c.id}>{c.campaign_name}</option>
))}
```

## Data Flow Verification: Script & Context DO Get Used ✅

### Step 1: Form Submission
**File:** [components/pipeline/RequestForm.tsx](../components/pipeline/RequestForm.tsx) (Lines 110-160)

User enters:
- `prompt` - Creative brief/requirements
- `scriptText` - Custom script (if `autoScript` is false)
- `selectedKBIds` - Knowledge base IDs for context
- `campaign` - Selected campaign ID

```typescript
const response = await fetch('/api/v1/requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brand_id: brands.id,
    campaign_id: campaign || undefined, // ✅ Now uses real campaign ID
    title: title || 'Untitled Request',
    type: type.replace('-', '_'),
    requirements: {
      prompt, // ✅ User's creative prompt
      duration: type === 'image' ? undefined : duration,
      aspect_ratio: aspectRatio.split(' ')[0],
      style_preset: style,
      shot_type: shotType,
      voice_id: type === 'video-with-vo' ? voice : undefined,
    },
    settings: {
      provider,
      tier: 'standard',
      auto_script: autoScript, // ✅ Whether AI generates script
      script_text: !autoScript ? scriptText : undefined, // ✅ Custom script
      selected_kb_ids: selectedKBIds, // ✅ Context from knowledge bases
      budget,
    }
  }),
});
```

### Step 2: API Endpoint Saves to Database
**File:** [app/api/v1/requests/route.ts](../app/api/v1/requests/route.ts) (Lines 100-200)

API validates and saves all fields:

```typescript
// Validation schema (Lines 26-45)
const schema = z.object({
  brand_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional(),
  requirements: z.object({
    prompt: z.string().min(10).max(5000), // ✅ Validates prompt
  }),
  settings: z.object({
    auto_script: z.boolean().optional(),
    script_text: z.string().max(10000).optional(), // ✅ Validates script
    selected_kb_ids: z.array(z.string().uuid()).optional(), // ✅ Validates KB IDs
  }).optional(),
});

// Database insertion (Lines 116, 129-131)
const { data: contentRequest } = await supabase
  .from('content_requests')
  .insert({
    brand_id: input.brand_id,
    campaign_id: input.campaign_id,
    prompt: input.requirements.prompt, // ✅ Saved to DB
    script_text: input.settings?.script_text || null, // ✅ Saved to DB
    selected_kb_ids: input.settings?.selected_kb_ids || [], // ✅ Saved to DB
    auto_script: input.settings?.auto_script ?? true,
    // ... other fields
  });

// Trigger orchestrator (Line 168)
requestOrchestrator.processRequest(contentRequest.id);
```

### Step 3: Orchestrator Loads Request Data
**File:** [lib/orchestrator/RequestOrchestrator.ts](../lib/orchestrator/RequestOrchestrator.ts) (Lines 354-365)

Orchestrator loads the full request including prompt and script:

```typescript
async processRequest(requestId: string) {
  const request = await this.loadRequest(requestId); // ✅ Loads all fields from DB
  await this.dispatchToHandler(request);
  await this.checkAndAdvanceStatus(request);
}

private async loadRequest(requestId: string): Promise<ContentRequest> {
  const { data, error } = await supabase
    .from('content_requests')
    .select('*') // ✅ Includes prompt, script_text, selected_kb_ids
    .eq('id', requestId)
    .single();
  
  return data;
}
```

### Step 4: TaskFactory Passes Data to Tasks
**File:** [lib/orchestrator/TaskFactory.ts](../lib/orchestrator/TaskFactory.ts) (Lines 280-360)

Each task receives the relevant data:

```typescript
private buildInitialInputData(
  request: ContentRequest,
  template: TaskTemplate
): Record<string, unknown> {
  const baseInput = {
    request_id: request.id,
    request_type: request.request_type,
    brand_id: request.brand_id,
    campaign_id: request.campaign_id,
    prompt: request.prompt, // ✅ Passed to all tasks
    selected_kb_ids: request.selected_kb_ids, // ✅ Context for RAG
  };

  switch (template.agent_role) {
    case 'strategist':
      return {
        ...baseInput, // ✅ Gets prompt + KB IDs for brief generation
        duration_seconds: request.duration_seconds,
        style_preset: request.style_preset,
        aspect_ratio: request.aspect_ratio,
      };

    case 'copywriter':
      return {
        ...baseInput, // ✅ Gets prompt + KB IDs for context
        duration_seconds: request.duration_seconds,
        voice_id: request.voice_id,
        auto_script: request.auto_script,
        script_text: request.script_text, // ✅ Custom script if provided
      };

    case 'producer':
      return {
        ...baseInput, // ✅ Gets all context for generation
        duration_seconds: request.duration_seconds,
        aspect_ratio: request.aspect_ratio,
        shot_type: request.shot_type,
        preferred_provider: request.preferred_provider,
        provider_tier: request.provider_tier,
      };
  }
}
```

### Step 5: n8n Workflows Receive Data
**File:** [lib/n8n/client.ts](../lib/n8n/client.ts) (Lines 340-430)

When tasks trigger n8n workflows, all data is sent:

```typescript
async triggerWorkflow(
  webhookPath: string,
  data: Record<string, unknown>, // ✅ Includes prompt, script, KB IDs
  options?: {
    idempotencyKey?: string;
    timeout?: number;
    retries?: number;
  }
): Promise<{ success: boolean; execution_id?: string; error?: string }> {
  const response = await fetch(workflowUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      data, // ✅ All task input data sent to n8n
      timestamp: new Date().toISOString(),
    }),
  });
}
```

**Available n8n webhooks:**
```typescript
export const N8N_WEBHOOKS = {
  STRATEGIST_CAMPAIGN: '/strategist', // Uses prompt + KB IDs
  STRATEGIST_BRIEF: '/strategist', 
  COPYWRITER_SCRIPT: '/copywriter', // Uses prompt + script_text + KB IDs
  PRODUCTION_DISPATCH: '/production/dispatch', // Uses all specs
  PRODUCTION_ASSEMBLE: '/production/assemble',
  PRODUCTION_DOWNLOAD: '/production/download',
  BROADCASTER_PUBLISH: '/broadcast',
  APPROVAL_HANDLE: '/campaign/approve',
  REVIEW_CONTENT: '/campaign/verify',
} as const;
```

## Data Flow Summary

```
User Input (RequestForm)
    ↓ POST /api/v1/requests
    ↓
Database (content_requests table)
    ├─ campaign_id (UUID)
    ├─ prompt (text)
    ├─ script_text (text)
    ├─ selected_kb_ids (uuid[])
    └─ auto_script (boolean)
    ↓
RequestOrchestrator.processRequest()
    ↓ loadRequest() - fetches ALL fields
    ↓
TaskFactory.buildInitialInputData()
    ├─ strategist task → { prompt, selected_kb_ids }
    ├─ copywriter task → { prompt, script_text, selected_kb_ids }
    └─ producer task → { prompt, all specs }
    ↓
n8nClient.triggerWorkflow(data)
    ├─ /strategist → receives prompt + KB IDs
    ├─ /copywriter → receives script_text + context
    └─ /production/dispatch → receives all data
    ↓
n8n Workflows Execute
    ├─ RAG: Queries selected_kb_ids for context
    ├─ Brief: Uses prompt to generate creative brief
    ├─ Script: Uses custom script_text OR generates from prompt
    └─ Generation: Uses script + visual specs
    ↓
Content Generated ✅
```

## Key Findings

✅ **Campaign ID:** Now properly uses real campaign UUID (e.g., "Early Bloom" campaign)  
✅ **Prompt:** Flows from form → API → DB → tasks → n8n workflows  
✅ **Script:** Custom script_text saved and used when auto_script=false  
✅ **Context:** selected_kb_ids passed to all tasks for RAG retrieval  
✅ **Security:** n8n callbacks verified with HMAC signature validation

## Testing the Flow

To verify the complete flow works:

1. **Create request with real campaign:**
   ```bash
   # RequestForm now shows "Early Bloom" in dropdown
   # Select it and fill in:
   - Prompt: "30s product demo, upbeat, Gen Z tone..."
   - Auto-generate script: OFF
   - Custom script: "Welcome to our amazing product..."
   - Knowledge bases: Select relevant context
   ```

2. **Verify database:**
   ```sql
   SELECT 
     id, 
     campaign_id, 
     prompt, 
     script_text, 
     selected_kb_ids,
     auto_script
   FROM content_requests 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

3. **Check task creation:**
   ```sql
   SELECT 
     agent_role, 
     status, 
     input_data->'prompt' as prompt,
     input_data->'script_text' as script,
     input_data->'selected_kb_ids' as kb_ids
   FROM request_tasks
   WHERE request_id = '<your-request-id>'
   ORDER BY created_at;
   ```

4. **Monitor n8n execution:**
   - Check n8n UI for workflow executions
   - Verify webhook payloads contain prompt/script/KB IDs
   - Confirm generation uses custom script (not AI-generated)

## Related Files

- [RequestForm.tsx](../components/pipeline/RequestForm.tsx) - Form UI with campaign dropdown
- [app/api/v1/requests/route.ts](../app/api/v1/requests/route.ts) - API endpoint
- [RequestOrchestrator.ts](../lib/orchestrator/RequestOrchestrator.ts) - Orchestration logic
- [TaskFactory.ts](../lib/orchestrator/TaskFactory.ts) - Task creation with data mapping
- [n8n/client.ts](../lib/n8n/client.ts) - Workflow triggers
- [app/api/v1/callbacks/n8n/route.ts](../app/api/v1/callbacks/n8n/route.ts) - n8n callback handler

## Architecture Diagrams

See [README.md](../README.md) for visual diagrams of the complete system architecture.
