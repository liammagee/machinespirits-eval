#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import YAML from 'yaml';
import { jsonrepair } from 'jsonrepair';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_CONFIG = 'config/d2-role-transfer.yaml';
const DEFAULT_RUBRIC = 'config/evaluation-rubric-d2-role-transfer.yaml';

dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

function usage() {
  return `D2 role-transfer sidecar

Usage:
  node scripts/run-d2-role-transfer.js validate
  node scripts/run-d2-role-transfer.js mock --out exports/d2-role-transfer-mock.jsonl [--runs 1]
  node scripts/run-d2-role-transfer.js generate --out exports/d2-role-transfer-raw.jsonl --runs 3 --provider openrouter --model anthropic/claude-haiku-4.5
  node scripts/run-d2-role-transfer.js score --in exports/d2-role-transfer-raw.jsonl --out exports/d2-role-transfer-scored.jsonl --judge-provider openrouter --judge-model anthropic/claude-sonnet-4.6 --judge-label sonnet
  node scripts/run-d2-role-transfer.js analyze --in exports/d2-role-transfer-scored.jsonl --out exports/d2-role-transfer-report.md

Commands:
  validate   Check config, prompt files, rubric weights, applications, and scenarios.
  mock       Write deterministic mock rows with mock judgments. No API calls.
  generate   Generate role-native responses. Real API calls.
  score      Score generated rows against the D2 role-fit rubric. Real API calls.
  analyze    Compute application-level deltas and Cohen d from scored JSONL.

Mock rows are validation artifacts only; they are never evidence for D2.`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      opts[key] = true;
    } else {
      opts[key] = next;
      i += 1;
    }
  }
  return { command, opts };
}

function abs(p) {
  return path.isAbsolute(p) ? p : path.join(ROOT, p);
}

function readYaml(relPath) {
  return YAML.parse(fs.readFileSync(abs(relPath), 'utf8'));
}

function readText(relPath) {
  return fs.readFileSync(abs(relPath), 'utf8');
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function fileHash(relPath) {
  return sha256(readText(relPath));
}

function currentGitCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(abs(filePath)), { recursive: true });
}

