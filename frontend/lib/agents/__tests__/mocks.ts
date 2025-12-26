/**
 * PHASE 6 PART 2: Mock Data Generators
 * For testing agents without hitting real APIs
 */

import {
  ConversationSession,
  ConversationMessage,
  ParsedIntent,
  ClarifyingQuestion,
  TaskPlan,
  Task,
  BrandContext,
  QualityVerification,
  AgentResponse,
  PlatformSpecs,
} from "../types";

// ============================================================================
// ID GENERATORS
// ============================================================================

let mockIdCounter = 0;

export function generateMockId(prefix: string = "mock"): string {
  return `${prefix}_${Date.now()}_${++mockIdCounter}`;
}

export function generateMockUUID(): string {
  return `${generateMockId()}-uuid`;
}

// ============================================================================
// CONVERSATION SESSION MOCKS
// ============================================================================

export function createMockSession(
  overrides?: Partial<ConversationSession>
): ConversationSession {
  return {
    id: generateMockUUID(),
    brand_id: generateMockUUID(),
    user_id: generateMockUUID(),
    state: "initial",
    parsed_intent: {},
    answered_questions: {},
    pending_questions: [],
    selected_kb_ids: [],
    active_task_plan_id: null,
    created_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

export function createMockMessage(
  overrides?: Partial<ConversationMessage>
): ConversationMessage {
  return {
    id: generateMockUUID(),
    session_id: generateMockUUID(),
    brand_id: generateMockUUID(),
    user_id: generateMockUUID(),
    role: "user",
    content: "Test message",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// INTENT & QUESTION MOCKS
// ============================================================================

export function createMockIntent(
  overrides?: Partial<ParsedIntent>
): ParsedIntent {
  return {
    content_type: "video",
    platform: "tiktok",
    product: "Chocolate Protein Powder",
    target_audience: "Fitness enthusiasts 18-35",
    key_message: "25g protein per serving",
    tone: "energetic",
    duration: 30,
    confidence: 0.85,
    raw_message: "Make a TikTok about our chocolate protein powder",
    ...overrides,
  };
}

export function createMockQuestion(
  overrides?: Partial<ClarifyingQuestion>
): ClarifyingQuestion {
  return {
    id: generateMockId("question"),
    field: "platform",
    question: "Which platform are you targeting?",
    type: "choice",
    options: ["TikTok", "Instagram Reels", "YouTube Shorts"],
    required: true,
    ...overrides,
  };
}

export function createMockQuestions(): ClarifyingQuestion[] {
  return [
    createMockQuestion({
      id: "q1",
      field: "platform",
      question: "Which platform are you targeting?",
      type: "choice",
      options: ["TikTok", "Instagram Reels", "YouTube Shorts"],
    }),
    createMockQuestion({
      id: "q2",
      field: "product",
      question: "Which product should we feature?",
      type: "text",
      required: true,
    }),
    createMockQuestion({
      id: "q3",
      field: "tone",
      question: "What tone should we use?",
      type: "choice",
      options: ["Energetic", "Professional", "Casual", "Humorous"],
      required: false,
      default_value: "Professional",
    }),
  ];
}

// ============================================================================
// TASK & PLAN MOCKS
// ============================================================================

export function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: generateMockId("task"),
    type: "strategy",
    name: "Create Creative Brief",
    manager: "strategist",
    dependencies: [],
    inputs: {},
    status: "pending",
    ...overrides,
  };
}

export function createMockTaskPlan(
  overrides?: Partial<TaskPlan>
): TaskPlan {
  return {
    id: generateMockUUID(),
    session_id: generateMockUUID(),
    brand_id: generateMockUUID(),
    tasks: [
      createMockTask({
        id: "task_1",
        type: "preparation",
        name: "Load Brand Context",
        manager: "executive",
        parallel_group: 1,
      }),
      createMockTask({
        id: "task_2",
        type: "strategy",
        name: "Create Creative Brief",
        manager: "strategist",
        dependencies: ["task_1"],
      }),
      createMockTask({
        id: "task_3",
        type: "copy",
        name: "Write Script",
        manager: "copywriter",
        dependencies: ["task_2"],
      }),
      createMockTask({
        id: "task_4",
        type: "production",
        name: "Generate Video",
        manager: "producer",
        dependencies: ["task_3"],
      }),
      createMockTask({
        id: "task_5",
        type: "verification",
        name: "Quality Check",
        manager: "verifier",
        dependencies: ["task_4"],
      }),
    ],
    estimated_duration_seconds: 300,
    estimated_cost_usd: 0.05,
    status: "pending",
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// BRAND CONTEXT MOCKS
// ============================================================================

export function createMockBrandContext(
  overrides?: Partial<BrandContext>
): BrandContext {
  return {
    brand_id: generateMockUUID(),
    brand_name: "FitPro Nutrition",
    brand_voice: "Energetic, motivational, science-backed",
    primary_colors: ["#FF6B35", "#004E89", "#1A1A1A"],
    logo_url: "https://example.com/logo.png",
    loaded_kbs: [generateMockUUID()],
    loaded_kb_names: ["Core Brand Identity", "Product Catalog"],
    matched_assets: [
      {
        id: generateMockUUID(),
        name: "FitPro Logo",
        type: "logo",
        url: "https://example.com/logo.png",
      },
      {
        id: generateMockUUID(),
        name: "Product Shot - Chocolate",
        type: "image",
        url: "https://example.com/product-chocolate.jpg",
      },
    ],
    products: [
      {
        id: generateMockUUID(),
        name: "Chocolate Protein Powder",
        description: "25g protein, delicious chocolate flavor",
        category: "Protein Supplements",
        key_features: [
          "25g protein per serving",
          "Low sugar",
          "Grass-fed whey",
        ],
        target_audience: "Fitness enthusiasts 18-35",
      },
    ],
    negative_constraints: [
      "No competitor mentions",
      "No unverified health claims",
    ],
    required_elements: ["Logo visible", "Product shown"],
    ...overrides,
  };
}

// ============================================================================
// QUALITY VERIFICATION MOCKS
// ============================================================================

export function createMockVerification(
  overrides?: Partial<QualityVerification>
): QualityVerification {
  return {
    id: generateMockUUID(),
    task_plan_id: generateMockUUID(),
    content_type: "video",
    passed: true,
    overall_score: 8.5,
    checks: {
      brand_alignment: {
        passed: true,
        score: 9.0,
        issues: [],
      },
      platform_compliance: {
        passed: true,
        issues: [],
      },
      content_quality: {
        passed: true,
        score: 8.5,
        issues: [],
      },
      negative_constraints: {
        passed: true,
        issues: [],
        violations: [],
      },
    },
    recommendations: [
      "Consider adding more product shots",
      "Hook could be stronger",
    ],
    can_auto_approve: true,
    human_review_required: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// AGENT RESPONSE MOCKS
// ============================================================================

export function createMockAgentResponse(
  type: "questions" | "delegation" | "message" | "error"
): AgentResponse {
  switch (type) {
    case "questions":
      return {
        type: "questions",
        content: "Great! A few quick questions to ensure I create exactly what you need:",
        questions: createMockQuestions(),
      };
    
    case "delegation":
      return {
        type: "delegation",
        content: "Perfect! I have everything I need. Here's my plan:",
        plan_preview: {
          tasks: [
            "Create strategic brief",
            "Write engaging script",
            "Generate TikTok video",
            "Quality verification",
          ],
          estimated_time: "5-8 minutes",
          estimated_cost: "$0.05",
          breakdown: {
            strategy: true,
            copywriting: true,
            production: true,
            verification: true,
          },
        },
      };
    
    case "message":
      return {
        type: "message",
        content: "I understand you want to create content. Let me help you with that!",
      };
    
    case "error":
      return {
        type: "error",
        content: "I encountered an error processing your request.",
        error: {
          code: "rate_limit",
          message: "API rate limit exceeded. Please try again in a moment.",
          retry_possible: true,
        },
      };
  }
}

// ============================================================================
// PLATFORM SPECS MOCKS
// ============================================================================

export function createMockPlatformSpecs(
  platform: string = "tiktok"
): PlatformSpecs {
  const specs: Record<string, PlatformSpecs> = {
    tiktok: {
      platform: "tiktok",
      video_duration: { min: 5, max: 180, optimal: 30 },
      aspect_ratios: ["9:16"],
      max_file_size_mb: 287,
      audio_required: true,
      caption_limits: 2200,
      hashtag_recommendations: 5,
      best_practices: [
        "Hook in first 3 seconds",
        "Use trending sounds",
        "Keep text large and readable",
      ],
    },
    instagram_reels: {
      platform: "instagram_reels",
      video_duration: { min: 3, max: 90, optimal: 15 },
      aspect_ratios: ["9:16", "1:1"],
      max_file_size_mb: 250,
      audio_required: true,
      caption_limits: 2200,
      hashtag_recommendations: 10,
      best_practices: [
        "Vertical format preferred",
        "Use trending audio",
        "Include captions",
      ],
    },
    youtube_shorts: {
      platform: "youtube_shorts",
      video_duration: { min: 15, max: 60, optimal: 30 },
      aspect_ratios: ["9:16"],
      max_file_size_mb: 256,
      audio_required: true,
      caption_limits: 100,
      hashtag_recommendations: 3,
      best_practices: [
        "Strong opening hook",
        "Clear call-to-action",
        "Subscribe reminder",
      ],
    },
  };
  
  return specs[platform] || specs.tiktok;
}

// ============================================================================
// COMPLETE CONVERSATION FLOW MOCK
// ============================================================================

export function createMockConversationFlow() {
  const session = createMockSession();
  const brandContext = createMockBrandContext();
  const intent = createMockIntent();
  
  return {
    // Step 1: Initial message
    userMessage1: "Make a video about our protein powder",
    agentResponse1: createMockAgentResponse("questions"),
    
    // Step 2: Answer questions
    userMessage2: "TikTok, Chocolate flavor, focus on protein content",
    agentResponse2: createMockAgentResponse("delegation"),
    
    // Step 3: Confirm and execute
    taskPlan: createMockTaskPlan(),
    
    // Step 4: Verification
    verification: createMockVerification(),
    
    // Supporting data
    session,
    brandContext,
    intent,
  };
}

// ============================================================================
// HELPER UTILITIES
// ============================================================================

/**
 * Wait for specified milliseconds (for testing async flows)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock LLM response
 */
export function createMockLLMResponse(content: string) {
  return {
    content,
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      totalCost: 0.001,
    },
    provider: "openai" as const,
    model: "gpt-4o-mini",
    finish_reason: "stop" as const,
  };
}

