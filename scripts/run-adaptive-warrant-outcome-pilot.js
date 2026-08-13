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
  OUTCOME_PILOT_SEEDS,
  guardOutcomePilotPreparation,
  guardOutcomeStandingPermissionMenu,
} from './prepare-adaptive-warrant-outcome-study.js';
import {
  OUTCOME_STUDY_RUN_CONFIGURATIONS,
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
export const OUTCOME_PILOT_PER_DIALOGUE_CAP = 30;
export const OUTCOME_PILOT_CALL_PLAN = Object.freeze({
  generation: 18 * OUTCOME_PILOT_PER_DIALOGUE_CAP,
  presence_readers: 288,
  decision_readers: 288,
  total: 18 * OUTCOME_PILOT_PER_DIALOGUE_CAP + 288 + 288,
});
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
  const plan = manifest?.planned_calls || OUTCOME_PILOT_CALL_PLAN;
  return [
    'Adaptive-warrant outcome pilot: HOLD / zero-call plan only.',
    `Entry point: ${relativeToRoot(SCRIPT_PATH)}`,
    `Generation call cap: ${plan.generation ?? 540}; presence readers: ${plan.presence_readers ?? 288}; decision readers: ${plan.decision_readers ?? 288}; total: ${plan.total ?? 1116}.`,
    'A paid run requires --go-note <fresh committed reviewer go note> --accept-charges.',
    `The consumed note ${CONSUMED_GO_NOTE} is never accepted.`,
  ].join('\n');
}

export function validateOutcomePilotGoNote(goNotePath) {
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
  if (!/\bGO\b/u.test(text) || !/1116/u.test(text)) {
    throw new Error('outcome pilot refuses: go note lacks the pilot GO and 1116-call scope');
  }
  return { path: resolved, relative_path: relative, sha256: sha256(onDisk) };
}

