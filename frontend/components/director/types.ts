/**
 * PHASE 6 PART 2: Frontend UI Component Types
 * Types for Creative Director chat interface
 */

import {
  ConversationSession,
  ClarifyingQuestion,
  TaskPlan,
  BrandContext,
} from "@/lib/agents/types";
import { LLMProvider, PresetMode } from "@/lib/llm/types";

// ============================================================================
// CHAT INTERFACE TYPES
// ============================================================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  
  // For assistant messages
  questions?: ClarifyingQuestion[];
  planPreview?: TaskPlanPreview;
  status?: MessageStatus;
  
  // Metadata
  isStreaming?: boolean;
  error?: ChatError;
}

export type MessageStatus = 
  | "sending"
  | "sent"
  | "processing"
  | "completed"
  | "error";

export interface ChatError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface TaskPlanPreview {
  tasks: string[];
  estimatedTime: string;
  estimatedCost: string;
  breakdown?: {
    strategy: boolean;
    copywriting: boolean;
    production: boolean;
    verification: boolean;
  };
}

// ============================================================================
// CHAT STATE
// ============================================================================

export interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  
  // Session state
  sessionState: ConversationSession["state"] | null;
  activePlan: TaskPlan | null;
  
  // Context
  selectedKBs: string[];
  brandContext: BrandContext | null;
  
  // Provider selection
  selectedProvider: LLMProvider;
  presetMode: PresetMode;
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface DirectorChatProps {
  brandId: string;
  initialKBs?: string[];
  onSessionStart?: (sessionId: string) => void;
  onPlanGenerated?: (plan: TaskPlan) => void;
  onComplete?: (outputs: Record<string, unknown>) => void;
}

export interface MessageBubbleProps {
  message: ChatMessage;
  onQuestionAnswer?: (questionId: string, answer: unknown) => void;
  onPlanConfirm?: () => void;
  onPlanReject?: () => void;
}

export interface QuestionFormProps {
  questions: ClarifyingQuestion[];
  onSubmit: (answers: Record<string, unknown>) => void;
  isSubmitting?: boolean;
}

export interface PlanPreviewProps {
  plan: TaskPlanPreview;
  onConfirm: () => void;
  onReject: () => void;
  isConfirming?: boolean;
}

export interface TaskStatusCardProps {
  taskPlan: TaskPlan;
  onCancel?: () => void;
}

export interface KBSelectorProps {
  brandId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  maxSelections?: number;
}

export interface ProviderSelectorProps {
  selectedProvider: LLMProvider;
  selectedPreset?: PresetMode;
  onProviderChange: (provider: LLMProvider) => void;
  onPresetChange?: (preset: PresetMode) => void;
  compact?: boolean;
  showCostEstimate?: boolean;
}

// ============================================================================
// CHAT INPUT TYPES
// ============================================================================

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
  showAttachments?: boolean;
  maxLength?: number;
}

export interface ChatInputState {
  value: string;
  isFocused: boolean;
  charCount: number;
  hasError: boolean;
}

// ============================================================================
// MESSAGE RENDERING
// ============================================================================

export interface MessageContentProps {
  content: string;
  isUser: boolean;
}

export interface QuestionButtonProps {
  question: ClarifyingQuestion;
  onSelect: (answer: unknown) => void;
  disabled?: boolean;
}

export interface ChoiceButtonsProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
  selectedValue?: string;
}

// ============================================================================
// LOADING & STATUS INDICATORS
// ============================================================================

export interface LoadingIndicatorProps {
  message?: string;
  showProgress?: boolean;
  progress?: number;  // 0-100
}

export interface TypingIndicatorProps {
  agentName?: string;
}

export interface TaskProgressProps {
  currentTask: string;
  completedTasks: number;
  totalTasks: number;
  estimatedRemainingSeconds: number;
}

// ============================================================================
// SETTINGS & CONFIGURATION UI
// ============================================================================

export interface ProviderConfigCardProps {
  provider: LLMProvider;
  configured: boolean;
  onEdit: () => void;
  onRemove?: () => void;
}

export interface APIKeyDialogProps {
  provider: LLMProvider;
  isOpen: boolean;
  onSave: (apiKey: string) => Promise<void>;
  onClose: () => void;
  existingKey?: string;  // Masked
}

export interface AgentModelSelectorProps {
  agentType: string;
  currentProvider: LLMProvider;
  currentModel: string;
  onModelChange: (provider: LLMProvider, model: string) => void;
}

// ============================================================================
// COST DISPLAY TYPES
// ============================================================================

export interface CostEstimateProps {
  estimatedCost: number;
  breakdown?: {
    agent: string;
    cost: number;
  }[];
  showBreakdown?: boolean;
}

export interface CostComparisonProps {
  currentProvider: LLMProvider;
  alternatives: {
    provider: LLMProvider;
    cost: number;
    quality: number;
  }[];
}

// ============================================================================
// HISTORY & SESSION MANAGEMENT
// ============================================================================

export interface SessionHistoryProps {
  brandId: string;
  onSessionSelect: (sessionId: string) => void;
  currentSessionId?: string;
}

export interface SessionCardProps {
  session: ConversationSession;
  onClick: () => void;
  isActive?: boolean;
  showDelete?: boolean;
  onDelete?: () => void;
}

// ============================================================================
// VALIDATION & ERRORS
// ============================================================================

export interface FormValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface ValidationResult {
  field: string;
  isValid: boolean;
  errorMessage?: string;
}

// ============================================================================
// HOOKS RETURN TYPES
// ============================================================================

export interface UseDirectorChatReturn {
  // State
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
  sessionState: ConversationSession["state"] | null;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  answerQuestions: (answers: Record<string, unknown>) => Promise<void>;
  confirmPlan: () => Promise<void>;
  rejectPlan: () => Promise<void>;
  cancelExecution: () => Promise<void>;
  startNewSession: () => void;
  
  // Configuration
  setProvider: (provider: LLMProvider) => void;
  setPreset: (preset: PresetMode) => void;
  setKBs: (kbIds: string[]) => void;
}

export interface UseTaskStatusReturn {
  taskPlan: TaskPlan | null;
  isLoading: boolean;
  progress: {
    completedTasks: number;
    totalTasks: number;
    currentTask: string | null;
    estimatedRemainingSeconds: number;
  };
  error: string | null;
  startPolling: (taskPlanId: string) => void;
  stopPolling: () => void;
}

// ============================================================================
// ANIMATION & TRANSITIONS
// ============================================================================

export interface MessageAnimation {
  type: "fade" | "slide" | "scale";
  duration: number;
  delay?: number;
}

export interface TransitionConfig {
  enter: string;
  enterFrom: string;
  enterTo: string;
  leave: string;
  leaveFrom: string;
  leaveTo: string;
}

