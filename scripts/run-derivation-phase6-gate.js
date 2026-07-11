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
  validateExperimentRunPlan,
} from '../services/experimentRunArtifacts.js';
import { resolveTarget } from '../services/dramaticDerivation/llmClient.js';
import { evaluatePhase6Verdict } from '../services/dramaticDerivation/phase6Verdict.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const LOOP_SCRIPT = path.join(ROOT, 'scripts', 'run-derivation-loop.js');
const FIELD_PLANNER = path.join(ROOT, 'services', 'dramaticDerivation', 'fieldPlanner.js');
const PHASE6_VERDICT_EVALUATOR = path.join(ROOT, 'services', 'dramaticDerivation', 'phase6Verdict.js');
const PHASE6_DECISION_RULES = path.join(ROOT, 'PLAN_4_0', 'PHASE_6_EVIDENCE_GATE_PLAN.md');
const PHASE6_CONTRACT_PATH = path.join(ROOT, 'config', 'drama-derivation', 'phase6-field-planner-gate-v2.json');
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
  return {
    ...structuredClone(metadata),
    rowCount: rows.length,
    rowsSha256: hashCanonicalJson(rows),
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
    reevaluated.verdict !== 'provisional_promote' ||
    reevaluated.winner !== report.decision.winner
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
    sealSha256: verification.sealSha256 || hashFile(path.join(gateDir, 'run-seal.json')),
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

function manifestMatrixBlockers(manifest) {
  const blockers = [];
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
    if (manifest.priorProvisional) blockers.push('technical canary must not declare a provisional parent');
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
    priorProvisional: priorProvisionalMetadata(manifest.priorProvisional),
    label: manifest.label,
    profile: manifest.profile,
    mode: manifest.mode,
    worlds: manifest.worlds,
    arms: manifest.arms,
    seeds: manifest.seeds,
    decay: manifest.decay,
    baseFlags: manifest.baseFlags,
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

function evidenceModels(mode) {
  return Object.fromEntries(
    ['director', 'tutor', 'learner'].map((role) => {
      const resolved = mode === 'real' ? resolveTarget(role) : { provider: 'mock', model: 'mock' };
      return [
        role,
        {
          requested: requestedTarget(role, resolved, mode),
          resolved: modelLabel(resolved),
          observed: null,
          ...(resolved.model ? {} : { allowCliDefaultResolution: true }),
        },
      ];
    }),
  );
}

export function buildEvidencePlan(manifest, { masterSeed, dryRun, gitFingerprint = null }) {
  const design = gateDesign(manifest);
  const git = gitFingerprint || capturePhase6GitFingerprint();
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
    models: evidenceModels(manifest.mode),
    requiredObservedModelRoles: dryRun ? [] : ['director', 'tutor', 'learner'],
    hashes: {
      runner: hashFile(__filename),
      analyzer: hashFile(__filename),
      policy: hashFile(FIELD_PLANNER),
      profile: hashCanonicalJson({ profile: manifest.profile, worlds: manifest.worlds, arms: manifest.arms }),
      prompt: hashFileSet(manifest.rows.map((row) => row.script)),
      world: hashFileSet(manifest.rows.map((row) => row.world)),
      config: hashCanonicalJson({
        design,
        decisionRulesSha256: hashFile(PHASE6_DECISION_RULES),
        decisionContractSha256: hashFile(PHASE6_CONTRACT_PATH),
        verdictEvaluatorSha256: hashFile(PHASE6_VERDICT_EVALUATOR),
      }),
    },
    masterSeed,
    jobs,
    lineage: { parentRunId: manifest.priorProvisional?.parentRunId || null, resumeOf: null, supersedes: [] },
    intent: {
      phase6Gate: design,
      decisionRules: path.relative(ROOT, PHASE6_DECISION_RULES),
      claimBoundary: 'Mock validates plumbing only; real runs remain bounded tests of the frozen field planner.',
    },
    metadata: {
      phase6DesignHash: hashCanonicalJson(design),
      phase6DecisionRulesSha256: hashFile(PHASE6_DECISION_RULES),
      phase6DecisionContractSha256: hashFile(PHASE6_CONTRACT_PATH),
      phase6VerdictEvaluatorSha256: hashFile(PHASE6_VERDICT_EVALUATOR),
    },
  });
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

function prepareEvidenceTransaction(manifest, { masterSeed, dryRun, gitFingerprint = null }) {
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
    if (!fs.existsSync(manifestPath)) writeCompatibilityManifest(manifest);
    appendRunEvent(manifest.gateDir, {
      type: 'run_resumed',
      mode: manifest.mode,
      dryRun,
    });
    return frozenPlan;
  }
  const plan = buildEvidencePlan(manifest, { masterSeed, dryRun, gitFingerprint });
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
  --prior-provisional <file>  Required for real seeds 6-10; sealed k=5 phase6-gate-report.json
  --run-seed <n>            Master seed for deterministic replay. Default: 20260711
  --decay-rate <n>          Mock override. Real Phase 6A is frozen at ${PHASE6_CONTRACT.decay.rate}
  --mutate-share <n>        Mock override. Real Phase 6A is frozen at ${PHASE6_CONTRACT.decay.mutateShare}
  --mode mock|real          Backend mode. Default: mock
  --real                    Alias for --mode real
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
  for (const worldKey of worldKeys) {
    for (const seed of seeds) {
      for (const armKey of armKeys) {
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
  }
  return {
    schema: 'machinespirits.derivation.phase6-gate.manifest.v1',
    protocolId: PHASE6_CONTRACT.protocolId,
    evidenceKind: technicalCanary ? 'technical_canary' : 'claim',
    verdictEvaluatorVersion: PHASE6_CONTRACT.verdictEvaluatorVersion,
    decisionContract: structuredClone(PHASE6_CONTRACT),
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

function runRow(row) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(row.logFile), { recursive: true });
    const log = fs.createWriteStream(row.logFile);
    const child = spawn(process.execPath, row.args, { cwd: ROOT, env: process.env });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('close', (code) => {
      log.end();
      resolve(code ?? 1);
    });
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

export function phase6RunCloseoutDisposition(report = {}) {
  return Number(report.okRows) === Number(report.rowCount) && Number(report.rowCount) > 0
    ? 'seal_complete'
    : 'pause_unsealed';
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

async function runGate(manifest, { plan, concurrency, force = false, dryRun = false } = {}) {
  assertPhase6ForcePolicy({ mode: manifest.mode, force });
  assertPhase6RealGateProtocolReady(manifest);
  assertLivePhase6RealRunGitState(manifest, plan);
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
  await pool(manifest.rows, concurrency, async (row) => {
    assertLivePhase6RealRunGitState(manifest, plan);
    if (!force && artifactsComplete(row)) {
      console.log(`  skip ${row.id} complete`);
      exitCodes[row.id] = 0;
      appendRunEvent(manifest.gateDir, { type: 'job_skipped', jobId: row.id, reason: 'artifacts_complete' });
      return;
    }
    console.log(`  run ${row.id}`);
    appendRunEvent(manifest.gateDir, { type: 'job_started', jobId: row.id });
    const code = await runRow(row);
    assertLivePhase6RealRunGitState(manifest, plan);
    exitCodes[row.id] = code;
    appendRunEvent(manifest.gateDir, { type: 'job_completed', jobId: row.id, exitCode: code });
    console.log(`  ${code === 0 ? 'ok' : 'fail'} ${row.id}${code === 0 ? '' : ` exit ${code}`}`);
  });
  assertLivePhase6RealRunGitState(manifest, plan);
  const report = analyzeGateArtifacts(manifest, exitCodes);
  const written = writeReport(report);
  appendRunEvent(manifest.gateDir, {
    type: 'reports_written',
    reports: Object.values(written).map((file) => rel(file)),
  });
  if (phase6RunCloseoutDisposition(report) === 'pause_unsealed') {
    appendRunEvent(manifest.gateDir, {
      type: 'run_paused',
      status: 'incomplete',
      okRows: report.okRows,
      rowCount: report.rowCount,
      executionFailures: report.executionFailures,
    });
    return { manifest, report, written, sealed: null, verification: null, dryRun: false, resumable: true };
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
  const forceRequested = has(argv, 'force');
  assertPhase6ForcePolicy({ mode, force: forceRequested });
  const technicalCanary = has(argv, 'technical-canary');
  if (technicalCanary && mode !== 'real') throw new Error('--technical-canary requires --mode real');
  const worlds = splitCsv(arg(argv, 'worlds', ''));
  const arms = splitCsv(arg(argv, 'arms', ''));
  const explicitSeeds = arg(argv, 'seeds', null);
  const priorPath = arg(argv, 'prior-provisional', null);
  if (technicalCanary && (worlds.length || arms.length || explicitSeeds || priorPath)) {
    throw new Error('--technical-canary owns worlds, arms, seed 0, and has no provisional parent');
  }
  const runSeed = Number(arg(argv, 'run-seed', '20260711'));
  if (!Number.isSafeInteger(runSeed)) throw new Error('--run-seed must be a safe integer');
  const dryRunRequested = has(argv, 'dry-run');
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
    priorProvisional,
  });
  assertPhase6RealGateProtocolReady(manifest);
  const concurrency = Number(arg(argv, 'concurrency', mode === 'real' ? '1' : '4'));
  if (!Number.isSafeInteger(concurrency) || concurrency < 1)
    throw new Error('--concurrency must be a positive integer');
  const gitFingerprint = capturePhase6GitFingerprint();
  assertPhase6RealRunGitState({ mode, gitFingerprint });
  const plan = prepareEvidenceTransaction(manifest, {
    masterSeed: runSeed,
    dryRun: dryRunRequested,
    gitFingerprint,
  });
  console.log(
    `phase6 gate ${manifest.label}: ${manifest.rows.length} rows, ${manifest.worlds.length} worlds, ${manifest.arms.length} arms, mode ${manifest.mode}, concurrency ${concurrency}`,
  );
  const { report, written, dryRun } = await runGate(manifest, {
    plan,
    concurrency,
    force: forceRequested,
    dryRun: dryRunRequested,
  });
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
