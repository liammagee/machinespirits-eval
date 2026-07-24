#!/usr/bin/env node
/**
 * Render and validate the repository's managed Git refs.
 *
 * This inventory deliberately uses fetched local refs. Run
 * `git fetch --all --tags --prune` before render/check when remote state may
 * have changed.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT = path.join(ROOT, 'docs', 'ref-status.md');
const REF_FORMAT =
  '%(refname)%09%(objecttype)%09%(objectname)%09%(*objecttype)%09%(*objectname)%09%(creatordate:iso8601-strict)%09%(subject)';
const MANAGED_PREFIXES = [
  'refs/heads/archive/',
  'refs/remotes/origin/archive/',
  'refs/tags/archive/',
  'refs/tags/archive-snapshot/',
  'refs/tags/release/',
  'refs/tags/paper/',
  'refs/tags/experiment/',
  'refs/tags/v*',
];

function refTarget(ref) {
  return ref.peeledObjectName || ref.objectName;
}

function shortSha(value) {
  return value ? value.slice(0, 10) : '—';
}

function escapeTable(value) {
  return String(value ?? '—')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function conciseSubject(value, limit = 120) {
  const subject = escapeTable(value);
  return subject.length > limit ? `${subject.slice(0, limit - 1)}…` : subject;
}

export function parseRefLines(text) {
  return String(text || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [refname, objectType, objectName, peeledObjectType, peeledObjectName, creatorDate, ...subject] =
        line.split('\t');
      return {
        refname,
        objectType,
        objectName,
        peeledObjectType,
        peeledObjectName,
        creatorDate,
        subject: subject.join('\t'),
      };
    });
}

export function collectManagedRefs(root = ROOT) {
  const output = execFileSync('git', ['for-each-ref', `--format=${REF_FORMAT}`, ...MANAGED_PREFIXES], {
    cwd: root,
    encoding: 'utf8',
  });
  return parseRefLines(output);
}

function classifyArchiveRef(ref) {
  const mappings = [
    ['refs/remotes/origin/archive/', 'remoteBranch'],
    ['refs/heads/archive/', 'localBranch'],
    ['refs/tags/archive-snapshot/', 'canonicalTag'],
    ['refs/tags/archive/', 'legacyTag'],
  ];
  for (const [prefix, kind] of mappings) {
    if (ref.refname.startsWith(prefix)) return { id: ref.refname.slice(prefix.length), kind };
  }
  return null;
}

export function buildArchiveEntries(refs) {
  const grouped = new Map();
  for (const ref of refs) {
    const classified = classifyArchiveRef(ref);
    if (!classified) continue;
    const entry = grouped.get(classified.id) || { id: classified.id };
    entry[classified.kind] = ref;
    grouped.set(classified.id, entry);
  }

  return [...grouped.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => {
      const errors = [];
      const warnings = [];
      const branch = entry.remoteBranch || entry.localBranch;
      const tag = entry.canonicalTag || entry.legacyTag;
      const branchTarget = branch ? refTarget(branch) : null;
      const tagTarget = tag ? refTarget(tag) : null;

      if (entry.localBranch && !entry.remoteBranch) errors.push('archive branch exists only locally');
      if (entry.localBranch && entry.remoteBranch && refTarget(entry.localBranch) !== refTarget(entry.remoteBranch)) {
        errors.push('local and remote archive branches target different commits');
      }
      if (tag && tag.objectType !== 'tag') errors.push('archive tag is lightweight; annotated tag required');
      if (tag && tag.objectType === 'tag' && tag.peeledObjectType !== 'commit') {
        errors.push('archive tag must point to a commit');
      }
      if (branch && tag && branchTarget !== tagTarget) errors.push('archive branch and tag target different commits');

      if (entry.canonicalTag && !/^[a-z0-9][a-z0-9/-]*-\d{4}-\d{2}-\d{2}$/.test(entry.id)) {
        errors.push('canonical archive id must end in YYYY-MM-DD');
      }

      let state;
      if (branch && tag && branchTarget === tagTarget && !errors.length) {
        if (entry.canonicalTag) state = 'complete';
        else {
          state = 'complete (legacy collision)';
          warnings.push('branch and tag share an ambiguous short name');
        }
      } else if (!branch && entry.legacyTag && !errors.length) {
        state = 'legacy tag only';
        warnings.push('grandfathered archive has no browsable remote branch');
      } else if (!branch && entry.canonicalTag) {
        state = 'incomplete';
        errors.push('canonical archive tag has no archive branch');
      } else if (branch && !tag) {
        state = 'incomplete';
        errors.push('archive branch has no annotated tag');
      } else if (errors.length) state = 'invalid';
      else state = 'incomplete';

      return {
        ...entry,
        branch,
        tag,
        branchTarget,
        tagTarget,
        state,
        errors,
        warnings,
      };
    });
}

function latestByDate(refs) {
  return [...refs].sort((a, b) => String(b.creatorDate).localeCompare(String(a.creatorDate)))[0] || null;
}

export function buildVersionStatus(refs, { repositoryVersion, paperVersion }) {
  const releaseTags = refs.filter((ref) => ref.refname.startsWith('refs/tags/release/'));
  const paperTags = refs.filter((ref) => ref.refname.startsWith('refs/tags/paper/'));
  const legacyTags = refs.filter((ref) => /^refs\/tags\/v\d/.test(ref.refname));
  const latestRelease = latestByDate(releaseTags);
  const latestPaper = latestByDate(paperTags);
  const latestLegacy = latestByDate(legacyTags);
  const expectedRelease = `refs/tags/release/v${repositoryVersion}`;
  const expectedPaper = `refs/tags/paper/v${paperVersion}`;

  return {
    repositoryVersion,
    paperVersion,
    latestRelease,
    latestPaper,
    latestLegacy,
    repositoryState: refs.some((ref) => ref.refname === expectedRelease)
      ? 'aligned'
      : latestRelease
        ? 'declared version is not tagged'
        : 'canonical namespace not yet baselined',
    paperState: refs.some((ref) => ref.refname === expectedPaper)
      ? 'aligned'
      : latestPaper
        ? 'declared version is not tagged'
        : 'canonical namespace not yet baselined',
  };
}

export function validateManagedTags(refs) {
  const errors = [];
  const patterns = [
    ['refs/tags/release/', /^refs\/tags\/release\/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/],
    ['refs/tags/paper/', /^refs\/tags\/paper\/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/],
    [
      'refs/tags/experiment/',
      /^refs\/tags\/experiment\/[a-z0-9][a-z0-9/-]*\/(?:freeze|results|retired)-\d{4}-\d{2}-\d{2}(?:-r\d+)?$/,
    ],
    ['refs/tags/archive-snapshot/', /^refs\/tags\/archive-snapshot\/[a-z0-9][a-z0-9/-]*-\d{4}-\d{2}-\d{2}$/],
  ];

  for (const ref of refs) {
    const managed = patterns.find(([prefix]) => ref.refname.startsWith(prefix));
    if (!managed) continue;
    if (!managed[1].test(ref.refname)) errors.push(`${ref.refname}: invalid managed tag name`);
    if (ref.objectType !== 'tag') errors.push(`${ref.refname}: managed tags must be annotated`);
    if (ref.objectType === 'tag' && ref.peeledObjectType !== 'commit') {
      errors.push(`${ref.refname}: managed tags must point to commits`);
    }
  }
  return errors;
}

function readDeclaredVersions(root = ROOT) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const paper = fs.readFileSync(path.join(root, 'docs', 'research', 'paper-full-2.0.md'), 'utf8');
  const match = paper.match(/^version:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (!match) throw new Error('paper version not found in docs/research/paper-full-2.0.md');
  return { repositoryVersion: packageJson.version, paperVersion: match[1].trim() };
}

function refLabel(ref) {
  return ref ? `\`${ref.refname.replace(/^refs\/(?:remotes\/|tags\/|heads\/)/, '')}\`` : '—';
}

function targetLabel(entry) {
  if (entry.branchTarget && entry.tagTarget && entry.branchTarget !== entry.tagTarget) {
    return `branch ${shortSha(entry.branchTarget)}; tag ${shortSha(entry.tagTarget)}`;
  }
  return `\`${shortSha(entry.branchTarget || entry.tagTarget)}\``;
}

export function renderRefStatus({ archiveEntries, versionStatus, validationErrors = [] }) {
  const archiveErrors = archiveEntries.flatMap((entry) => entry.errors.map((error) => `${entry.id}: ${error}`));
  const errors = [...archiveErrors, ...validationErrors];
  const complete = archiveEntries.filter((entry) => entry.state.startsWith('complete')).length;
  const legacyTagOnly = archiveEntries.filter((entry) => entry.state === 'legacy tag only').length;

  const lines = [
    '<!-- Generated by scripts/ref-governance.js. Do not edit by hand. -->',
    '',
    '# Ref and Version Status',
    '',
    'Run `git fetch --all --tags --prune && npm run refs:render` before relying on this inventory.',
    'Archived refs are historical provenance, not live workplan items.',
    '',
    '## Version anchors',
    '',
    '| Surface | Declared version | Latest canonical tag | State |',
    '| --- | ---: | --- | --- |',
    `| Repository/package | \`${versionStatus.repositoryVersion}\` | ${refLabel(versionStatus.latestRelease)} | ${versionStatus.repositoryState} |`,
    `| Canonical paper | \`${versionStatus.paperVersion}\` | ${refLabel(versionStatus.latestPaper)} | ${versionStatus.paperState} |`,
    `| Legacy mixed \`v*\` namespace | — | ${refLabel(versionStatus.latestLegacy)} | frozen; do not add new tags here |`,
    '',
    'The repository and paper versions are intentionally independent. See [Tagging and Version Protocol](tagging-and-version-protocol.md).',
    '',
    '## Archive refs',
    '',
    `Inventory: ${archiveEntries.length} archives; ${complete} paired; ${legacyTagOnly} grandfathered tag-only; ${errors.length} validation errors.`,
    '',
    '| Archive ID | Browsable branch | Immutable tag | Target | State | Note |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const entry of archiveEntries) {
    const note = entry.tag?.subject || entry.branch?.subject || '—';
    lines.push(
      `| \`${escapeTable(entry.id)}\` | ${refLabel(entry.remoteBranch || entry.localBranch)} | ${refLabel(entry.tag)} | ${targetLabel(entry)} | ${escapeTable(entry.state)} | ${conciseSubject(note)} |`,
    );
  }

  lines.push('', 'Inspect a full archive annotation with `git show refs/tags/<tag-name>`.');

  lines.push('', '## Validation', '');
  if (errors.length) {
    lines.push('The registry has blocking errors:', '');
    for (const error of errors) lines.push(`- ${error}`);
  } else {
    lines.push(
      'No blocking ref-integrity errors were found. Legacy tag-only archives remain explicitly grandfathered.',
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function buildStatus(root = ROOT) {
  const refs = collectManagedRefs(root);
  const archiveEntries = buildArchiveEntries(refs);
  const versionStatus = buildVersionStatus(refs, readDeclaredVersions(root));
  const validationErrors = validateManagedTags(refs);
  return {
    refs,
    archiveEntries,
    versionStatus,
    validationErrors,
    content: renderRefStatus({ archiveEntries, versionStatus, validationErrors }),
  };
}

function usage() {
  return (
    `Usage: node scripts/ref-governance.js <status|render|check|validate>\n\n` +
    `  status    Print the generated ref/version inventory\n` +
    `  render    Write docs/ref-status.md\n` +
    `  check     Verify docs/ref-status.md is current and refs are valid\n` +
    `  validate  Validate managed refs without checking the generated file\n`
  );
}

function printErrors(status) {
  const errors = [
    ...status.archiveEntries.flatMap((entry) => entry.errors.map((error) => `${entry.id}: ${error}`)),
    ...status.validationErrors,
  ];
  for (const error of errors) console.error(`ref-governance: ${error}`);
  return errors;
}

function main(argv) {
  const command = argv[0];
  if (!command || command === '--help' || command === '-h') {
    console.log(usage());
    return 0;
  }
  const status = buildStatus();
  if (command === 'status') {
    console.log(status.content);
    return printErrors(status).length ? 1 : 0;
  }
  if (command === 'render') {
    fs.writeFileSync(DEFAULT_OUTPUT, status.content);
    console.log(`ref-governance: wrote ${path.relative(ROOT, DEFAULT_OUTPUT)}`);
    return printErrors(status).length ? 1 : 0;
  }
  if (command === 'validate') {
    const errors = printErrors(status);
    if (!errors.length) console.log('ref-governance: managed refs are valid');
    return errors.length ? 1 : 0;
  }
  if (command === 'check') {
    const errors = printErrors(status);
    const actual = fs.existsSync(DEFAULT_OUTPUT) ? fs.readFileSync(DEFAULT_OUTPUT, 'utf8') : '';
    if (actual !== status.content) {
      console.error('ref-governance: docs/ref-status.md is stale; run npm run refs:render');
      return 1;
    }
    if (!errors.length) console.log('ref-governance: refs are valid and docs/ref-status.md is current');
    return errors.length ? 1 : 0;
  }
  console.error(`ref-governance: unknown command: ${command}\n\n${usage()}`);
  return 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = main(process.argv.slice(2));
