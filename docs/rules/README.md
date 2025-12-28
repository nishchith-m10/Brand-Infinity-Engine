# 📚 Rules & Project Context

This folder contains persistent context, prompts, and conventions for the **Brand Infinity Engine** project. These files ensure continuity across development sessions and provide a strong groundwork for AI-assisted development.

---

## 📁 Files

| File | Purpose |
|------|---------|
| `system_prompt.md` | System/architect prompt defining the AI agent's role, constraints, and behavior |
| `user_prompt.md` | Example user prompts and templates for common workflows |
| `project_context.md` | **Living document** — tracks progress, current state, and next steps (update after each session) |
| `conventions.md` | Coding standards, naming conventions, PR guidelines, and architectural rules |

---

## 🔄 Usage

### For AI Agents / Copilot
1. **Always read `project_context.md` first** to understand current state
2. **Follow `conventions.md`** for code style and architecture decisions
3. **Reference `system_prompt.md`** for behavioral guidelines

### For Developers
1. **Update `project_context.md`** after completing major tasks
2. **Add new conventions** to `conventions.md` as patterns emerge
3. **Keep prompts updated** as the project evolves

---

## 🚀 Quick Start

```bash
# Before starting work, review current state:
cat rules/project_context.md

# After completing work, update the context:
# (Edit rules/project_context.md with what was done)
```

---

## 📝 Maintenance

- `project_context.md` should be updated **after every major implementation session**
- Keep the "What's Done" section current
- Move completed items from "In Progress" to "Completed"
- Add new blockers or decisions to the appropriate sections
