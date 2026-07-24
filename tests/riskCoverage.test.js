import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNodeCoverageArgs,
  buildVitestCoverageArgs,
  parseCoverageArgs,
  parseLcov,
  renderCoverageMarkdown,
  summarizeGroupCoverage,
} from '../scripts/run-risk-coverage.js';

const GROUP = {
  id: 'example',
  label: 'Example risk',
  runner: 'node',
  sources: ['services/a.js', 'services/b.js'],
  tests: ['tests/example.test.js'],
  floors: { lines: 80, branches: 70, functions: 75 },
};

test('LCOV parsing normalizes paths and aggregates counts before applying floors', () => {
  const records = parseLcov(
    [
      'SF:/repo/services/a.js',
      'FNF:2',
      'FNH:2',
      'BRF:4',
      'BRH:3',
      'LF:10',
      'LH:9',
      'end_of_record',
      'SF:services/b.js',
      'FNF:2',
      'FNH:1',
      'BRF:4',
      'BRH:3',
      'LF:10',
      'LH:7',
      'end_of_record',
    ].join('\n'),
    '/repo',
  );
  const summary = summarizeGroupCoverage(GROUP, records);
  assert.equal(summary.coverage.lines.pct, 80);
  assert.equal(summary.coverage.branches.pct, 75);
  assert.equal(summary.coverage.functions.pct, 75);
  assert.equal(summary.passed, true);
});

test('a missing configured source and a regressed floor fail the group', () => {
  const records = parseLcov(
    'SF:/repo/services/a.js\nFNF:2\nFNH:1\nBRF:4\nBRH:2\nLF:10\nLH:7\nend_of_record\n',
    '/repo',
  );
  const summary = summarizeGroupCoverage(GROUP, records);
  assert.equal(summary.passed, false);
  assert.deepEqual(summary.missingSources, ['services/b.js']);
  assert.ok(summary.failures.some((failure) => failure.includes('lines 70%')));
});

test('Node coverage uses sequential natural teardown and dual reporters', () => {
  const args = buildNodeCoverageArgs(GROUP, '/tmp/lcov.info');
  assert.ok(args.includes('--test-concurrency=1'));
  assert.equal(args.includes('--test-force-exit'), false);
  assert.deepEqual(
    args.filter((arg) => arg.startsWith('--test-reporter=')),
    ['--test-reporter=spec', '--test-reporter=lcov'],
  );
  assert.ok(args.includes('--test-coverage-include=services/a.js'));
});

test('Vitest coverage uses v8, LCOV, and exact configured sources', () => {
  const args = buildVitestCoverageArgs({ ...GROUP, runner: 'vitest' }, '/tmp/report', '/repo');
  assert.equal(args[0], '/repo/node_modules/vitest/vitest.mjs');
  assert.ok(args.includes('--coverage.provider=v8'));
  assert.ok(args.includes('--coverage.reporter=lcov'));
  assert.ok(args.includes('--coverage.include=services/b.js'));
});

test('CLI group selection and report rendering remain machine-testable', () => {
  const parsed = parseCoverageArgs(['--group', 'example', '--out=/tmp/report', '--config', '/tmp/floors.json']);
  assert.deepEqual(parsed.selectedGroups, ['example']);
  assert.equal(parsed.outputDir, '/tmp/report');
  assert.equal(parsed.configPath, '/tmp/floors.json');
  assert.throws(() => parseCoverageArgs(['--group']), /--group requires a value/u);
  assert.throws(() => parseCoverageArgs(['--out', '--group', 'example']), /--out requires a value/u);

  const group = {
    ...GROUP,
    coverage: {
      lines: { pct: 80 },
      branches: { pct: 75 },
      functions: { pct: 75 },
    },
    passed: true,
    failures: [],
  };
  const markdown = renderCoverageMarkdown({
    generated_at: '2026-07-24T00:00:00.000Z',
    config_sha256: 'abc',
    passed: true,
    groups: [group],
  });
  assert.match(markdown, /Example risk \| 80% \/ 80%/u);
  assert.match(markdown, /Result: \*\*PASS\*\*/u);
});
