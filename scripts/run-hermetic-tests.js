#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  discoverCoreTestFiles,
  discoverRootTestFiles,
  loadTestManifest,
  nodeTapOutputIsComplete,
  parseNodeTapSummary,
  parseVitestJsonSummary,
  printPhaseSummary,
  validatePhaseSummary,
  validateTestManifest,
} from './hermetic-test-contract.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALID_SUITES = new Set(['all', 'root', 'core']);
const CHILD_STDIO_DRAIN_IDLE_MS = 2_000;
const CHILD_STDIO_DRAIN_MAX_MS = 10_000;
// Without `--test-force-exit` a single leaked handle keeps the runner alive
// forever, so the parent has to end the wait itself. The bound is total silence
// across every file running concurrently, not per file: the longest single test
// in this suite runs about 28 seconds locally, and a whole run producing nothing
// for five minutes has stopped making progress rather than gone quiet.
const CHILD_OUTPUT_STALL_MS = 300_000;
const CHILD_STALL_KILL_GRACE_MS = 5_000;
const TEST_SHARD_SEED = 'hermetic-v1:1491';
const SLOW_FILE_LIMIT = 8;
const TWO_WAY_SHARD_OVERRIDES = new Map([
  // The timing reporter identifies this model-free subprocess suite as the
  // dominant shard-2 worker. This measured correction reduces the critical
  // path while every other path retains stable hash membership.
  ['tests/tutorStubFirstDraftOuterLoop.test.js', 0],
]);

export { discoverCoreTestFiles, discoverRootTestFiles } from './hermetic-test-contract.js';

function parseShard(value) {
  const match = String(value || '').match(/^(\d+)\/(\d+)$/u);
  if (!match) throw new Error(`Invalid test shard "${value}"; expected INDEX/TOTAL`);
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (total < 2 || index < 1 || index > total) {
    throw new Error(`Invalid test shard "${value}"; expected 1 <= INDEX <= TOTAL and TOTAL >= 2`);
  }
  return { index, total };
}

export function selectTestShard(files, shard) {
  if (!shard) return [...files];
  return files.filter((file) => {
    const normalizedFile = file.replaceAll('\\', '/');
    const overrideIndex = shard.total === 2 ? TWO_WAY_SHARD_OVERRIDES.get(normalizedFile) : undefined;
    if (overrideIndex !== undefined) return overrideIndex === shard.index - 1;
    const digest = createHash('sha256').update(`${TEST_SHARD_SEED}:${normalizedFile}`).digest();
    return digest.readUInt32BE(0) % shard.total === shard.index - 1;
  });
}

