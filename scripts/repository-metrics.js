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

export function renderReport({ root = ROOT, source, gitActivity }) {
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
           ${gitActivity.latest.subject}`;
}

function usage() {
  return `Usage: npm run metrics
       node scripts/repository-metrics.js

Reports dependency-free source-line, file, language, and local Git metrics for
the current repository working tree. Comment counts use language-aware heuristics.`;
}

export function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }
  if (args.length) throw new Error(`Unknown argument: ${args[0]}\n\n${usage()}`);

  const source = collectSourceMetrics(ROOT);
  const gitActivity = collectGitActivity(ROOT);
  console.log(renderReport({ root: ROOT, source, gitActivity }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
