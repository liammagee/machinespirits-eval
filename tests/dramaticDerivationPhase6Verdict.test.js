import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { hashFile } from '../services/experimentRunArtifacts.js';
import { evaluatePhase6Verdict } from '../services/dramaticDerivation/phase6Verdict.js';

const contractPath = 'config/drama-derivation/phase6-field-planner-gate-v2.json';
const evaluatorPath = 'services/dramaticDerivation/phase6Verdict.js';
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

function replicationParent(winner = 'field_planner_advisory') {
  return {
    parentRunId: 'sealed-parent-k5',
    verdict: 'provisional_promote',
    winner,
    seeds: [...contract.seedBlocks[0]],
    verdictEvaluatorVersion: contract.verdictEvaluatorVersion,
    decisionContractSha256: hashFile(contractPath),
    verdictEvaluatorSha256: hashFile(evaluatorPath),
    reportSha256: 'a'.repeat(64),
    sealSha256: 'b'.repeat(64),
    rowCount: contract.worlds.length * contract.arms.length * contract.seedBlocks[0].length,
    rowsSha256: 'c'.repeat(64),
  };
}

function settingFor(settings, arm) {
  return {
    groundedPerBlock: 3,
    groundedPerBlockByWorld: {},
    turns: 20,
    hardFailures: 0,
    earlyLatePerRow: 0,
    ...(settings[arm] || {}),
  };
}

function buildReport(settings = {}, seeds = contract.seedBlocks[0]) {
  const rows = [];
  for (const worldKey of contract.worlds) {
    for (const seed of seeds) {
      for (const armKey of contract.arms) {
        const setting = settingFor(settings, armKey);
        const positionInBlock = ((Number(seed) - 1) % contract.seedBlocks[0].length) + 1;
        const groundedLimit = setting.groundedPerBlockByWorld[worldKey] ?? setting.groundedPerBlock;
        const grounded = positionInBlock <= groundedLimit;
        const turnsPlayed = grounded ? setting.turns : 24;
        const planner = armKey.startsWith('field_planner');
        const reportOnly = armKey === 'field_report_only';
        const firstRow = worldKey === contract.worlds[0] && String(seed) === seeds[0];
        rows.push({
          id: `${worldKey}-${armKey}-s${seed}`,
          worldKey,
          armKey,
          seed: String(seed),
          ok: true,
          grounded,
          turnsPlayed,
          turnCap: 24,
          decay:
            armKey === 'baseline' && positionInBlock === 1
              ? { events: 1, degradedTurnIntegral: 2 }
              : { events: 0, degradedTurnIntegral: 0 },
          fieldPlanner: {
            count: planner ? turnsPlayed : 0,
            candidateCountMismatches: 0,
            missingOutcomes: 0,
            missingSelectedScores: 0,
            nonLeakAuditFailures: 0,
          },
          fieldReportContext: { count: reportOnly ? turnsPlayed : 0, nonLeakAuditFailures: 0 },
          conductPolicy: {
            loggedTurns: planner ? turnsPlayed : 0,
            complianceChecked: planner ? turnsPlayed : 0,
            complianceFailed: 0,
            enforcementChanged: armKey === 'field_planner_enforce' && firstRow ? 1 : 0,
          },
          transcriptLeakAudit: { checked: true, hitCount: 0 },
          safety: {
            hardFailures: firstRow ? setting.hardFailures : 0,
            overreaches: 0,
            earlyLateReleases: setting.earlyLatePerRow,
            reachableReleases: 5,
            invalidReleaseClaims: 0,
            transcriptLeakHits: 0,
          },
        });
      }
    }
  }
  const report = {
    mode: 'real',
    rowCount: rows.length,
    okRows: rows.length,
    rows,
  };
  if (seeds.length === contract.seedBlocks.flat().length) report.priorProvisional = replicationParent();
  return report;
}

test('Phase 6A returns provisional_promote for a safe planner lift over baseline and placebo', () => {
  const report = buildReport({ field_planner_advisory: { groundedPerBlock: 5 } });
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'provisional_promote');
  assert.equal(decision.winner, 'field_planner_advisory');
});

test('Phase 6A accepts a two-turn fixed-horizon efficiency lift when completion is unchanged', () => {
  const report = buildReport({
    baseline: { groundedPerBlock: 5, turns: 20 },
    field_report_only: { groundedPerBlock: 5, turns: 20 },
    field_planner_advisory: { groundedPerBlock: 5, turns: 17 },
    field_planner_enforce: { groundedPerBlock: 5, turns: 20 },
  });
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'provisional_promote');
  assert.equal(decision.pooled.planner.field_planner_advisory.againstBaseline.efficiencyLift, true);
});

test('Phase 6A requires the same arm to reproduce in both five-seed blocks for local promotion', () => {
  const report = buildReport({ field_planner_advisory: { groundedPerBlock: 5 } }, contract.seedBlocks.flat());
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'promote_local');
  assert.equal(decision.winner, 'field_planner_advisory');
});

