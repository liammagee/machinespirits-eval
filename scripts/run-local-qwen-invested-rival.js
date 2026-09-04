#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

import {
  buildContinuityProofPlan,
  buildContinuityRequest,
  loadContinuityPlan,
  parseContinuityReply,
  runContinuityArm,
} from '../services/localQwenRefusalContinuity.js';
import { renderContinuityReport } from '../services/localQwenRefusalContinuityReport.js';
import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { buildDurableEvaluationStatus } from '../services/durableAttemptJournal.js';
import { createDurablePaidModelAttemptBudget } from '../services/durablePaidModelAttemptBudget.js';
import {
  blockLongRunningWorkflow,
  completeLongRunningWorkflowPhase,
  createLongRunningWorkflowStatus,
  recordLongRunningWorkflowRecovery,
  updateLongRunningWorkflowProgress,
  writeLongRunningWorkflowStatusAtomic,
} from '../services/longRunningWorkflowStatus.js';
import { loadRubric } from '../services/evalConfigLoader.js';
import { loadLearnerRubric } from '../services/learnerRubricEvaluator.js';
import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import { loadDialogueRubric } from '../services/rubricEvaluator.js';
import {
  buildBenchmarkJobs,
  normalizeScores,
  parseBenchmarkScore,
  parseSplitQualityScore,
  readBenchmarkArm,
  scoreBenchmarkArms,
} from './score-local-qwen-resistant-learner-benchmark.js';
import { discoverLoadedModel, manageServer } from './run-local-qwen-resistant-learner.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = 'config/tutor-stub-local-learners/qwen-invested-rival-theorist.v1.yaml';
const INVESTED_RIVAL_WORKFLOW_PHASES = Object.freeze([
  'PREFLIGHT',
  'GENERATING',
  'AUDITING',
  'PACKAGING',
  'WORKFLOW_COMPLETE',
]);
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

