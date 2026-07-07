/**
 * E0 — Corridor cartography (ADAPTIVE-TUTOR-BOUNDARY-PLAN.md, Gate 0).
 *
 * The death arithmetic of a derivation drama is deterministic: given a
 * release calendar, a conduct sequence (where the tutor places its bendable
 * exhibits inside the ±RELEASE_LATITUDE license), and an adoption latency
 * profile, the D-trajectory and the stall verdict are pure computation.
 * This script enumerates the full licensed conduct space and computes
 * survival for each sequence — the "safe corridor" of §6.13.9 made a
 * measured object.
 *
 * Authority discipline: D comes from the production derivationDistance()
 * and death from the production detectStall() (services/dramaticDerivation/
 * slope.js) — the map cannot drift from the harness. The two modeled
 * assumptions, both flagged in the report and measured by the E1 miner:
 *   (a) director exhibits land exactly on their scheduled turn;
 *   (b) every released premise is adopted at release-turn + lambda.
 *
 * Validation gate (--validate): the engine must reproduce all four observed
 * lantern verdicts before any map is believed —
 *   Level A (p2, p3, p4, p5): replay the recorded trajectory through
 *     detectStall; the first firing (type, turn) must match the recorded
 *     verdict, and grounded arms must never fire.
 *   Level B (p5, the decay-inert arm): re-simulate from the recorded
 *     placements and reproduce the full D-curve, grounded counts, and the
 *     aporia turn exactly.
 *
 * Usage:
 *   node scripts/derivation-corridor-map.js [--world config/drama-derivation/world-002-lantern.yaml]
 *     [--lambdas 0,1,2] [--out exports/dramatic-derivation/boundary] [--validate] [--no-edits]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadWorld, plotLint } from '../services/dramaticDerivation/world.js';
import { derivationDistance, detectStall } from '../services/dramaticDerivation/slope.js';
import { factKey } from '../services/dramaticDerivation/chainer.js';
import { RELEASE_LATITUDE } from '../services/dramaticDerivation/llmRoles.js';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const WORLD_PATH = flag('world', 'config/drama-derivation/world-002-lantern.yaml');
const LAMBDAS = (flag('lambdas', '0,1,2') || '').split(',').map((s) => Number(s.trim()));
const OUT_DIR = flag('out', 'exports/dramatic-derivation/boundary');
const LOOP_DIR = 'exports/dramatic-derivation/loop';

// The four world-002 arms the validation gate must reproduce.
const VALIDATION_ARMS = [
  { dir: 'lantern-p2-plot-on', expect: { verdict: 'aporia', endTurn: 8 } },
  { dir: 'lantern-p3-repair-on', expect: { verdict: 'grounded_anagnorisis', endTurn: 20 } },
  { dir: 'lantern-p4-hygiene-on', expect: { verdict: 'grounded_anagnorisis', endTurn: 20 } },
  { dir: 'lantern-p5-mutation-on', expect: { verdict: 'aporia', endTurn: 12 } },
];

// ---------------------------------------------------------------------------
// Simulation core
// ---------------------------------------------------------------------------

/**
 * Tempo simulation: placements is a Map premiseId -> playTurn covering every
 * schedule entry (directors fixed, tutor exhibits wherever the enumerated
 * conduct puts them). Adoption of each release lands at playTurn + lambda.
 * Returns the verdict the production detector would deliver, plus the drop
 * structure the slack analysis reads.
 */
