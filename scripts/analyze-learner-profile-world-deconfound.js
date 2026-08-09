#!/usr/bin/env node

/**
 * Run the frozen learner-profile recovery instrument over the prospective
 * balanced 2x2 cohort. The command fails closed unless the completed cohort is
 * already present in a named private-archive commit. It then uses one shared
 * leave-one-out nearest-centroid implementation for both PERSONA and WORLD.
 *
 * Historical dialogues are never loaded by this command.
 */

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  analyzeLeaveOneOutNearestCentroid,
  readLearnerProfileRecoveryManifest,
  replayLearnerProfileStateVectors,
  validateLearnerProfileRecoveryManifest,
} from './replay-learner-profile-recovery-l1.js';
import {
  readLearnerProfileWorldDeconfoundDesign,
  validateLearnerProfileWorldDeconfoundDesign,
} from './review-learner-profile-world-deconfound.js';
import { compileTutorStubTriggerArtifact } from '../services/tutorStubMannerSwitch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_COHORT = path.join(ROOT, 'exports', 'learner-profile-world-deconfound', 'prospective-plan');
const RUN_MANIFEST_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound-run-manifest.v1';
const RESULT_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound-result.v1';
const EXPECTED_FROZEN_PLAN_HASH = '7fbb5fe9ac53386c2116695279bca9080daa3972ac59035038fe5c7af92bbd9e';

export class LearnerProfileWorldDeconfoundAnalysisError extends Error {
  constructor(message) {
    super(`learner-profile world deconfound: ${message}`);
    this.name = 'LearnerProfileWorldDeconfoundAnalysisError';
  }
}

