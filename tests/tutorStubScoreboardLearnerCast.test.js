import assert from 'node:assert/strict';
import test from 'node:test';

import { buildScoreboard, loadScoreboardWorld } from '../services/tutorStubScoreboard.js';
import {
  SCOREBOARD_CAST_PROFILES,
  buildScoreboardCastEvents,
  checkScoreboardLearnerCast,
  preflightScoreboardLearnerCast,
  renderScoreboardCastReport,
  scoreboardLearnerCasts,
} from '../services/tutorStubScoreboardLearnerCast.js';
import { readShape } from '../services/tutorStubScoreboardShapes.js';

const WORLD_IDS = ['world_101_kestrel_signal_lamp', 'world_102_marigold_archive_box'];
const worlds = WORLD_IDS.map((id) => loadScoreboardWorld(id, { rootDir: process.cwd() }));

test('both casts pass in both Step 2 worlds under both tutor versions with zero calls', () => {
  const preflight = preflightScoreboardLearnerCast({ worlds, policies: ['board', 'board_blind'] });
  assert.equal(preflight.modelCalls, 0);
  assert.equal(preflight.results.length, 8);
  assert.equal(preflight.ok, true, renderScoreboardCastReport(preflight));
  for (const r of preflight.results) {
    assert.equal(r.unread, 0);
    assert.equal(r.everyTriggerFired, true);
    assert.equal(r.readShape, r.castShape);
    assert.equal(r.triggers.length, 8);
  }
});

test('each trigger of each contract fires at least once in eight turns', () => {
  for (const world of worlds) {
    const casts = scoreboardLearnerCasts(world);
    for (const profile of SCOREBOARD_CAST_PROFILES) {
      const { firing } = buildScoreboardCastEvents({ world, profile });
      for (const trig of casts[profile].triggers) {
        assert.ok(
          firing.some((f) => f.trigger === trig.id),
          `${world.id} ${profile}: trigger ${trig.id} never fires`,
        );
      }
    }
  }
});

test('the casts do not read as each other', () => {
  for (const world of worlds) {
    const low = checkScoreboardLearnerCast({ world, profile: 'low_agency' });
    const over = checkScoreboardLearnerCast({ world, profile: 'overconfident' });
    assert.equal(low.readShape, 'permission_seeking');
    assert.equal(over.readShape, 'overconfident');
    assert.deepEqual(low.truthy, ['permission_seeking']);
    assert.deepEqual(over.truthy, ['overconfident']);
  }
});

test('the reader tells a licensed claim from a leap: a fully public chain makes the culprit claim warranted', () => {
  // Same overconfident lines, but the tutor releases every premise first.
  const world = worlds[0];
  const { events } = buildScoreboardCastEvents({ world, profile: 'overconfident', turns: 2 });
  const opening = events.find((e) => e.type === 'tutor_opening');
  const allIds = world.premises.map((p) => p.id);
  const releaseAll = {
    type: 'turn_complete',
    turn: 1,
    turnId: 't1',
    turnRecord: {
      turn: 1,
      turnId: 't1',
      learner: 'Where should we start?',
      tutor: 'Here is the whole record.',
      tutorLearnerDagUpdate: {
        preflight: { eligiblePublicPremiseIds: allIds },
        accepted: { adopt: [], retract: [], derive: [], assertAnswer: null, hypothesis: null },
      },
      proofDebt: { open: [], repaidNow: [] },
      releasePacing: { releasedNow: allIds, dueNow: [] },
    },
  };
  const claim = events.find((e) => e.type === 'turn_complete' && e.turn === 1);
  const shifted = { ...claim, turn: 2, turnId: 't2', turnRecord: { ...claim.turnRecord, turn: 2, turnId: 't2' } };
  const board = buildScoreboard({ events: [events[0], opening, releaseAll, shifted], world, arm: 'board' });
  const row = board.rows.find((r) => r.speaker === 'learner' && r.turn === 2);
  assert.equal(row.fields.commitment_undertaken, 'secret');
  assert.equal(row.fields.entitlement_status, 'warranted');
  assert.notEqual(readShape(board).shape, 'overconfident');
});

test('an unknown profile fails closed', () => {
  assert.throws(() => checkScoreboardLearnerCast({ world: worlds[0], profile: 'diligent' }), /no scoreboard cast/u);
});

test('the report names PASS or FAIL on its first line and the zero call count', () => {
  const preflight = preflightScoreboardLearnerCast({ worlds: [worlds[0]], profiles: ['low_agency'] });
  const text = renderScoreboardCastReport(preflight);
  assert.match(text.split('\n')[0], /^Scoreboard learner cast preflight: PASS \(model calls: 0\)/u);
});
