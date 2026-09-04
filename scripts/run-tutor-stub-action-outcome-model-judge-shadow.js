#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';
import { resolveModel } from '../services/evalConfigLoader.js';
import { admitPaidStudyLaunch } from '../services/paidStudyLaunchContract.js';
import { refuseRetiredPaidLaunch } from '../services/retiredPaidLauncher.js';
import { dispatchTutorStubCliBridgeRequest } from '../services/tutorStubCliRequest.js';
import {
  buildTutorStubActionOutcomeModelJudgePlan,
  buildTutorStubActionOutcomeModelJudgePrompt,
  evaluateTutorStubActionOutcomeModelJudgeResponse,
  loadTutorStubActionOutcomeModelJudgeDesign,
  loadTutorStubActionOutcomeModelJudgeInputs,
  renderTutorStubActionOutcomeModelJudgeReport,
  summarizeTutorStubActionOutcomeModelJudge,
  TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_DESIGN_PATH,
} from '../services/tutorStubActionOutcomeModelJudge.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function admitWithStandingContract(input) {
  return admitPaidStudyLaunch(input);
}

export const TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_USAGE = `Usage:
  node scripts/run-tutor-stub-action-outcome-model-judge-shadow.js \
    --design ${TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_DESIGN_PATH} \
    --packet-root /absolute/path/to/frozen-human-packet \
    --archive-root /absolute/path/to/private-archive \
    --destination /absolute/path/to/private-archive/artifacts/tutor-stub-live/run-name \
    --dry-run

  node scripts/run-tutor-stub-action-outcome-model-judge-shadow.js \
    --design ${TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_DESIGN_PATH} \
    --packet-root /absolute/path/to/frozen-human-packet \
    --archive-root /absolute/path/to/private-archive \
    --destination /absolute/path/to/private-archive/artifacts/tutor-stub-live/run-name \
    --launch-commit <commit-to-record> \
    --go-note-commit <commit-containing-signed-note> \
    --go-note-path notes/<signed-go-note>.md \
    --accept-charges

The zero-call preflight verifies the exact 35-case packet, machine key, original
codebook, untouched human submission templates, two pinned cross-family routes,
70-call plan, and 70-attempt hard ceiling. Live execution makes one non-retried
isolated request per case and seat. Invalid or failed responses are preserved
and never replaced. Results are exploratory and cannot satisfy the registered
human gates or license the controller study.`;

function writeOnce(filePath, value) {
  const bytes = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(filePath, bytes, { flag: 'wx' });
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
  if (fs.existsSync(destination)) throw new Error('model-judge destination is create-once');
}

