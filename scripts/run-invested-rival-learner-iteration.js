#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { createDurablePaidModelAttemptBudget } from '../services/durablePaidModelAttemptBudget.js';
import { buildDurableEvaluationStatus } from '../services/durableAttemptJournal.js';
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
import { plotLint, validateWorld } from '../services/dramaticDerivation/world.js';
import {
  buildBenchmarkJobs,
  mergeSplitQualityScores,
  normalizeScores,
  parseBenchmarkScore,
  parseSplitQualityScore,
  readBenchmarkArm,
  scoreBenchmarkArms,
} from './score-local-qwen-resistant-learner-benchmark.js';
import {
  buildInvestedRivalPlan,
  investedRivalDeliveredSourceContext,
  runtimeServiceArm,
} from './run-local-qwen-invested-rival.js';
import { makeLunaJudgeCaller } from './run-invested-rival-luna-reference.js';
import { discoverLoadedModel, manageServer } from './run-local-qwen-resistant-learner.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = 'config/tutor-stub-local-learners/invested-rival-learner-iteration.v1.yaml';
const LEARNER_ITERATION_WORKFLOW_PHASES = Object.freeze([
  'PREFLIGHT',
  'GENERATING',
  'AUDITING',
  'PACKAGING',
  'WORKFLOW_COMPLETE',
]);
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

function writeJsonAtomic(file, value) {
  const target = path.resolve(file);
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  const descriptor = fs.openSync(temporary, 'wx');
  try {
    fs.writeSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temporary, target);
}

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

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} required`);
  return value.trim();
}

function characterBrief(character) {
  return Object.entries(character)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join('; ') : value}`)
    .join('\n');
}

function reportMeta(report) {
  return {
    ...Object.fromEntries(
      Object.entries(report).map(([key, value]) => [
        key.replace(/_([a-z])/gu, (_match, letter) => letter.toUpperCase()),
        value,
      ]),
    ),
    learnerFamilyLabel: 'learner',
    attemptScopeLabel: 'study paid attempts used',
    opusAttemptScopeLabel: 'study Opus attempts used',
  };
}

function assessmentContext(scene) {
  return {
    scenarioName: requireString(scene.assessment?.scenario_name, 'assessment scenario_name'),
    scenarioDescription: requireString(scene.assessment?.scenario_description, 'assessment scenario_description'),
    topic: requireString(scene.assessment?.topic, 'assessment topic'),
    profileId: requireString(scene.assessment?.profile_id, 'assessment profile_id'),
    characterBrief: characterBrief(scene.character),
    expectedBehavior: requireString(scene.assessment?.expected_behavior, 'assessment expected_behavior'),
    qualityInstructions: requireString(scene.assessment?.quality_instructions, 'assessment quality_instructions'),
  };
}

function loadSceneWorld(root, worldPath) {
  const raw = yaml.parse(fs.readFileSync(path.resolve(root, worldPath), 'utf8'));
  const lint = plotLint(validateWorld(raw));
  if (!lint.ok) throw new Error(`proof world invalid: ${lint.errors.join('; ')}`);
  return { ...raw, releaseSchedule: raw.release_schedule };
}

function buildScenePlan({ base, root, config, scene, mechanism, id, arms, report }) {
  const world = loadSceneWorld(root, scene.world);
  const learnerName = requireString(scene.character?.name, 'character name');
  const interaction = {
    ...base.interaction,
    learnerName,
    learnerSystem: `${base.interaction.learnerSystem}\n\n${requireString(
      mechanism.system_append,
      'mechanism system_append',
    )}`,
    learnerTurn: `${base.interaction.learnerTurn}\n\n${requireString(mechanism.turn_prompt, 'mechanism turn_prompt')}`,
  };
  return {
    ...base,
    id,
    design: config.design,
    output: config.output,
    total_attempt_ceiling: config.total_attempt_ceiling,
    recovery_attempt_reserve: config.response_free_recovery_reserve,
    generationCap: arms.length * base.max_exchanges * 2,
    judge_calls: arms.length * 5,
    world,
    character: scene.character,
    characterBrief: characterBrief(scene.character),
    interaction,
    tutor: requireString(scene.tutor, 'scene tutor'),
    arms,
    assessmentContext: assessmentContext(scene),
    reportMeta: reportMeta(report),
  };
}

function lunaArm(id, label, model) {
  return {
    id,
    label,
    displayLabel: label,
    variant: 'luna',
    mode: 'direct',
    tutorMode: 'direct',
    profile: 'codex',
    provider: 'codex',
    model,
  };
}

export function buildLearnerIterationPlan(root = ROOT, configPath = DEFAULT_CONFIG) {
  const config = yaml.parse(fs.readFileSync(path.resolve(root, configPath), 'utf8'));
  const base = buildInvestedRivalPlan(root, config.source_config);
  if (
    config.id !== 'invested-rival-learner-iteration-v1' ||
    config.total_attempt_ceiling !== 110 ||
    config.generation_attempt_ceiling !== 80 ||
    config.assessment_packets !== 25 ||
    config.response_free_recovery_reserve !== 5 ||
    config.generation_attempt_ceiling + config.assessment_packets + config.response_free_recovery_reserve !==
      config.total_attempt_ceiling
  ) {
    throw new Error('learner-iteration attempt plan differs from the registered 110-attempt design');
  }
  if (
    config.models.learner_luna !== 'codex.gpt-5.6-luna' ||
    config.models.learner_qwen_normal !== 'mlx-community/Qwen3.8-27B-4bit' ||
    config.models.learner_qwen_abliterated !== 'Qwen3.8-27B-Uncensored-MLX/4-bit' ||
    config.models.tutor !== 'codex.gpt-5.6-sol' ||
    config.models.judge !== 'claude-code.claude-opus-5'
  ) {
    throw new Error('learner-iteration model route drift');
  }
  const developmentArms = [
    lunaArm('D1', config.mechanisms.working_belief.label, config.models.learner_luna),
    lunaArm('D2', config.mechanisms.active_progression.label, config.models.learner_luna),
  ];
  const finalArms = [
    lunaArm('A', 'Luna learner · active progression', config.models.learner_luna),
    {
      id: 'B',
      label: 'Normal Qwen learner · active progression',
      displayLabel: 'Normal Qwen learner · active progression',
      variant: 'normal',
      mode: 'direct',
      tutorMode: 'direct',
      profile: 'regular',
      provider: 'mlx-local',
      model: config.models.learner_qwen_normal,
    },
    {
      id: 'C',
      label: 'Abliterated Qwen learner · active progression',
      displayLabel: 'Abliterated Qwen learner · active progression',
      variant: 'abliterated',
      mode: 'direct',
      tutorMode: 'direct',
      profile: 'uncensored',
      provider: 'mlx-local',
      model: config.models.learner_qwen_abliterated,
    },
  ];
  const development = [
    buildScenePlan({
      base,
      root,
      config,
      scene: config.development,
      mechanism: config.mechanisms.working_belief,
      id: `${config.id}-development-working-belief`,
      arms: [developmentArms[0]],
      report: config.report.development,
    }),
    buildScenePlan({
      base,
      root,
      config,
      scene: config.development,
      mechanism: config.mechanisms.active_progression,
      id: `${config.id}-development-active-progression`,
      arms: [developmentArms[1]],
      report: config.report.development,
    }),
  ];
  const holdout = buildScenePlan({
    base,
    root,
    config,
    scene: config.holdout,
    mechanism: config.mechanisms.active_progression,
    id: `${config.id}-holdout`,
    arms: finalArms,
    report: config.report.holdout,
  });
  if (
    development.some((stage) => stage.world.id !== 'world_030_rowan_flat') ||
    holdout.world.id !== 'world_034_groupwork_flag' ||
    development.some((stage) => stage.arms.some((arm) => arm.mode !== 'direct' || arm.tutorMode !== 'direct')) ||
    holdout.arms.some((arm) => arm.mode !== 'direct' || arm.tutorMode !== 'direct')
  ) {
    throw new Error('learner-iteration stage or no-superego architecture drift');
  }
  return {
    id: config.id,
    design: config.design,
    output: config.output,
    total_attempt_ceiling: config.total_attempt_ceiling,
    generation_attempt_ceiling: config.generation_attempt_ceiling,
    assessment_packets: config.assessment_packets,
    recovery_attempt_reserve: config.response_free_recovery_reserve,
    models: config.models,
    base,
    development,
    holdout,
  };
}

