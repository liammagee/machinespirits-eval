import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  loadTestManifest,
  nodeTapOutputIsComplete,
  parseNodeTapSummary,
  parseVitestJsonSummary,
  synchronizeTestManifest,
  validatePhaseSummary,
  validateTestManifest,
} from '../scripts/hermetic-test-contract.js';
import {
  buildCoreTestArgs,
  buildRootTestArgs,
  buildTestPhases,
  createIsolatedPaths,
  discoverRootTestFiles,
  formatPhaseFailureDiagnostic,
  parseRootTimingReport,
  parseRunnerArgs,
  readRootTapSummary,
  replayCapturedOutput,
  runPhase,
  selectTestShard,
} from '../scripts/run-hermetic-tests.js';
import { describeManifestChanges, runManifestSync } from '../scripts/sync-hermetic-test-manifest.js';

test('default hermetic run selects root and in-housed core suites', () => {
  const options = parseRunnerArgs([]);
  assert.deepEqual(options, {
    suite: 'all',
    forceExit: true,
    printEnv: false,
    quiet: false,
    shard: null,
    forwarded: [],
  });
  const projectRoot = path.resolve('.');
  const phases = buildTestPhases(options, projectRoot, '/tmp/hermetic-reports');
  assert.deepEqual(
    phases.map(({ phase, forceExit }) => ({ phase, forceExit })),
    [
      { phase: 'root', forceExit: true },
      { phase: 'core', forceExit: false },
    ],
  );
  assert.equal(phases[1].args[0], path.join(projectRoot, 'node_modules/vitest/vitest.mjs'));
  const manifestState = validateTestManifest(loadTestManifest(projectRoot), projectRoot);
  assert.equal(phases[0].selectedFiles.length, manifestState.rootFiles.length);
  assert.equal(phases[1].selectedFiles.length, manifestState.coreFiles.length);
  assert.equal(phases[1].reportPath, '/tmp/hermetic-reports/tutor-core-vitest-results.json');
});

test('explicit historical test paths remain scoped to the root suite', () => {
  assert.deepEqual(parseRunnerArgs(['tests/workplan.test.js']), {
    suite: 'root',
    forceExit: true,
    printEnv: false,
    quiet: false,
    shard: null,
    forwarded: ['tests/workplan.test.js'],
  });
});

test('suite and no-force-exit controls are parsed without leaking into child args', () => {
  assert.deepEqual(parseRunnerArgs(['--suite', 'root', '--no-force-exit']), {
    suite: 'root',
    forceExit: false,
    printEnv: false,
    quiet: false,
    shard: null,
    forwarded: [],
  });
  assert.throws(() => parseRunnerArgs(['--suite', 'unknown']), /Invalid test suite/);
  assert.throws(() => parseRunnerArgs(['--test-reporter=spec']), /reserve --test-reporter/);
  assert.throws(() => parseRunnerArgs(['--suite', 'core', '--reporter=dot']), /reserve --reporter/);
});