function simulate(world, placements, lambda) {
  const pending = new Map(); // adoptTurn -> facts[]
  for (const [id, t] of placements) {
    const at = t + lambda;
    if (!pending.has(at)) pending.set(at, []);
    pending.get(at).push(world.premiseById.get(id).fact);
  }
  const firstReleaseTurn = Math.min(...placements.values());
  const board = new Map(world.background.map((f) => [factKey(f), f]));
  const trajectory = [];
  let verdict = null;
  let endTurn = null;
  let forcedTurn = null;
  for (let turn = 1; turn <= world.turnCap; turn += 1) {
    for (const fact of pending.get(turn) || []) board.set(factKey(fact), fact);
    const facts = [...board.values()];
    const D = derivationDistance(world, facts);
    trajectory.push({ turn, D, groundedCount: facts.length });
    if (D === 0) {
      forcedTurn = turn;
      verdict = 'survives_forced';
      endTurn = turn;
      break;
    }
    const stall = detectStall(trajectory, world.slope.aporia_window, firstReleaseTurn);
    if (stall) {
      verdict = stall;
      endTurn = turn;
      break;
    }
  }
  if (!verdict) {
    verdict = 'cap_unforced';
    endTurn = world.turnCap;
  }
  return { verdict, endTurn, forcedTurn, trajectory, drops: dropTurns(trajectory, world) };
}

/** Turns at which D strictly decreased (the drops the detector counts). */
function dropTurns(trajectory, world) {
  const drops = [];
  let prev = derivationDistance(world, world.background);
  for (const point of trajectory) {
    if (point.D < prev) drops.push(point.turn);
    prev = point.D;
  }
  return drops;
}

/**
 * Slack per link, for surviving runs: between consecutive drops (and from
 * the first live detector check to the first drop) the gap may be at most
 * window-1 turns; slack = (window-1) - gap. minSlack 0 = a knife edge.
 */
function slackProfile(world, firstReleaseTurn, drops, forcedTurn) {
  const w = world.slope.aporia_window;
  const links = [];
  const firstCheck = Math.max(w, firstReleaseTurn + w - 1);
  if (drops.length) {
    links.push({ link: `start->t${drops[0]}`, gap: drops[0] - (firstCheck - (w - 1)), slack: firstCheck - drops[0] });
  }
  const seq = forcedTurn ? drops : drops.slice();
  for (let i = 1; i < seq.length; i += 1) {
    const gap = seq[i] - seq[i - 1];
    links.push({ link: `t${seq[i - 1]}->t${seq[i]}`, gap, slack: w - 1 - gap });
  }
  return { links, minSlack: links.length ? Math.min(...links.map((l) => l.slack)) : null };
}

// ---------------------------------------------------------------------------
// Enumeration
// ---------------------------------------------------------------------------

function tutorRanges(world) {
  return world.releaseSchedule
    .filter((e) => e.via === 'tutor')
    .map((e) => ({
      premise: e.premise,
      scheduled: e.turn,
      range: rangeInclusive(Math.max(1, e.turn - RELEASE_LATITUDE), Math.min(world.turnCap, e.turn + RELEASE_LATITUDE)),
    }));
}

function rangeInclusive(a, b) {
  const out = [];
  for (let v = a; v <= b; v += 1) out.push(v);
  return out;
}

function* combos(ranges) {
  if (!ranges.length) {
    yield [];
    return;
  }
  const [head, ...rest] = ranges;
  for (const v of head.range) {
    for (const tail of combos(rest)) yield [v, ...tail];
  }
}

function enumerateCorridor(world, lambda) {
  const tutors = tutorRanges(world);
  const directors = world.releaseSchedule.filter((e) => e.via !== 'tutor');
  const rows = [];
  for (const combo of combos(tutors)) {
    const placements = new Map(directors.map((e) => [e.premise, e.turn]));
    tutors.forEach((t, i) => placements.set(t.premise, combo[i]));
    const sim = simulate(world, placements, lambda);
    rows.push({
      placements: Object.fromEntries(tutors.map((t, i) => [t.premise, combo[i]])),
      offsets: Object.fromEntries(tutors.map((t, i) => [t.premise, combo[i] - t.scheduled])),
      verdict: sim.verdict,
      endTurn: sim.endTurn,
      forcedTurn: sim.forcedTurn,
      drops: sim.drops,
      ...(sim.verdict === 'survives_forced'
        ? { slack: slackProfile(world, Math.min(...placements.values()), sim.drops, sim.forcedTurn) }
        : {}),
    });
  }
  const survivors = rows.filter((r) => r.verdict === 'survives_forced');
  return {
    lambda,
    total: rows.length,
    survivors: survivors.length,
    corridorWidth: survivors.length / rows.length,
    rows,
    marginals: marginalSafeSets(world, tutors, rows),
  };
}

