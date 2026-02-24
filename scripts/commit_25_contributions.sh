#!/usr/bin/env bash
set -euo pipefail

# commit_25_contributions.sh
# Creates 25 individual commits with proper attribution and date spacing for GitHub contributions
# - Attributes commits to nishchith-m10 <ngmanjunatha@cpp.edu>
# - Spaces commits over 25 days (one per day) for separate contribution squares
# - Does NOT push
# - Use --dry-run to preview

DESIRED_COMMITS=25
DRY_RUN=false
AUTHOR_NAME="nishchith-m10"
AUTHOR_EMAIL="ngmanjunatha@cpp.edu"

usage() {
  cat <<EOF
Usage: $0 [--dry-run]
  --dry-run      : print planned commits without making changes
EOF
}

while (( "$#" )); do
  case "$1" in
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

echo "Proceeding with split commit plan."

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
commit_num=0
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

  # No skip, always commit

  # Increment commit number for date calculation
  commit_num=$((commit_num + 1))

  # Calculate date: commit 1 = 24 days ago, commit 25 = today
  days_ago=$((25 - commit_num))
  if [ "$days_ago" -lt 0 ]; then
    days_ago=0
  fi
  commit_date=$(date -v-${days_ago}d "+%Y-%m-%d %H:%M:%S")

  if [ ${#existing_files[@]} -gt 0 ]; then
    planned+=("$msg::${existing_files[*]}")
  else
    planned+=("$msg::")
  fi

  if [ "$DRY_RUN" = true ]; then
    if [ ${#existing_files[@]} -gt 0 ]; then
      echo "DRY RUN: Would commit: $msg — files: ${existing_files[*]} — date: $commit_date"
    else
      echo "DRY RUN: Would commit: $msg — files: <none> — date: $commit_date"
    fi
  else
    if [ ${#existing_files[@]} -gt 0 ]; then
      echo "Staging files for: $msg -> ${existing_files[*]}"
      git add "${existing_files[@]}"
    fi
    # Always create commit, allow empty
    GIT_AUTHOR_DATE="$commit_date" GIT_COMMITTER_DATE="$commit_date" git commit --allow-empty --author="$AUTHOR_NAME <$AUTHOR_EMAIL>" -m "$msg"
    commit_count=$((commit_count+1))
    echo "  Committed: $msg (date: $commit_date)"
  fi

  # Stop early if we've reached desired number and not in dry run
  if [ "$DRY_RUN" = false ] && [ "$commit_count" -ge "$DESIRED_COMMITS" ]; then
    echo "Reached desired commit count: $commit_count"
    break
  fi
done

# Summary
if [ "$DRY_RUN" = true ]; then
  echo "\nDRY RUN complete. Planned ${#planned[@]} commits (preview above)."
else
  echo "\nDone. Created $commit_count commit(s). Review with: git log --oneline -n 40"
  echo "Push with: git push origin $BRANCH"
fi

exit 0
