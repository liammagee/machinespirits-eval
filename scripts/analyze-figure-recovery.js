#!/usr/bin/env node
/**
 * Can you tell, from the reply alone, which move the tutor was told to make?
 *
 * This replaces the separation test, and the swap is deliberate. Separation
 * asked whether a move's fingerprint appears on NO other move's turns -- one
 * trespassing turn kills it. That is the right standard for sounds in a
 * language, where two sounds either contrast or do not. It is the wrong
 * standard for moves in an argument, which overlap by nature: crediting the
 * learner before correcting them and untangling a confused one can both open
 * with a credit and a contrast, and neither is thereby fake.
 *
 * The standard here is weaker and fits the object: given a reply, guess which
 * of the seven moves was ordered. Better than chance means the order left a
 * mark. Perfect is not wanted and would be suspicious.
 *
 * ORDER OF EVENTS, so the swap is on the record. The separation test was
 * registered first, run, and returned a null (0 of 7 on the drafts, 1 of 6 on
 * the shipped text). This test was written afterwards, knowing that. It is
 * therefore NOT a pre-registered result, and its numbers stand or fall on the
 * permutation baseline below plus a later run on turns nobody has seen.
 *
 * Method. Leave one turn out; build each move's profile from the other 31;
 * score the held-out turn under each move and rank them. Naive Bayes over the
 * binary reply features with add-one smoothing, and a UNIFORM class prior --
 * the square was built to give every move the same number of turns, so the
 * small realized imbalance (4 to 6) is an accident of which turns fired, not
 * information. Using the realized counts as a prior would hand the classifier
 * free accuracy for guessing the commonest move.
 *
 * Reported: top-1 and top-2 accuracy against a chance rate of 1/7 and 2/7, per
 * move recall, the features that mark each move, and a permutation baseline --
 * the same leave-one-out run with the move labels shuffled among these same
 * turns, which holds size, class balance and the whole feature distribution
 * fixed and destroys only the link between move and text.
 *
 * Pure computation over stored traces. No model calls, no DB, no writes
 * outside exports/crossed-effects/.
 *
 * Usage:
 *   node scripts/analyze-figure-recovery.js [--traces <dir>] [--source draft|shipped]
 *                                           [--trials N] [--seed N] [--with-plain-flag]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describeTutorStubReplyFeatures, tutorStubReplyFeatureAttributes } from '../services/tutorStubReplyFeatures.js';
import { mulberry32, readDialogue, walk } from './analyze-figure-lattice-fresh.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CE = path.join(ROOT, 'exports', 'crossed-effects');
const DEFAULT_TRACES = path.join(ROOT, 'exports', 'tutor-stub-outcome', 'figure-fresh-shadow');

// Added AFTER reading the plain-words turns and noticing the instrument had no
// column for the thing that move is about. Off by default, and any run with it
// on is a post-hoc reading that needs fresh turns before it counts.
const PLAIN_SPEECH =
  /\b(no jargon|plain talk|plain and simple|plain english|in plain|simply put|plainly|straight talk|no fancy)\b/i;

function parseArgs(argv) {
  const out = { traces: DEFAULT_TRACES, source: 'draft', trials: 400, seed: 20260807, plainFlag: false };
  for (let i = 0; i < argv.length; i += 1) {
    const [k, inline] = argv[i].split('=');
    const val = inline !== undefined ? inline : argv[i + 1];
    if (k === '--traces') {
      out.traces = path.resolve(val);
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
    } else if (k === '--with-plain-flag') {
      out.plainFlag = true;
    }
  }
  return out;
}

/** Rank the moves for one held-out turn, trained on everything else. */
function rank(train, vocab, moves, testFeatures) {
  const scored = moves.map((m) => {
    const own = train.filter((t) => t.figure === m);
    // Uniform prior: every move starts level. See the header for why.
    let logp = 0;
    for (const f of vocab) {
      const withF = own.filter((t) => t.features.has(f)).length;
      const p = (withF + 1) / (own.length + 2);
      logp += testFeatures.has(f) ? Math.log(p) : Math.log(1 - p);
    }
    return { move: m, logp };
  });
  scored.sort((a, b) => b.logp - a.logp);
  return scored;
}

function leaveOneOut(turns, vocab, moves) {
  let top1 = 0;
  let top2 = 0;
  const perMove = new Map(moves.map((m) => [m, { n: 0, right: 0, top2: 0 }]));
  const calls = [];
  for (let i = 0; i < turns.length; i += 1) {
    const test = turns[i];
    const train = turns.filter((_, j) => j !== i);
    // A move with no training turns left cannot be predicted, which is right:
    // the held-out turn is the only evidence for it and using it would leak.
    const present = moves.filter((m) => train.some((t) => t.figure === m));
    const scored = rank(train, vocab, present, test.features);
    const got1 = scored[0]?.move === test.figure;
    const got2 = got1 || scored[1]?.move === test.figure;
    if (got1) top1 += 1;
    if (got2) top2 += 1;
    const rec = perMove.get(test.figure);
    rec.n += 1;
    if (got1) rec.right += 1;
    if (got2) rec.top2 += 1;
    calls.push({ where: test.where, ordered: test.figure, guessed: scored[0]?.move, second: scored[1]?.move });
  }
  return { top1: top1 / turns.length, top2: top2 / turns.length, perMove, calls };
}

