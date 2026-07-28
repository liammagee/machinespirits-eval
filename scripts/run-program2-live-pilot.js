#!/usr/bin/env node
// Program-2 Phase 5 live committee pilot — plan, zero-model gate, launcher
// (PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md).
//
// Two arms (committee | silent_control) × 2 learner profiles × 6 repeats on
// the Step 4 operational spec, single tutor family claude-code.sonnet-5.
// Mirrors scripts/run-step4-point-of-action-gate.js: a zero-model dry run
// writes the sha-pinned plan artifact. --prepare-certificate writes the exact
// paid plan without model calls and prints the certificate workflow. A paid
// launch requires --launch-approved, --expected-sha <clean HEAD>, and a fresh
// --launch-certificate. Additions: sealed-trace resume (jobs whose trace
// already contains run_end are skipped), a local Ollama preflight for the
// committee mini, one same-seed retry per failed job, and an abort after three
// consecutive failed attempts (prereg §4).

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  TUTOR_STUB_POINT_OF_ACTION_PHASE5_ARMS,
  TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
  buildTutorStubPointOfActionTurn,
} from '../services/tutorStubPointOfActionCoaching.js';
import {
  TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
  TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY,
  normalizeTutorStubEvidenceUseRubric,
} from '../services/tutorStubPublicLearnerAnalysis.js';
import { PROGRAM2_COMMITTEE_DEFAULTS, runCommitteeBattery } from '../services/program2CommitteeEngine.js';
import { loadProgram2Phase5eRows } from '../services/program2Phase5ePilotBundle.js';
import {
  evaluateProgram2LiveFutility,
  validateProgram2CertificateEvidenceBindings,
  validateProgram2LaunchCertificate,
} from '../services/program2ExperimentSafety.js';
import { STEP4_POINT_OF_ACTION_SPEC } from './run-step4-point-of-action-gate.js';
import { loadGateDecisions } from './grade-point-of-action-gate.js';
import { learnerProfilePrompt } from './tutor-stub-learner-profile-contracts.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export const PROGRAM2_LAUNCH_CERTIFICATE_GUIDE = 'docs/program2-launch-certificates.md';

function displayRootPath(file) {
  const relative = path.relative(ROOT, file);
  return relative && !relative.startsWith('..') ? relative : file;
}

function program2WorldFile(plan) {
  const candidate = path.resolve(
    ROOT,
    'config',
    'drama-derivation',
    `${String(plan?.world || '<world-id>').replaceAll('_', '-')}.yaml`,
  );
  return fs.existsSync(candidate) ? displayRootPath(candidate) : `<world-yaml-for-${plan?.world || 'plan'}>`;
}

export function formatProgram2LaunchCertificateReminder({
  planKey,
  phase,
  plan,
  planFile,
  certificateFile,
  outputRoot,
  sourceSha,
} = {}) {
  const cohortArgs =
    phase === 'cohort'
      ? [`  --pilot-bundle ${plan?.pilotBundle || '<audited-exact-pipeline-pilot-bundle.json>'} \\`]
      : [];
  const gateArgs =
    plan?.certificateGateSpec || phase === 'cohort'
      ? [`  --gate-spec-file ${plan?.certificateGateSpec || '<frozen-gates.json>'} \\`]
      : [];
  return [
    'A fresh launch certificate is required before every paid Program 2 launch.',
    'Prepare the exact plan without model/provider calls:',
    `  node scripts/run-program2-live-pilot.js --prepare-certificate --plan ${planKey} --output-dir ${displayRootPath(outputRoot)}`,
    `Exact plan: ${displayRootPath(planFile)}`,
    'Generate and review the certificate:',
    '  npm run program2:certify-launch -- \\',
    `  --plan-file ${displayRootPath(planFile)} \\`,
    `  --world-file ${program2WorldFile(plan)} \\`,
    `  --phase ${phase} \\`,
    ...cohortArgs,
    ...gateArgs,
    `  --source-sha ${sourceSha || '<clean-40-character-sha>'} \\`,
    `  --report ${displayRootPath(certificateFile)}`,
    `Then rerun the paid launcher with --launch-certificate ${displayRootPath(certificateFile)}.`,
    `Regenerate after any source, plan, world, gate, or pilot-evidence change. Guide: ${PROGRAM2_LAUNCH_CERTIFICATE_GUIDE}`,
  ].join('\n');
}

