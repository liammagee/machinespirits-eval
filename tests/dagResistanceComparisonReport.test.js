import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildComparisonScenarios, markdownReport } from '../scripts/run-dag-resistance-comparison.js';

const arms = [
  'dag_only',
  'resistance_only',
  'combined_strict',
  'combined_staged',
  'combined_contracts_only',
  'combined_semantic_only',
  'combined_followup_only',
  'combined_staged_v2',
];
const signals = ['boredom', 'frustration', 'irrelevance', 'question_flood', 'rote_parroting'];
const controls = ['mere_agreement', 'formula_parroting', 'tutor_rationale_adoption', 'vague_explain_more'];

function emptyReport(overrides = {}) {
  return {
    generatedAt: '2026-06-29T00:00:00.000Z',
    runId: 'eval-test',
    llmMode: 'real',
    conditions: 'positive',
    controlSet: 'standard',
    armOrder: arms,
    controlOrder: ['positive', ...controls],
    runsPerConfig: 1,
    maxCostUsd: 1,
    rows: [],
    aggregates: {
      byArm: Object.fromEntries(
        arms.map((arm) => [
          arm,
          {
            label: arm,
            scenarioN: 0,
            positiveN: 0,
            positiveSuccessN: 0,
            positiveSuccessRate: 0,
            negativeN: 0,
            negativeRejectedN: 0,
            negativeRejectedRate: 0,
            policyLayerMatchN: 0,
            selectedActions: {},
          },
        ]),
      ),
      bySignal: Object.fromEntries(
        signals.map((signal) => [
          signal,
          {
            dagOnlyAction: null,
            resistanceOnlyAction: null,
            combinedAction: null,
            allArmsSucceeded: null,
            combinedStrictHasBothPolicySources: null,
            combinedStagedHasBothPolicySources: null,
            combinedStrictEvidenceJoin: null,
            combinedStagedEvidenceJoin: null,
            combinedContractsHasBothPolicySources: null,
            combinedSemanticHasBothPolicySources: null,
            combinedFollowupHasBothPolicySources: null,
            combinedContractsEvidenceJoin: null,
            combinedSemanticEvidenceJoin: null,
            combinedFollowupEvidenceJoin: null,
            combinedStagedV2HasBothPolicySources: null,
            combinedStagedV2EvidenceJoin: null,
            combinedStrictAction: null,
            combinedStagedAction: null,
            combinedContractsAction: null,
            combinedSemanticAction: null,
            combinedFollowupAction: null,
            combinedStagedV2Action: null,
          },
        ]),
      ),
      byControl: Object.fromEntries(
        controls.map((control) => [
          control,
          {
            label: control,
            rows: 0,
            rejectedN: 0,
            rejectedRate: 0,
            accidentalSuccessN: 0,
            outcomes: {},
          },
        ]),
      ),
      totals: {
        negativeRows: 0,
      },
    },
    ...overrides,
  };
}

describe('DAG/resistance comparison Markdown report', () => {
  it('uses real-LLM wording for positive-only real runs', () => {
    const md = markdownReport(emptyReport());

    assert.match(md, /real-LLM ablation/);
    assert.match(md, /Negative controls were not included in this run/);
    assert.doesNotMatch(md, /deterministic mock ablation/);
  });

  it('keeps mock negative-control wording when negative rows are present', () => {
    const report = emptyReport({
      llmMode: 'mock',
      conditions: 'all',
      aggregates: {
        ...emptyReport().aggregates,
        totals: { negativeRows: 1 },
      },
    });
    const md = markdownReport(report);

    assert.match(md, /deterministic mock ablation/);
    assert.match(md, /Negative controls reject shallow uptake/);
  });

  it('keeps fixed negative-control replies even when positive real rows are unscripted', () => {
    const { scenarios } = buildComparisonScenarios({ conditions: 'all', scripted: false });
    const positive = scenarios.find((scenario) => scenario.id.endsWith('_positive'));
    const negative = scenarios.find((scenario) => scenario.id.endsWith('_mere_agreement'));

    assert.equal(positive.hidden.scripted_responses, undefined);
    assert.deepEqual(negative.hidden.scripted_responses, { default: 'Okay.' });
  });

  it('adds combined staged v2 with typed contracts and semantic observation', () => {
    const { scenarios } = buildComparisonScenarios({ conditions: 'positive', scripted: true });
    const v2 = scenarios.find((scenario) => scenario.id === 'dag_resistance_irrelevance_combined_staged_v2_positive');

    assert.equal(v2.max_turns, 3);
    assert.deepEqual(v2.adaptive_policy, {
      staged_combined_closure: true,
      typed_evidence_contracts: true,
      typed_staged_followup: true,
      semantic_outcome_observer: true,
    });
  });

  it('can build component-ablation arms only', () => {
    const { scenarios } = buildComparisonScenarios({
      conditions: 'positive',
      scripted: true,
      arms: ['combined_contracts_only', 'combined_semantic_only', 'combined_followup_only', 'combined_staged_v2'],
    });

    assert.equal(scenarios.length, signals.length * 4);
    assert.deepEqual(scenarios.find((scenario) => scenario.id.includes('combined_contracts_only')).adaptive_policy, {
      typed_evidence_contracts: true,
    });
    assert.deepEqual(scenarios.find((scenario) => scenario.id.includes('combined_semantic_only')).adaptive_policy, {
      semantic_outcome_observer: true,
    });
    assert.deepEqual(scenarios.find((scenario) => scenario.id.includes('combined_followup_only')).adaptive_policy, {
      staged_combined_closure: true,
      typed_staged_followup: true,
    });
  });

  it('can build adversarial negative controls without positives', () => {
    const { scenarios } = buildComparisonScenarios({
      conditions: 'negative',
      controlSet: 'adversarial',
      scripted: false,
      arms: ['combined_staged_v2'],
    });

    assert.equal(scenarios.length, signals.length * 4);
    assert.ok(scenarios.every((scenario) => !scenario.id.endsWith('_positive')));
    assert.ok(scenarios.some((scenario) => scenario.id.endsWith('_fluent_empty_rationale')));
    assert.deepEqual(
      scenarios.find((scenario) => scenario.id.endsWith('_fluent_empty_rationale')).hidden.scripted_responses,
      { default: 'Because it just works and that proves this is the right move.' },
    );
  });
});
