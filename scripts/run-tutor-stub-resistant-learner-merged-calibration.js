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
  summarizeTutorStubResistantLearnerMergedPoweredRun,
  TUTOR_STUB_RESISTANT_LEARNER_MERGED_DESIGN_SCHEMA_V1,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  buildTutorStubResistantLearnerMergedApproval,
  runTutorStubResistantLearnerMergedPreflight,
} from '../services/tutorStubResistantLearnerMergedLaunch.js';
import { TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS } from '../services/tutorStubRegisteredStudyOutcome.js';
import {
  extractTutorStubResistantLearnerCalibrationRow,
  runTutorStubResistantLearnerCalibrationChild,
  tutorStubResistantLearnerCalibrationChildSpec,
  tutorStubResistantLearnerCalibrationHaltReason,
} from './run-tutor-stub-resistant-learner-calibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TUTOR_STUB_RESISTANT_LEARNER_MERGED_USAGE = `Usage:
  node scripts/run-tutor-stub-resistant-learner-merged-calibration.js \
    --design config/tutor-stub-resistant-learner-merged-design.v4.json \
    --destination /absolute/create-once/run-root \
    --dry-run

  node scripts/run-tutor-stub-resistant-learner-merged-calibration.js \
    --design config/tutor-stub-resistant-learner-merged-design.v4.json \
    --destination /absolute/create-once/run-root \
    --launch [--parallelism 4]

  node scripts/run-tutor-stub-resistant-learner-merged-calibration.js \
    --design config/tutor-stub-resistant-learner-merged-design.v5.json \
    --destination /absolute/create-once/run-root \
    --powered --dialogues-per-face 108 \
    --dry-run | --launch [--parallelism 4]

  node scripts/run-tutor-stub-resistant-learner-merged-calibration.js \
    --design config/tutor-stub-resistant-learner-merged-design.v5.json \
    --destination /absolute/existing/halted/run-root \
    --powered --dialogues-per-face 108 \
    --resume --launch [--parallelism 4]

