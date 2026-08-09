#!/usr/bin/env node

/**
 * Build and verify the zero-model launch plan for the prospective balanced
 * learner-profile/world deconfound. This command can write derived world
 * overlays and execute tutor-stub --dry-run; it cannot launch paid dialogues.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import yaml from 'yaml';

import {
  readLearnerProfileWorldDeconfoundDesign,
  validateLearnerProfileWorldDeconfoundDesign,
} from './review-learner-profile-world-deconfound.js';
import { requiredTutorStubArtifactArchiveArgs } from '../services/tutorStubArtifactArchive.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'exports', 'learner-profile-world-deconfound', 'prospective-plan');
const WORLD_FILES = Object.freeze({
  world_030_rowan_flat: 'config/drama-derivation/world-030-rowan-flat.yaml',
  world_033_alder_row_redoubt: 'config/drama-derivation/world-033-alder-row-redoubt.yaml',
});
const PLAN_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound-plan.v1';

function fail(message) {
  throw new Error(`learner-profile world deconfound plan: ${message}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function hashObject(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function readWorld(root, worldId) {
  const relativePath = WORLD_FILES[worldId];
  if (!relativePath) fail(`no canonical world file for ${worldId}`);
  const absolutePath = path.join(root, relativePath);
  const raw = yaml.parse(fs.readFileSync(absolutePath, 'utf8'));
  if (raw.id !== worldId) fail(`world file ${relativePath} declares ${raw.id}`);
  return { relativePath, raw };
}

function cellMaterials(design, cell, root) {
  const persona = design.personas[cell.persona];
  if (!persona) fail(`cell ${cell.id} names unknown persona ${cell.persona}`);
  const sourceCell = persona.source.world === cell.world;
  const { relativePath, raw } = readWorld(root, cell.world);
  const privateBrief = sourceCell ? persona.source.private_brief : persona.transplant.private_brief;
  const publicLearnerVoice = sourceCell ? raw.learner_voice : persona.transplant.public_learner_voice;
  if (!privateBrief?.trim() || !publicLearnerVoice?.trim()) fail(`cell ${cell.id} has incomplete learner material`);

  const derived = structuredClone(raw);
  derived.learner_voice = publicLearnerVoice;
  derived.experimental_overlay = {
    schema: 'machinespirits.tutor-stub.learner-profile-world-overlay.v1',
    experiment: 'learner-profile-world-deconfound',
    cell: cell.id,
    persona: cell.persona,
    source_cell: sourceCell,
    canonical_world_file: relativePath,
    private_brief_sha256: sha256(privateBrief),
    public_learner_voice_sha256: sha256(publicLearnerVoice),
  };
  const derivedWorldYaml = yaml.stringify(derived, { lineWidth: 0 });
  return {
    sourceCell,
    privateBrief,
    privateBriefSha256: sha256(privateBrief),
    publicLearnerVoice,
    publicLearnerVoiceSha256: sha256(publicLearnerVoice),
    canonicalWorldFile: relativePath,
    canonicalWorldSha256: sha256(fs.readFileSync(path.join(root, relativePath))),
    derivedWorldYaml,
    derivedWorldSha256: sha256(derivedWorldYaml),
  };
}

function jobArguments({ design, cell, materials, repeat, outputDirRelative }) {
  const jobId = `${cell.id}-d${repeat}`;
  const derivedWorld = path.posix.join(outputDirRelative, 'worlds', `${cell.id}.yaml`);
  const traceDir = path.posix.join(outputDirRelative, 'traces', cell.id, `d${repeat}`);
  return {
    id: jobId,
    cell: cell.id,
    persona: cell.persona,
    world: cell.world,
    sourceCell: materials.sourceCell,
    repeat,
    privateBriefSha256: materials.privateBriefSha256,
    publicLearnerVoiceSha256: materials.publicLearnerVoiceSha256,
    derivedWorld,
    derivedWorldSha256: materials.derivedWorldSha256,
    stressSchedule: cell.stress_schedule,
    traceDir,
    environment: {
      TUTOR_STUB_STRESS_SCHEDULE: cell.stress_schedule,
      TUTOR_STUB_SUMMARY_OPEN: '0',
    },
    argv: [
      'scripts/tutor-stub.js',
      '--lab',
      'automated_eval',
      '--auto-learner',
      '--world',
      derivedWorld,
      '--dag',
      '--tutor-learner-dag',
      '--dag-mode',
      'strict_dag',
      '--model',
      design.runtime.tutor_model,
      '--classifier-model',
      design.runtime.analysis_model,
      '--learner-record-model',
      design.runtime.analysis_model,
      '--auto-learner-model',
      design.runtime.learner_model,
      '--auto-learner-profile',
      materials.privateBrief,
      '--register-policy',
      'field',
      '--register-temperature',
      '0.15',
      '--no-light-adaptation',
      '--no-committee',
      '--dag-fact-dropout',
      '0',
      '--dag-fact-dropout-seed',
      String(repeat + 1),
      '--release-speed',
      '1',
      '--run-seed',
      String(repeat + 1),
      '--eval-repeat',
      String(repeat + 1),
      '--eval-job-id',
      jobId,
      '--auto-turns',
      'until-grounded',
      '--auto-safety-turns',
      '44',
      '--history-turns',
      '4',
      '--max-tokens',
      '2000',
      '--cli-effort',
      'medium',
      '--model-call-budget',
      '220',
      '--acknowledge-research-use',
      '--training-reuse',
      'off',
      '--no-turn-feedback',
      '--no-remember-settings',
      '--no-stream',
      '--no-interim-animation',
      '--trace-dir',
      traceDir,
      ...requiredTutorStubArtifactArchiveArgs(),
    ],
  };
}

export function buildLearnerProfileWorldDeconfoundPlan(
  design = readLearnerProfileWorldDeconfoundDesign(),
  { root = ROOT, outputDir = DEFAULT_OUTPUT_DIR, sourceSha = 'uncommitted' } = {},
) {
  const report = validateLearnerProfileWorldDeconfoundDesign(design, { root });
  const outputDirRelative = path.relative(root, path.resolve(outputDir)).split(path.sep).join('/');
  if (!outputDirRelative || outputDirRelative.startsWith('../'))
    fail('output directory must stay inside the repository');

  const worlds = {};
  const jobs = [];
  for (const cell of design.paid_design.cells) {
    const materials = cellMaterials(design, cell, root);
    worlds[cell.id] = {
      cell: cell.id,
      world: cell.world,
      persona: cell.persona,
      sourceCell: materials.sourceCell,
      canonicalWorldFile: materials.canonicalWorldFile,
      canonicalWorldSha256: materials.canonicalWorldSha256,
      privateBriefSha256: materials.privateBriefSha256,
      publicLearnerVoiceSha256: materials.publicLearnerVoiceSha256,
      path: path.posix.join(outputDirRelative, 'worlds', `${cell.id}.yaml`),
      sha256: materials.derivedWorldSha256,
      yaml: materials.derivedWorldYaml,
    };
    for (let repeat = 0; repeat < cell.repeats; repeat += 1) {
      jobs.push(jobArguments({ design, cell, materials, repeat, outputDirRelative }));
    }
  }
  if (jobs.length !== report.dialogues) fail(`built ${jobs.length} jobs, expected ${report.dialogues}`);
  if (new Set(jobs.map((job) => job.id)).size !== jobs.length) fail('job ids are not unique');

  const plan = {
    schema: PLAN_SCHEMA,
    status: 'prepared_not_authorized',
    sourceSha,
    designSchema: design.schema,
    designHash: hashObject(design),
    outputDir: outputDirRelative,
    paidAuthorization: design.freeze.paid_authorization,
    attemptsPerJob: design.runtime.attempts_per_job,
    jobs: jobs.map((job) => ({ ...job, argv: [...job.argv] })),
    worlds,
    externalPayloadBoundary: {
      anthropic: 'derived public world, public dialogue history, tutor prompts, and ordinary recovery payloads',
      openai: 'private simulated learner brief, dialogue, learner-record, DAG, and classification payloads',
      local: 'no committee arm; exact qd-v1 replay is local and zero-model',
    },
    historicalBoundary:
      'The historical 56/64 result motivates the 80 percent bar but is not independently reproduced or pooled into this cohort.',
    postRunArchive: {
      liveTracePolicy: 'required',
      liveTraceBoundary: 'redacted events mirrored outside the worktree before continuation',
      requiredBeforeCloseout: true,
      script: 'scripts/archive-run-artifacts.js',
      command: 'node scripts/archive-run-artifacts.js <completed-cohort-output-dir>',
      includeTraces: true,
      reason: 'The prospective traces are primary evidence and must not remain only under ignored exports/.',
    },
  };
  plan.planHash = hashObject({
    ...plan,
    worlds: Object.fromEntries(Object.entries(worlds).map(([id, world]) => [id, { ...world, yaml: undefined }])),
  });
  return plan;
}

export function writeLearnerProfileWorldDeconfoundPlan(plan, { root = ROOT } = {}) {
  const outputDir = path.resolve(root, plan.outputDir);
  fs.mkdirSync(path.join(outputDir, 'worlds'), { recursive: true });
  for (const world of Object.values(plan.worlds)) {
    const target = path.resolve(root, world.path);
    fs.writeFileSync(target, world.yaml);
    if (sha256(fs.readFileSync(target)) !== world.sha256) fail(`derived world write changed ${world.cell}`);
  }
  const serializable = {
    ...plan,
    worlds: Object.fromEntries(Object.entries(plan.worlds).map(([id, world]) => [id, { ...world, yaml: undefined }])),
  };
  const planPath = path.join(outputDir, 'launch-plan.json');
  fs.writeFileSync(planPath, `${JSON.stringify(serializable, null, 2)}\n`);
  return planPath;
}

function parseDryRun(stdout, job) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    fail(`dry-run output for ${job.id} is not JSON: ${error.message}`);
  }
}

export function verifyLearnerProfileWorldDeconfoundDelivery(plan, { root = ROOT } = {}) {
  const verified = [];
  for (const cell of Object.keys(plan.worlds)) {
    const job = plan.jobs.find((candidate) => candidate.cell === cell);
    const result = spawnSync(process.execPath, [...job.argv, '--dry-run'], {
      cwd: root,
      env: { ...process.env, ...job.environment },
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.status !== 0) fail(`dry-run failed for ${job.id}: ${result.stderr || result.stdout}`);
    const dryRun = parseDryRun(result.stdout, job);
    const options = dryRun.sessionRecipe?.config?.options || {};
    const world = plan.worlds[cell];
    const privateBrief = job.argv[job.argv.indexOf('--auto-learner-profile') + 1];
    const expectedVoice = yaml.parse(fs.readFileSync(path.resolve(root, world.path), 'utf8')).learner_voice;
    if (dryRun.world?.id !== job.world) fail(`${job.id} dry-run resolved ${dryRun.world?.id}, expected ${job.world}`);
    if (options['auto-learner-profile'] !== privateBrief) fail(`${job.id} did not deliver the frozen private brief`);
    if (!String(dryRun.systemPrompt || '').includes(expectedVoice))
      fail(`${job.id} did not deliver the frozen public learner voice`);
    if (dryRun.modelRef !== plan.jobs[0].argv[plan.jobs[0].argv.indexOf('--model') + 1]) {
      fail(`${job.id} tutor model drifted`);
    }
    if (dryRun.autoLearner?.modelRef !== options['auto-learner-model']) fail(`${job.id} learner model drifted`);
    if (dryRun.lab?.admission?.researchUseAcknowledged !== true) fail(`${job.id} lacks metered research-use admission`);
    verified.push({ cell, job: job.id, configHash: dryRun.sessionRecipe.configHash, worldSha256: world.sha256 });
  }
  return verified;
}

function gitHead(root) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unresolved';
}

function parseArgs(argv) {
  const args = { outputDir: DEFAULT_OUTPUT_DIR, prepare: false, verify: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output-dir') args.outputDir = path.resolve(argv[++index]);
    else if (arg === '--prepare') args.prepare = true;
    else if (arg === '--verify-delivery') {
      args.prepare = true;
      args.verify = true;
    } else if (arg === '--json') args.json = true;
    else if (arg === '--check') continue;
    else fail(`unknown argument: ${arg}`);
  }
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const design = readLearnerProfileWorldDeconfoundDesign();
  const plan = buildLearnerProfileWorldDeconfoundPlan(design, {
    root: ROOT,
    outputDir: args.outputDir,
    sourceSha: gitHead(ROOT),
  });
  let planPath = null;
  let delivery = [];
  if (args.prepare) planPath = writeLearnerProfileWorldDeconfoundPlan(plan);
  if (args.verify) delivery = verifyLearnerProfileWorldDeconfoundDelivery(plan);
  const summary = {
    status: plan.status,
    jobs: plan.jobs.length,
    cells: Object.keys(plan.worlds).length,
    planHash: plan.planHash,
    planPath,
    deliveryVerified: delivery.length,
    paidAuthorization: plan.paidAuthorization,
  };
  if (args.json) process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  else {
    process.stdout.write(
      `learner-profile world deconfound plan: ${summary.jobs} jobs across ${summary.cells} balanced cells; paid authorization ${summary.paidAuthorization}; delivery ${summary.deliveryVerified}/${summary.cells}\n`,
    );
    if (planPath) process.stdout.write(`plan: ${path.relative(ROOT, planPath)}\n`);
  }
  return { plan, planPath, delivery };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
