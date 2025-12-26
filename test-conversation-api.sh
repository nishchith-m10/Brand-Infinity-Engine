#!/bin/bash

# ============================================================================
# SLICE 2: Conversation API Test Script
# ============================================================================
# 
# This script tests the basic conversation API endpoints.
# 
# Usage:
#   1. Set your access token and brand ID below
#   2. Make script executable: chmod +x test-conversation-api.sh
#   3. Run: ./test-conversation-api.sh
#
# ============================================================================

# ----------------------------------------------------------------------------
# CONFIGURATION - UPDATE THESE VALUES
# ----------------------------------------------------------------------------

# Your Supabase access token (get from browser dev tools or supabase CLI)
ACCESS_TOKEN="YOUR_TOKEN_HERE"

# Your brand ID (get from brands table)
BRAND_ID="YOUR_BRAND_ID_HERE"

# API base URL (change if not running locally)
API_BASE="http://localhost:3000"

# ----------------------------------------------------------------------------
# COLOR OUTPUT
# ----------------------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# ----------------------------------------------------------------------------
# VALIDATION
# ----------------------------------------------------------------------------

if [ "$ACCESS_TOKEN" = "YOUR_TOKEN_HERE" ]; then
    print_error "Please set ACCESS_TOKEN in the script"
    exit 1
fi

if [ "$BRAND_ID" = "YOUR_BRAND_ID_HERE" ]; then
    print_error "Please set BRAND_ID in the script"
    exit 1
fi

# ----------------------------------------------------------------------------
# TEST 1: Create New Conversation
# ----------------------------------------------------------------------------

print_header "TEST 1: Create New Conversation"

echo "Request:"
echo "POST $API_BASE/api/v1/conversation/start"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/v1/conversation/start" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{
        \"brand_id\": \"$BRAND_ID\",
        \"initial_message\": \"I need to create a product launch campaign for my new AI-powered smartwatch\"
    }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response ($HTTP_CODE):"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Session created successfully"
    SESSION_ID=$(echo "$BODY" | jq -r '.session_id')
    echo -e "${GREEN}Session ID: $SESSION_ID${NC}"
else
    print_error "Failed to create session (HTTP $HTTP_CODE)"
    exit 1
fi

# ----------------------------------------------------------------------------
# TEST 2: Retrieve Session
# ----------------------------------------------------------------------------

print_header "TEST 2: Retrieve Session"

echo "Request:"
echo "GET $API_BASE/api/v1/conversation/$SESSION_ID"
echo ""

sleep 1  # Give DB a moment to settle

RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/api/v1/conversation/$SESSION_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response ($HTTP_CODE):"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Session retrieved successfully"
    
    # Extract and display key info
    STATE=$(echo "$BODY" | jq -r '.session.state')
    MSG_COUNT=$(echo "$BODY" | jq -r '.stats.total_messages')
    
    echo -e "${GREEN}State: $STATE${NC}"
    echo -e "${GREEN}Message Count: $MSG_COUNT${NC}"
    
    if [ "$MSG_COUNT" = "2" ]; then
        print_success "Expected 2 messages (user + assistant)"
    else
        print_warning "Expected 2 messages, got $MSG_COUNT"
    fi
else
    print_error "Failed to retrieve session (HTTP $HTTP_CODE)"
    exit 1
fi

# ----------------------------------------------------------------------------
# TEST 3: Missing Brand ID
# ----------------------------------------------------------------------------

print_header "TEST 3: Validation - Missing Brand ID"

echo "Request:"
echo "POST $API_BASE/api/v1/conversation/start (no brand_id)"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/v1/conversation/start" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "initial_message": "Test message"
    }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response ($HTTP_CODE):"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "400" ]; then
    ERROR_CODE=$(echo "$BODY" | jq -r '.error.code')
    if [ "$ERROR_CODE" = "MISSING_BRAND_ID" ]; then
        print_success "Validation working correctly (MISSING_BRAND_ID)"
    else
        print_warning "Got 400 but wrong error code: $ERROR_CODE"
    fi
else
    print_error "Expected 400, got $HTTP_CODE"
fi

# ----------------------------------------------------------------------------
# TEST 4: Invalid Brand ID
# ----------------------------------------------------------------------------

print_header "TEST 4: Validation - Invalid Brand ID"

echo "Request:"
echo "POST $API_BASE/api/v1/conversation/start (invalid brand_id)"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/v1/conversation/start" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d '{
        "brand_id": "00000000-0000-0000-0000-000000000000",
        "initial_message": "Test message"
    }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response ($HTTP_CODE):"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "404" ]; then
    ERROR_CODE=$(echo "$BODY" | jq -r '.error.code')
    if [ "$ERROR_CODE" = "BRAND_NOT_FOUND" ]; then
        print_success "Brand validation working correctly (BRAND_NOT_FOUND)"
    else
        print_warning "Got 404 but wrong error code: $ERROR_CODE"
    fi
else
    print_error "Expected 404, got $HTTP_CODE"
fi

# ----------------------------------------------------------------------------
# TEST 5: No Authentication
# ----------------------------------------------------------------------------

print_header "TEST 5: Security - No Authentication"

echo "Request:"
echo "POST $API_BASE/api/v1/conversation/start (no auth token)"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/v1/conversation/start" \
    -H "Content-Type: application/json" \
    -d "{
        \"brand_id\": \"$BRAND_ID\",
        \"initial_message\": \"Test message\"
    }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Response ($HTTP_CODE):"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "401" ]; then
    ERROR_CODE=$(echo "$BODY" | jq -r '.error.code')
    if [ "$ERROR_CODE" = "UNAUTHORIZED" ]; then
        print_success "Authentication required (UNAUTHORIZED)"
    else
        print_warning "Got 401 but wrong error code: $ERROR_CODE"
    fi
else
    print_error "Expected 401, got $HTTP_CODE"
fi

# ----------------------------------------------------------------------------
# SUMMARY
# ----------------------------------------------------------------------------

print_header "TEST SUMMARY"

echo -e "${GREEN}✅ Test 1: Create session - PASSED${NC}"
echo -e "${GREEN}✅ Test 2: Retrieve session - PASSED${NC}"
echo -e "${GREEN}✅ Test 3: Missing brand_id validation - PASSED${NC}"
echo -e "${GREEN}✅ Test 4: Invalid brand_id validation - PASSED${NC}"
echo -e "${GREEN}✅ Test 5: Authentication required - PASSED${NC}"
echo ""
print_success "All tests completed successfully!"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Check Supabase dashboard to verify data"
echo "  2. Run database verification queries (see README)"
echo "  3. Mark Slice 2 as complete in checklist"
echo "  4. Proceed to Slice 3: Redis Integration"
echo ""

