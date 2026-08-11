#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual, parseArgs } from 'node:util';

import {
  ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS,
  ADAPTIVE_WARRANT_ANNOTATION_RESPONSE_V4_SCHEMA,
  ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
  ADAPTIVE_WARRANT_DECISION_GATE,
  validateBlindedAnnotationResponse,
} from './run-adaptive-warrant-baseline-study.js';
import { ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS } from '../services/adaptiveWarrantDivergence.js';
import { ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS } from '../services/adaptiveWarrantActionContracts.js';

export const ADAPTIVE_WARRANT_ANNOTATION_COLLECTION_MANIFEST_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-annotation-collection-manifest.v1';
export const ADAPTIVE_WARRANT_ANNOTATION_READER_PACKET_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-annotation-reader-packet.v1';
export const ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-annotation-batch-response.v1';
export const ADAPTIVE_WARRANT_ANNOTATION_NORMALIZATION_AUDIT_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-annotation-normalization-audit.v1';
export const ADAPTIVE_WARRANT_ANNOTATION_CORPUS_PAIR_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-annotation-corpus-pair.v1';
export const ADAPTIVE_WARRANT_CHALLENGE_SUPPORT_PLAN_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-annotation-challenge-support-plan.v1';
export const ADAPTIVE_WARRANT_ANNOTATION_AUTHORIZATION_REQUEST_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-annotation-authorization-request.v1';

const CORPUS_ROLES = Object.freeze(['natural_prevalence', 'targeted_challenge']);
const RESPONSE_CASE_FIELDS = Object.freeze([
  'speech_act',
  'open_obligation_source_turns',
  'obligation_state',
  'inquiry_state',
  'commitment_transition_warranted',
  'current_candidate_override_required',
  'primary_warrant_basis',
  'recommended_action_family',
  'note',
  'divergence_by_dimension',
]);
const BATCH_RESPONSE_FIELDS = Object.freeze([
  'schema',
  'reader_id',
  'batch_id',
  'study_id',
  'corpus_sha256',
  'cases_by_sample_id',
]);
export const ADAPTIVE_WARRANT_CHALLENGE_DIAGNOSTIC_MINIMA = Object.freeze({
  tutor_directed_public_result_request: ADAPTIVE_WARRANT_DECISION_GATE.minimum_result_request_cases,
  learner_proposed_test: ADAPTIVE_WARRANT_DECISION_GATE.minimum_proposed_test_cases,
  obligation_persistence: ADAPTIVE_WARRANT_DECISION_GATE.minimum_obligation_persistence_cases,
  obligation_resolution: ADAPTIVE_WARRANT_DECISION_GATE.minimum_obligation_resolution_cases,
  inquiry_complete: ADAPTIVE_WARRANT_DECISION_GATE.minimum_inquiry_complete_cases,
  inquiry_incomplete: ADAPTIVE_WARRANT_DECISION_GATE.minimum_inquiry_incomplete_cases,
  ...Object.fromEntries(
    ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS.map((dimension) => [
      `divergence_${dimension}_nonaligned`,
      ADAPTIVE_WARRANT_DECISION_GATE.minimum_divergence_nonaligned_cases_per_dimension,
    ]),
  ),
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fileSha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function valueSha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function exactFields(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const expected = [...fields].sort();
  const observed = Object.keys(value).sort();
  if (JSON.stringify(expected) !== JSON.stringify(observed)) {
    throw new Error(`${label} fields must be exactly ${expected.join(', ')}`);
  }
}

function exactUniqueIds(ids, label) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new Error(`${label} must contain non-empty string sample ids`);
  }
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate sample ids`);
  return ids;
}

function assertEmptyOutputDirectory(outputDir) {
  if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).length) {
    throw new Error(`annotation collection output directory is not empty: ${outputDir}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
}

function responseTemplate() {
  return {
    speech_act: '',
    open_obligation_source_turns: [],
    obligation_state: '',
    inquiry_state: '',
    commitment_transition_warranted: '',
    current_candidate_override_required: '',
    primary_warrant_basis: '',
    recommended_action_family: '',
    note: '',
    divergence_by_dimension: Object.fromEntries(
      ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS.map((dimension) => [
        dimension,
        { interpretation: '', magnitude: '', persistence: '', note: '' },
      ]),
    ),
  };
}

function divergenceResponseSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['interpretation', 'magnitude', 'persistence', 'note'],
    properties: {
      interpretation: { enum: ['aligned', 'productive', 'stalled', 'unsafe', 'uncertain'] },
      magnitude: { enum: ['none', 'low', 'moderate', 'high', 'uncertain'] },
      persistence: { enum: ['none', 'single_turn', 'sustained', 'uncertain'] },
      note: { type: 'string', minLength: ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS },
    },
  };
}

const ADAPTIVE_WARRANT_ANNOTATION_ACTION_FAMILIES = Object.freeze([
  ...Object.keys(ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS),
  'hold',
  'uncertain',
]);

function caseResponseSchema(allowedActionFamilies) {
  return {
    type: 'object',
    additionalProperties: false,
    required: RESPONSE_CASE_FIELDS,
    properties: {
      speech_act: {
        enum: [
          'tutor_directed_public_result_request',
          'learner_proposed_test',
          'criterion_question',
          'tutor_selection_request',
          'learner_record_entry_request',
          'withdrawal',
          'transfer_to_learner',
          'other',
          'uncertain',
        ],
      },
      open_obligation_source_turns: {
        type: 'array',
        items: { type: 'integer', minimum: 1 },
        description:
          'Every creation or reminder turn for unresolved debt. This array must be empty for none, satisfied, or withdrawn_or_transferred; use at least one source turn for open, overdue, or deferred.',
      },
      obligation_state: {
        enum: ['none', 'open', 'overdue', 'deferred', 'satisfied', 'withdrawn_or_transferred', 'uncertain'],
        description:
          'Resolved states satisfied and withdrawn_or_transferred persist as the latest lifecycle state but must not retain open_obligation_source_turns. Use none only when no public obligation occurred.',
      },
      inquiry_state: { enum: ['complete', 'incomplete', 'uncertain'] },
      commitment_transition_warranted: {
        enum: ['yes', 'no', 'uncertain'],
        description:
          'Whether the held pedagogical family should change beyond this response. Public-obligation fulfilment alone is not a commitment transition; a differing terminal or pedagogical successor is.',
      },
      current_candidate_override_required: { enum: ['yes', 'no', 'uncertain'] },
      primary_warrant_basis: {
        enum: [
          'immediate_repair',
          'public_obligation',
          'inquiry_completion',
          'candidate_safety',
          'action_contract',
          'register_or_accumulated_trouble',
          'none',
          'uncertain',
        ],
      },
      recommended_action_family: {
        enum: allowedActionFamilies,
        description:
          'Choose one exact declared action family. Warrant-basis names such as immediate_repair are not action families.',
      },
      note: { type: 'string', minLength: ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS },
      divergence_by_dimension: {
        type: 'object',
        additionalProperties: false,
        required: ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS,
        properties: Object.fromEntries(
          ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS.map((dimension) => [
            dimension,
            { $ref: '#/$defs/divergence' },
          ]),
        ),
      },
    },
  };
}

export function buildAdaptiveWarrantAnnotationOutputSchema({
  readerId,
  batchId,
  studyId,
  corpusSha256,
  requiredSampleIds,
  allowedActionFamilies = ADAPTIVE_WARRANT_ANNOTATION_ACTION_FAMILIES,
} = {}) {
  exactUniqueIds(requiredSampleIds, 'requiredSampleIds');
  exactUniqueIds(allowedActionFamilies, 'allowedActionFamilies');
  for (const [label, value] of Object.entries({ readerId, batchId, studyId, corpusSha256 })) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: BATCH_RESPONSE_FIELDS,
    properties: {
      schema: { enum: [ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA] },
      reader_id: { enum: [readerId] },
      batch_id: { enum: [batchId] },
      study_id: { enum: [studyId] },
      corpus_sha256: { enum: [corpusSha256] },
      cases_by_sample_id: {
        type: 'object',
        additionalProperties: false,
        required: requiredSampleIds,
        properties: Object.fromEntries(
          requiredSampleIds.map((sampleId) => [sampleId, { $ref: '#/$defs/case' }]),
        ),
      },
    },
    $defs: {
      case: caseResponseSchema(allowedActionFamilies),
      divergence: divergenceResponseSchema(),
    },
  };
}