export const PHASE5_LIVE_PILOT_SPEC = Object.freeze({
  schema: 'machinespirits.tutor-stub.program2-phase5-live-pilot-plan.v1',
  preregistration: 'PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md',
  // Operational spec inherited verbatim from the frozen Step 4 gate.
  world: STEP4_POINT_OF_ACTION_SPEC.world,
  policy: STEP4_POINT_OF_ACTION_SPEC.policy,
  profiles: STEP4_POINT_OF_ACTION_SPEC.profiles,
  supportingModel: STEP4_POINT_OF_ACTION_SPEC.supportingModel,
  safetyTurns: STEP4_POINT_OF_ACTION_SPEC.safetyTurns,
  primaryHorizon: STEP4_POINT_OF_ACTION_SPEC.primaryHorizon,
  triggerWindow: STEP4_POINT_OF_ACTION_SPEC.triggerWindow,
  dagMode: STEP4_POINT_OF_ACTION_SPEC.dagMode,
  registerTemperature: STEP4_POINT_OF_ACTION_SPEC.registerTemperature,
  registerOverlayThreshold: STEP4_POINT_OF_ACTION_SPEC.registerOverlayThreshold,
  dagFactDropout: STEP4_POINT_OF_ACTION_SPEC.dagFactDropout,
  dagFactDropoutSeed: STEP4_POINT_OF_ACTION_SPEC.dagFactDropoutSeed,
  releaseSpeed: STEP4_POINT_OF_ACTION_SPEC.releaseSpeed,
  maxTokens: STEP4_POINT_OF_ACTION_SPEC.maxTokens,
  historyTurns: STEP4_POINT_OF_ACTION_SPEC.historyTurns,
  // Phase 5 pins.
  tutorFamily: 'claude-code.sonnet-5',
  arms: TUTOR_STUB_POINT_OF_ACTION_PHASE5_ARMS,
  repeats: 6,
  runSeed: 20260718,
  committeeMiniModel: PROGRAM2_COMMITTEE_DEFAULTS.miniModel,
  committeeOllamaUrl: PROGRAM2_COMMITTEE_DEFAULTS.ollamaUrl,
});

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function sha256(value) {
  const input = Buffer.isBuffer(value)
    ? value
    : typeof value === 'string'
      ? value
      : JSON.stringify(canonicalJson(value));
  return createHash('sha256').update(input).digest('hex');
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle(rows, seed) {
  const result = [...rows];
  const random = mulberry32(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function commandForJob(
  job,
  outputRoot,
  {
    runSeed = PHASE5_LIVE_PILOT_SPEC.runSeed,
    fallbackPolicy = null,
    world = PHASE5_LIVE_PILOT_SPEC.world,
    evidenceUseRubric = TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
  } = {},
) {
  const traceDir = path.join(outputRoot, 'traces', job.id);
  // Emitted only when the run departs from the default, so default plans keep
  // byte-identical commands to every plan generated before the rubric was
  // versioned.
  const evidenceUseRubricArgs =
    evidenceUseRubric === TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT
      ? []
      : ['--learner-analysis-evidence-use-rubric', evidenceUseRubric];
  return [
    process.execPath,
    'scripts/tutor-stub.js',
    '--auto-learner',
    '--auto-turns',
    'until-grounded',
    '--auto-safety-turns',
    String(PHASE5_LIVE_PILOT_SPEC.safetyTurns),
    '--model',
    PHASE5_LIVE_PILOT_SPEC.tutorFamily,
    '--classifier-model',
    PHASE5_LIVE_PILOT_SPEC.supportingModel,
    '--learner-record-model',
    PHASE5_LIVE_PILOT_SPEC.supportingModel,
    '--auto-learner-model',
    PHASE5_LIVE_PILOT_SPEC.supportingModel,
    '--auto-learner-profile',
    learnerProfilePrompt(job.profile),
    '--tutor-learner-dag',
    '--world',
    world,
    '--dag-mode',
    PHASE5_LIVE_PILOT_SPEC.dagMode,
    '--register-policy',
    PHASE5_LIVE_PILOT_SPEC.policy,
    '--register-palette',
    'all',
    '--register-temperature',
    String(PHASE5_LIVE_PILOT_SPEC.registerTemperature),
    '--register-overlay-threshold',
    String(PHASE5_LIVE_PILOT_SPEC.registerOverlayThreshold),
    '--dag-fact-dropout',
    String(PHASE5_LIVE_PILOT_SPEC.dagFactDropout),
    '--dag-fact-dropout-seed',
    String(PHASE5_LIVE_PILOT_SPEC.dagFactDropoutSeed),
    '--release-speed',
    String(PHASE5_LIVE_PILOT_SPEC.releaseSpeed),
    '--run-seed',
    String(runSeed),
    '--eval-repeat',
    String(job.repeat),
    '--eval-job-id',
    job.id,
    '--trace-dir',
    traceDir,
    '--max-tokens',
    String(PHASE5_LIVE_PILOT_SPEC.maxTokens),
    '--history-turns',
    String(PHASE5_LIVE_PILOT_SPEC.historyTurns),
    '--point-of-action-arm',
    job.arm,
    '--committee-mini-model',
    PHASE5_LIVE_PILOT_SPEC.committeeMiniModel,
    '--committee-ollama-url',
    PHASE5_LIVE_PILOT_SPEC.committeeOllamaUrl,
    ...(fallbackPolicy ? ['--committee-fallback-policy', fallbackPolicy] : []),
    ...evidenceUseRubricArgs,
    '--dag',
    '--no-stream',
    '--no-interim-animation',
    '--learner',
    `Program-2 Phase 5 ${job.profile} repeat ${job.repeat}/${PHASE5_LIVE_PILOT_SPEC.repeats}.`,
  ];
}

export function buildPhase5LivePilotPlan({
  outputRoot = 'exports/program2-live-pilot',
  evidenceUseRubric = TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
} = {}) {
  const rubric = normalizeTutorStubEvidenceUseRubric(evidenceUseRubric);
  const cells = [];
  for (let repeat = 1; repeat <= PHASE5_LIVE_PILOT_SPEC.repeats; repeat += 1) {
    for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
      for (const arm of PHASE5_LIVE_PILOT_SPEC.arms) {
        cells.push({ repeat, profile, arm });
      }
    }
  }
  const jobs = deterministicShuffle(cells, PHASE5_LIVE_PILOT_SPEC.runSeed).map((cell, index) => {
    const id = [`p5-${String(index + 1).padStart(2, '0')}`, cell.profile, cell.arm, `r${cell.repeat}`].join('-');
    const job = { ordinal: index + 1, id, tutorFamily: PHASE5_LIVE_PILOT_SPEC.tutorFamily, ...cell };
    return { ...job, command: commandForJob(job, outputRoot, { evidenceUseRubric: rubric }) };
  });
  return {
    ...PHASE5_LIVE_PILOT_SPEC,
    detectorVersion: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
    evidenceUseRubric: rubric,
    outputRoot,
    ordering: 'seeded Fisher-Yates over the complete balanced 2 x 2 x 6 matrix',
    jobs,
  };
}

// Phase 5b (PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md): 12
// committee dialogues under fallback policy v2 + 6 fresh silent controls,
// seed 20260720; everything else inherited from the Phase 5 spec.
export const PHASE5B_SPEC = Object.freeze({
  schema: 'machinespirits.tutor-stub.program2-phase5b-plan.v1',
  preregistration: 'PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md',
  runSeed: 20260720,
  committeeRepeats: 6,
  controlRepeats: 3,
  fallbackPolicy: 'v2',
});

export function buildPhase5bLivePilotPlan({
  outputRoot = 'exports/program2-live-pilot-5b',
  evidenceUseRubric = TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
} = {}) {
  const rubric = normalizeTutorStubEvidenceUseRubric(evidenceUseRubric);
  const cells = [];
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    for (let repeat = 1; repeat <= PHASE5B_SPEC.committeeRepeats; repeat += 1) {
      cells.push({ repeat, profile, arm: 'committee' });
    }
    for (let repeat = 1; repeat <= PHASE5B_SPEC.controlRepeats; repeat += 1) {
      cells.push({ repeat, profile, arm: 'silent_control' });
    }
  }
  const jobs = deterministicShuffle(cells, PHASE5B_SPEC.runSeed).map((cell, index) => {
    const id = [`p5b-${String(index + 1).padStart(2, '0')}`, cell.profile, cell.arm, `r${cell.repeat}`].join('-');
    const job = { ordinal: index + 1, id, tutorFamily: PHASE5_LIVE_PILOT_SPEC.tutorFamily, ...cell };
    return {
      ...job,
      command: commandForJob(job, outputRoot, {
        runSeed: PHASE5B_SPEC.runSeed,
        fallbackPolicy: cell.arm === 'committee' ? PHASE5B_SPEC.fallbackPolicy : null,
        evidenceUseRubric: rubric,
      }),
    };
  });
  return {
    ...PHASE5_LIVE_PILOT_SPEC,
    ...PHASE5B_SPEC,
    detectorVersion: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
    evidenceUseRubric: rubric,
    outputRoot,
    ordering: 'seeded Fisher-Yates over 12 committee-v2 + 6 silent_control cells',
    jobs,
  };
}

// Phase 5c (PROGRAM-2-PHASE5C-CROSS-WORLD-TRANSFER-PREREGISTRATION.md): the
// Phase 5b-validated committee (fallback policy v2, same artifact, same
// serving pin) moved unchanged to world_027_gazette_recall — 10 committee-v2
// + 8 fresh silent controls, seed 20260721. No pooling with Phase 5/5b
// controls (those are Marrick dialogues).
export const PHASE5C_SPEC = Object.freeze({
  schema: 'machinespirits.tutor-stub.program2-phase5c-plan.v1',
  preregistration: 'PROGRAM-2-PHASE5C-CROSS-WORLD-TRANSFER-PREREGISTRATION.md',
  runSeed: 20260721,
  world: 'world_027_gazette_recall',
  committeeRepeats: 5,
  controlRepeats: 4,
  fallbackPolicy: 'v2',
});

export function buildPhase5cLivePilotPlan({
  outputRoot = 'exports/program2-live-pilot-5c',
  evidenceUseRubric = TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
} = {}) {
  const rubric = normalizeTutorStubEvidenceUseRubric(evidenceUseRubric);
  const cells = [];
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    for (let repeat = 1; repeat <= PHASE5C_SPEC.committeeRepeats; repeat += 1) {
      cells.push({ repeat, profile, arm: 'committee' });
    }
    for (let repeat = 1; repeat <= PHASE5C_SPEC.controlRepeats; repeat += 1) {
      cells.push({ repeat, profile, arm: 'silent_control' });
    }
  }
  const jobs = deterministicShuffle(cells, PHASE5C_SPEC.runSeed).map((cell, index) => {
    const id = [`p5c-${String(index + 1).padStart(2, '0')}`, cell.profile, cell.arm, `r${cell.repeat}`].join('-');
    const job = { ordinal: index + 1, id, tutorFamily: PHASE5_LIVE_PILOT_SPEC.tutorFamily, ...cell };
    return {
      ...job,
      command: commandForJob(job, outputRoot, {
        runSeed: PHASE5C_SPEC.runSeed,
        fallbackPolicy: cell.arm === 'committee' ? PHASE5C_SPEC.fallbackPolicy : null,
        world: PHASE5C_SPEC.world,
        evidenceUseRubric: rubric,
      }),
    };
  });
  return {
    ...PHASE5_LIVE_PILOT_SPEC,
    ...PHASE5C_SPEC,
    detectorVersion: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
    evidenceUseRubric: rubric,
    outputRoot,
    ordering: 'seeded Fisher-Yates over 10 committee-v2 + 8 silent_control cells',
    jobs,
  };
}

