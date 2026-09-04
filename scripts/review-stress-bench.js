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
 *   repair     — was the reply the right repair? Never computed here. With
 *                --judgments <file> the sheet carries the rulings of a judge
 *                from another model family (scripts/judge-stress-repair.js:
 *                move named blind to the gold, plant realized, learner uptake
 *                and easing on her next line); without it the row says
 *                "ruled by the author". The blind packet for a second reader
 *                is scripts/stress-blind-packet.js.
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
  // Seats, as the run start recorded them: the judge must come from another family than the tutor.
  const identityModels =
    ev.find((e) => e.type === 'run_start')?.metadata?.sessionRecipe?.config?.identity?.models || {};
  const models = Object.fromEntries(
    Object.entries(identityModels).map(([seat, m]) => [
      seat,
      m?.ref || (m?.provider && m?.model ? `${m.provider}.${m.model}` : null),
    ]),
  );
  const formReads = Object.fromEntries(ev.filter((e) => e.type === 'tutor_form_state').map((e) => [e.turn, e]));
  const turns = Object.fromEntries(
    ev.filter((e) => e.type === 'turn_complete').map((e) => [e.turn, e.turnRecord || {}]),
  );
  const byTurn = (type) => Object.fromEntries(ev.filter((e) => e.type === type).map((e) => [e.turn, e]));
  const switches = byTurn('tutor_manner_switch');
  const quiets = byTurn('tutor_quiet_detect');
  const forces = byTurn('tutor_card_force');
  const outcomes = byTurn('tutor_response_guard_accounting');
  const closed = ev.some((e) => e.type === 'dialogue_closure_transition');
  const hold = tallyStressHold(ev);

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
    const next = turns[turn + 1] || null;
    const form = formReads[turn] || null;
    return {
      turn,
      state: plant.state,
      quietState: isQuiet,
      gold: plant.rightRepair,
      alsoRight: plant.alsoRight || null,
      expectedCard,
      read,
      quietRead,
      sensor: sw?.triggerVersion || null,
      formState: form ? form.state : null,
      formP: form ? form.p : null,
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
      // Her line after the reply — the only in-transcript evidence of whether the repair helped.
      learnerNext: next ? String(next.learner || '') : null,
    };
  });
  return {
    tracePath: path.resolve(tracePath),
    label: path.relative(labelRoot, path.dirname(tracePath)) || path.basename(path.dirname(tracePath)),
    world,
    models,
    scheduleId: plantEvents[0].scheduleId || null,
    turnCount: Object.keys(turns).length,
    closed,
    hold,
    plants,
  };
}

/**
 * Held turns (hold copies of a schedule, 2026-09-02): one verdict event per
 * held turn, and with the speech check on, one speech-check event with every
 * draft. Retried = the reader said the first draft dropped the state and the
 * sim rewrote once; copies = drafts the reader flagged as a near-verbatim
 * copy of the sample line (step 7c, 2026-09-03). Zero-filled when the run
 * held nothing, so the sheet can skip the rows.
 */
export function tallyStressHold(events) {
  const verdicts = events.filter((e) => e.type === 'learner_stress_hold_verdict');
  const checks = events.filter((e) => e.type === 'learner_stress_hold_speech_check');
  return {
    heldTurns: verdicts.length,
    kept: verdicts.filter((e) => e.verdict === 'kept').length,
    released: verdicts.filter((e) => e.verdict === 'released').length,
    releasedQuoteFound: verdicts.filter((e) => e.verdict === 'released' && e.quoteFound === true).length,
    missingVerdict: verdicts.filter((e) => e.verdict === 'missing').length,
    speechChecked: checks.length,
    retried: checks.filter((e) => e.retried === true).length,
    finalDrops: checks.filter((e) => e.finalHolds === false).length,
    unreadable: checks.filter((e) => e.finalHolds === null).length,
    copies: checks.reduce((n, e) => n + (e.drafts || []).filter((d) => d.copy === true).length, 0),
  };
}

