#!/usr/bin/env node
/**
 * Seed ledger — what run seeds are taken, and which block is free next.
 *
 * Relay 117 first named seeds 530-541 for the guarded-learner main block. Six
 * of them belonged to the passive main block already. The claim was prose and
 * the check was a search written fresh each time, so nothing caught it.
 *
 * This reads two sources and takes the union:
 *
 *   1. config/seed-ledger.yaml — ranges written down when a run registers.
 *      Needed because a search under-counts: the passive main block ran on
 *      524-535, but only three of those numbers appear literally on disk.
 *   2. A search of the working tree for anything that looks like a seed.
 *      Needed because the ledger can go stale.
 *
 * A seed is free only when both sources agree it is free.
 *
 *   node scripts/seed-ledger.js list
 *   node scripts/seed-ledger.js next --count 12
 *   node scripts/seed-ledger.js check 654-665
 *
 * `check` exits 1 when any seed in the range is taken, so a registration can
 * prove its range instead of asserting it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SEED_LEDGER_PATH = 'config/seed-ledger.yaml';
export const SEED_FLOOR = 500;
export const SEED_CEILING = 999;

/** Where a seed could be hiding in this repo. */
export const SCAN_DIRS = ['docs', 'config', 'scripts', 'services', 'tests', '.tutor-stub-auto-eval'];

/**
 * Report 098's run-seed metadata patterns, plus the `"seed":123` form the
 * drama-derivation specs use and the `s123` form in dialogue ids.
 */
export const SEED_SCAN_PATTERN = 'seed[^0-9]{0,12}[0-9]{3}|--run-seed[^0-9]{0,4}[0-9]{3}|\\bs[0-9]{3}\\b';

/**
 * What the scan must not read. A ledger seed is one a study was allocated, and
 * a study records those in its plan. A per-call trace records a different kind
 * of seed: the number a single model call sampled on, derived per call and
 * three digits wide, which looks exactly like an allocation to a search.
 *
 * The v7 boredom run made the difference plain. Its 84 dialogue seeds are ten
 * digits and sit in the batch plans. Its traces carry thousands of three-digit
 * per-call seeds, and 170 of them landed above the floor, so the check read a
 * clean run as 170 undeclared allocations. Claiming those would have been worse
 * than the false alarm: every one would have blocked a number no run had taken.
 *
 * The boredom sizing scripts are the same kind of false alarm from the other
 * end. They allocate nothing; they start a random number generator for power
 * draws, from a base plus a loop counter. A base of eight thousand reads to
 * the scan as an allocation of eight hundred. Worse, a base of five thousand
 * reads as five hundred, which a real run already claims, so those lines pass
 * the check by collision rather than by right.
 *
 * Keep this comment free of a three-digit number written next to the word the
 * scan looks for, or the file reports itself.
 */
export const SCAN_EXCLUDED_DIRS = ['node_modules', '.git', 'traces'];
export const SCAN_EXCLUDED_FILES = ['transcript.json', 'size-boredom-*.js'];

/** Read the written-down claims. Each entry carries a range, a seed list, or both. */
export function readLedger(root = ROOT, ledgerPath = SEED_LEDGER_PATH) {
  const file = path.resolve(root, ledgerPath);
  const doc = YAML.parse(fs.readFileSync(file, 'utf8'));
  const claims = [];
  for (const entry of doc.claims ?? []) {
    const seeds = new Set();
    if (Array.isArray(entry.range)) {
      const [from, to] = entry.range;
      if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) {
        throw new Error(`ledger range is not a pair of rising integers: ${JSON.stringify(entry.range)}`);
      }
      for (let n = from; n <= to; n += 1) seeds.add(n);
    }
    for (const n of entry.seeds ?? []) seeds.add(n);
    if (!seeds.size) {
      throw new Error(`ledger entry claims nothing: ${JSON.stringify(entry)}`);
    }
    if (!entry.claimed_by || !entry.source) {
      throw new Error(`ledger entry needs claimed_by and source: ${JSON.stringify(entry)}`);
    }
    claims.push({ ...entry, seeds: [...seeds].sort((a, b) => a - b) });
  }
  return { version: doc.version, claims };
}

/** seed -> the first claim that took it. */
export function claimedSeeds(ledger) {
  const taken = new Map();
  for (const claim of ledger.claims) {
    for (const seed of claim.seeds) {
      if (!taken.has(seed)) taken.set(seed, claim.claimed_by);
    }
  }
  return taken;
}

