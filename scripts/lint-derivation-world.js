#!/usr/bin/env node
/**
 * plotLint runner — the EXACT, FREE leak screen for dramatic-derivation
 * worlds (notes/2026-06-09-dramatic-derivation-plan.md §2.1 "Formal (exact, free)").
 *
 * Validates the authored plot against the slope constraints before any model
 * is involved: anti-reveal prefix walk (no release prefix entails S before
 * t_min), resolvability (the full schedule entails S), mirror non-entailment,
 * schedule completeness, and secret-is-earned (S is not a base fact). Then
 * prints the planned dramaturgy as numbers: the release table with the D(t)
 * staircase under instant adoption, and the anti-aporia gap check.
 *
 * Usage:
 *   node scripts/lint-derivation-world.js [--world config/drama-derivation/world-001-nocturne.yaml]
 *
 * Exit code 0 iff the plot lint passes AND no planned release gap exceeds
 * the aporia window.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld, plotLint, worldClosure } from '../services/dramaticDerivation/index.js';
import { derivationDistance } from '../services/dramaticDerivation/slope.js';
import { factKey } from '../services/dramaticDerivation/chainer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const worldPath = path.resolve(ROOT, arg('world', 'config/drama-derivation/world-001-nocturne.yaml'));
const world = loadWorld(worldPath);
const lint = plotLint(world);

console.log(`world: ${world.id} (${world.title})`);
console.log(`slope: t_min=${world.slope.t_min} aporia_window=${world.slope.aporia_window} turn_cap=${world.turnCap}`);
console.log(`paths: ${world.proofPaths.length} authored; releases: ${world.releaseSchedule.length}`);
console.log(`plot lint: ${lint.ok ? 'OK' : 'FAIL'} (first entailment at turn ${lint.firstEntailedTurn})`);
for (const err of lint.errors) console.error(`  lint error: ${err}`);

// Walk the schedule under instant adoption: the PLANNED staircase. Track the
// gap between strict D decreases against the aporia window (mirror-fuel
// releases do not move D — the plan must not let them pile up).
const adopted = [...world.background];
let gapErrors = 0;
let lastDropTurn = null;
let prevD = derivationDistance(world, adopted);
console.log(`\nturn  via       premise       D(t)  note`);
console.log(`   0  —         (curtain)     ${String(prevD).padStart(4)}`);
for (const entry of world.releaseSchedule) {
  adopted.push(world.premiseById.get(entry.premise).fact);
  const D = derivationDistance(world, adopted);
  const dropped = D < prevD;
  if (dropped) {
    const from = lastDropTurn === null ? world.releaseSchedule[0].turn : lastDropTurn;
    if (entry.turn - from > world.slope.aporia_window) {
      gapErrors += 1;
      console.error(`  gap error: no D decrease between turn ${from} and ${entry.turn} (> window)`);
    }
    lastDropTurn = entry.turn;
  }
  const forced = D === 0;
  const note = forced ? 'S FORCED' : dropped ? '' : 'no D move (texture/mirror fuel)';
  console.log(
    `${String(entry.turn).padStart(4)}  ${entry.via.padEnd(8)}  ${entry.premise.padEnd(12)}  ${String(D).padStart(4)}  ${note}`,
  );
  prevD = D;
}

// What the full closure knows at the end (the resolved world), for the eye.
const finalClosure = worldClosure(world, adopted);
const derived = [...finalClosure.facts.values()].filter(
  (fact) => !adopted.some((base) => factKey(base) === factKey(fact)),
);
console.log(`\nclosure at full release: ${finalClosure.facts.size} facts (${derived.length} derived):`);
for (const fact of derived) console.log(`  ⊢ ${fact.join(' ')}`);

const ok = lint.ok && gapErrors === 0;
console.log(`\n${ok ? 'LINT PASS' : 'LINT FAIL'}`);
process.exit(ok ? 0 : 1);
