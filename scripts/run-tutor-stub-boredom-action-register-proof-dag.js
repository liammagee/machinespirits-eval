#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubBoredomProofDagPlan,
  runTutorStubBoredomProofDagEndpointPreflight,
} from '../services/tutorStubBoredomActionRegisterProofDagPreflight.js';
import { loadTutorStubBoredomProofDagStudy } from '../services/tutorStubBoredomActionRegisterProofDagStudy.js';
import { requiredTutorStubArtifactArchiveArgs } from '../services/tutorStubArtifactArchive.js';
import { recordObservedDigest } from '../services/recordedFileDigest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRATION = 'config/tutor-stub-boredom-action-register-proof-dag-registration.v2.json';

// The endpoint contract belongs to one registration and names that registration's
// outcome window in its own field names. Written out here as a second fixed path,
// it has to be kept level with the registration by hand, and nothing compares the
// two: a v5 registration read against the v2 contract asks 36 dialogues for a
// two-turn field that a five-turn study never writes. The version is taken from
// the registration actually in use instead, and the preflight service refuses the
// pair anyway if they still disagree.
function endpointContractFor(registrationPath) {
  const version = /\.(v\d+)\.json$/u.exec(registrationPath)?.[1];
  if (!version) {
    throw new Error(`cannot tell which endpoint contract belongs to ${registrationPath}`);
  }
  return `config/paid-study-endpoints/tutor-stub-boredom-action-register-proof-dag.${version}.json`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function repoPath(value, label) {
  const relative = String(value || '').trim();
  if (!relative || path.isAbsolute(relative)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(ROOT, relative);
  const rebased = path.relative(ROOT, absolute);
  if (rebased.startsWith('..') || path.isAbsolute(rebased)) throw new Error(`${label} escapes the repository root`);
  return absolute;
}

// What a human is actually approving when they approve this study: the
// question, the claim boundary, the design, the measurement rules, the power
// calculation and the spend safeguards. Deliberately NOT the source bytes.
//
// Pinning approval to a commit or to a package digest made every code
// correction void the approval and demand a fresh signed statement, which cost
// a whole launch cycle over a one-line fix and taught nobody anything. A
// reader cares whether the study is still the study they agreed to. They do not
// care that a comparison inside the adjudicator was corrected — and if that
// correction had needed a new signature, the incentive would have been to leave
// the defect in place. Code identity is still recorded on every run (see
// `sourceSnapshot`); it is evidence about what ran, not a gate on whether it
// may run.
const DESIGN_FINGERPRINT_TOP_FIELDS = Object.freeze(['registeredQuestion', 'claimBoundary', 'design', 'power']);
const DESIGN_FINGERPRINT_SAFEGUARD_FIELDS = Object.freeze([
  'modelRoute',
  'dialogue',
  'batches',
  'hardStudyAttemptCeiling',
  'attemptAccountingRole',
  'boundedTechnicalRecovery',
  'validUnitReruns',
  'outcomeSelection',
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function tutorStubBoredomProofDagApprovedDesign({ registration } = {}) {
  if (!registration || typeof registration !== 'object') {
    throw new Error('boredom proof-DAG design fingerprint requires a loaded registration');
  }
  const approved = {};
  for (const field of DESIGN_FINGERPRINT_TOP_FIELDS) approved[field] = registration[field] ?? null;
  const safeguards = {};
  for (const field of DESIGN_FINGERPRINT_SAFEGUARD_FIELDS) {
    safeguards[field] = registration.executionReadiness?.[field] ?? null;
  }
  safeguards.programmeSafeguard =
    registration.executionReadiness?.programmeCeilingIfFrameRefusalConfirmationAlsoReserved?.programmeSafeguard ?? null;
  approved.safeguards = safeguards;
  // The measurement rules bind; the digest of the file that implements them
  // does not, so a correction inside the instrument keeps the approval alive.
  const measurement = JSON.parse(JSON.stringify(registration.measurement ?? {}));
  delete measurement?.semanticAdjudicator?.moduleSha256;
  approved.measurement = measurement;
  return approved;
}

export function tutorStubBoredomProofDagDesignFingerprint({ registration } = {}) {
  return sha256(canonicalJson(tutorStubBoredomProofDagApprovedDesign({ registration })));
}

export function frozenTutorStubBoredomProofDagSourceClosure({ loaded, root = ROOT } = {}) {
  const version = loaded?.registration?.version ?? 0;
  if (version < 4) return null;
  const relativePath = `config/tutor-stub-boredom-action-register-proof-dag-study-go-request.v${version}.json`;
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`boredom proof-DAG source pin requires the frozen request: ${relativePath}`);
  }
  const closure = readJson(absolutePath)?.source?.closure;
  if (!Array.isArray(closure) || !closure.length) {
    throw new Error(`boredom proof-DAG frozen request carries no source closure: ${relativePath}`);
  }
  return closure;
}

export function assertTutorStubBoredomProofDagSourceClosure({ expectedSourceCommit, closure, root = ROOT } = {}) {
  if (!/^[0-9a-f]{40}$/u.test(String(expectedSourceCommit || ''))) {
    throw new Error('boredom proof-DAG source closure requires one pinned forty-character commit');
  }
  if (!Array.isArray(closure) || !closure.length) {
    throw new Error('boredom proof-DAG source closure requires the frozen closure file list');
  }
  const digestRecords = [];
  for (const entry of closure) {
    const relative = String(entry?.path || '').trim();
    if (!relative || path.isAbsolute(relative)) throw new Error('boredom proof-DAG closure path must be relative');
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) throw new Error(`boredom proof-DAG closure file is absent: ${relative}`);
    const bytes = fs.readFileSync(absolute);
    // CLAUDE.md (2026-08-21): the frozen request's file digest is recorded, not
    // enforced. The comparison with the pinned commit below stays, because it
    // compares a recorded commit with the checkout and is not a file digest.
    digestRecords.push(
      recordObservedDigest({
        label: `boredom proof-DAG closure ${relative}`,
        filePath: relative,
        recordedSha256: entry.sha256,
        observedSha256: sha256(bytes),
      }),
    );
    let committed;
    try {
      committed = execFileSync('git', ['show', `${expectedSourceCommit}:${relative}`], {
        cwd: root,
        maxBuffer: 256 * 1024 * 1024,
      });
    } catch {
      throw new Error(`boredom proof-DAG closure file is absent at ${expectedSourceCommit}: ${relative}`);
    }
    if (!committed.equals(bytes)) {
      throw new Error(`boredom proof-DAG closure drift against ${expectedSourceCommit}: ${relative}`);
    }
  }
  return { verified: closure.length, digestRecords };
}

// Records what ran. It no longer refuses to run.
//
// The old version demanded a clean checkout and bytes identical to a pinned
// commit, so an uncommitted comment blocked a launch and any correction voided
// the pin. What a later reader needs is the ability to say which code produced
// a given dialogue, and a recorded commit plus a dirty flag plus the digest of
// the measuring instrument answers that. `expectedSourceCommit` is still
// honoured when given — passing it asks for the old byte check — but nothing
// requires it.
function sourceSnapshot(expectedSourceCommit, closure = null, loaded = null) {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  const instrumentPath = loaded?.registration?.measurement?.semanticAdjudicator?.modulePath || null;
  const instrumentAbsolute = instrumentPath ? path.join(ROOT, instrumentPath) : null;
  const snapshot = {
    commit,
    tree,
    checkout_clean: status === '',
    uncommitted_paths: status ? status.split('\n').length : 0,
    instrument_path: instrumentPath,
    instrument_sha256:
      instrumentAbsolute && fs.existsSync(instrumentAbsolute) ? sha256(fs.readFileSync(instrumentAbsolute)) : null,
    closure_commit: null,
    closure_files_verified: 0,
  };
  if (!expectedSourceCommit) return snapshot;
  if (!closure) {
    if (expectedSourceCommit !== commit) {
      throw new Error(`boredom proof-DAG source drift: expected ${expectedSourceCommit}, found ${commit}`);
    }
    return { ...snapshot, closure_commit: commit };
  }
  const { verified, digestRecords } = assertTutorStubBoredomProofDagSourceClosure({ expectedSourceCommit, closure });
  return {
    ...snapshot,
    closure_commit: expectedSourceCommit,
    closure_files_verified: verified,
    closure_digest_records: digestRecords,
  };
}

function traceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(directory, name));
}

