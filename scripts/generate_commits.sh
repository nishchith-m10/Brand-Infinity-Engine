#!/bin/bash

# Script to commit all changes individually
# Usage: ./scripts/generate_commits.sh

# Ensure the script exits on error
# set -e

echo "Starting granular commit process..."

count=0
# Loop through all changes (modified, deleted, untracked)
# git status --porcelain -z produces null-terminated strings
while IFS= read -r -d '' entry; do
    # The format is "XY PATH" (where XY is status, usually 2 chars + space)
    # paths starting with " R " or similar might be tricky, but standard is:
    # "M  file", " D file", "?? file"
    # We skip the first 3 characters to get the path
    file="${entry:3}"
    
    if [ -n "$file" ]; then
        echo "Processing: $file"
        
        # Stage the specific file
        git add "$file"
        
        # Extract filename for the commit message
        filename=$(basename "$file")
        
        # Commit with a professional message
        # Using "update" as a generic action
        if git commit -m "chore: update $filename"; then
            ((count++))
            echo "[$count] Committed $file"
        else
            echo "Failed to commit $file"
        fi
        
        # Sleep briefly to ensure unique timestamps if desired (optional)
        # sleep 1
    fi
done < <(git status --porcelain -z)

echo "----------------------------------------"
echo "Total commits generated: $count"
echo "You can now push these changes."
