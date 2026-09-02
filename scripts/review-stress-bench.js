/**
 * Plant-by-plant review sheet and summary rows for stress-bench runs. Read-only.
 *
 * Consolidates the inline markdown builder written three times during the
 * 2026-07/08 stress-bench arc: for every planted turn in every trace under
 * the given roots, show the learner's realized line, the tutor's delivered
 * reply, the adjudicated gold, whether the manner switch had a card active,
 * and whether the delivery came from the model or a template. This sheet is
 * the human-adjudication surface the bench's claim gate depends on.
 *
 * Step 3 of card state-detection-without-word-lists (2026-09-01): the sheet
 * now opens with summary rows that keep the bench's three questions apart,
 * as the schedule headers already require ("trigger detection is scored
 * separately from repair delivery"):
 *
 *   detection  — did the detector read the planted kind at the planted turn?
 *   card       — was a card active there, and how did it enter (forced by the
 *                launcher's TUTOR_STUB_CARD_FORCE, or detected live)?
 *   reply      — did the model ship the reply, or did a template?
 *   repair     — was the reply the right repair? Ruled by the author from the
 *                sheet; never computed here (no self-judging).
 *
 * A forced-card arm scores 0 on nothing: its detection row still reports what
 * the detector read, because the switch event records the read before the
 * force block replaces the card. So the same sheet serves the router arm and
 * the forced arm, and the two rows say which thing each arm tests.
 *
 * Usage:
 *   node scripts/review-stress-bench.js <traceDirOrParent> [more...] \
 *     [--out exports/tutor-stub-outcome/stress-review.md] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_PLANT_STATE_TO_PRESSURE,
  TUTOR_STUB_PLANT_STATE_TO_QUIET,
} from '../services/tutorStubMannerSwitch.js';

const CALM_READS = new Set(['neutral', 'concession', null, undefined, '']);

export function findStressTraces(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      // statSync follows symlinks, so an arm assembled from linked dialogue dirs reads too.
      let isDir = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        try {
          isDir = fs.statSync(full).isDirectory();
        } catch {
          continue;
        }
      }
      if (isDir) stack.push(full);
      else if (entry.name.endsWith('.jsonl') && !entry.name.includes('summary')) out.push(full);
    }
  }
  return out.sort();
}

/** The card a plant calls for, spelled as the trace spells cards. */
export function expectedCardForState(state) {
  if (TUTOR_STUB_PLANT_STATE_TO_PRESSURE[state]) return TUTOR_STUB_PLANT_STATE_TO_PRESSURE[state];
  if (TUTOR_STUB_PLANT_STATE_TO_QUIET[state]) return `quiet:${TUTOR_STUB_PLANT_STATE_TO_QUIET[state]}`;
  return null;
}

/**
 * One trace → its plants, each with the four readings. Returns null when the
 * trace carries no plants (not a bench run).
 */