function validateChallengeSupportPlan({ plan, corpus, corpusSha256 }) {
  exactFields(plan, ['schema', 'study_id', 'corpus_sha256', 'strata'], 'challenge support plan');
  if (plan.schema !== ADAPTIVE_WARRANT_CHALLENGE_SUPPORT_PLAN_SCHEMA) {
    throw new Error('challenge support plan has an unsupported schema');
  }
  if (plan.study_id !== corpus.study_id || plan.corpus_sha256 !== corpusSha256) {
    throw new Error('challenge support plan does not bind the frozen corpus');
  }
  exactFields(plan.strata, Object.keys(ADAPTIVE_WARRANT_CHALLENGE_DIAGNOSTIC_MINIMA), 'challenge diagnostic strata');
  const corpusIds = new Set(corpus.cases.map((row) => row.sample_id));
  const counts = {};
  for (const [stratum, minimum] of Object.entries(ADAPTIVE_WARRANT_CHALLENGE_DIAGNOSTIC_MINIMA)) {
    const ids = exactUniqueIds(plan.strata[stratum], `challenge diagnostic stratum ${stratum}`);
    if (ids.some((id) => !corpusIds.has(id))) {
      throw new Error(`challenge diagnostic stratum ${stratum} contains a sample outside the frozen corpus`);
    }
    if (ids.length < minimum) {
      throw new Error(`challenge diagnostic stratum ${stratum} requires at least ${minimum} designed cases`);
    }
    counts[stratum] = ids.length;
  }
  return counts;
}