export async function callLearnerIterationModel(args, callCli = callAIWithCliBridge) {
  if (args.speaker === 'tutor' || args.arm.provider !== 'codex') {
    return callContinuityModel({ ...args, callCli });
  }
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

export function learnerIterationPaidBudget(admission, limit, hooks = {}) {
  return createDurablePaidModelAttemptBudget({ admission, limit, hooks });
}

function learnerIterationPlanShape(plan) {
  const { provenance: _provenance, ...shape } = plan;
  return shape;
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function acceptedDurableResponses(events, source) {
  const reservations = events.filter((event) => event.type === 'model_attempt_dispatch_reserved');
  const byAttempt = new Map();
  for (const reservation of reservations) {
    if (!reservation.attempt_id || byAttempt.has(reservation.attempt_id)) {
      throw new Error('learner-iteration recovery has duplicate durable reservations');
    }
    byAttempt.set(reservation.attempt_id, { reservation, dispatched: 0, persisted: [], terminals: [] });
  }
  for (const event of events) {
    const attempt = byAttempt.get(event.attempt_id);
    if (!attempt) continue;
    if (event.type === 'model_attempt_dispatch_started') attempt.dispatched += 1;
    if (event.type === 'attempt_response_persisted') attempt.persisted.push(event);
    if (
      [
        'attempt_completed',
        'attempt_failed',
        'attempt_cancelled_before_dispatch',
        'attempt_interrupted_after_dispatch',
      ].includes(event.type)
    ) {
      attempt.terminals.push(event);
    }
  }
  const accepted = new Map();
  for (const [attemptId, attempt] of byAttempt) {
    if (attempt.terminals.length !== 1) {
      throw new Error(`learner-iteration recovery has unexplained durable reservation ${attemptId}`);
    }
    if (attempt.terminals[0].type !== 'attempt_completed') continue;
    if (attempt.dispatched !== 1 || attempt.persisted.length !== 1) {
      throw new Error(`learner-iteration completed attempt lacks one dispatch and persisted response ${attemptId}`);
    }
    const persisted = attempt.persisted[0];
    const responsePath = path.resolve(persisted.response_path || '');
    const relative = path.relative(source, responsePath);
    if (
      !path.isAbsolute(persisted.response_path || '') ||
      !relative ||
      relative.startsWith('..') ||
      path.isAbsolute(relative) ||
      !fs.existsSync(responsePath)
    ) {
      throw new Error(`learner-iteration persisted response path is invalid for ${attemptId}`);
    }
    if (!persisted.response_sha256 || sha256File(responsePath) !== persisted.response_sha256) {
      throw new Error(`learner-iteration persisted response hash drift for ${attemptId}`);
    }
    if (accepted.has(responsePath)) {
      throw new Error(`learner-iteration response is accepted by more than one attempt: ${responsePath}`);
    }
    accepted.set(responsePath, attemptId);
  }
  return { reservations, accepted };
}

function readSavedDirectPrefix(armDir, maximumTurn, acceptedResponses) {
  const savedReplies = {};
  let gapFound = false;
  for (let turn = 1; turn <= maximumTurn; turn += 1) {
    for (const speaker of ['learner', 'tutor']) {
      const requestPath = path.join(armDir, `${turn}-${speaker}.request.json`);
      const responsePath = path.join(armDir, `${turn}-${speaker}.response.json`);
      const hasRequest = fs.existsSync(requestPath);
      const hasResponseFile = fs.existsSync(responsePath);
      const hasResponse = hasResponseFile && acceptedResponses.has(path.resolve(responsePath));
      if (hasResponse && !hasRequest)
        throw new Error(`learner-iteration recovery response has no request: ${responsePath}`);
      if (!gapFound && hasRequest && hasResponse) {
        savedReplies[`${turn}-${speaker}`] = {
          source: responsePath,
          request: readJson(requestPath, 'learner-iteration saved request'),
          response: readJson(responsePath, 'learner-iteration saved response'),
        };
        continue;
      }
      if (hasRequest || hasResponseFile) gapFound = true;
      if (gapFound && hasResponse)
        throw new Error(`learner-iteration recovery prefix is not contiguous: ${responsePath}`);
    }
  }
  return savedReplies;
}

function recoveredAssessmentPacket(job, arms, evaluationDir, acceptedResponses) {
  const base = path.join(evaluationDir, `${job.arm}-${job.kind}`);
  const responsePath = `${base}.response.txt`;
  const turnCount = arms.find((arm) => arm.id === job.arm).snapshot.turns.length;
  if (!fs.existsSync(responsePath) || !acceptedResponses.has(path.resolve(responsePath))) return null;
  if (fs.existsSync(`${base}.error.json`)) {
    throw new Error(`learner-iteration completed assessment also has an error record for ${job.arm}/${job.kind}`);
  }
  if (
    !fs.existsSync(`${base}.prompt.txt`) ||
    !fs.existsSync(`${base}.schema.json`) ||
    fs.readFileSync(`${base}.prompt.txt`, 'utf8') !== job.prompt ||
    JSON.stringify(readJson(`${base}.schema.json`, 'learner-iteration saved assessment schema')) !==
      JSON.stringify(job.outputSchema)
  ) {
    throw new Error(`learner-iteration persisted assessment input drift for ${job.arm}/${job.kind}`);
  }
  const response = fs.readFileSync(responsePath, 'utf8');
  if (job.kind.startsWith('quality-')) {
    const raw = parseSplitQualityScore(job.kind.replace('quality-', ''), response, turnCount, job.outputSchema);
    return { type: 'split', arm: job.arm, part: job.kind.replace('quality-', ''), raw };
  }
  const parsed = parseBenchmarkScore(job.kind, response, turnCount, {
    extendedQuality: true,
    allowOneBasedIndices: true,
    outputSchema: job.outputSchema,
  });
  return {
    type: 'score',
    score: {
      arm: job.arm,
      kind: job.kind,
      raw: parsed.parsed,
      scored: normalizeScores(job.kind, parsed.parsed),
      indexNormalization: parsed.indexNormalization || null,
    },
  };
}

function readAssessmentStageRecovery(stage, arms, evaluationDir, acceptedResponses) {
  if (!fs.existsSync(evaluationDir)) return { priorScores: [], priorSplitQualityParts: [], completedPackets: 0 };
  const jobs = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    splitQuality: true,
    assessmentContext: stage.assessmentContext,
    publicSourceContextByArm: sourceContexts(stage, arms),
  });
  const priorScores = [];
  const priorSplitQualityParts = [];
  const splitByArm = new Map();
  for (const job of jobs) {
    const recovered = recoveredAssessmentPacket(job, arms, evaluationDir, acceptedResponses);
    if (!recovered) continue;
    if (recovered.type === 'score') {
      priorScores.push(recovered.score);
      continue;
    }
    splitByArm.set(recovered.arm, {
      ...(splitByArm.get(recovered.arm) || {}),
      [recovered.part]: recovered.raw,
    });
  }
  for (const [arm, parts] of splitByArm) {
    if (parts.summary && parts.turns) {
      const turnCount = arms.find((candidate) => candidate.id === arm).snapshot.turns.length;
      const raw = mergeSplitQualityScores(parts.summary, parts.turns, turnCount);
      priorScores.push({
        arm,
        kind: 'quality',
        raw,
        scored: normalizeScores('quality', raw),
        indexNormalization: null,
      });
      continue;
    }
    for (const part of ['summary', 'turns']) {
      if (parts[part]) priorSplitQualityParts.push({ arm, part, raw: parts[part] });
    }
  }
  return {
    priorScores,
    priorSplitQualityParts,
    completedPackets:
      priorScores.reduce((sum, score) => sum + (score.kind === 'quality' ? 2 : 1), 0) + priorSplitQualityParts.length,
  };
}

