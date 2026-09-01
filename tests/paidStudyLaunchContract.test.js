import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  admitPaidStudyLaunch,
  paidStudyGoNoteIssues,
  sealInterruptedPaidStudyLaunch,
  verifyPaidStudyLaunchContract,
} from '../services/paidStudyLaunchContract.js';

const RACE_WORKER = fileURLToPath(new URL('./fixtures/paidStudyLaunchRaceWorker.js', import.meta.url));

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function fixture(t, { cap = 1200, noteCap = '1,200', firstLine = 'GO' } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-study-contract-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'repo');
  fs.mkdirSync(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', 'Fixture');
  git(root, 'config', 'user.email', 'fixture@example.test');
  fs.mkdirSync(path.join(root, 'config'));
  fs.writeFileSync(path.join(root, 'config', 'study.json'), '{"study":"fixture"}\n');
  git(root, 'add', 'config/study.json');
  git(root, 'commit', '-qm', 'design');
  const launchCommit = git(root, 'rev-parse', 'HEAD');
  fs.mkdirSync(path.join(root, 'notes'));
  fs.writeFileSync(
    path.join(root, 'notes', 'go.md'),
    `${firstLine}\n\nDesign: config/study.json\nLaunch commit: ${launchCommit}\nSpend cap: ${noteCap}\n`,
  );
  git(root, 'add', 'notes/go.md');
  git(root, 'commit', '-qm', 'go note');
  const goNoteCommit = git(root, 'rev-parse', 'HEAD');
  git(root, 'update-ref', 'refs/remotes/origin/main', goNoteCommit);
  git(root, 'checkout', '--detach', '-q', launchCommit);
  return {
    base,
    root,
    launchCommit,
    goNoteCommit,
    contract: {
      root,
      designPath: 'config/study.json',
      launchCommit,
      goNoteCommit,
      goNotePath: 'notes/go.md',
      spendCap: cap,
      studyId: 'fixture-study',
      studyStateRoot: path.join(base, 'study-state'),
    },
  };
}

async function runRace(value, configs) {
  const startFile = path.join(value.base, `start-${Date.now()}`);
  const children = configs.map((config, index) => {
    const configPath = path.join(value.base, `worker-${Date.now()}-${index}.json`);
    fs.writeFileSync(configPath, `${JSON.stringify({ ...config, startFile })}\n`);
    return spawn(process.execPath, [RACE_WORKER, configPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  });
  fs.writeFileSync(startFile, 'go\n');
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve, reject) => {
          let stderr = '';
          child.stderr.on('data', (chunk) => {
            stderr += chunk;
          });
          child.once('error', reject);
          child.once('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`race worker exited ${code}: ${stderr}`));
          });
        }),
    ),
  );
}

function raceConfig({ value, destination, resultFile, providerLog, unit, recoveryFrom, closeEvent }) {
  return {
    admission: {
      ...value.contract,
      destination,
      studyId: 'fixture-study',
      studyStateRoot: path.join(value.base, 'study-state'),
      ...(recoveryFrom ? { recoveryFrom } : {}),
    },
    reserveCount: 1,
    unit,
    providerLog,
    resultFile,
    holdMilliseconds: 100,
    closeEvent,
  };
}

test('standing contract accepts a clean detached launch and separator-tolerant cap', (t) => {
  const value = fixture(t);
  const verified = verifyPaidStudyLaunchContract(value.contract);
  assert.equal(verified.source.commit, value.launchCommit);
  assert.equal(verified.source.detached, true);
  assert.equal(verified.design.path, 'config/study.json');
  assert.equal(verified.spend_cap, 1200);
  assert.deepEqual(
    paidStudyGoNoteIssues({
      text: '\nGO\nconfig/study.json\n1_200\n',
      designPath: 'config/study.json',
      spendCap: 1200,
    }),
    [],
  );
});