export function prepareAdaptiveWarrantAnnotationBatches({
  corpusPath,
  handbookPath,
  outputDir,
  readerIds = ['reader-a', 'reader-b'],
  batchSize = 8,
  corpusRole,
  supportPlanPath = null,
  annotationModel = 'codex.gpt-5.6-luna',
  annotationDestination = 'OpenAI Codex CLI (ChatGPT-account route)',
  maxAnnotationCalls = null,
} = {}) {
  if (!CORPUS_ROLES.includes(corpusRole)) throw new Error(`corpusRole must be one of ${CORPUS_ROLES.join(', ')}`);
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('batchSize must be a positive integer');
  exactUniqueIds(readerIds, 'readerIds');
  if (readerIds.length !== 2) throw new Error('annotation collection requires exactly two independent readers');

  const resolvedCorpusPath = path.resolve(corpusPath);
  const resolvedHandbookPath = path.resolve(handbookPath);
  const resolvedOutputDir = path.resolve(outputDir);
  const corpus = readJson(resolvedCorpusPath);
  if (corpus.schema !== ADAPTIVE_WARRANT_ANNOTATION_SCHEMA || corpus.blinded !== true) {
    throw new Error('annotation collection requires a frozen blinded V4 corpus');
  }
  const sampleIds = exactUniqueIds(corpus.cases.map((row) => row.sample_id), 'annotation corpus');
  const corpusSha256 = fileSha256(resolvedCorpusPath);
  const handbookSha256 = fileSha256(resolvedHandbookPath);
  let supportPlan = null;
  let supportCounts = null;
  if (corpusRole === 'targeted_challenge') {
    if (!supportPlanPath) throw new Error('targeted_challenge corpus requires a private support plan');
    const resolvedSupportPlanPath = path.resolve(supportPlanPath);
    supportPlan = { path: resolvedSupportPlanPath, sha256: fileSha256(resolvedSupportPlanPath) };
    supportCounts = validateChallengeSupportPlan({
      plan: readJson(resolvedSupportPlanPath),
      corpus,
      corpusSha256,
    });
  } else if (supportPlanPath) {
    throw new Error('natural_prevalence corpus must not carry a targeted support plan');
  }

  assertEmptyOutputDirectory(resolvedOutputDir);
  const handbookMarkdown = fs.readFileSync(resolvedHandbookPath, 'utf8');
  const corpusById = new Map(corpus.cases.map((row) => [row.sample_id, row]));
  const readers = [];
  for (const readerId of readerIds) {
    const batches = [];
    for (let offset = 0; offset < sampleIds.length; offset += batchSize) {
      const requiredSampleIds = sampleIds.slice(offset, offset + batchSize);
      const batchNumber = batches.length + 1;
      const batchId = `${readerId}-batch-${String(batchNumber).padStart(2, '0')}`;
      const outputSchema = buildAdaptiveWarrantAnnotationOutputSchema({
        readerId,
        batchId,
        studyId: corpus.study_id,
        corpusSha256,
        requiredSampleIds,
        allowedActionFamilies: corpus.allowed_recommended_action_families,
      });
      const packet = {
        schema: ADAPTIVE_WARRANT_ANNOTATION_READER_PACKET_SCHEMA,
        reader_id: readerId,
        batch_id: batchId,
        study_id: corpus.study_id,
        corpus_sha256: corpusSha256,
        handbook_sha256: handbookSha256,
        corpus_role: corpusRole,
        instructions: [
          'Work independently and use only this handbook and the supplied public decision-time cases.',
          'Return one JSON object only, using the exact response envelope and every required sample-id key.',
          `The handbook's V4 envelope describes the assembled reader artifact, not this batch response. For this batch, use schema ${ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA} and exactly the six top-level fields in response_template; do not add annotator_id or annotation_run_id.`,
          'Use only an exact value from allowed_recommended_action_families; immediate_repair is a warrant basis, not an action family.',
          'open_obligation_source_turns contains unresolved sources only: it must be empty for none, satisfied, or withdrawn_or_transferred, and non-empty for open, overdue, or deferred.',
          'For unresolved debt, list every public creation or reminder turn. A resolved obligation remains satisfied or withdrawn_or_transferred at the next decision; none means no obligation occurred.',
          'If a request is answered in tutor turn 1, label the lifecycle satisfied at learner turn 2 with no open source turns; do not reset it to none.',
          'Use aligned when the dimensional norm is met: record growth or explicit analytic work is conceptual alignment, and voluntary agency is engagement alignment. Productive means a useful departure from the norm, not merely a good move.',
          'For strategy exhaustion, follow the supplied contract result: defeat or expiry with revision_warranted=true is stalled even when the current learner wording sounds active; a live or successful contract is aligned unless separate strategy evidence defeats it.',
          'Public-obligation fulfilment can override the current candidate but does not by itself change the held pedagogical commitment. A differing terminal or pedagogical successor does.',
          'Use action_contract only when the supplied public contract requires a transition, inquiry_completion only for a complete inquiry, candidate_safety for an unsafe close while inquiry is incomplete, and public_obligation only for actionable open or overdue debt.',
          'Do not use tools, external sources, private predictions, technical traces, or another reader response.',
          `Every case-level and dimension note must contain at least ${ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS} characters of case-specific public evidence.`,
        ],
        handbook_markdown: handbookMarkdown,
        allowed_recommended_action_families: corpus.allowed_recommended_action_families,
        required_sample_ids: requiredSampleIds,
        cases_by_sample_id: Object.fromEntries(requiredSampleIds.map((id) => [id, corpusById.get(id)])),
        response_template: {
          schema: ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
          reader_id: readerId,
          batch_id: batchId,
          study_id: corpus.study_id,
          corpus_sha256: corpusSha256,
          cases_by_sample_id: Object.fromEntries(requiredSampleIds.map((id) => [id, responseTemplate()])),
        },
        response_json_schema: outputSchema,
      };
      const packetPath = path.join(resolvedOutputDir, 'packets', readerId, `${batchId}.packet.json`);
      const outputSchemaPath = path.join(
        resolvedOutputDir,
        'packets',
        readerId,
        `${batchId}.response.schema.json`,
      );
      writeJson(outputSchemaPath, outputSchema);
      writeJson(packetPath, packet);
      batches.push({
        batch_id: batchId,
        required_sample_ids: requiredSampleIds,
        packet_path: packetPath,
        packet_sha256: fileSha256(packetPath),
        output_schema_path: outputSchemaPath,
        output_schema_sha256: fileSha256(outputSchemaPath),
        expected_response_filename: `${batchId}.response.json`,
      });
    }
    readers.push({ reader_id: readerId, batches });
  }

  const manifest = {
    schema: ADAPTIVE_WARRANT_ANNOTATION_COLLECTION_MANIFEST_SCHEMA,
    status: 'prepared',
    study_id: corpus.study_id,
    corpus_role: corpusRole,
    inference_boundary:
      corpusRole === 'natural_prevalence'
        ? 'May estimate natural prevalence and false-positive rates; gate-eligible only when this is the predeclared representative sampling frame, and support-limited cells remain inconclusive.'
        : 'Diagnostic only: may probe supported failure modes and guide repair, but cannot contribute to a pass/fail gate, prevalence estimate, false-positive estimate, or validation claim.',
    gate_eligible: corpusRole === 'natural_prevalence',
    corpus: { path: resolvedCorpusPath, sha256: corpusSha256, cases: sampleIds.length },
    handbook: { path: resolvedHandbookPath, sha256: handbookSha256 },
    support_plan: supportPlan ? { ...supportPlan, counts: supportCounts } : null,
    batch_size: batchSize,
    readers,
  };
  const manifestPath = path.join(resolvedOutputDir, 'annotation-collection-manifest.json');
  writeJson(manifestPath, manifest);
  const plannedCalls = readers.reduce((sum, reader) => sum + reader.batches.length, 0);
  const callCeiling = maxAnnotationCalls === null ? plannedCalls : Number(maxAnnotationCalls);
  if (!Number.isInteger(callCeiling) || callCeiling < plannedCalls) {
    throw new Error(`maxAnnotationCalls must be an integer at least equal to the ${plannedCalls} planned calls`);
  }
  const authorizationContract = {
    schema: ADAPTIVE_WARRANT_ANNOTATION_AUTHORIZATION_REQUEST_SCHEMA,
    status: 'approval_required',
    study_id: corpus.study_id,
    corpus_role: corpusRole,
    inferential_role: manifest.inference_boundary,
    destination: annotationDestination,
    model: annotationModel,
    payload_scope: {
      classification: 'unpublished_private_research_prompt_payload',
      transmitted: [
        'the frozen annotation handbook embedded in each reader packet',
        'blinded public decision-time cases keyed by opaque sample id',
        'the exact response schema and collection instructions',
      ],
      excluded: [
        'annotation private key',
        'private challenge design and support plan',
        'detector predictions and technical traces',
        'source files and Git metadata',
        'either reader response supplied to the other reader',
        'credentials and human-subject data',
      ],
    },
    call_budget: {
      planned_calls: plannedCalls,
      maximum_calls: callCeiling,
      readers: readers.length,
      calls_per_reader_planned: Object.fromEntries(
        readers.map((reader) => [reader.reader_id, reader.batches.length]),
      ),
    },
    bindings: {
      collection_manifest_sha256: fileSha256(manifestPath),
      corpus_sha256: corpusSha256,
      handbook_sha256: handbookSha256,
      reader_packets: readers.flatMap((reader) =>
        reader.batches.map((batch) => ({
          reader_id: reader.reader_id,
          batch_id: batch.batch_id,
          sha256: batch.packet_sha256,
          output_schema_sha256: batch.output_schema_sha256,
        })),
      ),
    },
  };
  const authorizationRequest = {
    ...authorizationContract,
    approval_digest: valueSha256(authorizationContract),
  };
  const authorizationRequestPath = path.join(resolvedOutputDir, 'annotation-authorization-request.json');
  writeJson(authorizationRequestPath, authorizationRequest);
  return { manifest, manifestPath, authorizationRequest, authorizationRequestPath };
}

