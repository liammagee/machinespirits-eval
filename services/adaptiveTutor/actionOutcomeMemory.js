import { ADAPTATION_ACTION_BY_TYPE } from './actionPolicy.js';
import {
  actionOutcomeEligibleSetForCandidates,
  actionOutcomeEligibleSetIncludes,
} from './actionOutcomeComparability.js';
import { tutorStubMoveFamilyForAction } from './tutorStubActionAdapter.js';

// A supplied, immutable evidence view. No storage access, model calls, learned
// weights, or scientific thresholds live here. Rates are descriptive uptake
// associations; they are not estimates of learning or causal action effects.
const OUTCOMES = new Set(['success', 'failure', 'partial', 'inconclusive', 'measurement_indeterminate']);
const REQUIRED_STRINGS = [
  'id',
  'dialogueId',
  'contractId',
  'worldId',
  'conditionId',
  'contextKey',
  'eligibleSetId',
  'actionType',
];

function timestamp(value) {
  return typeof value === 'string' ? Date.parse(value) : NaN;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function cellKey(row) {
  return JSON.stringify([
    row.contextKey,
    row.conditionId,
    row.eligibleSetId,
    row.worldId,
    row.family,
    row.supportLevel,
  ]);
}

function moveFamilyForAction(actionType) {
  if (!Object.hasOwn(ADAPTATION_ACTION_BY_TYPE, actionType)) throw new Error(`unknown action type: ${actionType}`);
  return tutorStubMoveFamilyForAction(actionType);
}

function normalizeRecord(row, cutoff) {
  if (REQUIRED_STRINGS.some((key) => typeof row?.[key] !== 'string' || !row[key].trim())) {
    return { reason: 'missing_identity_or_context' };
  }
  if (row.status !== 'closed') return { reason: 'not_closed' };
  if (row.delivery !== 'delivered' || row.deliveredActionType !== row.actionType) {
    return { reason: 'unverified_or_displaced_delivery' };
  }
  if (!OUTCOMES.has(row.outcome)) return { reason: 'unsupported_outcome' };
  if (!Number.isInteger(row.decisionTurn) || row.decisionTurn < 0 || row.observationTurn !== row.decisionTurn + 1)
    return { reason: 'not_next_public_turn' };
  const observedAt = timestamp(row.observedAt);
  if (!Number.isFinite(observedAt)) return { reason: 'missing_observation_time' };
  if (observedAt > cutoff) return { reason: 'after_cutoff' };
  const recordedAt = timestamp(row.recordedAt);
  if (!Number.isFinite(recordedAt) || recordedAt < observedAt) return { reason: 'invalid_recording_time' };
  if (recordedAt > cutoff) return { reason: 'recorded_after_cutoff' };
  if (!Number.isInteger(row.supportLevel) || row.supportLevel < 0 || row.supportLevel > 3)
    return { reason: 'missing_support_level' };
  let family;
  try {
    family = moveFamilyForAction(row.actionType);
  } catch {
    return { reason: 'unknown_action_type' };
  }
  if (!actionOutcomeEligibleSetIncludes(row.eligibleSetId, family)) {
    return { reason: 'invalid_eligible_set' };
  }
  if (!Array.isArray(row.supersedes ?? []) || (row.supersedes || []).some((id) => typeof id !== 'string')) {
    return { reason: 'invalid_supersession' };
  }
  return {
    record: {
      ...Object.fromEntries(REQUIRED_STRINGS.map((key) => [key, row[key]])),
      family,
      decisionTurn: row.decisionTurn,
      observationTurn: row.observationTurn,
      observedAt: new Date(observedAt).toISOString(),
      recordedAt: new Date(recordedAt).toISOString(),
      supportLevel: row.supportLevel,
      outcome: row.outcome,
      supersedes: [...new Set(row.supersedes || [])].sort(),
    },
  };
}

function observationKey(row) {
  const { id: _id, supersedes: _supersedes, recordedAt: _recordedAt, ...observation } = row;
  return JSON.stringify(observation);
}

function summarize(records) {
  const cells = new Map();
  for (const row of records) {
    const key = cellKey(row);
    if (!cells.has(key))
      cells.set(key, {
        contextKey: row.contextKey,
        conditionId: row.conditionId,
        eligibleSetId: row.eligibleSetId,
        worldId: row.worldId,
        family: row.family,
        supportLevel: row.supportLevel,
        success: 0,
        failure: 0,
        partial: 0,
        inconclusive: 0,
        measurement_indeterminate: 0,
        dialogueIds: new Set(),
        recordIds: [],
      });
    const cell = cells.get(key);
    cell[row.outcome] += 1;
    if (['success', 'failure'].includes(row.outcome)) cell.dialogueIds.add(row.dialogueId);
    cell.recordIds.push(row.id);
  }
  return [...cells.values()].map((cell) => ({
    ...cell,
    n: cell.success + cell.failure,
    dialogueIds: [...cell.dialogueIds].sort(),
    recordIds: cell.recordIds.sort(),
  }));
}

export function buildActionOutcomeMemory(
  records,
  { asOf, source, excludedWorldIds = [], excludedDialogueIds = [] } = {},
) {
  const cutoff = timestamp(asOf);
  if (!Array.isArray(records) || !Number.isFinite(cutoff) || typeof source !== 'string' || !source.trim()) {
    throw new Error('action outcome memory requires records, an explicit asOf, and a source label');
  }
  const excludedWorlds = new Set(excludedWorldIds);
  const excludedDialogues = new Set(excludedDialogueIds);
  const exclusions = [];
  const events = new Map();
  const identities = new Map();
  for (const raw of records) {
    const { record, reason } = normalizeRecord(raw, cutoff);
    const excluded =
      reason ||
      (excludedWorlds.has(raw.worldId) ? 'excluded_world' : null) ||
      (excludedDialogues.has(raw.dialogueId) ? 'excluded_dialogue' : null);
    if (excluded) {
      exclusions.push({ id: raw?.id ?? null, reason: excluded });
      continue;
    }
    const key = JSON.stringify([record.dialogueId, record.contractId]);
    if (identities.has(record.id) && identities.get(record.id) !== key) {
      throw new Error('action outcome memory record id reused across interventions');
    }
    identities.set(record.id, key);
    if (!events.has(key)) events.set(key, []);
    events.get(key).push(record);
  }
  const accepted = [];
  const conflicts = [];
  for (const rows of events.values()) {
    // Only explicit corrections of the same intervention can supersede it.
    // There is no "prefer success" or implicit newest-record-wins rule.
    const remaining = rows.filter(
      (row) =>
        !rows.some(
          (other) =>
            other.id !== row.id &&
            other.supersedes.includes(row.id) &&
            timestamp(other.recordedAt) > timestamp(row.recordedAt),
        ),
    );
    const observations = new Set(remaining.map(observationKey));
    if (observations.size !== 1) {
      for (const row of rows) conflicts.push({ ...row, reason: 'contradictory_records' });
      continue;
    }
    const kept = [...remaining].sort((a, b) => a.id.localeCompare(b.id))[0];
    accepted.push(kept);
    for (const row of rows) {
      if (row !== kept) exclusions.push({ id: row.id, reason: remaining.includes(row) ? 'duplicate' : 'superseded' });
    }
  }
  accepted.sort((a, b) => a.id.localeCompare(b.id));
  return freeze({
    source,
    asOf: new Date(cutoff).toISOString(),
    records: accepted,
    cells: summarize(accepted),
    conflicts,
    exclusions,
  });
}

export function scrambleActionOutcomeMemory(memory, conditionPermutation, { source } = {}) {
  const conditions = [
    ...new Set([...(memory?.records || []), ...(memory?.conflicts || [])].map((row) => row.conditionId)),
  ].sort();
  if (
    !memory?.records ||
    typeof conditionPermutation !== 'object' ||
    !conditionPermutation ||
    typeof source !== 'string' ||
    !source.trim() ||
    conditions.some((condition) => typeof conditionPermutation[condition] !== 'string') ||
    new Set(conditions.map((condition) => conditionPermutation[condition])).size !== conditions.length ||
    conditions.some((condition) => !conditions.includes(conditionPermutation[condition]))
  ) {
    throw new Error('condition scramble requires an explicit bijection over every observed condition');
  }
  const records = memory.records.map((row) => ({ ...row, conditionId: conditionPermutation[row.conditionId] }));
  const conflicts = (memory.conflicts || []).map((row) => ({
    ...row,
    conditionId: conditionPermutation[row.conditionId] || row.conditionId,
  }));
  return freeze({
    ...memory,
    source,
    records,
    conflicts,
    cells: summarize(records),
    control: { type: 'condition_scramble', source: memory.source },
  });
}

function checkPolicy(policy) {
  for (const key of ['minObservations', 'minDialogues']) {
    if (!Number.isInteger(policy[key]) || policy[key] < 1) throw new Error(`memory policy requires positive ${key}`);
  }
  if (!['exact_world', 'held_out_world'].includes(policy.scope))
    throw new Error('memory policy requires explicit scope');
  if (policy.scope === 'held_out_world' && (!Number.isInteger(policy.minWorlds) || policy.minWorlds < 1)) {
    throw new Error('held-out memory requires explicit minWorlds');
  }
  if (
    !Number.isFinite(policy.successFloor) ||
    policy.successFloor < 0 ||
    policy.successFloor > 1 ||
    !Number.isFinite(policy.penalty) ||
    policy.penalty <= 0 ||
    !Number.isFinite(policy.maxAgeMs) ||
    policy.maxAgeMs < 0
  ) {
    throw new Error('memory policy requires successFloor, positive penalty, and maxAgeMs; no defaults are scientific');
  }
}

export function planActionMemoryDemotions(memory, context, candidates, policy = {}) {
  const result = {
    source: memory?.source ?? null,
    asOf: memory?.asOf ?? null,
    conditionId: context?.conditionId ?? null,
    contextKey: context?.contextKey ?? null,
    eligibleSetId: context?.eligibleSetId ?? null,
    scope: policy.scope ?? null,
    disposition: 'abstain',
    reason: null,
    penalties: {},
    families: [],
  };
  const abstain = (reason) => ({ ...result, reason });
  if (policy.enabled !== true) return abstain('disabled');
  checkPolicy(policy);
  if (!context?.conditionId) return abstain('condition_not_detected');
  const now = timestamp(context.asOf);
  if (
    !Number.isFinite(now) ||
    !context.worldId ||
    !context.dialogueId ||
    !context.contextKey ||
    !context.eligibleSetId ||
    !Number.isInteger(context.supportLevel) ||
    context.supportLevel < 0 ||
    context.supportLevel > 3
  ) {
    return abstain('missing_decision_context');
  }
  if (!Array.isArray(memory?.records) || !Array.isArray(memory.conflicts) || !Number.isFinite(timestamp(memory.asOf)))
    return abstain('missing_memory');
  const candidateEligibleSet = actionOutcomeEligibleSetForCandidates(candidates, moveFamilyForAction);
  if (!candidateEligibleSet.comparative) return abstain('insufficient_family_overlap');
  if (candidateEligibleSet.id !== context.eligibleSetId) return abstain('candidate_eligible_set_mismatch');
  if (timestamp(memory.asOf) > now) return abstain('future_snapshot');
  const allRecords = [...memory.records, ...memory.conflicts];
  if (
    allRecords.some(
      (row) =>
        !Number.isFinite(timestamp(row.observedAt)) ||
        !Number.isFinite(timestamp(row.recordedAt)) ||
        timestamp(row.observedAt) > timestamp(row.recordedAt) ||
        timestamp(row.recordedAt) > timestamp(memory.asOf),
    )
  )
    return abstain('invalid_record_timing');
  if (allRecords.some((row) => row.dialogueId === context.dialogueId)) return abstain('current_dialogue_in_memory');
  if (policy.scope === 'held_out_world' && allRecords.some((row) => row.worldId === context.worldId)) {
    return abstain('evaluation_world_in_memory');
  }
  const matches = (row) =>
    row.contextKey === context.contextKey &&
    row.conditionId === context.conditionId &&
    row.eligibleSetId === context.eligibleSetId &&
    row.supportLevel === context.supportLevel &&
    (policy.scope === 'held_out_world' || row.worldId === context.worldId);
  if (memory.conflicts.some(matches)) return abstain('contradictory_records');
  const matched = memory.records.filter(matches);
  const fresh = matched.filter((row) => now - timestamp(row.observedAt) <= policy.maxAgeMs);
  if (!fresh.length) return abstain(matched.length ? 'stale_memory' : 'no_matching_records');
  if (fresh.some((row) => row.outcome === 'measurement_indeterminate')) return abstain('measurement_indeterminate');
  const cells = summarize(fresh);
  const families = [...new Set(candidates.map((row) => moveFamilyForAction(row.action_type)))];
  for (const family of families) {
    const rows = cells.filter((cell) => cell.family === family);
    const success = rows.reduce((sum, row) => sum + row.success, 0);
    const n = rows.reduce((sum, row) => sum + row.n, 0);
    const dialogues = new Set(rows.flatMap((row) => row.dialogueIds)).size;
    const worlds = rows.filter((row) => row.n > 0).map((row) => row.worldId);
    const rate = n ? success / n : null;
    const reason =
      n < policy.minObservations || dialogues < policy.minDialogues
        ? 'low_support'
        : policy.scope === 'held_out_world' && worlds.length < policy.minWorlds
          ? 'low_world_support'
          : policy.scope === 'held_out_world' &&
              rows.some((row) => row.n && row.success / row.n < policy.successFloor) &&
              rows.some((row) => row.n && row.success / row.n >= policy.successFloor)
            ? 'world_disagreement'
            : rate < policy.successFloor
              ? 'below_floor'
              : 'not_below_floor';
    result.families.push({
      family,
      success,
      n,
      dialogues,
      worlds,
      rate,
      reason,
      partial: rows.reduce((sum, row) => sum + row.partial, 0),
      inconclusive: rows.reduce((sum, row) => sum + row.inconclusive, 0),
      recordIds: rows.flatMap((row) => row.recordIds),
      staleRecords:
        matched.filter((row) => row.family === family).length - fresh.filter((row) => row.family === family).length,
    });
    if (reason === 'below_floor') {
      for (const candidate of candidates) {
        if (moveFamilyForAction(candidate.action_type) === family)
          result.penalties[candidate.action_type] = policy.penalty;
      }
    }
  }
  if (Object.keys(result.penalties).length) return { ...result, disposition: 'demote', reason: 'supported_low_rate' };
  return { ...result, reason: 'no_supported_demotion' };
}
