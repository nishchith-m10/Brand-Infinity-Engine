# Phase 6 Part 2: Multi-Agent Creative Director

## Architecture Overview

This directory contains the implementation of the Multi-Agent Creative Director system, a conversational AI that orchestrates content creation through specialized agent managers.

## Directory Structure

```
lib/
├── agents/
│   ├── types.ts                 # Core type definitions
│   ├── config.ts                # Model configurations & settings
│   ├── executive.ts             # Executive Agent (orchestrator)
│   ├── strategist.ts            # Strategist Manager
│   ├── copywriter.ts            # Copywriter Manager
│   ├── producer.ts              # Producer Manager
│   ├── verifier.ts              # Quality Verifier
│   ├── memory/
│   │   ├── session.ts           # Session management (Redis)
│   │   ├── context.ts           # Context window management
│   │   └── history.ts           # Conversation history
│   ├── tools/
│   │   ├── strategy-tools.ts    # Platform specs, audience analysis
│   │   ├── copy-tools.ts        # Hook generation, script writing
│   │   └── production-tools.ts  # n8n integration, asset selection
│   └── __tests__/
│       ├── setup.ts             # Test configuration
│       ├── mocks.ts             # Mock data generators
│       └── *.test.ts            # Unit tests
│
├── llm/
│   ├── types.ts                 # Provider & LLM types
│   ├── unified-service.ts       # Main LLM interface
│   ├── credentials.ts           # API key management
│   ├── providers/
│   │   ├── openai.ts            # OpenAI client
│   │   ├── anthropic.ts         # Anthropic client
│   │   ├── deepseek.ts          # DeepSeek client
│   │   ├── gemini.ts            # Gemini client
│   │   ├── kimi.ts              # Kimi client
│   │   └── openrouter.ts        # OpenRouter client
│   └── cost-calculator.ts       # Cost tracking & estimation
```

## Agent Hierarchy

### Tier 1: Executive Agent (Orchestrator)
- **Model**: GPT-4o (premium)
- **Role**: Conversation management, intent understanding, task delegation
- **Responsibilities**:
  - Parse user requests
  - Ask clarifying questions
  - Load Knowledge Base context
  - Create task plans
  - Coordinate Manager Agents

### Tier 2: Manager Agents (Specialists)
All use **GPT-4o-mini** (budget tier) by default:

1. **Strategist Manager**
   - Creates creative briefs
   - Analyzes target audience
   - Defines platform requirements

2. **Copywriter Manager**
   - Writes scripts and hooks
   - Creates captions and CTAs
   - Generates A/B variants

3. **Producer Manager**
   - Coordinates asset generation
   - Triggers n8n workflows
   - Assembles final deliverables

4. **Verifier Manager**
   - Quality checks
   - Brand alignment verification
   - Platform compliance validation

## State Machine

Conversations follow this state flow:

```
initial → gathering → clarifying → planning → confirming → 
processing → verifying → delivered
```

## Type System

### Core Types
- `AgentType`: Type of agent (executive, strategist, etc.)
- `ConversationState`: Current state of conversation
- `ConversationSession`: Session data structure
- `ParsedIntent`: User's extracted intent
- `ClarifyingQuestion`: Question structure
- `TaskPlan`: Execution plan with tasks
- `Task`: Individual task specification

### LLM Types
- `LLMProvider`: Provider (openai, anthropic, etc.)
- `ModelConfig`: Model configuration
- `LLMRequest`: Unified request format
- `LLMResponse`: Unified response format
- `TokenUsage`: Cost & token tracking

## Configuration

### Model Assignment (config.ts)

```typescript
DEFAULT_AGENT_TIERS = {
  executive: "premium",   // GPT-4o
  strategist: "budget",   // GPT-4o-mini
  copywriter: "budget",
  producer: "budget",
  verifier: "budget",
}
```

### Temperature Settings

```typescript
AGENT_TEMPERATURES = {
  executive: 0.7,   // Balanced
  strategist: 0.5,  // Structured
  copywriter: 0.8,  // Creative
  producer: 0.3,    // Deterministic
  verifier: 0.2,    // Consistent
}
```

### Cost Thresholds

```typescript
QUALITY_THRESHOLDS = {
  minPassScore: 7.0,
  autoApproveScore: 8.5,
  humanReviewScore: 6.0,
}
```

## Testing

### Running Tests

```bash
# Run all agent tests
npm test lib/agents

# Run specific test file
npm test lib/agents/__tests__/executive.test.ts

# Watch mode
npm test lib/agents -- --watch
```

