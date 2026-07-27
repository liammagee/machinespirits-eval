import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeRubricInstrument, extractScoreVectors } from '../rubricSensitivityAnalyzer.js';

const rubric = {
  version: '3.0',
  scale: { min: 1, max: 5 },
  dimensions: {
    quality: { weight: 0.8, scale: { min: 1, max: 10 } },
    accuracy: { weight: 0.2, scale: { min: 1, max: 5 } },
  },
};

test('extractScoreVectors accepts turn-keyed and flat stored score payloads', () => {
  assert.deepEqual(
    extractScoreVectors({ 0: { scores: { quality: { score: 7 }, accuracy: 4 } } }, ['quality', 'accuracy']),
    [{ observationKey: '0', scores: { quality: 7, accuracy: 4 } }],
  );
  assert.deepEqual(extractScoreVectors({ quality: { score: 8 }, accuracy: { score: 5 } }, ['quality', 'accuracy']), [
    { observationKey: 'holistic', scores: { quality: 8, accuracy: 5 } },
  ]);
});

test('sensitivity analysis reports headroom, factor structure, coverage, and same-item judge pairs', () => {
  const observations = [
    ['a', 'claude', 1, 5, 's1', 'codex'],
    ['a', 'codex', 2, 5, 's1', 'codex'],
    ['b', 'claude', 4, 1, 's2', 'claude'],
    ['b', 'codex', 5, 1, 's2', 'claude'],
    ['c', 'claude', 7, 4, 's3', 'codex'],
    ['c', 'codex', 8, 4, 's3', 'codex'],
    ['d', 'claude', 10, 2, 's3', 'claude'],
    ['d', 'codex', 9, 2, 's3', 'claude'],
  ].map(([itemKey, judge, quality, accuracy, scenario, generator]) => ({
    itemKey,
    observationKey: '0',
    judge,
    scenario,
    generator,
    profile: generator,
    scores: { quality, accuracy },
  }));

  const report = analyzeRubricInstrument(observations, rubric);
  assert.equal(report.observations_complete, 8);
  assert.equal(report.coverage.scenarios, 3);
  assert.equal(report.coverage.candidate_generators, 2);
  assert.equal(report.coverage.judges, 2);
  assert.equal(report.cross_judge.n_pairs, 4);
  assert.ok(report.cross_judge.pearson_r > 0.95);
  assert.equal(report.dimensions.quality.floor_rate, 1 / 8);
  assert.equal(report.dimensions.quality.ceiling_rate, 1 / 8);
  assert.equal(report.factor_structure.eigenvalues.length, 2);
});

test('N/A dimensions keep other dimension statistics and are excluded from factor-complete rows', () => {
  const observations = [
    { itemKey: 'a', observationKey: '0', judge: 'claude', scores: { quality: 4, accuracy: 3 } },
    { itemKey: 'a', observationKey: '0', judge: 'codex', scores: { quality: 5, accuracy: 3 } },
    {
      itemKey: 'b',
      observationKey: '0',
      judge: 'claude',
      scores: { quality: 7, accuracy: { score: null, not_applicable: true } },
    },
    {
      itemKey: 'b',
      observationKey: '0',
      judge: 'codex',
      scores: { quality: 8, accuracy: { score: 5, not_applicable: true } },
    },
  ];

  const report = analyzeRubricInstrument(observations, rubric);
  assert.equal(report.observations_complete, 2);
  assert.equal(report.dimensions.quality.n, 4);
  assert.equal(report.dimensions.accuracy.n, 2);
  assert.equal(report.cross_judge.n_pairs, 2, 'quality-only aggregates remain comparable across judges');
});
