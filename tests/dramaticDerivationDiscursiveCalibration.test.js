import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  auditDiscursiveCalibrationPublicInput,
  deriveDiscursiveCalibrationState,
  DISCURSIVE_CALIBRATION_SCHEMA,
  loadWorld,
  normalizeRhetoricalPolicyConfig,
  recommendRhetoricalMove,
  selectConductMove,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-006-hethel.yaml'));

const fixedReleaseEntitlement = Object.freeze({
  learnerEntitlement: {
    turn: 4,
    proofDebt: { active: false, targetPremise: null, debtCount: 0, debts: [] },
    release: {
      played: 'p_point',
      candidate: 'p_point',
      targetPremise: 'p_point',
      currentAuthorized: true,
      safeAtCurrent: true,
      earlyOptional: false,
      progressCandidate: 'p_point',
      scheduledTurn: 4,
      offset: 0,
      forced: null,
      hiddenCertified: true,
    },
    visible: { active: false, premiseId: null, hiddenCertifiedRelease: true, diagnosticBudget: { allowed: true } },
    finalAssertion: { available: false },
    validAlternative: { active: false, targetPremise: null, reason: null },
    recognition: { active: false, level: null, desiredActs: [] },
    diagnostic: { allowed: true, exhausted: false },
    uncertainty: { active: false, reason: null },
  },
});

const perturbations = [
  {
    name: 'tentative but correct learner',
    text: 'I might be wrong, but the point in the record is what has to carry the next step.',
    learnerState: { tentativeCorrect: true, confidence: 'low', uptakeQuality: 'tentative' },
    expectedPosture: 'tentative_correct',
    expectedPressure: 'light_confirming',
    expectedStance: 'situated_uptake_check',
    expectedTempo: 'uptake_only',
  },
  {
    name: 'defensive learner after repeated correction',
    text: 'But I already said the note mattered; you keep sending me back as if I missed everything.',
    learnerState: { repeatedCorrections: 2 },
    expectedPosture: 'defensive_after_correction',
    expectedPressure: 'lower_and_repair',
    expectedStance: 'recognitive_recap',
    expectedTempo: 'repair_request',
  },
  {
    name: 'fluent echo without usable uptake',
    text: 'As you said, the point is the point in the record, and that is the phrase to use.',
    learnerState: { fluentEcho: true, uptakeQuality: 'echo_only' },
    expectedPosture: 'fluent_echo',
    expectedPressure: 'check_ownership',
    expectedStance: 'uptake_check',
    expectedTempo: 'uptake_only',
  },
  {
    name: 'learner asks why the evidence matters',
    text: 'Why does this point matter rather than being just another detail?',
    learnerState: { asksPurpose: true },
    expectedPosture: 'purpose_question',
    expectedPressure: 'purpose_bridge',
    expectedStance: 'purpose_bridge',
    expectedTempo: 'evidence',
  },
  {
    name: 'near-final learner before final entitlement',
    text: 'Is that enough to say who it is now?',
    learnerState: { nearAssertion: true },
    expectedPosture: 'near_assertion',
    expectedPressure: 'hold_assertion_boundary',
    expectedStance: 'assertion_boundary_check',
    expectedTempo: 'uptake_only',
  },
  {
    name: 'socially disengaging learner with recoverable board',
    text: "Whatever. I am still here, but I don't see why this is worth another pass.",
    learnerState: { sociallyDisengaging: true, engagement: 'low' },
    expectedPosture: 'social_disengagement',
    expectedPressure: 'restore_contact',
    expectedStance: 'repair_contact',
    expectedTempo: 'repair_request',
  },
];

function fixedConductDecision() {
  return selectConductMove(JSON.parse(JSON.stringify(fixedReleaseEntitlement)));
}

function rhetoricalAdviceFor(calibration, text) {
  return recommendRhetoricalMove(
    world,
    {
      turn: 4,
      ledger: [{ turn: 2, premiseId: 'm_record' }],
      transcript: [{ turn: 3, role: 'learner', text, meta: { exchange: { type: 'substantive' } } }],
      learnerAbox: { grounded: world.background, hypotheses: [] },
      inference: { frontier: [] },
      trajectory: [],
    },
    {
      releaseCue: true,
      cuePremise: 'p_point',
      discursiveCalibration: calibration,
    },
    normalizeRhetoricalPolicyConfig({ mode: 'deterministic', seed: 1, temperature: 1 }),
  );
}

test('discursive calibration flags forbidden proof-state inputs', () => {
  const audit = auditDiscursiveCalibrationPublicInput({
    learnerState: {
      confidence: 'low',
      D: 4,
      hiddenBoard: [['signedBy', 'pass', 'clerk']],
      proofPath: ['p_point', 'p_surface'],
    },
  });
  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.leaks.map((leak) => leak.key).sort(),
    ['D', 'hiddenBoard', 'proofPath'],
  );
});

