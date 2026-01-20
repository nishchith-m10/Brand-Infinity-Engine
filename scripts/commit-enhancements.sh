#!/bin/bash

# Commit script for creative director enhancements
# Author: nishchith-m10

AUTHOR="nishchith-m10 <nishchith@example.com>"
DRY_RUN=${1:-"--dry-run"}

echo "================================================"
echo "Creative Director Enhancement Commits"
echo "Branch: enhance-creative-director-system"
echo "Author: $AUTHOR"
echo "Mode: $DRY_RUN"
echo "================================================"
echo ""

# Function to commit a file or group of files
commit_files() {
  local message="$1"
  shift
  local files=("$@")
  
  echo "---"
  echo "Commit: $message"
  echo "Files:"
  for file in "${files[@]}"; do
    echo "  - $file"
  done
  
  if [ "$DRY_RUN" = "--execute" ]; then
    git add "${files[@]}"
    git commit --author="$AUTHOR" -m "$message"
    echo "✓ Committed"
  else
    echo "[DRY RUN - would commit]"
  fi
  echo ""
}

# Commit 1: StepValidator enhancements
commit_files "feat(orchestrator): enhance StepValidator with quality scoring and auto-fix" \
  "lib/orchestrator/StepValidator.ts"

# Commit 2: CheckpointManager enhancements
commit_files "feat(orchestrator): add resume capabilities to CheckpointManager" \
  "lib/orchestrator/CheckpointManager.ts"

# Commit 3: DynamicSOPComposer
commit_files "feat(sops): add DynamicSOPComposer for adaptive workflow generation" \
  "lib/sops/DynamicSOPComposer.ts"

# Commit 4: SOP Templates
commit_files "feat(sops): add template library for common content scenarios" \
  "lib/sops/templates/index.ts"

# Commit 5: TaskModelSelector
commit_files "feat(llm): add TaskModelSelector for intelligent model selection" \
  "lib/llm/TaskModelSelector.ts"

# Commit 6: SOPExecutor enhancements
commit_files "feat(orchestrator): integrate quality gates and validation into SOPExecutor" \
  "lib/orchestrator/SOPExecutor.ts"

# Commit 7: Executive Agent enhancements
commit_files "feat(agents): integrate DynamicSOPComposer and templates into Executive agent" \
  "lib/agents/executive.ts"

# Commit 8: RequestForm UX improvements
commit_files "feat(ui): add smart fields and real-time validation to RequestForm" \
  "components/pipeline/RequestForm.tsx"

# Commit 9: API error handling
commit_files "feat(api): improve error messages and validation feedback in requests API" \
  "app/api/v1/requests/route.ts"

# Commit 10: Documentation
commit_files "docs: add comprehensive enhancements summary" \
  "ENHANCEMENTS_SUMMARY.md"

echo "================================================"
if [ "$DRY_RUN" = "--execute" ]; then
  echo "✓ All commits completed!"
  echo ""
  echo "Summary:"
  git log --oneline --author="nishchith-m10" -10
else
  echo "DRY RUN COMPLETE"
  echo ""
  echo "To execute these commits, run:"
  echo "  bash scripts/commit-enhancements.sh --execute"
fi
echo "================================================"