function writeJsonAtomic(file, value) {
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`;
  const descriptor = fs.openSync(temporary, 'wx');
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temporary, file);
  const directory = fs.openSync(path.dirname(file), 'r');
  try {
    fs.fsyncSync(directory);
  } finally {
    fs.closeSync(directory);
  }
}

function normalized(text) {
  return String(text || '')
    .normalize('NFC')
    .replace(/[‘’]/gu, "'");
}

export function investedRivalDeliveredSourceContext(plan, arm) {
  const records = arm.snapshot.proofControl.releasedPremiseIds.map((id) => {
    const source = plan.world.premises.find((premise) => premise.id === id);
    const turn = arm.snapshot.turns.find((row) => normalized(row.tutor).includes(normalized(source.surface)));
    if (!turn) throw new Error('committed source is absent from the final public transcript');
    return `Delivered in housemate turn ${turn.turn}: ${source.surface}`;
  });
  return [
    `Public opening situation supplied to both speakers: ${plan.world.opening_frame.situation}`,
    'The housemate is authorized to introduce these authored observations. New disclosed scene evidence is not automatically an invented assertion.',
    ...records,
  ].join('\n');
}

export function investedRivalPaidBudget(admission, limit, priorAttemptCount = 0, unitPrefix = null, hooks = {}) {
  return createDurablePaidModelAttemptBudget({
    admission,
    limit,
    priorAttemptBase: priorAttemptCount,
    unitPrefix,
    hooks,
  });
}

export function configuredServiceModel(service, arm) {
  const target = service?.profiles?.[arm?.profile]?.model?.target;
  if (typeof target !== 'string' || !target.trim()) {
    throw new Error(`service target required for arm ${arm?.id || 'unknown'}`);
  }
  return target.trim();
}

export function runtimeServiceArm(service, arm, loadedModel) {
  const target = configuredServiceModel(service, arm);
  if (loadedModel !== target) {
    throw new Error('loaded model does not exactly match the configured service target');
  }
  return { ...arm, model: target };
}

function requiredStrings(record, keys, label) {
  for (const key of keys) {
    if (typeof record?.[key] !== 'string' || !record[key].trim()) {
      throw new Error(`${label} ${key} required`);
    }
  }
}

export function buildInvestedRivalPlan(root = ROOT, configPath = DEFAULT_CONFIG) {
  const plan = loadContinuityPlan(root, configPath);
  if (
    plan.id !== 'qwen-invested-rival-theorist-v1' ||
    plan.total_attempt_ceiling !== 48 ||
    plan.recovery_attempt_reserve !== 8 ||
    plan.completion_attempt_ceiling !== 50 ||
    plan.completion_recovery_attempt_ceiling !== 2 ||
    plan.generationCap !== 32 ||
    plan.judge_calls !== 8 ||
    plan.tutor_control !== 'public_proof_dag'
  ) {
    throw new Error(
      'invested-rival plan differs from the registered 48-attempt design plus bounded completion amendment',
    );
  }
  if (
    plan.arms.length !== 2 ||
    plan.arms.some((arm) => arm.mode !== 'direct' || (arm.tutorMode || 'direct') !== 'direct') ||
    plan.arms.map((arm) => arm.variant).join(',') !== 'normal,abliterated'
  ) {
    throw new Error('invested-rival plan requires normal then abliterated direct arms with no superego');
  }
  requiredStrings(
    plan.assessment,
    ['scenario_name', 'scenario_description', 'topic', 'profile_id', 'expected_behavior', 'quality_instructions'],
    'assessment',
  );
  requiredStrings(
    plan.report,
    [
      'page_title',
      'rail_title',
      'headline',
      'subtitle',
      'interchange_label',
      'setup_title',
      'setup_description',
      'quality_description',
      'comparison_description',
      'rubric_description',
      'transcript_description',
      'proof_description',
      'scope_description',
    ],
    'report',
  );
  for (const rubric of [loadRubric(), loadLearnerRubric(), loadDialogueRubric()]) {
    if (String(rubric.version) !== '2.2') throw new Error('active rubric changed from registered v2.2');
  }
  return {
    ...plan,
    assessmentContext: {
      scenarioName: plan.assessment.scenario_name,
      scenarioDescription: plan.assessment.scenario_description,
      topic: plan.assessment.topic,
      profileId: plan.assessment.profile_id,
      characterBrief: plan.characterBrief,
      expectedBehavior: plan.assessment.expected_behavior,
      qualityInstructions: plan.assessment.quality_instructions,
    },
    reportMeta: Object.fromEntries(
      Object.entries(plan.report).map(([key, value]) => [
        key.replace(/_([a-z])/gu, (_match, letter) => letter.toUpperCase()),
        value,
      ]),
    ),
  };
}

function sourceProvenance(plan, extra = {}) {
  return {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    createdAt: new Date().toISOString(),
    sourceRoot: ROOT,
    studyId: plan.id,
    totalAttemptCeiling: plan.total_attempt_ceiling,
    generationAttemptMaximum: plan.generationCap,
    plannedAssessmentAttempts: plan.judge_calls,
    technicalRecoveryReserve: plan.recovery_attempt_reserve,
    noteQuotationScope: 'prior_or_current_public_speech',
    configuredModels: {
      learner: Object.fromEntries(plan.arms.map((arm) => [arm.id, arm.model])),
      tutor: 'codex.gpt-5.6-sol',
      judge: 'claude-code.claude-opus-5',
    },
    ...extra,
  };
}

function syntheticArms(plan) {
  return plan.arms.map((arm) => {
    let releasedPremiseIds = [];
    const turns = [];
    for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
      const proof = buildContinuityProofPlan({ plan, turn, releasedPremiseIds });
      releasedPremiseIds = [...releasedPremiseIds, ...proof.requiredReleases.map((row) => row.premise)];
      turns.push({
        turn,
        learner: `Synthetic learner turn ${turn}; layout and packet fixture, not model output.`,
        tutor:
          proof.sources.map((source) => source.text).join(' ') ||
          `Synthetic tutor turn ${turn}; layout and packet fixture, not model output.`,
      });
    }
    return {
      ...arm,
      opening: plan.world.opening_frame.authored_text,
      transcript: [
        `Opening: ${plan.world.opening_frame.authored_text}`,
        ...turns.flatMap((row) => [`Learner ${row.turn}: ${row.learner}`, `Tutor ${row.turn}: ${row.tutor}`]),
      ].join('\n'),
      wallTimeMs: 0,
      repetition: { meanLexicalSurpriseAfterOpening: null },
      technical: {
        learnerMechanism: { calls: 0, medianLatencyMs: null, totalLatencyMs: 0 },
        learnerFinal: { calls: 0, meanEndToEndOutputTokensPerSecond: null },
        tutor: { calls: 0, totalLatencyMs: 0 },
      },
      snapshot: {
        turns,
        ledgers: { learner: { settled: [], open: [] }, tutor: { settled: [], open: [] } },
        maxExchanges: plan.max_exchanges,
        disposition: 'exchange_cap',
        proofControl: {
          releasedPremiseIds,
          scheduledPremises: plan.world.premises.length,
          publicProofEntailed: true,
          inquiryDisposition: 'public_evidence_sufficient_learner_understanding_unassessed',
        },
      },
    };
  });
}

function writePreparation(outDir, plan, provenance) {
  writeJson(path.join(outDir, 'plan.json'), { ...plan, provenance });
  const opening = [{ role: 'assistant', content: plan.world.opening_frame.authored_text }];
  for (const speaker of ['learner', 'tutor']) {
    writeJson(
      path.join(outDir, `${speaker}-preflight.json`),
      buildContinuityRequest({ plan, speaker, turn: 1, history: opening }),
    );
  }
  let releasedPremiseIds = [];
  const proofPreflight = [];
  for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
    const request = buildContinuityRequest({
      plan,
      speaker: 'tutor',
      turn,
      history: opening,
      releasedPremiseIds,
    });
    proofPreflight.push(request);
    releasedPremiseIds = [...releasedPremiseIds, ...request.proofPlan.requiredReleases.map((row) => row.premise)];
  }
  writeJson(path.join(outDir, 'proof-preflight.json'), proofPreflight);

  const previewArms = syntheticArms(plan);
  const sourceContexts = Object.fromEntries(
    previewArms.map((arm) => [arm.id, investedRivalDeliveredSourceContext(plan, arm)]),
  );
  const packets = buildBenchmarkJobs(previewArms, {
    extendedQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: sourceContexts,
  });
  writeJson(path.join(outDir, 'judge-packet-preflight.json'), {
    synthetic: true,
    modelCalls: 0,
    packets,
  });
  const preview = renderContinuityReport({
    arms: previewArms,
    evaluation: { scores: [], attemptsUsed: 0 },
    provenance: { ...provenance, budget: { used: 0, limit: plan.total_attempt_ceiling } },
    characterBrief: plan.characterBrief,
    proofControl: true,
    comparisonLabel: 'Claim boundary',
    corrections: [
      'The character wants a defensible answer and begins with a public rival explanation.',
      'Answered objections should be conceded rather than renamed or reopened.',
      'Sol remains responsible for due public evidence and the live inference.',
      'Acting, teaching, repetition and character fidelity remain separate readings.',
    ],
    reportMeta: plan.reportMeta,
    mock: true,
  });
  fs.writeFileSync(path.join(outDir, 'report-preview.html'), preview.html, { flag: 'wx' });
  writeJson(path.join(outDir, 'public-preview.json'), preview.interchange);
  fs.copyFileSync(path.join(ROOT, plan.design), path.join(outDir, 'design.md'), fs.constants.COPYFILE_EXCL);
  return { packets: packets.length, preview: path.join(outDir, 'report-preview.html') };
}

function reportResult({ outDir, plan, arms, evaluation, provenance }) {
  const result = {
    arms,
    evaluation,
    provenance,
    characterBrief: plan.characterBrief,
    proofControl: true,
    comparisonLabel: 'Claim boundary',
    corrections: [
      'The same character, public opening, proof schedule, Sol route and settings apply to both arms.',
      'The learner brief contains no hidden answer, future clue, recurrence target or score threshold.',
      'A repair offer does not answer the causal rival; a defeated objection should be acknowledged.',
      'The two checkpoint packages may differ beyond abliteration, so results are descriptive.',
    ],
    reportMeta: plan.reportMeta,
  };
  writeJson(path.join(outDir, 'report-data.json'), result);
  const rendered = renderContinuityReport(result);
  fs.writeFileSync(path.join(outDir, 'report.html'), rendered.html, { flag: 'wx' });
  writeJson(path.join(outDir, 'public-dialogues.json'), rendered.interchange);
}

function publicSourceContexts(plan, arms) {
  return Object.fromEntries(arms.map((arm) => [arm.id, investedRivalDeliveredSourceContext(plan, arm)]));
}

export function investedRivalJudgeCallOptions(role, options, plainJsonQuality = false) {
  return {
    ...options,
    singleAttemptJsonText: plainJsonQuality && role.startsWith('local-qwen-benchmark-quality'),
  };
}

export function allowUnknownRootOutputFields(outputSchema) {
  if (outputSchema?.type !== 'object' || !outputSchema.properties) {
    throw new Error('root-field projection requires an object output schema');
  }
  return { ...structuredClone(outputSchema), additionalProperties: true };
}

export function projectRegisteredRootOutput(text, outputSchema) {
  const parsed = JSON.parse(text);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('root-field projection requires one JSON object');
  }
  const registeredKeys = Object.keys(outputSchema?.properties || {});
  if (!registeredKeys.length) throw new Error('root-field projection requires registered properties');
  const projected = Object.fromEntries(
    registeredKeys.filter((key) => Object.hasOwn(parsed, key)).map((key) => [key, parsed[key]]),
  );
  return {
    text: JSON.stringify(projected),
    discardedRootKeys: Object.keys(parsed)
      .filter((key) => !registeredKeys.includes(key))
      .sort(),
  };
}

function retryableCompletionTransportError(error) {
  return (
    error?.code === 'CLI_PROVIDER_RESPONSE_FREE_ERROR' &&
    error?.classification === 'response_free_error' &&
    error?.reason === 'result_error_without_structured_output'
  );
}

async function scoreArms({
  plan,
  arms,
  outDir,
  budget,
  priorScores = [],
  priorAttempts = 0,
  ceiling = 8,
  plainJsonQuality = false,
  splitQuality = false,
  priorSplitQualityParts = [],
  completionRootProjection = false,
  completionTechnicalAttemptLimit = 1,
}) {
  let newPhysicalAttempts = 0;
  let returnedCandidate = null;
  const callJudge = async (...args) => {
    const [agent, systemPrompt, userPrompt, role, options] = args;
    const projectionActive = completionRootProjection && role === 'local-qwen-benchmark-quality-turns';
    const attemptLimit = projectionActive ? completionTechnicalAttemptLimit : 1;
    const technicalFailures = [];
    for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
      const reservation = budget.reserve({ role, stage: 'assessment', unitId: options.durableUnitId });
      newPhysicalAttempts += 1;
      fs.appendFileSync(path.join(outDir, 'attempts.jsonl'), `${JSON.stringify(reservation)}\n`);
      budget.markDispatched?.();
      let rawOutput;
      try {
        const callOptions = investedRivalJudgeCallOptions(role, options, plainJsonQuality);
        const response = await callAIWithCliBridge(agent, systemPrompt, userPrompt, role, {
          ...callOptions,
          ...(projectionActive
            ? {
                outputSchema: allowUnknownRootOutputFields(options.outputSchema),
                onRawOutput: (output) => {
                  rawOutput = output;
                },
              }
            : {}),
        });
        if (!projectionActive) {
          returnedCandidate = { role, reservation };
          return response;
        }
        options.onRawOutput(rawOutput);
        const projection = projectRegisteredRootOutput(response.text, options.outputSchema);
        returnedCandidate = { role, reservation };
        return {
          ...response,
          text: projection.text,
          outputProjection: {
            rule: 'registered_root_fields_only_then_original_strict_schema',
            discardedRootKeys: projection.discardedRootKeys,
            registeredValuesChanged: false,
          },
          technicalFailures,
        };
      } catch (error) {
        if (projectionActive) {
          const retryBase = path.join(outDir, 'evaluation', `B-quality-turns-technical-attempt-${attempt}`);
          if (rawOutput !== undefined) writeJson(`${retryBase}.transport.json`, rawOutput);
          writeJson(`${retryBase}.error.json`, {
            message: error.message,
            code: error.code,
            classification: error.classification,
            reason: error.reason,
          });
        }
        if (!projectionActive || attempt >= attemptLimit || !retryableCompletionTransportError(error)) throw error;
        budget.fail?.(error);
        technicalFailures.push({
          attempt,
          message: error.message,
          code: error.code,
          classification: error.classification,
          reason: error.reason,
        });
      }
    }
    throw new Error('completion transport exhausted without a result');
  };
  callJudge.persistResponse = (responsePath) => {
    if (!returnedCandidate) throw new Error('cannot persist an assessment response without a returned candidate');
    budget.persistResponse?.(responsePath);
  };
  callJudge.complete = () => {
    budget.complete?.();
    returnedCandidate = null;
  };
  callJudge.fail = (error) => {
    budget.fail?.(error);
    returnedCandidate = null;
  };
  const evaluation = await scoreBenchmarkArms(arms, path.join(outDir, 'evaluation'), {
    ceiling,
    extendedQuality: true,
    allowOneBasedIndices: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: publicSourceContexts(plan, arms),
    priorScores,
    priorSplitQualityParts,
    priorAttempts,
    splitQuality,
    durableUnitPrefix: 'assessment',
    callJudge,
  });
  return {
    ...evaluation,
    physicalAttempts: {
      prior: priorAttempts,
      new: newPhysicalAttempts,
      used: priorAttempts + newPhysicalAttempts,
    },
  };
}

function investedRivalWorkflowUnits(phase, state) {
  if (phase === 'GENERATING') {
    return {
      complete: state.completedArms,
      active: state.armActive ? 1 : 0,
      failed: 0,
      missing: Math.max(0, 2 - state.completedArms - (state.armActive ? 1 : 0)),
    };
  }
  if (phase === 'AUDITING') {
    return {
      complete: state.completedAssessments,
      active: state.assessmentActive ? 1 : 0,
      failed: 0,
      missing: Math.max(0, state.assessmentUnits - state.completedAssessments - (state.assessmentActive ? 1 : 0)),
    };
  }
  if (phase === 'PACKAGING') {
    return { complete: state.packageComplete ? 1 : 0, active: state.packageComplete ? 0 : 1, failed: 0, missing: 0 };
  }
  return { complete: 0, active: 0, failed: 0, missing: 0 };
}

export function createInvestedRivalWorkflowTracker({
  plan,
  outDir,
  admission,
  recovery = false,
  priorAttemptBase = 0,
  completedArms = 0,
  completedAssessments = 0,
  assessmentUnits = plan?.judge_calls,
  baselineCompletedCalls = 0,
  baselineFailedCalls = 0,
  effectiveCeiling = plan?.total_attempt_ceiling,
  recoverySourceDir = null,
  at,
} = {}) {
  const state = {
    completedArms,
    armActive: false,
    completedAssessments,
    assessmentActive: false,
    assessmentUnits,
    packageComplete: false,
    recentDurationsMs: [],
  };
  const filePath = path.join(outDir, 'workflow-status.json');
  const durableStatusPath = path.join(outDir, 'status.json');
  const predecessorLedgerPath = recoverySourceDir ? path.join(recoverySourceDir, 'run-ledger.jsonl') : null;
  const ledgerCounts = () => {
    const events =
      admission.ledger_path && fs.existsSync(admission.ledger_path) ? readJsonLines(admission.ledger_path) : [];
    return {
      completed: baselineCompletedCalls + events.filter((event) => event.type === 'attempt_completed').length,
      failed:
        baselineFailedCalls +
        events.filter((event) =>
          ['attempt_failed', 'attempt_cancelled_before_dispatch', 'attempt_interrupted_after_dispatch'].includes(
            event.type,
          ),
        ).length,
      reserved: priorAttemptBase + admission.studyReserved,
      hard_ceiling: effectiveCeiling,
    };
  };
  const startedAt = at || new Date();
  let status = createLongRunningWorkflowStatus({
    workflowId: `${plan.id}-completion`,
    phasePlan: INVESTED_RIVAL_WORKFLOW_PHASES,
    at: startedAt,
    units: investedRivalWorkflowUnits('GENERATING', state),
    calls: ledgerCounts(),
    modelActivity: { state: 'inactive', explanation: 'Preflight and recovery checks make no model calls.' },
    nextAction: {
      description: 'Verify the registered invested-rival study and any preserved evidence.',
      stopping_condition: 'Stop before dispatch if the plan, evidence, routes, or remaining ceiling drift.',
    },
  });
  status = completeLongRunningWorkflowPhase(status, {
    phase: 'PREFLIGHT',
    nextPhase: 'GENERATING',
    at: startedAt,
    startNextImmediately: true,
    units: investedRivalWorkflowUnits('GENERATING', state),
    calls: ledgerCounts(),
    modelActivity: { state: 'inactive', explanation: 'Preflight passed; no generation call is active.' },
    nextAction: {
      description: 'Generate only arms and turns not already preserved as valid.',
      stopping_condition: 'Stop on route drift, a substantive failure, or the hard call ceiling.',
    },
  });
  if (recovery) {
    status = recordLongRunningWorkflowRecovery(status, {
      at: startedAt,
      operation: 'Continue the invested-rival study from preserved evidence.',
      reason: 'A predecessor stopped before the registered workflow was complete.',
      scope: `Reuse valid outputs and run only missing work under the unchanged ${effectiveCeiling}-attempt ceiling.`,
      modelActivity: status.model_activity,
    });
  }
  const persist = () => {
    writeLongRunningWorkflowStatusAtomic(filePath, status);
    const predecessorEvents =
      predecessorLedgerPath && fs.existsSync(predecessorLedgerPath)
        ? readJsonLines(predecessorLedgerPath, 'invested-rival predecessor attempt ledger')
        : [];
    const currentEvents =
      admission.ledger_path && fs.existsSync(admission.ledger_path)
        ? readJsonLines(admission.ledger_path, 'invested-rival workflow attempt ledger')
        : [];
    const attemptEvents = [...predecessorEvents, ...currentEvents];
    const unitIds = new Set(
      attemptEvents
        .filter((event) => event.type === 'model_attempt_dispatch_reserved')
        .map((event) => event.unit_id)
        .filter(Boolean),
    );
    const generationUnitIds = new Set([...unitIds].filter((unitId) => unitId.startsWith('generation/')));
    const complete = status.current_phase === 'WORKFLOW_COMPLETE';
    const generationOpen = status.current_phase === 'GENERATING';
    const plannedTurns = generationOpen ? plan.max_exchanges * plan.arms.length * 2 : generationUnitIds.size;
    const plannedUnits = complete
      ? new Set(
          attemptEvents
            .filter((event) => event.type === 'attempt_completed')
            .map((event) => event.unit_id)
            .filter(Boolean),
        ).size
      : plannedTurns + assessmentUnits;
    const durableStatus = buildDurableEvaluationStatus({
      events: attemptEvents,
      plannedUnits,
      plannedTurns,
      completedTurns: generationUnitIds.size,
      hardCeiling: effectiveCeiling,
      workflowState: complete ? 'complete' : status.current_phase === 'BLOCKED' ? 'blocked' : 'running',
      scientificVerdict: complete ? 'descriptive_result_packaged' : 'registered_measurement_pending',
      modelActivity: status.model_activity.state,
      now: new Date(status.last_material_progress_at),
    });
    if (complete && (durableStatus.planes.unit.active !== 0 || durableStatus.planes.unit.missing !== 0)) {
      throw new Error('completed invested-rival workflow retains active or missing durable work units');
    }
    writeJsonAtomic(durableStatusPath, durableStatus);
    return status;
  };
  const refresh = ({ durationMs, modelActivity, nextAction } = {}) => {
    if (Number.isFinite(durationMs) && durationMs > 0) {
      state.recentDurationsMs = [...state.recentDurationsMs, durationMs].slice(-8);
    }
    status = updateLongRunningWorkflowProgress(status, {
      units: investedRivalWorkflowUnits(status.current_phase, state),
      calls: ledgerCounts(),
      recentUnitDurationsMs: state.recentDurationsMs,
      ...(modelActivity ? { modelActivity } : {}),
      ...(nextAction ? { nextAction } : {}),
    });
    return persist();
  };
  persist();
  return {
    filePath,
    durableStatusPath,
    attemptStarted({ detail }) {
      const assessment = detail.stage === 'assessment' || detail.unitId?.startsWith('assessment/');
      if (assessment) state.assessmentActive = true;
      return refresh({
        modelActivity: {
          state: 'active',
          explanation: assessment ? 'One registered Opus packet is in flight.' : 'One dialogue call is in flight.',
        },
      });
    },
    attemptCompleted({ detail, durationMs }) {
      const assessment = detail.stage === 'assessment' || detail.unitId?.startsWith('assessment/');
      if (assessment) {
        state.assessmentActive = false;
        state.completedAssessments += 1;
      }
      return refresh({
        durationMs: assessment ? durationMs : undefined,
        modelActivity: { state: 'inactive', explanation: 'The latest call is durably complete.' },
      });
    },
    attemptFailed({ detail, error }) {
      if (detail.stage === 'assessment' || detail.unitId?.startsWith('assessment/')) state.assessmentActive = false;
      return refresh({
        modelActivity: { state: 'inactive', explanation: 'The latest call failed and no call is active.' },
        nextAction: {
          description: `Use only the registered recovery path: ${error?.message || 'model call failed'}`,
          stopping_condition: 'Stop on substantive failure, route drift, or exhausted recovery capacity.',
        },
      });
    },
    armStarted() {
      state.armActive = true;
      return refresh({ modelActivity: { state: 'active', explanation: 'One registered dialogue arm is running.' } });
    },
    armCompleted(durationMs) {
      state.armActive = false;
      state.completedArms += 1;
      return refresh({
        durationMs,
        modelActivity: { state: 'inactive', explanation: 'The latest dialogue arm is complete.' },
      });
    },
    generationCompleted() {
      if (state.completedArms !== 2 || state.armActive) {
        throw new Error('cannot complete invested-rival generation before both arms are complete');
      }
      status = completeLongRunningWorkflowPhase(status, {
        phase: 'GENERATING',
        nextPhase: 'AUDITING',
        startNextImmediately: true,
        units: investedRivalWorkflowUnits('AUDITING', state),
        calls: ledgerCounts(),
        recentUnitDurationsMs: [],
        modelActivity: { state: 'inactive', explanation: 'Both dialogue arms are complete; assessment is next.' },
        nextAction: {
          description: 'Assess only packets not already preserved as valid.',
          stopping_condition: `Stop on a substantive judge failure or when all ${assessmentUnits} packets are valid.`,
        },
      });
      state.recentDurationsMs = [];
      return persist();
    },
    assessmentCompleted() {
      if (state.completedAssessments !== state.assessmentUnits || state.assessmentActive) {
        throw new Error('cannot complete invested-rival assessment before every packet is valid');
      }
      status = completeLongRunningWorkflowPhase(status, {
        phase: 'AUDITING',
        nextPhase: 'PACKAGING',
        startNextImmediately: true,
        units: investedRivalWorkflowUnits('PACKAGING', state),
        calls: ledgerCounts(),
        modelActivity: { state: 'inactive', explanation: 'All assessments are valid; packaging is zero-call.' },
        nextAction: {
          description: 'Build and seal the invested-rival report.',
          stopping_condition: 'Stop after the report, completion record, and run seal are durable.',
        },
      });
      return persist();
    },
    packagingCompleted() {
      state.packageComplete = true;
      status = completeLongRunningWorkflowPhase(status, {
        phase: 'PACKAGING',
        nextPhase: 'WORKFLOW_COMPLETE',
        startNextImmediately: true,
        units: { complete: 1, active: 0, failed: 0, missing: 0 },
        calls: ledgerCounts(),
        modelActivity: { state: 'inactive', explanation: 'The run is sealed and no model-backed phase remains.' },
        nextAction: {
          description: 'Preserve the completed private archive.',
          stopping_condition: 'Stop unless a separate follow-up is requested.',
        },
      });
      return persist();
    },
    blocked(error) {
      state.armActive = false;
      state.assessmentActive = false;
      status = blockLongRunningWorkflow(status, {
        blockedPhase: status.current_phase,
        operation: 'Run the current registered invested-rival phase.',
        error: error?.message || String(error),
        units: investedRivalWorkflowUnits(status.current_phase, state),
        calls: ledgerCounts(),
        modelActivity: { state: 'inactive', explanation: 'The runner stopped and no model call remains active.' },
        nextAction: {
          description: 'Inspect the preserved failure and use only its registered recovery path.',
          stopping_condition: 'Stop before changing scientific inputs or exceeding the ceiling.',
        },
        humanActionRequired: false,
      });
      return persist();
    },
  };
}

async function runFresh(plan, outDir, admission, generationRecovery = null) {
  const preservedAttemptCount = generationRecovery?.stop.budget.used || 0;
  const priorAttemptCount = generationRecovery?.sameStudy ? 0 : preservedAttemptCount;
  let workflow;
  const budget = investedRivalPaidBudget(admission, plan.total_attempt_ceiling, priorAttemptCount, null, {
    onAttemptStarted: (attempt) => workflow?.attemptStarted(attempt),
    onAttemptCompleted: (attempt) => workflow?.attemptCompleted(attempt),
    onAttemptFailed: (attempt) => workflow?.attemptFailed(attempt),
  });
  const arms = [...(generationRecovery?.priorArms || [])];
  try {
    const provenance = sourceProvenance(plan, {
      commit: admission.source.commit,
      tree: admission.source.tree,
      dirty: false,
      detached: true,
      mainRef: admission.source.main_ref,
      mainCommit: admission.source.main_commit,
      authorization: admission.authorization,
      recovery: Boolean(generationRecovery),
      ...(generationRecovery
        ? {
            recoverySource: generationRecovery.sourceDir,
            recoveredGeneration: generationRecovery.failure,
            priorAttemptCount: preservedAttemptCount,
            linkedRecoveryStudyId: admission.study_id,
            linkedRecoveryAttemptCeiling: admission.spend_cap,
            privateLedgerPolicy: 'drop_unsupported_quote_rows_preserve_public_speech',
            reusedCompletedArms: arms.map((arm) => arm.id),
          }
        : {}),
    });
    writePreparation(outDir, plan, provenance);
    const acceptedGenerationCalls =
      arms.reduce((sum, arm) => sum + (arm.snapshot?.turns?.length || 0) * 2, 0) +
      (generationRecovery?.firstLearnerReply ? 1 : 0) +
      Object.keys(generationRecovery?.partial?.savedReplies || {}).length;
    const completedAssessmentPackets = generationRecovery?.priorAssessmentPackets || 0;
    workflow = createInvestedRivalWorkflowTracker({
      plan,
      outDir,
      admission,
      recovery: Boolean(generationRecovery),
      priorAttemptBase: priorAttemptCount,
      completedArms: arms.length,
      completedAssessments: completedAssessmentPackets,
      baselineCompletedCalls: acceptedGenerationCalls + completedAssessmentPackets,
      baselineFailedCalls: Math.max(0, preservedAttemptCount - acceptedGenerationCalls - completedAssessmentPackets),
      recoverySourceDir: generationRecovery?.sourceDir || null,
    });
    const service = yaml.parse(fs.readFileSync(path.join(ROOT, plan.service_config), 'utf8'));
    service.workspace.path = plan.mtp_chat_root;
    service.timing.jsonl_path = path.join(outDir, 'service-timings.jsonl');
    const servicePath = path.join(outDir, 'service.yaml');
    fs.writeFileSync(servicePath, yaml.stringify(service), { flag: 'wx' });
    for (const arm of plan.arms) {
      if (arms.some((completed) => completed.id === arm.id)) continue;
      const started = Date.now();
      workflow.armStarted();
      let ownsServer = false;
      try {
        await manageServer(plan.mtp_chat_root, arm.profile, 'start', servicePath);
        ownsServer = true;
        const loaded = await discoverLoadedModel(plan.base_url, { modelIdContains: arm.model });
        const runtimeArm = runtimeServiceArm(service, arm, loaded);
        await runContinuityArm({
          plan,
          arm: runtimeArm,
          outDir: path.join(outDir, arm.id),
          budget: budget.scope(`generation/${arm.id}`),
          ...(generationRecovery ? { unsupportedQuotationPolicy: 'drop' } : {}),
          ...(generationRecovery?.firstLearnerReply && arm.id === 'A'
            ? {
                firstLearnerReply: generationRecovery.firstLearnerReply,
              }
            : {}),
          ...(generationRecovery?.partial?.armId === arm.id
            ? { savedReplies: generationRecovery.partial.savedReplies }
            : {}),
        });
      } finally {
        if (ownsServer) await manageServer(plan.mtp_chat_root, arm.profile, 'stop', servicePath);
      }
      arms.push(
        readBenchmarkArm({
          ...arm,
          path: path.join(outDir, arm.id, 'dialogue.json'),
          wallTimeMs: Date.now() - started,
        }),
      );
      workflow.armCompleted(Date.now() - started);
    }
    writeJson(path.join(outDir, 'arms.json'), arms);
    workflow.generationCompleted();
    const evaluation = await scoreArms({
      plan,
      arms,
      outDir,
      budget,
      priorScores: generationRecovery?.priorScores || [],
      priorAttempts: completedAssessmentPackets,
    });
    workflow.assessmentCompleted();
    const finalProvenance = { ...provenance, budget: budget.snapshot() };
    reportResult({ outDir, plan, arms, evaluation, provenance: finalProvenance });
    writeJson(path.join(outDir, 'completed.json'), {
      budget: budget.snapshot(),
      arms: arms.map((arm) => ({
        id: arm.id,
        exchanges: arm.snapshot.turns.length,
        disposition: arm.snapshot.disposition,
      })),
      assessments: evaluation.scores.length,
    });
    admission.close({
      type: 'run_sealed',
      status: 'complete',
      completed_arms: arms.length,
      completed_assessments: evaluation.scores.length,
      reserved_attempts: admission.reserved,
      ...(generationRecovery ? { recovery_from: generationRecovery.sourceDir } : {}),
    });
    workflow.packagingCompleted();
    return { outDir, dryRun: false, attempts: budget.snapshot().used };
  } catch (error) {
    let recoveryPermitted = false;
    if (arms.length === 2) {
      try {
        technicalRecoveryEligible(outDir);
        recoveryPermitted = true;
      } catch {
        recoveryPermitted = false;
      }
    }
    writeJson(path.join(outDir, 'stopped.json'), {
      error: error.message,
      budget: budget.snapshot(),
      armsCompleted: arms.length,
      recoveryPermitted,
    });
    admission.close({
      type: 'run_sealed',
      status: recoveryPermitted ? 'technical_failure' : 'failed',
      error: error.message,
      completed_arms: arms.length,
      reserved_attempts: admission.reserved,
      ...(generationRecovery ? { recovery_from: generationRecovery.sourceDir } : {}),
      ...(recoveryPermitted ? { recovery_permitted: true } : {}),
    });
    workflow?.blocked(error);
    throw error;
  }
}

export function readGenerationRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  if (sourcePlan.id !== plan.id || sourcePlan.provenance?.recovery) {
    throw new Error('generation recovery must start from the original invested-rival run');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  if (
    stop.armsCompleted !== 0 ||
    stop.budget?.used !== 1 ||
    !/^unsupported (?:open|settled) quotation$/u.test(stop.error || '')
  ) {
    throw new Error('generation recovery requires the preserved first-turn private-ledger quotation failure');
  }
  for (const forbidden of [
    path.join(sourceDir, 'A', 'dialogue.json'),
    path.join(sourceDir, 'A', 'checkpoint-1.json'),
    path.join(sourceDir, 'B'),
    path.join(sourceDir, 'evaluation'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('generation recovery source contains accepted downstream output');
  }
  const request = JSON.parse(fs.readFileSync(path.join(sourceDir, 'A', '1-learner.request.json'), 'utf8'));
  const response = JSON.parse(fs.readFileSync(path.join(sourceDir, 'A', '1-learner.response.json'), 'utf8'));
  const dropped = [];
  const parsed = parseContinuityReply(response.text, request.messageHistory, {
    unsupportedQuotationPolicy: 'drop',
    onUnsupportedQuotation: (row) => dropped.push(row),
  });
  if (!dropped.length) throw new Error('generation recovery source has no unsupported private ledger quotation');
  return {
    sourceDir,
    sourcePlan,
    stop,
    failure: { error: stop.error, droppedPrivateLedgerRows: dropped },
    firstLearnerReply: {
      source: path.join(sourceDir, 'A', '1-learner.response.json'),
      request,
      response,
      parsedSpeech: parsed.speech,
    },
  };
}

export function generationRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  if (
    !Number.isInteger(priorAttemptCount) ||
    priorAttemptCount < 1 ||
    priorAttemptCount >= plan.total_attempt_ceiling
  ) {
    throw new Error('generation recovery requires a positive preserved attempt count below the study ceiling');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v1`,
    spendCap: plan.total_attempt_ceiling - priorAttemptCount,
    priorAttemptCount,
  };
}

