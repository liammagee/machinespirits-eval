import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkShape,
  conditionOfDialogueId,
  DEFENSIVE_STRETCH_TURNS,
  findDefensiveStretches,
  GUARDED_PILOT_SHAPE,
  scoreGuardedPilotGate,
  scoreNoSilentDropsSlot,
  scoreSensorArmingSlot,
} from '../scripts/score-guarded-pilot-gate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The pilot run is a real paid artifact and is gitignored like every other run,
// so the checks over it run only where it exists.
const PILOT = path.join(ROOT, '.tutor-stub-auto-eval/guarded-learner-pilot-2026-08-15');
const PILOT_SKIP = fs.existsSync(PILOT) ? false : `pilot run absent (${PILOT}); archived in the private repo`;

const SUSTAINED = 'sustained_defended_overclaim:3_turns';

function turn({
  turn: n,
  signal = 'engaged_analytic',
  basis = 'none',
  policy = null,
  mode = 'active',
  enforced = null,
  delivered = 'stage_next_step',
  text = 'a reply',
} = {}) {
  return {
    turn: n,
    mode,
    signal,
    warrant_basis: basis,
    decision_kind: 'hold',
    revision_warranted: false,
    policy_action_family: policy,
    enforcement_logged: enforced !== null,
    enforcement_applied: enforced === true,
    desired_action_family: enforced === null ? null : policy,
    delivered_action_family: delivered,
    delivered_text_present: Boolean(text),
    delivered_text_chars: text ? text.length : 0,
  };
}

const dialogue = (id, condition, turns) => ({ dialogue_id: id, condition, turns });

test('a stretch needs three consecutive defended turns, and a break ends it', () => {
  assert.equal(DEFENSIVE_STRETCH_TURNS, 3);
  const broken = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
    turn({ turn: n, signal: n === 3 || n === 6 ? 'engaged_analytic' : 'defended_overclaim' }),
  );
  assert.deepEqual(findDefensiveStretches(broken), []);
  const held = [1, 2, 3, 4].map((n) => turn({ turn: n, signal: 'defended_overclaim' }));
  assert.deepEqual(findDefensiveStretches(held), [[1, 2, 3, 4]]);
  const two = [1, 2, 3, 4].map((n) => turn({ turn: n, signal: n <= 2 ? 'defended_overclaim' : 'engaged_analytic' }));
  assert.deepEqual(findDefensiveStretches(two), []);
});

test('slot (a) counts only dialogues that carry a stretch, and only arming inside one', () => {
  const carries = (id, armAt) =>
    dialogue(
      id,
      'gated',
      [1, 2, 3, 4, 5].map((n) =>
        turn({ turn: n, signal: 'defended_overclaim', basis: n === armAt ? SUSTAINED : 'none' }),
      ),
    );
  const noStretch = dialogue(
    'no-stretch-gated',
    'gated',
    [1, 2, 3, 4].map((n) => turn({ turn: n, signal: n % 2 ? 'defended_overclaim' : 'engaged_analytic' })),
  );
  const slot = scoreSensorArmingSlot([carries('one-gated', 3), carries('two-gated', 4), noStretch]);
  assert.equal(slot.dialogues_carrying_a_stretch, 2, 'the dialogue with no stretch leaves the denominator');
  assert.equal(slot.dialogues_armed_on_a_stretch, 2);
  assert.equal(slot.majority_needed, 2);
  assert.equal(slot.verdict, 'PASS');
});

test('slot (a) fails when the sensor arms outside every stretch', () => {
  const late = dialogue('late-gated', 'gated', [
    ...[1, 2, 3].map((n) => turn({ turn: n, signal: 'defended_overclaim' })),
    turn({ turn: 4, signal: 'engaged_analytic', basis: SUSTAINED }),
  ]);
  const slot = scoreSensorArmingSlot([late]);
  assert.equal(slot.dialogues_carrying_a_stretch, 1);
  assert.equal(slot.dialogues_armed_on_a_stretch, 0);
  assert.equal(slot.verdict, 'FAIL');
});

