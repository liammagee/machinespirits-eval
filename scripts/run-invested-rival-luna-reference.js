#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

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
import {
  buildContinuityProofPlan,
  buildContinuityRequest,
  callContinuityModel,
  CONTINUITY_OUTPUT_SCHEMA,
  runContinuityArm,
} from '../services/localQwenRefusalContinuity.js';
import { renderContinuityReport } from '../services/localQwenRefusalContinuityReport.js';
import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import {
  assertCompleteScore,
  benchmarkOutputSchemaIssues,
  buildBenchmarkJobs,
  normalizeScores,
  parseBenchmarkScore,
  parseSplitQualityScore,
  readBenchmarkArm,
  scoreBenchmarkArms,
} from './score-local-qwen-resistant-learner-benchmark.js';
import {
  allowUnknownRootOutputFields,
  buildInvestedRivalPlan,
  investedRivalDeliveredSourceContext,
  projectRegisteredRootOutput,
} from './run-local-qwen-invested-rival.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = 'config/tutor-stub-local-learners/invested-rival-luna-reference.v1.yaml';
const LUNA_WORKFLOW_PHASES = Object.freeze(['PREFLIGHT', 'GENERATING', 'AUDITING', 'PACKAGING', 'WORKFLOW_COMPLETE']);
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

function readJson(file, label = path.basename(file)) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function readJsonLines(file, label = path.basename(file)) {
  try {
    return fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    throw new Error(`${label} is not valid JSONL: ${error.message}`);
  }
}

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

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function reportMeta(config) {
  return {
    ...Object.fromEntries(
      Object.entries(config.report).map(([key, value]) => [
        key.replace(/_([a-z])/gu, (_match, letter) => letter.toUpperCase()),
        value,
      ]),
    ),
    learnerFamilyLabel: 'learner',
    attemptScopeLabel: 'new paid attempts used',
    opusAttemptScopeLabel: 'new Opus attempts used',
  };
}

export function buildLunaReferencePlan(root = ROOT, configPath = DEFAULT_CONFIG) {
  const config = yaml.parse(fs.readFileSync(path.resolve(root, configPath), 'utf8'));
  const base = buildInvestedRivalPlan(root, config.source_config);
  if (
    config.id !== 'invested-rival-luna-reference-v1' ||
    config.total_attempt_ceiling !== 23 ||
    config.generation_attempt_ceiling !== 16 ||
    config.assessment_packets !== 5 ||
    config.response_free_recovery_reserve !== 2 ||
    config.generation_attempt_ceiling + config.assessment_packets + config.response_free_recovery_reserve !==
      config.total_attempt_ceiling
  ) {
    throw new Error('Luna reference attempt plan differs from the registered 23-attempt design');
  }
  if (
    config.models.learner !== 'codex.gpt-5.6-luna' ||
    config.models.tutor !== 'codex.gpt-5.6-sol' ||
    config.models.judge !== 'claude-code.claude-opus-5'
  ) {
    throw new Error('Luna reference model route drift');
  }
  const arm = {
    id: 'C',
    label: 'Luna learner',
    displayLabel: 'Luna learner · direct',
    variant: 'luna',
    mode: 'direct',
    tutorMode: 'direct',
    profile: 'codex',
    provider: 'codex',
    model: config.models.learner,
  };
  return {
    ...base,
    id: config.id,
    design: config.design,
    output: config.output,
    total_attempt_ceiling: config.total_attempt_ceiling,
    recovery_attempt_reserve: config.response_free_recovery_reserve,
    generationCap: config.generation_attempt_ceiling,
    judge_calls: config.assessment_packets,
    arms: [arm],
    lunaArm: arm,
    models: config.models,
    sealedQwenReference: config.sealed_qwen_reference,
    reportMeta: reportMeta(config),
  };
}

export function readSealedQwenReference(plan, sourceDir) {
  const root = path.resolve(sourceDir);
  const expected = plan.sealedQwenReference;
  const files = {
    publicDialogues: path.join(root, 'public-dialogues.json'),
    scores: path.join(root, 'evaluation', 'scores.json'),
    reportData: path.join(root, 'report-data.json'),
  };
  const hashes = {
    publicDialogues: sha256(files.publicDialogues),
    scores: sha256(files.scores),
    reportData: sha256(files.reportData),
  };
  if (
    hashes.publicDialogues !== expected.public_dialogues_sha256 ||
    hashes.scores !== expected.scores_sha256 ||
    hashes.reportData !== expected.report_data_sha256
  ) {
    throw new Error('sealed Qwen reference hash drift');
  }
  const report = JSON.parse(fs.readFileSync(files.reportData, 'utf8'));
  const evaluation = JSON.parse(fs.readFileSync(files.scores, 'utf8'));
  if (
    report.provenance?.studyId !== expected.study_id ||
    report.provenance?.commit !== expected.launch_commit ||
    report.provenance?.configuredModels?.learner?.A !== expected.normal_model ||
    report.provenance?.configuredModels?.learner?.B !== expected.abliterated_model ||
    report.provenance?.configuredModels?.tutor !== plan.models.tutor ||
    report.provenance?.configuredModels?.judge !== plan.models.judge ||
    report.arms?.map((arm) => `${arm.id}:${arm.model}:${arm.snapshot?.turns?.length}`).join(',') !==
      `A:${expected.normal_model}:8,B:${expected.abliterated_model}:8` ||
    evaluation.scores?.map((score) => `${score.arm}/${score.kind}`).join(',') !==
      'A/tutor,A/learner,A/dialogue,A/quality,B/tutor,B/learner,B/dialogue,B/quality'
  ) {
    throw new Error('sealed Qwen reference content differs from the registered comparison');
  }
  return { root, hashes, arms: report.arms, evaluation };
}

