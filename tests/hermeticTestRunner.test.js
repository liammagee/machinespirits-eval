import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  discoverAllContractTestFiles,
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
  formatStallDiagnostic,
  NODE_REPORTS_FILES_AS_THEY_FINISH,
  parseRootTimingReport,
  parseRunnerArgs,
  readRootExecutedFiles,
  readRootTapSummary,
  replayCapturedOutput,
  runPhase,
  selectTestShard,
} from '../scripts/run-hermetic-tests.js';
import hermeticTimingReporter from '../scripts/hermetic-timing-reporter.js';
import { describeManifestChanges, runManifestSync } from '../scripts/sync-hermetic-test-manifest.js';

test('default hermetic run selects root and in-housed core suites', () => {
  const options = parseRunnerArgs([]);
  assert.deepEqual(options, {
    suite: 'all',
    forceExit: false,
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
      { phase: 'root', forceExit: false },
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
    forceExit: false,
    printEnv: false,
    quiet: false,
    shard: null,
    forwarded: ['tests/workplan.test.js'],
  });
});

test('suite and force-exit controls are parsed without leaking into child args', () => {
  assert.deepEqual(parseRunnerArgs(['--suite', 'root', '--no-force-exit']), {
    suite: 'root',
    forceExit: false,
    printEnv: false,
    quiet: false,
    shard: null,
    forwarded: [],
  });
  // The forced exit is now opt-in, and the flag that used to disable it stays
  // accepted so the standing handle-audit commands keep working unchanged.
  assert.equal(parseRunnerArgs(['--force-exit']).forceExit, true);
  assert.equal(parseRunnerArgs(['--force-exit', '--no-force-exit']).forceExit, false);
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
    forceExit: false,
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
  assert.deepEqual(rootArgs, ['--test', '--test-reporter=tap', 'tests/hermeticTestRunner.test.js']);
  assert.equal(buildRootTestArgs({ forceExit: true }).includes('--test-force-exit'), true);

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

test('gitignored scratch directories are outside the contract, and real drift still is not', (t) => {
  // A nested agent worktree — `.claude/worktrees/<name>/`, created by this repo's
  // own tooling — is a second checkout of the repository sitting inside the first.
  // A plain filesystem walk sees several hundred of its test files and reports
  // every one as unclassified, which made `npm run test:manifest` unusable as a
  // pre-push check for anyone who had one on disk. Git already knows those paths
  // are not part of the checkout, so the enumeration asks git.
  const projectRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-manifest-git-')));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const writeTest = (relativePath) => {
    fs.mkdirSync(path.dirname(path.join(projectRoot, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, relativePath), '// fixture\n');
  };

  execFileSync('git', ['init', '-q'], { cwd: projectRoot, stdio: 'ignore' });
  fs.writeFileSync(path.join(projectRoot, '.gitignore'), '.claude/*\n');
  for (const relativePath of [
    'services/__tests__/service.test.js',
    'tests/root.test.js',
    'tutor-core/services/__tests__/core.test.js',
    '.claude/worktrees/nested/services/__tests__/service.test.js',
    '.claude/worktrees/nested/tests/root.test.js',
    '.claude/worktrees/nested/routes/unclassified.test.js',
  ]) {
    writeTest(relativePath);
  }

  const manifest = {
    version: 1,
    suites: {
      root: { requiredFiles: ['services/__tests__/service.test.js', 'tests/root.test.js'] },
      core: { requiredFiles: ['tutor-core/services/__tests__/core.test.js'] },
    },
    fixtureExclusions: [],
    allowedSkips: [],
  };

  assert.deepEqual(discoverAllContractTestFiles(projectRoot), [
    'services/__tests__/service.test.js',
    'tests/root.test.js',
    'tutor-core/services/__tests__/core.test.js',
  ]);
  assert.doesNotThrow(() => validateTestManifest(manifest, projectRoot));

  // Untracked-but-not-ignored is the state a newly written test file is in, so
  // enumerating from the index alone would have blinded the check to exactly the
  // drift it exists to catch. Each of the three drift classes is still reported.
  writeTest('tests/unregistered.test.js');
  assert.throws(
    () => validateTestManifest(manifest, projectRoot),
    /root test manifest drift; extra: tests\/unregistered/u,
  );
  fs.rmSync(path.join(projectRoot, 'tests/unregistered.test.js'));

  writeTest('tutor-core/services/__tests__/unregistered.test.js');
  assert.throws(() => validateTestManifest(manifest, projectRoot), /core test manifest drift; extra/u);
  fs.rmSync(path.join(projectRoot, 'tutor-core/services/__tests__/unregistered.test.js'));

  writeTest('routes/unclassified.test.js');
  assert.throws(
    () => validateTestManifest(manifest, projectRoot),
    /classified test manifest drift; extra: routes\/unclassified\.test\.js/u,
  );
  fs.rmSync(path.join(projectRoot, 'routes/unclassified.test.js'));

  // The index still names a file deleted from the working tree. Reporting it as
  // present would put the git enumeration at odds with the per-suite filesystem
  // discovery, and the manifest would then be unsatisfiable in both directions.
  execFileSync('git', ['add', '-A'], { cwd: projectRoot, stdio: 'ignore' });
  fs.rmSync(path.join(projectRoot, 'tests/root.test.js'));
  assert.deepEqual(discoverAllContractTestFiles(projectRoot), [
    'services/__tests__/service.test.js',
    'tutor-core/services/__tests__/core.test.js',
  ]);
});

test('without git the walk still refuses to descend into a nested checkout', (t) => {
  // No repository here, so the enumeration falls back to the filesystem walk —
  // which must not reintroduce the defect above on a host with no git, or under
  // a nested checkout parked somewhere the excluded-directory list does not name.
  const projectRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-manifest-nogit-')));
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }));
  const writeTest = (relativePath) => {
    fs.mkdirSync(path.dirname(path.join(projectRoot, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, relativePath), '// fixture\n');
  };

  writeTest('tests/root.test.js');
  writeTest('.claude/worktrees/nested/tests/root.test.js');
  writeTest('side-checkout/tests/root.test.js');
  // What `git worktree add` leaves at the root of a linked worktree: a `.git`
  // file pointing at the real directory, not a `.git` directory.
  fs.writeFileSync(path.join(projectRoot, 'side-checkout/.git'), 'gitdir: /elsewhere/.git/worktrees/side\n');

  assert.deepEqual(discoverAllContractTestFiles(projectRoot), ['tests/root.test.js']);
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

test('a force-exited child leaves its TAP tail on at least one channel', async (t) => {
  // `--test-force-exit` calls process.exit(), and neither destination is safe
  // from it. Two stronger claims were tried here and CI refuted both: that the
  // file channel is always complete (Node 20 lost it in a child that starts and
  // exits inside a quarter of a second), and then that the file is never the
  // poorer of the two (Node 20 produced a run where the pipe had the tail and
  // the file did not).
  //
  // The two channels fail under different conditions. The pipe loses the tail
  // when the parent reads slowly, which is the CI flake this change exists for;
  // the file loses it when the child exits almost immediately, which the real
  // root phase — minutes of output, not milliseconds — has never done across
  // eight shard jobs on both Node versions. So what the change buys is not a
  // safe channel but two independent ones and a reader that takes whichever
  // survived. That is why the stdout fallback in readRootTapSummary is
  // load-bearing rather than a courtesy to old callers.
  //
  // Hence the union. This fails only when both channels lose the tail at once,
  // which is the outcome actually worth guarding.
  //
  // The durable fix is not to wait for the tail. A child with a leaked handle
  // never emits one — the plan line and counters are not buffered somewhere
  // behind the leak, they are never produced at all — so there is nothing to
  // wait for. It is to stop forcing the exit, which is what the default now
  // does; this test keeps the old behaviour covered for `--force-exit`.
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
    args: buildRootTestArgs({ testFiles: [testFile], tapPath, forceExit: true }),
    env,
    quiet: true,
    projectRoot: root,
    onChild: () => {},
  });

  assert.equal(fs.existsSync(tapPath), true, result.stderr);
  const fileTap = fs.readFileSync(tapPath, 'utf8');
  assert.ok(
    nodeTapOutputIsComplete(fileTap) || nodeTapOutputIsComplete(result.stdout),
    `both channels lost the tail: file ${fileTap.length} bytes, stdout ${result.stdout.length} bytes`,
  );

  const summary = readRootTapSummary({ phase: 'root', tapPath }, result);
  assert.equal(summary.fail, 0);

  // Deliberately not `summary.tests === 60`. A forced exit can also end the run
  // before the last cases are recorded, and it does so quietly: the plan line,
  // the counters, and the `ok` lines all agree with each other at whatever
  // count the run reached. This test asserted the full 60 on its first CI run
  // and got 54 on both Node 20 and 22. That undercount is the second reason the
  // flag is no longer the default; the next test is the same fixture without it.
  assert.ok(summary.tests > 0 && summary.tests <= 60, `tests=${summary.tests}`);
  assert.equal(summary.plan, summary.tests);
});

