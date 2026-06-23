// tests/githubInfo.test.js — pure helpers, runs under plain `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepoSlug, githubUrl } from '../services/githubInfo.js';

test('parseRepoSlug handles ssh + https remotes', () => {
  assert.deepEqual(parseRepoSlug('git@github.com:liammagee/machinespirits-eval.git'), {
    owner: 'liammagee',
    repo: 'machinespirits-eval',
  });
  assert.deepEqual(parseRepoSlug('https://github.com/owner/repo.git'), { owner: 'owner', repo: 'repo' });
  assert.deepEqual(parseRepoSlug('https://github.com/owner/repo'), { owner: 'owner', repo: 'repo' });
  assert.equal(parseRepoSlug(''), null);
  assert.equal(parseRepoSlug('git@gitlab.com:o/r.git'), null);
});

test('githubUrl builds branch/commit/tag/pr links and guards empties', () => {
  const slug = { owner: 'o', repo: 'r' };
  assert.equal(githubUrl(slug, 'branch', 'feat/x'), 'https://github.com/o/r/tree/feat%2Fx');
  assert.equal(githubUrl(slug, 'commit', 'abc123'), 'https://github.com/o/r/commit/abc123');
  assert.equal(githubUrl(slug, 'tag', 'v1.0'), 'https://github.com/o/r/releases/tag/v1.0');
  assert.equal(githubUrl(slug, 'pr', '42'), 'https://github.com/o/r/pull/42');
  assert.equal(githubUrl(null, 'branch', 'x'), null);
  assert.equal(githubUrl(slug, 'branch', ''), null);
});
