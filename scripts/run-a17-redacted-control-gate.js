#!/usr/bin/env node
/**
 * A17 D5 redacted-control gate runner.
 *
 * Safe by default:
 *   - --dry-run plans only; no writes, no LLM calls.
 *   - --mock runs generator + QA with stubs.
 *   - real metered mode requires BOTH --approve-paid and
 *     A17_PAID_GATE_APPROVED=YES in the environment.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const DEFAULTS = {
  root: path.join(ROOT, 'exports', 'a17-one-side-replay-replication', 'd5-redacted-control-run4'),
  spec: path.join(ROOT, 'config', 'poetics-calibration', 'oedipus-pilot-v2.yaml'),
  envFile: '/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env',
  variationKey: 'a17-d5-redacted-control-run4',
  generator: 'api',
  apiModel: 'sonnet',
  maxTurns: 6,
  panel: 'qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro,gpt',
};

function usage() {
  return `Usage:
  node scripts/run-a17-redacted-control-gate.js --dry-run
  node scripts/run-a17-redacted-control-gate.js --mock --root /tmp/a17-gate-smoke --force
  A17_PAID_GATE_APPROVED=YES node scripts/run-a17-redacted-control-gate.js --approve-paid

Options:
  --dry-run              Plan the generator command only; no writes, no LLM calls.
  --mock                 Run generator + QA with mock LLM/scorer paths.
  --approve-paid         Required for real metered generation + QA.
  --force                Allow overwriting an existing output root.
  --root DIR             Output root. Default: ${path.relative(ROOT, DEFAULTS.root)}
  --spec FILE            Scenario spec. Default: ${path.relative(ROOT, DEFAULTS.spec)}
  --env-file FILE        dotenv file passed to child commands.
  --variation-key KEY    Director variation key. Default: ${DEFAULTS.variationKey}
  --api-model MODEL      Generator API model alias. Default: ${DEFAULTS.apiModel}
  --panel CSV            QA panel. Default: ${DEFAULTS.panel}
  --max-turns N          Generator max turns. Default: ${DEFAULTS.maxTurns}`;
}

function parseArgs(argv) {
  const args = {
    ...DEFAULTS,
    dryRun: false,
    mock: false,
    approvePaid: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--dry-run') args.dryRun = true;
    else if (token === '--mock') args.mock = true;
    else if (token === '--approve-paid') args.approvePaid = true;
    else if (token === '--force') args.force = true;
    else if (token === '--root') args.root = path.resolve(argv[++i]);
    else if (token === '--spec') args.spec = path.resolve(argv[++i]);
    else if (token === '--env-file') args.envFile = path.resolve(argv[++i]);
    else if (token === '--variation-key') args.variationKey = argv[++i];
    else if (token === '--api-model') args.apiModel = argv[++i];
    else if (token === '--panel') args.panel = argv[++i];
    else if (token === '--max-turns') args.maxTurns = Number(argv[++i]);
    else if (token === '-h' || token === '--help') {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}\n\n${usage()}`);
    }
  }
  if (args.dryRun && args.mock) throw new Error('use --dry-run or --mock, not both');
  if (!Number.isInteger(args.maxTurns) || args.maxTurns < 1) throw new Error('--max-turns must be a positive integer');
  return args;
}

function dotenvValue(file, name) {
  if (!file || !fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || match[1] !== name) continue;
    return match[2].replace(/^['"]|['"]$/g, '').trim() || null;
  }
  return null;
}

function childEnv(args) {
  return {
    ...process.env,
    DOTENV_CONFIG_PATH: args.envFile,
  };
}

function runNode(script, scriptArgs, args) {
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd: ROOT,
    env: childEnv(args),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${script} exited ${result.status}`);
  }
}

function ensurePreconditions(args) {
  if (!fs.existsSync(args.spec)) throw new Error(`spec not found: ${args.spec}`);
  if (!args.dryRun && fs.existsSync(args.root) && !args.force) {
    throw new Error(`output root already exists: ${args.root} (pass --force only if overwriting is intended)`);
  }
  const paid = !args.dryRun && !args.mock;
  if (!paid) return;
  if (!args.approvePaid || process.env.A17_PAID_GATE_APPROVED !== 'YES') {
    throw new Error('paid mode requires --approve-paid and A17_PAID_GATE_APPROVED=YES');
  }
  const keyAvailable = Boolean(process.env.OPENROUTER_API_KEY || dotenvValue(args.envFile, 'OPENROUTER_API_KEY'));
  if (!keyAvailable) {
    throw new Error(`OPENROUTER_API_KEY not found in environment or ${args.envFile}`);
  }
}

function generatorArgs(args) {
  const argv = [
    '--spec',
    args.spec,
    '--only',
    'D_OED5',
    '--paired-adaptation-arms',
    'none',
    '--max-turns',
    String(args.maxTurns),
    '--director-variation-key',
    args.variationKey,
    '--out-dir',
    path.join(args.root, 'sample'),
    '--delib-dir',
    path.join(args.root, 'deliberation'),
    '--transcripts-dir',
    path.join(args.root, 'transcripts'),
    '--key',
    path.join(args.root, 'key.yaml'),
    '--generation-concurrency',
    '1',
  ];
  if (args.mock) argv.unshift('--mock');
  else argv.unshift('--generator', args.generator, '--api-model', args.apiModel);
  if (args.dryRun) argv.push('--dry-run');
  if (args.force || args.mock) argv.push('--force');
  return argv;
}

function qaArgs(args) {
  const argv = [
    '--sample-root',
    args.root,
    '--spec',
    args.spec,
    '--arms',
    'none',
    '--panel',
    args.panel,
    '--out',
    path.join(args.root, 'qa-oedipus-arms.json'),
  ];
  if (args.mock) argv.push('--mock');
  return argv;
}

function verifyGeneratedControl(args) {
  const keyPath = path.join(args.root, 'key-none.yaml');
  const tracePath = path.join(args.root, 'deliberation', 'none', 'T01.json');
  const transcriptPath = path.join(args.root, 'sample', 'none', 'T01.txt');
  const directorPath = path.join(args.root, 'director-none.json');
  for (const file of [keyPath, tracePath, transcriptPath, directorPath]) {
    if (!fs.existsSync(file)) throw new Error(`expected artifact missing: ${file}`);
  }
  const key = yaml.parse(fs.readFileSync(keyPath, 'utf8')) || {};
  const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  if (key.tutor_adaptation_policy !== 'withhold_secret') {
    throw new Error(`key-none.yaml did not record withhold_secret: ${key.tutor_adaptation_policy}`);
  }
  if (trace.run?.tutor_adaptation_policy !== 'withhold_secret') {
    throw new Error(`trace did not record withhold_secret: ${trace.run?.tutor_adaptation_policy}`);
  }
}

function summarizeQa(args) {
  const qaPath = path.join(args.root, 'qa-oedipus-arms.json');
  const qa = JSON.parse(fs.readFileSync(qaPath, 'utf8'));
  const first = qa.results?.[0] || {};
  console.log(
    JSON.stringify(
      {
        root: path.relative(ROOT, args.root),
        allPass: qa.allPass,
        invariant: first.invariant,
        status: first.status,
        detail: first.detail,
        evidence: first.evidence || '',
      },
      null,
      2,
    ),
  );
  if (!qa.allPass) process.exitCode = 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  ensurePreconditions(args);
  console.log(
    `[a17] ${args.dryRun ? 'dry-run' : args.mock ? 'mock' : 'PAID'} redacted D5 control gate -> ${path.relative(
      ROOT,
      args.root,
    )}`,
  );
  runNode('scripts/generate-pedagogical-dramas.js', generatorArgs(args), args);
  if (args.dryRun) return;
  verifyGeneratedControl(args);
  runNode('scripts/qa-oedipus-arms.js', qaArgs(args), args);
  summarizeQa(args);
}

try {
  main();
} catch (err) {
  console.error(`[a17] ${err?.message || String(err)}`);
  process.exit(1);
}