test('root sharding is deterministic, exhaustive, and isolated from forwarded runner arguments', () => {
  const files = ['a.test.js', 'b.test.js', 'c.test.js', 'd.test.js', 'e.test.js'];
  const first = selectTestShard(files, { index: 1, total: 2 });
  const second = selectTestShard(files, { index: 2, total: 2 });
  assert.deepEqual([...first, ...second].sort(), files);
  assert.equal(
    first.some((file) => second.includes(file)),
    false,
  );
  assert.deepEqual(
    selectTestShard([...files].reverse(), { index: 1, total: 2 }).sort(),
    [...first].sort(),
    'file ordering must not change stable shard membership',
  );
  const withInsertedFile = ['000-new.test.js', ...files];
  assert.deepEqual(
    selectTestShard(withInsertedFile, { index: 1, total: 2 })
      .filter((file) => files.includes(file))
      .sort(),
    [...first].sort(),
    'adding a file must not move existing files between shards',
  );

  const options = parseRunnerArgs(['--suite', 'root', '--shard=1/2', '--quiet']);
  assert.deepEqual(options, {
    suite: 'root',
    forceExit: true,
    printEnv: false,
    quiet: true,
    shard: { index: 1, total: 2 },
    forwarded: [],
  });
  const phase = buildTestPhases(options, path.resolve('.'), '/tmp/hermetic-reports')[0];
  const rootFiles = discoverRootTestFiles();
  assert.deepEqual(phase.selectedFiles, selectTestShard(rootFiles, { index: 1, total: 2 }));
  assert.ok(phase.selectedFiles.includes('tests/tutorStubFirstDraftOuterLoop.test.js'));
  assert.ok(
    Math.abs(phase.selectedFiles.length - rootFiles.length / 2) <= rootFiles.length * 0.1,
    'checked-in shard seed should retain a useful file-count balance',
  );
  assert.deepEqual(phase.args.slice(-phase.selectedFiles.length), phase.selectedFiles);

  assert.throws(() => parseRunnerArgs(['--shard=0/2']), /Invalid test shard/u);
  assert.throws(() => parseRunnerArgs(['--shard=1/1']), /Invalid test shard/u);
  assert.throws(() => parseRunnerArgs(['--shard=3/2']), /Invalid test shard/u);
  assert.throws(() => parseRunnerArgs(['--suite', 'core', '--shard=1/2']), /only for the root suite/u);
  assert.throws(
    () => parseRunnerArgs(['--shard=1/2', 'tests/workplan.test.js']),
    /cannot be combined with explicit test paths/u,
  );
});

test('quiet phases retain child output for accounting without mirroring successful chatter', async () => {
  let mirrored = '';
  const result = await runPhase({
    phase: 'root',
    forceExit: true,
    args: ['-e', "process.stdout.write('captured-child-output')"],
    env: process.env,
    quiet: true,
    projectRoot: path.resolve('.'),
    stdoutStream: { write: (chunk) => (mirrored += String(chunk)) },
    onChild: () => {},
  });
  assert.equal(result.code, 0);
  assert.equal(result.stdout, 'captured-child-output');
  assert.doesNotMatch(mirrored, /captured-child-output/u);
});