export function validatePhase5cLivePilotPlan(plan) {
  const errors = [];
  if (plan.jobs.length !== 18) errors.push(`expected 18 jobs, found ${plan.jobs.length}`);
  const cellCounts = new Map();
  for (const job of plan.jobs) {
    const key = [job.profile, job.arm].join('|');
    cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    const policy = flagValue(job.command, '--committee-fallback-policy');
    if (job.arm === 'committee' && policy !== 'v2') errors.push(`${job.id} missing fallback policy v2`);
    if (job.arm === 'silent_control' && policy !== null) errors.push(`${job.id} control carries fallback policy`);
    if (flagValue(job.command, '--world') !== PHASE5C_SPEC.world) errors.push(`${job.id} world mismatch`);
    if (flagValue(job.command, '--run-seed') !== String(PHASE5C_SPEC.runSeed))
      errors.push(`${job.id} run-seed mismatch`);
    if (flagValue(job.command, '--model') !== PHASE5_LIVE_PILOT_SPEC.tutorFamily)
      errors.push(`${job.id} tutor-family mismatch`);
    for (const flag of ['--classifier-model', '--learner-record-model', '--auto-learner-model']) {
      if (flagValue(job.command, flag) !== PHASE5_LIVE_PILOT_SPEC.supportingModel) {
        errors.push(`${job.id} changed fixed supporting seam ${flag}`);
      }
    }
  }
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    if (cellCounts.get(`${profile}|committee`) !== PHASE5C_SPEC.committeeRepeats)
      errors.push(`${profile} committee cell count mismatch`);
    if (cellCounts.get(`${profile}|silent_control`) !== PHASE5C_SPEC.controlRepeats)
      errors.push(`${profile} control cell count mismatch`);
  }
  errors.push(...evidenceUseRubricErrors(plan));
  return { ok: errors.length === 0, errors, jobCount: plan.jobs.length, balancedCellCount: cellCounts.size };
}

// Phase 5e (PROGRAM-2-PHASE5E-SECOND-TRANSFER-PREREGISTRATION.md): the
// Phase 5b/5c-validated committee moved unchanged to the mechanically selected
// letter-hostile world_026_skyway_bakery — 10 committee-v2 + 8 fresh silent
// controls, seed 20260726. No pooling with controls from any earlier world.
export const PHASE5E_SPEC = Object.freeze({
  schema: 'machinespirits.tutor-stub.program2-phase5e-r2-plan.v1',
  preregistration: 'PROGRAM-2-PHASE5E-SECOND-TRANSFER-PREREGISTRATION.md',
  worldSelectionEvidence: 'config/adaptive-tutor-evidence/program-2-phase5e-world-selection-amendment1.json',
  certificateGateSpec: 'config/adaptive-tutor-evidence/program-2-phase5e-r2-gates.json',
  pilotBundle: 'exports/program2-live-pilot-5e-r2-pilot/pilot-bundle.json',
  replicationOfLaunchSha: '470889d5ed786d7f5b24ceb4bfb9121e544ab564',
  runSeed: 20260726,
  world: 'world_026_skyway_bakery',
  committeeRepeats: 5,
  controlRepeats: 4,
  fallbackPolicy: 'v2',
  evidenceUseRubric: TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY,
});

export const PHASE5E_PILOT_SPEC = Object.freeze({
  schema: 'machinespirits.tutor-stub.program2-phase5e-r2-pilot-plan.v1',
  preregistration: PHASE5E_SPEC.preregistration,
  runSeed: PHASE5E_SPEC.runSeed,
  world: PHASE5E_SPEC.world,
  repeats: 1,
  fallbackPolicy: PHASE5E_SPEC.fallbackPolicy,
  evidenceUseRubric: PHASE5E_SPEC.evidenceUseRubric,
  cohortSchema: PHASE5E_SPEC.schema,
  certificateGateSpec: 'config/adaptive-tutor-evidence/program-2-phase5e-r2-pilot-gates.json',
});

export function buildPhase5eLivePilotPlan({
  outputRoot = 'exports/program2-live-pilot-5e-r2',
  evidenceUseRubric = PHASE5E_SPEC.evidenceUseRubric,
} = {}) {
  const rubric = normalizeTutorStubEvidenceUseRubric(evidenceUseRubric);
  if (rubric !== PHASE5E_SPEC.evidenceUseRubric) {
    throw new Error(`Phase 5e r2 pins evidence_use rubric ${PHASE5E_SPEC.evidenceUseRubric}`);
  }
  const cells = [];
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    for (let repeat = 1; repeat <= PHASE5E_SPEC.committeeRepeats; repeat += 1) {
      cells.push({ repeat, profile, arm: 'committee' });
    }
    for (let repeat = 1; repeat <= PHASE5E_SPEC.controlRepeats; repeat += 1) {
      cells.push({ repeat, profile, arm: 'silent_control' });
    }
  }
  const jobs = deterministicShuffle(cells, PHASE5E_SPEC.runSeed).map((cell, index) => {
    const id = [`p5e-r2-${String(index + 1).padStart(2, '0')}`, cell.profile, cell.arm, `r${cell.repeat}`].join('-');
    const job = { ordinal: index + 1, id, tutorFamily: PHASE5_LIVE_PILOT_SPEC.tutorFamily, ...cell };
    return {
      ...job,
      command: commandForJob(job, outputRoot, {
        runSeed: PHASE5E_SPEC.runSeed,
        fallbackPolicy: cell.arm === 'committee' ? PHASE5E_SPEC.fallbackPolicy : null,
        world: PHASE5E_SPEC.world,
        evidenceUseRubric: rubric,
      }),
    };
  });
  return {
    ...PHASE5_LIVE_PILOT_SPEC,
    ...PHASE5E_SPEC,
    detectorVersion: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
    evidenceUseRubric: rubric,
    outputRoot,
    ordering: 'seeded Fisher-Yates over 10 committee-v2 + 8 silent_control cells',
    jobs,
  };
}

