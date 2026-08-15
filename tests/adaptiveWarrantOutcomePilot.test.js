import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  OUTCOME_PILOT_CALL_PLAN,
  OUTCOME_PILOT_CHECKPOINT_SCHEMA,
  OUTCOME_PILOT_FREEZE_SCHEMA,
  OUTCOME_PILOT_PER_DIALOGUE_CAP,
  OUTCOME_RULED_COMPLETE_STATUS,
  applyReviewerRulingToCheckpoint,
  createOutcomePilotBudget,
  executeOutcomePilot,
  guardOutcomeAnnotationFingerprints,
  guardOutcomeDialogueLearnerAnalysisCoverage,
  preflightOutcomePilotPromptAudits,
  prepareOrReuseOutcomePilotReaderCollection,
  renderOutcomePilotPromptConfiguration,
  reuseOutcomePilotOriginalFreeze,
  reuseOutcomePilotReaderCollection,
  runOutcomeGeneration,
  runReaderProcesses,
  runReadersAfterFingerprintGuard,
  validateOutcomeFreezeFormForFrozenDecisionRunner,
  resolveOutcomeResumeLaunchCommit,
  validateOutcomePilotZeroCallArtifacts,
  verifyOutcomePilotManifestBindings,
  verifyOutcomePilotReaderResumeArtifacts,
  writeOutcomePilotAssemblyRunView,
} from '../scripts/run-adaptive-warrant-outcome-pilot.js';
import {
  OUTCOME_PILOT_EXCLUDED_ARTIFACTS,
  OUTCOME_RUN_SHAPES,
  absentOutcomeExcludedArtifacts,
  guardOutcomePilotPreparation,
  resolveOutcomeRunShape,
} from '../scripts/prepare-adaptive-warrant-outcome-study.js';
import {
  OUTCOME_MAIN_BLOCK_ABSOLUTE_READER_ATTEMPT_CEILING,
  OUTCOME_MAIN_BLOCK_AUTHORIZATION_MAXIMUM_CALLS,
  OUTCOME_MAIN_BLOCK_CASES,
  OUTCOME_MAIN_BLOCK_DECISION_CALLS,
  OUTCOME_MAIN_BLOCK_SEEDS,
  auditOutcomeMainBlockSeedFreshness,
  buildOutcomeMainBlockAssignments,
  guardOutcomeMainBlockDecisionCollection,
  guardOutcomeMainBlockStudyPlan,
  resolveOutcomeMainBlockLaunchCommit,
  runAfterOutcomeMainBlockAllowanceGuard,
  shouldReuseOutcomeMainBlockLaunchArtifacts,
  verifyOutcomeMainBlockManifest,
} from '../scripts/run-adaptive-warrant-outcome-main-block.js';
import { annotationCaseFingerprint } from '../scripts/run-adaptive-warrant-baseline-study.js';
import {
  ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
  assembleAdaptiveWarrantAnnotationResponse,
  prepareAdaptiveWarrantAnnotationBatches,
} from '../scripts/prepare-adaptive-warrant-annotation-batches.js';
import {
  assembleAdaptiveWarrantSemanticAnnotationResponse,
  prepareAdaptiveWarrantSemanticAnnotationBatches,
} from '../scripts/prepare-adaptive-warrant-semantic-annotations.js';
import { buildAdaptiveWarrantV3SemanticDiagnostic } from '../scripts/build-adaptive-warrant-v3-semantic-diagnostic.js';
import { runAdaptiveWarrantSemanticBrittlenessPreflight } from '../scripts/run-adaptive-warrant-semantic-brittleness-preflight.js';
import { runAdaptiveWarrantDecisionReaders } from '../scripts/run-adaptive-warrant-decision-readers.js';
import { runAdaptiveWarrantSemanticReaders } from '../scripts/run-adaptive-warrant-semantic-readers.js';
import { ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA } from '../services/adaptiveWarrantSemanticAnnotation.js';
import { ADAPTIVE_WARRANT_SEMANTIC_FINGERPRINT_PATHS } from '../services/adaptiveWarrantSemanticPreflight.js';
import { validateAdaptiveWarrantReaderResponseContract } from '../services/adaptiveWarrantReaderRetake.js';
import { describeOutcomeMeasures7And8FromStoredEvents } from '../scripts/score-adaptive-warrant-outcome-study.js';
import { auditTutorStubPrompt, TUTOR_STUB_PROMPT_BUDGETS } from '../services/tutorStubPromptAudit.js';
import { auditTutorStubBaseSystemPrompt } from '../services/tutorStubSessionApplicationContext.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// The frozen pilot/baseline run artifacts are machine-local (gitignored) and
// archived only in the sibling private repo, so guards over the real files can
// run only where those artifacts exist.
const MACHINE_LOCAL_ARTIFACT = path.join(
  ROOT,
  '.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/annotation-sample.blinded.json',
);
const MACHINE_LOCAL_ARTIFACTS_SKIP = fs.existsSync(MACHINE_LOCAL_ARTIFACT)
  ? false
  : `machine-local warrant run artifacts absent (${MACHINE_LOCAL_ARTIFACT}); archived in the private repo`;

// Narrower, and a different fault: burned corpora under the system temp
// directory are swept by a housekeeping job (defect ledger 21). With any of
// them gone a FRESH-launch guard must refuse, so tests that drive the fresh
// path have nothing left to prove. The restart path stands in from the launch
// record instead, and its tests must never carry this skip.
const absentBurnedCorpora = absentOutcomeExcludedArtifacts();
const BURNED_CORPORA_SKIP = absentBurnedCorpora.length
  ? `burned corpora absent on this machine (${absentBurnedCorpora.length} of ${OUTCOME_PILOT_EXCLUDED_ARTIFACTS.length}); a fresh launch is meant to refuse here`
  : false;

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-pilot-harness-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fileSha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function binding(filePath) {
  return { path: filePath, sha256: fileSha256(filePath) };
}

function fingerprintCase(index) {
  return {
    sample_id: `case-${index}`,
    transcript_before_decision: [{ turn: index, learner: `learner ${index}`, tutor: `tutor ${index}` }],
    current_learner_turn: { turn: index, learner: `current ${index}` },
    learner_record_at_decision: { grounded_count: index, voiced_derived_count: 0, total: index },
    learner_record_trajectory: [{ turn: index, grounded_count: index, voiced_derived_count: 0, total: index }],
  };
}

function fingerprintKey(corpusCase, { dialogueId = `dialogue-${corpusCase.sample_id}`, turn } = {}) {
  return {
    sample_id: corpusCase.sample_id,
    job_id: dialogueId,
    turn: turn ?? corpusCase.current_learner_turn.turn,
    source_fingerprint: annotationCaseFingerprint(corpusCase),
  };
}