export async function callLunaReferenceModel(args, callCli = callAIWithCliBridge) {
  if (args.speaker === 'tutor') return callContinuityModel({ ...args, callCli });
  return callCli(
    { provider: 'codex', model: 'gpt-5.6-luna' },
    args.request.systemPrompt,
    args.request.prompt,
    args.role,
    {
      effort: 'medium',
      timeoutMs: 180_000,
      messageHistory: args.request.messageHistory,
      outputSchema: CONTINUITY_OUTPUT_SCHEMA,
      onEvent: args.onEvent,
      singleAttempt: true,
    },
  );
}

export function lunaReferencePaidBudget(admission, limit, hooks = {}, priorAttemptBase = 0, unitPrefix = null) {
  return createDurablePaidModelAttemptBudget({ admission, limit, hooks, priorAttemptBase, unitPrefix });
}

function retryableResponseFreeFailure(error) {
  return (
    error?.code === 'CLI_PROVIDER_RESPONSE_FREE_ERROR' &&
    error?.classification === 'response_free_error' &&
    ['result_error_without_structured_output', 'provider_rejected_invalid_structured_output'].includes(error?.reason)
  );
}

function providerRejectedInvalidOutput(response, projection, outputSchema) {
  if (response?.structuredOutputRecovery?.providerValidated !== false) return null;
  const issues = benchmarkOutputSchemaIssues(JSON.parse(projection.text), outputSchema);
  if (!issues.length) return null;
  const error = new Error(
    `claude CLI provider-rejected structured output failed the registered schema (${issues.slice(0, 8).join(', ')})`,
  );
  error.code = 'CLI_PROVIDER_RESPONSE_FREE_ERROR';
  error.classification = 'response_free_error';
  error.reason = 'provider_rejected_invalid_structured_output';
  error.responseFree = true;
  return error;
}

export function makeLunaJudgeCaller({
  budget,
  outDir,
  maximumResponseFreeRetries = 2,
  priorPhysicalAttempts = 0,
  priorResponseFreeRetries = 0,
  callCli = callAIWithCliBridge,
}) {
  if (
    !Number.isSafeInteger(priorPhysicalAttempts) ||
    priorPhysicalAttempts < 0 ||
    !Number.isSafeInteger(priorResponseFreeRetries) ||
    priorResponseFreeRetries < 0 ||
    priorResponseFreeRetries > priorPhysicalAttempts ||
    priorResponseFreeRetries > maximumResponseFreeRetries
  ) {
    throw new Error('invalid prior judge-attempt counters');
  }
  let physicalAttempts = priorPhysicalAttempts;
  let responseFreeRetries = priorResponseFreeRetries;
  let returnedCandidate = null;
  const caller = async (agent, systemPrompt, userPrompt, role, options) => {
    for (;;) {
      const reservation = budget.reserve({
        role,
        stage: 'assessment',
        unitId: options.durableUnitId,
      });
      budget.markDispatched?.();
      physicalAttempts += 1;
      let rawOutput;
      try {
        const response = await callCli(agent, systemPrompt, userPrompt, role, {
          ...options,
          outputSchema: allowUnknownRootOutputFields(options.outputSchema),
          onRawOutput: (output) => {
            rawOutput = output;
          },
        });
        const projection = projectRegisteredRootOutput(response.text, options.outputSchema);
        const providerFailure = providerRejectedInvalidOutput(response, projection, options.outputSchema);
        if (providerFailure) throw providerFailure;
        options.onRawOutput?.(rawOutput);
        returnedCandidate = { role, attempt: physicalAttempts, reservation, projection };
        if (!options.durableUnitId) {
          budget.complete?.();
          fs.appendFileSync(
            path.join(outDir, 'assessment-physical-attempts.jsonl'),
            `${JSON.stringify({ role, attempt: physicalAttempts, reservation, status: 'candidate_returned', discardedRootKeys: projection.discardedRootKeys })}\n`,
          );
          returnedCandidate = null;
        }
        return { ...response, text: projection.text, outputProjection: projection };
      } catch (error) {
        budget.fail?.(error);
        fs.appendFileSync(
          path.join(outDir, 'assessment-physical-attempts.jsonl'),
          `${JSON.stringify({ role, attempt: physicalAttempts, reservation, status: 'failed', code: error.code, classification: error.classification, reason: error.reason, message: error.message })}\n`,
        );
        if (!retryableResponseFreeFailure(error) || responseFreeRetries >= maximumResponseFreeRetries) throw error;
        responseFreeRetries += 1;
      }
    }
  };
  caller.persistResponse = (responsePath) => {
    if (!returnedCandidate) throw new Error('cannot persist an assessment response without a returned candidate');
    budget.persistResponse?.(responsePath);
    fs.appendFileSync(
      path.join(outDir, 'assessment-physical-attempts.jsonl'),
      `${JSON.stringify({ role: returnedCandidate.role, attempt: returnedCandidate.attempt, reservation: returnedCandidate.reservation, status: 'candidate_returned', discardedRootKeys: returnedCandidate.projection.discardedRootKeys })}\n`,
    );
  };
  caller.complete = () => {
    budget.complete?.();
    returnedCandidate = null;
  };
  caller.fail = (error) => {
    budget.fail?.(error);
    returnedCandidate = null;
  };
  caller.snapshot = () => ({ physicalAttempts, responseFreeRetries });
  return caller;
}