function canonicalizeReaderCase(row, sampleId, edits) {
  const normalized = structuredClone(row);
  if (normalized.primary_warrant_basis === 'none' && normalized.recommended_action_family !== 'hold') {
    edits.push({
      sample_id: sampleId,
      field: 'recommended_action_family',
      from: normalized.recommended_action_family,
      to: 'hold',
      reason: 'predeclared none-basis family canonicalization',
    });
    normalized.recommended_action_family = 'hold';
  }
  if (normalized.primary_warrant_basis === 'uncertain' && normalized.recommended_action_family !== 'uncertain') {
    edits.push({
      sample_id: sampleId,
      field: 'recommended_action_family',
      from: normalized.recommended_action_family,
      to: 'uncertain',
      reason: 'predeclared uncertain-basis family canonicalization',
    });
    normalized.recommended_action_family = 'uncertain';
  }
  return normalized;
}

export function assembleAdaptiveWarrantAnnotationResponse({
  manifestPath,
  readerId,
  annotationRunId,
  responseDir,
  outputPath,
} = {}) {
  const resolvedManifestPath = path.resolve(manifestPath);
  const manifest = readJson(resolvedManifestPath);
  if (manifest.schema !== ADAPTIVE_WARRANT_ANNOTATION_COLLECTION_MANIFEST_SCHEMA) {
    throw new Error('annotation collection manifest has an unsupported schema');
  }
  if (!annotationRunId?.trim()) throw new Error('annotationRunId must be a non-empty independent run id');
  const reader = manifest.readers.find((row) => row.reader_id === readerId);
  if (!reader) throw new Error(`reader ${readerId} is not declared by the collection manifest`);
  if (fileSha256(manifest.corpus.path) !== manifest.corpus.sha256) throw new Error('annotation corpus drift');
  if (fileSha256(manifest.handbook.path) !== manifest.handbook.sha256) throw new Error('annotation handbook drift');
  const corpus = readJson(manifest.corpus.path);
  const corpusOrder = new Map(corpus.cases.map((row, index) => [row.sample_id, index]));
  const cases = [];
  const edits = [];
  const inputBatches = [];

  for (const batch of reader.batches) {
    if (fileSha256(batch.packet_path) !== batch.packet_sha256) {
      throw new Error(`batch reader packet ${batch.batch_id} drift`);
    }
    if (fileSha256(batch.output_schema_path) !== batch.output_schema_sha256) {
      throw new Error(`batch response schema ${batch.batch_id} drift`);
    }
    const packet = readJson(batch.packet_path);
    if (!isDeepStrictEqual(packet.response_json_schema, readJson(batch.output_schema_path))) {
      throw new Error(`batch response schema ${batch.batch_id} is not bound by its reader packet`);
    }
    const batchPath = path.join(path.resolve(responseDir), batch.expected_response_filename);
    const response = readJson(batchPath);
    exactFields(response, BATCH_RESPONSE_FIELDS, `batch response ${batch.batch_id}`);
    if (
      response.schema !== ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA ||
      response.reader_id !== readerId ||
      response.batch_id !== batch.batch_id ||
      response.study_id !== manifest.study_id ||
      response.corpus_sha256 !== manifest.corpus.sha256
    ) {
      throw new Error(`batch response ${batch.batch_id} does not bind the prepared reader packet`);
    }
    const responseIds = Object.keys(response.cases_by_sample_id || {}).sort();
    const expectedIds = [...batch.required_sample_ids].sort();
    if (JSON.stringify(responseIds) !== JSON.stringify(expectedIds)) {
      throw new Error(`batch response ${batch.batch_id} must contain exactly its required sample-id keys`);
    }
    for (const sampleId of batch.required_sample_ids) {
      const row = response.cases_by_sample_id[sampleId];
      exactFields(row, RESPONSE_CASE_FIELDS, `batch response ${batch.batch_id} case ${sampleId}`);
      cases.push({ sample_id: sampleId, ...canonicalizeReaderCase(row, sampleId, edits) });
    }
    inputBatches.push({ batch_id: batch.batch_id, path: batchPath, sha256: fileSha256(batchPath) });
  }

  cases.sort((left, right) => corpusOrder.get(left.sample_id) - corpusOrder.get(right.sample_id));
  const response = {
    schema: ADAPTIVE_WARRANT_ANNOTATION_RESPONSE_V4_SCHEMA,
    study_id: manifest.study_id,
    corpus_sha256: manifest.corpus.sha256,
    annotator_id: readerId,
    annotation_run_id: annotationRunId,
    cases,
  };
  const validation = validateBlindedAnnotationResponse({
    response,
    corpus,
    expectedCorpusSha256: manifest.corpus.sha256,
  });
  const resolvedOutputPath = path.resolve(outputPath);
  writeJson(resolvedOutputPath, response);
  const audit = {
    schema: ADAPTIVE_WARRANT_ANNOTATION_NORMALIZATION_AUDIT_SCHEMA,
    collection_manifest: { path: resolvedManifestPath, sha256: fileSha256(resolvedManifestPath) },
    corpus_role: manifest.corpus_role,
    reader_id: readerId,
    annotation_run_id: annotationRunId,
    input_batches: inputBatches,
    policy: {
      allowed_edits: [
        'primary_warrant_basis none forces recommended_action_family hold',
        'primary_warrant_basis uncertain forces recommended_action_family uncertain',
      ],
      forbidden_edits: 'All other missing, malformed, inconsistent, or unsupported fields fail closed.',
    },
    edits,
    edit_count: edits.length,
    validation,
    output: { path: resolvedOutputPath, sha256: fileSha256(resolvedOutputPath) },
  };
  const auditPath = resolvedOutputPath.replace(/\.json$/u, '.normalization.json');
  writeJson(auditPath, audit);
  return { response, validation, audit, outputPath: resolvedOutputPath, auditPath };
}

