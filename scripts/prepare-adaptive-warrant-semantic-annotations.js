#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual, parseArgs } from 'node:util';

import {
  ADAPTIVE_WARRANT_SEMANTIC_ANNOTATION_RESPONSE_SCHEMA,
  ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA,
  buildAdaptiveWarrantSemanticBatchOutputSchema,
  buildAdaptiveWarrantSemanticConsensus,
  classifyAdaptiveWarrantSemanticDisagreements,
  materializeAdaptiveWarrantSemanticReaderEvent,
  scoreAdaptiveWarrantSemanticExtraction,
  summarizeAdaptiveWarrantSemanticDiagnosticSupport,
  validateAdaptiveWarrantSemanticAnnotationResponse,
  validateAdaptiveWarrantSemanticReaderCatalog,
} from '../services/adaptiveWarrantSemanticAnnotation.js';
import {
  validateAdaptiveWarrantSemanticPreflightArtifact,
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult,
} from '../services/adaptiveWarrantSemanticPreflight.js';

export const ADAPTIVE_WARRANT_SEMANTIC_COLLECTION_MANIFEST_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-annotation-collection.v6';
export const ADAPTIVE_WARRANT_SEMANTIC_READER_PACKET_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-reader-packet.v6';
export const ADAPTIVE_WARRANT_SEMANTIC_AUTHORIZATION_REQUEST_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-annotation-authorization-request.v6';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const BATCH_FIELDS = Object.freeze([
  'schema',
  'reader_id',
  'batch_id',
  'study_id',
  'corpus_sha256',
  'cases_by_sample_id',
]);
const CASE_FIELDS = Object.freeze(['genuinely_ambiguous', 'ambiguity_reason', 'events', 'note']);
const EVENT_FIELDS = Object.freeze(['speech_act', 'target', 'requested_or_proposed_action', 'evidence_span']);
const MAXIMUM_READER_PACKET_BYTES = 42000;
const MAXIMUM_READER_RESPONSE_BYTES = 10500;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeCompactJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function valueSha256(value) {
  return sha256(JSON.stringify(value));
}

function exactFields(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} fields must be exactly ${[...expected].sort().join(', ')}`);
  }
}

function exactIds(value, label) {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new Error(`${label} must be non-empty string ids`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicate ids`);
  return value;
}

