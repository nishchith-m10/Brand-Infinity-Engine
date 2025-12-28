# 📋 MASTER NODE CONFIGURATION GUIDE

> **Brand Infinity Engine - Phase 4**
> Complete manual configuration reference for all 20 n8n workflows
> **Verified Structure (Detailed n8n UI Tables)**

This document lists **every node that requires manual configuration** across all workflows. For each node, you'll find the exact settings to enter in the n8n UI.

---

## 🔑 Required Credentials (Create These First)

| Credential Name       | Type             | Used By                       |
| :-------------------- | :--------------- | :---------------------------- |
| **Supabase API**      | Supabase         | All Supabase nodes            |
| **Supabase Postgres** | PostgreSQL       | All Postgres nodes            |
| **Redis**             | Redis            | Circuit breaker, caching      |
| **OpenRouter API**    | HTTP Header Auth | LLM calls (OpenAI/OpenRouter) |
| **Gmail**             | Gmail OAuth2     | Email alerts                  |

---

# 🟢 PHASE 1: SUB-WORKFLOWS (8 Total)

---

## 1. Sub: Log Cost Event

### Node: "Check Idempotency Key"

| Field                 | Value                                                         |
| :-------------------- | :------------------------------------------------------------ |
| **Credential**        | `Supabase API`                                                |
| **Operation**         | `Get Many`                                                    |
| **Table**             | `idempotency_keys`                                            |
| **Return All**        | `false`                                                       |
| **Limit**             | `1`                                                           |
| **Filter - Column**   | `key`                                                         |
| **Filter - Operator** | `Equal`                                                       |
| **Filter - Value**    | `={{ $('Validate Cost Data').first().json.idempotency_key }}` |

### Node: "Insert Cost Record"

| Field          | Value          |
| :------------- | :------------- |
| **Credential** | `Supabase API` |
| **Operation**  | `Create`       |
| **Table**      | `cost_ledger`  |
| **Columns**    | `Define Below` |

| Column                  | Expression                                                          |
| :---------------------- | :------------------------------------------------------------------ |
| `provider`              | `={{ $('Validate Cost Data').first().json.provider }}`              |
| `model`                 | `={{ $('Validate Cost Data').first().json.model }}`                 |
| `tokens_in`             | `={{ $('Validate Cost Data').first().json.tokens_in }}`             |
| `tokens_out`            | `={{ $('Validate Cost Data').first().json.tokens_out }}`            |
| `cost_usd`              | `={{ $('Validate Cost Data').first().json.cost_usd }}`              |
| `idempotency_key`       | `={{ $('Validate Cost Data').first().json.idempotency_key }}`       |
| `units_consumed`        | `={{ $('Validate Cost Data').first().json.units_consumed }}`        |
| `step_name`             | `={{ $('Validate Cost Data').first().json.step_name }}`             |
| `workflow_execution_id` | `={{ $('Validate Cost Data').first().json.workflow_execution_id }}` |
| `campaign_id`           | `={{ $('Validate Cost Data').first().json.campaign_id }}`           |
| `metadata`              | `={{ $('Validate Cost Data').first().json.metadata }}`              |

### Node: "Store Idempotency Key"

| Field          | Value              |
| :------------- | :----------------- |
| **Credential** | `Supabase API`     |
| **Operation**  | `Create`           |
| **Table**      | `idempotency_keys` |
| **Columns**    | `Define Below`     |

| Column             | Expression                      |
| :----------------- | :------------------------------ |
| `key`              | `={{ $json.key }}`              |
| `response_payload` | `={{ $json.response_payload }}` |

---

## 2. Sub: Acquire Lock

### Node: "Execute Atomic Lock"

| Field          | Value                           |
| :------------- | :------------------------------ |
| **Credential** | `Supabase Postgres`             |
| **Operation**  | `Execute Query`                 |
| **Query**      | `={{ $json.lock_query.query }}` |

> ✅ **No table/column config needed** - Query is built dynamically in code node.

---

## 3. Sub: Release Lock

### Node: "Execute Lock Release"

| Field          | Value                              |
| :------------- | :--------------------------------- |
| **Credential** | `Supabase Postgres`                |
| **Operation**  | `Execute Query`                    |
| **Query**      | `={{ $json.release_query.query }}` |

---

## 4. Sub: Get Brand Context

### Node: "Check Cache"

