#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_TEST_DIRECTORIES = ['services/__tests__', 'tests'];
const CORE_TEST_DIRECTORY = 'tutor-core/services/__tests__';
const VALID_SUITES = new Set(['all', 'root', 'core']);

export function discoverRootTestFiles(projectRoot = PROJECT_ROOT) {
  return ROOT_TEST_DIRECTORIES.flatMap((directory) =>
    fs
      .readdirSync(path.join(projectRoot, directory), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
      .map((entry) => path.join(directory, entry.name)),
  );
}

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
  return ['--test', ...(forceExit ? ['--test-force-exit'] : []), ...testFiles];
}

export function buildCoreTestArgs({ projectRoot = PROJECT_ROOT, forwarded = [] } = {}) {
  return [
    path.join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs'),
    'run',
    ...(forwarded.length ? forwarded : [CORE_TEST_DIRECTORY]),
  ];
}

export function buildTestPhases(options, projectRoot = PROJECT_ROOT) {
  const phases = [];
  if (options.suite === 'all' || options.suite === 'root') {
    phases.push({
      phase: 'root',
      forceExit: options.forceExit,
      args: buildRootTestArgs({
        projectRoot,
        forceExit: options.forceExit,
        forwarded: options.forwarded,
      }),
    });
  }
  if (options.suite === 'all' || options.suite === 'core') {
    phases.push({
      phase: 'core',
      forceExit: false,
      args: buildCoreTestArgs({
        projectRoot,
        forwarded: options.suite === 'core' ? options.forwarded : [],
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
      stdio: 'inherit',
      shell: false,
    });
    onChild(child);
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code: code ?? 1, signal }));
  });
}

export async function runHermeticTests(argv = process.argv.slice(2)) {
  const options = parseRunnerArgs(argv);
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

    for (const phase of buildTestPhases(options)) {
      const result = await runPhase({ ...phase, env, onChild: (child) => (currentChild = child) });
      currentChild = null;
      if (result.signal) {
        interruptedSignal = result.signal;
        return 1;
      }
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
