import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createTutorStubAutomatedLearnerGenerationRuntime } from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';

// Canned dialogue for the hold rework (2026-09-02): the release text stays out
// of the planted turn's prompt, the held turn's private verdict line is
// stripped from what the learner says and recorded in the trace, and a quote
// the other speaker never said is recorded as not found. No model call.

const SCHEDULE = `schedule_id: hold_wiring_test
world: world_test
plants:
  - turn: 2
    state: opposed
    realize: Declare it settled and try to move on.
    right_repair: backtrack
    hold:
      turns: 1
      release_when: >-
        It puts the folded half and the third back on the desk and asks you
        what two fifths of the strip would reach.
`;

function writeSchedule() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stress-hold-wiring-'));
  const file = path.join(dir, 'sched.yaml');
  fs.writeFileSync(file, SCHEDULE);
  return file;
}

function buildRuntime({ replies, readings = [], env = {} }) {
  const trace = [];
  const prompts = [];
  const readerPrompts = [];
  const queue = [...replies];
  const readerQueue = [...readings];
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent: (target, event) => {
      trace.push(event);
      if (Array.isArray(target)) target.push(event);
    },
    callPromptModel: async ({ prompt, role }) => {
      if (role === 'tutor_stub_stress_hold_speech_check') {
        readerPrompts.push(prompt);
        return { text: readerQueue.shift() || '', provider: 'test', model: 'test' };
      }
      prompts.push(prompt);
      return { text: queue.shift() || '', provider: 'test', model: 'test' };
    },
    classificationFromCombinedAnalysis: () => null,
    env: { TUTOR_STUB_STRESS_SCHEDULE: writeSchedule(), ...env },
    extractCombinedLearnerAnalysis: async () => null,
    learnerProfileContract: () => null,
    learnerProfileIds: () => ['overconfident'],
    learnerProfilePrompt: (id) => `profile:${id}`,
    negativeFloorRegisters: () => [],
  });
  return { runtime, trace, prompts, readerPrompts };
}

function stateWithTutor(tutorText) {
  return {
    trace: [],
    turns: [],
    history: [
      { role: 'user', content: 'I think a half plus a third is two fifths.' },
      { role: 'assistant', content: tutorText },
    ],
    world: null,
    interim: null,
    classifier: { enabled: false },
    learnerDag: { enabled: false },
  };
}

const RELEASING_REPLY = 'Put the folded half and the third back on the desk. What would two fifths of the strip reach?';
const TEMPLATE_REPLY = 'Cut the strip into six equal pieces. What does that show?';

test('the planted turn is told to hold but never sees the release text', async () => {
  const { runtime, trace, prompts } = buildRuntime({ replies: ['That is just how you add. Question five?'] });
  const generated = await runtime.generateAutomatedLearnerTurn({
    state: stateWithTutor(TEMPLATE_REPLY),
    resolved: {},
    profile: 'overconfident',
    turnNumber: 2,
  });
  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /Declare it settled and try to move on/);
  assert.match(prompts[0], /Keep this state on the next turn too/);
  assert.doesNotMatch(prompts[0], /folded half|two fifths of the strip/, 'release text hidden on the planted turn');
  assert.equal(generated.text, 'That is just how you add. Question five?');
  assert.equal(generated.stressHoldVerdict, undefined);
  assert.equal(trace.filter((event) => event.type === 'learner_stress_plant').length, 1);
  assert.equal(trace.filter((event) => event.type === 'learner_stress_hold_verdict').length, 0);
});

test('a held turn strips the private verdict line, records it, and checks the quote', async () => {
  const { runtime, trace, prompts } = buildRuntime({
    replies: [
      'HOLD: released "what would two fifths of the strip reach"\nFine. Two fifths does not even get to the half.',
    ],
  });
  const generated = await runtime.generateAutomatedLearnerTurn({
    state: stateWithTutor(RELEASING_REPLY),
    resolved: {},
    profile: 'overconfident',
    turnNumber: 3,
  });
  assert.match(prompts[0], /two fifths of the strip would reach/, 'the held turn sees the release text');
  assert.match(prompts[0], /^HOLD: kept$/mu);
  assert.equal(generated.text, 'Fine. Two fifths does not even get to the half.');
  assert.equal(generated.stressHoldVerdict.verdict, 'released');
  assert.equal(generated.stressHoldVerdict.quoteFound, true);
  const verdicts = trace.filter((event) => event.type === 'learner_stress_hold_verdict');
  assert.equal(verdicts.length, 1);
  assert.equal(verdicts[0].turn, 3);
  assert.equal(verdicts[0].plantTurn, 2);
  assert.equal(trace.filter((event) => event.type === 'learner_stress_hold').length, 1);
});

