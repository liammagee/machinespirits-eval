#!/usr/bin/env node

/**
 * Manifest-bound runner for the registered adaptive-warrant outcome pilot.
 *
 * The default invocation is a zero-call plan display. A paid path requires a
 * fresh committed reviewer go note and --accept-charges. Direction 065 keeps
 * that authorization deliberately unavailable while this harness is built.
 */

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  OUTCOME_DEFAULT_RUN_SHAPE,
  OUTCOME_PER_DIALOGUE_GENERATION_CAP,
  OUTCOME_RUN_SHAPES,
  guardOutcomePilotPreparation,
  guardOutcomeStandingPermissionMenu,
  resolveOutcomeRunShape,
} from './prepare-adaptive-warrant-outcome-study.js';
import {
  OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
  OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES,
  resolveOutcomeStudyRunConfigurations,
  PRESENCE_CHANNEL_CAPS,
  extractOutcomeDialogueFromTraceRows,
  scoreAdaptiveWarrantOutcomeStudy,
} from './score-adaptive-warrant-outcome-study.js';
import {
  annotationCaseFingerprint,
  buildAdaptiveWarrantNaturalSemanticArtifacts,
  buildBlindedAnnotationCorpus,
  collectAdaptiveWarrantStudyJobResult,
} from './run-adaptive-warrant-baseline-study.js';
import {
  adaptiveWarrantSemanticInstrumentBindings,
  validateAdaptiveWarrantSemanticPreflightArtifact,
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult,
} from '../services/adaptiveWarrantSemanticPreflight.js';
import {
  assembleAdaptiveWarrantAnnotationResponse,
  prepareAdaptiveWarrantAnnotationBatches,
} from './prepare-adaptive-warrant-annotation-batches.js';
import {
  assembleAdaptiveWarrantSemanticAnnotationResponse,
  prepareAdaptiveWarrantSemanticAnnotationBatches,
} from './prepare-adaptive-warrant-semantic-annotations.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_MANIFEST = 'docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json';
const CONSUMED_GO_NOTE = 'docs/adaptation-refinement/relay/063a-reviewer-go-note-outcome-pilot.md';

