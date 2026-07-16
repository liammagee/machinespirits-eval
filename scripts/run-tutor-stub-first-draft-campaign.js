#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  acquireTutorStubFirstDraftCellClaim,
  applyTutorStubFirstDraftDevelopmentRuntimePreflight,
  assessTutorStubAcceptanceCell,
  assertTutorStubFirstDraftDevelopmentIterationVacant,
  buildTutorStubFirstDraftCampaignValidationReport,
  buildTutorStubFirstDraftPreflightFailureResult,
  expandTutorStubFirstDraftCampaign,
  loadTutorStubFirstDraftCampaign,
  releaseTutorStubFirstDraftCellClaim,
  summarizeTutorStubWorkingScreen,
  tutorStubFirstDraftFocusedTestSuites,
  tutorStubFirstDraftInterruptedCellResult,
  tutorStubFirstDraftDevelopmentExecutionPlan,
  tutorStubFirstDraftCampaignValidationArtifactPath,
  tutorStubFirstDraftIterationStopping,
  tutorStubFirstDraftUnexpectedIterationArtifacts,
  writeTutorStubFirstDraftJsonExclusive,
} from '../services/tutorStubFirstDraftCampaign.js';
import {
  buildTutorStubFirstDraftPreflightBoundary,
  buildTutorStubFirstDraftPreflightCertificate,
  materializeTutorStubFirstDraftPreflightCertificate,
  tutorStubFirstDraftHardCellBlocksRemaining,
  tutorStubFirstDraftPreflightCertificatePath,
  validateTutorStubFirstDraftPreflightCertificate,
} from '../services/tutorStubFirstDraftPreflightCertificate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKING_CONFIG = path.join(ROOT, 'config', 'tutor-stub-campaigns', 'first-draft-working-screens.yaml');

