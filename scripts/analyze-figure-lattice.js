#!/usr/bin/env node
/**
 * Figure-lattice falsifier (workplan card: figure-lattice-falsifier).
 *
 * The free test registered in paper §7.13 "Refinements under critique" and
 * notes/2026-08-06-pedagogical-figure-ontology.md (amendment 2): treat the
 * recorded carded turns as objects and the stamped features as attributes;
 * the proven figures should surface as well-separated concepts in the
 * resulting concept lattice, or the ontology is decoration.
 *
 * Pure computation: reads the per-row audit exports under
 * exports/crossed-effects/ and the run traces under
 * exports/tutor-stub-outcome/. No model calls, no DB access, no writes
 * outside exports/crossed-effects/.
 *
 * Runs (frozen on the card before computation):
 *   A  — sanity, WITH card identity as an attribute (must separate trivially)
 *   B  — the real test, WITHOUT card identity (124 delivery-verified turns)
 *   B' — subset run adding ruled/ruledOverride on the rows that stamp them
 *
 * Run C was added afterwards (card: reply-feature-stamps) and is NOT part of
 * the frozen design: it re-runs B with the performed-figure attributes that
 * B's 0/7 said were missing. A, B and B' are untouched and must reproduce
 * their recorded numbers exactly — the script asserts that before reading C.
 * C is calibration, not a clean test: the act patterns were widened after
 * reading three replies from this same corpus with their card labels visible.
 * The clean test is fresh turns carrying the live stamp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describeTutorStubReplyFeatures, tutorStubReplyFeatureAttributes } from '../services/tutorStubReplyFeatures.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CE = path.join(ROOT, 'exports', 'crossed-effects');
const TRACES = path.join(ROOT, 'exports', 'tutor-stub-outcome');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ---------------------------------------------------------------------------
// Trace access: one .jsonl per arm dir; cache parsed per-turn card events.
// ---------------------------------------------------------------------------
const traceCache = new Map();
function traceEvents(dir) {
  if (traceCache.has(dir)) return traceCache.get(dir);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  if (files.length !== 1) throw new Error(`expected exactly one .jsonl in ${dir}, found ${files.length}`);
  const events = fs
    .readFileSync(path.join(dir, files[0]), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
    .filter((e) => ['tutor_card_force', 'tutor_manner_switch', 'tutor_quiet_detect'].includes(e.type));
  traceCache.set(dir, events);
  return events;
}

// Read the card situation at one target turn from the trace: how the card
// entered (forced vs detected), whether one was active, which card, the
// stamped dose, and the cards edition (licence detection).
function turnCardRecord(dir, turn) {
  const evs = traceEvents(dir).filter((e) => e.turn === turn);
  const force = evs.find((e) => e.type === 'tutor_card_force');
  const manner = evs.find((e) => e.type === 'tutor_manner_switch');
  const quiet = evs.find((e) => e.type === 'tutor_quiet_detect');
  if (!manner) throw new Error(`no tutor_manner_switch at turn ${turn} in ${dir}`);
  let card = null;
  let entry = null;
  let delivered = false;
  if (force) {
    entry = 'forced';
    delivered = Boolean(force.cardActive);
    card = force.forced === 'none' ? null : force.forced;
  } else {
    entry = 'detected';
    // The manner_switch event is appended last, so its cardActive reflects
    // the final card — which is the pressure card when the cascade fired,
    // else the typed quiet card (the quiet detector only runs card-silent).
    if (manner.cardActive) {
      delivered = true;
      card =
        manner.pressure !== 'neutral' && manner.pressure !== 'concession'
          ? manner.pressure
          : quiet && quiet.quietType
            ? `quiet:${quiet.quietType}`
            : null;
    }
  }
  const dose = manner.dose ?? null;
  const cardsVersion = manner.cardsVersion || null;
  const licence =
    (typeof cardsVersion === 'string' && cardsVersion.includes('licence')) || (dose !== null && dose >= 3);
  return { entry, delivered, card, dose, licence, cardsVersion };
}

// ---------------------------------------------------------------------------
// Objects: the recorded carded target turns of the four audit exports.
// ---------------------------------------------------------------------------
export function buildObjects() {
  const objects = [];
  const checks = { conductDelivered: 0, conductTotal: 0, mismatches: [], nonFigureCarded: [] };

  // Crossed run (states settled_claim + stake; five policies; both worlds).
  for (const r of readJson(path.join(CE, 'conduct-tags.json'))) {
    const dir = path.join(TRACES, 'crossed-k3', 'traces', r.world, `${r.policy}-d${r.k}`);
    const t = turnCardRecord(dir, r.turn);
    checks.conductTotal += 1;
    if (t.delivered) checks.conductDelivered += 1;
    if (r.forcedCard && (t.entry !== 'forced' || t.card !== r.forcedCard))
      checks.mismatches.push(
        `conduct ${r.world}/${r.policy}-d${r.k} t${r.turn}: forcedCard ${r.forcedCard} vs trace ${t.entry}/${t.card}`,
      );
    if (!r.forcedCard && t.entry !== 'detected')
      checks.mismatches.push(`conduct ${r.world}/${r.policy}-d${r.k} t${r.turn}: router row but trace says ${t.entry}`);
    if (!t.delivered) continue; // the known sensing miss drops here
    if (!r.forcedCard && t.card && t.card.startsWith('quiet:')) {
      // Card-amendment case (2026-08-07): the typed quiet detector carded a
      // fusion the cascade read neutral — the pre-registered S2 floor's
      // second route. Not one of the seven figures; excluded and reported.
      checks.nonFigureCarded.push(`conduct ${r.world}/${r.policy}-d${r.k} t${r.turn}: ${t.card} at state ${r.state}`);
      continue;
    }
    if (!r.forcedCard && t.card !== r.state)
      checks.mismatches.push(
        `conduct ${r.world}/${r.policy}-d${r.k} t${r.turn}: detected card ${t.card} vs state ${r.state}`,
      );
    objects.push({
      id: `conduct:${r.world}:${r.policy}:k${r.k}:t${r.turn}`,
      file: 'conduct',
      figure: t.card,
      state: r.state,
      entry: t.entry,
      dose: t.dose,
      licence: t.licence,
      world: r.world.includes('030') ? '030' : '033',
      tag: r.tag,
      hit: Boolean(r.hit),
      ruled: typeof r.ruled === 'boolean' ? r.ruled : null,
      ruledOverride: typeof r.ruledOverride === 'boolean' ? r.ruledOverride : null,
      reply: r.reply || null,
      learner: r.learner || null,
    });
  }

  // Repertoire run (demand/mockery/lost/grievance; right vs deranged wrong).
  for (const r of readJson(path.join(CE, 'repertoire-tags.json'))) {
    const dir = path.join(TRACES, 'repertoire-k3', 'traces', r.world, `${r.arm}-d${r.k}`);
    const t = turnCardRecord(dir, r.turn);
    if (t.entry !== 'forced' || t.card !== r.forced)
      checks.mismatches.push(
        `repertoire ${r.world}/${r.arm}-d${r.k} t${r.turn}: forced ${r.forced} vs trace ${t.entry}/${t.card}`,
      );
    if (!r.delivered || !t.delivered)
      checks.mismatches.push(`repertoire ${r.world}/${r.arm}-d${r.k} t${r.turn}: undelivered`);
    objects.push({
      id: `repertoire:${r.world}:${r.arm}:k${r.k}:t${r.turn}`,
      file: 'repertoire',
      figure: t.card,
      state: r.state,
      entry: t.entry,
      dose: t.dose,
      licence: t.licence,
      world: r.world.includes('030') ? '030' : '033',
      tag: r.tag,
      hit: Boolean(r.hit),
      ruled: typeof r.ruled === 'boolean' ? r.ruled : null,
      ruledOverride: typeof r.ruledOverride === 'boolean' ? r.ruledOverride : null,
      reply: r.reply || null,
      learner: r.learner || null,
    });
  }

  // Lost-thread retest (demand card forced at the lost turn; state=lost by
  // the registered design — the rows carry only that turn).
  for (const r of readJson(path.join(CE, 'lostretest-tags.json'))) {
    const dir = path.join(TRACES, 'lostretest-k3', 'traces', r.world, r.d);
    const t = turnCardRecord(dir, r.turn);
    if (t.entry !== 'forced' || t.card !== r.forced)
      checks.mismatches.push(
        `lostretest ${r.world}/${r.d} t${r.turn}: forced ${r.forced} vs trace ${t.entry}/${t.card}`,
      );
    objects.push({
      id: `lostretest:${r.world}:${r.d}:t${r.turn}`,
      file: 'lostretest',
      figure: t.card,
      state: 'lost',
      entry: t.entry,
      dose: t.dose,
      licence: t.licence,
      world: r.world.includes('030') ? '030' : '033',
      tag: r.tag,
      hit: Boolean(r.hit),
      ruled: null,
      ruledOverride: null,
      reply: r.reply || null,
      learner: r.learner || null,
    });
  }

  // Flat/bored promotion (w033 t11 — the one ratified bored plant; right
  // forces quiet:flat, wrong forces settled_claim; state=flat by design).
  for (const r of readJson(path.join(CE, 'flatpromo-tags.json'))) {
    const dir = path.join(TRACES, 'flatpromo-k3', 'traces', 'world_033_alder_row_redoubt', r.d);
    const t = turnCardRecord(dir, 11);
    if (t.entry !== 'forced' || t.card !== r.forced)
      checks.mismatches.push(`flatpromo ${r.d} t11: forced ${r.forced} vs trace ${t.entry}/${t.card}`);
    objects.push({
      id: `flatpromo:${r.d}:t11`,
      file: 'flatpromo',
      figure: t.card,
      state: 'flat',
      entry: t.entry,
      dose: t.dose,
      licence: t.licence,
      world: '033',
      tag: r.tag,
      hit: Boolean(r.hit),
      ruled: null,
      ruledOverride: null,
      reply: r.reply || null,
      learner: r.learner || null,
    });
  }

  return { objects, checks };
}

// ---------------------------------------------------------------------------
// Formal context: object -> attribute set (one attribute per stamped value).
// ---------------------------------------------------------------------------
/**
 * The performed column the falsifier's 0/7 asked for (card:
 * reply-feature-stamps): what the reply DID, measured from the reply text by
 * the same pure module the live harness now stamps on every turn. Blind to
 * the card by construction — see services/tutorStubReplyFeatures.js.
 */
