#!/usr/bin/env node

// Frozen launcher for the sarcasm-as-determinate-negation grid
// (notes/2026-08-06-sarcasm-determinate-negation-preregistration.md).
// Mirrors scripts/run-negative-register-effect-estimation-grid.js: --dry-run
// prints the plan SHA with zero model calls; a paid launch needs
// --launch-approved plus the exact clean-checkout commit SHA; --report-run is
// a zero-call fail-closed report over already-scored rows.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  buildSarcasmDeterminateNegationGridPlan,
  SARCASM_DETERMINATE_NEGATION_GRID,
  summarizeSarcasmDeterminateNegationGrid,
  validateSarcasmDeterminateNegationGridPlan,
} from '../services/sarcasmDeterminateNegationGrid.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const GRID = SARCASM_DETERMINATE_NEGATION_GRID;

export function generationCommand() {
  return [
    process.execPath,
    'scripts/eval-cli.js',
    'run',
    '--profiles',
    GRID.profiles.join(','),
    '--scenarios',
    GRID.scenarios.join(','),
    '--runs',
    String(GRID.repeats),
    '--parallelism',
    String(GRID.generation.parallelism),
    '--skip-rubric',
    '--tutor-model',
    GRID.generation.tutorModel,
    '--learner-model',
    GRID.generation.learnerModel,
    '--description',
    'Sarcasm determinate-negation grid v1',
  ];
}

export function followUpCommands(runId = '<runId>') {
  return [
    [
      process.execPath,
      'scripts/eval-cli.js',
      'evaluate',
      runId,
      '--tutor-only',
      '--judge-cli',
      GRID.scoring.tutorJudgeCli,
      '--model',
      GRID.scoring.tutorJudgeModel,
      '--parallelism',
      '1',
    ],
    [process.execPath, 'scripts/evaluate-register-rubric.js', runId, '--judge', GRID.scoring.registerJudge],
    [process.execPath, 'scripts/run-sarcasm-determinate-negation-grid.js', '--report-run', runId],
  ];
}

function shellQuote(value) {
  const raw = String(value);
  return /^[A-Za-z0-9_./:=,-]+$/u.test(raw) ? raw : `'${raw.replaceAll("'", "'\\''")}'`;
}

function renderCommand(command, { scenarioEnv = false } = {}) {
  const prefix = scenarioEnv ? `EVAL_SCENARIOS_FILE=${GRID.scenarioSource} ` : '';
  return `${prefix}${command.map(shellQuote).join(' ')}`;
}

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

export function assertLaunchAuthorization(expectedSha) {
  if (!/^[0-9a-f]{40}$/u.test(expectedSha || '')) {
    throw new Error('--launch-approved also requires --expected-sha with the exact 40-character clean commit SHA');
  }
  const head = gitOutput(['rev-parse', 'HEAD']);
  if (head !== expectedSha) throw new Error(`launch SHA mismatch: expected ${expectedSha}, checkout is ${head}`);
  if (gitOutput(['status', '--porcelain'])) throw new Error('paid launch requires a clean checkout');
  return head;
}

