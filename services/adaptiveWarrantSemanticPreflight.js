import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ADAPTIVE_WARRANT_SEMANTIC_GATE,
} from './adaptiveWarrantSemanticAnnotation.js';
import {
  ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA,
  ADAPTIVE_WARRANT_SEMANTIC_EVENT_LIMITS,
} from './adaptiveWarrantSemanticEvents.js';

export const ADAPTIVE_WARRANT_SEMANTIC_PREFLIGHT_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-brittleness-preflight.v1';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FINGERPRINT_FILES = Object.freeze({
  extraction: 'services/adaptiveWarrantSemanticEvents.js',
  reader_and_scorer: 'services/adaptiveWarrantSemanticAnnotation.js',
  preparation_and_assembly: 'scripts/prepare-adaptive-warrant-semantic-annotations.js',
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
      schema_family: 'machinespirits.adaptation-refinement.semantic-event-reader.v2',
      reader_and_scorer: files.reader_and_scorer.sha256,
      preparation_and_assembly: files.preparation_and_assembly.sha256,
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

export function validateAdaptiveWarrantSemanticPreflightArtifact({
  artifact,
  expectedSourceCommit,
} = {}) {
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
