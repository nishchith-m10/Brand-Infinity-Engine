# Pipeline UI Proposal — Request Cards & Pipeline (MVP)

**Goal:** Replace fragile streaming chat for core production flows with a reliable, async Request Card + Pipeline Board UX while keeping the five backend agents and n8n orchestration intact.

## Overview (ASCII diagram)

```
User
  └─> Request Form (frontend) --POST /api/v1/requests--> content_requests (DB)
                              |                                |
                              |                                +--> request_events (audit)
                              |
                              v
                         Orchestrator (orchestrator.executePlan)
                              |
                              v
                         n8n Webhook (Production_Dispatcher)
                              |
             +----------------+----------------+
             |                                 |
         Pollo (economy)                  Runway (premium)
             |                                 |
       provider job id                      provider job id
             |                                 |
       provider callback -> /api/videos/webhook (n8n) -> Update `request_tasks`
                              |
                              v
                       Video Assembly (FFmpeg) -> final_video_url
                              |
                              v
                       UI Pipeline Board (status, logs, preview)
```

## Key Components

- Frontend: `RequestCard` form, `PipelineBoard` (Kanban-like), `RequestDetail` (activity feed + logs)
- API: `POST /api/v1/requests`, `GET /api/v1/requests/:id`, `GET /api/v1/requests?campaign=...`, `POST /api/v1/requests/:id/actions/retry`
- Backend: `orchestrator` and `task-planner` to convert requests into task plans
- n8n: `Production_Dispatcher` consumes webhook and routes to Pollo/Runway or direct provider adapters
- DB: `content_requests`, `request_tasks`, `request_events`, `provider_metadata`

## Minimal Data Model (MVP)

- `content_requests` (id, user_id, campaign_id, prompt, duration_seconds, provider_tier, status ENUM, created_at, updated_at)
- `request_tasks` (id, request_id, task_type, provider, provider_job_id, status, output_url, metadata JSON, started_at, finished_at)
- `request_events` (id, request_id, event_type, payload JSON, created_at)
- `provider_metadata` (task_id, provider_name, provider_response JSON)

## Acceptance Criteria (MVP)

1. A user can submit a Request Card and receive a request id immediately.
2. The request appears on the Pipeline Board with status `intake` and shows an estimated cost/time.
3. An n8n job is created for production; provider job id(s) are persisted in `request_tasks`.
4. Provider callbacks (Pollo/Runway) update task status and final asset URL is stored and surfaced in UI.
5. Manual retry endpoint (`/actions/retry`) can be called idempotently to re-run failed tasks.

## Next Steps (implementation plan)

1. Add DB migrations for the four tables above.
2. Implement API endpoints and validations; return estimates (cost/time) on create.
3. Build `RequestCard` and `PipelineBoard` UIs; include filters and search by campaign.
4. Wire `orchestrator.executePlan()` to accept `request_id`-driven plans and persist `request_tasks`.
5. Update n8n `Production_Dispatcher` to accept `provider_priority` and record provider job ids in `provider_metadata`.
6. Add E2E tests (mock Pollo/Runway), cost-guard checks, and an approval step for high-cost requests.

## UX Notes & Considerations

- Keep the current Chat interface as an "Advanced"/Power-user mode behind a feature flag.
- Provide clear cost/time estimates and a confirmation step before dispatching to paid providers.
- Show request progress as a timeline and allow deep-dive per `request_task` with provider logs and outputs.

---

*Created: Jan 3, 2026*
*Author: Planner*