function resolveReaders(design, resolve = resolveModel) {
  return design.judges.seats.map((seat) => {
    const resolved = resolve(seat.modelRef);
    if (resolved.provider !== seat.provider || resolved.model !== seat.model || resolved.isConfigured !== true) {
      throw new Error(
        `judge route drift for ${seat.id}: expected ${seat.provider}/${seat.model}, found ${resolved.provider}/${resolved.model}`,
      );
    }
    return { ...seat, resolved: { provider: resolved.provider, model: resolved.model } };
  });
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

function unitKey(caseId, seatId) {
  return `${caseId}/${seatId}`;
}

function safeUnitFile(caseId, seatId) {
  return `${caseId}--${seatId}.json`;
}

export function prepareTutorStubActionOutcomeModelJudge({
  root = ROOT,
  designPath = TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_DESIGN_PATH,
  packetRoot,
  archiveRoot,
  destination,
  resolve = resolveModel,
} = {}) {
  assertArchiveDestination({ archiveRoot, destination });
  const loaded = loadTutorStubActionOutcomeModelJudgeDesign({ root, designPath });
  const inputs = loadTutorStubActionOutcomeModelJudgeInputs({ loaded, packetRoot });
  const readers = resolveReaders(loaded.design, resolve);
  const plan = buildTutorStubActionOutcomeModelJudgePlan({ loaded, inputs, readers });
  return {
    status: 'passed_zero_call',
    design: plan.design,
    source: plan.source,
    packet_root: inputs.packetRoot,
    destination: path.resolve(destination),
    readers: plan.readers,
    cases: plan.cases.length,
    planned_model_calls: plan.planned_model_calls,
    hard_attempt_ceiling: plan.hard_attempt_ceiling,
    model_calls_executed: 0,
    production_writes: 0,
    claim_boundary: loaded.design.claimBoundary,
    loaded,
    inputs,
    readersResolved: readers,
    plan,
    executionUnits: plan.executionUnits,
    archiveRoot: path.resolve(archiveRoot),
  };
}

async function executeUnit({ unit, loaded, admission, callBridge }) {
  const { caseEntry, seat } = unit;
  const key = unitKey(caseEntry.case_id, seat.id);
  const prompt = buildTutorStubActionOutcomeModelJudgePrompt({
    instrumentText: loaded.instrumentText,
    caseEntry,
  });
  admission.reserveModelAttempts(1, { unit: key, case_id: caseEntry.case_id, seat_id: seat.id });
  try {
    const raw = await dispatchTutorStubCliBridgeRequest(callBridge, {
      resolved: seat.resolved,
      systemPrompt: prompt.system_prompt,
      userPrompt: prompt.user_prompt,
      role: `action_outcome_shadow_${seat.id}`,
      effort: seat.effort,
      outputSchema: prompt.output_schema,
    });
    const response = normalizeBridgeResponse(raw);
    const measurement = evaluateTutorStubActionOutcomeModelJudgeResponse({
      response,
      seat,
      prompt,
      publicCase: caseEntry.public_case,
    });
    return {
      kind: 'record',
      key,
      prompt,
      record: {
        schema: 'machinespirits.tutor-stub.action-outcome-model-judge-shadow-record.v1',
        case_id: caseEntry.case_id,
        seat_id: seat.id,
        route: { model_ref: seat.modelRef, provider: seat.provider, model: seat.model, effort: seat.effort },
        public_case_sha256: caseEntry.public_case_sha256,
        response,
        measurement,
      },
    };
  } catch (error) {
    return {
      kind: 'failure',
      key,
      prompt,
      failure: {
        schema: 'machinespirits.tutor-stub.action-outcome-model-judge-shadow-failure.v1',
        status: 'transport_failure',
        unit: key,
        case_id: caseEntry.case_id,
        seat_id: seat.id,
        route: { model_ref: seat.modelRef, provider: seat.provider, model: seat.model, effort: seat.effort },
        error: error.message,
      },
    };
  }
}

export async function executeTutorStubActionOutcomeModelJudge({
  preflight,
  admission,
  callBridge = callAIWithCliBridge,
  progress = (line) => process.stdout.write(`${line}\n`),
} = {}) {
  refuseRetiredPaidLaunch('tutor-stub-action-outcome-model-judge-shadow');
  const { destination, loaded, inputs, plan, executionUnits } = preflight;
  const promptDirectory = path.join(destination, 'prompts');
  const resultDirectory = path.join(destination, 'results');
  const failureDirectory = path.join(destination, 'failures');
  fs.mkdirSync(promptDirectory);
  fs.mkdirSync(resultDirectory);
  fs.mkdirSync(failureDirectory);
  const publicPlan = Object.fromEntries(Object.entries(plan).filter(([key]) => key !== 'executionUnits'));
  writeOnce(path.join(destination, 'plan.json'), {
    ...publicPlan,
    status: 'admitted_under_shared_paid_study_launch_contract',
    source: { ...publicPlan.source, launch: admission.source },
    authorization: admission.authorization,
  });
  const records = [];
  const failures = [];
  const parallelism = loaded.design.judges.parallelism;
  try {
    for (let offset = 0; offset < executionUnits.length; offset += parallelism) {
      const batch = executionUnits.slice(offset, offset + parallelism);
      const completed = await Promise.all(batch.map((unit) => executeUnit({ unit, loaded, admission, callBridge })));
      for (const result of completed) {
        writeOnce(
          path.join(promptDirectory, safeUnitFile(result.prompt.case_id, result.key.split('/')[1])),
          result.prompt,
        );
        if (result.kind === 'record') {
          records.push(result.record);
          writeOnce(
            path.join(resultDirectory, safeUnitFile(result.record.case_id, result.record.seat_id)),
            result.record,
          );
          admission.record({
            type: 'model_judge_call_complete',
            unit: result.key,
            case_id: result.record.case_id,
            seat_id: result.record.seat_id,
            eligible: result.record.measurement.eligible,
            issues: result.record.measurement.issues,
          });
        } else {
          failures.push(result.failure);
          writeOnce(
            path.join(failureDirectory, safeUnitFile(result.failure.case_id, result.failure.seat_id)),
            result.failure,
          );
          admission.record({ type: 'model_judge_transport_failure', ...result.failure });
        }
      }
      progress(
        `completed ${records.length}/${plan.planned_model_calls}; failed ${failures.length}; reserved ${admission.reserved}/${plan.hard_attempt_ceiling}`,
      );
    }
    const postInputs = loadTutorStubActionOutcomeModelJudgeInputs({ loaded, packetRoot: inputs.packetRoot });
    const report = {
      ...summarizeTutorStubActionOutcomeModelJudge({
        loaded,
        plan,
        records,
        failures,
        machineKey: inputs.machineKey,
      }),
      execution: {
        completed_units: records.length,
        protocol_valid_units: records.filter((entry) => entry.measurement.eligible).length,
        failed_units: failures.length,
        missing_units: plan.planned_model_calls - records.length - failures.length,
        reserved_attempts: admission.reserved,
        hard_attempt_ceiling: plan.hard_attempt_ceiling,
        source_commit: admission.source.commit,
        source_tree: admission.source.tree,
      },
      input_integrity_after_run: {
        packet_sha256: loaded.design.source.packetSha256,
        human_submission_files_unchanged: postInputs.humanSubmissionHashes,
      },
    };
    writeOnce(path.join(destination, 'report.json'), report);
    writeOnce(path.join(destination, 'README.md'), `${renderTutorStubActionOutcomeModelJudgeReport(report)}\n`);
    admission.close({
      type: 'run_sealed',
      status: report.status,
      recovery_permitted: false,
      completed_units: records.length,
      failed_units: failures.length,
      reserved_attempts: admission.reserved,
    });
    progress(`${report.status}: ${path.join(destination, 'report.json')}`);
    return report;
  } catch (error) {
    const failure = {
      schema: 'machinespirits.tutor-stub.action-outcome-model-judge-shadow-launcher-failure.v1',
      status: 'launcher_failure',
      completed_units: records.length,
      failed_units: failures.length,
      reserved_attempts: admission.reserved,
      hard_attempt_ceiling: plan.hard_attempt_ceiling,
      error: error.message,
    };
    if (!fs.existsSync(path.join(destination, 'failure.json')))
      writeOnce(path.join(destination, 'failure.json'), failure);
    admission.record({ type: 'launcher_failure', ...failure });
    admission.close({ type: 'run_sealed', status: 'launcher_failure', recovery_permitted: false });
    throw error;
  }
}

export async function main(argv = process.argv.slice(2), overrides = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      design: { type: 'string', default: TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_DESIGN_PATH },
      'packet-root': { type: 'string' },
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
    process.stdout.write(`${TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_USAGE}\n`);
    return null;
  }
  if (values['accept-charges']) refuseRetiredPaidLaunch('tutor-stub-action-outcome-model-judge-shadow');
  if (!values['packet-root'] || !values['archive-root'] || !values.destination) {
    throw new Error(
      `--packet-root, --archive-root, and --destination are required\n\n${TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_USAGE}`,
    );
  }
  const preflight = (overrides.prepare || prepareTutorStubActionOutcomeModelJudge)({
    root: ROOT,
    designPath: values.design,
    packetRoot: path.resolve(values['packet-root']),
    archiveRoot: path.resolve(values['archive-root']),
    destination: path.resolve(values.destination),
    ...(overrides.resolve ? { resolve: overrides.resolve } : {}),
  });
  const publicPreflight = Object.fromEntries(
    Object.entries(preflight).filter(
      ([key]) => !['loaded', 'inputs', 'readersResolved', 'plan', 'executionUnits', 'archiveRoot'].includes(key),
    ),
  );
  process.stdout.write(`${JSON.stringify(publicPreflight, null, 2)}\n`);
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
    studyId: preflight.loaded.design.studyId,
    studyStateRoot: path.join(preflight.archiveRoot, 'artifacts/tutor-stub-live/.paid-study-state'),
  });
  return (overrides.execute || executeTutorStubActionOutcomeModelJudge)({
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