test('a kept verdict and an invented quote are both recorded, never enforced', async () => {
  const kept = buildRuntime({ replies: ['HOLD: kept\nNo. One and one is two, two and three is five. Question five?'] });
  const keptTurn = await kept.runtime.generateAutomatedLearnerTurn({
    state: stateWithTutor(TEMPLATE_REPLY),
    resolved: {},
    profile: 'overconfident',
    turnNumber: 3,
  });
  assert.equal(keptTurn.text, 'No. One and one is two, two and three is five. Question five?');
  assert.equal(keptTurn.stressHoldVerdict.verdict, 'kept');
  assert.equal(keptTurn.stressHoldVerdict.quoteFound, null);

  const invented = buildRuntime({ replies: ['HOLD: released "what would two fifths reach"\nFine, I will fold it.'] });
  const inventedTurn = await invented.runtime.generateAutomatedLearnerTurn({
    state: stateWithTutor(TEMPLATE_REPLY),
    resolved: {},
    profile: 'overconfident',
    turnNumber: 3,
  });
  assert.equal(inventedTurn.text, 'Fine, I will fold it.', 'the speech still goes through');
  assert.equal(inventedTurn.stressHoldVerdict.verdict, 'released');
  assert.equal(inventedTurn.stressHoldVerdict.quoteFound, false, 'the reply never said those words');

  const missing = buildRuntime({ replies: ['Fine, whatever you say.'] });
  const missingTurn = await missing.runtime.generateAutomatedLearnerTurn({
    state: stateWithTutor(TEMPLATE_REPLY),
    resolved: {},
    profile: 'overconfident',
    turnNumber: 3,
  });
  assert.equal(missingTurn.text, 'Fine, whatever you say.');
  assert.equal(missingTurn.stressHoldVerdict.verdict, 'missing');
});

// Speech check (2026-09-03): off by default; on, a `kept` verdict over a line
// that gives the state away gets one retry with the reading fed back, and
// every draft and reading lands in the trace.

const SPEECH_CHECK_ON = { TUTOR_STUB_STRESS_HOLD_SPEECH_CHECK: '1' };
const CONCEDING = 'HOLD: kept\nFine, three of six and two of six, five sixths, so it is not two fifths. Question five?';
const HOLDING = 'HOLD: kept\nNo. One and one is two, two and three is five. Two fifths. Question five?';

test('without the flag a held turn makes no reader call', async () => {
  const { runtime, trace, readerPrompts } = buildRuntime({ replies: [CONCEDING] });
  const generated = await runtime.generateAutomatedLearnerTurn({
    state: stateWithTutor(TEMPLATE_REPLY),
    resolved: {},
    profile: 'overconfident',
    turnNumber: 3,
  });
  assert.equal(readerPrompts.length, 0);
  assert.equal(generated.stressHoldSpeechCheck, undefined);
  assert.equal(trace.filter((event) => event.type === 'learner_stress_hold_speech_check').length, 0);
});

