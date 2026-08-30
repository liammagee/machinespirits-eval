import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

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

export function paidStudyGoNoteIssues({ text, designPath, launchCommit, spendCap }) {
  const issues = [];
  const firstNonblank = String(text)
    .split(/\r?\n/u)
    .find((line) => line.trim());
  if (firstNonblank?.trim() !== 'GO') issues.push('go_token');
  if (!String(text).includes(designPath)) issues.push('design_path');
  if (!String(text).includes(launchCommit)) issues.push('launch_commit');
  if (!numericTokens(String(text)).some((value) => value === spendCap)) issues.push('spend_cap');
  return issues;
}

export function verifyPaidStudyLaunchContract({
  root,
  designPath,
  launchCommit,
  goNoteCommit,
  goNotePath,
  spendCap,
  mainRef = 'origin/main',
}) {
  const repositoryRoot = path.resolve(root || '');
  if (!root || !fs.statSync(repositoryRoot).isDirectory()) throw new Error('repository root must be a directory');
  const design = repositoryRelativePath(repositoryRoot, designPath, 'design path');
  const note = repositoryRelativePath(repositoryRoot, goNotePath, 'GO note path');
  if (!note.relative.startsWith('notes/')) throw new Error('GO note path must be under notes/');
  if (!Number.isFinite(spendCap) || spendCap < 0) throw new Error('spend cap must be a non-negative number');

  const resolvedLaunchCommit = resolveCommit(repositoryRoot, launchCommit, 'launch commit');
  const headCommit = resolveCommit(repositoryRoot, 'HEAD', 'HEAD');
  if (headCommit !== resolvedLaunchCommit) {
    throw new Error(`launch commit drift: expected ${resolvedLaunchCommit}, found ${headCommit}`);
  }
  if (git(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all']).trim()) {
    throw new Error('paid study launch requires a clean checkout');
  }
  try {
    const branch = git(repositoryRoot, ['symbolic-ref', '-q', '--short', 'HEAD']).trim();
    if (branch) throw new Error(`paid study launch requires detached HEAD, found ${branch}`);
  } catch (error) {
    if (error?.status !== 1) throw error;
  }

  let committedDesign;
  try {
    committedDesign = git(repositoryRoot, ['show', `${resolvedLaunchCommit}:${design.relative}`], { encoding: null });
  } catch {
    throw new Error(`launch commit does not contain design file ${design.relative}`);
  }
  const onDiskDesign = fs.readFileSync(design.absolute);
  if (!committedDesign.equals(onDiskDesign)) {
    throw new Error(`launch commit does not contain the checked-out bytes of ${design.relative}`);
  }
  const resolvedMainCommit = resolveCommit(repositoryRoot, mainRef, 'main ref');
  try {
    git(repositoryRoot, ['merge-base', '--is-ancestor', resolvedLaunchCommit, resolvedMainCommit]);
  } catch {
    throw new Error(`launch commit containing the design must be merged into ${mainRef}`);
  }

  const resolvedGoNoteCommit = resolveCommit(repositoryRoot, goNoteCommit, 'GO note commit');
  try {
    git(repositoryRoot, ['merge-base', '--is-ancestor', resolvedLaunchCommit, resolvedGoNoteCommit]);
  } catch {
    throw new Error('GO note commit must descend from the launch commit');
  }
  let goNoteText;
  try {
    goNoteText = git(repositoryRoot, ['show', `${resolvedGoNoteCommit}:${note.relative}`]);
  } catch {
    throw new Error(`GO note commit does not contain ${note.relative}`);
  }
  const issues = paidStudyGoNoteIssues({
    text: goNoteText,
    designPath: design.relative,
    launchCommit: resolvedLaunchCommit,
    spendCap,
  });
  if (issues.length) throw new Error(`signed GO note does not satisfy the standing contract: ${issues.join(', ')}`);

  return {
    source: {
      commit: resolvedLaunchCommit,
      tree: git(repositoryRoot, ['rev-parse', `${resolvedLaunchCommit}^{tree}`]).trim(),
      detached: true,
      dirty: false,
      main_ref: mainRef,
      main_commit: resolvedMainCommit,
    },
    design: { path: design.relative },
    authorization: { commit: resolvedGoNoteCommit, path: note.relative },
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

function validateStudyLedger({ events, studyId, spendCap, recoveryFrom }) {
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
  if (lastSealIndex < lastLaunchIndex || seal?.destination !== recoveryFrom || seal?.recovery_permitted !== true) {
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
  ...contract
}) {
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
  let closed = false;
  const ensureOpen = () => {
    if (closed) throw new Error('paid study run ledger is closed');
  };
  appendJsonLine(ledger, {
    type: 'launch_admitted',
    source_commit: verified.source.commit,
    source_tree: verified.source.tree,
    design_path: verified.design.path,
    go_note: verified.authorization,
    spend_cap: verified.spend_cap,
    study_id: studyId,
    study_ledger: lease.studyLedgerPath,
    launch_kind: resolvedRecoveryFrom ? 'recovery' : 'initial',
    ...(resolvedRecoveryFrom ? { recovery_from: resolvedRecoveryFrom } : {}),
  });
  appendJsonLine(studyLedger, {
    type: 'study_launch_admitted',
    study_id: studyId,
    destination: resolvedDestination,
    run_ledger: ledgerPath,
    launch_kind: resolvedRecoveryFrom ? 'recovery' : 'initial',
    ...(resolvedRecoveryFrom ? { recovery_from: resolvedRecoveryFrom } : {}),
    reserved_before_launch: studyReserved,
    model_attempt_ceiling: verified.spend_cap,
  });

  return {
    ...verified,
    study_id: studyId,
    study_ledger_path: lease.studyLedgerPath,
    destination: resolvedDestination,
    ledger_path: ledgerPath,
    get reserved() {
      return reserved;
    },
    get studyReserved() {
      return studyReserved;
    },
    reserveModelAttempts(count = 1, detail = {}) {
      ensureOpen();
      if (!Number.isInteger(count) || count < 1)
        throw new Error('model-attempt reservation must be a positive integer');
      if (studyReserved + count > verified.spend_cap) {
        appendJsonLine(ledger, {
          ...detail,
          type: 'model_attempt_reservation_rejected',
          requested: count,
          reserved,
          study_reserved: studyReserved,
          spend_cap: verified.spend_cap,
        });
        appendJsonLine(studyLedger, {
          ...detail,
          type: 'study_model_attempt_reservation_rejected',
          destination: resolvedDestination,
          requested: count,
          study_reserved: studyReserved,
          model_attempt_ceiling: verified.spend_cap,
        });
        throw new Error(`paid study spend cap exceeded before call: ${studyReserved + count}/${verified.spend_cap}`);
      }
      studyReserved += count;
      appendJsonLine(studyLedger, {
        ...detail,
        type: 'study_model_attempt_reserved',
        destination: resolvedDestination,
        count,
        study_reserved: studyReserved,
        model_attempt_ceiling: verified.spend_cap,
      });
      reserved += count;
      appendJsonLine(ledger, {
        ...detail,
        type: 'model_attempt_reserved',
        count,
        reserved,
        study_reserved: studyReserved,
        spend_cap: verified.spend_cap,
      });
      return {
        reserved,
        remaining: verified.spend_cap - studyReserved,
        study_reserved: studyReserved,
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
      if (event.recovery_permitted === true && !['technical_failure', 'transport_failure'].includes(event.status)) {
        throw new Error('only a sealed technical failure may permit recovery');
      }
      appendJsonLine(ledger, event);
      appendJsonLine(studyLedger, {
        type: 'study_run_sealed',
        destination: resolvedDestination,
        run_ledger: ledgerPath,
        run_event_type: event.type,
        status: event.status || null,
        recovery_permitted: event.recovery_permitted === true,
        reserved_in_run: reserved,
        study_reserved: studyReserved,
        model_attempt_ceiling: verified.spend_cap,
      });
      fs.closeSync(ledger);
      fs.closeSync(studyLedger);
      releaseStudyLease(lease);
      closed = true;
    },
  };
}
