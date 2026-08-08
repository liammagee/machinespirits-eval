import assert from 'node:assert/strict';
import test from 'node:test';

import { authorizeTutorStubRankedCandidate, rankTutorStubGuardCandidates } from '../tutorStubGuardCandidateRanking.js';
import {
  decideTutorStubGuardDelivery,
  TUTOR_STUB_GUARD_BOUNDARY_POLICIES,
  tutorStubGuardIssueRows,
} from '../tutorStubGuardDisposition.js';
import { projectTutorStubGuardAttemptEnvelope } from '../tutorStubGuardAttemptProjection.js';
import { createTutorStubRecoveryAccountingRuntime } from '../tutorStubRecoveryAccountingRuntime.js';
import { createTutorStubTutorTerminalRuntime } from '../tutorStubTutorTerminalRuntime.js';

function auditsFor({ leak = [], question = [], actorial = [] } = {}) {
  const audits = {
    leakAudit: { ok: leak.length === 0, leaks: leak },
    questionSupportAudit: { ok: question.length === 0, issues: question },
    actorialRealizationAudit: { ok: actorial.length === 0, issues: actorial },
  };
  const deliveryDecision = decideTutorStubGuardDelivery(tutorStubGuardIssueRows(audits), {
    boundaryPolicy: TUTOR_STUB_GUARD_BOUNDARY_POLICIES.shadowAdvisory,
  });
  return { ...audits, deliveryOk: deliveryDecision.ok, deliveryDecision };
}

function attempt(kind, number, text, audits) {
  return {
    kind,
    attempt: number,
    candidate: { text },
    audits,
    provider: 'codex',
    model: 'test-model',
    generation: { latencyMs: number + 1, usage: { totalTokens: 1 }, tokenUsageAvailable: true },
  };
}

test('closest-candidate ranking excludes every contract-bearing draft before comparing quality findings', () => {
  const leaked = attempt(
    'original_candidate',
    0,
    'unsafe but superficially close',
    auditsFor({ leak: [{ type: 'unreleased_premise_content' }] }),
  );
  const qualityOnly = attempt(
    'plain_recovery_candidate',
    1,
    'safe model repair with two quality findings',
    auditsFor({
      question: [{ type: 'unanswerable_open_recall' }, { type: 'missing_direct_response' }],
    }),
  );

  const ranking = rankTutorStubGuardCandidates([leaked, qualityOnly]);

  assert.equal(ranking.selected.kind, 'plain_recovery_candidate');
  assert.equal(ranking.selected.attempt, 1);
  assert.equal(ranking.candidates[0].eligible, false);
  assert.equal(ranking.candidates[0].contractBlockers[0].category, 'public_evidence_integrity');
  assert.equal(ranking.selected.score.shadowHard, 2);
});

test('ranking minimizes live hard findings, then strict-column findings, then generation order', () => {
  const hardPlusAdvisory = attempt(
    'original_candidate',
    0,
    'one hard and one shadow advisory',
    auditsFor({
      question: [{ type: 'unanswerable_open_recall' }],
      actorial: [{ type: 'missing_selected_actorial_part' }],
    }),
  );
  const hardOnly = attempt(
    'plain_recovery_candidate',
    1,
    'one hard only',
    auditsFor({ question: [{ type: 'unanswerable_open_recall' }] }),
  );
  const laterTie = attempt(
    'self_correction_candidate',
    2,
    'same score, generated later',
    auditsFor({ question: [{ type: 'unanswerable_open_recall' }] }),
  );

  const ranking = rankTutorStubGuardCandidates([hardPlusAdvisory, laterTie, hardOnly]);

  assert.equal(ranking.selected.kind, 'plain_recovery_candidate');
  assert.deepEqual(ranking.selected.score, {
    shadowHard: 1,
    strictHard: 1,
    generationOrder: 1,
  });
});