test('natural teardown reports every case and names the files that ran', async (t) => {
  // Realpath, not the raw mkdtemp path: on macOS the temp directory is reached
  // through a symlink, the spawned child's cwd resolves through it, and the
  // reporter's file names would come back relative to the resolved form.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-natural-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = path.join(root, 'alpha.test.js');
  const second = path.join(root, 'beta.test.js');
  const tapPath = path.join(root, 'out.tap');
  const reportPath = path.join(root, 'timing.jsonl');
  fs.writeFileSync(
    first,
    ['import test from "node:test";', 'for (let i = 0; i < 40; i += 1) test(`alpha ${i}`, () => {});'].join('\n'),
  );
  fs.writeFileSync(
    second,
    ['import test from "node:test";', 'for (let i = 0; i < 20; i += 1) test(`beta ${i}`, () => {});'].join('\n'),
  );

  const { NODE_TEST_CONTEXT: _recursionMarker, ...env } = process.env;
  const result = await runPhase({
    phase: 'root',
    forceExit: false,
    args: buildRootTestArgs({ testFiles: [first, second], tapPath, timingPath: reportPath }),
    env,
    quiet: true,
    projectRoot: root,
    onChild: () => {},
  });

  assert.equal(result.stalled, false, result.stderr);
  const summary = readRootTapSummary({ phase: 'root', tapPath, reportPath }, result);
  // The exact count the forced-exit test above cannot assert.
  assert.equal(summary.tests, 60);
  assert.equal(summary.fail, 0);

  // TAP hoists every case to the top level and names a file only when it fails
  // to load, so this list cannot come from TAP. It comes from the per-file
  // `test:summary` events, and it is what lets the root phase enforce the same
  // exact-file check the Vitest phase has always had.
  assert.deepEqual(summary.files, ['alpha.test.js', 'beta.test.js']);
});

