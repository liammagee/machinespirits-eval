#!/usr/bin/env node

/**
 * Fail-closed parent for the registered adaptive-warrant outcome main block.
 *
 * The default invocation is zero-call. Generation and the decision readers are
 * unavailable until a fresh committed reviewer note 097a names this exact
 * entry point and the caller also supplies --accept-charges.
 */

import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  DECISION_READER_INSTRUMENT_BINDINGS,
  extractOutcomeDialogueFromTraceRows,
  scoreAdaptiveWarrantOutcomeMainBlock,
} from './score-adaptive-warrant-outcome-study.js';
import {
  assembleAdaptiveWarrantAnnotationResponse,
  prepareAdaptiveWarrantAnnotationBatches,
} from './prepare-adaptive-warrant-annotation-batches.js';
import {
  buildOutcomePilotJobs,
  carryOverOutcomeSchemaAcceptance,
  guardOutcomeAnnotationFingerprints,
  preflightOutcomePilotPromptAudits,
  prepareOutcomeCases,
  reuseOutcomePilotReaderCollection,
  runOutcomeGeneration,
  validateOutcomeFreezeFormForFrozenDecisionRunner,
  writeOutcomeCorpusArtifacts,
  writeOutcomePilotAssemblyRunView,
} from './run-adaptive-warrant-outcome-pilot.js';
import { validateAdaptiveWarrantSemanticPreflightArtifact } from '../services/adaptiveWarrantSemanticPreflight.js';
import { validateAdaptiveWarrantReaderResponseContract } from '../services/adaptiveWarrantReaderRetake.js';
import { assertReviewerGoNoteContent } from '../services/reviewerGoNoteContent.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_MANIFEST = 'docs/adaptation-refinement/outcome-study-a1/main-block-manifest.json';
const REQUIRED_GO_NOTE = 'docs/adaptation-refinement/relay/097a-reviewer-go-note-main-block.md';
const DECISION_RUNNER_PATH = path.join(ROOT, 'scripts/run-adaptive-warrant-decision-readers.js');
const DECISION_PREPARER_PATH = path.join(ROOT, 'scripts/prepare-adaptive-warrant-annotation-batches.js');

export const OUTCOME_MAIN_BLOCK_SEEDS = Object.freeze(Array.from({ length: 12 }, (_unused, index) => 524 + index));
export const OUTCOME_MAIN_BLOCK_DIALOGUES = 72;
export const OUTCOME_MAIN_BLOCK_CASES = 576;
export const OUTCOME_MAIN_BLOCK_DECISION_CALLS = 1152;
export const OUTCOME_MAIN_BLOCK_FAILED_ATTEMPT_ALLOWANCE = 48;
export const OUTCOME_MAIN_BLOCK_CHILD_INTERNAL_ALLOWANCE = 12;
export const OUTCOME_MAIN_BLOCK_AUTHORIZATION_MAXIMUM_CALLS =
  OUTCOME_MAIN_BLOCK_DECISION_CALLS +
  OUTCOME_MAIN_BLOCK_FAILED_ATTEMPT_ALLOWANCE -
  OUTCOME_MAIN_BLOCK_CHILD_INTERNAL_ALLOWANCE;
export const OUTCOME_MAIN_BLOCK_ABSOLUTE_READER_ATTEMPT_CEILING =
  OUTCOME_MAIN_BLOCK_DECISION_CALLS + OUTCOME_MAIN_BLOCK_FAILED_ATTEMPT_ALLOWANCE;
export const OUTCOME_MAIN_BLOCK_PER_DIALOGUE_CAP = 30;
export const OUTCOME_MAIN_BLOCK_CALL_PLAN = Object.freeze({
  generation_expected: 2000,
  generation_cap: OUTCOME_MAIN_BLOCK_DIALOGUES * OUTCOME_MAIN_BLOCK_PER_DIALOGUE_CAP,
  decision_readers: OUTCOME_MAIN_BLOCK_DECISION_CALLS,
  failed_attempt_allowance: OUTCOME_MAIN_BLOCK_FAILED_ATTEMPT_ALLOWANCE,
  approximate_total: 3200,
  absolute_cap_total:
    OUTCOME_MAIN_BLOCK_DIALOGUES * OUTCOME_MAIN_BLOCK_PER_DIALOGUE_CAP +
    OUTCOME_MAIN_BLOCK_ABSOLUTE_READER_ATTEMPT_CEILING,
});
export const OUTCOME_MAIN_BLOCK_SCHEMA = 'machinespirits.adaptation-refinement.warrant-outcome-main-block-run.v1';
export const OUTCOME_MAIN_BLOCK_CHECKPOINT_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-outcome-main-block-checkpoint.v1';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function relativeToRoot(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).split(path.sep).join('/');
}