const { values: args } = parseArgs({
  options: {
    config: { type: 'string', default: DEFAULT_WORKING_CONFIG },
    mode: { type: 'string', default: 'validate' },
    iteration: { type: 'string', default: '1' },
    'complete-all-cells': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  return `Usage:
  node scripts/run-tutor-stub-first-draft-campaign.js --mode validate
  node scripts/run-tutor-stub-first-draft-campaign.js --mode development --iteration 1
  node scripts/run-tutor-stub-first-draft-campaign.js --config config/.../v20.yaml --mode acceptance
  node scripts/run-tutor-stub-first-draft-campaign.js --mode acceptance --complete-all-cells

Validation expands every command once without making a model call. Development
runs frozen original-only turns sequentially, hard cell first, and stops when a
3/4 cell gate becomes impossible. Acceptance runs the hardest full cell first,
then at most three remaining cells concurrently. --complete-all-cells disables
gate-based campaign stopping for final diagnostic collection.`;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function commandLine(argv) {
  return argv.map((part) => JSON.stringify(part)).join(' ');
}

function commandFailureError({
  argv,
  label,
  preflightKind,
  exitCode = null,
  signal = null,
  cause = null,
  execution = null,
  reasonOverride = null,
}) {
  const reason = reasonOverride || (cause
    ? `could not start: ${cause.message}`
    : signal
      ? `terminated by signal ${signal}`
      : `exited with status ${exitCode}`);
  const error = new Error(`${label} ${reason}`);
  if (preflightKind) {
    error.tutorStubPreflightCommandFailure = {
      schema: 'machinespirits.tutor-stub.first-draft-preflight-command-failure.v1',
      kind: preflightKind,
      label,
      argv: [...argv],
      command: commandLine(argv),
      exitCode,
      signal,
      reason,
      spawnErrorCode: cause?.code || null,
      execution: execution ? structuredClone(execution) : null,
    };
  }
  return error;
}

function parseTapSummary(stdout) {
  const text = String(stdout || '');
  const metric = (name) => {
    const matches = [...text.matchAll(new RegExp(`^# ${name} (\\d+)$`, 'gmu'))];
    return matches.length ? Number(matches.at(-1)[1]) : null;
  };
  const failureNames = [...new Set(
    [...text.matchAll(/^\s*not ok \d+ - (.+)$/gmu)]
      .map((match) => match[1].replace(/\s+#.*$/u, '').trim())
      .filter(Boolean),
  )];
  const durationMatches = [...text.matchAll(/^# duration_ms ([0-9.]+)$/gmu)];
  return {
    tests: metric('tests'),
    suites: metric('suites'),
    pass: metric('pass'),
    fail: metric('fail'),
    cancelled: metric('cancelled'),
    skipped: metric('skipped'),
    todo: metric('todo'),
    durationMs: durationMatches.length ? Number(durationMatches.at(-1)[1]) : null,
    failureNames,
  };
}

function preflightStreamArtifact(buffer, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer, { flag: 'wx' });
  return {
    path: filePath,
    bytes: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

function preflightArtifactStem(order, id) {
  const safeId = String(id || 'command').replace(/[^a-z0-9_-]+/giu, '-').replace(/^-+|-+$/gu, '');
  return `${String(order).padStart(2, '0')}-${safeId || 'command'}`;
}

async function runCommand(
  argv,
  { label = 'command', preflightKind = null, capture = null } = {},
) {
  console.log(`${label}: ${commandLine(argv)}`);
  const startedAt = new Date();
  return new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    let spawnError = null;
    const child = spawn(argv[0], argv.slice(1), {
      cwd: ROOT,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    if (capture) {
      child.stdout.on('data', (chunk) => {
        const value = Buffer.from(chunk);
        stdoutChunks.push(value);
        process.stdout.write(value);
      });
      child.stderr.on('data', (chunk) => {
        const value = Buffer.from(chunk);
        stderrChunks.push(value);
        process.stderr.write(value);
      });
    }
    child.once('error', (cause) => {
      spawnError = cause;
    });
    child.once('close', (code, signal) => {
      const finishedAt = new Date();
      let execution = null;
      try {
        if (capture) {
          const stdout = Buffer.concat(stdoutChunks);
          const stderr = Buffer.concat(stderrChunks);
          const stem = preflightArtifactStem(capture.order, capture.id);
          const stdoutArtifact = preflightStreamArtifact(
            stdout,
            path.join(capture.artifactDir, `${stem}.stdout.log`),
          );
          const stderrArtifact = preflightStreamArtifact(
            stderr,
            path.join(capture.artifactDir, `${stem}.stderr.log`),
          );
          execution = {
            schema: 'machinespirits.tutor-stub.first-draft-preflight-command-execution.v1',
            id: capture.id,
            order: capture.order,
            kind: preflightKind,
            suiteId: capture.suiteId || null,
            label,
            argv: [...argv],
            command: commandLine(argv),
            attempt: 1,
            retryPolicy: 'none',
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            elapsedMs: finishedAt.getTime() - startedAt.getTime(),
            status: !spawnError && code === 0 ? 'pass' : 'fail',
            exitCode: code,
            signal,
            spawnErrorCode: spawnError?.code || null,
            stdout: stdoutArtifact,
            stderr: stderrArtifact,
            tap: capture.tap === true ? parseTapSummary(stdout.toString('utf8')) : null,
            makesModelCalls: false,
            modelCalls: 0,
          };
        }
      } catch (artifactError) {
        reject(artifactError);
        return;
      }
      if (!spawnError && code === 0) {
        resolve(execution);
        return;
      }
      reject(commandFailureError({
        argv,
        label,
        preflightKind,
        exitCode: code,
        signal,
        cause: spawnError,
        execution,
      }));
    });
  });
}

async function mapLimit(items, limit, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

function writeDevelopmentPreflightFailure(
  plan,
  loaded,
  iteration,
  frozen,
  validationArtifactPath,
  commandFailure = null,
) {
  const result = buildTutorStubFirstDraftPreflightFailureResult({
    plan,
    config: loaded.config,
    configPath: loaded.configPath,
    iteration,
    frozen,
    validationArtifactPath,
    commandFailure,
  });
  const resultPath = writeTutorStubFirstDraftJsonExclusive(
    path.join(plan.iterationRoot, 'working-screen-result.json'),
    result,
  );
  console.log(`development preflight failed without model calls: ${resultPath}`);
  return result;
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`could not resolve git HEAD: ${result.stderr}`);
  return result.stdout.trim();
}

function deterministicPreflightRuntime() {
  const npm = spawnSync('npm', ['--version'], { cwd: ROOT, encoding: 'utf8' });
  if (npm.status !== 0) throw new Error(`could not resolve npm version: ${npm.stderr}`);
  return {
    node: process.version,
    v8: process.versions.v8,
    npm: String(npm.stdout || '').trim(),
    platform: process.platform,
    arch: process.arch,
    environment: Object.fromEntries(
      ['CI', 'LANG', 'LC_ALL', 'NODE_ENV', 'NODE_OPTIONS'].map((name) => [
        name,
        process.env[name] || null,
      ]),
    ),
  };
}

function gitWorktreeState({ required = false } = {}) {
  const result = spawnSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const porcelain = result.status === 0 ? String(result.stdout || '') : '';
  const changeCount = porcelain.split(/\r?\n/u).filter(Boolean).length;
  const clean = result.status === 0 && changeCount === 0;
  return {
    required,
    checked: true,
    clean,
    status: clean ? 'clean' : result.status === 0 ? 'dirty' : 'unavailable',
    changeCount,
    porcelainSha256: createHash('sha256').update(porcelain).digest('hex'),
    error: result.status === 0 ? null : String(result.stderr || 'git status failed').trim(),
  };
}

function freezeDevelopmentState(loaded) {
  const cleanWorktreeRequired = loaded.config.execution?.require_clean_worktree === true;
  const worktree = gitWorktreeState({ required: cleanWorktreeRequired });
  return {
    gitHead: gitHead(),
    configPath: loaded.configPath,
    configSha256: sha256File(loaded.configPath),
    cleanWorktreeRequired,
    worktreeClean: worktree.clean,
    worktree,
  };
}

function assertFrozenDevelopmentState(frozen, loaded, cell = null) {
  if (!frozen) throw new Error('development campaign has no frozen provenance state');
  const currentHead = gitHead();
  const currentConfigHash = sha256File(loaded.configPath);
  if (currentHead !== frozen.gitHead || currentConfigHash !== frozen.configSha256) {
    throw new Error('development state changed after campaign start; stop rather than mix code or configuration');
  }
  const currentWorktree = gitWorktreeState({ required: frozen.cleanWorktreeRequired === true });
  if (frozen.cleanWorktreeRequired === true && currentWorktree.clean !== true) {
    throw new Error('development worktree became dirty after campaign start');
  }
  if (cell?.sourceTraceSha256 && sha256File(cell.sourceTrace) !== cell.sourceTraceSha256) {
    throw new Error(`${cell.id} source trace changed after campaign start`);
  }
}

function assertFrozenAcceptanceState(frozen) {
  const currentHead = gitHead();
  const currentConfigHash = sha256File(frozen.configPath);
  if (currentHead !== frozen.gitHead || currentConfigHash !== frozen.configSha256) {
    throw new Error(
      'acceptance state changed after campaign start; stop rather than mixing code or configuration between cells',
    );
  }
}

async function runWorkingPreflight(
  config,
  cellId,
  iterationRoot,
  { reportName = 'preflight-execution.json' } = {},
) {
  console.log(`preflight before ${cellId}: focused deterministic gates and model-free corpus`);
  const worldQuality = String(config.preflight?.world_quality || '').trim();
  const focusedTests = String(config.preflight?.focused_tests || '').trim();
  const focusedTestSuites = tutorStubFirstDraftFocusedTestSuites(config, { root: ROOT });
  if (!worldQuality || (!focusedTests && !focusedTestSuites.length)) {
    throw new Error(
      'working preflight must declare world_quality and focused_tests or focused_test_suites',
    );
  }
  const artifactDir = path.join(iterationRoot, 'preflight');
  const reportPath = path.join(iterationRoot, reportName);
  const commands = [
    {
      id: 'world-quality',
      kind: 'world_quality',
      label: `${cellId} world quality`,
      argv: ['/bin/sh', '-lc', worldQuality],
      tap: false,
      suiteId: null,
    },
    ...(focusedTestSuites.length
      ? focusedTestSuites.map((suite) => ({
          id: `focused-${suite.id}`,
          kind: 'focused_test_suite',
          label: `${cellId} focused test suite ${suite.id}`,
          argv: [
            process.execPath,
            '--test',
            '--test-concurrency=1',
            '--test-reporter=tap',
            ...suite.testFiles,
          ],
          tap: true,
          suiteId: suite.id,
        }))
      : [{
          id: 'focused-tests-legacy',
          kind: 'focused_tests',
          label: `${cellId} focused tests`,
          argv: ['/bin/sh', '-lc', focusedTests],
          tap: true,
          suiteId: null,
        }]),
    ...(config.preflight?.model_free_fixtures || []).map((fixture, index) => ({
      id: `model-free-fixture-${index + 1}`,
      kind: 'model_free_fixture',
      label: `${cellId} model-free fixture`,
      argv: [
        process.execPath,
        'scripts/replay-tutor-stub-frozen-turns.js',
        '--audit-fixture',
        path.isAbsolute(fixture) ? fixture : path.join(ROOT, fixture),
      ],
      tap: false,
      suiteId: null,
    })),
  ];
  const { boundary, key, observedHead } = buildTutorStubFirstDraftPreflightBoundary({
    root: ROOT,
    config,
    commands,
    focusedTestSuites,
    implementationHead: gitHead(),
    runtime: deterministicPreflightRuntime(),
  });
  const cacheDir = process.env.TUTOR_STUB_PREFLIGHT_CERTIFICATE_DIR ||
    path.join(ROOT, '.tutor-stub-auto-eval', 'preflight-certificates');
  const certificatePath = tutorStubFirstDraftPreflightCertificatePath({ cacheDir, key });
  if (fs.existsSync(certificatePath)) {
    let certificate = null;
    let validation = { ok: false, reasons: ['unreadable_certificate'] };
    try {
      certificate = readJson(certificatePath);
      validation = validateTutorStubFirstDraftPreflightCertificate(certificate, { boundary, key });
    } catch {
      // Fail closed below: preserve the bad certificate and execute the preflight again.
    }
    if (validation.ok) {
      const report = materializeTutorStubFirstDraftPreflightCertificate({
        certificate,
        iterationRoot,
        reportName,
        campaignId: config.id,
        cellId,
        certificatePath,
      });
      writeTutorStubFirstDraftJsonExclusive(reportPath, report);
      console.log(`preflight certificate reused: ${certificatePath}`);
      return { report, reportPath, revision: report.preflightRevision };
    }
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.renameSync(
      certificatePath,
      path.join(cacheDir, `${key}.rejected-${Date.now()}.json`),
    );
    console.log(`preflight certificate rejected (${validation.reasons.join(', ')}); executing gates`);
  }
  const executions = [];
  const startedAt = new Date();
  let failure = null;
  try {
    for (const [index, command] of commands.entries()) {
      const execution = await runCommand(command.argv, {
        label: command.label,
        preflightKind: command.kind,
        capture: {
          artifactDir,
          id: command.id,
          order: index + 1,
          tap: command.tap,
          suiteId: command.suiteId,
        },
      });
      if (
        command.kind === 'focused_test_suite' &&
        (
          !Number.isInteger(execution?.tap?.tests) ||
          execution.tap.tests < 1 ||
          execution.tap.fail !== 0
        )
      ) {
        const reason =
          execution?.tap?.tests < 1
            ? 'TAP reported zero tests'
            : `TAP reported ${execution?.tap?.fail ?? 'unknown'} failing tests`;
        const failedExecution = {
          ...execution,
          status: 'fail',
          failureKind: 'tap_validation',
          failureReason: reason,
        };
        throw commandFailureError({
          argv: command.argv,
          label: command.label,
          preflightKind: command.kind,
          exitCode: execution.exitCode,
          signal: execution.signal,
          execution: failedExecution,
          reasonOverride: reason,
        });
      }
      executions.push(execution);
    }
  } catch (error) {
    failure = error;
    if (error?.tutorStubPreflightCommandFailure?.execution) {
      executions.push(error.tutorStubPreflightCommandFailure.execution);
    }
  }
  const finishedAt = new Date();
  const report = {
    schema: 'machinespirits.tutor-stub.first-draft-preflight-execution.v1',
    generatedAt: finishedAt.toISOString(),
    campaignId: config.id || null,
    cellId,
    status: failure ? 'fail' : 'pass',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    elapsedMs: finishedAt.getTime() - startedAt.getTime(),
    executionPolicy: {
      sequential: true,
      attemptsPerCommand: 1,
      retryPolicy: 'none',
      testConcurrency: focusedTestSuites.length ? 1 : null,
      testReporter: focusedTestSuites.length ? 'tap' : null,
    },
    makesModelCalls: false,
    modelCalls: 0,
    testInventory: {
      suiteCount: focusedTestSuites.length,
      fileCount: focusedTestSuites.reduce((sum, suite) => sum + suite.testFiles.length, 0),
      suites: focusedTestSuites.map((suite) => ({
        id: suite.id,
        testFiles: [...suite.testFiles],
      })),
    },
    commands: executions,
    failedCommand: failure?.tutorStubPreflightCommandFailure
      ? {
          kind: failure.tutorStubPreflightCommandFailure.kind,
          label: failure.tutorStubPreflightCommandFailure.label,
          exitCode: failure.tutorStubPreflightCommandFailure.exitCode,
          signal: failure.tutorStubPreflightCommandFailure.signal,
          reason: failure.tutorStubPreflightCommandFailure.reason,
          failureKind:
            failure.tutorStubPreflightCommandFailure.execution?.failureKind || null,
        }
      : null,
  };
  const certificate = buildTutorStubFirstDraftPreflightCertificate({
    boundary,
    key,
    report,
    observedHead,
  });
  fs.mkdirSync(cacheDir, { recursive: true });
  writeJson(certificatePath, certificate);
  report.preflightRevision = {
    kind: 'deterministic_preflight_certificate',
    tutorGenerationResult: false,
    disposition: 'executed',
    certificateKey: key,
    certificateSha256: certificate.certificateSha256,
    certificatePath,
    reusable: certificate.reusable,
    certificateStatus: certificate.status,
    observedHead,
  };
  writeTutorStubFirstDraftJsonExclusive(reportPath, report);
  if (failure) {
    if (failure.tutorStubPreflightCommandFailure) {
      failure.tutorStubPreflightCommandFailure.preflightExecutionArtifactPath = reportPath;
      failure.tutorStubPreflightCommandFailure.preflightRevision = report.preflightRevision;
    }
    throw failure;
  }
  return { report, reportPath, revision: report.preflightRevision };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function workingResultMetrics(result) {
  const completedTurns = (result?.cells || []).reduce(
    (sum, cell) => sum + Number(cell.completedTurns || 0),
    0,
  );
  const configurationRealizationTotal = (result?.cells || []).reduce(
    (sum, cell) =>
      sum + Number(cell.meanConfigurationRealization || 0) * Number(cell.completedTurns || 0),
    0,
  );
  return {
    completedTurns,
    originalCandidatesAccepted: Number(result?.originalAcceptance || 0),
    meanConfigurationRealization: completedTurns
      ? configurationRealizationTotal / completedTurns
      : null,
    semanticRecognitionCorrections: Number(result?.semanticRecognitionCorrections || 0),
    safetyFailures: Number(result?.finalSafetyFailures || 0),
    deterministicFallbacks: Number(result?.deterministicFallbacks || 0),
  };
}

function replayWorkingStoppingHistory({ artifactRoot, throughIteration, maximum }) {
  let previous = null;
  for (let index = 1; index <= throughIteration; index += 1) {
    const resultPath = path.join(artifactRoot, `iteration-${index}`, 'working-screen-result.json');
    if (!fs.existsSync(resultPath)) break;
    const current = workingResultMetrics(readJson(resultPath));
    current.stopping = tutorStubFirstDraftIterationStopping({
      current,
      previous,
      maximumConsecutiveWithoutImprovement: maximum,
    });
    previous = current;
  }
  return previous;
}

async function runDevelopment(plan, loaded, iteration, frozen) {
  const config = loaded.config;
  const configSha256 = sha256File(loaded.configPath);
  const preflightExecutionArtifactPaths = [];
  const preflightRevisions = [];
  assertFrozenDevelopmentState(frozen, loaded);
  const maximumConsecutiveWithoutImprovement =
    config.stopping?.maximum_consecutive_iterations_without_improvement || 2;
  const previousMetrics = replayWorkingStoppingHistory({
    artifactRoot: plan.artifactRoot,
    throughIteration: iteration - 1,
    maximum: maximumConsecutiveWithoutImprovement,
  });
  if (previousMetrics?.stopping?.stop === true) {
    throw new Error(
      `development loop already stopped after ${previousMetrics.stopping.consecutiveWithoutImprovement} consecutive iterations without measurable improvement`,
    );
  }
  if (fs.existsSync(plan.iterationRoot)) {
    const existing = tutorStubFirstDraftUnexpectedIterationArtifacts(
      fs.readdirSync(plan.iterationRoot),
    );
    if (existing.length) {
      throw new Error(
        `iteration ${iteration} already has artifacts at ${plan.iterationRoot}; refusing to duplicate live draws`,
      );
    }
  }
  async function runCell(cell, { stopWhenImpossible = true } = {}) {
    assertFrozenDevelopmentState(frozen, loaded, cell);
    if (fs.existsSync(cell.outputDir) && fs.readdirSync(cell.outputDir).length) {
      throw new Error(`${cell.id} already has artifacts; refusing to duplicate a development cell`);
    }
    const { claimPath } = acquireTutorStubFirstDraftCellClaim({
      outputDir: cell.outputDir,
      cellId: cell.id,
      seed: cell.seed,
      configSha256,
      sourceTraceSha256: cell.sourceTraceSha256,
      expectedInventory: cell.turns.flatMap((turn) =>
        Array.from(
          { length: Number(config.fixed_configuration?.draws_per_turn || 1) },
          (_, index) => ({ turn: Number(turn), draw: index + 1 }),
        ),
      ),
    });
    let completedNormally = false;
    try {
      if (fs.existsSync(cell.outputDir) && fs.readdirSync(cell.outputDir).length) {
        releaseTutorStubFirstDraftCellClaim(claimPath);
        throw new Error(`${cell.id} acquired a claim but artifacts appeared; refusing to duplicate a development cell`);
      }
      const reports = [];
      for (const command of cell.commands) {
        assertFrozenDevelopmentState(frozen, loaded, cell);
        await runCommand(command.argv, { label: `${cell.id} frozen turn ${command.turn}` });
        assertFrozenDevelopmentState(frozen, loaded, cell);
        reports.push(readJson(command.outputPath));
        const interim = summarizeTutorStubWorkingScreen({ cell, reports, config });
        console.log(
          `${cell.id}: ${interim.originalCandidatesAccepted}/${interim.completedTurns} originals; ` +
            `maximum possible ${interim.possibility.maximumPossibleAccepted}/${interim.possibility.required}; ` +
            `configuration ${Number(interim.meanConfigurationRealization || 0).toFixed(3)} ` +
            `(maximum ${Number(interim.possibility.configurationRealization.maximumPossibleMean || 0).toFixed(3)})`,
        );
        if (stopWhenImpossible && !args['complete-all-cells'] && !interim.possibility.possible) break;
      }
      const summary = summarizeTutorStubWorkingScreen({ cell, reports, config });
      completedNormally = true;
      return { ...summary, seedDisposition: reports.length ? 'consumed_development' : 'unconsumed' };
    } finally {
      if (completedNormally) releaseTutorStubFirstDraftCellClaim(claimPath);
    }
  }

  async function runCellCaptured(cell, options) {
    try {
      return await runCell(cell, options);
    } catch (error) {
      const reportPath = cell.commands
        ?.map((command) => command.outputPath)
        .find((candidate) => fs.existsSync(candidate)) || cell.commands?.[0]?.outputPath || null;
      return tutorStubFirstDraftInterruptedCellResult({ cell, reportPath, error });
    }
  }

  const cellResults = [];
  if (config.execution) {
    const execution = tutorStubFirstDraftDevelopmentExecutionPlan({ plan, config });
    const preflightExecution = await runWorkingPreflight(
      config,
      execution.hardCell.id,
      plan.iterationRoot,
    );
    preflightExecutionArtifactPaths.push(preflightExecution.reportPath);
    preflightRevisions.push(preflightExecution.revision);
    assertFrozenDevelopmentState(frozen, loaded, execution.hardCell);
    const hardResult = await runCellCaptured(execution.hardCell, {
      stopWhenImpossible: execution.stopCellWhenGateMathematicallyImpossible,
    });
    cellResults.push(hardResult);
    if (tutorStubFirstDraftHardCellBlocksRemaining({
      execution: config.execution,
      hardCellStatus: hardResult.status,
      completeAllCells: args['complete-all-cells'],
    })) {
      cellResults.push(...execution.remainingCells.map((cell) => ({
        id: cell.id,
        world: cell.world,
        learnerProfile: cell.learnerProfile,
        seed: cell.seed,
        seedDisposition: 'unconsumed',
        status: 'unstarted_after_hard_cell_failure',
        completedTurns: 0,
        unstartedTurns: cell.turns,
      })));
    } else {
      const remainingResults = await mapLimit(
        execution.remainingCells,
        execution.remainingConcurrency,
        (cell) => runCellCaptured(cell, {
          stopWhenImpossible: execution.stopCellWhenGateMathematicallyImpossible,
        }),
      );
      cellResults.push(...remainingResults);
    }
  } else {
    let campaignStopped = false;
    for (const cell of plan.cells) {
      if (campaignStopped) {
        cellResults.push({
          id: cell.id,
          world: cell.world,
          learnerProfile: cell.learnerProfile,
          seed: cell.seed,
          seedDisposition: 'unconsumed',
          status: 'unstarted_after_required_cell_failure',
          completedTurns: 0,
          unstartedTurns: cell.turns,
        });
        continue;
      }
      const preflightExecution = await runWorkingPreflight(
        config,
        cell.id,
        plan.iterationRoot,
        { reportName: `preflight-execution-${cell.id}.json` },
      );
      preflightExecutionArtifactPaths.push(preflightExecution.reportPath);
      preflightRevisions.push(preflightExecution.revision);
      const summary = await runCellCaptured(cell);
      cellResults.push(summary);
      if (!args['complete-all-cells'] && summary.status !== 'pass') campaignStopped = true;
    }
  }
  const status =
    cellResults.length === plan.cells.length && cellResults.every((cell) => cell.status === 'pass') ? 'pass' : 'fail';
  const result = {
    schema: 'machinespirits.tutor-stub.first-draft-working-screen-result.v1',
    generatedAt: new Date().toISOString(),
    campaignId: config.id,
    heldOut: false,
    iteration,
    workingIteration: iteration,
    frozen,
    preflightExecutionArtifactPath:
      preflightExecutionArtifactPaths.length === 1
        ? preflightExecutionArtifactPaths[0]
        : null,
    preflightExecutionArtifactPaths,
    deterministicPreflight: {
      kind: 'deterministic_preflight_revisions',
      tutorGenerationResult: false,
      revisions: preflightRevisions,
    },
    status,
    completeAllCells: args['complete-all-cells'],
    changes: config.change_log,
    originalAcceptance: cellResults.reduce((sum, cell) => sum + Number(cell.originalCandidatesAccepted || 0), 0),
    semanticRecognitionCorrections: cellResults.reduce(
      (sum, cell) => sum + Number(cell.semanticRecognitionCorrections || 0),
      0,
    ),
    mechanicalRepairs: cellResults.reduce(
      (sum, cell) => sum + Number(cell.mechanicalRepairs || 0),
      0,
    ),
    modelRewrites: cellResults.reduce(
      (sum, cell) => sum + Number(cell.modelRewrites || 0),
      0,
    ),
    deterministicFallbacks: cellResults.reduce(
      (sum, cell) => sum + Number(cell.deterministicFallbacks || 0),
      0,
    ),
    transportNormalizedOutputs: cellResults.reduce(
      (sum, cell) => sum + Number(cell.transportNormalizedOutputs || 0),
      0,
    ),
    transportNormalizationCount: cellResults.reduce(
      (sum, cell) => sum + Number(cell.transportNormalizationCount || 0),
      0,
    ),
    transportNormalizations: cellResults.flatMap((cell) =>
      (cell.transportNormalizations || []).map((normalization) => ({
        cellId: cell.id,
        ...normalization,
      })),
    ),
    finalSafetyFailures: cellResults.reduce((sum, cell) => sum + Number(cell.safetyFailures || 0), 0),
    cells: cellResults,
    claimBoundary: config.claim_boundary,
  };
  const completedTurns = cellResults.reduce((sum, cell) => sum + Number(cell.completedTurns || 0), 0);
  const configurationRealizationTotal = cellResults.reduce(
    (sum, cell) => sum + Number(cell.meanConfigurationRealization || 0) * Number(cell.completedTurns || 0),
    0,
  );
  const currentMetrics = {
    completedTurns,
    originalCandidatesAccepted: result.originalAcceptance,
    meanConfigurationRealization: completedTurns ? configurationRealizationTotal / completedTurns : null,
    semanticRecognitionCorrections: result.semanticRecognitionCorrections,
    safetyFailures: result.finalSafetyFailures,
    deterministicFallbacks: result.deterministicFallbacks,
    workingScreenPassed: status === 'pass',
  };
  result.stopping = tutorStubFirstDraftIterationStopping({
    current: currentMetrics,
    previous: previousMetrics,
    maximumConsecutiveWithoutImprovement,
    requireWorkingScreenPass:
      Number(config.stopping?.final_frontier_attempt_iteration) === iteration &&
      config.stopping?.stop_if_final_frontier_attempt_fails === true,
  });
  const resultPath = writeTutorStubFirstDraftJsonExclusive(
    path.join(plan.iterationRoot, 'working-screen-result.json'),
    result,
  );
  console.log(`working screen ${status}: ${resultPath}`);
  return result;
}

function newestAutoEvalReport(root) {
  const candidates = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filePath);
      else if (/^auto-eval-.*\.json$/u.test(entry.name)) candidates.push(filePath);
    }
  }
  walk(root);
  return candidates.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs).at(0) || null;
}

async function runAcceptanceCell(cell, config, frozen) {
  assertFrozenAcceptanceState(frozen);
  if (fs.existsSync(cell.outputDir) && fs.readdirSync(cell.outputDir).length) {
    throw new Error(`${cell.id} already has artifacts; refusing to duplicate or relaunch its held-out seed`);
  }
  await runCommand(cell.argv, { label: `${cell.id} held-out acceptance` });
  assertFrozenAcceptanceState(frozen);
  const reportPath = newestAutoEvalReport(cell.outputDir);
  if (!reportPath) throw new Error(`${cell.id} produced no auto-eval report`);
  const report = readJson(reportPath);
  const assessment = assessTutorStubAcceptanceCell(report, config);
  return {
    id: cell.id,
    world: cell.world,
    learnerProfile: cell.learnerProfile,
    seed: cell.seed,
    seedDisposition: assessment.status === 'pass' ? 'consumed_passed' : 'consumed_failed_retired',
    reportPath,
    ...assessment,
  };
}

function aggregateAcceptance(cells, config) {
  const completed = cells.filter((cell) => cell.observed);
  const totalTurns = completed.reduce((sum, cell) => sum + Number(cell.observed.turns || 0), 0);
  const original = completed.reduce((sum, cell) => sum + Number(cell.observed.originalCandidatesAccepted || 0), 0);
  const modelRewrites = completed.reduce((sum, cell) => sum + Number(cell.observed.modelRewrites || 0), 0);
  const fallbacks = completed.reduce((sum, cell) => sum + Number(cell.observed.deterministicFallbacks || 0), 0);
  const first = config.first_draft_gates || {};
  const gates = {
    allCells: completed.length === config.matrix.length && completed.every((cell) => cell.status === 'pass'),
    aggregateOriginalAcceptance:
      totalTurns > 0 &&
      original / totalTurns >= Number(first.minimum_aggregate_original_candidate_acceptance_rate || 0),
    aggregateModelRewriteRate:
      totalTurns > 0 && modelRewrites / totalTurns <= Number(first.maximum_aggregate_model_rewrite_rate ?? 1),
    totalFallbacks: fallbacks <= Number(first.maximum_total_deterministic_fallback_turns ?? Number.MAX_SAFE_INTEGER),
  };
  return {
    completedCells: completed.length,
    totalTurns,
    originalCandidatesAccepted: original,
    originalCandidateAcceptanceRate: totalTurns ? original / totalTurns : null,
    mechanicalRepairs: completed.reduce((sum, cell) => sum + Number(cell.observed.mechanicalRepairs || 0), 0),
    modelRewrites,
    deterministicFallbacks: fallbacks,
    finalSafetyFailures: completed.reduce((sum, cell) => sum + Number(cell.observed.finalSafetyFailures || 0), 0),
    meanOriginalLatencyMs: totalTurns
      ? completed.reduce(
          (sum, cell) => sum + Number(cell.observed.meanOriginalLatencyMs || 0) * Number(cell.observed.turns || 0),
          0,
        ) / totalTurns
      : null,
    meanTotalTutorLatencyMs: totalTurns
      ? completed.reduce(
          (sum, cell) => sum + Number(cell.observed.meanTotalTutorLatencyMs || 0) * Number(cell.observed.turns || 0),
          0,
        ) / totalTurns
      : null,
    gates,
    status: Object.values(gates).every(Boolean) ? 'pass' : 'fail',
  };
}

async function runAcceptance(plan, config, loaded) {
  const frozen = {
    gitHead: gitHead(),
    configPath: loaded.configPath,
    configSha256: sha256File(loaded.configPath),
  };
  const cells = [];
  const [hardest, ...remaining] = plan.cells;
  const hardestResult = await runAcceptanceCell(hardest, config, frozen);
  cells.push(hardestResult);
  if (hardestResult.status !== 'pass' && !args['complete-all-cells']) {
    cells.push(
      ...remaining.map((cell) => ({
        id: cell.id,
        world: cell.world,
        learnerProfile: cell.learnerProfile,
        seed: cell.seed,
        seedDisposition: 'unconsumed',
        status: 'unstarted_after_hard_cell_failure',
      })),
    );
  } else {
    const rest = await mapLimit(remaining, Math.min(3, plan.maxConcurrency), (cell) =>
      runAcceptanceCell(cell, config, frozen),
    );
    cells.push(...rest);
  }
  const aggregate = aggregateAcceptance(cells, config);
  const result = {
    schema: 'machinespirits.tutor-stub.first-draft-acceptance-result.v1',
    generatedAt: new Date().toISOString(),
    campaignId: config.id,
    frozen,
    completeAllCells: args['complete-all-cells'],
    status: aggregate.status,
    cells,
    aggregate,
    claimBoundary: config.claim_boundary,
  };
  const resultPath = writeJson(path.join(plan.artifactRoot, 'campaign-result.json'), result);
  console.log(`acceptance ${result.status}: ${resultPath}`);
  return result;
}

async function main() {
  if (args.help) {
    console.log(usage());
    return;
  }
  const mode = String(args.mode || '')
    .trim()
    .toLowerCase();
  if (!['validate', 'development', 'acceptance'].includes(mode)) {
    throw new Error('--mode must be validate, development, or acceptance');
  }
  const iteration = Number(args.iteration);
  if (!Number.isInteger(iteration) || iteration < 1) throw new Error('--iteration must be a positive integer');
  const loaded = loadTutorStubFirstDraftCampaign(args.config, { root: ROOT });
  let plan = expandTutorStubFirstDraftCampaign({
    config: loaded.config,
    root: ROOT,
    iteration,
  });
  const developmentFrozen = plan.kind === 'working_screen'
    ? freezeDevelopmentState(loaded)
    : null;
  if (developmentFrozen) {
    plan = applyTutorStubFirstDraftDevelopmentRuntimePreflight({
      plan,
      frozen: developmentFrozen,
    });
  }
  if (mode === 'development') {
    assertTutorStubFirstDraftDevelopmentIterationVacant(plan.iterationRoot);
  }
  const validationArtifactPath = tutorStubFirstDraftCampaignValidationArtifactPath({
      artifactRoot: plan.artifactRoot,
      mode,
      iteration,
    });
  const validation = buildTutorStubFirstDraftCampaignValidationReport({
    plan,
    config: loaded.config,
    configPath: loaded.configPath,
    frozen: developmentFrozen,
  });
  const validationPath = (
    mode === 'development' ? writeTutorStubFirstDraftJsonExclusive : writeJson
  )(
    validationArtifactPath,
    validation,
  );
  console.log(`campaign validation: ${validationPath}`);
  if (mode === 'validate') {
    if (plan.preflightReady === false) process.exitCode = 1;
    return;
  }
  let result;
  if (mode === 'development') {
    if (plan.kind !== 'working_screen') throw new Error('development mode requires a working-screen config');
    if (plan.preflightReady === false) {
      result = writeDevelopmentPreflightFailure(
          plan,
          loaded,
          iteration,
          developmentFrozen,
          validationPath,
        );
    } else {
      try {
        result = await runDevelopment(plan, loaded, iteration, developmentFrozen);
      } catch (error) {
        if (error?.tutorStubPreflightCommandFailure) {
          writeDevelopmentPreflightFailure(
            plan,
            loaded,
            iteration,
            developmentFrozen,
            validationPath,
            error.tutorStubPreflightCommandFailure,
          );
        }
        throw error;
      }
    }
  } else {
    if (plan.kind !== 'acceptance') throw new Error('acceptance mode requires a held-out generalization config');
    result = await runAcceptance(plan, loaded.config, loaded);
  }
  if (result.status !== 'pass') process.exitCode = 1;
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