export function parseRunnerArgs(argv = []) {
  let suite = 'all';
  // Natural teardown is the default. `--test-force-exit` calls `process.exit()`
  // at the end of a run, which truncates the report and can cut the run itself
  // short; `--force-exit` restores it for a caller that would rather have that
  // than wait out a leaked handle.
  let forceExit = false;
  let printEnv = false;
  let quiet = false;
  let shard = null;
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
    } else if (argument === '--force-exit') {
      forceExit = true;
    } else if (argument === '--print-env') {
      printEnv = true;
    } else if (argument === '--quiet') {
      quiet = true;
    } else if (argument === '--shard') {
      shard = parseShard(argv[index + 1]);
      index += 1;
    } else if (argument.startsWith('--shard=')) {
      shard = parseShard(argument.slice('--shard='.length));
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
  if (shard && suite === 'core') throw new Error('Test sharding is supported only for the root suite');
  if (shard && forwarded.length > 0) {
    throw new Error('Test sharding cannot be combined with explicit test paths or forwarded runner arguments');
  }

  // Preserve the historical `npm test -- tests/example.test.js` behavior:
  // explicit test paths select the root Node test phase unless the caller
  // deliberately chose the core Vitest phase.
  if (forwarded.length > 0 && suite === 'all') suite = 'root';
  if (shard && suite === 'all') suite = 'root';

  return { suite, forceExit, printEnv, quiet, shard, forwarded };
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

export function buildRootTestArgs({
  projectRoot = PROJECT_ROOT,
  // Matches parseRunnerArgs. A separate default here would mean a caller that
  // asks runPhase for natural teardown still gets a child that forces its own
  // exit, which is the harder of the two mistakes to notice.
  forceExit = false,
  forwarded = [],
  testFiles,
  timingPath,
  tapPath,
} = {}) {
  const selectedFiles = testFiles || (forwarded.length ? forwarded : discoverRootTestFiles(projectRoot));
  // The piped TAP stream stays the live CI log, but it is not a reliable place
  // to read the run's verdict from. `--test-force-exit` calls `process.exit()`,
  // which does not flush a pipe, so under a loaded runner the trailing plan and
  // counter lines are simply never written — the symptom being an all-green log
  // that fails with "omitted the TAP test summary". A second TAP reporter
  // writing to a file survives the same exit, so the summary is read from there.
  const fileTap = tapPath ? ['--test-reporter=tap', `--test-reporter-destination=${tapPath}`] : [];
  const reporters =
    timingPath || tapPath
      ? [
          '--test-reporter=tap',
          '--test-reporter-destination=stdout',
          ...fileTap,
          ...(timingPath
            ? [
                `--test-reporter=${path.join(projectRoot, 'scripts/hermetic-timing-reporter.js')}`,
                `--test-reporter-destination=${timingPath}`,
              ]
            : []),
        ]
      : ['--test-reporter=tap'];
  return ['--test', ...reporters, ...(forceExit ? ['--test-force-exit'] : []), ...selectedFiles];
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

// The executed-file account comes back from the child as a path relative to the
// project root, so the selected list has to be expressed the same way for the
// two to be comparable — `npm test -- /absolute/path.test.js` otherwise reads as
// one missing file and one unexpected one.
function repoRelativeTestFile(projectRoot, file) {
  return path.relative(projectRoot, path.resolve(projectRoot, file)).split(path.sep).join('/');
}

export function buildTestPhases(options, projectRoot = PROJECT_ROOT, reportRoot = projectRoot) {
  const phases = [];
  if (options.suite === 'all' || options.suite === 'root') {
    const discoveredFiles = discoverRootTestFiles(projectRoot);
    const selectedFiles = (
      options.forwarded.length
        ? options.forwarded.filter((argument) => argument.endsWith('.test.js'))
        : selectTestShard(discoveredFiles, options.shard)
    ).map((file) => repoRelativeTestFile(projectRoot, file));
    phases.push({
      phase: 'root',
      forceExit: options.forceExit,
      shard: options.shard,
      selectedFiles,
      reportPath: path.join(reportRoot, 'root-node-test-timings.jsonl'),
      tapPath: path.join(reportRoot, 'root-node-test-output.tap'),
      args: buildRootTestArgs({
        projectRoot,
        forceExit: options.forceExit,
        forwarded: options.forwarded,
        testFiles: options.shard ? selectedFiles : undefined,
        timingPath: path.join(reportRoot, 'root-node-test-timings.jsonl'),
        tapPath: path.join(reportRoot, 'root-node-test-output.tap'),
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

function phaseLabel(phase, forceExit, shard) {
  if (phase === 'core') return 'in-housed tutor-core (Vitest, natural teardown)';
  const shardLabel = shard ? `, shard ${shard.index}/${shard.total}` : '';
  return `root Node tests (${forceExit ? 'legacy forced exit' : 'natural teardown'}${shardLabel})`;
}

function writeCapturedOutput(stream, output) {
  if (!output) return Promise.resolve();
  return new Promise((resolve, reject) => {
    stream.write(output, (error) => (error ? reject(error) : resolve()));
  });
}

export async function replayCapturedOutput(result, stdoutStream = process.stdout, stderrStream = process.stderr) {
  // GitHub Actions applies backpressure to large TAP replays. Await each write
  // so the useful failure and footer are not truncated when this process exits.
  await writeCapturedOutput(stdoutStream, result.stdout);
  await writeCapturedOutput(stderrStream, result.stderr);
}

export function runPhase({
  phase,
  forceExit,
  shard,
  args,
  env,
  quiet = false,
  projectRoot = PROJECT_ROOT,
  stdoutStream = process.stdout,
  stderrStream = process.stderr,
  stdioDrainIdleMs = CHILD_STDIO_DRAIN_IDLE_MS,
  stdioDrainMaxMs = CHILD_STDIO_DRAIN_MAX_MS,
  stallTimeoutMs = CHILD_OUTPUT_STALL_MS,
  stallKillGraceMs = CHILD_STALL_KILL_GRACE_MS,
  onChild,
}) {
  console.log(`\n[test:hermetic] ${phaseLabel(phase, forceExit, shard)}`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    let childResult = null;
    let drainIdleTimer = null;
    let drainMaxTimer = null;
    let stallTimer = null;
    let stallKillTimer = null;
    let stalled = false;
    let settled = false;

    const clearStallWatch = () => {
      if (stallTimer) clearTimeout(stallTimer);
      if (stallKillTimer) clearTimeout(stallKillTimer);
      stallTimer = null;
      stallKillTimer = null;
    };

    // A run that has stopped emitting has stopped progressing: either a test is
    // hung or a finished file is holding the runner open. Both used to be
    // invisible behind the forced exit. End the wait, and let the caller name
    // the files that never reported.
    const watchForStall = () => {
      if (forceExit || childResult || settled || !stallTimeoutMs) return;
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        stalled = true;
        child.kill('SIGTERM');
        stallKillTimer = setTimeout(() => child.kill('SIGKILL'), stallKillGraceMs);
      }, stallTimeoutMs);
    };

    const finish = () => {
      if (settled || !childResult) return;
      settled = true;
      clearStallWatch();
      if (drainIdleTimer) clearTimeout(drainIdleTimer);
      if (drainMaxTimer) clearTimeout(drainMaxTimer);
      // A detached descendant can keep inherited pipes open indefinitely after
      // the test runner exits. Stop waiting after the bounded drain window.
      child.stdout.destroy();
      child.stderr.destroy();
      resolve({
        ...childResult,
        stalled,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      });
    };

    const scheduleDrain = () => {
      if (!childResult || settled) return;
      if (drainIdleTimer) clearTimeout(drainIdleTimer);
      drainIdleTimer = setTimeout(finish, stdioDrainIdleMs);
      drainMaxTimer ||= setTimeout(finish, stdioDrainMaxMs);
    };

    child.stdout.on('data', (chunk) => {
      stdoutChunks.push(chunk);
      if (!quiet) stdoutStream.write(chunk);
      watchForStall();
      scheduleDrain();
    });
    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk);
      if (!quiet) stderrStream.write(chunk);
      watchForStall();
      scheduleDrain();
    });
    onChild(child);
    watchForStall();
    child.once('error', (error) => {
      settled = true;
      clearStallWatch();
      if (drainIdleTimer) clearTimeout(drainIdleTimer);
      if (drainMaxTimer) clearTimeout(drainMaxTimer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      childResult = { code: code ?? 1, signal };
      clearStallWatch();
      // Usually `close` follows immediately after stdout/stderr drain. When a
      // descendant still owns the pipe, keep extending the idle window while
      // TAP bytes arrive, with a hard ceiling for genuinely leaked handles.
      scheduleDrain();
    });
    child.once('close', (code, signal) => {
      childResult ||= { code: code ?? 1, signal };
      finish();
    });
  });
}

/**
 * Read the root phase's verdict from whichever TAP channel survived the exit,
 * preferring the file.
 *
 * Neither channel is safe from `process.exit()`, and they fail under different
 * conditions: the pipe loses its tail when this parent reads slowly, which is
 * the flake this exists for, and the file loses it when the child exits almost
 * immediately, which CI has shown on Node 20 in a quarter-second run. So the
 * stdout branch is not only there for a caller that builds phases without a
 * `tapPath` — it is the second of two independent chances at the tail, and it
 * has already been the one that had it.
 *
 * When neither carries a complete tail the error names both with their byte
 * counts, because "the summary is missing" and "the tests failed" look
 * identical otherwise.
 */
/**
 * The selected files that reported a result, taken from the streamed timing
 * report rather than from TAP.
 *
 * TAP carries no per-file record when a file loads successfully — its tests are
 * hoisted to the top level and the file name appears nowhere — so this is the
 * only account of which files ran, and it is what lets the root phase enforce
 * the same exact-file check the Vitest phase has always had.
 */
export function readRootExecutedFiles(phase) {
  if (!phase.reportPath || !fs.existsSync(phase.reportPath)) return null;
  return parseRootTimingReport(fs.readFileSync(phase.reportPath, 'utf8'))
    .map((timing) => timing.file)
    .sort();
}

export function readRootTapSummary(phase, result) {
  const withFiles = (summary) => {
    const files = readRootExecutedFiles(phase);
    return files ? { ...summary, files } : summary;
  };
  const tapPath = phase.tapPath;
  const fileText = tapPath && fs.existsSync(tapPath) ? fs.readFileSync(tapPath, 'utf8') : '';
  if (nodeTapOutputIsComplete(fileText)) {
    return withFiles(parseNodeTapSummary(fileText, { source: `root TAP report ${tapPath}` }));
  }
  if (nodeTapOutputIsComplete(result.stdout)) {
    return withFiles(parseNodeTapSummary(result.stdout, { source: 'root TAP stdout' }));
  }
  const channels = [
    tapPath
      ? `${tapPath} (${fileText ? `${fileText.length} bytes, no complete tail` : 'absent'})`
      : 'no TAP file configured',
    `stdout (${result.stdout.length} bytes, no complete tail)`,
  ];
  throw new Error(`root Node test output omitted the TAP test summary on every channel: ${channels.join('; ')}`);
}

function readPhaseSummary(phase, result, projectRoot) {
  if (phase.phase === 'root') return readRootTapSummary(phase, result);
  if (!fs.existsSync(phase.reportPath)) throw new Error('core Vitest phase omitted its JSON report');
  return parseVitestJsonSummary(fs.readFileSync(phase.reportPath, 'utf8'), projectRoot);
}

export function parseRootTimingReport(reportText) {
  return String(reportText)
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .sort((left, right) => right.durationMs - left.durationMs || left.file.localeCompare(right.file));
}

function printRootTimingSummary(phase) {
  if (phase.phase !== 'root' || !fs.existsSync(phase.reportPath)) return;
  const timings = parseRootTimingReport(fs.readFileSync(phase.reportPath, 'utf8'));
  if (timings.length === 0) return;
  const slowest = timings
    .slice(0, SLOW_FILE_LIMIT)
    .map(({ file, durationMs, failures }) => `${file}=${durationMs.toFixed(0)}ms${failures ? `/${failures}fail` : ''}`)
    .join(', ');
  console.log(`[test:hermetic] root slow files: ${slowest}`);
}

export function formatStallDiagnostic(phase, executedFiles, stallTimeoutMs = CHILD_OUTPUT_STALL_MS) {
  const executed = new Set(executedFiles || []);
  const unreported = phase.selectedFiles.filter((file) => !executed.has(file));
  return [
    `[test:hermetic] ${phase.phase} stalled: no output for ${Math.round(stallTimeoutMs / 1000)}s, so the run was ended`,
    '[test:hermetic] a file that keeps a handle open after its tests finish holds the whole run open and never reports',
    ...(unreported.length
      ? unreported.map((file) => `[test:hermetic] unreported: ${file}`)
      : [
          '[test:hermetic] every selected file reported; a hung test outside the selected files is the remaining cause',
        ]),
    '[test:hermetic] --force-exit restores the old behaviour of exiting on completion, at the cost of a truncated report',
  ].join('\n');
}

export function formatPhaseFailureDiagnostic(phase, result) {
  const exit = result.signal ? `signal=${result.signal}` : `code=${result.code}`;
  return [
    `[test:hermetic] ${phase.phase} failed ${exit}; selected_files=${phase.selectedFiles.length}`,
    ...phase.selectedFiles.map((file) => `[test:hermetic] selected: ${file}`),
  ].join('\n');
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
      const result = await runPhase({
        ...phase,
        env,
        quiet: options.quiet,
        onChild: (child) => (currentChild = child),
      });
      currentChild = null;
      printRootTimingSummary(phase);
      if (result.stalled) {
        if (options.quiet) await replayCapturedOutput(result);
        console.error(formatStallDiagnostic(phase, readRootExecutedFiles(phase)));
        return 1;
      }
      if (result.signal) {
        if (options.quiet) await replayCapturedOutput(result);
        console.error(formatPhaseFailureDiagnostic(phase, result));
        interruptedSignal = result.signal;
        return 1;
      }
      if (result.code !== 0) {
        if (options.quiet) await replayCapturedOutput(result);
        console.error(formatPhaseFailureDiagnostic(phase, result));
      }
      let phaseSummary;
      try {
        phaseSummary = validatePhaseSummary({
          phase: phase.phase,
          summary: readPhaseSummary(phase, result, PROJECT_ROOT),
          selectedFiles: phase.selectedFiles,
          allowedSkips: manifestState.allowedSkips,
          env,
          // The legacy forced exit can end a run before its last files report,
          // so a caller who asks for it is asking for an unverifiable account
          // and gets one. Natural teardown is held to the exact-file check.
          requireExactFiles: phase.selectedFiles.length > 0 && !phase.forceExit,
        });
      } catch (error) {
        if (options.quiet && result.code === 0) await replayCapturedOutput(result);
        // A file that fails to import never emits a file-scoped summary, so it
        // reads here as a file that did not run — which it did not. Say so, or
        // the reader goes looking for a missing file that is sitting right
        // there with an import error a few thousand TAP lines above.
        if (phase.phase === 'root' && /missing:/u.test(error.message)) {
          console.error(
            '[test:hermetic] a listed file reports nothing when it fails to load; check the TAP output above for its import error',
          );
        }
        throw error;
      }
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