export function validatePhase5eLivePilotPlan(plan) {
  const errors = [];
  if (plan.jobs.length !== 18) errors.push(`expected 18 jobs, found ${plan.jobs.length}`);
  const cellCounts = new Map();
  for (const job of plan.jobs) {
    const key = [job.profile, job.arm].join('|');
    cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    const policy = flagValue(job.command, '--committee-fallback-policy');
    if (job.arm === 'committee' && policy !== PHASE5E_SPEC.fallbackPolicy) {
      errors.push(`${job.id} missing fallback policy ${PHASE5E_SPEC.fallbackPolicy}`);
    }
    if (job.arm === 'silent_control' && policy !== null) errors.push(`${job.id} control carries fallback policy`);
    if (flagValue(job.command, '--world') !== PHASE5E_SPEC.world) errors.push(`${job.id} world mismatch`);
    if (flagValue(job.command, '--run-seed') !== String(PHASE5E_SPEC.runSeed)) {
      errors.push(`${job.id} run-seed mismatch`);
    }
    if (flagValue(job.command, '--model') !== PHASE5_LIVE_PILOT_SPEC.tutorFamily) {
      errors.push(`${job.id} tutor-family mismatch`);
    }
    for (const flag of ['--classifier-model', '--learner-record-model', '--auto-learner-model']) {
      if (flagValue(job.command, flag) !== PHASE5_LIVE_PILOT_SPEC.supportingModel) {
        errors.push(`${job.id} changed fixed supporting seam ${flag}`);
      }
    }
  }
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    if (cellCounts.get(`${profile}|committee`) !== PHASE5E_SPEC.committeeRepeats) {
      errors.push(`${profile} committee cell count mismatch`);
    }
    if (cellCounts.get(`${profile}|silent_control`) !== PHASE5E_SPEC.controlRepeats) {
      errors.push(`${profile} control cell count mismatch`);
    }
  }
  if (plan.evidenceUseRubric !== PHASE5E_SPEC.evidenceUseRubric) {
    errors.push(`Phase 5e r2 must stamp evidence_use rubric ${PHASE5E_SPEC.evidenceUseRubric}`);
  }
  errors.push(...evidenceUseRubricErrors(plan));
  return { ok: errors.length === 0, errors, jobCount: plan.jobs.length, balancedCellCount: cellCounts.size };
}

export function buildPhase5eR2ExactPipelinePilotPlan({
  outputRoot = 'exports/program2-live-pilot-5e-r2-pilot',
  evidenceUseRubric = PHASE5E_PILOT_SPEC.evidenceUseRubric,
} = {}) {
  const rubric = normalizeTutorStubEvidenceUseRubric(evidenceUseRubric);
  if (rubric !== PHASE5E_PILOT_SPEC.evidenceUseRubric) {
    throw new Error(`Phase 5e r2 pilot pins evidence_use rubric ${PHASE5E_PILOT_SPEC.evidenceUseRubric}`);
  }
  const cells = PHASE5_LIVE_PILOT_SPEC.profiles.flatMap((profile) =>
    PHASE5_LIVE_PILOT_SPEC.arms.map((arm) => ({ repeat: 1, profile, arm })),
  );
  const jobs = deterministicShuffle(cells, PHASE5E_PILOT_SPEC.runSeed).map((cell, index) => {
    const id = [`p5e-r2-pilot-${String(index + 1).padStart(2, '0')}`, cell.profile, cell.arm].join('-');
    const job = { ordinal: index + 1, id, tutorFamily: PHASE5_LIVE_PILOT_SPEC.tutorFamily, ...cell };
    return {
      ...job,
      command: commandForJob(job, outputRoot, {
        runSeed: PHASE5E_PILOT_SPEC.runSeed,
        fallbackPolicy: cell.arm === 'committee' ? PHASE5E_PILOT_SPEC.fallbackPolicy : null,
        world: PHASE5E_PILOT_SPEC.world,
        evidenceUseRubric: rubric,
      }),
    };
  });
  return {
    ...PHASE5_LIVE_PILOT_SPEC,
    ...PHASE5E_PILOT_SPEC,
    detectorVersion: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
    evidenceUseRubric: rubric,
    outputRoot,
    ordering: 'seeded Fisher-Yates over one exact-pipeline row per profile x arm cell',
    jobs,
  };
}

export function validatePhase5eR2ExactPipelinePilotPlan(plan) {
  const errors = [];
  if (plan.jobs.length !== 4) errors.push(`expected 4 jobs, found ${plan.jobs.length}`);
  const cellCounts = new Map();
  for (const job of plan.jobs) {
    const key = [job.profile, job.arm].join('|');
    cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    const policy = flagValue(job.command, '--committee-fallback-policy');
    if (job.arm === 'committee' && policy !== PHASE5E_PILOT_SPEC.fallbackPolicy) {
      errors.push(`${job.id} missing fallback policy ${PHASE5E_PILOT_SPEC.fallbackPolicy}`);
    }
    if (job.arm === 'silent_control' && policy !== null) errors.push(`${job.id} control carries fallback policy`);
    if (flagValue(job.command, '--world') !== PHASE5E_PILOT_SPEC.world) errors.push(`${job.id} world mismatch`);
    if (flagValue(job.command, '--run-seed') !== String(PHASE5E_PILOT_SPEC.runSeed)) {
      errors.push(`${job.id} run-seed mismatch`);
    }
    if (flagValue(job.command, '--model') !== PHASE5_LIVE_PILOT_SPEC.tutorFamily) {
      errors.push(`${job.id} tutor-family mismatch`);
    }
    for (const flag of ['--classifier-model', '--learner-record-model', '--auto-learner-model']) {
      if (flagValue(job.command, flag) !== PHASE5_LIVE_PILOT_SPEC.supportingModel) {
        errors.push(`${job.id} changed fixed supporting seam ${flag}`);
      }
    }
  }
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    for (const arm of PHASE5_LIVE_PILOT_SPEC.arms) {
      if (cellCounts.get(`${profile}|${arm}`) !== 1) errors.push(`${profile}|${arm} pilot cell count mismatch`);
    }
  }
  if (plan.evidenceUseRubric !== PHASE5E_PILOT_SPEC.evidenceUseRubric) {
    errors.push(`Phase 5e r2 pilot must stamp evidence_use rubric ${PHASE5E_PILOT_SPEC.evidenceUseRubric}`);
  }
  errors.push(...evidenceUseRubricErrors(plan));
  return { ok: errors.length === 0, errors, jobCount: plan.jobs.length, balancedCellCount: cellCounts.size };
}

