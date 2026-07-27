import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  tutorStubDominantPlainPolicySignals,
  tutorStubDisplayDiagnosticLabel,
  tutorStubPlainList,
  tutorStubPlainPolicyLabel,
  tutorStubPlainPolicySignal,
  tutorStubPlainResponseCheckArea,
  tutorStubPlainResponseCheckSummary,
  tutorStubPlainSettingName,
  tutorStubPlainStrategyText,
  tutorStubResponseCheckTriggerAreas,
  tutorStubResponseMetadataLine,
} from '../services/tutorStubResponseDetails.js';

test('diagnostic labels and plain lists preserve the CLI human-readable text contract', () => {
  assert.equal(tutorStubDisplayDiagnosticLabel('  clarify_distinction--now  '), 'clarify distinction now');
  assert.equal(tutorStubDisplayDiagnosticLabel(null), '');
  assert.equal(tutorStubPlainList([]), '');
  assert.equal(tutorStubPlainList(['one']), 'one');
  assert.equal(tutorStubPlainList(['one', 'two']), 'one and two');
  assert.equal(tutorStubPlainList(['one', 'two', 'one', '', ' three ']), 'one, two, and three');
});

test('response-check and setting labels retain authored mappings and readable fallback labels', () => {
  assert.equal(tutorStubPlainResponseCheckArea('leak'), 'protecting unreleased answers or evidence');
  assert.equal(tutorStubPlainResponseCheckArea('human_scaffold'), 'not repeating an already answered question');
  assert.equal(tutorStubPlainResponseCheckArea('question_support'), 'asking only from information already available');
  assert.equal(tutorStubPlainResponseCheckArea('dramatic_release'), 'bringing the new clue into the scene clearly');
  assert.equal(
    tutorStubPlainResponseCheckArea('actorial_realization'),
    'making the selected character and teaching style visible',
  );
  assert.equal(
    tutorStubPlainResponseCheckArea('response_composition'),
    'responding to the learner before developing the scene',
  );
  assert.equal(tutorStubPlainResponseCheckArea('repetition'), 'avoiding repeated wording or questions');
  assert.equal(tutorStubPlainResponseCheckArea('dialogue_closure'), 'ending the conversation clearly');
  assert.equal(tutorStubPlainResponseCheckArea('custom_guard'), 'custom guard');

  assert.equal(tutorStubPlainSettingName('tutorModelRef'), 'tutor model');
  assert.equal(tutorStubPlainSettingName('classifierModelRef'), 'learner interpretation model');
  assert.equal(tutorStubPlainSettingName('learnerRecordModelRef'), 'learner reasoning model');
  assert.equal(tutorStubPlainSettingName('autoLearnerModelRef'), 'learner voice model');
  assert.equal(tutorStubPlainSettingName('allModelsOverrideRef'), 'one model for all roles');
  assert.equal(tutorStubPlainSettingName('learner_interpretation_model'), 'learner interpretation model');
  assert.equal(tutorStubPlainSettingName('learner_reasoning_model'), 'learner reasoning model');
  assert.equal(tutorStubPlainSettingName('learner_voice_model'), 'learner voice model');
  assert.equal(tutorStubPlainSettingName('engagementStanceTemperature'), 'teaching-style range');
  assert.equal(tutorStubPlainSettingName('dagFactDropoutRate'), 'evidence-memory dropout');
  assert.equal(tutorStubPlainSettingName('releaseSpeed'), 'clue release speed');
  assert.equal(tutorStubPlainSettingName('clue_release_speed'), 'clue release speed');
  assert.equal(tutorStubPlainSettingName('trainingReuseEnabled'), 'training reuse');
  assert.equal(tutorStubPlainSettingName('training_reuse'), 'training reuse');
  assert.equal(tutorStubPlainSettingName('registerPolicy'), 'teaching approach');
  assert.equal(tutorStubPlainSettingName('registerOverlays'), 'turn/conversation overrides');
  assert.equal(tutorStubPlainSettingName('registerOverlayThreshold'), 'override sensitivity');
  assert.equal(tutorStubPlainSettingName('new_setting'), 'new setting');
});

