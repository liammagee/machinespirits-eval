#!/usr/bin/env node
/**
 * Generate paired branches from an already-admissible redacted `none` prefix.
 *
 * Safe by default:
 *   - --dry-run plans only; no writes, no LLM calls.
 *   - --mock runs generator + QA with stubs.
 *   - real metered mode requires BOTH --approve-paid and
 *     A17_PAID_BRANCH_APPROVED=YES in the environment.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const DEFAULTS = {
  sourceRoot: path.join(ROOT, 'exports', 'a17-one-side-replay-replication', 'd5-redacted-control-run5'),
  root: null,
  spec: path.join(ROOT, 'config', 'poetics-calibration', 'oedipus-pilot-v2.yaml'),
  envFile: '/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env',
  scenario: 'D_OED5',
  generator: 'api',
  apiModel: 'sonnet',
  maxTurns: 6,
  arms: ['socratic', 'reveal'],
  panel: 'qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro,gpt',
};

function usage() {
  return `Usage:
  node scripts/run-a17-matched-d5-branches.js --dry-run
  node scripts/run-a17-matched-d5-branches.js --mock --source-root /tmp/a17-source
  A17_PAID_BRANCH_APPROVED=YES node scripts/run-a17-matched-d5-branches.js --approve-paid

Options:
  --dry-run              Plan branch generation only; no writes, no LLM calls.
  --mock                 Run generator + QA with mock LLM/scorer paths.
  --approve-paid         Required for real metered branch generation + QA.
  --force                Allow overwriting existing branch outputs.
  --source-root DIR      Existing redacted none root. Default: ${path.relative(ROOT, DEFAULTS.sourceRoot)}
  --root DIR             Output root. Default: source root.
  --spec FILE            Scenario spec. Default: ${path.relative(ROOT, DEFAULTS.spec)}
  --env-file FILE        dotenv file passed to child commands.
  --scenario ID          Scenario id. Default: ${DEFAULTS.scenario}
  --arms CSV             Branch arms to generate. Default: ${DEFAULTS.arms.join(',')}
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
    else if (token === '--source-root') args.sourceRoot = path.resolve(argv[++i]);
    else if (token === '--root') args.root = path.resolve(argv[++i]);
    else if (token === '--spec') args.spec = path.resolve(argv[++i]);
    else if (token === '--env-file') args.envFile = path.resolve(argv[++i]);
    else if (token === '--scenario') args.scenario = argv[++i];
    else if (token === '--arms') {
      args.arms = String(argv[++i] || '')
        .split(',')
        .map((arm) => arm.trim())
        .filter(Boolean);
    } else if (token === '--api-model') args.apiModel = argv[++i];
    else if (token === '--panel') args.panel = argv[++i];
    else if (token === '--max-turns') args.maxTurns = Number(argv[++i]);
    else if (token === '-h' || token === '--help') {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}\n\n${usage()}`);
    }
  }
  args.root ||= args.sourceRoot;
  if (args.dryRun && args.mock) throw new Error('use --dry-run or --mock, not both');
  if (!Number.isInteger(args.maxTurns) || args.maxTurns < 1) throw new Error('--max-turns must be a positive integer');
  if (!args.arms.length) throw new Error('--arms must include at least one arm');
  for (const arm of args.arms) {
    if (!['socratic', 'reveal'].includes(arm)) throw new Error('--arms supports socratic,reveal for this A17 helper');
  }
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
  if (result.status !== 0) throw new Error(`${script} exited ${result.status}`);
}

function readYaml(file) {
  return yaml.parse(fs.readFileSync(file, 'utf8')) || {};
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sourcePaths(args) {
  const key = path.join(args.sourceRoot, 'key-none.yaml');
  let tid = 'T01';
  if (fs.existsSync(key)) {
    const parsed = readYaml(key);
    tid = Object.keys(parsed.items || {})[0] || tid;
  }
  return {
    key,
    tid,
    trace: path.join(args.sourceRoot, 'deliberation', 'none', `${tid}.json`),
    transcript: path.join(args.sourceRoot, 'sample', 'none', `${tid}.txt`),
    director: path.join(args.sourceRoot, 'director-none.json'),
  };
}

function ensurePreconditions(args) {
  if (!fs.existsSync(args.spec)) throw new Error(`spec not found: ${args.spec}`);
  const source = sourcePaths(args);
  for (const file of [source.key, source.trace, source.transcript, source.director]) {
    if (!fs.existsSync(file)) throw new Error(`source artifact missing: ${file}`);
  }
  const sourceKey = readYaml(source.key);
  const sourceTrace = readJson(source.trace);
  if (sourceKey.tutor_adaptation_policy !== 'withhold_secret') {
    throw new Error(`source key is not withhold_secret: ${sourceKey.tutor_adaptation_policy}`);
  }
  if ((sourceKey.quality_blocking_warning_count || 0) > 0 || sourceTrace.quality_status === 'review_before_scoring') {
    throw new Error('source none branch is quality-gated; refusing to branch from it');
  }
  if (!args.force) {
    for (const arm of args.arms) {
      const transcript = path.join(args.root, 'sample', arm, 'T01.txt');
      const tid = source.tid || 'T01';
      const branchTranscript = path.join(args.root, 'sample', arm, `${tid}.txt`);
      if (fs.existsSync(branchTranscript) || fs.existsSync(transcript)) {
        throw new Error(
          `branch output already exists: ${fs.existsSync(branchTranscript) ? branchTranscript : transcript} (pass --force)`,
        );
      }
    }
  }
  const paid = !args.dryRun && !args.mock;
  if (!paid) return;
  if (!args.approvePaid || process.env.A17_PAID_BRANCH_APPROVED !== 'YES') {
    throw new Error('paid mode requires --approve-paid and A17_PAID_BRANCH_APPROVED=YES');
  }
  const keyAvailable = Boolean(process.env.OPENROUTER_API_KEY || dotenvValue(args.envFile, 'OPENROUTER_API_KEY'));
  if (!keyAvailable) throw new Error(`OPENROUTER_API_KEY not found in environment or ${args.envFile}`);
}

function sourceVariationKey(args) {
  const source = sourcePaths(args);
  const key = readYaml(source.key);
  const trace = readJson(source.trace);
  return key.director_variation_key || trace.run?.director_variation_key || null;
}

function generatorArgs(args) {
  const source = sourcePaths(args);
  const argv = [
    '--spec',
    args.spec,
    '--only',
    args.scenario,
    '--paired-adaptation-arms',
    args.arms.join(','),
    '--paired-prefix-trace',
    source.trace,
    '--paired-prefix-source-branch',
    'none',
    '--max-turns',
    String(args.maxTurns),
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
  const variationKey = sourceVariationKey(args);
  if (variationKey) argv.push('--director-variation-key', variationKey);
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
    args.arms.join(','),
    '--panel',
    args.panel,
    '--out',
    path.join(args.root, `qa-oedipus-arms-${args.arms.join('-')}.json`),
  ];
  if (args.mock) argv.push('--mock');
  return argv;
}

function verifyGeneratedBranches(args) {
  const sourceTrace = readJson(sourcePaths(args).trace);
  const sourceHash = sourceTrace.run?.paired_continuation?.shared_prefix_hash;
  for (const arm of args.arms) {
    const keyPath = path.join(args.root, `key-${arm}.yaml`);
    const directorPath = path.join(args.root, `director-${arm}.json`);
    for (const file of [keyPath, directorPath]) {
      if (!fs.existsSync(file)) throw new Error(`expected branch artifact missing: ${file}`);
    }
    const key = readYaml(keyPath);
    const tid = Object.keys(key.items || {})[0];
    if (!tid) throw new Error(`branch ${arm} key contains no generated item: ${keyPath}`);
    const tracePath = path.join(args.root, 'deliberation', arm, `${tid}.json`);
    const transcriptPath = path.join(args.root, 'sample', arm, `${tid}.txt`);
    for (const file of [tracePath, transcriptPath]) {
      if (!fs.existsSync(file)) throw new Error(`expected branch artifact missing: ${file}`);
    }
    const trace = readJson(tracePath);
    const item = key.items?.[tid] || {};
    const blockingWarningCount = Number(key.quality_blocking_warning_count || 0);
    if (blockingWarningCount > 0 || trace.quality_status === 'review_before_scoring') {
      throw new Error(`branch ${arm} is quality-gated before scoring`);
    }
    const expectedPolicy = arm === 'socratic' ? 'socratic_discovery' : 'reveal_secret';
    if (item.tutor_adaptation_policy !== expectedPolicy || trace.run?.tutor_adaptation_policy !== expectedPolicy) {
      throw new Error(`branch ${arm} did not record ${expectedPolicy}`);
    }
    const branchHash = trace.run?.paired_continuation?.shared_prefix_hash;
    if (sourceHash && branchHash !== sourceHash) {
      throw new Error(`branch ${arm} prefix hash ${branchHash} does not match source ${sourceHash}`);
    }
  }
}

function summarizeQa(args) {
  const qaPath = path.join(args.root, `qa-oedipus-arms-${args.arms.join('-')}.json`);
  const qa = readJson(qaPath);
  console.log(
    JSON.stringify(
      {
        root: path.relative(ROOT, args.root),
        arms: args.arms,
        allPass: qa.allPass,
        results: (qa.results || []).map((result) => ({
          arm: result.arm,
          invariant: result.invariant,
          status: result.status,
          detail: result.detail,
          evidence: result.evidence || '',
        })),
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
    `[a17] ${args.dryRun ? 'dry-run' : args.mock ? 'mock' : 'PAID'} matched ${args.scenario} branches ${args.arms.join(',')} ` +
      `from ${path.relative(ROOT, args.sourceRoot)} -> ${path.relative(ROOT, args.root)}`,
  );
  runNode('scripts/generate-pedagogical-dramas.js', generatorArgs(args), args);
  if (args.dryRun) return;
  verifyGeneratedBranches(args);
  runNode('scripts/qa-oedipus-arms.js', qaArgs(args), args);
  summarizeQa(args);
}

try {
  main();
} catch (err) {
  console.error(`[a17] ${err?.message || String(err)}`);
  process.exit(1);
}
