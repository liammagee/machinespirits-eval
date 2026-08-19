import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginTutorStubActionBeforeRegisterShadow,
  completeTutorStubActionBeforeRegisterShadow,
  finalizeTutorStubActionBeforeRegisterShadow,
  normalizeTutorStubResponseConfigurationWithActionBeforeRegisterShadow,
} from '../services/tutorStubActionBeforeRegisterShadow.js';

function classification(overrides = {}) {
  return {
    turn: {
      request_type: 'resistance_or_low_agency',
      discourse_move: 'challenge',
      evidence_use: 'none',
      epistemic_stance: 'resistant',
      agency: 'steering',
      ...overrides,
    },
    overall: {},
  };
}

function state({ enabled = true } = {}) {
  return {
    turns: [],
    world: null,
    releasePacing: null,
    comprehension: { terms: [], lastRequest: null, history: [] },
    register: {
      enabled,
      policy: 'dynamic',
      overlays: [],
      history: [],
      current: null,
    },
  };
}

function selectionFor(shadow, { register = 'plain', policy = 'dynamic', actionFamily = 'challenge_resistance' } = {}) {
  return {
    turn: 1,
    policy,
    primary_policy: policy,
    activated_policy: policy,
    overlay_policies: [],
    engagement_stance: register,
    selected_register: register,
    action_family: actionFamily,
    response_configuration: {
      engagement_stance: register,
      action_family: actionFamily,
    },
    action_before_register_shadow: shadow,
  };
}

test('the typed shadow decision executes before the legacy register normalizer without mutating its output', () => {
  const runtimeState = state();
  const order = [];
  const comprehension = runtimeState.comprehension;
  Object.defineProperty(runtimeState, 'comprehension', {
    configurable: true,
    get() {
      order.push('typed_move');
      return comprehension;
    },
  });
  const raw = { engagement_stance: 'warm' };
  const normalized = {
    turn: 1,
    engagement_stance: 'warm',
    action_family: 'challenge_resistance',
    response_configuration: { engagement_stance: 'warm', action_family: 'challenge_resistance' },
  };
  const frozenNormalized = structuredClone(normalized);
  const result = normalizeTutorStubResponseConfigurationWithActionBeforeRegisterShadow(
    (_raw, context) => {
      order.push('register');
      context.state.register.history.push(normalized);
      context.state.register.current = normalized;
      return normalized;
    },
    raw,
    {
      state: runtimeState,
      classification: classification(),
      tutorLearnerDag: { model: { turn: 1, assessment: {} } },
      raw: null,
      learnerText: 'Fine. Same mark, I suppose.',
    },
  );

  assert.deepEqual(order.slice(0, 2), ['typed_move', 'register']);
  assert.deepEqual(normalized, frozenNormalized);
  assert.deepEqual(result.response_configuration, frozenNormalized.response_configuration);
  assert.equal(result.action_before_register_shadow.shadow_move_candidate.move_type, 'ask_discriminating_question');
  assert.equal(Object.hasOwn(result.action_before_register_shadow.shadow_move_candidate, 'register'), false);
  assert.equal(runtimeState.register.current, result);
  assert.equal(runtimeState.register.history.at(-1), result);
});