function lunaRecoveryPlanShape(plan) {
  const {
    provenance: _mutableLaunchProvenance,
    sealedQwenReferenceRoot: _outputSpecificResolvedReferenceRoot,
    ...registeredPlan
  } = plan;
  return registeredPlan;
}

function acceptedDurableResponsePaths(events, source) {
  const reservations = new Map(
    events
      .filter((event) => event.type === 'model_attempt_dispatch_reserved')
      .map((event) => [event.attempt_id, event]),
  );
  const persisted = new Map(
    events.filter((event) => event.type === 'attempt_response_persisted').map((event) => [event.attempt_id, event]),
  );
  const completed = events.filter((event) => event.type === 'attempt_completed');
  const accepted = new Set();
  for (const terminal of completed) {
    const reservation = reservations.get(terminal.attempt_id);
    const response = persisted.get(terminal.attempt_id);
    if (!reservation || !response || !path.isAbsolute(response.response_path || '')) {
      throw new Error(`completed Luna attempt ${terminal.attempt_id} has no durable response record`);
    }
    const responsePath = path.resolve(response.response_path);
    const relative = path.relative(source, responsePath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(responsePath)) {
      throw new Error(`durable Luna response is missing or outside the predecessor: ${responsePath}`);
    }
    if (sha256(responsePath) !== response.response_sha256) {
      throw new Error(`durable Luna response hash drift: ${responsePath}`);
    }
    accepted.add(responsePath);
  }
  return accepted;
}

function readSavedLunaPrefix(plan, armDir, acceptedResponses) {
  const savedReplies = {};
  let gapFound = false;
  for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
    for (const speaker of ['learner', 'tutor']) {
      const requestPath = path.join(armDir, `${turn}-${speaker}.request.json`);
      const responsePath = path.join(armDir, `${turn}-${speaker}.response.json`);
      const hasRequest = fs.existsSync(requestPath);
      const hasResponse = acceptedResponses.has(path.resolve(responsePath));
      if (hasResponse && !hasRequest) throw new Error(`Luna recovery response has no request: ${responsePath}`);
      if (!gapFound && hasRequest && hasResponse) {
        savedReplies[`${turn}-${speaker}`] = {
          source: responsePath,
          request: readJson(requestPath, 'saved Luna recovery request'),
          response: readJson(responsePath, 'saved Luna recovery response'),
        };
        continue;
      }
      if (hasRequest || hasResponse) gapFound = true;
      if (gapFound && hasResponse) throw new Error(`Luna recovery prefix is not contiguous: ${responsePath}`);
    }
  }
  return savedReplies;
}

