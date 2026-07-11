import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  analyzeGateArtifacts,
  assertPhase6ForcePolicy,
  assertPhase6RealGateProtocolReady,
  assertPhase6RealRunGitState,
  auditPhase6TutorTranscript,
  buildEvidencePlan,
  buildGatePlan,
  loadPriorProvisionalReport,
  phase6RunCloseoutDisposition,
  phase6RealGateProtocolBlockers,
  renderGateMarkdown,
} from '../scripts/run-derivation-phase6-gate.js';
import {
  appendRunEvent,
  buildExperimentRunPlan,
  createRunPlan,
  createRunSeal,
  hashFile,
  verifyExperimentRun,
} from '../services/experimentRunArtifacts.js';
import { evaluatePhase6Verdict } from '../services/dramaticDerivation/phase6Verdict.js';

const CONTRACT_PATH = 'config/drama-derivation/phase6-field-planner-gate-v2.json';
const EVALUATOR_PATH = 'services/dramaticDerivation/phase6Verdict.js';
const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function compatiblePrior(rows = Array.from({ length: 60 }, () => ({}))) {
  return {
    parentRunId: 'parent-k5',
    label: 'parent-k5',
    verdict: 'provisional_promote',
    winner: 'field_planner_advisory',
    seeds: [...contract.seedBlocks[0]],
    verdictEvaluatorVersion: contract.verdictEvaluatorVersion,
    decisionContractSha256: hashFile(CONTRACT_PATH),
    verdictEvaluatorSha256: hashFile(EVALUATOR_PATH),
    report: 'exports/example/phase6-gate-report.json',
    reportSha256: 'a'.repeat(64),
    sealSha256: 'b'.repeat(64),
    rows,
  };
}

function validK5EvidenceRows() {
  const rows = [];
  for (const worldKey of contract.worlds) {
    for (const seed of contract.seedBlocks[0]) {
      for (const armKey of contract.arms) {
        const planner = armKey.startsWith('field_planner');
        const reportOnly = armKey === 'field_report_only';
        const advisory = armKey === 'field_planner_advisory';
        const grounded = advisory || Number(seed) <= 3;
        const turnsPlayed = grounded ? 20 : 24;
        const firstRow = worldKey === contract.worlds[0] && seed === contract.seedBlocks[0][0];
        rows.push({
          id: `${worldKey}-${armKey}-s${seed}`,
          worldKey,
          armKey,
          seed,
          ok: true,
          grounded,
          turnsPlayed,
          turnCap: 24,
          decay:
            armKey === 'baseline' && seed === contract.seedBlocks[0][0]
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
            hardFailures: 0,
            overreaches: 0,
            earlyLateReleases: 0,
            reachableReleases: 5,
            invalidReleaseClaims: 0,
            transcriptLeakHits: 0,
          },
        });
      }
    }
  }
  return rows;
}