function readJsonLines(file) {
  return fs
    .readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function countInvestedRivalRunReservations(events) {
  return events.reduce((sum, event) => {
    if (event.type === 'model_attempt_dispatch_reserved') return sum + 1;
    if (event.type === 'model_attempt_reserved') return sum + Number(event.count || 0);
    return sum;
  }, 0);
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function investedRivalAcceptedResponsePaths(events, sourceDir) {
  const reservations = new Map(
    events
      .filter((event) => event.type === 'model_attempt_dispatch_reserved')
      .map((event) => [event.attempt_id, event]),
  );
  const persisted = new Map(
    events.filter((event) => event.type === 'attempt_response_persisted').map((event) => [event.attempt_id, event]),
  );
  const accepted = new Set();
  for (const terminal of events.filter((event) => event.type === 'attempt_completed')) {
    const reservation = reservations.get(terminal.attempt_id);
    const response = persisted.get(terminal.attempt_id);
    if (!reservation || !response || !path.isAbsolute(response.response_path || '')) {
      throw new Error(`completed invested-rival attempt ${terminal.attempt_id} has no durable response record`);
    }
    const responsePath = path.resolve(response.response_path);
    const relative = path.relative(sourceDir, responsePath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(responsePath)) {
      throw new Error(`durable invested-rival response is missing or outside the predecessor: ${responsePath}`);
    }
    if (sha256File(responsePath) !== response.response_sha256) {
      throw new Error(`durable invested-rival response hash drift: ${responsePath}`);
    }
    accepted.add(responsePath);
  }
  return accepted;
}

function readDurableInvestedRivalPrefix(plan, armDir, acceptedResponses) {
  const savedReplies = {};
  let gapFound = false;
  for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
    for (const speaker of ['learner', 'tutor']) {
      const requestPath = path.join(armDir, `${turn}-${speaker}.request.json`);
      const responsePath = path.join(armDir, `${turn}-${speaker}.response.json`);
      const hasRequest = fs.existsSync(requestPath);
      const hasResponse = acceptedResponses.has(path.resolve(responsePath));
      if (hasResponse && !hasRequest) throw new Error(`durable recovery response has no request: ${responsePath}`);
      if (!gapFound && hasRequest && hasResponse) {
        savedReplies[`${turn}-${speaker}`] = {
          source: responsePath,
          request: JSON.parse(fs.readFileSync(requestPath, 'utf8')),
          response: JSON.parse(fs.readFileSync(responsePath, 'utf8')),
        };
        continue;
      }
      if (hasRequest || fs.existsSync(responsePath)) gapFound = true;
      if (gapFound && hasResponse) throw new Error(`durable invested-rival recovery prefix is not contiguous`);
    }
  }
  return savedReplies;
}

function readDurableInvestedRivalAssessments(plan, sourceDir, arms, acceptedResponses) {
  const evaluationDir = path.join(sourceDir, 'evaluation');
  const priorScores = [];
  if (!fs.existsSync(evaluationDir)) return { priorScores, completedPackets: 0 };
  const jobs = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: publicSourceContexts(plan, arms),
  });
  for (const job of jobs) {
    const base = path.join(evaluationDir, `${job.arm}-${job.kind}`);
    const responsePath = `${base}.response.txt`;
    if (!acceptedResponses.has(path.resolve(responsePath))) continue;
    if (
      !fs.existsSync(`${base}.provider.json`) ||
      !fs.existsSync(`${base}.prompt.txt`) ||
      !fs.existsSync(`${base}.schema.json`) ||
      fs.existsSync(`${base}.error.json`) ||
      fs.readFileSync(`${base}.prompt.txt`, 'utf8') !== job.prompt ||
      JSON.stringify(JSON.parse(fs.readFileSync(`${base}.schema.json`, 'utf8'))) !== JSON.stringify(job.outputSchema)
    ) {
      throw new Error(`durable invested-rival assessment packet drift for ${job.arm}/${job.kind}`);
    }
    const text = fs.readFileSync(responsePath, 'utf8');
    if (JSON.parse(fs.readFileSync(`${base}.provider.json`, 'utf8')).text !== text) {
      throw new Error(`durable invested-rival assessment response mismatch for ${job.arm}/${job.kind}`);
    }
    const arm = arms.find((candidate) => candidate.id === job.arm);
    const parsed = parseBenchmarkScore(job.kind, text, arm.snapshot.turns.length, {
      extendedQuality: true,
      allowOneBasedIndices: true,
      outputSchema: job.outputSchema,
    });
    priorScores.push({
      arm: job.arm,
      kind: job.kind,
      raw: parsed.parsed,
      scored: normalizeScores(job.kind, parsed.parsed),
      indexNormalization: parsed.indexNormalization || null,
    });
  }
  return { priorScores, completedPackets: priorScores.length };
}