function readLunaAssessmentRecovery(plan, source, luna, acceptedResponses) {
  const evaluationDir = path.join(source, 'evaluation');
  const result = { priorScores: [], priorSplitQualityParts: [], completedPackets: 0 };
  if (!fs.existsSync(evaluationDir)) return result;
  const jobs = buildBenchmarkJobs([luna], {
    extendedQuality: true,
    splitQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: { C: investedRivalDeliveredSourceContext(plan, luna) },
  });
  const recoveredPacket = (kind) => {
    const job = jobs.find((candidate) => candidate.arm === 'C' && candidate.kind === kind);
    const base = path.join(evaluationDir, `C-${kind}`);
    if (
      !job ||
      !acceptedResponses.has(path.resolve(`${base}.response.txt`)) ||
      !fs.existsSync(`${base}.provider.json`) ||
      !fs.existsSync(`${base}.prompt.txt`) ||
      !fs.existsSync(`${base}.schema.json`) ||
      fs.existsSync(`${base}.error.json`)
    ) {
      return null;
    }
    if (
      fs.readFileSync(`${base}.prompt.txt`, 'utf8') !== job.prompt ||
      JSON.stringify(readJson(`${base}.schema.json`, `${kind} recovery schema`)) !== JSON.stringify(job.outputSchema)
    ) {
      throw new Error(`persisted Luna assessment packet drift for C/${kind}`);
    }
    const response = fs.readFileSync(`${base}.response.txt`, 'utf8');
    if (readJson(`${base}.provider.json`, `${kind} recovery provider`).text !== response) {
      throw new Error(`persisted Luna assessment response mismatch for C/${kind}`);
    }
    if (kind.startsWith('quality-')) {
      return {
        raw: parseSplitQualityScore(
          kind.replace('quality-', ''),
          response,
          luna.snapshot.turns.length,
          job.outputSchema,
        ),
      };
    }
    const parsed = parseBenchmarkScore(kind, response, luna.snapshot.turns.length, {
      extendedQuality: true,
      allowOneBasedIndices: true,
      outputSchema: job.outputSchema,
    });
    return { raw: parsed.parsed, indexNormalization: parsed.indexNormalization };
  };
  for (const kind of ['tutor', 'learner', 'dialogue']) {
    const recovered = recoveredPacket(kind);
    if (!recovered) continue;
    assertCompleteScore(kind, recovered.raw, luna.snapshot.turns.length, { extendedQuality: true });
    result.priorScores.push({
      arm: 'C',
      kind,
      raw: recovered.raw,
      scored: normalizeScores(kind, recovered.raw),
      indexNormalization: recovered.indexNormalization || null,
    });
    result.completedPackets += 1;
  }
  for (const part of ['summary', 'turns']) {
    const recovered = recoveredPacket(`quality-${part}`);
    if (!recovered) continue;
    result.priorSplitQualityParts.push({ arm: 'C', part, raw: recovered.raw });
    result.completedPackets += 1;
  }
  return result;
}

export function readLunaReferenceRecovery(plan, sourceDir) {
  if (!sourceDir || !path.isAbsolute(sourceDir)) throw new Error('Luna recovery source must be absolute');
  const source = path.resolve(sourceDir);
  const priorPlan = readJson(path.join(source, 'plan.json'), 'Luna recovery plan');
  if (JSON.stringify(lunaRecoveryPlanShape(priorPlan)) !== JSON.stringify(lunaRecoveryPlanShape(plan))) {
    throw new Error('Luna recovery plan drift');
  }
  const events = readJsonLines(path.join(source, 'run-ledger.jsonl'), 'Luna recovery run ledger');
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
    reservations.length > plan.total_attempt_ceiling ||
    terminals.length !== reservations.length ||
    new Set(terminals.map((event) => event.attempt_id)).size !== terminals.length ||
    terminals.some((terminal) => !reservations.some((reservation) => reservation.attempt_id === terminal.attempt_id))
  ) {
    throw new Error('Luna recovery requires one sealed durable technical predecessor');
  }
  const acceptedResponses = acceptedDurableResponsePaths(events, source);
  const armDir = path.join(source, 'C');
  const completedGeneration = fs.existsSync(path.join(armDir, 'dialogue.json'));
  const savedReplies =
    completedGeneration || !fs.existsSync(armDir) ? {} : readSavedLunaPrefix(plan, armDir, acceptedResponses);
  const luna = completedGeneration
    ? readBenchmarkArm({ ...plan.lunaArm, path: path.join(armDir, 'dialogue.json') })
    : null;
  const assessment = completedGeneration ? readLunaAssessmentRecovery(plan, source, luna, acceptedResponses) : null;
  const generationResponses = completedGeneration
    ? fs
        .readdirSync(armDir)
        .filter((name) => /^\d+-(?:learner|tutor)\.response\.json$/u.test(name))
        .filter((name) => acceptedResponses.has(path.resolve(armDir, name))).length
    : Object.keys(savedReplies).length;
  if (completedGeneration && generationResponses !== luna.snapshot.turns.length * 2) {
    throw new Error('completed Luna dialogue contains an unaccepted model response');
  }
  const assessmentAttempts = reservations.filter((event) => event.stage === 'assessment').length;
  const responseFreeAttempts = reservations.length - generationResponses - (assessment?.completedPackets || 0);
  if (
    responseFreeAttempts < 0 ||
    responseFreeAttempts > plan.recovery_attempt_reserve ||
    assessmentAttempts < (assessment?.completedPackets || 0)
  ) {
    throw new Error('Luna recovery attempt accounting exceeds the registered reserve');
  }
  return {
    source,
    priorAttempts: reservations.length,
    completedGeneration,
    savedReplies,
    luna,
    assessment,
    generationResponses,
    assessmentAttempts,
    responseFreeAttempts,
  };
}

function lunaWorkflowUnits(phase, state) {
  if (phase === 'GENERATING') {
    return {
      complete: state.generationComplete ? 1 : 0,
      active: state.generationActive ? 1 : 0,
      failed: 0,
      missing: state.generationComplete || state.generationActive ? 0 : 1,
    };
  }
  if (phase === 'AUDITING') {
    return {
      complete: state.completedAssessments,
      active: state.assessmentActive ? 1 : 0,
      failed: 0,
      missing: Math.max(0, state.plan.judge_calls - state.completedAssessments - (state.assessmentActive ? 1 : 0)),
    };
  }
  if (phase === 'PACKAGING') {
    return { complete: state.packageComplete ? 1 : 0, active: state.packageComplete ? 0 : 1, failed: 0, missing: 0 };
  }
  return { complete: 0, active: 0, failed: 0, missing: 0 };
}

