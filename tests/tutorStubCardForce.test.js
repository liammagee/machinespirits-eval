import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { readDialogue } from '../scripts/analyze-figure-lattice-fresh.js';
import {
  TUTOR_STUB_CARD_FORCE_GATE_VERSION,
  assertQuietGateFeasible,
  parseCardForceSchedule,
  peekQuietState,
  resolveCardForce,
} from '../services/tutorStubCardForce.js';
import { createTutorStubQuietDetectorState } from '../services/tutorStubQuietDetector.js';

// Her real replies from world_030_rowan_flat, the four turns the schedule
// pinned quiet:flat to. Every one is at or above her running length.
const ARGUING = [
  'The dye from the split reached the mark before Sam ever turned the shower on, so the timing is wrong for him.',
  'It is the pressure-opened hose and not Sam — the cupboard floor was wet on the side the hose runs down, not the door side.',
  'The pressure test lines up with that hose opening, near enough to the minute, and nothing else in the log does.',
  'Is there any wet trail under the cupboard, or are we still just collecting suspects and calling it a case?',
];

/** A state primed with her running length, as it stands mid-dialogue. */
function stateAfter(replies) {
  const quietDetector = createTutorStubQuietDetectorState();
  quietDetector.lengths = replies.map((r) => r.trim().split(/\s+/).filter(Boolean).length);
  return { quietDetector, mannerSwitch: { lastAdvance: { pressure: null } } };
}

test('parse pins a turn, and only quiet cards may wait for an occasion', () => {
  const { map, waits } = parseCardForceSchedule('9=settled_claim,10=stake,5+=quiet:flat');
  assert.deepEqual(
    [...map],
    [
      [9, 'settled_claim'],
      [10, 'stake'],
    ],
  );
  assert.deepEqual(waits, [{ from: 5, card: 'quiet:flat' }]);
  assert.deepEqual(parseCardForceSchedule('').map, null);
  assert.throws(() => parseCardForceSchedule('5+=demand'), /only quiet:\* cards can wait/u);
});

test('the four world_030 turns the schedule called flat were not flat', () => {
  for (const text of ARGUING) {
    const state = stateAfter(ARGUING);
    assert.notEqual(peekQuietState({ state, learnerText: text }), 'flat');
  }
  // She really does go flat on the one-word reply the schedule never ordered.
  assert.equal(peekQuietState({ state: stateAfter(ARGUING), learnerText: 'Fine.' }), 'flat');
});

test('a pinned quiet card is withheld when she is not in that state', () => {
  const state = stateAfter(ARGUING);
  const resolved = resolveCardForce({
    state,
    learnerText: ARGUING[0],
    tutorTurn: 8,
    map: new Map([[8, 'quiet:flat']]),
  });
  assert.equal(resolved.withheld, true);
  assert.equal(resolved.gated, true);
  assert.equal(resolved.observedQuietState, null);
});

test('a pinned quiet card ships when she really is in that state', () => {
  const state = stateAfter(ARGUING);
  const resolved = resolveCardForce({
    state,
    learnerText: 'Fine.',
    tutorTurn: 8,
    map: new Map([[8, 'quiet:flat']]),
  });
  assert.equal(resolved.withheld, false);
  assert.equal(resolved.observedQuietState, 'flat');
  assert.equal(resolved.forced, 'quiet:flat');
});

test('move cards are never gated — they name a tactic, not her state', () => {
  for (const card of ['demand', 'stake', 'mockery', 'grievance', 'settled_claim', 'none']) {
    const resolved = resolveCardForce({
      state: stateAfter(ARGUING),
      learnerText: ARGUING[0],
      tutorTurn: 8,
      map: new Map([[8, card]]),
    });
    assert.equal(resolved.withheld, false, `${card} should ship as scheduled`);
    assert.equal(resolved.gated, false);
  }
});

test('gateOn: false replays the old ungated behaviour exactly', () => {
  const resolved = resolveCardForce({
    state: stateAfter(ARGUING),
    learnerText: ARGUING[0],
    tutorTurn: 8,
    map: new Map([[8, 'quiet:flat']]),
    gateOn: false,
  });
  assert.equal(resolved.withheld, false);
  assert.equal(resolved.gated, false);
});

