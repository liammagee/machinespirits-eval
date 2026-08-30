#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { resolveModel } from '../services/evalConfigLoader.js';
import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import { dispatchTutorStubCliBridgeRequest } from '../services/tutorStubCliRequest.js';
import {
  buildTutorStubFrameRefuserNarrowingPlan,
  buildTutorStubFrameRefuserNarrowingReaderPrompt,
  evaluateTutorStubFrameRefuserNarrowingReaderResponse,
  loadTutorStubFrameRefuserNarrowingDesign,
  summarizeTutorStubFrameRefuserNarrowingCalibration,
} from '../services/tutorStubFrameRefuserNarrowingCalibration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TUTOR_STUB_FRAME_REFUSER_NARROWING_USAGE = `Usage:
  node scripts/run-tutor-stub-frame-refuser-narrowing-calibration.js \
    --design config/tutor-stub-frame-refuser-narrowing-calibration-design.v1.json \
    --archive-root /absolute/path/to/private-archive \
    --destination /absolute/create-once/private-archive/artifacts/tutor-stub-live/run-name \
    --dry-run

  node scripts/run-tutor-stub-frame-refuser-narrowing-calibration.js \
    --design config/tutor-stub-frame-refuser-narrowing-calibration-design.v1.json \
    --archive-root /absolute/path/to/private-archive \
    --destination /absolute/create-once/private-archive/artifacts/tutor-stub-live/run-name \
    --launch-commit <merged-detached-commit> \
    --go-note-commit <commit-containing-signed-note> \
    --go-note-path notes/<signed-go-note>.md \
    --accept-charges

--dry-run verifies the design, sealed archive bytes, exact 24-row sample, model
routes, and 72-attempt ceiling without writing files or calling a model. The paid
path uses the shared standing launch contract and makes exactly one non-retried
request for each of three independent reader seats on each sampled row.`;

function repositoryRelative(root, value, label) {
  if (!value || path.isAbsolute(value)) throw new Error(`${label} must be repository-relative`);
  const absolute = path.resolve(root, value);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the repository`);
  }
  return relative.split(path.sep).join('/');
}

function assertArchiveDestination({ archiveRoot, destination }) {
  if (!path.isAbsolute(archiveRoot) || !path.isAbsolute(destination)) {
    throw new Error('archive root and destination must be absolute');
  }
  const liveRoot = path.resolve(archiveRoot, 'artifacts/tutor-stub-live');
  const relative = path.relative(liveRoot, destination);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('destination must be a new child of the private archive artifacts/tutor-stub-live directory');
  }
  if (fs.existsSync(destination)) throw new Error('paid study destination is create-once');
}

