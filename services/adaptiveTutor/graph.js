// LangGraph definition for the adaptive bilateral tutor variant.
//
// Four supported architectures, switched by the `architecture` option to
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

import { StateGraph, START, END } from '@langchain/langgraph';
import { AdaptiveTutorState } from './stateSchema.js';
import { callRole } from './llm.js';

const SUPPORTED_ARCHITECTURES = Object.freeze([
  'recognition_only',
  'ego_superego',
  'state_policy',
  'state_policy_with_validator',
]);
export { SUPPORTED_ARCHITECTURES };

const lastTextOf = (messages, role) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === role || m._getType?.() === role) return m.content || m.text || '';
  }
  return '';
};

async function learnerProfileUpdate(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  const profile = await callRole('learnerProfileUpdate', {
    learnerLastMessage,
    hidden: state.hiddenLearnerState,
    currentProfile: state.learnerProfile,
    turn: state.turn,
  });
  // Bookkeeping is owned by the graph, not the model — guarantees
  // the constraint check has a reliable updatedAtTurn signal regardless
  // of which LLM backend produced the profile.
  return { learnerProfile: { ...profile, updatedAtTurn: state.turn } };
}

async function tutorEgoInitial(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  const out = await callRole('tutorEgoInitial', {
    learnerLastMessage,
    learnerProfile: state.learnerProfile,
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

  // state_policy and state_policy_with_validator share the bulk of the graph;
  // the validator slot is conditional on architecture.
  const includeValidator = architecture === 'state_policy_with_validator';

  const g = new StateGraph(AdaptiveTutorState)
    .addNode('learnerProfileUpdate', learnerProfileUpdate)
    .addNode('tutorEgoInitial', tutorEgoInitial)
    .addNode('tutorSuperegoReview', tutorSuperegoReview)
    .addNode('constraintCheck', constraintCheck)
    .addNode('tutorEgoRevision', tutorEgoRevision)
    .addNode('tutorEmit', tutorEmit)
    .addNode('learnerTurn', learnerTurn)
    .addEdge(START, 'learnerProfileUpdate')
    .addEdge('learnerProfileUpdate', 'tutorEgoInitial')
    .addEdge('tutorEgoInitial', 'tutorSuperegoReview');

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
