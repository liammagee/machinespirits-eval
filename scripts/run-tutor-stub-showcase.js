#!/usr/bin/env node

/**
 * Free-running instrumentation showcase: a bare tutor and a fully instrumented
 * tutor each hold their own conversation with an automated learner, run to
 * their own end, and are rendered side by side with a benchmark panel.
 *
 * Paid and attended by design. Dialogues run one at a time, the child's own
 * output is echoed as it goes, and there are no retries — a stuck arm should be
 * visible and interruptible rather than silently burning quota.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubShowcasePlan,
  loadTutorStubShowcaseConfig,
  publicTutorStubShowcasePlan,
  renderTutorStubShowcaseMarkdown,
  runTutorStubShowcase,
} from '../services/tutorStubShowcase.js';
import { writeTutorStubShowcaseHtml } from '../services/tutorStubShowcaseHtml.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONFIG = path.join(ROOT, 'config', 'tutor-stub-showcase.yaml');

function usage() {
  return `Usage: node scripts/run-tutor-stub-showcase.js [options]

Runs a bare tutor and an instrumented tutor through the same scenario as two
free-running dialogues with an automated learner, then renders both transcripts
side by side with a benchmark panel.

Options:
  --preset <id>           smoke | default | cross_model
  --arms <id,id>          Override the preset arm list (must include the baseline)
  --scenarios <id,id>     Override the preset scenario list
  --models <id,id>        Override the preset model list
  --max-turns <n>         Override every scenario's turn cap
  --max-dialogues <n>     Lower or explicitly raise the dialogue budget
  --config <path>         Showcase YAML (default: config/tutor-stub-showcase.yaml)
  --out <directory>       Report directory (default: exports/tutor-stub-showcase/<stamp>)
  --trace-root <dir>      Where child traces land (default: .tutor-stub-traces/showcase)
  --render-report <json>  Re-render HTML and Markdown from a saved report (zero calls)
  --print-plan            Validate and print the zero-call plan, including child commands
  --quiet                 Do not echo child output
  --open                  Open the rendered transcripts when the run finishes
  --json                  Print JSON instead of the compact human summary
  --help                  Show this help

Exit codes: 0 complete, 1 a dialogue exited non-zero, 2 blocked or budget
exhausted.`;
}

function parseArgs(argv) {
  const args = {};
  const booleans = new Set(['help', 'json', 'print-plan', 'open', 'quiet']);
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
    ? path.resolve(process.env.EVAL_EXPORTS_DIR, 'tutor-stub-showcase')
    : path.join(ROOT, 'exports', 'tutor-stub-showcase');
}

/**
 * One dialogue, one child process. The child owns its own trace directory, so
 * a crash still leaves whatever it managed to write behind for inspection.
 */
