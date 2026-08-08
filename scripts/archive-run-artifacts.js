#!/usr/bin/env node
/**
 * Copy a run's artifacts out of `exports/` and into the private archive repo.
 *
 * `exports/` is in .gitignore, so nothing in it is tracked and nothing in it
 * survives a checkout being cleaned. That is not a worry, it is a loss already
 * taken: the first Phase-B run's transcripts are gone from this machine, and
 * the last time anyone copied tutor-stub runs into the archive was July 2026.
 * This script exists so copying is one command rather than a thing to
 * remember.
 *
 * Two layers per run, treated differently because they differ by a factor of a
 * thousand in size:
 *
 *   light   everything except `traces/` — `results.jsonl` where a runner
 *           writes one (transcripts, closure records, per-dialogue counts),
 *           `report.json`, `report.md`, run manifests, driver logs. Tens of
 *           kilobytes per block, copied as-is so they stay greppable without
 *           unpacking.
 *   traces  the per-call debug record: drafts, guard audits, prompts. Tens to
 *           hundreds of megabytes per block, so each `traces/` directory is
 *           written as one `traces.tgz` beside where it sat, about 13% of the
 *           raw size. The template-rate census cannot run without it, and for
 *           the many runs that write no results.jsonl it holds the only copy
 *           of what was said.
 *
 * Idempotent: an artifact already in the archive is left alone, so re-running
 * after a resumed run copies only what is new. Nothing is deleted from either
 * side and nothing is written outside the destination root.
 *
 * Usage:
 *   node scripts/archive-run-artifacts.js exports/tutor-stub-outcome/<run>
 *   node scripts/archive-run-artifacts.js --all exports/tutor-stub-outcome
 *   node scripts/archive-run-artifacts.js --check --all exports/tutor-stub-outcome
 *   node scripts/archive-run-artifacts.js --all exports/tutor-stub-outcome --light-only
 *
 * `--check` lists what is missing and writes nothing; it exits 1 when anything
 * is missing, so it can gate a shell loop.
 *
 * Destination: $EVAL_ARCHIVE_DIR, else ../machinespirits-eval-private. The
 * script writes files there; committing and pushing is left to the caller,
 * because the archive is a separate repository with its own history.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_ARCHIVE = path.resolve('..', 'machinespirits-eval-private');

/** The archive directory, or null when there is none to write to. */
export function resolveArchiveDir(explicit) {
  const dir = path.resolve(explicit || process.env.EVAL_ARCHIVE_DIR || DEFAULT_ARCHIVE);
  return fs.existsSync(dir) ? dir : null;
}

/** A run directory holds results.jsonl, a report, a manifest, or a traces dir. */
function looksLikeRun(dir) {
  return fs
    .readdirSync(dir)
    .some((n) => n === 'results.jsonl' || n === 'traces' || n === 'run-manifest.json' || n.startsWith('report.'));
}

/** Run directories under a parent, including parents whose runs sit one level down. */
export function runDirs(root, all) {
  if (!all) return [root];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(root, e.name))
    .filter((d) => {
      if (looksLikeRun(d)) return true;
      return fs
        .readdirSync(d, { withFileTypes: true })
        .some((e) => e.isDirectory() && looksLikeRun(path.join(d, e.name)));
    })
    .sort();
}

/** Every file to copy as-is, and every traces dir to pack, under one run. */
function planRun(runDir, { lightOnly }) {
  const light = [];
  const traces = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'traces') {
          if (!lightOnly) traces.push(p);
        } else walk(p);
      } else light.push(p);
    }
  };
  walk(runDir);
  return { light, traces };
}

export function bytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)}G`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)}M`;
  if (n >= 1024) return `${Math.round(n / 1024)}K`;
  return `${n}B`;
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return total;
}

/**
 * Copy one run's artifacts into `dest`. With `check`, reports without writing.
 * Paths inside the archive mirror their path under the current directory.
 */
export function archiveRun(runDir, { dest, lightOnly = false, check = false, onEvent } = {}) {
  const summary = { copied: 0, packed: 0, skipped: 0, missing: 0, written: 0, missingPaths: [] };
  const { light, traces } = planRun(runDir, { lightOnly });
  const relTo = (file) => path.join(dest, path.relative(path.resolve('.'), file));

  for (const file of light) {
    const out = relTo(file);
    if (!out.startsWith(`${dest}${path.sep}`)) throw new Error(`refusing to write outside the archive: ${out}`);
    if (fs.existsSync(out) && fs.statSync(out).size === fs.statSync(file).size) {
      summary.skipped += 1;
      continue;
    }
    summary.missing += 1;
    summary.missingPaths.push(path.relative(dest, out));
    if (check) continue;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(file, out);
    summary.written += fs.statSync(out).size;
    summary.copied += 1;
  }

  for (const dir of traces) {
    const out = `${relTo(dir)}.tgz`;
    if (!out.startsWith(`${dest}${path.sep}`)) throw new Error(`refusing to write outside the archive: ${out}`);
    if (fs.existsSync(out)) {
      summary.skipped += 1;
      continue;
    }
    summary.missing += 1;
    summary.missingPaths.push(path.relative(dest, out));
    if (check) {
      onEvent?.(`  missing  ${path.relative(dest, out)}  (${bytes(dirSize(dir))} raw)`);
      continue;
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    execFileSync('tar', ['-C', path.dirname(dir), '-czf', out, path.basename(dir)]);
    summary.written += fs.statSync(out).size;
    summary.packed += 1;
    onEvent?.(`  packed   ${path.relative(dest, out)}  ${bytes(dirSize(dir))} -> ${bytes(fs.statSync(out).size)}`);
  }

  return summary;
}

function parseArgs(argv) {
  const opts = { paths: [], all: false, check: false, lightOnly: false, dest: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--all') opts.all = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--light-only') opts.lightOnly = true;
    else if (a === '--dest') {
      opts.dest = argv[i + 1];
      i += 1;
    } else if (a.startsWith('--')) throw new Error(`unknown flag ${a}`);
    else opts.paths.push(a);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.paths.length) {
    console.error('usage: node scripts/archive-run-artifacts.js [--all] [--check] [--light-only] <dir>');
    process.exit(2);
  }
  const dest = resolveArchiveDir(opts.dest);
  if (!dest) {
    console.error(`archive not found: ${path.resolve(opts.dest || process.env.EVAL_ARCHIVE_DIR || DEFAULT_ARCHIVE)}`);
    console.error('set EVAL_ARCHIVE_DIR or pass --dest');
    process.exit(2);
  }

  const runs = opts.paths.flatMap((p) => runDirs(path.resolve(p), opts.all));
  const total = { copied: 0, packed: 0, skipped: 0, missing: 0, written: 0 };
  for (const runDir of runs) {
    const s = archiveRun(runDir, { ...opts, dest, onEvent: (line) => console.log(line) });
    for (const k of Object.keys(total)) total[k] += s[k];
  }

  console.log(
    opts.check
      ? `\n${runs.length} run(s): ${total.missing} artifact(s) missing from ${dest}, ${total.skipped} already there`
      : `\n${runs.length} run(s): ${total.copied} file(s) copied, ${total.packed} traces archive(s) written, ${total.skipped} already there, ${bytes(total.written)} added`,
  );
  if (!opts.check && (total.copied || total.packed)) {
    console.log(`commit them in ${dest} — this script does not touch its history`);
  }
  if (opts.check && total.missing) process.exit(1);
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) main();
