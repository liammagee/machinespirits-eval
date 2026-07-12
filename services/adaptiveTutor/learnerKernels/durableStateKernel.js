import {
  ADAPTIVE_STATE_LEARNER_KERNEL_SCHEMA,
  buildKernelForecast,
  cloneKernelValue,
  deterministicKernelUnit,
  executeKernelTransition,
  kernelImplementationMetadata,
} from './contract.js';

export const DURABLE_OWNERSHIP_STATE_SCHEMA = 'machinespirits.adaptive-state-durable-ownership-state.v2';

const SOURCE = 'services/adaptiveTutor/learnerKernels/durableStateKernel.js';
const DEPENDENCIES = [
  'services/adaptiveTutor/learnerKernels/contract.js',
  'services/adaptiveTutor/learnerKernels/worldAdapter.js',
  'services/dramaticDerivation/chainer.js',
  'services/dramaticDerivation/slope.js',
  'services/dramaticDerivation/world.js',
];

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function round6(value) {
  return Number(Number(value).toFixed(6));
}

function publicCues(state) {
  return {
    ownership: state.ownership_level >= 0.67 ? 'high' : state.ownership_level >= 0.4 ? 'medium' : 'low',
    confidence: state.confidence >= 0.67 ? 'high' : state.confidence >= 0.4 ? 'medium' : 'low',
    engagement: state.engagement >= 0.67 ? 'engaged' : state.engagement >= 0.4 ? 'strained' : 'aporia',
    misconception_active: state.active_misconception,
  };
}

function validateState(state) {
  if (state?.schema !== DURABLE_OWNERSHIP_STATE_SCHEMA) {
    throw new Error('durableStateKernel: invalid durable ownership state');
  }
  for (const key of ['ownership_level', 'confidence', 'engagement']) {
    if (!Number.isFinite(Number(state[key])) || Number(state[key]) < 0 || Number(state[key]) > 1) {
      throw new Error(`durableStateKernel: ${key} must be in [0, 1]`);
    }
  }
  return state;
}

function nextStateForEvent(adapter, state, event, changes = {}) {
  const next = cloneKernelValue(state);
  next.step += 1;
  next.proof = adapter.applyEvent(next.proof, event);
  Object.assign(next, changes);
  next.ownership_level = round6(clamp01(next.ownership_level));
  next.confidence = round6(clamp01(next.confidence));
  next.engagement = round6(clamp01(next.engagement));
  next.public_cues = publicCues(next);
  return validateState(next);
}

function branch(id, probability, event, nextState) {
  return { id, probability: round6(probability), event, next_state: nextState };
}

function twoWayBranches({ successId, successProbability, successEvent, successState, failureEvent, failureState }) {
  const p = round6(clamp01(successProbability));
  return [
    branch(successId, p, successEvent, successState),
    branch('no_public_move', round6(1 - p), failureEvent, failureState),
  ];
}

function enumerateMinimalHint({ adapter, state }) {
  const challenge = adapter.nextChallengePremiseId(state.proof);
  if (!challenge) {
    const derived = adapter.nextDerivableFact(state.proof);
    if (!derived) {
      const event = adapter.noneEvent({ semanticRole: 'support_without_new_public_move' });
      return [
        branch(
          'support_stall',
          1,
          event,
          nextStateForEvent(adapter, state, event, { confidence: state.confidence + 0.02 }),
        ),
      ];
    }
    const probability = 0.28 + state.ownership_level * 0.32;
    const successEvent = adapter.deriveEvent(derived);
    const failureEvent = adapter.noneEvent({ semanticRole: 'hint_not_converted_to_inference' });
    return twoWayBranches({
      successId: 'derive_after_hint',
      successProbability: probability,
      successEvent,
      successState: nextStateForEvent(adapter, state, successEvent, {
        ownership_level: state.ownership_level + 0.1,
        confidence: state.confidence + 0.08,
      }),
      failureEvent,
      failureState: nextStateForEvent(adapter, state, failureEvent, { engagement: state.engagement - 0.04 }),
    });
  }
  const probability = 0.38 + state.ownership_level * 0.34 + state.confidence * 0.12;
  const successEvent = adapter.adoptEvent(challenge, { releasePremiseId: challenge });
  const failureEvent = adapter.noneEvent({
    releasePremiseId: challenge,
    semanticRole: 'new_public_evidence_not_yet_adopted',
  });
  return twoWayBranches({
    successId: 'adopt_released_frontier',
    successProbability: probability,
    successEvent,
    successState: nextStateForEvent(adapter, state, successEvent, {
      ownership_level: state.ownership_level + 0.06,
      confidence: state.confidence + 0.08,
    }),
    failureEvent,
    failureState: nextStateForEvent(adapter, state, failureEvent, {
      engagement: state.engagement - 0.04,
      confidence: state.confidence - 0.03,
    }),
  });
}

