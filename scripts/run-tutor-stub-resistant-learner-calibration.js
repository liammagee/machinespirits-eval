#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { requiredTutorStubArtifactArchiveArgs } from '../services/tutorStubArtifactArchive.js';
import {
  readTutorStubRegisteredStudyOutcome,
  TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS,
} from '../services/tutorStubRegisteredStudyOutcome.js';
import {
  buildTutorStubResistantLearnerCalibrationPlan,
  loadTutorStubResistantLearnerDesign,
  runTutorStubResistantLearnerCompilationPreflight,
  summarizeTutorStubResistantLearnerCalibration,
  tutorStubFrameRefuserR1Prompt,
} from '../services/tutorStubResistantLearnerCalibration.js';
import { mintTutorStubRivalLearnerDag, tutorStubRivalLearnerDagPrompt } from '../services/tutorStubRivalLearnerDag.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, {
    flag: 'wx',
  });
}

function appendLedger(filePath, event) {
  fs.appendFileSync(filePath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

function designRelativePath(value) {
  const absolute = path.resolve(ROOT, value || '');
  const relative = path.relative(ROOT, absolute);
  if (!value || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('design must be repository-relative');
  }
  return relative;
}

function assertLaunchSource({ expectedCommit, designPaths }) {
  const commit = git('rev-parse', 'HEAD');
  if (commit !== expectedCommit) throw new Error(`launch commit drift: expected ${expectedCommit}, found ${commit}`);
  if (git('status', '--porcelain=v1', '--untracked-files=all')) {
    throw new Error('resistant-learner calibration requires a clean detached checkout');
  }
  let branch = '';
  try {
    branch = git('symbolic-ref', '-q', '--short', 'HEAD');
  } catch {
    branch = '';
  }
  if (branch) throw new Error(`resistant-learner calibration requires detached HEAD, found ${branch}`);
  for (const designPath of designPaths) {
    const committed = execFileSync('git', ['show', `${commit}:${designPath}`], { cwd: ROOT });
    const onDisk = fs.readFileSync(path.join(ROOT, designPath));
    if (!committed.equals(onDisk)) {
      throw new Error(`launch commit does not contain the exact bytes of ${designPath}`);
    }
  }
  execFileSync('git', ['merge-base', '--is-ancestor', expectedCommit, 'origin/main'], { cwd: ROOT });
  return commit;
}

export function tutorStubResistantLearnerGoNoteBindingIssues({
  text,
  launchCommit,
  designPaths,
  spendCap,
  modelRefs,
  destination,
}) {
  const issues = [];
  const firstNonblankLine = text.split(/\r?\n/u).find((line) => line.trim());
  if (firstNonblankLine?.trim() !== 'GO') issues.push('go_token');
  if (!designPaths.every((designPath) => text.includes(designPath))) issues.push('design_paths');
  if (!modelRefs.every((modelRef) => text.includes(modelRef))) issues.push('model_routes');
  if (!text.includes(launchCommit)) issues.push('launch_commit');
  const boundIntegers = [...text.matchAll(/\b(?:\d{1,3}(?:[,_]\d{3})+|\d+)\b/gu)].map((match) =>
    match[0].replace(/[,_]/gu, ''),
  );
  if (!boundIntegers.includes(String(spendCap))) issues.push('spend_cap');
  if (!text.includes(destination)) issues.push('destination');
  if (!/\bcalibration\b/iu.test(text)) issues.push('calibration_stage');
  if (!text.includes('frame_refuser-r1-v1')) issues.push('r1_persona');
  return issues;
}

function assertGoNote({ goNoteCommit, goNotePath, launchCommit, designPaths, spendCap, modelRefs, destination }) {
  if (!String(goNotePath || '').startsWith('notes/') || path.isAbsolute(goNotePath)) {
    throw new Error('GO note must be a repository-relative path under notes/');
  }
  execFileSync('git', ['merge-base', '--is-ancestor', launchCommit, goNoteCommit], { cwd: ROOT });
  const text = execFileSync('git', ['show', `${goNoteCommit}:${goNotePath}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const issues = tutorStubResistantLearnerGoNoteBindingIssues({
    text,
    launchCommit,
    designPaths,
    spendCap,
    modelRefs,
    destination,
  });
  if (issues.length) {
    throw new Error(
      `signed GO note does not bind GO, the calibration stage, both designs, launch commit, complete model routes, destination, combined spend cap, and R1 persona: ${issues.join(', ')}`,
    );
  }
  return { commit: goNoteCommit, path: goNotePath };
}

function traceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(directory, name));
}

function readTrace(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function tutorStubResistantLearnerCalibrationChildSpec({ loaded, job, destination }) {
  const jobRoot = path.join(destination, 'jobs', job.id);
  const traceDir = path.join(jobRoot, 'traces');
  const registeredStudyOutcome = path.join(jobRoot, 'registered-study-outcome.json');
  fs.mkdirSync(traceDir, { recursive: true });
  const designPath = path.relative(ROOT, loaded.path);
  const b1 = job.study === 'B1';
  const models = loaded.design.models;
  const rivalDagDesign = [
    'machinespirits.tutor-stub.resistant-learner-study-design.v2',
    'machinespirits.tutor-stub.resistant-learner-study-design.v3',
  ].includes(loaded.design.schema);
  const rivalDag = rivalDagDesign ? mintTutorStubRivalLearnerDag({ design: loaded.design, job, root: ROOT }) : null;
  if (rivalDag) writeOnce(path.join(jobRoot, 'rival-learner-dag.json'), rivalDag);
  const profile = rivalDagDesign
    ? tutorStubRivalLearnerDagPrompt({ design: loaded.design, job, root: ROOT })
    : b1
      ? 'bored'
      : tutorStubFrameRefuserR1Prompt(loaded.design);
  return {
    jobRoot,
    traceDir,
    transcript: path.join(jobRoot, 'transcript.json'),
    registeredStudyOutcome,
    stdout: path.join(jobRoot, 'stdout.log'),
    stderr: path.join(jobRoot, 'stderr.log'),
    env: {
      ...process.env,
      TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS: models.triggerObservation.semantics,
      TUTOR_STUB_REMEMBER_SETTINGS: '0',
      TUTOR_STUB_REGISTERED_STUDY_OUTCOME_FILE: registeredStudyOutcome,
    },
    args: [
      'scripts/tutor-stub.js',
      '--lab',
      'automated_eval',
      '--acknowledge-research-use',
      ...requiredTutorStubArtifactArchiveArgs(),
      '--model-call-budget',
      String(loaded.design.attemptCeilings.maximumReservationsPerDialogue),
      '--all-models',
      models.analysis,
      '--model',
      models.tutor,
      '--classifier-model',
      models.analysis,
      '--learner-record-model',
      models.analysis,
      '--auto-learner-model',
      models.learner,
      '--cli-effort',
      models.cliEffort,
      '--world',
      job.world,
      '--dag',
      '--dag-mode',
      'strict_dag',
      '--tutor-learner-dag',
      '--auto-learner',
      '--auto-learner-profile',
      profile,
      '--auto-turns',
      String(job.maximum_trigger_turn + job.outcome_horizon_learner_turns),
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
      'warm,plain,ironic,sarcastic',
      '--dag-fact-dropout',
      '0',
      '--dag-fact-dropout-seed',
      '1',
      '--resistant-learner-calibration-design',
      designPath,
      '--resistant-learner-calibration-job',
      job.id,
      '--trace-dir',
      path.relative(ROOT, traceDir),
      '--save',
      path.relative(ROOT, path.join(jobRoot, 'transcript.json')),
    ],
  };
}

export function runTutorStubResistantLearnerCalibrationChild(spec) {
  return new Promise((resolve) => {
    const stdout = fs.openSync(spec.stdout, 'wx');
    const stderr = fs.openSync(spec.stderr, 'wx');
    const child = spawn(process.execPath, spec.args, { cwd: ROOT, env: spec.env, stdio: ['ignore', stdout, stderr] });
    child.on('error', (error) => {
      fs.closeSync(stdout);
      fs.closeSync(stderr);
      resolve({ code: null, signal: null, spawn_error: error.message });
    });
    child.on('close', (code, signal) => {
      fs.closeSync(stdout);
      fs.closeSync(stderr);
      resolve({ code, signal, spawn_error: null });
    });
  });
}

export function extractTutorStubResistantLearnerCalibrationRow({ job, spec, exit }) {
  const traces = traceFiles(spec.traceDir);
  const trace = traces.length === 1 ? traces[0] : null;
  const events = trace ? readTrace(trace) : [];
  const attempts = events.filter((event) => event.type === 'model_call_budget_reserved').length;
  const outcomes = events.filter(
    (event) => event.type === 'resistant_learner_calibration_semantic_adjudication' && event.case_id === job.id,
  );
  const complete = exit.code === 0 && trace && outcomes.length === 1 && fs.existsSync(spec.transcript);
  const registeredStudyOutcome = readTutorStubRegisteredStudyOutcome({
    filePath: spec.registeredStudyOutcome,
    expectedJobId: job.id,
  });
  const retainedSubstantiveFailure = exit.code !== 0 && registeredStudyOutcome.present && registeredStudyOutcome.valid;
  return {
    job,
    status: complete
      ? 'complete'
      : retainedSubstantiveFailure
        ? TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS
        : 'failed',
    exit,
    attempts,
    trace: trace ? path.relative(destinationRoot(spec), trace) : null,
    transcript: fs.existsSync(spec.transcript) ? path.relative(destinationRoot(spec), spec.transcript) : null,
    outcome: outcomes.length === 1 ? { primary: outcomes[0].primary, fidelity: outcomes[0].fidelity } : null,
    registered_failure: retainedSubstantiveFailure ? registeredStudyOutcome.outcome : null,
    registered_failure_artifact: registeredStudyOutcome.present
      ? path.relative(destinationRoot(spec), spec.registeredStudyOutcome)
      : null,
    registered_failure_artifact_issues: registeredStudyOutcome.present ? registeredStudyOutcome.issues : [],
  };
}

function destinationRoot(spec) {
  return path.dirname(path.dirname(spec.jobRoot));
}

export function tutorStubResistantLearnerCalibrationHaltReason(row) {
  if (row.status === 'failed') return `technical failure in ${row.job.id}`;
  if (row.outcome?.fidelity?.fields?.prohibited_delivery?.value === 'yes') {
    return `confirmed prohibited delivery in ${row.job.id}`;
  }
  return null;
}

export function tutorStubResistantLearnerStudyDryRunReport({ loaded, plan, preflight }) {
  const jobs = plan.jobs;
  const actionCounts = Object.fromEntries(
    [...new Set(jobs.map((job) => job.action))].map((action) => [
      action,
      jobs.filter((job) => job.action === action).length,
    ]),
  );
  const registerCounts = Object.fromEntries(
    [...new Set(jobs.map((job) => job.register))].map((register) => [
      register,
      jobs.filter((job) => job.register === register).length,
    ]),
  );
  const worldCounts = Object.fromEntries(
    [...new Set(jobs.map((job) => job.world))].map((world) => [
      world,
      jobs.filter((job) => job.world === world).length,
    ]),
  );
  return {
    study_id: loaded.design.studyId,
    design_path: path.relative(ROOT, loaded.path),
    design_sha256: loaded.sha256,
    jobs: jobs.length,
    action_counts: actionCounts,
    register_counts: registerCounts,
    world_counts: worldCounts,
    planned_role_calls: jobs.length * loaded.design.attemptCeilings.plannedCallsPerDialogue,
    hard_attempt_ceiling: loaded.design.attemptCeilings.calibrationMaximumReservations,
    semantic_reader_calls_per_dialogue:
      loaded.design.attemptCeilings.callPlanPerDialogue.primaryReaderSeats +
      loaded.design.attemptCeilings.callPlanPerDialogue.fidelityReaderSeats,
    compilation_preflight: preflight,
    model_calls_executed: 0,
    plan_assignment_sha256: plan.assignment_sha256,
  };
}

export function tutorStubResistantLearnerDryRunReport(entries) {
  const studies = entries.map(tutorStubResistantLearnerStudyDryRunReport);
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-combined-calibration-dry-run.v1',
    status: 'passed_zero_call',
    launch_scope: 'B1_and_R1_calibrations_under_one_GO_note',
    studies,
    jobs: studies.reduce((sum, study) => sum + study.jobs, 0),
    planned_role_calls: studies.reduce((sum, study) => sum + study.planned_role_calls, 0),
    hard_attempt_ceiling: studies.reduce((sum, study) => sum + study.hard_attempt_ceiling, 0),
    model_calls_executed: 0,
  };
}

export function tutorStubResistantLearnerCalibrationExecutionQueue(entries) {
  const r1 = entries.find((entry) => entry.loaded.design.studyId === 'resistant-learner-r1-graded-engagement');
  const b1 = entries.find((entry) => entry.loaded.design.studyId === 'resistant-learner-b1-authored-pickup');
  if (!r1 || !b1 || entries.length !== 2) {
    throw new Error('combined resistant-learner execution queue requires exactly the registered R1 and B1 studies');
  }
  return [r1, b1].flatMap((entry) => entry.plan.jobs.map((job) => ({ ...entry, job })));
}

async function main() {
  const { values } = parseArgs({
    options: {
      'b1-design': { type: 'string' },
      'r1-design': { type: 'string' },
      destination: { type: 'string' },
      'expected-source-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      parallelism: { type: 'string', default: '4' },
      'accept-charges': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (!values['b1-design'] || !values['r1-design']) {
    throw new Error('combined resistant-learner calibration requires --b1-design and --r1-design');
  }
  const designPaths = [designRelativePath(values['b1-design']), designRelativePath(values['r1-design'])];
  const entries = designPaths.map((designPath) => {
    const loaded = loadTutorStubResistantLearnerDesign({ designPath, root: ROOT });
    return {
      loaded,
      plan: buildTutorStubResistantLearnerCalibrationPlan(loaded.design),
      preflight: runTutorStubResistantLearnerCompilationPreflight({ loaded, root: ROOT }),
    };
  });
  if (
    entries.some(({ loaded }) => loaded.design.schema !== 'machinespirits.tutor-stub.resistant-learner-study-design.v1')
  ) {
    throw new Error(
      'v2 and v3 resistant-learner designs require scripts/run-tutor-stub-resistant-learner-calibration-v2.js; the legacy GO-note launcher is v1-only',
    );
  }
  if (
    entries[0].loaded.design.studyId !== 'resistant-learner-b1-authored-pickup' ||
    entries[1].loaded.design.studyId !== 'resistant-learner-r1-graded-engagement'
  ) {
    throw new Error('--b1-design and --r1-design must name the registered B1 and R1 designs in that order');
  }
  if (entries.some((entry) => entry.preflight.status !== 'passed_zero_call')) {
    throw new Error('resistant-learner action and prompt compilation preflight failed');
  }
  const combinedAttemptCeiling = entries.reduce(
    (sum, entry) => sum + entry.loaded.design.attemptCeilings.calibrationMaximumReservations,
    0,
  );
  if (values['dry-run']) {
    process.stdout.write(`${JSON.stringify(tutorStubResistantLearnerDryRunReport(entries), null, 2)}\n`);
    return;
  }
  if (
    !values.destination ||
    !values['expected-source-commit'] ||
    !values['go-note-commit'] ||
    !values['go-note-path'] ||
    !values['accept-charges']
  ) {
    throw new Error(
      'paid calibration requires destination, expected source commit, committed GO note, and --accept-charges',
    );
  }
  const launchCommit = assertLaunchSource({
    expectedCommit: values['expected-source-commit'],
    designPaths,
  });
  const destination = path.resolve(values.destination);
  const modelRefs = [
    ...new Set(
      entries.flatMap(({ loaded }) => [
        loaded.design.models.tutor,
        loaded.design.models.analysis,
        loaded.design.models.learner,
        ...loaded.design.models.triggerObservation.judges.map((judge) => judge.modelRef),
        ...loaded.design.models.finalSemanticReaders.map((judge) => judge.modelRef),
      ]),
    ),
  ];
  const goNote = assertGoNote({
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
    launchCommit,
    designPaths,
    spendCap: combinedAttemptCeiling,
    modelRefs,
    destination,
  });
  if (fs.existsSync(destination)) throw new Error('resistant-learner calibration destination is create-once');
  const parallelism = Number(values.parallelism);
  if (!Number.isInteger(parallelism) || parallelism < 1 || parallelism > 4) {
    throw new Error('parallelism must be an integer from 1 to 4');
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.mkdirSync(destination, { recursive: false });
  fs.mkdirSync(path.join(destination, 'jobs'));
  const ledgerPath = path.join(destination, 'run-ledger.jsonl');
  writeOnce(path.join(destination, 'plan.json'), {
    schema: 'machinespirits.tutor-stub.resistant-learner-combined-calibration-plan.v1',
    status: 'planned_authorized_launch',
    source_commit: launchCommit,
    studies: entries.map(({ loaded, plan, preflight }) => ({
      ...plan,
      design_path: path.relative(ROOT, loaded.path),
      design_sha256: loaded.sha256,
      model_attempt_ceiling: loaded.design.attemptCeilings.calibrationMaximumReservations,
      compilation_preflight: preflight,
    })),
    go_note: goNote,
    model_attempt_ceiling: combinedAttemptCeiling,
  });
  writeOnce(ledgerPath, '');
  appendLedger(ledgerPath, {
    type: 'launch',
    source_commit: launchCommit,
    design_paths: designPaths,
    go_note: goNote,
    planned_units: entries.reduce((sum, entry) => sum + entry.plan.jobs.length, 0),
    hard_attempt_ceiling: combinedAttemptCeiling,
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
      if (attempts > combinedAttemptCeiling) {
        throw new Error('combined calibration attempt ceiling exceeded');
      }
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
        `completed ${rows.length}/${queued.length}; attempts ${attempts}/${combinedAttemptCeiling}${haltReason ? `; halted: ${haltReason}` : ''}\n`,
      );
    }
  }
  await Promise.all(Array.from({ length: parallelism }, () => worker()));
  rows.sort((left, right) => left.job.id.localeCompare(right.job.id));
  const studyReports = entries.map(({ loaded }) =>
    summarizeTutorStubResistantLearnerCalibration({
      rows: rows.filter((row) => row.job.study === (loaded.design.studyId.includes('-b1-') ? 'B1' : 'R1')),
      design: loaded.design,
    }),
  );
  const report = {
    schema: 'machinespirits.tutor-stub.resistant-learner-combined-calibration-report.v1',
    status: !haltReason && studyReports.every((study) => study.status === 'passed') ? 'passed' : 'failed',
    studies: studyReports,
    halt_reason: haltReason,
    calibration_only: true,
    powered_launch_authorized: false,
    execution: {
      source_commit: launchCommit,
      completed_units: rows.filter((row) => row.status === 'complete').length,
      retained_substantive_units: rows.filter((row) => row.status === TUTOR_STUB_RETAINED_SUBSTANTIVE_FAILURE_STATUS)
        .length,
      failed_units: rows.filter((row) => row.status === 'failed').length,
      missing_units: queued.length - rows.length,
      model_attempts: attempts,
      model_attempt_ceiling: combinedAttemptCeiling,
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

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
