import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTutorStubFeedbackObservation,
  buildTutorStubFeedbackRatingRecord,
} from '../services/tutorStubFeedbackLearning.js';
import { buildTutorStubRatingCandidates, migrateTutorStubFeedbackRecord } from '../services/tutorStubRatingCorpus.js';
import { resolveTutorStubTrainingReuse } from '../services/tutorStubTrainingReuse.js';

function fixture({
  rating = 'up',
  reuse = resolveTutorStubTrainingReuse(),
  runId = 'run-1',
  tutorText = 'What evidence supports that conclusion?',
} = {}) {
  const feedback = { supplied: true, rating, targetTutorTurn: 1, targetTutorTurnId: `${runId}:t001` };
  const targetTurn = {
    turn: 1,
    turnId: `${runId}:t001`,
    tutor: tutorText,
    tutorLeakAudit: { ok: true },
  };
  const provenance = {
    runId,
    trace: `traces/${runId}.jsonl`,
    sourceAssetId: `trace-${runId}`,
    trainingReuse: reuse,
    worldId: 'world-1',
  };
  const immediate = buildTutorStubFeedbackRatingRecord({ feedback, targetTurn, provenance });
  const enriched = buildTutorStubFeedbackObservation({
    feedback,
    targetTurn,
    learnerTurn: { turn: 2, turnId: `${runId}:t002`, text: 'The log matches.' },
    currentTurn: { turn: 2, turnId: `${runId}:t002`, tutor: 'Now compare the timestamp.' },
    previousRegisterEfficacy: { label: 'advance', progressScore: 0.5 },
    adaptationAudit: { passed: true, observableChange: true },
    provenance,
  });
  return { immediate, enriched };
}

function assetRecords(...fixtures) {
  return fixtures.map(({ enriched }) => ({
    assetId: enriched.provenance.sourceAssetId,
    status: 'sealed',
  }));
}

test('immediate and enriched feedback records join through one stable rating ID', () => {
  const { immediate, enriched } = fixture();
  assert.match(immediate.ratingId, /^rating_[a-f0-9]{64}$/u);
  assert.equal(enriched.ratingId, immediate.ratingId);
  assert.equal(immediate.ratedResponse.responseSha256, enriched.ratedResponse.responseSha256);
  assert.equal(immediate.ratedResponse.displayed, true);
});

test('legacy immediate and enriched records receive the same deterministic join ID', () => {
  const { immediate, enriched } = fixture({ runId: 'legacy-run' });
  delete immediate.ratingId;
  delete immediate.ratedResponse.responseSha256;
  delete immediate.ratedResponse.displayed;
  delete enriched.ratingId;
  delete enriched.ratedResponse.responseSha256;
  delete enriched.ratedResponse.displayed;
  const migratedImmediate = migrateTutorStubFeedbackRecord(immediate);
  const migratedEnriched = migrateTutorStubFeedbackRecord(enriched);
  assert.equal(migratedImmediate.ratingId, migratedEnriched.ratingId);
  assert.equal(migratedImmediate.ratedResponse.displayed, true);
  assert.match(migratedImmediate.migration, /stable_rating_id/u);
});

test('ratings export separates outcomes, strips comments, groups splits, and fails closed on reuse policy', () => {
  const owner = fixture({ rating: 'down', runId: 'owner-run' });
  owner.enriched.feedback.comment = 'private free text must not leave the trace';
  const external = fixture({
    runId: 'external-run',
    reuse: resolveTutorStubTrainingReuse({ humanSubjectClass: 'external_user' }),
  });
  const optedOut = fixture({ runId: 'off-run', reuse: resolveTutorStubTrainingReuse({ requested: 'off' }) });
  const result = buildTutorStubRatingCandidates({
    records: [owner.immediate, owner.enriched, external.enriched, optedOut.enriched],
    assetRecords: assetRecords(owner, external, optedOut),
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].candidateType, 'unpaired_negative_candidate');
  assert.equal(result.candidates[0].candidateStatus, 'candidate_not_approved');
  assert.equal(result.candidates[0].outcomes.subjectiveHelpfulness, -1);
  assert.equal(result.candidates[0].outcomes.objectiveProgress.progressScore, 0.5);
  assert.equal(result.candidates[0].outcomes.nextResponseAdaptation.passed, true);
  assert.equal(JSON.stringify(result.candidates).includes('private free text'), false);
  assert.deepEqual(result.exclusions.map((entry) => entry.reason).sort(), [
    'external_or_unknown_human_data',
    'source_or_descendant_do_not_train',
  ]);
});

test('a held-out source group cannot become a ratings candidate', () => {
  const owner = fixture({ runId: 'heldout-run' });
  const result = buildTutorStubRatingCandidates({
    records: [owner.enriched],
    assetRecords: assetRecords(owner),
    holdoutRecords: [
      {
        sourceGroupId: 'heldout-run',
        action: 'holdout',
        recordedAt: '2026-08-04T00:00:00.000Z',
      },
    ],
  });
  assert.equal(result.candidates.length, 0);
  assert.equal(result.exclusions[0].reason, 'source_group_held_out');
});

test('ratings candidates reject exact and near-duplicate responses across source groups', () => {
  const exactA = fixture({ runId: 'duplicate-a' });
  const exactB = fixture({ runId: 'duplicate-b' });
  const baseWords = Array.from({ length: 25 }, (_, index) => `token${index + 1}`);
  const nearA = fixture({ runId: 'near-a', tutorText: baseWords.join(' ') });
  const nearB = fixture({ runId: 'near-b', tutorText: [...baseWords.slice(0, -1), 'replacement'].join(' ') });
  const result = buildTutorStubRatingCandidates({
    records: [exactA.enriched, exactB.enriched, nearA.enriched, nearB.enriched],
    assetRecords: assetRecords(exactA, exactB, nearA, nearB),
  });
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.exclusions.map((entry) => entry.reason).sort(), [
    'duplicate_response',
    'near_duplicate_response',
  ]);
});
