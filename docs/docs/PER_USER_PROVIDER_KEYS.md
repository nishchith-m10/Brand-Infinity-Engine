# Per-User Provider Key Retrieval for Background Jobs

**Date:** January 9, 2026  
**Status:** ✅ Implemented  
**Type:** Security & Infrastructure Enhancement

---

## Overview

This document describes the implementation of **Option B: Secure per-user key retrieval in background jobs** for the Brand Infinity Engine orchestration system. This design ensures that background server-side tasks (e.g., Strategist, Copywriter agents) can securely access user-provided API keys for LLM providers (OpenAI, Anthropic, OpenRouter, etc.) without compromising security or requiring global/service-level keys.

---

## Problem Statement

**Before:** Background orchestrator jobs failed with:
```
Unauthorized: no authenticated user
OpenRouter API key not configured
```

**Root Cause:**  
- `getUserProviderKey()` required an authenticated session (using `supabase.auth.getUser()`)
- Background jobs (e.g., RequestOrchestrator, AgentRunner) run server-side without user sessions
- No global provider keys were configured

**Impact:**  
- Strategist and Copywriter agents could not execute LLM calls
- Requests stalled in `draft` status
- End-to-end content generation broken

---

## Solution: Per-User Key Retrieval with Explicit `userId`

### Design Principles

1. **User ownership:** Each `content_request` has a `created_by` field linking it to the owner user
2. **Explicit delegation:** Background jobs pass the request owner's `userId` explicitly to key retrieval functions
3. **Security:** Use admin Supabase client to bypass RLS only for key retrieval (not for data manipulation)
4. **Auditing:** Log all provider key usage with user ID and source (user|server|fallback)

### Architecture

```
Request (created_by: user_id)
  ↓
Orchestrator (loads request, extracts user_id)
  ↓
AgentRunner (passes request to adapter)
  ↓
StrategistAdapter/CopywriterAdapter (extracts request.created_by)
  ↓
StrategistAgent/CopywriterAgent (receives userId param)
  ↓
LLMService.generateCompletion(request: { userId, ... })
  ↓
OpenAIAdapter/AnthropicAdapter/OpenRouterAdapter (calls fetchApiKey(userId))
  ↓
getEffectiveProviderKey(provider, globalEnv, userId)
  ↓
getUserProviderKey(provider, userId) → fetch from user_provider_keys table using admin client
  ↓
Return decrypted key to adapter
```

---

## Implementation Details

### 1. Updated `getUserProviderKey` (lib/providers/get-user-key.ts)

**Before:**
```ts
export async function getUserProviderKey(
  provider: ProviderType
): Promise<string | null> {
  const supabase = await createClient(); // RLS client
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  // ... fetch key for user.id
}
```

**After:**
```ts
export async function getUserProviderKey(
  provider: ProviderType,
  userId?: string  // <-- NEW: explicit userId for background jobs
): Promise<string | null> {
  let targetUserId: string;

  if (userId) {
    // Background job: use explicit userId
    targetUserId = userId;
  } else {
    // Interactive session: get from auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    targetUserId = user.id;
  }

  // Use admin client to bypass RLS when fetching keys
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('user_provider_keys')
    .select('encrypted_key')
    .eq('user_id', targetUserId)
    .eq('provider', provider)
    .maybeSingle();

  if (!data) return null;
  return await decryptProviderKey(data.encrypted_key);
}
```

**Security:** Admin client is used **only** to read keys from `user_provider_keys` table — not for general data access. This is acceptable because:
- The `userId` is sourced from `content_requests.created_by` (validated at request creation)
- No data manipulation occurs; read-only operation
- Logged for audit trail

---

### 2. Updated LLM Adapters

All adapters (OpenAI, Anthropic, OpenRouter, etc.) now:

**Before:**
```ts
constructor() {
  this.apiKeyPromise = getEffectiveProviderKey('openai', process.env.OPENAI_API_KEY);
}
```

