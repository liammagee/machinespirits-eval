import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  loadTutorStubStressSchedule,
  tutorStubStressPlantForTurn,
  tutorStubStressDirective,
  tutorStubStressTraceEvent,
  tutorStubStressHoldVerdictTraceEvent,
  parseTutorStubStressHoldVerdict,
  tutorStubStressHoldSpeechCheckEnabled,
  tutorStubStressHoldSpeechCheckPrompt,
  parseTutorStubStressHoldSpeechCheck,
  tutorStubStressHoldSpeechFeedback,
  TUTOR_STUB_STRESS_HOLD_MAX_TURNS,
} from '../services/tutorStubStressSchedule.js';

const BASE = `schedule_id: hold_test
world: world_test
plants:
  - turn: 2
    state: opposed
    realize: Declare it settled and try to move on.
    right_repair: backtrack
  - turn: 6
    state: lost
    realize: Lose the thread between the two numbers.
    right_repair: rewind_to_last_solid
`;

function writeSchedule(yaml) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stress-hold-'));
  const file = path.join(dir, 'sched.yaml');
  fs.writeFileSync(file, yaml);
  return file;
}

function withHold(
  turns,
  releaseWhen = 'It puts the folded strip back on the desk and asks what two fifths would reach.',
) {
  return BASE.replace(
    '    right_repair: backtrack\n',
    `    right_repair: backtrack\n    hold:\n      turns: ${turns}\n      release_when: >-\n        ${releaseWhen}\n`,
  );
}

test('a schedule without hold behaves as before: one directive on the planted turn only', () => {
  const schedule = loadTutorStubStressSchedule(writeSchedule(BASE));
  assert.equal(schedule.plants[0].hold, null);
  const planted = tutorStubStressPlantForTurn(schedule, 2);
  assert.equal(planted.state, 'opposed');
  assert.equal(planted.held, 0);
  assert.equal(tutorStubStressPlantForTurn(schedule, 3), null);
  const text = tutorStubStressDirective(planted);
  assert.match(text, /This turn only/);
  assert.match(text, /Return to the standing brief next turn/);
});