function fail(message) {
  throw new LearnerProfileWorldDeconfoundAnalysisError(message);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${label} is not readable JSON: ${filePath} (${error.message})`);
  }
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) fail(`trace is empty: ${filePath}`);
  try {
    return text.split('\n').map((line) => JSON.parse(line));
  } catch (error) {
    fail(`trace is not valid JSONL: ${filePath} (${error.message})`);
  }
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function resolveInside(root, relativeOrAbsolute, label) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(root, relativeOrAbsolute);
  if (absolute !== absoluteRoot && !absolute.startsWith(`${absoluteRoot}${path.sep}`)) {
    fail(`${label} must stay inside the repository: ${relativeOrAbsolute}`);
  }
  return absolute;
}

function collectFiles(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(item, predicate) : predicate(item) ? [item] : [];
  });
}

function git(archiveRepo, args, options = {}) {
  try {
    return execFileSync('git', ['-C', archiveRepo, ...args], {
      encoding: options.encoding === null ? null : 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf8') : error.stderr;
    fail(`private archive verification failed: git ${args.join(' ')} (${String(stderr || error.message).trim()})`);
  }
}

function gitObjectExists(archiveRepo, object) {
  git(archiveRepo, ['cat-file', '-e', object]);
}

function archivedBytes(archiveRepo, commit, relativePath) {
  return git(archiveRepo, ['show', `${commit}:${relativePath}`], { encoding: null });
}

function validateArchive({
  archiveRepo,
  archiveCommit,
  cohortRelative,
  statePath,
  eventsPath,
  traces,
  excludedFailedAttempts,
  launchSourceSha,
}) {
  const commit = String(git(archiveRepo, ['rev-parse', '--verify', `${archiveCommit}^{commit}`])).trim();
  for (const localPath of [statePath, eventsPath]) {
    const relativePath = path.relative(ROOT, localPath);
    const local = fs.readFileSync(localPath);
    const archived = archivedBytes(archiveRepo, commit, relativePath);
    if (sha256(local) !== sha256(archived)) fail(`${relativePath} does not match archive commit ${commit}`);
  }

  for (const trace of traces) {
    const traceRelative = path.relative(ROOT, trace.trace);
    const liveBase = path.posix.join('artifacts', 'tutor-stub-live', traceRelative.split(path.sep).join('/'));
    const receiptPath = `${liveBase}.archive.json`;
    gitObjectExists(archiveRepo, `${commit}:${liveBase}.gz`);
    const receipt = JSON.parse(archivedBytes(archiveRepo, commit, receiptPath).toString('utf8'));
    if (receipt.status !== 'sealed' || receipt.policy !== 'required' || receipt.durableBeforeContinuation !== true) {
      fail(`live archive receipt is not sealed and durable: ${receiptPath}`);
    }
    if (receipt.sourceTrace !== traceRelative.split(path.sep).join('/')) {
      fail(`live archive receipt points at the wrong source trace: ${receiptPath}`);
    }
    if (receipt.sourceSha !== launchSourceSha) {
      fail(`live archive receipt source SHA drifted: ${receiptPath}`);
    }
  }

  for (const failedTrace of excludedFailedAttempts) {
    const relativePath = path.relative(ROOT, failedTrace);
    const localBlob = String(git(archiveRepo, ['hash-object', failedTrace])).trim();
    const archivedBlob = String(git(archiveRepo, ['rev-parse', `${commit}:${relativePath}`])).trim();
    if (localBlob !== archivedBlob) {
      fail(`excluded failed attempt does not match archive commit ${commit}: ${relativePath}`);
    }
  }

  const archivedStatePath = path.posix.join(cohortRelative.split(path.sep).join('/'), 'paid-run-state.json');
  gitObjectExists(archiveRepo, `${commit}:${archivedStatePath}`);
  return commit;
}

function loadProspectiveCohort({ cohortDir, archiveRepo, archiveCommit }) {
  const runManifestPath = path.join(cohortDir, 'run-manifest.json');
  const statePath = path.join(cohortDir, 'paid-run-state.json');
  const eventsPath = path.join(cohortDir, 'paid-run-events.jsonl');
  const runManifest = readJson(runManifestPath, 'run manifest');
  const state = readJson(statePath, 'paid run state');

  if (runManifest.schema !== RUN_MANIFEST_SCHEMA) fail(`run manifest schema must be ${RUN_MANIFEST_SCHEMA}`);
  if (runManifest.frozenPlanHash !== EXPECTED_FROZEN_PLAN_HASH) fail('run manifest frozen plan hash drifted');
  if (runManifest.historicalDialoguesPooled !== false) fail('historical dialogues must not be pooled');
  if (runManifest.archiveBeforeOutcomeRead !== true) fail('run manifest must require archive before outcome reading');
  if (state.status !== 'completed_pending_archive')
    fail(`paid run state is ${state.status}, not completed_pending_archive`);
  if (state.outcomeReadAllowed !== false || state.archiveRequired !== true) {
    fail('paid run must remain sealed pending the independently verified archive commit');
  }
  if (state.expectedJobs !== 20 || state.completedJobs?.length !== 20 || state.failedJob) {
    fail('paid run must contain exactly 20 completed jobs and no current failure');
  }
  if (runManifest.jobs?.length !== 20) fail('run manifest must contain exactly 20 jobs');

  const completed = new Set(state.completedJobs);
  const traces = runManifest.jobs.map((job) => {
    if (!completed.has(job.id)) fail(`job is missing from completed state: ${job.id}`);
    const traceDir = resolveInside(ROOT, job.traceDir, `trace directory for ${job.id}`);
    const names = fs.existsSync(traceDir) ? fs.readdirSync(traceDir).filter((name) => name.endsWith('.jsonl')) : [];
    if (names.length !== 1) fail(`${job.id} must have exactly one valid JSONL trace, found ${names.length}`);
    const trace = path.join(traceDir, names[0]);
    return { ...job, trace, events: readJsonl(trace) };
  });

  const cells = new Map();
  for (const trace of traces) {
    const key = `${trace.persona}\u0000${trace.world}`;
    cells.set(key, (cells.get(key) || 0) + 1);
  }
  if (cells.size !== 4 || [...cells.values()].some((count) => count !== 5)) {
    fail('prospective cohort is not a balanced 2 personas x 2 worlds x 5 dialogues design');
  }

  const excludedFailedAttempts = collectFiles(path.join(cohortDir, 'failed-attempts'), (item) =>
    item.endsWith('.jsonl'),
  );

  const cohortRelative = path.relative(ROOT, cohortDir);
  const resolvedArchiveCommit = validateArchive({
    archiveRepo,
    archiveCommit,
    cohortRelative,
    statePath,
    eventsPath,
    traces,
    excludedFailedAttempts,
    launchSourceSha: runManifest.launchSourceSha,
  });
  return { runManifest, state, traces, excludedFailedAttempts, resolvedArchiveCommit };
}

function centroid(vectors, states) {
  return Object.fromEntries(
    states.map((state) => [state, vectors.reduce((sum, vector) => sum + vector.vec[state], 0) / vectors.length]),
  );
}

function branchFor(personaAccuracy, worldAccuracy, passBar) {
  const personaPass = personaAccuracy >= passBar;
  const worldPass = worldAccuracy >= passBar;
  if (personaPass && !worldPass) return 'persona_transport_within_frozen_scope';
  if (!personaPass && worldPass) return 'world_artifact';
  if (personaPass && worldPass) return 'mixed_persona_and_world_signal';
  return 'neither_label_recovered_at_bar';
}

function renderProfile(profile, states) {
  return states.map((state) => `${state}:${(100 * profile[state]).toFixed(1)}%`).join(' ');
}

export function renderLearnerProfileWorldDeconfoundResult(result) {
  const lines = [
    `cohort: ${result.dialogues} prospective dialogues; historical pooled: ${result.historicalDialoguesPooled}`,
    `archive commit: ${result.provenance.archiveCommit}`,
    `persona leave-one-out: ${result.persona.correct}/${result.dialogues} = ${(100 * result.persona.accuracy).toFixed(1)}%`,
    `world leave-one-out: ${result.world.correct}/${result.dialogues} = ${(100 * result.world.accuracy).toFixed(1)}%`,
    `frozen bar: ${(100 * result.passBar).toFixed(0)}%`,
    `branch: ${result.branch}`,
    '',
    'per-cell state-frequency profiles:',
  ];
  for (const [cell, profile] of Object.entries(result.cellProfiles)) {
    lines.push(`${cell}: ${renderProfile(profile, result.states)}`);
  }
  lines.push('', 'opening-turn readings:');
  for (const turnCount of Object.keys(result.persona.openingTurns)) {
    const persona = result.persona.openingTurns[turnCount];
    const world = result.world.openingTurns[turnCount];
    lines.push(
      `${turnCount} turns: persona ${persona.correct}/${persona.eligible} = ${(100 * persona.accuracy).toFixed(1)}%; ` +
        `world ${world.correct}/${world.eligible} = ${(100 * world.accuracy).toFixed(1)}%`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const args = {
    cohort: DEFAULT_COHORT,
    archiveRepo: null,
    archiveCommit: null,
    output: null,
    write: true,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cohort') args.cohort = path.resolve(argv[++index]);
    else if (arg === '--archive-repo') args.archiveRepo = path.resolve(argv[++index]);
    else if (arg === '--archive-commit') args.archiveCommit = argv[++index];
    else if (arg === '--output') args.output = path.resolve(argv[++index]);
    else if (arg === '--no-write') args.write = false;
    else if (arg === '--json') args.json = true;
    else fail(`unknown argument: ${arg}`);
  }
  if (!args.archiveRepo) fail('--archive-repo is required');
  if (!args.archiveCommit) fail('--archive-commit is required');
  args.output ||= path.join(args.cohort, 'analysis', 'learner-profile-world-deconfound.json');
  return args;
}

export function analyzeProspectiveCohort({ cohortDir, archiveRepo, archiveCommit }) {
  const design = readLearnerProfileWorldDeconfoundDesign();
  validateLearnerProfileWorldDeconfoundDesign(design);
  const historicalManifest = readLearnerProfileRecoveryManifest();
  const { triggerPath } = validateLearnerProfileRecoveryManifest(historicalManifest);
  const trigger = compileTutorStubTriggerArtifact(JSON.parse(fs.readFileSync(triggerPath, 'utf8')));
  const { runManifest, traces, excludedFailedAttempts, resolvedArchiveCommit } = loadProspectiveCohort({
    cohortDir,
    archiveRepo,
    archiveCommit,
  });
  const vectors = replayLearnerProfileStateVectors({
    sources: traces,
    states: historicalManifest.states,
    minimumLearnerTurns: historicalManifest.minimum_learner_turns,
    triggerPatterns: trigger.patterns,
  });
  const openingTurns = historicalManifest.classifier.opening_turns;
  const personaLabels = [...new Set(runManifest.jobs.map((job) => job.persona))];
  const worldLabels = [...new Set(runManifest.jobs.map((job) => job.world))];
  const persona = analyzeLeaveOneOutNearestCentroid({
    vectors,
    states: historicalManifest.states,
    labelKey: 'persona',
    labels: personaLabels,
    openingTurns,
  });
  const world = analyzeLeaveOneOutNearestCentroid({
    vectors,
    states: historicalManifest.states,
    labelKey: 'world',
    labels: worldLabels,
    openingTurns,
  });
  const cellProfiles = Object.fromEntries(
    [...new Set(vectors.map((vector) => vector.cell))].map((cell) => [
      cell,
      centroid(
        vectors.filter((vector) => vector.cell === cell),
        historicalManifest.states,
      ),
    ]),
  );
  const passBar = design.readings.pass_bar;
  return {
    schema: RESULT_SCHEMA,
    generatedAt: new Date().toISOString(),
    dialogues: vectors.length,
    historicalDialoguesPooled: false,
    excludedFailedAttempts: excludedFailedAttempts.length,
    passBar,
    branch: branchFor(persona.accuracy, world.accuracy, passBar),
    states: historicalManifest.states,
    persona,
    world,
    cellProfiles,
    vectors: vectors.map(({ perTurn, ...vector }) => ({ ...vector, perTurn })),
    provenance: {
      frozenPlanHash: runManifest.frozenPlanHash,
      materializedPlanHash: runManifest.materializedPlanHash,
      launchSourceSha: runManifest.launchSourceSha,
      archiveCommit: resolvedArchiveCommit,
      archiveRepo,
      pressureTriggerVersion: historicalManifest.provenance.pressure_trigger.version,
      pressureTriggerSha256: historicalManifest.provenance.pressure_trigger.sha256,
      quietDetectorVersion: historicalManifest.provenance.quiet_detector.version,
      quietDetectorSha256: historicalManifest.provenance.quiet_detector.sha256,
      classifier: historicalManifest.classifier,
    },
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const result = analyzeProspectiveCohort({
    cohortDir: args.cohort,
    archiveRepo: args.archiveRepo,
    archiveCommit: args.archiveCommit,
  });
  const rendered = renderLearnerProfileWorldDeconfoundResult(result);
  if (args.write) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(args.output.replace(/\.json$/u, '.md'), rendered);
  }
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : rendered);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
