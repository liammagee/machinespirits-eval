// LangGraph definition for the adaptive bilateral tutor variant.
//
// Pipeline per turn:
//   learnerProfileUpdate -> tutorEgoInitial -> tutorSuperegoReview
//   -> (constraintCheck) -> [tutorEgoRevision]? -> tutorEmit
//   -> learnerTurn -> (loop or end)
//
// Strategy 1 lives in the learnerProfile field of state.
// Strategy 3 lives in the conditional edge after constraintCheck.
// Strategy 5 lives in the checkpointer (see runner).

import { StateGraph, START, END } from '@langchain/langgraph';
import { AdaptiveTutorState } from './stateSchema.js';
import { callRole } from './llm.js';

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

const routeAfterLearner = (state) => (state.turn >= state.maxTurns ? END : 'learnerProfileUpdate');

export function buildGraph() {
  return new StateGraph(AdaptiveTutorState)
    .addNode('learnerProfileUpdate', learnerProfileUpdate)
    .addNode('tutorEgoInitial', tutorEgoInitial)
    .addNode('tutorSuperegoReview', tutorSuperegoReview)
    .addNode('constraintCheck', constraintCheck)
    .addNode('tutorEgoRevision', tutorEgoRevision)
    .addNode('tutorEmit', tutorEmit)
    .addNode('learnerTurn', learnerTurn)
    .addEdge(START, 'learnerProfileUpdate')
    .addEdge('learnerProfileUpdate', 'tutorEgoInitial')
    .addEdge('tutorEgoInitial', 'tutorSuperegoReview')
    .addEdge('tutorSuperegoReview', 'constraintCheck')
    .addConditionalEdges('constraintCheck', routeAfterConstraint, ['tutorEgoRevision', 'tutorEmit'])
    .addEdge('tutorEgoRevision', 'tutorEmit')
    .addEdge('tutorEmit', 'learnerTurn')
    .addConditionalEdges('learnerTurn', routeAfterLearner, ['learnerProfileUpdate', END]);
}
