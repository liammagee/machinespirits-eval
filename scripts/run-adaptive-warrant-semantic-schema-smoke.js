#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  validateAdaptiveWarrantSemanticPreflightArtifact,
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult,
} from '../services/adaptiveWarrantSemanticPreflight.js';
import {
  adaptiveWarrantSemanticConsensusIdentity,
  buildAdaptiveWarrantSemanticConsensus,
  classifyAdaptiveWarrantSemanticDisagreements,
} from '../services/adaptiveWarrantSemanticAnnotation.js';
import {
  assembleAdaptiveWarrantSemanticAnnotationResponse,
  prepareAdaptiveWarrantSemanticAnnotationBatches,
} from './prepare-adaptive-warrant-semantic-annotations.js';
import { runAdaptiveWarrantSemanticReaders } from './run-adaptive-warrant-semantic-readers.js';

export const ADAPTIVE_WARRANT_SEMANTIC_SMOKE_FREEZE_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-schema-smoke-freeze.v1';
export const ADAPTIVE_WARRANT_SEMANTIC_SMOKE_RESULT_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-schema-smoke-result.v1';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function cleanSource() {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (status) throw new Error('semantic schema smoke requires a clean committed worktree');
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit)) throw new Error('semantic schema smoke requires an exact source commit');
  return sourceCommit;
}

export function buildAdaptiveWarrantSemanticSmokeCorpus(sourceCommit) {
  const catalog = {
    schema: 'machinespirits.adaptation-refinement.semantic-event-reader-catalog.v3',
    targets: [
      {
        target_id: 'target-smoke-canal-quay-manifest',
        kind: 'record_entry',
        public_identifier_ids: ['public-id-smoke-canal-quay'],
        allowed_value_types: ['record_text'],
        component_ids: ['bounded_finding'],
        display_label: 'synthetic canal-quay manifest',
      },
      {
        target_id: 'target-smoke-amber-token-stamp-k',
        kind: 'mark_or_tool_result',
        public_identifier_ids: ['public-id-smoke-amber-token', 'public-id-smoke-stamp-k'],
        allowed_value_types: ['match_status'],
        component_ids: ['match_status'],
        display_label: 'synthetic amber-token comparison',
      },
      {
        target_id: 'target-smoke-weather-card-choice',
        kind: 'public_exhibit_result',
        public_identifier_ids: ['public-id-smoke-weather-cards'],
        allowed_value_types: ['other'],
        component_ids: ['next_check'],
        display_label: 'synthetic weather-card choice set',
      },
    ],
    public_identifiers: [
      { public_identifier_id: 'public-id-smoke-canal-quay', display_label: 'canal-quay manifest' },
      { public_identifier_id: 'public-id-smoke-amber-token', display_label: 'amber token' },
      { public_identifier_id: 'public-id-smoke-stamp-k', display_label: 'stamp K' },
      { public_identifier_id: 'public-id-smoke-weather-cards', display_label: 'weather-card comparisons' },
    ],
    components: [
      { component_id: 'bounded_finding', display_label: 'bounded finding' },
      { component_id: 'match_status', display_label: 'match status' },
      { component_id: 'next_check', display_label: 'next check' },
    ],
    action_objects: [
      {
        action_object_id: 'action-object-smoke-enter-canal-quay-finding',
        mode: 'requested',
        action: 'record_public_claim',
        target_id: 'target-smoke-canal-quay-manifest',
        display_label: 'enter the bounded canal-quay finding',
      },
      {
        action_object_id: 'action-object-smoke-select-weather-card',
        mode: 'requested',
        action: 'select_next_step',
        target_id: 'target-smoke-weather-card-choice',
        display_label: 'select the first weather-card comparison',
      },
      {
        action_object_id: 'action-object-smoke-compare-amber-token',
        mode: 'proposed',
        action: 'perform_public_test',
        target_id: 'target-smoke-amber-token-stamp-k',
        display_label: 'compare the amber token with stamp K',
      },
      {
        action_object_id: 'action-object-smoke-report-amber-token-match',
        mode: 'requested',
        action: 'supply_public_result',
        target_id: 'target-smoke-amber-token-stamp-k',
        display_label: 'report the amber-token matching result',
      },
      {
        action_object_id: 'action-object-smoke-explain-public-wording',
        mode: 'requested',
        action: 'explain_wording',
        target_id: null,
        display_label: 'explain public wording',
      },
      {
        action_object_id: 'action-object-smoke-withdraw-current-request',
        mode: 'requested',
        action: 'withdraw_request',
        target_id: null,
        display_label: 'withdraw the current request',
      },
    ],
  };
  return {
    schema: 'machinespirits.adaptation-refinement.annotation-corpus.v1',
    study_id: `adaptive-warrant-v3-semantic-schema-smoke-${sourceCommit.slice(0, 12)}`,
    blinded: true,
    synthetic_smoke_only: true,
    permanently_excluded_from_research: true,
    semantic_annotation_catalog: catalog,
    cases: [
      {
        sample_id: 'synthetic-smoke-canal-quay-record',
        current_learner_turn: {
          turn: 2,
          learner:
            'The canal-quay manifest establishes loading, not receipt. Enter only that bounded conclusion in the review sheet.',
        },
        public_evidence_at_decision: [
          'target-smoke-canal-quay-manifest is identified by public-id-smoke-canal-quay.',
        ],
      },
      {
        sample_id: 'synthetic-smoke-weather-card-selection',
        current_learner_turn: {
          turn: 2,
          learner:
            'Select the first weather-card comparison for me. I refuse to choose between the displayed cards.',
        },
        public_evidence_at_decision: ['public-id-smoke-weather-cards names the displayed weather-card comparisons.'],
      },
      {
        sample_id: 'synthetic-smoke-amber-token-compound',
        current_learner_turn: {
          turn: 2,
          learner: 'I will compare the amber token with stamp K. After that, give me the match outcome.',
        },
        public_evidence_at_decision: [
          'target-smoke-amber-token-stamp-k is identified by public-id-smoke-amber-token and public-id-smoke-stamp-k.',
        ],
      },
    ],
  };
}

