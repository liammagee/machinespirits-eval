/**
 * Pure projection helpers for the tutor-stub closeout report. Terminal output,
 * trace persistence, runtime state, and the full report assembly remain in the
 * CLI; this module only converts completed turns into stable counts, labels,
 * status text, and guard-accounting aggregates.
 */

import { tutorStubDisplayDiagnosticLabel } from './tutorStubResponseDetails.js';
import { tutorStubGuardIssueRows } from './tutorStubGuardDisposition.js';

export const TUTOR_STUB_GUARD_SUMMARY_SCHEMA = 'machinespirits.tutor-stub.guard-accounting-summary.v1';

export function countTutorStubCloseoutRows(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function compactTutorStubCloseoutCounts(items, { limit = 5 } = {}) {
  if (!items.length) return 'none';
  return items
    .slice(0, limit)
    .map(([key, count]) => `${key} ${count}`)
    .join(', ');
}

export function tutorStubPlainCloseoutReason(reason) {
  const labels = {
    exit: 'ended by you',
    exit_requested_during_turn: 'ended by you while a response was being prepared',
    once: 'single-turn run complete',
    report: 'summary requested',
    report_during_turn: 'summary requested while the next response was being prepared',
    grounded_asserted_secret: 'the conclusion was supported and stated',
    auto_grounded: 'the automated conversation reached its conclusion',
    auto_safety_turn_cap: 'automation paused at its turn limit',
    auto_turn_limit: 'automation completed the requested number of turns',
    dialogue_grounded_closure: 'the conversation reached its natural ending',
    interactive_auto_grounded_closure: 'the automated conversation reached its natural ending',
    dialogue_closure_acknowledgement: 'the final check-in was completed',
  };
  return labels[reason] || tutorStubDisplayDiagnosticLabel(reason || 'session ended');
}

export function tutorStubPlainCloseoutStatus(turn) {
  const assessment = turn?.tutorLearnerDagModel?.assessment || {};
  const closure = turn?.dialogueClosure?.lifecycle || null;
  const missing = Number(
    turn?.tutorLearnerDagModel?.metrics?.missingPremiseCount ?? assessment.missingPremiseCount ?? 0,
  );
  if (assessment.finalSecretEntailed && assessment.assertedSecret)
    return 'The learner reached and stated the supported conclusion.';
  if (closure?.phase === 'closed') return 'The conversation closed naturally from the public evidence.';
  if (closure?.phase === 'awaiting_checkin') return 'The conclusion was stated; one optional final check-in remains.';
  if (assessment.finalSecretEntailed)
    return 'The evidence supports the conclusion, but the learner has not fully stated it.';
  if (missing > 0)
    return `${missing} evidence ${missing === 1 ? 'step remains' : 'steps remain'} before the conclusion is fully supported.`;
  return 'The inquiry remains open.';
}

export function summarizeTutorStubGuardAccounting(turns, { policy = null, profile = null } = {}) {
  const rows = turns.map((turn) => turn?.tutorGuardAccounting).filter(Boolean);
  const outcomes = {};
  const deliveries = {};
  const guards = {
    leak: { issues: 0, guardedSpans: 0 },
    human_scaffold: { issues: 0, guardedSpans: 0 },
    question_support: { issues: 0, guardedSpans: 0 },
    dramatic_release: { issues: 0, guardedSpans: 0 },
    response_composition: { issues: 0, guardedSpans: 0 },
    repetition: { issues: 0, guardedSpans: 0 },
    dialogue_closure: { issues: 0, guardedSpans: 0 },
  };
  let repairActions = 0;
  let originalCandidateAcceptedTurns = 0;
  let mechanicalRepairTurns = 0;
  let modelRepairTurns = 0;
  let deterministicFallbackTurns = 0;
  let guardTriggeredTurns = 0;
  let guardedSpans = 0;
  let repairedSpans = 0;
  let finalDeliveryAuditFailures = 0;
  let totalTutorGenerationLatencyMs = 0;
  let totalOriginalCandidateLatencyMs = 0;
  for (const row of rows) {
    outcomes[row.outcome || 'unknown'] = (outcomes[row.outcome || 'unknown'] || 0) + 1;
    const delivery = row.finalDelivery?.source || 'unknown';
    deliveries[delivery] = (deliveries[delivery] || 0) + 1;
    if (delivery === 'original_candidate') originalCandidateAcceptedTurns += 1;
    if (
      delivery !== 'original_candidate' &&
      (row.repairsApplied || []).some((repair) => String(repair.kind || '').startsWith('mechanical_'))
    ) {
      mechanicalRepairTurns += 1;
    }
    if (row.attempts?.[0]?.guardedSpans?.length) guardTriggeredTurns += 1;
    if (row.repairsApplied?.some((repair) => ['model_rewrite', 'model_plain_recovery'].includes(repair.kind))) {
      modelRepairTurns += 1;
    }
    if (delivery === 'deterministic_fallback') deterministicFallbackTurns += 1;
    repairActions += row.repairsApplied?.length || 0;
    if (row.finalDelivery?.auditOk === false) finalDeliveryAuditFailures += 1;
    totalTutorGenerationLatencyMs += Number(row.generation?.totalModelLatencyMs || 0);
    totalOriginalCandidateLatencyMs += Number(row.generation?.originalCandidateLatencyMs || 0);
    for (const attempt of row.attempts || []) {
      guardedSpans += attempt.guardedSpans?.length || 0;
      repairedSpans += attempt.repairedSpans?.length || 0;
      for (const issue of tutorStubGuardIssueRows(attempt.audits)) {
        const bucket = guards[issue.guard] || (guards[issue.guard] = { issues: 0, guardedSpans: 0 });
        bucket.issues += 1;
      }
      for (const span of attempt.guardedSpans || []) {
        const bucket = guards[span.guard] || (guards[span.guard] = { issues: 0, guardedSpans: 0 });
        bucket.guardedSpans += 1;
      }
    }
  }
  const metrics = {
    turns: turns.length,
    accountedTurns: rows.length,
    guardEnabledTurns: rows.filter((row) => row.guards?.enabled).length,
    originalCandidateAcceptedTurns,
    originalCandidateAcceptanceRate: rows.length ? originalCandidateAcceptedTurns / rows.length : null,
    mechanicalRepairTurns,
    guardTriggeredTurns,
    modelRepairTurns,
    deterministicFallbackTurns,
    repairActions,
    guardedSpans,
    repairedSpans,
    finalDeliveryAuditFailures,
    totalTutorGenerationLatencyMs,
    meanTutorGenerationLatencyMs: rows.length ? totalTutorGenerationLatencyMs / rows.length : null,
    totalOriginalCandidateLatencyMs,
    meanOriginalCandidateLatencyMs: rows.length ? totalOriginalCandidateLatencyMs / rows.length : null,
    outcomes,
    deliveries,
    guards,
  };
  return {
    schema: TUTOR_STUB_GUARD_SUMMARY_SCHEMA,
    policy,
    profile,
    ...metrics,
    byPolicyProfile: [{ policy, profile, ...metrics }],
  };
}
