#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { createDurablePaidModelAttemptBudget } from '../services/durablePaidModelAttemptBudget.js';
import {
  buildContinuityProofPlan,
  buildContinuityRequest,
  callContinuityModel,
  CONTINUITY_OUTPUT_SCHEMA,
  runContinuityArm,
} from '../services/localQwenRefusalContinuity.js';
import { renderContinuityReport } from '../services/localQwenRefusalContinuityReport.js';
import {
  blockLongRunningWorkflow,
  completeLongRunningWorkflowPhase,
  createLongRunningWorkflowStatus,
  recordLongRunningWorkflowRecovery,
  updateLongRunningWorkflowProgress,
  writeLongRunningWorkflowStatusAtomic,
} from '../services/longRunningWorkflowStatus.js';
import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import { plotLint, validateWorld } from '../services/dramaticDerivation/world.js';
import {
  assertCompleteScore,
  benchmarkOutputSchemaIssues,
  buildBenchmarkJobs,
  buildSplitQualityOutputSchema,
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
const DEFAULT_CONFIG = 'config/tutor-stub-local-learners/invested-rival-learner-replication.v1.yaml';
const QUALITY_DIMENSIONS = ['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'];
const VERIFIED_PROVIDER_SCHEMA_RECOVERY = 'verified_response_free_provider_schema_rejection';
const LINKED_COMPLETION_STUDY_SUFFIX = '-linked-completion-v1';
const LEARNER_REPLICATION_WORKFLOW_PHASES = Object.freeze([
  'PREFLIGHT',
  'GENERATING',
  'AUDITING',
  'PACKAGING',
  'WORKFLOW_COMPLETE',
]);

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
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

function reportMeta(report, scene) {
  const values = {
    ...report,
    page_title: `${scene.assessment.scenario_name} · invested-rival replication`,
    headline: `Does active progression help in ${scene.assessment.scenario_name}?`,
    interchange_label: `${scene.assessment.scenario_name} · three matched learner routes`,
  };
  return {
    ...Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key.replace(/_([a-z])/gu, (_match, letter) => letter.toUpperCase()),
        value,
      ]),
    ),
    learnerFamilyLabel: 'learner',
    attemptScopeLabel: 'study attempts used',
    opusAttemptScopeLabel: 'study Opus attempts used',
  };
}

function assessmentContext(config, scene) {
  return {
    scenarioName: requireString(scene.assessment?.scenario_name, 'assessment scenario_name'),
    scenarioDescription: requireString(scene.assessment?.scenario_description, 'assessment scenario_description'),
    topic: requireString(scene.assessment?.topic, 'assessment topic'),
    profileId: requireString(scene.assessment?.profile_id, 'assessment profile_id'),
    characterBrief: characterBrief(scene.character),
    expectedBehavior: requireString(scene.assessment?.expected_behavior, 'assessment expected_behavior'),
    qualityInstructions: requireString(config.assessment?.quality_instructions, 'quality instructions'),
  };
}

function loadSceneWorld(root, worldPath) {
  const raw = yaml.parse(fs.readFileSync(path.resolve(root, worldPath), 'utf8'));
  const lint = plotLint(validateWorld(raw));
  if (!lint.ok) throw new Error(`proof world invalid: ${lint.errors.join('; ')}`);
  return { ...raw, releaseSchedule: raw.release_schedule };
}

function roleRelative(text, learnerName) {
  return requireString(text, 'base learner instruction').replace(/\bAlex\b/gu, learnerName);
}

function addInstruction(base, addition, label) {
  if (addition == null) return base;
  return `${base}\n\n${requireString(addition, label)}`;
}

function directArms(config, mechanism) {
  const suffix = mechanism === 'baseline' ? '0' : '1';
  const mechanismLabel = config.mechanisms[mechanism].label;
  return [
    {
      id: `L${suffix}`,
      route: 'luna',
      mechanism,
      label: `Luna · ${mechanismLabel}`,
      displayLabel: `Luna · ${mechanismLabel}`,
      variant: 'luna',
      mode: 'direct',
      tutorMode: 'direct',
      profile: 'codex',
      provider: 'codex',
      model: config.models.learner_luna,
    },
    {
      id: `N${suffix}`,
      route: 'qwen_normal',
      mechanism,
      label: `Normal Qwen · ${mechanismLabel}`,
      displayLabel: `Normal Qwen · ${mechanismLabel}`,
      variant: 'normal',
      mode: 'direct',
      tutorMode: 'direct',
      profile: 'regular',
      provider: 'mlx-local',
      model: config.models.learner_qwen_normal,
    },
    {
      id: `A${suffix}`,
      route: 'qwen_abliterated',
      mechanism,
      label: `Abliterated Qwen · ${mechanismLabel}`,
      displayLabel: `Abliterated Qwen · ${mechanismLabel}`,
      variant: 'abliterated',
      mode: 'direct',
      tutorMode: 'direct',
      profile: 'uncensored',
      provider: 'mlx-local',
      model: config.models.learner_qwen_abliterated,
    },
  ];
}

function buildCondition({ base, config, root, scene, mechanism }) {
  const selected = config.mechanisms[mechanism];
  const learnerName = requireString(scene.character?.name, 'character name');
  const world = loadSceneWorld(root, scene.world);
  return {
    ...base,
    id: `${config.id}-${scene.key}-${mechanism}`,
    design: config.design,
    output: config.output,
    total_attempt_ceiling: config.total_attempt_ceiling,
    recovery_attempt_reserve: config.response_free_recovery_reserve,
    generationCap: directArms(config, mechanism).length * base.max_exchanges * 2,
    judge_calls: directArms(config, mechanism).length * 5,
    seed: config.generation_seed,
    temperature: config.temperature,
    world,
    character: scene.character,
    characterBrief: characterBrief(scene.character),
    interaction: {
      ...base.interaction,
      learnerName,
      learnerSystem: addInstruction(
        roleRelative(base.interaction.learnerSystem, learnerName),
        selected.system_append,
        `${mechanism} system_append`,
      ),
      learnerTurn: addInstruction(
        roleRelative(base.interaction.learnerTurn, learnerName),
        selected.turn_prompt,
        `${mechanism} turn_prompt`,
      ),
    },
    tutor: requireString(scene.tutor, 'scene tutor'),
    arms: directArms(config, mechanism),
    assessmentContext: assessmentContext(config, scene),
    reportMeta: reportMeta(config.report, scene),
  };
}

export function buildLearnerReplicationPlan(root = ROOT, configPath = DEFAULT_CONFIG) {
  const config = yaml.parse(fs.readFileSync(path.resolve(root, configPath), 'utf8'));
  const base = buildInvestedRivalPlan(root, config.source_config);
  if (
    config.id !== 'invested-rival-learner-replication-v1' ||
    config.total_attempt_ceiling !== 396 ||
    config.generation_attempt_ceiling !== 288 ||
    config.assessment_packets !== 90 ||
    config.response_free_recovery_reserve !== 18 ||
    config.reuse_unused_generation_headroom_for_response_free_recovery !== true ||
    config.generation_attempt_ceiling + config.assessment_packets + config.response_free_recovery_reserve !==
      config.total_attempt_ceiling
  ) {
    throw new Error('learner-replication attempt plan differs from the registered 396-attempt design');
  }
  if (
    config.models.learner_luna !== 'codex.gpt-5.6-luna' ||
    config.models.learner_qwen_normal !== 'mlx-community/Qwen3.8-27B-4bit' ||
    config.models.learner_qwen_abliterated !== 'Qwen3.8-27B-Uncensored-MLX/4-bit' ||
    config.models.tutor !== 'codex.gpt-5.6-sol' ||
    config.models.judge !== 'claude-code.claude-opus-5'
  ) {
    throw new Error('learner-replication model route drift');
  }
  if (config.worlds?.length !== 3 || new Set(config.worlds.map((scene) => scene.key)).size !== 3) {
    throw new Error('learner-replication requires three unique worlds');
  }
  const worlds = config.worlds.map((scene) => ({
    key: scene.key,
    scene,
    conditions: {
      baseline: buildCondition({ base, config, root, scene, mechanism: 'baseline' }),
      active_progression: buildCondition({ base, config, root, scene, mechanism: 'active_progression' }),
    },
  }));
  const worldIds = worlds.map((row) => row.conditions.baseline.world.id);
  if (
    worldIds.join(',') !== 'world_028_larkspur_fridge,world_029_riverside_clinic,world_031_tideway_makerspace' ||
    worlds.some((row) =>
      Object.values(row.conditions).some((condition) =>
        condition.arms.some((arm) => arm.mode !== 'direct' || arm.tutorMode !== 'direct'),
      ),
    )
  ) {
    throw new Error('learner-replication world or no-superego architecture drift');
  }
  const expectedOrder = [
    'larkspur_baseline',
    'larkspur_progression',
    'riverside_progression',
    'riverside_baseline',
    'tideway_baseline',
    'tideway_progression',
  ];
  for (const route of ['luna', 'qwen_normal', 'qwen_abliterated']) {
    if (config.execution_order?.[route]?.join(',') !== expectedOrder.join(',')) {
      throw new Error(`learner-replication ${route} execution order drift`);
    }
  }
  return {
    id: config.id,
    design: config.design,
    output: config.output,
    total_attempt_ceiling: config.total_attempt_ceiling,
    generation_attempt_ceiling: config.generation_attempt_ceiling,
    assessment_packets: config.assessment_packets,
    recovery_attempt_reserve: config.response_free_recovery_reserve,
    reuse_unused_generation_headroom_for_response_free_recovery:
      config.reuse_unused_generation_headroom_for_response_free_recovery,
    generation_seed: config.generation_seed,
    temperature: config.temperature,
    models: config.models,
    executionOrder: config.execution_order,
    base,
    worlds,
  };
}

export function learnerReplicationResponseFreeRecoveryLimit(plan, generationAttempts) {
  if (
    !Number.isSafeInteger(generationAttempts) ||
    generationAttempts < 0 ||
    generationAttempts > plan.generation_attempt_ceiling
  ) {
    throw new Error('learner-replication generation attempt count is invalid');
  }
  if (!plan.reuse_unused_generation_headroom_for_response_free_recovery) {
    return plan.recovery_attempt_reserve;
  }
  const limit = plan.recovery_attempt_reserve + (plan.generation_attempt_ceiling - generationAttempts);
  if (generationAttempts + plan.assessment_packets + limit !== plan.total_attempt_ceiling) {
    throw new Error('learner-replication response-free recovery limit exceeds the study ceiling');
  }
  return limit;
}

