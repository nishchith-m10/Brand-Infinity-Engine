# 🎬 Brand Infinity Engine

> An AI-powered marketing content pipeline that transforms text into cinematic video campaigns

Transform brand guidelines and trending topics into high-performing video campaigns across Instagram, TikTok, YouTube, and LinkedIn—fully automated with AI.

---

## 🌟 Overview

The **Brand Infinity Engine** is a complete end-to-end system that takes your brand guidelines as input and produces finished, published video ads with zero manual intervention. Built on a 5-pillar architecture powered by cutting-edge AI models (GPT-4o, Claude, Sora, Veo3, ElevenLabs), it handles everything from strategy to distribution.

### What It Does

1. **Analyzes** trending topics across social platforms
2. **Generates** creative briefs aligned with your brand
3. **Writes** compelling video scripts with hooks and CTAs
4. **Produces** cinematic videos using AI video generation
5. **Manages** A/B test variants for optimization
6. **Publishes** directly to Instagram, TikTok, YouTube, and LinkedIn
7. **Tracks** engagement metrics and costs in real-time

### Key Features

- ✅ **Fully Automated**: From strategy to publication
- ✅ **Brand-Aware**: RAG-based brand guideline validation
- ✅ **Cost-Optimized**: Intelligent model routing (Sora vs. Nano B)
- ✅ **A/B Testing**: Automatic campaign variants
- ✅ **Multi-Platform**: Instagram, TikTok, YouTube, LinkedIn
- ✅ **Production-Ready**: Docker, PostgreSQL, n8n orchestration

---

## 🏗️ Architecture

The system is built on **5 interconnected pillars**:

### 1. 🧠 Strategist Pillar
- Scrapes trending content from social platforms
- Analyzes competitor ads
- Generates creative briefs using brand guidelines + trends

### 2. ✍️ Copywriter Pillar
- Writes video scripts from creative briefs
- Generates multiple hook variations
- Breaks scripts into scene-by-scene descriptions

### 3. 🎥 Production House Pillar
- Generates video scenes using AI (Sora, Veo3, Seedream, Nano B)
- Creates voiceovers with ElevenLabs or OpenAI TTS
- Assembles final video with timing and transitions

### 4. 📊 Campaign Manager Pillar
- Creates A/B test variants (different hooks, CTAs)
- Tracks costs per model/operation
- Manages campaign lifecycle

### 5. 📡 Broadcaster Pillar
- Publishes videos to Instagram, TikTok, YouTube, LinkedIn
- Schedules posts for optimal times
- Collects engagement metrics (views, likes, shares)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **Docker & Docker Compose**
- **OpenAI API Key** (minimum requirement)

### 1. Install

```bash
# Clone or navigate to project
cd brand-infinity-engine

# Run automated setup
bash scripts/setup/install_dependencies.sh
```

### 2. Configure

```bash
# Edit .env and add your API keys
nano .env

# Minimum configuration:
OPENAI_API_KEY=sk-your-key-here
POSTGRES_PASSWORD=your-secure-password
```

### 3. Launch

```bash
# Start all services (PostgreSQL, Redis, n8n)
npm run docker:up

# Initialize database
npm run db:migrate

# Seed sample data (optional)
npm run db:seed
```

### 4. Access n8n

```
http://localhost:5678

Username: admin
Password: (from your .env)
```

### 5. Deploy Workflows

```bash
# Deploy n8n workflows
npm run deploy:workflows

# Or import manually via n8n UI
```

### 6. Generate Your First Video

```bash
# Trigger the full pipeline
curl -X POST http://localhost:5678/webhook/strategist \
  -H "Content-Type: application/json" \
  -d '{
    "brand_guideline_id": 1,
    "campaign_goal": "Increase product awareness",
    "target_platform": "Instagram"
  }'
```

---

## 📚 Documentation

- **[Setup Guide](docs/SETUP_GUIDE.md)** - Complete installation and configuration
- **[API Documentation](docs/API_DOCUMENTATION.md)** - Webhook endpoints and database schema
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Architecture](Plan.md)** - System design and workflow details

---

## 🛠️ Tech Stack