function sumHold(reviews) {
  const out = tallyStressHold([]);
  for (const r of reviews) for (const k of Object.keys(out)) out[k] += r.hold?.[k] || 0;
  return out;
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

/**
 * Attach a judge file (scripts/judge-stress-repair.js output) to the plants
 * it judged, matched on trace path and turn (label + turn as the fallback
 * when a run has moved). Mutates and returns `reviews`; sets `judge` on the
 * array for the sheet header.
 */
export function attachStressJudgments(reviews, judgments) {
  if (!judgments?.items) return reviews;
  const byPath = new Map(judgments.items.map((j) => [`${path.resolve(j.tracePath)}#${j.turn}`, j]));
  const byLabel = new Map(judgments.items.map((j) => [`${j.label}#${j.turn}`, j]));
  for (const r of reviews) {
    for (const p of r.plants) {
      const j = byPath.get(`${r.tracePath}#${p.turn}`) || byLabel.get(`${r.label}#${p.turn}`) || null;
      p.judgment = j
        ? {
            realized: j.realized ?? null,
            move: j.move ?? null,
            secondary: j.secondary ?? null,
            repair: j.repair ?? null,
            uptake: j.uptake ?? null,
            eased: j.eased ?? null,
            why: j.why ?? null,
          }
        : null;
    }
  }
  reviews.judge = judgments.judge || null;
  return reviews;
}

function tallyJudgments(plants) {
  const judged = plants.filter((p) => p.judgment);
  const count = (pred) => judged.filter(pred).length;
  const withNext = judged.filter((p) => p.judgment.uptake && p.judgment.uptake !== 'none');
  return {
    judged: judged.length,
    unjudged: judged.filter((p) => p.judgment.repair === null).length,
    repairHit: count((p) => p.judgment.repair === 'HIT'),
    repairPartial: count((p) => p.judgment.repair === 'PARTIAL'),
    repairMiss: count((p) => p.judgment.repair === 'MISS'),
    realizedYes: count((p) => p.judgment.realized === 'yes'),
    realizedPartly: count((p) => p.judgment.realized === 'partly'),
    withNext: withNext.length,
    uptakeYes: withNext.filter((p) => p.judgment.uptake === 'yes').length,
    eased: withNext.filter((p) => p.judgment.eased === 'eased').length,
    persists: withNext.filter((p) => p.judgment.eased === 'persists').length,
  };
}

export function summarizeStressReviews(reviews) {
  const judged = reviews.some((r) => r.plants.some((p) => p.judgment));
  return {
    traces: reviews.length,
    judge: judged ? reviews.judge || 'unknown judge' : null,
    pooled: {
      ...tally(reviews.flatMap((r) => r.plants)),
      ...(judged ? tallyJudgments(reviews.flatMap((r) => r.plants)) : {}),
      hold: sumHold(reviews),
    },
    perTrace: reviews.map((r) => ({
      label: r.label,
      world: r.world,
      scheduleId: r.scheduleId,
      models: r.models || {},
      ...tally(r.plants),
      ...(judged ? tallyJudgments(r.plants) : {}),
      hold: r.hold || tallyStressHold([]),
    })),
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
  if (t.hold?.heldTurns) {
    const h = t.hold;
    md.push(
      `| Held turns kept | ${frac(h.kept, h.heldTurns)} | the sim's private verdict said it kept the planted state (${h.released} released, ${h.releasedQuoteFound} with the quote found in the reply, ${h.missingVerdict} no verdict) |`,
    );
    if (h.speechChecked) {
      md.push(
        `| Held turns retried | ${frac(h.retried, h.speechChecked)} | the reader said the first draft dropped the state and the sim rewrote once (${h.finalDrops} still dropped after, ${h.unreadable} unreadable, ${h.copies} drafts flagged as a copy of the sample line) |`,
      );
    }
  }
  md.push(
    `| Reply delivery | ${frac(t.replyModel, t.scored)} | the model shipped the reply (${t.replyTemplate} template fallbacks) |`,
  );
  if (summary.judge) {
    const j = summary.judge;
    md.push(
      `| Repair right (judge ${j}, blind to gold) | ${frac(t.repairHit, t.judged)} | the judge named the reply's main move without seeing the gold; HIT when it is the gold or the also-acceptable move (${t.repairPartial} PARTIAL: gold only as a second move; ${t.repairMiss} MISS${t.unjudged ? `; ${t.unjudged} UNJUDGED — indeterminate, stop and look` : ''}) |`,
    );
    md.push(
      `| Plant realized (judge) | ${frac(t.realizedYes, t.judged)} | the learner line carried out the planted direction (${t.realizedPartly} partly) |`,
    );
    md.push(
      `| Learner took up the move (judge) | ${frac(t.uptakeYes, t.withNext)} | her next line works with what the tutor offered (${t.judged - t.withNext} plants had no next line) |`,
    );
    md.push(
      `| State eased next turn (judge) | ${frac(t.eased, t.withNext)} | the planted condition no longer shows in her next line (${t.persists} persists). CAVEAT: the learner-sim returns to its standing brief after a planted turn by design, so this row is weak evidence on its own; read it with the uptake row |`,
    );
    md.push(
      '| Repair right (second reader) | blind packet | scripts/stress-blind-packet.js — a person rules the same items without arm, gold or judge tags |',
    );
  } else {
    md.push('| Repair right | ruled by the author | read the sheet below; the bench does not judge its own repairs |');
  }
  const judgeCols = summary.judge ? ' repair HIT | realized | uptake |' : '';
  md.push(
    '',
    `| Run | world | schedule | seats (tutor / learner) | plants | detection | card (forced/detected) | model reply |${judgeCols}`,
    `|---|---|---|---|---|---|---|---|${summary.judge ? '---|---|---|' : ''}`,
  );
  for (const r of summary.perTrace) {
    const seats = `${r.models?.tutor || '?'} / ${r.models?.learner || '?'}`;
    const judgeCells = summary.judge
      ? ` ${frac(r.repairHit, r.judged)} | ${frac(r.realizedYes, r.judged)} | ${frac(r.uptakeYes, r.withNext)} |`
      : '';
    md.push(
      `| ${r.label} | ${r.world || '?'} | ${r.scheduleId || '?'} | ${seats} | ${r.scored} | ${frac(r.detectedRight, r.scored)} | ${frac(r.cardActive, r.scored)} (${r.cardForced}/${r.cardDetected}) | ${frac(r.replyModel, r.scored)} |${judgeCells}`,
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
      if (p.judgment) {
        const j = p.judgment;
        const move = j.move ? `${j.move}${j.secondary ? ` (+${j.secondary})` : ''}` : 'unjudged';
        const next =
          j.uptake === 'none' ? 'no next line' : `next line: uptake=${j.uptake ?? '?'} eased=${j.eased ?? '?'}`;
        md.push(
          `- judge: realized=${j.realized ?? '?'} move=${move} → ${j.repair ?? 'UNJUDGED'}; ${next}${j.why ? ` — ${j.why}` : ''}`,
        );
        if (p.learnerNext) md.push(`- her next: ${p.learnerNext.slice(0, 160)}`);
      }
    }
  }
  return md.join('\n');
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const valueFlags = ['--out', '--judgments'];
  const flagValue = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const outPath = flagValue('--out');
  const judgmentsPath = flagValue('--judgments');
  const json = args.includes('--json');
  const valueIndexes = new Set(
    valueFlags
      .map((f) => args.indexOf(f))
      .filter((i) => i >= 0)
      .map((i) => i + 1),
  );
  const roots = args.filter((a, i) => !valueFlags.includes(a) && a !== '--json' && !valueIndexes.has(i));
  if (!roots.length) {
    console.error(
      'usage: node scripts/review-stress-bench.js <traceDirOrParent> [more...] [--judgments judge.json] [--out file.md] [--json]',
    );
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
  if (judgmentsPath) attachStressJudgments(reviews, JSON.parse(fs.readFileSync(path.resolve(judgmentsPath), 'utf8')));
  const summary = summarizeStressReviews(reviews);
  const body = json ? JSON.stringify({ summary, reviews }, null, 2) : renderStressReviewMarkdown(reviews, summary);
  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), `${body}\n`);
    console.log(`wrote ${outPath} (${reviews.length} planted runs)`);
  } else {
    console.log(body);
  }
}
