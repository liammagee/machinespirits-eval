#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS,
  ADAPTIVE_WARRANT_ANNOTATION_RESPONSE_V4_SCHEMA,
  ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
  ADAPTIVE_WARRANT_DECISION_GATE,
  validateBlindedAnnotationResponse,
} from './run-adaptive-warrant-baseline-study.js';
import { ADAPTIVE_WARRANT_DIVERGENCE_DIMENSIONS } from '../services/adaptiveWarrantDivergence.js';

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
const REQUIRED_CHALLENGE_STRATA = Object.freeze({
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

function validateChallengeSupportPlan({ plan, corpus, corpusSha256 }) {
  exactFields(plan, ['schema', 'study_id', 'corpus_sha256', 'strata'], 'challenge support plan');
  if (plan.schema !== ADAPTIVE_WARRANT_CHALLENGE_SUPPORT_PLAN_SCHEMA) {
    throw new Error('challenge support plan has an unsupported schema');
  }
  if (plan.study_id !== corpus.study_id || plan.corpus_sha256 !== corpusSha256) {
    throw new Error('challenge support plan does not bind the frozen corpus');
  }
  exactFields(plan.strata, Object.keys(REQUIRED_CHALLENGE_STRATA), 'challenge support strata');
  const corpusIds = new Set(corpus.cases.map((row) => row.sample_id));
  const counts = {};
  for (const [stratum, minimum] of Object.entries(REQUIRED_CHALLENGE_STRATA)) {
    const ids = exactUniqueIds(plan.strata[stratum], `challenge stratum ${stratum}`);
    if (ids.some((id) => !corpusIds.has(id))) {
      throw new Error(`challenge stratum ${stratum} contains a sample outside the frozen corpus`);
    }
    if (ids.length < minimum) {
      throw new Error(`challenge stratum ${stratum} requires at least ${minimum} designed cases`);
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
          'Do not use tools, external sources, private predictions, technical traces, or another reader response.',
          `Every case-level and dimension note must contain at least ${ADAPTIVE_WARRANT_ANNOTATION_MIN_NOTE_CHARACTERS} characters of case-specific public evidence.`,
        ],
        handbook_markdown: handbookMarkdown,
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
      };
      const packetPath = path.join(resolvedOutputDir, 'packets', readerId, `${batchId}.packet.json`);
      writeJson(packetPath, packet);
      batches.push({
        batch_id: batchId,
        required_sample_ids: requiredSampleIds,
        packet_path: packetPath,
        packet_sha256: fileSha256(packetPath),
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
        ? 'May estimate natural prevalence and false-positive rates; support-limited cells remain inconclusive.'
        : 'May test supported classification and lifecycle accuracy; must not estimate natural prevalence or false-positive rates.',
    corpus: { path: resolvedCorpusPath, sha256: corpusSha256, cases: sampleIds.length },
    handbook: { path: resolvedHandbookPath, sha256: handbookSha256 },
    support_plan: supportPlan ? { ...supportPlan, counts: supportCounts } : null,
    batch_size: batchSize,
    readers,
  };
  const manifestPath = path.join(resolvedOutputDir, 'annotation-collection-manifest.json');
  writeJson(manifestPath, manifest);
  return { manifest, manifestPath };
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
  if (natural.handbook.sha256 !== challenge.handbook.sha256) {
    throw new Error('natural and challenge corpora must use the same frozen calibration handbook');
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
      natural_prevalence: 'Estimate prevalence and false-positive rates only from the natural corpus.',
      targeted_challenge: 'Estimate supported classification and lifecycle accuracy only from the challenge corpus.',
      combined_gate: 'Pass only when both separately scored corpora satisfy their declared gate responsibilities.',
    },
  };
}

function usage() {
  return `Usage:
  node scripts/prepare-adaptive-warrant-annotation-batches.js prepare --corpus <file> --handbook <file> --out <dir> --corpus-role natural_prevalence|targeted_challenge [--support-plan <file>] [--batch-size 8]
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
    });
    process.stdout.write(`${result.manifestPath}\n`);
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