| Field          | Value                    |
| :------------- | :----------------------- |
| **Credential** | `Redis`                  |
| **Operation**  | `Get`                    |
| **Key**        | `={{ $json.cache_key }}` |

### Node: "Get Brand Profile"

| Field                 | Value                                             |
| :-------------------- | :------------------------------------------------ |
| **Credential**        | `Supabase API`                                    |
| **Operation**         | `Get Many`                                        |
| **Table**             | `brand_guidelines`                                |
| **Return All**        | `false`                                           |
| **Limit**             | `1`                                               |
| **Filter - Column**   | `brand_id`                                        |
| **Filter - Operator** | `Equal`                                           |
| **Filter - Value**    | `={{ $('Prepare Query').first().json.brand_id }}` |

### Node: "Get Knowledge Base"

| Field          | Value                                                                                                                                                                                                         |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Credential** | `Supabase Postgres`                                                                                                                                                                                           |
| **Operation**  | `Execute Query`                                                                                                                                                                                               |
| **Query**      | `SELECT content, category, similarity FROM brand_knowledge_base WHERE brand_id = '{{ $('Prepare Query').first().json.brand_id }}' ORDER BY created_at DESC LIMIT {{ $('Prepare Query').first().json.limit }}` |

### Node: "Store in Cache"

| Field          | Value                                        |
| :------------- | :------------------------------------------- |
| **Credential** | `Redis`                                      |
| **Operation**  | `Set`                                        |
| **Key**        | `={{ $json.cache_key }}`                     |
| **Value**      | `={{ JSON.stringify($json.brand_context) }}` |
| **Key Type**   | `String`                                     |
| **Expire**     | `true`                                       |
| **TTL**        | `={{ $json.cache_ttl }}`                     |

---

## 5. Sub: Check Circuit Breaker

### Node: "Get Circuit State"

| Field          | Value                            |
| :------------- | :------------------------------- |
| **Credential** | `Redis`                          |
| **Operation**  | `Get`                            |
| **Key**        | `={{ $json.redis_keys.status }}` |

### Node: "Update Circuit Status"

| Field          | Value                            |
| :------------- | :------------------------------- |
| **Credential** | `Redis`                          |
| **Operation**  | `Set`                            |
| **Key**        | `={{ $json.redis_keys.status }}` |
| **Value**      | `={{ $json.current_status }}`    |
| **Key Type**   | `String`                         |
| **Expire**     | `true`                           |
| **TTL**        | `3600`                           |

---

## 6. Sub: Validate Schema

> ✅ **No database nodes** - All logic is in code nodes. No configuration needed.

---

## 7. Sub: Send Alert

### Node: "Send Gmail Alert"

| Field           | Value                                                                                |
| :-------------- | :----------------------------------------------------------------------------------- |
| **Credential**  | `Gmail`                                                                              |
| **Email Type**  | `Send`                                                                               |
| **To**          | Your admin email                                                                     |
| **Subject**     | `=[{{ $json.severity.toUpperCase() }}] Brand Infinity Alert: {{ $json.alert_type }}` |
| **Body (HTML)** | `={{ $json.html_body }}`                                                             |

### Node: "Log Alert to DB"

| Field          | Value            |
| :------------- | :--------------- |
| **Credential** | `Supabase API`   |
| **Operation**  | `Create`         |
| **Table**      | `execution_logs` |
| **Columns**    | `Define Below`   |

| Column         | Expression                  |
| :------------- | :-------------------------- |
| `workflow_id`  | `={{ $json.workflow_id }}`  |
| `execution_id` | `={{ $json.execution_id }}` |
| `step_name`    | `={{ $json.step_name }}`    |
| `status`       | `={{ $json.status }}`       |
| `details`      | `={{ $json.details }}`      |

---

## 8. Sub: Refresh Platform Token

### Node: "Get Current Token"

| Field          | Value                                                                                                                                                                |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Credential** | `Supabase Postgres`                                                                                                                                                  |
| **Operation**  | `Execute Query`                                                                                                                                                      |
| **Query**      | `SELECT access_token, refresh_token, expires_at, last_refreshed_at FROM platform_tokens WHERE platform = '{{ $json.platform }}' AND user_id = '{{ $json.user_id }}'` |

### Node: "Update Token in DB"

