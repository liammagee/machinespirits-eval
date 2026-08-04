#!/usr/bin/env node
/* publish-blueprint-to-site.js — stage the ideal-tutor blueprint for machinespirits.org.

   Same path as the dramatic-recognition arc (see publish-arc-to-site.js and
   DEPLOYMENT.md, Path A): bundle the techne page into a self-contained standalone,
   stage it into the content-philosophy repo, and leave the outward deploy to that
   repo's human-gated ./publish (which fires the website's Fly redeploy). Once
   staged, every subsequent redeploy carries the page; to publish an update to
   the blueprint, re-run this script and re-run ./publish.

   Differences from the arc stager, on purpose:
     - no image copying (the blueprint references none)
     - no localhost live-data layer to neutralise (the page is fully static)
     - refuses to stage a stale page: `refresh-blueprint.js --check` must pass
       (provenance band current against the paper, every data-ref resolving)

   Usage:
     node notes/poetics/publish-blueprint-to-site.js             # stage (no deploy)
     node notes/poetics/publish-blueprint-to-site.js --dry-run   # print plan, write nothing
     node notes/poetics/publish-blueprint-to-site.js --publish   # stage + ./publish (DEPLOYS LIVE)
     node notes/poetics/publish-blueprint-to-site.js --slug NAME # output basename (default tutor-blueprint)
     MS_CONTENT_REPO=/path/to/machinespirits-content-philosophy  # override the sibling-repo default
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync, utimesSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { bundleStandalone } from './package-standalone.js';

const HERE = dirname(fileURLToPath(import.meta.url)); // notes/poetics
const REPO = resolve(HERE, '../..');
const SRC = join(HERE, 'ideal-tutor-blueprint.html');
const DEST_REPO = process.env.MS_CONTENT_REPO
  ? resolve(process.env.MS_CONTENT_REPO)
  : resolve(REPO, '../machinespirits-content-philosophy');
const DEST_DIR = join(DEST_REPO, 'articles', 'ai-tutor');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const DRY = has('--dry-run');
const DO_PUBLISH = has('--publish');
const SLUG = val('--slug', 'tutor-blueprint');

const DEST_HTML = join(DEST_DIR, `${SLUG}.html`);
const DEST_MD = join(DEST_DIR, `${SLUG}.md`);

// Staleness gate: never stage a page whose provenance band lags the paper or
// whose file references have rotted. refresh-blueprint.js --check exits 1 then.
try {
  execFileSync('node', [join(REPO, 'scripts/refresh-blueprint.js'), '--check'], { stdio: 'pipe' });
} catch {
  console.error('✗ blueprint is stale: `node scripts/refresh-blueprint.js --check` fails.');
  console.error('  Re-synthesise / re-stamp first (npm run blueprint:refresh), then re-run this.');
  process.exit(1);
}

// Read the inherited paper version off the provenance band for the stub's dek.
const bandMatch = readFileSync(SRC, 'utf8').match(/v(\d+\.\d+\.\d+) \(([^)]+)\)/);
const paperVersion = bandMatch ? `v${bandMatch[1]}` : 'the current paper version';
const DATE = new Date().toISOString().slice(0, 10);

// /essays index metadata only — NOT the page body. Backdated below (mtime set older
// than the .html) so content-philosophy's ./build leaves the hand-authored .html alone.
const frontmatterStub = `---
title: "How to build the ideal AI tutor — the blueprint"
date: ${DATE}
theme: ai-tutor
dek: "A step-by-step recipe from first principles to a working adaptive tutor — the stance prompt, the small kernel, worlds and casting, criterial adaptation, and judge-free measurement — every step cited to the research paper (${paperVersion}) rather than restated."
---

<!-- The page itself is the sibling ${SLUG}.html — a self-contained, hand-authored
     techne document staged by notes/poetics/publish-blueprint-to-site.js in the
     machinespirits-eval repo. This .md exists ONLY to give /essays its
     title/date/theme/dek and is intentionally kept older than the .html so
     ./build never Pandoc-renders over the hand-authored page. Do not edit the
     .html here — edit notes/poetics/ideal-tutor-blueprint.html and re-stage. -->
`;

const bundled = bundleStandalone(SRC);

console.log(`blueprint → machinespirits.org   [${DRY ? 'DRY RUN' : DO_PUBLISH ? 'STAGE + PUBLISH' : 'STAGE ONLY'}]`);
console.log(`  source    ${SRC}`);
console.log(`  html   →  ${DEST_HTML}`);
console.log(
  `            ${(bundled.length / 1024).toFixed(0)} KB · self-contained (techne.css+js inlined, fonts via CDN)`,
);
console.log(`  md     →  ${DEST_MD}  (frontmatter stub, backdated)`);
console.log(`  public URL after deploy:  https://machinespirits.org/content/articles/ai-tutor/${SLUG}.html`);

if (DRY) {
  console.log('\n(dry run — nothing written)');
  process.exit(0);
}

if (!existsSync(DEST_REPO)) {
  console.error(`\n✗ content-philosophy repo not found at ${DEST_REPO}`);
  console.error('  set MS_CONTENT_REPO, or clone it as a sibling of the eval repo');
  process.exit(1);
}

mkdirSync(DEST_DIR, { recursive: true });
writeFileSync(DEST_MD, frontmatterStub);
writeFileSync(DEST_HTML, bundled);
// content-philosophy's ./build skips a .md only when `.html -nt .md`, compared at
// 1-second granularity — backdate the .md a minute so the .html is unambiguously newer.
const mdOld = new Date(Date.now() - 60_000);
utimesSync(DEST_MD, mdOld, mdOld);

console.log('\nstaged. The outward deploy is human-gated:');
console.log(`  cd ${DEST_REPO} && ./publish`);

if (DO_PUBLISH) {
  console.log('\n--publish given — running ./publish …');
  execFileSync('./publish', [], { cwd: DEST_REPO, stdio: 'inherit' });
}
