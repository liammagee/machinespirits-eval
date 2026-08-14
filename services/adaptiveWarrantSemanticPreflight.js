import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { ADAPTIVE_WARRANT_SEMANTIC_GATE } from './adaptiveWarrantSemanticAnnotation.js';
import {
  ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA,
  ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS,
} from './adaptiveWarrantSemanticEvents.js';

export const ADAPTIVE_WARRANT_SEMANTIC_PREFLIGHT_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-brittleness-preflight.v1';
export const ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_RESULT_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-schema-acceptance-result.v1';
export const ADAPTIVE_WARRANT_LIVE_SEMANTIC_SEAT_PING_SCHEMA =
  'machinespirits.adaptation-refinement.live-semantic-seat-acceptance-ping.v1';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FINGERPRINT_FILES = Object.freeze({
  extraction: 'services/adaptiveWarrantSemanticEvents.js',
  live_extraction_envelope: 'services/tutorStubPublicLearnerAnalysis.js',
  reader_and_scorer: 'services/adaptiveWarrantSemanticAnnotation.js',
  preparation_and_assembly: 'scripts/prepare-adaptive-warrant-semantic-annotations.js',
  decision_preparation_and_assembly: 'scripts/prepare-adaptive-warrant-annotation-batches.js',
  brittleness_preflight: 'scripts/run-adaptive-warrant-semantic-brittleness-preflight.js',
  schema_acceptance_ping: 'scripts/run-adaptive-warrant-semantic-schema-acceptance-ping.js',
  schema_smoke: 'scripts/run-adaptive-warrant-semantic-schema-smoke.js',
  semantic_reader_runner: 'scripts/run-adaptive-warrant-semantic-readers.js',
  decision_reader_runner: 'scripts/run-adaptive-warrant-decision-readers.js',
  representative_matrix_runner: 'scripts/run-adaptive-warrant-baseline-study.js',
  semantic_counterfactual_replay: 'scripts/replay-adaptive-warrant-semantic-counterfactual.js',
  live_semantic_seat_probe: 'scripts/probe-adaptive-warrant-live-semantic-seat.js',
  cli_request_path: 'services/tutorStubCliRequest.js',
  corpus_builder: 'scripts/build-adaptive-warrant-v3-semantic-diagnostic.js',
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

export function adaptiveWarrantSemanticValueSha256(value) {
  return sha256(JSON.stringify(canonicalValue(value)));
}

export function adaptiveWarrantSemanticInstrumentBindings({ sourceCommit } = {}) {
  const files = Object.fromEntries(
    Object.entries(FINGERPRINT_FILES).map(([name, relativePath]) => {
      const absolutePath = path.join(ROOT, relativePath);
      return [name, { path: relativePath, sha256: sha256(fs.readFileSync(absolutePath)) }];
    }),
  );
  const thresholdConfiguration = canonicalValue(ADAPTIVE_WARRANT_SEMANTIC_GATE);
  return {
    source_commit: sourceCommit,
    extraction_schema: {
      id: ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA,
      digest: adaptiveWarrantSemanticValueSha256({
        schema: ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA,
        limits: ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS,
        source: files.extraction.sha256,
      }),
    },
    reader_schema_digest: adaptiveWarrantSemanticValueSha256({
      schema_family: 'machinespirits.adaptation-refinement.semantic-event-reader.v3',
      reader_and_scorer: files.reader_and_scorer.sha256,
      preparation_and_assembly: files.preparation_and_assembly.sha256,
      schema_acceptance_ping: files.schema_acceptance_ping.sha256,
    }),
    consensus_scorer_fingerprint: adaptiveWarrantSemanticValueSha256({
      reader_and_scorer: files.reader_and_scorer.sha256,
      preparation_and_assembly: files.preparation_and_assembly.sha256,
    }),
    threshold_configuration: thresholdConfiguration,
    threshold_configuration_digest: adaptiveWarrantSemanticValueSha256(thresholdConfiguration),
    corpus_builder_fingerprint: files.corpus_builder.sha256,
    source_files: files,
  };
}

export function validateAdaptiveWarrantSemanticSchemaAcceptanceResult({
  artifact,
  expectedSourceCommit,
  expectedPreflightSha256,
} = {}) {
  const recognizedSchema =
    artifact?.schema === ADAPTIVE_WARRANT_SEMANTIC_SCHEMA_ACCEPTANCE_RESULT_SCHEMA ||
    artifact?.schema === ADAPTIVE_WARRANT_LIVE_SEMANTIC_SEAT_PING_SCHEMA;
  if (!recognizedSchema) {
    throw new Error('semantic schema-acceptance result schema mismatch');
  }
  const upgradedSeatPing = artifact.schema === ADAPTIVE_WARRANT_LIVE_SEMANTIC_SEAT_PING_SCHEMA;
  if (
    artifact.status !== 'passed' ||
    artifact.inferential_role !== 'transport_only_permanently_excluded' ||
    artifact.synthetic_case_permanently_excluded !== true ||
    artifact.source_commit !== expectedSourceCommit ||
    artifact.response_received !== true ||
    artifact.calls?.attempted !== 1 ||
    artifact.calls?.completed !== 1 ||
    artifact.calls?.maximum !== 1 ||
    artifact.prohibited_tool_event_count !== 0 ||
    artifact.preflight?.sha256 !== expectedPreflightSha256 ||
    (upgradedSeatPing &&
      (artifact.model !== 'claude-code.claude-sonnet-5' ||
        artifact.destination?.provider !== 'claude-code' ||
        artifact.structured_output !== true))
  ) {
    throw new Error('semantic schema-acceptance ping did not pass or is stale');
  }
  return { ok: true };
}

export function validateAdaptiveWarrantSemanticPreflightArtifact({ artifact, expectedSourceCommit } = {}) {
  if (!artifact || artifact.schema !== ADAPTIVE_WARRANT_SEMANTIC_PREFLIGHT_SCHEMA) {
    throw new Error('semantic brittleness preflight schema mismatch');
  }
  if (artifact.status !== 'passed' || artifact.verdict !== 'instrument_ready') {
    throw new Error('semantic brittleness preflight did not pass');
  }
  if (!Array.isArray(artifact.checks) || artifact.checks.some((check) => check.status !== 'pass')) {
    throw new Error('semantic brittleness preflight has a failed or missing check');
  }
  const expected = adaptiveWarrantSemanticInstrumentBindings({
    sourceCommit: expectedSourceCommit,
  });
  if (adaptiveWarrantSemanticValueSha256(artifact.bindings) !== adaptiveWarrantSemanticValueSha256(expected)) {
    throw new Error('semantic brittleness preflight is stale or fingerprint-mismatched');
  }
  return { ok: true, bindings: expected };
}