function v3Dialogue11FixtureEvents() {
  return fs
    .readFileSync(
      path.join(ROOT, 'tests/fixtures/adaptive-warrant-outcome-v3-dialogue-11-learner-analysis.jsonl'),
      'utf8',
    )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

function reusableCollectionFixture(t, channel = 'presence') {
  const directory = temporaryDirectory(t);
  const collectionDir = path.join(directory, `${channel}-collection`);
  const packetPath = path.join(collectionDir, 'packets', 'batch-01.packet.json');
  const schemaPath = path.join(collectionDir, 'packets', 'batch-01.response.schema.json');
  writeJson(packetPath, { packet: channel });
  writeJson(schemaPath, { type: 'object' });
  const presence = channel === 'presence';
  const manifestPath = path.join(
    collectionDir,
    presence ? 'semantic-annotation-collection-manifest.json' : 'annotation-collection-manifest.json',
  );
  const authorizationRequestPath = path.join(
    collectionDir,
    presence ? 'semantic-annotation-authorization-request.json' : 'annotation-authorization-request.json',
  );
  const batch = {
    batch_id: `${channel}-batch-01`,
    packet_path: packetPath,
    packet_sha256: fileSha256(packetPath),
    ...(presence
      ? { response_schema_path: schemaPath, response_schema_sha256: fileSha256(schemaPath) }
      : { output_schema_path: schemaPath, output_schema_sha256: fileSha256(schemaPath) }),
  };
  writeJson(manifestPath, { readers: [{ reader_id: `${channel}-reader`, batches: [batch] }] });
  writeJson(authorizationRequestPath, {
    bindings: {
      [presence ? 'manifest_sha256' : 'collection_manifest_sha256']: fileSha256(manifestPath),
    },
  });
  return { collectionDir, manifestPath, authorizationRequestPath, packetPath, schemaPath };
}

function zeroCallArtifactFixture(t) {
  const directory = temporaryDirectory(t);
  const launchCommit = 'a'.repeat(40);
  const preflightPath = path.join(directory, 'semantic-brittleness-preflight.json');
  const schemaAcceptancePath = path.join(directory, 'semantic-schema-acceptance-carryover.json');
  writeJson(preflightPath, {
    schema: 'machinespirits.adaptation-refinement.semantic-brittleness-preflight.v1',
    status: 'passed',
    verdict: 'instrument_ready',
    checks: [{ name: 'fixture', status: 'pass' }],
    bindings: { source_commit: launchCommit },
  });
  writeJson(schemaAcceptancePath, {
    schema: 'machinespirits.adaptation-refinement.semantic-schema-acceptance-result.v1',
    status: 'passed',
    inferential_role: 'transport_only_permanently_excluded',
    synthetic_case_permanently_excluded: true,
    source_commit: launchCommit,
    response_received: true,
    calls: { attempted: 1, completed: 1, maximum: 1 },
    prohibited_tool_event_count: 0,
    preflight: { path: preflightPath, sha256: fileSha256(preflightPath) },
  });
  const preflightBinding = { ...binding(preflightPath), source_commit: launchCommit };
  const schemaAcceptanceBinding = {
    ...binding(schemaAcceptancePath),
    source_commit: launchCommit,
    preflight_sha256: preflightBinding.sha256,
  };
  const freeze = {
    source_commit: launchCommit,
    semantic_instrument: { preflight: binding(preflightPath), schema_acceptance: binding(schemaAcceptancePath) },
  };
  const semanticCollection = {
    manifest: {
      source_commit: launchCommit,
      brittleness_preflight: preflightBinding,
      schema_acceptance_ping: schemaAcceptanceBinding,
    },
    authorizationRequest: {
      bindings: {
        source_commit: launchCommit,
        brittleness_preflight: preflightBinding,
        schema_acceptance_ping: schemaAcceptanceBinding,
      },
    },
  };
  const decisionCollection = {
    manifest: { source_commit: launchCommit, semantic_brittleness_preflight: preflightBinding },
    authorizationRequest: {
      bindings: { source_commit: launchCommit, semantic_brittleness_preflight: preflightBinding },
    },
  };
  return {
    launchCommit,
    preflightPath,
    schemaAcceptancePath,
    freeze,
    semanticCollection,
    decisionCollection,
  };
}

function installFakeGit(t, directory) {
  const binDir = path.join(directory, 'fake-bin');
  const gitPath = path.join(binDir, 'git');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(
    gitPath,
    [
      '#!/bin/sh',
      'if [ "$1" = "rev-parse" ] && [ "$2" = "HEAD" ]; then',
      '  printf "%s\\n" "$OUTCOME_PILOT_TEST_GIT_HEAD"',
      '  exit 0',
      'fi',
      'if [ "$1" = "status" ]; then',
      '  exit 0',
      'fi',
      'exit 64',
      '',
    ].join('\n'),
  );
  fs.chmodSync(gitPath, 0o755);
  const originalPath = process.env.PATH;
  const originalHead = process.env.OUTCOME_PILOT_TEST_GIT_HEAD;
  process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;
  t.after(() => {
    process.env.PATH = originalPath;
    if (originalHead === undefined) delete process.env.OUTCOME_PILOT_TEST_GIT_HEAD;
    else process.env.OUTCOME_PILOT_TEST_GIT_HEAD = originalHead;
  });
}

function childReaderFixture(t, channel, { oneCaseBatches = false } = {}) {
  const directory = temporaryDirectory(t);
  const launchCommit = '1'.repeat(40);
  const resumeCommit = '2'.repeat(40);
  installFakeGit(t, directory);
  process.env.OUTCOME_PILOT_TEST_GIT_HEAD = launchCommit;

  const studyId = `outcome-pilot-child-${channel}`;
  const built = buildAdaptiveWarrantV3SemanticDiagnostic({ studyId });
  const corpusPath = path.join(directory, 'corpus.json');
  writeJson(corpusPath, built.corpus);
  const semanticHandbookPath = path.join(directory, 'semantic-handbook.md');
  const annotationHandbookPath = path.join(directory, 'annotation-handbook.md');
  fs.writeFileSync(semanticHandbookPath, '# Frozen semantic handbook\n');
  fs.writeFileSync(annotationHandbookPath, '# Frozen decision handbook\n');
  const preflightPath = path.join(directory, 'semantic-brittleness-preflight.json');
  runAdaptiveWarrantSemanticBrittlenessPreflight({ outputPath: preflightPath, sourceCommit: launchCommit });
  const schemaAcceptancePath = path.join(directory, 'semantic-schema-acceptance-carryover.json');
  writeJson(schemaAcceptancePath, {
    schema: 'machinespirits.adaptation-refinement.semantic-schema-acceptance-result.v1',
    status: 'passed',
    inferential_role: 'transport_only_permanently_excluded',
    synthetic_case_permanently_excluded: true,
    source_commit: launchCommit,
    response_received: true,
    calls: { attempted: 1, completed: 1, maximum: 1 },
    prohibited_tool_event_count: 0,
    preflight: { path: preflightPath, sha256: fileSha256(preflightPath) },
  });
  const semanticCollection = prepareAdaptiveWarrantSemanticAnnotationBatches({
    corpusPath,
    handbookPath: semanticHandbookPath,
    outputDir: path.join(directory, 'semantic-collection'),
    corpusRole: 'natural_prevalence',
    batchSize: oneCaseBatches ? 1 : built.corpus.cases.length,
    maximumCalls: oneCaseBatches ? built.corpus.cases.length * 2 : 2,
    preflightPath,
    schemaAcceptancePath,
  });
  const decisionCollection = prepareAdaptiveWarrantAnnotationBatches({
    corpusPath,
    handbookPath: annotationHandbookPath,
    outputDir: path.join(directory, 'decision-collection'),
    corpusRole: 'natural_prevalence',
    batchSize: oneCaseBatches ? 1 : built.corpus.cases.length,
    maxAnnotationCalls: oneCaseBatches ? built.corpus.cases.length * 2 : 2,
    preflightPath,
  });
  const artifactPath = (name, value = { name }) => {
    const filePath = path.join(directory, name);
    writeJson(filePath, value);
    return filePath;
  };
  const freezePath = path.join(directory, 'annotation-freeze-manifest.json');
  writeJson(freezePath, {
    schema: OUTCOME_PILOT_FREEZE_SCHEMA,
    study_id: studyId,
    status: 'frozen',
    source_commit: launchCommit,
    protocol: binding(artifactPath('protocol.json')),
    study_plan: binding(artifactPath('study-plan.json')),
    semantic_instrument: { preflight: binding(preflightPath), schema_acceptance: binding(schemaAcceptancePath) },
    annotation_handbook: binding(annotationHandbookPath),
    semantic_handbook: binding(semanticHandbookPath),
    semantic_predictions: binding(artifactPath('semantic-predictions.json')),
    corpus: binding(corpusPath),
    key: binding(artifactPath('key.json')),
  });
  const semantic = channel === 'semantic';
  const collection = semantic ? semanticCollection : decisionCollection;
  return {
    directory,
    launchCommit,
    resumeCommit,
    freezePath,
    manifestPath: collection.manifestPath,
    authorizationRequestPath: collection.authorizationRequestPath,
    collection,
    checkpointName: semantic ? 'semantic-reader-run.json' : 'decision-reader-run.json',
    run: semantic ? runAdaptiveWarrantSemanticReaders : runAdaptiveWarrantDecisionReaders,
    responseSchema: semantic
      ? ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA
      : ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
  };
}

function childReaderResponse(fixture, prompt) {
  const packet = JSON.parse(prompt);
  return {
    text: JSON.stringify({
      schema: fixture.responseSchema,
      reader_id: packet.reader_id,
      batch_id: packet.batch_id,
      study_id: packet.study_id,
      corpus_sha256: packet.corpus_sha256,
      cases_by_sample_id: Object.fromEntries(Object.keys(packet.cases_by_sample_id).map((sampleId) => [sampleId, {}])),
    }),
  };
}

function validChildReaderResponse(fixture, prompt) {
  const packet = JSON.parse(prompt);
  const response = structuredClone(packet.response_template);
  for (const row of Object.values(response.cases_by_sample_id)) {
    if (fixture.responseSchema === ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA) {
      row.genuinely_ambiguous = false;
      row.ambiguity_reason = 'none';
      row.events = [];
      row.note = 'No bounded semantic event is required by this synthetic contract-valid fixture.';
    } else {
      row.speech_act = 'other';
      row.open_obligation_source_turns = [];
      row.obligation_state = 'none';
      row.inquiry_state = 'incomplete';
      row.commitment_transition_warranted = 'no';
      row.current_candidate_override_required = 'no';
      row.primary_warrant_basis = 'none';
      row.recommended_action_family = 'hold';
      row.note = 'The public evidence does not require a commitment transition in this synthetic fixture.';
      for (const divergence of Object.values(row.divergence_by_dimension)) {
        divergence.interpretation = 'aligned';
        divergence.magnitude = 'none';
        divergence.persistence = 'none';
        divergence.note = 'The public trace is aligned on this dimension in the synthetic fixture.';
      }
    }
  }
  return {
    text: JSON.stringify(response),
    provider: 'codex',
    model: 'gpt-5.6-luna',
    modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
    modelIndependentlyAttested: false,
    prohibitedToolEventCount: 0,
  };
}

test('main-block study plan freezes 72 dialogues, 24 per condition, and amended seeds 524-535', () => {
  const guarded = verifyOutcomeMainBlockManifest();
  assert.deepEqual(guarded.manifest.seeds, OUTCOME_MAIN_BLOCK_SEEDS);
  assert.equal(guarded.manifest.channels.presence.enabled, false);
  assert.equal(guarded.manifest.channels.decision.enabled, true);
  const assignments = buildOutcomeMainBlockAssignments({ seeds: guarded.manifest.seeds });
  const plan = guardOutcomeMainBlockStudyPlan({ manifest: guarded.manifest, assignments });
  assert.equal(plan.status, 'passed');
  assert.equal(plan.counts.dialogues, 72);
  assert.deepEqual(plan.counts.by_condition, { bare: 24, gated: 24, standing_permission: 24 });
  assert.equal(Object.keys(plan.counts.by_seed).length, 12);
  assert.equal(
    Object.values(plan.counts.by_seed).every((count) => count === 6),
    true,
  );
});

test('main-block seed-freshness audit passes a clean root and fails on run-plan and run-directory evidence', (t) => {
  const directory = temporaryDirectory(t);
  const clean = auditOutcomeMainBlockSeedFreshness({ roots: [directory] });
  assert.equal(clean.status, 'passed');
  const burned = path.join(directory, 'burned-smoke-s524');
  fs.mkdirSync(burned, { recursive: true });
  writeJson(path.join(burned, 'run-plan.json'), { command: ['--run-seed', '524'] });
  const failed = auditOutcomeMainBlockSeedFreshness({ roots: [directory] });
  assert.equal(failed.status, 'failed');
  assert.equal(
    failed.hits.some((row) => row.seed === 524 && row.kind === 'run_directory_name'),
    true,
  );
  assert.equal(
    failed.hits.some((row) => row.seed === 524 && row.kind === 'run_metadata'),
    true,
  );
});

test('main-block decision-only assembly guard freezes exactly 576 cases and 1,152 planned calls', () => {
  const batches = Array.from({ length: OUTCOME_MAIN_BLOCK_CASES }, (_unused, index) => ({
    required_sample_ids: [`case-${index + 1}`],
  }));
  const guard = guardOutcomeMainBlockDecisionCollection({
    manifest: {
      corpus: { cases: OUTCOME_MAIN_BLOCK_CASES },
      readers: [
        { reader_id: 'decision-reader-a', batches },
        { reader_id: 'decision-reader-b', batches: structuredClone(batches) },
      ],
    },
    authorizationRequest: {
      call_budget: {
        planned_calls: OUTCOME_MAIN_BLOCK_DECISION_CALLS,
        maximum_calls: OUTCOME_MAIN_BLOCK_AUTHORIZATION_MAXIMUM_CALLS,
      },
    },
  });
  assert.equal(guard.status, 'passed');
  assert.equal(guard.presence_channel_built, false);
  assert.equal(guard.expected_cases, 576);
  assert.equal(guard.expected_calls, 1152);
});

test('main-block full deterministic acceptance contract rejects an invalid fresh decision response', (t) => {
  const fixture = childReaderFixture(t, 'decision', { oneCaseBatches: true });
  const manifest = fixture.collection.manifest;
  const reader = manifest.readers[0];
  const batch = reader.batches[0];
  const packet = fs.readFileSync(batch.packet_path, 'utf8');
  const valid = JSON.parse(validChildReaderResponse(fixture, packet).text);
  const sampleId = batch.required_sample_ids[0];
  delete valid.cases_by_sample_id[sampleId].note;
  assert.throws(
    () =>
      validateAdaptiveWarrantReaderResponseContract({
        response: valid,
        collectionManifest: manifest,
        reader,
        batch,
        assemble: assembleAdaptiveWarrantAnnotationResponse,
      }),
    /unexpected fields|must contain|missing|required|exact/u,
  );
});

test('main-block failed-attempt boundary refuses before invoking a model callback', async () => {
  let calls = 0;
  await assert.rejects(
    runAfterOutcomeMainBlockAllowanceGuard({
      callsAttempted: OUTCOME_MAIN_BLOCK_ABSOLUTE_READER_ATTEMPT_CEILING,
      launch: async () => {
        calls += 1;
      },
    }),
    /48-attempt reader allowance exhausted/u,
  );
  assert.equal(calls, 0);
});

test('main-block measures 7 and 8 use stored events and stay explicitly not reader-validated', () => {
  const result = describeOutcomeMeasures7And8FromStoredEvents([
    {
      sample_id: 'case-1',
      job_id: 'dialogue-1',
      turn: 1,
      condition: 'gated',
      gate: {
        semantic_event_extraction: {
          events: [{ speech_act: 'tutor_directed_public_result_request' }, { speech_act: 'learner_proposed_test' }],
        },
      },
    },
    {
      sample_id: 'case-2',
      job_id: 'dialogue-1',
      turn: 2,
      condition: 'gated',
      gate: { semantic_event_extraction: { events: [] } },
    },
  ]);
  assert.equal(result.zero_model_calls, true);
  assert.equal(result.validation_label, 'not reader-validated');
  assert.equal(result.source, 'stored_generation_time_semantic_events');
  assert.deepEqual(result.measure_7_result_requests.overall, { present: 1, total: 2, rate: 0.5 });
  assert.deepEqual(result.measure_8_proposed_tests.overall, { present: 1, total: 2, rate: 0.5 });
});

async function completeChildWithOneContractInvalidBatch(t, channel) {
  const fixture = childReaderFixture(t, channel, { oneCaseBatches: true });
  const outputDir = path.join(fixture.directory, `${channel}-run`);
  const manifest = JSON.parse(fs.readFileSync(fixture.manifestPath, 'utf8'));
  const reader = manifest.readers[0];
  const batch = reader.batches[0];
  const args = {
    manifestPath: fixture.manifestPath,
    freezeManifestPath: fixture.freezePath,
    authorizationRequestPath: fixture.authorizationRequestPath,
    outputDir,
    approvedBy: 'tests/adaptiveWarrantOutcomePilot.test.js',
  };
  await fixture.run({
    ...args,
    callModel: async (_model, _system, prompt) => {
      const packet = JSON.parse(prompt);
      return packet.reader_id === reader.reader_id && packet.batch_id === batch.batch_id
        ? {
            ...childReaderResponse(fixture, prompt),
            provider: 'codex',
            model: 'gpt-5.6-luna',
            modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
            modelIndependentlyAttested: false,
            prohibitedToolEventCount: 0,
          }
        : validChildReaderResponse(fixture, prompt);
    },
  });
  const runPath = path.join(outputDir, fixture.checkpointName);
  const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  const completion = run.batches.find(
    (row) => row.reader_id === reader.reader_id && row.batch_id === batch.batch_id && row.status === 'complete',
  );
  const runRoot = path.dirname(outputDir);
  const quarantineDirectory = path.join(runRoot, 'quarantine-ruling-094a-contract-invalid-responses');
  const quarantinePath = path.join(quarantineDirectory, reader.reader_id, batch.expected_response_filename);
  fs.mkdirSync(path.dirname(quarantinePath), { recursive: true });
  fs.renameSync(completion.response_path, quarantinePath);
  const authorityPath = path.join(
    ROOT,
    'docs/adaptation-refinement/relay/094a-reviewer-ruling-contract-invalid-response-retake.md',
  );
  const quarantineManifestPath = path.join(runRoot, 'reader-response-quarantine-manifest.json');
  const retakeChannel = channel === 'semantic' ? 'presence' : 'decision';
  writeJson(quarantineManifestPath, {
    schema: 'machinespirits.adaptation-refinement.reader-response-quarantine-manifest.v1',
    status: 'reviewer_authorized',
    study_id: manifest.study_id,
    created_at: '2026-08-13T00:00:00Z',
    authority: { path: authorityPath, sha256: fileSha256(authorityPath) },
    run_root: runRoot,
    quarantine_directory: quarantineDirectory,
    enumeration: {
      accepted_responses_audited: 576,
      presence_invalid: retakeChannel === 'presence' ? 1 : 0,
      decision_invalid: retakeChannel === 'decision' ? 1 : 0,
      allowance_room_per_channel: 10,
    },
    entries: [
      {
        channel: retakeChannel,
        reader_id: reader.reader_id,
        batch_id: batch.batch_id,
        sample_id: batch.required_sample_ids[0],
        response_path: completion.response_path,
        quarantine_path: quarantinePath,
        response_sha256: completion.response_sha256,
        error: `${batch.batch_id} synthetic contract-invalid accepted response`,
      },
    ],
  });
  return {
    fixture,
    args,
    manifest,
    reader,
    batch,
    outputDir,
    runPath,
    quarantinePath,
    quarantineManifestPath,
    originalCompletion: completion,
  };
}

test('paid execution refuses before any work when --go-note is absent', async () => {
  await assert.rejects(
    executeOutcomePilot({ acceptCharges: true, outputDir: '/tmp/must-not-exist-outcome-pilot' }),
    /--go-note is required/u,
  );
});

test('manifest guard refuses a menu SHA mismatch', (t) => {
  const directory = temporaryDirectory(t);
  const source = path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
  manifest.standing_permission.menu_json_sha256 = '0'.repeat(64);
  const manifestPath = path.join(directory, 'pilot-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(() => verifyOutcomePilotManifestBindings({ manifestPath }), /menu JSON SHA mismatch/u);
});

test(
  'manifest guard passes on the real frozen files (menu text carries one trailing newline)',
  { skip: MACHINE_LOCAL_ARTIFACTS_SKIP || BURNED_CORPORA_SKIP },
  () => {
    const result = verifyOutcomePilotManifestBindings({});
    assert.equal(typeof result, 'object');
    assert.deepEqual(result.manifest.presence_channel.caps_bytes, {
      response: 14000,
      packet: 60000,
    });
    assert.deepEqual(result.manifest.planned_calls, {
      generation: 540,
      presence_readers: 288,
      decision_readers: 288,
      total: 1116,
      arithmetic: '(18 x 30 cap) + (2 x 144) + (2 x 144) = 1116; measured live unit 26 per dialogue (report 069)',
      counter_before: 4198,
      counter_after_if_completed: 5314,
      ceiling: 19337,
      remaining_after_if_completed: 14023,
    });
  },
);

test('real frozen worlds render all three conditions through the zero-call prompt preflight', (t) => {
  const directory = temporaryDirectory(t);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json'), 'utf8'),
  );
  const artifactPath = path.join(directory, 'prompt-audit-preflight.json');
  const artifact = preflightOutcomePilotPromptAudits({ manifest, outputPath: artifactPath });
  assert.equal(artifact.status, 'passed');
  assert.equal(artifact.makes_model_calls, false);
  assert.equal(artifact.model_calls, 0);
  assert.equal(artifact.renders.length, 6);
  assert.ok(artifact.renders.every((row) => row.ok && row.violations.length === 0));
  assert.ok(
    artifact.renders
      .filter((row) => row.condition !== 'standing_permission')
      .every(
        (row) =>
          row.surface === 'tutor_system' &&
          row.budget.maxChars === TUTOR_STUB_PROMPT_BUDGETS.tutor_system.maxChars &&
          row.budget.maxApproxTokens === TUTOR_STUB_PROMPT_BUDGETS.tutor_system.maxApproxTokens,
      ),
  );
  assert.ok(
    artifact.renders
      .filter((row) => row.condition === 'standing_permission')
      .every(
        (row) =>
          row.surface === 'tutor_system_standing' &&
          row.budget.maxChars === TUTOR_STUB_PROMPT_BUDGETS.tutor_system_standing.maxChars &&
          row.budget.maxApproxTokens === TUTOR_STUB_PROMPT_BUDGETS.tutor_system_standing.maxApproxTokens,
      ),
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(artifactPath, 'utf8')), artifact);
});

