# Brand Infinity Engine - Complete Credentials Setup Guide

> **One Document to Rule Them All** 🔑
>
> This guide consolidates ALL credentials needed across the three configuration locations:
>
> 1. **`.env.local`** - Local environment file
> 2. **n8n Admin UI** - External workflow credentials
> 3. **Frontend Settings** - User-configurable API keys in database

---

## Quick Overview

| Location          | What Goes Here                                     | How to Access                                     |
| ----------------- | -------------------------------------------------- | ------------------------------------------------- |
| `.env.local`      | Server-side secrets, database URLs, n8n connection | Edit file directly in project root                |
| n8n Admin UI      | Workflow-specific API keys (LLM, video, voice)     | https://64.23.139.93.sslip.io (your n8n instance) |
| Frontend Settings | User BYOK keys (stored encrypted in Supabase)      | App Settings page in the UI                       |

---

## PART 1: Environment File (`.env.local`)

Location: `/Brand-Infinity-Engine/.env.local`

### 🔐 Critical Required Credentials

| Category     | Variable                        | Get It From                                                                   | Required |
| ------------ | ------------------------------- | ----------------------------------------------------------------------------- | -------- |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`      | [Supabase Dashboard](https://supabase.com/dashboard) → Project Settings → API | ✅ Yes   |
|              | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same location                                                                 | ✅ Yes   |
|              | `SUPABASE_SERVICE_ROLE_KEY`     | Same location (keep secret!)                                                  | ✅ Yes   |
|              | `SUPABASE_PROVIDER_KEYS_SECRET` | Generate: see note below                                                      | ✅ Yes   |
| **OpenAI**   | `OPENAI_API_KEY`                | [OpenAI Platform](https://platform.openai.com/api-keys)                       | ✅ Yes   |
| **Redis**    | `UPSTASH_REDIS_REST_URL`        | [Upstash Console](https://console.upstash.com/)                               | ✅ Yes   |
|              | `UPSTASH_REDIS_REST_TOKEN`      | Same location                                                                 | ✅ Yes   |

### 📡 n8n Connection (Required for Video Generation)

| Variable                 | Value                           | Notes                               |
| ------------------------ | ------------------------------- | ----------------------------------- |
| `N8N_BASE_URL`           | `https://64.23.139.93.sslip.io` | Your n8n instance URL               |
| `N8N_API_KEY`            | JWT token from n8n              | n8n Settings → API → Create API Key |
| `N8N_WEBHOOK_SECRET`     | 64-char hex string              | Generate: `openssl rand -hex 32`    |
| `N8N_ENABLED`            | `true`                          | Enable n8n integration              |
| `N8N_WORKFLOW_VIDEO`     | Workflow ID                     | e.g., `XTThKeiOYtBn2r9W`            |
| `N8N_WORKFLOW_VOICEOVER` | Workflow ID                     | e.g., `BXTj0ae31UGVWT4R`            |
| `N8N_WORKFLOW_IMAGE`     | Workflow ID                     | e.g., `LMBMqDKMvz2zjJDk`            |

### 🎬 Optional AI/Video Provider Keys

