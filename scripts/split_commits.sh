#!/usr/bin/env bash
set -euo pipefail

# split_commits.sh
# Safe helper to create one commit per file/group using staged working tree
# - Does NOT push
# - By default only commits real file changes
# - Use --allow-empty to add empty filler commits up to the requested total
# - Use --dry-run to preview

DESIRED_COMMITS=25
ALLOW_EMPTY=false
DRY_RUN=false

usage() {
  cat <<EOF
Usage: $0 [--allow-empty] [--dry-run]
  --allow-empty  : create empty commits to reach ${DESIRED_COMMITS} commits (use if there are fewer changes)
  --dry-run      : print planned commits without making changes
EOF
}

while (( "$#" )); do
  case "$1" in
    --allow-empty) ALLOW_EMPTY=true; shift ;; 
    --dry-run) DRY_RUN=true; shift ;; 
    -h|--help) usage; exit 0 ;; 
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

# Safety
if [ ! -d .git ]; then
  echo "ERROR: no .git directory found. Run from repo root." >&2
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
  echo "Warning: you are on branch '$BRANCH'. Consider switching to 'main' if you want commits on main." >&2
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has changes. Proceeding with split commit plan." 
else
  echo "No working tree changes detected. Nothing to do."; exit 0
fi

# Commit plan mapping (message::file1 file2 ...)
PLAN=$(cat <<'EOF'
feat(ui): campaign selector — icon color (light mode)::components/CampaignSelector.tsx
feat(ui): campaign selector — caret color (light mode)::components/CampaignSelector.tsx
fix(ui): campaign dropdown items color::components/CampaignSelector.tsx
fix(ui): campaign trigger text color (inline style)::components/CampaignSelector.tsx
fix(ui): folder icon color inline style::components/CampaignSelector.tsx
fix(ui): chevron inline color::components/CampaignSelector.tsx
fix(navbar): ensure username color consistent::components/Navbar.tsx
fix(layout): suppress hydration mismatch on <html>::app/layout.tsx
fix(layout): dashboard container scroll (overflow-auto)::app/(dashboard)/layout.tsx
chore(env): document NEXT_PUBLIC_SUPABASE_* in .env.example::.env.example
chore(env): document NEXT_PUBLIC_MASTER_UNLOCK_KEY in .env.example::.env.example
chore(env): document DASHBOARD_PASSCODE in .env.example::.env.example
feat(security): add .vercel_env to .gitignore and add example file::.gitignore .vercel_env.example
fix(passcode): add DASHBOARD_PASSCODE check (server)::app/api/verify-passcode/route.ts
chore(docs): add UNLOCK key testing docs update::docs/UNLOCK_KEY_TESTING.md
chore(docs): add local E2E run instructions::docs/LOCAL_E2E.md
chore(scripts): add run-local-e2e helper::scripts/run-local-e2e.sh
style(ui): small CampaignSelector spacing & hover tweaks::components/CampaignSelector.tsx
style(ui): dropdown item button explicit color class::components/CampaignSelector.tsx
chore: tidy imports and minor code style fixes::
refactor(auth): narrow auth provider types::lib/auth/auth-provider.tsx
fix(supabase): guard createClient env access::lib/supabase/client.ts
chore: final README / typescript fixes summary::TYPESCRIPT_FIXES_SUMMARY.md
chore: filler commit to reach 25 (no-op)::
EOF
)

# If a .vercel_env file exists, create a redacted example and ensure it's added to .gitignore
if [ -e ".vercel_env" ]; then
  echo "Preparing .vercel_env.example (redacted)"
  # Create an example file with values replaced by REDACTED
  awk -F'=' 'BEGIN{OFS="="} /^#/ {print; next} NF==2 {print $1, "REDACTED"} NF!=2 {print}' .vercel_env > .vercel_env.example
  # Ensure .vercel_env is in .gitignore
  if [ ! -f .gitignore ] || ! grep -Fxq ".vercel_env" .gitignore 2>/dev/null; then
    echo ".vercel_env" >> .gitignore
  fi
fi

# Convert PLAN into array entries (portable)
ENTRIES=()
while IFS= read -r line; do
  ENTRIES+=("$line")
done <<< "$PLAN"

commit_count=0
planned=()

for entry in "${ENTRIES[@]}"; do
  # skip empty lines
  [ -z "$entry" ] && continue
  msg="${entry%%::*}"
  files_str="${entry#*::}"
  files=()
  if [ -n "$files_str" ]; then
    # split into words
    IFS=' ' read -r -a files <<< "$files_str"
  fi

  # Filter files that actually exist or are tracked
  existing_files=()
  if [ ${#files[@]} -gt 0 ]; then
    for f in "${files[@]}"; do
      if git ls-files --error-unmatch "$f" >/dev/null 2>&1 || [ -e "$f" ]; then
        existing_files+=("$f")
      fi
    done
  fi

  if [ ${#existing_files[@]} -eq 0 ] && [[ "$msg" != *"filler"* ]]; then
    echo "Skipping commit: '$msg' — no files present" >&2
    continue
  fi

  if [ ${#existing_files[@]} -gt 0 ]; then
    planned+=("$msg::${existing_files[*]}")
  else
    planned+=("$msg::")
  fi

  if [ "$DRY_RUN" = true ]; then
    if [ ${#existing_files[@]} -gt 0 ]; then
      echo "DRY RUN: Would commit: $msg — files: ${existing_files[*]}"
    else
      echo "DRY RUN: Would commit: $msg — files: <none>"
    fi
  else
    if [ ${#existing_files[@]} -gt 0 ]; then
      echo "Staging files for: $msg -> ${existing_files[*]}"
      git add "${existing_files[@]}"
      if git diff --cached --quiet; then
        echo "  Nothing staged for: $msg, skipping." >&2
      else
        git commit -m "$msg"
        commit_count=$((commit_count+1))
        echo "  Committed: $msg" 
      fi
    else
      # For filler commits without files, create empty commit only if ALLOW_EMPTY
      if [ "$ALLOW_EMPTY" = true ]; then
        git commit --allow-empty -m "$msg"
        commit_count=$((commit_count+1))
        echo "  Created empty commit: $msg" 
      else
        echo "  Skipping empty commit for: $msg (use --allow-empty to enable)" >&2
      fi
    fi
  fi

  # Stop early if we've reached desired number and not in dry run
  if [ "$DRY_RUN" = false ] && [ "$commit_count" -ge "$DESIRED_COMMITS" ]; then
    echo "Reached desired commit count: $commit_count" 
    break
  fi
done

# If not enough commits yet and --allow-empty specified, make more empty commits
if [ "$DRY_RUN" = false ] && [ "$commit_count" -lt "$DESIRED_COMMITS" ] && [ "$ALLOW_EMPTY" = true ]; then
  while [ "$commit_count" -lt "$DESIRED_COMMITS" ]; do
    idx=$((commit_count+1))
    git commit --allow-empty -m "chore(commit-count): filler commit ${idx} (no-op)"
    commit_count=$((commit_count+1))
    echo "  Added filler empty commit: ${idx}"
  done
fi

# Summary
if [ "$DRY_RUN" = true ]; then
  echo "\nDRY RUN complete. Planned ${#planned[@]} commits (preview above)." 
else
  echo "\nDone. Created $commit_count commit(s). Review with: git log --oneline -n 40"
  echo "Push with: git push origin $BRANCH"
fi

exit 0