export function verifyOutcomePilotManifestBindings({ manifestPath = DEFAULT_MANIFEST } = {}) {
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
  assertExactObject(manifest.seeds, OUTCOME_PILOT_SEEDS, 'pilot seeds');
  assertExactObject(
    manifest.planned_calls,
    {
      generation: 540,
      presence_readers: 288,
      decision_readers: 288,
      total: 1116,
      arithmetic: '(18 x 30 cap) + (2 x 144) + (2 x 144) = 1116; measured live unit 26 per dialogue (report 069)',
      counter_before: 4198,
      counter_after_if_completed: 5314,
      ceiling: 19337,
      remaining_after_if_completed: 14023,
    },
    'pilot call plan',
  );
  if (
    manifest.interleaved_condition_assignment?.length !== 18 ||
    manifest.case_extraction?.expected_case_count !== 144 ||
    manifest.presence_channel?.readers !== 2 ||
    manifest.decision_channel?.readers !== 2
  ) {
    throw new Error('outcome pilot manifest matrix or reader cardinality mismatch');
  }
  const preparation = guardOutcomePilotPreparation({
    worldPaths: manifest.worlds.map((world) => world.path),
    seeds: manifest.seeds,
  });
  if (preparation.status !== 'passed') throw new Error('prepared-run identity guard failed');
  return { manifest, resolvedManifest, menuGuard, preparation };
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
        if (!artifactPath || !artifactSha256 || !fs.existsSync(artifactPath) || fileSha256(artifactPath) !== artifactSha256) {
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

export function createOutcomePilotBudget({ checkpointPath, checkpoint = null } = {}) {
  const state = checkpoint || {
    schema: OUTCOME_PILOT_CHECKPOINT_SCHEMA,
    status: 'prepared',
    call_budget: {
      plan: { ...OUTCOME_PILOT_CALL_PLAN },
      actual: { generation: 0, presence_readers: 0, decision_readers: 0, total: 0 },
      delta: { ...OUTCOME_PILOT_CALL_PLAN },
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

function outcomeDialogueId(row) {
  return `outcome-pilot-${String(row.order).padStart(2, '0')}-${row.world}-s${row.seed}-${row.condition}`;
}

export function buildOutcomePilotJobs({ manifest, rootDir, dryRun = false } = {}) {
  const worlds = new Map(manifest.worlds.map((world) => [world.id, world.path]));
  const configurations = new Map(
    OUTCOME_STUDY_RUN_CONFIGURATIONS.map((configuration) => [configuration.id, configuration]),
  );
  return manifest.interleaved_condition_assignment.map((assignment) => {
    const configuration = configurations.get(assignment.condition);
    const worldPath = worlds.get(assignment.world);
    if (!configuration || !worldPath) throw new Error(`manifest assignment ${assignment.order} is unresolved`);
    const id = outcomeDialogueId(assignment);
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

export function renderOutcomePilotPromptConfiguration({ worldPath, condition, seed = 515, traceDir } = {}) {
  const configuration = OUTCOME_STUDY_RUN_CONFIGURATIONS.find((row) => row.id === condition);
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

export function preflightOutcomePilotPromptAudits({ manifest, outputPath } = {}) {
  if (!manifest?.worlds?.length) throw new Error('outcome prompt preflight requires frozen worlds');
  if (!outputPath) throw new Error('outcome prompt preflight requires an artifact path');
  const traceDir = path.join(path.dirname(path.resolve(outputPath)), 'prompt-audit-dry-run');
  const renders = manifest.worlds.flatMap((world) =>
    OUTCOME_STUDY_RUN_CONFIGURATIONS.map((configuration) => {
      const rendered = renderOutcomePilotPromptConfiguration({
        worldPath: world.path,
        condition: configuration.id,
        seed: manifest.seeds[0],
        traceDir,
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

export function guardOutcomeAnnotationFingerprints({
  cases,
  keyCases,
  expectedCount = 144,
  excludedCases = [],
} = {}) {
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
      profiles: ['low_agency'],
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

function prepareOutcomeCases({ rows, manifest, rootDir }) {
  const conditions = OUTCOME_STUDY_RUN_CONFIGURATIONS.map((configuration) => ({
    id: configuration.id,
    warrantGateMode: configuration.warrant_gate_mode,
  }));
  const built = buildBlindedAnnotationCorpus(rows, {
    studyId: path.basename(rootDir),
    samplingSeed: 'outcome-pilot-frozen-order',
    profiles: ['low_agency'],
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

function writeOutcomeCorpusArtifacts({ rootDir, built }) {
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
  checkpoint,
  budget,
  runProcess = spawnLogged,
}) {
  const remaining = OUTCOME_PILOT_CALL_PLAN.total - checkpoint.call_budget.actual.total;
  const required = OUTCOME_PILOT_CALL_PLAN.presence_readers + OUTCOME_PILOT_CALL_PLAN.decision_readers;
  if (remaining < required)
    throw new Error(`reader launch refused: ${remaining} calls remain but ${required} are required`);
  const semanticChildResume = resume && fs.existsSync(path.join(presenceRunDir, 'semantic-reader-run.json'));
  const decisionChildResume = resume && fs.existsSync(path.join(decisionRunDir, 'decision-reader-run.json'));
  const [semantic, decision] = await Promise.all([
    runProcess([...semanticCommand, ...(semanticChildResume ? ['--resume'] : [])], {
      cwd: ROOT,
      logPath: path.join(rootDir, 'presence-readers-launcher.log'),
    }),
    runProcess([...decisionCommand, ...(decisionChildResume ? ['--resume'] : [])], {
      cwd: ROOT,
      logPath: path.join(rootDir, 'decision-readers-launcher.log'),
    }),
  ]);
  if (semantic.status !== 0 || decision.status !== 0) throw new Error('one or both frozen reader launchers failed');
  budget.reserveMany('presence_readers', OUTCOME_PILOT_CALL_PLAN.presence_readers, { source: 'semantic-reader-run' });
  budget.reserveMany('decision_readers', OUTCOME_PILOT_CALL_PLAN.decision_readers, { source: 'decision-reader-run' });
}

export async function executeOutcomePilot({
  manifestPath = DEFAULT_MANIFEST,
  goNotePath,
  acceptCharges = false,
  outputDir,
  resume = false,
  instrumentFreezePath,
  runDialogue,
  runReaderProcess,
} = {}) {
  if (!goNotePath) throw new Error('outcome pilot refuses: --go-note is required');
  if (!acceptCharges) throw new Error('outcome pilot refuses: --accept-charges is required');
  const goNote = validateOutcomePilotGoNote(goNotePath);
  const guarded = verifyOutcomePilotManifestBindings({ manifestPath });
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
  const semanticChildResume = resume && fs.existsSync(path.join(presenceRunDir, 'semantic-reader-run.json'));
  const decisionChildResume = resume && fs.existsSync(path.join(decisionRunDir, 'decision-reader-run.json'));
  const readerResume = semanticChildResume && decisionChildResume;
  const promptAuditPreflightPath = path.join(rootDir, 'prompt-audit-preflight.json');
  const promptAuditPreflight = preflightOutcomePilotPromptAudits({
    manifest: guarded.manifest,
    outputPath: promptAuditPreflightPath,
  });
  const checkpoint = resume ? readJson(checkpointPath) : null;
  const budget = createOutcomePilotBudget({ checkpointPath, checkpoint });
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

  const jobs = buildOutcomePilotJobs({ manifest: guarded.manifest, rootDir });
  await runOutcomeGeneration({ jobs, checkpoint: budget.state, budget, runDialogue });
  const completed = budget.state.dialogues.filter((row) => row.status === 'complete');
  if (completed.length !== 18) {
    budget.state.status = 'generation_quarantine_stop';
    budget.persist();
    return budget.state;
  }

  const rows = completed.sort((a, b) => a.order - b.order).map((row) => row.result);
  const built = prepareOutcomeCases({ rows, manifest: guarded.manifest, rootDir });
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
        maximumCalls: 288,
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
        maxAnnotationCalls: 288,
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
  });

  const presenceRunPath = path.join(presenceRunDir, 'semantic-reader-run.json');
  const decisionRunPath = path.join(decisionRunDir, 'decision-reader-run.json');
  const assembledPresence = new Map();
  for (const readerId of ['presence-reader-a', 'presence-reader-b']) {
    const assembled = assembleAdaptiveWarrantSemanticAnnotationResponse({
      manifestPath: semanticCollection.manifestPath,
      readerId,
      annotationRunId: `${path.basename(rootDir)}-${readerId}`,
      responseDir: path.join(presenceRunDir, readerId),
      outputPath: path.join(rootDir, `${readerId}.assembled.json`),
      runPath: presenceRunPath,
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
      runPath: decisionRunPath,
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
    decision_reader_run_record_path: decisionRunPath,
  });
  const scorePath = path.join(rootDir, 'outcome-pilot-score.json');
  atomicWriteJson(scorePath, score);
  budget.state.status = 'complete';
  budget.state.reader_run_records = { presence: presenceRunPath, decision: decisionRunPath };
  budget.state.score = { path: scorePath, sha256: fileSha256(scorePath) };
  budget.persist();
  return budget.state;
}

function usage() {
  return `Usage:\n  node scripts/run-adaptive-warrant-outcome-pilot.js\n  node scripts/run-adaptive-warrant-outcome-pilot.js --go-note <relay-file> --accept-charges --out <dir> --instrument-freeze <natural-freeze> [--resume]\n`;
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
    goNotePath: values['go-note'],
    acceptCharges: values['accept-charges'],
    outputDir: values.out,
    resume: values.resume,
    instrumentFreezePath: values['instrument-freeze'],
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
