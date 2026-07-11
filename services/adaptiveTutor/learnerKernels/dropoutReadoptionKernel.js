import { factKey } from '../../dramaticDerivation/chainer.js';
import {
  applyTutorStubDagFactDropout,
  createTutorStubDagFactDropoutState,
  tutorStubDagFactDropoutSnapshot,
} from '../../tutorStubDagFactDropout.js';
import {
  ADAPTIVE_STATE_LEARNER_KERNEL_SCHEMA,
  buildKernelForecast,
  cloneKernelValue,
  deterministicKernelUnit,
  executeKernelTransition,
  kernelImplementationMetadata,
} from './contract.js';

export const DROPOUT_READOPTION_STATE_SCHEMA = 'machinespirits.adaptive-state-dropout-readoption-state.v2';

const SOURCE = 'services/adaptiveTutor/learnerKernels/dropoutReadoptionKernel.js';
const DEPENDENCIES = [
  'services/adaptiveTutor/learnerKernels/contract.js',
  'services/adaptiveTutor/learnerKernels/worldAdapter.js',
  'services/dramaticDerivation/chainer.js',
  'services/dramaticDerivation/slope.js',
  'services/dramaticDerivation/world.js',
  'services/tutorStubDagFactDropout.js',
];

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function round6(value) {
  return Number(Number(value).toFixed(6));
}

function activeDroppedIds(state) {
  return Object.keys(state.dropout_snapshot?.activeDropped || {}).sort();
}

function publicCues(state) {
  return {
    memory_reliability:
      state.loss_probability >= 0.5 ? 'fragile' : state.loss_probability >= 0.3 ? 'variable' : 'stable',
    active_evidence_loss: activeDroppedIds(state).length > 0,
    readoption_readiness:
      state.readoption_propensity >= 0.67 ? 'high' : state.readoption_propensity >= 0.4 ? 'medium' : 'low',
  };
}

function validateState(state) {
  if (state?.schema !== DROPOUT_READOPTION_STATE_SCHEMA) {
    throw new Error('dropoutReadoptionKernel: invalid dropout/readoption state');
  }
  for (const key of ['loss_probability', 'readoption_propensity']) {
    if (!Number.isFinite(Number(state[key])) || Number(state[key]) < 0 || Number(state[key]) > 1) {
      throw new Error(`dropoutReadoptionKernel: ${key} must be in [0, 1]`);
    }
  }
  createTutorStubDagFactDropoutState({ snapshot: state.dropout_snapshot });
  return state;
}

function initializeDropoutSnapshot(adapter, proof, seed) {
  const context = adapter.internalDropoutContext(proof);
  const dropout = createTutorStubDagFactDropoutState({ rate: 0, seed, graceTurns: 0, maxConcurrent: 1 });
  applyTutorStubDagFactDropout({
    dropout,
    board: context.board,
    world: context.world,
    turn: 0,
    adoptedPremiseIds: context.heldPremiseIds,
  });
  return tutorStubDagFactDropoutSnapshot(dropout);
}

function baseNextState(state) {
  const next = cloneKernelValue(state);
  next.step += 1;
  return next;
}

function finalizeState(state) {
  state.public_cues = publicCues(state);
  return validateState(state);
}

function stateWithSimpleEvent(adapter, state, event) {
  const next = baseNextState(state);
  next.proof = adapter.applyEvent(next.proof, event);
  return finalizeState(next);
}

function stateWithNewAdoption(adapter, state, event, turn) {
  const next = baseNextState(state);
  next.proof = adapter.applyEvent(next.proof, event);
  const context = adapter.internalDropoutContext(next.proof);
  const dropout = createTutorStubDagFactDropoutState({ snapshot: next.dropout_snapshot });
  dropout.rate = 0;
  const outcome = applyTutorStubDagFactDropout({
    dropout,
    board: context.board,
    world: context.world,
    turn,
    adoptedPremiseIds: [event._internal_premise_id],
  });
  next.dropout_snapshot = outcome.after;
  return finalizeState(next);
}