function reservationCountInDirectory(directory) {
  return traceFiles(directory)
    .flatMap(readJsonLines)
    .filter((event) => event.type === 'model_call_budget_reserved').length;
}

function traceResult(command) {
  const traces = traceFiles(command.trace_dir);
  if (traces.length !== 1)
    throw new Error(`expected exactly one trace for ${command.job_root}; found ${traces.length}`);
  const source = fs.readFileSync(traces[0]);
  return { trace: path.relative(ROOT, traces[0]), trace_sha256: sha256(source), trace_bytes: source.length };
}

export function classifyTutorStubBoredomProofDagChildFailure({
  events = [],
  signal = null,
  traceReadable = true,
} = {}) {
  if (!traceReadable) {
    return {
      category: 'unclassified_nonrecoverable',
      code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_FAILURE_TRACE_UNREADABLE',
      disposition: 'manual_review_required_no_recovery',
      recoverable: false,
    };
  }
  if (!Array.isArray(events)) throw new Error('boredom proof-DAG failure classification requires trace events');
  if (events.some((event) => event.type === 'resistance_action_register_outcome_learner_turn')) {
    return {
      category: 'completed_output_nonrecoverable',
      code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_TERMINAL_OUTCOME_ALREADY_RECORDED',
      disposition: 'manual_validity_review_required_no_rerun',
      recoverable: false,
    };
  }
  const substantive = events.find(
    (event) =>
      event.type === 'resistance_action_register_boredom_proof_dag_substantive_failure' ||
      event.type === 'boredom_semantic_measurement_indeterminate' ||
      (event.type === 'auto_learner_profile_adherence_exhausted' && event.profile === 'bored'),
  );
  if (substantive) {
    return {
      category: 'substantive_registered_failure',
      code: substantive.code || 'TUTOR_STUB_BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED',
      disposition: substantive.disposition || 'substantive_registered_failure_stop_no_replacement',
      recoverable: false,
    };
  }
  const exhaustedTransport = events.some(
    (event) =>
      event.type === 'model_call_error' &&
      event.cliPolicyViolation?.reason === 'call_retry_limit_reached' &&
      Number(event.cliPolicyViolation?.audit?.prohibited_event_count || 0) === 0,
  );
  if (signal || exhaustedTransport) {
    return {
      category: 'technical_recoverable',
      code: signal
        ? 'TUTOR_STUB_BOREDOM_PROOF_DAG_CHILD_INTERRUPTED'
        : 'TUTOR_STUB_BOREDOM_PROOF_DAG_CODEX_TRANSPORT_RETRY_EXHAUSTED',
      disposition: 'bounded_missing_or_failed_unit_recovery_eligible',
      recoverable: true,
    };
  }
  return {
    category: 'unclassified_nonrecoverable',
    code: 'TUTOR_STUB_BOREDOM_PROOF_DAG_FAILURE_UNCLASSIFIED',
    disposition: 'manual_review_required_no_recovery',
    recoverable: false,
  };
}

function classifyFailedChild(trace, signal) {
  try {
    const events = trace ? readJsonLines(path.resolve(ROOT, trace.trace)) : [];
    return classifyTutorStubBoredomProofDagChildFailure({ events, signal });
  } catch {
    return classifyTutorStubBoredomProofDagChildFailure({ events: [], signal, traceReadable: false });
  }
}

