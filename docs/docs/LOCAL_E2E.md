# Local E2E Smoke Test (Safe)

This document describes how to run a local end-to-end smoke test and the safety considerations.

What the test does
- Creates a temporary Supabase test user (via `POST /api/debug/create-test-user`)
- Establishes a server-side session (`POST /api/auth/store-session`) and sets auth cookies
- Creates a protected `POST /api/v1/requests` resource as the test user
- Optionally simulates an n8n callback (`POST /api/v1/callbacks/n8n`) if the request created tasks
- Cleans up: deletes the request and deletes the temporary test user

Prerequisites
- Run the app locally: `npm run dev` (port 3000)
- Tools: `curl`, `jq`
- Local environment (.env.local) must contain:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or equivalent `NEXT_PUBLIC_` variants)
  - `SUPABASE_SERVICE_ROLE_KEY` (for obtaining brand id and for admin cleanup if needed)

Security & Safety
- The debug endpoint `POST /api/debug/create-test-user` is gated: it throws in production unless `ALLOW_E2E_CREATE_TEST_USER=true`. Do NOT enable this setting in production.
- The script uses the Supabase service-role key only when necessary and recommends deleting test users and requests after the run.
- If you must test on production-like environments, use short-lived tokens and rotate them after testing.

How to run
1. Start dev server: `npm run dev`
2. Run the script: `bash scripts/run-local-e2e.sh`

Artifacts
- The script writes artifacts to `/tmp/brand-infinity-e2e/` for debugging and review. It also cleans up test data by default.

Notes & Next steps
- If you want automated periodic smoke tests, we can add a CI job that runs a subset of these checks in a dedicated ephemeral test environment (recommended for production monitoring).