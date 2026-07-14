import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_QUARANTINE_CONTINUATION,
  auditTutorStubQuarantineContinuation,
  classifyTutorStubDiagnosticFailure,
  normalizeTutorStubLoopMode,
  restoreTutorStubDiagnosticTransaction,
  snapshotTutorStubDiagnosticTransaction,
  summarizeTutorStubDiagnosticCollection,
} from '../tutorStubDiagnosticCollection.js';

function attempt(kind, attemptIndex, guard, type, text) {
  const audits = {
    leakAudit: { ok: true, leaks: [] },
    scaffoldAudit: { ok: true, issues: [] },
    questionSupportAudit: { ok: true, issues: [] },
    dramaticReleaseAudit: { ok: true, issues: [] },
    actorialRealizationAudit: { ok: true, issues: [] },
    responseCompositionAudit: { ok: true, issues: [] },
    repetitionAudit: { ok: true, issues: [] },
    closureAudit: { ok: true, issues: [] },
  };
  const key = {
    leak: ['leakAudit', 'leaks'],
    dramatic_release: ['dramaticReleaseAudit', 'issues'],
    actorial_realization: ['actorialRealizationAudit', 'issues'],
    response_composition: ['responseCompositionAudit', 'issues'],
    question_support: ['questionSupportAudit', 'issues'],
  }[guard];
  audits[key[0]][key[1]] = [{ type, reason: `${type} reason` }];
  audits[key[0]].ok = false;
  return {
    kind,
    attempt: attemptIndex,
    provider: 'codex',
    model: 'gpt-test',
    candidate: { text },
    audits,
  };
}

test('normalizes the two loop modes and their descriptive aliases', () => {
  assert.equal(normalizeTutorStubLoopMode('strict_verification'), 'strict');
  assert.equal(normalizeTutorStubLoopMode('diagnostic-collection'), 'diagnostic');
  assert.throws(() => normalizeTutorStubLoopMode('permissive'), /strict or diagnostic/u);
});

test('the quarantine continuation is fixed and mechanically audited', () => {
  const audit = auditTutorStubQuarantineContinuation(TUTOR_STUB_QUARANTINE_CONTINUATION);
  assert.equal(audit.ok, true);
  assert.equal(audit.addsScenarioEvidence, false);
  assert.equal(auditTutorStubQuarantineContinuation('A scenario-specific clue').ok, false);
});

test('diagnostic failure classification aborts infrastructure and quarantines response exhaustion', () => {
  const exhausted = new Error('fallback failed');
  exhausted.code = 'TUTOR_FALLBACK_AUDIT_FAILED';
  assert.equal(classifyTutorStubDiagnosticFailure(exhausted).disposition, 'quarantine');
  const network = new Error('network timed out');
  network.code = 'ETIMEDOUT';
  assert.equal(classifyTutorStubDiagnosticFailure(network).disposition, 'abort');
  assert.equal(classifyTutorStubDiagnosticFailure(new TypeError('bad state')).category, 'irrecoverable_state_corruption');
});

test('diagnostic transaction rollback restores all mutable teaching state but leaves trace ownership alone', () => {
  const state = {
    history: [{ role: 'assistant', content: 'opening' }],
    turns: [{ turn: 1 }],
    learnerDag: { grounded: ['p1'] },
    comprehension: { unresolved: ['cupel'] },
    releasePacing: { released: ['p1'], pending: ['p2'] },
    register: { current: 'precise', history: ['precise'] },
    dialogueClosure: { phase: 'open' },
    typedActions: { ledger: [] },
    pointOfAction: { current: null, history: [] },
    coach: { pending: [], history: [] },
    trace: { filePath: 'preserved.jsonl' },
    diagnosticCollection: { quarantinedTurns: [] },
  };
  const snapshot = snapshotTutorStubDiagnosticTransaction(state);
  state.history.push({ role: 'user', content: 'unsafe attempt' });
  state.turns.push({ turn: 2 });
  state.learnerDag.grounded.push('p2');
  state.releasePacing.released.push('p2');
  state.register.current = 'charismatic';
  restoreTutorStubDiagnosticTransaction(state, snapshot);
  assert.deepEqual(state.history, [{ role: 'assistant', content: 'opening' }]);
  assert.deepEqual(state.turns, [{ turn: 1 }]);
  assert.deepEqual(state.learnerDag.grounded, ['p1']);
  assert.deepEqual(state.releasePacing.released, ['p1']);
  assert.equal(state.register.current, 'precise');
  assert.equal(state.trace.filePath, 'preserved.jsonl');
  assert.deepEqual(state.diagnosticCollection.quarantinedTurns, []);
});

test('retains all candidates, marks contamination, and clusters duplicate root causes', () => {
  const turns = Array.from({ length: 10 }, (_, index) => ({ turn: index + 1 }));
  turns[2] = {
    turn: 3,
    quarantined: true,
    tutorGuardAccounting: {
      attempts: [
        attempt('original_candidate', 0, 'actorial_realization', 'missing_selected_performance_tactic', 'draft one'),
        attempt('model_repair_candidate', 1, 'actorial_realization', 'missing_selected_performance_tactic', 'draft two'),
        attempt('deterministic_fallback', 2, 'dramatic_release', 'missing_exhibit_action', 'fallback'),
      ],
    },
  };
  const summary = summarizeTutorStubDiagnosticCollection(turns);
  assert.equal(summary.completedTenTurnBatch, true);
  assert.equal(summary.firstQuarantinedTurn, 3);
  assert.equal(summary.evidenceSegments.cleanPrefix.throughPublicTurn, 2);
  assert.equal(summary.evidenceSegments.boundaryAttempts.candidateCount, 3);
  assert.equal(summary.evidenceSegments.contaminatedSuffix.turnCount, 8);
  assert.deepEqual(summary.candidates.map((candidate) => candidate.text), ['draft one', 'draft two', 'fallback']);
  const duplicate = summary.duplicateFailureClusters.find(
    (cluster) => cluster.issueType === 'missing_selected_performance_tactic',
  );
  assert.equal(duplicate.occurrences, 2);
  assert.equal(duplicate.rootCause, 'character_and_clue_enactment');
});
