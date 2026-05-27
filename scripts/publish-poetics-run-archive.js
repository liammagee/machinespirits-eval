#!/usr/bin/env node
/**
 * Publish ignored poetics run archives as GitHub Release assets.
 *
 * This wraps package-poetics-run.js:
 *   1. materialize/refresh the local ignored archive bundle;
 *   2. create a tar.gz payload for GitHub;
 *   3. create or update one release per run;
 *   4. upload the tarball plus the small manifest.
 *
 * Public repos require --allow-public because full transcripts and deliberation
 * traces may become public release assets.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packagePoeticsRun } from './package-poetics-run.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    runIds: [],
    dbPath: null,
    archiveDir: path.join(ROOT, 'artifacts/poetics-runs'),
    manifestDir: path.join(ROOT, 'config/poetics-calibration/runs'),
    dryRun: false,
    noPackage: false,
    clobber: true,
    allowPublic: false,
    tagPrefix: 'poetics-',
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--run-id') {
      args.runIds.push(
        ...String(argv[++i] || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      );
    } else if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--archive-dir') args.archiveDir = path.resolve(argv[++i]);
    else if (token === '--manifest-dir') args.manifestDir = path.resolve(argv[++i]);
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--no-package') args.noPackage = true;
    else if (token === '--no-clobber') args.clobber = false;
    else if (token === '--allow-public') args.allowPublic = true;
    else if (token === '--tag-prefix') args.tagPrefix = argv[++i];
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/publish-poetics-run-archive.js --run-id RUN_ID[,RUN_ID...]
      [--db FILE] [--archive-dir artifacts/poetics-runs]
      [--manifest-dir config/poetics-calibration/runs]
      [--dry-run] [--no-package] [--allow-public]

Creates or updates GitHub releases named poetics-RUN_ID, uploading:
  - RUN_ID.tar.gz          ignored archive payload
  - RUN_ID.manifest.json   tracked manifest

Public repositories require --allow-public for non-dry runs.`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  args.runIds = [...new Set(args.runIds)];
  if (!args.runIds.length) throw new Error('--run-id is required');
  return args;
}

function repoPath(value) {
  const resolved = path.resolve(value);
  const rel = path.relative(ROOT, resolved);
  return rel.startsWith('..') || path.isAbsolute(rel) ? resolved : rel;
}

function encodePathSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function run(cmd, argv, options = {}) {
  if (options.dryRun) {
    console.log(`$ ${[cmd, ...argv].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(' ')}`);
    return '';
  }
  return execFileSync(cmd, argv, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function requireCommand(cmd) {
  const result = spawnSync('command', ['-v', cmd], { shell: true, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`required command not found: ${cmd}`);
}

function ghRepoInfo() {
  const raw = run('gh', ['repo', 'view', '--json', 'nameWithOwner,visibility']);
  return JSON.parse(raw);
}

function ghReleaseExists(tag) {
  const result = spawnSync('gh', ['release', 'view', tag, '--json', 'tagName'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return result.status === 0;
}

function makeTarball(runId, archiveDir, outDir, options = {}) {
  const runSegment = encodePathSegment(runId);
  const runArchiveDir = path.join(archiveDir, runSegment);
  if (!fs.existsSync(runArchiveDir)) {
    if (!options.dryRun) throw new Error(`archive directory not found: ${runArchiveDir}`);
    console.log(`would create archive directory via package step: ${repoPath(runArchiveDir)}`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const tarball = path.join(outDir, `${runSegment}.tar.gz`);
  run('tar', ['-czf', tarball, '-C', archiveDir, runSegment], options);
  return tarball;
}

function releaseNotes({ runId, manifestPath, tarball, tarballSha, repo }) {
  return [
    `# Poetics run archive: ${runId}`,
    '',
    'Compressed raw poetics evidence plus tracked manifest.',
    '',
    `- Repository: ${repo.nameWithOwner}`,
    `- Visibility at upload: ${repo.visibility}`,
    `- Manifest: ${repoPath(manifestPath)}`,
    `- Archive tarball: ${path.basename(tarball)}`,
    `- Archive SHA-256: ${tarballSha}`,
    '',
    'The manifest records the internal gzip member hashes and source artifact counts.',
  ].join('\n');
}

async function prepareRun(runId, args) {
  const runSegment = encodePathSegment(runId);
  let manifestPath = path.join(args.manifestDir, `${runSegment}.manifest.json`);
  let archiveDir = path.join(args.archiveDir, runSegment);
  if (args.noPackage) {
    if (!fs.existsSync(manifestPath)) throw new Error(`manifest not found: ${manifestPath}`);
    if (!fs.existsSync(archiveDir)) throw new Error(`archive not found: ${archiveDir}`);
    return { manifestPath, archiveDir };
  }
  const packaged = await packagePoeticsRun({
    runId,
    dbPath: args.dbPath,
    archiveDir: args.archiveDir,
    manifestDir: args.manifestDir,
    dryRun: args.dryRun,
  });
  manifestPath = packaged.manifestPath;
  archiveDir = packaged.archiveDir;
  const counts = packaged.manifest.counts;
  console.log(
    `${args.dryRun ? 'would package' : 'packaged'} ${runId}: ${counts.items} items, ` +
      `${counts.scores} scores, ${counts.archivedArtifacts}/${counts.artifactRefs} artifacts`,
  );
  return { manifestPath, archiveDir };
}

async function publishRun(runId, args, repo) {
  const { manifestPath } = await prepareRun(runId, args);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-release-'));
  const tarball = makeTarball(runId, args.archiveDir, tmpDir, { dryRun: args.dryRun });
  const tarballSha = args.dryRun ? '<computed after tarball creation>' : sha256File(tarball);
  const notesPath = path.join(tmpDir, `${encodePathSegment(runId)}-release-notes.md`);
  fs.writeFileSync(notesPath, releaseNotes({ runId, manifestPath, tarball, tarballSha, repo }));

  const tag = `${args.tagPrefix}${runId}`;
  const title = `Poetics run ${runId}`;
  const assets = [tarball, manifestPath];
  if (args.dryRun) {
    console.log(`would publish ${runId} as release ${tag}`);
    run('gh', ['release', 'view', tag, '--json', 'tagName'], { dryRun: true });
    run('gh', ['release', 'create', tag, ...assets, '--title', title, '--notes-file', notesPath], { dryRun: true });
    return;
  }

  if (ghReleaseExists(tag)) {
    const uploadArgs = ['release', 'upload', tag, ...assets];
    if (args.clobber) uploadArgs.push('--clobber');
    run('gh', uploadArgs, { stdio: 'inherit' });
    console.log(`updated release ${tag}`);
  } else {
    run('gh', ['release', 'create', tag, ...assets, '--title', title, '--notes-file', notesPath], {
      stdio: 'inherit',
    });
    console.log(`created release ${tag}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  requireCommand('gh');
  requireCommand('tar');
  const repo = ghRepoInfo();
  console.log(`GitHub repo: ${repo.nameWithOwner} (${repo.visibility})`);
  if (repo.visibility === 'PUBLIC' && !args.dryRun && !args.allowPublic) {
    throw new Error(
      'refusing to upload raw poetics artifacts to a PUBLIC repository without --allow-public. ' +
        'Use --dry-run first, or use a private repository/storage target.',
    );
  }
  for (const runId of args.runIds) await publishRun(runId, args, repo);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}
