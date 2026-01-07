# Security guidance

If you discover sensitive credentials committed to the repository, follow these steps immediately:

1. Rotate or revoke the exposed credentials in the provider console (e.g., Supabase, OpenAI, Sentry, Upstash).
2. Remove the secret from the repository and history:
   - Remove tracked files that contain secrets (e.g., `git rm --cached <file>`).
   - To fully purge secrets from history use `git filter-repo` or BFG (coordinate with repo administrators).
3. Do not paste secrets into PRs or issue comments.
4. Use the `.env.example` or other example files for documentation; never include real values.
5. Local copies of secrets should be stored in a secure secrets manager or in local-only files that are listed in `.gitignore`.

Contact the security/ops lead if you need help rotating or revoking keys.

---

For a full response playbook, templates, and curated steps to safely purge secrets from git history, see `SECURITY-PLAYBOOK.md`.