test('held-out public axes preserve broad frame defiance while exposing the nested refusal opportunity', () => {
  const bored = beginTutorStubActionBeforeRegisterShadow({
    state: state(),
    classification: classification(),
    tutorLearnerDag: { model: { turn: 1, assessment: {} } },
    learnerText: 'Fine. Same mark, I suppose.',
  });
  assert.equal(bored.resistance_axis_shadow.profile_identity_used, false);
  assert.equal(bored.resistance_axis_shadow.warrant.status, 'licensed');
  assert.equal(bored.shadow_move_candidate.move_type, 'ask_discriminating_question');

  const frame = beginTutorStubActionBeforeRegisterShadow({
    state: state(),
    classification: classification({ request_type: 'authority_refusal_or_status_challenge' }),
    tutorLearnerDag: { model: { turn: 1, assessment: {} } },
    learnerText: 'I do not accept the premise of your test.',
  });
  assert.equal(frame.resistance_axis_shadow.warrant.status, 'licensed');
  assert.equal(frame.resistance_axis_shadow.resistance_kind, 'frame_defiant');
  assert.equal(
    frame.resistance_axis_shadow.observation.axes.frame_participation.state,
    'local_test_refused_without_uptake',
  );
  assert.equal(frame.shadow_move_candidate.move_type, 'test_bounded_distinction');

  const productiveFrame = beginTutorStubActionBeforeRegisterShadow({
    state: state(),
    classification: classification({
      request_type: 'authority_refusal_or_status_challenge',
      discourse_move: 'hypothesis',
      evidence_use: 'links_evidence_to_rule',
    }),
    tutorLearnerDag: { model: { turn: 1, assessment: {} } },
    learnerText:
      'I reject the frame, but the public assay still supports testing whether this mark came from the same die.',
  });
  assert.equal(productiveFrame.resistance_axis_shadow.warrant.status, 'licensed');
  assert.equal(productiveFrame.resistance_axis_shadow.resistance_kind, 'frame_defiant');
  assert.equal(productiveFrame.resistance_axis_shadow.observation.axes.frame_participation.state, 'not_observed');
  assert.equal(productiveFrame.shadow_move_candidate.move_type, 'test_bounded_distinction');

  const ambiguous = beginTutorStubActionBeforeRegisterShadow({
    state: state(),
    classification: classification(),
    tutorLearnerDag: { model: { turn: 1, assessment: {} } },
    learnerText: 'Whatever. I reject the premise of this exercise.',
  });
  assert.equal(ambiguous.resistance_axis_shadow.warrant.status, 'not_licensed');
  assert.equal(ambiguous.resistance_axis_shadow.warrant.ambiguity_blocks_license, true);
  assert.equal(ambiguous.shadow_move_source, 'legacy_action_family_projection');
});

test('negative registers are opt-in, move-specific, and suppressed under protected conditions', () => {
  const boredShadow = beginTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    classification: classification(),
    learnerText: 'Fine. Same mark, I suppose.',
  });
  const unlicensedSarcasm = finalizeTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    selection: selectionFor(boredShadow, { register: 'sarcastic' }),
    learnerText: 'Fine. Same mark, I suppose.',
    classification: classification(),
  });
  assert.equal(unlicensedSarcasm.action_before_register_shadow.finalization.register_compatibility.compatible, false);
  assert.equal(
    unlicensedSarcasm.action_before_register_shadow.finalization.register_compatibility.reason,
    'edged_register_requires_explicit_opt_in',
  );

  const licensedSarcasm = finalizeTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    selection: selectionFor(boredShadow, { register: 'sarcastic', policy: 'negative' }),
    learnerText: 'Fine. Same mark, I suppose.',
    classification: classification(),
  });
  assert.equal(licensedSarcasm.action_before_register_shadow.finalization.register_compatibility.compatible, true);
  assert.equal(
    licensedSarcasm.action_before_register_shadow.finalization.register_compatibility.reason,
    'experimental_bored_sarcasm_pair',
  );

  const wrongEdge = finalizeTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    selection: selectionFor(boredShadow, { register: 'ironic', policy: 'negative' }),
    learnerText: 'Fine. Same mark, I suppose.',
    classification: classification(),
  });
  assert.equal(wrongEdge.action_before_register_shadow.finalization.register_compatibility.compatible, false);

  const comprehensionSuppression = finalizeTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    selection: selectionFor(boredShadow, { register: 'sarcastic', policy: 'negative' }),
    learnerText: 'Fine. Same mark. Can you say that in simpler words?',
    classification: classification({ request_type: 'plain_language_request' }),
  });
  assert.equal(
    comprehensionSuppression.action_before_register_shadow.finalization.register_compatibility.reason,
    'comprehension_repair_suppresses_register',
  );

  const affectSuppression = finalizeTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    selection: selectionFor(boredShadow, { register: 'sarcastic', policy: 'negative' }),
    learnerText: 'Fine. I am ashamed and overwhelmed.',
    classification: classification({ request_type: 'vulnerability_or_moral_exposure' }),
  });
  assert.equal(
    affectSuppression.action_before_register_shadow.finalization.register_compatibility.reason,
    'protected_affect_suppresses_register',
  );

  const uptakeSuppression = finalizeTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    selection: selectionFor(boredShadow, { register: 'sarcastic', policy: 'negative' }),
    learnerText: 'Now I see why the same mark matters.',
    classification: classification({ agency: 'steering', evidence_use: 'links_evidence_to_rule' }),
    tutorLearnerDag: { advance: { supportedMoveCount: 1 } },
  });
  assert.equal(
    uptakeSuppression.action_before_register_shadow.finalization.register_compatibility.reason,
    'uptake_suppresses_edged_register',
  );
});