| Field          | Value                                                                                                                                                                                                                                                                                     |
| :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Credential** | `Supabase Postgres`                                                                                                                                                                                                                                                                       |
| **Operation**  | `Execute Query`                                                                                                                                                                                                                                                                           |
| **Query**      | `UPDATE platform_tokens SET access_token = '{{ $json.new_access_token }}', refresh_token = '{{ $json.new_refresh_token }}', expires_at = '{{ $json.new_expires_at }}', last_refreshed_at = NOW() WHERE platform = '{{ $json.platform }}' AND user_id = '{{ $json.user_id }}' RETURNING *` |

---

# 🔵 PHASE 2: MAIN WORKFLOWS (12 Total)

---

## 9. Pillar 1: Strategist Main

### Node: "Generate Strategy (LLM)"

| Field          | Value                                           |
| :------------- | :---------------------------------------------- |
| **Credential** | `OpenRouter API` (HTTP Header Auth)             |
| **Method**     | `POST`                                          |
| **URL**        | `https://openrouter.ai/api/v1/chat/completions` |

### Node: "Store Creative Brief"

| Field          | Value             |
| :------------- | :---------------- |
| **Credential** | `Supabase API`    |
| **Operation**  | `Create`          |
| **Table**      | `creative_briefs` |
| **Columns**    | `Define Below`    |

| Column             | Expression                      |
| :----------------- | :------------------------------ |
| `campaign_id`      | `={{ $json.campaign_id }}`      |
| `strategy_data`    | `={{ $json.strategy_data }}`    |
| `trend_data`       | `={{ $json.trend_data }}`       |
| `validation_score` | `={{ $json.validation_score }}` |
| `status`           | `={{ $json.status }}`           |

---

## 10. Pillar 2: Copywriter Main

### Node: "Load Creative Brief"

| Field                 | Value                        |
| :-------------------- | :--------------------------- |
| **Credential**        | `Supabase API`               |
| **Operation**         | `Get Many`                   |
| **Table**             | `creative_briefs`            |
| **Limit**             | `1`                          |
| **Filter - Column**   | `brief_id`                   |
| **Filter - Operator** | `Equal`                      |
| **Filter - Value**    | `={{ $json.body.brief_id }}` |

### Node: "Generate Script (LLM)"

| Field          | Value                                           |
| :------------- | :---------------------------------------------- |
| **Credential** | `OpenRouter API` (HTTP Header Auth)             |
| **Method**     | `POST`                                          |
| **URL**        | `https://openrouter.ai/api/v1/chat/completions` |

### Node: "Store Script"

| Field          | Value          |
| :------------- | :------------- |
| **Credential** | `Supabase API` |
| **Operation**  | `Create`       |
| **Table**      | `scripts`      |
| **Columns**    | `Define Below` |

| Column                   | Expression                                                                                                                  |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `brief_id`               | `={{ $json.brief_id }}`                                                                                                     |
| `hook`                   | `={{ $json.hook }}`                                                                                                         |
| `scenes`                 | `={{ $json.scenes }}`                                                                                                       |
| `voiceover_full_text`    | `={{ $json.hook }}`                                                                                                         |
| `total_duration_seconds` | `={{ $json.target_duration }}`                                                                                              |
| `brand_compliance_score` | `={{ $json.critic_score / 100 }}`                                                                                           |
| `approval_status`        | `={{ $json.status }}`                                                                                                       |
| `metadata`               | `={{ JSON.stringify({ campaign_id: $json.campaign_id, platform: $json.platform, script_content: $json.script_content }) }}` |

---

## 11. Video Assembly

### Node: "Fetch Scene Videos"

| Field          | Value                                                                                                                          |
| :------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| **Credential** | `Supabase Postgres`                                                                                                            |
| **Operation**  | `Execute Query`                                                                                                                |
| **Query**      | `SELECT * FROM generation_jobs WHERE campaign_id = '{{ $json.body.campaign_id }}' AND status = 'downloaded' ORDER BY scene_id` |

### Node: "Call Concat API"

| Field         | Value                          |
| :------------ | :----------------------------- |
| **Method**    | `POST`                         |
| **URL**       | `http://localhost:8080/concat` |
| **Send Body** | `true`                         |
| **Body Type** | `JSON`                         |
| **Timeout**   | `300000` (5 minutes)           |

> ⚠️ **Note:** The URL is a placeholder. Replace with your actual video processing API when ready.

### Node: "Store Final Video"