export async function callLearnerReplicationModel(args, callCli = callAIWithCliBridge) {
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

export function learnerReplicationPaidBudget(admission, limit, hooks = {}, priorAttemptBase = 0, unitPrefix = null) {
  return createDurablePaidModelAttemptBudget({ admission, limit, hooks, priorAttemptBase, unitPrefix });
}

function learnerReplicationWorkflowUnits(phase, state) {
  if (phase === 'GENERATING') {
    return {
      complete: state.completedDialogues,
      active: state.activeDialogue,
      failed: 0,
      missing: Math.max(0, 18 - state.completedDialogues - state.activeDialogue),
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

export function createLearnerReplicationWorkflowTracker({
  plan,
  outDir,
  admission,
  recovery = null,
  priorAttemptBase = 0,
  at,
} = {}) {
  const filePath = path.join(outDir, 'workflow-status.json');
  const priorFailedCalls = recovery?.assessment?.responseFreeFailures || recovery?.interruptedResponseFreeAttempts || 0;
  const state = {
    plan,
    completedDialogues: recovery?.completed?.length || 0,
    activeDialogue: 0,
    completedAssessments: recovery?.assessment?.completedPackets || 0,
    activeAssessment: 0,
    completedCalls: priorAttemptBase + admission.studyReserved - priorFailedCalls,
    failedCalls: priorFailedCalls,
    activeCalls: 0,
    packageComplete: false,
    recentUnitDurationsMs: [],
  };
  if (state.completedCalls < 0) throw new Error('workflow status has negative completed-call accounting');
  const startedAt = at || new Date();
  const durableTerminalCounts = () => {
    if (!admission.ledger_path || !fs.existsSync(admission.ledger_path)) return null;
    const events = readJsonLines(admission.ledger_path, 'replication workflow attempt ledger');
    return {
      completed: events.filter((event) => event.type === 'attempt_completed').length,
      failed: events.filter((event) =>
        ['attempt_failed', 'attempt_cancelled_before_dispatch', 'attempt_interrupted_after_dispatch'].includes(
          event.type,
        ),
      ).length,
    };
  };
  const baselineCalls = { completed: state.completedCalls, failed: state.failedCalls };
  const callCounts = () => {
    const current = durableTerminalCounts();
    if (!current) {
      return {
        completed: state.completedCalls,
        failed: state.failedCalls,
        reserved: priorAttemptBase + admission.studyReserved,
        hard_ceiling: plan.total_attempt_ceiling,
      };
    }
    return {
      completed: baselineCalls.completed + current.completed,
      failed: baselineCalls.failed + current.failed,
      reserved: priorAttemptBase + admission.studyReserved,
      hard_ceiling: plan.total_attempt_ceiling,
    };
  };
  let status = createLongRunningWorkflowStatus({
    workflowId: `${plan.id}-completion`,
    phasePlan: LEARNER_REPLICATION_WORKFLOW_PHASES,
    at: startedAt,
    units: learnerReplicationWorkflowUnits('GENERATING', state),
    calls: callCounts(),
    modelActivity: {
      state: 'inactive',
      explanation: 'Preflight and recovery-source verification are local and make no model calls.',
    },
    nextAction: {
      description: 'Verify the registered study and preserved recovery evidence.',
      stopping_condition:
        'Stop before dispatch if study admission, recovery evidence, or the remaining ceiling drifts.',
    },
  });
  status = completeLongRunningWorkflowPhase(status, {
    phase: 'PREFLIGHT',
    nextPhase: 'GENERATING',
    at: startedAt,
    startNextImmediately: true,
    units: learnerReplicationWorkflowUnits('GENERATING', state),
    calls: callCounts(),
    modelActivity: {
      state: 'inactive',
      explanation: 'Preflight passed; no dialogue-generation model call is active.',
    },
    nextAction: {
      description: 'Generate only dialogue units not already preserved by the recovery source.',
      stopping_condition: 'Stop on configuration drift, a failed dialogue unit, or the hard call ceiling.',
    },
  });
  if (recovery) {
    status = recordLongRunningWorkflowRecovery(status, {
      at: startedAt,
      operation: 'Continue the registered invested-rival study from preserved evidence.',
      reason: 'A sealed predecessor stopped before all registered assessment packets were complete.',
      scope: 'Reuse every valid dialogue and assessment; run only missing work under the unchanged aggregate ceiling.',
      modelActivity: status.model_activity,
    });
  }

  const persist = () => {
    writeLongRunningWorkflowStatusAtomic(filePath, status);
    return status;
  };
  const refresh = ({ modelActivity, nextAction, durationMs } = {}) => {
    if (Number.isFinite(durationMs) && durationMs > 0) {
      state.recentUnitDurationsMs = [...state.recentUnitDurationsMs, durationMs].slice(-8);
    }
    status = updateLongRunningWorkflowProgress(status, {
      units: learnerReplicationWorkflowUnits(status.current_phase, state),
      calls: callCounts(),
      recentUnitDurationsMs: state.recentUnitDurationsMs,
      ...(modelActivity ? { modelActivity } : {}),
      ...(nextAction ? { nextAction } : {}),
    });
    return persist();
  };

  persist();
  return {
    filePath,
    snapshot: () => structuredClone(status),
    dialogueStarted() {
      state.activeDialogue = 1;
      return refresh({
        modelActivity: { state: 'active', explanation: 'A registered learner-tutor dialogue is running.' },
        nextAction: {
          description: 'Finish the active dialogue without resampling completed turns.',
          stopping_condition: 'Stop after the dialogue completes or its first unrecoverable failure.',
        },
      });
    },
    dialogueCompleted(durationMs) {
      state.activeDialogue = 0;
      state.completedDialogues += 1;
      return refresh({
        durationMs,
        modelActivity: {
          state: 'inactive',
          explanation: 'The latest dialogue is complete; no provider call is active.',
        },
      });
    },
    attemptStarted({ detail }) {
      state.activeCalls += 1;
      if (detail.stage === 'assessment') state.activeAssessment = 1;
      return refresh({
        modelActivity: {
          state: 'active',
          explanation:
            detail.stage === 'assessment'
              ? 'One registered Opus assessment packet is in flight.'
              : 'One registered dialogue model call is in flight.',
        },
      });
    },
    attemptCompleted({ detail, durationMs }) {
      state.activeCalls = Math.max(0, state.activeCalls - 1);
      state.completedCalls += 1;
      if (detail.stage === 'assessment') {
        state.activeAssessment = 0;
        state.completedAssessments += 1;
      }
      return refresh({
        durationMs: detail.stage === 'assessment' ? durationMs : undefined,
        modelActivity: { state: 'inactive', explanation: 'The latest model call returned and no call is in flight.' },
      });
    },
    attemptFailed({ detail, error }) {
      state.activeCalls = Math.max(0, state.activeCalls - 1);
      state.failedCalls += 1;
      if (detail.stage === 'assessment') state.activeAssessment = 0;
      return refresh({
        modelActivity: { state: 'inactive', explanation: 'The latest model call failed and no call is in flight.' },
        nextAction: {
          description: `Apply only the registered bounded retry rule: ${error?.message || 'model call failed'}`,
          stopping_condition: 'Stop if the failure is substantive, repeats beyond the reserve, or changes the study.',
        },
      });
    },
    generationCompleted() {
      if (state.completedDialogues !== 18 || state.activeDialogue || state.activeCalls) {
        throw new Error('cannot complete workflow generation before all 18 dialogues are inactive and complete');
      }
      status = completeLongRunningWorkflowPhase(status, {
        phase: 'GENERATING',
        nextPhase: 'AUDITING',
        startNextImmediately: true,
        units: learnerReplicationWorkflowUnits('AUDITING', state),
        calls: callCounts(),
        recentUnitDurationsMs: [],
        modelActivity: {
          state: 'inactive',
          explanation: 'All 18 dialogues are complete; assessment has not dispatched.',
        },
        nextAction: {
          description: 'Assess only the registered packets not already preserved as valid.',
          stopping_condition: 'Stop on a substantive judgment failure or when all 90 packets are valid.',
        },
      });
      state.recentUnitDurationsMs = [];
      return persist();
    },
    assessmentCompleted() {
      if (state.completedAssessments !== plan.assessment_packets || state.activeAssessment || state.activeCalls) {
        throw new Error('cannot complete workflow assessment before every packet is inactive and valid');
      }
      status = completeLongRunningWorkflowPhase(status, {
        phase: 'AUDITING',
        nextPhase: 'PACKAGING',
        startNextImmediately: true,
        units: learnerReplicationWorkflowUnits('PACKAGING', state),
        calls: callCounts(),
        modelActivity: { state: 'inactive', explanation: 'All assessments are valid; report packaging is zero-call.' },
        nextAction: {
          description: 'Build and verify the combined analysis and local report.',
          stopping_condition: 'Stop after the report, completion record, and run seal are written.',
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
        calls: callCounts(),
        modelActivity: { state: 'inactive', explanation: 'The study is sealed and no model-backed phase remains.' },
        nextAction: {
          description: 'Preserve the completed private archive and inspect the local report.',
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
        operation: 'Run the current registered invested-rival workflow phase.',
        error: error?.message || String(error),
        units: learnerReplicationWorkflowUnits(status.current_phase, state),
        calls: callCounts(),
        modelActivity: { state: 'inactive', explanation: 'The runner stopped and no provider call remains active.' },
        nextAction: {
          description: 'Inspect the preserved failure and use bounded recovery only if it is technically eligible.',
          stopping_condition: 'Stop before changing scientific inputs, rerunning valid work, or exceeding the ceiling.',
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

function combinedArms(world) {
  return ['baseline', 'active_progression'].flatMap((mechanism) => world.conditions[mechanism].arms);
}

function sourceContexts(plan, arms) {
  return Object.fromEntries(arms.map((arm) => [arm.id, investedRivalDeliveredSourceContext(plan, arm)]));
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

function renderWorld({ plan, arms, evaluation, provenance, outDir, mock = false }) {
  const result = {
    arms,
    evaluation,
    provenance,
    characterBrief: plan.characterBrief,
    proofControl: true,
    comparisonLabel: 'Frozen matched mechanism replication',
    corrections: [
      'The original invested-rival prompt and frozen active-progression scaffold are compared within the same world and learner route.',
      'The character, public proof schedule, Sol tutor, seed and assessment are fixed inside each pair.',
      'Model-level means are descriptive; the registered confirmatory contrast is scaffold versus baseline.',
    ],
    reportMeta: plan.reportMeta,
    mock,
  };
  writeJson(path.join(outDir, `report-data${mock ? '-preview' : ''}.json`), result);
  const rendered = renderContinuityReport(result);
  fs.writeFileSync(path.join(outDir, `report${mock ? '-preview' : ''}.html`), rendered.html, { flag: 'wx' });
  writeJson(path.join(outDir, `public-dialogues${mock ? '-preview' : ''}.json`), rendered.interchange);
}

async function dryRun(plan, outDir) {
  if (fs.existsSync(outDir)) throw new Error('dry-run destination is create-once');
  fs.mkdirSync(outDir, { recursive: true });
  const preflight = {
    modelCalls: 0,
    totalAttemptCeiling: plan.total_attempt_ceiling,
    generationAttemptCeiling: plan.generation_attempt_ceiling,
    plannedAssessmentPackets: 0,
    worlds: [],
  };
  for (const world of plan.worlds) {
    const worldDir = path.join(outDir, world.key);
    fs.mkdirSync(worldDir);
    const arms = ['baseline', 'active_progression'].flatMap((mechanism) =>
      world.conditions[mechanism].arms.map((arm) => syntheticArm(world.conditions[mechanism], arm)),
    );
    const planForReport = world.conditions.baseline;
    const jobs = buildBenchmarkJobs(arms, {
      extendedQuality: true,
      splitQuality: true,
      assessmentContext: planForReport.assessmentContext,
      publicSourceContextByArm: sourceContexts(planForReport, arms),
    });
    if (jobs.length !== 30) throw new Error(`${world.key} assessment packet count drift`);
    const learnerRequests = ['baseline', 'active_progression'].flatMap((mechanism) => {
      const condition = world.conditions[mechanism];
      return condition.arms.map((arm) => ({
        arm: arm.id,
        request: buildContinuityRequest({
          plan: condition,
          speaker: 'learner',
          turn: 1,
          history: [{ role: 'assistant', content: condition.world.opening_frame.authored_text }],
        }),
      }));
    });
    const tutorRequests = proofPreflight(planForReport);
    preflight.plannedAssessmentPackets += jobs.length;
    preflight.worlds.push({ key: world.key, jobs, learnerRequests, tutorRequests });
    renderWorld({
      plan: planForReport,
      arms,
      evaluation: { scores: [], attemptsUsed: 0, plannedAssessmentPackets: 30 },
      provenance: {
        studyId: plan.id,
        totalAttemptCeiling: plan.total_attempt_ceiling,
        budget: { used: 0, limit: plan.total_attempt_ceiling },
        synthetic: true,
      },
      outDir: worldDir,
      mock: true,
    });
  }
  if (preflight.plannedAssessmentPackets !== 90) throw new Error('replication packet total drift');
  writeJson(path.join(outDir, 'preflight.json'), preflight);
  return {
    outDir,
    dryRun: true,
    modelCalls: 0,
    dialogues: 18,
    matchedPairs: 9,
    assessmentPackets: preflight.plannedAssessmentPackets,
  };
}

function parseExecutionToken(token) {
  for (const mechanism of ['baseline', 'progression']) {
    const suffix = `_${mechanism}`;
    if (token.endsWith(suffix)) {
      return {
        worldKey: token.slice(0, -suffix.length),
        mechanism: mechanism === 'progression' ? 'active_progression' : mechanism,
      };
    }
  }
  throw new Error(`invalid execution token ${token}`);
}

function executionTarget(plan, route, token) {
  const { worldKey, mechanism } = parseExecutionToken(token);
  const world = plan.worlds.find((candidate) => candidate.key === worldKey);
  const condition = world?.conditions[mechanism];
  const arm = condition?.arms.find((candidate) => candidate.route === route);
  if (!world || !condition || !arm) throw new Error(`execution target missing for ${route}/${token}`);
  return { world, condition, arm, worldKey, mechanism, key: `${worldKey}/${arm.id}` };
}

function recoveryPlanShape(plan) {
  // Transport-recovery allocation is prospective operational policy, not a
  // scientific input; keep it out so sealed dialogues and scores remain reusable.
  return {
    id: plan.id,
    design: plan.design,
    totalAttemptCeiling: plan.total_attempt_ceiling,
    generationAttemptCeiling: plan.generation_attempt_ceiling,
    assessmentPackets: plan.assessment_packets,
    recoveryAttemptReserve: plan.recovery_attempt_reserve,
    seed: plan.generation_seed,
    temperature: plan.temperature,
    models: plan.models,
    executionOrder: plan.executionOrder,
    worlds: plan.worlds.map((world) => ({
      key: world.key,
      conditions: Object.fromEntries(
        Object.entries(world.conditions).map(([mechanism, condition]) => [
          mechanism,
          {
            id: condition.id,
            interaction: condition.interaction,
            arms: condition.arms.map(({ id, route, mechanism: armMechanism, provider, model }) => ({
              id,
              route,
              mechanism: armMechanism,
              provider,
              model,
            })),
          },
        ]),
      ),
    })),
  };
}

function readSavedDirectPrefix(armDir) {
  const savedReplies = {};
  let failedUnit = null;
  let gapFound = false;
  for (let turn = 1; turn <= 8; turn += 1) {
    for (const speaker of ['learner', 'tutor']) {
      const requestPath = path.join(armDir, `${turn}-${speaker}.request.json`);
      const responsePath = path.join(armDir, `${turn}-${speaker}.response.json`);
      const hasRequest = fs.existsSync(requestPath);
      const hasResponse = fs.existsSync(responsePath);
      if (hasResponse && !hasRequest) throw new Error(`recovery response has no request: ${responsePath}`);
      if (!gapFound && hasRequest && hasResponse) {
        savedReplies[`${turn}-${speaker}`] = {
          source: responsePath,
          request: readJson(requestPath, 'saved recovery request'),
          response: readJson(responsePath, 'saved recovery response'),
        };
        continue;
      }
      if (hasRequest && !hasResponse && !failedUnit) failedUnit = { turn, speaker, requestPath };
      if (hasRequest || hasResponse) gapFound = true;
      if (gapFound && hasResponse) throw new Error(`recovery prefix is not contiguous: ${responsePath}`);
    }
  }
  return { savedReplies, failedUnit };
}

function assessmentBatchKey(world, mechanism) {
  return `${world}/${mechanism}`;
}

function readCurrentAssessmentBatch(source, world, mechanism) {
  const evaluationDir = path.join(source, 'worlds', world.key, `evaluation-${mechanism.replaceAll('_', '-')}`);
  const priorScores = [];
  const priorSplitQualityParts = [];
  let completedPackets = 0;
  if (!fs.existsSync(evaluationDir)) {
    return { world: world.key, mechanism, sourceDir: null, priorScores, priorSplitQualityParts, completedPackets };
  }
  const condition = world.conditions[mechanism];
  const arms = condition.arms.map((arm) =>
    readBenchmarkArm({
      ...arm,
      path: path.join(source, 'worlds', world.key, 'dialogues', arm.id, 'dialogue.json'),
    }),
  );
  const jobs = buildBenchmarkJobs(arms, {
    extendedQuality: true,
    splitQuality: true,
    assessmentContext: condition.assessmentContext,
    publicSourceContextByArm: sourceContexts(condition, arms),
  });
  const recoveredPacket = (arm, kind) => {
    const job = jobs.find((candidate) => candidate.arm === arm.id && candidate.kind === kind);
    const base = path.join(evaluationDir, `${arm.id}-${kind}`);
    if (
      !job ||
      !fs.existsSync(`${base}.response.txt`) ||
      !fs.existsSync(`${base}.provider.json`) ||
      !fs.existsSync(`${base}.prompt.txt`) ||
      !fs.existsSync(`${base}.schema.json`) ||
      fs.existsSync(`${base}.error.json`)
    ) {
      return null;
    }
    if (
      fs.readFileSync(`${base}.prompt.txt`, 'utf8') !== job.prompt ||
      JSON.stringify(readJson(`${base}.schema.json`, `${world.key}/${arm.id}/${kind} schema`)) !==
        JSON.stringify(job.outputSchema)
    ) {
      throw new Error(`persisted assessment packet drift for ${world.key}/${mechanism}/${arm.id}/${kind}`);
    }
    const response = fs.readFileSync(`${base}.response.txt`, 'utf8');
    const provider = readJson(`${base}.provider.json`, `${world.key}/${arm.id}/${kind} provider`);
    if (provider.text !== response) {
      throw new Error(`persisted assessment response mismatch for ${world.key}/${mechanism}/${arm.id}/${kind}`);
    }
    const turnCount = arms.find((candidate) => candidate.id === arm.id).snapshot.turns.length;
    if (kind.startsWith('quality-')) {
      return { raw: parseSplitQualityScore(kind.replace('quality-', ''), response, turnCount, job.outputSchema) };
    }
    const parsed = parseBenchmarkScore(kind, response, turnCount, {
      extendedQuality: true,
      allowOneBasedIndices: true,
      outputSchema: job.outputSchema,
    });
    return { raw: parsed.parsed, indexNormalization: parsed.indexNormalization };
  };
  for (const arm of condition.arms) {
    for (const kind of ['tutor', 'learner', 'dialogue']) {
      const file = path.join(evaluationDir, `${arm.id}-${kind}.json`);
      const recovered = fs.existsSync(file)
        ? { raw: readJson(file, `${world.key}/${mechanism}/${arm.id}/${kind}`), indexNormalization: null }
        : recoveredPacket(arm, kind);
      if (!recovered) continue;
      priorScores.push({
        arm: arm.id,
        kind,
        raw: recovered.raw,
        scored: normalizeScores(kind, recovered.raw),
        indexNormalization: recovered.indexNormalization || null,
      });
      completedPackets += 1;
    }
    const qualityFile = path.join(evaluationDir, `${arm.id}-quality.json`);
    if (fs.existsSync(qualityFile)) {
      const raw = readJson(qualityFile, `${world.key}/${mechanism}/${arm.id}/quality`);
      priorScores.push({
        arm: arm.id,
        kind: 'quality',
        raw,
        scored: normalizeScores('quality', raw),
        indexNormalization: null,
      });
      completedPackets += 2;
      continue;
    }
    for (const part of ['summary', 'turns']) {
      const file = path.join(evaluationDir, `${arm.id}-quality-${part}.json`);
      const recovered = fs.existsSync(file)
        ? { raw: readJson(file, `${world.key}/${mechanism}/${arm.id}/quality-${part}`) }
        : recoveredPacket(arm, `quality-${part}`);
      if (!recovered) continue;
      priorSplitQualityParts.push({
        arm: arm.id,
        part,
        raw: recovered.raw,
      });
      completedPackets += 1;
    }
  }
  return {
    world: world.key,
    mechanism,
    sourceDir: evaluationDir,
    priorScores,
    priorSplitQualityParts,
    completedPackets,
  };
}

function mergeAssessmentBatch(seed, current) {
  const scores = new Map();
  const split = new Map();
  const addScore = (score) => {
    const key = `${score.arm}/${score.kind}`;
    const existing = scores.get(key);
    if (existing && JSON.stringify(existing.raw) !== JSON.stringify(score.raw)) {
      throw new Error(`assessment recovery score drift for ${key}`);
    }
    scores.set(key, { ...score, scored: normalizeScores(score.kind, score.raw) });
    if (score.kind === 'quality') {
      split.delete(`${score.arm}/summary`);
      split.delete(`${score.arm}/turns`);
    }
  };
  const addSplit = (entry) => {
    const key = `${entry.arm}/${entry.part}`;
    if (scores.has(`${entry.arm}/quality`)) return;
    const existing = split.get(key);
    if (existing && JSON.stringify(existing.raw) !== JSON.stringify(entry.raw)) {
      throw new Error(`assessment recovery split-score drift for ${key}`);
    }
    split.set(key, entry);
  };
  for (const score of [...(seed?.priorScores || []), ...current.priorScores]) addScore(score);
  for (const entry of [...(seed?.priorSplitQualityParts || []), ...current.priorSplitQualityParts]) addSplit(entry);
  const priorScores = [...scores.values()];
  const priorSplitQualityParts = [...split.values()];
  const completedPackets =
    priorScores.reduce((sum, score) => sum + (score.kind === 'quality' ? 2 : 1), 0) + priorSplitQualityParts.length;
  return {
    world: current.world,
    mechanism: current.mechanism,
    sourceDir: current.sourceDir,
    priorScores,
    priorSplitQualityParts,
    completedPackets,
  };
}

function isResponseFreeAssessmentFailure(row) {
  return (
    row?.status === 'failed' &&
    row.code === 'CLI_PROVIDER_RESPONSE_FREE_ERROR' &&
    row.classification === 'response_free_error' &&
    ['result_error_without_structured_output', 'provider_rejected_invalid_structured_output'].includes(row.reason)
  );
}

function isResponseFreeModelError(error) {
  return (
    error?.code === 'CLI_PROVIDER_RESPONSE_FREE_ERROR' &&
    error.classification === 'response_free_error' &&
    ['result_error_without_structured_output', 'provider_rejected_invalid_structured_output'].includes(error.reason)
  );
}

function readTerminalAssessmentFailures(plan, source) {
  const failures = [];
  for (const world of plan.worlds) {
    for (const mechanism of ['baseline', 'active_progression']) {
      const evaluationDir = path.join(source, 'worlds', world.key, `evaluation-${mechanism.replaceAll('_', '-')}`);
      if (!fs.existsSync(evaluationDir)) continue;
      const condition = world.conditions[mechanism];
      const arms = condition.arms.map((arm) =>
        readBenchmarkArm({
          ...arm,
          path: path.join(source, 'worlds', world.key, 'dialogues', arm.id, 'dialogue.json'),
        }),
      );
      const jobs = buildBenchmarkJobs(arms, {
        extendedQuality: true,
        splitQuality: true,
        assessmentContext: condition.assessmentContext,
        publicSourceContextByArm: sourceContexts(condition, arms),
      });
      const ledgerPath = path.join(evaluationDir, 'judge-ledger.jsonl');
      const judgeEvents = fs.existsSync(ledgerPath)
        ? readJsonLines(ledgerPath, `${world.key}/${mechanism} judge ledger`)
        : [];
      for (const name of fs.readdirSync(evaluationDir).filter((file) => file.endsWith('.error.json'))) {
        const packet = name.replace(/\.error\.json$/u, '');
        const job = jobs.find((candidate) => `${candidate.arm}-${candidate.kind}` === packet);
        if (!job || !['quality-summary', 'quality-turns'].includes(job.kind)) {
          throw new Error(`assessment recovery has an unknown failed packet ${world.key}/${packet}`);
        }
        const base = path.join(evaluationDir, packet);
        const responseFiles = ['provider.json', 'response.txt', 'transport.json'];
        if (
          !fs.existsSync(`${base}.prompt.txt`) ||
          !fs.existsSync(`${base}.schema.json`) ||
          fs.existsSync(`${base}.json`)
        ) {
          throw new Error(`assessment recovery failed packet ${world.key}/${packet} is incomplete or contradictory`);
        }
        const error = readJson(`${base}.error.json`, `${world.key}/${packet} error`);
        const schema = readJson(`${base}.schema.json`, `${world.key}/${packet} schema`);
        const packetEvents = judgeEvents.filter((event) => event.arm === job.arm && event.kind === job.kind);
        const commonEvidenceMatches =
          fs.readFileSync(`${base}.prompt.txt`, 'utf8') === job.prompt &&
          JSON.stringify(schema) === JSON.stringify(job.outputSchema) &&
          packetEvents.length === 2 &&
          packetEvents[0].event === 'reserved' &&
          packetEvents[1].event === 'failed' &&
          packetEvents[1].error === error.message;
        const responseFileCount = responseFiles.filter((suffix) => fs.existsSync(`${base}.${suffix}`)).length;
        if (
          responseFileCount === 0 &&
          commonEvidenceMatches &&
          error.code === 'CLI_PROVIDER_RESPONSE_FREE_ERROR' &&
          error.classification === 'response_free_error' &&
          error.reason === 'result_error_without_structured_output'
        ) {
          failures.push({
            world: world.key,
            mechanism,
            arm: job.arm,
            kind: job.kind,
            error: error.message,
            physicalStatus: 'failed',
          });
          continue;
        }
        if (responseFileCount !== responseFiles.length) {
          throw new Error(`assessment recovery failed packet ${world.key}/${packet} is incomplete or contradictory`);
        }
        const provider = readJson(`${base}.provider.json`, `${world.key}/${packet} provider`);
        const transport = readJson(`${base}.transport.json`, `${world.key}/${packet} transport`);
        const responseText = fs.readFileSync(`${base}.response.txt`, 'utf8').trim();
        const transportEvents = JSON.parse(transport.stdout || 'null');
        const resultEvent = Array.isArray(transportEvents)
          ? transportEvents.findLast((event) => event?.type === 'result')
          : null;
        const structuredCalls = Array.isArray(transportEvents)
          ? transportEvents
              .filter((event) => event?.type === 'assistant')
              .flatMap((event) => event.message?.content || [])
              .filter((block) => block.type === 'tool_use' && block.name === 'StructuredOutput')
          : [];
        const wrapperValues = Object.values(structuredCalls[0]?.input || {});
        const expectedError = `quality ${job.kind.replace('quality-', '')} packet failed its output schema: ${benchmarkOutputSchemaIssues({}, job.outputSchema).slice(0, 8).join(', ')}`;
        if (
          !commonEvidenceMatches ||
          error.message !== expectedError ||
          responseText !== '{}' ||
          provider.text !== '{}' ||
          provider.provider !== 'claude-code' ||
          provider.model !== 'claude-opus-5' ||
          provider.structuredOutputRecovery?.providerValidated !== false ||
          provider.outputProjection?.text !== '{}' ||
          provider.attemptControls?.maxTurns !== 1 ||
          provider.attemptControls?.apiRetries !== 0 ||
          provider.attemptControls?.schemaRetries !== 0 ||
          provider.attemptControls?.observedModelResponses !== 1 ||
          transport.exitCode === 0 ||
          resultEvent?.is_error !== true ||
          resultEvent?.terminal_reason !== 'structured_output_retry_exhausted' ||
          structuredCalls.length !== 1 ||
          wrapperValues.length !== 1 ||
          wrapperValues[0] !== '{}'
        ) {
          throw new Error(
            `assessment recovery failed packet ${world.key}/${packet} is not a response-free provider rejection`,
          );
        }
        failures.push({
          world: world.key,
          mechanism,
          arm: job.arm,
          kind: job.kind,
          error: error.message,
          physicalStatus: 'candidate_returned',
        });
      }
    }
  }
  return failures;
}

function readAssessmentRecovery(
  plan,
  source,
  events,
  seal,
  completed,
  ownReservedAttempts,
  { allowProviderRejectedFailure = false, allowResponseFreeTransportFailure = false } = {},
) {
  const statePath = path.join(source, 'assessment-recovery-state.json');
  const inherited = fs.existsSync(statePath) ? readJson(statePath, 'assessment recovery state') : null;
  if (
    inherited &&
    (inherited.schema !== 'machinespirits.invested-rival-assessment-recovery-state.v1' || inherited.studyId !== plan.id)
  ) {
    throw new Error('assessment recovery state drift');
  }
  const currentBatches = plan.worlds.flatMap((world) =>
    ['baseline', 'active_progression'].map((mechanism) => readCurrentAssessmentBatch(source, world, mechanism)),
  );
  const inheritedByKey = new Map(
    (inherited?.batches || []).map((batch) => [assessmentBatchKey(batch.world, batch.mechanism), batch]),
  );
  const batches = currentBatches.map((current) =>
    mergeAssessmentBatch(inheritedByKey.get(assessmentBatchKey(current.world, current.mechanism)), current),
  );
  for (const batch of batches) {
    const world = plan.worlds.find((candidate) => candidate.key === batch.world);
    const condition = world?.conditions[batch.mechanism];
    if (!condition) throw new Error(`assessment recovery has unknown batch ${batch.world}/${batch.mechanism}`);
    for (const score of batch.priorScores) {
      const arm = condition.arms.find((candidate) => candidate.id === score.arm);
      if (!arm) throw new Error(`assessment recovery has unknown arm ${batch.world}/${score.arm}`);
      const dialogue = readJson(
        path.join(source, 'worlds', batch.world, 'dialogues', arm.id, 'dialogue.json'),
        `${batch.world}/${arm.id} recovery dialogue`,
      );
      assertCompleteScore(score.kind, score.raw, dialogue.turns.length, { extendedQuality: true });
    }
    for (const entry of batch.priorSplitQualityParts) {
      const arm = condition.arms.find((candidate) => candidate.id === entry.arm);
      if (!arm) throw new Error(`assessment recovery has unknown split arm ${batch.world}/${entry.arm}`);
      const dialogue = readJson(
        path.join(source, 'worlds', batch.world, 'dialogues', arm.id, 'dialogue.json'),
        `${batch.world}/${arm.id} recovery dialogue`,
      );
      parseSplitQualityScore(
        entry.part,
        JSON.stringify(entry.raw),
        dialogue.turns.length,
        buildSplitQualityOutputSchema(entry.part, dialogue.turns.length),
      );
    }
  }
  const currentCompletedPackets = currentBatches.reduce((sum, batch) => sum + batch.completedPackets, 0);
  const completedPackets = batches.reduce((sum, batch) => sum + batch.completedPackets, 0);
  if (completedPackets > plan.assessment_packets) throw new Error('assessment recovery has too many completed packets');
  const terminalFailures = readTerminalAssessmentFailures(plan, source);
  const providerRejectedFailures = terminalFailures.filter(
    (failure) => failure.physicalStatus === 'candidate_returned',
  );
  const responseFreeTransportFailures = terminalFailures.filter((failure) => failure.physicalStatus === 'failed');
  if (
    providerRejectedFailures.length !== (allowProviderRejectedFailure ? 1 : 0) ||
    (allowProviderRejectedFailure && providerRejectedFailures[0].error !== seal.error) ||
    responseFreeTransportFailures.length > (allowResponseFreeTransportFailure ? 1 : 0) ||
    responseFreeTransportFailures.some((failure) => failure.error !== seal.error)
  ) {
    throw new Error('assessment recovery provider-rejected failure accounting drift');
  }

  const progressPath = path.join(source, 'progress.jsonl');
  const progress = fs.existsSync(progressPath) ? readJsonLines(progressPath, 'replication recovery progress') : [];
  const isReservation = (event) => ['model_attempt_reserved', 'model_attempt_dispatch_reserved'].includes(event.type);
  const firstAssessmentReservation = events.find((event) => isReservation(event) && event.stage === 'assessment');
  const lastDialogueEvent = progress.findLast((event) => event.type === 'dialogue_complete');
  const generationAttempts =
    inherited?.generationAttempts ??
    (Number.isSafeInteger(firstAssessmentReservation?.study_reserved)
      ? firstAssessmentReservation.study_reserved - 1
      : lastDialogueEvent?.reservedAttempts);
  if (!Number.isSafeInteger(generationAttempts) || generationAttempts < 1) {
    throw new Error('assessment recovery cannot establish the completed generation attempt count');
  }
  const currentAssessmentReservations = events
    .filter((event) => isReservation(event) && event.stage === 'assessment')
    .reduce((sum, event) => sum + Number(event.count || 1), 0);
  const durableAssessmentReservations = events.filter(
    (event) => event.type === 'model_attempt_dispatch_reserved' && event.stage === 'assessment',
  );
  const legacyAssessmentReservations = events.filter(
    (event) => event.type === 'model_attempt_reserved' && event.stage === 'assessment',
  );
  if (durableAssessmentReservations.length && legacyAssessmentReservations.length) {
    throw new Error('assessment recovery mixes legacy and durable reservations in one run');
  }
  const physicalPath = path.join(source, 'assessment-physical-attempts.jsonl');
  const physicalRows = fs.existsSync(physicalPath)
    ? readJsonLines(physicalPath, 'assessment physical-attempt ledger')
    : [];
  const candidateRows = physicalRows.filter((row) => row.status === 'candidate_returned');
  const failedRows = physicalRows.filter((row) => row.status === 'failed');
  if (
    (!durableAssessmentReservations.length &&
      candidateRows.length !== currentCompletedPackets + providerRejectedFailures.length) ||
    (durableAssessmentReservations.length && candidateRows.some((row) => !row.reservation?.attemptId)) ||
    failedRows.some((row) => !isResponseFreeAssessmentFailure(row)) ||
    responseFreeTransportFailures.some(
      (failure) =>
        !failedRows.some(
          (row) =>
            row.role === `local-qwen-benchmark-${failure.kind}` &&
            row.message === failure.error &&
            row.reason === 'result_error_without_structured_output',
        ),
    )
  ) {
    throw new Error('assessment recovery contains an unresolved substantive or mismatched judge result');
  }
  const durableTerminalTypes = new Set([
    'attempt_completed',
    'attempt_failed',
    'attempt_cancelled_before_dispatch',
    'attempt_interrupted_after_dispatch',
  ]);
  const durableTerminals = events.filter(
    (event) =>
      durableTerminalTypes.has(event.type) &&
      durableAssessmentReservations.some((reservation) => reservation.attempt_id === event.attempt_id),
  );
  if (
    durableAssessmentReservations.length &&
    (durableTerminals.length !== durableAssessmentReservations.length ||
      new Set(durableTerminals.map((event) => event.attempt_id)).size !== durableTerminals.length)
  ) {
    throw new Error('assessment recovery has unexplained durable reservations');
  }
  const interruptedAttempts = durableAssessmentReservations.length
    ? durableTerminals.filter((event) =>
        ['attempt_cancelled_before_dispatch', 'attempt_interrupted_after_dispatch'].includes(event.type),
      ).length
    : currentAssessmentReservations - physicalRows.length;
  if (![0, 1].includes(interruptedAttempts)) {
    throw new Error('assessment recovery has ambiguous in-flight attempt accounting');
  }
  const inheritedPhysicalAttempts = Number(inherited?.physicalAttempts || 0);
  const inheritedResponseFreeFailures = Number(inherited?.responseFreeFailures || 0);
  const inferredAggregateAttempts = generationAttempts + inheritedPhysicalAttempts + currentAssessmentReservations;
  const aggregatePriorAttempts = Number.isSafeInteger(seal.study_reserved)
    ? seal.study_reserved
    : inherited
      ? inferredAggregateAttempts
      : ownReservedAttempts;
  if (
    !Number.isSafeInteger(inheritedPhysicalAttempts) ||
    inheritedPhysicalAttempts < 0 ||
    !Number.isSafeInteger(inheritedResponseFreeFailures) ||
    inheritedResponseFreeFailures < 0 ||
    inheritedResponseFreeFailures > inheritedPhysicalAttempts ||
    aggregatePriorAttempts !== inferredAggregateAttempts
  ) {
    throw new Error('assessment recovery aggregate attempt accounting drift');
  }
  const physicalAttempts = aggregatePriorAttempts - generationAttempts;
  const responseFreeFailures = physicalAttempts - completedPackets;
  const responseFreeRecoveryLimit = learnerReplicationResponseFreeRecoveryLimit(plan, generationAttempts);
  if (
    responseFreeFailures !==
      (durableAssessmentReservations.length
        ? inheritedResponseFreeFailures + currentAssessmentReservations - currentCompletedPackets
        : inheritedResponseFreeFailures + failedRows.length + interruptedAttempts + providerRejectedFailures.length) ||
    responseFreeFailures > responseFreeRecoveryLimit ||
    aggregatePriorAttempts +
      (plan.assessment_packets - completedPackets) +
      (responseFreeRecoveryLimit - responseFreeFailures) >
      plan.total_attempt_ceiling
  ) {
    throw new Error('assessment recovery exceeds its preserved packet or retry budget');
  }
  return {
    aggregatePriorAttempts,
    generationAttempts,
    physicalAttempts,
    responseFreeFailures,
    responseFreeRecoveryLimit,
    completedPackets,
    interruptedAttempts,
    providerRejectedFailures,
    responseFreeTransportFailures,
    batches,
  };
}

export function readLearnerReplicationRecovery(plan, sourceDir) {
  if (!sourceDir || !path.isAbsolute(sourceDir)) throw new Error('replication recovery source must be absolute');
  const source = path.resolve(sourceDir);
  const priorPlan = readJson(path.join(source, 'plan.json'), 'replication recovery plan');
  if (JSON.stringify(recoveryPlanShape(priorPlan)) !== JSON.stringify(recoveryPlanShape(plan))) {
    throw new Error('replication recovery plan drift');
  }
  const events = readJsonLines(path.join(source, 'run-ledger.jsonl'), 'replication recovery run ledger');
  const launch = events.find((event) => event.type === 'launch_admitted');
  const seal = events.at(-1);
  const reservations = events.filter((event) =>
    ['model_attempt_reserved', 'model_attempt_dispatch_reserved'].includes(event.type),
  );
  const priorAttempts = reservations.reduce((sum, event) => sum + Number(event.count || 1), 0);
  const ordinaryTechnicalSeal = seal?.status === 'technical_failure' && seal.recovery_permitted === true;
  const potentiallyMisclassifiedProviderSeal = seal?.status === 'failed' && seal.recovery_permitted !== true;
  const linkedPriorAttemptBase =
    launch?.study_id === `${plan.id}${LINKED_COMPLETION_STUDY_SUFFIX}`
      ? Number(priorPlan.provenance?.linkedCompletion?.priorAttemptBase)
      : null;
  const linkedCompletionStudyId = `${plan.id}${LINKED_COMPLETION_STUDY_SUFFIX}`;
  if (
    ![plan.id, linkedCompletionStudyId].includes(launch?.study_id) ||
    launch?.spend_cap !== plan.total_attempt_ceiling ||
    seal?.type !== 'run_sealed' ||
    (!ordinaryTechnicalSeal && !potentiallyMisclassifiedProviderSeal) ||
    seal.reserved_attempts !== priorAttempts
  ) {
    throw new Error('replication recovery requires one sealed technical predecessor');
  }

  const sequence = ['luna', 'qwen_normal', 'qwen_abliterated'].flatMap((route) =>
    plan.executionOrder[route].map((token) => executionTarget(plan, route, token)),
  );
  const completed = [];
  let partial = null;
  let reachedMissing = false;
  let responseCount = 0;
  for (const target of sequence) {
    const armDir = path.join(source, 'worlds', target.world.key, 'dialogues', target.arm.id);
    const dialoguePath = path.join(armDir, 'dialogue.json');
    if (fs.existsSync(dialoguePath)) {
      if (partial || reachedMissing)
        throw new Error('replication recovery completed arms are not a fixed execution prefix');
      const snapshot = readJson(dialoguePath, 'completed recovery dialogue');
      if (!Array.isArray(snapshot.turns) || !snapshot.turns.length)
        throw new Error('completed recovery dialogue is empty');
      const armResponses = fs
        .readdirSync(armDir)
        .filter((name) => /^\d+-(?:learner|tutor)\.response\.json$/u.test(name));
      responseCount += armResponses.length;
      completed.push({ ...target, sourceDir: armDir });
      continue;
    }
    if (fs.existsSync(armDir)) {
      if (partial || reachedMissing) throw new Error('replication recovery has more than one partial arm');
      const prefix = readSavedDirectPrefix(armDir);
      const savedCount = Object.keys(prefix.savedReplies).length;
      if (!savedCount) throw new Error('replication recovery partial arm has no saved response');
      responseCount += savedCount;
      partial = { ...target, sourceDir: armDir, ...prefix };
      continue;
    }
    reachedMissing = true;
  }
  const aggregatePriorAttempts = Number.isSafeInteger(seal.study_reserved) ? seal.study_reserved : priorAttempts;
  if (!partial && completed.length === sequence.length && !reachedMissing) {
    const assessment = readAssessmentRecovery(plan, source, events, seal, completed, priorAttempts, {
      allowProviderRejectedFailure: potentiallyMisclassifiedProviderSeal,
      allowResponseFreeTransportFailure: ordinaryTechnicalSeal,
    });
    return {
      phase: 'assessment',
      source,
      sourceStudyId: launch.study_id,
      linkedPriorAttemptBase,
      priorAttempts: assessment.aggregatePriorAttempts,
      responseCount,
      interruptedResponseFreeAttempts: 0,
      completed,
      partial: null,
      assessment,
      ...(potentiallyMisclassifiedProviderSeal ? { recoveryClassification: VERIFIED_PROVIDER_SCHEMA_RECOVERY } : {}),
    };
  }
  if (potentiallyMisclassifiedProviderSeal) {
    throw new Error('provider-schema recovery is allowed only after all dialogues completed');
  }
  if (!partial) throw new Error('replication recovery requires one interrupted generation arm');
  const interruptedResponseFreeAttempts = priorAttempts - responseCount;
  if (![0, 1].includes(interruptedResponseFreeAttempts)) {
    throw new Error('replication recovery response and reservation accounting drift');
  }
  if (interruptedResponseFreeAttempts === 1 && !partial.failedUnit) {
    throw new Error('replication recovery cannot locate the response-free interrupted unit');
  }
  return {
    phase: 'generation',
    source,
    sourceStudyId: launch.study_id,
    linkedPriorAttemptBase,
    priorAttempts: aggregatePriorAttempts,
    responseCount,
    interruptedResponseFreeAttempts,
    completed,
    partial,
  };
}

export function learnerReplicationLinkedCompletionContract(plan, recovery) {
  if (recovery?.phase !== 'assessment' || recovery.completed?.length !== 18 || !recovery.assessment) {
    throw new Error('linked completion requires all 18 preserved dialogues and an incomplete assessment phase');
  }
  const priorAttemptCount = recovery.priorAttempts;
  const completedPackets = recovery.assessment.completedPackets;
  const priorResponseFreeFailures = recovery.assessment.responseFreeFailures;
  const responseFreeRecoveryLimit = learnerReplicationResponseFreeRecoveryLimit(
    plan,
    recovery.assessment.generationAttempts,
  );
  const missingPackets = plan.assessment_packets - completedPackets;
  const remainingRecoveryReserve = responseFreeRecoveryLimit - priorResponseFreeFailures;
  const remainingAttempts = plan.total_attempt_ceiling - priorAttemptCount;
  const unallocatedAttemptHeadroom = remainingAttempts - missingPackets - remainingRecoveryReserve;
  if (
    !Number.isSafeInteger(priorAttemptCount) ||
    priorAttemptCount < 1 ||
    !Number.isSafeInteger(completedPackets) ||
    completedPackets < 0 ||
    missingPackets < 1 ||
    !Number.isSafeInteger(priorResponseFreeFailures) ||
    priorResponseFreeFailures < 0 ||
    remainingRecoveryReserve < 0 ||
    unallocatedAttemptHeadroom < 0
  ) {
    throw new Error('linked completion attempt accounting does not match the registered study ceiling');
  }
  const studyId = `${plan.id}${LINKED_COMPLETION_STUDY_SUFFIX}`;
  const linkedPredecessor = recovery.sourceStudyId === studyId;
  if (![plan.id, studyId].includes(recovery.sourceStudyId)) {
    throw new Error('linked completion predecessor study identity drift');
  }
  const inheritedBase = Number(recovery.linkedPriorAttemptBase);
  const priorAttemptBase = linkedPredecessor ? inheritedBase : priorAttemptCount;
  if (!Number.isSafeInteger(priorAttemptBase) || priorAttemptBase < 1 || priorAttemptBase > priorAttemptCount) {
    throw new Error('linked completion prior-attempt base is invalid');
  }
  return {
    studyId,
    spendCap: plan.total_attempt_ceiling,
    priorAttemptCount,
    priorAttemptBase,
    completedPackets,
    missingPackets,
    responseFreeRecoveryLimit,
    remainingRecoveryReserve,
    remainingAttempts,
    unallocatedAttemptHeadroom,
    linkedPredecessor,
  };
}

function appendProgress(outDir, value) {
  const event = { at: new Date().toISOString(), ...value };
  fs.appendFileSync(path.join(outDir, 'progress.jsonl'), `${JSON.stringify(event)}\n`);
  console.log(JSON.stringify(event));
}

function writeAssessmentRecoveryState(outDir, plan, assessment) {
  writeJson(path.join(outDir, 'assessment-recovery-state.json'), {
    schema: 'machinespirits.invested-rival-assessment-recovery-state.v1',
    studyId: plan.id,
    generationAttempts: assessment.generationAttempts,
    physicalAttempts: assessment.physicalAttempts,
    responseFreeFailures: assessment.responseFreeFailures,
    completedPackets: assessment.completedPackets,
    batches: assessment.batches.map(({ world, mechanism, priorScores, priorSplitQualityParts, completedPackets }) => ({
      world,
      mechanism,
      priorScores,
      priorSplitQualityParts,
      completedPackets,
    })),
  });
}

function copyAssessmentRecoveryEvidence(outDir, recovery) {
  const evidenceRoot = path.join(outDir, 'reused-assessment-evidence');
  fs.mkdirSync(evidenceRoot);
  for (const name of [
    'plan.json',
    'recovery.json',
    'assessment-recovery-state.json',
    'assessment-physical-attempts.jsonl',
    'progress.jsonl',
    'run-ledger.jsonl',
    'stopped.json',
  ]) {
    const source = path.join(recovery.source, name);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(evidenceRoot, `source-${name}`));
  }
  const inheritedEvidence = path.join(recovery.source, 'reused-assessment-evidence');
  if (fs.existsSync(inheritedEvidence)) {
    fs.cpSync(inheritedEvidence, path.join(evidenceRoot, 'inherited'), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  }
  for (const batch of recovery.assessment.batches) {
    if (!batch.sourceDir) continue;
    const destination = path.join(evidenceRoot, 'worlds', batch.world, batch.mechanism);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(batch.sourceDir, destination, { recursive: true, errorOnExist: true, force: false });
  }
}

export function replicationAssessmentBatches(world, arms) {
  return ['baseline', 'active_progression'].map((mechanism) => {
    const condition = world.conditions[mechanism];
    const armIds = new Set(condition.arms.map((arm) => arm.id));
    const batchArms = arms.filter((arm) => armIds.has(arm.id));
    if (batchArms.length !== 3) throw new Error(`${world.key}/${mechanism} requires exactly three assessment arms`);
    return {
      mechanism,
      condition,
      arms: batchArms,
      packetCeiling: 15,
    };
  });
}

export async function scoreReplicationWorld({ world, arms, worldDir, judge, assessmentRecovery = null }) {
  const batches = replicationAssessmentBatches(world, arms);
  const evaluated = [];
  for (const batch of batches) {
    const prior = assessmentRecovery?.batches.find(
      (candidate) => candidate.world === world.key && candidate.mechanism === batch.mechanism,
    );
    const evaluation = await scoreBenchmarkArms(
      batch.arms,
      path.join(worldDir, `evaluation-${batch.mechanism.replaceAll('_', '-')}`),
      {
        ceiling: batch.packetCeiling,
        extendedQuality: true,
        splitQuality: true,
        allowOneBasedIndices: true,
        assessmentContext: batch.condition.assessmentContext,
        publicSourceContextByArm: sourceContexts(batch.condition, batch.arms),
        callJudge: judge,
        priorScores: prior?.priorScores || [],
        priorSplitQualityParts: prior?.priorSplitQualityParts || [],
        priorAttempts: prior?.completedPackets || 0,
        durableUnitPrefix: `assessment/${world.key}/${batch.mechanism}`,
      },
    );
    evaluated.push({ mechanism: batch.mechanism, evaluation });
  }
  const first = evaluated[0].evaluation;
  return {
    ...first,
    attemptCeiling: evaluated.reduce((sum, batch) => sum + batch.evaluation.attemptCeiling, 0),
    callsCompleted: evaluated.reduce((sum, batch) => sum + batch.evaluation.callsCompleted, 0),
    priorAttempts: evaluated.reduce((sum, batch) => sum + batch.evaluation.priorAttempts, 0),
    newAttempts: evaluated.reduce((sum, batch) => sum + batch.evaluation.newAttempts, 0),
    attemptsUsed: evaluated.reduce((sum, batch) => sum + batch.evaluation.attemptsUsed, 0),
    newPhysicalAttempts: evaluated.reduce((sum, batch) => sum + batch.evaluation.newAttempts, 0),
    plannedAssessmentPackets: 30,
    arms: evaluated.flatMap((batch) => batch.evaluation.arms),
    scores: evaluated.flatMap((batch) => batch.evaluation.scores),
    assessmentBatches: evaluated.map(({ mechanism, evaluation }) => ({
      mechanism,
      packetCeiling: evaluation.attemptCeiling,
      physicalAttempts: evaluation.newAttempts,
      logicalAssessments: evaluation.scores.length,
    })),
    judgeTransport: judge.snapshot(),
  };
}

async function runOneArm({ condition, arm, outDir, budget, unitId, runtimeArm = arm, savedReplies = {} }) {
  const started = Date.now();
  await runContinuityArm({
    plan: condition,
    arm: runtimeArm,
    outDir,
    budget: budget.scope(unitId),
    callModel: callLearnerReplicationModel,
    savedReplies,
    unsupportedQuotationPolicy: 'drop',
  });
  return readBenchmarkArm({ ...arm, path: path.join(outDir, 'dialogue.json'), wallTimeMs: Date.now() - started });
}

function qualityValues(score) {
  if (score.raw?.measurement_indeterminate) {
    throw new Error(
      `semantic assessment indeterminate for ${score.arm}: ${score.raw.indeterminate_reason || 'unspecified'}`,
    );
  }
  const values = Object.fromEntries(
    QUALITY_DIMENSIONS.map((dimension) => [dimension, Number(score.raw?.scores?.[dimension]?.score)]),
  );
  if (Object.values(values).some((value) => !Number.isFinite(value) || value < 1 || value > 5)) {
    throw new Error(`invalid quality score for ${score.arm}`);
  }
  return values;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function analyzeLearnerReplication(plan, worldResults) {
  const routes = [
    { id: 'luna', label: 'Luna', baseline: 'L0', progression: 'L1' },
    { id: 'qwen_normal', label: 'Normal Qwen', baseline: 'N0', progression: 'N1' },
    { id: 'qwen_abliterated', label: 'Abliterated Qwen', baseline: 'A0', progression: 'A1' },
  ];
  const pairs = [];
  for (const world of worldResults) {
    const quality = new Map(
      world.evaluation.scores
        .filter((score) => score.kind === 'quality')
        .map((score) => [score.arm, { score, values: qualityValues(score) }]),
    );
    for (const route of routes) {
      const baseline = quality.get(route.baseline);
      const progression = quality.get(route.progression);
      if (!baseline || !progression) throw new Error(`missing quality pair for ${world.key}/${route.id}`);
      const primaryBaseline = mean([baseline.values.surprise_nonrepetition, baseline.values.character_adherence]);
      const primaryProgression = mean([
        progression.values.surprise_nonrepetition,
        progression.values.character_adherence,
      ]);
      const supportiveBaseline = mean([baseline.values.overall_quality, baseline.values.successful_pedagogy]);
      const supportiveProgression = mean([progression.values.overall_quality, progression.values.successful_pedagogy]);
      const unsupportedAssertions = (progression.score.raw.learner_turns || []).filter(
        (turn) => turn.unsupported_evidence_assertion,
      ).length;
      pairs.push({
        world: world.key,
        route: route.id,
        routeLabel: route.label,
        baseline: baseline.values,
        progression: progression.values,
        primaryBaseline,
        primaryProgression,
        primaryDelta: primaryProgression - primaryBaseline,
        supportiveBaseline,
        supportiveProgression,
        supportiveDelta: supportiveProgression - supportiveBaseline,
        unsupportedAssertions,
      });
    }
  }
  const primaryMeanDelta = mean(pairs.map((pair) => pair.primaryDelta));
  const supportiveMeanDelta = mean(pairs.map((pair) => pair.supportiveDelta));
  const positivePairs = pairs.filter((pair) => pair.primaryDelta > 0).length;
  const nonnegativePairs = pairs.filter((pair) => pair.primaryDelta >= 0).length;
  const routeSummaries = routes.map((route) => {
    const selected = pairs.filter((pair) => pair.route === route.id);
    return {
      route: route.id,
      label: route.label,
      primaryMeanDelta: mean(selected.map((pair) => pair.primaryDelta)),
      supportiveMeanDelta: mean(selected.map((pair) => pair.supportiveDelta)),
    };
  });
  const worldSummaries = plan.worlds.map((world) => {
    const selected = pairs.filter((pair) => pair.world === world.key);
    return {
      world: world.key,
      primaryMeanDelta: mean(selected.map((pair) => pair.primaryDelta)),
      positivePairs: selected.filter((pair) => pair.primaryDelta > 0).length,
    };
  });
  const indeterminateCount = worldResults.reduce(
    (sum, world) =>
      sum +
      world.evaluation.scores.filter((score) => score.kind === 'quality' && score.raw?.measurement_indeterminate)
        .length,
    0,
  );
  const unsupportedAssertions = pairs.reduce((sum, pair) => sum + pair.unsupportedAssertions, 0);
  const positiveRoutes = routeSummaries.filter((route) => route.primaryMeanDelta > 0).length;
  const replicationGate =
    primaryMeanDelta >= 0.5 &&
    nonnegativePairs >= 6 &&
    positivePairs >= 5 &&
    positiveRoutes >= 2 &&
    indeterminateCount === 0 &&
    unsupportedAssertions === 0;
  const paperGate =
    replicationGate &&
    supportiveMeanDelta >= 0.25 &&
    worldSummaries.every((world) => world.positivePairs >= 1 && world.primaryMeanDelta >= 0);
  return {
    schema: 'machinespirits.invested-rival-learner-replication-analysis.v1',
    studyId: plan.id,
    pairs,
    primaryMeanDelta,
    supportiveMeanDelta,
    positivePairs,
    nonnegativePairs,
    positiveRoutes,
    indeterminateCount,
    unsupportedAssertions,
    routeSummaries,
    worldSummaries,
    gates: { replication: replicationGate, mainTextPaper: paperGate },
    claimBoundary:
      'Matched scaffold-versus-baseline evidence for these simulated learners and worlds only; not a model ranking, causal abliteration estimate, human-learning result or deployment claim.',
  };
}

function renderAnalysisMarkdown(analysis) {
  const rows = analysis.pairs
    .map(
      (pair) =>
        `| ${pair.world} | ${pair.routeLabel} | ${pair.primaryBaseline.toFixed(2)} | ${pair.primaryProgression.toFixed(2)} | ${pair.primaryDelta >= 0 ? '+' : ''}${pair.primaryDelta.toFixed(2)} | ${pair.supportiveDelta >= 0 ? '+' : ''}${pair.supportiveDelta.toFixed(2)} |`,
    )
    .join('\n');
  return `# Invested-rival learner replication v1 · private result

Replication gate: **${analysis.gates.replication ? 'PASS' : 'FAIL'}**

Main-text paper gate: **${analysis.gates.mainTextPaper ? 'PASS' : 'FAIL'}**

| World | Learner route | Primary baseline | Primary scaffold | Primary difference | Encounter difference |
|---|---|---:|---:|---:|---:|
${rows}

- Primary mean difference: ${analysis.primaryMeanDelta >= 0 ? '+' : ''}${analysis.primaryMeanDelta.toFixed(2)}
- Supportive encounter mean difference: ${analysis.supportiveMeanDelta >= 0 ? '+' : ''}${analysis.supportiveMeanDelta.toFixed(2)}
- Positive / non-negative pairs: ${analysis.positivePairs} / ${analysis.nonnegativePairs} of 9
- Routes with positive mean difference: ${analysis.positiveRoutes} of 3
- Unsupported scaffold assertions: ${analysis.unsupportedAssertions}
- Indeterminate quality assessments: ${analysis.indeterminateCount}

${analysis.claimBoundary}
`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderIndexHtml(analysis, plan) {
  const rows = analysis.pairs
    .map(
      (pair) =>
        `<tr><td>${escapeHtml(pair.world)}</td><td>${escapeHtml(pair.routeLabel)}</td><td>${pair.primaryBaseline.toFixed(2)}</td><td>${pair.primaryProgression.toFixed(2)}</td><td>${pair.primaryDelta >= 0 ? '+' : ''}${pair.primaryDelta.toFixed(2)}</td><td>${pair.supportiveDelta >= 0 ? '+' : ''}${pair.supportiveDelta.toFixed(2)}</td></tr>`,
    )
    .join('');
  const links = plan.worlds
    .map(
      (world) =>
        `<li><a href="worlds/${escapeHtml(world.key)}/report.html">${escapeHtml(world.scene.assessment.scenario_name)}</a></li>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invested-rival learner replication</title><style>body{font-family:ui-sans-serif,system-ui;margin:0;background:#f3efe7;color:#1f2925}main{max-width:1080px;margin:auto;padding:40px 24px}section{background:#fff;border:1px solid #c9c1b3;border-radius:16px;padding:24px;margin:18px 0}.gates{display:flex;gap:12px;flex-wrap:wrap}.gate{padding:10px 14px;border-radius:999px;background:#ebe5d8}.pass{background:#d8eadb}.fail{background:#f0d3cd}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #ddd}a{color:#175f4c}</style></head><body><main><h1>Invested-rival learner replication</h1><p>Nine matched scaffold/control pairs across three worlds and three learner routes.</p><div class="gates"><span class="gate ${analysis.gates.replication ? 'pass' : 'fail'}">Replication gate: ${analysis.gates.replication ? 'PASS' : 'FAIL'}</span><span class="gate ${analysis.gates.mainTextPaper ? 'pass' : 'fail'}">Main-text paper gate: ${analysis.gates.mainTextPaper ? 'PASS' : 'FAIL'}</span></div><section><h2>Matched results</h2><table><thead><tr><th>World</th><th>Learner</th><th>Baseline</th><th>Scaffold</th><th>Primary Δ</th><th>Encounter Δ</th></tr></thead><tbody>${rows}</tbody></table></section><section><h2>World reports</h2><ul>${links}</ul></section><section><h2>Boundary</h2><p>${escapeHtml(analysis.claimBoundary)}</p></section></main></body></html>`;
}

async function liveRun(plan, outDir, admission, recovery = null, linkedCompletion = null) {
  let workflow;
  const budget = learnerReplicationPaidBudget(
    admission,
    plan.total_attempt_ceiling,
    {
      onAttemptStarted: (attempt) => workflow?.attemptStarted(attempt),
      onAttemptCompleted: (attempt) => workflow?.attemptCompleted(attempt),
      onAttemptFailed: (attempt) => workflow?.attemptFailed(attempt),
    },
    linkedCompletion?.priorAttemptBase || 0,
  );
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
    reuseUnusedGenerationHeadroomForResponseFreeRecovery:
      plan.reuse_unused_generation_headroom_for_response_free_recovery,
    configuredModels: plan.models,
    authorization: admission.authorization,
    linkedCompletion: linkedCompletion
      ? {
          executionStudyId: linkedCompletion.studyId,
          priorAttemptBase: linkedCompletion.priorAttemptBase,
          priorAttemptsPreserved: linkedCompletion.priorAttemptCount,
          completedAssessmentPacketsPreserved: linkedCompletion.completedPackets,
          missingAssessmentPackets: linkedCompletion.missingPackets,
          responseFreeRecoveryLimit: linkedCompletion.responseFreeRecoveryLimit,
          remainingAttempts: linkedCompletion.remainingAttempts,
          remainingResponseFreeReserve: linkedCompletion.remainingRecoveryReserve,
          unallocatedAttemptHeadroom: linkedCompletion.unallocatedAttemptHeadroom,
          linkedPredecessor: linkedCompletion.linkedPredecessor,
        }
      : null,
    recovery: recovery
      ? {
          phase: recovery.phase,
          source: recovery.source,
          priorAttempts: recovery.priorAttempts,
          responseCount: recovery.responseCount,
          interruptedResponseFreeAttempts: recovery.interruptedResponseFreeAttempts,
          completedArms: recovery.completed.map(({ world, arm }) => `${world.key}/${arm.id}`),
          ...(recovery.partial
            ? {
                partialArm: `${recovery.partial.world.key}/${recovery.partial.arm.id}`,
                failedUnit: recovery.partial.failedUnit,
              }
            : {}),
          ...(recovery.assessment
            ? {
                generationAttempts: recovery.assessment.generationAttempts,
                priorAssessmentPhysicalAttempts: recovery.assessment.physicalAttempts,
                priorResponseFreeFailures: recovery.assessment.responseFreeFailures,
                completedAssessmentPackets: recovery.assessment.completedPackets,
                interruptedAssessmentAttempts: recovery.assessment.interruptedAttempts,
                providerRejectedAssessmentFailures: recovery.assessment.providerRejectedFailures,
                responseFreeTransportFailures: recovery.assessment.responseFreeTransportFailures,
              }
            : {}),
        }
      : null,
  };
  const generated = new Map(plan.worlds.map((world) => [world.key, new Map()]));
  try {
    writeJson(path.join(outDir, 'plan.json'), { ...plan, provenance });
    workflow = createLearnerReplicationWorkflowTracker({
      plan,
      outDir,
      admission,
      recovery,
      priorAttemptBase: linkedCompletion?.priorAttemptBase || 0,
    });
    fs.mkdirSync(path.join(outDir, 'worlds'));
    for (const world of plan.worlds) {
      const worldDir = path.join(outDir, 'worlds', world.key);
      fs.mkdirSync(worldDir);
      fs.mkdirSync(path.join(worldDir, 'dialogues'));
    }

    if (recovery) {
      writeJson(path.join(outDir, 'recovery.json'), provenance.recovery);
      if (recovery.assessment) {
        copyAssessmentRecoveryEvidence(outDir, recovery);
        writeAssessmentRecoveryState(outDir, plan, recovery.assessment);
        appendProgress(outDir, {
          type: 'assessment_recovery_started',
          completedPackets: recovery.assessment.completedPackets,
          missingPackets: plan.assessment_packets - recovery.assessment.completedPackets,
          priorPhysicalAttempts: recovery.assessment.physicalAttempts,
          priorResponseFreeFailures: recovery.assessment.responseFreeFailures,
          reservedAttempts: budget.snapshot().used,
        });
      }
      for (const imported of recovery.completed) {
        const dialogueDir = path.join(outDir, 'worlds', imported.world.key, 'dialogues', imported.arm.id);
        fs.cpSync(imported.sourceDir, dialogueDir, { recursive: true, errorOnExist: true, force: false });
        const result = readBenchmarkArm({ ...imported.arm, path: path.join(dialogueDir, 'dialogue.json') });
        generated.get(imported.world.key).set(imported.arm.id, result);
        appendProgress(outDir, {
          type: 'dialogue_reused',
          world: imported.world.key,
          arm: imported.arm.id,
          route: imported.arm.route,
          mechanism: imported.mechanism,
          exchanges: result.snapshot.turns.length,
          newAttempts: 0,
          reservedAttempts: budget.snapshot().used,
        });
      }
    }

    const executeRoute = async (route, service = null) => {
      for (const token of plan.executionOrder[route]) {
        const { world, condition, arm, mechanism, key } = executionTarget(plan, route, token);
        if (generated.get(world.key).has(arm.id)) continue;
        const dialogueDir = path.join(outDir, 'worlds', world.key, 'dialogues', arm.id);
        const savedReplies = recovery?.partial?.key === key ? recovery.partial.savedReplies : {};
        if (Object.keys(savedReplies).length) {
          appendProgress(outDir, {
            type: 'dialogue_recovery_started',
            world: world.key,
            arm: arm.id,
            route,
            mechanism,
            reusedReplies: Object.keys(savedReplies).length,
            failedUnit: recovery.partial.failedUnit,
            reservedAttempts: budget.snapshot().used,
          });
        }
        let runtimeArm = arm;
        if (service) {
          const loaded = await discoverLoadedModel(plan.base.base_url, { modelIdContains: arm.model });
          runtimeArm = runtimeServiceArm(service, arm, loaded);
        }
        const dialogueStartedAt = Date.now();
        workflow.dialogueStarted();
        const result = await runOneArm({
          condition,
          arm,
          outDir: dialogueDir,
          budget,
          unitId: `generation/${key}`,
          runtimeArm,
          savedReplies,
        });
        generated.get(world.key).set(arm.id, result);
        workflow.dialogueCompleted(Date.now() - dialogueStartedAt);
        appendProgress(outDir, {
          type: 'dialogue_complete',
          world: world.key,
          arm: arm.id,
          route,
          mechanism,
          exchanges: result.snapshot.turns.length,
          disposition: result.snapshot.disposition,
          reservedAttempts: budget.snapshot().used,
        });
      }
    };

    await executeRoute('luna');
    const baseService = yaml.parse(fs.readFileSync(path.join(ROOT, plan.base.service_config), 'utf8'));
    baseService.workspace.path = plan.base.mtp_chat_root;
    for (const route of ['qwen_normal', 'qwen_abliterated']) {
      const hasPending = plan.executionOrder[route].some((token) => {
        const target = executionTarget(plan, route, token);
        return !generated.get(target.world.key).has(target.arm.id);
      });
      if (!hasPending) continue;
      const firstWorld = plan.worlds[0];
      const firstArm = firstWorld.conditions.baseline.arms.find((arm) => arm.route === route);
      const service = structuredClone(baseService);
      service.timing.jsonl_path = path.join(outDir, `${route}-service-timings.jsonl`);
      const servicePath = path.join(outDir, `${route}-service.yaml`);
      fs.writeFileSync(servicePath, yaml.stringify(service), { flag: 'wx' });
      let ownsServer = false;
      try {
        await manageServer(plan.base.mtp_chat_root, firstArm.profile, 'start', servicePath);
        ownsServer = true;
        await executeRoute(route, service);
      } finally {
        if (ownsServer) await manageServer(plan.base.mtp_chat_root, firstArm.profile, 'stop', servicePath);
      }
    }

    workflow.generationCompleted();

    const generationAttempts = recovery?.assessment?.generationAttempts ?? budget.snapshot().used;
    const responseFreeRecoveryLimit = learnerReplicationResponseFreeRecoveryLimit(plan, generationAttempts);

    const judge = makeLunaJudgeCaller({
      budget,
      outDir,
      maximumResponseFreeRetries: responseFreeRecoveryLimit,
      priorPhysicalAttempts: recovery?.assessment?.physicalAttempts || 0,
      priorResponseFreeRetries: recovery?.assessment?.responseFreeFailures || 0,
    });
    const worldResults = [];
    for (const world of plan.worlds) {
      const arms = combinedArms(world).map((arm) => generated.get(world.key).get(arm.id));
      if (arms.some((arm) => !arm)) throw new Error(`incomplete generated arm set for ${world.key}`);
      const worldDir = path.join(outDir, 'worlds', world.key);
      writeJson(path.join(worldDir, 'arms.json'), arms);
      const planForReport = world.conditions.baseline;
      const finalEvaluation = await scoreReplicationWorld({
        world,
        arms,
        worldDir,
        judge,
        assessmentRecovery: recovery?.assessment || null,
      });
      renderWorld({
        plan: planForReport,
        arms,
        evaluation: finalEvaluation,
        provenance: { ...provenance, budget: budget.snapshot() },
        outDir: worldDir,
      });
      worldResults.push({ key: world.key, arms, evaluation: finalEvaluation });
      appendProgress(outDir, {
        type: 'world_assessment_complete',
        world: world.key,
        logicalAssessments: finalEvaluation.scores.length,
        judgeTransport: judge.snapshot(),
        reservedAttempts: budget.snapshot().used,
      });
    }

    workflow.assessmentCompleted();

    const analysis = analyzeLearnerReplication(plan, worldResults);
    writeJson(path.join(outDir, 'analysis.json'), analysis);
    fs.writeFileSync(path.join(outDir, 'report.md'), renderAnalysisMarkdown(analysis), { flag: 'wx' });
    fs.writeFileSync(path.join(outDir, 'report.html'), renderIndexHtml(analysis, plan), { flag: 'wx' });
    writeJson(path.join(outDir, 'completed.json'), {
      budget: budget.snapshot(),
      dialogues: worldResults.flatMap((world) =>
        world.arms.map((arm) => ({
          world: world.key,
          id: arm.id,
          route: arm.route,
          mechanism: arm.mechanism,
          model: arm.model,
          exchanges: arm.snapshot.turns.length,
          disposition: arm.snapshot.disposition,
        })),
      ),
      logicalAssessments: worldResults.reduce((sum, world) => sum + world.evaluation.scores.length, 0),
      assessmentPackets: plan.assessment_packets,
      judgeTransport: judge.snapshot(),
      gates: analysis.gates,
      recovery: provenance.recovery,
    });
    admission.close({
      type: 'run_sealed',
      status: 'complete',
      completed_dialogues: 18,
      completed_assessments: 72,
      reserved_attempts: admission.reserved,
      study_reserved: budget.snapshot().used,
      replication_gate: analysis.gates.replication,
      main_text_paper_gate: analysis.gates.mainTextPaper,
    });
    workflow.packagingCompleted();
    return {
      outDir,
      dryRun: false,
      attempts: budget.snapshot().used,
      gates: analysis.gates,
      workflowStatus: workflow.filePath,
    };
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
      output: { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      'launch-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      'study-state-root': { type: 'string' },
      'recovery-from': { type: 'string' },
      'linked-completion': { type: 'boolean', default: false },
    },
  });
  const plan = buildLearnerReplicationPlan(ROOT, values.config || DEFAULT_CONFIG);
  const outDir = path.resolve(ROOT, values.output || plan.output);
  if (!values.live) return dryRun(plan, outDir);
  if (!values['accept-charges'] || !values['launch-commit'] || !values['go-note-commit'] || !values['go-note-path']) {
    throw new Error('paid launch requires the shared launch arguments');
  }
  const recoveryFrom = values['recovery-from'] ? path.resolve(values['recovery-from']) : null;
  if (recoveryFrom && !values.output) throw new Error('replication recovery requires a fresh --output destination');
  const recovery = recoveryFrom ? readLearnerReplicationRecovery(plan, recoveryFrom) : null;
  if (values['linked-completion'] && !recovery) {
    throw new Error('--linked-completion requires --recovery-from');
  }
  const linkedCompletion = values['linked-completion']
    ? learnerReplicationLinkedCompletionContract(plan, recovery)
    : null;
  const admissionRecoveryFrom = linkedCompletion
    ? linkedCompletion.linkedPredecessor
      ? recoveryFrom
      : null
    : recoveryFrom;
  const admission = admitPaidStudyLaunch({
    root: ROOT,
    designPath: plan.design,
    launchCommit: values['launch-commit'],
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
    spendCap: plan.total_attempt_ceiling,
    destination: outDir,
    studyId: linkedCompletion?.studyId || plan.id,
    studyStateRoot: path.resolve(ROOT, values['study-state-root'] || '.tutor-stub-traces/.paid-study-state'),
    ...(admissionRecoveryFrom ? { recoveryFrom: admissionRecoveryFrom } : {}),
    ...(recovery?.recoveryClassification ? { recoveryClassification: recovery.recoveryClassification } : {}),
  });
  if (linkedCompletion) {
    admission.record({
      type: 'linked_completion_admitted',
      predecessor: recoveryFrom,
      prior_attempt_base: linkedCompletion.priorAttemptBase,
      prior_attempts_preserved: linkedCompletion.priorAttemptCount,
      completed_assessment_packets_preserved: linkedCompletion.completedPackets,
      missing_assessment_packets: linkedCompletion.missingPackets,
      response_free_recovery_limit: linkedCompletion.responseFreeRecoveryLimit,
      remaining_attempts: linkedCompletion.remainingAttempts,
      remaining_response_free_reserve: linkedCompletion.remainingRecoveryReserve,
      unallocated_attempt_headroom: linkedCompletion.unallocatedAttemptHeadroom,
      aggregate_attempt_ceiling: plan.total_attempt_ceiling,
    });
  }
  return liveRun(plan, outDir, admission, recovery, linkedCompletion);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
