#!/usr/bin/env node
/**
 * PLAN_4_0 Phase 6 gate runner.
 *
 * This is a frozen-manifest wrapper around run-derivation-loop.js for the
 * field-planner promotion gate. It writes the row manifest before model calls,
 * runs/resumes rows idempotently, and aggregates proof, safety, and
 * field-planner process metrics from the generated artifacts.
 */

import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendRunEvent,
  assertExperimentRun,
  buildExperimentRunPlan,
  captureGitFingerprint,
  createRunPlan,
  createRunSeal,
  hashCanonicalJson,
  hashFile,
  readRunEvents,
  validateExperimentRunPlan,
} from '../services/experimentRunArtifacts.js';
import { resolveTarget } from '../services/dramaticDerivation/llmClient.js';
import { evaluatePhase6Verdict } from '../services/dramaticDerivation/phase6Verdict.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const LOOP_SCRIPT = path.join(ROOT, 'scripts', 'run-derivation-loop.js');
const PHASE6_VERDICT_EVALUATOR = path.join(ROOT, 'services', 'dramaticDerivation', 'phase6Verdict.js');
const PHASE6_DECISION_RULES = path.join(ROOT, 'PLAN_4_0', 'PHASE_6_EVIDENCE_GATE_PLAN.md');
const PHASE6_CONTRACT_PATH = path.join(ROOT, 'config', 'drama-derivation', 'phase6-field-planner-gate-v2.1.json');
const PHASE6_CONTRACT = JSON.parse(fs.readFileSync(PHASE6_CONTRACT_PATH, 'utf8'));

const WORLD_REGISTRY = Object.freeze({
  marrick: Object.freeze({
    key: 'marrick',
    world: 'config/drama-derivation/world-005-marrick.yaml',
    script: 'config/drama-derivation/tutor-scripts/marrick-v001.md',
  }),
  hethel: Object.freeze({
    key: 'hethel',
    world: 'config/drama-derivation/world-006-hethel.yaml',
    script: 'config/drama-derivation/tutor-scripts/hethel-v001.md',
  }),
  hethel_resistant: Object.freeze({
    key: 'hethel_resistant',
    world: 'config/drama-derivation/world-010-hethel-resistant.yaml',
    script: 'config/drama-derivation/tutor-scripts/hethel-v001.md',
  }),
  marrick_resistant: Object.freeze({
    key: 'marrick_resistant',
    world: 'config/drama-derivation/world-019-marrick-resistant.yaml',
    script: 'config/drama-derivation/tutor-scripts/marrick-v001.md',
  }),
  withercombe: Object.freeze({
    key: 'withercombe',
    world: 'config/drama-derivation/world-004-withercombe.yaml',
    script: 'config/drama-derivation/tutor-scripts/withercombe-v001.md',
  }),
  ravensmark: Object.freeze({
    key: 'ravensmark',
    world: 'config/drama-derivation/world-009-ravensmark.yaml',
    script: 'config/drama-derivation/tutor-scripts/ravensmark-v001.md',
  }),
});

const PROFILES = Object.freeze({
  // PHASE_6_EVIDENCE_GATE_PLAN.md freezes the smoke coverage as world-005,
  // world-006, and resistant world-019. Keep this list aligned before any
  // calls; adding a world after seeing results would invalidate the gate.
  smoke: ['marrick', 'hethel', 'marrick_resistant'],
  full: ['marrick', 'hethel', 'hethel_resistant', 'marrick_resistant', 'withercombe', 'ravensmark'],
});

const ARM_REGISTRY = Object.freeze({
  baseline: Object.freeze({
    key: 'baseline',
    label: PHASE6_CONTRACT.baselineLabel,
    flags: Object.freeze({}),
  }),
  field_report_only: Object.freeze({
    key: 'field_report_only',
    label: 'field_report_only',
    // Instrumentation placebo: the coupled-field summary enters the tutor
    // context with no planner authority. Must NOT be flag-identical to
    // baseline, or decision rule 2 (improvement not reproduced by
    // field_report_only) passes vacuously.
    flags: Object.freeze({ 'field-report-context': true }),
  }),
  field_planner_advisory: Object.freeze({
    key: 'field_planner_advisory',
    label: 'field_planner_advisory',
    flags: Object.freeze({ 'field-planner': true }),
  }),
  field_planner_enforce: Object.freeze({
    key: 'field_planner_enforce',
    label: 'field_planner_enforce',
    flags: Object.freeze({ 'field-planner-enforce': true }),
  }),
});

const DEFAULT_ARMS = ['baseline', 'field_report_only', 'field_planner_advisory', 'field_planner_enforce'];
const DEFAULT_BASE_FLAGS = Object.freeze({ ...PHASE6_CONTRACT.baseFlags });
const PHASE6_ROW_COMPLETION_SCHEMA = 'machinespirits.derivation.phase6a-row-completion.v2';
const PHASE6_REAL_CONCURRENCY = 1;
const PHASE6_DEFAULT_CLI_TIMEOUT_MS = 360_000;
const PHASE6_DEFAULT_CODEX_EFFORT = 'medium';
const PHASE6_REQUIRED_HASH_KINDS = Object.freeze([
  'runner',
  'analyzer',
  'policy',
  'profile',
  'prompt',
  'script',
  'world',
  'config',
]);
const PHASE6_CLI_PROVIDERS = Object.freeze({ codex: 'codex', claude: 'claude' });
const PHASE6_INDETERMINATE_STATUS = 'indeterminate_same_label_forbidden';
const PHASE6_CHILD_KILL_GRACE_MS = 5_000;

const activePhase6Children = new Map();
let phase6InterruptSignal = null;

function arg(argv, name, fallback = null) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
}

function has(argv, name) {
  return argv.includes(`--${name}`);
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/T/, '-').replace(/\..+$/, '');
}

function resolveFromRoot(file) {
  return path.isAbsolute(file) ? file : path.resolve(ROOT, file);
}