// The caps used to be three numbers at the top of this file: 60 attempts a
// dialogue, 240 a batch, 4 dialogues a batch. Each was also written in the
// registration, and the two copies were never compared. That is the same fault
// that gave v4 a turn window its worlds could not reach, so read them from the
// registration. Every version from v1 carries all three, so v1 to v4 come out
// exactly as before.
function registrationCaps(loaded) {
  const execution = loaded?.registration?.executionReadiness || {};
  const dialogue = execution.dialogue || {};
  const batches = execution.batches || {};
  const design = loaded?.registration?.design || {};
  const version = Number(loaded?.registration?.version) || 0;
  return {
    batchSize: batches.dialoguesPerBatch,
    perDialogue: dialogue.maximumReservationsPerDialogue,
    perBatch: batches.maximumReservationsPerBatch,
    study: dialogue.maximumReservations,
    programme: execution.programmeCeiling?.programmeSafeguard ?? (version >= 3 ? 5000 : 4539),
    // The dialogue has to run long enough to hold every turn the tutor may act
    // on, then every learner turn the endpoint watches.
    turns: design.freshPrefixGeneration?.maximumTriggerTurn + design.treatment?.postTriggerLearnerTurns,
  };
}

// Once a batch plan exists it carries the same caps, frozen at plan time. Later
// checks read them from there, so a plan written yesterday is audited against
// its own numbers and not against whatever the registration says today.
function planCaps(plan) {
  const budget = plan?.budget || {};
  return {
    batchSize: budget.dialogues,
    perDialogue: budget.maximum_model_attempt_reservations_per_dialogue,
    perBatch: budget.maximum_model_attempt_reservations,
  };
}

function childCommand({ loaded, job, destination, modelCallBudget = null }) {
  const caps = registrationCaps(loaded);
  const budget = modelCallBudget ?? caps.perDialogue;
  const jobRoot = path.join(destination, 'jobs', job.id);
  const traceDir = path.join(jobRoot, 'traces');
  const transcript = path.join(jobRoot, 'transcript.json');
  return {
    executable: process.execPath,
    args: [
      'scripts/tutor-stub.js',
      '--lab',
      'automated_eval',
      '--acknowledge-research-use',
      ...requiredTutorStubArtifactArchiveArgs(),
      '--model-call-budget',
      String(budget),
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
      job.world,
      '--dag',
      '--dag-mode',
      'strict_dag',
      '--tutor-learner-dag',
      '--auto-learner',
      '--auto-learner-profile',
      'bored',
      '--auto-turns',
      String(caps.turns),
      '--no-auto-stop-on-grounded',
      '--no-memory-summary',
      '--no-turn-feedback',
      '--run-seed',
      String(job.seed),
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
      '--boredom-proof-dag-registration',
      path.relative(ROOT, loaded.path),
      '--boredom-proof-dag-job',
      job.id,
      '--trace-dir',
      path.relative(ROOT, traceDir),
      '--save',
      path.relative(ROOT, transcript),
    ],
    cwd: ROOT,
    env: {
      TUTOR_STUB_RESISTANT_LEARNER_OBSERVATION_SEMANTICS: loaded.registration.design.observationSemantics,
      TUTOR_STUB_REMEMBER_SETTINGS: '0',
    },
    job_root: jobRoot,
    trace_dir: traceDir,
    transcript,
  };
}

function registeredPlan(registrationPath) {
  const loaded = loadTutorStubBoredomProofDagStudy({ registrationPath: repoPath(registrationPath, 'registration') });
  return { loaded, plan: buildTutorStubBoredomProofDagPlan(loaded.registration) };
}

/**
 * What a batch has to carry, read rather than written out again.
 *
 * This check used to say "exactly two plain and two warm jobs". The plan
 * builder already states each batch's composition, and v1 to v5 only had to be
 * even on the manner, so the two copies agreed by luck. v6 deals a batch from
 * four move-and-manner cells, and a batch that lost its move balance would have
 * passed the old check. That is the twenty-third time this arc has removed a
 * constant written twice with nothing comparing the copies.
 *
 * The level names come from the registration and the counts from the registered
 * batch row, so a version with one axis states two cells and a version with two
 * axes states four, in the order the plan builder writes them.
 */
function registeredBatchComposition(loaded, plan, batchId) {
  const row = plan.batches.find((batch) => batch.id === batchId);
  if (!row) throw new Error(`${batchId} is not a registered batch`);
  const treatment = loaded.registration.design.treatment || {};
  const axes = [{ field: 'realization', levels: treatment.realizations || [] }];
  if (Array.isArray(treatment.pedagogicalMoveLevels)) {
    axes.push({ field: 'pedagogical_move_level', levels: treatment.pedagogicalMoveLevels });
  }
  const cells = [];
  for (const axis of axes) {
    for (const level of axis.levels) {
      const count = row[level];
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(`${batchId} does not state how many ${level} dialogues it carries`);
      }
      cells.push({ field: axis.field, level, count });
    }
  }
  if (!cells.length) throw new Error(`${batchId} states no registered levels to balance`);
  return { cases: row.cases, cells };
}

const LAUNCH_AUTHORIZATION_SCHEMA_V2 = 'machinespirits.tutor-stub.boredom-proof-dag-launch-authorization.v2';

// v2 binds the approval to the study design, not to source bytes.
//
// The v1 gate required the authorization to be committed at HEAD and to quote
// the digest of a frozen command package. Both are dropped. What survives is
// the part that protects the science: a named human, the two spend switches,
// and a fingerprint over the question, design, measurement rules, power and
// safeguards. Change any of those and the approval stops matching, exactly as
// it should. Correct a bug and it keeps matching.
//
// v1 authorizations are still accepted so historical runs stay reproducible.
export function assertTutorStubBoredomProofDagLaunchAuthorization({ loaded, authorizationPath } = {}) {
  const version = loaded?.registration?.version ?? 0;
  if (version < 4) return null;
  const relativePath =
    authorizationPath || `config/tutor-stub-boredom-action-register-proof-dag-launch-authorization.v${version}.json`;
  const absolutePath = path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`boredom proof-DAG live execution requires a launch authorization: ${relativePath}`);
  }
  const authorization = readJson(absolutePath);
  const common =
    typeof authorization.approvedBy === 'string' &&
    authorization.approvedBy.trim() &&
    authorization.modelCallsAuthorized === true &&
    authorization.liveRunAuthorized === true;
  if (!common) {
    throw new Error('boredom proof-DAG launch authorization must name a human and authorize model calls and live run');
  }

  if (authorization.schema === LAUNCH_AUTHORIZATION_SCHEMA_V2) {
    const fingerprint = tutorStubBoredomProofDagDesignFingerprint({ registration: loaded.registration });
    if (authorization.designFingerprint !== fingerprint) {
      throw new Error(
        `boredom proof-DAG launch authorization approves a different study design: approved ${authorization.designFingerprint}, registered ${fingerprint}`,
      );
    }
    if (typeof authorization.approvalStatement !== 'string' || !authorization.approvalStatement.trim()) {
      throw new Error('boredom proof-DAG launch authorization must record the approval statement');
    }
    return {
      path: relativePath,
      sha256: sha256(fs.readFileSync(absolutePath)),
      approved_by: authorization.approvedBy,
      design_fingerprint: fingerprint,
      binds: 'study_design',
    };
  }

  // Anything that is not the design-fingerprint scheme is refused outright. The
  // superseded scheme bound approval to a commit and a request digest, so a
  // one-line bug fix voided a live approval and a correction could not be made
  // without a fresh signature. It caught no defect and cost days.
  throw new Error(
    `boredom proof-DAG launch authorization must use ${LAUNCH_AUTHORIZATION_SCHEMA_V2}; approval binds the study design, not source bytes`,
  );
}

