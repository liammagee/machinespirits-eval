#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  loadTestManifest,
  synchronizeTestManifest,
  TEST_MANIFEST_RELATIVE_PATH,
  validateTestManifest,
} from './hermetic-test-contract.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

export function runManifestSync(argv = process.argv.slice(2), projectRoot = PROJECT_ROOT) {
  const mode = argv[0] || '--check';
  if (!['--check', '--write'].includes(mode) || argv.length > 1) {
    throw new Error('Usage: node scripts/sync-hermetic-test-manifest.js [--check|--write]');
  }

  const manifestPath = path.join(projectRoot, TEST_MANIFEST_RELATIVE_PATH);
  const currentText = fs.readFileSync(manifestPath, 'utf8');
  const current = loadTestManifest(projectRoot, manifestPath);
  const synchronized = synchronizeTestManifest(current, projectRoot);
  validateTestManifest(synchronized, projectRoot);
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
