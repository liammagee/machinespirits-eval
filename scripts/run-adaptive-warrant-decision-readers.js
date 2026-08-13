#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { validateAdaptiveWarrantSemanticPreflightArtifact } from '../services/adaptiveWarrantSemanticPreflight.js';
import {
  ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
  ADAPTIVE_WARRANT_ANNOTATION_COLLECTION_MANIFEST_SCHEMA,
  validateAdaptiveWarrantAnnotationAuthorizationRequest,
} from './prepare-adaptive-warrant-annotation-batches.js';
import { ADAPTIVE_WARRANT_V3_SEMANTIC_DIAGNOSTIC_FREEZE_SCHEMA } from './build-adaptive-warrant-v3-semantic-diagnostic.js';

export const ADAPTIVE_WARRANT_DECISION_READER_RUN_SCHEMA =
  'machinespirits.adaptation-refinement.decision-reader-run.v1';
const MAXIMUM_FAILED_ATTEMPT_ALLOWANCE = 12;

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

function validateFreeze({ freeze, manifest, repoRoot, resume }) {
  const diagnostic = freeze.schema === ADAPTIVE_WARRANT_V3_SEMANTIC_DIAGNOSTIC_FREEZE_SCHEMA;
  const natural = freeze.schema === 'machinespirits.adaptation-refinement.warrant-mechanism-validation-freeze.v1';
  if ((!diagnostic && !natural) || freeze.status !== 'frozen') {
    throw new Error('decision reader launch requires a V3 diagnostic or representative freeze');
  }
  const frozenHandbook = diagnostic ? freeze.decision_handbook : freeze.annotation_handbook;
  if (
    freeze.study_id !== manifest.study_id ||
    freeze.corpus.sha256 !== manifest.corpus.sha256 ||
    frozenHandbook?.sha256 !== manifest.handbook.sha256
  ) {
    throw new Error('decision collection does not bind its frozen corpus and handbook');
  }
  if (
    (diagnostic && manifest.corpus_role !== 'targeted_challenge') ||
    (natural && manifest.corpus_role !== 'natural_prevalence')
  ) {
    throw new Error('decision collection role does not match its freeze');
  }
  const sourceCommit = freeze.source_commit || freeze.provenance?.gitCommit;
  const commit = gitValue(['rev-parse', 'HEAD'], repoRoot);
  const status = gitValue(['status', '--short'], repoRoot);
  if ((!resume && commit !== sourceCommit) || manifest.source_commit !== sourceCommit || status) {
    throw new Error('decision reader launch requires the exact clean frozen commit');
  }
  const preflightBinding = diagnostic ? freeze.brittleness_preflight : freeze.semantic_instrument?.preflight;
  if (!preflightBinding?.path || fileSha256(preflightBinding.path) !== preflightBinding.sha256) {
    throw new Error('decision reader brittleness preflight drift');
  }
  const preflight = readJson(preflightBinding.path);
  if (resume) {
    if (preflight.bindings?.source_commit !== sourceCommit) {
      throw new Error('decision reader brittleness preflight launch stamp drift');
    }
  } else {
    validateAdaptiveWarrantSemanticPreflightArtifact({ artifact: preflight, expectedSourceCommit: commit });
  }
  if (manifest.semantic_brittleness_preflight?.sha256 !== preflightBinding.sha256) {
    throw new Error('decision collection does not bind the frozen brittleness preflight');
  }
  const frozenBindings = diagnostic
    ? [
        freeze.design,
        freeze.corpus,
        freeze.handbook,
        freeze.decision_handbook,
        freeze.private_key,
        freeze.private_support_plan,
      ]
    : [freeze.protocol, freeze.corpus, freeze.annotation_handbook, freeze.key, freeze.study_plan];
  for (const binding of frozenBindings) {
    if (!binding?.path || fileSha256(binding.path) !== binding.sha256) {
      throw new Error('V3 diagnostic freeze artifact drift');
    }
  }
  return { commit, sourceCommit };
}

function parseJsonObject(text, batchId) {
  try {
    const value = JSON.parse(String(text || '').trim());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value;
  } catch (error) {
    throw new Error(`${batchId} returned invalid JSON: ${error.message}`);
  }
}

