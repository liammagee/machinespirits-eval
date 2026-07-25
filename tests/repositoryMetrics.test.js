import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGE_SPECS,
  classifyLines,
  collectGitHubMetrics,
  detectLanguage,
  parseGitHubRemote,
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

test('parseGitHubRemote accepts common GitHub remote formats', () => {
  assert.deepEqual(parseGitHubRemote('git@github.com:example/project.git'), {
    owner: 'example',
    name: 'project',
    nameWithOwner: 'example/project',
  });
  assert.deepEqual(parseGitHubRemote('https://github.com/example/project'), {
    owner: 'example',
    name: 'project',
    nameWithOwner: 'example/project',
  });
  assert.equal(parseGitHubRemote('https://gitlab.com/example/project.git'), null);
});

test('collectGitHubMetrics maps standard repository counts from gh GraphQL output', () => {
  const execute = (command, args) => {
    if (command === 'git') return 'git@github.com:example/project.git\n';
    assert.equal(command, 'gh');
    assert.deepEqual(args.slice(0, 2), ['api', 'graphql']);
    return JSON.stringify({
      data: {
        repository: {
          nameWithOwner: 'example/project',
          url: 'https://github.com/example/project',
          stargazerCount: 12,
          forkCount: 3,
          watchers: { totalCount: 4 },
          pullRequests: { totalCount: 42 },
          openPullRequests: { totalCount: 2 },
          mergedPullRequests: { totalCount: 39 },
          closedPullRequests: { totalCount: 1 },
          issues: { totalCount: 15 },
          openIssues: { totalCount: 5 },
          closedIssues: { totalCount: 10 },
          releases: { totalCount: 6 },
          latestRelease: {
            tagName: 'release/v1.2.3',
            publishedAt: '2026-07-24T00:00:00Z',
            url: 'https://github.com/example/project/releases/tag/release%2Fv1.2.3',
          },
        },
      },
    });
  };

  const metrics = collectGitHubMetrics('/tmp/example-project', { execute });
  assert.equal(metrics.available, true);
  assert.deepEqual(metrics.pullRequests, { total: 42, open: 2, merged: 39, closed: 1 });
  assert.deepEqual(metrics.issues, { total: 15, open: 5, closed: 10 });
  assert.deepEqual(
    { stars: metrics.stars, forks: metrics.forks, watchers: metrics.watchers },
    { stars: 12, forks: 3, watchers: 4 },
  );
  assert.equal(metrics.releases.latest.tagName, 'release/v1.2.3');
});

test('collectGitHubMetrics degrades cleanly when gh is unavailable', () => {
  const execute = (command) => {
    if (command === 'git') return 'https://github.com/example/project.git\n';
    const error = new Error('spawn gh ENOENT');
    error.code = 'ENOENT';
    throw error;
  };

  assert.deepEqual(collectGitHubMetrics('/tmp/example-project', { execute }), {
    available: false,
    repository: 'example/project',
    reason: 'GitHub CLI (gh) is not installed',
  });
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
    github: {
      available: true,
      repository: 'example/example-repository',
      pullRequests: { total: 42, open: 2, merged: 39, closed: 1 },
      issues: { total: 15, open: 5, closed: 10 },
      stars: 12,
      forks: 3,
      watchers: 4,
      releases: { total: 0, latest: null },
    },
  });

  assert.match(report, /Repository files:\s+10/);
  assert.match(report, /Code:\s+12/);
  assert.match(report, /JavaScript\s+2\s+12\s+3\s+4\s+19/);
  assert.match(report, /Commits: 42/);
  assert.match(report, /abcdef1234/);
  assert.match(report, /GitHub activity/u);
  assert.match(report, /Pull requests: 42 total · 2 open · 39 merged · 1 closed/u);
  assert.match(report, /Community:\s+12 stars · 3 forks · 4 watchers/u);
});