test('frame defiance retains experimental irony while content-bearing defiance closes the edge', () => {
  const shadow = beginTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    classification: classification({ request_type: 'authority_refusal_or_status_challenge' }),
    learnerText: 'I do not accept the premise of your test.',
  });
  const finalized = finalizeTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    selection: selectionFor(shadow, {
      register: 'ironic',
      policy: 'negative',
      actionFamily: 'answer_accountably',
    }),
    learnerText: 'I do not accept the premise of your test.',
    classification: classification({ request_type: 'authority_refusal_or_status_challenge' }),
  });
  const record = finalized.action_before_register_shadow;
  assert.equal(record.resistance_axis_shadow.resistance_kind, 'frame_defiant');
  assert.equal(record.finalization.register_compatibility.compatible, true);
  assert.equal(record.finalization.register_compatibility.reason, 'experimental_frame_irony_pair');
  assert.equal(record.finalization.legacy_action_changed_after_pre_register, false);

  const productiveClassification = classification({
    request_type: 'authority_refusal_or_status_challenge',
    discourse_move: 'hypothesis',
    evidence_use: 'links_evidence_to_rule',
  });
  const productiveText =
    'I reject the frame, but the public assay still supports testing whether this mark came from the same die.';
  const productiveShadow = beginTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    classification: productiveClassification,
    learnerText: productiveText,
  });
  const productiveFinalized = finalizeTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    selection: selectionFor(productiveShadow, { register: 'ironic', policy: 'negative' }),
    learnerText: productiveText,
    classification: productiveClassification,
  });
  assert.equal(productiveShadow.resistance_axis_shadow.resistance_kind, 'frame_defiant');
  assert.equal(
    productiveFinalized.action_before_register_shadow.finalization.register_compatibility.reason,
    'uptake_suppresses_edged_register',
  );

  const overridden = finalizeTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    selection: selectionFor(shadow, {
      register: 'plain',
      actionFamily: 'close_inquiry',
    }),
    learnerText: 'I do not accept the premise of your test.',
    classification: classification({ request_type: 'authority_refusal_or_status_challenge' }),
  });
  assert.equal(overridden.action_before_register_shadow.finalization.legacy_action_changed_after_pre_register, true);
  assert.equal(overridden.action_before_register_shadow.authority, 'legacy_response_configuration');
  assert.equal(overridden.action_before_register_shadow.consumer_switch_authorized, false);
});

test('public realization records the delivered legacy pair without claiming a shadow-only candidate was delivered', () => {
  const shadow = beginTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    classification: classification(),
    learnerText: 'Fine. Same mark, I suppose.',
  });
  const finalized = finalizeTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    selection: selectionFor(shadow, { register: 'plain', actionFamily: 'challenge_resistance' }),
    learnerText: 'Fine. Same mark, I suppose.',
    classification: classification(),
  });
  const completed = completeTutorStubActionBeforeRegisterShadow({
    state: state({ enabled: false }),
    selection: finalized,
    deliveredConfiguration: { action_family: 'challenge_resistance', engagement_stance: 'plain' },
    responseConfigurationAudit: {
      axes: {
        action_family: { visible: true },
        engagement_stance: { visible: true },
      },
    },
  });
  const realization = completed.action_before_register_shadow.realization;
  assert.equal(realization.legacy_pair_visible, true);
  assert.equal(realization.shadow_candidate_matches_delivered_legacy, false);
  assert.equal(realization.shadow_candidate_delivery_status, 'shadow_only_not_delivered');
  assert.equal(realization.outcome_claim_authorized, false);
  assert.equal(completed.action_before_register_shadow.ordering.public_realization_observed, true);
});