function rel(file) {
  return path.relative(ROOT, file) || '.';
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function safeReadJson(file) {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function phase6EvidenceRow(row = {}) {
  return {
    id: row.id,
    worldKey: row.worldKey,
    armKey: row.armKey,
    seed: String(row.seed),
    ok: row.ok === true,
    grounded: row.grounded === true,
    turnsPlayed: row.turnsPlayed,
    turnCap: row.turnCap,
    decay: structuredClone(row.decay),
    fieldPlanner: structuredClone(row.fieldPlanner),
    fieldReportContext: structuredClone(row.fieldReportContext),
    conductPolicy: structuredClone(row.conductPolicy),
    transcriptLeakAudit: structuredClone(row.transcriptLeakAudit),
    safety: structuredClone(row.safety),
  };
}

function priorProvisionalMetadata(prior = null) {
  if (!prior) return null;
  const { rows, ...metadata } = prior;
  if (!Array.isArray(rows)) return structuredClone(metadata);
  return {
    ...structuredClone(metadata),
    rowCount: rows.length,
    rowsSha256: hashCanonicalJson(rows),
  };
}

function priorCanaryMetadata(prior = null) {
  return priorProvisionalMetadata(prior);
}

function phase6ParentPlanProvenanceBlockers(plan = {}) {
  const blockers = [];
  const runtime = plan.metadata?.phase6ModelRuntime;
  const cliFingerprints = plan.metadata?.phase6CliFingerprints;
  if (plan.provenance?.git?.dirty !== false || !String(plan.provenance?.git?.sha || '').trim()) {
    blockers.push('parent Git provenance must name a clean committed SHA');
  }
  if (hashCanonicalJson(plan.requiredHashKinds) !== hashCanonicalJson([...PHASE6_REQUIRED_HASH_KINDS].sort())) {
    blockers.push('parent required hash kinds differ from the Phase 6A source contract');
  }
  if (
    PHASE6_REQUIRED_HASH_KINDS.some((kind) => !/^[0-9a-f]{64}$/u.test(String(plan.hashes?.[kind] || '')))
  ) {
    blockers.push('parent source hash set is incomplete');
  }
  if (
    !runtime ||
    plan.metadata?.phase6ModelRuntimeSha256 !== hashCanonicalJson(runtime) ||
    hashCanonicalJson(plan.models) !== hashCanonicalJson(evidenceModels('real', runtime))
  ) {
    blockers.push('parent frozen role models/runtime are internally inconsistent');
  }
  if (
    !cliFingerprints ||
    plan.metadata?.phase6CliFingerprintsSha256 !== hashCanonicalJson(cliFingerprints)
  ) {
    blockers.push('parent CLI executable/version fingerprints are internally inconsistent');
  }
  if (Number(plan.metadata?.executionConcurrency) !== PHASE6_REAL_CONCURRENCY) {
    blockers.push('parent paid execution was not frozen at concurrency 1');
  }
  return blockers;
}

function phase6CanarySnapshotBlockers(prior = null) {
  const blockers = [];
  const expectedRows =
    PHASE6_CONTRACT.technicalCanary.worlds.length *
    PHASE6_CONTRACT.technicalCanary.arms.length *
    PHASE6_CONTRACT.technicalCanary.seeds.length;
  const rowCount = Array.isArray(prior?.rows) ? prior.rows.length : prior?.rowCount;
  const rowsSha256 = Array.isArray(prior?.rows) ? hashCanonicalJson(prior.rows) : prior?.rowsSha256;
  if (
    !prior ||
    prior.verdict !== 'technical_canary_only' ||
    prior.passed !== true ||
    !Array.isArray(prior.seeds) ||
    hashCanonicalJson(prior.seeds) !== hashCanonicalJson(PHASE6_CONTRACT.technicalCanary.seeds) ||
    prior.verdictEvaluatorVersion !== PHASE6_CONTRACT.verdictEvaluatorVersion ||
    prior.decisionContractSha256 !== hashFile(PHASE6_CONTRACT_PATH) ||
    prior.verdictEvaluatorSha256 !== hashFile(PHASE6_VERDICT_EVALUATOR)
  ) {
    blockers.push('technical-canary verdict, seed, contract, or evaluator provenance is incompatible');
  }
  for (const field of ['reportSha256', 'sealSha256', 'planSha256', 'inventorySha256']) {
    if (!/^[0-9a-f]{64}$/u.test(String(prior?.[field] || ''))) blockers.push(`technical-canary ${field} is missing`);
  }
  if (!String(prior?.parentRunId || '').trim()) blockers.push('technical-canary parent run id is missing');
  if (rowCount !== expectedRows || !/^[0-9a-f]{64}$/u.test(String(rowsSha256 || ''))) {
    blockers.push(`technical-canary row snapshot must bind exactly ${expectedRows} rows`);
  }
  if (prior?.git?.dirty !== false || !String(prior?.git?.sha || '').trim()) {
    blockers.push('technical-canary Git provenance must name a clean committed SHA');
  }
  if (
    !prior?.requiredHashKinds ||
    hashCanonicalJson(prior.requiredHashKinds) !== hashCanonicalJson([...PHASE6_REQUIRED_HASH_KINDS].sort())
  ) {
    blockers.push('technical-canary required source hash kinds are incompatible');
  }
  if (PHASE6_REQUIRED_HASH_KINDS.some((kind) => !/^[0-9a-f]{64}$/u.test(String(prior?.hashes?.[kind] || '')))) {
    blockers.push('technical-canary source hash set is incomplete');
  }
  if (hashCanonicalJson(Object.keys(prior?.models || {}).sort()) !== hashCanonicalJson(['director', 'learner', 'tutor'])) {
    blockers.push('technical-canary frozen model roles are incomplete');
  }
  if (
    !prior?.phase6ModelRuntime ||
    prior.phase6ModelRuntimeSha256 !== hashCanonicalJson(prior.phase6ModelRuntime)
  ) {
    blockers.push('technical-canary role runtime hash is inconsistent');
  }
  if (
    !prior?.phase6CliFingerprints ||
    prior.phase6CliFingerprintsSha256 !== hashCanonicalJson(prior.phase6CliFingerprints)
  ) {
    blockers.push('technical-canary CLI fingerprint hash is inconsistent');
  }
  if (Number(prior?.executionConcurrency) !== PHASE6_REAL_CONCURRENCY) {
    blockers.push('technical-canary execution was not serial');
  }
  return blockers;
}

export function loadPriorCanaryReport(requestedPath) {
  if (!requestedPath) return null;
  const reportPath = resolveFromRoot(requestedPath);
  if (path.basename(reportPath) !== 'phase6-gate-report.json') {
    throw new Error('--prior-canary must name a phase6-gate-report.json artifact');
  }
  const report = readJson(reportPath);
  const gateDir = path.dirname(reportPath);
  const verification = assertExperimentRun(gateDir);
  const contractSha256 = hashFile(PHASE6_CONTRACT_PATH);
  const evaluatorSha256 = hashFile(PHASE6_VERDICT_EVALUATOR);
  const reevaluated = evaluatePhase6Verdict(report, PHASE6_CONTRACT);
  const parentProvenanceBlockers = phase6ParentPlanProvenanceBlockers(verification.plan);
  const expectedRows =
    PHASE6_CONTRACT.technicalCanary.worlds.length *
    PHASE6_CONTRACT.technicalCanary.arms.length *
    PHASE6_CONTRACT.technicalCanary.seeds.length;
  if (
    verification.seal?.status !== 'complete' ||
    report.mode !== 'real' ||
    report.evidenceKind !== 'technical_canary' ||
    report.protocolId !== PHASE6_CONTRACT.protocolId ||
    report.verdictEvaluatorVersion !== PHASE6_CONTRACT.verdictEvaluatorVersion ||
    report.decision?.evaluatorVersion !== PHASE6_CONTRACT.verdictEvaluatorVersion ||
    report.decision?.verdict !== 'technical_canary_only' ||
    report.decision?.passed !== true ||
    report.rowCount !== expectedRows ||
    report.okRows !== expectedRows ||
    verification.plan?.runId !== report.label ||
    verification.plan?.lineage?.parentRunId !== null ||
    hashCanonicalJson(verification.plan?.requiredObservedModelRoles) !==
      hashCanonicalJson(['director', 'learner', 'tutor']) ||
    verification.plan?.metadata?.phase6DecisionContractSha256 !== contractSha256 ||
    verification.plan?.metadata?.phase6VerdictEvaluatorSha256 !== evaluatorSha256 ||
    hashCanonicalJson(verification.plan?.intent?.phase6Gate?.decisionContract) !== hashCanonicalJson(PHASE6_CONTRACT) ||
    reevaluated.verdict !== 'technical_canary_only' ||
    reevaluated.passed !== true ||
    parentProvenanceBlockers.length
  ) {
    throw new Error(
      'Phase 6A seeds 1-5 require a sealed, passing, hash-compatible v2.1 technical-canary report reproduced by the current evaluator',
    );
  }
  const rows = report.rows.map(phase6EvidenceRow);
  return {
    parentRunId: verification.plan.runId,
    label: report.label,
    verdict: report.decision.verdict,
    passed: true,
    claimStatus: 'excluded',
    seeds: [...PHASE6_CONTRACT.technicalCanary.seeds],
    verdictEvaluatorVersion: report.verdictEvaluatorVersion,
    decisionContractSha256: contractSha256,
    verdictEvaluatorSha256: evaluatorSha256,
    report: rel(reportPath),
    reportSha256: hashFile(reportPath),
    sealSha256: hashFile(path.join(gateDir, 'run-seal.json')),
    planSha256: verification.seal.planSha256,
    inventorySha256: verification.seal.inventorySha256,
    git: structuredClone(verification.plan.provenance.git),
    requiredHashKinds: structuredClone(verification.plan.requiredHashKinds),
    hashes: structuredClone(verification.plan.hashes),
    models: structuredClone(verification.plan.models),
    phase6ModelRuntime: structuredClone(verification.plan.metadata.phase6ModelRuntime),
    phase6ModelRuntimeSha256: verification.plan.metadata.phase6ModelRuntimeSha256,
    phase6CliFingerprints: structuredClone(verification.plan.metadata.phase6CliFingerprints),
    phase6CliFingerprintsSha256: verification.plan.metadata.phase6CliFingerprintsSha256,
    executionConcurrency: verification.plan.metadata.executionConcurrency,
    rows,
  };
}

export function loadPriorProvisionalReport(requestedPath) {
  if (!requestedPath) return null;
  const reportPath = resolveFromRoot(requestedPath);
  if (path.basename(reportPath) !== 'phase6-gate-report.json') {
    throw new Error('--prior-provisional must name a phase6-gate-report.json artifact');
  }
  const report = readJson(reportPath);
  const gateDir = path.dirname(reportPath);
  const verification = assertExperimentRun(gateDir);
  const seeds = report.decision?.seeds || [];
  const contractSha256 = hashFile(PHASE6_CONTRACT_PATH);
  const evaluatorSha256 = hashFile(PHASE6_VERDICT_EVALUATOR);
  const reevaluated = evaluatePhase6Verdict(report, PHASE6_CONTRACT);
  const parentProvenanceBlockers = phase6ParentPlanProvenanceBlockers(verification.plan);
  const canaryParent = verification.plan?.metadata?.phase6CanaryParentProvenance || null;
  const canaryParentBlockers = phase6CanarySnapshotBlockers(canaryParent);
  if (
    verification.seal?.status !== 'complete' ||
    report.mode !== 'real' ||
    report.evidenceKind !== 'claim' ||
    report.protocolId !== PHASE6_CONTRACT.protocolId ||
    report.verdictEvaluatorVersion !== PHASE6_CONTRACT.verdictEvaluatorVersion ||
    report.decision?.evaluatorVersion !== PHASE6_CONTRACT.verdictEvaluatorVersion ||
    report.decision?.verdict !== 'provisional_promote' ||
    !['field_planner_advisory', 'field_planner_enforce'].includes(report.decision?.winner) ||
    hashCanonicalJson(seeds) !== hashCanonicalJson(PHASE6_CONTRACT.seedBlocks[0]) ||
    verification.plan?.runId !== report.label ||
    verification.plan?.metadata?.phase6DecisionContractSha256 !== contractSha256 ||
    verification.plan?.metadata?.phase6VerdictEvaluatorSha256 !== evaluatorSha256 ||
    hashCanonicalJson(verification.plan?.intent?.phase6Gate?.decisionContract) !== hashCanonicalJson(PHASE6_CONTRACT) ||
    verification.plan?.lineage?.parentRunId !== canaryParent?.parentRunId ||
    !report.priorCanary ||
    hashCanonicalJson(report.priorCanary) !== hashCanonicalJson(canaryParent) ||
    reevaluated.verdict !== 'provisional_promote' ||
    reevaluated.winner !== report.decision.winner ||
    parentProvenanceBlockers.length ||
    canaryParentBlockers.length
  ) {
    throw new Error(
      'Phase 6A seeds 6-10 require a sealed, hash-compatible real k=5 provisional_promote report reproduced by the current evaluator',
    );
  }
  const evidenceRows = Array.isArray(report.evidenceRows) ? report.evidenceRows : report.rows;
  return {
    parentRunId: verification.plan.runId,
    label: report.label,
    verdict: report.decision.verdict,
    winner: report.decision.winner || null,
    seeds: seeds.map(String),
    verdictEvaluatorVersion: report.verdictEvaluatorVersion,
    decisionContractSha256: contractSha256,
    verdictEvaluatorSha256: evaluatorSha256,
    report: rel(reportPath),
    reportSha256: hashFile(reportPath),
    sealSha256: hashFile(path.join(gateDir, 'run-seal.json')),
    planSha256: verification.seal.planSha256,
    inventorySha256: verification.seal.inventorySha256,
    git: structuredClone(verification.plan.provenance.git),
    requiredHashKinds: structuredClone(verification.plan.requiredHashKinds),
    hashes: structuredClone(verification.plan.hashes),
    models: structuredClone(verification.plan.models),
    phase6ModelRuntime: structuredClone(verification.plan.metadata.phase6ModelRuntime),
    phase6ModelRuntimeSha256: verification.plan.metadata.phase6ModelRuntimeSha256,
    phase6CliFingerprints: structuredClone(verification.plan.metadata.phase6CliFingerprints),
    phase6CliFingerprintsSha256: verification.plan.metadata.phase6CliFingerprintsSha256,
    executionConcurrency: verification.plan.metadata.executionConcurrency,
    priorCanary: structuredClone(canaryParent),
    rows: evidenceRows.map(phase6EvidenceRow),
  };
}

function gitSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function assertPhase6RealRunGitState({ mode, gitFingerprint, frozenPlan = null } = {}) {
  if (mode !== 'real') return;
  if (!gitFingerprint?.sha) {
    throw new Error('Refusing Phase 6 real run without a readable committed Git SHA');
  }
  if (gitFingerprint.dirty) {
    throw new Error('Refusing Phase 6 real run from a dirty working tree; commit the intended code first');
  }
  const frozenGit = frozenPlan?.provenance?.git || null;
  if (frozenGit?.dirty) {
    throw new Error('Refusing Phase 6 real run because its frozen run plan was created from a dirty tree');
  }
  if (frozenGit?.sha && frozenGit.sha !== gitFingerprint.sha) {
    throw new Error(
      `Refusing Phase 6 real-run resume at ${gitFingerprint.sha}; frozen run plan requires ${frozenGit.sha}`,
    );
  }
}

export function assertPhase6ForcePolicy({ mode, force = false } = {}) {
  if (mode === 'real' && force) {
    throw new Error('Refusing --force for a real Phase 6 run; completed evidence rows are immutable');
  }
}

export function assertPhase6PaidConfirmation({ mode, confirmed = false } = {}) {
  if (mode === 'real' && !confirmed) {
    throw new Error('Paid Phase 6A is locked; pass --confirm-paid-phase6a-v2.1 after reviewing the frozen protocol');
  }
}

export function assertPhase6ConcurrencyPolicy({ mode, concurrency } = {}) {
  if (mode === 'real' && Number(concurrency) !== PHASE6_REAL_CONCURRENCY) {
    throw new Error('Real Phase 6A requires --concurrency 1');
  }
}

function manifestMatrixBlockers(manifest) {
  const blockers = [];
  const expectedSchedule = balancedArmOrderSchedule(manifest.worlds || [], manifest.seeds || [], manifest.arms || []);
  if (hashCanonicalJson(manifest.armOrderSchedule) !== hashCanonicalJson(expectedSchedule)) {
    blockers.push('manifest arm order differs from the frozen deterministic balanced rotation');
  }
  const expectedRowOrder = expectedSchedule.flatMap((entry) =>
    entry.arms.map((armKey) => `${entry.worldKey}-${armKey}-s${entry.seed}`),
  );
  if (hashCanonicalJson((manifest.rows || []).map((row) => row.id)) !== hashCanonicalJson(expectedRowOrder)) {
    blockers.push('manifest row order differs from the frozen deterministic arm-order schedule');
  }
  const expected = new Set();
  for (const world of manifest.worlds || []) {
    for (const seed of manifest.seeds || []) {
      for (const arm of manifest.arms || []) expected.add(`${world}\t${arm}\t${seed}`);
    }
  }
  const seen = new Set();
  for (const row of manifest.rows || []) {
    const key = `${row.worldKey}\t${row.armKey}\t${String(row.seed)}`;
    if (!expected.has(key)) blockers.push(`manifest row is outside its declared matrix: ${key}`);
    if (seen.has(key)) blockers.push(`manifest contains duplicate matrix cell: ${key}`);
    seen.add(key);
    const world = WORLD_REGISTRY[row.worldKey];
    const arm = ARM_REGISTRY[row.armKey];
    if (world && arm) {
      const canonical = buildRow({
        gateDir: manifest.gateDir,
        mode: manifest.mode,
        matrixLabel: manifest.label,
        world,
        arm,
        seed: row.seed,
        baseFlags: PHASE6_CONTRACT.baseFlags,
        decay: PHASE6_CONTRACT.decay,
      });
      if (hashCanonicalJson(row.args) !== hashCanonicalJson(canonical.args)) {
        blockers.push(`manifest row ${row.id} command flags differ from the canonical frozen arm command`);
      }
      for (const field of ['id', 'world', 'script', 'armLabel', 'mode', 'decay']) {
        if (hashCanonicalJson(row[field]) !== hashCanonicalJson(canonical[field])) {
          blockers.push(`manifest row ${row.id} ${field} differs from the canonical frozen row`);
        }
      }
    }
  }
  for (const key of expected) {
    if (!seen.has(key)) blockers.push(`manifest is missing matrix cell: ${key}`);
  }
  if ((manifest.rows || []).length !== expected.size) {
    blockers.push(`manifest requires exactly ${expected.size} unique rows`);
  }
  return blockers;
}

export function phase6RealGateProtocolBlockers(manifest = {}) {
  if (manifest.mode !== 'real') return [];
  const blockers = [];
  if (manifest.protocolId !== PHASE6_CONTRACT.protocolId) {
    blockers.push(`protocol id must be ${PHASE6_CONTRACT.protocolId}`);
  }
  if (hashCanonicalJson(manifest.baseFlags) !== hashCanonicalJson(PHASE6_CONTRACT.baseFlags)) {
    blockers.push('Phase 6A base flags must equal the frozen contract exactly, with no missing or extra flags');
  }
  if (hashCanonicalJson(manifest.decay) !== hashCanonicalJson(PHASE6_CONTRACT.decay)) {
    blockers.push('Phase 6A decay configuration differs from the frozen contract');
  }
  if (hashCanonicalJson(manifest.decisionContract) !== hashCanonicalJson(PHASE6_CONTRACT)) {
    blockers.push('numerical comparison semantics differ from the frozen Phase 6A decision contract');
  }
  if (manifest.verdictEvaluatorVersion !== PHASE6_CONTRACT.verdictEvaluatorVersion) {
    blockers.push(`verdict evaluator must be ${PHASE6_CONTRACT.verdictEvaluatorVersion}`);
  }
  if (manifest.evidenceKind === 'technical_canary') {
    for (const field of ['worlds', 'arms', 'seeds']) {
      if (hashCanonicalJson(manifest[field]) !== hashCanonicalJson(PHASE6_CONTRACT.technicalCanary[field])) {
        blockers.push(`technical canary ${field} differ from the frozen excluded canary contract`);
      }
    }
    if (manifest.priorCanary || manifest.priorProvisional) {
      blockers.push('technical canary must not declare an evidence parent');
    }
  } else {
    if (manifest.evidenceKind !== 'claim') blockers.push('Phase 6A claim runs require evidenceKind=claim');
    if (hashCanonicalJson(manifest.worlds) !== hashCanonicalJson(PHASE6_CONTRACT.worlds)) {
      blockers.push(`Phase 6A worlds must be ${PHASE6_CONTRACT.worlds.join(', ')}`);
    }
    if (hashCanonicalJson(manifest.arms) !== hashCanonicalJson(PHASE6_CONTRACT.arms)) {
      blockers.push(`Phase 6A arms must be ${PHASE6_CONTRACT.arms.join(', ')}`);
    }
    const firstSeeds = PHASE6_CONTRACT.seedBlocks[0];
    const secondSeeds = PHASE6_CONTRACT.seedBlocks[1];
    const isFirstBlock = hashCanonicalJson(manifest.seeds) === hashCanonicalJson(firstSeeds);
    const isSecondBlock = hashCanonicalJson(manifest.seeds) === hashCanonicalJson(secondSeeds);
    if (!isFirstBlock && !isSecondBlock) {
      blockers.push('Phase 6A claim rows must be exactly seeds 1-5 or the gated continuation seeds 6-10');
    }
    if (isFirstBlock && manifest.priorProvisional) {
      blockers.push('Phase 6A seeds 1-5 must not declare a provisional parent');
    }
    if (isFirstBlock && phase6CanarySnapshotBlockers(manifest.priorCanary).length) {
      blockers.push('Phase 6A seeds 1-5 require a sealed, passing, compatible v2.1 technical-canary parent');
    }
    if (isSecondBlock && manifest.priorCanary) {
      blockers.push('Phase 6A seeds 6-10 inherit canary lineage through the sealed seeds 1-5 parent');
    }
    if (
      isSecondBlock &&
      (manifest.priorProvisional?.verdict !== 'provisional_promote' ||
        !['field_planner_advisory', 'field_planner_enforce'].includes(manifest.priorProvisional?.winner) ||
        hashCanonicalJson(manifest.priorProvisional?.seeds) !== hashCanonicalJson(firstSeeds) ||
        manifest.priorProvisional?.verdictEvaluatorVersion !== PHASE6_CONTRACT.verdictEvaluatorVersion ||
        manifest.priorProvisional?.decisionContractSha256 !== hashFile(PHASE6_CONTRACT_PATH) ||
        manifest.priorProvisional?.verdictEvaluatorSha256 !== hashFile(PHASE6_VERDICT_EVALUATOR) ||
        !String(manifest.priorProvisional?.parentRunId || '').trim() ||
        !/^[0-9a-f]{64}$/u.test(String(manifest.priorProvisional?.reportSha256 || '')) ||
        !/^[0-9a-f]{64}$/u.test(String(manifest.priorProvisional?.sealSha256 || '')) ||
        !/^[0-9a-f]{64}$/u.test(String(manifest.priorProvisional?.planSha256 || '')) ||
        !/^[0-9a-f]{64}$/u.test(String(manifest.priorProvisional?.inventorySha256 || '')) ||
        manifest.priorProvisional?.git?.dirty !== false ||
        !String(manifest.priorProvisional?.git?.sha || '').trim() ||
        hashCanonicalJson(manifest.priorProvisional?.requiredHashKinds) !==
          hashCanonicalJson([...PHASE6_REQUIRED_HASH_KINDS].sort()) ||
        PHASE6_REQUIRED_HASH_KINDS.some(
          (kind) => !/^[0-9a-f]{64}$/u.test(String(manifest.priorProvisional?.hashes?.[kind] || '')),
        ) ||
        hashCanonicalJson(Object.keys(manifest.priorProvisional?.models || {}).sort()) !==
          hashCanonicalJson(['director', 'learner', 'tutor']) ||
        manifest.priorProvisional?.phase6ModelRuntimeSha256 !==
          hashCanonicalJson(manifest.priorProvisional?.phase6ModelRuntime) ||
        manifest.priorProvisional?.phase6CliFingerprintsSha256 !==
          hashCanonicalJson(manifest.priorProvisional?.phase6CliFingerprints) ||
        Number(manifest.priorProvisional?.executionConcurrency) !== PHASE6_REAL_CONCURRENCY ||
        phase6CanarySnapshotBlockers(manifest.priorProvisional?.priorCanary).length ||
        !Array.isArray(manifest.priorProvisional?.rows) ||
        manifest.priorProvisional.rows.length !==
          PHASE6_CONTRACT.worlds.length * PHASE6_CONTRACT.arms.length * firstSeeds.length)
    ) {
      blockers.push('Phase 6A seeds 6-10 require a sealed, compatible seeds 1-5 provisional_promote parent');
    }
  }
  blockers.push(...manifestMatrixBlockers(manifest));
  if (
    (manifest.rows || []).some((row) => row.armKey === 'baseline' && row.armLabel !== PHASE6_CONTRACT.baselineLabel)
  ) {
    blockers.push(`baseline arm label must be ${PHASE6_CONTRACT.baselineLabel}`);
  }
  return blockers;
}

export function assertPhase6RealGateProtocolReady(manifest) {
  const blockers = phase6RealGateProtocolBlockers(manifest);
  if (blockers.length) {
    throw new Error(`Refusing Phase 6 real run until the frozen protocol is executable:\n- ${blockers.join('\n- ')}`);
  }
}

function capturePhase6GitFingerprint() {
  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  return git;
}

function assertLivePhase6RealRunGitState(manifest, frozenPlan = null) {
  if (manifest.mode !== 'real') return;
  assertPhase6RealRunGitState({
    mode: manifest.mode,
    gitFingerprint: capturePhase6GitFingerprint(),
    frozenPlan,
  });
}

function modelLabel(target) {
  return `${target.provider}/${target.model || '(cli-default)'}`;
}

function requestedTarget(role, resolved, mode) {
  if (mode !== 'real') return 'mock/mock';
  const prefix = `DERIVATION_${role.toUpperCase()}_`;
  const provider = process.env[`${prefix}PROVIDER`] || process.env.DERIVATION_PROVIDER || resolved.provider;
  const model = process.env[`${prefix}MODEL`] || process.env.DERIVATION_MODEL || resolved.model || '(cli-default)';
  return `${provider}/${model}`;
}

function gateDesign(manifest) {
  return {
    schema: manifest.schema,
    protocolId: manifest.protocolId,
    evidenceKind: manifest.evidenceKind,
    verdictEvaluatorVersion: manifest.verdictEvaluatorVersion,
    decisionContract: manifest.decisionContract,
    priorCanary: priorCanaryMetadata(manifest.priorCanary),
    priorProvisional: priorProvisionalMetadata(manifest.priorProvisional),
    label: manifest.label,
    profile: manifest.profile,
    mode: manifest.mode,
    worlds: manifest.worlds,
    arms: manifest.arms,
    seeds: manifest.seeds,
    decay: manifest.decay,
    baseFlags: manifest.baseFlags,
    armOrderSchedule: manifest.armOrderSchedule,
    rows: manifest.rows.map((row) => ({
      id: row.id,
      worldKey: row.worldKey,
      world: row.world,
      script: row.script,
      armKey: row.armKey,
      armLabel: row.armLabel,
      seed: row.seed,
      mode: row.mode,
      decay: row.decay,
    })),
  };
}

export function balancedArmOrderSchedule(worldKeys, seeds, armKeys) {
  return worldKeys.flatMap((worldKey, worldIndex) =>
    seeds.map((seed, seedIndex) => {
      const offset = (worldIndex * seeds.length + seedIndex) % armKeys.length;
      return {
        worldKey,
        seed: String(seed),
        offset,
        arms: [...armKeys.slice(offset), ...armKeys.slice(0, offset)],
      };
    }),
  );
}

function logicalArg(value, manifest) {
  if (!path.isAbsolute(value)) return value;
  if (value === LOOP_SCRIPT) return path.relative(ROOT, value);
  const gateRelative = path.relative(manifest.gateDir, value);
  if (!gateRelative.startsWith('..') && !path.isAbsolute(gateRelative)) {
    return `{run_dir}/${gateRelative.split(path.sep).join('/')}`;
  }
  const repoRelative = path.relative(ROOT, value);
  if (!repoRelative.startsWith('..') && !path.isAbsolute(repoRelative)) {
    return repoRelative.split(path.sep).join('/');
  }
  throw new Error(`Phase 6 plan contains a non-relocatable path: ${value}`);
}

function hashFileSet(paths) {
  return hashCanonicalJson(
    [...new Set(paths)]
      .sort()
      .map((file) => ({ path: file.split(path.sep).join('/'), sha256: hashFile(resolveFromRoot(file)) })),
  );
}

function phase6CliFingerprint(command) {
  const lookup = spawnSync('/usr/bin/which', [command], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 10_000,
  });
  if (lookup.error || lookup.status !== 0 || !lookup.stdout.trim()) {
    throw new Error(`Cannot freeze ${command} CLI executable: ${lookup.error?.message || lookup.stderr.trim()}`);
  }
  const executableRealpath = fs.realpathSync(lookup.stdout.trim());
  const versionResult = spawnSync(executableRealpath, ['--version'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 256 * 1024,
  });
  const version = String(versionResult.stdout || versionResult.stderr || '').trim();
  if (versionResult.error || versionResult.status !== 0 || !version) {
    throw new Error(
      `Cannot freeze ${command} CLI version: ${versionResult.error?.message || versionResult.stderr.trim()}`,
    );
  }
  return {
    command,
    executable_realpath: executableRealpath,
    version,
  };
}

export function phase6CliFingerprints(runtime = {}) {
  const providers = [
    ...new Set(
      Object.values(runtime)
        .filter((row) => row?.transport === 'cli')
        .map((row) => row.provider),
    ),
  ].sort();
  return Object.fromEntries(
    providers.map((provider) => {
      const command = PHASE6_CLI_PROVIDERS[provider];
      if (!command) throw new Error(`Phase 6A has no CLI fingerprint contract for provider ${provider}`);
      return [provider, phase6CliFingerprint(command)];
    }),
  );
}

function phase6RoleRuntime(role, mode) {
  const target = mode === 'real' ? resolveTarget(role) : { provider: 'mock', model: 'mock', cli: false };
  if (mode === 'real' && !String(target.model || '').trim()) {
    throw new Error(`Real Phase 6A requires an explicit ${role} model; CLI-default resolution is forbidden`);
  }
  const timeout = Number(process.env.DERIVATION_CLI_TIMEOUT_MS || PHASE6_DEFAULT_CLI_TIMEOUT_MS);
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new Error('DERIVATION_CLI_TIMEOUT_MS must be a positive integer for Phase 6A');
  }
  return {
    role,
    provider: target.provider,
    transport: mode === 'real' ? (target.cli ? 'cli' : 'provider_api') : 'mock',
    requested_model_ref: requestedTarget(role, target, mode),
    resolved_model_ref: modelLabel(target),
    effort:
      target.provider === 'codex'
        ? process.env.DERIVATION_CODEX_REASONING || PHASE6_DEFAULT_CODEX_EFFORT
        : 'provider_managed',
    timeout_ms: target.cli ? timeout : null,
    timeout_scope: target.cli ? 'cli_process_wall_clock' : 'provider_managed',
  };
}

