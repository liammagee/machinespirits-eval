/**
 * E1 — Conduct mining (ADAPTIVE-TUTOR-BOUNDARY-PLAN.md, Gate 0).
 *
 * The corridor map (E0) rests on two modeled assumptions: director exhibits
 * land on cue, and every release is adopted at release-turn + lambda. This
 * script measures both from every recorded run, plus the parameters the
 * corridor model does not see at all — decay->repair latency and the tutor's
 * appetite for its release license. Pure computation, no LLM calls.
 *
 * Per arm (exports/dramatic-derivation/loop/<arm>/result.json):
 *   - release inventory from the ledger (turn, premise, via, offset vs the
 *     world's schedule, declared reason);
 *   - adoption latency per release: first learner transcript turn whose
 *     meta.adopt contains the premise fact (matched by factKey against the
 *     world loaded from the arm's worldId);
 *   - decay->repair pairing from corruption.ledger: each decay matched to
 *     the first unconsumed repair of the same premise, with retract_false
 *     dwell for mutate-mode slips;
 *   - director punctuality (the E0 assumption, verified mechanically).
 *
 * Backend is a NAME-DERIVED GUESS (results do not record their backend):
 * 'mock' anywhere in the arm name -> mock; '-real-', lantern-p[1-5]-*,
 * noc-decay-v1-*, wit-decay-v1-* -> real; everything else -> unknown.
 * Aggregates are reported per backend and never pooled across them.
 *
 * Usage:
 *   node scripts/derivation-mine-conduct.js [--loop exports/dramatic-derivation/loop]
 *     [--out exports/dramatic-derivation/boundary]
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { factKey } from '../services/dramaticDerivation/chainer.js';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const LOOP_DIR = flag('loop', 'exports/dramatic-derivation/loop');
const OUT_DIR = flag('out', 'exports/dramatic-derivation/boundary');
const WORLD_DIR = 'config/drama-derivation';

function backendGuess(name) {
  if (/mock/.test(name)) return 'mock';
  if (/-real-/.test(name)) return 'real';
  if (/^lantern-p[1-5]-/.test(name)) return 'real';
  if (/^(noc|wit)-decay-v1-/.test(name)) return 'real';
  return 'unknown';
}

const worldCache = new Map();
function worldFor(worldId) {
  if (!worldCache.has(worldId)) {
    const file = path.join(WORLD_DIR, `${worldId.replace(/_/g, '-')}.yaml`);
    try {
      worldCache.set(worldId, loadWorld(file));
    } catch (err) {
      worldCache.set(worldId, null);
      console.error(`world load failed for ${worldId} (${file}): ${err.message}`);
    }
  }
  return worldCache.get(worldId);
}

function mineArm(armDir, name) {
  const result = JSON.parse(readFileSync(path.join(armDir, 'result.json'), 'utf8'));
  const world = result.worldId ? worldFor(result.worldId) : null;
  const scheduledTurn = new Map(world ? world.releaseSchedule.map((e) => [e.premise, e.turn]) : []);

  // Adoption turns per factKey, in turn order (repairs re-adopt the same key).
  const adoptionTurns = new Map();
  for (const row of result.transcript || []) {
    if (row.role !== 'learner') continue;
    for (const fact of row.meta?.adopt || []) {
      const key = factKey(fact);
      if (!adoptionTurns.has(key)) adoptionTurns.set(key, []);
      adoptionTurns.get(key).push(row.turn);
    }
  }
  const firstAdoptionAtOrAfter = (key, turn) => adoptionTurns.get(key)?.find((t) => t >= turn) ?? null;

  const releases = [];
  for (const row of result.ledger || []) {
    const cue = scheduledTurn.get(row.premiseId);
    const premise = world?.premiseById?.get(row.premiseId);
    const key = premise ? factKey(premise.fact) : null;
    const adoptTurn = key !== null ? firstAdoptionAtOrAfter(key, row.turn) : null;
    releases.push({
      premiseId: row.premiseId,
      via: row.via,
      turn: row.turn,
      scheduledTurn: cue ?? null,
      offset: cue !== undefined ? row.turn - cue : null,
      reason: row.reason ?? null,
      adoptTurn,
      lambda: adoptTurn !== null ? adoptTurn - row.turn : null,
    });
  }

  // Decay -> repair pairing: first unconsumed repair (and retract_false for
  // mutate slips) of the same premise at or after the decay turn.
  const corruption = result.corruption?.ledger || [];
  const repairsPool = corruption.filter((e) => e.type === 'repair').map((e) => ({ ...e, used: false }));
  const retractsPool = corruption.filter((e) => e.type === 'retract_false').map((e) => ({ ...e, used: false }));
  const slips = [];
  for (const d of corruption.filter((e) => e.type === 'decay')) {
    const repair = repairsPool.find((r) => !r.used && r.premiseId === d.premiseId && r.turn >= d.turn);
    if (repair) repair.used = true;
    let retract = null;
    if (d.mode === 'mutate') {
      retract = retractsPool.find((r) => !r.used && r.premiseId === d.premiseId && r.turn >= d.turn);
      if (retract) retract.used = true;
    }
    slips.push({
      premiseId: d.premiseId,
      decayTurn: d.turn,
      mode: d.mode ?? 'vanish',
      repairTurn: repair?.turn ?? null,
      repairVia: repair?.via ?? null,
      repairLatency: repair ? repair.turn - d.turn : null,
      retractTurn: retract?.turn ?? null,
      falseDwell: retract ? retract.turn - d.turn : null,
    });
  }

  const tutor = releases.filter((r) => r.via === 'tutor');
  const director = releases.filter((r) => r.via === 'director');
  return {
    arm: name,
    backend: backendGuess(name),
    worldId: result.worldId ?? null,
    worldLoaded: Boolean(world),
    verdict: result.verdict ?? null,
    turnsPlayed: result.turnsPlayed ?? null,
    firstForcedTurn: result.firstForcedTurn ?? null,
    assertedGroundedTurn: result.assertedGroundedTurn ?? null,
    releases,
    tutorReleases: tutor.length,
    tutorDeviations: tutor.filter((r) => r.offset !== null && r.offset !== 0).length,
    directorReleases: director.length,
    directorOffNominal: director.filter((r) => r.offset !== null && r.offset !== 0).length,
    unscheduledReleases: releases.filter((r) => r.scheduledTurn === null).length,
    unadoptedReleases: releases.filter((r) => r.lambda === null && r.scheduledTurn !== null).length,
    slips,
  };
}

// ---------------------------------------------------------------------------
// Aggregation (per backend, never pooled)
// ---------------------------------------------------------------------------

function histogram(values, buckets) {
  const h = Object.fromEntries(buckets.map((b) => [b, 0]));
  const overflow = buckets[buckets.length - 2]; // the '3+'-style bucket before 'never'
  for (const v of values) {
    const bucket = v === null ? 'never' : buckets.includes(String(v)) ? String(v) : overflow;
    h[bucket] += 1;
  }
  return h;
}

function aggregate(arms) {
  const byBackend = {};
  for (const backend of ['real', 'unknown', 'mock']) {
    const group = arms.filter((a) => a.backend === backend);
    if (!group.length) continue;
    const releases = group.flatMap((a) => a.releases);
    const tutorOffsets = releases.filter((r) => r.via === 'tutor' && r.offset !== null).map((r) => r.offset);
    const lambdas = releases.filter((r) => r.scheduledTurn !== null).map((r) => r.lambda);
    const slips = group.flatMap((a) => a.slips);
    byBackend[backend] = {
      arms: group.length,
      verdicts: countBy(group, (a) => a.verdict ?? 'none'),
      releases: releases.length,
      lambdaHistogram: histogram(lambdas, ['0', '1', '2', '3+', 'never']),
      tutorOffsetHistogram: countBy(tutorOffsets, (o) => String(o)),
      tutorDeviationRate: rate(
        group.reduce((s, a) => s + a.tutorDeviations, 0),
        group.reduce((s, a) => s + a.tutorReleases, 0),
      ),
      directorOffNominal: group.reduce((s, a) => s + a.directorOffNominal, 0),
      directorReleases: group.reduce((s, a) => s + a.directorReleases, 0),
      slips: slips.length,
      repairLatencyHistogram: histogram(
        slips.map((s) => s.repairLatency),
        ['0', '1', '2', '3+', 'never'],
      ),
      repairVia: countBy(
        slips.filter((s) => s.repairVia),
        (s) => s.repairVia,
      ),
      falseDwells: slips.filter((s) => s.falseDwell !== null).map((s) => s.falseDwell),
      unrepaired: slips.filter((s) => s.repairLatency === null).length,
    };
  }
  return byBackend;
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const k = keyFn(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function rate(num, den) {
  return den ? Number((num / den).toFixed(3)) : null;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function fmtHist(h) {
  return Object.entries(h)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}:${n}`)
    .join(' · ');
}

function buildReport(arms, agg, skipped) {
  const lines = [];
  lines.push('# Conduct parameters — mined from recorded runs');
  lines.push('');
  lines.push(
    '> E1 (Gate 0) of ADAPTIVE-TUTOR-BOUNDARY-PLAN.md · generated by scripts/derivation-mine-conduct.js · ' +
      'pure computation, no LLM calls. Measures the two corridor-map assumptions (director punctuality, ' +
      'adoption latency lambda) and the parameters the map does not see (decay->repair latency, license ' +
      'appetite). Backend is a name-derived guess; aggregates are per backend, never pooled.',
  );
  lines.push('');

  lines.push('## Aggregates by backend');
  lines.push('');
  for (const [backend, a] of Object.entries(agg)) {
    lines.push(`### ${backend} (${a.arms} arms, ${a.releases} releases)`);
    lines.push('');
    lines.push(`- verdicts: ${fmtHist(a.verdicts)}`);
    lines.push(`- adoption lambda: ${fmtHist(a.lambdaHistogram)}`);
    lines.push(
      `- tutor offsets used: ${fmtHist(a.tutorOffsetHistogram) || 'none'} (deviation rate ${a.tutorDeviationRate ?? 'n/a'})`,
    );
    lines.push(`- director off-nominal: ${a.directorOffNominal}/${a.directorReleases}`);
    if (a.slips) {
      lines.push(`- decay slips: ${a.slips} · repair latency: ${fmtHist(a.repairLatencyHistogram)}`);
      lines.push(
        `- repair via: ${fmtHist(a.repairVia) || 'none'} · unrepaired at end: ${a.unrepaired} · ` +
          `false-form dwell (mutate->retract): ${a.falseDwells.join(', ') || 'none'}`,
      );
    } else {
      lines.push('- decay slips: 0');
    }
    lines.push('');
  }

  lines.push('## Arms');
  lines.push('');
  lines.push('| arm | backend | world | verdict | turns | tutor rel (dev) | lambda per release | slips (repaired) |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const a of arms) {
    const lambdas = a.releases
      .filter((r) => r.scheduledTurn !== null)
      .map((r) => (r.lambda === null ? '–' : r.lambda))
      .join(',');
    const repaired = a.slips.filter((s) => s.repairLatency !== null).length;
    lines.push(
      `| ${a.arm} | ${a.backend} | ${a.worldId ?? '?'} | ${a.verdict ?? '?'} | ${a.turnsPlayed ?? '?'} | ` +
        `${a.tutorReleases} (${a.tutorDeviations}) | ${lambdas || '—'} | ${a.slips.length} (${repaired}) |`,
    );
  }
  lines.push('');

  const anomalies = [];
  for (const a of arms) {
    if (!a.worldLoaded) anomalies.push(`${a.arm}: world ${a.worldId} failed to load — lambdas unmeasured`);
    if (a.directorOffNominal) anomalies.push(`${a.arm}: ${a.directorOffNominal} director release(s) off schedule`);
    if (a.unscheduledReleases) anomalies.push(`${a.arm}: ${a.unscheduledReleases} release(s) not on the schedule`);
    if (a.backend === 'real' && a.unadoptedReleases)
      anomalies.push(`${a.arm}: ${a.unadoptedReleases} scheduled release(s) never adopted`);
  }
  for (const s of skipped) anomalies.push(`${s.arm}: SKIPPED — ${s.reason}`);
  lines.push('## Anomalies');
  lines.push('');
  if (anomalies.length) for (const x of anomalies) lines.push(`- ${x}`);
  else lines.push('- none');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const dirs = readdirSync(LOOP_DIR)
  .filter((d) => {
    const p = path.join(LOOP_DIR, d);
    try {
      return statSync(p).isDirectory() && existsSync(path.join(p, 'result.json'));
    } catch {
      return false;
    }
  })
  .sort();

const arms = [];
const skipped = [];
for (const d of dirs) {
  try {
    arms.push(mineArm(path.join(LOOP_DIR, d), d));
  } catch (err) {
    skipped.push({ arm: d, reason: err.message });
  }
}
const order = { real: 0, unknown: 1, mock: 2 };
arms.sort((a, b) => order[a.backend] - order[b.backend] || a.arm.localeCompare(b.arm));
const agg = aggregate(arms);

mkdirSync(OUT_DIR, { recursive: true });
const jsonPath = path.join(OUT_DIR, 'conduct-parameters.json');
const mdPath = path.join(OUT_DIR, 'conduct-parameters.md');
writeFileSync(jsonPath, JSON.stringify({ minedFrom: LOOP_DIR, arms, aggregates: agg, skipped }, null, 2));
writeFileSync(mdPath, buildReport(arms, agg, skipped));

console.log(`conduct parameters written: ${mdPath}`);
console.log(`                            ${jsonPath}`);
console.log(`arms mined: ${arms.length} (${skipped.length} skipped)`);
for (const [backend, a] of Object.entries(agg)) {
  console.log(
    `${backend}: ${a.arms} arms · lambda ${fmtHist(a.lambdaHistogram)} · ` +
      `tutor deviation rate ${a.tutorDeviationRate ?? 'n/a'} · slips ${a.slips} (repair ${fmtHist(a.repairLatencyHistogram) || '—'})`,
  );
}