function productionDropBranch(adapter, state, turn) {
  const next = baseNextState(state);
  const context = adapter.internalDropoutContext(next.proof);
  const dropout = createTutorStubDagFactDropoutState({ snapshot: next.dropout_snapshot });
  dropout.rate = 1;
  dropout.graceTurns = 0;
  dropout.maxConcurrent = 1;
  const outcome = applyTutorStubDagFactDropout({
    dropout,
    board: context.board,
    world: context.world,
    turn,
  });
  const dropped = outcome.droppedNow[0];
  if (!dropped) return null;
  const event = adapter.retractPremiseEvent(dropped.premiseId);
  next.proof = adapter.applyEvent(next.proof, event);
  next.dropout_snapshot = outcome.after;
  return { event, next_state: finalizeState(next) };
}

function productionRepairBranch(adapter, state, premiseId, turn) {
  const next = baseNextState(state);
  const context = adapter.internalDropoutContext(next.proof);
  const fact = context.premiseFact(premiseId);
  context.board.set(factKey(fact), fact);
  const dropout = createTutorStubDagFactDropoutState({ snapshot: next.dropout_snapshot });
  dropout.rate = 0;
  const outcome = applyTutorStubDagFactDropout({
    dropout,
    board: context.board,
    world: context.world,
    turn,
    adoptedPremiseIds: [premiseId],
  });
  const event = adapter.adoptEvent(premiseId);
  next.proof = adapter.applyEvent(next.proof, event);
  next.dropout_snapshot = outcome.after;
  return { event, next_state: finalizeState(next) };
}

function branch(id, probability, event, nextState) {
  return { id, probability: round6(probability), event, next_state: nextState };
}

function twoWay({ successId, probability, success, failure }) {
  const p = round6(clamp01(probability));
  return [
    branch(successId, p, success.event, success.next_state),
    branch('no_public_move', round6(1 - p), failure.event, failure.next_state),
  ];
}

function enumerateRepair({ adapter, state, actionType, turn, premiseId }) {
  const actionBoost = actionType === 'minimal_hint' ? 0.2 : actionType === 'request_evidence' ? 0.12 : -0.12;
  const probability = 0.18 + state.readoption_propensity * 0.58 + actionBoost;
  const success = productionRepairBranch(adapter, state, premiseId, turn);
  const failureEvent = adapter.noneEvent({ semanticRole: 'dropped_evidence_not_readopted' });
  return twoWay({
    successId: 'readopt_dropped_evidence',
    probability,
    success,
    failure: { event: failureEvent, next_state: stateWithSimpleEvent(adapter, state, failureEvent) },
  });
}

function enumerateNewEvidence({ adapter, state, actionType, turn, premiseId }) {
  const probability =
    actionType === 'minimal_hint'
      ? 0.42 + state.readoption_propensity * 0.38
      : 0.26 + state.readoption_propensity * 0.32;
  const successEvent = adapter.adoptEvent(premiseId, { releasePremiseId: premiseId });
  const failureEvent = adapter.noneEvent({
    releasePremiseId: premiseId,
    semanticRole: 'released_evidence_not_retained',
  });
  return twoWay({
    successId: 'adopt_new_evidence',
    probability,
    success: { event: successEvent, next_state: stateWithNewAdoption(adapter, state, successEvent, turn) },
    failure: { event: failureEvent, next_state: stateWithSimpleEvent(adapter, state, failureEvent) },
  });
}

