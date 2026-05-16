import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runRealAssessment } from '../src/assessmentHarness.js';
import {
  conditionMetricValues,
  summarizePairedDifferences,
  summarizeValues,
} from '../src/statistics.js';

test('psychodynamic reflexive condition uses variant prompts and memory', async () => {
  const [result] = await runRealAssessment({
    scenarioId: 'fractions_denominator_size_closed_loop',
    conditions: ['controller_reflexive_psychodynamic_codex'],
    dryRun: true,
    keepPrompts: true,
  });
  const branch = result.conditions.controller_reflexive_psychodynamic_codex.original;
  const firstTurn = branch.stateTrace[0];
  assert.equal(firstTurn.reflexiveVariant, 'psychodynamic');
  assert.equal(firstTurn.reflexiveMemory.variant, 'psychodynamic');
  assert.ok(firstTurn.reflexiveMemory.psychodynamicHypotheses.length > 0);
  assert.ok(firstTurn.reflexiveMemory.repairDebts.length > 0);
  assert.match(firstTurn.reflexiveTrace.prompts.superegoPrompt, /rescue fantasy/);
  assert.match(firstTurn.reflexiveTrace.prompts.egoRevisionPrompt, /learner agency/);
});

test('replicated statistics expose a conservative significance gate', () => {
  const positive = summarizePairedDifferences([1, 1, 1, 1, 1, 1], { permutations: 25 });
  assert.equal(positive.n, 6);
  assert.equal(positive.meanDiff, 1);
  assert.equal(positive.bootstrap95Ci[0], 1);
  assert.equal(positive.nonTrivialPositive, true);

  const mixed = summarizePairedDifferences([4, -1, 0, 2], { permutations: 25 });
  assert.equal(mixed.n, 4);
  assert.equal(mixed.nonTrivialPositive, false);
});

test('target mechanism statistics can summarize psychodynamic rubric scores', () => {
  const rows = conditionMetricValues([
    {
      repeat: 0,
      results: [
        {
          scenarioId: 's1',
          discipline: 'math',
          conditions: {
            controller_reflexive_psychodynamic_codex: {
              original: {
                psychodynamicAdaptationJudge: { weighted_score: 75 },
              },
              counterfactual: {
                psychodynamicAdaptationJudge: { weighted_score: 85 },
              },
            },
          },
        },
      ],
    },
  ], {
    condition: 'controller_reflexive_psychodynamic_codex',
    metric: 'psychodynamic',
  });
  assert.deepEqual(rows.map((row) => row.score), [75, 85]);
  assert.equal(summarizeValues(rows.map((row) => row.score), { permutations: 25 }).mean, 80);
});
