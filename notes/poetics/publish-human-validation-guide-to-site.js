#!/usr/bin/env node
/*
 * Package and stage the human-validation field guide for machinespirits.org.
 *
 * The source stays in machinespirits-eval. This script bundles the shared
 * Techne CSS and JavaScript, writes the standalone page plus an index-metadata
 * stub into the sibling machinespirits-content-philosophy repository, and
 * leaves live deployment human-gated unless --publish is explicitly supplied.
 *
 * Usage:
 *   node notes/poetics/publish-human-validation-guide-to-site.js --dry-run
 *   node notes/poetics/publish-human-validation-guide-to-site.js
 *   node notes/poetics/publish-human-validation-guide-to-site.js --publish
 *   node notes/poetics/publish-human-validation-guide-to-site.js --slug NAME
 *   node notes/poetics/publish-human-validation-guide-to-site.js --dest-repo DIR
 */
import { existsSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleStandalone } from './package-standalone.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const SOURCE = join(HERE, '2026-09-01-human-validation-field-guide.html');
const DATE = '2026-09-01';

const args = process.argv.slice(2);
const flags = new Set(['--dry-run', '--publish']);
const valued = new Set(['--slug', '--dest-repo']);
const values = new Map();

for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (flags.has(argument)) continue;
  if (valued.has(argument)) {
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      console.error(`✗ ${argument} requires a value`);
      process.exit(2);
    }
    values.set(argument, value);
    index += 1;
    continue;
  }
  console.error(`✗ unknown argument: ${argument}`);
  process.exit(2);
}

const dryRun = flags.has('--dry-run') && args.includes('--dry-run');
const publish = flags.has('--publish') && args.includes('--publish');
if (dryRun && publish) {
  console.error('✗ choose --dry-run or --publish, not both');
  process.exit(2);
}

const slug = values.get('--slug') || 'human-validation-field-guide';
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('✗ --slug must contain lowercase letters, numbers, and single hyphens only');
  process.exit(2);
}

function defaultDestinationRepo() {
  try {
    const commonGitDir = execFileSync('git', ['-C', REPO, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8',
    }).trim();
    return resolve(dirname(commonGitDir), '../machinespirits-content-philosophy');
  } catch {
    return resolve(REPO, '../machinespirits-content-philosophy');
  }
}

const destinationRepo = resolve(
  values.get('--dest-repo') || process.env.MACHINESPIRITS_CONTENT_REPO || defaultDestinationRepo(),
);
const destinationDir = join(destinationRepo, 'articles', 'ai-tutor');
const destinationHtml = join(destinationDir, `${slug}.html`);
const destinationMarkdown = join(destinationDir, `${slug}.md`);
const publicUrl = `https://machinespirits.org/content/articles/ai-tutor/${slug}.html`;

if (!existsSync(SOURCE)) {
  console.error(`✗ source page not found: ${SOURCE}`);
  process.exit(1);
}

const standalone = bundleStandalone(SOURCE);
if (
  standalone.includes('<link rel="stylesheet" href="assets/techne.css" />') ||
  standalone.includes('<script src="assets/techne.js"></script>')
) {
  console.error('✗ standalone bundle still contains local Techne asset references');
  process.exit(1);
}

const frontmatter = `---
title: "Human validation tasks — purpose and procedures"
date: ${DATE}
theme: ai-tutor
dek: "A plain-English explanation of the adaptive-tutor project, what each human task contributes, and exactly how to complete it."
---

<!-- The public page is the sibling ${slug}.html, bundled from
     notes/poetics/2026-09-01-human-validation-field-guide.html in the
     machinespirits-eval repository. This Markdown file supplies index metadata
     only. Edit the source HTML and re-run its publisher; do not hand-edit the
     staged HTML. Its mtime is deliberately older so the content build leaves
     the hand-authored page intact. -->
`;

const mode = dryRun ? 'DRY RUN' : publish ? 'STAGE + PUBLISH' : 'STAGE ONLY';
console.log(`human validation guide → machinespirits.org   [${mode}]`);
console.log(`  source    ${SOURCE}`);
console.log(`  html   →  ${destinationHtml}`);
console.log(`            ${(standalone.length / 1024).toFixed(0)} KB · Techne CSS and JS inlined`);
console.log(`  md     →  ${destinationMarkdown}  (index metadata, backdated)`);
console.log(`  public URL after deploy:  ${publicUrl}`);

if (dryRun) {
  console.log('\n(dry run — nothing written)');
  process.exit(0);
}

if (!existsSync(destinationRepo)) {
  console.error(`\n✗ content repository not found at ${destinationRepo}`);
  console.error('  supply --dest-repo, set MACHINESPIRITS_CONTENT_REPO, or clone it beside the primary checkout');
  process.exit(1);
}

mkdirSync(destinationDir, { recursive: true });
writeFileSync(destinationMarkdown, frontmatter);
writeFileSync(destinationHtml, standalone);

// The content build skips Markdown conversion only when the hand-authored HTML
// is newer. Filesystems compare this at one-second granularity, so create an
// unambiguous gap rather than depending on write order.
const oneMinuteAgo = new Date(Date.now() - 60_000);
utimesSync(destinationMarkdown, oneMinuteAgo, oneMinuteAgo);

console.log(`\n✓ staged into ${destinationRepo}`);
console.log('  inspect the content-repository diff before publishing');

if (publish) {
  console.log('\n→ running the content repository’s human-gated publish command…\n');
  execFileSync('./publish', [`Add human validation field guide (${slug})`], {
    cwd: destinationRepo,
    stdio: 'inherit',
  });
} else {
  console.log('\nNo live deployment was started. To publish after review:');
  console.log(`  cd ${destinationRepo}`);
  console.log('  ./publish "Add human validation field guide"');
  console.log('  …or re-run this script with --publish');
}
