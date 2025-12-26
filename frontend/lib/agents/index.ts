/**
 * Agent System Exports
 * Slice 6: Task Planning & Delegation
 */

// Executive Agent
export { ExecutiveAgent, createExecutiveAgent } from './executive';

// Task Planning
export { TaskPlanner, createTaskPlanner } from './task-planner';

// Manager Agents
export { StrategistAgent, createStrategistAgent } from './managers/strategist';
export { CopywriterAgent, createCopywriterAgent } from './managers/copywriter';
export { ProducerAgent, createProducerAgent } from './managers/producer';

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
  SubTask,
  DelegationPlan,
} from './types';

