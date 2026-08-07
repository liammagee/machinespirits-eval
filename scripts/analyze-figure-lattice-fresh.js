#!/usr/bin/env node
/**
 * Fresh-corpus reading of the figure lattice (card: reply-feature-stamps).
 *
 * The clean test the falsifier asked for: turns generated AFTER the reply-
 * feature stamp went live, so the feature definitions were fixed before these
 * replies existed. Run C was calibration -- its act patterns were widened while
 * looking at labelled replies from the corpus it then scored. Nothing here was
 * tuned on these turns.
 *
 * Three things this script does that the calibration reading cannot:
 *
 *  1. Checks the LIVE stamp the harness wrote at runtime against a recompute
 *     over the stored reply text, and stops if they disagree. The lattice
 *     itself is built from the recompute (analyze-figure-lattice.js does that
 *     internally); the check is what licenses treating that recompute as the
 *     thing the harness actually stamped at generation time.
 *  2. Drops every turn where the guard ladder shipped the deterministic
 *     template. Those turns carry a stamp too, but stamping harness boilerplate
 *     would put the harness in the lattice instead of the tutor.
 *  3. Drops the two columns that come from the qualitative audit (the coder's
 *     tag and hit). A fresh corpus has no coding, so the reading runs without
 *     them -- and must be read against the matching uncoded null from
 *     scripts/analyze-figure-lattice-control.js --no-coded.
 *
 * IMPORTANT -- separation is size-dependent. The control shows that at one turn
 * per figure all seven separate 100% of the time, purely because a small
 * context leaves a long shared intent and few foreign turns to fall into its
 * closure. So a separated count means nothing on its own: read it against the
 * null at THIS corpus's realized turns-per-figure. The script prints that
 * comparison rather than leaving it to the reader.
 *
 * Pure computation over stored traces. No model calls, no DB, no writes
 * outside exports/crossed-effects/.
 *
 * Usage:
 *   node scripts/analyze-figure-lattice-fresh.js [--traces <dir>] [--null <json>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describeTutorStubReplyFeatures, tutorStubReplyFeatureAttributes } from '../services/tutorStubReplyFeatures.js';
import { analyze, buildContext } from './analyze-figure-lattice.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CE = path.join(ROOT, 'exports', 'crossed-effects');
const DEFAULT_TRACES = path.join(ROOT, 'exports', 'tutor-stub-outcome', 'figure-fresh-shadow');
const DEFAULT_NULL = path.join(CE, 'figure-lattice-smalln-control-uncoded.json');

function parseArgs(argv) {
  const out = { traces: DEFAULT_TRACES, nullFile: DEFAULT_NULL, source: 'shipped', trials: 400, seed: 20260807 };
  for (let i = 0; i < argv.length; i += 1) {
    const [k, inline] = argv[i].split('=');
    const val = inline !== undefined ? inline : argv[i + 1];
    if (k === '--traces') {
      out.traces = path.resolve(val);
      if (inline === undefined) i += 1;
    } else if (k === '--null') {
      out.nullFile = path.resolve(val);
      if (inline === undefined) i += 1;
    } else if (k === '--source') {
      // 'shipped' = the text the learner saw. 'draft' = the tutor's own first
      // attempt, before the guard ladder accepted, rewrote or replaced it.
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

// Whitespace-only differences are not differences in what the tutor wrote. The
// delivery path collapses paragraph breaks to spaces, so a byte comparison
// would call 10 of 32 turns "rewritten" when the words are identical.
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

export function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const walk = (d) =>
  fs.existsSync(d)
    ? fs
        .readdirSync(d, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.jsonl') ? [path.join(d, e.name)] : [],
        )
    : [];

/**
 * One dialogue file -> the carded turns it contributes, plus what it dropped.
 *
 * The state column is the pressure the cascade READ from the learner, not the
 * card that was forced. Those are independent by construction -- the force
 * happens after detection -- so the column stays blind to the card, which is
 * the whole point of the falsifier.
 */
