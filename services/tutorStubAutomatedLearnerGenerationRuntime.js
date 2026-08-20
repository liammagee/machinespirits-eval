import path from 'node:path';
import { cleanTutorStubStageSpeech } from './tutorStubStageSpeech.js';
import { mixedLearnerSuggestionMove, parseMixedLearnerArtifacts } from './mixedLearnerArtifacts.js';
import {
  latestTutorStubMessage as latestTutorMessage,
  tutorStubPublicMessagesForSpeaker,
} from './tutorStubPublicHistory.js';
import {
  projectTutorStubPublicWorldSummary as publicWorldSummary,
  tutorStubWorldLedgerTerm as worldLedgerTerm,
} from './tutorStubWorldPresentation.js';
import {
  loadTutorStubStressSchedule,
  tutorStubStressDirective,
  tutorStubStressPlantForTurn,
  TUTOR_STUB_STRESS_SCHEDULE_SCHEMA,
} from './tutorStubStressSchedule.js';
import { assertTutorStubTurnAttemptCurrent } from './tutorStubTurnAttempt.js';
import { TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS } from './tutorStubCliPolicyRetry.js';
import {
  GUARDED_LEARNER_MOVE_SCHEMA,
  auditGuardedLearnerDraft,
  countGuardedLearnerGroundedChallenges,
  guardedLearnerMoveDirective,
  guardedLearnerRedraftInstruction,
  selectGuardedLearnerMove,
} from './tutorStubGuardedLearnerMoves.js';
import {
  FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE,
  FRAME_REFUSER_ADHERENCE_EXHAUSTED_CODE,
  RESISTANT_LEARNER_OBSERVATION_SEMANTICS,
  classifyFrameDefiantAdherenceExhaustion,
  classifyFrameRefuserAdherenceExhaustion,
  resistantLearnerObservationMarkers,
} from './resistantLearnerObservation.js';

export {
  FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE,
  FRAME_REFUSER_ADHERENCE_EXHAUSTED_CODE,
  classifyFrameDefiantAdherenceExhaustion,
  classifyFrameRefuserAdherenceExhaustion,
};
export const TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS_ENV =
  'TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS';
const FRAME_OPPORTUNITY_V3_TURNS = 8;
const FRAME_OPPORTUNITY_V3_MODEL_CALL_BUDGET = 48;
const FRAME_OPPORTUNITY_V3_BASE_CALLS = 1 + FRAME_OPPORTUNITY_V3_TURNS * 3;
const FRAME_OPPORTUNITY_V3_CALLS_PER_FULL_REPAIR = 2;
const FRAME_OPPORTUNITY_V3_TUTOR_GUARD_RESERVE = FRAME_OPPORTUNITY_V3_TURNS * 2;
const FRAME_OPPORTUNITY_V4_TURNS = 2;
const FRAME_OPPORTUNITY_V4_BASE_CALLS = 1 + FRAME_OPPORTUNITY_V4_TURNS * 3;
const FRAME_OPPORTUNITY_V4_CALLS_PER_FULL_REPAIR = 2;
const FRAME_OPPORTUNITY_V4_TUTOR_GUARD_RESERVE = FRAME_OPPORTUNITY_V4_TURNS * 2;
const FRAME_OPPORTUNITY_V4_MAX_RESERVATIONS_PER_PLANNED_CALL = 1 + TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS.length;
const FRAME_OPPORTUNITY_V4_PLANNED_WORST_CASE_CALLS =
  FRAME_OPPORTUNITY_V4_BASE_CALLS +
  FRAME_OPPORTUNITY_V4_CALLS_PER_FULL_REPAIR +
  FRAME_OPPORTUNITY_V4_TUTOR_GUARD_RESERVE;
const FRAME_OPPORTUNITY_V4_MODEL_CALL_BUDGET =
  FRAME_OPPORTUNITY_V4_PLANNED_WORST_CASE_CALLS * FRAME_OPPORTUNITY_V4_MAX_RESERVATIONS_PER_PLANNED_CALL;
