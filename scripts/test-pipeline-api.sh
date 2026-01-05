#!/bin/bash

# =============================================================================
# Pipeline API Integration Tests
# Tests the complete request-centric workflow API
# =============================================================================

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
BRAND_ID="${BRAND_ID:-test-brand-id}"
AUTH_TOKEN="${AUTH_TOKEN}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🧪 Pipeline API Integration Tests"
echo "=================================="
echo "Base URL: $BASE_URL"
echo "Brand ID: $BRAND_ID"
echo ""

# Check prerequisites
if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${YELLOW}⚠️  WARNING: AUTH_TOKEN not set. Some tests may fail.${NC}"
  echo "Set it with: export AUTH_TOKEN='your-token-here'"
  echo ""
fi

# Helper function for API calls
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  local auth_header=""
  if [ -n "$AUTH_TOKEN" ]; then
    auth_header="-H \"Authorization: Bearer $AUTH_TOKEN\""
  fi
  
  if [ -z "$data" ]; then
    eval curl -s -X "$method" \
      $auth_header \
      -H "Content-Type: application/json" \
      "$BASE_URL$endpoint"
  else
    eval curl -s -X "$method" \
      $auth_header \
      -H "Content-Type: application/json" \
      -d "'$data'" \
      "$BASE_URL$endpoint"
  fi
}

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Test result helper
assert_success() {
  local test_name=$1
  local response=$2
  local expected_field=$3
  
  if echo "$response" | jq -e ".$expected_field" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}: $test_name"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}❌ FAIL${NC}: $test_name"
    echo "Response: $response"
    ((TESTS_FAILED++))
    return 1
  fi
}

# =============================================================================
# TEST 1: Get Estimate
# =============================================================================

echo -e "${BLUE}📊 Test 1: Get Cost Estimate${NC}"

ESTIMATE_REQUEST='{
  "type": "video_with_vo",
  "duration": 30,
  "tier": "standard",
  "hasVoiceover": true,
  "autoScript": true
}'

ESTIMATE_RESPONSE=$(api_call POST "/api/v1/requests/estimate" "$ESTIMATE_REQUEST")
assert_success "Estimate returns cost" "$ESTIMATE_RESPONSE" "data.cost"
assert_success "Estimate returns time" "$ESTIMATE_RESPONSE" "data.timeSeconds"
assert_success "Estimate returns breakdown" "$ESTIMATE_RESPONSE" "data.breakdown"

ESTIMATED_COST=$(echo $ESTIMATE_RESPONSE | jq -r '.data.cost // 0')
ESTIMATED_TIME=$(echo $ESTIMATE_RESPONSE | jq -r '.data.timeSeconds // 0')
echo "   Cost: \$$ESTIMATED_COST, Time: ${ESTIMATED_TIME}s"
echo ""

# =============================================================================
# TEST 2: Create Request
# =============================================================================

echo -e "${BLUE}📝 Test 2: Create Content Request${NC}"

CREATE_REQUEST='{
  "brand_id": "'$BRAND_ID'",
  "title": "Test Video Request - '$(date +%s)'",
  "type": "video_with_vo",
  "requirements": {
    "prompt": "A beautiful sunset over the ocean with calming music",
    "duration": 30,
    "aspect_ratio": "16:9",
    "style": "cinematic"
  },
  "settings": {
    "tier": "standard",
    "auto_script": true,
    "auto_publish": false
  }
}'

CREATE_RESPONSE=$(api_call POST "/api/v1/requests" "$CREATE_REQUEST")

if assert_success "Create returns request ID" "$CREATE_RESPONSE" "data.id"; then
  REQUEST_ID=$(echo $CREATE_RESPONSE | jq -r '.data.id')
  echo "   Request ID: $REQUEST_ID"
  
  assert_success "Create returns status" "$CREATE_RESPONSE" "data.status"
  assert_success "Create returns estimated_cost" "$CREATE_RESPONSE" "data.estimated_cost"
  assert_success "Create returns estimated_time_seconds" "$CREATE_RESPONSE" "data.estimated_time_seconds"
else
  echo -e "${RED}❌ Cannot proceed without request ID${NC}"
  exit 1
fi

echo ""

# =============================================================================
# TEST 3: Get Request Detail
# =============================================================================

echo -e "${BLUE}📋 Test 3: Get Request Details${NC}"

