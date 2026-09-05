import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

import { reconcileSharedModelAttemptLedger, assertNoRetainedResponseRedispatch } from './durableAttemptJournal.js';

function repositoryRelativePath(root, value, label) {
  if (!value || path.isAbsolute(value)) throw new Error(`${label} must be repository-relative`);
  const normalized = path.normalize(value);
  const absolute = path.resolve(root, normalized);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the repository`);
  }
  return { absolute, relative: relative.split(path.sep).join('/') };
}

function git(root, args, options = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options });
}

function resolveCommit(root, value, label) {
  try {
    return git(root, ['rev-parse', '--verify', `${value}^{commit}`]).trim();
  } catch {
    throw new Error(`${label} is not a commit`);
  }
}

function numericTokens(text) {
  return [...text.matchAll(/(?<![\w.])(?:\d{1,3}(?:[,_]\d{3})+|\d+)(?:\.\d+)?(?![\w.])/gu)].map((match) =>
    Number(match[0].replace(/[,_]/gu, '')),
  );
}

export function paidStudyGoNoteIssues({ text, designPath, spendCap }) {
  const issues = [];
  const firstNonblank = String(text)
    .split(/\r?\n/u)
    .find((line) => line.trim());
  if (firstNonblank?.trim() !== 'GO') issues.push('go_token');
  if (!String(text).includes(designPath)) issues.push('design_path');
  if (!numericTokens(String(text)).some((value) => value === spendCap)) issues.push('spend_cap');
  return issues;
}

function blobAt(root, commit, relativePath) {
  try {
    return git(root, ['show', `${commit}:${relativePath}`], { encoding: null });
  } catch {
    return null;
  }
}

function currentBranch(root) {
  try {
    return git(root, ['symbolic-ref', '-q', '--short', 'HEAD']).trim() || null;
  } catch (error) {
    if (error?.status === 1) return null;
    throw error;
  }
}

// The GO given in chat: the user writes GO, the launcher records the words as
// given. The only check is that the first word is GO (trailing punctuation
// allowed, so "GO." and "GO, run it" pass; "NO-GO" and "GOAL" do not).
export function paidStudyChatGoIssues(text) {
  const firstWord = String(text ?? '')
    .trim()
    .split(/\s+/u)[0]
    .replace(/[.,:;!]+$/u, '');
  return firstWord === 'GO' ? [] : ['go_token'];
}

// The standing contract checks the study authorities only: the design file is
// present and merged, and the GO is given for that design and cap. The GO is
// either the words the user wrote in chat (goApproval, recorded as given) or,
// for the older launchers, a note under notes/ at a commit.
// Launch provenance (commit, tree, branch, dirty flag, design bytes) is
// recorded in the returned source/design blocks and never enforced. A dirty
// tree, a branch checkout, or a code commit made after the GO does not stop a
// launch (CLAUDE.md, "NEVER build officious authorization", 2026-08-21).
export function verifyPaidStudyLaunchContract({
  root,
  designPath,
  launchCommit,
  goNoteCommit,
  goNotePath,
  goApproval,
  spendCap,
  mainRef = 'origin/main',
}) {
  const repositoryRoot = path.resolve(root || '');
  if (!root || !fs.statSync(repositoryRoot).isDirectory()) throw new Error('repository root must be a directory');
  const design = repositoryRelativePath(repositoryRoot, designPath, 'design path');
  const note = goNotePath ? repositoryRelativePath(repositoryRoot, goNotePath, 'GO note path') : null;
  if (note && !note.relative.startsWith('notes/')) throw new Error('GO note path must be under notes/');
  if (!note && paidStudyChatGoIssues(goApproval).length) {
    throw new Error('the GO from chat must start with the word GO');
  }
  if (!Number.isFinite(spendCap) || spendCap < 0) throw new Error('spend cap must be a non-negative number');

  if (!fs.existsSync(design.absolute)) throw new Error(`design file ${design.relative} is not in the checkout`);
  const resolvedMainCommit = resolveCommit(repositoryRoot, mainRef, 'main ref');
  const mainDesign = blobAt(repositoryRoot, resolvedMainCommit, design.relative);
  if (mainDesign === null) throw new Error(`design file ${design.relative} must be merged into ${mainRef}`);

  let authorization;
  if (note) {
    const resolvedGoNoteCommit = resolveCommit(repositoryRoot, goNoteCommit, 'GO note commit');
    let goNoteText;
    try {
      goNoteText = git(repositoryRoot, ['show', `${resolvedGoNoteCommit}:${note.relative}`]);
    } catch {
      throw new Error(`GO note commit does not contain ${note.relative}`);
    }
    const issues = paidStudyGoNoteIssues({
      text: goNoteText,
      designPath: design.relative,
      spendCap,
    });
    if (issues.length) throw new Error(`signed GO note does not satisfy the standing contract: ${issues.join(', ')}`);
    authorization = { commit: resolvedGoNoteCommit, path: note.relative };
  } else {
    authorization = { channel: 'chat', text: String(goApproval).trim(), recorded_at: new Date().toISOString() };
  }

  const headCommit = resolveCommit(repositoryRoot, 'HEAD', 'HEAD');
  const namedLaunchCommit = launchCommit ? resolveCommit(repositoryRoot, launchCommit, 'launch commit') : null;
  const branch = currentBranch(repositoryRoot);
  const dirtyEntries = git(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all'])
    .split(/\r?\n/u)
    .filter(Boolean).length;
  const headDesign = blobAt(repositoryRoot, headCommit, design.relative);
  const onDiskDesign = fs.readFileSync(design.absolute);

  return {
    source: {
      commit: headCommit,
      tree: git(repositoryRoot, ['rev-parse', `${headCommit}^{tree}`]).trim(),
      branch,
      detached: branch === null,
      dirty: dirtyEntries > 0,
      dirty_entries: dirtyEntries,
      named_launch_commit: namedLaunchCommit,
      named_launch_commit_is_head: namedLaunchCommit === null ? null : namedLaunchCommit === headCommit,
      main_ref: mainRef,
      main_commit: resolvedMainCommit,
    },
    design: {
      path: design.relative,
      in_head: headDesign !== null,
      checkout_matches_head: headDesign !== null && headDesign.equals(onDiskDesign),
      checkout_matches_main: mainDesign.equals(onDiskDesign),
    },
    authorization,
    spend_cap: spendCap,
  };
}

function appendJsonLine(fileDescriptor, event) {
  fs.writeSync(fileDescriptor, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
  fs.fsyncSync(fileDescriptor);
}

function readJsonLines(filePath, label) {
  if (!fs.existsSync(filePath)) return [];
  try {
    return fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    throw new Error(`${label} is not valid JSONL: ${error.message}`);
  }
}

function validateStudyIdentity({ studyId, studyStateRoot, recoveryFrom }) {
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(studyId || '')) {
    throw new Error('study id must be a stable lowercase identifier');
  }
  if (!studyStateRoot || !path.isAbsolute(studyStateRoot)) {
    throw new Error('study state root must be absolute');
  }
  if (recoveryFrom && !path.isAbsolute(recoveryFrom)) throw new Error('recovery predecessor must be absolute');
}

function isSealedZeroProviderStartupFailure(event) {
  if (
    event?.type !== 'study_run_sealed' ||
    event.status !== 'technical_failure' ||
    event.recovery_permitted === true ||
    !path.isAbsolute(event.destination || '') ||
    !path.isAbsolute(event.run_ledger || '') ||
    path.dirname(path.resolve(event.run_ledger)) !== path.resolve(event.destination)
  ) {
    return false;
  }
  const runEvents = readJsonLines(path.resolve(event.run_ledger), 'zero-provider startup run ledger');
  const launch = runEvents.find((candidate) => candidate.type === 'launch_admitted');
  const reservations = runEvents.filter((candidate) => candidate.type === 'model_attempt_reserved');
  const units = runEvents.filter((candidate) => candidate.type === 'unit_complete');
  const seal = runEvents.at(-1);
  const reservedInRun = reservations.reduce((sum, candidate) => sum + Number(candidate.count || 0), 0);
  return (
    launch?.launch_kind === 'recovery' &&
    reservations.length === 1 &&
    units.length === 1 &&
    reservations[0].unit === units[0].job_id &&
    units[0].status === 'technical_failure' &&
    Number(units[0].child_reserved_attempts) === 0 &&
    Number(units[0].child_completed_attempts) === 0 &&
    Number(units[0].child_failed_attempts) === 0 &&
    Number.isInteger(reservedInRun) &&
    reservedInRun > 0 &&
    Number(units[0].shared_reserved_attempts) === reservedInRun &&
    Number(event.reserved_in_run) === reservedInRun &&
    seal?.type === 'run_sealed' &&
    seal.status === 'technical_failure' &&
    Number(seal.reserved_attempts) === reservedInRun
  );
}

// This is a rejected request option, not a model answer. Keep the accepted shape
// narrow: the provider must explicitly name unsupported JSON-object formatting,
// and there must be no output or token-usage envelope to reinterpret.
export function isResponseFreeJsonModeRejection(request, raw) {
  if (request?.response_format?.type !== 'json_object' || ![400, 405].includes(raw?.status)) return false;
  try {
    const envelope = JSON.parse(raw.body);
    const providerEnvelope = JSON.parse(envelope.error?.metadata?.raw);
    const error = providerEnvelope?.error;
    return (
      Object.keys(envelope).every((key) => ['error', 'user_id'].includes(key)) &&
      Object.keys(providerEnvelope).every((key) => key === 'error') &&
      Object.keys(envelope.error).every((key) => ['code', 'message', 'metadata'].includes(key)) &&
      Object.keys(envelope.error.metadata).every((key) => ['raw', 'provider_name', 'is_byok'].includes(key)) &&
      Object.keys(error).every((key) => ['message', 'type', 'param', 'code'].includes(key)) &&
      envelope.error?.code === raw.status &&
      error?.type === 'invalid_request_error' &&
      error.param === 'response_format' &&
      /^json_object response format is not supported for model: .+$/u.test(error.message)
    );
  } catch {
    return false;
  }
}

function isSealedInitialJsonModeRejection(event, studyEvents) {
  if (
    event?.type !== 'study_run_sealed' ||
    event.status !== 'technical_failure' ||
    event.recovery_permitted !== false ||
    event.reserved_in_run !== 1 ||
    event.study_reserved !== 1 ||
    !path.isAbsolute(event.destination || '') ||
    path.dirname(event.run_ledger || '') !== event.destination ||
    studyEvents.filter((e) => e.type === 'study_launch_admitted').length !== 1 ||
    studyEvents.some((e) => e.type === 'study_model_attempt_reserved') ||
    studyEvents.filter((e) => e.type === 'study_model_attempt_dispatch_reserved').length !== 1
  )
    return false;
  try {
    const events = readJsonLines(event.run_ledger, 'initial JSON-mode rejection');
    const reservations = events.filter((e) => e.type === 'model_attempt_dispatch_reserved');
    const persisted = events.filter((e) => e.type === 'attempt_response_persisted');
    const completed = events.filter((e) => e.type === 'attempt_completed');
    const seal = events.at(-1);
    if (
      events[0]?.launch_kind !== 'initial' ||
      reservations.length !== 1 ||
      persisted.length !== 1 ||
      completed.length !== 1 ||
      events.some((e) => ['model_attempt_reserved', 'job_complete', 'unit_complete'].includes(e.type)) ||
      persisted[0].attempt_id !== reservations[0].attempt_id ||
      completed[0].attempt_id !== reservations[0].attempt_id ||
      seal?.type !== 'run_sealed' ||
      seal.status !== 'technical_failure' ||
      seal.completed_jobs !== 0 ||
      path.dirname(persisted[0].response_path || '') !== path.join(event.destination, 'responses') ||
      !fs.lstatSync(persisted[0].response_path).isFile()
    )
      return false;
    const bytes = fs.readFileSync(persisted[0].response_path);
    if (createHash('sha256').update(bytes).digest('hex') !== persisted[0].response_sha256) return false;
    const bundle = JSON.parse(bytes);
    return (
      bundle.attempt_id === reservations[0].attempt_id && isResponseFreeJsonModeRejection(bundle.request, bundle.raw)
    );
  } catch {
    return false;
  }
}

// A launcher crash in harness code, sealed by the launcher's own catch with
// no stop code, is a technical predecessor when its run ledger shows that no
// dispatched attempt was left without a completed or failed event. No model
// response can then have been lost, so a recovery resumes without resampling.
// Design stops carry a code or set recovery_permitted on purpose and never
// match. The second family's reader loop died this way on 2026-09-05 before
// its first call, and the seal flag alone read it as not recoverable.
function isSealedHarnessCrashWithoutInterruptedDispatch(event) {
  if (
    event?.type !== 'study_run_sealed' ||
    event.status !== 'failed' ||
    event.recovery_permitted !== false ||
    !path.isAbsolute(event.destination || '') ||
    !path.isAbsolute(event.run_ledger || '') ||
    path.dirname(path.resolve(event.run_ledger)) !== path.resolve(event.destination)
  ) {
    return false;
  }
  let runEvents;
  try {
    runEvents = readJsonLines(path.resolve(event.run_ledger), 'harness-crash run ledger');
  } catch {
    return false;
  }
  const seal = runEvents.at(-1);
  if (
    runEvents[0]?.type !== 'launch_admitted' ||
    seal?.type !== 'run_sealed' ||
    seal.status !== 'failed' ||
    seal.recovery_permitted !== false ||
    (seal.code ?? null) !== null ||
    typeof seal.error !== 'string' ||
    !seal.error.trim()
  ) {
    return false;
  }
  const settled = new Set(
    runEvents
      .filter((candidate) => candidate.type === 'attempt_completed' || candidate.type === 'attempt_failed')
      .map((candidate) => candidate.attempt_id),
  );
  if (runEvents.some((candidate) => candidate.type === 'attempt_interrupted_after_dispatch')) return false;
  return runEvents
    .filter((candidate) => candidate.type === 'model_attempt_dispatch_started')
    .every((candidate) => settled.has(candidate.attempt_id));
}

function isSealedReportBackedActionOutcomeFailure(event) {
  if (
    event?.type !== 'study_run_sealed' ||
    event.status !== 'technical_failure' ||
    event.recovery_permitted === true ||
    !path.isAbsolute(event.destination || '') ||
    !path.isAbsolute(event.run_ledger || '') ||
    path.dirname(path.resolve(event.run_ledger)) !== path.resolve(event.destination)
  ) {
    return false;
  }
  const destination = path.resolve(event.destination);
  const reportPath = path.join(destination, 'report.json');
  if (!fs.existsSync(reportPath)) return false;

  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    return false;
  }
  const runEvents = readJsonLines(path.resolve(event.run_ledger), 'report-backed technical-failure run ledger');
  const launches = runEvents.filter((candidate) => candidate.type === 'launch_admitted');
  const reservations = runEvents.filter((candidate) => candidate.type === 'model_attempt_reserved');
  const units = runEvents.filter((candidate) => candidate.type === 'unit_complete');
  const seal = runEvents.at(-1);
  const reportRows = Array.isArray(report.rows) ? report.rows : [];
  const currentRows = reportRows.slice(-units.length);
  const reservedInRun = reservations.reduce((sum, candidate) => sum + Number(candidate.count || 0), 0);
  const priorReserved = Number(report.execution?.model_attempts?.reserved_in_predecessor);
  let cumulativeReserved = 0;
  const aligned = reservations.every((reservation, index) => {
    cumulativeReserved += Number(reservation.count || 0);
    const unit = units[index];
    const row = currentRows[index];
    return (
      Number.isInteger(reservation.count) &&
      reservation.count > 0 &&
      reservation.reserved === cumulativeReserved &&
      unit?.job_id === reservation.unit &&
      unit.status === row?.status &&
      row.job_id === reservation.unit &&
      Number(row.model_attempts?.reserved) === Number(unit.child_reserved_attempts) &&
      Number(row.model_attempts?.completed) === Number(unit.child_completed_attempts) &&
      Number(row.model_attempts?.failed) === Number(unit.child_failed_attempts) &&
      Number(unit.child_reserved_attempts) ===
        Number(unit.child_completed_attempts) + Number(unit.child_failed_attempts) &&
      Number(unit.shared_reserved_attempts) === cumulativeReserved
    );
  });
  return (
    report.schema === 'machinespirits.tutor-stub.action-outcome-collection-generation-report.v1' &&
    report.study_id === launches[0]?.study_id &&
    report.status === 'technical_failure' &&
    report.halt_reason === `technical_failure in ${units.at(-1)?.job_id}` &&
    report.source?.commit === launches[0]?.source_commit &&
    report.design?.path === launches[0]?.design_path &&
    path.resolve(report.recovery?.source_root || '') === path.resolve(launches[0]?.recovery_from || '') &&
    launches.length === 1 &&
    launches[0].launch_kind === 'recovery' &&
    reservations.length > 0 &&
    reservations.length === units.length &&
    currentRows.length === units.length &&
    new Set(reservations.map((candidate) => candidate.unit)).size === reservations.length &&
    units.filter((candidate) => candidate.status === 'technical_failure').length === 1 &&
    units.at(-1)?.status === 'technical_failure' &&
    units.slice(0, -1).every((candidate) => candidate.status === 'complete') &&
    aligned &&
    Number.isInteger(reservedInRun) &&
    reservedInRun > 0 &&
    Number(seal?.reserved_attempts) === reservedInRun &&
    seal?.type === 'run_sealed' &&
    seal.status === 'technical_failure' &&
    Number(event.reserved_in_run) === reservedInRun &&
    Number.isInteger(priorReserved) &&
    priorReserved >= 0 &&
    priorReserved + reservedInRun === Number(event.study_reserved) &&
    Number(report.execution?.model_attempts?.reserved_in_current_run) === reservedInRun &&
    Number(report.execution?.model_attempts?.reserved_by_shared_study_ledger) === Number(event.study_reserved) &&
    Number(report.execution?.model_attempts?.hard_ceiling) === Number(event.model_attempt_ceiling) &&
    Number(report.execution?.missing_units) > 0
  );
}

function writeDurableJsonOnce(filePath, value) {
  const descriptor = fs.openSync(filePath, 'wx');
  try {
    fs.writeSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function acquireStudyLease({ studyId, studyStateRoot, destination }) {
  fs.mkdirSync(studyStateRoot, { recursive: true });
  const studyDirectory = path.join(studyStateRoot, studyId);
  fs.mkdirSync(studyDirectory, { recursive: true });
  const leaseDirectory = path.join(studyDirectory, 'active-lease');
  try {
    fs.mkdirSync(leaseDirectory);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`paid study ${studyId} already has an active launch`);
    }
    throw error;
  }
  const token = randomUUID();
  const leasePath = path.join(leaseDirectory, 'lease.json');
  try {
    writeDurableJsonOnce(leasePath, {
      schema: 'machinespirits.paid-study-active-lease.v1',
      study_id: studyId,
      token,
      destination,
      acquired_at: new Date().toISOString(),
      pid: process.pid,
    });
  } catch (error) {
    fs.rmdirSync(leaseDirectory);
    throw error;
  }
  return {
    token,
    studyDirectory,
    studyLedgerPath: path.join(studyDirectory, 'study-ledger.jsonl'),
    leaseDirectory,
    leasePath,
  };
}

function releaseStudyLease(lease) {
  const recorded = JSON.parse(fs.readFileSync(lease.leasePath, 'utf8'));
  if (recorded.token !== lease.token) throw new Error('paid study lease ownership drift');
  fs.unlinkSync(lease.leasePath);
  fs.rmdirSync(lease.leaseDirectory);
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) throw new Error('paid study lease has an invalid process id');
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    if (error?.code === 'EPERM') return true;
    throw error;
  }
}

export function sealInterruptedPaidStudyLaunch({
  studyId,
  studyStateRoot,
  destination,
  reason,
  isProcessAlive = processIsAlive,
} = {}) {
  validateStudyIdentity({ studyId, studyStateRoot });
  if (!destination || !path.isAbsolute(destination)) throw new Error('interrupted destination must be absolute');
  if (!String(reason || '').trim()) throw new Error('interrupted launch seal requires a reason');

  const resolvedStateRoot = path.resolve(studyStateRoot);
  const resolvedDestination = path.resolve(destination);
  const studyDirectory = path.join(resolvedStateRoot, studyId);
  const activeLeaseDirectory = path.join(studyDirectory, 'active-lease');
  const activeLeasePath = path.join(activeLeaseDirectory, 'lease.json');
  if (!fs.existsSync(activeLeasePath)) throw new Error(`paid study ${studyId} has no active launch to seal`);

  const recorded = JSON.parse(fs.readFileSync(activeLeasePath, 'utf8'));
  if (
    recorded.schema !== 'machinespirits.paid-study-active-lease.v1' ||
    recorded.study_id !== studyId ||
    path.resolve(recorded.destination || '') !== resolvedDestination ||
    !recorded.token
  ) {
    throw new Error('interrupted paid study lease identity drift');
  }
  if (isProcessAlive(recorded.pid)) {
    throw new Error(`paid study ${studyId} launch process ${recorded.pid} is still active`);
  }

  const claimedLeaseDirectory = path.join(studyDirectory, `interrupted-lease-${recorded.token}`);
  fs.renameSync(activeLeaseDirectory, claimedLeaseDirectory);
  const claimedLeasePath = path.join(claimedLeaseDirectory, 'lease.json');
  const studyLedgerPath = path.join(studyDirectory, 'study-ledger.jsonl');
  let runLedger;
  let studyLedger;
  let appendStarted = false;
  try {
    const studyEvents = readJsonLines(studyLedgerPath, 'paid study ledger');
    const launchIndex = studyEvents.findLastIndex((event) => event.type === 'study_launch_admitted');
    const launch = studyEvents[launchIndex];
    const sealIndex = studyEvents.findLastIndex((event) => event.type === 'study_run_sealed');
    if (
      launchIndex < 0 ||
      sealIndex > launchIndex ||
      launch?.study_id !== studyId ||
      path.resolve(launch?.destination || '') !== resolvedDestination ||
      !path.isAbsolute(launch?.run_ledger || '')
    ) {
      throw new Error('interrupted launch does not match the latest unsealed study run');
    }

    const runLedgerPath = path.resolve(launch.run_ledger);
    if (path.dirname(runLedgerPath) !== resolvedDestination) {
      throw new Error('interrupted run ledger is outside its destination');
    }
    let runEvents = readJsonLines(runLedgerPath, 'interrupted run ledger');
    const runLaunch = runEvents.find((event) => event.type === 'launch_admitted');
    if (!runLaunch || runLaunch.study_id !== studyId || runEvents.some((event) => event.type === 'run_sealed')) {
      throw new Error('interrupted run ledger is not one open launch');
    }
    const capacities = runEvents.filter((event) => event.type === 'model_attempt_capacity_allocated');
    for (const capacity of capacities) {
      reconcileSharedModelAttemptLedger({
        runLedgerPath,
        studyLedgerPath,
        capacityId: capacity.capacity_id,
        unitId: capacity.unit,
      });
    }
    runEvents = readJsonLines(runLedgerPath, 'interrupted run ledger after attempt reconciliation');
    const reservedInRun =
      runEvents
        .filter((event) => event.type === 'model_attempt_reserved')
        .reduce((sum, event) => sum + Number(event.count || 0), 0) +
      runEvents.filter((event) => event.type === 'model_attempt_dispatch_reserved').length;
    const refreshedStudyEvents = readJsonLines(studyLedgerPath, 'paid study ledger after attempt reconciliation');
    const studyReserved =
      studyReservedAttempts(refreshedStudyEvents) +
      refreshedStudyEvents.filter((event) => event.type === 'study_model_attempt_dispatch_reserved').length;
    const created = studyEvents.find((event) => event.type === 'study_created');
    if (
      !Number.isInteger(reservedInRun) ||
      reservedInRun < 0 ||
      !Number.isInteger(studyReserved) ||
      studyReserved < reservedInRun ||
      created?.study_id !== studyId ||
      created?.model_attempt_ceiling !== runLaunch.spend_cap
    ) {
      throw new Error('interrupted launch attempt accounting drift');
    }

    runLedger = fs.openSync(runLedgerPath, 'a');
    studyLedger = fs.openSync(studyLedgerPath, 'a');
    appendStarted = true;
    appendJsonLine(runLedger, {
      type: 'run_sealed',
      status: 'technical_failure',
      recovery_permitted: true,
      reason: String(reason).trim(),
      interrupted_pid: recorded.pid,
      reserved_attempts: reservedInRun,
      study_reserved: studyReserved,
    });
    appendJsonLine(studyLedger, {
      type: 'study_run_sealed',
      destination: resolvedDestination,
      run_ledger: runLedgerPath,
      run_event_type: 'run_sealed',
      status: 'technical_failure',
      recovery_permitted: true,
      reserved_in_run: reservedInRun,
      study_reserved: studyReserved,
      model_attempt_ceiling: created.model_attempt_ceiling,
      reason: String(reason).trim(),
      interrupted_pid: recorded.pid,
    });
    fs.closeSync(runLedger);
    runLedger = undefined;
    fs.closeSync(studyLedger);
    studyLedger = undefined;
    releaseStudyLease({
      token: recorded.token,
      leaseDirectory: claimedLeaseDirectory,
      leasePath: claimedLeasePath,
    });
    return {
      study_id: studyId,
      destination: resolvedDestination,
      run_ledger: runLedgerPath,
      study_ledger: studyLedgerPath,
      status: 'technical_failure',
      recovery_permitted: true,
      reserved_in_run: reservedInRun,
      study_reserved: studyReserved,
      model_attempt_ceiling: created.model_attempt_ceiling,
    };
  } catch (error) {
    if (runLedger !== undefined) fs.closeSync(runLedger);
    if (studyLedger !== undefined) fs.closeSync(studyLedger);
    if (!appendStarted && fs.existsSync(claimedLeaseDirectory) && !fs.existsSync(activeLeaseDirectory)) {
      fs.renameSync(claimedLeaseDirectory, activeLeaseDirectory);
    }
    throw error;
  }
}

// OpenRouter rejected routing before returning model content or usage. Fail
// closed on unknown envelope fields; this is not permission to retry answers.
export function isResponseFreeParameterRejection(request, raw) {
  if (
    raw?.status !== 404 ||
    request?.provider?.require_parameters !== true ||
    request.provider.allow_fallbacks !== false ||
    request.provider.only?.length !== 1
  )
    return false;
  try {
    const envelope = JSON.parse(raw.body);
    const error = envelope.error;
    const metadata = error?.metadata;
    return (
      Object.keys(envelope).every((key) => key === 'error') &&
      Object.keys(error).every((key) => ['code', 'message', 'metadata'].includes(key)) &&
      error.code === 404 &&
      error.message.startsWith('No endpoints found that can handle the requested parameters.') &&
      Object.keys(metadata).every((key) => ['routing_funnel', 'failed_routing_step'].includes(key)) &&
      metadata.failed_routing_step === 'Filter by Parameters' &&
      Array.isArray(metadata.routing_funnel) &&
      metadata.routing_funnel.length > 0 &&
      metadata.routing_funnel.every(
        (step) =>
          Object.keys(step).every((key) => ['step', 'endpoint_count'].includes(key)) &&
          typeof step.step === 'string' &&
          Number.isInteger(step.endpoint_count) &&
          step.endpoint_count >= 0,
      )
    );
  } catch {
    return false;
  }
}

// Registered runners can retain a saved response as a terminal invalid job.
// This admits only missing-work continuation: every dispatched predecessor
// attempt must have a journal-matched durable response that is either retained
// or a verified response-free parameter rejection eligible for one replacement.
// Scientific classification remains the caller's responsibility. No old seal
// is edited, and the retained ids become shared fail-before-reservation rules.
function isSealedRetainedResponseFailure(seal, studyEvents, retainedUnits, parameterRejectionUnits) {
  if (
    (!retainedUnits.length && !parameterRejectionUnits.length) ||
    seal?.status !== 'technical_failure' ||
    seal.recovery_permitted !== false ||
    !path.isAbsolute(seal.destination || '') ||
    path.dirname(seal.run_ledger || '') !== seal.destination
  )
    return false;
  try {
    const events = readJsonLines(seal.run_ledger, 'retained-response predecessor');
    const reservations = events.filter((e) => e.type === 'model_attempt_dispatch_reserved');
    const started = events.filter((e) => e.type === 'model_attempt_dispatch_started');
    const persisted = events.filter((e) => e.type === 'attempt_response_persisted');
    const completed = events.filter((e) => e.type === 'attempt_completed');
    const canonical = studyEvents.filter(
      (e) => e.type === 'study_model_attempt_dispatch_reserved' && e.destination === seal.destination,
    );
    const terminal = events.at(-1);
    const launch = events.find((e) => e.type === 'launch_admitted');
    const studyLaunch = studyEvents.findLast((e) => e.type === 'study_launch_admitted');
    if (
      !reservations.length ||
      seal.reserved_in_run !== reservations.length ||
      started.length !== reservations.length ||
      persisted.length !== reservations.length ||
      completed.length !== reservations.length ||
      canonical.length !== reservations.length ||
      terminal?.type !== 'run_sealed' ||
      terminal.status !== seal.status ||
      terminal.recovery_permitted !== false ||
      launch?.study_id !== studyLaunch?.study_id ||
      studyLaunch?.run_ledger !== seal.run_ledger ||
      events.some((e) =>
        [
          'model_attempt_reserved',
          'attempt_failed',
          'attempt_interrupted_after_dispatch',
          'attempt_cancelled_before_dispatch',
        ].includes(e.type),
      ) ||
      new Set(reservations.map((e) => e.unit_id)).size !== reservations.length
    )
      return false;
    return reservations.every((reservation) => {
      const saved = persisted.filter((e) => e.attempt_id === reservation.attempt_id);
      const dispatched = started.filter((e) => e.attempt_id === reservation.attempt_id);
      const done = completed.filter((e) => e.attempt_id === reservation.attempt_id);
      const accounted = canonical.filter(
        (e) =>
          e.attempt_id === reservation.attempt_id &&
          e.unit_id === reservation.unit_id &&
          e.study_reserved === reservation.study_reserved,
      );
      if (
        (!retainedUnits.includes(reservation.unit_id) && !parameterRejectionUnits.includes(reservation.unit_id)) ||
        saved.length !== 1 ||
        dispatched.length !== 1 ||
        done.length !== 1 ||
        accounted.length !== 1 ||
        path.dirname(saved[0].response_path || '') !== path.join(seal.destination, 'responses') ||
        !fs.lstatSync(saved[0].response_path).isFile()
      )
        return false;
      const bytes = fs.readFileSync(saved[0].response_path);
      if (createHash('sha256').update(bytes).digest('hex') !== saved[0].response_sha256) return false;
      if (retainedUnits.includes(reservation.unit_id)) return true;
      const bundle = JSON.parse(bytes);
      // At most one replacement of a response-free rejection. Keep the first
      // reservation charged and refuse another recovery after the replacement.
      return (
        bundle.attempt_id === reservation.attempt_id &&
        bundle.job?.id === reservation.unit_id &&
        isResponseFreeParameterRejection(bundle.request, bundle.raw) &&
        studyEvents.filter(
          (e) => e.type === 'study_model_attempt_dispatch_reserved' && e.unit_id === reservation.unit_id,
        ).length === 1
      );
    });
  } catch {
    return false;
  }
}

function validateStudyLedger({
  events,
  studyId,
  spendCap,
  recoveryFrom,
  retainedResponseUnits,
  parameterRejectionUnits,
}) {
  const created = events.find((event) => event.type === 'study_created');
  if (!created) {
    if (events.length) throw new Error('paid study ledger is missing its creation event');
    if (recoveryFrom) throw new Error('recovery requires a sealed technical predecessor');
    return;
  }
  if (created.study_id !== studyId) throw new Error('paid study ledger identity drift');
  if (created.model_attempt_ceiling !== spendCap) throw new Error('paid study attempt ceiling drift');

  const launches = events.filter((event) => event.type === 'study_launch_admitted');
  if (!recoveryFrom) {
    if (launches.length) throw new Error(`duplicate fresh launch for paid study ${studyId}`);
    return;
  }

  const lastLaunchIndex = events.findLastIndex((event) => event.type === 'study_launch_admitted');
  const lastSealIndex = events.findLastIndex((event) => event.type === 'study_run_sealed');
  const seal = events[lastSealIndex];
  const ordinaryRecovery = seal?.recovery_permitted === true;
  const zeroProviderStartupRecovery = isSealedZeroProviderStartupFailure(seal);
  const reportBackedActionOutcomeRecovery = isSealedReportBackedActionOutcomeFailure(seal);
  const initialJsonModeRecovery = isSealedInitialJsonModeRejection(seal, events);
  const harnessCrashRecovery = isSealedHarnessCrashWithoutInterruptedDispatch(seal);
  const retainedResponseRecovery = isSealedRetainedResponseFailure(
    seal,
    events,
    retainedResponseUnits,
    parameterRejectionUnits,
  );
  const zeroProviderStartupFailures = events.filter(isSealedZeroProviderStartupFailure).length;
  if (
    lastSealIndex < lastLaunchIndex ||
    seal?.destination !== recoveryFrom ||
    (!ordinaryRecovery &&
      !retainedResponseRecovery &&
      !initialJsonModeRecovery &&
      !reportBackedActionOutcomeRecovery &&
      !harnessCrashRecovery &&
      (!zeroProviderStartupRecovery || zeroProviderStartupFailures !== 1))
  ) {
    throw new Error('recovery requires the latest run to be a sealed technical predecessor');
  }
}

function studyReservedAttempts(events) {
  return events
    .filter((event) => event.type === 'study_model_attempt_reserved')
    .reduce((sum, event) => sum + Number(event.count || 0), 0);
}

export function admitPaidStudyLaunch({
  destination,
  ledgerName = 'run-ledger.jsonl',
  studyId,
  studyStateRoot,
  recoveryFrom,
  retainedResponseUnits = [],
  parameterRejectionUnits = [],
  ...contract
}) {
  if (
    !Array.isArray(retainedResponseUnits) ||
    retainedResponseUnits.some((unit) => typeof unit !== 'string' || !unit.trim()) ||
    new Set(retainedResponseUnits).size !== retainedResponseUnits.length ||
    (!recoveryFrom && retainedResponseUnits.length)
  )
    throw new Error('retained response units require unique unit ids and a recovery predecessor');
  if (
    !Array.isArray(parameterRejectionUnits) ||
    parameterRejectionUnits.some(
      (unit) => typeof unit !== 'string' || !unit.trim() || retainedResponseUnits.includes(unit),
    ) ||
    new Set(parameterRejectionUnits).size !== parameterRejectionUnits.length ||
    (!recoveryFrom && parameterRejectionUnits.length)
  )
    throw new Error('parameter rejection units require unique non-retained unit ids and a recovery predecessor');
  if (!destination || !path.isAbsolute(destination)) throw new Error('destination must be absolute');
  if (path.basename(ledgerName) !== ledgerName || !ledgerName.endsWith('.jsonl')) {
    throw new Error('ledger name must be a JSONL filename');
  }
  validateStudyIdentity({ studyId, studyStateRoot, recoveryFrom });
  const verified = verifyPaidStudyLaunchContract(contract);
  if (fs.existsSync(destination)) throw new Error('paid study destination is create-once');

  const resolvedDestination = path.resolve(destination);
  const resolvedRecoveryFrom = recoveryFrom ? path.resolve(recoveryFrom) : null;
  const lease = acquireStudyLease({
    studyId,
    studyStateRoot: path.resolve(studyStateRoot),
    destination: resolvedDestination,
  });
  let studyLedger;
  let ledger;
  let ledgerPath;
  let events;
  try {
    events = readJsonLines(lease.studyLedgerPath, 'paid study ledger');
    validateStudyLedger({
      events,
      studyId,
      spendCap: verified.spend_cap,
      recoveryFrom: resolvedRecoveryFrom,
      retainedResponseUnits,
      parameterRejectionUnits,
    });
    studyLedger = fs.openSync(lease.studyLedgerPath, 'a');
    if (!events.length) {
      appendJsonLine(studyLedger, {
        type: 'study_created',
        study_id: studyId,
        model_attempt_ceiling: verified.spend_cap,
      });
    }
    fs.mkdirSync(path.dirname(resolvedDestination), { recursive: true });
    fs.mkdirSync(resolvedDestination, { recursive: false });
    ledgerPath = path.join(resolvedDestination, ledgerName);
    ledger = fs.openSync(ledgerPath, 'ax');
  } catch (error) {
    if (ledger !== undefined) fs.closeSync(ledger);
    if (studyLedger !== undefined) fs.closeSync(studyLedger);
    releaseStudyLease(lease);
    throw error;
  }
  let reserved = 0;
  let studyReserved = studyReservedAttempts(events);
  const activeCapacities = new Map();
  let closed = false;
  const ensureOpen = () => {
    if (closed) throw new Error('paid study run ledger is closed');
  };
  appendJsonLine(ledger, {
    type: 'launch_admitted',
    source_commit: verified.source.commit,
    source_tree: verified.source.tree,
    source_branch: verified.source.branch,
    source_dirty: verified.source.dirty,
    named_launch_commit: verified.source.named_launch_commit,
    design_path: verified.design.path,
    design_checkout_matches_main: verified.design.checkout_matches_main,
    go_note: verified.authorization,
    spend_cap: verified.spend_cap,
    study_id: studyId,
    study_ledger: lease.studyLedgerPath,
    launch_kind: resolvedRecoveryFrom ? 'recovery' : 'initial',
    ...(resolvedRecoveryFrom ? { recovery_from: resolvedRecoveryFrom } : {}),
    ...(retainedResponseUnits.length ? { retained_response_units: retainedResponseUnits } : {}),
    ...(parameterRejectionUnits.length ? { parameter_rejection_units: parameterRejectionUnits } : {}),
  });
  appendJsonLine(studyLedger, {
    type: 'study_launch_admitted',
    study_id: studyId,
    destination: resolvedDestination,
    run_ledger: ledgerPath,
    launch_kind: resolvedRecoveryFrom ? 'recovery' : 'initial',
    ...(resolvedRecoveryFrom ? { recovery_from: resolvedRecoveryFrom } : {}),
    ...(retainedResponseUnits.length ? { retained_response_units: retainedResponseUnits } : {}),
    ...(parameterRejectionUnits.length ? { parameter_rejection_units: parameterRejectionUnits } : {}),
    reserved_before_launch:
      studyReserved +
      readJsonLines(lease.studyLedgerPath, 'paid study attempt ledger').filter(
        (event) => event.type === 'study_model_attempt_dispatch_reserved',
      ).length,
    model_attempt_ceiling: verified.spend_cap,
  });

  const dispatchReservations = (filePath, type) =>
    readJsonLines(filePath, 'paid study attempt ledger').filter((event) => event.type === type).length;
  const totalStudyReserved = () =>
    studyReserved + dispatchReservations(lease.studyLedgerPath, 'study_model_attempt_dispatch_reserved');
  const totalRunReserved = () => reserved + dispatchReservations(ledgerPath, 'model_attempt_dispatch_reserved');
  const activeCapacityTotal = () => [...activeCapacities.values()].reduce((sum, capacity) => sum + capacity.count, 0);

  return {
    ...verified,
    study_id: studyId,
    study_ledger_path: lease.studyLedgerPath,
    destination: resolvedDestination,
    ledger_path: ledgerPath,
    get reserved() {
      return totalRunReserved();
    },
    get studyReserved() {
      return totalStudyReserved();
    },
    allocateModelAttemptCapacity(count, detail = {}) {
      ensureOpen();
      assertNoRetainedResponseRedispatch(
        readJsonLines(lease.studyLedgerPath, 'paid study ledger'),
        detail.unit_id || detail.unitId || detail.unit,
      );
      if (!Number.isInteger(count) || count < 1) throw new Error('model-attempt capacity must be a positive integer');
      if (totalStudyReserved() + activeCapacityTotal() + count > verified.spend_cap) {
        throw new Error(
          `paid study capacity exceeds the remaining attempt ceiling: ${totalStudyReserved() + activeCapacityTotal() + count}/${verified.spend_cap}`,
        );
      }
      const capacity = { id: randomUUID(), count, detail };
      activeCapacities.set(capacity.id, capacity);
      appendJsonLine(studyLedger, {
        ...detail,
        type: 'study_model_attempt_capacity_allocated',
        destination: resolvedDestination,
        capacity_id: capacity.id,
        count,
        consumed_attempts: totalStudyReserved(),
        model_attempt_ceiling: verified.spend_cap,
      });
      appendJsonLine(ledger, {
        ...detail,
        type: 'model_attempt_capacity_allocated',
        capacity_id: capacity.id,
        count,
        consumed_attempts: totalRunReserved(),
        study_consumed_attempts: totalStudyReserved(),
        spend_cap: verified.spend_cap,
      });
      return Object.freeze({ id: capacity.id, count: capacity.count });
    },
    attemptLedgerEnvironment({ unitId, capacity, maximumTurn = null } = {}) {
      ensureOpen();
      assertNoRetainedResponseRedispatch(readJsonLines(lease.studyLedgerPath, 'paid study ledger'), unitId);
      const registered = activeCapacities.get(capacity?.id);
      if (!unitId || !registered || registered.count !== capacity.count) {
        throw new Error('attempt ledger environment requires one active matching capacity allocation');
      }
      if (maximumTurn !== null && (!Number.isInteger(maximumTurn) || maximumTurn < 1)) {
        throw new Error('attempt ledger environment maximum turn must be a positive integer or null');
      }
      return {
        TUTOR_STUB_SHARED_ATTEMPT_LEDGER: JSON.stringify({
          runLedgerPath: ledgerPath,
          studyLedgerPath: lease.studyLedgerPath,
          studyId,
          destination: resolvedDestination,
          hardCeiling: verified.spend_cap,
          unitId,
          capacityId: registered.id,
          capacityLimit: registered.count,
          maximumTurn,
        }),
      };
    },
    releaseModelAttemptCapacity(capacity, detail = {}) {
      ensureOpen();
      const registered = activeCapacities.get(capacity?.id);
      if (!registered) throw new Error('model-attempt capacity is not active');
      const used = readJsonLines(ledgerPath, 'paid study run ledger').filter(
        (event) => event.type === 'model_attempt_dispatch_reserved' && event.capacity_id === registered.id,
      ).length;
      if (used > registered.count) throw new Error('model-attempt capacity overrun');
      activeCapacities.delete(registered.id);
      appendJsonLine(ledger, {
        ...detail,
        type: 'model_attempt_capacity_released',
        capacity_id: registered.id,
        allocated: registered.count,
        consumed: used,
        unused: registered.count - used,
      });
      appendJsonLine(studyLedger, {
        ...detail,
        type: 'study_model_attempt_capacity_released',
        destination: resolvedDestination,
        capacity_id: registered.id,
        allocated: registered.count,
        consumed: used,
        unused: registered.count - used,
      });
      return { allocated: registered.count, consumed: used, unused: registered.count - used };
    },
    reserveModelAttempts(count = 1, detail = {}) {
      ensureOpen();
      assertNoRetainedResponseRedispatch(
        readJsonLines(lease.studyLedgerPath, 'paid study ledger'),
        detail.unit_id || detail.unitId || detail.unit,
      );
      if (!Number.isInteger(count) || count < 1)
        throw new Error('model-attempt reservation must be a positive integer');
      if (totalStudyReserved() + count > verified.spend_cap) {
        appendJsonLine(ledger, {
          ...detail,
          type: 'model_attempt_reservation_rejected',
          requested: count,
          reserved,
          study_reserved: totalStudyReserved(),
          spend_cap: verified.spend_cap,
        });
        appendJsonLine(studyLedger, {
          ...detail,
          type: 'study_model_attempt_reservation_rejected',
          destination: resolvedDestination,
          requested: count,
          study_reserved: totalStudyReserved(),
          model_attempt_ceiling: verified.spend_cap,
        });
        throw new Error(
          `paid study spend cap exceeded before call: ${totalStudyReserved() + count}/${verified.spend_cap}`,
        );
      }
      studyReserved += count;
      appendJsonLine(studyLedger, {
        ...detail,
        type: 'study_model_attempt_reserved',
        destination: resolvedDestination,
        count,
        study_reserved: totalStudyReserved(),
        model_attempt_ceiling: verified.spend_cap,
      });
      reserved += count;
      appendJsonLine(ledger, {
        ...detail,
        type: 'model_attempt_reserved',
        count,
        reserved,
        study_reserved: totalStudyReserved(),
        spend_cap: verified.spend_cap,
      });
      return {
        reserved,
        remaining: verified.spend_cap - totalStudyReserved(),
        study_reserved: totalStudyReserved(),
      };
    },
    record(event) {
      ensureOpen();
      if (!event || typeof event !== 'object' || Array.isArray(event) || !event.type) {
        throw new Error('ledger event must be an object with a type');
      }
      appendJsonLine(ledger, event);
    },
    close(event = { type: 'launcher_closed' }) {
      if (closed) return;
      if (
        event.recovery_permitted === true &&
        !['technical_failure', 'transport_failure', 'paused_recoverable'].includes(event.status)
      ) {
        throw new Error('only a sealed technical failure or recoverable pause may permit recovery');
      }
      for (const capacity of [...activeCapacities.values()]) {
        reconcileSharedModelAttemptLedger({
          runLedgerPath: ledgerPath,
          studyLedgerPath: lease.studyLedgerPath,
          capacityId: capacity.id,
          unitId: capacity.detail.unit_id || capacity.detail.unit || capacity.id,
        });
        const used = readJsonLines(ledgerPath, 'paid study run ledger').filter(
          (candidate) => candidate.type === 'model_attempt_dispatch_reserved' && candidate.capacity_id === capacity.id,
        ).length;
        activeCapacities.delete(capacity.id);
        appendJsonLine(ledger, {
          type: 'model_attempt_capacity_released',
          capacity_id: capacity.id,
          allocated: capacity.count,
          consumed: used,
          unused: capacity.count - used,
          reason: 'run_closed',
        });
        appendJsonLine(studyLedger, {
          type: 'study_model_attempt_capacity_released',
          destination: resolvedDestination,
          capacity_id: capacity.id,
          allocated: capacity.count,
          consumed: used,
          unused: capacity.count - used,
          reason: 'run_closed',
        });
      }
      appendJsonLine(ledger, event);
      appendJsonLine(studyLedger, {
        type: 'study_run_sealed',
        destination: resolvedDestination,
        run_ledger: ledgerPath,
        run_event_type: event.type,
        status: event.status || null,
        recovery_permitted: event.recovery_permitted === true,
        recoverable: event.recoverable === true,
        resume_scope: event.resume_scope || null,
        reserved_in_run: totalRunReserved(),
        study_reserved: totalStudyReserved(),
        model_attempt_ceiling: verified.spend_cap,
      });
      fs.closeSync(ledger);
      fs.closeSync(studyLedger);
      releaseStudyLease(lease);
      closed = true;
    },
  };
}