export function readDurableInvestedRivalRecovery(plan, sourcePath) {
  if (!sourcePath || !path.isAbsolute(sourcePath)) {
    throw new Error('durable invested-rival recovery source must be absolute');
  }
  const sourceDir = path.resolve(sourcePath);
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const { provenance: sourceProvenanceRecord, ...sourceScientificPlan } = sourcePlan;
  if (JSON.stringify(sourceScientificPlan) !== JSON.stringify(plan)) {
    throw new Error('durable invested-rival recovery plan drift');
  }
  const events = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const launch = events.find((event) => event.type === 'launch_admitted');
  const seal = events.at(-1);
  const reservations = events.filter((event) => event.type === 'model_attempt_dispatch_reserved');
  const terminalTypes = new Set([
    'attempt_completed',
    'attempt_failed',
    'attempt_cancelled_before_dispatch',
    'attempt_interrupted_after_dispatch',
  ]);
  const terminals = events.filter((event) => terminalTypes.has(event.type));
  if (
    launch?.study_id !== plan.id ||
    launch?.spend_cap !== plan.total_attempt_ceiling ||
    seal?.type !== 'run_sealed' ||
    seal?.status !== 'technical_failure' ||
    seal?.recovery_permitted !== true ||
    terminals.length !== reservations.length ||
    new Set(terminals.map((event) => event.attempt_id)).size !== terminals.length ||
    terminals.some((terminal) => !reservations.some((reservation) => reservation.attempt_id === terminal.attempt_id))
  ) {
    throw new Error('durable invested-rival recovery requires a sealed interrupted-launch predecessor');
  }
  const acceptedResponses = investedRivalAcceptedResponsePaths(events, sourceDir);
  const priorArms = [];
  let partial = null;
  let reachedMissing = false;
  for (const arm of plan.arms) {
    const armDir = path.join(sourceDir, arm.id);
    const dialoguePath = path.join(armDir, 'dialogue.json');
    if (fs.existsSync(dialoguePath)) {
      if (partial || reachedMissing) throw new Error('durable completed arms are not a fixed execution prefix');
      const recovered = readBenchmarkArm({ ...arm, path: dialoguePath });
      const acceptedArmResponses = fs
        .readdirSync(armDir)
        .filter((name) => /^\d+-(?:learner|tutor)\.response\.json$/u.test(name))
        .filter((name) => acceptedResponses.has(path.resolve(armDir, name))).length;
      if (acceptedArmResponses !== recovered.snapshot.turns.length * 2) {
        throw new Error(`completed durable arm ${arm.id} contains an unaccepted response`);
      }
      priorArms.push(recovered);
      continue;
    }
    if (fs.existsSync(armDir)) {
      if (partial || reachedMissing) throw new Error('durable recovery has more than one partial arm');
      partial = { armId: arm.id, savedReplies: readDurableInvestedRivalPrefix(plan, armDir, acceptedResponses) };
      reachedMissing = true;
      continue;
    }
    reachedMissing = true;
  }
  const assessment =
    priorArms.length === plan.arms.length
      ? readDurableInvestedRivalAssessments(plan, sourceDir, priorArms, acceptedResponses)
      : { priorScores: [], completedPackets: 0 };
  const acceptedGenerationResponses = priorArms.reduce(
    (sum, arm) => sum + arm.snapshot.turns.length * 2,
    Object.keys(partial?.savedReplies || {}).length,
  );
  const aggregateAttempts = Number.isSafeInteger(seal.study_reserved) ? seal.study_reserved : reservations.length;
  const responseFreeAttempts = aggregateAttempts - acceptedGenerationResponses - assessment.completedPackets;
  if (
    aggregateAttempts > plan.total_attempt_ceiling ||
    responseFreeAttempts < 0 ||
    responseFreeAttempts > plan.recovery_attempt_reserve
  ) {
    throw new Error('durable invested-rival recovery exceeds the registered reserve');
  }
  return {
    durable: true,
    sameStudy: true,
    sourceDir,
    sourcePlan,
    sourceProvenance: sourceProvenanceRecord,
    stop: { budget: { used: aggregateAttempts, limit: plan.total_attempt_ceiling } },
    priorArms,
    partial,
    priorScores: assessment.priorScores,
    priorAssessmentPackets: assessment.completedPackets,
    responseFreeAttempts,
  };
}

function recoveredArmElapsedMs(snapshot, sourceDir) {
  const tracePath = path.isAbsolute(snapshot.trace) ? snapshot.trace : path.resolve(ROOT, snapshot.trace);
  const timestamps = readJsonLines(tracePath)
    .map((event) => Date.parse(event.at))
    .filter(Number.isFinite);
  if (!timestamps.length) return 0;
  const timingPath = path.join(sourceDir, 'service-timings.jsonl');
  const ready = fs.existsSync(timingPath)
    ? readJsonLines(timingPath).find(
        (event) => event.event === 'server_ready' && Number.isFinite(Date.parse(event.timestamp)),
      )
    : null;
  const startedAt = ready ? Date.parse(ready.timestamp) - Number(ready.seconds || 0) * 1000 : Math.min(...timestamps);
  return Math.max(0, Math.max(...timestamps) - startedAt);
}