const replyAttributesOf = (o) =>
  tutorStubReplyFeatureAttributes(describeTutorStubReplyFeatures(o.reply, { learnerText: o.learner }));

// `withCoded` covers the two columns that come from the qualitative audit
// rather than the trace: the coder's tag and hit. A fresh corpus has no such
// coding, so a fresh reading must drop them — and any null distribution it is
// compared against must drop them too, or the comparison rewards the smaller
// attribute set rather than the ontology. Defaults true so runs A/B/B'/C are
// untouched.
function attributesOf(o, { withCard, withRuled, withReply, replyOnly, withCoded = true }) {
  const a = [];
  if (withCard) a.push(`card:${o.figure}`);
  if (withReply) a.push(...replyAttributesOf(o));
  // The performed column on its own. Worth its own run because the ordered
  // columns are what swallowed the corpus in B — if the reply features carry
  // any signal, adding B's columns can only hide it.
  if (replyOnly) return a;
  a.push(`state:${o.state}`);
  a.push(`entry:${o.entry}`);
  a.push(o.licence ? 'licence:present' : 'licence:absent');
  if (o.dose !== null) for (let d = 1; d <= o.dose; d += 1) a.push(`dose>=${d}`);
  a.push(`world:${o.world}`);
  if (withCoded) {
    a.push(`tag:${o.tag}`);
    a.push(o.hit ? 'hit' : 'no-hit');
  }
  if (withRuled) {
    a.push(o.ruled ? 'ruled' : 'unruled');
    a.push(o.ruledOverride ? 'override' : 'no-override');
  }
  return a;
}

