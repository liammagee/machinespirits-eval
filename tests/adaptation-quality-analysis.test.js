import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateQualityRows, strictShiftFromTrace } from '../scripts/analyze-adaptation-quality.js';

test('strictShiftFromTrace scores the tutor turn after the trigger', () => {
  const trace = {
    scenario: {
      hidden: { triggerTurn: 1 },
      expectedStrategyShift: 'ask_diagnostic_question',
    },
    original: {
      perTurn: [
        { turn: 0, tutorInternal: { policyAction: 'provide_hint' } },
        { turn: 1, tutorInternal: { policyAction: 'request_elaboration' } },
        { turn: 2, tutorInternal: { policyAction: 'ask_diagnostic_question' } },
      ],
    },
  };

  const result = strictShiftFromTrace(trace);

  assert.equal(result.evaluable, true);
  assert.equal(result.shiftTurn, 2);
  assert.equal(result.actualShiftAction, 'ask_diagnostic_question');
  assert.equal(result.matched, true);
});

test('quality ranking keeps the strict-shift gate attached', () => {
  const rows = [
    {
      profileName: 'cell_135_plan2_closed_loop',
      runId: 'baseline',
      strictShiftEvaluable: true,
      strictShiftMatched: true,
      qualityComposite: 78,
      tutorLastTurnScore: 76,
      tutorHolisticOverallScore: 78,
      learnerOverallScore: 80,
      dialogueQualityScore: 78,
      dimensions: {},
    },
    {
      profileName: 'cell_137_plan2_quality_ownership',
      runId: 'candidate-good',
      strictShiftEvaluable: true,
      strictShiftMatched: true,
      qualityComposite: 84,
      tutorLastTurnScore: 86,
      tutorHolisticOverallScore: 83,
      learnerOverallScore: 82,
      dialogueQualityScore: 85,
      dimensions: {},
    },
    {
      profileName: 'cell_138_plan2_quality_fit',
      runId: 'candidate-missed-shift',
      strictShiftEvaluable: true,
      strictShiftMatched: false,
      qualityComposite: 90,
      tutorLastTurnScore: 90,
      tutorHolisticOverallScore: 90,
      learnerOverallScore: 90,
      dialogueQualityScore: 90,
      dimensions: {},
    },
  ];

  const report = aggregateQualityRows(rows, {
    baseline: 'cell_135_plan2_closed_loop',
    minShiftRate: 0.875,
  });

  assert.equal(report.winner.profileName, 'cell_137_plan2_quality_ownership');
  assert.equal(report.ranked[0].profileName, 'cell_137_plan2_quality_ownership');
  assert.equal(report.profiles.find((p) => p.profileName === 'cell_138_plan2_quality_fit').passesShiftGate, false);
});

test('quality composite delta is measured against the named baseline', () => {
  const rows = [
    {
      profileName: 'cell_135_plan2_closed_loop',
      runId: 'baseline',
      strictShiftEvaluable: true,
      strictShiftMatched: true,
      qualityComposite: 80,
      dimensions: {},
    },
    {
      profileName: 'cell_139_plan2_quality_discriminating',
      runId: 'candidate',
      strictShiftEvaluable: true,
      strictShiftMatched: true,
      qualityComposite: 82.5,
      dimensions: {},
    },
  ];

  const report = aggregateQualityRows(rows, { baseline: 'cell_135_plan2_closed_loop' });
  const candidate = report.profiles.find((p) => p.profileName === 'cell_139_plan2_quality_discriminating');

  assert.equal(candidate.qualityDeltaVsBaseline, 2.5);
});

test('incomplete quality rows are not averaged as zero-quality rows', () => {
  const rows = [
    {
      profileName: 'cell_135_plan2_closed_loop',
      runId: 'baseline',
      strictShiftEvaluable: true,
      strictShiftMatched: true,
      qualityComposite: 50,
      dimensions: {},
    },
    {
      profileName: 'cell_149_plan2_quality_repeat_contextual',
      runId: 'candidate',
      strictShiftEvaluable: true,
      strictShiftMatched: true,
      qualityComposite: 80,
      dimensions: {},
    },
    {
      profileName: 'cell_149_plan2_quality_repeat_contextual',
      runId: 'candidate',
      strictShiftEvaluable: true,
      strictShiftMatched: true,
      qualityComposite: null,
      dimensions: {},
    },
  ];

  const report = aggregateQualityRows(rows, { baseline: 'cell_135_plan2_closed_loop' });
  const candidate = report.profiles.find((p) => p.profileName === 'cell_149_plan2_quality_repeat_contextual');

  assert.equal(candidate.n, 2);
  assert.equal(candidate.completeQualityN, 1);
  assert.equal(candidate.qualityCompositeMean, 80);
  assert.equal(candidate.qualityDeltaVsBaseline, 30);
});