test('a genuine duplicate outside the real frozen standing-permission menu still fails', () => {
  const worldPath = 'docs/adaptation-refinement/outcome-study-a1/worlds/world_101_kestrel_signal_lamp.yaml';
  const rendered = renderOutcomePilotPromptConfiguration({
    worldPath,
    condition: 'standing_permission',
    seed: 515,
  });
  const standingInstructions = fs.readFileSync(
    path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/standing-permission-menu.txt'),
    'utf8',
  );
  const duplicate =
    'This deliberately duplicated outer instruction must remain visible to the fail-closed prompt audit.';
  const audit = auditTutorStubBaseSystemPrompt({
    auditTutorStubPrompt,
    systemPrompt: `${rendered.systemPrompt}\n${duplicate}\n${duplicate}`,
    standingInstructions,
  });
  assert.equal(audit.ok, false);
  assert.ok(audit.violations.some((violation) => violation.code === 'duplicate_instruction_lines'));
});

test('a genuine duplicate inside one real standing-permission branch still fails', () => {
  const worldPath = 'docs/adaptation-refinement/outcome-study-a1/worlds/world_101_kestrel_signal_lamp.yaml';
  const rendered = renderOutcomePilotPromptConfiguration({
    worldPath,
    condition: 'standing_permission',
    seed: 515,
  });
  const standingInstructions = fs.readFileSync(
    path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/standing-permission-menu.txt'),
    'utf8',
  );
  const instruction =
    'Answer, credit, qualify, correct, or receive the learner’s concrete move; never use generic praise.';
  const duplicatedInstructions = standingInstructions.replace(instruction, `${instruction}\n${instruction}`);
  const audit = auditTutorStubBaseSystemPrompt({
    auditTutorStubPrompt,
    systemPrompt: rendered.systemPrompt.replace(standingInstructions, duplicatedInstructions),
    standingInstructions: duplicatedInstructions,
  });
  assert.equal(audit.ok, false);
  assert.ok(audit.violations.some((violation) => violation.code === 'duplicate_instruction_lines'));
});

