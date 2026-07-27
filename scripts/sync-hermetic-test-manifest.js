#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  loadTestManifest,
  synchronizeTestManifest,
  TEST_MANIFEST_RELATIVE_PATH,
  TestInventoryDriftError,
  validateTestManifest,
} from './hermetic-test-contract.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUITE_DIRECTORIES = 'services/__tests__/ or tests/ (root suite), or tutor-core/services/__tests__/ (core suite)';

function listDifference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

export function describeManifestChanges(current, synchronized) {
  const lines = [];
  for (const suite of ['root', 'core']) {
    const before = current.suites[suite].requiredFiles;
    const after = synchronized.suites[suite].requiredFiles;
    const added = listDifference(after, before);
    const removed = listDifference(before, after);
    if (added.length) lines.push(`${suite} added: ${added.join(', ')}`);
    if (removed.length) lines.push(`${suite} removed: ${removed.join(', ')}`);
  }
  return lines;
}

function replaceRequiredFiles(manifestText, suite, files) {
  const suiteMarker = `"${suite}": {`;
  const suiteStart = manifestText.indexOf(suiteMarker);
  const requiredMarker = '"requiredFiles": [';
  const requiredStart = manifestText.indexOf(requiredMarker, suiteStart);
  const requiredEnd = manifestText.indexOf(']', requiredStart);
  if (suiteStart < 0 || requiredStart < 0 || requiredEnd < 0) {
    throw new Error(`unable to locate ${suite} requiredFiles in ${TEST_MANIFEST_RELATIVE_PATH}`);
  }
  const indentation = '        ';
  const rendered = `${requiredMarker}\n${files
    .map((file) => `${indentation}${JSON.stringify(file)}`)
    .join(',\n')}\n      ]`;
  return `${manifestText.slice(0, requiredStart)}${rendered}${manifestText.slice(requiredEnd + 1)}`;
}

export function renderSynchronizedManifest(currentText, synchronized) {
  let rendered = currentText;
  for (const suite of ['root', 'core']) {
    rendered = replaceRequiredFiles(rendered, suite, synchronized.suites[suite].requiredFiles);
  }
  return rendered;
}

/**
 * The one drift `--write` cannot repair. Synchronization refills the two suite
 * lists from their own directories, so a test file living anywhere else stays
 * unclassified however often it is run, and a manifest entry naming a file the
 * scan cannot see stays unmatched.
 *
 * Reported here because leaving it to the top-level handler printed an
 * ordinary, actionable result in the register of an internal failure — "Unable
 * to synchronize hermetic test manifest: …" — and named no remedy, while the
 * two suite-level drift classes both name one.
 */
function reportUnclassifiedTests(drift, projectRoot) {
  const onDisk = (file) => fs.existsSync(path.join(projectRoot, file));
  const absent = drift.missing.filter((file) => !onDisk(file));
  const unscanned = drift.missing.filter(onDisk);

  console.error('Hermetic test manifest does not account for every test file.');
  for (const file of drift.extra) console.error(`- on disk, in no class: ${file}`);
  for (const file of absent) console.error(`- classified, not on disk: ${file}`);
  for (const file of unscanned) console.error(`- classified, but the scan cannot see it: ${file}`);

  if (drift.extra.length) {
    console.error(
      `Move each unclassified file into ${SUITE_DIRECTORIES}, then run \`npm run test:manifest:update\`. A test that is deliberately never run belongs instead in fixtureExclusions in ${TEST_MANIFEST_RELATIVE_PATH}, with an owner and a reason.`,
    );
  }
  if (absent.length) {
    console.error(`Drop the entries naming files that no longer exist from ${TEST_MANIFEST_RELATIVE_PATH}.`);
  }
  if (unscanned.length) {
    console.error(
      'The scan passes over whatever git ignores and whatever sits under an excluded directory. Un-ignore or move each file, or drop the entry that names it.',
    );
  }
  return 1;
}

export function runManifestSync(argv = process.argv.slice(2), projectRoot = PROJECT_ROOT) {
  const mode = argv[0] || '--check';
  if (!['--check', '--write'].includes(mode) || argv.length > 1) {
    throw new Error('Usage: node scripts/sync-hermetic-test-manifest.js [--check|--write]');
  }

  const manifestPath = path.join(projectRoot, TEST_MANIFEST_RELATIVE_PATH);
  const currentText = fs.readFileSync(manifestPath, 'utf8');
  const current = loadTestManifest(projectRoot, manifestPath);
  const synchronized = synchronizeTestManifest(current, projectRoot);
  try {
    validateTestManifest(synchronized, projectRoot);
  } catch (error) {
    // Both suite lists were just refilled from disk, so their checks cannot fail
    // on the synchronized manifest and `classified` is the only drift class left
    // to reach here. Anything else is a genuinely broken manifest and still goes
    // to the top-level handler.
    if (!(error instanceof TestInventoryDriftError) || error.label !== 'classified') throw error;
    return reportUnclassifiedTests(error, projectRoot);
  }
  const changes = describeManifestChanges(current, synchronized);

  if (changes.length === 0) {
    console.log('Hermetic test manifest is synchronized.');
    return 0;
  }

  if (mode === '--write') {
    fs.writeFileSync(manifestPath, renderSynchronizedManifest(currentText, synchronized));
    console.log(`Updated ${TEST_MANIFEST_RELATIVE_PATH}.`);
    for (const change of changes) console.log(`- ${change}`);
    return 0;
  }

  console.error('Hermetic test manifest is stale.');
  for (const change of changes) console.error(`- ${change}`);
  console.error('Run `npm run test:manifest:update`, review the inventory change, and commit it.');
  return 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.exitCode = runManifestSync();
  } catch (error) {
    console.error(`Unable to synchronize hermetic test manifest: ${error.message}`);
    process.exitCode = 1;
  }
}
