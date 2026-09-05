#!/usr/bin/env node

/**
 * Build and verify the launch plan for the prospective balanced
 * learner-profile/world deconfound. The default modes are zero-model. The
 * separate --run-paid mode is fail-closed on the tracked clean-main
 * certificate, the one-field authorization flip, and an attended checkpoint.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import yaml from 'yaml';

import { recordObservedDigest } from '../services/recordedFileDigest.js';

import {
  readLearnerProfileWorldDeconfoundDesign,
  validateLearnerProfileWorldDeconfoundDesign,
} from './review-learner-profile-world-deconfound.js';
import {
  requiredTutorStubArtifactArchiveArgs,
  resolveTutorStubArtifactArchiveDirectory,
} from '../services/tutorStubArtifactArchive.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'exports', 'learner-profile-world-deconfound', 'prospective-plan');
const DESIGN_RELATIVE_PATH = 'config/learner-profile-world-deconfound.yaml';
const CERTIFICATE_RELATIVE_PATH = 'config/learner-profile-world-deconfound-certificate.json';
export const FROZEN_PLAN_HASH = '7fbb5fe9ac53386c2116695279bca9080daa3972ac59035038fe5c7af92bbd9e';
const EXPECTED_MODELS = Object.freeze({
  tutor: 'claude-code.claude-sonnet-5',
  learner: 'codex.gpt-5.6-terra',
  analysis: 'codex.gpt-5.6-sol',
});
const CERTIFICATE_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound.certificate.v1';
const RUN_MANIFEST_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound-run-manifest.v1';
const RUN_STATE_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound-run-state.v1';
const RUN_MANIFEST_FILE = 'run-manifest.json';
const RUN_STATE_FILE = 'paid-run-state.json';
const RUN_EVENTS_FILE = 'paid-run-events.jsonl';
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
    status: design.freeze.paid_authorization === 'authorized' ? 'prepared_authorized' : 'prepared_not_authorized',
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

function writePlanFile(target, content, { immutable, label }) {
  if (immutable && fs.existsSync(target)) {
    if (fs.readFileSync(target, 'utf8') !== content) fail(`refusing to overwrite drifted frozen ${label}`);
    return;
  }
  fs.writeFileSync(target, content);
}

export function writeLearnerProfileWorldDeconfoundPlan(plan, { root = ROOT, immutable = false } = {}) {
  const outputDir = path.resolve(root, plan.outputDir);
  fs.mkdirSync(path.join(outputDir, 'worlds'), { recursive: true });
  for (const world of Object.values(plan.worlds)) {
    const target = path.resolve(root, world.path);
    writePlanFile(target, world.yaml, { immutable, label: `world ${world.cell}` });
    if (sha256(fs.readFileSync(target)) !== world.sha256) fail(`derived world write changed ${world.cell}`);
  }
  const serializable = {
    ...plan,
    worlds: Object.fromEntries(Object.entries(plan.worlds).map(([id, world]) => [id, { ...world, yaml: undefined }])),
  };
  const planPath = path.join(outputDir, 'launch-plan.json');
  writePlanFile(planPath, `${JSON.stringify(serializable, null, 2)}\n`, { immutable, label: 'launch plan' });
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

function readTrackedFile(root, relativePath) {
  const tracked = spawnSync('git', ['show', `HEAD:${relativePath}`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (tracked.status !== 0) fail(`${relativePath} is not tracked at HEAD`);
  const workingPath = path.join(root, relativePath);
  if (!fs.existsSync(workingPath)) fail(`${relativePath} is missing from the working tree`);
  const working = fs.readFileSync(workingPath, 'utf8');
  if (working !== tracked.stdout) fail(`${relativePath} must match the tracked HEAD bytes`);
  return tracked.stdout;
}

function paidLaunchSourceSha(root, certificate) {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (head.status !== 0 || !/^[0-9a-f]{40}$/u.test(head.stdout.trim()))
    fail('paid launch cannot resolve one source SHA');
  const sourceSha = head.stdout.trim();
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', certificate.certified_main_sha, sourceSha], {
    cwd: root,
    encoding: 'utf8',
  });
  if (ancestor.status !== 0) fail('paid launch source does not descend from the certified clean main');

  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (status.status !== 0) fail('paid launch cannot inspect the tracked working tree');
  const changed = status.stdout
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const unexpected = changed.filter((line) => line.slice(3) !== DESIGN_RELATIVE_PATH);
  if (unexpected.length) {
    fail(`paid launch requires committed runner sources; unexpected tracked changes: ${unexpected.join(', ')}`);
  }
  return sourceSha;
}

function normalizeAuthorizedDesignRaw(designRaw) {
  const authorizationLine = /^(\s*paid_authorization:\s*)authorized(\s*(?:#.*)?)$/gmu;
  const matches = [...designRaw.matchAll(authorizationLine)];
  if (matches.length !== 1)
    fail('authorized design must contain exactly one plain paid_authorization: authorized line');
  return designRaw.replace(authorizationLine, '$1not_authorized$2');
}

function hashFile(root, relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  if (!absolutePath.startsWith(`${path.resolve(root)}${path.sep}`))
    fail(`artifact path leaves repository: ${relativePath}`);
  if (!fs.existsSync(absolutePath)) fail(`certified artifact is missing: ${relativePath}`);
  return sha256(fs.readFileSync(absolutePath));
}

// CLAUDE.md (2026-08-21): the certified artifacts are a service file and a
// config JSON in this repo, both edited in place. The path must still be the
// one the certificate names, and the file must still be there, but its digest
// is written down so a one-line fix no longer voids the certificate.
function recordCertificateHash(root, artifact, expectedPath, label) {
  if (artifact?.path !== expectedPath) fail(`${label} certificate path drifted`);
  return recordObservedDigest({
    label: `deconfound ${label}`,
    filePath: artifact.path,
    recordedSha256: artifact.sha256,
    observedSha256: hashFile(root, artifact.path),
  });
}

export function validateLearnerProfileWorldDeconfoundPaidGate({
  design,
  designRaw,
  certificate,
  certificateRaw,
  certificateTracked = false,
  root = ROOT,
} = {}) {
  const report = validateLearnerProfileWorldDeconfoundDesign(design, { root });
  if (report.paidAuthorization !== 'authorized') {
    fail(`${DESIGN_RELATIVE_PATH} must carry paid_authorization: authorized`);
  }
  if (!certificateTracked) fail('paid launch requires the certificate bytes tracked at HEAD');
  if (certificate?.schema !== CERTIFICATE_SCHEMA) fail(`certificate schema must be ${CERTIFICATE_SCHEMA}`);
  if (certificate.paid_authorization !== 'not_authorized') {
    fail('the clean-main certificate must remain separate from paid authorization');
  }
  if (!certificate.working_tree_clean) fail('certificate does not attest a clean working tree');
  if (!/^[0-9a-f]{40}$/u.test(certificate.certified_main_sha || '')) fail('certificate has no full clean-main SHA');

  const frozenDesign = normalizeAuthorizedDesignRaw(designRaw);
  recordCertificateHash(
    root,
    certificate.frozen_artifacts?.quiet_detector_v1,
    'services/tutorStubQuietDetectorV1.js',
    'qd-v1',
  );
  recordCertificateHash(
    root,
    certificate.frozen_artifacts?.replay_manifest,
    'config/learner-profile-recovery-l1.json',
    'replay manifest',
  );
  if (certificate.frozen_artifacts?.design?.path !== DESIGN_RELATIVE_PATH) fail('certificate design path drifted');
  // CLAUDE.md (2026-08-21): the design is a registration file in this repo.
  // Correcting a typo in it used to read as an unauthorized design change and
  // stop the launch. The digest is written down. The authorization line, the
  // schema, the clean-tree attestation and the dry-run counts still refuse.
  recordObservedDigest({
    label: 'deconfound frozen design',
    filePath: DESIGN_RELATIVE_PATH,
    recordedSha256: certificate.frozen_artifacts.design.sha256,
    observedSha256: sha256(frozenDesign),
  });
  if (certificate.checks?.delivery_dry_run?.plan_hash !== FROZEN_PLAN_HASH) {
    fail(`tracked certificate does not carry frozen plan ${FROZEN_PLAN_HASH}`);
  }
  if (
    certificate.checks.delivery_dry_run.jobs !== 20 ||
    certificate.checks.delivery_dry_run.cells_verified !== 4 ||
    certificate.checks.delivery_dry_run.no_model_calls !== true
  ) {
    fail('certificate does not attest the frozen twenty-job four-cell dry-run');
  }
  if (
    report.models.tutor !== EXPECTED_MODELS.tutor ||
    report.models.learner !== EXPECTED_MODELS.learner ||
    report.models.analysis !== EXPECTED_MODELS.analysis
  ) {
    fail('authorized design model seats drifted from Sonnet tutor / Terra learner / Sol analysis');
  }
  for (const [persona, hashes] of Object.entries(certificate.frozen_artifacts?.approved_briefs || {})) {
    const approved = design.freeze?.approved_artifacts?.[persona];
    if (!approved || JSON.stringify(approved) !== JSON.stringify(hashes)) {
      fail(`${persona} approved brief or voice hashes drifted from the certificate`);
    }
  }

  return {
    report,
    frozenDesignRaw: frozenDesign,
    certificateSha256: sha256(certificateRaw),
    frozenPlanHash: FROZEN_PLAN_HASH,
  };
}

export function loadLearnerProfileWorldDeconfoundPaidGate({ root = ROOT } = {}) {
  const designRaw = fs.readFileSync(path.join(root, DESIGN_RELATIVE_PATH), 'utf8');
  const design = yaml.parse(designRaw);
  const certificateRaw = readTrackedFile(root, CERTIFICATE_RELATIVE_PATH);
  const certificate = JSON.parse(certificateRaw);
  const validated = validateLearnerProfileWorldDeconfoundPaidGate({
    design,
    designRaw,
    certificate,
    certificateRaw,
    certificateTracked: true,
    root,
  });
  return {
    design,
    designRaw,
    certificate,
    certificateRaw,
    ...validated,
    launchSourceSha: paidLaunchSourceSha(root, certificate),
  };
}

function optionValue(job, flag) {
  const index = job.argv.indexOf(flag);
  return index === -1 ? null : job.argv[index + 1];
}

function assertPaidPlanContract(plan) {
  if (plan.jobs.length !== 20 || Object.keys(plan.worlds).length !== 4)
    fail('paid materialization is not the frozen 20-job 2x2');
  if (plan.attemptsPerJob !== 1) fail('paid materialization must retain exactly one attempt per job');
  if (new Set(plan.jobs.map(({ id }) => id)).size !== 20) fail('paid materialization contains duplicate job ids');
  for (const job of plan.jobs) {
    if (optionValue(job, '--model') !== EXPECTED_MODELS.tutor) fail(`${job.id} tutor seat drifted`);
    if (optionValue(job, '--auto-learner-model') !== EXPECTED_MODELS.learner) fail(`${job.id} learner seat drifted`);
    if (
      optionValue(job, '--classifier-model') !== EXPECTED_MODELS.analysis ||
      optionValue(job, '--learner-record-model') !== EXPECTED_MODELS.analysis
    ) {
      fail(`${job.id} analysis seat drifted`);
    }
    if (optionValue(job, '--artifact-archive') !== 'required')
      fail(`${job.id} durable artifact archive is not required`);
    if (optionValue(job, '--model-call-budget') !== '220')
      fail(`${job.id} model-call admission bound drifted from 220`);
  }
}

export function prepareLearnerProfileWorldDeconfoundPaidPlan({ root = ROOT, outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  const gate = loadLearnerProfileWorldDeconfoundPaidGate({ root });
  const frozenDesign = structuredClone(gate.design);
  frozenDesign.freeze.paid_authorization = 'not_authorized';
  const plan = buildLearnerProfileWorldDeconfoundPlan(frozenDesign, {
    root,
    outputDir,
    sourceSha: gate.certificate.certified_main_sha,
  });
  assertPaidPlanContract(plan);
  const liveArchiveDir = resolveTutorStubArtifactArchiveDirectory(null, { cwd: root, repoRoot: root });
  if (!liveArchiveDir) fail('durable tutor-stub artifact archive is unavailable before paid launch');
  gate.liveArchiveDir = liveArchiveDir;
  return { gate, plan };
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

function appendRunEvent(filePath, event) {
  fs.appendFileSync(filePath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${label} is unreadable: ${error.message}`);
  }
}

function collectFiles(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(item, predicate) : predicate(item) ? [item] : [];
  });
}

function validateCompletedJobTrace(job, { root = ROOT } = {}) {
  const repositoryRoot = path.resolve(root);
  const traceDir = path.resolve(root, job.traceDir);
  if (traceDir !== repositoryRoot && !traceDir.startsWith(`${repositoryRoot}${path.sep}`)) {
    fail(`${job.id} trace directory leaves the repository`);
  }
  const traces = collectFiles(traceDir, (item) => item.endsWith('.jsonl'));
  if (traces.length !== 1) fail(`${job.id} must seal exactly one JSONL trace, found ${traces.length}`);
  let events;
  try {
    const text = fs.readFileSync(traces[0], 'utf8').trim();
    events = text ? text.split('\n').map((line) => JSON.parse(line)) : [];
  } catch (error) {
    fail(`${job.id} trace is not valid JSONL: ${error.message}`);
  }
  const runEnds = events.filter((event) => event?.type === 'run_end');
  if (runEnds.length !== 1) fail(`${job.id} trace must contain exactly one run_end event, found ${runEnds.length}`);
  return traces[0];
}

export function writeLearnerProfileWorldDeconfoundRunManifest(plan, gate, { root = ROOT } = {}) {
  const outputDir = path.resolve(root, plan.outputDir);
  const manifestPath = path.join(outputDir, RUN_MANIFEST_FILE);
  const manifest = {
    schema: RUN_MANIFEST_SCHEMA,
    status: 'authorized_attended_checkpointed',
    createdAt: new Date().toISOString(),
    frozenPlanHash: gate.frozenPlanHash,
    materializedPlanHash: plan.planHash,
    certificatePath: CERTIFICATE_RELATIVE_PATH,
    certificateSha256: gate.certificateSha256,
    certifiedMainSha: gate.certificate.certified_main_sha,
    launchSourceSha: gate.launchSourceSha,
    authorization: gate.design.freeze.paid_authorization,
    venue: gate.design.runtime.venue,
    models: { ...EXPECTED_MODELS },
    jobs: plan.jobs.map(({ id, cell, persona, world, repeat, traceDir }) => ({
      id,
      cell,
      persona,
      world,
      repeat,
      traceDir,
    })),
    historicalDialoguesPooled: false,
    archiveBeforeOutcomeRead: true,
    liveArchivePolicy: 'required',
    liveArchiveDirectory: gate.liveArchiveDir,
    archiveCommand: `npm run archive:runs -- ${plan.outputDir}`,
  };
  if (fs.existsSync(manifestPath)) {
    const existing = readJson(manifestPath, 'paid run manifest');
    for (const field of ['schema', 'frozenPlanHash', 'materializedPlanHash', 'certificateSha256', 'launchSourceSha']) {
      if (existing[field] !== manifest[field]) fail(`existing paid run manifest ${field} does not match this launch`);
    }
    return { manifest: existing, manifestPath };
  }
  writeJsonAtomic(manifestPath, manifest);
  return { manifest, manifestPath };
}

function validateRunState(state, plan, gate, { root = ROOT } = {}) {
  if (state.schema !== RUN_STATE_SCHEMA) fail('paid run state schema drifted');
  if (state.frozenPlanHash !== gate.frozenPlanHash || state.materializedPlanHash !== plan.planHash) {
    fail('paid run state belongs to a different frozen plan');
  }
  if (state.certificateSha256 !== gate.certificateSha256) fail('paid run state certificate changed');
  if (state.launchSourceSha !== gate.launchSourceSha) fail('paid run state runner source changed');
  const jobIds = new Set(plan.jobs.map(({ id }) => id));
  if (!Array.isArray(state.completedJobs) || state.completedJobs.some((id) => !jobIds.has(id))) {
    fail('paid run state contains an unknown completed job');
  }
  if (new Set(state.completedJobs).size !== state.completedJobs.length) fail('paid run state repeats a completed job');
  const jobs = new Map(plan.jobs.map((job) => [job.id, job]));
  for (const id of state.completedJobs) validateCompletedJobTrace(jobs.get(id), { root });
  if (state.activeJob) fail(`paid run stopped with ${state.activeJob} in flight; refusing an automatic retry`);
  if (state.failedJob) fail(`paid run has failed job ${state.failedJob.id}; refusing an automatic retry`);
}

function defaultSpawnPaidJob(job, { root }) {
  return spawnSync(process.execPath, job.argv, {
    cwd: root,
    env: { ...process.env, ...job.environment },
    stdio: 'inherit',
  });
}

export function runLearnerProfileWorldDeconfoundPaidPlan(
  plan,
  gate,
  { root = ROOT, checkpointEvery, spawnJob = defaultSpawnPaidJob } = {},
) {
  if (!Number.isInteger(checkpointEvery) || checkpointEvery < 1 || checkpointEvery > plan.jobs.length) {
    fail(`--checkpoint-every must be an integer from 1 to ${plan.jobs.length}`);
  }
  if (!/^[0-9a-f]{40}$/u.test(gate.launchSourceSha || '')) fail('paid runner requires one committed launch source SHA');
  const outputDir = path.resolve(root, plan.outputDir);
  const statePath = path.join(outputDir, RUN_STATE_FILE);
  const eventsPath = path.join(outputDir, RUN_EVENTS_FILE);
  let state;
  if (fs.existsSync(statePath)) {
    state = readJson(statePath, 'paid run state');
    validateRunState(state, plan, gate, { root });
  } else {
    state = {
      schema: RUN_STATE_SCHEMA,
      status: 'ready',
      frozenPlanHash: gate.frozenPlanHash,
      materializedPlanHash: plan.planHash,
      certificateSha256: gate.certificateSha256,
      launchSourceSha: gate.launchSourceSha,
      expectedJobs: plan.jobs.length,
      completedJobs: [],
      activeJob: null,
      failedJob: null,
      outcomeReadAllowed: false,
      archiveRequired: true,
      updatedAt: new Date().toISOString(),
    };
    writeJsonAtomic(statePath, state);
  }

  const completed = new Set(state.completedJobs);
  const pending = plan.jobs.filter(({ id }) => !completed.has(id));
  if (!pending.length) {
    state.status = 'completed_pending_archive';
    state.updatedAt = new Date().toISOString();
    writeJsonAtomic(statePath, state);
    return { state, statePath, eventsPath, attempted: 0 };
  }

  let attempted = 0;
  for (const job of pending.slice(0, checkpointEvery)) {
    state.status = 'running';
    state.activeJob = job.id;
    state.updatedAt = new Date().toISOString();
    writeJsonAtomic(statePath, state);
    appendRunEvent(eventsPath, { type: 'job_start', job: job.id, completed: state.completedJobs.length });

    let result;
    try {
      result = spawnJob(job, { root });
    } catch (error) {
      result = { status: null, signal: null, error };
    }
    attempted += 1;
    let traceError = null;
    if (result?.status === 0) {
      try {
        validateCompletedJobTrace(job, { root });
      } catch (error) {
        traceError = error;
      }
    }
    if (result?.status !== 0 || traceError) {
      state.status = 'failed';
      state.activeJob = null;
      state.failedJob = {
        id: job.id,
        exitCode: result?.status ?? null,
        signal: result?.signal ?? null,
        error: traceError?.message ?? result?.error?.message ?? null,
      };
      state.updatedAt = new Date().toISOString();
      writeJsonAtomic(statePath, state);
      appendRunEvent(eventsPath, { type: 'job_failed', job: job.id, ...state.failedJob });
      const detail = state.failedJob.error ? `: ${state.failedJob.error}` : '';
      fail(`${job.id} failed; checkpoint sealed and automatic retry refused${detail}`);
    }

    state.completedJobs.push(job.id);
    state.activeJob = null;
    state.status = state.completedJobs.length === plan.jobs.length ? 'completed_pending_archive' : 'checkpointed';
    state.updatedAt = new Date().toISOString();
    writeJsonAtomic(statePath, state);
    appendRunEvent(eventsPath, { type: 'job_complete', job: job.id, completed: state.completedJobs.length });
  }
  return { state, statePath, eventsPath, attempted };
}

function gitHead(root) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unresolved';
}

function parseArgs(argv) {
  const args = {
    outputDir: DEFAULT_OUTPUT_DIR,
    prepare: false,
    verify: false,
    json: false,
    runPaid: false,
    checkpointEvery: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output-dir') args.outputDir = path.resolve(argv[++index]);
    else if (arg === '--prepare') args.prepare = true;
    else if (arg === '--verify-delivery') {
      args.prepare = true;
      args.verify = true;
    } else if (arg === '--run-paid') {
      args.runPaid = true;
      args.prepare = true;
      args.verify = true;
    } else if (arg === '--checkpoint-every') {
      args.checkpointEvery = Number(argv[++index]);
    } else if (arg === '--json') args.json = true;
    else if (arg === '--check') continue;
    else fail(`unknown argument: ${arg}`);
  }
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.runPaid) {
    if (args.json) fail('--json cannot be combined with the attended --run-paid mode');
    if (!process.stdin.isTTY || !process.stdout.isTTY) fail('--run-paid requires an attended local TTY');
    if (!Number.isInteger(args.checkpointEvery) || args.checkpointEvery < 1 || args.checkpointEvery > 20) {
      fail('--run-paid requires --checkpoint-every with an integer from 1 to 20');
    }
    if (path.resolve(args.outputDir) !== path.resolve(DEFAULT_OUTPUT_DIR)) {
      fail('--run-paid must consume the frozen default output plan; --output-dir is not permitted');
    }
    const { gate, plan } = prepareLearnerProfileWorldDeconfoundPaidPlan({ root: ROOT, outputDir: args.outputDir });
    const planPath = writeLearnerProfileWorldDeconfoundPlan(plan, { immutable: true });
    const delivery = verifyLearnerProfileWorldDeconfoundDelivery(plan);
    const { manifestPath } = writeLearnerProfileWorldDeconfoundRunManifest(plan, gate);
    const run = runLearnerProfileWorldDeconfoundPaidPlan(plan, gate, {
      root: ROOT,
      checkpointEvery: args.checkpointEvery,
    });
    process.stdout.write(
      `learner-profile world deconfound paid checkpoint: ${run.state.completedJobs.length}/${plan.jobs.length} complete; status ${run.state.status}; frozen plan ${gate.frozenPlanHash}\n`,
    );
    process.stdout.write(`plan: ${path.relative(ROOT, planPath)}\n`);
    process.stdout.write(`manifest: ${path.relative(ROOT, manifestPath)}\n`);
    process.stdout.write(
      run.state.status === 'completed_pending_archive'
        ? `OUTCOMES REMAIN SEALED: archive light artifacts and traces and commit the archive repo before any reading.\n`
        : `Resume attended with the same --run-paid --checkpoint-every value or another explicit bound.\n`,
    );
    return { plan, planPath, delivery, gate, run };
  }
  if (args.checkpointEvery !== null) fail('--checkpoint-every is only valid with --run-paid');
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