export function buildContext(objects, opts) {
  const attrSet = new Set();
  const rows = objects.map((o) => {
    const attrs = attributesOf(o, opts);
    attrs.forEach((x) => attrSet.add(x));
    return { id: o.id, figure: o.figure, attrs: new Set(attrs) };
  });
  return { rows, attributes: [...attrSet].sort() };
}

const extentOf = (rows, attrs) => rows.filter((r) => attrs.every((a) => r.attrs.has(a)));

function intentOf(rows) {
  if (!rows.length) return [];
  let shared = [...rows[0].attrs];
  for (const r of rows.slice(1)) shared = shared.filter((a) => r.attrs.has(a));
  return shared;
}

// Count all formal concepts via closures of attribute sets (NextClosure).
function conceptCount(ctx) {
  const attrs = ctx.attributes;
  // closure(B) = intent(extent(B)); the empty extent closes to all attributes
  const closure = (set) => {
    const ext = extentOf(ctx.rows, [...set]);
    return new Set(ext.length ? intentOf(ext) : attrs);
  };
  const leq = (a, b, i) => {
    // b = closure result; lectic test at position i
    for (let j = 0; j < i; j += 1) {
      const x = attrs[j];
      if (a.has(x) !== b.has(x)) return false;
    }
    return b.has(attrs[i]) && !a.has(attrs[i]);
  };
  let current = closure(new Set());
  let count = 1;
  for (;;) {
    let next = null;
    for (let i = attrs.length - 1; i >= 0; i -= 1) {
      if (current.has(attrs[i])) continue;
      const candidate = new Set([...current].filter((x) => attrs.indexOf(x) < i));
      candidate.add(attrs[i]);
      const closed = closure(candidate);
      if (leq(current, closed, i)) {
        next = closed;
        break;
      }
    }
    if (!next) return count;
    count += 1;
    current = next;
  }
}

