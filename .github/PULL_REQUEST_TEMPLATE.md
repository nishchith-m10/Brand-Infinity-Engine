<!-- Title: ci: business logic verification (metrics + configurable repeats) -->

## Summary

Adds a workflow to run repeated business-logic verification (default 50 repeats) and a CI script that collects per-run metrics (`metrics.json`, `metrics.csv`) and a summarized `metrics_summary.json`.

This workflow runs with `IMAGE_GEN_MODE=mock` in CI to avoid provider charges and can be configured via the `repeats` input or the workflow_dispatch form.

## What to verify

- The CI workflow runs on PR open / update and produces a `business-logic-logs` artifact containing `metrics.json`, `metrics.csv`, `metrics_summary.json`, and per-run logs.
- No provider calls are made (mock mode enabled).

## How to run (maintainers)
1. Go to Actions → Business Logic Verification → Run workflow (or open/update PR targeting `main`/`develop`).
2. Set `repeats` if you want a value other than the default (50).
3. Download the artifact `business-logic-logs` and inspect `metrics_summary.json`.

## Reviewer
- @revi (recommended)

## Notes
- Requires repository secret `SUPABASE_SERVICE_ROLE_KEY` to be present for the CI script to create fixtures.
- If you want me to run the workflow and analyze results, add @revi as a reviewer and ping me here.