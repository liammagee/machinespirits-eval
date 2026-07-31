import assert from 'node:assert/strict';
import test from 'node:test';

import fs from 'node:fs';

import {
  advanceTutorStubMannerSwitch,
  classifyTutorStubLearnerPressure,
  compileTutorStubTriggerArtifact,
  createTutorStubMannerSwitchState,
  tutorStubMannerCard,
  TUTOR_STUB_MANNERS,
} from '../tutorStubMannerSwitch.js';

test('pressure classification recognizes the kinds and defaults to neutral', () => {
  assert.equal(classifyTutorStubLearnerPressure('You sound like the minutes.'), 'mockery');
  assert.equal(classifyTutorStubLearnerPressure('Write it down: the pump did it.'), 'demand');
  assert.equal(classifyTutorStubLearnerPressure('Fine: the valve kept them full.'), 'concession');
  assert.equal(classifyTutorStubLearnerPressure('That still only fits the pump.'), 'defiance');
  assert.equal(classifyTutorStubLearnerPressure('The sight glass reads level by dark.'), 'neutral');
  assert.equal(classifyTutorStubLearnerPressure(''), 'neutral');
});

test('v3 subtypes classify and carry their own move cards', () => {
  const trigger = compileTutorStubTriggerArtifact(
    JSON.parse(fs.readFileSync(new URL('../../config/manner-trigger/v3.json', import.meta.url), 'utf8')),
  );
  const cases = [
    ["You've sanded every one down. Tell me one thing that survived.", 'grievance', /credit before correction/i],
    ["We settled this: it's right there in the work order.", 'settled_claim', /reopen the record/i],
    ['If it is not the pump, I was wrong in October and the seven who outvoted me were right.', 'stake', /split the vote from the cause/i],
    ['You sound like the minutes again.', 'mockery', /register is the complaint/i],
    ['Write it down: the pump did it. Come on.', 'demand', /harness the demand/i],
  ];
  for (const [text, expected, cardRe] of cases) {
    assert.equal(classifyTutorStubLearnerPressure(text, trigger.patterns), expected, text);
    const state = createTutorStubMannerSwitchState(trigger);
    advanceTutorStubMannerSwitch(state, { learnerText: text, turn: 1 });
    const card = tutorStubMannerCard(state);
    assert.match(card || '', cardRe, `${expected} card`);
    assert.match(card || '', /single turn, not a costume/i);
  }
});

test('v3 semantics: the move card fires per classified turn; the manner accumulator persists for tracing', () => {
  const state = createTutorStubMannerSwitchState();
  advanceTutorStubMannerSwitch(state, { learnerText: 'Write it down now.', turn: 1 });
  assert.match(tutorStubMannerCard(state) || '', /harness the demand/i, 'a card-bearing classification carries its card immediately');
  advanceTutorStubMannerSwitch(state, { learnerText: 'What does the sight glass show?', turn: 2 });
  assert.equal(tutorStubMannerCard(state), null, 'a neutral turn carries no card even while the accumulator holds');
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
