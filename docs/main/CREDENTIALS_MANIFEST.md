# CREDENTIALS MANIFEST
## Brand Infinity Engine - Centralized Credential Management

> **Last Updated:** December 2024  
> **Security Level:** CONFIDENTIAL  

---

## Quick Status Overview

| Category | Service | Env Variable | Status |
|----------|---------|--------------|--------|
| LLM | OpenAI | `OPENAI_API_KEY` | ⬜ Pending |
| LLM | Anthropic | `ANTHROPIC_API_KEY` | ⬜ Pending |
| LLM | DeepSeek | `DEEPSEEK_API_KEY` | ⬜ Pending |
| LLM | Gemini | `GEMINI_API_KEY` | ⬜ Pending |
| Video | NanoB | `NANOB_API_KEY` | ⬜ Pending |
| Database | Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` | ✅ Set |
| Database | Supabase Anon | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Set |
| Database | Supabase Service | `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set |
| Cache | Redis URL | `UPSTASH_REDIS_REST_URL` | ✅ Set |
| Cache | Redis Token | `UPSTASH_REDIS_REST_TOKEN` | ✅ Set |
| Automation | n8n Webhook | `N8N_WEBHOOK_URL` | ⬜ Pending |
| Automation | n8n API Key | `N8N_API_KEY` | ⬜ Pending |
| Testing | Master Unlock | `NEXT_PUBLIC_MASTER_UNLOCK_KEY` | ⬜ Pending |

**Status Legend:**
- ✅ Set - Configured and working
- ⬜ Pending - Needs configuration

---

## 1. AI APIs (LLM Providers)

### OpenAI
```bash
OPENAI_API_KEY=
```
| Field | Value |
|-------|-------|
| **Used For** | Script generation, RAG embeddings, DALL-E images |
| **Models** | GPT-4o, GPT-4o-mini, text-embedding-3-small |
| **Dashboard** | https://platform.openai.com/api-keys |
| **Status** | ⬜ Pending |

### Anthropic
```bash
ANTHROPIC_API_KEY=
```
| Field | Value |
|-------|-------|
| **Used For** | Alternative LLM for copywriting |
| **Models** | Claude 3.5 Sonnet |
| **Dashboard** | https://console.anthropic.com/settings/keys |
| **Status** | ⬜ Pending |

### DeepSeek
```bash
DEEPSEEK_API_KEY=
```
| Field | Value |
|-------|-------|
| **Used For** | Budget LLM option |
| **Dashboard** | https://platform.deepseek.com/ |
| **Status** | ⬜ Pending |

### Gemini
```bash
GEMINI_API_KEY=
```
| Field | Value |
|-------|-------|
| **Used For** | Alternative LLM option |
| **Dashboard** | https://aistudio.google.com/app/apikey |
| **Status** | ⬜ Pending |

---

## 2. Video Generation

### NanoB
```bash
NANOB_API_KEY=
NANOB_API_URL=https://api.nanob.ai
```
| Field | Value |
|-------|-------|
| **Used For** | AI video generation |
| **Status** | ⬜ Pending |

### Video Models in Codebase
The `scenes` table supports: `sora`, `veo3`, `seedream`, `nano_b`

---

## 3. Database (Supabase)

### Frontend Environment Variables
```bash
# Public (client-safe)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Private (server-only)
SUPABASE_SERVICE_ROLE_KEY=
```

| Variable | Status | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Set | Your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Set | Row-level security enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set | Bypasses RLS - use carefully |

**Dashboard:** https://supabase.com/dashboard

---

## 4. Caching (Upstash Redis)

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

| Variable | Status | Notes |
|----------|--------|-------|
| `UPSTASH_REDIS_REST_URL` | ✅ Set | REST API endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ Set | Auth token |

**Dashboard:** https://console.upstash.com/

---

## 5. Automation (n8n)

```bash
N8N_WEBHOOK_URL=
N8N_API_KEY=
```

### Webhook Endpoints (from codebase)
```
/campaign-strategy   - Strategist workflow
/content-generation  - Content creation
/video-production    - Video rendering
/content-review      - Review workflow
```

| Variable | Status | Notes |
|----------|--------|-------|
| `N8N_WEBHOOK_URL` | ⬜ Pending | Base webhook URL |
| `N8N_API_KEY` | ⬜ Pending | Optional auth header |

---

## 6. App Configuration

```bash
# App URL (for CORS)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Testing - Master unlock key
NEXT_PUBLIC_MASTER_UNLOCK_KEY=
```

---

## Complete `.env.local` Template

Copy to `frontend/.env.local`:

```bash
# =============================================================================
# BRAND INFINITY ENGINE - ENVIRONMENT CONFIGURATION
# =============================================================================

# -----------------------------------------------------------------------------
# SUPABASE (Required)
# -----------------------------------------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# -----------------------------------------------------------------------------
# REDIS - UPSTASH (Required for rate limiting)
# -----------------------------------------------------------------------------
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# -----------------------------------------------------------------------------
# AI - OPENAI (Required for content generation)
# -----------------------------------------------------------------------------
OPENAI_API_KEY=

# -----------------------------------------------------------------------------
# AI - ANTHROPIC (Optional)
# -----------------------------------------------------------------------------
ANTHROPIC_API_KEY=

# -----------------------------------------------------------------------------
# AI - DEEPSEEK (Optional - budget option)
# -----------------------------------------------------------------------------
DEEPSEEK_API_KEY=

# -----------------------------------------------------------------------------
# AI - GEMINI (Optional)
# -----------------------------------------------------------------------------
GEMINI_API_KEY=

# -----------------------------------------------------------------------------
# VIDEO - NANOB (Required for video)
# -----------------------------------------------------------------------------
NANOB_API_KEY=
NANOB_API_URL=https://api.nanob.ai

# -----------------------------------------------------------------------------
# N8N WORKFLOWS (Required for automation)
# -----------------------------------------------------------------------------
N8N_WEBHOOK_URL=
N8N_API_KEY=

# -----------------------------------------------------------------------------
# APP CONFIGURATION
# -----------------------------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000

# -----------------------------------------------------------------------------
# TESTING
# -----------------------------------------------------------------------------
NEXT_PUBLIC_MASTER_UNLOCK_KEY=
```

---

## Security Notes

1. **Never commit** credentials to git
2. **SUPABASE_SERVICE_ROLE_KEY** bypasses all RLS - server only
3. **NEXT_PUBLIC_*** variables are exposed to browser
4. Use **Vercel Environment Variables** for production
