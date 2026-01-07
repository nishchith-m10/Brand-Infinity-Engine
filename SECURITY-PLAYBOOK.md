# Security Playbook — Incident response for leaked credentials

This playbook supplements `SECURITY.md` with step-by-step actions for discovery, rotation, communication, and (if required) git history purge.

## 1) Immediate actions (first 0–30 minutes)
- Rotate or revoke the exposed credential in the provider console immediately (Supabase, OpenAI, Sentry, Upstash, etc.).
- Replace the credential in any CI secret store (GitHub Actions Secrets, Vercel, etc.) with the rotated value.
- If the leak is in production or public, escalate to security/ops lead and the incident response team.

## 2) Short-term containment (0.5–4 hours)
- Remove tracked files containing secrets (e.g., `git rm --cached <file>`), and add appropriate `.gitignore` entries.
- Add redacted example files (e.g., `.env.sentry-build-plugin.example`).
- Run the repo secret scanner: `./scripts/ci/secret_scan.sh . tmp_secret_scan_output`.
- Upload scanner output as CI artifacts for triage.

## 3) Clean history (coordinate, 4–24 hours)
DO NOT rewrite public history without coordination. Recommended steps:
- Create a repository backup branch: `git branch backup/<timestamp>` and push it to a secure, private location.
- Use `git filter-repo` or BFG to remove secrets from history; prefer `git filter-repo --replace-text replacer.txt` where `replacer.txt` contains exact mappings.
- Verify the repository locally, then coordinate a force-push and communicate to all contributors how to rebase their work.
- If unsure, request help from the security/ops lead.

## 4) Post-incident (24–72 hours)
- Confirm rotations and that no further artifacts contain the leaked secret.
- Update `SECURITY.md` with the incident summary and lessons learned (redacted).
- Consider adding longer-term mitigations (secret scanning in pre-commit + CI, stricter PR checks, periodic scans).

## 5) Templates
- Rotation notification (short):
  Subject: "Rotate credential: [SERVICE] key leaked"
  Body: "We discovered [key] exposed in repo at [paths]. The key is rotated/revoked. Please update any services using it and confirm completion. If you have outstanding branches, rebase after history rewrite as instructed. Contact: @security-lead."

- Git-history purge announcement:
  "We will rewrite history to remove leaked values. Steps: backup branch, run filter-repo, force-push, and then each contributor must rebase using `git fetch && git rebase origin/main`. Coordination window: <time>"

## 6) Contact & reporting
- If you lack permission to rotate the credential in a provider, escalate to on-call or security lead immediately.
- For severe incidents, follow company incident response communication channels (e.g., Slack #security, pager duty).

---
For detailed step examples and automated helper scripts see `scripts/secrets/purge_secrets.sh` and `SECURITY.md`.
