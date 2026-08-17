import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { derivationLoopRunDir } from '../scripts/browse-poetics-scripts.js';
import { REPLAYS_DIR, resolveReplaysDir, listReplayBundles } from '../services/poetics/replayBundles.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Both artifact directories became redirectable so the page byte contracts stop
// answering to whatever a machine happens to have under exports/. Two things must
// stay true after that change: the override is read per CALL (not once at import,
// which would make it unusable from a test whose static imports are hoisted), and
// the path-traversal guard on /derivation/<label> still holds under a redirect.

function withEnv(name, value, fn) {
  const had = Object.hasOwn(process.env, name);
  const previous = process.env[name];
  if (value === null) delete process.env[name];
  else process.env[name] = value;
  try {
    return fn();
  } finally {
    if (had) process.env[name] = previous;
    else delete process.env[name];
  }
}

test('the derivation loop directory is redirected per call, absolute or relative', () => {
  const fallback = withEnv('DERIVATION_LOOP_DIR', null, () => derivationLoopRunDir('a-run'));
  assert.equal(fallback, path.join(ROOT, 'exports/dramatic-derivation/loop/a-run'));

  const relative = withEnv('DERIVATION_LOOP_DIR', 'tests/fixtures/derivation-loop', () =>
    derivationLoopRunDir('a-run'),
  );
  assert.equal(relative, path.join(ROOT, 'tests/fixtures/derivation-loop/a-run'));

  const absolute = withEnv('DERIVATION_LOOP_DIR', '/tmp/pinned-loop', () => derivationLoopRunDir('a-run'));
  assert.equal(absolute, path.join('/tmp/pinned-loop', 'a-run'));

  // Read per call, so two different values in one process give two different answers.
  assert.notEqual(relative, absolute);
});

test('the run-label guard rejects traversal under an override as it does by default', () => {
  const attacks = ['..', '../escape', 'a/../../b', 'a/b', '/etc/passwd', '.hidden', '', '.', './x'];
  for (const dir of [null, 'tests/fixtures/derivation-loop', '/tmp/pinned-loop']) {
    withEnv('DERIVATION_LOOP_DIR', dir, () => {
      for (const label of attacks) {
        assert.equal(derivationLoopRunDir(label), null, `label ${JSON.stringify(label)} must be rejected`);
      }
      // A legitimate label still resolves, and stays under the resolved root.
      const ok = derivationLoopRunDir('fixture-proof-run');
      assert.ok(ok && ok.endsWith(`${path.sep}fixture-proof-run`));
    });
  }
});

test('the replay bundle directory is redirected per call and falls back to exports/', () => {
  assert.equal(
    withEnv('POETICS_REPLAYS_DIR', null, () => resolveReplaysDir()),
    REPLAYS_DIR,
  );
  assert.equal(
    withEnv('POETICS_REPLAYS_DIR', 'tests/fixtures/replay-bundles', () => resolveReplaysDir()),
    path.join(ROOT, 'tests/fixtures/replay-bundles'),
  );

  // The readers take the override through their default argument, so they follow it.
  const bundles = withEnv('POETICS_REPLAYS_DIR', 'tests/fixtures/replay-bundles', () => listReplayBundles());
  assert.deepEqual(
    bundles.map((b) => b.name),
    ['fixture-bundle'],
  );

  // An explicit dir argument still wins over the environment.
  assert.deepEqual(
    withEnv('POETICS_REPLAYS_DIR', 'tests/fixtures/replay-bundles', () =>
      listReplayBundles({ dir: path.join(ROOT, 'tests/fixtures/no-such-directory') }),
    ),
    [],
  );
});