### Core Infrastructure
- **n8n** - Workflow automation and orchestration
- **PostgreSQL 14** - Primary database with pgvector for embeddings
- **Redis** - Caching layer for brand guidelines
- **Docker** - Containerization

### AI Models

**Text Generation:**
- OpenAI GPT-4o, GPT-4o-mini
- Anthropic Claude 3.5 Sonnet, Haiku
- DeepSeek Chat, Reasoner

**Video Generation:**
- OpenAI Sora
- Google Veo3
- Seedream
- Nano B

**Audio/TTS:**
- ElevenLabs (Multilingual V2, Turbo V2.5)
- OpenAI TTS-1, TTS-1-HD

**Embeddings:**
- OpenAI text-embedding-3-small/large

### Storage & Distribution
- **Vector DB**: Pinecone or Supabase Vector
- **Object Storage**: AWS S3 or Google Drive
- **CDN**: CloudFront (optional)

### Social Media APIs
- Instagram Graph API
- TikTok API
- YouTube Data API v3
- LinkedIn Marketing API

---

## 🔑 Required API Keys

### Essential (Required)
- [x] **OpenAI** - GPT-4o, embeddings
- [x] **PostgreSQL** - Database credentials

### Recommended
- [ ] **Anthropic Claude** - Advanced reasoning
- [ ] **DeepSeek** - Cost-effective generation
- [ ] **ElevenLabs** - Natural TTS voices
- [ ] **Pinecone** or **Supabase** - Vector search
- [ ] **AWS S3** or **Google Drive** - Video storage

### Video Generation (Choose One+)
- [ ] **OpenAI Sora** - Cinematic quality (slow, expensive)
- [ ] **Google Veo3** - High quality (medium speed/cost)
- [ ] **Seedream** - Good quality (fast, medium cost)
- [ ] **Nano B** - Prototyping (very fast, low cost)

### Social Media (Optional)
- [ ] Instagram, TikTok, YouTube, LinkedIn APIs

See [Setup Guide](docs/SETUP_GUIDE.md) for how to obtain each API key.

---

## 💰 Cost Optimization

The system includes intelligent cost management:

### Model Router
Automatically selects the best model based on:
- Task complexity
- Budget constraints
- Speed requirements

```javascript
// Example: Fast, cost-effective generation
const model = router.selectTextModel({
    complexity: 'low',
    budget: 'low',
    priority: 'speed'
});
// Returns: gpt-4o-mini

// Example: High-quality video
const videoModel = router.selectVideoModel({
    quality: 'cinematic',
    budget: 'high'
});
// Returns: sora
```

### Cost Tracking
Every API call is logged to `cost_ledger`:

```sql
SELECT 
    DATE(timestamp) as date,
    SUM(cost_usd) as total_cost
FROM cost_ledger
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### Estimated Costs Per Video (30-second ad)

| Component | Model | Cost |
|-----------|-------|------|
| Creative Brief | GPT-4o | $0.02 |
| Script (3 variants) | GPT-4o-mini | $0.05 |
| 8 Video Scenes | Sora | $12.00 |
| Voiceover | ElevenLabs | $0.03 |
| **Total** | | **$12.10** |

**Budget Options:**
- **Premium** (Sora): ~$12/video
- **Standard** (Veo3): ~$9.60/video
- **Fast** (Seedream): ~$7.20/video
- **Economy** (Nano B): ~$6.00/video

---

## 📊 Database Schema

### 21 Tables Across 5 Pillars

**Strategist:**
- `trends` - Viral content tracking
- `brand_guidelines` - Brand identity + embeddings
- `competitor_ads` - Competitor analysis
- `creative_briefs` - Campaign concepts

**Copywriter:**
- `scripts` - Video scripts
- `hooks` - Attention-grabbing openings
- `scene_segments` - Scene descriptions
- `script_versions` - A/B test variations

**Production House:**
- `videos` - Master video records
- `scenes` - Individual scene videos
- `generation_jobs` - Async job tracking
- `audio_assets` - Voiceover files

**Campaign Manager:**
- `campaigns` - Campaign metadata
- `variants` - A/B test variants
- `assets` - Media files
- `cost_ledger` - Cost tracking
- `campaign_audit_log` - Change history

**Broadcaster:**
- `publications` - Publication batches
- `platform_posts` - Platform-specific posts
- `scheduled_posts` - Scheduling queue
- `engagement_metrics` - Performance data

See [API Documentation](docs/API_DOCUMENTATION.md) for complete schema details.

---

## 🔄 Workflow Examples

### Example 1: Full Pipeline

```bash
# 1. Generate creative brief
curl -X POST http://localhost:5678/webhook/strategist \
  -d '{"brand_guideline_id": 1, "campaign_goal": "Product launch"}'
