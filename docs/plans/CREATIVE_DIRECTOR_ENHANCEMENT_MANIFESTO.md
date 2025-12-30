# CREATIVE DIRECTOR ENHANCEMENT MANIFESTO

## Production-Grade Conversation Intelligence & UX

**Document Classification:** L10 SYSTEMS ARCHITECTURE  
**Version:** 1.0.0  
**Status:** APPROVED FOR IMPLEMENTATION  
**Prerequisite:** Phase 6 Part II (Agent Architecture)  
**Target:** Enterprise-grade conversation flow with bulletproof error handling and premium UX

---

## TABLE OF CONTENTS

1. [Executive Summary](#section-1-executive-summary)
2. [Problem Analysis](#section-2-problem-analysis)
3. [Feature Specifications](#section-3-feature-specifications)
4. [Architecture Integration](#section-4-architecture-integration)
5. [Error Handling Matrix](#section-5-error-handling-matrix)
6. [Robustness Patterns](#section-6-robustness-patterns)
7. [UX Specifications](#section-7-ux-specifications)
8. [Implementation Details](#section-8-implementation-details)
9. [Verification Matrix](#section-9-verification-matrix)
10. [File Manifest](#section-10-file-manifest)

---

# SECTION 1: EXECUTIVE SUMMARY

## 1.1 The Problem

| Current Limitation                 | Impact                                 | User Experience         |
| :--------------------------------- | :------------------------------------- | :---------------------- |
| Fixed 3 questions every time       | Ignores brand context already provided | Repetitive, feels dumb  |
| No conversation memory             | Forgets user preferences               | User repeats themselves |
| Message appears after API response | Blank screen for 3-10 seconds          | Feels broken/slow       |
| Generic "Thinking..." spinner      | No progress indication                 | Anxiety, uncertainty    |
| No streaming                       | All text appears at once               | Jarring, unnatural      |
| Single retry on failure            | Request lost on network issues         | Data loss, frustration  |
| No offline handling                | Silent failure                         | Confusion               |

## 1.2 The Vision

> **"A conversation that feels alive, remembers you, and never loses your message."**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENHANCED CREATIVE DIRECTOR                           │
├─────────────────────────────────────────────────────────────────────────────┤
│    User types message                                                       │
│           │                                                                 │
│           ▼                                                                 │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │  OPTIMISTIC UPDATE: Message appears INSTANTLY (<50ms)          │     │
│    │  [User sees their message immediately, marked as "sending"]     │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│           │                                                                 │
│           ▼                                                                 │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │  TYPING INDICATOR                                               │     │
│    │  [●  ●  ●] Creative Director is thinking...                     │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│           │                                                                 │
│           ▼                                                                 │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │  STREAMING RESPONSE                                             │     │
│    │  Text appears word-by-word, feels alive                         │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│           │                                                                 │
│           ▼                                                                 │
│    ┌───────────────────────┐    ┌────────────────────────────────────┐     │
│    │  SMART QUESTIONS      │    │  OR: CONFIRMATION                  │     │
│    │  (Only what's needed) │    │  "Here's what I'll create..."      │     │
│    │  Skips known fields   │    │  [Approve] [Adjust] [Start Over]   │     │
│    └───────────────────────┘    └────────────────────────────────────┘     │
│                                                                             │
│    ════════════════ ERROR RECOVERY LAYER ════════════════                   │
│    • Network timeout → Retry with exponential backoff                       │
│    • Rate limit → Queue and wait                                           │
│    • Offline → Queue locally, sync on reconnect                            │
│    • LLM failure → Fallback model                                          │
│    • Message lost → Rollback optimistic update                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.3 Key Design Decisions

| Decision              | Choice                                 | Rationale                          |
| :-------------------- | :------------------------------------- | :--------------------------------- |
| Optimistic Updates    | Add message to UI before API call      | Instant feedback (<50ms perceived) |
| Streaming             | SSE via OpenRouter native streaming    | Real-time character display        |
| Circuit Breaker       | Trip after 3 failures, 30s cooldown    | Prevent cascading failures         |
| Request Deduplication | First request wins                     | Prevent double-submit              |
| Idempotency Keys      | Cache response for 5 minutes           | Safe retries                       |
| Offline Detection     | Queue requests, sync on reconnect      | No data loss                       |
| Smart Questions       | Use brand context to skip known fields | Fewer questions, smarter UX        |
| Confirmation Step     | Show summary before plan creation      | User control, iteration            |

---

# SECTION 2: PROBLEM ANALYSIS

## 2.1 Current Message Flow

```
User clicks Send
        │
        ▼
┌───────────────────┐
│  setLoading(true) │ ◀─── Screen goes blank/spinner only
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  fetch() API call │ ◀─── 3-10 second wait
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  setMessages()    │ ◀─── FINALLY user sees their message
└───────────────────┘
```

**Problems:**

- User message invisible during API call
- No streaming (full response appears at once)
- Single failure = lost message
- No visual feedback beyond spinner

## 2.2 Enhanced Message Flow

```
User clicks Send
        │
        ├──────────────────────────────────────────────────────┐
        │                                                      │
        ▼                                                      ▼
┌──────────────────────┐                            ┌─────────────────────┐
│ Optimistic Update    │                            │ AbortController     │
│ Add message with     │                            │ Created for cancel  │
│ _pending: true       │                            └─────────────────────┘
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ Show TypingIndicator │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐     ┌─────────────────────────────────────────┐
│ fetchWithRetry()     │────►│ CircuitBreaker.execute()               │
│ with idempotency key │     │ ├─ If circuit open → throw immediately │
└──────────────────────┘     │ ├─ Try request                         │
        │                    │ ├─ On 429 → exponential backoff        │
        │                    │ ├─ On 5xx → retry up to 3x             │
        │                    │ └─ On success → reset failures         │
        │                    └─────────────────────────────────────────┘
        │
        ├─────── SUCCESS ───────┐
        │                       │
        ▼                       ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│ FAILURE:             │    │ Replace optimistic message       │
│ Rollback message     │    │ with confirmed message           │
│ Show toast error     │    │ (_pending: false)                │
└──────────────────────┘    └──────────────────────────────────┘
                                    │
                                    ▼
                        ┌──────────────────────────────────┐
                        │ Stream assistant response        │
                        │ Character by character           │
                        └──────────────────────────────────┘
```

---

# SECTION 3: FEATURE SPECIFICATIONS

## 3.1 Smart Question Skipping

**Logic:**

```typescript
// Check brand context first
if (!intent.content_type) questions.push(...);
if (!intent.platform && !brandContext?.identity?.default_platform) questions.push(...);
if (!intent.target_audience && !brandContext?.identity?.target_audience) questions.push(...);
```

**Expected Outcome:** Brands with complete identity → 0-1 questions instead of 3.

## 3.2 Confirmation Step

**New Action Type:**

```typescript
type ExecutiveAction =
  | { type: 'ask_questions'; ... }
  | { type: 'confirm_plan'; summary: string; parsedIntent: Partial<ParsedIntent>; }
  | { type: 'create_plan'; ... };
```

## 3.3 User Preferences Memory

**New Table:**

```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  default_platform TEXT,
  default_tone TEXT,
  default_content_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, brand_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);
```

---

# SECTION 4: ARCHITECTURE INTEGRATION

## 4.1 Existing Patterns to Follow

| Layer          | Existing Pattern                          | New Feature Integration                               |
| :------------- | :---------------------------------------- | :---------------------------------------------------- |
| **Hooks**      | `useChatContext`, `useApiKeys`            | Add `useConnectionStatus`                             |
| **Redis**      | `getCached*()`, `setCached*()`            | Add `getCachedConfirmation`, `getIdempotencyResponse` |
| **Supabase**   | `createSession`, `updateSession`          | Add `getUserPreferences`, `updateUserPreferences`     |
| **LLM**        | `LLMService.generateCompletion()`         | Add `LLMService.streamCompletion()`                   |
| **Agents**     | `ExecutiveAgent.processMessage()`         | Add `generateConfirmation()`                          |
| **Types**      | Union types in `lib/agents/types.ts`      | Extend `ExecutiveAction`                              |
| **Components** | `MessageBubble`, `QuestionForm`           | Add `TypingIndicator`, `MessageSkeleton`              |
| **CSS**        | `lamaPurple`, `slate-*`, `animate-bounce` | Reuse existing tokens only                            |

---

# SECTION 5: ERROR HANDLING MATRIX

## 5.1 Network Layer (5 scenarios)

| Error                 | Detection                | Recovery                       | User Feedback      |
| :-------------------- | :----------------------- | :----------------------------- | :----------------- |
| Timeout (>30s)        | `AbortController.signal` | Retry once with double timeout | "Taking longer..." |
| Disconnect mid-stream | `reader.read()` throws   | Reconnect, resume              | "Reconnecting..."  |
| DNS failure           | `fetch` rejects          | Queue request                  | "You're offline"   |
| SSL error             | `fetch` rejects          | Log, don't retry               | "Security issue"   |
| CORS blocked          | `fetch` rejects          | Log                            | Shouldn't happen   |

## 5.2 LLM Provider (4 scenarios)

| Error              | Detection          | Recovery          | User Feedback         |
| :----------------- | :----------------- | :---------------- | :-------------------- |
| Rate limit (429)   | Status code        | Backoff: 1s→2s→4s | "Lots of traffic..."  |
| Invalid key (401)  | Status code        | Prompt Settings   | "Check API key"       |
| Model unavailable  | Status 503         | Fallback model    | Silent                |
| Malformed response | `JSON.parse` fails | Retry             | "Let me try again..." |

## 5.3 Data Layer (3 scenarios)

| Error            | Detection            | Recovery     | User Feedback       |
| :--------------- | :------------------- | :----------- | :------------------ |
| Redis lost       | `redis.get()` throws | Use Postgres | Silent (slower)     |
| Postgres timeout | Query >5s            | Return stale | "Using cached data" |
| Session expired  | State check          | New session  | "Starting fresh..." |

## 5.4 Auth Layer (2 scenarios)

| Error          | Detection     | Recovery        | User Feedback    |
| :------------- | :------------ | :-------------- | :--------------- |
| Token expired  | 401 response  | Refresh + retry | Silent           |
| Refresh failed | Refresh fails | Redirect login  | "Please sign in" |

## 5.5 Client State (1 scenario)

| Error   | Detection               | Recovery          |
| :------ | :---------------------- | :---------------- |
| Unmount | AbortController aborted | Cancel, no update |

---

# SECTION 6: ROBUSTNESS PATTERNS

## 6.1 Circuit Breaker

```typescript
class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failures = 0;
  private readonly threshold = 3;
  private readonly cooldown = 30000;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailure > this.cooldown) {
        this.state = "half-open";
      } else {
        throw new Error("Circuit open");
      }
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

## 6.2 Request Deduplication

```typescript
const pendingRequests = new Map<string, Promise<unknown>>();

export async function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }
  const promise = fn().finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, promise);
  return promise;
}
```

## 6.3 Idempotency Keys

```typescript
// API route checks header
const idempotencyKey = request.headers.get("x-idempotency-key");
if (idempotencyKey) {
  const cached = await getIdempotencyResponse(idempotencyKey);
  if (cached) return NextResponse.json(cached);
}
```

## 6.4 Exponential Backoff

```typescript
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    await sleep(1000 * Math.pow(2, attempt));
  }
}
```

## 6.5 Request Cancellation

```typescript
useEffect(() => {
  return () => abortControllerRef.current?.abort();
}, []);
```

## 6.6 Offline Detection

```typescript
export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));
  }, []);
  return { isOnline };
}
```

---

# SECTION 7: UX SPECIFICATIONS

## 7.1 Timing Targets

| Action               | Target |
| :------------------- | :----- |
| User message visible | <50ms  |
| Typing indicator     | <100ms |
| First streaming char | <500ms |
| Error toast          | <100ms |
| Rollback             | <50ms  |

## 7.2 Visual States

| State     | Visual                              |
| :-------- | :---------------------------------- |
| Pending   | 70% opacity, dashed border, spinner |
| Confirmed | Full opacity                        |
| Failed    | Red border, "Retry" button          |
| Streaming | Cursor at end                       |

---

# SECTION 8: IMPLEMENTATION DETAILS

## 8.1 Type Definitions

```typescript
export type ExecutiveAction =
  | {
      type: "ask_questions";
      questions: ClarifyingQuestion[];
      parsedIntent: Partial<ParsedIntent>;
    }
  | {
      type: "confirm_plan";
      summary: string;
      parsedIntent: Partial<ParsedIntent>;
    }
  | { type: "create_plan"; parsedIntent: Partial<ParsedIntent> };

export interface ConfirmationState {
  summary: string;
  parsedIntent: Partial<ParsedIntent>;
}

export interface ConversationMessage {
  // existing...
  _pending?: boolean;
}
```

---

# SECTION 9: VERIFICATION MATRIX

| Scenario        | Test Method                      |
| :-------------- | :------------------------------- |
| Network timeout | DevTools → Offline after request |
| Rate limiting   | Burst 20 requests                |
| Double-click    | Click rapidly                    |
| Circuit trips   | Fail 3 requests                  |
| Redis failure   | Stop Redis                       |
| Offline queue   | Offline → send → online          |

---

# SECTION 10: FILE MANIFEST

## New Files (6)

| File                                       | Purpose                 |
| :----------------------------------------- | :---------------------- |
| `lib/utils/circuit-breaker.ts`             | Circuit breaker pattern |
| `lib/utils/request-dedup.ts`               | Request deduplication   |
| `lib/utils/fetch-with-retry.ts`            | Retry with backoff      |
| `lib/hooks/use-connection-status.ts`       | Offline detection       |
| `components/director/typing-indicator.tsx` | Typing indicator        |
| `components/director/message-skeleton.tsx` | Skeleton state          |

## Modified Files (8)

| File                                     | Changes                             |
| :--------------------------------------- | :---------------------------------- |
| `lib/agents/types.ts`                    | Add `_pending`, `ConfirmationState` |
| `lib/agents/executive.ts`                | Add `generateConfirmation`          |
| `lib/redis/client.ts`                    | Add keys                            |
| `lib/redis/session-cache.ts`             | Add confirmation + idempotency      |
| `lib/conversation/queries.ts`            | Add preferences queries             |
| `lib/llm/service.ts`                     | Add `streamCompletion`              |
| `lib/llm/adapters/openrouter.ts`         | Add `streamCompletion`              |
| `components/director/chat-interface.tsx` | Full overhaul                       |

## Summary

- **New files:** 6
- **Modified files:** 8
- **New DB tables:** 1
- **Error scenarios:** 15
- **UX improvements:** 7

---

# APPENDIX: GRACEFUL DEGRADATION

| Feature         | Fallback                    |
| :-------------- | :-------------------------- |
| Redis           | Use Postgres                |
| Streaming       | Yield entire response       |
| Preferences     | Ask all questions           |
| Confirmation    | Fall through to create_plan |
| Circuit breaker | Reset to closed             |

---

**END OF MANIFESTO**
