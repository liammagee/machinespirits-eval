import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIRST_DRAFT_BLIND_RATINGS_SCHEMA,
  buildTutorStubFirstDraftBlindReview,
  compileTutorStubFirstDraftBlindReview,
  extractTutorStubFirstDraftReviewRows,
  summarizeTutorStubFirstDraftReviewInventory,
  tutorStubFirstDraftBlindReviewHtml,
} from '../services/tutorStubFirstDraftBlindReview.js';

function events({ turn = 1, outcome = 'guarded_policy_repair_accepted', leakOk = true } = {}) {
  return [
    { type: 'tutor_opening', text: 'The archive lamp burns beside the wet page.' },
    { type: 'auto_learner_turn', turn, text: 'What should I write next?' },
    {
      type: 'tutor_response_guard_accounting',
      turn,
      accounting: {
        outcome,
        originalCandidate: {
          auditOk: outcome.startsWith('guarded_original_accepted'),
          candidate: { text: `Original reply ${turn}.` },
          audits: {
            deliveryOk: outcome.startsWith('guarded_original_accepted'),
            leakAudit: { ok: leakOk, leaks: leakOk ? [] : [{ type: 'future_evidence_surface' }] },
            actorialRealizationAudit: { issues: [{ type: 'missing_selected_performance_tactic' }] },
            responseConfigurationAudit: { realization_rate: 0.833 },
          },
        },
        finalDelivery: {
          source: outcome.startsWith('guarded_original_accepted') ? 'original_candidate' : 'policy_repair_candidate',
          candidate: { text: outcome.startsWith('guarded_original_accepted') ? `Original reply ${turn}.` : `Delivered repair ${turn}.` },
        },
      },
    },
    { type: 'turn_complete', turn, turnRecord: { learner: 'What should I write next?', tutor: `Delivered repair ${turn}.` } },
  ];
}

test('trace extraction keeps public context and excludes audit labels from candidate text', () => {
  const rows = extractTutorStubFirstDraftReviewRows({
    events: events(),
    tracePath: '/tmp/first-draft-generalization-v22-live/example/trace.jsonl',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].campaign, 'V22');
  assert.equal(rows[0].originalPublicSafe, true);
  assert.equal(rows[0].learner, 'What should I write next?');
  assert.equal(rows[0].context[0].speaker, 'Tutor');
});

test('blind corpus omits unsafe originals and hides source, verdict, campaign, and audit metadata', () => {
  const rows = [];
  for (let turn = 1; turn <= 8; turn += 1) {
    rows.push(
      ...extractTutorStubFirstDraftReviewRows({
        events: events({ turn, outcome: turn <= 4 ? 'guarded_policy_repair_accepted' : 'guarded_original_accepted' }),
        tracePath: `/tmp/first-draft-generalization-v${18 + (turn % 5)}-live/cell-${turn}/trace.jsonl`,
      }),
    );
  }
  rows.push(
    ...extractTutorStubFirstDraftReviewRows({
      events: events({ turn: 99, leakOk: false }),
      tracePath: '/tmp/first-draft-generalization-v22-live/unsafe/trace.jsonl',
    }),
  );
  const { blind, key } = buildTutorStubFirstDraftBlindReview({ rows, pairCount: 4, calibrationCount: 4 });
  assert.equal(blind.candidateCount, 12);
  assert.equal(JSON.stringify(blind).includes('unsafe'), false);
  assert.equal(JSON.stringify(blind).includes('rejected_original'), false);
  assert.equal(JSON.stringify(blind).includes('missing_selected_performance_tactic'), false);
  assert.equal(key.cases.length, 8);
  const html = tutorStubFirstDraftBlindReviewHtml(blind);
  assert.doesNotMatch(html, /policy_repair_candidate|rejected_original|V22/u);
});

test('unblinding reports paired quality without changing audit or safety status', () => {
  const rows = [];
  for (let turn = 1; turn <= 4; turn += 1) {
    rows.push(
      ...extractTutorStubFirstDraftReviewRows({
        events: events({ turn, outcome: turn <= 2 ? 'guarded_policy_repair_accepted' : 'guarded_original_accepted' }),
        tracePath: `/tmp/first-draft-generalization-v${20 + turn}-live/cell-${turn}/trace.jsonl`,
      }),
    );
  }
  const { blind, key } = buildTutorStubFirstDraftBlindReview({ rows, pairCount: 2, calibrationCount: 2 });
  const ratings = {
    schema: FIRST_DRAFT_BLIND_RATINGS_SCHEMA,
    cases: blind.cases.map((entry) => ({
      id: entry.id,
      preference: entry.kind === 'pair' ? entry.candidates[1].label : null,
      candidates: entry.candidates.map((candidate, index) => ({
        label: candidate.label,
        scores: Object.fromEntries(blind.dimensions.map((dimension) => [dimension, index + 3])),
      })),
    })),
  };
  const report = compileTutorStubFirstDraftBlindReview({ blind, key, ratings });
  assert.equal(report.candidateCount, 6);
  assert.equal(report.pairCount, 2);
  assert.equal(Object.values(report.bySourceClass).reduce((sum, row) => sum + row.n, 0), 6);
});

test('inventory separates evidence safety from trajectory and conversational failures', () => {
  const safeRejected = extractTutorStubFirstDraftReviewRows({
    events: events({ turn: 1, outcome: 'guarded_policy_repair_accepted' }),
    tracePath: '/tmp/first-draft-generalization-v22-live/safe/trace.jsonl',
  });
  const unsafeRejected = extractTutorStubFirstDraftReviewRows({
    events: events({ turn: 2, outcome: 'guarded_policy_repair_accepted', leakOk: false }),
    tracePath: '/tmp/first-draft-generalization-v22-live/unsafe/trace.jsonl',
  });
  const accepted = extractTutorStubFirstDraftReviewRows({
    events: events({ turn: 3, outcome: 'guarded_original_accepted' }),
    tracePath: '/tmp/first-draft-generalization-v22-live/accepted/trace.jsonl',
  });
  const inventory = summarizeTutorStubFirstDraftReviewInventory([...safeRejected, ...unsafeRejected, ...accepted]);
  assert.equal(inventory.tutorTurns, 3);
  assert.equal(inventory.originalAccepted, 1);
  assert.equal(inventory.rejectedPublicSafe, 1);
  assert.equal(inventory.unsafeOriginalsExcludedFromReview, 1);
  assert.equal(inventory.rejectedSafeIssueFamilies.trajectory_realization, 1);
  assert.equal(inventory.shadowBuckets.trajectoryOnly, 1);
  assert.equal(inventory.shadowBuckets.noPublicIntegrityFailure, 1);
});
