#!/usr/bin/env bash
# Quick environment validator for local dev

set -euo pipefail

REQUIRED=(
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

# Optional but recommended for real dispatch
OPTIONAL=(
  "N8N_BASE_URL"
  "N8N_API_KEY"
  "N8N_WORKFLOW_IMAGE"
  "N8N_WORKFLOW_VIDEO"
  "NEXT_PUBLIC_APP_URL"
)

missing=()
for v in "${REQUIRED[@]}"; do
  if [ -z "${!v:-}" ]; then
    missing+=("$v")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "Missing required env vars: ${missing[*]}"
  exit 1
fi

warn=()
for v in "${OPTIONAL[@]}"; do
  if [ -z "${!v:-}" ]; then
    warn+=("$v")
  fi
done

if [ ${#warn[@]} -gt 0 ]; then
  echo "Warning: optional env vars not set: ${warn[*]}"
  echo "If you want real n8n dispatch, set these in your .env.local"
else
  echo "All optional n8n envs present — real dispatch should work"
fi

echo "Required envs present. IMAGE_GEN_MODE=${IMAGE_GEN_MODE:-mock}"
