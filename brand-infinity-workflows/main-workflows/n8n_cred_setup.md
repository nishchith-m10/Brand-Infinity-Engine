# n8n Credentials & Environment Setup Guide

This guide walks you through setting up all the credentials and environment variables needed for the Brand Infinity Engine Phase 4 workflows.

---

## Step 1: Set Environment Variables

Go to your n8n dashboard → **Settings** → **Environment Variables**

Add the following variables with the workflow IDs from your import:

### Sub-Workflow IDs (Required)

| Variable Name                        | Value              |
| ------------------------------------ | ------------------ |
| `ACQUIRE_LOCK_WORKFLOW_ID`           | `lwHIR7PonbgLVkmJ` |
| `RELEASE_LOCK_WORKFLOW_ID`           | `4OwwpHBjkMYBzsuI` |
| `VALIDATE_SCHEMA_WORKFLOW_ID`        | `y0c3JFOEAZFkvAjC` |
| `LOG_COST_EVENT_WORKFLOW_ID`         | `4OuxyvQvJ9GV3yD1` |
| `GET_BRAND_CONTEXT_WORKFLOW_ID`      | `W0vejFr0Sv62X70X` |
| `CHECK_CIRCUIT_BREAKER_WORKFLOW_ID`  | `QOgvjzuDoykfiqvh` |
| `REFRESH_PLATFORM_TOKEN_WORKFLOW_ID` | `kmsyq2wbESxLvETZ` |
| `SEND_ALERT_WORKFLOW_ID`             | `uCTePCAfvuecs7La` |

### Service URLs

| Variable Name          | Value                                             |
| ---------------------- | ------------------------------------------------- |
| `N8N_WEBHOOK_URL`      | `https://n8n-deployment-hlnal.ondigitalocean.app` |
| `VIDEO_PROCESSING_API` | Your video processing API URL (if applicable)     |

---

## Step 2: Create Credentials

Go to **Credentials** → **Add Credential** and create each of the following:

### 2.1 Supabase API Credential

**Name:** `Supabase API` (must match exactly)

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Host             | `https://vciscdagwhdpstaviakz.supabase.co`    |
| Service Role Key | Your Supabase service role key from dashboard |

**Where to find it:** Supabase Dashboard → Settings → API → `service_role` key

---

### 2.2 Postgres Credential (for Supabase)

**Name:** `Supabase Postgres` (must match exactly)

| Field    | Value                                 |
| -------- | ------------------------------------- |
| Host     | `db.vciscdagwhdpstaviakz.supabase.co` |
| Database | `postgres`                            |
| User     | `postgres`                            |
| Password | Your database password                |
| Port     | `5432`                                |
| SSL      | `Allow`                               |

**Where to find it:** Supabase Dashboard → Settings → Database → Connection string

---

### 2.3 Redis Credential

**Name:** `Redis` (must match exactly)

| Field    | Value                                    |
| -------- | ---------------------------------------- |
| Host     | Your Redis host (e.g., Upstash or local) |
| Port     | `6379` (or Upstash port)                 |
| Password | Your Redis password                      |
| TLS      | `true` (for Upstash)                     |

**Option A - Upstash (Recommended for production):**

1. Go to [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy the connection details

**Option B - Local Redis:**

```
Host: localhost
Port: 6379
Password: (leave empty)
```

---

### 2.4 OpenAI API Credential

**Name:** `OpenAI API` (must match exactly)

| Field   | Value                          |
| ------- | ------------------------------ |
| API Key | `sk-...` (your OpenAI API key) |

**Where to find it:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

---

### 2.5 Video API Credential (for Sora/Runway/Pika)

**Name:** `Video API` (must match exactly)

This is a **Header Auth** credential:

| Field | Value                       |
| ----- | --------------------------- |
| Name  | `Authorization`             |
| Value | `Bearer YOUR_VIDEO_API_KEY` |

Replace with your actual video generation API key (Sora, Runway, Pika, etc.)

---

## Step 3: Verify Credential Names Match

The workflows reference credentials by name. Verify these match exactly:

| Workflow Reference                        | Credential Name You Created |
| ----------------------------------------- | --------------------------- |
| `supabaseApi: { name: "Supabase API" }`   | Supabase API                |
| `postgres: { name: "Supabase Postgres" }` | Supabase Postgres           |
| `redis: { name: "Redis" }`                | Redis                       |
| `httpHeaderAuth: { name: "OpenAI API" }`  | OpenAI API                  |
| `httpHeaderAuth: { name: "Video API" }`   | Video API                   |

---

## Step 4: Test the Setup

### Test 1: Sub-Workflow Connection

1. Open `Strategist_Main` workflow
2. Click on the "Acquire Campaign Lock" node
3. It should show the sub-workflow ID is resolved

### Test 2: Database Connection

1. Open `Log_Cost_Event` workflow
2. Click "Test Workflow"
3. It should connect to Supabase without errors

### Test 3: Redis Connection

1. Open `Check_Circuit_Breaker` workflow
2. Click "Test Workflow"
3. It should connect to Redis without errors

---

## Step 5: Activate Cron Workflows

These workflows run on schedules and need to be activated:

| Workflow                  | Schedule        | Activate?           |
| ------------------------- | --------------- | ------------------- |
| `Production_Poller`       | Every 1 minute  | ⚠️ Wait until ready |
| `Zombie_Reaper`           | Every 1 hour    | ✅ Safe to activate |
| `Circuit_Breaker_Monitor` | Every 5 minutes | ✅ Safe to activate |
| `Performance_Monitor`     | Daily           | ⚠️ Wait until ready |

---

## Troubleshooting

### "Workflow not found"

The environment variable is set incorrectly. Double-check the workflow ID.

### "Credential not found"

The credential name doesn't match. Credential names are case-sensitive.

### "Connection refused" (Redis)

Redis isn't running or the connection details are wrong.

### "Invalid API Key" (OpenAI)

Your OpenAI API key is invalid or expired.

---

## Quick Copy-Paste for Environment Variables

```
ACQUIRE_LOCK_WORKFLOW_ID=lwHIR7PonbgLVkmJ
RELEASE_LOCK_WORKFLOW_ID=4OwwpHBjkMYBzsuI
VALIDATE_SCHEMA_WORKFLOW_ID=y0c3JFOEAZFkvAjC
LOG_COST_EVENT_WORKFLOW_ID=4OuxyvQvJ9GV3yD1
GET_BRAND_CONTEXT_WORKFLOW_ID=W0vejFr0Sv62X70X
CHECK_CIRCUIT_BREAKER_WORKFLOW_ID=QOgvjzuDoykfiqvh
REFRESH_PLATFORM_TOKEN_WORKFLOW_ID=kmsyq2wbESxLvETZ
SEND_ALERT_WORKFLOW_ID=uCTePCAfvuecs7La
N8N_WEBHOOK_URL=https://n8n-deployment-hlnal.ondigitalocean.app
```

---

## Summary Checklist

- [ ] Added 8 sub-workflow ID environment variables
- [ ] Added N8N_WEBHOOK_URL environment variable
- [ ] Created Supabase API credential
- [ ] Created Supabase Postgres credential
- [ ] Created Redis credential
- [ ] Created OpenAI API credential
- [ ] Created Video API credential (optional)
- [ ] Tested sub-workflow connections
- [ ] Activated cron workflows

Once all boxes are checked, the Phase 4 system is ready to run! 🚀
