#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildTutorPrBenchmarkPlan, loadTutorPrBenchmarkConfig } from '../services/tutorStubPrBenchmark.js';
import {
  classifyTutorPrBenchmarkAttribution,
  classifyTutorPrBenchmarkHookReport,
  collectTutorPrBenchmarkCoveredWorldFiles,
  collectTutorPrBenchmarkHookOnlyPaths,
  collectTutorPrBenchmarkReachablePaths,
  describeTutorPrBenchmarkAttribution,
  installTutorPrBenchmarkPrePushHook,
  isTutorPrBenchmarkHookRelevantPath,
  listCachedTutorPrBenchmarkHookReports,
  loadCachedTutorPrBenchmarkReport,
  parseTutorPrBenchmarkPrePushInput,
  partitionTutorPrBenchmarkRelevance,
  resolveTutorPrBenchmarkReportRoot,
  selectNearestTutorPrBenchmarkBaseline,
  summarizeTutorPrBenchmarkWorldCoverage,
  uninstallTutorPrBenchmarkPrePushHook,
  validateTutorPrBenchmarkHookConfig,
} from '../services/tutorStubPrBenchmarkHook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'tutor-pr-benchmark.yaml');
const ZERO_OID = /^0+$/u;

function usage() {
  return `Usage: node scripts/tutor-pr-benchmark-hook.js <command>

Commands:
  install     Preserve any existing pre-push hook and install the benchmark wrapper
  uninstall   Remove the managed wrapper and restore the preserved pre-push hook
  pre-push    Run the scoped benchmark gate (called by the installed Git hook)
  help        Show this help`;
}

function runGit(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return String(result.stdout || '').trim();
}

function gitLines(args) {
  const source = runGit(args);
  return source ? source.split(/\r?\n/gu).filter(Boolean) : [];
}

function gitSucceeds(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.error) throw result.error;
  return result.status === 0;
}

function ancestorDistances(shas, headOid) {
  const distances = new Map();
  for (const sha of shas) {
    if (sha === headOid || !gitSucceeds(['merge-base', '--is-ancestor', sha, headOid])) continue;
    distances.set(sha, Number.parseInt(runGit(['rev-list', '--count', `${sha}..${headOid}`]), 10));
  }
  return distances;
}

function managedHookPath() {
  const value = runGit(['rev-parse', '--git-path', 'hooks/pre-push']);
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

function relevantPaths(paths, hookConfig) {
  return [...new Set(paths)].filter((filePath) => isTutorPrBenchmarkHookRelevantPath(filePath, hookConfig));
}

function pushedRelevantChanges(updates, hookConfig) {
  const paths = new Set();
  const oids = new Set();
  const uncoveredWorldPaths = new Set();
  for (const update of updates) {
    if (!update.localRef.startsWith('refs/heads/') || ZERO_OID.test(update.localOid)) continue;
    const base = ZERO_OID.test(update.remoteOid)
      ? runGit(['merge-base', hookConfig.baseRef, update.localOid])
      : update.remoteOid;
    const changed = gitLines(['diff', '--name-only', '--no-renames', base, update.localOid, '--']);
    for (const filePath of summarizeTutorPrBenchmarkWorldCoverage({ paths: changed, hookConfig }).uncoveredWorldPaths) {
      uncoveredWorldPaths.add(filePath);
    }
    const relevant = relevantPaths(changed, hookConfig);
    if (relevant.length > 0) {
      oids.add(update.localOid);
      for (const filePath of relevant) paths.add(filePath);
    }
  }
  return { paths: [...paths], oids: [...oids], uncoveredWorldPaths: [...uncoveredWorldPaths] };
}

function relevantDirtyPaths(hookConfig) {
  return relevantPaths(
    [...gitLines(['diff', '--name-only', 'HEAD', '--']), ...gitLines(['ls-files', '--others', '--exclude-standard'])],
    hookConfig,
  );
}

function bypassRequested() {
  if (process.env.TUTOR_PR_BENCHMARK_HOOK_BYPASS !== '1') return false;
  const reason = String(process.env.TUTOR_PR_BENCHMARK_HOOK_BYPASS_REASON || '').trim();
  if (!reason) {
    throw new Error('TUTOR_PR_BENCHMARK_HOOK_BYPASS_REASON is required when bypassing the benchmark hook');
  }
  console.error(`tutor PR benchmark hook: BYPASSED — ${reason}`);
  return true;
}

/**
 * The head report alone cannot say whether a failure is new: it mixes freshly drawn
 * responses with whatever the guards now do. Re-auditing the nearest cached ancestor's
 * saved responses under current code varies only the guards, and costs no model calls.
 */
function reauditBaseline(baseline, reportDir) {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/run-tutor-pr-benchmark.js',
      '--reaudit-report',
      baseline.reportPath,
      '--out',
      path.join(reportDir, 'attribution'),
      '--json',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.error) throw result.error;
  try {
    return { reaudit: JSON.parse(result.stdout), error: null };
  } catch {
    const stderr = String(result.stderr || '')
      .trim()
      .split(/\r?\n/gu)
      .filter(Boolean);
    return { reaudit: null, error: new Error(stderr.at(-1) || `re-audit exited ${result.status}`) };
  }
}