| Field          | Value          |
| :------------- | :------------- |
| **Credential** | `Supabase API` |
| **Operation**  | `Create`       |
| **Table**      | `videos`       |
| **Columns**    | `Define Below` |

| Column                    | Expression                      |
| :------------------------ | :------------------------------ | --- | -------- |
| `script_id`               | `={{ $json.script_id            |     | null }}` |
| `master_mp4_url`          | `={{ $json.video_url }}`        |
| `master_duration_seconds` | `={{ $json.duration_seconds }}` |
| `approval_status`         | `={{ $json.approval_status }}`  |
| `metadata`                | `={{ $json.metadata }}`         |

### Node: "Release Lock"

| Field           | Value               |
| :-------------- | :------------------ |
| **Workflow**    | `Sub: Release Lock` |
| **Workflow ID** | `4OwwpHBjkMYBzsuI`  |

> ✅ **No additional config needed** - Uses hardcoded workflow ID.

### Node: "Alert Failure"

| Field           | Value              |
| :-------------- | :----------------- |
| **Workflow**    | `Sub: Send Alert`  |
| **Workflow ID** | `uCTePCAfvuecs7La` |

> ✅ **No additional config needed** - Uses hardcoded workflow ID.

---

## 12. Approval Handler

### Node: "Check Pending Approval"

| Field          | Value                                                                                                               |
| :------------- | :------------------------------------------------------------------------------------------------------------------ |
| **Credential** | `Supabase Postgres`                                                                                                 |
| **Operation**  | `Execute Query`                                                                                                     |
| **Query**      | `SELECT * FROM campaigns WHERE id = '{{ $json.campaign_id }}' AND status = 'verified' AND requires_approval = true` |

### Node: "Approve Campaign"

| Field          | Value                                                                                                                                                                                                                                      |
| :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Credential** | `Supabase Postgres`                                                                                                                                                                                                                        |
| **Operation**  | `Execute Query`                                                                                                                                                                                                                            |
| **Query**      | `UPDATE campaigns SET status = 'approved', approved_by = '{{ $('Validate Input').first().json.approved_by }}', approved_at = NOW(), requires_approval = false WHERE id = '{{ $('Validate Input').first().json.campaign_id }}' RETURNING *` |

### Node: "Reject Campaign"

| Field          | Value                                                                                                                                                                                                                                                           |
| :------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Credential** | `Supabase Postgres`                                                                                                                                                                                                                                             |
| **Operation**  | `Execute Query`                                                                                                                                                                                                                                                 |
| **Query**      | `UPDATE campaigns SET status = 'rejected', stage_metadata = jsonb_set(COALESCE(stage_metadata, '{}'), '{rejection_feedback}', '"{{ $('Validate Input').first().json.feedback }}"') WHERE id = '{{ $('Validate Input').first().json.campaign_id }}' RETURNING *` |

> ✅ **All queries are pre-configured** - Just set the Postgres credential on each node.

---

## 13. Campaign Verifier

### Node: "Fetch Campaign Assets"

| Field           | Value                                         |
| :-------------- | :-------------------------------------------- |
| **Credential**  | `Supabase API`                                |
| **Operation**   | `Get Many`                                    |
| **Table**       | `videos`                                      |
| **Filter Type** | `String`                                      |
| **Filter**      | `campaign_id=eq.{{ $json.body.campaign_id }}` |
| **Limit**       | `10`                                          |

> ⚠️ **Note:** The filter uses Supabase's PostgREST syntax.

### Node: "Update Campaign Status"

| Field          | Value                                                                                                                 |
| :------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **Credential** | `Supabase Postgres`                                                                                                   |
| **Operation**  | `Execute Query`                                                                                                       |
| **Query**      | `UPDATE campaigns SET status = 'verified', requires_approval = true WHERE id = '{{ $json.campaign_id }}' RETURNING *` |

### Node: "Alert Failed"

| Field           | Value              |
| :-------------- | :----------------- |
| **Workflow**    | `Sub: Send Alert`  |
| **Workflow ID** | `uCTePCAfvuecs7La` |

> ✅ **No additional config needed** - Uses hardcoded workflow ID.

---

## 14. Production Dispatcher

### Node: "Load Script"

