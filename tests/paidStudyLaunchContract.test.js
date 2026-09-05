import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  admitPaidStudyLaunch,
  isResponseFreeJsonModeRejection,
  isResponseFreeParameterRejection,
  paidStudyChatGoIssues,
  paidStudyGoNoteIssues,
  sealInterruptedPaidStudyLaunch,
  verifyPaidStudyLaunchContract,
} from '../services/paidStudyLaunchContract.js';
import {
  createSharedModelAttemptLedgerClient,
  reconcileSharedModelAttemptLedger,
  sharedModelAttemptLedgerClientFromEnv,
} from '../services/durableAttemptJournal.js';

const RACE_WORKER = fileURLToPath(new URL('./fixtures/paidStudyLaunchRaceWorker.js', import.meta.url));

test('JSON-mode rejection recognition excludes answers, usage, refusals and unrelated errors', () => {
  const request = { response_format: { type: 'json_object' } };
  const envelope = {
    error: {
      code: 405,
      metadata: {
        raw: JSON.stringify({
          error: {
            type: 'invalid_request_error',
            param: 'response_format',
            message: 'json_object response format is not supported for model: test-model',
          },
        }),
      },
    },
  };
  const raw = (body, status = 405) => ({ status, body: JSON.stringify(body) });
  assert.equal(isResponseFreeJsonModeRejection(request, raw(envelope)), true);
  for (const body of [
    { ...envelope, choices: [{ message: { content: '{}' } }] },
    { ...envelope, choices: [{ message: { refusal: 'No' } }] },
    { ...envelope, output: 'An answer' },
    { ...envelope, usage: { completion_tokens: 1 } },
    { error: { ...envelope.error, metadata: { ...envelope.error.metadata, output: 'An answer' } } },
    {
      error: {
        ...envelope.error,
        metadata: {
          raw: JSON.stringify({
            error: JSON.parse(envelope.error.metadata.raw).error,
            choices: [{ message: { content: '{}' } }],
          }),
        },
      },
    },
    { error: { code: 405, message: 'Not allowed' } },
  ])
    assert.equal(isResponseFreeJsonModeRejection(request, raw(body)), false);
  assert.equal(isResponseFreeJsonModeRejection({}, raw(envelope)), false);
  assert.equal(isResponseFreeJsonModeRejection(request, raw(envelope, 200)), false);
  assert.equal(isResponseFreeJsonModeRejection(request, raw(envelope, 429)), false);
  assert.equal(isResponseFreeJsonModeRejection(request, { status: 405, body: 'invalid JSON' }), false);
});

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

function retainedResponseFixture(t, responseFor = () => '{"unaccepted_model_answer":"preserve"}\n') {
  const value = fixture(t, { cap: 4, noteCap: '4' });
  const destination = path.join(value.base, 'original');
  const admission = admitPaidStudyLaunch({ ...value.contract, destination });
  const unitId = 'retained-judgment';
  const capacity = admission.allocateModelAttemptCapacity(1, { unit_id: unitId });
  const client = sharedModelAttemptLedgerClientFromEnv(admission.attemptLedgerEnvironment({ unitId, capacity }));
  const reservation = client.reserve();
  client.markDispatched({ attemptId: reservation.attemptId });
  const responsePath = path.join(destination, 'responses', '1.json');
  fs.mkdirSync(path.dirname(responsePath));
  fs.writeFileSync(responsePath, responseFor(reservation.attemptId, unitId));
  client.persistResponse({ attemptId: reservation.attemptId, responsePath });
  client.terminalize({ attemptId: reservation.attemptId, disposition: 'completed' });
  admission.releaseModelAttemptCapacity(capacity);
  admission.close({ type: 'run_sealed', status: 'technical_failure', recovery_permitted: false });
  return { ...value, destination, unitId, responsePath, admission };
}

