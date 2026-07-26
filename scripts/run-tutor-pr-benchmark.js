#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildTutorPrBenchmarkPlan,
  loadTutorPrBenchmarkConfig,
  publicTutorPrBenchmarkPlan,
  renderTutorPrBenchmarkMarkdown,
  runTutorPrBenchmark,
} from '../services/tutorStubPrBenchmark.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'tutor-pr-benchmark.yaml');

function usage() {
  return `Usage: node scripts/run-tutor-pr-benchmark.js [options]

Options:
  --preset <strong|smoke>  Benchmark preset (default: strong)
  --models <id,id>        Override the preset model list
  --cases <id,id>         Override the preset case list
  --max-calls <n>         Lower or explicitly raise the finite call budget
  --config <path>         Benchmark YAML (default: config/tutor-pr-benchmark.yaml)
  --out <directory>       Report directory (default: ignored timestamped directory)
  --print-plan            Validate and print the zero-call plan
  --json                  Print JSON instead of the compact human summary
  --help                  Show this help

Exit codes: 0 pass, 1 benchmark failure, 2 blocked or budget exhausted.`;
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

function csv(value) {
  if (!value) return null;
  const rows = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!rows.length) throw new Error('comma-separated override must not be empty');
  return rows;
}

function gitValue(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout || '').trim() || null : null;
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/gu, '-');
}

function writeReport(outDir, report) {
  const target = path.resolve(outDir);
  fs.mkdirSync(target, { recursive: true });
  const jsonPath = path.join(target, 'report.json');
  const markdownPath = path.join(target, 'report.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderTutorPrBenchmarkMarkdown(report));
  return { jsonPath, markdownPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const configPath = path.resolve(ROOT, args.config || DEFAULT_CONFIG);
  const loaded = loadTutorPrBenchmarkConfig(configPath);
  const maxCalls = args['max-calls'] === undefined ? null : Number.parseInt(args['max-calls'], 10);
  const plan = buildTutorPrBenchmarkPlan({
    config: loaded.config,
    root: ROOT,
    preset: args.preset || 'strong',
    models: csv(args.models),
    cases: csv(args.cases),
    maxCalls,
    configSha256: crypto.createHash('sha256').update(loaded.source).digest('hex'),
  });
  if (args['print-plan']) {
    const printable = publicTutorPrBenchmarkPlan(plan);
    if (args.json) console.log(JSON.stringify(printable, null, 2));
    else {
      console.log(`tutor PR benchmark: ${printable.preset}`);
      console.log(`status: ${printable.status}; calls: ${printable.plannedCalls}/${printable.maxCalls}`);
      console.log(
        `models: ${printable.models.map((model) => `${model.id}=${model.provider}.${model.model}@${model.effort}`).join(', ')}`,
      );
      console.log(`cases: ${printable.cases.map((benchmarkCase) => benchmarkCase.id).join(', ')}`);
    }
    if (printable.status === 'budget_exhausted') process.exitCode = 2;
    return;
  }
  const report = await runTutorPrBenchmark({
    plan,
    root: ROOT,
    metadata: {
      gitSha: gitValue(['rev-parse', 'HEAD']),
      gitBranch: gitValue(['branch', '--show-current']),
      configPath: path.relative(ROOT, configPath),
      command: process.argv.slice(2),
    },
  });
  const outDir = args.out || path.join(ROOT, '.tutor-stub-auto-eval', `pr-benchmark-${stamp()}`);
  const paths = writeReport(outDir, report);
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(
      `tutor PR benchmark: ${report.status} (${report.summary.pass} pass, ${report.summary.fail} fail, ${report.summary.blocked} blocked)`,
    );
    console.log(`report: ${paths.markdownPath}`);
    console.log(`details: ${paths.jsonPath}`);
  }
  process.exitCode = report.status === 'pass' ? 0 : report.status === 'fail' ? 1 : 2;
}

main().catch((error) => {
  console.error(`tutor PR benchmark error: ${error.message}`);
  process.exitCode = 2;
});