export function createLunaReferenceWorkflowTracker({ plan, outDir, admission, recovery = null, at } = {}) {
  const state = {
    plan,
    generationComplete: recovery?.completedGeneration === true,
    generationActive: false,
    completedAssessments: recovery?.assessment?.completedPackets || 0,
    assessmentActive: false,
    packageComplete: false,
    recentDurationsMs: [],
  };
  const filePath = path.join(outDir, 'workflow-status.json');
  const durableStatusPath = path.join(outDir, 'status.json');
  const predecessorLedgerPath = recovery?.source ? path.join(recovery.source, 'run-ledger.jsonl') : null;
  const baseline = {
    completed: recovery?.generationResponses + (recovery?.assessment?.completedPackets || 0) || 0,
    failed: recovery?.responseFreeAttempts || 0,
  };
  const ledgerCounts = () => {
    const events =
      admission.ledger_path && fs.existsSync(admission.ledger_path)
        ? readJsonLines(admission.ledger_path, 'Luna workflow attempt ledger')
        : [];
    return {
      completed: baseline.completed + events.filter((event) => event.type === 'attempt_completed').length,
      failed:
        baseline.failed +
        events.filter((event) =>
          ['attempt_failed', 'attempt_cancelled_before_dispatch', 'attempt_interrupted_after_dispatch'].includes(
            event.type,
          ),
        ).length,
      reserved: admission.studyReserved,
      hard_ceiling: plan.total_attempt_ceiling,
    };
  };
  const startedAt = at || new Date();
  let status = createLongRunningWorkflowStatus({
    workflowId: `${plan.id}-completion`,
    phasePlan: LUNA_WORKFLOW_PHASES,
    at: startedAt,
    units: lunaWorkflowUnits('GENERATING', state),
    calls: ledgerCounts(),
    modelActivity: { state: 'inactive', explanation: 'Preflight and recovery checks make no model calls.' },
    nextAction: {
      description: 'Verify the registered Luna study and preserved recovery evidence.',
      stopping_condition: 'Stop before dispatch if the plan, evidence, or remaining ceiling drifts.',
    },
  });
  status = completeLongRunningWorkflowPhase(status, {
    phase: 'PREFLIGHT',
    nextPhase: 'GENERATING',
    at: startedAt,
    startNextImmediately: true,
    units: lunaWorkflowUnits('GENERATING', state),
    calls: ledgerCounts(),
    modelActivity: { state: 'inactive', explanation: 'Preflight passed; no generation call is active.' },
    nextAction: {
      description: 'Generate only Luna dialogue turns not already preserved.',
      stopping_condition: 'Stop on plan drift, a substantive failure, or the hard ceiling.',
    },
  });
  if (recovery) {
    status = recordLongRunningWorkflowRecovery(status, {
      at: startedAt,
      operation: 'Continue the registered Luna reference from preserved evidence.',
      reason: 'A sealed technical predecessor stopped before all work was accepted.',
      scope:
        'Reuse valid dialogue and assessment outputs; run only missing work under the unchanged 23-attempt ceiling.',
      modelActivity: status.model_activity,
    });
  }
  const persist = () => {
    writeLongRunningWorkflowStatusAtomic(filePath, status);
    const predecessorEvents =
      predecessorLedgerPath && fs.existsSync(predecessorLedgerPath)
        ? readJsonLines(predecessorLedgerPath, 'Luna predecessor attempt ledger')
        : [];
    const currentEvents =
      admission.ledger_path && fs.existsSync(admission.ledger_path)
        ? readJsonLines(admission.ledger_path, 'Luna workflow attempt ledger')
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
    const plannedTurns = generationOpen ? plan.max_exchanges * 2 : generationUnitIds.size;
    const plannedUnits = complete
      ? new Set(
          attemptEvents
            .filter((event) => event.type === 'attempt_completed')
            .map((event) => event.unit_id)
            .filter(Boolean),
        ).size
      : plannedTurns + plan.judge_calls;
    const durableStatus = buildDurableEvaluationStatus({
      events: attemptEvents,
      plannedUnits,
      plannedTurns,
      completedTurns: generationUnitIds.size,
      hardCeiling: plan.total_attempt_ceiling,
      workflowState: complete ? 'complete' : status.current_phase === 'BLOCKED' ? 'blocked' : 'running',
      scientificVerdict: complete ? 'descriptive_result_packaged' : 'registered_measurement_pending',
      modelActivity: status.model_activity.state,
      now: new Date(status.last_material_progress_at),
    });
    if (complete && (durableStatus.planes.unit.active !== 0 || durableStatus.planes.unit.missing !== 0)) {
      throw new Error('completed Luna workflow retains active or missing durable work units');
    }
    writeJsonAtomic(durableStatusPath, durableStatus);
    return status;
  };
  const refresh = ({ durationMs, modelActivity, nextAction } = {}) => {
    if (Number.isFinite(durationMs) && durationMs > 0) {
      state.recentDurationsMs = [...state.recentDurationsMs, durationMs].slice(-8);
    }
    status = updateLongRunningWorkflowProgress(status, {
      units: lunaWorkflowUnits(status.current_phase, state),
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
          description: `Apply only the registered bounded recovery rule: ${error?.message || 'model call failed'}`,
          stopping_condition: 'Stop if the failure is substantive or the two-attempt reserve is exhausted.',
        },
      });
    },
    generationStarted() {
      state.generationActive = true;
      return refresh({
        modelActivity: { state: 'active', explanation: 'The registered Luna dialogue is running.' },
      });
    },
    generationCompleted(durationMs) {
      state.generationActive = false;
      state.generationComplete = true;
      if (status.current_phase === 'GENERATING') {
        status = completeLongRunningWorkflowPhase(status, {
          phase: 'GENERATING',
          nextPhase: 'AUDITING',
          startNextImmediately: true,
          units: lunaWorkflowUnits('AUDITING', state),
          calls: ledgerCounts(),
          recentUnitDurationsMs: durationMs ? [durationMs] : [],
          modelActivity: { state: 'inactive', explanation: 'The Luna dialogue is complete; assessment is next.' },
          nextAction: {
            description: 'Assess only packets not already preserved as valid.',
            stopping_condition: 'Stop on a substantive judge failure or when all five packets are valid.',
          },
        });
      }
      return persist();
    },
    assessmentCompleted() {
      if (state.completedAssessments !== plan.judge_calls || state.assessmentActive) {
        throw new Error('cannot complete Luna assessment before all five packets are valid');
      }
      status = completeLongRunningWorkflowPhase(status, {
        phase: 'AUDITING',
        nextPhase: 'PACKAGING',
        startNextImmediately: true,
        units: lunaWorkflowUnits('PACKAGING', state),
        calls: ledgerCounts(),
        modelActivity: { state: 'inactive', explanation: 'All assessments are valid; packaging is zero-call.' },
        nextAction: {
          description: 'Build and seal the combined Luna/Qwen report.',
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
      state.generationActive = false;
      state.assessmentActive = false;
      status = blockLongRunningWorkflow(status, {
        blockedPhase: status.current_phase,
        operation: 'Run the current registered Luna reference phase.',
        error: error?.message || String(error),
        units: lunaWorkflowUnits(status.current_phase, state),
        calls: ledgerCounts(),
        modelActivity: { state: 'inactive', explanation: 'The runner stopped and no model call remains active.' },
        nextAction: {
          description: 'Inspect the preserved failure and use bounded recovery only when technically eligible.',
          stopping_condition: 'Stop before changing the study or exceeding its ceiling.',
        },
        humanActionRequired: false,
      });
      return persist();
    },
  };
}

function syntheticLunaArm(plan) {
  let releasedPremiseIds = [];
  const turns = [];
  for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
    const proof = buildContinuityProofPlan({ plan, turn, releasedPremiseIds });
    releasedPremiseIds = [...releasedPremiseIds, ...proof.requiredReleases.map((row) => row.premise)];
    turns.push({
      turn,
      learner: `Synthetic Luna learner turn ${turn}; packet fixture, not model output.`,
      tutor: proof.sources.map((source) => source.text).join(' ') || `Synthetic Sol tutor turn ${turn}.`,
    });
  }
  return {
    ...plan.lunaArm,
    opening: plan.world.opening_frame.authored_text,
    transcript: turns
      .flatMap((row) => [`Learner ${row.turn}: ${row.learner}`, `Tutor ${row.turn}: ${row.tutor}`])
      .join('\n'),
    wallTimeMs: 0,
    repetition: { meanLexicalSurpriseAfterOpening: null },
    technical: {
      learnerMechanism: { calls: 0, medianLatencyMs: null, totalLatencyMs: 0 },
      learnerFinal: { calls: 0, meanEndToEndOutputTokensPerSecond: null },
      tutor: { calls: 0, totalLatencyMs: 0 },
    },
    snapshot: {
      turns,
      maxExchanges: plan.max_exchanges,
      disposition: 'exchange_cap',
      proofControl: { releasedPremiseIds, publicProofEntailed: true },
    },
  };
}