test('an oversized prompt on the real frozen standing surface still fails', () => {
  const worldPath = 'docs/adaptation-refinement/outcome-study-a1/worlds/world_102_marigold_archive_box.yaml';
  const rendered = renderOutcomePilotPromptConfiguration({
    worldPath,
    condition: 'standing_permission',
    seed: 515,
  });
  const standingInstructions = fs.readFileSync(
    path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/standing-permission-menu.txt'),
    'utf8',
  );
  const audit = auditTutorStubBaseSystemPrompt({
    auditTutorStubPrompt,
    systemPrompt: `${rendered.systemPrompt}\n${'x'.repeat(TUTOR_STUB_PROMPT_BUDGETS.tutor_system_standing.maxChars)}`,
    standingInstructions,
  });
  assert.equal(audit.ok, false);
  assert.ok(audit.violations.some((violation) => violation.code === 'character_budget_exceeded'));
  assert.ok(audit.violations.some((violation) => violation.code === 'approximate_token_budget_exceeded'));
});

test('annotationCaseFingerprint failure blocks reader admission', async () => {
  let readerCalls = 0;
  await assert.rejects(
    runReadersAfterFingerprintGuard({
      cases: [fingerprintCase(1)],
      expectedCount: 2,
      runReaders: async () => {
        readerCalls += 1;
      },
    }),
    /expected 2 cases, got 1/u,
  );
  assert.equal(readerCalls, 0);
});