test('retained-response continuation protects the unit before reservation across later segments and shared clients', (t) => {
  const value = retainedResponseFixture(t);
  const before = fs.readFileSync(value.admission.ledger_path);
  const recoveryDestination = path.join(value.base, 'retained-recovery');
  const recovery = admitPaidStudyLaunch({
    ...value.contract,
    destination: recoveryDestination,
    recoveryFrom: value.destination,
    retainedResponseUnits: [value.unitId],
  });
  assert.equal(recovery.studyReserved, 1);
  assert.throws(
    () => recovery.allocateModelAttemptCapacity(1, { unit_id: value.unitId }),
    /Cannot redispatch retained/,
  );
  assert.throws(() => recovery.reserveModelAttempts(1, { unit: value.unitId }), /Cannot redispatch retained/);
  // A caller omitting the allocation's unit still cannot reserve it through
  // the environment API or directly through the durable shared client.
  const capacity = recovery.allocateModelAttemptCapacity(1);
  assert.throws(
    () => recovery.attemptLedgerEnvironment({ unitId: value.unitId, capacity }),
    /Cannot redispatch retained/,
  );
  const environment = JSON.parse(
    recovery.attemptLedgerEnvironment({ unitId: 'missing-job', capacity }).TUTOR_STUB_SHARED_ATTEMPT_LEDGER,
  );
  const directClient = createSharedModelAttemptLedgerClient({ ...environment, unitId: value.unitId });
  assert.throws(() => directClient.reserve(), /Cannot redispatch retained/);
  assert.equal(recovery.studyReserved, 1);
  recovery.releaseModelAttemptCapacity(capacity);
  recovery.close({ type: 'run_sealed', status: 'paused_recoverable', recovery_permitted: true });
  const later = admitPaidStudyLaunch({
    ...value.contract,
    destination: path.join(value.base, 'later'),
    recoveryFrom: recoveryDestination,
  });
  assert.throws(() => later.allocateModelAttemptCapacity(1, { unitId: value.unitId }), /Cannot redispatch retained/);
  const missingCapacity = later.allocateModelAttemptCapacity(1, { unit_id: 'missing-job' });
  const missingClient = sharedModelAttemptLedgerClientFromEnv(
    later.attemptLedgerEnvironment({ unitId: 'missing-job', capacity: missingCapacity }),
  );
  const missingAttempt = missingClient.reserve();
  assert.equal(later.studyReserved, 2);
  missingClient.terminalize({ attemptId: missingAttempt.attemptId, disposition: 'cancelled_before_dispatch' });
  later.releaseModelAttemptCapacity(missingCapacity);
  later.close({ type: 'run_sealed', status: 'paused_recoverable', recovery_permitted: true });
  assert.deepEqual(fs.readFileSync(value.admission.ledger_path), before);
});

test('parameter-rejection recognition requires response-free routing evidence and excludes answers or usage', () => {
  const request = { provider: { only: ['openai'], allow_fallbacks: false, require_parameters: true } };
  const envelope = {
    error: {
      code: 404,
      message: 'No endpoints found that can handle the requested parameters.',
      metadata: {
        failed_routing_step: 'Filter by Parameters',
        routing_funnel: [{ step: 'Filter by Allowed Providers', endpoint_count: 1 }],
      },
    },
  };
  const raw = (body, status = 404) => ({ status, body: JSON.stringify(body) });
  assert.equal(isResponseFreeParameterRejection(request, raw(envelope)), true);
  for (const body of [
    { ...envelope, choices: [{ message: { content: '{}' } }] },
    { ...envelope, choices: [{ message: { refusal: 'No' } }] },
    { ...envelope, usage: { completion_tokens: 0, cost: 0 } },
    { ...envelope, output: 'answer' },
    { error: { ...envelope.error, metadata: { ...envelope.error.metadata, raw: 'answer' } } },
    {
      error: {
        ...envelope.error,
        metadata: { ...envelope.error.metadata, failed_routing_step: 'Filter by Max Price' },
      },
    },
    { error: { code: 404, message: 'No endpoints found' } },
  ])
    assert.equal(isResponseFreeParameterRejection(request, raw(body)), false);
  assert.equal(isResponseFreeParameterRejection(request, raw(envelope, 200)), false);
  assert.equal(isResponseFreeParameterRejection({}, raw(envelope)), false);
});

