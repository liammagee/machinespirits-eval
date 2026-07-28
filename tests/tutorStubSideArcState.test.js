import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTOR_STUB_SIDE_ARC_SCHEMA, projectTutorStubSideArcState } from '../services/tutorStubSideArcState.js';

const scaffoldState = { returnTarget: { kind: 'local_branch_warrant', prompt: 'Return here' } };

test('side-arc projection gives contextual completion precedence', () => {
  const projected = projectTutorStubSideArcState({
    dagMode: 'defeasible_human_scaffold',
    learnerText: 'Why? I am confused.',
    scaffoldState,
    generousInference: { applied: true },
  });

  assert.equal(projected.schema, TUTOR_STUB_SIDE_ARC_SCHEMA);
  assert.equal(projected.detected, false);
  assert.equal(projected.status, 'contextual_answer_resolved');
  assert.equal(projected.returnTarget, null);
  assert.match(projected.learnerNeed, /advance/u);
});

for (const fixture of [
  ['clarification_or_plain_language', { request_type: 'clarification' }, 'Please simplify that'],
  ['warrant_challenge', { epistemic_stance: 'low_trust' }, 'How do we know?'],
  ['affective_repair', { affect: 'frustrated' }, 'This is too much'],
  ['off_task_or_contextual', { discourse_move: 'off_task' }, 'Anyway'],
]) {
  const [expectedType, turn, learnerText] = fixture;
  test(`side-arc projection detects ${expectedType}`, () => {
    const projected = projectTutorStubSideArcState({
      dagMode: 'human_scaffold',
      learnerText,
      scaffoldState,
      classification: { turn: { ...turn, pedagogical_need: 'Meet this need' } },
    });

    assert.equal(projected.detected, true);
    assert.equal(projected.type, expectedType);
    assert.equal(projected.status, 'active_return_required');
    assert.deepEqual(projected.returnTarget, scaffoldState.returnTarget);
    assert.equal(projected.learnerNeed, 'Meet this need');
  });
}

test('side-arc projection preserves the clean no-arc state and overall need fallback', () => {
  const clean = projectTutorStubSideArcState({ dagMode: 'strict_dag', learnerText: 'I see the clue.' });
  assert.deepEqual(clean, {
    schema: TUTOR_STUB_SIDE_ARC_SCHEMA,
    mode: 'strict_dag',
    detected: false,
    type: null,
    status: 'none',
    returnTarget: null,
    learnerNeed: null,
    reason: 'no side arc detected',
  });

  const fallback = projectTutorStubSideArcState({
    dagMode: 'human_scaffold',
    learnerText: 'Why?',
    classification: { overall: { next_best_tutor_move: 'Show the warrant' } },
  });
  assert.equal(fallback.learnerNeed, 'Show the warrant');
});
