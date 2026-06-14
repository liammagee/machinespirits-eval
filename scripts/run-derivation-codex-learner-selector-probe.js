#!/usr/bin/env node
/**
 * Selector probe launcher with configurable tutor/learner role providers.
 *
 * Queue discipline is run-major and world-parallel: r1 for each world enters
 * the queue before r2, so early divergence is not hidden behind a single
 * world's full batch. Defaults are intentionally paid-real, Codex/Codex, and
 * concurrency 5; use --dry-run to inspect commands.
 */

import 'dotenv/config';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const LOOP_SCRIPT = path.join(ROOT, 'scripts', 'run-derivation-loop.js');
const DEFAULT_LOG_BASE = 'exports/dramatic-derivation';
const DEFAULT_WORLDS = ['withercombe', 'fengate', 'hethel'];
const DEFAULT_ARMS = ['baseline', 'hidden', 'visible', 'selective-v1'];
const WORLD_CONFIG = {
  withercombe: {
    world: 'config/drama-derivation/world-004-withercombe.yaml',
    script: 'config/drama-derivation/tutor-scripts/withercombe-v001.md',
  },
  fengate: {
    world: 'config/drama-derivation/world-007-fengate.yaml',
    script: 'config/drama-derivation/tutor-scripts/fengate-v001.md',
  },
  hethel: {
    world: 'config/drama-derivation/world-006-hethel.yaml',
    script: 'config/drama-derivation/tutor-scripts/hethel-v001.md',
  },
};
const ARM_FLAGS = {
  baseline: [],
  hidden: ['--pacing-guard'],
  visible: ['--pacing-guard-visible'],
  'selective-v1': ['--pacing-guard-selective-v1'],
  'selective-v2': ['--pacing-guard-selective-v2'],
};
const COMMON_FLAGS = [
  '--real',
  '--superego',
  '--acts',
  '{"minActTurns":3,"maxActTurns":8}',
  '--decay',
  '{"rate":0.75,"graceTurns":1,"maxConcurrent":2,"startTurn":1,"mutateShare":1.0,"seed":1,"pool":"staged"}',
  '--confront',
  '--repair-clause',
  '--release-authority',
  '--plot',
  '--throughline',
  '--critic-feedback',
  'off',
  '--critic',
  'off',
];

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function has(name) {
  return process.argv.includes(`--${name}`);
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveFromRoot(p) {
  return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
}

function slugPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function learnerSlug({ learnerProvider, learnerModel }) {
  return slugPart(learnerModel) || slugPart(learnerProvider) || 'learner';
}

function labelFor({ world, arm, run, labelPrefix }) {
  return `${world}-${labelPrefix}-${arm}-r${run}`;
}

function loopDirFor(label, outDir) {
  return path.join(resolveFromRoot(outDir), label);
}

function completeArtifact(label, outDir) {
  const dir = loopDirFor(label, outDir);
  return ['diagnosis.json', 'result.json', 'transcript.md'].every((name) => fs.existsSync(path.join(dir, name)));
}

function buildEnv({ provider, model, learnerProvider, learnerModel }) {
  const env = { ...process.env };
  env.DERIVATION_PROVIDER = provider;
  if (model) env.DERIVATION_MODEL = model;
  else delete env.DERIVATION_MODEL;
  env.DERIVATION_LEARNER_PROVIDER = learnerProvider;
  if (learnerModel) env.DERIVATION_LEARNER_MODEL = learnerModel;
  else delete env.DERIVATION_LEARNER_MODEL;
  env.DERIVATION_CLI_TIMEOUT_MS = env.DERIVATION_CLI_TIMEOUT_MS || '900000';
  env.DERIVATION_LLM = 'real';
  env.DERIVATION_TRACE = env.DERIVATION_TRACE || '0';
  return env;
}

function buildJobs({ worlds, arms, runs, labelPrefix, outDir, group }) {
  const jobs = [];
  for (let run = 1; run <= runs; run += 1) {
    for (const arm of arms) {
      if (!ARM_FLAGS[arm]) throw new Error(`unknown arm "${arm}"`);
      for (const world of worlds) {
        const cfg = WORLD_CONFIG[world];
        if (!cfg) throw new Error(`unknown world "${world}"`);
        const label = labelFor({ world, arm, run, labelPrefix });
        const args = [
          LOOP_SCRIPT,
          '--world',
          cfg.world,
          '--script',
          cfg.script,
          '--label',
          label,
          '--out',
          outDir,
          '--group',
          group,
          ...COMMON_FLAGS,
          ...ARM_FLAGS[arm],
        ];
        jobs.push({ label, world, arm, run, args });
      }
    }
  }
  return jobs;
}

function shellLine(args) {
  return `node ${args.map((arg) => (/[\s"'{}]/.test(arg) ? JSON.stringify(arg) : arg)).join(' ')}`;
}

function runJob(job, { env, logDir, outDir, skipExisting }) {
  return new Promise((resolve) => {
    const logFile = path.join(logDir, `${job.label}.out`);
    if (skipExisting && completeArtifact(job.label, outDir)) {
      fs.writeFileSync(logFile, `skipped existing complete artifact: ${job.label}\n`);
      resolve({ ...job, status: 'skipped_existing_complete', exitCode: 0, logFile });
      return;
    }
    const log = fs.createWriteStream(logFile);
    log.write(`# ${job.label}\n# ${new Date().toISOString()}\n# ${shellLine(job.args)}\n\n`);
    const child = spawn(process.execPath, job.args, { cwd: ROOT, env });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('close', (code) => {
      log.end();
      resolve({ ...job, status: code === 0 ? 'ok' : 'failed', exitCode: code ?? 1, logFile });
    });
  });
}

async function pool(jobs, parallelism, worker) {
  const results = new Array(jobs.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(parallelism, jobs.length)) }, async () => {
    while (next < jobs.length) {
      const i = next;
      next += 1;
      results[i] = await worker(jobs[i], i);
    }
  });
  await Promise.all(lanes);
  return results;
}