function enumerateRequestEvidence({ adapter, state }) {
  const released = adapter.nextReleasedUnheldPremiseId(state.proof);
  if (released) {
    const probability = 0.32 + state.ownership_level * 0.46 + state.engagement * 0.1;
    const successEvent = adapter.adoptEvent(released);
    const failureEvent = adapter.noneEvent({ semanticRole: 'released_evidence_not_owned' });
    return twoWayBranches({
      successId: 'adopt_after_evidence_request',
      successProbability: probability,
      successEvent,
      successState: nextStateForEvent(adapter, state, successEvent, {
        ownership_level: state.ownership_level + 0.12,
        confidence: state.confidence + 0.06,
      }),
      failureEvent,
      failureState: nextStateForEvent(adapter, state, failureEvent, { engagement: state.engagement - 0.05 }),
    });
  }
  const derived = adapter.nextDerivableFact(state.proof);
  if (derived) {
    const probability = 0.3 + state.ownership_level * 0.48 + state.confidence * 0.1;
    const successEvent = adapter.deriveEvent(derived);
    const failureEvent = adapter.noneEvent({ semanticRole: 'rationale_requested_without_public_inference' });
    return twoWayBranches({
      successId: 'derive_owned_rationale',
      successProbability: probability,
      successEvent,
      successState: nextStateForEvent(adapter, state, successEvent, {
        ownership_level: state.ownership_level + 0.14,
        confidence: state.confidence + 0.1,
        active_misconception: false,
      }),
      failureEvent,
      failureState: nextStateForEvent(adapter, state, failureEvent, { confidence: state.confidence - 0.04 }),
    });
  }
  if (state.active_misconception) {
    const probability = 0.24 + (1 - state.confidence) * 0.26 + state.ownership_level * 0.12;
    const successEvent = adapter.retractHypothesisEvent();
    const failureEvent = adapter.noneEvent({ semanticRole: 'unsupported_hypothesis_persists' });
    return twoWayBranches({
      successId: 'retract_unsupported_hypothesis',
      successProbability: probability,
      successEvent,
      successState: nextStateForEvent(adapter, state, successEvent, {
        active_misconception: false,
        ownership_level: state.ownership_level + 0.08,
        confidence: state.confidence - 0.03,
      }),
      failureEvent,
      failureState: nextStateForEvent(adapter, state, failureEvent, { engagement: state.engagement - 0.04 }),
    });
  }
  const event = adapter.noneEvent({ semanticRole: 'evidence_request_after_available_moves_exhausted' });
  return [
    branch(
      'evidence_stall',
      1,
      event,
      nextStateForEvent(adapter, state, event, { confidence: state.confidence + 0.01 }),
    ),
  ];
}

