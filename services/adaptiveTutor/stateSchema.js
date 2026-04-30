// Externalised tutor-learner state for the LangGraph adaptive variant.
//
// Strategy 1: the learner profile is a structured artifact that nodes read and
// write, not a string the model reconstructs each turn. Strategy 3: violations
// are appended by checks and consumed by conditional edges.

import { StateSchema, ReducedValue } from '@langchain/langgraph';
import { z } from 'zod';

const messageSchema = z.object({
  role: z.enum(['tutor', 'learner', 'system']),
  content: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const learnerProfileSchema = z.object({
  misconceptions: z.array(z.string()).default(() => []),
  confidence: z.number().min(0).max(1).default(0.5),
  agencySignal: z.enum(['compliant', 'questioning', 'resistant', 'collaborative', 'unknown']).default('unknown'),
  zpdEstimate: z.string().default(''),
  lastEvidence: z.string().default(''),
  updatedAtTurn: z.number().int().default(-1),
});

const tutorInternalSchema = z.object({
  egoDraft: z.string().default(''),
  superegoFeedback: z.string().default(''),
  egoRevision: z.string().default(''),
  policyAction: z.string().default(''),
});

export const initialLearnerProfile = () => learnerProfileSchema.parse({});
export const initialTutorInternal = () => tutorInternalSchema.parse({});

export const AdaptiveTutorState = new StateSchema({
  // Append-only dialogue. Tutor/learner roles are project-native and don't
  // map cleanly onto LangChain's human/ai message types, so we run our own
  // reducer instead of using MessagesValue.
  dialogue: new ReducedValue(
    z.array(messageSchema).default(() => []),
    { reducer: (prev, next) => prev.concat(next) },
  ),

  // The externalised learner model. Last write wins; nodes that update it
  // must increment `updatedAtTurn` so we can detect stale or missing updates.
  learnerProfile: learnerProfileSchema,

  // Tutor scratchpad for the deliberation loop within a single turn.
  // Reset at the start of each turn by the entry node.
  tutorInternal: tutorInternalSchema,

  // Append-only constraint-violation log. The constraint-check node writes
  // here; conditional edges read from it.
  constraintViolations: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (prev, next) => prev.concat(next) },
  ),

  // Scenario-driven hidden truth about the learner. The tutor never sees this
  // directly; it's used by the (mock or real) learner node to generate signals
  // and by the analysis layer to score whether the tutor's profile converged.
  hiddenLearnerState: z.object({
    actualMisconception: z.string().default(''),
    actualSophistication: z.enum(['novice', 'intermediate', 'advanced']).default('intermediate'),
    triggerTurn: z.number().int().default(-1),
    triggerSignal: z.string().default(''),
  }),

  turn: z.number().int().default(0),
  maxTurns: z.number().int().default(4),
});
