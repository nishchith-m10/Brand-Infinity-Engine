#!/usr/bin/env bash

# Helper: Start Docker Desktop (macOS), wait for daemon, and bring up the compose stack
# Usage: chmod +x scripts/dev/start_stack.sh && ./scripts/dev/start_stack.sh

set -euo pipefail

SLEEPTIME=3
MAX_RETRIES=60
RETRIES=0

function log(){
  echo "[start_stack] $*"
}

# 1) Start Docker Desktop on macOS if not running
if ! docker info >/dev/null 2>&1; then
  log "Docker daemon not reachable. Attempting to start Docker Desktop..."
  open -a Docker || {
    log "Failed to open Docker.app automatically. Please start Docker Desktop and re-run this script.";
    exit 1;
  }
fi

# 2) Wait for docker daemon
while ! docker info >/dev/null 2>&1; do
  RETRIES=$((RETRIES+1))
  if [ "$RETRIES" -gt "$MAX_RETRIES" ]; then
    log "Timed out waiting for Docker daemon. Check Docker Desktop and retry.";
    exit 1
  fi
  log "Waiting for Docker daemon to be ready... (attempt $RETRIES/$MAX_RETRIES)"
  sleep $SLEEPTIME
done

log "Docker daemon is running"

# 3) Ensure we have a .env file (docker compose reads .env)
if [ ! -f .env ]; then
  if [ -f .env.local ]; then
    log ".env not found, copying .env.local -> .env (do not commit .env)"
    cp .env.local .env
  else
    log "No .env or .env.local found. Create .env or copy .env.local before continuing.";
    exit 1
  fi
fi

# 4) Pull images and bring up services
log "Pulling images..."
docker compose pull

log "Starting services..."
docker compose up -d

log "Waiting 10s for containers to initialize..."
sleep 10

log "Showing status:"
docker compose ps

# 5) Tail logs for key services (non-blocking)
log "Tailing logs briefly (last 200 lines) for postgres and redis..."
docker compose logs --tail 200 postgres || true
docker compose logs --tail 200 redis || true

log "To follow logs continuously run: docker compose logs -f"
log "If you use remote n8n, it will not be started locally unless you run: docker compose --profile local up -d n8n"

log "Done. If anything failed, paste the output here and I'll help debug."