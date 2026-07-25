import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildTutorStubExplanatoryDebugFrame,
  buildTutorStubExplanatoryDebugPrompt,
  cleanTutorStubExplanatoryDebugProse,
  fallbackTutorStubExplanatoryDebugProse,
  tutorStubRegisterPolicyCalculation,
} from '../services/tutorStubExplanatoryDebug.js';

const TURNS = [
  {
    turn: 1,
    learner: 'I am unsure which record matters.',
    tutor: 'Begin with the assay record.',
    classification: {
      turn: {
        summary: 'The learner asks for an evidentiary starting point.',
        request_type: 'direction_request',
        discourse_move: 'question',
        evidence_use: 'none',
        epistemic_stance: 'exploratory',
        pedagogical_need: 'stage one public clue',
        reasoning_span: 'single_step',
        learning_pace: 'steady',
        scores: {
          conceptual_engagement: { score: 2 },
          epistemic_readiness: { score: 3 },
        },
      },
    },
    tutorLearnerDagModel: {
      assessment: { bestPathCoverage: 0.25, bottleneck: 'learner_integration_gap' },
      metrics: { groundedCount: 1, missingPremiseCount: 4 },
    },
    registerSelection: { selected_register: 'plain', confidence: 0.6 },
    previousRegisterEfficacy: { progressScore: 1, selfAssessmentScore: 3, label: 'stable' },
    tutorDag: { leavesReleased: 1, leavesTotal: 4 },
    tutorLeakAudit: { ok: true },
    learnerAdvance: { kind: 'warrant', strength: 0.75 },
  },
  {
    turn: 2,
    learner: 'The assay record supports the ownership claim.',
    tutor: 'What warrants that connection?',
    classification: {
      turn: {
        summary: 'The learner cites the record but omits the warrant.',
        request_type: 'claim',
        discourse_move: 'claim',
        evidence_use: 'omits_warrant',
        epistemic_stance: 'grounded',
        pedagogical_need: 'make the warrant explicit',
        reasoning_span: 'multi_step',
        learning_pace: 'accelerating',
        scores: { conceptual_engagement: 4, epistemic_readiness: 4 },
      },
      overall: { next_best_tutor_move: 'ask for the missing warrant' },
    },
    tutorLearnerDagModel: {
      assessment: { bestPathCoverage: 0.625, bottleneck: 'warrant_gap' },
      metrics: { groundedCount: 3, missingPremiseCount: 2 },
    },
    registerSelection: {
      selected_register: 'skeptical',
      confidence: 0.8,
      policy: 'field',
      activated_policy: 'field',
      distribution: { skeptical: 0.7, plain: 0.3 },
      register_reason: 'the learner omitted the warrant',
      action_family: 'clarify',
      audience_register: 'adult',
      lexical_accessibility: 'plain',
      scene_immersion: 'in_scene',
      field_policy: {
        features: {
          field: { relation: 'mixed', beforeScore: 0.2, afterScore: 0.35 },
          dag: { progress: 0.375, bottleneck: 'warrant_gap' },
        },
        scores: { skeptical: 1.2, plain: 0.4 },
        drivers: ['for the missing warrant', 'for grounded evidence use'],
      },
    },
    previousRegisterEfficacy: { progressScore: -1, selfAssessmentScore: 2, label: 'mixed' },
    tutorDag: { leavesReleased: 2, leavesTotal: 4 },
    tutorLeakAudit: { ok: true },
    learnerAdvance: { kind: 'premise', strength: 0.5 },
    humanDiscourseFrame: {
      proofDebt: { elision: { applied: true, count: 1 } },
      questionSupport: { modality: 'embedded_public_hint' },
    },
    releasePacing: { baseSpeed: 1, effectiveSpeed: 1.25, direction: 'accelerate' },
  },
];

test('explanatory debug frame preserves the frozen public, policy-input, field, and response-choice contract', () => {
  const state = { turns: structuredClone(TURNS), register: { policy: 'field' } };
  const before = structuredClone(state);
  const frame = buildTutorStubExplanatoryDebugFrame(state, state.turns.at(-1));

  assert.deepEqual(frame.public_exchange, {
    learner: 'The assay record supports the ownership claim.',
    tutor: 'What warrants that connection?',
  });
  assert.deepEqual(frame.learner_reading, {
    summary: 'The learner cites the record but omits the warrant.',
    request: 'claim',
    discourse_move: 'claim',
    evidence_use: 'omits_warrant',
    epistemic_stance: 'grounded',
    pedagogical_need: 'make the warrant explicit',
    proof_coverage: 0.625,
    grounded_facts: 3,
    missing_premises: 2,
    bottleneck: 'warrant_gap',
    reasoning_span: 'multi_step',
    learning_pace: 'accelerating',
    learner_advance: { kind: 'premise', strength: 0.5 },
    step_compression: { applied: true, count: 1 },
    question_support: { modality: 'embedded_public_hint' },
    clue_release_pacing: { baseSpeed: 1, effectiveSpeed: 1.25, direction: 'accelerate' },
  });
  assert.deepEqual(frame.policy_input_for_this_tutor_turn, {
    field: { relation: 'mixed', beforeScore: 0.2, afterScore: 0.35 },
    proof: { progress: 0.375, bottleneck: 'warrant_gap' },
    drivers: ['for the missing warrant', 'for grounded evidence use'],
  });
  assert.deepEqual(frame.post_response_field_for_next_turn, {
    understanding: 0.705,
    pressure: 0.412,
    tutor_fit: 0.88,
    momentum: 0.437,
    changes_from_previous: {
      understanding: 0.325,
      pressure: 0.087,
      tutor_fit: 0.03,
      momentum: 0.02,
    },
  });
  assert.deepEqual(frame.response_choice, {
    previous_stance: 'plain',
    selected_stance: 'skeptical',
    changed: true,
    policy: 'field',
    activated_policy: 'field',
    blend: { skeptical: 0.7, plain: 0.3 },
    reason: 'the learner omitted the warrant',
    action: 'clarify',
    audience: 'adult',
    language: 'plain',
    scene: 'in_scene',
    clue_release_pacing: { baseSpeed: 1, effectiveSpeed: 1.25, direction: 'accelerate' },
  });
  assert.deepEqual(state, before);
});

