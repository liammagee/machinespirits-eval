#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { refuseRetiredPaidLaunch } from '../services/retiredPaidLauncher.js';
import { requiredTutorStubArtifactArchiveArgs } from '../services/tutorStubArtifactArchive.js';
import { loadTutorStubResistanceManipulationValidation } from '../services/tutorStubResistanceActionRegisterManipulationValidation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function repoPath(relative, label) {
  if (!relative || path.isAbsolute(relative)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(ROOT, relative);
  const rebased = path.relative(ROOT, absolute);
  if (rebased.startsWith('..') || path.isAbsolute(rebased)) throw new Error(`${label} escapes repository root`);
  return absolute;
}

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function assertSource(expectedCommit, designRelative) {
  const commit = git('rev-parse', 'HEAD');
  if (commit !== expectedCommit) throw new Error(`launch commit drift: expected ${expectedCommit}, found ${commit}`);
  if (git('status', '--porcelain=v1', '--untracked-files=all')) {
    throw new Error('manipulation validation requires a clean detached checkout');
  }
  let branch = '';
  try {
    branch = git('symbolic-ref', '-q', '--short', 'HEAD');
  } catch {
    branch = '';
  }
  if (branch) throw new Error(`manipulation validation requires detached HEAD, found ${branch}`);
  const committed = execFileSync('git', ['show', `${commit}:${designRelative}`], { cwd: ROOT });
  const onDisk = fs.readFileSync(repoPath(designRelative, 'design'));
  if (!committed.equals(onDisk)) throw new Error('launch commit does not contain the exact design bytes');
  return commit;
}