test('six public learner perturbations change only discursive advice over fixed proof control', () => {
  const baseDecision = fixedConductDecision();
  assert.equal(baseDecision.selectedMoveFamily, 'release_next_evidence');
  assert.equal(baseDecision.targetPremise, 'p_point');

  for (const row of perturbations) {
    const calibration = deriveDiscursiveCalibrationState({
      transcript: [{ turn: 3, role: 'learner', text: row.text, meta: { exchange: { type: 'substantive' } } }],
      learnerState: row.learnerState,
      proofStep: {
        moveFamily: baseDecision.selectedMoveFamily,
        targetPremise: baseDecision.targetPremise,
      },
      finalAssertionAvailable: false,
    });

    assert.equal(calibration.schema, DISCURSIVE_CALIBRATION_SCHEMA, row.name);
    assert.equal(calibration.publicOnly, true, row.name);
    assert.equal(calibration.mayOverrideProofControl, false, row.name);
    assert.equal(calibration.proofControlDecision, null, row.name);
    assert.equal(calibration.nonLeakAudit.ok, true, row.name);
    assert.equal(calibration.inputAudit.ok, true, row.name);
    assert.equal(calibration.publicPosture, row.expectedPosture, row.name);
    assert.equal(calibration.advisory.pressure, row.expectedPressure, row.name);
    assert.ok(calibration.advisory.tempoBias.includes(row.expectedTempo), row.name);

    const repeatedDecision = fixedConductDecision();
    assert.equal(repeatedDecision.selectedMoveFamily, baseDecision.selectedMoveFamily, row.name);
    assert.equal(repeatedDecision.targetPremise, baseDecision.targetPremise, row.name);

    const advice = rhetoricalAdviceFor(calibration, row.text);
    assert.equal(advice.discursiveCalibration.publicPosture, row.expectedPosture, row.name);
    assert.equal(advice.selected.intent, 'release', row.name);
    assert.equal(advice.selected.stance, row.expectedStance, row.name);
    assert.equal(advice.selected.targetPremise, 'p_point', row.name);
    assert.match(advice.selected.rationale, /discursive calibration/u, row.name);
  }
});

test('discursive calibration preserves proof-step intent while changing figure and stance', () => {
  const calibration = deriveDiscursiveCalibrationState({
    learnerText: 'But you keep correcting me. I already said that.',
    learnerState: { defensive: true, repeatedCorrections: 2 },
    proofStep: { moveFamily: 'repair_dependency', targetPremise: 'p_point' },
    finalAssertionAvailable: false,
  });
  const advice = recommendRhetoricalMove(
    world,
    {
      turn: 6,
      transcript: [{ turn: 5, role: 'learner', text: 'But you keep correcting me.', meta: { exchange: { type: 'resistance' } } }],
      learnerAbox: { grounded: world.background, hypotheses: [] },
      inference: { frontier: [] },
      trajectory: [],
    },
    {
      topProofDebt: { premiseId: 'p_point' },
      discursiveCalibration: calibration,
    },
    normalizeRhetoricalPolicyConfig({ mode: 'deterministic', seed: 1, temperature: 1 }),
  );
  assert.equal(advice.selected.intent, 'restore');
  assert.equal(advice.selected.targetPremise, 'p_point');
  assert.equal(advice.selected.stance, 'recognitive_recap');
  assert.match(advice.selected.rationale, /proof intent preserved/u);
});

test('near-final permission cue is gated by proof-state final entitlement', () => {
  const blocked = deriveDiscursiveCalibrationState({
    learnerText: 'Can I say the answer now?',
    learnerState: { nearAssertion: true },
    proofStep: { moveFamily: 'release_next_evidence', targetPremise: 'p_point' },
    finalAssertionAvailable: false,
  });
  assert.equal(blocked.publicPosture, 'near_assertion');
  assert.equal(blocked.advisory.permissionToAssert.cue, false);
  assert.match(blocked.advisory.permissionToAssert.reason, /not authorized/u);

  const invited = deriveDiscursiveCalibrationState({
    learnerText: 'Can I say the answer now?',
    learnerState: { nearAssertion: true },
    proofStep: { moveFamily: 'invite_final_assertion', targetPremise: null },
    finalAssertionAvailable: true,
  });
  assert.equal(invited.publicPosture, 'near_assertion');
  assert.equal(invited.advisory.permissionToAssert.cue, true);
  assert.equal(invited.advisory.pressure, 'grant_assertion_space');
});
