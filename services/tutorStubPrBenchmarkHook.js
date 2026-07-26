import fs from 'node:fs';
import path from 'node:path';

import { TUTOR_PR_BENCHMARK_REPORT_SCHEMA } from './tutorStubPrBenchmark.js';

export const TUTOR_PR_BENCHMARK_HOOK_MARKER = '# machinespirits:tutor-pr-benchmark-hook:v1';
export const TUTOR_PR_BENCHMARK_HOOK_SIDECAR = 'pre-push.machinespirits-before-tutor-pr-benchmark';
const HOOK_ENFORCEMENT = new Set(['report_only', 'blocking']);
const HOOK_REPORT_SCOPES = new Set(['git_common', 'worktree']);
const CACHEABLE_REPORT_STATUSES = new Set(['pass', 'fail', 'blocked', 'budget_exhausted']);
const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.mjs']);

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
  if (!HOOK_REPORT_SCOPES.has(hook.report_scope)) {
    throw new Error('hook.report_scope must be git_common or worktree');
  }
  const reportRoot = repositoryRelative(hook.report_root, 'hook.report_root');
  const exactPaths = stringList(hook.exact_paths, 'hook.exact_paths').map((item, index) =>
    repositoryRelative(item, `hook.exact_paths[${index}]`),
  );
  const pathPrefixes = stringList(hook.path_prefixes, 'hook.path_prefixes').map((item, index) =>
    repositoryRelative(item, `hook.path_prefixes[${index}]`),
  );
  const importRoots = stringList(hook.import_roots, 'hook.import_roots').map((item, index) =>
    repositoryRelative(item, `hook.import_roots[${index}]`),
  );
  return {
    preset: hook.preset,
    enforcement: hook.enforcement,
    baseRef: String(hook.base_ref).trim(),
    reportScope: hook.report_scope,
    reportRoot,
    exactPaths,
    pathPrefixes,
    importRoots,
  };
}

export function isTutorPrBenchmarkHookRelevantPath(filePath, hookConfig) {
  const normalized = repositoryRelative(filePath, 'changed path');
  return (
    hookConfig.exactPaths.includes(normalized) ||
    hookConfig.pathPrefixes.some((prefix) => normalized.startsWith(prefix)) ||
    hookConfig.reachablePaths?.has(normalized) === true
  );
}

function extractStaticRelativeSpecifiers(source) {
  const specifiers = [];
  let statement = '';
  const capture = (candidate) => {
    const fromMatch = candidate.match(/\bfrom\s*(['"])(\.[^'"]+)\1/u);
    const sideEffectMatch = candidate.match(/^\s*import\s*(['"])(\.[^'"]+)\1/u);
    const match = fromMatch || sideEffectMatch;
    if (match) specifiers.push(match[2]);
  };
  for (const line of String(source || '').split(/\r?\n/gu)) {
    if (!statement) {
      if (!/^\s*(?:import\b|export\s+(?:\*|\{))/u.test(line)) continue;
      statement = line;
    } else {
      statement += `\n${line}`;
    }
    if (statement.includes(';')) {
      capture(statement.slice(0, statement.indexOf(';') + 1));
      statement = '';
    }
  }
  if (statement) capture(statement);
  return [...new Set(specifiers)];
}

function resolveStaticRelativeModule(importer, specifier) {
  const clean = specifier.split(/[?#]/u, 1)[0];
  const base = path.resolve(path.dirname(importer), clean);
  const candidates = path.extname(base)
    ? [base]
    : [`${base}.js`, `${base}.mjs`, path.join(base, 'index.js'), path.join(base, 'index.mjs')];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

export function collectTutorPrBenchmarkReachablePaths({ root, entryPaths }) {
  const repoRoot = path.resolve(root);
  const pending = entryPaths.map((entryPath, index) =>
    path.resolve(repoRoot, repositoryRelative(entryPath, `entryPaths[${index}]`)),
  );
  const visited = new Set();
  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    const relative = path.relative(repoRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`benchmark import escapes repository root: ${file}`);
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`benchmark import root or dependency is missing: ${relative}`);
    }
    visited.add(file);
    if (!JAVASCRIPT_EXTENSIONS.has(path.extname(file))) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const specifier of extractStaticRelativeSpecifiers(source)) {
      const target = resolveStaticRelativeModule(file, specifier);
      if (target) pending.push(target);
    }
  }
  return new Set([...visited].map((file) => path.relative(repoRoot, file).split(path.sep).join('/')).sort());
}

export function resolveTutorPrBenchmarkReportRoot({ root, reportRoot, reportScope, gitCommonDir = null }) {
  const relative = repositoryRelative(reportRoot, 'report root');
  if (reportScope === 'worktree') return path.resolve(root, relative);
  if (reportScope !== 'git_common') throw new Error(`unsupported report scope ${reportScope}`);
  if (!String(gitCommonDir || '').trim()) throw new Error('git common directory is required for git_common reports');
  const common = path.isAbsolute(gitCommonDir) ? gitCommonDir : path.resolve(root, gitCommonDir);
  return path.resolve(common, relative);
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
