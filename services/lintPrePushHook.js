import fs from 'node:fs';
import path from 'node:path';

/**
 * Pre-push link for the CI lint lane.
 *
 * CI's lint job runs three checks: eslint (`npm run lint`), the static
 * import-cycle check (`npm run lint:cycles`), and prettier
 * (`npm run format:check`). Running only part of that list locally is the
 * standing source of noisy CI failures: the missed part fails the whole CI
 * round minutes after the push. This hook runs the same three checks — via
 * the one combined script `npm run lint:all` — before the push leaves the
 * machine.
 *
 * Unlike the workplan-trailer hook this one blocks. A lint failure is
 * mechanical, the fix is `npm run lint:fix` / `npm run format`, and letting
 * the push through only moves the same failure into CI. `git push
 * --no-verify` remains the escape hatch for an emergency, with a stated
 * reason.
 *
 * The wrapper/sidecar mechanics mirror services/workplanTrailerPrePushHook.js
 * so the hooks chain in either install order.
 */

export const LINT_HOOK_MARKER = '# machinespirits:lint-pre-push-hook:v1';
export const LINT_HOOK_SIDECAR = 'pre-push.machinespirits-before-lint';

const MARKER_FAMILY = '# machinespirits:lint-pre-push-hook:';
const ZERO_OID = /^0+$/u;

/**
 * Parse git's pre-push stdin. Each line is
 * `<localRef> <localOid> <remoteRef> <remoteOid>`. A malformed line throws
 * rather than being skipped: silently ignoring input we do not understand is
 * how a check quietly stops checking anything.
 */
export function parseLintPrePushInput(source) {
  return String(source || '')
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/gu);
      if (parts.length !== 4) throw new Error(`invalid pre-push update: ${line}`);
      const [localRef, localOid, remoteRef, remoteOid] = parts;
      return { localRef, localOid, remoteRef, remoteOid };
    });
}

/**
 * A push made only of branch deletions (`localOid` all zeros) carries no
 * commits, so there is nothing the CI lint lane would see.
 */
export function lintPrePushInputCarriesCommits(updates) {
  return (updates || []).some((update) => !ZERO_OID.test(update.localOid));
}

export function renderLintPrePushWrapper() {
  return `#!/bin/sh
set -u

${LINT_HOOK_MARKER}
hook_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)" || exit 2
hook_input="$(mktemp "${'${TMPDIR:-/tmp}'}/machinespirits-pre-push.XXXXXX")" || exit 2
trap 'rm -f "$hook_input"' 0 1 2 15
cat > "$hook_input" || exit 2

previous_hook="$hook_dir/${LINT_HOOK_SIDECAR}"
if [ -f "$previous_hook" ]; then
  "$previous_hook" "$@" < "$hook_input" || exit $?
fi

repo_root="$(git rev-parse --show-toplevel)" || exit 2
lint_hook="$repo_root/scripts/lint-hook.js"
if [ -f "$lint_hook" ]; then
  node "$lint_hook" pre-push "$@" < "$hook_input" || exit $?
fi
`;
}

function writeExecutableAtomic(target, source) {
  const temporary = `${target}.machinespirits-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, source, { encoding: 'utf8', flag: 'wx', mode: 0o755 });
    fs.chmodSync(temporary, 0o755);
    fs.renameSync(temporary, target);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {
      // The temporary path may not have been created.
    }
    throw error;
  }
}

export function installLintPrePushHook(hookPath) {
  const target = path.resolve(hookPath);
  const hookDir = path.dirname(target);
  const sidecar = path.join(hookDir, LINT_HOOK_SIDECAR);
  const wrapper = renderLintPrePushWrapper();
  fs.mkdirSync(hookDir, { recursive: true });
  if (fs.existsSync(target)) {
    const current = fs.readFileSync(target, 'utf8');
    if (current === wrapper) return { status: 'already_installed', target, sidecar, preserved: fs.existsSync(sidecar) };
    if (current.includes(MARKER_FAMILY)) {
      throw new Error(`managed pre-push hook differs from this installer: ${target}`);
    }
  }
  if (fs.existsSync(sidecar)) throw new Error(`pre-push sidecar already exists: ${sidecar}`);
  const preserved = fs.existsSync(target);
  if (preserved) fs.renameSync(target, sidecar);
  try {
    writeExecutableAtomic(target, wrapper);
  } catch (error) {
    if (preserved && fs.existsSync(sidecar) && !fs.existsSync(target)) fs.renameSync(sidecar, target);
    throw error;
  }
  return { status: 'installed', target, sidecar, preserved };
}

/**
 * Is this wrapper installed somewhere other than the hook entry point?
 * Another installer following the same pattern will have renamed this wrapper
 * to *its* sidecar, leaving this one buried a level down and still running.
 * Removing the outer hook from here would strand it, so the caller is told to
 * unwind the chain from the top instead.
 */
function findBuriedWrapper(hookDir, target) {
  let entries;
  try {
    entries = fs.readdirSync(hookDir);
  } catch {
    return null;
  }
  for (const entry of entries) {
    const candidate = path.join(hookDir, entry);
    if (candidate === target) continue;
    let contents;
    try {
      contents = fs.readFileSync(candidate, 'utf8');
    } catch {
      continue;
    }
    if (contents.includes(MARKER_FAMILY)) return candidate;
  }
  return null;
}

export function uninstallLintPrePushHook(hookPath) {
  const target = path.resolve(hookPath);
  const hookDir = path.dirname(target);
  const sidecar = path.join(hookDir, LINT_HOOK_SIDECAR);
  if (!fs.existsSync(target)) return { status: 'not_installed', target, sidecar, restored: false };
  const current = fs.readFileSync(target, 'utf8');
  if (current !== renderLintPrePushWrapper()) {
    if (current.includes(MARKER_FAMILY)) {
      throw new Error(`managed pre-push hook was modified; refusing to overwrite it: ${target}`);
    }
    const buried = findBuriedWrapper(hookDir, target);
    if (buried) throw new Error(`another pre-push hook wraps this one; uninstall it first: ${buried}`);
    return { status: 'not_installed', target, sidecar, restored: false };
  }
  fs.unlinkSync(target);
  const restored = fs.existsSync(sidecar);
  if (restored) fs.renameSync(sidecar, target);
  return { status: 'uninstalled', target, sidecar, restored };
}
