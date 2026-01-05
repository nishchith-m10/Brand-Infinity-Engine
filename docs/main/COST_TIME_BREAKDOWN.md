# Cost & Time Breakdown: 30-Second Video Production

> **Date:** January 3, 2026  
> **Location:** United States  
> **Scope:** Per-use API/service costs only (excludes hosting: n8n, Supabase, Vercel)

---

## Executive Summary

| Metric           | Premium Tier       | Budget Tier       |
| ---------------- | ------------------ | ----------------- |
| **Total Cost**   | $2.25 - $4.50      | $0.25 - $0.80     |
| **Total Time**   | 3-8 minutes        | 5-12 minutes      |
| **Video Output** | 30 seconds @ 1080p | 30 seconds @ 720p |

---

## Table of Contents

1. [Cost Breakdown by Stage](#cost-breakdown-by-stage)
2. [Time Breakdown by Stage](#time-breakdown-by-stage)
3. [LLM Token Cost Details](#llm-token-cost-details)
4. [Video Generation Cost Details](#video-generation-cost-details)
5. [Audio/Voice Cost Details](#audiovoice-cost-details)
6. [Multiple Scenario Examples](#multiple-scenario-examples)
7. [Cost Optimization Strategies](#cost-optimization-strategies)

---

## Cost Breakdown by Stage

### Full Pipeline Cost Table

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    COST BREAKDOWN: 30-SECOND VIDEO                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  STAGE 1: INTENT PARSING (Executive Agent)                                      │
│  ├── Model: Claude 3.5 Sonnet (Premium) / GPT-4o-mini (Budget)                 │
│  ├── Input: ~800 tokens (user message + brand context)                         │
│  ├── Output: ~200 tokens (parsed intent JSON)                                  │
│  └── Cost: $0.0054 (Premium) / $0.00024 (Budget)                               │
│                                                                                  │
│  STAGE 2: CLARIFYING QUESTIONS (if needed, 1-2 rounds)                         │
│  ├── Model: Claude 3.5 Sonnet / GPT-4o-mini                                    │
│  ├── Input: ~500 tokens per round                                              │
│  ├── Output: ~300 tokens per round                                             │
│  └── Cost: $0.006 × 2 = $0.012 (Premium) / $0.0003 × 2 = $0.0006 (Budget)     │
│                                                                                  │
│  STAGE 3: TASK PLANNING (Task Planner Agent)                                   │
│  ├── Model: Claude 3.5 Sonnet / GPT-4o-mini                                    │
│  ├── Input: ~1,200 tokens (intent + brand context)                             │
│  ├── Output: ~800 tokens (task plan JSON)                                      │
│  └── Cost: $0.0156 (Premium) / $0.00066 (Budget)                               │
│                                                                                  │
│  STAGE 4: STRATEGY GENERATION (Strategist Agent)                               │
│  ├── Model: Claude 3.5 Sonnet / Mixtral-8x7B                                   │
│  ├── Input: ~2,000 tokens (brand knowledge + market context)                   │
│  ├── Output: ~1,500 tokens (strategy brief)                                    │
│  └── Cost: $0.0285 (Premium) / $0.004 (Budget)                                 │
│                                                                                  │
│  STAGE 5: SCRIPT GENERATION (Copywriter Agent)                                 │
│  ├── Model: GPT-4o / Llama-3.1-8B                                              │
│  ├── Input: ~2,500 tokens (strategy + brand voice + examples)                  │
│  ├── Output: ~1,200 tokens (30-sec script + hooks + CTAs)                      │
│  └── Cost: $0.0185 (Premium) / $0.00074 (Budget)                               │
│                                                                                  │
│  STAGE 6: VIDEO GENERATION (via n8n → External API)                            │
│  ├── Service: Runway Gen4 Turbo                                                │
│  ├── Duration: 30 seconds                                                       │
│  ├── Rate: $0.05/second (5 credits × $0.01)                                    │
│  └── Cost: $1.50                                                                │
│                                                                                  │
│  STAGE 7: VOICEOVER GENERATION (Optional)                                      │
│  ├── Service: ElevenLabs                                                        │
│  ├── Characters: ~400 chars (30-sec voiceover)                                 │
│  ├── Rate: ~$0.024/min (Starter plan) or $0.012/min (Creator plan)            │
│  └── Cost: $0.012 - $0.024                                                      │
│                                                                                  │
│  STAGE 8: VERIFICATION (Verifier Agent)                                        │
│  ├── Model: Claude 3.5 Sonnet / Mixtral-8x7B                                   │
│  ├── Input: ~1,500 tokens (script + brand guidelines)                          │
│  ├── Output: ~400 tokens (approval + recommendations)                          │
│  └── Cost: $0.0105 (Premium) / $0.0019 (Budget)                                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Cost Summary by Component

| Component                        | Premium Cost      | Budget Cost       | Notes                      |
| -------------------------------- | ----------------- | ----------------- | -------------------------- |
| LLM Calls (All Agents)           | $0.091            | $0.010            | 6-8 API calls total        |
| Video Generation                 | $1.50             | $1.50             | Runway Gen4 Turbo (30 sec) |
| Voiceover (Optional)             | $0.024            | $0.012            | ElevenLabs TTS             |
| Image Generation (if thumbnails) | $0.009            | $0.009            | Stability SDXL             |
| **TOTAL**                        | **$1.62 - $1.65** | **$1.53 - $1.55** | Per video                  |

> **Key Insight:** Video generation dominates cost (~90-95% of total). LLM costs are negligible in comparison.

---

## Time Breakdown by Stage

### Full Pipeline Time Table

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TIME BREAKDOWN: 30-SECOND VIDEO                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  STAGE                                   TIME          CUMULATIVE               │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  1. User submits request                 0 sec         0:00                     │
│  2. Intent parsing (Executive)           2-4 sec       0:04                     │
│  3. Clarifying questions (if any)        30-120 sec    2:00 (user dependent)   │
│  4. Task planning                        3-5 sec       2:05                     │
│  5. Strategy generation                  8-15 sec      2:20                     │
│  6. Script generation                    10-20 sec     2:40                     │
│  7. Video generation dispatch            1-2 sec       2:42                     │
│  8. Video generation processing          60-300 sec    7:42 (API dependent)    │
│  9. Video download & storage             5-15 sec      7:57                     │
│  10. Voiceover generation (if any)       5-10 sec      8:07                     │
│  11. Final assembly (if multi-clip)      10-30 sec     8:37                     │
│  12. Verification                        5-10 sec      8:47                     │
│  13. Delivery to user                    1-2 sec       8:49                     │
│                                                                                  │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  TOTAL (no questions)                                  3-8 minutes              │
│  TOTAL (with user interaction)                         5-12 minutes             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Time by Category

| Category             | Time Range     | Bottleneck?                |
| -------------------- | -------------- | -------------------------- |
| LLM Processing       | 30-60 sec      | No                         |
| User Interaction     | 0-120 sec      | Depends on flow            |
| **Video Generation** | **60-300 sec** | **YES - Major bottleneck** |
| File Operations      | 15-45 sec      | No                         |
| Network Overhead     | 10-20 sec      | No                         |

---

## LLM Token Cost Details

### January 2026 Pricing (Per 1M Tokens)

| Provider       | Model             | Input  | Output | Best For            |
| -------------- | ----------------- | ------ | ------ | ------------------- |
| **OpenAI**     | GPT-4o            | $2.50  | $10.00 | Script writing      |
| OpenAI         | GPT-4o-mini       | $0.15  | $0.60  | Budget everything   |
| OpenAI         | o1                | $15.00 | $60.00 | Complex reasoning   |
| **Anthropic**  | Claude 3.5 Sonnet | $3.00  | $15.00 | Strategy, analysis  |
| Anthropic      | Claude 3.5 Haiku  | $0.80  | $4.00  | Fast tasks          |
| **DeepSeek**   | DeepSeek-V3       | $0.27  | $1.10  | Budget alternative  |
| **OpenRouter** | Llama 3.1-8B      | $0.20  | $0.20  | Free tier available |
| OpenRouter     | Mixtral-8x7B      | $0.24  | $0.24  | Good quality/cost   |

### Token Usage by Agent (Typical Request)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ AGENT             │ INPUT TOKENS │ OUTPUT TOKENS │ TOTAL TOKENS │ % OF PIPELINE │
├────────────────────────────────────────────────────────────────────────────────┤
│ Executive         │     800      │      200      │    1,000     │     10%      │
│ Task Planner      │   1,200      │      800      │    2,000     │     20%      │
│ Strategist        │   2,000      │    1,500      │    3,500     │     35%      │
│ Copywriter        │   2,500      │    1,200      │    3,700     │     37%      │
│ Verifier          │   1,500      │      400      │    1,900     │     19%      │
├────────────────────────────────────────────────────────────────────────────────┤
│ TOTAL             │   8,000      │    4,100      │   12,100     │    100%      │
└────────────────────────────────────────────────────────────────────────────────┘

COST CALCULATION (Premium - Claude 3.5 Sonnet):
• Input:  8,000 tokens × ($3.00 / 1,000,000) = $0.024
• Output: 4,100 tokens × ($15.00 / 1,000,000) = $0.062
• TOTAL LLM COST: $0.086

COST CALCULATION (Budget - GPT-4o-mini):
• Input:  8,000 tokens × ($0.15 / 1,000,000) = $0.0012
• Output: 4,100 tokens × ($0.60 / 1,000,000) = $0.0025
• TOTAL LLM COST: $0.0037
```

---

## Video Generation Cost Details

### Runway ML API Pricing (January 2026)

| Model                   | Credits/Second | $/Second | 30-Sec Video Cost |
| ----------------------- | -------------- | -------- | ----------------- |
| **Gen4 Turbo**          | 5              | $0.05    | **$1.50**         |
| Gen4 Aleph              | 15             | $0.15    | $4.50             |
| Gen3a Turbo             | 5              | $0.05    | $1.50             |
| Veo 3.1 Fast (no audio) | 10             | $0.10    | $3.00             |
| Veo 3.1 (with audio)    | 40             | $0.40    | $12.00            |

### Alternative Video Generation Services

| Service            | Pricing Model | ~30-Sec Cost | Quality     |
| ------------------ | ------------- | ------------ | ----------- |
| Runway Gen4        | Per-second    | $1.50        | High        |
| Pika Labs          | Credit-based  | ~$1.00-$2.00 | Medium-High |
| Kling AI           | Per-video     | ~$0.50-$1.00 | Medium      |
| Luma Dream Machine | Per-video     | ~$0.60       | Medium      |

### Video Generation Time Estimates

| Service           | 5-Sec Clip | 30-Sec Video | Notes          |
| ----------------- | ---------- | ------------ | -------------- |
| Runway Gen4 Turbo | 10-30 sec  | 60-180 sec   | Fast queue     |
| Runway Gen4 Aleph | 30-60 sec  | 180-360 sec  | Higher quality |
| Pika Labs         | 20-60 sec  | 120-360 sec  | Variable queue |

---

## Audio/Voice Cost Details

### ElevenLabs Pricing (January 2026)

| Plan    | Monthly Cost | Credits | Cost per Character | 30-Sec VO (~400 chars) |
| ------- | ------------ | ------- | ------------------ | ---------------------- |
| Free    | $0           | 10,000  | Free (limited)     | $0.00                  |
| Starter | $5           | 30,000  | $0.00017           | $0.07                  |
| Creator | $22          | 100,000 | $0.00022           | $0.09                  |
| Pro     | $99          | 500,000 | $0.0002            | $0.08                  |

### Per-Use Cost Breakdown

```
30-second voiceover = ~400 characters (average speaking pace)

Starter Plan ($5/mo for 30,000 credits):
• Cost per character: $5 / 30,000 = $0.000167
• 400 characters × $0.000167 = $0.067

But if you're on API pay-as-you-go:
• ~$0.20 per 1,000 characters
• 400 characters = $0.08
```

---

## Multiple Scenario Examples

### Scenario 1: Simple Social Post Video (No Voiceover)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ SCENARIO: Instagram Reel - Product Showcase (30 sec, no VO)                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ User Request: "Create a quick product video for our new face cream"            │
│                                                                                  │
│ COST BREAKDOWN:                                                                 │
│ • LLM Calls (3 agents, minimal context)        $0.04 (Premium) / $0.003 (Budget)│
│ • Video Generation (30 sec × $0.05)            $1.50                            │
│ • Thumbnail Image (Stability SDXL)             $0.01                            │
│ ─────────────────────────────────────────────────────────────────────────────   │
│ TOTAL                                          $1.55 (Premium) / $1.51 (Budget) │
│                                                                                  │
│ TIME: 2-4 minutes                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Scenario 2: Full Production Video (With Voiceover)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ SCENARIO: TikTok Ad - Product Launch (30 sec, with VO)                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ User Request: "Create a TikTok ad for Gen Z about our new skincare launch"     │
│                                                                                  │
│ COST BREAKDOWN:                                                                 │
│ • LLM Calls (5 agents, full pipeline)          $0.09 (Premium) / $0.008 (Budget)│
│ • Strategy Research (extra LLM calls)          $0.03 (Premium) / $0.002 (Budget)│
│ • Video Generation (30 sec × $0.05)            $1.50                            │
│ • Voiceover (ElevenLabs, 400 chars)            $0.08                            │
│ • Video Assembly (FFmpeg, free)                $0.00                            │
│ • Thumbnail Image (Stability SDXL)             $0.01                            │
│ ─────────────────────────────────────────────────────────────────────────────   │
│ TOTAL                                          $1.71 (Premium) / $1.60 (Budget) │
│                                                                                  │
│ TIME: 4-7 minutes                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Scenario 3: Multi-Variant Campaign (3 Versions)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ SCENARIO: A/B Test Campaign - 3 Variants (30 sec each)                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ User Request: "Create 3 versions: funny, professional, inspirational"          │
│                                                                                  │
│ COST BREAKDOWN:                                                                 │
│ • LLM Calls (shared strategy, 3× scripts)      $0.15 (Premium) / $0.012 (Budget)│
│ • Video Generation (90 sec total × $0.05)      $4.50                            │
│ • Voiceovers (3 × 400 chars)                   $0.24                            │
│ • Thumbnails (3 images)                        $0.03                            │
│ ─────────────────────────────────────────────────────────────────────────────   │
│ TOTAL                                          $4.92 (Premium) / $4.79 (Budget) │
│ PER VIDEO                                      $1.64 (Premium) / $1.60 (Budget) │
│                                                                                  │
│ TIME: 8-15 minutes (parallel video generation)                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Scenario 4: Premium Quality (Runway Gen4 Aleph)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ SCENARIO: High-End Brand Video (30 sec, premium quality)                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ User Request: "Create a luxury brand video, highest quality"                   │
│                                                                                  │
│ COST BREAKDOWN:                                                                 │
│ • LLM Calls (Claude 3.5 Sonnet throughout)     $0.12                            │
│ • Video Generation (Gen4 Aleph, 30 sec × $0.15) $4.50                           │
│ • Voiceover (ElevenLabs Pro voice)             $0.08                            │
│ • Thumbnail (premium render)                   $0.02                            │
│ ─────────────────────────────────────────────────────────────────────────────   │
│ TOTAL                                          $4.72                             │
│                                                                                  │
│ TIME: 6-10 minutes (slower generation)                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Optimization Strategies

### 1. LLM Cost Reduction

| Strategy                              | Savings            | Trade-off                 |
| ------------------------------------- | ------------------ | ------------------------- |
| Use GPT-4o-mini instead of Claude 3.5 | ~95% on LLM        | Slightly lower quality    |
| Use DeepSeek V3                       | ~90% on LLM        | May need prompt tuning    |
| Cache brand context                   | ~30% on tokens     | Implementation complexity |
| Reduce clarifying questions           | ~50% on some calls | May need better defaults  |

### 2. Video Generation Cost Reduction

| Strategy                         | Savings         | Trade-off            |
| -------------------------------- | --------------- | -------------------- |
| Use Gen3a Turbo instead of Gen4  | 0% (same price) | Lower motion quality |
| Use shorter clips (15 sec)       | 50%             | Less content         |
| Batch generation during off-peak | Variable        | Slower delivery      |
| Use Pika Labs for drafts         | ~30%            | Different style      |

### 3. Volume Discounts

| Monthly Volume | Estimated Discount | Break-even |
| -------------- | ------------------ | ---------- |
| 100+ videos    | 10-15% on APIs     | ~$150/mo   |
| 500+ videos    | 20-25% on APIs     | ~$750/mo   |
| 1000+ videos   | 30%+ (enterprise)  | ~$1,500/mo |

---

## Summary: True Cost Per Video

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    FINAL COST SUMMARY: 30-SECOND VIDEO                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  CONFIGURATION              │  LOW END  │  TYPICAL  │  HIGH END                │
│  ──────────────────────────────────────────────────────────────────────────────│
│                                                                                  │
│  Budget Tier (No VO)        │   $1.51   │   $1.55   │   $1.80                  │
│  Budget Tier (With VO)      │   $1.59   │   $1.65   │   $1.90                  │
│  Premium Tier (No VO)       │   $1.55   │   $1.65   │   $1.95                  │
│  Premium Tier (With VO)     │   $1.63   │   $1.75   │   $2.10                  │
│  Premium Tier (Gen4 Aleph)  │   $4.50   │   $4.75   │   $5.00                  │
│                                                                                  │
│  ──────────────────────────────────────────────────────────────────────────────│
│                                                                                  │
│  COST BREAKDOWN BY CATEGORY (Typical Premium):                                  │
│  • Video Generation:  $1.50  (86%)                                              │
│  • LLM Calls:         $0.09  (5%)                                               │
│  • Voice/Audio:       $0.08  (5%)                                               │
│  • Images/Other:      $0.08  (4%)                                               │
│                                                                                  │
│  ──────────────────────────────────────────────────────────────────────────────│
│                                                                                  │
│  TIME BREAKDOWN:                                                                │
│  • Autonomous (no user input):     3-5 minutes                                 │
│  • With clarifying questions:      5-8 minutes                                 │
│  • Complex multi-step:             8-12 minutes                                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Video generation is ~90% of cost** - LLM optimization has minimal impact on total cost
2. **Time bottleneck is video generation** - Everything else is fast (under 1 min)
3. **Budget vs Premium LLM difference is ~$0.08** - Negligible per video
4. **Voiceover adds ~$0.08** - Worth including for quality
5. **Gen4 Aleph is 3× cost of Gen4 Turbo** - Only use for high-end clients

---

_Pricing researched January 3, 2026. Costs subject to change. All prices in USD._
