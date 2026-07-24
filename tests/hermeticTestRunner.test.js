import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  buildCoreTestArgs,
  buildRootTestArgs,
  buildTestPhases,
  createIsolatedPaths,
  discoverRootTestFiles,
  parseRunnerArgs,
} from '../scripts/run-hermetic-tests.js';

test('default hermetic run selects root and in-housed core suites', () => {
  const options = parseRunnerArgs([]);
  assert.deepEqual(options, {
    suite: 'all',
    forceExit: true,
    printEnv: false,
    forwarded: [],
  });
  const phases = buildTestPhases({ ...options, forwarded: ['tests/hermeticTestRunner.test.js'] }, '/repo');
  assert.deepEqual(
    phases.map(({ phase, forceExit }) => ({ phase, forceExit })),
    [
      { phase: 'root', forceExit: true },
      { phase: 'core', forceExit: false },
    ],
  );
  assert.equal(phases[1].args[0], '/repo/node_modules/vitest/vitest.mjs');
});

test('explicit historical test paths remain scoped to the root suite', () => {
  assert.deepEqual(parseRunnerArgs(['tests/workplan.test.js']), {
    suite: 'root',
    forceExit: true,
    printEnv: false,
    forwarded: ['tests/workplan.test.js'],
  });
});

test('suite and no-force-exit controls are parsed without leaking into child args', () => {
  assert.deepEqual(parseRunnerArgs(['--suite', 'root', '--no-force-exit']), {
    suite: 'root',
    forceExit: false,
    printEnv: false,
    forwarded: [],
  });
  assert.throws(() => parseRunnerArgs(['--suite', 'unknown']), /Invalid test suite/);
});

test('root discovery stays explicit while the core phase targets all in-housed Vitest files', () => {
  const rootFiles = discoverRootTestFiles();
  assert.ok(rootFiles.includes(path.join('tests', 'hermeticTestRunner.test.js')));
  assert.equal(
    rootFiles.some((file) => file.startsWith('tutor-core/')),
    false,
  );

  const rootArgs = buildRootTestArgs({ forwarded: ['tests/hermeticTestRunner.test.js'] });
  assert.deepEqual(rootArgs, ['--test', '--test-force-exit', 'tests/hermeticTestRunner.test.js']);
  assert.equal(buildRootTestArgs({ forceExit: false }).includes('--test-force-exit'), false);

  const coreArgs = buildCoreTestArgs({ projectRoot: '/repo' });
  assert.deepEqual(coreArgs, ['/repo/node_modules/vitest/vitest.mjs', 'run', 'tutor-core/services/__tests__']);
  assert.equal(coreArgs.includes('--test-force-exit'), false);
});

test('isolated environment covers root and tutor-core writable stores', () => {
  const paths = createIsolatedPaths('/tmp/hermetic');
  assert.equal(paths.EVAL_DB_PATH, '/tmp/hermetic/evaluations.db');
  assert.equal(paths.TUTOR_CORE_LOG_DIR, '/tmp/hermetic/tutor-core-logs');
  assert.equal(paths.TUTOR_STUB_TRACE_DIR, '/tmp/hermetic/tutor-stub-traces');
});
