/**
 * Instrumentation A/B harness.
 *
 * Runs the same frozen dialogue past two or more instrumentation arms and
 * grades every candidate with one pinned rubric. The public prefix, the learner
 * utterances, the world, and the evidence state are all frozen from a recorded
 * run, so the only thing that varies between arms is how much private planner
 * context the speaking tutor receives.
 *
 * This is a visual and diagnostic instrument, not evidence about human
 * learning. It never regenerates the learner, reruns the classifier or DAG, or
 * continues the dialogue past the recorded turns.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'yaml';

import { callAIWithCliBridge } from './cliProviderBridge.js';
import { loadWorld } from './dramaticDerivation/world.js';
import {
  auditTutorStubFrozenCandidate,
  refreshTutorStubFrozenFirstDraftRequest,
  TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA,
} from './tutorStubFrozenReplay.js';
import { normalizeTokenUsage } from './tokenUsage.js';
import {
  projectTutorStubAbRequest,
  resolveTutorStubAbArm,
  resolveTutorStubAbGuardSet,
  TUTOR_STUB_AB_FEATURE_IDS,
} from './tutorStubAbArms.js';

export const TUTOR_STUB_AB_CONFIG_SCHEMA = 'machinespirits.tutor-stub.ab-config.v1';
export const TUTOR_STUB_AB_PLAN_SCHEMA = 'machinespirits.tutor-stub.ab-plan.v1';
export const TUTOR_STUB_AB_REPORT_SCHEMA = 'machinespirits.tutor-stub.ab-report.v1';

const MODEL_PROVIDERS = new Set(['codex', 'claude-code']);
const TERMINAL_STATUSES = new Set(['complete', 'blocked', 'budget_exhausted']);

/**
 * Frozen-replay invariants. These stay false for the same reason the PR
 * benchmark keeps them false: the moment any of them turns on, the arms stop
 * sharing a prefix and the comparison stops being a comparison.
 */