test('teaching-policy labels retain every authored mapping and the readable fallback', () => {
  assert.deepEqual(
    Object.fromEntries(
      [
        'continuous_dynamical_system',
        'continuous_empirical_dynamical_system',
        'dynamical_system',
        'empirical_dynamical_system',
        'trajectory',
        'field',
        'state',
        'dynamic',
        'bland',
        'random',
        'negative',
      ].map((policy) => [policy, tutorStubPlainPolicyLabel(policy)]),
    ),
    {
      continuous_dynamical_system: 'continuous adaptive blend',
      continuous_empirical_dynamical_system: 'continuous adaptive blend with cross-run evidence',
      dynamical_system: 'adaptive weighted choice',
      empirical_dynamical_system: 'adaptive weighted choice with cross-run evidence',
      trajectory: 'trajectory-aware choice',
      field: 'current interaction-state choice',
      state: 'classifier and reasoning-state choice',
      dynamic: 'model-reviewed adaptive choice',
      bland: 'fixed plain baseline',
      random: 'random control',
      negative: 'negative-register control',
    },
  );
  assert.equal(tutorStubPlainPolicyLabel('new_policy'), 'new policy');
  assert.equal(tutorStubPlainPolicyLabel(null), 'unknown policy');
});

test('policy-signal vocabulary retains every authored learner-facing explanation', () => {
  assert.deepEqual(
    Object.fromEntries(
      [
        'evidence_gap',
        'warrant_gap',
        'agency_deficit',
        'affective_risk',
        'recognition_pressure',
        'coercion_risk',
        'integration_need',
        'compression_need',
        'language_opacity',
        'momentum',
        'stagnation',
        'disruption_need',
        'tempo_affordance',
        'closure_pressure',
        'field_regression',
        'empirical_uncertainty',
        'learner_acceleration',
      ].map((axis) => [axis, tutorStubPlainPolicySignal(axis)]),
    ),
    {
      evidence_gap: 'the learner still needs public evidence',
      warrant_gap: 'a reasoning link is missing',
      agency_deficit: 'the learner needs more ownership of the next move',
      affective_risk: 'the learner may feel exposed or pressured',
      recognition_pressure: 'the response should acknowledge the learner’s independence',
      coercion_risk: 'the tutor should avoid forcing agreement',
      integration_need: 'the learner needs help connecting the pieces',
      compression_need: 'the next move should be simpler and shorter',
      language_opacity: 'the learner has encountered unclear or unfamiliar wording',
      momentum: 'the dialogue has useful forward movement',
      stagnation: 'the dialogue risks stalling',
      disruption_need: 'the current pattern needs a gentle interruption',
      tempo_affordance: 'the learner appears ready to move faster',
      closure_pressure: 'the dialogue is nearing a conclusion',
      field_regression: 'the learner’s engagement has slipped',
      empirical_uncertainty: 'there is little evidence yet about which style works best here',
      learner_acceleration: 'the learner supplied several warranted steps at once',
    },
  );
  assert.equal(tutorStubPlainPolicySignal('new_axis'), 'new axis');
  assert.equal(tutorStubPlainPolicySignal(null), '');
});

test('dominant policy signals retain threshold, numeric coercion, order, limit, and immutability', () => {
  const selection = Object.freeze({
    dynamical_system_policy: Object.freeze({
      state_vector: Object.freeze({
        evidence_gap: 0.61,
        learner_acceleration: '0.9',
        momentum: 0.15,
        new_axis: 0.4,
        ignored_nan: 'not-a-number',
        closure_pressure: 0.33,
      }),
    }),
  });
  const before = structuredClone(selection);

  assert.deepEqual(tutorStubDominantPlainPolicySignals(selection), [
    'the learner supplied several warranted steps at once',
    'the learner still needs public evidence',
    'new axis',
  ]);
  assert.deepEqual(tutorStubDominantPlainPolicySignals(selection, { limit: 2 }), [
    'the learner supplied several warranted steps at once',
    'the learner still needs public evidence',
  ]);
  assert.deepEqual(tutorStubDominantPlainPolicySignals(null), []);
  assert.deepEqual(selection, before);
});

test('strategy text removes internal tutoring jargon in the original replacement order', () => {
  assert.equal(
    tutorStubPlainStrategyText(
      'The learner-DAG carries a proof-state PUBLIC PREMISE in the learner-owned record; avoid low-agency compliance and ask for a learner-owned public move without coercion pressure before the FINAL SECRET. A DAG remains internal.',
    ),
    'The learner’s reasoning carries a reasoning piece of public evidence in the learner’s stated reasoning; avoid passive agreement and ask for a response in the learner’s own words without pressure to agree before the final conclusion. A reasoning map remains internal.',
  );
  assert.equal(tutorStubPlainStrategyText(null), '');
});

