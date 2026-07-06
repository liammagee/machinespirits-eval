#!/usr/bin/env node
/**
 * Run unattended tutor-stub dialogues with an automated learner.
 *
 * Default comparison:
 *   dynamic preconscious register policy vs random register policy.
 *
 * Usage:
 *   npm run tutor:stub:auto-eval -- --dry-run
 *   npm run tutor:stub:auto-eval -- --runs 2 --turns 8
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values: args } = parseArgs({
  options: {
    runs: { type: 'string', default: '1' },
    turns: { type: 'string', default: '8' },
    policies: { type: 'string', default: 'dynamic,random' },
    model: { type: 'string', default: process.env.TUTOR_STUB_EVAL_MODEL || 'openai.mini' },
    'analysis-model': { type: 'string', default: process.env.TUTOR_STUB_EVAL_ANALYSIS_MODEL || 'codex.gpt-5.5' },
    'auto-learner-model': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_MODEL || process.env.TUTOR_STUB_AUTO_LEARNER_MODEL || 'openai.mini',
    },
    'auto-learner-profile': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_PROFILE ||
        'A curious but fallible learner. They follow the tutor, sometimes ask for evidence, and sometimes make short partial claims.',
    },
    world: { type: 'string', default: process.env.TUTOR_STUB_EVAL_WORLD || 'world_005_marrick' },
    'trace-dir': { type: 'string', default: process.env.TUTOR_STUB_EVAL_TRACE_DIR || '.tutor-stub-auto-eval' },
    'register-palette': { type: 'string', default: 'all' },
    'first-message': { type: 'string', default: '' },
    'cli-effort': { type: 'string', default: process.env.TUTOR_STUB_EVAL_CLI_EFFORT || '' },
    'no-dag': { type: 'boolean', default: false },
    'no-stop-on-grounded': { type: 'boolean', default: false },
    'keep-going': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function printHelp() {
  console.log(`Usage:
  npm run tutor:stub:auto-eval -- [options]

Options:
  --runs <n>                 repetitions per policy (default: 1)
  --turns <n>                max automated learner turns per dialogue (default: 8)
  --policies <csv>           register policies to compare (default: dynamic,random)
  --model <ref>              tutor model (default: openai.mini)
  --analysis-model <ref>     classifier + learner-DAG model (default: codex.gpt-5.5)
  --auto-learner-model <ref> automated learner model (default: openai.mini)
  --auto-learner-profile <text>
  --world <id|path|none>     default: world_005_marrick
  --trace-dir <path>         default: .tutor-stub-auto-eval
  --register-palette <mode>  default: all
  --first-message <text>     seed the first learner turn instead of using tutor opening
  --cli-effort <level>       low, medium, high, xhigh, max, or config for CLI providers
  --no-dag                   omit tutor proof-DAG context
  --no-stop-on-grounded      run until --turns even after grounded closure
  --keep-going               continue after a failed run
  --dry-run                  print commands only
`);
}

function positiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function safeTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function listTraceFiles(traceDir) {
  if (!fs.existsSync(traceDir)) return [];
  return fs
    .readdirSync(traceDir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(traceDir, name))
    .sort();
}

function tutorStubArgs({ policy, runIndex, totalRuns, traceDir }) {
  const command = [
    'scripts/tutor-stub.js',
    '--auto-learner',
    '--auto-turns',
    String(positiveInt(args.turns, '--turns')),
    '--model',
    args.model,
    '--classifier-model',
    args['analysis-model'],
    '--learner-record-model',
    args['analysis-model'],
    '--auto-learner-model',
    args['auto-learner-model'],
    '--auto-learner-profile',
    args['auto-learner-profile'],
    '--tutor-learner-dag',
    '--world',
    args.world,
    '--register-policy',
    policy,
    '--register-palette',
    args['register-palette'],
    '--trace-dir',
    traceDir,
    '--no-stream',
    '--no-interim-animation',
  ];
  if (!args['no-dag']) command.push('--dag');
  if (args['no-stop-on-grounded']) command.push('--no-auto-stop-on-grounded');
  if (args['first-message']) command.push('--once', args['first-message']);
  if (args['cli-effort']) command.push('--cli-effort', args['cli-effort']);
  command.push('--learner', `Automated learner run ${runIndex}/${totalRuns} for policy ${policy}.`);
  return command;
}

function main() {
  if (args.help) {
    printHelp();
    return;
  }

  const runs = positiveInt(args.runs, '--runs');
  const policies = csv(args.policies);
  if (!policies.length) throw new Error('--policies must include at least one policy');
  const traceDir = resolvePath(args['trace-dir']);
  fs.mkdirSync(traceDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const results = [];
  for (const policy of policies) {
    for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
      const before = new Set(listTraceFiles(traceDir));
      const childArgs = tutorStubArgs({ policy, runIndex, totalRuns: runs, traceDir });
      console.log(`\n[auto-eval] policy=${policy} run=${runIndex}/${runs}`);
      console.log(`node ${childArgs.map((part) => JSON.stringify(part)).join(' ')}`);
      if (args['dry-run']) {
        results.push({ policy, runIndex, status: 'dry_run', command: ['node', ...childArgs] });
        continue;
      }

      const child = spawnSync(process.execPath, childArgs, {
        cwd: ROOT,
        stdio: 'inherit',
        env: {
          ...process.env,
          TUTOR_STUB_EVAL_POLICY: policy,
          TUTOR_STUB_EVAL_RUN_INDEX: String(runIndex),
        },
      });
      const after = listTraceFiles(traceDir);
      const newTraces = after.filter((file) => !before.has(file));
      const result = {
        policy,
        runIndex,
        status: child.status === 0 ? 'ok' : 'failed',
        exitCode: child.status,
        signal: child.signal || null,
        traces: newTraces,
        command: ['node', ...childArgs],
      };
      results.push(result);
      if (child.status !== 0 && !args['keep-going']) {
        writeSummary({ traceDir, startedAt, results, failed: true });
        process.exit(child.status || 1);
      }
    }
  }

  writeSummary({ traceDir, startedAt, results, failed: false });
}

function writeSummary({ traceDir, startedAt, results, failed }) {
  const summary = {
    schema: 'machinespirits.tutor-stub.auto-eval.v1',
    startedAt,
    completedAt: new Date().toISOString(),
    failed,
    config: {
      runs: positiveInt(args.runs, '--runs'),
      turns: positiveInt(args.turns, '--turns'),
      policies: csv(args.policies),
      model: args.model,
      analysisModel: args['analysis-model'],
      autoLearnerModel: args['auto-learner-model'],
      world: args.world,
      traceDir,
      dryRun: Boolean(args['dry-run']),
    },
    results,
  };
  const summaryPath = path.join(traceDir, `auto-eval-${safeTimestampForFile()}.json`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\n[auto-eval] wrote ${summaryPath}`);
}

try {
  main();
} catch (error) {
  console.error(`[auto-eval] error: ${error.message}`);
  process.exit(1);
}
