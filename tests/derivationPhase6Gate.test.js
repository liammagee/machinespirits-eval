import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  analyzeGateArtifacts,
  assertPhase6CanaryCompatibility,
  assertPhase6ContinuationCompatibility,
  assertPhase6ConcurrencyPolicy,
  assertPhase6ForcePolicy,
  assertPhase6FrozenRuntime,
  assertPhase6PaidConfirmation,
  assertPhase6RealGateProtocolReady,
  assertPhase6RealRunGitState,
  auditPhase6TutorTranscript,
  balancedArmOrderSchedule,
  buildEvidencePlan,
  buildGatePlan,
  commitPhase6Row,
  inspectPhase6ResumeMatrix,
  inspectPhase6RowResumeState,
  installPhase6SignalHandlers,
  loadPriorCanaryReport,
  loadPriorProvisionalReport,
  phase6CanaryCompatibilityBlockers,
  phase6ModelRuntime,
  phase6ContinuationCompatibilityBlockers,
  phase6RunCloseoutDisposition,
  phase6RealGateProtocolBlockers,
  prepareEvidenceTransaction,
  requestPhase6Interruption,
  renderGateMarkdown,
  runGate,
} from '../scripts/run-derivation-phase6-gate.js';
import {
  appendRunEvent,
  createRunPlan,
  createRunSeal,
  hashFile,
  hashCanonicalJson,
  readRunEvents,
  verifyExperimentRun,
} from '../services/experimentRunArtifacts.js';
import { evaluatePhase6Verdict } from '../services/dramaticDerivation/phase6Verdict.js';

const CONTRACT_PATH = 'config/drama-derivation/phase6-field-planner-gate-v2.1.json';
const EVALUATOR_PATH = 'services/dramaticDerivation/phase6Verdict.js';
const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeSafeCompletedRow(row) {
  writeJson(path.join(row.runDir, 'diagnosis.json'), {
    label: row.label,
    worldPath: row.world,
    scriptPath: row.script,
    backend: {
      mode: row.mode,
      roles: Object.fromEntries(
        ['director', 'tutor', 'learner'].map((role) => [role, { provider: 'mock', model: 'mock' }]),
      ),
    },
    decay: row.decay,
    fieldReportContext: row.armKey === 'field_report_only',
    fieldPlanner: row.armKey.startsWith('field_planner'),
    fieldPlannerEnforce: row.armKey === 'field_planner_enforce',
    verdict: 'grounded_anagnorisis',
    turnsPlayed: 12,
    turnCap: 20,
    releaseAdherence: { onCue: 0, rows: [], deviations: [], missed: [], unscheduled: [] },
    eventsByType: { grounded_anagnorisis: 1 },
    fabricatedFacts: [],
  });
  writeJson(path.join(row.runDir, 'result.json'), { transcript: [], ledger: [] });
  writeJson(path.join(row.runDir, 'dialogue-report.json'), { summary: {} });
  fs.writeFileSync(path.join(row.runDir, 'transcript.md'), '# transcript\n');
  fs.writeFileSync(path.join(row.runDir, 'dialogue-report.md'), '# report\n');
  fs.writeFileSync(path.join(row.runDir, 'dynamic-field.svg'), '<svg></svg>\n');
  fs.mkdirSync(path.dirname(row.logFile), { recursive: true });
  fs.writeFileSync(row.logFile, 'row complete\n');
}

