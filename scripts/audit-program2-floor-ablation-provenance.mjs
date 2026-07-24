#!/usr/bin/env node
// Read-only artifact and serving-pin audit for the Program 2 committee floor
// ablation. `ollama show` reads metadata only; this script makes no inference
// and no provider call.
//
// Usage:
//   node scripts/audit-program2-floor-ablation-provenance.mjs <run-root> \
//     --json <run-root>/provenance-audit.json

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { PROGRAM2_COMMITTEE_DEFAULTS } from '../services/program2CommitteeEngine.js';
import { selectAuthoritativeTraces } from './analyze-program2-floor-ablation-mediation.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export const PROVENANCE_SPEC = Object.freeze({
  schema: 'machinespirits.program2.floor-ablation-provenance-audit.v1',
  trainedModel: 'program2-sft-instruct-v2',
  untunedModel: 'program2-floor-instruct-q8',
  expectedTemplate: '{{ .Prompt }}',
  expectedFamily: 'qwen35',
  expectedQuantization: 'Q8_0',
  greedy: Object.freeze({ temperature: 0, numCtx: 16384, maxTokens: 4096, think: false }),
  sampled: Object.freeze({ temperature: 0.35, numCtx: 16384, maxTokens: 4096, think: false }),
  phase4Manifest: 'config/adaptive-tutor-evidence/program-2-phase4-results.manifest.json',
  phase5cManifest: 'config/adaptive-tutor-evidence/program-2-phase5c.manifest.json',
  reports: Object.freeze({
    program2FloorInstructQ8: 'floor-instruct-q8-ollama.json',
    program2SftInstructV2: 'tuned-sft-instruct-v2-q8-ollama.json',
  }),
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function check(id, pass, detail, required = true) {
  return { id, pass: Boolean(pass), required, detail };
}

function blobPath(digest) {
  return path.join(os.homedir(), '.ollama/models/blobs', String(digest).replace(':', '-'));
}

function layerByType(manifest, suffix) {
  return manifest.layers.find((layer) => layer.mediaType.endsWith(suffix)) || null;
}

function readSmallBlob(layer) {
  if (!layer) return null;
  const file = blobPath(layer.digest);
  if (!fs.existsSync(file)) return null;
  const bytes = fs.readFileSync(file);
  return { file, bytes: bytes.length, sha256: sha256(bytes), text: bytes.toString('utf8') };
}

