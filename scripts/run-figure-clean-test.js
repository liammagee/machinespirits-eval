#!/usr/bin/env node
/**
 * The clean test for figure recovery (card: reply-feature-stamps).
 *
 * What is being tested. A reader trained on the 24 move turns of the
 * fresh-shadow corpus guesses which of five moves was ordered, from the reply
 * alone, on turns generated after the instrument was frozen. Training corpus
 * and test corpus share no turn. The earlier 54.2% was leave-one-out inside
 * one corpus, which measures whether the orders are interchangeable; this
 * measures whether a profile built on one set of turns holds on another.
 *
 * Why it needs its own launcher. The fresh-shadow run left no manifest, and
 * its design had to be rebuilt afterwards by reading the card-force events out
 * of seven trace files. Everything that decides what the corpus IS is written
 * here and copied into a manifest beside the traces before the first model
 * call, so the next reader does not have to reconstruct it.
 *
 * Design, fixed before the run:
 *
 *  - Five MOVE cards only. The two quiet cards name a state the learner is in
 *    rather than a tactic the tutor takes, and a gate replay over the training
 *    corpus withholds all 8 of its quiet orders, so there is no valid training
 *    data for them. Ordering them here would produce turns that must be thrown
 *    away.
 *  - Seven dialogues, one Latin-square rotation each, so each move is ordered
 *    exactly seven times and no move sits systematically early or late.
 *  - Slots 4 to 8. The training corpus used 5 to 11 and its dialogues ended at
 *    turn 7 to 9, so slots 9 and above rarely fired; pulling the window one
 *    turn earlier puts all five inside it.
 *  - The pinned recipe from the training run, so world, tutor, models, seed and
 *    budgets are the same and the corpus difference is the turns themselves.
 *
 * Attended, not fire-and-forget: dialogues run one at a time and the script
 * stops on the first failure, so a quota wall leaves a partial corpus with a
 * manifest rather than a silent hole.
 *
 * Second use, added 2026-08-08 (card: figure-transfer-second-world). The same
 * design run in a DIFFERENT world asks whether the profile learned the form of
 * five tactics or the vocabulary of one argument. `--recipe` and `--world-dir`
 * make that the only difference; every default below is what the clean test
 * ran with, so the original command still reproduces the original corpus.
 *
 * Usage:
 *   node scripts/run-figure-clean-test.js [--out <dir>] [--dialogues N] [--dry-run]
 *                                         [--recipe <path>] [--world-dir <id>]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The five cards that name a tutor tactic. Order fixed here so the rotation is
// reproducible; it is the same cycle the training corpus used, with the two
// quiet cards removed.
const MOVES = ['settled_claim', 'stake', 'demand', 'mockery', 'grievance'];
const SLOTS = [4, 5, 6, 7, 8];
const DEFAULT_RECIPE = path.resolve(ROOT, '..', 'ms-figure-pinned', 'corpus-recipe.json');
const DEFAULT_OUT = path.join(ROOT, 'exports', 'tutor-stub-outcome', 'figure-clean-test');
const DEFAULT_WORLD_DIR = 'world_030_rowan_flat';

/** Dialogue r orders MOVES[(slot index + r) mod 5] — one rotation per dialogue. */
export function scheduleFor(rotation) {
  return SLOTS.map((slot, i) => `${slot}=${MOVES[(i + rotation) % MOVES.length]}`).join(',');
}

function parseArgs(argv) {
  const out = {
    outDir: DEFAULT_OUT,
    dialogues: 7,
    dryRun: false,
    recipe: DEFAULT_RECIPE,
    worldDir: DEFAULT_WORLD_DIR,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const [k, inline] = argv[i].split('=');
    const val = inline !== undefined ? inline : argv[i + 1];
    if (k === '--out') {
      out.outDir = path.resolve(val);
      if (inline === undefined) i += 1;
    } else if (k === '--recipe') {
      out.recipe = path.resolve(val);
      if (inline === undefined) i += 1;
    } else if (k === '--world-dir') {
      out.worldDir = val;
      if (inline === undefined) i += 1;
    } else if (k === '--dialogues') {
      out.dialogues = Number(val);
      if (inline === undefined) i += 1;
    } else if (k === '--dry-run') {
      out.dryRun = true;
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.recipe)) {
    console.error(`pinned recipe missing: ${args.recipe}`);
    console.error('The training corpus ran from it, so without it this is a different run, not a clean test.');
    process.exit(1);
  }
  // Which of the two registered runs this is. Same design either way; only the
  // world (and so the recipe) differs, and the manifest should say which.
  const transfer = args.worldDir !== DEFAULT_WORLD_DIR;

  const plan = Array.from({ length: args.dialogues }, (_, d) => ({
    dialogue: `latin-d${d}`,
    rotation: d % MOVES.length,
    schedule: scheduleFor(d % MOVES.length),
  }));

  const manifest = {
    schema: 'machinespirits.tutor-stub.figure-clean-test.v1',
    card: transfer ? 'figure-transfer-second-world' : 'reply-feature-stamps',
    purpose: transfer
      ? `Transfer test: the same profile trained on the 24 move turns of figure-fresh-shadow, applied to turns from a second world (${args.worldDir}), asking whether it learned the form of five tactics or the vocabulary of one argument.`
      : 'Held-out test: a profile trained on the 24 move turns of figure-fresh-shadow, applied to turns generated after rf-v2 was frozen.',
    instrument: 'rf-v2',
    world: args.worldDir,
    recipe: path.relative(ROOT, args.recipe),
    driftAcknowledged: true,
    moves: MOVES,
    slots: SLOTS,
    quietCardsOrdered: false,
    quietCardsWhy:
      'All 8 quiet orders in the training corpus were withheld by a replay of the merged card-force gate, so the two quiet cards have no valid training turns.',
    env: {
      TUTOR_STUB_MANNER_SWITCH: '1',
      TUTOR_STUB_QUIET_DETECTOR: '1',
      TUTOR_STUB_CARD_DOSE_LADDER: '1',
    },
    plan,
  };

  fs.mkdirSync(args.outDir, { recursive: true });
  const manifestPath = path.join(args.outDir, 'run-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
  console.log(`wrote ${path.relative(ROOT, manifestPath)}`);

  for (const step of plan) {
    const traceDir = path.join(args.outDir, 'traces', args.worldDir, step.dialogue);
    const cmd = [
      'node',
      'scripts/tutor-stub.js',
      '--recipe',
      path.relative(ROOT, args.recipe),
      '--acknowledge-drift',
      '--trace-dir',
      path.relative(ROOT, traceDir),
    ];
    console.log(`\n${step.dialogue} (rotation ${step.rotation}): ${step.schedule}`);
    if (args.dryRun) {
      console.log(`  TUTOR_STUB_CARD_FORCE=${step.schedule} ${cmd.join(' ')}`);
      continue;
    }
    const res = spawnSync(cmd[0], cmd.slice(1), {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, ...manifest.env, TUTOR_STUB_CARD_FORCE: step.schedule },
    });
    if (res.status !== 0) {
      // Stop rather than press on. A partial corpus with a manifest can be
      // finished later; a corpus with silent gaps cannot be read at all.
      console.error(`\n${step.dialogue} exited ${res.status}. Stopping — the manifest records what was planned.`);
      process.exit(res.status || 1);
    }
  }
  console.log(`\nall ${plan.length} dialogues done. Read with:`);
  console.log(`  node scripts/analyze-figure-holdout.js --test ${path.relative(ROOT, args.outDir)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