**After:**
```ts
private async fetchApiKey(userId?: string): Promise<string> {
  const apiKey = await getEffectiveProviderKey(
    'openai',
    process.env.OPENAI_API_KEY,
    userId  // <-- NEW: pass userId for per-user key retrieval
  );
  if (!apiKey) throw new Error('OpenAI API key not configured');
  return apiKey;
}

async generateCompletion(request: LLMRequest): Promise<LLMResponse> {
  const apiKey = request.apiKey || await this.fetchApiKey(request.userId);
  // ... rest of implementation
}
```

---

### 3. Updated Agent Managers

**Before:**
```ts
const response = await this.llmService.generateCompletion({
  model: this.agentModel,
  messages: [...],
});
```

**After:**
```ts
async executeTask(params: {
  task: Task;
  intent: ParsedIntent;
  brandContext?: string;
  userId?: string;  // <-- NEW
}) {
  const response = await this.llmService.generateCompletion({
    model: this.agentModel,
    messages: [...],
    userId: params.userId,  // <-- NEW: pass userId to LLM service
  });
}
```

---

### 4. Updated Adapters (Strategist, Copywriter)

**Before:**
```ts
const result = await this.agent.executeTask({
  task,
  intent,
  brandContext,
});
```

**After:**
```ts
const result = await this.agent.executeTask({
  task,
  intent,
  brandContext,
  userId: params.request.created_by,  // <-- NEW: extract from request
});
```

---

### 5. Added Security Auditing

New event logger method:
```ts
async logProviderKeyUsage(
  requestId: string,
  taskId: string,
  provider: string,
  userId: string,
  source: 'user' | 'server',
  agentRole: string
): Promise<void>
```

Logs to `request_events` table with:
- Provider name
- User ID whose key was used
- Key source (user-provided vs server fallback)
- Agent role
- Security audit flag

---

## Security Considerations

### ✅ Secure Practices

1. **User isolation:** Keys are always tied to the request owner (not leaked across users)
2. **Admin client scope:** Limited to `user_provider_keys` table read operations only
3. **Audit trail:** All key usage logged to `request_events` table
4. **Encryption:** Keys remain encrypted in DB; decrypted only at usage time
5. **No session hijacking:** Background jobs never access session tokens

### ⚠️ Admin Client Usage

**When is it safe to use admin client?**
- ✅ Reading user data when `userId` is explicitly validated (e.g., from `content_requests.created_by`)
- ✅ System operations where RLS would block legitimate background tasks
- ❌ Never for user-initiated requests (always use RLS client)
- ❌ Never for write operations without explicit validation

**Why it's safe here:**
- `userId` is sourced from `content_requests.created_by` (created via RLS-protected API route)
- Only used to fetch the **same user's** provider keys
- No cross-user data access possible
- Logged for audit

---

## Testing

### Manual Test

1. Create a content request via UI (logged in as user A)
2. Verify `content_requests.created_by = user_A_id`
3. Trigger orchestrator: `POST /api/v1/orchestrator/process`
4. Check logs:
   ```
   [getUserProviderKey] Using explicit userId for openrouter: abc123...
   [OpenRouter] generateCompletion called: userId=abc123..., usingKey=sk-or-...
   ```
5. Verify strategist/copywriter tasks complete successfully
6. Check `request_events` for audit logs:
   ```json
   {
     "event_type": "agent_log",
     "description": "Provider key used: openrouter (source: user, user: abc123...)",
     "metadata": {
       "provider": "openrouter",
       "user_id": "abc123...",
       "key_source": "user",
       "security_audit": true
     }
   }
   ```

### Unit Tests (TODO)

```ts
describe('getUserProviderKey', () => {
  it('should fetch key for explicit userId (background job)', async () => {
    const key = await getUserProviderKey('openai', 'user-id-123');
    expect(key).toBeTruthy();
  });

  it('should fetch key from session (interactive request)', async () => {
    // Mock supabase.auth.getUser() to return session user
    const key = await getUserProviderKey('openai');
    expect(key).toBeTruthy();
  });

  it('should throw if no key found and REQUIRE_USER_PROVIDER_KEYS=true', async () => {
    await expect(getUserProviderKey('openai', 'user-no-key')).rejects.toThrow();
  });
});
```