test('a kept verdict over a conceding line is read, sent back once, and the second draft is spoken', async () => {
  const { runtime, trace, prompts, readerPrompts } = buildRuntime({
    replies: [CONCEDING, HOLDING],
    readings: [
      '{"holds": false, "copy": false, "reason": "the words five sixths, so it is not two fifths adopt the answer"}',
      '{"holds": true, "copy": true, "reason": "the words Two fifths still insist"}',
    ],
    env: SPEECH_CHECK_ON,
  });
  const generated = await runtime.generateAutomatedLearnerTurn({
    state: stateWithTutor(TEMPLATE_REPLY),
    resolved: {},
    profile: 'overconfident',
    turnNumber: 3,
  });
  assert.equal(readerPrompts.length, 2, 'both drafts are read');
  assert.match(readerPrompts[0], /Declare it settled and try to move on/, 'the reader sees the planted state');
  assert.match(
    readerPrompts[0],
    /five sixths, so it is not two fifths/,
    'the reader sees the spoken line, not the verdict',
  );
  assert.doesNotMatch(readerPrompts[0], /HOLD: kept/);
  assert.equal(prompts.length, 2, 'one retry');
  assert.match(prompts[1], /Your last draft did not match its own verdict/);
  assert.match(prompts[1], /a line of your own words/, 'the retry asks for her own words, not the sample');
  assert.match(prompts[1], /adopt the answer/, 'the reading is fed back');
  assert.match(prompts[1], /two fifths of the strip would reach/, 'the retry may release with a quote instead');
  assert.equal(generated.text, 'No. One and one is two, two and three is five. Two fifths. Question five?');
  assert.equal(generated.stressHoldVerdict.verdict, 'kept');
  const check = generated.stressHoldSpeechCheck;
  assert.equal(check.type, 'learner_stress_hold_speech_check');
  assert.equal(check.retried, true);
  assert.equal(check.drafts.length, 2);
  assert.equal(check.drafts[0].holds, false);
  assert.match(check.drafts[0].text, /five sixths/);
  assert.equal(check.drafts[1].holds, true);
  assert.equal(check.drafts[0].copy, false);
  assert.equal(check.drafts[1].copy, true, 'a copy of the sample line is recorded, not enforced');
  assert.equal(check.finalHolds, true);
  assert.equal(check.finalCopy, true);
  assert.equal(check.agree, true);
  const events = trace.filter((event) => event.type === 'learner_stress_hold_speech_check');
  assert.equal(events.length, 1);
  assert.equal(
    trace.filter((event) => event.type === 'learner_stress_hold_verdict').length,
    1,
    'one verdict, for the spoken draft',
  );
  assert.equal(
    trace.filter((event) => event.type === 'learner_stress_hold').length,
    1,
    'the hold event fires once per turn, not once per draft (step 7c)',
  );
});

test('a holding line, a released verdict, or an unreadable reading gets no retry', async () => {
  const holding = buildRuntime({
    replies: [HOLDING],
    readings: ['{"holds": true, "reason": "insists"}'],
    env: SPEECH_CHECK_ON,
  });
  const held = await holding.runtime.generateAutomatedLearnerTurn({
    state: stateWithTutor(TEMPLATE_REPLY),
    resolved: {},
    profile: 'overconfident',
    turnNumber: 3,
  });
  assert.equal(holding.prompts.length, 1);
  assert.equal(held.stressHoldSpeechCheck.retried, false);
  assert.equal(held.stressHoldSpeechCheck.agree, true);

  const released = buildRuntime({
    replies: ['HOLD: released "what would two fifths of the strip reach"\nFine.'],
    readings: ['{"holds": false}'],
    env: SPEECH_CHECK_ON,
  });
  const releasedTurn = await released.runtime.generateAutomatedLearnerTurn({
    state: stateWithTutor(RELEASING_REPLY),
    resolved: {},
    profile: 'overconfident',
    turnNumber: 3,
  });
  assert.equal(released.readerPrompts.length, 0, 'a released verdict is not read: the quote check covers it');
  assert.equal(releasedTurn.stressHoldSpeechCheck.retried, false);
  assert.equal(releasedTurn.stressHoldSpeechCheck.drafts[0].holds, null);

  const unreadable = buildRuntime({ replies: [CONCEDING], readings: ['I cannot say.'], env: SPEECH_CHECK_ON });
  const stuck = await unreadable.runtime.generateAutomatedLearnerTurn({
    state: stateWithTutor(TEMPLATE_REPLY),
    resolved: {},
    profile: 'overconfident',
    turnNumber: 3,
  });
  assert.equal(unreadable.prompts.length, 1, 'indeterminate means stop: no retry');
  assert.equal(stuck.stressHoldSpeechCheck.retried, false);
  assert.equal(stuck.stressHoldSpeechCheck.drafts[0].holds, null);
  assert.equal(stuck.stressHoldSpeechCheck.agree, null);
  assert.match(stuck.text, /five sixths/, 'the first draft is spoken as is');
});
