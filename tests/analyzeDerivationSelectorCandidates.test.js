import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeSelectorCandidates } from '../scripts/analyze-derivation-selector-candidates.js';

function arm({
  grounded,
  verdict = grounded ? 'grounded_anagnorisis' : 'aporia',
  turns = grounded ? 20 : 8,
  finalD = grounded ? 0 : 5,
} = {}) {
  return {
    verdict,
    grounded,
    turns,
    finalD,
  };
}

function comparison({ key, run, classification, hidden, visible, echo, selectedLabel = `selected-${run}` }) {
  return {
    key,
    group: 'synthetic-hethel',
    run,
    worldId: 'world_006_hethel',
    classification,
    selected: {
      label: selectedLabel,
      arm: 'selective-v1',
      selected: 'visible',
      gate: 'mirror_dead_predicate_visible',
      grounded: visible,
      turns: visible ? 20 : 8,
      finalD: visible ? 0 : 5,
    },
    arms: {
      hidden: arm({ grounded: hidden }),
      visible: arm({ grounded: visible }),
      'selective-v1': arm({ grounded: visible }),
    },
    firstSelectedGuardIntervention: {
      turn: 4,
      guard: 'visible',
      kind: 'block',
      premise: 'p_point',
      reason: `p_point held: prior exhibit m_record not taken up on the page (echo ${echo.toFixed(2)} < 0.34)`,
    },
  };
}

test('candidate analysis can rank a runtime uptake probe above static Hethel-visible routing', () => {
  const report = analyzeSelectorCandidates(
    {
      schema: 'test',
      comparisons: [
        comparison({
          key: 'synthetic-hethel\tr1',
          run: 1,
          classification: 'strict_v_positive',
          hidden: false,
          visible: true,
          echo: 0.32,
          selectedLabel: 'hethel-selector-v1-selective-r2',
        }),
        comparison({
          key: 'synthetic-hethel\tr2',
          run: 2,
          classification: 'visible_route_failure',
          hidden: true,
          visible: false,
          echo: 0.14,
          selectedLabel: 'hethel-selector-codexlearner-selective-v1-r4',
        }),
      ],
    },
    {
      criticalLabels: ['hethel-selector-v1-selective-r2', 'hethel-selector-codexlearner-selective-v1-r4'],
    },
  );

  const best = report.rankedCandidates[0];
  assert.equal(best.name, 'runtime_probe_block_echo_gte_0.15');
  assert.equal(best.totals.success, 2);
  assert.equal(best.totals.regret, 0);
  assert.equal(report.criticalCases.length, 2);
  assert.equal(report.criticalCases[0].worldFeatures.deadPredicatePresent, true);
});
