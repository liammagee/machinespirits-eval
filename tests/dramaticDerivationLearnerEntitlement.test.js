import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  deriveEntitlementState,
  LEARNER_ENTITLEMENT_SCHEMA,
  loadWorld,
  pacingGuardDecision,
  selectConductMove,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smokeWorld = loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));

test('deriveEntitlementState sanitizes proof-debt fields for public conduct use', () => {
  const entitlement = deriveEntitlementState({
    view: { turn: 7, transcript: [] },
    proofDebtTutorView: {
      active: true,
      debts: [
        {
          premiseId: 'p1',
          surface: 'Marin is Tessa child',
          sinceTurn: 5,
          dNow: 4,
          proofPath: ['p1', 'p2'],
          secret: ['heir', 'marin'],
        },
      ],
    },
  });

  assert.equal(entitlement.schema, LEARNER_ENTITLEMENT_SCHEMA);
  assert.equal(entitlement.proofDebt.active, true);
  assert.deepEqual(entitlement.proofDebt.debts, [
    { premiseId: 'p1', surface: 'Marin is Tessa child', sinceTurn: 5 },
  ]);
  const json = JSON.stringify(entitlement);
  assert.doesNotMatch(json, /dNow|proofPath|secret|heir/u);
});

test('deriveEntitlementState distinguishes tempo-safe early window from current authorization', () => {
  const ledger = [
    { turn: 2, premiseId: 'p1', via: 'director' },
    { turn: 4, premiseId: 'p4', via: 'director' },
    { turn: 5, premiseId: 'p2', via: 'tutor' },
  ];
  const playable = [{ turn: 8, premise: 'p3', via: 'tutor' }];
  const guard = pacingGuardDecision(smokeWorld, ledger, {
    turn: 6,
    playable,
    validClaim: 'p3',
    forcedPlay: null,
    latitude: 2,
  });
  const entitlement = deriveEntitlementState({
    view: { turn: 6, transcript: [] },
    releaseDecision: {
      turn: 6,
      played: 'p3',
      scheduledTurn: 8,
      offset: -2,
      forced: null,
      pacingGuard: {
        candidate: guard.candidate,
        candidateSolvency: guard.candidateSolvency,
        playedSolvency: guard.playedSolvency,
        safeTurns: guard.safeTurns,
      },
    },
    playable,
    conductProgressPolicy: true,
  });

  assert.equal(entitlement.release.played, 'p3');
  assert.equal(entitlement.release.safeAtCurrent, true);
  assert.equal(entitlement.release.currentAuthorized, false);
  assert.equal(entitlement.release.earlyOptional, true);
  assert.equal(entitlement.release.progressCandidate, null);

  const decision = selectConductMove({ learnerEntitlement: entitlement });
  assert.equal(decision.selectedMoveFamily, 'consolidate_subproof');
  assert.equal(decision.reasonCode, 'early_release_not_current_authorized');
});

test('deriveEntitlementState folds recent diagnostic history into progress pressure', () => {
  const entitlement = deriveEntitlementState({
    view: {
      turn: 6,
      transcript: [
        {
          turn: 4,
          role: 'tutor',
          text: 'Pause there.',
          meta: { move: { intent: 'test', targetPremise: 'p2' } },
        },
        { turn: 4, role: 'learner', text: 'I am unsure.', meta: {} },
        {
          turn: 5,
          role: 'tutor',
          text: 'What licenses that step?',
          meta: { move: { intent: 'confront', targetPremise: 'p2' } },
        },
      ],
    },
    visibleConsolidation: {
      features: {
        priorPremiseId: 'p2',
        priorEcho: 0,
        priorEchoed: false,
        stalling: false,
        turnsSinceLastRelease: 1,
      },
      lines: ['VISIBLE CONSOLIDATION: prior exhibit p2 is not yet clearly taken up.'],
    },
    conductProgressPolicy: true,
  });

  assert.equal(entitlement.visible.active, true);
  assert.equal(entitlement.visible.premiseId, 'p2');
  assert.equal(entitlement.diagnostic.allowed, false);
  assert.equal(entitlement.diagnostic.exhausted, true);
  assert.equal(entitlement.visible.progressPressure, true);

  const decision = selectConductMove({ learnerEntitlement: entitlement });
  assert.equal(decision.selectedMoveFamily, 'consolidate_subproof');
  assert.equal(decision.reasonCode, 'progress_pressure_consolidate');
});

test('entitlement classification preserves valid-alternative priority', () => {
  const entitlement = deriveEntitlementState({
    view: { turn: 7, transcript: [] },
    proofDebtTutorView: {
      active: true,
      debts: [{ premiseId: 'p1', surface: 'the first paper', sinceTurn: 5 }],
    },
    validAlternativeCandidate: {
      active: true,
      premiseId: 'p_public',
      reason: 'public page supports a different branch',
    },
  });

  const decision = selectConductMove({ learnerEntitlement: entitlement });
  assert.equal(decision.selectedMoveFamily, 'ask_diagnostic');
  assert.equal(decision.reasonCode, 'valid_alternative_candidate');
  assert.equal(decision.targetPremise, 'p_public');
});
