import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkEvaluationDataPaths,
  findHardcodedEvaluationPaths,
  formatEvaluationDataPathErrors,
} from '../scripts/check-evaluation-data-paths.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANALYSIS_DB_READERS = [
  'analyze-d1-structural-features.js',
  'analyze-d1-structural-features-v2.js',
  'analyze-d1-structural-features-v3.js',
  'analyze-d1-cross-judge-replication.js',
  'analyze-d1-ends-question-replication.js',
  'analyze-d1-multifeature-ols.js',
  'analyze-d1-orientation-lexicon.js',
  'analyze-recognition-lexicon.js',
  'analyze-text-behaviors.js',
];

test('hardcoded evaluation path detector sees joins, resolves, and home-specific literals while ignoring documentation', () => {
  const source = `
    import path, { join } from 'node:path';
    const harmless = "path.join(root, 'data', 'evaluations.db')";
    // path.join(root, 'logs', 'tutor-dialogues')
    const db = path.join(root, 'data', 'evaluations.db');
    const logs = join(root, 'logs', 'tutor-dialogues');
    const resolvedDb = path.resolve(root, 'data', 'evaluations.db');
    const machineSpecific = '/Users/alice/private/archive.json';
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
      {
        file: 'scripts/example.js',
        line: 7,
        kind: 'databasePaths',
        replacement: 'resolveEvaluationDbPath',
      },
      {
        file: 'scripts/example.js',
        line: 8,
        kind: 'absoluteHomePaths',
        replacement: 'a repository, environment, or shared artifact resolver',
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

test('repository scripts use shared resolvers instead of hardcoded evaluation paths', () => {
  const result = checkEvaluationDataPaths();
  assert.deepEqual(formatEvaluationDataPathErrors(result), [], formatEvaluationDataPathErrors(result).join('\n'));
  assert.deepEqual(
    [...new Set(result.findings.map((finding) => finding.file))].sort(),
    ['scripts/run-adaptive-warrant-steering-decomposition.js', 'services/tutorStubFirstDraftOuterLoop.js'],
    'only the explicitly preserved historical path records may remain',
  );
});

test('the nine analysis readers expose --db and use the canonical resolver', () => {
  for (const name of ANALYSIS_DB_READERS) {
    const source = fs.readFileSync(path.join(ROOT, 'scripts', name), 'utf8');
    assert.match(source, /--db/u, `${name} should advertise or parse --db`);
    assert.match(source, /resolveEvaluationDbPath/u, `${name} should resolve its DB canonically`);
  }
});