DETAIL_RESPONSE=$(api_call GET "/api/v1/requests/$REQUEST_ID")

assert_success "Detail returns request" "$DETAIL_RESPONSE" "data.id"
assert_success "Detail includes tasks" "$DETAIL_RESPONSE" "data.tasks"
assert_success "Detail includes events" "$DETAIL_RESPONSE" "data.events"

STATUS=$(echo $DETAIL_RESPONSE | jq -r '.data.status // "unknown"')
TASK_COUNT=$(echo $DETAIL_RESPONSE | jq -r '.data.tasks | length')
EVENT_COUNT=$(echo $DETAIL_RESPONSE | jq -r '.data.events | length')

echo "   Status: $STATUS"
echo "   Tasks: $TASK_COUNT"
echo "   Events: $EVENT_COUNT"

if [ "$STATUS" != "intake" ]; then
  echo -e "${YELLOW}   ⚠️  Expected status 'intake', got '$STATUS'${NC}"
fi

echo ""

# =============================================================================
# TEST 4: List Requests
# =============================================================================

echo -e "${BLUE}📃 Test 4: List Requests${NC}"

LIST_RESPONSE=$(api_call GET "/api/v1/requests?brand_id=$BRAND_ID&limit=10")

assert_success "List returns data array" "$LIST_RESPONSE" "data"
assert_success "List returns pagination meta" "$LIST_RESPONSE" "meta.total"

TOTAL=$(echo $LIST_RESPONSE | jq -r '.meta.total // 0')
echo "   Total requests: $TOTAL"

# Check if our new request is in the list
NEW_REQUEST_IN_LIST=$(echo $LIST_RESPONSE | jq -r ".data[] | select(.id == \"$REQUEST_ID\") | .id")
if [ "$NEW_REQUEST_IN_LIST" == "$REQUEST_ID" ]; then
  echo -e "${GREEN}✅ PASS${NC}: New request appears in list"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: New request not found in list"
  ((TESTS_FAILED++))
fi

echo ""

# =============================================================================
# TEST 5: Get Events Timeline
# =============================================================================

echo -e "${BLUE}📅 Test 5: Get Events Timeline${NC}"

EVENTS_RESPONSE=$(api_call GET "/api/v1/requests/$REQUEST_ID/events")

assert_success "Events returns data array" "$EVENTS_RESPONSE" "data"

EVENT_COUNT=$(echo $EVENTS_RESPONSE | jq -r '.data | length')
echo "   Event count: $EVENT_COUNT"

# Check for created event
CREATED_EVENT=$(echo $EVENTS_RESPONSE | jq -r '.data[] | select(.type == "created") | .type')
if [ "$CREATED_EVENT" == "created" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Created event exists"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Created event not found"
  ((TESTS_FAILED++))
fi

echo ""

# =============================================================================
# TEST 6: Update Request (Title)
# =============================================================================

echo -e "${BLUE}✏️  Test 6: Update Request Title${NC}"

UPDATE_REQUEST='{
  "title": "Updated Test Video - '$(date +%s)'"
}'

UPDATE_RESPONSE=$(api_call PATCH "/api/v1/requests/$REQUEST_ID" "$UPDATE_REQUEST")

assert_success "Update returns updated request" "$UPDATE_RESPONSE" "data.id"

NEW_TITLE=$(echo $UPDATE_RESPONSE | jq -r '.data.title // ""')
echo "   New title: $NEW_TITLE"

echo ""

# =============================================================================
# TEST 7: Filter Requests by Status
# =============================================================================

echo -e "${BLUE}🔍 Test 7: Filter Requests by Status${NC}"

FILTER_RESPONSE=$(api_call GET "/api/v1/requests?brand_id=$BRAND_ID&status=intake&limit=10")

assert_success "Filter returns data" "$FILTER_RESPONSE" "data"

INTAKE_COUNT=$(echo $FILTER_RESPONSE | jq -r '.data | length')
echo "   Intake requests: $INTAKE_COUNT"

# Verify all returned requests have status=intake
ALL_INTAKE=$(echo $FILTER_RESPONSE | jq -r '.data | all(.status == "intake")')
if [ "$ALL_INTAKE" == "true" ]; then
  echo -e "${GREEN}✅ PASS${NC}: All filtered requests have status=intake"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Some requests don't have status=intake"
  ((TESTS_FAILED++))
