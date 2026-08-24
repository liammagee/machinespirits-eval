#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubResistantLearnerCalibrationPlan,
  loadTutorStubResistantLearnerDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import { readTutorStubRegisteredStudyOutcome } from '../services/tutorStubRegisteredStudyOutcome.js';
import {
  runTutorStubResistantLearnerCalibrationChild,
  tutorStubResistantLearnerCalibrationChildSpec,
} from './run-tutor-stub-resistant-learner-calibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B1_DESIGN_PATH = 'config/tutor-stub-resistant-learner-b1-design.v3.json';
const R1_DESIGN_PATH = 'config/tutor-stub-resistant-learner-r1-design.v3.json';
const SMOKE_DIRECTORY = 'resistant-learner-bridge-smoke-2026-08-24';
const REGISTERS = ['warm', 'plain', 'edged'];

export const TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_SMOKE_ATTEMPT_CEILING = 800;
export const TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_SMOKE_USAGE = `Usage:
  EVAL_ARCHIVE_DIR=/Users/lmagee/Dev/machinespirits/machinespirits-eval-private \\
    node scripts/run-resistant-learner-bridge-smoke.js --launch

Zero-call plan inspection:
  EVAL_ARCHIVE_DIR=/Users/lmagee/Dev/machinespirits/machinespirits-eval-private \\
    node scripts/run-resistant-learner-bridge-smoke.js --dry-run

The attended launch writes once to:
  $EVAL_ARCHIVE_DIR/artifacts/tutor-stub-live/${SMOKE_DIRECTORY}

This is an unregistered six-dialogue exploratory smoke. It runs no final readers or fidelity panel,
records no approval, retries no dialogue, and never exceeds 800 model-call attempts.`;

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });
}

