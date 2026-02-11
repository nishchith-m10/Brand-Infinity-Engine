# Brand Infinity Engine - Setup Guide

Complete step-by-step guide to set up and deploy the Brand Infinity Engine.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [API Key Configuration](#api-key-configuration)
5. [Database Setup](#database-setup)
6. [n8n Workflow Deployment](#n8n-workflow-deployment)
7. [Verification](#verification)
8. [Next Steps](#next-steps)

---

## Prerequisites

### Required Software

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Docker & Docker Compose** - [Download](https://www.docker.com/get-started)
- **PostgreSQL 14+** (or use Docker)
- **Git** - [Download](https://git-scm.com/)

### Required API Keys

You'll need to obtain API keys for the following services:

#### Essential (Required for Core Functionality)
- **OpenAI** - [Platform](https://platform.openai.com/) - GPT-4o, embeddings
- **PostgreSQL Database** - Connection credentials
- **Redis** (optional if using Docker)

#### AI Models (Optional but Recommended)
- **Anthropic** - [Console](https://console.anthropic.com/) - Claude models
- **DeepSeek** - [Platform](https://platform.deepseek.com/) - Cost-effective models
- **ElevenLabs** - [Platform](https://elevenlabs.io/) - TTS voices

#### Video Generation (Choose One or More)
- **OpenAI Sora** - (Via OpenAI platform when available)
- **Google Veo3** - [AI Studio](https://aistudio.google.com/)
- **Seedream** - [Platform](https://seedream.ai/)
- **Nano B** - [Platform](https://nano-b.ai/)

#### Vector Database (Choose One)
- **Pinecone** - [Console](https://www.pinecone.io/) - Vector similarity search
- **Supabase** - [Dashboard](https://supabase.com/) - PostgreSQL + pgvector

#### Object Storage (Choose One)
- **AWS S3** - [Console](https://aws.amazon.com/s3/) - Video storage
- **Google Drive API** - [Console](https://console.cloud.google.com/)

#### Social Media Platforms (Optional)
- **Instagram Graph API** - [Developers](https://developers.facebook.com/)
- **TikTok API** - [Developers](https://developers.tiktok.com/)
- **YouTube Data API** - [Console](https://console.cloud.google.com/)
- **LinkedIn API** - [Developers](https://www.linkedin.com/developers/)

---

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository (or navigate to your project folder)
cd /path/to/brand-infinity-engine

# Run the automated setup script
bash scripts/setup/install_dependencies.sh
```

The script will:
- ✅ Check prerequisites
- ✅ Create `.env` file from template
- ✅ Install Node.js dependencies
- ✅ Prompt for Docker service startup
- ✅ Offer to run database migrations

### 2. Configure Environment

```bash
# Edit .env and add your API keys
nano .env
```

**Minimum required configuration:**
```env
# Database
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=brand_infinity

# OpenAI (Essential)
OPENAI_API_KEY=sk-...your-key-here...

# n8n
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_n8n_password
```

### 3. Start Services

```bash
# Start all Docker services (PostgreSQL, Redis, n8n)
npm run docker:up

# Or start individually
docker-compose up -d postgres
docker-compose up -d redis
docker-compose up -d n8n
```

### 4. Initialize Database

```bash
# Run all migrations
npm run db:migrate

# Seed with sample data (optional)
npm run db:seed
```

### 5. Deploy Workflows

```bash
# Deploy n8n workflows
npm run deploy:workflows

# Or import manually via n8n UI at http://localhost:5678
```

---

## Detailed Setup

### Step 1: Environment Configuration

#### 1.1 Copy Environment Template

```bash
cp .env.example .env
```

#### 1.2 Configure Database

```env
# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=brand_infinity
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
```

**Security Note:** Use a strong password with at least 16 characters including uppercase, lowercase, numbers, and symbols.

#### 1.3 Configure Vector Database

**Option A: Pinecone**
```env
VECTOR_DB_PROVIDER=pinecone
PINECONE_API_KEY=your-pinecone-key
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=brand-guidelines
```

**Option B: Supabase Vector**
```env
VECTOR_DB_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

#### 1.4 Configure Object Storage

**Option A: AWS S3**
```env
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=brand-infinity-videos
AWS_CLOUDFRONT_URL=https://d1234567.cloudfront.net (optional CDN)
```

**Option B: Google Drive**
```env
STORAGE_PROVIDER=google_drive
GOOGLE_DRIVE_CLIENT_ID=your-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=your-refresh-token
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
```

### Step 2: AI Model Configuration

#### 2.1 OpenAI (Required)

```env
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...  # Optional
```

**Models you'll use:**
- `gpt-4o` - Main strategist and copywriter
- `gpt-4o-mini` - Fast tasks and validation
- `text-embedding-3-small` - Brand guideline embeddings
- `tts-1-hd` - Voiceovers (if using OpenAI TTS)

#### 2.2 Anthropic Claude (Optional)

```env
ANTHROPIC_API_KEY=sk-ant-...
```

**Models:**
- `claude-3-5-sonnet-20241022` - Analysis and research
- `claude-3-5-haiku-20241022` - Fast generation

#### 2.3 DeepSeek (Optional - Cost-Effective)

```env
DEEPSEEK_API_KEY=your-key
```

**Models:**
- `deepseek-chat` - General content generation
- `deepseek-reasoner` - Complex reasoning tasks

#### 2.4 ElevenLabs TTS (Optional)

```env
ELEVENLABS_API_KEY=your-key
ELEVENLABS_VOICE_ID=your-voice-id  # Create a voice in their platform
```

#### 2.5 Video Generation Models

```env
# Sora (via OpenAI)
SORA_API_KEY=your-openai-key

# Google Veo3
VEO3_API_KEY=your-google-key
VEO3_PROJECT_ID=your-project-id

# Seedream
SEEDREAM_API_KEY=your-key

# Nano B
NANO_B_API_KEY=your-key
```

### Step 3: Social Media Platform APIs

#### 3.1 Instagram

```env
INSTAGRAM_ACCESS_TOKEN=your-token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your-account-id
```

**How to get:**
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create an app
3. Add Instagram Graph API
4. Generate access token with `instagram_basic`, `instagram_content_publish` permissions

#### 3.2 TikTok

```env
TIKTOK_CLIENT_KEY=your-client-key
TIKTOK_CLIENT_SECRET=your-client-secret
TIKTOK_ACCESS_TOKEN=your-access-token
```

**How to get:**
1. Apply for [TikTok for Developers](https://developers.tiktok.com/)
2. Create an app
3. Get approval for Content Posting API
4. Generate access token

#### 3.3 YouTube

```env
YOUTUBE_API_KEY=your-api-key
YOUTUBE_CLIENT_ID=your-client-id
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REFRESH_TOKEN=your-refresh-token
```

**How to get:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project
3. Enable YouTube Data API v3
4. Create OAuth 2.0 credentials
5. Use OAuth playground to get refresh token

#### 3.4 LinkedIn

```env
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_ACCESS_TOKEN=your-access-token
LINKEDIN_ORG_ID=your-organization-id
```

#### 3.5 Blotato (Optional)

```env
BLOTATO_API_KEY=your-key
```

---

## Database Setup

### Option 1: Docker (Recommended)

```bash
# Start PostgreSQL with pgvector extension
docker-compose up -d postgres

# Wait for PostgreSQL to be ready (about 5 seconds)
sleep 5

# Run migrations
npm run db:migrate
```

### Option 2: Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# Install pgvector extension
sudo apt-get install postgresql-14-pgvector  # Ubuntu/Debian
brew install pgvector  # macOS

# Enable extension in your database
psql -U postgres -d brand_infinity -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npm run db:migrate
```

### Verify Database Setup

```bash
# Check tables
npm run db:status

# Or manually
psql -U postgres -d brand_infinity -c "\dt"
```

You should see 21 tables:
- `trends`, `brand_guidelines`, `competitor_ads`, `creative_briefs`
- `scripts`, `hooks`, `scene_segments`, `script_versions`
- `videos`, `scenes`, `generation_jobs`, `audio_assets`
- `campaigns`, `variants`, `assets`, `cost_ledger`, `campaign_audit_log`
- `publications`, `platform_posts`, `scheduled_posts`, `engagement_metrics`

---

## n8n Workflow Deployment

### Access n8n

```bash
# Start n8n if not already running
docker-compose up -d n8n

# Access n8n UI
open http://localhost:5678
```

**Default Credentials:**
- Username: `admin` (from your `.env`)
- Password: `your_n8n_password` (from your `.env`)

### Deploy Workflows

#### Option 1: Automated Deployment

```bash
# Deploy all workflows via API
npm run deploy:workflows
```

#### Option 2: Manual Import (Recommended for First Time)

1. Go to http://localhost:5678
2. Click **"Workflows"** → **"Import from File"**
3. Import each workflow from `n8n/workflows/`:
   - `01_strategist_pillar.json`
   - `02_copywriter_pillar.json`
   - `03_production_house_pillar.json`
   - `04_campaign_manager_pillar.json`
   - `05_broadcaster_pillar.json`

### Configure Workflow Credentials

For each workflow, you'll need to add credentials:

1. **PostgreSQL Credentials:**
   - Host: `postgres` (Docker) or `localhost`
   - Database: `brand_infinity`
   - User: `postgres`
   - Password: (from `.env`)

2. **HTTP Credentials for AI APIs:**
   - Header auth with API keys from `.env`

3. **Social Media OAuth:**
   - Follow in-app instructions for Instagram, TikTok, etc.

---

## Verification

### 1. Check Docker Services

```bash
# View running containers
docker ps

# Should see:
# - postgres (healthy)
# - redis (healthy)
# - n8n (healthy)
```

### 2. Test Database Connection

```bash
npm run db:test
```

Expected output:
```
✓ Connected to brand_infinity database
✓ Found 21 tables
✓ pgvector extension enabled
```

### 3. Test API Keys

```bash
npm run test:apis
```

This will verify:
- OpenAI API key validity
- Vector DB connection
- Storage provider access

### 4. Test n8n Workflows

1. Go to http://localhost:5678
2. Open **"01_strategist_pillar"** workflow
3. Click **"Execute Workflow"**
4. Should see successful execution

---

## Next Steps

### 1. Seed Sample Data

```bash
npm run db:seed
```

This creates:
- Sample brand guideline (TechFlow)
- 3 trending topics
- 3 competitor ad examples

### 2. Generate First Creative Brief

Use the Strategist workflow:

```bash
# Via n8n UI: Execute "01_strategist_pillar" workflow
# Or via API:
curl -X POST http://localhost:5678/webhook/strategist \
  -H "Content-Type: application/json" \
  -d '{
    "brand_guideline_id": 1,
    "campaign_goal": "Increase product awareness",
    "target_platform": "Instagram"
  }'
```

### 3. Monitor Costs

```bash
# View cost breakdown
npm run costs:report

# Or query database
psql -U postgres -d brand_infinity -c "SELECT * FROM cost_ledger ORDER BY timestamp DESC LIMIT 10;"
```

### 4. Explore Documentation

- [API Documentation](./API_DOCUMENTATION.md) - Webhook endpoints and database schema
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [Architecture Overview](../Plan.md) - System design and workflow details

---

## Production Deployment

For production deployment, see:

- **Kubernetes Setup:** `docs/kubernetes/`
- **AWS Deployment:** `docs/aws-deployment.md`
- **Security Hardening:** `docs/security.md`

---

## Support

- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-repo/discussions)
- **Documentation:** `docs/` folder

---

## Quick Reference Commands

```bash
# Setup
npm run setup              # Initial setup
npm run docker:up          # Start all services
npm run docker:down        # Stop all services

# Database
npm run db:migrate         # Run migrations
npm run db:rollback        # Rollback last migration
npm run db:seed            # Seed sample data
npm run db:reset           # Reset database (WARNING: Destructive)

# Workflows
npm run deploy:workflows   # Deploy n8n workflows
npm run test:workflows     # Test workflow execution

# Monitoring
npm run logs               # View all logs
npm run costs:report       # Cost analysis
npm run health             # Health check
```

---

**Next:** [API Documentation](./API_DOCUMENTATION.md)
