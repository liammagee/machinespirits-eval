#!/usr/bin/env node
/**
 * A second draw of the ironic tutor against a question-flooding learner.
 *
 * Three rows. A screen, not a study — see `services/ironicQuestionFloodRedraw.js`
 * for why, and `workplan/items/ironic-question-flood-target.md` for the card.
 *
 * Usage:
 *   node scripts/run-ironic-question-flood-redraw.js --dry-run
 *   node scripts/run-ironic-question-flood-redraw.js --launch-approved --expected-sha <sha>
 *   node scripts/run-ironic-question-flood-redraw.js --report-run <runId>
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  buildIronicQuestionFloodRedrawPlan,
  IRONIC_QUESTION_FLOOD_REDRAW,
  readRedrawVerdict,
  validateIronicQuestionFloodRedrawPlan,
} from '../services/ironicQuestionFloodRedraw.js';
import { evaluateRegisterStanceFidelity, STANCE_GATE_VERSION } from '../services/registerStanceFidelity.js';
import { resolveEvaluationDbPath } from '../services/evaluationDataPaths.js';
import { compareProvenance } from './analyze-sarcasm-mood-floor-replication.js';
import { fisherExactTwoSided } from '../services/fisherExact.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export function generationCommand() {
  return [
    process.execPath,
    'scripts/eval-cli.js',
    'run',
    '--profiles',
    IRONIC_QUESTION_FLOOD_REDRAW.profiles.join(','),
    '--scenarios',
    IRONIC_QUESTION_FLOOD_REDRAW.scenarios.join(','),
    '--runs',
    String(IRONIC_QUESTION_FLOOD_REDRAW.repeats),
    '--parallelism',
    String(IRONIC_QUESTION_FLOOD_REDRAW.generation.parallelism),
    '--skip-rubric',
    '--tutor-model',
    IRONIC_QUESTION_FLOOD_REDRAW.generation.tutorModel,
    '--learner-model',
    IRONIC_QUESTION_FLOOD_REDRAW.generation.learnerModel,
    '--description',
    'Ironic question-flood second draw v1',
  ];
}

export function followUpCommands(runId = '<runId>') {
  return [
    [
      process.execPath,
      'scripts/eval-cli.js',
      'evaluate',
      runId,
      '--tutor-only',
      '--judge-cli',
      IRONIC_QUESTION_FLOOD_REDRAW.scoring.tutorJudgeCli,
      '--model',
      IRONIC_QUESTION_FLOOD_REDRAW.scoring.tutorJudgeModel,
      '--parallelism',
      '1',
    ],
    [
      process.execPath,
      'scripts/evaluate-register-rubric.js',
      runId,
      '--judge',
      IRONIC_QUESTION_FLOOD_REDRAW.scoring.registerJudge,
    ],
    [process.execPath, 'scripts/run-ironic-question-flood-redraw.js', '--report-run', runId],
  ];
}

function shellQuote(value) {
  const raw = String(value);
  return /^[A-Za-z0-9_./:=,-]+$/u.test(raw) ? raw : `'${raw.replaceAll("'", "'\\''")}'`;
}

function renderCommand(command, { scenarioEnv = false } = {}) {
  const prefix = scenarioEnv ? `EVAL_SCENARIOS_FILE=${IRONIC_QUESTION_FLOOD_REDRAW.scenarioSource} ` : '';
  return `${prefix}${command.map(shellQuote).join(' ')}`;
}

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

export function assertRedrawLaunchAuthorization(expectedSha) {
  if (!/^[0-9a-f]{40}$/u.test(expectedSha || '')) {
    throw new Error('--launch-approved also requires --expected-sha with the exact 40-character clean commit SHA');
  }
  const head = gitOutput(['rev-parse', 'HEAD']);
  if (head !== expectedSha) throw new Error(`launch SHA mismatch: expected ${expectedSha}, checkout is ${head}`);
  if (gitOutput(['status', '--porcelain'])) throw new Error('paid launch requires a clean checkout');
  return head;
}

function writePlanArtifact(plan, outputDir, { launchSha = null } = {}) {
  const validation = validateIronicQuestionFloodRedrawPlan(plan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const artifact = {
    schema: 'machinespirits.ironic-question-flood-redraw-dry-run.v1',
    modelCalls: 0,
    storageWritesBeforeArtifact: 0,
    paidLaunchStatus: launchSha ? 'authorized_for_generation' : 'locked_pending_explicit_user_approval',
    launchSha,
    validation,
    plan,
    generationCommand: renderCommand(generationCommand(), { scenarioEnv: true }),
    followUpCommands: followUpCommands().map((command) => renderCommand(command)),
  };
  fs.mkdirSync(outputDir, { recursive: true });
  const artifactPath = path.join(outputDir, 'plan.json');
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return artifactPath;
}

async function runGeneration() {
  const command = generationCommand();
  await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: ROOT,
      env: { ...process.env, EVAL_SCENARIOS_FILE: IRONIC_QUESTION_FLOOD_REDRAW.scenarioSource },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`generation stopped by ${signal}`));
      else if (code !== 0) reject(new Error(`generation exited ${code}`));
      else resolve();
    });
  });
}

function loadRunRows({ runId, workDir, dbPath }) {
  const jsonPath = path.join(workDir, `${runId}.json`);
  const env = { ...process.env };
  if (dbPath) env.EVAL_DB_PATH = dbPath;
  const result = spawnSync(
    process.execPath,
    [
      'scripts/report-charisma-desire-breakthrough-matrix.js',
      '--run-id',
      runId,
      '--output-json',
      jsonPath,
      '--output-md',
      path.join(workDir, `${runId}.md`),
    ],
    { cwd: ROOT, env, stdio: 'ignore' },
  );
  if (result.status !== 0) throw new Error(`matrix reporter exited ${result.status} for ${runId}`);
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8')).analyses || [];
}

/**
 * The gate reads message text, so both draws are scored here from dialogue
 * content under one gate and one fold. No stored score enters the count, and
 * nothing is written back to any row.
 */