export function phase6ModelRuntime(mode) {
  return Object.fromEntries(
    ['director', 'tutor', 'learner'].map((role) => [role, phase6RoleRuntime(role, mode)]),
  );
}

function evidenceModels(mode, runtime = phase6ModelRuntime(mode)) {
  return Object.fromEntries(
    Object.entries(runtime).map(([role, row]) => [
      role,
      {
        requested: row.requested_model_ref,
        resolved: row.resolved_model_ref,
        observed: null,
      },
    ]),
  );
}

export function assertPhase6FrozenRuntime({ manifest, frozenPlan, concurrency } = {}) {
  assertPhase6ConcurrencyPolicy({ mode: manifest?.mode, concurrency });
  const currentRuntime = phase6ModelRuntime(manifest.mode);
  const currentCliFingerprints = phase6CliFingerprints(currentRuntime);
  if (
    hashCanonicalJson(frozenPlan?.metadata?.phase6ModelRuntime) !== hashCanonicalJson(currentRuntime) ||
    frozenPlan?.metadata?.phase6ModelRuntimeSha256 !== hashCanonicalJson(currentRuntime) ||
    hashCanonicalJson(frozenPlan?.metadata?.phase6CliFingerprints) !== hashCanonicalJson(currentCliFingerprints) ||
    frozenPlan?.metadata?.phase6CliFingerprintsSha256 !== hashCanonicalJson(currentCliFingerprints) ||
    Number(frozenPlan?.metadata?.executionConcurrency) !== Number(concurrency) ||
    hashCanonicalJson(frozenPlan?.models) !== hashCanonicalJson(evidenceModels(manifest.mode, currentRuntime))
  ) {
    throw new Error(
      'Refusing to resume Phase 6 with different models, effort, timeouts, CLI executable/version, or concurrency',
    );
  }
  return currentRuntime;
}

