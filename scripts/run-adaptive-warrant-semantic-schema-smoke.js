#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { validateAdaptiveWarrantSemanticPreflightArtifact } from '../services/adaptiveWarrantSemanticPreflight.js';
import {
  adaptiveWarrantSemanticConsensusIdentity,
  buildAdaptiveWarrantSemanticConsensus,
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
        target_id: 'target-smoke-east-cloister-register',
        kind: 'record_entry',
        public_identifier_ids: ['public-id-smoke-east-cloister'],
        allowed_value_types: ['record_text'],
        component_ids: ['bounded_finding'],
        display_label: 'synthetic east-cloister register',
      },
      {
        target_id: 'target-smoke-silver-key-cast-m',
        kind: 'mark_or_tool_result',
        public_identifier_ids: ['public-id-smoke-silver-key', 'public-id-smoke-cast-m'],
        allowed_value_types: ['match_status'],
        component_ids: ['match_status'],
        display_label: 'synthetic silver-key comparison',
      },
      {
        target_id: 'target-smoke-river-chart-choice',
        kind: 'public_exhibit_result',
        public_identifier_ids: ['public-id-smoke-river-charts'],
        allowed_value_types: ['other'],
        component_ids: ['next_check'],
        display_label: 'synthetic river-chart choice set',
      },
    ],
    public_identifiers: [
      { public_identifier_id: 'public-id-smoke-east-cloister', display_label: 'east-cloister register' },
      { public_identifier_id: 'public-id-smoke-silver-key', display_label: 'silver key' },
      { public_identifier_id: 'public-id-smoke-cast-m', display_label: 'cast M' },
      { public_identifier_id: 'public-id-smoke-river-charts', display_label: 'river charts' },
    ],
    components: [
      { component_id: 'bounded_finding', display_label: 'bounded finding' },
      { component_id: 'match_status', display_label: 'match status' },
      { component_id: 'next_check', display_label: 'next check' },
    ],
    action_objects: [
      {
        action_object_id: 'action-object-smoke-enter-east-cloister-finding',
        mode: 'requested',
        action: 'record_public_claim',
        target_id: 'target-smoke-east-cloister-register',
        display_label: 'enter the bounded east-cloister finding',
      },
      {
        action_object_id: 'action-object-smoke-select-river-chart',
        mode: 'requested',
        action: 'select_next_step',
        target_id: 'target-smoke-river-chart-choice',
        display_label: 'select the first river chart',
      },
      {
        action_object_id: 'action-object-smoke-compare-silver-key',
        mode: 'proposed',
        action: 'perform_public_test',
        target_id: 'target-smoke-silver-key-cast-m',
        display_label: 'compare the silver key with cast M',
      },
      {
        action_object_id: 'action-object-smoke-report-silver-key-fit',
        mode: 'requested',
        action: 'supply_public_result',
        target_id: 'target-smoke-silver-key-cast-m',
        display_label: 'report the silver-key fit status',
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
        sample_id: 'synthetic-smoke-east-cloister-record',
        current_learner_turn: {
          turn: 2,
          learner:
            'The east-cloister register establishes arrival, not possession; enter only that bounded conclusion in the inquiry ledger.',
        },
        public_evidence_at_decision: [
          'target-smoke-east-cloister-register is identified by public-id-smoke-east-cloister.',
        ],
      },
      {
        sample_id: 'synthetic-smoke-river-chart-selection',
        current_learner_turn: {
          turn: 2,
          learner: 'Pick which river chart I should inspect first; I decline to choose between the listed charts.',
        },
        public_evidence_at_decision: ['public-id-smoke-river-charts names the available river charts.'],
      },
      {
        sample_id: 'synthetic-smoke-silver-key-compound',
        current_learner_turn: {
          turn: 2,
          learner: 'I will compare the silver key with cast M; when that is done, give me the recorded fit status.',
        },
        public_evidence_at_decision: [
          'target-smoke-silver-key-cast-m is identified by public-id-smoke-silver-key and public-id-smoke-cast-m.',
        ],
      },
    ],
  };
}

