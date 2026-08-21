import { TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS } from './tutorStubCliPolicyRetry.js';
import {
  classifyFrameDefiantAdherenceExhaustion,
  classifyFrameRefuserAdherenceExhaustion,
} from './resistantLearnerObservation.js';

const V3_TURNS = 8;
const V3_MODEL_CALL_BUDGET = 48;
const V3_BASE_CALLS = 1 + V3_TURNS * 3;
const V3_CALLS_PER_FULL_REPAIR = 2;
const V3_TUTOR_GUARD_RESERVE = V3_TURNS * 2;
const V4_TURNS = 2;
const V4_BASE_CALLS = 1 + V4_TURNS * 3;
const V4_CALLS_PER_FULL_REPAIR = 2;
const V4_TUTOR_GUARD_RESERVE = V4_TURNS * 2;
const V4_MAX_RESERVATIONS_PER_PLANNED_CALL = 1 + TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS.length;
const V4_PLANNED_WORST_CASE_CALLS = V4_BASE_CALLS + V4_CALLS_PER_FULL_REPAIR + V4_TUTOR_GUARD_RESERVE;
const V4_MODEL_CALL_BUDGET = V4_PLANNED_WORST_CASE_CALLS * V4_MAX_RESERVATIONS_PER_PLANNED_CALL;

export function buildTutorStubFrameOpportunityV3RepairBudgetDiagnostic({
  maxFullRepairsPer8Turns = 1,
  modelCallBudget = V3_MODEL_CALL_BUDGET,
} = {}) {
  const permittedRepairCalls = maxFullRepairsPer8Turns * V3_CALLS_PER_FULL_REPAIR;
  const worstCaseRequiredCalls = V3_BASE_CALLS + permittedRepairCalls + V3_TUTOR_GUARD_RESERVE;
  return {
    turns: V3_TURNS,
    modelCallBudget,
    baseCalls: V3_BASE_CALLS,
    maxFullRepairsPer8Turns,
    callsPerFullRepair: V3_CALLS_PER_FULL_REPAIR,
    permittedRepairCalls,
    requiredTutorGuardReserve: V3_TUTOR_GUARD_RESERVE,
    worstCaseRequiredCalls,
    headroom: modelCallBudget - worstCaseRequiredCalls,
    ready: maxFullRepairsPer8Turns === 1 && worstCaseRequiredCalls <= modelCallBudget,
  };
}

export function admitTutorStubFrameOpportunityV3FullRepair({ state, profile, turnNumber, contract } = {}) {
  if (!['frame_refuser', 'frame_defiant'].includes(profile)) {
    return { applicable: false, admitted: true, reason: 'profile_not_in_frame_opportunity_v3' };
  }
  const maxFullRepairsPer8Turns = Number(contract?.repairModel?.maxFullRepairsPer8Turns);
  const diagnostic = buildTutorStubFrameOpportunityV3RepairBudgetDiagnostic({ maxFullRepairsPer8Turns });
  if (!diagnostic.ready) {
    return { applicable: true, admitted: false, reason: 'registered_repair_budget_not_ready', diagnostic };
  }
  const current = state?.frameOpportunityV3RepairAdmission || { used: 0, history: [] };
  const admitted = current.used < maxFullRepairsPer8Turns;
  const result = {
    applicable: true,
    admitted,
    profile,
    turn: turnNumber,
    usedBefore: current.used,
    usedAfter: admitted ? current.used + 1 : current.used,
    reason: admitted ? 'within_cumulative_repair_envelope' : 'cumulative_repair_envelope_exhausted',
    diagnostic,
  };
  if (state) {
    state.frameOpportunityV3RepairAdmission = { used: result.usedAfter, history: [...current.history, result] };
  }
  return result;
}