function appendJsonLine(filePath, value) {
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function gitOrNull(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function sourceProvenance() {
  return {
    commit: gitOrNull('rev-parse', 'HEAD'),
    tree: gitOrNull('rev-parse', 'HEAD^{tree}'),
    dirty: Boolean(gitOrNull('status', '--porcelain=v1', '--untracked-files=all')),
  };
}

function readTraceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.jsonl'))
    .sort()
    .map((name) => path.join(directory, name));
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function relativeArtifact(destination, filePath) {
  return fs.existsSync(filePath) ? path.relative(destination, filePath) : null;
}

function exactJob(plan, predicate, label) {
  const jobs = plan.jobs.filter(predicate);
  if (jobs.length < 1) throw new Error(`bridge smoke cannot find ${label}`);
  return jobs[0];
}

export function selectTutorStubResistantLearnerBridgeSmokeJobs({ b1Loaded, r1Loaded }) {
  const b1Plan = buildTutorStubResistantLearnerCalibrationPlan(b1Loaded.design);
  const r1Plan = buildTutorStubResistantLearnerCalibrationPlan(r1Loaded.design);
  const b1 = REGISTERS.map((register) => ({
    loaded: b1Loaded,
    job: exactJob(
      b1Plan,
      (candidate) => candidate.register === register && candidate.action === 'ask_discriminating_question',
      `B1 ${register} ask_discriminating_question job`,
    ),
  }));
  const r1Selections = [
    { register: 'warm', world: 'world_005_marrick' },
    { register: 'plain', world: 'world_030_rowan_flat' },
    { register: 'edged', world: 'world_005_marrick' },
  ];
  const r1 = r1Selections.map(({ register, world }) => ({
    loaded: r1Loaded,
    job: exactJob(
      r1Plan,
      (candidate) => candidate.register === register && candidate.world === world,
      `R1 ${register} ${world} job`,
    ),
  }));
  const selected = [...b1, ...r1];
  if (new Set(selected.map(({ job }) => job.id)).size !== 6) {
    throw new Error('bridge smoke job selection must contain six distinct dialogues');
  }
  return selected;
}

export function buildTutorStubResistantLearnerBridgeSmokePlan({ root = ROOT } = {}) {
  const b1Loaded = loadTutorStubResistantLearnerDesign({ designPath: B1_DESIGN_PATH, root });
  const r1Loaded = loadTutorStubResistantLearnerDesign({ designPath: R1_DESIGN_PATH, root });
  const selected = selectTutorStubResistantLearnerBridgeSmokeJobs({ b1Loaded, r1Loaded });
  return {
    selected,
    plan: {
      schema: 'machinespirits.tutor-stub.resistant-learner-bridge-smoke-plan.v1',
      exploratory: true,
      registered: false,
      designs: [
        { path: B1_DESIGN_PATH, sha256: b1Loaded.sha256 },
        { path: R1_DESIGN_PATH, sha256: r1Loaded.sha256 },
      ],
      included_model_roles: ['tutor', 'learner', 'analysis', 'trigger_observer'],
      excluded_model_roles: ['final_semantic_reader', 'fidelity_panel'],
      retry_policy: 'none',
      replacement_dialogues: 0,
      hard_attempt_ceiling: TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_SMOKE_ATTEMPT_CEILING,
      jobs: selected.map(({ job }) => ({
        id: job.id,
        study: job.study,
        world: job.world,
        register: job.register,
        action: job.action,
      })),
      model_calls_executed: 0,
    },
  };
}

export function summarizeTutorStubResistantLearnerBridgeSmokeDialogue({ destination, job, spec, exit }) {
  const traceFiles = readTraceFiles(spec.traceDir);
  const events = traceFiles.flatMap(readJsonLines);
  const learnerTurns = events.filter((event) => event.type === 'auto_learner_turn');
  const metTurns = learnerTurns.filter(
    (event) => event.learnerResponseProvenance?.automation?.rivalLearnerDagTurn?.typedConcession?.eligible === true,
  );
  const attempts = events.filter((event) => event.type === 'model_call_budget_reserved').length;
  const finalReaderEvents = events.filter((event) => event.type === 'resistant_learner_semantic_reader_result');
  const readerSkipEvents = events.filter(
    (event) => event.type === 'resistant_learner_bridge_smoke_final_readers_skipped',
  );
  const registeredOutcome = readTutorStubRegisteredStudyOutcome({
    filePath: spec.registeredStudyOutcome,
    expectedJobId: job.id,
  });
  const retainedSubstantiveExit = exit.code !== 0 && registeredOutcome.present && registeredOutcome.valid;
  const technicalIssues = [];
  if (exit.spawn_error) technicalIssues.push(`child spawn error: ${exit.spawn_error}`);
  if (exit.code !== 0 && !retainedSubstantiveExit) {
    technicalIssues.push(`child exited ${exit.code ?? 'without a code'}${exit.signal ? ` on ${exit.signal}` : ''}`);
  }
  if (traceFiles.length !== 1) technicalIssues.push(`expected one trace, found ${traceFiles.length}`);
  if (finalReaderEvents.length > 0) technicalIssues.push('a forbidden final-reader call was observed');
  if (exit.code === 0 && readerSkipEvents.length !== 1) {
    technicalIssues.push(`expected one final-reader skip record, found ${readerSkipEvents.length}`);
  }
  if (exit.code === 0 && !fs.existsSync(spec.transcript)) technicalIssues.push('completed child transcript is missing');
  return {
    attempts,
    technicalIssues,
    dialogue: {
      job_id: job.id,
      study: job.study,
      world: job.world,
      register: job.register,
      action: job.action,
      turn_count: learnerTurns.length,
      met_directive_count: metTurns.length,
      met_turns: metTurns.map((event) => ({
        turn: event.turn,
        learner_next_public_turn: String(event.text || '').slice(0, 400),
      })),
      model_attempts: attempts,
      transcript: relativeArtifact(destination, spec.transcript),
      traces: traceFiles.map((filePath) => path.relative(destination, filePath)),
      stdout: relativeArtifact(destination, spec.stdout),
      stderr: relativeArtifact(destination, spec.stderr),
    },
  };
}

export async function executeTutorStubResistantLearnerBridgeSmoke({
  destination,
  selected,
  provenance = sourceProvenance(),
  childSpec = tutorStubResistantLearnerCalibrationChildSpec,
  runChild = runTutorStubResistantLearnerCalibrationChild,
} = {}) {
  if (fs.existsSync(destination)) throw new Error('bridge smoke destination is create-once');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.mkdirSync(destination, { recursive: false });
  fs.mkdirSync(path.join(destination, 'jobs'));
  const ledgerPath = path.join(destination, 'smoke-ledger.jsonl');
  writeOnce(ledgerPath, '');
  writeOnce(path.join(destination, 'smoke-plan.json'), {
    schema: 'machinespirits.tutor-stub.resistant-learner-bridge-smoke-execution-plan.v1',
    exploratory: true,
    registered: false,
    approval_file: null,
    source: provenance,
    hard_attempt_ceiling: TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_SMOKE_ATTEMPT_CEILING,
    jobs: selected.map(({ job }) => ({
      id: job.id,
      study: job.study,
      world: job.world,
      register: job.register,
      action: job.action,
    })),
  });
  appendJsonLine(ledgerPath, {
    at: new Date().toISOString(),
    type: 'smoke_started',
    planned_dialogues: selected.length,
    hard_attempt_ceiling: TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_SMOKE_ATTEMPT_CEILING,
  });

  let attempts = 0;
  let executionHalt = null;
  const dialogues = [];
  for (const { loaded, job } of selected) {
    const remaining = TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_SMOKE_ATTEMPT_CEILING - attempts;
    if (remaining < 1) {
      executionHalt = { job_id: job.id, technical_issues: ['hard attempt ceiling exhausted before child start'] };
      break;
    }
    const modelCallBudget = Math.min(loaded.design.attemptCeilings.maximumReservationsPerDialogue, remaining);
    const spec = childSpec({
      loaded,
      job,
      destination,
      bridgeSmokeSkipFinalReaders: true,
      modelCallBudget,
    });
    const exit = await runChild(spec);
    const summary = summarizeTutorStubResistantLearnerBridgeSmokeDialogue({ destination, job, spec, exit });
    attempts += summary.attempts;
    if (attempts > TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_SMOKE_ATTEMPT_CEILING) {
      throw new Error('bridge smoke hard attempt ceiling exceeded');
    }
    dialogues.push(summary.dialogue);
    if (summary.technicalIssues.length > 0) {
      executionHalt = { job_id: job.id, technical_issues: summary.technicalIssues };
    }
    appendJsonLine(ledgerPath, {
      at: new Date().toISOString(),
      type: 'dialogue_finished',
      job_id: job.id,
      model_attempts: summary.attempts,
      cumulative_model_attempts: attempts,
      ...(executionHalt ? { execution_halt: executionHalt } : {}),
    });
    process.stdout.write(
      `smoke dialogue ${dialogues.length}/${selected.length}; attempts ${attempts}/${TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_SMOKE_ATTEMPT_CEILING}${executionHalt ? '; halted on technical failure' : ''}\n`,
    );
    if (executionHalt) break;
  }

  const report = {
    schema: 'machinespirits.tutor-stub.resistant-learner-bridge-smoke-report.v1',
    exploratory: true,
    registered: false,
    generated_at: new Date().toISOString(),
    hard_attempt_ceiling: TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_SMOKE_ATTEMPT_CEILING,
    model_attempts: attempts,
    dialogues_planned: selected.length,
    dialogues_recorded: dialogues.length,
    execution_halt: executionHalt,
    dialogues,
  };
  writeOnce(path.join(destination, 'smoke-report.json'), report);
  appendJsonLine(ledgerPath, {
    at: new Date().toISOString(),
    type: 'smoke_sealed',
    dialogues_recorded: dialogues.length,
    model_attempts: attempts,
    execution_halt: executionHalt,
  });
  return report;
}

function destinationFromEnvironment(env) {
  const archive = String(env.EVAL_ARCHIVE_DIR || '').trim();
  if (!archive || !path.isAbsolute(archive)) {
    throw new Error('EVAL_ARCHIVE_DIR must name the absolute private evaluation archive');
  }
  return path.join(archive, 'artifacts', 'tutor-stub-live', SMOKE_DIRECTORY);
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({
    args: argv,
    options: {
      launch: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  process.stdout.write(`${TUTOR_STUB_RESISTANT_LEARNER_BRIDGE_SMOKE_USAGE}\n`);
  if (values.help || (!values.launch && !values['dry-run'])) return;
  if (values.launch && values['dry-run']) throw new Error('choose exactly one of --launch or --dry-run');
  const destination = destinationFromEnvironment(env);
  const { selected, plan } = buildTutorStubResistantLearnerBridgeSmokePlan();
  if (fs.existsSync(destination)) throw new Error('bridge smoke destination is create-once');
  if (values['dry-run']) {
    process.stdout.write(
      `${JSON.stringify({ ...plan, destination, destination_absent: true, production_writes: 0 }, null, 2)}\n`,
    );
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('the bridge smoke launch requires one attended terminal invocation');
  }
  const report = await executeTutorStubResistantLearnerBridgeSmoke({ destination, selected });
  process.stdout.write(`smoke report: ${path.join(destination, 'smoke-report.json')}\n`);
  if (report.execution_halt) process.exitCode = 1;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