function expectedSmokeIdentities() {
  const targetWithSets = (target, requestedValueTypes, componentIds) => ({
    ...target,
    requested_value_types: requestedValueTypes,
    component_ids: componentIds,
  });
  const canalQuayBase = {
    kind: 'record_entry',
    target_id: 'target-smoke-canal-quay-manifest',
    public_identifier_ids: ['public-id-smoke-canal-quay'],
  };
  const amberTokenBase = {
    kind: 'mark_or_tool_result',
    target_id: 'target-smoke-amber-token-stamp-k',
    public_identifier_ids: ['public-id-smoke-amber-token', 'public-id-smoke-stamp-k'],
  };
  const weatherCardChoiceBase = {
    kind: 'public_exhibit_result',
    target_id: 'target-smoke-weather-card-choice',
    public_identifier_ids: ['public-id-smoke-weather-cards'],
  };
  const event = (speechAct, target, mode, executor, action, actionObjectId) => ({
    speaker: 'learner',
    speech_act: speechAct,
    target,
    requested_or_proposed_action:
      actionObjectId === null ? null : { mode, executor, action, action_object_id: actionObjectId },
  });
  return {
    'synthetic-smoke-canal-quay-record': [
      event('analytic_contribution', targetWithSets(canalQuayBase, [], []), null, null, null, null),
      event(
        'learner_record_entry_request',
        targetWithSets(canalQuayBase, ['record_text'], ['bounded_finding']),
        'requested',
        'tutor',
        'record_public_claim',
        'action-object-smoke-enter-canal-quay-finding',
      ),
    ],
    'synthetic-smoke-weather-card-selection': [
      event(
        'tutor_selection_request',
        targetWithSets(weatherCardChoiceBase, ['other'], []),
        'requested',
        'tutor',
        'select_next_step',
        'action-object-smoke-select-weather-card',
      ),
      event('low_agency_deferral', null, null, null, null, null),
    ],
    'synthetic-smoke-amber-token-compound': [
      event(
        'learner_proposed_test',
        targetWithSets(amberTokenBase, [], []),
        'proposed',
        'learner',
        'perform_public_test',
        'action-object-smoke-compare-amber-token',
      ),
      event(
        'tutor_directed_public_result_request',
        targetWithSets(amberTokenBase, ['match_status'], ['match_status']),
        'requested',
        'tutor',
        'supply_public_result',
        'action-object-smoke-report-amber-token-match',
      ),
    ],
  };
}

