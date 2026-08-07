#!/usr/bin/env node
/**
 * The held-out reading: train on one corpus, test on another.
 *
 * `analyze-figure-recovery.js` leaves one turn out of a single corpus and asks
 * whether the ordered move can be guessed from the reply. That answers whether
 * the orders are interchangeable — they are not, 54.2% against a 20% chance
 * bar. It cannot answer whether a profile built on those turns holds on turns
 * nobody had generated, because every training set it uses is 23 of the same
 * 24 turns.
 *
 * This script trains once, on the whole training corpus, and never looks at a
 * test reply while fitting. Same reader as the recovery script: naive Bayes
 * over the binary reply features, add-one smoothing, uniform class prior.
 *
 * PRE-REGISTERED before the test corpus existed, and the bar does not move
 * afterwards:
 *
 *  - Primary. Top-1 accuracy on the test turns against a chance bar of 1/K,
 *    where K is the number of moves the profile ranks (5). One-sided exact
 *    binomial. Pass is p < 0.05. Anything else is a null, including a result
 *    that beats chance but not the bar.
 *  - Secondary, reported either way: top-2 against 2/K, per-move recall, and a
 *    label shuffle inside the test corpus as a second baseline.
 *  - No turn is dropped after the fact. The only drops are the ones the reader
 *    already makes for everyone: a turn whose dialogue never completed, and on
 *    the shipped reading a turn where the guard shipped its template.
 *  - The draft reading is primary, because the training profile was built from
 *    drafts. The shipped reading is reported beside it and is a different
 *    question — what survived the guard — not a second chance at the same one.
 *
 * Pure computation over stored traces. No model calls, no DB, no writes
 * outside exports/crossed-effects/.
 *
 * Usage:
 *   node scripts/analyze-figure-holdout.js --test <dir> [--train <dir>]
 *                                          [--source draft|shipped] [--trials N] [--seed N]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describeTutorStubReplyFeatures, tutorStubReplyFeatureAttributes } from '../services/tutorStubReplyFeatures.js';
import { mulberry32, readDialogue, walk } from './analyze-figure-lattice-fresh.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CE = path.join(ROOT, 'exports', 'crossed-effects');
const DEFAULT_TRAIN = path.join(ROOT, 'exports', 'tutor-stub-outcome', 'figure-fresh-shadow');
const DEFAULT_TEST = path.join(ROOT, 'exports', 'tutor-stub-outcome', 'figure-clean-test');

function parseArgs(argv) {
  const out = { train: DEFAULT_TRAIN, test: DEFAULT_TEST, source: 'draft', trials: 400, seed: 20260808 };
  for (let i = 0; i < argv.length; i += 1) {
    const [k, inline] = argv[i].split('=');
    const val = inline !== undefined ? inline : argv[i + 1];
    if (k === '--train') {
      out.train = path.resolve(val);
      if (inline === undefined) i += 1;
    } else if (k === '--test') {
      out.test = path.resolve(val);
      if (inline === undefined) i += 1;
    } else if (k === '--source') {
      if (val !== 'shipped' && val !== 'draft') {
        console.error(`--source must be 'shipped' or 'draft', got '${val}'`);
        process.exit(1);
      }
      out.source = val;
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

/**
 * Read a corpus into labelled turns. Quiet orders are excluded from both sides:
 * they name a state rather than a tactic, and every one in the training corpus
 * was ordered at a learner who was not in it.
 */
export function loadTurns(dir, source) {
  const files = walk(dir);
  if (!files.length) return [];
  const turns = [];
  for (const f of files.sort()) {
    for (const o of readDialogue(f, source).objects) {
      if (o.figure.startsWith('quiet:')) continue;
      turns.push({
        move: o.figure,
        where: `${o.dialogue} t${o.turn}`,
        // Identity for the overlap check is the reply itself, not the name. Both
        // corpora number their dialogues latin-d0..d6, so `${dialogue} t${turn}`
        // collides across corpora that share no turn at all.
        reply: o.reply.replace(/\s+/gu, ' ').trim(),
        features: new Set(
          tutorStubReplyFeatureAttributes(describeTutorStubReplyFeatures(o.reply, { learnerText: o.learner })),
        ),
      });
    }
  }
  return turns;
}

