import {
  buildActionOutcomeMemory,
  planActionMemoryDemotions,
  scrambleActionOutcomeMemory,
} from './actionOutcomeMemory.js';
import { ADAPTATION_ACTION_BY_TYPE, selectPedagogicalAction } from './actionPolicy.js';
import { tutorStubMoveFamilyForAction } from './tutorStubActionAdapter.js';
import { tutorStubTypedActionDecisionFromTurn } from '../tutorStubTypedActionRestoration.js';

export const ACTION_OUTCOME_MEMORY_READINESS_VERSION = 'action-outcome-memory-readiness.v1';

const OUTCOMES = new Set(['success', 'failure', 'partial', 'inconclusive', 'measurement_indeterminate']);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function timestamp(value) {
  return typeof value === 'string' ? Date.parse(value) : NaN;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function recordReason(counts, reason) {
  counts[reason] = (counts[reason] || 0) + 1;
}

function eventIndex(events) {
  const runStarts = events.filter((event) => event?.type === 'run_start');
  const runId = nonEmpty(runStarts[0]?.runId);
  const malformed = [];
  if (runStarts.length !== 1) malformed.push('run_start_count');
  if (!runId) malformed.push('missing_run_id');
  if (events.some((event) => event?.runId !== runId)) malformed.push('mixed_run_ids');
  const sequences = events.map((event) => event?.seq);
  if (sequences.some((seq) => !Number.isInteger(seq)) || new Set(sequences).size !== sequences.length) {
    malformed.push('invalid_or_duplicate_sequence');
  }
  if (sequences.some((seq, index) => index > 0 && seq <= sequences[index - 1])) {
    malformed.push('non_monotonic_sequence');
  }
  const times = events.map((event) => timestamp(event?.ts));
  if (times.some((time) => !Number.isFinite(time))) malformed.push('invalid_event_timestamp');
  if (times.some((time, position) => position > 0 && time < times[position - 1])) {
    malformed.push('non_monotonic_timestamp');
  }
  return {
    runId,
    runStart: runStarts[0] || null,
    malformed,
    decisions: events.filter((event) => event?.type === 'tutor_typed_action_decision'),
    outcomes: events.filter((event) => event?.type === 'tutor_typed_action_outcome_closed'),
    displacements: events.filter((event) => event?.type === 'tutor_typed_action_decision_displaced'),
    turns: events.filter((event) => event?.type === 'turn_complete' && event.turnRecord),
  };
}

function uniqueBy(rows, predicate) {
  return rows.filter(predicate);
}

function conditionForObservation(observation, conditions) {
  if (observation?.observed !== true) return { reason: 'memory_condition_not_observed' };
  const quantities = observation.quantities || {};
  if (![quantities.stagnation, quantities.fieldVelocity, quantities.dagVelocity].every(Number.isFinite)) {
    return { reason: 'invalid_memory_condition_quantities' };
  }
  const matches = (conditions || []).filter(
    (condition) =>
      quantities.stagnation >= condition.stagnationAtLeast &&
      Math.abs(quantities.fieldVelocity) <= condition.fieldVelocityAtMost &&
      Math.abs(quantities.dagVelocity) <= condition.dagVelocityAtMost,
  );
  if (matches.length === 0) return { reason: 'no_declared_condition_matched' };
  if (matches.length > 1) return { reason: 'overlapping_declared_conditions' };
  return { condition: matches[0], quantities };
}

function validateConditions(conditions) {
  if (!Array.isArray(conditions)) throw new Error('readiness conditions must be an array');
  const ids = new Set();
  for (const condition of conditions) {
    if (
      !nonEmpty(condition?.id) ||
      ids.has(condition.id) ||
      !Number.isFinite(condition.stagnationAtLeast) ||
      condition.stagnationAtLeast < 0 ||
      condition.stagnationAtLeast > 1 ||
      !Number.isFinite(condition.fieldVelocityAtMost) ||
      condition.fieldVelocityAtMost < 0 ||
      !Number.isFinite(condition.dagVelocityAtMost) ||
      condition.dagVelocityAtMost < 0
    ) {
      throw new Error('each readiness condition needs a unique id and explicit bounded stagnation/velocity values');
    }
    ids.add(condition.id);
  }
}

function reviewKey(runId, contractId) {
  return JSON.stringify([runId, contractId]);
}

function reviewIndex(reviews, cutoff) {
  if (!Array.isArray(reviews)) throw new Error('readiness reviews must be an array');
  const byKey = new Map();
  for (const review of reviews) {
    const key = reviewKey(review?.runId, review?.contractId);
    if (
      !nonEmpty(review?.runId) ||
      !nonEmpty(review?.contractId) ||
      review.method !== 'human' ||
      !nonEmpty(review.reviewer) ||
      !review.reviewer.startsWith('human:') ||
      !nonEmpty(review.reviewer.slice('human:'.length)) ||
      !nonEmpty(review.source) ||
      !Number.isFinite(timestamp(review.recordedAt)) ||
      !OUTCOMES.has(review.outcome) ||
      !nonEmpty(review.deliveredActionType) ||
      typeof review.tutorText !== 'string' ||
      typeof review.learnerText !== 'string'
    ) {
      throw new Error('each readiness review needs human provenance, exact public texts, delivery, outcome, and time');
    }
    if (timestamp(review.recordedAt) > cutoff) continue;
    if (byKey.has(key)) throw new Error(`duplicate readiness review for ${review.runId}/${review.contractId}`);
    byKey.set(key, clone(review));
  }
  return byKey;
}

function deliveredJoin({ decisionEvent, decisionTurn, outcomeEvent, observationTurn, displacement }) {
  const decision = decisionEvent?.decision;
  const closed = outcomeEvent?.outcome?.closed_record;
  const action = decision?.chosen_action;
  if (!decision || !closed || !action) return { reason: 'missing_decision_or_closed_outcome' };
  if (
    !Object.hasOwn(ADAPTATION_ACTION_BY_TYPE, action.action_type) ||
    action.move_family !== tutorStubMoveFamilyForAction(action.action_type) ||
    !Number.isInteger(action.support_level) ||
    action.support_level < 0 ||
    action.support_level > 3 ||
    !OUTCOMES.has(closed.outcome) ||
    outcomeEvent.outcome.outcome !== closed.outcome ||
    observationTurn?.typedActionPriorOutcome?.closed_record?.outcome !== closed.outcome
  )
    return { reason: 'inconsistent_action_or_outcome_record' };
  if (displacement) return { reason: 'displaced_before_delivery' };
  if (
    decisionEvent.phase !== 'before_tutor_output' ||
    decision.decision_provenance?.timing !== 'after_current_public_learner_observation_before_tutor_output'
  ) {
    return { reason: 'unverified_decision_timing' };
  }
  if (
    outcomeEvent.outcome?.decision_turn !== decisionEvent.turn ||
    outcomeEvent.outcome?.observation_turn !== outcomeEvent.turn ||
    outcomeEvent.turn !== decisionEvent.turn + 1 ||
    closed.turn_index !== decisionEvent.turn ||
    closed.closed_turn_index !== outcomeEvent.turn ||
    closed.contract_id !== decision.contract_id ||
    closed.action_type !== action.action_type ||
    closed.status !== 'closed'
  ) {
    return { reason: 'decision_outcome_join_mismatch' };
  }
  if (
    tutorStubTypedActionDecisionFromTurn(decisionTurn)?.contract_id !== decision.contract_id ||
    observationTurn?.typedActionPriorOutcome?.contract_id !== decision.contract_id ||
    observationTurn.learner !== outcomeEvent.outcome?.public_learner_observation
  ) {
    return { reason: 'turn_record_join_mismatch' };
  }
  const delivered = decisionTurn.deliveredResponseConfiguration;
  const audit = decisionTurn.responseConfigurationAudit;
  if (
    !delivered ||
    delivered.action_family !== action.move_family ||
    delivered.support_level !== action.support_level ||
    delivered.task_id !== action.task_id
  ) {
    return { reason: 'delivered_configuration_mismatch' };
  }
  if (!nonEmpty(decisionTurn.tutor) || !nonEmpty(observationTurn.learner)) return { reason: 'missing_public_text' };
  const finalDecision = tutorStubTypedActionDecisionFromTurn(decisionTurn);
  if (
    finalDecision?.delivery?.delivered === false ||
    finalDecision?.status === 'cancelled_before_delivery' ||
    /^(?:cancelled|displaced)(?:_|$)/u.test(finalDecision?.delivery?.disposition || '')
  ) {
    return { reason: 'displaced_before_delivery' };
  }
  if (finalDecision.chosen_action?.action_type !== action.action_type)
    return { reason: 'delivered_action_record_mismatch' };
  return {
    action,
    closed,
    tutorText: decisionTurn.tutor,
    learnerText: observationTurn.learner,
    auxiliaryDeliveryVisible:
      audit?.axes?.action_family?.selected === action.move_family && audit?.axes?.action_family?.visible === true,
  };
}

export function extractActionOutcomeMemoryEvidence({
  events,
  source,
  contextKey,
  conditions = [],
  reviews = [],
  asOf,
} = {}) {
  const cutoff = timestamp(asOf);
  if (!Array.isArray(events) || !nonEmpty(source) || !nonEmpty(contextKey) || !Number.isFinite(cutoff)) {
    throw new Error('evidence extraction needs events, source, contextKey, and an explicit asOf');
  }
  validateConditions(conditions);
  const reviewsByKey = reviewIndex(reviews, cutoff);
  const fullIndex = eventIndex(events);
  const index = eventIndex(events.filter((event) => timestamp(event?.ts) <= cutoff));
  index.malformed = [...new Set([...fullIndex.malformed, ...index.malformed])];
  const exclusionCounts = {};
  const exclusions = [];
  const records = [];
  const rows = [];
  const exclude = (decisionEvent, reason, details = {}) => {
    recordReason(exclusionCounts, reason);
    exclusions.push({
      runId: index.runId,
      contractId: decisionEvent?.decision?.contract_id || null,
      reason,
      ...details,
    });
  };
  if (index.malformed.length) {
    index.malformed.forEach((reason) => recordReason(exclusionCounts, reason));
    return {
      source,
      runId: index.runId,
      metadata: clone(index.runStart?.metadata || null),
      inventory: { events: events.length, decisions: index.decisions.length, outcomes: index.outcomes.length },
      records,
      rows,
      exclusions: index.malformed.map((reason) => ({ runId: index.runId, contractId: null, reason })),
      exclusionCounts,
    };
  }
  const worldId = nonEmpty(index.runStart?.metadata?.world?.id);
  for (const decisionEvent of index.decisions) {
    const decision = decisionEvent.decision;
    const contractId = nonEmpty(decision?.contract_id);
    if (!contractId || !worldId) {
      exclude(decisionEvent, 'missing_contract_or_world_identity');
      continue;
    }
    if (index.decisions.filter((event) => event.decision?.contract_id === contractId).length !== 1) {
      exclude(decisionEvent, 'duplicate_contract_decision');
      continue;
    }
    const matchingOutcomes = uniqueBy(index.outcomes, (event) => event?.outcome?.contract_id === contractId);
    const decisionTurns = uniqueBy(index.turns, (event) => event.turn === decisionEvent.turn);
    const observationTurns = uniqueBy(index.turns, (event) => event.turn === decisionEvent.turn + 1);
    const displacements = uniqueBy(index.displacements, (event) => event.contractId === contractId);
    if (matchingOutcomes.length !== 1 || decisionTurns.length !== 1 || observationTurns.length !== 1) {
      exclude(decisionEvent, 'non_unique_required_join', {
        outcomeCount: matchingOutcomes.length,
        decisionTurnCount: decisionTurns.length,
        observationTurnCount: observationTurns.length,
      });
      continue;
    }
    if (
      !(
        decisionEvent.seq < decisionTurns[0].seq &&
        decisionTurns[0].seq < matchingOutcomes[0].seq &&
        matchingOutcomes[0].seq < observationTurns[0].seq
      )
    ) {
      exclude(decisionEvent, 'decision_delivery_observation_order_mismatch');
      continue;
    }
    const joined = deliveredJoin({
      decisionEvent,
      decisionTurn: decisionTurns[0].turnRecord,
      outcomeEvent: matchingOutcomes[0],
      observationTurn: observationTurns[0].turnRecord,
      displacement: displacements[0] || null,
    });
    if (joined.reason) {
      exclude(decisionEvent, joined.reason);
      continue;
    }
    const conditionResult = conditionForObservation(decision.decision_provenance?.memory_observation, conditions);
    if (conditionResult.reason) {
      exclude(decisionEvent, conditionResult.reason);
      continue;
    }
    const review = reviewsByKey.get(reviewKey(index.runId, contractId)) || null;
    let outcome = 'measurement_indeterminate';
    let measurementStatus = 'auxiliary_only';
    let recordedAt = matchingOutcomes[0].ts;
    if (review) {
      recordedAt = new Date(Math.max(timestamp(review.recordedAt), timestamp(recordedAt))).toISOString();
      if (timestamp(review.recordedAt) < timestamp(matchingOutcomes[0].ts)) {
        measurementStatus = 'review_before_observation';
      } else if (
        review.tutorText !== joined.tutorText ||
        review.learnerText !== joined.learnerText ||
        review.deliveredActionType !== joined.action.action_type
      ) {
        measurementStatus = 'review_join_mismatch';
      } else if (review.outcome !== joined.closed.outcome || !joined.auxiliaryDeliveryVisible) {
        measurementStatus = 'auxiliary_human_disagreement';
      } else {
        outcome = review.outcome;
        measurementStatus = 'human_confirmed';
      }
    }
    const record = {
      id: `${index.runId}:${contractId}`,
      dialogueId: index.runId,
      contractId,
      worldId,
      conditionId: conditionResult.condition.id,
      contextKey,
      actionType: joined.action.action_type,
      supportLevel: joined.action.support_level,
      decisionTurn: decisionEvent.turn,
      observationTurn: matchingOutcomes[0].turn,
      observedAt: matchingOutcomes[0].ts,
      recordedAt,
      status: 'closed',
      delivery: 'delivered',
      deliveredActionType: joined.action.action_type,
      outcome,
      supersedes: [],
    };
    records.push(record);
    rows.push({
      recordId: record.id,
      source,
      sourceSequence: { decision: decisionEvent.seq, outcome: matchingOutcomes[0].seq },
      conditionQuantities: conditionResult.quantities,
      recordedOutcome: joined.closed.outcome,
      auxiliaryDeliveryVisible: joined.auxiliaryDeliveryVisible,
      exportedOutcome: outcome,
      measurementStatus,
      reviewer: review ? { method: review.method, reviewer: review.reviewer, source: review.source } : null,
      selectorReplayInputPresent: Boolean(decision.decision_provenance?.selection_input),
    });
  }
  records.sort((left, right) => left.id.localeCompare(right.id));
  rows.sort((left, right) => left.recordId.localeCompare(right.recordId));
  return {
    source,
    runId: index.runId,
    metadata: clone(index.runStart?.metadata || null),
    inventory: { events: events.length, decisions: index.decisions.length, outcomes: index.outcomes.length },
    records,
    rows,
    exclusions,
    exclusionCounts,
  };
}

function replaySelection(selectionInput, penalties = null) {
  const input = clone(selectionInput);
  if (penalties) input.config = { ...(input.config || {}), actionUtilityPenalties: penalties };
  return selectPedagogicalAction(input);
}

export function replayActionOutcomeMemoryDecisions({
  evaluationSources,
  records,
  conditions = [],
  policy,
  staleAsOf,
  conditionPermutation,
  asOf,
} = {}) {
  const cutoff = timestamp(asOf);
  const staleCutoff = timestamp(staleAsOf);
  if (!Array.isArray(evaluationSources) || !Array.isArray(records) || !Number.isFinite(cutoff)) {
    throw new Error('decision replay needs evaluation sources, records, and asOf');
  }
  if (!Number.isFinite(staleCutoff) || staleCutoff > cutoff) {
    throw new Error('decision replay needs a staleAsOf at or before asOf');
  }
  validateConditions(conditions);
  if (!policy || policy.enabled !== true) throw new Error('replay requires an explicitly enabled comparison policy');
  planActionMemoryDemotions(null, {}, [], policy);
  const conditionIds = conditions.map((condition) => condition.id);
  if (
    !conditionPermutation ||
    conditionIds.some((id) => !conditionIds.includes(conditionPermutation[id])) ||
    new Set(conditionIds.map((id) => conditionPermutation[id])).size !== conditionIds.length
  )
    throw new Error('replay requires a bijection over the declared conditions');
  const evaluationWorlds = [
    ...new Set(evaluationSources.map((source) => source.metadata?.world?.id).filter(nonEmpty)),
  ].sort();
  const cases = [];
  const exclusionCounts = {};
  for (const source of evaluationSources) {
    const fullIndex = eventIndex(source.events);
    const index = eventIndex(source.events.filter((event) => timestamp(event?.ts) <= cutoff));
    index.malformed = [...new Set([...fullIndex.malformed, ...index.malformed])];
    for (const decisionEvent of index.decisions) {
      const decision = decisionEvent.decision;
      const selectionInput = decision?.decision_provenance?.selection_input;
      const conditionResult = conditionForObservation(decision?.decision_provenance?.memory_observation, conditions);
      const exclude = (reason) => {
        recordReason(exclusionCounts, reason);
        cases.push({
          source: source.source,
          runId: index.runId,
          contractId: decision?.contract_id || null,
          disposition: 'excluded',
          reason,
        });
      };
      if (index.malformed.length) {
        exclude(index.malformed[0]);
        continue;
      }
      if (!selectionInput) {
        exclude('missing_selector_replay_input');
        continue;
      }
      if (
        selectionInput.stateBelief?.turn_index !== decisionEvent.turn ||
        !Array.isArray(selectionInput.interventionLedger) ||
        selectionInput.interventionLedger.some(
          (record) =>
            record.status !== 'closed' ||
            !Number.isInteger(record.turn_index) ||
            !Number.isInteger(record.closed_turn_index) ||
            record.turn_index < 0 ||
            record.closed_turn_index <= record.turn_index ||
            record.turn_index >= decisionEvent.turn ||
            record.closed_turn_index > decisionEvent.turn,
        )
      ) {
        exclude('selector_input_contains_unresolved_or_future_intervention');
        continue;
      }
      if (conditionResult.reason) {
        exclude(conditionResult.reason);
        continue;
      }
      if (decision.decision_provenance?.support_axis_source !== 'explicit_typed_action_config') {
        exclude('support_not_fixed');
        continue;
      }
      if (timestamp(decisionEvent.ts) < staleCutoff) {
        exclude('stale_cutoff_after_decision');
        continue;
      }
      const baseline = replaySelection(selectionInput);
      const candidateScores = (rows) => Object.fromEntries(rows.map((row) => [row.action_type, row.utility]));
      if (
        baseline.selectedAction.action_type !== decision.chosen_action?.action_type ||
        JSON.stringify(candidateScores(baseline.candidateActions)) !==
          JSON.stringify(candidateScores(decision.full_candidate_set || []))
      ) {
        exclude('baseline_replay_mismatch');
        continue;
      }
      const decisionAsOf = decisionEvent.ts;
      if (!Number.isFinite(timestamp(decisionAsOf)) || timestamp(decisionAsOf) > cutoff) {
        exclude('invalid_decision_time');
        continue;
      }
      const snapshot = buildActionOutcomeMemory(records, {
        asOf: decisionAsOf,
        source: 'readiness-current',
        excludedWorldIds: policy.scope === 'held_out_world' ? evaluationWorlds : [],
        excludedDialogueIds: [index.runId],
      });
      const staleSnapshot = buildActionOutcomeMemory(records, {
        asOf: new Date(staleCutoff).toISOString(),
        source: 'readiness-stale',
        excludedWorldIds: policy.scope === 'held_out_world' ? evaluationWorlds : [],
        excludedDialogueIds: [index.runId],
      });
      let scrambled = null;
      let scrambleReason = null;
      if (conditionIds.every((id) => conditionPermutation[id] === id)) {
        scrambleReason = 'identity_permutation_is_not_a_control';
      } else {
        try {
          scrambled = scrambleActionOutcomeMemory(snapshot, conditionPermutation, { source: 'readiness-scrambled' });
        } catch {
          scrambleReason = 'available_conditions_do_not_support_permutation';
        }
      }
      const context = {
        conditionId: conditionResult.condition.id,
        contextKey: source.contextKey,
        worldId: source.metadata?.world?.id,
        dialogueId: index.runId,
        asOf: decisionAsOf,
        supportLevel: decision.chosen_action?.support_level,
      };
      const arms = {};
      for (const [name, memory] of [
        ['current', snapshot],
        ['stale', staleSnapshot],
        ['scrambled', scrambled],
      ]) {
        if (name === 'scrambled' && scrambleReason) {
          arms[name] = {
            disposition: 'not_evaluable',
            reason: scrambleReason,
            selectedActionType: null,
            changed: null,
            penalties: {},
            sourceRecordIds: [],
          };
          continue;
        }
        const plan = planActionMemoryDemotions(memory, context, baseline.candidateActions, policy);
        const selected =
          plan.disposition === 'demote'
            ? replaySelection(selectionInput, plan.penalties).selectedAction.action_type
            : baseline.selectedAction.action_type;
        arms[name] = {
          disposition: plan.disposition,
          reason: plan.reason,
          selectedActionType: selected,
          changed: selected !== baseline.selectedAction.action_type,
          penalties: plan.penalties,
          sourceRecordIds: plan.families.flatMap((family) => family.recordIds || []).sort(),
        };
      }
      cases.push({
        source: source.source,
        runId: index.runId,
        contractId: decision.contract_id,
        disposition: 'replayed',
        conditionId: conditionResult.condition.id,
        worldId: context.worldId,
        contextKey: context.contextKey,
        baselineActionType: baseline.selectedAction.action_type,
        disabledActionType: baseline.selectedAction.action_type,
        arms,
      });
    }
  }
  const replayed = cases.filter((row) => row.disposition === 'replayed');
  return {
    schema: ACTION_OUTCOME_MEMORY_READINESS_VERSION,
    evaluationWorlds,
    cases,
    exclusionCounts,
    summary: {
      decisions: cases.length,
      replayed: replayed.length,
      excluded: cases.length - replayed.length,
      currentChanged: replayed.filter((row) => row.arms.current.changed).length,
      staleChanged: replayed.filter((row) => row.arms.stale.changed).length,
      scrambledChanged: replayed.filter((row) => row.arms.scrambled.changed).length,
      currentAbstained: replayed.filter((row) => row.arms.current.disposition === 'abstain').length,
      scrambledNotEvaluable: replayed.filter((row) => row.arms.scrambled.disposition === 'not_evaluable').length,
    },
  };
}
