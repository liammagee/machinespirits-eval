import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessCharacterAdaptationReport,
  CHARACTER_ADAPTATION_LOOP_SPEC,
} from '../scripts/run-tutor-stub-character-adaptation-loop.js';

function report(overrides = {}) {
  return {
    config: { dryRun: false },
    aggregates: { errorCount: 0 },
    rows: [
      {
        status: 'ok',
        turnCount: 6,
        actorPartCounts: {},
        actorPartEntropy: 0,
        responseConfigurationVisibility: { mean_realization_rate: 1 },
        guardAccounting: { finalDeliveryAuditFailures: 0, deterministicFallbackTurns: 0 },
        errorCount: 0,
        characterAdaptation: {
          clueReleaseTurns: 2,
          hostVisibleTurns: 6,
          hostPartCounts: { examiner: 3, skeptic: 3 },
          metaPerformanceTurns: 0,
          roleStageDirectionTurns: 0,
          sourceReplacementTurns: 0,
          duplicateClueDeliveryTurns: 0,
        },
        ...overrides,
      },
    ],
  };
}

test('character loop gate passes a clean, visibly adaptive Marrick run', () => {
  const result = assessCharacterAdaptationReport(report());
  assert.equal(CHARACTER_ADAPTATION_LOOP_SPEC.targets.primary.world, 'world_005_marrick');
  assert.equal(CHARACTER_ADAPTATION_LOOP_SPEC.targets.primary.learnerProfile, 'affective_resistant');
  assert.equal(CHARACTER_ADAPTATION_LOOP_SPEC.targets.transfer.world, 'world_023_greyfen_lab');
  assert.equal(CHARACTER_ADAPTATION_LOOP_SPEC.targets.transfer.learnerProfile, 'false_memory');
  assert.equal(CHARACTER_ADAPTATION_LOOP_SPEC.targets.transfer.acceptanceSeed, 20260729);
  assert.deepEqual(
    CHARACTER_ADAPTATION_LOOP_SPEC.targets.transfer.retiredAcceptanceSeeds.map((row) => row.seed),
    [
      20260716, 20260717, 20260718, 20260719, 20260720, 20260721, 20260722, 20260723, 20260724, 20260725, 20260726,
      20260727, 20260728,
    ],
  );
  assert.equal(result.status, 'pass');
  assert.equal(
    result.gates.every((gate) => gate.pass),
    true,
  );
});

test('diagnostic collection reports completion without treating quarantine evidence as acceptance', () => {
  const diagnosticCollection = {
    completedTenTurnBatch: true,
    quarantineCount: 1,
    quarantinedTurns: [4],
    firstQuarantinedTurn: 4,
    evidenceSegments: {
      cleanPrefix: { throughPublicTurn: 3, turnCount: 3 },
      boundaryAttempts: { turn: 4, candidateCount: 3 },
      contaminatedSuffix: { fromPublicTurn: 4, turnCount: 7 },
    },
    candidates: [],
    failureClusters: [],
  };
  const result = assessCharacterAdaptationReport(report({ turnCount: 10, diagnosticCollection }), {
    mode: 'diagnostic',
  });
  assert.equal(result.status, 'diagnostic_complete');
  assert.equal(result.gates.length, 0);
  assert.equal(result.observed.quarantineCount, 1);
  assert.equal(result.diagnosticCollection.firstQuarantinedTurn, 4);
});

test('diagnostic collection requires the complete fixed ten-turn horizon', () => {
  const result = assessCharacterAdaptationReport(report({ turnCount: 9 }), { mode: 'diagnostic' });
  assert.equal(result.status, 'diagnostic_incomplete');
});

test('character loop gate accepts one audited-safe deterministic repair', () => {
  const result = assessCharacterAdaptationReport(
    report({
      guardAccounting: { finalDeliveryAuditFailures: 0, deterministicFallbackTurns: 1 },
    }),
  );
  assert.equal(result.status, 'pass');
  assert.equal(result.gates.find((gate) => gate.name === 'bounded safe repair')?.pass, true);
});

test('character loop gate rejects repeated fallback, duplicated clue delivery, and source replacement', () => {
  const result = assessCharacterAdaptationReport(
    report({
      guardAccounting: { finalDeliveryAuditFailures: 0, deterministicFallbackTurns: 2 },
      characterAdaptation: {
        clueReleaseTurns: 2,
        hostVisibleTurns: 4,
        hostPartCounts: { authored_source: 6 },
        metaPerformanceTurns: 1,
        roleStageDirectionTurns: 1,
        sourceReplacementTurns: 2,
        duplicateClueDeliveryTurns: 1,
      },
    }),
  );
  assert.equal(result.status, 'fail');
  assert.deepEqual(
    result.gates.filter((gate) => !gate.pass).map((gate) => gate.name),
    [
      'bounded safe repair',
      'no meta-performance',
      'host/source separation',
      'single clue delivery',
      'host visible',
      'host variation',
    ],
  );
});
