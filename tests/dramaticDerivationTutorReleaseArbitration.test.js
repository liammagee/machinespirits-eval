import assert from 'node:assert/strict';
import test from 'node:test';

import { matchFrontierClaim, resolveTutorRelease } from '../services/dramaticDerivation/tutorReleaseArbitration.js';

const schedule = [
  { turn: 5, premise: 'p2', via: 'tutor' },
  { turn: 8, premise: 'p3', via: 'tutor' },
];

function releaseContext(overrides = {}) {
  const { view: viewOverrides = {}, ...contextOverrides } = overrides;
  const view = {
    turn: 5,
    ledger: [],
    transcript: [],
    scene: null,
    lemmaLayer: null,
    ...viewOverrides,
  };
  return {
    output: { release: 'p2', release_reason: 'on cue' },
    world: { releaseSchedule: schedule },
    releaseAuthority: true,
    scheduledEntry: null,
    playable: [schedule[0]],
    forcedPlay: null,
    pacingGuard: false,
    runtimeMonitor: null,
    visibleGuard: false,
    visiblePushProbeGuard: false,
    visibleConsolidationGuard: false,
    visibleConsolidation: null,
    pacingRows: [],
    topProofDebt: null,
    forcedNote: null,
    finalEntitlement: null,
    highDiscursiveStrain: false,
    discursiveCalibrationState: null,
    auditPublicReleaseContent: () => ({ voiced: false, action: 'hold', matches: [] }),
    releaseLatitude: 2,
    ...contextOverrides,
    view,
  };
}

test('fixed-schedule mode returns only the authored cue', () => {
  const out = resolveTutorRelease(
    releaseContext({
      releaseAuthority: false,
      scheduledEntry: schedule[0],
      output: { release: 'p3' },
    }),
  );
  assert.deepEqual(out, { release: 'p2' });
});

test('release authority records valid and invalid claims without changing the public shape', () => {
  const valid = resolveTutorRelease(releaseContext());
  assert.equal(valid.release, 'p2');
  assert.equal(valid.releaseReason, 'on cue');
  assert.deepEqual(
    {
      claimed: valid.releaseDecision.claimed,
      invalidClaim: valid.releaseDecision.invalidClaim,
      played: valid.releaseDecision.played,
      offset: valid.releaseDecision.offset,
    },
    { claimed: 'p2', invalidClaim: false, played: 'p2', offset: 0 },
  );

  const invalid = resolveTutorRelease(releaseContext({ output: { release: 'p3', release_reason: 'too early' } }));
  assert.equal(invalid.release, null);
  assert.equal(invalid.releaseDecision.claimed, 'p3');
  assert.equal(invalid.releaseDecision.invalidClaim, true);
  assert.equal(invalid.releaseDecision.played, null);
});

test('hidden pacing delegates to the runtime monitor and reports a forced-safe decision', () => {
  let monitorInput = null;
  const hiddenDecision = {
    played: 'p2',
    blocked: false,
    forcedSafe: true,
    forcedBy: 'last_safe_turn',
    candidate: null,
    alternative: 'p2',
    reason: 'last safe turn',
    safeTurns: { p2: [5] },
    playedSolvency: { safe: true, forcedTurn: 5 },
    runtimeMonitor: { guard: 'hidden_pacing' },
  };
  const out = resolveTutorRelease(
    releaseContext({
      output: { release: null },
      pacingGuard: true,
      runtimeMonitor: {
        hiddenPacingDecision(input) {
          monitorInput = input;
          return hiddenDecision;
        },
      },
    }),
  );
  assert.deepEqual(monitorInput, {
    ledger: [],
    turn: 5,
    playable: [schedule[0]],
    validClaim: null,
    forcedPlay: null,
  });
  assert.equal(out.release, 'p2');
  assert.equal(out.releaseDecision.overridden, true);
  assert.equal(out.releaseDecision.pacingGuard.forcedBy, 'last_safe_turn');
  assert.deepEqual(out.releaseDecision.pacingGuard.runtimeMonitor, { guard: 'hidden_pacing' });
});

