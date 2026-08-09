#!/usr/bin/env node

// Two-arm mock-compliment probe
// (notes/2026-08-09-register-mock-praise-preregistration.md).
//
// Same discipline as the other grids on this arc: --dry-run prints the plan SHA
// with zero model calls; a paid launch needs --launch-approved plus the exact
// clean-checkout commit SHA; --report-run is a zero-call fail-closed report.
//
// Both arms generate in ONE eval-cli invocation, so they land in one run id on
// one stack with one batch of scenario draws. Splitting them into two runs
// would put a run boundary inside the only contrast the design has.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  REGISTER_MOCK_PRAISE_PROBE as GRID,
  armProfiles,
  buildRegisterMockPraiseProbePlan,
  checkTutorStackProvenance,
  summarizeRegisterMockPraiseProbe,
  validateRegisterMockPraiseProbePlan,
} from '../services/registerMockPraiseProbe.js';
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
    armProfiles(GRID).join(','),
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
    'Register mock-praise probe: plain vs asked-for withdrawn compliment on codex.gpt-5.5',
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
    [process.execPath, 'scripts/run-register-mock-praise-probe.js', '--report-run', runId],
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
  const validation = validateRegisterMockPraiseProbePlan(plan);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const artifact = {
    schema: 'machinespirits.register-mock-praise-probe-dry-run.v1',
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
 * Every registered measure but the provenance one comes from here, in one pass:
 * the stance verdict at the adopting turn with its gate identity and its cached
 * manner reading, the adopting turn's own text (which is where the mock-praise
 * detector looks), the tutor v2.2 and register scores with their judge labels,
 * and the parent grid's positive-local-outcome verdict. Zero model calls.
 */
export function analysisRows(runId, { root = ROOT, execPath = process.execPath } = {}) {
  const jsonPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'register-mock-praise-')), `${runId}.json`);
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

function formatP(p) {
  return p == null ? 'n/a' : p.toFixed(4);
}

function runReport(runId, outputDir) {
  const analyses = analysisRows(runId);
  const dialogues = runDialogues(runId);
  const provenance = checkTutorStackProvenance(dialogues);
  const report = summarizeRegisterMockPraiseProbe(analyses, { provenance });
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `${runId}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify({ runId, report, analyses }, null, 2)}\n`);

  console.log(`[mock-praise] report ${report.status} (${report.observedRows}/${report.expectedRows} rows)`);
  console.log(
    `[mock-praise] gate ${report.measurement.gateVersion} fold ${report.measurement.fold} ` +
      `reader ${report.measurement.presenceQuestion}`,
  );
  console.log(
    `[mock-praise] tutor seats: ${provenance.seatCalls} calls, ` +
      `${
        Object.entries(provenance.observed)
          .map(([pair, n]) => `${pair} x${n}`)
          .join(', ') || 'none'
      }`,
  );
  for (const [armName, arm] of Object.entries(report.arms)) {
    console.log(
      `[mock-praise] ${armName}: ${arm.rows} rows, cue ${arm.cueCompliant}, praise ${arm.mockPraisePresent}, ` +
        `edged ${arm.readAsEdged}, tutor v2.2 mean ${arm.tutorV22Mean == null ? 'n/a' : arm.tutorV22Mean.toFixed(2)}`,
    );
  }
  for (const error of report.errors) console.log(`  - ${error}`);
  if (report.status === 'COMPLETE') {
    const c = report.contrasts;
    console.log(
      `[mock-praise] manipulation: praise in words ${c.mockPraiseDelivery.treatment} vs ` +
        `${c.mockPraiseDelivery.control} (p=${formatP(c.mockPraiseDelivery.p)}) — held: ${report.manipulationHeld}`,
    );
    console.log(
      `[mock-praise] PRIMARY read as edged ${c.mannerPresence.treatment} vs ${c.mannerPresence.control} ` +
        `(p=${formatP(c.mannerPresence.p)})`,
    );
    console.log(
      `[mock-praise] vs stored arm ${c.mannerPresenceVsStored.treatment} vs ${c.mannerPresenceVsStored.stored} ` +
        `(p=${formatP(c.mannerPresenceVsStored.p)})`,
    );
    console.log(
      `[mock-praise] device: with praise ${c.mockPraisePredictsEdge.withPraise} edged, without ` +
        `${c.mockPraisePredictsEdge.withoutPraise} (p=${formatP(c.mockPraisePredictsEdge.p)})`,
    );
    if (report.tutorCost) {
      console.log(
        `[mock-praise] cost: tutor v2.2 ${report.tutorCost.treatment.toFixed(2)} vs ` +
          `${report.tutorCost.control.toFixed(2)} (delta ${report.tutorCost.delta >= 0 ? '+' : ''}` +
          `${report.tutorCost.delta.toFixed(3)})`,
      );
    }
    console.log(`[mock-praise] verdict ${report.verdict}`);
    // Reprinted with the verdict, every time, because the whole risk at this
    // size is a rise that reads as an effect.
    for (const line of report.detectability.separatingOutcomes) console.log(`[mock-praise] detectability: ${line}`);
  }
  console.log(`[mock-praise] ${path.relative(ROOT, jsonPath)}`);
  if (report.status !== 'COMPLETE') throw new Error('register mock-praise report failed closed');
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
      'output-dir': { type: 'string', default: 'exports/register-mock-praise-probe' },
      'report-run': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(
      'Usage: node scripts/run-register-mock-praise-probe.js [--dry-run] ' +
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
  const plan = buildRegisterMockPraiseProbePlan();
  const outputDir = path.resolve(ROOT, values['output-dir']);
  const artifactPath = writePlanArtifact(plan, outputDir, { launchSha });

  console.log(`[mock-praise] plan SHA-256 ${plan.planSha256}`);
  console.log(`[mock-praise] ${plan.plannedRows} rows, ${plan.design}`);
  console.log(`[mock-praise] control ${GRID.arms.control.profile} (${GRID.arms.control.register})`);
  console.log(`[mock-praise] treatment ${GRID.arms.treatment.profile} (${GRID.arms.treatment.register})`);
  console.log(`[mock-praise] tutor stack ${GRID.generation.tutorModel} on ${GRID.tutorSeats.join(', ')}`);
  for (const line of GRID.detectability.separatingOutcomes) console.log(`[mock-praise] detectability: ${line}`);
  console.log(`[mock-praise] ${path.relative(ROOT, artifactPath)}`);

  if (!launch) {
    console.log('[mock-praise] paid launch locked; use --launch-approved --expected-sha <clean-commit>');
    return;
  }
  await runGeneration();
  console.log('[mock-praise] generation done; follow-ups:');
  for (const command of followUpCommands()) console.log(`  ${renderCommand(command)}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[mock-praise] ${error.message}`);
    process.exitCode = 1;
  });
}