export function buildEvidencePlan(
  manifest,
  {
    masterSeed,
    dryRun,
    gitFingerprint = null,
    concurrency = manifest.mode === 'real' ? PHASE6_REAL_CONCURRENCY : 4,
  },
) {
  const design = gateDesign(manifest);
  const git = gitFingerprint || capturePhase6GitFingerprint();
  assertPhase6ConcurrencyPolicy({ mode: manifest.mode, concurrency });
  const modelRuntime = phase6ModelRuntime(manifest.mode);
  const cliFingerprints = phase6CliFingerprints(modelRuntime);
  const canaryLineage = manifest.priorCanary || manifest.priorProvisional?.priorCanary || null;
  const jobs = manifest.rows.map((row) => ({
    id: row.id,
    worldKey: row.worldKey,
    world: row.world,
    script: row.script,
    armKey: row.armKey,
    seedLabel: row.seed,
    mode: row.mode,
    decay: row.decay,
    command: row.args.map((value) => logicalArg(value, manifest)),
  }));
  return buildExperimentRunPlan({
    runId: manifest.label,
    createdAt: manifest.generatedAt,
    runner: 'scripts/run-derivation-phase6-gate.js',
    provenance: { git },
    models: evidenceModels(manifest.mode, modelRuntime),
    requiredHashKinds: PHASE6_REQUIRED_HASH_KINDS,
    requiredObservedModelRoles: dryRun ? [] : ['director', 'tutor', 'learner'],
    hashes: {
      runner: hashFileSet(['scripts/run-derivation-phase6-gate.js', 'scripts/run-derivation-loop.js']),
      analyzer: hashFileSet([
        'scripts/run-derivation-phase6-gate.js',
        'services/dramaticDerivation/phase6Verdict.js',
      ]),
      policy: hashFileSet(['services/dramaticDerivation/fieldPlanner.js']),
      profile: hashCanonicalJson({ profile: manifest.profile, worlds: manifest.worlds, arms: manifest.arms }),
      prompt: hashFileSet([
        'services/dramaticDerivation/llmRoles.js',
        'services/dramaticDerivation/llmClient.js',
      ]),
      script: hashFileSet(manifest.rows.map((row) => row.script)),
      world: hashFileSet(manifest.rows.map((row) => row.world)),
      config: hashCanonicalJson({
        decisionRulesSha256: hashFile(PHASE6_DECISION_RULES),
        decisionContractSha256: hashFile(PHASE6_CONTRACT_PATH),
        verdictEvaluatorSha256: hashFile(PHASE6_VERDICT_EVALUATOR),
      }),
    },
    masterSeed,
    jobs,
    lineage: {
      parentRunId: manifest.priorProvisional?.parentRunId || manifest.priorCanary?.parentRunId || null,
      resumeOf: null,
      supersedes: [],
    },
    intent: {
      phase6Gate: { ...design, modelRuntime, concurrency },
      decisionRules: path.relative(ROOT, PHASE6_DECISION_RULES),
      claimBoundary: 'Mock validates plumbing only; real runs remain bounded tests of the frozen field planner.',
    },
    metadata: {
      phase6DesignHash: hashCanonicalJson(design),
      phase6DecisionRulesSha256: hashFile(PHASE6_DECISION_RULES),
      phase6DecisionContractSha256: hashFile(PHASE6_CONTRACT_PATH),
      phase6VerdictEvaluatorSha256: hashFile(PHASE6_VERDICT_EVALUATOR),
      phase6ModelRuntime: modelRuntime,
      phase6ModelRuntimeSha256: hashCanonicalJson(modelRuntime),
      phase6CliFingerprints: cliFingerprints,
      phase6CliFingerprintsSha256: hashCanonicalJson(cliFingerprints),
      executionConcurrency: concurrency,
      phase6CanaryParentProvenance: priorCanaryMetadata(canaryLineage),
      phase6ContinuationParentProvenance: priorProvisionalMetadata(manifest.priorProvisional),
    },
  });
}

export function phase6CanaryCompatibilityBlockers({ manifest, plan } = {}) {
  const parent = manifest?.priorCanary;
  if (!parent) return [];
  const blockers = [];
  if (
    parent.git?.dirty !== false ||
    plan?.provenance?.git?.dirty !== false ||
    parent.git?.sha !== plan?.provenance?.git?.sha
  ) {
    blockers.push('technical canary and seeds 1-5 must use the exact same clean Git SHA');
  }
  const invariantHashKinds = ['runner', 'analyzer', 'policy', 'prompt', 'config'];
  if (invariantHashKinds.some((kind) => parent.hashes?.[kind] !== plan?.hashes?.[kind])) {
    blockers.push('technical canary and seeds 1-5 invariant source hashes must match exactly');
  }
  if (hashCanonicalJson(parent.models || null) !== hashCanonicalJson(plan?.models || null)) {
    blockers.push('technical canary and seeds 1-5 frozen role model references must match exactly');
  }
  if (
    parent.phase6ModelRuntimeSha256 !== plan?.metadata?.phase6ModelRuntimeSha256 ||
    hashCanonicalJson(parent.phase6ModelRuntime || null) !== hashCanonicalJson(plan?.metadata?.phase6ModelRuntime || null)
  ) {
    blockers.push('technical canary and seeds 1-5 effort/timeout/runtime policies must match exactly');
  }
  if (
    parent.phase6CliFingerprintsSha256 !== plan?.metadata?.phase6CliFingerprintsSha256 ||
    hashCanonicalJson(parent.phase6CliFingerprints || null) !==
      hashCanonicalJson(plan?.metadata?.phase6CliFingerprints || null)
  ) {
    blockers.push('technical canary and seeds 1-5 CLI executable realpaths/versions must match exactly');
  }
  if (
    Number(parent.executionConcurrency) !== PHASE6_REAL_CONCURRENCY ||
    Number(plan?.metadata?.executionConcurrency) !== PHASE6_REAL_CONCURRENCY
  ) {
    blockers.push('technical canary and seeds 1-5 paid execution must both be serial');
  }
  if (
    plan?.lineage?.parentRunId !== parent.parentRunId ||
    hashCanonicalJson(plan?.metadata?.phase6CanaryParentProvenance) !==
      hashCanonicalJson(priorCanaryMetadata(parent))
  ) {
    blockers.push('seeds 1-5 run plan must checksum-bind the sealed technical-canary parent');
  }
  return blockers;
}

export function assertPhase6CanaryCompatibility({ manifest, plan } = {}) {
  const blockers = phase6CanaryCompatibilityBlockers({ manifest, plan });
  if (blockers.length) {
    throw new Error(`Refusing Phase 6A seeds 1-5 execution:\n- ${blockers.join('\n- ')}`);
  }
}

export function phase6ContinuationCompatibilityBlockers({ manifest, plan } = {}) {
  const parent = manifest?.priorProvisional;
  if (!parent) return [];
  const blockers = [];
  if (
    parent.git?.dirty !== false ||
    plan?.provenance?.git?.dirty !== false ||
    parent.git?.sha !== plan?.provenance?.git?.sha
  ) {
    blockers.push('parent and continuation must use the exact same clean Git SHA');
  }
  if (
    hashCanonicalJson(parent.requiredHashKinds) !== hashCanonicalJson(plan?.requiredHashKinds) ||
    hashCanonicalJson(parent.hashes) !== hashCanonicalJson(plan?.hashes)
  ) {
    blockers.push('parent and continuation runner/policy/world/script/prompt/profile/config hashes must match exactly');
  }
  if (hashCanonicalJson(parent.models) !== hashCanonicalJson(plan?.models)) {
    blockers.push('parent and continuation frozen role model references must match exactly');
  }
  if (
    parent.phase6ModelRuntimeSha256 !== plan?.metadata?.phase6ModelRuntimeSha256 ||
    hashCanonicalJson(parent.phase6ModelRuntime) !== hashCanonicalJson(plan?.metadata?.phase6ModelRuntime)
  ) {
    blockers.push('parent and continuation role effort/timeout/runtime policies must match exactly');
  }
  if (
    parent.phase6CliFingerprintsSha256 !== plan?.metadata?.phase6CliFingerprintsSha256 ||
    hashCanonicalJson(parent.phase6CliFingerprints) !==
      hashCanonicalJson(plan?.metadata?.phase6CliFingerprints)
  ) {
    blockers.push('parent and continuation CLI executable realpaths/versions must match exactly');
  }
  if (
    Number(parent.executionConcurrency) !== PHASE6_REAL_CONCURRENCY ||
    Number(plan?.metadata?.executionConcurrency) !== PHASE6_REAL_CONCURRENCY
  ) {
    blockers.push('parent and continuation paid execution must both be serial');
  }
  return blockers;
}

export function assertPhase6ContinuationCompatibility({ manifest, plan } = {}) {
  const blockers = phase6ContinuationCompatibilityBlockers({ manifest, plan });
  if (blockers.length) {
    throw new Error(`Refusing Phase 6A seeds 6-10 continuation:\n- ${blockers.join('\n- ')}`);
  }
}

function writeCompatibilityManifest(manifest) {
  const manifestPath = path.join(manifest.gateDir, 'manifest.json');
  try {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`Refusing to overwrite frozen Phase 6 manifest at ${manifestPath}`);
    }
    throw error;
  }
}

export function prepareEvidenceTransaction(
  manifest,
  { masterSeed, dryRun, gitFingerprint = null, concurrency = manifest.mode === 'real' ? 1 : 4 },
) {
  fs.mkdirSync(manifest.gateDir, { recursive: true });
  fs.mkdirSync(manifest.logDir, { recursive: true });
  fs.mkdirSync(manifest.loopDir, { recursive: true });
  const sealPath = path.join(manifest.gateDir, 'run-seal.json');
  if (fs.existsSync(sealPath)) throw new Error(`Phase 6 run is already sealed at ${sealPath}`);
  const planPath = path.join(manifest.gateDir, 'run-plan.json');
  const manifestPath = path.join(manifest.gateDir, 'manifest.json');
  const designHash = hashCanonicalJson(gateDesign(manifest));
  if (fs.existsSync(planPath)) {
    const frozenPlan = readJson(planPath);
    validateExperimentRunPlan(frozenPlan);
    assertPhase6RealRunGitState({ mode: manifest.mode, gitFingerprint, frozenPlan });
    if (frozenPlan.metadata?.phase6DesignHash !== designHash) {
      throw new Error('Refusing to resume Phase 6 with a design that differs from the frozen run plan');
    }
    if (frozenPlan.randomization.masterSeed !== masterSeed) {
      throw new Error('Refusing to resume Phase 6 with a different --run-seed');
    }
    assertPhase6FrozenRuntime({ manifest, frozenPlan, concurrency });
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Refusing to resume Phase 6 without its immutable compatibility manifest; use a superseding label');
    }
    const expectedManifest = { ...structuredClone(manifest), generatedAt: frozenPlan.createdAt };
    if (hashCanonicalJson(readJson(manifestPath)) !== hashCanonicalJson(expectedManifest)) {
      throw new Error('Refusing to resume Phase 6 because manifest.json differs from the frozen transaction');
    }
    const expectedPlan = buildEvidencePlan(expectedManifest, {
      masterSeed,
      dryRun,
      gitFingerprint,
      concurrency,
    });
    if (hashCanonicalJson(frozenPlan) !== hashCanonicalJson(expectedPlan)) {
      throw new Error('Refusing to resume Phase 6 because the complete frozen run plan no longer matches');
    }
    assertPhase6CanaryCompatibility({ manifest, plan: frozenPlan });
    assertPhase6ContinuationCompatibility({ manifest, plan: frozenPlan });
    const events = readRunEvents(manifest.gateDir);
    assertPhase6EventChain(events);
    if (
      events.some(
        (event) => event.type === 'run_stopped' || event.status === PHASE6_INDETERMINATE_STATUS,
      )
    ) {
      throw new Error('Refusing to resume a Phase 6 transaction marked same-label-forbidden; use a superseding label');
    }
    appendRunEvent(manifest.gateDir, {
      type: 'run_resumed',
      mode: manifest.mode,
      dryRun,
    });
    return frozenPlan;
  }
  const plan = buildEvidencePlan(manifest, { masterSeed, dryRun, gitFingerprint, concurrency });
  assertPhase6CanaryCompatibility({ manifest, plan });
  assertPhase6ContinuationCompatibility({ manifest, plan });
  createRunPlan(manifest.gateDir, plan);
  writeCompatibilityManifest(manifest);
  appendRunEvent(manifest.gateDir, {
    type: 'run_planned',
    mode: manifest.mode,
    dryRun,
  });
  return plan;
}