test('a proof-closing candidate is selected when the hidden guard otherwise holds', () => {
  const pacingRow = {
    ...schedule[0],
    safeTurns: [5],
    current: { safe: true, forcedTurn: 5, endTurn: 9 },
  };
  const out = resolveTutorRelease(
    releaseContext({
      output: { release: null },
      pacingGuard: true,
      pacingRows: [pacingRow],
      runtimeMonitor: {
        hiddenPacingDecision: () => ({
          played: null,
          blocked: false,
          forcedSafe: false,
          safeTurns: { p2: [5] },
        }),
      },
    }),
  );
  assert.equal(out.release, 'p2');
  assert.equal(out.releaseDecision.pacingGuard.forcedBy, 'proof_closing_candidate');
  assert.equal(out.releaseDecision.pacingGuard.playedSolvency.forcedTurn, 5);
});

test('lemma binding records the opening choice and holds unsupported voluntary releases', () => {
  const frontier = [
    { key: 'lemma-a', label: 'joins(a)', support: ['p3'] },
    { key: 'lemma-b', label: 'opens(b)', support: ['p2'] },
  ];
  const out = resolveTutorRelease(
    releaseContext({
      output: { release: 'p2', active_lemma: 'joins' },
      view: {
        turn: 5,
        scene: { startTurn: 5 },
        lemmaLayer: {
          config: { bind: true },
          frontier,
          activeKey: null,
          proofPremiseIds: ['p2', 'p3'],
        },
      },
    }),
  );
  assert.equal(out.release, null);
  assert.equal(out.lemma.choice.key, 'lemma-a');
  assert.equal(out.lemma.choice.by, 'tutor');
  assert.deepEqual(out.lemma.blocked, { premise: 'p2' });
  assert.equal(out.releaseDecision.lemmaGate.premise, 'p2');
});

test('lemma departures license out-of-support releases and preserve the stated reason', () => {
  const out = resolveTutorRelease(
    releaseContext({
      output: {
        release: 'p2',
        active_lemma: 'joins(a)',
        lemma_departure: 'the learner has already supplied the missing bridge',
      },
      view: {
        turn: 5,
        scene: { startTurn: 5 },
        lemmaLayer: {
          config: { bind: true },
          frontier: [{ key: 'lemma-a', label: 'joins(a)', support: ['p3'] }],
          activeKey: null,
          proofPremiseIds: ['p2', 'p3'],
        },
      },
    }),
  );
  assert.equal(out.release, 'p2');
  assert.deepEqual(out.lemma.departure, {
    premise: 'p2',
    reason: 'the learner has already supplied the missing bridge',
  });
  assert.equal(out.releaseDecision.lemmaGate, undefined);
});

test('high public strain holds discretionary early releases unless their content was already voiced', () => {
  const strained = {
    highDiscursiveStrain: true,
    discursiveCalibrationState: {
      publicPosture: 'friction',
      advisory: { pressure: 'high' },
    },
    view: { turn: 4 },
    output: { release: 'p2', dialogue: 'Let us wait.' },
  };
  const held = resolveTutorRelease(releaseContext(strained));
  assert.equal(held.release, null);
  assert.equal(held.releaseDecision.discursiveReleaseGate.held, true);
  assert.equal(held.releaseDecision.discursiveReleaseGate.offset, -1);

  const voiced = resolveTutorRelease(
    releaseContext({
      ...strained,
      auditPublicReleaseContent: () => ({
        voiced: true,
        action: 'registered_release',
        matches: ['bearing', 'north'],
      }),
    }),
  );
  assert.equal(voiced.release, 'p2');
  assert.equal(voiced.releaseDecision.discursiveReleaseGate.held, false);
  assert.equal(voiced.releaseDecision.discursiveReleaseGate.publicContentOverride, true);
});

test('frontier matching accepts exact, normalized, and unique predicate claims', () => {
  const frontier = [
    { key: 'a', label: 'joins ( a )' },
    { key: 'b', label: 'opens(b)' },
  ];
  assert.equal(matchFrontierClaim(frontier, 'joins ( a )').key, 'a');
  assert.equal(matchFrontierClaim(frontier, 'joins(a)').key, 'a');
  assert.equal(matchFrontierClaim(frontier, 'opens').key, 'b');
  assert.equal(matchFrontierClaim(frontier, 'missing'), null);
});