function assertEmptyDirectory(outputDir) {
  if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).length) {
    throw new Error(`semantic annotation output directory is not empty: ${outputDir}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
}

function responseCaseTemplate() {
  return {
    genuinely_ambiguous: false,
    ambiguity_reason: 'none',
    events: [],
    note: 'REPLACE with case-specific public rationale.',
  };
}

function publicSemanticCase(row) {
  return {
    sample_id: row.sample_id,
    public_inquiry_brief: row.public_inquiry_brief || null,
    transcript_before_decision: row.transcript_before_decision || [],
    current_learner_turn: row.current_learner_turn,
    public_evidence_at_decision:
      row.public_evidence_at_decision || row.public_staged_evidence || row.public_inquiry_brief?.opening_evidence || [],
  };
}

export function prepareAdaptiveWarrantSemanticAnnotationBatches({
  corpusPath,
  handbookPath,
  outputDir,
  corpusRole,
  readerIds = ['semantic-reader-a', 'semantic-reader-b'],
  batchSize = 8,
  annotationModel = 'codex.gpt-5.6-luna',
  annotationDestination = 'OpenAI Codex CLI (ChatGPT-account route)',
  maximumCalls = null,
  preflightPath = null,
  schemaAcceptancePath = null,
  preflightMode = false,
} = {}) {
  if (!['targeted_challenge', 'natural_prevalence'].includes(corpusRole)) {
    throw new Error('semantic annotation corpus role must be targeted_challenge or natural_prevalence');
  }
  exactIds(readerIds, 'reader ids');
  if (readerIds.length !== 2) throw new Error('semantic annotation requires exactly two readers');
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('batch size must be a positive integer');
  const resolvedCorpus = path.resolve(corpusPath);
  const resolvedHandbook = path.resolve(handbookPath);
  const resolvedOutput = path.resolve(outputDir);
  const corpus = readJson(resolvedCorpus);
  if (corpus.blinded !== true || !corpus.study_id || !Array.isArray(corpus.cases)) {
    throw new Error('semantic annotation requires a frozen blinded corpus');
  }
  const semanticCatalog = corpus.semantic_annotation_catalog;
  validateAdaptiveWarrantSemanticReaderCatalog(semanticCatalog);
  let preflightBinding = null;
  let schemaAcceptanceBinding = null;
  let sourceCommit = null;
  if (preflightMode) {
    if (!String(corpus.study_id).startsWith('semantic-brittleness-preflight-')) {
      throw new Error('semantic preflight bypass is restricted to the synthetic brittleness instrument');
    }
  } else {
    if (!preflightPath) throw new Error('semantic annotation preparation requires a passing preflight artifact');
    const gitStatus = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (gitStatus) throw new Error('semantic annotation preparation requires a clean committed worktree');
    sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const resolvedPreflight = path.resolve(preflightPath);
    const preflight = readJson(resolvedPreflight);
    validateAdaptiveWarrantSemanticPreflightArtifact({ artifact: preflight, expectedSourceCommit: sourceCommit });
    preflightBinding = { path: resolvedPreflight, sha256: fileSha256(resolvedPreflight), source_commit: sourceCommit };
    if (!schemaAcceptancePath) {
      throw new Error('semantic annotation preparation requires a passing schema-acceptance ping');
    }
    const resolvedSchemaAcceptance = path.resolve(schemaAcceptancePath);
    const schemaAcceptance = readJson(resolvedSchemaAcceptance);
    validateAdaptiveWarrantSemanticSchemaAcceptanceResult({
      artifact: schemaAcceptance,
      expectedSourceCommit: sourceCommit,
      expectedPreflightSha256: preflightBinding.sha256,
    });
    schemaAcceptanceBinding = {
      path: resolvedSchemaAcceptance,
      sha256: fileSha256(resolvedSchemaAcceptance),
      source_commit: sourceCommit,
      preflight_sha256: preflightBinding.sha256,
    };
  }
  const sampleIds = exactIds(
    corpus.cases.map((row) => row.sample_id),
    'semantic corpus',
  );
  const corpusSha256 = fileSha256(resolvedCorpus);
  const handbookSha256 = fileSha256(resolvedHandbook);
  const handbookMarkdown = fs.readFileSync(resolvedHandbook, 'utf8');
  const byId = new Map(corpus.cases.map((row) => [row.sample_id, row]));
  assertEmptyDirectory(resolvedOutput);
  const readers = readerIds.map((readerId) => {
    const batches = [];
    for (let offset = 0; offset < sampleIds.length; offset += batchSize) {
      const requiredSampleIds = sampleIds.slice(offset, offset + batchSize);
      const batchId = `${readerId}-batch-${String(batches.length + 1).padStart(2, '0')}`;
      const outputSchema = buildAdaptiveWarrantSemanticBatchOutputSchema({
        readerId,
        batchId,
        studyId: corpus.study_id,
        corpusSha256,
        requiredSampleIds,
        semanticCatalog,
      });
      const packet = {
        schema: ADAPTIVE_WARRANT_SEMANTIC_READER_PACKET_SCHEMA,
        task: 'independent_semantic_event_extraction',
        reader_id: readerId,
        batch_id: batchId,
        study_id: corpus.study_id,
        corpus_sha256: corpusSha256,
        handbook_sha256: handbookSha256,
        corpus_role: corpusRole,
        instructions: [
          'Apply the complete bound handbook independently to only the supplied public decision-time evidence; hidden answers, support tags, predictions, traces, and the other reader are unavailable.',
          'Return every required sample id exactly once, follow the act-discriminated total schema exactly, use only catalogue IDs, and never return null or a speaker field.',
          'Return each evidence_span as one unique non-empty literal current-turn substring. The harness derives offsets, ordering, target metadata, action mode, and operation mechanically.',
          'Every case requires a case-specific public rationale of at least eight characters. The handbook is authoritative for all judgment and typed ambiguity rules.',
        ],
        handbook_markdown: handbookMarkdown,
        semantic_annotation_catalog: semanticCatalog,
        required_sample_ids: requiredSampleIds,
        cases_by_sample_id: Object.fromEntries(requiredSampleIds.map((id) => [id, publicSemanticCase(byId.get(id))])),
        response_template: {
          schema: ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA,
          reader_id: readerId,
          batch_id: batchId,
          study_id: corpus.study_id,
          corpus_sha256: corpusSha256,
          cases_by_sample_id: Object.fromEntries(requiredSampleIds.map((id) => [id, responseCaseTemplate()])),
        },
        response_json_schema: outputSchema,
      };
      const packetPath = path.join(resolvedOutput, 'packets', readerId, `${batchId}.packet.json`);
      const schemaPath = path.join(resolvedOutput, 'packets', readerId, `${batchId}.response.schema.json`);
      writeCompactJson(packetPath, packet);
      writeCompactJson(schemaPath, outputSchema);
      const packetBytes = fs.statSync(packetPath).size;
      const responseSchemaBytes = fs.statSync(schemaPath).size;
      if (!isDeepStrictEqual(packet.response_json_schema, readJson(schemaPath))) {
        throw new Error(`${batchId} packet and response-schema file differ`);
      }
      if (packetBytes > MAXIMUM_READER_PACKET_BYTES) {
        throw new Error(`${batchId} exceeds the ${MAXIMUM_READER_PACKET_BYTES}-byte prompt limit`);
      }
      if (responseSchemaBytes > MAXIMUM_READER_RESPONSE_BYTES) {
        throw new Error(`${batchId} response schema exceeds the ${MAXIMUM_READER_RESPONSE_BYTES}-byte limit`);
      }
      batches.push({
        batch_id: batchId,
        required_sample_ids: requiredSampleIds,
        packet_path: packetPath,
        packet_sha256: fileSha256(packetPath),
        response_schema_path: schemaPath,
        response_schema_sha256: fileSha256(schemaPath),
        packet_bytes: packetBytes,
        maximum_packet_bytes: MAXIMUM_READER_PACKET_BYTES,
        response_schema_bytes: responseSchemaBytes,
        maximum_response_bytes: MAXIMUM_READER_RESPONSE_BYTES,
        expected_response_filename: `${batchId}.response.json`,
      });
    }
    return { reader_id: readerId, batches };
  });
  const manifest = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_COLLECTION_MANIFEST_SCHEMA,
    status: 'prepared',
    task: 'semantic_extraction',
    study_id: corpus.study_id,
    source_commit: sourceCommit,
    corpus_role: corpusRole,
    gate_eligible: corpusRole === 'natural_prevalence',
    corpus: { path: resolvedCorpus, sha256: corpusSha256, cases: sampleIds.length },
    handbook: { path: resolvedHandbook, sha256: handbookSha256 },
    batch_size: batchSize,
    size_audit: {
      maximum_packet_bytes: MAXIMUM_READER_PACKET_BYTES,
      largest_packet_bytes: Math.max(...readers.flatMap((reader) => reader.batches.map((batch) => batch.packet_bytes))),
      maximum_response_bytes: MAXIMUM_READER_RESPONSE_BYTES,
    },
    brittleness_preflight: preflightBinding || { mode: 'synthetic_internal_zero_call' },
    schema_acceptance_ping: schemaAcceptanceBinding || { mode: 'synthetic_internal_zero_call' },
    readers,
  };
  const manifestPath = path.join(resolvedOutput, 'semantic-annotation-collection-manifest.json');
  writeJson(manifestPath, manifest);
  const plannedCalls = readers.reduce((sum, reader) => sum + reader.batches.length, 0);
  const callCeiling = maximumCalls === null ? plannedCalls : Number(maximumCalls);
  if (!Number.isInteger(callCeiling) || callCeiling < plannedCalls) {
    throw new Error(`maximum calls must be at least the ${plannedCalls} planned calls`);
  }
  const authorizationContract = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_AUTHORIZATION_REQUEST_SCHEMA,
    status: 'approval_required',
    study_id: corpus.study_id,
    task: 'two_independent_semantic_extraction_readers',
    corpus_role: corpusRole,
    inferential_role:
      corpusRole === 'targeted_challenge'
        ? 'diagnostic_only_gate_ineligible'
        : 'predeclared_representative_extraction_gate',
    destination: annotationDestination,
    model: annotationModel,
    payload_scope: {
      classification: 'unpublished_private_research_prompt_payload',
      transmitted: [
        'frozen semantic-event handbook embedded in each packet',
        'blinded public decision-time evidence keyed by opaque sample id',
        'exact response schema and independent-reader instructions',
      ],
      excluded: [
        'private key, design support plan, and predictions',
        'validator output, reducer state, warrant decisions, and technical traces',
        'either reader response supplied to the other reader',
        'credentials and human-subject data',
      ],
    },
    call_budget: { planned_calls: plannedCalls, maximum_calls: callCeiling, readers: 2 },
    bindings: {
      source_commit: sourceCommit,
      manifest_sha256: fileSha256(manifestPath),
      corpus_sha256: corpusSha256,
      handbook_sha256: handbookSha256,
      brittleness_preflight: preflightBinding,
      schema_acceptance_ping: schemaAcceptanceBinding,
      packets: readers.flatMap((reader) =>
        reader.batches.map((batch) => ({
          reader_id: reader.reader_id,
          batch_id: batch.batch_id,
          packet_sha256: batch.packet_sha256,
          response_schema_sha256: batch.response_schema_sha256,
        })),
      ),
    },
  };
  const authorizationRequest = { ...authorizationContract, approval_digest: valueSha256(authorizationContract) };
  const authorizationRequestPath = path.join(resolvedOutput, 'semantic-annotation-authorization-request.json');
  writeJson(authorizationRequestPath, authorizationRequest);
  return { manifest, manifestPath, authorizationRequest, authorizationRequestPath };
}

export function assembleAdaptiveWarrantSemanticAnnotationResponse({
  manifestPath,
  readerId,
  annotationRunId,
  responseDir,
  outputPath,
  runPath = null,
} = {}) {
  const resolvedManifest = path.resolve(manifestPath);
  const manifest = readJson(resolvedManifest);
  if (manifest.schema !== ADAPTIVE_WARRANT_SEMANTIC_COLLECTION_MANIFEST_SCHEMA) {
    throw new Error('semantic collection manifest has an unsupported schema');
  }
  if (!annotationRunId?.trim()) throw new Error('annotation run id is required');
  if (fileSha256(manifest.corpus.path) !== manifest.corpus.sha256) throw new Error('semantic corpus drift');
  if (fileSha256(manifest.handbook.path) !== manifest.handbook.sha256) throw new Error('semantic handbook drift');
  const reader = manifest.readers.find((row) => row.reader_id === readerId);
  if (!reader) throw new Error(`unknown semantic reader ${readerId}`);
  const corpus = readJson(manifest.corpus.path);
  const semanticCatalog = corpus.semantic_annotation_catalog;
  validateAdaptiveWarrantSemanticReaderCatalog(semanticCatalog);
  const order = new Map(corpus.cases.map((row, index) => [row.sample_id, index]));
  const corpusById = new Map(corpus.cases.map((row) => [row.sample_id, row]));
  const cases = [];
  const inputs = [];
  const canonicalizations = [];
  const verifiedRun = runPath ? readJson(path.resolve(runPath)) : null;
  if (verifiedRun) {
    if (
      verifiedRun.status !== 'complete' ||
      verifiedRun.study_id !== manifest.study_id ||
      verifiedRun.source_commit !== manifest.source_commit
    ) {
      throw new Error('semantic assembly requires a complete source-bound reader run');
    }
  }
  for (const batch of reader.batches) {
    if (fileSha256(batch.packet_path) !== batch.packet_sha256) throw new Error(`${batch.batch_id} packet drift`);
    if (fileSha256(batch.response_schema_path) !== batch.response_schema_sha256) {
      throw new Error(`${batch.batch_id} response schema drift`);
    }
    const responsePath = path.join(path.resolve(responseDir), batch.expected_response_filename);
    if (verifiedRun) {
      const runBatch = verifiedRun.batches.find((row) => row.reader_id === readerId && row.batch_id === batch.batch_id);
      if (
        runBatch?.status !== 'complete' ||
        runBatch.response_path !== responsePath ||
        runBatch.response_sha256 !== fileSha256(responsePath) ||
        runBatch.model_independently_attested !== true ||
        Number(runBatch.prohibited_tool_event_count || 0) !== 0
      ) {
        throw new Error(`${batch.batch_id} lacks verified model-run evidence`);
      }
    }
    const responseBytes = fs.statSync(responsePath).size;
    if (responseBytes > MAXIMUM_READER_RESPONSE_BYTES) {
      throw new Error(`${batch.batch_id} exceeds the ${MAXIMUM_READER_RESPONSE_BYTES}-byte response limit`);
    }
    const response = readJson(responsePath);
    exactFields(response, BATCH_FIELDS, `${batch.batch_id} response`);
    if (
      response.schema !== ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA ||
      response.reader_id !== readerId ||
      response.batch_id !== batch.batch_id ||
      response.study_id !== manifest.study_id ||
      response.corpus_sha256 !== manifest.corpus.sha256
    ) {
      throw new Error(`${batch.batch_id} response does not bind its packet`);
    }
    const ids = Object.keys(response.cases_by_sample_id || {}).sort();
    if (JSON.stringify(ids) !== JSON.stringify([...batch.required_sample_ids].sort())) {
      throw new Error(`${batch.batch_id} response has incomplete sample ids`);
    }
    for (const sampleId of batch.required_sample_ids) {
      const row = response.cases_by_sample_id[sampleId];
      exactFields(row, CASE_FIELDS, `${batch.batch_id} ${sampleId}`);
      if (typeof row.note !== 'string' || row.note.trim().length < 8) {
        throw new Error(`${batch.batch_id} ${sampleId} requires a case-specific rationale`);
      }
      if (!Array.isArray(row.events) || row.events.length > 4) {
        throw new Error(`${batch.batch_id} ${sampleId} events must be a bounded array`);
      }
      const ambiguityReasons = [
        'none',
        'speech_act',
        'executor',
        'target',
        'action_object',
        'multiplicity',
        'referent',
        'span',
        'context',
      ];
      if (
        !ambiguityReasons.includes(row.ambiguity_reason) ||
        row.genuinely_ambiguous !== (row.ambiguity_reason !== 'none') ||
        (row.genuinely_ambiguous && row.events.length)
      ) {
        throw new Error(`${batch.batch_id} ${sampleId} ambiguity flag, reason, and events disagree`);
      }
      const learnerText = String(corpusById.get(sampleId)?.current_learner_turn?.learner || '');
      let assemblyRejection = null;
      for (const [eventIndex, event] of row.events.entries()) {
        exactFields(event, EVENT_FIELDS, `${batch.batch_id} ${sampleId} event ${eventIndex}`);
        const text = event.evidence_span;
        if (typeof text !== 'string' || !text.length || text.length > 240) {
          throw new Error(`${batch.batch_id} ${sampleId} event ${eventIndex} span text is invalid`);
        }
        const start = learnerText.indexOf(text);
        if (start < 0) throw new Error(`${batch.batch_id} ${sampleId} event ${eventIndex} span is not literal`);
        if (learnerText.lastIndexOf(text) !== start) {
          assemblyRejection = {
            code: 'non_unique_literal_span',
            detail: `event ${eventIndex} span occurs more than once`,
          };
          break;
        }
      }
      if (assemblyRejection) {
        cases.push({ sample_id: sampleId, ...row, assembly_rejection: assemblyRejection, events: [] });
        continue;
      }
      const derivedEvents = row.events.map((event, eventIndex) => {
        exactFields(event, EVENT_FIELDS, `${batch.batch_id} ${sampleId} event ${eventIndex}`);
        const text = event.evidence_span;
        if (typeof text !== 'string' || !text.length || text.length > 240) {
          throw new Error(`${batch.batch_id} ${sampleId} event ${eventIndex} span text is invalid`);
        }
        const start = learnerText.indexOf(text);
        const end = start + text.length;
        canonicalizations.push({
          sample_id: sampleId,
          event_index: eventIndex,
          operation: 'derive_unique_literal_utf16_offsets',
          start,
          end,
        });
        const materialized = materializeAdaptiveWarrantSemanticReaderEvent({
          event: {
            ...event,
            evidence_span: { text, start, end },
          },
          semanticCatalog,
          label: `${batch.batch_id} ${sampleId} event ${eventIndex}`,
        });
        return { ...materialized, source_event_index: eventIndex };
      });
      const events = derivedEvents
        .toSorted(
          (left, right) =>
            left.evidence_span.start - right.evidence_span.start || left.source_event_index - right.source_event_index,
        )
        .map(({ source_event_index: sourceEventIndex, ...event }, orderedIndex) => {
          if (sourceEventIndex !== orderedIndex) {
            canonicalizations.push({
              sample_id: sampleId,
              event_index: sourceEventIndex,
              operation: 'order_events_by_literal_span',
              ordered_index: orderedIndex,
            });
          }
          return event;
        });
      cases.push({ sample_id: sampleId, ...row, assembly_rejection: null, events });
    }
    inputs.push({
      batch_id: batch.batch_id,
      path: responsePath,
      sha256: fileSha256(responsePath),
      response_bytes: responseBytes,
      maximum_response_bytes: MAXIMUM_READER_RESPONSE_BYTES,
    });
  }
  cases.sort((left, right) => order.get(left.sample_id) - order.get(right.sample_id));
  const assembled = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_ANNOTATION_RESPONSE_SCHEMA,
    study_id: manifest.study_id,
    corpus_sha256: manifest.corpus.sha256,
    annotator_id: readerId,
    annotation_run_id: annotationRunId,
    cases,
  };
  const validation = validateAdaptiveWarrantSemanticAnnotationResponse({
    response: assembled,
    corpus,
    corpusSha256: manifest.corpus.sha256,
  });
  const resolvedOutput = path.resolve(outputPath);
  writeJson(resolvedOutput, assembled);
  const auditPath = resolvedOutput.replace(/\.json$/u, '.assembly-audit.json');
  writeJson(auditPath, {
    schema: 'machinespirits.adaptation-refinement.semantic-event-annotation-assembly-audit.v1',
    manifest: { path: resolvedManifest, sha256: fileSha256(resolvedManifest) },
    reader_id: readerId,
    annotation_run_id: annotationRunId,
    normalization: 'schema_declared_literal_span_and_event_order_derivation',
    edit_count: canonicalizations.length,
    canonicalizations,
    input_batches: inputs,
    verified_run: runPath ? { path: path.resolve(runPath), sha256: fileSha256(path.resolve(runPath)) } : null,
    validation,
    output: { path: resolvedOutput, sha256: fileSha256(resolvedOutput) },
  });
  return { outputPath: resolvedOutput, auditPath, response: assembled };
}

export function scoreAdaptiveWarrantSemanticAnnotationFiles({
  manifestPath,
  readerAPath,
  readerBPath,
  predictionsPath,
  outputPath,
} = {}) {
  const manifest = readJson(path.resolve(manifestPath));
  if (fileSha256(manifest.corpus.path) !== manifest.corpus.sha256) throw new Error('semantic score corpus drift');
  const corpus = readJson(manifest.corpus.path);
  const readerA = readJson(path.resolve(readerAPath));
  const readerB = readJson(path.resolve(readerBPath));
  const predictionsArtifact = readJson(path.resolve(predictionsPath));
  const predictionsBySampleId = predictionsArtifact.predictions_by_sample_id || predictionsArtifact;
  const consensus = buildAdaptiveWarrantSemanticConsensus({
    readerA,
    readerB,
    corpus,
    corpusSha256: manifest.corpus.sha256,
  });
  const score = scoreAdaptiveWarrantSemanticExtraction({
    consensus,
    predictionsBySampleId,
    corpusRole: manifest.corpus_role,
  });
  const artifact = {
    ...score,
    study_id: manifest.study_id,
    corpus_sha256: manifest.corpus.sha256,
    inputs: {
      manifest_sha256: fileSha256(path.resolve(manifestPath)),
      reader_a_sha256: fileSha256(path.resolve(readerAPath)),
      reader_b_sha256: fileSha256(path.resolve(readerBPath)),
      predictions_sha256: fileSha256(path.resolve(predictionsPath)),
    },
    consensus,
  };
  const resolvedOutput = path.resolve(outputPath);
  writeJson(resolvedOutput, artifact);
  return { artifact, outputPath: resolvedOutput };
}

export function scoreAdaptiveWarrantSemanticReaderSupportFiles({
  manifestPath,
  readerAPath,
  readerBPath,
  privateKeyPath,
  outputPath,
} = {}) {
  const manifest = readJson(path.resolve(manifestPath));
  if (manifest.corpus_role !== 'targeted_challenge') {
    throw new Error('reader-support scoring is diagnostic-only');
  }
  if (fileSha256(manifest.corpus.path) !== manifest.corpus.sha256) throw new Error('semantic support corpus drift');
  const corpus = readJson(manifest.corpus.path);
  const consensus = buildAdaptiveWarrantSemanticConsensus({
    readerA: readJson(path.resolve(readerAPath)),
    readerB: readJson(path.resolve(readerBPath)),
    corpus,
    corpusSha256: manifest.corpus.sha256,
  });
  const privateKey = readJson(path.resolve(privateKeyPath));
  if (privateKey.study_id !== manifest.study_id || !Array.isArray(privateKey.cases)) {
    throw new Error('semantic support private key does not bind the diagnostic study');
  }
  const expectedEventsBySampleId = Object.fromEntries(
    privateKey.cases.map((row) => [row.sample_id, row.expected_semantic_events]),
  );
  const disagreementClassification = classifyAdaptiveWarrantSemanticDisagreements({
    consensus,
    expectedEventsBySampleId,
  });
  const artifact = {
    ...summarizeAdaptiveWarrantSemanticDiagnosticSupport(consensus),
    study_id: manifest.study_id,
    corpus_sha256: manifest.corpus.sha256,
    reader_agreement: {
      raw_structure_agreement: consensus.raw_structure_agreement,
      hard_consensus_cases: consensus.hard_consensus_cases,
    },
    disagreement_classification: disagreementClassification,
    inputs: {
      manifest_sha256: fileSha256(path.resolve(manifestPath)),
      reader_a_sha256: fileSha256(path.resolve(readerAPath)),
      reader_b_sha256: fileSha256(path.resolve(readerBPath)),
      private_key_sha256: fileSha256(path.resolve(privateKeyPath)),
    },
    consensus,
  };
  const resolvedOutput = path.resolve(outputPath);
  writeJson(resolvedOutput, artifact);
  return { artifact, outputPath: resolvedOutput };
}

function usage() {
  return `Usage:
  node scripts/prepare-adaptive-warrant-semantic-annotations.js prepare --corpus <file> --handbook <file> --preflight <passing-artifact> --schema-acceptance <passing-result> --out <dir> --corpus-role targeted_challenge|natural_prevalence [--batch-size 8] [--max-annotation-calls 8]
  node scripts/prepare-adaptive-warrant-semantic-annotations.js assemble --manifest <file> --reader <id> --annotation-run-id <id> --responses <dir> --run <semantic-reader-run.json> --output <file>
  node scripts/prepare-adaptive-warrant-semantic-annotations.js support --manifest <file> --reader-a <file> --reader-b <file> --private-key <file> --output <file>
  node scripts/prepare-adaptive-warrant-semantic-annotations.js score --manifest <file> --reader-a <file> --reader-b <file> --predictions <file> --output <file>
`;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  const { values } = parseArgs({
    args,
    options: {
      corpus: { type: 'string' },
      handbook: { type: 'string' },
      preflight: { type: 'string' },
      'schema-acceptance': { type: 'string' },
      out: { type: 'string' },
      'corpus-role': { type: 'string' },
      'batch-size': { type: 'string' },
      'max-annotation-calls': { type: 'string' },
      manifest: { type: 'string' },
      reader: { type: 'string' },
      'annotation-run-id': { type: 'string' },
      responses: { type: 'string' },
      run: { type: 'string' },
      output: { type: 'string' },
      'reader-a': { type: 'string' },
      'reader-b': { type: 'string' },
      'private-key': { type: 'string' },
      predictions: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (!command || command === '--help' || command === '-h' || values.help) {
    process.stdout.write(usage());
    return;
  }
  if (command === 'prepare') {
    const result = prepareAdaptiveWarrantSemanticAnnotationBatches({
      corpusPath: values.corpus,
      handbookPath: values.handbook,
      outputDir: values.out,
      corpusRole: values['corpus-role'],
      batchSize: values['batch-size'] ? Number(values['batch-size']) : 8,
      maximumCalls: values['max-annotation-calls'] ? Number(values['max-annotation-calls']) : null,
      preflightPath: values.preflight,
      schemaAcceptancePath: values['schema-acceptance'],
    });
    process.stdout.write(`${result.manifestPath}\n${result.authorizationRequestPath}\n`);
    return;
  }
  if (command === 'assemble') {
    if (!values.run) throw new Error('live semantic assembly requires --run <semantic-reader-run.json>');
    const result = assembleAdaptiveWarrantSemanticAnnotationResponse({
      manifestPath: values.manifest,
      readerId: values.reader,
      annotationRunId: values['annotation-run-id'],
      responseDir: values.responses,
      outputPath: values.output,
      runPath: values.run,
    });
    process.stdout.write(`${result.outputPath}\n${result.auditPath}\n`);
    return;
  }
  if (command === 'score') {
    const result = scoreAdaptiveWarrantSemanticAnnotationFiles({
      manifestPath: values.manifest,
      readerAPath: values['reader-a'],
      readerBPath: values['reader-b'],
      predictionsPath: values.predictions,
      outputPath: values.output,
    });
    process.stdout.write(`${result.outputPath}\n`);
    return;
  }
  if (command === 'support') {
    const result = scoreAdaptiveWarrantSemanticReaderSupportFiles({
      manifestPath: values.manifest,
      readerAPath: values['reader-a'],
      readerBPath: values['reader-b'],
      privateKeyPath: values['private-key'],
      outputPath: values.output,
    });
    process.stdout.write(`${result.outputPath}\n`);
    return;
  }
  throw new Error(`unknown command ${command}\n${usage()}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    console.error(`[semantic-annotation] error: ${error.message}`);
    process.exitCode = 1;
  }
}
