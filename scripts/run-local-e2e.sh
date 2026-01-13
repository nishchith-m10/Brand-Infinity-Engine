#!/usr/bin/env bash
set -euo pipefail
TMP="/tmp/brand-infinity-e2e"
BASE="http://localhost:3000"
mkdir -p "$TMP"

command -v jq >/dev/null 2>&1 || { echo "jq is required. Install jq and retry." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl is required. Install curl and retry." >&2; exit 1; }

echo "Running local E2E: create user -> sign in -> create request -> simulate callback -> cleanup"

# 0. sanity check server
if ! curl -sSf "$BASE/" >/dev/null; then
  echo "Local server not reachable at $BASE. Start dev server (npm run dev) and retry." >&2
  exit 1
fi

# 1. create test user (idempotent; will create a new one each run)
echo "1) Creating test user..."
curl -sS -X POST "$BASE/api/debug/create-test-user" -H "Content-Type: application/json" -d '{}' -o "$TMP/create_resp.json"
jq . "$TMP/create_resp.json"
USER_ID=$(jq -r '.data.user.id // empty' "$TMP/create_resp.json")
ACCESS_TOKEN=$(jq -r '.data.tokens.access_token // empty' "$TMP/create_resp.json")
REFRESH_TOKEN=$(jq -r '.data.tokens.refresh_token // empty' "$TMP/create_resp.json")

if [[ -z "$USER_ID" || -z "$ACCESS_TOKEN" ]]; then
  echo "Failed to create user or get tokens" >&2
  exit 2
fi

# 2. store session
echo "2) Storing session and capturing cookies..."
jq -n --arg a "$ACCESS_TOKEN" --arg r "$REFRESH_TOKEN" '{access_token:$a,refresh_token:$r}' > "$TMP/tokens_payload.json"
curl -s -c "$TMP/cookies.txt" -X POST "$BASE/api/auth/store-session" -H "Content-Type: application/json" -d @"$TMP/tokens_payload.json" -o "$TMP/store_session_resp.json"
jq . "$TMP/store_session_resp.json"

# 3. verify auth
echo "3) Verifying session..."
curl -s -b "$TMP/cookies.txt" "$BASE/api/auth/session" -o "$TMP/session_check.json"
jq . "$TMP/session_check.json"

AUTH_OK=$(jq -r '.authenticated // false' "$TMP/session_check.json")
if [ "$AUTH_OK" != "true" ]; then
  echo "Auth not established; aborting." >&2
  exit 3
fi

# 4. create request (needs a brand id) - uses local .env.local service key
SUPABASE_URL=$(grep -E '^SUPABASE_URL=' .env.local | cut -d'=' -f2- || true)
SERVICE_KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d'=' -f2- || true)
if [[ -z "$SUPABASE_URL" || -z "$SERVICE_KEY" ]]; then
  echo "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local. Aborting." >&2
  exit 4
fi

BRAND_ID=$(curl -s -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" "$SUPABASE_URL/rest/v1/brands?select=id&limit=1" | jq -r '.[0].id // empty')
if [ -z "$BRAND_ID" ]; then
  echo "No brand id found (create a brand first). Aborting." >&2
  exit 5
fi

PAYLOAD=$(jq -n --arg brand_id "$BRAND_ID" '{brand_id: $brand_id, title: "E2E test request", type: "video_with_vo", requirements: { prompt: "E2E test video", duration: 15 }}')

echo "4) Creating request..."
curl -s -b "$TMP/cookies.txt" -X POST "$BASE/api/v1/requests" -H "Content-Type: application/json" -d "$PAYLOAD" -o "$TMP/create_request.json"
jq . "$TMP/create_request.json"
REQUEST_ID=$(jq -r '.data.id // empty' "$TMP/create_request.json")
if [ -z "$REQUEST_ID" ]; then
  echo "Request creation failed or returned no id" >&2
  exit 6
fi

# 5. request detail & events
curl -s -b "$TMP/cookies.txt" "$BASE/api/v1/requests/$REQUEST_ID" -o "$TMP/request_detail.json"
curl -s -b "$TMP/cookies.txt" "$BASE/api/v1/requests/$REQUEST_ID/events" -o "$TMP/request_events.json"

jq . "$TMP/request_detail.json" || true
jq . "$TMP/request_events.json" || true

TASK_ID=$(jq -r '.data.tasks[0].id // empty' "$TMP/request_detail.json" || true)
if [ -n "$TASK_ID" ]; then
  echo "6) Simulating n8n callback for task $TASK_ID"
  CB_PAY=$(jq -n --arg requestId "$REQUEST_ID" --arg taskId "$TASK_ID" '{requestId:$requestId, taskId:$taskId, executionId:"exec-local", status:"success", result:{output_url:"https://example.com/video.mp4"}}')
  curl -s -X POST "$BASE/api/v1/callbacks/n8n" -H "Content-Type: application/json" -d "$CB_PAY" -o "$TMP/callback_resp.json"
  jq . "$TMP/callback_resp.json" || true
  curl -s -b "$TMP/cookies.txt" "$BASE/api/v1/requests/$REQUEST_ID/events" -o "$TMP/request_events_after.json"
  jq . "$TMP/request_events_after.json" || true
else
  echo "No task found to simulate callback."
fi

# 7. cleanup (authenticated delete request + admin delete user)
echo "7) Deleting request via API and removing test user"
curl -s -b "$TMP/cookies.txt" -X DELETE "$BASE/api/v1/requests/$REQUEST_ID" -o "$TMP/delete_request_resp.json" || true
jq . "$TMP/delete_request_resp.json" || true

curl -s -X DELETE "$BASE/api/debug/create-test-user" -H "Content-Type: application/json" -d "{\"user_id\": \"$USER_ID\"}" -o "$TMP/delete_user_resp.json" || true
jq . "$TMP/delete_user_resp.json" || true

# 8. Final summary
jq -n --arg user "$USER_ID" --arg request "$REQUEST_ID" --argjson createResp "$(jq . "$TMP/create_resp.json")" --argjson reqResp "$(jq . "$TMP/create_request.json")" '{success:true,user_id:$user,request_id:$request,create:createResp,request:reqResp}' > "$TMP/e2e_summary.json"

echo "E2E finished — summary saved to $TMP/e2e_summary.json"
jq . "$TMP/e2e_summary.json"

exit 0