export function buildTutorStubBoredomProofDagRecoveryJob({
  loaded,
  job,
  destination,
  priorModelAttemptReservations,
} = {}) {
  const prior = Number(priorModelAttemptReservations);
  const remaining = registrationCaps(loaded).perDialogue - prior;
  if (!loaded?.registration || !job?.id || !Number.isInteger(prior) || prior < 0 || remaining <= 0) {
    throw new Error('boredom proof-DAG recovery requires one registered missing or failed unit with unused room');
  }
  return {
    ...job,
    command: childCommand({ loaded, job, destination, modelCallBudget: remaining }),
    recovery: { prior_model_attempt_reservations: prior, remaining_model_attempt_reservations: remaining },
  };
}

export function buildTutorStubBoredomProofDagBatchPlan({
  registrationPath = REGISTRATION,
  batchId,
  destination,
  expectedSourceCommit = null,
} = {}) {
  const { loaded, plan } = registeredPlan(registrationPath);
  // How many batches there are is a registered decision — nine from v2 to v6,
  // twenty-one on v7 — so the ids come from the plan this registration deals
  // rather than from a range written here. Written out as execution_batch_1
  // through 9, this refused every v7 batch above the ninth, and refused them
  // with the same message each time, so two runs of batch ten agreed on the
  // byte and looked stable.
  const batchIds = (plan.batches || []).map((batch) => batch.id);
  if (batchIds.length === 0 || !batchIds.includes(String(batchId || ''))) {
    throw new Error(
      `boredom proof-DAG batch must be one of the ${batchIds.length} registered ids: ${batchIds.join(', ')}`,
    );
  }
  const caps = registrationCaps(loaded);
  const jobs = plan.jobs.filter((job) => job.batch_id === batchId);
  const composition = registeredBatchComposition(loaded, plan, batchId);
  const dealt = (cell) => jobs.filter((job) => job[cell.field] === cell.level).length;
  if (
    jobs.length !== caps.batchSize ||
    jobs.length !== composition.cases ||
    composition.cells.some((cell) => dealt(cell) !== cell.count)
  ) {
    const wanted = composition.cells.map((cell) => `${cell.count} ${cell.level}`).join(' and ');
    throw new Error(`${batchId} must contain ${composition.cases} jobs: ${wanted}`);
  }
  const source = sourceSnapshot(expectedSourceCommit, frozenTutorStubBoredomProofDagSourceClosure({ loaded }), loaded);
  const absoluteDestination = path.resolve(destination);
  return {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-plan.v1',
    status: 'planned_not_started',
    batch_id: batchId,
    source: {
      ...source,
      registration_path: path.relative(ROOT, loaded.path),
      registration_sha256: loaded.sha256,
    },
    design: {
      fresh_independent_dialogues: true,
      prior_dialogues_reused: 0,
      prior_outcomes_pooled: 0,
      // v1 to v5 wrote "plain: 2, warm: 2" here. The keys and counts now come
      // from the registered batch row, so those versions rebuild the same two
      // keys in the same order and v6 also records its move split.
      ...Object.fromEntries(composition.cells.map((cell) => [cell.level, cell.count])),
      interim_analysis: false,
      assignment_manifest_sha256: plan.assignment_manifest_sha256,
    },
    budget: {
      dialogues: caps.batchSize,
      maximum_model_attempt_reservations_per_dialogue: caps.perDialogue,
      maximum_model_attempt_reservations: caps.perBatch,
      study_maximum_model_attempt_reservations: caps.study,
      programme_ceiling: caps.programme,
      enlarges_ceiling: false,
    },
    destination: path.relative(ROOT, absoluteDestination),
    destination_create_once: true,
    jobs: jobs.map((job) => ({ ...job, command: childCommand({ loaded, job, destination: absoluteDestination }) })),
    recovery: {
      valid_units_may_be_rerun: false,
      missing_or_failed_units_only: true,
      requires_actual_unused_room_below_dialogue_batch_study_and_programme_caps: true,
      outcome_selection: false,
    },
  };
}

async function runChild(planJob) {
  const command = planJob.command;
  fs.mkdirSync(command.job_root, { recursive: false });
  fs.mkdirSync(command.trace_dir, { recursive: false });
  const stdoutPath = path.join(command.job_root, 'stdout.log');
  const stderrPath = path.join(command.job_root, 'stderr.log');
  const stdout = fs.createWriteStream(stdoutPath, { flags: 'wx' });
  const stderr = fs.createWriteStream(stderrPath, { flags: 'wx' });
  return new Promise((resolve) => {
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      env: { ...process.env, ...command.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);
    child.on('close', (code, signal) => {
      stdout.end();
      stderr.end();
      let trace = null;
      let traceError = null;
      try {
        trace = traceResult(command);
      } catch (error) {
        traceError = error.message;
      }
      const complete = code === 0 && trace;
      resolve({
        job_id: planJob.id,
        status: complete ? 'complete' : 'failed',
        exit_code: code,
        signal,
        ...trace,
        trace_error: traceError,
        failure: complete ? null : classifyFailedChild(trace, signal),
        stdout: path.relative(ROOT, stdoutPath),
        stderr: path.relative(ROOT, stderrPath),
        transcript: path.relative(ROOT, command.transcript),
      });
    });
  });
}

