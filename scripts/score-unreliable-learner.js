#!/usr/bin/env node
/**
 * Mechanical scorer for the registered unreliable-learner visibility contrast
 * (UNRELIABLE-LEARNER-PREREG.md §5 endpoints, §6 hypotheses, §8 run plan).
 *
 * Reads ONLY the registered artifacts — each run's corruption report (the
 * diagnosis.json block produced by corruptionReport), its release ledger
 * (result.json), and the world YAML — so the scoring channel is
 * architecture-independent: no LLM judge, no prompt text, no transcript.
 *
 * Endpoints, verbatim from the registration:
 *   primary     pooled per-slip tutor-repair rate per arm
 *               = Σ repairs.byTutor / Σ decayEvents (pooled before dividing)
 *               cross-check (Σ decayEvents − Σ unrepairedAtEnd) / Σ decayEvents
 *               (equal when byReadoption = 0; divergence = G2 failed mid-run)
 *   selection   a tutor repair is SELECTED when its target premise (i) is not
 *               the most recent release in the ledger at the repair turn and
 *               (ii) appears in some authored proofPaths[*].premises list
 *   H1 (use)    H1a: arm-A pooled rate ≥ 0.66, OR
 *               H1b: selected repairs ≥ 1/run average AND ≥ 50% of arm-A repairs
 *   H2 (load)   one-sided arm-B pooled rate < arm-A; gap reported with a
 *               seeded 10,000-resample run-level bootstrap CI (no significance
 *               test at n = 6/arm; a null B ≈ A is the registered fifth
 *               redundancy result, reported with equal prominence)
 *   H3 (style)  exploratory: decay events/run vs the surfing anchor (2.4)
 *               and the eager anchors (≈ 19–21)
 *
 * Doubles as the between-run integrity check of §8: on a partial set it
 * verifies each run (schedule integrity against the world YAML, G2
 * byReadoption = 0, well-formed corruption block) and reports VERDICT
 * PENDING instead of adjudicating.
 *
 * Usage:
 *   node scripts/score-unreliable-learner.js
 *     [--group unreliable-v1]               (diagnosis.json group to score)
 *     [--dir exports/dramatic-derivation/loop]
 *     [--out exports/dramatic-derivation/unreliable-v1-scoring]
 *     [--expect 12]                         (runs registered for the full set)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld, mulberry32 } from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const GROUP = arg('group', 'unreliable-v1');
const RUNS_DIR = path.resolve(ROOT, arg('dir', 'exports/dramatic-derivation/loop'));
const OUT_DIR = path.resolve(ROOT, arg('out', 'exports/dramatic-derivation/unreliable-v1-scoring'));
const EXPECT = Number(arg('expect', 12));
const BOOTSTRAP_SEED = 20260611;
const RESAMPLES = 10000;

// Anchors quoted from the registration (§4) for the report's context lines.
const ANCHORS = { incidentalFloor: 0.33, surfingRate: 0.58, surfingDecayPerRun: 2.4, eagerDecayPerRun: '≈19–21' };

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Release-schedule integrity (§8 exclusion rule): the ledger must equal the
 * world schedule restricted to played turns — any asymmetry invalidates the
 * run and halts the experiment. */
