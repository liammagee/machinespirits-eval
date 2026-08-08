import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeTestStoreOwnership,
  checkTestStorePaths,
  formatTestStorePathErrors,
} from '../scripts/check-test-store-paths.js';

test('store-path detector distinguishes owned paths from runner-only isolation', () => {
  const evaluationStoreModule = `../services/${'evaluation'}${'Store.js'}`;
  const unsafe = analyzeTestStoreOwnership(
    `
      // EVAL_DB_PATH and EVAL_LOGS_DIR in a comment do not count.
      import { createRun } from '${evaluationStoreModule}';
      createRun({ description: 'unsafe' });
    `,
    'tests/unsafe.test.js',
  );
  assert.equal(unsafe.opensStore, true);
  assert.equal(unsafe.isolated, false);
  assert.match(formatTestStorePathErrors({ offenders: [unsafe] })[0], /EVAL_DB_PATH and EVAL_LOGS_DIR/u);

  const safe = analyzeTestStoreOwnership(`
    process.env.EVAL_DB_PATH = databasePath;
    process.env.EVAL_LOGS_DIR = logsRoot;
    const { createRun } = await import('${evaluationStoreModule}');
    createRun({ description: 'safe' });
  `);
  assert.equal(safe.opensStore, true);
  assert.equal(safe.isolated, true);
});

test('every store-opening test owns its database and logs paths when run alone', () => {
  const result = checkTestStorePaths();
  assert.deepEqual(formatTestStorePathErrors(result), [], formatTestStorePathErrors(result).join('\n'));
});
