# n8n Per-Node Credentials Guide

> **Already configured:** supabaseApi, postgres ✅

## ⚠️ The Two Types of "httpHeaderAuth"

You need to create **different credentials** for different purposes, even though they are all type `httpHeaderAuth`.

### 1. Webhook Shield (For YOUR App)

Use this for **ALL Webhook Nodes**. It lets your app talk to n8n.

- **Credential Name:** `Webhook Shield` (or `Video API`)
- **Header:** `Authorization`
- **Value:** `Bearer [YOUR_N8N_API_KEY_FROM_ENV_LOCAL]`

### 2. Service Keys (For AI Providers)

Use these for **LLM/Action Nodes**. It lets n8n talk to AI services.

- **OpenAI:** Header `Authorization`, Value `Bearer sk-...`
- **Anthropic:** Header `x-api-key`, Value `sk-ant-...`
- **Runway/Pika:** Header `Authorization`, Value `Bearer ...`
- **Supabase (Upload):** Header `Authorization`, Value `Bearer [SUPABASE_SERVICE_ROLE_KEY]`

---

## Detailed Node Mapping

### 📝 Copywriter_Main

| Node                  | Credential Type | Which Key?              |
| --------------------- | --------------- | ----------------------- |
| **Webhook Trigger**   | Webhook Shield  | `N8N_API_KEY`           |
| **Generate Script**  - later in the future | Service Key     | `OpenAI` or `Anthropic` |
| **Critic Evaluation** - later in the future | Service Key     | `OpenAI` or `Anthropic` |

### 🎬 Production_Dispatcher

| Node                   | Credential Type | Which Key?                  |
| ---------------------- | --------------- | --------------------------- |
| **Webhook1**           | Webhook Shield -done | `N8N_API_KEY`               |
| **Submit to Provider** | Service Key  - later in the future   | `Runway` / `Pika` / `Pollo` |

### 📥 Production_Downloader

| Node                   | Credential Type | Which Key?                  |
| ---------------------- | --------------- | --------------------------- |
| **Webhook**            | Webhook Shield - done  | `N8N_API_KEY`               |
| **Upload to Supabase** | Service Key - done     | `Supabase Service Role Key` |

### 🧠 Strategist_Main

| Node                  | Credential Type | Which Key?              |
| --------------------- | --------------- | ----------------------- |
| **Webhook Trigger**   | Webhook Shield  | `N8N_API_KEY`           |
| **Generate Strategy** | Service Key     | `OpenAI` or `Anthropic` |

### 📡 Broadcaster_Main

| Node                   | Credential Type | Which Key?                                                          |
| ---------------------- | --------------- | ------------------------------------------------------------------- |
| **Webhook**            | Webhook Shield - done  | `N8N_API_KEY`                                                       |
| **Upload to Platform** | Service Key - done     | `Platform Access Token` (Usually handled by Refresh Token workflow) |

### ⚙️ Video_Assembly

| Node        | Credential Type | Which Key?    |
| ----------- | --------------- | ------------- |
| **Webhook** | Webhook Shield - done  | `N8N_API_KEY` |

### 🔄 Production_Poller

| Node               | Credential Type | Which Key?                  |
| ------------------ | --------------- | --------------------------- |
| **Poll Component** | Service Key     | `Runway` / `Pika` / `Pollo` |

---

## Other Credentials

- **redis:** Use for all Cache/Circuit Breaker nodes.
- **gmailOAuth2:** Use for Send_Alert node (optional).
