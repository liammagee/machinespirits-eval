import fs from 'node:fs';
import path from 'node:path';

import { TUTOR_PR_BENCHMARK_REPORT_SCHEMA } from './tutorStubPrBenchmark.js';

export const TUTOR_PR_BENCHMARK_HOOK_MARKER = '# machinespirits:tutor-pr-benchmark-hook:v1';
export const TUTOR_PR_BENCHMARK_HOOK_SIDECAR = 'pre-push.machinespirits-before-tutor-pr-benchmark';
const HOOK_ENFORCEMENT = new Set(['report_only', 'blocking']);
const CACHEABLE_REPORT_STATUSES = new Set(['pass', 'fail', 'blocked', 'budget_exhausted']);

function stringList(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !String(item || '').trim())) {
    throw new Error(`${label} must be a non-empty string list`);
  }
  return [...new Set(value.map((item) => String(item).trim()))];
}

function repositoryRelative(value, label) {
  const source = String(value || '')
    .trim()
    .replaceAll('\\', '/');
  if (!source || path.posix.isAbsolute(source)) throw new Error(`${label} must be a repository-relative path`);
  const normalized = path.posix.normalize(source).replace(/^\.\//u, '');
  if (normalized === '..' || normalized.startsWith('../')) throw new Error(`${label} escapes the repository root`);
  return normalized;
}

export function validateTutorPrBenchmarkHookConfig(config) {
  const hook = config?.hook;
  if (!hook || typeof hook !== 'object') throw new Error('benchmark config requires hook settings');
  if (!config.presets?.[hook.preset]) throw new Error(`hook references unknown preset ${hook.preset}`);
  if (!HOOK_ENFORCEMENT.has(hook.enforcement)) {
    throw new Error('hook.enforcement must be report_only or blocking');
  }
  if (!String(hook.base_ref || '').trim()) throw new Error('hook.base_ref is required');
  const reportRoot = repositoryRelative(hook.report_root, 'hook.report_root');
  const exactPaths = stringList(hook.exact_paths, 'hook.exact_paths').map((item, index) =>
    repositoryRelative(item, `hook.exact_paths[${index}]`),
  );
  const pathPrefixes = stringList(hook.path_prefixes, 'hook.path_prefixes').map((item, index) =>
    repositoryRelative(item, `hook.path_prefixes[${index}]`),
  );
  return {
    preset: hook.preset,
    enforcement: hook.enforcement,
    baseRef: String(hook.base_ref).trim(),
    reportRoot,
    exactPaths,
    pathPrefixes,
  };
}

export function isTutorPrBenchmarkHookRelevantPath(filePath, hookConfig) {
  const normalized = repositoryRelative(filePath, 'changed path');
  return (
    hookConfig.exactPaths.includes(normalized) ||
    hookConfig.pathPrefixes.some((prefix) => normalized.startsWith(prefix))
  );
}

export function parseTutorPrBenchmarkPrePushInput(source) {
  return String(source || '')
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const fields = line.split(/\s+/gu);
      if (fields.length !== 4) throw new Error(`invalid pre-push update: ${line}`);
      const [localRef, localOid, remoteRef, remoteOid] = fields;
      return { localRef, localOid, remoteRef, remoteOid };
    });
}

export function loadCachedTutorPrBenchmarkReport(reportPath, headOid) {
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (
      report?.schema === TUTOR_PR_BENCHMARK_REPORT_SCHEMA &&
      CACHEABLE_REPORT_STATUSES.has(report?.status) &&
      report?.metadata?.gitSha === headOid
    ) {
      return report;
    }
    return null;
  } catch {
    return null;
  }
}

export function isCachedTutorPrBenchmarkPass(reportPath, headOid) {
  return loadCachedTutorPrBenchmarkReport(reportPath, headOid)?.status === 'pass';
}

export function classifyTutorPrBenchmarkHookReport(report, enforcement) {
  if (report?.status === 'pass') return 'allow';
  if (report?.status === 'fail' && enforcement === 'report_only') return 'warn';
  return 'block';
}

export function renderTutorPrBenchmarkPrePushWrapper() {
  return `#!/bin/sh
set -u

${TUTOR_PR_BENCHMARK_HOOK_MARKER}
hook_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)" || exit 2
hook_input="$(mktemp "${'${TMPDIR:-/tmp}'}/machinespirits-pre-push.XXXXXX")" || exit 2
trap 'rm -f "$hook_input"' 0 1 2 15
cat > "$hook_input" || exit 2

previous_hook="$hook_dir/${TUTOR_PR_BENCHMARK_HOOK_SIDECAR}"
if [ -f "$previous_hook" ]; then
  "$previous_hook" "$@" < "$hook_input" || exit $?
fi

repo_root="$(git rev-parse --show-toplevel)" || exit 2
benchmark_hook="$repo_root/scripts/tutor-pr-benchmark-hook.js"
if [ -f "$benchmark_hook" ]; then
  node "$benchmark_hook" pre-push "$@" < "$hook_input"
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

export function installTutorPrBenchmarkPrePushHook(hookPath) {
  const target = path.resolve(hookPath);
  const hookDir = path.dirname(target);
  const sidecar = path.join(hookDir, TUTOR_PR_BENCHMARK_HOOK_SIDECAR);
  const wrapper = renderTutorPrBenchmarkPrePushWrapper();
  fs.mkdirSync(hookDir, { recursive: true });
  if (fs.existsSync(target)) {
    const current = fs.readFileSync(target, 'utf8');
    if (current === wrapper) return { status: 'already_installed', target, sidecar, preserved: fs.existsSync(sidecar) };
    if (current.includes('# machinespirits:tutor-pr-benchmark-hook:')) {
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

export function uninstallTutorPrBenchmarkPrePushHook(hookPath) {
  const target = path.resolve(hookPath);
  const sidecar = path.join(path.dirname(target), TUTOR_PR_BENCHMARK_HOOK_SIDECAR);
  if (!fs.existsSync(target)) return { status: 'not_installed', target, sidecar, restored: false };
  const current = fs.readFileSync(target, 'utf8');
  if (current !== renderTutorPrBenchmarkPrePushWrapper()) {
    if (current.includes('# machinespirits:tutor-pr-benchmark-hook:')) {
      throw new Error(`managed pre-push hook was modified; refusing to overwrite it: ${target}`);
    }
    return { status: 'not_installed', target, sidecar, restored: false };
  }
  fs.unlinkSync(target);
  const restored = fs.existsSync(sidecar);
  if (restored) fs.renameSync(sidecar, target);
  return { status: 'uninstalled', target, sidecar, restored };
}
