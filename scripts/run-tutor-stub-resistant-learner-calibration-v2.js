#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { refuseRetiredPaidLaunch } from '../services/retiredPaidLauncher.js';
import {
  loadTutorStubResistantLearnerDesign,
  summarizeTutorStubResistantLearnerCalibration,
} from '../services/tutorStubResistantLearnerCalibration.js';
import {
  buildTutorStubResistantLearnerProtocolV2Entries,
  buildTutorStubResistantLearnerTypedApproval,
  runTutorStubResistantLearnerProtocolV2Preflight,
} from '../services/tutorStubResistantLearnerLaunchProtocolV2.js';
import { TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS } from '../services/tutorStubRegisteredStudyOutcome.js';
import {
  extractTutorStubResistantLearnerCalibrationRow,
  runTutorStubResistantLearnerCalibrationChild,
  tutorStubResistantLearnerCalibrationChildSpec,
  tutorStubResistantLearnerCalibrationExecutionQueue,
  tutorStubResistantLearnerCalibrationHaltReason,
} from './run-tutor-stub-resistant-learner-calibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TUTOR_STUB_RESISTANT_LEARNER_PROTOCOL_V2_USAGE = `Usage:
  node scripts/run-tutor-stub-resistant-learner-calibration-v2.js \\
    --b1-design config/tutor-stub-resistant-learner-b1-design.v3.json \\
    --r1-design config/tutor-stub-resistant-learner-r1-design.v3.json \\
    --destination /absolute/create-once/run-root \\
    [--parallelism 4] [--dry-run] [--signed-by "Operator Name"]