function enumerateDerivedOrLoss({ adapter, state, actionType, turn }) {
  const derived = adapter.nextDerivableFact(state.proof);
  const drop = productionDropBranch(adapter, state, turn);
  const deriveProbability = derived
    ? actionType === 'request_evidence'
      ? 0.22 + state.readoption_propensity * 0.3
      : actionType === 'minimal_hint'
        ? 0.12 + state.readoption_propensity * 0.18
        : 0.08 + state.readoption_propensity * 0.12
    : 0;
  const actionLossFactor = actionType === 'diagnose_with_discriminating_question' ? 1 : 0.65;
  const lossProbability = drop ? Math.min(0.72, state.loss_probability * actionLossFactor) : 0;
  const scaledDerive = Math.min(deriveProbability, Math.max(0, 0.9 - lossProbability));
  const branches = [];
  if (derived && scaledDerive > 0) {
    const event = adapter.deriveEvent(derived);
    branches.push(
      branch('derive_from_retained_evidence', scaledDerive, event, stateWithSimpleEvent(adapter, state, event)),
    );
  }
  if (drop && lossProbability > 0) {
    branches.push(branch('memory_dropout', lossProbability, drop.event, drop.next_state));
  }
  const used = branches.reduce((sum, row) => sum + row.probability, 0);
  const event = adapter.noneEvent({ semanticRole: 'retention_without_public_dag_move' });
  branches.push(branch('no_public_move', round6(1 - used), event, stateWithSimpleEvent(adapter, state, event)));
  return branches;
}

function enumerateTransitions({ adapter, state, action_type: actionType, turn }) {
  validateState(state);
  const active = activeDroppedIds(state);
  if (active.length) return enumerateRepair({ adapter, state, actionType, turn, premiseId: active[0] });
  const released = adapter.nextReleasedUnheldPremiseId(state.proof);
  if (released && ['minimal_hint', 'request_evidence'].includes(actionType)) {
    return enumerateNewEvidence({ adapter, state, actionType, turn, premiseId: released });
  }
  const challenge = adapter.nextChallengePremiseId(state.proof);
  if (challenge && actionType === 'minimal_hint') {
    return enumerateNewEvidence({ adapter, state, actionType, turn, premiseId: challenge });
  }
  return enumerateDerivedOrLoss({ adapter, state, actionType, turn });
}

const metadata = kernelImplementationMetadata(import.meta.url, { source: SOURCE, dependencies: DEPENDENCIES });

export const dropoutReadoptionKernel = Object.freeze({
  schema: ADAPTIVE_STATE_LEARNER_KERNEL_SCHEMA,
  version: '2.0',
  id: 'dag_dropout',
  family: 'dag_dropout_readoption_transition_kernel_v2',
  state_schema: DROPOUT_READOPTION_STATE_SCHEMA,
  metadata,
  initialize({ adapter, seed }) {
    const proof = adapter.initialHiddenProofState();
    const state = {
      schema: DROPOUT_READOPTION_STATE_SCHEMA,
      generator_id: 'dag_dropout',
      step: 0,
      proof,
      loss_probability: round6(0.2 + deterministicKernelUnit(seed, `${adapter.id}:dropout:loss`) * 0.42),
      readoption_propensity: round6(0.25 + deterministicKernelUnit(seed, `${adapter.id}:dropout:readoption`) * 0.58),
      dropout_snapshot: initializeDropoutSnapshot(adapter, proof, seed),
      public_cues: {},
    };
    state.public_cues = publicCues(state);
    return validateState(state);
  },
  enumerateTransitions,
  oracleBeforeSample({ adapter, state, action, turn, seed }) {
    return buildKernelForecast({ kernel: this, adapter, state, action, turn, seed });
  },
  transition({ adapter, state, action, turn, seed, forecast = null }) {
    return executeKernelTransition({ kernel: this, adapter, state, action, turn, seed, forecast });
  },
  initialPublicEnvelope({ adapter, state, turn = 1 }) {
    return adapter.initialPublicEnvelope({ kernelId: this.id, state, turn });
  },
  turnRecord({ adapter, turn, learnerText, state, event }) {
    return adapter.turnRecord({ turn, learnerText, state, event });
  },
});