// Phase 5f is the first post-apparatus-hardening transfer check. Its pilot
// uses a world that predates the repairs but postdates the Program-2 training
// and original experimental freeze. The four exact-pipeline rows are a
// feasibility gate only; an 18-dialogue cohort remains separately gated.
export const PHASE5F_PILOT_SPEC = Object.freeze({
  schema: 'machinespirits.tutor-stub.program2-phase5f-pilot-plan.v1',
  preregistration: 'PROGRAM-2-PHASE5F-FRESH-TRANSFER-PREREGISTRATION.md',
  worldSelectionEvidence: 'config/adaptive-tutor-evidence/program-2-phase5f-world-selection.json',
  certificateGateSpec: 'config/adaptive-tutor-evidence/program-2-phase5f-pilot-gates.json',
  runSeed: 20260728,
  world: 'world_031_tideway_makerspace',
  repeats: 1,
  fallbackPolicy: 'v2',
  evidenceUseRubric: TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY,
  futureCohortSchema: 'machinespirits.tutor-stub.program2-phase5f-plan.v1',
});

export const PHASE5F_PILOT_A2_SPEC = Object.freeze({
  ...PHASE5F_PILOT_SPEC,
  schema: 'machinespirits.tutor-stub.program2-phase5f-pilot-a2-plan.v1',
  replacementOf: 'exports/program2-live-pilot-5f-pilot/launch-plan.json',
});

export const PHASE5F_PILOT_A3_SPEC = Object.freeze({
  ...PHASE5F_PILOT_SPEC,
  schema: 'machinespirits.tutor-stub.program2-phase5f-pilot-a3-plan.v1',
  replacementOf: 'exports/program2-live-pilot-5f-pilot-a2/launch-plan.json',
});

function buildPhase5fPilotPlan({ outputRoot, evidenceUseRubric, spec, idPrefix }) {
  const rubric = normalizeTutorStubEvidenceUseRubric(evidenceUseRubric);
  if (rubric !== spec.evidenceUseRubric) {
    throw new Error(`Phase 5f pilot pins evidence_use rubric ${spec.evidenceUseRubric}`);
  }
  const cells = PHASE5_LIVE_PILOT_SPEC.profiles.flatMap((profile) =>
    PHASE5_LIVE_PILOT_SPEC.arms.map((arm) => ({ repeat: 1, profile, arm })),
  );
  const jobs = deterministicShuffle(cells, spec.runSeed).map((cell, index) => {
    const id = [`${idPrefix}-${String(index + 1).padStart(2, '0')}`, cell.profile, cell.arm].join('-');
    const job = { ordinal: index + 1, id, tutorFamily: PHASE5_LIVE_PILOT_SPEC.tutorFamily, ...cell };
    return {
      ...job,
      command: commandForJob(job, outputRoot, {
        runSeed: spec.runSeed,
        fallbackPolicy: cell.arm === 'committee' ? spec.fallbackPolicy : null,
        world: spec.world,
        evidenceUseRubric: rubric,
      }),
    };
  });
  return {
    ...PHASE5_LIVE_PILOT_SPEC,
    ...spec,
    detectorVersion: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
    evidenceUseRubric: rubric,
    outputRoot,
    ordering: 'seeded Fisher-Yates over one fresh-world exact-pipeline row per profile x arm cell',
    jobs,
  };
}

export function buildPhase5fExactPipelinePilotPlan({
  outputRoot = 'exports/program2-live-pilot-5f-pilot',
  evidenceUseRubric = PHASE5F_PILOT_SPEC.evidenceUseRubric,
} = {}) {
  return buildPhase5fPilotPlan({
    outputRoot,
    evidenceUseRubric,
    spec: PHASE5F_PILOT_SPEC,
    idPrefix: 'p5f-pilot',
  });
}

export function buildPhase5fA2ExactPipelinePilotPlan({
  outputRoot = 'exports/program2-live-pilot-5f-pilot-a2',
  evidenceUseRubric = PHASE5F_PILOT_A2_SPEC.evidenceUseRubric,
} = {}) {
  return buildPhase5fPilotPlan({
    outputRoot,
    evidenceUseRubric,
    spec: PHASE5F_PILOT_A2_SPEC,
    idPrefix: 'p5f-pilot-a2',
  });
}

export function buildPhase5fA3ExactPipelinePilotPlan({
  outputRoot = 'exports/program2-live-pilot-5f-pilot-a3',
  evidenceUseRubric = PHASE5F_PILOT_A3_SPEC.evidenceUseRubric,
} = {}) {
  return buildPhase5fPilotPlan({
    outputRoot,
    evidenceUseRubric,
    spec: PHASE5F_PILOT_A3_SPEC,
    idPrefix: 'p5f-pilot-a3',
  });
}

function validatePhase5fPilotPlan(plan, spec) {
  const errors = [];
  if (plan.jobs.length !== 4) errors.push(`expected 4 jobs, found ${plan.jobs.length}`);
  const cellCounts = new Map();
  for (const job of plan.jobs) {
    const key = [job.profile, job.arm].join('|');
    cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    const policy = flagValue(job.command, '--committee-fallback-policy');
    if (job.arm === 'committee' && policy !== spec.fallbackPolicy) {
      errors.push(`${job.id} missing fallback policy ${spec.fallbackPolicy}`);
    }
    if (job.arm === 'silent_control' && policy !== null) errors.push(`${job.id} control carries fallback policy`);
    if (flagValue(job.command, '--world') !== spec.world) errors.push(`${job.id} world mismatch`);
    if (flagValue(job.command, '--run-seed') !== String(spec.runSeed)) {
      errors.push(`${job.id} run-seed mismatch`);
    }
    if (flagValue(job.command, '--model') !== PHASE5_LIVE_PILOT_SPEC.tutorFamily) {
      errors.push(`${job.id} tutor-family mismatch`);
    }
    for (const flag of ['--classifier-model', '--learner-record-model', '--auto-learner-model']) {
      if (flagValue(job.command, flag) !== PHASE5_LIVE_PILOT_SPEC.supportingModel) {
        errors.push(`${job.id} changed fixed supporting seam ${flag}`);
      }
    }
  }
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    for (const arm of PHASE5_LIVE_PILOT_SPEC.arms) {
      if (cellCounts.get(`${profile}|${arm}`) !== 1) errors.push(`${profile}|${arm} pilot cell count mismatch`);
    }
  }
  if (plan.evidenceUseRubric !== spec.evidenceUseRubric) {
    errors.push(`Phase 5f pilot must stamp evidence_use rubric ${spec.evidenceUseRubric}`);
  }
  errors.push(...evidenceUseRubricErrors(plan));
  return { ok: errors.length === 0, errors, jobCount: plan.jobs.length, balancedCellCount: cellCounts.size };
}

export function validatePhase5fExactPipelinePilotPlan(plan) {
  return validatePhase5fPilotPlan(plan, PHASE5F_PILOT_SPEC);
}

export function validatePhase5fA2ExactPipelinePilotPlan(plan) {
  return validatePhase5fPilotPlan(plan, PHASE5F_PILOT_A2_SPEC);
}

export function validatePhase5fA3ExactPipelinePilotPlan(plan) {
  return validatePhase5fPilotPlan(plan, PHASE5F_PILOT_A3_SPEC);
}