function writeJsonl(relPath, rows) {
  ensureDir(relPath);
  fs.writeFileSync(abs(relPath), `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function readJsonl(relPath) {
  const text = fs.readFileSync(abs(relPath), 'utf8').trim();
  if (!text) return [];
  return text.split(/\n+/).map((line, idx) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`${relPath}:${idx + 1}: invalid JSONL: ${err.message}`);
    }
  });
}

function dimEntries(rubric) {
  return Object.entries(rubric.dimensions || {});
}

function validateStudy(config, rubric) {
  const errors = [];
  const warnings = [];

  if (!config.study_id) errors.push('config.study_id is required');
  if (!config.applications || Object.keys(config.applications).length !== 3) {
    errors.push('config.applications must define exactly three core applications');
  }
  if (!config.arms?.transmission || !config.arms?.intersubjective) {
    errors.push('config.arms must define transmission and intersubjective');
  }
  if (!Array.isArray(config.scenarios) || config.scenarios.length === 0) {
    errors.push('config.scenarios must be a non-empty array');
  }

  const apps = new Set(Object.keys(config.applications || {}));
  const scenarioIds = new Set();
  const scenarioCounts = new Map();
  for (const scenario of config.scenarios || []) {
    if (!scenario.id) errors.push('scenario without id');
    if (scenarioIds.has(scenario.id)) errors.push(`duplicate scenario id: ${scenario.id}`);
    scenarioIds.add(scenario.id);
    if (!apps.has(scenario.application)) {
      errors.push(`scenario ${scenario.id}: unknown application ${scenario.application}`);
    }
    scenarioCounts.set(scenario.application, (scenarioCounts.get(scenario.application) || 0) + 1);
    for (const field of ['user_input', 'context', 'expected_behavior']) {
      if (!scenario[field]) errors.push(`scenario ${scenario.id}: missing ${field}`);
    }
  }
  for (const app of apps) {
    if ((scenarioCounts.get(app) || 0) < 2) {
      warnings.push(`application ${app} has fewer than two starter scenarios`);
    }
  }

  for (const [appId, app] of Object.entries(config.applications || {})) {
    for (const arm of ['transmission', 'intersubjective']) {
      const key = `${arm}_prompt`;
      if (!app[key]) {
        errors.push(`application ${appId}: missing ${key}`);
        continue;
      }
      if (!fs.existsSync(abs(app[key]))) {
        errors.push(`application ${appId}: prompt file not found: ${app[key]}`);
      }
    }
  }

  const dims = dimEntries(rubric);
  if (dims.length === 0) errors.push('rubric.dimensions is empty');
  const weightSum = dims.reduce((sum, [, dim]) => sum + Number(dim.weight || 0), 0);
  if (Math.abs(weightSum - 1) > 0.0001) {
    errors.push(`rubric dimension weights must sum to 1.0; got ${weightSum.toFixed(4)}`);
  }
  for (const [name, dim] of dims) {
    if (!dim.question) errors.push(`rubric dimension ${name}: missing question`);
    if (!Number.isFinite(Number(dim.weight))) errors.push(`rubric dimension ${name}: invalid weight`);
  }

  return { errors, warnings };
}

function promptPathFor(config, application, arm) {
  const app = config.applications[application];
  if (!app) throw new Error(`Unknown application: ${application}`);
  const key = arm === 'intersubjective' ? 'intersubjective_prompt' : 'transmission_prompt';
  return app[key];
}

function buildUserPrompt(config, scenario) {
  const app = config.applications[scenario.application];
  return `Application: ${app.label}
Relation shape: ${app.relation_shape}
Role description: ${app.role_description}

Scenario: ${scenario.name}
Context:
${scenario.context}

User message:
${scenario.user_input}

Expected behavior for evaluation:
${scenario.expected_behavior}`;
}

async function callModel({ provider, model, temperature, maxTokens, systemPrompt, userPrompt }) {
  const { unifiedAIProvider } = await import('../tutor-core/index.js');
  const response = await unifiedAIProvider.call({
    provider,
    model,
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    preset: 'direct',
    config: {
      temperature,
      maxTokens,
    },
  });
  return {
    text: response.content || '',
    provider: response.provider || provider,
    model: response.model || model,
    usage: response.usage || {},
    latencyMs: response.latencyMs || null,
  };
}

function mockResponse(config, scenario, arm) {
  const app = config.applications[scenario.application];
  const posture =
    arm === 'intersubjective'
      ? 'I will stay with the person as a co-interpreter of the situation'
      : 'I will handle the presenting issue directly';
  return `[mock ${arm}] ${app.label}: ${posture}. ${scenario.expected_behavior}`;
}

function stableJitter(seed) {
  let hash = 0;
  for (const ch of seed) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return ((hash % 9) - 4) * 0.04;
}

function mockJudgment(rubric, arm, scenario, runIndex) {
  const scores = {};
  const base = arm === 'intersubjective' ? 4.15 : 3.1;
  const jitter = stableJitter(`${scenario.id}:${runIndex}:${arm}`);
  for (const [name] of dimEntries(rubric)) {
    const dimensionOffset = name === 'outcome_helpfulness' ? 0.1 : name === 'communication_quality' ? -0.08 : 0;
    scores[name] = Number(Math.max(1, Math.min(5, base + jitter + dimensionOffset)).toFixed(2));
  }
  return {
    judge_label: 'mock',
    judge_provider: 'mock',
    judge_model: 'mock',
    scores,
    role_fit_overall: weightedOverall(scores, rubric),
    reasoning: 'Deterministic mock judgment for harness validation; not empirical evidence.',
    mock: true,
  };
}

function weightedOverall(scores, rubric) {
  let total = 0;
  for (const [name, dim] of dimEntries(rubric)) {
    const score = Number(scores[name]);
    if (!Number.isFinite(score)) throw new Error(`Missing numeric score for ${name}`);
    total += score * Number(dim.weight);
  }
  return Number((((total - 1) / 4) * 100).toFixed(2));
}

async function generateRows(config, rubric, opts, { mock = false } = {}) {
  const runs = Number(opts.runs || config.planned_design?.default_runs_per_scenario || 1);
  if (!Number.isInteger(runs) || runs < 1) throw new Error(`Invalid --runs: ${opts.runs}`);

  const provider = opts.provider || config.generator_defaults?.provider;
  const model = opts.model || config.generator_defaults?.model;
  const temperature = Number(opts.temperature ?? config.generator_defaults?.temperature ?? 0.4);
  const maxTokens = Number(opts['max-tokens'] ?? config.generator_defaults?.max_tokens ?? 900);
  const runId = opts['run-id'] || `${config.study_id}-${mock ? 'mock' : 'real'}-${new Date().toISOString()}`;
  const gitCommit = currentGitCommit();
  const configHash = fileHash(opts.config || DEFAULT_CONFIG);
  const rubricHash = fileHash(opts.rubric || DEFAULT_RUBRIC);
  const rows = [];

  for (const scenario of config.scenarios) {
    for (const arm of Object.keys(config.arms)) {
      const promptFile = promptPathFor(config, scenario.application, arm);
      const systemPrompt = readText(promptFile);
      const userPrompt = buildUserPrompt(config, scenario);

      for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
        const generated = mock
          ? {
              text: mockResponse(config, scenario, arm),
              provider: 'mock',
              model: 'mock',
              usage: {},
              latencyMs: 0,
            }
          : await callModel({ provider, model, temperature, maxTokens, systemPrompt, userPrompt });

        const row = {
          study_id: config.study_id,
          run_id: runId,
          scenario_id: scenario.id,
          scenario_name: scenario.name,
          application: scenario.application,
          arm,
          orientation_family: config.arms[arm]?.orientation_family || arm,
          run_index: runIndex,
          prompt_file: promptFile,
          git_commit: gitCommit,
          config_hash: configHash,
          rubric_hash: rubricHash,
          prompt_hash: fileHash(promptFile),
          generator_provider: generated.provider,
          generator_model: generated.model,
          generator_temperature: mock ? null : temperature,
          generator_max_tokens: mock ? null : maxTokens,
          response: generated.text,
          usage: generated.usage,
          latency_ms: generated.latencyMs,
          created_at: new Date().toISOString(),
          mock,
          judgments: [],
        };
        if (mock) row.judgments.push(mockJudgment(rubric, arm, scenario, runIndex));
        rows.push(row);
      }
    }
  }

  return rows;
}

function buildJudgePrompt(config, rubric, scenario, row) {
  const dimensions = dimEntries(rubric)
    .map(([name, dim]) => `- ${name} (weight ${dim.weight}): ${dim.question}`)
    .join('\n');
  const appNote = rubric.application_notes?.[row.application] || '';
  return `You are scoring a D2 role-transfer response. This is NOT a tutor-output rubric.

Study: ${config.study_id}
Application: ${config.applications[row.application].label}
Arm under test: ${row.arm}

Scenario context:
${scenario.context}

User message:
${scenario.user_input}

Expected behavior:
${scenario.expected_behavior}

Application-specific scoring note:
${appNote}

Rubric dimensions, each scored 1-5:
${dimensions}

Response to score:
${row.response}

Return JSON only:
{
  "scores": {
    "role_fidelity": 1-5,
    "contextual_specificity": 1-5,
    "agency_preservation": 1-5,
    "outcome_helpfulness": 1-5,
    "boundary_safety": 1-5,
    "communication_quality": 1-5
  },
  "reasoning": "brief explanation"
}`;
}

function parseJudgeJson(text) {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return JSON.parse(jsonrepair(stripped));
  }
}

async function scoreRows(config, rubric, rows, opts) {
  const provider = opts['judge-provider'] || config.judge_defaults?.provider;
  const model = opts['judge-model'] || config.judge_defaults?.model;
  const judgeLabel = opts['judge-label'] || `${provider}/${model}`;
  const temperature = Number(opts['judge-temperature'] ?? config.judge_defaults?.temperature ?? 0);
  const maxTokens = Number(opts['judge-max-tokens'] ?? config.judge_defaults?.max_tokens ?? 1400);

  const scenarioById = new Map(config.scenarios.map((scenario) => [scenario.id, scenario]));
  const scored = [];
  for (const row of rows) {
    const judgments = Array.isArray(row.judgments) ? row.judgments : [];
    if (judgments.some((judgment) => judgment.judge_label === judgeLabel)) {
      scored.push(row);
      continue;
    }
    const scenario = scenarioById.get(row.scenario_id);
    if (!scenario) throw new Error(`No scenario config for row ${row.scenario_id}`);
    const prompt = buildJudgePrompt(config, rubric, scenario, row);
    const result = await callModel({
      provider,
      model,
      temperature,
      maxTokens,
      systemPrompt: 'You are a strict JSON-only evaluator. Return valid JSON and no prose outside JSON.',
      userPrompt: prompt,
    });
    const parsed = parseJudgeJson(result.text);
    const scores = parsed.scores || {};
    const judgment = {
      judge_label: judgeLabel,
      judge_provider: result.provider,
      judge_model: result.model,
      scores,
      role_fit_overall: weightedOverall(scores, rubric),
      reasoning: parsed.reasoning || '',
      latency_ms: result.latencyMs,
      usage: result.usage,
      created_at: new Date().toISOString(),
      mock: false,
    };
    scored.push({ ...row, judgments: [...judgments, judgment] });
  }
  return scored;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sd(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}

function cohenD(treatment, control) {
  if (treatment.length < 2 || control.length < 2) return null;
  const s1 = sd(treatment);
  const s2 = sd(control);
  const pooled = Math.sqrt(
    ((treatment.length - 1) * s1 ** 2 + (control.length - 1) * s2 ** 2) / (treatment.length + control.length - 2),
  );
  if (pooled === 0) return null;
  return (mean(treatment) - mean(control)) / pooled;
}

function observations(rows) {
  const obs = [];
  for (const row of rows) {
    for (const judgment of row.judgments || []) {
      if (Number.isFinite(Number(judgment.role_fit_overall))) {
        obs.push({
          application: row.application,
          arm: row.arm,
          scenario_id: row.scenario_id,
          run_index: row.run_index,
          judge_label: judgment.judge_label,
          score: Number(judgment.role_fit_overall),
          mock: Boolean(row.mock || judgment.mock),
        });
      }
    }
  }
  return obs;
}

function analyzeRows(config, rows) {
  const obs = observations(rows);
  const apps = Object.keys(config.applications);
  const gateThreshold = 1.0;
  const summaries = [];
  for (const app of apps) {
    const transmission = obs.filter((o) => o.application === app && o.arm === 'transmission').map((o) => o.score);
    const intersubjective = obs.filter((o) => o.application === app && o.arm === 'intersubjective').map((o) => o.score);
    summaries.push({
      application: app,
      n_transmission: transmission.length,
      n_intersubjective: intersubjective.length,
      mean_transmission: transmission.length ? mean(transmission) : null,
      mean_intersubjective: intersubjective.length ? mean(intersubjective) : null,
      delta: transmission.length && intersubjective.length ? mean(intersubjective) - mean(transmission) : null,
      d: cohenD(intersubjective, transmission),
    });
  }
  const passing = summaries.filter((summary) => Number.isFinite(summary.d) && summary.d >= gateThreshold).length;
  const judgeModels = {};
  const judgeMeans = {};
  let generationCost = 0;
  let judgeCost = 0;
  for (const row of rows) {
    generationCost += Number(row.usage?.cost || 0);
    for (const judgment of row.judgments || []) {
      judgeModels[judgment.judge_label] ??= new Set();
      judgeModels[judgment.judge_label].add(judgment.judge_model);
      judgeMeans[judgment.judge_label] ??= [];
      judgeMeans[judgment.judge_label].push(Number(judgment.role_fit_overall));
      judgeCost += Number(judgment.usage?.cost || 0);
    }
  }
  const byArm = Object.fromEntries(
    ['transmission', 'intersubjective'].map((arm) => {
      const values = obs.filter((o) => o.arm === arm).map((o) => o.score);
      return [
        arm,
        { n: values.length, mean: values.length ? mean(values) : null, sd: values.length ? sd(values) : null },
      ];
    }),
  );
  return {
    rows: rows.length,
    observations: obs.length,
    mock_observations: obs.filter((o) => o.mock).length,
    run_ids: [...new Set(rows.map((row) => row.run_id).filter(Boolean))].sort(),
    generator_models: [...new Set(rows.map((row) => row.generator_model).filter(Boolean))].sort(),
    judge_models: Object.fromEntries(
      Object.entries(judgeModels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, models]) => [label, [...models].sort()]),
    ),
    judge_means: Object.fromEntries(
      Object.entries(judgeMeans)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, values]) => [label, { n: values.length, mean: mean(values), sd: sd(values) }]),
    ),
    by_arm: byArm,
    cost: {
      generation: generationCost,
      judging: judgeCost,
      total: generationCost + judgeCost,
    },
    summaries,
    gate: {
      threshold: gateThreshold,
      passing_applications: passing,
      verdict: passing >= 2 ? 'pass' : 'fail_or_scope_bound',
    },
  };
}

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'NA';
}

function reportMarkdown(config, analysis, sourcePath) {
  const lines = [];
  lines.push(`# D2 Role-Transfer Analysis`);
  lines.push('');
  lines.push(`Source: \`${sourcePath}\``);
  lines.push(`Study: \`${config.study_id}\``);
  lines.push(`Run IDs: ${analysis.run_ids.map((runId) => `\`${runId}\``).join(', ') || 'NA'}`);
  lines.push(`Generated rows: ${analysis.rows}`);
  lines.push(`Observations: ${analysis.observations}`);
  lines.push(`Mock observations: ${analysis.mock_observations}`);
  lines.push(`Generator models: ${analysis.generator_models.map((model) => `\`${model}\``).join(', ') || 'NA'}`);
  lines.push('');
  lines.push('## Judges');
  lines.push('');
  lines.push('| Judge label | Model(s) | n | mean | SD |');
  lines.push('|---|---|---:|---:|---:|');
  for (const [label, stats] of Object.entries(analysis.judge_means)) {
    const models = (analysis.judge_models[label] || []).map((model) => `\`${model}\``).join(', ');
    lines.push(`| ${label} | ${models || 'NA'} | ${stats.n} | ${fmt(stats.mean)} | ${fmt(stats.sd)} |`);
  }
  lines.push('');
  lines.push('## Arm Means');
  lines.push('');
  lines.push('| Arm | n | mean | SD |');
  lines.push('|---|---:|---:|---:|');
  for (const arm of ['transmission', 'intersubjective']) {
    const stats = analysis.by_arm[arm];
    lines.push(`| ${arm} | ${stats.n} | ${fmt(stats.mean)} | ${fmt(stats.sd)} |`);
  }
  lines.push('');
  lines.push('## Metered Cost');
  lines.push('');
  lines.push(`Generation: $${fmt(analysis.cost.generation, 4)}`);
  lines.push(`Judging: $${fmt(analysis.cost.judging, 4)}`);
  lines.push(`Total: $${fmt(analysis.cost.total, 4)}`);
  lines.push('');
  lines.push('## Primary Gate');
  lines.push('');
  lines.push(config.primary_gate.pass);
  lines.push('');
  lines.push(
    `Verdict: **${analysis.gate.verdict}** (${analysis.gate.passing_applications}/3 applications with d >= ${analysis.gate.threshold.toFixed(1)})`,
  );
  lines.push('');
  lines.push(
    '| Application | n transmission | n intersubjective | mean transmission | mean intersubjective | delta | d |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const summary of analysis.summaries) {
    lines.push(
      `| ${summary.application} | ${summary.n_transmission} | ${summary.n_intersubjective} | ${fmt(summary.mean_transmission)} | ${fmt(summary.mean_intersubjective)} | ${fmt(summary.delta)} | ${fmt(summary.d)} |`,
    );
  }
  if (analysis.mock_observations > 0) {
    lines.push('');
    lines.push(
      '**Warning:** this report includes mock observations. It validates the harness only; it is not empirical evidence.',
    );
  }
  lines.push('');
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

