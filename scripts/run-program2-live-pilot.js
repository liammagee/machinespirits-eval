#!/usr/bin/env node
// Program-2 Phase 5 live committee pilot — plan, zero-model gate, launcher
// (PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md).
//
// Two arms (committee | silent_control) × 2 learner profiles × 6 repeats on
// the Step 4 operational spec, single tutor family claude-code.sonnet-5.
// Mirrors scripts/run-step4-point-of-action-gate.js: a zero-model dry run
// writes the sha-pinned plan artifact; the paid launch requires
// --launch-approved --expected-sha <clean HEAD>. Additions: sealed-trace
// resume (jobs whose trace already contains run_end are skipped), a local
// ollama preflight for the committee mini, one same-seed retry per failed
// job, and an abort after three consecutive provider-transport failures
// (prereg §3). Deterministic final-audit exits consume the job retry but are
// recorded as audit attrition rather than being mislabeled as transport.

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
import { PROGRAM2_COMMITTEE_DEFAULTS, runCommitteeBattery } from '../services/program2CommitteeEngine.js';
import { STEP4_POINT_OF_ACTION_SPEC } from './run-step4-point-of-action-gate.js';
import { learnerProfilePrompt } from './tutor-stub-learner-profile-contracts.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

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
    committeeMiniModel = PHASE5_LIVE_PILOT_SPEC.committeeMiniModel,
    learnerLabel = null,
    evalJobId = job.id,
  } = {},
) {
  const traceDir = path.join(outputRoot, 'traces', job.id);
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
    evalJobId,
    '--trace-dir',
    traceDir,
    '--max-tokens',
    String(PHASE5_LIVE_PILOT_SPEC.maxTokens),
    '--history-turns',
    String(PHASE5_LIVE_PILOT_SPEC.historyTurns),
    '--point-of-action-arm',
    job.arm,
    '--committee-mini-model',
    committeeMiniModel,
    '--committee-ollama-url',
    PHASE5_LIVE_PILOT_SPEC.committeeOllamaUrl,
    ...(fallbackPolicy ? ['--committee-fallback-policy', fallbackPolicy] : []),
    '--dag',
    '--no-stream',
    '--no-interim-animation',
    '--learner',
    learnerLabel || `Program-2 Phase 5 ${job.profile} repeat ${job.repeat}/${PHASE5_LIVE_PILOT_SPEC.repeats}.`,
  ];
}

export function buildPhase5LivePilotPlan({ outputRoot = 'exports/program2-live-pilot' } = {}) {
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
    return { ...job, command: commandForJob(job, outputRoot) };
  });
  return {
    ...PHASE5_LIVE_PILOT_SPEC,
    detectorVersion: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
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

export function buildPhase5bLivePilotPlan({ outputRoot = 'exports/program2-live-pilot-5b' } = {}) {
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
      }),
    };
  });
  return {
    ...PHASE5_LIVE_PILOT_SPEC,
    ...PHASE5B_SPEC,
    detectorVersion: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
    outputRoot,
    ordering: 'seeded Fisher-Yates over 12 committee-v2 + 6 silent_control cells',
    jobs,
  };
}

// Contemporaneous trained-vs-untuned committee ablation: 12 dialogues with
// the Phase 5b trained mini, 12 with the same-lineage untuned floor mini, and
// 6 fresh silent controls. The two committee conditions are blocked on
// profile + repeat and differ only at --committee-mini-model.
export const COMMITTEE_FLOOR_ABLATION_SPEC = Object.freeze({
  schema: 'machinespirits.tutor-stub.program2-committee-floor-ablation-plan.v1',
  preregistration: 'PROGRAM-2-COMMITTEE-FLOOR-ABLATION-PREREGISTRATION.md',
  runSeed: 20260723,
  conditions: Object.freeze(['trained_committee', 'untuned_committee', 'silent_control']),
  committeeRepeats: 6,
  controlRepeats: 3,
  fallbackPolicy: 'v2',
  trainedMiniModel: PROGRAM2_COMMITTEE_DEFAULTS.miniModel,
  untunedMiniModel: 'program2-floor-instruct-q8',
});