--dry-run executes the complete zero-call preflight and writes nothing.
--launch requires an attended TTY and records typed operator approval in approval.json.
--powered runs the powered study on fresh blocks (a multiple of 18 dialogues per face,
inside the design's registered 36-180 bounds); calibration rows are never reused.
--resume continues a halted powered run in place: completed and retained units are
banked as recorded, units that died without a typed outcome become disclosed
technical losses (never rerun), and only never-started units execute. The recorded
approval.json covers the resume; no re-approval ceremony.
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

export function tutorStubResistantLearnerMergedSourceProvenance() {
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

export function readTutorStubResistantLearnerMergedResumeState({ destination, loaded, plan }) {
  const reportPath = path.join(destination, 'report.json');
  for (const required of ['approval.json', 'plan.json', 'report.json', 'run-ledger.jsonl']) {
    if (!fs.existsSync(path.join(destination, required))) {
      throw new Error(`resume requires ${required} in the run root`);
    }
  }
  const priorPlan = JSON.parse(fs.readFileSync(path.join(destination, 'plan.json'), 'utf8'));
  if (priorPlan?.design?.sha256 !== loaded.sha256) {
    throw new Error('resume requires the same sealed design as the recorded plan');
  }
  const priorReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const priorRows = Array.isArray(priorReport.rows) ? priorReport.rows : [];
  const planJobById = new Map(plan.jobs.map((job) => [job.id, job]));
  for (const row of priorRows) {
    if (!planJobById.has(row.job.id)) {
      throw new Error(`recorded row ${row.job.id} is not in the rebuilt plan; refusing to resume`);
    }
  }
  const rowIds = new Set(priorRows.map((row) => row.job.id));
  // A job directory with no recorded row means the launcher itself was
  // interrupted mid-unit. The unit is partially observed, so it becomes a
  // disclosed technical loss; the sealed dispositions forbid any rerun.
  const jobsDir = path.join(destination, 'jobs');
  const orphanRows = (fs.existsSync(jobsDir) ? fs.readdirSync(jobsDir) : [])
    .filter((name) => planJobById.has(name) && !rowIds.has(name))
    .map((name) => ({
      job: planJobById.get(name),
      status: 'failed',
      exit: { code: null, signal: null, spawn_error: 'no recorded row (launcher interrupted mid-unit)' },
      attempts: 0,
      trace: null,
      transcript: null,
      outcome: null,
      registered_failure: null,
      registered_failure_artifact: null,
      registered_failure_artifact_issues: [],
    }));
  const rows = [...priorRows, ...orphanRows];
  return {
    rows,
    attempts: Number(priorReport.execution?.model_attempts) || 0,
    prior_complete: rows.filter((row) => row.status === 'complete').length,
    prior_retained: rows.filter((row) => row.status === TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS).length,
    prior_technical_losses: rows.filter((row) => row.status === 'failed').length,
  };
}

async function attendedApproval({ preflight, input = process.stdin, output = process.stdout }) {
  const phrase =
    preflight.phase === 'powered'
      ? `APPROVE POWERED RUN ${preflight.hard_attempt_ceiling}`
      : `APPROVE CALIBRATION ${preflight.hard_attempt_ceiling}`;
  const terminal = createInterface({ input, output });
  try {
    const signedBy = (await terminal.question('Operator name: ')).trim();
    const approvalPhrase = await terminal.question(`Type exactly "${phrase}": `);
    return { signedBy, approvalPhrase, method: 'attended_interactive_phrase' };
  } finally {
    terminal.close();
  }
}

export async function executeTutorStubResistantLearnerMergedCalibration({
  loaded,
  destination,
  parallelism,
  preflight,
  approval,
  provenance,
  resume = false,
  childSpec = tutorStubResistantLearnerCalibrationChildSpec,
  runChild = runTutorStubResistantLearnerCalibrationChild,
  extractRow = extractTutorStubResistantLearnerCalibrationRow,
} = {}) {
  const plan = preflight.plan;
  const ledgerPath = path.join(destination, 'run-ledger.jsonl');
  let rows = [];
  let attempts = 0;
  if (resume) {
    if (!fs.existsSync(destination)) throw new Error('resume requires an existing run root');
    const state = readTutorStubResistantLearnerMergedResumeState({ destination, loaded, plan });
    rows = state.rows;
    attempts = state.attempts;
    if (attempts >= preflight.hard_attempt_ceiling) {
      throw new Error('recorded attempts already reach the ceiling; nothing may resume');
    }
    appendLedger(ledgerPath, {
      type: 'resume',
      source_commit: provenance.commit,
      source_tree: provenance.tree,
      dirty: provenance.dirty,
      prior_complete: state.prior_complete,
      prior_retained: state.prior_retained,
      prior_technical_losses: state.prior_technical_losses,
      prior_attempts: attempts,
      remaining_units: plan.jobs.length - rows.length,
    });
  } else {
    if (fs.existsSync(destination)) throw new Error('merged resistant-learner destination is create-once');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.mkdirSync(destination, { recursive: false });
    fs.mkdirSync(path.join(destination, 'jobs'));
    writeOnce(path.join(destination, 'approval.json'), approval);
    writeOnce(path.join(destination, 'plan.json'), {
      schema: 'machinespirits.tutor-stub.resistant-learner-merged-attended-plan.v1',
      status: 'typed_approval_recorded_attended_launch',
      ...(preflight.phase === 'powered' ? { phase: 'powered', dialogues_per_face: preflight.dialogues_per_face } : {}),
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

  const bankedIds = new Set(rows.map((row) => row.job.id));
  const queue = plan.jobs.filter((job) => !bankedIds.has(job.id)).map((job) => ({ loaded, job }));
  let cursor = 0;
  let haltReason = null;
  async function worker() {
    while (cursor < queue.length && !haltReason) {
      const index = cursor;
      cursor += 1;
      const { job } = queue[index];
      const spec = childSpec({
        loaded,
        job,
        destination,
        ...(preflight.phase === 'powered' ? { poweredDialoguesPerFace: preflight.dialogues_per_face } : {}),
      });
      const exit = await runChild(spec);
      const row = extractRow({ job, spec, exit });
      attempts += row.attempts;
      // A ceiling breach halts the run but must never lose the paid outcome:
      // the row is recorded and the report is still written.
      const ceilingBreach =
        row.attempts > loaded.design.attemptCeilings.maximumReservationsPerDialogue
          ? `attempt ceiling breach: job ${job.id} used ${row.attempts} reservations (limit ${loaded.design.attemptCeilings.maximumReservationsPerDialogue})`
          : attempts > preflight.hard_attempt_ceiling
            ? `attempt ceiling breach: cumulative ${attempts} exceeds ${preflight.hard_attempt_ceiling}`
            : null;
      rows.push(row);
      haltReason ||= ceilingBreach || tutorStubResistantLearnerCalibrationHaltReason(row);
      appendLedger(ledgerPath, {
        type: 'unit_complete',
        job_id: job.id,
        face_id: job.face_id,
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
  const summary =
    preflight.phase === 'powered'
      ? summarizeTutorStubResistantLearnerMergedPoweredRun({
          rows,
          design: loaded.design,
          dialoguesPerFace: preflight.dialogues_per_face,
        })
      : summarizeTutorStubResistantLearnerCalibration({ rows, design: loaded.design });
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
  const reportPath = path.join(destination, 'report.json');
  if (resume) {
    let haltedIndex = 1;
    while (fs.existsSync(path.join(destination, `report.halted.${haltedIndex}.json`))) haltedIndex += 1;
    fs.renameSync(reportPath, path.join(destination, `report.halted.${haltedIndex}.json`));
  }
  writeOnce(reportPath, report);
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
      powered: { type: 'boolean', default: false },
      'dialogues-per-face': { type: 'string' },
      resume: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      launch: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(`${TUTOR_STUB_RESISTANT_LEARNER_MERGED_USAGE}\n`);
    return null;
  }
  if (values['dry-run'] === values.launch) {
    throw new Error('select exactly one of --dry-run or --launch');
  }
  if (!values.design || !values.destination) {
    throw new Error(`--design and --destination are required\n\n${TUTOR_STUB_RESISTANT_LEARNER_MERGED_USAGE}`);
  }
  if (!path.isAbsolute(values.destination)) throw new Error('destination must be absolute');
  const designPath = repositoryRelative(values.design);
  const loaded = loadTutorStubResistantLearnerDesign({ designPath, root: ROOT });
  loaded.relativePath = designPath;
  if (loaded.design.schema !== TUTOR_STUB_RESISTANT_LEARNER_MERGED_DESIGN_SCHEMA_V1) {
    throw new Error('the merged launcher accepts only the merged v1 design');
  }
  const destination = path.resolve(values.destination);
  let dialoguesPerFace = null;
  if (values.powered) {
    dialoguesPerFace = Number(values['dialogues-per-face']);
    if (!Number.isInteger(dialoguesPerFace) || dialoguesPerFace < 1) {
      throw new Error('--powered requires --dialogues-per-face as a positive integer');
    }
  } else if (values['dialogues-per-face'] !== undefined) {
    throw new Error('--dialogues-per-face is only valid with --powered');
  }
  if (values.resume && !values.powered) throw new Error('--resume is only valid with --powered');
  const preflight = await (overrides.runPreflight || runTutorStubResistantLearnerMergedPreflight)({
    loaded,
    root: ROOT,
    destination,
    destinationExists: overrides.destinationExists || fs.existsSync,
    ...(values.powered ? { powered: true, dialoguesPerFace } : {}),
    ...(values.resume ? { resume: true } : {}),
    ...(overrides.probeRoute ? { probeRoute: overrides.probeRoute } : {}),
    ...(overrides.smokeRole ? { smokeRole: overrides.smokeRole } : {}),
  });
  process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
  process.stdout.write(`${TUTOR_STUB_RESISTANT_LEARNER_MERGED_USAGE}\n`);
  if (preflight.status !== 'passed_zero_call') throw new Error('merged zero-call preflight failed');
  if (values['dry-run']) return preflight;
  const tty = overrides.isTTY ?? (process.stdin.isTTY === true && process.stdout.isTTY === true);
  if (!tty) throw new Error('merged paid calibration requires one attended TTY invocation');
  const parallelism = Number(values.parallelism);
  if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 4) {
    throw new Error('parallelism must be an integer from 1 to 4');
  }
  let approval;
  if (values.resume) {
    // The recorded typed approval covers the study; a resume after a technical
    // halt is the same study, so no re-approval ceremony runs here.
    approval = JSON.parse(fs.readFileSync(path.join(destination, 'approval.json'), 'utf8'));
    if (approval.powered_run_authorized !== true) throw new Error('resume requires the recorded powered approval');
    if (approval.dialogues_per_face !== preflight.dialogues_per_face) {
      throw new Error('recorded approval covers a different powered size');
    }
  } else {
    const authorization = await (overrides.operatorApproval || attendedApproval)({ preflight });
    approval = buildTutorStubResistantLearnerMergedApproval({
      signedBy: authorization.signedBy,
      approvalPhrase: authorization.approvalPhrase,
      preflight,
    });
    approval.method = authorization.method;
  }
  const provenance = (overrides.sourceProvenance || tutorStubResistantLearnerMergedSourceProvenance)();
  return (overrides.execute || executeTutorStubResistantLearnerMergedCalibration)({
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
