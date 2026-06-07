#!/usr/bin/env node
/**
 * Stage a read-only snapshot of the eval database to deploy/evaluations.db — the
 * file you upload to the website's fly volume (/data/poetics/evaluations.db) for
 * the in-process /poetics mount (machinespirits.org/poetics; see
 * ../machinespirits-website/services/poeticsMount.js, which copies it to an
 * ephemeral path at boot and opens that, leaving the volume snapshot frozen).
 *
 * Why this exists: data/evaluations.db is a symlink pointing outside the repo,
 * and Docker won't follow a link out of the build context. So we materialise a
 * real, self-contained copy inside the repo first. We use better-sqlite3's
 * online backup (not a plain file copy), which produces a consistent
 * single-file snapshot even if the source is in WAL mode and being written to,
 * and never modifies the source.
 *
 * Run with: npm run poetics:stage-deploy-db
 */
import { mkdirSync, existsSync, statSync, rmSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcArg = process.env.EVAL_DB_PATH || path.join(ROOT, 'data', 'evaluations.db');
const outDir = path.join(ROOT, 'deploy');
const outPath = path.join(outDir, 'evaluations.db');

if (!existsSync(srcArg)) {
  console.error(`[stage-db] source database not found: ${srcArg}`);
  process.exit(1);
}

// Resolve the symlink so we read (and report) the real file.
const realSrc = realpathSync(srcArg);
const srcMB = (statSync(realSrc).size / 1e6).toFixed(1);
console.log(`[stage-db] source: ${srcArg}`);
if (realSrc !== srcArg) console.log(`[stage-db]   (real path: ${realSrc})`);
console.log(`[stage-db] source size: ${srcMB} MB`);

mkdirSync(outDir, { recursive: true });
if (existsSync(outPath)) rmSync(outPath); // backup() won't overwrite

const db = new Database(realSrc, { readonly: true });
console.log('[stage-db] running online backup → deploy/evaluations.db ...');
await db.backup(outPath);
db.close();

const outMB = (statSync(outPath).size / 1e6).toFixed(1);
console.log(`[stage-db] wrote ${outPath} (${outMB} MB)`);
console.log(
  '[stage-db] done. Next: upload to the fly volume — fly ssh sftp put deploy/evaluations.db /data/poetics/evaluations.db -a my-website-dtq0ia',
);
