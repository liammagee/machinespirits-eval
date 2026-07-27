import fs from 'node:fs';
import path from 'node:path';

import { loadWorld } from './dramaticDerivation/world.js';
import { TUTOR_PR_BENCHMARK_REPORT_SCHEMA } from './tutorStubPrBenchmark.js';
import { TUTOR_PR_BENCHMARK_REAUDIT_SCHEMA } from './tutorStubPrBenchmarkComparison.js';

export const TUTOR_PR_BENCHMARK_HOOK_MARKER = '# machinespirits:tutor-pr-benchmark-hook:v1';
export const TUTOR_PR_BENCHMARK_HOOK_SIDECAR = 'pre-push.machinespirits-before-tutor-pr-benchmark';
const HOOK_ENFORCEMENT = new Set(['report_only', 'blocking']);
const HOOK_REPORT_SCOPES = new Set(['git_common', 'worktree']);
const CACHEABLE_REPORT_STATUSES = new Set(['pass', 'fail', 'blocked', 'budget_exhausted']);
const ATTRIBUTABLE_REPORT_STATUSES = new Set(['pass', 'fail']);
const JAVASCRIPT_EXTENSIONS = new Set(['.js', '.mjs']);
const WORLD_DIRECTORY = 'config/drama-derivation';
const WORLD_FILE_PATTERN = /^world-.*\.yaml$/u;

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

export function isTutorPrBenchmarkWorldScopedPath(filePath) {
  const normalized = repositoryRelative(filePath, 'changed path');
  const directory = path.posix.dirname(normalized);
  return directory === WORLD_DIRECTORY && WORLD_FILE_PATTERN.test(path.posix.basename(normalized));
}

/**
 * Every benchmark case replays one authored world, so a world spec that no selected
 * case replays cannot change any job's inputs. Resolving coverage by the world's own
 * `id` rather than by filename keeps a renamed or duplicated spec honest, and an
 * unparseable spec stays covered so a broken world still reaches the gate.
 */
export function collectTutorPrBenchmarkCoveredWorldFiles({ root, worldIds }) {
  const wanted = new Set([...(worldIds || [])].map((id) => String(id).trim()).filter(Boolean));
  if (wanted.size === 0) throw new Error('benchmark world coverage requires at least one world id');
  const directory = path.resolve(root, WORLD_DIRECTORY);
  const covered = new Set();
  for (const name of fs.readdirSync(directory).sort()) {
    if (!WORLD_FILE_PATTERN.test(name)) continue;
    const relative = `${WORLD_DIRECTORY}/${name}`;
    let id = null;
    try {
      id = loadWorld(path.join(directory, name)).id;
    } catch {
      covered.add(relative);
      continue;
    }
    if (wanted.has(id)) covered.add(relative);
  }
  return covered;
}

export function isTutorPrBenchmarkHookRelevantPath(filePath, hookConfig) {
  const normalized = repositoryRelative(filePath, 'changed path');
  const matched =
    hookConfig.exactPaths.includes(normalized) ||
    hookConfig.pathPrefixes.some((prefix) => normalized.startsWith(prefix)) ||
    hookConfig.reachablePaths?.has(normalized) === true;
  if (!matched) return false;
  if (!hookConfig.coveredWorldFiles || !isTutorPrBenchmarkWorldScopedPath(normalized)) return true;
  return hookConfig.coveredWorldFiles.has(normalized);
}