export function buildTutorStubFrameOpportunityV4RepairBudgetDiagnostic({
  maxFullRepairsPerT1T2 = 1,
  modelCallBudget = V4_MODEL_CALL_BUDGET,
} = {}) {
  const permittedRepairCalls = maxFullRepairsPerT1T2 * V4_CALLS_PER_FULL_REPAIR;
  const plannedWorstCaseCalls = V4_BASE_CALLS + permittedRepairCalls + V4_TUTOR_GUARD_RESERVE;
  const maximumModelAttemptReservations = plannedWorstCaseCalls * V4_MAX_RESERVATIONS_PER_PLANNED_CALL;
  return {
    turns: V4_TURNS,
    modelCallBudget,
    baseCalls: V4_BASE_CALLS,
    maxFullRepairsPerT1T2,
    repairDecisionTurn: 2,
    repairsAtTurn1: 0,
    callsPerFullRepair: V4_CALLS_PER_FULL_REPAIR,
    permittedRepairCalls,
    requiredTutorGuardReserve: V4_TUTOR_GUARD_RESERVE,
    plannedWorstCaseCalls,
    transportRetryLimitPerPlannedCall: TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS.length,
    maximumReservationsPerPlannedCall: V4_MAX_RESERVATIONS_PER_PLANNED_CALL,
    maximumModelAttemptReservations,
    technicalRetryHeadroomReservations: modelCallBudget - plannedWorstCaseCalls,
    reservationHeadroom: modelCallBudget - maximumModelAttemptReservations,
    ready:
      maxFullRepairsPerT1T2 === 1 &&
      plannedWorstCaseCalls === 13 &&
      modelCallBudget === maximumModelAttemptReservations &&
      maximumModelAttemptReservations === 39,
  };
}

export function admitTutorStubFrameOpportunityV4FullRepair({
  state,
  profile,
  turnNumber,
  contract,
  registeredPostTriggerCandidate = false,
} = {}) {
  if (!['frame_refuser', 'frame_defiant'].includes(profile)) {
    return { applicable: false, admitted: true, reason: 'profile_not_in_frame_opportunity_v4' };
  }
  const maxFullRepairsPerT1T2 = Number(contract?.repairModel?.maxFullRepairsPer8Turns);
  const diagnostic = buildTutorStubFrameOpportunityV4RepairBudgetDiagnostic({ maxFullRepairsPerT1T2 });
  if (!diagnostic.ready) {
    return { applicable: true, admitted: false, reason: 'registered_t1_t2_repair_budget_not_ready', diagnostic };
  }
  const current = state?.frameOpportunityV4RepairAdmission || { used: 0, history: [] };
  const t1T2DecisionCandidate = turnNumber === 2;
  const registeredOutcomeCandidate = registeredPostTriggerCandidate === true;
  const repairDecisionCandidate = t1T2DecisionCandidate || registeredOutcomeCandidate;
  const admitted = repairDecisionCandidate && current.used < maxFullRepairsPerT1T2;
  const result = {
    applicable: true,
    admitted,
    profile,
    turn: turnNumber,
    usedBefore: current.used,
    usedAfter: admitted ? current.used + 1 : current.used,
    ...(registeredOutcomeCandidate ? { candidateKind: 'registered_post_trigger_horizon' } : {}),
    reason: !repairDecisionCandidate
      ? 'repair_deferred_until_t2_candidate'
      : admitted
        ? registeredOutcomeCandidate
          ? 'within_registered_post_trigger_repair_envelope'
          : 'within_t1_t2_repair_envelope'
        : 't1_t2_repair_envelope_exhausted',
    diagnostic,
  };
  if (state) {
    state.frameOpportunityV4RepairAdmission = { used: result.usedAfter, history: [...current.history, result] };
  }
  return result;
}

export function throwFrameDefiantAdherenceExhaustion({ profile, repairAttempts }) {
  const exhaustion = classifyFrameDefiantAdherenceExhaustion({ profile, repairAttempts });
  const error = new Error(
    `frame_defiant adherence exhausted after ${repairAttempts} repair attempts; refusing to publish an invalid control turn`,
  );
  Object.assign(error, {
    code: exhaustion.code,
    profile: exhaustion.profile,
    repairAttempts: exhaustion.repairAttempts,
    disposition: exhaustion.disposition,
    publishPublicCandidate: exhaustion.publishPublicCandidate,
  });
  throw error;
}

export function throwFrameRefuserAdherenceExhaustion({ profile, repairAttempts }) {
  const exhaustion = classifyFrameRefuserAdherenceExhaustion({ profile, repairAttempts });
  const error = new Error(
    `frame_refuser adherence exhausted after ${repairAttempts} repair attempts; refusing to publish an invalid target turn`,
  );
  Object.assign(error, {
    code: exhaustion.code,
    profile: exhaustion.profile,
    repairAttempts: exhaustion.repairAttempts,
    disposition: exhaustion.disposition,
    publishPublicCandidate: exhaustion.publishPublicCandidate,
  });
  throw error;
}
