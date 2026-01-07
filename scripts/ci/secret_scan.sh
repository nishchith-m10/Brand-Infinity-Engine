#!/usr/bin/env bash
set -euo pipefail

# Simple secret scanning script (grep-based)
# Exits with 0 if no potential secrets found, 1 otherwise

ROOT_DIR=${1:-"."}
OUT_DIR=${2:-"/tmp/secret_scan_output"}
mkdir -p "$OUT_DIR"
REPORT_JSON="$OUT_DIR/secret_scan_report.json"

echo "Scanning repo for likely hardcoded secrets..."

# Files/paths to exclude (comma-separated patterns)
EXCLUDE_GLOBS=("node_modules" "dist" "build" ".git" "coverage" "docker" "supabase/supabase/.temp")
EXCLUDE_ARGS=()
for g in "${EXCLUDE_GLOBS[@]}"; do
  EXCLUDE_ARGS+=(--exclude-dir="$g")
done

# Patterns to search for (PCRE)
PATTERNS=(
  # JWT-like token starting with eyJ and long base64 (common in JWT / supabase keys)
  "eyJ[A-Za-z0-9_\-]{40,}"
  # AWS Access Key ID
  "AKIA[0-9A-Z]{16}"
  # PEM private key blocks
  "-----BEGIN (RSA |)PRIVATE KEY-----"
  # Generic long base64-looking values assigned to env vars or config
  "=[\"']?[A-Za-z0-9_\-]{40,}[\"']?"
  # Supabase service role key name explicitly
  "SUPABASE_SERVICE_ROLE_KEY"
  # Generic API keys common prefixes
  "sk-[A-Za-z0-9_-]{20,}"
  "pk-[A-Za-z0-9_-]{20,}"
)

MATCHES=()

# Detect grep PCRE support; fall back to -E if not available
GREP_PCRE_FLAG="-P"
if ! grep -P "" /dev/null >/dev/null 2>&1; then
  GREP_PCRE_FLAG="-E"
fi

for pat in "${PATTERNS[@]}"; do
  echo "Searching for pattern: $pat"
  # Use grep with -r, -n, -I to skip binary
  # Build exclude arguments
  res=$(grep -r -n -I $GREP_PCRE_FLAG --line-number "${pat}" "$ROOT_DIR" "${EXCLUDE_ARGS[@]}" 2>/dev/null || true)
  if [ -n "$res" ]; then
    echo "Matches found for pattern: $pat"
    echo "$res" >> "$OUT_DIR/secret_scan_matches.txt"
    MATCHES+=("$pat")
  fi
done

# Also search for lines that look like environment variable assignments with long values
ENV_MATCH=$(grep -r -n -I --line-number "^[A-Za-z0-9_]+=[\"']?[A-Za-z0-9_\-\./+]{40,}[\"']?" "$ROOT_DIR" "${EXCLUDE_ARGS[@]}" 2>/dev/null || true)
if [ -n "$ENV_MATCH" ]; then
  echo "Environment-like long values found"
  echo "$ENV_MATCH" >> "$OUT_DIR/secret_scan_matches.txt"
  MATCHES+=("ENV_LONG_VALUES")
fi

TOTAL_MATCHES=0
if [ -f "$OUT_DIR/secret_scan_matches.txt" ]; then
  TOTAL_MATCHES=$(wc -l < "$OUT_DIR/secret_scan_matches.txt" | tr -d ' ')
fi

# Create JSON report
jq -n --arg repo "$(basename "$PWD")" --arg root "$ROOT_DIR" --argjson matches_count "$TOTAL_MATCHES" '{repo: $repo, root: $root, matches_count: $matches_count, timestamp: (now|todate), findings: []}' > "$REPORT_JSON"

if [ "$TOTAL_MATCHES" -gt 0 ]; then
  echo "Potential secrets found: $TOTAL_MATCHES" >&2
  echo "See $OUT_DIR/secret_scan_matches.txt for details"
  # Print a short sample (first 200 lines)
  echo "--- Sample matches ---"
  head -n 200 "$OUT_DIR/secret_scan_matches.txt" || true
  exit 1
else
  echo "No probable secrets found."
  exit 0
fi