function assertExact(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match the registered main-block manifest`);
  }
}

export function buildOutcomeMainBlockAssignments({ seeds = OUTCOME_MAIN_BLOCK_SEEDS } = {}) {
  const worlds = ['world_101_kestrel_signal_lamp', 'world_102_marigold_archive_box'];
  const conditions = ['bare', 'gated', 'standing_permission'];
  const assignments = [];
  for (const [seedIndex, seed] of seeds.entries()) {
    for (const [worldIndex, world] of worlds.entries()) {
      const rotation = (seedIndex + worldIndex) % conditions.length;
      for (let offset = 0; offset < conditions.length; offset += 1) {
        assignments.push({
          order: assignments.length + 1,
          world,
          seed,
          condition: conditions[(rotation + offset) % conditions.length],
        });
      }
    }
  }
  return assignments;
}

export function guardOutcomeMainBlockStudyPlan({ manifest, assignments } = {}) {
  const conditions = ['bare', 'gated', 'standing_permission'];
  const counts = Object.fromEntries(
    conditions.map((condition) => [condition, assignments.filter((row) => row.condition === condition).length]),
  );
  const seedCounts = Object.fromEntries(
    OUTCOME_MAIN_BLOCK_SEEDS.map((seed) => [seed, assignments.filter((row) => row.seed === seed).length]),
  );
  const identities = new Set(assignments.map((row) => `${row.world}:${row.seed}:${row.condition}`));
  const checks = {
    seed_range: JSON.stringify(manifest.seeds) === JSON.stringify(OUTCOME_MAIN_BLOCK_SEEDS),
    dialogue_count: assignments.length === OUTCOME_MAIN_BLOCK_DIALOGUES,
    unique_identity_count: identities.size === OUTCOME_MAIN_BLOCK_DIALOGUES,
    per_condition: Object.values(counts).every((count) => count === 24),
    per_seed: Object.values(seedCounts).every((count) => count === 6),
    turns: manifest.assignment?.turns_per_dialogue === 8,
    learner_profile: manifest.assignment?.learner_profile === 'low_agency',
    case_count: manifest.case_extraction?.expected_case_count === OUTCOME_MAIN_BLOCK_CASES,
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    zero_model_calls: true,
    checks,
    counts: { dialogues: assignments.length, by_condition: counts, by_seed: seedCounts },
  };
}

function walkFiles(root, { maximumDepth = 5 } = {}) {
  const files = [];
  const directories = [];
  const visit = (current, depth) => {
    if (depth > maximumDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    directories.push(current);
    for (const entry of entries) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) visit(resolved, depth + 1);
      else if (entry.isFile()) files.push(resolved);
    }
  };
  if (fs.existsSync(root)) visit(path.resolve(root), 0);
  return { files, directories };
}

function seedMetadataPattern(seed) {
  return new RegExp(
    `(?:--run-seed["']?\\s*[,=:]?\\s*["']?${seed}\\b|["']run[_-]?seed["']\\s*:\\s*["']?${seed}\\b)`,
    'u',
  );
}

function seedDirectoryPattern(seed) {
  return new RegExp(`(?:^|[-_])(?:s|seed[-_]?)${seed}(?:$|[-_])`, 'u');
}

export function auditOutcomeMainBlockSeedFreshness({
  seeds = OUTCOME_MAIN_BLOCK_SEEDS,
  roots = [path.join(ROOT, '.tutor-stub-auto-eval'), '/private/tmp'],
  excludeRoots = [],
} = {}) {
  const excluded = excludeRoots.map((entry) => path.resolve(entry));
  const outsideExclusions = (candidate) =>
    !excluded.some((root) => candidate === root || candidate.startsWith(`${root}${path.sep}`));
  const metadataNames = new Set(['run-plan.json', 'run-state.json', 'run-seal.json', 'run-events.jsonl']);
  const hits = [];
  const inspected = [];
  for (const root of roots) {
    const inventory = walkFiles(root, { maximumDepth: root === '/private/tmp' ? 4 : 8 });
    for (const directory of inventory.directories.filter(outsideExclusions)) {
      for (const seed of seeds) {
        if (seedDirectoryPattern(seed).test(path.basename(directory))) {
          hits.push({ seed, kind: 'run_directory_name', path: directory });
        }
      }
    }
    for (const filePath of inventory.files.filter(outsideExclusions)) {
      if (!metadataNames.has(path.basename(filePath))) continue;
      inspected.push(filePath);
      let text;
      try {
        text = fs.readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }
      for (const seed of seeds) {
        if (seedMetadataPattern(seed).test(text)) hits.push({ seed, kind: 'run_metadata', path: filePath });
      }
    }
  }
  const uniqueHits = [...new Map(hits.map((row) => [`${row.seed}:${row.kind}:${row.path}`, row])).values()];
  return {
    schema: 'machinespirits.adaptation-refinement.outcome-main-block-seed-freshness.v1',
    zero_model_calls: true,
    status: uniqueHits.length ? 'failed' : 'passed',
    seeds: [...seeds],
    roots: roots.map((entry) => path.resolve(entry)),
    excluded_roots: excluded,
    metadata_files_inspected: inspected.length,
    hits: uniqueHits,
  };
}

export function verifyOutcomeMainBlockManifest({ manifestPath = DEFAULT_MANIFEST } = {}) {
  const resolvedManifest = path.resolve(ROOT, manifestPath);
  const manifest = readJson(resolvedManifest);
  if (manifest.schema !== 'machinespirits.adaptation-refinement.warrant-outcome-main-block-manifest.v1') {
    throw new Error('outcome main-block manifest schema mismatch');
  }
  assertExact(manifest.seeds, OUTCOME_MAIN_BLOCK_SEEDS, 'main-block seeds');
  assertExact(manifest.conditions, ['bare', 'gated', 'standing_permission'], 'main-block conditions');
  assertExact(
    manifest.planned_calls,
    {
      generation_expected: 2000,
      generation_cap: 2160,
      decision_readers: 1152,
      failed_attempt_allowance: 48,
      approximate_total: 3200,
      absolute_cap_total: 3360,
      counter_before: 5274,
      ceiling: 19337,
    },
    'main-block call plan',
  );
  if (manifest.channels?.presence?.enabled !== false || manifest.channels?.decision?.enabled !== true) {
    throw new Error('outcome main block must be decision-only');
  }
  const inherited = manifest.inherited_pilot_bindings;
  if (!inherited?.path || !inherited?.sha256 || fileSha256(path.resolve(ROOT, inherited.path)) !== inherited.sha256) {
    throw new Error('outcome main-block inherited pilot bindings drift');
  }
  const bindings = manifest.channels.decision.digests;
  if (
    fileSha256(DECISION_RUNNER_PATH) !== bindings.reader_runner_sha256 ||
    fileSha256(DECISION_PREPARER_PATH) !== bindings.preparation_and_assembly_sha256
  ) {
    throw new Error('outcome main-block frozen decision tooling drift');
  }
  for (const world of manifest.worlds || []) {
    const resolved = path.resolve(ROOT, world.path);
    if (!fs.existsSync(resolved) || fileSha256(resolved) !== world.sha256) {
      throw new Error(`outcome main-block world drift: ${world.id}`);
    }
  }
  const assignments = buildOutcomeMainBlockAssignments({ seeds: manifest.seeds });
  const studyPlanGuard = guardOutcomeMainBlockStudyPlan({ manifest, assignments });
  if (studyPlanGuard.status !== 'passed') throw new Error('outcome main-block study-plan guard failed');
  return { manifest, resolvedManifest, assignments, studyPlanGuard };
}

export function printOutcomeMainBlockPlan(manifest = null) {
  const plan = manifest?.planned_calls || {
    generation_expected: 2000,
    decision_readers: 1152,
    failed_attempt_allowance: 48,
    approximate_total: 3200,
  };
  return [
    'Adaptive-warrant outcome main block: HOLD / zero-call plan only.',
    `Entry point: ${relativeToRoot(SCRIPT_PATH)}`,
    `72 dialogues; seeds 524-535; generation approximately ${plan.generation_expected}; decision readers ${plan.decision_readers}; failed-attempt allowance ${plan.failed_attempt_allowance}; approximately ${plan.approximate_total} calls.`,
    'Presence channel: disabled. Measures 7 and 8: report-only from stored events, not reader-validated.',
    `A paid run requires committed ${REQUIRED_GO_NOTE} plus --accept-charges.`,
  ].join('\n');
}

export function validateOutcomeMainBlockGoNote(goNotePath) {
  if (relativeToRoot(path.resolve(ROOT, goNotePath || '')) !== REQUIRED_GO_NOTE) {
    throw new Error(`outcome main block refuses: --go-note must be ${REQUIRED_GO_NOTE}`);
  }
  const resolved = path.resolve(ROOT, goNotePath);
  if (!fs.existsSync(resolved)) throw new Error('outcome main block refuses: reviewer note 097a is absent');
  let committed;
  try {
    committed = execFileSync('git', ['show', `HEAD:${REQUIRED_GO_NOTE}`], { cwd: ROOT });
  } catch {
    throw new Error('outcome main block refuses: reviewer note 097a is not committed at HEAD');
  }
  const onDisk = fs.readFileSync(resolved);
  if (!committed.equals(onDisk))
    throw new Error('outcome main block refuses: reviewer note 097a has uncommitted drift');
  const text = onDisk.toString('utf8');
  // The pinned path plus the byte check above is the gate here. The old
  // required-substring 'GO' added nothing: it matched ALGO and GOAL as well,
  // and a draft committed at the pinned path would carry it in its own title.
  assertReviewerGoNoteContent(text, { label: 'reviewer note 097a', refusal: 'outcome main block refuses' });
  for (const required of ['run-adaptive-warrant-outcome-main-block.js', '524', '535', '1,152', '48']) {
    if (!text.includes(required)) throw new Error(`outcome main block refuses: reviewer note 097a lacks ${required}`);
  }
  return { path: resolved, relative_path: REQUIRED_GO_NOTE, sha256: sha256(onDisk) };
}

export function guardOutcomeMainBlockReaderAllowance({ callsAttempted = 0 } = {}) {
  const remaining = OUTCOME_MAIN_BLOCK_ABSOLUTE_READER_ATTEMPT_CEILING - Number(callsAttempted || 0);
  if (remaining <= 0) throw new Error('outcome main-block 48-attempt reader allowance exhausted');
  return { status: 'passed', calls_attempted: callsAttempted, attempts_remaining: remaining };
}

export async function runAfterOutcomeMainBlockAllowanceGuard({ callsAttempted = 0, launch } = {}) {
  const guard = guardOutcomeMainBlockReaderAllowance({ callsAttempted });
  if (typeof launch !== 'function') throw new Error('outcome main-block reader launch callback is required');
  return { guard, result: await launch() };
}

export function guardOutcomeMainBlockDecisionCollection(collection = {}) {
  const request = collection.authorizationRequest || collection.authorization_request;
  const manifest = collection.manifest;
  const checks = {
    corpus_cases: manifest?.corpus?.cases === OUTCOME_MAIN_BLOCK_CASES,
    readers: Array.isArray(manifest?.readers) && manifest.readers.length === 2,
    cases_per_reader:
      Array.isArray(manifest?.readers) &&
      manifest.readers.every((reader) => reader.batches?.length === OUTCOME_MAIN_BLOCK_CASES),
    one_case_batches:
      Array.isArray(manifest?.readers) &&
      manifest.readers.every((reader) => reader.batches?.every((batch) => batch.required_sample_ids?.length === 1)),
    planned_calls: request?.call_budget?.planned_calls === OUTCOME_MAIN_BLOCK_DECISION_CALLS,
    authorization_maximum: request?.call_budget?.maximum_calls === OUTCOME_MAIN_BLOCK_AUTHORIZATION_MAXIMUM_CALLS,
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    zero_model_calls: true,
    channel: 'decision',
    presence_channel_built: false,
    expected_cases: OUTCOME_MAIN_BLOCK_CASES,
    expected_calls: OUTCOME_MAIN_BLOCK_DECISION_CALLS,
    checks,
  };
}

export function createOutcomeMainBlockBudget({ checkpointPath, checkpoint = null } = {}) {
  const state = checkpoint || {
    schema: OUTCOME_MAIN_BLOCK_CHECKPOINT_SCHEMA,
    status: 'prepared',
    call_budget: {
      plan: { ...OUTCOME_MAIN_BLOCK_CALL_PLAN },
      actual: { generation: 0, decision_readers: 0, total: 0 },
      events: [],
    },
    dialogues: [],
    quarantined_dialogues: [],
  };
  if (state.schema !== OUTCOME_MAIN_BLOCK_CHECKPOINT_SCHEMA) throw new Error('main-block checkpoint schema mismatch');
  const persist = () => {
    state.call_budget.actual.total = state.call_budget.actual.generation + state.call_budget.actual.decision_readers;
    state.updated_at = new Date().toISOString();
    if (checkpointPath) atomicWriteJson(checkpointPath, state);
  };
  const reserveMany = (phase, count, event = {}) => {
    if (!['generation', 'decision_readers'].includes(phase)) throw new Error(`unknown budget phase ${phase}`);
    if (!Number.isInteger(count) || count < 0) throw new Error('reservation count must be a non-negative integer');
    const ceiling =
      phase === 'generation'
        ? OUTCOME_MAIN_BLOCK_CALL_PLAN.generation_cap
        : OUTCOME_MAIN_BLOCK_ABSOLUTE_READER_ATTEMPT_CEILING;
    if (state.call_budget.actual[phase] + count > ceiling) {
      throw new Error(`outcome main-block ${phase} call ceiling exceeded`);
    }
    state.call_budget.actual[phase] += count;
    state.call_budget.events.push({ type: 'model_call_budget_reserved', phase, count, ...event });
    persist();
  };
  persist();
  return { state, reserveMany, persist };
}

export function resolveOutcomeMainBlockLaunchCommit({ checkpoint, semanticPreflight } = {}) {
  const preflightCommit = semanticPreflight?.bindings?.source_commit;
  if (!preflightCommit) throw new Error('outcome main-block reused semantic preflight launch stamp missing');
  const freezeCommit = checkpoint?.freeze?.source_commit;
  if (freezeCommit && freezeCommit !== preflightCommit) {
    throw new Error('outcome main-block reused semantic preflight launch stamp drift');
  }
  return preflightCommit;
}

export function shouldReuseOutcomeMainBlockLaunchArtifacts({ resume = false, readerResume = false } = {}) {
  return Boolean(resume && readerResume);
}

function emitOutcomeMainBlockFreeze({
  outputPath,
  studyId,
  sourceCommit,
  corpusPath,
  keyPath,
  handbookPath,
  studyPlanPath,
  semanticPreflightPath,
  schemaAcceptancePath,
} = {}) {
  const binding = (filePath) => ({ path: path.resolve(filePath), sha256: fileSha256(path.resolve(filePath)) });
  const freeze = {
    schema: 'machinespirits.adaptation-refinement.warrant-mechanism-validation-freeze.v1',
    study_id: studyId,
    status: 'frozen',
    frozen_at: new Date().toISOString(),
    newly_generated_dialogues: true,
    prediction_balanced_diagnostic_sample: false,
    all_observe_decisions: true,
    sampling: {
      worlds: 2,
      profiles: ['low_agency'],
      conditions: ['bare', 'gated', 'standing_permission'],
      turns_per_dialogue: 8,
      total_cases: OUTCOME_MAIN_BLOCK_CASES,
    },
    protocol: binding(
      path.join(ROOT, 'docs/adaptation-refinement/relay/096-reviewer-reregistration-outcome-main-block.md'),
    ),
    study_plan: binding(studyPlanPath),
    source_commit: sourceCommit,
    semantic_instrument: {
      preflight: binding(semanticPreflightPath),
      schema_acceptance: binding(schemaAcceptancePath),
    },
    annotation_handbook: binding(handbookPath),
    corpus: { ...binding(corpusPath), cases: OUTCOME_MAIN_BLOCK_CASES },
    key: binding(keyPath),
    outcome_main_block: true,
    channels: { decision: true, presence: false },
  };
  atomicWriteJson(outputPath, freeze);
  validateOutcomeFreezeFormForFrozenDecisionRunner(freeze);
  return freeze;
}

export function auditOutcomeMainBlockDecisionResponseContracts({
  collectionManifest,
  responseDir,
  outputPath = null,
} = {}) {
  const rows = [];
  for (const reader of collectionManifest.readers || []) {
    for (const batch of reader.batches || []) {
      const responsePath = path.join(path.resolve(responseDir), reader.reader_id, batch.expected_response_filename);
      const response = readJson(responsePath);
      validateAdaptiveWarrantReaderResponseContract({
        response,
        collectionManifest,
        reader,
        batch,
        assemble: assembleAdaptiveWarrantAnnotationResponse,
      });
      rows.push({
        reader_id: reader.reader_id,
        batch_id: batch.batch_id,
        sample_id: batch.required_sample_ids[0],
        response_path: responsePath,
        response_sha256: fileSha256(responsePath),
        full_deterministic_contract: 'passed',
      });
    }
  }
  const expected = OUTCOME_MAIN_BLOCK_DECISION_CALLS;
  if (rows.length !== expected)
    throw new Error(`main-block response contract audit expected ${expected}, got ${rows.length}`);
  const audit = {
    schema: 'machinespirits.adaptation-refinement.outcome-main-block-response-acceptance-audit.v1',
    status: 'passed',
    zero_model_calls: true,
    acceptance_rule: 'full deterministic contract before admission to the main-block score',
    responses_validated: rows.length,
    rows,
  };
  if (outputPath) atomicWriteJson(outputPath, audit);
  return audit;
}

function spawnLogged(command, { logPath } = {}) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const log = fs.createWriteStream(logPath, { flags: 'a' });
    const child = spawn(command[0], command.slice(1), {
      cwd: ROOT,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => log.write(chunk));
    child.stderr.on('data', (chunk) => log.write(chunk));
    let error = null;
    child.on('error', (cause) => {
      error = cause.message;
    });
    child.on('close', (status, signal) => {
      log.end();
      resolve({ status, signal, error });
    });
  });
}

