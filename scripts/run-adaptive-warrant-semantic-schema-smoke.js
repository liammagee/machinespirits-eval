#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { validateAdaptiveWarrantSemanticPreflightArtifact } from '../services/adaptiveWarrantSemanticPreflight.js';
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
    schema: 'machinespirits.adaptation-refinement.semantic-event-reader-catalog.v2',
    targets: [
      { target_id: 'target-smoke-harbor-log', display_label: 'synthetic harbor log' },
      { target_id: 'target-smoke-bell-record', display_label: 'synthetic bell record' },
    ],
    public_identifiers: [
      { public_identifier_id: 'public-id-smoke-harbor', display_label: 'harbor-seven' },
      { public_identifier_id: 'public-id-smoke-bell', display_label: 'bell H' },
    ],
    components: [
      { component_id: 'clock_time', display_label: 'clock time' },
      { component_id: 'recorded_sound', display_label: 'recorded sound' },
    ],
    action_objects: [
      { action_object_id: 'action-object-smoke-report-log', display_label: 'report the harbor log time' },
      { action_object_id: 'action-object-smoke-inspect-bell', display_label: 'inspect the bell record' },
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
        sample_id: 'synthetic-smoke-result-request',
        current_learner_turn: { turn: 2, learner: 'Please report the harbor-seven log time.' },
        public_evidence_at_decision: [
          'target-smoke-harbor-log is identified by public-id-smoke-harbor.',
        ],
      },
      {
        sample_id: 'synthetic-smoke-proposed-test',
        current_learner_turn: { turn: 2, learner: 'I will inspect the bell H record myself.' },
        public_evidence_at_decision: [
          'target-smoke-bell-record is identified by public-id-smoke-bell.',
        ],
      },
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
    '# Synthetic schema smoke\n\nUse only canonical IDs from the catalogue. Return literal evidence text, not offsets. These cases are permanently excluded from research evidence.\n',
  );
  const prepared = prepareAdaptiveWarrantSemanticAnnotationBatches({
    corpusPath,
    handbookPath,
    outputDir: path.join(resolvedOutput, 'collection'),
    corpusRole: 'targeted_challenge',
    batchSize: 2,
    maximumCalls: 2,
    preflightPath: resolvedPreflight,
  });
  if (
    prepared.authorizationRequest.call_budget.planned_calls !== 2 ||
    prepared.authorizationRequest.call_budget.maximum_calls !== 2
  ) {
    throw new Error('semantic schema smoke must prepare exactly two calls');
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
  for (const binding of [freeze.corpus, freeze.handbook, freeze.brittleness_preflight, freeze.collection_manifest, freeze.authorization_request]) {
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