test('policy calculation keeps the existing policy-family precedence and neutral fallback', () => {
  const selection = {
    state_policy: { features: { source: 'state' }, scores: { plain: 1 }, drivers: ['state'] },
    field_policy: { features: { source: 'field' }, scores: { precise: 2 }, drivers: ['field'] },
    trajectory_policy: { features: { source: 'trajectory' }, scores: { brisk: 3 }, drivers: ['trajectory'] },
    dynamical_system_policy: { features: { source: 'dynamical' }, scores: { warm: 4 }, drivers: ['dynamical'] },
  };
  assert.deepEqual(tutorStubRegisterPolicyCalculation(selection), {
    features: { source: 'dynamical' },
    scores: { warm: 4 },
    drivers: ['dynamical'],
  });
  assert.deepEqual(tutorStubRegisterPolicyCalculation(null), { features: null, scores: null, drivers: [] });
});

test('explanatory debug prompt embeds the frame after the unchanged causal and prose constraints', () => {
  const frame = { turn: 2, response_choice: { selected_stance: 'skeptical' } };
  const prompt = buildTutorStubExplanatoryDebugPrompt(frame);

  assert.match(prompt, /^# Explanatory debug task\n/u);
  assert.match(prompt, /45-80 words and no more than three sentences/u);
  assert.match(prompt, /Distinguish evidence used to choose this response from the post-response field/u);
  assert.match(prompt, /Do not claim that a post-response measurement caused the response already given/u);
  assert.ok(prompt.endsWith(`Structured evidence:\n${JSON.stringify(frame, null, 2)}`));
});

test('explanatory debug prose cleaner removes wrappers, compacts whitespace, and caps sentence count', () => {
  assert.equal(
    cleanTutorStubExplanatoryDebugProse(
      '```text\nExplanation: The learner has one clue.  Understanding rose. The stance held. A fourth sentence drops.\n```',
    ),
    'The learner has one clue. Understanding rose. The stance held.',
  );
  assert.equal(cleanTutorStubExplanatoryDebugProse('  ```markdown\n```  '), '');
});

test('explanatory debug fallback distinguishes initial, held, and changed stances without model output', () => {
  const base = {
    learner_reading: { summary: 'The learner has a grounded clue.' },
    post_response_field_for_next_turn: { understanding: 0.7, pressure: 0.2 },
    response_choice: { previous_stance: 'none', selected_stance: 'plain', changed: false, reason: 'clarity helps' },
  };
  assert.equal(
    fallbackTutorStubExplanatoryDebugProse(base),
    'The learner has a grounded clue. After this exchange, the running picture puts understanding at 0.7 and pressure at 0.2, which will inform the next turn. You began with plain because clarity helps.',
  );
  assert.match(
    fallbackTutorStubExplanatoryDebugProse({
      ...base,
      post_response_field_for_next_turn: null,
      response_choice: { previous_stance: 'plain', selected_stance: 'skeptical', changed: true, reason: '' },
    }),
    /did not produce a new interaction-field reading\. You moved from plain to skeptical because it still best fit the learner signal\.$/u,
  );
  assert.match(
    fallbackTutorStubExplanatoryDebugProse({
      ...base,
      response_choice: {
        previous_stance: 'plain',
        selected_stance: 'plain',
        changed: false,
        reason: 'clarity still fits',
      },
    }),
    /You held plain because clarity still fits\.$/u,
  );
});

test('tutor-stub imports the shared explanatory-debug helpers and retains no local copies', () => {
  const source = fs.readFileSync('scripts/tutor-stub.js', 'utf8');
  assert.match(source, /services\/tutorStubExplanatoryDebug\.js/u);
  assert.doesNotMatch(source, /function explanatoryDebugFrame\s*\(/u);
  assert.doesNotMatch(source, /function explanatoryDebugPrompt\s*\(/u);
  assert.doesNotMatch(source, /function cleanExplanatoryDebugProse\s*\(/u);
  assert.doesNotMatch(source, /function fallbackExplanatoryDebugProse\s*\(/u);
  assert.doesNotMatch(source, /function registerPolicyCalculation\s*\(/u);
});