# Returns: creative_brief_id: 42

# 2. Generate scripts
curl -X POST http://localhost:5678/webhook/copywriter \
  -d '{"creative_brief_id": 42, "hooks_count": 3}'
# Returns: script_id: 156

# 3. Produce video
curl -X POST http://localhost:5678/webhook/production \
  -d '{"script_id": 156, "quality": "high"}'
# Returns: video_id: 89

# 4. Create campaign
curl -X POST http://localhost:5678/webhook/campaign \
  -d '{"video_id": 89, "variants_count": 3}'
# Returns: campaign_id: 23

# 5. Publish
curl -X POST http://localhost:5678/webhook/broadcast \
  -d '{"campaign_id": 23, "platforms": ["instagram", "tiktok"]}'
# Returns: publication_id: 45
```

### Example 2: A/B Testing

```javascript
// Create 3 variants with different hooks
const campaign = await createCampaign({
    video_id: 89,
    variants_count: 3,
    test_hooks: true
});

// Publish all variants
await broadcast({
    campaign_id: campaign.id,
    platforms: ["instagram"],
    schedule: {
        type: "scheduled",
        publish_at: "2024-02-15T10:00:00Z"
    }
});

// Monitor performance
const metrics = await getEngagementMetrics(campaign.id);
// Find winning variant based on engagement_rate
```

---

## 🧪 Testing

```bash
# Run unit tests
npm test

# Test database connection
npm run db:test

# Test API integrations
npm run test:apis

# Test workflow execution
npm run test:workflows
```

---

## 🔐 Security

### Environment Variables
- Never commit `.env` file
- Use strong passwords (16+ characters)
- Rotate API keys regularly

### Database
- PostgreSQL passwords are encrypted
- SSL connections in production
- Regular backups (use `pg_dump`)

### API Keys
- Store in `.env` only
- Use read-only keys where possible
- Monitor usage for anomalies

### Production Deployment
- Use Docker secrets
- Enable HTTPS for n8n
- Implement rate limiting
- Set up monitoring (Grafana)

---

## 📈 Monitoring

### Cost Dashboard

```bash
# Daily cost report
npm run costs:report

# View in database
SELECT 
    DATE(timestamp) as date,
    provider,
    SUM(cost_usd) as cost
FROM cost_ledger
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY date, provider
ORDER BY date DESC;
```

### Performance Metrics

```bash
# Workflow execution times
# View in n8n UI: Executions tab

# Database performance
psql -U postgres -d brand_infinity -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

### Engagement Tracking

```sql
-- Top performing posts
SELECT 
    pp.platform,
    pp.post_url,
    em.views,
    em.engagement_rate
FROM platform_posts pp
JOIN engagement_metrics em ON pp.platform_post_id = em.platform_post_id
ORDER BY em.engagement_rate DESC
LIMIT 10;
```

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## 📝 License

This project is licensed under the MIT License.

---

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

---

## 🗺️ Roadmap

- [ ] Real-time video streaming generation
- [ ] Multi-language support (i18n)
- [ ] Advanced analytics dashboard
- [ ] Custom video model training
- [ ] Mobile app for campaign management
- [ ] Shopify/WooCommerce integration

---

## ⭐ Star This Project

If you find this helpful, please star the repository!

---

**Built with ❤️ using AI**
>>>>>>> 860c655 (chore: supabase migration, migrations applied, frontend fixes (badge, scene-editor, file-upload, asset-gallery))