export function validateAdaptiveWarrantAnnotationAuthorizationRequest({ requestPath, manifestPath } = {}) {
  const resolvedRequestPath = path.resolve(requestPath);
  const resolvedManifestPath = path.resolve(manifestPath);
  const request = readJson(resolvedRequestPath);
  const manifest = readJson(resolvedManifestPath);
  exactFields(
    request,
    [
      'schema',
      'status',
      'study_id',
      'corpus_role',
      'inferential_role',
      'destination',
      'model',
      'payload_scope',
      'call_budget',
      'bindings',
      'approval_digest',
    ],
    'annotation authorization request',
  );
  if (
    request.schema !== ADAPTIVE_WARRANT_ANNOTATION_AUTHORIZATION_REQUEST_SCHEMA ||
    request.status !== 'approval_required'
  ) {
    throw new Error('annotation authorization request has an invalid schema or status');
  }
  if (
    request.study_id !== manifest.study_id ||
    request.corpus_role !== manifest.corpus_role ||
    request.inferential_role !== manifest.inference_boundary
  ) {
    throw new Error('annotation authorization request does not bind the collection role');
  }
  if (!request.destination?.trim() || !request.model?.trim()) {
    throw new Error('annotation authorization request requires a named destination and model');
  }
  if (request.bindings.collection_manifest_sha256 !== fileSha256(resolvedManifestPath)) {
    throw new Error('annotation authorization request collection manifest drift');
  }
  if (
    request.bindings.corpus_sha256 !== manifest.corpus.sha256 ||
    request.bindings.handbook_sha256 !== manifest.handbook.sha256
  ) {
    throw new Error('annotation authorization request corpus or handbook binding mismatch');
  }
  const expectedPackets = manifest.readers.flatMap((reader) =>
    reader.batches.map((batch) => ({
      reader_id: reader.reader_id,
      batch_id: batch.batch_id,
      sha256: batch.packet_sha256,
      output_schema_sha256: batch.output_schema_sha256,
    })),
  );
  for (const reader of manifest.readers) {
    for (const batch of reader.batches) {
      if (fileSha256(batch.packet_path) !== batch.packet_sha256) {
        throw new Error(`annotation authorization request packet drift: ${batch.batch_id}`);
      }
      if (fileSha256(batch.output_schema_path) !== batch.output_schema_sha256) {
        throw new Error(`annotation authorization request output schema drift: ${batch.batch_id}`);
      }
      const packet = readJson(batch.packet_path);
      if (!isDeepStrictEqual(packet.response_json_schema, readJson(batch.output_schema_path))) {
        throw new Error(`annotation authorization request unbound output schema: ${batch.batch_id}`);
      }
    }
  }
  if (JSON.stringify(request.bindings.reader_packets) !== JSON.stringify(expectedPackets)) {
    throw new Error('annotation authorization request packet binding mismatch');
  }
  const plannedCalls = expectedPackets.length;
  if (
    request.call_budget.planned_calls !== plannedCalls ||
    !Number.isInteger(request.call_budget.maximum_calls) ||
    request.call_budget.maximum_calls < plannedCalls
  ) {
    throw new Error('annotation authorization request call budget mismatch');
  }
  const { approval_digest: approvalDigest, ...contract } = request;
  if (approvalDigest !== valueSha256(contract)) {
    throw new Error('annotation authorization request approval digest mismatch');
  }
  return {
    ok: true,
    approval_digest: approvalDigest,
    planned_calls: plannedCalls,
    maximum_calls: request.call_budget.maximum_calls,
  };
}

