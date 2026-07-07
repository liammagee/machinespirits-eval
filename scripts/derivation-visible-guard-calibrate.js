#!/usr/bin/env node
/**
 * Visible-guard (V) calibration / confound-control replay — Step 1 of the
 * generalization plan, the FREE pre-flight for the paid V-fan.
 *
 * Why this exists. The plan's confound control (ADAPTIVE-TUTOR-GENERALIZATION-PLAN.md
 * §"Step 1 … Engineering") asks that V's intervention frequency be "tuned on a free
 * mock pass so V narrows about as often as H." That instruction is degenerate as
 * written: the hidden guard H fired ZERO enforcement interventions (block / force)
 * over its whole real fan — its lift ran through the always-on prompt channel, not
 * through enforcement. "Tune V to narrow as often as H" would therefore mean "tune V
 * to a no-op." This script replaces the degenerate mock-tune with the measurement the
 * confound control actually needs: a COUNTERFACTUAL REPLAY of V's real decision
 * function over the FROZEN H-fan and baseline transcripts ($0, read-only).
 *
 * It does NOT run any model and writes NOTHING into the run artifacts — it reconstructs,
 * turn by turn, the exact `view` / `playable` / `validClaim` / `forcedPlay` the live
 * bridge passed the guard (mirroring services/dramaticDerivation/llmRoles.js:1234-1242,
 * 1624), then calls the real `visibleGuardDecision` and counts where V *would* have
 * intervened. A built-in self-check asserts the reconstructed `playable.length` equals
 * each frozen decision row's recorded `windowSize`; if that holds across every row the
 * reconstruction is faithful to what the engine computed.
 *
 * Output: per-arm and per-group V-would-intervene counts, beside H's measured
 * enforcement (0), so the registration can state whether V sits in H's intervention
 * regime — and, if it does not, which threshold to pull before any paid spend.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { visibleGuardDecision, VISIBLE_GUARD_DEFAULTS } from '../services/dramaticDerivation/visiblePacing.js';
import { RELEASE_LATITUDE } from '../services/dramaticDerivation/llmRoles.js';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const loopDir = flag('loop-dir', 'exports/dramatic-derivation/loop');
const worldPath = flag('world', 'config/drama-derivation/world-002-lantern.yaml');

// The two frozen groups the contrast reads off: the 4/10 unguarded baseline fans and
// the E2 hidden-guard fan. Both are on disk; neither is touched.
const BASELINE_ARMS = Array.from({ length: 10 }, (_, i) => `lantern-e2-real-r${i + 1}`);
const H_ARMS = Array.from({ length: 5 }, (_, i) => `lantern-e2-guard-r${i + 1}`);

// Threshold overrides (so a retune can be tried without editing the module). Any of
// echoThreshold / staleCap / hedgeRise / lenDrop / windowSize.
const overrides = {};
for (const k of Object.keys(VISIBLE_GUARD_DEFAULTS)) {
  const v = flag(k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)); // echoThreshold -> --echo-threshold
  if (v != null) overrides[k] = Number(v);
}
const thresholds = { ...VISIBLE_GUARD_DEFAULTS, ...overrides };

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

// Reconstruct the ledger the tutor saw when it decided turn t. Within a turn the order
// is director -> tutor -> learner (verified in the transcripts), so a director drop at
// turn t is already on the page; the tutor's own turn-t release is what is being decided
// and is NOT yet in the ledger.
function ledgerAsOf(ledger, t) {
  return (ledger || []).filter((e) => e.turn < t || (e.turn === t && e.via === 'director'));
}

// Learner lines the tutor had seen by its turn-t decision (the learner speaks last in
// the turn, so strictly < t).
function transcriptAsOf(transcript, t) {
  return (transcript || []).filter((l) => l.turn < t);
}

function replayArm(world, arm) {
  const dir = path.join(loopDir, arm);
  const resultPath = path.join(dir, 'result.json');
  const diagnosisPath = path.join(dir, 'diagnosis.json');
  if (!existsSync(resultPath) || !existsSync(diagnosisPath)) {
    return { arm, missing: true };
  }
  const result = readJson(resultPath);
  const diagnosis = readJson(diagnosisPath);
  const decisions = diagnosis?.releaseDeviations?.decisions || [];

  let vBlocks = 0;
  let vPushes = 0;
  let hEnforce = 0; // H's measured enforcement on this arm (0 expected on baseline/guard alike)
  let windowMismatches = 0;
  const fires = [];

  for (const dr of decisions) {
    const t = dr.turn;
    const viewLedger = ledgerAsOf(result.ledger, t);
    const viewTranscript = transcriptAsOf(result.transcript, t);
    const alreadyReleased = new Set(viewLedger.map((e) => e.premiseId));

    // playable / forcedPlay — byte-mirror of llmRoles.js:1235-1242 (release authority on,
    // which both frozen groups ran).
    const playable = world.releaseSchedule.filter(
      (e) => e.via === 'tutor' && !alreadyReleased.has(e.premise) && t >= e.turn - RELEASE_LATITUDE,
    );
    const forcedPlay =
      playable.filter((e) => t >= e.turn + RELEASE_LATITUDE).sort((a, b) => a.turn - b.turn)[0] || null;

    // Self-check: the engine recorded windowSize = playable.length at this turn.
    if (typeof dr.windowSize === 'number' && dr.windowSize !== playable.length) windowMismatches += 1;

    // validClaim — what the tutor actually declared, kept iff it was a playable premise.
    const validClaim = dr.claimed && !dr.invalidClaim ? dr.claimed : null;

    const view = { turn: t, ledger: viewLedger, transcript: viewTranscript };
    const v = visibleGuardDecision(world, view, { turn: t, playable, validClaim, forcedPlay, thresholds });
    if (v.blocked) {
      vBlocks += 1;
      fires.push({ turn: t, kind: 'block', reason: v.reason });
    }
    if (v.forcedSafe) {
      vPushes += 1;
      fires.push({ turn: t, kind: 'push', reason: v.reason });
    }

    // H's own enforcement, straight off the frozen row (only the guard arms carry it).
    const g = dr.pacingGuard || {};
    if (g.blocked || g.forcedSafe) hEnforce += 1;
  }

  return {
    arm,
    verdict: diagnosis.verdict,
    turns: diagnosis.turnsPlayed,
    decisions: decisions.length,
    vBlocks,
    vPushes,
    vInterventions: vBlocks + vPushes,
    hEnforce,
    windowMismatches,
    fires,
  };
}

function summarize(label, rows) {
  const live = rows.filter((r) => !r.missing);
  const dec = live.reduce((s, r) => s + r.decisions, 0);
  const vInt = live.reduce((s, r) => s + r.vInterventions, 0);
  const vBlk = live.reduce((s, r) => s + r.vBlocks, 0);
  const vPsh = live.reduce((s, r) => s + r.vPushes, 0);
  const hEnf = live.reduce((s, r) => s + r.hEnforce, 0);
  const mism = live.reduce((s, r) => s + r.windowMismatches, 0);
  return {
    label,
    arms: live.length,
    decisions: dec,
    vInterventions: vInt,
    vBlocks: vBlk,
    vPushes: vPsh,
    hEnforce: hEnf,
    windowMismatches: mism,
  };
}

const world = loadWorld(worldPath);

console.log('Visible-guard (V) counterfactual replay — confound-control pre-flight');
console.log(`world=${world.id}  RELEASE_LATITUDE=${RELEASE_LATITUDE}`);
console.log(`thresholds=${JSON.stringify(thresholds)}`);
console.log('');

for (const [label, arms] of [
  ['BASELINE (unguarded, 4/10 fans)', BASELINE_ARMS],
  ['H (hidden pacing guard)', H_ARMS],
]) {
  const rows = arms.map((a) => replayArm(world, a));
  console.log(`== ${label} ==`);
  for (const r of rows) {
    if (r.missing) {
      console.log(`  MISS  ${r.arm}`);
      continue;
    }
    const fireStr = r.fires.length ? '  ' + r.fires.map((f) => `${f.kind}@t${f.turn}`).join(' ') : '';
    console.log(
      `  ${r.arm.padEnd(22)} ${String(r.verdict).padEnd(20)} dec=${String(r.decisions).padStart(2)} ` +
        `V-int=${r.vInterventions} (blk ${r.vBlocks} / push ${r.vPushes})  H-enf=${r.hEnforce}` +
        (r.windowMismatches ? `  !!window-mismatch=${r.windowMismatches}` : '') +
        fireStr,
    );
  }
  const s = summarize(label, rows);
  console.log(
    `  ---- ${label}: ${s.arms} arms, ${s.decisions} decisions | ` +
      `V would intervene ${s.vInterventions} (blk ${s.vBlocks}/push ${s.vPushes}) | H enforced ${s.hEnforce} | ` +
      `window-mismatches ${s.windowMismatches}`,
  );
  console.log('');
}

console.log(
  'Read: H enforced 0 by construction of the fan; the confound is neutralized iff V would-intervene\n' +
    'sits in the same low regime. A window-mismatch > 0 means the replay diverged from the recorded\n' +
    'engine state and the numbers above are NOT trustworthy — fix before quoting.',
);
