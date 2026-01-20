#!/usr/bin/env bash
set -euo pipefail
TMP="/tmp/brand-infinity-e2e-actual"
BASE="http://localhost:3000"
mkdir -p "$TMP"

command -v jq >/dev/null 2>&1 || { echo "jq is required. Install jq and retry." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl is required. Install curl and retry." >&2; exit 1; }

echo "🧪 Running ACTUAL E2E Generation Test"
echo "======================================"

# 0. Sanity check server
if ! curl -sSf "$BASE/" >/dev/null; then
  echo "❌ Local server not reachable at $BASE. Start dev server (npm run dev) and retry." >&2
  exit 1
fi

# 1. Create test user
echo "1️⃣  Creating test user..."
curl -sS -X POST "$BASE/api/debug/create-test-user" -H "Content-Type: application/json" -d '{}' -o "$TMP/create_resp.json"
USER_ID=$(jq -r '.data.user.id // empty' "$TMP/create_resp.json")
ACCESS_TOKEN=$(jq -r '.data.tokens.access_token // empty' "$TMP/create_resp.json")
REFRESH_TOKEN=$(jq -r '.data.tokens.refresh_token // empty' "$TMP/create_resp.json")

if [[ -z "$USER_ID" || -z "$ACCESS_TOKEN" ]]; then
  echo "❌ Failed to create user or get tokens" >&2
  exit 2
fi
echo "   User ID: $USER_ID"

# 2. Store session
echo "2️⃣  Authenticating..."
jq -n --arg a "$ACCESS_TOKEN" --arg r "$REFRESH_TOKEN" '{access_token:$a,refresh_token:$r}' > "$TMP/tokens_payload.json"
curl -s -c "$TMP/cookies.txt" -X POST "$BASE/api/auth/store-session" -H "Content-Type: application/json" -d @"$TMP/tokens_payload.json" -o "$TMP/store_session_resp.json"

# 3. Create Brand for User
echo "3️⃣  Creating Brand for Test User..."

# Load Service Key from .env.local
SUPABASE_URL=$(grep -E '^SUPABASE_URL=' .env.local | cut -d'=' -f2- | tr -d '"' || true)
SERVICE_KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d'=' -f2- | tr -d '"' || true)

if [[ -z "$SUPABASE_URL" || -z "$SERVICE_KEY" ]]; then
  echo "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" >&2
  exit 4
fi

BRAND_PAYLOAD=$(jq -n --arg owner "$USER_ID" '{
    owner_id: $owner,
    name: "E2E Test Brand",
    brand_voice: "Professional and E2E Testing Focused",
    brand_colors: "#FF0000",
    target_audience: "Testers"
}')

curl -s -X POST "$SUPABASE_URL/rest/v1/brands" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$BRAND_PAYLOAD" \
    -o "$TMP/create_brand.json"

BRAND_ID=$(jq -r '.[0].id // empty' "$TMP/create_brand.json")

if [ -z "$BRAND_ID" ]; then
    echo "❌ Failed to create brand" >&2
    cat "$TMP/create_brand.json"
    exit 5
fi

echo "   Brand created: $BRAND_ID"

# 4. Configure OpenAI Key (Mock)
echo "4️⃣  Configuring OpenAI Key (Test)..."

# Use a dummy key - this allows the orchestrator to proceed past the configuration check.
# Note: The actual generation might fail if it tries to call OpenAI with this key,
# but it moves us past the "Not Configured" error.
CONFIG_PAYLOAD='{"provider": "openai", "key": "sk-proj-dummy-key-for-e2e-testing-12345"}'

echo "   Payload: $CONFIG_PAYLOAD"

CONFIG_RESPONSE=$(curl -s -b "$TMP/cookies.txt" -X POST "$BASE/api/user/provider-keys" \
  -H "Content-Type: application/json" \
  -d "$CONFIG_PAYLOAD")

# Check if configuration was successful
if echo "$CONFIG_RESPONSE" | grep -q '"success":true'; then
  KEY_ID=$(echo "$CONFIG_RESPONSE" | jq -r '.data.id')
  echo "   ✅ Key Configured! ID: $KEY_ID"
else
  echo "   ⚠️  Failed to configure key!"
  echo "   Response: $CONFIG_RESPONSE"
  # Don't exit - strictly speaking we might want to fail, but let's see if it works anyway
fi

