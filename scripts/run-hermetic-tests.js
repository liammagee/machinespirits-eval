#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  discoverCoreTestFiles,
  discoverRootTestFiles,
  loadTestManifest,
  parseNodeTapSummary,
  parseVitestJsonSummary,
  printPhaseSummary,
  validatePhaseSummary,
  validateTestManifest,
} from './hermetic-test-contract.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALID_SUITES = new Set(['all', 'root', 'core']);

export { discoverCoreTestFiles, discoverRootTestFiles } from './hermetic-test-contract.js';

export function parseRunnerArgs(argv = []) {
  let suite = 'all';
  let forceExit = true;
  let printEnv = false;
  const forwarded = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--suite') {
      suite = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--suite=')) {
      suite = argument.slice('--suite='.length);
    } else if (argument === '--no-force-exit') {
      forceExit = false;
    } else if (argument === '--print-env') {
      printEnv = true;
    } else {
      forwarded.push(argument);
    }
  }

  if (!VALID_SUITES.has(suite)) {
    throw new Error(`Invalid test suite "${suite}"; expected all, root, or core`);
  }
  if (forwarded.some((argument) => argument.startsWith('--test-reporter'))) {
    throw new Error('Hermetic root tests reserve --test-reporter for manifest accounting');
  }
  if (forwarded.some((argument) => argument.startsWith('--reporter') || argument.startsWith('--outputFile'))) {
    throw new Error('Hermetic core tests reserve --reporter/--outputFile for manifest accounting');
  }

  // Preserve the historical `npm test -- tests/example.test.js` behavior:
  // explicit test paths select the root Node test phase unless the caller
  // deliberately chose the core Vitest phase.
  if (forwarded.length > 0 && suite === 'all') suite = 'root';

  return { suite, forceExit, printEnv, forwarded };
}

export function createIsolatedPaths(root) {
  return {
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
}

export function buildRootTestArgs({ projectRoot = PROJECT_ROOT, forceExit = true, forwarded = [] } = {}) {
  const testFiles = forwarded.length ? forwarded : discoverRootTestFiles(projectRoot);
  return ['--test', '--test-reporter=tap', ...(forceExit ? ['--test-force-exit'] : []), ...testFiles];
}

export function buildCoreTestArgs({ projectRoot = PROJECT_ROOT, forwarded = [], reportPath } = {}) {
  const testFiles = forwarded.length ? forwarded : discoverCoreTestFiles(projectRoot);
  return [
    path.join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs'),
    'run',
    ...testFiles,
    '--reporter=default',
    '--reporter=json',
    `--outputFile.json=${reportPath}`,
  ];
}

export function buildTestPhases(options, projectRoot = PROJECT_ROOT, reportRoot = projectRoot) {
  const phases = [];
  if (options.suite === 'all' || options.suite === 'root') {
    const selectedFiles = options.forwarded.length
      ? options.forwarded.filter((argument) => argument.endsWith('.test.js'))
      : discoverRootTestFiles(projectRoot);
    phases.push({
      phase: 'root',
      forceExit: options.forceExit,
      selectedFiles,
      args: buildRootTestArgs({
        projectRoot,
        forceExit: options.forceExit,
        forwarded: options.forwarded,
      }),
    });
  }
  if (options.suite === 'all' || options.suite === 'core') {
    const forwarded = options.suite === 'core' ? options.forwarded : [];
    phases.push({
      phase: 'core',
      forceExit: false,
      selectedFiles: forwarded.length
        ? forwarded.filter((argument) => argument.endsWith('.test.js'))
        : discoverCoreTestFiles(projectRoot),
      reportPath: path.join(reportRoot, 'tutor-core-vitest-results.json'),
      args: buildCoreTestArgs({
        projectRoot,
        forwarded,
        reportPath: path.join(reportRoot, 'tutor-core-vitest-results.json'),
      }),
    });
  }
  return phases;
}

function phaseLabel(phase, forceExit) {
  if (phase === 'core') return 'in-housed tutor-core (Vitest, natural teardown)';
  return `root Node tests (${forceExit ? 'legacy forced exit' : 'natural teardown handle audit'})`;
}

function runPhase({ phase, forceExit, args, env, projectRoot = PROJECT_ROOT, onChild }) {
  console.log(`\n[test:hermetic] ${phaseLabel(phase, forceExit)}`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on('data', (chunk) => {
      stdoutChunks.push(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk);
      process.stderr.write(chunk);
    });
    onChild(child);
    child.once('error', reject);
    child.once('exit', (code, signal) =>
      resolve({
        code: code ?? 1,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      }),
    );
  });
}

function readPhaseSummary(phase, result, projectRoot) {
  if (phase.phase === 'root') return parseNodeTapSummary(result.stdout);
  if (!fs.existsSync(phase.reportPath)) throw new Error('core Vitest phase omitted its JSON report');
  return parseVitestJsonSummary(fs.readFileSync(phase.reportPath, 'utf8'), projectRoot);
}

export async function runHermeticTests(argv = process.argv.slice(2)) {
  const options = parseRunnerArgs(argv);
  const manifest = loadTestManifest(PROJECT_ROOT);
  const manifestState = validateTestManifest(manifest, PROJECT_ROOT);
  const hermeticRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'machinespirits-tests-'));
  const isolatedPaths = createIsolatedPaths(hermeticRoot);
  const env = {
    ...process.env,
    ...isolatedPaths,
    MACHINESPIRITS_HERMETIC_TEST_ROOT: hermeticRoot,
    VITEST_SKIP_INSTALL_CHECKS: '1',
  };
  let currentChild = null;
  let interruptedSignal = null;

  const forwardSignal = (signal) => {
    interruptedSignal = signal;
    currentChild?.kill(signal);
  };
  const signalHandlers = new Map(
    ['SIGINT', 'SIGTERM'].map((signal) => {
      const handler = () => forwardSignal(signal);
      process.on(signal, handler);
      return [signal, handler];
    }),
  );

  try {
    if (options.printEnv) {
      console.log(JSON.stringify(isolatedPaths, null, 2));
      return 0;
    }

    for (const phase of buildTestPhases(options, PROJECT_ROOT, hermeticRoot)) {
      const result = await runPhase({ ...phase, env, onChild: (child) => (currentChild = child) });
      currentChild = null;
      if (result.signal) {
        interruptedSignal = result.signal;
        return 1;
      }
      const phaseSummary = validatePhaseSummary({
        phase: phase.phase,
        summary: readPhaseSummary(phase, result, PROJECT_ROOT),
        selectedFiles: phase.selectedFiles,
        allowedSkips: manifestState.allowedSkips,
        env,
        requireExactFiles: phase.selectedFiles.length > 0,
      });
      printPhaseSummary(phase.phase, phaseSummary);
      if (result.code !== 0) return result.code;
    }
    return 0;
  } finally {
    for (const [signal, handler] of signalHandlers) process.off(signal, handler);
    fs.rmSync(hermeticRoot, { recursive: true, force: true });
    if (interruptedSignal) process.kill(process.pid, interruptedSignal);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runHermeticTests()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`Unable to run hermetic tests: ${error.message}`);
      process.exitCode = 1;
    });
}
