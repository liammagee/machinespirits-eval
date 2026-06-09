#!/usr/bin/env node
/**
 * Dramatic-derivation harness smoke (phase 1 step 1 of
 * notes/dramatic-derivation-plan.md §3): deterministic mock roles drive the
 * engine end-to-end with ZERO model calls and ZERO DB writes. Verifies the
 * plot lint, the happy path to grounded anagnorisis, and that the failure
 * taxonomy detects seeded lucky-leap / stall / mirror behaviors.
 *
 * Usage:
 *   node scripts/run-derivation-smoke.js
 *     [--world config/drama-derivation/world-000-smoke.yaml]
 *     [--out exports/dramatic-derivation/smoke]
 *
 * Exit code 0 iff every scenario produced its expected verdict/events.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadWorld,
  plotLint,
  runDrama,
  makeMockDirector,
  makeMockTutor,
  makeMockLearner,
} from '../services/dramaticDerivation/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const worldPath = path.resolve(ROOT, arg('world', 'config/drama-derivation/world-000-smoke.yaml'));
const outDir = path.resolve(ROOT, arg('out', 'exports/dramatic-derivation/smoke'));

const world = loadWorld(worldPath);
const lint = plotLint(world);
console.log(`world: ${world.id} (${world.title})`);
console.log(
  `plot lint: ${lint.ok ? 'OK' : 'FAIL'} (first entailment at turn ${lint.firstEntailedTurn}, t_min ${world.slope.t_min})`,
);
if (!lint.ok) {
  for (const err of lint.errors) console.error(`  lint error: ${err}`);
  process.exit(1);
}

const SCENARIOS = [
  {
    name: 'happy_path',
    policy: {},
    expectVerdict: 'grounded_anagnorisis',
    expectEvents: ['grounded_anagnorisis'],
  },
  {
    name: 'lucky_leap_then_grounded',
    policy: { luckyLeapAt: 6, leapFact: world.secret.fact },
    expectVerdict: 'grounded_anagnorisis',
    expectEvents: ['lucky_leap', 'grounded_anagnorisis'],
  },
  {
    name: 'stalled_learner',
    policy: { stallAfter: 5 },
    expectVerdict: 'disengagement',
    expectEvents: ['disengagement'],
  },
  {
    name: 'mirror_convergence',
    policy: { assertMirrorAt: 6, mirrorFact: world.mirror.fact, stallAfter: 6 },
    expectVerdict: 'mirror',
    expectEvents: ['mirror'],
  },
];

fs.mkdirSync(outDir, { recursive: true });
let failures = 0;

for (const scenario of SCENARIOS) {
  const result = await runDrama({
    world,
    roles: {
      director: makeMockDirector(world),
      tutor: makeMockTutor(world),
      learner: makeMockLearner(scenario.policy),
    },
  });

  const eventTypes = result.events.map((e) => e.type);
  const verdictOk = result.verdict === scenario.expectVerdict;
  const eventsOk = scenario.expectEvents.every((t) => eventTypes.includes(t));
  if (!verdictOk || !eventsOk) failures += 1;

  const dCurve = result.trajectory.map((p) => p.D).join(' ');
  console.log(
    `${verdictOk && eventsOk ? 'PASS' : 'FAIL'}  ${scenario.name.padEnd(26)} verdict=${result.verdict.padEnd(22)} turns=${String(result.turnsPlayed).padEnd(3)} D(t)=[${dCurve}]`,
  );
  if (!verdictOk) {
    console.error(`      expected verdict ${scenario.expectVerdict}, got ${result.verdict}`);
  }
  if (!eventsOk) {
    console.error(`      expected events ${scenario.expectEvents.join(',')}, got ${eventTypes.join(',') || '(none)'}`);
  }

  const outPath = path.join(outDir, `${world.id}-${scenario.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
}

console.log(failures === 0 ? 'smoke: all scenarios PASS' : `smoke: ${failures} scenario(s) FAILED`);
console.log(`artifacts: ${path.relative(ROOT, outDir)}/`);
process.exit(failures === 0 ? 0 : 1);