fi

echo ""

# =============================================================================
# TEST 8: Pagination
# =============================================================================

echo -e "${BLUE}📄 Test 8: Pagination${NC}"

PAGE1=$(api_call GET "/api/v1/requests?brand_id=$BRAND_ID&page=1&limit=2")
PAGE2=$(api_call GET "/api/v1/requests?brand_id=$BRAND_ID&page=2&limit=2")

assert_success "Page 1 returns data" "$PAGE1" "data"
assert_success "Page 2 returns data" "$PAGE2" "data"

P1_COUNT=$(echo $PAGE1 | jq -r '.data | length')
P2_COUNT=$(echo $PAGE2 | jq -r '.data | length')

echo "   Page 1 items: $P1_COUNT"
echo "   Page 2 items: $P2_COUNT"

# Verify pagination meta
P1_PAGE=$(echo $PAGE1 | jq -r '.meta.page // 0')
P2_PAGE=$(echo $PAGE2 | jq -r '.meta.page // 0')

if [ "$P1_PAGE" == "1" ] && [ "$P2_PAGE" == "2" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Pagination meta is correct"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Pagination meta incorrect"
  ((TESTS_FAILED++))
fi

echo ""

# =============================================================================
# TEST 9: Cancel Request
# =============================================================================

echo -e "${BLUE}🚫 Test 9: Cancel Request${NC}"

CANCEL_REQUEST='{"status": "cancelled"}'

CANCEL_RESPONSE=$(api_call PATCH "/api/v1/requests/$REQUEST_ID" "$CANCEL_REQUEST")

assert_success "Cancel returns updated request" "$CANCEL_RESPONSE" "data.id"

CANCELLED_STATUS=$(echo $CANCEL_RESPONSE | jq -r '.data.status // ""')
if [ "$CANCELLED_STATUS" == "cancelled" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Request status is cancelled"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Request status is not cancelled (got: $CANCELLED_STATUS)"
  ((TESTS_FAILED++))
fi

echo ""

# =============================================================================
# TEST 10: Verify Cancelled Event Logged
# =============================================================================

echo -e "${BLUE}📝 Test 10: Verify Cancelled Event${NC}"

CANCELLED_EVENTS=$(api_call GET "/api/v1/requests/$REQUEST_ID/events")

CANCELLED_EVENT=$(echo $CANCELLED_EVENTS | jq -r '.data[] | select(.type == "status_changed") | select(.metadata.new_status == "cancelled") | .type')

if [ "$CANCELLED_EVENT" == "status_changed" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Cancelled event logged"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Cancelled event not found"
  ((TESTS_FAILED++))
fi

echo ""

# =============================================================================
# TEST 11: Delete Request
# =============================================================================

echo -e "${BLUE}🗑️  Test 11: Delete Request${NC}"

DELETE_RESPONSE=$(api_call DELETE "/api/v1/requests/$REQUEST_ID")

assert_success "Delete returns success" "$DELETE_RESPONSE" "data.deleted"

DELETED=$(echo $DELETE_RESPONSE | jq -r '.data.deleted // false')
if [ "$DELETED" == "true" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Request deleted successfully"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}: Delete did not return true"
  ((TESTS_FAILED++))
fi

echo ""

# =============================================================================
# TEST 12: Verify Request is Deleted
# =============================================================================

echo -e "${BLUE}🔍 Test 12: Verify Request Deleted${NC}"

VERIFY_DELETE=$(api_call GET "/api/v1/requests/$REQUEST_ID")

ERROR_CODE=$(echo $VERIFY_DELETE | jq -r '.error.code // ""')

if [ "$ERROR_CODE" == "NOT_FOUND" ] || [ "$ERROR_CODE" == "RESOURCE_NOT_FOUND" ]; then
  echo -e "${GREEN}✅ PASS${NC}: Request not found (correctly deleted)"
  ((TESTS_PASSED++))
else
  echo -e "${YELLOW}⚠️  WARNING${NC}: Expected NOT_FOUND error, got: $ERROR_CODE"
  echo "   This may be okay depending on your error handling"
fi

echo ""

# =============================================================================
# TEST SUMMARY
# =============================================================================

echo "=================================="
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo "=================================="
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total:  $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
fi