function expectedSmokeIdentities() {
  const eastCloister = {
    kind: 'record_entry',
    target_id: 'target-smoke-east-cloister-register',
    public_identifier_ids: ['public-id-smoke-east-cloister'],
    requested_value_types: ['record_text'],
    component_ids: ['bounded_finding'],
  };
  const silverKey = {
    kind: 'mark_or_tool_result',
    target_id: 'target-smoke-silver-key-cast-m',
    public_identifier_ids: ['public-id-smoke-silver-key', 'public-id-smoke-cast-m'],
    requested_value_types: ['match_status'],
    component_ids: ['match_status'],
  };
  const riverChoice = {
    kind: 'public_exhibit_result',
    target_id: 'target-smoke-river-chart-choice',
    public_identifier_ids: ['public-id-smoke-river-charts'],
    requested_value_types: ['other'],
    component_ids: ['next_check'],
  };
  const event = (speechAct, target, mode, executor, action, actionObjectId) => ({
    speaker: 'learner',
    speech_act: speechAct,
    target,
    requested_or_proposed_action:
      actionObjectId === null ? null : { mode, executor, action, action_object_id: actionObjectId },
  });
  return {
    'synthetic-smoke-east-cloister-record': [
      event('analytic_contribution', eastCloister, null, null, null, null),
      event(
        'learner_record_entry_request',
        eastCloister,
        'requested',
        'tutor',
        'record_public_claim',
        'action-object-smoke-enter-east-cloister-finding',
      ),
    ],
    'synthetic-smoke-river-chart-selection': [
      event(
        'tutor_selection_request',
        riverChoice,
        'requested',
        'tutor',
        'select_next_step',
        'action-object-smoke-select-river-chart',
      ),
      event('low_agency_deferral', null, null, null, null, null),
    ],
    'synthetic-smoke-silver-key-compound': [
      event(
        'learner_proposed_test',
        silverKey,
        'proposed',
        'learner',
        'perform_public_test',
        'action-object-smoke-compare-silver-key',
      ),
      event(
        'tutor_directed_public_result_request',
        silverKey,
        'requested',
        'tutor',
        'supply_public_result',
        'action-object-smoke-report-silver-key-fit',
      ),
    ],
  };
}

export function prepareAdaptiveWarrantSemanticSchemaSmoke({ outputDir, preflightPath } = {}) {
  const sourceCommit = cleanSource();
  const resolvedOutput = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length) {
    throw new Error(`semantic schema smoke output is not empty: ${resolvedOutput}`);
  }
  fs.mkdirSync(resolvedOutput, { recursive: true });
  const resolvedPreflight = path.resolve(preflightPath);
  const preflight = readJson(resolvedPreflight);
  validateAdaptiveWarrantSemanticPreflightArtifact({ artifact: preflight, expectedSourceCommit: sourceCommit });
  const corpus = buildAdaptiveWarrantSemanticSmokeCorpus(sourceCommit);
  const corpusPath = path.join(resolvedOutput, 'synthetic-smoke-corpus.json');
  const handbookPath = path.join(resolvedOutput, 'synthetic-smoke-handbook.md');
  writeJson(corpusPath, corpus);
  fs.writeFileSync(
    handbookPath,
    `# Synthetic semantic-contract smoke

Use one event for each independent clause-level act that changes a distinct typed state. Explanatory wording is not a second event. Separate events require distinct, non-overlapping minimal literal spans.

The current-turn speaker is mechanically learner and must not be returned. Executor means the party who must perform the action, never the speaker. Every request-type act requires executor different from speaker. A tutor-directed result request, tutor-selection request, and record-entry request therefore use executor=tutor when addressed to the tutor; a learner proposal uses executor=learner.

Every reader field is required and non-null. Return only target_id, requested_value_types, and component_ids for a catalogue target; use the exact string target="none" when the act itself names no catalogue entity. The harness derives kind and public identifiers from target_id. Tutor-selection requests require the catalogue target that names the publicly enumerated choices. An analytic contribution's target is the catalogue entity the analysis itself is about, independent of an accompanying request; use target="none" only when the analytic clause names no catalogue entity. Co-occurring requests keep their own targets. Return only executor and action_object_id for an action; use the exact string requested_or_proposed_action="none" when no action applies. The harness derives mode and operation from action_object_id. A requested value such as match_status is not a target kind. Never return null or omit a field.

A record-entry request may coexist with an independent analytic clause. A tutor-selection request carries a second low_agency_deferral event only when a separate clause explicitly declines choice. A proposal followed by a request for its result is two events in surface order.

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
        row.normalization === 'schema_declared_literal_span_and_event_order_derivation' &&
        row.canonicalization_operations.every((operation) =>
          ['derive_unique_literal_utf16_offsets', 'order_events_by_literal_span'].includes(operation),
        ),
    ),
    cross_reader_hard_consensus: consensus.hard_consensus_cases === corpus.cases.length,
    record_entry_contract_agreement: expectedMatches['synthetic-smoke-east-cloister-record'] === true,
    tutor_selection_contract_agreement: expectedMatches['synthetic-smoke-river-chart-selection'] === true,
    compound_probe_contract_agreement: expectedMatches['synthetic-smoke-silver-key-compound'] === true,
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
      freeze: { type: 'string' },
      'approved-by': { type: 'string' },
      effort: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  const usage =
    'Usage:\n  node scripts/run-adaptive-warrant-semantic-schema-smoke.js prepare --out <empty-dir> --preflight <passing-artifact>\n  node scripts/run-adaptive-warrant-semantic-schema-smoke.js run --freeze <freeze.json> --out <empty-dir> --approved-by <standing-authorization> [--effort medium]\n';
  if (values.help || !command) {
    process.stdout.write(usage);
    return;
  }
  if (command === 'prepare') {
    const result = prepareAdaptiveWarrantSemanticSchemaSmoke({
      outputDir: values.out,
      preflightPath: values.preflight,
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
