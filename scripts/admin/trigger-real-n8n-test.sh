#!/bin/bash

###############################################################################
# E2E n8n Integration Test Script
#
# Purpose:
#   Test the complete n8n integration flow:
#   1. Create test content request via API
#   2. Monitor task creation and dispatch
#   3. Wait for n8n callback (up to 120s)
#   4. Verify provider_metadata persistence
#   5. Verify output URL accessibility
#   6. Report success/failure with detailed logs
#
# Usage:
#   ./scripts/admin/trigger-real-n8n-test.sh [task_type]
#
# Arguments:
#   task_type: image_generation (default), video_generation, or voiceover_synthesis
#
# Requirements:
#   - NEXT_PUBLIC_APP_URL set (API base URL)
#   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set
#   - n8n workflows configured and running
#   - jq installed (brew install jq)
#
# Example:
#   ./scripts/admin/trigger-real-n8n-test.sh image_generation
###############################################################################

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TASK_TYPE="${1:-image_generation}"
MAX_WAIT_SECONDS=120
POLL_INTERVAL=5

# Validate environment
if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
  echo -e "${RED}ERROR: NEXT_PUBLIC_APP_URL not set${NC}"
  exit 1
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}ERROR: Supabase credentials not set${NC}"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo -e "${RED}ERROR: jq is not installed (brew install jq)${NC}"
  exit 1
fi

API_BASE_URL="${NEXT_PUBLIC_APP_URL}/api"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         n8n Integration E2E Test (Real Instance)                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Task Type:${NC} $TASK_TYPE"
echo -e "${YELLOW}API Base:${NC} $API_BASE_URL"
echo -e "${YELLOW}Max Wait:${NC} ${MAX_WAIT_SECONDS}s"
echo ""

###############################################################################
# Step 1: Create test content request
###############################################################################

echo -e "${BLUE}[1/5]${NC} Creating test content request..."

REQUEST_PAYLOAD=$(cat <<EOF
{
  "request_type": "${TASK_TYPE}",
  "prompt": "E2E n8n test - $(date +%s)",
  "metadata": {
    "test": true,
    "test_run_id": "e2e-$(date +%s)",
    "task_type": "${TASK_TYPE}"
  }
}
EOF
)