async function main() {
  const { command, opts } = parseArgs(process.argv.slice(2));
  if (!command || opts.help) {
    console.log(usage());
    return;
  }

  const configPath = opts.config || DEFAULT_CONFIG;
  const rubricPath = opts.rubric || DEFAULT_RUBRIC;
  const config = readYaml(configPath);
  const rubric = readYaml(rubricPath);
  const validation = validateStudy(config, rubric);

  if (validation.errors.length > 0) {
    for (const error of validation.errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
    return;
  }

  if (command === 'validate') {
    console.log(`D2 role-transfer config valid: ${config.study_id}`);
    console.log(`Applications: ${Object.keys(config.applications).length}`);
    console.log(`Scenarios: ${config.scenarios.length}`);
    console.log(`Arms: ${Object.keys(config.arms).join(', ')}`);
    for (const warning of validation.warnings) console.warn(`WARN: ${warning}`);
    return;
  }

  if (command === 'mock') {
    const out = opts.out || 'exports/d2-role-transfer-mock.jsonl';
    const rows = await generateRows(config, rubric, opts, { mock: true });
    writeJsonl(out, rows);
    console.log(`Wrote ${rows.length} mock rows to ${out}`);
    return;
  }

  if (command === 'generate') {
    if (!opts.out) throw new Error('--out is required for generate');
    const rows = await generateRows(config, rubric, opts, { mock: false });
    writeJsonl(opts.out, rows);
    console.log(`Wrote ${rows.length} generated rows to ${opts.out}`);
    return;
  }

  if (command === 'score') {
    if (!opts.in || !opts.out) throw new Error('--in and --out are required for score');
    const rows = readJsonl(opts.in);
    const scored = await scoreRows(config, rubric, rows, opts);
    writeJsonl(opts.out, scored);
    console.log(`Wrote ${scored.length} rows to ${opts.out}`);
    return;
  }

  if (command === 'analyze') {
    if (!opts.in) throw new Error('--in is required for analyze');
    const rows = readJsonl(opts.in);
    const analysis = analyzeRows(config, rows);
    if (opts.out) {
      ensureDir(opts.out);
      fs.writeFileSync(abs(opts.out), reportMarkdown(config, analysis, opts.in));
      console.log(`Wrote report to ${opts.out}`);
    } else {
      console.log(JSON.stringify(analysis, null, 2));
    }
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
