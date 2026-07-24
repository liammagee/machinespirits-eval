import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildTutorStubAutoEvalLightweightDialogueField,
  buildTutorStubLightweightDialogueField,
  projectTutorStubLightweightFieldTurn,
} from '../services/tutorStubFieldTurnProjection.js';

const FROZEN_TURNS = [
  {
    turn: 1,
    learner: 'I am unsure',
    tutor: 'Use the assay record.',
    classification: {
      turn: {
        scores: {
          conceptual_engagement: { score: 2 },
          epistemic_readiness: { score: 3 },
        },
        epistemic_stance: 'tentative',
        evidence_use: 'partial',
        discourse_move: 'question',
      },
    },
    tutorLearnerDagModel: {
      assessment: { bestPathCoverage: 0.25, bottleneck: 'learner_integration_gap' },
      metrics: { groundedCount: 1, missingPremiseCount: 4 },
    },
    registerSelection: { selected_register: 'plain', confidence: 0.6 },
    previousRegisterEfficacy: { progressScore: 1, selfAssessmentScore: 3, label: 'stable' },
    tutorDag: { leavesReleased: 1, leavesTotal: 4 },
    tutorLeakAudit: { ok: true },
    learnerAdvance: { kind: 'warrant', strength: 0.75 },
  },
  {
    turn: 2,
    learner: 'The record supports it',
    tutor: 'Now connect the assay to the ownership claim.',
    classification: {
      turn: {
        scores: { conceptual_engagement: 4, epistemic_readiness: 4 },
        epistemic_stance: 'assertive',
        evidence_use: 'omits_warrant',
        discourse_move: 'claim',
      },
    },
    tutorLearnerDagModel: {
      assessment: { bestPathCoverage: 0.625, bottleneck: 'distorts_public_evidence' },
      metrics: { groundedCount: 3, missingPremiseCount: 2 },
      learnerAdvance: { kind: 'premise', strength: 0.5 },
    },
    registerSelection: { selected_register: 'skeptical', confidence: 0.8 },
    previousRegisterEfficacy: { progressScore: -1, selfAssessmentScore: 2, label: 'mixed' },
    tutorDag: { leavesReleased: 2, leavesTotal: 4 },
    tutorLeakAudit: { ok: true },
  },
];

const SUMMARY_BASE = {
  finalTurn: 2,
  final: {
    learnerMastery: 0.705,
    learnerRisk: 0.412,
    coverage: 0.625,
    bottleneck: 'distorts_public_evidence',
  },
};

const INTERACTIVE_GOLDEN = {
  schema: 'machinespirits.tutor-stub.lightweight-field.v1',
  turnCount: 2,
  rows: [
    {
      turn: 1,
      learnerMastery: 0.38,
      learnerRisk: 0.325,
      tutorAlignment: 0.85,
      jointMomentum: 0.417,
      coverage: 0.25,
      groundedCount: 1,
      missingCount: 4,
      conceptual: 0.4,
      readiness: 0.6,
      register: 'plain',
      bottleneck: 'learner_integration_gap',
      learnerMove: 'question',
      learnerAdvance: { kind: 'warrant', strength: 0.75 },
      calculation: {
        inputs: {
          conceptual: 0.4,
          readiness: 0.6,
          coverage: 0.25,
          grounded: 0.125,
          missing: 0.5,
          overreach: 0,
          responseWords: 4,
          brevity: 1,
          registerConfidence: 0.6,
          efficacyScore: 0.875,
          leakOk: true,
          masteryGain: 0.38,
          coverageGain: 0.25,
          releasedShare: 0.25,
          learnerAdvanceStrength: 0.75,
        },
        formulas: {
          learnerMastery: '0.34*conceptual + 0.26*readiness + 0.30*coverage + 0.10*grounded',
          learnerRisk: '0.45*missing + 0.25*(1-readiness) + overreach',
          tutorAlignment: '0.30*registerConfidence + 0.24*efficacy + 0.22*brevity + 0.24*leakOk',
          jointMomentum: '0.42*masteryGain + 0.28*coverageGain + 0.18*efficacy + 0.12*releasedShare',
        },
      },
      speed: 0,
    },
    {
      turn: 2,
      learnerMastery: 0.705,
      learnerRisk: 0.412,
      tutorAlignment: 0.88,
      jointMomentum: 0.437,
      coverage: 0.625,
      groundedCount: 3,
      missingCount: 2,
      conceptual: 0.8,
      readiness: 0.8,
      register: 'skeptical',
      bottleneck: 'distorts_public_evidence',
      learnerMove: 'claim',
      learnerAdvance: { kind: 'premise', strength: 0.5 },
      calculation: {
        inputs: {
          conceptual: 0.8,
          readiness: 0.8,
          coverage: 0.625,
          grounded: 0.375,
          missing: 0.25,
          overreach: 0.25,
          responseWords: 8,
          brevity: 1,
          registerConfidence: 0.8,
          efficacyScore: 0.75,
          leakOk: true,
          masteryGain: 0.325,
          coverageGain: 0.375,
          releasedShare: 0.5,
          learnerAdvanceStrength: 0.5,
        },
        formulas: {
          learnerMastery: '0.34*conceptual + 0.26*readiness + 0.30*coverage + 0.10*grounded',
          learnerRisk: '0.45*missing + 0.25*(1-readiness) + overreach',
          tutorAlignment: '0.30*registerConfidence + 0.24*efficacy + 0.22*brevity + 0.24*leakOk',
          jointMomentum: '0.42*masteryGain + 0.28*coverageGain + 0.18*efficacy + 0.12*releasedShare',
        },
      },
      speed: 0.338,
    },
  ],
  summary: {
    ...SUMMARY_BASE,
    meanSpeed: 0.169,
    fieldDelta: {
      learnerMastery: 0.325,
      learnerRisk: 0.087,
      tutorAlignment: 0.03,
      jointMomentum: 0.02,
    },
    final: {
      ...SUMMARY_BASE.final,
      tutorAlignment: 0.88,
      jointMomentum: 0.437,
    },
  },
};

