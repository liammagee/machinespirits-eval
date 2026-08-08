#!/usr/bin/env node
/**
 * Why the figure reader falls back on one move (card: figure-transfer-second-world).
 *
 * The held-out reader recovers the ordered move above chance in two worlds
 * (41.2% both times, §7.14), but its per-move recall is lopsided and lopsided
 * differently in each world. Reading the two confusion tables shows one thing
 * they agree on: the demand's wrong guesses land on the stake far more often
 * than an even spread would put them. This script asks why, and its answer is
 * the one §7.14 reports.
 *
 * Found after the reading, on corpora already collected. Nothing here is a
 * pre-registered test — it diagnoses the instrument, and every number it
 * prints is descriptive. It changes no fit, touches no corpus, and makes no
 * model calls.
 *
 * Three questions, in order:
 *
 *  1. Does the conditional-stake column fire on the turns it is confusing?
 *     That column exists to catch "if you check X, then Y", the one shape the
 *     tutor family was thought never to make unprompted. If it fired on both
 *     demands and stakes it would explain the confusion directly.
 *
 *  2. If not, is the reader over-predicting the stake regardless of what was
 *     ordered? Compare how often each move is ordered with how often it is
 *     guessed, in each world separately, so a world effect would show.
 *
 *  3. If it is, is that because the stake's fitted profile is the flattest —
 *     the profile of a typical reply, which collects whatever the sharper
 *     classes do not claim? Score every class against every test turn and
 *     compare average likelihoods, then show which features separate the
 *     classes at all.
 *
 * The bias caps the reader rather than manufacturing it: the pre-registered
 * label shuffle re-fits nothing, so it carries the same bias and still lands
 * at chance. That is checked in the reader itself, not here.
 *
 * Usage:
 *   node scripts/analyze-figure-reader-bias.js [--json <path>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadTurns, fit, rank } from './analyze-figure-holdout.js';
import { walk, readDialogue } from './analyze-figure-lattice-fresh.js';
import { describeTutorStubReplyFeatures, tutorStubReplyFeatureAttributes } from '../services/tutorStubReplyFeatures.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'exports', 'tutor-stub-outcome');

const TRAIN = path.join(OUT, 'figure-fresh-shadow');
const TESTS = [
  ['rowan', path.join(OUT, 'figure-clean-test')],
  ['tideway', path.join(OUT, 'figure-transfer-tideway')],
];

/** The column that would explain the confusion if it fired. */
const STAKE_COLUMN = 'stakes';

function parseArgs(argv) {
  const out = { json: path.join(ROOT, 'exports', 'crossed-effects', 'figure-reader-bias.json') };
  for (let i = 0; i < argv.length; i += 1) {
    const [k, inline] = argv[i].split('=');
    const val = inline !== undefined ? inline : argv[i + 1];
    if (k === '--json') {
      out.json = path.resolve(val);
      if (inline === undefined) i += 1;
    }
  }
  return out;
}

