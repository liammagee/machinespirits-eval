#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import {
  resolveCanonicalEvaluationDbPath,
  resolveCanonicalEvaluationLogsRoot,
} from '../services/evaluationDataPaths.js';

const command = process.argv.slice(2);
if (!command.length || command.includes('--help')) {
  console.log(`Usage:
  npm run eval:canonical -- <command> [args...]

Runs a claim-bearing evaluation command with EVAL_DB_PATH and EVAL_LOGS_DIR
bound explicitly to the canonical data home. Test commands are refused; use
npm test, which is hermetic by default.`);
  process.exit(command.length ? 0 : 1);
}

const commandText = command.join(' ').toLowerCase();
if (/(^|\s)(npm\s+(run\s+)?test|node\s+--test)(\s|$)/u.test(commandText)) {
  console.error('Refusing to run tests against the canonical evaluation database. Use npm test.');
  process.exit(2);
}

const dbPath = resolveCanonicalEvaluationDbPath();
const logsRoot = resolveCanonicalEvaluationLogsRoot();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(logsRoot, { recursive: true });

console.log(`[canonical-eval] EVAL_DB_PATH=${dbPath}`);
console.log(`[canonical-eval] EVAL_LOGS_DIR=${logsRoot}`);

const child = spawn(command[0], command.slice(1), {
  cwd: process.cwd(),
  env: { ...process.env, EVAL_DB_PATH: dbPath, EVAL_LOGS_DIR: logsRoot },
  stdio: 'inherit',
  shell: false,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`[canonical-eval] ${error.message}`);
  process.exit(1);
});
