import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_GUARD_SUMMARY_SCHEMA,
  compactTutorStubCloseoutCounts,
  countTutorStubCloseoutRows,
  summarizeTutorStubGuardAccounting,
  tutorStubPlainCloseoutReason,
  tutorStubPlainCloseoutStatus,
} from '../services/tutorStubCloseoutProjection.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('closeout counts preserve frequency-first and alphabetical tie ordering', () => {
  const rows = countTutorStubCloseoutRows(
    [{ key: 'beta' }, { key: 'alpha' }, { key: 'beta' }, { key: '' }, {}, { key: 'alpha' }],
    (row) => row.key,
  );
  assert.deepEqual(rows, [
    ['alpha', 2],
    ['beta', 2],
    ['unknown', 2],
  ]);
  assert.equal(compactTutorStubCloseoutCounts(rows), 'alpha 2, beta 2, unknown 2');
  assert.equal(compactTutorStubCloseoutCounts(rows, { limit: 2 }), 'alpha 2, beta 2');
  assert.equal(compactTutorStubCloseoutCounts([]), 'none');
});

test('closeout reason labels preserve every authored lifecycle phrase and normalize unknown values', () => {
  const expected = {
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
  for (const [reason, label] of Object.entries(expected)) {
    assert.equal(tutorStubPlainCloseoutReason(reason), label);
  }
  assert.equal(tutorStubPlainCloseoutReason('custom-closeout_reason'), 'custom closeout reason');
  assert.equal(tutorStubPlainCloseoutReason(), 'session ended');
});

test('closeout status preserves completion precedence and missing-evidence grammar', () => {
  assert.equal(
    tutorStubPlainCloseoutStatus({
      tutorLearnerDagModel: { assessment: { finalSecretEntailed: true, assertedSecret: true } },
      dialogueClosure: { lifecycle: { phase: 'closed' } },
    }),
    'The learner reached and stated the supported conclusion.',
  );
  assert.equal(
    tutorStubPlainCloseoutStatus({ dialogueClosure: { lifecycle: { phase: 'closed' } } }),
    'The conversation closed naturally from the public evidence.',
  );
  assert.equal(
    tutorStubPlainCloseoutStatus({ dialogueClosure: { lifecycle: { phase: 'awaiting_checkin' } } }),
    'The conclusion was stated; one optional final check-in remains.',
  );
  assert.equal(
    tutorStubPlainCloseoutStatus({ tutorLearnerDagModel: { assessment: { finalSecretEntailed: true } } }),
    'The evidence supports the conclusion, but the learner has not fully stated it.',
  );
  assert.equal(
    tutorStubPlainCloseoutStatus({ tutorLearnerDagModel: { metrics: { missingPremiseCount: 1 } } }),
    '1 evidence step remains before the conclusion is fully supported.',
  );
  assert.equal(
    tutorStubPlainCloseoutStatus({ tutorLearnerDagModel: { assessment: { missingPremiseCount: 2 } } }),
    '2 evidence steps remain before the conclusion is fully supported.',
  );
  assert.equal(tutorStubPlainCloseoutStatus(null), 'The inquiry remains open.');
});

test('empty guard accounting preserves unaccounted turns, null rates, and the stable schema', () => {
  const summary = summarizeTutorStubGuardAccounting([{}, { tutorGuardAccounting: null }], {
    policy: 'dynamic',
    profile: 'diligent',
  });
  assert.equal(summary.schema, TUTOR_STUB_GUARD_SUMMARY_SCHEMA);
  assert.equal(summary.policy, 'dynamic');
  assert.equal(summary.profile, 'diligent');
  assert.equal(summary.turns, 2);
  assert.equal(summary.accountedTurns, 0);
  assert.equal(summary.originalCandidateAcceptanceRate, null);
  assert.equal(summary.meanTutorGenerationLatencyMs, null);
  assert.equal(summary.meanOriginalCandidateLatencyMs, null);
  assert.deepEqual(summary.outcomes, {});
  assert.deepEqual(summary.deliveries, {});
  assert.deepEqual(summary.byPolicyProfile, [
    {
      policy: 'dynamic',
      profile: 'diligent',
      ...Object.fromEntries(
        Object.entries(summary).filter(([key]) => !['schema', 'policy', 'profile', 'byPolicyProfile'].includes(key)),
      ),
    },
  ]);
});

test('guard accounting aggregates repairs, latency, audit issues, spans, and dynamic guard namespaces exactly', () => {
  const turns = [
    { turn: 1 },
    {
      turn: 2,
      tutorGuardAccounting: {
        outcome: 'accepted',
        guards: { enabled: true },
        finalDelivery: { source: 'original_candidate', auditOk: true },
        repairsApplied: [],
        generation: { totalModelLatencyMs: 100, originalCandidateLatencyMs: 80 },
        attempts: [{ guardedSpans: [], repairedSpans: [], audits: {} }],
      },
    },
    {
      turn: 3,
      tutorGuardAccounting: {
        outcome: 'guarded_repaired',
        guards: { enabled: false },
        finalDelivery: { source: 'mechanical_candidate', auditOk: false },
        repairsApplied: [{ kind: 'mechanical_replace' }, { kind: 'model_rewrite' }],
        generation: { totalModelLatencyMs: 300, originalCandidateLatencyMs: 100 },
        attempts: [
          {
            guardedSpans: [{ guard: 'leak' }, { guard: 'custom_guard' }],
            repairedSpans: [{}],
            audits: {
              leakAudit: { ok: false, leaks: [{ type: 'unreleased_premise_content' }] },
              responseConfigurationAudit: {
                axes: { action_family: { visible: false, selected: 'clarify_term' } },
              },
            },
          },
          {
            guardedSpans: [{ guard: 'dramatic_release' }],
            repairedSpans: [{}, {}],
            audits: { dramaticReleaseAudit: { ok: false, issues: [] } },
          },
        ],
      },
    },
    {
      turn: 4,
      tutorGuardAccounting: {
        finalDelivery: { source: 'deterministic_fallback', auditOk: true },
        repairsApplied: [{ kind: 'model_plain_recovery' }],
        generation: { originalCandidateLatencyMs: 20 },
        attempts: [
          {
            guardedSpans: [{ guard: 'question_support' }],
            repairedSpans: [],
            audits: { questionSupportAudit: { ok: false, issues: [{ type: 'missing_bounded_choice' }] } },
          },
        ],
      },
    },
  ];
  const before = structuredClone(turns);
  const summary = summarizeTutorStubGuardAccounting(turns, { policy: 'dynamic', profile: 'diligent' });

  assert.deepEqual(turns, before, 'projection must not mutate completed turns');
  assert.deepEqual(
    {
      turns: summary.turns,
      accountedTurns: summary.accountedTurns,
      guardEnabledTurns: summary.guardEnabledTurns,
      originalCandidateAcceptedTurns: summary.originalCandidateAcceptedTurns,
      originalCandidateAcceptanceRate: summary.originalCandidateAcceptanceRate,
      mechanicalRepairTurns: summary.mechanicalRepairTurns,
      guardTriggeredTurns: summary.guardTriggeredTurns,
      modelRepairTurns: summary.modelRepairTurns,
      deterministicFallbackTurns: summary.deterministicFallbackTurns,
      repairActions: summary.repairActions,
      guardedSpans: summary.guardedSpans,
      repairedSpans: summary.repairedSpans,
      finalDeliveryAuditFailures: summary.finalDeliveryAuditFailures,
      totalTutorGenerationLatencyMs: summary.totalTutorGenerationLatencyMs,
      meanTutorGenerationLatencyMs: summary.meanTutorGenerationLatencyMs,
      totalOriginalCandidateLatencyMs: summary.totalOriginalCandidateLatencyMs,
      meanOriginalCandidateLatencyMs: summary.meanOriginalCandidateLatencyMs,
    },
    {
      turns: 4,
      accountedTurns: 3,
      guardEnabledTurns: 1,
      originalCandidateAcceptedTurns: 1,
      originalCandidateAcceptanceRate: 1 / 3,
      mechanicalRepairTurns: 1,
      guardTriggeredTurns: 2,
      modelRepairTurns: 2,
      deterministicFallbackTurns: 1,
      repairActions: 3,
      guardedSpans: 4,
      repairedSpans: 3,
      finalDeliveryAuditFailures: 1,
      totalTutorGenerationLatencyMs: 400,
      meanTutorGenerationLatencyMs: 400 / 3,
      totalOriginalCandidateLatencyMs: 200,
      meanOriginalCandidateLatencyMs: 200 / 3,
    },
  );
  assert.deepEqual(summary.outcomes, { accepted: 1, guarded_repaired: 1, unknown: 1 });
  assert.deepEqual(summary.deliveries, {
    original_candidate: 1,
    mechanical_candidate: 1,
    deterministic_fallback: 1,
  });
  assert.deepEqual(summary.guards.leak, { issues: 1, guardedSpans: 1 });
  assert.deepEqual(summary.guards.question_support, { issues: 1, guardedSpans: 1 });
  assert.deepEqual(summary.guards.dramatic_release, { issues: 1, guardedSpans: 1 });
  assert.deepEqual(summary.guards.response_configuration, { issues: 1, guardedSpans: 0 });
  assert.deepEqual(summary.guards.custom_guard, { issues: 0, guardedSpans: 1 });
  assert.deepEqual(summary.byPolicyProfile[0], {
    policy: 'dynamic',
    profile: 'diligent',
    ...Object.fromEntries(
      Object.entries(summary).filter(([key]) => !['schema', 'policy', 'profile', 'byPolicyProfile'].includes(key)),
    ),
  });
});

test('the CLI delegates pure closeout helpers while retaining report assembly and terminal output', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubCloseoutProjection.js'), 'utf8');

  assert.match(cliSource, /from '\.\.\/services\/tutorStubCloseoutProjection\.js';/u);
  assert.doesNotMatch(
    cliSource,
    /function (?:countBy|compactCounts|plainCloseoutReason|plainCloseoutStatus|summarizeTutorGuardAccounting)\s*\(/u,
  );
  assert.match(cliSource, /function printDialogueCloseout\s*\(/u);
  assert.doesNotMatch(serviceSource, /\b(?:fs|console|process|fetch)\s*\./u);
});