export function readDialogue(file, source) {
  const events = fs
    .readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const at = (type, turn) => events.find((e) => e.type === type && e.turn === turn);
  const dialogue = path.basename(path.dirname(file));
  const worldDir = path.basename(path.dirname(path.dirname(file)));
  const world = worldDir.includes('030') ? '030' : worldDir.includes('033') ? '033' : worldDir;

  const objects = [];
  const dropped = { template: [], incomplete: [], noStamp: [], noDraft: [] };
  const mismatches = [];
  let stampChecked = 0;

  for (const force of events.filter((e) => e.type === 'tutor_card_force' && e.cardActive && e.forced !== 'none')) {
    const turn = force.turn;
    const complete = at('turn_complete', turn);
    if (!complete) {
      dropped.incomplete.push(`${dialogue} t${turn} (${force.forced})`);
      continue;
    }
    const shipped = complete.turnRecord?.tutor || '';
    const learner = complete.turnRecord?.learner || '';
    const stamp = at('tutor_reply_features', turn);

    // The tutor's own first attempt, before the guard ladder accepted it,
    // asked for a plain rewrite, or replaced it with the canned template. It
    // survives in the trace on every turn including the rejected ones, which
    // is the whole reason the draft reading is possible at no cost.
    const draft =
      events.find((e) => e.type === 'model_call' && e.role === 'tutor_stub_tutor' && e.turn === turn)?.response?.text ||
      '';

    let reply;
    if (source === 'draft') {
      if (!draft) {
        dropped.noDraft.push(`${dialogue} t${turn} (${force.forced})`);
        continue;
      }
      reply = draft;
    } else {
      if (complete.turnRecord?.tutorDeterministicFallback) {
        dropped.template.push(`${dialogue} t${turn} (${force.forced})`);
        continue;
      }
      if (!stamp) {
        dropped.noStamp.push(`${dialogue} t${turn} (${force.forced})`);
        continue;
      }
      reply = shipped;
    }

    // The stamp must equal a recompute over the stored text. If the harness
    // stamped something the text does not support, every reading below is of
    // the stamp's bug rather than the tutor's reply.
    //
    // The live stamp is over what SHIPPED, so on the draft reading it only
    // applies where the draft is what shipped. Checking it elsewhere would
    // report the guard's edit as an instrument fault. Where it does not apply
    // the turn is still read -- the lattice is built from the recompute either
    // way -- but it is not counted as checked.
    const live = stamp ? tutorStubReplyFeatureAttributes(stamp).sort() : null;
    const comparable = stamp && norm(reply) === norm(shipped);
    if (comparable) {
      const recomputed = tutorStubReplyFeatureAttributes(
        describeTutorStubReplyFeatures(reply, { learnerText: learner }),
      ).sort();
      if (String(live) !== String(recomputed))
        mismatches.push(`${dialogue} t${turn}: live stamp {${live}} vs recompute {${recomputed}}`);
      else stampChecked += 1;
    }

    const manner = at('tutor_manner_switch', turn);
    const quiet = at('tutor_quiet_detect', turn);
    const pressure = manner?.pressure ?? null;
    const state =
      pressure && pressure !== 'neutral' && pressure !== 'concession'
        ? pressure
        : quiet?.quietType
          ? `quiet:${quiet.quietType}`
          : (pressure ?? 'unknown');
    const dose = manner?.dose ?? null;
    const cardsVersion = manner?.cardsVersion || null;

    objects.push({
      id: `fresh:${dialogue}:t${turn}`,
      file: 'fresh',
      figure: force.forced,
      state,
      entry: 'forced',
      dose,
      licence: (typeof cardsVersion === 'string' && cardsVersion.includes('licence')) || (dose !== null && dose >= 3),
      world,
      tag: null,
      hit: false,
      ruled: null,
      ruledOverride: null,
      reply,
      learner,
      liveStampAttributes: live,
      // How this turn's text got to the learner, recorded per object so the
      // draft reading can say what share of it the guard never let through.
      shippedAs: complete.turnRecord?.tutorDeterministicFallback
        ? 'template'
        : norm(shipped) === norm(draft)
          ? 'draft'
          : 'rewrite',
    });
  }
  return {
    objects,
    dropped,
    mismatches,
    stampChecked,
    turns: events.filter((e) => e.type === 'turn_complete').length,
  };
}