REQUEST_RESPONSE=$(curl -s -X POST \
  "${API_BASE_URL}/v1/requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -d "$REQUEST_PAYLOAD")

REQUEST_ID=$(echo "$REQUEST_RESPONSE" | jq -r '.id // empty')

if [ -z "$REQUEST_ID" ]; then
  echo -e "${RED}✗ Failed to create request${NC}"
  echo "$REQUEST_RESPONSE" | jq .
  exit 1
fi

echo -e "${GREEN}✓ Created request: ${REQUEST_ID}${NC}"

###############################################################################
# Step 2: Wait for producer task creation
###############################################################################

echo -e "${BLUE}[2/5]${NC} Waiting for producer task creation..."

TASK_ID=""
for i in {1..10}; do
  sleep 2

  TASKS_RESPONSE=$(curl -s \
    "${SUPABASE_URL}/rest/v1/request_tasks?request_id=eq.${REQUEST_ID}&agent_role=eq.producer&select=*" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

  TASK_ID=$(echo "$TASKS_RESPONSE" | jq -r '.[0].id // empty')

  if [ -n "$TASK_ID" ]; then
    echo -e "${GREEN}✓ Found producer task: ${TASK_ID}${NC}"
    break
  fi

  echo -e "${YELLOW}  Waiting for task creation... (${i}/10)${NC}"
done

if [ -z "$TASK_ID" ]; then
  echo -e "${RED}✗ Producer task not created within 20s${NC}"
  exit 1
fi

###############################################################################
# Step 3: Monitor task status and wait for completion
###############################################################################

echo -e "${BLUE}[3/5]${NC} Monitoring task status (max ${MAX_WAIT_SECONDS}s)..."

ELAPSED=0
TASK_STATUS=""

while [ $ELAPSED -lt $MAX_WAIT_SECONDS ]; do
  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))

  TASK_RESPONSE=$(curl -s \
    "${SUPABASE_URL}/rest/v1/request_tasks?id=eq.${TASK_ID}&select=*" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

  TASK_STATUS=$(echo "$TASK_RESPONSE" | jq -r '.[0].status // empty')
  OUTPUT_URL=$(echo "$TASK_RESPONSE" | jq -r '.[0].output_url // empty')

  echo -e "${YELLOW}  [${ELAPSED}s] Status: ${TASK_STATUS}${NC}"

  if [ "$TASK_STATUS" = "completed" ]; then
    echo -e "${GREEN}✓ Task completed successfully${NC}"
    echo -e "${GREEN}  Output URL: ${OUTPUT_URL}${NC}"
    break
  elif [ "$TASK_STATUS" = "failed" ]; then
    ERROR_MSG=$(echo "$TASK_RESPONSE" | jq -r '.[0].error_message // "Unknown error"')
    echo -e "${RED}✗ Task failed: ${ERROR_MSG}${NC}"
    exit 1
  fi
done

if [ "$TASK_STATUS" != "completed" ]; then
  echo -e "${RED}✗ Task did not complete within ${MAX_WAIT_SECONDS}s${NC}"
  echo -e "${RED}  Final status: ${TASK_STATUS}${NC}"
  exit 1
fi

###############################################################################
# Step 4: Verify provider_metadata persistence
###############################################################################

echo -e "${BLUE}[4/5]${NC} Verifying provider_metadata..."

METADATA_RESPONSE=$(curl -s \
  "${SUPABASE_URL}/rest/v1/provider_metadata?request_task_id=eq.${TASK_ID}&provider_name=eq.n8n&select=*" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

EXECUTION_ID=$(echo "$METADATA_RESPONSE" | jq -r '.[0].external_job_id // empty')
PROVIDER_STATUS=$(echo "$METADATA_RESPONSE" | jq -r '.[0].provider_status // empty')

if [ -z "$EXECUTION_ID" ]; then
  echo -e "${RED}✗ Provider metadata not found${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Provider metadata found${NC}"
echo -e "${GREEN}  Execution ID: ${EXECUTION_ID}${NC}"
echo -e "${GREEN}  Provider Status: ${PROVIDER_STATUS}${NC}"

###############################################################################
# Step 5: Verify output URL accessibility (if applicable)
###############################################################################

echo -e "${BLUE}[5/5]${NC} Verifying output URL accessibility..."

if [ -n "$OUTPUT_URL" ] && [ "$OUTPUT_URL" != "null" ]; then
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$OUTPUT_URL")

  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Output URL is accessible (HTTP 200)${NC}"
  else
    echo -e "${YELLOW}⚠ Output URL returned HTTP ${HTTP_STATUS}${NC}"
  fi
else
  echo -e "${YELLOW}⚠ No output URL provided (may be expected for this task type)${NC}"
fi

###############################################################################
# Summary
###############################################################################

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     TEST PASSED ✓                                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Summary:${NC}"
echo -e "  ${GREEN}✓${NC} Request ID: ${REQUEST_ID}"
echo -e "  ${GREEN}✓${NC} Task ID: ${TASK_ID}"
echo -e "  ${GREEN}✓${NC} Execution ID: ${EXECUTION_ID}"
echo -e "  ${GREEN}✓${NC} Task Status: ${TASK_STATUS}"
echo -e "  ${GREEN}✓${NC} Duration: ${ELAPSED}s"

if [ -n "$OUTPUT_URL" ] && [ "$OUTPUT_URL" != "null" ]; then
  echo -e "  ${GREEN}✓${NC} Output: ${OUTPUT_URL}"
fi

echo ""
echo -e "${YELLOW}Cleanup (optional):${NC}"
echo "  psql \$DATABASE_URL -c \"DELETE FROM content_requests WHERE id = '${REQUEST_ID}';\""
echo ""

exit 0
