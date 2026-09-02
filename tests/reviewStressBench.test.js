import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  expectedCardForState,
  renderStressReviewMarkdown,
  reviewStressTrace,
  summarizeStressReviews,
} from '../scripts/review-stress-bench.js';
import { stressScheduleCardForce } from '../scripts/stress-schedule-card-force.js';
import { cardForStressState, cardForceScheduleFromStressPlants } from '../services/tutorStubCardForce.js';

// A small trace with three plants, each answering the four questions differently:
//  t2 jumping_ahead — detector read demand, card detected, model reply   (all four yes)
//  t4 irritated     — detector read neutral, card FORCED mockery, template (detection no, card yes, reply no)
//  t6 lost          — detector read quiet:confused, card detected, model  (quiet plant hit)
//  t8 frustrated    — detector read settled_claim (wrong kind), card detected but wrong, model
function writeTrace(dir) {
  const ev = [];
  const turn = (n, learner, tutor) => ev.push({ type: 'turn_complete', turn: n, turnRecord: { learner, tutor } });
  const plant = (n, state, rightRepair) =>
    ev.push({ type: 'learner_stress_plant', scheduleId: 'test_sched', turn: n, state, rightRepair, alsoRight: null });
  const sw = (n, pressure, cardActive) => ev.push({ type: 'tutor_manner_switch', turn: n, pressure, cardActive });
  const quiet = (n, quietType, cardActive) => ev.push({ type: 'tutor_quiet_detect', turn: n, quietType, cardActive });
  const force = (n, forced, withheld) =>
    ev.push({ type: 'tutor_card_force', turn: n, forced, withheld, cardActive: !withheld });
  const outcome = (n, o) => ev.push({ type: 'tutor_response_guard_accounting', turn: n, accounting: { outcome: o } });
  ev.push({ type: 'run_start', metadata: { world: { worldId: 'world_999_test' } } });
  for (let n = 1; n <= 8; n += 1) turn(n, `learner line ${n}`, `tutor line ${n}`);
  plant(2, 'jumping_ahead', 'reinforce_and_test');
  sw(2, 'demand', true);
  outcome(2, 'guarded_original_accepted');
  plant(4, 'irritated', 'change_tone');
  sw(4, 'neutral', true);
  force(4, 'mockery', false);
  outcome(4, 'guarded_deterministic_fallback');
  plant(6, 'lost', 'backtrack');
  sw(6, 'neutral', true);
  quiet(6, 'confused', true);
  outcome(6, 'guarded_original_accepted');
  plant(8, 'frustrated', 'reinforce_and_test');
  sw(8, 'settled_claim', true);
  outcome(8, 'guarded_original_accepted');
  const tracePath = path.join(dir, '2026-09-01T00-00-00-000Z.jsonl');
  fs.writeFileSync(tracePath, ev.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return tracePath;
}

test('the review keeps detection, card, reply and repair apart', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stress-review-'));
  const dir = path.join(tmp, 'traces', 'world_999_test', 'router-d0');
  fs.mkdirSync(dir, { recursive: true });
  const tracePath = writeTrace(dir);
  const review = reviewStressTrace(tracePath, { labelRoot: path.join(tmp, 'traces') });
  assert.equal(review.label, path.join('world_999_test', 'router-d0'));
  assert.equal(review.world, 'world_999_test');
  assert.equal(review.scheduleId, 'test_sched');
  const byTurn = Object.fromEntries(review.plants.map((p) => [p.turn, p]));
  assert.deepEqual(
    review.plants.map((p) => [p.turn, p.detectedRight, p.entry, p.cardRight, p.replyModel]),
    [
      [2, true, 'detected', true, true],
      [4, false, 'forced', true, false],
      [6, true, 'detected', true, true],
      [8, false, 'detected', false, true],
    ],
  );
  assert.equal(byTurn[8].wrongFire, true, 'a fire of the wrong kind is not a detection hit');
  assert.equal(byTurn[4].read, 'neutral', 'the forced card does not overwrite what the detector read');
  assert.equal(byTurn[6].card, 'quiet:confused');

  const summary = summarizeStressReviews([review]);
  assert.deepEqual(
    {
      scored: summary.pooled.scored,
      detectedRight: summary.pooled.detectedRight,
      wrongFire: summary.pooled.wrongFire,
      cardActive: summary.pooled.cardActive,
      cardForced: summary.pooled.cardForced,
      cardDetected: summary.pooled.cardDetected,
      cardRight: summary.pooled.cardRight,
      replyModel: summary.pooled.replyModel,
      replyTemplate: summary.pooled.replyTemplate,
    },
    {
      scored: 4,
      detectedRight: 2,
      wrongFire: 1,
      cardActive: 4,
      cardForced: 1,
      cardDetected: 3,
      cardRight: 3,
      replyModel: 3,
      replyTemplate: 1,
    },
  );
  const md = renderStressReviewMarkdown([review], summary);
  assert.match(md, /\| Detection recall \| 2\/4 \|/);
  assert.match(md, /\| Card delivery \| 4\/4 \| .*1 forced by the launcher, 3 detected live/);
  assert.match(md, /\| Reply delivery \| 3\/4 \|/);
  assert.match(md, /\| Repair right \| ruled by the author \|/, 'the bench never judges its own repairs');
  assert.match(md, /### t4 — irritated .* read=neutral MISS \*\*\[CARD forced mockery\]\*\* \*\*\[TEMPLATE\]\*\*/);
});

test('a trace without plants is not a bench run', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stress-review-none-'));
  const tracePath = path.join(tmp, 't.jsonl');
  fs.writeFileSync(tracePath, JSON.stringify({ type: 'turn_complete', turn: 1, turnRecord: {} }) + '\n');
  assert.equal(reviewStressTrace(tracePath), null);
});

test('expected cards come from the one shared plant map', () => {
  assert.equal(expectedCardForState('opposed'), 'stake');
  assert.equal(expectedCardForState('bored'), 'quiet:flat');
  assert.equal(expectedCardForState('lost'), 'quiet:confused');
  assert.equal(expectedCardForState('on_track'), null);
  assert.equal(cardForStressState('on_track'), null);
  assert.throws(() => cardForStressState('elated'), /no card for planted state 'elated'/);
});

test('a stress schedule turns into the forced-card arm with no word list', () => {
  const plants = [
    { turn: 2, state: 'jumping_ahead' },
    { turn: 3, state: 'on_track' },
    { turn: 6, state: 'lost' },
    { turn: 10, state: 'opposed' },
  ];
  assert.equal(cardForceScheduleFromStressPlants(plants), '2=demand,6=quiet:confused,10=stake');
  // The ratified world-030 schedule: the crossed run's oracle arm forced
  // 9=settled_claim,10=stake at exactly these plants.
  const out = stressScheduleCardForce('config/drama-derivation/stress/world-030-stress-schedule.yaml');
  assert.equal(out.scheduleId, 'world_030_stress_1');
  assert.equal(out.cardForce, '2=demand,4=mockery,6=quiet:confused,8=grievance,9=settled_claim,10=stake');
});