| Field           | Value                                                  |
| :-------------- | :----------------------------------------------------- |
| **Credential**  | `Supabase API`                                         |
| **Operation**   | `Get Many`                                             |
| **Table**       | `scripts`                                              |
| **Filter Type** | `String`                                               |
| **Filter**      | `id=eq.{{ $('Webhook').first().json.body.script_id }}` |
| **Limit**       | `1`                                                    |

### Node: "Submit to Provider"

| Field          | Value                            |
| :------------- | :------------------------------- |
| **Credential** | `Video API` (HTTP Header Auth)   |
| **Method**     | `={{ $json.api_config.method }}` |
| **URL**        | `={{ $json.api_config.url }}`    |
| **Body Type**  | `JSON`                           |
| **Timeout**    | `60000` (1 minute)               |

> ⚠️ **Note:** URL and method are set dynamically by the "Route to Provider" code node. This supports multiple video APIs (Sora, Runway, Pika, Kling). Set to MOCK_MODE=true in environment to skip real API calls.

### Node: "Store Job Record"

| Field          | Value             |
| :------------- | :---------------- |
| **Credential** | `Supabase API`    |
| **Operation**  | `Create`          |
| **Table**      | `generation_jobs` |
| **Columns**    | `Define Below`    |

| Column                | Expression                         |
| :-------------------- | :--------------------------------- |
| `campaign_id`         | `={{ $json.campaign_id }}`         |
| `script_id`           | `={{ $json.script_id }}`           |
| `scene_id`            | `={{ $json.scene_id }}`            |
| `provider`            | `={{ $json.provider }}`            |
| `provider_job_id`     | `={{ $json.provider_job_id }}`     |
| `status`              | `={{ $json.status }}`              |
| `prompt`              | `={{ $json.prompt }}`              |
| `submitted_at`        | `={{ $json.submitted_at }}`        |
| `expected_completion` | `={{ $json.expected_completion }}` |

### Node: "Store Failed Job"

| Field          | Value             |
| :------------- | :---------------- |
| **Credential** | `Supabase API`    |
| **Operation**  | `Create`          |
| **Table**      | `generation_jobs` |
| **Columns**    | `Define Below`    |

| Column          | Expression                   |
| :-------------- | :--------------------------- | --- | ------ |
| `campaign_id`   | `={{ $json.campaign_id }}`   |
| `script_id`     | `={{ $json.script_id }}`     |
| `scene_id`      | `={{ $json.scene_id }}`      |
| `provider`      | `={{ $json.provider }}`      |
| `status`        | `={{ $json.status }}`        |
| `error_message` | `={{ $json.error_message }}` |
| `prompt`        | `={{ $json.prompt            |     | "" }}` |

### Sub-workflow Calls (No Config Needed)

- **Validate Schema**: Workflow ID `y0c3JFOEAZFkvAjC`
- **Acquire Lock**: Workflow ID `lwHIR7PonbgLVkmJ`
- **Check Circuit Breaker**: Workflow ID `QOgvjzuDoykfiqvh`
- **Log Submission Cost**: Workflow ID `4OuxyvQvJ9GV3yD1`
- **Alert Failure**: Workflow ID `uCTePCAfvuecs7La`

---

## 15. Broadcaster Main

### Node: "Check Campaign & Kill Switch"

| Field          | Value                                                                                                                  |
| :------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **Credential** | `Supabase Postgres`                                                                                                    |
| **Operation**  | `Execute Query`                                                                                                        |
| **Query**      | `SELECT * FROM campaigns WHERE id = '{{ $json.body.campaign_id }}' AND status = 'approved' AND emergency_stop = false` |

### Node: "Check Rate Limit"

| Field          | Value                                                                  |
| :------------- | :--------------------------------------------------------------------- |
| **Credential** | `Redis`                                                                |
| **Operation**  | `Get`                                                                  |
| **Key**        | `rate_limit:{{ $('Loop Platforms').first().json.platform }}:remaining` |

> ⚠️ **Note:** This checks platform-specific rate limits stored in Redis.

### Node: "Store Post Record"

| Field          | Value            |
| :------------- | :--------------- |
| **Credential** | `Supabase API`   |
| **Operation**  | `Create`         |
| **Table**      | `platform_posts` |
| **Columns**    | `Define Below`   |

| Column                | Expression                    |
| :-------------------- | :---------------------------- |
| `publication_id`      | `={{ $json.publication_id }}` |
| `platform`            | `={{ $json.platform }}`       |
| `platform_post_id`    | `={{ $json.post_id }}`        |
| `formatted_video_url` | `={{ $json.video_url }}`      |
| `publication_status`  | `published`                   |
| `published_at`        | `={{ $json.published_at }}`   |