/** Fit once on the training turns. Uniform prior — the square balances counts. */
export function fit(trainTurns, vocab) {
  const moves = [...new Set(trainTurns.map((t) => t.move))].sort();
  const profile = new Map();
  for (const m of moves) {
    const own = trainTurns.filter((t) => t.move === m);
    const probs = new Map();
    for (const f of vocab) probs.set(f, (own.filter((t) => t.features.has(f)).length + 1) / (own.length + 2));
    profile.set(m, { n: own.length, probs });
  }
  return { moves, profile };
}

export function rank({ moves, profile }, vocab, features) {
  return moves
    .map((m) => {
      const { probs } = profile.get(m);
      let logp = 0;
      for (const f of vocab) {
        const p = probs.get(f);
        logp += features.has(f) ? Math.log(p) : Math.log(1 - p);
      }
      return { move: m, logp };
    })
    .sort((a, b) => b.logp - a.logp);
}

/** One-sided exact binomial: P(X >= hits) when each guess is right with rate p. */
export function binomialTail(hits, n, p) {
  const logFact = [0];
  for (let i = 1; i <= n; i += 1) logFact[i] = logFact[i - 1] + Math.log(i);
  let total = 0;
  for (let k = hits; k <= n; k += 1) {
    total += Math.exp(logFact[n] - logFact[k] - logFact[n - k] + k * Math.log(p) + (n - k) * Math.log(1 - p));
  }
  return Math.min(1, total);
}