function assertGoNote({ goNoteCommit, goNotePath, launchCommit, designPath, spendCap }) {
  execFileSync('git', ['merge-base', '--is-ancestor', launchCommit, goNoteCommit], { cwd: ROOT });
  const text = execFileSync('git', ['show', `${goNoteCommit}:${goNotePath}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (
    !text.split(/\r?\n/u).some((line) => line.trim() === 'GO') ||
    !text.includes(designPath) ||
    !text.includes(launchCommit) ||
    !text.includes(String(spendCap))
  ) {
    throw new Error('signed GO note does not bind GO, design, launch commit, and spend cap');
  }
  return { commit: goNoteCommit, path: goNotePath };
}

function readTrace(traceDir) {
  const names = fs.readdirSync(traceDir).filter((name) => name.endsWith('.jsonl'));
  if (names.length !== 1) throw new Error(`expected one trace in ${traceDir}; found ${names.length}`);
  const trace = path.join(traceDir, names[0]);
  const events = fs
    .readFileSync(trace, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { trace, events };
}

function childSpec({ loaded, job, destination }) {
  const root = path.join(destination, 'jobs', job.id);
  const traceDir = path.join(root, 'traces');
  fs.mkdirSync(traceDir, { recursive: true });
  return {
    root,
    traceDir,
    transcript: path.join(root, 'transcript.json'),
    stdout: path.join(root, 'stdout.log'),
    stderr: path.join(root, 'stderr.log'),
    args: [
      'scripts/tutor-stub.js',
      '--lab',
      'automated_eval',
      '--acknowledge-research-use',
      ...requiredTutorStubArtifactArchiveArgs(),
      '--model-call-budget',
      '69',
      '--all-models',
      'codex.gpt-5.6-luna',
      '--model',
      'codex.gpt-5.6-luna',
      '--classifier-model',
      'codex.gpt-5.6-luna',
      '--learner-record-model',
      'codex.gpt-5.6-luna',
      '--auto-learner-model',
      'codex.gpt-5.6-luna',
      '--cli-effort',
      'low',
      '--world',
      'world_005_marrick',
      '--dag',
      '--dag-mode',
      'strict_dag',
      '--tutor-learner-dag',
      '--auto-learner',
      '--auto-learner-profile',
      'frame_refuser',
      '--auto-turns',
      '2',
      '--no-auto-stop-on-grounded',
      '--no-memory-summary',
      '--no-turn-feedback',
      '--run-seed',
      String(job.run_seed),
      '--eval-repeat',
      String(job.assignment_index),
      '--eval-job-id',
      job.id,
      '--register-policy',
      'field',
      '--register-palette',
      'plain,warm',
      '--dag-fact-dropout',
      '0',
      '--dag-fact-dropout-seed',
      '1',
      '--resistance-action-register-manipulation-validation-design',
      path.relative(ROOT, loaded.path),
      '--resistance-action-register-manipulation-validation-job',
      job.id,
      '--trace-dir',
      path.relative(ROOT, traceDir),
      '--save',
      path.relative(ROOT, path.join(root, 'transcript.json')),
    ],
  };
}

function runChild(spec) {
  return new Promise((resolve) => {
    const stdout = fs.openSync(spec.stdout, 'wx');
    const stderr = fs.openSync(spec.stderr, 'wx');
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      fs.closeSync(stdout);
      fs.closeSync(stderr);
      resolve(value);
    };
    const child = spawn(process.execPath, spec.args, {
      cwd: ROOT,
      env: {
        ...process.env,
        TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS: 'prospective_frame_resistance_semantic_v5',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
      stdio: ['ignore', stdout, stderr],
    });
    child.on('error', (error) => finish({ code: null, signal: null, spawn_error: error.message }));
    child.on('close', (code, signal) => finish({ code, signal }));
  });
}

function extractResult({ job, spec, exit }) {
  let trace = null;
  let events = [];
  try {
    ({ trace, events } = readTrace(spec.traceDir));
  } catch {
    // The sealed result retains the missing trace as an execution failure.
  }
  const reservations = events.filter((event) => event.type === 'model_call_budget_reserved').length;
  const fidelityEvent = events.find(
    (event) => event.type === 'resistance_action_register_manipulation_validation_fidelity',
  );
  return {
    case_id: job.id,
    block_id: job.block_id,
    assignment: job.realization,
    run_seed: job.run_seed,
    exit,
    reservations,
    trace: trace ? path.relative(ROOT, trace) : null,
    transcript: fs.existsSync(spec.transcript) ? path.relative(ROOT, spec.transcript) : null,
    fidelity: fidelityEvent?.fidelity || null,
    measurement_disposition: fidelityEvent?.measurement_disposition || 'execution_incomplete',
  };
}

export function assembleTutorStubResistanceManipulationValidationReport(rows, design) {
  const arms = Object.fromEntries(
    ['plain', 'warm'].map((arm) => {
      const armRows = rows.filter((row) => row.assignment === arm);
      const determinate = armRows.filter((row) => row.fidelity?.status === 'determinate').length;
      const registerMatch = armRows.filter(
        (row) =>
          row.fidelity?.register_measurement?.status === 'determinate' &&
          row.fidelity.register_measurement.value === arm,
      ).length;
      const actionVisible = armRows.filter(
        (row) =>
          row.fidelity?.action_measurement?.status === 'determinate' && row.fidelity.action_measurement.value === 'yes',
      ).length;
      return [
        arm,
        { total: armRows.length, determinate, register_match: registerMatch, action_visible: actionVisible },
      ];
    }),
  );
  const gates = {
    execution_complete: rows.length === 60 && rows.every((row) => row.exit.code === 0 && row.trace && row.transcript),
    measurement_coverage: Object.values(arms).every((arm) => arm.determinate >= 29),
    register_fidelity: Object.values(arms).every((arm) => arm.register_match >= 28),
    action_fidelity: Object.values(arms).every((arm) => arm.action_visible >= 28),
  };
  return {
    schema: 'machinespirits.tutor-stub.resistance-action-register-manipulation-validation-report.v1',
    status: Object.values(gates).every(Boolean) ? 'passed' : 'failed',
    sealed_only_analysis: true,
    design_sha256: loadedDesignSha256(design),
    rows,
    arms,
    gates,
    confirmation_launch_allowed: Object.values(gates).every(Boolean),
    learner_recovery_or_treatment_effect_analyzed: false,
    claim_boundary: design.claimBoundary,
  };
}

function loadedDesignSha256(design) {
  return design.__sha256;
}

async function main() {
  const { values } = parseArgs({
    options: {
      design: { type: 'string' },
      destination: { type: 'string' },
      'expected-source-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      parallelism: { type: 'string', default: '4' },
      'accept-charges': { type: 'boolean', default: false },
    },
  });
  if (values['accept-charges']) {
    refuseRetiredPaidLaunch('tutor-stub-resistance-action-register-manipulation-validation');
  }
  if (
    !values.design ||
    !values.destination ||
    !values['expected-source-commit'] ||
    !values['go-note-commit'] ||
    !values['go-note-path'] ||
    !values['accept-charges']
  ) {
    throw new Error(
      'paid manipulation validation requires design, destination, source commit, committed GO note, and --accept-charges',
    );
  }
  const designRelative = path.relative(ROOT, repoPath(values.design, 'design'));
  const launchCommit = assertSource(values['expected-source-commit'], designRelative);
  const loaded = loadTutorStubResistanceManipulationValidation({ designPath: values.design, root: ROOT });
  Object.defineProperty(loaded.design, '__sha256', { value: loaded.sha256, enumerable: false });
  const goNote = assertGoNote({
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
    launchCommit,
    designPath: designRelative,
    spendCap: loaded.design.execution.studyModelAttemptCeiling,
  });
  const destination = repoPath(values.destination, 'destination');
  if (fs.existsSync(destination)) throw new Error('manipulation-validation destination is create-once');
  const parallelism = Number(values.parallelism);
  if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 4) {
    throw new Error('manipulation-validation parallelism must be 1..4');
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.mkdirSync(destination, { recursive: false });
  fs.mkdirSync(path.join(destination, 'jobs'));
  writeOnce(path.join(destination, 'plan.json'), {
    ...loaded.plan,
    source_commit: launchCommit,
    design_path: designRelative,
    design_sha256: loaded.sha256,
    go_note: goNote,
    model_attempt_ceiling: loaded.design.execution.studyModelAttemptCeiling,
  });

  const rows = [];
  let cursor = 0;
  let reservations = 0;
  async function worker() {
    while (cursor < loaded.plan.jobs.length) {
      const index = cursor;
      cursor += 1;
      const job = loaded.plan.jobs[index];
      const spec = childSpec({ loaded, job, destination });
      const exit = await runChild(spec);
      const row = extractResult({ job, spec, exit });
      reservations += row.reservations;
      if (reservations > loaded.design.execution.studyModelAttemptCeiling) {
        throw new Error('manipulation-validation study attempt ceiling exceeded');
      }
      if (
        loaded.design.execution.programmeLedgerBefore + reservations >
        loaded.design.execution.programmeModelAttemptCeiling
      ) {
        throw new Error('resistance-action-register programme attempt ceiling exceeded');
      }
      rows.push(row);
      process.stdout.write(
        `completed ${rows.length}/60; attempts ${reservations}/${loaded.design.execution.studyModelAttemptCeiling}\n`,
      );
    }
  }
  await Promise.all(Array.from({ length: parallelism }, () => worker()));
  rows.sort((left, right) => left.case_id.localeCompare(right.case_id));
  const report = assembleTutorStubResistanceManipulationValidationReport(rows, loaded.design);
  report.execution = {
    source_commit: launchCommit,
    completed_dialogues: rows.length,
    successful_processes: rows.filter((row) => row.exit.code === 0).length,
    failed_processes: rows.filter((row) => row.exit.code !== 0).length,
    model_attempt_reservations: reservations,
    model_attempt_ceiling: loaded.design.execution.studyModelAttemptCeiling,
  };
  writeOnce(path.join(destination, 'report.json'), report);
  process.stdout.write(
    `${report.status}: sealed report written to ${path.relative(ROOT, path.join(destination, 'report.json'))}\n`,
  );
  if (report.status !== 'passed') process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
