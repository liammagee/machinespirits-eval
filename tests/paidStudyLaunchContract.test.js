import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
  admitPaidStudyLaunch,
  paidStudyGoNoteIssues,
  verifyPaidStudyLaunchContract,
} from '../services/paidStudyLaunchContract.js';

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
    },
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
      text: `\nGO\nconfig/study.json\n${value.launchCommit}\n1_200\n`,
      designPath: 'config/study.json',
      launchCommit: value.launchCommit,
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

  const unrelated = fixture(t);
  const sibling = git(unrelated.root, 'commit-tree', `${unrelated.launchCommit}^{tree}`, '-m', 'sibling');
  assert.throws(() => verifyPaidStudyLaunchContract({ ...unrelated.contract, goNoteCommit: sibling }), /must descend/u);

  const unmerged = fixture(t);
  const unmergedMain = git(unmerged.root, 'commit-tree', `${unmerged.launchCommit}^{tree}`, '-m', 'unrelated main');
  git(unmerged.root, 'update-ref', 'refs/remotes/origin/main', unmergedMain);
  assert.throws(() => verifyPaidStudyLaunchContract(unmerged.contract), /must be merged/u);
});

test('admission creates the destination and append-only budget ledger before calls', (t) => {
  const value = fixture(t, { cap: 2, noteCap: '2' });
  const destination = path.join(value.base, 'run');
  const admitted = admitPaidStudyLaunch({ ...value.contract, destination });
  assert.equal(fs.existsSync(destination), true);
  assert.equal(fs.existsSync(admitted.ledger_path), true);
  assert.deepEqual(admitted.reserveModelAttempts(1, { unit: 'a' }), { reserved: 1, remaining: 1 });
  assert.deepEqual(admitted.reserveModelAttempts(1, { unit: 'b' }), { reserved: 2, remaining: 0 });
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