export function validatePhase5bLivePilotPlan(plan) {
  const errors = [];
  if (plan.jobs.length !== 18) errors.push(`expected 18 jobs, found ${plan.jobs.length}`);
  const cellCounts = new Map();
  for (const job of plan.jobs) {
    const key = [job.profile, job.arm].join('|');
    cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    const policy = flagValue(job.command, '--committee-fallback-policy');
    if (job.arm === 'committee' && policy !== 'v2') errors.push(`${job.id} missing fallback policy v2`);
    if (job.arm === 'silent_control' && policy !== null) errors.push(`${job.id} control carries fallback policy`);
    if (flagValue(job.command, '--run-seed') !== String(PHASE5B_SPEC.runSeed))
      errors.push(`${job.id} run-seed mismatch`);
    if (flagValue(job.command, '--model') !== PHASE5_LIVE_PILOT_SPEC.tutorFamily)
      errors.push(`${job.id} tutor-family mismatch`);
  }
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    if (cellCounts.get(`${profile}|committee`) !== PHASE5B_SPEC.committeeRepeats)
      errors.push(`${profile} committee cell count mismatch`);
    if (cellCounts.get(`${profile}|silent_control`) !== PHASE5B_SPEC.controlRepeats)
      errors.push(`${profile} control cell count mismatch`);
  }
  errors.push(...evidenceUseRubricErrors(plan));
  return { ok: errors.length === 0, errors, jobCount: plan.jobs.length, balancedCellCount: cellCounts.size };
}

function flagValue(command, flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
}

// A plan header that stamps one evidence_use rubric while its jobs run another
// is the failure this stamp exists to prevent, so every validator checks it.
function evidenceUseRubricErrors(plan) {
  const errors = [];
  // A plan file written before the rubric was versioned carries no stamp, and
  // every run from that era used v1. Resolving an absent stamp against the
  // *current* default would silently reinterpret those files now that the
  // default is v2, so unstamped plans pin to v1 and then fail the check below on
  // purpose: re-running one has to name its rubric explicitly.
  const stamped = plan.evidenceUseRubric ?? TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY;
  // A job omits the flag exactly when its rubric is the generation-time default,
  // so the expected token is derived from the stamp rather than compared against
  // a constant.
  const expected = stamped === TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT ? null : stamped;
  for (const job of plan.jobs) {
    const flagged = flagValue(job.command, '--learner-analysis-evidence-use-rubric');
    if (flagged === expected) continue;
    errors.push(
      plan.evidenceUseRubric
        ? `${job.id} evidence_use rubric ${flagged ?? '(default)'} does not match plan stamp ${stamped}`
        : `${job.id} plan predates evidence_use rubric versioning and carries no stamp; name --learner-analysis-evidence-use-rubric ${TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY} to reproduce it`,
    );
  }
  return errors;
}

export function validatePhase5LivePilotPlan(plan) {
  const errors = [];
  if (plan.jobs.length !== 24) errors.push(`expected 24 jobs, found ${plan.jobs.length}`);
  const cellCounts = new Map();
  for (const job of plan.jobs) {
    const key = [job.profile, job.arm].join('|');
    cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    for (const flag of ['--classifier-model', '--learner-record-model', '--auto-learner-model']) {
      if (flagValue(job.command, flag) !== PHASE5_LIVE_PILOT_SPEC.supportingModel) {
        errors.push(`${job.id} changed fixed supporting seam ${flag}`);
      }
    }
    if (flagValue(job.command, '--model') !== PHASE5_LIVE_PILOT_SPEC.tutorFamily) {
      errors.push(`${job.id} tutor-family flag mismatch`);
    }
    if (flagValue(job.command, '--point-of-action-arm') !== job.arm) errors.push(`${job.id} arm flag mismatch`);
    if (flagValue(job.command, '--run-seed') !== String(PHASE5_LIVE_PILOT_SPEC.runSeed)) {
      errors.push(`${job.id} run-seed mismatch`);
    }
    if (flagValue(job.command, '--committee-mini-model') !== PHASE5_LIVE_PILOT_SPEC.committeeMiniModel) {
      errors.push(`${job.id} committee mini-model mismatch`);
    }
  }
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    for (const arm of PHASE5_LIVE_PILOT_SPEC.arms) {
      const key = [profile, arm].join('|');
      if (cellCounts.get(key) !== PHASE5_LIVE_PILOT_SPEC.repeats) {
        errors.push(`${key} expected ${PHASE5_LIVE_PILOT_SPEC.repeats} jobs, found ${cellCounts.get(key) || 0}`);
      }
    }
  }
  errors.push(...evidenceUseRubricErrors(plan));
  return { ok: errors.length === 0, errors, jobCount: plan.jobs.length, balancedCellCount: cellCounts.size };
}

export function runPhase5ZeroModelFixtures() {
  const checks = [];
  for (const arm of PHASE5_LIVE_PILOT_SPEC.arms) {
    const turn = buildTutorStubPointOfActionTurn({
      arm,
      turn: 8,
      stagnation: 0.2,
      proposedActionFamily: 'probe_evidence',
      previousActionFamilies: ['orient', 'probe_evidence', 'reanchor_public_evidence', 'probe_evidence'],
      evidenceUse: 'omits_warrant',
    });
    checks.push({
      name: `${arm}_fires_without_injection`,
      ok:
        turn.assigned_trigger === 'warrant_skip' &&
        turn.interruption.text === null &&
        turn.compiled_constraint === null,
    });
  }
  const span = 'Which record shows the weight?';
  checks.push({
    name: 'battery_pass_and_fail_paths',
    ok:
      runCommitteeBattery({ composedText: `The scale waits. ${span} Show me.`, span }).pass === true &&
      runCommitteeBattery({ composedText: 'No question here.', span }).pass === false &&
      runCommitteeBattery({ composedText: `${span} And the seal?`, span }).failedCheck === 'exactly_one_question',
  });
  return { ok: checks.every((check) => check.ok), checks };
}

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function assertLaunchAuthorization(expectedSha) {
  if (!/^[0-9a-f]{40}$/u.test(expectedSha || '')) {
    throw new Error('--launch-approved also requires --expected-sha with the exact 40-character clean commit SHA');
  }
  const head = gitOutput(['rev-parse', 'HEAD']);
  if (head !== expectedSha) throw new Error(`launch SHA mismatch: expected ${expectedSha}, checkout is ${head}`);
  const dirty = gitOutput(['status', '--porcelain']);
  if (dirty) throw new Error('paid launch requires a clean checkout');
  return head;
}

function jobSealed(outputRoot, job) {
  const dir = path.join(outputRoot, 'traces', job.id);
  if (!fs.existsSync(dir)) return false;
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.jsonl'))
    .some((file) => fs.readFileSync(path.join(dir, file), 'utf8').includes('"type":"run_end"'));
}

