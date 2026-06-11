#!/usr/bin/env node
/**
 * Backfill the critic's notice onto finished derivation runs ("to each
 * transcript add a critic's commentary", operator decision 2026-06-10).
 * Reads result.json + diagnosis.json from a run directory, asks the pinned
 * critic (claude/claude-fable-5 — llmClient.PINNED_ROLE_TARGETS) for a
 * notice, and writes commentary.md beside them. Historical transcript.md
 * files are never rewritten — the standalone commentary.md is what the
 * scriptorium reads, for old and new runs alike; only runs the loop itself
 * stages going forward get the notice embedded in transcript.md too.
 *
 * Usage:
 *   node scripts/derivation-critic.js --label <run-label>     one run
 *   node scripts/derivation-critic.js --all                   every run under --dir
 *     [--dir exports/dramatic-derivation/loop]
 *     [--force]   rewrite commentary.md where it already exists
 *     [--mock]    deterministic template instead of the Fable call
 *                 (plumbing checks; the file says what it is)
 *
 * Worlds are loaded best-effort from diagnosis.worldPath: a run whose world
 * file has moved still gets a notice — the critic then meets the secret only
 * through the events and the proof.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld, runCritic, commentaryFileMd } from '../services/dramaticDerivation/index.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function noticeForRun(runDir, { mode, force }) {
  const label = path.basename(runDir);
  const commentaryPath = path.join(runDir, 'commentary.md');
  if (fs.existsSync(commentaryPath) && !force) return { label, status: 'skipped (commentary.md exists)' };
  const resultPath = path.join(runDir, 'result.json');
  const diagnosisPath = path.join(runDir, 'diagnosis.json');
  if (!fs.existsSync(resultPath) || !fs.existsSync(diagnosisPath)) {
    return { label, status: 'skipped (not a run dir — no result.json/diagnosis.json)' };
  }
  const result = readJson(resultPath);
  const diagnosis = readJson(diagnosisPath);
  let world = null;
  if (diagnosis.worldPath) {
    try {
      world = loadWorld(path.resolve(ROOT, diagnosis.worldPath));
    } catch {
      /* world moved or changed shape — the notice still stands on the artifacts */
    }
  }
  const started = Date.now();
  const notice = await runCritic({ result, diagnosis, world, label, mode });
  fs.writeFileSync(commentaryPath, commentaryFileMd({ label, commentary: notice.commentary, target: notice.target }));
  const by = `${notice.target.provider}/${notice.target.model || '(cli default)'}`;
  return { label, status: `written by ${by} in ${((Date.now() - started) / 1000).toFixed(1)}s` };
}

async function main() {
  const dir = path.resolve(ROOT, arg('dir', 'exports/dramatic-derivation/loop'));
  const label = arg('label', null);
  const all = flag('all');
  const force = flag('force');
  const mode = flag('mock') ? 'mock' : 'real';
  if (!label && !all) {
    console.error('usage: derivation-critic --label <run-label> | --all   [--dir <runs-dir>] [--force] [--mock]');
    process.exit(1);
  }

  const runDirs = label
    ? [path.join(dir, label)]
    : fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(dir, entry.name))
        .sort();
  if (label && !fs.existsSync(runDirs[0])) {
    console.error(`no such run: ${path.relative(ROOT, runDirs[0])}`);
    process.exit(1);
  }

  console.log(`critic backfill — ${runDirs.length} run(s) under ${path.relative(ROOT, dir)}, mode ${mode}`);
  const summary = { written: 0, skipped: 0, failed: 0 };
  // Sequential on purpose: each real notice is one claude CLI call against the
  // plan quota window — fan-out would drain it for no wall-clock win at n≈23.
  for (const runDir of runDirs) {
    const name = path.basename(runDir);
    try {
      const { status } = await noticeForRun(runDir, { mode, force });
      if (status.startsWith('written')) summary.written += 1;
      else summary.skipped += 1;
      console.log(`  ${name}: ${status}`);
    } catch (err) {
      summary.failed += 1;
      console.error(`  ${name}: FAILED — ${err.message}`);
    }
  }
  console.log(`\ndone — ${summary.written} written, ${summary.skipped} skipped, ${summary.failed} failed`);
  if (summary.failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