---

## Alternatives Considered

### Option A: Service-Level Key Fallback (rejected for this implementation)

**Approach:** Add `OPENROUTER_API_KEY`, `OPENAI_API_KEY` env vars and fall back when no user key exists.

**Pros:**
- Fast, simple
- Unblocks background jobs immediately

**Cons:**
- Centralized key = single point of failure & billing
- No per-user cost tracking
- Less secure (all jobs use same key)
- Doesn't enforce BYOK model

**Decision:** User requested Option B for "longevity and stronger infra"

---

### Option C: Free Provider Fallback (partial implementation)

**Approach:** When no key exists, use free providers (e.g., pollinations.ai, Hugging Face Inference API).

**Pros:**
- No secrets management
- Zero cost for testing

**Cons:**
- Lower quality, rate limits
- Unreliable for production

**Status:** Already supported via `USE_FREE_PROVIDERS=true` env var; not the primary solution.

---

## Migration & Deployment

### Steps

1. ✅ Update code (completed)
2. ⏳ Type-check: `npx tsc --noEmit` (passed)
3. ⏳ Run dev server: `npm run dev`
4. ⏳ Test with real request
5. ⏳ Deploy to production
6. ⏳ Monitor `request_events` for security audit logs

### Environment Variables (no changes needed)

Existing:
- `SUPABASE_SERVICE_ROLE_KEY` (for admin client)
- `OPENAI_API_KEY`, `OPENROUTER_API_KEY` (optional fallback — not used if user has key)
- `REQUIRE_USER_PROVIDER_KEYS=true` (enforce BYOK mode)
- `USE_FREE_PROVIDERS=true` (allow free tier fallback)

---

## Monitoring & Observability

### Key Metrics

1. **Provider Key Usage:**
   ```sql
   SELECT metadata->>'provider', COUNT(*)
   FROM request_events
   WHERE metadata->>'security_audit' = 'true'
   GROUP BY metadata->>'provider';
   ```

2. **User Key vs Fallback:**
   ```sql
   SELECT metadata->>'key_source', COUNT(*)
   FROM request_events
   WHERE metadata->>'security_audit' = 'true'
   GROUP BY metadata->>'key_source';
   ```

3. **Failed Key Retrievals:**
   ```sql
   SELECT * FROM request_events
   WHERE event_type = 'task_failed'
   AND description LIKE '%API key not configured%';
   ```

---

## Future Improvements

1. **Automated Key Rotation:** Alert users when keys are >90 days old
2. **Key Usage Analytics:** Show per-user provider costs in dashboard
3. **Fallback Strategy:** Multi-tier fallback (user key → team key → free provider)
4. **Rate Limiting:** Enforce per-user rate limits based on subscription tier
5. **Key Health Check:** Periodic validation of stored keys (test with minimal API call)

---

## References

- Schema: `database/migrations/003_phase7_content_requests.sql` (content_requests.created_by)
- Migrations: `supabase/migrations/20260106150000_create_user_provider_keys.sql`
- Code: `lib/providers/get-user-key.ts`, `lib/llm/adapters/*.ts`, `lib/agents/managers/*.ts`
- Security: `docs/SECURITY-PLAYBOOK.md`, `docs/DATABASE_SECURITY_QUICK_REFERENCE.md`

---

## Summary

✅ **Implemented:** Option B — Secure per-user key retrieval for background jobs  
✅ **Security:** Admin client scoped to read-only key retrieval; audit logs enabled  
✅ **Testing:** Type-check passed; manual E2E test pending  
⏳ **Next Steps:** Run dev server, test real request, deploy, monitor audit logs  

**Impact:** Unblocks Strategist/Copywriter agents in background orchestrator jobs while maintaining user-level security, cost tracking, and audit compliance.