const REQUIRED_INVARIANTS = Object.freeze([
  'regenerate_prior_dialogue',
  'generate_learner',
  'classify_learner',
  'update_learner_dag',
  'continue_dialogue',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clone(value) {
  return structuredClone(value);
}

function positiveInt(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

function resolveRepoPath(root, relativePath, label) {
  if (!String(relativePath || '').trim() || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be a repository-relative path`);
  }
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} escapes the repository root`);
  return target;
}

export function loadTutorStubAbConfig(configPath) {
  const source = fs.readFileSync(configPath, 'utf8');
  return { config: yaml.parse(source), source, configSha256: sha256(source), configPath: path.resolve(configPath) };
}

export function validateTutorStubAbConfig(config) {
  if (!config || config.schema !== TUTOR_STUB_AB_CONFIG_SCHEMA) {
    throw new Error(`A/B config schema must be ${TUTOR_STUB_AB_CONFIG_SCHEMA}`);
  }
  if (!config.models || !config.arms || !config.scenarios || !config.presets) {
    throw new Error('A/B config requires models, arms, scenarios, and presets');
  }
  for (const [id, model] of Object.entries(config.models)) {
    if (!MODEL_PROVIDERS.has(model?.provider)) throw new Error(`model ${id} must use codex or claude-code`);
    if (!String(model.model || '').trim()) throw new Error(`model ${id} requires model`);
    positiveInt(model.timeout_ms, `model ${id}.timeout_ms`);
  }
  const arms = Object.entries(config.arms).map(([id, definition]) => resolveTutorStubAbArm(id, definition));
  const baselines = arms.filter((arm) => arm.baseline);
  if (baselines.length !== 1) throw new Error('exactly one arm must be marked baseline: true');
  if (baselines[0].features.length !== 0) {
    throw new Error(`baseline arm ${baselines[0].id} must carry no instrumentation features`);
  }
  for (const [id, scenario] of Object.entries(config.scenarios)) {
    if (!String(scenario?.fixture || '').trim()) throw new Error(`scenario ${id} requires fixture`);
    if (scenario.turns !== undefined && scenario.turns !== 'all' && !Array.isArray(scenario.turns)) {
      throw new Error(`scenario ${id}.turns must be "all" or a list of fixture case ids`);
    }
  }
  for (const [id, preset] of Object.entries(config.presets)) {
    for (const key of ['models', 'arms', 'scenarios']) {
      const list = preset?.[key];
      if (!Array.isArray(list) || !list.length) throw new Error(`preset ${id}.${key} must be a non-empty list`);
      for (const entry of list) {
        if (!config[key][entry]) throw new Error(`preset ${id} references unknown ${key.slice(0, -1)} ${entry}`);
      }
    }
  }
  positiveInt(config.budgets?.max_calls, 'budgets.max_calls');
  if (config.budgets?.concurrency !== 1) throw new Error('budgets.concurrency must remain 1');
  if (config.budgets?.retries_per_job !== 0) throw new Error('budgets.retries_per_job must remain 0');
  if (config.rubric?.pin_guards_to_reference !== true) {
    throw new Error('rubric.pin_guards_to_reference must remain true; arms must share one rubric');
  }
  for (const name of REQUIRED_INVARIANTS) {
    if (config.invariants?.[name] !== false) throw new Error(`invariant ${name} must remain false`);
  }
  return { config, arms };
}

function loadScenario({ root, id, definition }) {
  const fixturePath = resolveRepoPath(root, definition.fixture, `scenario ${id}.fixture`);
  const source = fs.readFileSync(fixturePath, 'utf8');
  const fixture = JSON.parse(source);
  if (fixture.schema !== TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA) {
    throw new Error(`scenario ${id} fixture schema must be ${TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA}`);
  }
  const available = fixture.cases || [];
  const wanted = definition.turns === undefined || definition.turns === 'all' ? null : definition.turns.map(String);
  const rows = (wanted ? wanted.map((caseId) => available.find((item) => item.id === caseId)) : available).map(
    (row, index) => {
      if (!row?.bundle) throw new Error(`scenario ${id} has no frozen bundle for row ${wanted?.[index] || index}`);
      return row;
    },
  );
  if (!rows.length) throw new Error(`scenario ${id} selected no turns`);
  const worldIds = [...new Set(rows.map((row) => row.bundle.worldId))];
  if (worldIds.length !== 1) throw new Error(`scenario ${id} spans ${worldIds.length} worlds; expected exactly one`);
  return {
    id,
    label: String(definition.label || id),
    criterion: definition.criterion || null,
    fixture: definition.fixture,
    fixtureSha256: sha256(source),
    worldId: worldIds[0],
    learnerProfile: rows[0].bundle.learnerProfile || null,
    turns: rows
      .map((row) => ({
        caseId: row.id,
        turn: Number(row.bundle.turn),
        learnerText: row.bundle.learnerText,
        recordedTutorText:
          row.bundle.recorded?.finalDelivery?.candidate?.text ||
          row.bundle.recorded?.originalCandidate?.candidate?.text ||
          null,
        referenceGuards: clone(row.bundle.guards || {}),
        bundle: clone(row.bundle),
      }))
      .sort((left, right) => left.turn - right.turn),
  };
}

function worldForId(root, worldId) {
  const worldDir = path.join(root, 'config', 'drama-derivation');
  const matches = fs
    .readdirSync(worldDir)
    .filter((name) => /^world-.*\.yaml$/u.test(name))
    .map((name) => loadWorld(path.join(worldDir, name)))
    .filter((world) => world.id === worldId);
  if (matches.length !== 1) throw new Error(`expected exactly one world for ${worldId}, found ${matches.length}`);
  return matches[0];
}

export function buildTutorStubAbPlan({
  config,
  root,
  preset = 'default',
  arms = null,
  scenarios = null,
  models = null,
  maxCalls = null,
  configSha256 = null,
  featureOverride = null,
  dropOverride = null,
} = {}) {
  const { config: validated, arms: allArms } = validateTutorStubAbConfig(config);
  const selectedPreset = validated.presets[preset];
  if (!selectedPreset) throw new Error(`unknown A/B preset ${preset}`);
  const armIds = [...new Set((arms || selectedPreset.arms).map(String))];
  const scenarioIds = [...new Set((scenarios || selectedPreset.scenarios).map(String))];
  const modelIds = [...new Set((models || selectedPreset.models).map(String))];
  for (const id of armIds) if (!validated.arms[id]) throw new Error(`unknown selected arm ${id}`);
  for (const id of scenarioIds) if (!validated.scenarios[id]) throw new Error(`unknown selected scenario ${id}`);
  for (const id of modelIds) if (!validated.models[id]) throw new Error(`unknown selected model ${id}`);

  // Ad-hoc feature selection. The baseline is never overridden: it is the
  // no-instrumentation reference the other lanes are diffed against, and an
  // override that quietly gave it advisories would make every delta meaningless.
  const resolvedArms = armIds.map((id) => {
    const arm = allArms.find((entry) => entry.id === id);
    if (arm.baseline || (featureOverride === null && dropOverride === null)) return arm;
    return resolveTutorStubAbArm(id, {
      ...validated.arms[id],
      features: featureOverride === null ? validated.arms[id].features : featureOverride,
      drop: dropOverride === null ? validated.arms[id].drop : dropOverride,
    });
  });
  const baselineArm = resolvedArms.find((arm) => arm.baseline);
  if (!baselineArm) throw new Error('selected arms must include the baseline arm');
  const nonBaseline = resolvedArms.filter((arm) => !arm.baseline);
  const signatures = new Set(nonBaseline.map((arm) => arm.features.join('|')));
  if (nonBaseline.length > 1 && signatures.size !== nonBaseline.length) {
    throw new Error('selected arms resolve to duplicate feature sets; a feature override collapsed distinct arms');
  }

  const resolvedScenarios = scenarioIds.map((id) => loadScenario({ root, id, definition: validated.scenarios[id] }));

  const jobs = [];
  for (const scenario of resolvedScenarios) {
    for (const turn of scenario.turns) {
      for (const modelId of modelIds) {
        for (const arm of resolvedArms) {
          jobs.push({
            id: `${scenario.id}__${turn.caseId}__${arm.id}__${modelId}`,
            scenarioId: scenario.id,
            caseId: turn.caseId,
            turn: turn.turn,
            armId: arm.id,
            arm: clone(arm),
            modelId,
            model: clone(validated.models[modelId]),
            worldId: scenario.worldId,
            learnerText: turn.learnerText,
            bundle: clone(turn.bundle),
          });
        }
      }
    }
  }

  const callBudget = maxCalls === null ? validated.budgets.max_calls : positiveInt(maxCalls, 'maxCalls');
  return {
    schema: TUTOR_STUB_AB_PLAN_SCHEMA,
    preset,
    armIds,
    scenarioIds,
    modelIds,
    baselineArmId: baselineArm.id,
    arms: resolvedArms.map(clone),
    scenarios: resolvedScenarios.map((scenario) => ({
      ...scenario,
      turns: scenario.turns.map(({ bundle: _bundle, ...rest }) => rest),
    })),
    jobs,
    plannedCalls: jobs.length,
    maxCalls: callBudget,
    status: jobs.length > callBudget ? 'budget_exhausted' : 'ready',
    configSha256,
    rubric: clone(validated.rubric),
    invariants: clone(validated.invariants),
  };
}

export function publicTutorStubAbPlan(plan) {
  return {
    schema: plan.schema,
    preset: plan.preset,
    status: plan.status,
    plannedCalls: plan.plannedCalls,
    maxCalls: plan.maxCalls,
    configSha256: plan.configSha256,
    baselineArmId: plan.baselineArmId,
    rubric: clone(plan.rubric),
    invariants: clone(plan.invariants),
    featureRegistry: [...TUTOR_STUB_AB_FEATURE_IDS],
    arms: plan.arms.map((arm) => ({
      id: arm.id,
      label: arm.label,
      summary: arm.summary,
      baseline: arm.baseline,
      features: [...arm.features],
      omitted: [...arm.omitted],
      guardsClaimed: [...arm.guardsClaimed],
    })),
    scenarios: plan.scenarios.map((scenario) => ({
      id: scenario.id,
      label: scenario.label,
      criterion: scenario.criterion,
      fixture: scenario.fixture,
      fixtureSha256: scenario.fixtureSha256,
      worldId: scenario.worldId,
      learnerProfile: scenario.learnerProfile,
      turns: scenario.turns.map((turn) => ({ caseId: turn.caseId, turn: turn.turn, learnerText: turn.learnerText })),
    })),
    models: plan.modelIds.map((id) => {
      const model = plan.jobs.find((job) => job.modelId === id)?.model;
      return { id, provider: model.provider, model: model.model, effort: model.effort, timeoutMs: model.timeout_ms };
    }),
    jobs: plan.jobs.map((job) => ({
      id: job.id,
      scenarioId: job.scenarioId,
      caseId: job.caseId,
      turn: job.turn,
      armId: job.armId,
      modelId: job.modelId,
    })),
  };
}

/**
 * Freeze the turn: recompile the current first-draft contract against the
 * immutable public prefix, then project the request down to the arm.
 */
export function prepareTutorStubAbJob(job, { root, loadWorldForId = worldForId } = {}) {
  const originalPrefix = JSON.stringify(job.bundle.priorTurns || []);
  const originalLearnerText = job.bundle.learnerText;
  const world = loadWorldForId(root, job.worldId);
  const bundle = refreshTutorStubFrozenFirstDraftRequest({ bundle: clone(job.bundle), world });
  if (JSON.stringify(bundle.priorTurns || []) !== originalPrefix || bundle.learnerText !== originalLearnerText) {
    throw new Error(`job ${job.id} changed its frozen public prefix`);
  }
  const projection = projectTutorStubAbRequest({ bundle, arm: job.arm });
  return { bundle, world, projection, latest: projection.latest, history: projection.history };
}

async function defaultGenerateCandidate({ job, prepared }) {
  return await callAIWithCliBridge(
    { provider: job.model.provider, model: job.model.model },
    prepared.projection.systemPrompt,
    prepared.latest.content,
    'tutor_stub_ab_instrumentation',
    {
      messageHistory: prepared.history,
      effort: job.model.effort,
      timeoutMs: job.model.timeout_ms,
    },
  );
}

/**
 * The shared rubric. Every arm is audited against the reference guard set from
 * the recorded run, so dropping an advisory makes its guard harder to satisfy
 * rather than switching the guard off.
 */
export function auditTutorStubAbCandidate({ prepared, text, pinGuards = true }) {
  const bundle = pinGuards
    ? { ...prepared.bundle, guards: resolveTutorStubAbGuardSet(prepared.bundle.guards) }
    : prepared.bundle;
  return auditTutorStubFrozenCandidate({
    bundle,
    world: prepared.world,
    text,
    candidateKind: 'original_candidate',
  });
}

function errorRecord(error) {
  return { name: error?.name || 'Error', code: error?.code || null, message: String(error?.message || error) };
}

export async function runTutorStubAb({
  plan,
  root,
  generateCandidate = defaultGenerateCandidate,
  auditCandidate = auditTutorStubAbCandidate,
  loadWorldForId = worldForId,
  metadata = {},
  onProgress = null,
  now = () => new Date(),
} = {}) {
  const startedAt = now().toISOString();
  if (plan.status === 'budget_exhausted') {
    return {
      schema: TUTOR_STUB_AB_REPORT_SCHEMA,
      status: 'budget_exhausted',
      startedAt,
      completedAt: now().toISOString(),
      metadata,
      plan: publicTutorStubAbPlan(plan),
      results: [],
      summary: summarizeTutorStubAb({ plan, results: [] }),
    };
  }
  const results = [];
  const blockedModels = new Map();
  for (const job of plan.jobs) {
    if (blockedModels.has(job.modelId)) {
      results.push({
        id: job.id,
        scenarioId: job.scenarioId,
        caseId: job.caseId,
        turn: job.turn,
        armId: job.armId,
        modelId: job.modelId,
        status: 'blocked',
        called: false,
        error: { ...blockedModels.get(job.modelId), message: `model blocked by earlier call: ${job.modelId}` },
      });
      continue;
    }
    const started = Date.now();
    try {
      const prepared = prepareTutorStubAbJob(job, { root, loadWorldForId });
      const generated = await generateCandidate({ job, prepared });
      const candidate = String(generated?.text || '').trim();
      const audit = await auditCandidate({
        job,
        prepared,
        text: candidate,
        pinGuards: plan.rubric?.pin_guards_to_reference !== false,
      });
      const result = {
        id: job.id,
        scenarioId: job.scenarioId,
        caseId: job.caseId,
        turn: job.turn,
        armId: job.armId,
        modelId: job.modelId,
        provider: generated?.provider || job.model.provider,
        model: generated?.model || job.model.model,
        effort: generated?.effort || generated?.reasoningEffort || job.model.effort,
        status: audit?.ok === true ? 'pass' : 'fail',
        called: true,
        latencyMs: Number(generated?.latencyMs || Date.now() - started),
        usage: normalizeTokenUsage(generated, { available: generated?.tokenUsageAvailable }),
        learnerText: job.learnerText,
        candidate,
        auditedText: audit?.auditedText || candidate,
        safetyFailure: audit?.safetyFailure === true,
        failureClusters: audit?.failureClusters || [],
        hardFailureClusters: audit?.hardFailureClusters || [],
        advisoryFailureClusters: audit?.advisoryFailureClusters || [],
        projection: {
          retainedFeatures: prepared.projection.retainedFeatures,
          strippedFeatures: prepared.projection.strippedFeatures,
          advisoryChars: prepared.projection.advisoryChars,
          requestChars: prepared.projection.requestChars,
        },
        guardSet: prepared.bundle.guards,
        audit,
      };
      results.push(result);
      if (onProgress) onProgress(result);
    } catch (error) {
      const recorded = errorRecord(error);
      blockedModels.set(job.modelId, recorded);
      const result = {
        id: job.id,
        scenarioId: job.scenarioId,
        caseId: job.caseId,
        turn: job.turn,
        armId: job.armId,
        modelId: job.modelId,
        status: 'blocked',
        called: true,
        latencyMs: Date.now() - started,
        learnerText: job.learnerText,
        error: recorded,
      };
      results.push(result);
      if (onProgress) onProgress(result);
    }
  }
  const summary = summarizeTutorStubAb({ plan, results });
  const status = results.some((row) => row.status === 'blocked') ? 'blocked' : 'complete';
  if (!TERMINAL_STATUSES.has(status)) throw new Error(`non-terminal A/B status ${status}`);
  return {
    schema: TUTOR_STUB_AB_REPORT_SCHEMA,
    status,
    startedAt,
    completedAt: now().toISOString(),
    metadata,
    plan: publicTutorStubAbPlan(plan),
    results,
    summary,
  };
}

function tallyClusters(rows, key = 'failureClusters') {
  const counts = new Map();
  for (const row of rows) for (const cluster of row[key] || []) counts.set(cluster, (counts.get(cluster) || 0) + 1);
  return counts;
}

function sumClusters(counts) {
  let total = 0;
  for (const count of counts.values()) total += count;
  return total;
}

export function summarizeTutorStubAb({ plan, results }) {
  const baselineArmId = plan.baselineArmId;
  const byArm = new Map();
  for (const armId of plan.armIds) byArm.set(armId, []);
  for (const row of results) if (byArm.has(row.armId)) byArm.get(row.armId).push(row);

  const baselineRows = byArm.get(baselineArmId) || [];
  const baselineClusters = tallyClusters(baselineRows);
  const baselineHardClusters = tallyClusters(baselineRows, 'hardFailureClusters');
  const baselineTotals = { clusters: sumClusters(baselineClusters), hard: sumClusters(baselineHardClusters) };
  const baselinePassById = new Map(baselineRows.map((row) => [`${row.caseId}__${row.modelId}`, row.status]));

  const arms = plan.armIds.map((armId) => {
    const rows = byArm.get(armId) || [];
    const scored = rows.filter((row) => row.called && row.status !== 'blocked');
    const pass = scored.filter((row) => row.status === 'pass').length;
    const clusters = tallyClusters(rows);
    const hardClusters = tallyClusters(rows, 'hardFailureClusters');
    const totalClusters = sumClusters(clusters);
    const totalHardClusters = sumClusters(hardClusters);
    const clusterDeltas = [...new Set([...clusters.keys(), ...baselineClusters.keys()])]
      .map((cluster) => ({
        cluster,
        arm: clusters.get(cluster) || 0,
        baseline: baselineClusters.get(cluster) || 0,
        delta: (clusters.get(cluster) || 0) - (baselineClusters.get(cluster) || 0),
      }))
      .filter((entry) => entry.delta !== 0 || entry.arm > 0)
      .sort((left, right) => left.delta - right.delta || left.cluster.localeCompare(right.cluster));
    const flips = rows
      .filter((row) => row.called && row.status !== 'blocked')
      .map((row) => {
        const before = baselinePassById.get(`${row.caseId}__${row.modelId}`);
        if (!before || before === row.status) return null;
        return { caseId: row.caseId, turn: row.turn, modelId: row.modelId, from: before, to: row.status };
      })
      .filter(Boolean);
    const armPlan = plan.arms.find((entry) => entry.id === armId);
    return {
      id: armId,
      label: armPlan?.label || armId,
      baseline: armId === baselineArmId,
      features: armPlan ? [...armPlan.features] : [],
      turns: rows.length,
      scored: scored.length,
      blocked: rows.filter((row) => row.status === 'blocked').length,
      pass,
      fail: scored.length - pass,
      passRate: scored.length ? pass / scored.length : null,
      safetyFailures: rows.filter((row) => row.safetyFailure).length,
      // Pass rate can sit at 0/N for every arm when a rubric check fails
      // universally, so the comparable signal is how many failure clusters an
      // arm accumulates against the baseline's tally over the same turns.
      totalClusters,
      totalHardClusters,
      meanClusters: scored.length ? Number((totalClusters / scored.length).toFixed(2)) : null,
      meanHardClusters: scored.length ? Number((totalHardClusters / scored.length).toFixed(2)) : null,
      clusterDeltaTotal: armId === baselineArmId ? 0 : totalClusters - baselineTotals.clusters,
      hardClusterDeltaTotal: armId === baselineArmId ? 0 : totalHardClusters - baselineTotals.hard,
      meanAdvisoryChars: scored.length
        ? Math.round(scored.reduce((total, row) => total + (row.projection?.advisoryChars || 0), 0) / scored.length)
        : null,
      meanCandidateChars: scored.length
        ? Math.round(scored.reduce((total, row) => total + (row.candidate?.length || 0), 0) / scored.length)
        : null,
      meanLatencyMs: scored.length
        ? Math.round(scored.reduce((total, row) => total + (row.latencyMs || 0), 0) / scored.length)
        : null,
      clusterDeltas,
      flipsVsBaseline: flips,
    };
  });

  return {
    baselineArmId,
    totalJobs: plan.plannedCalls,
    completed: results.filter((row) => row.called && row.status !== 'blocked').length,
    blocked: results.filter((row) => row.status === 'blocked').length,
    arms,
  };
}

export function renderTutorStubAbMarkdown(report) {
  const cell = (value) =>
    String(value ?? '')
      .replaceAll('|', '\\|')
      .replaceAll(/\s+/gu, ' ')
      .trim();
  const pct = (value) => (value === null ? '—' : `${Math.round(value * 100)}%`);
  const signed = (value) => (value > 0 ? `+${value}` : String(value));
  const lines = [
    '# Tutor instrumentation A/B',
    '',
    `- Status: **${report.status}**`,
    `- Preset: \`${report.plan.preset}\``,
    `- Baseline arm: \`${report.summary.baselineArmId}\``,
    `- Calls: ${report.results.filter((row) => row.called).length}/${report.plan.maxCalls}`,
    `- Commit: \`${report.metadata?.gitSha || 'unknown'}\``,
    '',
    '## Arms',
    '',
    'Broken rules are the headline. Pass is all-or-nothing per turn and can read',
    '0/N for every arm at once; the broken-rule tallies say how far each arm is from clean.',
    '',
    '| Arm | Features | Turns | Broken rules (hard) | vs baseline | Pass | Safety | Advisory chars | Reply chars | Latency |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const arm of report.summary.arms) {
    const versus = arm.baseline ? '—' : `${signed(arm.clusterDeltaTotal)} (${signed(arm.hardClusterDeltaTotal)})`;
    lines.push(
      `| ${cell(arm.label)}${arm.baseline ? ' _(baseline)_' : ''} | ${cell(arm.features.join(', ') || 'none')} | ${arm.scored} | ${arm.totalClusters} (${arm.totalHardClusters}) | ${versus} | ${arm.pass}/${arm.scored} (${pct(arm.passRate)}) | ${arm.safetyFailures} | ${arm.meanAdvisoryChars ?? '—'} | ${arm.meanCandidateChars ?? '—'} | ${arm.meanLatencyMs ?? '—'} ms |`,
    );
  }
  for (const arm of report.summary.arms.filter((entry) => !entry.baseline)) {
    if (!arm.clusterDeltas.length && !arm.flipsVsBaseline.length) continue;
    lines.push('', `## ${arm.label} vs baseline`, '');
    if (arm.clusterDeltas.length) {
      lines.push('| Broken rule | Baseline | Arm | Delta |', '| --- | ---: | ---: | ---: |');
      for (const entry of arm.clusterDeltas) {
        lines.push(
          `| ${cell(entry.cluster)} | ${entry.baseline} | ${entry.arm} | ${entry.delta > 0 ? '+' : ''}${entry.delta} |`,
        );
      }
    }
    if (arm.flipsVsBaseline.length) {
      lines.push(
        '',
        ...arm.flipsVsBaseline.map((flip) => `- turn ${flip.turn} (${flip.modelId}): ${flip.from} → ${flip.to}`),
      );
    }
  }
  lines.push(
    '',
    'Frozen-replay comparison over a recorded dialogue. Learner utterances, public prefix, world, and evidence state are identical across arms; only the private planner context the speaker receives varies. Every arm is graded by the same pinned guard set. This is a visual and regression instrument, not evidence about human learning.',
    '',
  );
  return lines.join('\n');
}
