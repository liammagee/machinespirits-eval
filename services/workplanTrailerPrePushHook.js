import fs from 'node:fs';
import path from 'node:path';

/**
 * Pre-push link for the workplan trailer check.
 *
 * `scripts/check-commit-workplan-trailer.js` runs in CI on `push`, which means
 * it reports after the commit is already on main — at which point you cannot
 * amend the message, only record the commit on a card afterwards. That is the
 * whole reason this exists: run the same check against the same commits before
 * the push leaves the machine, while amending is still cheap.
 *
 * It reports and never rejects. A pre-push hook that rejects changes how
 * everyone works, and the trailer rule is new enough that we do not yet know
 * how often it would fire on legitimate work. So this ships in `report_only`
 * and stays there until the noise level is known; `WORKPLAN_TRAILER_HOOK_ENFORCEMENT=blocking`
 * flips it for anyone who wants to calibrate. Because it always exits 0 in the
 * default mode, its position in the hook chain does not matter.
 *
 * The wrapper/sidecar mechanics deliberately mirror
 * services/tutorStubPrBenchmarkHook.js so the two hooks chain in either install
 * order. They are duplicated rather than shared because that module is under
 * active refactoring; extracting a common installer is a follow-up, not a
 * prerequisite.
 */

export const WORKPLAN_TRAILER_HOOK_MARKER = '# machinespirits:workplan-trailer-hook:v1';
export const WORKPLAN_TRAILER_HOOK_SIDECAR = 'pre-push.machinespirits-before-workplan-trailer';
export const WORKPLAN_TRAILER_HOOK_ENFORCEMENT_VARIABLE = 'WORKPLAN_TRAILER_HOOK_ENFORCEMENT';
export const WORKPLAN_TRAILER_DEFAULT_PROTECTED_REFS = ['refs/heads/main'];

const HOOK_ENFORCEMENT = new Set(['report_only', 'blocking']);
const ZERO_OID = /^0+$/u;

/**
 * Parse git's pre-push stdin.
 *
 * Each line is `<localRef> <localOid> <remoteRef> <remoteOid>`. A malformed
 * line throws rather than being skipped: silently ignoring input we do not
 * understand is how a check quietly stops checking anything.
 */
export function parseWorkplanTrailerPrePushInput(source) {
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
 * Which pushed updates carry commits this check is responsible for.
 *
 * Two cases are skipped rather than guessed at, and both are reported so the
 * skip is visible instead of looking like a pass:
 *
 * - A deletion (`localOid` all zeros) pushes no commits at all.
 * - A remote ref that does not exist yet (`remoteOid` all zeros) has no
 *   previous tip, so `remoteOid..localOid` would walk the entire history. CI
 *   handles that case with its own fallback; there is nothing useful to say
 *   here.
 */
export function selectWorkplanTrailerPushRanges({ updates, protectedRefs } = {}) {
  const guarded = new Set(
    Array.isArray(protectedRefs) && protectedRefs.length ? protectedRefs : WORKPLAN_TRAILER_DEFAULT_PROTECTED_REFS,
  );
  const checks = [];
  const skipped = [];
  for (const update of updates || []) {
    if (!guarded.has(update.remoteRef)) {
      skipped.push({ update, reason: `${update.remoteRef} is not a protected ref` });
      continue;
    }
    if (ZERO_OID.test(update.localOid)) {
      skipped.push({ update, reason: 'branch deletion pushes no commits' });
      continue;
    }
    if (ZERO_OID.test(update.remoteOid)) {
      skipped.push({ update, reason: 'remote ref does not exist yet; no previous tip to diff against' });
      continue;
    }
    checks.push({
      remoteRef: update.remoteRef,
      localOid: update.localOid,
      remoteOid: update.remoteOid,
      range: `${update.remoteOid}..${update.localOid}`,
    });
  }
  return { checks, skipped };
}

export function resolveWorkplanTrailerHookEnforcement(env = process.env) {
  const raw = String(env[WORKPLAN_TRAILER_HOOK_ENFORCEMENT_VARIABLE] || '').trim();
  if (!raw) return 'report_only';
  if (!HOOK_ENFORCEMENT.has(raw)) {
    throw new Error(
      `${WORKPLAN_TRAILER_HOOK_ENFORCEMENT_VARIABLE} must be one of ${[...HOOK_ENFORCEMENT].join(', ')}, got ${raw}`,
    );
  }
  return raw;
}

/**
 * `warn` and `block` describe the same finding; only the exit code differs.
 * Keeping them distinct means the calibration switch changes one branch, not
 * the reporting path.
 */
export function classifyWorkplanTrailerHookOutcome(unlinkedRanges, enforcement) {
  if (!HOOK_ENFORCEMENT.has(enforcement)) throw new Error(`unknown enforcement mode: ${enforcement}`);
  if (unlinkedRanges === 0) return 'allow';
  return enforcement === 'blocking' ? 'block' : 'warn';
}

export function renderWorkplanTrailerPrePushWrapper() {
  return `#!/bin/sh
set -u

${WORKPLAN_TRAILER_HOOK_MARKER}
hook_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)" || exit 2
hook_input="$(mktemp "${'${TMPDIR:-/tmp}'}/machinespirits-pre-push.XXXXXX")" || exit 2
trap 'rm -f "$hook_input"' 0 1 2 15
cat > "$hook_input" || exit 2

previous_hook="$hook_dir/${WORKPLAN_TRAILER_HOOK_SIDECAR}"
if [ -f "$previous_hook" ]; then
  "$previous_hook" "$@" < "$hook_input" || exit $?
fi

repo_root="$(git rev-parse --show-toplevel)" || exit 2
trailer_hook="$repo_root/scripts/workplan-trailer-hook.js"
if [ -f "$trailer_hook" ]; then
  node "$trailer_hook" pre-push "$@" < "$hook_input"
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

export function installWorkplanTrailerPrePushHook(hookPath) {
  const target = path.resolve(hookPath);
  const hookDir = path.dirname(target);
  const sidecar = path.join(hookDir, WORKPLAN_TRAILER_HOOK_SIDECAR);
  const wrapper = renderWorkplanTrailerPrePushWrapper();
  fs.mkdirSync(hookDir, { recursive: true });
  if (fs.existsSync(target)) {
    const current = fs.readFileSync(target, 'utf8');
    if (current === wrapper) return { status: 'already_installed', target, sidecar, preserved: fs.existsSync(sidecar) };
    if (current.includes('# machinespirits:workplan-trailer-hook:')) {
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
 *
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
    if (contents.includes('# machinespirits:workplan-trailer-hook:')) return candidate;
  }
  return null;
}

export function uninstallWorkplanTrailerPrePushHook(hookPath) {
  const target = path.resolve(hookPath);
  const hookDir = path.dirname(target);
  const sidecar = path.join(hookDir, WORKPLAN_TRAILER_HOOK_SIDECAR);
  if (!fs.existsSync(target)) return { status: 'not_installed', target, sidecar, restored: false };
  const current = fs.readFileSync(target, 'utf8');
  if (current !== renderWorkplanTrailerPrePushWrapper()) {
    if (current.includes('# machinespirits:workplan-trailer-hook:')) {
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