async function runPool(items, parallelism, worker) {
  const pending = [...items];
  const results = [];
  async function consume() {
    while (pending.length) results.push(await worker(pending.shift()));
  }
  await Promise.all(Array.from({ length: Math.min(parallelism, items.length) }, consume));
  return results;
}

export function selectTutorStubBoredomProofDagRecoveryCandidates({ plan, initial } = {}) {
  if (!Array.isArray(plan?.jobs) || !Array.isArray(initial?.results)) {
    throw new Error('boredom proof-DAG recovery candidate audit requires one plan and initial result');
  }
  const plannedIds = new Set(plan.jobs.map((job) => job.id));
  const resultIds = initial.results.map((row) => row.job_id);
  if (
    new Set(resultIds).size !== resultIds.length ||
    resultIds.some((id) => !plannedIds.has(id)) ||
    initial.results.some((row) => !['complete', 'failed'].includes(row.status))
  ) {
    throw new Error('boredom proof-DAG recovery rows drifted from the registered plan');
  }
  const rows = new Map(initial.results.map((row) => [row.job_id, row]));
  const valid = new Map();
  const missing = [];
  for (const job of plan.jobs) {
    const row = rows.get(job.id);
    const traces = traceFiles(job.command?.trace_dir);
    if (traces.length > 1) {
      throw new Error(`boredom proof-DAG recovery refuses multiple original traces for ${job.id}`);
    }
    let observed = null;
    if (traces.length === 1) {
      try {
        observed = classifyTutorStubBoredomProofDagChildFailure({
          events: readJsonLines(traces[0]),
          signal: row?.signal || null,
        });
      } catch {
        observed = classifyTutorStubBoredomProofDagChildFailure({ traceReadable: false });
      }
    }
    if (row?.status === 'complete') {
      if (observed?.category !== 'completed_output_nonrecoverable') {
        throw new Error(`boredom proof-DAG complete row lacks one terminal output for ${job.id}`);
      }
      valid.set(job.id, row);
    } else if (observed?.category === 'completed_output_nonrecoverable') {
      throw new Error(`boredom proof-DAG recovery refuses completed original output ${job.id}`);
    } else if (!row && traces.length === 0) {
      missing.push(job);
    } else if (
      observed?.category === 'technical_recoverable' &&
      (!row || (row.failure?.category === 'technical_recoverable' && row.failure?.recoverable === true))
    ) {
      missing.push(job);
    } else {
      throw new Error(`boredom proof-DAG recovery refuses nontechnical or unclassified partial failure ${job.id}`);
    }
  }
  return { valid, missing };
}

// The caps come from the batch plan being audited, not from this file and not
// from today's registration. A recovery is judged against the numbers its own
// batch was planned under.
export function assertTutorStubBoredomProofDagRecoveryBudget({ missing, initialReservations, usedBefore, plan } = {}) {
  const caps = planCaps(plan);
  if (
    !Array.isArray(missing) ||
    !initialReservations ||
    !Number.isInteger(usedBefore) ||
    usedBefore < 0 ||
    !Number.isInteger(caps.perBatch) ||
    !Number.isInteger(caps.perDialogue)
  ) {
    throw new Error('boredom proof-DAG recovery budget audit requires candidates, observed reservations, and a plan');
  }
  if (
    usedBefore >= caps.perBatch ||
    missing.some((job) => Number(initialReservations[job.id] || 0) >= caps.perDialogue)
  ) {
    throw new Error('boredom proof-DAG recovery has no room under the unchanged caps');
  }
  return true;
}

function sealBatch(destination, plan, result, recovery = {}) {
  const caps = planCaps(plan);
  const seal = {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-seal.v1',
    status: 'sealed_complete',
    batch_id: plan.batch_id,
    plan_sha256: sha256(fs.readFileSync(path.join(destination, 'batch-plan.json'))),
    result_sha256: sha256(fs.readFileSync(path.join(destination, recovery.resultFile || 'batch-result.json'))),
    ...recovery.hashes,
    dialogues: caps.batchSize,
    hard_ceiling: caps.perBatch,
    valid_unit_reruns: false,
    outcome_selection: false,
  };
  writeJson(path.join(destination, 'batch-seal.json'), seal);
  return seal;
}

// Amendment A1. A batch that lost a unit to a registered indeterminate stop is
// never sealed by the run itself, because the run only seals four of four. That
// left three batches with no byte pin at all. This seals exactly that case and
// nothing else: same two digests, a status that says what happened, and the
// realised counts. It pins bytes that already exist. It does not approve a run,
// admit an excluded unit, or reopen a stopped one.
// The registration names two ways a boredom unit stops for good, and both end
// it the same way: no repair, no rerun, no replacement, out of the analysis.
//   noEligibleTurnByMaximumDisposition — no turn up to the trigger maximum
//     could be read, so the unit stops as measurement indeterminate.
//   substantiveMissingOrDuplicateTriggerDisposition — the learner never gave
//     the registered trigger by that turn, so there is nothing to measure.
// Only the first was named here, keyed on one hard-written failure code. The
// second could then be neither sealed nor analysed: the analyzer lets a batch
// fall short only through a registered stop, and a missing trigger was not one
// by this test, so a paid batch that stopped the way the registration says it
// may stop had no state it could be left in. The key is the disposition, which
// is the word the registration itself uses, and a test compares this map
// against the registration so the two cannot drift.
const REGISTERED_STOP_DISPOSITIONS = Object.freeze({
  noEligibleTurnByMaximumDisposition: 'measurement_indeterminate_stop_no_repair_no_replacement',
  substantiveMissingOrDuplicateTriggerDisposition: 'substantive_registered_failure_stop_no_replacement',
});

export const REGISTERED_STOP_FAILURE_DISPOSITIONS = Object.freeze(Object.values(REGISTERED_STOP_DISPOSITIONS));

export function isRegisteredStop(failure) {
  return (
    Boolean(failure) &&
    failure.category === 'substantive_registered_failure' &&
    failure.recoverable === false &&
    REGISTERED_STOP_FAILURE_DISPOSITIONS.includes(failure.disposition)
  );
}

