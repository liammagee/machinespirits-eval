import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  analyzeGateArtifacts,
  assertPhase6RealGateProtocolReady,
  assertPhase6RealRunGitState,
  buildGatePlan,
  phase6RunCloseoutDisposition,
  phase6RealGateProtocolBlockers,
  renderGateMarkdown,
} from '../scripts/run-derivation-phase6-gate.js';
import { verifyExperimentRun } from '../services/experimentRunArtifacts.js';

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

test('Phase 6 smoke profile freezes the preregistered world-005, world-006, and world-019 coverage', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-gate-smoke-worlds-'));
  const plan = buildGatePlan({
    label: 'smoke-worlds',
    out: root,
    profile: 'smoke',
    arms: ['baseline'],
    seeds: ['1'],
    mode: 'mock',
  });

  assert.deepEqual(plan.worlds, ['marrick', 'hethel', 'marrick_resistant']);
  assert.deepEqual(
    plan.rows.map((row) => row.worldKey),
    ['marrick', 'hethel', 'marrick_resistant'],
  );
});

test('Phase 6 real mode requires a clean tree at the exact frozen SHA while mock mode remains available', () => {
  const clean = { sha: 'abc123', dirty: false };
  const dirty = { sha: 'abc123', dirty: true };
  const frozenPlan = { provenance: { git: { sha: 'abc123', dirty: false } } };

  assert.doesNotThrow(() => assertPhase6RealRunGitState({ mode: 'real', gitFingerprint: clean, frozenPlan }));
  assert.doesNotThrow(() => assertPhase6RealRunGitState({ mode: 'mock', gitFingerprint: dirty, frozenPlan }));
  assert.throws(
    () => assertPhase6RealRunGitState({ mode: 'real', gitFingerprint: dirty, frozenPlan }),
    /dirty working tree/u,
  );
  assert.throws(
    () =>
      assertPhase6RealRunGitState({
        mode: 'real',
        gitFingerprint: clean,
        frozenPlan: { provenance: { git: { sha: 'abc123', dirty: true } } },
      }),
    /frozen run plan was created from a dirty tree/u,
  );
  assert.throws(
    () =>
      assertPhase6RealRunGitState({
        mode: 'real',
        gitFingerprint: { sha: 'def456', dirty: false },
        frozenPlan,
      }),
    /frozen run plan requires abc123/u,
  );
});

test('Phase 6 real mode is fail-closed while the hidden+proofDebt baseline and verdict contract are unresolved', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-gate-protocol-block-'));
  const realPlan = buildGatePlan({
    label: 'blocked-real',
    out: root,
    profile: 'smoke',
    seeds: ['1', '2', '3', '4', '5'],
    decayRate: 0.08,
    mode: 'real',
  });
  const blockers = phase6RealGateProtocolBlockers(realPlan);
  assert.ok(blockers.some((reason) => reason.includes('--proof-debt-guard')));
  assert.ok(blockers.some((reason) => reason.includes('decision contract')));
  assert.ok(blockers.some((reason) => reason.includes('verdict evaluator')));
  assert.throws(() => assertPhase6RealGateProtocolReady(realPlan), /Refusing Phase 6 real run/u);

  const mockPlan = buildGatePlan({
    label: 'mock-still-available',
    out: root,
    worlds: ['marrick'],
    arms: ['baseline'],
    seeds: ['1'],
    mode: 'mock',
  });
  assert.deepEqual(phase6RealGateProtocolBlockers(mockPlan), []);
  assert.doesNotThrow(() => assertPhase6RealGateProtocolReady(mockPlan));
});

test('Phase 6 incomplete rows remain unsealed and resumable', () => {
  assert.equal(phase6RunCloseoutDisposition({ okRows: 3, rowCount: 4 }), 'pause_unsealed');
  assert.equal(phase6RunCloseoutDisposition({ okRows: 4, rowCount: 4 }), 'seal_complete');
  assert.equal(phase6RunCloseoutDisposition({ okRows: 0, rowCount: 0 }), 'pause_unsealed');
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
  fs.writeFileSync(path.join(row.runDir, 'transcript.md'), '# transcript\n');
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
  fs.writeFileSync(path.join(row.runDir, 'transcript.md'), '# transcript\n');
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
  fs.writeFileSync(path.join(row.runDir, 'transcript.md'), '# transcript\n');
  fs.writeFileSync(path.join(row.runDir, 'dialogue-report.md'), '# report\n');
  fs.writeFileSync(path.join(row.runDir, 'dynamic-field.svg'), '<svg></svg>\n');

  const report = analyzeGateArtifacts(plan, { [row.id]: 0 });
  assert.equal(report.groups[0].grounded, 0);
  assert.equal(report.groups[0].meanTurns, null);
  assert.match(renderGateMarkdown(report), /\| baseline \| 1\/1 \| 0\/1 \(0%\) \| - \| 0 \| 0 \| - \|/u);
});

test('Phase 6 dry-run writes an immutable, checksummed, replayable evidence transaction', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-gate-transaction-'));
  const label = 'sealed-dry-run';
  const gateDir = path.join(root, label);
  try {
    execFileSync(
      process.execPath,
      [
        'scripts/run-derivation-phase6-gate.js',
        '--label',
        label,
        '--out',
        root,
        '--worlds',
        'marrick',
        '--arms',
        'baseline',
        '--seeds',
        '7',
        '--run-seed',
        '1701',
        '--mode',
        'mock',
        '--dry-run',
      ],
      { cwd: path.resolve('.'), encoding: 'utf8' },
    );

    for (const name of [
      'run-plan.json',
      'run-events.jsonl',
      'run-seal.json',
      'manifest.json',
      'phase6-gate-report.json',
      'phase6-gate-report.md',
      'phase6-gate-report.html',
    ]) {
      assert.ok(fs.existsSync(path.join(gateDir, name)), `${name} should exist`);
    }
    const plan = JSON.parse(fs.readFileSync(path.join(gateDir, 'run-plan.json'), 'utf8'));
    assert.equal(plan.schema, 'machinespirits.experiment-run-plan.v1');
    assert.equal(plan.randomization.masterSeed, 1701);
    assert.deepEqual(plan.randomization.jobOrder, ['marrick-baseline-s7']);
    assert.equal(plan.requiredObservedModelRoles.length, 0, 'dry-run makes no model calls');
    assert.ok(Object.values(plan.hashes).every((digest) => /^[0-9a-f]{64}$/u.test(digest)));
    assert.match(plan.metadata.phase6DecisionRulesSha256, /^[0-9a-f]{64}$/u);

    const verification = verifyExperimentRun(gateDir);
    assert.equal(verification.ok, true, verification.errors.join('\n'));
    assert.ok(verification.inventory.some((entry) => entry.path === 'manifest.json'));
    assert.ok(verification.inventory.some((entry) => entry.path === 'phase6-gate-report.json'));

    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            'scripts/run-derivation-phase6-gate.js',
            '--label',
            label,
            '--out',
            root,
            '--worlds',
            'marrick',
            '--arms',
            'baseline',
            '--seeds',
            '7',
            '--run-seed',
            '1701',
            '--mode',
            'mock',
            '--dry-run',
          ],
          { cwd: path.resolve('.'), encoding: 'utf8', stdio: 'pipe' },
        ),
      /already sealed|immutable run plan/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