export function validateAdaptiveWarrantAnnotationCorpusPair({ naturalManifestPath, challengeManifestPath } = {}) {
  const naturalPath = path.resolve(naturalManifestPath);
  const challengePath = path.resolve(challengeManifestPath);
  const natural = readJson(naturalPath);
  const challenge = readJson(challengePath);
  for (const [label, manifest] of [
    ['natural', natural],
    ['challenge', challenge],
  ]) {
    if (manifest.schema !== ADAPTIVE_WARRANT_ANNOTATION_COLLECTION_MANIFEST_SCHEMA) {
      throw new Error(`${label} collection manifest has an unsupported schema`);
    }
  }
  if (natural.corpus_role !== 'natural_prevalence' || challenge.corpus_role !== 'targeted_challenge') {
    throw new Error('corpus pair requires natural_prevalence plus targeted_challenge roles');
  }
  if (!challenge.support_plan) throw new Error('targeted challenge manifest requires a validated support plan');
  if (natural.corpus.sha256 === challenge.corpus.sha256 || natural.study_id === challenge.study_id) {
    throw new Error('natural and challenge corpora must be independently frozen');
  }
  const naturalFingerprints = new Set(readJson(natural.corpus.path).cases.map(valueSha256));
  const overlap = readJson(challenge.corpus.path).cases.filter((row) => naturalFingerprints.has(valueSha256(row))).length;
  if (overlap) throw new Error(`natural and challenge corpora overlap on ${overlap} public cases`);
  return {
    schema: ADAPTIVE_WARRANT_ANNOTATION_CORPUS_PAIR_SCHEMA,
    natural: { manifest_path: naturalPath, corpus_sha256: natural.corpus.sha256, cases: natural.corpus.cases },
    challenge: {
      manifest_path: challengePath,
      corpus_sha256: challenge.corpus.sha256,
      cases: challenge.corpus.cases,
      support_counts: challenge.support_plan.counts,
    },
    inference_boundaries: {
      natural_prevalence:
        'Apply the predeclared pass/fail gate only to a representative natural corpus frozen after any diagnostic-driven repair.',
      targeted_challenge:
        'Diagnostic only: probe failure modes and guide repair; never contribute cases or scores to the pass/fail gate.',
      combined_gate: 'Forbidden: natural and targeted cases or scores must never be pooled into one gate.',
    },
  };
}