test('standing contract rejects branch, dirt, changed design bytes, ancestry, GO position, and cap drift', (t) => {
  const branched = fixture(t);
  git(branched.root, 'checkout', '-q', '-b', 'launch-branch');
  assert.throws(() => verifyPaidStudyLaunchContract(branched.contract), /detached HEAD/u);

  const dirty = fixture(t);
  fs.writeFileSync(path.join(dirty.root, 'untracked.txt'), 'dirty\n');
  assert.throws(() => verifyPaidStudyLaunchContract(dirty.contract), /clean checkout/u);

  const changed = fixture(t);
  fs.writeFileSync(path.join(changed.root, 'config', 'study.json'), '{"study":"changed"}\n');
  assert.throws(() => verifyPaidStudyLaunchContract(changed.contract), /clean checkout/u);

  const hiddenChange = fixture(t);
  git(hiddenChange.root, 'update-index', '--assume-unchanged', 'config/study.json');
  fs.writeFileSync(path.join(hiddenChange.root, 'config', 'study.json'), '{"study":"hidden-change"}\n');
  assert.throws(() => verifyPaidStudyLaunchContract(hiddenChange.contract), /checked-out bytes/u);

  const wrongGo = fixture(t, { firstLine: '# approval' });
  assert.throws(() => verifyPaidStudyLaunchContract(wrongGo.contract), /go_token/u);

  const wrongCap = fixture(t, { cap: 1201 });
  assert.throws(() => verifyPaidStudyLaunchContract(wrongCap.contract), /spend_cap/u);

  const missingNote = fixture(t);
  const sibling = git(missingNote.root, 'commit-tree', `${missingNote.launchCommit}^{tree}`, '-m', 'sibling');
  assert.throws(
    () => verifyPaidStudyLaunchContract({ ...missingNote.contract, goNoteCommit: sibling }),
    /does not contain/u,
  );

  const unmerged = fixture(t);
  const unmergedMain = git(unmerged.root, 'commit-tree', `${unmerged.launchCommit}^{tree}`, '-m', 'unrelated main');
  git(unmerged.root, 'update-ref', 'refs/remotes/origin/main', unmergedMain);
  assert.throws(() => verifyPaidStudyLaunchContract(unmerged.contract), /must be merged/u);
});

test('the original study GO remains valid after a merged technical code fix', (t) => {
  const value = fixture(t, { cap: 3, noteCap: '3' });
  git(value.root, 'checkout', '--detach', '-q', value.goNoteCommit);
  fs.writeFileSync(path.join(value.root, 'recovery-fix.txt'), 'mechanical fix\n');
  git(value.root, 'add', 'recovery-fix.txt');
  git(value.root, 'commit', '-qm', 'technical recovery fix');
  const recoveryCommit = git(value.root, 'rev-parse', 'HEAD');
  git(value.root, 'update-ref', 'refs/remotes/origin/main', recoveryCommit);

  const verified = verifyPaidStudyLaunchContract({
    ...value.contract,
    launchCommit: recoveryCommit,
  });
  assert.equal(verified.source.commit, recoveryCommit);
  assert.equal(verified.authorization.commit, value.goNoteCommit);
  assert.equal(verified.authorization.path, 'notes/go.md');
});

