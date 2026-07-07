// The visible pacing guard (Step 1 V arm): form-matched to the hidden guard, but
// deciding from transcript-visible features only. The first test is the one that
// matters most — the audit invariant that proves V cannot consult hidden state.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  visibleSurfaceFeatures,
  visibleGuardDecision,
  VISIBLE_GUARD_DEFAULTS,
} from '../services/dramaticDerivation/visiblePacing.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A synthetic world is enough — the guard only needs premiseById for surface
// lookups; it never touches the proof DAG.
const world = {
  premiseById: new Map([
    ['p_bearing', { id: 'p_bearing', surface: 'The watermark shows a crowned anchor pressed into the laid lines.' }],
    ['p_chart', { id: 'p_chart', surface: 'The harbour chart marks a sounding of seven fathoms off the mole.' }],
  ]),
};

// ---------------------------------------------------------------------------
// the audit invariant — V sees only the page
// ---------------------------------------------------------------------------

test('visiblePacing.js imports no hidden-state module (the V-arm integrity invariant)', () => {
  const src = readFileSync(path.join(ROOT, 'services/dramaticDerivation/visiblePacing.js'), 'utf8');
  // No import of the hidden-state modules…
  assert.doesNotMatch(src, /from\s+['"]\.\/slope\.js['"]/, 'must not import slope.js (D / detectStall)');
  assert.doesNotMatch(src, /from\s+['"]\.\/pacing\.js['"]/, 'must not import pacing.js (releaseSolvency)');
  // …and no reference to the hidden-state primitives by name.
  for (const forbidden of ['derivationDistance', 'detectStall', 'releaseSolvency', 'simulateReleaseTempo']) {
    assert.ok(!src.includes(forbidden), `must not reference hidden-state primitive ${forbidden}`);
  }
});

// ---------------------------------------------------------------------------
// surface features
// ---------------------------------------------------------------------------

test('visibleSurfaceFeatures reads release timing and prior-exhibit echo off the page', () => {
  const ledger = [{ turn: 4, premiseId: 'p_bearing' }];
  const transcript = [
    { turn: 4, role: 'tutor', text: 'Consider what the paper itself shows.' },
    {
      turn: 5,
      role: 'learner',
      text: 'The watermark — a crowned anchor pressed into the laid lines. That places the mill.',
    },
  ];
  const f = visibleSurfaceFeatures(world, { turn: 6, ledger, transcript });
  assert.equal(f.priorPremiseId, 'p_bearing');
  assert.equal(f.turnsSinceLastRelease, 2);
  assert.ok(f.priorEcho >= VISIBLE_GUARD_DEFAULTS.echoThreshold, 'strong echo of the bearing surface is detected');
  assert.equal(f.priorEchoed, true);
});

test('visibleSurfaceFeatures flags an un-echoed prior exhibit', () => {
  const ledger = [{ turn: 4, premiseId: 'p_bearing' }];
  const transcript = [{ turn: 5, role: 'learner', text: 'I really am not sure where any of this is heading.' }];
  const f = visibleSurfaceFeatures(world, { turn: 5, ledger, transcript });
  assert.equal(f.priorEchoed, false, 'no surface overlap with the bearing exhibit');
  assert.ok(f.priorEcho < VISIBLE_GUARD_DEFAULTS.echoThreshold);
});

// ---------------------------------------------------------------------------
// the decision — same {played, blocked, forcedSafe} vocabulary as the hidden guard
// ---------------------------------------------------------------------------

test('visibleGuardDecision blocks a release whose prior exhibit is not taken up', () => {
  const view = {
    ledger: [{ turn: 4, premiseId: 'p_bearing' }],
    transcript: [{ turn: 5, role: 'learner', text: 'Hard to say. I do not know what to make of it.' }],
  };
  const d = visibleGuardDecision(world, view, {
    turn: 5,
    playable: [{ premise: 'p_chart', turn: 9 }],
    validClaim: 'p_chart',
    forcedPlay: null,
  });
  assert.equal(d.blocked, true);
  assert.equal(d.played, null);
  assert.equal(d.forcedSafe, false);
  assert.match(d.reason, /not taken up/);
});

test('visibleGuardDecision passes a release through once the prior exhibit is echoed', () => {
  const view = {
    ledger: [{ turn: 4, premiseId: 'p_bearing' }],
    transcript: [
      {
        turn: 5,
        role: 'learner',
        text: 'The crowned anchor watermark, pressed into the laid lines — yes, that fixes the mill.',
      },
    ],
  };
  const d = visibleGuardDecision(world, view, {
    turn: 6,
    playable: [{ premise: 'p_chart', turn: 9 }],
    validClaim: 'p_chart',
    forcedPlay: null,
  });
  assert.equal(d.blocked, false);
  assert.equal(d.played, 'p_chart');
  assert.equal(d.forcedSafe, false);
});

test('visibleGuardDecision pushes the earliest playable exhibit when the page stalls and the tutor holds', () => {
  // No release yet (turnsSinceLastRelease = turn = 4 ≥ staleCap) and the tutor
  // declares no release → V forces the earliest playable.
  const view = {
    ledger: [],
    transcript: [{ turn: 3, role: 'learner', text: 'I am stuck. Not sure. Maybe?' }],
  };
  const d = visibleGuardDecision(world, view, {
    turn: 4,
    playable: [
      { premise: 'p_chart', turn: 9 },
      { premise: 'p_bearing', turn: 4 },
    ],
    validClaim: null,
    forcedPlay: null,
  });
  assert.equal(d.forcedSafe, true);
  assert.equal(d.forcedBy, 'visible_stall');
  assert.equal(d.played, 'p_bearing', 'earliest-scheduled playable is pushed');
  assert.match(d.reason, /stalling/);
});

test('visibleGuardDecision yields to a hard hold-limit force without intervening', () => {
  const view = { ledger: [], transcript: [] };
  const d = visibleGuardDecision(world, view, {
    turn: 11,
    playable: [{ premise: 'p_chart', turn: 9 }],
    validClaim: null,
    forcedPlay: { premise: 'p_chart', turn: 9 },
  });
  assert.equal(d.played, 'p_chart');
  assert.equal(d.blocked, false);
  assert.equal(d.forcedSafe, false, 'the calendar forced it, not the guard');
});