function usage() {
  return `Usage:
  node scripts/prepare-adaptive-warrant-annotation-batches.js prepare --corpus <file> --handbook <file> --out <dir> --corpus-role natural_prevalence|targeted_challenge [--support-plan <file>] [--batch-size 8] [--model <ref>] [--destination <route>] [--max-annotation-calls <n>]
  node scripts/prepare-adaptive-warrant-annotation-batches.js assemble --manifest <file> --reader <id> --annotation-run-id <id> --responses <dir> --output <file>
  node scripts/prepare-adaptive-warrant-annotation-batches.js pair-check --natural-manifest <file> --challenge-manifest <file> [--output <file>]
`;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const { values } = parseArgs({
    args,
    options: {
      corpus: { type: 'string' },
      handbook: { type: 'string' },
      out: { type: 'string' },
      'corpus-role': { type: 'string' },
      'support-plan': { type: 'string' },
      'batch-size': { type: 'string' },
      manifest: { type: 'string' },
      reader: { type: 'string' },
      'annotation-run-id': { type: 'string' },
      responses: { type: 'string' },
      output: { type: 'string' },
      'natural-manifest': { type: 'string' },
      'challenge-manifest': { type: 'string' },
      model: { type: 'string' },
      destination: { type: 'string' },
      'max-annotation-calls': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help || !command) {
    process.stdout.write(usage());
    return;
  }
  if (command === 'prepare') {
    const result = prepareAdaptiveWarrantAnnotationBatches({
      corpusPath: values.corpus,
      handbookPath: values.handbook,
      outputDir: values.out,
      batchSize: values['batch-size'] ? Number(values['batch-size']) : 8,
      corpusRole: values['corpus-role'],
      supportPlanPath: values['support-plan'] || null,
      annotationModel: values.model || 'codex.gpt-5.6-luna',
      annotationDestination: values.destination || 'OpenAI Codex CLI (ChatGPT-account route)',
      maxAnnotationCalls: values['max-annotation-calls'] ? Number(values['max-annotation-calls']) : null,
    });
    process.stdout.write(`${result.manifestPath}\n${result.authorizationRequestPath}\n`);
    return;
  }
  if (command === 'assemble') {
    const result = assembleAdaptiveWarrantAnnotationResponse({
      manifestPath: values.manifest,
      readerId: values.reader,
      annotationRunId: values['annotation-run-id'],
      responseDir: values.responses,
      outputPath: values.output,
    });
    process.stdout.write(`${result.outputPath}\n${result.auditPath}\n`);
    return;
  }
  if (command === 'pair-check') {
    const pair = validateAdaptiveWarrantAnnotationCorpusPair({
      naturalManifestPath: values['natural-manifest'],
      challengeManifestPath: values['challenge-manifest'],
    });
    if (values.output) writeJson(path.resolve(values.output), pair);
    process.stdout.write(`${JSON.stringify(pair, null, 2)}\n`);
    return;
  }
  throw new Error(`unknown command ${command}\n${usage()}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(`[warrant-annotation] error: ${error.message}`);
    process.exitCode = 1;
  });
}
