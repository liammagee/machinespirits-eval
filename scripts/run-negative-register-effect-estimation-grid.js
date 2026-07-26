#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  buildNegativeRegisterEffectGridPlan,
  NEGATIVE_REGISTER_EFFECT_GRID,
  validateNegativeRegisterEffectGridPlan,
} from '../services/negativeRegisterEffectGrid.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export function generationCommand() {
  return [
    process.execPath,
    'scripts/eval-cli.js',
    'run',
    '--profiles',
    NEGATIVE_REGISTER_EFFECT_GRID.profiles.join(','),
    '--scenarios',
    NEGATIVE_REGISTER_EFFECT_GRID.scenarios.join(','),
    '--runs',
    String(NEGATIVE_REGISTER_EFFECT_GRID.repeats),
    '--parallelism',
    String(NEGATIVE_REGISTER_EFFECT_GRID.generation.parallelism),
    '--skip-rubric',
    '--tutor-model',
    NEGATIVE_REGISTER_EFFECT_GRID.generation.tutorModel,
    '--learner-model',
    NEGATIVE_REGISTER_EFFECT_GRID.generation.learnerModel,
    '--description',
    'Negative register effect estimation grid v1',
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
      NEGATIVE_REGISTER_EFFECT_GRID.scoring.tutorJudgeCli,
      '--model',
      NEGATIVE_REGISTER_EFFECT_GRID.scoring.tutorJudgeModel,
      '--parallelism',
      '1',
    ],
    [
      process.execPath,
      'scripts/evaluate-register-rubric.js',
      runId,
      '--judge',
      NEGATIVE_REGISTER_EFFECT_GRID.scoring.registerJudge,
    ],
    [process.execPath, 'scripts/run-negative-register-effect-estimation-grid.js', '--report-run', runId],
  ];
}

function shellQuote(value) {
  const raw = String(value);
  return /^[A-Za-z0-9_./:=,-]+$/u.test(raw) ? raw : `'${raw.replaceAll("'", "'\\''")}'`;
}

function renderCommand(command, { scenarioEnv = false } = {}) {
  const prefix = scenarioEnv ? `EVAL_SCENARIOS_FILE=${NEGATIVE_REGISTER_EFFECT_GRID.scenarioSource} ` : '';
  return `${prefix}${command.map(shellQuote).join(' ')}`;
}

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

export function assertNegativeRegisterLaunchAuthorization(expectedSha) {
  if (!/^[0-9a-f]{40}$/u.test(expectedSha || '')) {
    throw new Error('--launch-approved also requires --expected-sha with the exact 40-character clean commit SHA');
  }
  const head = gitOutput(['rev-parse', 'HEAD']);
  if (head !== expectedSha) throw new Error(`launch SHA mismatch: expected ${expectedSha}, checkout is ${head}`);
  if (gitOutput(['status', '--porcelain'])) throw new Error('paid launch requires a clean checkout');
  return head;
}

function writePlanArtifact(plan, outputDir, { launchSha = null } = {}) {
  const validation = validateNegativeRegisterEffectGridPlan(plan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const artifact = {
    schema: 'machinespirits.negative-register-effect-grid-dry-run.v1',
    modelCalls: 0,
    storageWritesBeforeArtifact: 0,
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

async function runGeneration() {
  const command = generationCommand();
  await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: ROOT,
      env: { ...process.env, EVAL_SCENARIOS_FILE: NEGATIVE_REGISTER_EFFECT_GRID.scenarioSource },
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
      'output-dir': { type: 'string', default: 'exports/negative-register-effect-grid' },
      'report-run': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/run-negative-register-effect-estimation-grid.js [--dry-run] [--launch-approved --expected-sha <sha>] [--report-run <runId>] [--output-dir <dir>]',
    );
    return;
  }
  if (values['dry-run'] && values['launch-approved']) throw new Error('choose either --dry-run or --launch-approved');
  if (values['report-run'] && values['launch-approved']) throw new Error('--report-run is a zero-call reporting mode');
  if (values['report-run']) {
    const command = [
      process.execPath,
      'scripts/report-charisma-desire-breakthrough-matrix.js',
      '--runs',
      values['report-run'],
      '--effect-grid',
      '--output-json',
      path.join(values['output-dir'], `${values['report-run']}.json`),
      '--output-md',
      path.join(values['output-dir'], `${values['report-run']}.md`),
    ];
    const result = spawnSync(command[0], command.slice(1), { cwd: ROOT, env: process.env, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`effect-grid report exited ${result.status}`);
    return;
  }
  const launch = Boolean(values['launch-approved']);
  const plan = buildNegativeRegisterEffectGridPlan();
  const launchSha = launch ? assertNegativeRegisterLaunchAuthorization(values['expected-sha']) : null;
  const artifactPath = writePlanArtifact(plan, path.resolve(ROOT, values['output-dir']), { launchSha });
  console.log(`[negative-register-grid] plan PASS; 0 model calls; ${plan.plannedRows} rows`);
  console.log(`[negative-register-grid] plan SHA-256 ${plan.planSha256}`);
  console.log(`[negative-register-grid] ${path.relative(ROOT, artifactPath)}`);
  if (!launch) {
    console.log('[negative-register-grid] paid launch locked; use --launch-approved --expected-sha <clean-commit>');
    return;
  }
  await runGeneration();
  console.log('[negative-register-grid] generation complete; use the printed run ID in these commands:');
  for (const command of followUpCommands()) console.log(renderCommand(command));
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[negative-register-grid] ${error.message}`);
    process.exit(1);
  }
}
