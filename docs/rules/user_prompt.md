# 📝 User Prompt Templates

Common prompts and templates for interacting with the Brand Infinity Engine development.

---

## 🚀 Session Start Prompt

```
I'm continuing work on Brand Infinity Engine. Please:
1. Read rules/project_context.md for current state
2. Check what's in progress and what's next
3. Continue from where we left off
```

---

## 🔧 Implementation Prompts

### Start New Feature
```
Implement [FEATURE_NAME] for Brand Infinity Engine.
- Check project_context.md for dependencies
- Follow conventions.md for code style
- Update project_context.md when done
```

### Fix Bug
```
There's an issue with [COMPONENT]:
- Error: [ERROR_MESSAGE]
- Expected: [EXPECTED_BEHAVIOR]
- Actual: [ACTUAL_BEHAVIOR]

Please investigate and fix.
```

### Add Integration
```
Integrate [SERVICE_NAME] into the pipeline:
- Add credentials to .env.local
- Create adapter in utils/
- Wire into [PILLAR_NAME]
- Add tests
```

---

## 📊 Status Check Prompts

### Full Status
```
What's the current state of Brand Infinity Engine?
- What's implemented and working?
- What's in progress?
- What are the blockers?
- What should we work on next?
```

### Specific Pillar Status
```
What's the status of Pillar [N] ([PILLAR_NAME])?
- Which components are done?
- What's missing?
- What dependencies are needed?
```

---

## 🧪 Testing Prompts

### Run Tests
```
Run tests for [COMPONENT]:
- Unit tests
- Integration tests
- Show any failures and suggest fixes
```

### Manual Test Flow
```
Help me manually test the [FLOW_NAME] flow:
1. What data do I need to seed?
2. What endpoints/commands to run?
3. What output should I expect?
```

---

## 📦 Deployment Prompts

### Environment Setup
```
Help me set up [ENVIRONMENT] environment:
- Required credentials
- Docker services to start
- Migrations to run
- Verification steps
```

### Deploy Workflows
```
Deploy n8n workflows for Pillar [N]:
- Export workflow JSON
- Configure credentials
- Test webhook endpoints
```

---

## 🎬 Content Generation Prompts

### Generate Creative Brief
```
Generate a creative brief for:
- Brand: [BRAND_NAME]
- Product: [PRODUCT_NAME]
- Target Platform: [instagram/tiktok/youtube/linkedin]
- Campaign Goal: [awareness/conversion/engagement]
```

### Generate Video Script
```
Create a video script from this creative brief:
[PASTE_BRIEF_JSON]

Requirements:
- Duration: [15/30/60] seconds
- Tone: [TONE]
- Hook style: [question/statistic/story/shock]
```

---

## 💡 Architecture Prompts

### Design Decision
```
I need to decide between [OPTION_A] and [OPTION_B] for [COMPONENT].
Consider:
- Performance implications
- Cost implications
- Maintenance burden
- Future scalability
```

### Review Code
```
Review [FILE_PATH] for:
- Code quality
- Security issues
- Performance optimizations
- Adherence to conventions.md
```