function score(model, vocab, testTurns) {
  const perMove = new Map(model.moves.map((m) => [m, { n: 0, right: 0, top2: 0 }]));
  const calls = [];
  let top1 = 0;
  let top2 = 0;
  for (const t of testTurns) {
    const scored = rank(model, vocab, t.features);
    const got1 = scored[0]?.move === t.move;
    const got2 = got1 || scored[1]?.move === t.move;
    if (got1) top1 += 1;
    if (got2) top2 += 1;
    if (!perMove.has(t.move)) perMove.set(t.move, { n: 0, right: 0, top2: 0 });
    const rec = perMove.get(t.move);
    rec.n += 1;
    if (got1) rec.right += 1;
    if (got2) rec.top2 += 1;
    calls.push({ where: t.where, ordered: t.move, guessed: scored[0]?.move, second: scored[1]?.move });
  }
  return { hits1: top1, hits2: top2, perMove, calls };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const trainTurns = loadTurns(args.train, args.source);
  const testTurns = loadTurns(args.test, args.source);
  if (!trainTurns.length) {
    console.error(`no training turns under ${args.train}`);
    process.exit(1);
  }
  if (!testTurns.length) {
    console.error(`no test turns under ${args.test} — the clean-test corpus has not been generated yet.`);
    console.error('Generate it with: node scripts/run-figure-clean-test.js');
    process.exit(1);
  }
  const overlap = new Set(trainTurns.map((t) => t.reply));
  const shared = testTurns.filter((t) => overlap.has(t.reply));

  // Vocabulary from the TRAINING corpus only. A feature first seen in the test
  // set has no fitted probability, and inventing one from the test replies
  // would be fitting on the thing being tested.
  const vocab = [...new Set(trainTurns.flatMap((t) => [...t.features]))].sort();
  const model = fit(trainTurns, vocab);
  const chance1 = 1 / model.moves.length;
  const chance2 = 2 / model.moves.length;

  console.log(`reading ${args.source === 'draft' ? "the tutor's own first drafts" : 'the text that shipped'}`);
  console.log(`train: ${trainTurns.length} turns from ${path.relative(ROOT, args.train)}`);
  console.log(`test:  ${testTurns.length} turns from ${path.relative(ROOT, args.test)}`);
  if (shared.length) console.log(`  WARNING: ${shared.length} replies appear in both corpora — not a held-out test.`);
  console.log(
    `moves ranked: ${model.moves.join(', ')} (${model.moves.length}, so chance is 1 in ${model.moves.length})`,
  );
  console.log(`features carried over from training: ${vocab.length}`);

  const res = score(model, vocab, testTurns);
  const n = testTurns.length;
  const p1 = binomialTail(res.hits1, n, chance1);
  const p2 = binomialTail(res.hits2, n, chance2);

  console.log(`\nprofile built on the training corpus, applied to turns it has never seen:`);
  console.log(
    `  right first guess:  ${res.hits1}/${n} = ${((100 * res.hits1) / n).toFixed(1)}%   (chance ${(100 * chance1).toFixed(1)}%, p = ${p1.toFixed(4)})`,
  );
  console.log(
    `  right in top two:   ${res.hits2}/${n} = ${((100 * res.hits2) / n).toFixed(1)}%   (chance ${(100 * chance2).toFixed(1)}%, p = ${p2.toFixed(4)})`,
  );

  console.log('\nper move:');
  for (const m of [...res.perMove.keys()].sort()) {
    const r = res.perMove.get(m);
    if (!r.n) continue;
    console.log(`  ${m.padEnd(16)} ${r.right}/${r.n} first, ${r.top2}/${r.n} in top two`);
  }

  // Second baseline: shuffle the test labels. The profile is untouched, so this
  // says what this profile scores on text whose labels mean nothing.
  const rand = mulberry32(args.seed);
  const shuffled = [];
  for (let t = 0; t < args.trials; t += 1) {
    const labels = testTurns.map((x) => x.move);
    for (let i = labels.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [labels[i], labels[j]] = [labels[j], labels[i]];
    }
    shuffled.push(
      score(
        model,
        vocab,
        testTurns.map((x, i) => ({ ...x, move: labels[i] })),
      ).hits1 / n,
    );
  }
  const mean = shuffled.reduce((s, x) => s + x, 0) / args.trials;
  const atLeast = shuffled.filter((x) => x >= res.hits1 / n).length / args.trials;
  console.log(
    `\ntest labels shuffled ${args.trials} times: first guess right ${(100 * mean).toFixed(1)}% on average, ` +
      `best ever ${(100 * Math.max(...shuffled)).toFixed(1)}%`,
  );
  console.log(`  p(shuffled labels reach ${((100 * res.hits1) / n).toFixed(1)}%) = ${(100 * atLeast).toFixed(1)}%`);

  const passed = p1 < 0.05;
  console.log(
    `\nREGISTERED READING: ${passed ? 'the profile HOLDS on turns it was not built from.' : 'NULL — the profile does not hold on turns it was not built from.'}`,
  );

  const out = `figure-holdout-${args.source}.json`;
  fs.writeFileSync(
    path.join(CE, out),
    JSON.stringify(
      {
        generated: 'held-out test of figure recovery (workplan card: reply-feature-stamps)',
        preRegistered:
          'Bar fixed before the test corpus existed: one-sided exact binomial on top-1 against 1/K, pass at p < 0.05.',
        source: args.source,
        train: path.relative(ROOT, args.train),
        test: path.relative(ROOT, args.test),
        trainTurns: trainTurns.length,
        testTurns: n,
        sharedReplies: shared.length,
        moves: model.moves,
        trainCounts: Object.fromEntries([...model.profile].map(([m, v]) => [m, v.n])),
        features: vocab,
        top1: res.hits1 / n,
        top2: res.hits2 / n,
        hits: { top1: res.hits1, top2: res.hits2, n },
        chance: { top1: chance1, top2: chance2 },
        binomial: { top1: p1, top2: p2 },
        perMove: Object.fromEntries([...res.perMove].map(([m, r]) => [m, r])),
        permutation: { trials: args.trials, meanTop1: mean, maxTop1: Math.max(...shuffled), atLeast },
        passed,
        calls: res.calls,
      },
      null,
      1,
    ) + '\n',
  );
  console.log(`\nwrote exports/crossed-effects/${out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
