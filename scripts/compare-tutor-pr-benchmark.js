#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadTutorPrBenchmarkConfig } from '../services/tutorStubPrBenchmark.js';
import {
  assertEquivalentTutorPrBenchmarkPlans,
  buildTutorPrBenchmarkBaseHeadPlan,
  renderTutorPrBenchmarkComparisonMarkdown,
  summarizeTutorPrBenchmarkBaseHead,
} from '../services/tutorStubPrBenchmarkComparison.js';
import {
  resolveTutorPrBenchmarkReportRoot,
  validateTutorPrBenchmarkHookConfig,
} from '../services/tutorStubPrBenchmarkHook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = 'config/tutor-pr-benchmark.yaml';

function usage() {
  return `Usage: node scripts/compare-tutor-pr-benchmark.js [options]

Options:
  --base <ref>            Base Git ref (default: origin/main)
  --head <ref>            Head Git ref (default: HEAD)
  --preset <name>         Benchmark preset (default: strong)
  --draws <n>             Paired draws per job, 1-5 (default: 1)
  --max-calls <n>         Total finite budget across both refs (default: exact planned calls)
  --config <path>         Repository-relative benchmark YAML
  --out <directory>       Report directory (default: shared Git-local timestamped directory)
  --print-plan            Resolve both refs and print the zero-call comparison plan
  --json                  Print JSON instead of a compact summary
  --help                  Show this help

The runner creates clean detached worktrees, verifies equivalent benchmark
inputs, alternates base/head execution order, and never retries a job.`;
}

function parseArgs(argv) {
  const args = {};
  const booleans = new Set(['help', 'json', 'print-plan']);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument ${token}`);
    const key = token.slice(2);
    if (booleans.has(key)) {
      args[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`--${key} requires a value`);
    args[key] = value;
    index += 1;
  }
  return args;
}

function positiveInt(value, label, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${label} must be an integer from 1 to ${max}`);
  }
  return parsed;
}

function run(command, args, { cwd = ROOT, allowFailure = false } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

function git(args, options) {
  return String(run('git', args, options).stdout || '').trim();
}

function repositoryRelative(value, label) {
  const normalized = path.posix
    .normalize(
      String(value || '')
        .trim()
        .replaceAll('\\', '/'),
    )
    .replace(/^\.\//u, '');
  if (!normalized || path.posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`${label} must be a repository-relative path`);
  }
  return normalized;
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/gu, '-');
}

function writeReport(outDir, report) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'comparison.json');
  const markdownPath = path.join(outDir, 'comparison.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderTutorPrBenchmarkComparisonMarkdown(report));
  return { jsonPath, markdownPath };
}

function attachDependencies(worktree) {
  const source = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(source)) throw new Error(`repository dependencies are missing: ${source}`);
  fs.symlinkSync(source, path.join(worktree, 'node_modules'), 'dir');
}

function addWorktree(target, sha) {
  git(['worktree', 'add', '--detach', target, sha]);
  attachDependencies(target);
}

function removeWorktree(target) {
  if (!fs.existsSync(target)) return;
  const result = run('git', ['worktree', 'remove', '--force', target], { allowFailure: true });
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`failed to remove temporary comparison worktree ${target}${detail ? `: ${detail}` : ''}`);
  }
}

function readPlan(worktree, { preset, configPath }) {
  const result = run(
    process.execPath,
    ['scripts/run-tutor-pr-benchmark.js', '--preset', preset, '--config', configPath, '--print-plan', '--json'],
    { cwd: worktree },
  );
  return JSON.parse(result.stdout);
}

function blockedJob(pair, side, reason, called = false) {
  return {
    id: pair.job.id,
    caseId: pair.job.caseId,
    modelId: pair.job.modelId,
    provider: pair.job.modelId,
    status: 'blocked',
    called,
    error: { name: 'Error', code: 'BASE_HEAD_EXECUTION_BLOCKED', message: reason },
    comparisonSide: side,
  };
}

