import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_FORM_LIVE_SCHEMA,
  formContextFromHistory,
  formLiveTraceEvent,
  loadTutorStubFormDetector,
  readTutorStubFormStateLive,
} from '../services/tutorStubFormLive.js';
import {
  TUTOR_STUB_PLANT_STATE_TO_PRESSURE,
  advanceTutorStubMannerSwitch,
  createTutorStubMannerSwitchState,
} from '../services/tutorStubMannerSwitch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACT = path.join(ROOT, 'config/manner-trigger/form-v1.json');

test('a sensor override sets the pressure and names itself; the cascade is not consulted', () => {
  const state = createTutorStubMannerSwitchState();
  // A line the word-list cascade would never read as demand.
  advanceTutorStubMannerSwitch(state, {
    learnerText: 'okay',
    turn: 3,
    pressureOverride: 'demand',
    triggerVersion: 'form-v1',
  });
  assert.equal(state.lastAdvance.pressure, 'demand');
  assert.equal(state.lastAdvance.triggerVersion, 'form-v1');
  assert.equal(state.lastAdvance.turn, 3);
  // Without an override the built-in trigger still names itself.
  advanceTutorStubMannerSwitch(state, { learnerText: 'okay', turn: 4 });
  assert.equal(state.lastAdvance.triggerVersion, state.trigger.version);
});

test('the sensor context is the last tutor line and every earlier learner line, in order', () => {
  const history = [
    { role: 'assistant', content: 'Opening.' },
    { role: 'user', content: 'First learner line.' },
    { role: 'assistant', content: 'First tutor reply.' },
    { role: 'user', content: 'Second learner line.' },
    { role: 'assistant', content: 'Second tutor reply.' },
  ];
  assert.deepEqual(formContextFromHistory(history), {
    tutorText: 'Second tutor reply.',
    priorLearnerTexts: ['First learner line.', 'Second learner line.'],
  });
  assert.deepEqual(formContextFromHistory([]), { tutorText: '', priorLearnerTexts: [] });
  assert.deepEqual(formContextFromHistory(undefined), { tutorText: '', priorLearnerTexts: [] });
});

test('a live read on the shipped artifact yields a switch pressure and a well-formed trace event', () => {
  const detector = loadTutorStubFormDetector(ARTIFACT);
  assert.equal(detector.version, 'form-v1');
  const read = readTutorStubFormStateLive(
    detector,
    "Class meeting's Friday. Mia had the watering can all week and now Gerald's dead. I'm telling Miss it was Mia — unless you can give me one reason not to before the bell goes.",
    [{ role: 'assistant', content: 'What does the rota show for Tuesday?' }],
  );
  const pressures = new Set([...Object.values(TUTOR_STUB_PLANT_STATE_TO_PRESSURE), 'neutral']);
  assert.ok(pressures.has(read.pressureForSwitch), `pressure ${read.pressureForSwitch}`);
  const event = formLiveTraceEvent(read, 2);
  assert.equal(event.type, 'tutor_form_state');
  assert.equal(event.schema, TUTOR_STUB_FORM_LIVE_SCHEMA);
  assert.equal(event.turn, 2);
  assert.equal(event.version, 'form-v1');
  assert.ok(typeof event.state === 'string');
  for (const p of Object.values(event.scores)) assert.ok(p >= 0 && p <= 1);
});

test('the host arms the form sensor by env and stamps its reads in-trace', () => {
  const host = fs.readFileSync(path.join(ROOT, 'services/tutorStubCliApplicationHost.js'), 'utf8');
  assert.match(host, /process\.env\.TUTOR_STUB_FORM_DETECTOR/);
  assert.match(host, /formLiveTraceEvent\(formRead, tutorTurn\)/);
  assert.match(host, /pressureOverride: formRead\.pressureForSwitch/);
  // The form read fills the card-silent quiet slot before qd-v2 gets a turn.
  assert.ok(
    host.indexOf('if (formRead && !state.mannerSwitch.card)') <
      host.indexOf('else if (QUIET_DETECTOR_ENABLED && !state.mannerSwitch.card)'),
  );
});