export const OUTCOME_PILOT_RUN_SCHEMA = 'machinespirits.adaptation-refinement.warrant-outcome-pilot-run.v1';
export const OUTCOME_PILOT_CHECKPOINT_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-outcome-pilot-checkpoint.v1';
export const OUTCOME_PILOT_FREEZE_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-mechanism-validation-freeze.v1';
// Corrected under ruling 069a: a live 8-turn dialogue reserves ~26 low-level
// model calls (report 069 measured unit), so generation is budgeted as a cap
// of 30 per dialogue, not 1. Human approved the corrected budget in advance.
export const OUTCOME_PILOT_PER_DIALOGUE_CAP = OUTCOME_PER_DIALOGUE_GENERATION_CAP;
// The one paid-call ceiling the whole warrant campaign runs under. Every
// manifest states where the counter stood when it was sealed; none may plan
// past this line.
export const OUTCOME_CAMPAIGN_CALL_CEILING = 19337;
// The pilot's plan is one entry in the shape registry, not a second copy of the
// numbers. The registry derives every count from the seed list, so the pilot
// shape still reads 540 + 288 + 288 = 1116 and the main block reads four times
// that. Kept as a named export because the checkpoint and the tests use it.
export const OUTCOME_PILOT_CALL_PLAN = OUTCOME_DEFAULT_RUN_SHAPE.planned_calls;
export const OUTCOME_PILOT_READER_CONCURRENCY = 2;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function relativeToRoot(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).split(path.sep).join('/');
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function assertExactObject(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match the frozen manifest`);
  }
}

export function printOutcomePilotPlan(manifest = null) {
  const shape = resolveOutcomeRunShape(manifest?.run_shape ?? null);
  const plan = manifest?.planned_calls || shape.planned_calls;
  return [
    `Adaptive-warrant outcome ${shape.name}: HOLD / zero-call plan only.`,
    `Entry point: ${relativeToRoot(SCRIPT_PATH)}`,
    `Dialogues: ${shape.dialogues}; seeds: ${shape.seeds[0]}-${shape.seeds[shape.seeds.length - 1]}; cases per reader: ${shape.cases}.`,
    `Generation call cap: ${plan.generation ?? shape.planned_calls.generation}; presence readers: ${plan.presence_readers ?? shape.planned_calls.presence_readers}; decision readers: ${plan.decision_readers ?? shape.planned_calls.decision_readers}; total: ${plan.total ?? shape.planned_calls.total}.`,
    'A paid run requires --go-note <fresh committed reviewer go note> --accept-charges.',
    `The consumed note ${CONSUMED_GO_NOTE} is never accepted.`,
  ].join('\n');
}

/** 4464 matches "4464" and "4,464", because a GO note is written for a reader. */
function callCountPattern(total) {
  const digits = String(total);
  const grouped = digits.replace(/\B(?=(\d{3})+$)/gu, ',?');
  return new RegExp(grouped, 'u');
}

export function validateOutcomePilotGoNote(goNotePath, { shape = OUTCOME_DEFAULT_RUN_SHAPE } = {}) {
  if (!goNotePath?.trim()) throw new Error('outcome pilot refuses: --go-note is required');
  const resolved = path.resolve(ROOT, goNotePath);
  const relative = relativeToRoot(resolved);
  if (relative === CONSUMED_GO_NOTE) throw new Error('outcome pilot refuses: GO note 063a is consumed');
  if (!relative.startsWith('docs/adaptation-refinement/relay/') || !relative.endsWith('.md')) {
    throw new Error('outcome pilot refuses: --go-note must name a relay markdown file');
  }
  if (!fs.existsSync(resolved)) throw new Error(`outcome pilot refuses: go note not found: ${relative}`);
  let committed;
  try {
    committed = execFileSync('git', ['show', `HEAD:${relative}`], { cwd: ROOT });
  } catch {
    throw new Error('outcome pilot refuses: go note is not committed at HEAD');
  }
  const onDisk = fs.readFileSync(resolved);
  if (!committed.equals(onDisk)) throw new Error('outcome pilot refuses: go note differs from committed bytes');
  const text = onDisk.toString('utf8');
  if (!text.includes('run-adaptive-warrant-outcome-pilot.js')) {
    throw new Error('outcome pilot refuses: go note does not name the executable entry point');
  }
  if (!/\bGO\b/u.test(text) || !callCountPattern(shape.planned_calls.total).test(text)) {
    throw new Error(
      `outcome ${shape.name} refuses: go note lacks the GO and the ${shape.planned_calls.total}-call scope`,
    );
  }
  if (!text.includes(String(shape.seeds[0])) || !text.includes(String(shape.seeds[shape.seeds.length - 1]))) {
    throw new Error(
      `outcome ${shape.name} refuses: go note does not state the seed range ${shape.seeds[0]}-${shape.seeds[shape.seeds.length - 1]}`,
    );
  }
  return { path: resolved, relative_path: relative, sha256: sha256(onDisk) };
}

/**
 * The size a caller typed must match the size the manifest states. Passing no
 * --shape is allowed: the manifest is the authority, and the flag only lets a
 * caller say out loud which run they think they are starting.
 */
export function assertOutcomeShapeFlag({ expectedShape, shape }) {
  if (expectedShape && expectedShape !== shape.name) {
    throw new Error(`outcome run refuses: --shape ${expectedShape} does not match the manifest size ${shape.name}`);
  }
}

/**
 * A checkpoint written by one run size must never be resumed into another: the
 * spent-call tally and the plan inside it belong to that run. A checkpoint that
 * names no size is a pilot's, as every one written before the registry was.
 */
export function assertOutcomeCheckpointShape({ checkpoint, shape }) {
  if (!checkpoint) return;
  const carried = checkpoint.run_shape ?? OUTCOME_DEFAULT_RUN_SHAPE.name;
  if (carried !== shape.name) {
    throw new Error(`--resume refuses: the checkpoint is a ${carried} run and the manifest is a ${shape.name} run`);
  }
}

export function verifyOutcomePilotManifestBindings({
  manifestPath = DEFAULT_MANIFEST,
  expectedLearnerProfile = null,
} = {}) {
  const resolvedManifest = path.resolve(ROOT, manifestPath);
  const manifest = readJson(resolvedManifest);
  if (manifest.schema !== 'machinespirits.adaptation-refinement.warrant-outcome-pilot-manifest.v1') {
    throw new Error('outcome pilot manifest schema mismatch');
  }
  const standing = manifest.standing_permission || {};
  const boundFiles = [
    [standing.menu_json, standing.menu_json_sha256, 'menu JSON'],
    [standing.menu_text, standing.menu_text_sha256, 'menu text'],
    ...Object.entries(standing.source_sha256 || {}).map(([file, digest]) => [file, digest, `source pin ${file}`]),
    ...(manifest.worlds || []).map((world) => [world.path, world.sha256, `world ${world.id}`]),
  ];
  for (const [file, expected, label] of boundFiles) {
    if (!file || !/^[a-f0-9]{64}$/u.test(expected || '')) throw new Error(`${label} binding is missing`);
    const resolved = path.resolve(ROOT, file);
    if (!fs.existsSync(resolved) || fileSha256(resolved) !== expected) {
      throw new Error(`${label} SHA mismatch`);
    }
  }
  const menu = readJson(path.resolve(ROOT, standing.menu_json));
  const menuGuard = guardOutcomeStandingPermissionMenu(menu);
  // The frozen menu .txt is the menu_text field plus exactly one trailing
  // newline; the pinned SHA covers the file bytes, so compare against that.
  if (
    menuGuard.status !== 'passed' ||
    `${menu.menu_text}\n` !== fs.readFileSync(path.resolve(ROOT, standing.menu_text), 'utf8')
  ) {
    throw new Error('standing-permission menu byte guard failed');
  }
  // A manifest that names no size is a pilot manifest, as every sealed one is.
  const shape = resolveOutcomeRunShape(manifest.run_shape ?? null);
  assertExactObject(manifest.seeds, [...shape.seeds], `${shape.name} seeds`);
  const plan = manifest.planned_calls || {};
  assertExactObject(
    {
      generation: plan.generation,
      presence_readers: plan.presence_readers,
      decision_readers: plan.decision_readers,
      total: plan.total,
    },
    { ...shape.planned_calls },
    `${shape.name} call plan`,
  );
  // The counter fields are not frozen by value — a later run starts from a
  // higher counter — so they are checked for agreement with each other and with
  // the one ceiling the campaign has. A manifest whose sums do not close is
  // refused just as firmly as one whose call counts are wrong.
  if (
    plan.ceiling !== OUTCOME_CAMPAIGN_CALL_CEILING ||
    !Number.isInteger(plan.counter_before) ||
    plan.counter_before < 0 ||
    plan.counter_after_if_completed !== plan.counter_before + plan.total ||
    plan.remaining_after_if_completed !== plan.ceiling - plan.counter_after_if_completed ||
    plan.remaining_after_if_completed < 0 ||
    typeof plan.arithmetic !== 'string' ||
    !plan.arithmetic.includes(String(shape.planned_calls.total))
  ) {
    throw new Error(`outcome ${shape.name} call-plan counter arithmetic does not close`);
  }
  if (
    manifest.interleaved_condition_assignment?.length !== shape.dialogues ||
    manifest.case_extraction?.dialogues !== shape.dialogues ||
    manifest.case_extraction?.turns_per_dialogue !== shape.turns_per_dialogue ||
    manifest.case_extraction?.expected_case_count !== shape.cases ||
    manifest.presence_channel?.readers !== shape.readers_per_channel ||
    manifest.decision_channel?.readers !== shape.readers_per_channel
  ) {
    throw new Error(`outcome ${shape.name} manifest matrix or reader cardinality mismatch`);
  }
  // A manifest that names no persona is an A1 manifest, and A1 is low_agency.
  // The guard fingerprints the runs the manifest actually plans, so the guarded
  // pole is checked against the burned corpora as itself, not as the passive one.
  const manifestLearnerProfile = manifest.learner_profile || OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE;
  if (expectedLearnerProfile && expectedLearnerProfile !== manifestLearnerProfile) {
    throw new Error(
      `outcome pilot refuses: learner profile ${expectedLearnerProfile} does not match the manifest persona ${manifestLearnerProfile}`,
    );
  }
  const preparation = guardOutcomePilotPreparation({
    worldPaths: manifest.worlds.map((world) => world.path),
    shape,
    seeds: manifest.seeds,
    learnerProfile: manifestLearnerProfile,
  });
  if (preparation.status !== 'passed') throw new Error('prepared-run identity guard failed');
  return { manifest, resolvedManifest, menuGuard, preparation, shape };
}

export function verifyOutcomePilotReaderBindings({
  manifest,
  instrumentFreezePath,
  preflightPath,
  schemaAcceptancePath,
  expectedSourceCommit = null,
  reuseLaunchArtifacts = false,
} = {}) {
  if (!instrumentFreezePath || !preflightPath || !schemaAcceptancePath) {
    throw new Error('outcome pilot reader bindings require a frozen instrument, preflight, and schema acceptance');
  }
  const freeze = readJson(path.resolve(instrumentFreezePath));
  validateOutcomeFreezeFormForFrozenDecisionRunner(freeze);
  const sourceCommit = expectedSourceCommit || git(['rev-parse', 'HEAD']);
  validateOutcomePilotZeroCallArtifacts({
    preflightPath,
    schemaAcceptancePath,
    expectedSourceCommit: sourceCommit,
    reuseLaunchArtifacts,
  });
  const bindings = adaptiveWarrantSemanticInstrumentBindings({ sourceCommit });
  const presence = manifest.presence_channel.digests;
  const checks = {
    extraction_schema_digest: bindings.extraction_schema.digest === presence.extraction_schema_digest,
    reader_digest: bindings.reader_schema_digest === presence.reader_digest,
    semantic_preparer:
      fileSha256(path.join(ROOT, 'scripts/prepare-adaptive-warrant-semantic-annotations.js')) ===
      presence.preparer_sha256,
    provider_response_schema:
      readJson(path.resolve(schemaAcceptancePath)).response_schema?.sha256 === presence.provider_response_schema_sha256,
    decision_preparer:
      fileSha256(path.join(ROOT, 'scripts/prepare-adaptive-warrant-annotation-batches.js')) ===
      manifest.decision_channel.digests.preparation_and_assembly_sha256,
    decision_runner:
      fileSha256(path.join(ROOT, 'scripts/run-adaptive-warrant-decision-readers.js')) ===
      manifest.decision_channel.digests.reader_runner_sha256,
    decision_handbook:
      fileSha256(freeze.annotation_handbook.path) === manifest.decision_channel.digests.handbook_sha256,
  };
  if (Object.values(checks).some((pass) => !pass)) {
    throw new Error(
      `outcome pilot frozen reader binding mismatch: ${Object.entries(checks)
        .filter(([, pass]) => !pass)
        .map(([name]) => name)
        .join(', ')}`,
    );
  }
  return { status: 'passed', checks, freeze };
}

export function validateOutcomePilotZeroCallArtifacts({
  preflightPath,
  schemaAcceptancePath,
  expectedSourceCommit,
  reuseLaunchArtifacts = false,
} = {}) {
  const resolvedPreflight = path.resolve(preflightPath);
  const resolvedSchemaAcceptance = path.resolve(schemaAcceptancePath);
  const preflight = readJson(resolvedPreflight);
  if (reuseLaunchArtifacts) {
    if (
      preflight.status !== 'passed' ||
      preflight.verdict !== 'instrument_ready' ||
      !Array.isArray(preflight.checks) ||
      preflight.checks.some((check) => check.status !== 'pass') ||
      preflight.bindings?.source_commit !== expectedSourceCommit
    ) {
      throw new Error('outcome pilot reused brittleness preflight launch stamp mismatch');
    }
  } else {
    validateAdaptiveWarrantSemanticPreflightArtifact({ artifact: preflight, expectedSourceCommit });
  }
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult({
    artifact: readJson(resolvedSchemaAcceptance),
    expectedSourceCommit,
    expectedPreflightSha256: fileSha256(resolvedPreflight),
  });
  return { status: 'passed', source_commit: expectedSourceCommit, reused: reuseLaunchArtifacts };
}

const REUSABLE_COLLECTION_FILES = Object.freeze({
  presence: {
    manifest: 'semantic-annotation-collection-manifest.json',
    authorization: 'semantic-annotation-authorization-request.json',
    manifestBinding: 'manifest_sha256',
    schemaPath: 'response_schema_path',
    schemaSha256: 'response_schema_sha256',
  },
  decision: {
    manifest: 'annotation-collection-manifest.json',
    authorization: 'annotation-authorization-request.json',
    manifestBinding: 'collection_manifest_sha256',
    schemaPath: 'output_schema_path',
    schemaSha256: 'output_schema_sha256',
  },
});

export function reuseOutcomePilotReaderCollection({ collectionDir, channel } = {}) {
  const files = REUSABLE_COLLECTION_FILES[channel];
  if (!files) throw new Error(`outcome pilot collection reuse has unknown channel ${channel}`);
  const resolvedCollection = path.resolve(collectionDir);
  const manifestPath = path.join(resolvedCollection, files.manifest);
  const authorizationRequestPath = path.join(resolvedCollection, files.authorization);
  if (!fs.existsSync(manifestPath) || !fs.existsSync(authorizationRequestPath)) {
    throw new Error(`outcome pilot ${channel} collection reuse requires its manifest and authorization request`);
  }
  const manifest = readJson(manifestPath);
  const authorizationRequest = readJson(authorizationRequestPath);
  if (authorizationRequest.bindings?.[files.manifestBinding] !== fileSha256(manifestPath)) {
    throw new Error(`outcome pilot ${channel} collection manifest integrity mismatch`);
  }
  for (const reader of manifest.readers || []) {
    for (const batch of reader.batches || []) {
      for (const [artifactPath, artifactSha256, label] of [
        [batch.packet_path, batch.packet_sha256, 'packet'],
        [batch[files.schemaPath], batch[files.schemaSha256], 'output schema'],
      ]) {
        if (
          !artifactPath ||
          !artifactSha256 ||
          !fs.existsSync(artifactPath) ||
          fileSha256(artifactPath) !== artifactSha256
        ) {
          throw new Error(`outcome pilot ${channel} collection ${batch.batch_id} ${label} integrity mismatch`);
        }
      }
    }
  }
  return { manifest, manifestPath, authorizationRequest, authorizationRequestPath, reused: true };
}

export function prepareOrReuseOutcomePilotReaderCollection({
  childResume,
  collectionDir,
  channel,
  reusedCollection = null,
  prepare,
} = {}) {
  if (childResume) return reusedCollection || reuseOutcomePilotReaderCollection({ collectionDir, channel });
  if (typeof prepare !== 'function') throw new Error(`outcome pilot ${channel} collection preparer is required`);
  return prepare();
}

export function reuseOutcomePilotOriginalFreeze({ rootDir, checkpoint } = {}) {
  const freezePath = path.join(path.resolve(rootDir), 'annotation-freeze-manifest.json');
  const expectedSha256 = checkpoint?.freeze?.sha256;
  if (!expectedSha256 || !fs.existsSync(freezePath) || fileSha256(freezePath) !== expectedSha256) {
    throw new Error('outcome pilot original emitted freeze does not match the parent checkpoint');
  }
  const freeze = readJson(freezePath);
  validateOutcomeFreezeFormForFrozenDecisionRunner(freeze);
  return { freeze, freezePath, sha256: expectedSha256, reused: true };
}

export function verifyOutcomePilotReaderResumeArtifacts({
  freeze,
  semanticCollection,
  decisionCollection,
  preflightPath,
  schemaAcceptancePath,
} = {}) {
  const launchCommit = freeze?.source_commit;
  const preflightSha256 = fileSha256(path.resolve(preflightPath));
  const schemaAcceptanceSha256 = fileSha256(path.resolve(schemaAcceptancePath));
  const preflightBindings = [
    freeze?.semantic_instrument?.preflight,
    semanticCollection.manifest?.brittleness_preflight,
    semanticCollection.authorizationRequest?.bindings?.brittleness_preflight,
    decisionCollection.manifest?.semantic_brittleness_preflight,
    decisionCollection.authorizationRequest?.bindings?.semantic_brittleness_preflight,
  ];
  const schemaAcceptanceBindings = [
    freeze?.semantic_instrument?.schema_acceptance,
    semanticCollection.manifest?.schema_acceptance_ping,
    semanticCollection.authorizationRequest?.bindings?.schema_acceptance_ping,
  ];
  const launchStamps = [
    semanticCollection.manifest?.source_commit,
    semanticCollection.authorizationRequest?.bindings?.source_commit,
    decisionCollection.manifest?.source_commit,
    decisionCollection.authorizationRequest?.bindings?.source_commit,
    ...preflightBindings.map((binding) => binding?.source_commit).filter(Boolean),
    ...schemaAcceptanceBindings.map((binding) => binding?.source_commit).filter(Boolean),
  ];
  if (!launchCommit || launchStamps.some((stamp) => stamp !== launchCommit)) {
    throw new Error('outcome pilot reused reader artifacts do not share the recorded launch commit');
  }
  if (preflightBindings.some((binding) => binding?.sha256 !== preflightSha256)) {
    throw new Error('outcome pilot reused brittleness preflight hash mismatch');
  }
  if (schemaAcceptanceBindings.some((binding) => binding?.sha256 !== schemaAcceptanceSha256)) {
    throw new Error('outcome pilot reused schema-acceptance carryover hash mismatch');
  }
  validateOutcomePilotZeroCallArtifacts({
    preflightPath,
    schemaAcceptancePath,
    expectedSourceCommit: launchCommit,
    reuseLaunchArtifacts: true,
  });
  return {
    status: 'passed',
    source_commit: launchCommit,
    preflight_sha256: preflightSha256,
    schema_acceptance_sha256: schemaAcceptanceSha256,
  };
}

export function carryOverOutcomeSchemaAcceptance({ sourcePath, preflightPath, outputPath, authorizedBy } = {}) {
  const source = readJson(path.resolve(sourcePath));
  if (
    source.status !== 'passed' ||
    source.inferential_role !== 'transport_only_permanently_excluded' ||
    source.synthetic_case_permanently_excluded !== true ||
    source.response_received !== true ||
    source.calls?.attempted !== 1 ||
    source.calls?.completed !== 1 ||
    source.calls?.maximum !== 1 ||
    source.prohibited_tool_event_count !== 0 ||
    !source.response_schema?.path ||
    fileSha256(source.response_schema.path) !== source.response_schema.sha256
  ) {
    throw new Error('source schema-acceptance artifact is not admissible for zero-call carryover');
  }
  const result = {
    ...source,
    source_commit: git(['rev-parse', 'HEAD']),
    preflight: { path: path.resolve(preflightPath), sha256: fileSha256(path.resolve(preflightPath)) },
    carryover: {
      authorized_by: authorizedBy,
      new_calls: 0,
      original_source_commit: source.source_commit,
      original_result: { path: path.resolve(sourcePath), sha256: fileSha256(path.resolve(sourcePath)) },
      response_schema_sha256: source.response_schema.sha256,
      byte_identical: true,
    },
  };
  atomicWriteJson(outputPath, result);
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult({
    artifact: result,
    expectedSourceCommit: result.source_commit,
    expectedPreflightSha256: result.preflight.sha256,
  });
  return result;
}

export function createOutcomePilotBudget({
  checkpointPath,
  checkpoint = null,
  shape = OUTCOME_DEFAULT_RUN_SHAPE,
} = {}) {
  const state = checkpoint || {
    schema: OUTCOME_PILOT_CHECKPOINT_SCHEMA,
    status: 'prepared',
    run_shape: shape.name,
    call_budget: {
      plan: { ...shape.planned_calls },
      actual: { generation: 0, presence_readers: 0, decision_readers: 0, total: 0 },
      delta: { ...shape.planned_calls },
      events: [],
    },
    dialogues: [],
    quarantined_dialogues: [],
  };
  const persist = () => {
    const actual = state.call_budget.actual;
    actual.total = actual.generation + actual.presence_readers + actual.decision_readers;
    state.call_budget.delta = {
      generation: state.call_budget.plan.generation - actual.generation,
      presence_readers: state.call_budget.plan.presence_readers - actual.presence_readers,
      decision_readers: state.call_budget.plan.decision_readers - actual.decision_readers,
      total: state.call_budget.plan.total - actual.total,
    };
    state.updated_at = new Date().toISOString();
    if (checkpointPath) atomicWriteJson(checkpointPath, state);
  };
  const reserve = (phase, event = {}) => {
    if (!Object.hasOwn(state.call_budget.actual, phase) || phase === 'total')
      throw new Error(`unknown budget phase ${phase}`);
    if (state.call_budget.actual.total >= state.call_budget.plan.total) {
      throw new Error(`${state.call_budget.plan.total}-call budget exhausted; refusing model call`);
    }
    state.call_budget.actual[phase] += 1;
    state.call_budget.events.push({ type: 'model_call_budget_reserved', phase, ...event });
    persist();
  };
  const reserveMany = (phase, count, event = {}) => {
    if (!Number.isInteger(count) || count < 0) throw new Error('reservation count must be a non-negative integer');
    if (state.call_budget.actual.total + count > state.call_budget.plan.total) {
      throw new Error(`${state.call_budget.plan.total}-call budget overrun refused`);
    }
    for (let index = 0; index < count; index += 1) reserve(phase, { ...event, ordinal: index + 1 });
  };
  persist();
  return { state, reserve, reserveMany, persist };
}

function outcomeDialogueId(row, studyLabel = 'outcome-pilot') {
  return `${studyLabel}-${String(row.order).padStart(2, '0')}-${row.world}-s${row.seed}-${row.condition}`;
}

export function buildOutcomePilotJobs({
  manifest,
  rootDir,
  dryRun = false,
  studyLabel = 'outcome-pilot',
  learnerProfile = OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
} = {}) {
  const worlds = new Map(manifest.worlds.map((world) => [world.id, world.path]));
  const configurations = new Map(
    resolveOutcomeStudyRunConfigurations(learnerProfile).map((configuration) => [configuration.id, configuration]),
  );
  return manifest.interleaved_condition_assignment.map((assignment) => {
    const configuration = configurations.get(assignment.condition);
    const worldPath = worlds.get(assignment.world);
    if (!configuration || !worldPath) throw new Error(`manifest assignment ${assignment.order} is unresolved`);
    const id = outcomeDialogueId(assignment, studyLabel);
    const jobDir = path.join(rootDir, 'dialogues', id);
    const command = [
      process.execPath,
      'scripts/run-tutor-stub-auto-eval.js',
      '--runs',
      '1',
      '--run-seed',
      String(assignment.seed),
      '--policies',
      'dynamic',
      '--auto-learner-profile-id',
      configuration.learner_profile,
      '--world',
      worldPath,
      '--dag-mode',
      'strict_dag',
      '--loop-mode',
      'strict',
      '--model',
      'codex.gpt-5.6-luna',
      '--analysis-model',
      'codex.gpt-5.6-luna',
      '--auto-learner-model',
      'codex.gpt-5.6-luna',
      '--learner-analysis-prompt-profile',
      configuration.learner_analysis_prompt_profile,
      '--cli-effort',
      'medium',
      '--history-turns',
      '4',
      '--max-tokens',
      '4096',
      '--model-call-budget',
      String(OUTCOME_PILOT_PER_DIALOGUE_CAP),
      '--register-temperature',
      '0.15',
      '--dag-fact-dropout',
      '0',
      '--release-speed',
      '1',
      '--parallelism',
      '1',
      '--progress-interval',
      '60',
      '--trace-dir',
      jobDir,
      '--parent-run-id',
      path.basename(rootDir),
      '--no-ledger',
      '--no-html-report',
      '--keep-going',
      ...configuration.cli_args,
    ];
    if (dryRun) command.push('--dry-run');
    return {
      id,
      ordinal: assignment.order,
      runIndex: assignment.order,
      seed: assignment.seed,
      world: assignment.world,
      worldPath,
      profile: configuration.learner_profile,
      condition: assignment.condition,
      warrantGateMode: configuration.warrant_gate_mode,
      warrantChallengeResistance: configuration.warrant_challenge_resistance || 'selectable',
      horizon: configuration.horizon,
      mechanismValidation: true,
      dryRun,
      parentRunId: path.basename(rootDir),
      jobDir,
      command,
    };
  });
}

function parseTutorStubDryRun(stdout) {
  const text = String(stdout || '');
  const jsonStart = text.indexOf('{');
  if (jsonStart < 0) throw new Error('tutor prompt preflight returned no dry-run JSON');
  return JSON.parse(text.slice(jsonStart));
}

export function renderOutcomePilotPromptConfiguration({
  worldPath,
  condition,
  seed = 515,
  traceDir,
  learnerProfile = OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
} = {}) {
  const configuration = resolveOutcomeStudyRunConfigurations(learnerProfile).find((row) => row.id === condition);
  if (!configuration) throw new Error(`unknown outcome prompt-preflight condition ${condition}`);
  const standingInstructionsIndex = configuration.cli_args.indexOf('--standing-instructions-file');
  const standingInstructionsFile =
    standingInstructionsIndex >= 0 ? configuration.cli_args[standingInstructionsIndex + 1] : null;
  const args = [
    'scripts/tutor-stub.js',
    '--lab',
    'automated_eval',
    '--model-call-budget',
    String(OUTCOME_PILOT_PER_DIALOGUE_CAP),
    '--auto-learner',
    '--auto-turns',
    String(configuration.horizon),
    '--auto-safety-turns',
    '80',
    '--model',
    'codex.gpt-5.6-luna',
    '--classifier-model',
    'codex.gpt-5.6-luna',
    '--learner-record-model',
    'codex.gpt-5.6-luna',
    '--auto-learner-model',
    'codex.gpt-5.6-luna',
    '--auto-learner-profile',
    configuration.learner_profile,
    '--tutor-learner-dag',
    '--world',
    worldPath,
    '--dag-mode',
    'strict_dag',
    '--register-policy',
    'dynamic',
    '--register-palette',
    'all',
    '--register-temperature',
    '0.15',
    '--dag-fact-dropout',
    '0',
    '--dag-fact-dropout-seed',
    String(seed),
    '--release-speed',
    '1',
    '--run-seed',
    String(seed),
    '--eval-repeat',
    '1',
    '--eval-job-id',
    `prompt-preflight-${condition}`,
    '--trace-dir',
    traceDir || path.join('/tmp', 'adaptive-warrant-outcome-prompt-preflight'),
    '--loop-mode',
    'strict',
    '--no-stream',
    '--no-interim-animation',
    '--dag',
    '--no-auto-stop-on-grounded',
    '--cli-effort',
    'medium',
    '--max-tokens',
    '4096',
    '--history-turns',
    '4',
    '--learner-analysis-prompt-profile',
    configuration.learner_analysis_prompt_profile,
    '--learner',
    'Automated learner run 1/1 for policy dynamic.',
    '--dry-run',
    ...(standingInstructionsFile ? ['--standing-instructions-file', standingInstructionsFile] : []),
  ];
  const rendered = parseTutorStubDryRun(
    execFileSync(process.execPath, args, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        NO_COLOR: '1',
        TUTOR_STUB_EVAL_POLICY: 'dynamic',
        TUTOR_STUB_EVAL_RUN_INDEX: '1',
        TUTOR_STUB_WARRANT_GATE: configuration.warrant_gate_mode,
        TUTOR_STUB_WARRANT_CHALLENGE_RESISTANCE: configuration.warrant_challenge_resistance || 'selectable',
      },
    }),
  );
  return {
    condition,
    world: rendered.world,
    systemPrompt: rendered.systemPrompt,
    audit: rendered.promptArchitecture.audit.baseSystem,
  };
}

export function preflightOutcomePilotPromptAudits({
  manifest,
  outputPath,
  learnerProfile = OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
} = {}) {
  if (!manifest?.worlds?.length) throw new Error('outcome prompt preflight requires frozen worlds');
  if (!outputPath) throw new Error('outcome prompt preflight requires an artifact path');
  const traceDir = path.join(path.dirname(path.resolve(outputPath)), 'prompt-audit-dry-run');
  const conditionIds = Array.isArray(manifest.conditions)
    ? manifest.conditions
    : Object.keys(manifest.conditions || {});
  const configurations = conditionIds.map((condition) => {
    const configuration = resolveOutcomeStudyRunConfigurations(learnerProfile).find((row) => row.id === condition);
    if (!configuration) throw new Error(`unknown outcome prompt-preflight condition ${condition}`);
    return configuration;
  });
  const renders = manifest.worlds.flatMap((world) =>
    configurations.map((configuration) => {
      const rendered = renderOutcomePilotPromptConfiguration({
        worldPath: world.path,
        condition: configuration.id,
        seed: manifest.seeds[0],
        traceDir,
        learnerProfile,
      });
      return {
        condition: configuration.id,
        world: world.id,
        world_path: world.path,
        surface: rendered.audit.surface,
        chars: rendered.audit.chars,
        approximate_tokens: rendered.audit.approximateTokens,
        budget: rendered.audit.budget,
        duplicate_instruction_lines: rendered.audit.duplicateInstructionLines,
        violations: rendered.audit.violations,
        ok: rendered.audit.ok,
        prompt_sha256: sha256(rendered.systemPrompt),
      };
    }),
  );
  const artifact = {
    schema: 'machinespirits.adaptation-refinement.outcome-prompt-audit-preflight.v1',
    created_at: new Date().toISOString(),
    makes_model_calls: false,
    model_calls: 0,
    status: renders.every((row) => row.ok) ? 'passed' : 'failed',
    renders,
  };
  atomicWriteJson(outputPath, artifact);
  if (artifact.status !== 'passed') {
    throw new Error(
      `outcome prompt-audit preflight failed: ${renders
        .filter((row) => !row.ok)
        .map((row) => `${row.world}/${row.condition}:${row.violations.map((violation) => violation.code).join('+')}`)
        .join(', ')}`,
    );
  }
  return artifact;
}

function spawnLogged(command, { cwd = ROOT, logPath = null } = {}) {
  return new Promise((resolve) => {
    if (logPath) fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const log = logPath ? fs.createWriteStream(logPath, { flags: 'a' }) : null;
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => log?.write(chunk));
    child.stderr.on('data', (chunk) => log?.write(chunk));
    let error = null;
    child.on('error', (cause) => {
      error = cause.message;
    });
    child.on('close', (status, signal) => {
      log?.end();
      resolve({ status, signal, error, logPath });
    });
  });
}

function countReservedEvents(tracePath) {
  if (!tracePath || !fs.existsSync(tracePath)) return 0;
  return fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(
      (line) =>
        line.includes('"type":"model_call_budget_reserved"') || line.includes('"type": "model_call_budget_reserved"'),
    ).length;
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function outcomeAnnotationCaseFingerprint({ dialogueId, turn, contentHash }) {
  return sha256(
    JSON.stringify({
      schema: 'machinespirits.adaptation-refinement.outcome-annotation-case-fingerprint.v2',
      dialogue_id: dialogueId,
      turn,
      content_sha256: contentHash,
    }),
  );
}

export function guardOutcomeAnnotationFingerprints({ cases, keyCases, expectedCount, excludedCases = [] } = {}) {
  // No default count. A caller that forgets to pass one would otherwise check a
  // 72-dialogue run against the pilot's 144 cases and pass everything.
  if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
    throw new Error('annotationCaseFingerprint guard needs the case count the manifest states');
  }
  if (!Array.isArray(cases) || cases.length !== expectedCount) {
    throw new Error(`annotationCaseFingerprint guard expected ${expectedCount} cases, got ${cases?.length ?? 0}`);
  }
  if (!Array.isArray(keyCases) || keyCases.length !== expectedCount) {
    throw new Error(
      `annotationCaseFingerprint identity guard expected ${expectedCount} source bindings, got ${keyCases?.length ?? 0}`,
    );
  }
  const keyBySampleId = new Map();
  for (const keyCase of keyCases) {
    if (!keyCase?.sample_id || keyBySampleId.has(keyCase.sample_id)) {
      throw new Error('annotationCaseFingerprint identity guard found missing or doubled sample identity');
    }
    keyBySampleId.set(keyCase.sample_id, keyCase);
  }
  const identities = new Set();
  const contentGroups = new Map();
  const fingerprints = cases.map((corpusCase) => {
    const keyCase = keyBySampleId.get(corpusCase?.sample_id);
    const dialogueId = keyCase?.job_id;
    const turn = Number(keyCase?.turn);
    if (!dialogueId || !Number.isInteger(turn)) {
      throw new Error('annotationCaseFingerprint identity guard found a missing dialogue or turn identity');
    }
    const identity = `${dialogueId}\u0000${turn}`;
    if (identities.has(identity)) {
      throw new Error(`annotationCaseFingerprint identity guard found doubled identity ${dialogueId} turn ${turn}`);
    }
    identities.add(identity);
    const contentHash = annotationCaseFingerprint(corpusCase);
    if (contentHash !== keyCase.source_fingerprint) {
      throw new Error(
        `annotationCaseFingerprint integrity guard found mutated case ${corpusCase.sample_id} (${dialogueId} turn ${turn})`,
      );
    }
    const group = contentGroups.get(contentHash) || [];
    group.push({ sample_id: corpusCase.sample_id, dialogue_id: dialogueId, turn });
    contentGroups.set(contentHash, group);
    return outcomeAnnotationCaseFingerprint({ dialogueId, turn, contentHash });
  });
  if (identities.size !== expectedCount || keyBySampleId.size !== expectedCount) {
    throw new Error('annotationCaseFingerprint identity guard found missing or doubled identity');
  }
  const byteTwinGroups = [...contentGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([contentHash, group]) => ({ content_sha256: contentHash, cases: group }));
  const excluded = new Set((excludedCases || []).map(annotationCaseFingerprint));
  const overlap = [...contentGroups.keys()].filter((contentHash) => excluded.has(contentHash));
  if (overlap.length) throw new Error(`annotationCaseFingerprint guard found ${overlap.length} excluded overlaps`);
  return {
    status: 'passed',
    expected_case_count: expectedCount,
    observed_case_count: cases.length,
    observed_identity_count: identities.size,
    fingerprints,
    unique_content_fingerprint_count: contentGroups.size,
    byte_twin_groups: byteTwinGroups,
  };
}

export async function runReadersAfterFingerprintGuard({
  cases,
  keyCases,
  expectedCount,
  excludedCases = [],
  runReaders,
} = {}) {
  const guard = guardOutcomeAnnotationFingerprints({ cases, keyCases, expectedCount, excludedCases });
  if (typeof runReaders !== 'function') throw new Error('reader launcher callback is required');
  const result = await runReaders();
  return { guard, result };
}

export function emitOutcomePilotNaturalFreeze({
  outputPath,
  studyId,
  learnerProfile = OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
  sourceCommit,
  corpus,
  key,
  annotationHandbook,
  semanticHandbook,
  semanticPredictions,
  studyPlan,
  semanticPreflight,
  schemaAcceptance,
} = {}) {
  const binding = (filePath) => ({ path: path.resolve(filePath), sha256: fileSha256(path.resolve(filePath)) });
  const freeze = {
    schema: OUTCOME_PILOT_FREEZE_SCHEMA,
    study_id: studyId,
    status: 'frozen',
    frozen_at: new Date().toISOString(),
    newly_generated_dialogues: true,
    prediction_balanced_diagnostic_sample: false,
    all_observe_decisions: true,
    sampling: {
      worlds: 2,
      profiles: [learnerProfile],
      conditions: ['bare', 'gated', 'standing_permission'],
      turns_per_dialogue: 8,
      total_cases: 144,
    },
    protocol: binding(path.resolve(ROOT, 'docs/adaptation-refinement/v3-outcome-study-registration.md')),
    study_plan: binding(studyPlan),
    source_commit: sourceCommit,
    semantic_instrument: { preflight: binding(semanticPreflight), schema_acceptance: binding(schemaAcceptance) },
    annotation_handbook: binding(annotationHandbook),
    semantic_handbook: binding(semanticHandbook),
    semantic_predictions: binding(semanticPredictions),
    corpus: { ...binding(corpus), cases: 144 },
    key: binding(key),
    outcome_pilot: true,
  };
  atomicWriteJson(outputPath, freeze);
  return freeze;
}

export function validateOutcomeFreezeFormForFrozenDecisionRunner(freeze) {
  if (freeze?.schema !== OUTCOME_PILOT_FREEZE_SCHEMA || freeze?.status !== 'frozen') {
    throw new Error('outcome freeze is not the representative form accepted by the frozen decision runner');
  }
  for (const field of ['protocol', 'corpus', 'annotation_handbook', 'key', 'study_plan']) {
    if (!freeze[field]?.path || !/^[a-f0-9]{64}$/u.test(freeze[field]?.sha256 || '')) {
      throw new Error(`outcome freeze lacks frozen decision-runner binding ${field}`);
    }
  }
  return { status: 'passed', form: OUTCOME_PILOT_FREEZE_SCHEMA };
}

function checkpointHasCompletedDialogue(checkpoint, job) {
  return checkpoint.dialogues.some((row) => row.id === job.id && row.status === 'complete');
}

export function guardOutcomeDialogueLearnerAnalysisCoverage(row) {
  if (row?.childStatus !== 'ok') return { status: 'not_checked', reason: 'child_not_complete' };
  const sealed = row.childEvidence?.ok === true && row.childEvidence?.status === 'complete';
  const unanalyzedTurns = (row.learnerAnalysisUnanalyzedTurns || []).map(Number).sort((a, b) => a - b);
  const coverage = Number(row.learnerAnalysisCoverage);
  if (sealed && coverage === 1 && unanalyzedTurns.length === 0) {
    return { status: 'passed', coverage, unanalyzed_turns: [] };
  }
  const suffix = unanalyzedTurns.length ? `: turns ${unanalyzedTurns.join(',')}` : '';
  return {
    status: 'failed',
    coverage: Number.isFinite(coverage) ? coverage : null,
    unanalyzed_turns: unanalyzedTurns,
    reason: `learner_analysis_coverage_below_one${suffix}`,
  };
}

export async function runOutcomeGeneration({
  jobs,
  checkpoint,
  budget,
  runDialogue = spawnLogged,
  collectJobResult = collectAdaptiveWarrantStudyJobResult,
} = {}) {
  for (const job of jobs) {
    if (checkpointHasCompletedDialogue(checkpoint, job)) continue;
    const started = new Date().toISOString();
    const processResult = await runDialogue(job.command, {
      cwd: ROOT,
      logPath: path.join(path.dirname(job.jobDir), '..', 'logs', `${job.id}.log`),
    });
    let row;
    try {
      row = collectJobResult(job, processResult);
    } catch (error) {
      row = { childStatus: 'evidence_invalid', error: error.message, tracePath: null, turnCount: 0 };
    }
    const reservations = countReservedEvents(row.tracePath);
    budget.reserveMany('generation', reservations, { dialogue_id: job.id });
    const learnerAnalysisCoverageGuard = guardOutcomeDialogueLearnerAnalysisCoverage(row);
    const complete =
      processResult.status === 0 &&
      row.childStatus === 'ok' &&
      row.turnCount === 8 &&
      learnerAnalysisCoverageGuard.status === 'passed';
    const checkpointRow = {
      id: job.id,
      order: job.ordinal,
      world: job.world,
      seed: job.seed,
      condition: job.condition,
      status: complete ? 'complete' : 'quarantined',
      started_at: started,
      completed_at: new Date().toISOString(),
      reserved_calls: reservations,
      run_record_path: path.join(job.jobDir, 'run-state.json'),
      trace_path: row.tracePath || null,
      learner_analysis_coverage_guard: learnerAnalysisCoverageGuard,
      error: complete
        ? null
        : learnerAnalysisCoverageGuard.status === 'failed'
          ? learnerAnalysisCoverageGuard.reason
          : row.error || processResult.error || `child exit ${processResult.status}`,
      result: row,
    };
    checkpoint.dialogues.push(checkpointRow);
    if (!complete) checkpoint.quarantined_dialogues.push(checkpointRow);
    budget.persist();
  }
  return checkpoint.dialogues;
}

export function prepareOutcomeCases({
  rows,
  manifest,
  rootDir,
  samplingSeed = 'outcome-pilot-frozen-order',
  learnerProfile = OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
}) {
  const conditionIds = [...new Set(manifest.interleaved_condition_assignment.map((row) => row.condition))];
  const conditions = conditionIds.map((condition) => {
    const configuration = resolveOutcomeStudyRunConfigurations(learnerProfile).find((row) => row.id === condition);
    if (!configuration) throw new Error(`unknown outcome case-extraction condition ${condition}`);
    return { id: configuration.id, warrantGateMode: configuration.warrant_gate_mode };
  });
  const built = buildBlindedAnnotationCorpus(rows, {
    studyId: path.basename(rootDir),
    samplingSeed,
    profiles: [learnerProfile],
    conditions,
    worlds: manifest.worlds.map((world) => world.id),
    includeAllDecisions: true,
    minimumTurn: 1,
  });
  if (built.corpus.cases.length !== manifest.case_extraction.expected_case_count) {
    throw new Error('outcome case extraction did not produce the frozen 144 cases');
  }
  return built;
}

export function writeOutcomeCorpusArtifacts({ rootDir, built }) {
  const corpusPath = path.join(rootDir, 'annotation-sample.blinded.json');
  const keyPath = path.join(rootDir, 'annotation-key.private.json');
  atomicWriteJson(corpusPath, built.corpus);
  atomicWriteJson(keyPath, built.key);
  const semantic = buildAdaptiveWarrantNaturalSemanticArtifacts(built.key.cases);
  built.corpus.semantic_annotation_catalog = semantic.catalog;
  atomicWriteJson(corpusPath, built.corpus);
  const predictionsPath = path.join(rootDir, 'semantic-predictions.json');
  atomicWriteJson(predictionsPath, semantic.predictions);
  return { corpusPath, keyPath, predictionsPath };
}

export async function runReaderProcesses({
  semanticCommand,
  decisionCommand,
  presenceRunDir,
  decisionRunDir,
  rootDir,
  resume = false,
  quarantineManifestPath = null,
  checkpoint,
  budget,
  runProcess = spawnLogged,
}) {
  // Read the plan the checkpoint was opened with, not a module constant: on a
  // resume the checkpoint on disk is the authority on how large this run is.
  const plan = checkpoint.call_budget?.plan;
  if (!plan) throw new Error('reader launch refused: the checkpoint carries no call plan');
  const remaining = plan.total - checkpoint.call_budget.actual.total;
  const presenceReservation = Math.max(
    0,
    plan.presence_readers - Number(checkpoint.call_budget.actual.presence_readers || 0),
  );
  const decisionReservation = Math.max(
    0,
    plan.decision_readers - Number(checkpoint.call_budget.actual.decision_readers || 0),
  );
  const required = presenceReservation + decisionReservation;
  if (remaining < required)
    throw new Error(`reader launch refused: ${remaining} calls remain but ${required} are required`);
  const semanticChildResume = resume && fs.existsSync(path.join(presenceRunDir, 'semantic-reader-run.json'));
  const decisionChildResume = resume && fs.existsSync(path.join(decisionRunDir, 'decision-reader-run.json'));
  const quarantineManifest = quarantineManifestPath ? readJson(path.resolve(quarantineManifestPath)) : null;
  const retakeChannels = new Set((quarantineManifest?.entries || []).map((entry) => entry.channel));
  const semanticComplete =
    semanticChildResume && readJson(path.join(presenceRunDir, 'semantic-reader-run.json')).status === 'complete';
  const decisionComplete =
    decisionChildResume && readJson(path.join(decisionRunDir, 'decision-reader-run.json')).status === 'complete';
  const launches = [];
  if (!semanticComplete || retakeChannels.has('presence')) {
    launches.push(
      runProcess(
        [
          ...semanticCommand,
          ...(semanticChildResume ? ['--resume'] : []),
          ...(retakeChannels.has('presence') ? ['--quarantine-manifest', path.resolve(quarantineManifestPath)] : []),
        ],
        { cwd: ROOT, logPath: path.join(rootDir, 'presence-readers-launcher.log') },
      ),
    );
  }
  if (!decisionComplete || retakeChannels.has('decision')) {
    launches.push(
      runProcess(
        [
          ...decisionCommand,
          ...(decisionChildResume ? ['--resume'] : []),
          ...(retakeChannels.has('decision') ? ['--quarantine-manifest', path.resolve(quarantineManifestPath)] : []),
        ],
        { cwd: ROOT, logPath: path.join(rootDir, 'decision-readers-launcher.log') },
      ),
    );
  }
  const results = await Promise.all(launches);
  if (results.some((result) => result.status !== 0)) throw new Error('one or both frozen reader launchers failed');
  if (presenceReservation) {
    budget.reserveMany('presence_readers', presenceReservation, { source: 'semantic-reader-run' });
  }
  if (decisionReservation) {
    budget.reserveMany('decision_readers', decisionReservation, { source: 'decision-reader-run' });
  }
}

export function writeOutcomePilotAssemblyRunView({ runPath, outputPath } = {}) {
  const resolvedRunPath = path.resolve(runPath);
  const run = readJson(resolvedRunPath);
  if (run.status !== 'complete') throw new Error('outcome pilot assembly view requires a complete reader run');
  const latestComplete = new Map();
  for (const row of run.batches || []) {
    if (row.status === 'complete') latestComplete.set(`${row.reader_id}:${row.batch_id}`, row);
  }
  const view = {
    ...run,
    batches: [...latestComplete.values()],
    assembly_view: {
      source_run_path: resolvedRunPath,
      source_run_sha256: fileSha256(resolvedRunPath),
      selection: 'latest complete checkpoint row per reader and batch',
    },
  };
  const resolvedOutputPath = path.resolve(outputPath);
  atomicWriteJson(resolvedOutputPath, view);
  return { path: resolvedOutputPath, sha256: fileSha256(resolvedOutputPath), run: view };
}

export async function executeOutcomePilot({
  manifestPath = DEFAULT_MANIFEST,
  expectedShape = null,
  goNotePath,
  acceptCharges = false,
  outputDir,
  resume = false,
  instrumentFreezePath,
  learnerProfile = OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
  runDialogue,
  runReaderProcess,
} = {}) {
  if (!goNotePath) throw new Error('outcome pilot refuses: --go-note is required');
  if (!acceptCharges) throw new Error('outcome pilot refuses: --accept-charges is required');
  // The manifest is read first because it states the run size, and the GO note
  // is then checked against that size: a note approving 1,116 calls can never
  // launch the 4,464-call block by accident.
  const guarded = verifyOutcomePilotManifestBindings({ manifestPath, expectedLearnerProfile: learnerProfile });
  assertOutcomeShapeFlag({ expectedShape, shape: guarded.shape });
  const goNote = validateOutcomePilotGoNote(goNotePath, { shape: guarded.shape });
  if (git(['status', '--porcelain'])) throw new Error('outcome pilot launch requires a clean committed worktree');
  if (!outputDir) throw new Error('outcome pilot launch requires --out');
  if (!instrumentFreezePath) throw new Error('outcome pilot launch requires --instrument-freeze');
  const sourceFreeze = readJson(path.resolve(instrumentFreezePath));
  validateOutcomeFreezeFormForFrozenDecisionRunner(sourceFreeze);
  if (!sourceFreeze.semantic_instrument?.schema_acceptance?.path) {
    throw new Error('frozen instrument lacks the source schema-acceptance artifact');
  }
  const rootDir = path.resolve(ROOT, outputDir);
  const checkpointPath = path.join(rootDir, 'outcome-pilot-checkpoint.json');
  if (fs.existsSync(rootDir) && !resume) throw new Error('outcome pilot output exists; pass --resume');
  if (resume && !fs.existsSync(checkpointPath)) throw new Error('--resume requires an existing checkpoint');
  const presenceRunDir = path.join(rootDir, 'presence-readers');
  const decisionRunDir = path.join(rootDir, 'decision-readers');
  const quarantineManifestPath = path.join(rootDir, 'reader-response-quarantine-manifest.json');
  const reviewerAuthorizedQuarantineManifest =
    resume && fs.existsSync(quarantineManifestPath) ? quarantineManifestPath : null;
  const semanticChildResume = resume && fs.existsSync(path.join(presenceRunDir, 'semantic-reader-run.json'));
  const decisionChildResume = resume && fs.existsSync(path.join(decisionRunDir, 'decision-reader-run.json'));
  const readerResume = semanticChildResume && decisionChildResume;
  const promptAuditPreflightPath = path.join(rootDir, 'prompt-audit-preflight.json');
  const promptAuditPreflight = preflightOutcomePilotPromptAudits({
    manifest: guarded.manifest,
    outputPath: promptAuditPreflightPath,
    learnerProfile,
  });
  const checkpoint = resume ? readJson(checkpointPath) : null;
  assertOutcomeCheckpointShape({ checkpoint, shape: guarded.shape });
  const budget = createOutcomePilotBudget({ checkpointPath, checkpoint, shape: guarded.shape });
  const semanticPreflightPath = path.join(rootDir, 'semantic-brittleness-preflight.json');
  const schemaAcceptancePath = path.join(rootDir, 'semantic-schema-acceptance-carryover.json');
  const reusedFreeze = readerResume ? reuseOutcomePilotOriginalFreeze({ rootDir, checkpoint: budget.state }) : null;
  const presenceCollectionDir = path.join(rootDir, 'presence-collection');
  const decisionCollectionDir = path.join(rootDir, 'decision-collection');
  const reusedSemanticCollection = semanticChildResume
    ? reuseOutcomePilotReaderCollection({ collectionDir: presenceCollectionDir, channel: 'presence' })
    : null;
  const reusedDecisionCollection = decisionChildResume
    ? reuseOutcomePilotReaderCollection({ collectionDir: decisionCollectionDir, channel: 'decision' })
    : null;
  if (!resume) {
    execFileSync(
      process.execPath,
      ['scripts/run-adaptive-warrant-semantic-brittleness-preflight.js', '--out', semanticPreflightPath],
      { cwd: ROOT, stdio: 'pipe' },
    );
    carryOverOutcomeSchemaAcceptance({
      sourcePath: sourceFreeze.semantic_instrument.schema_acceptance.path,
      preflightPath: semanticPreflightPath,
      outputPath: schemaAcceptancePath,
      authorizedBy: 'docs/adaptation-refinement/relay/065-reviewer-direction-outcome-pilot-harness.md',
    });
  }
  if (readerResume) {
    verifyOutcomePilotReaderResumeArtifacts({
      freeze: reusedFreeze.freeze,
      semanticCollection: reusedSemanticCollection,
      decisionCollection: reusedDecisionCollection,
      preflightPath: semanticPreflightPath,
      schemaAcceptancePath,
    });
  }
  const readerBindings = verifyOutcomePilotReaderBindings({
    manifest: guarded.manifest,
    instrumentFreezePath,
    preflightPath: semanticPreflightPath,
    schemaAcceptancePath,
    expectedSourceCommit: reusedFreeze?.freeze.source_commit || null,
    reuseLaunchArtifacts: readerResume,
  });
  budget.state.status = 'generation';
  budget.state.go_note = goNote;
  budget.state.manifest = { path: guarded.resolvedManifest, sha256: fileSha256(guarded.resolvedManifest) };
  budget.state.pre_call_guards = {
    menu: guarded.menuGuard,
    prepared_identity: guarded.preparation,
    frozen_readers: readerBindings,
    prompt_audit: {
      path: promptAuditPreflightPath,
      sha256: fileSha256(promptAuditPreflightPath),
      status: promptAuditPreflight.status,
      renders: promptAuditPreflight.renders,
    },
  };
  budget.persist();

  budget.state.learner_profile = learnerProfile;
  const jobs = buildOutcomePilotJobs({ manifest: guarded.manifest, rootDir, learnerProfile });
  await runOutcomeGeneration({ jobs, checkpoint: budget.state, budget, runDialogue });
  const completed = budget.state.dialogues.filter((row) => row.status === 'complete');
  if (completed.length !== guarded.shape.dialogues) {
    budget.state.status = 'generation_quarantine_stop';
    budget.persist();
    return budget.state;
  }

  const rows = completed.sort((a, b) => a.order - b.order).map((row) => row.result);
  const built = prepareOutcomeCases({ rows, manifest: guarded.manifest, rootDir, learnerProfile });
  const fingerprintGuard = guardOutcomeAnnotationFingerprints({
    cases: built.corpus.cases,
    keyCases: built.key.cases,
    expectedCount: guarded.manifest.case_extraction.expected_case_count,
  });
  budget.state.post_generation_fingerprint_guard = fingerprintGuard;
  budget.persist();
  const artifacts = readerResume
    ? {
        corpusPath: reusedFreeze.freeze.corpus.path,
        keyPath: reusedFreeze.freeze.key.path,
        predictionsPath: reusedFreeze.freeze.semantic_predictions.path,
      }
    : writeOutcomeCorpusArtifacts({ rootDir, built });

  const annotationHandbook = sourceFreeze.annotation_handbook?.path;
  const semanticHandbook = sourceFreeze.semantic_handbook?.path;
  if (!annotationHandbook || !semanticHandbook) throw new Error('frozen natural instrument lacks reader handbooks');
  const studyPlanPath = readerResume
    ? reusedFreeze.freeze.study_plan.path
    : path.join(rootDir, 'outcome-pilot-study-plan.json');
  if (!readerResume) {
    atomicWriteJson(studyPlanPath, { schema: OUTCOME_PILOT_RUN_SCHEMA, manifest: budget.state.manifest, jobs });
  }
  const freezePath = reusedFreeze?.freezePath || path.join(rootDir, 'annotation-freeze-manifest.json');
  const freeze = readerResume
    ? reusedFreeze.freeze
    : emitOutcomePilotNaturalFreeze({
        outputPath: freezePath,
        studyId: path.basename(rootDir),
        learnerProfile,
        sourceCommit: git(['rev-parse', 'HEAD']),
        corpus: artifacts.corpusPath,
        key: artifacts.keyPath,
        annotationHandbook,
        semanticHandbook,
        semanticPredictions: artifacts.predictionsPath,
        studyPlan: studyPlanPath,
        semanticPreflight: semanticPreflightPath,
        schemaAcceptance: schemaAcceptancePath,
      });
  validateOutcomeFreezeFormForFrozenDecisionRunner(freeze);

  const semanticCollection = prepareOrReuseOutcomePilotReaderCollection({
    childResume: semanticChildResume,
    collectionDir: presenceCollectionDir,
    channel: 'presence',
    reusedCollection: reusedSemanticCollection,
    prepare: () =>
      prepareAdaptiveWarrantSemanticAnnotationBatches({
        corpusPath: artifacts.corpusPath,
        handbookPath: semanticHandbook,
        outputDir: presenceCollectionDir,
        corpusRole: 'natural_prevalence',
        readerIds: ['presence-reader-a', 'presence-reader-b'],
        batchSize: 1,
        maximumCalls: guarded.shape.planned_calls.presence_readers,
        preflightPath: semanticPreflightPath,
        schemaAcceptancePath,
      }),
  });
  const decisionCollection = prepareOrReuseOutcomePilotReaderCollection({
    childResume: decisionChildResume,
    collectionDir: decisionCollectionDir,
    channel: 'decision',
    reusedCollection: reusedDecisionCollection,
    prepare: () =>
      prepareAdaptiveWarrantAnnotationBatches({
        corpusPath: artifacts.corpusPath,
        handbookPath: annotationHandbook,
        outputDir: decisionCollectionDir,
        corpusRole: 'natural_prevalence',
        readerIds: ['decision-reader-a', 'decision-reader-b'],
        batchSize: 1,
        maxAnnotationCalls: guarded.shape.planned_calls.decision_readers,
        preflightPath: semanticPreflightPath,
      }),
  });
  const presenceManifest = semanticCollection.manifest;
  if (
    presenceManifest.size_audit?.maximum_response_bytes !== PRESENCE_CHANNEL_CAPS.response_cap ||
    presenceManifest.size_audit?.maximum_packet_bytes !== PRESENCE_CHANNEL_CAPS.packet_cap
  ) {
    throw new Error(
      `presence reader packet caps are not ${PRESENCE_CHANNEL_CAPS.response_cap}/${PRESENCE_CHANNEL_CAPS.packet_cap}`,
    );
  }
  budget.state.status = 'readers';
  budget.state.freeze = { path: freezePath, form: freeze.schema, sha256: fileSha256(freezePath) };
  budget.persist();
  await runReaderProcesses({
    semanticCommand: [
      process.execPath,
      'scripts/run-adaptive-warrant-semantic-readers.js',
      '--manifest',
      semanticCollection.manifestPath,
      '--freeze-manifest',
      freezePath,
      '--authorization-request',
      semanticCollection.authorizationRequestPath,
      '--out',
      presenceRunDir,
      '--approved-by',
      goNote.relative_path,
    ],
    decisionCommand: [
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
    ],
    presenceRunDir,
    decisionRunDir,
    rootDir,
    resume,
    checkpoint: budget.state,
    budget,
    runProcess: runReaderProcess,
    quarantineManifestPath: reviewerAuthorizedQuarantineManifest,
  });

  const presenceRunPath = path.join(presenceRunDir, 'semantic-reader-run.json');
  const decisionRunPath = path.join(decisionRunDir, 'decision-reader-run.json');
  const presenceAssemblyRun = writeOutcomePilotAssemblyRunView({
    runPath: presenceRunPath,
    outputPath: path.join(rootDir, 'presence-reader-assembly-run-view.json'),
  });
  const decisionAssemblyRun = writeOutcomePilotAssemblyRunView({
    runPath: decisionRunPath,
    outputPath: path.join(rootDir, 'decision-reader-assembly-run-view.json'),
  });
  const assembledPresence = new Map();
  for (const readerId of ['presence-reader-a', 'presence-reader-b']) {
    const assembled = assembleAdaptiveWarrantSemanticAnnotationResponse({
      manifestPath: semanticCollection.manifestPath,
      readerId,
      annotationRunId: `${path.basename(rootDir)}-${readerId}`,
      responseDir: path.join(presenceRunDir, readerId),
      outputPath: path.join(rootDir, `${readerId}.assembled.json`),
      runPath: presenceAssemblyRun.path,
    });
    assembledPresence.set(readerId, assembled.response);
  }
  const assembledDecision = new Map();
  for (const readerId of ['decision-reader-a', 'decision-reader-b']) {
    const assembled = assembleAdaptiveWarrantAnnotationResponse({
      manifestPath: decisionCollection.manifestPath,
      readerId,
      annotationRunId: `${path.basename(rootDir)}-${readerId}`,
      responseDir: path.join(decisionRunDir, readerId),
      outputPath: path.join(rootDir, `${readerId}.assembled.json`),
      runPath: decisionAssemblyRun.path,
    });
    assembledDecision.set(readerId, assembled.response);
  }
  const keyBySampleId = new Map(built.key.cases.map((row) => [row.sample_id, row]));
  const presenceA = new Map(assembledPresence.get('presence-reader-a').cases.map((row) => [row.sample_id, row]));
  const presenceB = new Map(assembledPresence.get('presence-reader-b').cases.map((row) => [row.sample_id, row]));
  const decisionA = new Map(assembledDecision.get('decision-reader-a').cases.map((row) => [row.sample_id, row]));
  const decisionB = new Map(assembledDecision.get('decision-reader-b').cases.map((row) => [row.sample_id, row]));
  const semanticPresence = (row) => {
    const acts = new Set((row?.events || []).map((event) => event.speech_act));
    return {
      genuinely_ambiguous: row?.genuinely_ambiguous === true,
      result_request: acts.has('tutor_directed_public_result_request'),
      proposed_test: acts.has('learner_proposed_test'),
    };
  };
  const presenceCases = built.corpus.cases.map((row) => {
    const key = keyBySampleId.get(row.sample_id);
    const left = semanticPresence(presenceA.get(row.sample_id));
    const right = semanticPresence(presenceB.get(row.sample_id));
    return {
      sample_id: row.sample_id,
      dialogue_id: key.job_id,
      condition: key.condition,
      admissible_pair: true,
      presence_grain_consensus: JSON.stringify(left) === JSON.stringify(right),
      reader_a_presence: left,
      reader_b_presence: right,
    };
  });
  const decisionCases = built.corpus.cases.map((row) => {
    const key = keyBySampleId.get(row.sample_id);
    return {
      sample_id: row.sample_id,
      dialogue_id: key.job_id,
      turn: key.turn,
      condition: key.condition,
      reader_a_decision: decisionA.get(row.sample_id)?.commitment_transition_warranted,
      reader_b_decision: decisionB.get(row.sample_id)?.commitment_transition_warranted,
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
  const presenceBindings = {
    ...guarded.manifest.presence_channel.digests,
    response_cap: guarded.manifest.presence_channel.caps_bytes.response,
    packet_cap: guarded.manifest.presence_channel.caps_bytes.packet,
  };
  const score = scoreAdaptiveWarrantOutcomeStudy({
    presence_preflight: { expected: presenceBindings, observed: presenceBindings },
    decision_reader_preflight: { ...guarded.manifest.decision_channel.digests },
    dialogues,
    decision_cases: decisionCases,
    presence_cases: presenceCases,
    decision_reader_run_record_path: decisionAssemblyRun.path,
  });
  const scorePath = path.join(rootDir, 'outcome-pilot-score.json');
  atomicWriteJson(scorePath, score);
  budget.state.status = 'complete';
  budget.state.reader_run_records = {
    presence: presenceRunPath,
    decision: decisionRunPath,
    assembly_views: { presence: presenceAssemblyRun.path, decision: decisionAssemblyRun.path },
  };
  budget.state.score = { path: scorePath, sha256: fileSha256(scorePath) };
  budget.persist();
  return budget.state;
}

function usage() {
  // --manifest and --learner-profile travel together: a non-A1 pole needs both,
  // and the launcher refuses when they disagree.
  return `Usage:\n  node scripts/run-adaptive-warrant-outcome-pilot.js [--manifest <manifest>]\n  node scripts/run-adaptive-warrant-outcome-pilot.js --go-note <relay-file> --accept-charges --out <dir> --instrument-freeze <natural-freeze> [--manifest <manifest>] [--shape <${Object.keys(OUTCOME_RUN_SHAPES).join('|')}>] [--learner-profile <${OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES.join('|')}>] [--resume]\n\nDefaults:\n  --manifest         ${DEFAULT_MANIFEST}\n  --learner-profile  ${OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE}\n  --shape            read from the manifest; ${OUTCOME_DEFAULT_RUN_SHAPE.name} when the manifest names none\n`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      manifest: { type: 'string', default: DEFAULT_MANIFEST },
      'go-note': { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      out: { type: 'string' },
      'instrument-freeze': { type: 'string' },
      'learner-profile': { type: 'string', default: OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE },
      shape: { type: 'string' },
      resume: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(usage());
    return;
  }
  if (!values['go-note'] || !values['accept-charges']) {
    let manifest = null;
    try {
      manifest = readJson(path.resolve(ROOT, values.manifest));
    } catch {
      /* plan remains static */
    }
    process.stdout.write(`${printOutcomePilotPlan(manifest)}\n`);
    return;
  }
  const result = await executeOutcomePilot({
    manifestPath: values.manifest,
    expectedShape: values.shape ? resolveOutcomeRunShape(values.shape).name : null,
    goNotePath: values['go-note'],
    acceptCharges: values['accept-charges'],
    outputDir: values.out,
    resume: values.resume,
    instrumentFreezePath: values['instrument-freeze'],
    learnerProfile: values['learner-profile'],
  });
  process.stdout.write(
    `${JSON.stringify({ status: result.status, checkpoint: path.resolve(ROOT, values.out, 'outcome-pilot-checkpoint.json') })}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH)) {
  main().catch((error) => {
    console.error(`[outcome-pilot] error: ${error.message}`);
    process.exitCode = 1;
  });
}