export function readArmBoundaryRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const provenance = sourcePlan.provenance || {};
  if (
    sourcePlan.id !== plan.id ||
    provenance.recovery !== true ||
    provenance.linkedRecoveryStudyId !== `${plan.id}-generation-recovery-v1` ||
    provenance.priorAttemptCount !== 1
  ) {
    throw new Error('arm-boundary recovery must start from the first linked generation recovery');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  const expectedAttempts = plan.max_exchanges * 2;
  if (
    stop.error !== 'loaded model does not exactly match the planned arm' ||
    stop.armsCompleted !== 1 ||
    stop.budget?.used !== expectedAttempts
  ) {
    throw new Error('arm-boundary recovery requires the preserved configured-model identity failure');
  }
  const runEvents = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const reserved = countInvestedRivalRunReservations(runEvents);
  if (reserved + provenance.priorAttemptCount !== stop.budget.used) {
    throw new Error('arm-boundary recovery accounting differs from the preserved predecessor');
  }
  for (const forbidden of [
    path.join(sourceDir, 'B'),
    path.join(sourceDir, 'arms.json'),
    path.join(sourceDir, 'evaluation'),
    path.join(sourceDir, 'completed.json'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('arm-boundary recovery source contains downstream output');
  }
  const arm = plan.arms[0];
  const snapshotPath = path.join(sourceDir, arm.id, 'dialogue.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  if (snapshot.turns?.length !== plan.max_exchanges) {
    throw new Error('arm-boundary recovery requires the complete first arm');
  }
  const priorArm = readBenchmarkArm({
    ...arm,
    path: snapshotPath,
    wallTimeMs: recoveredArmElapsedMs(snapshot, sourceDir),
  });
  return {
    sourceDir,
    sourcePlan,
    stop,
    failure: { error: stop.error, boundary: 'before_arm_B_dispatch' },
    priorArms: [priorArm],
  };
}

export function armBoundaryRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  if (
    !Number.isInteger(priorAttemptCount) ||
    priorAttemptCount < 1 ||
    priorAttemptCount >= plan.total_attempt_ceiling
  ) {
    throw new Error('arm-boundary recovery requires a positive preserved attempt count below the study ceiling');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v2`,
    spendCap: plan.total_attempt_ceiling - priorAttemptCount,
    priorAttemptCount,
  };
}

export function readLocalModelRouteRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const provenance = sourcePlan.provenance || {};
  if (
    sourcePlan.id !== plan.id ||
    provenance.recovery !== true ||
    provenance.linkedRecoveryStudyId !== `${plan.id}-generation-recovery-v2` ||
    provenance.priorAttemptCount !== 16 ||
    provenance.reusedCompletedArms?.join(',') !== 'A'
  ) {
    throw new Error('local-route recovery must start from the second linked generation recovery');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  if (stop.error !== 'Qwen HTTP 400' || stop.armsCompleted !== 1 || stop.budget?.used !== 17) {
    throw new Error('local-route recovery requires the preserved first abliterated request failure');
  }
  const runEvents = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const reserved = countInvestedRivalRunReservations(runEvents);
  if (reserved !== 1 || reserved + provenance.priorAttemptCount !== stop.budget.used) {
    throw new Error('local-route recovery accounting differs from the preserved predecessor');
  }
  const armStop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'B', 'stopped.json'), 'utf8'));
  const traceEvents = readJsonLines(path.join(sourceDir, 'B', 'trace.jsonl'));
  const transport = traceEvents.find((event) => event.type === 'provider_event')?.event;
  const request = JSON.parse(fs.readFileSync(path.join(sourceDir, 'B', '1-learner.request.json'), 'utf8'));
  const expectedRequest = buildContinuityRequest({
    plan,
    speaker: 'learner',
    turn: 1,
    history: [{ role: 'assistant', content: plan.world.opening_frame.authored_text }],
  });
  if (
    armStop.error !== 'Qwen HTTP 400' ||
    armStop.turns?.length !== 0 ||
    armStop.partialTurn?.turn !== 1 ||
    transport?.status !== 400 ||
    !/Repository Not Found[\s\S]*Qwen3\.8-27B-Uncensored-MLX\/4-bit/iu.test(String(transport.body || '')) ||
    request.systemPrompt !== expectedRequest.systemPrompt ||
    request.prompt !== expectedRequest.prompt ||
    JSON.stringify(request.messageHistory) !== JSON.stringify(expectedRequest.messageHistory)
  ) {
    throw new Error('local-route recovery requires the saved repository-lookup transport failure');
  }
  for (const forbidden of [
    path.join(sourceDir, 'B', '1-learner.response.json'),
    path.join(sourceDir, 'B', 'dialogue.json'),
    path.join(sourceDir, 'arms.json'),
    path.join(sourceDir, 'evaluation'),
    path.join(sourceDir, 'completed.json'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('local-route recovery source contains downstream output');
  }
  const prior = readArmBoundaryRecovery(plan, provenance.recoverySource);
  return {
    sourceDir,
    sourcePlan,
    stop,
    failure: {
      error: stop.error,
      boundary: 'first_arm_B_learner_request',
      transport: { status: transport.status, body: transport.body },
    },
    priorArms: prior.priorArms,
  };
}

export function localModelRouteRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  if (
    !Number.isInteger(priorAttemptCount) ||
    priorAttemptCount < 1 ||
    priorAttemptCount >= plan.total_attempt_ceiling
  ) {
    throw new Error('local-route recovery requires a positive preserved attempt count below the study ceiling');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v3`,
    spendCap: plan.total_attempt_ceiling - priorAttemptCount,
    priorAttemptCount,
  };
}

function readPriorScores(sourceDir, arms) {
  const evaluationDir = path.join(sourceDir, 'evaluation');
  const rows = [];
  for (const arm of arms) {
    for (const kind of ['tutor', 'learner', 'dialogue', 'quality']) {
      const file = path.join(evaluationDir, `${arm.id}-${kind}.json`);
      if (!fs.existsSync(file)) continue;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      rows.push({ arm: arm.id, kind, raw, scored: normalizeScores(kind, raw) });
    }
  }
  return rows;
}

export function technicalRecoveryEligible(sourceDir) {
  const ledger = path.join(sourceDir, 'evaluation', 'judge-ledger.jsonl');
  const events = fs
    .readFileSync(ledger, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const failures = events.filter((event) => event.event === 'failed');
  if (failures.length !== 1) throw new Error('assessment recovery requires exactly one failed packet');
  const failure = failures[0];
  const base = path.join(sourceDir, 'evaluation', `${failure.arm}-${failure.kind}`);
  const response = fs.existsSync(`${base}.response.txt`) ? fs.readFileSync(`${base}.response.txt`, 'utf8') : '';
  const error = JSON.parse(fs.readFileSync(`${base}.error.json`, 'utf8'));
  const responseFreeStructuredFailure =
    error.code === 'CLI_PROVIDER_RESPONSE_FREE_ERROR' &&
    error.classification === 'response_free_error' &&
    error.reason === 'result_error_without_structured_output';
  const technical =
    responseFreeStructuredFailure ||
    /empty|transport|timeout|timed out|network|ECONN|exit code|temporarily unavailable/iu.test(
      [error.message, error.code, error.classification, error.reason].filter(Boolean).join(' '),
    );
  if (response.trim() || !technical) {
    throw new Error('nonempty or substantive assessment failure is not eligible for recovery');
  }
  return {
    priorAttempts: events.filter((event) => event.event === 'reserved').length,
    failure: { arm: failure.arm, kind: failure.kind, error },
  };
}

function readAssessmentRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  if (sourcePlan.id !== plan.id || sourcePlan.provenance?.recovery) {
    throw new Error('assessment recovery must start from the original invested-rival run');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  const arms = JSON.parse(fs.readFileSync(path.join(sourceDir, 'arms.json'), 'utf8'));
  if (arms.length !== 2 || stop.armsCompleted !== 2) {
    throw new Error('generation failure is not eligible for replacement recovery');
  }
  const eligibility = technicalRecoveryEligible(sourceDir);
  const priorScores = readPriorScores(sourceDir, arms);
  return { sourcePlan, stop, arms, eligibility, priorScores };
}

export function readLinkedAssessmentRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const provenance = sourcePlan.provenance || {};
  if (
    sourcePlan.id !== plan.id ||
    provenance.recovery !== true ||
    provenance.linkedRecoveryStudyId !== `${plan.id}-generation-recovery-v3` ||
    provenance.linkedRecoveryAttemptCeiling !== 31 ||
    provenance.priorAttemptCount !== 17
  ) {
    throw new Error('linked assessment recovery must start from the local-route generation recovery');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  const arms = JSON.parse(fs.readFileSync(path.join(sourceDir, 'arms.json'), 'utf8'));
  if (
    stop.armsCompleted !== 2 ||
    stop.budget?.used !== 37 ||
    stop.budget?.limit !== plan.total_attempt_ceiling ||
    arms.map((arm) => arm.id).join(',') !== 'A,B' ||
    arms.some((arm) => arm.snapshot?.turns?.length !== plan.max_exchanges)
  ) {
    throw new Error('linked assessment recovery requires both preserved eight-exchange arms at 37/48 attempts');
  }
  const runEvents = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const runReserved = countInvestedRivalRunReservations(runEvents);
  const runSeal = runEvents.findLast((event) => event.type === 'run_sealed');
  if (
    runReserved !== 20 ||
    provenance.priorAttemptCount + runReserved !== stop.budget.used ||
    runSeal?.status !== 'failed' ||
    runSeal?.reserved_attempts !== runReserved
  ) {
    throw new Error('linked assessment recovery accounting differs from the preserved predecessor');
  }
  const eligibility = technicalRecoveryEligible(sourceDir);
  const judgeEvents = readJsonLines(path.join(sourceDir, 'evaluation', 'judge-ledger.jsonl'));
  const completed = judgeEvents.filter((event) => event.event === 'completed');
  if (
    eligibility.priorAttempts !== 4 ||
    eligibility.failure.arm !== 'A' ||
    eligibility.failure.kind !== 'quality' ||
    completed.map((event) => `${event.arm}/${event.kind}`).join(',') !== 'A/tutor,A/learner,A/dialogue'
  ) {
    throw new Error('linked assessment recovery requires three accepted A assessments and one failed A quality packet');
  }
  const expectedJob = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: publicSourceContexts(plan, arms),
  }).find((job) => job.arm === eligibility.failure.arm && job.kind === eligibility.failure.kind);
  const failedBase = path.join(sourceDir, 'evaluation', `${eligibility.failure.arm}-${eligibility.failure.kind}`);
  if (
    fs.readFileSync(`${failedBase}.prompt.txt`, 'utf8') !== expectedJob.prompt ||
    JSON.stringify(JSON.parse(fs.readFileSync(`${failedBase}.schema.json`, 'utf8'))) !==
      JSON.stringify(expectedJob.outputSchema)
  ) {
    throw new Error('linked assessment recovery packet differs from the current transcript and rubric');
  }
  for (const forbidden of [
    path.join(sourceDir, 'completed.json'),
    path.join(sourceDir, 'report-data.json'),
    path.join(sourceDir, 'report.html'),
    path.join(sourceDir, 'evaluation', 'scores.json'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('linked assessment recovery source contains completed output');
  }
  const priorScores = readPriorScores(sourceDir, arms);
  if (priorScores.map((score) => `${score.arm}/${score.kind}`).join(',') !== 'A/tutor,A/learner,A/dialogue') {
    throw new Error('linked assessment recovery accepted-score set differs from the judge ledger');
  }
  return { sourcePlan, stop, arms, eligibility, priorScores, linked: true };
}

export function linkedAssessmentRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  if (
    !Number.isInteger(priorAttemptCount) ||
    priorAttemptCount < 1 ||
    priorAttemptCount >= plan.total_attempt_ceiling
  ) {
    throw new Error('linked assessment recovery requires preserved attempts below the study ceiling');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v4`,
    spendCap: plan.total_attempt_ceiling - priorAttemptCount,
    priorAttemptCount,
  };
}

export function readQualityJsonTransportRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const provenance = sourcePlan.provenance || {};
  if (
    sourcePlan.id !== plan.id ||
    provenance.recovery !== true ||
    provenance.linkedRecoveryStudyId !== `${plan.id}-generation-recovery-v4` ||
    provenance.linkedRecoveryAttemptCeiling !== 11 ||
    provenance.priorAttemptCount !== 37 ||
    provenance.reusedCompletedAssessments?.join(',') !== 'A/tutor,A/learner,A/dialogue'
  ) {
    throw new Error('quality transport recovery must start from the linked assessment recovery');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  const arms = JSON.parse(fs.readFileSync(path.join(sourceDir, 'arms.json'), 'utf8'));
  if (
    stop.budget?.used !== 38 ||
    stop.budget?.limit !== plan.total_attempt_ceiling ||
    arms.map((arm) => arm.id).join(',') !== 'A,B' ||
    arms.some((arm) => arm.snapshot?.turns?.length !== plan.max_exchanges)
  ) {
    throw new Error('quality transport recovery requires both preserved arms at 38/48 attempts');
  }
  const runEvents = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const runReserved = countInvestedRivalRunReservations(runEvents);
  const runSeal = runEvents.findLast((event) => event.type === 'run_sealed');
  if (
    runReserved !== 1 ||
    provenance.priorAttemptCount + runReserved !== stop.budget.used ||
    runSeal?.status !== 'failed' ||
    runSeal?.reserved_attempts !== runReserved
  ) {
    throw new Error('quality transport recovery accounting differs from the preserved predecessor');
  }
  const latestEligibility = technicalRecoveryEligible(sourceDir);
  if (
    latestEligibility.priorAttempts !== 1 ||
    latestEligibility.failure.arm !== 'A' ||
    latestEligibility.failure.kind !== 'quality'
  ) {
    throw new Error('quality transport recovery requires the repeated A quality structured-output failure');
  }
  const prior = readLinkedAssessmentRecovery(plan, provenance.recoverySource);
  if (JSON.stringify(arms) !== JSON.stringify(prior.arms)) {
    throw new Error('quality transport recovery arm archive differs from the preserved predecessor');
  }
  const expectedJob = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: publicSourceContexts(plan, arms),
  }).find((job) => job.arm === 'A' && job.kind === 'quality');
  const failedBase = path.join(sourceDir, 'evaluation', 'A-quality');
  const priorFailedBase = path.join(provenance.recoverySource, 'evaluation', 'A-quality');
  if (
    fs.readFileSync(`${failedBase}.prompt.txt`, 'utf8') !== expectedJob.prompt ||
    fs.readFileSync(`${failedBase}.prompt.txt`, 'utf8') !== fs.readFileSync(`${priorFailedBase}.prompt.txt`, 'utf8') ||
    JSON.stringify(JSON.parse(fs.readFileSync(`${failedBase}.schema.json`, 'utf8'))) !==
      JSON.stringify(expectedJob.outputSchema) ||
    JSON.stringify(JSON.parse(fs.readFileSync(`${failedBase}.schema.json`, 'utf8'))) !==
      JSON.stringify(JSON.parse(fs.readFileSync(`${priorFailedBase}.schema.json`, 'utf8')))
  ) {
    throw new Error('quality transport recovery packet differs from the repeated failed packet');
  }
  for (const forbidden of [
    path.join(sourceDir, 'completed.json'),
    path.join(sourceDir, 'report-data.json'),
    path.join(sourceDir, 'report.html'),
    path.join(sourceDir, 'evaluation', 'scores.json'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('quality transport recovery source contains completed output');
  }
  return {
    sourcePlan,
    stop,
    arms,
    eligibility: {
      priorAttempts: prior.eligibility.priorAttempts + latestEligibility.priorAttempts,
      failure: latestEligibility.failure,
    },
    priorScores: prior.priorScores,
    linked: true,
    plainJsonQuality: true,
  };
}

export function qualityJsonTransportRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  if (
    !Number.isInteger(priorAttemptCount) ||
    priorAttemptCount < 1 ||
    priorAttemptCount >= plan.total_attempt_ceiling
  ) {
    throw new Error('quality transport recovery requires preserved attempts below the study ceiling');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v5`,
    spendCap: plan.total_attempt_ceiling - priorAttemptCount,
    priorAttemptCount,
  };
}

function readInvalidPlainJsonQualityAttempt(sourceDir, packet = 'A-quality') {
  const base = path.join(sourceDir, 'evaluation', packet);
  const error = JSON.parse(fs.readFileSync(`${base}.error.json`, 'utf8'));
  if (
    error.code !== 'CLI_PROVIDER_AMBIGUOUS_OUTPUT' ||
    error.classification !== 'indeterminate' ||
    error.reason !== 'invalid_json_result_text'
  ) {
    throw new Error('quality split recovery requires the preserved invalid JSON result failure');
  }
  const transport = JSON.parse(fs.readFileSync(`${base}.transport.json`, 'utf8'));
  const events = JSON.parse(transport.stdout);
  const initial = events.find((event) => event.type === 'system' && event.subtype === 'init');
  const results = events.filter((event) => event.type === 'result');
  const result = results[0];
  if (
    transport.exitCode !== 0 ||
    !Array.isArray(initial?.tools) ||
    initial.tools.length !== 0 ||
    results.length !== 1 ||
    result.is_error !== false ||
    result.subtype !== 'success' ||
    result.num_turns !== 1 ||
    typeof result.result !== 'string' ||
    !result.result.trim()
  ) {
    throw new Error('quality split recovery requires one successful tool-free provider response');
  }
  try {
    JSON.parse(result.result);
  } catch {
    return { textLength: result.result.length, parseable: false };
  }
  throw new Error('quality split recovery source contains a complete JSON result');
}

export function readQualitySplitRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const provenance = sourcePlan.provenance || {};
  if (
    sourcePlan.id !== plan.id ||
    provenance.recovery !== true ||
    provenance.linkedRecoveryStudyId !== `${plan.id}-generation-recovery-v5` ||
    provenance.linkedRecoveryAttemptCeiling !== 10 ||
    provenance.priorAttemptCount !== 38 ||
    provenance.reusedCompletedAssessments?.join(',') !== 'A/tutor,A/learner,A/dialogue'
  ) {
    throw new Error('quality split recovery must start from the plain JSON quality recovery');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  const arms = JSON.parse(fs.readFileSync(path.join(sourceDir, 'arms.json'), 'utf8'));
  if (
    stop.budget?.used !== 39 ||
    stop.budget?.limit !== plan.total_attempt_ceiling ||
    arms.map((arm) => arm.id).join(',') !== 'A,B' ||
    arms.some((arm) => arm.snapshot?.turns?.length !== plan.max_exchanges)
  ) {
    throw new Error('quality split recovery requires both preserved arms at 39/48 attempts');
  }
  const runEvents = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const runReserved = countInvestedRivalRunReservations(runEvents);
  const runSeal = runEvents.findLast((event) => event.type === 'run_sealed');
  if (
    runReserved !== 1 ||
    provenance.priorAttemptCount + runReserved !== stop.budget.used ||
    runSeal?.status !== 'failed' ||
    runSeal?.reserved_attempts !== runReserved
  ) {
    throw new Error('quality split recovery accounting differs from the preserved predecessor');
  }
  const judgeEvents = readJsonLines(path.join(sourceDir, 'evaluation', 'judge-ledger.jsonl'));
  if (
    judgeEvents.filter((event) => event.event === 'reserved').length !== 1 ||
    judgeEvents.filter((event) => event.event === 'failed').length !== 1 ||
    judgeEvents.find((event) => event.event === 'failed')?.arm !== 'A' ||
    judgeEvents.find((event) => event.event === 'failed')?.kind !== 'quality'
  ) {
    throw new Error('quality split recovery requires exactly the failed A quality packet');
  }
  const failedTransport = readInvalidPlainJsonQualityAttempt(sourceDir);
  const prior = readQualityJsonTransportRecovery(plan, provenance.recoverySource);
  if (JSON.stringify(arms) !== JSON.stringify(prior.arms)) {
    throw new Error('quality split recovery arm archive differs from the preserved predecessor');
  }
  const expectedJob = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: publicSourceContexts(plan, arms),
  }).find((job) => job.arm === 'A' && job.kind === 'quality');
  const failedBase = path.join(sourceDir, 'evaluation', 'A-quality');
  if (
    fs.readFileSync(`${failedBase}.prompt.txt`, 'utf8') !== expectedJob.prompt ||
    JSON.stringify(JSON.parse(fs.readFileSync(`${failedBase}.schema.json`, 'utf8'))) !==
      JSON.stringify(expectedJob.outputSchema)
  ) {
    throw new Error('quality split recovery source packet differs from the registered assessment');
  }
  for (const forbidden of [
    path.join(sourceDir, 'completed.json'),
    path.join(sourceDir, 'report-data.json'),
    path.join(sourceDir, 'report.html'),
    path.join(sourceDir, 'evaluation', 'scores.json'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('quality split recovery source contains completed output');
  }
  return {
    sourcePlan,
    stop,
    arms,
    eligibility: {
      priorAttempts: prior.eligibility.priorAttempts + 1,
      failure: {
        arm: 'A',
        kind: 'quality',
        error: JSON.parse(fs.readFileSync(`${failedBase}.error.json`, 'utf8')),
      },
    },
    priorScores: prior.priorScores,
    linked: true,
    plainJsonQuality: true,
    splitQuality: true,
    failedTransport,
  };
}

export function qualitySplitRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  const spendCap = plan.total_attempt_ceiling - priorAttemptCount;
  if (priorAttemptCount !== 39 || spendCap !== 9) {
    throw new Error('quality split recovery requires exactly nine remaining study attempts');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v6`,
    spendCap,
    priorAttemptCount,
  };
}

export function readQualitySplitStructuredRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const provenance = sourcePlan.provenance || {};
  if (
    sourcePlan.id !== plan.id ||
    provenance.recovery !== true ||
    provenance.linkedRecoveryStudyId !== `${plan.id}-generation-recovery-v6` ||
    provenance.linkedRecoveryAttemptCeiling !== 9 ||
    provenance.priorAttemptCount !== 39 ||
    provenance.reusedCompletedAssessments?.join(',') !== 'A/tutor,A/learner,A/dialogue'
  ) {
    throw new Error('structured split-quality recovery must start from the split plain-JSON recovery');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  const arms = JSON.parse(fs.readFileSync(path.join(sourceDir, 'arms.json'), 'utf8'));
  if (
    stop.budget?.used !== 40 ||
    stop.budget?.limit !== plan.total_attempt_ceiling ||
    arms.map((arm) => arm.id).join(',') !== 'A,B' ||
    arms.some((arm) => arm.snapshot?.turns?.length !== plan.max_exchanges)
  ) {
    throw new Error('structured split-quality recovery requires both preserved arms at 40/48 attempts');
  }
  const runEvents = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const runReserved = countInvestedRivalRunReservations(runEvents);
  const runSeal = runEvents.findLast((event) => event.type === 'run_sealed');
  if (
    runReserved !== 1 ||
    provenance.priorAttemptCount + runReserved !== stop.budget.used ||
    runSeal?.status !== 'failed' ||
    runSeal?.reserved_attempts !== runReserved
  ) {
    throw new Error('structured split-quality recovery accounting differs from the preserved predecessor');
  }
  const judgeEvents = readJsonLines(path.join(sourceDir, 'evaluation', 'judge-ledger.jsonl'));
  if (
    judgeEvents.filter((event) => event.event === 'reserved').length !== 1 ||
    judgeEvents.filter((event) => event.event === 'failed').length !== 1 ||
    judgeEvents.find((event) => event.event === 'failed')?.arm !== 'A' ||
    judgeEvents.find((event) => event.event === 'failed')?.kind !== 'quality-summary'
  ) {
    throw new Error('structured split-quality recovery requires exactly the failed A quality-summary packet');
  }
  const failedTransport = readInvalidPlainJsonQualityAttempt(sourceDir, 'A-quality-summary');
  const prior = readQualitySplitRecovery(plan, provenance.recoverySource);
  if (JSON.stringify(arms) !== JSON.stringify(prior.arms)) {
    throw new Error('structured split-quality recovery arm archive differs from the preserved predecessor');
  }
  const expectedJob = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: publicSourceContexts(plan, arms),
    splitQuality: true,
  }).find((job) => job.arm === 'A' && job.kind === 'quality-summary');
  const failedBase = path.join(sourceDir, 'evaluation', 'A-quality-summary');
  if (
    fs.readFileSync(`${failedBase}.prompt.txt`, 'utf8') !== expectedJob.prompt ||
    JSON.stringify(JSON.parse(fs.readFileSync(`${failedBase}.schema.json`, 'utf8'))) !==
      JSON.stringify(expectedJob.outputSchema)
  ) {
    throw new Error('structured split-quality recovery source packet differs from the registered split assessment');
  }
  for (const forbidden of [
    path.join(sourceDir, 'completed.json'),
    path.join(sourceDir, 'report-data.json'),
    path.join(sourceDir, 'report.html'),
    path.join(sourceDir, 'evaluation', 'scores.json'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('structured split-quality recovery source contains completed output');
  }
  return {
    sourcePlan,
    stop,
    arms,
    eligibility: {
      priorAttempts: prior.eligibility.priorAttempts + 1,
      failure: {
        arm: 'A',
        kind: 'quality-summary',
        error: JSON.parse(fs.readFileSync(`${failedBase}.error.json`, 'utf8')),
      },
    },
    priorScores: prior.priorScores,
    linked: true,
    plainJsonQuality: false,
    splitQuality: true,
    structuredSplitQuality: true,
    failedTransport,
  };
}

export function qualitySplitStructuredRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  const spendCap = plan.total_attempt_ceiling - priorAttemptCount;
  if (priorAttemptCount !== 40 || spendCap !== 8) {
    throw new Error('structured split-quality recovery requires exactly eight remaining study attempts');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v7`,
    spendCap,
    priorAttemptCount,
  };
}