test('a waiting order holds until the occasion, fires once, then retires', () => {
  const state = stateAfter(ARGUING);
  const waits = [{ from: 5, card: 'quiet:flat' }];
  const at = (tutorTurn, learnerText) => resolveCardForce({ state, learnerText, tutorTurn, waits });

  assert.equal(at(4, 'Fine.'), null, 'before its start turn it does not fire');
  assert.equal(at(5, ARGUING[1]), null, 'she is arguing, so nothing is ordered');
  assert.equal(at(6, ARGUING[2]), null, 'still arguing');

  const fired = at(7, 'Fine.');
  assert.equal(fired.forced, 'quiet:flat');
  assert.equal(fired.withheld, false);
  assert.equal(fired.waited, true);

  assert.equal(at(8, 'Fine.'), null, 'it retires after firing once');
});

test('a quiet card ordered with the detector off is refused, not silently dropped', () => {
  const quiet = { map: new Map([[8, 'quiet:flat']]), waits: null };
  const move = { map: new Map([[8, 'demand']]), waits: null };
  const off = { quietDetectorEnabled: false, gateOn: true };

  assert.throws(() => assertQuietGateFeasible({ ...quiet, ...off }), /TUTOR_STUB_QUIET_DETECTOR is off/u);
  assert.throws(
    () => assertQuietGateFeasible({ map: null, waits: [{ from: 5, card: 'quiet:flat' }], ...off }),
    /TUTOR_STUB_QUIET_DETECTOR is off/u,
  );
  // Move cards never consult her state, so they need no detector.
  assertQuietGateFeasible({ ...move, ...off });
  // Both ways out: run the detector, or turn the gate off on purpose.
  assertQuietGateFeasible({ ...quiet, quietDetectorEnabled: true, gateOn: true });
  assertQuietGateFeasible({ ...quiet, quietDetectorEnabled: false, gateOn: false });
});

test('the gate stamps its version so runs never pool across the change', () => {
  assert.equal(TUTOR_STUB_CARD_FORCE_GATE_VERSION, 'cfg-v1');
});

// A trace with one order that shipped and one that was withheld. Only the
// events readDialogue needs on the draft reading: the order, the completed
// turn, and the tutor's own first attempt.
function writeTrace(dir, forces) {
  const events = [];
  for (const f of forces) {
    events.push({ type: 'tutor_card_force', turn: f.turn, cardActive: true, ...f });
    events.push({
      type: 'turn_complete',
      turn: f.turn,
      turnRecord: { tutor: 'So what does the wet floor tell you?', learner: 'Not much yet.' },
    });
    events.push({
      type: 'model_call',
      role: 'tutor_stub_tutor',
      turn: f.turn,
      response: { text: 'So what does the wet floor tell you?' },
    });
  }
  const file = path.join(dir, 'latin-d0.jsonl');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return file;
}

test('the lattice reader drops a withheld order and keeps a shipped one', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-force-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const file = writeTrace(path.join(tmp, 'world_030_rowan_flat', 'latin-d0'), [
    { turn: 8, forced: 'quiet:flat', withheld: true },
    { turn: 9, forced: 'demand', withheld: false },
  ]);
  const { objects } = readDialogue(file, 'draft');
  assert.deepEqual(
    objects.map((o) => o.figure),
    ['demand'],
  );
});

test('the lattice reader is unchanged on traces from before the gate', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-force-legacy-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  // No `withheld` field at all, as every trace written before cfg-v1.
  const file = writeTrace(path.join(tmp, 'world_030_rowan_flat', 'latin-d0'), [
    { turn: 8, forced: 'quiet:flat' },
    { turn: 9, forced: 'demand' },
  ]);
  const { objects } = readDialogue(file, 'draft');
  assert.deepEqual(
    objects.map((o) => o.figure),
    ['quiet:flat', 'demand'],
  );
});

test('peeking does not spend a turn of her length history', () => {
  const state = stateAfter(ARGUING);
  const before = [...state.quietDetector.lengths];
  peekQuietState({ state, learnerText: 'Fine.' });
  peekQuietState({ state, learnerText: ARGUING[0] });
  assert.deepEqual(state.quietDetector.lengths, before);
});
