# Copilot / AI Agent Instructions for Brand Infinity Engine 🤖

Concise, actionable context an AI coding agent needs to be productive in this repo. Read `rules/project_context.md` and `docs/engine/V13_OLYMPUS_COMPLETE.md` for deeper background.

## Quick architecture (one-line summary)
- Frontend: Next.js App Router in `app/` (port 3000). Orchestration: n8n workflows. Backend: Next.js server routes in `app/api/v1/`. Data: Supabase Postgres + pgvector. AI: routed via `lib/` & `src/pillars/`.

## Quick reads (in order)
1. `docs/rules/project_context.md` (state & priorities)
2. `docs/rules/system_prompt.md` (brand safety, cost rules)
3. `docs/rules/conventions.md` (naming, API format, PR checklist)
4. `README.md` (architecture diagrams + quick start)

## Must-know commands
- Dev: `npm run dev`
- Build: `npm run build`
- Type check: `npx tsc -p tsconfig.json --noEmit`
- Lint: `npm run lint`
- Tests: `npx vitest` or `npx vitest run`
- Secret-scan (PR requirement): `bash ./scripts/ci/secret_scan.sh . tmp_secret_scan_output`
- Apply DB migrations (requires SUPABASE env vars): `./apply-migrations.sh`
- Start n8n: `docker-compose up n8n` (use `scripts/import_workflows.sh` / `verify_n8n_workflows.sh` to manage workflows)

## Environment & secrets (important vars)
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (apply-migrations uses these)
- N8N_WEBHOOK_URL, N8N_API_KEY, N8N_WEBHOOK_SECRET (n8n integration + callbacks)
- OPENAI_API_KEY / ANTHROPIC_KEY / ELEVENLABS_KEY (use `mock` for local dev if needed)
- NEVER commit `.env` or credentials; run secret-scan before PR.

## Key patterns & where to look (use these helpers)
- Model routing: `utils/model_router.js` — use `selectTextModel/selectVideoModel` with options (complexity, budget, priority, contextLength).
- Cost tracking: `utils/cost_calculator.js` — calculate per-op and workflow costs; enforce budget checks using DB fn `get_available_budget()` (see `supabase/migrations/20260105160000_budget_enforcement.sql`).
- External resilience: `lib/orchestrator/CircuitBreaker.ts` and `lib/orchestrator/MetricsCollector.ts` — use Circuit Breakers for provider calls.
- n8n client: `lib/n8n/client.ts` — use `getN8NClient()` and `N8N_WEBHOOKS` constants; triggers support retries, idempotency keys, timeouts.
- Provider tracking: store provider responses in `provider_metadata` (request_id, task_id, provider_job_id, metadata).
- Webhook callbacks: `app/api/v1/callbacks/n8n/route.ts` — verify `x-n8n-signature` with HMAC + `timingSafeEqual` and update `request_tasks`/`provider_metadata`.

## Security & common pitfalls (be explicit)
- Always verify webhook signatures (see `app/api/v1/callbacks/n8n/route.ts`). Use constant-time comparison to avoid timing attacks.
- Check `HEALTH_AUDIT_MASTER_REPORT.md` for known issues (e.g., earlier missing auth or retry gaps).
- Do not log secrets or API keys; sanitize provider error messages in responses.
- Enforce RLS and least-privilege in `supabase/migrations/` (review migrations before applying).

## Quick examples (copy/paste)
- Trigger n8n workflow (idempotent):
  const n8n = getN8NClient();
  await n8n.triggerWorkflow(N8N_WEBHOOKS.CONTENT_GENERATION, { brief, brand_id }, { idempotencyKey: requestId });

- Pick model with ModelRouter:
  const mr = new ModelRouter();
  mr.selectTextModel({ complexity: 'high', budget: 'low', priority: 'cost', contextLength: 1024 });

- Calculate & check cost:
  const cc = new CostCalculator();
  const cost = cc.calculateWorkflowCost(ops);
  -- call `get_available_budget(campaign_uuid)` in DB before reserving

## PR checklist (must pass before merge)
1. Type checks: `npx tsc --noEmit`
2. Tests: `npx vitest` (unit + integration when applicable)
3. Lint: `npm run lint`
4. Secret-scan: `bash ./scripts/ci/secret_scan.sh . tmp_secret_scan_output`
5. Update `docs/rules/project_context.md` and module README if behavior changed
6. Use conventional commit: `feat(<area>): short summary`

## When in doubt — inspect these files
- `docs/rules/*` (context, system prompt, conventions)
- `lib/n8n/client.ts`, `N8N_WEBHOOKS` (workflow integration)
- `utils/model_router.js`, `utils/cost_calculator.js`
- `lib/orchestrator/*` (CircuitBreaker, RequestOrchestrator, MetricsCollector)
- `app/api/v1/callbacks/n8n/route.ts` (signature + idempotency examples)

---
If anything here is unclear or you'd like more examples (snippets, tests, or CI hooks), tell me which section to expand and I will iterate. ✅