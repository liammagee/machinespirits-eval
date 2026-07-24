#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  PROGRAM2_COMMITTEE_DEFAULTS,
  resolveCueBlindCommitteeDelivery,
  runCueBlindCommitteeBattery,
} from '../services/program2CommitteeEngine.js';
import { PROVENANCE_SPEC, readOllamaModelMetadata } from './audit-program2-floor-ablation-provenance.mjs';
import { selectAuthoritativeTraces } from './analyze-program2-floor-ablation-mediation.mjs';
import { WEIGHTS_INTERFACE_FACTORIAL_SPEC } from './run-program2-live-pilot.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function check(id, pass, detail, required = true) {
  return { id, pass: Boolean(pass), detail, required };
}

function flagValue(command, flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
}

function planDocument(root) {
  for (const name of ['launch-plan.json', 'zero-model-dry-run.json']) {
    const file = path.join(root, name);
    if (fs.existsSync(file)) {
      const document = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { file, plan: document.plan || document };
    }
  }
  throw new Error(`${root}: no launch-plan.json or zero-model-dry-run.json`);
}

function phase4Evidence() {
  const manifestPath = path.join(REPO_ROOT, PROVENANCE_SPEC.phase4Manifest);
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  const reports = {};
  for (const [key, name] of Object.entries(PROVENANCE_SPEC.reports)) {
    const file = path.join(manifest.floorDir, name);
    const bytes = fs.readFileSync(file);
    reports[key] = {
      file,
      expectedSha256: manifest.files[name],
      actualSha256: sha256(bytes),
      document: JSON.parse(bytes),
    };
  }
  return { manifestPath, manifestSha256: sha256(manifestBytes), reports };
}

function traceChecks(root, jobs) {
  if (!fs.existsSync(path.join(root, 'launch-state.json'))) {
    return { present: false, checks: [] };
  }
  const selection = selectAuthoritativeTraces(root);
  const expectedByJob = new Map(jobs.map((job) => [job.id, WEIGHTS_INTERFACE_FACTORIAL_SPEC.weights[job.weight]]));
  const mismatches = [];
  let firstDraftCalls = 0;
  let resampleCalls = 0;
  let moments = 0;
  for (const selected of selection.jobs) {
    for (const trace of selected.traces) {
      for (const event of trace.events) {
        if (event.type === 'model_call' && String(event.role || '').endsWith('_committee_mini')) {
          firstDraftCalls += 1;
          const config = event.request?.config || {};
          if (
            event.model !== expectedByJob.get(selected.job.id) ||
            config.temperature !== 0 ||
            config.numCtx !== 16384 ||
            config.maxTokens !== 4096 ||
            config.think !== false
          ) {
            mismatches.push({ jobId: selected.job.id, type: 'mini_call', model: event.model, config });
          }
        }
        if (event.type === 'model_call' && String(event.role || '').endsWith('_committee_mini_resample')) {
          resampleCalls += 1;
        }
        if (event.type === 'program2_committee_moment' && event.moment) {
          moments += 1;
          if (
            event.moment.miniModel !== expectedByJob.get(selected.job.id) ||
            event.moment.spanInterface !== selected.job.spanInterface ||
            event.moment.fallback?.policy !== 'cue_blind' ||
            event.moment.enforcementLedger?.cueInspectedAfterExtraction !== false ||
            event.moment.enforcementLedger?.miniResamples !== 0
          ) {
            mismatches.push({ jobId: selected.job.id, type: 'moment', turn: event.turn });
          }
        }
      }
    }
  }
  return {
    present: true,
    checks: [
      check('trace_runtime_routing_and_greedy_pin', mismatches.length === 0 && firstDraftCalls > 0, {
        firstDraftCalls,
        moments,
        mismatches,
      }),
      check('trace_no_mini_resamples', resampleCalls === 0, { resampleCalls }),
    ],
  };
}

