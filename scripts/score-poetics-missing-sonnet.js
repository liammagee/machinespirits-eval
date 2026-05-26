#!/usr/bin/env node
/**
 * Backfill Sonnet scoring for an existing poetics batch root.
 *
 * The production runner now includes Sonnet by default, but older calibration
 * roots were often scored with only Qwen/Gemini/DeepSeek. This script rebuilds
 * the score-job list from batch-plan.json and runs only the missing Sonnet jobs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createProgressReporter } from './progress.js';
import { modelSlug } from './run-poetics-production-batch.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const CAL_DIR = path.join(ROOT, 'config', 'poetics-calibration');
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6';

function parseArgs(argv) {
  const args = {
    rootDir: null,
    runId: null,
    model: DEFAULT_MODEL,
    scoreConcurrency: 3,
    dryRun: false,
    force: false,
    mock: false,
    allowQualityWarnings: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--root-dir') args.rootDir = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--model') args.model = argv[++i];
    else if (token === '--score-concurrency') args.scoreConcurrency = parseInt(argv[++i], 10);
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--force') args.force = true;
    else if (token === '--mock') args.mock = true;
    else if (token === '--allow-quality-warnings') args.allowQualityWarnings = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/score-poetics-missing-sonnet.js --run-id RUN_ID [--dry-run]
  node scripts/score-poetics-missing-sonnet.js --root-dir DIR [--force]

Options:
  --model MODEL                 scorer model (default: ${DEFAULT_MODEL})
  --score-concurrency N         transcript concurrency inside each scorer job (default: 3)
  --allow-quality-warnings      pass through to score-poetics-phase2.js
  --mock                        smoke-test with mock scorer
  --force                       rewrite existing model score artifacts`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }

  if (!args.rootDir && !args.runId) throw new Error('--run-id or --root-dir is required');
  if (!Number.isInteger(args.scoreConcurrency) || args.scoreConcurrency < 1) {
    throw new Error('--score-concurrency must be a positive integer');
  }
  args.rootDir = args.rootDir || path.join(CAL_DIR, args.runId);
  return args;
}

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

function absFromRoot(p) {
  return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadBatchPlan(rootDir) {
  const planPath = path.join(rootDir, 'batch-plan.json');
  if (!fs.existsSync(planPath)) throw new Error(`missing batch plan: ${planPath}`);
  return readJson(planPath);
}

function ensurePlanIncludesCritic(rootDir, model, { dryRun = false } = {}) {
  const planPath = path.join(rootDir, 'batch-plan.json');
  const plan = loadBatchPlan(rootDir);
  const critics = Array.isArray(plan.critics) ? plan.critics : [];
  if (critics.includes(model)) return false;
  if (dryRun) return true;
  plan.critics = [...critics, model];
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  return true;
}

function unitArms(unit) {
  const keyPath = absFromRoot(unit.keyPath);
  const outDir = absFromRoot(unit.outDir);
  if (!unit.pairedPolicies) {
    return [{ id: unit.id, sampleDir: outDir, keyPath }];
  }

  const arms = unit.pairedPolicies.map((policy) => ({
    id: `${unit.id}-${policy}`,
    sampleDir: path.join(outDir, policy),
    keyPath: path.join(path.dirname(keyPath), `key-${policy}.yaml`),
  }));

  const prefixKeyPath = path.join(path.dirname(keyPath), 'key-prefix-baseline.yaml');
  const prefixSampleDir = path.join(outDir, 'prefix-baseline');
  if (fs.existsSync(prefixKeyPath) && fs.existsSync(prefixSampleDir) && !unit.pairedPolicies.includes('prefix-baseline')) {
    arms.push({
      id: `${unit.id}-prefix-baseline`,
      sampleDir: prefixSampleDir,
      keyPath: prefixKeyPath,
    });
  }

  return arms;
}

function buildScorePlan({ rootDir, model = DEFAULT_MODEL, force = false }) {
  const plan = loadBatchPlan(rootDir);
  const modelArtifactSlug = modelSlug(model);
  const jobs = [];
  const skipped = [];
  const missingInputs = [];

  for (const unit of plan.units || []) {
    for (const arm of unitArms(unit)) {
      const outPath = path.join(rootDir, 'scores', `${arm.id}-${modelArtifactSlug}.json`);
      const job = {
        ...arm,
        model,
        outPath,
      };
      if (!fs.existsSync(arm.sampleDir) || !fs.existsSync(arm.keyPath)) {
        missingInputs.push(job);
      } else if (!force && fs.existsSync(outPath)) {
        skipped.push(job);
      } else {
        jobs.push(job);
      }
    }
  }

  return {
    rootDir,
    batchId: plan.batchId || path.basename(rootDir),
    model,
    jobs,
    skipped,
    missingInputs,
  };
}

function scoreCommand(job, args) {
  const cmd = [
    process.execPath,
    'scripts/score-poetics-phase2.js',
    '--model',
    job.model,
    '--sample-dir',
    job.sampleDir,
    '--key',
    job.keyPath,
    '--out',
    job.outPath,
    '--concurrency',
    String(args.scoreConcurrency),
  ];
  if (args.mock) cmd.push('--mock');
  if (args.allowQualityWarnings) cmd.push('--allow-quality-warnings');
  return cmd;
}

function printableCommand(cmd) {
  return cmd.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(' ');
}

function runCommand(cmd, args) {
  if (args.dryRun) {
    console.log(`  ${printableCommand(cmd)}`);
    return;
  }
  fs.mkdirSync(path.dirname(cmd[cmd.indexOf('--out') + 1]), { recursive: true });
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env },
  });
  if (result.status !== 0) throw new Error(`command failed (${result.status}): ${printableCommand(cmd)}`);
}

function runPlan(args) {
  const plan = buildScorePlan(args);
  console.log(`\n══ Sonnet poetics scoring backfill ${plan.batchId} ══`);
  console.log(`  root: ${rel(plan.rootDir)}`);
  console.log(`  model: ${plan.model}${args.mock ? ' (mock)' : ''}`);
  console.log(`  missing scorer jobs: ${plan.jobs.length}`);
  console.log(`  existing scorer jobs skipped: ${plan.skipped.length}`);
  if (plan.missingInputs.length) {
    console.warn(`  missing input arms ignored: ${plan.missingInputs.length}`);
    for (const job of plan.missingInputs) {
      console.warn(`    - ${job.id}: ${rel(job.sampleDir)} / ${rel(job.keyPath)}`);
    }
  }

  const progress = createProgressReporter({
    label: 'sonnet backfill',
    total: plan.jobs.length,
    enabled: !args.dryRun,
  });
  progress.start(`${plan.jobs.length} scorer job(s)`);
  for (const job of plan.jobs) {
    console.log(`\n# ${job.id} · ${job.model}`);
    progress.note(`${job.id} starting`);
    runCommand(scoreCommand(job, args), args);
    progress.step(`${job.id} complete`);
  }
  progress.finish('Sonnet backfill complete');
  const planUpdated = ensurePlanIncludesCritic(plan.rootDir, plan.model, { dryRun: args.dryRun });
  if (planUpdated) {
    console.log(
      args.dryRun
        ? `would add ${plan.model} to ${rel(path.join(plan.rootDir, 'batch-plan.json'))}`
        : `added ${plan.model} to ${rel(path.join(plan.rootDir, 'batch-plan.json'))}`,
    );
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    runPlan(parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

export { DEFAULT_MODEL, buildScorePlan, ensurePlanIncludesCritic, parseArgs, scoreCommand, unitArms };