test('shared recovery admits a journal-proven parameter rejection once without changing the failed seal', (t) => {
  const raw = {
    status: 404,
    body: JSON.stringify({
      error: {
        code: 404,
        message: 'No endpoints found that can handle the requested parameters.',
        metadata: {
          failed_routing_step: 'Filter by Parameters',
          routing_funnel: [{ step: 'Filter by Allowed Providers', endpoint_count: 1 }],
        },
      },
    }),
  };
  const bundle = (attempt_id, id) =>
    JSON.stringify({
      attempt_id,
      job: { id },
      request: { provider: { only: ['openai'], allow_fallbacks: false, require_parameters: true } },
      raw,
    });
  const value = retainedResponseFixture(t, bundle);
  const before = fs.readFileSync(value.admission.ledger_path);
  const recover = (destination, recoveryFrom = value.destination, parameterRejectionUnits = [value.unitId]) =>
    admitPaidStudyLaunch({ ...value.contract, destination, recoveryFrom, parameterRejectionUnits });
  assert.throws(
    () => recover(path.join(value.base, 'no-opt-in'), value.destination, []),
    /sealed technical predecessor/,
  );
  const saved = fs.readFileSync(value.responsePath);
  fs.writeFileSync(value.responsePath, '{}');
  assert.throws(() => recover(path.join(value.base, 'tampered')), /sealed technical predecessor/);
  fs.writeFileSync(value.responsePath, saved);
  const destination = path.join(value.base, 'recovery');
  const recovery = recover(destination);
  assert.equal(recovery.studyReserved, 1);
  const capacity = recovery.allocateModelAttemptCapacity(1, { unit_id: value.unitId });
  const client = sharedModelAttemptLedgerClientFromEnv(
    recovery.attemptLedgerEnvironment({ unitId: value.unitId, capacity }),
  );
  const reservation = client.reserve();
  client.markDispatched({ attemptId: reservation.attemptId });
  const responsePath = path.join(destination, 'responses', '2.json');
  fs.mkdirSync(path.dirname(responsePath));
  fs.writeFileSync(responsePath, bundle(reservation.attemptId, value.unitId));
  client.persistResponse({ attemptId: reservation.attemptId, responsePath });
  client.terminalize({ attemptId: reservation.attemptId, disposition: 'completed' });
  recovery.releaseModelAttemptCapacity(capacity);
  recovery.close({ type: 'run_sealed', status: 'technical_failure', recovery_permitted: false });
  assert.equal(recovery.studyReserved, 2);
  assert.throws(() => recover(path.join(value.base, 'third'), destination), /sealed technical predecessor/);
  assert.equal(fs.existsSync(path.join(value.base, 'third')), false);
  assert.deepEqual(fs.readFileSync(value.admission.ledger_path), before);
});