function rowResumeFixture({ withArtifacts = true, lifecycle = 'ordered' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-row-resume-'));
  const manifest = buildGatePlan({
    label: 'resume-unit',
    out: root,
    worlds: ['marrick'],
    arms: ['baseline'],
    seeds: ['1'],
    mode: 'mock',
  });
  const plan = buildEvidencePlan(manifest, {
    masterSeed: 1701,
    dryRun: false,
    concurrency: 1,
    gitFingerprint: {
      sha: 'f'.repeat(40),
      branch: 'test',
      dirty: false,
      fingerprintSha256: 'e'.repeat(64),
    },
  });
  fs.mkdirSync(manifest.gateDir, { recursive: true });
  createRunPlan(manifest.gateDir, plan);
  const row = manifest.rows[0];
  if (withArtifacts) writeSafeCompletedRow(row);
  if (lifecycle === 'ordered') {
    appendRunEvent(manifest.gateDir, { type: 'job_started', jobId: row.id });
    appendRunEvent(manifest.gateDir, { type: 'job_completed', jobId: row.id, exitCode: 0 });
  } else if (lifecycle === 'reversed') {
    appendRunEvent(manifest.gateDir, { type: 'job_completed', jobId: row.id, exitCode: 0 });
    appendRunEvent(manifest.gateDir, { type: 'job_started', jobId: row.id });
  }
  return { root, manifest, plan, row };
}

function fixedGitFingerprint() {
  return {
    sha: 'f'.repeat(40),
    branch: 'test',
    dirty: false,
    fingerprintSha256: 'e'.repeat(64),
  };
}

function validCanaryRows() {
  return contract.technicalCanary.arms.map((armKey) => {
    const planner = armKey.startsWith('field_planner');
    const reportOnly = armKey === 'field_report_only';
    return {
      id: `marrick-${armKey}-s0`,
      worldKey: 'marrick',
      armKey,
      seed: '0',
      ok: true,
      grounded: false,
      turnsPlayed: 12,
      turnCap: 24,
      decay: { events: 0, degradedTurnIntegral: 0 },
      fieldPlanner: {
        count: planner ? 12 : 0,
        candidateCountMismatches: 0,
        missingOutcomes: 0,
        missingSelectedScores: 0,
        nonLeakAuditFailures: 0,
      },
      fieldReportContext: { count: reportOnly ? 12 : 0, nonLeakAuditFailures: 0 },
      conductPolicy: {
        loggedTurns: planner ? 12 : 0,
        complianceChecked: planner ? 12 : 0,
        complianceFailed: planner ? 3 : 0,
        enforcementChanged: 0,
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
    };
  });
}

function compatibleCanary(rows = validCanaryRows()) {
  const manifest = buildGatePlan({ label: 'parent-canary', out: os.tmpdir(), mode: 'real', technicalCanary: true });
  const plan = buildEvidencePlan(manifest, {
    masterSeed: 1701,
    dryRun: false,
    concurrency: 1,
    gitFingerprint: fixedGitFingerprint(),
  });
  return {
    parentRunId: 'parent-canary',
    label: 'parent-canary',
    verdict: 'technical_canary_only',
    passed: true,
    claimStatus: 'excluded',
    seeds: [...contract.technicalCanary.seeds],
    verdictEvaluatorVersion: contract.verdictEvaluatorVersion,
    decisionContractSha256: hashFile(CONTRACT_PATH),
    verdictEvaluatorSha256: hashFile(EVALUATOR_PATH),
    report: 'exports/example/canary/phase6-gate-report.json',
    reportSha256: '1'.repeat(64),
    sealSha256: '2'.repeat(64),
    planSha256: '3'.repeat(64),
    inventorySha256: '4'.repeat(64),
    git: structuredClone(plan.provenance.git),
    requiredHashKinds: structuredClone(plan.requiredHashKinds),
    hashes: structuredClone(plan.hashes),
    models: structuredClone(plan.models),
    phase6ModelRuntime: structuredClone(plan.metadata.phase6ModelRuntime),
    phase6ModelRuntimeSha256: plan.metadata.phase6ModelRuntimeSha256,
    phase6CliFingerprints: structuredClone(plan.metadata.phase6CliFingerprints),
    phase6CliFingerprintsSha256: plan.metadata.phase6CliFingerprintsSha256,
    executionConcurrency: plan.metadata.executionConcurrency,
    rows,
  };
}

function compatiblePrior(rows = Array.from({ length: 60 }, () => ({}))) {
  const canary = compatibleCanary();
  const parentManifest = buildGatePlan({
    label: 'parent-k5',
    out: os.tmpdir(),
    profile: 'smoke',
    seeds: [...contract.seedBlocks[0]],
    mode: 'real',
    priorCanary: canary,
  });
  const parentPlan = buildEvidencePlan(parentManifest, {
    masterSeed: 1701,
    dryRun: false,
    concurrency: 1,
    gitFingerprint: fixedGitFingerprint(),
  });
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
    planSha256: 'c'.repeat(64),
    inventorySha256: 'd'.repeat(64),
    git: structuredClone(parentPlan.provenance.git),
    requiredHashKinds: structuredClone(parentPlan.requiredHashKinds),
    hashes: structuredClone(parentPlan.hashes),
    models: structuredClone(parentPlan.models),
    phase6ModelRuntime: structuredClone(parentPlan.metadata.phase6ModelRuntime),
    phase6ModelRuntimeSha256: parentPlan.metadata.phase6ModelRuntimeSha256,
    phase6CliFingerprints: structuredClone(parentPlan.metadata.phase6CliFingerprints),
    phase6CliFingerprintsSha256: parentPlan.metadata.phase6CliFingerprintsSha256,
    executionConcurrency: parentPlan.metadata.executionConcurrency,
    priorCanary: structuredClone(parentPlan.metadata.phase6CanaryParentProvenance),
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

function writeSealedCanary(
  root,
  { mutateReport = (report) => report, mutatePlan = (plan) => plan, seal = true, sealStatus = 'complete' } = {},
) {
  const manifest = buildGatePlan({
    label: path.basename(root),
    out: path.dirname(root),
    mode: 'real',
    technicalCanary: true,
  });
  let plan = buildEvidencePlan(manifest, {
    masterSeed: 1701,
    dryRun: false,
    concurrency: 1,
    gitFingerprint: fixedGitFingerprint(),
  });
  plan = mutatePlan(structuredClone(plan)) || plan;
  let report = {
    schema: 'machinespirits.derivation.phase6-gate.report.v1',
    protocolId: contract.protocolId,
    evidenceKind: 'technical_canary',
    verdictEvaluatorVersion: contract.verdictEvaluatorVersion,
    priorCanary: null,
    priorProvisional: null,
    label: manifest.label,
    mode: 'real',
    rowCount: 4,
    okRows: 4,
    rows: validCanaryRows(),
  };
  report.decision = evaluatePhase6Verdict(report, contract);
  report = mutateReport(structuredClone(report)) || report;
  createRunPlan(root, plan);
  writeJson(path.join(root, 'phase6-gate-report.json'), report);
  for (const role of plan.requiredObservedModelRoles) {
    appendRunEvent(root, {
      type: 'model_observed',
      role,
      requested: plan.models[role].requested,
      resolved: plan.models[role].resolved,
      observed: plan.models[role].resolved,
    });
  }
  appendRunEvent(root, { type: 'run_completed', status: sealStatus });
  if (seal) createRunSeal(root, { status: sealStatus });
  return path.join(root, 'phase6-gate-report.json');
}

function writeSealedK5Parent(
  root,
  { contractSha256 = hashFile(CONTRACT_PATH), mutatePlan = (plan) => plan, priorCanary = null } = {},
) {
  const canary =
    priorCanary ||
    loadPriorCanaryReport(writeSealedCanary(path.join(path.dirname(root), `${path.basename(root)}-canary`)));
  const rows = validK5EvidenceRows();
  const report = {
    schema: 'machinespirits.derivation.phase6-gate.report.v1',
    protocolId: contract.protocolId,
    evidenceKind: 'claim',
    verdictEvaluatorVersion: contract.verdictEvaluatorVersion,
    label: path.basename(root),
    mode: 'real',
    priorCanary: null,
    rowCount: rows.length,
    okRows: rows.length,
    rows,
  };
  report.decision = evaluatePhase6Verdict(report, contract);
  assert.equal(report.decision.verdict, 'provisional_promote');
  assert.equal(report.decision.winner, 'field_planner_advisory');

  const manifest = buildGatePlan({
    label: report.label,
    out: path.dirname(root),
    profile: 'smoke',
    seeds: [...contract.seedBlocks[0]],
    mode: 'real',
    priorCanary: canary,
  });
  let plan = buildEvidencePlan(manifest, {
    masterSeed: 1701,
    dryRun: false,
    concurrency: 1,
    gitFingerprint: fixedGitFingerprint(),
  });
  report.priorCanary = structuredClone(plan.metadata.phase6CanaryParentProvenance);
  report.decision = evaluatePhase6Verdict(report, contract);
  plan.metadata.phase6DecisionContractSha256 = contractSha256;
  plan = mutatePlan(structuredClone(plan)) || plan;
  createRunPlan(root, plan);
  writeJson(path.join(root, 'phase6-gate-report.json'), report);
  for (const role of plan.requiredObservedModelRoles) {
    appendRunEvent(root, {
      type: 'model_observed',
      role,
      requested: plan.models[role].requested,
      resolved: plan.models[role].resolved,
      observed: plan.models[role].resolved,
    });
  }
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

test('Phase 6 freezes a deterministic arm-order rotation balanced across worlds and seeds', () => {
  const worlds = ['marrick', 'hethel', 'marrick_resistant'];
  const seeds = ['1', '2', '3', '4', '5'];
  const arms = ['baseline', 'field_report_only', 'field_planner_advisory', 'field_planner_enforce'];
  const schedule = balancedArmOrderSchedule(worlds, seeds, arms);
  assert.deepEqual(schedule, balancedArmOrderSchedule(worlds, seeds, arms));
  for (let ordinal = 0; ordinal < arms.length; ordinal += 1) {
    const counts = Object.fromEntries(arms.map((arm) => [arm, 0]));
    for (const entry of schedule) counts[entry.arms[ordinal]] += 1;
    assert.ok(Math.max(...Object.values(counts)) - Math.min(...Object.values(counts)) <= 1);
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-balanced-order-'));
  try {
    const manifest = buildGatePlan({ label: 'balanced', out: root, worlds, arms, seeds, mode: 'real' });
    assert.deepEqual(manifest.armOrderSchedule, schedule);
    assert.deepEqual(
      manifest.rows.map((row) => row.id),
      schedule.flatMap((entry) => entry.arms.map((arm) => `${entry.worldKey}-${arm}-s${entry.seed}`)),
    );
    const tampered = structuredClone(manifest);
    [tampered.armOrderSchedule[0].arms[0], tampered.armOrderSchedule[0].arms[1]] = [
      tampered.armOrderSchedule[0].arms[1],
      tampered.armOrderSchedule[0].arms[0],
    ];
    assert.ok(phase6RealGateProtocolBlockers(tampered).some((reason) => reason.includes('balanced rotation')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
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
  const ungatedFirstBlock = buildGatePlan({
    label: 'ungated-first-block',
    out: root,
    profile: 'smoke',
    seeds: [...contract.seedBlocks[0]],
    mode: 'real',
  });
  assert.ok(
    phase6RealGateProtocolBlockers(ungatedFirstBlock).some((reason) =>
      reason.includes('passing, compatible v2.1 technical-canary parent'),
    ),
  );
  const malformedFirstBlock = structuredClone(ungatedFirstBlock);
  malformedFirstBlock.priorCanary = {};
  assert.ok(
    phase6RealGateProtocolBlockers(malformedFirstBlock).some((reason) =>
      reason.includes('passing, compatible v2.1 technical-canary parent'),
    ),
  );
  const realPlan = buildGatePlan({
    label: 'ready-real',
    out: root,
    profile: 'smoke',
    seeds: ['1', '2', '3', '4', '5'],
    decayRate: 0.08,
    mode: 'real',
    priorCanary: compatibleCanary(),
  });
  assert.deepEqual(phase6RealGateProtocolBlockers(realPlan), []);
  assert.doesNotThrow(() => assertPhase6RealGateProtocolReady(realPlan));
  const firstBlockEvidencePlan = buildEvidencePlan(realPlan, {
    masterSeed: 1701,
    dryRun: true,
    concurrency: 1,
    gitFingerprint: fixedGitFingerprint(),
  });
  assert.equal(firstBlockEvidencePlan.lineage.parentRunId, 'parent-canary');
  assert.deepEqual(phase6CanaryCompatibilityBlockers({ manifest: realPlan, plan: firstBlockEvidencePlan }), []);
  assert.doesNotThrow(() => assertPhase6CanaryCompatibility({ manifest: realPlan, plan: firstBlockEvidencePlan }));
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
  assert.deepEqual(
    phase6ContinuationCompatibilityBlockers({ manifest: gatedSecondBlock, plan: continuationEvidencePlan }),
    [],
  );
  assert.doesNotThrow(() =>
    assertPhase6ContinuationCompatibility({ manifest: gatedSecondBlock, plan: continuationEvidencePlan }),
  );

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

test('real Phase 6A requires explicit paid acknowledgement and serial concurrency', () => {
  assert.doesNotThrow(() => assertPhase6PaidConfirmation({ mode: 'mock', confirmed: false }));
  assert.doesNotThrow(() => assertPhase6PaidConfirmation({ mode: 'real', confirmed: true }));
  assert.throws(
    () => assertPhase6PaidConfirmation({ mode: 'real', confirmed: false }),
    /--confirm-paid-phase6a-v2\.1/u,
  );
  assert.doesNotThrow(() => assertPhase6ConcurrencyPolicy({ mode: 'real', concurrency: 1 }));
  assert.throws(() => assertPhase6ConcurrencyPolicy({ mode: 'real', concurrency: 2 }), /--concurrency 1/u);
  assert.throws(
    () =>
      execFileSync(process.execPath, ['scripts/run-derivation-phase6-gate.js', '--real', '--dry-run'], {
        cwd: path.resolve('.'),
        encoding: 'utf8',
        stdio: 'pipe',
      }),
    /--confirm-paid-phase6a-v2\.1/u,
  );
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          'scripts/run-derivation-phase6-gate.js',
          '--real',
          '--dry-run',
          '--confirm-paid-phase6a-v2.1',
          '--label',
          'missing-canary-parent',
        ],
        { cwd: path.resolve('.'), encoding: 'utf8', stdio: 'pipe' },
      ),
    /passing, compatible v2\.1 technical-canary parent/u,
  );
});

test('Phase 6 evidence plan freezes explicit role models, effort, timeouts, and concurrency', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-runtime-plan-'));
  try {
    const manifest = buildGatePlan({
      label: 'runtime-unit',
      out: root,
      mode: 'real',
      technicalCanary: true,
    });
    const plan = buildEvidencePlan(manifest, {
      masterSeed: 1701,
      dryRun: true,
      concurrency: 1,
      gitFingerprint: {
        sha: 'f'.repeat(40),
        branch: 'test',
        dirty: false,
        fingerprintSha256: 'e'.repeat(64),
      },
    });
    assert.equal(plan.metadata.executionConcurrency, 1);
    assert.equal(plan.metadata.phase6ModelRuntimeSha256.length, 64);
    assert.deepEqual(Object.keys(plan.metadata.phase6ModelRuntime).sort(), ['director', 'learner', 'tutor']);
    for (const role of ['director', 'tutor', 'learner']) {
      const runtime = plan.metadata.phase6ModelRuntime[role];
      assert.ok(runtime.requested_model_ref && !runtime.requested_model_ref.includes('(cli-default)'));
      assert.ok(runtime.resolved_model_ref && !runtime.resolved_model_ref.includes('(cli-default)'));
      assert.equal(Object.hasOwn(runtime, 'effort'), true);
      assert.equal(Object.hasOwn(runtime, 'timeout_ms'), true);
      assert.equal(plan.models[role].requested, runtime.requested_model_ref);
      assert.equal(plan.models[role].resolved, runtime.resolved_model_ref);
    }
    assert.deepEqual(plan.metadata.phase6ModelRuntime, phase6ModelRuntime('real'));
    assert.doesNotThrow(() => assertPhase6FrozenRuntime({ manifest, frozenPlan: plan, concurrency: 1 }));
    const drifted = structuredClone(plan);
    drifted.metadata.phase6ModelRuntime.tutor.effort = 'drifted';
    assert.throws(
      () => assertPhase6FrozenRuntime({ manifest, frozenPlan: drifted, concurrency: 1 }),
      /different models, effort, timeouts, CLI executable\/version, or concurrency/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Phase 6 durable row completion skips only exact hash- and semantic-verified evidence', () => {
  const fixture = rowResumeFixture();
  try {
    const committed = commitPhase6Row(fixture.row, {
      gateDir: fixture.manifest.gateDir,
      plan: fixture.plan,
    });
    assert.match(committed.completionSha256, /^[0-9a-f]{64}$/u);
    assert.equal(committed.completion.artifacts.length >= 7, true);
    const state = inspectPhase6RowResumeState(fixture.row, {
      gateDir: fixture.manifest.gateDir,
      plan: fixture.plan,
    });
    assert.equal(state.disposition, 'skip_verified');
    assert.equal(state.completionSha256, committed.completionSha256);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Phase 6 durable completion rejects artifacts from the wrong frozen row semantics', () => {
  const fixture = rowResumeFixture();
  try {
    const diagnosisPath = path.join(fixture.row.runDir, 'diagnosis.json');
    const diagnosis = JSON.parse(fs.readFileSync(diagnosisPath, 'utf8'));
    diagnosis.label = 'different-row';
    writeJson(diagnosisPath, diagnosis);
    assert.throws(
      () => commitPhase6Row(fixture.row, { gateDir: fixture.manifest.gateDir, plan: fixture.plan }),
      /do not match the frozen row\/model semantics.*superseding label/u,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Phase 6 row resume rejects artifact tampering after a durable completion event', () => {
  const fixture = rowResumeFixture();
  try {
    commitPhase6Row(fixture.row, { gateDir: fixture.manifest.gateDir, plan: fixture.plan });
    fs.appendFileSync(path.join(fixture.row.runDir, 'result.json'), ' ');
    assert.throws(
      () =>
        inspectPhase6RowResumeState(fixture.row, {
          gateDir: fixture.manifest.gateDir,
          plan: fixture.plan,
        }),
      /artifacts, provenance, or semantics changed.*superseding label/u,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Phase 6 row resume rejects a tampered durable event chain', () => {
  const fixture = rowResumeFixture();
  try {
    commitPhase6Row(fixture.row, { gateDir: fixture.manifest.gateDir, plan: fixture.plan });
    const eventsFile = path.join(fixture.manifest.gateDir, 'run-events.jsonl');
    const events = fs
      .readFileSync(eventsFile, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    events.at(-1).completion.semantic.ok = false;
    fs.writeFileSync(eventsFile, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
    assert.throws(
      () =>
        inspectPhase6RowResumeState(fixture.row, {
          gateDir: fixture.manifest.gateDir,
          plan: fixture.plan,
        }),
      /run-event chain is invalid or tampered.*superseding label/u,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Phase 6 row resume rejects partial or complete artifacts without a durable completion event', () => {
  const partial = rowResumeFixture({ withArtifacts: false, lifecycle: 'none' });
  const present = rowResumeFixture({ withArtifacts: true, lifecycle: 'ordered' });
  try {
    fs.mkdirSync(partial.row.runDir, { recursive: true });
    fs.writeFileSync(path.join(partial.row.runDir, 'result.json'), '{}\n');
    assert.throws(
      () =>
        inspectPhase6RowResumeState(partial.row, {
          gateDir: partial.manifest.gateDir,
          plan: partial.plan,
        }),
      /partial or present without a durable completion event.*superseding label/u,
    );
    assert.throws(
      () =>
        inspectPhase6RowResumeState(present.row, {
          gateDir: present.manifest.gateDir,
          plan: present.plan,
        }),
      /partial or present without a durable completion event.*superseding label/u,
    );
  } finally {
    fs.rmSync(partial.root, { recursive: true, force: true });
    fs.rmSync(present.root, { recursive: true, force: true });
  }
});

test('Phase 6 row resume runs only a never-started row with no artifacts', () => {
  const fixture = rowResumeFixture({ withArtifacts: false, lifecycle: 'none' });
  try {
    assert.deepEqual(
      inspectPhase6RowResumeState(fixture.row, {
        gateDir: fixture.manifest.gateDir,
        plan: fixture.plan,
      }),
      { disposition: 'run_missing', rowId: fixture.row.id },
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('Phase 6 row resume rejects duplicate or reordered completion lifecycles', () => {
  const duplicate = rowResumeFixture();
  const reordered = rowResumeFixture({ lifecycle: 'reversed' });
  try {
    const committed = commitPhase6Row(duplicate.row, {
      gateDir: duplicate.manifest.gateDir,
      plan: duplicate.plan,
    });
    appendRunEvent(duplicate.manifest.gateDir, {
      type: 'phase6_row_committed',
      jobId: duplicate.row.id,
      completion: committed.completion,
      completionSha256: committed.completionSha256,
    });
    assert.throws(
      () =>
        inspectPhase6RowResumeState(duplicate.row, {
          gateDir: duplicate.manifest.gateDir,
          plan: duplicate.plan,
        }),
      /duplicate completion events/u,
    );

    commitPhase6Row(reordered.row, { gateDir: reordered.manifest.gateDir, plan: reordered.plan });
    assert.throws(
      () =>
        inspectPhase6RowResumeState(reordered.row, {
          gateDir: reordered.manifest.gateDir,
          plan: reordered.plan,
        }),
      /invalid execution\/completion lifecycle/u,
    );
  } finally {
    fs.rmSync(duplicate.root, { recursive: true, force: true });
    fs.rmSync(reordered.root, { recursive: true, force: true });
  }
});

test('Phase 6 resume accepts only an exact committed prefix followed by a never-started tail', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-prefix-resume-'));
  try {
    const manifest = buildGatePlan({
      label: 'prefix',
      out: root,
      worlds: ['marrick'],
      arms: ['baseline', 'field_planner_advisory'],
      seeds: ['1'],
      mode: 'mock',
    });
    const plan = buildEvidencePlan(manifest, {
      masterSeed: 1701,
      dryRun: false,
      concurrency: 1,
      gitFingerprint: {
        sha: 'f'.repeat(40),
        branch: 'test',
        dirty: false,
        fingerprintSha256: 'e'.repeat(64),
      },
    });
    fs.mkdirSync(manifest.gateDir, { recursive: true });
    createRunPlan(manifest.gateDir, plan);
    const [first, second] = manifest.rows;
    writeSafeCompletedRow(first);
    appendRunEvent(manifest.gateDir, { type: 'job_started', jobId: first.id });
    appendRunEvent(manifest.gateDir, { type: 'job_completed', jobId: first.id, exitCode: 0 });
    commitPhase6Row(first, { gateDir: manifest.gateDir, plan });
    const states = inspectPhase6ResumeMatrix(manifest, { plan });
    assert.equal(states.get(first.id).disposition, 'skip_verified');
    assert.equal(states.get(second.id).disposition, 'run_missing');

    const nonPrefixRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-non-prefix-resume-'));
    try {
      const nonPrefix = buildGatePlan({
        label: 'non-prefix',
        out: nonPrefixRoot,
        worlds: ['marrick'],
        arms: ['baseline', 'field_planner_advisory'],
        seeds: ['1'],
        mode: 'mock',
      });
      const nonPrefixPlan = buildEvidencePlan(nonPrefix, {
        masterSeed: 1701,
        dryRun: false,
        concurrency: 1,
        gitFingerprint: plan.provenance.git,
      });
      fs.mkdirSync(nonPrefix.gateDir, { recursive: true });
      createRunPlan(nonPrefix.gateDir, nonPrefixPlan);
      const late = nonPrefix.rows[1];
      writeSafeCompletedRow(late);
      appendRunEvent(nonPrefix.gateDir, { type: 'job_started', jobId: late.id });
      appendRunEvent(nonPrefix.gateDir, { type: 'job_completed', jobId: late.id, exitCode: 0 });
      commitPhase6Row(late, { gateDir: nonPrefix.gateDir, plan: nonPrefixPlan });
      assert.throws(
        () => inspectPhase6ResumeMatrix(nonPrefix, { plan: nonPrefixPlan }),
        /not an exact prefix.*superseding label/u,
      );
    } finally {
      fs.rmSync(nonPrefixRoot, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Phase 6 transaction resume rejects complete-plan or compatibility-manifest tampering', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-exact-plan-resume-'));
  const gitFingerprint = {
    sha: 'f'.repeat(40),
    branch: 'test',
    dirty: false,
    fingerprintSha256: 'e'.repeat(64),
  };
  try {
    const manifest = buildGatePlan({
      label: 'exact-plan',
      out: root,
      worlds: ['marrick'],
      arms: ['baseline'],
      seeds: ['1'],
      mode: 'mock',
    });
    const frozen = prepareEvidenceTransaction(manifest, {
      masterSeed: 1701,
      dryRun: false,
      gitFingerprint,
      concurrency: 1,
    });
    const resumedManifest = buildGatePlan({
      label: 'exact-plan',
      out: root,
      worlds: ['marrick'],
      arms: ['baseline'],
      seeds: ['1'],
      mode: 'mock',
    });
    assert.equal(
      prepareEvidenceTransaction(resumedManifest, {
        masterSeed: 1701,
        dryRun: false,
        gitFingerprint,
        concurrency: 1,
      }).runId,
      frozen.runId,
    );

    const planPath = path.join(manifest.gateDir, 'run-plan.json');
    const tampered = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    tampered.jobs[0].command.push('--tampered');
    writeJson(planPath, tampered);
    assert.throws(
      () =>
        prepareEvidenceTransaction(resumedManifest, {
          masterSeed: 1701,
          dryRun: false,
          gitFingerprint,
          concurrency: 1,
        }),
      /complete frozen run plan no longer matches/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  const manifestRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-manifest-resume-'));
  try {
    const manifest = buildGatePlan({
      label: 'manifest',
      out: manifestRoot,
      worlds: ['marrick'],
      arms: ['baseline'],
      seeds: ['1'],
      mode: 'mock',
    });
    prepareEvidenceTransaction(manifest, {
      masterSeed: 1701,
      dryRun: false,
      gitFingerprint,
      concurrency: 1,
    });
    const manifestPath = path.join(manifest.gateDir, 'manifest.json');
    const tampered = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    tampered.rows[0].armLabel = 'tampered';
    writeJson(manifestPath, tampered);
    assert.throws(
      () =>
        prepareEvidenceTransaction(
          buildGatePlan({
            label: 'manifest',
            out: manifestRoot,
            worlds: ['marrick'],
            arms: ['baseline'],
            seeds: ['1'],
            mode: 'mock',
          }),
          { masterSeed: 1701, dryRun: false, gitFingerprint, concurrency: 1 },
        ),
      /manifest\.json differs/u,
    );
  } finally {
    fs.rmSync(manifestRoot, { recursive: true, force: true });
  }
});

test('Phase 6A v2.1 loads only a sealed passing canary with complete role provenance', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-sealed-canary-'));
  try {
    const compatiblePath = writeSealedCanary(path.join(root, 'compatible-canary'));
    const prior = loadPriorCanaryReport(compatiblePath);
    assert.equal(prior.parentRunId, 'compatible-canary');
    assert.equal(prior.verdict, 'technical_canary_only');
    assert.equal(prior.passed, true);
    assert.equal(prior.rows.length, 4);
    assert.deepEqual(Object.keys(prior.models).sort(), ['director', 'learner', 'tutor']);

    const failedPath = writeSealedCanary(path.join(root, 'failed-canary'), {
      mutateReport: (report) => {
        report.rows[0].safety.hardFailures = 1;
        report.decision = evaluatePhase6Verdict(report, contract);
        return report;
      },
    });
    assert.throws(() => loadPriorCanaryReport(failedPath), /sealed, passing, hash-compatible v2\.1/u);

    const unsealedPath = writeSealedCanary(path.join(root, 'unsealed-canary'), { seal: false });
    assert.throws(() => loadPriorCanaryReport(unsealedPath), /Experiment run verification failed/u);

    const missingRolePath = writeSealedCanary(path.join(root, 'missing-role-canary'), {
      mutatePlan: (plan) => {
        plan.requiredObservedModelRoles = [];
        return plan;
      },
    });
    assert.throws(() => loadPriorCanaryReport(missingRolePath), /sealed, passing, hash-compatible v2\.1/u);

    const legacyRoot = path.join(root, 'legacy-unsealed');
    writeJson(path.join(legacyRoot, 'phase6-gate-report.json'), {
      mode: 'real',
      rowCount: 60,
      okRows: 60,
    });
    assert.throws(
      () => loadPriorCanaryReport(path.join(legacyRoot, 'phase6-gate-report.json')),
      /Experiment run verification failed/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Phase 6A v2.1 canary lineage rejects Git, invariant source, model, runtime, CLI, and concurrency drift', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-canary-continuity-'));
  try {
    const prior = loadPriorCanaryReport(writeSealedCanary(path.join(root, 'parent-canary')));
    const manifest = buildGatePlan({
      label: 'k5',
      out: root,
      profile: 'smoke',
      seeds: [...contract.seedBlocks[0]],
      mode: 'real',
      priorCanary: prior,
    });
    const plan = buildEvidencePlan(manifest, {
      masterSeed: 1701,
      dryRun: false,
      concurrency: 1,
      gitFingerprint: structuredClone(prior.git),
    });
    assert.deepEqual(phase6CanaryCompatibilityBlockers({ manifest, plan }), []);

    const mutations = [
      ['Git SHA', (copy) => (copy.priorCanary.git.sha = '0'.repeat(40)), /same clean Git SHA/u],
      ['source hash', (copy) => (copy.priorCanary.hashes.runner = '0'.repeat(64)), /source hashes/u],
      ['model', (copy) => (copy.priorCanary.models.tutor.resolved = 'openrouter/drifted'), /model references/u],
      ['runtime', (copy) => (copy.priorCanary.phase6ModelRuntime.tutor.timeout_ms = 1), /runtime policies/u],
      [
        'CLI',
        (copy) => {
          copy.priorCanary.phase6CliFingerprints = {
            codex: { command: 'codex', executable_realpath: '/tmp/drifted', version: 'drifted' },
          };
          copy.priorCanary.phase6CliFingerprintsSha256 = hashCanonicalJson(copy.priorCanary.phase6CliFingerprints);
        },
        /CLI executable realpaths\/versions/u,
      ],
      ['concurrency', (copy) => (copy.priorCanary.executionConcurrency = 2), /both be serial/u],
    ];
    for (const [label, mutate, pattern] of mutations) {
      const changed = structuredClone(manifest);
      mutate(changed);
      assert.throws(() => assertPhase6CanaryCompatibility({ manifest: changed, plan }), pattern, label);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Phase 6 continuation loads only a canary-bound sealed parent with current contract and evaluator hashes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-sealed-parent-'));
  try {
    const compatiblePath = writeSealedK5Parent(path.join(root, 'compatible-parent'));
    const prior = loadPriorProvisionalReport(compatiblePath);
    assert.equal(prior.parentRunId, 'compatible-parent');
    assert.equal(prior.winner, 'field_planner_advisory');
    assert.equal(prior.rows.length, 60);
    assert.equal(prior.decisionContractSha256, hashFile(CONTRACT_PATH));
    assert.equal(prior.verdictEvaluatorSha256, hashFile(EVALUATOR_PATH));
    assert.equal(prior.git.sha, 'f'.repeat(40));
    assert.equal(prior.executionConcurrency, 1);
    assert.deepEqual(Object.keys(prior.models).sort(), ['director', 'learner', 'tutor']);
    assert.deepEqual(prior.requiredHashKinds, [
      'analyzer',
      'config',
      'policy',
      'profile',
      'prompt',
      'runner',
      'script',
      'world',
    ]);
    assert.equal(prior.phase6ModelRuntimeSha256, hashCanonicalJson(prior.phase6ModelRuntime));
    assert.equal(prior.phase6CliFingerprintsSha256, hashCanonicalJson(prior.phase6CliFingerprints));

    const stalePath = writeSealedK5Parent(path.join(root, 'stale-parent'), {
      contractSha256: '0'.repeat(64),
    });
    assert.throws(() => loadPriorProvisionalReport(stalePath), /hash-compatible/u);

    const unboundPath = writeSealedK5Parent(path.join(root, 'unbound-parent'), {
      mutatePlan: (plan) => {
        plan.lineage.parentRunId = null;
        plan.metadata.phase6CanaryParentProvenance = null;
        return plan;
      },
    });
    assert.throws(() => loadPriorProvisionalReport(unboundPath), /hash-compatible/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Phase 6 continuation rejects Git, source, model, runtime, and CLI drift from sealed k=5', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-parent-continuity-'));
  try {
    const parentPath = writeSealedK5Parent(path.join(root, 'parent'));
    const prior = loadPriorProvisionalReport(parentPath);
    const manifest = buildGatePlan({
      label: 'continuation',
      out: root,
      profile: 'smoke',
      seeds: [...contract.seedBlocks[1]],
      mode: 'real',
      priorProvisional: prior,
    });
    const plan = buildEvidencePlan(manifest, {
      masterSeed: 1701,
      dryRun: false,
      concurrency: 1,
      gitFingerprint: structuredClone(prior.git),
    });
    assert.deepEqual(phase6ContinuationCompatibilityBlockers({ manifest, plan }), []);

    const mutations = [
      ['Git SHA', (copy) => (copy.priorProvisional.git.sha = '0'.repeat(40)), /same clean Git SHA/u],
      ['source hash', (copy) => (copy.priorProvisional.hashes.runner = '0'.repeat(64)), /hashes must match/u],
      ['model', (copy) => (copy.priorProvisional.models.tutor.resolved = 'openrouter/drifted'), /model references/u],
      ['runtime', (copy) => (copy.priorProvisional.phase6ModelRuntime.tutor.timeout_ms = 1), /runtime policies/u],
      [
        'CLI',
        (copy) => {
          copy.priorProvisional.phase6CliFingerprints = {
            codex: { command: 'codex', executable_realpath: '/tmp/drifted', version: 'drifted' },
          };
          copy.priorProvisional.phase6CliFingerprintsSha256 = hashCanonicalJson(
            copy.priorProvisional.phase6CliFingerprints,
          );
        },
        /CLI executable realpaths\/versions/u,
      ],
    ];
    for (const [label, mutate, pattern] of mutations) {
      const changed = structuredClone(manifest);
      mutate(changed);
      assert.throws(() => assertPhase6ContinuationCompatibility({ manifest: changed, plan }), pattern, label);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Phase 6 incomplete real rows are same-label-forbidden while mock plumbing may resume', () => {
  assert.equal(phase6RunCloseoutDisposition({ okRows: 3, rowCount: 4 }), 'pause_unsealed');
  assert.equal(
    phase6RunCloseoutDisposition({ okRows: 3, rowCount: 4 }, { mode: 'real' }),
    'seal_indeterminate_same_label_forbidden',
  );
  assert.equal(phase6RunCloseoutDisposition({ okRows: 4, rowCount: 4 }), 'seal_complete');
  assert.equal(phase6RunCloseoutDisposition({ okRows: 0, rowCount: 0 }), 'pause_unsealed');
});

test('Phase 6 real execution fails fast, leaves the tail untouched, and seals the label indeterminate', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-fail-fast-'));
  try {
    const manifest = buildGatePlan({
      label: 'fail-fast',
      out: root,
      profile: 'smoke',
      seeds: [...contract.seedBlocks[0]],
      mode: 'real',
      priorCanary: compatibleCanary(),
    });
    const plan = buildEvidencePlan(manifest, {
      masterSeed: 1701,
      dryRun: false,
      concurrency: 1,
      gitFingerprint: {
        sha: 'f'.repeat(40),
        branch: 'test',
        dirty: false,
        fingerprintSha256: 'e'.repeat(64),
      },
    });
    fs.mkdirSync(manifest.gateDir, { recursive: true });
    createRunPlan(manifest.gateDir, plan);
    appendRunEvent(manifest.gateDir, { type: 'run_planned', mode: 'real', dryRun: false });
    const started = [];
    await assert.rejects(
      () =>
        runGate(manifest, {
          plan,
          concurrency: 1,
          rowRunner: async (row) => {
            started.push(row.id);
            return 17;
          },
          liveGitGuard: () => {},
        }),
      /sealed indeterminate_same_label_forbidden.*superseding label/u,
    );
    assert.deepEqual(started, [manifest.rows[0].id]);
    const events = readRunEvents(manifest.gateDir);
    assert.equal(events.filter((event) => event.type === 'job_started').length, 1);
    assert.equal(events.filter((event) => event.type === 'job_completed').length, 1);
    assert.equal(events.at(-1).type, 'run_stopped');
    const seal = JSON.parse(fs.readFileSync(path.join(manifest.gateDir, 'run-seal.json'), 'utf8'));
    assert.equal(seal.status, 'indeterminate_same_label_forbidden');
    assert.equal(seal.metadata.sameLabelResumeAllowed, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Phase 6 interruption path seals the active label and never starts the tail', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase6-interrupt-'));
  const removeHandlers = installPhase6SignalHandlers();
  try {
    const manifest = buildGatePlan({
      label: 'interrupt',
      out: root,
      profile: 'smoke',
      seeds: [...contract.seedBlocks[0]],
      mode: 'real',
      priorCanary: compatibleCanary(),
    });
    const plan = buildEvidencePlan(manifest, {
      masterSeed: 1701,
      dryRun: false,
      concurrency: 1,
      gitFingerprint: {
        sha: 'f'.repeat(40),
        branch: 'test',
        dirty: false,
        fingerprintSha256: 'e'.repeat(64),
      },
    });
    fs.mkdirSync(manifest.gateDir, { recursive: true });
    createRunPlan(manifest.gateDir, plan);
    appendRunEvent(manifest.gateDir, { type: 'run_planned', mode: 'real', dryRun: false });
    let calls = 0;
    await assert.rejects(
      () =>
        runGate(manifest, {
          plan,
          concurrency: 1,
          rowRunner: async () => {
            calls += 1;
            requestPhase6Interruption('SIGTERM');
            return 143;
          },
          liveGitGuard: () => {},
        }),
      /interrupted by SIGTERM.*same_label_forbidden/u,
    );
    assert.equal(calls, 1);
    const seal = JSON.parse(fs.readFileSync(path.join(manifest.gateDir, 'run-seal.json'), 'utf8'));
    assert.equal(seal.status, 'indeterminate_same_label_forbidden');
    assert.equal(seal.metadata.signal, 'SIGTERM');
  } finally {
    removeHandlers();
    fs.rmSync(root, { recursive: true, force: true });
  }
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
