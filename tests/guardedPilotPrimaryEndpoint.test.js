import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EVIDENCE_ACTS_NARROW,
  EVIDENCE_ACTS_WIDE,
  HOLDING_OUT_ACTS,
  findDeliveredChallenges,
  readContractOutcome,
  RESPONSE_WINDOW_TURNS,
  scoreGuardedPilotPrimaryEndpoint,
} from '../scripts/score-guarded-pilot-primary-endpoint.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The pilot is a paid artifact and is gitignored, like every other run.
const PILOT = path.join(ROOT, '.tutor-stub-auto-eval/guarded-learner-pilot-2026-08-15');
const PILOT_SKIP = fs.existsSync(PILOT) ? false : `pilot run absent (${PILOT}); archived in the private repo`;

function turn({ turn: n, mode = 'active', delivered = 'stage_next_step', text = 'a reply', basis = 'none' } = {}) {
  return {
    turn: n,
    mode,
    warrant_basis: basis,
    delivered_action_family: delivered,
    delivered_text_present: Boolean(text),
  };
}

const dialogue = (id, turns) => ({ dialogue_id: id, condition: 'gated', turns });

test('a delivered challenge needs live mode, the challenge family, and text that reached the learner', () => {
  const rows = findDeliveredChallenges([
    dialogue('live-gated', [
      turn({ turn: 1, delivered: 'challenge_resistance' }),
      turn({ turn: 2 }),
      turn({ turn: 3 }),
    ]),
    dialogue('shadow-bare', [{ ...turn({ turn: 1, delivered: 'challenge_resistance' }), mode: 'observe' }]),
    dialogue('silent-gated', [turn({ turn: 1, delivered: 'challenge_resistance', text: '' })]),
  ]);
  assert.equal(rows.length, 1, 'the shadow selection and the empty delivery are not delivered challenges');
  assert.deepEqual(rows[0].response_turns, [2, 3]);
  assert.equal(rows[0].censored, false);
});

test('a challenge near the end of the dialogue gets a short window, and says so', () => {
  const rows = findDeliveredChallenges([
    dialogue('late-gated', [turn({ turn: 7, delivered: 'challenge_resistance' }), turn({ turn: 8 })]),
  ]);
  assert.equal(RESPONSE_WINDOW_TURNS, 2);
  assert.deepEqual(rows[0].response_turns, [8]);
  assert.equal(rows[0].censored, true, 'a truncated window must be visible, not silently counted as a miss');
});

test('a demand for evidence is never counted as producing one', () => {
  assert.ok(!EVIDENCE_ACTS_NARROW.includes('learner_evidence_demand'));
  assert.ok(!EVIDENCE_ACTS_WIDE.includes('learner_evidence_demand'));
  assert.ok(HOLDING_OUT_ACTS.includes('learner_evidence_demand'));
  // The wide reading differs from the narrow one only by these two acts.
  assert.deepEqual(
    EVIDENCE_ACTS_WIDE.filter((act) => !EVIDENCE_ACTS_NARROW.includes(act)),
    ['analytic_contribution', 'criterion_question'],
  );
});

test('the gate contract is read off the turn after the challenge, and only for its own family', () => {
  const d = dialogue('basis-gated', [
    turn({ turn: 1, delivered: 'challenge_resistance' }),
    turn({ turn: 2, basis: 'contract_success:challenge_resistance:agentive_bounded_evidence_move' }),
    turn({ turn: 3, basis: 'contract_success:stage_next_step:something_else' }),
  ]);
  assert.equal(readContractOutcome(d, 1).contract_met, true);
  assert.equal(readContractOutcome(d, 2).contract_met, false, 'another family closing does not answer a challenge');
  assert.equal(readContractOutcome(d, 8).turn, null);
});

test('the pilot reads the endpoint in the gated arm only', { skip: PILOT_SKIP }, () => {
  const report = scoreGuardedPilotPrimaryEndpoint(PILOT);
  assert.equal(report.measured_never_gated, true, 'a null on this endpoint is a finding, never a gate');
  assert.equal(report.summary.delivered_challenges, 10);
  assert.equal(report.arms.bare.delivered_challenges, 0);
  assert.equal(report.arms.standing_permission.delivered_challenges, 0);
  // The narrow and wide readings disagree far too much to be reported as one number.
  assert.ok(report.summary.both_readers_wide > report.summary.both_readers_narrow);
  assert.equal(report.act_list_not_registered, true);
});