// One assembly step for both endings of a recovery. A recovery whose re-run
// units all completed assembles here and seals complete. A recovery that ended
// in a registered stop assembles here too, from the same files, and seals with
// the stop. Writing the second by hand would have put the same row shape,
// counts and digests in two places with nothing comparing them, which is the
// defect this arc keeps turning up.
function assembleTutorStubBoredomProofDagFinalResult({ plan, valid, recovered, recoveryJobs, initialReservations }) {
  const caps = planCaps(plan);
  const finalRows = plan.jobs.map((job) =>
    valid.has(job.id)
      ? { ...valid.get(job.id), origin: 'initial_valid_unit' }
      : {
          ...recovered.find((row) => row.job_id === job.id),
          origin: 'bounded_technical_recovery_missing_or_failed_unit',
        },
  );
  const totals = Object.fromEntries(
    plan.jobs.map((job) => {
      const recovery = recoveryJobs.find((row) => row.id === job.id);
      return [
        job.id,
        initialReservations[job.id] + (recovery ? reservationCountInDirectory(recovery.command.trace_dir) : 0),
      ];
    }),
  );
  const totalReservations = Object.values(totals).reduce((sum, value) => sum + value, 0);
  if (totalReservations > caps.perBatch || Object.values(totals).some((value) => value > caps.perDialogue)) {
    throw new Error('boredom proof-DAG recovery exceeded an unchanged cap');
  }
  const stopped = finalRows.filter((row) => row.status !== 'complete');
  if (!stopped.every((row) => isRegisteredStop(row.failure))) {
    throw new Error('boredom proof-DAG recovery left a unit that is neither complete nor a registered stop');
  }
  return {
    totals,
    totalReservations,
    stopped,
    finalResult: {
      schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-result.v1',
      batch_id: plan.batch_id,
      status: stopped.length ? 'incomplete' : 'complete',
      completed_dialogues: caps.batchSize - stopped.length,
      failed_or_missing_dialogues: stopped.length,
      maximum_model_attempt_reservations: caps.perBatch,
      observed_model_attempt_reservations: totalReservations,
      observed_model_attempt_reservations_by_job: totals,
      technical_recovery_used: true,
      recovery_unit_ids: recovered.map((row) => row.job_id),
      results: finalRows,
    },
  };
}

// A recovery that ended in a registered stop writes no final result, because
// the run only assembles four of four. Recovery is create-once per batch, so
// the batch cannot simply be recovered again. This finishes it from the files
// already on disk: no model is called, no unit is re-run, no unit is replaced,
// and the stopped unit stays stopped and out of the analysis.
function assembleFinalResultFromSpentRecovery({ absolute, plan, initial }) {
  const recoveryRoot = path.join(absolute, 'recoveries', 'recovery-001');
  const recoveryPlanPath = path.join(recoveryRoot, 'recovery-plan.json');
  const recoveryResultPath = path.join(recoveryRoot, 'recovery-result.json');
  if (!fs.existsSync(recoveryPlanPath) || !fs.existsSync(recoveryResultPath)) return null;
  const recoveryPlan = readJson(recoveryPlanPath);
  const recoveryResult = readJson(recoveryResultPath);
  if (
    recoveryPlan.batch_id !== plan.batch_id ||
    recoveryResult.batch_id !== plan.batch_id ||
    recoveryPlan.original_plan_sha256 !== sha256(fs.readFileSync(path.join(absolute, 'batch-plan.json'))) ||
    recoveryPlan.original_result_sha256 !== sha256(fs.readFileSync(path.join(absolute, 'batch-result.json')))
  ) {
    throw new Error('boredom proof-DAG seal found a recovery that does not belong to this batch');
  }
  const { valid } = selectTutorStubBoredomProofDagRecoveryCandidates({ plan, initial });
  const assembled = assembleTutorStubBoredomProofDagFinalResult({
    plan,
    valid,
    recovered: recoveryResult.results,
    recoveryJobs: recoveryPlan.jobs,
    initialReservations: Object.fromEntries(
      plan.jobs.map((job) => [job.id, reservationCountInDirectory(job.command.trace_dir)]),
    ),
  });
  if (assembled.finalResult.status === 'complete') {
    throw new Error('boredom proof-DAG registered-stop seal refuses a recovery that completed');
  }
  writeJson(path.join(absolute, 'batch-final-result.json'), assembled.finalResult);
  return {
    recovery_plan_sha256: sha256(fs.readFileSync(recoveryPlanPath)),
    recovery_result_sha256: sha256(fs.readFileSync(recoveryResultPath)),
    observed_model_attempt_reservations: assembled.totalReservations,
    observed_model_attempt_reservations_by_job: assembled.totals,
  };
}

export function sealTutorStubBoredomProofDagBatchWithRegisteredStops({ destination } = {}) {
  const absolute = path.resolve(ROOT, destination || '');
  const planPath = path.join(absolute, 'batch-plan.json');
  const sealPath = path.join(absolute, 'batch-seal.json');
  const finalResultPath = path.join(absolute, 'batch-final-result.json');
  const initialResultPath = path.join(absolute, 'batch-result.json');
  if (fs.existsSync(sealPath)) throw new Error('boredom proof-DAG batch is already sealed');
  if (!fs.existsSync(planPath) || !fs.existsSync(initialResultPath)) {
    throw new Error('boredom proof-DAG seal requires a batch plan and a batch result');
  }
  const plan = readJson(planPath);
  const initial = readJson(initialResultPath);
  const recoveryHashes = fs.existsSync(finalResultPath)
    ? null
    : assembleFinalResultFromSpentRecovery({ absolute, plan, initial });
  const resultFile = fs.existsSync(finalResultPath) ? 'batch-final-result.json' : 'batch-result.json';
  const result = readJson(path.join(absolute, resultFile));
  const stopped = result.results.filter((row) => row.status !== 'complete');
  if (stopped.length === 0) throw new Error('boredom proof-DAG registered-stop seal refuses a complete batch');
  if (!stopped.every((row) => isRegisteredStop(row.failure))) {
    throw new Error('boredom proof-DAG registered-stop seal refuses a batch with a non-registered failure');
  }
  const caps = planCaps(plan);
  if (result.results.length !== caps.batchSize) {
    throw new Error('boredom proof-DAG registered-stop seal requires the full planned unit list');
  }
  const seal = {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-seal.v1',
    status: 'sealed_with_registered_stops',
    batch_id: plan.batch_id,
    plan_sha256: sha256(fs.readFileSync(planPath)),
    result_sha256: sha256(fs.readFileSync(path.join(absolute, resultFile))),
    dialogues: caps.batchSize,
    completed_dialogues: result.results.length - stopped.length,
    registered_indeterminate_stops: stopped.map((row) => row.job_id).sort(),
    hard_ceiling: caps.perBatch,
    valid_unit_reruns: false,
    outcome_selection: false,
    ...(recoveryHashes || {}),
  };
  writeJson(sealPath, seal);
  return seal;
}