/** seed -> how many times it turned up in the files. */
export function scanSeeds(root = ROOT, { dirs = SCAN_DIRS, extraRoots = [] } = {}) {
  const targets = [...dirs.map((dir) => path.resolve(root, dir)), ...extraRoots].filter((dir) => fs.existsSync(dir));
  const found = new Map();
  if (!targets.length) return found;
  let out = '';
  try {
    out = execFileSync(
      'grep',
      [
        '-rhoIE',
        ...SCAN_EXCLUDED_DIRS.map((dir) => `--exclude-dir=${dir}`),
        ...SCAN_EXCLUDED_FILES.map((file) => `--exclude=${file}`),
        SEED_SCAN_PATTERN,
        ...targets,
      ],
      { encoding: 'utf8', maxBuffer: 1 << 28 },
    );
  } catch (error) {
    // grep exits 1 when it matches nothing. Anything else is a real failure.
    if (error.status === 1) return found;
    throw error;
  }
  for (const hit of out.split('\n')) {
    const match = /([0-9]{3})$/.exec(hit.trim());
    if (!match) continue;
    const seed = Number(match[1]);
    if (seed < SEED_FLOOR || seed > SEED_CEILING) continue;
    found.set(seed, (found.get(seed) ?? 0) + 1);
  }
  return found;
}

/** Both sources, merged. A seed is taken when either one says so. */
export function takenSeeds(ledger, scanned) {
  const taken = new Map();
  for (const [seed, by] of claimedSeeds(ledger)) taken.set(seed, { source: 'ledger', by });
  for (const seed of scanned.keys()) {
    if (!taken.has(seed)) taken.set(seed, { source: 'found in files', by: 'not in the ledger' });
  }
  return taken;
}

/** Seeds the files know about and the ledger does not. Ledger drift. */
export function undeclaredSeeds(ledger, scanned) {
  const claimed = claimedSeeds(ledger);
  return [...scanned.keys()].filter((seed) => !claimed.has(seed)).sort((a, b) => a - b);
}

export function nextFreeBlock(taken, count, { from = SEED_FLOOR, to = SEED_CEILING } = {}) {
  let run = [];
  for (let seed = from; seed <= to; seed += 1) {
    if (taken.has(seed)) {
      run = [];
      continue;
    }
    run.push(seed);
    if (run.length === count) return { from: run[0], to: run[run.length - 1], seeds: [...run] };
  }
  return null;
}

export function freeBlocks(taken, { from = SEED_FLOOR, to = SEED_CEILING, minimum = 2 } = {}) {
  const blocks = [];
  let run = [];
  for (let seed = from; seed <= to + 1; seed += 1) {
    if (seed <= to && !taken.has(seed)) {
      run.push(seed);
      continue;
    }
    if (run.length >= minimum) blocks.push({ from: run[0], to: run[run.length - 1], width: run.length });
    run = [];
  }
  return blocks;
}

/**
 * `owner` lets a registration prove its own range: a seed already claimed by
 * that owner is its own, not a clash. Without it, writing the claim down would
 * make the range fail its own check.
 */
export function checkRange(taken, from, to, { owner = null } = {}) {
  const conflicts = [];
  const own = [];
  for (let seed = from; seed <= to; seed += 1) {
    const hit = taken.get(seed);
    if (!hit) continue;
    if (owner && hit.source === 'ledger' && String(hit.by).toLowerCase().includes(owner.toLowerCase())) {
      own.push({ seed, ...hit });
      continue;
    }
    conflicts.push({ seed, ...hit });
  }
  return { conflicts, own };
}

function archiveRoot() {
  return path.resolve(ROOT, process.env.EVAL_ARCHIVE_DIR || '../machinespirits-eval-private');
}

const USAGE = `usage:
  seed-ledger.js list [--archive]
  seed-ledger.js next --count N [--from N] [--archive]
  seed-ledger.js check <from>-<to> [--for <owner>] [--archive]

  --for       treat seeds already claimed by this owner as its own, so a run
              can prove the range it has just written into the ledger.
  --archive   also search the private run archive. Slow (minutes), and only
              needed when registering a range for a paid run.
  --no-scan   trust the ledger alone. For tests.`;