test('quiet phases wait for inherited stdout pipes to close before parsing the TAP footer', async () => {
  const lateTapFooter = '1..1\\n# tests 1\\n# pass 1\\n# fail 0\\n';
  const childScript = `
    const { spawn } = require('node:child_process');
    const writer = spawn(process.execPath, ['-e', ${JSON.stringify(
      `setTimeout(() => process.stdout.write(${JSON.stringify(lateTapFooter)}), 50);`,
    )}], { detached: true, stdio: ['ignore', 1, 2] });
    writer.unref();
  `;
  const result = await runPhase({
    phase: 'root',
    forceExit: true,
    args: ['-e', childScript],
    env: process.env,
    quiet: true,
    projectRoot: path.resolve('.'),
    onChild: () => {},
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /# tests 1/u, result.stderr);
  assert.match(result.stdout, /# fail 0/u);
});

test('quiet phase drain stays open while late TAP output is still arriving', async () => {
  const childScript = `
    const { spawn } = require('node:child_process');
    const writer = spawn(process.execPath, ['-e', ${JSON.stringify(`
      process.stdout.write('TAP version 13\\n');
      setTimeout(() => process.stdout.write('1..1\\n'), 100);
      setTimeout(() => process.stdout.write('# tests 1\\n# pass 1\\n# fail 0\\n'), 200);
    `)}], { detached: true, stdio: ['ignore', 1, 2] });
    writer.unref();
  `;
  const result = await runPhase({
    phase: 'root',
    forceExit: true,
    args: ['-e', childScript],
    env: process.env,
    quiet: true,
    projectRoot: path.resolve('.'),
    stdioDrainIdleMs: 1_000,
    stdioDrainMaxMs: 3_000,
    onChild: () => {},
  });

  assert.match(result.stdout, /# tests 1/u, result.stderr);
  assert.equal(parseNodeTapSummary(result.stdout).fail, 0);
});

test('quiet phases bound the drain wait when a detached descendant keeps stdout open', async () => {
  const childScript = `
    const { spawn } = require('node:child_process');
    const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 3000)'], {
      detached: true,
      stdio: ['ignore', 1, 2],
    });
    holder.unref();
  `;
  const startedAt = Date.now();
  const result = await runPhase({
    phase: 'root',
    forceExit: true,
    args: ['-e', childScript],
    env: process.env,
    quiet: true,
    projectRoot: path.resolve('.'),
    stdioDrainIdleMs: 100,
    stdioDrainMaxMs: 500,
    onChild: () => {},
  });

  assert.equal(result.code, 0);
  assert.ok(Date.now() - startedAt < 1_000, 'stdio drain wait should be bounded');
});

test('captured failure replay waits for backpressured output to flush', async () => {
  let replayed = '';
  let flushed = false;
  const slowStream = {
    write(chunk, callback) {
      setTimeout(() => {
        replayed += String(chunk);
        flushed = true;
        callback();
      }, 25);
      return false;
    },
  };
  const emptyStream = { write: (_chunk, callback) => callback() };

  await replayCapturedOutput({ stdout: 'complete TAP output', stderr: '' }, slowStream, emptyStream);

  assert.equal(flushed, true);
  assert.equal(replayed, 'complete TAP output');
});

test('root timing reports rank slow files and failure diagnostics identify the complete shard', () => {
  assert.deepEqual(
    parseRootTimingReport(
      [
        JSON.stringify({ file: 'tests/fast.test.js', durationMs: 5, tests: 1, failures: 0 }),
        JSON.stringify({ file: 'tests/slow.test.js', durationMs: 50, tests: 2, failures: 1 }),
      ].join('\n'),
    ),
    [
      { file: 'tests/slow.test.js', durationMs: 50, tests: 2, failures: 1 },
      { file: 'tests/fast.test.js', durationMs: 5, tests: 1, failures: 0 },
    ],
  );
  assert.equal(
    formatPhaseFailureDiagnostic(
      { phase: 'root', selectedFiles: ['tests/a.test.js', 'tests/b.test.js'] },
      { code: 1, signal: null },
    ),
    [
      '[test:hermetic] root failed code=1; selected_files=2',
      '[test:hermetic] selected: tests/a.test.js',
      '[test:hermetic] selected: tests/b.test.js',
    ].join('\n'),
  );
});

test('root discovery stays explicit while the core phase targets all in-housed Vitest files', () => {
  const rootFiles = discoverRootTestFiles();
  assert.ok(rootFiles.includes(path.join('tests', 'hermeticTestRunner.test.js')));
  assert.equal(
    rootFiles.some((file) => file.startsWith('tutor-core/')),
    false,
  );

  const rootArgs = buildRootTestArgs({ forwarded: ['tests/hermeticTestRunner.test.js'] });
  assert.deepEqual(rootArgs, [
    '--test',
    '--test-reporter=tap',
    '--test-force-exit',
    'tests/hermeticTestRunner.test.js',
  ]);
  assert.equal(buildRootTestArgs({ forceExit: false }).includes('--test-force-exit'), false);

  const coreArgs = buildCoreTestArgs({
    projectRoot: '/repo',
    forwarded: ['tutor-core/services/__tests__/example.test.js'],
    reportPath: '/tmp/core.json',
  });
  assert.deepEqual(coreArgs, [
    '/repo/node_modules/vitest/vitest.mjs',
    'run',
    'tutor-core/services/__tests__/example.test.js',
    '--reporter=default',
    '--reporter=json',
    '--outputFile.json=/tmp/core.json',
  ]);
  assert.equal(coreArgs.includes('--test-force-exit'), false);
});

test('isolated environment covers root and tutor-core writable stores', () => {
  const paths = createIsolatedPaths('/tmp/hermetic');
  assert.equal(paths.EVAL_DB_PATH, '/tmp/hermetic/evaluations.db');
  assert.equal(paths.TUTOR_CORE_LOG_DIR, '/tmp/hermetic/tutor-core-logs');
  assert.equal(paths.TUTOR_STUB_TRACE_DIR, '/tmp/hermetic/tutor-stub-traces');
});

test('checked-in manifest exactly classifies root, core, and deliberate fixture tests', () => {
  const projectRoot = path.resolve('.');
  const manifest = loadTestManifest(projectRoot);
  const state = validateTestManifest(manifest, projectRoot);
  assert.ok(state.rootFiles.length > 0);
  assert.ok(state.coreFiles.length > 0);
  assert.deepEqual(state.excludedFiles, [
    'tests/fixtures/tutor-stub-first-draft/captured-deterministic-failure.test.js',
  ]);
});

test('manifest validation reports missing, extra, and unclassified test files', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-manifest-fixture-'));
  const writeTest = (relativePath) => {
    fs.mkdirSync(path.dirname(path.join(projectRoot, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, relativePath), '// fixture\n');
  };
  try {
    for (const relativePath of [
      'services/__tests__/service.test.js',
      'tests/root.test.js',
      'tutor-core/services/__tests__/core.test.js',
      'tests/fixtures/captured.test.js',
    ]) {
      writeTest(relativePath);
    }
    const manifest = {
      version: 1,
      suites: {
        root: { requiredFiles: ['services/__tests__/service.test.js', 'tests/root.test.js'] },
        core: { requiredFiles: ['tutor-core/services/__tests__/core.test.js'] },
      },
      fixtureExclusions: [
        { file: 'tests/fixtures/captured.test.js', owner: 'fixture-owner', reason: 'expected failure' },
      ],
      allowedSkips: [],
    };
    assert.deepEqual(validateTestManifest(manifest, projectRoot).excludedFiles, ['tests/fixtures/captured.test.js']);

    manifest.fixtureExclusions.push({
      file: 'tests/root.test.js',
      owner: 'fixture-owner',
      reason: 'invalid duplicate classification',
    });
    assert.throws(() => validateTestManifest(manifest, projectRoot), /exactly one root, core, or fixture/u);
    manifest.fixtureExclusions.pop();

    writeTest('prototypes/local-prototype/tests/ignored.test.js');
    assert.deepEqual(validateTestManifest(manifest, projectRoot).excludedFiles, ['tests/fixtures/captured.test.js']);

    writeTest('tests/extra.test.js');
    assert.throws(() => validateTestManifest(manifest, projectRoot), /root test manifest drift; extra/u);

    manifest.suites.root.requiredFiles.push('tests/extra.test.js', 'tests/missing.test.js');
    assert.throws(() => validateTestManifest(manifest, projectRoot), /missing: tests\/missing\.test\.js/u);

    manifest.suites.root.requiredFiles.pop();
    writeTest('routes/unclassified.test.js');
    assert.throws(
      () => validateTestManifest(manifest, projectRoot),
      /classified test manifest drift; extra: routes\/unclassified\.test\.js/u,
    );
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('manifest synchronization registers ordinary suite files while preserving explicit classifications', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-manifest-sync-'));
  const writeTest = (relativePath) => {
    fs.mkdirSync(path.dirname(path.join(projectRoot, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, relativePath), '// fixture\n');
  };
  const manifest = {
    version: 1,
    suites: {
      root: { requiredFiles: ['tests/removed.test.js'] },
      core: { requiredFiles: ['tutor-core/services/__tests__/core.test.js'] },
    },
    fixtureExclusions: [
      { file: 'tests/fixtures/captured.test.js', owner: 'fixture-owner', reason: 'expected failure' },
    ],
    allowedSkips: [],
  };

  try {
    for (const relativePath of [
      'services/__tests__/service.test.js',
      'tests/root.test.js',
      'tutor-core/services/__tests__/core.test.js',
      'tests/fixtures/captured.test.js',
    ]) {
      writeTest(relativePath);
    }
    fs.mkdirSync(path.join(projectRoot, 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'config/hermetic-test-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );

    const synchronized = synchronizeTestManifest(manifest, projectRoot);
    assert.deepEqual(synchronized.suites.root.requiredFiles, [
      'services/__tests__/service.test.js',
      'tests/root.test.js',
    ]);
    assert.deepEqual(describeManifestChanges(manifest, synchronized), [
      'root added: services/__tests__/service.test.js, tests/root.test.js',
      'root removed: tests/removed.test.js',
    ]);
    assert.doesNotThrow(() => validateTestManifest(synchronized, projectRoot));

    const originalLog = console.log;
    const originalError = console.error;
    console.log = () => {};
    console.error = () => {};
    try {
      assert.equal(runManifestSync(['--check'], projectRoot), 1);
      assert.equal(runManifestSync(['--write'], projectRoot), 0);
      assert.equal(runManifestSync(['--check'], projectRoot), 0);
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('Node TAP accounting includes named skipped suites even when the summary skip count is zero', () => {
  const summary = parseNodeTapSummary(`TAP version 13
ok 1 - absent dialogue suite # SKIP no logs on disk
ok 2 - runnable test
1..2
# tests 1
# suites 1
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
`);
  assert.equal(summary.tests, 1);
  assert.equal(summary.skipped, 0);
  assert.deepEqual(summary.skipEvents, [{ test: 'absent dialogue suite', reason: 'no logs on disk' }]);
});

test('Vitest JSON accounting reports executed files and pending tests', () => {
  const summary = parseVitestJsonSummary(
    JSON.stringify({
      numTotalTestSuites: 2,
      numPassedTestSuites: 1,
      numFailedTestSuites: 0,
      numPendingTestSuites: 1,
      numTotalTests: 2,
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 1,
      numTodoTests: 0,
      testResults: [
        {
          name: '/repo/tutor-core/services/__tests__/core.test.js',
          assertionResults: [
            { status: 'passed', fullName: 'core passes' },
            { status: 'pending', fullName: 'core waits', failureMessages: ['fixture absent'] },
          ],
        },
      ],
    }),
    '/repo',
  );
  assert.equal(summary.tests, 2);
  assert.deepEqual(summary.files, ['tutor-core/services/__tests__/core.test.js']);
  assert.deepEqual(summary.skipEvents, [{ test: 'core waits', reason: 'fixture absent' }]);
});

test('phase accounting rejects zero tests and undeclared skips but accepts a host-scoped ledger entry', () => {
  const base = {
    phase: 'root',
    selectedFiles: ['tests/example.test.js'],
    allowedSkips: [],
    env: {},
    platform: 'linux',
    requireExactFiles: false,
  };
  assert.throws(() => validatePhaseSummary({ ...base, summary: { tests: 0, skipEvents: [] } }), /executed zero tests/u);
  assert.throws(
    () =>
      validatePhaseSummary({
        ...base,
        summary: { tests: 1, skipped: 1, skipEvents: [{ test: 'hidden test', reason: '' }] },
      }),
    /undeclared skip: hidden test/u,
  );

  const summary = validatePhaseSummary({
    ...base,
    env: { CI: '1' },
    allowedSkips: [
      {
        id: 'ci-only',
        suite: 'root',
        testPattern: '^hidden test$',
        environmentPresent: ['CI'],
        owner: 'fixture-owner',
        reason: 'shared CI timing',
        removalSlice: 'ci-fixture',
      },
    ],
    summary: { tests: 1, skipped: 1, skipEvents: [{ test: 'hidden test', reason: '' }] },
  });
  assert.equal(summary.matchedSkips[0].ledger.id, 'ci-only');
});

test('checked-in skip ledger matches the declared clean Linux CI skip shapes', () => {
  const manifest = loadTestManifest(path.resolve('.'));
  const skipEvents = [
    {
      test: 'reproduces published figures',
      reason: 'archived corpus absent (/repo/data/paper2/superego.jsonl); sibling private repo not checked out',
    },
    { test: 'a sealed passing preflight', reason: 'codex/claude CLIs not installed on this host' },
    { test: 'auto mode keeps a separate editable command line while model output is generated', reason: '' },
  ];
  const summary = validatePhaseSummary({
    phase: 'root',
    summary: { tests: 3, skipped: 3, skipEvents },
    selectedFiles: ['tests/example.test.js'],
    allowedSkips: manifest.allowedSkips,
    env: { CI: 'true' },
    platform: 'linux',
    requireExactFiles: false,
  });
  assert.deepEqual(
    summary.matchedSkips.map((skip) => skip.ledger.id),
    ['paper-superego-private-archive', 'model-cli-fingerprints', 'concurrent-pty-ci'],
  );
});

test('the concurrent PTY skip is discharged by a dedicated natural-teardown CI lane', () => {
  const packageManifest = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  assert.match(packageManifest.scripts['test:pty:ci'], /^TUTOR_STUB_RUN_CONCURRENT_PTY_TEST=1 /u);
  assert.match(packageManifest.scripts['test:pty:ci'], /--no-force-exit/u);
  for (const group of ['Direction', 'Performance', 'Terminal', 'Turns', 'Voice']) {
    assert.match(packageManifest.scripts['test:pty:ci'], new RegExp(`tutorStubInteractive${group}\\.test\\.js`, 'u'));
  }
  assert.match(packageManifest.scripts['test:lifecycle:ci'], /--no-force-exit/u);
  assert.match(packageManifest.scripts['test:lifecycle:ci'], /applicationShutdown\.test\.js/u);
  assert.match(packageManifest.scripts['test:lifecycle:ci'], /tutorStubProcessSessionHttp\.test\.js/u);

  const workflow = fs.readFileSync(path.resolve('.github/workflows/test.yml'), 'utf8');
  assert.match(workflow, /^ {2}pty-concurrency:\n {4}name: PTY \/ loopback concurrency$/mu);
  assert.match(workflow, /^ {8}run: npm run test:pty:ci$/mu);
  assert.match(workflow, /^ {8}run: npm run test:lifecycle:ci$/mu);

  const interactiveHarness = fs.readFileSync(path.resolve('tests/helpers/tutorStubInteractiveHarness.js'), 'utf8');
  const terminalSuite = fs.readFileSync(path.resolve('tests/tutorStubInteractiveTerminal.test.js'), 'utf8');
  assert.match(interactiveHarness, /process\.env\.TUTOR_STUB_RUN_CONCURRENT_PTY_TEST === '1'/u);
  assert.match(terminalSuite, /Boolean\(process\.env\.CI\) && !RUN_CONCURRENT_PTY_IN_CI/u);
});

test('CI shards both supported Node versions, caches npm downloads, and avoids unneeded LFS checkout', () => {
  const workflow = fs.readFileSync(path.resolve('.github/workflows/test.yml'), 'utf8');
  assert.match(workflow, /^concurrency:\n {2}group: .*github\.workflow.*github\.ref/mu);
  assert.match(workflow, /^ {2}test-contract:\n {4}name: Hermetic test contract$/mu);
  assert.match(workflow, /^ {8}run: npm run test:manifest$/mu);
  assert.match(workflow, /^ {2}test:\n {4}needs: test-contract$/mu);
  assert.match(workflow, /^ {2}pty-concurrency:\n {4}name: PTY \/ loopback concurrency\n {4}needs: test-contract$/mu);
  assert.match(workflow, /^ {6}fail-fast: false$/mu);
  assert.match(workflow, /^ {8}node-version: \[20, 22\]\n {8}shard: \[1, 2\]$/mu);
  assert.match(workflow, /npm run test:root -- --shard=\$\{\{ matrix\.shard \}\}\/2 --quiet/u);
  assert.match(workflow, /^ {8}if: matrix\.shard == 1\n {8}run: npm run test:core -- --quiet$/mu);
  assert.equal(workflow.match(/cache: npm/gu)?.length, 4);
  assert.equal(workflow.match(/^ {6}- run: npm ci$/gmu)?.length, 4);
  assert.doesNotMatch(workflow, /npm ci --omit=optional/u);
  assert.doesNotMatch(workflow, /lfs: true/u);

  const packageManifest = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  const desktopManifest = JSON.parse(fs.readFileSync(path.resolve('desktop/package.json'), 'utf8'));
  assert.equal(packageManifest.engines.node, '>=20.0.0');
  assert.equal(packageManifest.devDependencies.electron, undefined);
  assert.equal(packageManifest.optionalDependencies, undefined);
  assert.equal(desktopManifest.engines.node, '>=22.12.0');
  assert.equal(desktopManifest.devDependencies.electron, '^43.2.0');
  assert.equal(desktopManifest.devDependencies['@electron/rebuild'], '^4.2.0');
  assert.equal(packageManifest.scripts['desktop:install'], 'npm ci --prefix desktop');
  assert.match(packageManifest.scripts['desktop:dev'], /^desktop\/node_modules\/\.bin\/electron /u);
  const rootLock = JSON.parse(fs.readFileSync(path.resolve('package-lock.json'), 'utf8'));
  for (const desktopOnlyPackage of ['electron', '@electron/rebuild', 'electron-builder', 'temp']) {
    assert.equal(rootLock.packages[`node_modules/${desktopOnlyPackage}`], undefined);
  }

  const validationWorkflow = fs.readFileSync(path.resolve('.github/workflows/validate.yml'), 'utf8');
  assert.match(validationWorkflow, /npm run content:validate/u);
  assert.match(validationWorkflow, /npm run paper:provable-discourse:smoke/u);
  assert.doesNotMatch(validationWorkflow, /npm run paper:provable-discourse:test/u);
  assert.doesNotMatch(validationWorkflow, /npm run ontology:test/u);

  for (const workflowPath of ['.github/workflows/validate.yml', '.github/workflows/workplan-validate.yml']) {
    const companionWorkflow = fs.readFileSync(path.resolve(workflowPath), 'utf8');
    assert.match(companionWorkflow, /^concurrency:\n {2}group: .*github\.workflow.*github\.ref/mu);
    assert.match(companionWorkflow, /cache: npm/u);
  }
});

const COMPLETE_TAP = `TAP version 13
ok 1 - first case
ok 2 - second case
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
`;

test('a TAP stream is complete only when it carries both the plan line and the counters', () => {
  assert.equal(nodeTapOutputIsComplete(COMPLETE_TAP), true);
  // What a force-exited child leaves on a backpressured pipe: green test lines,
  // no tail. Every one of these reads as an all-green run to a line-counting eye.
  assert.equal(nodeTapOutputIsComplete('TAP version 13\nok 1 - first case\nok 2 - second case\n'), false);
  assert.equal(nodeTapOutputIsComplete(COMPLETE_TAP.split('# tests 2')[0]), false, 'plan without counters');
  assert.equal(nodeTapOutputIsComplete(COMPLETE_TAP.replace('1..2\n', '')), false, 'counters without plan');
  assert.equal(nodeTapOutputIsComplete(''), false);
});

test('a truncated TAP summary names the channel it came from', () => {
  assert.throws(() => parseNodeTapSummary('TAP version 13\nok 1 - only case\n', { source: 'root TAP stdout' }), {
    message: 'root TAP stdout omitted the TAP plan line',
  });
  assert.equal(parseNodeTapSummary(COMPLETE_TAP).plan, 2);
});

test('root test args add a file TAP destination beside the piped one', () => {
  const withTap = buildRootTestArgs({ testFiles: ['tests/example.test.js'], tapPath: '/tmp/out.tap' });
  assert.deepEqual(
    withTap.slice(0, 5),
    [
      '--test',
      '--test-reporter=tap',
      '--test-reporter-destination=stdout',
      '--test-reporter=tap',
      '--test-reporter-destination=/tmp/out.tap',
    ],
    withTap.join(' '),
  );
  // Omitting tapPath keeps the historical single-reporter form, so a caller
  // building args by hand is unaffected.
  assert.deepEqual(buildRootTestArgs({ testFiles: ['tests/example.test.js'] }), [
    '--test',
    '--test-reporter=tap',
    '--test-force-exit',
    'tests/example.test.js',
  ]);
});

test('the root verdict is read from the TAP file when the pipe was truncated', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-tap-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const tapPath = path.join(root, 'root-node-test-output.tap');
  fs.writeFileSync(tapPath, COMPLETE_TAP);

  // This is the reported CI failure exactly: a green but tailless pipe.
  const truncated = { stdout: 'TAP version 13\nok 1 - first case\nok 2 - second case\n' };
  const summary = readRootTapSummary({ phase: 'root', tapPath }, truncated);
  assert.equal(summary.tests, 2);
  assert.equal(summary.fail, 0);
  assert.equal(summary.plan, 2);
});

test('the root verdict falls back to the pipe when no TAP file was written', () => {
  const summary = readRootTapSummary({ phase: 'root', tapPath: null }, { stdout: COMPLETE_TAP });
  assert.equal(summary.tests, 2);
});

test('a root verdict missing from every channel names them all', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-tap-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const tapPath = path.join(root, 'root-node-test-output.tap');
  fs.writeFileSync(tapPath, 'TAP version 13\nok 1 - first case\n');

  assert.throws(
    () => readRootTapSummary({ phase: 'root', tapPath }, { stdout: 'TAP version 13\n' }),
    (error) => {
      assert.match(error.message, /omitted the TAP test summary on every channel/u);
      assert.match(error.message, /root-node-test-output\.tap \(\d+ bytes, no complete tail\)/u);
      assert.match(error.message, /stdout \(\d+ bytes, no complete tail\)/u);
      return true;
    },
  );
});

test('a force-exited child writes its TAP tail to a file after the pipe has lost it', async (t) => {
  // The regression this guards: `--test-force-exit` calls process.exit(), which
  // does not flush a pipe. Under a slow reader the trailing plan and counters
  // never reach stdout, while the file destination still receives them.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-tap-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const testFile = path.join(root, 'padding.test.js');
  const tapPath = path.join(root, 'out.tap');
  fs.writeFileSync(
    testFile,
    [
      'import test from "node:test";',
      'setInterval(() => {}, 100000);',
      'for (let i = 0; i < 60; i += 1) test(`padding case ${i}`, () => {});',
    ].join('\n'),
  );

  // The real runner starts from a plain node process. This test is itself
  // inside `node --test`, so the recursion marker has to be cleared or the
  // spawned runner declines to run any files at all.
  const { NODE_TEST_CONTEXT: _recursionMarker, ...env } = process.env;
  const result = await runPhase({
    phase: 'root',
    forceExit: true,
    args: buildRootTestArgs({ testFiles: [testFile], tapPath }),
    env,
    quiet: true,
    projectRoot: root,
    onChild: () => {},
  });

  assert.equal(fs.existsSync(tapPath), true, result.stderr);
  assert.equal(nodeTapOutputIsComplete(fs.readFileSync(tapPath, 'utf8')), true);
  const summary = readRootTapSummary({ phase: 'root', tapPath }, result);
  assert.equal(summary.fail, 0);
  assert.equal(summary.tests, 60);
});
