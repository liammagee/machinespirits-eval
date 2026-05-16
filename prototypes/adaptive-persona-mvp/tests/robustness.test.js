import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildRobustnessEvaluation,
  extractRunSummaries,
  renderRobustnessHtml,
  renderRobustnessMarkdown,
} from '../src/robustnessEvaluation.js';
import { DEFAULT_HARD_SCENARIOS } from '../src/variantSweep.js';

test('robustness evaluation rejects focused positive slices', () => {
  const summaries = extractRunSummaries(
    fakeVariantPayload({
      scenarioIds: ['hard_ai_bias_resistant_closed_loop'],
      diff: 35,
    }),
    '/tmp/focused.json',
  );
  const evaluation = buildRobustnessEvaluation({ summaries, permutations: 25 });
  assert.equal(evaluation.robustPositive.established, false);
  assert.match(evaluation.robustPositive.reason, /insufficient replicated hard LLM evidence/);
  assert.equal(evaluation.sourceCounts.focusedLlmRuns, 1);
});

test('robustness evaluation can identify a replicated positive hard LLM result', () => {
  const summaries = [
    ...extractRunSummaries(fakeVariantPayload({ scenarioIds: [...DEFAULT_HARD_SCENARIOS], diff: 10 }), '/tmp/full-1.json'),
    ...extractRunSummaries(fakeVariantPayload({ scenarioIds: [...DEFAULT_HARD_SCENARIOS], diff: 10 }), '/tmp/full-2.json'),
  ];
  const evaluation = buildRobustnessEvaluation({ summaries, permutations: 25 });
  assert.equal(evaluation.robustPositive.established, true);
  assert.equal(evaluation.robustPositive.strictPublicEstablished, true);
  assert.equal(evaluation.aggregate.mvp.summary.n, 12);
  assert.equal(evaluation.aggregate.parent_dialogue.summary.meanDiff, 10);
  assert.match(renderRobustnessMarkdown(evaluation), /Adaptive primary robust positive effect established/);
  assert.match(renderRobustnessHtml(evaluation), /Adaptive Tutor Robustness Evaluation/);
});

test('robustness evaluation treats flat parent dialogue as compatibility evidence', () => {
  const summaries = [
    ...extractRunSummaries(fakeVariantPayload({
      scenarioIds: [...DEFAULT_HARD_SCENARIOS],
      diff: 10,
      metricDiffs: { parent_dialogue: 0 },
    }), '/tmp/full-1.json'),
    ...extractRunSummaries(fakeVariantPayload({
      scenarioIds: [...DEFAULT_HARD_SCENARIOS],
      diff: 10,
      metricDiffs: { parent_dialogue: 0 },
    }), '/tmp/full-2.json'),
  ];
  const evaluation = buildRobustnessEvaluation({ summaries, permutations: 25 });
  assert.equal(evaluation.robustPositive.established, true);
  assert.equal(evaluation.robustPositive.strictPublicEstablished, false);
  assert.equal(evaluation.robustPositive.compatibilityNonNegative, true);
  assert.match(evaluation.robustPositive.reason, /Caution/);
});

test('robustness evaluation blocks material negative hard LLM runs', () => {
  const summaries = [
    ...extractRunSummaries(fakeVariantPayload({ scenarioIds: [...DEFAULT_HARD_SCENARIOS], diff: 10 }), '/tmp/full-1.json'),
    ...extractRunSummaries(fakeVariantPayload({
      scenarioIds: [...DEFAULT_HARD_SCENARIOS],
      diff: 10,
      metricDiffs: { parent_dialogue: -8 },
    }), '/tmp/full-2.json'),
  ];
  const evaluation = buildRobustnessEvaluation({ summaries, permutations: 25 });
  assert.equal(evaluation.robustPositive.established, false);
  assert.match(evaluation.robustPositive.reason, /material negative/);
});

function fakeVariantPayload({
  scenarioIds,
  diff,
  metricDiffs = {},
} = {}) {
  const publicStats = Object.fromEntries(['mvp', 'parent_dialogue', 'outcome'].map((metric) => {
    const metricDiff = metricDiffs[metric] ?? diff;
    const rows = scenarioIds.flatMap((scenarioId) => ['original', 'counterfactual'].map((branchName) => ({
      repeat: 0,
      scenarioId,
      discipline: 'test',
      branchName,
      baselineCondition: 'static_codex',
      targetCondition: 'controller_reflexive_psychodynamic_codex',
      metric,
      baselineScore: 50,
      targetScore: 50 + metricDiff,
      diff: metricDiff,
    })));
    return [metric, {
      rows,
      summary: {
        n: rows.length,
        meanDiff: metricDiff,
        bootstrap95Ci: [metricDiff, metricDiff],
        permutationP: 0.01,
        nonTrivialPositive: metricDiff > 0,
      },
    }];
  }));
  return {
    generatedAt: '2026-05-16T00:00:00.000Z',
    scenarioIds,
    conditions: ['static_codex', 'controller_reflexive_psychodynamic_codex'],
    baselineCondition: 'static_codex',
    learnerMode: 'codex',
    dryRun: false,
    targetSummaries: {
      controller_reflexive_psychodynamic_codex: {
        targetCondition: 'controller_reflexive_psychodynamic_codex',
        publicStats,
        challengeStats: {},
        decision: { rationale: 'fixture' },
      },
    },
  };
}
