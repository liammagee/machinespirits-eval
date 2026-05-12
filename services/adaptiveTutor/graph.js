// LangGraph definition for the adaptive bilateral tutor variant.
//
// Five supported architectures, switched by the `architecture` option to
// buildGraph(). All variants emit the same per-turn record shape (so the
// strategy-shift analyzer can score them uniformly), but the deliberation
// pipelines differ:
//
//   recognition_only           (A13 condition C1 — cell_111)
//     learnerTurn ↔ tutorEgoInitial → tutorEmit
//     Single LLM call per tutor turn. No superego, no profile update,
//     no constraint check, no revision. Policy action still emitted so
//     strategy_shift_correctness is scoreable.
//
//   recognition_named_patterns (cell_116 — paired comparison to cell_111)
//     Same topology as recognition_only. Differs only in the ego prompt:
//     adds an instruction to name recurring meta-patterns (polite
//     affirmation, oracle-seeking, deflection) explicitly, and passes
//     dialogue history into the user prompt so the ego can actually see
//     them. Tests whether the cell_111-vs-cell_115 gap on
//     polite_false_mastery is closable by prompt addition alone.
//
//   ego_superego               (A13 condition C2 — cell_112)
//     learnerTurn ↔ tutorEgoInitial → tutorSuperegoReview
//                  → tutorEgoRevision (always) → tutorEmit
//     Two-pass deliberation matching the project's standard ego/superego
//     architecture. No profile update, no constraint check.
//
//   state_policy   (DEFAULT)   (A13 condition C3 — cell_110)
//     learnerProfileUpdate → tutorEgoInitial → tutorSuperegoReview
//       → constraintCheck → [tutorEgoRevision]? → tutorEmit → learnerTurn
//     Strategy 1 (externalised profile) + Strategy 3 (constraint-driven
//     revision) + Strategy 5 (counterfactual replay, in runner.js).
//
//   state_policy_with_validator (A13 condition C4 — cell_113)
//     state_policy + tutorValidator node between tutorSuperegoReview and
//     constraintCheck. Validator is a stricter second-pass that reads the
//     just-picked policy action against POLICY_ACTION_DETAILS' trigger
//     conditions and contraindications, and forces revision on mismatch.
//
//   bilateral_tom              (P2 cell C5 — cell_115)
//     learnerProfileUpdate → tutorTomTracker → tutorEgoInitial
//       → tutorSuperegoReview → constraintCheck → [tutorEgoRevision]?
//       → tutorEmit → learnerTurn
//     state_policy + a ToM tracker that emits paired summaryText (LBM
//     bottleneck), hypothesizedLearnerPerceptionOfTutor (second-order
//     belief), and tomProbes (FANToM-style predictions scored against
//     ground truth in post-hoc analysis). All three fields land on
//     learnerProfile, which the existing tutorEgoInitial prompt is now
//     ToM-aware about. Tutor side only — bilateral learner extension
//     in services/learnerTutorInteractionEngine.js is a separate
//     deliverable per docs/explorations/claude/p2-bilateral-tom-pre-registration.md §3.
//
//   bilateral_tom_named_patterns (cell_117 — additivity probe)
//     Same topology as bilateral_tom. Differs only in the ego prompt:
//     swaps tutorEgoInitial for tutorEgoInitialNamedPatterns (the cell_116
//     prompt that names recurring meta-patterns and reads dialogue history).
//     Tests whether the two interventions — ToM tracker (cell_115) and
//     named-patterns prompt (cell_116) — combine additively. Pilot
//     comparison in 3-arm cell_111/115/116 showed each intervention won
//     on a different scenario family (115 stronger on false_confusion;
//     116 stronger on polite_false_mastery), so additivity is plausible
//     but not guaranteed.

import { StateGraph, START, END } from '@langchain/langgraph';
import { AdaptiveTutorState } from './stateSchema.js';
import { callRole } from './llm.js';

