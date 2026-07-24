import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGE_SPECS,
  classifyLines,
  detectLanguage,
  renderReport,
  shouldCountSourceFile,
} from '../scripts/repository-metrics.js';

test('classifyLines separates JavaScript code, comments, and blanks', () => {
  const source = `const url = "https://example.com"; // trailing comment
// full-line comment
/* block comment
 * continued
 */

return url;
`;

  assert.deepEqual(classifyLines(source, LANGUAGE_SPECS.get('.js').comments), {
    code: 2,
    comments: 4,
    blank: 1,
    total: 7,
  });
});

test('classifyLines treats inline markup comments as code and comment-only markup as comments', () => {
  const source = `<main><!-- explanation --></main>
<!-- comment only -->

`;

  assert.deepEqual(classifyLines(source, LANGUAGE_SPECS.get('.html').comments), {
    code: 1,
    comments: 1,
    blank: 1,
    total: 3,
  });
});

test('source detection supports repository languages and excludes artifact directories', () => {
  assert.equal(detectLanguage('scripts/example.mjs').name, 'JavaScript');
  assert.equal(detectLanguage('config/example.yaml').name, 'YAML');
  assert.equal(detectLanguage('README.md'), null);
  assert.equal(shouldCountSourceFile('services/example.js'), true);
  assert.equal(shouldCountSourceFile('exports/report.js'), false);
  assert.equal(shouldCountSourceFile('public/vendor/library.js'), false);
});

test('renderReport includes line totals, language rows, and concise Git activity', () => {
  const report = renderReport({
    root: '/tmp/example-repository',
    source: {
      repositoryFiles: 10,
      sourceFiles: 2,
      skippedSourceFiles: 0,
      totals: { files: 2, code: 12, comments: 3, blank: 4, total: 19 },
      byLanguage: [{ language: 'JavaScript', files: 2, code: 12, comments: 3, blank: 4, total: 19 }],
    },
    gitActivity: {
      branch: 'main',
      commitCount: 42,
      latest: {
        sha: 'abcdef1234567890',
        date: '2026-07-25T12:00:00+10:00',
        author: 'Example Author',
        subject: 'Example change',
      },
    },
  });

  assert.match(report, /Repository files:\s+10/);
  assert.match(report, /Code:\s+12/);
  assert.match(report, /JavaScript\s+2\s+12\s+3\s+4\s+19/);
  assert.match(report, /Commits: 42/);
  assert.match(report, /abcdef1234/);
});