export function buildCommitteeFloorAblationPlan({
  outputRoot = 'exports/program2-committee-floor-ablation',
} = {}) {
  const cells = [];
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    for (let repeat = 1; repeat <= COMMITTEE_FLOOR_ABLATION_SPEC.committeeRepeats; repeat += 1) {
      const pairKey = `${profile}:r${repeat}`;
      cells.push({ repeat, profile, arm: 'committee', condition: 'trained_committee', pairKey });
      cells.push({ repeat, profile, arm: 'committee', condition: 'untuned_committee', pairKey });
    }
    for (let repeat = 1; repeat <= COMMITTEE_FLOOR_ABLATION_SPEC.controlRepeats; repeat += 1) {
      cells.push({ repeat, profile, arm: 'silent_control', condition: 'silent_control', pairKey: null });
    }
  }
  const miniModelFor = (condition) =>
    condition === 'untuned_committee'
      ? COMMITTEE_FLOOR_ABLATION_SPEC.untunedMiniModel
      : COMMITTEE_FLOOR_ABLATION_SPEC.trainedMiniModel;
  const jobs = deterministicShuffle(cells, COMMITTEE_FLOOR_ABLATION_SPEC.runSeed).map((cell, index) => {
    const id = [
      `p2fa-${String(index + 1).padStart(2, '0')}`,
      cell.profile,
      cell.condition,
      `r${cell.repeat}`,
    ].join('-');
    const job = { ordinal: index + 1, id, tutorFamily: PHASE5_LIVE_PILOT_SPEC.tutorFamily, ...cell };
    return {
      ...job,
      command: commandForJob(job, outputRoot, {
        runSeed: COMMITTEE_FLOOR_ABLATION_SPEC.runSeed,
        fallbackPolicy: cell.arm === 'committee' ? COMMITTEE_FLOOR_ABLATION_SPEC.fallbackPolicy : null,
        committeeMiniModel: miniModelFor(cell.condition),
        evalJobId: cell.pairKey || job.id,
        learnerLabel:
          `Program-2 committee floor ablation ${cell.profile} ` +
          `repeat ${cell.repeat}/${
            cell.arm === 'committee'
              ? COMMITTEE_FLOOR_ABLATION_SPEC.committeeRepeats
              : COMMITTEE_FLOOR_ABLATION_SPEC.controlRepeats
          }.`,
      }),
    };
  });
  return {
    ...PHASE5_LIVE_PILOT_SPEC,
    ...COMMITTEE_FLOOR_ABLATION_SPEC,
    committeeMiniModels: [
      COMMITTEE_FLOOR_ABLATION_SPEC.trainedMiniModel,
      COMMITTEE_FLOOR_ABLATION_SPEC.untunedMiniModel,
    ],
    detectorVersion: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
    outputRoot,
    ordering: 'seeded Fisher-Yates over 12 trained_committee + 12 untuned_committee + 6 silent_control cells',
    blocking: 'trained and untuned committee jobs share profile, repeat, pairKey, run seed, and fixed runtime seams',
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

export function buildPhase5cLivePilotPlan({ outputRoot = 'exports/program2-live-pilot-5c' } = {}) {
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
      }),
    };
  });
  return {
    ...PHASE5_LIVE_PILOT_SPEC,
    ...PHASE5C_SPEC,
    detectorVersion: TUTOR_STUB_POINT_OF_ACTION_DETECTOR_VERSION,
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
  return { ok: errors.length === 0, errors, jobCount: plan.jobs.length, balancedCellCount: cellCounts.size };
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
  return { ok: errors.length === 0, errors, jobCount: plan.jobs.length, balancedCellCount: cellCounts.size };
}