function usage() {
  return `Usage: node scripts/run-derivation-phase6-gate.js [options]

Options:
  --label <id>              Gate label. Default: phase6-field-planner-<timestamp>
  --out <dir>               Output root. Default: exports/dramatic-derivation/phase6-gate
  --profile smoke|full      World set. Default: smoke
  --worlds <csv>            Override worlds. Keys: ${Object.keys(WORLD_REGISTRY).join(', ')}
  --arms <csv>              Override arms. Keys: ${Object.keys(ARM_REGISTRY).join(', ')}
  --seeds <csv>             Seed labels. Default: 1 in mock, frozen 1-5 in real
  --technical-canary        Real Marrick x four-arm x seed-0 route check; excluded from evidence
  --prior-canary <file>      Required for real seeds 1-5; sealed passing technical-canary report
  --prior-provisional <file> Required for real seeds 6-10; sealed k=5 phase6-gate-report.json
  --run-seed <n>            Master seed for deterministic replay. Default: 20260711
  --decay-rate <n>          Mock override. Real Phase 6A is frozen at ${PHASE6_CONTRACT.decay.rate}
  --mutate-share <n>        Mock override. Real Phase 6A is frozen at ${PHASE6_CONTRACT.decay.mutateShare}
  --mode mock|real          Backend mode. Default: mock
  --real                    Alias for --mode real
  --confirm-paid-phase6a-v2.1 Required acknowledgement for every real Phase 6A transaction
  --concurrency <n>         Default: 4 in mock, 1 in real
  --force                   Mock only; re-run rows even if artifacts already exist
  --dry-run                 Write manifest/report preview, run nothing
  --help                    Show this help
`;
}

function normalizeKeys(values, registry, label) {
  const unknown = values.filter((value) => !registry[value]);
  if (unknown.length) {
    throw new Error(`unknown ${label}: ${unknown.join(', ')}`);
  }
  return values;
}

function cliFlagArgs(flags) {
  const args = [];
  for (const [key, value] of Object.entries(flags)) {
    if (value === false || value === null || value === undefined) continue;
    if (value === true) args.push(`--${key}`);
    else args.push(`--${key}`, String(value));
  }
  return args;
}

function decayFlag(seed, decay) {
  if (!decay || !Number.isFinite(decay.rate) || decay.rate <= 0) return null;
  return JSON.stringify({
    ...decay,
    seed: Number(seed),
  });
}

function buildRow({ gateDir, mode, matrixLabel, world, arm, seed, baseFlags, decay }) {
  const rowLabel = `${world.key}-${arm.key}-s${seed}`;
  const loopDir = path.join(gateDir, 'runs');
  const runDir = path.join(loopDir, rowLabel);
  const flags = {
    ...baseFlags,
    ...arm.flags,
  };
  const rowDecay = decay ? { ...decay, seed: Number(seed) } : null;
  const decayArgument = decayFlag(seed, decay);
  if (decayArgument) flags.decay = decayArgument;
  const args = [
    LOOP_SCRIPT,
    '--world',
    world.world,
    '--script',
    world.script,
    '--label',
    rowLabel,
    '--out',
    loopDir,
    '--group',
    matrixLabel,
    ...cliFlagArgs(flags),
  ];
  if (mode === 'real') args.push('--real');
  return {
    id: rowLabel,
    label: rowLabel,
    worldKey: world.key,
    world: world.world,
    script: world.script,
    armKey: arm.key,
    armLabel: arm.label,
    seed: String(seed),
    mode,
    decay: rowDecay,
    runDir,
    logFile: path.join(gateDir, 'logs', `${rowLabel}.log`),
    args,
    command: `node ${args.map((part) => (/\s/u.test(part) ? JSON.stringify(part) : part)).join(' ')}`,
  };
}

export function buildGatePlan(options = {}) {
  const profile = options.profile || 'smoke';
  if (!PROFILES[profile] && !options.worlds?.length) throw new Error(`unknown profile: ${profile}`);
  const mode = options.mode === 'real' ? 'real' : 'mock';
  const technicalCanary = options.technicalCanary === true;
  if (technicalCanary && mode !== 'real') throw new Error('Phase 6 technical canary requires --mode real');
  const worldKeys = normalizeKeys(
    technicalCanary
      ? PHASE6_CONTRACT.technicalCanary.worlds
      : options.worlds?.length
        ? options.worlds
        : PROFILES[profile],
    WORLD_REGISTRY,
    'world',
  );
  const armKeys = normalizeKeys(
    technicalCanary ? PHASE6_CONTRACT.technicalCanary.arms : options.arms?.length ? options.arms : DEFAULT_ARMS,
    ARM_REGISTRY,
    'arm',
  );
  const seeds = technicalCanary ? PHASE6_CONTRACT.technicalCanary.seeds : options.seeds?.length ? options.seeds : ['1'];
  const gateLabel = options.label || `phase6-field-planner-${timestamp()}`;
  const gateDir = path.join(resolveFromRoot(options.out || 'exports/dramatic-derivation/phase6-gate'), gateLabel);
  const baseFlags = { ...DEFAULT_BASE_FLAGS, ...(options.baseFlags || {}) };
  const defaultDecayRate = PHASE6_CONTRACT.decay.rate;
  const decayRate = Number(options.decayRate ?? defaultDecayRate);
  const mutateShare = Number(options.mutateShare ?? PHASE6_CONTRACT.decay.mutateShare);
  const decay =
    decayRate > 0
      ? {
          ...PHASE6_CONTRACT.decay,
          rate: decayRate,
          mutateShare,
        }
      : null;
  const rows = [];
  const armOrderSchedule = balancedArmOrderSchedule(worldKeys, seeds, armKeys);
  for (const schedule of armOrderSchedule) {
    const { worldKey, seed } = schedule;
    for (const armKey of schedule.arms) {
      rows.push(
        buildRow({
          gateDir,
          mode,
          matrixLabel: gateLabel,
          world: WORLD_REGISTRY[worldKey],
          arm: ARM_REGISTRY[armKey],
          seed,
          baseFlags,
          decay,
        }),
      );
    }
  }
  return {
    schema: 'machinespirits.derivation.phase6-gate.manifest.v1',
    protocolId: PHASE6_CONTRACT.protocolId,
    evidenceKind: technicalCanary ? 'technical_canary' : 'claim',
    verdictEvaluatorVersion: PHASE6_CONTRACT.verdictEvaluatorVersion,
    decisionContract: structuredClone(PHASE6_CONTRACT),
    priorCanary: !technicalCanary && options.priorCanary ? structuredClone(options.priorCanary) : null,
    priorProvisional: !technicalCanary && options.priorProvisional ? structuredClone(options.priorProvisional) : null,
    label: gateLabel,
    profile,
    mode,
    gitSha: gitSha(),
    generatedAt: new Date().toISOString(),
    gateDir,
    loopDir: path.join(gateDir, 'runs'),
    logDir: path.join(gateDir, 'logs'),
    worlds: worldKeys,
    arms: armKeys,
    seeds: seeds.map(String),
    decay,
    baseFlags,
    armOrderSchedule,
    rows,
  };
}

function artifactsComplete(row) {
  return [
    'diagnosis.json',
    'result.json',
    'transcript.md',
    'dialogue-report.json',
    'dialogue-report.md',
    'dynamic-field.svg',
  ].every((name) => fs.existsSync(path.join(row.runDir, name)));
}

function signalPhase6Child(record, signal) {
  if (!record?.child || record.child.exitCode !== null || record.child.signalCode !== null) return;
  try {
    if (process.platform !== 'win32' && record.child.pid) process.kill(-record.child.pid, signal);
    else record.child.kill(signal);
  } catch {
    try {
      record.child.kill(signal);
    } catch {
      // The child may have closed between the state check and signal delivery.
    }
  }
}

export function requestPhase6Interruption(signal = 'SIGTERM') {
  if (!phase6InterruptSignal) phase6InterruptSignal = signal;
  for (const record of activePhase6Children.values()) {
    signalPhase6Child(record, 'SIGTERM');
    if (!record.killTimer) {
      record.killTimer = setTimeout(() => signalPhase6Child(record, 'SIGKILL'), PHASE6_CHILD_KILL_GRACE_MS);
      record.killTimer.unref?.();
    }
  }
}

export function installPhase6SignalHandlers() {
  if (activePhase6Children.size) throw new Error('Cannot install Phase 6 signal handlers with active children');
  phase6InterruptSignal = null;
  const handlers = Object.fromEntries(
    ['SIGINT', 'SIGTERM'].map((signal) => [
      signal,
      () => {
        console.error(`Phase 6 received ${signal}; terminating the active row and forbidding same-label reuse`);
        requestPhase6Interruption(signal);
      },
    ]),
  );
  for (const [signal, handler] of Object.entries(handlers)) process.once(signal, handler);
  return () => {
    for (const [signal, handler] of Object.entries(handlers)) process.removeListener(signal, handler);
    phase6InterruptSignal = null;
  };
}

function runRow(row) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(row.logFile), { recursive: true });
    const log = fs.createWriteStream(row.logFile);
    const child = spawn(process.execPath, row.args, {
      cwd: ROOT,
      env: process.env,
      detached: process.platform !== 'win32',
    });
    const record = { child, rowId: row.id, killTimer: null };
    activePhase6Children.set(row.id, record);
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    let settled = false;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      activePhase6Children.delete(row.id);
      if (record.killTimer) clearTimeout(record.killTimer);
      log.end(() => {
        try {
          fsyncFile(row.logFile);
          resolve(code ?? 1);
        } catch {
          resolve(1);
        }
      });
    };
    child.on('error', (error) => {
      log.write(`\nPhase 6 child spawn error: ${error.message}\n`);
      finish(1);
    });
    child.on('close', (code) => finish(code));
  });
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(lanes);
  return results;
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value || 'unknown'] = (out[value || 'unknown'] || 0) + 1;
  return out;
}

function sumObjectCounts(objects) {
  const out = {};
  for (const object of objects) {
    for (const [key, count] of Object.entries(object || {})) {
      out[key] = (out[key] || 0) + Number(count || 0);
    }
  }
  return out;
}

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function round3(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(3)) : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function normalizeExactText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function factPatterns(fact, formats) {
  if (!Array.isArray(fact) || !fact.length) return [];
  const tokens = fact.map((token) => escapeRegex(token));
  const patterns = [];
  if (formats.includes('predicate_call') && tokens.length > 1) {
    patterns.push({
      format: 'predicate_call',
      regex: new RegExp(`\\b${tokens[0]}\\s*\\(\\s*${tokens.slice(1).join('\\s*,\\s*')}\\s*\\)`, 'iu'),
    });
  }
  if (formats.includes('space_joined')) {
    patterns.push({ format: 'space_joined', regex: new RegExp(`\\b${tokens.join('\\s+')}\\b`, 'iu') });
  }
  if (formats.includes('json_array')) {
    const items = tokens.map((token) => `["']${token}["']`).join('\\s*,\\s*');
    patterns.push({ format: 'json_array', regex: new RegExp(`\\[\\s*${items}\\s*\\]`, 'iu') });
  }
  return patterns;
}

function matchingFactFormat(text, fact, formats) {
  return factPatterns(fact, formats).find((pattern) => pattern.regex.test(text))?.format || null;
}

/**
 * High-precision dynamic leak reader for Phase 6A evidence. The contract
 * declares every pattern family: formal fact renderings, exact authored
 * surfaces before their actual ledger release, and proof-distance arithmetic.
 * It reads learner-facing tutor text only; internal traces remain auditable but
 * do not count as a spoken leak.
 */
export function auditPhase6TutorTranscript({ world = null, worldPath = null, result = null } = {}) {
  let resolvedWorld = world;
  try {
    if (!resolvedWorld && worldPath) resolvedWorld = loadWorld(resolveFromRoot(worldPath));
  } catch (error) {
    return {
      checked: false,
      ok: false,
      hitCount: 0,
      errors: [`world could not be loaded for transcript leak audit: ${error.message}`],
      proofArithmeticHits: [],
      formalSecretHits: [],
      unreleasedPremiseHits: [],
    };
  }
  if (!resolvedWorld || !Array.isArray(result?.transcript)) {
    return {
      checked: false,
      ok: false,
      hitCount: 0,
      errors: ['result.transcript and the frozen world are required for transcript leak audit'],
      proofArithmeticHits: [],
      formalSecretHits: [],
      unreleasedPremiseHits: [],
    };
  }

  const declaration = PHASE6_CONTRACT.transcriptLeakAudit;
  const tutorLines = result.transcript.filter((line) => line?.role === 'tutor');
  const ledger = Array.isArray(result.ledger) ? result.ledger : [];
  const releasedAt = new Map();
  for (const entry of ledger) {
    const turn = Number(entry?.turn);
    if (!entry?.premiseId || !Number.isSafeInteger(turn) || turn < 1) continue;
    releasedAt.set(entry.premiseId, Math.min(releasedAt.get(entry.premiseId) || Infinity, turn));
  }
  const arithmeticPatterns = declaration.proofArithmeticPatterns.map((source) => ({
    source,
    regex: new RegExp(source, 'iu'),
  }));
  const proofArithmeticHits = [];
  const formalSecretHits = [];
  const unreleasedPremiseHits = [];

  for (const line of tutorLines) {
    const text = String(line.text || '');
    const turn = Number(line.turn);
    for (const pattern of arithmeticPatterns) {
      if (pattern.regex.test(text)) proofArithmeticHits.push({ turn, pattern: pattern.source });
    }
    const secretFormat = matchingFactFormat(text, resolvedWorld.secret.fact, declaration.formalFactFormats);
    if (secretFormat) formalSecretHits.push({ turn, format: secretFormat });

    for (const premise of resolvedWorld.premises) {
      const releasedOnTurn = line.meta?.release === premise.id;
      if (releasedOnTurn || (releasedAt.get(premise.id) || Infinity) <= turn) continue;
      const exactSurface = normalizeExactText(premise.surface);
      const textNormalized = normalizeExactText(text);
      if (
        declaration.unreleasedPremiseFormats.includes('exact_surface') &&
        exactSurface &&
        textNormalized.includes(exactSurface)
      ) {
        unreleasedPremiseHits.push({ turn, premiseId: premise.id, format: 'exact_surface' });
        continue;
      }
      const formalFormats = declaration.unreleasedPremiseFormats.filter((format) => format !== 'exact_surface');
      const factFormat = matchingFactFormat(text, premise.fact, formalFormats);
      if (factFormat) unreleasedPremiseHits.push({ turn, premiseId: premise.id, format: factFormat });
    }
  }

  const hitCount = proofArithmeticHits.length + formalSecretHits.length + unreleasedPremiseHits.length;
  return {
    checked: true,
    ok: hitCount === 0,
    hitCount,
    errors: [],
    declaration: structuredClone(declaration),
    proofArithmeticHits,
    formalSecretHits,
    unreleasedPremiseHits,
  };
}

