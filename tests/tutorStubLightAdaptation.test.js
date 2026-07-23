import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
  buildTutorStubLightAdaptationDecision,
  normalizeTutorStubLightAdaptationThreshold,
  tutorStubLearnerDifficultySignal,
} from '../services/tutorStubLightAdaptation.js';

function classification({ epistemic = 'confused', affect = 'engaged', need = 'Explain the clue plainly.' } = {}) {
  return {
    turn: {
      request_type: 'stepwise_support_request',
      discourse_move: 'repair_request',
      epistemic_stance: epistemic,
      affect,
      pedagogical_need: need,
    },
  };
}

test('light adaptation requires continued difficulty rather than one confused turn', () => {
  const first = buildTutorStubLightAdaptationDecision({
    enabled: true,
    state: { turns: [], register: { history: [] } },
    classification: classification(),
    learnerText: 'I am not sure what this clue means.',
  });
  assert.equal(first.schema, TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA);
  assert.equal(first.streak, 1);
  assert.equal(first.triggered, false);

  const second = buildTutorStubLightAdaptationDecision({
    enabled: true,
    state: {
      turns: [
        {
          learner: 'I am not sure what this clue means.',
          classification: classification(),
        },
      ],
      register: {
        history: [{ selected_register: 'precise', actorial_part: 'examiner' }],
      },
    },
    classification: classification({ affect: 'frustrated' }),
    learnerText: 'I am getting frustrated and still do not know.',
  });
  assert.equal(second.streak, 2);
  assert.equal(second.triggered, true);
  assert.deepEqual(second.current_signal.signal_types, ['confusion', 'frustration']);
  assert.deepEqual(second.stochastic_axes, ['engagement_stance', 'actorial_part']);
  assert.deepEqual(second.previous, { engagement_stance: 'precise', actorial_part: 'examiner' });
  assert.equal(second.selection_method, 'seeded_uniform_excluding_previous');
});

test('a grounded learner turn resets the light adaptation streak', () => {
  const decision = buildTutorStubLightAdaptationDecision({
    enabled: true,
    state: {
      turns: [{ learner: 'I was lost.', classification: classification() }],
      register: { history: [] },
    },
    classification: classification({ epistemic: 'grounded', affect: 'engaged', need: 'Continue.' }),
    learnerText: 'That makes sense now; I understand.',
  });
  assert.equal(decision.current_signal.active, false);
  assert.equal(decision.streak, 0);
  assert.equal(decision.triggered, false);
});

test('light adaptation detects frustration without a classifier and remains opt-in', () => {
  const signal = tutorStubLearnerDifficultySignal({ learnerText: 'I am fed up and stuck.' });
  assert.equal(signal.active, true);
  assert.deepEqual(signal.signal_types, ['frustration']);

  const decision = buildTutorStubLightAdaptationDecision({
    enabled: false,
    state: { turns: [{ learner: 'This is frustrating.', classification: null }], register: { history: [] } },
    learnerText: 'I am still stuck.',
  });
  assert.equal(decision.streak, 2);
  assert.equal(decision.triggered, false);
});

test('light adaptation threshold is deliberately bounded', () => {
  assert.equal(normalizeTutorStubLightAdaptationThreshold(undefined), 2);
  assert.equal(normalizeTutorStubLightAdaptationThreshold('3'), 3);
  assert.throws(() => normalizeTutorStubLightAdaptationThreshold(1), /between 2 and 8/iu);
  assert.throws(() => normalizeTutorStubLightAdaptationThreshold(2.5), /integer/iu);
});
