#!/usr/bin/env node

// Strong-stack replication of the parent grid's sarcastic arm
// (notes/2026-08-09-register-strong-stack-replication-preregistration.md).
//
// Same discipline as the parent grids: --dry-run prints the plan SHA with zero
// model calls; a paid launch needs --launch-approved plus the exact
// clean-checkout commit SHA; --report-run is a zero-call fail-closed report.
//
// One thing is new. The report reads the tutor stack off the dialogue traces
// and fails closed unless every id, ego and reviewer call went to the model the
// plan names. Four August runs stored codex.gpt-5.5 and called nemotron and
// kimi, and nothing noticed, because the run's record of the models is written
// by the runner and never compared to the calls.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  REGISTER_STRONG_STACK_REPLICATION as GRID,
  buildRegisterStrongStackReplicationPlan,
  checkTutorStackProvenance,
  summarizeRegisterStrongStackReplication,
  validateRegisterStrongStackReplicationPlan,
} from '../services/registerStrongStackReplication.js';
import { openEvaluationDbReadonly } from '../services/evaluationDbReadonly.js';
import { findDialogueLog } from './dump-turn-prompts.js';
import { isPositiveLocalOutcome } from './run-sarcasm-determinate-negation-grid.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export function generationCommand() {
  return [
    process.execPath,
    'scripts/eval-cli.js',
    'run',
    '--profiles',
    GRID.profiles.join(','),
    '--scenarios',
    GRID.scenarios.join(','),
    '--runs',
    String(GRID.repeats),
    '--parallelism',
    String(GRID.generation.parallelism),
    '--skip-rubric',
    '--tutor-model',
    GRID.generation.tutorModel,
    '--learner-model',
    GRID.generation.learnerModel,
    '--description',
    'Register strong-stack replication: sarcastic arm on codex.gpt-5.5',
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
      GRID.scoring.tutorJudgeCli,
      '--model',
      GRID.scoring.tutorJudgeModel,
      '--parallelism',
      '1',
    ],
    [process.execPath, 'scripts/evaluate-register-rubric.js', runId, '--judge', GRID.scoring.registerJudge],
    [process.execPath, 'scripts/read-negative-register-manner-presence.js', '--runs', runId],
    [process.execPath, 'scripts/run-register-strong-stack-replication.js', '--report-run', runId],
  ];
}

function shellQuote(value) {
  const raw = String(value);
  return /^[A-Za-z0-9_./:=,-]+$/u.test(raw) ? raw : `'${raw.replaceAll("'", "'\\''")}'`;
}

function renderCommand(command, { scenarioEnv = false } = {}) {
  const prefix = scenarioEnv ? `EVAL_SCENARIOS_FILE=${GRID.scenarioSource} ` : '';
  return `${prefix}${command.map(shellQuote).join(' ')}`;
}

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

export function assertLaunchAuthorization(expectedSha) {
  if (!/^[0-9a-f]{40}$/u.test(expectedSha || '')) {
    throw new Error('--launch-approved also requires --expected-sha with the exact 40-character clean commit SHA');
  }
  const head = gitOutput(['rev-parse', 'HEAD']);
  if (head !== expectedSha) throw new Error(`launch SHA mismatch: expected ${expectedSha}, checkout is ${head}`);
  if (gitOutput(['status', '--porcelain'])) throw new Error('paid launch requires a clean checkout');
  return head;
}

function writePlanArtifact(plan, outputDir, { launchSha = null } = {}) {
  const validation = validateRegisterStrongStackReplicationPlan(plan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const artifact = {
    schema: 'machinespirits.register-strong-stack-replication-dry-run.v1',
    modelCalls: 0,
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

/**
 * Every registered measure but the provenance one comes from here, in one
 * pass: the stance verdict at the adopting turn with its gate identity and its
 * cached manner reading, the tutor v2.2 and register scores with their judge
 * labels, and the parent grid's own positive-local-outcome verdict. Zero model
 * calls.
 */
export function analysisRows(runId, { root = ROOT, execPath = process.execPath } = {}) {
  const jsonPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'register-strong-stack-')), `${runId}.json`);
  const result = spawnSync(
    execPath,
    [
      'scripts/report-charisma-desire-breakthrough-matrix.js',
      '--runs',
      runId,
      '--output-json',
      jsonPath,
      '--output-md',
      `${jsonPath}.md`,
    ],
    { cwd: root, env: process.env, stdio: 'ignore' },
  );
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`matrix analyses unavailable (matrix reporter exited ${result.status})`);
  }
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  return (parsed.analyses || []).map((row) => ({ ...row, positiveOutcome: isPositiveLocalOutcome(row.verdict) }));
}

/** The run's dialogue traces, which is where the calls are recorded. */
export function runDialogues(runId, { root = ROOT } = {}) {
  const { db } = openEvaluationDbReadonly();
  const rows = db
    .prepare('SELECT DISTINCT dialogue_id FROM evaluation_results WHERE run_id = ? AND dialogue_id IS NOT NULL')
    .all(runId);
  const dialogues = [];
  for (const { dialogue_id: dialogueId } of rows) {
    const found = findDialogueLog(dialogueId, { rootDir: root });
    if (!found?.file) {
      dialogues.push({ dialogueId, trace: [], missing: true });
      continue;
    }
    const log = JSON.parse(fs.readFileSync(found.file, 'utf8'));
    dialogues.push({ dialogueId, trace: log.dialogueTrace || [] });
  }
  return dialogues;
}

