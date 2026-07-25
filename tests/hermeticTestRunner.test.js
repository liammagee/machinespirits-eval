import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  loadTestManifest,
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
  parseRunnerArgs,
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
  assert.deepEqual(first, ['a.test.js', 'c.test.js', 'e.test.js']);
  assert.deepEqual(second, ['b.test.js', 'd.test.js']);
  assert.deepEqual([...first, ...second].sort(), files);
  assert.equal(
    first.some((file) => second.includes(file)),
    false,
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
  assert.equal(phase.selectedFiles.length, Math.ceil(rootFiles.length / 2));
  assert.deepEqual(
    phase.selectedFiles,
    rootFiles.filter((_, index) => index % 2 === 0),
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
    stdioDrainIdleMs: 150,
    stdioDrainMaxMs: 750,
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
  assert.equal(
    packageManifest.scripts['test:pty:ci'],
    'TUTOR_STUB_RUN_CONCURRENT_PTY_TEST=1 node scripts/run-hermetic-tests.js --suite root --no-force-exit tests/tutorStubInteractiveModes.test.js',
  );

  const workflow = fs.readFileSync(path.resolve('.github/workflows/test.yml'), 'utf8');
  assert.match(workflow, /^ {2}pty-concurrency:\n {4}name: PTY \/ loopback concurrency$/mu);
  assert.match(workflow, /^ {8}run: npm run test:pty:ci$/mu);

  const interactiveSuite = fs.readFileSync(path.resolve('tests/tutorStubInteractiveModes.test.js'), 'utf8');
  assert.match(interactiveSuite, /process\.env\.TUTOR_STUB_RUN_CONCURRENT_PTY_TEST === '1'/u);
  assert.match(interactiveSuite, /Boolean\(process\.env\.CI\) && !RUN_CONCURRENT_PTY_IN_CI/u);
});

test('CI shards both supported Node versions, caches npm downloads, and avoids unneeded LFS checkout', () => {
  const workflow = fs.readFileSync(path.resolve('.github/workflows/test.yml'), 'utf8');
  assert.match(workflow, /^concurrency:\n {2}group: .*github\.workflow.*github\.ref/mu);
  assert.match(workflow, /^ {2}test-contract:\n {4}name: Hermetic test contract$/mu);
  assert.match(workflow, /^ {8}run: npm run test:manifest$/mu);
  assert.match(workflow, /^ {2}test:\n {4}needs: test-contract$/mu);
  assert.match(workflow, /^ {2}pty-concurrency:\n {4}name: PTY \/ loopback concurrency\n {4}needs: test-contract$/mu);
  assert.match(workflow, /^ {8}node-version: \[20, 22\]\n {8}shard: \[1, 2\]$/mu);
  assert.match(workflow, /npm run test:root -- --shard=\$\{\{ matrix\.shard \}\}\/2 --quiet/u);
  assert.match(workflow, /^ {8}if: matrix\.shard == 1\n {8}run: npm run test:core -- --quiet$/mu);
  assert.equal(workflow.match(/cache: npm/gu)?.length, 4);
  assert.doesNotMatch(workflow, /lfs: true/u);

  for (const workflowPath of ['.github/workflows/validate.yml', '.github/workflows/workplan-validate.yml']) {
    const companionWorkflow = fs.readFileSync(path.resolve(workflowPath), 'utf8');
    assert.match(companionWorkflow, /^concurrency:\n {2}group: .*github\.workflow.*github\.ref/mu);
    assert.match(companionWorkflow, /cache: npm/u);
  }
});
