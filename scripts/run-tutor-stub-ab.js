#!/usr/bin/env node

/**
 * Instrumentation A/B: bare tutor vs instrumented tutor on one frozen dialogue,
 * graded by one pinned rubric, rendered as a swimlane diff.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubAbPlan,
  loadTutorStubAbConfig,
  publicTutorStubAbPlan,
  renderTutorStubAbMarkdown,
  runTutorStubAb,
} from '../services/tutorStubAbHarness.js';
import { describeTutorStubAbFeatures } from '../services/tutorStubAbArms.js';
import { writeTutorStubAbTranscriptHtml } from '../services/tutorStubAbTranscriptHtml.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'tutor-stub-ab.yaml');

function usage() {
  return `Usage: node scripts/run-tutor-stub-ab.js [options]

Runs one frozen dialogue past a bare tutor and an instrumented tutor, grades
every arm with the same deterministic rubric, and writes a swimlane diff.

Options:
  --preset <id>           smoke | default | strong | ablation | cross_model
  --arms <id,id>          Override the preset arm list (must include the baseline)
  --scenarios <id,id>     Override the preset scenario list
  --models <id,id>        Override the preset model list
  --features <id,id|all|none>
                          Ad-hoc feature set for every non-baseline arm
  --drop <id,id>          Drop features from every non-baseline arm
  --max-calls <n>         Lower or explicitly raise the finite call budget
  --config <path>         A/B YAML (default: config/tutor-stub-ab.yaml)
  --out <directory>       Report directory (default: exports/tutor-stub-ab/<stamp>)
  --render-report <json>  Re-render HTML and Markdown from a saved report (zero calls)
  --print-plan            Validate and print the zero-call plan
  --list-features         Print the instrumentation feature registry and exit
  --open                  Open the rendered swimlane diff when the run finishes
  --json                  Print JSON instead of the compact human summary
  --help                  Show this help

Exit codes: 0 complete, 1 at least one arm failed the rubric, 2 blocked or
budget exhausted.`;
}

function parseArgs(argv) {
  const args = {};
  const booleans = new Set(['help', 'json', 'print-plan', 'list-features', 'open']);
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
  if (value === undefined) return null;
  const rows = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!rows.length) throw new Error('comma-separated override must not be empty');
  return rows;
}

function featureSelection(value) {
  if (value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === 'all' || trimmed === 'none') return trimmed;
  return csv(value);
}

function gitValue(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout || '').trim() || null : null;
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/gu, '-');
}

function currentGitMetadata() {
  const status = gitValue(['status', '--porcelain=v1', '--untracked-files=all']);
  const gitStatus = status ? status.split(/\r?\n/gu).filter(Boolean) : [];
  return {
    gitSha: gitValue(['rev-parse', 'HEAD']),
    gitBranch: gitValue(['branch', '--show-current']),
    gitTreeState: gitStatus.length > 0 ? 'dirty' : 'clean',
  };
}

function defaultOutRoot() {
  return process.env.EVAL_EXPORTS_DIR
    ? path.resolve(process.env.EVAL_EXPORTS_DIR, 'tutor-stub-ab')
    : path.join(ROOT, 'exports', 'tutor-stub-ab');
}

function writeArtifacts(outDir, report) {
  const target = path.resolve(outDir);
  fs.mkdirSync(target, { recursive: true });
  const jsonPath = path.join(target, 'report.json');
  const markdownPath = path.join(target, 'report.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderTutorStubAbMarkdown(report));
  const htmlPath = writeTutorStubAbTranscriptHtml({ report, outPath: path.join(target, 'swimlane-diff.html') });
  return { jsonPath, markdownPath, htmlPath };
}

function openPath(target) {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(opener, [target], { detached: true, stdio: 'ignore' }).unref();
}

function printSummary(report, paths) {
  console.log(`tutor instrumentation A/B: ${report.status} (${report.plan.preset})`);
  for (const arm of report.summary.arms) {
    const rate = arm.passRate === null ? '—' : `${Math.round(arm.passRate * 100)}%`;
    const delta = arm.baseline
      ? '     '
      : `${arm.clusterDeltaTotal > 0 ? '+' : ''}${arm.clusterDeltaTotal}`.padStart(5);
    console.log(
      `  ${arm.baseline ? '*' : ' '} ${arm.id.padEnd(14)} broken rules ${String(arm.totalClusters).padStart(3)} (${String(arm.totalHardClusters).padStart(3)} hard) ${delta}` +
        `  pass ${String(arm.pass).padStart(2)}/${String(arm.scored).padEnd(2)} ${rate.padStart(4)}` +
        `  advisory ${String(arm.meanAdvisoryChars ?? 0).padStart(5)} chars  reply ${String(arm.meanCandidateChars ?? 0).padStart(4)} chars` +
        (arm.blocked ? `  (${arm.blocked} blocked)` : ''),
    );
    for (const flip of arm.flipsVsBaseline) {
      console.log(`      turn ${flip.turn} ${flip.modelId}: ${flip.from} -> ${flip.to}`);
    }
  }
  console.log(`swimlanes: ${paths.htmlPath}`);
  console.log(`report:    ${paths.markdownPath}`);
  console.log(`details:   ${paths.jsonPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (args['list-features']) {
    for (const feature of describeTutorStubAbFeatures()) {
      console.log(`${feature.id.padEnd(22)} ${feature.label}`);
      console.log(`${' '.repeat(22)} ${feature.summary}`);
      console.log(`${' '.repeat(22)} blocks: ${feature.blocks.join(' | ')}`);
      if (feature.guards.length) console.log(`${' '.repeat(22)} guards: ${feature.guards.join(', ')}`);
    }
    return;
  }

  if (args['render-report']) {
    const sourcePath = path.resolve(args['render-report']);
    const report = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const outDir = args.out || path.dirname(sourcePath);
    const paths = writeArtifacts(outDir, report);
    if (args.open) openPath(paths.htmlPath);
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else printSummary(report, paths);
    process.exitCode = report.status === 'complete' ? 0 : report.status === 'blocked' ? 2 : 1;
    return;
  }

  const configPath = path.resolve(ROOT, args.config || DEFAULT_CONFIG);
  const loaded = loadTutorStubAbConfig(configPath);
  const plan = buildTutorStubAbPlan({
    config: loaded.config,
    root: ROOT,
    preset: args.preset || 'default',
    arms: csv(args.arms),
    scenarios: csv(args.scenarios),
    models: csv(args.models),
    featureOverride: featureSelection(args.features),
    dropOverride: csv(args.drop),
    maxCalls: args['max-calls'] === undefined ? null : Number.parseInt(args['max-calls'], 10),
    configSha256: loaded.configSha256,
  });

  if (args['print-plan']) {
    const printable = publicTutorStubAbPlan(plan);
    if (args.json) console.log(JSON.stringify(printable, null, 2));
    else {
      console.log(`tutor instrumentation A/B: ${printable.preset}`);
      console.log(`status: ${printable.status}; calls: ${printable.plannedCalls}/${printable.maxCalls}`);
      console.log(
        `models: ${printable.models.map((model) => `${model.id}=${model.provider}.${model.model}@${model.effort}`).join(', ')}`,
      );
      for (const arm of printable.arms) {
        console.log(
          `arm ${arm.id}${arm.baseline ? ' (baseline)' : ''}: ${arm.features.join(', ') || 'no instrumentation'}`,
        );
      }
      for (const scenario of printable.scenarios) {
        console.log(
          `scenario ${scenario.id}: ${scenario.worldId}, turns ${scenario.turns.map((t) => t.turn).join(', ')}`,
        );
      }
    }
    if (printable.status === 'budget_exhausted') process.exitCode = 2;
    return;
  }

  const report = await runTutorStubAb({
    plan,
    root: ROOT,
    metadata: {
      ...currentGitMetadata(),
      configPath: path.relative(ROOT, configPath),
      command: process.argv.slice(2),
    },
    onProgress: args.json
      ? null
      : (result) =>
          console.error(
            `  turn ${String(result.turn).padStart(2)} ${result.armId.padEnd(14)} ${result.status}${result.error ? ` (${result.error.message})` : ''}`,
          ),
  });
  const outDir = args.out || path.join(defaultOutRoot(), `ab-${stamp()}`);
  const paths = writeArtifacts(outDir, report);
  if (args.open) openPath(paths.htmlPath);
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else printSummary(report, paths);
  const failed = report.summary.arms.some((arm) => arm.fail > 0);
  process.exitCode = report.status !== 'complete' ? 2 : failed ? 1 : 0;
}

main().catch((error) => {
  console.error(`tutor instrumentation A/B error: ${error.message}`);
  process.exitCode = 2;
});