--dry-run executes the identical zero-call preflight and exits before approval or writes.
A paid invocation must be attended. It records typed approval in approval.json.
No GO note, digest match, clean-checkout gate, or re-signature cycle is used.`;

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

function sourceProvenance() {
  return {
    commit: gitOrNull('rev-parse', 'HEAD'),
    tree: gitOrNull('rev-parse', 'HEAD^{tree}'),
    dirty: Boolean(gitOrNull('status', '--porcelain=v1', '--untracked-files=all')),
  };
}

function repositoryRelative(value) {
  const absolute = path.resolve(ROOT, value || '');
  const relative = path.relative(ROOT, absolute);
  if (!value || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('design paths must be repository-relative');
  }
  return relative;
}

async function operatorApproval({ signedBy, preflight }) {
  const phrase = `APPROVE CALIBRATION ${preflight.hard_attempt_ceiling}`;
  if (signedBy) return { signedBy, approvalPhrase: phrase, method: 'attended_signed_by_flag' };
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const name = (await terminal.question('Operator name: ')).trim();
    const typed = await terminal.question(`Type exactly "${phrase}": `);
    return { signedBy: name, approvalPhrase: typed, method: 'attended_interactive_phrase' };
  } finally {
    terminal.close();
  }
}

async function execute({ entries, destination, parallelism, approval, preflight, provenance }) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.mkdirSync(destination, { recursive: false });
  fs.mkdirSync(path.join(destination, 'jobs'));
  writeOnce(path.join(destination, 'approval.json'), { ...approval, method: approval.method });
  const ledgerPath = path.join(destination, 'run-ledger.jsonl');
  writeOnce(path.join(destination, 'plan.json'), {
    schema: 'machinespirits.tutor-stub.resistant-learner-combined-calibration-plan.v2',
    status: 'typed_approval_recorded_attended_launch',
    approval_path: 'approval.json',
    source: provenance,
    preflight,
    studies: entries.map(({ loaded, plan }) => ({
      ...plan,
      design_path: loaded.relativePath,
      design_sha256: loaded.sha256,
      model_attempt_ceiling: loaded.design.attemptCeilings.calibrationMaximumReservations,
    })),
    model_attempt_ceiling: preflight.hard_attempt_ceiling,
  });
  writeOnce(ledgerPath, '');
  appendLedger(ledgerPath, {
    type: 'launch',
    approval_path: 'approval.json',
    source_commit: provenance.commit,
    source_tree: provenance.tree,
    dirty: provenance.dirty,
    planned_units: preflight.jobs,
    hard_attempt_ceiling: preflight.hard_attempt_ceiling,
  });

  const rows = [];
  const queued = tutorStubResistantLearnerCalibrationExecutionQueue(entries);
  let cursor = 0;
  let attempts = 0;
  let haltReason = null;
  async function worker() {
    while (cursor < queued.length && !haltReason) {
      const index = cursor;
      cursor += 1;
      const { loaded, job } = queued[index];
      const spec = tutorStubResistantLearnerCalibrationChildSpec({ loaded, job, destination });
      const exit = await runTutorStubResistantLearnerCalibrationChild(spec);
      const row = extractTutorStubResistantLearnerCalibrationRow({ job, spec, exit });
      attempts += row.attempts;
      if (row.attempts > loaded.design.attemptCeilings.maximumReservationsPerDialogue) {
        throw new Error(`job ${job.id} exceeded its per-dialogue attempt ceiling`);
      }
      if (attempts > preflight.hard_attempt_ceiling) throw new Error('combined attempt ceiling exceeded');
      rows.push(row);
      haltReason ||= tutorStubResistantLearnerCalibrationHaltReason(row);
      appendLedger(ledgerPath, {
        type: 'unit_complete',
        job_id: job.id,
        status: row.status,
        ...(row.registered_failure?.code ? { registered_failure_code: row.registered_failure.code } : {}),
        attempts: row.attempts,
        cumulative_attempts: attempts,
        ...(haltReason ? { halt_reason: haltReason } : {}),
      });
      process.stdout.write(
        `completed ${rows.length}/${queued.length}; attempts ${attempts}/${preflight.hard_attempt_ceiling}${haltReason ? `; halted: ${haltReason}` : ''}\n`,
      );
    }
  }
  await Promise.all(Array.from({ length: parallelism }, () => worker()));
  rows.sort((left, right) => left.job.id.localeCompare(right.job.id));
  const studies = entries.map(({ loaded }) =>
    summarizeTutorStubResistantLearnerCalibration({
      rows: rows.filter((row) => row.job.study === (loaded.design.studyId.includes('-b1-') ? 'B1' : 'R1')),
      design: loaded.design,
    }),
  );
  const report = {
    schema: 'machinespirits.tutor-stub.resistant-learner-combined-calibration-report.v2',
    status: !haltReason && studies.every((study) => study.status === 'passed') ? 'passed' : 'failed',
    studies,
    halt_reason: haltReason,
    calibration_only: true,
    powered_launch_authorized: false,
    execution: {
      source_commit: provenance.commit,
      source_tree: provenance.tree,
      dirty: provenance.dirty,
      completed_units: rows.filter((row) => row.status === 'complete').length,
      retained_substantive_units: rows.filter((row) => row.status === TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS)
        .length,
      failed_units: rows.filter((row) => row.status === 'failed').length,
      missing_units: queued.length - rows.length,
      model_attempts: attempts,
      model_attempt_ceiling: preflight.hard_attempt_ceiling,
    },
  };
  writeOnce(path.join(destination, 'report.json'), report);
  appendLedger(ledgerPath, {
    type: 'seal',
    status: report.status,
    completed_units: report.execution.completed_units,
    retained_substantive_units: report.execution.retained_substantive_units,
    failed_units: report.execution.failed_units,
    attempts,
  });
  process.stdout.write(`${report.status}: ${path.join(destination, 'report.json')}\n`);
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'b1-design': { type: 'string' },
      'r1-design': { type: 'string' },
      destination: { type: 'string' },
      parallelism: { type: 'string', default: '4' },
      'signed-by': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    process.stdout.write(`${TUTOR_STUB_RESISTANT_LEARNER_PROTOCOL_V2_USAGE}\n`);
    return;
  }
  if (!values['dry-run']) refuseRetiredPaidLaunch('tutor-stub-resistant-learner-calibration-v2');
  if (!values['b1-design'] || !values['r1-design'] || !values.destination) {
    throw new Error(
      `${TUTOR_STUB_RESISTANT_LEARNER_PROTOCOL_V2_USAGE}\n\nBoth supported v2 or v3 designs and an absolute destination are required.`,
    );
  }
  if (!path.isAbsolute(values.destination)) throw new Error('destination must be absolute');
  const relativePaths = [repositoryRelative(values['b1-design']), repositoryRelative(values['r1-design'])];
  const loaded = relativePaths.map((relativePath) => ({
    ...loadTutorStubResistantLearnerDesign({ designPath: relativePath, root: ROOT }),
    relativePath,
  }));
  if (
    loaded[0].design.studyId !== 'resistant-learner-b1-authored-pickup' ||
    loaded[1].design.studyId !== 'resistant-learner-r1-graded-engagement'
  ) {
    throw new Error('--b1-design and --r1-design must name supported B1 and R1 designs, in that order');
  }
  const entries = buildTutorStubResistantLearnerProtocolV2Entries(loaded);
  const destination = path.resolve(values.destination);
  const preflight = await runTutorStubResistantLearnerProtocolV2Preflight({
    entries,
    root: ROOT,
    destination,
    destinationExists: fs.existsSync,
  });
  process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
  if (preflight.status !== 'passed_zero_call') throw new Error('protocol-v2 zero-call preflight failed');
  if (values['dry-run']) return;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('paid protocol-v2 calibration requires one attended terminal invocation');
  }
  const parallelism = Number(values.parallelism);
  if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 4) {
    throw new Error('parallelism must be an integer from 1 to 4');
  }
  const authorization = await operatorApproval({ signedBy: values['signed-by'], preflight });
  const provenance = sourceProvenance();
  if (provenance.dirty)
    process.stderr.write('warning: launch checkout is dirty; provenance is recorded, not refused\n');
  const approval = buildTutorStubResistantLearnerTypedApproval({
    ...authorization,
    sourceCommit: provenance.commit,
    sourceTree: provenance.tree,
    dirty: provenance.dirty,
    preflight,
  });
  approval.method = authorization.method;
  await execute({ entries, destination, parallelism, approval, preflight, provenance });
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