function renderCombined({ plan, qwen, luna, evaluation, provenance, outDir, mock = false }) {
  const result = {
    arms: [...qwen.arms, luna],
    evaluation,
    provenance,
    characterBrief: plan.characterBrief,
    proofControl: true,
    comparisonLabel: 'Post-hoc descriptive reference',
    corrections: [
      'The two Qwen dialogues and their eight assessments are sealed inputs and were not regenerated or rejudged.',
      'Luna receives the same character, opening, public proof schedule and Sol tutor, but was added after the Qwen outcomes were known.',
      'Surplus provider root fields are discarded; every registered value is then checked by the unchanged strict local schema.',
      'This is a single-dialogue acting reference, not a causal model-family comparison or model ranking.',
    ],
    reportMeta: plan.reportMeta,
    mock,
  };
  writeJson(path.join(outDir, mock ? 'report-preview-data.json' : 'report-data.json'), result);
  const rendered = renderContinuityReport(result);
  fs.writeFileSync(path.join(outDir, mock ? 'report-preview.html' : 'report.html'), rendered.html, { flag: 'wx' });
  writeJson(path.join(outDir, mock ? 'public-preview.json' : 'public-dialogues.json'), rendered.interchange);
}

function provenance(plan, admission, qwen, recovery = null) {
  return {
    commit: admission.source.commit,
    tree: admission.source.tree,
    dirty: false,
    detached: true,
    studyId: plan.id,
    totalAttemptCeiling: plan.total_attempt_ceiling,
    generationAttemptMaximum: plan.generationCap,
    plannedAssessmentPackets: plan.judge_calls,
    responseFreeRecoveryReserve: plan.recovery_attempt_reserve,
    configuredModels: { learner: plan.models.learner, tutor: plan.models.tutor, judge: plan.models.judge },
    authorization: admission.authorization,
    sealedQwenReference: { root: qwen.root, hashes: qwen.hashes, studyId: plan.sealedQwenReference.study_id },
    recovery: recovery
      ? {
          source: recovery.source,
          priorAttempts: recovery.priorAttempts,
          generationResponsesPreserved: recovery.generationResponses,
          completedAssessmentPacketsPreserved: recovery.assessment?.completedPackets || 0,
          responseFreeAttempts: recovery.responseFreeAttempts,
        }
      : null,
  };
}

