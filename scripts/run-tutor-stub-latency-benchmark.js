#!/usr/bin/env node

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import yaml from 'yaml';

import {
  TUTOR_STUB_LATENCY_BENCHMARK_REPORT_SCHEMA,
  analyzeTutorStubPrefetchPolicies,
  expandTutorStubLatencyBenchmark,
  parseTutorStubLatencyBenchmarkTrace,
  readTutorStubTraceEvents,
  summarizeTutorStubLatencyBenchmark,
} from '../services/tutorStubLatencyBenchmark.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'tutor-stub-latency-benchmark.yaml');

const { values: args } = parseArgs({
  options: {
    config: { type: 'string', default: DEFAULT_CONFIG },
    out: { type: 'string' },
    factor: { type: 'string', default: '' },
    variant: { type: 'string', default: '' },
    'trace-root': { type: 'string' },
    'prefetch-trace': { type: 'string', default: '' },
    'reparse-report': { type: 'string', default: '' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  return `Usage:
  node scripts/run-tutor-stub-latency-benchmark.js --dry-run
  node scripts/run-tutor-stub-latency-benchmark.js --factor effort --out report.json
  node scripts/run-tutor-stub-latency-benchmark.js --variant baseline_medium --out report.json
  node scripts/run-tutor-stub-latency-benchmark.js --prefetch-trace TRACE.jsonl --dry-run
  node scripts/run-tutor-stub-latency-benchmark.js --reparse-report report.json

Factors: effort, routing, prompt, prefetch, or a comma-separated subset. The baseline is
always included. Live jobs run sequentially and each launches the real
tutor-stub one-turn path with an isolated trace directory.`;
}

function loadConfig(filePath) {
  return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function timestampId() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function findTrace(traceDir) {
  const files = fs
    .readdirSync(traceDir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(traceDir, name));
  if (files.length !== 1) throw new Error(`expected one JSONL trace in ${traceDir}; found ${files.length}`);
  return files[0];
}

function runJob(job) {
  fs.mkdirSync(job.traceDir, { recursive: true });
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'tutor-stub.js'), ...job.args], {
      cwd: ROOT,
      env: {
        ...process.env,
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `benchmark job ${job.id} exited ${code}: ${stderr.trim() || stdout.trim() || 'no diagnostic output'}`,
          ),
        );
        return;
      }
      try {
        const tracePath = findTrace(job.traceDir);
        const events = readTutorStubTraceEvents(tracePath);
        resolve(parseTutorStubLatencyBenchmarkTrace({ events, job, tracePath }));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function main() {
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args['reparse-report']) {
    const sourcePath = path.resolve(args['reparse-report']);
    const sourceReport = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const results = sourceReport.results.map((prior) =>
      parseTutorStubLatencyBenchmarkTrace({
        events: readTutorStubTraceEvents(prior.tracePath),
        job: { ...prior, id: prior.jobId },
        tracePath: prior.tracePath,
      }),
    );
    const report = {
      ...sourceReport,
      generatedAt: new Date().toISOString(),
      reparsedFrom: sourcePath,
      results,
      summary: summarizeTutorStubLatencyBenchmark(results),
    };
    const outPath = path.resolve(args.out || sourcePath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`report: ${outPath}`);
    console.log(JSON.stringify(report.summary, null, 2));
    return;
  }
  const configPath = path.resolve(args.config);
  const config = loadConfig(configPath);
  const runId = timestampId();
  const traceRoot = path.resolve(
    args['trace-root'] || path.join(ROOT, '.tutor-stub-traces', 'latency-benchmark', runId),
  );
  const factors = String(args.factor || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  let plan = expandTutorStubLatencyBenchmark({ config, root: ROOT, traceRoot, factors });
  if (args.variant) {
    plan = { ...plan, jobs: plan.jobs.filter((job) => job.variantId === args.variant) };
    if (!plan.jobs.length) throw new Error(`unknown or filtered benchmark variant: ${args.variant}`);
  }
  const prefetchTracePaths = String(args['prefetch-trace'] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => path.resolve(value));
  const prefetchPolicyReports = prefetchTracePaths.map((tracePath) => ({
    tracePath,
    ...analyzeTutorStubPrefetchPolicies(readTutorStubTraceEvents(tracePath)),
  }));
  if (args['dry-run']) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry_run',
          config: configPath,
          traceRoot,
          planeContract: plan.planeContract,
          jobs: plan.jobs.map((job) => ({
            id: job.id,
            factor: job.factor,
            caseId: job.caseId,
            expectedPlane: job.expectedPlane,
            tutorModel: job.tutorModel,
            analysisModel: job.analysisModel,
            cliEffort: job.cliEffort,
            promptProfile: job.promptProfile,
            prefetchPolicy: job.prefetchPolicy,
          })),
          prefetchPolicyReports,
        },
        null,
        2,
      ),
    );
    return;
  }
  const results = [];
  for (const [index, job] of plan.jobs.entries()) {
    console.log(`[${index + 1}/${plan.jobs.length}] ${job.variantId} · ${job.caseId} · draw ${job.draw}`);
    results.push(await runJob(job));
  }
  const report = {
    schema: TUTOR_STUB_LATENCY_BENCHMARK_REPORT_SCHEMA,
    benchmarkId: config.id,
    runId,
    config: configPath,
    traceRoot,
    generatedAt: new Date().toISOString(),
    attribution: 'one_factor_at_a_time_against_baseline',
    planeContract: plan.planeContract,
    results,
    summary: summarizeTutorStubLatencyBenchmark(results),
    prefetchPolicyReports,
  };
  const outPath = path.resolve(args.out || path.join(traceRoot, `${config.id}-report.json`));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`report: ${outPath}`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error) => {
  console.error(`Fatal: ${error.message}`);
  process.exitCode = 1;
});