function spawnDialogue({ job, root, timeoutMs, quiet }) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.resolve(root, job.traceDir), { recursive: true });
    const child = spawn(process.execPath, job.childArgs, {
      cwd: root,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`dialogue ${job.id} exceeded ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    const echo = (stream) => (chunk) => {
      if (quiet) return;
      for (const line of String(chunk).split('\n')) {
        if (line.trim()) stream.write(`    [${job.armId}] ${line}\n`);
      }
    };
    child.stdout.on('data', echo(process.stderr));
    child.stderr.on('data', echo(process.stderr));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: exitCode ?? null });
    });
  });
}

function writeArtifacts(outDir, report) {
  const target = path.resolve(outDir);
  fs.mkdirSync(target, { recursive: true });
  const jsonPath = path.join(target, 'report.json');
  const markdownPath = path.join(target, 'report.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderTutorStubShowcaseMarkdown(report));
  const htmlPath = writeTutorStubShowcaseHtml({ report, outPath: path.join(target, 'transcripts.html') });
  return { jsonPath, markdownPath, htmlPath };
}

function openPath(target) {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(opener, [target], { detached: true, stdio: 'ignore' }).unref();
}

function printSummary(report, paths) {
  console.log(`tutor instrumentation showcase: ${report.status} (${report.plan.preset})`);
  for (const arm of report.summary.arms) {
    console.log(
      `  ${arm.baseline ? '*' : ' '} ${arm.id.padEnd(14)}` +
        ` resolved ${arm.grounded}/${arm.dialogues}` +
        `  turns ${String(arm.meanTurns ?? '-').padStart(3)}` +
        `  calls ${String(arm.meanModelCalls ?? '-').padStart(3)}` +
        `  ${String(arm.meanSecondsPerTurn ?? '-').padStart(5)}s/turn` +
        `  guards ${arm.auditsRun - arm.auditsFailed}/${arm.auditsRun} ok` +
        `  repairs ${arm.repairs}` +
        (arm.blocked ? `  (${arm.blocked} blocked)` : ''),
    );
    if (arm.budgetBinding) console.log(`      warning: ${arm.budgetBinding} dialogue(s) hit the model-call budget`);
  }
  console.log(`transcripts: ${paths.htmlPath}`);
  console.log(`report:      ${paths.markdownPath}`);
  console.log(`details:     ${paths.jsonPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  if (args['render-report']) {
    const sourcePath = path.resolve(args['render-report']);
    const report = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const paths = writeArtifacts(args.out || path.dirname(sourcePath), report);
    if (args.open) openPath(paths.htmlPath);
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else printSummary(report, paths);
    process.exitCode = report.status === 'complete' ? 0 : report.status === 'blocked' ? 2 : 1;
    return;
  }

  const configPath = path.resolve(ROOT, args.config || DEFAULT_CONFIG);
  const loaded = loadTutorStubShowcaseConfig(configPath);
  const plan = buildTutorStubShowcasePlan({
    config: loaded.config,
    preset: args.preset || 'default',
    arms: csv(args.arms),
    scenarios: csv(args.scenarios),
    models: csv(args.models),
    maxTurns: args['max-turns'] === undefined ? null : Number.parseInt(args['max-turns'], 10),
    maxDialogues: args['max-dialogues'] === undefined ? null : Number.parseInt(args['max-dialogues'], 10),
    traceRoot: args['trace-root'] || path.join('.tutor-stub-traces', 'showcase', stamp()),
    configSha256: loaded.configSha256,
  });

  if (args['print-plan']) {
    const printable = publicTutorStubShowcasePlan(plan);
    if (args.json) console.log(JSON.stringify(printable, null, 2));
    else {
      console.log(`tutor instrumentation showcase: ${printable.preset}`);
      console.log(`status: ${printable.status}; dialogues: ${printable.plannedDialogues}/${printable.maxDialogues}`);
      console.log(
        `learner: ${printable.learner.provider}.${printable.learner.model} profile ${printable.learner.profile} (identical on every arm)`,
      );
      for (const arm of printable.arms) {
        console.log(
          `arm ${arm.id}${arm.baseline ? ' (baseline)' : ''}: ${arm.flags.join(' ') || 'no tutor-side flags'}`,
        );
      }
      for (const job of printable.jobs) {
        console.log(`\n${job.id} (${job.world}, up to ${job.maxTurns} turns)`);
        console.log(`  node ${job.childArgs.join(' ')}`);
      }
    }
    if (printable.status === 'budget_exhausted') process.exitCode = 2;
    return;
  }

  if (!args.quiet) {
    console.error(`running ${plan.plannedDialogues} dialogue(s), one at a time; child output follows`);
  }
  const report = await runTutorStubShowcase({
    plan,
    root: ROOT,
    spawnDialogue: ({ job, root, timeoutMs }) => spawnDialogue({ job, root, timeoutMs, quiet: args.quiet }),
    metadata: {
      ...currentGitMetadata(),
      configPath: path.relative(ROOT, configPath),
      command: process.argv.slice(2),
    },
    onProgress: (result) =>
      console.error(
        `  ${result.id}: ${result.status}` +
          (result.dialogue
            ? ` — ${result.dialogue.turnCount} turns, ${result.dialogue.modelCalls} calls, ${Math.round(result.wallClockMs / 1000)}s, ${result.dialogue.closure.grounded ? 'resolved' : result.dialogue.stopReason}`
            : result.error
              ? ` (${result.error.message})`
              : ''),
      ),
  });
  const paths = writeArtifacts(args.out || path.join(defaultOutRoot(), `showcase-${stamp()}`), report);
  if (args.open) openPath(paths.htmlPath);
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else printSummary(report, paths);
  process.exitCode = report.status === 'complete' ? 0 : report.status === 'blocked' ? 2 : 1;
}

main().catch((error) => {
  console.error(`tutor instrumentation showcase error: ${error.message}`);
  process.exitCode = 2;
});