async function dryRun(plan, qwen, outDir) {
  if (fs.existsSync(outDir)) throw new Error('dry-run destination is create-once');
  fs.mkdirSync(outDir, { recursive: true });
  const luna = syntheticLunaArm(plan);
  let releasedPremiseIds = [];
  const preflight = [];
  for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
    const request = buildContinuityRequest({
      plan,
      speaker: 'tutor',
      turn,
      history: [{ role: 'assistant', content: plan.world.opening_frame.authored_text }],
      releasedPremiseIds,
    });
    preflight.push(request);
    releasedPremiseIds = [...releasedPremiseIds, ...request.proofPlan.requiredReleases.map((row) => row.premise)];
  }
  const packets = buildBenchmarkJobs([luna], {
    extendedQuality: true,
    splitQuality: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: { C: investedRivalDeliveredSourceContext(plan, luna) },
  });
  if (packets.length !== plan.judge_calls) throw new Error('dry-run packet count drift');
  writeJson(path.join(outDir, 'preflight.json'), {
    modelCalls: 0,
    qwen: qwen.hashes,
    tutorRequests: preflight,
    packets,
  });
  renderCombined({
    plan,
    qwen,
    luna,
    evaluation: { scores: qwen.evaluation.scores, attemptsUsed: 0, plannedNewAssessmentPackets: 5 },
    provenance: { totalAttemptCeiling: 23, budget: { used: 0, limit: 23 }, synthetic: true },
    outDir,
    mock: true,
  });
  return { outDir, dryRun: true, packets: packets.length };
}