export function readLearnerIterationRecovery(plan, sourceDir) {
  if (!sourceDir || !path.isAbsolute(sourceDir)) {
    throw new Error('learner-iteration recovery source must be absolute');
  }
  const source = path.resolve(sourceDir);
  const priorPlan = readJson(path.join(source, 'plan.json'), 'learner-iteration recovery plan');
  if (JSON.stringify(learnerIterationPlanShape(priorPlan)) !== JSON.stringify(learnerIterationPlanShape(plan))) {
    throw new Error('learner-iteration recovery plan drift');
  }
  const events = readJsonLines(path.join(source, 'run-ledger.jsonl'), 'learner-iteration recovery run ledger');
  const launch = events.find((event) => event.type === 'launch_admitted');
  const seal = events.at(-1);
  if (
    launch?.study_id !== plan.id ||
    launch?.spend_cap !== plan.total_attempt_ceiling ||
    seal?.type !== 'run_sealed' ||
    seal.status !== 'technical_failure' ||
    seal.recovery_permitted !== true
  ) {
    throw new Error('learner-iteration recovery requires one sealed technical predecessor');
  }
  const { reservations, accepted: acceptedResponses } = acceptedDurableResponses(events, source);
  const terminalTypes = new Set([
    'attempt_completed',
    'attempt_failed',
    'attempt_cancelled_before_dispatch',
    'attempt_interrupted_after_dispatch',
  ]);
  const terminals = events.filter(
    (event) => terminalTypes.has(event.type) && reservations.some((row) => row.attempt_id === event.attempt_id),
  );
  const sequence = [
    ...plan.development.map((stage) => ({ kind: 'development', stage, arm: stage.arms[0] })),
    ...plan.holdout.arms.map((arm) => ({ kind: 'holdout', stage: plan.holdout, arm })),
  ];
  const completed = [];
  let partial = null;
  let reachedMissing = false;
  for (const target of sequence) {
    const armDir = path.join(source, target.kind, target.arm.id);
    const dialoguePath = path.join(armDir, 'dialogue.json');
    const dialogue = fs.existsSync(dialoguePath) ? readJson(dialoguePath, 'learner-iteration recovery dialogue') : null;
    const expectedResponsePaths = (dialogue?.turns || []).flatMap((turn) =>
      ['learner', 'tutor'].map((speaker) => path.resolve(armDir, `${turn.turn}-${speaker}.response.json`)),
    );
    const dialogueAccepted =
      dialogue &&
      Array.isArray(dialogue.turns) &&
      dialogue.turns.length > 0 &&
      expectedResponsePaths.length === dialogue.turns.length * 2 &&
      expectedResponsePaths.every((responsePath) => acceptedResponses.has(responsePath));
    if (dialogueAccepted) {
      if (partial || reachedMissing)
        throw new Error('learner-iteration completed dialogues are not an execution prefix');
      completed.push({ ...target, sourceDir: armDir });
      continue;
    }
    if (fs.existsSync(armDir)) {
      if (partial || reachedMissing) throw new Error('learner-iteration recovery has more than one partial dialogue');
      const savedReplies = readSavedDirectPrefix(armDir, target.stage.max_exchanges, acceptedResponses);
      partial = { ...target, sourceDir: armDir, savedReplies };
      continue;
    }
    reachedMissing = true;
  }
  const assessment = {
    development: new Map(),
    holdout: { priorScores: [], priorSplitQualityParts: [], completedPackets: 0 },
  };
  const completedDevelopment = completed.filter((target) => target.kind === 'development').length;
  const developmentEvaluationDirs = plan.development.map((stage) =>
    path.join(source, 'development-evaluation', stage.arms[0].id),
  );
  if (completedDevelopment === plan.development.length) {
    const developmentArms = plan.development.map((stage) =>
      readBenchmarkArm({ ...stage.arms[0], path: path.join(source, 'development', stage.arms[0].id, 'dialogue.json') }),
    );
    for (const [index, stage] of plan.development.entries()) {
      assessment.development.set(
        stage.arms[0].id,
        readAssessmentStageRecovery(
          stage,
          [developmentArms[index]],
          path.join(source, 'development-evaluation', stage.arms[0].id),
          acceptedResponses,
        ),
      );
    }
  } else if (developmentEvaluationDirs.some((evaluationDir) => fs.existsSync(evaluationDir))) {
    throw new Error('learner-iteration development assessment appears before both development dialogues');
  }
  const developmentPackets = [...assessment.development.values()].reduce(
    (sum, stage) => sum + stage.completedPackets,
    0,
  );
  const hasHoldoutWork =
    completed.some((target) => target.kind === 'holdout') ||
    partial?.kind === 'holdout' ||
    fs.existsSync(path.join(source, 'holdout-evaluation'));
  if (hasHoldoutWork && developmentPackets !== 10) {
    throw new Error('learner-iteration holdout work appears before development assessment is complete');
  }
  if (completed.length === sequence.length) {
    const holdoutArms = plan.holdout.arms.map((arm) =>
      readBenchmarkArm({ ...arm, path: path.join(source, 'holdout', arm.id, 'dialogue.json') }),
    );
    assessment.holdout = readAssessmentStageRecovery(
      plan.holdout,
      holdoutArms,
      path.join(source, 'holdout-evaluation'),
      acceptedResponses,
    );
  } else if (fs.existsSync(path.join(source, 'holdout-evaluation'))) {
    throw new Error('learner-iteration holdout assessment appears before all holdout dialogues');
  }
  const completedPackets =
    [...assessment.development.values()].reduce((sum, stage) => sum + stage.completedPackets, 0) +
    assessment.holdout.completedPackets;
  const assessmentAttempts = reservations.filter((event) => event.stage === 'assessment').length;
  const responseFreeFailures = assessmentAttempts - completedPackets;
  const failedAttempts = terminals.filter((event) => event.type !== 'attempt_completed').length;
  const generationFailures = failedAttempts - responseFreeFailures;
  if (responseFreeFailures < 0 || generationFailures < 0 || failedAttempts > plan.recovery_attempt_reserve) {
    throw new Error('learner-iteration recovery exceeds the registered response-free reserve');
  }
  return {
    source,
    completed,
    partial,
    priorAttempts: reservations.length,
    failedAttempts,
    assessment,
    completedPackets,
    assessmentAttempts,
    responseFreeFailures,
    generationFailures,
  };
}

