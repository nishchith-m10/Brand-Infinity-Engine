/**
 * Agent System Exports
 * Slice 6: Task Planning & Delegation
 */

// Executive Agent
export { ExecutiveAgent, createExecutiveAgent } from './executive';

// Task Planning
export { TaskPlanner, createTaskPlanner } from './task-planner';

// Manager Agents - TEMPORARILY DISABLED
// These agents need to be updated to match new type signatures
// (LLMResponse properties, ParsedIntent fields, Task vs SubTask)
// export { StrategistAgent, createStrategistAgent } from './managers/strategist';
// export { CopywriterAgent, createCopywriterAgent } from './managers/copywriter';
// export { ProducerAgent, createProducerAgent } from './managers/producer';

// Verifier Agent
export { VerifierAgent, createVerifierAgent } from './verifier';
export type { QualityCheckResult, QualityIssue, QualityChecklist } from './verifier';

// Orchestration
export { AgentOrchestrator, createOrchestrator } from './orchestrator';

// Types (re-export from types.ts)
export type {
  AgentType,
  ConversationSession,
  ParsedIntent,
  ClarifyingQuestion,
  ExecutiveAction,
  TaskPlan,
  DelegationPlan,
} from './types';