function runOllamaShow(model, flag = null) {
  const args = ['show', model];
  if (flag) args.push(flag);
  const result = spawnSync('ollama', args, { encoding: 'utf8', timeout: 30_000 });
  if (result.status !== 0) {
    throw new Error(`ollama ${args.join(' ')} failed: ${String(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

export function readOllamaModelMetadata(model) {
  const manifestFile = path.join(
    os.homedir(),
    '.ollama/models/manifests/registry.ollama.ai/library',
    model,
    'latest',
  );
  if (!fs.existsSync(manifestFile)) throw new Error(`${model}: Ollama manifest not found at ${manifestFile}`);
  const manifestBytes = fs.readFileSync(manifestFile);
  const manifest = JSON.parse(manifestBytes);
  const configFile = blobPath(manifest.config.digest);
  const configBytes = fs.readFileSync(configFile);
  const config = JSON.parse(configBytes);
  const modelLayer = layerByType(manifest, '.model');
  const templateLayer = layerByType(manifest, '.template');
  const paramsLayer = layerByType(manifest, '.params');
  const systemLayer = layerByType(manifest, '.system');
  const templateBlob = readSmallBlob(templateLayer);
  const paramsBlob = readSmallBlob(paramsLayer);
  const systemBlob = readSmallBlob(systemLayer);
  const modelBlob = modelLayer ? blobPath(modelLayer.digest) : null;
  const modelfile = runOllamaShow(model, '--modelfile');
  const fromMatch = modelfile.match(/^FROM\s+.*?(sha256[-:]\w+)/mu);
  const fromDigest = fromMatch ? fromMatch[1].replace('sha256-', 'sha256:') : null;
  return {
    name: model,
    manifest: {
      file: manifestFile,
      sha256: sha256(manifestBytes),
      configDigest: manifest.config.digest,
      modelLayerDigest: modelLayer?.digest || null,
      modelLayerBytes: modelLayer?.size || null,
      modelBlobExists: Boolean(modelBlob && fs.existsSync(modelBlob)),
      modelBlobBytes: modelBlob && fs.existsSync(modelBlob) ? fs.statSync(modelBlob).size : null,
      templateDigest: templateLayer?.digest || null,
      paramsDigest: paramsLayer?.digest || null,
      systemDigest: systemLayer?.digest || null,
    },
    config: {
      sha256: sha256(configBytes),
      modelFormat: config.model_format || null,
      family: config.model_family || null,
      type: config.model_type || null,
      quantization: config.file_type || null,
      renderer: config.renderer || null,
      parser: config.parser || null,
    },
    template: templateBlob?.text ?? null,
    system: systemBlob?.text ?? '',
    parameters: paramsBlob ? JSON.parse(paramsBlob.text) : null,
    modelfile: {
      fromDigest,
      sha256: sha256(modelfile),
      text: modelfile,
    },
    showSummary: runOllamaShow(model),
  };
}

function flagValue(command, flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
}

function traceServingEvidence(selection) {
  const firstDrafts = [];
  const resamples = [];
  const momentModels = [];
  for (const selected of selection.jobs) {
    for (const trace of selected.traces) {
      for (const event of trace.events) {
        if (event.type === 'program2_committee_moment' && event.moment) {
          momentModels.push({
            condition: selected.job.condition,
            jobId: selected.job.id,
            trace: trace.relative,
            turn: event.turn,
            model: event.moment.miniModel || null,
          });
        }
        if (event.type !== 'model_call') continue;
        if (String(event.role || '').endsWith('_committee_mini')) {
          firstDrafts.push({
            jobId: selected.job.id,
            trace: trace.relative,
            turn: event.turn,
            model: event.model,
            config: event.request?.config || null,
          });
        }
        if (String(event.role || '').endsWith('_committee_mini_resample')) {
          resamples.push({
            jobId: selected.job.id,
            trace: trace.relative,
            turn: event.turn,
            model: event.model,
            config: event.request?.config || null,
          });
        }
      }
    }
  }
  return { firstDrafts, resamples, momentModels };
}

function fileEvidence(file, expectedHash) {
  const bytes = fs.readFileSync(file);
  const actualHash = sha256(bytes);
  const document = JSON.parse(bytes);
  return {
    file,
    expectedSha256: expectedHash,
    actualSha256: actualHash,
    hashMatches: actualHash === expectedHash,
    model: document.model || null,
    schema: document.schema || null,
  };
}

export function validateProvenanceEvidence({ models, reports, traceEvidence, selection, sourceContract, phase5c }) {
  const trained = models[PROVENANCE_SPEC.trainedModel];
  const untuned = models[PROVENANCE_SPEC.untunedModel];
  const checks = [];
  checks.push(
    check('distinct_model_layer_digests', trained.manifest.modelLayerDigest !== untuned.manifest.modelLayerDigest, {
      trained: trained.manifest.modelLayerDigest,
      untuned: untuned.manifest.modelLayerDigest,
    }),
    check('distinct_config_digests', trained.manifest.configDigest !== untuned.manifest.configDigest, {
      trained: trained.manifest.configDigest,
      untuned: untuned.manifest.configDigest,
    }),
  );
  for (const model of [trained, untuned]) {
    checks.push(
      check(`${model.name}:model_blob_size`, model.manifest.modelBlobExists && model.manifest.modelBlobBytes === model.manifest.modelLayerBytes, {
        expected: model.manifest.modelLayerBytes,
        actual: model.manifest.modelBlobBytes,
      }),
      check(`${model.name}:modelfile_from_digest`, model.modelfile.fromDigest === model.manifest.modelLayerDigest, {
        from: model.modelfile.fromDigest,
        manifest: model.manifest.modelLayerDigest,
      }),
      check(`${model.name}:template`, model.template === PROVENANCE_SPEC.expectedTemplate, {
        expected: PROVENANCE_SPEC.expectedTemplate,
        actual: model.template,
      }),
      check(`${model.name}:system_empty`, model.system === '', { bytes: model.system.length }),
      check(`${model.name}:family`, model.config.family === PROVENANCE_SPEC.expectedFamily, model.config.family),
      check(`${model.name}:quantization`, model.config.quantization === PROVENANCE_SPEC.expectedQuantization, model.config.quantization),
    );
  }
  checks.push(
    check('shared_template_digest', trained.manifest.templateDigest === untuned.manifest.templateDigest, {
      trained: trained.manifest.templateDigest,
      untuned: untuned.manifest.templateDigest,
    }),
    check('shared_parameter_digest', trained.manifest.paramsDigest === untuned.manifest.paramsDigest, {
      trained: trained.manifest.paramsDigest,
      untuned: untuned.manifest.paramsDigest,
    }),
  );
  for (const report of Object.values(reports)) {
    checks.push(
      check(`phase4_report_hash:${path.basename(report.file)}`, report.hashMatches, {
        expected: report.expectedSha256,
        actual: report.actualSha256,
      }),
    );
  }
  checks.push(
    check('phase4_report_model:trained', reports.trained.model === PROVENANCE_SPEC.trainedModel, reports.trained.model),
    check('phase4_report_model:untuned', reports.untuned.model === PROVENANCE_SPEC.untunedModel, reports.untuned.model),
    check(
      'phase5c_verified_merge_label',
      String(phase5c.runtime?.artifact || '').includes(PROVENANCE_SPEC.trainedModel) &&
        /verified-merge SFT, q8_0/iu.test(String(phase5c.runtime?.artifact || '')),
      phase5c.runtime?.artifact || null,
    ),
  );
  const expectedByCondition = {
    trained_committee: PROVENANCE_SPEC.trainedModel,
    untuned_committee: PROVENANCE_SPEC.untunedModel,
  };
  const momentMismatches = traceEvidence.momentModels.filter(
    (entry) => expectedByCondition[entry.condition] && entry.model !== expectedByCondition[entry.condition],
  );
  checks.push(check('trace_model_routing', momentMismatches.length === 0 && traceEvidence.momentModels.length > 0, {
    observed: traceEvidence.momentModels.length,
    mismatches: momentMismatches,
  }));
  const planMismatches = selection.jobs
    .filter((entry) => expectedByCondition[entry.job.condition])
    .filter(
      (entry) =>
        flagValue(entry.job.command || [], '--committee-mini-model') !== expectedByCondition[entry.job.condition] ||
        flagValue(entry.job.command || [], '--committee-ollama-url') !== PROGRAM2_COMMITTEE_DEFAULTS.ollamaUrl,
    )
    .map((entry) => entry.job.id);
  checks.push(check('launch_plan_model_and_url_pins', planMismatches.length === 0, planMismatches));
  const greedyMismatches = traceEvidence.firstDrafts.filter((entry) => {
    const config = entry.config || {};
    return (
      config.temperature !== PROVENANCE_SPEC.greedy.temperature ||
      config.numCtx !== PROVENANCE_SPEC.greedy.numCtx ||
      config.maxTokens !== PROVENANCE_SPEC.greedy.maxTokens ||
      config.think !== PROVENANCE_SPEC.greedy.think
    );
  });
  checks.push(check('greedy_trace_serving_pin', traceEvidence.firstDrafts.length > 0 && greedyMismatches.length === 0, {
    observed: traceEvidence.firstDrafts.length,
    mismatches: greedyMismatches,
  }));
  const sampleMismatches = traceEvidence.resamples.filter(
    (entry) => entry.config?.temperature !== PROVENANCE_SPEC.sampled.temperature,
  );
  checks.push(check('sampled_trace_temperature_pin', traceEvidence.resamples.length > 0 && sampleMismatches.length === 0, {
    observed: traceEvidence.resamples.length,
    mismatches: sampleMismatches,
  }));
  checks.push(
    check('source_native_api_chat', sourceContract.nativeApiChat, sourceContract),
    check('source_think_false', sourceContract.thinkFalse, sourceContract),
    check('source_num_ctx_pin', sourceContract.numCtx, sourceContract),
    check('source_num_predict_pin', sourceContract.numPredict, sourceContract),
    check('source_sample_temperature_pin', sourceContract.sampleTemperature, sourceContract),
  );
  return checks;
}

function sourceContractEvidence() {
  const engine = fs.readFileSync(path.join(REPO_ROOT, 'services/program2CommitteeEngine.js'), 'utf8');
  const tutor = fs.readFileSync(path.join(REPO_ROOT, 'scripts/tutor-stub.js'), 'utf8');
  return {
    nativeApiChat: /\/api\/chat/u.test(engine),
    thinkFalse: /think:\s*false/u.test(engine),
    numCtx: /num_ctx:\s*numCtx/u.test(engine),
    numPredict: /num_predict:\s*maxTokens/u.test(engine),
    sampleTemperature: /temperature:\s*0\.35/u.test(tutor),
    engineSha256: sha256(engine),
    tutorStubSha256: sha256(tutor),
  };
}

export function auditProvenance(root) {
  const selection = selectAuthoritativeTraces(root);
  const phase4Path = path.join(REPO_ROOT, PROVENANCE_SPEC.phase4Manifest);
  const phase4 = JSON.parse(fs.readFileSync(phase4Path, 'utf8'));
  const phase5cPath = path.join(REPO_ROOT, PROVENANCE_SPEC.phase5cManifest);
  const phase5c = JSON.parse(fs.readFileSync(phase5cPath, 'utf8'));
  const floorDir = phase4.floorDir;
  const reports = {
    trained: fileEvidence(
      path.join(floorDir, PROVENANCE_SPEC.reports.program2SftInstructV2),
      phase4.files[PROVENANCE_SPEC.reports.program2SftInstructV2],
    ),
    untuned: fileEvidence(
      path.join(floorDir, PROVENANCE_SPEC.reports.program2FloorInstructQ8),
      phase4.files[PROVENANCE_SPEC.reports.program2FloorInstructQ8],
    ),
  };
  const models = {
    [PROVENANCE_SPEC.trainedModel]: readOllamaModelMetadata(PROVENANCE_SPEC.trainedModel),
    [PROVENANCE_SPEC.untunedModel]: readOllamaModelMetadata(PROVENANCE_SPEC.untunedModel),
  };
  const traceEvidence = traceServingEvidence(selection);
  const sourceContract = sourceContractEvidence();
  const checks = validateProvenanceEvidence({ models, reports, traceEvidence, selection, sourceContract, phase5c });
  const failures = checks.filter((entry) => entry.required && !entry.pass);
  return {
    schema: PROVENANCE_SPEC.schema,
    generatedAt: new Date().toISOString(),
    mode: 'read_only_local_metadata_no_inference',
    status: failures.length ? 'fail' : 'pass',
    checks,
    failures,
    models,
    servingPin: {
      expected: { greedy: PROVENANCE_SPEC.greedy, sampled: PROVENANCE_SPEC.sampled },
      traceEvidence,
      sourceContract,
    },
    lineage: {
      phase4Manifest: { file: phase4Path, sha256: sha256(fs.readFileSync(phase4Path)) },
      phase5cManifest: { file: phase5cPath, sha256: sha256(fs.readFileSync(phase5cPath)) },
      reports,
      limitation:
        'The checked-in Phase 4 manifest pins the evaluation reports, while Ollama exposes the currently served GGUF layer digests. No separate surviving cloud merge manifest directly binds those two digest namespaces; the verified-merge label and exact report hashes are the strongest retained bridge.',
    },
  };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { json: { type: 'string' } },
  });
  const root = path.resolve(
    positionals[0] || path.join(REPO_ROOT, 'exports/program2-committee-floor-ablation-amendment-4'),
  );
  const artifact = auditProvenance(root);
  if (values.json) fs.writeFileSync(path.resolve(values.json), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[floor-provenance] ${artifact.status}: ${artifact.checks.length - artifact.failures.length}/${artifact.checks.length} checks passed`);
  for (const failure of artifact.failures) console.error(`[floor-provenance] FAIL ${failure.id}: ${JSON.stringify(failure.detail)}`);
  for (const model of Object.values(artifact.models)) {
    console.log(`[floor-provenance] ${model.name}: ${model.manifest.modelLayerDigest} ${model.config.type} ${model.config.quantization}`);
  }
  if (values.json) console.log(`[floor-provenance] wrote ${values.json}`);
  if (artifact.status !== 'pass') process.exitCode = 1;
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[floor-provenance] ${error.stack || error.message}`);
    process.exit(1);
  }
}