function fieldReportContextMetrics(result) {
  const rows = Array.isArray(result?.fieldReportContext) ? result.fieldReportContext : [];
  return {
    count: rows.length,
    nonLeakAuditFailures: rows.filter((row) => row.nonLeakAuditOk === false).length,
  };
}

function fieldPlannerMetrics(result, dialogueReport) {
  const rows = Array.isArray(result?.fieldPlanner) ? result.fieldPlanner : [];
  const efficacies = rows.map((row) => row.outcome?.efficacy || 'unknown');
  const selected = rows.map((row) => row.selectedMoveFamily || 'unknown');
  const alignments = rows.map((row) => row.outcome?.projectionAlignment || 'unknown');
  const scoreMargins = rows
    .map((row) => {
      const moves = row.candidateMoves || [];
      if (moves.length < 2) return null;
      return Number(moves[0].score) - Number(moves[1].score);
    })
    .filter(Number.isFinite);
  return {
    count: rows.length,
    candidateCountMismatches: rows.filter(
      (row) => (row.candidateMoves || []).length !== PHASE6_CONTRACT.thresholds.requiredCandidateCount,
    ).length,
    missingOutcomes: rows.filter((row) => !row.outcome).length,
    missingSelectedScores: rows.filter((row) => {
      const score = row.projection?.selected?.score;
      return score === null || score === undefined || score === '' || !Number.isFinite(Number(score));
    }).length,
    movementObserved: rows.filter((row) => ['movement_observed', 'closure_realized'].includes(row.outcome?.efficacy))
      .length,
    noImmediateMovement: rows.filter((row) => row.outcome?.efficacy === 'no_immediate_movement').length,
    efficacyCounts: countBy(efficacies),
    selectedCounts: countBy(selected),
    projectionAlignmentCounts: countBy(alignments),
    meanScoreMargin: round3(mean(scoreMargins)),
    nonLeakAuditFailures:
      dialogueReport?.summary?.fieldPlannerNonLeakAuditFailures ??
      rows.filter((row) => row.conductDecision?.nonLeakAuditOk === false).length,
  };
}

function rowAnalysis(row, exitCode = null) {
  const diagnosis = safeReadJson(path.join(row.runDir, 'diagnosis.json'));
  const result = safeReadJson(path.join(row.runDir, 'result.json'));
  const dialogueReport = safeReadJson(path.join(row.runDir, 'dialogue-report.json'));
  const releaseAdherence = diagnosis?.releaseAdherence || {};
  const releaseFailures =
    (releaseAdherence.deviations || []).length +
    (releaseAdherence.missed || []).length +
    (releaseAdherence.unscheduled || []).length;
  const luckyEvents =
    Number(diagnosis?.eventsByType?.lucky_leap || 0) + Number(diagnosis?.eventsByType?.lucky_leap_only || 0);
  const lucky = Math.max(luckyEvents, diagnosis?.verdict === 'lucky_leap_only' ? 1 : 0);
  const legacyLearnerFacingLeaks = Number(diagnosis?.eventsByType?.leak || 0);
  const transcriptLeakAudit = auditPhase6TutorTranscript({ worldPath: row.world, result });
  const transcriptLeakHits = transcriptLeakAudit.hitCount;
  const learnerFacingLeaks = legacyLearnerFacingLeaks + transcriptLeakHits;
  const fabricated = (diagnosis?.fabricatedFacts || []).length;
  const fieldPlanner = fieldPlannerMetrics(result, dialogueReport);
  const fieldReportContext = fieldReportContextMetrics(result);
  const releaseRows = Array.isArray(releaseAdherence.rows) ? releaseAdherence.rows : [];
  const releaseStatuses = countBy(releaseRows.map((release) => release.status));
  const invalidReleaseClaims = Number(diagnosis?.releaseDeviations?.invalidClaims || 0);
  const overreaches = Number(diagnosis?.eventsByType?.overreach || 0);
  const hardSafetyFailures =
    lucky +
    learnerFacingLeaks +
    fabricated +
    Number(fieldPlanner.nonLeakAuditFailures || 0) +
    Number(fieldReportContext.nonLeakAuditFailures || 0) +
    Number(releaseStatuses.missed || 0) +
    Number(releaseStatuses.wrong_via || 0) +
    (releaseAdherence.unscheduled || []).length +
    invalidReleaseClaims;
  const safetyFailures =
    releaseFailures +
    lucky +
    learnerFacingLeaks +
    fabricated +
    Number(fieldPlanner.nonLeakAuditFailures || 0) +
    Number(fieldReportContext.nonLeakAuditFailures || 0);
  const artifactComplete = artifactsComplete(row);
  const parsedArtifactsComplete = Boolean(diagnosis) && Boolean(result) && Boolean(dialogueReport);
  return {
    ...row,
    relRunDir: rel(row.runDir),
    relLogFile: rel(row.logFile),
    exitCode,
    artifactComplete,
    ok: exitCode === 0 && artifactComplete && parsedArtifactsComplete && transcriptLeakAudit.checked,
    verdict: diagnosis?.verdict || null,
    grounded: diagnosis?.verdict === 'grounded_anagnorisis',
    turnsPlayed: diagnosis?.turnsPlayed ?? null,
    turnCap: diagnosis?.turnCap ?? null,
    firstForcedTurn: diagnosis?.firstForcedTurn ?? null,
    assertedGroundedTurn: diagnosis?.assertedGroundedTurn ?? null,
    forcedToAssertedGap: diagnosis?.forcedToAssertedGap ?? null,
    releaseAdherence: {
      onCue: releaseAdherence.onCue ?? null,
      total: releaseAdherence.rows?.length ?? null,
      deviations: (releaseAdherence.deviations || []).length,
      missed: (releaseAdherence.missed || []).length,
      unscheduled: (releaseAdherence.unscheduled || []).length,
    },
    eventsByType: diagnosis?.eventsByType || {},
    luckyLeapSignals: lucky,
    learnerFacingLeaks,
    legacyLearnerFacingLeaks,
    transcriptLeakAudit,
    fabricatedFacts: fabricated,
    fieldPlanner,
    fieldReportContext,
    decay: diagnosis?.corruption
      ? {
          events: Number(diagnosis.corruption.decayEvents || 0),
          degradedTurnIntegral: Number(diagnosis.corruption.degradedTurnIntegral || 0),
        }
      : { events: 0, degradedTurnIntegral: 0 },
    conductPolicy: {
      loggedTurns: Number(diagnosis?.conductPolicyReport?.loggedTurns || 0),
      complianceChecked: Number(diagnosis?.conductPolicyReport?.compliance?.checked || 0),
      complianceFailed: Number(diagnosis?.conductPolicyReport?.compliance?.failed || 0),
      enforcementChanged: Number(diagnosis?.conductPolicyReport?.enforcement?.changed || 0),
    },
    safety: {
      hardFailures: hardSafetyFailures,
      overreaches,
      earlyLateReleases: Number(releaseStatuses.early || 0) + Number(releaseStatuses.late || 0),
      reachableReleases: releaseRows.filter((release) => release.status !== 'unreached').length,
      invalidReleaseClaims,
      transcriptLeakHits,
    },
    backend: diagnosis?.backend || null,
    usage: diagnosis?.usage
      ? {
          calls: diagnosis.usage.calls,
          costUSD: diagnosis.usage.costUSD,
        }
      : null,
    safetyFailures,
    executionFailures: exitCode ? 1 : 0,
  };
}

function normalizedRelative(root, file) {
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Phase 6 row artifact escapes its evidence directory: ${file}`);
  }
  return relative.split(path.sep).join('/');
}

function walkRowFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Phase 6 row artifacts may not contain symlinks: ${file}`);
      if (entry.isDirectory()) stack.push(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  return files.sort();
}

function phase6RowArtifactFiles(row) {
  const files = walkRowFiles(row.runDir);
  if (fs.existsSync(row.logFile) && !files.includes(row.logFile)) files.push(row.logFile);
  return files.sort();
}

