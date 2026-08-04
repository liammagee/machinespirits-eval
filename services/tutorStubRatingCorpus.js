import crypto from 'node:crypto';

import {
  TUTOR_STUB_FEEDBACK_OBSERVATION_SCHEMA,
  TUTOR_STUB_FEEDBACK_RATING_RECORD_SCHEMA,
  tutorStubFeedbackRatingId,
} from './tutorStubFeedbackLearning.js';

export const TUTOR_STUB_RATING_CANDIDATE_SCHEMA = 'machinespirits.tutor-stub.rating-candidate.v1';
export const TUTOR_STUB_RATING_EXCLUSION_SCHEMA = 'machinespirits.tutor-stub.rating-exclusion.v1';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function isFeedbackRecord(value) {
  return [TUTOR_STUB_FEEDBACK_RATING_RECORD_SCHEMA, TUTOR_STUB_FEEDBACK_OBSERVATION_SCHEMA].includes(value?.schema);
}

export function migrateTutorStubFeedbackRecord(record) {
  if (!isFeedbackRecord(record)) return record;
  const ratedResponse = record.ratedResponse || {};
  const responseSha256 =
    ratedResponse.responseSha256 ||
    sha256(
      String(ratedResponse.text || '')
        .replace(/\s+/gu, ' ')
        .trim(),
    );
  const ratingId =
    record.ratingId ||
    tutorStubFeedbackRatingId({
      targetTurn: {
        turn: ratedResponse.turn,
        turnId: ratedResponse.turnId,
        text: ratedResponse.text,
      },
      provenance: record.provenance || {},
    });
  return {
    ...record,
    ratingId,
    ratedResponse: {
      ...ratedResponse,
      displayed: ratedResponse.displayed ?? true,
      responseSha256,
    },
    ...(record.ratingId ? {} : { migration: 'stable_rating_id_from_source_run_turn_and_response_hash.v1' }),
  };
}

function candidateSplit(sourceGroupId) {
  const bucket = Number.parseInt(sha256(sourceGroupId).slice(0, 8), 16) % 100;
  if (bucket < 80) return 'train';
  if (bucket < 90) return 'dev';
  return 'heldout';
}

function normalizedText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function nearDuplicate(left, right) {
  const a = new Set(normalizedText(left).split(' ').filter(Boolean));
  const b = new Set(normalizedText(right).split(' ').filter(Boolean));
  if (Math.min(a.size, b.size) < 6) return false;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection) >= 0.92;
}

function activeSelectors(holdoutRecords = []) {
  const selectors = new Map();
  for (const record of holdoutRecords) {
    const key = record.assetId ? `asset:${record.assetId}` : `group:${record.sourceGroupId}`;
    if (!key || key === 'group:undefined') continue;
    selectors.set(key, record);
  }
  return selectors;
}

function eligibility(record, selectors, assets) {
  if (!record.ratingId || !record.ratedResponse?.responseSha256 || !record.ratedResponse?.text) {
    return 'malformed_rating_record';
  }
  if (record.ratedResponse.displayed !== true) return 'rated_response_not_confirmed_displayed';
  if (!['up', 'down'].includes(record.feedback?.rating)) return 'invalid_rating';
  const reuse = record.provenance?.trainingReuse;
  if (!reuse) return 'missing_training_reuse_policy';
  if (reuse.humanSubjectClass !== 'owner_operator') return 'external_or_unknown_human_data';
  if (reuse.status !== 'training_candidate' || reuse.effective !== 'on') return 'source_or_descendant_do_not_train';
  if (record.ratedResponse.safety?.passed !== true) return 'rated_response_failed_safety';
  const assetId = record.provenance?.sourceAssetId || record.provenance?.trace;
  const sourceGroupId = record.provenance?.runId;
  if (!assetId || !sourceGroupId) return 'missing_source_lineage';
  if (assets.get(assetId)?.status !== 'sealed') return 'source_asset_not_sealed_and_cataloged';
  if (selectors.get(`asset:${assetId}`)?.action === 'holdout') return 'source_asset_held_out';
  if (selectors.get(`group:${sourceGroupId}`)?.action === 'holdout') return 'source_group_held_out';
  return null;
}