function ollamaPreflight(url, model) {
  return new Promise((resolve, reject) => {
    const target = new URL(`${String(url).replace(/\/$/u, '')}/api/tags`);
    const req = http.get({ hostname: target.hostname, port: target.port, path: target.pathname }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const tags = JSON.parse(data);
          const names = (tags.models || []).map((entry) => String(entry.name || '').replace(/:latest$/u, ''));
          if (names.includes(model) || names.includes(`${model}:latest`)) resolve(names);
          else reject(new Error(`ollama is up but model ${model} is not present (have: ${names.join(', ')})`));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.setTimeout(10_000, () => req.destroy(new Error('ollama preflight timeout')));
    req.on('error', (err) => reject(new Error(`ollama unreachable at ${url}: ${err.message}`)));
  });
}

async function runCommand(command, ordinal, total, { budget = null } = {}) {
  console.log(`[phase5] ${ordinal}/${total} ${command[command.indexOf('--eval-job-id') + 1] || ''}`);
  await new Promise((resolve, reject) => {
    const env = budget
      ? {
          ...process.env,
          PROGRAM2_PROVIDER_CALL_LIMIT_PER_ATTEMPT: String(budget.maxProviderCallsPerAttempt),
          PROGRAM2_PROVIDER_OUTPUT_TOKEN_LIMIT_PER_ATTEMPT: String(budget.maxReservedOutputTokensPerAttempt),
        }
      : process.env;
    const child = spawn(command[0], command.slice(1), { cwd: ROOT, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`child stopped by ${signal}`));
      else if (code !== 0) reject(new Error(`child exited ${code}`));
      else resolve();
    });
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'prepare-certificate': { type: 'boolean', default: false },
      'launch-approved': { type: 'boolean', default: false },
      'expected-sha': { type: 'string', default: '' },
      'launch-certificate': { type: 'string', default: '' },
      'output-dir': { type: 'string', default: '' },
      plan: { type: 'string', default: '5' },
      'limit-jobs': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/run-program2-live-pilot.js [--dry-run | --prepare-certificate | --launch-approved --expected-sha <sha> --launch-certificate <file>] [--plan 5|5b|5c|5e-pilot|5e|5f-pilot|5f-pilot-a2|5f-pilot-a3] [--output-dir <dir>] [--limit-jobs N]',
    );
    console.log('\nPaid launch prerequisite: generate a fresh certificate with npm run program2:certify-launch.');
    console.log(
      `Run --prepare-certificate first for an exact zero-model plan. Guide: ${PROGRAM2_LAUNCH_CERTIFICATE_GUIDE}`,
    );
    return;
  }
  const prepareCertificate = Boolean(values['prepare-certificate']);
  const selectedModes = [values['dry-run'], prepareCertificate, values['launch-approved']].filter(Boolean).length;
  if (selectedModes > 1) {
    throw new Error('choose exactly one of --dry-run, --prepare-certificate, or --launch-approved');
  }
  const launch = Boolean(values['launch-approved']);
  const planKey = values.plan || '5';
  const planTable = {
    5: {
      root: 'exports/program2-live-pilot',
      build: buildPhase5LivePilotPlan,
      validate: validatePhase5LivePilotPlan,
      certificatePhase: 'pilot',
    },
    '5b': {
      root: 'exports/program2-live-pilot-5b',
      build: buildPhase5bLivePilotPlan,
      validate: validatePhase5bLivePilotPlan,
      certificatePhase: 'cohort',
    },
    '5c': {
      root: 'exports/program2-live-pilot-5c',
      build: buildPhase5cLivePilotPlan,
      validate: validatePhase5cLivePilotPlan,
      certificatePhase: 'cohort',
    },
    '5e': {
      root: 'exports/program2-live-pilot-5e-r2',
      build: buildPhase5eLivePilotPlan,
      validate: validatePhase5eLivePilotPlan,
      certificatePhase: 'cohort',
    },
    '5e-pilot': {
      root: 'exports/program2-live-pilot-5e-r2-pilot',
      build: buildPhase5eR2ExactPipelinePilotPlan,
      validate: validatePhase5eR2ExactPipelinePilotPlan,
      certificatePhase: 'pilot',
    },
    '5f-pilot': {
      root: 'exports/program2-live-pilot-5f-pilot',
      build: buildPhase5fExactPipelinePilotPlan,
      validate: validatePhase5fExactPipelinePilotPlan,
      certificatePhase: 'pilot',
    },
    '5f-pilot-a2': {
      root: 'exports/program2-live-pilot-5f-pilot-a2',
      build: buildPhase5fA2ExactPipelinePilotPlan,
      validate: validatePhase5fA2ExactPipelinePilotPlan,
      certificatePhase: 'pilot',
    },
    '5f-pilot-a3': {
      root: 'exports/program2-live-pilot-5f-pilot-a3',
      build: buildPhase5fA3ExactPipelinePilotPlan,
      validate: validatePhase5fA3ExactPipelinePilotPlan,
      certificatePhase: 'pilot',
    },
  };
  if (!planTable[planKey]) {
    throw new Error(
      `unknown --plan ${planKey} (expected 5, 5b, 5c, 5e-pilot, 5e, 5f-pilot, 5f-pilot-a2, or 5f-pilot-a3)`,
    );
  }
  const defaultRoot = launch || prepareCertificate ? planTable[planKey].root : `${planTable[planKey].root}-dry-run`;
  const outputRoot = path.resolve(ROOT, values['output-dir'] || defaultRoot);
  const plan = planTable[planKey].build({ outputRoot });
  const validation = planTable[planKey].validate(plan);
  const fixtures = runPhase5ZeroModelFixtures();
  const artifact = {
    schema: 'machinespirits.tutor-stub.program2-phase5-zero-model-gate.v1',
    generatedAt: new Date().toISOString(),
    mode: launch ? 'paid_launch' : prepareCertificate ? 'certificate_preparation' : 'zero_model_dry_run',
    modelCallsBeforeArtifact: 0,
    launchAuthorized: launch,
    sourceSha: gitOutput(['rev-parse', 'HEAD']),
    ok: validation.ok && fixtures.ok,
    planSha256: sha256(plan),
    validation,
    fixtures,
    plan,
  };
  if (!artifact.ok) {
    throw new Error(
      `Phase 5 gate failed: ${[...validation.errors, ...fixtures.checks.filter((c) => !c.ok).map((c) => c.name)].join('; ')}`,
    );
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  const launchPlanPath = path.join(outputRoot, 'launch-plan.json');
  const jsonPath = launch
    ? path.join(outputRoot, 'launch-attempt.json')
    : prepareCertificate
      ? launchPlanPath
      : path.join(outputRoot, 'zero-model-dry-run.json');
  const certificatePath = path.join(outputRoot, 'launch-certificate.json');
  if (prepareCertificate) {
    fs.writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`[phase5] certificate plan PASS; 0 model calls; ${plan.jobs.length} jobs planned`);
    console.log(
      formatProgram2LaunchCertificateReminder({
        planKey,
        phase: planTable[planKey].certificatePhase,
        plan,
        planFile: jsonPath,
        certificateFile: certificatePath,
        outputRoot,
        sourceSha: artifact.sourceSha,
      }),
    );
    return;
  }
  if (!launch) {
    fs.writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`[phase5] zero-model gate PASS; 0 model calls; ${plan.jobs.length} jobs planned`);
    console.log(`[phase5] ${path.relative(ROOT, jsonPath)}`);
    return;
  }
  const certificateValue = String(values['launch-certificate'] || '').trim();
  if (!certificateValue) {
    throw new Error(
      `${planKey} paid launch requires --launch-certificate.\n${formatProgram2LaunchCertificateReminder({
        planKey,
        phase: planTable[planKey].certificatePhase,
        plan,
        planFile: launchPlanPath,
        certificateFile: certificatePath,
        outputRoot,
        sourceSha: values['expected-sha'],
      })}`,
    );
  }
  const suppliedCertificatePath = path.resolve(ROOT, certificateValue);
  if (!fs.existsSync(suppliedCertificatePath)) {
    throw new Error(
      `launch certificate not found: ${suppliedCertificatePath}\nGuide: ${PROGRAM2_LAUNCH_CERTIFICATE_GUIDE}`,
    );
  }
  const certificateBytes = fs.readFileSync(suppliedCertificatePath);
  const launchCertificate = JSON.parse(certificateBytes.toString('utf8'));
  const certificateValidation = validateProgram2LaunchCertificate(launchCertificate, {
    plan,
    sourceSha: values['expected-sha'],
    phase: planTable[planKey].certificatePhase,
  });
  if (!certificateValidation.pass) {
    throw new Error(`launch certificate rejected: ${certificateValidation.errors.join('; ')}`);
  }
  const bindingValidation = validateProgram2CertificateEvidenceBindings(launchCertificate, { root: ROOT });
  if (!bindingValidation.pass) {
    throw new Error(`launch certificate evidence rejected: ${bindingValidation.errors.join('; ')}`);
  }
  artifact.launchCertificate = {
    file: path.relative(ROOT, suppliedCertificatePath),
    sha256: createHash('sha256').update(certificateBytes).digest('hex'),
    phase: launchCertificate.phase,
  };
  const launchSha = assertLaunchAuthorization(values['expected-sha']);
  artifact.launchSha = launchSha;
  // The certificate binds launch-plan.json byte-for-byte. Keep that prepared
  // evidence immutable and record runtime authorization in a separate artifact.
  fs.writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
  await ollamaPreflight(PHASE5_LIVE_PILOT_SPEC.committeeOllamaUrl, PHASE5_LIVE_PILOT_SPEC.committeeMiniModel);
  console.log(`[phase5] ollama preflight OK: ${PHASE5_LIVE_PILOT_SPEC.committeeMiniModel} present`);

  const limit = values['limit-jobs'] ? Number(values['limit-jobs']) : plan.jobs.length;
  const statePath = path.join(outputRoot, 'launch-state.json');
  const launchState = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
    : { schema: 'machinespirits.tutor-stub.program2-phase5-launch-state.v1', jobs: {} };
  const saveState = () => fs.writeFileSync(statePath, `${JSON.stringify(launchState, null, 2)}\n`);
  const enforceLiveFutility = (stage) => {
    const rows = ['5e', '5e-pilot', '5f-pilot', '5f-pilot-a2', '5f-pilot-a3'].includes(planKey)
      ? loadProgram2Phase5eRows({ plan, root: outputRoot })
      : [];
    const check = evaluateProgram2LiveFutility({
      plan,
      launchState,
      rows,
      contract: launchCertificate.liveFutility,
    });
    launchState.futilityChecks = Array.isArray(launchState.futilityChecks) ? launchState.futilityChecks : [];
    launchState.futilityChecks.push({ stage, ...check });
    if (launchState.futilityChecks.length > plan.jobs.length + 2) launchState.futilityChecks.shift();
    if (!check.pass) {
      launchState.abortedAt = new Date().toISOString();
      launchState.abortReason = `futility stop: ${check.reasons.join('; ')}`;
      saveState();
      throw new Error(launchState.abortReason);
    }
    saveState();
  };
  enforceLiveFutility('before_first_paid_job');
  let consecutiveFailures = 0;
  let executed = 0;
  for (const job of plan.jobs) {
    if (executed >= limit) break;
    if (jobSealed(outputRoot, job)) {
      launchState.jobs[job.id] = { status: 'sealed', skipped: true };
      saveState();
      console.log(`[phase5] ${job.ordinal}/${plan.jobs.length} ${job.id} already sealed — skipping`);
      continue;
    }
    executed += 1;
    let outcome = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await runCommand(job.command, job.ordinal, plan.jobs.length, { budget: launchCertificate.budget });
        outcome = { status: 'sealed', attempts: attempt };
        consecutiveFailures = 0;
        break;
      } catch (error) {
        consecutiveFailures += 1;
        outcome = { status: 'failed', attempts: attempt, error: String(error.message || error).slice(0, 300) };
        console.error(`[phase5] ${job.id} attempt ${attempt} failed: ${outcome.error}`);
        if (consecutiveFailures >= 3) {
          launchState.jobs[job.id] = outcome;
          launchState.abortedAt = new Date().toISOString();
          launchState.abortReason = 'three consecutive transport failures (prereg §4)';
          saveState();
          throw new Error('aborting launch: three consecutive transport failures');
        }
      }
    }
    if (outcome.status === 'failed') outcome.attrition = true;
    launchState.jobs[job.id] = outcome;
    saveState();
    enforceLiveFutility(`after_${job.id}`);
  }
  const sealedCount = Object.values(launchState.jobs).filter((entry) => entry.status === 'sealed').length;
  console.log(`[phase5] launch pass complete: ${sealedCount}/${plan.jobs.length} sealed`);
  gradeGateOnOutputRoot(outputRoot, launchState, saveState);
}