test('slot (a) reports UNMEASURED rather than PASS when no dialogue carries a stretch', () => {
  const flat = dialogue(
    'flat-gated',
    'gated',
    [1, 2, 3].map((n) => turn({ turn: n })),
  );
  const slot = scoreSensorArmingSlot([flat]);
  assert.equal(slot.verdict, 'UNMEASURED');
  assert.match(slot.unmeasured_reason, /no gated dialogue carries a defensive stretch/);
});

test('slot (b) reads the selection from the policy, so a selection with no enforcement is a drop', () => {
  const dropped = dialogue('drop-gated', 'gated', [
    turn({ turn: 1, policy: 'challenge_resistance', enforced: null, delivered: 'stage_next_step' }),
  ]);
  const slot = scoreNoSilentDropsSlot([dropped]);
  assert.equal(slot.challenges_selected, 1, 'the selection is visible even though nothing enforced it');
  assert.equal(slot.silent_drops, 1);
  assert.equal(slot.verdict, 'FAIL');
  assert.equal(slot.dropped_rows[0].enforcement_logged, false);
});

test('slot (b) fails on a challenge that is selected and enforced but delivers another family or no text', () => {
  const swapped = dialogue('swap-gated', 'gated', [
    turn({ turn: 1, policy: 'challenge_resistance', enforced: true, delivered: 'stage_next_step' }),
  ]);
  assert.equal(scoreNoSilentDropsSlot([swapped]).verdict, 'FAIL');
  const silent = dialogue('silent-gated', 'gated', [
    turn({ turn: 1, policy: 'challenge_resistance', enforced: true, delivered: 'challenge_resistance', text: '' }),
  ]);
  assert.equal(scoreNoSilentDropsSlot([silent]).verdict, 'FAIL');
});

test('slot (b) treats an observe-mode selection as shadow, not as a drop', () => {
  const shadow = dialogue('shadow-bare', 'bare', [
    turn({ turn: 1, mode: 'observe', policy: 'challenge_resistance', enforced: null, delivered: 'stage_next_step' }),
  ]);
  const slot = scoreNoSilentDropsSlot([shadow]);
  assert.equal(slot.shadow_selections_not_gated, 1);
  assert.equal(slot.challenges_selected, 0);
  assert.equal(slot.verdict, 'UNMEASURED', 'a shadow-only set has no live selection to gate on');
});

test('the shape check refuses a half-measured run', () => {
  const short = [dialogue('one-gated', 'gated', [turn({ turn: 1 })])];
  const problems = checkShape(short);
  assert.ok(problems.some((row) => /expected 18 dialogues/.test(row)));
  assert.ok(problems.some((row) => /gate decisions, expected 8/.test(row)));
  const blind = [dialogue('two-gated', 'gated', [{ ...turn({ turn: 1 }), signal: null }])];
  assert.ok(checkShape(blind).some((row) => /no learner signal/.test(row)));
});

test('the condition comes off the dialogue id', () => {
  assert.equal(conditionOfDialogueId('outcome-pilot-04-world_102_marigold_archive_box-s515-gated'), 'gated');
  assert.equal(
    conditionOfDialogueId('outcome-pilot-03-world_101_kestrel_signal_lamp-s515-standing_permission'),
    'standing_permission',
  );
  assert.equal(conditionOfDialogueId('outcome-pilot-01-world_101_kestrel_signal_lamp-s515-bare'), 'bare');
});

test('the pilot run scores against its registered shape', { skip: PILOT_SKIP }, () => {
  const report = scoreGuardedPilotGate(PILOT);
  assert.deepEqual(report.shape_problems, [], 'every registered measure is present');
  assert.equal(report.dialogues.length, GUARDED_PILOT_SHAPE.dialogues);
  assert.equal(report.dialogues.filter((row) => row.condition === 'gated').length, GUARDED_PILOT_SHAPE.gated_dialogues);
  // The gate runs live only in the gated arm; the other two arms shadow it.
  for (const row of report.dialogues) {
    const modes = new Set(row.turns.map((entry) => entry.mode));
    assert.deepEqual([...modes], [row.condition === 'gated' ? 'active' : 'observe'], row.dialogue_id);
  }
  assert.equal(report.verdict, 'PASS');
  assert.equal(report.licenses_main_block, true);
});
