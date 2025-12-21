# Brand Infinity Engine - API Documentation

Complete API reference for webhooks, database schema, and integration endpoints.

---

## 📋 Table of Contents

1. [Webhook Endpoints](#webhook-endpoints)
2. [Database Schema](#database-schema)
3. [Utility Functions](#utility-functions)
4. [Integration Examples](#integration-examples)

---

## Webhook Endpoints

All n8n workflows expose webhook endpoints for triggering pipeline stages.

### Base URL

```
http://localhost:5678/webhook/
```

For production, replace with your n8n instance URL.

---

### 1. Strategist Pillar

**Endpoint:** `POST /webhook/strategist`

Generates creative briefs based on trends, brand guidelines, and competitor analysis.

#### Request Body

```json
{
  "brand_guideline_id": 1,
  "campaign_goal": "Increase product awareness for Q1 2024",
  "target_platform": "Instagram",
  "budget_range": "medium",
  "target_audience_override": "Tech professionals 25-40"
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brand_guideline_id` | integer | Yes | ID from `brand_guidelines` table |
| `campaign_goal` | string | Yes | Campaign objective (max 500 chars) |
| `target_platform` | string | No | Platform: `Instagram`, `TikTok`, `YouTube`, `LinkedIn`, `All` |
| `budget_range` | string | No | `low`, `medium`, `high`, `unlimited` (default: `medium`) |
| `target_audience_override` | string | No | Override brand's default target audience |

#### Response

```json
{
  "success": true,
  "creative_brief_id": 42,
  "brief": {
    "campaign_concept": "Productivity in Motion: Show how TechFlow transforms chaotic workflows into smooth operations",
    "key_message": "Work flows better with TechFlow",
    "target_emotion": "Relief, empowerment, confidence",
    "visual_direction": "Split-screen comparisons, before/after transitions, smooth animations",
    "cta": "Start your free trial today",
    "platform_specific_notes": "Optimize for Instagram Reels 9:16 aspect ratio, 15-30 second duration"
  },
  "metadata": {
    "trends_analyzed": 5,
    "competitor_ads_reviewed": 3,
    "estimated_cost": "$0.0234"
  }
}
```

---

### 2. Copywriter Pillar

**Endpoint:** `POST /webhook/copywriter`

Generates scripts, hooks, and scene breakdowns from creative briefs.

#### Request Body

```json
{
  "creative_brief_id": 42,
  "script_style": "conversational",
  "duration_seconds": 30,
  "include_voiceover": true,
  "hooks_count": 3
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `creative_brief_id` | integer | Yes | ID from `creative_briefs` table |
| `script_style` | string | No | `formal`, `conversational`, `humorous`, `inspirational` (default: `conversational`) |
| `duration_seconds` | integer | No | Target duration: 15-120 seconds (default: 30) |
| `include_voiceover` | boolean | No | Generate voiceover script (default: true) |
| `hooks_count` | integer | No | Number of hook variations: 1-5 (default: 3) |

#### Response

```json
{
  "success": true,
  "script_id": 156,
  "hooks": [
    {
      "hook_id": 201,
      "text": "Ever feel like your work is drowning in chaos?",
      "quality_score": 0.87
    },
    {
      "hook_id": 202,
      "text": "Stop fighting your workflow. Start flowing.",
      "quality_score": 0.92
    },
    {
      "hook_id": 203,
      "text": "What if work actually worked for you?",
      "quality_score": 0.89
    }
  ],
  "script": {
    "full_text": "...",
    "word_count": 87,
    "estimated_duration": 29.5,
    "scenes": [
      {
        "scene_number": 1,
        "duration": 3,
        "visual_description": "Close-up of frustrated person at messy desk",
        "voiceover": "Ever feel like your work is drowning in chaos?",
        "on_screen_text": null
      }
      // ... more scenes
    ]
  },
  "metadata": {
    "quality_score": 0.85,
    "brand_alignment_score": 0.91,
    "estimated_cost": "$0.0456"
  }
}
```

---

### 3. Production House Pillar

**Endpoint:** `POST /webhook/production`

Generates video scenes using AI video models.

#### Request Body

```json
{
  "script_id": 156,
  "video_model": "auto",
  "quality": "high",
  "aspect_ratio": "9:16",
  "include_audio": true,
  "tts_voice_id": "your-elevenlabs-voice-id"
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `script_id` | integer | Yes | ID from `scripts` table |
| `video_model` | string | No | `auto`, `sora`, `veo3`, `seedream`, `nano-b` (default: `auto`) |
| `quality` | string | No | `low`, `medium`, `high`, `cinematic` (default: `high`) |
| `aspect_ratio` | string | No | `16:9`, `9:16`, `1:1`, `4:5` (default: `9:16`) |
| `include_audio` | boolean | No | Generate voiceover (default: true) |
| `tts_voice_id` | string | Conditional | Required if `include_audio` is true |

#### Response

```json
{
  "success": true,
  "video_id": 89,
  "scenes": [
    {
      "scene_id": 301,
      "scene_number": 1,
      "video_url": "https://storage.example.com/videos/scene_301.mp4",
      "thumbnail_url": "https://storage.example.com/thumbnails/scene_301.jpg",
      "duration": 3.2,
      "status": "completed",
      "model_used": "veo3"
    }
    // ... more scenes
  ],
  "audio": {
    "audio_asset_id": 45,
    "url": "https://storage.example.com/audio/voiceover_45.mp3",
    "duration": 29.8,
    "model_used": "eleven_multilingual_v2"
  },
  "metadata": {
    "total_duration": 30.0,
    "scenes_count": 8,
    "estimated_cost": "$12.45",
    "generation_time_seconds": 180
  }
}
```

---

### 4. Campaign Manager Pillar

**Endpoint:** `POST /webhook/campaign`

Creates campaigns with A/B testing variants.

#### Request Body

```json
{
  "video_id": 89,
  "campaign_name": "TechFlow Q1 2024 - Instagram Reels",
  "variants_count": 3,
  "test_hooks": true,
  "test_cta": true
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `video_id` | integer | Yes | ID from `videos` table |
| `campaign_name` | string | Yes | Campaign name (max 255 chars) |
| `variants_count` | integer | No | Number of A/B test variants: 1-5 (default: 1) |
| `test_hooks` | boolean | No | Create variants with different hooks (default: false) |
| `test_cta` | boolean | No | Create variants with different CTAs (default: false) |

#### Response

```json
{
  "success": true,
  "campaign_id": 23,
  "variants": [
    {
      "variant_id": 67,
      "variant_name": "Variant A - Original",
      "video_url": "https://storage.example.com/campaigns/variant_67.mp4",
      "hook_id": 201,
      "modifications": {}
    },
    {
      "variant_id": 68,
      "variant_name": "Variant B - Alt Hook",
      "video_url": "https://storage.example.com/campaigns/variant_68.mp4",
      "hook_id": 202,
      "modifications": {
        "hook_text": "Stop fighting your workflow. Start flowing."
      }
    },
    {
      "variant_id": 69,
      "variant_name": "Variant C - Alt Hook 2",
      "video_url": "https://storage.example.com/campaigns/variant_69.mp4",
      "hook_id": 203,
      "modifications": {
        "hook_text": "What if work actually worked for you?"
      }
    }
  ],
  "metadata": {
    "total_cost": "$13.20",
    "estimated_reach": "10K-50K"
  }
}
```

---

### 5. Broadcaster Pillar

**Endpoint:** `POST /webhook/broadcast`

Publishes or schedules campaigns to social media platforms.

#### Request Body

```json
{
  "campaign_id": 23,
  "platforms": ["instagram", "tiktok"],
  "schedule": {
    "type": "scheduled",
    "publish_at": "2024-02-15T10:00:00Z",
    "timezone": "America/New_York"
  },
  "caption": "Transform your workflow with TechFlow 🚀 #Productivity #WorkSmarter",
  "hashtags": ["#TechFlow", "#Productivity", "#SaaS"]
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `campaign_id` | integer | Yes | ID from `campaigns` table |
| `platforms` | array | Yes | Array of: `instagram`, `tiktok`, `youtube`, `linkedin` |
| `schedule.type` | string | No | `immediate`, `scheduled` (default: `immediate`) |
| `schedule.publish_at` | string (ISO 8601) | Conditional | Required if type is `scheduled` |
| `schedule.timezone` | string | No | IANA timezone (default: `UTC`) |
| `caption` | string | Yes | Post caption (max 2200 chars) |
| `hashtags` | array | No | Array of hashtags (including #) |

#### Response

```json
{
  "success": true,
  "publication_id": 45,
  "posts": [
    {
      "platform_post_id": 101,
      "platform": "instagram",
      "status": "scheduled",
      "scheduled_for": "2024-02-15T10:00:00Z",
      "post_url": null,
      "variant_id": 67
    },
    {
      "platform_post_id": 102,
      "platform": "tiktok",
      "status": "scheduled",
      "scheduled_for": "2024-02-15T10:00:00Z",
      "post_url": null,
      "variant_id": 67
    }
  ],
  "metadata": {
    "scheduled_posts_count": 2,
    "estimated_publish_time": "2024-02-15T10:00:00Z"
  }
}
```

---

## Database Schema

### Pillar 1: Strategist

#### `trends`

Trending topics and viral content from various platforms.

```sql
CREATE TABLE trends (
    trend_id SERIAL PRIMARY KEY,
    trend_text TEXT NOT NULL,
    platform VARCHAR(50),
    virality_score DECIMAL(3,2),
    relevance_score DECIMAL(3,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Columns:**
- `trend_id`: Unique identifier
- `trend_text`: The trending topic or content description
- `platform`: Where the trend was found (`Twitter`, `TikTok`, `Instagram`, etc.)
- `virality_score`: 0.00-1.00, how viral/popular the trend is
- `relevance_score`: 0.00-1.00, relevance to brand/industry
- `metadata`: Additional data like hashtags, view counts, engagement

#### `brand_guidelines`

Brand identity, tone, visual style, and values.

```sql
CREATE TABLE brand_guidelines (
    brand_guideline_id SERIAL PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL,
    industry VARCHAR(255),
    tone TEXT,
    visual_style TEXT,
    target_audience TEXT,
    core_values JSONB,
    embedding vector(1536),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Columns:**
- `brand_guideline_id`: Unique identifier
- `brand_name`: Company or brand name
- `industry`: Business sector
- `tone`: Desired communication tone (e.g., "professional yet approachable")
- `visual_style`: Visual aesthetic description
- `target_audience`: Target demographic
- `core_values`: JSON array of brand values
- `embedding`: Vector embedding for RAG retrieval (1536 dimensions for OpenAI)
- `metadata`: Logo URLs, colors, fonts, etc.

#### `competitor_ads`

Competitor advertising content and performance data.

```sql
CREATE TABLE competitor_ads (
    competitor_ad_id SERIAL PRIMARY KEY,
    competitor_name VARCHAR(255),
    ad_content TEXT,
    platform VARCHAR(50),
    engagement_score DECIMAL(3,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `creative_briefs`

Strategic campaign concepts generated from trends + brand + competitors.

```sql
CREATE TABLE creative_briefs (
    creative_brief_id SERIAL PRIMARY KEY,
    brand_guideline_id INTEGER REFERENCES brand_guidelines(brand_guideline_id),
    campaign_concept TEXT NOT NULL,
    key_message TEXT,
    target_emotion TEXT,
    visual_direction TEXT,
    cta TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Pillar 2: Copywriter

#### `scripts`

Video scripts with scenes and timing.

```sql
CREATE TABLE scripts (
    script_id SERIAL PRIMARY KEY,
    creative_brief_id INTEGER REFERENCES creative_briefs(creative_brief_id),
    full_text TEXT NOT NULL,
    word_count INTEGER,
    estimated_duration DECIMAL(5,2),
    quality_score DECIMAL(3,2),
    brand_alignment_score DECIMAL(3,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `hooks`

Attention-grabbing opening lines.

```sql
CREATE TABLE hooks (
    hook_id SERIAL PRIMARY KEY,
    creative_brief_id INTEGER REFERENCES creative_briefs(creative_brief_id),
    hook_text TEXT NOT NULL,
    quality_score DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `scene_segments`

Individual scenes with visual descriptions and voiceovers.

```sql
CREATE TABLE scene_segments (
    scene_id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(script_id),
    scene_number INTEGER,
    duration DECIMAL(5,2),
    visual_description TEXT,
    voiceover TEXT,
    on_screen_text TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Pillar 3: Production House

#### `videos`

Master video records.

```sql
CREATE TABLE videos (
    video_id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(script_id),
    title VARCHAR(255),
    total_duration DECIMAL(5,2),
    aspect_ratio VARCHAR(10),
    status VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Status values:** `pending`, `in_progress`, `completed`, `failed`

#### `scenes`

Generated video scenes with storage URLs.

```sql
CREATE TABLE scenes (
    scene_id SERIAL PRIMARY KEY,
    video_id INTEGER REFERENCES videos(video_id),
    scene_segment_id INTEGER REFERENCES scene_segments(scene_id),
    scene_number INTEGER,
    video_url TEXT,
    thumbnail_url TEXT,
    duration DECIMAL(5,2),
    model_used VARCHAR(50),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `generation_jobs`

Tracks asynchronous video generation jobs.

```sql
CREATE TABLE generation_jobs (
    job_id SERIAL PRIMARY KEY,
    scene_id INTEGER REFERENCES scenes(scene_id),
    model VARCHAR(50),
    status VARCHAR(50),
    progress_percentage INTEGER,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `audio_assets`

Voiceovers and audio tracks.

```sql
CREATE TABLE audio_assets (
    audio_asset_id SERIAL PRIMARY KEY,
    video_id INTEGER REFERENCES videos(video_id),
    audio_url TEXT,
    duration DECIMAL(5,2),
    model_used VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### Pillar 4: Campaign Manager

#### `campaigns`

Marketing campaigns with metadata.

```sql
CREATE TABLE campaigns (
    campaign_id SERIAL PRIMARY KEY,
    video_id INTEGER REFERENCES videos(video_id),
    campaign_name VARCHAR(255),
    status VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `variants`

A/B test variants of campaigns.

```sql
CREATE TABLE variants (
    variant_id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(campaign_id),
    variant_name VARCHAR(255),
    video_url TEXT,
    hook_id INTEGER REFERENCES hooks(hook_id),
    modifications JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `cost_ledger`

Tracks all API costs.

```sql
CREATE TABLE cost_ledger (
    cost_id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    operation VARCHAR(100),
    provider VARCHAR(50),
    model VARCHAR(100),
    cost_usd DECIMAL(10,4),
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);
```

**entity_type:** `script`, `video`, `scene`, `audio`, `campaign`

---

### Pillar 5: Broadcaster

#### `publications`

Publication batches to multiple platforms.

```sql
CREATE TABLE publications (
    publication_id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(campaign_id),
    status VARCHAR(50),
    scheduled_for TIMESTAMP,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `platform_posts`

Individual posts per platform.

```sql
CREATE TABLE platform_posts (
    platform_post_id SERIAL PRIMARY KEY,
    publication_id INTEGER REFERENCES publications(publication_id),
    platform VARCHAR(50),
    variant_id INTEGER REFERENCES variants(variant_id),
    post_url TEXT,
    status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Platforms:** `instagram`, `tiktok`, `youtube`, `linkedin`, `blotato`

#### `engagement_metrics`

Real-time engagement tracking.

```sql
CREATE TABLE engagement_metrics (
    metric_id SERIAL PRIMARY KEY,
    platform_post_id INTEGER REFERENCES platform_posts(platform_post_id),
    views INTEGER,
    likes INTEGER,
    comments INTEGER,
    shares INTEGER,
    saves INTEGER,
    engagement_rate DECIMAL(5,2),
    recorded_at TIMESTAMP DEFAULT NOW()
);
```

---

## Utility Functions

### Brand Validator

```javascript
const BrandValidator = require('./utils/brand_validator');

const validator = new BrandValidator(vectorDbClient, openaiApiKey);

const result = await validator.validateContent(
    "Check out our amazing new product!",
    brandGuidelineId
);

console.log(result.isValid);  // true/false
console.log(result.score);    // 0.0-1.0
console.log(result.suggestions);  // Array of improvement suggestions
```

### Cost Calculator

```javascript
const CostCalculator = require('./utils/cost_calculator');

const calculator = new CostCalculator();

const cost = calculator.calculateTextCost(
    'openai',
    'gpt-4o',
    1500,  // input tokens
    500    // output tokens
);

console.log(calculator.formatCost(cost));  // "$0.0125"
```

### Quality Scorer

```javascript
const QualityScorer = require('./utils/quality_scorer');

const scorer = new QualityScorer(openaiApiKey);

const result = await scorer.scoreContent(
    "Your script text here...",
    'script'
);

console.log(result.overallScore);  // 0.0-1.0
console.log(result.rating);        // "Excellent", "Good", etc.
console.log(result.suggestions);   // Improvement suggestions
```

### Model Router

```javascript
const ModelRouter = require('./utils/model_router');

const router = new ModelRouter();

const selected = router.selectTextModel({
    complexity: 'high',
    budget: 'medium',
    priority: 'quality',
    task: 'creative'
});

console.log(selected.model);    // "gpt-4o"
console.log(selected.reason);   // Explanation
```

---

## Integration Examples

### Node.js

```javascript
const axios = require('axios');

// Generate creative brief
const response = await axios.post('http://localhost:5678/webhook/strategist', {
    brand_guideline_id: 1,
    campaign_goal: "Increase Q1 signups",
    target_platform: "Instagram"
});

const briefId = response.data.creative_brief_id;

// Generate script
const scriptResponse = await axios.post('http://localhost:5678/webhook/copywriter', {
    creative_brief_id: briefId,
    duration_seconds: 30
});

console.log('Script generated:', scriptResponse.data.script_id);
```

### Python

```python
import requests

# Full pipeline execution
n8n_base = "http://localhost:5678/webhook"

# Step 1: Creative brief
brief_resp = requests.post(f"{n8n_base}/strategist", json={
    "brand_guideline_id": 1,
    "campaign_goal": "Product launch campaign",
    "target_platform": "TikTok"
})
brief_id = brief_resp.json()["creative_brief_id"]

# Step 2: Script
script_resp = requests.post(f"{n8n_base}/copywriter", json={
    "creative_brief_id": brief_id,
    "hooks_count": 3
})
script_id = script_resp.json()["script_id"]

# Step 3: Production
video_resp = requests.post(f"{n8n_base}/production", json={
    "script_id": script_id,
    "quality": "high"
})
video_id = video_resp.json()["video_id"]

print(f"Video generated: {video_id}")
```

### cURL

```bash
# One-liner campaign creation
curl -X POST http://localhost:5678/webhook/strategist \
  -H "Content-Type: application/json" \
  -d '{"brand_guideline_id": 1, "campaign_goal": "Q1 Launch", "target_platform": "Instagram"}'
```

---

**Next:** [Troubleshooting Guide](./TROUBLESHOOTING.md)