# 5. Create Request
echo "5️⃣  Creating Content Request (Actual Generation)..."
TIMESTAMP=$(date +%s)
PAYLOAD=$(jq -n --arg brand_id "$BRAND_ID" --arg ts "$TIMESTAMP" '{
    brand_id: $brand_id,
    title: ("Actual E2E Test " + $ts),
    type: "video_with_vo",
    requirements: {
        prompt: "A futuristic city with flying cars, cyberpunk style, neon lights, 4k",
        duration: 10,
        aspect_ratio: "16:9",
        style_preset: "Cinematic"
    },
    settings: {
        tier: "standard"
    }
}')

curl -s -b "$TMP/cookies.txt" -X POST "$BASE/api/v1/requests" -H "Content-Type: application/json" -d "$PAYLOAD" -o "$TMP/create_request.json"
REQUEST_ID=$(jq -r '.data.id // empty' "$TMP/create_request.json")
if [ -z "$REQUEST_ID" ] || [ "$REQUEST_ID" == "null" ]; then
  echo "❌ Request creation failed" >&2
  cat "$TMP/create_request.json"
  exit 6
fi
echo "   Request ID: $REQUEST_ID"

# 5. Polling Loop
echo "5️⃣  Waiting for completion (Polling)..."
STATUS="unknown"
MAX_RETRIES=60 # 60 * 5s = 5 minutes timeout
COUNT=0

while [ "$STATUS" != "completed" ] && [ "$STATUS" != "failed" ] && [ $COUNT -lt $MAX_RETRIES ]; do
    sleep 5
    curl -s -b "$TMP/cookies.txt" "$BASE/api/v1/requests/$REQUEST_ID" -o "$TMP/request_poll.json"
    
    # Debug: Check if response is valid JSON and has data
    if ! jq -e . "$TMP/request_poll.json" >/dev/null 2>&1; then
        echo "   ⚠️  Invalid JSON response during polling:"
        cat "$TMP/request_poll.json"
        echo ""
        sleep 5
        continue
    fi
    
    # Check for API error
    API_ERROR=$(jq -r '.error // empty' "$TMP/request_poll.json")
    if [ -n "$API_ERROR" ] && [ "$API_ERROR" != "null" ]; then
        echo "   ❌ API returned error during polling: $API_ERROR"
        cat "$TMP/request_poll.json"
        exit 7
    fi

    STATUS=$(jq -r '.data.status // "unknown"' "$TMP/request_poll.json")
    
    # Handle missing tasks array gracefully
    TASKS_VAL=$(jq -r '.data.tasks' "$TMP/request_poll.json")
    if [ "$TASKS_VAL" == "null" ]; then
        TASKS_COMPLETED=0
        TOTAL_TASKS=0
        echo "   [$((COUNT*5))s] Status: $STATUS | Tasks: (none yet)"
    else
        TASKS_COMPLETED=$(jq -r '[.data.tasks[] | select(.status=="completed")] | length' "$TMP/request_poll.json")
        TOTAL_TASKS=$(jq -r '.data.tasks | length' "$TMP/request_poll.json")
        echo "   [$((COUNT*5))s] Status: $STATUS | Tasks: $TASKS_COMPLETED / $TOTAL_TASKS"
        
        # Check for failure in tasks
        FAILED_TASKS=$(jq -r '[.data.tasks[] | select(.status=="failed")] | length' "$TMP/request_poll.json")
        if [ "$FAILED_TASKS" -gt 0 ]; then
            echo "   ⚠️  One or more tasks failed!"
            # Don't exit yet, might be retrying
        fi
    fi

    ((COUNT++))
done

# 6. Report
echo ""
if [ "$STATUS" == "completed" ]; then
    echo "✅ SUCCESS: Request completed!"
    echo "   Output URL: $(jq -r '.data.output.url // "No URL found"' "$TMP/request_poll.json")"
else 
    echo "❌ FAILED or TIMED OUT"
    echo "   Final Status: $STATUS"
    curl -s -b "$TMP/cookies.txt" "$BASE/api/v1/requests/$REQUEST_ID/events" -o "$TMP/request_events_final.json"
    echo "   Recent Events:"
    jq -r '.data[-3:]' "$TMP/request_events_final.json"
fi

# 7. Cleanup (Optional - kept user for inspection if needed, or delete)
# echo "7) Cleaning up..."
# curl -s -X DELETE "$BASE/api/debug/create-test-user" -H "Content-Type: application/json" -d "{\"user_id\": \"$USER_ID\"}" >/dev/null

echo "Done."