test('annotationCaseFingerprint guard passes and reports legitimate byte twins with distinct identities', () => {
  const first = fingerprintCase(1);
  const twin = { ...structuredClone(first), sample_id: 'case-twin' };
  const result = guardOutcomeAnnotationFingerprints({
    cases: [first, twin],
    keyCases: [
      fingerprintKey(first, { dialogueId: 'dialogue-a', turn: 1 }),
      fingerprintKey(twin, { dialogueId: 'dialogue-b', turn: 1 }),
    ],
    expectedCount: 2,
  });
  assert.equal(result.status, 'passed');
  assert.equal(result.observed_identity_count, 2);
  assert.equal(result.unique_content_fingerprint_count, 1);
  assert.deepEqual(result.byte_twin_groups, [
    {
      content_sha256: annotationCaseFingerprint(first),
      cases: [
        { sample_id: 'case-1', dialogue_id: 'dialogue-a', turn: 1 },
        { sample_id: 'case-twin', dialogue_id: 'dialogue-b', turn: 1 },
      ],
    },
  ]);
  assert.notEqual(result.fingerprints[0], result.fingerprints[1]);
});

test('annotationCaseFingerprint guard refuses a doubled dialogue and turn identity', () => {
  const first = fingerprintCase(1);
  const second = fingerprintCase(2);
  assert.throws(
    () =>
      guardOutcomeAnnotationFingerprints({
        cases: [first, second],
        keyCases: [
          fingerprintKey(first, { dialogueId: 'dialogue-a', turn: 1 }),
          fingerprintKey(second, { dialogueId: 'dialogue-a', turn: 1 }),
        ],
        expectedCount: 2,
      }),
    /identity guard found doubled identity dialogue-a turn 1/u,
  );
});

test('annotationCaseFingerprint guard refuses a case mutated after source extraction', () => {
  const corpusCase = fingerprintCase(1);
  const keyCase = fingerprintKey(corpusCase);
  corpusCase.current_learner_turn.learner = 'mutated bytes';
  assert.throws(
    () => guardOutcomeAnnotationFingerprints({ cases: [corpusCase], keyCases: [keyCase], expectedCount: 1 }),
    /integrity guard found mutated case case-1/u,
  );
});

test('annotationCaseFingerprint guard refuses count drift', () => {
  const corpusCase = fingerprintCase(1);
  assert.throws(
    () =>
      guardOutcomeAnnotationFingerprints({
        cases: [corpusCase],
        keyCases: [fingerprintKey(corpusCase)],
        expectedCount: 144,
      }),
    /expected 144 cases, got 1/u,
  );
  // No default count: a 72-dialogue run checked against the pilot's 144 would
  // pass on the wrong number, so the count must be given.
  assert.throws(
    () => guardOutcomeAnnotationFingerprints({ cases: [corpusCase], keyCases: [fingerprintKey(corpusCase)] }),
    /needs the case count the manifest states/u,
  );
});

test('checkpoint resume skips a completed dialogue', async (t) => {
  const directory = temporaryDirectory(t);
  const checkpointPath = path.join(directory, 'checkpoint.json');
  const checkpoint = {
    schema: OUTCOME_PILOT_CHECKPOINT_SCHEMA,
    status: 'generation',
    call_budget: {
      plan: { generation: 540, presence_readers: 288, decision_readers: 288, total: 1116 },
      actual: { generation: 26, presence_readers: 0, decision_readers: 0, total: 26 },
      delta: { generation: 514, presence_readers: 288, decision_readers: 288, total: 1090 },
      events: [],
    },
    dialogues: [{ id: 'done-dialogue', status: 'complete' }],
    quarantined_dialogues: [],
  };
  const budget = createOutcomePilotBudget({ checkpointPath, checkpoint });
  let launches = 0;
  await runOutcomeGeneration({
    jobs: [{ id: 'done-dialogue', command: ['false'] }],
    checkpoint,
    budget,
    runDialogue: async () => {
      launches += 1;
      return { status: 1 };
    },
  });
  assert.equal(launches, 0);
  assert.equal(checkpoint.dialogues.length, 1);
});

test('main-block reader resume reuses the preflight launch stamp before freeze emission and checks it afterward', () => {
  const launchCommit = '1'.repeat(40);
  const semanticPreflight = { bindings: { source_commit: launchCommit } };
  assert.equal(resolveOutcomeMainBlockLaunchCommit({ checkpoint: { freeze: null }, semanticPreflight }), launchCommit);
  assert.equal(
    resolveOutcomeMainBlockLaunchCommit({
      checkpoint: { freeze: { source_commit: launchCommit } },
      semanticPreflight,
    }),
    launchCommit,
  );
  assert.throws(
    () =>
      resolveOutcomeMainBlockLaunchCommit({
        checkpoint: { freeze: { source_commit: '2'.repeat(40) } },
        semanticPreflight,
      }),
    /semantic preflight launch stamp drift/u,
  );
});

test('main-block regenerates launch artifacts until a child reader checkpoint exists', () => {
  assert.equal(shouldReuseOutcomeMainBlockLaunchArtifacts({ resume: false, readerResume: false }), false);
  assert.equal(shouldReuseOutcomeMainBlockLaunchArtifacts({ resume: true, readerResume: false }), false);
  assert.equal(shouldReuseOutcomeMainBlockLaunchArtifacts({ resume: true, readerResume: true }), true);
});

test('resumed parent starts both readers fresh when neither child checkpoint exists', async (t) => {
  const rootDir = temporaryDirectory(t);
  const presenceRunDir = path.join(rootDir, 'presence-readers');
  const decisionRunDir = path.join(rootDir, 'decision-readers');
  const launches = [];
  const reservations = [];
  await runReaderProcesses({
    semanticCommand: ['node', 'semantic-reader'],
    decisionCommand: ['node', 'decision-reader'],
    presenceRunDir,
    decisionRunDir,
    rootDir,
    resume: true,
    checkpoint: { call_budget: { plan: { ...OUTCOME_PILOT_CALL_PLAN }, actual: { total: 0 } } },
    budget: { reserveMany: (...args) => reservations.push(args) },
    runProcess: async (command, options) => {
      launches.push({ command, options });
      return { status: 0 };
    },
  });
  assert.deepEqual(
    launches.map((launch) => launch.command),
    [
      ['node', 'semantic-reader'],
      ['node', 'decision-reader'],
    ],
  );
  assert.deepEqual(
    launches.map((launch) => launch.options.logPath),
    [path.join(rootDir, 'presence-readers-launcher.log'), path.join(rootDir, 'decision-readers-launcher.log')],
  );
  assert.equal(reservations.length, 2);
});

test('resumed parent resumes only a child whose own checkpoint exists', async (t) => {
  const rootDir = temporaryDirectory(t);
  const presenceRunDir = path.join(rootDir, 'presence-readers');
  const decisionRunDir = path.join(rootDir, 'decision-readers');
  fs.mkdirSync(presenceRunDir, { recursive: true });
  fs.writeFileSync(path.join(presenceRunDir, 'semantic-reader-run.json'), '{}\n');
  const launches = [];
  await runReaderProcesses({
    semanticCommand: ['node', 'semantic-reader'],
    decisionCommand: ['node', 'decision-reader'],
    presenceRunDir,
    decisionRunDir,
    rootDir,
    resume: true,
    checkpoint: { call_budget: { plan: { ...OUTCOME_PILOT_CALL_PLAN }, actual: { total: 0 } } },
    budget: { reserveMany: () => {} },
    runProcess: async (command, options) => {
      launches.push({ command, options });
      return { status: 0 };
    },
  });
  assert.deepEqual(
    launches.map((launch) => launch.command),
    [
      ['node', 'semantic-reader', '--resume'],
      ['node', 'decision-reader'],
    ],
  );
});

test('resumed parent reuses a complete collection without calling its preparer', (t) => {
  const fixture = reusableCollectionFixture(t, 'presence');
  let preparerCalls = 0;
  const collection = prepareOrReuseOutcomePilotReaderCollection({
    childResume: true,
    collectionDir: fixture.collectionDir,
    channel: 'presence',
    prepare: () => {
      preparerCalls += 1;
      return null;
    },
  });
  assert.equal(collection.reused, true);
  assert.equal(preparerCalls, 0);
  assert.equal(collection.manifestPath, fixture.manifestPath);
});

test('collection reuse refuses a manifest, packet, or output-schema integrity mismatch', (t) => {
  const manifestDrift = reusableCollectionFixture(t, 'presence');
  fs.appendFileSync(manifestDrift.manifestPath, ' ');
  assert.throws(
    () => reuseOutcomePilotReaderCollection({ collectionDir: manifestDrift.collectionDir, channel: 'presence' }),
    /collection manifest integrity mismatch/u,
  );

  const packetDrift = reusableCollectionFixture(t, 'decision');
  fs.appendFileSync(packetDrift.packetPath, ' ');
  assert.throws(
    () => reuseOutcomePilotReaderCollection({ collectionDir: packetDrift.collectionDir, channel: 'decision' }),
    /packet integrity mismatch/u,
  );

  const schemaDrift = reusableCollectionFixture(t, 'presence');
  fs.appendFileSync(schemaDrift.schemaPath, ' ');
  assert.throws(
    () => reuseOutcomePilotReaderCollection({ collectionDir: schemaDrift.collectionDir, channel: 'presence' }),
    /output schema integrity mismatch/u,
  );
});