export async function runTutorStubBoredomProofDagBatch({
  registrationPath = REGISTRATION,
  batchId,
  destination,
  parallelism = 4,
  expectedSourceCommit,
  launchAuthorizationPath,
} = {}) {
  const absoluteDestination = path.resolve(destination);
  if (fs.existsSync(absoluteDestination)) throw new Error('boredom proof-DAG batch destination must be fresh');
  const plan = buildTutorStubBoredomProofDagBatchPlan({
    registrationPath,
    batchId,
    destination: absoluteDestination,
    expectedSourceCommit,
  });
  assertTutorStubBoredomProofDagLaunchAuthorization({
    loaded: loadTutorStubBoredomProofDagStudy({ registrationPath: repoPath(registrationPath, 'registration') }),
    authorizationPath: launchAuthorizationPath,
  });
  fs.mkdirSync(path.dirname(absoluteDestination), { recursive: true });
  fs.mkdirSync(absoluteDestination, { recursive: false });
  fs.mkdirSync(path.join(absoluteDestination, 'jobs'), { recursive: false });
  writeJson(path.join(absoluteDestination, 'batch-plan.json'), plan);
  const caps = planCaps(plan);
  const results = await runPool(plan.jobs, Number(parallelism), runChild);
  results.sort((left, right) => left.job_id.localeCompare(right.job_id));
  const completed = results.filter((row) => row.status === 'complete').length;
  const result = {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-live-batch-result.v1',
    batch_id: batchId,
    status: completed === caps.batchSize ? 'complete' : 'incomplete',
    completed_dialogues: completed,
    failed_or_missing_dialogues: caps.batchSize - completed,
    maximum_model_attempt_reservations: caps.perBatch,
    results,
  };
  writeJson(path.join(absoluteDestination, 'batch-result.json'), result);
  if (result.status === 'complete') sealBatch(absoluteDestination, plan, result);
  return result;
}

export async function recoverTutorStubBoredomProofDagBatch({
  destination,
  expectedSourceCommit,
  parallelism = 4,
} = {}) {
  const absoluteDestination = path.resolve(destination);
  const planPath = path.join(absoluteDestination, 'batch-plan.json');
  const resultPath = path.join(absoluteDestination, 'batch-result.json');
  if (!fs.existsSync(planPath) || !fs.existsSync(resultPath)) {
    throw new Error('boredom proof-DAG recovery requires one preserved initial plan and result');
  }
  if (fs.existsSync(path.join(absoluteDestination, 'batch-seal.json'))) {
    throw new Error('boredom proof-DAG recovery refuses a sealed batch');
  }
  if (fs.existsSync(path.join(absoluteDestination, 'batch-final-result.json'))) {
    throw new Error('boredom proof-DAG recovery is create-once');
  }
  const plan = readJson(planPath);
  const initial = readJson(resultPath);
  const caps = planCaps(plan);
  const { loaded, plan: registered } = registeredPlan(plan.source?.registration_path);
  const currentSource = sourceSnapshot(
    expectedSourceCommit,
    frozenTutorStubBoredomProofDagSourceClosure({ loaded }),
    loaded,
  );
  if (
    (plan.source?.closure_commit ?? plan.source?.commit) !== expectedSourceCommit ||
    plan.source?.commit !== currentSource.commit ||
    plan.source?.tree !== currentSource.tree ||
    initial.status !== 'incomplete' ||
    plan.budget?.maximum_model_attempt_reservations !== registrationCaps(loaded).perBatch
  ) {
    throw new Error('boredom proof-DAG recovery source, status, or ceiling drifted');
  }
  const { valid, missing } = selectTutorStubBoredomProofDagRecoveryCandidates({ plan, initial });
  if (!missing.length) throw new Error('boredom proof-DAG recovery found no missing or failed units');
  const initialReservations = Object.fromEntries(
    plan.jobs.map((job) => [job.id, reservationCountInDirectory(job.command.trace_dir)]),
  );
  const usedBefore = Object.values(initialReservations).reduce((sum, value) => sum + value, 0);
  assertTutorStubBoredomProofDagRecoveryBudget({ missing, initialReservations, usedBefore, plan });
  // CLAUDE.md (2026-08-21): a registration digest is recorded, never enforced. This
  // used to throw, so correcting a defect in the registration stopped the recovery.
  recordObservedDigest({
    label: 'boredom proof-DAG recovery registration',
    filePath: plan.source.registration_path ?? 'boredom proof-DAG registration',
    recordedSha256: plan.source.registration_sha256,
    observedSha256: loaded.sha256,
  });
  assertTutorStubBoredomProofDagLaunchAuthorization({ loaded });
  const registeredById = new Map(registered.jobs.map((job) => [job.id, job]));
  const recoveryRoot = path.join(absoluteDestination, 'recoveries', 'recovery-001');
  if (fs.existsSync(recoveryRoot)) throw new Error('boredom proof-DAG recovery-001 must be absent');
  const recoveryJobs = missing.map((original) => {
    const job = registeredById.get(original.id);
    if (!job || job.batch_id !== plan.batch_id)
      throw new Error(`boredom proof-DAG recovery unit ${original.id} drifted`);
    return buildTutorStubBoredomProofDagRecoveryJob({
      loaded,
      job,
      destination: recoveryRoot,
      priorModelAttemptReservations: initialReservations[original.id],
    });
  });
  fs.mkdirSync(path.join(recoveryRoot, 'jobs'), { recursive: true });
  const recoveryPlan = {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-recovery-plan.v1',
    status: 'planned_missing_or_failed_only',
    batch_id: plan.batch_id,
    source: plan.source,
    original_plan_sha256: sha256(fs.readFileSync(planPath)),
    original_result_sha256: sha256(fs.readFileSync(resultPath)),
    used_reservations_before_recovery: usedBefore,
    hard_ceiling: caps.perBatch,
    valid_unit_ids_excluded: [...valid.keys()].sort(),
    jobs: recoveryJobs,
  };
  writeJson(path.join(recoveryRoot, 'recovery-plan.json'), recoveryPlan);
  const recovered = await runPool(recoveryJobs, Number(parallelism), runChild);
  recovered.sort((left, right) => left.job_id.localeCompare(right.job_id));
  const recoveryResultPath = path.join(recoveryRoot, 'recovery-result.json');
  writeJson(recoveryResultPath, {
    schema: 'machinespirits.tutor-stub.boredom-action-register-proof-dag-recovery-result.v1',
    batch_id: plan.batch_id,
    results: recovered,
  });
  if (recovered.some((row) => row.status !== 'complete')) return { status: 'incomplete', recovered, sealed: false };
  const { finalResult, totals, totalReservations } = assembleTutorStubBoredomProofDagFinalResult({
    plan,
    valid,
    recovered,
    recoveryJobs,
    initialReservations,
  });
  const finalResultPath = path.join(absoluteDestination, 'batch-final-result.json');
  writeJson(finalResultPath, finalResult);
  sealBatch(absoluteDestination, plan, readJson(finalResultPath), {
    resultFile: 'batch-final-result.json',
    hashes: {
      recovery_plan_sha256: sha256(fs.readFileSync(path.join(recoveryRoot, 'recovery-plan.json'))),
      recovery_result_sha256: sha256(fs.readFileSync(recoveryResultPath)),
      observed_model_attempt_reservations: totalReservations,
      observed_model_attempt_reservations_by_job: totals,
    },
  });
  return { status: 'complete', recovered, sealed: true, observed_model_attempt_reservations: totalReservations };
}

