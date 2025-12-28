# Economic Analysis Report
## Brand Infinity Engine - Per-Video Pricing Model

> **Report Date:** December 2025  
> **Pricing Model:** Per-Video (duration + provider selection)  
> **Target:** Single User / Solo Operation  
> **Note:** Pricing estimates based on available provider data - verify current rates before deployment

---

## Executive Summary

This platform enables cost-effective video production by leveraging AI providers directly. Final pricing depends on:
1. **Video Duration** (15s, 30s, 60s)
2. **Provider Selection** (configured in codebase)

**Key Insight:** Your actual COGS will vary based on which providers you configure. Test with small batches first to establish accurate costs.

---

## 1. Provider Options (From Codebase)

### 1.1 LLM Providers Available

From `frontend/lib/llm/adapters/`:
- **OpenAI** (GPT-4o, GPT-4o-mini)
- **Anthropic** (Claude 3.5 Sonnet)
- **DeepSeek** (DeepSeek-V3)
- **Gemini** (Gemini 2.0)

### 1.2 Video Generation Providers

From `scenes` table schema:
- **NanoB** (`nano_b`)
- **Sora** (`sora`)
- **Veo3** (`veo3`)
- **Seedream** (`seedream`)

---

## 2. Cost Structure Framework

### 2.1 Variable Costs (Per Video)

| Component | Notes |
|-----------|-------|
| Script Generation | Depends on LLM provider + token count |
| RAG Embeddings | OpenAI embeddings (minimal cost) |
| Video Generation | Depends on video provider + duration |

### 2.2 Fixed Costs (Infrastructure)

| Service | Free Tier | When You'll Need Paid |
|---------|-----------|----------------------|
| **Vercel** | 100GB bandwidth/mo | >100GB or need Pro features |
| **Supabase** | 500MB DB, 1GB storage | >500MB or need more storage |
| **Upstash Redis** | 10K commands/day | >10K commands |

**Critical:** Monitor your usage dashboards weekly to avoid surprise bills.

---

## 3. Pricing Strategy Recommendations

### 3.1 Discovery Phase (First 50 Videos)

**Goal:** Establish your actual COGS

1. **Track everything:**
   ```sql
   -- Use the cost_ledger table
   INSERT INTO cost_ledger (
     campaign_id,
     pillar,
     cost_type,
     cost_usd,
     provider,
     model
   ) VALUES (...);
   ```

2. **Test different provider combinations:**
   - Budget: GPT-4o-mini + NanoB
   - Mid-tier: GPT-4o + Veo3
   - Premium: Claude + Sora

3. **Calculate average COGS:**
   ```sql
   SELECT 
     AVG(cost_usd) as avg_cost,
     provider,
     model
   FROM cost_ledger
   GROUP BY provider, model;
   ```

### 3.2 Pricing Formula

Once you know your COGS:

```
Your Price = (COGS × Margin Multiplier) + Fixed Overhead

Suggested Multipliers:
- 2.5x for 60% margin
- 3.0x for 67% margin  
- 4.0x for 75% margin
```

**Example:**
- Your COGS: $2.50
- Target margin: 67%
- Your price: $2.50 × 3.0 = **$7.50**

### 3.3 Tiered Pricing Template

| Duration | Your COGS | Budget Price (2.5x) | Premium Price (4x) |
|----------|-----------|---------------------|-------------------|
| 15 sec | $X | $X × 2.5 | $X × 4.0 |
| 30 sec | $Y | $Y × 2.5 | $Y × 4.0 |
| 60 sec | $Z | $Z × 2.5 | $Z × 4.0 |

---

## 4. Cost Optimization Strategies

### 4.1 Immediate Actions

| Action | Expected Impact |
|--------|-----------------|
| Use cheaper LLM for drafts | 70-90% savings on iterations |
| Limit regenerations to 3 | Prevents runaway costs |
| Cache embeddings (24h) | 50%+ savings on repeated queries |
| Implement cost caps per video | Prevents expensive mistakes |

### 4.2 Code Implementation

```typescript
// In your generation logic
const MAX_COST_PER_VIDEO = 15.00; // Set your limit
const currentCost = await calculateCurrentCost(videoId);

if (currentCost > MAX_COST_PER_VIDEO) {
  throw new Error(`Cost limit exceeded: $${currentCost}`);
}
```

### 4.3 Monitoring Dashboard

Track these metrics:
- Cost per video (rolling 7-day average)
- Cost per provider
- Regeneration rate
- Failed generation rate (wasted cost)

---

## 5. Break-Even Analysis

### 5.1 With Free Tiers (0-150 videos/month)

```
Revenue = Videos × Price
COGS = Videos × Your_Actual_COGS
Infrastructure = $0

Profit = Revenue - COGS
```

**Example (50 videos @ $10 each, $3 COGS):**
- Revenue: $500
- COGS: $150
- Infrastructure: $0
- **Profit: $350 (70% margin)**