test('Phase 6A refuses local promotion when the sealed parent winner differs from the replication winner', () => {
  const report = buildReport({ field_planner_advisory: { groundedPerBlock: 5 } }, contract.seedBlocks.flat());
  report.priorProvisional = replicationParent('field_planner_enforce');
  const decision = evaluatePhase6Verdict(report, contract);
  assert.notEqual(decision.verdict, 'promote_local');
});

test('Phase 6A classifies an improving but unsafe planner as a negative control', () => {
  const report = buildReport({
    field_planner_advisory: { groundedPerBlock: 5, hardFailures: 1 },
  });
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'negative_control');
  assert.equal(decision.winner, 'field_planner_advisory');
});

test('Phase 6A applies the frozen 0.10 release-deviation non-inferiority margin', () => {
  const report = buildReport({
    field_planner_advisory: { groundedPerBlock: 5, earlyLatePerRow: 1 },
  });
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'negative_control');
  assert.equal(decision.pooled.planner.field_planner_advisory.safety.releasePass, false);
});

test('Phase 6A attributes a placebo-matched lift to instrumentation', () => {
  const report = buildReport({
    field_report_only: { groundedPerBlock: 5 },
    field_planner_advisory: { groundedPerBlock: 5 },
  });
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'instrumentation_effect');
});

test('Phase 6A reports ceiling only after the decay manipulation is reached', () => {
  const report = buildReport({
    baseline: { groundedPerBlock: 5 },
    field_report_only: { groundedPerBlock: 5 },
    field_planner_advisory: { groundedPerBlock: 5, turns: 19 },
    field_planner_enforce: { groundedPerBlock: 5 },
  });
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'ceiling');
});

test('Phase 6A blocks an aggregate lift with material one-world negative transfer', () => {
  const report = buildReport({
    field_planner_advisory: {
      groundedPerBlockByWorld: { marrick: 2, hethel: 5, marrick_resistant: 5 },
    },
  });
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'null');
  assert.equal(decision.pooled.planner.field_planner_advisory.againstBaseline.negativeTransfer, true);
});

test('Phase 6A refuses to interpret a matrix where the baseline decay manipulation was not reached', () => {
  const report = buildReport();
  for (const row of report.rows) row.decay = { events: 0, degradedTurnIntegral: 0 };
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'null_invalid_instrumentation');
  assert.equal(decision.manipulation.pass, false);
});

test('Phase 6A requires enforce to change at least one realized turn', () => {
  const report = buildReport({ field_planner_enforce: { groundedPerBlock: 5 } });
  for (const row of report.rows) row.conductPolicy.enforcementChanged = 0;
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'null');
  assert.equal(decision.instrumentation.planners.field_planner_enforce.pass, false);
});

test('Phase 6A freezes an 80% minimum advisory compliance rate', () => {
  const report = buildReport({ field_planner_advisory: { groundedPerBlock: 5 } });
  for (const row of report.rows.filter((candidate) => candidate.armKey === 'field_planner_advisory')) {
    row.conductPolicy.complianceFailed = Math.ceil(row.conductPolicy.complianceChecked * 0.21);
  }
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.instrumentation.planners.field_planner_advisory.pass, false);
  assert.ok(decision.instrumentation.planners.field_planner_advisory.complianceRate < 0.8);
  assert.notEqual(decision.verdict, 'provisional_promote');
});

test('Phase 6A invalidates the comparison when field-report-only safety fails', () => {
  const report = buildReport({
    field_report_only: { hardFailures: 1 },
    field_planner_advisory: { groundedPerBlock: 5 },
  });
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'null_invalid_instrumentation');
  assert.equal(decision.pooled.placeboSafety.pass, false);
});

test('Phase 6A rejects duplicate cells even when the total row count is unchanged', () => {
  const report = buildReport();
  report.rows.at(-1).worldKey = report.rows[0].worldKey;
  report.rows.at(-1).armKey = report.rows[0].armKey;
  report.rows.at(-1).seed = report.rows[0].seed;
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'incomplete');
  assert.ok(decision.validationErrors.some((error) => error.includes('duplicate frozen matrix cell')));
  assert.ok(decision.validationErrors.some((error) => error.includes('missing frozen matrix cell')));
});

test('Phase 6A rejects null turn counts instead of coercing them to zero', () => {
  const report = buildReport();
  report.rows[0].turnsPlayed = null;
  const decision = evaluatePhase6Verdict(report, contract);
  assert.equal(decision.verdict, 'incomplete');
  assert.ok(decision.validationErrors.some((error) => error.includes('turnsPlayed must be a positive integer')));
});

test('Phase 6A labels the bounded real canary as excluded technical evidence', () => {
  const decision = evaluatePhase6Verdict({ mode: 'real', evidenceKind: 'technical_canary' }, contract);
  assert.equal(decision.verdict, 'technical_canary_only');
  assert.equal(decision.claimStatus, 'excluded');
});