function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      count: { type: 'string' },
      from: { type: 'string' },
      for: { type: 'string' },
      archive: { type: 'boolean', default: false },
      scan: { type: 'boolean', default: true },
      json: { type: 'boolean', default: false },
    },
  });

  const command = positionals[0];
  if (!command || !['list', 'next', 'check'].includes(command)) {
    console.error(USAGE);
    return 2;
  }

  const ledger = readLedger();
  const extraRoots = [];
  if (values.archive) {
    const archive = archiveRoot();
    if (!fs.existsSync(archive)) {
      console.error(`no archive at ${archive}; set EVAL_ARCHIVE_DIR or drop --archive`);
      return 2;
    }
    extraRoots.push(archive);
  }
  const scanned = values.scan ? scanSeeds(ROOT, { extraRoots }) : new Map();
  const taken = takenSeeds(ledger, scanned);
  const searched = values.scan ? (values.archive ? 'repo and archive' : 'repo only') : 'ledger only';

  if (command === 'list') {
    const drift = undeclaredSeeds(ledger, scanned);
    if (values.json) {
      console.log(
        JSON.stringify(
          { searched, claims: ledger.claims, taken: [...taken.keys()].sort((a, b) => a - b), drift },
          null,
          2,
        ),
      );
      return 0;
    }
    console.log(`seed ledger — searched ${searched}`);
    console.log('');
    for (const claim of ledger.claims) {
      const span =
        claim.seeds.length > 1 && claim.seeds[claim.seeds.length - 1] - claim.seeds[0] + 1 === claim.seeds.length
          ? `${claim.seeds[0]}-${claim.seeds[claim.seeds.length - 1]}`
          : claim.seeds.join(', ');
      console.log(`  ${span}`);
      console.log(`    ${claim.claimed_by}`);
    }
    console.log('');
    console.log(`${taken.size} seeds taken between ${SEED_FLOOR} and ${SEED_CEILING}`);
    const blocks = freeBlocks(taken, { minimum: 6 });
    console.log('');
    console.log('free blocks of 6 or more:');
    for (const block of blocks.slice(0, 8)) {
      console.log(`  ${block.from}-${block.to}  (${block.width} wide)`);
    }
    if (drift.length) {
      console.log('');
      console.log(`WARNING: ${drift.length} seed(s) in the files are not in the ledger:`);
      console.log(`  ${drift.join(', ')}`);
      console.log('  Add them, or find out who owns them. An unexplained seed is a taken seed.');
    }
    return 0;
  }

  if (command === 'next') {
    const count = Number(values.count ?? 12);
    if (!Number.isInteger(count) || count < 1) {
      console.error('--count must be a whole number of seeds');
      return 2;
    }
    const from = values.from ? Number(values.from) : SEED_FLOOR;
    const block = nextFreeBlock(taken, count, { from });
    if (!block) {
      console.error(`no free block of ${count} between ${from} and ${SEED_CEILING}`);
      return 1;
    }
    if (values.json) {
      console.log(JSON.stringify({ searched, ...block }, null, 2));
      return 0;
    }
    console.log(`${block.from}-${block.to}`);
    console.log('');
    console.log(`${count} free seeds, searched ${searched}.`);
    console.log(`Write the claim into ${SEED_LEDGER_PATH} before the run starts.`);
    return 0;
  }

  const range = /^([0-9]{3})-([0-9]{3})$/.exec(positionals[1] ?? '');
  if (!range) {
    console.error('check needs a range, like: check 654-665');
    return 2;
  }
  const [from, to] = [Number(range[1]), Number(range[2])];
  if (to < from) {
    console.error('the range must rise');
    return 2;
  }
  const { conflicts, own } = checkRange(taken, from, to, { owner: values.for ?? null });
  if (values.json) {
    console.log(JSON.stringify({ searched, from, to, free: conflicts.length === 0, conflicts, own }, null, 2));
    return conflicts.length ? 1 : 0;
  }
  if (!conflicts.length) {
    console.log(`${from}-${to} is free — ${to - from + 1} seeds, searched ${searched}.`);
    if (own.length)
      console.log(`${own.length} of them are already claimed by "${values.for}", which is its own claim.`);
    return 0;
  }
  console.log(`${from}-${to} is NOT free. ${conflicts.length} of ${to - from + 1} seeds are taken:`);
  for (const conflict of conflicts) {
    console.log(`  ${conflict.seed}  ${conflict.by}  (${conflict.source})`);
  }
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