export function validateCommitteeFloorAblationPlan(plan) {
  const errors = [];
  if (plan.jobs.length !== 30) errors.push(`expected 30 jobs, found ${plan.jobs.length}`);
  const cellCounts = new Map();
  const pairs = new Map();
  for (const job of plan.jobs) {
    const key = [job.profile, job.condition].join('|');
    cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    const fallbackPolicy = flagValue(job.command, '--committee-fallback-policy');
    const pointOfActionArm = flagValue(job.command, '--point-of-action-arm');
    const miniModel = flagValue(job.command, '--committee-mini-model');
    if (pointOfActionArm !== job.arm) errors.push(`${job.id} point-of-action arm mismatch`);
    if (job.arm === 'committee' && fallbackPolicy !== COMMITTEE_FLOOR_ABLATION_SPEC.fallbackPolicy) {
      errors.push(`${job.id} missing fallback policy v2`);
    }
    if (job.arm === 'silent_control' && fallbackPolicy !== null) errors.push(`${job.id} control carries fallback policy`);
    if (job.condition === 'trained_committee' && miniModel !== COMMITTEE_FLOOR_ABLATION_SPEC.trainedMiniModel) {
      errors.push(`${job.id} trained mini-model mismatch`);
    }
    if (job.condition === 'untuned_committee' && miniModel !== COMMITTEE_FLOOR_ABLATION_SPEC.untunedMiniModel) {
      errors.push(`${job.id} untuned mini-model mismatch`);
    }
    if (flagValue(job.command, '--run-seed') !== String(COMMITTEE_FLOOR_ABLATION_SPEC.runSeed)) {
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
    if (job.arm === 'committee') {
      if (!job.pairKey) errors.push(`${job.id} missing committee pairKey`);
      if (flagValue(job.command, '--eval-job-id') !== job.pairKey) {
        errors.push(`${job.id} does not use pairKey for deterministic policy draws`);
      }
      const pairRows = pairs.get(job.pairKey) || [];
      pairRows.push(job);
      pairs.set(job.pairKey, pairRows);
    } else if (job.pairKey !== null) {
      errors.push(`${job.id} control must not carry pairKey`);
    }
  }
  for (const profile of PHASE5_LIVE_PILOT_SPEC.profiles) {
    for (const condition of ['trained_committee', 'untuned_committee']) {
      if (cellCounts.get(`${profile}|${condition}`) !== COMMITTEE_FLOOR_ABLATION_SPEC.committeeRepeats) {
        errors.push(`${profile} ${condition} cell count mismatch`);
      }
    }
    if (cellCounts.get(`${profile}|silent_control`) !== COMMITTEE_FLOOR_ABLATION_SPEC.controlRepeats) {
      errors.push(`${profile} silent_control cell count mismatch`);
    }
  }
  for (const [pairKey, pairRows] of pairs) {
    const conditions = new Set(pairRows.map((job) => job.condition));
    const repeats = new Set(pairRows.map((job) => job.repeat));
    const profiles = new Set(pairRows.map((job) => job.profile));
    if (
      pairRows.length !== 2 ||
      !conditions.has('trained_committee') ||
      !conditions.has('untuned_committee') ||
      repeats.size !== 1 ||
      profiles.size !== 1
    ) {
      errors.push(`${pairKey} is not a complete matched trained/untuned block`);
    }
  }
  if (pairs.size !== PHASE5_LIVE_PILOT_SPEC.profiles.length * COMMITTEE_FLOOR_ABLATION_SPEC.committeeRepeats) {
    errors.push(`expected 12 matched committee blocks, found ${pairs.size}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    jobCount: plan.jobs.length,
    balancedCellCount: cellCounts.size,
    matchedPairCount: pairs.size,
  };
}

function flagValue(command, flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
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

export function classifyProgram2ResumeDisposition({ outputRoot, job, priorOutcome = null } = {}) {
  if (jobSealed(outputRoot, job)) return 'sealed';
  if (
    priorOutcome?.status === 'failed' &&
    priorOutcome?.attrition === true &&
    Number.isInteger(priorOutcome?.attempts) &&
    priorOutcome.attempts >= 2
  ) {
    return 'finalized_attrition';
  }
  return 'pending';
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

function tutorStubRuntimePreflight() {
  const probe = spawnSync(process.execPath, ['scripts/tutor-stub.js', '--help'], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
  });
  if (probe.error || probe.status !== 0) {
    const detail = String(probe.stderr || probe.stdout || probe.error?.message || 'unknown startup failure')
      .replace(/\s+/gu, ' ')
      .trim()
      .slice(0, 500);
    throw new Error(`tutor-stub runtime preflight failed before any job: ${detail}`);
  }
}

async function runCommand(command, ordinal, total) {
  console.log(`[phase5] ${ordinal}/${total} ${command[command.indexOf('--eval-job-id') + 1] || ''}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd: ROOT, env: process.env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        const error = new Error(`child stopped by ${signal}`);
        error.signal = signal;
        reject(error);
      } else if (code !== 0) {
        const error = new Error(`child exited ${code}`);
        error.exitCode = code;
        reject(error);
      }
      else resolve();
    });
  });
}

