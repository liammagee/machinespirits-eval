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
const DEFAULT_CONFIG = 'config/tutor-stub-local-learners/invested-rival-learner-replication.v1.yaml';
const QUALITY_DIMENSIONS = ['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'];

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
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
    generation_seed: config.generation_seed,
    temperature: config.temperature,
    models: config.models,
    executionOrder: config.execution_order,
    base,
    worlds,
  };
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

function appendProgress(outDir, value) {
  const event = { at: new Date().toISOString(), ...value };
  fs.appendFileSync(path.join(outDir, 'progress.jsonl'), `${JSON.stringify(event)}\n`);
  console.log(JSON.stringify(event));
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

export async function scoreReplicationWorld({ world, arms, worldDir, judge }) {
  const batches = replicationAssessmentBatches(world, arms);
  const evaluated = [];
  for (const batch of batches) {
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

async function runOneArm({ condition, arm, outDir, budget, runtimeArm = arm }) {
  const started = Date.now();
  await runContinuityArm({
    plan: condition,
    arm: runtimeArm,
    outDir,
    budget,
    callModel: callLearnerReplicationModel,
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
  const generated = new Map(plan.worlds.map((world) => [world.key, new Map()]));
  try {
    writeJson(path.join(outDir, 'plan.json'), { ...plan, provenance });
    fs.mkdirSync(path.join(outDir, 'worlds'));
    for (const world of plan.worlds) {
      const worldDir = path.join(outDir, 'worlds', world.key);
      fs.mkdirSync(worldDir);
      fs.mkdirSync(path.join(worldDir, 'dialogues'));
    }

    const executeRoute = async (route, service = null) => {
      for (const token of plan.executionOrder[route]) {
        const { worldKey, mechanism } = parseExecutionToken(token);
        const world = plan.worlds.find((candidate) => candidate.key === worldKey);
        const condition = world?.conditions[mechanism];
        const arm = condition?.arms.find((candidate) => candidate.route === route);
        if (!world || !condition || !arm) throw new Error(`execution target missing for ${route}/${token}`);
        const dialogueDir = path.join(outDir, 'worlds', world.key, 'dialogues', arm.id);
        let runtimeArm = arm;
        if (service) {
          const loaded = await discoverLoadedModel(plan.base.base_url, { modelIdContains: arm.model });
          runtimeArm = runtimeServiceArm(service, arm, loaded);
        }
        const result = await runOneArm({ condition, arm, outDir: dialogueDir, budget, runtimeArm });
        generated.get(world.key).set(arm.id, result);
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

    const judge = makeLunaJudgeCaller({
      budget,
      outDir,
      maximumResponseFreeRetries: plan.recovery_attempt_reserve,
    });
    const worldResults = [];
    for (const world of plan.worlds) {
      const arms = combinedArms(world).map((arm) => generated.get(world.key).get(arm.id));
      if (arms.some((arm) => !arm)) throw new Error(`incomplete generated arm set for ${world.key}`);
      const worldDir = path.join(outDir, 'worlds', world.key);
      writeJson(path.join(worldDir, 'arms.json'), arms);
      const planForReport = world.conditions.baseline;
      const finalEvaluation = await scoreReplicationWorld({ world, arms, worldDir, judge });
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
    });
    admission.close({
      type: 'run_sealed',
      status: 'complete',
      completed_dialogues: 18,
      completed_assessments: 72,
      reserved_attempts: admission.reserved,
      replication_gate: analysis.gates.replication,
      main_text_paper_gate: analysis.gates.mainTextPaper,
    });
    return { outDir, dryRun: false, attempts: budget.snapshot().used, gates: analysis.gates };
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
  const plan = buildLearnerReplicationPlan(ROOT, values.config || DEFAULT_CONFIG);
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