test('response-check summaries deduplicate trigger areas and distinguish repaired drafts from fallback', () => {
  const turn = {
    tutorResponseRepaired: true,
    tutorGuardAccounting: {
      repairsApplied: [
        { triggeredBy: [{ guard: 'leak' }, { guard: 'repetition' }] },
        { triggeredBy: [{ guard: 'leak' }, { guard: 'question_support' }] },
      ],
    },
  };
  const before = structuredClone(turn);

  assert.deepEqual(tutorStubResponseCheckTriggerAreas(turn), [
    'protecting unreleased answers or evidence',
    'avoiding repeated wording or questions',
    'asking only from information already available',
  ]);
  assert.equal(
    tutorStubPlainResponseCheckSummary(turn),
    'The first draft needed revision for protecting unreleased answers or evidence, avoiding repeated wording or questions, and asking only from information already available. It was rewritten and rechecked before display.',
  );
  assert.equal(
    tutorStubPlainResponseCheckSummary({ ...turn, tutorDeterministicFallback: true }),
    'The first two drafts needed revision for protecting unreleased answers or evidence, avoiding repeated wording or questions, and asking only from information already available, so a safe fallback was shown instead.',
  );
  assert.equal(tutorStubPlainResponseCheckSummary({}), null);
  assert.deepEqual(turn, before);
});

test('response metadata preserves token, cost, effort, guard, and stream precedence', () => {
  assert.equal(
    tutorStubResponseMetadataLine({
      provider: 'openai',
      model: 'mini',
      usage: { inputTokens: 1200, outputTokens: 34, cost: 0.0012 },
      effort: 'low',
      deterministicFallback: true,
      repaired: true,
      streamed: true,
    }),
    'openai/mini, 0ms, 1,234 tokens, $0.001200, effort low, safe fallback used, streamed',
  );
});

test('response metadata preserves the complete response-details ordering and wording', () => {
  const meta = {
    provider: 'codex',
    model: 'gpt-5.6-terra',
    latencyMs: 275,
    tokenUsageAvailable: false,
    reasoningEffort: 'medium',
    registerSelection: {
      selected_register: 'warm-socratic',
      response_configuration: {
        action_family: 'clarify_distinction',
        actorial_part_label: 'adversarial_schoolmaster',
        actorial_performance: { label: 'rapid_evidence_handoff' },
      },
      random_performance: { enabled: true },
      light_adaptation: { triggered: true },
      performance_directives: {
        register: { applied: true },
        character: { applied: true },
      },
    },
    releasePacing: { direction: 'accelerate', effectiveSpeed: 1.75, releasedNow: ['p1'] },
    repaired: true,
    guardedStreamReplay: true,
    streamed: true,
    speculativeCacheHit: true,
    tutorRef: 'codex.gpt',
  };
  const before = structuredClone(meta);

  assert.equal(
    tutorStubResponseMetadataLine(meta),
    'codex/gpt-5.6-terra, 275ms, tokens unavailable, effort medium, style warm socratic, move clarify distinction, character adversarial schoolmaster, performance rapid evidence handoff, random performance, light shift, style directed, character directed, clue pace faster 1.75x; 1 new clue, response revised, checked before display, prefetched response, tutor codex.gpt',
  );
  assert.deepEqual(meta, before);
});

test('tutor-stub imports the shared response-detail helpers and retains no local copies', () => {
  const source = fs.readFileSync('scripts/tutor-stub.js', 'utf8');
  assert.match(source, /services\/tutorStubResponseDetails\.js/u);
  assert.doesNotMatch(source, /function displayDiagnosticLabel\s*\(/u);
  assert.doesNotMatch(source, /function plainList\s*\(/u);
  assert.doesNotMatch(source, /function plainResponseCheckArea\s*\(/u);
  assert.doesNotMatch(source, /function plainSettingName\s*\(/u);
  assert.doesNotMatch(source, /function plainPolicyLabel\s*\(/u);
  assert.doesNotMatch(source, /function plainPolicySignal\s*\(/u);
  assert.doesNotMatch(source, /function dominantPlainPolicySignals\s*\(/u);
  assert.doesNotMatch(source, /function plainStrategyText\s*\(/u);
  assert.doesNotMatch(source, /function responseCheckTriggerAreas\s*\(/u);
  assert.doesNotMatch(source, /function plainResponseCheckSummary\s*\(/u);
  assert.doesNotMatch(source, /function metadataLine\s*\(/u);
});