function fsyncFile(file) {
  const handle = fs.openSync(file, 'r');
  try {
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
}

function fsyncDirectory(directory) {
  const handle = fs.openSync(directory, 'r');
  try {
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
}

function phase6RowArtifactInventory(row, gateDir, { fsync = false } = {}) {
  const files = phase6RowArtifactFiles(row);
  if (fsync) {
    files.forEach(fsyncFile);
    [...new Set(files.map((file) => path.dirname(file)))]
      .sort((left, right) => right.length - left.length)
      .forEach(fsyncDirectory);
  }
  return files.map((file) => {
    const stat = fs.statSync(file);
    return {
      path: normalizedRelative(gateDir, file),
      sha256: hashFile(file),
      bytes: stat.size,
    };
  });
}

function phase6RowConfiguration(row) {
  return {
    id: row.id,
    worldKey: row.worldKey,
    world: row.world,
    script: row.script,
    armKey: row.armKey,
    armLabel: row.armLabel,
    seed: String(row.seed),
    mode: row.mode,
    decay: structuredClone(row.decay),
    args: structuredClone(row.args),
  };
}

function assertPhase6RowArtifactSemantics(row, plan) {
  const diagnosis = readJson(path.join(row.runDir, 'diagnosis.json'));
  const expectedRuntime = plan.metadata?.phase6ModelRuntime || {};
  const observedRoles = diagnosis.backend?.roles || {};
  const expectedRoleNames = ['director', 'learner', 'tutor'];
  if (
    diagnosis.label !== row.label ||
    diagnosis.worldPath !== row.world ||
    diagnosis.scriptPath !== row.script ||
    diagnosis.backend?.mode !== row.mode ||
    hashCanonicalJson(Object.keys(observedRoles).sort()) !== hashCanonicalJson(expectedRoleNames) ||
    expectedRoleNames.some(
      (role) =>
        modelLabel(observedRoles[role] || {}) !== expectedRuntime[role]?.resolved_model_ref ||
        expectedRuntime[role]?.requested_model_ref !== plan.models?.[role]?.requested,
    ) ||
    hashCanonicalJson(diagnosis.decay) !== hashCanonicalJson(row.decay) ||
    Boolean(diagnosis.fieldReportContext) !== (row.armKey === 'field_report_only') ||
    Boolean(diagnosis.fieldPlanner) !== row.armKey.startsWith('field_planner') ||
    Boolean(diagnosis.fieldPlannerEnforce) !== (row.armKey === 'field_planner_enforce')
  ) {
    throw new Error(`Phase 6 row ${row.id} artifacts do not match the frozen row/model semantics; use a superseding label`);
  }
}

function buildPhase6RowCompletion(row, { gateDir, plan, fsync = false } = {}) {
  if (!fs.existsSync(row.logFile)) {
    throw new Error(`Phase 6 row ${row.id} is missing its execution log; use a superseding label`);
  }
  const analysis = rowAnalysis(row, 0);
  if (!analysis.ok) {
    throw new Error(`Phase 6 row ${row.id} failed semantic validation after exit 0; use a superseding label`);
  }
  assertPhase6RowArtifactSemantics(row, plan);
  const artifacts = phase6RowArtifactInventory(row, gateDir, { fsync });
  const semantic = phase6EvidenceRow(analysis);
  const completion = {
    schema: PHASE6_ROW_COMPLETION_SCHEMA,
    job_id: row.id,
    exit_code: 0,
    run_plan_sha256: hashFile(path.join(gateDir, 'run-plan.json')),
    run_id: plan.runId,
    git_sha: plan.provenance?.git?.sha || null,
    row_configuration_sha256: hashCanonicalJson(phase6RowConfiguration(row)),
    world_sha256: hashFile(resolveFromRoot(row.world)),
    script_sha256: hashFile(resolveFromRoot(row.script)),
    model_runtime_sha256: plan.metadata?.phase6ModelRuntimeSha256 || null,
    artifact_inventory_sha256: hashCanonicalJson(artifacts),
    artifacts,
    semantic_sha256: hashCanonicalJson(semantic),
    semantic,
  };
  return { completion, analysis };
}

export function commitPhase6Row(row, { gateDir, plan } = {}) {
  const events = readRunEvents(gateDir);
  if (events.some((event) => event.type === 'phase6_row_committed' && event.jobId === row.id)) {
    throw new Error(`Phase 6 row ${row.id} already has an immutable completion record`);
  }
  const { completion, analysis } = buildPhase6RowCompletion(row, { gateDir, plan, fsync: true });
  const completionSha256 = hashCanonicalJson(completion);
  const appended = appendRunEvent(gateDir, {
    type: 'phase6_row_committed',
    jobId: row.id,
    completion,
    completionSha256,
  });
  fsyncDirectory(gateDir);
  return { ...appended, completion, completionSha256, analysis };
}

function assertPhase6EventChain(events) {
  let previous = null;
  for (const [index, event] of events.entries()) {
    const payload = { ...event };
    delete payload.eventSha256;
    if (
      event.schema !== 'machinespirits.experiment-run-event.v1' ||
      Number(event.sequence) !== index + 1 ||
      event.previousEventSha256 !== previous ||
      event.eventSha256 !== hashCanonicalJson(payload)
    ) {
      throw new Error('Phase 6 run-event chain is invalid or tampered; use a superseding label');
    }
    previous = event.eventSha256;
  }
}

export function inspectPhase6RowResumeState(row, { gateDir, plan, events = null } = {}) {
  const runEvents = events || readRunEvents(gateDir);
  assertPhase6EventChain(runEvents);
  const rowEvents = runEvents.filter((event) => event.jobId === row.id);
  const commits = rowEvents.filter((event) => event.type === 'phase6_row_committed');
  const presentFiles = phase6RowArtifactFiles(row);
  if (!commits.length) {
    if (presentFiles.length || rowEvents.length) {
      throw new Error(
        `Phase 6 row ${row.id} is partial or present without a durable completion event; use a superseding label`,
      );
    }
    return { disposition: 'run_missing', rowId: row.id };
  }
  if (commits.length !== 1) {
    throw new Error(`Phase 6 row ${row.id} has duplicate completion events; use a superseding label`);
  }
  const commit = commits[0];
  const started = rowEvents.filter((event) => event.type === 'job_started');
  const completed = rowEvents.filter((event) => event.type === 'job_completed');
  if (
    started.length !== 1 ||
    completed.length !== 1 ||
    Number(completed[0].exitCode) !== 0 ||
    started[0].sequence >= completed[0].sequence ||
    completed[0].sequence >= commit.sequence
  ) {
    throw new Error(`Phase 6 row ${row.id} has an invalid execution/completion lifecycle; use a superseding label`);
  }
  const current = buildPhase6RowCompletion(row, { gateDir, plan, fsync: false });
  if (
    commit.completionSha256 !== hashCanonicalJson(commit.completion) ||
    hashCanonicalJson(commit.completion) !== hashCanonicalJson(current.completion)
  ) {
    throw new Error(`Phase 6 row ${row.id} artifacts, provenance, or semantics changed; use a superseding label`);
  }
  return {
    disposition: 'skip_verified',
    rowId: row.id,
    completionEventSha256: commit.eventSha256,
    completionSha256: commit.completionSha256,
    analysis: current.analysis,
  };
}

export function inspectPhase6ResumeMatrix(manifest, { plan, events = null } = {}) {
  const runEvents = events || readRunEvents(manifest.gateDir);
  const states = new Map();
  let reachedUntouchedTail = false;
  for (const row of manifest.rows) {
    const state = inspectPhase6RowResumeState(row, {
      gateDir: manifest.gateDir,
      plan,
      events: runEvents,
    });
    if (state.disposition === 'run_missing') reachedUntouchedTail = true;
    else if (reachedUntouchedTail) {
      throw new Error(
        `Phase 6 committed rows are not an exact prefix at ${row.id}; use a superseding label`,
      );
    }
    states.set(row.id, state);
  }
  return states;
}

function summarizeGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.worldKey}\t${row.armKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .map(([key, groupRows]) => {
      const [worldKey, armKey] = key.split('\t');
      const complete = groupRows.filter((row) => row.ok);
      const grounded = complete.filter((row) => row.grounded);
      const plannerTurns = complete.reduce((sum, row) => sum + row.fieldPlanner.count, 0);
      const movement = complete.reduce((sum, row) => sum + row.fieldPlanner.movementObserved, 0);
      return {
        worldKey,
        armKey,
        n: groupRows.length,
        ok: complete.length,
        grounded: grounded.length,
        groundedRate: complete.length ? grounded.length / complete.length : null,
        meanTurns: round3(mean(grounded.map((row) => row.turnsPlayed))),
        safetyFailures: groupRows.reduce((sum, row) => sum + row.safetyFailures, 0),
        releaseFailures: groupRows.reduce(
          (sum, row) =>
            sum + row.releaseAdherence.deviations + row.releaseAdherence.missed + row.releaseAdherence.unscheduled,
          0,
        ),
        fieldPlannerTurns: plannerTurns,
        fieldPlannerMovementRate: plannerTurns ? movement / plannerTurns : null,
        selectedMoveCounts: sumObjectCounts(complete.map((row) => row.fieldPlanner.selectedCounts)),
        verdicts: countBy(groupRows.map((row) => row.verdict || (row.exitCode ? `exit_${row.exitCode}` : 'missing'))),
      };
    })
    .sort((a, b) => a.worldKey.localeCompare(b.worldKey) || a.armKey.localeCompare(b.armKey));
}

export function analyzeGateArtifacts(manifest, exitCodes = {}) {
  const rows = manifest.rows.map((row) => rowAnalysis(row, exitCodes[row.id] ?? null));
  const parentRows = Array.isArray(manifest.priorProvisional?.rows)
    ? manifest.priorProvisional.rows.map(phase6EvidenceRow)
    : [];
  const evidenceRows = [...parentRows, ...rows.map(phase6EvidenceRow)];
  const groups = summarizeGroups(rows);
  const totalsByArm = summarizeGroups(
    rows.map((row) => ({
      ...row,
      worldKey: 'all',
    })),
  );
  const report = {
    schema: 'machinespirits.derivation.phase6-gate.report.v1',
    protocolId: manifest.protocolId,
    evidenceKind: manifest.evidenceKind,
    verdictEvaluatorVersion: manifest.verdictEvaluatorVersion,
    priorCanary: priorCanaryMetadata(manifest.priorCanary || manifest.priorProvisional?.priorCanary || null),
    priorProvisional: priorProvisionalMetadata(manifest.priorProvisional),
    label: manifest.label,
    generatedAt: new Date().toISOString(),
    mode: manifest.mode,
    profile: manifest.profile,
    gitSha: manifest.gitSha,
    gateDir: rel(manifest.gateDir),
    rowCount: rows.length,
    okRows: rows.filter((row) => row.ok).length,
    evidenceRowCount: evidenceRows.length,
    evidenceOkRows: evidenceRows.filter((row) => row.ok).length,
    groundedRows: rows.filter((row) => row.ok && row.grounded).length,
    safetyFailures: rows.reduce((sum, row) => sum + row.safetyFailures, 0),
    executionFailures: rows.reduce((sum, row) => sum + row.executionFailures, 0),
    rows,
    groups,
    totalsByArm,
    ...(parentRows.length ? { evidenceRows } : {}),
  };
  report.decision = evaluatePhase6Verdict(report, manifest.decisionContract || PHASE6_CONTRACT);
  return report;
}

export function phase6RunCloseoutDisposition(report = {}, { mode = 'mock' } = {}) {
  if (Number(report.okRows) === Number(report.rowCount) && Number(report.rowCount) > 0) {
    return 'seal_complete';
  }
  return mode === 'real' ? 'seal_indeterminate_same_label_forbidden' : 'pause_unsealed';
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? '-').replaceAll('|', '\\|')).join(' | ')} |`),
  ].join('\n');
}

function pct(value) {
  return value === null || value === undefined ? '-' : `${Math.round(Number(value) * 100)}%`;
}

export function renderGateMarkdown(report) {
  const lines = [];
  lines.push(`# Phase 6 Field-Planner Gate - ${report.label}`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(
    `Mode: \`${report.mode}\`; evidence: \`${report.evidenceKind}\`; profile: \`${report.profile}\`; git: \`${report.gitSha || 'unknown'}\``,
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Rows: ${report.okRows}/${report.rowCount} complete`);
  if (report.evidenceRowCount !== report.rowCount) {
    lines.push(
      `- Combined sealed evidence: ${report.evidenceOkRows}/${report.evidenceRowCount} rows (parent \`${report.priorProvisional?.parentRunId || 'missing'}\`)`,
    );
  }
  lines.push(`- Grounded: ${report.groundedRows}/${report.okRows}`);
  lines.push(`- Safety failures: ${report.safetyFailures}`);
  lines.push(`- Deterministic verdict: \`${report.decision?.verdict || 'unavailable'}\``);
  lines.push(`- Verdict reason: ${report.decision?.reason || 'unavailable'}`);
  if (report.decision?.winner) lines.push(`- Selected planner arm: \`${report.decision.winner}\``);
  lines.push('');
  lines.push('## Arm Totals');
  lines.push('');
  lines.push(
    mdTable(
      ['Arm', 'Rows', 'Grounded', 'Mean turns', 'Safety failures', 'Planner turns', 'Planner movement'],
      report.totalsByArm.map((row) => [
        row.armKey,
        `${row.ok}/${row.n}`,
        `${row.grounded}/${row.ok} (${pct(row.groundedRate)})`,
        row.meanTurns ?? '-',
        row.safetyFailures,
        row.fieldPlannerTurns,
        pct(row.fieldPlannerMovementRate),
      ]),
    ),
  );
  lines.push('');
  lines.push('## World x Arm');
  lines.push('');
  lines.push(
    mdTable(
      ['World', 'Arm', 'Rows', 'Grounded', 'Mean turns', 'Safety failures', 'Planner movement', 'Verdicts'],
      report.groups.map((row) => [
        row.worldKey,
        row.armKey,
        `${row.ok}/${row.n}`,
        `${row.grounded}/${row.ok} (${pct(row.groundedRate)})`,
        row.meanTurns ?? '-',
        row.safetyFailures,
        pct(row.fieldPlannerMovementRate),
        Object.entries(row.verdicts)
          .map(([key, count]) => `${key} x${count}`)
          .join(', '),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  lines.push(
    mdTable(
      ['Row', 'Verdict', 'Turns', 'Releases', 'Safety', 'Planner', 'Artifacts'],
      report.rows.map((row) => [
        row.id,
        row.verdict || `exit ${row.exitCode ?? '?'}`,
        row.turnsPlayed ?? '-',
        `${row.releaseAdherence.onCue ?? '-'}/${row.releaseAdherence.total ?? '-'}`,
        row.safetyFailures,
        row.fieldPlanner.count
          ? `${row.fieldPlanner.movementObserved}/${row.fieldPlanner.count} movement; ${Object.entries(
              row.fieldPlanner.selectedCounts,
            )
              .map(([key, count]) => `${key} x${count}`)
              .join(', ')}`
          : '-',
        `[dialogue](${path.relative(path.dirname(path.join(ROOT, report.gateDir, 'phase6-gate-report.md')), path.join(row.runDir, 'dialogue-report.md'))})`,
      ]),
    ),
  );
  lines.push('');
  lines.push('## Interpretation Rules');
  lines.push('');
  lines.push('- This report is an artifact reader: it does not change verdicts.');
  lines.push('- Promotion requires field-planner arms to improve outcome or efficiency without safety regressions.');
  lines.push('- Mock runs validate plumbing and trace coherence only; real runs are required for evidence claims.');
  lines.push('- The real technical canary is route-only and excluded from both evidence blocks.');
  lines.push('');
  return `${lines.join('\n')}`;
}

function renderGateHtml(report, markdown) {
  const escaped = markdown.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Phase 6 Field-Planner Gate</title>
  <style>
    body { margin: 0; padding: 28px; font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17201b; background: #f7efdd; }
    main { max-width: 1180px; margin: 0 auto; }
    pre { white-space: pre-wrap; background: #fbf6e8; border: 1px solid #d8c7a9; padding: 18px; overflow-x: auto; }
  </style>
</head>
<body><main><pre>${escaped}</pre></main></body>
</html>
`;
}

function writeReport(report) {
  const reportJson = path.join(ROOT, report.gateDir, 'phase6-gate-report.json');
  const reportMd = path.join(ROOT, report.gateDir, 'phase6-gate-report.md');
  const reportHtml = path.join(ROOT, report.gateDir, 'phase6-gate-report.html');
  const markdown = renderGateMarkdown(report);
  fs.writeFileSync(reportJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(reportMd, markdown);
  fs.writeFileSync(reportHtml, renderGateHtml(report, markdown));
  return { reportJson, reportMd, reportHtml };
}

function appendObservedModelEvents(manifest, report, plan) {
  const observations = new Map();
  for (const row of report.rows) {
    for (const [role, target] of Object.entries(row.backend?.roles || {})) {
      if (!observations.has(role)) observations.set(role, new Set());
      observations.get(role).add(modelLabel(target));
    }
  }
  const missingRoles = (plan.requiredObservedModelRoles || []).filter((role) => !observations.get(role)?.size);
  if (missingRoles.length) {
    throw new Error(`Phase 6 completed artifacts are missing runtime model provenance for ${missingRoles.join(', ')}`);
  }
  for (const [role, labels] of [...observations.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    for (const observed of [...labels].sort()) {
      appendRunEvent(manifest.gateDir, {
        type: 'model_observed',
        role,
        requested: plan.models?.[role]?.requested || null,
        resolved: plan.models?.[role]?.resolved || null,
        observed,
      });
    }
  }
}

function phase6StoppedError(message, { jobId = null, exitCode = null, signal = null } = {}) {
  const error = new Error(message);
  error.phase6JobId = jobId;
  error.phase6ExitCode = exitCode;
  error.phase6Signal = signal;
  return error;
}

function sealPhase6Indeterminate(manifest, error, exitCodes = {}) {
  appendRunEvent(manifest.gateDir, {
    type: 'run_stopped',
    status: PHASE6_INDETERMINATE_STATUS,
    sameLabelResumeAllowed: false,
    jobId: error?.phase6JobId || null,
    exitCode: error?.phase6ExitCode ?? null,
    signal: error?.phase6Signal || phase6InterruptSignal || null,
    reason: error?.message || String(error),
  });
  fsyncDirectory(manifest.gateDir);
  return createRunSeal(manifest.gateDir, {
    status: PHASE6_INDETERMINATE_STATUS,
    metadata: {
      sameLabelResumeAllowed: false,
      failedJobId: error?.phase6JobId || null,
      exitCode: error?.phase6ExitCode ?? null,
      signal: error?.phase6Signal || phase6InterruptSignal || null,
      completedExitZeroRows: Object.values(exitCodes).filter((code) => code === 0).length,
    },
  });
}

export async function runGate(
  manifest,
  {
    plan,
    concurrency,
    force = false,
    dryRun = false,
    rowRunner = runRow,
    liveGitGuard = assertLivePhase6RealRunGitState,
  } = {},
) {
  assertPhase6ForcePolicy({ mode: manifest.mode, force });
  assertPhase6ConcurrencyPolicy({ mode: manifest.mode, concurrency });
  assertPhase6RealGateProtocolReady(manifest);
  liveGitGuard(manifest, plan);
  let resumeStates = new Map();
  if (manifest.mode === 'real' && !dryRun) {
    const events = readRunEvents(manifest.gateDir);
    resumeStates = inspectPhase6ResumeMatrix(manifest, { plan, events });
  }
  appendRunEvent(manifest.gateDir, {
    type: 'run_started',
    mode: manifest.mode,
    dryRun,
    concurrency,
  });
  const exitCodes = {};
  if (dryRun) {
    const report = analyzeGateArtifacts(manifest, exitCodes);
    const written = writeReport(report);
    appendRunEvent(manifest.gateDir, {
      type: 'dry_run_preview_written',
      reports: Object.values(written).map((file) => rel(file)),
    });
    appendRunEvent(manifest.gateDir, { type: 'run_completed', status: 'dry_run' });
    const sealed = createRunSeal(manifest.gateDir, {
      status: 'dry_run',
      metadata: {
        rowCount: report.rowCount,
        safetyFailures: report.safetyFailures,
        verdict: report.decision?.verdict || null,
      },
    });
    const verification = assertExperimentRun(manifest.gateDir);
    return { manifest, report, written, sealed, verification, dryRun: true };
  }
  try {
    await pool(manifest.rows, concurrency, async (row) => {
      if (manifest.mode === 'real' && phase6InterruptSignal) {
        throw phase6StoppedError(`Phase 6 interrupted by ${phase6InterruptSignal} before ${row.id}`, {
          jobId: row.id,
          signal: phase6InterruptSignal,
        });
      }
      liveGitGuard(manifest, plan);
      const resumeState = resumeStates.get(row.id);
      if (manifest.mode === 'real' && resumeState?.disposition === 'skip_verified') {
        console.log(`  skip ${row.id} verified immutable completion`);
        exitCodes[row.id] = 0;
        appendRunEvent(manifest.gateDir, {
          type: 'job_skipped',
          jobId: row.id,
          reason: 'verified_immutable_completion',
          completionEventSha256: resumeState.completionEventSha256,
          completionSha256: resumeState.completionSha256,
        });
        return;
      }
      if (manifest.mode !== 'real' && !force && artifactsComplete(row)) {
        console.log(`  skip ${row.id} complete`);
        exitCodes[row.id] = 0;
        appendRunEvent(manifest.gateDir, { type: 'job_skipped', jobId: row.id, reason: 'artifacts_complete' });
        return;
      }
      console.log(`  run ${row.id}`);
      appendRunEvent(manifest.gateDir, { type: 'job_started', jobId: row.id });
      const code = await rowRunner(row);
      liveGitGuard(manifest, plan);
      exitCodes[row.id] = code;
      appendRunEvent(manifest.gateDir, { type: 'job_completed', jobId: row.id, exitCode: code });
      if (manifest.mode === 'real' && phase6InterruptSignal) {
        throw phase6StoppedError(`Phase 6 row ${row.id} was interrupted by ${phase6InterruptSignal}`, {
          jobId: row.id,
          exitCode: code,
          signal: phase6InterruptSignal,
        });
      }
      if (manifest.mode === 'real' && code !== 0) {
        throw phase6StoppedError(`Phase 6 row ${row.id} exited ${code}; untouched rows were not started`, {
          jobId: row.id,
          exitCode: code,
        });
      }
      if (manifest.mode === 'real') commitPhase6Row(row, { gateDir: manifest.gateDir, plan });
      console.log(`  ${code === 0 ? 'ok' : 'fail'} ${row.id}${code === 0 ? '' : ` exit ${code}`}`);
    });
  } catch (error) {
    if (manifest.mode === 'real') {
      const stopped =
        error?.phase6JobId || error?.phase6Signal
          ? error
          : phase6StoppedError(error?.message || String(error), {
              signal: phase6InterruptSignal,
            });
      sealPhase6Indeterminate(manifest, stopped, exitCodes);
      throw new Error(
        `${stopped.message}. The transaction is sealed ${PHASE6_INDETERMINATE_STATUS}; use a superseding label.`,
        { cause: stopped },
      );
    }
    throw error;
  }
  liveGitGuard(manifest, plan);
  const report = analyzeGateArtifacts(manifest, exitCodes);
  const written = writeReport(report);
  appendRunEvent(manifest.gateDir, {
    type: 'reports_written',
    reports: Object.values(written).map((file) => rel(file)),
  });
  const closeout = phase6RunCloseoutDisposition(report, { mode: manifest.mode });
  if (closeout === 'seal_indeterminate_same_label_forbidden') {
    const stopped = phase6StoppedError('Phase 6 completed execution but the committed row matrix is incomplete');
    sealPhase6Indeterminate(manifest, stopped, exitCodes);
    throw new Error(
      `Phase 6 committed row matrix is incomplete. The transaction is sealed ${PHASE6_INDETERMINATE_STATUS}; use a superseding label.`,
    );
  }
  if (closeout === 'pause_unsealed') {
    appendRunEvent(manifest.gateDir, {
      type: 'run_paused',
      status: 'incomplete',
      okRows: report.okRows,
      rowCount: report.rowCount,
      executionFailures: report.executionFailures,
    });
    return {
      manifest,
      report,
      written,
      sealed: null,
      verification: null,
      dryRun: false,
      resumable: manifest.mode !== 'real',
    };
  }
  appendObservedModelEvents(manifest, report, plan);
  const status = 'complete';
  appendRunEvent(manifest.gateDir, {
    type: 'run_completed',
    status,
    okRows: report.okRows,
    rowCount: report.rowCount,
    safetyFailures: report.safetyFailures,
    verdict: report.decision?.verdict || null,
  });
  const sealed = createRunSeal(manifest.gateDir, {
    status,
    metadata: {
      rowCount: report.rowCount,
      okRows: report.okRows,
      safetyFailures: report.safetyFailures,
      verdict: report.decision?.verdict || null,
    },
  });
  const verification = assertExperimentRun(manifest.gateDir);
  return { manifest, report, written, sealed, verification, dryRun: false };
}

async function main(argv = process.argv.slice(2)) {
  if (has(argv, 'help')) {
    console.log(usage());
    return;
  }
  const mode = has(argv, 'real') ? 'real' : arg(argv, 'mode', 'mock');
  if (!['mock', 'real'].includes(mode)) throw new Error(`--mode must be mock or real (got ${mode})`);
  assertPhase6PaidConfirmation({ mode, confirmed: has(argv, 'confirm-paid-phase6a-v2.1') });
  const forceRequested = has(argv, 'force');
  assertPhase6ForcePolicy({ mode, force: forceRequested });
  const technicalCanary = has(argv, 'technical-canary');
  if (technicalCanary && mode !== 'real') throw new Error('--technical-canary requires --mode real');
  const worlds = splitCsv(arg(argv, 'worlds', ''));
  const arms = splitCsv(arg(argv, 'arms', ''));
  const explicitSeeds = arg(argv, 'seeds', null);
  const priorCanaryPath = arg(argv, 'prior-canary', null);
  const priorPath = arg(argv, 'prior-provisional', null);
  if (technicalCanary && (worlds.length || arms.length || explicitSeeds || priorCanaryPath || priorPath)) {
    throw new Error('--technical-canary owns worlds, arms, seed 0, and has no evidence parent');
  }
  const runSeed = Number(arg(argv, 'run-seed', '20260711'));
  if (!Number.isSafeInteger(runSeed)) throw new Error('--run-seed must be a safe integer');
  const dryRunRequested = has(argv, 'dry-run');
  const priorCanary = loadPriorCanaryReport(priorCanaryPath);
  const priorProvisional = loadPriorProvisionalReport(priorPath);
  const defaultRealSeeds = priorProvisional
    ? PHASE6_CONTRACT.seedBlocks[1].join(',')
    : PHASE6_CONTRACT.seedBlocks[0].join(',');
  const manifest = buildGatePlan({
    label: arg(argv, 'label', null),
    out: arg(argv, 'out', null),
    profile: arg(argv, 'profile', 'smoke'),
    worlds,
    arms,
    seeds: splitCsv(arg(argv, 'seeds', mode === 'real' ? defaultRealSeeds : '1')),
    decayRate: Number(arg(argv, 'decay-rate', String(PHASE6_CONTRACT.decay.rate))),
    mutateShare: Number(arg(argv, 'mutate-share', String(PHASE6_CONTRACT.decay.mutateShare))),
    mode,
    technicalCanary,
    priorCanary,
    priorProvisional,
  });
  assertPhase6RealGateProtocolReady(manifest);
  const concurrency = Number(arg(argv, 'concurrency', mode === 'real' ? '1' : '4'));
  if (!Number.isSafeInteger(concurrency) || concurrency < 1)
    throw new Error('--concurrency must be a positive integer');
  assertPhase6ConcurrencyPolicy({ mode, concurrency });
  const gitFingerprint = capturePhase6GitFingerprint();
  assertPhase6RealRunGitState({ mode, gitFingerprint });
  const plan = prepareEvidenceTransaction(manifest, {
    masterSeed: runSeed,
    dryRun: dryRunRequested,
    gitFingerprint,
    concurrency,
  });
  console.log(
    `phase6 gate ${manifest.label}: ${manifest.rows.length} rows, ${manifest.worlds.length} worlds, ${manifest.arms.length} arms, mode ${manifest.mode}, concurrency ${concurrency}`,
  );
  const removeSignalHandlers = mode === 'real' && !dryRunRequested ? installPhase6SignalHandlers() : () => {};
  let outcome;
  try {
    outcome = await runGate(manifest, {
      plan,
      concurrency,
      force: forceRequested,
      dryRun: dryRunRequested,
    });
  } finally {
    removeSignalHandlers();
  }
  const { report, written, dryRun } = outcome;
  console.log(
    `${dryRun ? 'dry-run ' : ''}complete ${report.okRows}/${report.rowCount}; grounded ${report.groundedRows}/${report.okRows}; safety failures ${report.safetyFailures}`,
  );
  console.log(`report ${rel(written.reportMd)}`);
  console.log(`html   ${rel(written.reportHtml)}`);
  if (!dryRun && report.okRows !== report.rowCount) process.exitCode = 1;
  else if (!dryRun && ['negative_control', 'null_invalid_instrumentation'].includes(report.decision?.verdict))
    process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exit(1);
  });
}
