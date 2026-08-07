#!/usr/bin/env node
/**
 * Small-n control for the figure-lattice falsifier (card: reply-feature-stamps).
 *
 * The falsifier's runs A/B/B'/C read 122 carded turns. A fresh corpus is far
 * smaller -- seven dialogues, one card per figure per dialogue -- and a small
 * context separates figures more easily for a reason that has nothing to do
 * with the ontology: with few turns per figure the shared intent is longer, its
 * closure extent is smaller, and fewer foreign turns are around to fall into
 * it. So "2 of 7 separated" on a fresh corpus is unreadable until we know how
 * often 2 of 7 separate by chance at that size.
 *
 * This is that null distribution. Subsample the calibration corpus down to n
 * turns per figure, run the same closure analysis, repeat, and report how the
 * separated count is distributed. A fresh result only counts if it sits in the
 * tail.
 *
 * Pure computation on stored traces and audit exports: no model calls, no DB,
 * no writes outside exports/crossed-effects/.
 *
 * Usage:
 *   node scripts/analyze-figure-lattice-control.js [--per-figure N] [--trials T] [--seed S]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { analyze, buildContext, buildObjects } from './analyze-figure-lattice.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CE = path.join(ROOT, 'exports', 'crossed-effects');

function parseArgs(argv) {
  const out = { perFigure: [1, 2, 3, 4, 5, 6, 7], trials: 400, seed: 20260807, coded: true };
  for (let i = 0; i < argv.length; i += 1) {
    const [k, inline] = argv[i].split('=');
    const val = inline !== undefined ? inline : argv[i + 1];
    if (k === '--no-coded') {
      // Drop the two columns that come from the qualitative audit rather than
      // the trace (the coder's tag and hit). A fresh corpus has no coding, so
      // its null must be built without them.
      out.coded = false;
    } else if (k === '--drop') {
      // Drop figures the corpus being compared never kept. A bar built over
      // seven figures does not apply to a six-figure result: fewer figures
      // means fewer foreign turns to collide with, so separation comes cheaper.
      // The comparison has to be like for like on figure count.
      out.drop = val.split(',').map((x) => x.trim());
      if (inline === undefined) i += 1;
    } else if (k === '--per-figure') {
      out.perFigure = val.split(',').map((x) => Number(x.trim()));
      if (inline === undefined) i += 1;
    } else if (k === '--trials') {
      out.trials = Number(val);
      if (inline === undefined) i += 1;
    } else if (k === '--seed') {
      out.seed = Number(val);
      if (inline === undefined) i += 1;
    }
  }
  return out;
}

// Seeded PRNG so the control reproduces exactly. A control whose number moves
// on re-run cannot be cited against a fixed observed result.
function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Full Fisher-Yates. Kept separate from sample(): sample() returns the array
// untouched when asked for all of it, which is right for drawing but silently
// makes a permutation a no-op -- and a no-op shuffle makes the chance arm equal
// the intact arm exactly, which reads as "the figures carry nothing".
function shuffled(arr, rand) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Draw k without replacement (partial Fisher-Yates on a copy).
function sample(arr, k, rand) {
  if (k >= arr.length) return [...arr];
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < k; i += 1) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    out.push(pool[i]);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { objects } = buildObjects();
  const drop = new Set(args.drop || []);
  const withReply = objects.filter((o) => o.reply && !drop.has(o.figure));
  if (drop.size) console.log(`dropped figures: ${[...drop].join(', ')}`);

  const byFigure = new Map();
  for (const o of withReply) {
    if (!byFigure.has(o.figure)) byFigure.set(o.figure, []);
    byFigure.get(o.figure).push(o);
  }
  const figures = [...byFigure.keys()].sort();

  console.log(`calibration corpus: ${withReply.length} turns with reply text, ${figures.length} figures`);
  for (const f of figures) console.log(`  ${f.padEnd(16)} ${byFigure.get(f).length} turns`);
  console.log(`\ntrials per size: ${args.trials}, seed ${args.seed}`);
  console.log(`coder columns (tag, hit): ${args.coded ? 'in' : 'OUT — matched to a fresh corpus'}`);

  // The two readings the falsifier reports: run C (B's ordered columns plus the
  // performed reply features) and C' (performed features alone). The performed
  // features alone are trace-derivable either way, so --no-coded only moves the
  // first reading.
  const readings = [
    {
      key: 'C',
      label: `B columns${args.coded ? '' : ' minus coder tag/hit'} + performed reply features`,
      opts: { withCard: false, withRuled: false, withReply: true, withCoded: args.coded },
    },
    {
      key: 'ConlyReply',
      label: 'performed reply features alone',
      opts: { withCard: false, withRuled: false, withReply: true, replyOnly: true },
    },
  ];

  const results = {};
  for (const reading of readings) {
    results[reading.key] = { label: reading.label, sizes: {} };
    console.log(`\n=== ${reading.label} ===`);
    console.log('  n/fig  turns   intact: distribution                          mean | shuffled mean  p');
    for (const n of args.perFigure) {
      const rand = mulberry32(args.seed + n * 1000 + reading.key.length);
      const counts = new Array(figures.length + 1).fill(0);
      const shuffledCounts = new Array(figures.length + 1).fill(0);
      let turnsTotal = 0;
      for (let t = 0; t < args.trials; t += 1) {
        const drawn = figures.flatMap((f) => sample(byFigure.get(f), n, rand));
        turnsTotal += drawn.length;
        counts[analyze(buildContext(drawn, reading.opts), `control n=${n}`).separatedCount] += 1;

        // The chance bar. Subsampling alone keeps every turn attached to its
        // real figure, so its spread measures how separation responds to corpus
        // SIZE while the real structure is still in there -- useful, but not a
        // null. Shuffling the figure labels across the same turns destroys any
        // link between figure and performed features while holding size, class
        // balance and the attribute distribution fixed. That is what "would
        // this many separate if the figures carried nothing?" actually asks.
        const labels = shuffled(
          drawn.map((o) => o.figure),
          rand,
        );
        shuffledCounts[
          analyze(
            buildContext(
              drawn.map((o, i) => ({ ...o, figure: labels[i] })),
              reading.opts,
            ),
            `shuffled n=${n}`,
          ).separatedCount
        ] += 1;
      }
      const meanOf = (c) => c.reduce((s, x, k) => s + x * k, 0) / args.trials;
      const mean = meanOf(counts);
      const shuffledMean = meanOf(shuffledCounts);
      // Share of trials reaching at least k separated, for every k.
      const atLeast = counts.map((_, k) => counts.slice(k).reduce((s, c) => s + c, 0) / args.trials);
      const shuffledAtLeast = shuffledCounts.map(
        (_, k) => shuffledCounts.slice(k).reduce((s, c) => s + c, 0) / args.trials,
      );
      // How often the shuffled corpus reaches the intact one's typical result:
      // the p-value for "figures carry information about the reply". Round the
      // reference UP -- rounding 0.46 down to 0 asks how often the shuffled arm
      // separates at least nothing, which is always, and reports a real effect
      // as p = 1.
      const p = shuffledAtLeast[Math.ceil(mean)] ?? 0;
      results[reading.key].sizes[n] = {
        perFigure: n,
        meanTurns: turnsTotal / args.trials,
        trials: args.trials,
        distribution: counts,
        atLeast,
        mean,
        shuffled: { distribution: shuffledCounts, atLeast: shuffledAtLeast, mean: shuffledMean },
        pShuffledReachesIntactMean: p,
      };
      const dist = counts.map((c, k) => `${k}:${((c / args.trials) * 100).toFixed(0)}%`).join(' ');
      console.log(
        `  ${String(n).padStart(5)}  ${String(Math.round(turnsTotal / args.trials)).padStart(5)}   ${dist.padEnd(44)} ${mean.toFixed(2)} | ${shuffledMean.toFixed(2)}  ${p.toFixed(3)}`,
      );
    }
  }

  const report = {
    generated: 'figure-lattice small-n control (workplan card: reply-feature-stamps)',
    question:
      'Two questions, one per arm. INTACT: how does the separated count depend on corpus size, with every turn still attached to its real figure? SHUFFLED: how many separate when the figure labels are randomised, i.e. when the figures carry nothing? A result is only evidence for the ontology if it beats the SHUFFLED arm.',
    method:
      "Subsample the calibration corpus to n turns per figure without replacement, run the falsifier closure analysis unchanged, repeat. Each trial is then rerun with the drawn turns' figure labels permuted among themselves, holding size, class balance and attribute distribution fixed. Seeded PRNG so the control reproduces.",
    warning:
      'The INTACT arm is NOT a null. It keeps the real figure-to-reply link, so it already contains whatever signal exists; reading it as "chance" understates the bar. Use the SHUFFLED arm for that.',
    seed: args.seed,
    trials: args.trials,
    coderColumns: args.coded,
    corpus: {
      turnsWithReply: withReply.length,
      figures: Object.fromEntries(figures.map((f) => [f, byFigure.get(f).length])),
    },
    readings: results,
  };
  // One artifact per (coder columns, figure count) pair, never one shared file:
  // the coded bar answers the falsifier's own runs, the uncoded bar answers a
  // fresh corpus, and a six-figure bar answers a corpus that only kept six.
  // Overwriting any of them with another would silently swap the bar a result
  // is read against, which is invisible at the point of reading.
  const stem = args.coded ? 'figure-lattice-smalln-control' : 'figure-lattice-smalln-control-uncoded';
  const out = `${stem}${figures.length === 7 ? '' : `-${figures.length}fig`}.json`;
  fs.writeFileSync(path.join(CE, out), JSON.stringify(report, null, 1) + '\n');
  console.log(`\nwrote exports/crossed-effects/${out}`);
  console.log("\nRead the atLeast row for the fresh corpus's own n before quoting any separated count.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