const SUPPORTED_ARCHITECTURES = Object.freeze([
  'recognition_only',
  'recognition_named_patterns',
  'ego_superego',
  'state_policy',
  'state_policy_with_validator',
  'state_policy_minimal_profile',
  'state_policy_no_misconceptions',
  'state_policy_no_agency_signal',
  'state_policy_minimal_plus_zpd',
  'bilateral_tom',
  'bilateral_tom_named_patterns',
  // P2.3 crossover (cells 121, 122): bilateral_tom learner state feeds an
  // id-director that authors the ego's system prompt per turn. v1 is single-
  // pass (id → ego → emit, no superego/revision); v2 keeps the state_policy
  // pathway with the id-authored prompt threaded into the existing ego node.
  'bilateral_tom_id_director_v1',
  'bilateral_tom_id_director_v2',
]);
export { SUPPORTED_ARCHITECTURES };

// Per-architecture projection of the learnerProfile fields the LLM sees.
// Architectures not listed keep the full profile. Each entry names the
// fields preserved from the LLM's structured output; everything else is
// reset to the schema's default value (agencySignal='unknown',
// misconceptions=[], zpdEstimate='', summaryText=''). updatedAtTurn is
// always set by the graph node, never via projection — see learnerProfileUpdate.
//
// Source-of-truth for which fields each cell exposes:
// docs/explorations/claude/p2-followup-pre-registration.md §P2.2.
const PROFILE_PROJECTIONS = Object.freeze({
  state_policy_minimal_profile: ['confidence', 'lastEvidence'],
  state_policy_no_misconceptions: ['confidence', 'agencySignal', 'zpdEstimate', 'lastEvidence'],
  state_policy_no_agency_signal: ['confidence', 'misconceptions', 'zpdEstimate', 'lastEvidence'],
  // Post-hoc P2.2 follow-up (cell_123): minimal profile + zpdEstimate only.
  // Disentangles whether zpdEstimate alone re-introduces the ~50% strict_shift
  // floor shared by cells 110/119/120, or whether profile field-count is the
  // operative variable. See §6.8.6.
  state_policy_minimal_plus_zpd: ['confidence', 'lastEvidence', 'zpdEstimate'],
});

function projectProfileForArchitecture(profile, architecture) {
  const keep = PROFILE_PROJECTIONS[architecture];
  if (!keep) return profile;
  const out = {
    misconceptions: [],
    confidence: 0.5,
    agencySignal: 'unknown',
    zpdEstimate: '',
    lastEvidence: '',
    summaryText: '',
  };
  for (const k of keep) {
    if (k in profile) out[k] = profile[k];
  }
  return out;
}

const lastTextOf = (messages, role) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === role || m._getType?.() === role) return m.content || m.text || '';
  }
  return '';
};

function makeLearnerProfileUpdate(architecture) {
  return async function learnerProfileUpdate(state) {
    const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
    const profile = await callRole('learnerProfileUpdate', {
      learnerLastMessage,
      hidden: state.hiddenLearnerState,
      currentProfile: state.learnerProfile,
      turn: state.turn,
    });
    const projected = projectProfileForArchitecture(profile, architecture);
    // Bookkeeping is owned by the graph, not the model — guarantees
    // the constraint check has a reliable updatedAtTurn signal regardless
    // of which LLM backend produced the profile.
    return { learnerProfile: { ...projected, updatedAtTurn: state.turn } };
  };
}

// Bilateral-ToM tracker: paired LBM bottleneck text + second-order belief +
// FANToM-style probes, all written back onto learnerProfile so the existing
// tutorEgoInitial node can read them as part of the profile context. Spreads
// the prior profile so updatedAtTurn (set by learnerProfileUpdate immediately
// before this node) is preserved — otherwise constraintCheck would flag
// "learner profile not updated at turn N" and force a spurious revision.
async function tutorTomTracker(state) {
  const tom = await callRole('tutorTomTracker', {
    learnerProfile: state.learnerProfile,
    dialogue: state.dialogue,
    turn: state.turn,
  });
  return {
    learnerProfile: {
      ...state.learnerProfile,
      summaryText: tom.summaryText,
      hypothesizedLearnerPerceptionOfTutor: tom.hypothesizedLearnerPerceptionOfTutor,
      tomProbes: tom.tomProbes,
    },
  };
}

async function tutorEgoInitial(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  const systemPromptOverride = state.tutorInternal?.idAuthoredPrompt || undefined;
  const out = await callRole('tutorEgoInitial', {
    learnerLastMessage,
    learnerProfile: state.learnerProfile,
    systemPromptOverride,
  });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoDraft: out.text,
      policyAction: out.policyAction,
      superegoFeedback: '',
      egoRevision: '',
    },
  };
}

