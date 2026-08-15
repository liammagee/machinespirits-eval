import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EVIDENCE_ACTS,
  HOLDING_OUT_ACTS,
  REJECTED_WIDE_ACTS,
  SECOND_COUNT_ACTS,
  findDeliveredChallenges,
  readContractOutcome,
  RESPONSE_WINDOW_TURNS,
  scoreGuardedPilotPrimaryEndpoint,
} from '../scripts/score-guarded-pilot-primary-endpoint.js';
import { ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS } from '../services/adaptiveWarrantSemanticEvents.js';

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
  // relay 106 built the demand and the request to be structurally identical.
  // They part on stance, so the demand sits with the holding-out acts.
  assert.ok(EVIDENCE_ACTS.includes('tutor_directed_public_result_request'));
  assert.ok(!EVIDENCE_ACTS.includes('learner_evidence_demand'));
  assert.ok(!SECOND_COUNT_ACTS.includes('learner_evidence_demand'));
  assert.ok(HOLDING_OUT_ACTS.includes('learner_evidence_demand'));
});

test('relay 116 gives every act in the vocabulary exactly one place', () => {
  // The note calls an act in two bands, or in none, a defect in itself.
  const NEITHER = [
    'tutor_selection_request',
    'learner_wording_request',
    'transfer_to_learner',
    'repair_request',
    'stall',
    'register_complaint',
    'repetition_complaint',
    'low_agency_deferral',
    'analytic_contribution',
    'other',
  ];
  const bands = [EVIDENCE_ACTS, SECOND_COUNT_ACTS, HOLDING_OUT_ACTS, NEITHER];
  const placed = bands.flat();
  assert.equal(placed.length, ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS.length, 'the bands cover the whole vocabulary');
  assert.equal(new Set(placed).size, placed.length, 'no act sits in two bands');
  for (const act of ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS) {
    assert.ok(placed.includes(act), `${act} has no band; relay 116 §4 must name it`);
  }
  // Reasoning aloud is turned down, and the turned-down reading is kept.
  assert.ok(!EVIDENCE_ACTS.includes('analytic_contribution'));
  assert.ok(REJECTED_WIDE_ACTS.includes('analytic_contribution'));
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
  assert.equal(report.act_list_registered, true);
  assert.equal(report.summary.delivered_challenges, 10);
  assert.equal(report.arms.bare.delivered_challenges, 0);
  assert.equal(report.arms.standing_permission.delivered_challenges, 0);
  assert.equal(report.summary.both_readers, 3, 'the endpoint under the registered list');
  assert.equal(report.summary.either_reader, 4);
  // relay 116 §2 guard: neither second-count act appears, so where they sit
  // cannot have been chosen to move this pilot's number.
  assert.equal(report.summary.both_readers_second_count, 0);
  // The turned-down reading stays computed, so the record shows what it was.
  assert.equal(report.summary.both_readers_rejected_wide, 9);
  assert.equal(report.summary.gate_contract_met, 7, 'the gate over-counts, and is never the endpoint');
});
