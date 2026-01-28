/**
 * Evaluation Types
 *
 * Types for the eval dashboard components.
 */

export interface EvalProfile {
  name: string;
  description: string;
  egoProvider?: string;
  egoModel?: string;
  superegoProvider?: string;
  superegoModel?: string;
  dialogueEnabled?: boolean;
  maxRounds?: number;
}

export interface EvalScenario {
  id: string;
  name: string;
  description?: string;
  category?: string;
  turnCount?: number;
  isMultiTurn?: boolean;
}

export interface EvalRun {
  id: string;
  description?: string;
  totalTests?: number;
  totalScenarios?: number;
  totalConfigurations?: number;
  status: 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  runType?: 'quick' | 'batch' | 'matrix' | 'compare' | 'interaction';
  profiles?: string[];
}

export type EvalDimensionScore = number | { score: number; reasoning?: string; quote?: string } | null;

export interface EvalDimensionScores {
  relevance: EvalDimensionScore;
  specificity: EvalDimensionScore;
  pedagogical: EvalDimensionScore;
  personalization: EvalDimensionScore;
  actionability: EvalDimensionScore;
  tone: EvalDimensionScore;
}

export interface EvalSuggestion {
  type: string;
  title: string;
  message: string;
  actionTarget?: string;
  headline?: string;
  body?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface EvalValidation {
  passesRequired: boolean;
  passesForbidden: boolean;
  requiredMissing: string[];
  forbiddenFound: string[];
}

export interface EvalQuickTestResult {
  scenarioId: string;
  scenarioName: string;
  profile: string;
  provider?: string;
  model?: string;
  passed: boolean;
  overallScore: number | null;
  latencyMs: number;
  scores?: EvalDimensionScores;
  validation?: EvalValidation;
  suggestions?: EvalSuggestion[];
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  apiCalls?: number;
  dialogueRounds?: number;
  evaluationReasoning?: string;
  evaluatorModel?: string;
  scenarioContext?: {
    description: string;
    expectedBehavior?: string;
    learnerContext?: Record<string, string | undefined>;
  };
}

// Agent role types for dialogue system
export type AgentRole = 'user' | 'ego' | 'superego';
export type DialogueDirection = 'input' | 'request' | 'response';

export interface EvalDialogueEntry {
  timestamp: string;
  agent: AgentRole;
  action?: string;
  model?: string;
  provider?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  suggestions?: Array<{ type: string; title: string; message: string; priority?: string }>;
  verdict?: { approved: boolean; confidence?: number; feedback?: string };
  preAnalysis?: {
    isPreAnalysis: boolean;
    reinterpretations?: unknown[];
    overallCaution?: string;
  };
  from?: AgentRole;
  to?: AgentRole;
  direction?: DialogueDirection;
  rawContext?: string;
  contextData?: {
    courseId?: string;
    courseTitle?: string;
    lectureId?: string;
    lectureTitle?: string;
    recentActivity?: string[];
  };
  output?: unknown;
  cost?: number;
}

export interface EvalDialogue {
  dialogueId: string;
  startTime: string;
  endTime: string;
  entryCount: number;
  entries?: EvalDialogueEntry[];
  summary?: {
    egoCount: number;
    superegoCount: number;
    totalSuggestions: number;
    approvedCount: number;
    revisedCount: number;
    totalLatencyMs: number;
    totalInputTokens?: number;
    totalOutputTokens?: number;
  };
}

export interface EvalTrendPoint {
  runId: string;
  createdAt: string;
  description?: string;
  runType?: 'quick' | 'eval' | 'matrix' | 'compare' | 'auto';
  profiles?: string[];
  scenarioCount?: number;
  testCount: number;
  overallScore: number | null;
  dimensions: EvalDimensionScores;
}

export interface EvalDoc {
  name: string;
  filename: string;
  title: string;
  size: number;
  modified: string;
}
