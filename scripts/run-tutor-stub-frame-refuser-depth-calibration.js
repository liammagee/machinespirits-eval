#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  loadTutorStubResistantLearnerDesign,
  summarizeTutorStubResistantLearnerCalibration,
  TUTOR_STUB_FRAME_REFUSER_DEPTH_DESIGN_SCHEMA_V1,
  tutorStubFrameRefuserDepthArmDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  buildTutorStubFrameRefuserDepthApproval,
  runTutorStubFrameRefuserDepthPreflight,
} from '../services/tutorStubFrameRefuserDepthLaunch.js';
import { TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS } from '../services/tutorStubRegisteredStudyOutcome.js';
import {
  extractTutorStubResistantLearnerCalibrationRow,
  runTutorStubResistantLearnerCalibrationChild,
  tutorStubResistantLearnerCalibrationChildSpec,
  tutorStubResistantLearnerCalibrationHaltReason,
} from './run-tutor-stub-resistant-learner-calibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TUTOR_STUB_FRAME_REFUSER_DEPTH_USAGE = `Usage:
  node scripts/run-tutor-stub-frame-refuser-depth-calibration.js \
    --design config/tutor-stub-frame-refuser-depth-design.v4.json \
    --destination /absolute/create-once/run-root \
    --dry-run

  node scripts/run-tutor-stub-frame-refuser-depth-calibration.js \
    --design config/tutor-stub-frame-refuser-depth-design.v4.json \
    --destination /absolute/create-once/run-root \
    --launch [--parallelism 4]

  node scripts/run-tutor-stub-frame-refuser-depth-calibration.js \
    --design config/tutor-stub-frame-refuser-depth-design.v4.json \
    --destination /absolute/existing/run-root \
    --resume [--parallelism 4]

