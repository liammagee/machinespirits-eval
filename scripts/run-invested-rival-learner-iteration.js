#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'yaml';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
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
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

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

function paidBudget(admission, limit) {
  return {
    reserve(detail = {}) {
      const reservation = admission.reserveModelAttempts(1, detail);
      return { call: reservation.study_reserved, limit, remaining: reservation.remaining };
    },
    snapshot() {
      return { used: admission.studyReserved, limit };
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

async function runLunaArm(plan, arm, outDir, budget) {
  const started = Date.now();
  await runContinuityArm({
    plan,
    arm,
    outDir,
    budget,
    callModel: callLearnerIterationModel,
    unsupportedQuotationPolicy: 'drop',
  });
  return readBenchmarkArm({ ...arm, path: path.join(outDir, 'dialogue.json'), wallTimeMs: Date.now() - started });
}

async function scoreStage({ plan, arms, outDir, judge, ceiling }) {
  return scoreBenchmarkArms(arms, outDir, {
    ceiling,
    extendedQuality: true,
    splitQuality: true,
    allowOneBasedIndices: true,
    assessmentContext: plan.assessmentContext,
    publicSourceContextByArm: sourceContexts(plan, arms),
    callJudge: judge,
  });
}

async function liveRun(plan, outDir, admission) {
  const budget = paidBudget(admission, plan.total_attempt_ceiling);
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
  };
  try {
    writeJson(path.join(outDir, 'plan.json'), { ...plan, provenance });
    fs.mkdirSync(path.join(outDir, 'development'));
    fs.mkdirSync(path.join(outDir, 'holdout'));
    fs.mkdirSync(path.join(outDir, 'development-evaluation'));
    const developmentArms = [];
    for (const stage of plan.development) {
      const arm = stage.arms[0];
      developmentArms.push(await runLunaArm(stage, arm, path.join(outDir, 'development', arm.id), budget));
    }
    writeJson(path.join(outDir, 'development-arms.json'), developmentArms);
    const judge = makeLunaJudgeCaller({
      budget,
      outDir,
      maximumResponseFreeRetries: plan.recovery_attempt_reserve,
    });
    const developmentScores = [];
    for (const [index, stage] of plan.development.entries()) {
      const evaluation = await scoreStage({
        plan: stage,
        arms: [developmentArms[index]],
        outDir: path.join(outDir, 'development-evaluation', stage.arms[0].id),
        judge,
        ceiling: 5,
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
    holdoutArms.push(await runLunaArm(plan.holdout, plan.holdout.arms[0], path.join(outDir, 'holdout', 'A'), budget));
    const service = yaml.parse(fs.readFileSync(path.join(ROOT, plan.base.service_config), 'utf8'));
    service.workspace.path = plan.base.mtp_chat_root;
    service.timing.jsonl_path = path.join(outDir, 'service-timings.jsonl');
    const servicePath = path.join(outDir, 'service.yaml');
    fs.writeFileSync(servicePath, yaml.stringify(service), { flag: 'wx' });
    for (const arm of plan.holdout.arms.slice(1)) {
      const started = Date.now();
      let ownsServer = false;
      try {
        await manageServer(plan.base.mtp_chat_root, arm.profile, 'start', servicePath);
        ownsServer = true;
        const loaded = await discoverLoadedModel(plan.base.base_url, { modelIdContains: arm.model });
        const runtimeArm = runtimeServiceArm(service, arm, loaded);
        await runContinuityArm({
          plan: plan.holdout,
          arm: runtimeArm,
          outDir: path.join(outDir, 'holdout', arm.id),
          budget,
          callModel: callLearnerIterationModel,
          unsupportedQuotationPolicy: 'drop',
        });
      } finally {
        if (ownsServer) await manageServer(plan.base.mtp_chat_root, arm.profile, 'stop', servicePath);
      }
      holdoutArms.push(
        readBenchmarkArm({
          ...arm,
          path: path.join(outDir, 'holdout', arm.id, 'dialogue.json'),
          wallTimeMs: Date.now() - started,
        }),
      );
    }
    writeJson(path.join(outDir, 'holdout-arms.json'), holdoutArms);
    const holdoutEvaluation = await scoreStage({
      plan: plan.holdout,
      arms: holdoutArms,
      outDir: path.join(outDir, 'holdout-evaluation'),
      judge,
      ceiling: 15,
    });
    const finalEvaluation = {
      ...holdoutEvaluation,
      plannedAssessmentPackets: 15,
      judgeTransport: judge.snapshot(),
    };
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
    return { outDir, dryRun: false, attempts: budget.snapshot().used };
  } catch (error) {
    if (!fs.existsSync(path.join(outDir, 'stopped.json'))) {
      writeJson(path.join(outDir, 'stopped.json'), { error: error.message, budget: budget.snapshot() });
    }
    admission.close({
      type: 'run_sealed',
      status: 'failed',
      error: error.message,
      reserved_attempts: admission.reserved,
    });
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
    },
  });
  const plan = buildLearnerIterationPlan(ROOT, values.config || DEFAULT_CONFIG);
  const outDir = path.resolve(ROOT, values.output || plan.output);
  if (!values.live) return dryRun(plan, outDir);
  if (!values['accept-charges'] || !values['launch-commit'] || !values['go-note-commit'] || !values['go-note-path']) {
    throw new Error('paid launch requires the shared launch arguments');
  }
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
  });
  return liveRun(plan, outDir, admission);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
