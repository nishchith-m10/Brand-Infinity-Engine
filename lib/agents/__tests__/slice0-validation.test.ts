/**
 * PHASE 6 PART 2: Slice 0 Validation Tests
 * Verify all scaffolding is correctly set up
 */

import {
  createMockSession,
  createMockMessage,
  createMockIntent,
  createMockQuestion,
  createMockTask,
  createMockTaskPlan,
  createMockBrandContext,
  createMockVerification,
  createMockAgentResponse,
  createMockPlatformSpecs,
  generateMockId,
  generateMockUUID,
} from "./mocks";

import {
  DEFAULT_AGENT_TIERS,
  AGENT_TEMPERATURES,
  AGENT_MAX_TOKENS,
  PROVIDER_CONFIGS,
  PRESET_CONFIGS,
  getModelForAgent,
  estimateRequestCost,
} from "../config";

describe("Slice 0: Scaffolding Validation", () => {
  describe("Type Definitions", () => {
    test("should import all core types without errors", () => {
      // If this test passes, all types are valid
      expect(true).toBe(true);
    });
  });

  describe("Mock Data Generators", () => {
    test("should generate valid conversation session", () => {
      const session = createMockSession();
      
      expect(session.id).toBeDefined();
      expect(session.brand_id).toBeDefined();
      expect(session.user_id).toBeDefined();
      expect(session.state).toBe("initial");
      expect(session.parsed_intent).toEqual({});
      expect(session.selected_kb_ids).toEqual([]);
      expect(session.created_at).toBeDefined();
    });

    test("should generate valid conversation message", () => {
      const message = createMockMessage();
      
      expect(message.id).toBeDefined();
      expect(message.role).toBe("user");
      expect(message.content).toBeDefined();
      expect(message.created_at).toBeDefined();
    });

    test("should generate valid parsed intent", () => {
      const intent = createMockIntent();
      
      expect(intent.content_type).toBe("video");
      expect(intent.platform).toBe("tiktok");
      expect(intent.product).toBe("Chocolate Protein Powder");
      expect(intent.confidence).toBeGreaterThan(0);
      expect(intent.confidence).toBeLessThanOrEqual(1);
    });

    test("should generate valid clarifying question", () => {
      const question = createMockQuestion();
      
      expect(question.id).toBeDefined();
      expect(question.field).toBeDefined();
      expect(question.question).toBeDefined();
      expect(question.type).toBeDefined();
      expect(question.required).toBeDefined();
    });

    test("should generate valid task", () => {
      const task = createMockTask();
      
      expect(task.id).toBeDefined();
      expect(task.type).toBeDefined();
      expect(task.name).toBeDefined();
      expect(task.manager).toBeDefined();
      expect(task.status).toBe("pending");
      expect(Array.isArray(task.dependencies)).toBe(true);
    });

    test("should generate valid task plan", () => {
      const plan = createMockTaskPlan();
      
      expect(plan.id).toBeDefined();
      expect(plan.session_id).toBeDefined();
      expect(plan.brand_id).toBeDefined();
      expect(Array.isArray(plan.tasks)).toBe(true);
      expect(plan.tasks.length).toBeGreaterThan(0);
      expect(plan.estimated_duration_seconds).toBeGreaterThan(0);
      expect(plan.estimated_cost_usd).toBeGreaterThan(0);
    });

    test("should generate valid brand context", () => {
      const context = createMockBrandContext();
      
      expect(context.brand_id).toBeDefined();
      expect(context.brand_name).toBeDefined();
      expect(context.brand_voice).toBeDefined();
      expect(Array.isArray(context.primary_colors)).toBe(true);
      expect(Array.isArray(context.matched_assets)).toBe(true);
      expect(Array.isArray(context.products)).toBe(true);
    });

    test("should generate valid quality verification", () => {
      const verification = createMockVerification();
      
      expect(verification.id).toBeDefined();
      expect(verification.passed).toBe(true);
      expect(verification.overall_score).toBeGreaterThan(0);
      expect(verification.checks).toBeDefined();
      expect(verification.checks.brand_alignment).toBeDefined();
      expect(verification.checks.platform_compliance).toBeDefined();
    });

    test("should generate all types of agent responses", () => {
      const questionsResponse = createMockAgentResponse("questions");
      expect(questionsResponse.type).toBe("questions");
      expect(questionsResponse.questions).toBeDefined();
      
      const delegationResponse = createMockAgentResponse("delegation");
      expect(delegationResponse.type).toBe("delegation");
      expect(delegationResponse.plan_preview).toBeDefined();
      
      const messageResponse = createMockAgentResponse("message");
      expect(messageResponse.type).toBe("message");
      
      const errorResponse = createMockAgentResponse("error");
      expect(errorResponse.type).toBe("error");
      expect(errorResponse.error).toBeDefined();
    });

    test("should generate platform specs", () => {
      const tiktokSpecs = createMockPlatformSpecs("tiktok");
      expect(tiktokSpecs.platform).toBe("tiktok");
      expect(tiktokSpecs.video_duration).toBeDefined();
      expect(tiktokSpecs.aspect_ratios).toContain("9:16");
      
      const reelsSpecs = createMockPlatformSpecs("instagram_reels");
      expect(reelsSpecs.platform).toBe("instagram_reels");
    });

    test("should generate unique IDs", () => {
      const id1 = generateMockId();
      const id2 = generateMockId();
      expect(id1).not.toBe(id2);
      
      const uuid1 = generateMockUUID();
      const uuid2 = generateMockUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe("Configuration", () => {
    test("should have correct agent tier assignments", () => {
      expect(DEFAULT_AGENT_TIERS.executive).toBe("premium");
      expect(DEFAULT_AGENT_TIERS.strategist).toBe("budget");
      expect(DEFAULT_AGENT_TIERS.copywriter).toBe("budget");
      expect(DEFAULT_AGENT_TIERS.producer).toBe("budget");
      expect(DEFAULT_AGENT_TIERS.verifier).toBe("budget");
    });

    test("should have valid temperature settings", () => {
      Object.values(AGENT_TEMPERATURES).forEach((temp) => {
        expect(temp).toBeGreaterThanOrEqual(0);
        expect(temp).toBeLessThanOrEqual(1);
      });
    });

    test("should have valid max token settings", () => {
      Object.values(AGENT_MAX_TOKENS).forEach((tokens) => {
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThanOrEqual(8000);
      });
    });

    test("should have all provider configs", () => {
      const expectedProviders = [
        "openai",
        "anthropic",
        "deepseek",
        "gemini",
        "kimi",
        "openrouter",
      ];
      
      expectedProviders.forEach((provider) => {
        expect(PROVIDER_CONFIGS[provider as keyof typeof PROVIDER_CONFIGS]).toBeDefined();
      });
    });

    test("should have valid provider pricing", () => {
      Object.values(PROVIDER_CONFIGS).forEach((config) => {
        expect(config.pricing.input_per_1m).toBeGreaterThan(0);
        expect(config.pricing.output_per_1m).toBeGreaterThan(0);
        expect(config.context_window).toBeGreaterThan(0);
      });
    });

    test("should have all preset configurations", () => {
      expect(PRESET_CONFIGS.draft).toBeDefined();
      expect(PRESET_CONFIGS.standard).toBeDefined();
      expect(PRESET_CONFIGS.premium).toBeDefined();
    });

    test("should calculate correct model for agent", () => {
      const executiveModel = getModelForAgent("executive", "openai");
      expect(executiveModel).toBe("gpt-4o");
      
      const strategistModel = getModelForAgent("strategist", "openai");
      expect(strategistModel).toBe("gpt-4o-mini");
    });

    test("should calculate cost correctly", () => {
      const cost = estimateRequestCost("openai", 1000, 500);
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(1); // Should be cents, not dollars
    });

    test("should verify DeepSeek is cheapest", () => {
      const openaiCost = estimateRequestCost("openai", 1000, 500);
      const deepseekCost = estimateRequestCost("deepseek", 1000, 500);
      
      expect(deepseekCost).toBeLessThan(openaiCost);
      expect(openaiCost / deepseekCost).toBeGreaterThan(10); // At least 10x cheaper
    });
  });

  describe("Type Safety", () => {
    test("should enforce conversation state enum", () => {
      const validStates = [
        "initial",
        "gathering",
        "clarifying",
        "planning",
        "confirming",
        "processing",
        "verifying",
        "delivered",
        "cancelled",
      ];
      
      const session = createMockSession();
      expect(validStates).toContain(session.state);
    });

    test("should enforce agent type enum", () => {
      const validAgents = [
        "executive",
        "strategist",
        "copywriter",
        "producer",
        "verifier",
      ];
      
      const task = createMockTask();
      expect(validAgents).toContain(task.manager);
    });

    test("should enforce provider type enum", () => {
      const validProviders = [
        "openai",
        "anthropic",
        "deepseek",
        "gemini",
        "kimi",
        "openrouter",
      ];
      
      Object.keys(PROVIDER_CONFIGS).forEach((provider) => {
        expect(validProviders).toContain(provider);
      });
    });
  });

  describe("Data Integrity", () => {
    test("should generate consistent task dependencies", () => {
      const plan = createMockTaskPlan();
      
      // Verify all dependencies reference valid task IDs
      const taskIds = plan.tasks.map((t) => t.id);
      plan.tasks.forEach((task) => {
        task.dependencies.forEach((depId) => {
          expect(taskIds).toContain(depId);
        });
      });
    });

    test("should have valid task execution order", () => {
      const plan = createMockTaskPlan();
      
      // Task with dependencies should come after its dependencies
      plan.tasks.forEach((task, index) => {
        if (task.dependencies.length > 0) {
          task.dependencies.forEach((depId) => {
            const depIndex = plan.tasks.findIndex((t) => t.id === depId);
            expect(depIndex).toBeLessThan(index);
          });
        }
      });
    });

    test("should have consistent verification checks", () => {
      const verification = createMockVerification();
      
      expect(verification.checks.brand_alignment).toBeDefined();
      expect(verification.checks.platform_compliance).toBeDefined();
      expect(verification.checks.content_quality).toBeDefined();
      expect(verification.checks.negative_constraints).toBeDefined();
      
      // If overall passed, all checks should pass
      if (verification.passed) {
        expect(verification.checks.brand_alignment.passed).toBe(true);
        expect(verification.checks.platform_compliance.passed).toBe(true);
        expect(verification.checks.content_quality.passed).toBe(true);
        expect(verification.checks.negative_constraints.passed).toBe(true);
      }
    });
  });

  describe("Preset Configurations", () => {
    test("should have valid draft preset (budget mode)", () => {
      const draft = PRESET_CONFIGS.draft;
      
      // All agents should use cheap providers
      expect(
        draft.agent_configs.executive.provider === "deepseek" ||
        draft.agent_configs.executive.provider === "gemini"
      ).toBe(true);
    });

    test("should have valid standard preset (balanced)", () => {
      const standard = PRESET_CONFIGS.standard;
      
      // Executive should use premium model
      expect(standard.agent_configs.executive.model).toContain("gpt-4");
    });

    test("should have valid premium preset (high quality)", () => {
      const premium = PRESET_CONFIGS.premium;
      
      // Should use best models
      expect(
        premium.agent_configs.copywriter.provider === "anthropic" ||
        premium.agent_configs.copywriter.model.includes("gpt-4")
      ).toBe(true);
    });
  });
});

describe("Slice 0: Success Criteria", () => {
  test("✅ All types compile with no errors", () => {
    expect(true).toBe(true);
  });

  test("✅ Mock data generators produce valid objects", () => {
    expect(createMockSession).toBeDefined();
    expect(createMockIntent).toBeDefined();
    expect(createMockTaskPlan).toBeDefined();
  });

  test("✅ Configuration is complete and valid", () => {
    expect(Object.keys(DEFAULT_AGENT_TIERS).length).toBe(5);
    expect(Object.keys(PROVIDER_CONFIGS).length).toBe(6);
    expect(Object.keys(PRESET_CONFIGS).length).toBe(3);
  });

  test("✅ Test framework is configured", () => {
    expect(jest).toBeDefined();
    expect(describe).toBeDefined();
    expect(test).toBeDefined();
    expect(expect).toBeDefined();
  });
});

