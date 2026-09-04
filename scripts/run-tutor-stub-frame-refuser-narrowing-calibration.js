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
    --launch-commit <commit-to-record> \
    --go-note-commit <commit-containing-signed-note> \
    --go-note-path notes/<signed-go-note>.md \
    --accept-charges

  node scripts/run-tutor-stub-frame-refuser-narrowing-calibration.js \
    --design config/tutor-stub-frame-refuser-narrowing-calibration-design.v1.json \
    --archive-root /absolute/path/to/private-archive \
    --recovery-from /absolute/path/to/sealed-transport-failure-root \
    --destination /absolute/create-once/private-archive/artifacts/tutor-stub-live/recovery-name \
    --launch-commit <recovery-commit-to-record> \
    --go-note-commit <commit-containing-study-go-note> \
    --go-note-path notes/<signed-study-go-note>.md \
    --accept-charges

--dry-run verifies the design, sealed archive bytes, exact 24-row sample, model
routes, and 72-attempt ceiling without writing files or calling a model. The paid
path uses the shared standing launch contract and makes exactly one non-retried
request for each of three independent reader seats on each sampled row. Recovery
accepts only one sealed transport-failure root, never retries its failed unit,
skips every completed unit, and draws the never-attempted assignments from the
same durable study-wide 72-attempt ceiling. It needs no new recovery approval.`;

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

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function readJsonLines(filePath, label) {
  try {
    return fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    throw new Error(`${label} is not valid JSONL: ${error.message}`);
  }
}

function unitKey(caseId, seatId) {
  return `${caseId}/${seatId}`;
}

function allExecutionUnits(plan, readers) {
  return plan.cases.flatMap((caseEntry) => readers.map((seat) => ({ caseEntry, seat })));
}

export function loadTutorStubFrameRefuserNarrowingRecovery({ archiveRoot, recoveryFrom, loaded, plan, readers } = {}) {
  if (!recoveryFrom || !path.isAbsolute(recoveryFrom)) throw new Error('recovery root must be absolute');
  const liveRoot = path.resolve(archiveRoot, 'artifacts/tutor-stub-live');
  const priorRoot = path.resolve(recoveryFrom);
  const relative = path.relative(liveRoot, priorRoot);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('recovery root must be a child of the private archive artifacts/tutor-stub-live directory');
  }
  const priorPlan = readJson(path.join(priorRoot, 'plan.json'), 'prior recovery plan');
  const failure = readJson(path.join(priorRoot, 'failure.json'), 'prior recovery failure');
  const ledger = readJsonLines(path.join(priorRoot, 'run-ledger.jsonl'), 'prior recovery ledger');
  if (priorPlan.study_id !== loaded.design.studyId) throw new Error('recovery study id drift');
  if (priorPlan.design?.path !== loaded.relativePath || priorPlan.design?.sha256 !== loaded.sha256) {
    throw new Error('recovery design drift');
  }
  if (JSON.stringify(priorPlan.cases) !== JSON.stringify(plan.cases)) throw new Error('recovery sampled plan drift');
  if (priorPlan.hard_attempt_ceiling !== plan.hard_attempt_ceiling) throw new Error('recovery attempt ceiling drift');
  if (
    failure.schema !== 'machinespirits.tutor-stub.frame-refuser-narrowing-calibration-failure.v1' ||
    failure.status !== 'transport_failure' ||
    !failure.unit ||
    failure.unit !== unitKey(failure.case_id, failure.seat_id) ||
    failure.hard_attempt_ceiling !== plan.hard_attempt_ceiling
  ) {
    throw new Error('recovery requires one sealed transport failure');
  }
  const launchEvents = ledger.filter((event) => event.type === 'launch_admitted');
  if (launchEvents.length !== 1 || launchEvents[0].spend_cap !== plan.hard_attempt_ceiling) {
    throw new Error('recovery source launch admission does not match the registered attempt ceiling');
  }
  const seal = ledger.at(-1);
  if (seal?.type !== 'run_sealed' || seal?.status !== 'transport_failure' || seal?.unit !== failure.unit) {
    throw new Error('recovery source ledger is not sealed at the named transport failure');
  }
  const transportFailures = ledger.filter((event) => event.type === 'reader_transport_failure');
  if (
    transportFailures.length !== 1 ||
    transportFailures[0].status !== 'transport_failure' ||
    transportFailures[0].unit !== failure.unit ||
    transportFailures[0].error !== failure.error
  ) {
    throw new Error('recovery requires exactly one matching transport-failure ledger event');
  }
  const reservationEvents = ledger.filter((event) => event.type === 'model_attempt_reserved');
  const priorAttempts = reservationEvents.reduce((sum, event) => sum + Number(event.count || 0), 0);
  const reservedUnits = reservationEvents.map((event) => event.unit);
  if (
    !Number.isInteger(priorAttempts) ||
    priorAttempts < 1 ||
    priorAttempts >= plan.hard_attempt_ceiling ||
    failure.attempted_calls !== priorAttempts ||
    failure.reserved_calls !== priorAttempts ||
    new Set(reservedUnits).size !== reservedUnits.length
  ) {
    throw new Error('recovery source attempt accounting is inconsistent');
  }

  const expectedUnits = allExecutionUnits(plan, readers);
  const expectedByKey = new Map(expectedUnits.map((entry) => [unitKey(entry.caseEntry.case_id, entry.seat.id), entry]));
  if (!expectedByKey.has(failure.unit)) throw new Error('recovery failed unit is outside the registered plan');
  const resultDirectory = path.join(priorRoot, 'results');
  const resultFiles = fs
    .readdirSync(resultDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(resultDirectory, entry.name))
    .sort();
  const priorRecords = resultFiles.map((filePath) => readJson(filePath, `prior result ${path.basename(filePath)}`));
  const completedKeys = new Set();
  for (const record of priorRecords) {
    const key = unitKey(record.case_id, record.seat_id);
    const expected = expectedByKey.get(key);
    if (!expected || completedKeys.has(key) || key === failure.unit)
      throw new Error(`invalid prior result unit ${key}`);
    if (
      record.schema !== 'machinespirits.tutor-stub.frame-refuser-narrowing-reader-result.v1' ||
      record.packet_sha256 !== expected.caseEntry.packet_sha256 ||
      record.route?.model_ref !== expected.seat.modelRef ||
      record.route?.provider !== expected.seat.provider ||
      record.route?.model !== expected.seat.model ||
      record.route?.effort !== expected.seat.effort
    ) {
      throw new Error(`prior result provenance drift for ${key}`);
    }
    const prompt = buildTutorStubFrameRefuserNarrowingReaderPrompt({
      instrumentText: loaded.instrumentText,
      caseId: expected.caseEntry.case_id,
      publicPacket: expected.caseEntry.public_packet,
    });
    const reevaluated = evaluateTutorStubFrameRefuserNarrowingReaderResponse({
      response: record.response,
      seat: expected.seat,
      prompt,
    });
    if (JSON.stringify(reevaluated) !== JSON.stringify(record.measurement)) {
      throw new Error(`prior result measurement drift for ${key}`);
    }
    completedKeys.add(key);
  }
  if (priorRecords.length + 1 !== priorAttempts) throw new Error('recovery source results do not close to attempts');
  const resolvedPriorUnits = new Set([...completedKeys, failure.unit]);
  if (reservedUnits.length !== resolvedPriorUnits.size || reservedUnits.some((key) => !resolvedPriorUnits.has(key))) {
    throw new Error('recovery source reservations do not match completed and failed units');
  }
  const executionUnits = expectedUnits.filter(
    (entry) => !resolvedPriorUnits.has(unitKey(entry.caseEntry.case_id, entry.seat.id)),
  );
  const remainingAttempts = plan.hard_attempt_ceiling - priorAttempts;
  if (executionUnits.length !== remainingAttempts) {
    throw new Error('recovery missing-unit count does not close to the combined attempt ceiling');
  }
  return {
    source_root: priorRoot,
    source_plan: path.join(priorRoot, 'plan.json'),
    source_ledger: path.join(priorRoot, 'run-ledger.jsonl'),
    prior_attempts: priorAttempts,
    prior_completed_units: priorRecords.length,
    failed_unit: failure.unit,
    failed_case_id: failure.case_id,
    failed_seat_id: failure.seat_id,
    remaining_attempts: remainingAttempts,
    executionUnits,
    priorRecords,
    failure,
  };
}

export function prepareTutorStubFrameRefuserNarrowingCalibration({
  root = ROOT,
  designPath,
  archiveRoot,
  destination,
  recoveryFrom,
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
  const recovery = recoveryFrom
    ? loadTutorStubFrameRefuserNarrowingRecovery({
        archiveRoot: privateArchiveRoot,
        recoveryFrom,
        loaded,
        plan,
        readers,
      })
    : null;
  const executionUnits = recovery?.executionUnits || allExecutionUnits(plan, readers);
  const remainingStudyAttempts = recovery?.remaining_attempts ?? plan.hard_attempt_ceiling;
  return {
    status: 'passed_zero_call',
    design: { path: loaded.relativePath, sha256: loaded.sha256 },
    private_archive_commit: loaded.design.source.privateArchiveCommit,
    destination: runDestination,
    sample_size: plan.cases.length,
    readers: readers.map(({ resolved: _resolved, ...seat }) => seat),
    planned_model_calls: plan.planned_model_calls,
    recovery_model_calls: executionUnits.length,
    prior_attempts: recovery?.prior_attempts || 0,
    remaining_study_attempts: remainingStudyAttempts,
    recovery_summary: recovery
      ? {
          source_root: recovery.source_root,
          prior_attempts: recovery.prior_attempts,
          prior_completed_units: recovery.prior_completed_units,
          failed_unit: recovery.failed_unit,
          remaining_attempts: recovery.remaining_attempts,
          policy: 'skip every completed and failed unit; execute only never-attempted assignments',
        }
      : null,
    hard_attempt_ceiling: plan.hard_attempt_ceiling,
    model_calls_executed: 0,
    plan,
    loaded,
    resolvedReaders: readers,
    executionUnits,
    priorRecords: recovery?.priorRecords || [],
    failedUnits: recovery ? [recovery.failure] : [],
    recovery,
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
  refuseRetiredPaidLaunch('tutor-stub-frame-refuser-narrowing-calibration');
  const { destination, loaded, plan, executionUnits, priorRecords, failedUnits, recovery } = preflight;
  fs.mkdirSync(path.join(destination, 'results'), { recursive: false });
  writeOnce(path.join(destination, 'plan.json'), {
    ...plan,
    status: 'admitted_under_shared_paid_study_launch_contract',
    source: { ...plan.source, launch: admission.source },
    authorization: admission.authorization,
    recovery: recovery
      ? {
          source_root: recovery.source_root,
          source_plan: recovery.source_plan,
          source_ledger: recovery.source_ledger,
          prior_attempts: recovery.prior_attempts,
          prior_completed_units: recovery.prior_completed_units,
          failed_unit: recovery.failed_unit,
          remaining_attempts: recovery.remaining_attempts,
          policy: 'skip every completed and failed unit; execute only never-attempted assignments',
        }
      : null,
    execution_units: executionUnits.map(({ caseEntry, seat }) => unitKey(caseEntry.case_id, seat.id)),
  });

  const records = [...priorRecords];
  const priorAttempts = recovery?.prior_attempts || 0;
  const executionLabel = recovery ? 'recovery' : 'run';
  let attemptedCalls = 0;
  try {
    for (const { caseEntry, seat } of executionUnits) {
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
          prior_attempts: priorAttempts,
          combined_attempts: priorAttempts + attemptedCalls,
          reserved_calls: admission.reserved,
          hard_attempt_ceiling: plan.hard_attempt_ceiling,
          error: error.message,
        };
        writeOnce(path.join(destination, 'failure.json'), failure);
        admission.record({ type: 'reader_transport_failure', ...failure });
        admission.close({
          type: 'run_sealed',
          status: 'transport_failure',
          recovery_permitted: true,
          unit,
          attempted_calls: attemptedCalls,
          combined_attempts: priorAttempts + attemptedCalls,
        });
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
        combined_attempts: priorAttempts + attemptedCalls,
        reserved_calls: admission.reserved,
      });
      progress(
        `completed records ${records.length}/${plan.planned_model_calls}; total attempts ${priorAttempts + attemptedCalls}/${plan.hard_attempt_ceiling}; ${executionLabel} ${attemptedCalls}/${executionUnits.length}; ${unit} ${measurement.eligible ? 'eligible' : 'ineligible'}`,
      );
    }
    const report = {
      ...summarize({ plan, records, design: loaded.design }),
      execution: {
        complete_units: records.length,
        eligible_units: records.filter((entry) => entry.measurement.eligible).length,
        failed_units: failedUnits.length,
        failed_unit_ids: failedUnits.map((entry) => entry.unit),
        missing_units: plan.planned_model_calls - records.length - failedUnits.length,
        prior_attempted_model_calls: priorAttempts,
        recovery_attempted_model_calls: attemptedCalls,
        attempted_model_calls: priorAttempts + attemptedCalls,
        recovery_reserved_model_calls: admission.reserved,
        reserved_model_calls: priorAttempts + admission.reserved,
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
      failed_units: failedUnits.length,
      attempted_calls: report.execution.attempted_model_calls,
      reserved_calls: report.execution.reserved_model_calls,
    });
    progress(`${report.status}: ${path.join(destination, 'report.json')}`);
    return report;
  } catch (error) {
    if (!fs.existsSync(path.join(destination, 'failure.json'))) {
      const failure = {
        schema: 'machinespirits.tutor-stub.frame-refuser-narrowing-calibration-failure.v1',
        status: 'launcher_failure',
        attempted_calls: attemptedCalls,
        prior_attempts: priorAttempts,
        combined_attempts: priorAttempts + attemptedCalls,
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
      'recovery-from': { type: 'string' },
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
  if (values['accept-charges']) refuseRetiredPaidLaunch('tutor-stub-frame-refuser-narrowing-calibration');
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
    ...(values['recovery-from'] ? { recoveryFrom: values['recovery-from'] } : {}),
    ...(overrides.resolve ? { resolve: overrides.resolve } : {}),
    ...(overrides.verifyCommittedFile ? { verifyCommittedFile: overrides.verifyCommittedFile } : {}),
  });
  const publicPreflight = Object.fromEntries(
    Object.entries(preflight).filter(
      ([key]) =>
        ![
          'loaded',
          'resolvedReaders',
          'archiveRoot',
          'plan',
          'executionUnits',
          'priorRecords',
          'failedUnits',
          'recovery',
        ].includes(key),
    ),
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
    studyId: preflight.loaded.design.studyId,
    studyStateRoot: path.join(preflight.archiveRoot, 'artifacts/tutor-stub-live/.paid-study-state'),
    ...(preflight.recovery ? { recoveryFrom: preflight.recovery.source_root } : {}),
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