function enumerateDiagnostic({ adapter, state }) {
  if (state.active_misconception) {
    const probability = 0.2 + (1 - state.confidence) * 0.25 + state.ownership_level * 0.08;
    const successEvent = adapter.retractHypothesisEvent();
    const debtDelta = state.diagnostic_count >= 1 ? 1 : 0;
    const failureEvent = adapter.noneEvent({
      harmfulDebtDelta: debtDelta,
      semanticRole: debtDelta ? 'repeated_diagnostic_without_progress' : 'diagnostic_without_public_resolution',
    });
    return twoWayBranches({
      successId: 'diagnostic_retraction',
      successProbability: probability,
      successEvent,
      successState: nextStateForEvent(adapter, state, successEvent, {
        active_misconception: false,
        diagnostic_count: state.diagnostic_count + 1,
        ownership_level: state.ownership_level + 0.07,
      }),
      failureEvent,
      failureState: nextStateForEvent(adapter, state, failureEvent, {
        diagnostic_count: state.diagnostic_count + 1,
        engagement: state.engagement - (debtDelta ? 0.12 : 0.06),
      }),
    });
  }
  const derived = adapter.nextDerivableFact(state.proof);
  if (derived) {
    const probability = 0.12 + state.ownership_level * 0.25;
    const successEvent = adapter.deriveEvent(derived);
    const failureEvent = adapter.noneEvent({ semanticRole: 'diagnostic_state_report_only' });
    return twoWayBranches({
      successId: 'diagnostic_derive',
      successProbability: probability,
      successEvent,
      successState: nextStateForEvent(adapter, state, successEvent, {
        diagnostic_count: state.diagnostic_count + 1,
        confidence: state.confidence + 0.04,
      }),
      failureEvent,
      failureState: nextStateForEvent(adapter, state, failureEvent, {
        diagnostic_count: state.diagnostic_count + 1,
        engagement: state.engagement - 0.05,
      }),
    });
  }
  const event = adapter.noneEvent({
    harmfulDebtDelta: state.diagnostic_count >= 1 ? 1 : 0,
    semanticRole: 'diagnostic_without_state_change',
  });
  return [
    branch(
      'diagnostic_stall',
      1,
      event,
      nextStateForEvent(adapter, state, event, {
        diagnostic_count: state.diagnostic_count + 1,
        engagement: state.engagement - 0.06,
      }),
    ),
  ];
}

const metadata = kernelImplementationMetadata(import.meta.url, { source: SOURCE, dependencies: DEPENDENCIES });

export const durableOwnershipKernel = Object.freeze({
  schema: ADAPTIVE_STATE_LEARNER_KERNEL_SCHEMA,
  version: '2.0',
  id: 'durable_state',
  family: 'a21_durable_state_transition_kernel_v2',
  state_schema: DURABLE_OWNERSHIP_STATE_SCHEMA,
  metadata,
  initialize({ adapter, seed }) {
    const ownership = 0.28 + deterministicKernelUnit(seed, `${adapter.id}:durable:ownership`) * 0.48;
    const confidence = 0.25 + deterministicKernelUnit(seed, `${adapter.id}:durable:confidence`) * 0.5;
    const engagement = 0.52 + deterministicKernelUnit(seed, `${adapter.id}:durable:engagement`) * 0.4;
    const state = {
      schema: DURABLE_OWNERSHIP_STATE_SCHEMA,
      generator_id: 'durable_state',
      step: 0,
      proof: adapter.initialHiddenProofState(),
      ownership_level: round6(ownership),
      confidence: round6(confidence),
      engagement: round6(engagement),
      diagnostic_count: 0,
      active_misconception: deterministicKernelUnit(seed, `${adapter.id}:durable:misconception`) < 0.6,
      public_cues: {},
    };
    state.public_cues = publicCues(state);
    return validateState(state);
  },
  enumerateTransitions({ adapter, state, action_type }) {
    validateState(state);
    if (action_type === 'minimal_hint') return enumerateMinimalHint({ adapter, state });
    if (action_type === 'request_evidence') return enumerateRequestEvidence({ adapter, state });
    return enumerateDiagnostic({ adapter, state });
  },
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