// Id-director node for the bilateral_tom × id-director crossover (cells 121, 122).
// Authors the ego's system prompt for the turn from the bilateral_tom-enriched
// learner profile (misconceptions, confidence, agencySignal, summaryText,
// hypothesizedLearnerPerceptionOfTutor, tomProbes). Mirrors
// services/idDirectorEngine.js: prompt comes from the same tutor-id-director.md
// file (loaded inside realLLM.js); the response is parsed into the same
// construction envelope. The graph carries the construction forward via
// tutorInternal so persistence.js can record it on the per-turn trace.
async function idAuthorPersona(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  const previousPersona = state.tutorInternal?.idConstruction?.generated_prompt
    ? `last_persona_delta: ${state.tutorInternal.idConstruction.persona_delta || 'UNKNOWN'}\nlast_reasoning: ${state.tutorInternal.idConstruction.reasoning || ''}\nlast_generated_prompt_head: ${state.tutorInternal.idConstruction.generated_prompt.slice(0, 240)}${state.tutorInternal.idConstruction.generated_prompt.length > 240 ? '...' : ''}`
    : 'FIRST_TURN';
  const construction = await callRole('idAuthorPersona', {
    dialogue: state.dialogue,
    learnerLastMessage,
    learnerProfile: state.learnerProfile,
    previousPersona,
    turn: state.turn,
  });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      idConstruction: construction,
      idAuthoredPrompt: construction.generated_prompt,
    },
  };
}

// Single-pass ego executor for Variant A (bilateral_tom_id_director_v1).
// The id-authored prompt is the ego's system prompt for this call; the role's
// canonical TUTOR_EGO_INITIAL_SYSTEM is bypassed via systemPromptOverride.
// Still emits {text, policyAction} so strategy_shift_correctness is scoreable.
async function tutorEgoExecute(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  const out = await callRole('tutorEgoExecute', {
    learnerLastMessage,
    learnerProfile: state.learnerProfile,
    systemPromptOverride: state.tutorInternal?.idAuthoredPrompt || '',
  });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoDraft: out.text,
      policyAction: out.policyAction,
      superegoFeedback: '',
      egoRevision: '',
    },
  };
}

// Variant ego node used by recognition_named_patterns. Identical to
// tutorEgoInitial except (a) routes to the tutorEgoInitialNamedPatterns
// role (different system prompt) and (b) passes dialogue history so the
// prompt can actually see the cross-turn patterns it's instructed to
// surface.
async function tutorEgoInitialNamedPatterns(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  const out = await callRole('tutorEgoInitialNamedPatterns', {
    learnerLastMessage,
    learnerProfile: state.learnerProfile,
    dialogue: state.dialogue,
  });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoDraft: out.text,
      policyAction: out.policyAction,
      superegoFeedback: '',
      egoRevision: '',
    },
  };
}

async function tutorSuperegoReview(state) {
  const out = await callRole('tutorSuperego', {
    tutorInternal: state.tutorInternal,
    learnerProfile: state.learnerProfile,
  });
  return {
    tutorInternal: { ...state.tutorInternal, superegoFeedback: out.feedback },
    constraintViolations: out.needsRevision ? [out.feedback] : [],
  };
}

async function tutorValidator(state) {
  const out = await callRole('tutorValidator', {
    policyAction: state.tutorInternal.policyAction,
    tutorDraft: state.tutorInternal.egoDraft,
    learnerProfile: state.learnerProfile,
  });
  // Validator appends to the same constraintViolations channel as the
  // structural constraint check so the existing routing logic picks it up.
  return {
    constraintViolations: out.needsRevision ? [`validator: ${out.feedback}`] : [],
  };
}

async function constraintCheck(state) {
  const violations = [];
  // Strategy 3: a turn must show that the learner profile was updated this turn.
  if (state.learnerProfile.updatedAtTurn !== state.turn) {
    violations.push(`learner profile not updated at turn ${state.turn}`);
  }
  // Strategy 3: if learner is resistant, tutor must not pick a pure-explanation action.
  const explanationActions = new Set(['give_worked_example', 'lower_cognitive_load']);
  if (state.learnerProfile.agencySignal === 'resistant'
      && explanationActions.has(state.tutorInternal.policyAction)) {
    violations.push(`policy ${state.tutorInternal.policyAction} contraindicated for resistant learner`);
  }
  return { constraintViolations: violations };
}