function writeManifest(results, file) {
  const lines = ['label\tworld\tarm\trun\tstatus\texit_code\tlog'];
  for (const row of results) {
    lines.push(
      [
        row.label,
        row.world,
        row.arm,
        row.run,
        row.status,
        row.exitCode,
        path.relative(ROOT, row.logFile),
      ].join('\t'),
    );
  }
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

async function main() {
  if (has('help')) {
    console.log(`Usage: node scripts/run-derivation-codex-learner-selector-probe.js [--worlds a,b,c] [--arms baseline,hidden,visible,selective-v1,selective-v2] [--runs 5] [--parallelism 5] [--provider codex] [--model MODEL] [--learner-provider codex] [--learner-model MODEL] [--dry-run]`);
    return;
  }
  const worlds = splitCsv(arg('worlds', DEFAULT_WORLDS.join(',')));
  const arms = splitCsv(arg('arms', DEFAULT_ARMS.join(',')));
  const runs = Number(arg('runs', '5'));
  const parallelism = Number(arg('parallelism', '5'));
  const provider = arg('provider', 'codex');
  const model = arg('model', null);
  const learnerProvider = arg('learner-provider', 'codex');
  const learnerModel = arg('learner-model', null);
  const slug = learnerSlug({ learnerProvider, learnerModel });
  const labelPrefix = arg('label-prefix', `selector-${slug}learner`);
  const outDir = arg('out', 'exports/dramatic-derivation/loop');
  const logDir = resolveFromRoot(arg('log-dir', path.join(DEFAULT_LOG_BASE, `selector-${slug}-learner-run-logs`)));
  const group = arg('group', `selector-${slug}-learner-probe`);
  const skipExisting = !has('no-skip-existing');
  const jobs = buildJobs({ worlds, arms, runs, labelPrefix, outDir, group });

  console.log(
    `selector probe: ${jobs.length} jobs; parallelism ${parallelism}; worlds ${worlds.join(',')}; arms ${arms.join(',')}; runs ${runs}`,
  );
  console.log(
    `env: DERIVATION_PROVIDER=${provider}${model ? ` DERIVATION_MODEL=${model}` : ''} DERIVATION_LEARNER_PROVIDER=${learnerProvider}${learnerModel ? ` DERIVATION_LEARNER_MODEL=${learnerModel}` : ''} DERIVATION_LLM=real DERIVATION_TRACE=0`,
  );
  console.log('queue: run-major, arm-major, world-minor; first jobs:');
  for (const job of jobs.slice(0, Math.min(10, jobs.length))) {
    console.log(`  ${job.label}`);
  }

  if (has('dry-run')) {
    for (const job of jobs) console.log(`\n${job.label}\n  ${shellLine(job.args)}`);
    return;
  }

  fs.mkdirSync(logDir, { recursive: true });
  const env = buildEnv({ provider, model, learnerProvider, learnerModel });
  const partialResults = [];
  const results = await pool(jobs, parallelism, async (job) => {
    console.log(`  ▶ ${job.label}`);
    const started = Date.now();
    const result = await runJob(job, { env, logDir, outDir, skipExisting });
    console.log(
      `  ${result.status === 'ok' || result.status === 'skipped_existing_complete' ? '✔' : '✘'} ${job.label} ${result.status} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
    partialResults.push(result);
    writeManifest(partialResults, path.join(logDir, 'manifest.partial.tsv'));
    return result;
  });
  writeManifest(results, path.join(logDir, 'manifest.tsv'));
  const failed = results.filter((row) => row.status === 'failed');
  console.log(`done: ${results.length - failed.length}/${results.length} ok/skipped; manifest ${path.relative(ROOT, path.join(logDir, 'manifest.tsv'))}`);
  if (failed.length) process.exitCode = 1;
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

export { buildJobs, labelFor };
