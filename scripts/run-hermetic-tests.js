#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'machinespirits-tests-'));
const testFiles = ['services/__tests__', 'tests'].flatMap((directory) =>
  fs
    .readdirSync(path.join(process.cwd(), directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
    .map((entry) => path.join(directory, entry.name)),
);
const defaults = ['--test', '--test-force-exit', ...testFiles];
const forwarded = process.argv.slice(2);
const testArgs = forwarded.length ? ['--test', '--test-force-exit', ...forwarded] : defaults;
const isolatedPaths = {
  EVAL_DB_PATH: path.join(root, 'evaluations.db'),
  EVAL_LOGS_DIR: path.join(root, 'logs'),
  EVAL_WRITING_PAD_DIR: path.join(root, 'writing-pad'),
  EVAL_EXPORTS_DIR: path.join(root, 'exports'),
  AUTH_DB_PATH: path.join(root, 'auth.db'),
  TUTOR_CORE_LOG_DIR: path.join(root, 'tutor-core-logs'),
  TUTOR_STUB_TRACE_DIR: path.join(root, 'tutor-stub-traces'),
  TUTOR_STUB_EVAL_INDEX_ROOT: path.join(root, 'tutor-stub-auto-eval'),
  TUTOR_STUB_EVAL_TRACE_DIR: path.join(root, 'tutor-stub-auto-eval'),
};
const env = {
  ...process.env,
  ...isolatedPaths,
  MACHINESPIRITS_HERMETIC_TEST_ROOT: root,
};

if (forwarded.length === 1 && forwarded[0] === '--print-env') {
  console.log(JSON.stringify(isolatedPaths, null, 2));
  fs.rmSync(root, { recursive: true, force: true });
  process.exit(0);
}

const child = spawn(process.execPath, testArgs, {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  shell: false,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  fs.rmSync(root, { recursive: true, force: true });
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  fs.rmSync(root, { recursive: true, force: true });
  console.error(`Unable to start hermetic tests: ${error.message}`);
  process.exit(1);
});
