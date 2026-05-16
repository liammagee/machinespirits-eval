import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildVariantSweepReport,
  decideVariant,
  renderVariantSweepHtml,
} from '../src/variantSweep.js';

test('variant decision promotes public triage without overstating significance', () => {
  const decision = decideVariant({
    mvp: { summary: { meanDiff: 8, nonTrivialPositive: false } },
    parent_dialogue: { summary: { meanDiff: 3, nonTrivialPositive: false } },
    outcome: { summary: { meanDiff: 0, nonTrivialPositive: false } },
  });
  assert.equal(decision.publicTriagePass, true);
  assert.equal(decision.significancePass, false);
  assert.deepEqual(decision.positiveMetrics, ['mvp', 'parent_dialogue']);
});

test('dry-run variant decision does not claim confirmation', () => {
  const decision = decideVariant({
    mvp: { summary: { meanDiff: 8, nonTrivialPositive: true } },
    parent_dialogue: { summary: { meanDiff: 3, nonTrivialPositive: false } },
    outcome: { summary: { meanDiff: 0, nonTrivialPositive: false } },
  }, {}, { dryRun: true });
  assert.equal(decision.publicTriagePass, true);
  assert.equal(decision.significancePass, false);
  assert.match(decision.rationale, /dry-run triage signal/);
});

test('variant decision blocks large public regressions', () => {
  const decision = decideVariant({
    mvp: { summary: { meanDiff: 12, nonTrivialPositive: true } },
    parent_dialogue: { summary: { meanDiff: -8, nonTrivialPositive: false } },
    outcome: { summary: { meanDiff: 5, nonTrivialPositive: false } },
  });
  assert.equal(decision.publicTriagePass, false);
  assert.equal(decision.significancePass, false);
  assert.deepEqual(decision.negativeMetrics, ['parent_dialogue']);
});

test('variant sweep report ranks targets and renders html', () => {
  const reports = [
    {
      repeat: 0,
      results: [
        {
          scenarioId: 's1',
          discipline: 'math',
          challengeProfile: { mode: 'hard' },
          conditions: {
            static_codex: {
              original: {
                blindJudge: { weighted_score: 60 },
                parentDialogueJudge: { weighted_score: 60 },
                outcomeTask: { success: false },
              },
              counterfactual: {
                blindJudge: { weighted_score: 60 },
                parentDialogueJudge: { weighted_score: 60 },
                outcomeTask: { success: false },
              },
            },
            controller_reflexive_psychodynamic_codex: {
              original: {
                blindJudge: { weighted_score: 80 },
                parentDialogueJudge: { weighted_score: 70 },
                outcomeTask: { success: true },
                stateTrace: [
                  {
                    challengeState: { level: 'active' },
                    policy: { challengeDirective: 'repair challenge' },
                  },
                  {
                    challengeState: { level: 'resolved' },
                    policy: {},
                  },
                ],
                reflexiveDeliberationJudge: { weighted_score: 85 },
                psychodynamicAdaptationJudge: { weighted_score: 90 },
              },
              counterfactual: {
                blindJudge: { weighted_score: 75 },
                parentDialogueJudge: { weighted_score: 65 },
                outcomeTask: { success: false },
                stateTrace: [
                  {
                    challengeState: { level: 'escalated' },
                    policy: { challengeDirective: 'repair challenge' },
                  },
                ],
                reflexiveDeliberationJudge: { weighted_score: 80 },
                psychodynamicAdaptationJudge: { weighted_score: 82 },
              },
            },
          },
        },
      ],
    },
  ];
  const report = buildVariantSweepReport({
    reports,
    scenarioIds: ['s1'],
    conditions: ['static_codex', 'controller_reflexive_psychodynamic_codex'],
    baselineCondition: 'static_codex',
    permutations: 25,
  });
  assert.equal(report.recommendedCandidates[0].targetCondition, 'controller_reflexive_psychodynamic_codex');
  assert.equal(report.targetSummaries.controller_reflexive_psychodynamic_codex.decision.publicTriagePass, true);
  assert.equal(report.targetSummaries.controller_reflexive_psychodynamic_codex.challengeStats.directiveRate, 1);
  const html = renderVariantSweepHtml(report);
  assert.match(html, /Adaptive Tutor Variant Sweep/);
  assert.match(html, /Challenge-State Mechanism Checks/);
});