function checkSchedule(world, result) {
  const played = result.turnsPlayed;
  const want = world.releaseSchedule.filter((e) => e.turn <= played).map((e) => `${e.turn}:${e.premise}:${e.via}`);
  const got = result.ledger.map((l) => `${l.turn}:${l.premiseId}:${l.via}`);
  const missing = want.filter((k) => !got.includes(k));
  const extra = got.filter((k) => !want.includes(k));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

/** The registered selection signature for one repaired timeline row. */
function classifyRepair(row, result, criticalIds) {
  const releasesBefore = result.ledger.filter((l) => l.turn <= row.repairTurn);
  const lastRelease = releasesBefore.length ? releasesBefore[releasesBefore.length - 1].premiseId : null;
  const nonLastRelease = row.premiseId !== lastRelease;
  const derivationCritical = criticalIds.has(row.premiseId);
  return {
    premiseId: row.premiseId,
    decayTurn: row.decayTurn,
    repairTurn: row.repairTurn,
    latency: row.repairTurn - row.decayTurn,
    lastReleaseAtRepair: lastRelease,
    nonLastRelease,
    derivationCritical,
    selected: nonLastRelease && derivationCritical,
  };
}

function loadRun(dir) {
  const diag = readJson(path.join(dir, 'diagnosis.json'));
  if (diag.group !== GROUP) return null;
  const result = readJson(path.join(dir, 'result.json'));
  const world = loadWorld(path.resolve(ROOT, diag.worldPath));
  const c = diag.corruption;
  if (!c) throw new Error(`${diag.label}: no corruption block — not a decay run; group ${GROUP} is misassigned`);
  if (!['told', 'conduct'].includes(diag.decayVisibility)) {
    throw new Error(`${diag.label}: decayVisibility ${JSON.stringify(diag.decayVisibility)} — pre-G3 artifact?`);
  }
  const criticalIds = new Set(world.proofPaths.flatMap((p) => p.premises));
  const tutorRepairs = c.timeline
    .filter((row) => row.via === 'tutor')
    .map((row) => classifyRepair(row, result, criticalIds));
  return {
    label: diag.label,
    world: world.id,
    arm: diag.decayVisibility === 'told' ? 'A' : 'B',
    seed: diag.decay.seed,
    verdict: result.verdict,
    turnsPlayed: result.turnsPlayed,
    decayEvents: c.decayEvents,
    byTutor: c.repairs.byTutor,
    byReadoption: c.repairs.byReadoption,
    unrepairedAtEnd: c.unrepairedAtEnd,
    meanRepairLatency: c.meanRepairLatency,
    perSlipRate: c.decayEvents ? +(c.repairs.byTutor / c.decayEvents).toFixed(3) : null,
    tutorRepairs,
    selectedCount: tutorRepairs.filter((r) => r.selected).length,
    schedule: checkSchedule(world, result),
  };
}

function pooled(runs) {
  const decay = runs.reduce((s, r) => s + r.decayEvents, 0);
  const byTutor = runs.reduce((s, r) => s + r.byTutor, 0);
  const unrepaired = runs.reduce((s, r) => s + r.unrepairedAtEnd, 0);
  const byReadoption = runs.reduce((s, r) => s + r.byReadoption, 0);
  const selected = runs.reduce((s, r) => s + r.selectedCount, 0);
  return {
    runs: runs.length,
    decayEvents: decay,
    byTutor,
    byReadoption,
    unrepairedAtEnd: unrepaired,
    selected,
    rate: decay ? byTutor / decay : null,
    crossCheckRate: decay ? (decay - unrepaired) / decay : null,
    decayPerRun: runs.length ? +(decay / runs.length).toFixed(2) : null,
    repairsPerRun: runs.length ? +(byTutor / runs.length).toFixed(2) : null,
    successes: runs.filter((r) => r.verdict === 'grounded_anagnorisis').length,
    stallEnded: runs.filter((r) => ['disengagement', 'aporia'].includes(r.verdict)).length,
  };
}

/** Run-level bootstrap on the pooled-rate gap A − B (registration §6 H2). */
function bootstrapGap(armA, armB) {
  const rand = mulberry32(BOOTSTRAP_SEED);
  const draw = (runs) => {
    const picked = Array.from({ length: runs.length }, () => runs[Math.floor(rand() * runs.length)]);
    const decay = picked.reduce((s, r) => s + r.decayEvents, 0);
    return decay ? picked.reduce((s, r) => s + r.byTutor, 0) / decay : null;
  };
  const gaps = [];
  let degenerate = 0;
  while (gaps.length < RESAMPLES) {
    const a = draw(armA);
    const b = draw(armB);
    if (a === null || b === null) {
      degenerate += 1;
      if (degenerate > RESAMPLES) throw new Error('bootstrap: too many zero-decay resamples');
      continue;
    }
    gaps.push(a - b);
  }
  gaps.sort((x, y) => x - y);
  const q = (p) => gaps[Math.min(gaps.length - 1, Math.max(0, Math.floor(p * gaps.length)))];
  return {
    seed: BOOTSTRAP_SEED,
    resamples: RESAMPLES,
    degenerateRedraws: degenerate,
    ci95: [+q(0.025).toFixed(3), +q(0.975).toFixed(3)],
    shareBelowZero: +(gaps.filter((g) => g < 0).length / gaps.length).toFixed(4),
  };
}

function fmtRate(x) {
  return x === null ? '—' : x.toFixed(3);
}

function main() {
  if (!fs.existsSync(RUNS_DIR)) {
    console.error(`runs dir not found: ${RUNS_DIR}`);
    process.exit(1);
  }
  const runs = fs
    .readdirSync(RUNS_DIR)
    .map((name) => path.join(RUNS_DIR, name))
    .filter((p) => fs.existsSync(path.join(p, 'diagnosis.json')))
    .map(loadRun)
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));

  const lines = [];
  const say = (s = '') => {
    lines.push(s);
    console.log(s);
  };

  say(`# Unreliable-learner visibility contrast — mechanical scoring`);
  say();
  say(`group \`${GROUP}\` · ${runs.length}/${EXPECT} registered runs on file · scored ${new Date().toISOString()}`);
  say(`registration: UNRELIABLE-LEARNER-PREREG.md (endpoints §5, hypotheses §6)`);
  say();

  // --- per-run table + integrity ---------------------------------------
  const violations = [];
  const g2Breaks = [];
  say(`## Runs`);
  say();
  say(
    `| run | world | arm | seed | verdict | turns | decay | tutor repairs | per-slip | selected | mean latency | schedule |`,
  );
  say(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const r of runs) {
    if (!r.schedule.ok) violations.push(r);
    if (r.byReadoption > 0) g2Breaks.push(r);
    say(
      `| ${r.label} | ${r.world} | ${r.arm} | ${r.seed} | ${r.verdict} | ${r.turnsPlayed} | ${r.decayEvents} | ${r.byTutor} | ${fmtRate(r.perSlipRate)} | ${r.selectedCount} | ${r.meanRepairLatency ?? '—'} | ${r.schedule.ok ? 'ok' : 'VIOLATION'} |`,
    );
  }
  say();

  if (violations.length) {
    say(`**FROZEN-CHANNEL VIOLATION — EXPERIMENT HALTED (registration §8).** Affected runs:`);
    for (const r of violations) {
      say(`- ${r.label}: missing ${JSON.stringify(r.schedule.missing)} extra ${JSON.stringify(r.schedule.extra)}`);
    }
  }
  if (g2Breaks.length) {
    say(
      `**G2 BREAK — byReadoption > 0 in: ${g2Breaks.map((r) => r.label).join(', ')}.** The cross-check rate diverges from the primary by construction; reported per §5.`,
    );
  }

  // --- selected repairs, itemized (the H1b evidence) --------------------
  const repaired = runs.flatMap((r) => r.tutorRepairs.map((x) => ({ run: r.label, arm: r.arm, ...x })));
  if (repaired.length) {
    say(`## Tutor repairs, classified (selection signature §5)`);
    say();
    say(
      `| run | arm | premise | decay→repair | latency | last release at repair | non-lastRelease | critical | SELECTED |`,
    );
    say(`|---|---|---|---|---|---|---|---|---|`);
    for (const x of repaired) {
      say(
        `| ${x.run} | ${x.arm} | ${x.premiseId} | t${x.decayTurn}→t${x.repairTurn} | ${x.latency} | ${x.lastReleaseAtRepair} | ${x.nonLastRelease ? 'yes' : 'no'} | ${x.derivationCritical ? 'yes' : 'no'} | ${x.selected ? '**yes**' : 'no'} |`,
      );
    }
    say();
  }

  // --- pooled arms -------------------------------------------------------
  const armA = runs.filter((r) => r.arm === 'A');
  const armB = runs.filter((r) => r.arm === 'B');
  const A = pooled(armA);
  const B = pooled(armB);
  say(`## Pooled endpoints`);
  say();
  say(
    `| arm | runs | decay events | tutor repairs | pooled per-slip | cross-check | selected | decay/run | repairs/run | successes | stall-ended |`,
  );
  say(`|---|---|---|---|---|---|---|---|---|---|---|`);
  for (const [name, p] of [
    ['A (told)', A],
    ['B (conduct)', B],
  ]) {
    say(
      `| ${name} | ${p.runs} | ${p.decayEvents} | ${p.byTutor} | ${fmtRate(p.rate)} | ${fmtRate(p.crossCheckRate)} | ${p.selected} | ${p.decayPerRun ?? '—'} | ${p.repairsPerRun ?? '—'} | ${p.successes} | ${p.stallEnded} |`,
    );
  }
  say();
  say(
    `anchors (§4): incidental floor ${ANCHORS.incidentalFloor} · surfing ${ANCHORS.surfingRate} (decay/run ${ANCHORS.surfingDecayPerRun}) · eager decay/run ${ANCHORS.eagerDecayPerRun}`,
  );
  say();

  // --- hypotheses ---------------------------------------------------------
  const complete = runs.length === EXPECT && armA.length === EXPECT / 2 && armB.length === EXPECT / 2;
  const halted = violations.length > 0;
  say(`## Hypotheses (registration §6)`);
  say();

  let h1a = null;
  let h1b = null;
  let h1 = null;
  let h2 = null;
  let boot = null;
  if (armA.length && A.decayEvents > 0) {
    h1a = A.rate >= 0.66;
    const selectedPerRun = A.selected / armA.length;
    const selectedShare = A.byTutor ? A.selected / A.byTutor : 0;
    h1b = selectedPerRun >= 1 && selectedShare >= 0.5;
    h1 = h1a || h1b;
    say(`- **H1a** (arm-A pooled rate ≥ 0.66): rate ${fmtRate(A.rate)} → ${h1a ? 'PASS' : 'fail'}`);
    say(
      `- **H1b** (selected ≥ 1/run and ≥ 50% of repairs): ${selectedPerRun.toFixed(2)}/run, share ${(selectedShare * 100).toFixed(0)}% → ${h1b ? 'PASS' : 'fail'}`,
    );
    say(`- **H1** (arm A uses the channel): ${h1 ? '**SUPPORTED**' : '**NOT SUPPORTED**'}`);
  } else {
    say(`- **H1**: pending (no arm-A runs with decay events on file)`);
  }
  if (armA.length && armB.length && A.decayEvents > 0 && B.decayEvents > 0) {
    boot = bootstrapGap(armA, armB);
    const gap = A.rate - B.rate;
    h2 = B.rate < A.rate;
    say(
      `- **H2** (one-sided, B < A): A ${fmtRate(A.rate)} vs B ${fmtRate(B.rate)}, gap ${gap >= 0 ? '+' : ''}${gap.toFixed(3)} — direction ${h2 ? 'consistent with H2' : 'NOT consistent (B ≥ A)'}; bootstrap 95% CI [${boot.ci95[0]}, ${boot.ci95[1]}] (${boot.resamples} run-level resamples, seed ${boot.seed}); share of resamples with gap < 0: ${boot.shareBelowZero}`,
    );
    say(
      `  registered reading: B ≈ A is the fifth explicit-channel-redundancy result, reported with equal prominence; B > A at meaningful size triggers a G3 re-audit before interpretation.`,
    );
  } else {
    say(`- **H2**: pending (need decay events in both arms)`);
  }
  if (runs.length) {
    say(
      `- **H3** (exploratory parsimony): decay/run A ${A.decayPerRun ?? '—'}, B ${B.decayPerRun ?? '—'} vs surfing ${ANCHORS.surfingDecayPerRun} and eager ${ANCHORS.eagerDecayPerRun} — descriptive only.`,
    );
  }
  say();
  say(
    halted
      ? `**VERDICT: HALTED — frozen-channel violation (§8). No adjudication.**`
      : complete
        ? `**VERDICT: set complete (${runs.length}/${EXPECT}) — hypotheses adjudicated above.**`
        : `**VERDICT: PENDING — ${runs.length}/${EXPECT} runs on file (${armA.length} arm A, ${armB.length} arm B). Integrity checks above are live; adjudication waits for the full set.**`,
  );

  // --- artifacts -----------------------------------------------------------
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const scores = {
    group: GROUP,
    scoredAt: new Date().toISOString(),
    registration: 'UNRELIABLE-LEARNER-PREREG.md',
    expect: EXPECT,
    runs,
    pooled: { A, B },
    hypotheses: { h1a, h1b, h1, h2, bootstrap: boot },
    integrity: { scheduleViolations: violations.map((r) => r.label), g2Breaks: g2Breaks.map((r) => r.label) },
    complete,
    halted,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'scores.json'), `${JSON.stringify(scores, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), `${lines.join('\n')}\n`);
  console.log(`\nartifacts ${path.relative(ROOT, OUT_DIR)}/{scores.json, report.md}`);
  if (halted) process.exit(2);
}

main();
