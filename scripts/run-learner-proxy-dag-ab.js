#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeLearnerDagBatch } from './analyze-derivation-learner-dag-batch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORLD = 'config/drama-derivation/world-001-nocturne.yaml';
const DEFAULT_SCRIPT = 'config/drama-derivation/tutor-scripts/nocturne-v001.md';
const DEFAULT_RUN_DIR = 'exports/dramatic-derivation/loop';
const DEFAULT_REPORT_DIR = 'exports/dramatic-derivation/learner-proxy-dag-ab';

function usage() {
  return `Usage:
  node scripts/run-learner-proxy-dag-ab.js \\
    [--world config/drama-derivation/world-001-nocturne.yaml] \\
    [--script config/drama-derivation/tutor-scripts/nocturne-v001.md] \\
    [--out exports/dramatic-derivation/loop] \\
    [--report-dir exports/dramatic-derivation/learner-proxy-dag-ab] \\
    [--label-prefix proxy-dag-ab-<timestamp>] [--real] [--include-gated-proxy] [--dry-run]

Runs the same world/script twice: control, then --learner-proxy-dag + --proxy-dag-pacing.
With --include-gated-proxy, also runs proxy DAG + proxy pacing + same-turn assertion affordance.
Then writes the learner-DAG batch diagnostic for the selected labels.`;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/T/, '-').replace(/\..+$/, '');
}

function arg(argv, name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
}

function flag(argv, name) {
  return argv.includes(`--${name}`);
}

function resolveRepoPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

export function parseProxyDagABArgs(argv = []) {
  if (flag(argv, 'help') || flag(argv, 'h')) return { help: true };
  return {
    help: false,
    world: arg(argv, 'world', DEFAULT_WORLD),
    script: arg(argv, 'script', DEFAULT_SCRIPT),
    out: arg(argv, 'out', DEFAULT_RUN_DIR),
    reportDir: arg(argv, 'report-dir', DEFAULT_REPORT_DIR),
    labelPrefix: arg(argv, 'label-prefix', `proxy-dag-ab-${timestamp()}`),
    real: flag(argv, 'real'),
    includeGatedProxy: flag(argv, 'include-gated-proxy'),
    dryRun: flag(argv, 'dry-run'),
  };
}

export function planLearnerProxyDagAB({
  world = DEFAULT_WORLD,
  script = DEFAULT_SCRIPT,
  out = DEFAULT_RUN_DIR,
  reportDir = DEFAULT_REPORT_DIR,
  labelPrefix = `proxy-dag-ab-${timestamp()}`,
  real = false,
  includeGatedProxy = false,
} = {}) {
  const controlLabel = `${labelPrefix}-control`;
  const proxyLabel = `${labelPrefix}-proxy`;
  const gatedProxyLabel = `${labelPrefix}-proxy-gated`;
  const common = [
    'scripts/run-derivation-loop.js',
    '--world',
    world,
    '--script',
    script,
    '--out',
    out,
    '--critic',
    'off',
    ...(real ? ['--real'] : []),
  ];
  const plan = {
    runDir: resolveRepoPath(out),
    reportDir: path.join(resolveRepoPath(reportDir), labelPrefix),
    labels: [controlLabel, proxyLabel],
    commands: [
      {
        arm: 'control',
        label: controlLabel,
        args: [...common, '--label', controlLabel, '--note', 'learner proxy-DAG A/B control'],
      },
      {
        arm: 'proxy',
        label: proxyLabel,
        args: [
          ...common,
          '--label',
          proxyLabel,
          '--note',
          'learner proxy-DAG A/B treatment',
          '--learner-proxy-dag',
          '--proxy-dag-pacing',
        ],
      },
    ],
  };
  if (includeGatedProxy) {
    plan.labels.push(gatedProxyLabel);
    plan.commands.push({
      arm: 'proxy-gated',
      label: gatedProxyLabel,
      args: [
        ...common,
        '--label',
        gatedProxyLabel,
        '--note',
        'learner proxy-DAG treatment with assertion grounding gate',
        '--learner-proxy-dag',
        '--proxy-dag-pacing',
        '--same-turn-assertion-affordance',
      ],
    });
  }
  return plan;
}

export function runLearnerProxyDagAB(plan, { dryRun = false } = {}) {
  if (dryRun) return { plan, summary: null };
  for (const command of plan.commands) {
    console.log(`\n[${command.arm}] node ${command.args.join(' ')}`);
    const result = spawnSync(process.execPath, command.args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${command.arm} run failed with status ${result.status}`);
    }
  }
  const summary = analyzeLearnerDagBatch({
    runDir: plan.runDir,
    outDir: plan.reportDir,
    labels: plan.labels,
  });
  return { plan, summary };
}

async function main() {
  const opts = parseProxyDagABArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }
  const plan = planLearnerProxyDagAB(opts);
  if (opts.dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  const { summary } = runLearnerProxyDagAB(plan);
  console.log(`\nWrote learner proxy-DAG A/B diagnostic to ${summary.outDir}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
