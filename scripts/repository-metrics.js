#!/usr/bin/env node
/**
 * Report lightweight source and Git metrics without external dependencies.
 *
 * The source inventory includes tracked and untracked, non-ignored files so the
 * report reflects the current working tree. Generated artifacts, datasets,
 * dependency trees, and vendored code are excluded from source-line totals.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const GITHUB_METRICS_QUERY = `
query RepositoryMetrics($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    nameWithOwner
    url
    stargazerCount
    forkCount
    watchers { totalCount }
    pullRequests { totalCount }
    openPullRequests: pullRequests(states: OPEN) { totalCount }
    mergedPullRequests: pullRequests(states: MERGED) { totalCount }
    closedPullRequests: pullRequests(states: CLOSED) { totalCount }
    issues { totalCount }
    openIssues: issues(states: OPEN) { totalCount }
    closedIssues: issues(states: CLOSED) { totalCount }
    releases { totalCount }
    latestRelease { tagName publishedAt url }
  }
}`;

export const EXCLUDED_PATH_SEGMENTS = new Set([
  '.codex-tmp',
  '.git',
  'build',
  'coverage',
  'data',
  'dist',
  'exports',
  'node_modules',
  'outputs',
  'release',
  'tmp',
  'vendor',
]);

const C_STYLE = { line: ['//'], block: [['/*', '*/']], quotes: ['"', "'", '`'] };
const HASH_STYLE = { line: ['#'], block: [], quotes: ['"', "'"] };
const XML_STYLE = { line: [], block: [['<!--', '-->']], quotes: ['"', "'"] };

export const LANGUAGE_SPECS = new Map([
  ['.js', { name: 'JavaScript', comments: C_STYLE }],
  ['.mjs', { name: 'JavaScript', comments: C_STYLE }],
  ['.cjs', { name: 'JavaScript', comments: C_STYLE }],
  ['.jsx', { name: 'JavaScript', comments: C_STYLE }],
  ['.ts', { name: 'TypeScript', comments: C_STYLE }],
  ['.mts', { name: 'TypeScript', comments: C_STYLE }],
  ['.cts', { name: 'TypeScript', comments: C_STYLE }],
  ['.tsx', { name: 'TypeScript', comments: C_STYLE }],
  ['.py', { name: 'Python', comments: HASH_STYLE }],
  ['.sh', { name: 'Shell', comments: HASH_STYLE }],
  ['.bash', { name: 'Shell', comments: HASH_STYLE }],
  ['.zsh', { name: 'Shell', comments: HASH_STYLE }],
  ['.html', { name: 'HTML', comments: XML_STYLE }],
  ['.htm', { name: 'HTML', comments: XML_STYLE }],
  ['.css', { name: 'CSS', comments: { line: [], block: [['/*', '*/']], quotes: ['"', "'"] } }],
  ['.sql', { name: 'SQL', comments: { line: ['--'], block: [['/*', '*/']], quotes: ['"', "'"] } }],
  ['.json', { name: 'JSON', comments: { line: [], block: [], quotes: ['"'] } }],
  ['.yaml', { name: 'YAML', comments: HASH_STYLE }],
  ['.yml', { name: 'YAML', comments: HASH_STYLE }],
  ['.toml', { name: 'TOML', comments: HASH_STYLE }],
  ['.ttl', { name: 'Turtle', comments: HASH_STYLE }],
  ['.n3', { name: 'Notation3', comments: HASH_STYLE }],
  ['.mmd', { name: 'Mermaid', comments: { line: ['%%'], block: [], quotes: ['"', "'"] } }],
  ['.lean', { name: 'Lean', comments: { line: ['--'], block: [['/-', '-/']], quotes: ['"'] } }],
  ['.tex', { name: 'TeX', comments: { line: ['%'], block: [], quotes: [] } }],
  ['.svg', { name: 'SVG', comments: XML_STYLE }],
  ['.xml', { name: 'XML', comments: XML_STYLE }],
  ['.plist', { name: 'XML', comments: XML_STYLE }],
  ['.csl', { name: 'XML', comments: XML_STYLE }],
]);

export function detectLanguage(filePath) {
  return LANGUAGE_SPECS.get(path.extname(filePath).toLowerCase()) || null;
}

export function shouldCountSourceFile(filePath) {
  const segments = filePath.split(/[\\/]/);
  return !segments.some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment)) && Boolean(detectLanguage(filePath));
}

function linesIn(text) {
  if (!text) return [];
  const lines = text.split(/\r\n|\n|\r/);
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

/**
 * Count code, comment, and blank lines using the language's comment tokens.
 * A mixed code/comment line counts as code, matching common LOC tools.
 */
export function classifyLines(text, syntax) {
  const result = { code: 0, comments: 0, blank: 0, total: 0 };
  let blockEnd = null;

  for (const line of linesIn(text)) {
    result.total += 1;
    let hasCode = false;
    let hasComment = false;
    let quote = null;
    let escaped = false;

    for (let index = 0; index < line.length; ) {
      if (blockEnd) {
        hasComment = true;
        const endIndex = line.indexOf(blockEnd, index);
        if (endIndex === -1) {
          index = line.length;
          continue;
        }
        index = endIndex + blockEnd.length;
        blockEnd = null;
        continue;
      }

      const character = line[index];
      if (quote) {
        hasCode = true;
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = null;
        index += 1;
        continue;
      }

      if (syntax.quotes.includes(character)) {
        hasCode = true;
        quote = character;
        index += 1;
        continue;
      }

      const lineToken = syntax.line.find((token) => line.startsWith(token, index));
      if (lineToken) {
        hasComment = true;
        break;
      }

      const blockToken = syntax.block.find(([start]) => line.startsWith(start, index));
      if (blockToken) {
        hasComment = true;
        blockEnd = blockToken[1];
        index += blockToken[0].length;
        continue;
      }

      if (!/\s/.test(character)) hasCode = true;
      index += 1;
    }

    if (hasCode) result.code += 1;
    else if (hasComment || blockEnd) result.comments += 1;
    else result.blank += 1;
  }

  return result;
}

function git(root, args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.quietErrors ? 'ignore' : 'pipe'],
  }).trim();
}

function repositoryFiles(root) {
  return git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
}

function emptyLineTotals() {
  return { files: 0, code: 0, comments: 0, blank: 0, total: 0 };
}

export function collectSourceMetrics(root = ROOT) {
  const files = repositoryFiles(root);
  const byLanguage = new Map();
  const totals = emptyLineTotals();
  let skippedSourceFiles = 0;

  for (const relativePath of files) {
    if (!shouldCountSourceFile(relativePath)) continue;

    const spec = detectLanguage(relativePath);
    try {
      const contents = fs.readFileSync(path.join(root, relativePath));
      if (contents.includes(0)) {
        skippedSourceFiles += 1;
        continue;
      }

      const counts = classifyLines(contents.toString('utf8'), spec.comments);
      const language = byLanguage.get(spec.name) || emptyLineTotals();
      language.files += 1;
      totals.files += 1;
      for (const field of ['code', 'comments', 'blank', 'total']) {
        language[field] += counts[field];
        totals[field] += counts[field];
      }
      byLanguage.set(spec.name, language);
    } catch {
      skippedSourceFiles += 1;
    }
  }

  return {
    repositoryFiles: files.length,
    sourceFiles: totals.files,
    skippedSourceFiles,
    totals,
    byLanguage: [...byLanguage.entries()]
      .map(([language, counts]) => ({ language, ...counts }))
      .sort((a, b) => b.code - a.code || a.language.localeCompare(b.language)),
  };
}

export function collectGitActivity(root = ROOT) {
  const commitCount = Number(git(root, ['rev-list', '--count', 'HEAD']));
  const [sha, date, author, ...subject] = git(root, ['log', '-1', '--format=%H%x1f%aI%x1f%an%x1f%s']).split('\x1f');
  let branch = git(root, ['branch', '--show-current']);
  if (!branch) branch = `detached @ ${sha.slice(0, 10)}`;

  return {
    branch,
    commitCount,
    latest: { sha, date, author, subject: subject.join('\x1f') },
  };
}

export function parseGitHubRemote(remoteUrl) {
  const value = String(remoteUrl || '')
    .trim()
    .replace(/\/+$/u, '');
  let owner;
  let name;

  const scpMatch = value.match(/^git@github\.com:([^/]+)\/(.+)$/iu);
  if (scpMatch) {
    [, owner, name] = scpMatch;
  } else {
    try {
      const url = new URL(value);
      if (url.hostname.toLowerCase() !== 'github.com') return null;
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length !== 2) return null;
      [owner, name] = segments;
    } catch {
      return null;
    }
  }

  name = name.replace(/\.git$/iu, '');
  if (!owner || !name) return null;
  return { owner, name, nameWithOwner: `${owner}/${name}` };
}

/**
 * Collect GitHub-hosted repository metrics through the optional `gh` CLI.
 * Failures are data, not exceptions, so local repository metrics remain useful
 * offline and in environments without GitHub authentication.
 */
export function collectGitHubMetrics(root = ROOT, { execute = execFileSync, timeoutMs = 5000 } = {}) {
  const run = (command, args) =>
    String(
      execute(command, args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: timeoutMs,
      }),
    ).trim();

  let repository;
  try {
    repository = parseGitHubRemote(run('git', ['remote', 'get-url', 'origin']));
  } catch {
    return { available: false, reason: 'origin remote is unavailable' };
  }
  if (!repository) {
    return { available: false, reason: 'origin is not a GitHub repository' };
  }

  try {
    const payload = JSON.parse(
      run('gh', [
        'api',
        'graphql',
        '-f',
        `query=${GITHUB_METRICS_QUERY}`,
        '-F',
        `owner=${repository.owner}`,
        '-F',
        `name=${repository.name}`,
      ]),
    );
    const result = payload?.data?.repository;
    if (!result) throw new Error('GitHub repository response is missing');

    return {
      available: true,
      repository: result.nameWithOwner || repository.nameWithOwner,
      url: result.url || `https://github.com/${repository.nameWithOwner}`,
      pullRequests: {
        total: result.pullRequests.totalCount,
        open: result.openPullRequests.totalCount,
        merged: result.mergedPullRequests.totalCount,
        closed: result.closedPullRequests.totalCount,
      },
      issues: {
        total: result.issues.totalCount,
        open: result.openIssues.totalCount,
        closed: result.closedIssues.totalCount,
      },
      stars: result.stargazerCount,
      forks: result.forkCount,
      watchers: result.watchers.totalCount,
      releases: {
        total: result.releases.totalCount,
        latest: result.latestRelease || null,
      },
    };
  } catch (error) {
    let reason = 'GitHub API unavailable or gh is not authenticated';
    if (error?.code === 'ENOENT') reason = 'GitHub CLI (gh) is not installed';
    else if (error?.code === 'ETIMEDOUT' || error?.signal) reason = 'GitHub request timed out';
    return { available: false, repository: repository.nameWithOwner, reason };
  }
}

