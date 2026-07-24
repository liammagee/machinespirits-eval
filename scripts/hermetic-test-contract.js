import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_TEST_DIRECTORIES = ['services/__tests__', 'tests'];
export const CORE_TEST_DIRECTORY = 'tutor-core/services/__tests__';
export const TEST_MANIFEST_RELATIVE_PATH = 'config/hermetic-test-manifest.json';
const DEFAULT_PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_SCAN_EXCLUDED_DIRECTORIES = new Set([
  '.git',
  'coverage',
  'data',
  'dist',
  'exports',
  'logs',
  'node_modules',
  'vendor',
]);

function discoverImmediateTests(projectRoot, directory) {
  return fs
    .readdirSync(path.join(projectRoot, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

export function discoverRootTestFiles(projectRoot = DEFAULT_PROJECT_ROOT) {
  return ROOT_TEST_DIRECTORIES.flatMap((directory) => discoverImmediateTests(projectRoot, directory));
}

export function discoverCoreTestFiles(projectRoot = DEFAULT_PROJECT_ROOT) {
  return discoverImmediateTests(projectRoot, CORE_TEST_DIRECTORY);
}

function discoverTestsRecursively(projectRoot, directory) {
  const absoluteDirectory = path.join(projectRoot, directory);
  if (!fs.existsSync(absoluteDirectory)) return [];
  const files = [];
  const visit = (currentDirectory) => {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      if (entry.isDirectory() && TEST_SCAN_EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        files.push(path.relative(projectRoot, absolutePath));
      }
    }
  };
  visit(absoluteDirectory);
  return files.sort();
}

export function discoverAllContractTestFiles(projectRoot) {
  return discoverTestsRecursively(projectRoot, '.');
}

export function loadTestManifest(
  projectRoot = DEFAULT_PROJECT_ROOT,
  manifestPath = path.join(projectRoot, TEST_MANIFEST_RELATIVE_PATH),
) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function listDifference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function assertExactFiles(label, expected, actual) {
  const missing = listDifference(expected, actual);
  const extra = listDifference(actual, expected);
  if (missing.length === 0 && extra.length === 0) return;
  const details = [
    `${label} test manifest drift`,
    ...(missing.length ? [`missing: ${missing.join(', ')}`] : []),
    ...(extra.length ? [`extra: ${extra.join(', ')}`] : []),
  ];
  throw new Error(details.join('; '));
}

function assertStringList(value, label, { allowEmpty = false } = {}) {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.some((entry) => typeof entry !== 'string' || !entry)
  ) {
    throw new Error(`${label} must be ${allowEmpty ? 'a' : 'a non-empty'} string array`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicates`);
}

export function validateTestManifest(manifest, projectRoot) {
  if (manifest?.version !== 1) throw new Error('hermetic test manifest version must be 1');
  const rootRequired = manifest?.suites?.root?.requiredFiles;
  const coreRequired = manifest?.suites?.core?.requiredFiles;
  assertStringList(rootRequired, 'root requiredFiles');
  assertStringList(coreRequired, 'core requiredFiles');

  const fixtureExclusions = manifest.fixtureExclusions;
  if (!Array.isArray(fixtureExclusions)) throw new Error('fixtureExclusions must be an array');
  const excludedFiles = fixtureExclusions.map((entry, index) => {
    if (!entry?.file || !entry?.owner || !entry?.reason) {
      throw new Error(`fixtureExclusions[${index}] must declare file, owner, and reason`);
    }
    return entry.file;
  });
  assertStringList(excludedFiles, 'fixture exclusion files', { allowEmpty: true });

  const allowedSkips = manifest.allowedSkips;
  if (!Array.isArray(allowedSkips)) throw new Error('allowedSkips must be an array');
  const skipIds = [];
  for (const [index, entry] of allowedSkips.entries()) {
    if (!entry?.id || !['root', 'core'].includes(entry.suite) || !entry.owner || !entry.reason || !entry.removalSlice) {
      throw new Error(`allowedSkips[${index}] must declare id, suite, owner, reason, and removalSlice`);
    }
    if (!entry.testPattern && !entry.reasonPattern) {
      throw new Error(`allowedSkips[${index}] must declare testPattern or reasonPattern`);
    }
    for (const key of ['testPattern', 'reasonPattern']) {
      if (entry[key]) new RegExp(entry[key], 'u');
    }
    skipIds.push(entry.id);
  }
  assertStringList(skipIds, 'allowed skip ids', { allowEmpty: true });

  const classifiedFiles = [...rootRequired, ...coreRequired, ...excludedFiles];
  if (new Set(classifiedFiles).size !== classifiedFiles.length) {
    throw new Error('test files must belong to exactly one root, core, or fixture-exclusion class');
  }

  const rootFiles = discoverRootTestFiles(projectRoot);
  const coreFiles = discoverCoreTestFiles(projectRoot);
  assertExactFiles('root', rootRequired, rootFiles);
  assertExactFiles('core', coreRequired, coreFiles);

  const allFiles = discoverAllContractTestFiles(projectRoot);
  assertExactFiles('classified', classifiedFiles.sort(), allFiles);

  return { rootFiles, coreFiles, excludedFiles, allowedSkips };
}

export function parseNodeTapSummary(output) {
  const summary = {
    tests: null,
    suites: null,
    pass: null,
    fail: null,
    cancelled: null,
    skipped: null,
    todo: null,
    skipEvents: [],
  };
  for (const line of String(output).split(/\r?\n/u)) {
    const countMatch = line.trim().match(/^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)$/u);
    if (countMatch) summary[countMatch[1]] = Number(countMatch[2]);
    const skipMatch = line.match(/^\s*ok\s+\d+\s+-\s+(.+?)\s+# SKIP(?:\s+(.*?))?\s*$/u);
    if (skipMatch) summary.skipEvents.push({ test: skipMatch[1].trim(), reason: (skipMatch[2] || '').trim() });
  }
  if (!Number.isInteger(summary.tests)) throw new Error('root Node test output omitted the TAP test summary');
  return summary;
}

export function parseVitestJsonSummary(reportText, projectRoot) {
  const report = JSON.parse(reportText);
  const skipEvents = [];
  for (const testResult of report.testResults || []) {
    for (const assertion of testResult.assertionResults || []) {
      if (!['pending', 'skipped', 'todo'].includes(assertion.status)) continue;
      skipEvents.push({
        test: assertion.fullName || assertion.title || '(unnamed Vitest test)',
        reason: (assertion.failureMessages || []).join('; '),
      });
    }
  }
  return {
    tests: Number(report.numTotalTests),
    suites: Number(report.numTotalTestSuites),
    pass: Number(report.numPassedTests),
    fail: Number(report.numFailedTests),
    cancelled: 0,
    skipped: Number(report.numPendingTests),
    todo: Number(report.numTodoTests),
    skipEvents,
    files: (report.testResults || []).map((result) => path.relative(projectRoot, result.name)).sort(),
  };
}

function hostConditionMatches(entry, { env, platform }) {
  if (entry.platforms && !entry.platforms.includes(platform)) return false;
  if (entry.environmentPresent && !entry.environmentPresent.every((key) => Boolean(env[key]))) return false;
  return true;
}

function skipMatches(entry, skip, host) {
  if (!hostConditionMatches(entry, host)) return false;
  if (entry.testPattern && !new RegExp(entry.testPattern, 'u').test(skip.test)) return false;
  if (entry.reasonPattern && !new RegExp(entry.reasonPattern, 'u').test(skip.reason)) return false;
  return true;
}

export function validatePhaseSummary({
  phase,
  summary,
  selectedFiles,
  allowedSkips,
  env = process.env,
  platform = process.platform,
  requireExactFiles = true,
}) {
  if (!Number.isInteger(summary.tests) || summary.tests <= 0) {
    throw new Error(`${phase} required test phase executed zero tests`);
  }
  if (requireExactFiles && Array.isArray(summary.files)) {
    assertExactFiles(`${phase} executed`, [...selectedFiles].sort(), summary.files);
  }

  const host = { env, platform };
  const matchedSkips = summary.skipEvents.map((skip) => {
    const ledger = allowedSkips.find((entry) => entry.suite === phase && skipMatches(entry, skip, host));
    if (!ledger) {
      const suffix = skip.reason ? ` (${skip.reason})` : '';
      throw new Error(`${phase} encountered undeclared skip: ${skip.test}${suffix}`);
    }
    return { ...skip, ledger };
  });
  if (phase === 'core' && summary.skipped !== matchedSkips.length) {
    throw new Error(`core skip accounting drift: report=${summary.skipped}, named=${matchedSkips.length}`);
  }
  return { ...summary, selectedFileCount: selectedFiles.length, matchedSkips };
}

export function printPhaseSummary(phase, summary) {
  console.log(
    `[test:hermetic] ${phase} summary files=${summary.selectedFileCount} tests=${summary.tests} pass=${summary.pass} fail=${summary.fail} skips=${summary.matchedSkips.length}`,
  );
  if (summary.matchedSkips.length === 0) {
    console.log(`[test:hermetic] ${phase} skip reasons: none`);
    return;
  }
  for (const skip of summary.matchedSkips) {
    console.log(
      `[test:hermetic] ${phase} skip: ${skip.test} — ${skip.reason || skip.ledger.reason} [${skip.ledger.id}; owner=${skip.ledger.owner}; removal=${skip.ledger.removalSlice}]`,
    );
  }
}