function formatContrast(entry) {
  const p = entry.p == null ? 'n/a' : entry.p.toFixed(4);
  return `${entry.label}: this run ${entry.thisRun} vs parent ${entry.parent} (Fisher p=${p})`;
}

function runReport(runId, outputDir) {
  const analyses = analysisRows(runId);
  const dialogues = runDialogues(runId);
  const provenance = checkTutorStackProvenance(dialogues);
  const report = summarizeRegisterStrongStackReplication(analyses, { provenance });
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${runId}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify({ runId, report, analyses }, null, 2)}\n`);

  console.log(`[register-strong-stack] report ${report.status} (${report.observedRows}/${report.expectedRows} rows)`);
  console.log(
    `[register-strong-stack] gate ${report.measurement.gateRegister}@${report.measurement.gateVersion} ` +
      `fold ${report.measurement.fold}`,
  );
  console.log(
    `[register-strong-stack] tutor seats: ${provenance.seatCalls} calls, ` +
      `${
        Object.entries(provenance.observed)
          .map(([pair, n]) => `${pair} x${n}`)
          .join(', ') || 'none'
      }`,
  );
  // The pass count next to what it is made of, always. A count carried by the
  // wrong part of the gate is only visible when the split is on the page.
  for (const gate of report.componentContingency?.gates || []) {
    console.log(`[register-strong-stack] ${gate.passed}/${gate.n} faithful under ${gate.gate}, by part:`);
    for (const part of gate.parts) {
      console.log(
        `    ${part.key} (${part.weight}${part.required ? ', required' : ''}): ` +
          `${part.presentPassed} had it and passed, ${part.presentFailed} had it and failed, ` +
          `${part.absentPassed} lacked it and passed, ${part.absentFailed} lacked it and failed`,
      );
    }
    for (const warning of gate.warnings) console.log(`    ! ${warning.severity}: ${warning.message}`);
  }
  for (const error of report.errors) console.log(`  - ${error}`);
  if (report.status === 'COMPLETE') {
    for (const key of ['cueCompliance', 'mannerPresence']) {
      console.log(`[register-strong-stack] ${formatContrast(report.contrasts[key])}`);
    }
    console.log(
      `[register-strong-stack] faithful positive local outcomes ` +
        `${report.overall.faithfulPositiveOutcomes}/${report.overall.readAsEdged}`,
    );
    console.log(`[register-strong-stack] verdict ${report.verdict}`);
  }
  console.log(`[register-strong-stack] ${path.relative(ROOT, jsonPath)}`);
  if (report.status !== 'COMPLETE') throw new Error('register strong-stack report failed closed');
}

async function runGeneration() {
  const command = generationCommand();
  await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: ROOT,
      env: { ...process.env, EVAL_SCENARIOS_FILE: GRID.scenarioSource },
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

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'launch-approved': { type: 'boolean', default: false },
      'expected-sha': { type: 'string', default: '' },
      'output-dir': { type: 'string', default: 'exports/register-strong-stack-replication' },
      'report-run': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(
      'Usage: node scripts/run-register-strong-stack-replication.js [--dry-run] ' +
        '[--launch-approved --expected-sha <sha>] [--report-run <runId>] [--output-dir <dir>]',
    );
    return;
  }
  if (values['dry-run'] && values['launch-approved']) throw new Error('choose either --dry-run or --launch-approved');
  if (values['report-run'] && values['launch-approved']) throw new Error('--report-run is a zero-call reporting mode');
  if (values['report-run']) {
    runReport(values['report-run'], path.resolve(ROOT, values['output-dir']));
    return;
  }

  const launch = Boolean(values['launch-approved']);
  const launchSha = launch ? assertLaunchAuthorization(values['expected-sha']) : null;
  const plan = buildRegisterStrongStackReplicationPlan();
  const outputDir = path.resolve(ROOT, values['output-dir']);
  const artifactPath = writePlanArtifact(plan, outputDir, { launchSha });

  console.log(`[register-strong-stack] plan SHA-256 ${plan.planSha256}`);
  console.log(`[register-strong-stack] ${plan.plannedRows} rows, ${plan.design}`);
  console.log(`[register-strong-stack] tutor stack ${GRID.generation.tutorModel} on ${GRID.tutorSeats.join(', ')}`);
  console.log(`[register-strong-stack] ${path.relative(ROOT, artifactPath)}`);

  if (!launch) {
    console.log('[register-strong-stack] paid launch locked; use --launch-approved --expected-sha <clean-commit>');
    return;
  }
  await runGeneration();
  console.log('[register-strong-stack] generation done; follow-ups:');
  for (const command of followUpCommands()) console.log(`  ${renderCommand(command)}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[register-strong-stack] ${error.message}`);
    process.exitCode = 1;
  });
}
