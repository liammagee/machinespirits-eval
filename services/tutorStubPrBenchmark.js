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
import { resolveTutorPrBenchmarkRubric, TUTOR_PR_BENCHMARK_RUBRIC_SCHEMA } from './tutorPrBenchmarkRubric.js';

export const TUTOR_PR_BENCHMARK_CONFIG_SCHEMA = 'machinespirits.tutor-stub.pr-benchmark-config.v1';
export const TUTOR_PR_BENCHMARK_REPORT_SCHEMA = 'machinespirits.tutor-stub.pr-benchmark-report.v1';
const MODEL_PROVIDERS = new Set(['codex', 'claude-code']);
const TERMINAL_STATUSES = new Set(['pass', 'fail', 'blocked', 'budget_exhausted']);
const REQUIRED_GATE_KEYS = Object.freeze(['require_all_jobs', 'require_audit_ok', 'require_no_safety_failure']);
const REQUIRED_INVARIANTS = Object.freeze([
  'regenerate_prior_dialogue',
  'generate_learner',
  'classify_learner',
  'update_learner_dag',
  'run_repair',
  'run_fallback',
  'continue_dialogue',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clone(value) {
  return structuredClone(value);
}

function stringList(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !String(item || '').trim())) {
    throw new Error(`${label} must be a non-empty string list`);
  }
  return [...new Set(value.map(String))];
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

export function loadTutorPrBenchmarkConfig(configPath) {
  const source = fs.readFileSync(configPath, 'utf8');
  return { config: yaml.parse(source), source, configPath: path.resolve(configPath) };
}

export function validateTutorPrBenchmarkConfig(config) {
  if (!config || config.schema !== TUTOR_PR_BENCHMARK_CONFIG_SCHEMA) {
    throw new Error(`benchmark config schema must be ${TUTOR_PR_BENCHMARK_CONFIG_SCHEMA}`);
  }
  if (!config.models || !config.cases || !config.presets)
    throw new Error('benchmark config requires models, cases, and presets');
  if (
    !String(config.rubric?.path || '').trim() ||
    config.rubric?.schema !== TUTOR_PR_BENCHMARK_RUBRIC_SCHEMA ||
    !String(config.rubric?.version || '').trim()
  ) {
    throw new Error('benchmark config requires a versioned PR benchmark rubric');
  }
  for (const [id, model] of Object.entries(config.models)) {
    if (!MODEL_PROVIDERS.has(model?.provider)) throw new Error(`model ${id} must use codex or claude-code`);
    if (!String(model.model || '').trim()) throw new Error(`model ${id} requires model`);
    if (model.effort !== 'medium') throw new Error(`model ${id} must use medium effort`);
    positiveInt(model.timeout_ms, `model ${id}.timeout_ms`);
  }
  for (const [id, benchmarkCase] of Object.entries(config.cases)) {
    if (!String(benchmarkCase?.fixture || '').trim()) throw new Error(`case ${id} requires fixture`);
    if (!String(benchmarkCase?.case_id || '').trim()) throw new Error(`case ${id} requires case_id`);
  }
  for (const [id, preset] of Object.entries(config.presets)) {
    for (const modelId of stringList(preset?.models, `preset ${id}.models`)) {
      if (!config.models[modelId]) throw new Error(`preset ${id} references unknown model ${modelId}`);
    }
    for (const caseId of stringList(preset?.cases, `preset ${id}.cases`)) {
      if (!config.cases[caseId]) throw new Error(`preset ${id} references unknown case ${caseId}`);
    }
  }
  positiveInt(config.budgets?.max_calls, 'budgets.max_calls');
  if (config.budgets?.retries_per_job !== 0) throw new Error('budgets.retries_per_job must remain 0');
  if (config.budgets?.concurrency !== 1) throw new Error('budgets.concurrency must remain 1');
  for (const name of REQUIRED_GATE_KEYS)
    if (config.gate?.[name] !== true) throw new Error(`gate ${name} must remain true`);
  if (config.gate?.require_actorial_realization !== false) {
    throw new Error('gate require_actorial_realization must remain false; canonical audit dispositions own severity');
  }
  for (const name of REQUIRED_INVARIANTS)
    if (config.invariants?.[name] !== false) throw new Error(`invariant ${name} must remain false`);
  return config;
}

function loadBenchmarkCase({ root, id, definition }) {
  const fixturePath = resolveRepoPath(root, definition.fixture, `case ${id}.fixture`);
  const source = fs.readFileSync(fixturePath, 'utf8');
  const fixture = JSON.parse(source);
  if (fixture.schema !== TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA) {
    throw new Error(`case ${id} fixture schema must be ${TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA}`);
  }
  const matches = fixture.cases?.filter((item) => item.id === definition.case_id) || [];
  if (matches.length !== 1) throw new Error(`case ${id} expected exactly one fixture row ${definition.case_id}`);
  const selected = matches[0];
  if (!selected.bundle || selected.bundle.turnId !== definition.case_id) {
    throw new Error(`case ${id} fixture row has no matching frozen bundle`);
  }
  return {
    id,
    criterion: definition.criterion || null,
    fixture: definition.fixture,
    fixtureSha256: sha256(source),
    fixtureCaseId: definition.case_id,
    worldId: selected.bundle.worldId,
    learnerProfile: selected.bundle.learnerProfile || selected.learnerProfile || null,
    turn: selected.bundle.turn,
    learnerText: selected.bundle.learnerText,
    bundle: clone(selected.bundle),
  };
}

export function buildTutorPrBenchmarkPlan({
  config,
  root,
  preset = 'strong',
  models = null,
  cases = null,
  maxCalls = null,
  configSha256 = null,
} = {}) {
  validateTutorPrBenchmarkConfig(config);
  const loadedRubric = resolveTutorPrBenchmarkRubric({ root, definition: config.rubric });
  const selectedPreset = config.presets[preset];
  if (!selectedPreset) throw new Error(`unknown benchmark preset ${preset}`);
  const modelIds = stringList(models || selectedPreset.models, 'selected models');
  const caseIds = stringList(cases || selectedPreset.cases, 'selected cases');
  for (const id of modelIds) if (!config.models[id]) throw new Error(`unknown selected model ${id}`);
  for (const id of caseIds) if (!config.cases[id]) throw new Error(`unknown selected case ${id}`);
  const resolvedCases = new Map(
    caseIds.map((id) => [id, loadBenchmarkCase({ root, id, definition: config.cases[id] })]),
  );
  const jobs = caseIds.flatMap((caseId) =>
    modelIds.map((modelId) => ({
      id: `${caseId}__${modelId}`,
      modelId,
      model: clone(config.models[modelId]),
      caseId,
      benchmarkCase: clone(resolvedCases.get(caseId)),
    })),
  );
  const callBudget = maxCalls === null ? config.budgets.max_calls : positiveInt(maxCalls, 'maxCalls');
  return {
    schema: TUTOR_PR_BENCHMARK_CONFIG_SCHEMA,
    preset,
    modelIds,
    caseIds,
    jobs,
    plannedCalls: jobs.length,
    maxCalls: callBudget,
    status: jobs.length > callBudget ? 'budget_exhausted' : 'ready',
    configSha256,
    rubric: {
      id: loadedRubric.rubric.id,
      path: config.rubric.path,
      schema: loadedRubric.rubric.schema,
      version: loadedRubric.rubric.version,
      status: loadedRubric.rubric.status,
      sha256: loadedRubric.sha256,
    },
    gate: clone(config.gate),
    invariants: clone(config.invariants),
  };
}

export function publicTutorPrBenchmarkPlan(plan) {
  return {
    schema: plan.schema,
    preset: plan.preset,
    status: plan.status,
    plannedCalls: plan.plannedCalls,
    maxCalls: plan.maxCalls,
    configSha256: plan.configSha256,
    rubric: clone(plan.rubric),
    gate: clone(plan.gate),
    invariants: clone(plan.invariants),
    models: plan.modelIds.map((id) => {
      const model = plan.jobs.find((job) => job.modelId === id)?.model;
      return { id, provider: model.provider, model: model.model, effort: model.effort, timeoutMs: model.timeout_ms };
    }),
    cases: plan.caseIds.map((id) => {
      const row = plan.jobs.find((job) => job.caseId === id)?.benchmarkCase;
      return {
        id,
        criterion: row.criterion,
        fixture: row.fixture,
        fixtureSha256: row.fixtureSha256,
        fixtureCaseId: row.fixtureCaseId,
        worldId: row.worldId,
        learnerProfile: row.learnerProfile,
        turn: row.turn,
        learnerText: row.learnerText,
      };
    }),
    jobs: plan.jobs.map((job) => ({ id: job.id, caseId: job.caseId, modelId: job.modelId })),
  };
}

function worldForId(root, worldId) {
  const worldDir = path.join(root, 'config', 'drama-derivation');
  const paths = fs
    .readdirSync(worldDir)
    .filter((name) => /^world-.*\.yaml$/u.test(name))
    .map((name) => path.join(worldDir, name));
  const matches = paths.map((file) => loadWorld(file)).filter((world) => world.id === worldId);
  if (matches.length !== 1) throw new Error(`expected exactly one world for ${worldId}, found ${matches.length}`);
  return matches[0];
}

export function prepareTutorPrBenchmarkJob(job, { root, loadWorldForId = worldForId } = {}) {
  const originalPrefix = JSON.stringify(job.benchmarkCase.bundle.priorTurns || []);
  const originalLearnerText = job.benchmarkCase.bundle.learnerText;
  const world = loadWorldForId(root, job.benchmarkCase.worldId);
  const bundle = refreshTutorStubFrozenFirstDraftRequest({ bundle: clone(job.benchmarkCase.bundle), world });
  if (JSON.stringify(bundle.priorTurns || []) !== originalPrefix || bundle.learnerText !== originalLearnerText) {
    throw new Error(`job ${job.id} changed its frozen public prefix`);
  }
  const messages = bundle.request?.messages || [];
  const latest = messages.at(-1);
  if (!latest || latest.role !== 'user') throw new Error(`job ${job.id} has no final user request`);
  return { bundle, world, latest, history: messages.slice(0, -1) };
}

async function defaultGenerateCandidate({ job, prepared }) {
  return await callAIWithCliBridge(
    { provider: job.model.provider, model: job.model.model },
    prepared.bundle.request?.systemPrompt,
    prepared.latest.content,
    'tutor_stub_pr_benchmark',
    {
      messageHistory: prepared.history,
      effort: job.model.effort,
      timeoutMs: job.model.timeout_ms,
    },
  );
}

export function auditTutorPrBenchmarkCandidate({ prepared, text }) {
  return auditTutorStubFrozenCandidate({
    bundle: prepared.bundle,
    world: prepared.world,
    text,
    candidateKind: 'original_candidate',
  });
}

function gateResult(audit, gate) {
  const checks = {
    auditOk: !gate.require_audit_ok || audit?.ok === true,
    actorialRealization: !gate.require_actorial_realization || audit?.audits?.actorialRealizationAudit?.ok === true,
    noSafetyFailure: !gate.require_no_safety_failure || audit?.safetyFailure !== true,
  };
  return { pass: Object.values(checks).every(Boolean), checks };
}

function errorRecord(error) {
  return {
    name: error?.name || 'Error',
    code: error?.code || null,
    message: String(error?.message || error),
  };
}

function summarizeJobs(jobs) {
  const counts = { pass: 0, fail: 0, blocked: 0 };
  for (const job of jobs) if (job.status in counts) counts[job.status] += 1;
  return { ...counts, total: jobs.length, completed: counts.pass + counts.fail };
}

export async function runTutorPrBenchmark({
  plan,
  root,
  generateCandidate = defaultGenerateCandidate,
  auditCandidate = auditTutorPrBenchmarkCandidate,
  loadWorldForId = worldForId,
  metadata = {},
  now = () => new Date(),
} = {}) {
  const startedAt = now().toISOString();
  if (plan.status === 'budget_exhausted') {
    return {
      schema: TUTOR_PR_BENCHMARK_REPORT_SCHEMA,
      status: 'budget_exhausted',
      startedAt,
      completedAt: now().toISOString(),
      metadata,
      plan: publicTutorPrBenchmarkPlan(plan),
      summary: { pass: 0, fail: 0, blocked: 0, total: 0, completed: 0 },
      jobs: [],
    };
  }
  const results = [];
  const blockedModels = new Map();
  for (const job of plan.jobs) {
    if (blockedModels.has(job.modelId)) {
      results.push({
        id: job.id,
        caseId: job.caseId,
        modelId: job.modelId,
        status: 'blocked',
        called: false,
        error: { ...blockedModels.get(job.modelId), message: `model blocked by earlier call: ${job.modelId}` },
      });
      continue;
    }
    const started = Date.now();
    try {
      const prepared = prepareTutorPrBenchmarkJob(job, { root, loadWorldForId });
      const generated = await generateCandidate({ job, prepared });
      const candidate = String(generated?.text || '').trim();
      const audit = await auditCandidate({ job, prepared, text: candidate });
      const gate = gateResult(audit, plan.gate);
      const usage = normalizeTokenUsage(generated, { available: generated?.tokenUsageAvailable });
      results.push({
        id: job.id,
        caseId: job.caseId,
        fixtureCaseId: job.benchmarkCase.fixtureCaseId,
        modelId: job.modelId,
        provider: generated?.provider || job.model.provider,
        model: generated?.model || job.model.model,
        effort: generated?.effort || generated?.reasoningEffort || job.model.effort,
        status: gate.pass ? 'pass' : 'fail',
        called: true,
        latencyMs: Number(generated?.latencyMs || Date.now() - started),
        usage,
        candidate,
        gate: gate.checks,
        failureClusters: audit?.failureClusters || [],
        hardFailureClusters: audit?.hardFailureClusters || [],
        audit,
      });
    } catch (error) {
      const recorded = errorRecord(error);
      blockedModels.set(job.modelId, recorded);
      results.push({
        id: job.id,
        caseId: job.caseId,
        fixtureCaseId: job.benchmarkCase.fixtureCaseId,
        modelId: job.modelId,
        provider: job.model.provider,
        model: job.model.model,
        effort: job.model.effort,
        status: 'blocked',
        called: true,
        latencyMs: Date.now() - started,
        error: recorded,
      });
    }
  }
  const summary = summarizeJobs(results);
  const status = summary.blocked > 0 ? 'blocked' : summary.fail > 0 ? 'fail' : 'pass';
  if (!TERMINAL_STATUSES.has(status)) throw new Error(`non-terminal benchmark status ${status}`);
  return {
    schema: TUTOR_PR_BENCHMARK_REPORT_SCHEMA,
    status,
    startedAt,
    completedAt: now().toISOString(),
    metadata,
    plan: publicTutorPrBenchmarkPlan(plan),
    summary,
    jobs: results,
  };
}

export function renderTutorPrBenchmarkMarkdown(report) {
  const cell = (value) =>
    String(value ?? '')
      .replaceAll('|', '\\|')
      .replaceAll(/\s+/gu, ' ')
      .trim();
  const lines = [
    '# Tutor PR benchmark',
    '',
    `- Status: **${report.status}**`,
    `- Preset: \`${report.plan.preset}\``,
    `- Calls: ${report.jobs.filter((job) => job.called).length}/${report.plan.maxCalls}`,
    `- Commit: \`${report.metadata?.gitSha || 'unknown'}\``,
    '',
    '| Case | Model | Status | Latency | Broken rules |',
    '| --- | --- | --- | ---: | --- |',
  ];
  for (const job of report.jobs) {
    const failures = job.failureClusters?.length
      ? job.failureClusters.join(', ')
      : job.error?.code || job.error?.message || '—';
    lines.push(
      `| ${cell(job.caseId)} | ${cell(job.modelId)} | ${cell(job.status)} | ${job.latencyMs ?? '—'} ms | ${cell(failures)} |`,
    );
  }
  lines.push(
    '',
    'This is an engineering regression gate over frozen public prefixes. It does not regenerate learners or conversations, run repair/fallback, or constitute evidence of human learning.',
    '',
  );
  return lines.join('\n');
}
