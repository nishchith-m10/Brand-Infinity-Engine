Commit Plan — 25 focused commits

Overview
- Goal: produce 25 professional, focused commits on `main` without rewriting history.
- Script: `scripts/split_commits.sh` (idempotent; default will only commit real file changes).
- If you want exactly 25 commits and there are fewer actual changes, run the script with `--allow-empty` to create non-destructive empty filler commits.

Proposed commit list (messages + file groups)

1. feat(ui): campaign selector — icon color (light mode)
   - targets: components/CampaignSelector.tsx (icon color change)

2. feat(ui): campaign selector — caret color (light mode)
   - targets: components/CampaignSelector.tsx (chevron color)

3. fix(ui): campaign dropdown items color
   - targets: components/CampaignSelector.tsx (dropdown item color class)

4. fix(ui): campaign trigger text color (inline style)
   - targets: components/CampaignSelector.tsx (trigger span inline style)

5. fix(ui): folder icon color inline style
   - targets: components/CampaignSelector.tsx (folder icon style)

6. fix(ui): chevron inline color
   - targets: components/CampaignSelector.tsx (chevron inline style)

7. fix(navbar): ensure username color consistent
   - targets: components/Navbar.tsx (username text class)

8. fix(layout): suppress hydration mismatch on <html>
   - targets: app/layout.tsx (add suppressHydrationWarning)

9. fix(layout): dashboard container scroll (overflow-auto)
   - targets: app/(dashboard)/layout.tsx (overflow-auto & min-h-0)

10. chore(env): document NEXT_PUBLIC_SUPABASE_* in .env.example
    - targets: .env.example

11. chore(env): document NEXT_PUBLIC_MASTER_UNLOCK_KEY in .env.example
    - targets: .env.example

12. chore(env): document DASHBOARD_PASSCODE in .env.example
    - targets: .env.example

13. feat(security): add .vercel_env to .gitignore and remove sensitive file
    - targets: .vercel_env (remove), .gitignore (update)

14. fix(passcode): passcode API returns proper cookie when valid
    - targets: app/api/verify-passcode/route.ts (existing logic validates env var)

15. chore(docs): update unlock key testing docs
    - targets: docs/UNLOCK_KEY_TESTING.md

16. chore(docs): add local E2E run instructions
    - targets: docs/LOCAL_E2E.md

17. chore(scripts): add run-local-e2e helper
    - targets: scripts/run-local-e2e.sh

18. style(ui): small CampaignSelector spacing & hover tweaks
    - targets: components/CampaignSelector.tsx

19. style(ui): dropdown item button explicit color class
    - targets: components/CampaignSelector.tsx

20. chore: tidy imports and minor code style fixes
    - targets: multiple files (formatting / imports)

21. refactor(auth): narrow auth provider types
    - targets: lib/auth/auth-provider.tsx

22. fix(supabase): guard createClient env access with clearer message
    - targets: lib/supabase/client.ts

23. chore: finalize TypeScript fixes summary doc
    - targets: TYPESCRIPT_FIXES_SUMMARY.md

24. test: add/adjust E2E artifacts and tmp paths
    - targets: scripts / test-related files

25. chore: (optional) filler commit to reach 25 (use --allow-empty)

Notes & next steps
- The script will only stage and commit files that exist. If fewer than 25 real commits are possible, add `--allow-empty` to create empty filler commits up to 25.
- **Security**: the script intentionally avoids committing `.env.local`. Instead it updates `.env.example` with placeholders.
- Review the commit messages in this file and edit before running the script if you want different wording.

How to run
1. From repo root: `chmod +x scripts/split_commits.sh`
2. Dry run: `./scripts/split_commits.sh --dry-run`
3. Execute (no empty commits): `./scripts/split_commits.sh`
4. Execute and allow filler empty commits: `./scripts/split_commits.sh --allow-empty`

After running
- Inspect commits: `git log --oneline -n 40`
- Push when happy: `git push origin <branch>` (script will not push)