export function prepareAdaptiveWarrantSemanticSchemaSmoke({ outputDir, preflightPath, schemaAcceptancePath } = {}) {
  const sourceCommit = cleanSource();
  const resolvedOutput = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length) {
    throw new Error(`semantic schema smoke output is not empty: ${resolvedOutput}`);
  }
  fs.mkdirSync(resolvedOutput, { recursive: true });
  const resolvedPreflight = path.resolve(preflightPath);
  const preflight = readJson(resolvedPreflight);
  validateAdaptiveWarrantSemanticPreflightArtifact({ artifact: preflight, expectedSourceCommit: sourceCommit });
  const resolvedSchemaAcceptance = path.resolve(schemaAcceptancePath);
  const schemaAcceptance = readJson(resolvedSchemaAcceptance);
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult({
    artifact: schemaAcceptance,
    expectedSourceCommit: sourceCommit,
    expectedPreflightSha256: fileSha256(resolvedPreflight),
  });
  const corpus = buildAdaptiveWarrantSemanticSmokeCorpus(sourceCommit);
  const corpusPath = path.join(resolvedOutput, 'synthetic-smoke-corpus.json');
  const handbookPath = path.join(resolvedOutput, 'synthetic-smoke-handbook.md');
  writeJson(corpusPath, corpus);
  fs.writeFileSync(
    handbookPath,
    `# Synthetic semantic-contract smoke

Use one event for each independent clause-level act that changes a distinct typed state. The compound licence is general, not a whitelist. Explanatory wording is not a second event. Separate events require distinct, non-overlapping minimal literal spans.

The current-turn speaker is mechanically learner and must not be returned. Executor means the party who must perform the action, never the speaker. Every request-type act requires executor different from speaker. A tutor-directed result request, tutor-selection request, and record-entry request therefore use executor=tutor when addressed to the tutor; a learner proposal uses executor=learner.

Every reader field is required and non-null. Each target is a tagged object. Use state="catalog" with target_id, requested_value_types, and component_ids for a catalogue target; use the sole field state="none" when the act itself names no catalogue entity. The harness derives kind and public identifiers from target_id. Tutor-selection requests require the catalogue target that names the publicly enumerated choices. An analytic contribution's target is the catalogue entity the analysis itself is about, independent of an accompanying request; use target state="none" only when the analytic clause names no catalogue entity. Co-occurring requests keep their own targets. Value/component sets are non-empty only for request-mode acts and only for category surfaces literally present in that event span; proposal and analytic events use empty sets. Each requested_or_proposed_action is also tagged: use state="catalog" with executor and action_object_id for an action, or the sole field state="none" when no action applies. The harness derives mode and operation from action_object_id. Never return null or omit a field.

A record-entry request may coexist with an independent analytic clause. A clause asking the tutor to choose is tutor_selection_request. Only a separate declarative clause that says the learner cannot, refuses to, or leaves the choice to the tutor is low_agency_deferral, with target and action both state="none"; when both meanings occur in one clause, tutor_selection_request wins. A proposal followed by a request for its result is two events in surface order.

For a request where the tutor is the only other party, executor is tutor; joint requires explicit we/our/let's, and unspecified requires an explicit impersonal or passive construction. Set ambiguity_reason="none" whenever genuinely_ambiguous=false; otherwise return no events and one typed reason.

Use exact canonical IDs from the catalogue and literal evidence text without offsets. These cases are permanently excluded from research evidence.
`,
  );
  const prepared = prepareAdaptiveWarrantSemanticAnnotationBatches({
    corpusPath,
    handbookPath,
    outputDir: path.join(resolvedOutput, 'collection'),
    corpusRole: 'targeted_challenge',
    batchSize: 3,
    maximumCalls: 2,
    preflightPath: resolvedPreflight,
    schemaAcceptancePath: resolvedSchemaAcceptance,
  });
  if (
    prepared.authorizationRequest.call_budget.planned_calls !== 2 ||
    prepared.authorizationRequest.call_budget.maximum_calls !== 2 ||
    prepared.manifest.source_commit !== sourceCommit ||
    prepared.authorizationRequest.bindings.source_commit !== sourceCommit
  ) {
    throw new Error('semantic schema smoke must prepare exactly two calls bound to the clean source commit');
  }
  const freeze = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_SMOKE_FREEZE_SCHEMA,
    status: 'frozen',
    purpose: 'instrument_validation_only',
    synthetic_smoke_only: true,
    permanently_excluded_from_research: true,
    study_id: corpus.study_id,
    source_commit: sourceCommit,
    corpus: { path: corpusPath, sha256: fileSha256(corpusPath), cases: corpus.cases.length },
    handbook: { path: handbookPath, sha256: fileSha256(handbookPath) },
    brittleness_preflight: {
      path: resolvedPreflight,
      sha256: fileSha256(resolvedPreflight),
      status: preflight.status,
      source_commit: sourceCommit,
    },
    schema_acceptance_ping: {
      path: resolvedSchemaAcceptance,
      sha256: fileSha256(resolvedSchemaAcceptance),
      status: schemaAcceptance.status,
      source_commit: sourceCommit,
      preflight_sha256: fileSha256(resolvedPreflight),
    },
    collection_manifest: {
      path: prepared.manifestPath,
      sha256: fileSha256(prepared.manifestPath),
    },
    authorization_request: {
      path: prepared.authorizationRequestPath,
      sha256: fileSha256(prepared.authorizationRequestPath),
      approval_digest: prepared.authorizationRequest.approval_digest,
    },
  };
  const freezePath = path.join(resolvedOutput, 'synthetic-smoke-freeze.json');
  writeJson(freezePath, freeze);
  return { freeze, freezePath, prepared };
}