export function collectTutorStubFeedbackRecords(events = []) {
  const records = [];
  for (const event of events) {
    for (const candidate of [event, event?.record, event?.observation]) {
      if (isFeedbackRecord(candidate)) records.push(migrateTutorStubFeedbackRecord(candidate));
    }
  }
  return records;
}

export function buildTutorStubRatingCandidates({ records = [], holdoutRecords = [], assetRecords = [] } = {}) {
  const byRatingId = new Map();
  for (const originalRecord of records.filter(isFeedbackRecord)) {
    const record = migrateTutorStubFeedbackRecord(originalRecord);
    const key = record.ratingId;
    if (!key) {
      byRatingId.set(`missing:${byRatingId.size}`, record);
      continue;
    }
    const previous = byRatingId.get(key);
    if (
      previous &&
      previous.ratedResponse?.responseSha256 &&
      record.ratedResponse?.responseSha256 &&
      previous.ratedResponse.responseSha256 !== record.ratedResponse.responseSha256
    ) {
      throw new Error(`ratingId collision with different response hashes: ${key}`);
    }
    if (!previous || record.schema === TUTOR_STUB_FEEDBACK_OBSERVATION_SCHEMA) byRatingId.set(key, record);
  }

  const selectors = activeSelectors(holdoutRecords);
  const assets = new Map(assetRecords.map((record) => [record.assetId, record]));
  const candidates = [];
  const exclusions = [];
  for (const record of byRatingId.values()) {
    const reason = eligibility(record, selectors, assets);
    if (reason) {
      exclusions.push({
        schema: TUTOR_STUB_RATING_EXCLUSION_SCHEMA,
        ratingId: record.ratingId || null,
        reason,
        sourceAssetId: record.provenance?.sourceAssetId || record.provenance?.trace || null,
        sourceGroupId: record.provenance?.runId || null,
      });
      continue;
    }
    const sourceAssetId = record.provenance.sourceAssetId || record.provenance.trace;
    const sourceGroupId = record.provenance.runId;
    const duplicate = candidates.find((candidate) => {
      const prior = candidate.trainingPayload.completion;
      return (
        candidate.source.responseSha256 === record.ratedResponse.responseSha256 ||
        normalizedText(prior) === normalizedText(record.ratedResponse.text) ||
        nearDuplicate(prior, record.ratedResponse.text)
      );
    });
    if (duplicate) {
      exclusions.push({
        schema: TUTOR_STUB_RATING_EXCLUSION_SCHEMA,
        ratingId: record.ratingId,
        reason:
          duplicate.source.responseSha256 === record.ratedResponse.responseSha256
            ? 'duplicate_response'
            : normalizedText(duplicate.trainingPayload.completion) === normalizedText(record.ratedResponse.text)
              ? 'normalized_duplicate_response'
              : 'near_duplicate_response',
        duplicateOfRatingId: duplicate.ratingId,
        sourceAssetId,
        sourceGroupId,
      });
      continue;
    }
    candidates.push({
      schema: TUTOR_STUB_RATING_CANDIDATE_SCHEMA,
      ratingId: record.ratingId,
      candidateStatus: 'candidate_not_approved',
      candidateType: record.feedback.rating === 'up' ? 'sft_candidate' : 'unpaired_negative_candidate',
      split: candidateSplit(sourceGroupId),
      source: {
        assetId: sourceAssetId,
        sourceGroupId,
        ratedTurnId: record.ratedResponse.turnId,
        responseSha256: record.ratedResponse.responseSha256,
        worldId: record.provenance.worldId || null,
      },
      trainingPayload: {
        completion: record.ratedResponse.text,
        promptReference: {
          trace: record.provenance.trace || null,
          turnId: record.ratedResponse.turnId,
        },
      },
      outcomes: {
        subjectiveHelpfulness: record.outcomes?.subjectiveHelpfulness ?? record.feedback.helpfulness,
        objectiveProgress: record.outcomes?.objectiveProgress ?? null,
        nextResponseAdaptation: record.outcomes?.nextResponseAdaptation ?? null,
      },
      policy: {
        humanSubjectClass: record.provenance.trainingReuse.humanSubjectClass,
        trainingReuseStatus: record.provenance.trainingReuse.status,
        safetyPassed: record.ratedResponse.safety.passed,
      },
    });
  }
  return { candidates, exclusions };
}