export async function runAdaptiveWarrantDecisionReaders({
  manifestPath,
  freezeManifestPath,
  authorizationRequestPath,
  outputDir,
  approvedBy,
  effort = 'medium',
  resume = false,
  callModel = callAIWithCliBridge,
} = {}) {
  const resolvedManifest = path.resolve(manifestPath);
  const resolvedFreeze = path.resolve(freezeManifestPath);
  const resolvedRequest = path.resolve(authorizationRequestPath);
  const resolvedOutput = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length && !resume) {
    throw new Error(`decision reader run output is not empty: ${resolvedOutput}`);
  }
  fs.mkdirSync(resolvedOutput, { recursive: true });
  const manifest = readJson(resolvedManifest);
  if (
    manifest.schema !== ADAPTIVE_WARRANT_ANNOTATION_COLLECTION_MANIFEST_SCHEMA ||
    manifest.status !== 'prepared' ||
    !['targeted_challenge', 'natural_prevalence'].includes(manifest.corpus_role)
  ) {
    throw new Error('decision reader collection manifest is not a prepared targeted challenge');
  }
  const freeze = readJson(resolvedFreeze);
  const request = readJson(resolvedRequest);
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { commit } = validateFreeze({ freeze, manifest, repoRoot, resume });
  const authorizationValidation = validateAdaptiveWarrantAnnotationAuthorizationRequest({
    requestPath: resolvedRequest,
    manifestPath: resolvedManifest,
  });
  if (request.destination !== 'OpenAI Codex CLI (ChatGPT-account route)' || request.model !== 'codex.gpt-5.6-luna') {
    throw new Error('decision readers require the frozen Luna ChatGPT-account route');
  }
  if (!approvedBy?.trim()) throw new Error('decision reader launch requires a recorded standing authorization');
  const authorization = {
    schema: 'machinespirits.adaptation-refinement.decision-reader-authorization-acceptance.v1',
    status: 'approved',
    approval_digest: authorizationValidation.approval_digest,
    request_path: resolvedRequest,
    request_sha256: fileSha256(resolvedRequest),
    approved_by: approvedBy.trim(),
    approved_at: new Date().toISOString(),
  };
  const runPath = path.join(resolvedOutput, 'decision-reader-run.json');
  const freshRun = {
    schema: ADAPTIVE_WARRANT_DECISION_READER_RUN_SCHEMA,
    status: 'running',
    study_id: manifest.study_id,
    source_commit: freeze.source_commit || freeze.provenance?.gitCommit,
    authorization,
    model: request.model,
    destination: request.destination,
    call_budget: request.call_budget,
    calls_attempted: 0,
    calls_completed: 0,
    exposed_sample_ids: [],
    batches: [],
  };
  const run = resume ? readJson(runPath) : freshRun;
  if (
    run.study_id !== freshRun.study_id ||
    run.source_commit !== freshRun.source_commit ||
    run.authorization?.approval_digest !== authorization.approval_digest ||
    !['running', 'incomplete_model_call_failure', 'incomplete_call_budget_exhausted'].includes(run.status)
  ) {
    throw new Error('decision reader resume checkpoint does not match the frozen launch');
  }
  if (resume) run.resumed_at_commits = [...new Set([...(run.resumed_at_commits || []), commit])];
  run.status = 'running';
  run.exposed_sample_ids ||= [];
  if (!resume) atomicWriteJson(path.join(resolvedOutput, 'accepted-authorization.json'), authorization);
  atomicWriteJson(runPath, run);
  for (const reader of manifest.readers) {
    for (const batch of reader.batches) {
      const completed = run.batches.find(
        (row) => row.reader_id === reader.reader_id && row.batch_id === batch.batch_id && row.status === 'complete',
      );
      if (completed) {
        if (!completed.response_path || fileSha256(completed.response_path) !== completed.response_sha256) {
          throw new Error(`${batch.batch_id} completed checkpoint response drift`);
        }
        continue;
      }
      if (run.calls_attempted >= request.call_budget.maximum_calls + MAXIMUM_FAILED_ATTEMPT_ALLOWANCE) {
        run.status = 'incomplete_call_budget_exhausted';
        atomicWriteJson(runPath, run);
        throw new Error('decision reader call budget exhausted');
      }
      const packet = readJson(batch.packet_path);
      const outputSchema = readJson(batch.output_schema_path);
      run.calls_attempted += 1;
      run.exposed_sample_ids = [...new Set([...run.exposed_sample_ids, ...batch.required_sample_ids])].sort();
      atomicWriteJson(runPath, run);
      const started = Date.now();
      try {
        const result = await callModel(
          { provider: 'codex', model: 'gpt-5.6-luna' },
          'You are one isolated independent research reader. Use only the supplied frozen packet. Return exactly the schema-bound JSON object and do not use tools.',
          JSON.stringify(packet),
          `adaptive-warrant-${reader.reader_id}-${batch.batch_id}`,
          {
            outputSchema,
            effort,
            timeoutMs: 600_000,
            maxStdoutBytes: 512_000,
            maxStderrBytes: 64_000,
          },
        );
        const parsed = parseJsonObject(result.text, batch.batch_id);
        exactFields(parsed, BATCH_FIELDS, `${batch.batch_id} model response`);
        if (
          parsed.schema !== ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA ||
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
          output_schema_sha256: batch.output_schema_sha256,
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
          output_schema_sha256: batch.output_schema_sha256,
          latency_ms: Date.now() - started,
          error: error.message,
          exposed_sample_ids: [...batch.required_sample_ids],
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
  return 'Usage: node scripts/run-adaptive-warrant-decision-readers.js --manifest <collection> --freeze-manifest <freeze> --authorization-request <request> --out <dir> --approved-by <standing-authorization-record> [--effort medium] [--resume]\n';
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
      resume: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(usage());
    return;
  }
  const result = await runAdaptiveWarrantDecisionReaders({
    manifestPath: values.manifest,
    freezeManifestPath: values['freeze-manifest'],
    authorizationRequestPath: values['authorization-request'],
    outputDir: values.out,
    approvedBy: values['approved-by'],
    effort: values.effort || 'medium',
    resume: values.resume,
  });
  process.stdout.write(`${result.runPath}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`[decision-readers] error: ${error.message}`);
    process.exitCode = 1;
  });
}
