#!/usr/bin/env bash
set -euo pipefail

# commit_45_contributions_today.sh
# Creates 45 individual commits with proper attribution for GitHub contributions
# - All commits on today's date (same day contributions)
# - Attributes commits to nishchith-m10 <228442520+nishchith-m10@users.noreply.github.com>
# - Does NOT push
# - Use --dry-run to preview

DESIRED_COMMITS=45
DRY_RUN=false
AUTHOR_NAME="nishchith-m10"
AUTHOR_EMAIL="228442520+nishchith-m10@users.noreply.github.com"

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

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree has changes. Proceeding with split commit plan."
else
  echo "No working tree changes detected. Nothing to do."; exit 0
fi

# Get today's date for all commits
TODAY_DATE=$(date "+%Y-%m-%d %H:%M:%S")

# Get list of changed files
CHANGED_FILES=()
while IFS= read -r -d '' file; do
  CHANGED_FILES+=("$file")
done < <(git diff --name-only -z)

commit_count=0
planned=()

for file in "${CHANGED_FILES[@]}"; do
  if [ "$commit_count" -ge "$DESIRED_COMMITS" ]; then
    break
  fi

  # Get filename for commit message
  filename=$(basename "$file")

  if [ "$DRY_RUN" = true ]; then
    echo "DRY RUN: Would commit: chore: update $filename — file: $file — date: $TODAY_DATE"
  else
    echo "Staging file: $file"
    git add "$file"
    if git diff --cached --quiet; then
      echo "  Nothing staged for: $file, skipping." >&2
    else
      GIT_AUTHOR_DATE="$TODAY_DATE" GIT_COMMITTER_DATE="$TODAY_DATE" git commit --author="$AUTHOR_NAME <$AUTHOR_EMAIL>" -m "chore: update $filename"
      commit_count=$((commit_count+1))
      echo "  Committed: $file (date: $TODAY_DATE)"
    fi
  fi

  # Stop early if we've reached desired number and not in dry run
  if [ "$DRY_RUN" = false ] && [ "$commit_count" -ge "$DESIRED_COMMITS" ]; then
    echo "Reached desired commit count: $commit_count"
    break
  fi
done

# If we haven't reached 45 commits yet, create empty commits
if [ "$DRY_RUN" = false ] && [ "$commit_count" -lt "$DESIRED_COMMITS" ]; then
  while [ "$commit_count" -lt "$DESIRED_COMMITS" ]; do
    idx=$((commit_count+1))
    GIT_AUTHOR_DATE="$TODAY_DATE" GIT_COMMITTER_DATE="$TODAY_DATE" git commit --allow-empty --author="$AUTHOR_NAME <$AUTHOR_EMAIL>" -m "chore: contribution $idx (no-op)"
    commit_count=$((commit_count+1))
    echo "  Created empty commit: contribution $idx (date: $TODAY_DATE)"
  done
fi

# Summary
if [ "$DRY_RUN" = true ]; then
  echo "\nDRY RUN complete. Would create ${#CHANGED_FILES[@]} file commits + $(($DESIRED_COMMITS - ${#CHANGED_FILES[@]})) empty commits = $DESIRED_COMMITS total."
else
  echo "\nDone. Created $commit_count commit(s) with today's date: $TODAY_DATE"
  echo "Review with: git log --oneline -n 50"
  echo "Push with: git push origin $BRANCH"
fi

exit 0