/** Every carded turn in a corpus with its recomputed stamp, quiet cards included. */
function stampedTurns(dir) {
  const rows = [];
  for (const file of walk(dir)) {
    for (const o of readDialogue(file, 'draft').objects || []) {
      rows.push({
        card: o.figure,
        columns: tutorStubReplyFeatureAttributes(describeTutorStubReplyFeatures(o.reply, { learnerText: o.learner })),
      });
    }
  }
  return rows;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const dir of [TRAIN, ...TESTS.map(([, d]) => d)]) {
    if (!fs.existsSync(dir)) {
      console.error(`corpus missing: ${path.relative(ROOT, dir)}`);
      console.error('This reads stored traces only — nothing here regenerates a corpus.');
      process.exit(1);
    }
  }

  // --- 1. Does the conditional-stake column fire at all? -------------------
  const stamped = [['training', TRAIN], ...TESTS].flatMap(([name, dir]) =>
    stampedTurns(dir).map((r) => ({ ...r, corpus: name })),
  );
  const fired = stamped.filter((r) => r.columns.includes(STAKE_COLUMN));
  console.log(`the "${STAKE_COLUMN}" column across all three corpora: ${fired.length} of ${stamped.length} turns`);
  const firedBy = {};
  for (const r of fired) firedBy[r.card] = (firedBy[r.card] || 0) + 1;
  console.log(
    `  fires on: ${Object.entries(firedBy)
      .map(([c, n]) => `${c} ${n}`)
      .join(', ')} — so it cannot be what the reader confuses`,
  );

  // --- 2. Is the reader over-predicting one move, in both worlds? ----------
  const train = loadTurns(TRAIN, 'draft');
  const vocab = [...new Set(train.flatMap((t) => [...t.features]))].sort();
  const model = fit(train, vocab);

  const perWorld = {};
  const pooled = [];
  for (const [name, dir] of TESTS) {
    const turns = loadTurns(dir, 'draft');
    const ordered = {};
    const guessed = {};
    for (const t of turns) {
      ordered[t.move] = (ordered[t.move] || 0) + 1;
      const top = rank(model, vocab, t.features)[0].move;
      guessed[top] = (guessed[top] || 0) + 1;
    }
    perWorld[name] = { n: turns.length, ordered, guessed };
    pooled.push(...turns);
    console.log(`\n${name} — ordered against guessed, ${turns.length} turns`);
    for (const m of model.moves) {
      console.log(`  ${m.padEnd(15)} ordered ${String(ordered[m] || 0).padEnd(3)} guessed ${guessed[m] || 0}`);
    }
  }

  // --- 3. Is the over-predicted class simply the flattest? -----------------
  const generic = model.moves.map((m) => ({
    move: m,
    trainN: model.profile.get(m).n,
    meanLogp:
      pooled.reduce((s, t) => s + rank(model, vocab, t.features).find((r) => r.move === m).logp, 0) / pooled.length,
    firsts: pooled.filter((t) => rank(model, vocab, t.features)[0].move === m).length,
    actual: pooled.filter((t) => t.move === m).length,
  }));
  console.log(`\npooled over both test corpora (${pooled.length} turns), how generic each fitted class is`);
  console.log('move            train n   mean logp   ranked 1st   actually ordered');
  for (const g of [...generic].sort((a, b) => b.meanLogp - a.meanLogp)) {
    console.log(
      `  ${g.move.padEnd(15)} ${String(g.trainN).padEnd(9)} ${g.meanLogp.toFixed(2).padStart(9)} ` +
        `${String(g.firsts).padStart(12)} ${String(g.actual).padStart(18)}`,
    );
  }

  const spread = vocab
    .map((f) => {
      const probs = Object.fromEntries(model.moves.map((m) => [m, model.profile.get(m).probs.get(f)]));
      const vals = Object.values(probs);
      return { feature: f, spread: Math.max(...vals) - Math.min(...vals), probs };
    })
    .sort((a, b) => b.spread - a.spread);
  const flat = spread.filter((s) => s.spread < 0.25).length;
  console.log(`\nof ${vocab.length} features, ${flat} separate the five classes by less than 0.25`);
  for (const s of spread.slice(0, 4)) {
    console.log(
      `  ${s.feature.padEnd(18)} ${s.spread.toFixed(2)}  ` +
        model.moves.map((m) => `${m.slice(0, 5)} ${s.probs[m].toFixed(2)}`).join('  '),
    );
  }

  const report = {
    generated: new Date().toISOString(),
    postHoc: true,
    note: 'Diagnosis of the held-out reader, run after the two readings. Descriptive; no pre-registered test here.',
    train: path.relative(ROOT, TRAIN),
    tests: Object.fromEntries(TESTS.map(([n, d]) => [n, path.relative(ROOT, d)])),
    stakeColumn: { name: STAKE_COLUMN, fired: fired.length, of: stamped.length, byCard: firedBy },
    perWorld,
    classes: generic,
    featureSpread: spread,
  };
  fs.mkdirSync(path.dirname(args.json), { recursive: true });
  fs.writeFileSync(args.json, JSON.stringify(report, null, 1) + '\n');
  console.log(`\nwrote ${path.relative(ROOT, args.json)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
