#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import {
  loadTutorStubResistantLearnerDesign,
  summarizeTutorStubResistantLearnerCalibration,
  TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1,
  tutorStubFrameRefuserSatisfiableArmDesign,
} from '../services/tutorStubResistantLearnerCalibration.js';
import { runTutorStubFrameRefuserSatisfiablePreflight } from '../services/tutorStubFrameRefuserSatisfiableLaunch.js';
import { TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS } from '../services/tutorStubRegisteredStudyOutcome.js';
import {
  extractTutorStubResistantLearnerCalibrationRow,
  runTutorStubResistantLearnerCalibrationChild,
  tutorStubResistantLearnerCalibrationChildSpec,
  tutorStubResistantLearnerCalibrationHaltReason,
} from './run-tutor-stub-resistant-learner-calibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_USAGE = `Usage:
  node scripts/run-tutor-stub-frame-refuser-satisfiable-calibration.js \
    --design config/tutor-stub-frame-refuser-satisfiable-design.v1.json \
    --destination /absolute/create-once/run-root \
    --dry-run

  node scripts/run-tutor-stub-frame-refuser-satisfiable-calibration.js \
    --design config/tutor-stub-frame-refuser-satisfiable-design.v1.json \
    --destination /absolute/create-once/run-root \
    --launch-commit <merged-detached-commit> \
    --go-note-commit <commit-containing-signed-note> \
    --go-note-path notes/<signed-go-note>.md \
    --accept-charges