/** What marks a move: features it carries much more (or less) than the rest. */
function markers(turns, vocab, move) {
  const own = turns.filter((t) => t.figure === move);
  const rest = turns.filter((t) => t.figure !== move);
  return vocab
    .map((f) => {
      const a = own.filter((t) => t.features.has(f)).length;
      const b = rest.filter((t) => t.features.has(f)).length;
      return { f, own: a, ownN: own.length, rest: b, restN: rest.length, lift: a / own.length - b / rest.length };
    })
    .filter((x) => Math.abs(x.lift) >= 0.4)
    .sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = walk(args.traces);
  if (!files.length) {
    console.error(`no traces under ${args.traces} — nothing to read.`);
    process.exit(1);
  }

  const turns = [];
  for (const f of files.sort()) {
    for (const o of readDialogue(f, args.source).objects) {
      const feats = new Set(
        tutorStubReplyFeatureAttributes(describeTutorStubReplyFeatures(o.reply, { learnerText: o.learner })),
      );
      if (args.plainFlag && PLAIN_SPEECH.test(o.reply)) feats.add('says-it-plainly');
      turns.push({ figure: o.figure, where: `${o.dialogue} t${o.turn}`, features: feats });
    }
  }

  const moves = [...new Set(turns.map((t) => t.figure))].sort();
  const vocab = [...new Set(turns.flatMap((t) => [...t.features]))].sort();
  const chance1 = 1 / moves.length;
  const chance2 = 2 / moves.length;

  console.log(`reading the ${args.source === 'draft' ? "tutor's own first drafts" : 'text that shipped'}`);
  console.log(
    `${turns.length} turns, ${moves.length} moves, ${vocab.length} features${args.plainFlag ? ' (plain-speech flag ON — post-hoc)' : ''}`,
  );

  const res = leaveOneOut(turns, vocab, moves);
  console.log(`\nguessing the ordered move from the reply alone, one turn held out at a time:`);
  console.log(`  right first guess:  ${(res.top1 * 100).toFixed(1)}%   (chance ${(chance1 * 100).toFixed(1)}%)`);
  console.log(`  right in top two:   ${(res.top2 * 100).toFixed(1)}%   (chance ${(chance2 * 100).toFixed(1)}%)`);

  console.log('\nper move:');
  for (const m of moves) {
    const r = res.perMove.get(m);
    console.log(`  ${m.padEnd(16)} ${r.right}/${r.n} first, ${r.top2}/${r.n} in top two`);
  }

  console.log('\nwhat marks each move (carried by this move much more, or much less, than the rest):');
  for (const m of moves) {
    const mk = markers(turns, vocab, m).slice(0, 3);
    console.log(
      `  ${m.padEnd(16)} ${mk.length ? mk.map((x) => `${x.f} ${x.own}/${x.ownN} vs ${x.rest}/${x.restN}`).join('; ') : '(nothing stands out)'}`,
    );
  }

  // Shuffle the move labels among these same turns and redo the whole thing.
  // Everything except the link between move and text is held fixed.
  const rand = mulberry32(args.seed);
  const shuffled = [];
  for (let t = 0; t < args.trials; t += 1) {
    const labels = turns.map((x) => x.figure);
    for (let i = labels.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [labels[i], labels[j]] = [labels[j], labels[i]];
    }
    shuffled.push(
      leaveOneOut(
        turns.map((x, i) => ({ ...x, figure: labels[i] })),
        vocab,
        moves,
      ).top1,
    );
  }
  const mean = shuffled.reduce((s, x) => s + x, 0) / args.trials;
  const atLeast = shuffled.filter((x) => x >= res.top1).length / args.trials;
  console.log(
    `\nbaseline from these same turns (${args.trials} label shuffles): first guess right ${(mean * 100).toFixed(1)}% on average, ` +
      `best ever ${(Math.max(...shuffled) * 100).toFixed(1)}%`,
  );
  console.log(`  p(chance reaches ${(res.top1 * 100).toFixed(1)}%) = ${(atLeast * 100).toFixed(1)}%`);
  console.log(
    atLeast > 0.05 ? '  READING: the order left no mark this reader can find.' : '  READING: the order left a mark.',
  );

  const out = `figure-recovery-${args.source}${args.plainFlag ? '-plainflag' : ''}.json`;
  fs.writeFileSync(
    path.join(CE, out),
    JSON.stringify(
      {
        generated: 'can the ordered move be guessed from the reply? (workplan card: reply-feature-stamps)',
        source: args.source,
        plainSpeechFlag: args.plainFlag,
        caveats: [
          'Written after the separation test returned a null, so this is not a pre-registered result. It needs a run on turns nobody has seen before it counts.',
          'Uniform class prior on purpose: the square was built for equal counts, so the realized 4-to-6 spread is an accident of which turns fired.',
          args.plainFlag
            ? 'The plain-speech flag was added after reading the plain-words turns. Any gain it brings is post-hoc by construction.'
            : 'No plain-speech flag: the instrument has no column for announcing plain speech, which is what one of the seven moves is about.',
          'Drafts include text the guard vetoed, so this measures what the tutor can write, not what learners read.',
        ],
        turns: turns.length,
        moves,
        features: vocab,
        top1: res.top1,
        top2: res.top2,
        chance: { top1: chance1, top2: chance2 },
        perMove: Object.fromEntries([...res.perMove].map(([m, r]) => [m, r])),
        markers: Object.fromEntries(moves.map((m) => [m, markers(turns, vocab, m)])),
        permutation: { trials: args.trials, meanTop1: mean, maxTop1: Math.max(...shuffled), atLeast },
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