test('authorizing the selected tail candidate preserves findings while making the bounded override explicit', () => {
  const audits = auditsFor({ question: [{ type: 'unanswerable_open_recall' }] });
  const ranking = rankTutorStubGuardCandidates([
    attempt('plain_recovery_candidate', 1, 'closest safe model repair', audits),
  ]);

  const authorized = authorizeTutorStubRankedCandidate(audits, ranking);

  assert.equal(authorized.deliveryOk, true);
  assert.equal(authorized.deliveryDecision.ok, true);
  assert.deepEqual(authorized.deliveryDecision.hardIssues, []);
  assert.deepEqual(authorized.deliveryDecision.advisoryIssues, [
    { type: 'unanswerable_open_recall', guard: 'question_support' },
  ]);
  assert.deepEqual(authorized.deliveryDecision.rankedCandidateOverride.overriddenHardIssues, [
    { type: 'unanswerable_open_recall', guard: 'question_support' },
  ]);
  assert.equal(authorized.deliveryDecision.provenance.fallbackSelectionPolicy, 'closest_non_contract_candidate_v1');
});

test('terminal delivery ships the ranked model response and records its selection instead of composing a template', () => {
  const trace = [];
  const appendTraceEvent = (target, event) => target.push(event);
  const accountingRuntime = createTutorStubRecoveryAccountingRuntime({
    TUTOR_GUARD_ACCOUNTING_SCHEMA: 'machinespirits.tutor-stub.guard-accounting.v1',
    appendTraceEvent,
    jsonClone(value) {
      return JSON.parse(JSON.stringify(value));
    },
    projectTutorStubGuardAttemptEnvelope,
    tutorStubGuardIssueRows,
  });
  const leakedAudits = auditsFor({ leak: [{ type: 'unreleased_premise_content' }] });
  const leaked = accountingRuntime.tutorGuardAttemptEnvelope({
    kind: 'original_candidate',
    attempt: 0,
    response: { text: 'unsafe original', provider: 'codex', model: 'test-model' },
    audits: leakedAudits,
  });
  const qualityAudits = auditsFor({
    question: [{ type: 'unanswerable_open_recall' }, { type: 'missing_direct_response' }],
  });
  const qualityOnly = accountingRuntime.tutorGuardAttemptEnvelope({
    kind: 'plain_recovery_candidate',
    attempt: 1,
    response: {
      text: 'closest safe model repair',
      provider: 'codex',
      model: 'test-model',
      promptSnapshot: { role: 'tutor_recovery' },
    },
    audits: qualityAudits,
  });
  const runTerminal = createTutorStubTutorTerminalRuntime({
    appendTraceEvent,
    attachTutorGuardAccounting: accountingRuntime.attachTutorGuardAccounting,
    authorizeTutorStubRankedCandidate,
    closestCandidateDelivery: true,
    rankTutorStubGuardCandidates,
  });
  const response = runTerminal({
    attempts: [leaked, qualityOnly],
    repairsApplied: [],
    attachTutorDraftAudits(candidate, audits) {
      candidate.deliveryDecision = audits.deliveryDecision;
      return candidate;
    },
    roleBase: 'tutor_stub_tutor',
    state: {},
    trace,
    tutorTurn: 1,
    guards: { enabled: true },
    canStreamTutor: false,
  });

  assert.equal(response.text, 'closest safe model repair');
  assert.equal(response.promptSnapshot.role, 'tutor_recovery');
  assert.equal(response.deterministicFallback, false);
  assert.equal(response.closestModelCandidate, true);
  assert.equal(response.guardAccounting.finalDelivery.source, 'closest_model_candidate');
  assert.equal(response.guardAccounting.finalDelivery.auditOk, true);
  assert.equal(response.guardAccounting.outcome, 'guarded_closest_model_candidate_selected');
  assert.equal(trace[0].type, 'tutor_response_closest_model_candidate');
  assert.equal(trace[0].selection.selected.kind, 'plain_recovery_candidate');
  assert.equal(trace[1].type, 'tutor_response_guard_accounting');
  assert.equal(response.guardAccounting.finalDelivery.selection.policy, 'closest_non_contract_candidate_v1');
});
