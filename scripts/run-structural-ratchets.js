#!/usr/bin/env node
/**
 * Run the structural ratchet tests: every test file under tests/ that caps a
 * source file's line count (`split('\n').length <` or `<=`). They finish in
 * about a second, and they are the checks a refactor trips without touching
 * behaviour. The pre-push lint hook runs them after the lint lane so a push
 * that CI would reject for a line cap stops on the machine instead (PR #985,
 * 2026-09-03, went red twice on a 12-line dedup in a 900-line facade).
 *
 *   npm run test:ratchets
 *   node scripts/run-structural-ratchets.js --list
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS_DIR = path.join(ROOT, 'tests');
const RATCHET_PATTERN = /split\('\\n'\)\.length\s*<=?\s*/u;

export function findStructuralRatchetTests(testsDir = TESTS_DIR) {
  return fs
    .readdirSync(testsDir)
    .filter((name) => name.endsWith('.test.js'))
    .filter((name) => RATCHET_PATTERN.test(fs.readFileSync(path.join(testsDir, name), 'utf8')))
    .sort()
    .map((name) => path.join('tests', name));
}

function main() {
  const files = findStructuralRatchetTests();
  if (process.argv.includes('--list')) {
    console.log(files.join('\n'));
    return;
  }
  if (files.length === 0) {
    console.error('structural ratchets: no line-cap tests found under tests/');
    return;
  }
  console.error(`structural ratchets: ${files.length} test file(s) with a line cap`);
  const result = spawnSync(process.execPath, ['--test', ...files], { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