/**
 * Post-run gate check on the run's own traces. Zero API calls.
 *
 * Two things it protects. The gate result on the existing archives is a null, and a
 * null is the easy thing to keep reporting once the record shape has drifted — so
 * `checkGateGradeIntegrity` fails loudly on structural drift rather than on a
 * number. And a new arm added to a later phase would otherwise enter the pooled
 * observational baseline unchecked, which is the assumption the whole
 * flagged-versus-passed-over comparison rests on.
 *
 * Deliberately does NOT throw. The jobs are sealed and the tokens are spent by the
 * time this runs; failing the process here would break resume without saving
 * anything. The verdict goes into the persisted launch state so it survives the
 * console.
 */
function gradeGateOnOutputRoot(outputRoot, launchState, saveState) {
  let graded;
  try {
    graded = loadGateDecisions({ archives: [outputRoot] });
  } catch (error) {
    console.error(`[phase5] gate grade skipped: ${String(error.message || error)}`);
    return;
  }
  const { integrity, decisions, armSummaries } = graded;
  launchState.gateGrade = {
    decisions: decisions.length,
    arms: armSummaries.map((summary) => summary.arm),
    ok: integrity.ok,
    failures: integrity.failures,
    warnings: integrity.warnings,
  };
  if (saveState) saveState();
  console.log(`[phase5] gate grade: ${decisions.length} scorable decisions across ${armSummaries.length} arm(s)`);
  for (const warning of integrity.warnings) console.log(`[phase5] gate grade NOTE [${warning.code}] ${warning.detail}`);
  for (const failure of integrity.failures) {
    console.error(`[phase5] gate grade FAIL [${failure.code}] ${failure.detail}`);
  }
  if (!integrity.ok) {
    console.error('[phase5] the gate grader cannot read this run. Fix before quoting any gate number from it:');
    console.error(`[phase5]   npm run program2:gate-grade:check -- --archive ${outputRoot}`);
    return;
  }
  console.log(`[phase5] full report: npm run program2:gate-grade -- --archive ${outputRoot}`);
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[phase5] ${error.message}`);
    process.exit(1);
  }
}
