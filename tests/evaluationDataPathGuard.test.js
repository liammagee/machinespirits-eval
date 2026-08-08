import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkEvaluationDataPaths,
  findHardcodedEvaluationPaths,
  formatEvaluationDataPathErrors,
} from '../scripts/check-evaluation-data-paths.js';

test('hardcoded evaluation path detector sees constructive joins and ignores documentation', () => {
  const source = `
    import path, { join } from 'node:path';
    const harmless = "path.join(root, 'data', 'evaluations.db')";
    // path.join(root, 'logs', 'tutor-dialogues')
    const db = path.join(root, 'data', 'evaluations.db');
    const logs = join(root, 'logs', 'tutor-dialogues');
  `;

  const findings = findHardcodedEvaluationPaths(source, 'scripts/example.js');
  assert.deepEqual(
    findings.map(({ file, line, kind, replacement }) => ({
      file,
      line,
      kind,
      replacement,
    })),
    [
      {
        file: 'scripts/example.js',
        line: 5,
        kind: 'databasePaths',
        replacement: 'resolveEvaluationDbPath',
      },
      {
        file: 'scripts/example.js',
        line: 6,
        kind: 'dialogueLogPaths',
        replacement: 'resolveTutorDialoguesDir',
      },
    ],
  );
  assert.match(
    formatEvaluationDataPathErrors({ unexpected: findings, stale: [], duplicates: [] }).join('\n'),
    /call resolveEvaluationDbPath from services\/evaluationDataPaths\.js instead/,
  );
  assert.match(
    formatEvaluationDataPathErrors({ unexpected: findings, stale: [], duplicates: [] }).join('\n'),
    /call resolveTutorDialoguesDir from services\/evaluationDataPaths\.js instead/,
  );
});

test('repository scripts add no hardcoded evaluation paths beyond the shrinking allowlist', () => {
  const result = checkEvaluationDataPaths();
  assert.deepEqual(formatEvaluationDataPathErrors(result), [], formatEvaluationDataPathErrors(result).join('\n'));
  assert.equal(new Set(result.findings.map((finding) => finding.file)).size, 52);
});
