# PHASE 4 IMPLEMENTATION BIBLE

## Brand Infinity Engine: The Complete Orchestration Manual

**Document Classification:** L10 SYSTEMS ARCHITECTURE  
**Version:** 1.0.0 (Unified Edition)  
**Status:** APPROVED FOR IMPLEMENTATION  
**Target:** 3,000+ Lines | Complete Specification

---

## TABLE OF CONTENTS

1. [Executive Summary & Mission Criticality](#section-1-executive-summary--mission-criticality)
2. [The 15-Dimension Engineering Matrix](#section-2-the-15-dimension-engineering-matrix)
3. [Pillar 1: The Strategist (Parallel Intelligence)](#section-3-pillar-1-the-strategist)
4. [Pillar 2: The Copywriter (Self-Healing Scripts)](#section-4-pillar-2-the-copywriter)
5. [Pillar 3: The Production House (Async State Management)](#section-5-pillar-3-the-production-house)
6. [Pillar 4: The Campaign Manager (Asset Verification)](#section-6-pillar-4-the-campaign-manager)
7. [Pillar 5: The Broadcaster (Safety-First Distribution)](#section-7-pillar-5-the-broadcaster)
8. [Database Schema Specifications](#section-8-database-schema-specifications)
9. [API Contract Definitions](#section-9-api-contract-definitions)
10. [Failure Matrix & Auto-Response Protocols](#section-10-failure-matrix--auto-response-protocols)
11. [Prompt Engineering Library](#section-11-prompt-engineering-library)
12. [Operational Runbooks](#section-12-operational-runbooks)
13. [Data Governance & Compliance](#section-13-data-governance--compliance)
14. [Implementation Roadmap](#section-14-implementation-roadmap)

---

# SECTION 1: EXECUTIVE SUMMARY & MISSION CRITICALITY

## 1.1 The "Nervous System" Philosophy

We are not building "automation workflows." We are engineering the **central nervous system** for the Brand Infinity Engine. This system must possess biological properties that distinguish it from simple scripted automation:

### Homeostasis (Self-Regulation)

The ability to maintain stable internal conditions despite external fluctuations. When the infrastructure experiences stress (high error rates, API failures, cost spikes), the orchestration layer must automatically initiate protective protocols without human intervention.

**Implementation Manifestation:**

- Circuit breakers trip automatically when consecutive failures reach threshold
- Cost gates halt processing when budget boundaries are exceeded
- Queue depths trigger throttling before system saturation

### Proprioception (Self-Awareness)

The system must "know" where every campaign exists in its lifecycle without querying external services. State is owned internally, reconstructible entirely from our database. A campaign should never be "lost" in the ether of a failed HTTP request.

**Implementation Manifestation:**

- Every state transition persisted to Postgres before external action
- Job polling patterns that survive n8n restarts
- Audit trails that enable full state reconstruction

### Neuroplasticity (Adaptive Routing)

The ability to reroute around damaged pathways to achieve the same result via alternative routes. When the primary video generation API fails, the system routes to alternatives without human intervention.

**Implementation Manifestation:**

- Multi-provider fallback chains for every external dependency
- Evergreen content banks for when trend sources fail
- Cached model responses for when LLM providers are unavailable

---

## 1.2 Anti-Fragility as a Technical Requirement

The system must not merely survive chaos—it must improve from it.

| System Type      | Behavior Under Stress                      |
| ---------------- | ------------------------------------------ |
| **Fragile**      | Breaks when stressed                       |
| **Robust**       | Resists stress, returns to baseline        |
| **Anti-Fragile** | Improves with stress, learns from failures |

### Anti-Fragility Mechanisms:

**Trend Source Trust Scoring:**
If a trend source becomes noisy (high volatility, low signal), the system automatically downgrade its trust score and upweights alternative sources. This is not manual configuration—the system learns to ignore noise through automated scoring adjustments.

**Template Evolution:**
If a script template consistently yields low engagement, the system treats that template as a "pathogen" and quarantines it, evolving new templates based on the survivors. Poor-performing patterns are not just ignored—they are actively excluded from future generation.

**Provider Performance Tracking:**
When a video generation provider experiences degraded quality or increased failure rates, routing weights shift automatically toward higher-performing alternatives, even within the same budget tier.

---

## 1.3 The L10 Interface Contract

This architecture enforces strict contracts between system layers:

### Contract 1: No "Fire and Forget"

Every request is a transaction. It must be acknowledged, tracked, and finalized. There is no state where a request has been received but not recorded. The moment a webhook arrives, a database record exists.

### Contract 2: No "Happy Path" Coding

80% of workflow logic is dedicated to error handling, fallback, and recovery. 20% is business logic. We design for the storm, not the calm. Every node in the workflow has an error branch that is as well-designed as the success branch.

### Contract 3: Zero Invisible State

If it's not in the database, it didn't happen. n8n execution memory is ephemeral and untrusted. If n8n crashes mid-execution, we must be able to reconstruct the complete state of the world from Postgres alone. No critical state lives only in workflow variables.

### Contract 4: Atomic Operations Only

State changes occur atomically or not at all. There is no intermediate state where a campaign is "partially updated." Either the entire state transition completes, or no change is recorded.

### Contract 5: Deterministic Idempotency

Every operation that costs money or produces side effects carries an idempotency key. Duplicate deliveries, retries, and replays produce the same result as single execution. The system is safe to retry at any point.

---

## 1.4 Architectural Tenets

These five tenets govern every implementation decision:

### Tenet 1: Never Trust, Always Verify

Database records are not trusted without verification. External API responses are validated before processing. File existence is confirmed with raw HTTP HEAD requests before marking assets as ready. The orchestration layer assumes everything lies until proven truthful.

### Tenet 2: Fail Gracefully, Recover Intelligently

No workflow terminates with a bare "Error" status. Every failure path has a fallback chain:

- Primary API fails → Try secondary API
- Secondary API fails → Use cached response
- Cache empty → Queue for human intervention
- Queue full → Alert operations and pause gracefully

### Tenet 3: Measure Everything, Optimize Relentlessly

Every LLM call logs tokens to the cost ledger immediately upon response. Every API call tracks latency and success rates. Every workflow execution records duration and resource consumption. This data feeds optimization algorithms and cost projections.

### Tenet 4: Atomic Operations, Consistent State

State changes occur atomically within database transactions. Postgres UPDATE...RETURNING patterns lock rows during verification. Idempotency keys prevent duplicate processing. Distributed locks coordinate access to shared resources across concurrent workflows.

### Tenet 5: Human Oversight at Critical Junctures

Automation handles volume; humans handle exceptions. Hallucination gates divert low-confidence outputs to human review. Emergency kill switches allow instant abort of running workflows. Approval queues ensure quality before distribution. The robot serves the human.

---

# SECTION 2: THE 15-DIMENSION ENGINEERING MATRIX

This matrix is the constitutional law of the Brand Infinity Engine. Every workflow, every node, every line of code must satisfy these fifteen dimensions. Violation is not merely discouraged—it is architectural failure.

---

## Dimension 1: Data Flow Discipline

**Rule:** Client → API → n8n → Supabase. No shortcuts.

**Rationale:**
The client application (Next.js/React) is an unreliable narrator. It runs on unstable mobile networks, closing browser tabs, interrupted connections. It cannot be trusted to orchestrate state or guarantee delivery.

**Protocol:**

- The client NEVER writes directly to the `campaigns` table for status updates
- Client posts an `intent` to the Node.js API layer
- API validates the request and triggers n8n webhook
- n8n performs the work and persists results to Supabase
- Client only READS from the database
- This ensures a Single Source of Truth with guaranteed consistency

**Validation:**
Architecture review must confirm no Supabase client SDK usage in frontend code for write operations. All database mutations must be traceable through n8n execution logs.

---

## Dimension 2: State Synchronization & Atomic Locking

**Rule:** Atomic Postgres locks for every status change.

**Rationale:**
Parallel workflow executions will inevitably race for the same resource. Two cron jobs might pick up the same "pending" video. Two webhooks might process the same campaign. Without locking, we pay for double generation and post duplicate content.

**Protocol:**
The canonical locking pattern:

```sql
UPDATE campaigns
SET status = 'processing',
    locked_by = $workflow_id,
    locked_at = NOW()
WHERE id = $campaign_id
  AND status = 'pending'
  AND (locked_by IS NULL OR locked_at < NOW() - INTERVAL '10 minutes')
RETURNING *;
```

If this returns 0 rows, the workflow MUST exit immediately—another worker has claimed the job. This is not an error; this is expected behavior in concurrent systems.

**Lock Lifecycle:**

1. Acquire lock with UPDATE...RETURNING
2. Perform work
3. Update status and release lock (set locked_by = NULL)
4. If workflow crashes, lock expires after 10 minutes (zombie protection)

---

## Dimension 3: Deterministic Idempotency

**Rule:** Deterministic keys prevent double-processing and double-billing.

**Rationale:**
Webhooks are delivered at-least-once. Network jitter causes retries. Users double-click buttons. A duplicate video generation costs $5.00 or more. Idempotency is a financial firewall.

**Protocol:**
Before executing any operation that costs money or produces side effects:

1. Generate idempotency key: `SHA256(campaign_id + step_name + timestamp_bucket)`
2. Check `idempotency_keys` table for existing key
3. If key exists: Return cached previous result, do not re-execute
4. If key missing: Insert key, execute operation, store result

**Key Format:**

```
{context}_{execution_id}_{entity_id}_{operation}
```

Examples:

- `cost_exec123_campaign456_script_generation`
- `video_exec123_scene789_sora_submit`
- `publish_exec123_campaign456_tiktok_upload`

---

## Dimension 4: Gradient Fallback Logic

**Rule:** If API A fails, try API B or cached data. Never terminate with bare error.

**Rationale:**
APIs advertise 99.9% uptime. This means 8.7 hours of downtime per year. We cannot halt business for 8 hours. System reliability must exceed 99.99%.

**Protocol:**
Every external API call has a four-level fallback chain:

| Level      | Provider                             | Trigger Condition              |
| ---------- | ------------------------------------ | ------------------------------ |
| Primary    | OpenAI GPT-4o                        | First attempt                  |
| Secondary  | Anthropic Claude 3.5 Sonnet          | Primary returns 5xx or timeout |
| Tertiary   | Cached response or template fallback | Secondary fails                |
| Quaternary | Queue for retry + Admin alert        | All options exhausted          |

For video generation:
| Level | Provider | Trigger Condition |
|-------|----------|-------------------|
| Primary | Sora | First attempt (premium tier) |
| Secondary | Veo3 | Primary fails or overloaded |
| Tertiary | Seedream | Secondary fails |
| Quaternary | Queue for manual processing | All providers unavailable |

---

## Dimension 5: Granular Financial Observability

**Rule:** Ledger every micro-cost immediately upon incurrence.

**Rationale:**
SaaS margins are thin. We must know the exact COGS (Cost of Goods Sold) per campaign. We cannot optimize what we do not measure. Delayed cost logging loses data on failed workflows.

**Protocol:**
Every cost-incurring operation logs to `cost_ledger` within the same transaction as the operation:

| Field           | Type          | Precision  | Purpose                         |
| --------------- | ------------- | ---------- | ------------------------------- |
| provider        | TEXT          | -          | "openai", "anthropic", "sora"   |
| model           | TEXT          | -          | "gpt-4o", "claude-3-5-sonnet"   |
| tokens_in       | INTEGER       | -          | Input tokens consumed           |
| tokens_out      | INTEGER       | -          | Output tokens generated         |
| cost_usd        | DECIMAL(10,6) | 6 decimals | Actual cost to 6 decimal places |
| campaign_id     | UUID          | -          | Attribution to campaign         |
| idempotency_key | TEXT          | -          | Prevents duplicate logging      |

**Cost Precision:**
Six decimal places captures micro-transactions. $0.000001 matters at scale.

- Correct: 0.001234
- Wrong: 0.00 (rounded)

---

## Dimension 6: Global Circuit Breakers

**Rule:** System-wide pause on consecutive failures.

**Rationale:**
A bad loop can burn $1,000 in minutes. Cascading failures drain budget and pollute state. We need a "fuse box" for the application that trips automatically.

**Protocol:**
Redis-backed circuit breaker per provider:

**State Machine:**

```
CLOSED → (5 consecutive failures) → OPEN
OPEN → (5 minutes elapsed) → HALF_OPEN
HALF_OPEN → (test request succeeds) → CLOSED
HALF_OPEN → (test request fails) → OPEN (timer resets)
```

**Redis Keys:**

- `circuit_breaker:{provider}:consecutive_failures` - Integer counter
- `circuit_breaker:{provider}:status` - CLOSED | OPEN | HALF_OPEN
- `circuit_breaker:{provider}:opened_at` - Timestamp when circuit opened

**Global Pause:**
If circuits for ALL video providers trip simultaneously:

- Set `global_system:production_status = 'PAUSED'` in Redis
- All Production House workflows enter sleep mode
- Alert operations team immediately
- System resumes when at least one circuit recovers

---

## Dimension 7: Strict Schema Integrity

**Rule:** Validate JSON shape before API ingress.

**Rationale:**
"Garbage In, Sewer Out." Undefined properties cause hard-to-debug crashes deep in workflows. Invalid data that passes initial checks corrupts downstream state.

**Protocol:**

- Use JSON Schema validation at the VERY START of every n8n webhook
- If required field is missing: Return HTTP 400 immediately
- If field type is wrong: Return HTTP 400 immediately
- Do not process 10 steps deep and fail—Fail Fast

**Validation Library:**
Zod, AJV, or n8n's built-in schema validation. Schemas stored in version control alongside workflow definitions.

---

## Dimension 8: Visual Logic Transparency

**Rule:** No hidden code nodes; logic must be visible in workflow branches.

**Rationale:**
Spaghetti code is bad. Spaghetti nodes hidden inside JavaScript blocks are worse. The visual graph is the documentation. If business logic is invisible, it cannot be audited or debugged by the team.

**Protocol:**

- Logic branching (Success/Fail/Conditional) MUST be represented by Switch or If nodes
- These must visually diverge on the canvas
- Code nodes are ONLY for data transformation, never for control flow decisions
- If you find yourself writing `if (condition) { ... } else { ... }` in a code node for business logic, refactor to an If node

**Exception:**
Complex data parsing (JSON manipulation, array operations) belongs in code nodes. The rule applies to business decisions, not data transformation.

---

## Dimension 9: Parallel Efficiency

**Rule:** Maximize concurrency where state allows.

**Rationale:**
Serial execution is slow. We pay for time in user experience and infrastructure costs. Sequential processing of independent operations wastes latency budget.

**Protocol:**
Identify parallelizable operations and execute simultaneously:

| Operation Type                        | Execution Pattern                 |
| ------------------------------------- | --------------------------------- |
| Trend scraping (multiple sources)     | Parallel (fan-out, fan-in)        |
| Script generation                     | Serial (depends on trend context) |
| Scene generation (independent scenes) | Parallel (fan-out, wait for all)  |
| Scene generation (dependent scenes)   | Serial (respect dependencies)     |
| Platform uploads                      | Serial (rate limits enforce this) |

**Split Node Usage:**
Use Split nodes to create parallel branches. Use Merge nodes with "Wait for All" to collect results.

---

## Dimension 10: Cryptographic Security

**Rule:** Verify webhook signatures. Authenticate all API calls.

**Rationale:**
Webhook URLs are discoverable. Malicious actors could inject fake campaigns, trigger unauthorized operations, or drain budgets. Signature verification proves request authenticity.

**Protocol:**
Every incoming webhook:

1. Extract `x-webhook-signature` header
2. Compute HMAC-SHA256 of request body using shared secret
3. Use timing-safe comparison (not `==`)
4. If mismatch: Reject with 401, log IP address
5. If match: Process request

**Secret Management:**

- Webhook secrets stored in n8n credentials, not in workflow JSON
- Secrets rotated quarterly
- No secrets in version control

---

## Dimension 11: Strict Type Safety

**Rule:** Enforce strict data types in JSON.

**Rationale:**
Postgres hates type mismatches. JavaScript's type coercion creates subtle bugs. "1" is not 1. null is not undefined. These differences cause crashes at database write time.

**Protocol:**
Before every database write:

- Explicit type casting: `Number(json.views)`, `String(json.status)`
- Null checking: `json.value ?? default_value`
- Array validation: `Array.isArray(json.items)`

**Transformer Node:**
Insert a dedicated "Type Normalizer" code node before every Supabase node. This node's only job is ensuring types match the database schema.

---

## Dimension 12: Maintenance Modularity

**Rule:** Modular sub-workflows for reusable logic.

**Rationale:**
DRY (Don't Repeat Yourself). A bug in "Cost Logger" should be fixed in one place, not across 50 workflows. Consistency requires centralization.

**Protocol:**
Extract common patterns to sub-workflows:

| Sub-Workflow             | Purpose                            |
| ------------------------ | ---------------------------------- |
| `Log_Cost_Event`         | Standardized cost ledger logging   |
| `Check_Circuit_Breaker`  | Provider availability check        |
| `Validate_Schema`        | JSON schema validation             |
| `Acquire_Lock`           | Atomic lock acquisition            |
| `Release_Lock`           | Lock release with cleanup          |
| `Check_Safety_Filter`    | Brand safety validation            |
| `Get_Brand_Context`      | RAG retrieval for brand guidelines |
| `Refresh_Platform_Token` | OAuth token refresh                |

Main workflows call sub-workflows via Execute Workflow node.

---

## Dimension 13: Edge Case Handling

**Rule:** Handle API timeouts and rate limits gracefully.

**Rationale:**
The "Happy Path" is a fantasy. Networks are unreliable. APIs have rate limits. Responses are sometimes empty. Every edge case must have explicit handling.

**Protocol:**

| Edge Case        | Detection                 | Response                                 |
| ---------------- | ------------------------- | ---------------------------------------- |
| Timeout (\>60s)  | HTTP node timeout setting | Cancel, log, retry with backoff          |
| Rate Limit (429) | HTTP status code          | Parse `Retry-After` header, sleep, retry |
| Empty Response   | Response body check       | Treat as "no results", not error         |
| Malformed JSON   | Parse error catch         | Log raw response, fail gracefully        |
| Partial Success  | Business logic check      | Handle partial data, flag for review     |

---

## Dimension 14: Optimization & Garbage Collection

**Rule:** Minimize execution steps to save n8n credits.

**Rationale:**
n8n Cloud meters by execution steps. Efficiency directly translates to cost savings. Unnecessary nodes waste credits and slow execution.

**Protocol:**

- Combine database operations: "Update Status" and "Update Data" in one call
- Prune large binary data from memory immediately after upload
- Do not pass Base64 strings between nodes—use reference URLs
- Avoid storing full API responses; extract only needed fields
- Set TTL on Redis keys to prevent memory bloat

---

## Dimension 15: Future-Proofing for Analytics

**Rule:** Structure data for Phase 5 Analytics.

**Rationale:**
Phase 5 is "The Brain"—ML-powered optimization. It needs structured logs to learn patterns. Unstructured data is waste. Planning for analytics now saves painful migrations later.

**Protocol:**

- Do not save "Summary" strings. Save structured JSON: `{ "pain_points": [...], "hooks": [...] }`
- Flatten complex objects into queryable columns where appropriate
- Use GIN indexes on JSONB columns for efficient querying
- Include timestamp fields on all entities
- Preserve state history for event sourcing patterns

---

# SECTION 3: PILLAR 1 - THE STRATEGIST

**Mandate:** The Brain of the operation. Parallel intelligence gathering with quality gates.

**Objective:** Concurrently scrape trends and vector-search brand identity. Merge results only upon mutual success. Divert low-confidence outputs to human review.

---

## 3.1 Sub-System: Universal Trend Ingestion (UTI)

### Concept

Trends arrive from multiple sources in different formats: Twitter/X, Google Trends, news APIs, competitor monitoring. We need a "universal adapter" to intake this chaos and output structured, comparable data.

### Implementation Architecture

**Trigger:** Scheduled cron (every 4 hours) or on-demand webhook

**Scatter-Gather Pattern:**
Split execution into parallel branches:

| Branch | Source        | Query Method                                         |
| ------ | ------------- | ---------------------------------------------------- |
| A      | Brave Search  | "Trending topics in [Industry]" with `&freshness=pd` |
| B      | Google Trends | RSS feed parser, XML to JSON conversion              |
| C      | Twitter/X API | Influencer timeline fetch, filtered by engagement    |
| D      | News API      | Industry-specific keyword monitoring                 |

**Standardization Schema:**
All sources normalize to this structure:

```json
{
  "trend": {
    "source_id": "string (URL, Tweet ID, or unique identifier)",
    "source_type": "brave|google_trends|twitter|news",
    "timestamp": "ISO8601 datetime",
    "velocity_score": 1-100,
    "raw_content": "string (original text)",
    "keywords": ["array", "of", "extracted", "keywords"],
    "embedding": [0.1, 0.2, ...],
    "content_hash": "SHA256 for deduplication"
  }
}
```

**Deduplication:**
Before processing, check `content_hash` against Redis Bloom Filter to avoid reprocessing identical content seen in previous runs.

### Timeout Boundaries

Each branch operates under 120-second timeout. Timeout returns error status rather than hanging. Timeout is treated as branch failure for merge gate purposes.

### API Rate Awareness

When firing parallel requests, respect aggregate rate limits. Track remaining quota per provider in Redis. Throttle if approaching limits.

---

## 3.2 Sub-System: Brand Identity Retrieval (RAG)

### Concept

Trends are useless if they don't fit the brand. Retrieval Augmented Generation grounds the AI in brand-specific context.

### Implementation Architecture

**Input:** Campaign ID and trend keywords from UTI

**Vector Search:**
Query `brand_knowledge_base` table via pgvector:

```sql
SELECT content, similarity
FROM brand_knowledge_base
WHERE brand_id = $brand_id
ORDER BY embedding <=> $trend_embedding
LIMIT 5;
```

**Retrieval Categories:**

- Brand Rules (tone, voice, values)
- Positive Examples (successful past content)
- Negative Constraints (topics to avoid, restricted keywords)

**Context Window Assembly:**
Format retrieved chunks into LLM system prompt, prioritizing:

1. Negative Constraints (Do Nots) - Most critical
2. Brand Rules (How to sound)
3. Positive Examples (What works)

### Guideline Versioning

Brand guidelines are versioned. Every RAG query references a specific `guideline_version_id`. If guidelines update mid-pipeline, in-flight campaigns continue using their original version for consistency.

### Cache Strategy

Vector similarity results cached in Redis for 1 hour. Brand guidelines change infrequently; avoid repeated expensive vector searches.

---

## 3.3 Sub-System: Parallel Merge Gate

### Concept

Both UTI and RAG must complete successfully before proceeding. Partial results require special handling.

### Implementation Architecture

**Merge Node Configuration:**

- Type: "Wait for Both"
- Does not proceed until BOTH branches have result (success or failure)
- Timeout: 180 seconds (allows for both branches + buffer)

**Merge Outcomes:**

| UTI Status | RAG Status | Action                                         |
| ---------- | ---------- | ---------------------------------------------- |
| Success    | Success    | Proceed to Alignment Check                     |
| Success    | Failure    | Use cached brand context, proceed with warning |
| Failure    | Success    | Activate Evergreen Mode (use archived trends)  |
| Failure    | Failure    | Abort, alert operations, queue for retry       |

### Evergreen Mode

When trend sources fail, query `evergreen_content_bank` table for timeless topics relevant to the brand. This ensures the pipeline can produce content even during external service outages.

---

## 3.4 Sub-System: The Hallucination Gate

### Concept

LLMs hallucinate. They fabricate trends that don't exist, invent brand guidelines that were never written. We must catch them before expensive downstream processing.

### Implementation Architecture

**Alignment Score Calculation:**
After merge, calculate alignment between trend context and brand guidelines:

```
alignment_score = cosine_similarity(trend_embedding, brand_centroid)
```

Where `brand_centroid` is the average embedding of core brand guidelines.

**Threshold Enforcement:**

| Score Range | Decision                                     |
| ----------- | -------------------------------------------- |
| ≥ 0.85      | PASS - Proceed to Copywriter                 |
| 0.70 - 0.84 | REVIEW - Queue for human review with context |
| < 0.70      | REJECT - Log failure, do not proceed         |

**Threshold Configuration:**
Threshold value stored as environment variable `HALLUCINATION_GATE_THRESHOLD` for adjustment without workflow modification.

### Human Review Diversion

Failed hallucination gates trigger webhook to Human Review Queue:

```json
{
  "campaign_id": "uuid",
  "trend_data": { ... },
  "brand_guidelines_excerpt": "...",
  "calculated_score": 0.72,
  "failure_reason": "Alignment score below threshold",
  "suggested_actions": ["Broaden trend search", "Adjust brand context"]
}
```

### Review Queue State Machine

Items in `strategist_review_queue` table:

```
pending_review → in_review → approved | rejected
```

- Approved items re-enter pipeline at merge gate
- Rejected items logged and closed
- Items pending > 24 hours trigger escalation
- Items pending > 72 hours auto-reject with "review_timeout"

---

## 3.5 Sub-System: Source Verification (Anti-Fake News)

### Concept

We cannot strategize based on fake news or rumors. Viral misinformation can damage brand reputation.

### Implementation Architecture

**Fact Check Query:**
For each trend, extract the core claim and run verification:

```
Query: "Is [core_claim] true?" OR "Debunk [core_claim]"
Source: Brave Search with fact-checking sites prioritized
```

**Consensus Logic:**
LLM analyzes first 3 search results:

- If 2/3 indicate "Hoax" or "False": Discard trend immediately
- If 2/3 indicate "True" or "Verified": Proceed with confidence boost
- If inconclusive: Proceed with warning flag

**Audit Trail:**
Log all verification URLs for liability and compliance review.

---

## 3.6 Sub-System: Concurrency Control

### Concept

Multiple Strategist workflows might run simultaneously (different campaigns, scheduled overlaps). Resource exhaustion must be prevented.

### Implementation Architecture

**Redis Semaphore:**
Limit concurrent Strategist executions across the n8n instance:

```
Key: concurrency_semaphore:strategist
Max Value: 10 (configurable)
```

Before execution:

1. INCR semaphore
2. If value > max: Wait 30 seconds, retry (up to 3 times)
3. If still exceeded: Queue for later, exit gracefully

After execution:

1. DECR semaphore (in finally block, even on failure)

**TTL Protection:**
Semaphore keys have 10-minute TTL to prevent zombie locks from crashed workflows.

---

## 3.7 Pillar 1: Output Schema

The Strategist produces a Creative Brief that feeds into Pillar 2:

```json
{
  "creative_brief": {
    "brief_id": "uuid",
    "campaign_id": "uuid",
    "brand_id": "uuid",

    "trend_context": {
      "primary_trend": {
        "topic": "string",
        "velocity_score": 85,
        "source": "twitter",
        "detected_at": "ISO8601"
      },
      "supporting_trends": [...],
      "verification_status": "verified|unverified|flagged"
    },

    "brand_context": {
      "tone": "professional|casual|humorous|inspirational",
      "color_palette": ["#hex1", "#hex2"],
      "restricted_keywords": ["competitor1", "politics"],
      "visual_style": "cinematic|minimal|vibrant",
      "guideline_version_id": "uuid"
    },

    "creative_direction": {
      "primary_hook_angle": "string",
      "value_proposition": "string",
      "call_to_action": "string",
      "suggested_variants": ["humorous", "educational"]
    },

    "quality_scores": {
      "alignment_score": 0.89,
      "trend_velocity": 85,
      "verification_confidence": 0.95
    },

    "metadata": {
      "generated_at": "ISO8601",
      "execution_id": "n8n-exec-id",
      "cost_usd": 0.023456
    },

    "status": "pending_approval|approved|rejected"
  }
}
```

---

## 3.8 Pillar 1: Cost Tracking Points

Every cost-incurring operation logs immediately:

| Operation                  | Provider | Typical Cost       |
| -------------------------- | -------- | ------------------ |
| Brave Search query         | brave    | $0.005/query       |
| Vector similarity search   | supabase | $0.001/query       |
| Trend embedding generation | openai   | $0.002/1K tokens   |
| Brief synthesis (GPT-4o)   | openai   | $0.03/call average |
| Fact verification query    | brave    | $0.005/query       |

**Target Cost Per Brief:** < $0.10

---

## 3.9 Pillar 1: Failure Runbook

### Scenario: Brave Search API Down

**Detection:** HTTP 5xx response or timeout from Brave API

**Auto-Response:**

1. Circuit breaker increments failure counter
2. If threshold reached: Circuit opens for Brave
3. Workflow activates Evergreen Mode
4. Query `evergreen_content_bank` for brand-relevant timeless topics
5. Proceed with warning flag: "Running on Evergreen Backup"
6. Alert operations: "Pillar 1 degraded - Brave Search unavailable"

**Recovery:**
Circuit breaker automatically tests Brave API after 5 minutes in OPEN state. On success, normal operation resumes.

### Scenario: Low Alignment Scores Across All Attempts

**Detection:** Three consecutive briefs rejected by hallucination gate

**Auto-Response:**

1. Log pattern: "Possible brand-trend mismatch"
2. Broaden trend search by removing most restrictive keyword
3. If still failing: Alert Brand Manager for guideline review
4. Pause campaign until human intervention

### Scenario: Vector Database Unavailable

**Detection:** pgvector queries timeout or error

**Auto-Response:**

1. Use cached brand context from last successful query
2. Mark brief with warning: "Using cached brand context"
3. Alert operations for database investigation
4. Continue with degraded but functional pipeline

---

# SECTION 4: PILLAR 2 - THE COPYWRITER

**Mandate:** The Creative Soul. Self-healing script generation with quality gates.

**Objective:** Transform creative briefs into production-ready scripts through iterative refinement, automatic regeneration on validation failure, and comprehensive cost observability.

---

## 4.1 Sub-System: The Recursive Critic Loop (RCL)

### Concept

First drafts are trash. Good writing is rewriting. The Copywriter implements a generate-critique-regenerate loop where a separate LLM persona acts as a harsh editor.

### Implementation Architecture

**Generation Node:**
Initial script generation from creative brief using primary LLM (GPT-4o)

**Critic Node:**
Separate LLM call with "Senior Editor" persona evaluates the script:

**Critic Scoring Rubric:**

| Dimension      | Weight | Criteria                                |
| -------------- | ------ | --------------------------------------- |
| Hook Strength  | 30%    | Does it stop the scroll in 0-3 seconds? |
| Value Delivery | 25%    | Is the insight clear and compelling?    |
| CTA Clarity    | 20%    | Is the call-to-action obvious?          |
| Brand Voice    | 15%    | Does it match the brand tone?           |
| Conciseness    | 10%    | No wasted words or filler?              |

**Decision Gate:**

| Score | Action                                         |
| ----- | ---------------------------------------------- |
| ≥ 85  | PASS - Proceed to Production                   |
| 70-84 | REFINE - Route back to generator with critique |
| < 70  | FAIL - After 3 attempts, flag for human review |

### Feedback Injection

When routing back to generator, the critique is injected into the prompt:

```
Previous draft scored 72/100.
Critique: "The hook is too slow. Cut the first sentence. The CTA is buried."
Instruction: Revise the script addressing these specific issues.
```

### Temperature Adjustment Logic

Dynamic temperature based on failure type:

- Low creativity score → Increase temperature (+0.1, max 1.0)
- Low brand compliance → Decrease temperature (-0.1, min 0.3)
- Low conciseness → Keep temperature, add explicit word limit

### Circuit Breaker

Maximum 3 refinement loops. After third failure:

1. Log script versions and all critiques
2. Queue for human copywriter intervention
3. Mark campaign as "requires_human_polish"
4. Do not block—continue to next campaign

---

## 4.2 Sub-System: Tone-of-Voice Vector Injection

### Concept

Every brand sounds different. Generic scripts fail. The LLM must be grounded in brand-specific voice patterns.

### Implementation Architecture

**Embedding Retrieval:**

1. Embed current topic keywords
2. Query `brand_voice_examples` table for similar successful scripts
3. Select top 3 examples with highest engagement scores

**Few-Shot Injection:**
Include retrieved examples in prompt as "Style References":

```
Here are 3 examples of successful scripts in this brand's voice:

Example 1 (12K views): "..."
Example 2 (8K views): "..."
Example 3 (15K views): "..."

Write a new script in this same style about [current topic].
```

### Voice Consistency Scoring

After generation, compute embedding similarity between new script and brand voice centroid. Score < 0.80 triggers refinement loop with explicit voice guidance.

---

## 4.3 Sub-System: Visual Direction Parsing

### Concept

A script is not just audio. It's Video + Audio. The LLM must "direct" each scene with visual prompts suitable for video generation models.

### Implementation Architecture

**Structured Output Requirement:**
Script generation must output structured scene array:

```json
{
  "scenes": [
    {
      "scene_id": "uuid",
      "sequence": 1,
      "duration_seconds": 3,
      "visual_prompt": "Cinematic shot, 35mm lens, shallow depth of field...",
      "voiceover_text": "What if I told you...",
      "visual_cues": {
        "style": "hyper_realistic",
        "camera_movement": "slow dolly in",
        "lighting": "golden hour, warm tones"
      },
      "audio_cues": {
        "music_style": "suspenseful, building tension",
        "sfx": ["typing sounds", "notification ping"],
        "voice_tone": "curious, engaging"
      }
    }
  ]
}
```

**Visual Prompt Enhancement:**
Raw visual descriptions are upgraded by a specialized "Prompt Engineer" LLM call:

| Input               | Output                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| "Man holding phone" | "Cinematic close-up, 35mm anamorphic lens, depth of field, man's hands holding iPhone 15 Pro, studio lighting with soft shadows, 4K resolution" |

This enhancement step uses a cheaper model (GPT-4o-mini) to save costs.

---

## 4.4 Sub-System: Brand Safety Filter

### Concept

Brand safety is non-negotiable. One offensive post can destroy years of reputation building.

### Implementation Architecture

**Multi-Layer Filtering:**

| Layer | Check                                      | Action on Failure                    |
| ----- | ------------------------------------------ | ------------------------------------ |
| 1     | Keyword Blacklist (profanity, hate speech) | Immediate rejection                  |
| 2     | Competitor Name Check (fuzzy match)        | Remove/replace term                  |
| 3     | Political/Religious Content                | Flag for human review                |
| 4     | Sentiment Analysis                         | Negative sentiment requires approval |
| 5     | Legal Risk Keywords                        | Legal team notification              |

**Blacklist Sources:**

- Global profanity list (maintained)
- Brand-specific restricted terms
- Competitor names and products
- Regulatory terms (financial, medical claims)

**False Positive Handling:**
Blocked scripts can be manually approved with documented override reason.

---

## 4.5 Sub-System: Hook Generation Engine

### Concept

The hook is everything. 50% of viral success is the first 3 seconds. We generate multiple hook variations and score them algorithmically.

### Implementation Architecture

**Hook Generation:**
For each script, generate 10+ hook variations using creative temperature (0.9)

**Hook Scoring Algorithm:**

| Factor              | Weight | Measurement                      |
| ------------------- | ------ | -------------------------------- |
| Curiosity Gap       | 25%    | Questions, incomplete patterns   |
| Emotional Resonance | 25%    | Power words, sentiment intensity |
| Pattern Interrupt   | 20%    | Unexpected statements, contrasts |
| Shareability        | 15%    | "I need to tell someone" factor  |
| Brand Fit           | 15%    | Alignment with brand voice       |

**Selection Process:**

1. Score all 10 variations
2. Filter to top 3 scoring > 0.75
3. Present top 3 to Creative Director (if human review enabled)
4. Otherwise, auto-select highest score

**Hook Pattern Database:**
Store successful hooks with performance data. Use for similarity comparison and pattern learning.

---

## 4.6 Sub-System: Cost Observability Framework

### Concept

Script generation can involve multiple LLM calls. Each must be logged to the cost ledger immediately.

### Implementation Architecture

**Cost Accumulator Pattern:**
A `_cost_events` array passes through the workflow, accumulating cost data:

```json
{
  "_cost_events": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "tokens_in": 1250,
      "tokens_out": 450,
      "cost_usd": 0.02345,
      "purpose": "script_generation_draft_1",
      "idempotency_key": "cost_exec123_script_draft_1",
      "timestamp": "ISO8601"
    },
    {
      "provider": "openai",
      "model": "gpt-4o",
      "tokens_in": 1800,
      "tokens_out": 250,
      "cost_usd": 0.01875,
      "purpose": "script_critique",
      "idempotency_key": "cost_exec123_script_critique_1",
      "timestamp": "ISO8601"
    }
  ]
}
```

**Flush to Database:**
At workflow completion (success or failure), all accumulated events flush to `cost_ledger` table.

**Budget Gate:**
If accumulated cost exceeds thresholds, trigger alerts:

- Warning at $5.00
- Alert at $10.00
- Pause at $25.00 (requires human approval to continue)

---

## 4.7 Pillar 2: Output Schema

The Copywriter produces a Script Package for Pillar 3:

```json
{
  "script": {
    "script_id": "uuid",
    "brief_id": "uuid",
    "campaign_id": "uuid",

    "hook": {
      "text": "What if everything you knew about [topic] was wrong?",
      "hook_type": "question",
      "quality_score": 0.87,
      "variations_generated": 10,
      "selected_rationale": "Highest curiosity gap score"
    },

    "scenes": [
      {
        "scene_id": "uuid",
        "sequence": 1,
        "duration_seconds": 3,
        "visual_prompt": "Cinematic...",
        "voiceover_text": "...",
        "visual_cues": {},
        "audio_cues": {}
      }
    ],

    "voiceover_full_text": "Complete script text...",
    "total_duration_seconds": 30,

    "variant_tag": "educational",

    "quality_scores": {
      "critic_score": 88,
      "brand_compliance": 0.92,
      "hook_score": 0.87,
      "voice_consistency": 0.85
    },

    "safety_status": {
      "passed": true,
      "flags": [],
      "reviewed_at": "ISO8601"
    },

    "generation_metadata": {
      "refinement_loops": 2,
      "total_llm_calls": 5,
      "total_cost_usd": 0.08765,
      "execution_id": "n8n-exec-id"
    },

    "status": "pending_approval|approved|rejected",
    "version": 1
  }
}
```

---

## 4.8 Pillar 2: Cost Tracking Points

| Operation                 | Provider | Typical Cost |
| ------------------------- | -------- | ------------ |
| Script draft (GPT-4o)     | openai   | $0.03/call   |
| Script critique (GPT-4o)  | openai   | $0.02/call   |
| Visual prompt enhance     | openai   | $0.005/call  |
| Hook generation (10 vars) | openai   | $0.05/batch  |
| Voice consistency check   | openai   | $0.01/call   |

**Target Cost Per Script:** < $0.15

---

## 4.9 Pillar 2: Failure Runbook

### Scenario: LLM Producing Repetitive Output (Model Collapse)

**Detection:** Similarity score of last 5 scripts > 0.90

**Auto-Response:**

1. Log pattern: "Model collapse detected"
2. Increase temperature from 0.7 to 0.95
3. Add diversity instruction: "Create something completely different from previous scripts"
4. If still repetitive: Switch to backup model (Claude 3.5 Sonnet)

### Scenario: Script Consistently Fails Brand Compliance

**Detection:** Three consecutive scripts score < 0.85 on brand compliance

**Auto-Response:**

1. Re-fetch brand guidelines (cache might be stale)
2. Increase brand context in prompt (more examples)
3. Alert Brand Manager for guideline review
4. Queue for human copywriting if still failing

### Scenario: LLM Refusal (Safety Filter Triggered)

**Detection:** LLM returns refusal response

**Auto-Response:**

1. Log the blocked prompt and refusal reason
2. Terminate script generation
3. Mark campaign as "Flagged - Content Policy"
4. Alert Admin immediately
5. Do NOT retry—human review required

---

# SECTION 5: PILLAR 3 - THE PRODUCTION HOUSE

**Mandate:** The Factory. Managing long-running, expensive, asynchronous video generation jobs.

**Objective:** Submit generation jobs, poll for completion, handle failures with circuit breakers, and verify asset delivery before marking complete.

---

## 5.1 Sub-System: The "Job Ticket" Lifecycle

### Concept

Video generation takes 5-30 minutes depending on model. We cannot hold HTTP connections open. We use an async ticket architecture where jobs are submitted, tracked, and completed independently.

### Implementation Architecture

**State Machine:**

```
queued → submitted → processing → completed | failed | timeout
```

**Lifecycle Steps:**

| Step | Actor       | Action                   | Database Update                      |
| ---- | ----------- | ------------------------ | ------------------------------------ |
| 1    | API/Webhook | Receive script package   | Insert job: status='queued'          |
| 2    | Dispatcher  | Pick up queued job       | Lock row, status='submitted'         |
| 3    | Dispatcher  | Submit to provider API   | Store provider_job_id                |
| 4    | Dispatcher  | Confirm submission       | status='processing'                  |
| 5    | Poller      | Check provider status    | Update last_checked_at               |
| 6    | Poller      | Provider says complete   | status='completed', trigger download |
| 7    | Download    | Fetch and store asset    | Update asset URLs                    |
| 8    | Verify      | Confirm asset accessible | status='verified'                    |

### Job Record Schema

```json
{
  "job_id": "uuid",
  "scene_id": "uuid",
  "script_id": "uuid",
  "campaign_id": "uuid",

  "provider": "sora|veo3|seedream|nano_b",
  "provider_job_id": "external-id",
  "provider_status": "pending|processing|completed|failed",

  "prompt": "Full visual prompt sent to provider",
  "parameters": {
    "duration": 5,
    "aspect_ratio": "9:16",
    "style": "cinematic"
  },

  "status": "queued|submitted|processing|completed|failed|timeout",
  "locked_by": "workflow-execution-id",
  "locked_at": "ISO8601",

  "submitted_at": "ISO8601",
  "expected_completion": "ISO8601",
  "completed_at": "ISO8601",

  "result_url": "provider-temporary-url",
  "internal_url": "supabase-storage-url",

  "cost_usd": 0.5,
  "error_message": null,
  "retry_count": 0
}
```

---

## 5.2 Sub-System: Multi-Vendor Routing Strategy

### Concept

Vendor lock-in is risk. Quality varies. Costs differ. An abstraction layer routes to appropriate provider based on requirements.

### Implementation Architecture

**Router Decision Tree:**

```
IF budget_tier == 'premium' AND visual_style == 'hyper_realistic':
    → Sora (highest quality, highest cost)

ELIF budget_tier == 'standard' AND scene_type == 'social_montage':
    → Veo3 (balanced quality/cost)

ELIF visual_style == 'abstract' OR budget_tier == 'volume':
    → Seedream (cost-effective)

ELIF scene_type == 'image_to_video':
    → Nano B (specialized for image animation)

ELSE:
    → Sora (default to highest quality)
```

**Provider Profiles:**

| Provider | Cost per Second | Typical Duration | Quality Tier | Best For                      |
| -------- | --------------- | ---------------- | ------------ | ----------------------------- |
| Sora     | $0.10/sec       | 20-30 min        | Premium      | Photorealistic, product shots |
| Veo3     | $0.05/sec       | 10-15 min        | Standard     | Social content, fast pacing   |
| Seedream | $0.03/sec       | 5-10 min         | Budget       | Abstract, artistic, volume    |
| Nano B   | $0.02/sec       | 5-10 min         | Budget       | Image-to-video conversion     |

**Adapter Pattern:**
Each provider has a dedicated adapter that:

1. Maps internal request format to provider API schema
2. Handles provider-specific authentication
3. Normalizes response to universal JobResponse structure

---

## 5.3 Sub-System: The Polling Pattern

### Concept

Long-running jobs require periodic status checks. A dedicated polling workflow runs on schedule to check all active jobs.

### Implementation Architecture

**Poll Scheduler:**
Separate workflow triggered every 60 seconds (configurable)

**Poll Logic:**

```
1. Query: SELECT * FROM generation_jobs
          WHERE status IN ('submitted', 'processing')
          AND last_polled_at < NOW() - INTERVAL '1 minute'

2. For each job:
   a. Call provider status API
   b. Update last_polled_at
   c. If status changed: Update local status
   d. If completed: Trigger Download Handler webhook
   e. If failed: Increment retry_count, handle failure
```

**Webhook-Based Completion:**
When polling detects completion, it does NOT download inline. Instead:

1. Updates job status to 'completed'
2. Triggers separate Download_Handler webhook
3. Continues polling remaining jobs

This separation ensures polling workflow stays fast and focused.

### Timeout Detection

Jobs exceeding `expected_completion + 2x buffer` are marked 'timeout':

- 30-minute expected → 60-minute timeout threshold
- Timeout counts as failure for circuit breaker
- Timeout jobs can be retried or escalated

---

## 5.4 Sub-System: Asset Permanence (Download/Upload Dance)

### Concept

Provider URLs are temporary. They expire, buckets rotate, links die. We must own the asset on our infrastructure before marking complete.

### Implementation Architecture

**Download Handler Steps:**

| Step | Action                                    | Failure Handling               |
| ---- | ----------------------------------------- | ------------------------------ |
| 1    | Validate provider URL (HEAD request)      | Abort if 404                   |
| 2    | Stream fetch from provider                | Retry 3x with backoff          |
| 3    | Stream upload to Supabase Storage         | Retry 3x with backoff          |
| 4    | Generate internal URL                     | -                              |
| 5    | Update job record with internal_url       | -                              |
| 6    | Verify internal URL (HEAD request)        | Retry download if verify fails |
| 7    | Compare file sizes (provider vs internal) | Retry if mismatch              |

**Streaming Pattern:**
Do NOT buffer video in memory. Use streaming:

```
Provider Response Stream → Supabase Upload Stream
```

This prevents memory exhaustion for large video files.

**Storage Organization:**

```
supabase-storage/
└── campaign_assets/
    └── {campaign_id}/
        └── {scene_id}/
            ├── video.mp4
            ├── thumbnail.jpg
            └── metadata.json
```

---

## 5.5 Sub-System: Concurrency Throttling

### Concept

Video APIs have concurrent job limits. Exceeding limits causes rejections and wasted retries.

### Implementation Architecture

**Redis Counter:**

```
Key: current_renders:{provider}
Max: Provider-specific limit (e.g., Sora: 5, Veo3: 10)
TTL: 30 minutes (zombie protection)
```

**Pre-Submit Check:**

```
1. INCR current_renders:{provider}
2. If value > max:
   a. DECR (roll back)
   b. Re-queue job with delay
   c. Exit gracefully
3. If value <= max:
   a. Proceed with submission
```

**Post-Completion Decrement:**

```
1. DECR current_renders:{provider}
2. Execute in finally block (even on failure)
```

**Zombie Protection:**
TTL on Redis keys ensures crashed workflows don't permanently hold slots. After 30 minutes of no update, the slot is released.

---

## 5.6 Sub-System: Circuit Breaker Implementation

### Concept

Provider failures can cascade. A misbehaving API can drain budget with failed attempts. Circuit breakers contain the blast radius.

### Implementation Architecture

**Per-Provider Circuit:**

| State     | Behavior                                   |
| --------- | ------------------------------------------ |
| CLOSED    | Normal operation, jobs submitted           |
| OPEN      | All submissions rejected, queued for later |
| HALF_OPEN | Single test request permitted              |

**State Transitions:**

```
CLOSED → (5 consecutive failures) → OPEN
OPEN → (5 minutes elapsed) → HALF_OPEN
HALF_OPEN → (test succeeds) → CLOSED
HALF_OPEN → (test fails) → OPEN (timer resets)
```

**Redis Keys:**

```
circuit_breaker:sora:consecutive_failures = 0
circuit_breaker:sora:status = "CLOSED"
circuit_breaker:sora:opened_at = null
```

**Global Pause:**
If ALL video provider circuits are OPEN simultaneously:

```
Set: global_system:production_status = "PAUSED"
Effect: All Production House workflows sleep until recovery
Alert: Immediate notification to operations
```

---

## 5.7 Sub-System: Parallel Scene Processing

### Concept

Scripts have multiple scenes. Independent scenes can generate in parallel. Dependent scenes wait for prerequisites.

### Implementation Architecture

**Scene Dependency Analysis:**
Most scenes are independent and can parallelize. Exceptions:

- Scene uses output of previous scene (rare)
- Scene references asset from previous scene

**Execution Pattern:**

```
Script Received
    ↓
Parse Scenes
    ↓
Identify Dependencies
    ↓
[Independent Scenes] → Parallel Queue → Fan-Out
[Dependent Scenes] → Sequential Queue → Ordered Execution
    ↓
Fan-In: Wait for All
    ↓
Proceed to Assembly
```

**Concurrency Limit per Campaign:**
Max 3 parallel scene renders per campaign to prevent resource hogging.

---

## 5.8 Sub-System: Video Assembly Pipeline

### Concept

Individual scene clips must be assembled into final video with audio synchronization.

### Implementation Architecture

**Assembly Steps:**

| Step | Input          | Output             | Tool                    |
| ---- | -------------- | ------------------ | ----------------------- |
| 1    | Scene clips    | Concatenated video | FFmpeg/Cloud service    |
| 2    | Voiceover text | Audio file         | TTS API (ElevenLabs)    |
| 3    | Video + Audio  | Synced master      | Audio sync service      |
| 4    | Master video   | Thumbnails         | Frame extraction        |
| 5    | Master video   | Format variants    | Aspect ratio conversion |

**Format Variants Generated:**

```
master_16x9.mp4  → YouTube, LinkedIn
master_9x16.mp4  → TikTok, Reels, Shorts
master_1x1.mp4   → Instagram Feed
thumbnail.jpg    → All platforms
```

---

## 5.9 Pillar 3: Output Schema

The Production House produces a Video Asset Package for Pillar 4:

```json
{
  "video_assets": {
    "video_id": "uuid",
    "script_id": "uuid",
    "campaign_id": "uuid",

    "master_video": {
      "url": "supabase-storage-url",
      "duration_seconds": 30,
      "file_size_bytes": 15000000,
      "format": "mp4",
      "resolution": "1080x1920"
    },

    "format_variants": [
      { "aspect_ratio": "16:9", "url": "...", "platform": "youtube" },
      { "aspect_ratio": "9:16", "url": "...", "platform": "tiktok" },
      { "aspect_ratio": "1:1", "url": "...", "platform": "instagram_feed" }
    ],

    "scene_clips": [
      {
        "scene_id": "uuid",
        "sequence": 1,
        "url": "...",
        "duration_seconds": 5,
        "model_used": "sora",
        "generation_job_id": "uuid",
        "cost_usd": 0.5
      }
    ],

    "audio_assets": {
      "voiceover_url": "...",
      "voiceover_duration": 28,
      "background_music_url": "...",
      "synced_audio_url": "..."
    },

    "thumbnails": [
      { "url": "...", "timestamp": 0 },
      { "url": "...", "timestamp": 15 }
    ],

    "generation_metadata": {
      "started_at": "ISO8601",
      "completed_at": "ISO8601",
      "total_render_time_seconds": 1200,
      "models_used": ["sora", "veo3"],
      "total_cost_usd": 2.45,
      "retry_count": 0
    },

    "quality_checks": {
      "all_scenes_present": true,
      "audio_synced": true,
      "duration_matches_script": true,
      "files_verified": true
    },

    "status": "pending_verification|verified|failed"
  }
}
```

---

## 5.10 Pillar 3: Cost Tracking Points

| Operation                       | Provider     | Typical Cost |
| ------------------------------- | ------------ | ------------ |
| Scene generation (Sora, 5s)     | sora         | $0.50        |
| Scene generation (Veo3, 5s)     | veo3         | $0.25        |
| Scene generation (Seedream, 5s) | seedream     | $0.15        |
| Scene generation (Nano B, 5s)   | nano_b       | $0.10        |
| Voiceover generation (30s)      | elevenlabs   | $0.15        |
| Video assembly/transcoding      | cloudconvert | $0.05        |
| Storage (per GB/month)          | supabase     | $0.021       |

**Target Cost per 30-Second Video:**

- Premium tier: < $3.00
- Standard tier: < $1.50
- Volume tier: < $0.75

---

## 5.11 Pillar 3: Failure Runbook

### Scenario: Video Provider Returns 503 (Overloaded)

**Detection:** HTTP 503 response from provider API

**Auto-Response:**

1. Circuit breaker increments failure counter
2. Job enters exponential backoff queue:
   - Attempt 1 fail: Wait 1 minute
   - Attempt 2 fail: Wait 5 minutes
   - Attempt 3 fail: Wait 15 minutes
   - Attempt 4 fail: Alert Admin, pause pipeline
3. Route to backup provider if available
4. If all providers overloaded: Activate global pause

### Scenario: Asset Corruption (0-Byte File)

**Detection:** Downloaded file has size 0 or corrupted headers

**Auto-Response:**

1. Log corruption event with provider job ID
2. Delete corrupted local asset
3. Trigger regeneration signal back to dispatcher
4. Increment scene retry count
5. If retry > 3: Escalate to human review

### Scenario: Polling Workflow Stalls

**Detection:** No poll updates for > 10 minutes

**Auto-Response:**

1. Zombie Reaper cron detects stalled polls
2. Reset stuck jobs to 'queued' status
3. Alert operations: "Polling workflow stalled"
4. Monitor for pattern (if recurring, investigate n8n health)

# SECTION 6: PILLAR 4 - THE CAMPAIGN MANAGER

**Mandate:** The Quality Assurance Auditor. Trusts nothing. Verifies everything.

**Objective:** Verify physical asset existence, implement atomic row locking, manage platform compliance, and maintain the master asset registry.

---

## 6.1 Sub-System: Asset Authenticity Verification (The "404" Deep Scan)

### Concept

A database record saying "video.mp4" exists does not mean the file is actually on the server. Storage corruption, failed uploads, and bucket rotations create phantom assets. Trust nothing.

### Implementation Architecture

**Verification Protocol:**

| Step | Check                        | Expected                | Failure Action          |
| ---- | ---------------------------- | ----------------------- | ----------------------- |
| 1    | HTTP HEAD request to URL     | Status 200              | Mark asset "unverified" |
| 2    | Content-Type header          | video/mp4 (or expected) | Flag type mismatch      |
| 3    | Content-Length header        | > 0                     | Flag empty file         |
| 4    | ETag/Checksum (if available) | Matches stored hash     | Flag corruption         |

**Verification Timing:**

- After initial upload (immediate verification)
- Before distribution (just-in-time verification)
- Nightly sweep (batch verification of all active assets)

**Failure Handling:**
Unverified assets trigger regeneration workflow:

1. Mark asset status = 'verification_failed'
2. Notify Production House to regenerate
3. Log verification failure for pattern analysis
4. Block campaign from distribution until verified

---

## 6.2 Sub-System: The "Zombie" Campaign Reaper

### Concept

Workflows die mid-stream. Server restarts, network failures, and bugs leave campaigns stuck in "processing" forever. The Reaper hunts zombies.

### Implementation Architecture

**Reaper Cron:**
Runs hourly, queries for stuck campaigns:

```sql
SELECT * FROM campaigns
WHERE status = 'processing'
AND updated_at < NOW() - INTERVAL '1 hour';
```

**Reaper Actions:**

| Condition                      | Action                        |
| ------------------------------ | ----------------------------- |
| Stuck in 'processing' > 1 hour | Reset to 'pending_retry'      |
| Stuck in 'rendering' > 2 hours | Reset to 'queued', notify ops |
| Stuck in 'verifying' > 30 min  | Force re-verification         |
| Retry count > 3                | Mark 'failed', alert admin    |

**Logging:**
Every reaper action logged with campaign_id, original_status, new_status, and recovery_reason.

---

## 6.3 Sub-System: Platform Compliance Engine

### Concept

Each social platform has specific requirements. Wrong aspect ratio on TikTok means 0 views. Compliance is not optional.

### Implementation Architecture

**Platform Rules Engine:**

| Platform        | Aspect Ratio | Max Duration | File Size | Other                  |
| --------------- | ------------ | ------------ | --------- | ---------------------- |
| TikTok          | 9:16         | 600s         | 4GB       | No watermarks          |
| Instagram Reels | 9:16         | 90s          | 3.6GB     | No third-party marks   |
| YouTube Shorts  | 9:16         | 60s          | -         | -                      |
| YouTube         | 16:9         | 12 hours     | 256GB     | -                      |
| LinkedIn        | 4:5 or 16:9  | 10min        | 5GB       | Professional tone flag |

**Compliance Check:**

```
1. Fetch campaign target platforms
2. For each platform:
   a. Check aspect ratio matches
   b. Check duration within limits
   c. Check file size within limits
   d. Run platform-specific checks
3. Aggregate compliance status
4. Block non-compliant campaigns
```

**Auto-Fix (Future Enhancement):**
For Phase 4.5: Trigger CloudConvert job to automatically crop/pad non-compliant videos. For Phase 4: Fail with specific error message.

---

## 6.4 Sub-System: Approval Logic State Machine

### Concept

Human approval is required before public distribution. The system must pause, notify, and resume cleanly.

### Implementation Architecture

**State Machine:**

```
pending → requires_approval → waiting_approval → approved → ready
                                              ↓
                                          rejected → revision_needed
```

**Approval Workflow:**

1. Campaign reaches `requires_approval` state
2. Generate secure preview link (signed URL, 24h expiry)
3. Send notification (Slack, email, dashboard)
4. Workflow enters HALT state
5. **Separate workflow trigger:** `Webhook: Approval Received`
6. Validate approval signature and user permissions
7. Update status to `approved` or `rejected`
8. If approved: Resume to Pillar 5
9. If rejected: Route to revision with feedback

**Approval Record:**

```json
{
  "campaign_id": "uuid",
  "approved_by": "user_id",
  "approved_at": "ISO8601",
  "approval_method": "dashboard|slack|email",
  "feedback": "optional feedback text"
}
```

---

## 6.5 Sub-System: Master Asset Registry

### Concept

Single source of truth for all campaign assets. Every video, audio file, and thumbnail is registered and tracked.

### Implementation Architecture

**Registry Entry:**

```json
{
  "asset_id": "uuid",
  "asset_type": "video|audio|thumbnail|caption",
  "campaign_id": "uuid",
  "storage_url": "supabase-url",
  "storage_bucket": "campaign_assets",
  "file_size_bytes": 15000000,
  "content_type": "video/mp4",
  "checksum_md5": "abc123...",
  "uploaded_at": "ISO8601",
  "verified_at": "ISO8601",
  "verification_status": "verified|pending|failed",
  "storage_tier": "hot|warm|cold"
}
```

**Lifecycle Management:**

- **Hot (< 30 days):** Fast access, standard storage
- **Warm (30-90 days):** Reduced access, lower cost
- **Cold (> 90 days):** Archive storage, retrieval delay

**Deduplication:**
Before storing, check MD5 against existing assets. Duplicate content links to existing asset (reference counting).

---

## 6.6 Pillar 4: Output Schema

```json
{
  "campaign_package": {
    "campaign_id": "uuid",
    "status": "ready",

    "assets": {
      "master_video": { "asset_id": "uuid", "url": "...", "verified": true },
      "format_variants": [...],
      "thumbnails": [...],
      "audio": {...}
    },

    "compliance": {
      "tiktok": { "compliant": true, "checks_passed": ["ratio", "duration", "size"] },
      "instagram": { "compliant": true, "checks_passed": [...] },
      "youtube": { "compliant": true, "checks_passed": [...] }
    },

    "approval": {
      "required": true,
      "status": "approved",
      "approved_by": "user_id",
      "approved_at": "ISO8601"
    },

    "cost_summary": {
      "strategy_cost": 0.10,
      "script_cost": 0.15,
      "production_cost": 2.45,
      "total_cost": 2.70
    },

    "ready_for_distribution": true
  }
}
```

---

# SECTION 7: PILLAR 5 - THE BROADCASTER

**Mandate:** The Delivery Mechanism. High stakes—one mistake is public.

**Objective:** Implement last-moment abort capability, respect platform rate limits, verify successful posting, and track initial performance.

---

## 7.1 Sub-System: The "Last Mile" Kill Switch

### Concept

Just because content was approved yesterday doesn't mean it should post today. A sudden PR crisis, breaking news, or discovered error must be stoppable instantly.

### Implementation Architecture

**Pre-Upload Check Sequence:**

```
1. Wake up at Scheduled Time
2. Query: SELECT emergency_stop FROM campaigns WHERE id = $id
3. IF emergency_stop = TRUE → Abort immediately, log "Emergency Halt"
4. Query: SELECT status FROM campaigns WHERE id = $id
5. IF status != 'ready' → Abort (race condition protection)
6. Proceed with upload
```

**Kill Switch Implementation:**

- Database field: `campaigns.emergency_stop` (BOOLEAN, default FALSE)
- Timestamp: `campaigns.emergency_stop_at`
- Actor: `campaigns.emergency_stop_by` (user_id)
- Reason: `campaigns.emergency_stop_reason` (TEXT)

**Global Kill Switch:**

```sql
UPDATE campaigns
SET emergency_stop = true,
    emergency_stop_at = NOW(),
    emergency_stop_reason = 'Global emergency halt'
WHERE status IN ('ready', 'distributing');
```

**UI Integration:**
Dashboard exposes prominent red "EMERGENCY STOP" button. Requires confirmation. Logs action with user_id.

---

## 7.2 Sub-System: Intelligent Rate-Limit Throttling

### Concept

Social platform APIs enforce rate limits aggressively. Burst uploads get IP blocked. We must be polite.

### Implementation Architecture

**Split-in-Batches Pattern:**
Use batch size of 1 to enforce sequential uploads with rate checking between each.

**Header Parsing:**
After each API response, extract:

- `x-ratelimit-remaining`: Requests left in window
- `x-ratelimit-reset`: Unix timestamp when window resets
- `Retry-After`: Seconds to wait (if rate limited)

**Dynamic Sleep Calculation:**

```
IF remaining < 10:
    sleep_time = (reset_timestamp - now) + 1 second buffer
ELSE IF remaining < 50:
    sleep_time = 2 seconds (light throttle)
ELSE:
    sleep_time = 0 (proceed immediately)

IF Retry-After header present:
    sleep_time = Retry-After value
```

**Rate State Tracking (Redis):**

```
rate_limit:tiktok:remaining = 45
rate_limit:tiktok:reset_at = 1703289600
rate_limit:instagram:remaining = 22
rate_limit:instagram:reset_at = 1703289300
```

Multiple workflows coordinate using shared Redis state.

---

## 7.3 Sub-System: Proof of Execution (The Screenshot)

### Concept

The API returned 200 OK—but did the post actually go live? Trust but verify.

### Implementation Architecture

**Verification Steps:**

1. Get permalink URL from API response
2. Wait 30 seconds (allow platform propagation)
3. Launch Puppeteer headless browser
4. Navigate to permalink
5. Check for "Post deleted" or 404 indicators
6. If live: Capture screenshot
7. Store screenshot to Supabase as verification proof
8. Update campaign with `verification_screenshot_url`

**Failure Indicators:**

- Page shows "Content not available"
- Page shows login/age gate
- Page returns 404
- Page content doesn't match expected

**On Failure:**

1. Log verification failure
2. Alert operations
3. Mark campaign as "post_failed" or "needs_verification"

---

## 7.4 Sub-System: Post-Mortem Performance Monitor

### Concept

Short-term feedback loop: Did the post actually get engagement, or was it shadowbanned?

### Implementation Architecture

**Scheduled Check:**
Create delayed workflow trigger for T+24 hours from post time.

**Metrics Fetch:**
Query platform API for:

- Views / Impressions
- Likes / Reactions
- Comments
- Shares / Retweets
- Saves

**Performance Snapshot:**

```json
{
  "campaign_id": "uuid",
  "platform": "tiktok",
  "captured_at": "ISO8601 (24h post-publish)",
  "metrics": {
    "views": 1250,
    "likes": 89,
    "comments": 12,
    "shares": 5
  },
  "engagement_rate": 0.0848,
  "status": "normal|underperforming|potential_shadowban"
}
```

**Alert Thresholds:**

- views == 0 after 24h → "Shadowbanned" or "Failed Post" alert
- engagement_rate < 0.01 → "Underperforming" flag
- views > 10x average → "Viral" flag (positive alert)

---

## 7.5 Sub-System: Token Refresh Handler

### Concept

OAuth tokens expire. A 401 mid-upload is common. We must handle gracefully.

### Implementation Architecture

**Token Storage:**

```json
{
  "platform": "tiktok",
  "user_id": "uuid",
  "access_token": "encrypted",
  "refresh_token": "encrypted",
  "expires_at": "ISO8601",
  "last_refreshed_at": "ISO8601"
}
```

**Pre-Check:**
Before upload, verify token not expired:

```
IF token.expires_at < NOW() + 5 minutes:
    Trigger token refresh
```

**401 Handler:**

1. Catch 401 Unauthorized response
2. Trigger Token Refresh sub-workflow
3. Fetch new access token using refresh token
4. Update token in database
5. **Retry the upload** with new token
6. If refresh fails → Alert "Token Revoked", pause platform uploads

---

## 7.6 Pillar 5: Output Schema

```json
{
  "distribution_result": {
    "campaign_id": "uuid",

    "platforms": [
      {
        "platform": "tiktok",
        "status": "published",
        "post_id": "platform-post-id",
        "post_url": "https://tiktok.com/...",
        "published_at": "ISO8601",
        "verification": {
          "verified": true,
          "screenshot_url": "...",
          "verified_at": "ISO8601"
        }
      },
      {
        "platform": "instagram",
        "status": "scheduled",
        "scheduled_for": "ISO8601"
      }
    ],

    "rate_limit_state": {
      "tiktok": { "remaining": 42, "reset_at": "ISO8601" },
      "instagram": { "remaining": 18, "reset_at": "ISO8601" }
    },

    "distribution_metadata": {
      "started_at": "ISO8601",
      "completed_at": "ISO8601",
      "execution_id": "n8n-exec-id"
    }
  }
}
```

---

# SECTION 8: DATABASE SCHEMA SPECIFICATIONS

## 8.1 Core Tables

### campaigns

```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    brand_id UUID NOT NULL REFERENCES brands(id),

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'idea',
    -- Values: idea, strategizing, scripting, rendering, verifying,
    --         scheduled, published, failed, paused

    stage_metadata JSONB DEFAULT '{}',

    -- Locking
    locked_by TEXT,
    locked_at TIMESTAMPTZ,
    lock_version INTEGER DEFAULT 0,

    -- Emergency controls
    emergency_stop BOOLEAN DEFAULT FALSE,
    emergency_stop_at TIMESTAMPTZ,
    emergency_stop_by UUID,
    emergency_stop_reason TEXT,

    -- Asset references
    brief_id UUID,
    script_id UUID,
    video_id UUID,

    -- Approval
    requires_approval BOOLEAN DEFAULT TRUE,
    approved_by UUID,
    approved_at TIMESTAMPTZ,

    -- Distribution
    target_platforms TEXT[],
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,

    -- Metadata
    content_hash TEXT,
    error_log JSONB[] DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_user ON campaigns(user_id);
CREATE INDEX idx_campaigns_locked ON campaigns(locked_by, locked_at);
```

### cost_ledger

```sql
CREATE TABLE cost_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Attribution
    campaign_id UUID REFERENCES campaigns(id),
    workflow_execution_id TEXT NOT NULL,
    step_name TEXT NOT NULL,

    -- Provider details
    provider TEXT NOT NULL,
    model TEXT NOT NULL,

    -- Usage metrics
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    units_consumed DECIMAL(10,4),

    -- Cost
    cost_usd DECIMAL(10,6) NOT NULL,

    -- Idempotency
    idempotency_key TEXT UNIQUE NOT NULL,

    -- Metadata
    purpose TEXT,
    metadata JSONB,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_campaign ON cost_ledger(campaign_id);
CREATE INDEX idx_cost_provider ON cost_ledger(provider);
CREATE INDEX idx_cost_idempotency ON cost_ledger(idempotency_key);
```

### generation_jobs

```sql
CREATE TABLE generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    campaign_id UUID REFERENCES campaigns(id),
    script_id UUID,
    scene_id UUID,

    -- Provider
    provider TEXT NOT NULL,
    provider_job_id TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'queued',
    -- Values: queued, submitted, processing, completed, failed, timeout

    -- Locking
    locked_by TEXT,
    locked_at TIMESTAMPTZ,

    -- Job details
    prompt TEXT NOT NULL,
    parameters JSONB,

    -- Timing
    submitted_at TIMESTAMPTZ,
    expected_completion TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_polled_at TIMESTAMPTZ,

    -- Results
    result_url TEXT,
    internal_url TEXT,

    -- Errors
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Cost
    cost_usd DECIMAL(10,6),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON generation_jobs(status);
CREATE INDEX idx_jobs_campaign ON generation_jobs(campaign_id);
CREATE INDEX idx_jobs_polling ON generation_jobs(status, last_polled_at);
```

---

# SECTION 9: API CONTRACT DEFINITIONS

## 9.1 Webhook: Trigger Strategy Generation

**Endpoint:** `POST /webhook/trigger-strategy`

**Request:**

```json
{
  "user_id": "uuid",
  "campaign_id": "uuid",
  "intent": "generate_new",
  "context": {
    "industry": "Tech",
    "focus_topic": "AI Agents",
    "excluded_keywords": ["Crypto", "NFT"]
  },
  "config": {
    "temperature": 0.7,
    "model": "gpt-4o"
  }
}
```

**Response (Immediate):**

```json
{
  "status": "accepted",
  "execution_id": "n8n-exec-12345",
  "message": "Strategy generation started."
}
```

## 9.2 Webhook: Submit Video Job

**Endpoint:** `POST /webhook/submit-video-job`

**Request:**

```json
{
  "campaign_id": "uuid",
  "script_id": "uuid",
  "scenes": [
    {
      "scene_id": "uuid",
      "visual_prompt": "...",
      "duration": 5,
      "priority": 1
    }
  ],
  "config": {
    "budget_tier": "premium",
    "preferred_provider": "sora"
  }
}
```

## 9.3 Webhook: Approval Received

**Endpoint:** `POST /webhook/approval-received`

**Request:**

```json
{
  "campaign_id": "uuid",
  "decision": "approved|rejected",
  "approved_by": "user_id",
  "feedback": "Optional feedback text",
  "signature": "HMAC signature for verification"
}
```

## 9.4 Standard Error Response

```json
{
  "error": true,
  "code": "ERR_PILLAR_2_LLM_TIMEOUT",
  "message": "The LLM failed to respond after 3 retries.",
  "workflow_node": "Generate Script Node",
  "retryable": true,
  "context": {
    "generation_attempt": 3,
    "last_error": "Connection timeout"
  }
}
```

---

# SECTION 10: FAILURE MATRIX & AUTO-RESPONSE PROTOCOLS

| Error Code                | Component | Description               | Auto-Response                            |
| ------------------------- | --------- | ------------------------- | ---------------------------------------- |
| `ERR_SEARCH_ZERO_RESULTS` | Pillar 1  | Scraper found nothing     | Broaden search, remove 1 keyword, retry  |
| `ERR_LLM_HALLUCINATION`   | Pillar 1  | Validation score < 0.7    | Retry with temperature +0.2, log failure |
| `ERR_LLM_REFUSAL`         | Pillar 2  | Safety filter triggered   | Terminate, mark "Flagged", alert admin   |
| `ERR_SCRIPT_TOO_LONG`     | Pillar 2  | Script > 60s reading time | Prompt "Make it shorter", retry          |
| `ERR_VIDEO_PROVIDER_429`  | Pillar 3  | Rate limited              | Exponential backoff (1m, 5m, 15m)        |
| `ERR_VIDEO_PROVIDER_500`  | Pillar 3  | Server error              | Exponential backoff, try backup provider |
| `ERR_ASSET_404`           | Pillar 4  | Asset missing             | Trigger regeneration workflow            |
| `ERR_ASSET_CORRUPT`       | Pillar 4  | Zero-byte file            | Delete, regenerate, alert ops            |
| `ERR_PLATFORM_AUTH`       | Pillar 5  | Token invalid             | Refresh token, retry once                |
| `ERR_PLATFORM_REJECT`     | Pillar 5  | Content policy violation  | Mark "Failed", do not retry, alert user  |
| `ERR_DB_LOCK_TIMEOUT`     | Global    | Could not acquire lock    | Retry immediately (up to 3x)             |
| `ERR_ZOMBIE_DETECTED`     | Monitor   | Process dead > 1hr        | Reset to 'pending_retry'                 |
| `ERR_CIRCUIT_OPEN`        | Global    | Provider circuit tripped  | Queue for later, use backup              |
| `ERR_BUDGET_EXCEEDED`     | Global    | Campaign over budget      | Pause, alert user, require approval      |

---

# SECTION 11: PROMPT ENGINEERING LIBRARY

## 11.1 The Strategist Persona

```
ROLE: You are the Chief Strategy Officer for [Brand Name].

TASK: Analyze the provided real-time trends and cross-reference them with our Brand Guidelines.

CONTEXT:
- Brand Voice: [Tone from brand_context]
- Target Audience: [Demographics]
- Restricted Topics: [List from brand guidelines]

CONSTRAINT: Do not suggest trends that are political, religious, or controversial unless explicitly approved.

OUTPUT: Valid JSON only. No markdown. No explanation.

FORMAT:
{
  "trends": [
    {
      "topic": "string",
      "relevance_score": 0-100,
      "connection_angle": "How this trend connects to our brand",
      "risk_level": "low|medium|high"
    }
  ],
  "recommended_trend": 0,
  "rationale": "Why this trend is the best choice"
}
```

## 11.2 The Copywriter Persona

```
ROLE: You are a Viral Scriptwriter for TikTok/Reels with 10M+ views track record.

TASK: Write a [DURATION]-second script based on the provided strategy brief.

BRAND VOICE: [Inject tone variables here]

STRUCTURE:
1. The Hook (0-3s): Must stop the scroll. Use curiosity gap or pattern interrupt.
2. The Value (3-[X]s): Deliver the core insight. Be specific, not generic.
3. The CTA ([X]-end): Tell them exactly what to do. Make it urgent.

RULES:
- No filler words ("um", "so", "like")
- No generic phrases ("In today's world", "As we all know")
- Maximum 150 words for 30-second script

OUTPUT FORMAT: JSON array of scenes with visual_prompt, voiceover_text, duration_seconds
```

## 11.3 The Critic Persona

```
ROLE: You are a harsh Senior Editor at a viral content agency.

TASK: Grade the following script on a scale of 0-100.

RUBRIC:
1. Hook (30%): Does it stop the scroll in 0-3 seconds? Is it visual?
2. Value (25%): Is the insight clear, specific, and actionable?
3. CTA (20%): Is it obvious what to do next? Is there urgency?
4. Brand Voice (15%): Does it match our tone? [Reference examples]
5. Conciseness (10%): No wasted words? Reading time under [X] seconds?

OUTPUT:
{
  "score": 0-100,
  "breakdown": {
    "hook": 0-30,
    "value": 0-25,
    "cta": 0-20,
    "brand_voice": 0-15,
    "conciseness": 0-10
  },
  "critique": "Specific feedback on what's wrong",
  "improved_hook": "Rewritten hook suggestion (if score < 85)"
}
```

---

# SECTION 12: OPERATIONAL RUNBOOKS

## 12.1 Runbook: Global System Pause

**Trigger:** Massive logical error, offensive content posted, security breach

**Immediate Actions (< 5 min):**

1. Set `global_settings.emergency_shutdown = TRUE` in database
2. n8n: Deactivate all triggers via n8n management API
3. UI: Display "Maintenance Mode" banner
4. Alert all stakeholders via Slack/PagerDuty

**Investigation:**

1. Identify source of incident
2. Assess blast radius (how many campaigns affected?)
3. Determine if content needs removal from platforms

**Recovery:**

1. Fix root cause
2. Test in staging environment
3. Re-enable triggers one by one
4. Monitor first 10 executions closely

## 12.2 Runbook: Circuit Breaker Recovery

**Trigger:** Circuit breaker stuck in OPEN for > 30 minutes

**Investigation:**

1. Check Redis: `GET circuit_breaker:{provider}:consecutive_failures`
2. Review n8n execution logs for the provider
3. Check provider status page for outages
4. Review error messages for root cause

**Resolution:**

1. If provider outage: Wait for recovery
2. If config issue: Fix config, manually reset: `SET circuit_breaker:{provider}:consecutive_failures 0`
3. If credentials expired: Rotate credentials, reset circuit

**Verification:**
Monitor next 10 executions for success before closing incident.

## 12.3 Runbook: Stuck Campaign Recovery

**Trigger:** Campaign in 'processing' for > 24 hours

**Investigation:**

1. Query `generation_jobs` for campaign's active jobs
2. Check job statuses and last_polled_at timestamps
3. Identify where the pipeline stalled

**Resolution:**

1. If jobs stuck: Force status reset, re-queue
2. If polling failed: Restart polling workflow
3. If lock contention: Check locked_by, release if stale
4. Document manual intervention in campaign notes

---

# SECTION 13: DATA GOVERNANCE & COMPLIANCE

## 13.1 Data Classification

| Classification   | Examples                              | Handling                        |
| ---------------- | ------------------------------------- | ------------------------------- |
| **CONFIDENTIAL** | API keys, OAuth tokens, brand secrets | Encrypted at rest, no logs      |
| **INTERNAL**     | Campaign content (pre-publish), costs | Access-controlled, audit logged |
| **PUBLIC**       | Published content, public metrics     | Standard handling               |

## 13.2 Retention Policies

| Data Type           | Retention | After Retention         |
| ------------------- | --------- | ----------------------- |
| Execution logs      | 30 days   | Compress and archive    |
| Cost ledger (raw)   | 90 days   | Aggregate, delete raw   |
| Published campaigns | 1 year    | Archive to cold storage |
| Audit trails        | 7 years   | Permanent archive       |
| Failed attempts     | 30 days   | Delete                  |

## 13.3 GDPR/CCPA Compliance

**Right to Deletion:**
When user account deleted, cascade delete must clean:

- Database records (campaigns, scripts, costs)
- Storage assets (videos, thumbnails)
- Vector embeddings
- Logs (anonymize or delete)

**Audit Logging:**
Every manual override logged with:

- Admin user ID
- Timestamp
- Action taken
- Reason provided

---

# SECTION 14: IMPLEMENTATION ROADMAP

## Phase 4.1: The Spine (Days 1-2)

**Deliverables:**

- Database schema deployed
- n8n credentials configured
- Basic "Hello World" flow: API → n8n → Supabase → API callback
- Redis connection established
- Cost ledger logging working

**Validation:**
End-to-end ping test successful

## Phase 4.2: The Brain (Days 3-5)

**Deliverables:**

- Pillar 1: Strategist workflow complete
- Pillar 2: Copywriter workflow complete
- Manual trigger only (no cron)
- Hallucination gate functional
- Cost tracking for LLM calls

**Validation:**
Generate creative brief → script from webhook trigger

## Phase 4.3: The Factory (Days 6-8)

**Deliverables:**

- Pillar 3: Production House complete
- Job ticket lifecycle working
- Polling pattern functional
- Circuit breakers implemented
- Multi-vendor routing active

**Validation:**
Script → video asset generation end-to-end

## Phase 4.4: The Mouth (Days 9-10)

**Deliverables:**

- Pillar 4: Campaign Manager complete
- Pillar 5: Broadcaster complete
- Asset verification working
- Rate limiting functional
- Kill switch implemented

**Validation:**
Full pipeline: brief → script → video → post (test accounts only)

## Phase 4.5: The Autonomy (Day 11+)

**Deliverables:**

- Cron triggers enabled
- Approval workflows connected
- Monitoring dashboards deployed
- Runbooks tested
- Human-in-the-loop locks gradually removed

**Validation:**
Fully autonomous campaign generation on schedule

---

# SECTION 15: n8n WORKFLOW IMPLEMENTATION MATRIX

This section provides the concrete implementation blueprint for all n8n workflows required by the Brand Infinity Engine Phase 4 orchestration layer.

---

## 15.1 Main Workflows (12 Total)

| #   | Workflow Name             | Trigger          | Est. Nodes | Purpose                                                                      |
| --- | ------------------------- | ---------------- | ---------- | ---------------------------------------------------------------------------- |
| 1   | `Strategist_Main`         | Webhook          | 35-45      | Trend scraping, RAG retrieval, hallucination gate, creative brief generation |
| 2   | `Copywriter_Main`         | Webhook          | 40-50      | Script generation, recursive critic loop, hook engine, brand safety filter   |
| 3   | `Production_Dispatcher`   | Webhook          | 25-30      | Job submission, multi-vendor routing, concurrency throttling                 |
| 4   | `Production_Poller`       | Cron (1 min)     | 20-25      | Status checks, completion detection, timeout handling                        |
| 5   | `Production_Downloader`   | Webhook          | 15-20      | Asset download, Supabase storage upload, verification                        |
| 6   | `Video_Assembly`          | Webhook          | 20-25      | Scene concatenation, voiceover sync, format variants                         |
| 7   | `Campaign_Verifier`       | Webhook          | 25-30      | Asset verification (HEAD requests), platform compliance checks               |
| 8   | `Broadcaster_Main`        | Webhook/Schedule | 30-40      | Platform uploads, rate limiting, kill switch checks                          |
| 9   | `Zombie_Reaper`           | Cron (1 hour)    | 10-15      | Stuck campaign detection and recovery                                        |
| 10  | `Approval_Handler`        | Webhook          | 10-15      | Process approval/rejection from dashboard                                    |
| 11  | `Performance_Monitor`     | Cron (daily)     | 15-20      | 24-hour post-publish metrics collection                                      |
| 12  | `Circuit_Breaker_Monitor` | Cron (5 min)     | 8-12       | Provider health checks, HALF_OPEN recovery testing                           |

---

## 15.2 Sub-Workflows (8 Reusable Modules)

These sub-workflows are called by main workflows via the "Execute Workflow" node. They must be built FIRST before main workflows.

| #   | Sub-Workflow             | Called By                    | Est. Nodes | Purpose                                         |
| --- | ------------------------ | ---------------------------- | ---------- | ----------------------------------------------- |
| 1   | `Log_Cost_Event`         | All main workflows           | 5-8        | Standardized cost ledger entry with idempotency |
| 2   | `Check_Circuit_Breaker`  | Production, Broadcaster      | 6-10       | Redis-based circuit state check                 |
| 3   | `Acquire_Lock`           | All state-changing workflows | 4-6        | Atomic row locking with UPDATE...RETURNING      |
| 4   | `Release_Lock`           | All state-changing workflows | 3-5        | Lock release with cleanup                       |
| 5   | `Validate_Schema`        | All webhook entry points     | 4-6        | JSON schema validation, early rejection         |
| 6   | `Get_Brand_Context`      | Strategist, Copywriter       | 8-12       | RAG retrieval from brand_knowledge_base         |
| 7   | `Refresh_Platform_Token` | Broadcaster                  | 8-12       | OAuth token refresh with retry                  |
| 8   | `Send_Alert`             | All workflows                | 5-8        | Slack/email notification dispatch               |

---

## 15.3 Implementation Summary

| Category       | Count            | Total Nodes       |
| -------------- | ---------------- | ----------------- |
| Main Workflows | 12               | 250-310           |
| Sub-Workflows  | 8                | 45-70             |
| **TOTAL**      | **20 workflows** | **295-380 nodes** |

---

## 15.4 Node Composition (Typical Heavy Workflow)

A typical "heavy" workflow like `Copywriter_Main` (40-50 nodes) includes:

| Node Type               | Count | Purpose                                |
| ----------------------- | ----- | -------------------------------------- |
| Webhook Trigger         | 1     | Entry point                            |
| Schema Validation       | 2-3   | Input verification                     |
| Supabase Read           | 1-2   | Load context/state                     |
| HTTP Request (LLM)      | 3-4   | OpenAI/Anthropic API calls             |
| Code Node               | 5-6   | Data transformation, cost calculation  |
| If/Switch               | 4-5   | Branching logic (critic score, safety) |
| Merge                   | 2-3   | Parallel flow convergence              |
| Set                     | 3-4   | Data shaping for next node             |
| Supabase Write          | 2-3   | State persistence                      |
| Execute Workflow        | 1-2   | Sub-workflow calls                     |
| Error Handler           | 2-3   | Fallback branches                      |
| HTTP Request (Callback) | 1-2   | Webhook notifications                  |

---

## 15.5 Complexity Distribution

| Complexity       | Workflows | Nodes Each | Examples                                           |
| ---------------- | --------- | ---------- | -------------------------------------------------- |
| **Heavy**        | 3         | 35-50      | Strategist, Copywriter, Broadcaster                |
| **Medium**       | 5         | 20-30      | Dispatcher, Poller, Verifier, Assembly, Downloader |
| **Light**        | 4         | 8-15       | Reaper, Approval, Monitor, Circuit                 |
| **Sub-workflow** | 8         | 4-12       | All reusable modules                               |

---

## 15.6 Build Order

Sub-workflows must be built before main workflows that depend on them:

**Week 1:**

1. `Log_Cost_Event` (required by all)
2. `Acquire_Lock` / `Release_Lock` (required by all state changes)
3. `Validate_Schema` (required by all webhooks)
4. `Send_Alert` (required by error handlers)

**Week 2:** 5. `Check_Circuit_Breaker` (required by Production, Broadcaster) 6. `Get_Brand_Context` (required by Strategist, Copywriter) 7. `Refresh_Platform_Token` (required by Broadcaster)

**Week 3+:** 8. Main workflows in roadmap order (Strategist → Copywriter → Production → Campaign → Broadcaster)

---

# CONCLUSION

This Implementation Bible represents the complete specification for Phase 4 of the Brand Infinity Engine. It merges the creative vision of an inspiring manifesto with the engineering rigor of a production-ready specification.

Every component is designed for anti-fragility—the system improves under stress. Every failure mode has an explicit recovery path. Every cost is tracked to six decimal places. Every state transition is atomic and verifiable.

The five pillars work in concert:

1. **Strategist** finds the opportunity
2. **Copywriter** crafts the message
3. **Production House** builds the asset
4. **Campaign Manager** ensures quality
5. **Broadcaster** delivers to audience

With this document, an engineer should be able to implement Phase 4 from first principles. With this document, an operator should be able to troubleshoot any failure. With this document, a leader should be able to trust the system.

**The machine that builds brands is ready to be built.**

---

**[END OF IMPLEMENTATION BIBLE]**

**Total Sections:** 15  
**Total Lines:** 2,879+  
**Document Status:** COMPLETE
