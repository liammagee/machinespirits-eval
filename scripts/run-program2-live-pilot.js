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
// job, and an abort after three consecutive failed attempts (prereg §4).

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

function commandForJob(job, outputRoot, { runSeed = PHASE5_LIVE_PILOT_SPEC.runSeed, fallbackPolicy = null } = {}) {
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
    PHASE5_LIVE_PILOT_SPEC.world,
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
    '--dag',
    '--no-stream',
    '--no-interim-animation',
    '--learner',
    `Program-2 Phase 5 ${job.profile} repeat ${job.repeat}/${PHASE5_LIVE_PILOT_SPEC.repeats}.`,
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

async function runCommand(command, ordinal, total) {
  console.log(`[phase5] ${ordinal}/${total} ${command[command.indexOf('--eval-job-id') + 1] || ''}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd: ROOT, env: process.env, stdio: 'inherit' });
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
      'Usage: node scripts/run-program2-live-pilot.js [--dry-run] [--launch-approved --expected-sha <sha>] [--output-dir <dir>] [--limit-jobs N]',
    );
    return;
  }
  if (values['dry-run'] && values['launch-approved']) throw new Error('choose either --dry-run or --launch-approved');
  const launch = Boolean(values['launch-approved']);
  const phase5b = values.plan === '5b';
  const defaultRoot = phase5b
    ? launch
      ? 'exports/program2-live-pilot-5b'
      : 'exports/program2-live-pilot-5b-dry-run'
    : launch
      ? 'exports/program2-live-pilot'
      : 'exports/program2-live-pilot-dry-run';
  const outputRoot = path.resolve(ROOT, values['output-dir'] || defaultRoot);
  const plan = phase5b ? buildPhase5bLivePilotPlan({ outputRoot }) : buildPhase5LivePilotPlan({ outputRoot });
  const validation = phase5b ? validatePhase5bLivePilotPlan(plan) : validatePhase5LivePilotPlan(plan);
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
  artifact.launchSha = launchSha;
  fs.writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
  await ollamaPreflight(PHASE5_LIVE_PILOT_SPEC.committeeOllamaUrl, PHASE5_LIVE_PILOT_SPEC.committeeMiniModel);
  console.log(`[phase5] ollama preflight OK: ${PHASE5_LIVE_PILOT_SPEC.committeeMiniModel} present`);

  const limit = values['limit-jobs'] ? Number(values['limit-jobs']) : plan.jobs.length;
  const statePath = path.join(outputRoot, 'launch-state.json');
  const launchState = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
    : { schema: 'machinespirits.tutor-stub.program2-phase5-launch-state.v1', jobs: {} };
  const saveState = () => fs.writeFileSync(statePath, `${JSON.stringify(launchState, null, 2)}\n`);
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
        await runCommand(job.command, job.ordinal, plan.jobs.length);
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
