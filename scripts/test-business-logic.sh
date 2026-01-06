#!/bin/bash

# =============================================================================
# Business Logic Enforcement Validation Tests
# Tests state machine validation, budget enforcement, and approval workflow
# =============================================================================

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api/v1}"
CAMPAIGN_ID="${CAMPAIGN_ID:-}"
VIDEO_ID="${VIDEO_ID:-}"

echo "======================================"
echo "Business Logic Enforcement Tests"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
  local test_name="$1"
  local expected_status="$2"
  local actual_status="$3"
  
  TESTS_RUN=$((TESTS_RUN + 1))
  
  if [ "$actual_status" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $test_name (HTTP $actual_status)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $test_name (Expected HTTP $expected_status, got HTTP $actual_status)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

echo "=== Test 1: Campaign State Machine Validation ==="
echo ""

# Get auth token (you need to replace this with actual auth)
AUTH_TOKEN="${AUTH_TOKEN:-your-session-token}"

if [ -n "$CAMPAIGN_ID" ]; then
  echo "Testing invalid state transition: draft → completed (should fail)..."
  RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE_URL/campaigns/$CAMPAIGN_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "completed"}')
  
  STATUS=$(echo "$RESPONSE" | tail -1)
  run_test "Invalid transition draft → completed blocked" "400" "$STATUS"
  
  echo ""
  echo "Testing valid state transition: draft → in_progress..."
  RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE_URL/campaigns/$CAMPAIGN_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "in_progress"}')
  
  STATUS=$(echo "$RESPONSE" | tail -1)
  run_test "Valid transition draft → in_progress allowed" "200" "$STATUS"
else
  echo -e "${YELLOW}⊘ SKIP${NC}: Campaign state machine tests (CAMPAIGN_ID not set)"
fi

echo ""
echo "=== Test 2: Budget Enforcement with Race Conditions ==="
echo ""

if [ -n "$CAMPAIGN_ID" ]; then
  echo "Simulating concurrent image generation requests..."
  echo "Note: This requires a campaign with a small budget limit (e.g., \$0.10)"
  
  # Launch 5 concurrent requests (each costs ~$0.04)
  # Total would be $0.20, but budget is only $0.10
  # Should allow only 2-3 requests and reject the rest atomically
  
  echo "Launching 5 concurrent image generation requests..."
  for i in {1..5}; do
    (curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/images/generate" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"prompt\": \"Test image $i\",
        \"campaign_id\": \"$CAMPAIGN_ID\",
        \"model\": \"dalle-3\",
        \"quality\": \"standard\"
      }" > "/tmp/budget_test_$i.txt") &
  done
  
  wait
  
  echo "Analyzing results..."
  SUCCESS_COUNT=0
  BUDGET_FAIL_COUNT=0
  
  for i in {1..5}; do
    STATUS=$(tail -1 "/tmp/budget_test_$i.txt")
    if [ "$STATUS" = "200" ]; then
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    elif [ "$STATUS" = "402" ]; then
      BUDGET_FAIL_COUNT=$((BUDGET_FAIL_COUNT + 1))
    fi
  done
  
  echo "Results: $SUCCESS_COUNT succeeded, $BUDGET_FAIL_COUNT failed due to budget"
  
  if [ $BUDGET_FAIL_COUNT -gt 0 ] && [ $SUCCESS_COUNT -gt 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: Budget enforcement prevented some requests (atomic protection working)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: Budget enforcement not working correctly"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  TESTS_RUN=$((TESTS_RUN + 1))
  
  # Cleanup
  rm -f /tmp/budget_test_*.txt
else
  echo -e "${YELLOW}⊘ SKIP${NC}: Budget enforcement tests (CAMPAIGN_ID not set)"
fi

echo ""
echo "=== Test 3: Video Approval Workflow ==="
echo ""

if [ -n "$VIDEO_ID" ]; then
  echo "Testing publish without approval (should fail)..."
  RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_BASE_URL/videos/$VIDEO_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "published"}')
  
  STATUS=$(echo "$RESPONSE" | tail -1)
  run_test "Publish without approval blocked" "403" "$STATUS"
  
  echo ""
  echo "Testing video approval..."
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/videos/$VIDEO_ID/approve" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json")
  
  STATUS=$(echo "$RESPONSE" | tail -1)
  run_test "Video approval successful" "200" "$STATUS"
  
  echo ""
  echo "Testing publish after approval (should succeed)..."
  RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_BASE_URL/videos/$VIDEO_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "published"}')
  
  STATUS=$(echo "$RESPONSE" | tail -1)
  run_test "Publish after approval allowed" "200" "$STATUS"
else
  echo -e "${YELLOW}⊘ SKIP${NC}: Video approval tests (VIDEO_ID not set)"
fi

echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
echo "Total tests run: $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ] && [ $TESTS_RUN -gt 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed or were skipped${NC}"
  echo ""
  echo "To run all tests, set these environment variables:"
  echo "  export CAMPAIGN_ID=<your-campaign-uuid>"
  echo "  export VIDEO_ID=<your-video-job-uuid>"
  echo "  export AUTH_TOKEN=<your-session-token>"
  exit 1
fi
