/**
 * prune-research-pdfs.js — apply the keep rule for versioned paper PDFs.
 *   npm run docs:prune-pdfs            # dry run: list what would go
 *   npm run docs:prune-pdfs -- --apply # delete
 *
 * build.sh writes every PDF as <family>-v<version>.pdf next to the sources,
 * so docs/research/ accumulates one file per built version. The PDFs are
 * untracked local artifacts (gitignored), rebuildable from the committed
 * markdown, and the published copies live in the content-philosophy repo.
 *
 * Keep rule (also stated in DOCS.md):
 *   - the newest version of each family (semver-ish compare on the -vX.Y.Z tail)
 *   - any filename that also exists in the published site repo
 *     (../machinespirits-content-philosophy), when that checkout is present
 * Everything else is pruned.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESEARCH = path.join(ROOT, 'docs/research');
const apply = process.argv.includes('--apply');

const versioned = /^(?<family>.+)-v(?<version>\d+(?:\.\d+)*)\.pdf$/u;

function listPublished() {
  // Resolve the content repo as a sibling of the PRIMARY checkout (same
  // convention as the publish scripts): the git common dir points at the main
  // repo's .git even from a linked worktree.
  const common = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd: ROOT, encoding: 'utf8' });
  const primaryRoot = common.status === 0 ? path.dirname(path.resolve(ROOT, common.stdout.trim())) : ROOT;
  let dir = path.resolve(primaryRoot, '..', 'machinespirits-content-philosophy');
  if (!fs.existsSync(dir)) dir = null;
  if (!dir) return { names: new Set(), note: 'content repo not found — keeping only newest per family' };
  const names = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith('.pdf')) names.add(e.name);
    }
  };
  walk(dir);
  return { names, note: `published set from ${dir} (${names.size} PDFs)` };
}

const cmpVersions = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
};

const pdfs = fs.existsSync(RESEARCH) ? fs.readdirSync(RESEARCH).filter((f) => f.endsWith('.pdf')) : [];
const families = new Map();
const unversioned = [];
for (const f of pdfs) {
  const m = versioned.exec(f);
  if (!m) {
    unversioned.push(f);
    continue;
  }
  const list = families.get(m.groups.family) || [];
  list.push({ file: f, version: m.groups.version });
  families.set(m.groups.family, list);
}

const { names: published, note } = listPublished();
const keep = new Set(unversioned);
const drop = [];
for (const [, list] of families) {
  list.sort((a, b) => cmpVersions(a.version, b.version));
  keep.add(list[list.length - 1].file);
  for (const { file } of list.slice(0, -1)) {
    if (published.has(file)) keep.add(file);
    else drop.push(file);
  }
}

console.log(
  `docs/research PDFs: ${pdfs.length} (${families.size} families, ${unversioned.length} unversioned — always kept)`,
);
console.log(note);
if (!drop.length) {
  console.log('Nothing to prune.');
  process.exit(0);
}
console.log(`${apply ? 'Pruning' : 'Would prune (dry run — pass --apply to delete)'} ${drop.length}:`);
for (const f of drop.sort()) {
  console.log(`  ${f}`);
  if (apply) fs.unlinkSync(path.join(RESEARCH, f));
}
if (apply) console.log('Done. Rebuild any version from the committed markdown via docs/research/build.sh.');