| Variable             | Get It From                                               | When Needed              |
| -------------------- | --------------------------------------------------------- | ------------------------ |
| `ANTHROPIC_API_KEY`  | [Anthropic Console](https://console.anthropic.com/)       | If using Claude models   |
| `ELEVENLABS_API_KEY` | [ElevenLabs](https://elevenlabs.io/app/settings/api-keys) | Premium voice generation |
| `POLLO_API_KEY`      | [Pollo AI](https://pollo.ai)                              | Multi-model video access |
| `RUNWAY_API_KEY`     | [Runway ML](https://runwayml.com/)                        | Video generation         |

### 🔧 Generate Encryption Key

For `SUPABASE_PROVIDER_KEYS_SECRET`, run:

```bash
node -e "const sodium = require('libsodium-wrappers'); (async () => { await sodium.ready; const key = sodium.crypto_secretbox_keygen(); console.log(Buffer.from(key).toString('base64')); })()"
```

Or simpler (if libsodium not installed):

```bash
openssl rand -base64 32
```

---

## PART 2: n8n Admin UI Credentials

**Access URL:** https://64.23.139.93.sslip.io

Login → Settings → Credentials

### ⚠️ CRITICAL: These Must Be Configured in n8n

| Credential Name    | Type           | Get It From                                               | Used By Workflow           |
| ------------------ | -------------- | --------------------------------------------------------- | -------------------------- |
| **OpenAI**         | OpenAI API     | [OpenAI Platform](https://platform.openai.com/api-keys)   | All LLM calls in workflows |
| **httpHeaderAuth** | Header Auth    | Your `N8N_WEBHOOK_SECRET`                                 | Webhook authentication     |
| **ElevenLabs**     | ElevenLabs API | [ElevenLabs](https://elevenlabs.io/app/settings/api-keys) | Voice generation workflow  |
| **Runway ML**      | HTTP Request   | [Runway ML](https://runwayml.com/api)                     | Premium video generation   |
| **Pollinations**   | HTTP Request   | Free, no key needed                                       | Free video generation      |

### How to Add n8n Credentials

1. Go to https://64.23.139.93.sslip.io
2. Click **Settings** (gear icon) → **Credentials**
3. Click **Add Credential**
4. Select the credential type
5. Fill in the API key/details
6. **Save**

### n8n Credential Setup Details

#### OpenAI Credential

```
Type: OpenAI
Name: OpenAI
API Key: sk-xxxxx (your key)
```

#### httpHeaderAuth (Webhook Authentication)

```
Type: Header Auth
Name: WebhookAuth
Header Name: X-Webhook-Secret
Header Value: (same as N8N_WEBHOOK_SECRET in .env.local)
```

#### ElevenLabs Credential

```
Type: ElevenLabs
Name: ElevenLabs
API Key: xi_xxxxx (your key)
```

---

## PART 3: Frontend Settings (User BYOK)

**Access:** App UI → Settings → Provider Keys

These are **per-user** API keys stored encrypted in Supabase (`user_provider_keys` table). Users can add their own keys to bypass global limits or use their own accounts.

### Supported Providers (from ProviderKeysSettings.tsx)

| Category   | Provider     | What It Enables                |
| ---------- | ------------ | ------------------------------ |
| **LLM**    | `openai`     | GPT-4, GPT-4o, DALL-E          |
|            | `anthropic`  | Claude 3.5 Sonnet              |
|            | `deepseek`   | DeepSeek V3/R1                 |
|            | `openrouter` | Multi-model access             |
|            | `gemini`     | Google Gemini                  |
|            | `kimi`       | Kimi AI                        |
| **Voice**  | `elevenlabs` | Premium voice synthesis        |
| **Video**  | `runway`     | Runway ML video                |
|            | `pika`       | Pika Labs video                |
|            | `pollo`      | Multi-model video (Kling, Veo) |
| **Image**  | `midjourney` | Midjourney images              |
| **Social** | `tiktok`     | TikTok API                     |
|            | `instagram`  | Instagram Graph API            |
|            | `youtube`    | YouTube Data API               |
|            | `linkedin`   | LinkedIn API                   |

### How User Keys Work

1. User goes to Settings → Provider Keys in the app
2. Selects provider and enters their personal API key
3. Key is encrypted using `SUPABASE_PROVIDER_KEYS_SECRET` (from `.env.local`)
4. Stored in `user_provider_keys` table in Supabase
5. When user makes a request, their key is used instead of global key

---

## PART 4: Supabase Database Tables (System Configuration)

**Access:** Supabase Dashboard → Table Editor

Some configuration is stored directly in database tables:

| Table                | Purpose          | What's Stored                                   |
| -------------------- | ---------------- | ----------------------------------------------- |
| `user_provider_keys` | User BYOK keys   | Encrypted API keys per user per provider        |
| `brand_identity`     | Brand voice/tone | Brand name, voice, tagline, colors, personality |
| `brands`             | Brand metadata   | Budget tier, settings, metadata JSON            |
| `campaigns`          | Campaign config  | Budget limits, identity mode, status            |

### brand_identity Table Fields

| Field                | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `brand_name`         | Display name for brand                     |
| `brand_voice`        | Text description of voice/tone             |
| `tagline`            | Brand tagline                              |
| `mission_statement`  | Mission for prompts                        |
| `target_audience`    | Audience description                       |
| `tone_style`         | Enum: professional, casual, friendly, etc. |
| `personality_traits` | Array of trait strings                     |
| `content_pillars`    | Key themes to emphasize                    |
| `primary_color`      | Hex color code                             |
| `secondary_color`    | Hex color code                             |

---

## 🔗 Quick Links - Get Your API Keys

| Service       | Link                                        | Free Tier?      |
| ------------- | ------------------------------------------- | --------------- |
| Supabase      | https://supabase.com/dashboard              | ✅ Yes          |
| OpenAI        | https://platform.openai.com/api-keys        | 💰 Paid         |
| Anthropic     | https://console.anthropic.com/              | 💰 Paid         |
| ElevenLabs    | https://elevenlabs.io/app/settings/api-keys | ✅ Limited Free |
| Upstash Redis | https://console.upstash.com/                | ✅ Yes          |
| Runway ML     | https://runwayml.com/api                    | 💰 Paid         |
| Pollo AI      | https://pollo.ai                            | 💰 Paid         |
| OpenRouter    | https://openrouter.ai/keys                  | 💰 Pay-per-use  |
| Pollinations  | https://pollinations.ai                     | ✅ Free         |

---

## Checklist: Complete Setup

### Phase 1: Essential (Minimum to run)

- [ ] Copy `.env.example` to `.env.local`
- [ ] Set Supabase credentials (URL, anon key, service role key)
- [ ] Set OpenAI API key
- [ ] Set Upstash Redis credentials
- [ ] Generate and set `SUPABASE_PROVIDER_KEYS_SECRET`

### Phase 2: n8n Integration (For video generation)

- [ ] Set n8n connection variables in `.env.local`
- [ ] Add OpenAI credential in n8n admin
- [ ] Add httpHeaderAuth credential in n8n (matching webhook secret)
- [ ] Add ElevenLabs credential in n8n (if using premium voice)

### Phase 3: Optional Enhancements

- [ ] Add Anthropic key for Claude models
- [ ] Add Runway ML for premium video
- [ ] Configure Pollo AI for multi-model access
- [ ] Set up social media API keys (Instagram, TikTok, YouTube)

---

## Troubleshooting

### "n8n workflow failed" errors

→ Check n8n has the required credentials configured (OpenAI, httpHeaderAuth)

### "Rate limit exceeded"

→ Add your own API keys in Frontend Settings to bypass global limits

### "Voice generation failed"

→ Ensure ElevenLabs credential is set in n8n admin

### "Unauthorized" on callbacks

→ Verify `N8N_WEBHOOK_SECRET` matches between `.env.local` and n8n httpHeaderAuth

---

## File Locations Reference

```
Brand-Infinity-Engine/
├── .env.local          ← Server-side credentials (NEVER commit)
├── .env.example        ← Template (safe to commit)
├── docs/
│   └── CREDENTIALS_SETUP.md  ← This file
└── [n8n instance]      ← https://64.23.139.93.sslip.io
```

---

_Last Updated: January 2026_