function readStructuredAdditionalPropertyFailure(sourceDir, packet, expectedUnexpectedProperties) {
  const base = path.join(sourceDir, 'evaluation', packet);
  const error = JSON.parse(fs.readFileSync(`${base}.error.json`, 'utf8'));
  if (
    error.code !== 'CLI_PROVIDER_RESPONSE_FREE_ERROR' ||
    error.classification !== 'response_free_error' ||
    error.reason !== 'result_error_without_structured_output' ||
    fs.existsSync(`${base}.response.txt`)
  ) {
    throw new Error('final quality recovery requires the preserved response-free structured-output failure');
  }
  const transport = JSON.parse(fs.readFileSync(`${base}.transport.json`, 'utf8'));
  const events = JSON.parse(transport.stdout);
  const toolUses = events.flatMap((event) =>
    (event.message?.content || []).filter((content) => content.type === 'tool_use'),
  );
  const toolErrors = events.flatMap((event) =>
    (event.message?.content || []).filter((content) => content.type === 'tool_result' && content.is_error === true),
  );
  const result = events.findLast((event) => event.type === 'result');
  const outputSchema = JSON.parse(fs.readFileSync(`${base}.schema.json`, 'utf8'));
  const registeredProperties = Object.keys(outputSchema.properties || {});
  const unexpectedProperties = toolUses
    .flatMap((toolUse) => Object.keys(toolUse.input || {}))
    .filter((key) => !registeredProperties.includes(key))
    .sort();
  if (
    transport.exitCode !== 1 ||
    toolUses.length !== 1 ||
    toolUses[0].name !== 'StructuredOutput' ||
    unexpectedProperties.join(',') !== [...expectedUnexpectedProperties].sort().join(',') ||
    toolErrors.length !== 1 ||
    !/must NOT have additional properties/u.test(String(toolErrors[0].content || '')) ||
    result?.subtype !== 'error_max_structured_output_retries' ||
    result?.is_error !== true
  ) {
    throw new Error('final quality recovery requires the preserved additional-property tool rejection');
  }
  return { unexpectedProperties, resultSubtype: result.subtype };
}

