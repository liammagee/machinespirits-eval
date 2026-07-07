import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyHiddenProofDebtRow,
  isHiddenProofDebtDiagnosis,
  summarizeAudit,
} from '../scripts/audit-hidden-proofdebt-failures.js';

test('hidden proofDebt audit includes only the static hidden reliability substrate', () => {
  assert.equal(isHiddenProofDebtDiagnosis({ pacingGuard: true, proofDebtGuard: true }), true);
  assert.equal(
    isHiddenProofDebtDiagnosis({ pacingGuard: true, proofDebtGuard: true, pacingGuardVisible: true }),
    false,
  );
  assert.equal(
    isHiddenProofDebtDiagnosis({ pacingGuard: true, proofDebtGuard: true, pacingGuardSelectiveV4: true }),
    false,
  );
  assert.equal(isHiddenProofDebtDiagnosis({ pacingGuard: true, proofDebtGuard: false }), false);
});

test('hidden proofDebt audit reclassifies old disengagement when current D-aware stall detector sees progress', () => {
  const diagnosis = {
    label: 'marrick-like-stale',
    verdict: 'disengagement',
    pacingGuard: true,
    proofDebtGuard: true,
    turnsPlayed: 19,
  };
  const result = {
    trajectory: [
      { turn: 14, D: 2, groundedCount: 9 },
      { turn: 15, D: 2, groundedCount: 9 },
      { turn: 16, D: 2, groundedCount: 9 },
      { turn: 17, D: 2, groundedCount: 9 },
      { turn: 18, D: 2, groundedCount: 9 },
      { turn: 19, D: 1, groundedCount: 9 },
    ],
    transcript: [{ turn: 14, meta: { release: 'p_flaw' } }],
  };

  const row = classifyHiddenProofDebtRow({ diagnosis, result, file: '/tmp/marrick-like-stale/diagnosis.json' });
  assert.equal(row.currentStall, null);
  assert.equal(row.currentClass, 'stale_detector_artifact');
  assert.equal(row.cleanCurrentFailure, false);
});

test('hidden proofDebt audit keeps true current stalls as replay candidates', () => {
  const diagnosis = {
    label: 'true-current-stall',
    verdict: 'disengagement',
    pacingGuard: true,
    proofDebtGuard: true,
    turnsPlayed: 8,
  };
  const result = {
    trajectory: [
      { turn: 3, D: 4, groundedCount: 5 },
      { turn: 4, D: 4, groundedCount: 5 },
      { turn: 5, D: 4, groundedCount: 5 },
      { turn: 6, D: 4, groundedCount: 5 },
      { turn: 7, D: 4, groundedCount: 5 },
      { turn: 8, D: 4, groundedCount: 5 },
    ],
    transcript: [{ turn: 3, meta: { release: 'p_a' } }],
  };

  const row = classifyHiddenProofDebtRow({ diagnosis, result, file: '/tmp/true-current-stall/diagnosis.json' });
  assert.equal(row.currentStall, 'disengagement');
  assert.equal(row.currentClass, 'current_detector_stall');
  assert.equal(row.cleanCurrentFailure, true);
});

test('hidden proofDebt audit summary selects no replay candidate when all failures are stale or bounded', () => {
  const summary = summarizeAudit([
    { archivedVerdict: 'grounded_anagnorisis', currentClass: 'grounded', worldId: 'w1', cleanCurrentFailure: false },
    {
      archivedVerdict: 'disengagement',
      currentClass: 'stale_detector_artifact',
      worldId: 'w2',
      cleanCurrentFailure: false,
    },
    {
      archivedVerdict: 'cap_reached',
      currentClass: 'bounded_window_nonterminal',
      worldId: 'w3',
      cleanCurrentFailure: false,
    },
  ]);
  assert.equal(summary.cleanCurrentFailures, 0);
  assert.equal(summary.replayCandidate, null);
});
