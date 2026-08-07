#!/usr/bin/env node

// Frozen launcher for the sarcasm-precondition grid
// (notes/2026-08-07-sarcasm-precondition-preregistration.md).
//
// Same discipline as the parent grids: --dry-run prints the plan SHA with zero
// model calls; a paid launch needs --launch-approved plus the exact
// clean-checkout commit SHA; --report-run is a zero-call fail-closed report.
//
// One difference from the parent, and it is the point. The determinate grid
// folded stance verdicts itself from persisted slices while taking its outcome
// verdict from the matrix reporter — two sources at two folds, which is how a
// gate/fold mismatch reached a published number. Here the report takes EVERY
// registered measure from the matrix reporter's analysis rows, at the single
// adopting turn, so there is only one fold to name.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  buildSarcasmPreconditionGridPlan,
  SARCASM_PRECONDITION_GRID,
  summarizeSarcasmPreconditionGrid,
  validateSarcasmPreconditionGridPlan,
} from '../services/sarcasmPreconditionGrid.js';
import { isPositiveLocalOutcome } from './run-sarcasm-determinate-negation-grid.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const GRID = SARCASM_PRECONDITION_GRID;

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
    'Sarcasm precondition grid v1',
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
    [process.execPath, 'scripts/run-sarcasm-precondition-grid.js', '--report-run', runId],
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
  const validation = validateSarcasmPreconditionGridPlan(plan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const artifact = {
    schema: 'machinespirits.sarcasm-precondition-grid-dry-run.v1',
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

/**
 * Every registered measure comes from here, in one pass: the stance verdict at
 * the adopting turn (with its gate identity and named-claim component), the
 * tutor v2.2 and register-rubric scores with their judge labels, and the
 * parent grid's own positive-local-outcome verdict. Zero model calls — the
 * reporter derives all of it from the dialogue logs and stored scores.
 */
export function analysisRows(runId, { root = ROOT, execPath = process.execPath } = {}) {
  const jsonPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sarcasm-precondition-')), `${runId}.json`);
  const result = spawnSync(
    execPath,
    [
      'scripts/report-charisma-desire-breakthrough-matrix.js',
      '--runs',
      runId,
      '--output-json',
      jsonPath,
      '--output-md',
      `${jsonPath}.md`,
    ],
    { cwd: root, env: process.env, stdio: 'ignore' },
  );
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`matrix analyses unavailable (matrix reporter exited ${result.status})`);
  }
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  return (parsed.analyses || []).map((row) => ({
    ...row,
    positiveOutcome: isPositiveLocalOutcome(row.verdict),
  }));
}

function formatContrast(entry) {
  const p = entry.p == null ? 'n/a' : entry.p.toFixed(4);
  return `${entry.label}: claimed ${entry.claimed} vs plain ${entry.plain} (Fisher p=${p})`;
}

function runReport(runId, outputDir) {
  const analyses = analysisRows(runId);
  const report = summarizeSarcasmPreconditionGrid(analyses);
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${runId}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify({ runId, report, analyses }, null, 2)}\n`);
  console.log(
    `[sarcasm-precondition-grid] report ${report.status} (${report.observedRows}/${report.expectedRows} rows)`,
  );
  console.log(
    `[sarcasm-precondition-grid] gate ${report.measurement.gateRegister}@${report.measurement.gateVersion} ` +
      `fold ${report.measurement.fold}`,
  );
  for (const error of report.errors) console.log(`  - ${error}`);
  if (report.status === 'COMPLETE') {
    for (const key of ['manipulation', 'primary', 'outcome']) {
      console.log(`[sarcasm-precondition-grid] ${formatContrast(report.contrasts[key])}`);
    }
    console.log(`[sarcasm-precondition-grid] verdict ${report.verdict}`);
  }
  console.log(`[sarcasm-precondition-grid] ${path.relative(ROOT, jsonPath)}`);
  if (report.status !== 'COMPLETE') throw new Error('sarcasm-precondition report failed closed');
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
      'output-dir': { type: 'string', default: 'exports/sarcasm-precondition-grid' },
      'report-run': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/run-sarcasm-precondition-grid.js [--dry-run] [--launch-approved --expected-sha <sha>] [--report-run <runId>] [--output-dir <dir>]',
    );
    return;
  }
  if (values['dry-run'] && values['launch-approved']) throw new Error('choose either --dry-run or --launch-approved');
  if (values['report-run'] && values['launch-approved']) throw new Error('--report-run is a zero-call reporting mode');
  if (values['report-run']) {
    runReport(values['report-run'], path.resolve(ROOT, values['output-dir']));
    return;
  }
  const launch = Boolean(values['launch-approved']);
  const plan = buildSarcasmPreconditionGridPlan();
  const launchSha = launch ? assertLaunchAuthorization(values['expected-sha']) : null;
  const artifactPath = writePlanArtifact(plan, path.resolve(ROOT, values['output-dir']), { launchSha });
  console.log(`[sarcasm-precondition-grid] plan PASS; 0 model calls; ${plan.plannedRows} rows`);
  console.log(`[sarcasm-precondition-grid] plan SHA-256 ${plan.planSha256}`);
  console.log(`[sarcasm-precondition-grid] ${path.relative(ROOT, artifactPath)}`);
  if (!launch) {
    console.log('[sarcasm-precondition-grid] paid launch locked; use --launch-approved --expected-sha <clean-commit>');
    return;
  }
  await runGeneration();
  console.log('[sarcasm-precondition-grid] generation complete; use the printed run ID in these commands:');
  for (const command of followUpCommands()) console.log(renderCommand(command));
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[sarcasm-precondition-grid] ${error.message}`);
    process.exit(1);
  }
}