export function summarizeDraw(rows) {
  const scored = rows.map((row) => {
    const verdict = evaluateRegisterStanceFidelity({
      registerName: IRONIC_QUESTION_FLOOD_REDRAW.gate,
      tutorMessage: row.tutorMessage,
      learnerMessage: row.preLearner,
      postLearnerMessage: row.postLearner,
    });
    return {
      rowId: row.rowId,
      scenarioId: row.scenarioId,
      passed: verdict.passed,
      score: verdict.score,
      missing: verdict.missing,
    };
  });
  return {
    gate: IRONIC_QUESTION_FLOOD_REDRAW.gate,
    gateVersion: STANCE_GATE_VERSION,
    fold: IRONIC_QUESTION_FLOOD_REDRAW.fold,
    n: scored.length,
    held: scored.filter((row) => row.passed).length,
    rows: scored,
  };
}

function renderMarkdown(data) {
  const lines = [];
  lines.push('# Irony against question-flooding — second draw');
  lines.push('');
  lines.push(`Generated ${data.generatedAt}. Status **${data.status}**, verdict **${data.verdict}**.`);
  lines.push('');
  lines.push(
    `Gate \`${data.gate}@${data.gateVersion}\`, slice fold \`${data.fold}\`. The gate reads message text, so ` +
      'the judge cannot enter these counts. Counts under a different gate or fold are not comparable to these.',
  );
  lines.push('');
  lines.push('| draw | run | held the manner |');
  lines.push('| --- | --- | --- |');
  for (const draw of data.draws) {
    lines.push(`| ${draw.label} | \`${draw.runId}\` | **${draw.summary.held}/${draw.summary.n}** |`);
  }
  lines.push('');
  lines.push(`Two-sided Fisher exact between draws: **p = ${data.p === null ? 'n/a' : data.p.toFixed(4)}**.`);
  lines.push('');
  lines.push(`Matched on: ${data.matchedOn.join('; ')}.`);
  lines.push('');
  lines.push('## The frozen rule, and what it says');
  lines.push('');
  lines.push(
    `Written before the run: at or below ${data.decisionRule.closesThreadAtOrBelow} the thread closes; at or ` +
      `above ${data.decisionRule.clearsForDesignAtOrAbove} it clears for a design; ` +
      `${data.decisionRule.inconclusiveAt} is inconclusive. Background: ${data.decisionRule.backgroundHeldRate}.`,
  );
  lines.push('');
  lines.push(data.reading);
  lines.push('');
  lines.push(`Claims licensed by this report: ${data.decisionRule.claimsLicensed}.`);
  lines.push('');
  if (data.errors.length) {
    lines.push('## Errors');
    lines.push('');
    for (const error of data.errors) lines.push(`- **${error}**`);
    lines.push('');
  }
  return lines.join('\n');
}

