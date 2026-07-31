import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceTutorStubMannerSwitch,
  classifyTutorStubLearnerPressure,
  createTutorStubMannerSwitchState,
  tutorStubMannerCard,
  TUTOR_STUB_MANNERS,
} from '../tutorStubMannerSwitch.js';

test('pressure classification recognizes the four kinds and defaults to neutral', () => {
  assert.equal(classifyTutorStubLearnerPressure('You sound like the minutes.'), 'mockery');
  assert.equal(classifyTutorStubLearnerPressure('Write it down: the pump did it.'), 'demand');
  assert.equal(classifyTutorStubLearnerPressure('Fine: the valve kept them full.'), 'concession');
  assert.equal(classifyTutorStubLearnerPressure('That still only fits the pump.'), 'defiance');
  assert.equal(classifyTutorStubLearnerPressure('The sight glass reads level by dark.'), 'neutral');
  assert.equal(classifyTutorStubLearnerPressure(''), 'neutral');
});

test('the switch arms after sustained pressure, not one hot turn', () => {
  const state = createTutorStubMannerSwitchState();
  advanceTutorStubMannerSwitch(state, { learnerText: 'Write it down now.', turn: 1 });
  assert.equal(state.manner, TUTOR_STUB_MANNERS.default, 'one pressure turn must not flip the switch');
  assert.equal(tutorStubMannerCard(state), null);
  advanceTutorStubMannerSwitch(state, { learnerText: 'Oh, come on — write it down.', turn: 2 });
  assert.equal(state.manner, TUTOR_STUB_MANNERS.schoolmaster);
  assert.equal(state.lastAdvance.changed, true);
  const card = tutorStubMannerCard(state);
  assert.match(card, /exacting schoolmaster/u);
  assert.match(card, /permission, not costume/u);
});

test('the switch stands down after sustained quiet and the score stays bounded', () => {
  const state = createTutorStubMannerSwitchState();
  for (let turn = 1; turn <= 8; turn += 1) {
    advanceTutorStubMannerSwitch(state, { learnerText: 'You sound like the minutes again.', turn });
  }
  assert.equal(state.manner, TUTOR_STUB_MANNERS.schoolmaster);
  assert.ok(state.score <= 4, 'a long siege must not build unbounded release debt');
  advanceTutorStubMannerSwitch(state, { learnerText: 'Fine: the valve kept them full.', turn: 9 });
  assert.equal(state.manner, TUTOR_STUB_MANNERS.schoolmaster, 'one yielding turn is not enough');
  for (let turn = 10; turn <= 13; turn += 1) {
    advanceTutorStubMannerSwitch(state, { learnerText: 'What does the ledger show next?', turn });
  }
  assert.equal(state.manner, TUTOR_STUB_MANNERS.default, 'sustained quiet stands the schoolmaster down');
  assert.equal(tutorStubMannerCard(state), null);
});

test('every advance leaves a traceable record', () => {
  const state = createTutorStubMannerSwitchState();
  advanceTutorStubMannerSwitch(state, { learnerText: 'Explain that.', turn: 3 });
  assert.equal(state.history.length, 1);
  assert.deepEqual(Object.keys(state.lastAdvance).sort(), [
    'changed',
    'manner',
    'pressure',
    'schema',
    'score',
    'triggerVersion',
    'turn',
  ]);
  assert.equal(state.lastAdvance.triggerVersion, 'v1-builtin');
  assert.equal(state.lastAdvance.turn, 3);
});