export async function executeOutcomeMainBlock({
  manifestPath = DEFAULT_MANIFEST,
  goNotePath,
  acceptCharges = false,
  outputDir,
  instrumentFreezePath,
  resume = false,
  runDialogue,
  runReaderProcess = spawnLogged,
  seedFreshnessRoots,
} = {}) {
  if (!acceptCharges) throw new Error('outcome main block refuses: --accept-charges is required');
  const goNote = validateOutcomeMainBlockGoNote(goNotePath);
  const guarded = verifyOutcomeMainBlockManifest({ manifestPath });
  if (git(['status', '--porcelain'])) throw new Error('outcome main-block launch requires a clean committed worktree');
  if (!outputDir) throw new Error('outcome main-block launch requires --out');
  if (!instrumentFreezePath) throw new Error('outcome main-block launch requires --instrument-freeze');
  const rootDir = path.resolve(ROOT, outputDir);
  const checkpointPath = path.join(rootDir, 'outcome-main-block-checkpoint.json');
  if (fs.existsSync(rootDir) && !resume) throw new Error('outcome main-block output exists; pass --resume');
  if (resume && !fs.existsSync(checkpointPath)) throw new Error('--resume requires a main-block checkpoint');
  const freshness = auditOutcomeMainBlockSeedFreshness({
    roots: seedFreshnessRoots,
    excludeRoots: resume ? [rootDir] : [],
  });
  if (freshness.status !== 'passed') {
    throw new Error(
      `outcome main-block seed freshness failed: ${freshness.hits.map((row) => `s${row.seed}:${row.path}`).join(', ')}`,
    );
  }

  const sourceFreeze = readJson(path.resolve(instrumentFreezePath));
  validateOutcomeFreezeFormForFrozenDecisionRunner(sourceFreeze);
  const handbookPath = sourceFreeze.annotation_handbook?.path;
  if (!handbookPath || fileSha256(handbookPath) !== guarded.manifest.channels.decision.digests.handbook_sha256) {
    throw new Error('outcome main-block decision handbook drift');
  }
  const checkpoint = resume ? readJson(checkpointPath) : null;
  const budget = createOutcomeMainBlockBudget({ checkpointPath, checkpoint });
  const promptAuditPath = path.join(rootDir, 'prompt-audit-preflight.json');
  const semanticPreflightPath = path.join(rootDir, 'semantic-brittleness-preflight.json');
  const schemaAcceptancePath = path.join(rootDir, 'semantic-schema-acceptance-carryover.json');
  const decisionCollectionDir = path.join(rootDir, 'decision-collection');
  const decisionRunDir = path.join(rootDir, 'decision-readers');
  const decisionRunPath = path.join(decisionRunDir, 'decision-reader-run.json');
  const readerResume = resume && fs.existsSync(decisionRunPath);
  const reuseLaunchArtifacts = shouldReuseOutcomeMainBlockLaunchArtifacts({ resume, readerResume });

  if (!reuseLaunchArtifacts) {
    preflightOutcomePilotPromptAudits({
      manifest: { ...guarded.manifest, interleaved_condition_assignment: guarded.assignments },
      outputPath: promptAuditPath,
    });
    execFileSync(
      process.execPath,
      ['scripts/run-adaptive-warrant-semantic-brittleness-preflight.js', '--out', semanticPreflightPath],
      { cwd: ROOT, stdio: 'pipe' },
    );
    carryOverOutcomeSchemaAcceptance({
      sourcePath: sourceFreeze.semantic_instrument.schema_acceptance.path,
      preflightPath: semanticPreflightPath,
      outputPath: schemaAcceptancePath,
      authorizedBy: 'docs/adaptation-refinement/relay/097-reviewer-direction-main-block-build.md',
    });
  } else {
    for (const required of [promptAuditPath, semanticPreflightPath, schemaAcceptancePath]) {
      if (!fs.existsSync(required)) throw new Error(`outcome main-block resume artifact missing: ${required}`);
    }
  }
  const semanticPreflight = readJson(semanticPreflightPath);
  const launchCommit = reuseLaunchArtifacts
    ? resolveOutcomeMainBlockLaunchCommit({ checkpoint, semanticPreflight })
    : git(['rev-parse', 'HEAD']);
  validateAdaptiveWarrantSemanticPreflightArtifact({
    artifact: semanticPreflight,
    expectedSourceCommit: launchCommit,
  });

  budget.state.status = 'generation';
  budget.state.go_note = goNote;
  budget.state.manifest = { path: guarded.resolvedManifest, sha256: fileSha256(guarded.resolvedManifest) };
  budget.state.pre_call_guards = {
    study_plan: guarded.studyPlanGuard,
    seed_freshness: freshness,
    decision_runner_sha256: fileSha256(DECISION_RUNNER_PATH),
    presence_channel_built: false,
  };
  budget.persist();

  const runtimeManifest = {
    ...guarded.manifest,
    interleaved_condition_assignment: guarded.assignments,
  };
  const jobs = buildOutcomePilotJobs({
    manifest: runtimeManifest,
    rootDir,
    studyLabel: 'outcome-main',
  });
  await runOutcomeGeneration({ jobs, checkpoint: budget.state, budget, runDialogue });
  const completed = budget.state.dialogues.filter((row) => row.status === 'complete');
  if (completed.length !== OUTCOME_MAIN_BLOCK_DIALOGUES) {
    budget.state.status = 'generation_quarantine_stop';
    budget.persist();
    return budget.state;
  }

  const rows = completed.sort((left, right) => left.order - right.order).map((row) => row.result);
  let built;
  let artifacts;
  let freeze;
  let freezePath;
  let decisionCollection;
  if (readerResume) {
    freezePath = checkpoint.freeze.path;
    freeze = readJson(freezePath);
    validateOutcomeFreezeFormForFrozenDecisionRunner(freeze);
    for (const binding of [freeze.corpus, freeze.key, freeze.study_plan, freeze.annotation_handbook]) {
      if (!binding?.path || fileSha256(binding.path) !== binding.sha256) {
        throw new Error('outcome main-block reused freeze artifact drift');
      }
    }
    built = { corpus: readJson(freeze.corpus.path), key: readJson(freeze.key.path) };
    artifacts = { corpusPath: freeze.corpus.path, keyPath: freeze.key.path };
    decisionCollection = reuseOutcomePilotReaderCollection({
      collectionDir: decisionCollectionDir,
      channel: 'decision',
    });
  } else {
    built = prepareOutcomeCases({
      rows,
      manifest: runtimeManifest,
      rootDir,
      samplingSeed: 'outcome-main-block-frozen-order',
    });
    const fingerprintGuard = guardOutcomeAnnotationFingerprints({
      cases: built.corpus.cases,
      keyCases: built.key.cases,
      expectedCount: OUTCOME_MAIN_BLOCK_CASES,
    });
    budget.state.post_generation_fingerprint_guard = fingerprintGuard;
    budget.persist();
    artifacts = writeOutcomeCorpusArtifacts({ rootDir, built });
    const studyPlanPath = path.join(rootDir, 'outcome-main-block-study-plan.json');
    atomicWriteJson(studyPlanPath, {
      schema: OUTCOME_MAIN_BLOCK_SCHEMA,
      manifest: budget.state.manifest,
      jobs,
      study_plan_guard: guarded.studyPlanGuard,
      seed_freshness: freshness,
    });
    freezePath = path.join(rootDir, 'annotation-freeze-manifest.json');
    freeze = emitOutcomeMainBlockFreeze({
      outputPath: freezePath,
      studyId: path.basename(rootDir),
      sourceCommit: launchCommit,
      corpusPath: artifacts.corpusPath,
      keyPath: artifacts.keyPath,
      handbookPath,
      studyPlanPath,
      semanticPreflightPath,
      schemaAcceptancePath,
    });
    decisionCollection = prepareAdaptiveWarrantAnnotationBatches({
      corpusPath: artifacts.corpusPath,
      handbookPath,
      outputDir: decisionCollectionDir,
      corpusRole: 'natural_prevalence',
      readerIds: ['decision-reader-a', 'decision-reader-b'],
      batchSize: 1,
      maxAnnotationCalls: OUTCOME_MAIN_BLOCK_AUTHORIZATION_MAXIMUM_CALLS,
      preflightPath: semanticPreflightPath,
    });
  }
  const decisionCollectionGuard = guardOutcomeMainBlockDecisionCollection(decisionCollection);
  if (decisionCollectionGuard.status !== 'passed') {
    throw new Error('outcome main-block decision-only collection shape mismatch');
  }
  budget.state.pre_call_guards.decision_collection = decisionCollectionGuard;
  budget.state.freeze = { path: freezePath, source_commit: freeze.source_commit, sha256: fileSha256(freezePath) };
  budget.state.status = 'decision_readers';
  budget.persist();

  const existingRun = fs.existsSync(decisionRunPath) ? readJson(decisionRunPath) : null;
  if (existingRun?.status !== 'complete') {
    const callsBefore = Number(existingRun?.calls_attempted || 0);
    const { result } = await runAfterOutcomeMainBlockAllowanceGuard({
      callsAttempted: callsBefore,
      launch: () =>
        runReaderProcess(
          [
            process.execPath,
            'scripts/run-adaptive-warrant-decision-readers.js',
            '--manifest',
            decisionCollection.manifestPath,
            '--freeze-manifest',
            freezePath,
            '--authorization-request',
            decisionCollection.authorizationRequestPath,
            '--out',
            decisionRunDir,
            '--approved-by',
            goNote.relative_path,
            ...(existingRun ? ['--resume'] : []),
          ],
          { logPath: path.join(rootDir, 'decision-readers-launcher.log') },
        ),
    });
    const afterRun = fs.existsSync(decisionRunPath) ? readJson(decisionRunPath) : null;
    const attemptsAfter = Number(afterRun?.calls_attempted || callsBefore);
    budget.reserveMany('decision_readers', attemptsAfter - callsBefore, { source: 'decision-reader-run' });
    if (result.status !== 0) throw new Error('frozen decision-reader child failed');
  }
  const run = readJson(decisionRunPath);
  const recordedReaderAttempts = Number(budget.state.call_budget.actual.decision_readers || 0);
  if (run.calls_attempted > recordedReaderAttempts) {
    budget.reserveMany('decision_readers', run.calls_attempted - recordedReaderAttempts, {
      source: 'decision-reader-run-reconciliation',
    });
  }
  if (run.status !== 'complete') throw new Error('outcome main-block decision reader run is incomplete');
  if (run.calls_attempted > OUTCOME_MAIN_BLOCK_ABSOLUTE_READER_ATTEMPT_CEILING) {
    throw new Error('outcome main-block decision reader allowance overrun');
  }
  const assemblyRun = writeOutcomePilotAssemblyRunView({
    runPath: decisionRunPath,
    outputPath: path.join(rootDir, 'decision-reader-assembly-run-view.json'),
  });
  const acceptanceAudit = auditOutcomeMainBlockDecisionResponseContracts({
    collectionManifest: decisionCollection.manifest,
    responseDir: decisionRunDir,
    outputPath: path.join(rootDir, 'decision-response-acceptance-audit.json'),
  });
  const assembled = new Map();
  for (const readerId of ['decision-reader-a', 'decision-reader-b']) {
    assembled.set(
      readerId,
      assembleAdaptiveWarrantAnnotationResponse({
        manifestPath: decisionCollection.manifestPath,
        readerId,
        annotationRunId: `${path.basename(rootDir)}-${readerId}`,
        responseDir: path.join(decisionRunDir, readerId),
        outputPath: path.join(rootDir, `${readerId}.assembled.json`),
        runPath: assemblyRun.path,
      }).response,
    );
  }
  const keyBySampleId = new Map(built.key.cases.map((row) => [row.sample_id, row]));
  const left = new Map(assembled.get('decision-reader-a').cases.map((row) => [row.sample_id, row]));
  const right = new Map(assembled.get('decision-reader-b').cases.map((row) => [row.sample_id, row]));
  const decisionCases = built.corpus.cases.map((row) => {
    const key = keyBySampleId.get(row.sample_id);
    return {
      sample_id: row.sample_id,
      dialogue_id: key.job_id,
      turn: key.turn,
      condition: key.condition,
      reader_a_decision: left.get(row.sample_id)?.commitment_transition_warranted,
      reader_b_decision: right.get(row.sample_id)?.commitment_transition_warranted,
      logged_observe_decision: key.gate?.revision_warranted ?? key.shadow?.revision_warranted,
    };
  });
  const dialogues = completed.map((row) =>
    extractOutcomeDialogueFromTraceRows({
      dialogue_id: row.id,
      condition: row.condition,
      rows: readJsonl(row.trace_path),
    }),
  );
  const score = scoreAdaptiveWarrantOutcomeMainBlock({
    decision_reader_preflight: { ...DECISION_READER_INSTRUMENT_BINDINGS },
    dialogues,
    decision_cases: decisionCases,
    decision_reader_run_record_path: assemblyRun.path,
    generation_time_cases: built.key.cases,
  });
  const scorePath = path.join(rootDir, 'outcome-main-block-score.json');
  atomicWriteJson(scorePath, score);
  budget.state.status = 'complete';
  budget.state.reader_run_record = decisionRunPath;
  budget.state.response_acceptance_audit = {
    path: path.join(rootDir, 'decision-response-acceptance-audit.json'),
    responses_validated: acceptanceAudit.responses_validated,
  };
  budget.state.score = { path: scorePath, sha256: fileSha256(scorePath) };
  budget.persist();
  return budget.state;
}

