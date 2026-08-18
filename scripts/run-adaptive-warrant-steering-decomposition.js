#!/usr/bin/env node

/**
 * Fail-closed parent for the registered adaptive-warrant steering decomposition.
 *
 * The default invocation is zero-call. Generation and the decision readers are
 * unavailable until a fresh committed reviewer note 103 names this exact
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
  scoreAdaptiveWarrantSteeringDecomposition,
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
const DEFAULT_MANIFEST = 'docs/adaptation-refinement/outcome-study-a1/steering-decomposition-manifest.json';
const REQUIRED_GO_NOTE = 'docs/adaptation-refinement/relay/103-reviewer-go-note-steering-decomposition.md';
const DECISION_RUNNER_PATH = path.join(ROOT, 'scripts/run-adaptive-warrant-decision-readers.js');
const DECISION_PREPARER_PATH = path.join(ROOT, 'scripts/prepare-adaptive-warrant-annotation-batches.js');
const PRIVATE_ARCHIVE_ROOT = '/Users/lmagee/Dev/machinespirits/machinespirits-eval-private';

export const STEERING_DECOMPOSITION_SEEDS = Object.freeze([536, 537, 538, 539, 540, 542, 543, 544, 545, 546, 548, 549]);
export const STEERING_DECOMPOSITION_DIALOGUES = 48;
export const STEERING_DECOMPOSITION_CASES = 384;
export const STEERING_DECOMPOSITION_DECISION_CALLS = 768;
export const STEERING_DECOMPOSITION_FAILED_ATTEMPT_ALLOWANCE = 32;
export const STEERING_DECOMPOSITION_CHILD_INTERNAL_ALLOWANCE = 12;
export const STEERING_DECOMPOSITION_AUTHORIZATION_MAXIMUM_CALLS =
  STEERING_DECOMPOSITION_DECISION_CALLS +
  STEERING_DECOMPOSITION_FAILED_ATTEMPT_ALLOWANCE -
  STEERING_DECOMPOSITION_CHILD_INTERNAL_ALLOWANCE;
export const STEERING_DECOMPOSITION_ABSOLUTE_READER_ATTEMPT_CEILING =
  STEERING_DECOMPOSITION_DECISION_CALLS + STEERING_DECOMPOSITION_FAILED_ATTEMPT_ALLOWANCE;
export const STEERING_DECOMPOSITION_PER_DIALOGUE_CAP = 30;
export const STEERING_DECOMPOSITION_CALL_PLAN = Object.freeze({
  generation_expected: 1300,
  generation_cap: STEERING_DECOMPOSITION_DIALOGUES * STEERING_DECOMPOSITION_PER_DIALOGUE_CAP,
  decision_readers: STEERING_DECOMPOSITION_DECISION_CALLS,
  failed_attempt_allowance: STEERING_DECOMPOSITION_FAILED_ATTEMPT_ALLOWANCE,
  approximate_total: 2100,
  absolute_cap_total:
    STEERING_DECOMPOSITION_DIALOGUES * STEERING_DECOMPOSITION_PER_DIALOGUE_CAP +
    STEERING_DECOMPOSITION_ABSOLUTE_READER_ATTEMPT_CEILING,
});
export const STEERING_DECOMPOSITION_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-steering-decomposition-run.v1';
export const STEERING_DECOMPOSITION_CHECKPOINT_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-steering-decomposition-checkpoint.v1';

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
    throw new Error(`${label} does not match the registered steering-decomposition manifest`);
  }
}

export function buildSteeringDecompositionAssignments({ seeds = STEERING_DECOMPOSITION_SEEDS } = {}) {
  const worlds = ['world_101_kestrel_signal_lamp', 'world_102_marigold_archive_box'];
  const conditions = ['gated', 'steering_only'];
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

export function guardSteeringDecompositionStudyPlan({ manifest, assignments } = {}) {
  const conditions = ['gated', 'steering_only'];
  const counts = Object.fromEntries(
    conditions.map((condition) => [condition, assignments.filter((row) => row.condition === condition).length]),
  );
  const seedCounts = Object.fromEntries(
    STEERING_DECOMPOSITION_SEEDS.map((seed) => [seed, assignments.filter((row) => row.seed === seed).length]),
  );
  const identities = new Set(assignments.map((row) => `${row.world}:${row.seed}:${row.condition}`));
  const checks = {
    seed_range: JSON.stringify(manifest.seeds) === JSON.stringify(STEERING_DECOMPOSITION_SEEDS),
    dialogue_count: assignments.length === STEERING_DECOMPOSITION_DIALOGUES,
    unique_identity_count: identities.size === STEERING_DECOMPOSITION_DIALOGUES,
    per_condition: Object.values(counts).every((count) => count === 24),
    per_seed: Object.values(seedCounts).every((count) => count === 4),
    turns: manifest.assignment?.turns_per_dialogue === 8,
    learner_profile: manifest.assignment?.learner_profile === 'low_agency',
    case_count: manifest.case_extraction?.expected_case_count === STEERING_DECOMPOSITION_CASES,
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

export function auditSteeringDecompositionSeedFreshness({
  seeds = STEERING_DECOMPOSITION_SEEDS,
  roots = [path.join(ROOT, '.tutor-stub-auto-eval'), '/private/tmp', PRIVATE_ARCHIVE_ROOT],
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
    schema: 'machinespirits.adaptation-refinement.steering-decomposition-seed-freshness.v1',
    zero_model_calls: true,
    status: uniqueHits.length ? 'failed' : 'passed',
    seeds: [...seeds],
    roots: roots.map((entry) => path.resolve(entry)),
    excluded_roots: excluded,
    metadata_files_inspected: inspected.length,
    hits: uniqueHits,
  };
}

export function steeringDecompositionResumeSeedExclusions({
  rootDir,
  repoRoot = ROOT,
  privateArchiveRoot = PRIVATE_ARCHIVE_ROOT,
} = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedRepo = path.resolve(repoRoot);
  const relativeRoot = path.relative(resolvedRepo, resolvedRoot);
  const exclusions = [resolvedRoot];
  if (
    relativeRoot &&
    relativeRoot !== '..' &&
    !relativeRoot.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativeRoot)
  ) {
    exclusions.push(path.join(path.resolve(privateArchiveRoot), 'artifacts', 'tutor-stub-live', relativeRoot));
  }
  return exclusions;
}

export function verifySteeringDecompositionManifest({ manifestPath = DEFAULT_MANIFEST } = {}) {
  const resolvedManifest = path.resolve(ROOT, manifestPath);
  const manifest = readJson(resolvedManifest);
  if (manifest.schema !== 'machinespirits.adaptation-refinement.warrant-steering-decomposition-manifest.v1') {
    throw new Error('steering-decomposition manifest schema mismatch');
  }
  assertExact(manifest.seeds, STEERING_DECOMPOSITION_SEEDS, 'steering-decomposition seeds');
  assertExact(manifest.conditions, ['gated', 'steering_only'], 'steering-decomposition conditions');
  assertExact(
    manifest.planned_calls,
    {
      generation_expected: 1300,
      generation_cap: 1440,
      decision_readers: 768,
      failed_attempt_allowance: 32,
      approximate_total: 2100,
      absolute_cap_total: 2240,
      counter_before: 8355,
      ceiling: 19337,
    },
    'steering-decomposition call plan',
  );
  if (manifest.channels?.presence?.enabled !== false || manifest.channels?.decision?.enabled !== true) {
    throw new Error('steering decomposition must be decision-only');
  }
  const inherited = manifest.inherited_pilot_bindings;
  if (!inherited?.path || !inherited?.sha256 || fileSha256(path.resolve(ROOT, inherited.path)) !== inherited.sha256) {
    throw new Error('steering-decomposition inherited pilot bindings drift');
  }
  const bindings = manifest.channels.decision.digests;
  if (
    fileSha256(DECISION_RUNNER_PATH) !== bindings.reader_runner_sha256 ||
    fileSha256(DECISION_PREPARER_PATH) !== bindings.preparation_and_assembly_sha256
  ) {
    throw new Error('steering-decomposition frozen decision tooling drift');
  }
  for (const world of manifest.worlds || []) {
    const resolved = path.resolve(ROOT, world.path);
    if (!fs.existsSync(resolved) || fileSha256(resolved) !== world.sha256) {
      throw new Error(`steering-decomposition world drift: ${world.id}`);
    }
  }
  const assignments = buildSteeringDecompositionAssignments({ seeds: manifest.seeds });
  const studyPlanGuard = guardSteeringDecompositionStudyPlan({ manifest, assignments });
  if (studyPlanGuard.status !== 'passed') throw new Error('steering-decomposition study-plan guard failed');
  return { manifest, resolvedManifest, assignments, studyPlanGuard };
}

export function printSteeringDecompositionPlan(manifest = null) {
  const plan = manifest?.planned_calls || {
    generation_expected: 1300,
    decision_readers: 768,
    failed_attempt_allowance: 32,
    approximate_total: 2100,
  };
  return [
    'Adaptive-warrant steering decomposition: HOLD / zero-call plan only.',
    `Entry point: ${relativeToRoot(SCRIPT_PATH)}`,
    `48 dialogues; seeds 536-540, 542-546, 548, 549; generation approximately ${plan.generation_expected}; decision readers ${plan.decision_readers}; failed-attempt allowance ${plan.failed_attempt_allowance}; run cap ${plan.absolute_cap_total || 2240} calls.`,
    'Presence channel: disabled. Measures 7 and 8: report-only from stored events, not reader-validated.',
    `A paid run requires committed ${REQUIRED_GO_NOTE} plus --accept-charges.`,
  ].join('\n');
}

export function validateSteeringDecompositionGoNote(goNotePath) {
  if (relativeToRoot(path.resolve(ROOT, goNotePath || '')) !== REQUIRED_GO_NOTE) {
    throw new Error(`steering decomposition refuses: --go-note must be ${REQUIRED_GO_NOTE}`);
  }
  const resolved = path.resolve(ROOT, goNotePath);
  if (!fs.existsSync(resolved)) throw new Error('steering decomposition refuses: reviewer note 103 is absent');
  let committed;
  try {
    committed = execFileSync('git', ['show', `HEAD:${REQUIRED_GO_NOTE}`], { cwd: ROOT });
  } catch {
    throw new Error('steering decomposition refuses: reviewer note 103 is not committed at HEAD');
  }
  const onDisk = fs.readFileSync(resolved);
  if (!committed.equals(onDisk))
    throw new Error('steering decomposition refuses: reviewer note 103 has uncommitted drift');
  const text = onDisk.toString('utf8');
  // The pinned path plus the byte check above is the gate here. The old
  // required-substring 'GO' added nothing: it matched ALGO and GOAL as well,
  // and a draft committed at the pinned path would carry it in its own title.
  assertReviewerGoNoteContent(text, { label: 'reviewer note 103', refusal: 'steering decomposition refuses' });
  for (const required of [
    'run-adaptive-warrant-steering-decomposition.js',
    '--accept-charges',
    '--out',
    '--instrument-freeze',
    'steering_only',
    '536',
    '549',
    '384',
    '768',
    '800',
    '2,240',
    '6a64b31f',
  ]) {
    if (!text.includes(required))
      throw new Error(`steering decomposition refuses: reviewer note 103 lacks ${required}`);
  }
  if (!/\bhuman\b.{0,80}\b(?:GO|approv(?:al|ed))\b/isu.test(text)) {
    throw new Error('steering decomposition refuses: reviewer note 103 lacks explicit human approval');
  }
  return { path: resolved, relative_path: REQUIRED_GO_NOTE, sha256: sha256(onDisk) };
}

export function guardSteeringDecompositionReaderAllowance({ callsAttempted = 0 } = {}) {
  const remaining = STEERING_DECOMPOSITION_ABSOLUTE_READER_ATTEMPT_CEILING - Number(callsAttempted || 0);
  if (remaining <= 0) throw new Error('steering-decomposition 32-attempt reader allowance exhausted');
  return { status: 'passed', calls_attempted: callsAttempted, attempts_remaining: remaining };
}

export async function runAfterSteeringDecompositionAllowanceGuard({ callsAttempted = 0, launch } = {}) {
  const guard = guardSteeringDecompositionReaderAllowance({ callsAttempted });
  if (typeof launch !== 'function') throw new Error('steering-decomposition reader launch callback is required');
  return { guard, result: await launch() };
}

export function guardSteeringDecompositionDecisionCollection(collection = {}) {
  const request = collection.authorizationRequest || collection.authorization_request;
  const manifest = collection.manifest;
  const checks = {
    corpus_cases: manifest?.corpus?.cases === STEERING_DECOMPOSITION_CASES,
    readers: Array.isArray(manifest?.readers) && manifest.readers.length === 2,
    cases_per_reader:
      Array.isArray(manifest?.readers) &&
      manifest.readers.every((reader) => reader.batches?.length === STEERING_DECOMPOSITION_CASES),
    one_case_batches:
      Array.isArray(manifest?.readers) &&
      manifest.readers.every((reader) => reader.batches?.every((batch) => batch.required_sample_ids?.length === 1)),
    planned_calls: request?.call_budget?.planned_calls === STEERING_DECOMPOSITION_DECISION_CALLS,
    authorization_maximum: request?.call_budget?.maximum_calls === STEERING_DECOMPOSITION_AUTHORIZATION_MAXIMUM_CALLS,
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    zero_model_calls: true,
    channel: 'decision',
    presence_channel_built: false,
    expected_cases: STEERING_DECOMPOSITION_CASES,
    expected_calls: STEERING_DECOMPOSITION_DECISION_CALLS,
    checks,
  };
}

function deliveredActionFamily(turnRecord = {}) {
  return (
    turnRecord.actual_action_family ||
    turnRecord.delivered_action_family ||
    turnRecord.deliveredResponseConfiguration?.action_family ||
    turnRecord.responseConfiguration?.action_family ||
    turnRecord.preFinalWarrantSelection?.action_family ||
    null
  );
}

export function guardSteeringOnlyZeroChallenge({ completed = [] } = {}) {
  const violations = [];
  for (const dialogue of completed.filter((row) => row.condition === 'steering_only')) {
    const tracePath = dialogue.trace_path || dialogue.result?.tracePath;
    if (!tracePath || !fs.existsSync(tracePath)) {
      violations.push({ dialogue_id: dialogue.id, turn: null, action_family: null, reason: 'missing_sealed_trace' });
      continue;
    }
    for (const row of readJsonl(tracePath)) {
      if (row?.type !== 'turn_complete' || !row.turnRecord) continue;
      const family = deliveredActionFamily(row.turnRecord);
      if (family === 'challenge_resistance') {
        violations.push({
          dialogue_id: dialogue.id,
          turn: Number(row.turnRecord.turn),
          action_family: family,
          reason: 'challenge_resistance_delivered_in_steering_only',
        });
      }
    }
  }
  const expectedDialogues = STEERING_DECOMPOSITION_DIALOGUES / 2;
  const observedDialogues = completed.filter((row) => row.condition === 'steering_only').length;
  const checks = {
    steering_only_dialogues: observedDialogues === expectedDialogues,
    delivered_challenges: violations.length === 0,
  };
  return {
    schema: 'machinespirits.adaptation-refinement.steering-decomposition-zero-challenge-guard.v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    zero_model_calls: true,
    checks,
    observed_steering_only_dialogues: observedDialogues,
    violations,
  };
}

export function guardSteeringDecompositionAssembly({ collectionGuard, readerRun, acceptanceAudit } = {}) {
  const checks = {
    frozen_cases: collectionGuard?.checks?.corpus_cases === true,
    planned_reads: collectionGuard?.checks?.planned_calls === true,
    accepted_responses: acceptanceAudit?.responses_validated === STEERING_DECOMPOSITION_DECISION_CALLS,
    within_allowance: Number(readerRun?.calls_attempted || 0) <= STEERING_DECOMPOSITION_ABSOLUTE_READER_ATTEMPT_CEILING,
    child_complete: readerRun?.status === 'complete',
  };
  return {
    schema: 'machinespirits.adaptation-refinement.steering-decomposition-assembly-gate.v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    zero_model_calls: true,
    expected_cases: STEERING_DECOMPOSITION_CASES,
    expected_accepted_responses: STEERING_DECOMPOSITION_DECISION_CALLS,
    reader_attempt_ceiling: STEERING_DECOMPOSITION_ABSOLUTE_READER_ATTEMPT_CEILING,
    checks,
  };
}

export function buildSteeringDecompositionDryRun({
  manifestPath = DEFAULT_MANIFEST,
  rootDir = '/tmp/steering-decomposition-dry-run',
} = {}) {
  const guarded = verifySteeringDecompositionManifest({ manifestPath });
  const manifest = { ...guarded.manifest, interleaved_condition_assignment: guarded.assignments };
  const jobs = buildOutcomePilotJobs({ manifest, rootDir, dryRun: true, studyLabel: 'steering-decomposition' });
  const steeringJobs = jobs.filter((job) => job.condition === 'steering_only');
  const gatedJobs = jobs.filter((job) => job.condition === 'gated');
  const checks = {
    study_plan: guarded.studyPlanGuard.status === 'passed',
    job_count: jobs.length === STEERING_DECOMPOSITION_DIALOGUES,
    all_dry_run: jobs.every((job) => job.dryRun && job.command.includes('--dry-run')),
    steering_only_active: steeringJobs.every((job) => job.warrantGateMode === 'active'),
    steering_only_unselectable: steeringJobs.every((job) => job.warrantChallengeResistance === 'unselectable'),
    gated_unchanged: gatedJobs.every(
      (job) =>
        job.warrantGateMode === 'active' &&
        job.warrantChallengeResistance === 'selectable' &&
        !job.command.includes('--warrant-challenge-resistance'),
    ),
  };
  return {
    schema: 'machinespirits.adaptation-refinement.steering-decomposition-dry-run.v1',
    status: Object.values(checks).every(Boolean) ? 'passed' : 'failed',
    zero_model_calls: true,
    model_calls: 0,
    checks,
    jobs: jobs.map((job) => ({
      id: job.id,
      condition: job.condition,
      warrant_gate_mode: job.warrantGateMode,
      warrant_challenge_resistance: job.warrantChallengeResistance,
      dry_run: job.dryRun,
    })),
  };
}

export function createSteeringDecompositionBudget({ checkpointPath, checkpoint = null } = {}) {
  const state = checkpoint || {
    schema: STEERING_DECOMPOSITION_CHECKPOINT_SCHEMA,
    status: 'prepared',
    call_budget: {
      plan: { ...STEERING_DECOMPOSITION_CALL_PLAN },
      actual: { generation: 0, decision_readers: 0, total: 0 },
      events: [],
    },
    dialogues: [],
    quarantined_dialogues: [],
  };
  if (state.schema !== STEERING_DECOMPOSITION_CHECKPOINT_SCHEMA)
    throw new Error('steering-decomposition checkpoint schema mismatch');
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
        ? STEERING_DECOMPOSITION_CALL_PLAN.generation_cap
        : STEERING_DECOMPOSITION_ABSOLUTE_READER_ATTEMPT_CEILING;
    if (state.call_budget.actual[phase] + count > ceiling) {
      throw new Error(`steering-decomposition ${phase} call ceiling exceeded`);
    }
    state.call_budget.actual[phase] += count;
    state.call_budget.events.push({ type: 'model_call_budget_reserved', phase, count, ...event });
    persist();
  };
  persist();
  return { state, reserveMany, persist };
}

export function resolveSteeringDecompositionLaunchCommit({ checkpoint, semanticPreflight } = {}) {
  const preflightCommit = semanticPreflight?.bindings?.source_commit;
  if (!preflightCommit) throw new Error('steering-decomposition reused semantic preflight launch stamp missing');
  const freezeCommit = checkpoint?.freeze?.source_commit;
  if (freezeCommit && freezeCommit !== preflightCommit) {
    throw new Error('steering-decomposition reused semantic preflight launch stamp drift');
  }
  return preflightCommit;
}

export function shouldReuseSteeringDecompositionLaunchArtifacts({ resume = false, readerResume = false } = {}) {
  return Boolean(resume && readerResume);
}

function emitSteeringDecompositionFreeze({
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
      conditions: ['gated', 'steering_only'],
      turns_per_dialogue: 8,
      total_cases: STEERING_DECOMPOSITION_CASES,
    },
    protocol: binding(
      path.join(ROOT, 'docs/adaptation-refinement/relay/101-reviewer-registration-steering-decomposition.md'),
    ),
    study_plan: binding(studyPlanPath),
    source_commit: sourceCommit,
    semantic_instrument: {
      preflight: binding(semanticPreflightPath),
      schema_acceptance: binding(schemaAcceptancePath),
    },
    annotation_handbook: binding(handbookPath),
    corpus: { ...binding(corpusPath), cases: STEERING_DECOMPOSITION_CASES },
    key: binding(keyPath),
    steering_decomposition: true,
    channels: { decision: true, presence: false },
  };
  atomicWriteJson(outputPath, freeze);
  validateOutcomeFreezeFormForFrozenDecisionRunner(freeze);
  return freeze;
}

export function auditSteeringDecompositionDecisionResponseContracts({
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
  const expected = STEERING_DECOMPOSITION_DECISION_CALLS;
  if (rows.length !== expected)
    throw new Error(`steering-decomposition response contract audit expected ${expected}, got ${rows.length}`);
  const audit = {
    schema: 'machinespirits.adaptation-refinement.steering-decomposition-response-acceptance-audit.v1',
    status: 'passed',
    zero_model_calls: true,
    acceptance_rule: 'full deterministic contract before admission to the steering-decomposition score',
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

export async function executeSteeringDecomposition({
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
  if (!acceptCharges) throw new Error('steering decomposition refuses: --accept-charges is required');
  const goNote = validateSteeringDecompositionGoNote(goNotePath);
  const guarded = verifySteeringDecompositionManifest({ manifestPath });
  if (git(['status', '--porcelain']))
    throw new Error('steering-decomposition launch requires a clean committed worktree');
  if (!outputDir) throw new Error('steering-decomposition launch requires --out');
  if (!instrumentFreezePath) throw new Error('steering-decomposition launch requires --instrument-freeze');
  const rootDir = path.resolve(ROOT, outputDir);
  const checkpointPath = path.join(rootDir, 'steering-decomposition-checkpoint.json');
  if (fs.existsSync(rootDir) && !resume) throw new Error('steering-decomposition output exists; pass --resume');
  if (resume && !fs.existsSync(checkpointPath))
    throw new Error('--resume requires a steering-decomposition checkpoint');
  const freshness = auditSteeringDecompositionSeedFreshness({
    roots: seedFreshnessRoots,
    excludeRoots: resume ? steeringDecompositionResumeSeedExclusions({ rootDir }) : [],
  });
  if (freshness.status !== 'passed') {
    throw new Error(
      `steering-decomposition seed freshness failed: ${freshness.hits.map((row) => `s${row.seed}:${row.path}`).join(', ')}`,
    );
  }

  const sourceFreeze = readJson(path.resolve(instrumentFreezePath));
  if (fileSha256(path.resolve(instrumentFreezePath)) !== guarded.manifest.instrument_freeze_sha256) {
    throw new Error('steering-decomposition r52 instrument freeze drift');
  }
  validateOutcomeFreezeFormForFrozenDecisionRunner(sourceFreeze);
  const handbookPath = sourceFreeze.annotation_handbook?.path;
  if (!handbookPath || fileSha256(handbookPath) !== guarded.manifest.channels.decision.digests.handbook_sha256) {
    throw new Error('steering-decomposition decision handbook drift');
  }
  const checkpoint = resume ? readJson(checkpointPath) : null;
  const budget = createSteeringDecompositionBudget({ checkpointPath, checkpoint });
  const promptAuditPath = path.join(rootDir, 'prompt-audit-preflight.json');
  const semanticPreflightPath = path.join(rootDir, 'semantic-brittleness-preflight.json');
  const schemaAcceptancePath = path.join(rootDir, 'semantic-schema-acceptance-carryover.json');
  const decisionCollectionDir = path.join(rootDir, 'decision-collection');
  const decisionRunDir = path.join(rootDir, 'decision-readers');
  const decisionRunPath = path.join(decisionRunDir, 'decision-reader-run.json');
  const readerResume = resume && fs.existsSync(decisionRunPath);
  const reuseLaunchArtifacts = shouldReuseSteeringDecompositionLaunchArtifacts({ resume, readerResume });

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
      authorizedBy: 'docs/adaptation-refinement/relay/101-reviewer-registration-steering-decomposition.md',
    });
  } else {
    for (const required of [promptAuditPath, semanticPreflightPath, schemaAcceptancePath]) {
      if (!fs.existsSync(required)) throw new Error(`steering-decomposition resume artifact missing: ${required}`);
    }
  }
  const semanticPreflight = readJson(semanticPreflightPath);
  const launchCommit = reuseLaunchArtifacts
    ? resolveSteeringDecompositionLaunchCommit({ checkpoint, semanticPreflight })
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
  if (completed.length !== STEERING_DECOMPOSITION_DIALOGUES) {
    budget.state.status = 'generation_quarantine_stop';
    budget.persist();
    return budget.state;
  }

  const zeroChallengeGuard = guardSteeringOnlyZeroChallenge({ completed });
  budget.state.pre_call_guards.zero_challenge_validity = zeroChallengeGuard;
  budget.persist();
  if (zeroChallengeGuard.status !== 'passed') {
    budget.state.status = 'generation_zero_challenge_guard_stop';
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
        throw new Error('steering-decomposition reused freeze artifact drift');
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
      samplingSeed: 'steering-decomposition-frozen-order',
    });
    const fingerprintGuard = guardOutcomeAnnotationFingerprints({
      cases: built.corpus.cases,
      keyCases: built.key.cases,
      expectedCount: STEERING_DECOMPOSITION_CASES,
    });
    budget.state.post_generation_fingerprint_guard = fingerprintGuard;
    budget.persist();
    artifacts = writeOutcomeCorpusArtifacts({ rootDir, built });
    const studyPlanPath = path.join(rootDir, 'steering-decomposition-study-plan.json');
    atomicWriteJson(studyPlanPath, {
      schema: STEERING_DECOMPOSITION_SCHEMA,
      manifest: budget.state.manifest,
      jobs,
      study_plan_guard: guarded.studyPlanGuard,
      seed_freshness: freshness,
    });
    freezePath = path.join(rootDir, 'annotation-freeze-manifest.json');
    freeze = emitSteeringDecompositionFreeze({
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
      maxAnnotationCalls: STEERING_DECOMPOSITION_AUTHORIZATION_MAXIMUM_CALLS,
      preflightPath: semanticPreflightPath,
    });
  }
  const decisionCollectionGuard = guardSteeringDecompositionDecisionCollection(decisionCollection);
  if (decisionCollectionGuard.status !== 'passed') {
    throw new Error('steering-decomposition decision-only collection shape mismatch');
  }
  budget.state.pre_call_guards.decision_collection = decisionCollectionGuard;
  budget.state.freeze = { path: freezePath, source_commit: freeze.source_commit, sha256: fileSha256(freezePath) };
  budget.state.status = 'decision_readers';
  budget.persist();

  const existingRun = fs.existsSync(decisionRunPath) ? readJson(decisionRunPath) : null;
  if (existingRun?.status !== 'complete') {
    const callsBefore = Number(existingRun?.calls_attempted || 0);
    const { result } = await runAfterSteeringDecompositionAllowanceGuard({
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
  if (run.status !== 'complete') throw new Error('steering-decomposition decision reader run is incomplete');
  if (run.calls_attempted > STEERING_DECOMPOSITION_ABSOLUTE_READER_ATTEMPT_CEILING) {
    throw new Error('steering-decomposition decision reader allowance overrun');
  }
  const assemblyRun = writeOutcomePilotAssemblyRunView({
    runPath: decisionRunPath,
    outputPath: path.join(rootDir, 'decision-reader-assembly-run-view.json'),
  });
  const acceptanceAudit = auditSteeringDecompositionDecisionResponseContracts({
    collectionManifest: decisionCollection.manifest,
    responseDir: decisionRunDir,
    outputPath: path.join(rootDir, 'decision-response-acceptance-audit.json'),
  });
  const assemblyGate = guardSteeringDecompositionAssembly({
    collectionGuard: decisionCollectionGuard,
    readerRun: run,
    acceptanceAudit,
  });
  budget.state.assembly_gate = assemblyGate;
  budget.persist();
  if (assemblyGate.status !== 'passed') throw new Error('steering-decomposition assembly gate failed');
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
  const score = scoreAdaptiveWarrantSteeringDecomposition({
    decision_reader_preflight: { ...DECISION_READER_INSTRUMENT_BINDINGS },
    dialogues,
    decision_cases: decisionCases,
    decision_reader_run_record_path: assemblyRun.path,
    generation_time_cases: built.key.cases,
  });
  const scorePath = path.join(rootDir, 'steering-decomposition-score.json');
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
  return `Usage:\n  node scripts/run-adaptive-warrant-steering-decomposition.js\n  node scripts/run-adaptive-warrant-steering-decomposition.js --dry-run\n  node scripts/run-adaptive-warrant-steering-decomposition.js --go-note ${REQUIRED_GO_NOTE} --accept-charges --out <fresh-dir> --instrument-freeze <freeze> [--resume]\n`;
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
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(usage());
    return;
  }
  if (values['dry-run']) {
    const result = buildSteeringDecompositionDryRun({ manifestPath: values.manifest });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (!values['accept-charges']) {
    const guarded = verifySteeringDecompositionManifest({ manifestPath: values.manifest });
    process.stdout.write(`${printSteeringDecompositionPlan(guarded.manifest)}\n`);
    return;
  }
  const result = await executeSteeringDecomposition({
    manifestPath: values.manifest,
    goNotePath: values['go-note'],
    acceptCharges: true,
    outputDir: values.out,
    instrumentFreezePath: values['instrument-freeze'],
    resume: values.resume,
  });
  process.stdout.write(
    `${JSON.stringify({ status: result.status, checkpoint: path.resolve(ROOT, values.out, 'steering-decomposition-checkpoint.json') })}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(`[steering-decomposition] error: ${error.message}`);
    process.exitCode = 1;
  });
}
