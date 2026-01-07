#!/usr/bin/env bash
set -euo pipefail

# Safe helper to prepare a git history purge using git-filter-repo (NOT destructive by default)
# Usage: ./scripts/secrets/purge_secrets.sh --dry-run

DRY_RUN=1
if [ "${1:-}" = "--apply" ]; then
  DRY_RUN=0
fi

echo "This script will help create a git-filter-repo replace file and a plan to purge secrets from history."

echo "Step 1: Searching for candidate secret-like strings"
TMP_MATCHES="/tmp/potential_secrets_matches.txt"
rm -f "$TMP_MATCHES"

# Patterns we consider sensitive; adjust as needed.
CANDIDATE_PATTERNS=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "SUPABASE_ANON_KEY"
  "OPENAI_API_KEY"
  "SENTRY_AUTH_TOKEN"
  "UPSTASH_REDIS_REST_TOKEN"
  "N8N_WEBHOOK_SECRET"
  "JWT_SECRET"
  "ENCRYPTION_KEY"
)

for p in "${CANDIDATE_PATTERNS[@]}"; do
  grep -RIn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=tmp_secret_scan_output "$p" . || true
done | tee "$TMP_MATCHES"

echo
if [ ! -s "$TMP_MATCHES" ]; then
  echo "No obvious secrets found by token name. You can run the grep-based secret scanner for more coverage: ./scripts/ci/secret_scan.sh"
else
  echo "Potential occurrences written to $TMP_MATCHES — inspect and confirm the strings to redact."
fi

cat <<EOF

Step 2: Construct a replace file for git-filter-repo (manual review required)
- Install git-filter-repo: https://github.com/newren/git-filter-repo
- Create a file (e.g., replacer.txt) that maps the exact secret values to a redaction token, e.g.:
    literal-secret-value==>[REDACTED]

Step 3: Dry-run and backup
- Create a branch backup: git branch backup/$(date +%s)
- Do a dry run by inspecting the replacer and verifying with filter-repo's --replace-text option (no direct dry-run flag; run on a local clone)

Step 4: Apply (careful, this rewrites history)
- git filter-repo --replace-text replacer.txt
- Force push to the remote and coordinate with all contributors to rebase: git push --force --all && git push --force --tags

IMPORTANT: Do NOT run this on main without coordination. Coordinate with repo owners. After rewriting history, rotate and revoke the exposed credentials immediately.

If you're ready to generate an initial replacer file of the matches found above, run this script again with --generate-replacer > replacer.txt (unsafe) or manually curate the replacer from $TMP_MATCHES.

EOF

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run complete. Review $TMP_MATCHES and follow the instructions above to proceed with an actual purge."
else
  echo "No automated apply implemented. This script intentionally requires manual steps to avoid accidental destructive history rewrites."
fi