### Mock Data

Use `createMock*` functions from `__tests__/mocks.ts`:

```typescript
import { createMockSession, createMockIntent } from "../mocks";

const session = createMockSession({ state: "gathering" });
const intent = createMockIntent({ platform: "tiktok" });
```

## Implementation Status

### ✅ Slice 0: Scaffolding (COMPLETE)
- [x] Type definitions
- [x] Configuration
- [x] Mock data generators
- [x] Test setup

### ⏳ Slice 1: Database Foundation (NEXT)
- [ ] conversation_sessions table
- [ ] conversation_messages table
- [ ] RLS policies

### 🔜 Upcoming Slices
- Slice 2: Session Management API
- Slice 3: Provider Credential Storage
- Slice 4: OpenAI Integration
- Slice 5: Executive Agent (Basic)
- Slice 6: Frontend Chat Interface
- ... (see implementation plan)

## Cost Optimization

### Per-Provider Pricing (per 1M tokens)

| Provider   | Input  | Output | Use Case            |
|------------|--------|--------|---------------------|
| OpenAI     | $5.00  | $15.00 | Default (balanced)  |
| Anthropic  | $3.00  | $15.00 | Creative writing    |
| DeepSeek   | $0.27  | $1.10  | Budget mode (20x ↓) |
| Gemini     | $0.08  | $0.30  | Fast checks         |
| Kimi       | $0.20  | $0.60  | Long context        |
| OpenRouter | Varies | Varies | Power users         |

### Estimated Cost per Request

- **Draft Mode** (DeepSeek): $0.002
- **Standard Mode** (OpenAI tiered): $0.03-0.08
- **Premium Mode** (GPT-4o + Claude): $0.08-0.15

## Key Concepts

### Knowledge Base Integration
Agents can load brand context from Knowledge Bases created in Phase 6 Part 1:
- Brand voice guidelines
- Product information
- Historical campaign data
- Asset libraries

### Clarifying Questions System
Questions are generated intelligently:
- **Tier 1 (Critical)**: Must ask if missing (platform, content type)
- **Tier 2 (Important)**: Ask if not in KB (audience, message)
- **Tier 3 (Optional)**: Use defaults (duration, CTA)
- **Tier 4 (Never ask)**: Always infer from KB (brand colors, logo)

### Task Decomposition
Complex requests are broken into parallel and sequential tasks:
- Parallel tasks share a `parallel_group` number
- Sequential tasks have `dependencies` array
- Failed non-blocking tasks don't halt execution

## Development Guidelines

### Adding a New Agent

1. Create agent class in `lib/agents/[name].ts`
2. Define system prompt
3. Implement tool functions
4. Add to `AgentType` in types.ts
5. Configure model in config.ts
6. Write tests in `__tests__/[name].test.ts`

### Adding a New Provider

1. Create client in `lib/llm/providers/[name].ts`
2. Add to `LLMProvider` type
3. Add config to `PROVIDER_CONFIGS`
4. Implement in `unified-service.ts`
5. Add pricing to cost calculator
6. Test with real API key

### Best Practices

- ✅ Always use TypeScript strict mode
- ✅ Add JSDoc comments to public functions
- ✅ Write tests before implementation (TDD)
- ✅ Use mock data for testing (never hit real APIs in tests)
- ✅ Handle errors gracefully with retry logic
- ✅ Log costs for every LLM call
- ✅ Validate user input before processing
- ✅ Use RLS for database security

## Troubleshooting

### Common Issues

**"Provider not configured"**
- User hasn't added API key in Settings → AI Providers
- Check `user_llm_providers` table

**"Rate limit exceeded"**
- Retry with exponential backoff (automatic)
- Switch to different provider temporarily

**"Session not found"**
- Session expired (30min TTL in Redis)
- Create new session

**"Quality check failed"**
- Content doesn't meet brand guidelines
- Check `quality_verifications` table for details

## Resources

- [Phase 6 Part 2 Manifesto](../../docs/plans/PHASE_6_PART_II_AGENT_ARCHITECTURE_MANIFESTO.md)
- [Implementation Roadmap](../../CURSOR_HANDOFF_PHASE_6_PART_2.md)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Anthropic API Docs](https://docs.anthropic.com)

## Support

For questions or issues:
1. Check the manifesto (3,315 lines of specs)
2. Review test examples
3. Check mock data for expected formats
4. Consult implementation roadmap

---

**Status**: Slice 0 Complete ✅  
**Next Step**: Implement Slice 1 (Database Foundation)