test('a failed seal cannot be overridden by a retained-unit list without complete durable response accounting', (t) => {
  const value = retainedResponseFixture(t);
  assert.throws(
    () =>
      admitPaidStudyLaunch({
        ...value.contract,
        destination: path.join(value.base, 'answer-is-not-routing-rejection'),
        recoveryFrom: value.destination,
        parameterRejectionUnits: [value.unitId],
      }),
    /sealed technical predecessor/,
  );
  const ledger = value.admission.ledger_path;
  const studyLedger = value.admission.study_ledger_path;
  const read = (file) => fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
  const write = (file, events) => fs.writeFileSync(file, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  const originalRun = fs.readFileSync(ledger);
  const originalStudy = fs.readFileSync(studyLedger);
  const originalResponse = fs.readFileSync(value.responsePath);
  let index = 0;
  const reject = (retainedResponseUnits = [value.unitId], recoveryFrom = value.destination) => {
    const destination = path.join(value.base, `rejected-${index++}`);
    assert.throws(
      () => admitPaidStudyLaunch({ ...value.contract, destination, recoveryFrom, retainedResponseUnits }),
      /sealed technical predecessor|unique unit ids/,
    );
    assert.equal(fs.existsSync(destination), false);
  };
  reject([]);
  reject(['not-the-retained-unit']);
  reject([value.unitId, value.unitId]);
  reject([value.unitId], path.join(value.base, 'not-latest'));
  fs.writeFileSync(value.responsePath, '{"edited":true}');
  reject();
  fs.rmSync(value.responsePath);
  reject();
  fs.writeFileSync(value.responsePath, originalResponse);
  for (const type of ['model_attempt_dispatch_started', 'attempt_response_persisted', 'attempt_completed']) {
    write(
      ledger,
      read(ledger).filter((e) => e.type !== type),
    );
    reject();
    fs.writeFileSync(ledger, originalRun);
  }
  const events = read(ledger);
  const saved = events.find((e) => e.type === 'attempt_response_persisted');
  saved.attempt_id = 'another-attempt';
  write(ledger, events);
  reject();
  fs.writeFileSync(ledger, originalRun);
  const canonical = read(studyLedger);
  canonical.find((e) => e.type === 'study_model_attempt_dispatch_reserved').unit_id = 'another-unit';
  write(studyLedger, canonical);
  reject();
  fs.writeFileSync(studyLedger, originalStudy);
  const allowed = admitPaidStudyLaunch({
    ...value.contract,
    destination: path.join(value.base, 'after-restoring-fixture'),
    recoveryFrom: value.destination,
    retainedResponseUnits: [value.unitId],
  });
  assert.equal(allowed.studyReserved, 1);
  allowed.close({ type: 'run_sealed', status: 'complete' });
});

test('standing contract accepts a launch, records its provenance, and reads a separator-tolerant cap', (t) => {
  const value = fixture(t);
  const verified = verifyPaidStudyLaunchContract(value.contract);
  assert.equal(verified.source.commit, value.launchCommit);
  assert.equal(verified.source.detached, true);
  assert.equal(verified.source.branch, null);
  assert.equal(verified.source.dirty, false);
  assert.equal(verified.source.dirty_entries, 0);
  assert.equal(verified.source.named_launch_commit, value.launchCommit);
  assert.equal(verified.source.named_launch_commit_is_head, true);
  assert.equal(verified.design.path, 'config/study.json');
  assert.equal(verified.design.in_head, true);
  assert.equal(verified.design.checkout_matches_head, true);
  assert.equal(verified.design.checkout_matches_main, true);
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

test('provenance is recorded, not enforced: branch, dirt, design edits, and a different named commit all admit', (t) => {
  const branched = fixture(t);
  git(branched.root, 'checkout', '-q', '-b', 'launch-branch');
  const onBranch = verifyPaidStudyLaunchContract(branched.contract);
  assert.equal(onBranch.source.branch, 'launch-branch');
  assert.equal(onBranch.source.detached, false);
  assert.equal(onBranch.source.commit, branched.launchCommit);

  const dirty = fixture(t);
  fs.writeFileSync(path.join(dirty.root, 'untracked.txt'), 'dirty\n');
  const withDirt = verifyPaidStudyLaunchContract(dirty.contract);
  assert.equal(withDirt.source.dirty, true);
  assert.equal(withDirt.source.dirty_entries, 1);
  assert.equal(withDirt.design.checkout_matches_main, true);

  const changed = fixture(t);
  fs.writeFileSync(path.join(changed.root, 'config', 'study.json'), '{"study":"changed"}\n');
  const withEdit = verifyPaidStudyLaunchContract(changed.contract);
  assert.equal(withEdit.source.dirty, true);
  assert.equal(withEdit.design.checkout_matches_head, false);
  assert.equal(withEdit.design.checkout_matches_main, false);

  const hiddenChange = fixture(t);
  git(hiddenChange.root, 'update-index', '--assume-unchanged', 'config/study.json');
  fs.writeFileSync(path.join(hiddenChange.root, 'config', 'study.json'), '{"study":"hidden-change"}\n');
  const hidden = verifyPaidStudyLaunchContract(hiddenChange.contract);
  assert.equal(hidden.source.dirty, false);
  assert.equal(hidden.design.checkout_matches_head, false);
  assert.equal(hidden.design.checkout_matches_main, false);

  const elsewhere = fixture(t);
  const named = verifyPaidStudyLaunchContract({ ...elsewhere.contract, launchCommit: elsewhere.goNoteCommit });
  assert.equal(named.source.commit, elsewhere.launchCommit);
  assert.equal(named.source.named_launch_commit, elsewhere.goNoteCommit);
  assert.equal(named.source.named_launch_commit_is_head, false);

  const unnamed = verifyPaidStudyLaunchContract({ ...elsewhere.contract, launchCommit: undefined });
  assert.equal(unnamed.source.commit, elsewhere.launchCommit);
  assert.equal(unnamed.source.named_launch_commit, null);
  assert.equal(unnamed.source.named_launch_commit_is_head, null);
});

test('standing contract still refuses a missing or unmerged design, a bad GO note, and cap drift', (t) => {
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
  const emptyTree = git(unmerged.root, 'hash-object', '-t', 'tree', '/dev/null');
  const unmergedMain = git(unmerged.root, 'commit-tree', emptyTree, '-m', 'main without the design');
  git(unmerged.root, 'update-ref', 'refs/remotes/origin/main', unmergedMain);
  assert.throws(() => verifyPaidStudyLaunchContract(unmerged.contract), /must be merged/u);

  const missingDesign = fixture(t);
  fs.rmSync(path.join(missingDesign.root, 'config', 'study.json'));
  assert.throws(() => verifyPaidStudyLaunchContract(missingDesign.contract), /not in the checkout/u);
});

test('a GO given in chat admits without a note and is recorded as given', (t) => {
  const value = fixture(t);
  const withoutNote = { ...value.contract, goNoteCommit: undefined, goNotePath: undefined };
  const verified = verifyPaidStudyLaunchContract({ ...withoutNote, goApproval: 'GO  ' });
  assert.equal(verified.authorization.channel, 'chat');
  assert.equal(verified.authorization.text, 'GO');
  assert.ok(Date.parse(verified.authorization.recorded_at) > 0);
  assert.equal(verified.source.named_launch_commit, value.launchCommit);

  const recorded = verifyPaidStudyLaunchContract({
    ...withoutNote,
    launchCommit: undefined,
    goApproval: 'GO, run the second family replication',
  });
  assert.equal(recorded.authorization.text, 'GO, run the second family replication');
  assert.equal(recorded.source.named_launch_commit, null);

  for (const text of [undefined, '', 'go', 'Go ahead', 'NO-GO', 'please GO']) {
    assert.throws(
      () => verifyPaidStudyLaunchContract({ ...withoutNote, goApproval: text }),
      /must start with the word GO/u,
      JSON.stringify(text),
    );
  }
  assert.deepEqual(paidStudyChatGoIssues('GO now'), []);
  assert.deepEqual(paidStudyChatGoIssues('GOAL'), ['go_token']);

  const destination = path.join(value.base, 'chat-run');
  const admission = admitPaidStudyLaunch({ ...withoutNote, goApproval: 'GO', destination });
  admission.close({ type: 'run_sealed', status: 'complete' });
  const launch = fs
    .readFileSync(path.join(destination, 'run-ledger.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .find((event) => event.type === 'launch_admitted');
  assert.equal(launch.go_note.channel, 'chat');
  assert.equal(launch.go_note.text, 'GO');
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

  const stillNamedOriginal = verifyPaidStudyLaunchContract(value.contract);
  assert.equal(stillNamedOriginal.source.commit, recoveryCommit);
  assert.equal(stillNamedOriginal.source.named_launch_commit, value.launchCommit);
  assert.equal(stillNamedOriginal.source.named_launch_commit_is_head, false);
});

test('a dirty branch checkout with a code commit after GO still admits and writes its provenance to the ledger', (t) => {
  const value = fixture(t, { cap: 2, noteCap: '2' });
  git(value.root, 'checkout', '-q', '-b', 'fix-after-go', value.goNoteCommit);
  fs.writeFileSync(path.join(value.root, 'fix.txt'), 'code fix after GO\n');
  git(value.root, 'add', 'fix.txt');
  git(value.root, 'commit', '-qm', 'code fix after GO');
  const fixCommit = git(value.root, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(value.root, 'scratch.txt'), 'uncommitted\n');

  const destination = path.join(value.base, 'run');
  const admitted = admitPaidStudyLaunch({ ...value.contract, destination });
  assert.equal(fs.existsSync(admitted.ledger_path), true);
  assert.deepEqual(admitted.reserveModelAttempts(1, { unit: 'a' }), {
    reserved: 1,
    remaining: 1,
    study_reserved: 1,
  });
  admitted.close({ type: 'run_sealed', status: 'complete' });

  const rows = fs.readFileSync(admitted.ledger_path, 'utf8').trim().split('\n').map(JSON.parse);
  const launch = rows.find((row) => row.type === 'launch_admitted');
  assert.equal(launch.source_commit, fixCommit);
  assert.equal(launch.source_branch, 'fix-after-go');
  assert.equal(launch.source_dirty, true);
  assert.equal(launch.named_launch_commit, value.launchCommit);
  assert.equal(launch.design_checkout_matches_main, true);
  assert.deepEqual(launch.go_note, { commit: value.goNoteCommit, path: 'notes/go.md' });
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

test('capacity allocation consumes only per-dispatch reservations and releases unused allowance', (t) => {
  const value = fixture(t, { cap: 5, noteCap: '5' });
  const admission = admitPaidStudyLaunch({ ...value.contract, destination: path.join(value.base, 'capacity-run') });
  const capacity = admission.allocateModelAttemptCapacity(3, { unit: 'unit-1' });
  assert.equal(admission.reserved, 0);
  assert.equal(admission.studyReserved, 0);
  const client = sharedModelAttemptLedgerClientFromEnv(
    admission.attemptLedgerEnvironment({ unitId: 'unit-1', capacity, maximumTurn: 2 }),
  );
  for (const turn of [1, 2]) {
    const attempt = client.reserve({ role: 'fixture-role', turn });
    client.markDispatched({ attemptId: attempt.attemptId, role: 'fixture-role', turn });
    const responsePath = path.join(value.base, 'capacity-run', `response-${turn}.json`);
    fs.writeFileSync(responsePath, JSON.stringify({ turn }));
    client.persistResponse({ attemptId: attempt.attemptId, responsePath, role: 'fixture-role', turn });
    client.terminalize({ attemptId: attempt.attemptId, disposition: 'completed', role: 'fixture-role', turn });
  }
  assert.equal(admission.reserved, 2);
  assert.equal(admission.studyReserved, 2);
  assert.throws(
    () => client.reserve({ role: 'fixture-role', turn: 3 }),
    /registered turn horizon exceeded before dispatch/u,
  );
  assert.equal(admission.reserved, 2);
  const released = admission.releaseModelAttemptCapacity(capacity, { unit: 'unit-1' });
  assert.deepEqual(released, { allocated: 3, consumed: 2, unused: 1 });
  assert.throws(() => admission.allocateModelAttemptCapacity(4, { unit: 'unit-2' }), /remaining attempt ceiling/u);
  admission.close({ type: 'run_sealed', status: 'complete' });

  const runEvents = fs
    .readFileSync(path.join(value.base, 'capacity-run', 'run-ledger.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  assert.equal(runEvents.filter((event) => event.type === 'model_attempt_dispatch_reserved').length, 2);
  assert.equal(
    runEvents.some((event) => event.type === 'model_attempt_reserved'),
    false,
  );
});

test('shared attempt restart reconciles a missing mirror and stale inflight dispatch exactly once', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-attempt-reconcile-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const runLedgerPath = path.join(base, 'run.jsonl');
  const studyLedgerPath = path.join(base, 'study.jsonl');
  const capacityId = 'capacity-1';
  const unitId = 'unit-1';
  fs.writeFileSync(
    studyLedgerPath,
    [
      { type: 'study_model_attempt_dispatch_reserved', attempt_id: 'a1', capacity_id: capacityId, unit_id: unitId },
      { type: 'study_model_attempt_dispatch_reserved', attempt_id: 'a2', capacity_id: capacityId, unit_id: unitId },
    ]
      .map((event) => JSON.stringify(event))
      .join('\n') + '\n',
  );
  fs.writeFileSync(
    runLedgerPath,
    [
      { type: 'model_attempt_dispatch_reserved', attempt_id: 'a2', capacity_id: capacityId, unit_id: unitId },
      { type: 'model_attempt_dispatch_started', attempt_id: 'a2', capacity_id: capacityId, unit_id: unitId },
    ]
      .map((event) => JSON.stringify(event))
      .join('\n') + '\n',
  );
  reconcileSharedModelAttemptLedger({ runLedgerPath, studyLedgerPath, capacityId, unitId });
  createSharedModelAttemptLedgerClient({
    runLedgerPath,
    studyLedgerPath,
    studyId: 'fixture-study',
    destination: base,
    hardCeiling: 5,
    unitId,
    capacityId,
    capacityLimit: 5,
  });
  const events = fs.readFileSync(runLedgerPath, 'utf8').trim().split(/\r?\n/u).map(JSON.parse);
  assert.equal(events.filter((event) => event.type === 'model_attempt_dispatch_reserved').length, 2);
  assert.equal(events.filter((event) => event.type === 'attempt_cancelled_before_dispatch').length, 1);
  assert.equal(events.filter((event) => event.type === 'attempt_interrupted_after_dispatch').length, 1);
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

test('sealing a killed per-dispatch launch reconciles and counts its interrupted attempt', (t) => {
  const value = fixture(t, { cap: 3, noteCap: '3' });
  const destination = path.join(value.base, 'interrupted-dispatch-run');
  const initial = admitPaidStudyLaunch({ ...value.contract, destination });
  const capacity = initial.allocateModelAttemptCapacity(3, { unit: 'unit-1' });
  const client = sharedModelAttemptLedgerClientFromEnv(
    initial.attemptLedgerEnvironment({ unitId: 'unit-1', capacity, maximumTurn: 2 }),
  );
  const completed = client.reserve({ role: 'fixture', turn: 1 });
  client.markDispatched({ attemptId: completed.attemptId, role: 'fixture', turn: 1 });
  const completedResponsePath = path.join(destination, 'completed-response.json');
  fs.writeFileSync(completedResponsePath, JSON.stringify({ turn: 1 }));
  client.persistResponse({
    attemptId: completed.attemptId,
    responsePath: completedResponsePath,
    role: 'fixture',
    turn: 1,
  });
  client.terminalize({ attemptId: completed.attemptId, disposition: 'completed', role: 'fixture', turn: 1 });
  const interrupted = client.reserve({ role: 'fixture', turn: 2 });
  client.markDispatched({ attemptId: interrupted.attemptId, role: 'fixture', turn: 2 });

  const sealed = sealInterruptedPaidStudyLaunch({
    studyId: 'fixture-study',
    studyStateRoot: value.contract.studyStateRoot,
    destination,
    reason: 'fixture process killed after dispatch',
    isProcessAlive: () => false,
  });
  assert.equal(sealed.reserved_in_run, 2);
  assert.equal(sealed.study_reserved, 2);

  const runEvents = fs.readFileSync(initial.ledger_path, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(runEvents.filter((event) => event.type === 'attempt_completed').length, 1);
  assert.equal(runEvents.filter((event) => event.type === 'attempt_interrupted_after_dispatch').length, 1);
  assert.equal(runEvents.at(-1).reserved_attempts, 2);

  const recovery = admitPaidStudyLaunch({
    ...value.contract,
    destination: path.join(value.base, 'interrupted-dispatch-recovery'),
    recoveryFrom: destination,
  });
  assert.equal(recovery.studyReserved, 2);
  const remaining = recovery.allocateModelAttemptCapacity(1, { unit: 'unit-2' });
  assert.equal(remaining.count, 1);
  recovery.releaseModelAttemptCapacity(remaining, { unit: 'unit-2' });
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

function sealCrashedRun({ value, destination, seal, interruptDispatch = false, studyId = value.contract.studyId }) {
  const initial = admitPaidStudyLaunch({ ...value.contract, studyId, destination });
  const capacity = initial.allocateModelAttemptCapacity(2, { unit: 'unit-1' });
  const client = sharedModelAttemptLedgerClientFromEnv(
    initial.attemptLedgerEnvironment({ unitId: 'unit-1', capacity, maximumTurn: 2 }),
  );
  const completed = client.reserve({ role: 'fixture', turn: 1 });
  client.markDispatched({ attemptId: completed.attemptId, role: 'fixture', turn: 1 });
  const responsePath = path.join(destination, 'completed-response.json');
  fs.writeFileSync(responsePath, JSON.stringify({ turn: 1 }));
  client.persistResponse({ attemptId: completed.attemptId, responsePath, role: 'fixture', turn: 1 });
  client.terminalize({ attemptId: completed.attemptId, disposition: 'completed', role: 'fixture', turn: 1 });
  if (interruptDispatch) {
    // Leave the second attempt dispatched and the capacity open, so the
    // launcher's own close reconciles it as interrupted after dispatch.
    const interrupted = client.reserve({ role: 'fixture', turn: 2 });
    client.markDispatched({ attemptId: interrupted.attemptId, role: 'fixture', turn: 2 });
  } else {
    initial.releaseModelAttemptCapacity(capacity, { unit: 'unit-1' });
  }
  initial.close({ type: 'run_sealed', ...seal });
  return { ledgerPath: initial.ledger_path };
}

const HARNESS_CRASH_SEAL = {
  status: 'failed',
  recovery_permitted: false,
  error: 'reservation.fail is not a function',
  code: null,
};

test('a harness crash sealed without a stop code admits one recovery when no dispatch was cut off', (t) => {
  const value = fixture(t, { cap: 4, noteCap: '4' });
  const initialDestination = path.join(value.base, 'crashed-initial');
  sealCrashedRun({ value, destination: initialDestination, seal: HARNESS_CRASH_SEAL });

  const studyLedgerPath = path.join(value.contract.studyStateRoot, value.contract.studyId, 'study-ledger.jsonl');
  const sealedEvent = fs.readFileSync(studyLedgerPath, 'utf8').trim().split('\n').map(JSON.parse).at(-1);
  assert.equal(sealedEvent.type, 'study_run_sealed');
  assert.equal(sealedEvent.recovery_permitted, false);

  const recovery = admitPaidStudyLaunch({
    ...value.contract,
    destination: path.join(value.base, 'crashed-recovery'),
    recoveryFrom: initialDestination,
  });
  assert.equal(recovery.studyReserved, 1);
  recovery.reserveModelAttempts(1, { unit: 'resumed' });
  recovery.close({ type: 'run_sealed', status: 'complete' });

  assert.throws(
    () =>
      admitPaidStudyLaunch({
        ...value.contract,
        destination: path.join(value.base, 'crashed-second-recovery'),
        recoveryFrom: initialDestination,
      }),
    /recovery|sealed technical predecessor/u,
  );
});

test('a sealed stop that carries a stop code or a blank error is not read as a harness crash', (t) => {
  const value = fixture(t, { cap: 4, noteCap: '4' });

  const codedDestination = path.join(value.base, 'coded-initial');
  sealCrashedRun({
    value,
    destination: codedDestination,
    seal: { ...HARNESS_CRASH_SEAL, code: 'attempt_cap_reached', error: 'registered 30-attempt cap' },
  });
  assert.throws(
    () =>
      admitPaidStudyLaunch({
        ...value.contract,
        destination: path.join(value.base, 'coded-recovery'),
        recoveryFrom: codedDestination,
      }),
    /sealed technical predecessor/u,
  );

  const blankDestination = path.join(value.base, 'blank-initial');
  sealCrashedRun({
    value,
    studyId: 'fixture-study-blank',
    destination: blankDestination,
    seal: { ...HARNESS_CRASH_SEAL, error: '   ' },
  });
  assert.throws(
    () =>
      admitPaidStudyLaunch({
        ...value.contract,
        studyId: 'fixture-study-blank',
        destination: path.join(value.base, 'blank-recovery'),
        recoveryFrom: blankDestination,
      }),
    /sealed technical predecessor/u,
  );
});

test('a harness crash sealed after a dispatch was cut off does not admit recovery on this rule', (t) => {
  const value = fixture(t, { cap: 4, noteCap: '4' });
  const destination = path.join(value.base, 'interrupted-crash-initial');
  const { ledgerPath } = sealCrashedRun({ value, destination, seal: HARNESS_CRASH_SEAL, interruptDispatch: true });

  const runEvents = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(runEvents.filter((event) => event.type === 'attempt_interrupted_after_dispatch').length, 1);
  assert.equal(runEvents.at(-1).type, 'run_sealed');
  assert.equal(runEvents.at(-1).code, null);
  assert.equal(runEvents.at(-1).recovery_permitted, false);

  assert.throws(
    () =>
      admitPaidStudyLaunch({
        ...value.contract,
        destination: path.join(value.base, 'interrupted-crash-recovery'),
        recoveryFrom: destination,
      }),
    /sealed technical predecessor/u,
  );
});

test('a recoverable pause hands only the remaining reservation capacity to recovery', (t) => {
  const value = fixture(t, { cap: 2, noteCap: '2' });
  const initialDestination = path.join(value.base, 'paused-initial');
  const initial = admitPaidStudyLaunch({ ...value.contract, destination: initialDestination });
  initial.reserveModelAttempts(1, { unit: 'completed-before-pause' });
  initial.close({
    type: 'run_sealed',
    status: 'paused_recoverable',
    recovery_permitted: true,
    recoverable: true,
    resume_scope: 'missing_work_only',
  });

  const recovery = admitPaidStudyLaunch({
    ...value.contract,
    destination: path.join(value.base, 'paused-recovery'),
    recoveryFrom: initialDestination,
  });
  assert.equal(recovery.studyReserved, 1);
  recovery.reserveModelAttempts(1, { unit: 'missing-after-pause' });
  recovery.close({ type: 'run_sealed', status: 'complete' });

  const studyLedger = fs
    .readFileSync(path.join(value.contract.studyStateRoot, value.contract.studyId, 'study-ledger.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  const pauseSeal = studyLedger.find((event) => event.status === 'paused_recoverable');
  assert.equal(pauseSeal.recovery_permitted, true);
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

test('a recovery with child model attempts requires a fully aligned action-outcome failure report', (t) => {
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
    child_completed_attempts: 0,
    child_failed_attempts: 1,
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

  const reportPath = path.join(failedRecoveryDestination, 'report.json');
  const report = {
    schema: 'machinespirits.tutor-stub.action-outcome-collection-generation-report.v1',
    study_id: 'fixture-study',
    status: 'technical_failure',
    halt_reason: 'technical_failure in child-call-unit',
    source: { commit: failedRecovery.source.commit },
    design: { path: value.contract.designPath },
    recovery: { source_root: initialDestination },
    execution: {
      missing_units: 1,
      model_attempts: {
        reserved_in_predecessor: 1,
        reserved_in_current_run: 1,
        reserved_by_shared_study_ledger: 2,
        hard_ceiling: 3,
      },
    },
    rows: [
      {
        job_id: 'child-call-unit',
        status: 'technical_failure',
        model_attempts: { reserved: 1, completed: 0, failed: 2 },
      },
    ],
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report)}\n`);
  assert.throws(
    () =>
      admitPaidStudyLaunch({
        ...value.contract,
        destination: path.join(value.base, 'child-call-final-recovery-with-tampered-report'),
        recoveryFrom: failedRecoveryDestination,
      }),
    /sealed technical predecessor/u,
  );
  report.rows[0].model_attempts.failed = 1;
  fs.writeFileSync(reportPath, `${JSON.stringify(report)}\n`);

  const finalRecovery = admitPaidStudyLaunch({
    ...value.contract,
    destination: path.join(value.base, 'child-call-final-recovery-with-report'),
    recoveryFrom: failedRecoveryDestination,
  });
  assert.equal(finalRecovery.studyReserved, 2);
  finalRecovery.reserveModelAttempts(1, { unit: 'remaining-unit' });
  finalRecovery.close({ type: 'run_sealed', status: 'complete' });
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