test('admission creates the destination and append-only budget ledger before calls', (t) => {
  const value = fixture(t, { cap: 2, noteCap: '2' });
  const destination = path.join(value.base, 'run');
  const admitted = admitPaidStudyLaunch({ ...value.contract, destination });
  assert.equal(fs.existsSync(destination), true);
  assert.equal(fs.existsSync(admitted.ledger_path), true);
  assert.deepEqual(admitted.reserveModelAttempts(1, { unit: 'a' }), {
    reserved: 1,
    remaining: 1,
    study_reserved: 1,
  });
  assert.deepEqual(admitted.reserveModelAttempts(1, { unit: 'b' }), {
    reserved: 2,
    remaining: 0,
    study_reserved: 2,
  });
  assert.throws(() => admitted.reserveModelAttempts(1, { unit: 'c' }), /exceeded before call/u);
  admitted.record({ type: 'unit_failed', unit: 'b' });
  admitted.close({ type: 'run_sealed', status: 'failed' });

  const rows = fs.readFileSync(admitted.ledger_path, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(
    rows.map((row) => row.type),
    [
      'launch_admitted',
      'model_attempt_reserved',
      'model_attempt_reserved',
      'model_attempt_reservation_rejected',
      'unit_failed',
      'run_sealed',
    ],
  );
  assert.equal(admitted.reserved, 2);
  assert.throws(() => admitPaidStudyLaunch({ ...value.contract, destination }), /create-once/u);
});

test('failed authorization performs no production write', (t) => {
  const value = fixture(t, { cap: 3, noteCap: '2' });
  const destination = path.join(value.base, 'must-not-exist');
  assert.throws(() => admitPaidStudyLaunch({ ...value.contract, destination }), /spend_cap/u);
  assert.equal(fs.existsSync(destination), false);
});

test('two processes racing on one study admit exactly one before a fake provider call', async (t) => {
  const value = fixture(t, { cap: 3, noteCap: '3' });
  const providerLog = path.join(value.base, 'provider-calls.log');
  const resultFiles = [path.join(value.base, 'race-a.json'), path.join(value.base, 'race-b.json')];
  await runRace(
    value,
    resultFiles.map((resultFile, index) =>
      raceConfig({
        value,
        destination: path.join(value.base, `race-run-${index}`),
        resultFile,
        providerLog,
        unit: `fresh-${index}`,
        closeEvent: { type: 'run_sealed', status: 'complete' },
      }),
    ),
  );

  const results = resultFiles.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  assert.equal(results.filter((result) => result.status === 'admitted').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.match(results.find((result) => result.status === 'rejected').error, /active launch|duplicate fresh launch/u);
  assert.equal(fs.readFileSync(providerLog, 'utf8').trim().split('\n').length, 1);
  assert.equal(
    [path.join(value.base, 'race-run-0'), path.join(value.base, 'race-run-1')].filter((destination) =>
      fs.existsSync(destination),
    ).length,
    1,
  );
});

test('a recovery cannot reserve beyond the remaining aggregate study ceiling', (t) => {
  const value = fixture(t, { cap: 3, noteCap: '3' });
  const initialDestination = path.join(value.base, 'aggregate-initial');
  const initial = admitPaidStudyLaunch({ ...value.contract, destination: initialDestination });
  initial.reserveModelAttempts(2, { unit: 'initial' });
  initial.close({ type: 'run_sealed', status: 'technical_failure', recovery_permitted: true });

  const recovery = admitPaidStudyLaunch({
    ...value.contract,
    destination: path.join(value.base, 'aggregate-recovery'),
    recoveryFrom: initialDestination,
  });
  assert.equal(recovery.studyReserved, 2);
  assert.throws(() => recovery.reserveModelAttempts(2, { unit: 'too-large' }), /exceeded before call/u);
  assert.equal(recovery.reserved, 0);
  assert.equal(recovery.studyReserved, 2);
  recovery.close({ type: 'run_sealed', status: 'failed' });
});

test('a dead interrupted launcher can be sealed once without rewriting its ledgers', (t) => {
  const value = fixture(t, { cap: 3, noteCap: '3' });
  const destination = path.join(value.base, 'interrupted-run');
  const initial = admitPaidStudyLaunch({ ...value.contract, destination });
  initial.reserveModelAttempts(2, { unit: 'interrupted-unit' });
  const leasePath = path.join(value.contract.studyStateRoot, 'fixture-study', 'active-lease', 'lease.json');

  assert.throws(
    () =>
      sealInterruptedPaidStudyLaunch({
        studyId: 'fixture-study',
        studyStateRoot: value.contract.studyStateRoot,
        destination,
        reason: 'fixture interrupt',
        isProcessAlive: () => true,
      }),
    /still active/u,
  );
  assert.equal(fs.existsSync(leasePath), true);

  const sealed = sealInterruptedPaidStudyLaunch({
    studyId: 'fixture-study',
    studyStateRoot: value.contract.studyStateRoot,
    destination,
    reason: 'fixture interrupt',
    isProcessAlive: () => false,
  });
  assert.equal(sealed.status, 'technical_failure');
  assert.equal(sealed.recovery_permitted, true);
  assert.equal(sealed.reserved_in_run, 2);
  assert.equal(sealed.study_reserved, 2);
  assert.equal(fs.existsSync(leasePath), false);

  const runEvents = fs.readFileSync(initial.ledger_path, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(
    runEvents.map((event) => event.type),
    ['launch_admitted', 'model_attempt_reserved', 'run_sealed'],
  );
  assert.equal(runEvents.at(-1).reason, 'fixture interrupt');
  const studyEvents = fs
    .readFileSync(path.join(value.contract.studyStateRoot, 'fixture-study', 'study-ledger.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  assert.equal(studyEvents.at(-1).type, 'study_run_sealed');
  assert.equal(studyEvents.at(-1).reason, 'fixture interrupt');

  assert.throws(
    () =>
      sealInterruptedPaidStudyLaunch({
        studyId: 'fixture-study',
        studyStateRoot: value.contract.studyStateRoot,
        destination,
        reason: 'duplicate closeout',
        isProcessAlive: () => false,
      }),
    /no active launch/u,
  );

  const recovery = admitPaidStudyLaunch({
    ...value.contract,
    destination: path.join(value.base, 'interrupted-recovery'),
    recoveryFrom: destination,
  });
  assert.equal(recovery.studyReserved, 2);
  recovery.reserveModelAttempts(1, { unit: 'remaining-unit' });
  recovery.close({ type: 'run_sealed', status: 'complete' });
});

test('a sealed technical predecessor hands its remaining study budget to one recovery', async (t) => {
  const value = fixture(t, { cap: 3, noteCap: '3' });
  const studyStateRoot = path.join(value.base, 'study-state');
  const initialDestination = path.join(value.base, 'initial-run');
  const initial = admitPaidStudyLaunch({
    ...value.contract,
    destination: initialDestination,
    studyId: 'fixture-study',
    studyStateRoot,
  });
  initial.reserveModelAttempts(2, { unit: 'initial' });
  initial.close({
    type: 'run_sealed',
    status: 'transport_failure',
    recovery_permitted: true,
  });

  const providerLog = path.join(value.base, 'recovery-provider-calls.log');
  const resultFiles = [path.join(value.base, 'recovery-a.json'), path.join(value.base, 'recovery-b.json')];
  const recoveryDestinations = [path.join(value.base, 'recovery-a'), path.join(value.base, 'recovery-b')];
  await runRace(
    value,
    resultFiles.map((resultFile, index) =>
      raceConfig({
        value,
        destination: recoveryDestinations[index],
        resultFile,
        providerLog,
        unit: `recovery-${index}`,
        recoveryFrom: initialDestination,
        closeEvent: { type: 'run_sealed', status: 'complete' },
      }),
    ),
  );

  const results = resultFiles.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  assert.equal(results.filter((result) => result.status === 'admitted').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(fs.readFileSync(providerLog, 'utf8').trim().split('\n').length, 1);

  assert.throws(
    () =>
      admitPaidStudyLaunch({
        ...value.contract,
        destination: path.join(value.base, 'duplicate-fresh'),
        studyId: 'fixture-study',
        studyStateRoot,
      }),
    /duplicate fresh launch/u,
  );
  assert.throws(
    () =>
      admitPaidStudyLaunch({
        ...value.contract,
        destination: path.join(value.base, 'second-recovery'),
        studyId: 'fixture-study',
        studyStateRoot,
        recoveryFrom: initialDestination,
      }),
    /recovery|sealed technical predecessor/u,
  );

  const studyLedger = fs
    .readFileSync(path.join(studyStateRoot, 'fixture-study', 'study-ledger.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  assert.equal(
    studyLedger
      .filter((event) => event.type === 'study_model_attempt_reserved')
      .reduce((sum, event) => sum + event.count, 0),
    3,
  );
  assert.equal(studyLedger.filter((event) => event.type === 'study_launch_admitted').length, 2);
});

test('one recovery may continue after a sealed pre-provider startup failure', (t) => {
  const value = fixture(t, { cap: 3, noteCap: '3' });
  const initialDestination = path.join(value.base, 'zero-call-initial');
  const initial = admitPaidStudyLaunch({ ...value.contract, destination: initialDestination });
  initial.reserveModelAttempts(1, { unit: 'initial-unit' });
  initial.close({ type: 'run_sealed', status: 'technical_failure', recovery_permitted: true });

  const failedRecoveryDestination = path.join(value.base, 'zero-call-recovery');
  const failedRecovery = admitPaidStudyLaunch({
    ...value.contract,
    destination: failedRecoveryDestination,
    recoveryFrom: initialDestination,
  });
  failedRecovery.reserveModelAttempts(1, { unit: 'startup-failure-unit' });
  failedRecovery.record({
    type: 'unit_complete',
    job_id: 'startup-failure-unit',
    status: 'technical_failure',
    child_reserved_attempts: 0,
    child_completed_attempts: 0,
    child_failed_attempts: 0,
    shared_reserved_attempts: 1,
  });
  failedRecovery.close({ type: 'run_sealed', status: 'technical_failure', reserved_attempts: 1 });

  const finalRecovery = admitPaidStudyLaunch({
    ...value.contract,
    destination: path.join(value.base, 'zero-call-final-recovery'),
    recoveryFrom: failedRecoveryDestination,
  });
  assert.equal(finalRecovery.studyReserved, 2);
  finalRecovery.reserveModelAttempts(1, { unit: 'remaining-unit' });
  finalRecovery.close({ type: 'run_sealed', status: 'complete' });
});

test('a recovery with any child model attempt cannot use the startup exception', (t) => {
  const value = fixture(t, { cap: 3, noteCap: '3' });
  const initialDestination = path.join(value.base, 'child-call-initial');
  const initial = admitPaidStudyLaunch({ ...value.contract, destination: initialDestination });
  initial.reserveModelAttempts(1, { unit: 'initial-unit' });
  initial.close({ type: 'run_sealed', status: 'technical_failure', recovery_permitted: true });

  const failedRecoveryDestination = path.join(value.base, 'child-call-recovery');
  const failedRecovery = admitPaidStudyLaunch({
    ...value.contract,
    destination: failedRecoveryDestination,
    recoveryFrom: initialDestination,
  });
  failedRecovery.reserveModelAttempts(1, { unit: 'child-call-unit' });
  failedRecovery.record({
    type: 'unit_complete',
    job_id: 'child-call-unit',
    status: 'technical_failure',
    child_reserved_attempts: 1,
    child_completed_attempts: 1,
    child_failed_attempts: 0,
    shared_reserved_attempts: 1,
  });
  failedRecovery.close({ type: 'run_sealed', status: 'technical_failure', reserved_attempts: 1 });

  assert.throws(
    () =>
      admitPaidStudyLaunch({
        ...value.contract,
        destination: path.join(value.base, 'child-call-final-recovery'),
        recoveryFrom: failedRecoveryDestination,
      }),
    /sealed technical predecessor/u,
  );
});

test('a repeated pre-provider startup failure cannot open another recovery', (t) => {
  const value = fixture(t, { cap: 4, noteCap: '4' });
  const initialDestination = path.join(value.base, 'repeated-zero-call-initial');
  const initial = admitPaidStudyLaunch({ ...value.contract, destination: initialDestination });
  initial.reserveModelAttempts(1, { unit: 'initial-unit' });
  initial.close({ type: 'run_sealed', status: 'technical_failure', recovery_permitted: true });

  const sealZeroCallFailure = (destination, recoveryFrom, unit) => {
    const launch = admitPaidStudyLaunch({ ...value.contract, destination, recoveryFrom });
    launch.reserveModelAttempts(1, { unit });
    launch.record({
      type: 'unit_complete',
      job_id: unit,
      status: 'technical_failure',
      child_reserved_attempts: 0,
      child_completed_attempts: 0,
      child_failed_attempts: 0,
      shared_reserved_attempts: 1,
    });
    launch.close({ type: 'run_sealed', status: 'technical_failure', reserved_attempts: 1 });
  };
  const firstRecovery = path.join(value.base, 'repeated-zero-call-recovery-1');
  sealZeroCallFailure(firstRecovery, initialDestination, 'startup-failure-1');
  const secondRecovery = path.join(value.base, 'repeated-zero-call-recovery-2');
  sealZeroCallFailure(secondRecovery, firstRecovery, 'startup-failure-2');

  assert.throws(
    () =>
      admitPaidStudyLaunch({
        ...value.contract,
        destination: path.join(value.base, 'repeated-zero-call-recovery-3'),
        recoveryFrom: secondRecovery,
      }),
    /sealed technical predecessor/u,
  );
});