function executeJob({ worktree, side, pair, preset, configPath, outRoot }) {
  const outDir = path.join(outRoot, 'jobs', pair.id, side);
  const result = run(
    process.execPath,
    [
      'scripts/run-tutor-pr-benchmark.js',
      '--preset',
      preset,
      '--models',
      pair.job.modelId,
      '--cases',
      pair.job.caseId,
      '--max-calls',
      '1',
      '--config',
      configPath,
      '--out',
      outDir,
    ],
    { cwd: worktree, allowFailure: true },
  );
  const reportPath = path.join(outDir, 'report.json');
  if (!fs.existsSync(reportPath)) {
    const detail = String(result.stderr || result.stdout || '').trim();
    return blockedJob(pair, side, `runner produced no report${detail ? `: ${detail}` : ''}`, true);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (report.jobs?.length !== 1) return blockedJob(pair, side, 'runner report did not contain exactly one job', true);
  return { ...report.jobs[0], comparisonSide: side, reportPath };
}

function sharedReportRoot(config) {
  const hook = validateTutorPrBenchmarkHookConfig(config);
  return resolveTutorPrBenchmarkReportRoot({
    root: ROOT,
    reportRoot: hook.reportRoot,
    reportScope: hook.reportScope,
    gitCommonDir: git(['rev-parse', '--git-common-dir']),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const baseRef = args.base || 'origin/main';
  const headRef = args.head || 'HEAD';
  const preset = args.preset || 'strong';
  const draws = positiveInt(args.draws || '1', '--draws', 5);
  const configPath = repositoryRelative(args.config || DEFAULT_CONFIG, '--config');
  const configLoaded = loadTutorPrBenchmarkConfig(path.join(ROOT, configPath));
  const baseSha = git(['rev-parse', `${baseRef}^{commit}`]);
  const headSha = git(['rev-parse', `${headRef}^{commit}`]);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-pr-base-head-'));
  const baseWorktree = path.join(temporaryRoot, 'base');
  const headWorktree = path.join(temporaryRoot, 'head');
  const startedAt = new Date().toISOString();
  let cleanupError = null;
  try {
    addWorktree(baseWorktree, baseSha);
    addWorktree(headWorktree, headSha);
    const basePlan = readPlan(baseWorktree, { preset, configPath });
    const headPlan = readPlan(headWorktree, { preset, configPath });
    const equivalence = assertEquivalentTutorPrBenchmarkPlans(basePlan, headPlan);
    const maxCalls = args['max-calls'] === undefined ? null : positiveInt(args['max-calls'], '--max-calls');
    const comparisonPlan = buildTutorPrBenchmarkBaseHeadPlan({
      benchmarkPlan: headPlan,
      draws,
      maxCalls,
    });
    const publicComparisonPlan = {
      status: comparisonPlan.status,
      base: { ref: baseRef, sha: baseSha },
      head: { ref: headRef, sha: headSha },
      draws,
      plannedCalls: comparisonPlan.plannedCalls,
      maxCalls: comparisonPlan.maxCalls,
      planFingerprint: equivalence.fingerprint,
      execution: comparisonPlan.pairs.map(({ id, draw, job, order }) => ({ id, draw, job, order })),
    };
    if (args['print-plan']) {
      if (args.json) console.log(JSON.stringify(publicComparisonPlan, null, 2));
      else {
        console.log(`tutor PR base/head plan: ${comparisonPlan.status}`);
        console.log(`base: ${baseRef} (${baseSha.slice(0, 12)}); head: ${headRef} (${headSha.slice(0, 12)})`);
        console.log(`draws: ${draws}; calls: ${comparisonPlan.plannedCalls}/${comparisonPlan.maxCalls}`);
        console.log(`plan fingerprint: ${equivalence.fingerprint}`);
      }
      if (comparisonPlan.status === 'budget_exhausted') process.exitCode = 2;
      return;
    }
    const outDir = path.resolve(
      args.out || path.join(sharedReportRoot(configLoaded.config), 'comparisons', `base-head-${stamp()}`),
    );
    const pairs = [];
    const blockedModels = { base: new Map(), head: new Map() };
    if (comparisonPlan.status !== 'budget_exhausted') {
      for (const pair of comparisonPlan.pairs) {
        const resultPair = { ...pair };
        for (const side of pair.order) {
          const previous = blockedModels[side].get(pair.job.modelId);
          const job = previous
            ? blockedJob(pair, side, `model blocked by earlier call: ${previous}`, false)
            : executeJob({
                worktree: side === 'base' ? baseWorktree : headWorktree,
                side,
                pair,
                preset,
                configPath,
                outRoot: outDir,
              });
          resultPair[side] = job;
          if (job.status === 'blocked' && job.called) {
            blockedModels[side].set(pair.job.modelId, job.error?.message || 'unknown infrastructure failure');
          }
        }
        pairs.push(resultPair);
      }
    }
    const report = summarizeTutorPrBenchmarkBaseHead({
      baseRef,
      headRef,
      baseSha,
      headSha,
      benchmarkPlan: headPlan,
      comparisonPlan,
      planFingerprint: equivalence.fingerprint,
      pairs,
      startedAt,
      completedAt: new Date().toISOString(),
      metadata: { command: process.argv.slice(2), executionOrder: 'alternating_by_pair' },
    });
    const paths = writeReport(outDir, report);
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(
        `tutor PR base/head comparison: ${report.status} (${report.summary.headWins} head wins, ${report.summary.baseWins} base wins, ${report.summary.ties} ties)`,
      );
      console.log(`report: ${paths.markdownPath}`);
      console.log(`details: ${paths.jsonPath}`);
    }
    process.exitCode = report.status === 'pass' ? 0 : report.status === 'fail' ? 1 : 2;
  } finally {
    try {
      removeWorktree(headWorktree);
      removeWorktree(baseWorktree);
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    } catch (error) {
      cleanupError = error;
    }
    if (cleanupError) {
      console.error(`tutor PR benchmark comparison cleanup error: ${cleanupError.message}`);
      process.exitCode = 2;
    }
  }
}

main().catch((error) => {
  console.error(`tutor PR benchmark comparison error: ${error.message}`);
  process.exitCode = 2;
});