function writePlanArtifact(plan, outputDir, { launchSha = null } = {}) {
  const validation = validateSarcasmDeterminateNegationGridPlan(plan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const artifact = {
    schema: 'machinespirits.sarcasm-determinate-negation-grid-dry-run.v1',
    modelCalls: 0,
    paidLaunchStatus: launchSha ? 'authorized_for_generation' : 'locked_pending_explicit_user_approval',
    launchSha,
    validation,
    plan,
    generationCommand: renderCommand(generationCommand(), { scenarioEnv: true }),
    followUpCommands: followUpCommands().map((command) => renderCommand(command)),
  };
  fs.mkdirSync(outputDir, { recursive: true });
  const artifactPath = path.join(outputDir, 'plan.json');
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return artifactPath;
}

// Row-level folds over the per-slice measurements the register scorer
// persists. Conservative rule, stated in the report: a row is faithful only
// if every scored determinate slice is faithful; any invalid slice makes the
// row invalid; otherwise the row is excluded noncompliance. Recovery is true
// if any faithful slice's judge verdict says the learner voiced the
// correction; a faithful row with any slice missing its recovery verdict
// fails the report closed.
function foldRow(row) {
  const scores = row.tutor_register_scores ? JSON.parse(row.tutor_register_scores) : {};
  const slices = Object.values(scores.sarcastic_determinate || {});
  const stanceLabels = slices.map((slice) => slice.stance_fidelity?.label).filter(Boolean);
  const anyInvalid = stanceLabels.includes('invalid_person_attack');
  const allFaithful = stanceLabels.length > 0 && stanceLabels.every((label) => label === 'faithful');
  const overalls = slices.map((slice) => slice.overall).filter((value) => Number.isFinite(value));
  const recoveries = slices.map((slice) => slice.negation_recovery || null);
  const recoveryMissing = slices.length === 0 || recoveries.some((value) => value == null);
  return {
    rowId: row.id,
    profileName: row.profile_name,
    scenarioId: row.scenario_id,
    targetSignal: String(row.scenario_id || '').replace('charisma_desire_resistance_breakthrough_', ''),
    tutorV22Score: row.tutor_first_turn_score,
    tutorRubricVersion: row.tutor_rubric_version,
    tutorJudgeModel: row.judge_model,
    registerRubricScore: overalls.length ? overalls.reduce((a, b) => a + b, 0) / overalls.length : null,
    registerJudgeModel: slices[0]?.judge_model || null,
    stanceFidelity: {
      applies: stanceLabels.length > 0,
      countsAsArmEvidence: allFaithful && !anyInvalid,
      countsAsExcludedNoncompliance: !allFaithful && !anyInvalid && stanceLabels.length > 0,
      countsAsInvalidViolation: anyInvalid,
      sliceLabels: stanceLabels,
    },
    recovery:
      allFaithful && !anyInvalid && !recoveryMissing
        ? { recovered: recoveries.some((value) => value?.recovered === true) }
        : recoveryMissing
          ? null
          : { recovered: false },
  };
}

async function runReport(runId, outputDir) {
  const { openEvaluationDbReadonly } = await import('../services/evaluationDbReadonly.js');
  const db = openEvaluationDbReadonly();
  if (!db) {
    console.log('[sarcasm-determinate-grid] no evaluation database found; nothing to report');
    return;
  }
  const rows = db
    .prepare(
      `SELECT id, profile_name, scenario_id, tutor_first_turn_score, tutor_rubric_version, judge_model, tutor_register_scores
       FROM evaluation_results WHERE run_id = ?`,
    )
    .all(runId);
  db.close();
  const analyses = rows.map(foldRow);
  const report = summarizeSarcasmDeterminateNegationGrid(analyses);
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${runId}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify({ runId, report, analyses }, null, 2)}\n`);
  console.log(
    `[sarcasm-determinate-grid] report ${report.status} (${report.observedRows}/${report.expectedRows} rows)`,
  );
  for (const error of report.errors) console.log(`  - ${error}`);
  console.log(`[sarcasm-determinate-grid] ${path.relative(ROOT, jsonPath)}`);
  if (report.status !== 'COMPLETE') throw new Error('effect-grid report failed closed');
}

async function runGeneration() {
  const command = generationCommand();
  await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: ROOT,
      env: { ...process.env, EVAL_SCENARIOS_FILE: GRID.scenarioSource },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`generation stopped by ${signal}`));
      else if (code !== 0) reject(new Error(`generation exited ${code}`));
      else resolve();
    });
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'launch-approved': { type: 'boolean', default: false },
      'expected-sha': { type: 'string', default: '' },
      'output-dir': { type: 'string', default: 'exports/sarcasm-determinate-negation-grid' },
      'report-run': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/run-sarcasm-determinate-negation-grid.js [--dry-run] [--launch-approved --expected-sha <sha>] [--report-run <runId>] [--output-dir <dir>]',
    );
    return;
  }
  if (values['dry-run'] && values['launch-approved']) throw new Error('choose either --dry-run or --launch-approved');
  if (values['report-run'] && values['launch-approved']) throw new Error('--report-run is a zero-call reporting mode');
  if (values['report-run']) {
    await runReport(values['report-run'], path.resolve(ROOT, values['output-dir']));
    return;
  }
  const launch = Boolean(values['launch-approved']);
  const plan = buildSarcasmDeterminateNegationGridPlan();
  const launchSha = launch ? assertLaunchAuthorization(values['expected-sha']) : null;
  const artifactPath = writePlanArtifact(plan, path.resolve(ROOT, values['output-dir']), { launchSha });
  console.log(`[sarcasm-determinate-grid] plan PASS; 0 model calls; ${plan.plannedRows} rows`);
  console.log(`[sarcasm-determinate-grid] plan SHA-256 ${plan.planSha256}`);
  console.log(`[sarcasm-determinate-grid] ${path.relative(ROOT, artifactPath)}`);
  if (!launch) {
    console.log('[sarcasm-determinate-grid] paid launch locked; use --launch-approved --expected-sha <clean-commit>');
    return;
  }
  await runGeneration();
  console.log('[sarcasm-determinate-grid] generation complete; use the printed run ID in these commands:');
  for (const command of followUpCommands()) console.log(renderCommand(command));
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[sarcasm-determinate-grid] ${error.message}`);
    process.exit(1);
  }
}