export function reviewStressTrace(tracePath, { labelRoot = process.cwd() } = {}) {
  const lines = fs.readFileSync(tracePath, 'utf8').split('\n').filter(Boolean);
  const ev = lines.map((line) => JSON.parse(line));
  const plantEvents = ev.filter((e) => e.type === 'learner_stress_plant');
  if (!plantEvents.length) return null;
  const worldLine = lines.find((line) => line.includes('"worldId"'));
  const world = worldLine ? (worldLine.match(/"worldId":"([^"]+)"/) || [])[1] || null : null;
  const turns = Object.fromEntries(
    ev.filter((e) => e.type === 'turn_complete').map((e) => [e.turn, e.turnRecord || {}]),
  );
  const byTurn = (type) => Object.fromEntries(ev.filter((e) => e.type === type).map((e) => [e.turn, e]));
  const switches = byTurn('tutor_manner_switch');
  const quiets = byTurn('tutor_quiet_detect');
  const forces = byTurn('tutor_card_force');
  const outcomes = byTurn('tutor_response_guard_accounting');
  const closed = ev.some((e) => e.type === 'dialogue_closure_transition');

  const plants = plantEvents.map((plant) => {
    const turn = plant.turn;
    const expectedCard = expectedCardForState(plant.state);
    const isQuiet = Boolean(TUTOR_STUB_PLANT_STATE_TO_QUIET[plant.state]);
    const sw = switches[turn] || null;
    const read = sw ? sw.pressure || 'neutral' : null;
    const quietRead = quiets[turn]?.quietType || null;
    const readCard = !CALM_READS.has(read) ? read : quietRead ? `quiet:${quietRead}` : null;
    const fired = readCard !== null;
    const detectedRight = expectedCard !== null && readCard === expectedCard;
    const wrongFire = fired && !detectedRight;

    const force = forces[turn] || null;
    const withheld = Boolean(force && force.withheld);
    let entry = 'none';
    let card = null;
    if (force && !withheld) {
      entry = 'forced';
      card = force.forced === 'none' ? null : force.forced;
    } else if (sw?.cardActive) {
      entry = 'detected';
      card = readCard || 'quiet:check';
    }
    const cardActive = card !== null;
    const outcome = outcomes[turn]?.accounting?.outcome || null;
    const replyModel = outcome !== null && !/deterministic_fallback/.test(outcome);
    const rec = turns[turn] || {};
    return {
      turn,
      state: plant.state,
      quietState: isQuiet,
      gold: plant.rightRepair,
      alsoRight: plant.alsoRight || null,
      expectedCard,
      read,
      quietRead,
      detectedRight,
      wrongFire,
      entry,
      withheld,
      card,
      cardActive,
      cardRight: cardActive && card === expectedCard,
      outcome,
      replyModel,
      learner: String(rec.learner || ''),
      tutor: String(rec.tutor || ''),
    };
  });
  return {
    tracePath,
    label: path.relative(labelRoot, path.dirname(tracePath)) || path.basename(path.dirname(tracePath)),
    world,
    scheduleId: plantEvents[0].scheduleId || null,
    turnCount: Object.keys(turns).length,
    closed,
    plants,
  };
}

function tally(plants) {
  const scored = plants.filter((p) => p.expectedCard !== null);
  const count = (pred) => scored.filter(pred).length;
  return {
    plants: plants.length,
    scored: scored.length,
    detectedRight: count((p) => p.detectedRight),
    wrongFire: count((p) => p.wrongFire),
    quietWrongFire: count((p) => p.quietState && p.wrongFire),
    cardActive: count((p) => p.cardActive),
    cardForced: count((p) => p.entry === 'forced' && p.cardActive),
    cardDetected: count((p) => p.entry === 'detected'),
    forcedWithheld: count((p) => p.withheld),
    cardRight: count((p) => p.cardRight),
    replyModel: count((p) => p.replyModel),
    replyTemplate: count((p) => p.outcome !== null && !p.replyModel),
  };
}

export function summarizeStressReviews(reviews) {
  return {
    traces: reviews.length,
    pooled: tally(reviews.flatMap((r) => r.plants)),
    perTrace: reviews.map((r) => ({ label: r.label, world: r.world, scheduleId: r.scheduleId, ...tally(r.plants) })),
  };
}

function frac(n, d) {
  return `${n}/${d}`;
}