function usage() {
  return `Usage:\n  node scripts/run-adaptive-warrant-outcome-main-block.js\n  node scripts/run-adaptive-warrant-outcome-main-block.js --go-note ${REQUIRED_GO_NOTE} --accept-charges --out <fresh-dir> --instrument-freeze <freeze> [--resume]\n`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      manifest: { type: 'string', default: DEFAULT_MANIFEST },
      'go-note': { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      out: { type: 'string' },
      'instrument-freeze': { type: 'string' },
      resume: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(usage());
    return;
  }
  if (!values['accept-charges']) {
    const guarded = verifyOutcomeMainBlockManifest({ manifestPath: values.manifest });
    process.stdout.write(`${printOutcomeMainBlockPlan(guarded.manifest)}\n`);
    return;
  }
  const result = await executeOutcomeMainBlock({
    manifestPath: values.manifest,
    goNotePath: values['go-note'],
    acceptCharges: true,
    outputDir: values.out,
    instrumentFreezePath: values['instrument-freeze'],
    resume: values.resume,
  });
  process.stdout.write(
    `${JSON.stringify({ status: result.status, checkpoint: path.resolve(ROOT, values.out, 'outcome-main-block-checkpoint.json') })}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(`[outcome-main-block] error: ${error.message}`);
    process.exitCode = 1;
  });
}