### Sub-workflow Calls (No Config Needed)

- **Acquire Lock**: Workflow ID `lwHIR7PonbgLVkmJ`
- **Refresh Token**: Workflow ID `kmsyq2wbESxLvETZ`
- **Release Lock**: Workflow ID `4OwwpHBjkMYBzsuI`
- **Alert Upload Failed**: Workflow ID `uCTePCAfvuecs7La`
- **Alert Token Failed**: Workflow ID `uCTePCAfvuecs7La`

> ⚠️ **Important:** This workflow requires platform OAuth tokens configured for TikTok/Instagram/YouTube/etc.

---

## 16. Zombie Reaper

### Node: "Find Stuck Campaigns"

| Field          | Value                                                                                               |
| :------------- | :-------------------------------------------------------------------------------------------------- |
| **Credential** | `Supabase Postgres`                                                                                 |
| **Operation**  | `Execute Query`                                                                                     |
| **Query**      | `SELECT * FROM campaigns WHERE locked_by IS NOT NULL AND locked_at < NOW() - INTERVAL '10 minutes'` |

### Node: "Reset Zombie Campaigns"

| Field          | Value                                 |
| :------------- | :------------------------------------ |
| **Credential** | `Supabase Postgres`                   |
| **Operation**  | `Execute Query`                       |
| **Query**      | Dynamic UPDATE based on found zombies |

---

## 17. Circuit Breaker Monitor

### Node: "Check All Circuit States"

| Field          | Value                  |
| :------------- | :--------------------- |
| **Credential** | `Redis`                |
| **Operation**  | `Get`                  |
| **Key**        | Pattern-based key scan |

---

## 18. Production Downloader

### Node: "Upload to Supabase" (HTTP Request Node)

| Field              | Value                                                                                                             |
| :----------------- | :---------------------------------------------------------------------------------------------------------------- |
| **Node Type**      | `HTTP Request`                                                                                                    |
| **Method**         | `POST`                                                                                                            |
| **URL**            | `{{ $env.SUPABASE_URL }}/storage/v1/object/campaign_assets/{{ $('Prepare Download').first().json.storage_path }}` |
| **Authentication** | `Generic Credential Type` → `Header Auth`                                                                         |
| **Header Name**    | `Authorization`                                                                                                   |
| **Header Value**   | `Bearer {{ $env.SUPABASE_SERVICE_KEY }}`                                                                          |
| **Send Body**      | Yes                                                                                                               |
| **Body Type**      | `Binary`                                                                                                          |
| **Input Binary**   | From previous node (Download from Provider)                                                                       |

> 💡 **Complete Node JSON** (replace the existing Supabase node with this):

```json
{
  "parameters": {
    "method": "POST",
    "url": "={{ $env.SUPABASE_URL }}/storage/v1/object/campaign_assets/{{ $('Prepare Download').first().json.storage_path }}",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "contentType": "raw",
    "rawContentType": "application/octet-stream",
    "options": {
      "redirect": {
        "redirect": {}
      }
    }
  },
  "name": "Upload to Supabase",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [900, 200],
  "credentials": {
    "httpHeaderAuth": {
      "id": "supabase-storage-auth",
      "name": "Supabase Storage Auth"
    }
  }
}
```

> ⚠️ **Important:** Create an HTTP Header Auth credential named "Supabase Storage Auth" with:
>
> - **Name:** `Authorization`
> - **Value:** `Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY`

### Node: "Update Job"

| Field          | Value                                                                                                                                     |
| :------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| **Credential** | `Supabase Postgres`                                                                                                                       |
| **Operation**  | `Execute Query`                                                                                                                           |
| **Query**      | `UPDATE generation_jobs SET internal_url = '{{ $json.internal_url }}', status = 'downloaded' WHERE id = '{{ $json.job_id }}' RETURNING *` |

> ⚠️ **Note:** This workflow downloads videos from providers and uploads to Supabase storage, then updates the database.

### Sub-workflow Calls (No Config Needed)

- **Alert Download Failed**: Workflow ID `uCTePCAfvuecs7La`
- **Alert Verify Failed**: Workflow ID `uCTePCAfvuecs7La`

---

## 19. Performance Monitor