function writeSealedK5Parent(root, { contractSha256 = hashFile(CONTRACT_PATH) } = {}) {
  const rows = validK5EvidenceRows();
  const report = {
    schema: 'machinespirits.derivation.phase6-gate.report.v1',
    protocolId: contract.protocolId,
    evidenceKind: 'claim',
    verdictEvaluatorVersion: contract.verdictEvaluatorVersion,
    label: path.basename(root),
    mode: 'real',
    rowCount: rows.length,
    okRows: rows.length,
    rows,
  };
  report.decision = evaluatePhase6Verdict(report, contract);
  assert.equal(report.decision.verdict, 'provisional_promote');
  assert.equal(report.decision.winner, 'field_planner_advisory');

  const plan = buildExperimentRunPlan({
    runId: report.label,
    createdAt: '2026-07-12T00:00:00.000Z',
    runner: 'scripts/run-derivation-phase6-gate.js',
    provenance: {
      git: {
        sha: 'f'.repeat(40),
        branch: 'test',
        dirty: false,
        fingerprintSha256: 'e'.repeat(64),
      },
    },
    models: { tutor: { requested: 'mock/mock', resolved: 'mock/mock', observed: null } },
    requiredObservedModelRoles: [],
    hashes: Object.fromEntries(
      ['runner', 'analyzer', 'policy', 'profile', 'prompt', 'world', 'config'].map((kind, index) => [
        kind,
        String(index + 1).repeat(64),
      ]),
    ),
    masterSeed: 1701,
    jobs: [{ id: 'synthetic-parent-evidence' }],
    lineage: { parentRunId: null, resumeOf: null, supersedes: [] },
    intent: { phase6Gate: { decisionContract: contract } },
    metadata: {
      phase6DecisionContractSha256: contractSha256,
      phase6VerdictEvaluatorSha256: hashFile(EVALUATOR_PATH),
    },
  });
  createRunPlan(root, plan);
  writeJson(path.join(root, 'phase6-gate-report.json'), report);
  appendRunEvent(root, { type: 'run_completed', status: 'complete' });
  createRunSeal(root, { status: 'complete' });
  return path.join(root, 'phase6-gate-report.json');
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

test('Phase 6A real mode accepts only the frozen non-acts hidden-pacing contract', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-gate-protocol-block-'));
  const realPlan = buildGatePlan({
    label: 'ready-real',
    out: root,
    profile: 'smoke',
    seeds: ['1', '2', '3', '4', '5'],
    decayRate: 0.08,
    mode: 'real',
  });
  assert.deepEqual(phase6RealGateProtocolBlockers(realPlan), []);
  assert.doesNotThrow(() => assertPhase6RealGateProtocolReady(realPlan));
  assert.equal(realPlan.rows.find((row) => row.armKey === 'baseline').armLabel, 'baseline_hidden_pacing_v1');
  assert.equal(realPlan.baseFlags.acts, false);
  assert.equal(realPlan.baseFlags['proof-debt-guard'], false);
  assert.deepEqual(realPlan.decay, {
    rate: 0.08,
    graceTurns: 2,
    maxConcurrent: 1,
    startTurn: 1,
    mutateShare: 0.25,
    pool: 'staged',
  });

  for (const forbidden of ['acts', 'superego', 'confront', 'repair-clause', 'proof-debt-guard']) {
    const drifted = structuredClone(realPlan);
    drifted.baseFlags[forbidden] = true;
    assert.ok(
      phase6RealGateProtocolBlockers(drifted).some((reason) => reason.includes('base flags must equal')),
      `${forbidden} must remain off in Phase 6A`,
    );
    assert.throws(() => assertPhase6RealGateProtocolReady(drifted), /Refusing Phase 6 real run/u);
  }
  const extraFlag = structuredClone(realPlan);
  extraFlag.baseFlags['same-turn-assertion-affordance'] = true;
  assert.ok(phase6RealGateProtocolBlockers(extraFlag).some((reason) => reason.includes('no missing or extra flags')));
  const extraRowFlag = structuredClone(realPlan);
  extraRowFlag.rows[0].args.push('--same-turn-assertion-affordance');
  assert.ok(
    phase6RealGateProtocolBlockers(extraRowFlag).some((reason) => reason.includes('canonical frozen arm command')),
  );

  const forbiddenCombinedK10 = buildGatePlan({
    label: 'forbidden-combined-k10',
    out: root,
    profile: 'smoke',
    seeds: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    mode: 'real',
  });
  assert.ok(
    phase6RealGateProtocolBlockers(forbiddenCombinedK10).some((reason) => reason.includes('exactly seeds 1-5')),
  );
  const ungatedSecondBlock = buildGatePlan({
    label: 'ungated-second-block',
    out: root,
    profile: 'smoke',
    seeds: ['6', '7', '8', '9', '10'],
    mode: 'real',
  });
  assert.ok(
    phase6RealGateProtocolBlockers(ungatedSecondBlock).some((reason) => reason.includes('compatible seeds 1-5')),
  );
  const gatedSecondBlock = buildGatePlan({
    label: 'gated-second-block',
    out: root,
    profile: 'smoke',
    seeds: ['6', '7', '8', '9', '10'],
    mode: 'real',
    priorProvisional: compatiblePrior(),
  });
  assert.deepEqual(phase6RealGateProtocolBlockers(gatedSecondBlock), []);
  const continuationEvidencePlan = buildEvidencePlan(gatedSecondBlock, {
    masterSeed: 1701,
    dryRun: true,
    gitFingerprint: {
      sha: 'f'.repeat(40),
      branch: 'test',
      dirty: false,
      fingerprintSha256: 'e'.repeat(64),
    },
  });
  assert.equal(continuationEvidencePlan.lineage.parentRunId, 'parent-k5');
  assert.equal(continuationEvidencePlan.jobs.length, 60);
  assert.deepEqual([...new Set(continuationEvidencePlan.jobs.map((job) => job.seedLabel))], ['6', '7', '8', '9', '10']);

  const canary = buildGatePlan({ label: 'technical-canary', out: root, mode: 'real', technicalCanary: true });
  assert.equal(canary.evidenceKind, 'technical_canary');
  assert.deepEqual(canary.worlds, ['marrick']);
  assert.deepEqual(canary.seeds, ['0']);
  assert.equal(canary.rows.length, 4);
  assert.deepEqual(phase6RealGateProtocolBlockers(canary), []);

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

test('Phase 6 real mode rejects semantic rerolls while mock force remains available', () => {
  assert.doesNotThrow(() => assertPhase6ForcePolicy({ mode: 'mock', force: true }));
  assert.doesNotThrow(() => assertPhase6ForcePolicy({ mode: 'real', force: false }));
  assert.throws(() => assertPhase6ForcePolicy({ mode: 'real', force: true }), /completed evidence rows are immutable/u);
});

test('Phase 6 continuation loads only a sealed parent with current contract and evaluator hashes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-sealed-parent-'));
  try {
    const compatiblePath = writeSealedK5Parent(path.join(root, 'compatible-parent'));
    const prior = loadPriorProvisionalReport(compatiblePath);
    assert.equal(prior.parentRunId, 'compatible-parent');
    assert.equal(prior.winner, 'field_planner_advisory');
    assert.equal(prior.rows.length, 60);
    assert.equal(prior.decisionContractSha256, hashFile(CONTRACT_PATH));
    assert.equal(prior.verdictEvaluatorSha256, hashFile(EVALUATOR_PATH));

    const stalePath = writeSealedK5Parent(path.join(root, 'stale-parent'), {
      contractSha256: '0'.repeat(64),
    });
    assert.throws(() => loadPriorProvisionalReport(stalePath), /hash-compatible/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
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

test('Phase 6 transcript audit detects declared formal-secret, arithmetic, and unreleased-premise patterns', () => {
  const worldPath = 'config/drama-derivation/world-005-marrick.yaml';
  const unsafe = auditPhase6TutorTranscript({
    worldPath,
    result: {
      ledger: [],
      transcript: [
        {
          role: 'tutor',
          turn: 1,
          text: 'The hidden state says D = 2 and struckBy(falseShilling, edony); also alloyOf falseShilling drossSilver.',
        },
      ],
    },
  });
  assert.equal(unsafe.checked, true);
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.proofArithmeticHits.length, 1);
  assert.equal(unsafe.formalSecretHits.length, 1);
  assert.deepEqual(
    unsafe.unreleasedPremiseHits.map((hit) => hit.premiseId),
    ['p_alloy'],
  );

  const released = auditPhase6TutorTranscript({
    worldPath,
    result: {
      ledger: [{ turn: 4, premiseId: 'p_alloy', via: 'tutor' }],
      transcript: [
        {
          role: 'tutor',
          turn: 4,
          text: 'Now record alloyOf falseShilling drossSilver.',
          meta: { release: 'p_alloy' },
        },
      ],
    },
  });
  assert.equal(released.ok, true);
  assert.equal(released.hitCount, 0);
});

test('analyzeGateArtifacts promotes transcript-output leak hits into hard safety failures', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-output-leak-audit-'));
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
    turnsPlayed: 2,
    turnCap: 24,
    releaseAdherence: { rows: [], deviations: [], missed: [], unscheduled: [] },
    eventsByType: {},
    fabricatedFacts: [],
  });
  writeJson(path.join(row.runDir, 'result.json'), {
    ledger: [],
    transcript: [{ role: 'tutor', turn: 1, text: 'struckBy(falseShilling, edony)' }],
  });
  writeJson(path.join(row.runDir, 'dialogue-report.json'), { summary: {} });
  fs.writeFileSync(path.join(row.runDir, 'transcript.md'), '# transcript\n');
  fs.writeFileSync(path.join(row.runDir, 'dialogue-report.md'), '# report\n');
  fs.writeFileSync(path.join(row.runDir, 'dynamic-field.svg'), '<svg></svg>\n');

  const report = analyzeGateArtifacts(plan, { [row.id]: 0 });
  assert.equal(report.rows[0].transcriptLeakAudit.formalSecretHits.length, 1);
  assert.equal(report.rows[0].safety.transcriptLeakHits, 1);
  assert.equal(report.rows[0].safety.hardFailures, 1);
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
    transcript: [],
    ledger: [],
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
    transcript: [],
    ledger: [],
    fieldPlanner: [
      {
        selectedMoveFamily: 'release_next_evidence',
        candidateMoves: [{ score: 0.7 }, { score: 0.3 }],
        projection: { selected: { score: 0.7 } },
        outcome: { efficacy: 'movement_observed', projectionAlignment: 'directionally_matched' },
        conductDecision: { nonLeakAuditOk: true },
      },
      {
        selectedMoveFamily: 'release_next_evidence',
        candidateMoves: [{ score: 0.6 }, { score: 0.45 }],
        projection: { selected: { score: 0.6 } },
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
  assert.equal(report.decision.verdict, 'mock_plumbing_only');
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
  writeJson(path.join(row.runDir, 'result.json'), { transcript: [], ledger: [] });
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
    assert.match(plan.metadata.phase6DecisionContractSha256, /^[0-9a-f]{64}$/u);
    assert.match(plan.metadata.phase6VerdictEvaluatorSha256, /^[0-9a-f]{64}$/u);

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