// All minimal subsets of intent whose extent excludes every other figure.
// Searched by increasing size; at the smallest working size every hit is
// minimal. Falls back to a greedy cover if nothing works at size <= 3.
function minimalDistinguishers(ctx, intent, ownFigure) {
  const foreign = ctx.rows.filter((r) => r.figure !== ownFigure);
  const excludesAll = (subset) => !foreign.some((r) => subset.every((a) => r.attrs.has(a)));
  const combos = (arr, k, start = 0, acc = []) =>
    k === 0 ? [acc] : arr.slice(start).flatMap((_, i) => combos(arr, k - 1, start + i + 1, [...acc, arr[start + i]]));
  for (let k = 1; k <= Math.min(3, intent.length); k += 1) {
    const found = combos(intent, k).filter(excludesAll);
    if (found.length) return { size: k, sets: found };
  }
  // greedy: repeatedly add the attribute killing the most surviving foreigners
  let survivors = foreign;
  const chosen = [];
  let pool = [...intent];
  while (survivors.length && pool.length) {
    let best = null;
    let bestLeft = Infinity;
    for (const a of pool) {
      const left = survivors.filter((r) => r.attrs.has(a)).length;
      if (left < bestLeft) {
        bestLeft = left;
        best = a;
      }
    }
    chosen.push(best);
    survivors = survivors.filter((r) => r.attrs.has(best));
    pool = pool.filter((a) => a !== best);
  }
  return survivors.length ? { size: null, sets: [] } : { size: chosen.length, sets: [chosen] };
}

export function analyze(ctx, label) {
  const figures = [...new Set(ctx.rows.map((r) => r.figure))].sort();
  const out = { label, objects: ctx.rows.length, attributes: ctx.attributes.length, figures: {}, confusion: {} };
  for (const f of figures) {
    const own = ctx.rows.filter((r) => r.figure === f);
    const intent = intentOf(own).sort();
    const closureExtent = extentOf(ctx.rows, intent);
    const confusion = {};
    for (const g of figures) {
      if (g === f) continue;
      const n = closureExtent.filter((r) => r.figure === g).length;
      if (n) confusion[g] = n;
    }
    const separated = Object.keys(confusion).length === 0;
    out.figures[f] = {
      turns: own.length,
      intent,
      closureExtentSize: closureExtent.length,
      separated,
      confusion,
      minimalDistinguishers: separated ? minimalDistinguishers(ctx, intent, f) : null,
    };
    out.confusion[f] = confusion;
  }
  out.conceptCount = conceptCount(ctx);
  out.separatedCount = Object.values(out.figures).filter((x) => x.separated).length;
  return out;
}