/**
 * Per-decision marginal: for each tutor exhibit, which placements survive
 * when every OTHER tutor exhibit plays on cue. This is the per-decision
 * safe set a solvency gate (E3/M1) would check.
 */
function marginalSafeSets(world, tutors, rows) {
  const out = {};
  for (const t of tutors) {
    const others = tutors.filter((o) => o.premise !== t.premise);
    const onCueRows = rows.filter((r) => others.every((o) => r.placements[o.premise] === o.scheduled));
    out[t.premise] = {
      scheduled: t.scheduled,
      placements: onCueRows.map((r) => ({
        turn: r.placements[t.premise],
        offset: r.offsets[t.premise],
        verdict: r.verdict,
        endTurn: r.endTurn,
      })),
      safeSet: onCueRows.filter((r) => r.verdict === 'survives_forced').map((r) => r.placements[t.premise]),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Calendar-edit variants (choke wideners)
// ---------------------------------------------------------------------------

function calendarEdits(world, lambda) {
  const base = enumerateCorridor(world, lambda);
  const variants = [];
  for (const entry of world.releaseSchedule) {
    for (const delta of [-2, -1, 1, 2]) {
      const turn = entry.turn + delta;
      if (turn < 1 || turn > world.turnCap) continue;
      const schedule = world.releaseSchedule
        .map((e) => (e.premise === entry.premise ? { ...e, turn } : { ...e }))
        .sort((a, b) => a.turn - b.turn);
      const variant = { ...world, releaseSchedule: schedule };
      const lint = plotLint(variant);
      if (!lint.ok) {
        variants.push({ edit: `${entry.premise} t${entry.turn}->t${turn}`, lint: lint.errors, corridorWidth: null });
        continue;
      }
      const map = enumerateCorridor(variant, lambda);
      variants.push({
        edit: `${entry.premise} t${entry.turn}->t${turn}`,
        via: entry.via,
        corridorWidth: map.corridorWidth,
        survivors: map.survivors,
        widthDelta: map.corridorWidth - base.corridorWidth,
        firstEntailedTurn: lint.firstEntailedTurn,
      });
    }
  }
  variants.sort((a, b) => (b.corridorWidth ?? -1) - (a.corridorWidth ?? -1));
  return { baseWidth: base.corridorWidth, variants };
}

// ---------------------------------------------------------------------------
// Validation gate
// ---------------------------------------------------------------------------

function loadArm(dir) {
  const p = path.join(LOOP_DIR, dir, 'result.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Level A: replay the recorded trajectory through the production detector. */
function replayDetector(world, result) {
  const ledger = result.ledger || [];
  const firstReleaseTurn = ledger.length ? ledger[0].turn : Infinity;
  const trajectory = result.trajectory || [];
  for (let e = 1; e <= trajectory.length; e += 1) {
    const stall = detectStall(trajectory.slice(0, e), world.slope.aporia_window, firstReleaseTurn);
    if (stall) return { fired: stall, turn: trajectory[e - 1].turn };
  }
  return { fired: null, turn: null };
}

/** Level B: re-simulate p5 from its recorded placements and adoptions. */
function resimulate(world, result) {
  const placements = new Map((result.ledger || []).map((row) => [row.premiseId, row.turn]));
  // Recorded adoption turns: scan learner transcript rows for adopt facts.
  const adoptionTurn = new Map();
  for (const row of result.transcript || []) {
    if (row.role !== 'learner') continue;
    for (const fact of row.meta?.adopt || []) {
      const key = factKey(fact);
      if (!adoptionTurn.has(key)) adoptionTurn.set(key, row.turn);
    }
  }
  const lambdas = [...placements.entries()].map(([id, t]) => {
    const key = factKey(world.premiseById.get(id).fact);
    return adoptionTurn.has(key) ? adoptionTurn.get(key) - t : null;
  });
  const sim = simulate(world, placements, 0);
  return {
    sim,
    observedLambdas: lambdas,
    dCurveMatches:
      JSON.stringify(sim.trajectory.map((p) => p.D)) === JSON.stringify((result.trajectory || []).map((p) => p.D)),
    groundedMatches:
      JSON.stringify(sim.trajectory.map((p) => p.groundedCount)) ===
      JSON.stringify((result.trajectory || []).map((p) => p.groundedCount)),
  };
}

function runValidation(world) {
  const checks = [];
  for (const { dir, expect } of VALIDATION_ARMS) {
    const result = loadArm(dir);
    if (!result) {
      checks.push({ arm: dir, check: 'artifacts', pass: false, detail: 'result.json missing' });
      continue;
    }
    const replay = replayDetector(world, result);
    if (expect.verdict === 'aporia') {
      checks.push({
        arm: dir,
        check: 'detector replay',
        pass: replay.fired === 'aporia' && replay.turn === expect.endTurn,
        detail: `fired=${replay.fired}@t${replay.turn} expected=aporia@t${expect.endTurn}`,
      });
    } else {
      checks.push({
        arm: dir,
        check: 'detector replay',
        pass: replay.fired === null && result.verdict === expect.verdict,
        detail: `fired=${replay.fired ?? 'never'} verdict=${result.verdict}`,
      });
    }
  }
  // Level B on the decay-inert arm.
  const p5 = loadArm('lantern-p5-mutation-on');
  if (p5) {
    const level = resimulate(world, p5);
    checks.push({
      arm: 'lantern-p5-mutation-on',
      check: 'full re-simulation',
      pass:
        level.sim.verdict === 'aporia' &&
        level.sim.endTurn === 12 &&
        level.dCurveMatches &&
        level.groundedMatches &&
        level.observedLambdas.every((l) => l === 0),
      detail: `verdict=${level.sim.verdict}@t${level.sim.endTurn} dCurve=${level.dCurveMatches} grounded=${level.groundedMatches} lambdas=[${level.observedLambdas.join(',')}]`,
    });
  }
  return checks;
}

/**
 * Observed conduct placed on the map: for each validation arm, take the
 * tutor's actual placements from the release ledger (cue-completing any
 * entries death cut off), run the no-decay lambda=0 model on exactly that
 * placement, and set the prediction beside the artifact. Divergence is the
 * decay/repair channel at work — the map is a tempo floor, not the whole game.
 */
function observedConduct(world) {
  const cueByPremise = new Map(world.releaseSchedule.map((e) => [e.premise, e.turn]));
  const rows = [];
  for (const { dir } of VALIDATION_ARMS) {
    const result = loadArm(dir);
    if (!result) continue;
    // The recorded VALIDATION_ARMS belong to world-002-lantern; the observed
    // overlay only applies to the world they were played on. Skip any arm whose
    // ledger references a premise this world does not have (a different world).
    if ((result.ledger || []).some((row) => !world.premiseById.has(row.premiseId))) continue;
    const placements = new Map(world.releaseSchedule.map((e) => [e.premise, e.turn]));
    const tutorMoves = [];
    for (const row of result.ledger || []) {
      placements.set(row.premiseId, row.turn);
      if (row.via === 'tutor') {
        const off = row.turn - cueByPremise.get(row.premiseId);
        tutorMoves.push(`${row.premiseId}@t${row.turn}(${off >= 0 ? '+' : ''}${off})`);
      }
    }
    const sim = simulate(world, placements, 0);
    const corruption = result.corruption?.ledger || [];
    const decays = corruption.filter((e) => e.type === 'decay').length;
    const repairs = corruption.filter((e) => e.type !== 'decay').length;
    const model = sim.verdict === 'survives_forced' ? `grounded t${sim.forcedTurn}` : `${sim.verdict} t${sim.endTurn}`;
    const observed =
      result.verdict === 'grounded_anagnorisis'
        ? `grounded t${result.turnsPlayed}`
        : `${result.verdict} t${result.turnsPlayed}`;
    const modelDies = sim.verdict !== 'survives_forced';
    const observedDies = result.verdict !== 'grounded_anagnorisis';
    let gloss;
    if (modelDies === observedDies && (!modelDies || sim.endTurn === result.turnsPlayed)) {
      gloss = decays ? 'verdict as mapped (decay repaired fast enough not to matter)' : 'model exact';
    } else if (observedDies && (!modelDies || result.turnsPlayed < sim.endTurn)) {
      gloss = 'died EARLIER than mapped — unrepaired decay erased D-movement the model counts';
    } else {
      gloss = 'outlived the map — repair-generated re-adoption drops bridged the desert';
    }
    rows.push({ arm: dir, tutorMoves, model, observed, decays, repairs, gloss });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function fmtPct(x) {
  return `${(100 * x).toFixed(1)}%`;
}

function buildReport(world, maps, edits, validation, observed) {
  const lines = [];
  const w = world.slope.aporia_window;
  lines.push(`# Corridor map — ${world.id}`);
  lines.push('');
  lines.push(
    `> E0 (Gate 0) of ADAPTIVE-TUTOR-BOUNDARY-PLAN.md · generated by scripts/derivation-corridor-map.js · ` +
      `pure computation, no LLM calls. D and the death rule are the production code paths ` +
      `(slope.js derivationDistance/detectStall). Modeled assumptions: director exhibits land on ` +
      `their scheduled turn; every release is adopted at release+lambda (E1 measures both).`,
  );
  lines.push('');
  lines.push(`Calendar (turn cap ${world.turnCap}, aporia window ${w}, license ±${RELEASE_LATITUDE} on tutor-via):`);
  lines.push('');
  for (const e of world.releaseSchedule) {
    lines.push(`- t${e.turn} \`${e.premise}\` (via ${e.via})`);
  }
  lines.push('');

  if (validation) {
    lines.push('## Validation gate');
    lines.push('');
    for (const c of validation) {
      lines.push(`- ${c.pass ? 'PASS' : '**FAIL**'} · ${c.arm} · ${c.check} — ${c.detail}`);
    }
    lines.push('');
  }

  lines.push('## Corridor width by adoption latency');
  lines.push('');
  lines.push('| lambda | licensed sequences | survive to forced | corridor width |');
  lines.push('|---|---|---|---|');
  for (const m of maps) {
    lines.push(`| ${m.lambda} | ${m.total} | ${m.survivors} | ${fmtPct(m.corridorWidth)} |`);
  }
  lines.push('');

  for (const m of maps) {
    lines.push(`## lambda = ${m.lambda}: per-decision safe sets (others on cue)`);
    lines.push('');
    for (const [premise, marginal] of Object.entries(m.marginals)) {
      const cells = marginal.placements
        .map(
          (p) =>
            `t${p.turn}(${p.offset >= 0 ? '+' : ''}${p.offset}): ${p.verdict === 'survives_forced' ? 'OK' : `dies t${p.endTurn}`}`,
        )
        .join(' · ');
      lines.push(`- \`${premise}\` (cue t${marginal.scheduled}) — ${cells}`);
      lines.push(
        `  - safe set: {${marginal.safeSet.map((t) => `t${t}`).join(', ') || 'EMPTY'}} of ${marginal.placements.length} licensed`,
      );
    }
    lines.push('');
    const onCue = m.rows.find((r) => Object.values(r.offsets).every((o) => o === 0));
    if (onCue?.slack) {
      lines.push(`On-cue slack profile (lambda=${m.lambda}): minSlack=${onCue.slack.minSlack}`);
      for (const link of onCue.slack.links) {
        lines.push(`- ${link.link}: gap ${link.gap}, slack ${link.slack}${link.slack === 0 ? '  <-- knife edge' : ''}`);
      }
      lines.push('');
    }
  }

  if (edits) {
    lines.push('## Single-edit calendar variants (lambda=0), sorted by corridor width');
    lines.push('');
    lines.push(`Base width: ${fmtPct(edits.baseWidth)}. Lint-failing edits listed with their lint error.`);
    lines.push('');
    lines.push('| edit | via | width | delta | S first derivable |');
    lines.push('|---|---|---|---|---|');
    for (const v of edits.variants) {
      if (v.corridorWidth === null) {
        lines.push(`| ${v.edit} | — | LINT FAIL | — | ${v.lint[0]} |`);
      } else {
        lines.push(
          `| ${v.edit} | ${v.via} | ${fmtPct(v.corridorWidth)} | ${v.widthDelta >= 0 ? '+' : ''}${fmtPct(v.widthDelta)} | t${v.firstEntailedTurn} |`,
        );
      }
    }
    lines.push('');
  }

  if (observed?.length) {
    lines.push('## Observed conduct, placed on the map');
    lines.push('');
    lines.push(
      'Tutor placements from each release ledger (entries death cut off are cue-completed), ' +
        'run through the no-decay lambda=0 model, beside the artifact. Divergence is the ' +
        'decay/repair channel at work — the map is a tempo floor, not the whole game.',
    );
    lines.push('');
    lines.push('| arm | tutor conduct | no-decay model | observed | decay / repairs |');
    lines.push('|---|---|---|---|---|');
    for (const r of observed) {
      lines.push(
        `| ${r.arm} | ${r.tutorMoves.join(' · ')} | ${r.model} | ${r.observed} | ${r.decays} / ${r.repairs} |`,
      );
    }
    lines.push('');
    for (const r of observed) {
      lines.push(`- ${r.arm}: ${r.gloss}.`);
    }
    if (world.id === 'world_002_lantern') {
      lines.push('');
      lines.push(
        'p2 and p3 played the SAME tutor schedule (bearing −1, chart −2) — the bare arithmetic kills ' +
          'that placement at t12. Unrepaired decay killed p2 four turns earlier still (p_bearing vanished ' +
          "t6; chart's adoption exactly offset the loss, so the detector saw no drop after t3). The repair " +
          "clause's re-adoption drops carried p3 through the same desert to grounded t20. p5 ran the " +
          'chart −2 pull decay-free and died exactly where the map says. The early-chart pull is not a ' +
          'one-off: three of four arms made it.',
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const world = loadWorld(WORLD_PATH);
const lint = plotLint(world);
if (!lint.ok) {
  console.error(`world lint FAILED for ${WORLD_PATH}:`, lint.errors);
  process.exit(1);
}

const validation = has('validate') ? runValidation(world) : null;
const maps = LAMBDAS.map((lambda) => enumerateCorridor(world, lambda));
const edits = has('no-edits') ? null : calendarEdits(world, 0);
const observed = observedConduct(world);

mkdirSync(OUT_DIR, { recursive: true });
const slug = world.id.replace(/_/g, '-');
const jsonPath = path.join(OUT_DIR, `corridor-map-${slug}.json`);
const mdPath = path.join(OUT_DIR, `corridor-map-${slug}.md`);
writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      world: world.id,
      releaseLatitude: RELEASE_LATITUDE,
      aporiaWindow: world.slope.aporia_window,
      turnCap: world.turnCap,
      validation,
      observedConduct: observed,
      maps,
      calendarEdits: edits,
    },
    null,
    2,
  ),
);
writeFileSync(mdPath, buildReport(world, maps, edits, validation, observed));

console.log(`corridor map written: ${mdPath}`);
console.log(`                      ${jsonPath}`);
if (validation) {
  const failed = validation.filter((c) => !c.pass);
  for (const c of validation) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.arm} · ${c.check} — ${c.detail}`);
  if (failed.length) {
    console.error(`VALIDATION GATE FAILED (${failed.length} checks) — do not believe the map.`);
    process.exit(1);
  }
}
for (const m of maps) {
  console.log(`lambda=${m.lambda}: ${m.survivors}/${m.total} licensed sequences survive (${fmtPct(m.corridorWidth)})`);
}