function reportRun(runId, outputDir) {
  const dbPath = resolveEvaluationDbPath(ROOT);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ironic-redraw-'));
  let priorRows;
  let newRows;
  try {
    priorRows = loadRunRows({ runId: IRONIC_QUESTION_FLOOD_REDRAW.priorRun, workDir, dbPath });
    newRows = loadRunRows({ runId, workDir, dbPath });
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }

  const inCell = (rows) =>
    rows.filter(
      (row) =>
        IRONIC_QUESTION_FLOOD_REDRAW.profiles.includes(row.profileName) &&
        IRONIC_QUESTION_FLOOD_REDRAW.scenarios.includes(row.scenarioId),
    );
  const prior = summarizeDraw(inCell(priorRows));
  const fresh = summarizeDraw(inCell(newRows));

  const errors = [];
  if (!prior.n) errors.push(`no ironic question-flood rows in ${IRONIC_QUESTION_FLOOD_REDRAW.priorRun}`);
  if (fresh.n !== IRONIC_QUESTION_FLOOD_REDRAW.repeats) {
    errors.push(`expected ${IRONIC_QUESTION_FLOOD_REDRAW.repeats} rows in ${runId}, found ${fresh.n}`);
  }
  const provenance = compareProvenance({
    dbPath,
    runs: [IRONIC_QUESTION_FLOOD_REDRAW.priorRun, runId],
    scenarios: IRONIC_QUESTION_FLOOD_REDRAW.scenarios,
    profilePrefix: 'cell_196_',
  });
  for (const mismatch of provenance.mismatches) {
    errors.push(`the two draws are not matched — ${mismatch}; this is a configuration change, not a second draw`);
  }

  const { verdict, reading } = readRedrawVerdict(fresh);
  const data = {
    schema: 'machinespirits.ironic-question-flood-redraw-report.v1',
    generatedAt: new Date().toISOString(),
    status: errors.length ? 'INCOMPLETE' : 'COMPLETE',
    verdict: errors.length ? 'NOT_READ' : verdict,
    reading: errors.length ? 'The report failed closed; the verdict is not read.' : reading,
    gate: IRONIC_QUESTION_FLOOD_REDRAW.gate,
    gateVersion: STANCE_GATE_VERSION,
    fold: IRONIC_QUESTION_FLOOD_REDRAW.fold,
    decisionRule: IRONIC_QUESTION_FLOOD_REDRAW.decisionRule,
    matchedOn: [
      ...provenance.matched,
      `gate \`${IRONIC_QUESTION_FLOOD_REDRAW.gate}@${STANCE_GATE_VERSION}\``,
      `fold \`${IRONIC_QUESTION_FLOOD_REDRAW.fold}\``,
    ],
    p:
      prior.n && fresh.n
        ? fisherExactTwoSided(prior.held, prior.n - prior.held, fresh.held, fresh.n - fresh.held)
        : null,
    draws: [
      { label: 'first (effect grid)', runId: IRONIC_QUESTION_FLOOD_REDRAW.priorRun, summary: prior },
      { label: 'second (this run)', runId, summary: fresh },
    ],
    errors,
  };

  fs.mkdirSync(path.resolve(ROOT, outputDir), { recursive: true });
  const jsonPath = path.resolve(ROOT, outputDir, `${runId}.json`);
  const mdPath = path.resolve(ROOT, outputDir, `${runId}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`);
  fs.writeFileSync(mdPath, `${renderMarkdown(data)}\n`);
  console.log(renderMarkdown(data));
  console.log(`\nWrote ${path.relative(ROOT, jsonPath)} and ${path.relative(ROOT, mdPath)}`);
  if (errors.length) process.exitCode = 1;
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'launch-approved': { type: 'boolean', default: false },
      'expected-sha': { type: 'string', default: '' },
      'output-dir': { type: 'string', default: 'exports/ironic-question-flood-redraw' },
      'report-run': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/run-ironic-question-flood-redraw.js [--dry-run] [--launch-approved --expected-sha <sha>] [--report-run <runId>] [--output-dir <dir>]',
    );
    return;
  }
  if (values['dry-run'] && values['launch-approved']) throw new Error('choose either --dry-run or --launch-approved');
  if (values['report-run'] && values['launch-approved']) throw new Error('--report-run is a zero-call reporting mode');
  if (values['report-run']) {
    reportRun(values['report-run'], values['output-dir']);
    return;
  }
  const launch = Boolean(values['launch-approved']);
  const plan = buildIronicQuestionFloodRedrawPlan();
  const launchSha = launch ? assertRedrawLaunchAuthorization(values['expected-sha']) : null;
  const artifactPath = writePlanArtifact(plan, path.resolve(ROOT, values['output-dir']), { launchSha });
  console.log(`[ironic-redraw] plan PASS; 0 model calls; ${plan.plannedRows} rows`);
  console.log(`[ironic-redraw] plan SHA-256 ${plan.planSha256}`);
  console.log(`[ironic-redraw] ${path.relative(ROOT, artifactPath)}`);
  if (!launch) {
    console.log('[ironic-redraw] paid launch locked; use --launch-approved --expected-sha <clean-commit>');
    return;
  }
  await runGeneration();
  console.log('[ironic-redraw] generation complete; use the printed run ID in these commands:');
  for (const command of followUpCommands()) console.log(renderCommand(command));
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[ironic-redraw] ${error.message}`);
    process.exit(1);
  }
}
