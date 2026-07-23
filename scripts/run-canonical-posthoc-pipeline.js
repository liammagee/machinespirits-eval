#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateCanonicalPosthocInputs } from '../services/canonicalPosthocContract.js';
import { resolveTutorDialoguesDir } from '../services/evaluationDataPaths.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    const value = argv[i + 1];
    if (value != null && !value.startsWith('--')) options[name] = argv[++i];
  }
  return options;
}

function usage() {
  console.log(`Usage:
  node scripts/run-canonical-posthoc-pipeline.js \\
    --db <evaluations.db> --logs <logs-or-tutor-dialogues-dir> \\
    --run-id <runId> --judge <primaryJudge> --output-dir <dir>

Runs the five canonical post-hoc commands after enforcing a strict rubric,
judge, provenance, and trace-schema boundary. No network or model calls occur.`);
}

function runScript(scriptName, args, env) {
  const result = spawnSync(process.execPath, [path.join(ROOT_DIR, 'scripts', scriptName), ...args], {
    cwd: ROOT_DIR,
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${scriptName} exited with status ${result.status}`);
  }
}

const options = parseArgs(process.argv.slice(2));
if (process.argv.includes('--help')) {
  usage();
  process.exit(0);
}

const required = ['db', 'logs', 'run-id', 'judge', 'output-dir'];
const missing = required.filter((name) => !options[name]);
if (missing.length > 0) {
  usage();
  console.error(`Missing required option(s): ${missing.map((name) => `--${name}`).join(', ')}`);
  process.exit(1);
}

const dbPath = path.resolve(options.db);
const logsDir = resolveTutorDialoguesDir(ROOT_DIR, path.resolve(options.logs));
const outputDir = path.resolve(options['output-dir']);
const runId = options['run-id'];
const primaryJudge = options.judge;

try {
  const manifest = validateCanonicalPosthocInputs({
    rootDir: ROOT_DIR,
    dbPath,
    logsDir,
    runId,
    primaryJudge,
  });

  fs.mkdirSync(outputDir, { recursive: true });
  const outputs = {
    effects: 'effects.json',
    traces: 'mechanism-traces.json',
    trajectories: 'trajectories.json',
    stagnation: 'stagnation.json',
    reliability: 'reliability.json',
  };
  const env = {
    ...process.env,
    NODE_NO_WARNINGS: '1',
    EVAL_DB_PATH: dbPath,
    EVAL_LOGS_DIR: logsDir,
  };

  runScript(
    'analyze-eval-results.js',
    [
      '--db',
      dbPath,
      '--run-id',
      runId,
      '--judge',
      primaryJudge,
      '--epoch',
      'all',
      '--export',
      path.join(outputDir, outputs.effects),
    ],
    env,
  );
  runScript(
    'analyze-mechanism-traces.js',
    [
      runId,
      '--db',
      dbPath,
      '--logs',
      logsDir,
      '--judge',
      primaryJudge,
      '--output',
      path.join(outputDir, 'mechanism-traces.md'),
      '--json',
    ],
    env,
  );
  runScript(
    'analyze-trajectory-curves.js',
    [
      runId,
      '--db',
      dbPath,
      '--judge',
      primaryJudge,
      '--epoch',
      'all',
      '--min-turns',
      '3',
      '--json',
      path.join(outputDir, outputs.trajectories),
    ],
    env,
  );
  runScript(
    'analyze-learning-stagnation.js',
    [
      runId,
      '--db',
      dbPath,
      '--logs',
      logsDir,
      '--judge',
      primaryJudge,
      '--json',
      path.join(outputDir, outputs.stagnation),
    ],
    env,
  );
  runScript(
    'analyze-judge-reliability.js',
    ['--db', dbPath, '--run', runId, '--epoch', 'all', '--json', path.join(outputDir, outputs.reliability)],
    env,
  );

  const completedManifest = { ...manifest, outputs };
  fs.writeFileSync(path.join(outputDir, 'pipeline-manifest.json'), `${JSON.stringify(completedManifest, null, 2)}\n`);
  console.log(`Canonical post-hoc pipeline complete: ${outputDir}`);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