export function auditWeightsInterfaceProvenance(root) {
  const { file: planFile, plan } = planDocument(root);
  const models = Object.fromEntries(
    Object.values(WEIGHTS_INTERFACE_FACTORIAL_SPEC.weights).map((model) => [model, readOllamaModelMetadata(model)]),
  );
  const trained = models[WEIGHTS_INTERFACE_FACTORIAL_SPEC.weights.trained];
  const untuned = models[WEIGHTS_INTERFACE_FACTORIAL_SPEC.weights.untuned];
  const phase4 = phase4Evidence();
  const checks = [
    check('plan_schema', /program2-weights-interface-(?:factorial|smoke)-plan\.v1/u.test(plan.schema), plan.schema),
    check('distinct_model_layers', trained.manifest.modelLayerDigest !== untuned.manifest.modelLayerDigest, {
      trained: trained.manifest.modelLayerDigest,
      untuned: untuned.manifest.modelLayerDigest,
    }),
    check('shared_template', trained.template === '{{ .Prompt }}' && untuned.template === '{{ .Prompt }}', {
      trained: trained.template,
      untuned: untuned.template,
    }),
    check('empty_system_layers', trained.system === '' && untuned.system === '', {
      trainedBytes: trained.system.length,
      untunedBytes: untuned.system.length,
    }),
    check('q8_serving', trained.config.quantization === 'Q8_0' && untuned.config.quantization === 'Q8_0', {
      trained: trained.config.quantization,
      untuned: untuned.config.quantization,
    }),
    check(
      'phase4_report_hashes',
      Object.values(phase4.reports).every((report) => report.expectedSha256 === report.actualSha256),
      phase4.reports,
    ),
    check(
      'phase4_report_models',
      phase4.reports.program2SftInstructV2.document.model === WEIGHTS_INTERFACE_FACTORIAL_SPEC.weights.trained &&
        phase4.reports.program2FloorInstructQ8.document.model === WEIGHTS_INTERFACE_FACTORIAL_SPEC.weights.untuned,
      {
        trained: phase4.reports.program2SftInstructV2.document.model,
        untuned: phase4.reports.program2FloorInstructQ8.document.model,
      },
    ),
  ];
  const planMismatches = plan.jobs.filter(
    (job) =>
      flagValue(job.command, '--committee-mini-model') !== WEIGHTS_INTERFACE_FACTORIAL_SPEC.weights[job.weight] ||
      flagValue(job.command, '--committee-span-interface') !== job.spanInterface ||
      flagValue(job.command, '--committee-fallback-policy') !== 'cue_blind' ||
      flagValue(job.command, '--committee-ollama-url') !== PROGRAM2_COMMITTEE_DEFAULTS.ollamaUrl,
  );
  checks.push(check('plan_treatment_and_runtime_pins', planMismatches.length === 0, planMismatches.map((job) => job.id)));
  const forbiddenDependencies = /PROGRAM2_WARRANT_CUE_RE|committeeFallbackBatteryPass|trimCommitteeFallback/u;
  checks.push(
    check(
      'cue_blind_enforcement_source',
      !forbiddenDependencies.test(runCueBlindCommitteeBattery.toString()) &&
        !forbiddenDependencies.test(resolveCueBlindCommitteeDelivery.toString()),
      { forbiddenPattern: forbiddenDependencies.source },
    ),
  );
  const traces = traceChecks(root, plan.jobs);
  checks.push(...traces.checks);
  const failures = checks.filter((entry) => entry.required && !entry.pass);
  return {
    schema: 'machinespirits.program2.weights-interface-provenance-audit.v1',
    generatedAt: new Date().toISOString(),
    mode: traces.present ? 'read_only_local_metadata_and_trace_audit' : 'read_only_prelaunch_metadata_audit',
    status: failures.length ? 'fail' : 'pass',
    plan: { file: planFile, sha256: sha256(fs.readFileSync(planFile)) },
    checks,
    failures,
    models,
    phase4,
  };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { json: { type: 'string' } },
  });
  const root = path.resolve(
    positionals[0] || path.join(REPO_ROOT, 'exports/program2-weights-interface-factorial-dry-run'),
  );
  const artifact = auditWeightsInterfaceProvenance(root);
  if (values.json) fs.writeFileSync(path.resolve(values.json), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[weights-interface-provenance] ${artifact.status}: ${artifact.checks.length - artifact.failures.length}/${artifact.checks.length}`);
  for (const failure of artifact.failures) console.error(`[weights-interface-provenance] FAIL ${failure.id}`);
  if (values.json) console.log(`[weights-interface-provenance] wrote ${values.json}`);
  if (artifact.status !== 'pass') process.exitCode = 1;
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[weights-interface-provenance] ${error.stack || error.message}`);
    process.exit(1);
  }
}