export async function runAdaptiveWarrantSemanticSchemaSmoke({
  freezePath,
  outputDir,
  approvedBy,
  effort = 'medium',
  callModel,
} = {}) {
  const sourceCommit = cleanSource();
  const freeze = readJson(path.resolve(freezePath));
  if (
    freeze.schema !== ADAPTIVE_WARRANT_SEMANTIC_SMOKE_FREEZE_SCHEMA ||
    freeze.source_commit !== sourceCommit ||
    freeze.synthetic_smoke_only !== true ||
    freeze.permanently_excluded_from_research !== true
  ) {
    throw new Error('semantic schema smoke freeze mismatch');
  }
  for (const binding of [
    freeze.corpus,
    freeze.handbook,
    freeze.brittleness_preflight,
    freeze.schema_acceptance_ping,
    freeze.collection_manifest,
    freeze.authorization_request,
  ]) {
    if (!binding?.path || fileSha256(binding.path) !== binding.sha256) {
      throw new Error('semantic schema smoke artifact drift');
    }
  }
  validateAdaptiveWarrantSemanticPreflightArtifact({
    artifact: readJson(freeze.brittleness_preflight.path),
    expectedSourceCommit: sourceCommit,
  });
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult({
    artifact: readJson(freeze.schema_acceptance_ping.path),
    expectedSourceCommit: sourceCommit,
    expectedPreflightSha256: freeze.brittleness_preflight.sha256,
  });
  const resolvedOutput = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length) {
    throw new Error(`semantic schema smoke run output is not empty: ${resolvedOutput}`);
  }
  fs.mkdirSync(resolvedOutput, { recursive: true });
  const modelRunDir = path.join(resolvedOutput, 'model-run');
  const run = await runAdaptiveWarrantSemanticReaders({
    manifestPath: freeze.collection_manifest.path,
    freezeManifestPath: path.resolve(freezePath),
    authorizationRequestPath: freeze.authorization_request.path,
    outputDir: modelRunDir,
    approvedBy,
    effort,
    ...(callModel ? { callModel } : {}),
  });
  const manifest = readJson(freeze.collection_manifest.path);
  const assemblies = [];
  for (const reader of manifest.readers) {
    const assembled = assembleAdaptiveWarrantSemanticAnnotationResponse({
      manifestPath: freeze.collection_manifest.path,
      readerId: reader.reader_id,
      annotationRunId: `synthetic-smoke-${reader.reader_id}`,
      responseDir: path.join(modelRunDir, reader.reader_id),
      outputPath: path.join(resolvedOutput, 'assembled', `${reader.reader_id}.json`),
    });
    const audit = readJson(assembled.auditPath);
    assemblies.push({
      reader_id: reader.reader_id,
      response_path: assembled.outputPath,
      response_sha256: fileSha256(assembled.outputPath),
      assembly_audit_path: assembled.auditPath,
      assembly_audit_sha256: fileSha256(assembled.auditPath),
      normalization: audit.normalization,
      canonicalization_operations: [...new Set(audit.canonicalizations.map((row) => row.operation))],
    });
  }
  const corpus = readJson(manifest.corpus.path);
  const readerResponses = assemblies.map((row) => readJson(row.response_path));
  const consensus = buildAdaptiveWarrantSemanticConsensus({
    readerA: readerResponses[0],
    readerB: readerResponses[1],
    corpus,
    corpusSha256: manifest.corpus.sha256,
  });
  const expected = expectedSmokeIdentities();
  const disagreementClassification = classifyAdaptiveWarrantSemanticDisagreements({
    consensus,
    expectedEventsBySampleId: expected,
  });
  const expectedMatches = Object.fromEntries(
    consensus.cases.map((row) => [
      row.sample_id,
      row.hard_consensus &&
        JSON.stringify(row.events.map(adaptiveWarrantSemanticConsensusIdentity)) ===
          JSON.stringify(expected[row.sample_id]),
    ]),
  );
  const checks = {
    exactly_two_calls: run.run.calls_attempted === 2 && run.run.calls_completed === 2,
    no_prohibited_tool_events: run.run.batches.every((batch) => batch.prohibited_tool_event_count === 0),
    no_schema_repair: run.run.batches.every((batch) => batch.status === 'complete'),
    declared_normalization_only: assemblies.every(
      (row) =>
        row.normalization === 'schema_declared_punctuation_normalized_literal_span_and_event_order_derivation' &&
        row.canonicalization_operations.every((operation) =>
          ['derive_punctuation_normalized_unique_literal_utf16_offsets', 'order_events_by_literal_span'].includes(
            operation,
          ),
        ),
    ),
    all_responses_structurally_assembled: assemblies.length === 2,
    disagreement_classification_complete:
      disagreementClassification.counts.total_cases === corpus.cases.length &&
      disagreementClassification.cases.every((row) => row.status !== 'unresolved_missing_preregistered_identity'),
    no_both_defensible_contract_ambiguity:
      disagreementClassification.counts.contract_ambiguity_cases === 0,
  };
  const passed = Object.values(checks).every(Boolean);
  const result = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_SMOKE_RESULT_SCHEMA,
    status: passed ? 'passed' : 'failed',
    inferential_role: 'instrument_validation_only_not_research_evidence',
    synthetic_cases_permanently_excluded: true,
    source_commit: sourceCommit,
    preflight_sha256: freeze.brittleness_preflight.sha256,
    calls: { attempted: run.run.calls_attempted, completed: run.run.calls_completed, maximum: 2 },
    checks,
    model_run: { path: run.runPath, sha256: fileSha256(run.runPath) },
    consensus: {
      schema: consensus.schema,
      hard_consensus_cases: consensus.hard_consensus_cases,
      total_cases: consensus.cases.length,
      raw_structure_agreement: consensus.raw_structure_agreement,
      expected_identity_matches: expectedMatches,
    },
    disagreement_classification: disagreementClassification,
    assemblies,
  };
  const resultPath = path.join(resolvedOutput, 'semantic-schema-smoke-result.json');
  writeJson(resultPath, result);
  if (!passed) throw new Error('semantic schema smoke failed');
  return { result, resultPath };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const { values } = parseArgs({
    args,
    options: {
      out: { type: 'string' },
      preflight: { type: 'string' },
      'schema-acceptance': { type: 'string' },
      freeze: { type: 'string' },
      'approved-by': { type: 'string' },
      effort: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  const usage =
    'Usage:\n  node scripts/run-adaptive-warrant-semantic-schema-smoke.js prepare --out <empty-dir> --preflight <passing-artifact> --schema-acceptance <passing-result>\n  node scripts/run-adaptive-warrant-semantic-schema-smoke.js run --freeze <freeze.json> --out <empty-dir> --approved-by <standing-authorization> [--effort medium]\n';
  if (values.help || !command) {
    process.stdout.write(usage);
    return;
  }
  if (command === 'prepare') {
    const result = prepareAdaptiveWarrantSemanticSchemaSmoke({
      outputDir: values.out,
      preflightPath: values.preflight,
      schemaAcceptancePath: values['schema-acceptance'],
    });
    process.stdout.write(`${result.freezePath}\n${result.prepared.authorizationRequestPath}\n`);
    return;
  }
  if (command === 'run') {
    const result = await runAdaptiveWarrantSemanticSchemaSmoke({
      freezePath: values.freeze,
      outputDir: values.out,
      approvedBy: values['approved-by'],
      effort: values.effort || 'medium',
    });
    process.stdout.write(`${result.resultPath}\n`);
    return;
  }
  throw new Error(`unknown command ${command}\n${usage}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    await main();
  } catch (error) {
    console.error(`[semantic-schema-smoke] error: ${error.message}`);
    process.exitCode = 1;
  }
}