test('reader resume reuses the original freeze only when its parent-checkpoint hash matches', (t) => {
  const rootDir = temporaryDirectory(t);
  const freezePath = path.join(rootDir, 'annotation-freeze-manifest.json');
  const frozenBinding = { path: '/tmp/frozen', sha256: 'a'.repeat(64) };
  writeJson(freezePath, {
    schema: OUTCOME_PILOT_FREEZE_SCHEMA,
    status: 'frozen',
    protocol: frozenBinding,
    corpus: frozenBinding,
    annotation_handbook: frozenBinding,
    key: frozenBinding,
    study_plan: frozenBinding,
  });
  const checkpoint = { freeze: { path: freezePath, sha256: fileSha256(freezePath) } };
  assert.equal(reuseOutcomePilotOriginalFreeze({ rootDir, checkpoint }).reused, true);
  fs.appendFileSync(freezePath, ' ');
  assert.throws(
    () => reuseOutcomePilotOriginalFreeze({ rootDir, checkpoint }),
    /original emitted freeze does not match the parent checkpoint/u,
  );
});

test('reader resume accepts launch-stamped zero-call artifacts bound by both collections and the freeze', (t) => {
  const fixture = zeroCallArtifactFixture(t);
  const result = verifyOutcomePilotReaderResumeArtifacts(fixture);
  assert.deepEqual(result, {
    status: 'passed',
    source_commit: fixture.launchCommit,
    preflight_sha256: fileSha256(fixture.preflightPath),
    schema_acceptance_sha256: fileSha256(fixture.schemaAcceptancePath),
  });
});

test('reader resume refuses byte-drifted zero-call artifacts while fresh validation still requires HEAD-fresh bytes', (t) => {
  const drifted = zeroCallArtifactFixture(t);
  fs.appendFileSync(drifted.preflightPath, ' ');
  assert.throws(() => verifyOutcomePilotReaderResumeArtifacts(drifted), /reused brittleness preflight hash mismatch/u);

  const stale = zeroCallArtifactFixture(t);
  assert.throws(
    () =>
      validateOutcomePilotZeroCallArtifacts({
        preflightPath: stale.preflightPath,
        schemaAcceptancePath: stale.schemaAcceptancePath,
        expectedSourceCommit: 'b'.repeat(40),
      }),
    /stale or fingerprint-mismatched/u,
  );
});

test('a resume before the freeze takes its launch stamp from the preflight, and only when git agrees', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-resume-stamp-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const preflightPath = path.join(directory, 'semantic-brittleness-preflight.json');
  const stamped = (sourceCommit) => {
    fs.writeFileSync(preflightPath, JSON.stringify({ bindings: { source_commit: sourceCommit } }));
    return preflightPath;
  };
  const inRepo = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

  // The last commit that touched a fingerprinted file: by construction nothing
  // the preflight pins has moved between it and HEAD, however far HEAD travels.
  const lastInstrumentChange = inRepo([
    'log',
    '-1',
    '--format=%H',
    '--',
    ...ADAPTIVE_WARRANT_SEMANTIC_FINGERPRINT_PATHS,
  ]);
  assert.equal(
    resolveOutcomeResumeLaunchCommit({ preflightPath: stamped(lastInstrumentChange) }),
    lastInstrumentChange,
  );

  // One commit earlier an instrument file did move, so that stamp is stale.
  assert.throws(
    () =>
      resolveOutcomeResumeLaunchCommit({ preflightPath: stamped(inRepo(['rev-parse', `${lastInstrumentChange}^`])) }),
    /instrument files moved since the launch commit/u,
  );

  assert.throws(
    () => resolveOutcomeResumeLaunchCommit({ preflightPath: stamped('b'.repeat(40)) }),
    /is not an ancestor of HEAD/u,
  );

  fs.writeFileSync(preflightPath, JSON.stringify({ bindings: {} }));
  assert.throws(() => resolveOutcomeResumeLaunchCommit({ preflightPath }), /carries no launch commit/u);
});

test('both child runners accept an older launch stamp only on resume, record the resume commit, and bound failures', async (t) => {
  for (const channel of ['semantic', 'decision']) {
    await t.test(channel, async (childTest) => {
      const fixture = childReaderFixture(childTest, channel);
      const runArgs = (outputDir, callModel, resume = false) => ({
        manifestPath: fixture.manifestPath,
        freezeManifestPath: fixture.freezePath,
        authorizationRequestPath: fixture.authorizationRequestPath,
        outputDir,
        approvedBy: 'tests/adaptiveWarrantOutcomePilot.test.js',
        resume,
        callModel,
      });

      const outputDir = path.join(fixture.directory, `${channel}-run`);
      await assert.rejects(
        fixture.run(
          runArgs(outputDir, async () => {
            throw new Error('synthetic transport failure');
          }),
        ),
        /synthetic transport failure/u,
      );
      process.env.OUTCOME_PILOT_TEST_GIT_HEAD = fixture.resumeCommit;
      let resumedCalls = 0;
      const completed = await fixture.run(
        runArgs(
          outputDir,
          async (_model, _system, prompt) => {
            resumedCalls += 1;
            return childReaderResponse(fixture, prompt);
          },
          true,
        ),
      );
      assert.equal(completed.run.status, 'complete');
      assert.equal(completed.run.calls_attempted, 3);
      assert.equal(completed.run.calls_completed, 2);
      assert.equal(resumedCalls, 2);
      assert.deepEqual(completed.run.resumed_at_commits, [fixture.resumeCommit]);

      await assert.rejects(
        fixture.run(
          runArgs(path.join(fixture.directory, `${channel}-fresh-stale`), async () => {
            throw new Error('fresh stale launch must not call the model');
          }),
        ),
        /requires the exact clean frozen commit/u,
      );

      process.env.OUTCOME_PILOT_TEST_GIT_HEAD = fixture.launchCommit;
      const boundaryDir = path.join(fixture.directory, `${channel}-allowance-boundary`);
      await assert.rejects(
        fixture.run(
          runArgs(boundaryDir, async () => {
            throw new Error('synthetic boundary setup failure');
          }),
        ),
        /synthetic boundary setup failure/u,
      );
      const checkpointPath = path.join(boundaryDir, fixture.checkpointName);
      const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
      checkpoint.calls_attempted = checkpoint.call_budget.maximum_calls + 12;
      writeJson(checkpointPath, checkpoint);
      process.env.OUTCOME_PILOT_TEST_GIT_HEAD = fixture.resumeCommit;
      let boundaryCalls = 0;
      await assert.rejects(
        fixture.run(
          runArgs(
            boundaryDir,
            async () => {
              boundaryCalls += 1;
              throw new Error('allowance boundary called the model');
            },
            true,
          ),
        ),
        /call budget exhausted/u,
      );
      assert.equal(boundaryCalls, 0);
    });
  }
});