function reportQualityFailure({ headline, reportPath, reportDir, headOid, hookReportRoot, hookConfig, relevant }) {
  console.error(`tutor PR benchmark hook: ${headline} — calibration mode allows push (${reportPath})`);
  const candidates = listCachedTutorPrBenchmarkHookReports({ hookReportRoot, excludeSha: headOid });
  const baseline = selectNearestTutorPrBenchmarkBaseline({
    candidates,
    distances: ancestorDistances(
      candidates.map((candidate) => candidate.sha),
      headOid,
    ),
  });
  const { reaudit, error } = baseline ? reauditBaseline(baseline, reportDir) : { reaudit: null, error: null };
  const attribution = classifyTutorPrBenchmarkAttribution({ baseline, reaudit, error });
  console.error(`tutor PR benchmark hook: ${describeTutorPrBenchmarkAttribution(attribution)}`);
  const { requestChanging } = partitionTutorPrBenchmarkRelevance({ paths: relevant.paths, hookConfig });
  if (baseline && requestChanging.length > 0) {
    console.error(
      `tutor PR benchmark hook: the re-audit varies audit code only; these pushed paths change the benchmark request itself, so only the HEAD run measures them: ${requestChanging.join(', ')}`,
    );
  }
}

function prePush() {
  if (bypassRequested()) return;
  const loaded = loadTutorPrBenchmarkConfig(CONFIG_PATH);
  const hookConfig = validateTutorPrBenchmarkHookConfig(loaded.config);
  hookConfig.reachablePaths = collectTutorPrBenchmarkReachablePaths({
    root: ROOT,
    entryPaths: hookConfig.importRoots,
  });
  hookConfig.hookOnlyPaths = collectTutorPrBenchmarkHookOnlyPaths({
    root: ROOT,
    hookEntryPaths: [
      path
        .relative(ROOT, fileURLToPath(import.meta.url))
        .split(path.sep)
        .join('/'),
    ],
    reachablePaths: hookConfig.reachablePaths,
  });
  const plan = buildTutorPrBenchmarkPlan({ config: loaded.config, root: ROOT, preset: hookConfig.preset });
  hookConfig.coveredWorldIds = new Set(plan.jobs.map((job) => job.benchmarkCase.worldId));
  hookConfig.coveredWorldFiles = collectTutorPrBenchmarkCoveredWorldFiles({
    root: ROOT,
    worldIds: hookConfig.coveredWorldIds,
  });
  const input = fs.readFileSync(0, 'utf8');
  const updates = parseTutorPrBenchmarkPrePushInput(input);
  const relevant = pushedRelevantChanges(updates, hookConfig);
  if (relevant.uncoveredWorldPaths.length > 0) {
    console.error(
      `tutor PR benchmark hook: not measurable by the ${hookConfig.preset} preset (it replays ${[...hookConfig.coveredWorldIds].sort().join(', ')} only): ${relevant.uncoveredWorldPaths.join(', ')}`,
    );
  }
  if (relevant.paths.length === 0) {
    console.error('tutor PR benchmark hook: skipped (no benchmark-relevant pushed paths)');
    return;
  }
  const headOid = runGit(['rev-parse', 'HEAD']);
  if (relevant.oids.length !== 1 || relevant.oids[0] !== headOid) {
    throw new Error('benchmark-relevant pushes must point to the checked-out HEAD');
  }
  const dirty = relevantDirtyPaths(hookConfig);
  if (dirty.length > 0) {
    throw new Error(`benchmark-relevant worktree paths are dirty: ${dirty.join(', ')}`);
  }
  const hookReportRoot = path.join(
    resolveTutorPrBenchmarkReportRoot({
      root: ROOT,
      reportRoot: hookConfig.reportRoot,
      reportScope: hookConfig.reportScope,
      gitCommonDir: runGit(['rev-parse', '--git-common-dir']),
    }),
    'hook',
  );
  const reportDir = path.join(hookReportRoot, headOid);
  const reportPath = path.join(reportDir, 'report.json');
  const cached = loadCachedTutorPrBenchmarkReport(reportPath, headOid);
  const cachedDisposition = classifyTutorPrBenchmarkHookReport(cached, hookConfig.enforcement);
  if (cachedDisposition === 'allow') {
    console.error(`tutor PR benchmark hook: cached pass for ${headOid.slice(0, 12)}`);
    return;
  }
  if (cachedDisposition === 'warn') {
    reportQualityFailure({
      headline: `cached quality failure for ${headOid.slice(0, 12)}`,
      reportPath,
      reportDir,
      headOid,
      hookReportRoot,
      hookConfig,
      relevant,
    });
    return;
  }
  console.error(
    `tutor PR benchmark hook: running ${hookConfig.preset} preset for ${relevant.paths.length} relevant path(s) at ${headOid.slice(0, 12)}`,
  );
  const result = spawnSync(
    process.execPath,
    ['scripts/run-tutor-pr-benchmark.js', '--preset', hookConfig.preset, '--out', reportDir],
    { cwd: ROOT, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  const completed = loadCachedTutorPrBenchmarkReport(reportPath, headOid);
  const completedDisposition = classifyTutorPrBenchmarkHookReport(completed, hookConfig.enforcement);
  if (completedDisposition === 'warn') {
    reportQualityFailure({
      headline: 'QUALITY WARNING',
      reportPath,
      reportDir,
      headOid,
      hookReportRoot,
      hookConfig,
      relevant,
    });
    return;
  }
  if (result.status !== 0 || completedDisposition !== 'allow') {
    throw new Error(
      `benchmark did not pass; inspect ${reportPath} or use a reasoned TUTOR_PR_BENCHMARK_HOOK_BYPASS only when necessary`,
    );
  }
  console.error(`tutor PR benchmark hook: pass for ${headOid.slice(0, 12)} (${reportPath})`);
}

function main() {
  const command = process.argv[2] || 'help';
  if (command === 'help' || command === '--help') {
    console.log(usage());
    return;
  }
  if (command === 'install') {
    const result = installTutorPrBenchmarkPrePushHook(managedHookPath());
    console.log(`tutor PR benchmark hook: ${result.status} at ${result.target}`);
    if (result.preserved) console.log(`preserved prior hook: ${result.sidecar}`);
    return;
  }
  if (command === 'uninstall') {
    const result = uninstallTutorPrBenchmarkPrePushHook(managedHookPath());
    console.log(`tutor PR benchmark hook: ${result.status} at ${result.target}`);
    if (result.restored) console.log(`restored prior hook from: ${result.sidecar}`);
    return;
  }
  if (command === 'pre-push') {
    prePush();
    return;
  }
  throw new Error(`unknown command ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`tutor PR benchmark hook error: ${error.message}`);
  process.exitCode = 2;
}