export function readFinalQualityRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const provenance = sourcePlan.provenance || {};
  if (
    sourcePlan.id !== plan.id ||
    provenance.recovery !== true ||
    provenance.linkedRecoveryStudyId !== `${plan.id}-generation-recovery-v7` ||
    provenance.linkedRecoveryAttemptCeiling !== 8 ||
    provenance.priorAttemptCount !== 40 ||
    provenance.reusedCompletedAssessments?.join(',') !== 'A/tutor,A/learner,A/dialogue'
  ) {
    throw new Error('final quality recovery must start from the structured split-quality recovery');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  const arms = JSON.parse(fs.readFileSync(path.join(sourceDir, 'arms.json'), 'utf8'));
  if (
    stop.budget?.used !== 46 ||
    stop.budget?.limit !== plan.total_attempt_ceiling ||
    arms.map((arm) => arm.id).join(',') !== 'A,B' ||
    arms.some((arm) => arm.snapshot?.turns?.length !== plan.max_exchanges)
  ) {
    throw new Error('final quality recovery requires both preserved arms at 46/48 attempts');
  }
  const runEvents = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const runReserved = countInvestedRivalRunReservations(runEvents);
  const runSeal = runEvents.findLast((event) => event.type === 'run_sealed');
  if (
    runReserved !== 6 ||
    provenance.priorAttemptCount + runReserved !== stop.budget.used ||
    runSeal?.status !== 'failed' ||
    runSeal?.reserved_attempts !== runReserved
  ) {
    throw new Error('final quality recovery accounting differs from the preserved predecessor');
  }
  const latestEligibility = technicalRecoveryEligible(sourceDir);
  const judgeEvents = readJsonLines(path.join(sourceDir, 'evaluation', 'judge-ledger.jsonl'));
  const completedKeys = judgeEvents
    .filter((event) => event.event === 'completed')
    .map((event) => `${event.arm}/${event.kind}`);
  if (
    latestEligibility.priorAttempts !== 6 ||
    latestEligibility.failure.arm !== 'B' ||
    latestEligibility.failure.kind !== 'quality-summary' ||
    completedKeys.join(',') !== 'A/quality-summary,A/quality-turns,B/tutor,B/learner,B/dialogue'
  ) {
    throw new Error('final quality recovery requires seven accepted assessments and the failed B quality summary');
  }
  const failedTransport = readStructuredAdditionalPropertyFailure(sourceDir, 'B-quality-summary', ['reasoning_effort']);
  const prior = readQualitySplitStructuredRecovery(plan, provenance.recoverySource);
  if (JSON.stringify(arms) !== JSON.stringify(prior.arms)) {
    throw new Error('final quality recovery arm archive differs from the preserved predecessor');
  }
  const expectedJob = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: publicSourceContexts(plan, arms),
    splitQuality: true,
  }).find((job) => job.arm === 'B' && job.kind === 'quality-summary');
  const failedBase = path.join(sourceDir, 'evaluation', 'B-quality-summary');
  if (
    fs.readFileSync(`${failedBase}.prompt.txt`, 'utf8') !== expectedJob.prompt ||
    JSON.stringify(JSON.parse(fs.readFileSync(`${failedBase}.schema.json`, 'utf8'))) !==
      JSON.stringify(expectedJob.outputSchema) ||
    fs.existsSync(path.join(sourceDir, 'evaluation', 'B-quality-turns.prompt.txt'))
  ) {
    throw new Error('final quality recovery packet sequence differs from the registered split assessment');
  }
  for (const forbidden of [
    path.join(sourceDir, 'completed.json'),
    path.join(sourceDir, 'report-data.json'),
    path.join(sourceDir, 'report.html'),
    path.join(sourceDir, 'evaluation', 'scores.json'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('final quality recovery source contains completed output');
  }
  const latestScores = readPriorScores(sourceDir, arms);
  const priorScores = [...prior.priorScores, ...latestScores];
  if (
    priorScores.map((score) => `${score.arm}/${score.kind}`).join(',') !==
    'A/tutor,A/learner,A/dialogue,A/quality,B/tutor,B/learner,B/dialogue'
  ) {
    throw new Error('final quality recovery accepted-score set differs from the preserved judge ledger');
  }
  return {
    sourcePlan,
    stop,
    arms,
    eligibility: {
      priorAttempts: prior.eligibility.priorAttempts + latestEligibility.priorAttempts,
      failure: latestEligibility.failure,
    },
    priorScores,
    linked: true,
    plainJsonQuality: false,
    splitQuality: true,
    finalQualityRecovery: true,
    failedTransport,
  };
}

export function finalQualityRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  const spendCap = plan.total_attempt_ceiling - priorAttemptCount;
  if (priorAttemptCount !== 46 || spendCap !== 2) {
    throw new Error('final quality recovery requires exactly two remaining study attempts');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v8`,
    spendCap,
    priorAttemptCount,
  };
}

export function readFinalCompletionRecovery(plan, sourceDir) {
  const sourcePlan = JSON.parse(fs.readFileSync(path.join(sourceDir, 'plan.json'), 'utf8'));
  const provenance = sourcePlan.provenance || {};
  if (
    sourcePlan.id !== plan.id ||
    provenance.recovery !== true ||
    provenance.linkedRecoveryStudyId !== `${plan.id}-generation-recovery-v8` ||
    provenance.linkedRecoveryAttemptCeiling !== 2 ||
    provenance.priorAttemptCount !== 46 ||
    provenance.reusedCompletedAssessments?.join(',') !==
      'A/tutor,A/learner,A/dialogue,A/quality,B/tutor,B/learner,B/dialogue'
  ) {
    throw new Error('final completion recovery must start from the terminal quality recovery');
  }
  const stop = JSON.parse(fs.readFileSync(path.join(sourceDir, 'stopped.json'), 'utf8'));
  const arms = JSON.parse(fs.readFileSync(path.join(sourceDir, 'arms.json'), 'utf8'));
  if (
    stop.budget?.used !== 48 ||
    stop.budget?.limit !== plan.total_attempt_ceiling ||
    arms.map((arm) => arm.id).join(',') !== 'A,B' ||
    arms.some((arm) => arm.snapshot?.turns?.length !== plan.max_exchanges)
  ) {
    throw new Error('final completion recovery requires both preserved arms at the original 48-attempt ceiling');
  }
  const runEvents = readJsonLines(path.join(sourceDir, 'run-ledger.jsonl'));
  const runReserved = countInvestedRivalRunReservations(runEvents);
  const runSeal = runEvents.findLast((event) => event.type === 'run_sealed');
  if (
    runReserved !== 2 ||
    provenance.priorAttemptCount + runReserved !== stop.budget.used ||
    runSeal?.status !== 'failed' ||
    runSeal?.reserved_attempts !== runReserved
  ) {
    throw new Error('final completion recovery accounting differs from the preserved predecessor');
  }
  const judgeEvents = readJsonLines(path.join(sourceDir, 'evaluation', 'judge-ledger.jsonl'));
  const eventKeys = judgeEvents.map((event) => `${event.event}/${event.arm}/${event.kind}`);
  if (
    eventKeys.join(',') !==
    'reserved/B/quality-summary,completed/B/quality-summary,reserved/B/quality-turns,failed/B/quality-turns'
  ) {
    throw new Error('final completion recovery requires the accepted B summary followed by the failed B turns packet');
  }
  const failedTransport = readStructuredAdditionalPropertyFailure(sourceDir, 'B-quality-turns', ['turns']);
  const prior = readFinalQualityRecovery(plan, provenance.recoverySource);
  if (JSON.stringify(arms) !== JSON.stringify(prior.arms)) {
    throw new Error('final completion recovery arm archive differs from the preserved predecessor');
  }
  const jobs = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: publicSourceContexts(plan, arms),
    splitQuality: true,
  });
  const summaryJob = jobs.find((job) => job.arm === 'B' && job.kind === 'quality-summary');
  const turnsJob = jobs.find((job) => job.arm === 'B' && job.kind === 'quality-turns');
  const summaryBase = path.join(sourceDir, 'evaluation', 'B-quality-summary');
  const turnsBase = path.join(sourceDir, 'evaluation', 'B-quality-turns');
  if (
    fs.readFileSync(`${summaryBase}.prompt.txt`, 'utf8') !== summaryJob.prompt ||
    JSON.stringify(JSON.parse(fs.readFileSync(`${summaryBase}.schema.json`, 'utf8'))) !==
      JSON.stringify(summaryJob.outputSchema) ||
    fs.readFileSync(`${turnsBase}.prompt.txt`, 'utf8') !== turnsJob.prompt ||
    JSON.stringify(JSON.parse(fs.readFileSync(`${turnsBase}.schema.json`, 'utf8'))) !==
      JSON.stringify(turnsJob.outputSchema)
  ) {
    throw new Error('final completion recovery packets differ from the registered split assessment');
  }
  const summaryRaw = JSON.parse(fs.readFileSync(`${summaryBase}.json`, 'utf8'));
  parseSplitQualityScore('summary', JSON.stringify(summaryRaw), plan.max_exchanges, summaryJob.outputSchema);
  for (const forbidden of [
    `${turnsBase}.response.txt`,
    `${turnsBase}.json`,
    path.join(sourceDir, 'evaluation', 'B-quality.json'),
    path.join(sourceDir, 'completed.json'),
    path.join(sourceDir, 'report-data.json'),
    path.join(sourceDir, 'report.html'),
    path.join(sourceDir, 'evaluation', 'scores.json'),
  ]) {
    if (fs.existsSync(forbidden)) throw new Error('final completion recovery source contains completed output');
  }
  return {
    sourcePlan,
    stop,
    arms,
    eligibility: {
      priorAttempts: prior.eligibility.priorAttempts + 2,
      failure: {
        arm: 'B',
        kind: 'quality-turns',
        error: JSON.parse(fs.readFileSync(`${turnsBase}.error.json`, 'utf8')),
      },
    },
    priorScores: prior.priorScores,
    priorSplitQualityParts: [{ arm: 'B', part: 'summary', raw: summaryRaw }],
    linked: true,
    plainJsonQuality: false,
    splitQuality: true,
    finalCompletionRecovery: true,
    effectiveAttemptCeiling: plan.completion_attempt_ceiling,
    completionTechnicalAttemptLimit: plan.completion_recovery_attempt_ceiling,
    failedTransport,
  };
}

export function finalCompletionRecoveryContract(plan, recovery) {
  const priorAttemptCount = recovery?.stop?.budget?.used;
  const spendCap = plan.completion_attempt_ceiling - priorAttemptCount;
  if (
    priorAttemptCount !== 48 ||
    plan.completion_attempt_ceiling !== 50 ||
    plan.completion_recovery_attempt_ceiling !== 2 ||
    spendCap !== 2
  ) {
    throw new Error('final completion recovery requires exactly two bounded attempts beyond the original ceiling');
  }
  return {
    studyId: `${plan.id}-generation-recovery-v9`,
    spendCap,
    priorAttemptCount,
  };
}

async function recoverAssessments(plan, sourceDir, outDir, admission, recovery) {
  const { stop, arms, eligibility, priorScores } = recovery;
  const priorAttemptCount = recovery.linked ? stop.budget.used : 0;
  const effectiveAttemptCeiling = recovery.effectiveAttemptCeiling || plan.total_attempt_ceiling;
  let workflow;
  const budget = investedRivalPaidBudget(admission, effectiveAttemptCeiling, priorAttemptCount, null, {
    onAttemptStarted: (attempt) => workflow?.attemptStarted(attempt),
    onAttemptCompleted: (attempt) => workflow?.attemptCompleted(attempt),
    onAttemptFailed: (attempt) => workflow?.attemptFailed(attempt),
  });
  try {
    if (admission.studyReserved !== (recovery.linked ? 0 : stop.budget.used)) {
      throw new Error('study-wide attempt ledger differs from the preserved predecessor');
    }
    const provenance = sourceProvenance(plan, {
      commit: admission.source.commit,
      tree: admission.source.tree,
      dirty: false,
      detached: true,
      mainRef: admission.source.main_ref,
      mainCommit: admission.source.main_commit,
      authorization: admission.authorization,
      totalAttemptCeiling: effectiveAttemptCeiling,
      technicalRecoveryReserve:
        plan.recovery_attempt_reserve +
        (recovery.finalCompletionRecovery ? plan.completion_recovery_attempt_ceiling : 0),
      recovery: true,
      recoverySource: sourceDir,
      recoveredPacket: eligibility.failure,
      priorAttemptCount: stop.budget.used,
      ...(recovery.linked
        ? {
            linkedRecoveryStudyId: admission.study_id,
            linkedRecoveryAttemptCeiling: admission.spend_cap,
            reusedCompletedArms: arms.map((arm) => arm.id),
            reusedCompletedAssessments: priorScores.map((score) => `${score.arm}/${score.kind}`),
          }
        : {}),
    });
    writeJson(path.join(outDir, 'plan.json'), { ...plan, provenance });
    writeJson(path.join(outDir, 'arms.json'), arms);
    const assessmentUnits = recovery.splitQuality === true ? plan.judge_calls + arms.length : plan.judge_calls;
    const completedAssessmentPackets =
      priorScores.reduce(
        (sum, score) => sum + (score.kind === 'quality' && recovery.splitQuality === true ? 2 : 1),
        0,
      ) + (recovery.priorSplitQualityParts || []).length;
    const baselineCompletedCalls =
      arms.reduce((sum, arm) => sum + (arm.snapshot?.turns?.length || 0) * 2, 0) + completedAssessmentPackets;
    workflow = createInvestedRivalWorkflowTracker({
      plan,
      outDir,
      admission,
      recovery: true,
      priorAttemptBase: priorAttemptCount,
      completedArms: arms.length,
      completedAssessments: completedAssessmentPackets,
      assessmentUnits,
      baselineCompletedCalls,
      baselineFailedCalls: Math.max(0, stop.budget.used - baselineCompletedCalls),
      effectiveCeiling: effectiveAttemptCeiling,
      recoverySourceDir: sourceDir,
    });
    workflow.generationCompleted();
    const evaluation = await scoreArms({
      plan,
      arms,
      outDir,
      budget,
      priorScores,
      priorSplitQualityParts: recovery.priorSplitQualityParts || [],
      priorAttempts: eligibility.priorAttempts,
      ceiling:
        plan.judge_calls +
        plan.recovery_attempt_reserve +
        (recovery.finalCompletionRecovery ? plan.completion_recovery_attempt_ceiling : 0),
      plainJsonQuality: recovery.plainJsonQuality === true,
      splitQuality: recovery.splitQuality === true,
      completionRootProjection: recovery.finalCompletionRecovery === true,
      completionTechnicalAttemptLimit: recovery.completionTechnicalAttemptLimit || 1,
    });
    workflow.assessmentCompleted();
    const finalProvenance = { ...provenance, budget: budget.snapshot() };
    reportResult({ outDir, plan, arms, evaluation, provenance: finalProvenance });
    writeJson(path.join(outDir, 'completed.json'), {
      budget: budget.snapshot(),
      assessments: evaluation.scores.length,
      recovery: eligibility.failure,
    });
    admission.close({
      type: 'run_sealed',
      status: 'complete',
      completed_assessments: evaluation.scores.length,
      reserved_attempts: admission.reserved,
      recovery_from: sourceDir,
    });
    workflow.packagingCompleted();
    return { outDir, dryRun: false, recovery: true, attempts: budget.snapshot().used };
  } catch (error) {
    writeJson(path.join(outDir, 'stopped.json'), {
      error: error.message,
      budget: budget.snapshot(),
      recovery: eligibility.failure,
    });
    admission.close({
      type: 'run_sealed',
      status: 'failed',
      error: error.message,
      reserved_attempts: admission.reserved,
      recovery_from: sourceDir,
    });
    workflow?.blocked(error);
    throw error;
  }
}

function admitLiveRun(plan, values, outDir, recoveryFrom = null, contractOverride = {}) {
  if (!values['accept-charges'] || !values['launch-commit'] || !values['go-note-commit'] || !values['go-note-path']) {
    throw new Error('paid launch requires --accept-charges, --launch-commit, --go-note-commit, and --go-note-path');
  }
  return admitPaidStudyLaunch({
    root: ROOT,
    designPath: plan.design,
    launchCommit: values['launch-commit'],
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
    spendCap: contractOverride.spendCap || plan.total_attempt_ceiling,
    destination: outDir,
    studyId: contractOverride.studyId || plan.id,
    studyStateRoot: path.resolve(ROOT, values['study-state-root'] || '.tutor-stub-traces/.paid-study-state'),
    ...(recoveryFrom ? { recoveryFrom } : {}),
  });
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      live: { type: 'boolean', default: false },
      config: { type: 'string' },
      output: { type: 'string' },
      'recover-assessments': { type: 'boolean', default: false },
      'recover-generation': { type: 'boolean', default: false },
      'recover-arm-boundary': { type: 'boolean', default: false },
      'recover-local-model-route': { type: 'boolean', default: false },
      'recover-linked-assessments': { type: 'boolean', default: false },
      'recover-quality-json-transport': { type: 'boolean', default: false },
      'recover-quality-split': { type: 'boolean', default: false },
      'recover-quality-split-structured': { type: 'boolean', default: false },
      'recover-final-quality': { type: 'boolean', default: false },
      'recover-final-completion': { type: 'boolean', default: false },
      'recovery-from': { type: 'string' },
      from: { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      'launch-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      'study-state-root': { type: 'string' },
    },
  });
  const plan = buildInvestedRivalPlan(ROOT, values.config || DEFAULT_CONFIG);
  if (values['recovery-from']) {
    const legacyRecoverySelected = [
      'recover-assessments',
      'recover-generation',
      'recover-arm-boundary',
      'recover-local-model-route',
      'recover-linked-assessments',
      'recover-quality-json-transport',
      'recover-quality-split',
      'recover-quality-split-structured',
      'recover-final-quality',
      'recover-final-completion',
    ].some((key) => values[key]);
    if (!values.live || !values.output || values.from || legacyRecoverySelected) {
      throw new Error('--recovery-from requires --live and a fresh --output, without a historical recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values['recovery-from']);
    const outDir = path.resolve(ROOT, values.output);
    const recovery = readDurableInvestedRivalRecovery(plan, sourceDir);
    const admission = admitLiveRun(plan, values, outDir, sourceDir);
    admission.record({
      type: 'durable_missing_only_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recovery.stop.budget.used,
      reused_completed_arms: recovery.priorArms.map((arm) => arm.id),
      reused_partial_responses: Object.keys(recovery.partial?.savedReplies || {}).length,
      reused_completed_assessments: recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      response_free_attempts: recovery.responseFreeAttempts,
    });
    return runFresh(plan, outDir, admission, recovery);
  }
  if (values['recover-final-completion']) {
    if (
      !values.live ||
      !values.from ||
      values['recover-generation'] ||
      values['recover-arm-boundary'] ||
      values['recover-local-model-route'] ||
      values['recover-linked-assessments'] ||
      values['recover-quality-json-transport'] ||
      values['recover-quality-split'] ||
      values['recover-quality-split-structured'] ||
      values['recover-final-quality'] ||
      values['recover-assessments']
    ) {
      throw new Error('--recover-final-completion requires --live and --from, without another recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-final-completion-recovery-v1`);
    const recovery = readFinalCompletionRecovery(plan, sourceDir);
    const recoveryContract = finalCompletionRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'final_completion_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      reused_completed_arms: recovery.arms.map((arm) => arm.id),
      reused_completed_assessments: recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
      reused_completed_split_packets: recovery.priorSplitQualityParts.map(
        (packet) => `${packet.arm}/quality-${packet.part}`,
      ),
      aggregate_attempt_ceiling: plan.completion_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
      planned_recovery_packets: 1,
      maximum_physical_attempts: recovery.completionTechnicalAttemptLimit,
      provider_transport: 'required_registered_values_with_unknown_root_fields_allowed',
      local_acceptance: 'project_registered_root_fields_then_validate_unchanged_strict_schema',
      failed_extra_properties: recovery.failedTransport.unexpectedProperties,
      prior_rejected_output_reused: false,
      score_or_value_repair: false,
      valid_output_resampling: false,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'final completion recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('final completion recovery ledger was not empty at launch');
    }
    return recoverAssessments(plan, sourceDir, outDir, admission, recovery);
  }
  if (values['recover-final-quality']) {
    if (
      !values.live ||
      !values.from ||
      values['recover-generation'] ||
      values['recover-arm-boundary'] ||
      values['recover-local-model-route'] ||
      values['recover-linked-assessments'] ||
      values['recover-quality-json-transport'] ||
      values['recover-quality-split'] ||
      values['recover-quality-split-structured'] ||
      values['recover-assessments']
    ) {
      throw new Error('--recover-final-quality requires --live and --from, without another recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-final-quality-recovery-v1`);
    const recovery = readFinalQualityRecovery(plan, sourceDir);
    const recoveryContract = finalQualityRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'final_quality_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      reused_completed_arms: recovery.arms.map((arm) => arm.id),
      reused_completed_assessments: recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
      planned_recovery_attempts: 2,
      quality_transport: 'structured_output_schema_tool_per_split_packet',
      failed_extra_properties: recovery.failedTransport.unexpectedProperties,
      no_further_recovery: true,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'final quality recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('final quality recovery ledger was not empty at launch');
    }
    return recoverAssessments(plan, sourceDir, outDir, admission, recovery);
  }
  if (values['recover-quality-split-structured']) {
    if (
      !values.live ||
      !values.from ||
      values['recover-generation'] ||
      values['recover-arm-boundary'] ||
      values['recover-local-model-route'] ||
      values['recover-linked-assessments'] ||
      values['recover-quality-json-transport'] ||
      values['recover-quality-split'] ||
      values['recover-assessments']
    ) {
      throw new Error('--recover-quality-split-structured requires --live and --from, without another recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-quality-split-structured-recovery-v1`);
    const recovery = readQualitySplitStructuredRecovery(plan, sourceDir);
    const recoveryContract = qualitySplitStructuredRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'quality_split_structured_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      reused_completed_arms: recovery.arms.map((arm) => arm.id),
      reused_completed_assessments: recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
      planned_recovery_attempts: 7,
      quality_transport: 'structured_output_schema_tool_per_split_packet',
      failed_plain_json_length: recovery.failedTransport.textLength,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'structured split-quality recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('structured split-quality recovery ledger was not empty at launch');
    }
    return recoverAssessments(plan, sourceDir, outDir, admission, recovery);
  }
  if (values['recover-quality-split']) {
    if (
      !values.live ||
      !values.from ||
      values['recover-generation'] ||
      values['recover-arm-boundary'] ||
      values['recover-local-model-route'] ||
      values['recover-linked-assessments'] ||
      values['recover-quality-json-transport'] ||
      values['recover-assessments']
    ) {
      throw new Error('--recover-quality-split requires --live and --from, without another recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-quality-split-recovery-v1`);
    const recovery = readQualitySplitRecovery(plan, sourceDir);
    const recoveryContract = qualitySplitRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'quality_split_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      reused_completed_arms: recovery.arms.map((arm) => arm.id),
      reused_completed_assessments: recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
      planned_recovery_attempts: 7,
      quality_transport: 'two_plain_json_packets_local_schema_then_deterministic_merge',
      failed_plain_json_length: recovery.failedTransport.textLength,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'quality split recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('quality split recovery ledger was not empty at launch');
    }
    return recoverAssessments(plan, sourceDir, outDir, admission, recovery);
  }
  if (values['recover-quality-json-transport']) {
    if (
      !values.live ||
      !values.from ||
      values['recover-generation'] ||
      values['recover-arm-boundary'] ||
      values['recover-local-model-route'] ||
      values['recover-linked-assessments'] ||
      values['recover-quality-split'] ||
      values['recover-assessments']
    ) {
      throw new Error('--recover-quality-json-transport requires --live and --from, without another recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-quality-json-transport-recovery-v1`);
    const recovery = readQualityJsonTransportRecovery(plan, sourceDir);
    const recoveryContract = qualityJsonTransportRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'quality_json_transport_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      reused_completed_arms: recovery.arms.map((arm) => arm.id),
      reused_completed_assessments: recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
      quality_transport: 'single_json_result_text_local_schema',
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'quality transport recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('quality transport recovery ledger was not empty at launch');
    }
    return recoverAssessments(plan, sourceDir, outDir, admission, recovery);
  }
  if (values['recover-linked-assessments']) {
    if (
      !values.live ||
      !values.from ||
      values['recover-generation'] ||
      values['recover-arm-boundary'] ||
      values['recover-local-model-route'] ||
      values['recover-assessments']
    ) {
      throw new Error('--recover-linked-assessments requires --live and --from, without another recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-linked-assessment-recovery-v1`);
    const recovery = readLinkedAssessmentRecovery(plan, sourceDir);
    const recoveryContract = linkedAssessmentRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'linked_assessment_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      reused_completed_arms: recovery.arms.map((arm) => arm.id),
      reused_completed_assessments: recovery.priorScores.map((score) => `${score.arm}/${score.kind}`),
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'linked assessment recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('linked assessment recovery ledger was not empty at launch');
    }
    return recoverAssessments(plan, sourceDir, outDir, admission, recovery);
  }
  if (values['recover-local-model-route']) {
    if (
      !values.live ||
      !values.from ||
      values['recover-generation'] ||
      values['recover-arm-boundary'] ||
      values['recover-linked-assessments'] ||
      values['recover-assessments']
    ) {
      throw new Error('--recover-local-model-route requires --live and --from, without another recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-local-model-route-recovery-v1`);
    const recovery = readLocalModelRouteRecovery(plan, sourceDir);
    const recoveryContract = localModelRouteRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'linked_local_model_route_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      reused_completed_arms: recovery.priorArms.map((arm) => arm.id),
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'linked local-route recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('linked local-route recovery ledger was not empty at launch');
    }
    return runFresh(plan, outDir, admission, recovery);
  }
  if (values['recover-arm-boundary']) {
    if (
      !values.live ||
      !values.from ||
      values['recover-generation'] ||
      values['recover-local-model-route'] ||
      values['recover-linked-assessments'] ||
      values['recover-assessments']
    ) {
      throw new Error('--recover-arm-boundary requires --live and --from, without another recovery mode');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-arm-boundary-recovery-v1`);
    const recovery = readArmBoundaryRecovery(plan, sourceDir);
    const recoveryContract = armBoundaryRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'linked_arm_boundary_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      reused_completed_arms: recovery.priorArms.map((arm) => arm.id),
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'linked arm-boundary recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('linked arm-boundary recovery ledger was not empty at launch');
    }
    return runFresh(plan, outDir, admission, recovery);
  }
  if (values['recover-generation']) {
    if (!values.live || !values.from || values['recover-linked-assessments'] || values['recover-assessments']) {
      throw new Error('--recover-generation requires --live and --from, without --recover-assessments');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-generation-recovery-v1`);
    const recovery = readGenerationRecovery(plan, sourceDir);
    const recoveryContract = generationRecoveryContract(plan, recovery);
    const admission = admitLiveRun(plan, values, outDir, null, recoveryContract);
    admission.record({
      type: 'linked_generation_recovery',
      recovery_from: sourceDir,
      prior_attempts_preserved: recoveryContract.priorAttemptCount,
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
      recovery_attempt_ceiling: recoveryContract.spendCap,
    });
    if (admission.studyReserved !== 0) {
      admission.close({
        type: 'run_sealed',
        status: 'failed',
        error: 'linked recovery ledger was not empty at launch',
        recovery_from: sourceDir,
      });
      throw new Error('linked recovery ledger was not empty at launch');
    }
    return runFresh(plan, outDir, admission, recovery);
  }
  if (values['recover-assessments']) {
    if (!values.live || !values.from) {
      throw new Error('--recover-assessments requires --live and --from');
    }
    const sourceDir = path.resolve(ROOT, values.from);
    const outDir = path.resolve(ROOT, values.output || `${sourceDir}-assessment-recovery-v1`);
    const recovery = readAssessmentRecovery(plan, sourceDir);
    const admission = admitLiveRun(plan, values, outDir, sourceDir);
    return recoverAssessments(plan, sourceDir, outDir, admission, recovery);
  }
  const outDir = values.live
    ? path.resolve(ROOT, values.output || plan.output)
    : values.output
      ? path.resolve(ROOT, values.output)
      : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-invested-rival-')), 'dry-run');
  if (values.live) {
    const admission = admitLiveRun(plan, values, outDir);
    return runFresh(plan, outDir, admission);
  }
  fs.mkdirSync(outDir, { recursive: false });
  const provenance = sourceProvenance(plan, { recovery: false, modelCalls: 0, dryRun: true });
  const preparation = writePreparation(outDir, plan, provenance);
  return { outDir, dryRun: true, attempts: 0, ...preparation };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
