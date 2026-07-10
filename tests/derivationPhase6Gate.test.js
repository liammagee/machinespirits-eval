import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { analyzeGateArtifacts, buildGatePlan, renderGateMarkdown } from '../scripts/run-derivation-phase6-gate.js';

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test('buildGatePlan freezes rows across worlds, arms, and seeds', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-gate-plan-'));
  const plan = buildGatePlan({
    label: 'unit',
    out: root,
    worlds: ['marrick'],
    arms: ['baseline', 'field_planner_advisory'],
    seeds: ['11', '13'],
    decayRate: 0.08,
    mode: 'mock',
  });

  assert.equal(plan.rows.length, 4);
  assert.equal(plan.rows[0].id, 'marrick-baseline-s11');
  assert.match(plan.rows[0].command, /--decay/);
  assert.match(plan.rows[1].command, /--field-planner/);
  assert.equal(plan.decay.rate, 0.08);
});

test('field_report_only placebo arm is flag-distinct from baseline', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-gate-placebo-'));
  const plan = buildGatePlan({
    label: 'unit',
    out: root,
    worlds: ['marrick'],
    arms: ['baseline', 'field_report_only', 'field_planner_advisory', 'field_planner_enforce'],
    seeds: ['1'],
    mode: 'mock',
  });
  const commandByArm = Object.fromEntries(plan.rows.map((row) => [row.armKey, row.command]));
  // Decision rule 2 of the gate plan is only dischargeable if the placebo arm
  // actually differs from baseline at the command level.
  assert.notEqual(commandByArm.field_report_only, commandByArm.baseline);
  assert.match(commandByArm.field_report_only, /--field-report-context/u);
  assert.doesNotMatch(commandByArm.field_report_only, /--field-planner/u);
  assert.doesNotMatch(commandByArm.baseline, /--field-report-context/u);
});

test('analyzeGateArtifacts counts field-report-context non-leak audit failures as safety failures', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-gate-report-audit-'));
  const plan = buildGatePlan({
    label: 'unit',
    out: root,
    worlds: ['marrick'],
    arms: ['field_report_only'],
    seeds: ['1'],
    mode: 'mock',
  });
  const row = plan.rows[0];
  writeJson(path.join(row.runDir, 'diagnosis.json'), {
    verdict: 'grounded_anagnorisis',
    turnsPlayed: 12,
    turnCap: 20,
    releaseAdherence: { onCue: 3, rows: [{}, {}, {}], deviations: [], missed: [], unscheduled: [] },
    eventsByType: { grounded_anagnorisis: 1 },
    fabricatedFacts: [],
  });
  writeJson(path.join(row.runDir, 'result.json'), {
    fieldReportContext: [
      { turn: 1, nonLeakAuditOk: true },
      { turn: 2, nonLeakAuditOk: false },
    ],
  });
  writeJson(path.join(row.runDir, 'dialogue-report.json'), { summary: {} });
  fs.writeFileSync(path.join(row.runDir, 'dialogue-report.md'), '# report\n');
  fs.writeFileSync(path.join(row.runDir, 'dynamic-field.svg'), '<svg></svg>\n');

  const report = analyzeGateArtifacts(plan, { [row.id]: 0 });
  assert.equal(report.rows[0].fieldReportContext.count, 2);
  assert.equal(report.rows[0].fieldReportContext.nonLeakAuditFailures, 1);
  assert.equal(report.rows[0].safetyFailures, 1);
});

test('analyzeGateArtifacts summarizes field-planner movement and safety gates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-gate-analysis-'));
  const plan = buildGatePlan({
    label: 'unit',
    out: root,
    worlds: ['marrick'],
    arms: ['field_planner_advisory'],
    seeds: ['1'],
    mode: 'mock',
  });
  const row = plan.rows[0];
  writeJson(path.join(row.runDir, 'diagnosis.json'), {
    verdict: 'grounded_anagnorisis',
    turnsPlayed: 12,
    turnCap: 20,
    firstForcedTurn: 12,
    assertedGroundedTurn: 12,
    releaseAdherence: { onCue: 3, rows: [{}, {}, {}], deviations: [], missed: [], unscheduled: [] },
    eventsByType: { grounded_anagnorisis: 1 },
    fabricatedFacts: [],
    usage: { calls: 4, costUSD: 0 },
  });
  writeJson(path.join(row.runDir, 'result.json'), {
    fieldPlanner: [
      {
        selectedMoveFamily: 'release_next_evidence',
        candidateMoves: [{ score: 0.7 }, { score: 0.3 }],
        outcome: { efficacy: 'movement_observed', projectionAlignment: 'directionally_matched' },
        conductDecision: { nonLeakAuditOk: true },
      },
      {
        selectedMoveFamily: 'release_next_evidence',
        candidateMoves: [{ score: 0.6 }, { score: 0.45 }],
        outcome: { efficacy: 'no_immediate_movement', projectionAlignment: 'unclear' },
        conductDecision: { nonLeakAuditOk: true },
      },
    ],
  });
  writeJson(path.join(row.runDir, 'dialogue-report.json'), {
    summary: { fieldPlannerNonLeakAuditFailures: 0 },
  });
  fs.writeFileSync(path.join(row.runDir, 'dialogue-report.md'), '# report\n');
  fs.writeFileSync(path.join(row.runDir, 'dynamic-field.svg'), '<svg></svg>\n');

  const report = analyzeGateArtifacts(plan, { [row.id]: 0 });
  assert.equal(report.okRows, 1);
  assert.equal(report.groundedRows, 1);
  assert.equal(report.safetyFailures, 0);
  assert.equal(report.rows[0].fieldPlanner.movementObserved, 1);
  assert.equal(report.rows[0].fieldPlanner.meanScoreMargin, 0.275);
  assert.equal(report.groups[0].selectedMoveCounts.release_next_evidence, 2);
  assert.match(renderGateMarkdown(report), /Phase 6 Field-Planner Gate/u);
});

test('analyzeGateArtifacts leaves mean turns blank when no rows ground', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-gate-no-grounding-'));
  const plan = buildGatePlan({
    label: 'unit',
    out: root,
    worlds: ['marrick'],
    arms: ['baseline'],
    seeds: ['1'],
    mode: 'mock',
  });
  const row = plan.rows[0];
  writeJson(path.join(row.runDir, 'diagnosis.json'), {
    verdict: 'disengagement',
    turnsPlayed: 18,
    turnCap: 20,
    releaseAdherence: { onCue: 3, rows: [{}, {}, {}], deviations: [], missed: [], unscheduled: [] },
    eventsByType: { disengagement: 1 },
    fabricatedFacts: [],
  });
  writeJson(path.join(row.runDir, 'result.json'), {});
  writeJson(path.join(row.runDir, 'dialogue-report.json'), { summary: {} });
  fs.writeFileSync(path.join(row.runDir, 'dialogue-report.md'), '# report\n');
  fs.writeFileSync(path.join(row.runDir, 'dynamic-field.svg'), '<svg></svg>\n');

  const report = analyzeGateArtifacts(plan, { [row.id]: 0 });
  assert.equal(report.groups[0].grounded, 0);
  assert.equal(report.groups[0].meanTurns, null);
  assert.match(renderGateMarkdown(report), /\| baseline \| 1\/1 \| 0\/1 \(0%\) \| - \| 0 \| 0 \| - \|/u);
});