async function tutorEgoRevision(state) {
  const out = await callRole('tutorEgoRevision', {
    tutorInternal: state.tutorInternal,
    learnerProfile: state.learnerProfile,
  });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoRevision: out.text,
      policyAction: out.policyAction,
    },
  };
}

async function tutorEmit(state) {
  const finalText = state.tutorInternal.egoRevision || state.tutorInternal.egoDraft;
  return { dialogue: [{ role: 'tutor', content: finalText }] };
}

async function learnerTurn(state) {
  const tutorLastMessage = lastTextOf(state.dialogue, 'tutor');
  const text = await callRole('learnerTurn', {
    tutorLastMessage,
    hidden: state.hiddenLearnerState,
    turn: state.turn,
  });
  return { dialogue: [{ role: 'learner', content: text }], turn: state.turn + 1 };
}

const routeAfterConstraint = (state) => {
  const violationsThisTurn = state.constraintViolations.length > 0
    && state.tutorInternal.egoRevision === '';
  return violationsThisTurn ? 'tutorEgoRevision' : 'tutorEmit';
};

const routeAfterLearner = (loopBackNode) => (state) =>
  (state.turn >= state.maxTurns ? END : loopBackNode);

export function buildGraph(options = {}) {
  const architecture = options.architecture ?? 'state_policy';
  if (!SUPPORTED_ARCHITECTURES.includes(architecture)) {
    throw new Error(`buildGraph: unsupported architecture "${architecture}". Expected one of: ${SUPPORTED_ARCHITECTURES.join(', ')}`);
  }

  if (architecture === 'recognition_only') {
    return new StateGraph(AdaptiveTutorState)
      .addNode('tutorEgoInitial', tutorEgoInitial)
      .addNode('tutorEmit', tutorEmit)
      .addNode('learnerTurn', learnerTurn)
      .addEdge(START, 'tutorEgoInitial')
      .addEdge('tutorEgoInitial', 'tutorEmit')
      .addEdge('tutorEmit', 'learnerTurn')
      .addConditionalEdges('learnerTurn', routeAfterLearner('tutorEgoInitial'), ['tutorEgoInitial', END]);
  }

  if (architecture === 'recognition_named_patterns') {
    return new StateGraph(AdaptiveTutorState)
      .addNode('tutorEgoInitial', tutorEgoInitialNamedPatterns)
      .addNode('tutorEmit', tutorEmit)
      .addNode('learnerTurn', learnerTurn)
      .addEdge(START, 'tutorEgoInitial')
      .addEdge('tutorEgoInitial', 'tutorEmit')
      .addEdge('tutorEmit', 'learnerTurn')
      .addConditionalEdges('learnerTurn', routeAfterLearner('tutorEgoInitial'), ['tutorEgoInitial', END]);
  }

  if (architecture === 'bilateral_tom_id_director_v1') {
    // Variant A (lighter): profile → ToM → id-author → ego-execute → emit.
    // No superego, no constraint check, no revision. Loop back to
    // learnerProfileUpdate so the bilateral_tom state refreshes per turn.
    const learnerProfileUpdate = makeLearnerProfileUpdate(architecture);
    return new StateGraph(AdaptiveTutorState)
      .addNode('learnerProfileUpdate', learnerProfileUpdate)
      .addNode('tutorTomTracker', tutorTomTracker)
      .addNode('idAuthorPersona', idAuthorPersona)
      .addNode('tutorEgoExecute', tutorEgoExecute)
      .addNode('tutorEmit', tutorEmit)
      .addNode('learnerTurn', learnerTurn)
      .addEdge(START, 'learnerProfileUpdate')
      .addEdge('learnerProfileUpdate', 'tutorTomTracker')
      .addEdge('tutorTomTracker', 'idAuthorPersona')
      .addEdge('idAuthorPersona', 'tutorEgoExecute')
      .addEdge('tutorEgoExecute', 'tutorEmit')
      .addEdge('tutorEmit', 'learnerTurn')
      .addConditionalEdges('learnerTurn', routeAfterLearner('learnerProfileUpdate'), ['learnerProfileUpdate', END]);
  }

  if (architecture === 'ego_superego') {
    // Always-revise: the superego unconditionally feeds back, the ego
    // unconditionally revises. This matches the project's two-pass posture
    // for the standard cells while keeping the path linear (no conditional
    // edge — no constraint check exists for this architecture).
    return new StateGraph(AdaptiveTutorState)
      .addNode('tutorEgoInitial', tutorEgoInitial)
      .addNode('tutorSuperegoReview', tutorSuperegoReview)
      .addNode('tutorEgoRevision', tutorEgoRevision)
      .addNode('tutorEmit', tutorEmit)
      .addNode('learnerTurn', learnerTurn)
      .addEdge(START, 'tutorEgoInitial')
      .addEdge('tutorEgoInitial', 'tutorSuperegoReview')
      .addEdge('tutorSuperegoReview', 'tutorEgoRevision')
      .addEdge('tutorEgoRevision', 'tutorEmit')
      .addEdge('tutorEmit', 'learnerTurn')
      .addConditionalEdges('learnerTurn', routeAfterLearner('tutorEgoInitial'), ['tutorEgoInitial', END]);
  }

  // state_policy, state_policy_with_validator, bilateral_tom,
  // bilateral_tom_named_patterns, and the three state_policy_*_profile
  // ablations share the bulk of the graph. Conditional slots: validator
  // inserts between superego and constraint check (post-policy stricter
  // pass); tom-tracker inserts between profile update and ego (pre-policy
  // second-order context); named-patterns swaps the ego node function so
  // the prompt that surfaces meta-patterns is used while keeping the rest
  // of the topology identical. The state_policy_*_profile ablations share
  // the state_policy topology unchanged but project the LLM-emitted
  // profile to a subset of fields via PROFILE_PROJECTIONS.
  const includeValidator = architecture === 'state_policy_with_validator';
  const includeTomTracker = architecture === 'bilateral_tom'
    || architecture === 'bilateral_tom_named_patterns'
    || architecture === 'bilateral_tom_id_director_v2';
  const includeIdAuthor = architecture === 'bilateral_tom_id_director_v2';
  const egoInitialFn = architecture === 'bilateral_tom_named_patterns'
    ? tutorEgoInitialNamedPatterns
    : tutorEgoInitial;
  const learnerProfileUpdate = makeLearnerProfileUpdate(architecture);

  const g = new StateGraph(AdaptiveTutorState)
    .addNode('learnerProfileUpdate', learnerProfileUpdate)
    .addNode('tutorEgoInitial', egoInitialFn)
    .addNode('tutorSuperegoReview', tutorSuperegoReview)
    .addNode('constraintCheck', constraintCheck)
    .addNode('tutorEgoRevision', tutorEgoRevision)
    .addNode('tutorEmit', tutorEmit)
    .addNode('learnerTurn', learnerTurn)
    .addEdge(START, 'learnerProfileUpdate');

  if (includeTomTracker) {
    g.addNode('tutorTomTracker', tutorTomTracker)
      .addEdge('learnerProfileUpdate', 'tutorTomTracker');
    if (includeIdAuthor) {
      g.addNode('idAuthorPersona', idAuthorPersona)
        .addEdge('tutorTomTracker', 'idAuthorPersona')
        .addEdge('idAuthorPersona', 'tutorEgoInitial');
    } else {
      g.addEdge('tutorTomTracker', 'tutorEgoInitial');
    }
  } else {
    g.addEdge('learnerProfileUpdate', 'tutorEgoInitial');
  }

  g.addEdge('tutorEgoInitial', 'tutorSuperegoReview');

  if (includeValidator) {
    g.addNode('tutorValidator', tutorValidator)
      .addEdge('tutorSuperegoReview', 'tutorValidator')
      .addEdge('tutorValidator', 'constraintCheck');
  } else {
    g.addEdge('tutorSuperegoReview', 'constraintCheck');
  }

  return g
    .addConditionalEdges('constraintCheck', routeAfterConstraint, ['tutorEgoRevision', 'tutorEmit'])
    .addEdge('tutorEgoRevision', 'tutorEmit')
    .addEdge('tutorEmit', 'learnerTurn')
    .addConditionalEdges('learnerTurn', routeAfterLearner('learnerProfileUpdate'), ['learnerProfileUpdate', END]);
}