--dry-run executes the complete zero-call preflight and writes nothing.
--launch requires an attended TTY and records typed operator approval in approval.json.
--resume continues a halted run root after a code-defect fix: every recorded dialogue
keeps its paid outcome (a typed failure mislabeled as technical is re-typed from its
recorded trace, never re-run); only never-started dialogues run, under the same ceilings.
This launcher runs Gate 1 calibration only (revision 4: 48 dialogues, 24 per arm). The powered
run is a separate later gate with its own attended approval; calibration rows are
never pooled into it.
No GO note, commit binding, source-file byte pin, approval schema version, or re-signature cycle is used.`;

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });
}

function appendLedger(filePath, event) {
  fs.appendFileSync(filePath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

function gitOrNull(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function tutorStubFrameRefuserDepthSourceProvenance() {
  return {
    commit: gitOrNull('rev-parse', 'HEAD'),
    tree: gitOrNull('rev-parse', 'HEAD^{tree}'),
    dirty: Boolean(gitOrNull('status', '--porcelain=v1', '--untracked-files=all')),
    enforcement: 'recorded_not_pinned',
  };
}

function repositoryRelative(value) {
  const absolute = path.resolve(ROOT, value || '');
  const relative = path.relative(ROOT, absolute);
  if (!value || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('design path must be repository-relative');
  }
  return relative;
}

async function attendedApproval({ preflight, input = process.stdin, output = process.stdout }) {
  const phrase = `APPROVE CALIBRATION ${preflight.hard_attempt_ceiling}`;
  const terminal = createInterface({ input, output });
  try {
    const signedBy = (await terminal.question('Operator name: ')).trim();
    const approvalPhrase = await terminal.question(`Type exactly "${phrase}": `);
    return { signedBy, approvalPhrase, method: 'attended_interactive_phrase' };
  } finally {
    terminal.close();
  }
}

// Paths of an already-recorded job, with no side effects: the real childSpec
// mints the rival DAG create-once, so it must never run twice for one job.
function resumeJobSpec({ destination, job }) {
  const jobRoot = path.join(destination, 'jobs', job.id);
  return {
    jobRoot,
    traceDir: path.join(jobRoot, 'traces'),
    transcript: path.join(jobRoot, 'transcript.json'),
    registeredStudyOutcome: path.join(jobRoot, 'registered-study-outcome.json'),
    stdout: path.join(jobRoot, 'stdout.log'),
    stderr: path.join(jobRoot, 'stderr.log'),
  };
}

// The delivery gate appends its enforcement event only after the final
// verdict, and a delivered=false final verdict always raises the typed
// non-delivery error on the next line. So a recorded row whose last
// enforcement event says delivered=false is the registered typed failure,
// whatever the child exit looked like. Until 2026-08-27 the treatment arm's
// exhaustion code was missing from the shared retained-codes list, so the
// child crossed the boundary unrecognized and the row was mislabeled as a
// technical failure. Re-typing reads the recorded trace; it never re-runs
// the dialogue.
function retypeResumedDepthRow(row) {
  if (row.status !== 'failed' || row.registered_failure) return row;
  const last = row.delivery[row.delivery.length - 1];
  if (!last || last.delivered !== false) return row;
  const code =
    row.job.arm_id === 'treatment'
      ? 'tutor_stub_tutor_condition_discharge_non_delivery'
      : 'tutor_stub_tutor_bounded_test_non_delivery';
  return {
    ...row,
    status: TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS,
    registered_failure: {
      code,
      disposition: 'substantive_registered_failure_stop_no_replacement',
      substantive_study_failure: true,
      recoverable: false,
      replacement_allowed: false,
      retyped_on_resume: true,
      retype_evidence: 'recorded trace tutor_delivery_enforcement event: delivered=false after the allowed repair',
    },
  };
}

function readDepthLedgerUnits(ledgerPath) {
  const units = new Map();
  const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    const entry = JSON.parse(line);
    if (entry.type === 'unit_complete') units.set(entry.job_id, entry);
  }
  return units;
}

export async function executeTutorStubFrameRefuserDepthCalibration({
  loaded,
  destination,
  parallelism,
  preflight,
  approval,
  provenance,
  childSpec = tutorStubResistantLearnerCalibrationChildSpec,
  runChild = runTutorStubResistantLearnerCalibrationChild,
  extractRow = extractTutorStubResistantLearnerCalibrationRow,
  resume = false,
} = {}) {
  const plan = preflight.plan;
  const ledgerPath = path.join(destination, 'run-ledger.jsonl');
  // The depth design carries only the calibration totals; the per-dialogue
  // ceiling lives in the parent design and reaches the runtime through the
  // arm projection. Both arms share it.
  const perDialogueCeiling = tutorStubFrameRefuserDepthArmDesign(loaded.design, 'treatment', { root: ROOT })
    .attemptCeilings.maximumReservationsPerDialogue;
  const rows = [];
  let attempts = 0;
  let recordedUnits = new Map();
  if (resume) {
    for (const name of ['approval.json', 'plan.json', 'run-ledger.jsonl', 'jobs']) {
      if (!fs.existsSync(path.join(destination, name))) {
        throw new Error(`resume needs an existing run root with ${name}`);
      }
    }
    recordedUnits = readDepthLedgerUnits(ledgerPath);
    const retypedJobs = [];
    for (const job of plan.jobs) {
      const entry = recordedUnits.get(job.id);
      if (!entry) continue;
      const spec = resumeJobSpec({ destination, job });
      if (!fs.existsSync(spec.jobRoot)) {
        throw new Error(`recorded job ${job.id} has no job directory; refusing to resume`);
      }
      const exitCode = entry.status === 'complete' ? 0 : 1;
      const extracted = extractRow({ job, spec, exit: { code: exitCode, signal: null, spawn_error: null } });
      const row = retypeResumedDepthRow(extracted);
      if (row !== extracted) retypedJobs.push(job.id);
      if (row.status === 'failed') {
        throw new Error(`recorded job ${job.id} is a technical failure the trace cannot re-type; refusing to resume`);
      }
      rows.push(row);
      attempts += row.attempts;
    }
    if (attempts > preflight.hard_attempt_ceiling) {
      throw new Error('recorded attempts already exceed the hard ceiling; refusing to resume');
    }
    const reportPath = path.join(destination, 'report.json');
    if (fs.existsSync(reportPath)) {
      let n = 1;
      while (fs.existsSync(path.join(destination, `report.halted-${n}.json`))) n += 1;
      fs.renameSync(reportPath, path.join(destination, `report.halted-${n}.json`));
    }
    appendLedger(ledgerPath, {
      type: 'resume',
      approved_by: approval.approved_by,
      typed_phrase: approval.typed_phrase,
      method: approval.method,
      source_commit: provenance.commit,
      source_tree: provenance.tree,
      dirty: provenance.dirty,
      recorded_units: rows.length,
      recorded_attempts: attempts,
      retyped_units: retypedJobs,
      pending_units: plan.jobs.length - rows.length,
      hard_attempt_ceiling: preflight.hard_attempt_ceiling,
      note: 'create-once destination check waived for resume; recorded dialogues keep their outcomes and are never re-run',
    });
  } else {
    if (fs.existsSync(destination)) throw new Error('frame-refuser depth destination is create-once');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.mkdirSync(destination, { recursive: false });
    fs.mkdirSync(path.join(destination, 'jobs'));
    writeOnce(path.join(destination, 'approval.json'), approval);
    writeOnce(path.join(destination, 'plan.json'), {
      schema: 'machinespirits.tutor-stub.frame-refuser-depth-attended-plan.v1',
      status: 'typed_approval_recorded_attended_launch',
      approval_path: 'approval.json',
      source: provenance,
      design: {
        path: loaded.relativePath,
        sha256: loaded.sha256,
        enforcement: 'recorded_not_pinned',
      },
      model_attempt_ceiling: preflight.hard_attempt_ceiling,
      preflight,
      plan,
    });
    writeOnce(ledgerPath, '');
    appendLedger(ledgerPath, {
      type: 'launch',
      approval_path: 'approval.json',
      source_commit: provenance.commit,
      source_tree: provenance.tree,
      dirty: provenance.dirty,
      planned_units: plan.jobs.length,
      hard_attempt_ceiling: preflight.hard_attempt_ceiling,
    });
  }

  const queue = plan.jobs.filter((job) => !recordedUnits.has(job.id)).map((job) => ({ loaded, job }));
  let cursor = 0;
  let haltReason = null;
  async function worker() {
    while (cursor < queue.length && !haltReason) {
      const index = cursor;
      cursor += 1;
      const { job } = queue[index];
      const spec = childSpec({ loaded, job, destination });
      const exit = await runChild(spec);
      const row = extractRow({ job, spec, exit });
      attempts += row.attempts;
      // A ceiling breach halts the run but must never lose the paid outcome:
      // the row is recorded and the report is still written.
      const ceilingBreach =
        row.attempts > perDialogueCeiling
          ? `attempt ceiling breach: job ${job.id} used ${row.attempts} reservations (limit ${perDialogueCeiling})`
          : attempts > preflight.hard_attempt_ceiling
            ? `attempt ceiling breach: cumulative ${attempts} exceeds ${preflight.hard_attempt_ceiling}`
            : null;
      rows.push(row);
      haltReason ||= ceilingBreach || tutorStubResistantLearnerCalibrationHaltReason(row);
      appendLedger(ledgerPath, {
        type: 'unit_complete',
        job_id: job.id,
        arm_id: job.arm_id,
        status: row.status,
        ...(row.registered_failure?.code ? { registered_failure_code: row.registered_failure.code } : {}),
        attempts: row.attempts,
        cumulative_attempts: attempts,
        ...(haltReason ? { halt_reason: haltReason } : {}),
      });
      process.stdout.write(
        `completed ${rows.length}/${plan.jobs.length}; attempts ${attempts}/${preflight.hard_attempt_ceiling}${haltReason ? `; halted: ${haltReason}` : ''}\n`,
      );
    }
  }
  await Promise.all(Array.from({ length: parallelism }, () => worker()));
  rows.sort((left, right) => left.job.id.localeCompare(right.job.id));
  const summary = summarizeTutorStubResistantLearnerCalibration({ rows, design: loaded.design, root: ROOT });
  const report = {
    ...summary,
    status: haltReason ? 'failed' : summary.status,
    halt_reason: haltReason,
    execution: {
      source_commit: provenance.commit,
      source_tree: provenance.tree,
      dirty: provenance.dirty,
      complete_units: rows.filter((row) => row.status === 'complete').length,
      retained_substantive_units: rows.filter((row) => row.status === TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS)
        .length,
      failed_units: rows.filter((row) => row.status === 'failed').length,
      missing_units: plan.jobs.length - rows.length,
      model_attempts: attempts,
      model_attempt_ceiling: preflight.hard_attempt_ceiling,
    },
  };
  writeOnce(path.join(destination, 'report.json'), report);
  appendLedger(ledgerPath, {
    type: 'seal',
    status: report.status,
    complete_units: report.execution.complete_units,
    retained_substantive_units: report.execution.retained_substantive_units,
    failed_units: report.execution.failed_units,
    attempts,
  });
  process.stdout.write(`${report.status}: ${path.join(destination, 'report.json')}\n`);
  return report;
}

export async function main(argv = process.argv.slice(2), overrides = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      design: { type: 'string' },
      destination: { type: 'string' },
      parallelism: { type: 'string', default: '1' },
      'dry-run': { type: 'boolean', default: false },
      launch: { type: 'boolean', default: false },
      resume: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(`${TUTOR_STUB_FRAME_REFUSER_DEPTH_USAGE}\n`);
    return null;
  }
  const modes = ['dry-run', 'launch', 'resume'].filter((mode) => values[mode]);
  if (modes.length !== 1) {
    throw new Error('select exactly one of --dry-run, --launch, or --resume');
  }
  if (!values.design || !values.destination) {
    throw new Error(`--design and --destination are required\n\n${TUTOR_STUB_FRAME_REFUSER_DEPTH_USAGE}`);
  }
  if (!path.isAbsolute(values.destination)) throw new Error('destination must be absolute');
  const designPath = repositoryRelative(values.design);
  const loaded = loadTutorStubResistantLearnerDesign({ designPath, root: ROOT });
  loaded.relativePath = designPath;
  if (loaded.design.schema !== TUTOR_STUB_FRAME_REFUSER_DEPTH_DESIGN_SCHEMA_V1) {
    throw new Error('the depth launcher accepts only the frame-refuser depth v1 design');
  }
  const destination = path.resolve(values.destination);
  const preflight = await (overrides.runPreflight || runTutorStubFrameRefuserDepthPreflight)({
    loaded,
    root: ROOT,
    destination,
    // Resume continues an existing run root, so the create-once check is
    // waived here and the waiver is recorded in the resume ledger entry.
    destinationExists: values.resume ? () => false : overrides.destinationExists || fs.existsSync,
    ...(overrides.probeRoute ? { probeRoute: overrides.probeRoute } : {}),
    ...(overrides.smokeRole ? { smokeRole: overrides.smokeRole } : {}),
  });
  process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
  process.stdout.write(`${TUTOR_STUB_FRAME_REFUSER_DEPTH_USAGE}\n`);
  if (preflight.status !== 'passed_zero_call') throw new Error('depth zero-call preflight failed');
  if (values['dry-run']) return preflight;
  const tty = overrides.isTTY ?? (process.stdin.isTTY === true && process.stdout.isTTY === true);
  if (!tty) throw new Error('depth paid calibration requires one attended TTY invocation');
  const parallelism = Number(values.parallelism);
  if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 4) {
    throw new Error('parallelism must be an integer from 1 to 4');
  }
  const authorization = await (overrides.operatorApproval || attendedApproval)({ preflight });
  const approval = buildTutorStubFrameRefuserDepthApproval({
    signedBy: authorization.signedBy,
    approvalPhrase: authorization.approvalPhrase,
    preflight,
  });
  approval.method = authorization.method;
  const provenance = (overrides.sourceProvenance || tutorStubFrameRefuserDepthSourceProvenance)();
  return (overrides.execute || executeTutorStubFrameRefuserDepthCalibration)({
    loaded,
    destination,
    parallelism,
    preflight,
    approval,
    provenance,
    resume: values.resume,
  });
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
