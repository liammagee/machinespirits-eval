import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createTraceSourceCheckout, missingObjectsFor, promisorRemoteOf } from './helpers/traceSourceCheckout.js';

/**
 * Builds a two-commit upstream repository and a clone of it inside one
 * temporary root. Every git call runs with the user's global and system
 * config switched off, so LFS filters, hooks templates, and credential
 * helpers on a developer machine cannot reach the fixture.
 */
function fixture(t, { cloneArgs }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-source-checkout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'gitconfig'), '');
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'),
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    GIT_TERMINAL_PROMPT: '0',
  };
  const git = (args, cwd) =>
    execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  const upstream = path.join(root, 'upstream');
  git(['-c', 'init.defaultBranch=main', 'init', '--quiet', upstream]);
  // A file:// clone with --filter needs the server side to allow filters, and
  // the lazy fetch of a bare object id needs it to allow any object in a want.
  git(['config', 'uploadpack.allowFilter', 'true'], upstream);
  git(['config', 'uploadpack.allowAnySHA1InWant', 'true'], upstream);
  fs.writeFileSync(path.join(upstream, 'notes.txt'), 'first\n');
  fs.writeFileSync(path.join(upstream, 'shared.txt'), 'same\n');
  git(['add', '.'], upstream);
  git(['commit', '--quiet', '-m', 'first'], upstream);
  fs.writeFileSync(path.join(upstream, 'notes.txt'), 'second\n');
  git(['commit', '--quiet', '-am', 'second'], upstream);

  const clone = path.join(root, 'clone');
  git(['clone', '--quiet', ...cloneArgs, `file://${upstream}`, clone]);
  const commit = git(['rev-parse', 'HEAD^'], clone);
  const destination = path.join(root, 'trace-source');
  return { root, env, git, upstream, clone, commit, destination };
}

function assertCompleteCheckout({ git, destination, commit }) {
  assert.equal(git(['rev-parse', 'HEAD'], destination), commit);
  assert.equal(git(['status', '--porcelain=v1', '--untracked-files=all'], destination), '');
  assert.equal(fs.readFileSync(path.join(destination, 'notes.txt'), 'utf8'), 'first\n');
  assert.equal(fs.readFileSync(path.join(destination, 'shared.txt'), 'utf8'), 'same\n');
}

test('a full clone keeps the shared clone mechanism', (t) => {
  const f = fixture(t, { cloneArgs: [] });
  assert.equal(promisorRemoteOf(f.clone, f.env), null);
  const result = createTraceSourceCheckout({
    sourceRoot: f.clone,
    commit: f.commit,
    destination: f.destination,
    env: f.env,
  });
  assert.deepEqual(result, { mode: 'clone', prefetched: 0 });
  assertCompleteCheckout({ git: f.git, destination: f.destination, commit: f.commit });
  assert.equal(fs.existsSync(path.join(f.destination, '.git', 'objects', 'info', 'alternates')), true);
});

test('a partial clone fetches the missing objects of the commit and then shares the object store', (t) => {
  const f = fixture(t, { cloneArgs: ['--filter=blob:none'] });
  assert.deepEqual(promisorRemoteOf(f.clone, f.env), {
    name: 'origin',
    filter: 'blob:none',
    configKey: 'remote.origin.partialclonefilter',
  });
  // The clone checked out HEAD, so only the parent's version of notes.txt is absent.
  assert.equal(missingObjectsFor(f.clone, f.commit, f.env).length, 1);

  const result = createTraceSourceCheckout({
    sourceRoot: f.clone,
    commit: f.commit,
    destination: f.destination,
    env: f.env,
  });
  assert.deepEqual(result, { mode: 'shared_object_store', prefetched: 1 });
  assert.deepEqual(missingObjectsFor(f.clone, f.commit, f.env), []);
  assertCompleteCheckout({ git: f.git, destination: f.destination, commit: f.commit });
  const alternates = fs.readFileSync(path.join(f.destination, '.git', 'objects', 'info', 'alternates'), 'utf8').trim();
  assert.equal(fs.realpathSync(alternates), fs.realpathSync(path.join(f.clone, '.git', 'objects')));
});

test('a shallow partial clone works the same and carries its shallow boundary across', (t) => {
  const f = fixture(t, { cloneArgs: ['--depth', '2', '--filter=blob:none'] });
  assert.equal(f.git(['rev-parse', '--is-shallow-repository'], f.clone), 'true');
  const result = createTraceSourceCheckout({
    sourceRoot: f.clone,
    commit: f.commit,
    destination: f.destination,
    env: f.env,
  });
  assert.deepEqual(result, { mode: 'shared_object_store', prefetched: 1 });
  assertCompleteCheckout({ git: f.git, destination: f.destination, commit: f.commit });
  assert.equal(fs.existsSync(path.join(f.destination, '.git', 'shallow')), true);
  assert.equal(f.git(['log', '--oneline'], f.destination).split('\n').length, 1);
});

test('a partial clone whose promisor remote cannot be reached reports a skip reason instead of throwing', (t) => {
  const f = fixture(t, { cloneArgs: ['--filter=blob:none'] });
  f.git(['remote', 'set-url', 'origin', path.join(f.root, 'missing-upstream')], f.clone);
  const result = createTraceSourceCheckout({
    sourceRoot: f.clone,
    commit: f.commit,
    destination: f.destination,
    env: f.env,
  });
  assert.equal(result.mode, 'shared_object_store');
  assert.equal(result.prefetched, 0);
  assert.match(
    result.skipReason,
    /^partial clone \(remote\.origin\.partialclonefilter=blob:none\): could not fetch 1 missing object\(s\) of [0-9a-f]{40} from origin: /u,
  );
  assert.equal(fs.existsSync(f.destination), false);
});