function learnerIterationWorkflowUnits(phase, state) {
  if (phase === 'GENERATING') {
    return {
      complete: state.completedDialogues,
      active: state.activeDialogue,
      failed: 0,
      missing: Math.max(0, 5 - state.completedDialogues - state.activeDialogue),
    };
  }
  if (phase === 'AUDITING') {
    return {
      complete: state.completedAssessments,
      active: state.activeAssessment,
      failed: 0,
      missing: Math.max(0, state.plan.assessment_packets - state.completedAssessments - state.activeAssessment),
    };
  }
  if (phase === 'PACKAGING') {
    return { complete: state.packageComplete ? 1 : 0, active: state.packageComplete ? 0 : 1, failed: 0, missing: 0 };
  }
  return { complete: 0, active: 0, failed: 0, missing: 0 };
}

export function createLearnerIterationWorkflowTracker({ plan, outDir, admission, recovery = null, at } = {}) {
  const filePath = path.join(outDir, 'workflow-status.json');
  const statusFilePath = path.join(outDir, 'status.json');
  const predecessorEvents = recovery?.source
    ? readJsonLines(path.join(recovery.source, 'run-ledger.jsonl'), 'learner-iteration predecessor attempt ledger')
    : [];
  const state = {
    plan,
    completedDialogues: recovery?.completed?.length || 0,
    activeDialogue: 0,
    completedAssessments: recovery?.completedPackets || 0,
    activeAssessment: 0,
    priorCompletedCalls: (recovery?.priorAttempts || 0) - (recovery?.failedAttempts || 0),
    priorFailedCalls: recovery?.failedAttempts || 0,
    completedCallFallback: 0,
    failedCallFallback: 0,
    activeCalls: 0,
    packageComplete: false,
    recentUnitDurationsMs: [],
  };
  const currentTerminalCounts = () => {
    if (!admission.ledger_path || !fs.existsSync(admission.ledger_path)) return null;
    const events = readJsonLines(admission.ledger_path, 'learner-iteration workflow attempt ledger');
    return {
      completed: events.filter((event) => event.type === 'attempt_completed').length,
      failed: events.filter((event) =>
        ['attempt_failed', 'attempt_cancelled_before_dispatch', 'attempt_interrupted_after_dispatch'].includes(
          event.type,
        ),
      ).length,
    };
  };
  const calls = () => {
    const current = currentTerminalCounts();
    return {
      completed: state.priorCompletedCalls + (current?.completed ?? state.completedCallFallback),
      failed: state.priorFailedCalls + (current?.failed ?? state.failedCallFallback),
      reserved: admission.studyReserved,
      hard_ceiling: plan.total_attempt_ceiling,
    };
  };
  const startedAt = at || new Date();
  let status = createLongRunningWorkflowStatus({
    workflowId: `${plan.id}-completion`,
    phasePlan: LEARNER_ITERATION_WORKFLOW_PHASES,
    at: startedAt,
    units: learnerIterationWorkflowUnits('GENERATING', state),
    calls: calls(),
    modelActivity: { state: 'inactive', explanation: 'Preflight and recovery verification are local.' },
    nextAction: {
      description: 'Verify the registered plan and preserved recovery evidence.',
      stopping_condition: 'Stop before dispatch if the plan, routes, inputs, or attempt ceiling drift.',
    },
  });
  status = completeLongRunningWorkflowPhase(status, {
    phase: 'PREFLIGHT',
    nextPhase: 'GENERATING',
    at: startedAt,
    startNextImmediately: true,
    units: learnerIterationWorkflowUnits('GENERATING', state),
    calls: calls(),
    modelActivity: { state: 'inactive', explanation: 'Preflight passed; no model call is active.' },
    nextAction: {
      description: 'Generate only dialogue units not already preserved as valid.',
      stopping_condition: 'Stop on substantive failure or the hard attempt ceiling.',
    },
  });
  if (recovery) {
    status = recordLongRunningWorkflowRecovery(status, {
      at: startedAt,
      operation: 'Continue the registered learner-iteration study from preserved evidence.',
      reason: 'A sealed technical predecessor stopped before every registered unit was complete.',
      scope: 'Reuse valid dialogues and assessments; run only missing work under the unchanged ceiling.',
      modelActivity: status.model_activity,
    });
  }
  let durableStatus = null;
  const projectDurableStatus = () => {
    const currentEvents =
      admission.ledger_path && fs.existsSync(admission.ledger_path)
        ? readJsonLines(admission.ledger_path, 'learner-iteration current attempt ledger')
        : [];
    const events = [...predecessorEvents, ...currentEvents];
    const unitIds = new Set(
      events
        .filter((event) => event.type === 'model_attempt_dispatch_reserved')
        .map((event) => event.unit_id)
        .filter(Boolean),
    );
    const generationUnitIds = new Set([...unitIds].filter((unitId) => unitId.startsWith('generation/')));
    const complete = status.current_phase === 'WORKFLOW_COMPLETE';
    const generationOpen = status.current_phase === 'GENERATING';
    const plannedTurns = generationOpen ? plan.generation_attempt_ceiling : generationUnitIds.size;
    const plannedUnits = complete
      ? new Set(
          events
            .filter((event) => event.type === 'attempt_completed')
            .map((event) => event.unit_id)
            .filter(Boolean),
        ).size
      : plannedTurns + plan.assessment_packets;
    const workflowState = complete ? 'complete' : status.current_phase === 'BLOCKED' ? 'blocked' : 'running';
    durableStatus = buildDurableEvaluationStatus({
      events,
      plannedUnits,
      plannedTurns,
      completedTurns: generationUnitIds.size,
      hardCeiling: plan.total_attempt_ceiling,
      workflowState,
      scientificVerdict: state.packageComplete ? 'descriptive_result_packaged' : 'registered_measurement_pending',
    });
    if (
      workflowState === 'complete' &&
      (durableStatus.planes.attempt.active !== 0 ||
        durableStatus.planes.attempt.unexplained !== 0 ||
        durableStatus.planes.unit.active !== 0 ||
        durableStatus.planes.unit.missing !== 0)
    ) {
      throw new Error('learner-iteration cannot complete with active, unexplained, or missing current work');
    }
    writeJsonAtomic(statusFilePath, durableStatus);
    return durableStatus;
  };
  const persist = () => {
    writeLongRunningWorkflowStatusAtomic(filePath, status);
    projectDurableStatus();
    return status;
  };
  const refresh = ({ modelActivity, durationMs, nextAction } = {}) => {
    if (Number.isFinite(durationMs) && durationMs > 0) {
      state.recentUnitDurationsMs = [...state.recentUnitDurationsMs, durationMs].slice(-8);
    }
    status = updateLongRunningWorkflowProgress(status, {
      units: learnerIterationWorkflowUnits(status.current_phase, state),
      calls: calls(),
      recentUnitDurationsMs: state.recentUnitDurationsMs,
      ...(modelActivity ? { modelActivity } : {}),
      ...(nextAction ? { nextAction } : {}),
    });
    return persist();
  };
  persist();
  return {
    filePath,
    statusFilePath,
    snapshot: () => structuredClone(status),
    durableSnapshot: () => structuredClone(durableStatus),
    dialogueStarted() {
      state.activeDialogue = 1;
      return refresh({ modelActivity: { state: 'active', explanation: 'One registered dialogue is running.' } });
    },
    dialogueCompleted(durationMs) {
      state.activeDialogue = 0;
      state.completedDialogues += 1;
      return refresh({
        durationMs,
        modelActivity: { state: 'inactive', explanation: 'The latest dialogue is complete.' },
      });
    },
    attemptStarted({ detail }) {
      state.activeCalls += 1;
      if (detail.stage === 'assessment') state.activeAssessment = 1;
      return refresh({ modelActivity: { state: 'active', explanation: 'One registered model call is in flight.' } });
    },
    attemptCompleted({ detail, durationMs }) {
      state.activeCalls = Math.max(0, state.activeCalls - 1);
      state.completedCallFallback += 1;
      if (detail.stage === 'assessment') {
        state.activeAssessment = 0;
        state.completedAssessments += 1;
      }
      return refresh({
        durationMs: detail.stage === 'assessment' ? durationMs : undefined,
        modelActivity: { state: 'inactive', explanation: 'The latest model call completed.' },
      });
    },
    attemptFailed({ detail, error }) {
      state.activeCalls = Math.max(0, state.activeCalls - 1);
      state.failedCallFallback += 1;
      if (detail.stage === 'assessment') state.activeAssessment = 0;
      return refresh({
        modelActivity: { state: 'inactive', explanation: 'The latest model call failed.' },
        nextAction: {
          description: `Use only bounded technical recovery: ${error?.message || 'model call failed'}`,
          stopping_condition: 'Stop if the failure is substantive or recovery would change the study.',
        },
      });
    },
    generationCompleted() {
      if (state.completedDialogues !== 5 || state.activeDialogue || state.activeCalls) {
        throw new Error('cannot complete learner-iteration generation before all five dialogues are complete');
      }
      status = completeLongRunningWorkflowPhase(status, {
        phase: 'GENERATING',
        nextPhase: 'AUDITING',
        startNextImmediately: true,
        units: learnerIterationWorkflowUnits('AUDITING', state),
        calls: calls(),
        modelActivity: { state: 'inactive', explanation: 'All five dialogues are complete.' },
        nextAction: {
          description: 'Assess only packets not already preserved as valid.',
          stopping_condition: 'Stop on substantive judgment failure or after all 25 packets are valid.',
        },
      });
      state.recentUnitDurationsMs = [];
      return persist();
    },
    assessmentCompleted() {
      if (state.completedAssessments !== plan.assessment_packets || state.activeAssessment || state.activeCalls) {
        throw new Error('cannot complete learner-iteration assessment before all 25 packets are valid');
      }
      status = completeLongRunningWorkflowPhase(status, {
        phase: 'AUDITING',
        nextPhase: 'PACKAGING',
        startNextImmediately: true,
        units: learnerIterationWorkflowUnits('PACKAGING', state),
        calls: calls(),
        modelActivity: { state: 'inactive', explanation: 'Assessment is complete; packaging is zero-call.' },
        nextAction: {
          description: 'Build reports and seal the run.',
          stopping_condition: 'Stop after reports, completion record, and run seal are written.',
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
        calls: calls(),
        modelActivity: { state: 'inactive', explanation: 'The study is sealed; no model-backed phase remains.' },
        nextAction: {
          description: 'Preserve the completed private archive.',
          stopping_condition: 'Stop unless a separately scoped follow-up is requested.',
        },
      });
      return persist();
    },
    blocked(error) {
      state.activeDialogue = 0;
      state.activeAssessment = 0;
      state.activeCalls = 0;
      status = blockLongRunningWorkflow(status, {
        blockedPhase: status.current_phase,
        operation: 'Run the current registered learner-iteration phase.',
        error: error?.message || String(error),
        units: learnerIterationWorkflowUnits(status.current_phase, state),
        calls: calls(),
        modelActivity: { state: 'inactive', explanation: 'The runner stopped; no model call remains active.' },
        nextAction: {
          description: 'Inspect the preserved failure and recover only if technically eligible.',
          stopping_condition: 'Stop before changing scientific inputs or rerunning valid work.',
        },
        humanActionRequired: false,
      });
      return persist();
    },
  };
}

function syntheticArm(plan, arm) {
  let releasedPremiseIds = [];
  const turns = [];
  for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
    const proof = buildContinuityProofPlan({ plan, turn, releasedPremiseIds });
    releasedPremiseIds = [...releasedPremiseIds, ...proof.requiredReleases.map((row) => row.premise)];
    turns.push({
      turn,
      learner: `Synthetic ${arm.label} turn ${turn}; fixture, not model output.`,
      tutor: proof.sources.map((source) => source.text).join(' ') || `Synthetic Sol tutor turn ${turn}.`,
    });
  }
  return {
    ...arm,
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

function sourceContexts(plan, arms) {
  return Object.fromEntries(arms.map((arm) => [arm.id, investedRivalDeliveredSourceContext(plan, arm)]));
}

function renderStage({ plan, arms, evaluation, provenance, outDir, name, mock = false }) {
  const result = {
    arms,
    evaluation,
    provenance,
    characterBrief: plan.characterBrief,
    proofControl: true,
    comparisonLabel: name === 'development' ? 'Engineering development' : 'Frozen held-out comparison',
    corrections:
      name === 'development'
        ? [
            'Both mechanisms were fixed before launch; the active-progression mechanism carries forward regardless of development scores.',
            'Development uses Luna only and is not evidence of a model-family difference.',
            'The learner sees a behavior scaffold, not the rubric, hidden answer, future evidence or another transcript.',
          ]
        : [
            'The active-progression learner mechanism was frozen before the held-out scene was generated.',
            'Luna, normal Qwen and abliterated Qwen receive the same character, public world, Sol tutor and no-superego architecture.',
            'One dialogue per model is bounded engineering evidence, not a general ranking or a causal abliteration estimate.',
          ],
    reportMeta: plan.reportMeta,
    mock,
  };
  writeJson(path.join(outDir, `${name}${mock ? '-preview' : ''}-report-data.json`), result);
  const rendered = renderContinuityReport(result);
  fs.writeFileSync(
    path.join(outDir, `${name === 'holdout' ? 'report' : name + '-report'}${mock ? '-preview' : ''}.html`),
    rendered.html,
    {
      flag: 'wx',
    },
  );
  writeJson(path.join(outDir, `${name}${mock ? '-preview' : ''}-public-dialogues.json`), rendered.interchange);
}

function proofPreflight(plan) {
  const rows = [];
  let releasedPremiseIds = [];
  for (let turn = 1; turn <= plan.max_exchanges; turn += 1) {
    const request = buildContinuityRequest({
      plan,
      speaker: 'tutor',
      turn,
      history: [{ role: 'assistant', content: plan.world.opening_frame.authored_text }],
      releasedPremiseIds,
    });
    rows.push(request);
    releasedPremiseIds = [...releasedPremiseIds, ...request.proofPlan.requiredReleases.map((row) => row.premise)];
  }
  return rows;
}

async function dryRun(plan, outDir) {
  if (fs.existsSync(outDir)) throw new Error('dry-run destination is create-once');
  fs.mkdirSync(outDir, { recursive: true });
  const developmentArms = plan.development.map((stage) => syntheticArm(stage, stage.arms[0]));
  const holdoutArms = plan.holdout.arms.map((arm) => syntheticArm(plan.holdout, arm));
  const developmentJobs = plan.development.flatMap((stage, index) =>
    buildBenchmarkJobs([developmentArms[index]], {
      extendedQuality: true,
      splitQuality: true,
      assessmentContext: stage.assessmentContext,
      publicSourceContextByArm: sourceContexts(stage, [developmentArms[index]]),
    }),
  );
  const holdoutJobs = buildBenchmarkJobs(holdoutArms, {
    extendedQuality: true,
    splitQuality: true,
    assessmentContext: plan.holdout.assessmentContext,
    publicSourceContextByArm: sourceContexts(plan.holdout, holdoutArms),
  });
  if (developmentJobs.length !== 10 || holdoutJobs.length !== 15) {
    throw new Error('learner-iteration assessment packet count drift');
  }
  writeJson(path.join(outDir, 'preflight.json'), {
    modelCalls: 0,
    totalAttemptCeiling: plan.total_attempt_ceiling,
    generationAttemptCeiling: plan.generation_attempt_ceiling,
    developmentPackets: developmentJobs,
    holdoutPackets: holdoutJobs,
    developmentLearnerRequests: plan.development.map((stage) =>
      buildContinuityRequest({
        plan: stage,
        speaker: 'learner',
        turn: 1,
        history: [{ role: 'assistant', content: stage.world.opening_frame.authored_text }],
      }),
    ),
    developmentTutorRequests: plan.development.map(proofPreflight),
    holdoutLearnerRequest: buildContinuityRequest({
      plan: plan.holdout,
      speaker: 'learner',
      turn: 1,
      history: [{ role: 'assistant', content: plan.holdout.world.opening_frame.authored_text }],
    }),
    holdoutTutorRequests: proofPreflight(plan.holdout),
  });
  const syntheticProvenance = {
    studyId: plan.id,
    totalAttemptCeiling: plan.total_attempt_ceiling,
    budget: { used: 0, limit: plan.total_attempt_ceiling },
    synthetic: true,
  };
  renderStage({
    plan: plan.development[1],
    arms: developmentArms,
    evaluation: { scores: [], attemptsUsed: 0, plannedAssessmentPackets: 10 },
    provenance: syntheticProvenance,
    outDir,
    name: 'development',
    mock: true,
  });
  renderStage({
    plan: plan.holdout,
    arms: holdoutArms,
    evaluation: { scores: [], attemptsUsed: 0, plannedAssessmentPackets: 15 },
    provenance: syntheticProvenance,
    outDir,
    name: 'holdout',
    mock: true,
  });
  return { outDir, dryRun: true, modelCalls: 0, developmentPackets: 10, holdoutPackets: 15 };
}

async function runLunaArm(plan, arm, outDir, budget, unitId, savedReplies = {}) {
  const started = Date.now();
  await runContinuityArm({
    plan,
    arm,
    outDir,
    budget: budget.scope(unitId),
    callModel: callLearnerIterationModel,
    savedReplies,
    unsupportedQuotationPolicy: 'drop',
  });
  return readBenchmarkArm({ ...arm, path: path.join(outDir, 'dialogue.json'), wallTimeMs: Date.now() - started });
}

async function scoreStage({
  plan,
  arms,
  outDir,
  judge,
  ceiling,
  durableUnitPrefix,
  priorScores = [],
  priorSplitQualityParts = [],
  priorAttempts = 0,
}) {
  return scoreBenchmarkArms(arms, outDir, {
    ceiling,
    extendedQuality: true,
    splitQuality: true,
    allowOneBasedIndices: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: sourceContexts(plan, arms),
    callJudge: judge,
    durableUnitPrefix,
    priorScores,
    priorSplitQualityParts,
    priorAttempts,
  });
}

function isResponseFreeModelError(error) {
  return error?.code === 'CLI_PROVIDER_RESPONSE_FREE_ERROR' && error.classification === 'response_free_error';
}

async function liveRun(plan, outDir, admission, recovery = null) {
  let workflow;
  const budget = learnerIterationPaidBudget(admission, plan.total_attempt_ceiling, {
    onAttemptStarted: (attempt) => workflow?.attemptStarted(attempt),
    onAttemptCompleted: (attempt) => workflow?.attemptCompleted(attempt),
    onAttemptFailed: (attempt) => workflow?.attemptFailed(attempt),
  });
  const provenance = {
    commit: admission.source.commit,
    tree: admission.source.tree,
    dirty: false,
    detached: true,
    studyId: plan.id,
    totalAttemptCeiling: plan.total_attempt_ceiling,
    generationAttemptMaximum: plan.generation_attempt_ceiling,
    plannedAssessmentPackets: plan.assessment_packets,
    responseFreeRecoveryReserve: plan.recovery_attempt_reserve,
    configuredModels: plan.models,
    authorization: admission.authorization,
    recovery: recovery
      ? {
          source: recovery.source,
          priorAttempts: recovery.priorAttempts,
          completedDialogues: recovery.completed.map((target) => `${target.kind}/${target.arm.id}`),
          reusedReplies: Object.keys(recovery.partial?.savedReplies || {}).length,
          completedAssessmentPackets: recovery.completedPackets,
          priorAssessmentAttempts: recovery.assessmentAttempts,
          priorResponseFreeFailures: recovery.responseFreeFailures,
          priorGenerationFailures: recovery.generationFailures,
        }
      : null,
  };
  try {
    writeJson(path.join(outDir, 'plan.json'), { ...plan, provenance });
    workflow = createLearnerIterationWorkflowTracker({ plan, outDir, admission, recovery });
    fs.mkdirSync(path.join(outDir, 'development'));
    fs.mkdirSync(path.join(outDir, 'holdout'));
    fs.mkdirSync(path.join(outDir, 'development-evaluation'));
    const developmentArms = [];
    for (const stage of plan.development) {
      const arm = stage.arms[0];
      const imported = recovery?.completed.find((target) => target.kind === 'development' && target.arm.id === arm.id);
      const armDir = path.join(outDir, 'development', arm.id);
      if (imported) {
        fs.cpSync(imported.sourceDir, armDir, { recursive: true, errorOnExist: true, force: false });
        developmentArms.push(readBenchmarkArm({ ...arm, path: path.join(armDir, 'dialogue.json') }));
        continue;
      }
      const savedReplies =
        recovery?.partial?.kind === 'development' && recovery.partial.arm.id === arm.id
          ? recovery.partial.savedReplies
          : {};
      const dialogueStartedAt = Date.now();
      workflow.dialogueStarted();
      developmentArms.push(
        await runLunaArm(stage, arm, armDir, budget, `generation/development/${arm.id}`, savedReplies),
      );
      workflow.dialogueCompleted(Date.now() - dialogueStartedAt);
    }
    writeJson(path.join(outDir, 'development-arms.json'), developmentArms);
    const judge = makeLunaJudgeCaller({
      budget,
      outDir,
      maximumResponseFreeRetries: plan.recovery_attempt_reserve - (recovery?.generationFailures || 0),
      priorPhysicalAttempts: recovery?.assessmentAttempts || 0,
      priorResponseFreeRetries: recovery?.responseFreeFailures || 0,
    });
    const developmentScores = [];
    for (const [index, stage] of plan.development.entries()) {
      const evaluation = await scoreStage({
        plan: stage,
        arms: [developmentArms[index]],
        outDir: path.join(outDir, 'development-evaluation', stage.arms[0].id),
        judge,
        ceiling: 5,
        durableUnitPrefix: `assessment/development/${stage.arms[0].id}`,
        priorScores: recovery?.assessment.development.get(stage.arms[0].id)?.priorScores || [],
        priorSplitQualityParts: recovery?.assessment.development.get(stage.arms[0].id)?.priorSplitQualityParts || [],
        priorAttempts: recovery?.assessment.development.get(stage.arms[0].id)?.completedPackets || 0,
      });
      developmentScores.push(...evaluation.scores);
    }
    const developmentEvaluation = {
      scores: developmentScores,
      logicalAssessments: developmentScores.length,
      plannedAssessmentPackets: 10,
      judgeTransport: judge.snapshot(),
    };
    renderStage({
      plan: plan.development[1],
      arms: developmentArms,
      evaluation: developmentEvaluation,
      provenance: { ...provenance, budget: budget.snapshot() },
      outDir,
      name: 'development',
    });

    const holdoutArms = [];
    const lunaImported = recovery?.completed.find((target) => target.kind === 'holdout' && target.arm.id === 'A');
    if (lunaImported) {
      fs.cpSync(lunaImported.sourceDir, path.join(outDir, 'holdout', 'A'), {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
      holdoutArms.push(
        readBenchmarkArm({ ...plan.holdout.arms[0], path: path.join(outDir, 'holdout', 'A', 'dialogue.json') }),
      );
    } else {
      const dialogueStartedAt = Date.now();
      workflow.dialogueStarted();
      holdoutArms.push(
        await runLunaArm(
          plan.holdout,
          plan.holdout.arms[0],
          path.join(outDir, 'holdout', 'A'),
          budget,
          'generation/holdout/A',
          recovery?.partial?.kind === 'holdout' && recovery.partial.arm.id === 'A' ? recovery.partial.savedReplies : {},
        ),
      );
      workflow.dialogueCompleted(Date.now() - dialogueStartedAt);
    }
    const service = yaml.parse(fs.readFileSync(path.join(ROOT, plan.base.service_config), 'utf8'));
    service.workspace.path = plan.base.mtp_chat_root;
    service.timing.jsonl_path = path.join(outDir, 'service-timings.jsonl');
    const servicePath = path.join(outDir, 'service.yaml');
    fs.writeFileSync(servicePath, yaml.stringify(service), { flag: 'wx' });
    for (const arm of plan.holdout.arms.slice(1)) {
      const imported = recovery?.completed.find((target) => target.kind === 'holdout' && target.arm.id === arm.id);
      const armDir = path.join(outDir, 'holdout', arm.id);
      if (imported) {
        fs.cpSync(imported.sourceDir, armDir, { recursive: true, errorOnExist: true, force: false });
        holdoutArms.push(readBenchmarkArm({ ...arm, path: path.join(armDir, 'dialogue.json') }));
        continue;
      }
      const started = Date.now();
      workflow.dialogueStarted();
      let ownsServer = false;
      try {
        await manageServer(plan.base.mtp_chat_root, arm.profile, 'start', servicePath);
        ownsServer = true;
        const loaded = await discoverLoadedModel(plan.base.base_url, { modelIdContains: arm.model });
        const runtimeArm = runtimeServiceArm(service, arm, loaded);
        await runContinuityArm({
          plan: plan.holdout,
          arm: runtimeArm,
          outDir: armDir,
          budget: budget.scope(`generation/holdout/${arm.id}`),
          callModel: callLearnerIterationModel,
          savedReplies:
            recovery?.partial?.kind === 'holdout' && recovery.partial.arm.id === arm.id
              ? recovery.partial.savedReplies
              : {},
          unsupportedQuotationPolicy: 'drop',
        });
      } finally {
        if (ownsServer) await manageServer(plan.base.mtp_chat_root, arm.profile, 'stop', servicePath);
      }
      holdoutArms.push(
        readBenchmarkArm({
          ...arm,
          path: path.join(armDir, 'dialogue.json'),
          wallTimeMs: Date.now() - started,
        }),
      );
      workflow.dialogueCompleted(Date.now() - started);
    }
    workflow.generationCompleted();
    writeJson(path.join(outDir, 'holdout-arms.json'), holdoutArms);
    const holdoutEvaluation = await scoreStage({
      plan: plan.holdout,
      arms: holdoutArms,
      outDir: path.join(outDir, 'holdout-evaluation'),
      judge,
      ceiling: 15,
      durableUnitPrefix: 'assessment/holdout',
      priorScores: recovery?.assessment.holdout.priorScores || [],
      priorSplitQualityParts: recovery?.assessment.holdout.priorSplitQualityParts || [],
      priorAttempts: recovery?.assessment.holdout.completedPackets || 0,
    });
    const finalEvaluation = {
      ...holdoutEvaluation,
      plannedAssessmentPackets: 15,
      judgeTransport: judge.snapshot(),
    };
    workflow.assessmentCompleted();
    const finalProvenance = { ...provenance, budget: budget.snapshot() };
    renderStage({
      plan: plan.holdout,
      arms: holdoutArms,
      evaluation: finalEvaluation,
      provenance: finalProvenance,
      outDir,
      name: 'holdout',
    });
    writeJson(path.join(outDir, 'completed.json'), {
      budget: budget.snapshot(),
      development: developmentArms.map((arm) => ({
        id: arm.id,
        exchanges: arm.snapshot.turns.length,
        disposition: arm.snapshot.disposition,
      })),
      holdout: holdoutArms.map((arm) => ({
        id: arm.id,
        model: arm.model,
        exchanges: arm.snapshot.turns.length,
        disposition: arm.snapshot.disposition,
      })),
      logicalAssessments: developmentScores.length + holdoutEvaluation.scores.length,
      assessmentPackets: 25,
      judgeTransport: judge.snapshot(),
    });
    admission.close({
      type: 'run_sealed',
      status: 'complete',
      completed_dialogues: 5,
      completed_assessments: developmentScores.length + holdoutEvaluation.scores.length,
      reserved_attempts: admission.reserved,
    });
    workflow.packagingCompleted();
    return { outDir, dryRun: false, attempts: budget.snapshot().used, workflowStatus: workflow.filePath };
  } catch (error) {
    if (!fs.existsSync(path.join(outDir, 'stopped.json'))) {
      writeJson(path.join(outDir, 'stopped.json'), { error: error.message, budget: budget.snapshot() });
    }
    const recoveryPermitted = isResponseFreeModelError(error);
    admission.close({
      type: 'run_sealed',
      status: recoveryPermitted ? 'technical_failure' : 'failed',
      error: error.message,
      reserved_attempts: admission.reserved,
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
      output: { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      'launch-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      'study-state-root': { type: 'string' },
      'recovery-from': { type: 'string' },
    },
  });
  const plan = buildLearnerIterationPlan(ROOT, values.config || DEFAULT_CONFIG);
  const outDir = path.resolve(ROOT, values.output || plan.output);
  if (!values.live) return dryRun(plan, outDir);
  if (!values['accept-charges'] || !values['launch-commit'] || !values['go-note-commit'] || !values['go-note-path']) {
    throw new Error('paid launch requires the shared launch arguments');
  }
  const recoveryFrom = values['recovery-from'] ? path.resolve(values['recovery-from']) : null;
  if (recoveryFrom && !values.output)
    throw new Error('learner-iteration recovery requires a fresh --output destination');
  const recovery = recoveryFrom ? readLearnerIterationRecovery(plan, recoveryFrom) : null;
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
  return liveRun(plan, outDir, admission, recovery);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
