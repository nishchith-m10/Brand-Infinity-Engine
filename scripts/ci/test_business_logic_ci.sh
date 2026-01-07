#!/usr/bin/env bash
set -eo pipefail

REPEATS=${1:-${REPEATS:-50}}
LOG_DIR=/tmp/test_runs_logs
mkdir -p "$LOG_DIR"
METRICS_FILE="$LOG_DIR/metrics.json"
METRICS_CSV="$LOG_DIR/metrics.csv"
METRICS_TMP="$LOG_DIR/metrics.tmp"
# Initialize metrics files
echo "[]" > "$METRICS_FILE"
echo "run,status,results_line" > "$METRICS_CSV"
: > "$METRICS_TMP"

export API_BASE_URL=${API_BASE_URL:-http://localhost:3000/api/v1}

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY must be provided via env (CI secret)"
  exit 2
fi
SRK="$SUPABASE_SERVICE_ROLE_KEY"

# Start dev server
echo "Starting dev server..."
nohup npm run dev > /tmp/next-dev.log 2>&1 & echo $! > /tmp/next-dev.pid

# Wait for server to be ready
echo "Waiting for server to respond at $API_BASE_URL..."
for i in $(seq 1 60); do
  if curl -sS "$API_BASE_URL/campaigns" >/dev/null 2>&1; then
    echo "Server ready"
    break
  fi
  echo "Waiting... ($i)"; sleep 2
  if [ "$i" -eq 60 ]; then
    echo "Server did not become ready in time — dumping tail"
    tail -n 200 /tmp/next-dev.log || true
    exit 3
  fi
done

FAIL_COUNT=0

for i in $(seq 1 "$REPEATS"); do
  RUN_LOG="$LOG_DIR/run-$i.log"
  echo "=== RUN $i ===" | tee "$RUN_LOG"

  # create test user
  if ! curl -sS -X POST http://localhost:3000/api/debug/create-test-user -H 'Content-Type: application/json' -d '{}' -o /tmp/create_user_$i.json; then
    echo "create-test-user failed" | tee -a "$RUN_LOG"
    FAIL_COUNT=$((FAIL_COUNT+1))
    continue
  fi

  ACCESS_TOKEN=$(jq -r '.data.tokens.access_token' /tmp/create_user_$i.json)
  REFRESH_TOKEN=$(jq -r '.data.tokens.refresh_token' /tmp/create_user_$i.json)

  # store server-side session and capture cookies
  COOKIES_FILE="/tmp/cookies_test_run_${i}.txt"
  curl -sS -X POST http://localhost:3000/api/auth/store-session -H 'Content-Type: application/json' -d "{\"access_token\":\"$ACCESS_TOKEN\",\"refresh_token\":\"$REFRESH_TOKEN\"}" -c "$COOKIES_FILE" -o /dev/null || true

  BRAND_OWNER_ID=$(jq -r '.data.user.id' /tmp/create_user_$i.json)

  # create brand via service role
  curl -s -X POST "https://vciscdagwhdpstaviakz.supabase.co/rest/v1/brands" \
    -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" \
    -d "{\"owner_id\": \"$BRAND_OWNER_ID\", \"name\": \"E2E Brand Run $i\", \"brand_voice\": \"Neutral\", \"brand_colors\": \"#111111\", \"target_audience\": \"Developers\" }" \
    -o "$LOG_DIR/brand_$i.json" || true

  BRAND_ID=$(jq -r '.[0].id // .id // empty' "$LOG_DIR/brand_$i.json")
  if [ -z "$BRAND_ID" ]; then
    echo "brand creation failed" | tee -a "$RUN_LOG"
    FAIL_COUNT=$((FAIL_COUNT+1))
    continue
  fi

  # create campaign as user (cookie)
  curl -s -X POST "$API_BASE_URL/campaigns" -b "$COOKIES_FILE" -H "Content-Type: application/json" -d "{\"campaign_name\":\"E2E Campaign Run $i\",\"brand_id\":\"$BRAND_ID\",\"budget_tier\":\"low\",\"campaign_objective\":\"e2e test\"}" -o "$LOG_DIR/new_campaign_$i.json" || true

  CAMPAIGN_ID=$(jq -r '.data.id // .id // empty' "$LOG_DIR/new_campaign_$i.json")
  if [ -z "$CAMPAIGN_ID" ]; then
    echo "campaign create failed" | tee -a "$RUN_LOG"
    FAIL_COUNT=$((FAIL_COUNT+1))
    continue
  fi

  # set small budget
  curl -s -X PUT "$API_BASE_URL/campaigns/$CAMPAIGN_ID" -b "$COOKIES_FILE" -H "Content-Type: application/json" -d '{"budget_limit_usd":0.1}' -o "$LOG_DIR/update_campaign_$i.json" || true

  # create completed video job by service role
  curl -s -X POST "https://vciscdagwhdpstaviakz.supabase.co/rest/v1/generation_jobs" -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" -d "{ \"campaign_id\": \"$CAMPAIGN_ID\", \"job_type\": \"video\", \"status\": \"completed\", \"model_name\": \"video-engine-v1\", \"prompt\": \"E2E test video prompt run $i\", \"metadata\": { \"note\": \"e2e video for approval run $i\" } }" -o "$LOG_DIR/new_video_$i.json" || true

  VIDEO_ID=$(jq -r '.[0].id // .id // empty' "$LOG_DIR/new_video_$i.json")
  echo "Run #$i: CAMPAIGN_ID=$CAMPAIGN_ID VIDEO_ID=$VIDEO_ID" | tee -a "$RUN_LOG"

  # execute tests
  export CAMPAIGN_ID VIDEO_ID AUTH_TOKEN="$ACCESS_TOKEN"
  ./scripts/test-business-logic.sh 2>&1 | tee -a "$RUN_LOG" || true

  # parse results line
  RESULTS_LINE=$(grep -m1 "Results:" "$RUN_LOG" || true)
  if [ -n "$RESULTS_LINE" ]; then
    if echo "$RESULTS_LINE" | grep -q "0 failed"; then
      STATUS="passed"
    else
      STATUS="partial"
    fi
  else
    STATUS="error"
    RESULTS_LINE="(no results line found)"
  fi

  # append to metrics files
  # escape results line for JSON
  ESCAPED_RESULTS_LINE=$(jq -Rn --arg s "$RESULTS_LINE" '$s')
  echo "{\"run\":$i,\"status\":\"$STATUS\",\"results_line\":$ESCAPED_RESULTS_LINE }" >> "$METRICS_TMP"
  echo "$i,$STATUS,\"$RESULTS_LINE\"" >> "$METRICS_CSV"

  # quick tail summary
  tail -n 40 "$RUN_LOG" > "$LOG_DIR/run-${i}-tail.log"
  echo "=== END RUN $i (log: $RUN_LOG) ==="
  sleep 2
done

# summarize
for f in $LOG_DIR/run-*.log; do echo "--- $f ---"; grep -n "PASS\|FAIL\|Results:" "$f" | sed -n '1,200p'; done > "$LOG_DIR/summary.txt"

echo "Summary written to $LOG_DIR/summary.txt"
cat "$LOG_DIR/summary.txt" || true

# assemble metrics.json from tmp entries
echo "[" > "$METRICS_FILE"
FIRST=true
while read -r line; do
  if [ "$FIRST" = true ]; then
    echo "  $line" >> "$METRICS_FILE"
    FIRST=false
  else
    echo ", $line" >> "$METRICS_FILE"
  fi
done < "$METRICS_TMP"
echo "]" >> "$METRICS_FILE"

# generate summary
TOTAL_RUNS=$(jq 'length' "$METRICS_FILE")
PASSED_RUNS=$(jq '[.[] | select(.status=="passed")] | length' "$METRICS_FILE")
PARTIAL_RUNS=$(jq '[.[] | select(.status=="partial")] | length' "$METRICS_FILE")
ERROR_RUNS=$(jq '[.[] | select(.status=="error")] | length' "$METRICS_FILE")

PASS_RATE=$(awk "BEGIN { if ($TOTAL_RUNS==0) print 0; else printf \"%.2f\", ($PASSED_RUNS/$TOTAL_RUNS)*100 }")

cat > "$LOG_DIR/metrics_summary.json" <<EOF
{
  "total_runs": $TOTAL_RUNS,
  "passed_runs": $PASSED_RUNS,
  "partial_runs": $PARTIAL_RUNS,
  "error_runs": $ERROR_RUNS,
  "pass_rate_percent": $PASS_RATE
}
EOF

echo "Metrics written to $METRICS_FILE and $LOG_DIR/metrics_summary.json"
cat "$LOG_DIR/metrics_summary.json" || true

# exit codes: errors -> 2, partials -> 1, all pass -> 0
if [ "$ERROR_RUNS" -gt 0 ]; then
  echo "One or more runs had errors. See logs in $LOG_DIR"
  exit 2
elif [ "$PARTIAL_RUNS" -gt 0 ]; then
  echo "One or more runs were partial (some tests failed). See logs in $LOG_DIR"
  exit 1
else
  echo "All runs passed"
  exit 0
fi
