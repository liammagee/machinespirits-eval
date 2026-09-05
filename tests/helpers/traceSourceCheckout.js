import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Build a second checkout of one commit that shares the object store of a
 * source repository. Tests use it as the "immutable trace source" next to the
 * live "analysis source" checkout.
 *
 * On a full clone the mechanism is `git clone --shared --no-checkout` followed
 * by `git checkout --detach <commit>`, unchanged from the original test.
 *
 * On a partial clone (a promisor remote with `remote.<name>.partialclonefilter`,
 * for example `blob:none`) two things break that mechanism:
 *   - the source may not hold the parent commit's blobs, and the clone's
 *     checkout exits 0 while leaving those files missing;
 *   - when the source is also shallow, `git clone` drops the local fast path and
 *     runs upload-pack, which cannot serve blobs the source does not hold.
 * So on a partial clone the helper first fetches the commit's missing objects
 * from the promisor remote with git's own lazy-fetch command, then shares the
 * object store directly (`git init` + `objects/info/alternates`) and never runs
 * upload-pack against the source. When the fetch cannot complete, the result
 * carries a `skipReason` instead of throwing, so the caller can `t.skip()`.
 */

function git(args, { cwd, env, input } = {}) {
  return execFileSync('git', args, {
    cwd,
    env,
    input,
    encoding: 'utf8',
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  }).trim();
}

function checkoutEnv(env) {
  return { ...(env || process.env), GIT_LFS_SKIP_SMUDGE: '1' };
}

/**
 * The promisor remote of a partial clone, or null on a full clone.
 * Reads `remote.<name>.promisor` and `remote.<name>.partialclonefilter`;
 * `extensions.partialClone` names the remote on older layouts.
 */
export function promisorRemoteOf(sourceRoot, env = process.env) {
  let names = [];
  try {
    names = git(['config', '--get-regexp', '^remote\\.[^.]+\\.promisor$'], { cwd: sourceRoot, env })
      .split('\n')
      .filter((line) => /\strue$/u.test(line))
      .map((line) => line.replace(/^remote\.(.+)\.promisor\s+true$/u, '$1'));
  } catch {
    names = [];
  }
  try {
    const extension = git(['config', '--get', 'extensions.partialclone'], { cwd: sourceRoot, env });
    if (extension && !names.includes(extension)) names.unshift(extension);
  } catch {
    // Not set: the promisor list above is the whole answer.
  }
  if (names.length === 0) return null;
  const name = names[0];
  let filter = null;
  try {
    filter = git(['config', '--get', `remote.${name}.partialclonefilter`], { cwd: sourceRoot, env }) || null;
  } catch {
    filter = null;
  }
  return { name, filter, configKey: `remote.${name}.partialclonefilter` };
}

/** Object ids reachable from the commit's tree that the source does not hold. */
export function missingObjectsFor(sourceRoot, commit, env = process.env) {
  return git(['rev-list', '--objects', '--missing=print', '--no-walk', commit], { cwd: sourceRoot, env })
    .split('\n')
    .filter((line) => line.startsWith('?'))
    .map((line) => line.slice(1).trim())
    .filter(Boolean);
}

/**
 * Fetch object ids from the promisor remote. This is the command git runs for
 * its own lazy fetch (promisor-remote.c), so it does what a checkout of the
 * commit inside the source repository would have done.
 */
export function prefetchObjects(sourceRoot, remoteName, objectIds, env = process.env) {
  if (objectIds.length === 0) return;
  git(
    [
      '-c',
      'fetch.negotiationAlgorithm=noop',
      'fetch',
      '--quiet',
      remoteName,
      '--no-tags',
      '--no-write-fetch-head',
      '--recurse-submodules=no',
      '--filter=blob:none',
      '--stdin',
    ],
    { cwd: sourceRoot, env, input: `${objectIds.join('\n')}\n` },
  );
}

function cloneSharedCheckout({ sourceRoot, commit, destination, env }) {
  execFileSync('git', ['clone', '--quiet', '--shared', '--no-checkout', sourceRoot, destination], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  execFileSync('git', ['checkout', '--quiet', '--detach', commit], {
    cwd: destination,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function sharedObjectStoreCheckout({ sourceRoot, commit, destination, env }) {
  const commonDir = path.resolve(sourceRoot, git(['rev-parse', '--git-common-dir'], { cwd: sourceRoot, env }));
  execFileSync('git', ['init', '--quiet', destination], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const gitDir = path.resolve(destination, git(['rev-parse', '--git-dir'], { cwd: destination, env }));
  fs.mkdirSync(path.join(gitDir, 'objects', 'info'), { recursive: true });
  fs.writeFileSync(path.join(gitDir, 'objects', 'info', 'alternates'), `${path.join(commonDir, 'objects')}\n`);
  const shallow = path.join(commonDir, 'shallow');
  if (fs.existsSync(shallow)) fs.copyFileSync(shallow, path.join(gitDir, 'shallow'));
  execFileSync('git', ['checkout', '--quiet', '--detach', commit], {
    cwd: destination,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * @returns {{ mode: 'clone' | 'shared_object_store', prefetched: number, skipReason?: string }}
 */
export function createTraceSourceCheckout({ sourceRoot, commit, destination, env: baseEnv }) {
  const env = checkoutEnv(baseEnv);
  const promisor = promisorRemoteOf(sourceRoot, env);
  if (!promisor) {
    cloneSharedCheckout({ sourceRoot, commit, destination, env });
    return { mode: 'clone', prefetched: 0 };
  }

  const label = `partial clone (${promisor.configKey}=${promisor.filter || 'unset'})`;
  const missing = missingObjectsFor(sourceRoot, commit, env);
  if (missing.length > 0) {
    try {
      prefetchObjects(sourceRoot, promisor.name, missing, env);
    } catch (error) {
      const detail = String(error?.stderr || error?.message || error).trim();
      return {
        mode: 'shared_object_store',
        prefetched: 0,
        skipReason: `${label}: could not fetch ${missing.length} missing object(s) of ${commit} from ${promisor.name}: ${detail}`,
      };
    }
    const remaining = missingObjectsFor(sourceRoot, commit, env);
    if (remaining.length > 0) {
      return {
        mode: 'shared_object_store',
        prefetched: missing.length - remaining.length,
        skipReason: `${label}: ${remaining.length} object(s) of ${commit} still missing after a fetch from ${promisor.name}`,
      };
    }
  }

  sharedObjectStoreCheckout({ sourceRoot, commit, destination, env });
  return { mode: 'shared_object_store', prefetched: missing.length };
}