--dry-run executes the complete zero-call preflight and writes nothing.
The paid path uses the shared standing launch contract: merged design, clean detached
launch commit, signed GO note, create-once destination, append-only ledger, and a
9,504-attempt hard ceiling. It has no study-specific approval phrase or resume mode.
The run is calibration only; it cannot authorize or pool into a powered run.`;

function repositoryRelative(root, value) {
  if (!value || path.isAbsolute(value)) throw new Error('design path must be repository-relative');
  const absolute = path.resolve(root, value);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('design path must stay inside the repository');
  }
  return relative.split(path.sep).join('/');
}

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function admitWithStandingContract(input) {
  return admitPaidStudyLaunch(input);
}

export async function executeTutorStubFrameRefuserSatisfiableCalibration({
  loaded,
  destination,
  preflight,
  admission,
  childSpec = tutorStubResistantLearnerCalibrationChildSpec,
  runChild = runTutorStubResistantLearnerCalibrationChild,
  extractRow = extractTutorStubResistantLearnerCalibrationRow,
  summarize = summarizeTutorStubResistantLearnerCalibration,
  progress = (line) => process.stdout.write(`${line}\n`),
} = {}) {
  const plan = preflight.plan;
  const perDialogueCeiling = tutorStubFrameRefuserSatisfiableArmDesign(loaded.design, 'treatment', { root: ROOT })
    .attemptCeilings.maximumReservationsPerDialogue;
  if (perDialogueCeiling * plan.jobs.length !== preflight.hard_attempt_ceiling) {
    throw new Error('satisfiable per-dialogue reservations do not close to the registered calibration ceiling');
  }
  fs.mkdirSync(path.join(destination, 'jobs'), { recursive: false });
  writeOnce(path.join(destination, 'plan.json'), {
    schema: 'machinespirits.tutor-stub.frame-refuser-satisfiable-calibration-plan.v1',
    status: 'admitted_under_shared_paid_study_launch_contract',
    source: admission.source,
    design: { path: loaded.relativePath, sha256: loaded.sha256 },
    authorization: admission.authorization,
    model_attempt_ceiling: preflight.hard_attempt_ceiling,
    preflight,
    plan,
  });

  const rows = [];
  let observedAttempts = 0;
  let haltReason = null;
  try {
    for (const job of plan.jobs) {
      if (haltReason) break;
      admission.reserveModelAttempts(perDialogueCeiling, {
        unit: job.id,
        arm_id: job.arm_id,
        reservation_scope: 'per_dialogue_fail_before_call_ceiling',
      });
      const spec = childSpec({ loaded, job, destination });
      const exit = await runChild(spec);
      const row = extractRow({ job, spec, exit });
      observedAttempts += row.attempts;
      const ceilingBreach =
        row.attempts > perDialogueCeiling
          ? `attempt ceiling breach: job ${job.id} used ${row.attempts} reservations (limit ${perDialogueCeiling})`
          : observedAttempts > admission.reserved
            ? `attempt accounting breach: observed ${observedAttempts} exceeds reserved ${admission.reserved}`
            : null;
      rows.push(row);
      haltReason ||= ceilingBreach || tutorStubResistantLearnerCalibrationHaltReason(row);
      admission.record({
        type: 'unit_complete',
        job_id: job.id,
        arm_id: job.arm_id,
        status: row.status,
        ...(row.registered_failure?.code ? { registered_failure_code: row.registered_failure.code } : {}),
        observed_attempts: row.attempts,
        cumulative_observed_attempts: observedAttempts,
        reserved_attempts: admission.reserved,
        ...(haltReason ? { halt_reason: haltReason } : {}),
      });
      progress(
        `completed ${rows.length}/${plan.jobs.length}; observed attempts ${observedAttempts}; reserved ${admission.reserved}/${preflight.hard_attempt_ceiling}${haltReason ? `; halted: ${haltReason}` : ''}`,
      );
    }
    rows.sort((left, right) => left.job.id.localeCompare(right.job.id));
    const summary = summarize({ rows, design: loaded.design, root: ROOT });
    const report = {
      ...summary,
      status: haltReason ? 'failed' : summary.status,
      halt_reason: haltReason,
      execution: {
        source_commit: admission.source.commit,
        source_tree: admission.source.tree,
        complete_units: rows.filter((row) => row.status === 'complete').length,
        retained_substantive_units: rows.filter((row) => row.status === TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS)
          .length,
        failed_units: rows.filter((row) => row.status === 'failed').length,
        missing_units: plan.jobs.length - rows.length,
        observed_model_attempts: observedAttempts,
        reserved_model_attempts: admission.reserved,
        model_attempt_ceiling: preflight.hard_attempt_ceiling,
      },
    };
    writeOnce(path.join(destination, 'report.json'), report);
    admission.close({
      type: 'run_sealed',
      status: report.status,
      complete_units: report.execution.complete_units,
      retained_substantive_units: report.execution.retained_substantive_units,
      failed_units: report.execution.failed_units,
      observed_attempts: observedAttempts,
      reserved_attempts: admission.reserved,
    });
    progress(`${report.status}: ${path.join(destination, 'report.json')}`);
    return report;
  } catch (error) {
    admission.record({ type: 'launcher_failed', error: error.message, observed_attempts: observedAttempts });
    admission.close({ type: 'run_sealed', status: 'failed', error: error.message });
    throw error;
  }
}

export async function main(argv = process.argv.slice(2), overrides = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      design: { type: 'string' },
      destination: { type: 'string' },
      'launch-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(`${TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_USAGE}\n`);
    return null;
  }
  if (!values.design || !values.destination) {
    throw new Error(`--design and --destination are required\n\n${TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_USAGE}`);
  }
  if (!path.isAbsolute(values.destination)) throw new Error('destination must be absolute');
  const designPath = repositoryRelative(ROOT, values.design);
  const loaded = loadTutorStubResistantLearnerDesign({ designPath, root: ROOT });
  loaded.relativePath = designPath;
  if (loaded.design.schema !== TUTOR_STUB_FRAME_REFUSER_SATISFIABLE_DESIGN_SCHEMA_V1) {
    throw new Error('the satisfiable launcher accepts only the frame-refuser satisfiable v1 design');
  }
  const destination = path.resolve(values.destination);
  const preflight = await (overrides.runPreflight || runTutorStubFrameRefuserSatisfiablePreflight)({
    loaded,
    root: ROOT,
    destination,
    destinationExists: overrides.destinationExists || fs.existsSync,
    ...(overrides.probeRoute ? { probeRoute: overrides.probeRoute } : {}),
    ...(overrides.smokeRole ? { smokeRole: overrides.smokeRole } : {}),
  });
  process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
  if (preflight.status !== 'passed_zero_call') throw new Error('satisfiable zero-call preflight failed');
  if (values['dry-run']) return preflight;
  if (!values['accept-charges'] || !values['launch-commit'] || !values['go-note-commit'] || !values['go-note-path']) {
    throw new Error('paid launch requires --accept-charges, --launch-commit, --go-note-commit, and --go-note-path');
  }
  const admission = (overrides.admit || admitWithStandingContract)({
    root: ROOT,
    designPath,
    launchCommit: values['launch-commit'],
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
    spendCap: loaded.design.attemptCeilings.calibrationMaximumReservations,
    destination,
    studyId: loaded.design.studyId,
    studyStateRoot: path.join(path.dirname(destination), '.paid-study-state'),
  });
  return (overrides.execute || executeTutorStubFrameRefuserSatisfiableCalibration)({
    loaded,
    destination,
    preflight,
    admission,
  });
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