function parseArgs(argv) {
  const options = { parallelism: '4' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (
      [
        '--preflight',
        '--execution-preflight',
        '--live-batch',
        '--recover-batch',
        '--seal-registered-stops',
        '--json',
        '--help',
      ].includes(arg)
    ) {
      options[arg.slice(2)] = true;
      continue;
    }
    if (
      [
        '--registration',
        '--endpoint-contract',
        '--batch',
        '--destination',
        '--parallelism',
        '--expected-source-commit',
        '--launch-authorization',
      ].includes(arg)
    ) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      options[arg.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function usage() {
  return `Usage:
  node scripts/run-tutor-stub-boredom-action-register-proof-dag.js --preflight [--json]
  node scripts/run-tutor-stub-boredom-action-register-proof-dag.js --execution-preflight --batch <execution_batch_N> --destination <fresh-path>
  node scripts/run-tutor-stub-boredom-action-register-proof-dag.js --live-batch --batch <execution_batch_N> --destination <fresh-path> [--parallelism 4]
  node scripts/run-tutor-stub-boredom-action-register-proof-dag.js --recover-batch --destination <incomplete-path> [--parallelism 4]
  node scripts/run-tutor-stub-boredom-action-register-proof-dag.js --seal-registered-stops --destination <unsealed-path>

How many batches there are is a property of the registration, not of this script: nine on v2 to v6, twenty-one on v7.

Optional on any of the three: --registration <path>, --launch-authorization <path>, --expected-source-commit <sha>.

Execution preflight makes zero model calls and writes nothing. Live execution requires a launch authorization whose
design fingerprint matches the registration. --expected-source-commit is optional; give it to re-check the frozen
closure bytes against a commit, omit it and the run records its source provenance instead.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return void console.log(usage());
  if (args.preflight) {
    const registrationPath = args.registration || REGISTRATION;
    const loaded = loadTutorStubBoredomProofDagStudy({
      registrationPath: repoPath(registrationPath, 'registration'),
    });
    const contractPath = args['endpoint-contract'] || endpointContractFor(registrationPath);
    const contract = readJson(repoPath(contractPath, 'endpoint contract'));
    console.log(
      JSON.stringify(
        runTutorStubBoredomProofDagEndpointPreflight({ contract, registration: loaded.registration, registrationPath }),
        null,
        2,
      ),
    );
    return;
  }
  if (!args.destination) throw new Error(usage());
  const destination = path.resolve(ROOT, args.destination);
  if (args['seal-registered-stops']) {
    console.log(JSON.stringify(sealTutorStubBoredomProofDagBatchWithRegisteredStops({ destination }), null, 2));
    return;
  }
  if (args['recover-batch']) {
    const result = await recoverTutorStubBoredomProofDagBatch({
      destination,
      expectedSourceCommit: args['expected-source-commit'],
      parallelism: Number(args.parallelism),
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'complete') process.exitCode = 1;
    return;
  }
  if (!args.batch) throw new Error(usage());
  if (args['execution-preflight']) {
    if (fs.existsSync(destination)) throw new Error('boredom proof-DAG preflight destination must be absent');
    const plan = buildTutorStubBoredomProofDagBatchPlan({
      registrationPath: args.registration || REGISTRATION,
      batchId: args.batch,
      destination,
      expectedSourceCommit: args['expected-source-commit'],
    });
    console.log(JSON.stringify({ ...plan, model_calls: 0, production_writes: 0 }, null, 2));
    return;
  }
  if (!args['live-batch']) throw new Error(usage());
  const result = await runTutorStubBoredomProofDagBatch({
    registrationPath: args.registration || REGISTRATION,
    batchId: args.batch,
    destination,
    parallelism: Number(args.parallelism),
    expectedSourceCommit: args['expected-source-commit'],
    launchAuthorizationPath: args['launch-authorization'],
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'complete') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