test('both child runners re-run only manifest-listed completed batches and assemble the valid replacement set', async (t) => {
  for (const channel of ['semantic', 'decision']) {
    await t.test(channel, async (childTest) => {
      const prepared = await completeChildWithOneContractInvalidBatch(childTest, channel);
      const { fixture, args, manifest, reader, batch, outputDir, runPath, quarantineManifestPath } = prepared;
      const unlistedBatch = reader.batches[1];
      const unlistedPath = path.join(outputDir, reader.reader_id, unlistedBatch.expected_response_filename);
      const unlistedSha256 = fileSha256(unlistedPath);
      process.env.OUTCOME_PILOT_TEST_GIT_HEAD = fixture.resumeCommit;
      const calledBatches = [];
      const completed = await fixture.run({
        ...args,
        resume: true,
        quarantineManifestPath,
        callModel: async (_model, _system, prompt) => {
          const packet = JSON.parse(prompt);
          calledBatches.push(`${packet.reader_id}:${packet.batch_id}`);
          return validChildReaderResponse(fixture, prompt);
        },
      });

      assert.deepEqual(calledBatches, [`${reader.reader_id}:${batch.batch_id}`]);
      assert.equal(fileSha256(unlistedPath), unlistedSha256);
      assert.equal(
        completed.run.batches.filter(
          (row) =>
            row.reader_id === reader.reader_id && row.batch_id === unlistedBatch.batch_id && row.status === 'complete',
        ).length,
        1,
      );
      const replacement = completed.run.batches.findLast(
        (row) => row.reader_id === reader.reader_id && row.batch_id === batch.batch_id && row.status === 'complete',
      );
      assert.equal(replacement.reviewer_authorized_retake, true);
      assert.equal(replacement.retake_of_response_sha256, prepared.originalCompletion.response_sha256);
      assert.equal(replacement.deterministic_contract_validation, 'passed');
      assert.equal(fs.existsSync(prepared.quarantinePath), true);
      assert.equal(fileSha256(prepared.quarantinePath), prepared.originalCompletion.response_sha256);

      const assemblyView = writeOutcomePilotAssemblyRunView({
        runPath,
        outputPath: path.join(path.dirname(outputDir), `${channel}-assembly-run-view.json`),
      });
      const assemble =
        channel === 'semantic'
          ? assembleAdaptiveWarrantSemanticAnnotationResponse
          : assembleAdaptiveWarrantAnnotationResponse;
      for (const manifestReader of manifest.readers) {
        const assembled = assemble({
          manifestPath: fixture.manifestPath,
          readerId: manifestReader.reader_id,
          annotationRunId: `replacement-assembly-${channel}-${manifestReader.reader_id}`,
          responseDir: path.join(outputDir, manifestReader.reader_id),
          outputPath: path.join(path.dirname(outputDir), `${channel}-${manifestReader.reader_id}.assembled.json`),
          runPath: assemblyView.path,
        });
        assert.equal(assembled.response.cases.length > 0, true);
      }
    });
  }
});

test('both child runners quarantine a contract-invalid re-draw, count it failed, and do not complete the batch', async (t) => {
  for (const channel of ['semantic', 'decision']) {
    await t.test(channel, async (childTest) => {
      const prepared = await completeChildWithOneContractInvalidBatch(childTest, channel);
      const { fixture, args, reader, batch, runPath, quarantineManifestPath } = prepared;
      const before = JSON.parse(fs.readFileSync(runPath, 'utf8'));
      process.env.OUTCOME_PILOT_TEST_GIT_HEAD = fixture.resumeCommit;
      let calls = 0;
      let invalidRaw = null;
      await assert.rejects(
        fixture.run({
          ...args,
          resume: true,
          quarantineManifestPath,
          callModel: async (_model, _system, prompt) => {
            calls += 1;
            if (calls === 1) {
              const invalid = {
                ...childReaderResponse(fixture, prompt),
                provider: 'codex',
                model: 'gpt-5.6-luna',
                modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
                modelIndependentlyAttested: false,
                prohibitedToolEventCount: 0,
              };
              invalidRaw = invalid.text;
              return invalid;
            }
            throw new Error('synthetic transport stop after invalid re-draw');
          },
        }),
        /synthetic transport stop after invalid re-draw/u,
      );
      assert.equal(calls, 2);
      const after = JSON.parse(fs.readFileSync(runPath, 'utf8'));
      assert.equal(after.calls_completed, before.calls_completed);
      assert.equal(
        after.batches.filter(
          (row) =>
            row.reader_id === reader.reader_id &&
            row.batch_id === batch.batch_id &&
            row.status === 'complete' &&
            row.reviewer_authorized_retake === true,
        ).length,
        0,
      );
      const invalidAttempt = after.batches.find(
        (row) =>
          row.reader_id === reader.reader_id &&
          row.batch_id === batch.batch_id &&
          row.status === 'failed' &&
          row.quarantine_path,
      );
      assert.equal(invalidAttempt.reviewer_authorized_retake, true);
      assert.equal(fs.readFileSync(invalidAttempt.quarantine_path, 'utf8'), invalidRaw);
      assert.equal(fileSha256(invalidAttempt.quarantine_path), invalidAttempt.quarantine_sha256);
      assert.equal(fs.existsSync(prepared.originalCompletion.response_path), false);
    });
  }
});

test('launcher quarantines the sealed v3 dialogue-11 coverage shape before counting it complete', async (t) => {
  const directory = temporaryDirectory(t);
  const failure = v3Dialogue11FixtureEvents().find((event) => event.type === 'learner_analysis_unanalyzed');
  const checkpoint = {
    schema: OUTCOME_PILOT_CHECKPOINT_SCHEMA,
    status: 'generation',
    call_budget: {
      plan: { ...OUTCOME_PILOT_CALL_PLAN },
      actual: { generation: 0, presence_readers: 0, decision_readers: 0, total: 0 },
      delta: { ...OUTCOME_PILOT_CALL_PLAN },
      events: [],
    },
    dialogues: [],
    quarantined_dialogues: [],
  };
  const budget = createOutcomePilotBudget({
    checkpointPath: path.join(directory, 'checkpoint.json'),
    checkpoint,
  });
  const row = {
    childStatus: 'ok',
    childEvidence: { ok: true, status: 'complete' },
    turnCount: 8,
    learnerAnalysisCoverage: 0.875,
    learnerAnalysisUnanalyzedTurns: [failure.turn],
    tracePath: null,
  };
  const guard = guardOutcomeDialogueLearnerAnalysisCoverage(row);
  assert.deepEqual(guard, {
    status: 'failed',
    coverage: 0.875,
    unanalyzed_turns: [5],
    reason: 'learner_analysis_coverage_below_one: turns 5',
  });
  await runOutcomeGeneration({
    jobs: [
      {
        id: 'dialogue-11',
        ordinal: 11,
        world: 'world_102',
        seed: 516,
        condition: 'gated',
        command: [],
        jobDir: path.join(directory, 'dialogues', 'dialogue-11'),
      },
    ],
    checkpoint,
    budget,
    runDialogue: async () => ({ status: 0, error: null }),
    collectJobResult: () => row,
  });
  assert.equal(checkpoint.dialogues[0].status, 'quarantined');
  assert.equal(checkpoint.dialogues[0].error, 'learner_analysis_coverage_below_one: turns 5');
  assert.equal(checkpoint.quarantined_dialogues.length, 1);
});

test('representative freeze validates in the form accepted by the frozen decision runner', () => {
  const binding = { path: '/tmp/frozen', sha256: 'a'.repeat(64) };
  const freeze = {
    schema: OUTCOME_PILOT_FREEZE_SCHEMA,
    status: 'frozen',
    protocol: binding,
    corpus: binding,
    annotation_handbook: binding,
    key: binding,
    study_plan: binding,
  };
  assert.deepEqual(validateOutcomeFreezeFormForFrozenDecisionRunner(freeze), {
    status: 'passed',
    form: OUTCOME_PILOT_FREEZE_SCHEMA,
  });
});

test('continuous budget refuses the 1117th reservation', (t) => {
  const directory = temporaryDirectory(t);
  const budget = createOutcomePilotBudget({ checkpointPath: path.join(directory, 'checkpoint.json') });
  budget.reserveMany('presence_readers', 1116);
  assert.throws(() => budget.reserve('decision_readers'), /1116-call budget exhausted/u);
  assert.equal(budget.state.call_budget.actual.total, 1116);
});

test('generation cap covers the measured live per-dialogue unit (report 069: 26 calls)', () => {
  assert.ok(OUTCOME_PILOT_PER_DIALOGUE_CAP >= 26);
  assert.equal(OUTCOME_PILOT_CALL_PLAN.generation, 18 * OUTCOME_PILOT_PER_DIALOGUE_CAP);
  assert.equal(
    OUTCOME_PILOT_CALL_PLAN.total,
    OUTCOME_PILOT_CALL_PLAN.generation +
      OUTCOME_PILOT_CALL_PLAN.presence_readers +
      OUTCOME_PILOT_CALL_PLAN.decision_readers,
  );
  assert.ok(OUTCOME_PILOT_CALL_PLAN.presence_readers >= 288);
});

// --- Run-size registry -----------------------------------------------------
// The driver used to carry the pilot's 18 dialogues as a literal in nine
// places. The registry replaces those literals; these tests hold both sizes to
// their stated numbers and prove that a manifest of one size cannot be launched
// as the other.

test('the pilot shape reproduces the frozen pilot numbers exactly', () => {
  const pilot = OUTCOME_RUN_SHAPES.pilot;
  assert.deepEqual([...pilot.seeds], [515, 516, 517]);
  assert.equal(pilot.dialogues, 18);
  assert.equal(pilot.cases, 144);
  assert.deepEqual(
    { ...pilot.planned_calls },
    {
      generation: 540,
      presence_readers: 288,
      decision_readers: 288,
      total: 1116,
    },
  );
});