### 5.2 Beyond Free Tiers (150+ videos/month)

```
Infrastructure = $50-60/month
Profit = Revenue - COGS - Infrastructure
```

**Example (200 videos @ $10 each, $3 COGS):**
- Revenue: $2,000
- COGS: $600
- Infrastructure: $50
- **Profit: $1,350 (68% margin)**

---

## 6. Market Positioning

### 6.1 Competitor Landscape (December 2025)

| Platform | 30s Video | Your Advantage |
|----------|-----------|----------------|
| Synthesia | $30-60 | 50-80% cheaper |
| Pictory | $25-45 | 50-75% cheaper |
| InVideo AI | $30-40 | 50-70% cheaper |
| HeyGen | $40-70 | 60-85% cheaper |
| Freelancer | $150-400 | 90-95% cheaper |

### 6.2 Your Value Propositions

1. **Transparent Pricing** - No hidden fees, show exact costs
2. **Provider Choice** - Let clients pick budget vs premium
3. **Speed** - 2-5 minutes vs hours/days
4. **Ownership** - Clients own all assets
5. **Customization** - Brand-aware generation

---

## 7. Risk Management

### 7.1 Cost Risks

| Risk | Mitigation |
|------|------------|
| API price increases | Monitor provider announcements, have backup providers |
| Runaway regenerations | Hard limit of 3 per video |
| Failed generations | Implement retry logic with exponential backoff |
| Free tier exhaustion | Set up billing alerts at 80% |

### 7.2 Recommended Alerts

```bash
# Supabase
- Database size > 400MB (80% of free tier)
- Storage > 800MB (80% of free tier)

# Vercel
- Bandwidth > 80GB (80% of free tier)

# Upstash
- Daily commands > 8K (80% of free tier)
```

---

## 8. Action Plan

### Phase 1: Discovery (Week 1-2)
- [ ] Generate 10 test videos with different provider combinations
- [ ] Track exact costs in `cost_ledger` table
- [ ] Calculate average COGS per duration
- [ ] Set initial pricing (COGS × 3.0)

### Phase 2: Validation (Week 3-4)
- [ ] Process 20-30 real orders
- [ ] Monitor actual margins
- [ ] Adjust pricing if needed
- [ ] Document optimal provider combinations

### Phase 3: Scale (Month 2+)
- [ ] Implement automated cost tracking
- [ ] Set up monitoring dashboards
- [ ] Create pricing calculator for clients
- [ ] Monitor free tier usage

---

## 9. Financial Projections

### Conservative Scenario (50 videos/month)

```
Assumptions:
- Average price: $8
- Average COGS: $3
- Infrastructure: $0 (free tier)

Monthly:
- Revenue: $400
- COGS: $150
- Profit: $250 (63% margin)

Annual:
- Revenue: $4,800
- COGS: $1,800
- Profit: $3,000
```

### Growth Scenario (200 videos/month)

```
Assumptions:
- Average price: $10
- Average COGS: $3.50
- Infrastructure: $50

Monthly:
- Revenue: $2,000
- COGS: $700
- Infrastructure: $50
- Profit: $1,250 (63% margin)

Annual:
- Revenue: $24,000
- COGS: $8,400
- Infrastructure: $600
- Profit: $15,000
```

---

## 10. Next Steps

1. **Verify Current Provider Pricing:**
   - Visit https://platform.openai.com/pricing
   - Visit https://www.anthropic.com/pricing
   - Check your configured video providers

2. **Set Up Cost Tracking:**
   - Implement logging to `cost_ledger` table
   - Create dashboard queries
   - Set up weekly cost reports

3. **Test & Iterate:**
   - Generate test videos
   - Calculate actual COGS
   - Adjust pricing model

4. **Monitor & Optimize:**
   - Track margin per video
   - Identify cost leaks
   - Optimize provider selection

---

## Appendix: Cost Tracking Queries

### Average Cost Per Video
```sql
SELECT 
  AVG(cost_usd) as avg_cost,
  COUNT(*) as video_count
FROM cost_ledger
WHERE pillar = 'production'
  AND created_at > NOW() - INTERVAL '30 days';
```

### Cost By Provider
```sql
SELECT 
  provider,
  model,
  AVG(cost_usd) as avg_cost,
  SUM(cost_usd) as total_cost,
  COUNT(*) as usage_count
FROM cost_ledger
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY provider, model
ORDER BY total_cost DESC;
```

### Monthly Cost Trend
```sql
SELECT 
  DATE_TRUNC('day', created_at) as date,
  SUM(cost_usd) as daily_cost
FROM cost_ledger
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date;
```

---

**Important:** This analysis provides a framework. Your actual costs will depend on:
- Which providers you configure
- Current API pricing (changes frequently)
- Your usage patterns
- Video complexity

**Always test with small batches first and track actual costs before scaling.**