export function summarizeTutorPrBenchmarkWorldCoverage({ paths, hookConfig }) {
  const uncovered = [...new Set(paths)]
    .filter((filePath) => isTutorPrBenchmarkWorldScopedPath(filePath))
    .filter((filePath) => hookConfig.coveredWorldFiles?.has(repositoryRelative(filePath, 'changed path')) !== true)
    .map((filePath) => repositoryRelative(filePath, 'changed path'))
    .sort();
  return { uncoveredWorldPaths: uncovered, coveredWorldIds: [...(hookConfig.coveredWorldIds || [])].sort() };
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

export function listCachedTutorPrBenchmarkHookReports({ hookReportRoot, excludeSha = null }) {
  let entries = [];
  try {
    entries = fs.readdirSync(hookReportRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const rows = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === excludeSha) continue;
    const reportPath = path.join(hookReportRoot, entry.name, 'report.json');
    const report = loadCachedTutorPrBenchmarkReport(reportPath, entry.name);
    if (!report || !ATTRIBUTABLE_REPORT_STATUSES.has(report.status)) continue;
    rows.push({ sha: entry.name, reportPath, status: report.status });
  }
  return rows.sort((left, right) => left.sha.localeCompare(right.sha));
}

/**
 * `distances` maps a candidate sha to its commit distance from HEAD, and omits any
 * commit that is not an ancestor. Nearest wins so the baseline is the most recent
 * commit whose responses were already judged, which keeps the attributed window as
 * small as the report cache allows.
 */
export function selectNearestTutorPrBenchmarkBaseline({ candidates, distances }) {
  const ranked = (candidates || [])
    .map((candidate) => ({ ...candidate, distance: distances?.get(candidate.sha) ?? null }))
    .filter((candidate) => Number.isInteger(candidate.distance) && candidate.distance >= 0)
    .sort((left, right) => left.distance - right.distance || left.sha.localeCompare(right.sha));
  return ranked[0] || null;
}

/**
 * A head failure mixes two causes the raw report cannot separate: fresh model
 * sampling and changed guard code. Re-auditing the baseline's saved candidates
 * holds the responses fixed, so a re-audit that moves nothing proves the guards
 * score identically and the failure is not this change's doing.
 */
export function classifyTutorPrBenchmarkAttribution({ baseline = null, reaudit = null, error = null } = {}) {
  if (!baseline) return { outcome: 'no_baseline', baseline: null, reaudit: null, detail: null };
  const base = { baselineSha: baseline.sha, baselineStatus: baseline.status, baselineDistance: baseline.distance };
  if (error) return { outcome: 'baseline_incomparable', ...base, detail: String(error.message || error) };
  if (reaudit?.schema !== TUTOR_PR_BENCHMARK_REAUDIT_SCHEMA) {
    return { outcome: 'baseline_incomparable', ...base, detail: 're-audit produced no comparable report' };
  }
  const improved = Number(reaudit.summary?.improved || 0);
  const regressed = Number(reaudit.summary?.regressed || 0);
  const candidates = Number(reaudit.summary?.candidates || 0);
  const counts = { improved, regressed, candidates };
  if (regressed > 0) return { outcome: 'audit_regressed', ...base, ...counts, detail: null };
  if (improved > 0) return { outcome: 'audit_improved', ...base, ...counts, detail: null };
  if (baseline.status === 'fail') return { outcome: 'standing', ...base, ...counts, detail: null };
  return { outcome: 'new_since_baseline', ...base, ...counts, detail: null };
}

export function describeTutorPrBenchmarkAttribution(attribution) {
  const sha = String(attribution?.baselineSha || '').slice(0, 12);
  const counts = `${attribution?.improved || 0} improved, ${attribution?.regressed || 0} regressed of ${attribution?.candidates || 0}`;
  switch (attribution?.outcome) {
    case 'standing':
      return `STANDING — baseline ${sha} already failed and its saved responses score identically under this change's audit code (${counts}, zero model calls)`;
    case 'new_since_baseline':
      return `NEW SINCE ${sha} — that baseline passed, and its saved responses still pass under this change's audit code (${counts}), so the difference is in the responses drawn at HEAD, not the guards`;
    case 'audit_regressed':
      return `ATTRIBUTABLE — this change's audit code fails responses that baseline ${sha} passed (${counts}, zero model calls)`;
    case 'audit_improved':
      return `NOT ATTRIBUTABLE TO THE GUARDS — this change's audit code only improves baseline ${sha} (${counts}), so the failure is in the responses drawn at HEAD`;
    case 'baseline_incomparable':
      return `UNATTRIBUTED — nearest baseline ${sha} is not comparable under the current plan (${attribution.detail})`;
    default:
      return 'UNATTRIBUTED — no cached ancestor report to re-audit; the next push from this branch will have one';
  }
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