test('a stalled run is ended and names the file that never reported', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hermetic-stall-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const clean = path.join(root, 'clean.test.js');
  const leaky = path.join(root, 'leaky.test.js');
  const reportPath = path.join(root, 'timing.jsonl');
  fs.writeFileSync(clean, ['import test from "node:test";', 'test("clean case", () => {});'].join('\n'));
  fs.writeFileSync(
    leaky,
    [
      'import test from "node:test";',
      // Finishes its tests, then holds the runner open forever.
      'setInterval(() => {}, 100000);',
      'test("leaky case", () => {});',
    ].join('\n'),
  );

  const { NODE_TEST_CONTEXT: _recursionMarker, ...env } = process.env;
  const result = await runPhase({
    phase: 'root',
    forceExit: false,
    args: buildRootTestArgs({ testFiles: [clean, leaky], timingPath: reportPath }),
    env,
    quiet: true,
    projectRoot: root,
    stallTimeoutMs: 4_000,
    stallKillGraceMs: 500,
    onChild: () => {},
  });

  assert.equal(result.stalled, true, `stdout ${result.stdout.length}B stderr ${result.stderr}`);

  // Both files ran their tests; only the leaky one is still holding a handle.
  // On Node 22 the file-scoped summary arrives for the file that finished and
  // never for the one that did not, so the report separates them without extra
  // instrumentation and the diagnostic can name the culprit rather than the
  // run. Node 20 has no such event, and the reporter's end-of-stream flush is
  // no help here because a stalled run never reaches the end of its stream —
  // so there the account is empty. What holds on both is that the run is ended
  // and the file that did report is never the one blamed.
  const executed = readRootExecutedFiles({ reportPath });
  assert.deepEqual(executed, NODE_REPORTS_FILES_AS_THEY_FINISH ? ['clean.test.js'] : []);
  const diagnostic = formatStallDiagnostic(
    { phase: 'root', selectedFiles: ['clean.test.js', 'leaky.test.js'] },
    executed,
    4_000,
  );
  assert.doesNotMatch(diagnostic, /unreported: clean\.test\.js/u);
  assert.match(diagnostic, /--force-exit/u);
  if (NODE_REPORTS_FILES_AS_THEY_FINISH) assert.match(diagnostic, /unreported: leaky\.test\.js/u);
  else assert.match(diagnostic, /no file reported before the stall/u);
});

