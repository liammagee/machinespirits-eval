#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA } from '../services/adaptiveWarrantSemanticAnnotation.js';
import {
  validateAdaptiveWarrantSemanticPreflightArtifact,
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult,
} from '../services/adaptiveWarrantSemanticPreflight.js';
import {
  ADAPTIVE_WARRANT_SEMANTIC_AUTHORIZATION_REQUEST_SCHEMA,
  ADAPTIVE_WARRANT_SEMANTIC_COLLECTION_MANIFEST_SCHEMA,
} from './prepare-adaptive-warrant-semantic-annotations.js';
import { ADAPTIVE_WARRANT_V3_SEMANTIC_DIAGNOSTIC_FREEZE_SCHEMA } from './build-adaptive-warrant-v3-semantic-diagnostic.js';

export const ADAPTIVE_WARRANT_SEMANTIC_READER_RUN_SCHEMA =
  'machinespirits.adaptation-refinement.semantic-event-reader-run.v1';
const BATCH_FIELDS = Object.freeze([
  'schema',
  'reader_id',
  'batch_id',
  'study_id',
  'corpus_sha256',
  'cases_by_sample_id',
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

function gitValue(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`could not run git ${args.join(' ')}`);
  return result.stdout.trim();
}

function exactFields(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} has unexpected fields`);
  }
}

function validateAuthorization({ request, requestPath, manifest, approvedBy }) {
  if (request.schema !== ADAPTIVE_WARRANT_SEMANTIC_AUTHORIZATION_REQUEST_SCHEMA) {
    throw new Error('semantic reader authorization request schema mismatch');
  }
  const { approval_digest: approvalDigest, ...contract } = request;
  if (approvalDigest !== valueSha256(contract)) throw new Error('semantic reader approval digest mismatch');
  if (
    request.status !== 'approval_required' ||
    request.study_id !== manifest.study_id ||
    request.bindings.source_commit !== manifest.source_commit ||
    request.bindings.manifest_sha256 !== fileSha256(manifest.__path) ||
    request.bindings.corpus_sha256 !== manifest.corpus.sha256 ||
    request.bindings.handbook_sha256 !== manifest.handbook.sha256 ||
    JSON.stringify(request.bindings.brittleness_preflight) !== JSON.stringify(manifest.brittleness_preflight) ||
    JSON.stringify(request.bindings.schema_acceptance_ping) !== JSON.stringify(manifest.schema_acceptance_ping)
  ) {
    throw new Error('semantic reader authorization request is not bound to the collection');
  }
  if (request.destination !== 'OpenAI Codex CLI (ChatGPT-account route)' || request.model !== 'codex.gpt-5.6-luna') {
    throw new Error('semantic readers require the frozen Luna ChatGPT-account route');
  }
  if (!approvedBy?.trim()) throw new Error('semantic reader launch requires a recorded standing authorization');
  return {
    schema: 'machinespirits.adaptation-refinement.semantic-event-reader-authorization-acceptance.v1',
    status: 'approved',
    approval_digest: approvalDigest,
    request_path: path.resolve(requestPath),
    request_sha256: fileSha256(path.resolve(requestPath)),
    approved_by: approvedBy.trim(),
    approved_at: new Date().toISOString(),
  };
}

function validateFreeze({ freeze, manifest, repoRoot }) {
  const diagnostic = freeze.schema === ADAPTIVE_WARRANT_V3_SEMANTIC_DIAGNOSTIC_FREEZE_SCHEMA;
  const syntheticSmoke =
    freeze.schema === 'machinespirits.adaptation-refinement.semantic-schema-smoke-freeze.v1' &&
    freeze.synthetic_smoke_only === true &&
    freeze.permanently_excluded_from_research === true;
  if ((!diagnostic && !syntheticSmoke) || freeze.status !== 'frozen') {
    throw new Error('semantic reader launch requires the V3 diagnostic freeze');
  }
  if (
    freeze.study_id !== manifest.study_id ||
    freeze.source_commit !== manifest.source_commit ||
    freeze.corpus.sha256 !== manifest.corpus.sha256 ||
    freeze.handbook.sha256 !== manifest.handbook.sha256
  ) {
    throw new Error('semantic collection does not bind the diagnostic freeze');
  }
  const commit = gitValue(['rev-parse', 'HEAD'], repoRoot);
  const status = gitValue(['status', '--short'], repoRoot);
  if (commit !== freeze.source_commit || status) {
    throw new Error('semantic reader launch requires the exact clean frozen commit');
  }
  const preflightBinding = freeze.brittleness_preflight;
  if (!preflightBinding?.path || fileSha256(preflightBinding.path) !== preflightBinding.sha256) {
    throw new Error('semantic diagnostic brittleness preflight drift');
  }
  validateAdaptiveWarrantSemanticPreflightArtifact({
    artifact: readJson(preflightBinding.path),
    expectedSourceCommit: commit,
  });
  if (manifest.brittleness_preflight?.sha256 !== preflightBinding.sha256) {
    throw new Error('semantic collection or authorization does not bind the frozen brittleness preflight');
  }
  const schemaAcceptanceBinding = freeze.schema_acceptance_ping;
  if (!schemaAcceptanceBinding?.path || fileSha256(schemaAcceptanceBinding.path) !== schemaAcceptanceBinding.sha256) {
    throw new Error('semantic diagnostic schema-acceptance ping drift');
  }
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult({
    artifact: readJson(schemaAcceptanceBinding.path),
    expectedSourceCommit: commit,
    expectedPreflightSha256: preflightBinding.sha256,
  });
  if (manifest.schema_acceptance_ping?.sha256 !== schemaAcceptanceBinding.sha256) {
    throw new Error('semantic collection or authorization does not bind the frozen schema-acceptance ping');
  }
  const artifactBindings = diagnostic
    ? [
        freeze.design,
        freeze.corpus,
        freeze.handbook,
        freeze.decision_handbook,
        freeze.private_key,
        freeze.private_support_plan,
      ]
    : [freeze.corpus, freeze.handbook];
  for (const binding of artifactBindings) {
    if (!binding?.path || fileSha256(binding.path) !== binding.sha256) {
      throw new Error('semantic diagnostic freeze artifact drift');
    }
  }
}

function packetBindings(manifest) {
  return manifest.readers.flatMap((reader) =>
    reader.batches.map((batch) => ({
      reader_id: reader.reader_id,
      batch_id: batch.batch_id,
      packet_sha256: batch.packet_sha256,
      response_schema_sha256: batch.response_schema_sha256,
    })),
  );
}

function validatePreparedArtifacts(request, manifest) {
  const expected = packetBindings(manifest);
  if (JSON.stringify(request.bindings.packets) !== JSON.stringify(expected)) {
    throw new Error('semantic reader authorization packet bindings mismatch');
  }
  for (const reader of manifest.readers) {
    for (const batch of reader.batches) {
      if (fileSha256(batch.packet_path) !== batch.packet_sha256) throw new Error(`${batch.batch_id} packet drift`);
      if (fileSha256(batch.response_schema_path) !== batch.response_schema_sha256) {
        throw new Error(`${batch.batch_id} response schema drift`);
      }
    }
  }
  if (
    request.call_budget.planned_calls !== expected.length ||
    !Number.isInteger(request.call_budget.maximum_calls) ||
    request.call_budget.maximum_calls < expected.length
  ) {
    throw new Error('semantic reader authorization call budget mismatch');
  }
}

function parseJsonObject(text, batchId) {
  const source = String(text || '').trim();
  try {
    const value = JSON.parse(source);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value;
  } catch (error) {
    throw new Error(`${batchId} returned invalid JSON: ${error.message}`);
  }
}

export async function runAdaptiveWarrantSemanticReaders({
  manifestPath,
  freezeManifestPath,
  authorizationRequestPath,
  outputDir,
  approvedBy,
  effort = 'medium',
  callModel = callAIWithCliBridge,
} = {}) {
  const resolvedManifest = path.resolve(manifestPath);
  const resolvedFreeze = path.resolve(freezeManifestPath);
  const resolvedRequest = path.resolve(authorizationRequestPath);
  const resolvedOutput = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length) {
    throw new Error(`semantic reader run output is not empty: ${resolvedOutput}`);
  }
  fs.mkdirSync(resolvedOutput, { recursive: true });
  const manifest = readJson(resolvedManifest);
  manifest.__path = resolvedManifest;
  if (manifest.schema !== ADAPTIVE_WARRANT_SEMANTIC_COLLECTION_MANIFEST_SCHEMA || manifest.status !== 'prepared') {
    throw new Error('semantic reader collection manifest is not prepared');
  }
  const freeze = readJson(resolvedFreeze);
  const request = readJson(resolvedRequest);
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  validateFreeze({ freeze, manifest, repoRoot });
  validatePreparedArtifacts(request, manifest);
  if (
    freeze.synthetic_smoke_only === true &&
    (request.call_budget.planned_calls !== 2 || request.call_budget.maximum_calls !== 2)
  ) {
    throw new Error('semantic schema smoke is capped at exactly two model calls');
  }
  const authorization = validateAuthorization({
    request,
    requestPath: resolvedRequest,
    manifest,
    approvedBy,
  });
  atomicWriteJson(path.join(resolvedOutput, 'accepted-authorization.json'), authorization);
  const run = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_READER_RUN_SCHEMA,
    status: 'running',
    study_id: manifest.study_id,
    source_commit: freeze.source_commit,
    authorization,
    model: request.model,
    destination: request.destination,
    call_budget: request.call_budget,
    calls_attempted: 0,
    calls_completed: 0,
    batches: [],
  };
  const runPath = path.join(resolvedOutput, 'semantic-reader-run.json');
  atomicWriteJson(runPath, run);
  for (const reader of manifest.readers) {
    for (const batch of reader.batches) {
      if (run.calls_attempted >= request.call_budget.maximum_calls) {
        run.status = 'incomplete_call_budget_exhausted';
        atomicWriteJson(runPath, run);
        throw new Error('semantic reader call budget exhausted');
      }
      const packet = readJson(batch.packet_path);
      const responseSchema = readJson(batch.response_schema_path);
      const prompt = JSON.stringify(packet);
      run.calls_attempted += 1;
      atomicWriteJson(runPath, run);
      const started = Date.now();
      try {
        const result = await callModel(
          { provider: 'codex', model: 'gpt-5.6-luna' },
          'You are one isolated independent research reader. Use only the supplied frozen packet. Return exactly the schema-bound JSON object and do not use tools.',
          prompt,
          `adaptive-warrant-${reader.reader_id}-${batch.batch_id}`,
          {
            outputSchema: responseSchema,
            effort,
            timeoutMs: 600_000,
            maxStdoutBytes: 256_000,
            maxStderrBytes: 64_000,
          },
        );
        const parsed = parseJsonObject(result.text, batch.batch_id);
        exactFields(parsed, BATCH_FIELDS, `${batch.batch_id} model response`);
        if (
          parsed.schema !== ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA ||
          parsed.reader_id !== reader.reader_id ||
          parsed.batch_id !== batch.batch_id ||
          parsed.study_id !== manifest.study_id ||
          parsed.corpus_sha256 !== manifest.corpus.sha256
        ) {
          throw new Error(`${batch.batch_id} model response binding mismatch`);
        }
        const responseIds = Object.keys(parsed.cases_by_sample_id || {}).sort();
        const expectedIds = [...batch.required_sample_ids].sort();
        if (JSON.stringify(responseIds) !== JSON.stringify(expectedIds)) {
          throw new Error(`${batch.batch_id} model response sample-id mismatch`);
        }
        const outputPath = path.join(resolvedOutput, reader.reader_id, batch.expected_response_filename);
        atomicWriteJson(outputPath, parsed);
        run.calls_completed += 1;
        run.batches.push({
          reader_id: reader.reader_id,
          batch_id: batch.batch_id,
          status: 'complete',
          packet_sha256: batch.packet_sha256,
          response_schema_sha256: batch.response_schema_sha256,
          response_path: outputPath,
          response_sha256: fileSha256(outputPath),
          latency_ms: Date.now() - started,
          returned_provider: result.provider || null,
          returned_model: result.model || null,
          model_attestation_basis: result.modelAttestationBasis || null,
          model_independently_attested: result.modelIndependentlyAttested === true,
          prohibited_tool_event_count: Number(result.prohibitedToolEventCount || 0),
        });
      } catch (error) {
        run.status = 'incomplete_model_call_failure';
        run.batches.push({
          reader_id: reader.reader_id,
          batch_id: batch.batch_id,
          status: 'failed',
          packet_sha256: batch.packet_sha256,
          response_schema_sha256: batch.response_schema_sha256,
          latency_ms: Date.now() - started,
          error: error.message,
        });
        atomicWriteJson(runPath, run);
        throw error;
      }
      atomicWriteJson(runPath, run);
    }
  }
  run.status = 'complete';
  run.completed_at = new Date().toISOString();
  atomicWriteJson(runPath, run);
  return { run, runPath };
}

function usage() {
  return 'Usage: node scripts/run-adaptive-warrant-semantic-readers.js --manifest <collection> --freeze-manifest <freeze> --authorization-request <request> --out <empty-dir> --approved-by <standing-authorization-record> [--effort medium]\n';
}

async function main() {
  const { values } = parseArgs({
    options: {
      manifest: { type: 'string' },
      'freeze-manifest': { type: 'string' },
      'authorization-request': { type: 'string' },
      out: { type: 'string' },
      'approved-by': { type: 'string' },
      effort: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(usage());
    return;
  }
  const result = await runAdaptiveWarrantSemanticReaders({
    manifestPath: values.manifest,
    freezeManifestPath: values['freeze-manifest'],
    authorizationRequestPath: values['authorization-request'],
    outputDir: values.out,
    approvedBy: values['approved-by'],
    effort: values.effort || 'medium',
  });
  process.stdout.write(`${result.runPath}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(`[semantic-readers] error: ${error.message}`);
    process.exitCode = 1;
  });
}