// ---------------------------------------------------------------------------
function main() {
  const { objects, checks } = buildObjects();

  console.log(`objects (delivery-verified figure-carded turns): ${objects.length}`);
  console.log(`crossed delivery: ${checks.conductDelivered}/${checks.conductTotal}`);
  if (checks.nonFigureCarded.length)
    console.log(`excluded non-figure carded turns: ${checks.nonFigureCarded.join('; ')}`);
  if (checks.mismatches.length) {
    console.error('CONSISTENCY MISMATCHES — stopping before any reading:');
    checks.mismatches.forEach((m) => console.error('  ' + m));
    process.exit(1);
  }
  if (checks.conductDelivered !== 59 || checks.conductTotal !== 60) {
    console.error(
      `crossed delivery ${checks.conductDelivered}/${checks.conductTotal} does not reproduce the recorded 59/60 — stopping.`,
    );
    process.exit(1);
  }

  const runA = analyze(buildContext(objects, { withCard: true, withRuled: false }), 'A: sanity, WITH card identity');
  const runB = analyze(
    buildContext(objects, { withCard: false, withRuled: false }),
    'B: real test, WITHOUT card identity',
  );
  const ruledObjects = objects.filter((o) => o.ruled !== null);
  const runB2 = analyze(
    buildContext(ruledObjects, { withCard: false, withRuled: true }),
    `B': stamped-ruled subset (${ruledObjects.length} rows), WITHOUT card identity`,
  );

  // The frozen runs must land where the card recorded them. If a later edit
  // moves them, run C is being read against a changed baseline and the
  // comparison is worthless — so stop instead.
  // objects, attributes, concepts, separated — as recorded on the card and in
  // the artifact of 2026-08-07.
  const recorded = { A: [122, 36, 611, 7], B: [122, 29, 372, 0], Bruled: [106, 32, 695, 0] };
  for (const [label, run] of [
    ['A', runA],
    ['B', runB],
    ['Bruled', runB2],
  ]) {
    const got = [run.objects, run.attributes, run.conceptCount, run.separatedCount];
    if (String(got) !== String(recorded[label])) {
      console.error(
        `run ${label} no longer reproduces the recorded result (objects/attributes/concepts/separated ${got} vs ${recorded[label]}) — stopping.`,
      );
      process.exit(1);
    }
  }

  // Run C (card: reply-feature-stamps). B plus the performed column.
  const withReplyText = objects.filter((o) => o.reply);
  const runC = analyze(
    buildContext(withReplyText, { withCard: false, withRuled: false, withReply: true }),
    `C: B plus performed-reply features (${withReplyText.length} rows with reply text), WITHOUT card identity`,
  );
  const runCOnly = analyze(
    buildContext(withReplyText, { withCard: false, withRuled: false, withReply: true, replyOnly: true }),
    `C': performed-reply features ALONE (${withReplyText.length} rows)`,
  );

  const doseDist = {};
  const licenceCount = objects.filter((o) => o.licence).length;
  objects.forEach((o) => {
    const k = o.dose === null ? 'none' : String(o.dose);
    doseDist[k] = (doseDist[k] || 0) + 1;
  });

  // How often each performed attribute fires, so a dead column (the failure
  // that made the stamped dose useless in B) is visible rather than inferred.
  const replyRealization = {};
  withReplyText.forEach((o) => {
    replyAttributesOf(o).forEach((a) => {
      replyRealization[a] = (replyRealization[a] || 0) + 1;
    });
  });

  const report = {
    generated: 'figure-lattice-falsifier (workplan card of the same name)',
    inputs: {
      audits: ['conduct-tags.json', 'repertoire-tags.json', 'lostretest-tags.json', 'flatpromo-tags.json'],
      traces: ['crossed-k3', 'repertoire-k3', 'lostretest-k3', 'flatpromo-k3'],
    },
    checks: { crossedDelivery: `${checks.conductDelivered}/${checks.conductTotal}`, mismatches: checks.mismatches },
    attributeRealization: {
      doseDistribution: doseDist,
      licencePresentTurns: licenceCount,
      replyAttributeTurns: replyRealization,
    },
    runs: { A: runA, B: runB, Bruled: runB2, C: runC, ConlyReply: runCOnly },
    // Raw reply and learner text stay out of the artifact — they are already
    // in the audit exports, and the derived attributes are what a reader
    // checks. `replyAttributes` is what run C actually saw for each turn.
    objects: objects.map(({ reply, learner, ...o }) => ({
      ...o,
      replyChars: reply ? reply.length : 0,
      learnerChars: learner ? learner.length : 0,
      replyAttributes: reply ? replyAttributesOf({ reply, learner }) : null,
    })),
  };
  fs.writeFileSync(path.join(CE, 'figure-lattice-falsifier.json'), JSON.stringify(report, null, 1) + '\n');

  for (const run of [runA, runB, runB2, runC, runCOnly]) {
    console.log(`\n=== ${run.label} ===`);
    console.log(
      `objects ${run.objects}, attributes ${run.attributes}, concepts ${run.conceptCount}, separated ${run.separatedCount}/${Object.keys(run.figures).length}`,
    );
    for (const [f, r] of Object.entries(run.figures)) {
      const conf = Object.entries(r.confusion)
        .map(([g, n]) => `${g}:${n}`)
        .join(' ');
      console.log(`  ${f} (${r.turns} turns): ${r.separated ? 'SEPARATED' : 'MERGES -> ' + conf}`);
      if (r.separated && r.minimalDistinguishers?.sets?.length)
        console.log(
          `    minimal distinguishers (size ${r.minimalDistinguishers.size}): ${r.minimalDistinguishers.sets.map((s) => '{' + s.join(', ') + '}').join(' | ')}`,
        );
      else if (!r.separated) console.log(`    shared intent: {${r.intent.join(', ')}}`);
    }
  }
  console.log(`\nwrote exports/crossed-effects/figure-lattice-falsifier.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
