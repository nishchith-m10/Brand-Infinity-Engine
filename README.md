# 🎬 Brand Infinity Engine

> **AI-Powered Marketing Content Pipeline** — Transform text into cinematic video campaigns, fully automated.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql)](https://postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)](https://supabase.com/)
[![n8n](https://img.shields.io/badge/n8n-Workflows-EA4B71?logo=n8n)](https://n8n.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Data Flow Diagram](#-data-flow-diagram)
- [The 5 Pillars](#-the-5-pillars)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Cost Optimization](#-cost-optimization)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## 🌟 Overview

The **Brand Infinity Engine** is a complete end-to-end system that takes your brand guidelines as input and produces finished, published video ads with zero manual intervention.

### What It Does

| Step | Action                                               | Output                |
| ---- | ---------------------------------------------------- | --------------------- |
| 1️⃣   | **Analyze** trending topics across social platforms  | Trend insights        |
| 2️⃣   | **Generate** creative briefs aligned with your brand | Campaign strategy     |
| 3️⃣   | **Write** compelling video scripts with hooks & CTAs | Multi-variant scripts |
| 4️⃣   | **Produce** cinematic videos using AI generation     | HD video content      |
| 5️⃣   | **Optimize** with A/B test variants                  | Performance variants  |
| 6️⃣   | **Publish** directly to social platforms             | Live campaigns        |
| 7️⃣   | **Track** engagement metrics in real-time            | Analytics dashboard   |

### Key Features

- ✅ **Fully Automated** — Strategy to publication pipeline
- ✅ **Brand-Aware** — RAG-based brand guideline validation
- ✅ **Cost-Optimized** — Intelligent model routing (Sora ↔ Nano B)
- ✅ **A/B Testing** — Automatic campaign variants
- ✅ **Multi-Platform** — Instagram, TikTok, YouTube, LinkedIn
- ✅ **Cloud-Native** — Supabase backend with PostgreSQL + Storage

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph Client["🖥️ Client Layer"]
        direction LR
        WebApp["Next.js Frontend<br/>Port 3000"]
        API["REST API Client"]
    end

    subgraph Gateway["🌐 API Gateway"]
        direction TB
        Express["Express.js Server<br/>Port 3001"]
        RateLimit["Rate Limiter<br/>1000 req/min"]
        Auth["JWT Auth<br/>Middleware"]
    end

    subgraph Orchestration["⚙️ Workflow Orchestration"]
        direction TB
        n8n["n8n Workflow Engine<br/>Port 5678"]

        subgraph Workflows["Workflow Templates"]
            WF1["Strategist<br/>Workflow"]
            WF2["Copywriter<br/>Workflow"]
            WF3["Production<br/>Workflow"]
            WF4["Campaign<br/>Workflow"]
            WF5["Broadcast<br/>Workflow"]
        end
    end

    subgraph AI_Layer["🤖 AI Services Layer"]
        direction TB

        subgraph TextGen["Text Generation"]
            GPT4["OpenAI GPT-4o"]
            Claude["Anthropic Claude"]
            DeepSeek["DeepSeek R1"]
        end

        subgraph VideoGen["Video Generation"]
            Sora["OpenAI Sora<br/>$$$"]
            Veo3["Google Veo3<br/>$$"]
            NanoB["Nano B<br/>$"]
        end

        subgraph AudioGen["Audio Generation"]
            ElevenLabs["ElevenLabs TTS"]
            OpenAITTS["OpenAI TTS-1"]
        end

        subgraph Embeddings["Vector Embeddings"]
            Embed["text-embedding-3-small"]
        end
    end

    subgraph DataLayer["💾 Data Layer"]
        direction TB

        subgraph Supabase["Supabase Cloud"]
            PostgreSQL[("PostgreSQL 14<br/>+ pgvector")]
            Storage[("Supabase Storage<br/>campaign-assets")]
            Realtime["Realtime<br/>Subscriptions"]
        end

        subgraph Cache["Caching"]
            Redis[("Redis<br/>Brand Guidelines")]
        end
    end

    subgraph External["🌍 External Services"]
        direction TB

        subgraph Social["Social Media APIs"]
            Instagram["Instagram<br/>Graph API"]
            TikTok["TikTok<br/>API"]
            YouTube["YouTube<br/>Data API v3"]
            LinkedIn["LinkedIn<br/>Marketing API"]
        end

        subgraph Trends["Trend Sources"]
            TrendAPI["Social Scrapers"]
            CompetitorAPI["Competitor Analysis"]
        end
    end

    %% Connections
    WebApp --> Express
    API --> Express
    Express --> RateLimit --> Auth
    Auth --> n8n

    n8n --> WF1 & WF2 & WF3 & WF4 & WF5

    WF1 --> GPT4 & Claude & Embed
    WF2 --> GPT4 & DeepSeek
    WF3 --> Sora & Veo3 & NanoB & ElevenLabs & OpenAITTS
    WF4 --> GPT4
    WF5 --> Instagram & TikTok & YouTube & LinkedIn

    n8n --> PostgreSQL
    n8n --> Storage
    n8n --> Redis

    WF1 --> TrendAPI & CompetitorAPI

    PostgreSQL --> Realtime --> WebApp

    classDef primary fill:#3b82f6,stroke:#1e40af,color:#fff
    classDef secondary fill:#8b5cf6,stroke:#5b21b6,color:#fff
    classDef ai fill:#10b981,stroke:#047857,color:#fff
    classDef storage fill:#f59e0b,stroke:#b45309,color:#fff
    classDef external fill:#ec4899,stroke:#be185d,color:#fff

    class WebApp,Express primary
    class n8n,WF1,WF2,WF3,WF4,WF5 secondary
    class GPT4,Claude,DeepSeek,Sora,Veo3,NanoB,ElevenLabs,OpenAITTS,Embed ai
    class PostgreSQL,Storage,Redis storage
    class Instagram,TikTok,YouTube,LinkedIn,TrendAPI,CompetitorAPI external
```

---

## 🔄 Data Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 User
    participant FE as 🖥️ Frontend
    participant API as ⚡ Express API
    participant N8N as ⚙️ n8n Engine
    participant AI as 🤖 AI Models
    participant DB as 💾 Supabase
    participant SM as 📱 Social Media

    rect rgb(59, 130, 246, 0.1)
        Note over U,DB: Phase 1: Strategy Generation
        U->>FE: Create Campaign Request
        FE->>API: POST /api/v1/briefs
        API->>N8N: Trigger Strategist Workflow
        N8N->>DB: Fetch Brand Guidelines
        DB-->>N8N: Brand Data + Embeddings
        N8N->>AI: Generate Creative Brief (GPT-4o)
        AI-->>N8N: Creative Brief JSON
        N8N->>DB: Store Brief
        N8N-->>API: brief_id: 42
        API-->>FE: { brief_id: 42, status: "ready" }
    end

    rect rgb(139, 92, 246, 0.1)
        Note over N8N,AI: Phase 2: Script Generation
        N8N->>AI: Generate Script + Hooks (GPT-4o)
        AI-->>N8N: Script with 3 Hook Variants
        N8N->>AI: Scene Segmentation (Claude)
        AI-->>N8N: 8 Scene Descriptions
        N8N->>DB: Store Script + Scenes
    end

    rect rgb(16, 185, 129, 0.1)
        Note over N8N,AI: Phase 3: Video Production
        loop For Each Scene (Parallel)
            N8N->>AI: Generate Video (Veo3/Sora)
            AI-->>N8N: Video Blob
            N8N->>DB: Upload to Supabase Storage
        end
        N8N->>AI: Generate Voiceover (ElevenLabs)
        AI-->>N8N: Audio File
        N8N->>N8N: Compose Final Video (FFmpeg)
        N8N->>DB: Store Master Video
    end

    rect rgb(245, 158, 11, 0.1)
        Note over N8N,SM: Phase 4: Publishing
        N8N->>DB: Create A/B Variants
        N8N->>SM: Publish to Instagram
        N8N->>SM: Publish to TikTok
        SM-->>N8N: Post IDs
        N8N->>DB: Store Publication Records
    end

    rect rgb(236, 72, 153, 0.1)
        Note over SM,FE: Phase 5: Analytics
        loop Every 15 minutes
            N8N->>SM: Fetch Engagement Metrics
            SM-->>N8N: Views, Likes, Shares
            N8N->>DB: Update Metrics
            DB-->>FE: Realtime Push (WebSocket)
        end
    end
```

---

## 🏛️ The 5 Pillars

```mermaid
graph LR
    subgraph P1["🧠 PILLAR 1<br/>Strategist"]
        S1[Trend Analysis]
        S2[Brand RAG]
        S3[Brief Generation]
        S1 --> S2 --> S3
    end

    subgraph P2["✍️ PILLAR 2<br/>Copywriter"]
        C1[Script Writing]
        C2[Hook Variants]
        C3[Scene Breakdown]
        C1 --> C2 --> C3
    end

    subgraph P3["🎥 PILLAR 3<br/>Production"]
        V1[Video Generation]
        V2[Audio/TTS]
        V3[Composition]
        V1 --> V3
        V2 --> V3
    end

    subgraph P4["📊 PILLAR 4<br/>Campaign Manager"]
        M1[A/B Variants]
        M2[Cost Tracking]
        M3[Quality Score]
        M1 --> M2 --> M3
    end

    subgraph P5["📡 PILLAR 5<br/>Broadcaster"]
        B1[Multi-Platform]
        B2[Scheduling]
        B3[Metrics]
        B1 --> B2 --> B3
    end

    P1 -->|brief| P2
    P2 -->|script| P3
    P3 -->|video| P4
    P4 -->|campaign| P5

    style P1 fill:#3b82f6,stroke:#1e40af,color:#fff
    style P2 fill:#8b5cf6,stroke:#5b21b6,color:#fff
    style P3 fill:#10b981,stroke:#047857,color:#fff
    style P4 fill:#f59e0b,stroke:#b45309,color:#fff
    style P5 fill:#ec4899,stroke:#be185d,color:#fff
```

### Pillar Details

| Pillar             | Module                      | Key Functions                                                         |
| ------------------ | --------------------------- | --------------------------------------------------------------------- |
| **1. Strategist**  | `src/pillars/strategist/`   | `generateCreativeBrief()`, `scrapeTrends()`, `queryBrandGuidelines()` |
| **2. Copywriter**  | `src/pillars/copywriter/`   | `generateScript()`, `createHookVariants()`, `segmentScenes()`         |
| **3. Production**  | `src/pillars/production/`   | `generateVideo()`, `generateVoiceover()`, `composeVideo()`            |
| **4. Campaign**    | `src/pillars/distribution/` | `createVariants()`, `trackCosts()`, `scoreQuality()`                  |
| **5. Broadcaster** | `src/pillars/publisher/`    | `publishToInstagram()`, `schedulePost()`, `collectMetrics()`          |

---

## 🛠️ Tech Stack

```mermaid
flowchart LR
    subgraph Core["🎯 Brand Infinity Engine"]
        direction TB
        ENGINE((Engine))
    end

    subgraph FE["🖥️ Frontend"]
        direction TB
        F1["Next.js 16"]
        F2["React 19"]
        F3["TailwindCSS 4"]
        F4["TypeScript"]
        F5["React Query"]
    end

    subgraph BE["⚙️ Backend"]
        direction TB
        B1["Node.js 18+"]
        B2["Express.js"]
        B3["n8n Workflows"]
    end

    subgraph DB["💾 Database"]
        direction TB
        D1["PostgreSQL 14"]
        D2["pgvector"]
        D3["Supabase Storage"]
        D4["Realtime"]
        D5["Redis Cache"]
    end

    subgraph AI["🤖 AI Models"]
        direction TB
        subgraph Text["📝 Text"]
            T1["GPT-4o"]
            T2["Claude 3.5"]
            T3["DeepSeek R1"]
        end
        subgraph Video["🎬 Video"]
            V1["Sora"]
            V2["Veo3"]
            V3["Seedream"]
            V4["Nano B"]
        end
        subgraph Audio["🔊 Audio"]
            A1["ElevenLabs"]
            A2["OpenAI TTS"]
        end
    end

    subgraph OPS["🚀 DevOps"]
        direction TB
        O1["Docker"]
        O2["GitHub Actions"]
        O3["Vercel"]
    end

    ENGINE --- FE
    ENGINE --- BE
    ENGINE --- DB
    ENGINE --- AI
    ENGINE --- OPS

    style Core fill:#6366f1,stroke:#4338ca,color:#fff
    style FE fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style BE fill:#8b5cf6,stroke:#6d28d9,color:#fff
    style DB fill:#f59e0b,stroke:#d97706,color:#fff
    style AI fill:#10b981,stroke:#059669,color:#fff
    style OPS fill:#ef4444,stroke:#dc2626,color:#fff
    style Text fill:#22c55e,stroke:#16a34a,color:#fff
    style Video fill:#14b8a6,stroke:#0d9488,color:#fff
    style Audio fill:#06b6d4,stroke:#0891b2,color:#fff
```

### Technology Breakdown

| Layer                | Technology            | Purpose                          |
| -------------------- | --------------------- | -------------------------------- |
| **Frontend**         | Next.js 16 + React 19 | Modern React with Turbopack      |
| **Styling**          | TailwindCSS 4         | Utility-first CSS                |
| **State**            | React Query           | Server state management          |
| **Backend**          | Express.js            | REST API server                  |
| **Orchestration**    | n8n                   | Visual workflow automation       |
| **Database**         | Supabase PostgreSQL   | Cloud-native PostgreSQL          |
| **Vector Search**    | pgvector              | Brand guideline embeddings       |
| **File Storage**     | Supabase Storage      | Campaign assets (images, videos) |
| **Caching**          | Redis                 | Brand guidelines cache           |
| **Containerization** | Docker                | Development & deployment         |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **Supabase Account** (free tier works) — Database, Auth, Storage
- **n8n Instance** (cloud or self-hosted) — Workflow automation
- **OpenAI API Key** (required)
- **Docker** (optional) — Only needed for local video processing

### 1. Clone & Install

```bash
git clone https://github.com/nishchith-m1015/Marketing-Content-Engine.git
cd Marketing-Content-Engine

# Install dependencies
npm install
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Supabase (Required)
DATABASE_URL=postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=REDACTED
SUPABASE_SERVICE_ROLE_KEY=REDACTED
SUPABASE_STORAGE_BUCKET=campaign-assets

# AI Models (Required)
OPENAI_API_KEY=sk-your_openai_api_key_here

# Optional AI Models
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
ELEVENLABS_API_KEY=...

# Video Concat Service (if running locally)
VIDEO_SERVICE_URL=http://localhost:8080
VIDEO_SERVICE_API_KEY=your-secure-api-key
VIDEO_STORAGE_BUCKET=videos
```

> **☁️ Cloud-First Architecture**: This project uses cloud-hosted services by default:
> - **Database/Auth/Storage** → Supabase Cloud
> - **Workflow Automation** → n8n Cloud or DigitalOcean
> - **No Docker required** for standard development

### 2.5. Configure MCP Servers (Optional)

For enhanced development experience with AI-powered tools:

```bash
cp mcp_config.json.example mcp_config.json
```

Edit `mcp_config.json` with your API tokens for:

- GitHub integration
- DigitalOcean deployment
- n8n workflow management
- Supabase database access
- And more...

> **⚠️ Security**: `mcp_config.json` is gitignored. Never commit credentials!

### 3. Initialize Database

```bash
# Run all migrations (includes Phase 4)
npm run db:migrate

# Or run specific Phase 4 migrations
psql $DATABASE_URL < database/migrations/phase_4_init.sql
psql $DATABASE_URL < database/migrations/phase_4_fix.sql

# Seed sample data (optional)
npm run db:seed
```

### 4. Start Development Server

```bash
# Start both backend (3001) and frontend (3000)
npm run dev
```

Open **http://localhost:3000** 🎉

---

## 📁 Project Structure

```
Brand-Infinity-Engine/
├── 📂 frontend/                    # Next.js 16 Application
│   ├── app/                        # App Router pages
│   │   ├── (dashboard)/            # Dashboard routes
│   │   │   ├── campaigns/          # Campaign management
│   │   │   ├── analytics/          # Performance dashboard
│   │   │   ├── distribution/       # Multi-platform publishing
│   │   │   ├── settings/           # User settings
│   │   │   └── ...
│   │   ├── login/                  # Authentication
│   │   └── verify-passcode/        # Passcode verification
│   ├── components/                 # React components
│   │   └── ui/                     # Reusable UI components
│   │       ├── confirmation-modal.tsx  # Delete confirmations
│   │       ├── toast-container.tsx     # Notifications
│   │       └── ...
│   └── lib/                        # Utilities & API client
│       ├── hooks/                  # Custom React hooks
│       │   ├── use-campaigns.ts    # Campaign management
│       │   ├── use-modal.ts        # Modal state
│       │   └── use-toast.ts        # Toast notifications
│       └── platform-icons.tsx      # Social media icons
│
├── 📂 src/pillars/                 # Core Business Logic
│   ├── strategist/                 # Pillar 1: Strategy
│   ├── copywriter/                 # Pillar 2: Scripts
│   ├── production/                 # Pillar 3: Videos
│   ├── distribution/               # Pillar 4: Campaigns
│   └── publisher/                  # Pillar 5: Publishing
│
├── 📂 brand-infinity-workflows/    # Phase 4 n8n Orchestration
│   ├── main-workflows/             # 11 Main orchestration flows
│   │   ├── Strategist_Main.json
│   │   ├── Copywriter_Main.json
│   │   ├── Production_Dispatcher.json
│   │   ├── Video_Assembly.json
│   │   ├── Broadcaster_Main.json
│   │   └── ...
│   ├── sub-workflows/              # 8 Reusable sub-workflows
│   │   ├── Get_Brand_Context.json
│   │   ├── Validate_Schema.json
│   │   ├── Check_Circuit_Breaker.json
│   │   └── ...
│   ├── deploy_to_n8n.sh            # Automated deployment
│   └── README.md                   # Workflow documentation
│
├── 📂 database/migrations/         # SQL Migrations
│   ├── 001_initial_schema.sql
│   ├── 004_performance_indexes.sql
│   ├── 005_embeddings.sql
│   ├── phase_4_init.sql            # Phase 4 tables
│   ├── phase_4_fix.sql             # Phase 4 fixes
│   └── phase_4_fix_v2.sql
│
├── 📂 utils/                       # Shared Utilities
│   ├── db.js                       # Database connection
│   ├── file_upload.js              # Supabase Storage
│   ├── model_router.js             # AI Model Selection
│   ├── cost_tracker.ts             # Cost tracking
│   ├── circuit_breaker.ts          # Circuit breaker pattern
│   ├── rate_limiter.ts             # Rate limiting
│   └── metrics.ts                  # Metrics collection
│
├── 📂 tests/                       # Test Suite
│   ├── circuit_breaker.test.ts
│   ├── metrics.test.ts
│   ├── rate_limiter.test.ts
│   └── ...
│
├── 📂 docs/                        # Documentation
│   └── plans/
│       ├── PHASE_4_ORCHESTRATION.md
│       └── PHASE_4_IMPLEMENTATION_MANIFESTO.md
│
├── 📂 scripts/                     # Setup & Deployment Scripts
├── 📄 index.js                     # Express Server Entry
├── 📄 mcp_config.json.example      # MCP server configuration template
├── 📄 docker-compose.yml           # Local Development Stack
└── 📄 package.json                 # Dependencies
```

---

## 💾 Database Schema

```mermaid
erDiagram
    %% Strategist Pillar
    BRAND_GUIDELINES ||--o{ CREATIVE_BRIEFS : generates
    TRENDS ||--o{ CREATIVE_BRIEFS : influences
    COMPETITOR_ADS ||--o{ CREATIVE_BRIEFS : informs

    %% Copywriter Pillar
    CREATIVE_BRIEFS ||--o{ SCRIPTS : produces
    SCRIPTS ||--o{ HOOKS : has
    SCRIPTS ||--o{ SCENE_SEGMENTS : contains
    SCRIPTS ||--o{ SCRIPT_VERSIONS : versions

    %% Production Pillar
    SCRIPTS ||--o{ VIDEOS : generates
    VIDEOS ||--o{ SCENES : composed_of
    VIDEOS ||--o{ AUDIO_ASSETS : uses
    VIDEOS ||--o{ GENERATION_JOBS : tracks

    %% Campaign Manager Pillar
    VIDEOS ||--o{ CAMPAIGNS : featured_in
    CAMPAIGNS ||--o{ VARIANTS : has
    CAMPAIGNS ||--o{ CAMPAIGN_ASSETS : contains
    CAMPAIGNS ||--o{ COST_LEDGER : tracks
    CAMPAIGNS ||--o{ CAMPAIGN_AUDIT_LOG : logs

    %% Broadcaster Pillar
    CAMPAIGNS ||--o{ PUBLICATIONS : publishes
    PUBLICATIONS ||--o{ PLATFORM_POSTS : creates
    PLATFORM_POSTS ||--o{ ENGAGEMENT_METRICS : measures
    PUBLICATIONS ||--o{ SCHEDULED_POSTS : schedules

    %% Entity Definitions
    BRAND_GUIDELINES {
        uuid id PK
        string name
        jsonb guidelines
        vector embedding
        timestamp created_at
    }

    CAMPAIGNS {
        uuid id PK
        string name
        string status
        uuid video_id FK
        jsonb metadata
        timestamp created_at
    }

    VIDEOS {
        uuid id PK
        string title
        string storage_url
        integer duration_seconds
        string status
        timestamp created_at
    }

    ENGAGEMENT_METRICS {
        uuid id PK
        uuid platform_post_id FK
        integer views
        integer likes
        integer shares
        float engagement_rate
        timestamp fetched_at
    }
```

### Table Count by Pillar

| Pillar                | Tables  | Key Tables                                                    |
| --------------------- | ------- | ------------------------------------------------------------- |
| **Strategist**        | 4       | `brand_guidelines`, `creative_briefs`, `trends`               |
| **Copywriter**        | 4       | `scripts`, `hooks`, `scene_segments`                          |
| **Production**        | 4       | `videos`, `scenes`, `generation_jobs`                         |
| **Campaign**          | 5       | `campaigns`, `variants`, `cost_ledger`                        |
| **Broadcaster**       | 4       | `publications`, `platform_posts`, `engagement_metrics`        |
| **Phase 4 Additions** | +       | `workflow_executions`, `circuit_breaker_state`, `cost_events` |
| **Total**             | **21+** |                                                               |

---

## 📡 API Reference

### Base URL

```
http://localhost:3001/api/v1
```

### Endpoints

| Method | Endpoint                 | Description                |
| ------ | ------------------------ | -------------------------- |
| `GET`  | `/health`                | Health check               |
| `POST` | `/briefs`                | Generate creative brief    |
| `GET`  | `/briefs/:id`            | Get brief by ID            |
| `POST` | `/scripts`               | Generate script from brief |
| `GET`  | `/scripts/:id`           | Get script by ID           |
| `POST` | `/videos/generate`       | Generate video from script |
| `GET`  | `/videos/:id`            | Get video by ID            |
| `POST` | `/campaigns`             | Create campaign            |
| `POST` | `/campaigns/:id/publish` | Publish campaign           |
| `GET`  | `/campaigns/:id/metrics` | Get engagement metrics     |
| `POST` | `/assets/upload`         | Upload campaign asset      |
| `GET`  | `/assets/:campaignId`    | List campaign assets       |

### Example Request

```bash
curl -X POST http://localhost:3001/api/v1/briefs \
  -H "Content-Type: application/json" \
  -d '{
    "brand_guideline_id": "uuid-here",
    "campaign_goal": "Product launch awareness",
    "target_platform": "instagram",
    "video_duration": 15
  }'
```

---

## 💰 Cost Optimization

### Model Router Logic

```mermaid
flowchart TD
    A[Request] --> B{Budget?}
    B -->|High| C{Quality?}
    B -->|Low| D{Speed?}

    C -->|Cinematic| E[Sora<br/>$0.50/scene]
    C -->|Standard| F[Veo3<br/>$0.40/scene]

    D -->|Fast| G[Nano B<br/>$0.25/scene]
    D -->|Normal| H[Seedream<br/>$0.30/scene]

    style E fill:#ef4444
    style F fill:#f97316
    style G fill:#22c55e
    style H fill:#eab308
```

### Estimated Costs

| Component           | Model       | Cost per Unit |
| ------------------- | ----------- | ------------- |
| Creative Brief      | GPT-4o      | $0.02         |
| Script (3 variants) | GPT-4o-mini | $0.05         |
| Video Scene         | Sora        | $0.50         |
| Video Scene         | Veo3        | $0.40         |
| Video Scene         | Nano B      | $0.25         |
| Voiceover (30s)     | ElevenLabs  | $0.03         |

**30-Second Video Cost Range:** `$6.00 - $12.00`

---

## 🚢 Deployment

### Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Run migrations: `npm run db:migrate`
3. Create storage bucket: `campaign-assets` (public)

### Vercel Deployment (Frontend)

```bash
cd frontend
vercel deploy
```

### Railway/Render (Backend)

```bash
# Dockerfile included
docker build -t brand-infinity .
docker run -p 3001:3001 brand-infinity
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing`
5. Open Pull Request

---

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.

---

## ⭐ Star History

If this project helped you, please consider giving it a star!

---

<p align="center">
  <b>Built with ❤️ using AI</b><br/>
  <sub>GPT-4o • Claude • Veo3 • Sora • ElevenLabs</sub>
</p>