function writeOnce(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function admitWithStandingContract(input) {
  return admitPaidStudyLaunch(input);
}

function normalizeBridgeResponse(result) {
  return {
    text: result?.text ?? '',
    provider: result?.provider ?? null,
    model: result?.model ?? null,
    effort: result?.effort || result?.reasoningEffort || null,
    reasoningEffort: result?.reasoningEffort || result?.effort || null,
    latencyMs: result?.latencyMs ?? null,
    usage: {
      inputTokens: Number(result?.inputTokens || 0),
      outputTokens: Number(result?.outputTokens || 0),
      totalTokens: Number(result?.inputTokens || 0) + Number(result?.outputTokens || 0),
      cost: Number(result?.cost || 0),
    },
    structuredOutput: result?.structuredOutput === true,
    prohibitedToolEventCount: Number(result?.prohibitedToolEventCount || 0),
    prohibitedToolEventCountObserved:
      Object.hasOwn(result || {}, 'prohibitedToolEventCount') && Number.isInteger(result.prohibitedToolEventCount),
    modelAttestationBasis: result?.modelAttestationBasis || null,
  };
}

function resolveReaderSeats(design, resolve = resolveModel) {
  return design.readers.seats.map((seat) => {
    const resolved = resolve(seat.modelRef);
    if (resolved.provider !== seat.provider || resolved.model !== seat.model || resolved.isConfigured !== true) {
      throw new Error(
        `reader route drift for ${seat.id}: expected ${seat.provider}/${seat.model}, found ${resolved.provider}/${resolved.model}`,
      );
    }
    return { ...seat, resolved: { provider: resolved.provider, model: resolved.model } };
  });
}

export function prepareTutorStubFrameRefuserNarrowingCalibration({
  root = ROOT,
  designPath,
  archiveRoot,
  destination,
  resolve = resolveModel,
  verifyCommittedFile,
} = {}) {
  if (!archiveRoot || !path.isAbsolute(archiveRoot) || !destination || !path.isAbsolute(destination)) {
    throw new Error('archive root and destination must be absolute');
  }
  const relativeDesignPath = repositoryRelative(root, designPath, 'design path');
  const privateArchiveRoot = path.resolve(archiveRoot);
  const runDestination = path.resolve(destination);
  assertArchiveDestination({ archiveRoot: privateArchiveRoot, destination: runDestination });
  const loaded = loadTutorStubFrameRefuserNarrowingDesign({ root, designPath: relativeDesignPath });
  const readers = resolveReaderSeats(loaded.design, resolve);
  const plan = buildTutorStubFrameRefuserNarrowingPlan({
    loaded,
    archiveRoot: privateArchiveRoot,
    ...(verifyCommittedFile ? { verifyCommittedFile } : {}),
  });
  if (plan.planned_model_calls !== readers.length * plan.cases.length) {
    throw new Error('narrowing plan does not close to the registered reader-call count');
  }
  if (plan.hard_attempt_ceiling !== loaded.design.attemptCeiling.maximumAttempts) {
    throw new Error('narrowing plan attempt ceiling drift');
  }
  return {
    status: 'passed_zero_call',
    design: { path: loaded.relativePath, sha256: loaded.sha256 },
    private_archive_commit: loaded.design.source.privateArchiveCommit,
    destination: runDestination,
    sample_size: plan.cases.length,
    readers: readers.map(({ resolved: _resolved, ...seat }) => seat),
    planned_model_calls: plan.planned_model_calls,
    hard_attempt_ceiling: plan.hard_attempt_ceiling,
    model_calls_executed: 0,
    plan,
    loaded,
    resolvedReaders: readers,
    archiveRoot: privateArchiveRoot,
  };
}

export async function executeTutorStubFrameRefuserNarrowingCalibration({
  preflight,
  admission,
  callBridge = callAIWithCliBridge,
  summarize = summarizeTutorStubFrameRefuserNarrowingCalibration,
  progress = (line) => process.stdout.write(`${line}\n`),
} = {}) {
  const { destination, loaded, plan, resolvedReaders } = preflight;
  fs.mkdirSync(path.join(destination, 'results'), { recursive: false });
  writeOnce(path.join(destination, 'plan.json'), {
    ...plan,
    status: 'admitted_under_shared_paid_study_launch_contract',
    source: { ...plan.source, launch: admission.source },
    authorization: admission.authorization,
  });

  const records = [];
  let attemptedCalls = 0;
  try {
    for (const caseEntry of plan.cases) {
      for (const seat of resolvedReaders) {
        const unit = `${caseEntry.case_id}/${seat.id}`;
        const prompt = buildTutorStubFrameRefuserNarrowingReaderPrompt({
          instrumentText: loaded.instrumentText,
          caseId: caseEntry.case_id,
          publicPacket: caseEntry.public_packet,
        });
        admission.reserveModelAttempts(1, { unit, case_id: caseEntry.case_id, seat_id: seat.id });
        attemptedCalls += 1;
        let response;
        try {
          const raw = await dispatchTutorStubCliBridgeRequest(callBridge, {
            resolved: seat.resolved,
            systemPrompt: prompt.system_prompt,
            userPrompt: prompt.user_prompt,
            role: `frame_refuser_narrowing_${seat.id}`,
            effort: seat.effort,
            outputSchema: prompt.output_schema,
          });
          response = normalizeBridgeResponse(raw);
        } catch (error) {
          const failure = {
            schema: 'machinespirits.tutor-stub.frame-refuser-narrowing-calibration-failure.v1',
            status: 'transport_failure',
            unit,
            case_id: caseEntry.case_id,
            seat_id: seat.id,
            attempted_calls: attemptedCalls,
            reserved_calls: admission.reserved,
            hard_attempt_ceiling: plan.hard_attempt_ceiling,
            error: error.message,
          };
          writeOnce(path.join(destination, 'failure.json'), failure);
          admission.record({ type: 'reader_transport_failure', ...failure });
          admission.close({ type: 'run_sealed', status: 'transport_failure', unit, attempted_calls: attemptedCalls });
          throw error;
        }
        const measurement = evaluateTutorStubFrameRefuserNarrowingReaderResponse({ response, seat, prompt });
        const record = {
          schema: 'machinespirits.tutor-stub.frame-refuser-narrowing-reader-result.v1',
          case_id: caseEntry.case_id,
          seat_id: seat.id,
          route: { model_ref: seat.modelRef, provider: seat.provider, model: seat.model, effort: seat.effort },
          packet_sha256: caseEntry.packet_sha256,
          response,
          measurement,
        };
        records.push(record);
        writeOnce(path.join(destination, 'results', `${caseEntry.case_id}--${seat.id}.json`), record);
        admission.record({
          type: 'reader_call_complete',
          unit,
          case_id: caseEntry.case_id,
          seat_id: seat.id,
          eligible: measurement.eligible,
          issues: measurement.issues,
          attempted_calls: attemptedCalls,
          reserved_calls: admission.reserved,
        });
        progress(
          `completed ${records.length}/${plan.planned_model_calls}; attempts ${attemptedCalls}/${plan.hard_attempt_ceiling}; ${unit} ${measurement.eligible ? 'eligible' : 'ineligible'}`,
        );
      }
    }
    const report = {
      ...summarize({ plan, records, design: loaded.design }),
      execution: {
        complete_units: records.length,
        eligible_units: records.filter((entry) => entry.measurement.eligible).length,
        failed_units: 0,
        missing_units: plan.planned_model_calls - records.length,
        attempted_model_calls: attemptedCalls,
        reserved_model_calls: admission.reserved,
        model_attempt_ceiling: plan.hard_attempt_ceiling,
        source_commit: admission.source.commit,
        source_tree: admission.source.tree,
      },
    };
    writeOnce(path.join(destination, 'report.json'), report);
    admission.close({
      type: 'run_sealed',
      status: report.status,
      complete_units: records.length,
      eligible_units: report.execution.eligible_units,
      attempted_calls: attemptedCalls,
      reserved_calls: admission.reserved,
    });
    progress(`${report.status}: ${path.join(destination, 'report.json')}`);
    return report;
  } catch (error) {
    if (!fs.existsSync(path.join(destination, 'failure.json'))) {
      const failure = {
        schema: 'machinespirits.tutor-stub.frame-refuser-narrowing-calibration-failure.v1',
        status: 'launcher_failure',
        attempted_calls: attemptedCalls,
        reserved_calls: admission.reserved,
        hard_attempt_ceiling: plan.hard_attempt_ceiling,
        error: error.message,
      };
      writeOnce(path.join(destination, 'failure.json'), failure);
      admission.record({ type: 'launcher_failure', ...failure });
      admission.close({ type: 'run_sealed', status: 'launcher_failure', attempted_calls: attemptedCalls });
    }
    throw error;
  }
}

export async function main(argv = process.argv.slice(2), overrides = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      design: { type: 'string' },
      'archive-root': { type: 'string' },
      destination: { type: 'string' },
      'launch-commit': { type: 'string' },
      'go-note-commit': { type: 'string' },
      'go-note-path': { type: 'string' },
      'accept-charges': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(`${TUTOR_STUB_FRAME_REFUSER_NARROWING_USAGE}\n`);
    return null;
  }
  if (!values.design || !values['archive-root'] || !values.destination) {
    throw new Error(
      `--design, --archive-root, and --destination are required\n\n${TUTOR_STUB_FRAME_REFUSER_NARROWING_USAGE}`,
    );
  }
  const preflight = (overrides.prepare || prepareTutorStubFrameRefuserNarrowingCalibration)({
    root: ROOT,
    designPath: values.design,
    archiveRoot: values['archive-root'],
    destination: values.destination,
    ...(overrides.resolve ? { resolve: overrides.resolve } : {}),
    ...(overrides.verifyCommittedFile ? { verifyCommittedFile: overrides.verifyCommittedFile } : {}),
  });
  const publicPreflight = Object.fromEntries(
    Object.entries(preflight).filter(([key]) => !['loaded', 'resolvedReaders', 'archiveRoot', 'plan'].includes(key)),
  );
  process.stdout.write(`${JSON.stringify(publicPreflight, null, 2)}\n`);
  if (preflight.status !== 'passed_zero_call') throw new Error('narrowing zero-call preflight failed');
  if (values['dry-run']) return preflight;
  if (!values['accept-charges'] || !values['launch-commit'] || !values['go-note-commit'] || !values['go-note-path']) {
    throw new Error('paid launch requires --accept-charges, --launch-commit, --go-note-commit, and --go-note-path');
  }
  const admission = (overrides.admit || admitWithStandingContract)({
    root: ROOT,
    designPath: preflight.loaded.relativePath,
    launchCommit: values['launch-commit'],
    goNoteCommit: values['go-note-commit'],
    goNotePath: values['go-note-path'],
    spendCap: preflight.hard_attempt_ceiling,
    destination: preflight.destination,
  });
  return (overrides.execute || executeTutorStubFrameRefuserNarrowingCalibration)({
    preflight,
    admission,
    ...(overrides.callBridge ? { callBridge: overrides.callBridge } : {}),
  });
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