async function liveRun(plan, qwen, outDir, admission, recovery = null) {
  let workflow;
  const budget = lunaReferencePaidBudget(admission, plan.total_attempt_ceiling, {
    onAttemptStarted: (attempt) => workflow?.attemptStarted(attempt),
    onAttemptCompleted: (attempt) => workflow?.attemptCompleted(attempt),
    onAttemptFailed: (attempt) => workflow?.attemptFailed(attempt),
  });
  const started = Date.now();
  try {
    admission.record({ type: 'sealed_qwen_reference_verified', hashes: qwen.hashes, new_model_attempts: 0 });
    writeJson(path.join(outDir, 'plan.json'), {
      ...plan,
      sealedQwenReferenceRoot: qwen.root,
      provenance: { recovery: recovery ? { source: recovery.source } : null },
    });
    workflow = createLunaReferenceWorkflowTracker({ plan, outDir, admission, recovery });
    if (recovery?.completedGeneration) {
      fs.cpSync(path.join(recovery.source, 'C'), path.join(outDir, 'C'), {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    } else {
      workflow.generationStarted();
      await runContinuityArm({
        plan,
        arm: plan.lunaArm,
        outDir: path.join(outDir, 'C'),
        budget: budget.scope('generation/C'),
        callModel: callLunaReferenceModel,
        savedReplies: recovery?.savedReplies || {},
        unsupportedQuotationPolicy: 'drop',
      });
    }
    const luna = readBenchmarkArm({
      ...plan.lunaArm,
      path: path.join(outDir, 'C', 'dialogue.json'),
      wallTimeMs: recovery?.completedGeneration ? recovery.luna.wallTimeMs : Date.now() - started,
    });
    writeJson(path.join(outDir, 'luna-arm.json'), luna);
    workflow.generationCompleted(recovery?.completedGeneration ? undefined : Date.now() - started);
    const judge = makeLunaJudgeCaller({
      budget,
      outDir,
      maximumResponseFreeRetries: plan.recovery_attempt_reserve,
      priorPhysicalAttempts: recovery?.assessmentAttempts || 0,
      priorResponseFreeRetries: recovery?.responseFreeAttempts || 0,
    });
    const newEvaluation = await scoreBenchmarkArms([luna], path.join(outDir, 'evaluation'), {
      ceiling: 5,
      extendedQuality: true,
      splitQuality: true,
      allowOneBasedIndices: true,
      assessmentContext: plan.assessmentContext,
      publicSourceContextByArm: { C: investedRivalDeliveredSourceContext(plan, luna) },
      callJudge: judge,
      priorScores: recovery?.assessment?.priorScores || [],
      priorSplitQualityParts: recovery?.assessment?.priorSplitQualityParts || [],
      priorAttempts: recovery?.assessment?.completedPackets || 0,
      durableUnitPrefix: 'assessment',
    });
    const judgeUse = judge.snapshot();
    workflow.assessmentCompleted();
    const evaluation = {
      ...newEvaluation,
      scores: [...qwen.evaluation.scores, ...newEvaluation.scores],
      reusedAssessments: qwen.evaluation.scores.length,
      newLogicalAssessments: newEvaluation.scores.length,
      plannedNewAssessmentPackets: 5,
      newPhysicalAttempts: judgeUse.physicalAttempts,
      responseFreeRetries: judgeUse.responseFreeRetries,
    };
    const finalProvenance = { ...provenance(plan, admission, qwen, recovery), budget: budget.snapshot() };
    renderCombined({ plan, qwen, luna, evaluation, provenance: finalProvenance, outDir });
    writeJson(path.join(outDir, 'completed.json'), {
      budget: budget.snapshot(),
      lunaExchanges: luna.snapshot.turns.length,
      lunaDisposition: luna.snapshot.disposition,
      reusedQwenAssessments: qwen.evaluation.scores.length,
      newLogicalAssessments: newEvaluation.scores.length,
      newAssessmentPackets: 5,
      judgePhysicalAttempts: judgeUse.physicalAttempts,
      responseFreeRetries: judgeUse.responseFreeRetries,
      recovery: finalProvenance.recovery,
    });
    admission.close({
      type: 'run_sealed',
      status: 'complete',
      completed_arms: 1,
      completed_assessments: newEvaluation.scores.length,
      reused_qwen_assessments: qwen.evaluation.scores.length,
      reserved_attempts: admission.reserved,
    });
    workflow.packagingCompleted();
    return { outDir, dryRun: false, attempts: budget.snapshot().used };
  } catch (error) {
    if (!fs.existsSync(path.join(outDir, 'stopped.json'))) {
      writeJson(path.join(outDir, 'stopped.json'), { error: error.message, budget: budget.snapshot() });
    }
    const recoveryPermitted = retryableResponseFreeFailure(error);
    admission.close({
      type: 'run_sealed',
      status: recoveryPermitted ? 'technical_failure' : 'failed',
      error: error.message,
      reserved_attempts: admission.reserved,
      study_reserved: budget.snapshot().used,
      recovery_permitted: recoveryPermitted,
    });
    workflow?.blocked(error);
    throw error;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      live: { type: 'boolean', default: false },
      config: { type: 'string' },
      reference: { type: 'string' },
      output: { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      'launch-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      'study-state-root': { type: 'string' },
      'recovery-from': { type: 'string' },
    },
  });
  if (!values.reference) throw new Error('--reference is required');
  const plan = buildLunaReferencePlan(ROOT, values.config || DEFAULT_CONFIG);
  const qwen = readSealedQwenReference(plan, values.reference);
  const outDir = path.resolve(ROOT, values.output || plan.output);
  if (!values.live) return dryRun(plan, qwen, outDir);
  if (!values['accept-charges'] || !values['launch-commit'] || !values['go-note-commit'] || !values['go-note-path']) {
    throw new Error('paid launch requires the shared launch arguments');
  }
  const recoveryFrom = values['recovery-from'] ? path.resolve(values['recovery-from']) : null;
  if (recoveryFrom && !values.output) throw new Error('Luna recovery requires a fresh --output destination');
  const recovery = recoveryFrom ? readLunaReferenceRecovery(plan, recoveryFrom) : null;
  const admission = admitPaidStudyLaunch({
    root: ROOT,
    designPath: plan.design,
    launchCommit: values['launch-commit'],
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
    spendCap: plan.total_attempt_ceiling,
    destination: outDir,
    studyId: plan.id,
    studyStateRoot: path.resolve(ROOT, values['study-state-root'] || '.tutor-stub-traces/.paid-study-state'),
    ...(recoveryFrom ? { recoveryFrom } : {}),
  });
  return liveRun(plan, qwen, outDir, admission, recovery);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
