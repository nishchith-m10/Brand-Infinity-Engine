# PHASE 6 PART II IMPLEMENTATION MANIFESTO

## Multi-Agent Architecture for Creative Director

**Document Classification:** L10 SYSTEMS ARCHITECTURE  
**Version:** 1.0.0  
**Status:** PROPOSED FOR APPROVAL  
**Prerequisite:** Phase 6 Part I (Multi-KB Architecture)  
**Target:** Intelligent agent system with task delegation, clarifying questions, and quality verification

---

## TABLE OF CONTENTS

1. [Executive Summary](#section-1-executive-summary)
2. [Problem Analysis](#section-2-problem-analysis)
3. [Agent Hierarchy Design](#section-3-agent-hierarchy-design)
4. [Executive Agent Specification](#section-4-executive-agent-specification)
5. [Manager Agent Specifications](#section-5-manager-agent-specifications)
6. [Clarifying Questions System](#section-6-clarifying-questions-system)
7. [Task Decomposition Engine](#section-7-task-decomposition-engine)
8. [Conversation Memory System](#section-8-conversation-memory-system)
9. [Quality Verification Pipeline](#section-9-quality-verification-pipeline)
10. [Database Schema Design](#section-10-database-schema-design)
11. [API Specifications](#section-11-api-specifications)
12. [n8n Workflow Integration](#section-12-n8n-workflow-integration)
13. [Frontend Implementation](#section-13-frontend-implementation)
14. [LLM Cost Optimization](#section-14-llm-cost-optimization)
15. [Error Handling & Recovery](#section-15-error-handling-and-recovery)
16. [Implementation Roadmap](#section-16-implementation-roadmap)
17. [Verification Plan](#section-17-verification-plan)

---

# SECTION 1: EXECUTIVE SUMMARY

## 1.1 The Problem

The current Creative Director is a **single-shot parser**, not an intelligent agent:

| Current Limitation      | Impact                                      | User Experience                       |
| :---------------------- | :------------------------------------------ | :------------------------------------ |
| No clarifying questions | Ambiguous prompts produce poor output       | User frustration, regeneration cycles |
| No task decomposition   | Complex requests handled as monolithic blob | Lower quality, missed nuances         |
| No conversation memory  | Each request is isolated                    | Repetitive context-setting            |
| No quality verification | Output shipped as-is                        | User becomes QA bottleneck            |
| Single LLM call         | All intelligence in one prompt              | Context limits, no specialization     |

## 1.2 The Vision

> **"A creative team in a box - where the Executive Agent is the CMO, Manager Agents are department heads, and Worker tools are specialized creators."**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTELLIGENT AGENT SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    User: "Create a video about our protein powder"                          │
│                                │                                            │
│                                ▼                                            │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │                      EXECUTIVE AGENT                            │     │
│    │  "I need more information. Let me ask clarifying questions..."  │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│                                │                                            │
│                                ▼                                            │
│    Agent: "Great! A few quick questions:                                    │
│            1. Which product variant - Original or Chocolate?                │
│            2. What platform - TikTok, Instagram, or YouTube?                │
│            3. What's the key message - taste, nutrition, or price?"         │
│                                │                                            │
│                                ▼                                            │
│    User: "Chocolate, TikTok, focus on protein content"                      │
│                                │                                            │
│                                ▼                                            │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │  Executive: "Now I'll delegate to specialists..."              │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│                │                   │                   │                    │
│        ┌───────┘                   │                   └───────┐            │
│        ▼                           ▼                           ▼            │
│  ┌───────────────┐         ┌───────────────┐         ┌───────────────┐     │
│  │  STRATEGIST   │         │  COPYWRITER   │         │   PRODUCER    │     │
│  │  MANAGER      │         │  MANAGER      │         │   MANAGER     │     │
│  │               │         │               │         │               │     │
│  │ • Brief gen   │         │ • Script      │         │ • Video gen   │     │
│  │ • Audience    │         │ • Hooks       │         │ • Image gen   │     │
│  │ • Platform    │         │ • CTA         │         │ • Audio       │     │
│  └───────────────┘         └───────────────┘         └───────────────┘     │
│                                    │                                        │
│                                    ▼                                        │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │                    QUALITY VERIFIER                             │     │
│    │  "Checking brand alignment, platform specs, quality..."         │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│                                    │                                        │
│                                    ▼                                        │
│    Agent: "Here's your TikTok video! I've optimized it for..."             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.3 Key Design Decisions

| Decision             | Choice                                        | Rationale                                                |
| :------------------- | :-------------------------------------------- | :------------------------------------------------------- |
| Agent Count          | 1 Executive + 3-5 Managers + Tool Functions   | Manageable complexity, clear responsibilities            |
| Orchestration        | Backend API (not n8n)                         | Lower latency for conversation, n8n for async production |
| Clarifying Questions | Deterministic + LLM hybrid                    | Ensure key info collected without hallucination          |
| Memory               | Redis + Database                              | Fast session memory + persistent conversation history    |
| Model Selection      | GPT-4o for Executive, GPT-4o-mini for Workers | Quality where it matters, cost optimization elsewhere    |

## 1.4 Relationship to Part I

Part I provides the **knowledge foundation**. Part II provides the **intelligence layer**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  PART II: Agent Architecture                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Executive Agent                                            │   │
│  │  Manager Agents                                             │   │
│  │  Clarifying Questions                                       │   │
│  │  Quality Verification                                       │   │
│  └─────────────────────────────────────────╬════════════════════┘   │
│                                             ║                       │
│  ═══════════════════════════════════════════╬═══════════════════   │
│                                             ║                       │
│  ┌─────────────────────────────────────────╬════════════════════┐   │
│  │  PART I: Multi-KB Architecture          ▼                   │   │
│  │  ┌─────────────────────────────────────────────────────────┐│   │
│  │  │  Knowledge Bases                                        ││   │
│  │  │  Selective Context Injection                            ││   │
│  │  │  Vector Search (RAG)                                    ││   │
│  │  └─────────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

# SECTION 2: PROBLEM ANALYSIS

## 2.1 Current Creative Director Flow

```
User Prompt ──► GPT Parse ──► Structured JSON ──► User Confirms ──► n8n Workflow
                   │
                   └── Single LLM call
                   └── No follow-up
                   └── No memory
                   └── No quality check
```

### Current Code Analysis

From `/api/v1/director/route.ts`:

```typescript
// Current: Single GPT call to parse
const parseResponse = await getOpenAI().chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: `You are a creative brief parser. Extract structured campaign parameters...`,
    },
    {
      role: "user",
      content: prompt, // User's raw input - no clarification
    },
  ],
  response_format: { type: "json_object" },
});
```

**Problems:**

1. Ambiguous input → guess at parameters → wrong output
2. No domain specialization → generic parsing
3. No verification → errors pass through

## 2.2 What Users Actually Need

### User Journey Analysis

```
User types: "Make me a video about my product"

Current System Response:
{
  "platform": "instagram",        ← Guessed
  "duration_seconds": 15,         ← Default
  "campaign_theme": "my product", ← Copied verbatim
  "tone": "professional",         ← Generic default
  "confidence": 0.45              ← Low confidence, but still proceeds!
}

What User Actually Wanted:
{
  "platform": "tiktok",           ← Different platform
  "duration_seconds": 30,         ← Different duration
  "campaign_theme": "Chocolate Protein Powder Summer Launch",
  "tone": "energetic, young",     ← Different tone
  "target_audience": "Fitness enthusiasts 18-35",
  "key_message": "25g protein per serving"
}
```

### The Gap

| Information     | Current Approach       | Desired Approach             |
| :-------------- | :--------------------- | :--------------------------- |
| Platform        | Guess or default       | Ask if not specified         |
| Product details | Hope user mentions     | Query Knowledge Base         |
| Tone preference | Generic "professional" | Infer from brand voice + ask |
| Target audience | Ignore                 | Load from KB + confirm       |
| Key message     | User must specify      | Suggest from product KB      |

## 2.3 Affected System Components

| Component                   | Current State           | Required Changes                  |
| :-------------------------- | :---------------------- | :-------------------------------- |
| `/api/v1/director/route.ts` | Single parse call       | Multi-turn conversation API       |
| `/director/page.tsx`        | Prompt input + confirm  | Chat interface with follow-ups    |
| `lib/ai/rag.ts`             | Simple context fetch    | Agent-aware context injection     |
| n8n workflows               | Receive parsed intent   | Receive verified, enriched intent |
| Database                    | No conversation storage | Conversation history tables       |
| Redis                       | Not used                | Session state, conversation cache |

---

# SECTION 3: AGENT HIERARCHY DESIGN

## 3.1 Agent Taxonomy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AGENT HIERARCHY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TIER 1: ORCHESTRATION                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        EXECUTIVE AGENT                              │   │
│  │  Model: GPT-4o (high intelligence required)                         │   │
│  │  Purpose: Intent understanding, task delegation, conversation       │   │
│  │  Capabilities:                                                      │   │
│  │    • Parse user intent with clarifying questions                    │   │
│  │    • Maintain conversation state                                    │   │
│  │    • Delegate to Manager Agents                                     │   │
│  │    • Synthesize outputs from Managers                               │   │
│  │    • Handle user feedback and iteration                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  TIER 2: DOMAIN MANAGERS                                                    │
│  ┌───────────────────┬────────────────────┬────────────────────────────┐   │
│  │  STRATEGIST MGR   │   COPYWRITER MGR   │      PRODUCER MGR          │   │
│  │  Model: GPT-4o-m  │   Model: GPT-4o-m  │      Model: GPT-4o-mini    │   │
│  │                   │                    │                            │   │
│  │  • Market analysis│   • Script writing │      • Video generation    │   │
│  │  • Audience       │   • Hook creation  │      • Image generation    │   │
│  │  • Platform specs │   • CTA crafting   │      • Audio synthesis     │   │
│  │  • Campaign brief │   • Copy variants  │      • Asset assembly      │   │
│  └───────────────────┴────────────────────┴────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  TIER 3: WORKER TOOLS (Function Calls)                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Tool Functions (not separate agents - invoked by Managers)         │   │
│  │                                                                      │   │
│  │  Strategy Tools:       Copy Tools:         Production Tools:         │   │
│  │  • get_trends()        • generate_hook()   • generate_image()       │   │
│  │  • analyze_audience()  • write_script()    • generate_video()       │   │
│  │  • get_platform_specs()• create_cta()      • synthesize_audio()     │   │
│  │  • create_brief()      • localize_copy()   • compose_scenes()       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  TIER 4: VERIFICATION                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      QUALITY VERIFIER                               │   │
│  │  Model: GPT-4o-mini                                                 │   │
│  │  Purpose: Validate outputs against brand, platform, quality rules  │   │
│  │  Checks:                                                            │   │
│  │    • Brand voice alignment                                          │   │
│  │    • Platform specification compliance                              │   │
│  │    • Content quality scoring                                        │   │
│  │    • Negative constraint enforcement                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Agent Responsibilities Matrix

| Agent            | Input                  | Output                  | Triggers             | Model       | Est. Tokens/Call |
| :--------------- | :--------------------- | :---------------------- | :------------------- | :---------- | :--------------- |
| Executive        | User message + history | Questions OR delegation | User message         | GPT-4o      | 2000-4000        |
| Strategist Mgr   | Briefing request       | Creative brief JSON     | Executive delegation | GPT-4o-mini | 1500-3000        |
| Copywriter Mgr   | Brief + context        | Script + hooks          | Executive delegation | GPT-4o-mini | 2000-4000        |
| Producer Mgr     | Script + assets        | Production job          | Executive delegation | GPT-4o-mini | 1000-2000        |
| Quality Verifier | Any output             | Pass/Fail + feedback    | Before delivery      | GPT-4o-mini | 1000-2000        |

## 3.3 Why Not 30+ Agents?

The user hypothesized 30-35 agents. Here's why we use fewer:

| Approach                | Pros                | Cons                                 | Our Choice |
| :---------------------- | :------------------ | :----------------------------------- | :--------- |
| Many specialized agents | Deep expertise      | Coordination overhead, latency, cost | ❌         |
| Few agents + many tools | Balanced, efficient | Slightly less specialized            | ✅         |
| Single mega-agent       | Simple              | Context limits, no parallelism       | ❌         |

**The "30+ capabilities" come from TOOLS, not agents.** Each Manager can invoke 5-10 tool functions, giving us 30+ capabilities with only 5 agents.

---

# SECTION 4: EXECUTIVE AGENT SPECIFICATION

## 4.1 Core Responsibilities

The Executive Agent is the **brain** of the system:

1. **Intent Understanding**: Parse what the user actually wants
2. **Information Gathering**: Ask clarifying questions when needed
3. **Context Loading**: Select relevant Knowledge Bases
4. **Task Planning**: Break request into subtasks
5. **Delegation**: Assign subtasks to Manager Agents
6. **Synthesis**: Combine Manager outputs into coherent response
7. **Iteration**: Handle user feedback and adjustments

## 4.2 System Prompt

```typescript
const EXECUTIVE_AGENT_SYSTEM_PROMPT = `
You are the Executive Agent for Brand Infinity Engine, a creative content generation platform.
Your role is to understand user requests, gather necessary information, and coordinate content creation.

## YOUR CAPABILITIES
1. Understand natural language requests for content creation (images, videos, ads)
2. Ask clarifying questions when the request is ambiguous
3. Access brand knowledge bases for context
4. Delegate specialized tasks to Manager Agents
5. Verify quality before delivering to user

## CONVERSATION GUIDELINES
- Be conversational but efficient
- Ask only essential questions (max 3-4 at once)
- Group related questions together
- Provide helpful defaults when appropriate
- Show understanding of the brand context

## WHEN TO ASK QUESTIONS
Ask clarifying questions when:
- Platform is not specified or ambiguous
- Product/service is unclear
- Target audience is not defined
- Duration (for video) is not specified
- Tone/style preference is missing
- Key message is not clear

Do NOT ask questions when:
- Information is in the loaded Knowledge Base
- A reasonable default exists
- User explicitly said "just create something"

## RESPONSE FORMAT
When gathering information, respond conversationally.
When ready to proceed, output a structured delegation plan.

## AVAILABLE KNOWLEDGE BASES
{loaded_kb_names}

## BRAND CONTEXT
{brand_context_summary}

## CONVERSATION HISTORY
{conversation_history}
`;
```

## 4.3 Decision Logic

```typescript
// lib/agents/executive.ts

interface ExecutiveDecision {
  action: "ask_questions" | "delegate" | "respond" | "iterate";
  questions?: ClarifyingQuestion[];
  delegation?: DelegationPlan;
  response?: string;
}

interface ClarifyingQuestion {
  id: string;
  question: string;
  type: "choice" | "text" | "confirm";
  options?: string[];
  required: boolean;
  default?: string;
}

interface DelegationPlan {
  strategy_task?: StrategyTask;
  copy_task?: CopyTask;
  production_task?: ProductionTask;
  parallel: boolean; // Can tasks run in parallel?
}

async function executeAgentDecision(
  userMessage: string,
  conversationState: ConversationState,
  brandContext: BrandContext
): Promise<ExecutiveDecision> {
  // Step 1: Analyze what we know vs what we need
  const knownInfo = extractKnownInformation(conversationState, brandContext);
  const requiredInfo = determineRequiredInformation(userMessage);
  const missingInfo = requiredInfo.filter((r) => !knownInfo.has(r));

  // Step 2: Decide action
  if (missingInfo.length > 0 && !conversationState.skipQuestions) {
    return {
      action: "ask_questions",
      questions: generateQuestions(missingInfo, brandContext),
    };
  }

  // Step 3: All info gathered - create delegation plan
  const plan = await createDelegationPlan(conversationState, brandContext);

  return {
    action: "delegate",
    delegation: plan,
  };
}
```

## 4.4 State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXECUTIVE AGENT STATE MACHINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐                                                           │
│  │   INITIAL    │ ◄──────────────────────────────────┐                     │
│  │   STATE      │                                     │                     │
│  └──────┬───────┘                                     │                     │
│         │ User sends                                  │                     │
│         │ first message                               │                     │
│         ▼                                             │                     │
│  ┌──────────────┐                                     │                     │
│  │  ANALYZING   │                                     │                     │
│  │  REQUEST     │                                     │ User says           │
│  └──────┬───────┘                                     │ "start over"        │
│         │                                             │                     │
│         ├─── Missing info? ───┐                       │                     │
│         │                     ▼                       │                     │
│         │              ┌──────────────┐               │                     │
│         │              │  GATHERING   │               │                     │
│         │              │  INFO        │◄──────┐       │                     │
│         │              └──────┬───────┘       │       │                     │
│         │                     │               │       │                     │
│         │                     │ User answers  │       │                     │
│         │                     ▼               │       │                     │
│         │              ┌──────────────┐       │       │                     │
│         │              │  VALIDATING  │───────┘       │                     │
│         │              │  ANSWERS     │  Still need   │                     │
│         │              └──────┬───────┘  more info    │                     │
│         │                     │                       │                     │
│         │ All info present    │ All info validated   │                     │
│         │                     │                       │                     │
│         └─────────┬───────────┘                       │                     │
│                   ▼                                   │                     │
│            ┌──────────────┐                           │                     │
│            │  CONFIRMING  │                           │                     │
│            │  PLAN        │                           │                     │
│            └──────┬───────┘                           │                     │
│                   │                                   │                     │
│                   │ User confirms                     │                     │
│                   ▼                                   │                     │
│            ┌──────────────┐                           │                     │
│  ┌────────►│  DELEGATING  │                           │                     │
│  │         │  TO MANAGERS │                           │                     │
│  │         └──────┬───────┘                           │                     │
│  │                │                                   │                     │
│  │                ▼                                   │                     │
│  │         ┌──────────────┐                           │                     │
│  │         │  PROCESSING  │ (Async - n8n workflows)   │                     │
│  │         │              │                           │                     │
│  │         └──────┬───────┘                           │                     │
│  │                │                                   │                     │
│  │                ▼                                   │                     │
│  │         ┌──────────────┐                           │                     │
│  │         │  VERIFYING   │                           │                     │
│  │         │  QUALITY     │                           │                     │
│  │         └──────┬───────┘                           │                     │
│  │                │                                   │                     │
│  │  ┌─────────────┼─────────────┐                     │                     │
│  │  │ Passed      │             │ Failed              │                     │
│  │  ▼             │             ▼                     │                     │
│  │ ┌──────────┐   │        ┌──────────────┐           │                     │
│  │ │ DELIVERED│   │        │  ITERATING   │───────────┘                     │
│  │ │          │   │        │  (Regen)     │                                 │
│  │ └──────────┘   │        └──────────────┘                                 │
│  │                │                                                         │
│  │                │ User requests changes                                   │
│  └────────────────┘                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# SECTION 5: MANAGER AGENT SPECIFICATIONS

## 5.1 Strategist Manager

### Purpose

Transform user intent into actionable creative strategy and campaign briefs.

### System Prompt

```typescript
const STRATEGIST_MANAGER_PROMPT = `
You are the Strategist Manager for Brand Infinity Engine.
Your role is to create strategic foundations for content campaigns.

## YOUR RESPONSIBILITIES
1. Analyze the target audience and their preferences
2. Research current trends relevant to the campaign
3. Define platform-specific requirements
4. Create comprehensive creative briefs
5. Suggest optimal content formats and approaches

## AVAILABLE TOOLS
- get_platform_specs(platform): Get requirements for target platform
- analyze_audience(demographics): Get audience insights
- get_trending_topics(category): Fetch relevant trends
- get_competitor_insights(brand_id): Analyze competitor activity
- create_creative_brief(params): Generate structured brief

## OUTPUT FORMAT
Always output structured JSON with:
{
  "brief": {
    "campaign_name": "string",
    "objective": "string",
    "target_audience": {
      "demographics": {},
      "psychographics": {},
      "pain_points": []
    },
    "key_messages": [],
    "platform_specs": {},
    "recommended_approach": "string"
  },
  "confidence_score": 0.0-1.0,
  "assumptions_made": []
}

## BRAND CONTEXT
{brand_context}

## TASK
{task_description}
`;
```

### Tool Functions

```typescript
// lib/agents/tools/strategy-tools.ts

interface PlatformSpecs {
  platform: string;
  video_duration: { min: number; max: number; optimal: number };
  aspect_ratios: string[];
  max_file_size_mb: number;
  audio_required: boolean;
  caption_limits?: number;
  hashtag_recommendations?: number;
}

const PLATFORM_SPECS: Record<string, PlatformSpecs> = {
  tiktok: {
    platform: "tiktok",
    video_duration: { min: 5, max: 180, optimal: 30 },
    aspect_ratios: ["9:16"],
    max_file_size_mb: 287,
    audio_required: true,
    hashtag_recommendations: 5,
  },
  instagram_reels: {
    platform: "instagram_reels",
    video_duration: { min: 3, max: 90, optimal: 15 },
    aspect_ratios: ["9:16", "1:1"],
    max_file_size_mb: 250,
    audio_required: true,
    hashtag_recommendations: 10,
  },
  youtube_shorts: {
    platform: "youtube_shorts",
    video_duration: { min: 15, max: 60, optimal: 30 },
    aspect_ratios: ["9:16"],
    max_file_size_mb: 256,
    audio_required: true,
  },
};

export function getPlatformSpecs(platform: string): PlatformSpecs {
  return PLATFORM_SPECS[platform] || PLATFORM_SPECS["instagram_reels"];
}

export async function analyzeAudience(params: {
  demographics: Record<string, any>;
  brandId: string;
}): Promise<AudienceInsights> {
  // Query brand KB for audience data
  return {
    segments: [],
    preferences: [],
    content_affinities: [],
    optimal_posting_times: [],
  };
}
```

## 5.2 Copywriter Manager

### Purpose

Transform creative briefs into compelling copy: scripts, hooks, CTAs, and captions.

### System Prompt

```typescript
const COPYWRITER_MANAGER_PROMPT = `
You are the Copywriter Manager for Brand Infinity Engine.
Your role is to create compelling copy that drives engagement and action.

## YOUR RESPONSIBILITIES
1. Write video scripts that hook and retain viewers
2. Create platform-optimized hooks (first 3 seconds)
3. Craft compelling calls-to-action
4. Generate caption and hashtag copy
5. Create variants for A/B testing

## AVAILABLE TOOLS
- generate_hooks(params): Create attention-grabbing openers
- write_script(params): Generate full video script
- create_cta(params): Craft calls-to-action
- generate_caption(params): Write social captions
- create_variants(base_copy, count): Generate A/B variants

## COPYWRITING PRINCIPLES
1. Hook within first 3 seconds
2. Mirror audience language and pain points
3. Benefit-focused, not feature-focused
4. Clear, singular call-to-action
5. Platform-native style

## OUTPUT FORMAT
{
  "script": {
    "hook": "string (first 3 seconds)",
    "body": [
      { "timestamp": "0:00-0:05", "action": "string", "dialogue": "string" }
    ],
    "cta": "string",
    "total_duration": number
  },
  "caption": "string",
  "hashtags": ["string"],
  "variants": []
}

## BRAND VOICE
{brand_voice}

## CREATIVE BRIEF
{creative_brief}
`;
```

## 5.3 Producer Manager

### Purpose

Transform scripts and briefs into production-ready assets (video, image, audio).

### System Prompt

```typescript
const PRODUCER_MANAGER_PROMPT = `
You are the Producer Manager for Brand Infinity Engine.
Your role is to orchestrate the creation of visual and audio content.

## YOUR RESPONSIBILITIES
1. Coordinate video generation workflows
2. Manage image generation (DALL-E, Stable Diffusion)
3. Oversee audio synthesis (voice, music)
4. Assemble final deliverables
5. Ensure platform specifications are met

## AVAILABLE TOOLS
- generate_image(params): Create images via AI
- generate_video(params): Trigger video production workflow
- synthesize_voice(params): Generate voiceover
- select_music(params): Choose background music
- compose_final(assets): Assemble final video

## PRODUCTION GUIDELINES
1. Always verify platform specs before generation
2. Include brand assets (logo, colors) where appropriate
3. Ensure audio levels are balanced
4. Add captions for accessibility
5. Export in platform-optimal format

## SCRIPT
{script}

## BRAND ASSETS
{brand_assets}
`;
```

---

# SECTION 6: CLARIFYING QUESTIONS SYSTEM

## 6.1 Philosophy

> **"Ask only what you cannot infer, and infer everything you can."**

The clarifying questions system balances:

- **User experience**: Minimize friction, don't interrogate
- **Output quality**: Gather enough info for excellent results
- **Intelligence**: Use context to skip obvious questions

## 6.2 Question Priority Framework

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    QUESTION PRIORITY FRAMEWORK                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TIER 1: CRITICAL (Must ask if missing)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Content Type: Video or Image?                                    │   │
│  │  • Platform: Where will this be published?                          │   │
│  │  • Product/Subject: What are we featuring?                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TIER 2: IMPORTANT (Ask if not in KB and affects quality)                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Target Audience: Who is this for?                                │   │
│  │  • Key Message: What's the main takeaway?                           │   │
│  │  • Tone/Style: Energetic, professional, casual?                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TIER 3: NICE-TO-HAVE (Use defaults if not specified)                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Duration: Default to platform optimal                            │   │
│  │  • Call-to-Action: Default based on objective                       │   │
│  │  • Music preference: Default to trending/safe                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TIER 4: NEVER ASK (Always infer or use KB)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Brand colors: From Brand KB                                      │   │
│  │  • Logo: From Brand KB                                              │   │
│  │  • Brand voice: From Brand KB                                       │   │
│  │  • Platform specs: From system knowledge                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6.3 Question Generation Logic

```typescript
// lib/agents/clarify.ts

interface QuestionRequirement {
  field: string;
  tier: 1 | 2 | 3 | 4;
  checkKB: boolean;
  defaultValue?: any;
  questionTemplate: string;
  options?: string[];
}

const QUESTION_REQUIREMENTS: QuestionRequirement[] = [
  {
    field: "content_type",
    tier: 1,
    checkKB: false,
    questionTemplate: "Should this be a video or an image?",
    options: ["Video", "Image", "Both"],
  },
  {
    field: "platform",
    tier: 1,
    checkKB: false,
    questionTemplate: "Which platform are you targeting?",
    options: [
      "TikTok",
      "Instagram Reels",
      "YouTube Shorts",
      "Facebook",
      "Multiple",
    ],
  },
  {
    field: "product",
    tier: 1,
    checkKB: true,
    questionTemplate: "Which product should we feature?",
  },
  {
    field: "target_audience",
    tier: 2,
    checkKB: true,
    questionTemplate: "Who is your target audience for this content?",
  },
  {
    field: "key_message",
    tier: 2,
    checkKB: false,
    questionTemplate: "What's the main message or takeaway?",
  },
  {
    field: "tone",
    tier: 2,
    checkKB: true,
    questionTemplate: "What tone should we use?",
    options: [
      "Energetic",
      "Professional",
      "Casual",
      "Humorous",
      "Inspirational",
    ],
  },
  {
    field: "duration",
    tier: 3,
    checkKB: false,
    defaultValue: "platform_optimal",
    questionTemplate: "Any specific duration in mind?",
  },
];

export async function determineQuestionsNeeded(
  userMessage: string,
  conversationHistory: Message[],
  brandContext: BrandContext,
  loadedKBs: KnowledgeBase[]
): Promise<ClarifyingQuestion[]> {
  const questions: ClarifyingQuestion[] = [];
  const extractedInfo: ExtractedInfo[] = [];

  // Step 1: Extract information from user message
  const parsedInfo = await parseUserMessage(userMessage);
  extractedInfo.push(...parsedInfo);

  // Step 2: Extract from conversation history
  const historyInfo = extractFromHistory(conversationHistory);
  extractedInfo.push(...historyInfo);

  // Step 3: Check each requirement
  for (const req of QUESTION_REQUIREMENTS) {
    if (req.tier === 4) continue;

    const existing = extractedInfo.find((e) => e.field === req.field);
    if (existing && existing.confidence > 0.7) continue;

    if (req.checkKB) {
      const kbValue = findInKnowledgeBase(req.field, loadedKBs);
      if (kbValue) continue;
    }

    if (req.tier === 3 && req.defaultValue) continue;

    questions.push({
      id: generateId(),
      field: req.field,
      question: req.questionTemplate,
      type: req.options ? "choice" : "text",
      options: req.options,
      required: req.tier <= 2,
    });
  }

  return questions.slice(0, 4);
}
```

---

# SECTION 7: TASK DECOMPOSITION ENGINE

## 7.1 Concept

Complex requests are broken into subtasks that can be:

- Executed in parallel (when independent)
- Executed sequentially (when dependent)
- Delegated to specialized Manager Agents

## 7.2 Task Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TASK DEPENDENCY GRAPH                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Request: "Create a TikTok video about our protein powder"             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PHASE 1: PREPARATION (Parallel)                                    │   │
│  │                                                                      │   │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │   │
│  │  │ Load Brand  │     │ Get Platform│     │ Fetch       │           │   │
│  │  │ Context     │     │ Specs       │     │ Product KB  │           │   │
│  │  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘           │   │
│  │         └───────────────────┼───────────────────┘                   │   │
│  └─────────────────────────────┼───────────────────────────────────────┘   │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PHASE 2: STRATEGY (Strategist Manager)                             │   │
│  │  Create Creative Brief - Target audience, key messages              │   │
│  └───────────────────────────────┬─────────────────────────────────────┘   │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PHASE 3: COPYWRITING (Copywriter Manager)                          │   │
│  │  Generate Hooks → Write Full Script → Create Caption + CTA          │   │
│  └──────────────────────────────────────────────────────────────────┬──┘   │
│                                                                      ▼      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PHASE 4: PRODUCTION (Producer Manager)                             │   │
│  │  Generate Voiceover → Generate Scene Images → Trigger n8n Workflow  │   │
│  └──────────────────────────────────────────────────────────────────┬──┘   │
│                                                                      ▼      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PHASE 5: VERIFICATION (Quality Verifier)                           │   │
│  │  Check brand alignment, platform specs, quality scores              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7.3 Task Implementation

```typescript
// lib/agents/decompose.ts

interface Task {
  id: string;
  type: "preparation" | "strategy" | "copy" | "production" | "verification";
  name: string;
  manager: "executive" | "strategist" | "copywriter" | "producer" | "verifier";
  dependencies: string[];
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  status: "pending" | "running" | "completed" | "failed";
  parallel_group?: number;
}

export async function decomposeRequest(
  parsedIntent: ParsedIntent,
  brandContext: BrandContext
): Promise<TaskPlan> {
  const tasks: Task[] = [];

  // Phase 1: Preparation (parallel)
  tasks.push({
    id: "prep-1",
    type: "preparation",
    name: "Load Brand Context",
    manager: "executive",
    dependencies: [],
    inputs: {},
    status: "pending",
    parallel_group: 1,
  });

  tasks.push({
    id: "prep-2",
    type: "preparation",
    name: "Get Platform Specs",
    manager: "executive",
    dependencies: [],
    inputs: { platform: parsedIntent.platform },
    status: "pending",
    parallel_group: 1,
  });

  // Phase 2: Strategy
  tasks.push({
    id: "strategy-1",
    type: "strategy",
    name: "Create Creative Brief",
    manager: "strategist",
    dependencies: ["prep-1", "prep-2"],
    inputs: { intent: parsedIntent },
    status: "pending",
  });

  // Phase 3: Copywriting
  if (parsedIntent.content_type === "video") {
    tasks.push({
      id: "copy-1",
      type: "copy",
      name: "Generate Hooks",
      manager: "copywriter",
      dependencies: ["strategy-1"],
      inputs: { count: 3 },
      status: "pending",
    });

    tasks.push({
      id: "copy-2",
      type: "copy",
      name: "Write Script",
      manager: "copywriter",
      dependencies: ["copy-1"],
      inputs: {},
      status: "pending",
    });
  }

  // Phase 4: Production
  tasks.push({
    id: "prod-1",
    type: "production",
    name:
      parsedIntent.content_type === "video"
        ? "Generate Video"
        : "Generate Image",
    manager: "producer",
    dependencies:
      parsedIntent.content_type === "video" ? ["copy-2"] : ["strategy-1"],
    inputs: { content_type: parsedIntent.content_type },
    status: "pending",
  });

  // Phase 5: Verification
  tasks.push({
    id: "verify-1",
    type: "verification",
    name: "Quality Check",
    manager: "verifier",
    dependencies: ["prod-1"],
    inputs: {},
    status: "pending",
  });

  return {
    request_id: generateId(),
    tasks,
    estimated_duration_seconds: calculateEstimatedDuration(tasks),
    cost_estimate_usd: calculateCostEstimate(tasks),
  };
}
```

---

# SECTION 8: CONVERSATION MEMORY SYSTEM

## 8.1 Memory Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CONVERSATION MEMORY LAYERS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: SESSION MEMORY (Redis) - TTL: 30 minutes                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Current conversation state                                       │   │
│  │  • Pending questions                                                │   │
│  │  • Partial answers collected                                        │   │
│  │  • Active task plan                                                 │   │
│  │  • Selected knowledge bases                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAYER 2: CONVERSATION HISTORY (Database) - Persistent                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Full message history                                             │   │
│  │  • User preferences learned                                         │   │
│  │  • Generated content references                                     │   │
│  │  • Feedback given                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAYER 3: BRAND MEMORY (Knowledge Base) - Permanent                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Brand voice and guidelines                                       │   │
│  │  • Product information                                              │   │
│  │  • Historical campaign data                                         │   │
│  │  • Performance insights                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.2 Session State Management

```typescript
// lib/agents/memory/session.ts

interface ConversationSession {
  id: string;
  brand_id: string;
  user_id: string;

  // State
  state: "initial" | "gathering" | "confirming" | "processing" | "delivered";

  // Collected information
  parsed_intent: Partial<ParsedIntent>;
  answered_questions: Record<string, any>;
  pending_questions: ClarifyingQuestion[];

  // Context
  selected_kb_ids: string[];
  loaded_brand_context: BrandContext | null;

  // Task tracking
  active_task_plan: TaskPlan | null;

  // Timestamps
  created_at: Date;
  last_activity_at: Date;
}

export class SessionManager {
  private redis: Redis;
  private keyPrefix = "session:";
  private ttlSeconds = 1800; // 30 minutes

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    const key = this.keyPrefix + sessionId;
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as ConversationSession;
  }

  async createSession(params: {
    brandId: string;
    userId: string;
    kbIds?: string[];
  }): Promise<ConversationSession> {
    const session: ConversationSession = {
      id: generateSessionId(),
      brand_id: params.brandId,
      user_id: params.userId,
      state: "initial",
      parsed_intent: {},
      answered_questions: {},
      pending_questions: [],
      selected_kb_ids: params.kbIds || [],
      loaded_brand_context: null,
      active_task_plan: null,
      created_at: new Date(),
      last_activity_at: new Date(),
    };

    await this.saveSession(session);
    return session;
  }

  async updateSession(
    sessionId: string,
    updates: Partial<ConversationSession>
  ): Promise<ConversationSession> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const updated = {
      ...session,
      ...updates,
      last_activity_at: new Date(),
    };

    await this.saveSession(updated);
    return updated;
  }

  private async saveSession(session: ConversationSession): Promise<void> {
    const key = this.keyPrefix + session.id;
    await this.redis.setex(key, this.ttlSeconds, JSON.stringify(session));
  }
}
```

## 8.3 Conversation History Storage

```typescript
// Database schema for conversation history

interface ConversationMessage {
  id: string;
  session_id: string;
  brand_id: string;
  user_id: string;

  role: "user" | "assistant" | "system";
  content: string;

  // Metadata
  tokens_used?: number;
  model_used?: string;
  latency_ms?: number;

  // For assistant messages
  action_taken?: "asked_questions" | "delegated" | "responded";
  questions_asked?: ClarifyingQuestion[];
  delegation_plan?: DelegationPlan;

  created_at: Date;
}
```

## 8.4 Context Window Management

```typescript
// lib/agents/memory/context.ts

const MAX_CONTEXT_TOKENS = 8000; // Leave room for response

export function buildContextWindow(
  session: ConversationSession,
  recentMessages: ConversationMessage[],
  brandContext: BrandContext
): string {
  let context = "";
  let tokenCount = 0;

  // Priority 1: Brand context summary (always include)
  const brandSummary = summarizeBrandContext(brandContext);
  context += brandSummary;
  tokenCount += estimateTokens(brandSummary);

  // Priority 2: Current state and collected info
  const stateContext = formatSessionState(session);
  context += stateContext;
  tokenCount += estimateTokens(stateContext);

  // Priority 3: Recent messages (newest first, until limit)
  const sortedMessages = [...recentMessages].reverse();
  for (const msg of sortedMessages) {
    const msgTokens = estimateTokens(msg.content);
    if (tokenCount + msgTokens > MAX_CONTEXT_TOKENS) break;

    context = formatMessage(msg) + context;
    tokenCount += msgTokens;
  }

  return context;
}

function summarizeBrandContext(ctx: BrandContext): string {
  return `
## Brand Context
- Knowledge Bases Loaded: ${ctx.loaded_kbs.join(", ")}
- Brand Voice: ${ctx.brand_voice || "Not specified"}
- Primary Colors: ${ctx.primary_colors?.join(", ") || "Not specified"}
- Assets Available: ${ctx.matched_assets.length} relevant assets
`;
}
```

---

# SECTION 9: QUALITY VERIFICATION PIPELINE

## 9.1 Verification Philosophy

> **"Every piece of content must pass through quality gates before reaching the user."**

Quality verification happens at multiple stages:

1. **Pre-production**: Validate brief and script before asset generation
2. **Post-production**: Check final output against brand guidelines
3. **User delivery**: Summarize what was checked and any warnings

## 9.2 Quality Dimensions

| Dimension            | Description                 | Check Method               |
| :------------------- | :-------------------------- | :------------------------- |
| Brand Alignment      | Content matches brand voice | LLM comparison to brand KB |
| Platform Compliance  | Meets platform specs        | Rule-based validation      |
| Content Quality      | Grammar, clarity, impact    | LLM scoring                |
| Negative Constraints | Avoids forbidden content    | Keyword and LLM check      |
| Visual Quality       | Image/video meets standards | ML scoring or LLM vision   |

## 9.3 Quality Verifier Agent

```typescript
// lib/agents/verifier.ts

const QUALITY_VERIFIER_PROMPT = `
You are the Quality Verifier for Brand Infinity Engine.
Your role is to ensure all generated content meets brand and quality standards.

## YOUR RESPONSIBILITIES
1. Check content alignment with brand voice
2. Verify platform specification compliance
3. Score content quality (1-10)
4. Enforce negative constraints
5. Provide actionable improvement suggestions

## VERIFICATION CHECKLIST
For each piece of content, verify:

### Brand Alignment
- [ ] Tone matches brand voice guidelines
- [ ] Uses brand-approved language
- [ ] Reflects target audience preferences
- [ ] Includes required brand elements (logo, colors)

### Platform Compliance
- [ ] Duration within platform limits
- [ ] Aspect ratio correct
- [ ] File size acceptable
- [ ] Audio/caption requirements met

### Quality Standards
- [ ] Hook is attention-grabbing
- [ ] Message is clear and compelling
- [ ] CTA is actionable
- [ ] Production quality is professional

### Negative Constraints
- [ ] No forbidden words/phrases
- [ ] No competitor mentions
- [ ] No off-brand imagery
- [ ] No inappropriate content

## OUTPUT FORMAT
{
  "passed": boolean,
  "overall_score": 1-10,
  "checks": {
    "brand_alignment": { "passed": boolean, "score": 1-10, "issues": [] },
    "platform_compliance": { "passed": boolean, "issues": [] },
    "content_quality": { "passed": boolean, "score": 1-10, "issues": [] },
    "negative_constraints": { "passed": boolean, "violations": [] }
  },
  "recommendations": [],
  "can_auto_approve": boolean,
  "human_review_required": boolean
}
`;

interface VerificationResult {
  passed: boolean;
  overall_score: number;
  checks: {
    brand_alignment: CheckResult;
    platform_compliance: CheckResult;
    content_quality: CheckResult;
    negative_constraints: CheckResult;
  };
  recommendations: string[];
  can_auto_approve: boolean;
  human_review_required: boolean;
}

export async function verifyContent(
  content: GeneratedContent,
  brandContext: BrandContext,
  platformSpecs: PlatformSpecs
): Promise<VerificationResult> {
  // Step 1: Rule-based platform compliance check
  const platformCheck = checkPlatformCompliance(content, platformSpecs);

  // Step 2: LLM-based quality checks
  const llmChecks = await runLLMVerification(content, brandContext);

  // Step 3: Negative constraint check
  const constraintCheck = await checkNegativeConstraints(content, brandContext);

  // Step 4: Calculate overall score
  const scores = [
    llmChecks.brand_alignment.score,
    platformCheck.passed ? 10 : 5,
    llmChecks.content_quality.score,
    constraintCheck.passed ? 10 : 0,
  ];
  const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Step 5: Determine approval path
  const passed =
    overallScore >= 7 && platformCheck.passed && constraintCheck.passed;
  const canAutoApprove = passed && overallScore >= 8.5;
  const humanReviewRequired =
    constraintCheck.violations.length > 0 || overallScore < 6;

  return {
    passed,
    overall_score: overallScore,
    checks: {
      brand_alignment: llmChecks.brand_alignment,
      platform_compliance: platformCheck,
      content_quality: llmChecks.content_quality,
      negative_constraints: constraintCheck,
    },
    recommendations: generateRecommendations(llmChecks, platformCheck),
    can_auto_approve: canAutoApprove,
    human_review_required: humanReviewRequired,
  };
}
```

---

# SECTION 10: DATABASE SCHEMA DESIGN

## 10.1 New Tables

### Conversation Sessions

```sql
-- Migration: 030_create_conversation_sessions.sql

CREATE TABLE IF NOT EXISTS conversation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- State
    state VARCHAR(20) NOT NULL DEFAULT 'initial',

    -- Collected data
    parsed_intent JSONB DEFAULT '{}',
    answered_questions JSONB DEFAULT '{}',
    pending_questions JSONB DEFAULT '[]',

    -- Context
    selected_kb_ids UUID[] DEFAULT '{}',

    -- Task tracking
    active_task_plan_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT check_session_state CHECK (
        state IN ('initial', 'gathering', 'confirming', 'processing', 'delivered', 'cancelled')
    )
);

CREATE INDEX idx_sessions_brand ON conversation_sessions(brand_id);
CREATE INDEX idx_sessions_user ON conversation_sessions(user_id);
CREATE INDEX idx_sessions_state ON conversation_sessions(state) WHERE state != 'delivered';
```

### Conversation Messages

```sql
-- Migration: 031_create_conversation_messages.sql

CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL,
    user_id UUID NOT NULL,

    -- Message content
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,

    -- Metadata
    tokens_used INTEGER,
    model_used VARCHAR(50),
    latency_ms INTEGER,

    -- Action details (for assistant messages)
    action_taken VARCHAR(30),
    questions_asked JSONB,
    delegation_plan JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_message_role CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE INDEX idx_messages_session ON conversation_messages(session_id);
CREATE INDEX idx_messages_created ON conversation_messages(created_at DESC);
```

### Task Plans

```sql
-- Migration: 032_create_task_plans.sql

CREATE TABLE IF NOT EXISTS task_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL,

    -- Plan details
    tasks JSONB NOT NULL,
    estimated_duration_seconds INTEGER,
    estimated_cost_usd NUMERIC(10, 4),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Results
    outputs JSONB,
    errors JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_plan_status CHECK (
        status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
    )
);
```

### Quality Verifications

```sql
-- Migration: 033_create_quality_verifications.sql

CREATE TABLE IF NOT EXISTS quality_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_plan_id UUID NOT NULL REFERENCES task_plans(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL,
    content_id UUID,

    -- Results
    passed BOOLEAN NOT NULL,
    overall_score NUMERIC(3, 1),
    checks JSONB NOT NULL,
    recommendations JSONB,

    -- Approval path
    can_auto_approve BOOLEAN DEFAULT FALSE,
    human_review_required BOOLEAN DEFAULT TRUE,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_decision VARCHAR(20),
    review_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# SECTION 11: API SPECIFICATIONS

## 11.1 Conversation API

### POST /api/v1/conversation/start

Start a new conversation session.

```typescript
// Request
{
  "brand_id": "uuid",
  "initial_message": "Create a TikTok video...",
  "selected_kb_ids": ["uuid", "uuid"]  // Optional
}

// Response
{
  "success": true,
  "session_id": "uuid",
  "response": {
    "type": "questions",  // or "delegation" or "message"
    "content": "Great! A few quick questions...",
    "questions": [
      {
        "id": "q1",
        "question": "Which platform are you targeting?",
        "type": "choice",
        "options": ["TikTok", "Instagram Reels", "YouTube Shorts"]
      }
    ]
  },
  "state": "gathering"
}
```

### POST /api/v1/conversation/:sessionId/message

Continue an existing conversation.

```typescript
// Request
{
  "message": "TikTok, focus on protein content"
}

// Response
{
  "success": true,
  "response": {
    "type": "delegation",
    "content": "Perfect! I have everything I need. Here's my plan...",
    "plan_preview": {
      "tasks": ["Create Brief", "Write Script", "Generate Video"],
      "estimated_time": "5-8 minutes",
      "estimated_cost": "$0.50"
    }
  },
  "state": "confirming"
}
```

### POST /api/v1/conversation/:sessionId/confirm

Confirm and execute the task plan.

```typescript
// Request
{
  "confirmed": true
}

// Response
{
  "success": true,
  "task_plan_id": "uuid",
  "status": "processing",
  "polling_url": "/api/v1/tasks/uuid/status"
}
```

## 11.2 Task Status API

### GET /api/v1/tasks/:taskPlanId/status

Poll for task completion.

```typescript
// Response (in progress)
{
  "status": "running",
  "progress": {
    "completed_tasks": 3,
    "total_tasks": 5,
    "current_task": "Generating video",
    "estimated_remaining_seconds": 120
  }
}

// Response (completed)
{
  "status": "completed",
  "outputs": {
    "video_url": "https://...",
    "script": "...",
    "caption": "..."
  },
  "verification": {
    "passed": true,
    "score": 8.5,
    "can_auto_approve": true
  }
}
```

---

# SECTION 12: N8N WORKFLOW INTEGRATION

## 12.1 Agent-n8n Boundary

The agent architecture interfaces with n8n at the **production phase**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AGENT-N8N INTEGRATION BOUNDARY                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FRONTEND + BACKEND AGENTS                      N8N WORKFLOWS               │
│  (Synchronous, Fast)                            (Asynchronous, Heavy)       │
│                                                                             │
│  ┌─────────────────────────┐                   ┌─────────────────────────┐ │
│  │ Executive Agent         │                   │ Production Dispatcher   │ │
│  │ Strategist Manager      │                   │ Video Assembly          │ │
│  │ Copywriter Manager      │ ═══════════════>  │ Production Poller       │ │
│  │ (Clarifying Questions)  │   Handoff via    │ Broadcaster             │ │
│  │ (Task Planning)         │   n8n Webhook    │                         │ │
│  └─────────────────────────┘                   └─────────────────────────┘ │
│                                                                             │
│  Latency: < 2 seconds                          Latency: 30s - 5 minutes    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 12.2 Enhanced Webhook Payload

When the Producer Manager triggers n8n:

```typescript
// lib/agents/producer.ts

async function triggerN8nProduction(
  params: ProductionParams
): Promise<ProductionJob> {
  const payload = {
    // Core identifiers
    task_plan_id: params.taskPlanId,
    campaign_id: params.campaignId,
    brand_id: params.brandId,

    // Rich context from agents
    creative_brief: params.brief,
    script: params.script,

    // Brand context from multi-KB system
    brand_context: {
      voice: params.brandContext.brand_voice,
      colors: params.brandContext.primary_colors,
      logo_url: params.brandContext.logo_url,
      product_images: params.brandContext.product_images,
    },

    // Platform specs
    platform: params.platform,
    platform_specs: params.platformSpecs,

    // Verification requirements
    verification_rules: {
      min_quality_score: 7,
      required_checks: ["brand_alignment", "platform_compliance"],
      auto_approve_threshold: 8.5,
    },

    // Callback
    callback_url: `${process.env.APP_URL}/api/v1/tasks/${params.taskPlanId}/callback`,
  };

  await n8nClient.triggerWorkflow("/production/dispatch", payload);
}
```

## 12.3 Callback Handler

n8n calls back when production is complete:

```typescript
// app/api/v1/tasks/[taskPlanId]/callback/route.ts

export async function POST(
  request: NextRequest,
  { params }: { params: { taskPlanId: string } }
) {
  const body = await request.json();

  // Update task plan with results
  await updateTaskPlan(params.taskPlanId, {
    status: body.success ? "completed" : "failed",
    outputs: body.outputs,
    errors: body.errors,
    completed_at: new Date(),
  });

  // Run quality verification
  if (body.success) {
    const verification = await verifyContent(
      body.outputs,
      await getBrandContext(body.brand_id),
      body.platform_specs
    );

    await createQualityVerification({
      task_plan_id: params.taskPlanId,
      ...verification,
    });

    // Update conversation session
    await updateSession(body.session_id, {
      state: verification.passed ? "delivered" : "verifying",
    });
  }

  return NextResponse.json({ success: true });
}
```

---

# SECTION 13: FRONTEND IMPLEMENTATION

## 13.1 Chat Interface Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Creative Director                                        [⚙️ Settings]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CONVERSATION AREA                               │   │
│  │                                                                     │   │
│  │  ┌───────────────────────────────────────────────────────┐         │   │
│  │  │ 🧑 You                                                │         │   │
│  │  │ "Create a TikTok video about our protein powder"      │         │   │
│  │  └───────────────────────────────────────────────────────┘         │   │
│  │                                                                     │   │
│  │  ┌───────────────────────────────────────────────────────┐         │   │
│  │  │ 🤖 Creative Director                                  │         │   │
│  │  │ "Great! A few quick questions to ensure I create      │         │   │
│  │  │  exactly what you need:                               │         │   │
│  │  │                                                        │         │   │
│  │  │  1. Which product variant?                            │         │   │
│  │  │     [Original] [Chocolate] [Vanilla]                  │         │   │
│  │  │                                                        │         │   │
│  │  │  2. What's the key message?                           │         │   │
│  │  │     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░           │         │   │
│  │  │                                                        │         │   │
│  │  │  I've loaded your brand context:                      │         │   │
│  │  │  • Core Brand Identity (12 assets)                    │         │   │
│  │  │  • Product Catalog (45 assets)                        │         │   │
│  │  └───────────────────────────────────────────────────────┘         │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Knowledge Bases:                                                           │
│  [🛡️ Core Identity] [📦 Products] [+ Add KB]                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Your message...                                             [Send] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 13.2 Component Architecture

```typescript
// components/director/DirectorChat.tsx

interface DirectorChatProps {
  brandId: string;
  initialKBs?: string[];
}

export function DirectorChat({ brandId, initialKBs }: DirectorChatProps) {
  const [session, setSession] = useState<ConversationSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKBs, setSelectedKBs] = useState<string[]>(initialKBs || []);

  // Start or continue session
  const sendMessage = async (content: string) => {
    setIsLoading(true);

    try {
      if (!session) {
        // Start new session
        const response = await startConversation({
          brand_id: brandId,
          initial_message: content,
          selected_kb_ids: selectedKBs
        });
        setSession(response.session);
        setMessages([...messages,
          { role: 'user', content },
          { role: 'assistant', ...response.response }
        ]);
      } else {
        // Continue session
        const response = await continueConversation(session.id, content);
        setMessages([...messages,
          { role: 'user', content },
          { role: 'assistant', ...response.response }
        ]);

        if (response.state === 'processing') {
          // Start polling for task completion
          startPolling(response.task_plan_id);
        }
      }
    } finally {
      setIsLoading(false);
      setInputValue('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {isLoading && <LoadingIndicator />}
      </div>

      {/* KB selector */}
      <div className="border-t p-2">
        <KBSelector
          brandId={brandId}
          selectedIds={selectedKBs}
          onChange={setSelectedKBs}
          disabled={!!session}
        />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={sendMessage}
          disabled={isLoading}
          placeholder={session ? "Your message..." : "Describe what you want to create..."}
        />
      </div>
    </div>
  );
}
```

## 13.3 Message Components

```typescript
// components/director/MessageBubble.tsx

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      "flex gap-3 max-w-[80%]",
      isUser ? "ml-auto" : "mr-auto"
    )}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
          <Sparkles size={16} className="text-indigo-600" />
        </div>
      )}

      <div className={cn(
        "rounded-2xl px-4 py-3",
        isUser
          ? "bg-indigo-600 text-white"
          : "bg-slate-100 text-slate-800"
      )}>
        {message.content}

        {/* Render questions if present */}
        {message.questions && (
          <QuestionsForm questions={message.questions} />
        )}

        {/* Render plan preview if present */}
        {message.plan_preview && (
          <PlanPreview plan={message.plan_preview} />
        )}
      </div>
    </div>
  );
}
```

---

# SECTION 14: LLM COST OPTIMIZATION

## 14.1 Cost Model

| Agent      | Model       | Input Cost | Output Cost | Est. Calls/Request | Est. Cost/Request |
| :--------- | :---------- | :--------- | :---------- | :----------------- | :---------------- |
| Executive  | GPT-4o      | $5/1M      | $15/1M      | 2-4                | $0.02-$0.06       |
| Strategist | GPT-4o-mini | $0.15/1M   | $0.60/1M    | 1                  | $0.002            |
| Copywriter | GPT-4o-mini | $0.15/1M   | $0.60/1M    | 2-3                | $0.004-$0.006     |
| Producer   | GPT-4o-mini | $0.15/1M   | $0.60/1M    | 1                  | $0.002            |
| Verifier   | GPT-4o-mini | $0.15/1M   | $0.60/1M    | 1-2                | $0.002-$0.004     |
| **TOTAL**  |             |            |             | **7-11**           | **$0.03-$0.08**   |

**Comparison to current single-call approach:** ~$0.01-$0.02

**Value prop:** 3-4x cost for 10x better quality through specialization

## 14.2 Cost Optimization Strategies

### 1. Model Selection Per Task

```typescript
// lib/agents/config.ts

const MODEL_CONFIG = {
  executive: {
    model: "gpt-4o", // High intelligence for orchestration
    maxTokens: 4000,
    temperature: 0.7,
  },
  strategist: {
    model: "gpt-4o-mini", // Structured output, less creativity
    maxTokens: 3000,
    temperature: 0.5,
  },
  copywriter: {
    model: "gpt-4o-mini", // Could upgrade to gpt-4o for premium
    maxTokens: 4000,
    temperature: 0.8, // Higher creativity for copy
  },
  producer: {
    model: "gpt-4o-mini", // Mostly coordination, low creativity
    maxTokens: 2000,
    temperature: 0.3,
  },
  verifier: {
    model: "gpt-4o-mini", // Structured checks
    maxTokens: 2000,
    temperature: 0.2, // Low temperature for consistent verdicts
  },
};
```

### 2. Prompt Caching

```typescript
// lib/agents/cache.ts

const PROMPT_CACHE_CONFIG = {
  // System prompts are static - cache aggressively
  systemPromptTTL: 3600, // 1 hour

  // Brand context changes rarely
  brandContextTTL: 300, // 5 minutes

  // Platform specs are static
  platformSpecsTTL: 86400, // 24 hours
};

export async function getCachedSystemPrompt(
  agentType: AgentType
): Promise<string> {
  const cacheKey = `prompt:${agentType}`;

  let prompt = await redis.get(cacheKey);
  if (!prompt) {
    prompt = buildSystemPrompt(agentType);
    await redis.setex(cacheKey, PROMPT_CACHE_CONFIG.systemPromptTTL, prompt);
  }

  return prompt;
}
```

### 3. Response Streaming

```typescript
// lib/agents/stream.ts

export async function* streamAgentResponse(
  agent: Agent,
  input: string
): AsyncGenerator<string> {
  const stream = await openai.chat.completions.create({
    model: agent.config.model,
    messages: agent.buildMessages(input),
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
```

### 4. Batching Where Possible

```typescript
// Example: Generate multiple hook variants in one call
const hookPrompt = `
Generate 3 hook variants for this TikTok video.
Format as JSON array.

Brief: ${brief}
Target: ${audience}
`;

// One call for 3 hooks instead of 3 calls for 1 hook each
const hooks = await copywriterManager.generate(hookPrompt);
```

### 5. Multi-Provider LLM Selection System

Allow users to choose between multiple providers to optimize for cost, quality, and availability.

```typescript
// Example: User can switch providers mid-conversation
const selectedProvider = user.preferences.llm_provider || "openai";
const response = await executiveAgent.chat(input, {
  provider: selectedProvider,
});
```

---

## 14.3 Multi-Provider LLM Selection System

### Philosophy

> **"One brain, multiple voices. Let users choose the intelligence that fits their budget, quality bar, and regional availability."**

The Creative Director agents are **provider-agnostic**. The same agent architecture works with any LLM provider, giving users control over:

- **Cost**: DeepSeek is 20x cheaper than GPT-4o for similar quality
- **Quality**: Claude 3.5 Sonnet excels at creative writing
- **Availability**: Regional restrictions or provider outages
- **Features**: Different models support different capabilities

### Supported Providers

| Provider       | Primary Model     | Cost/1M Tokens        | Strengths                        | Use Case                      |
| :------------- | :---------------- | :-------------------- | :------------------------------- | :---------------------------- |
| **OpenAI**     | GPT-4o            | $5 in / $15 out       | Balanced, reliable               | Default / General purpose     |
| **Anthropic**  | Claude 3.5 Sonnet | $3 in / $15 out       | Creative writing, long context   | Premium creative content      |
| **DeepSeek**   | DeepSeek V3       | $0.27 in / $1.10 out  | Ultra-cheap, competitive quality | High-volume / Budget mode     |
| **Gemini**     | Gemini 2.0 Flash  | $0.075 in / $0.30 out | Fast, multimodal, cheap          | Rapid iteration / Prototyping |
| **Kimi**       | Kimi K2           | $0.20 in / $0.60 out  | Long context (128k+)             | Document-heavy campaigns      |
| **OpenRouter** | _User's choice_   | Varies                | Access to 100+ models            | Power users / Experimentation |

### UI/UX Design

#### Provider Selector Component

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Creative Director                                        [⚙️ Settings]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🧠 AI Provider:                                                    │   │
│  │                                                                      │   │
│  │  ○ OpenAI GPT-4o          [Default]        💰 $$$$  ⚡ Fast         │   │
│  │  ● Anthropic Claude 3.5   [Creative]       💰 $$$$  ⚡ Fast         │   │
│  │  ○ DeepSeek V3            [Budget]         💰 $     ⚡ Medium       │   │
│  │  ○ Gemini 2.0 Flash       [Speed]          💰 $     ⚡ Ultra Fast   │   │
│  │  ○ Kimi K2                [Long Context]   💰 $$    ⚡ Fast         │   │
│  │  ○ OpenRouter             [Advanced]       💰 Varies ⚡ Varies      │   │
│  │                                                                      │   │
│  │  ℹ️ Est. cost per request: $0.02-0.04 (based on avg. conversation) │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Knowledge Bases:                                                           │
│  [🛡️ Core Identity] [📦 Products] [+ Add KB]                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Your message...                                             [Send] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Compact Version (In-Prompt Builder)

```
┌──────────────────────────────────────────────────────────────┐
│  Create content...                                           │
│                                                              │
│  🧠 [Anthropic ▼]  📚 [Core KB ▼] [+ KB]         [Generate] │
└──────────────────────────────────────────────────────────────┘
```

### Frontend Implementation

#### Provider Selection Component

```typescript
// components/director/ProviderSelector.tsx

interface ProviderConfig {
  id: string;
  name: string;
  model: string;
  costTier: '$' | '$$' | '$$$' | '$$$$';
  speedTier: 'Ultra Fast' | 'Fast' | 'Medium';
  icon: string;
  description: string;
  features: string[];
  requiresApiKey: boolean;
}

const SUPPORTED_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI GPT-4o',
    model: 'gpt-4o',
    costTier: '$$$$',
    speedTier: 'Fast',
    icon: '⚡',
    description: 'Balanced performance and reliability',
    features: ['General purpose', 'Structured outputs', 'Function calling'],
    requiresApiKey: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude 3.5',
    model: 'claude-3-5-sonnet-20241022',
    costTier: '$$$$',
    speedTier: 'Fast',
    icon: '🎨',
    description: 'Best for creative writing and storytelling',
    features: ['200k context', 'Creative excellence', 'Long documents'],
    requiresApiKey: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek V3',
    model: 'deepseek-chat',
    costTier: '$',
    speedTier: 'Medium',
    icon: '💰',
    description: 'Ultra-low cost with competitive quality',
    features: ['20x cheaper', 'Good reasoning', 'Code generation'],
    requiresApiKey: true,
  },
  {
    id: 'gemini',
    name: 'Gemini 2.0 Flash',
    model: 'gemini-2.0-flash-exp',
    costTier: '$',
    speedTier: 'Ultra Fast',
    icon: '⚡',
    description: 'Fastest responses, multimodal support',
    features: ['Multimodal', 'Ultra fast', 'Low latency'],
    requiresApiKey: true,
  },
  {
    id: 'kimi',
    name: 'Kimi K2',
    model: 'kimi-k2',
    costTier: '$$',
    speedTier: 'Fast',
    icon: '📚',
    description: 'Massive 200k+ context for document-heavy work',
    features: ['200k+ context', 'Document analysis', 'Long memory'],
    requiresApiKey: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    model: 'auto', // User selects in settings
    costTier: '$$', // Varies
    speedTier: 'Fast', // Varies
    icon: '🔀',
    description: 'Access to 100+ models from one API',
    features: ['100+ models', 'Provider fallback', 'Cost optimization'],
    requiresApiKey: true,
  },
];

export function ProviderSelector({
  selectedProvider,
  onProviderChange,
  compact = false,
}: {
  selectedProvider: string;
  onProviderChange: (provider: string) => void;
  compact?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  if (compact) {
    return (
      <Select value={selectedProvider} onValueChange={onProviderChange}>
        <SelectTrigger className="w-[180px]">
          <div className="flex items-center gap-2">
            <span>{SUPPORTED_PROVIDERS.find(p => p.id === selectedProvider)?.icon}</span>
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_PROVIDERS.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              <div className="flex items-center gap-2">
                <span>{provider.icon}</span>
                <span>{provider.name}</span>
                <Badge variant="outline" className="ml-auto">
                  {provider.costTier}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧠 AI Provider
          <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? 'Hide Details' : 'Compare'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup value={selectedProvider} onValueChange={onProviderChange}>
          {SUPPORTED_PROVIDERS.map((provider) => (
            <div key={provider.id} className="flex items-center space-x-2 mb-3">
              <RadioGroupItem value={provider.id} id={provider.id} />
              <Label htmlFor={provider.id} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{provider.name}</div>
                    <div className="text-sm text-slate-500">{provider.description}</div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{provider.costTier}</Badge>
                    <Badge variant="secondary">{provider.speedTier}</Badge>
                  </div>
                </div>
                {showDetails && (
                  <div className="mt-2 ml-11 text-xs text-slate-600">
                    {provider.features.map((feature) => (
                      <Badge key={feature} variant="outline" className="mr-1 mb-1">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
          ℹ️ Estimated cost: <strong>$0.02-$0.08</strong> per creative request (varies by provider and complexity)
        </div>
      </CardContent>
    </Card>
  );
}
```

### Backend Implementation

#### Unified LLM Service

```typescript
// lib/llm/unified-service.ts

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  createOpenRouter,
  createDeepSeek,
  createGemini,
  createKimi,
} from "./providers";

export type LLMProvider =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "gemini"
  | "kimi"
  | "openrouter";

interface LLMRequest {
  provider: LLMProvider;
  model?: string; // Override default model
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
  stream?: boolean;
}

interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number; // in USD
  };
  provider: LLMProvider;
  model: string;
}

// Provider configuration with credentials
async function getProviderClient(provider: LLMProvider) {
  const credentials = await getProviderCredentials(provider);

  switch (provider) {
    case "openai":
      return new OpenAI({ apiKey: credentials.apiKey });

    case "anthropic":
      return new Anthropic({ apiKey: credentials.apiKey });

    case "deepseek":
      return createDeepSeek(credentials.apiKey);

    case "gemini":
      return createGemini(credentials.apiKey);

    case "kimi":
      return createKimi(credentials.apiKey);

    case "openrouter":
      return createOpenRouter(credentials.apiKey, credentials.selectedModel);

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Unified completion function
export async function generateCompletion(
  request: LLMRequest
): Promise<LLMResponse> {
  const client = await getProviderClient(request.provider);

  // Normalize request format across providers
  const normalizedRequest = normalizeRequest(request);

  let response;
  let usage;

  switch (request.provider) {
    case "openai":
    case "openrouter":
    case "deepseek":
      // These use OpenAI-compatible API
      response = await client.chat.completions.create({
        model: request.model || getDefaultModel(request.provider),
        messages: normalizedRequest.messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        response_format:
          request.responseFormat === "json"
            ? { type: "json_object" }
            : undefined,
      });
      usage = {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalCost: calculateCost(request.provider, response.usage),
      };
      return {
        content: response.choices[0].message.content,
        usage,
        provider: request.provider,
        model: response.model,
      };

    case "anthropic":
      response = await client.messages.create({
        model: request.model || "claude-3-5-sonnet-20241022",
        max_tokens: request.maxTokens || 4000,
        messages: normalizedRequest.messages,
        temperature: request.temperature,
      });
      usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalCost: calculateCost("anthropic", response.usage),
      };
      return {
        content: response.content[0].text,
        usage,
        provider: "anthropic",
        model: response.model,
      };

    case "gemini":
      response = await client.generateContent({
        model: request.model || "gemini-2.0-flash-exp",
        messages: normalizedRequest.messages,
        maxOutputTokens: request.maxTokens,
        temperature: request.temperature,
      });
      // Gemini cost calculation
      usage = {
        inputTokens: response.usageMetadata.promptTokenCount,
        outputTokens: response.usageMetadata.candidatesTokenCount,
        totalCost: calculateCost("gemini", response.usageMetadata),
      };
      return {
        content: response.candidates[0].content.parts[0].text,
        usage,
        provider: "gemini",
        model: request.model || "gemini-2.0-flash-exp",
      };

    case "kimi":
      response = await client.chat.completions.create({
        model: request.model || "kimi-k2",
        messages: normalizedRequest.messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
      });
      usage = {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalCost: calculateCost("kimi", response.usage),
      };
      return {
        content: response.choices[0].message.content,
        usage,
        provider: "kimi",
        model: response.model,
      };
  }
}

// Calculate cost based on provider pricing
function calculateCost(
  provider: LLMProvider,
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  }
): number {
  const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
  const outputTokens = usage.output_tokens || usage.completion_tokens || 0;

  // Pricing per 1M tokens (in USD)
  const PRICING = {
    openai: { input: 5.0, output: 15.0 },
    anthropic: { input: 3.0, output: 15.0 },
    deepseek: { input: 0.27, output: 1.1 },
    gemini: { input: 0.075, output: 0.3 },
    kimi: { input: 0.2, output: 0.6 },
    openrouter: { input: 5.0, output: 15.0 }, // Varies by selected model
  };

  const rates = PRICING[provider];
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

// Get default model for provider
function getDefaultModel(provider: LLMProvider): string {
  const DEFAULTS = {
    openai: "gpt-4o",
    anthropic: "claude-3-5-sonnet-20241022",
    deepseek: "deepseek-chat",
    gemini: "gemini-2.0-flash-exp",
    kimi: "kimi-k2",
    openrouter: "openai/gpt-4o", // Default OpenRouter model
  };
  return DEFAULTS[provider];
}
```

#### API Credential Management

```typescript
// lib/llm/credentials.ts

interface ProviderCredentials {
  apiKey: string;
  selectedModel?: string; // For OpenRouter
  endpoint?: string; // For self-hosted
}

// Store user's API keys securely
export async function saveProviderCredentials(
  userId: string,
  provider: LLMProvider,
  credentials: ProviderCredentials
) {
  // Encrypt API key before storage
  const encrypted = await encrypt(credentials.apiKey);

  await supabase.from("user_llm_providers").upsert({
    user_id: userId,
    provider: provider,
    encrypted_api_key: encrypted,
    selected_model: credentials.selectedModel,
    endpoint: credentials.endpoint,
    updated_at: new Date().toISOString(),
  });
}

export async function getProviderCredentials(
  userId: string,
  provider: LLMProvider
): Promise<ProviderCredentials> {
  const { data, error } = await supabase
    .from("user_llm_providers")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (error || !data) {
    throw new Error(`No API key configured for provider: ${provider}`);
  }

  return {
    apiKey: await decrypt(data.encrypted_api_key),
    selectedModel: data.selected_model,
    endpoint: data.endpoint,
  };
}
```

### Database Schema

```sql
-- Migration: Add user LLM provider configuration table

CREATE TABLE IF NOT EXISTS user_llm_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    encrypted_api_key TEXT NOT NULL, -- Encrypted with server-side key
    selected_model TEXT, -- For OpenRouter or custom configs
    endpoint TEXT, -- For self-hosted models
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_provider UNIQUE(user_id, provider)
);

-- RLS policies
ALTER TABLE user_llm_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own provider configs"
ON user_llm_providers FOR ALL
USING (auth.uid() = user_id);

-- User preferences for default provider
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_llm_provider TEXT DEFAULT 'openai';
ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_preferences JSONB DEFAULT '{}';
```

### API Route Updates

```typescript
// app/api/v1/director/route.ts

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAuthContext();
  const body = await req.json();

  // Get user's selected provider (or default)
  const selectedProvider =
    body.provider || user.default_llm_provider || "openai";

  // Validate provider is configured
  const hasCredentials = await checkProviderConfigured(
    user.id,
    selectedProvider
  );
  if (!hasCredentials) {
    return NextResponse.json(
      {
        success: false,
        error: `Please configure your ${selectedProvider} API key in Settings → AI Providers`,
      },
      { status: 400 }
    );
  }

  // Execute agent with selected provider
  const response = await executiveAgent.process({
    ...body,
    provider: selectedProvider,
    userId: user.id,
  });

  // Log cost per provider
  await logProviderUsage({
    userId: user.id,
    provider: selectedProvider,
    cost: response.totalCost,
    tokens: response.totalTokens,
  });

  return NextResponse.json({ success: true, data: response });
}
```

### Settings Page UI

```typescript
// app/(dashboard)/settings/ai-providers/page.tsx

export default function AIProviderSettings() {
  const [providers, setProviders] = useState<ProviderCredentials[]>([]);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI Provider Configuration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Configured Providers</CardTitle>
          <CardDescription>
            Add API keys for the AI providers you want to use.
            Keys are encrypted and stored securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {SUPPORTED_PROVIDERS.map((provider) => (
              <ConfiguredProviderRow
                key={provider.id}
                provider={provider}
                configured={providers.some(p => p.provider === provider.id)}
                onEdit={() => setEditingProvider(provider.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Choose default provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.provider} value={p.provider}>
                  {p.provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* API Key Configuration Dialog */}
      {editingProvider && (
        <APIKeyDialog
          provider={editingProvider}
          onSave={handleSaveCredentials}
          onClose={() => setEditingProvider(null)}
        />
      )}
    </div>
  );
}
```

### Cost Comparison Dashboard

```typescript
// components/analytics/ProviderCostComparison.tsx

export function ProviderCostComparison() {
  const { data } = useProviderUsageStats();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider Cost Analysis (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Total Tokens</TableHead>
              <TableHead>Total Cost</TableHead>
              <TableHead>Avg Cost/Request</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((provider) => (
              <TableRow key={provider.name}>
                <TableCell>{provider.name}</TableCell>
                <TableCell>{provider.requests}</TableCell>
                <TableCell>{provider.tokens.toLocaleString()}</TableCell>
                <TableCell>${provider.totalCost.toFixed(4)}</TableCell>
                <TableCell>${provider.avgCostPerRequest.toFixed(4)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 p-4 bg-green-50 rounded-lg">
          <div className="font-medium text-green-900">💡 Cost Optimization Tip</div>
          <div className="text-sm text-green-700 mt-1">
            Switching to DeepSeek for routine tasks could save you{' '}
            <strong>${calculatePotentialSavings(data)}</strong> per month
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Implementation Checklist

- [ ] **Backend**: Create unified LLM service with provider abstraction
- [ ] **Database**: Add `user_llm_providers` table for credential storage
- [ ] **Frontend**: Build `ProviderSelector` component
- [ ] **Settings**: Create AI Provider configuration page
- [ ] **API**: Update Director API to accept `provider` parameter
- [ ] **Encryption**: Implement secure API key storage
- [ ] **Analytics**: Track usage and cost per provider
- [ ] **Documentation**: User guide for configuring providers
- [ ] **Testing**: Verify all 6 providers work correctly
- [ ] **Fallback**: Implement automatic fallback if primary provider fails

### Quality Gates

1. **Security**: API keys encrypted at rest, never logged
2. **UX**: Provider selection takes <2 clicks, defaults work immediately
3. **Cost Transparency**: Users see estimated cost before generating
4. **Error Handling**: Clear messages if provider is down or unconfigured
5. **Analytics**: Users can compare provider costs over time

---

# SECTION 15: ERROR HANDLING AND RECOVERY

## 15.1 Error Categories

| Category    | Examples                      | Recovery Strategy               |
| :---------- | :---------------------------- | :------------------------------ |
| Transient   | Rate limits, timeouts         | Retry with exponential backoff  |
| LLM Failure | Invalid response, refusal     | Retry with modified prompt      |
| Validation  | Invalid user input            | Ask for clarification           |
| Fatal       | API key invalid, service down | Fail with user-friendly message |
| Partial     | One task fails in plan        | Complete others, report partial |

## 15.2 Retry Configuration

```typescript
// lib/agents/retry.ts

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

const AGENT_RETRY_CONFIG: Record<AgentType, RetryConfig> = {
  executive: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    retryableErrors: ["rate_limit", "timeout", "server_error"],
  },
  // ... other agents
};

export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (!isRetryable(error, config.retryableErrors)) {
        throw error;
      }

      if (attempt < config.maxAttempts) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt - 1),
          config.maxDelayMs
        );
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}
```

## 15.3 Graceful Degradation

```typescript
// lib/agents/fallback.ts

export async function executeWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    console.warn(`Primary failed for ${context}, using fallback:`, error);

    // Log for monitoring
    await logFallbackUsage(context, error);

    return await fallback();
  }
}

// Example usage
const brief = await executeWithFallback(
  () => strategistManager.createBrief(intent),
  () => createSimpleBrief(intent), // Rule-based fallback
  "creative-brief-generation"
);
```

## 15.4 Task Plan Recovery

```typescript
// lib/agents/executor.ts

export class TaskExecutor {
  async executeWithRecovery(): Promise<ExecutionResult> {
    const failedTasks: Task[] = [];
    const results: Map<string, any> = new Map();

    for (const task of this.getExecutionOrder()) {
      try {
        const result = await this.executeTask(task);
        results.set(task.id, result);
        task.status = "completed";
      } catch (error) {
        task.status = "failed";
        failedTasks.push(task);

        // Check if we can continue
        if (this.isBlockingTask(task)) {
          // Cannot continue - downstream tasks depend on this
          break;
        }
        // else: continue with other tasks
      }
    }

    return {
      success: failedTasks.length === 0,
      partial: failedTasks.length > 0 && results.size > 0,
      results: Object.fromEntries(results),
      failedTasks: failedTasks.map((t) => ({
        id: t.id,
        name: t.name,
        error: t.error,
      })),
    };
  }
}
```

---

# SECTION 16: IMPLEMENTATION ROADMAP

## 16.1 Phase Overview

| Phase | Duration | Focus               | Deliverables                           |
| :---- | :------- | :------------------ | :------------------------------------- |
| 6.2.1 | 1 week   | Core Infrastructure | Session management, conversation API   |
| 6.2.2 | 1 week   | Executive Agent     | Intent parsing, clarifying questions   |
| 6.2.3 | 1 week   | Manager Agents      | Strategist, Copywriter, Producer       |
| 6.2.4 | 1 week   | Quality & Polish    | Verifier, error handling, optimization |

## 16.2 Detailed Timeline

### Phase 6.2.1: Core Infrastructure (Week 1)

**Day 1-2: Database & Session Management**

- [ ] Create conversation_sessions migration
- [ ] Create conversation_messages migration
- [ ] Create task_plans migration
- [ ] Implement SessionManager class
- [ ] Add Redis session caching

**Day 3-4: Conversation API**

- [ ] POST /api/v1/conversation/start
- [ ] POST /api/v1/conversation/:id/message
- [ ] POST /api/v1/conversation/:id/confirm
- [ ] GET /api/v1/tasks/:id/status
- [ ] POST /api/v1/tasks/:id/callback

**Day 5-7: Frontend Chat Interface**

- [ ] DirectorChat component
- [ ] MessageBubble component
- [ ] KBSelector integration
- [ ] Loading and error states
- [ ] Polling for task status

### Phase 6.2.2: Executive Agent (Week 2)

**Day 1-2: Base Agent Framework**

- [ ] Agent base class
- [ ] Message building utilities
- [ ] Response parsing
- [ ] Error handling wrappers

**Day 3-4: Executive Implementation**

- [ ] Executive system prompt
- [ ] Intent analysis logic
- [ ] Clarifying questions generation
- [ ] KB-aware question skipping

**Day 5-7: Conversation Flow**

- [ ] State machine implementation
- [ ] Answer processing
- [ ] Delegation plan creation
- [ ] Integration testing

### Phase 6.2.3: Manager Agents (Week 3)

**Day 1-2: Strategist Manager**

- [ ] System prompt
- [ ] Platform specs tool
- [ ] Audience analysis tool
- [ ] Creative brief generation

**Day 3-4: Copywriter Manager**

- [ ] System prompt
- [ ] Hook generation tool
- [ ] Script writing tool
- [ ] Caption/CTA tools

**Day 5-7: Producer Manager**

- [ ] System prompt
- [ ] n8n integration
- [ ] Production job management
- [ ] Callback handling

### Phase 6.2.4: Quality & Polish (Week 4)

**Day 1-2: Quality Verifier**

- [ ] Verification prompt
- [ ] Rule-based checks
- [ ] LLM-based checks
- [ ] Scoring system

**Day 3-4: Error Handling**

- [ ] Retry logic
- [ ] Fallback strategies
- [ ] Partial completion handling
- [ ] User-facing error messages

**Day 5-7: Optimization & Testing**

- [ ] Cost monitoring
- [ ] Response caching
- [ ] End-to-end testing
- [ ] Performance optimization

---

# SECTION 17: VERIFICATION PLAN

## 17.1 Automated Tests

### Unit Tests

```typescript
// tests/agents/executive.test.ts

describe("ExecutiveAgent", () => {
  describe("determineQuestionsNeeded", () => {
    it("should ask about platform when not specified", async () => {
      const questions = await determineQuestionsNeeded(
        "Create a video about our product",
        [],
        mockBrandContext,
        []
      );

      expect(questions.some((q) => q.field === "platform")).toBe(true);
    });

    it("should not ask about platform when specified", async () => {
      const questions = await determineQuestionsNeeded(
        "Create a TikTok video about our product",
        [],
        mockBrandContext,
        []
      );

      expect(questions.some((q) => q.field === "platform")).toBe(false);
    });

    it("should skip KB-available info", async () => {
      const questions = await determineQuestionsNeeded(
        "Create a video",
        [],
        { ...mockBrandContext, products: [{ name: "Widget" }] },
        [mockProductKB]
      );

      expect(questions.some((q) => q.field === "product")).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
// tests/api/conversation.test.ts

describe("Conversation API", () => {
  it("should create session and ask questions", async () => {
    const response = await request(app)
      .post("/api/v1/conversation/start")
      .send({
        brand_id: testBrandId,
        initial_message: "Make a video",
      });

    expect(response.status).toBe(200);
    expect(response.body.session_id).toBeDefined();
    expect(response.body.response.type).toBe("questions");
  });

  it("should proceed to delegation after answers", async () => {
    // Start session
    const start = await startSession();

    // Answer questions
    const response = await request(app)
      .post(`/api/v1/conversation/${start.session_id}/message`)
      .send({
        message: "TikTok, protein powder, focus on gains",
      });

    expect(response.body.response.type).toBe("delegation");
    expect(response.body.response.plan_preview).toBeDefined();
  });
});
```

## 17.2 Manual Verification Checklist

### Conversation Flow ✓

- [ ] User can start a new conversation
- [ ] Agent asks appropriate clarifying questions
- [ ] Agent skips questions when info is in KB
- [ ] User answers are correctly processed
- [ ] Session state persists across requests
- [ ] Session expires after inactivity

### Agent Delegation ✓

- [ ] Executive correctly identifies required tasks
- [ ] Tasks execute in correct dependency order
- [ ] Parallel tasks execute concurrently
- [ ] Task outputs flow to dependent tasks
- [ ] Failed tasks don't block independent tasks

### Quality Verification ✓

- [ ] Brand alignment is checked
- [ ] Platform specs are validated
- [ ] Quality score is calculated
- [ ] High-quality content auto-approves
- [ ] Low-quality content flags for review

### Error Handling ✓

- [ ] Rate limits trigger retry
- [ ] Invalid input shows clear error
- [ ] Partial failures are reported
- [ ] Session can be resumed after error

## 17.3 Success Metrics

| Metric                 | Target  | Measurement                      |
| :--------------------- | :------ | :------------------------------- |
| Clarification Accuracy | > 90%   | Questions lead to usable answers |
| Task Success Rate      | > 95%   | Tasks complete without error     |
| Quality Pass Rate      | > 85%   | Content passes verification      |
| User Satisfaction      | > 4.5/5 | Post-generation feedback         |
| Response Latency       | < 2s    | Time to first agent response     |
| E2E Latency            | < 5 min | Full video generation time       |

---

# APPENDIX A: GLOSSARY

| Term                | Definition                                                   |
| :------------------ | :----------------------------------------------------------- |
| Executive Agent     | The orchestrating AI that manages conversation and delegates |
| Manager Agent       | Specialized AI for strategy, copy, or production             |
| Worker Tool         | Function called by agents to perform specific actions        |
| Clarifying Question | Question asked by agent to gather missing information        |
| Task Plan           | Ordered list of tasks to complete a user request             |
| Knowledge Base      | Collection of brand assets and information (from Part I)     |
| Session             | Stateful conversation between user and Creative Director     |
| Verification        | Quality checks before content delivery                       |

---

# APPENDIX B: CONFIGURATION REFERENCE

```typescript
// lib/agents/config.ts

export const AGENT_CONFIG = {
  // Model selection
  models: {
    executive: "gpt-4o",
    managers: "gpt-4o-mini",
    verifier: "gpt-4o-mini",
  },

  // Token limits
  maxTokens: {
    executive: 4000,
    strategist: 3000,
    copywriter: 4000,
    producer: 2000,
    verifier: 2000,
  },

  // Temperature settings
  temperature: {
    executive: 0.7,
    strategist: 0.5,
    copywriter: 0.8,
    producer: 0.3,
    verifier: 0.2,
  },

  // Retry configuration
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  },

  // Session settings
  session: {
    ttlSeconds: 1800, // 30 minutes
    maxMessages: 50,
  },

  // Quality thresholds
  quality: {
    minPassScore: 7.0,
    autoApproveScore: 8.5,
    humanReviewScore: 6.0,
  },
};
```

---

**END OF PHASE 6 PART II MANIFESTO**

---

_Document Version: 1.0.0_
_Created: December 26, 2024_
_Authors: Brand Infinity Engine Team_
_Status: PROPOSED FOR APPROVAL_