test('the main-block shape is the pilot four times over on seeds 654-665', () => {
  const main = OUTCOME_RUN_SHAPES['main-block'];
  assert.deepEqual([...main.seeds], [654, 655, 656, 657, 658, 659, 660, 661, 662, 663, 664, 665]);
  assert.equal(main.dialogues, 72);
  assert.equal(main.cases, 576);
  assert.deepEqual(
    { ...main.planned_calls },
    {
      generation: 2160,
      presence_readers: 1152,
      decision_readers: 1152,
      total: 4464,
    },
  );
  for (const field of ['generation', 'presence_readers', 'decision_readers', 'total']) {
    assert.equal(main.planned_calls[field], OUTCOME_RUN_SHAPES.pilot.planned_calls[field] * 4);
  }
});

test('a manifest that names no size is a pilot, and an unknown size is refused', () => {
  assert.equal(resolveOutcomeRunShape(null).name, 'pilot');
  assert.equal(resolveOutcomeRunShape('main-block').name, 'main-block');
  assert.throws(() => resolveOutcomeRunShape('half-block'), /unknown outcome run shape/u);
});

test('a main-block manifest carrying pilot counts is refused', (t) => {
  const directory = temporaryDirectory(t);
  const source = path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
  manifest.run_shape = 'main-block';
  const manifestPath = path.join(directory, 'mislabelled-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(() => verifyOutcomePilotManifestBindings({ manifestPath }), /main-block seeds/u);
});

test('a call plan whose counter arithmetic does not close is refused', (t) => {
  const directory = temporaryDirectory(t);
  const source = path.join(ROOT, 'docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
  manifest.planned_calls.remaining_after_if_completed += 1;
  const manifestPath = path.join(directory, 'open-sum-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(() => verifyOutcomePilotManifestBindings({ manifestPath }), /counter arithmetic does not close/u);
});

test('the prepared-run guard fails when the seed count does not match the shape', { skip: BURNED_CORPORA_SKIP }, () => {
  const worldPaths = [
    'docs/adaptation-refinement/outcome-study-a1/worlds/world_101_kestrel_signal_lamp.yaml',
    'docs/adaptation-refinement/outcome-study-a1/worlds/world_102_marigold_archive_box.yaml',
  ];
  const result = guardOutcomePilotPreparation({
    worldPaths,
    shape: OUTCOME_RUN_SHAPES['main-block'],
    seeds: [515, 516, 517],
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.run_shape, 'main-block');
  assert.equal(result.expected_prepared_run_count, 72);
  assert.equal(result.prepared_run_count, 18);
});

// --- reviewer ruling over quarantined dialogues -----------------------------
//
// A dialogue that was re-taken leaves one checkpoint row per attempt under the
// same id, and every row points at the same directory on disk. These tests hold
// the line that one dialogue can be admitted once and once only, whichever way
// its attempts ended.

const RULING_STUB = { artifact: { path: 'docs/ruling.json', sha256: 'a'.repeat(64) }, expected_dropped_turns: 1 };

function rulingCheckpoint(dialogues) {
  return {
    dialogues,
    quarantined_dialogues: dialogues.filter((row) => row.status === 'quarantined').map((row) => ({ id: row.id })),
  };
}

function quarantinedRow(id, attempt) {
  return { id, order: 1, status: 'quarantined', attempt, error: 'child seal is not complete', result: null };
}

function admitsEverything({ job }) {
  return {
    admitted: true,
    dropped_turns: [8],
    turns: [{ turn: 8, qualifies: true }],
    row: { tracePath: `/runs/${job.id}/trace.jsonl`, turnCount: 8, learnerAnalysisUnanalyzedTurns: [8] },
  };
}

test('two quarantined attempts at one dialogue are admitted once, not twice', () => {
  const checkpoint = rulingCheckpoint([
    quarantinedRow('dialogue-a', 1),
    quarantinedRow('dialogue-a', 2),
    { id: 'dialogue-b', order: 2, status: 'complete' },
  ]);
  const decisions = applyReviewerRulingToCheckpoint({
    checkpoint,
    jobs: [{ id: 'dialogue-a' }, { id: 'dialogue-b' }],
    ruling: RULING_STUB,
    admitUnderRuling: admitsEverything,
  });

  const admitted = checkpoint.dialogues.filter(
    (row) => row.status === 'complete' || row.status === OUTCOME_RULED_COMPLETE_STATUS,
  );
  assert.equal(admitted.length, 2);
  assert.equal(new Set(admitted.map((row) => row.id)).size, 2);
  // The later attempt is the one on disk, so it is the one admitted.
  assert.equal(checkpoint.dialogues.find((row) => row.status === OUTCOME_RULED_COMPLETE_STATUS).attempt, 2);
  assert.equal(decisions.filter((row) => row.admitted).length, 1);
  assert.equal(decisions.filter((row) => row.skipped).length, 1);
  assert.match(decisions.find((row) => row.skipped).reason, /superseded by a later quarantined attempt/u);
  assert.deepEqual(checkpoint.quarantined_dialogues, []);
});

test('a stale quarantined attempt is skipped when a later attempt already sealed clean', () => {
  const checkpoint = rulingCheckpoint([
    quarantinedRow('dialogue-a', 1),
    { id: 'dialogue-a', order: 1, status: 'complete', attempt: 2 },
  ]);
  let consulted = 0;
  const decisions = applyReviewerRulingToCheckpoint({
    checkpoint,
    jobs: [{ id: 'dialogue-a' }],
    ruling: RULING_STUB,
    admitUnderRuling: (input) => {
      consulted += 1;
      return admitsEverything(input);
    },
  });
  // A dialogue that already passed is never put to the ruling at all.
  assert.equal(consulted, 0);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].skipped, true);
  assert.match(decisions[0].reason, /clean seal/u);
  assert.equal(checkpoint.dialogues.filter((row) => row.status === OUTCOME_RULED_COMPLETE_STATUS).length, 0);
});

test('no ruling means no admission and no change to the checkpoint', () => {
  const checkpoint = rulingCheckpoint([quarantinedRow('dialogue-a', 1)]);
  const decisions = applyReviewerRulingToCheckpoint({
    checkpoint,
    jobs: [{ id: 'dialogue-a' }],
    ruling: null,
    admitUnderRuling: admitsEverything,
  });
  assert.deepEqual(decisions, []);
  assert.equal(checkpoint.dialogues[0].status, 'quarantined');
});

test('a refused admission leaves the dialogue quarantined and records why', () => {
  const checkpoint = rulingCheckpoint([quarantinedRow('dialogue-a', 1)]);
  const decisions = applyReviewerRulingToCheckpoint({
    checkpoint,
    jobs: [{ id: 'dialogue-a' }],
    ruling: RULING_STUB,
    admitUnderRuling: () => ({
      admitted: false,
      reason: 'turn 8: attempt 1 was also rejected for: overlapping_events',
    }),
  });
  assert.equal(checkpoint.dialogues[0].status, 'quarantined');
  assert.equal(checkpoint.quarantined_dialogues.length, 1);
  assert.equal(decisions[0].admitted, false);
  assert.match(decisions[0].reason, /overlapping_events/u);
});

test('a resume does not re-run a dialogue admitted under the ruling', async (t) => {
  const directory = temporaryDirectory(t);
  const checkpointPath = path.join(directory, 'checkpoint.json');
  const checkpoint = {
    schema: OUTCOME_PILOT_CHECKPOINT_SCHEMA,
    status: 'generation',
    call_budget: {
      plan: { generation: 540, presence_readers: 288, decision_readers: 288, total: 1116 },
      actual: { generation: 26, presence_readers: 0, decision_readers: 0, total: 26 },
      delta: { generation: 514, presence_readers: 288, decision_readers: 288, total: 1090 },
      events: [],
    },
    dialogues: [{ id: 'ruled-dialogue', status: OUTCOME_RULED_COMPLETE_STATUS }],
    quarantined_dialogues: [],
  };
  const budget = createOutcomePilotBudget({ checkpointPath, checkpoint });
  let launches = 0;
  await runOutcomeGeneration({
    jobs: [{ id: 'ruled-dialogue', command: ['false'] }],
    checkpoint,
    budget,
    runDialogue: async () => {
      launches += 1;
      return { status: 1 };
    },
  });
  assert.equal(launches, 0);
  assert.equal(checkpoint.dialogues.length, 1);
});
