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

// Bilateral-ToM extension: paired natural-language + JSON representation
// of the tutor's hypothesis of the learner (LBM bottleneck pattern), the
// tutor's second-order belief about the learner's perception of the tutor,
// and four FANToM-style probes the tutor commits to per turn so tom_accuracy
// can be scored against the learner's hidden ownState in post-hoc analysis.
//
// All three fields are .optional() because only the bilateral_tom architecture
// branch populates them; cells 110/111/112/113 keep producing schema-valid
// profiles without them.
const hypothesizedTutorPerceptionSchema = z.object({
  summaryText: z.string().default(''),
  jsonState: z.record(z.string(), z.unknown()).default(() => ({})),
});

const tomProbesSchema = z.object({
  // BELIEF[DIST]: tutor's prediction of learner's actual misconception
  belief_dist: z.string().default(''),
  // BELIEF[CHOICE]: tutor's prediction of learner's actual agency stance
  belief_choice: z.enum(['compliant', 'questioning', 'resistant', 'collaborative', 'unknown']).default('unknown'),
  // ANSWERABILITY[LIST]: prior turn indices where tutor predicts learner has insufficient information to answer
  answerability_list: z.array(z.number().int()).default(() => []),
  // INFOACCESS[LIST]: prior turn indices the tutor predicts the learner has actually integrated
  infoaccess_list: z.array(z.number().int()).default(() => []),
});

const learnerProfileSchema = z.object({
  misconceptions: z.array(z.string()).default(() => []),
  confidence: z.number().min(0).max(1).default(0.5),
  agencySignal: z.enum(['compliant', 'questioning', 'resistant', 'collaborative', 'unknown']).default('unknown'),
  zpdEstimate: z.string().default(''),
  lastEvidence: z.string().default(''),
  updatedAtTurn: z.number().int().default(-1),
  summaryText: z.string().optional(),
  hypothesizedLearnerPerceptionOfTutor: hypothesizedTutorPerceptionSchema.optional(),
  tomProbes: tomProbesSchema.optional(),
});

// idConstruction + idAuthoredPrompt are populated by the bilateral_tom_id_director_*
// architectures (cells 121, 122). The id-author node parses the id-director response
// into the construction envelope (mirrors services/idDirectorEngine.js parseIdConstruction)
// and the ego-execute node consumes idAuthoredPrompt as its system prompt at call time.
const idConstructionSchema = z.object({
  generated_prompt: z.string().default(''),
  persona_delta: z.string().default(''),
  stage_directions: z.string().default(''),
  reasoning: z.string().default(''),
  parse_status: z.string().default(''),
});

const tutorInternalSchema = z.object({
  egoDraft: z.string().default(''),
  superegoFeedback: z.string().default(''),
  egoRevision: z.string().default(''),
  policyAction: z.string().default(''),
  idConstruction: idConstructionSchema.optional(),
  idAuthoredPrompt: z.string().default(''),
});

// A14 evidence-bound adaptive controller — Stage 1 schema.
//
// Two new top-level state fields the existing nodes do not yet populate:
// evidenceLog (append-only observation ledger) and hypotheses (typed
// tentative claims with TTL semantics). Both default to empty so cells
// 110-113 and the bilateral_tom variants keep producing schema-valid
// state without populating them. Stage 2 adds the extractor and
// hypothesisUpdater nodes that actually write here.
//
// Why these are top-level rather than nested under learnerProfile:
// the next-steps report (§4.2-4.3) explicitly distinguishes the evidence
// ledger from state hypotheses, and the existing learnerProfile carries
// "current best guess" semantics that hypotheses replace with "tentative,
// expiring claims." Mixing the two would lose the type discipline.
const evidenceTypeSchema = z.enum([
  'learner_self_report',
  'learner_action',
  'learner_question',
  'learner_correction',
  'tutor_inference', // used sparingly; flags claims the tutor made about the learner that lack direct learner evidence
]);

const evidenceEntrySchema = z.object({
  obs_id: z.string(),
  turn: z.number().int(),
  quote: z.string(), // verbatim span from the dialogue (Stage 2 enforces substring match)
  type: evidenceTypeSchema,
  kc_candidates: z.array(z.string()).default(() => []),
  created_by: z.string().default('extractor_v1'),
  // Set by the extractor's quote-validation gate (Stage 2). False = the quote
  // string did not exact-match any prior dialogue text and the entry should be
  // ignored by downstream consumers. Kept rather than dropped so the audit
  // trail records hallucinated extractions.
  validated: z.boolean().default(false),
});

const hypothesisStatusSchema = z.enum([
  'tentative',
  'validated',
  'contradicted',
  'expired',
]);

const hypothesisSchema = z.object({
  hypothesis_id: z.string(),
  claim: z.string(),
  confidence: z.number().min(0).max(1).default(0.5),
  supporting_evidence: z.array(z.string()).default(() => []), // obs_id refs
  contradicting_evidence: z.array(z.string()).default(() => []), // obs_id refs
  status: hypothesisStatusSchema.default('tentative'),
  // TTL semantics: hypothesis is considered expired when
  // current_turn > created_at_turn + expires_after_turns. Storing the offset
  // (rather than an absolute expires_at_turn) keeps creation metadata immutable
  // under counterfactual replay where turn counters can branch.
  created_at_turn: z.number().int(),
  expires_after_turns: z.number().int().min(1).default(2),
  next_validation_action: z.string().default(''), // a POLICY_ACTIONS label, when applicable
});

// Append-only reducer for evidenceLog: identical pattern to `dialogue`.
const evidenceLogReducer = (prev, next) => (prev || []).concat(next || []);

// Merge-by-id reducer for hypotheses: status transitions update the same
// entity rather than appending new events. Last write wins per hypothesis_id.
const hypothesesReducer = (prev, next) => {
  if (!Array.isArray(next) || next.length === 0) return prev || [];
  const byId = new Map((prev || []).map((h) => [h.hypothesis_id, h]));
  for (const h of next) {
    if (h && typeof h.hypothesis_id === 'string') {
      byId.set(h.hypothesis_id, h);
    }
  }
  return [...byId.values()];
};

export {
  evidenceTypeSchema,
  evidenceEntrySchema,
  hypothesisStatusSchema,
  hypothesisSchema,
};

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

  // A14 Stage 1: append-only observation ledger. The extractor (Stage 2)
  // writes here; the validator (Stage 3) reads from here to ground tutor
  // claims about the learner.
  evidenceLog: new ReducedValue(
    z.array(evidenceEntrySchema).default(() => []),
    { reducer: evidenceLogReducer },
  ),

  // A14 Stage 1: typed tentative claims with TTL. The hypothesisUpdater
  // (Stage 2) writes here; the policy selector (Stage 3) reads from here
  // to choose evidence-gated next actions.
  hypotheses: new ReducedValue(
    z.array(hypothesisSchema).default(() => []),
    { reducer: hypothesesReducer },
  ),
});