const AUTO_EVAL_REPORT_GOLDEN = {
  schema: 'machinespirits.tutor-stub.lightweight-field.v1',
  turnCount: 2,
  rows: [
    {
      turn: 1,
      learnerMastery: 0.38,
      learnerRisk: 0.325,
      tutorAlignment: 0.79,
      jointMomentum: 0.372,
      coverage: 0.25,
      groundedCount: 1,
      missingCount: 4,
      conceptual: 0.4,
      readiness: 0.6,
      register: 'plain',
      bottleneck: 'learner_integration_gap',
      learnerMove: 'question',
      speed: 0,
    },
    {
      turn: 2,
      learnerMastery: 0.705,
      learnerRisk: 0.162,
      tutorAlignment: 0.79,
      jointMomentum: 0.369,
      coverage: 0.625,
      groundedCount: 3,
      missingCount: 2,
      conceptual: 0.8,
      readiness: 0.8,
      register: 'skeptical',
      bottleneck: 'distorts_public_evidence',
      learnerMove: 'claim',
      speed: 0.364,
    },
  ],
  summary: {
    finalTurn: 2,
    meanSpeed: 0.182,
    fieldDelta: {
      learnerMastery: 0.325,
      learnerRisk: -0.163,
      tutorAlignment: 0,
      jointMomentum: -0.003,
    },
    final: {
      learnerMastery: 0.705,
      learnerRisk: 0.162,
      tutorAlignment: 0.79,
      jointMomentum: 0.369,
      coverage: 0.625,
      bottleneck: 'distorts_public_evidence',
    },
  },
};

test('interactive projection preserves the richer frozen CLI field contract', () => {
  const inputBefore = structuredClone(FROZEN_TURNS);
  assert.deepEqual(buildTutorStubLightweightDialogueField(FROZEN_TURNS), INTERACTIVE_GOLDEN);
  assert.deepEqual(FROZEN_TURNS, inputBefore);
});

test('auto-eval projection preserves the frozen report field output byte-for-byte', () => {
  const projection = buildTutorStubAutoEvalLightweightDialogueField(FROZEN_TURNS);
  assert.equal(JSON.stringify(projection), JSON.stringify(AUTO_EVAL_REPORT_GOLDEN));
});

test('projection rejects unknown compatibility modes', () => {
  assert.throws(
    () => projectTutorStubLightweightFieldTurn(FROZEN_TURNS[0], null, { mode: 'unknown' }),
    /Unknown tutor-stub field-turn projection mode: unknown/u,
  );
});

test('both script surfaces import the shared projection and retain no local implementation', () => {
  for (const file of ['scripts/tutor-stub.js', 'scripts/run-tutor-stub-auto-eval.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /services\/tutorStubFieldTurnProjection\.js/u);
    assert.doesNotMatch(source, /function lightweightFieldTurn\s*\(/u);
    assert.doesNotMatch(source, /function buildLightweightDialogueField\s*\(/u);
  }
});