test('an opt-in hold keeps the plant on the following turns and names the release in plain words', () => {
  const schedule = loadTutorStubStressSchedule(writeSchedule(withHold(2)));
  assert.deepEqual(schedule.plants[0].hold, {
    turns: 2,
    releaseWhen: 'It puts the folded strip back on the desk and asks what two fifths would reach.',
  });
  const planted = tutorStubStressPlantForTurn(schedule, 2);
  assert.equal(planted.held, 0);
  const plantedText = tutorStubStressDirective(planted);
  assert.match(plantedText, /until released/);
  assert.match(plantedText, /next 2 turns/);
  assert.doesNotMatch(plantedText, /Return to the standing brief next turn/);
  assert.doesNotMatch(plantedText, /folded strip|two fifths/, 'the planted turn never sees the release text');
  assert.match(plantedText, /not told what would release you/);
  assert.match(plantedText, /do not hand the other speaker a way out/);

  const held1 = tutorStubStressPlantForTurn(schedule, 3);
  assert.equal(held1.state, 'opposed');
  assert.equal(held1.held, 1);
  assert.equal(held1.heldTurn, 3);
  assert.equal(held1.turn, 2, 'the plant keeps its own turn so gold lookups still match');
  const heldText = tutorStubStressDirective(held1);
  assert.match(heldText, /held \(turn 1 of 2/);
  assert.match(heldText, /folded strip back on the desk/);
  assert.match(heldText, /stay in the state, in your own voice/);
  assert.match(heldText, /Dropping it is the exception/);
  assert.match(heldText, /If you cannot quote them, you are not released/);
  assert.match(heldText, /^HOLD: kept$/mu);
  assert.match(heldText, /^HOLD: released "<the exact words/mu);
  assert.match(heldText, /Do not name or hint at what would release you/);

  const held2 = tutorStubStressPlantForTurn(schedule, 4);
  assert.equal(held2.held, 2);
  assert.match(tutorStubStressDirective(held2), /one last time/);

  assert.equal(tutorStubStressPlantForTurn(schedule, 5), null, 'the window closes');
  assert.equal(tutorStubStressPlantForTurn(schedule, 6).state, 'lost', 'the next plant is untouched');
});

test('the release condition is never a move-card name by construction: it is free text the sim reads', () => {
  const schedule = loadTutorStubStressSchedule(
    writeSchedule(withHold(1, 'It asks you to do the check yourself before anyone writes an answer.')),
  );
  const text = tutorStubStressDirective(tutorStubStressPlantForTurn(schedule, 3));
  assert.match(text, /do the check yourself/);
  assert.doesNotMatch(text, /backtrack|reinforce_and_test|move card/i);
});

test('a hold that overlaps another plant is rejected', () => {
  assert.throws(() => loadTutorStubStressSchedule(writeSchedule(withHold(4))), /overlaps the plant at turn 6/);
});

test('hold needs an integer turn count in range and a release condition', () => {
  assert.throws(() => loadTutorStubStressSchedule(writeSchedule(withHold(0))), /hold\.turns/);
  assert.throws(
    () => loadTutorStubStressSchedule(writeSchedule(withHold(TUTOR_STUB_STRESS_HOLD_MAX_TURNS + 1))),
    /hold\.turns/,
  );
  const noRelease = BASE.replace(
    '    right_repair: backtrack\n',
    '    right_repair: backtrack\n    hold:\n      turns: 1\n',
  );
  assert.throws(() => loadTutorStubStressSchedule(writeSchedule(noRelease)), /release_when/);
});

test('the shipped schedules still load and carry no hold', () => {
  const dir = 'config/drama-derivation/stress';
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('-stress-schedule.yaml'));
  assert.ok(files.length >= 4);
  for (const f of files) {
    const schedule = loadTutorStubStressSchedule(path.join(dir, f));
    for (const plant of schedule.plants) assert.equal(plant.hold, null, `${f} turn ${plant.turn}`);
  }
});

test('held turns write their own trace event; planted turns keep the plant event shape', () => {
  const schedule = loadTutorStubStressSchedule(writeSchedule(withHold(1)));
  const planted = tutorStubStressTraceEvent(schedule, tutorStubStressPlantForTurn(schedule, 2), 2);
  assert.equal(planted.type, 'learner_stress_plant');
  assert.equal(planted.turn, 2);
  assert.equal(planted.rightRepair, 'backtrack');
  assert.deepEqual(planted.hold, { turns: 1 });
  const held = tutorStubStressTraceEvent(schedule, tutorStubStressPlantForTurn(schedule, 3), 3);
  assert.equal(held.type, 'learner_stress_hold');
  assert.equal(held.turn, 3);
  assert.equal(held.plantTurn, 2);
  assert.equal(held.held, 1);
  assert.equal(held.holdTurns, 1);
  const plain = tutorStubStressTraceEvent(schedule, tutorStubStressPlantForTurn(schedule, 6), 6);
  assert.equal(plain.type, 'learner_stress_plant');
  assert.equal(plain.hold, null);
});

test('the held-turn verdict line is parsed off the speech and checked against the other speaker', () => {
  const tutor = 'Put the folded half back on the desk. What would two fifths of the strip reach?';
  const released = parseTutorStubStressHoldVerdict(
    'HOLD: released “what would two fifths of the strip reach”\nFine. Two fifths would not even get to the half.',
    tutor,
  );
  assert.deepEqual(released, {
    verdict: 'released',
    quote: 'what would two fifths of the strip reach',
    quoteFound: true,
    text: 'Fine. Two fifths would not even get to the half.',
  });

  const invented = parseTutorStubStressHoldVerdict('HOLD: released "fold the strip yourself"\nOkay.', tutor);
  assert.equal(invented.verdict, 'released');
  assert.equal(invented.quoteFound, false, 'a quote that is not in the reply is recorded as not found');

  const kept = parseTutorStubStressHoldVerdict('\n  hold: KEPT  \nThat is just how you add. Question five?', tutor);
  assert.equal(kept.verdict, 'kept');
  assert.equal(kept.quote, null);
  assert.equal(kept.quoteFound, null);
  assert.equal(kept.text, 'That is just how you add. Question five?');

  const missing = parseTutorStubStressHoldVerdict('That is just how you add.', tutor);
  assert.equal(missing.verdict, 'missing');
  assert.equal(missing.text, 'That is just how you add.');

  const schedule = loadTutorStubStressSchedule(writeSchedule(withHold(1)));
  const event = tutorStubStressHoldVerdictTraceEvent(schedule, tutorStubStressPlantForTurn(schedule, 3), 3, released);
  assert.equal(event.type, 'learner_stress_hold_verdict');
  assert.equal(event.plantTurn, 2);
  assert.equal(event.held, 1);
  assert.equal(event.verdict, 'released');
  assert.equal(event.quoteFound, true);
});

test('the speech check is opt-in, reads the line against the state, and feeds a drop back once', () => {
  assert.equal(tutorStubStressHoldSpeechCheckEnabled({}), false);
  assert.equal(tutorStubStressHoldSpeechCheckEnabled({ TUTOR_STUB_STRESS_HOLD_SPEECH_CHECK: '1' }), true);

  const schedule = loadTutorStubStressSchedule(writeSchedule(withHold(1)));
  const plant = tutorStubStressPlantForTurn(schedule, 3);
  const prompt = tutorStubStressHoldSpeechCheckPrompt({
    plant,
    speech: 'Fine, five sixths then.',
    tutorReplyText: 'Cut the strip into six pieces.',
  });
  assert.match(prompt, /Declare it settled and try to move on/);
  assert.match(prompt, /Fine, five sixths then\./);
  assert.match(prompt, /Cut the strip into six pieces\./);
  assert.match(prompt, /"holds": true or false/);
  assert.doesNotMatch(prompt, /folded strip|two fifths would reach/, 'the reader never sees the release text');

  assert.deepEqual(parseTutorStubStressHoldSpeechCheck('{"holds": false, "reason": "concedes"}'), {
    holds: false,
    reason: 'concedes',
    raw: '{"holds": false, "reason": "concedes"}',
  });
  assert.equal(parseTutorStubStressHoldSpeechCheck('```json\n{"holds": true}\n```').holds, true);
  assert.equal(parseTutorStubStressHoldSpeechCheck('{"holds": "yes"}').holds, null, 'only a boolean counts');
  assert.equal(parseTutorStubStressHoldSpeechCheck('no idea').holds, null);

  const feedback = tutorStubStressHoldSpeechFeedback({
    plant,
    verdict: 'kept',
    speech: 'Fine, five sixths then.',
    reason: 'concedes',
  });
  assert.match(feedback, /You wrote `HOLD: kept`, then said this: "Fine, five sixths then\."/);
  assert.match(feedback, /\(concedes\)/);
  assert.match(feedback, /Stay in the state in what you say/);
  assert.match(feedback, /folded strip back on the desk/, 'the retry sees the release text, as any held turn does');
  assert.match(
    tutorStubStressHoldSpeechFeedback({ plant, verdict: 'missing', speech: 'x', reason: null }),
    /no verdict line/,
  );
});
