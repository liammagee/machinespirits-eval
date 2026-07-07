// services/githubInfo.js — tight GitHub integration for the board timeline.
//
// Resolves the origin repo, builds GitHub web links, and pulls live activity
// (commits, tags, releases, open PRs, GitHub milestones) via the `gh` CLI. Every
// network call fails SOFT: a missing/unauthed gh or an API error yields empty data
// plus an `errors` note — a request handler never throws because of it.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Parse an owner/repo slug from a git remote URL (ssh or https). Pure. */
export function parseRepoSlug(remoteUrl) {
  if (!remoteUrl) return null;
  const m = String(remoteUrl)
    .trim()
    .match(/github\.com[:/]([^/\s]+)\/(.+?)(?:\.git)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** Build a GitHub web URL for a branch/commit/tag/release/pr ref. Pure. */
export function githubUrl(slug, kind, ref) {
  if (!slug || ref == null || ref === '') return null;
  const base = `https://github.com/${slug.owner}/${slug.repo}`;
  const r = encodeURIComponent(String(ref));
  switch (kind) {
    case 'branch':
      return `${base}/tree/${r}`;
    case 'commit':
      return `${base}/commit/${r}`;
    case 'tag':
    case 'release':
      return `${base}/releases/tag/${r}`;
    case 'pr':
      return `${base}/pull/${r}`;
    default:
      return base;
  }
}

let _slug;
export async function repoSlug() {
  if (_slug !== undefined) return _slug;
  try {
    const { stdout } = await execFileP('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, timeout: 5000 });
    _slug = parseRepoSlug(stdout);
  } catch {
    _slug = null;
  }
  return _slug;
}

async function gh(endpoint) {
  const { stdout } = await execFileP('gh', ['api', endpoint, '-H', 'Accept: application/vnd.github+json'], {
    cwd: ROOT,
    maxBuffer: 8 * 1024 * 1024,
    timeout: 12000,
  });
  return JSON.parse(stdout);
}

let _cache = null;
let _cacheAt = 0;
/** Live GitHub activity for the origin repo, cached (default 60s) to spare the API. */
export async function githubActivity({ ttlMs = 60000 } = {}) {
  const now = Date.now();
  if (_cache && now - _cacheAt < ttlMs) return _cache;
  const slug = await repoSlug();
  const out = { slug, commits: [], tags: [], releases: [], prs: [], milestones: [], errors: [] };
  if (!slug) {
    out.errors.push('no GitHub origin remote');
    _cache = out;
    _cacheAt = now;
    return out;
  }
  const r = `repos/${slug.owner}/${slug.repo}`;
  const sources = [
    [
      'commits',
      `${r}/commits?per_page=15`,
      (d) =>
        d.map((c) => ({
          sha: c.sha,
          short: String(c.sha).slice(0, 7),
          message: (c.commit.message || '').split('\n')[0],
          date: c.commit.author && c.commit.author.date,
          url: c.html_url,
          author: c.author && c.author.login,
        })),
    ],
    [
      'releases',
      `${r}/releases?per_page=10`,
      (d) => d.map((x) => ({ tag: x.tag_name, name: x.name, date: x.published_at, url: x.html_url, draft: x.draft })),
    ],
    ['tags', `${r}/tags?per_page=25`, (d) => d.map((t) => ({ name: t.name, sha: t.commit && t.commit.sha }))],
    [
      'prs',
      `${r}/pulls?state=open&per_page=25`,
      (d) =>
        d.map((p) => ({
          number: p.number,
          title: p.title,
          url: p.html_url,
          branch: p.head && p.head.ref,
          date: p.updated_at,
          draft: p.draft,
        })),
    ],
    [
      'milestones',
      `${r}/milestones?state=all&per_page=30`,
      (d) =>
        d.map((m) => ({
          title: m.title,
          due: m.due_on,
          state: m.state,
          open: m.open_issues,
          closed: m.closed_issues,
          url: m.html_url,
        })),
    ],
  ];
  await Promise.all(
    sources.map(async ([key, ep, map]) => {
      try {
        out[key] = map(await gh(ep));
      } catch (e) {
        out.errors.push(`${key}: ${String((e && e.message) || e).split('\n')[0]}`);
      }
    }),
  );
  _cache = out;
  _cacheAt = now;
  return out;
}