### Node: "Get Cost Summary"

| Field          | Value                                                                                                                                                                                                                   |
| :------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Credential** | `Supabase Postgres`                                                                                                                                                                                                     |
| **Operation**  | `Execute Query`                                                                                                                                                                                                         |
| **Query**      | `SELECT pillar, provider, COUNT(*) as calls, SUM(cost_usd) as total_cost, AVG(cost_usd) as avg_cost FROM cost_ledger WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY pillar, provider ORDER BY total_cost DESC` |

### Node: "Get Campaign Stats"

| Field          | Value                                                                                                            |
| :------------- | :--------------------------------------------------------------------------------------------------------------- |
| **Credential** | `Supabase Postgres`                                                                                              |
| **Operation**  | `Execute Query`                                                                                                  |
| **Query**      | `SELECT status, COUNT(*) as count FROM campaigns WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY status` |

### Node: "Get Job Stats"

| Field          | Value                                                                                                                                                                                                               |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Credential** | `Supabase Postgres`                                                                                                                                                                                                 |
| **Operation**  | `Execute Query`                                                                                                                                                                                                     |
| **Query**      | `SELECT provider, status, COUNT(*) as count, AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at))) as avg_seconds FROM generation_jobs WHERE submitted_at > NOW() - INTERVAL '24 hours' GROUP BY provider, status` |

### Node: "Store Report"

| Field          | Value                  |
| :------------- | :--------------------- |
| **Credential** | `Supabase API`         |
| **Operation**  | `Create`               |
| **Table**      | `performance_reports`  |
| **Columns**    | Pre-mapped (5 columns) |

> ⚠️ **Note:** This workflow runs daily, generates performance reports from cost_ledger, campaigns, and generation_jobs tables. The `performance_reports` table needs to be created if it doesn't exist.

---

## 20. Production Poller (FINAL WORKFLOW)

### Node: "Fetch Pending Jobs"

| Field          | Value                                                                                                                                                         |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Credential** | `Supabase Postgres`                                                                                                                                           |
| **Operation**  | `Execute Query`                                                                                                                                               |
| **Query**      | `SELECT * FROM generation_jobs WHERE status IN ('submitted', 'processing') AND last_polled_at < NOW() - INTERVAL '30 seconds' ORDER BY submitted_at LIMIT 10` |

> ⚠️ **Note:** This query finds video generation jobs that haven't been polled recently (every 30 seconds minimum).

### Node: "Update Job Status"

| Field          | Value                          |
| :------------- | :----------------------------- |
| **Credential** | `Supabase Postgres`            |
| **Operation**  | `Execute Query`                |
| **Query**      | See below (too long for table) |

**Full Query:**

```sql
UPDATE generation_jobs
SET status = '{{ $json.new_status }}',
    last_polled_at = NOW(),
    result_url = {{ $json.result_url ? "'" + $json.result_url + "'" : 'result_url' }},
    error_message = {{ $json.error ? "'" + JSON.stringify($json.error) + "'" : 'error_message' }},
    completed_at = {{ $json.new_status === 'completed' ? 'NOW()' : 'completed_at' }}
WHERE id = '{{ $json.job_id }}'
RETURNING *
```

> ⚠️ **Note:** This updates the job status based on the polled response from the video generation provider.

### Sub-workflow Calls (No Config Needed)

- **Alert Failure**: Workflow ID `uCTePCAfvuecs7La`

> ⚠️ **Important:**
>
> - This workflow runs **every minute** and polls video generation APIs (Sora/Runway/Pika/Kling) for job status
> - The "Trigger Download Workflow" node calls `http://localhost:5678/webhook/production/download` (update if your n8n is on a different URL)
> - Requires video API credentials for polling provider APIs

---

# 📝 Activation Checklist

- [x] All 8 sub-workflows configured
- [ ] All 12 main workflows configured
- [ ] Tested: Log Cost Event
- [ ] Tested: Acquire Lock / Release Lock
- [ ] Tested: Get Brand Context (cache + DB)
- [ ] Tested: Check Circuit Breaker
- [ ] Tested: Strategist Main (end-to-end)
- [ ] Activated: Zombie Reaper (hourly)
- [ ] Activated: Circuit Breaker Monitor (5 min)
- [ ] **LAST**: Activated: Production Poller (1 min)

---

_Generated for Brand Infinity Engine Phase 4_
