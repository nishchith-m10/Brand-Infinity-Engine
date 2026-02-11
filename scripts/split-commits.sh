#!/usr/bin/env bash

# =============================================================================
# Split Git Commits Script
# Creates multiple commits from staged changes to boost GitHub contributions
# =============================================================================

set -e

# Configuration
TARGET_COMMITS=75
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)

echo "🚀 Split Commits Script"
echo "======================="
echo "Branch: $BRANCH_NAME"
echo "Target commits: $TARGET_COMMITS"
echo ""

# Check if there are changes to commit
if git diff --quiet && git diff --cached --quiet; then
  echo "❌ No changes to commit"
  exit 1
fi

# Stage all changes if not already staged
echo "📦 Staging all changes..."
git add -A

# Get list of all changed files
CHANGED_FILES=$(git diff --cached --name-only)
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | xargs)

echo "📊 Found $FILE_COUNT changed files"
echo ""

if [ "$FILE_COUNT" -lt "$TARGET_COMMITS" ]; then
  echo "⚠️  Warning: Only $FILE_COUNT files, creating $FILE_COUNT commits instead of $TARGET_COMMITS"
  TARGET_COMMITS=$FILE_COUNT
fi

# Calculate files per commit
FILES_PER_COMMIT=$(( ($FILE_COUNT + $TARGET_COMMITS - 1) / $TARGET_COMMITS ))

echo "📝 Creating $TARGET_COMMITS commits ($FILES_PER_COMMIT files per commit)"
echo ""

# Unstage all files first
git reset HEAD > /dev/null 2>&1

COMMIT_COUNT=0

# Function to get commit message based on file path
get_commit_message() {
  local file="$1"
  local commit_num=$2
  
  case "$file" in
    *orchestrator*|*Orchestrator*)
      echo "feat(orchestrator): implement task orchestration system"
      ;;
    *StateMachine*)
      echo "feat(state): add state machine and status transitions"
      ;;
    *Retry*)
      echo "feat(retry): implement retry logic with exponential backoff"
      ;;
    *[Mm]etrics*)
      echo "feat(metrics): add performance metrics and monitoring"
      ;;
    *DeadLetter*|*DLQ*)
      echo "feat(dlq): implement dead letter queue for failed tasks"
      ;;
    *Timeout*)
      echo "feat(timeout): add task timeout detection and handling"
      ;;
    *Circuit*)
      echo "feat(circuit-breaker): implement circuit breaker pattern"
      ;;
    *[Ee]vent*)
      echo "feat(events): add comprehensive event logging system"
      ;;
    *types.ts)
      echo "feat(types): define TypeScript types for pipeline"
      ;;
    *.test.ts)
      echo "test: add comprehensive test coverage"
      ;;
    *video*|*Video*)
      echo "feat(video): integrate Pollo AI video generation"
      ;;
    *PipelineBoard*)
      echo "feat(pipeline): add approval stage to workflow"
      ;;
    *pipeline*)
      echo "feat(pipeline): implement content pipeline UI"
      ;;
    *estimator*)
      echo "feat(estimator): add cost and time estimation"
      ;;
    *migration*.sql)
      echo "fix(db): add missing schema migrations"
      ;;
    *)
      echo "chore: update project files (batch $commit_num/$TARGET_COMMITS)"
      ;;
  esac
}

# Process files in batches
echo "$CHANGED_FILES" | while IFS= read -r file; do
  if [ -z "$file" ]; then
    continue
  fi
  
  # Stage this file
  git add "$file"
  
  # Check if we have enough files for a commit (every 2 files)
  STAGED_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')
  
  if [ "$STAGED_COUNT" -ge "$FILES_PER_COMMIT" ] || [ "$(echo "$CHANGED_FILES" | grep -c .)" -le 1 ]; then
    COMMIT_COUNT=$((COMMIT_COUNT + 1))
    
    if [ "$COMMIT_COUNT" -gt "$TARGET_COMMITS" ]; then
      break
    fi
    
    # Get commit message
    MSG=$(get_commit_message "$file" "$COMMIT_COUNT")
    
    # Create commit
    git commit -m "$MSG" > /dev/null 2>&1
    
    echo "✅ Commit $COMMIT_COUNT/$TARGET_COMMITS: $MSG ($STAGED_COUNT files)"
  fi
done

# Commit any remaining staged files
REMAINING=$(git diff --cached --name-only | wc -l | tr -d ' ')
if [ "$REMAINING" -gt 0 ] && [ "$COMMIT_COUNT" -lt "$TARGET_COMMITS" ]; then
  COMMIT_COUNT=$((COMMIT_COUNT + 1))
  git commit -m "chore: finalize project updates" > /dev/null 2>&1
  echo "✅ Commit $COMMIT_COUNT/$TARGET_COMMITS: chore: finalize project updates ($REMAINING files)"
fi

echo ""
echo "🎉 Created $COMMIT_COUNT commits successfully!"
echo ""

# Ask to push
read -p "📤 Push all commits to GitHub? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "📡 Pushing to origin/$BRANCH_NAME..."
  git push origin $BRANCH_NAME
  echo "✅ Pushed successfully!"
  echo ""
  
  # Ask to deploy to Vercel
  read -p "🚀 Deploy to Vercel using CLI? (y/n): " -n 1 -r
  echo ""
  
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying to Vercel..."
    
    # Check if vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
      echo "❌ Vercel CLI not found. Install with: npm i -g vercel"
      exit 1
    fi
    
    # Deploy to production
    cd "$(git rev-parse --show-toplevel)/frontend"
    vercel --prod
    
    echo "✅ Deployed to Vercel!"
  else
    echo "⏭️  Skipped Vercel deployment"
  fi
else
  echo "⏭️  Skipped pushing to GitHub"
  echo ""
  echo "💡 To push manually:"
  echo "   git push origin $BRANCH_NAME"
fi

echo ""
echo "📊 GitHub Contribution Summary:"
echo "   • Commits created: $COMMIT_COUNT"
echo "   • Date: $(date +%Y-%m-%d)"
echo "   • Branch: $BRANCH_NAME"
echo ""
echo "🎯 Check your GitHub profile to see the green squares!"