export function renderStressReviewMarkdown(reviews, summary) {
  const md = ['# Stress-bench review — plant-by-plant'];
  const t = summary.pooled;
  md.push(
    '',
    `## Summary rows — ${summary.traces} planted runs, ${t.plants} plants (${t.scored} with a card to expect)`,
    '',
  );
  md.push('Detection, card, reply and repair are four questions. The rows keep them apart.', '');
  md.push('| Row | Pooled | What it answers |');
  md.push('|---|---|---|');
  md.push(
    `| Detection recall | ${frac(t.detectedRight, t.scored)} | the detector read the planted kind at the planted turn (the switch records its read even when a card was forced) |`,
  );
  md.push(
    `| Detection wrong-kind fires | ${frac(t.wrongFire, t.scored)} | it fired, but not the planted kind (${t.quietWrongFire} at quiet plants) |`,
  );
  md.push(
    `| Card delivery | ${frac(t.cardActive, t.scored)} | a card was active at the planted turn: ${t.cardForced} forced by the launcher, ${t.cardDetected} detected live${t.forcedWithheld ? `, ${t.forcedWithheld} forced quiet cards withheld by the gate` : ''} |`,
  );
  md.push(
    `| Card was the gold kind | ${frac(t.cardRight, t.scored)} | the active card names the move the plant calls for |`,
  );
  md.push(
    `| Reply delivery | ${frac(t.replyModel, t.scored)} | the model shipped the reply (${t.replyTemplate} template fallbacks) |`,
  );
  md.push('| Repair right | ruled by the author | read the sheet below; the bench does not judge its own repairs |');
  md.push(
    '',
    '| Run | world | schedule | plants | detection | card (forced/detected) | model reply |',
    '|---|---|---|---|---|---|---|',
  );
  for (const r of summary.perTrace) {
    md.push(
      `| ${r.label} | ${r.world || '?'} | ${r.scheduleId || '?'} | ${r.scored} | ${frac(r.detectedRight, r.scored)} | ${frac(r.cardActive, r.scored)} (${r.cardForced}/${r.cardDetected}) | ${frac(r.replyModel, r.scored)} |`,
    );
  }
  for (const r of reviews) {
    md.push(`\n## ${r.label} — ${r.turnCount} turns, closed=${r.closed}, plants=${r.plants.length}`);
    for (const p of r.plants) {
      const tags = [];
      if (p.cardActive) tags.push(p.entry === 'forced' ? `**[CARD forced ${p.card}]**` : `**[CARD ${p.card}]**`);
      if (p.withheld) tags.push('**[FORCED QUIET WITHHELD]**');
      if (p.outcome !== null && !p.replyModel) tags.push('**[TEMPLATE]**');
      const readNote = p.expectedCard
        ? ` read=${p.read || '?'}${p.quietRead ? `/quiet:${p.quietRead}` : ''} ${p.detectedRight ? 'HIT' : p.wrongFire ? 'WRONG-KIND' : 'MISS'}`
        : '';
      md.push(
        `\n### t${p.turn} — ${p.state} (gold: ${p.gold}${p.alsoRight ? ' / ' + p.alsoRight : ''})${readNote}` +
          (tags.length ? ' ' + tags.join(' ') : ''),
      );
      md.push(`- her: ${p.learner.slice(0, 160)}`);
      md.push(`- tutor: ${p.tutor.slice(0, 280)}`);
    }
  }
  return md.join('\n');
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const outPath = outIndex >= 0 ? args[outIndex + 1] : null;
  const json = args.includes('--json');
  // (The 2026-08 builder dropped the first root whenever --out was absent:
  // `i !== outIndex + 1` with outIndex -1 excluded index 0. Kept out of the way.)
  const roots = args.filter((a, i) => a !== '--out' && a !== '--json' && (outIndex < 0 || i !== outIndex + 1));
  if (!roots.length) {
    console.error('usage: node scripts/review-stress-bench.js <traceDirOrParent> [more...] [--out file.md] [--json]');
    process.exit(1);
  }
  const reviews = [];
  for (const root of roots) {
    // Labels read relative to the root given, so a run passed as
    // exports/x/traces labels its dialogues world/arm-dN.
    const labelRoot = path.resolve(root);
    for (const tracePath of findStressTraces(path.resolve(root))) {
      const review = reviewStressTrace(tracePath, { labelRoot });
      if (review) reviews.push(review);
    }
  }
  const summary = summarizeStressReviews(reviews);
  const body = json ? JSON.stringify({ summary, reviews }, null, 2) : renderStressReviewMarkdown(reviews, summary);
  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), `${body}\n`);
    console.log(`wrote ${outPath} (${reviews.length} planted runs)`);
  } else {
    console.log(body);
  }
}