test('the executed-file account is absent, not empty, when no report was written', () => {
  assert.equal(readRootExecutedFiles({ reportPath: null }), null);
  assert.equal(readRootExecutedFiles({ reportPath: path.join(os.tmpdir(), 'hermetic-missing-report.jsonl') }), null);
});

test('the timing reporter emits a line per file as that file finishes', async () => {
  const cwd = process.cwd();
  const event = (type, file, extra = {}) => ({ type, data: { file: path.join(cwd, file), ...extra } });
  async function* events() {
    yield event('test:pass', 'alpha.test.js', { details: { duration_ms: 4 } });
    yield event('test:pass', 'alpha.test.js', { details: { duration_ms: 6 } });
    yield event('test:summary', 'alpha.test.js');
    yield event('test:fail', 'beta.test.js', { details: { duration_ms: 3 } });
    yield event('test:summary', 'beta.test.js');
    // The whole-run summary carries no file and must not add a line.
    yield { type: 'test:summary', data: { file: null } };
  }

  const lines = [];
  for await (const line of hermeticTimingReporter(events())) lines.push(JSON.parse(line));
  assert.deepEqual(lines, [
    { file: 'alpha.test.js', durationMs: 10, tests: 2, failures: 0 },
    { file: 'beta.test.js', durationMs: 3, tests: 1, failures: 1 },
  ]);
});

test('the timing reporter still accounts for every file where Node emits no per-file summary', async () => {
  // Node 20 has no `test:summary`, so nothing can be written until the stream
  // ends. CI caught this the hard way: gating the report on that event alone
  // made both Node 20 shards report no executed files at all, and the new
  // exact-file check then failed a run in which every test had passed.
  const cwd = process.cwd();
  const event = (type, file, extra = {}) => ({ type, data: { file: path.join(cwd, file), ...extra } });
  async function* node20Events() {
    yield event('test:pass', 'alpha.test.js', { details: { duration_ms: 4 } });
    yield event('test:fail', 'beta.test.js', { details: { duration_ms: 3 } });
    yield event('test:pass', 'alpha.test.js', { details: { duration_ms: 6 } });
  }

  const lines = [];
  for await (const line of hermeticTimingReporter(node20Events())) lines.push(JSON.parse(line));
  assert.deepEqual(lines, [
    { file: 'alpha.test.js', durationMs: 10, tests: 2, failures: 0 },
    { file: 'beta.test.js', durationMs: 3, tests: 1, failures: 1 },
  ]);
});

test('a stall with nothing reported says so instead of blaming every file', () => {
  const diagnostic = formatStallDiagnostic({ phase: 'root', selectedFiles: ['alpha.test.js', 'beta.test.js'] }, []);
  assert.match(diagnostic, /no file reported before the stall/u);
  assert.doesNotMatch(diagnostic, /unreported:/u);
  // On Node 20 the report cannot arrive before the end of the stream, so the
  // message says which version would narrow it rather than implying the
  // runner failed to look.
  assert.equal(/Node 22 narrows this/u.test(diagnostic), !NODE_REPORTS_FILES_AS_THEY_FINISH);
});