export function buildTutorStubFrameOpportunityV3RepairBudgetDiagnostic({
  maxFullRepairsPer8Turns = 1,
  modelCallBudget = FRAME_OPPORTUNITY_V3_MODEL_CALL_BUDGET,
} = {}) {
  const permittedRepairCalls = maxFullRepairsPer8Turns * FRAME_OPPORTUNITY_V3_CALLS_PER_FULL_REPAIR;
  const worstCaseRequiredCalls =
    FRAME_OPPORTUNITY_V3_BASE_CALLS + permittedRepairCalls + FRAME_OPPORTUNITY_V3_TUTOR_GUARD_RESERVE;
  return {
    turns: FRAME_OPPORTUNITY_V3_TURNS,
    modelCallBudget,
    baseCalls: FRAME_OPPORTUNITY_V3_BASE_CALLS,
    maxFullRepairsPer8Turns,
    callsPerFullRepair: FRAME_OPPORTUNITY_V3_CALLS_PER_FULL_REPAIR,
    permittedRepairCalls,
    requiredTutorGuardReserve: FRAME_OPPORTUNITY_V3_TUTOR_GUARD_RESERVE,
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
    state.frameOpportunityV3RepairAdmission = {
      used: result.usedAfter,
      history: [...current.history, result],
    };
  }
  return result;
}
export function buildTutorStubFrameOpportunityV4RepairBudgetDiagnostic({
  maxFullRepairsPerT1T2 = 1,
  modelCallBudget = FRAME_OPPORTUNITY_V4_MODEL_CALL_BUDGET,
} = {}) {
  const permittedRepairCalls = maxFullRepairsPerT1T2 * FRAME_OPPORTUNITY_V4_CALLS_PER_FULL_REPAIR;
  const plannedWorstCaseCalls =
    FRAME_OPPORTUNITY_V4_BASE_CALLS + permittedRepairCalls + FRAME_OPPORTUNITY_V4_TUTOR_GUARD_RESERVE;
  const maximumModelAttemptReservations =
    plannedWorstCaseCalls * FRAME_OPPORTUNITY_V4_MAX_RESERVATIONS_PER_PLANNED_CALL;
  return {
    turns: FRAME_OPPORTUNITY_V4_TURNS,
    modelCallBudget,
    baseCalls: FRAME_OPPORTUNITY_V4_BASE_CALLS,
    maxFullRepairsPerT1T2,
    repairDecisionTurn: 2,
    repairsAtTurn1: 0,
    callsPerFullRepair: FRAME_OPPORTUNITY_V4_CALLS_PER_FULL_REPAIR,
    permittedRepairCalls,
    requiredTutorGuardReserve: FRAME_OPPORTUNITY_V4_TUTOR_GUARD_RESERVE,
    plannedWorstCaseCalls,
    transportRetryLimitPerPlannedCall: TUTOR_STUB_CLI_POLICY_RETRY_DELAYS_MS.length,
    maximumReservationsPerPlannedCall: FRAME_OPPORTUNITY_V4_MAX_RESERVATIONS_PER_PLANNED_CALL,
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
export function admitTutorStubFrameOpportunityV4FullRepair({ state, profile, turnNumber, contract } = {}) {
  if (!['frame_refuser', 'frame_defiant'].includes(profile)) {
    return { applicable: false, admitted: true, reason: 'profile_not_in_frame_opportunity_v4' };
  }
  const maxFullRepairsPerT1T2 = Number(contract?.repairModel?.maxFullRepairsPer8Turns);
  const diagnostic = buildTutorStubFrameOpportunityV4RepairBudgetDiagnostic({ maxFullRepairsPerT1T2 });
  if (!diagnostic.ready) {
    return { applicable: true, admitted: false, reason: 'registered_t1_t2_repair_budget_not_ready', diagnostic };
  }
  const current = state?.frameOpportunityV4RepairAdmission || { used: 0, history: [] };
  const deferredToT2 = turnNumber === 2;
  const admitted = deferredToT2 && current.used < maxFullRepairsPerT1T2;
  const result = {
    applicable: true,
    admitted,
    profile,
    turn: turnNumber,
    usedBefore: current.used,
    usedAfter: admitted ? current.used + 1 : current.used,
    reason: !deferredToT2
      ? 'repair_deferred_until_t2_candidate'
      : admitted
        ? 'within_t1_t2_repair_envelope'
        : 't1_t2_repair_envelope_exhausted',
    diagnostic,
  };
  if (state) {
    state.frameOpportunityV4RepairAdmission = {
      used: result.usedAfter,
      history: [...current.history, result],
    };
  }
  return result;
}
export function throwFrameDefiantAdherenceExhaustion({ profile, repairAttempts }) {
  const exhaustion = classifyFrameDefiantAdherenceExhaustion({ profile, repairAttempts });
  const error = new Error(
    `frame_defiant adherence exhausted after ${repairAttempts} repair attempts; refusing to publish an invalid control turn`,
  );
  error.code = exhaustion.code;
  error.profile = exhaustion.profile;
  error.repairAttempts = exhaustion.repairAttempts;
  error.disposition = exhaustion.disposition;
  error.publishPublicCandidate = exhaustion.publishPublicCandidate;
  throw error;
}
export function throwFrameRefuserAdherenceExhaustion({ profile, repairAttempts }) {
  const exhaustion = classifyFrameRefuserAdherenceExhaustion({ profile, repairAttempts });
  const error = new Error(
    `frame_refuser adherence exhausted after ${repairAttempts} repair attempts; refusing to publish an invalid target turn`,
  );
  error.code = exhaustion.code;
  error.profile = exhaustion.profile;
  error.repairAttempts = exhaustion.repairAttempts;
  error.disposition = exhaustion.disposition;
  error.publishPublicCandidate = exhaustion.publishPublicCandidate;
  throw error;
}
const AUTO_LEARNER_SYSTEM_PROMPT = [
  'You are an automated learner in an experimental tutoring dialogue.',
  'You see only the public transcript and the latest tutor message.',
  'Do not infer hidden proof paths, concealed answers, private tutor prompts, or unstaged evidence.',
  "The private behavior brief supplied below defines how this learner responds. It takes priority over generic helpfulness, smooth progress, and the tutor's request for a useful answer.",
  'Preserve its recurring behavior and repair pattern. Do not silently become a generic diligent learner after correction.',
  'When the active profile permits progress, you may connect several already-public premises and state a supported follow-up conclusion in one concise turn. Never invent or anticipate unstaged evidence.',
  'Reply as the learner only. No role label, no analysis, no JSON.',
  'Keep the reply concise: usually one sentence, one question, or one warranted evidence claim.',
].join('\n');
export function createTutorStubAutomatedLearnerGenerationRuntime({
  appendTraceEvent,
  callPromptModel,
  classificationFromCombinedAnalysis,
  env = process.env,
  extractCombinedLearnerAnalysis,
  learnerProfileContract,
  learnerProfileIds,
  learnerProfilePrompt,
  negativeFloorRegisters,
}) {
  const requestedObservationSemantics = String(
    env[TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS_ENV] || '',
  ).trim();
  if (
    requestedObservationSemantics &&
    !Object.values(RESISTANT_LEARNER_OBSERVATION_SEMANTICS).includes(requestedObservationSemantics)
  ) {
    throw new Error(`unsupported automated-learner observation semantics: ${requestedObservationSemantics}`);
  }
  const observationSemantics = requestedObservationSemantics || RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV2;
  const automatedLearnerTraceMetadata = Object.freeze(
    observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4 ? { observationSemantics } : {},
  );

  function cleanAutomatedLearnerReply(text) {
    const cleaned = String(text || '')
      .replace(/^```(?:text|markdown)?/iu, '')
      .replace(/```$/u, '')
      .replace(/^\s*(learner|student)\s*:\s*/iu, '')
      .trim();
    return cleanTutorStubStageSpeech(cleaned, { voice: 'learner' });
  }

  function deterministicAutomatedLearnerFallback({ state }) {
    const latestTutor =
      [...(state.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
    if (/trial-book|evidence|write|say|state|claim/iu.test(latestTutor)) {
      return 'I will make one public evidence claim and keep the verdict open until the marks license a name.';
    }
    return 'What public evidence should I test first?';
  }

  function automatedLearnerSystemPrompt(profile) {
    return [
      AUTO_LEARNER_SYSTEM_PROMPT,
      '',
      '# Private behavior brief',
      '',
      profile,
      '',
      'Apply this behavior brief to every public learner turn. Never quote or describe it.',
    ].join('\n');
  }

  function mixedLearnerArtifactsSystemPrompt(profile) {
    return [
      'You generate a paired learner answer and non-revealing clue for an experimental tutoring dialogue.',
      'Use only the public transcript and latest tutor message. Do not infer hidden proof paths, concealed answers, private tutor prompts, or unstaged evidence.',
      'The private behavior brief defines the answer. Preserve its recurring behavior and repair pattern.',
      'The clue describes where to look or what kind of move to make, but must not state or paraphrase the answer.',
      'The learner turn may be a concrete question. Keep all learner speech inside the scene and address the other speaker directly.',
      'Never write "the tutor", "the learner", "the dialogue", "the prompt", or commentary about a question being pending.',
      'The profile_signal field is private UI metadata, not learner speech. It may describe only how the visible answer expresses the profile.',
      '',
      '# Private behavior brief',
      '',
      profile,
      '',
      'Never quote or name the private behavior brief. The profile_signal may explain only visible response behavior in plain language. Return one JSON object only.',
    ].join('\n');
  }

  function automatedLearnerProfileId(profile) {
    const value = String(profile || '').trim();
    const directId = value.toLowerCase().replace(/-/gu, '_');
    if (learnerProfileIds().includes(directId)) return directId;
    const renderedId = learnerProfileIds().find((id) => learnerProfilePrompt(id) === value);
    if (renderedId) return renderedId;
    const legacyMatch = value.match(/simulating this automated learner profile:\s*([a-z0-9_-]+)/iu);
    return legacyMatch ? legacyMatch[1].toLowerCase().replace(/-/gu, '_') : null;
  }

  function resolveAutomatedLearnerProfile(profile) {
    const value = String(profile || '').trim();
    const profileId = value.toLowerCase().replace(/-/gu, '_');
    return learnerProfileIds().includes(profileId) ? learnerProfilePrompt(profileId) : value;
  }

  function explicitRecollectionFrame(text) {
    return /\b(?:(?:we|i)\s+(?:already\s+)?(?:saw|read|heard|recorded|remember(?:ed)?|recall(?:ed)?)|the\s+(?:record|trial-book|book)\s+(?:already\s+)?(?:said|showed|recorded|proved))\b/iu.test(
      String(text || ''),
    );
  }

  function automatedLearnerMarkerValue(turn, field, tutorText = '') {
    const classifier = turn?.classification?.turn || {};
    const resistantMarkers = resistantLearnerObservationMarkers({
      learnerText: turn?.learner,
      classification: turn?.classification,
      tutorText,
      semantics: observationSemantics,
    });
    const fields = {
      requestType: classifier.request_type,
      discourseMove: classifier.discourse_move,
      evidenceUse: classifier.evidence_use,
      epistemicStance: classifier.epistemic_stance,
      agency: classifier.agency,
      explicitRecollection: explicitRecollectionFrame(turn?.learner),
      ...resistantMarkers,
    };
    return fields[field] ?? null;
  }

  function automatedLearnerMarkerMatches(turn, clause, tutorText = '') {
    return clause.every((group) =>
      (group.values || []).includes(automatedLearnerMarkerValue(turn, group.field, tutorText)),
    );
  }

  function publicTutorPressure(text) {
    return /\b(miraculously|marvelous|wonderful|conveniently|apparently|nice trick|escape route|safe performance|hiding behind|not doing the work|lets you avoid|pressing|do not stall|don['’]t stall|fog and vibes|answer vending machine|mob|jab|jabs)\b/iu.test(
      String(text || ''),
    );
  }

  function negativeRegisterPressure(selection) {
    return negativeFloorRegisters.includes(selection?.selected_register);
  }

  function automatedLearnerProfileRuntimeState({ state, profile, turnNumber }) {
    const profileId = automatedLearnerProfileId(profile);
    const contract = learnerProfileContract(profileId);
    const observability = contract?.observabilityContract;
    if (!contract || !observability) return null;
    const policy = state.register?.policy || 'unknown';
    const eligiblePolicies = observability.eligiblePolicies || ['*'];
    const policyEligible = eligiblePolicies.includes('*') || eligiblePolicies.includes(policy);
    const latestTutor =
      [...(state.history || [])].reverse().find((message) => message.role === 'assistant')?.content || '';
    const currentStimulusEligible =
      observability.eligibility === 'public_tutor_pressure'
        ? publicTutorPressure(latestTutor) || negativeRegisterPressure(state.turns?.at(-1)?.registerSelection)
        : true;
    const eligible = policyEligible && currentStimulusEligible;
    const clauses = observability.markerClauses || [];
    const completedTurns = state.turns || [];
    const openingTutor = state.history?.[0]?.role === 'assistant' ? state.history[0].content : '';
    const priorTurns = policyEligible
      ? completedTurns
          .map((turn, index) => ({
            turn,
            stimulusTutor: index === 0 ? openingTutor : completedTurns[index - 1]?.tutor || '',
            stimulusSelection: index === 0 ? null : completedTurns[index - 1]?.registerSelection,
          }))
          .filter(({ stimulusTutor, stimulusSelection }) => {
            if (observability.eligibility !== 'public_tutor_pressure') return true;
            return publicTutorPressure(stimulusTutor) || negativeRegisterPressure(stimulusSelection);
          })
      : [];
    const observed = priorTurns.filter(({ turn, stimulusTutor }) =>
      clauses.some((clause) => clause.length && automatedLearnerMarkerMatches(turn, clause, stimulusTutor)),
    ).length;
    const mustShowByTurn = Number(observability.mustShowByTurn || 0);
    const targetRate = Number(observability.minEligibleRate || 0);
    const eligibleOpportunities = priorTurns.length + (eligible ? 1 : 0);
    const targetCount =
      eligible && (!mustShowByTurn || turnNumber >= mustShowByTurn) ? Math.ceil(eligibleOpportunities * targetRate) : 0;
    const deadlineDue = eligible && mustShowByTurn > 0 && turnNumber >= mustShowByTurn && observed === 0;
    const requiredNow = Boolean(eligible && (deadlineDue || observed < targetCount));
    return {
      profileId,
      contract,
      observability,
      eligible,
      priorEligibleTurns: priorTurns.length,
      observed,
      targetCount,
      mustShowByTurn,
      requiredNow,
    };
  }

  function automatedLearnerProfileRuntime({ state, profile, turnNumber }) {
    const runtime = automatedLearnerProfileRuntimeState({ state, profile, turnNumber });
    if (!runtime) return '';
    return [
      '# Private behavior cue',
      '',
      `The latest public tutor move ${runtime.eligible ? 'does' : 'does not'} trigger the recurring behavior in the brief.`,
      runtime.requiredNow
        ? `This turn MUST visibly perform the recurring behavior: ${runtime.contract.intent.failureOperator}. Do not combine it with a fully repaired or fully warranted answer in the same turn.`
        : 'This turn may repair or progress if the behavior brief permits, but the recurring behavior remains active later.',
      'This cue is private. Never mention briefs, triggers, profiles, markers, or experimental conditions publicly.',
    ].join('\n');
  }

  // Opt-in stress schedule (TUTOR_STUB_STRESS_SCHEDULE=<path>): planted learner
  // states with adjudicated repairs. Loaded once, lazily; each planted turn's
  // directive is injected into the learner prompt verbatim and traced, so the
  // bench knows exactly which turns carry authored stress.
  const STRESS_SCHEDULE_PATH = env.TUTOR_STUB_STRESS_SCHEDULE || null;
  let stressScheduleCache;
  function activeStressSchedule() {
    if (!STRESS_SCHEDULE_PATH) return null;
    if (stressScheduleCache === undefined) {
      stressScheduleCache = loadTutorStubStressSchedule(path.resolve(STRESS_SCHEDULE_PATH));
    }
    return stressScheduleCache;
  }

  function stressPlantForLearnerTurn(state, turnNumber, { recordTrace = true } = {}) {
    const schedule = activeStressSchedule();
    if (!schedule) return null;
    const plant = tutorStubStressPlantForTurn(schedule, turnNumber);
    if (plant && recordTrace && state?.trace) {
      appendTraceEvent(state.trace, {
        type: 'learner_stress_plant',
        schema: TUTOR_STUB_STRESS_SCHEDULE_SCHEMA,
        scheduleId: schedule.scheduleId,
        turn: turnNumber,
        state: plant.state,
        rightRepair: plant.rightRepair,
        alsoRight: plant.alsoRight,
      });
    }
    return plant;
  }

  // Phase Q3 (TUTOR_STUB_CORRUPT="<turn>:<kind>,..."): deterministic
  // post-generation corruption of the learner's reply — the corrupted text
  // becomes her turn everywhere (history, trace, the tutor's view), so she
  // must live with it. Kinds: `truncate` (cut mid-sentence at ~60% of words),
  // `termswap` (TUTOR_STUB_CORRUPT_SWAP="right term=wrong term"). Confusion
  // by construction, not by acting — isolates the repair question.
  const CORRUPT_TURNS = Object.fromEntries(
    (env.TUTOR_STUB_CORRUPT || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split(':'))
      .map(([t, kind]) => [Number(t), kind]),
  );

  function automatedLearnerCorruptionEnabled(turnNumber) {
    return Boolean(CORRUPT_TURNS[turnNumber]);
  }

  function applyTutorStubCorruption(state, turnNumber, text) {
    const kind = CORRUPT_TURNS[turnNumber];
    if (!kind) return text;
    let corrupted = text;
    if (kind === 'truncate') {
      const words = String(text).split(/\s+/);
      corrupted = `${words.slice(0, Math.max(4, Math.floor(words.length * 0.6))).join(' ')} —`;
    } else if (kind === 'termswap') {
      const [right, wrong] = String(env.TUTOR_STUB_CORRUPT_SWAP || '').split('=');
      if (right && wrong) {
        // Fuzzy matcher (Q3 pilot lesson): "basin hose" must also catch
        // "basin's cold-water hose" — words of the right term may carry a
        // possessive and up to two interleaved words.
        const fuzzy = right.trim().split(/\s+/).join("(?:['’]s)?(?:\\s+[\\w'’-]+){0,2}\\s+");
        corrupted = String(text).replace(new RegExp(`\\b${fuzzy}\\b`, 'gi'), wrong);
      }
    }
    if (corrupted !== text && state?.trace) {
      appendTraceEvent(state.trace, {
        type: 'learner_corruption',
        turn: turnNumber,
        kind,
        beforeChars: text.length,
        afterChars: corrupted.length,
      });
    }
    return corrupted;
  }

  // Guarded (defensive) learner pole. Opt-in with
  // TUTOR_STUB_GUARDED_LEARNER_MOVES=1, so no existing study changes: the
  // menu picks one typed move per turn and the guard rejects a draft that
  // folds or asks permission before the schedule allows it. Both are
  // deterministic and cost no model call. See tutorStubGuardedLearnerMoves.js.
  const GUARDED_LEARNER_MOVES_ENABLED = /^(?:1|true|on|yes)$/iu.test(
    String(env.TUTOR_STUB_GUARDED_LEARNER_MOVES || ''),
  );

  function guardedLearnerActive(profile) {
    return GUARDED_LEARNER_MOVES_ENABLED && automatedLearnerProfileId(profile) === 'overconfident';
  }

  function guardedLearnerMoveForTurn({ state, profile, turnNumber }) {
    if (!guardedLearnerActive(profile)) return null;
    const priorMoves = Array.isArray(state.guardedLearnerMoves) ? state.guardedLearnerMoves : [];
    const groundedChallengeCount = countGuardedLearnerGroundedChallenges(state.turns || []);
    const move = selectGuardedLearnerMove({ turnNumber, groundedChallengeCount, priorMoves });
    return { move, groundedChallengeCount, priorMoves };
  }

  function buildAutomatedLearnerPrompt({ state, profile, turnNumber, adherenceFeedback = '' }) {
    const hasTutorMessage = Boolean(latestTutorMessage(state));
    const guarded = guardedLearnerMoveForTurn({ state, profile, turnNumber });
    return [
      automatedLearnerProfileRuntime({ state, profile, turnNumber }),
      '',
      guarded ? guardedLearnerMoveDirective(guarded.move) : null,
      guarded ? '' : null,
      '# Public scene',
      '',
      publicWorldSummary(state.world),
      '',
      '# Dialogue context',
      '',
      hasTutorMessage
        ? 'The public dialogue precedes this task as native chat messages. Tutor speech is `user`; your own earlier learner speech is `assistant`. In a long run, an explicit omission marker may replace older turns while preserving the latest tutor-led window.'
        : 'There is no prior tutor message. Start by asking or stating what you would investigate first.',
      '',
      '# Task',
      '',
      tutorStubStressDirective(stressPlantForLearnerTurn(state, turnNumber)),
      stressPlantForLearnerTurn(state, turnNumber, { recordTrace: false }) ? '' : null,
      adherenceFeedback || null,
      adherenceFeedback ? '' : null,
      `Write learner turn ${turnNumber}. Use only public evidence and the public transcript.`,
      'First preserve the private behavior brief. A required distortion, omitted warrant, refusal, resistance, or withheld evidence step takes priority over generic progress.',
      `Only when the profile permits progress: if the tutor asks for a ${worldLedgerTerm(state?.world)} line, write one concise public evidence claim and treat it as both deduction and book entry.`,
      'Only when the profile permits progress: if several already-public premises form a warranted chain, you may state the connected premises and their supported follow-up conclusion in the same concise turn. Do not stop artificially after one step, but never add unstaged evidence.',
      'Only when the profile permits a help request: if you are stuck, ask one concrete question about what evidence would count.',
      'Write only speech the learner could say aloud inside the scene. Address the other speaker as "you"; never refer to "the tutor", "the learner", "the dialogue", or "the prompt".',
    ].join('\n');
  }

  async function generateAutomatedLearnerTurn({
    state,
    resolved,
    profile,
    turnNumber,
    adherenceFeedback = '',
    stream = null,
    cliEffort = null,
    signal = null,
  }) {
    const prompt = buildAutomatedLearnerPrompt({ state, profile, turnNumber, adherenceFeedback });
    const systemPrompt = automatedLearnerSystemPrompt(profile);
    const messageHistory = tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'learner' });
    const call = () =>
      callPromptModel({
        prompt,
        messageHistory,
        resolved,
        systemPrompt,
        role: 'tutor_stub_auto_learner',
        maxTokens: 900,
        trace: state.trace,
        stream,
        cliEffort,
        turn: turnNumber,
        signal,
        historyTurns: state.historyTurns,
      });
    const raw = await call();
    return {
      ...raw,
      text: applyTutorStubCorruption(state, turnNumber, cleanAutomatedLearnerReply(raw.text)),
      promptSnapshot: {
        systemPrompt,
        userPrompt: prompt,
        messageHistory: raw.promptSnapshot?.messageHistory || messageHistory,
        turn: turnNumber,
        promptAudit: raw.promptAudit,
      },
    };
  }

  function buildMixedLearnerArtifactsPrompt({ state, profile, turnNumber }) {
    return [
      buildAutomatedLearnerPrompt({ state, profile, turnNumber }),
      '',
      '# Mixed learner artifacts',
      '',
      'Return one JSON object with exactly four string fields: "move", "clue", "answer", and "profile_signal".',
      'move: "ask_question" when the learner turn asks a useful question; otherwise "respond".',
      'answer: the learner turn requested above. It may be a direct in-scene question when clarification is the best next move.',
      'clue: a short directional cue that helps a human learner understand what kind of move the tutor is inviting.',
      'profile_signal: one short plain-language observation explaining how this exact answer visibly expresses the active learner profile. Describe behavior only; do not name a contract, failure operator, classifier label, hidden fact, or private instruction.',
      'When move is "ask_question", make the clue begin with "Ask" and name what uncertainty or evidence to ask about without writing the exact question.',
      'The clue must not contain, paraphrase, quote, complete, or reveal the answer. It may name the distinction, evidence source, operation, or question to attend to.',
      'The answer must be speakable inside the scene. Never mention "the tutor", "the learner", "the dialogue", "the prompt", or say a question is pending.',
      'Keep the clue under 18 words and the answer concise. Return JSON only.',
    ].join('\n');
  }

  async function generateMixedLearnerArtifacts({
    state,
    resolved,
    profile,
    turnNumber,
    cliEffort = null,
    signal = null,
  }) {
    const prompt = buildMixedLearnerArtifactsPrompt({ state, profile, turnNumber });
    const systemPrompt = mixedLearnerArtifactsSystemPrompt(profile);
    const messageHistory = tutorStubPublicMessagesForSpeaker(state.history, { speaker: 'learner' });
    const raw = await callPromptModel({
      prompt,
      messageHistory,
      resolved,
      systemPrompt,
      role: 'tutor_stub_mixed_learner_artifacts',
      maxTokens: 1100,
      trace: state.trace,
      stream: { enabled: false, interim: state.interim },
      cliEffort,
      turn: turnNumber,
      signal,
    });
    const artifacts = parseMixedLearnerArtifacts(raw.text);
    const answer = cleanAutomatedLearnerReply(artifacts.answer);
    return {
      ...raw,
      answer,
      clue: artifacts.clue,
      move: mixedLearnerSuggestionMove(answer, artifacts.move),
      profileSignal: artifacts.profileSignal,
      parsedArtifacts: artifacts.parsed,
      promptSnapshot: {
        systemPrompt,
        userPrompt: prompt,
        messageHistory,
        turn: turnNumber,
        promptAudit: raw.promptAudit,
      },
    };
  }

  function automatedLearnerDraftMatchesRuntime({ text, raw, state, runtime }) {
    if (!runtime?.requiredNow) return true;
    const classification = classificationFromCombinedAnalysis(raw, state);
    const syntheticTurn = { learner: text, classification };
    const tutorText = latestTutorMessage(state);
    return (runtime.observability.markerClauses || []).some(
      (clause) => clause.length > 0 && automatedLearnerMarkerMatches(syntheticTurn, clause, tutorText),
    );
  }

  function automatedLearnerRepairInstruction(profileId) {
    if (profileId === 'answer_seeking') {
      return 'Keep seeking supplied wording, but respond to the current public clue. Either ask for the next line using one concrete clue term, or copy part of the line just offered as a tentative entry. Do not repeat an earlier learner sentence verbatim.';
    }
    if (profileId === 'proof_skipper') {
      return 'State an unsupported downstream attribution, source, actor, or public-record judgment as if the clue were sufficient; do not merely restate the clue. Remove because, since, so, therefore, if, then, would need, would want, and any sentence that explains or requests the missing bridge. Do not hedge or ask a question.';
    }
    if (profileId === 'false_memory') {
      return 'Begin naturally with "We already saw", "I remember", "The record said", or an equivalent explicit recollection, then state one concrete observation that the public record did not actually establish. Misquote the clue itself rather than drawing a bad inference from a true clue. Do not hedge, describe a future test, or correct the distortion in this turn.';
    }
    if (profileId === 'affective_resistant') {
      return "Object to the tutor's pressure only. Do not add a clue, public-record line, warrant, inference, or useful evidence step in the same turn.";
    }
    if (profileId === 'frame_defiant') {
      return 'Preserve the jurisdictional objection and include one licensed participation form: an explicit alternative framing, one rival or bounded local test, or an actual content-bearing contribution. Do not withdraw from local participation, refuse to answer or inspect, or rewrite the turn as frame-refuser-style non-participation.';
    }
    return 'Make the required failure public and unmistakable without repairing it in the same turn.';
  }

  async function enforceAutomatedLearnerProfile({
    state,
    resolved,
    profile,
    turnNumber,
    generated,
    cliEffort = null,
    signal = null,
    isCurrent = null,
  }) {
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    const runtime = automatedLearnerProfileRuntimeState({ state, profile, turnNumber });
    const canPreclassify = Boolean(state.classifier.enabled && state.learnerDag.enabled && state.world);
    const prospectiveV4 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4;
    const frameOpportunityV4Profile = prospectiveV4 && ['frame_refuser', 'frame_defiant'].includes(runtime?.profileId);
    if (frameOpportunityV4Profile && turnNumber < 2) {
      appendTraceEvent(state.trace, {
        type: 'auto_learner_profile_adherence_deferred',
        turn: turnNumber,
        profile: runtime.profileId,
        decisionTurn: 2,
        repairRequested: false,
        typedExhaustionEvaluated: false,
      });
      return { generated, precomputedRaw: null, repaired: false, passed: null };
    }
    if (!runtime?.requiredNow || !canPreclassify || !generated.text) {
      if (frameOpportunityV4Profile && turnNumber === 2 && runtime?.observed > 0) {
        appendTraceEvent(state.trace, {
          type: 'auto_learner_profile_adherence',
          turn: turnNumber,
          profile: runtime.profileId,
          required: false,
          passed: true,
          repaired: false,
          repairAttempts: 0,
          cumulativeQualifiedByTurn: 1,
        });
        return { generated, precomputedRaw: null, repaired: false, passed: true };
      }
      return { generated, precomputedRaw: null, repaired: false, passed: null };
    }

    const prospectiveV3 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV3;
    const frameOpportunityV3Profile = prospectiveV3 && ['frame_refuser', 'frame_defiant'].includes(runtime.profileId);
    const boundedFrameOpportunityProfile = frameOpportunityV3Profile || frameOpportunityV4Profile;
    const maxRepairs = boundedFrameOpportunityProfile ? 1 : 2;
    let candidate = generated;
    let raw = null;
    let passed = false;
    let repairs = 0;
    while (repairs <= maxRepairs) {
      raw = await extractCombinedLearnerAnalysis({
        learnerText: candidate.text,
        state,
        tutorTurn: turnNumber,
        preflightSource: 'automated_learner_profile_adherence',
        signal,
      });
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      passed = automatedLearnerDraftMatchesRuntime({ text: candidate.text, raw, state, runtime });
      if (passed || repairs === maxRepairs) break;
      if (boundedFrameOpportunityProfile) {
        const admission = (
          frameOpportunityV4Profile
            ? admitTutorStubFrameOpportunityV4FullRepair
            : admitTutorStubFrameOpportunityV3FullRepair
        )({
          state,
          profile: runtime.profileId,
          turnNumber,
          contract: runtime.contract,
        });
        appendTraceEvent(state.trace, {
          type: 'auto_learner_profile_repair_admission',
          turn: turnNumber,
          profile: runtime.profileId,
          ...admission,
        });
        if (!admission.admitted) break;
      }
      appendTraceEvent(state.trace, {
        type: 'auto_learner_profile_repair_requested',
        turn: turnNumber,
        profile: runtime.profileId,
        attempt: repairs + 1,
        failureOperator: runtime.contract.intent.failureOperator,
        draft: candidate.text,
      });
      const repaired = await generateAutomatedLearnerTurn({
        state,
        resolved,
        profile,
        turnNumber,
        adherenceFeedback: `Your previous draft was too normalized and did not visibly perform the required failure operator (${runtime.contract.intent.failureOperator}). Rewrite the learner turn. ${automatedLearnerRepairInstruction(runtime.profileId)} Keep it natural and concise.`,
        stream: { enabled: false, interim: state.interim },
        cliEffort,
        signal,
      });
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      if (repaired.text) candidate = repaired;
      repairs += 1;
    }
    appendTraceEvent(state.trace, {
      type: 'auto_learner_profile_adherence',
      turn: turnNumber,
      profile: runtime.profileId,
      required: true,
      passed,
      repaired: repairs > 0,
      repairAttempts: repairs,
    });
    const typedExhaustionRequired =
      runtime.profileId === 'frame_defiant' ||
      ((prospectiveV3 || prospectiveV4) && runtime.profileId === 'frame_refuser');
    if (typedExhaustionRequired && !passed) {
      const admittedRepairs = frameOpportunityV4Profile
        ? Number(state?.frameOpportunityV4RepairAdmission?.used || 0)
        : Number(state?.frameOpportunityV3RepairAdmission?.used || 0);
      const repairAttempts = boundedFrameOpportunityProfile ? Math.max(repairs, admittedRepairs) : repairs;
      const exhaustion =
        runtime.profileId === 'frame_defiant'
          ? classifyFrameDefiantAdherenceExhaustion({ profile: runtime.profileId, repairAttempts })
          : classifyFrameRefuserAdherenceExhaustion({ profile: runtime.profileId, repairAttempts });
      appendTraceEvent(state.trace, {
        type: 'auto_learner_profile_adherence_exhausted',
        turn: turnNumber,
        profile: exhaustion.profile,
        repairAttempts: exhaustion.repairAttempts,
        disposition: exhaustion.disposition,
      });
      if (runtime.profileId === 'frame_defiant') {
        throwFrameDefiantAdherenceExhaustion({ profile: runtime.profileId, repairAttempts });
      }
      if (prospectiveV3 || prospectiveV4) {
        throwFrameRefuserAdherenceExhaustion({ profile: runtime.profileId, repairAttempts });
      }
    }
    return { generated: candidate, precomputedRaw: raw, repaired: repairs > 0, passed };
  }

  /**
   * Deterministic persona guard for the guarded pole. Re-derives the same move
   * the prompt carried, reads the draft as text, and redrafts at most once. No
   * model call is made by the check itself, so a fire costs one extra learner
   * turn and nothing else. Both outcomes are traced, so a reader counts fires
   * rather than inferring them. Records the move so the next turn's cooldown
   * and fold-once rules can see it.
   */
  async function enforceGuardedLearnerConcessionGuard({
    state,
    resolved,
    profile,
    turnNumber,
    generated,
    cliEffort = null,
    signal = null,
    isCurrent = null,
  }) {
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    const selection = guardedLearnerMoveForTurn({ state, profile, turnNumber });
    if (!selection || !generated.text) return { generated, repaired: false, move: null, passed: null };

    const { move, groundedChallengeCount } = selection;
    let candidate = generated;
    let audit = auditGuardedLearnerDraft({ text: candidate.text, move, groundedChallengeCount });
    if (audit.status === 'rejected') {
      appendTraceEvent(state.trace, {
        type: 'guarded_learner_guard_fired',
        schema: GUARDED_LEARNER_MOVE_SCHEMA,
        turn: turnNumber,
        move,
        groundedChallengeCount,
        reasons: audit.reasons,
        draft: candidate.text,
      });
      const repaired = await generateAutomatedLearnerTurn({
        state,
        resolved,
        profile,
        turnNumber,
        adherenceFeedback: guardedLearnerRedraftInstruction(audit),
        stream: { enabled: false, interim: state.interim },
        cliEffort,
        signal,
      });
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      if (repaired.text) {
        candidate = repaired;
        audit = auditGuardedLearnerDraft({ text: candidate.text, move, groundedChallengeCount });
      }
    }
    const repaired = candidate !== generated;
    appendTraceEvent(state.trace, {
      type: 'guarded_learner_move',
      schema: GUARDED_LEARNER_MOVE_SCHEMA,
      turn: turnNumber,
      move,
      groundedChallengeCount,
      passed: audit.status === 'passed',
      repaired,
      reasons: audit.reasons,
    });
    if (!Array.isArray(state.guardedLearnerMoves)) state.guardedLearnerMoves = [];
    state.guardedLearnerMoves.push(move);
    return { generated: candidate, repaired, move, passed: audit.status === 'passed' };
  }

  return {
    automatedLearnerCorruptionEnabled,
    automatedLearnerProfileId,
    automatedLearnerTraceMetadata,
    buildMixedLearnerArtifactsPrompt,
    deterministicAutomatedLearnerFallback,
    enforceGuardedLearnerConcessionGuard,
    guardedLearnerActive,
    enforceAutomatedLearnerProfile,
    generateAutomatedLearnerTurn,
    generateMixedLearnerArtifacts,
    mixedLearnerArtifactsSystemPrompt,
    resolveAutomatedLearnerProfile,
  };
}
