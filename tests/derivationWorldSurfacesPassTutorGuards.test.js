import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { auditTutorStubClueDeliveryMultiplicity } from '../services/tutorStubDramaticRelease.js';
import { createTutorStubResponseLeakAudit } from '../services/tutorStubResponseLeakAudit.js';
import { createTutorStubPublicEvidenceModel } from '../services/tutorStubPublicEvidence.js';

// Regression for the 2026-09-03 step-6 pool-widening runs. Two worlds (042,
// 043) shipped a premise surface that the tutor stub's own guards reject when
// the deterministic fallback quotes it verbatim: one leaked the answer words
// next to the predicate head (private_final_conclusion), one repeated its own
// clue across two sentences (duplicate_clue_delivery). Both dialogues died on
// the first such turn, after paid calls. This check runs the same two guards
// over every premise surface offline, at the turn the schedule releases it.

const here = path.dirname(fileURLToPath(import.meta.url));
const worldDir = path.join(here, '..', 'config', 'drama-derivation');

function worldFiles() {
  return fs
    .readdirSync(worldDir)
    .filter((f) => /^world-\d+.*\.ya?ml$/.test(f))
    .sort()
    .map((f) => path.join(worldDir, f));
}

export function auditWorldPremiseSurfaces(file) {
  const world = loadWorld(file);
  const leak = createTutorStubResponseLeakAudit({
    publicEvidenceModel: createTutorStubPublicEvidenceModel({}),
  });
  const schedule = world.releaseSchedule || [];
  const turnOf = Object.fromEntries(schedule.map((r) => [r.premise, r.turn]));
  const rows = [];
  for (const p of world.premises || []) {
    const turn = turnOf[p.id] ?? 1;
    const publicPremiseIds = (world.premises || []).filter((q) => (turnOf[q.id] ?? 1) <= turn).map((q) => q.id);
    const dup = auditTutorStubClueDeliveryMultiplicity({
      text: p.surface,
      frame: { active: true, entries: [{ premise: p.id, surface: p.surface }] },
    });
    if (!dup.ok) rows.push(`${p.id}@t${turn} duplicate_clue_delivery`);
    const lk = leak.auditTutorResponseLeak({
      text: p.surface,
      world,
      tutorTurn: turn,
      learnerText: '',
      publicPremiseIds,
    });
    for (const l of lk.leaks || []) rows.push(`${p.id}@t${turn} ${l.type}`);
  }
  return rows;
}

test('every drama world premise surface passes the tutor leak and duplicate-clue guards at its release turn', () => {
  const failures = [];
  for (const file of worldFiles()) {
    const rows = auditWorldPremiseSurfaces(file);
    if (rows.length) failures.push(`${path.basename(file)}: ${rows.join(', ')}`);
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('the guard check catches the two surfaces that failed live on 2026-09-03', () => {
  const w042 = loadWorld(path.join(worldDir, 'world-042-half-a-moon.yaml'));
  const w043 = loadWorld(path.join(worldDir, 'world-043-tails-is-due.yaml'));
  const leak = createTutorStubResponseLeakAudit({
    publicEvidenceModel: createTutorStubPublicEvidenceModel({}),
  });
  const torch =
    "Torch on. The football's shadow lies along the bench straight away from the torch. The tennis ball, out to the side where the Moon is tonight, is nowhere near that shadow, and the torch lights one whole half of it. Nothing is in the way of anything.";
  const torchLeak = leak.auditTutorResponseLeak({
    text: torch,
    world: w042,
    tutorTurn: 3,
    learnerText: '',
    publicPremiseIds: w042.premises
      .filter((p) => (w042.releaseSchedule.find((r) => r.premise === p.id)?.turn ?? 1) <= 3)
      .map((p) => p.id),
  });
  assert.ok(
    (torchLeak.leaks || []).some((l) => l.type === 'private_final_conclusion'),
    'old p_torch surface must trip private_final_conclusion',
  );
  const fresh =
    'Ask the coin, before the fifth toss, what it remembers. Nothing. It has no mark on it from the last four throws and no way to know they happened. The fifth toss is a fresh coin in a fresh hand, exactly as the first toss was.';
  const dup = auditTutorStubClueDeliveryMultiplicity({
    text: fresh,
    frame: { active: true, entries: [{ premise: 'p_fresh', surface: fresh }] },
  });
  assert.equal(dup.ok, false, 'old p_fresh surface must trip duplicate_clue_delivery');
  assert.ok(w043.premiseById?.p_fresh || w043.premises.some((p) => p.id === 'p_fresh'));
});