function number(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function renderTable(rows) {
  const headers = ['Language', 'Files', 'Code', 'Comments', 'Blank', 'Total'];
  const values = rows.map((row) => [
    row.language,
    number(row.files),
    number(row.code),
    number(row.comments),
    number(row.blank),
    number(row.total),
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...values.map((row) => String(row[index]).length)),
  );
  const formatRow = (row) =>
    row
      .map((value, index) =>
        index === 0 ? String(value).padEnd(widths[index]) : String(value).padStart(widths[index]),
      )
      .join('  ');

  return [formatRow(headers), formatRow(widths.map((width) => '-'.repeat(width))), ...values.map(formatRow)].join('\n');
}

function renderGitHubActivity(github) {
  if (!github) return '';
  if (!github.available) {
    const repository = github.repository ? `\n  Repository:  ${github.repository}` : '';
    return `\n\nGitHub activity${repository}\n  Unavailable: ${github.reason}`;
  }

  const latestRelease = github.releases.latest
    ? `${github.releases.latest.tagName} · ${github.releases.latest.publishedAt}`
    : 'none';
  return `\n\nGitHub activity
  Repository:    ${github.repository}
  Pull requests: ${number(github.pullRequests.total)} total · ${number(github.pullRequests.open)} open · ${number(github.pullRequests.merged)} merged · ${number(github.pullRequests.closed)} closed
  Issues:        ${number(github.issues.total)} total · ${number(github.issues.open)} open · ${number(github.issues.closed)} closed
  Community:     ${number(github.stars)} stars · ${number(github.forks)} forks · ${number(github.watchers)} watchers
  Releases:      ${number(github.releases.total)} · latest: ${latestRelease}`;
}

export function renderReport({ root = ROOT, source, gitActivity, github = null }) {
  const skipped = source.skippedSourceFiles
    ? `\n  Skipped source files: ${number(source.skippedSourceFiles)} (binary or unreadable)`
    : '';
  return `Repository metrics: ${path.basename(root)}
Scope: Git-known working-tree files; generated, data, dependency, and vendor directories excluded

Files
  Repository files: ${number(source.repositoryFiles)}
  Source files:     ${number(source.sourceFiles)}${skipped}

Lines
  Code:     ${number(source.totals.code)}
  Comments: ${number(source.totals.comments)}
  Blank:    ${number(source.totals.blank)}
  Total:    ${number(source.totals.total)}

Per language
${renderTable(source.byLanguage)}

Git activity
  Branch:  ${gitActivity.branch}
  Commits: ${number(gitActivity.commitCount)}
  Latest:  ${gitActivity.latest.sha.slice(0, 10)} · ${gitActivity.latest.date} · ${gitActivity.latest.author}
           ${gitActivity.latest.subject}${renderGitHubActivity(github)}`;
}

function usage() {
  return `Usage: npm run metrics [-- --no-github]
       node scripts/repository-metrics.js [--no-github]

Reports dependency-free source-line, file, language, local Git, and optional
GitHub-hosted metrics for the current repository. GitHub metrics use the gh CLI
when available. Comment counts use language-aware heuristics.`;
}

export function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }
  const unknown = args.filter((argument) => argument !== '--no-github');
  if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}\n\n${usage()}`);

  const source = collectSourceMetrics(ROOT);
  const gitActivity = collectGitActivity(ROOT);
  const githubDisabled = args.includes('--no-github') || process.env.REPOSITORY_METRICS_GITHUB === '0';
  const github = githubDisabled ? null : collectGitHubMetrics(ROOT);
  console.log(renderReport({ root: ROOT, source, gitActivity, github }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