function latestJobErrorEvent(outputRoot, job, { sinceMs = 0 } = {}) {
  const dir = path.join(outputRoot, 'traces', job.id);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.jsonl'))
    .map((file) => ({ file, mtimeMs: fs.statSync(path.join(dir, file)).mtimeMs }))
    .filter((entry) => entry.mtimeMs >= sinceMs)
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
  for (const { file } of files) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').trim().split('\n');
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        const event = JSON.parse(lines[index]);
        if (event?.type === 'model_call_error') return { ...event, traceFile: path.join(dir, file) };
      } catch {
        // A child can exit while its final line is incomplete. Earlier sealed
        // JSON events remain usable for failure classification.
      }
    }
  }
  return null;
}

export function classifyProgram2LaunchFailure({ error = null, traceEvent = null } = {}) {
  const childError = String(error?.message || error || '').trim();
  const traceError = String(traceEvent?.error || '').trim();
  const detail = traceError || childError || 'unknown child-process failure';
  if (/^Tutor deterministic fallback failed final audit:/u.test(detail)) {
    return {
      kind: 'deterministic_final_audit',
      countsTowardTransportAbort: false,
      abortImmediately: false,
      detail,
      turn: Number.isInteger(traceEvent?.turn) ? traceEvent.turn : null,
      traceFile: traceEvent?.traceFile || null,
    };
  }
  if (
    /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|HTTP\s*(?:429|502|503|504))\b|fetch failed|network error|provider transport|rate limit|socket hang up|temporarily unavailable|timed? out|unreachable|overloaded/iu.test(
      detail,
    )
  ) {
    return {
      kind: 'provider_transport',
      countsTowardTransportAbort: true,
      abortImmediately: false,
      detail,
      turn: Number.isInteger(traceEvent?.turn) ? traceEvent.turn : null,
      traceFile: traceEvent?.traceFile || null,
    };
  }
  return {
    kind: error?.signal ? 'child_signal' : 'child_process',
    countsTowardTransportAbort: false,
    abortImmediately: true,
    detail,
    turn: Number.isInteger(traceEvent?.turn) ? traceEvent.turn : null,
    traceFile: traceEvent?.traceFile || null,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'launch-approved': { type: 'boolean', default: false },
      'expected-sha': { type: 'string', default: '' },
      'output-dir': { type: 'string', default: '' },
      plan: { type: 'string', default: '5' },
      'limit-jobs': { type: 'string', default: '' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node scripts/run-program2-live-pilot.js [--plan 5|5b|5c|floor] [--dry-run] [--launch-approved --expected-sha <sha>] [--output-dir <dir>] [--limit-jobs N]',
    );
    return;
  }
  if (values['dry-run'] && values['launch-approved']) throw new Error('choose either --dry-run or --launch-approved');
  const launch = Boolean(values['launch-approved']);
  const planKey = values.plan || '5';
  const planTable = {
    5: { root: 'exports/program2-live-pilot', build: buildPhase5LivePilotPlan, validate: validatePhase5LivePilotPlan },
    '5b': {
      root: 'exports/program2-live-pilot-5b',
      build: buildPhase5bLivePilotPlan,
      validate: validatePhase5bLivePilotPlan,
    },
    '5c': {
      root: 'exports/program2-live-pilot-5c',
      build: buildPhase5cLivePilotPlan,
      validate: validatePhase5cLivePilotPlan,
    },
    floor: {
      root: 'exports/program2-committee-floor-ablation',
      build: buildCommitteeFloorAblationPlan,
      validate: validateCommitteeFloorAblationPlan,
    },
  };
  if (!planTable[planKey]) throw new Error(`unknown --plan ${planKey} (expected 5, 5b, 5c, or floor)`);
  const defaultRoot = launch ? planTable[planKey].root : `${planTable[planKey].root}-dry-run`;
  const outputRoot = path.resolve(ROOT, values['output-dir'] || defaultRoot);
  const plan = planTable[planKey].build({ outputRoot });
  const validation = planTable[planKey].validate(plan);
  const fixtures = runPhase5ZeroModelFixtures();
  const artifact = {
    schema: 'machinespirits.tutor-stub.program2-phase5-zero-model-gate.v1',
    generatedAt: new Date().toISOString(),
    mode: launch ? 'paid_launch' : 'zero_model_dry_run',
    modelCallsBeforeArtifact: 0,
    launchAuthorized: launch,
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
  const jsonPath = path.join(outputRoot, launch ? 'launch-plan.json' : 'zero-model-dry-run.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
  if (!launch) {
    console.log(`[phase5] zero-model gate PASS; 0 model calls; ${plan.jobs.length} jobs planned`);
    console.log(`[phase5] ${path.relative(ROOT, jsonPath)}`);
    return;
  }
  const launchSha = assertLaunchAuthorization(values['expected-sha']);
  tutorStubRuntimePreflight();
  artifact.launchSha = launchSha;
  fs.writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
  const requiredMiniModels = plan.committeeMiniModels || [PHASE5_LIVE_PILOT_SPEC.committeeMiniModel];
  for (const miniModel of requiredMiniModels) {
    await ollamaPreflight(PHASE5_LIVE_PILOT_SPEC.committeeOllamaUrl, miniModel);
    console.log(`[phase5] ollama preflight OK: ${miniModel} present`);
  }

  const limit = values['limit-jobs'] ? Number(values['limit-jobs']) : plan.jobs.length;
  const statePath = path.join(outputRoot, 'launch-state.json');
  const launchState = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
    : { schema: 'machinespirits.tutor-stub.program2-phase5-launch-state.v1', jobs: {} };
  const saveState = () => fs.writeFileSync(statePath, `${JSON.stringify(launchState, null, 2)}\n`);
  let consecutiveTransportFailures = 0;
  let executed = 0;
  for (const job of plan.jobs) {
    if (executed >= limit) break;
    const resumeDisposition = classifyProgram2ResumeDisposition({
      outputRoot,
      job,
      priorOutcome: launchState.jobs[job.id] || null,
    });
    if (resumeDisposition === 'sealed') {
      launchState.jobs[job.id] = { status: 'sealed', skipped: true };
      saveState();
      console.log(`[phase5] ${job.ordinal}/${plan.jobs.length} ${job.id} already sealed — skipping`);
      continue;
    }
    if (resumeDisposition === 'finalized_attrition') {
      console.log(
        `[phase5] ${job.ordinal}/${plan.jobs.length} ${job.id} already finalized as attrition — skipping`,
      );
      continue;
    }
    executed += 1;
    let outcome = null;
    const failures = [];
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const attemptStartedAt = Date.now();
      try {
        await runCommand(job.command, job.ordinal, plan.jobs.length);
        outcome = { status: 'sealed', attempts: attempt, failures };
        consecutiveTransportFailures = 0;
        break;
      } catch (error) {
        const failure = classifyProgram2LaunchFailure({
          error,
          traceEvent: latestJobErrorEvent(outputRoot, job, { sinceMs: attemptStartedAt }),
        });
        failures.push({
          attempt,
          kind: failure.kind,
          detail: failure.detail.slice(0, 500),
          turn: failure.turn,
          traceFile: failure.traceFile ? path.relative(ROOT, failure.traceFile) : null,
        });
        consecutiveTransportFailures = failure.countsTowardTransportAbort
          ? consecutiveTransportFailures + 1
          : 0;
        outcome = {
          status: 'failed',
          attempts: attempt,
          failureKind: failure.kind,
          error: failure.detail.slice(0, 300),
          failures,
        };
        console.error(
          `[phase5] ${job.id} attempt ${attempt} failed (${failure.kind}): ${outcome.error}`,
        );
        if (failure.abortImmediately) {
          launchState.jobs[job.id] = outcome;
          launchState.abortedAt = new Date().toISOString();
          launchState.abortReason = `non-retryable ${failure.kind} failure before a sealed job`;
          saveState();
          throw new Error(`aborting launch: non-retryable ${failure.kind} failure`);
        }
        if (consecutiveTransportFailures >= 3) {
          launchState.jobs[job.id] = outcome;
          launchState.abortedAt = new Date().toISOString();
          launchState.abortReason = 'three consecutive transport failures (prereg §3)';
          saveState();
          throw new Error('aborting launch: three consecutive transport failures');
        }
      }
    }
    if (outcome.status === 'failed') outcome.attrition = true;
    launchState.jobs[job.id] = outcome;
    saveState();
  }
  const sealedCount = Object.values(launchState.jobs).filter((entry) => entry.status === 'sealed').length;
  console.log(`[phase5] launch pass complete: ${sealedCount}/${plan.jobs.length} sealed`);
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[phase5] ${error.message}`);
    process.exit(1);
  }
}