// The baseline, built from THIS corpus rather than borrowed from another one.
// Permute the figure labels among these same objects and re-run the closure
// analysis: size, class balance and the whole attribute distribution stay
// fixed, and only the link between figure and text is destroyed. That is
// exactly "how many would separate if the figures carried nothing?", and
// unlike a bar lifted from the calibration corpus it needs no matching on
// size, figure count or column set.
function permutationBar(objects, opts, observed, trials, seed) {
  const rand = mulberry32(seed);
  const counts = [];
  for (let t = 0; t < trials; t += 1) {
    const labels = objects.map((o) => o.figure);
    for (let i = labels.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [labels[i], labels[j]] = [labels[j], labels[i]];
    }
    const permuted = objects.map((o, i) => ({ ...o, figure: labels[i] }));
    counts.push(analyze(buildContext(permuted, opts), 'permuted').separatedCount);
  }
  const mean = counts.reduce((s, x) => s + x, 0) / trials;
  const atLeast = counts.filter((c) => c >= observed).length / trials;
  const max = Math.max(...counts);
  return { trials, mean, atLeast, max, observed };
}

// Share of null trials reaching at least `k` separated, at the closest size the
// control was run at. Returns null when the control has nothing at that size.
//
// The null is built over all seven figures. A corpus missing some of them is a
// different problem -- with fewer figures there are fewer foreign turns to
// collide with, so separation comes cheaper and the seven-figure percentage
// understates chance. Refuse the comparison rather than print a bar that does
// not apply; a wrong percentage here is worse than none, because it is the
// number that would get quoted.
function nullBar(nullReport, readingKey, perFigure, k, figureCount, nullFigureCount) {
  if (figureCount !== nullFigureCount) return { mismatch: { figureCount, nullFigureCount } };
  const sizes = nullReport?.readings?.[readingKey]?.sizes;
  if (!sizes) return null;
  const available = Object.keys(sizes)
    .map(Number)
    .sort((a, b) => a - b);
  if (!available.length) return null;
  const nearest = available.reduce((best, n) => (Math.abs(n - perFigure) < Math.abs(best - perFigure) ? n : best));
  const row = sizes[nearest];
  // The SHUFFLED arm, not the intact one. The intact arm keeps every turn
  // attached to its real figure, so it already carries whatever signal exists
  // and reading it as chance sets the bar far too high -- it would call a real
  // effect unremarkable. The shuffled arm randomises the labels at the same
  // size and class balance, which is the actual "if the figures carried
  // nothing" comparison.
  return {
    sizeUsed: nearest,
    exact: nearest === perFigure,
    atLeast: row.shuffled?.atLeast?.[k] ?? null,
    mean: row.shuffled?.mean ?? null,
    intactMean: row.mean,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = walk(args.traces);
  if (!files.length) {
    console.error(`no traces under ${args.traces} — nothing to read.`);
    process.exit(1);
  }

  const objects = [];
  const dropped = { template: [], incomplete: [], noStamp: [], noDraft: [] };
  const mismatches = [];
  let turnsTotal = 0;
  let stampChecked = 0;
  for (const f of files.sort()) {
    const r = readDialogue(f, args.source);
    objects.push(...r.objects);
    for (const k of Object.keys(dropped)) dropped[k].push(...r.dropped[k]);
    mismatches.push(...r.mismatches);
    stampChecked += r.stampChecked;
    turnsTotal += r.turns;
  }

  const isDraft = args.source === 'draft';
  console.log(`fresh corpus: ${files.length} dialogues, ${turnsTotal} completed turns`);
  console.log(
    isDraft
      ? "reading the TUTOR'S OWN FIRST DRAFT, before the guard accepted, rewrote or replaced it"
      : 'reading the text that SHIPPED to the learner',
  );
  console.log(`carded turns kept: ${objects.length}`);
  if (isDraft) {
    console.log(`  dropped, no draft in the trace:      ${dropped.noDraft.length}`);
  } else {
    console.log(`  dropped, guard shipped the template: ${dropped.template.length}`);
    console.log(`  dropped, no live stamp:              ${dropped.noStamp.length}`);
    if (dropped.template.length) console.log(`    template turns: ${dropped.template.join(', ')}`);
  }
  console.log(`  dropped, turn never completed:       ${dropped.incomplete.length}`);

  if (mismatches.length) {
    console.error('\nLIVE STAMP DISAGREES WITH RECOMPUTE — stopping before any reading:');
    mismatches.forEach((m) => console.error('  ' + m));
    process.exit(1);
  }
  console.log(`live stamp matches recompute on ${stampChecked} of ${objects.length} kept turns`);

  if (isDraft) {
    const fate = objects.reduce((m, o) => ({ ...m, [o.shippedAs]: (m[o.shippedAs] || 0) + 1 }), {});
    console.log(
      `what became of these drafts: ${fate.draft || 0} shipped as written, ` +
        `${fate.rewrite || 0} shipped after a plain rewrite, ${fate.template || 0} replaced by the canned template`,
    );
  }

  const byFigure = new Map();
  for (const o of objects) byFigure.set(o.figure, (byFigure.get(o.figure) || 0) + 1);

  // Dropping the template turns is not a neutral filter. The guard demands the
  // tutor perform the selected part and render the due source word for word --
  // demands about the very performance the reply stamp measures. If some
  // figures fail those demands more than others, the surviving corpus is
  // unbalanced across figures, and an unbalanced corpus separates differently
  // from the balanced one the Latin square was built to produce. So the loss
  // gets reported per figure, not summed away.
  const forcedByFigure = new Map();
  for (const list of Object.values(dropped))
    for (const s of list) {
      const g = s.match(/\(([^)]+)\)$/)?.[1];
      if (g) forcedByFigure.set(g, (forcedByFigure.get(g) || 0) + 1);
    }
  const allFigures = [...new Set([...byFigure.keys(), ...forcedByFigure.keys()])].sort();
  console.log(`\nper figure — kept vs lost (${allFigures.length} of 7 figures played):`);
  for (const f of allFigures) {
    const kept = byFigure.get(f) || 0;
    const lost = forcedByFigure.get(f) || 0;
    const share = kept + lost ? `${Math.round((lost / (kept + lost)) * 100)}% lost` : '';
    console.log(`  ${f.padEnd(16)} kept ${String(kept).padStart(2)}, lost ${String(lost).padStart(2)}  ${share}`);
  }
  const figures = [...byFigure.keys()].sort();
  const perFigure = objects.length / figures.length;
  console.log(`mean turns per figure among those kept: ${perFigure.toFixed(2)}`);
  const zeroed = allFigures.filter((f) => !byFigure.has(f));
  if (zeroed.length) console.log(`figures the guard removed entirely: ${zeroed.join(', ')}`);

  const readings = [
    {
      key: 'C',
      label: 'trace columns (no coder tag/hit) + live reply stamp',
      opts: { withCard: false, withRuled: false, withReply: true, withCoded: false },
    },
    {
      key: 'ConlyReply',
      label: 'live reply stamp alone',
      opts: { withCard: false, withRuled: false, withReply: true, replyOnly: true },
    },
    {
      key: 'sanity',
      label: 'SANITY: with card identity (must separate everything)',
      opts: { withCard: true, withRuled: false, withReply: true, withCoded: false },
    },
  ];

  // Prefer a bar built over exactly the figures this corpus kept. The generic
  // seven-figure file is only right when all seven survived.
  const matched = args.nullFile.replace(/\.json$/, `-${figures.length}fig.json`);
  const chosen = figures.length !== 7 && fs.existsSync(matched) ? matched : args.nullFile;
  let nullReport = null;
  if (fs.existsSync(chosen)) nullReport = JSON.parse(fs.readFileSync(chosen, 'utf8'));
  else console.log(`\n(no bar at ${chosen} — run analyze-figure-lattice-control.js --no-coded first)`);

  const runs = {};
  for (const r of readings) {
    const run = analyze(buildContext(objects, r.opts), r.label);
    runs[r.key] = run;
    console.log(`\n=== ${r.label} ===`);
    console.log(
      `objects ${run.objects}, attributes ${run.attributes}, concepts ${run.conceptCount}, separated ${run.separatedCount}/${Object.keys(run.figures).length}`,
    );
    for (const [f, x] of Object.entries(run.figures)) {
      const conf = Object.entries(x.confusion)
        .map(([g, n]) => `${g}:${n}`)
        .join(' ');
      console.log(`  ${f} (${x.turns} turns): ${x.separated ? 'SEPARATED' : 'MERGES -> ' + conf}`);
      if (x.separated && x.minimalDistinguishers?.sets?.length)
        console.log(
          `    minimal distinguishers (size ${x.minimalDistinguishers.size}): ${x.minimalDistinguishers.sets
            .map((s) => '{' + s.join(', ') + '}')
            .join(' | ')}`,
        );
    }
    if (r.key === 'sanity') continue;

    // The within-corpus permutation is the primary bar: it needs no matching
    // and cannot be applied to the wrong corpus. The borrowed one is printed
    // after it as a cross-check where it happens to apply.
    const perm = permutationBar(objects, r.opts, run.separatedCount, args.trials, args.seed + r.key.length);
    run.permutationBar = perm;
    console.log(
      `  baseline from these same turns (${perm.trials} label shuffles): separates ${perm.mean.toFixed(2)} on average, ` +
        `most ever ${perm.max}; p(chance reaches ${run.separatedCount}) = ${(perm.atLeast * 100).toFixed(1)}%`,
    );
    console.log(
      perm.atLeast > 0.05 ? '  READING: this corpus does not beat chance.' : '  READING: this corpus beats chance.',
    );

    const nullFigures = Object.keys(nullReport?.corpus?.figures || {}).length;
    const bar = nullBar(nullReport, r.key, Math.round(perFigure), run.separatedCount, figures.length, nullFigures);
    if (bar?.mismatch) {
      console.log(
        `  NO BAR: this corpus has ${bar.mismatch.figureCount} figures, the null has ${bar.mismatch.nullFigureCount}. ` +
          'Separated counts over different numbers of figures are not comparable — the count is unreadable.',
      );
    } else if (bar) {
      const pct = bar.atLeast === null ? 'n/a' : `${(bar.atLeast * 100).toFixed(1)}%`;
      console.log(
        `  bar at ${bar.sizeUsed} turns/figure${bar.exact ? '' : ' (nearest size run)'}: label-shuffled separates ${bar.mean.toFixed(2)} on average ` +
          `(the same corpus intact, ${bar.intactMean.toFixed(2)}); p(shuffled reaches ${run.separatedCount}) = ${pct}`,
      );
      if (bar.atLeast !== null)
        console.log(
          bar.atLeast > 0.05
            ? '  READING: this corpus does not beat a label shuffle.'
            : '  READING: this corpus beats a label shuffle.',
        );
    }
  }

  const report = {
    generated: `figure-lattice fresh-corpus reading, ${isDraft ? 'tutor first draft' : 'text shipped to the learner'} (workplan card: reply-feature-stamps)`,
    source: args.source,
    tracesRoot: path.relative(ROOT, args.traces),
    nullUsed: nullReport ? path.relative(ROOT, chosen) : null,
    caveats: [
      'Separation is size-dependent; read separatedCount only against a size-matched bar.',
      'Coder tag/hit columns are absent, so this is not directly comparable to runs B/C of the falsifier.',
      'The state column is derived from live trace events here and from the audit exports in the calibration reading. The two vocabularies were never reconciled, so these objects must not be pooled with the calibration corpus into one context.',
      isDraft
        ? 'These are the tutor\'s own first attempts, not what any learner read: 13 of them were replaced by the canned template before delivery. So this answers "can the tutor make seven different moves?" and NOT "did learners meet seven different things?".'
        : 'Turns where the guard ladder shipped the deterministic template are excluded by construction.',
      isDraft
        ? 'The live stamp is over the shipped text, so the stamp-vs-recompute check only applies where the draft is what shipped. The lattice is built from a fresh recompute over the draft either way.'
        : 'The borrowed bar draws the same number of turns for every figure; this corpus is uneven and contains a singleton figure. A singleton separates almost for free, so that bar is if anything generous to the observed count, not strict against it.',
      'The permutation bar is built from these same turns: figure labels are shuffled among them, holding size, class balance and the whole attribute distribution fixed. Only the link between figure and text is destroyed.',
      'The guard policy for this corpus was shadow_advisory, so kept turns include text the strict policy would have vetoed.',
    ],
    corpus: {
      dialogues: files.length,
      completedTurns: turnsTotal,
      cardedTurnsKept: objects.length,
      perFigure: Object.fromEntries(figures.map((f) => [f, byFigure.get(f)])),
      // What the guard did with each kept draft. Only meaningful on the draft
      // reading; on the shipped reading every kept turn is 'draft' or 'rewrite'
      // because the template turns were dropped.
      shippedAs: objects.reduce((m, o) => ({ ...m, [o.shippedAs]: (m[o.shippedAs] || 0) + 1 }), {}),
      stampChecked,
      dropped,
    },
    runs,
    objects: objects.map(({ reply, learner, ...o }) => ({
      ...o,
      replyChars: reply.length,
      learnerChars: learner.length,
    })),
  };
  const out = `figure-lattice-${isDraft ? 'draft' : 'fresh'}.json`;
  fs.writeFileSync(path.join(CE, out), JSON.stringify(report, null, 1) + '\n');
  console.log(`\nwrote exports/crossed-effects/${out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
